/**
 * Copiloto de Compras — Motor de Sugestão de Compra
 *
 * Calcula para cada produto/fornecedor:
 *   - Consumo médio diário (baseado em cache_vendas / cache_campanhas)
 *   - Pedidos em aberto (baseado em cache_vendas_pendentes por fornecedor)
 *   - Cobertura atual em dias
 *   - Ponto de reposição
 *   - Sugestão de quantidade (estoque atual + pedidos em aberto + lead time +
 *     estoque de segurança + lote mínimo + múltiplo de embalagem + cobertura alvo)
 *   - Urgência e criticidade
 *
 * Fontes de dados:
 *   - cache_campanhas: vendas por produto/fabricante (IDPRODUTO, FABRICANTE, QTD, DTMOVIMENTO)
 *   - cache_vendas: vendas totais por vendedor/empresa (fallback para volume geral)
 *   - cache_vendas_pendentes: pedidos a faturar por empresa/vendedor (proxy para pedidos abertos)
 *
 * Campos do ERP ainda não disponíveis nas tabelas de cache (documentados):
 *   - ESTOQUE_ATUAL: quantidade em estoque físico — viria de cache_estoque.QTDESTOQUE
 *     (tabela ainda não sincronizada pelo processo Python)
 *   - LEAD_TIME_DIAS: lead time do fornecedor em dias — viria de cache_fornecedores.LEAD_TIME
 *     (tabela ainda não sincronizada)
 *   - ESTOQUE_SEGURANCA: estoque de segurança por produto — viria de cache_produtos.ESTOQUE_MINIMO
 *     (tabela ainda não sincronizada)
 *   - LOTE_MINIMO: quantidade mínima de compra — viria de cache_produtos.LOTE_COMPRA
 *   - MULTIPLO_EMBALAGEM: múltiplo de embalagem do fornecedor — viria de cache_produtos.MULTIPLO
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
  pedidosAbertos: number;
  leadTimeDias: number;
  estoqueSeguranca: number;
  loteMinimo: number;
  multiploEmbalagem: number;

  coberturaAlvoDias: number;
  quantidadeSugerida: number;

  urgencia: "critica" | "alta" | "media" | "baixa" | "ok";
  criticidade: number;

  ultimaAtualizacao: string;
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
  const dataInicio = new Date(now.getTime() - cfg.periodoAnalise * 86400000)
    .toISOString()
    .split("T")[0];

  const rows = await pgAll<{
    IDPRODUTO: string;
    FABRICANTE: string;
    total_vendido: number;
  }>(
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

  // pedidosAbertos não pode ser derivado de cache_vendas_pendentes pois TOTALVENDA_LINHA
  // é valor monetário (R$), não quantidade física. Será 0 até que uma tabela de pedidos
  // com QTDPENDENTE por produto seja sincronizada (ex: cache_ped_abertos.QTDPENDENTE).
  return rows.map((row) => {
    return buildSuggestion(row, cfg, dataFim, { pedidosAbertos: 0 });
  });
}

export async function calcularTodasSugestoes(
  config: Partial<SuggestionEngineConfig> = {},
): Promise<ProductSuggestion[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = new Date();
  const dataFim = now.toISOString().split("T")[0];
  const dataInicio = new Date(now.getTime() - cfg.periodoAnalise * 86400000)
    .toISOString()
    .split("T")[0];

  const rows = await pgAll<{
    IDPRODUTO: string;
    FABRICANTE: string;
    total_vendido: number;
  }>(
    `SELECT "IDPRODUTO", "FABRICANTE",
            COALESCE(SUM("QTD"), 0) as total_vendido
     FROM cache_campanhas
     WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ?
       AND "IDPRODUTO" IS NOT NULL AND "IDPRODUTO" != ''
     GROUP BY "IDPRODUTO", "FABRICANTE"
     ORDER BY total_vendido DESC
     LIMIT 500`,
    [dataInicio, dataFim],
  );

  // pedidosAbertos não pode ser derivado de cache_vendas_pendentes (valor monetário, não qty).
  // Permanece 0 até sincronização de tabela com QTDPENDENTE por produto.
  return rows.map((row) => {
    return buildSuggestion(row, cfg, dataFim, { pedidosAbertos: 0 });
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

  const row = await pgGet<{
    IDPRODUTO: string;
    FABRICANTE: string;
    total_vendido: number;
  }>(
    `SELECT "IDPRODUTO", "FABRICANTE",
            COALESCE(SUM("QTD"), 0) as total_vendido
     FROM cache_campanhas
     WHERE "IDPRODUTO" = ?
       AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ?
     GROUP BY "IDPRODUTO", "FABRICANTE"`,
    [produtoId, dataInicio, dataFim],
  );

  if (!row) return null;

  // pedidosAbertos: aceita override externo (ex: dados do ERP via API futura);
  // caso contrário usa 0, pois cache_vendas_pendentes fornece valor monetário (não qty).
  const pedidosAbertos = overrides.pedidosAbertos ?? 0;

  return buildSuggestion(row, cfg, dataFim, { ...overrides, pedidosAbertos });
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
  } = {},
): ProductSuggestion {
  const consumoMedioDiario =
    cfg.periodoAnalise > 0 ? Number(row.total_vendido) / cfg.periodoAnalise : 0;

  // estoqueAtual: from cache_estoque.QTDESTOQUE when available (table not yet synced)
  const estoqueAtual = overrides.estoqueAtual ?? 0;
  // pedidosAbertos: estimated proportionally from cache_vendas_pendentes
  const pedidosAbertos = overrides.pedidosAbertos ?? 0;
  // leadTimeDias: from cache_fornecedores.LEAD_TIME when available (table not yet synced)
  const leadTimeDias = overrides.leadTimeDias ?? cfg.leadTimePadrao;
  // estoqueSeguranca: from cache_produtos.ESTOQUE_MINIMO when available (table not yet synced)
  const estoqueSeguranca = overrides.estoqueSeguranca ?? cfg.estoqueSegurancaPadrao;
  // loteMinimo: from cache_produtos.LOTE_COMPRA when available (table not yet synced)
  const loteMinimo = overrides.loteMinimo ?? cfg.loteMinimoPadrao;
  // multiploEmbalagem: from cache_produtos.MULTIPLO when available (table not yet synced)
  const multiploEmbalagem = overrides.multiploEmbalagem ?? cfg.multiploEmbalagemPadrao;

  const coberturaDias =
    consumoMedioDiario > 0
      ? (estoqueAtual + pedidosAbertos) / consumoMedioDiario
      : estoqueAtual + pedidosAbertos > 0
        ? 999
        : 0;

  // estoqueSegurancaDias: dias de segurança derivados da quantidade de segurança e o consumo
  // Se consumo = 0, usa estoqueSeguranca como dias (conservador)
  const estoqueSegurancaDias =
    consumoMedioDiario > 0 ? estoqueSeguranca / consumoMedioDiario : estoqueSeguranca;

  // pontoReposicaoDias: horizonte mínimo de cobertura (em dias) para disparar reposição
  // = lead time + dias de estoque de segurança
  const pontoReposicaoDias = leadTimeDias + estoqueSegurancaDias;

  // pontoReposicao: quantidade física no ponto de reposição (para cálculo de necessidade)
  const pontoReposicao = consumoMedioDiario * pontoReposicaoDias;

  const estoqueIdeal = consumoMedioDiario * cfg.coberturaAlvoDias + estoqueSeguranca;
  const necessidadeLiquida = estoqueIdeal - estoqueAtual - pedidosAbertos;
  const quantidadeSugerida =
    necessidadeLiquida > 0
      ? roundToMultiple(necessidadeLiquida, multiploEmbalagem > 0 ? multiploEmbalagem : 1)
      : 0;

  const finalQty = Math.max(quantidadeSugerida, quantidadeSugerida > 0 ? loteMinimo : 0);

  // calcUrgencia recebe tudo em dias — unidades consistentes
  const urgencia = calcUrgencia(coberturaDias, pontoReposicaoDias, leadTimeDias);
  const criticidade = calcCriticidade(urgencia, consumoMedioDiario, coberturaDias);

  return {
    produtoId: row.IDPRODUTO,
    produtoNome: row.IDPRODUTO,
    fabricante: row.FABRICANTE || "",

    consumoMedioDiario: Math.round(consumoMedioDiario * 100) / 100,
    coberturaDias: Math.round(coberturaDias * 10) / 10,
    pontoReposicao: Math.round(pontoReposicao * 10) / 10,
    pontoReposicaoDias: Math.round(pontoReposicaoDias * 10) / 10,

    estoqueAtual,
    pedidosAbertos: Math.round(pedidosAbertos * 100) / 100,
    leadTimeDias,
    estoqueSeguranca,
    loteMinimo,
    multiploEmbalagem,

    coberturaAlvoDias: cfg.coberturaAlvoDias,
    quantidadeSugerida: finalQty,

    urgencia,
    criticidade: Math.round(criticidade),

    ultimaAtualizacao: dataFim,
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
