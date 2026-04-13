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
import { isAuthenticated, isAdmin, isCompradorOuAdmin, type AuthRequest } from "../auth";
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
    const role = user.role ?? "";
    if (role !== "admin" && role !== "supervisor" && role !== "comprador") {
      res.status(403).end();
      return;
    }
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

function parseCompanyId(req: AuthRequest): number | undefined {
  const raw = req.query.company_id as string | undefined;
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return isNaN(n) || n <= 0 ? undefined : n;
}

router.get("/dashboard", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const kpis = await service.getDashboardKPIs(parseCompanyId(req));
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
    const ranking = await service.getRankingFornecedores(parseCompanyId(req));
    res.json(ranking);
  } catch (err: any) {
    console.error("[compras/fornecedores]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/fornecedores/:id", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const fabricante = decodeURIComponent(String(req.params.id));
    const detalhe = await service.getDetalheFornecedor(fabricante, parseCompanyId(req));
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
    const ranking = await service.getRankingProdutos(
      {
        urgencia: req.query.urgencia as string | undefined,
        fabricante: req.query.fabricante as string | undefined,
      },
      parseCompanyId(req),
    );
    res.json(ranking);
  } catch (err: any) {
    console.error("[compras/produtos]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/produtos/:id", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const produtoId = decodeURIComponent(String(req.params.id));
    const detalhe = await service.getDetalheProduto(produtoId, parseCompanyId(req));
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
    const sugestoes = await service.getSugestoes(
      {
        urgencia: req.query.urgencia as string | undefined,
        fabricante: req.query.fabricante as string | undefined,
      },
      parseCompanyId(req),
    );
    res.json(sugestoes);
  } catch (err: any) {
    console.error("[compras/sugestoes]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/sugestoes/fornecedor/:id", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const fabricante = decodeURIComponent(String(req.params.id));
    const sugestoes = await service.getSugestoesPorFornecedor(fabricante, parseCompanyId(req));
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

router.get("/alertas/unread-count", isAuthenticated, isCompradorOuAdmin, async (req: AuthRequest, res) => {
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

router.get("/alertas", isAuthenticated, isCompradorOuAdmin, async (req: AuthRequest, res) => {
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

router.patch("/alertas/:id/status", isAuthenticated, isCompradorOuAdmin, async (req: AuthRequest, res) => {
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

router.post("/alertas/marcar-todos-lidos", isAuthenticated, isCompradorOuAdmin, async (req: AuthRequest, res) => {
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

router.get("/alertas/:id/eventos", isAuthenticated, isCompradorOuAdmin, async (req: AuthRequest, res) => {
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

router.get("/preferencias", isAuthenticated, isCompradorOuAdmin, async (req: AuthRequest, res) => {
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

router.put("/preferencias", isAuthenticated, isCompradorOuAdmin, async (req: AuthRequest, res) => {
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

/**
 * POST /fornecedores-config/sync
 * Materialises distinct FABRICANTE values from cache_campanhas into
 * compras_fornecedores_config (upsert — preserves existing configurations).
 * Returns { created, updated, total } counts.
 */
router.post("/fornecedores-config/sync", isAuthenticated, isAdmin, async (req: AuthRequest, res) => {
  try {
    const companyId = parseCompanyId(req);
    const cid = companyId ?? 1;

    // Union de cache_campanhas (vendas) + cache_estoque_sugestao (estoque ERP).
    // Funciona mesmo que apenas uma das fontes esteja populada.
    // cache_campanhas é filtrado por empresa; cache_estoque_sugestao é global (sem IDEMPRESA).
    const campanhasFilter = companyId
      ? `AND ("IDEMPRESA" = '${companyId}' OR "IDEMPRESA" = '')`
      : "";

    const fabricantes = await pgAll<{ fabricante_nome: string; total_skus: number }>(
      `SELECT "FABRICANTE" as fabricante_nome, SUM(total_skus) as total_skus
       FROM (
         SELECT "FABRICANTE", COUNT(DISTINCT "IDPRODUTO") as total_skus
         FROM cache_campanhas
         WHERE "FABRICANTE" IS NOT NULL AND "FABRICANTE" != '' ${campanhasFilter}
         GROUP BY "FABRICANTE"
         UNION ALL
         SELECT "FABRICANTE", COUNT(DISTINCT "IDPRODUTO") as total_skus
         FROM cache_estoque_sugestao
         WHERE "FABRICANTE" IS NOT NULL AND "FABRICANTE" != ''
         GROUP BY "FABRICANTE"
       ) t
       GROUP BY "FABRICANTE"
       ORDER BY "FABRICANTE"`,
    );

    if (fabricantes.length === 0) {
      return res.status(400).json({
        error: "Sem dados de fornecedores. Execute no Windows: python sync/erp_sync.py campanhas && python sync/erp_sync.py estoque_sugestao",
      });
    }

    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;

    for (const f of fabricantes) {
      const nome = f.fabricante_nome;
      const existing = await pgGet<{ id: string }>(
        `SELECT id FROM compras_fornecedores_config WHERE company_id = ? AND fabricante_nome = ?`,
        [cid, nome],
      );

      if (!existing) {
        await pgRun(
          `INSERT INTO compras_fornecedores_config
             (id, company_id, fabricante_nome, codigo, razao_social, nome_fantasia, ativo,
              periodo_compra_dias, lead_time_dias, pedido_minimo_valor, observacoes, created_at, updated_at)
           VALUES (?, ?, ?, '', '', ?, 1, 30, 7, 0, '', ?, ?)`,
          [randomUUID(), cid, nome, nome, now, now],
        );
        created++;
      } else {
        // Only bump updated_at — never overwrite user-configured values
        await pgRun(
          `UPDATE compras_fornecedores_config SET updated_at = ? WHERE company_id = ? AND fabricante_nome = ?`,
          [now, cid, nome],
        );
        updated++;
      }
    }

    res.json({ created, updated, total: fabricantes.length });
  } catch (err: any) {
    console.error("[compras/fornecedores-config/sync POST]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/fornecedores-config", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const companyId = parseCompanyId(req);
    // Primary source: compras_fornecedores_config (populated by sync).
    // Augment with ERP movement data from both cache tables.
    const [configs, movimentosCampanhas, estoqueFabricantes, excecoesPorForn] = await Promise.all([
      pgAll<Record<string, unknown>>(
        companyId
          ? `SELECT * FROM compras_fornecedores_config WHERE company_id = ? ORDER BY fabricante_nome`
          : `SELECT * FROM compras_fornecedores_config ORDER BY fabricante_nome`,
        companyId ? [companyId] : [],
      ),
      pgAll<{ fabricante: string; ultimo_movimento: string; total_skus: number }>(
        `SELECT "FABRICANTE" as fabricante,
                MAX("DTMOVIMENTO") as ultimo_movimento,
                COUNT(DISTINCT "IDPRODUTO") as total_skus
         FROM cache_campanhas
         WHERE "FABRICANTE" IS NOT NULL AND "FABRICANTE" != ''${companyId ? ` AND ("IDEMPRESA" = '${companyId}' OR "IDEMPRESA" = '')` : ""}
         GROUP BY "FABRICANTE"`
      ).catch(() => [] as { fabricante: string; ultimo_movimento: string; total_skus: number }[]),
      pgAll<{ fabricante: string; total_skus: number }>(
        `SELECT "FABRICANTE" as fabricante,
                COUNT(DISTINCT "IDPRODUTO") as total_skus
         FROM cache_estoque_sugestao
         WHERE "FABRICANTE" IS NOT NULL AND "FABRICANTE" != ''
         GROUP BY "FABRICANTE"`
      ).catch(() => [] as { fabricante: string; total_skus: number }[]),
      pgAll<{ fornecedor_nome: string; total_excecoes: number }>(
        companyId
          ? `SELECT fornecedor_nome, COUNT(*) as total_excecoes FROM compras_produtos_config WHERE company_id = ? GROUP BY fornecedor_nome`
          : `SELECT fornecedor_nome, COUNT(*) as total_excecoes FROM compras_produtos_config GROUP BY fornecedor_nome`,
        companyId ? [companyId] : [],
      ).catch(() => [] as { fornecedor_nome: string; total_excecoes: number }[]),
    ]);

    // Build lookup maps
    const movMap = new Map(movimentosCampanhas.map(m => [m.fabricante, m]));
    const estoqueSkuMap = new Map(estoqueFabricantes.map(e => [e.fabricante, Number(e.total_skus)]));
    const excecoesMap = new Map(excecoesPorForn.map(e => [e.fornecedor_nome, Number(e.total_excecoes)]));

    // If compras_fornecedores_config is populated (after sync), use it as the list.
    // Otherwise fall back to building from ERP caches directly.
    if (configs.length > 0) {
      const result = configs.map(cfg => {
        const nome = cfg.fabricante_nome as string;
        const mov = movMap.get(nome);
        const skusCampanhas = mov ? Number(mov.total_skus) : 0;
        const skusEstoque = estoqueSkuMap.get(nome) ?? 0;
        return {
          id: cfg.id,
          fabricante_nome: nome,
          codigo: cfg.codigo,
          razao_social: cfg.razao_social,
          nome_fantasia: cfg.nome_fantasia ?? nome,
          ativo: Boolean(cfg.ativo),
          periodo_compra_dias: cfg.periodo_compra_dias,
          lead_time_dias: cfg.lead_time_dias,
          pedido_minimo_valor: cfg.pedido_minimo_valor,
          observacoes: cfg.observacoes,
          ultimo_movimento: mov?.ultimo_movimento ?? null,
          total_skus: Math.max(skusCampanhas, skusEstoque),
          total_excecoes: excecoesMap.get(nome) ?? 0,
          configurado: true,
        };
      });
      return res.json(result);
    }

    // Pre-sync fallback: build list from ERP caches so the page isn't blank.
    const allFabricantes = new Set([
      ...movimentosCampanhas.map(m => m.fabricante),
      ...estoqueFabricantes.map(e => e.fabricante),
    ]);
    const result = Array.from(allFabricantes).sort().map(nome => {
      const mov = movMap.get(nome);
      const skusCampanhas = mov ? Number(mov.total_skus) : 0;
      const skusEstoque = estoqueSkuMap.get(nome) ?? 0;
      return {
        id: null,
        fabricante_nome: nome,
        codigo: "",
        razao_social: "",
        nome_fantasia: nome,
        ativo: true,
        periodo_compra_dias: 30,
        lead_time_dias: 7,
        pedido_minimo_valor: 0,
        observacoes: "",
        ultimo_movimento: mov?.ultimo_movimento ?? null,
        total_skus: Math.max(skusCampanhas, skusEstoque),
        total_excecoes: excecoesMap.get(nome) ?? 0,
        configurado: false,
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
    const fabricante = decodeURIComponent(String(req.params.fabricante));
    const companyId = parseCompanyId(req);
    const {
      codigo, razao_social, nome_fantasia, ativo,
      periodo_compra_dias, lead_time_dias, pedido_minimo_valor, observacoes,
    } = req.body as Record<string, unknown>;

    const now = new Date().toISOString();
    const existing = await pgGet<{ id: string }>(
      companyId
        ? `SELECT id FROM compras_fornecedores_config WHERE fabricante_nome = ? AND company_id = ?`
        : `SELECT id FROM compras_fornecedores_config WHERE fabricante_nome = ?`,
      companyId ? [fabricante, companyId] : [fabricante],
    );

    if (existing) {
      await pgRun(
        `UPDATE compras_fornecedores_config SET
           codigo = ?, razao_social = ?, nome_fantasia = ?, ativo = ?,
           periodo_compra_dias = ?, lead_time_dias = ?, pedido_minimo_valor = ?,
           observacoes = ?, updated_at = ?
         WHERE fabricante_nome = ?${companyId ? " AND company_id = ?" : ""}`,
        [
          String(codigo ?? ""), String(razao_social ?? ""), String(nome_fantasia ?? ""),
          ativo !== false ? 1 : 0,
          Number(periodo_compra_dias ?? 30), Number(lead_time_dias ?? 7),
          Number(pedido_minimo_valor ?? 0), String(observacoes ?? ""),
          now, fabricante, ...(companyId ? [companyId] : []),
        ]
      );
    } else {
      await pgRun(
        `INSERT INTO compras_fornecedores_config
           (id, company_id, fabricante_nome, codigo, razao_social, nome_fantasia, ativo,
            periodo_compra_dias, lead_time_dias, pedido_minimo_valor, observacoes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), companyId ?? 1, fabricante,
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
    const companyId = parseCompanyId(req);

    let where = `WHERE "IDPRODUTO" IS NOT NULL AND "IDPRODUTO" != ''`;
    const params: unknown[] = [];
    if (fabricante) {
      where += ` AND "FABRICANTE" = ?`;
      params.push(fabricante);
    }
    if (companyId) {
      where += ` AND ("IDEMPRESA" = ? OR "IDEMPRESA" = '')`;
      params.push(String(companyId));
    }

    const configWhere = fabricante && companyId
      ? `WHERE fornecedor_nome = ? AND company_id = ?`
      : fabricante
        ? `WHERE fornecedor_nome = ?`
        : companyId
          ? `WHERE company_id = ?`
          : ``;
    const configParams: unknown[] = fabricante && companyId
      ? [fabricante, companyId]
      : fabricante
        ? [fabricante]
        : companyId
          ? [companyId]
          : [];

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
        `SELECT * FROM compras_produtos_config ${configWhere}`,
        configParams,
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
    const produtoId = decodeURIComponent(String(req.params.produtoId));
    const fornecedorNome = decodeURIComponent(String(req.params.fornecedor));
    const companyId = parseCompanyId(req);
    const {
      estoque_minimo, estoque_maximo, lote_minimo,
      multiplo_embalagem, giro_periodo_dias, ativo,
    } = req.body as Record<string, unknown>;

    const now = new Date().toISOString();
    const existing = await pgGet<{ id: string }>(
      companyId
        ? `SELECT id FROM compras_produtos_config WHERE produto_id = ? AND fornecedor_nome = ? AND company_id = ?`
        : `SELECT id FROM compras_produtos_config WHERE produto_id = ? AND fornecedor_nome = ?`,
      companyId ? [produtoId, fornecedorNome, companyId] : [produtoId, fornecedorNome],
    );

    if (existing) {
      await pgRun(
        `UPDATE compras_produtos_config SET
           estoque_minimo = ?, estoque_maximo = ?, lote_minimo = ?,
           multiplo_embalagem = ?, giro_periodo_dias = ?, ativo = ?, updated_at = ?
         WHERE produto_id = ? AND fornecedor_nome = ?${companyId ? " AND company_id = ?" : ""}`,
        [
          Number(estoque_minimo ?? 0), Number(estoque_maximo ?? 0), Number(lote_minimo ?? 1),
          Number(multiplo_embalagem ?? 1), Number(giro_periodo_dias ?? 90),
          ativo !== false ? 1 : 0, now,
          produtoId, fornecedorNome, ...(companyId ? [companyId] : []),
        ]
      );
    } else {
      await pgRun(
        `INSERT INTO compras_produtos_config
           (id, company_id, produto_id, fornecedor_nome, estoque_minimo, estoque_maximo,
            lote_minimo, multiplo_embalagem, giro_periodo_dias, ativo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(), companyId ?? 1, produtoId, fornecedorNome,
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
