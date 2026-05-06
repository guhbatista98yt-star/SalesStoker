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
import XLSX from "xlsx";

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

function buildWhereClause(q: Record<string, string | undefined>): { where: string; params: unknown[] } {
  const conditions: string[] = ["valor_aberto > 0"];
  const params: unknown[] = [];
  let n = 1;

  const p = () => `$${n++}`;

  if (q.status && q.status !== "todos") {
    conditions.push(`status = ${p()}`);
    params.push(q.status.toUpperCase());
  }
  if (q.empresa && q.empresa !== "all") {
    conditions.push(`idempresa = ${p()}`);
    params.push(Number(q.empresa));
  }
  if (q.idclifor) {
    conditions.push(`idclifor = ${p()}`);
    params.push(Number(q.idclifor));
  }
  if (q.idvendedor) {
    conditions.push(`idvendedor = ${p()}`);
    params.push(Number(q.idvendedor));
  }
  if (q.venc_de) {
    conditions.push(`dtvencimento >= ${p()}`);
    params.push(q.venc_de);
  }
  if (q.venc_ate) {
    conditions.push(`dtvencimento <= ${p()}`);
    params.push(q.venc_ate);
  }
  if (q.busca) {
    const like = `%${q.busca}%`;
    conditions.push(`(LOWER(nomecliente) LIKE LOWER(${p()}) OR LOWER(nomevendedor) LIKE LOWER(${p()}) OR CAST(idclifor AS TEXT) LIKE ${p()} OR CAST(idtitulo AS TEXT) LIKE ${p()} OR LOWER(cidade_cobranca) LIKE LOWER(${p()}) OR LOWER(uf_cobranca) LIKE LOWER(${p()}))`);
    params.push(like, like, like, like, like, like);
    n += 5;
  }
  if (q.somente_vencidos === "1") {
    conditions.push(`status = 'VENCIDO'`);
  }
  if (q.somente_com_juros === "1") {
    conditions.push(`valor_juros_pendente > 0`);
  }
  if (q.uf) {
    conditions.push(`uf_cobranca = ${p()}`);
    params.push(q.uf.toUpperCase());
  }
  if (q.forma_recebimento) {
    conditions.push(`LOWER(forma_recebimento) LIKE LOWER(${p()})`);
    params.push(`%${q.forma_recebimento}%`);
  }
  if (q.idtitulo) {
    conditions.push(`idtitulo = ${p()}`);
    params.push(Number(q.idtitulo));
  }
  if (q.numnota) {
    conditions.push(`CAST(numnota AS TEXT) LIKE ${p()}`);
    params.push(`%${q.numnota}%`);
  }
  if (q.valor_min) {
    conditions.push(`valor_aberto >= ${p()}`);
    params.push(Number(q.valor_min));
  }
  if (q.valor_max) {
    conditions.push(`valor_aberto <= ${p()}`);
    params.push(Number(q.valor_max));
  }

  return { where: conditions.join(" AND "), params };
}

// ── GET /resumo ─────────────────────────────────────────────────────────────

router.get("/resumo", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const hoje = new Date().toISOString().split("T")[0];

    const [totais] = await Promise.all([
      pgGet<{
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
        WHERE valor_aberto > 0
      `),
    ]);

    // Maior devedor (cliente com maior valor vencido)
    const maiorDevedor = await pgGet<{ nomecliente: string; idclifor: number; valor_vencido: number; maior_atraso: number }>(`
      SELECT nomecliente, idclifor,
        SUM(CASE WHEN status = 'VENCIDO' THEN valor_aberto ELSE 0 END) AS valor_vencido,
        MAX(dias_atraso) AS maior_atraso
      FROM cache_contas_receber
      WHERE status = 'VENCIDO'
      GROUP BY idclifor, nomecliente
      ORDER BY valor_vencido DESC
      LIMIT 1
    `);

    // Última atualização
    const ultima = await pgGet<{ atualizado_em: string }>(`
      SELECT MAX(atualizado_em) AS atualizado_em FROM cache_contas_receber
    `);

    res.json({
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
    });
  } catch (err) {
    console.error("[financeiro] /resumo:", err);
    res.status(500).json({ error: "Erro ao buscar resumo financeiro" });
  }
});

// ── GET /clientes ───────────────────────────────────────────────────────────

router.get("/clientes", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(200, Math.max(10, Number(q.limit ?? 50)));
    const offset = (page - 1) * limit;
    const sort = (q.sort ?? "total_vencido") as string;
    const dir = q.dir === "asc" ? "ASC" : "DESC";

    const { where, params } = buildWhereClause(q);

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
      data: rows,
      total: Number(totalRows?.cnt ?? 0),
      page,
      limit,
      pages: Math.ceil(Number(totalRows?.cnt ?? 0) / limit),
    });
  } catch (err) {
    console.error("[financeiro] /clientes:", err);
    res.status(500).json({ error: "Erro ao buscar clientes" });
  }
});

// ── GET /cliente/:idclifor ──────────────────────────────────────────────────

router.get("/cliente/:idclifor", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const idclifor = Number(req.params.idclifor);
    if (!idclifor) return res.status(400).json({ error: "idclifor inválido" });

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
        WHERE idclifor = $1 AND valor_aberto > 0
        GROUP BY idclifor, nomecliente, idvendedor, nomevendedor,
                 cidade_cobranca, uf_cobranca, endereco_cobranca, bairro_cobranca
      `, [idclifor]),

      pgAll(`
        SELECT * FROM cache_contas_receber
        WHERE idclifor = $1 AND valor_aberto > 0
        ORDER BY dtvencimento ASC, idtitulo ASC
      `, [idclifor]),

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
    console.error("[financeiro] /cliente:", err);
    res.status(500).json({ error: "Erro ao buscar cliente" });
  }
});

// ── GET /duplicatas ─────────────────────────────────────────────────────────

router.get("/duplicatas", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(q.page ?? 1));
    const limit = Math.min(500, Math.max(10, Number(q.limit ?? 100)));
    const offset = (page - 1) * limit;
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

    const { where, params } = buildWhereClause(q);

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
      data: rows,
      total: Number(totalRows?.cnt ?? 0),
      page,
      limit,
      pages: Math.ceil(Number(totalRows?.cnt ?? 0) / limit),
    });
  } catch (err) {
    console.error("[financeiro] /duplicatas:", err);
    res.status(500).json({ error: "Erro ao buscar duplicatas" });
  }
});

// ── GET /vendedores ─────────────────────────────────────────────────────────

router.get("/vendedores", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
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
      WHERE valor_aberto > 0
      GROUP BY idvendedor, nomevendedor
      ORDER BY total_vencido DESC
    `);
    res.json({ data: rows });
  } catch (err) {
    console.error("[financeiro] /vendedores:", err);
    res.status(500).json({ error: "Erro ao buscar vendedores" });
  }
});

// ── GET /vendedor/:idvendedor ───────────────────────────────────────────────

router.get("/vendedor/:idvendedor", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const idvendedor = Number(req.params.idvendedor);
    if (!idvendedor) return res.status(400).json({ error: "idvendedor inválido" });

    const [resumo, clientes, topTitulos] = await Promise.all([
      pgGet(`
        SELECT
          idvendedor, nomevendedor,
          COUNT(DISTINCT idclifor) AS clientes_pendencia,
          COUNT(DISTINCT CASE WHEN status='VENCIDO' THEN idclifor END) AS clientes_vencidos,
          SUM(valor_aberto) AS total_aberto,
          SUM(CASE WHEN status='VENCIDO' THEN valor_aberto ELSE 0 END) AS total_vencido,
          SUM(CASE WHEN status='VENCE_HOJE' THEN valor_aberto ELSE 0 END) AS vence_hoje,
          SUM(CASE WHEN status='A_VENCER' THEN valor_aberto ELSE 0 END) AS a_vencer,
          SUM(valor_juros_pendente) AS juros_pendente,
          MAX(dias_atraso) AS maior_atraso
        FROM cache_contas_receber
        WHERE idvendedor = $1 AND valor_aberto > 0
        GROUP BY idvendedor, nomevendedor
      `, [idvendedor]),

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
        WHERE idvendedor = $1 AND valor_aberto > 0
        GROUP BY idclifor, nomecliente, cidade_cobranca, uf_cobranca
        ORDER BY total_vencido DESC
        LIMIT 50
      `, [idvendedor]),

      pgAll(`
        SELECT idtitulo, digitotitulo, serienota, nomecliente, idclifor,
               dtvencimento, dias_atraso, valor_aberto, status
        FROM cache_contas_receber
        WHERE idvendedor = $1 AND status = 'VENCIDO'
        ORDER BY dias_atraso DESC
        LIMIT 10
      `, [idvendedor]),
    ]);

    res.json({ resumo: resumo ?? null, clientes, top_titulos: topTitulos });
  } catch (err) {
    console.error("[financeiro] /vendedor:", err);
    res.status(500).json({ error: "Erro ao buscar vendedor" });
  }
});

// ── GET /aging ──────────────────────────────────────────────────────────────

router.get("/aging", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
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
      WHERE valor_aberto > 0
      GROUP BY faixa, ordem
      ORDER BY ordem
    `);

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

    res.json({ data, total_vencido: totalVencido });
  } catch (err) {
    console.error("[financeiro] /aging:", err);
    res.status(500).json({ error: "Erro ao calcular aging" });
  }
});

// ── GET /fila-cobranca ──────────────────────────────────────────────────────

router.get("/fila-cobranca", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const hoje = new Date().toISOString().split("T")[0];

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
      WHERE cr.status IN ('VENCIDO','VENCE_HOJE') AND cr.valor_aberto > 0
      GROUP BY cr.idclifor, cr.nomecliente, cr.idvendedor, cr.nomevendedor,
               cr.cidade_cobranca, cr.uf_cobranca,
               fc.status_interno, fc.data_cobranca, fc.proxima_acao,
               fc.data_proxima_acao, fc.promessa_pagamento, fc.data_promessa_pagamento
      ORDER BY
        CASE WHEN fc.data_promessa_pagamento IS NOT NULL AND fc.data_promessa_pagamento < $1 AND fc.promessa_pagamento = 'S' THEN 0 ELSE 1 END,
        SUM(CASE WHEN cr.status='VENCIDO' THEN cr.valor_aberto ELSE 0 END) DESC,
        MAX(cr.dias_atraso) DESC
      LIMIT 200
    `, [hoje]);

    res.json({ data: rows.map(r => ({
      ...r,
      total_aberto: Number(r.total_aberto),
      total_vencido: Number(r.total_vencido),
      juros_pendente: Number(r.juros_pendente),
      maior_atraso: Number(r.maior_atraso),
      qtd_vencidos: Number(r.qtd_vencidos),
    })) });
  } catch (err) {
    console.error("[financeiro] /fila-cobranca:", err);
    res.status(500).json({ error: "Erro ao buscar fila de cobrança" });
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
    const q = req.query as Record<string, string | undefined>;
    const { where, params } = buildWhereClause(q);

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

    const wsData = [
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

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 22 }, { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 4 },
      { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 14 }, { wch: 24 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Receber");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `contas-receber-${new Date().toISOString().split("T")[0]}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    console.error("[financeiro] /exportar:", err);
    res.status(500).json({ error: "Erro ao exportar" });
  }
});

// ── POST /admin/sync/contas-receber ─────────────────────────────────────────

router.post("/admin/sync", isAdmin, async (req: AuthRequest, res: Response) => {
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
