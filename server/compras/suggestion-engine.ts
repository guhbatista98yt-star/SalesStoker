/**
 * Copiloto de Compras — Motor de Sugestão de Compra
 *
 * Calcula para cada produto/fornecedor:
 *   - Consumo médio diário (baseado em cache_campanhas)
 *   - Estoque disponível real (de cache_estoque_sugestao.SALDO_DISPONIVEL)
 *   - Pedidos de compra pendentes (de cache_estoque_sugestao.QTDPENDENTE)
 *   - Ponto de reposição do ERP (de cache_estoque_sugestao.QTDREPOSICAO)
 *   - Cobertura atual em dias (real quando há estoque sincronizado)
 *   - Sugestão de quantidade com desconto de pedidos pendentes
 *   - Urgência e criticidade
 *
 * Fontes de dados:
 *   - cache_campanhas: vendas por produto/fabricante (IDPRODUTO, FABRICANTE, QTD, DTMOVIMENTO)
 *   - cache_estoque_sugestao: snapshot ERP — estoque atual, reservas, pedidos pendentes,
 *     ponto de reposição, data/preço da última compra
 *     (populado por `python sync/erp_sync.py estoque_sugestao` no Windows)
 */

import { pgAll, pgGet } from "../pg-client";

export interface ProductSuggestion {
  produtoId: string;
  produtoNome: string;
  fabricante: string;

  consumoMedioDiario: number;
  coberturaDias: number;
  /** Ponto de reposição em quantidade (consumoMedioDiario * pontoReposicaoDias) */
  pontoReposicao: number;
  /** Ponto de reposição em dias (leadTimeDias + estoqueSegurancaDias) — usado em cálculos de urgência */
  pontoReposicaoDias: number;

  estoqueAtual: number;
  /** Quantidade reservada para pedidos de venda já existentes (de ESTOQUE_ANALITICO_TMP) */
  qtdReserva: number;
  /** Estoque físico disponível (estoqueAtual - qtdReserva) — fonte ERP quando sincronizado */
  saldoDisponivel: number;
  pedidosAbertos: number;
  leadTimeDias: number;
  estoqueSeguranca: number;
  loteMinimo: number;
  multiploEmbalagem: number;

  coberturaAlvoDias: number;
  quantidadeSugerida: number;

  urgencia: "critica" | "alta" | "media" | "baixa" | "ok";
  criticidade: number;

  /** True quando estoqueAtual/pedidosAbertos vêm de cache_estoque_sugestao (ERP real) */
  estoqueErpDisponivel: boolean;

  ultimaAtualizacao: string;
  ultimaCompra: string | null;
  ultimaQtdComprada: number | null;
  /** Valor unitário da última compra (de ESTOQUE_ANALITICO com OI.TIPOCATEGORIA = 'C') */
  ultimaValorCompra: number | null;
}

interface FornecedorConfig {
  fabricante_nome: string;
  ativo: number;
  periodo_compra_dias: number;
  lead_time_dias: number;
}

interface ProdutoConfig {
  produto_id: string;
  fornecedor_nome: string;
  estoque_minimo: number;
  estoque_maximo: number;
  lote_minimo: number;
  multiplo_embalagem: number;
  giro_periodo_dias: number;
  ativo: number;
}

export interface SuggestionEngineConfig {
  coberturaAlvoDias: number;
  periodoAnalise: number;
  leadTimePadrao: number;
  estoqueSegurancaPadrao: number;
  loteMinimoPadrao: number;
  multiploEmbalagemPadrao: number;
}

const DEFAULT_CONFIG: SuggestionEngineConfig = {
  coberturaAlvoDias: 30,
  periodoAnalise: 90,
  leadTimePadrao: 7,
  estoqueSegurancaPadrao: 5,
  loteMinimoPadrao: 1,
  multiploEmbalagemPadrao: 1,
};

function roundToMultiple(qty: number, multiple: number): number {
  if (multiple <= 0) return Math.max(1, Math.ceil(qty));
  return Math.max(multiple, Math.ceil(qty / multiple) * multiple);
}

/**
 * Calcula urgência comparando cobertura em dias com limiares em dias.
 *
 * Todos os parâmetros estão em DIAS:
 *   coberturaDias      = (estoqueAtual + pedidosAbertos) / consumoMedioDiario
 *   leadTimeDias       = dias de lead time do fornecedor
 *   estoqueSegurancaDias = dias de segurança (estoqueSeguranca / consumoMedioDiario)
 *   pontoReposicaoDias   = leadTimeDias + estoqueSegurancaDias
 *
 * A urgência é calculada com base em quanto tempo resta antes de um problema de abastecimento.
 */
function calcUrgencia(
  coberturaDias: number,
  pontoReposicaoDias: number,
  leadTimeDias: number,
): "critica" | "alta" | "media" | "baixa" | "ok" {
  if (coberturaDias <= 0) return "critica";
  if (coberturaDias <= leadTimeDias) return "critica";
  if (coberturaDias <= pontoReposicaoDias) return "alta";
  if (coberturaDias <= pontoReposicaoDias * 1.5) return "media";
  if (coberturaDias <= pontoReposicaoDias * 2) return "baixa";
  return "ok";
}

function calcCriticidade(
  urgencia: string,
  consumoMedioDiario: number,
  coberturaDias: number,
): number {
  const urgMap: Record<string, number> = {
    critica: 100,
    alta: 75,
    media: 50,
    baixa: 25,
    ok: 0,
  };
  const base = urgMap[urgencia] ?? 0;
  const volumeScore = Math.min(30, consumoMedioDiario / 10);
  const coverageScore = coberturaDias <= 0 ? 30 : Math.max(0, 30 - coberturaDias);
  return Math.min(100, base + volumeScore + coverageScore);
}


export async function calcularSugestoesPorFornecedor(
  fabricante: string,
  config: Partial<SuggestionEngineConfig> = {},
): Promise<ProductSuggestion[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = new Date();
  const dataFim = now.toISOString().split("T")[0];

  // Load supplier config, product configs, and ERP stock snapshot in parallel
  const [fornConf, produtosConf, estoqueRows, ultimasCompras] = await Promise.all([
    pgGet<FornecedorConfig>(
      `SELECT fabricante_nome, ativo, periodo_compra_dias, lead_time_dias FROM compras_fornecedores_config WHERE fabricante_nome = ?`,
      [fabricante],
    ).catch(() => null),
    pgAll<ProdutoConfig>(
      `SELECT produto_id, fornecedor_nome, estoque_minimo, estoque_maximo, lote_minimo, multiplo_embalagem, giro_periodo_dias, ativo FROM compras_produtos_config WHERE fornecedor_nome = ?`,
      [fabricante],
    ).catch(() => [] as ProdutoConfig[]),
    pgAll<{
      IDPRODUTO: string; FABRICANTE: string;
      SALDO_ATUAL: number; QTDRESERVA: number; SALDO_DISPONIVEL: number;
      QTDREPOSICAO: number; DTULT_COMPRA: string | null; VAL_UNITARIO: number; QTDPENDENTE: number;
    }>(
      `SELECT "IDPRODUTO","FABRICANTE","SALDO_ATUAL","QTDRESERVA","SALDO_DISPONIVEL",
              "QTDREPOSICAO","DTULT_COMPRA","VAL_UNITARIO","QTDPENDENTE"
       FROM cache_estoque_sugestao WHERE "FABRICANTE" = ?`,
      [fabricante],
    ).catch(() => []),
    pgAll<{ IDPRODUTO: string; ultima_compra: string; ultima_qtd: number }>(
      `SELECT c."IDPRODUTO", c."DTMOVIMENTO" as ultima_compra, c."QTD" as ultima_qtd
       FROM cache_campanhas c
       INNER JOIN (
         SELECT "IDPRODUTO", MAX("DTMOVIMENTO") as max_dt
         FROM cache_campanhas
         WHERE "FABRICANTE" = ? AND "IDPRODUTO" IS NOT NULL
         GROUP BY "IDPRODUTO"
       ) m ON c."IDPRODUTO" = m."IDPRODUTO" AND c."DTMOVIMENTO" = m.max_dt
       WHERE c."FABRICANTE" = ?`,
      [fabricante, fabricante],
    ).catch(() => [] as { IDPRODUTO: string; ultima_compra: string; ultima_qtd: number }[]),
  ]);

  const periodoAnalise = fornConf ? Number(fornConf.periodo_compra_dias) : cfg.periodoAnalise;
  const maxPeriodoFromProds = produtosConf.length > 0
    ? Math.max(...produtosConf.map(p => Number(p.giro_periodo_dias) || periodoAnalise))
    : periodoAnalise;
  const maxPeriodo = Math.max(periodoAnalise, maxPeriodoFromProds, cfg.periodoAnalise);
  const dataInicio = new Date(now.getTime() - maxPeriodo * 86400000).toISOString().split("T")[0];
  const prodMap = new Map(produtosConf.map(p => [p.produto_id, p]));
  const estoqueMap = new Map(estoqueRows.map(e => [e.IDPRODUTO, e]));
  const ultimaMap  = new Map(ultimasCompras.map(u => [u.IDPRODUTO, u]));

  const rows = await pgAll<{ IDPRODUTO: string; FABRICANTE: string; total_vendido: number }>(
    `SELECT "IDPRODUTO", "FABRICANTE",
            COALESCE(SUM("QTD"), 0) as total_vendido
     FROM cache_campanhas
     WHERE "FABRICANTE" = ?
       AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ?
       AND "IDPRODUTO" IS NOT NULL AND "IDPRODUTO" != ''
     GROUP BY "IDPRODUTO", "FABRICANTE"
     ORDER BY total_vendido DESC`,
    [fabricante, dataInicio, dataFim],
  );

  return rows.map((row) => {
    const prodConf = prodMap.get(row.IDPRODUTO);
    const ultima   = ultimaMap.get(row.IDPRODUTO);
    const est      = estoqueMap.get(row.IDPRODUTO);
    return buildSuggestion(row, { ...cfg, periodoAnalise }, dataFim, {
      leadTimeDias:     fornConf ? Number(fornConf.lead_time_dias)     : cfg.leadTimePadrao,
      coberturaAlvoDias: fornConf ? Number(fornConf.periodo_compra_dias) : cfg.coberturaAlvoDias,
      estoqueSeguranca: prodConf ? Number(prodConf.estoque_minimo)     : cfg.estoqueSegurancaPadrao,
      loteMinimo:       prodConf ? Number(prodConf.lote_minimo)        : cfg.loteMinimoPadrao,
      multiploEmbalagem: prodConf ? Number(prodConf.multiplo_embalagem) : cfg.multiploEmbalagemPadrao,
      ultimaQtdComprada: ultima ? Number(ultima.ultima_qtd)            : null,
      estoqueErp: est ? {
        saldoAtual:      Number(est.SALDO_ATUAL),
        qtdReserva:      Number(est.QTDRESERVA),
        saldoDisponivel: Number(est.SALDO_DISPONIVEL),
        qtdPendente:     Number(est.QTDPENDENTE),
        qtdReposicao:    Number(est.QTDREPOSICAO),
        dtUltCompra:     est.DTULT_COMPRA ?? null,
        valUnitario:     Number(est.VAL_UNITARIO),
      } : undefined,
    });
  });
}

export async function calcularTodasSugestoes(
  config: Partial<SuggestionEngineConfig> = {},
): Promise<ProductSuggestion[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = new Date();
  const dataFim = now.toISOString().split("T")[0];

  // Load per-supplier configs, per-product configs, and full ERP stock snapshot in parallel
  const [fornecedoresConf, produtosConf, estoqueRows] = await Promise.all([
    pgAll<FornecedorConfig>(
      `SELECT fabricante_nome, ativo, periodo_compra_dias, lead_time_dias FROM compras_fornecedores_config`,
    ).catch(() => [] as FornecedorConfig[]),
    pgAll<ProdutoConfig>(
      `SELECT produto_id, fornecedor_nome, estoque_minimo, estoque_maximo, lote_minimo, multiplo_embalagem, giro_periodo_dias, ativo FROM compras_produtos_config`,
    ).catch(() => [] as ProdutoConfig[]),
    pgAll<{
      IDPRODUTO: string; FABRICANTE: string;
      SALDO_ATUAL: number; QTDRESERVA: number; SALDO_DISPONIVEL: number;
      QTDREPOSICAO: number; DTULT_COMPRA: string | null; VAL_UNITARIO: number; QTDPENDENTE: number;
    }>(
      `SELECT "IDPRODUTO","FABRICANTE","SALDO_ATUAL","QTDRESERVA","SALDO_DISPONIVEL",
              "QTDREPOSICAO","DTULT_COMPRA","VAL_UNITARIO","QTDPENDENTE"
       FROM cache_estoque_sugestao`,
    ).catch(() => []),
  ]);

  const fornMap    = new Map(fornecedoresConf.map(f => [f.fabricante_nome, f]));
  const prodMap    = new Map(produtosConf.map(p => [`${p.produto_id}::${p.fornecedor_nome}`, p]));
  const estoqueMap = new Map(estoqueRows.map(e => [`${e.IDPRODUTO}::${e.FABRICANTE}`, e]));

  // Determine active fabricantes: if no config exists, treat as active
  const inactiveFabricantes = new Set(
    fornecedoresConf.filter(f => !f.ativo).map(f => f.fabricante_nome),
  );

  // Determine analysis period (max giro_periodo_dias from products, or global)
  const maxAnalise = Math.max(cfg.periodoAnalise, ...produtosConf.map(p => p.giro_periodo_dias ?? 90));
  const dataInicioMax = new Date(now.getTime() - maxAnalise * 86400000).toISOString().split("T")[0];

  const [rows, ultimasCompras] = await Promise.all([
    pgAll<{ IDPRODUTO: string; FABRICANTE: string; total_vendido: number }>(
      `SELECT "IDPRODUTO", "FABRICANTE",
              COALESCE(SUM("QTD"), 0) as total_vendido
       FROM cache_campanhas
       WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ?
         AND "IDPRODUTO" IS NOT NULL AND "IDPRODUTO" != ''
       GROUP BY "IDPRODUTO", "FABRICANTE"
       ORDER BY total_vendido DESC
       LIMIT 500`,
      [dataInicioMax, dataFim],
    ),
    pgAll<{ IDPRODUTO: string; FABRICANTE: string; ultima_compra: string; ultima_qtd: number }>(
      `SELECT c."IDPRODUTO", c."FABRICANTE",
              c."DTMOVIMENTO" as ultima_compra,
              c."QTD" as ultima_qtd
       FROM cache_campanhas c
       INNER JOIN (
         SELECT "IDPRODUTO", "FABRICANTE", MAX("DTMOVIMENTO") as max_dt
         FROM cache_campanhas
         WHERE "IDPRODUTO" IS NOT NULL AND "IDPRODUTO" != ''
         GROUP BY "IDPRODUTO", "FABRICANTE"
       ) m ON c."IDPRODUTO" = m."IDPRODUTO" AND c."FABRICANTE" = m."FABRICANTE"
            AND c."DTMOVIMENTO" = m.max_dt`,
    ).catch(() => [] as { IDPRODUTO: string; FABRICANTE: string; ultima_compra: string; ultima_qtd: number }[]),
  ]);

  const ultimaMap = new Map(ultimasCompras.map(u => [`${u.IDPRODUTO}::${u.FABRICANTE}`, u]));

  return rows
    .filter(row => !inactiveFabricantes.has(row.FABRICANTE))
    .map((row) => {
      const fornConf = fornMap.get(row.FABRICANTE);
      const prodConf = prodMap.get(`${row.IDPRODUTO}::${row.FABRICANTE}`);
      const ultima   = ultimaMap.get(`${row.IDPRODUTO}::${row.FABRICANTE}`);
      const est      = estoqueMap.get(`${row.IDPRODUTO}::${row.FABRICANTE}`);

      // Use per-product analysis period if configured
      const periodoAnalise = prodConf?.giro_periodo_dias ?? cfg.periodoAnalise;
      const scaledTotalVendido =
        periodoAnalise !== maxAnalise && maxAnalise > 0
          ? Number(row.total_vendido) * (periodoAnalise / maxAnalise)
          : Number(row.total_vendido);

      const rowScaled = { ...row, total_vendido: scaledTotalVendido };
      const cfgScaled = { ...cfg, periodoAnalise };

      return buildSuggestion(rowScaled, cfgScaled, dataFim, {
        leadTimeDias:     fornConf ? Number(fornConf.lead_time_dias)     : cfg.leadTimePadrao,
        coberturaAlvoDias: fornConf ? Number(fornConf.periodo_compra_dias) : cfg.coberturaAlvoDias,
        estoqueSeguranca: prodConf ? Number(prodConf.estoque_minimo)     : cfg.estoqueSegurancaPadrao,
        loteMinimo:       prodConf ? Number(prodConf.lote_minimo)        : cfg.loteMinimoPadrao,
        multiploEmbalagem: prodConf ? Number(prodConf.multiplo_embalagem) : cfg.multiploEmbalagemPadrao,
        ultimaQtdComprada: ultima ? Number(ultima.ultima_qtd)            : null,
        estoqueErp: est ? {
          saldoAtual:      Number(est.SALDO_ATUAL),
          qtdReserva:      Number(est.QTDRESERVA),
          saldoDisponivel: Number(est.SALDO_DISPONIVEL),
          qtdPendente:     Number(est.QTDPENDENTE),
          qtdReposicao:    Number(est.QTDREPOSICAO),
          dtUltCompra:     est.DTULT_COMPRA ?? null,
          valUnitario:     Number(est.VAL_UNITARIO),
        } : undefined,
      });
    });
}

export async function calcularSugestaoProduto(
  produtoId: string,
  config: Partial<SuggestionEngineConfig> = {},
  overrides: {
    estoqueAtual?: number;
    pedidosAbertos?: number;
    leadTimeDias?: number;
    estoqueSeguranca?: number;
    loteMinimo?: number;
    multiploEmbalagem?: number;
  } = {},
): Promise<ProductSuggestion | null> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = new Date();
  const dataFim = now.toISOString().split("T")[0];
  const dataInicio = new Date(now.getTime() - cfg.periodoAnalise * 86400000)
    .toISOString()
    .split("T")[0];

  const [row, estoqueRow] = await Promise.all([
    pgGet<{ IDPRODUTO: string; FABRICANTE: string; total_vendido: number }>(
      `SELECT "IDPRODUTO", "FABRICANTE",
              COALESCE(SUM("QTD"), 0) as total_vendido
       FROM cache_campanhas
       WHERE "IDPRODUTO" = ?
         AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ?
       GROUP BY "IDPRODUTO", "FABRICANTE"`,
      [produtoId, dataInicio, dataFim],
    ),
    pgGet<{
      SALDO_ATUAL: number; QTDRESERVA: number; SALDO_DISPONIVEL: number;
      QTDREPOSICAO: number; DTULT_COMPRA: string | null; VAL_UNITARIO: number; QTDPENDENTE: number;
    }>(
      `SELECT "SALDO_ATUAL","QTDRESERVA","SALDO_DISPONIVEL",
              "QTDREPOSICAO","DTULT_COMPRA","VAL_UNITARIO","QTDPENDENTE"
       FROM cache_estoque_sugestao WHERE "IDPRODUTO" = ? LIMIT 1`,
      [produtoId],
    ).catch(() => null),
  ]);

  if (!row) return null;

  return buildSuggestion(row, cfg, dataFim, {
    ...overrides,
    estoqueErp: estoqueRow ? {
      saldoAtual:      Number(estoqueRow.SALDO_ATUAL),
      qtdReserva:      Number(estoqueRow.QTDRESERVA),
      saldoDisponivel: Number(estoqueRow.SALDO_DISPONIVEL),
      qtdPendente:     Number(estoqueRow.QTDPENDENTE),
      qtdReposicao:    Number(estoqueRow.QTDREPOSICAO),
      dtUltCompra:     estoqueRow.DTULT_COMPRA ?? null,
      valUnitario:     Number(estoqueRow.VAL_UNITARIO),
    } : undefined,
  });
}

interface EstoqueErp {
  saldoAtual: number;
  qtdReserva: number;
  saldoDisponivel: number;
  qtdPendente: number;
  qtdReposicao: number;
  dtUltCompra: string | null;
  valUnitario: number;
}

function buildSuggestion(
  row: { IDPRODUTO: string; FABRICANTE: string; total_vendido: number },
  cfg: SuggestionEngineConfig,
  dataFim: string,
  overrides: {
    estoqueAtual?: number;
    pedidosAbertos?: number;
    leadTimeDias?: number;
    estoqueSeguranca?: number;
    loteMinimo?: number;
    multiploEmbalagem?: number;
    coberturaAlvoDias?: number;
    ultimaCompra?: string | null;
    ultimaQtdComprada?: number | null;
    ultimaValorCompra?: number | null;
    estoqueErp?: EstoqueErp;
  } = {},
): ProductSuggestion {
  const consumoMedioDiario =
    cfg.periodoAnalise > 0 ? Number(row.total_vendido) / cfg.periodoAnalise : 0;

  const erp = overrides.estoqueErp;
  const erpDisponivel = erp !== undefined;

  // When ERP snapshot is available: use SALDO_DISPONIVEL (physical - reserved)
  // Otherwise fall back to overrides.estoqueAtual (0 when no ERP data)
  const saldoAtual       = erp ? erp.saldoAtual       : (overrides.estoqueAtual ?? 0);
  const qtdReserva       = erp ? erp.qtdReserva        : 0;
  const saldoDisponivel  = erp ? erp.saldoDisponivel   : (overrides.estoqueAtual ?? 0);
  const estoqueAtual     = saldoDisponivel; // engine uses available (not physical) stock

  // pedidosAbertos = pending purchase orders from ERP (PEDIDO_COMPRA_PROD)
  const pedidosAbertos   = erp ? erp.qtdPendente       : (overrides.pedidosAbertos ?? 0);

  const leadTimeDias     = overrides.leadTimeDias ?? cfg.leadTimePadrao;
  const coberturaAlvoDias = overrides.coberturaAlvoDias ?? cfg.coberturaAlvoDias;
  const loteMinimo       = overrides.loteMinimo ?? cfg.loteMinimoPadrao;
  const multiploEmbalagem = overrides.multiploEmbalagem ?? cfg.multiploEmbalagemPadrao;

  // Estoque de segurança: prefer product config; then ERP reorder point; then system default
  const estoqueSeguranca =
    overrides.estoqueSeguranca !== undefined && overrides.estoqueSeguranca > 0
      ? overrides.estoqueSeguranca
      : erp && erp.qtdReposicao > 0
        ? erp.qtdReposicao
        : cfg.estoqueSegurancaPadrao;

  // Coverage considers available stock + pending purchase orders already placed
  const coberturaDias =
    consumoMedioDiario > 0
      ? (estoqueAtual + pedidosAbertos) / consumoMedioDiario
      : estoqueAtual + pedidosAbertos > 0
        ? 999
        : 0;

  const estoqueSegurancaDias =
    consumoMedioDiario > 0 ? estoqueSeguranca / consumoMedioDiario : estoqueSeguranca;

  const pontoReposicaoDias = leadTimeDias + estoqueSegurancaDias;
  const pontoReposicao     = consumoMedioDiario * pontoReposicaoDias;

  const estoqueIdeal       = consumoMedioDiario * coberturaAlvoDias + estoqueSeguranca;
  // Deduct both current available stock AND already-ordered qty to avoid over-buying
  const necessidadeLiquida = estoqueIdeal - estoqueAtual - pedidosAbertos;
  const quantidadeSugerida =
    necessidadeLiquida > 0
      ? roundToMultiple(necessidadeLiquida, multiploEmbalagem > 0 ? multiploEmbalagem : 1)
      : 0;

  const finalQty = Math.max(quantidadeSugerida, quantidadeSugerida > 0 ? loteMinimo : 0);

  const urgencia   = calcUrgencia(coberturaDias, pontoReposicaoDias, leadTimeDias);
  const criticidade = calcCriticidade(urgencia, consumoMedioDiario, coberturaDias);

  // Last purchase: prefer ERP data (more accurate) over cache_campanhas proxy
  const ultimaCompra = erp?.dtUltCompra ?? overrides.ultimaCompra ?? null;
  const ultimaValorCompra = erp && erp.valUnitario > 0 ? erp.valUnitario : (overrides.ultimaValorCompra ?? null);

  return {
    produtoId: row.IDPRODUTO,
    produtoNome: row.IDPRODUTO,
    fabricante: row.FABRICANTE || "",

    consumoMedioDiario: Math.round(consumoMedioDiario * 100) / 100,
    coberturaDias: Math.round(coberturaDias * 10) / 10,
    pontoReposicao: Math.round(pontoReposicao * 10) / 10,
    pontoReposicaoDias: Math.round(pontoReposicaoDias * 10) / 10,

    estoqueAtual: Math.round(estoqueAtual * 100) / 100,
    qtdReserva: Math.round(qtdReserva * 100) / 100,
    saldoDisponivel: Math.round(saldoDisponivel * 100) / 100,
    pedidosAbertos: Math.round(pedidosAbertos * 100) / 100,
    leadTimeDias,
    estoqueSeguranca: Math.round(estoqueSeguranca * 100) / 100,
    loteMinimo,
    multiploEmbalagem,

    coberturaAlvoDias,
    quantidadeSugerida: finalQty,

    urgencia,
    criticidade: Math.round(criticidade),

    estoqueErpDisponivel: erpDisponivel,

    ultimaAtualizacao: dataFim,
    ultimaCompra,
    ultimaQtdComprada: overrides.ultimaQtdComprada ?? null,
    ultimaValorCompra,
  };
}

export async function simularCompra(
  sugestoes: ProductSuggestion[],
  quantidades: Record<string, number>,
): Promise<{
  antes: { produtoId: string; coberturaDias: number; urgencia: string }[];
  depois: { produtoId: string; coberturaDias: number; urgencia: string }[];
  totalProdutos: number;
  produtosMelhorados: number;
}> {
  const urgMap: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3, ok: 4 };

  const antes = sugestoes.map((s) => ({
    produtoId: s.produtoId,
    coberturaDias: s.coberturaDias,
    urgencia: s.urgencia,
  }));

  const depois = sugestoes.map((s) => {
    const compraQty = quantidades[s.produtoId] ?? 0;
    const novoEstoque = s.estoqueAtual + compraQty;
    const novaCoberturaRaw =
      s.consumoMedioDiario > 0
        ? (novoEstoque + s.pedidosAbertos) / s.consumoMedioDiario
        : novoEstoque + s.pedidosAbertos > 0
          ? 999
          : 0;
    const novaCobertura = Math.round(novaCoberturaRaw * 10) / 10;
    // Use pontoReposicaoDias (days) — consistent unit with coberturaDias and leadTimeDias
    const novaUrgencia = calcUrgencia(novaCobertura, s.pontoReposicaoDias, s.leadTimeDias);

    return {
      produtoId: s.produtoId,
      coberturaDias: novaCobertura,
      urgencia: novaUrgencia,
    };
  });

  const produtosMelhorados = depois.filter((d, i) => {
    return (urgMap[d.urgencia] ?? 0) > (urgMap[antes[i].urgencia] ?? 0);
  }).length;

  return {
    antes,
    depois,
    totalProdutos: sugestoes.length,
    produtosMelhorados,
  };
}
