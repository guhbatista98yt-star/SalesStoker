/**
 * Copiloto de Compras — API Routes (unificado)
 *
 * Combina:
 *   - BI/Dashboard: /dashboard, /fornecedores, /produtos, /sugestoes, /simulacao
 *   - Notificações SSE + CRUD: /sse, /alertas, /alertas/unread-count,
 *     /alertas/:id/status, /alertas/marcar-todos-lidos, /alertas/:id/eventos
 *   - Preferências do usuário: /preferencias
 *   - Configurações administrativas: /configuracoes
 */

import { Router } from "express";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { isAuthenticated, isAdmin, type AuthRequest } from "../auth";
import * as service from "./service";
import { pgGet, pgAll, pgRun } from "../pg-client";
import { db } from "../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import { addSseClient, removeSseClient } from "./sse-manager";

const JWT_SECRET = process.env.SESSION_SECRET!;

const router = Router();

// ---------------------------------------------------------------------------
// SSE — Real-time alert stream (auth via query param — EventSource can't set headers)
// ---------------------------------------------------------------------------

router.get("/sse", async (req: AuthRequest, res) => {
  const token = (req.query.token as string) || "";
  if (!token) {
    res.status(401).end();
    return;
  }

  let userId: number;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    userId = decoded.userId;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) { res.status(401).end(); return; }
  } catch {
    res.status(401).end();
    return;
  }

  const clientId = randomUUID();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, userId })}\n\n`);

  addSseClient(clientId, userId, res);

  const keepAlive = setInterval(() => {
    try {
      res.write(`:keepalive\n\n`);
    } catch {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    removeSseClient(clientId);
  });
});

// ---------------------------------------------------------------------------
// BI Dashboard
// ---------------------------------------------------------------------------

router.get("/dashboard", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const kpis = await service.getDashboardKPIs();
    res.json(kpis);
  } catch (err: any) {
    console.error("[compras/dashboard]", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// BI Fornecedores
// ---------------------------------------------------------------------------

router.get("/fornecedores", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const ranking = await service.getRankingFornecedores();
    res.json(ranking);
  } catch (err: any) {
    console.error("[compras/fornecedores]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/fornecedores/:id", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const fabricante = decodeURIComponent(req.params.id);
    const detalhe = await service.getDetalheFornecedor(fabricante);
    res.json(detalhe);
  } catch (err: any) {
    console.error("[compras/fornecedores/:id]", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// BI Produtos
// ---------------------------------------------------------------------------

router.get("/produtos", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const ranking = await service.getRankingProdutos({
      urgencia: req.query.urgencia as string | undefined,
      fabricante: req.query.fabricante as string | undefined,
    });
    res.json(ranking);
  } catch (err: any) {
    console.error("[compras/produtos]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/produtos/:id", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const produtoId = decodeURIComponent(req.params.id);
    const detalhe = await service.getDetalheProduto(produtoId);
    res.json(detalhe);
  } catch (err: any) {
    console.error("[compras/produtos/:id]", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// BI Sugestões
// ---------------------------------------------------------------------------

router.get("/sugestoes", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const sugestoes = await service.getSugestoes({
      urgencia: req.query.urgencia as string | undefined,
      fabricante: req.query.fabricante as string | undefined,
    });
    res.json(sugestoes);
  } catch (err: any) {
    console.error("[compras/sugestoes]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/sugestoes/fornecedor/:id", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const fabricante = decodeURIComponent(req.params.id);
    const sugestoes = await service.getSugestoesPorFornecedor(fabricante);
    res.json(sugestoes);
  } catch (err: any) {
    console.error("[compras/sugestoes/fornecedor/:id]", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// BI Simulação
// ---------------------------------------------------------------------------

router.post("/simulacao", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const { produtoIds, quantidades } = req.body as {
      produtoIds: string[];
      quantidades: Record<string, number>;
    };

    if (!Array.isArray(produtoIds) || produtoIds.length === 0) {
      return res.status(400).json({ error: "produtoIds é obrigatório e deve ser um array não vazio" });
    }
    if (!quantidades || typeof quantidades !== "object") {
      return res.status(400).json({ error: "quantidades é obrigatório e deve ser um objeto" });
    }

    const resultado = await service.runSimulacao(produtoIds, quantidades);
    res.json(resultado);
  } catch (err: any) {
    console.error("[compras/simulacao]", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Purchase Alerts — CRUD (user-scoped, new schema)
// ---------------------------------------------------------------------------

router.get("/alertas/unread-count", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const row = await pgGet<{ total: number }>(
      `SELECT COUNT(*) as total FROM purchase_alerts WHERE user_id = ? AND status = 'nao_lido'`,
      [userId]
    );
    res.json({ count: row?.total ?? 0 });
  } catch (err) {
    console.error("[compras/alertas/unread-count GET]", err);
    res.status(500).json({ error: "Erro ao buscar contagem" });
  }
});

router.get("/alertas", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { status, severity, limit = "50", offset = "0" } = req.query as Record<string, string>;

    let where = `WHERE user_id = ?`;
    const params: unknown[] = [userId];

    if (status) {
      where += ` AND status = ?`;
      params.push(status);
    }
    if (severity) {
      where += ` AND severity = ?`;
      params.push(severity);
    }

    const rows = await pgAll(
      `SELECT * FROM purchase_alerts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const countRow = await pgGet<{ total: number }>(
      `SELECT COUNT(*) as total FROM purchase_alerts ${where}`,
      params
    );

    const unreadRow = await pgGet<{ total: number }>(
      `SELECT COUNT(*) as total FROM purchase_alerts WHERE user_id = ? AND status = 'nao_lido'`,
      [userId]
    );

    res.json({
      alerts: rows.map(r => ({
        ...r,
        data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
      })),
      total: countRow?.total ?? 0,
      unreadCount: unreadRow?.total ?? 0,
    });
  } catch (err) {
    console.error("[compras/alertas GET]", err);
    res.status(500).json({ error: "Erro ao buscar alertas" });
  }
});

router.patch("/alertas/:id/status", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { status } = req.body as { status: string };

    const validStatuses = ["nao_lido", "lido", "reconhecido", "adiado", "silenciado", "resolvido", "reaberto"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const alert = await pgGet(
      `SELECT id FROM purchase_alerts WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (!alert) return res.status(404).json({ error: "Alerta não encontrado" });

    await pgRun(
      `UPDATE purchase_alerts SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      [status, new Date().toISOString(), id, userId]
    );

    await pgRun(
      `INSERT INTO purchase_alert_events (id, alert_id, user_id, action, rule_name, details, created_at)
       VALUES (?, ?, ?, ?, 'manual', ?, ?)`,
      [randomUUID(), id, userId, status, JSON.stringify({}), new Date().toISOString()]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[compras/alertas/:id/status PATCH]", err);
    res.status(500).json({ error: "Erro ao atualizar alerta" });
  }
});

router.post("/alertas/marcar-todos-lidos", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const now = new Date().toISOString();

    const affected = await pgRun(
      `UPDATE purchase_alerts SET status = 'lido', updated_at = ? WHERE user_id = ? AND status = 'nao_lido'`,
      [now, userId]
    );

    if (affected > 0) {
      await pgRun(
        `INSERT INTO purchase_alert_events (id, alert_id, user_id, action, rule_name, details, created_at)
         VALUES (?, 'bulk', ?, 'lido_todos', 'manual', ?, ?)`,
        [randomUUID(), userId, JSON.stringify({ affected }), now]
      );
    }

    res.json({ success: true, affected });
  } catch (err) {
    console.error("[compras/alertas/marcar-todos-lidos POST]", err);
    res.status(500).json({ error: "Erro ao marcar alertas como lidos" });
  }
});

router.get("/alertas/:id/eventos", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const alert = await pgGet(
      `SELECT id FROM purchase_alerts WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (!alert) return res.status(404).json({ error: "Alerta não encontrado" });

    const events = await pgAll(
      `SELECT * FROM purchase_alert_events WHERE alert_id = ? ORDER BY created_at DESC`,
      [id]
    );

    res.json(events);
  } catch (err) {
    console.error("[compras/alertas/:id/eventos GET]", err);
    res.status(500).json({ error: "Erro ao buscar eventos do alerta" });
  }
});

// ---------------------------------------------------------------------------
// User Alert Preferences
// ---------------------------------------------------------------------------

router.get("/preferencias", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const row = await pgGet(
      `SELECT * FROM user_alert_preferences WHERE user_id = ?`,
      [userId]
    );

    if (!row) {
      return res.json({
        userId,
        enabled: true,
        soundEnabled: true,
        onlyCriticalSound: false,
        mutedUntil: null,
      });
    }

    res.json({
      userId: row.user_id,
      enabled: Boolean(row.enabled),
      soundEnabled: Boolean(row.sound_enabled),
      onlyCriticalSound: Boolean(row.only_critical_sound),
      mutedUntil: row.muted_until,
    });
  } catch (err) {
    console.error("[compras/preferencias GET]", err);
    res.status(500).json({ error: "Erro ao buscar preferências" });
  }
});

router.put("/preferencias", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { enabled, soundEnabled, onlyCriticalSound, mutedUntil } = req.body as {
      enabled?: boolean;
      soundEnabled?: boolean;
      onlyCriticalSound?: boolean;
      mutedUntil?: string | null;
    };

    const existing = await pgGet(
      `SELECT id FROM user_alert_preferences WHERE user_id = ?`,
      [userId]
    );

    const now = new Date().toISOString();

    if (existing) {
      await pgRun(
        `UPDATE user_alert_preferences SET
          enabled = COALESCE(?, enabled),
          sound_enabled = COALESCE(?, sound_enabled),
          only_critical_sound = COALESCE(?, only_critical_sound),
          muted_until = ?,
          updated_at = ?
         WHERE user_id = ?`,
        [
          enabled !== undefined ? (enabled ? 1 : 0) : null,
          soundEnabled !== undefined ? (soundEnabled ? 1 : 0) : null,
          onlyCriticalSound !== undefined ? (onlyCriticalSound ? 1 : 0) : null,
          mutedUntil !== undefined ? mutedUntil : null,
          now,
          userId,
        ]
      );
    } else {
      await pgRun(
        `INSERT INTO user_alert_preferences (id, user_id, enabled, sound_enabled, only_critical_sound, muted_until, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          userId,
          enabled !== undefined ? (enabled ? 1 : 0) : 1,
          soundEnabled !== undefined ? (soundEnabled ? 1 : 0) : 1,
          onlyCriticalSound !== undefined ? (onlyCriticalSound ? 1 : 0) : 0,
          mutedUntil !== undefined ? mutedUntil : null,
          now,
          now,
        ]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[compras/preferencias PUT]", err);
    res.status(500).json({ error: "Erro ao salvar preferências" });
  }
});

// ---------------------------------------------------------------------------
// Admin — Global Purchase Settings
// ---------------------------------------------------------------------------

router.get("/configuracoes", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const rows = await pgAll<{ key: string; value: string }>(
      `SELECT key, value FROM purchase_settings`
    );

    const defaults: Record<string, string> = {
      alerts_enabled: "true",
      cooldown_minutes: "60",
      min_severity_sound: "importante",
      repetition_window_hours: "24",
      grouping_policy: "by_type",
      expiration_hours: "168",
      retention_days: "90",
    };

    const settings = { ...defaults };
    for (const r of rows) {
      settings[r.key] = r.value;
    }

    res.json(settings);
  } catch (err) {
    console.error("[compras/configuracoes GET]", err);
    res.status(500).json({ error: "Erro ao buscar configurações" });
  }
});

router.put("/configuracoes", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== "admin" && req.userRole !== "supervisor") {
      return res.status(403).json({ error: "Acesso negado" });
    }

    const body = req.body as Record<string, string>;
    const now = new Date().toISOString();

    const allowed = [
      "alerts_enabled",
      "cooldown_minutes",
      "min_severity_sound",
      "repetition_window_hours",
      "grouping_policy",
      "expiration_hours",
      "retention_days",
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        await pgRun(
          `INSERT INTO purchase_settings (id, key, value, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
          [randomUUID(), key, String(body[key]), now]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[compras/configuracoes PUT]", err);
    res.status(500).json({ error: "Erro ao salvar configurações" });
  }
});

export default router;
