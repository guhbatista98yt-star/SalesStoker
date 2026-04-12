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
        id: r.id,
        userId: r.user_id,
        type: r.type,
        referenceKey: r.reference_key,
        severityBand: r.severity_band,
        severity: r.severity,
        title: r.title,
        message: r.message,
        status: r.status,
        data: typeof r.data === "string" ? JSON.parse(r.data) : (r.data ?? {}),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
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
    const rows = await pgAll<{ chave: string; valor: string }>(
      `SELECT chave, valor FROM purchase_settings`
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
      settings[r.chave] = r.valor;
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
          `INSERT INTO purchase_settings (chave, valor, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = EXCLUDED.updated_at`,
          [key, String(body[key]), now]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[compras/configuracoes PUT]", err);
    res.status(500).json({ error: "Erro ao salvar configurações" });
  }
});

// ---------------------------------------------------------------------------
// Configuração de Fornecedores (Admin)
// ---------------------------------------------------------------------------

router.get("/fornecedores-config", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    // Return all supplier configs merged with distinct FABRICANTEs from cache_campanhas
    const [configs, fabricantes] = await Promise.all([
      pgAll<Record<string, unknown>>(`SELECT * FROM compras_fornecedores_config ORDER BY fabricante_nome`),
      pgAll<{ FABRICANTE: string; ultimo_movimento: string; total_skus: number }>(
        `SELECT "FABRICANTE",
                MAX("DTMOVIMENTO") as ultimo_movimento,
                COUNT(DISTINCT "IDPRODUTO") as total_skus
         FROM cache_campanhas
         WHERE "FABRICANTE" IS NOT NULL AND "FABRICANTE" != ''
         GROUP BY "FABRICANTE"
         ORDER BY "FABRICANTE"`
      ),
    ]);

    const configMap = new Map(configs.map(c => [c.fabricante_nome as string, c]));

    const result = fabricantes.map(f => {
      const cfg = configMap.get(f.FABRICANTE);
      return {
        id: cfg?.id ?? null,
        fabricante_nome: f.FABRICANTE,
        codigo: cfg?.codigo ?? "",
        razao_social: cfg?.razao_social ?? "",
        nome_fantasia: cfg?.nome_fantasia ?? f.FABRICANTE,
        ativo: cfg !== undefined ? Boolean(cfg.ativo) : true,
        periodo_compra_dias: cfg?.periodo_compra_dias ?? 30,
        lead_time_dias: cfg?.lead_time_dias ?? 7,
        pedido_minimo_valor: cfg?.pedido_minimo_valor ?? 0,
        observacoes: cfg?.observacoes ?? "",
        ultimo_movimento: f.ultimo_movimento,
        total_skus: f.total_skus,
        configurado: cfg !== undefined,
      };
    });

    res.json(result);
  } catch (err: any) {
    console.error("[compras/fornecedores-config GET]", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/fornecedores-config/:fabricante", isAuthenticated, isAdmin, async (req: AuthRequest, res) => {
  try {
    const fabricante = decodeURIComponent(req.params.fabricante);
    const {
      codigo, razao_social, nome_fantasia, ativo,
      periodo_compra_dias, lead_time_dias, pedido_minimo_valor, observacoes,
    } = req.body as Record<string, unknown>;

    const now = new Date().toISOString();
    const existing = await pgGet<{ id: string }>(
      `SELECT id FROM compras_fornecedores_config WHERE fabricante_nome = ?`, [fabricante]
    );

    if (existing) {
      await pgRun(
        `UPDATE compras_fornecedores_config SET
           codigo = ?, razao_social = ?, nome_fantasia = ?, ativo = ?,
           periodo_compra_dias = ?, lead_time_dias = ?, pedido_minimo_valor = ?,
           observacoes = ?, updated_at = ?
         WHERE fabricante_nome = ?`,
        [
          String(codigo ?? ""), String(razao_social ?? ""), String(nome_fantasia ?? ""),
          ativo !== false ? 1 : 0,
          Number(periodo_compra_dias ?? 30), Number(lead_time_dias ?? 7),
          Number(pedido_minimo_valor ?? 0), String(observacoes ?? ""),
          now, fabricante,
        ]
      );
    } else {
      await pgRun(
        `INSERT INTO compras_fornecedores_config
           (id, fabricante_nome, codigo, razao_social, nome_fantasia, ativo,
            periodo_compra_dias, lead_time_dias, pedido_minimo_valor, observacoes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), fabricante,
          String(codigo ?? ""), String(razao_social ?? ""), String(nome_fantasia ?? ""),
          ativo !== false ? 1 : 0,
          Number(periodo_compra_dias ?? 30), Number(lead_time_dias ?? 7),
          Number(pedido_minimo_valor ?? 0), String(observacoes ?? ""),
          now, now,
        ]
      );
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[compras/fornecedores-config PUT]", err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Configuração de Produtos (Admin)
// ---------------------------------------------------------------------------

router.get("/produtos-config", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const { fabricante } = req.query as { fabricante?: string };

    let where = `WHERE "IDPRODUTO" IS NOT NULL AND "IDPRODUTO" != ''`;
    const params: unknown[] = [];
    if (fabricante) {
      where += ` AND "FABRICANTE" = ?`;
      params.push(fabricante);
    }

    const [produtos, configs, ultimasCompras] = await Promise.all([
      pgAll<{ IDPRODUTO: string; FABRICANTE: string; nome_produto: string; total_vendido: number }>(
        `SELECT "IDPRODUTO", "FABRICANTE",
                COALESCE("NOMEVENDEDOR", "IDPRODUTO") as nome_produto,
                COALESCE(SUM("QTD"), 0) as total_vendido
         FROM cache_campanhas ${where}
         GROUP BY "IDPRODUTO", "FABRICANTE"
         ORDER BY total_vendido DESC
         LIMIT 500`,
        params
      ),
      pgAll<Record<string, unknown>>(
        fabricante
          ? `SELECT * FROM compras_produtos_config WHERE fornecedor_nome = ?`
          : `SELECT * FROM compras_produtos_config`,
        fabricante ? [fabricante] : []
      ),
      pgAll<{ IDPRODUTO: string; FABRICANTE: string; ultima_compra: string; ultima_qtd: number }>(
        `SELECT c."IDPRODUTO", c."FABRICANTE",
                c."DTMOVIMENTO" as ultima_compra,
                c."QTD" as ultima_qtd
         FROM cache_campanhas c
         INNER JOIN (
           SELECT "IDPRODUTO", "FABRICANTE", MAX("DTMOVIMENTO") as max_dt
           FROM cache_campanhas ${where}
           GROUP BY "IDPRODUTO", "FABRICANTE"
         ) m ON c."IDPRODUTO" = m."IDPRODUTO" AND c."FABRICANTE" = m."FABRICANTE" AND c."DTMOVIMENTO" = m.max_dt`,
        [...params, ...params]
      ),
    ]);

    const configMap = new Map(configs.map(c => [`${c.produto_id}::${c.fornecedor_nome}`, c]));
    const ultimaMap = new Map(ultimasCompras.map(u => [`${u.IDPRODUTO}::${u.FABRICANTE}`, u]));

    const result = produtos.map(p => {
      const key = `${p.IDPRODUTO}::${p.FABRICANTE}`;
      const cfg = configMap.get(key);
      const ult = ultimaMap.get(key);
      return {
        id: cfg?.id ?? null,
        produto_id: p.IDPRODUTO,
        fornecedor_nome: p.FABRICANTE,
        descricao: p.IDPRODUTO,
        total_vendido: p.total_vendido,
        estoque_minimo: cfg?.estoque_minimo ?? 0,
        estoque_maximo: cfg?.estoque_maximo ?? 0,
        lote_minimo: cfg?.lote_minimo ?? 1,
        multiplo_embalagem: cfg?.multiplo_embalagem ?? 1,
        giro_periodo_dias: cfg?.giro_periodo_dias ?? 90,
        ativo: cfg !== undefined ? Boolean(cfg.ativo) : true,
        ultima_compra: ult?.ultima_compra ?? null,
        ultima_qtd: ult?.ultima_qtd ?? null,
        configurado: cfg !== undefined,
      };
    });

    res.json(result);
  } catch (err: any) {
    console.error("[compras/produtos-config GET]", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/produtos-config/:produtoId/:fornecedor", isAuthenticated, isAdmin, async (req: AuthRequest, res) => {
  try {
    const produtoId = decodeURIComponent(req.params.produtoId);
    const fornecedorNome = decodeURIComponent(req.params.fornecedor);
    const {
      estoque_minimo, estoque_maximo, lote_minimo,
      multiplo_embalagem, giro_periodo_dias, ativo,
    } = req.body as Record<string, unknown>;

    const now = new Date().toISOString();
    const existing = await pgGet<{ id: string }>(
      `SELECT id FROM compras_produtos_config WHERE produto_id = ? AND fornecedor_nome = ?`,
      [produtoId, fornecedorNome]
    );

    if (existing) {
      await pgRun(
        `UPDATE compras_produtos_config SET
           estoque_minimo = ?, estoque_maximo = ?, lote_minimo = ?,
           multiplo_embalagem = ?, giro_periodo_dias = ?, ativo = ?, updated_at = ?
         WHERE produto_id = ? AND fornecedor_nome = ?`,
        [
          Number(estoque_minimo ?? 0), Number(estoque_maximo ?? 0), Number(lote_minimo ?? 1),
          Number(multiplo_embalagem ?? 1), Number(giro_periodo_dias ?? 90),
          ativo !== false ? 1 : 0, now,
          produtoId, fornecedorNome,
        ]
      );
    } else {
      await pgRun(
        `INSERT INTO compras_produtos_config
           (id, produto_id, fornecedor_nome, estoque_minimo, estoque_maximo,
            lote_minimo, multiplo_embalagem, giro_periodo_dias, ativo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), produtoId, fornecedorNome,
          Number(estoque_minimo ?? 0), Number(estoque_maximo ?? 0),
          Number(lote_minimo ?? 1), Number(multiplo_embalagem ?? 1),
          Number(giro_periodo_dias ?? 90), ativo !== false ? 1 : 0,
          now, now,
        ]
      );
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("[compras/produtos-config PUT]", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
