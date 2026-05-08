/**
 * CONECTUBOS — Financeiro: Contas a Receber
 *
 * Endpoints:
 *   GET  /api/financeiro/contas-receber/resumo
 *   GET  /api/financeiro/contas-receber/clientes
 *   GET  /api/financeiro/contas-receber/cliente/:idclifor
 *   GET  /api/financeiro/contas-receber/duplicatas
 *   GET  /api/financeiro/contas-receber/vendedores
 *   GET  /api/financeiro/contas-receber/vendedor/:idvendedor
 *   GET  /api/financeiro/contas-receber/aging
 *   GET  /api/financeiro/contas-receber/fila-cobranca
 *   POST /api/financeiro/contas-receber/cobranca
 *   GET  /api/financeiro/contas-receber/cobranca/:chave_titulo
 *   GET  /api/financeiro/contas-receber/exportar
 *   POST /api/admin/sync/contas-receber
 */

import { Router, Response } from "express";
import { isAuthenticated, isAdmin, AuthRequest } from "../auth";
import { pgAll, pgGet, pgRun } from "../pg-client";

const router = Router();

const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const safe = typeof value === "string" && CSV_FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsvBuffer(rows: readonly (readonly unknown[])[]): Buffer {
  const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  return Buffer.from(csv, "utf8");
}

// ── Formas de pagamento excluídas por empresa ──────────────────────────────
// Títulos com essas formas são ocultados de todos os endpoints e filtros.

// Formas excluídas globalmente (aplicadas a todas as empresas).
// Usa prefixo para cobrir variantes como "L1 - VENDA DIRETA (registros mistos)".
const FORMAS_EXCLUIDAS_GLOBAL: string[] = [
  "DINHEIRO",
  "L1 - 2X CARTAO DE CREDITO",
  "L1 - 3X CARTAO DE CREDITO",
  "L1 - 4X CARTAO CREDITO",
  "L1 - 5X CARTAO CREDITO",
  "L1 - 6X CARTAO CREDITO",
  "L1 - ADIANTAMENTO DEPOSITO",
  "L1 - BANESE DEBITO",
  "L1 - BOLETO BB S/ENTRADA",
  "L1 - CARTAO CREDITO- INATIVO",
  "L1 - CARTAO CREDITO TEF",
  "L1 - CARTAO DEBITO LOJA",
  "L1 - CARTAO DEBITO TEF",
  "L1 - CARTAO INATIVO",
  "L1 - CARTAO LINK",
  "L1 - CARTAO POS",
  "L1 - CARTEIRA",
  "L1 - CREDITO/DEVOLUCAO",
  "L1 - CREDITO/DEVOLUÇÃO",
  "L1 - DEPOSITO / PIX CHAVE",
  "L1 - ENTREGA 28 DIAS",
  "L1 - PIX SICREDI",
  "L1 - PIX TEF",
  "L1 - REC LOCAL A VISTA",
  "L1 - REC LOCAL CARTAO",
  "L1 - REC LOCAL CHEQUE PRAZO",
  "L1 - REC VALE TROCA/DEV",
  "L1 - RECEBIMENTO CARTAO",
  "L1 - VENDA DIRETA",
  "L3 - CARTEIRA",
  "L3 - CREDITO/DEVOLUCAO",
  "L3 - DEPOSITO ENTREGA",
  "L3 - ENTREGA CARTAO CREDITO",
  "L3 - ENTREGA CARTAO DEBITO",
  "L3 - ENTREGA CHEQUE",
  "L3 - FORA EST 28 A 84",
  "L3 - REC CARTAO",
  "L3 - VENDA DIRETA",
];

// Helper: retorna a cláusula SQL de exclusão global e os params, com offset de $n.
// Títulos com forma_recebimento NULL são MANTIDOS (não excluídos).
function formasExcluidasClause(startN: number): { sql: string; params: string[] } {
  let n = startN;
  const likeClauses = FORMAS_EXCLUIDAS_GLOBAL.map(() => `UPPER(TRIM(forma_recebimento)) LIKE $${n++}`).join(" OR ");
  return {
    sql: `(forma_recebimento IS NULL OR NOT (${likeClauses}))`,
    params: FORMAS_EXCLUIDAS_GLOBAL.map(f => `${f}%`),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

class BadRequestError extends Error {
  statusCode = 400;
  errorCode = "INVALID_FILTER";
}

function sendRouteError(res: Response, label: string, err: unknown, fallbackMessage: string) {
  const statusCode = err instanceof BadRequestError ? err.statusCode : 500;
  const message = err instanceof BadRequestError ? err.message : fallbackMessage;
  if (statusCode >= 500) {
    console.error(`[financeiro] ${label}:`, err);
  }
  res.status(statusCode).json({
    success: false,
    message,
    error: message,
    error_code: err instanceof BadRequestError ? err.errorCode : "FINANCEIRO_API_ERROR",
  });
}

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return String(value ?? "").trim();
}

function isBlankFilter(value: unknown): boolean {
  const normalized = firstQueryValue(value);
  return normalized === "" || normalized === "all" || normalized === "todos" || normalized === "__all__";
}

function parsePositiveIntFilter(q: Record<string, unknown>, key: string): number | undefined {
  if (isBlankFilter(q[key])) return undefined;
  const value = firstQueryValue(q[key]);
  if (!/^\d+$/.test(value)) throw new BadRequestError(`Filtro ${key} inválido`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new BadRequestError(`Filtro ${key} inválido`);
  return parsed;
}

function parseMoneyFilter(q: Record<string, unknown>, key: string): number | undefined {
  if (isBlankFilter(q[key])) return undefined;
  const value = firstQueryValue(q[key]).replace(",", ".");
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestError(`Filtro ${key} inválido`);
  return parsed;
}

function parseDateFilter(q: Record<string, unknown>, key: string): string | undefined {
  if (isBlankFilter(q[key])) return undefined;
  const value = firstQueryValue(q[key]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestError(`Data ${key} inválida. Use YYYY-MM-DD.`);
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new BadRequestError(`Data ${key} inválida. Use YYYY-MM-DD.`);
  }
  return value;
}

function parsePagination(q: Record<string, unknown>, defaultLimit: number, maxLimit: number) {
  const page = isBlankFilter(q.page) ? 1 : parsePositiveIntFilter(q, "page")!;
  const limitRaw = isBlankFilter(q.limit) ? defaultLimit : parsePositiveIntFilter(q, "limit")!;
  const limit = Math.min(maxLimit, Math.max(10, limitRaw));
  return { page, limit, offset: (page - 1) * limit };
}

function parseStatus(q: Record<string, unknown>): string | undefined {
  if (isBlankFilter(q.status)) return undefined;
  const status = firstQueryValue(q.status).toUpperCase();
  const allowed = new Set(["VENCIDO", "VENCE_HOJE", "A_VENCER", "RECEBIDO"]);
  if (!allowed.has(status)) throw new BadRequestError("Status financeiro inválido");
  return status;
}

async function getIgnoredClientIds(): Promise<number[]> {
  try {
    const rows = await pgAll<{ idclifor: number }>(
      `SELECT idclifor FROM financeiro_clientes_ignorados`
    );
    return rows.map(r => Number(r.idclifor));
  } catch {
    return [];
  }
}

function buildWhereClause(
  q: Record<string, unknown>,
  opts: { tableAlias?: string; paramOffset?: number; ignoredIds?: number[] } = {}
): { where: string; params: unknown[] } {
  const t = opts.tableAlias ? `${opts.tableAlias}.` : "";
  const conditions: string[] = [`${t}valor_aberto > 0`];
  const params: unknown[] = [];
  let n = (opts.paramOffset ?? 0) + 1;

  const p = () => `$${n++}`;

  const status = parseStatus(q);
  if (status) {
    conditions.push(`${t}status = ${p()}`);
    params.push(status);
  }
  const empresa = parsePositiveIntFilter(q, "empresa");
  if (empresa !== undefined) {
    conditions.push(`${t}idempresa = ${p()}`);
    params.push(empresa);
  }
  const idclifor = parsePositiveIntFilter(q, "idclifor");
  if (idclifor !== undefined) {
    conditions.push(`${t}idclifor = ${p()}`);
    params.push(idclifor);
  }
  const idvendedor = parsePositiveIntFilter(q, "idvendedor");
  if (idvendedor !== undefined) {
    conditions.push(`${t}idvendedor = ${p()}`);
    params.push(idvendedor);
  }
  const vencDe = parseDateFilter(q, "venc_de");
  if (vencDe) {
    conditions.push(`${t}dtvencimento >= ${p()}`);
    params.push(vencDe);
  }
  const vencAte = parseDateFilter(q, "venc_ate");
  if (vencAte) {
    if (vencDe && vencDe > vencAte) throw new BadRequestError("Período inválido: vencimento inicial maior que final");
    conditions.push(`${t}dtvencimento <= ${p()}`);
    params.push(vencAte);
  }
  const busca = firstQueryValue(q.busca);
  if (busca) {
    const like = `%${busca}%`;
    conditions.push(
      `(LOWER(${t}nomecliente) LIKE LOWER(${p()}) OR LOWER(${t}nomevendedor) LIKE LOWER(${p()}) ` +
      `OR CAST(${t}idclifor AS TEXT) LIKE ${p()} OR CAST(${t}idtitulo AS TEXT) LIKE ${p()} ` +
      `OR LOWER(${t}cidade_cobranca) LIKE LOWER(${p()}) OR LOWER(${t}uf_cobranca) LIKE LOWER(${p()}))`
    );
    params.push(like, like, like, like, like, like);
    // p() already incremented n 6 times in the template above — no extra n+= needed
  }
  if (firstQueryValue(q.somente_vencidos) === "1") {
    conditions.push(`${t}status = 'VENCIDO'`);
  }
  if (firstQueryValue(q.somente_com_juros) === "1") {
    conditions.push(`${t}valor_juros_pendente > 0`);
  }
  const uf = firstQueryValue(q.uf).toUpperCase();
  if (uf) {
    if (!/^[A-Z]{2}$/.test(uf)) throw new BadRequestError("UF inválida");
    conditions.push(`${t}uf_cobranca = ${p()}`);
    params.push(uf);
  }
  const formaRecebimento = firstQueryValue(q.forma_recebimento);
  if (formaRecebimento) {
    conditions.push(`LOWER(${t}forma_recebimento) LIKE LOWER(${p()})`);
    params.push(`%${formaRecebimento}%`);
  }
  const idtitulo = parsePositiveIntFilter(q, "idtitulo");
  if (idtitulo !== undefined) {
    conditions.push(`${t}idtitulo = ${p()}`);
    params.push(idtitulo);
  }
  const numnota = firstQueryValue(q.numnota);
  if (numnota) {
    conditions.push(`CAST(${t}numnota AS TEXT) LIKE ${p()}`);
    params.push(`%${numnota}%`);
  }
  const valorMin = parseMoneyFilter(q, "valor_min");
  if (valorMin !== undefined) {
    conditions.push(`${t}valor_aberto >= ${p()}`);
    params.push(valorMin);
  }
  const valorMax = parseMoneyFilter(q, "valor_max");
  if (valorMax !== undefined) {
    if (valorMin !== undefined && valorMin > valorMax) throw new BadRequestError("Faixa de valor inválida");
    conditions.push(`${t}valor_aberto <= ${p()}`);
    params.push(valorMax);
  }
  if (opts.ignoredIds && opts.ignoredIds.length > 0) {
    const placeholders = opts.ignoredIds.map(() => `$${n++}`).join(", ");
    conditions.push(`${t}idclifor NOT IN (${placeholders})`);
    params.push(...opts.ignoredIds);
  }

  // Exclusão global de formas de pagamento (independente de empresa).
  // Títulos com forma_recebimento NULL são MANTIDOS (não excluídos).
  if (FORMAS_EXCLUIDAS_GLOBAL.length > 0) {
    const likeClauses = FORMAS_EXCLUIDAS_GLOBAL.map(() => `UPPER(TRIM(${t}forma_recebimento)) LIKE ${p()}`).join(" OR ");
    conditions.push(`(${t}forma_recebimento IS NULL OR NOT (${likeClauses}))`);
    params.push(...FORMAS_EXCLUIDAS_GLOBAL.map(f => `${f}%`));
  }

  return { where: conditions.join(" AND "), params };
}

// ── GET /resumo ─────────────────────────────────────────────────────────────
// Accepts the same filter params as /clientes so KPI cards stay in sync

router.get("/resumo", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, unknown>;
    const hasFilters = Object.values(q).some(v => v && v !== "" && v !== "todos" && v !== "all" && v !== "0");

    const ignoredIds = await getIgnoredClientIds();
    const { where, params } = buildWhereClause(q, { ignoredIds });

    const totais = await pgGet<{
      total_aberto: number; total_vencido: number; total_vence_hoje: number;
      total_a_vencer: number; total_juros: number;
      qtd_total: number; qtd_vencido: number; qtd_hoje: number; qtd_a_vencer: number;
      clientes_pendencia: number; clientes_vencidos: number;
      maior_atraso: number;
    }>(`
      SELECT
        COALESCE(SUM(valor_aberto), 0) AS total_aberto,
        COALESCE(SUM(CASE WHEN status = 'VENCIDO'     THEN valor_aberto ELSE 0 END), 0) AS total_vencido,
        COALESCE(SUM(CASE WHEN status = 'VENCE_HOJE'  THEN valor_aberto ELSE 0 END), 0) AS total_vence_hoje,
        COALESCE(SUM(CASE WHEN status = 'A_VENCER'    THEN valor_aberto ELSE 0 END), 0) AS total_a_vencer,
        COALESCE(SUM(valor_juros_pendente), 0) AS total_juros,
        COUNT(*) AS qtd_total,
        COUNT(CASE WHEN status = 'VENCIDO'    THEN 1 END) AS qtd_vencido,
        COUNT(CASE WHEN status = 'VENCE_HOJE' THEN 1 END) AS qtd_hoje,
        COUNT(CASE WHEN status = 'A_VENCER'   THEN 1 END) AS qtd_a_vencer,
        COUNT(DISTINCT idclifor) AS clientes_pendencia,
        COUNT(DISTINCT CASE WHEN status = 'VENCIDO' THEN idclifor END) AS clientes_vencidos,
        COALESCE(MAX(dias_atraso), 0) AS maior_atraso
      FROM cache_contas_receber
      WHERE ${where}
    `, params);

    // Maior devedor no contexto do filtro atual
    const maiorDevedor = await pgGet<{ nomecliente: string; idclifor: number; valor_vencido: number; maior_atraso: number }>(`
      SELECT nomecliente, idclifor,
        SUM(CASE WHEN status = 'VENCIDO' THEN valor_aberto ELSE 0 END) AS valor_vencido,
        MAX(dias_atraso) AS maior_atraso
      FROM cache_contas_receber
      WHERE ${where} AND status = 'VENCIDO'
      GROUP BY idclifor, nomecliente
      ORDER BY valor_vencido DESC
      LIMIT 1
    `, params);

    // Última atualização (sempre global, independente de filtro)
    // synced_at é preenchido pelo Python a cada sync; atualizado_em é o DEFAULT da criação da linha
    const ultima = await pgGet<{ atualizado_em: string }>(`
      SELECT MAX(synced_at) AS atualizado_em FROM cache_contas_receber
    `);

    res.json({
      success: true,
      total_aberto: totais?.total_aberto ?? 0,
      total_vencido: totais?.total_vencido ?? 0,
      total_vence_hoje: totais?.total_vence_hoje ?? 0,
      total_a_vencer: totais?.total_a_vencer ?? 0,
      total_juros: totais?.total_juros ?? 0,
      qtd_total: Number(totais?.qtd_total ?? 0),
      qtd_vencido: Number(totais?.qtd_vencido ?? 0),
      qtd_hoje: Number(totais?.qtd_hoje ?? 0),
      qtd_a_vencer: Number(totais?.qtd_a_vencer ?? 0),
      clientes_pendencia: Number(totais?.clientes_pendencia ?? 0),
      clientes_vencidos: Number(totais?.clientes_vencidos ?? 0),
      maior_atraso: Number(totais?.maior_atraso ?? 0),
      maior_devedor: maiorDevedor ?? null,
      ultima_atualizacao: ultima?.atualizado_em ?? null,
      filtros_ativos: hasFilters,
    });
  } catch (err) {
    sendRouteError(res, "/resumo", err, "Erro ao buscar resumo financeiro");
  }
});

// ── GET /formas-recebimento (distinct values) ────────────────────────────────

router.get("/formas-recebimento", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const empresa = req.query.empresa as string | undefined;
    const conditions: string[] = [
      "forma_recebimento IS NOT NULL",
      "TRIM(forma_recebimento) <> ''",
    ];
    const params: unknown[] = [];
    let n = 1;

    if (empresa && empresa !== "all") {
      conditions.push(`idempresa = $${n++}`);
      params.push(Number(empresa));
    }

    // Exclusão global de formas de pagamento (independente de empresa)
    if (FORMAS_EXCLUIDAS_GLOBAL.length > 0) {
      const likeClauses = FORMAS_EXCLUIDAS_GLOBAL.map(() => `UPPER(TRIM(forma_recebimento)) LIKE $${n++}`).join(" OR ");
      conditions.push(`NOT (${likeClauses})`);
      params.push(...FORMAS_EXCLUIDAS_GLOBAL.map(f => `${f}%`));
    }

    const sql = `SELECT DISTINCT UPPER(TRIM(forma_recebimento)) AS forma
                 FROM cache_contas_receber
                 WHERE ${conditions.join(" AND ")}
                 ORDER BY 1`;
    const rows = await pgAll<{ forma: string }>(sql, params.length ? params : undefined);
    const formas = rows.map(r => r.forma).filter(Boolean);
    res.json({ formas });
  } catch (err) {
    sendRouteError(res, "/formas-recebimento", err, "Erro ao buscar formas de recebimento");
  }
});

// ── GET /clientes ───────────────────────────────────────────────────────────

router.get("/clientes", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, unknown>;
    const { page, limit, offset } = parsePagination(q, 50, 200);
    const sort = (q.sort ?? "total_vencido") as string;
    const dir = q.dir === "asc" ? "ASC" : "DESC";

    const ignoredIds = await getIgnoredClientIds();
    const { where, params } = buildWhereClause(q, { ignoredIds });

    const SAFE_SORTS: Record<string, string> = {
      nomecliente: "nomecliente",
      total_aberto: "total_aberto",
      total_vencido: "total_vencido",
      maior_atraso: "maior_atraso",
      juros: "juros_pendente",
      qtd_titulos: "qtd_titulos",
    };
    const orderBy = SAFE_SORTS[sort] ?? "total_vencido";

    const totalRows = await pgGet<{ cnt: number }>(
      `SELECT COUNT(DISTINCT idclifor) AS cnt FROM cache_contas_receber WHERE ${where}`,
      params
    );

    const rows = await pgAll<{
      idclifor: number; nomecliente: string; idvendedor: number; nomevendedor: string;
      cidade_cobranca: string; uf_cobranca: string;
      qtd_titulos: number; total_aberto: number; total_vencido: number;
      juros_pendente: number; maior_atraso: number; proximo_vencimento: string;
      ultimo_vencimento: string; status_cliente: string;
    }>(
      `SELECT
        idclifor, nomecliente, idvendedor, nomevendedor,
        cidade_cobranca, uf_cobranca,
        COUNT(*) AS qtd_titulos,
        SUM(valor_aberto) AS total_aberto,
        SUM(CASE WHEN status = 'VENCIDO' THEN valor_aberto ELSE 0 END) AS total_vencido,
        SUM(valor_juros_pendente) AS juros_pendente,
        MAX(dias_atraso) AS maior_atraso,
        MIN(CASE WHEN status IN ('A_VENCER','VENCE_HOJE') THEN dtvencimento END) AS proximo_vencimento,
        MAX(dtvencimento) AS ultimo_vencimento,
        CASE
          WHEN MAX(dias_atraso) > 30 THEN 'CRITICO'
          WHEN MAX(dias_atraso) BETWEEN 8 AND 30 THEN 'ATRASADO'
          WHEN MAX(dias_atraso) BETWEEN 1 AND 7 OR COUNT(CASE WHEN status='VENCE_HOJE' THEN 1 END) > 0 THEN 'ATENCAO'
          ELSE 'EM_DIA'
        END AS status_cliente
      FROM cache_contas_receber
      WHERE ${where}
      GROUP BY idclifor, nomecliente, idvendedor, nomevendedor, cidade_cobranca, uf_cobranca
      ORDER BY ${orderBy} ${dir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      total: Number(totalRows?.cnt ?? 0),
      page,
      limit,
      pages: Math.ceil(Number(totalRows?.cnt ?? 0) / limit),
      meta: { total: Number(totalRows?.cnt ?? 0), page, limit, pages: Math.ceil(Number(totalRows?.cnt ?? 0) / limit) },
    });
  } catch (err) {
    sendRouteError(res, "/clientes", err, "Erro ao buscar clientes");
  }
});

// ── GET /cliente/:idclifor ──────────────────────────────────────────────────

router.get("/cliente/:idclifor", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const idclifor = Number(req.params.idclifor);
    if (!Number.isSafeInteger(idclifor) || idclifor <= 0) return res.status(400).json({ success: false, error: "idclifor inválido", message: "idclifor inválido" });

    // $1 = idclifor; $2...$N = params de exclusão de formas de pagamento
    const formasEx = formasExcluidasClause(2);
    const baseParams = [idclifor, ...formasEx.params];

    const [info, duplicatas, cobrancas] = await Promise.all([
      pgGet(`
        SELECT
          idclifor, nomecliente, idvendedor, nomevendedor,
          cidade_cobranca, uf_cobranca, endereco_cobranca, bairro_cobranca,
          COUNT(*) AS qtd_titulos,
          SUM(valor_aberto) AS total_aberto,
          SUM(CASE WHEN status='VENCIDO' THEN valor_aberto ELSE 0 END) AS total_vencido,
          SUM(valor_juros_pendente) AS juros_pendente,
          MAX(dias_atraso) AS maior_atraso,
          MIN(CASE WHEN status IN ('A_VENCER','VENCE_HOJE') THEN dtvencimento END) AS proximo_vencimento,
          MAX(dtultimopagamento) AS ultimo_pagamento
        FROM cache_contas_receber
        WHERE idclifor = $1 AND valor_aberto > 0 AND ${formasEx.sql}
        GROUP BY idclifor, nomecliente, idvendedor, nomevendedor,
                 cidade_cobranca, uf_cobranca, endereco_cobranca, bairro_cobranca
      `, baseParams),

      pgAll(`
        SELECT * FROM cache_contas_receber
        WHERE idclifor = $1 AND valor_aberto > 0 AND ${formasEx.sql}
        ORDER BY dtvencimento ASC, idtitulo ASC
      `, baseParams),

      pgAll(`
        SELECT fc.*, fch.acao, fch.criado_em AS hist_em, fch.usuario AS hist_usuario
        FROM financeiro_cobrancas fc
        LEFT JOIN financeiro_cobrancas_historico fch ON fch.id_cobranca = fc.id
        WHERE fc.idclifor = $1
        ORDER BY fc.atualizado_em DESC
      `, [idclifor]),
    ]);

    if (!info) return res.json({ data: null, duplicatas: [], cobrancas: [] });

    res.json({ data: info, duplicatas, cobrancas });
  } catch (err) {
    sendRouteError(res, "/cliente", err, "Erro ao buscar cliente");
  }
});

// ── GET /duplicatas ─────────────────────────────────────────────────────────

router.get("/duplicatas", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, unknown>;
    const { page, limit, offset } = parsePagination(q, 100, 500);
    const sort = (q.sort ?? "dtvencimento") as string;
    const dir = q.dir === "desc" ? "DESC" : "ASC";

    const SAFE_SORTS: Record<string, string> = {
      dtvencimento: "dtvencimento",
      dias_atraso: "dias_atraso",
      valor_aberto: "valor_aberto",
      nomecliente: "nomecliente",
      nomevendedor: "nomevendedor",
      status: "status",
    };
    const orderBy = SAFE_SORTS[sort] ?? "dtvencimento";

    const ignoredIds = await getIgnoredClientIds();
    const { where, params } = buildWhereClause(q, { ignoredIds });

    const totalRows = await pgGet<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM cache_contas_receber WHERE ${where}`, params
    );

    const rows = await pgAll(
      `SELECT * FROM cache_contas_receber WHERE ${where}
       ORDER BY ${orderBy} ${dir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      total: Number(totalRows?.cnt ?? 0),
      page,
      limit,
      pages: Math.ceil(Number(totalRows?.cnt ?? 0) / limit),
      meta: { total: Number(totalRows?.cnt ?? 0), page, limit, pages: Math.ceil(Number(totalRows?.cnt ?? 0) / limit) },
    });
  } catch (err) {
    sendRouteError(res, "/duplicatas", err, "Erro ao buscar duplicatas");
  }
});

// ── GET /duplicatas/all — sem paginação, usado pela impressão ───────────────

router.get("/duplicatas/all", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, unknown>;
    const sort = (q.sort ?? "nomecliente") as string;
    const dir = q.dir === "desc" ? "DESC" : "ASC";

    const SAFE_SORTS: Record<string, string> = {
      dtvencimento: "dtvencimento",
      dias_atraso: "dias_atraso",
      valor_aberto: "valor_aberto",
      nomecliente: "nomecliente",
      nomevendedor: "nomevendedor",
      idclifor: "idclifor",
      status: "status",
    };
    const orderBy = SAFE_SORTS[sort] ?? "nomecliente";

    const ignoredIds = await getIgnoredClientIds();
    const { where, params } = buildWhereClause(q, { ignoredIds });

    const totalRows = await pgGet<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM cache_contas_receber WHERE ${where}`, params
    );

    const rows = await pgAll(
      `SELECT * FROM cache_contas_receber WHERE ${where}
       ORDER BY ${orderBy} ${dir}, idclifor ASC, dtvencimento ASC`,
      params
    );

    res.json({
      success: true,
      data: rows,
      total: Number(totalRows?.cnt ?? 0),
      meta: { total: Number(totalRows?.cnt ?? 0) },
    });
  } catch (err) {
    sendRouteError(res, "/duplicatas/all", err, "Erro ao buscar duplicatas para impressão");
  }
});

// ── GET /vendedores ─────────────────────────────────────────────────────────
// Accepts the same filter params to stay consistent with cards and other tabs

router.get("/vendedores", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, unknown>;
    const ignoredIds = await getIgnoredClientIds();
    const { where, params } = buildWhereClause(q, { ignoredIds });

    const rows = await pgAll(`
      SELECT
        idvendedor, nomevendedor,
        COUNT(DISTINCT idclifor) AS clientes_pendencia,
        COUNT(DISTINCT CASE WHEN status='VENCIDO' THEN idclifor END) AS clientes_vencidos,
        COUNT(*) AS qtd_titulos,
        COUNT(CASE WHEN status='VENCIDO' THEN 1 END) AS qtd_titulos_vencidos,
        SUM(valor_aberto) AS total_aberto,
        SUM(CASE WHEN status='VENCIDO' THEN valor_aberto ELSE 0 END) AS total_vencido,
        SUM(valor_juros_pendente) AS juros_pendente,
        MAX(dias_atraso) AS maior_atraso,
        CASE
          WHEN MAX(dias_atraso) > 30
               OR SUM(CASE WHEN status='VENCIDO' THEN valor_aberto ELSE 0 END) >
                  SUM(valor_aberto) * 0.5 THEN 'CRITICO'
          WHEN MAX(dias_atraso) BETWEEN 8 AND 30 THEN 'ATRASADO'
          WHEN MAX(dias_atraso) BETWEEN 1 AND 7 THEN 'ATENCAO'
          ELSE 'EM_DIA'
        END AS status_risco
      FROM cache_contas_receber
      WHERE ${where}
      GROUP BY idvendedor, nomevendedor
      ORDER BY total_vencido DESC
    `, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    sendRouteError(res, "/vendedores", err, "Erro ao buscar vendedores");
  }
});

// ── GET /vendedor/:idvendedor ───────────────────────────────────────────────

router.get("/vendedor/:idvendedor", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const idvendedor = Number(req.params.idvendedor);
    if (!Number.isSafeInteger(idvendedor) || idvendedor <= 0) return res.status(400).json({ success: false, error: "idvendedor inválido", message: "idvendedor inválido" });

    const empresaParam = req.query.empresa as string | undefined;
    const empresaFilter = empresaParam && empresaParam !== "all" ? Number(empresaParam) : null;

    // Build params: $1=idvendedor, [$2=idempresa if filtered], then exclusions
    let paramN = 2;
    const empresaSql = empresaFilter !== null ? ` AND idempresa = $${paramN++}` : "";
    const excl = formasExcluidasClause(paramN);
    const baseParams: unknown[] = [idvendedor, ...(empresaFilter !== null ? [empresaFilter] : []), ...excl.params];

    const [resumo, clientes, topTitulos] = await Promise.all([
      pgGet(`
        SELECT
          idvendedor, nomevendedor,
          COUNT(DISTINCT idclifor) AS clientes_pendencia,
          COUNT(DISTINCT CASE WHEN status='VENCIDO' THEN idclifor END) AS clientes_vencidos,
          COUNT(*) AS qtd_titulos,
          COUNT(CASE WHEN status='VENCIDO' THEN 1 END) AS qtd_titulos_vencidos,
          SUM(valor_aberto) AS total_aberto,
          SUM(CASE WHEN status='VENCIDO' THEN valor_aberto ELSE 0 END) AS total_vencido,
          SUM(CASE WHEN status='VENCE_HOJE' THEN valor_aberto ELSE 0 END) AS vence_hoje,
          SUM(CASE WHEN status='A_VENCER' THEN valor_aberto ELSE 0 END) AS a_vencer,
          SUM(valor_juros_pendente) AS juros_pendente,
          MAX(dias_atraso) AS maior_atraso
        FROM cache_contas_receber
        WHERE idvendedor = $1${empresaSql} AND valor_aberto > 0 AND ${excl.sql}
        GROUP BY idvendedor, nomevendedor
      `, baseParams),

      pgAll(`
        SELECT
          idclifor, nomecliente, cidade_cobranca, uf_cobranca,
          COUNT(*) AS qtd_titulos,
          SUM(valor_aberto) AS total_aberto,
          SUM(CASE WHEN status='VENCIDO' THEN valor_aberto ELSE 0 END) AS total_vencido,
          MAX(dias_atraso) AS maior_atraso,
          CASE WHEN MAX(dias_atraso) > 30 THEN 'CRITICO'
               WHEN MAX(dias_atraso) BETWEEN 8 AND 30 THEN 'ATRASADO'
               WHEN MAX(dias_atraso) BETWEEN 1 AND 7 THEN 'ATENCAO'
               ELSE 'EM_DIA' END AS status_cliente
        FROM cache_contas_receber
        WHERE idvendedor = $1${empresaSql} AND valor_aberto > 0 AND ${excl.sql}
        GROUP BY idclifor, nomecliente, cidade_cobranca, uf_cobranca
        HAVING SUM(CASE WHEN status='VENCIDO' THEN valor_aberto ELSE 0 END) >= 0.01
        ORDER BY total_vencido DESC
        LIMIT 50
      `, baseParams),

      pgAll(`
        SELECT idtitulo, digitotitulo, numnota, nomecliente, idclifor,
               dtvencimento, dias_atraso, valor_aberto, status, forma_recebimento
        FROM cache_contas_receber
        WHERE idvendedor = $1${empresaSql} AND status = 'VENCIDO' AND ${excl.sql}
        ORDER BY nomecliente ASC, numnota ASC, dias_atraso DESC
      `, baseParams),
    ]);

    res.json({ resumo: resumo ?? null, clientes, top_titulos: topTitulos });
  } catch (err) {
    sendRouteError(res, "/vendedor", err, "Erro ao buscar vendedor");
  }
});

// ── GET /aging ──────────────────────────────────────────────────────────────

router.get("/aging", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const exclAging = formasExcluidasClause(1);
    const rows = await pgAll<{
      faixa: string; qtd_titulos: number; qtd_clientes: number;
      valor_total: number; ordem: number;
    }>(`
      SELECT
        CASE
          WHEN status = 'A_VENCER'                       THEN 'A vencer'
          WHEN status = 'VENCE_HOJE'                     THEN 'Vence hoje'
          WHEN dias_atraso BETWEEN 1  AND 7              THEN '1 a 7 dias'
          WHEN dias_atraso BETWEEN 8  AND 15             THEN '8 a 15 dias'
          WHEN dias_atraso BETWEEN 16 AND 30             THEN '16 a 30 dias'
          WHEN dias_atraso BETWEEN 31 AND 60             THEN '31 a 60 dias'
          WHEN dias_atraso BETWEEN 61 AND 90             THEN '61 a 90 dias'
          ELSE                                                'Acima de 90 dias'
        END AS faixa,
        CASE
          WHEN status = 'A_VENCER'                       THEN 0
          WHEN status = 'VENCE_HOJE'                     THEN 1
          WHEN dias_atraso BETWEEN 1  AND 7              THEN 2
          WHEN dias_atraso BETWEEN 8  AND 15             THEN 3
          WHEN dias_atraso BETWEEN 16 AND 30             THEN 4
          WHEN dias_atraso BETWEEN 31 AND 60             THEN 5
          WHEN dias_atraso BETWEEN 61 AND 90             THEN 6
          ELSE                                                7
        END AS ordem,
        COUNT(*) AS qtd_titulos,
        COUNT(DISTINCT idclifor) AS qtd_clientes,
        SUM(valor_aberto) AS valor_total
      FROM cache_contas_receber
      WHERE valor_aberto > 0 AND ${exclAging.sql}
      GROUP BY faixa, ordem
      ORDER BY ordem
    `, exclAging.params);

    const totalVencido = rows
      .filter(r => r.ordem >= 2)
      .reduce((s, r) => s + Number(r.valor_total), 0);

    const data = rows.map(r => ({
      ...r,
      qtd_titulos: Number(r.qtd_titulos),
      qtd_clientes: Number(r.qtd_clientes),
      valor_total: Number(r.valor_total),
      percentual: totalVencido > 0 && r.ordem >= 2
        ? (Number(r.valor_total) / totalVencido) * 100
        : 0,
    }));

    res.json({ success: true, data, total_vencido: totalVencido });
  } catch (err) {
    sendRouteError(res, "/aging", err, "Erro ao calcular aging");
  }
});

// ── GET /fila-cobranca ──────────────────────────────────────────────────────
// Accepts filter params (idvendedor, empresa, venc_de, venc_ate, idclifor)

router.get("/fila-cobranca", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, unknown>;
    const hoje = new Date().toISOString().split("T")[0];

    const ignoredIds = await getIgnoredClientIds();
    // $1 = hoje (used in the ORDER BY promise check)
    // User filters start at $2, so paramOffset=1 shifts placeholders accordingly
    const filaQ = { ...q, status: undefined, somente_vencidos: undefined };
    const { where: filaWhere, params: filaParams } = buildWhereClause(filaQ, {
      tableAlias: "cr",
      paramOffset: 1,
      ignoredIds,
    });

    // Append VENCIDO/VENCE_HOJE restriction (fila always shows only critical items)
    const fullWhere = `${filaWhere} AND cr.status IN ('VENCIDO','VENCE_HOJE')`;
    const allParams = [hoje, ...filaParams];

    const rows = await pgAll(`
      SELECT
        cr.idclifor, cr.nomecliente, cr.idvendedor, cr.nomevendedor,
        cr.cidade_cobranca, cr.uf_cobranca,
        SUM(cr.valor_aberto) AS total_aberto,
        SUM(CASE WHEN cr.status='VENCIDO' THEN cr.valor_aberto ELSE 0 END) AS total_vencido,
        SUM(cr.valor_juros_pendente) AS juros_pendente,
        MAX(cr.dias_atraso) AS maior_atraso,
        COUNT(CASE WHEN cr.status='VENCIDO' THEN 1 END) AS qtd_vencidos,
        MIN(CASE WHEN cr.status='VENCIDO' THEN cr.dtvencimento END) AS titulo_mais_antigo,
        fc.status_interno,
        fc.data_cobranca AS ultima_cobranca,
        fc.proxima_acao,
        fc.data_proxima_acao,
        fc.promessa_pagamento,
        fc.data_promessa_pagamento,
        CASE
          WHEN fc.data_promessa_pagamento IS NOT NULL
               AND fc.data_promessa_pagamento < $1
               AND fc.promessa_pagamento = 'S' THEN 'ALTA'
          WHEN MAX(cr.dias_atraso) > 30
               OR SUM(CASE WHEN cr.status='VENCIDO' THEN cr.valor_aberto ELSE 0 END) > 5000 THEN 'ALTA'
          WHEN MAX(cr.dias_atraso) BETWEEN 8 AND 30 THEN 'MEDIA'
          ELSE 'BAIXA'
        END AS prioridade
      FROM cache_contas_receber cr
      LEFT JOIN LATERAL (
        SELECT * FROM financeiro_cobrancas
        WHERE idclifor = cr.idclifor
        ORDER BY atualizado_em DESC
        LIMIT 1
      ) fc ON TRUE
      WHERE ${fullWhere}
      GROUP BY cr.idclifor, cr.nomecliente, cr.idvendedor, cr.nomevendedor,
               cr.cidade_cobranca, cr.uf_cobranca,
               fc.status_interno, fc.data_cobranca, fc.proxima_acao,
               fc.data_proxima_acao, fc.promessa_pagamento, fc.data_promessa_pagamento
      ORDER BY
        CASE WHEN fc.data_promessa_pagamento IS NOT NULL AND fc.data_promessa_pagamento < $1 AND fc.promessa_pagamento = 'S' THEN 0 ELSE 1 END,
        SUM(CASE WHEN cr.status='VENCIDO' THEN cr.valor_aberto ELSE 0 END) DESC,
        MAX(cr.dias_atraso) DESC
      LIMIT 200
    `, allParams);

    res.json({ data: rows.map(r => ({
      ...r,
      total_aberto: Number(r.total_aberto),
      total_vencido: Number(r.total_vencido),
      juros_pendente: Number(r.juros_pendente),
      maior_atraso: Number(r.maior_atraso),
      qtd_vencidos: Number(r.qtd_vencidos),
    })) });
  } catch (err) {
    sendRouteError(res, "/fila-cobranca", err, "Erro ao buscar fila de cobrança");
  }
});

// ── POST /cobranca ──────────────────────────────────────────────────────────

router.post("/cobranca", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const {
      chave_titulo, idempresa, idclifor, idtitulo, digitotitulo, serienota,
      status_interno, observacao, motivo_atraso, canal_contato,
      proxima_acao, data_proxima_acao,
      promessa_pagamento, data_promessa_pagamento,
    } = req.body;

    if (!idclifor) return res.status(400).json({ error: "idclifor obrigatório" });

    const agora = new Date().toISOString();
    const usuario = req.userEmail ?? req.userId?.toString() ?? "sistema";

    const existing = chave_titulo
      ? await pgGet<{ id: number }>(`SELECT id FROM financeiro_cobrancas WHERE chave_titulo = $1`, [chave_titulo])
      : null;

    if (existing) {
      // Update existing
      await pgRun(`
        UPDATE financeiro_cobrancas SET
          status_interno = $1, observacao = $2, motivo_atraso = $3,
          canal_contato = $4, responsavel = $5, data_cobranca = $6,
          proxima_acao = $7, data_proxima_acao = $8,
          promessa_pagamento = $9, data_promessa_pagamento = $10,
          atualizado_em = $11, usuario = $12
        WHERE id = $13
      `, [
        status_interno, observacao, motivo_atraso, canal_contato, usuario, agora.split("T")[0],
        proxima_acao, data_proxima_acao, promessa_pagamento ?? "N", data_promessa_pagamento,
        agora, usuario, existing.id,
      ]);

      await pgRun(`
        INSERT INTO financeiro_cobrancas_historico
          (id_cobranca, chave_titulo, idempresa, idclifor, idtitulo, digitotitulo, serienota,
           acao, valor_novo, usuario, criado_em)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        existing.id, chave_titulo, idempresa, idclifor, idtitulo, digitotitulo, serienota,
        `Status: ${status_interno}`, JSON.stringify({ status_interno, observacao }), usuario, agora,
      ]);

      return res.json({ success: true, id: existing.id });
    }

    // Insert new
    const novo = await pgGet<{ id: number }>(`
      INSERT INTO financeiro_cobrancas
        (chave_titulo, idempresa, idclifor, idtitulo, digitotitulo, serienota,
         status_interno, observacao, motivo_atraso, canal_contato, responsavel,
         data_cobranca, proxima_acao, data_proxima_acao,
         promessa_pagamento, data_promessa_pagamento, criado_em, atualizado_em, usuario)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,$18)
      RETURNING id
    `, [
      chave_titulo, idempresa, idclifor, idtitulo, digitotitulo, serienota,
      status_interno ?? "COBRADO", observacao, motivo_atraso, canal_contato, usuario,
      agora.split("T")[0], proxima_acao, data_proxima_acao,
      promessa_pagamento ?? "N", data_promessa_pagamento, agora, usuario,
    ]);

    if (novo?.id) {
      await pgRun(`
        INSERT INTO financeiro_cobrancas_historico
          (id_cobranca, chave_titulo, idempresa, idclifor, idtitulo, digitotitulo, serienota,
           acao, valor_novo, usuario, criado_em)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        novo.id, chave_titulo, idempresa, idclifor, idtitulo, digitotitulo, serienota,
        `Nova cobrança: ${status_interno}`, JSON.stringify({ status_interno, observacao }), usuario, agora,
      ]);
    }

    res.json({ success: true, id: novo?.id });
  } catch (err) {
    console.error("[financeiro] POST /cobranca:", err);
    res.status(500).json({ error: "Erro ao registrar cobrança" });
  }
});

// ── GET /cobranca/:chave_titulo ─────────────────────────────────────────────

router.get("/cobranca/:chave_titulo", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const chave = req.params.chave_titulo;
    const [cobranca, historico] = await Promise.all([
      pgGet(`SELECT * FROM financeiro_cobrancas WHERE chave_titulo = $1 ORDER BY atualizado_em DESC LIMIT 1`, [chave]),
      pgAll(`SELECT * FROM financeiro_cobrancas_historico WHERE chave_titulo = $1 ORDER BY criado_em DESC`, [chave]),
    ]);
    res.json({ cobranca: cobranca ?? null, historico });
  } catch (err) {
    console.error("[financeiro] /cobranca/:chave:", err);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

// ── GET /exportar ───────────────────────────────────────────────────────────

router.get("/exportar", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, unknown>;
    const ignoredIds = await getIgnoredClientIds();
    const { where, params } = buildWhereClause(q, { ignoredIds });

    const rows = await pgAll(
      `SELECT
        nomevendedor, nomecliente, idclifor,
        cidade_cobranca, uf_cobranca,
        idtitulo, digitotitulo, serienota, numnota, idplanilha,
        dtmovimento, dtvencimento, dtultimopagamento, dias_atraso, status,
        valor_original, valor_pago, valor_aberto, valor_juros_pendente,
        valor_desconto_concedido, valor_liquido,
        forma_recebimento, origem_movimento, observacao_titulo
       FROM cache_contas_receber WHERE ${where}
       ORDER BY nomevendedor, nomecliente, dtvencimento`,
      params
    );

    const fmtDate = (d: string | null) => {
      if (!d) return "";
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString("pt-BR");
    };
    const fmtNum = (v: number | null) =>
      v == null ? 0 : Number(v);

    const csvRows = [
      [
        "Vendedor", "Cliente", "Cód.Cliente", "Cidade", "UF",
        "Título", "Dígito", "Série", "Nota/Cupom", "Planilha",
        "Movimento", "Vencimento", "Últ.Pagamento", "Dias Atraso", "Status",
        "Valor Original (R$)", "Valor Pago (R$)", "Valor Aberto (R$)", "Juros Pendente (R$)",
        "Desconto Concedido (R$)", "Valor Líquido (R$)",
        "Forma Recebimento", "Origem", "Observação",
      ],
      ...rows.map(r => [
        r.nomevendedor ?? "", r.nomecliente ?? "", r.idclifor ?? "",
        r.cidade_cobranca ?? "", r.uf_cobranca ?? "",
        r.idtitulo ?? "", r.digitotitulo ?? "", r.serienota ?? "", r.numnota ?? "", r.idplanilha ?? "",
        fmtDate(r.dtmovimento), fmtDate(r.dtvencimento), fmtDate(r.dtultimopagamento),
        r.dias_atraso ?? 0, r.status ?? "",
        fmtNum(r.valor_original), fmtNum(r.valor_pago),
        fmtNum(r.valor_aberto), fmtNum(r.valor_juros_pendente),
        fmtNum(r.valor_desconto_concedido), fmtNum(r.valor_liquido),
        r.forma_recebimento ?? "", r.origem_movimento ?? "", r.observacao_titulo ?? "",
      ]),
    ];

    const buf = toCsvBuffer(csvRows);

    const filename = `contas-receber-${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    sendRouteError(res, "/exportar", err, "Erro ao exportar");
  }
});

// ── GET /clientes-ignorados ──────────────────────────────────────────────────

router.get("/clientes-ignorados", isAuthenticated, async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await pgAll(`
      SELECT id, idclifor, nomecliente, motivo, criado_em, criado_por
      FROM financeiro_clientes_ignorados
      ORDER BY nomecliente ASC, idclifor ASC
    `);
    res.json({ data: rows });
  } catch (err) {
    console.error("[financeiro] /clientes-ignorados GET:", err);
    res.status(500).json({ error: "Erro ao buscar clientes ignorados" });
  }
});

// ── POST /clientes-ignorados — suporta batch (vírgula-separado) ──────────────

router.post("/clientes-ignorados", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { idclifor_raw, motivo } = req.body as { idclifor_raw: string; motivo?: string };
    const usuario = req.userEmail ?? req.userId?.toString() ?? "sistema";

    if (!idclifor_raw) return res.status(400).json({ error: "idclifor_raw obrigatório" });

    const ids = String(idclifor_raw)
      .split(",")
      .map(s => Number(s.trim()))
      .filter(n => n > 0 && !isNaN(n));

    if (ids.length === 0) return res.status(400).json({ error: "Nenhum código válido informado" });

    const agora = new Date().toISOString();
    let inseridos = 0;

    for (const id of ids) {
      const existing = await pgGet<{ idclifor: number }>(
        `SELECT idclifor FROM cache_contas_receber WHERE idclifor = $1 LIMIT 1`, [id]
      );
      const nomecliente = existing ? (await pgGet<{ nomecliente: string }>(
        `SELECT nomecliente FROM cache_contas_receber WHERE idclifor = $1 LIMIT 1`, [id]
      ))?.nomecliente ?? null : null;

      await pgRun(`
        INSERT INTO financeiro_clientes_ignorados (idclifor, nomecliente, motivo, criado_em, criado_por)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (idclifor) DO UPDATE SET motivo = EXCLUDED.motivo, criado_por = EXCLUDED.criado_por, criado_em = EXCLUDED.criado_em
      `, [id, nomecliente, motivo ?? null, agora, usuario]);
      inseridos++;
    }

    res.json({ success: true, inseridos });
  } catch (err) {
    console.error("[financeiro] /clientes-ignorados POST:", err);
    res.status(500).json({ error: "Erro ao adicionar clientes ignorados" });
  }
});

// ── DELETE /clientes-ignorados/:id ──────────────────────────────────────────

router.delete("/clientes-ignorados/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "id inválido" });
    await pgRun(`DELETE FROM financeiro_clientes_ignorados WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("[financeiro] /clientes-ignorados DELETE:", err);
    res.status(500).json({ error: "Erro ao remover cliente ignorado" });
  }
});

// ── POST /admin/sync/contas-receber ─────────────────────────────────────────

router.post("/admin/sync", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    // This endpoint triggers the ERP sync via Python script or marks last sync
    // In production this would connect to DB2 via erp_sync.py
    // For now, returns status of current cache
    const stats = await pgGet<{
      registros: number; clientes: number;
      valor_aberto: number; valor_vencido: number; ultima: string;
    }>(`
      SELECT
        COUNT(*) AS registros,
        COUNT(DISTINCT idclifor) AS clientes,
        SUM(valor_aberto) AS valor_aberto,
        SUM(CASE WHEN status='VENCIDO' THEN valor_aberto ELSE 0 END) AS valor_vencido,
        MAX(atualizado_em) AS ultima
      FROM cache_contas_receber
      WHERE valor_aberto > 0
    `);

    res.json({
      success: true,
      message: "Sincronização via ERP/DB2 deve ser executada via script erp_sync.py. Cache atual consultado.",
      registros_importados: Number(stats?.registros ?? 0),
      clientes: Number(stats?.clientes ?? 0),
      valor_total_aberto: Number(stats?.valor_aberto ?? 0),
      valor_total_vencido: Number(stats?.valor_vencido ?? 0),
      ultima_atualizacao: stats?.ultima ?? null,
    });
  } catch (err) {
    console.error("[financeiro] /admin/sync:", err);
    res.status(500).json({ error: "Erro ao verificar status da sincronização" });
  }
});

export default router;
