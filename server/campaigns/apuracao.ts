/**
 * Apuração Engine
 * Runs the full campaign calculation against actual sales data (cache_campanhas).
 * Produces per-vendedor results with complete memory of calculation.
 */

import { sqlite } from "../db";
import { randomUUID } from "crypto";
import { getCampaignById } from "./service";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProdutoBase {
  mode: "all" | "supplier" | "category" | "specific";
  suppliers?: string[];
  categories?: string[];
  ids?: string[];
}

export interface Bases {
  elegibilidade?: { mix_minimo?: number; produtos?: ProdutoBase | null };
  apuracao?: { produtos?: ProdutoBase | null };
  ranking?: {
    tipo?: "volume" | "crescimento" | "mix";
    criterio_desempate?: "valor" | "quantidade" | "data";
    periodo_comparativo?: { starts_at: string; ends_at: string } | null;
  };
  pagamento?: { produtos?: ProdutoBase | null };
}

export interface VendedorApuracao {
  vendedorId: string;
  vendedorNome: string;
  elegivel: boolean;
  participou: boolean;
  gatilhoAtingido: boolean;
  atingiu: boolean;
  premiado: boolean;
  posicao?: number;
  valorApuracao: number;
  valorPagamento: number;
  qtdTotal: number;
  mixCount: number;
  gatilhoValor: number;
  premioCalculado: number;
  premioFinal: number;
  motivosNaoParticipacao: string[];
  memoriaCalculo: MemoriaCalculo;
}

export interface MemoriaCalculo {
  passos: string[];
  baseApuracao: string;
  basePagamento: string;
  criterioRanking?: string;
  formulaPremio: string;
  periodo: string;
}

export interface ApuracaoResult {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignCode: string;
  apuradoEm: string;
  apuradoPor: string;
  periodoInicio: string;
  periodoFim: string;
  campaignMode: string;
  totalElegiveis: number;
  totalParticipantes: number;
  totalAtingidos: number;
  totalPremiados: number;
  valorTotalApuracao: number;
  valorTotalPagamento: number;
  valorTotalPremio: number;
  detalhes: VendedorApuracao[];
}

// ─── SQL helpers ───────────────────────────────────────────────────────────

function buildProductFilter(base: ProdutoBase | null | undefined): string {
  if (!base || base.mode === "all") return "";
  if (base.mode === "supplier" && base.suppliers?.length) {
    const list = base.suppliers.map(s => `'${s.replace(/'/g, "''")}'`).join(",");
    return `AND FABRICANTE IN (${list})`;
  }
  if (base.mode === "specific" && base.ids?.length) {
    const list = base.ids.map(i => `'${i.replace(/'/g, "''")}'`).join(",");
    return `AND IDPRODUTO IN (${list})`;
  }
  return "";
}

function querySalesByVendedor(
  start: string,
  end: string,
  base: ProdutoBase | null | undefined,
  vendedorIds?: string[],
): Map<string, { valor: number; qtd: number; mix: number; nome: string }> {
  const productFilter = buildProductFilter(base);
  const vendedorFilter =
    vendedorIds && vendedorIds.length > 0
      ? `AND IDVENDEDOR IN (${vendedorIds.map(v => `'${v.replace(/'/g, "''")}'`).join(",")})`
      : "";

  const sql = `
    SELECT
      IDVENDEDOR,
      MAX(NOMEVENDEDOR) as NOMEVENDEDOR,
      COALESCE(SUM(VALOR_LIQUIDO), 0) as total_valor,
      COALESCE(SUM(QTD), 0) as total_qtd,
      COUNT(DISTINCT IDPRODUTO) as mix_count
    FROM cache_campanhas
    WHERE DTMOVIMENTO >= ? AND DTMOVIMENTO <= ?
      ${productFilter}
      ${vendedorFilter}
      AND IDVENDEDOR IS NOT NULL AND IDVENDEDOR != ''
    GROUP BY IDVENDEDOR
  `;

  const rows = sqlite.prepare(sql).all(start, end) as {
    IDVENDEDOR: string;
    NOMEVENDEDOR: string;
    total_valor: number;
    total_qtd: number;
    mix_count: number;
  }[];

  const map = new Map<string, { valor: number; qtd: number; mix: number; nome: string }>();
  for (const r of rows) {
    map.set(r.IDVENDEDOR, {
      valor: r.total_valor,
      qtd: r.total_qtd,
      mix: r.mix_count,
      nome: r.NOMEVENDEDOR || r.IDVENDEDOR,
    });
  }
  return map;
}

function describeBase(base: ProdutoBase | null | undefined): string {
  if (!base || base.mode === "all") return "todos os produtos";
  if (base.mode === "supplier" && base.suppliers?.length) return `fornecedor(es): ${base.suppliers.join(", ")}`;
  if (base.mode === "specific" && base.ids?.length) return `${base.ids.length} produto(s) específico(s)`;
  if (base.mode === "category" && base.categories?.length) return `categoria(s): ${base.categories.join(", ")}`;
  return "todos os produtos";
}

// ─── Prize calculation ─────────────────────────────────────────────────────

function calcularPremio(
  rewards: any,
  vendedor: Partial<VendedorApuracao>,
  mode: string,
): { valor: number; formula: string } {
  if (!rewards?.type) return { valor: 0, formula: "Sem premiação configurada" };

  switch (rewards.type) {
    case "VALOR_FIXO": {
      const v = rewards.baseValue || 0;
      return { valor: v, formula: `Valor fixo: R$ ${formatBRL(v)}` };
    }
    case "PERCENTUAL":
    case "COMISSAO_PERCENTUAL": {
      const base = vendedor.valorPagamento || 0;
      const pct = rewards.basePercent || 0;
      const result = (base * pct) / 100;
      return {
        valor: result,
        formula: `${pct}% sobre base de pagamento R$ ${formatBRL(base)} = R$ ${formatBRL(result)}`,
      };
    }
    case "PONTOS": {
      const pts = rewards.baseValue || 0;
      return { valor: pts, formula: `${pts} pontos` };
    }
    case "RANKING": {
      const posicoes: { posicao: number; valor: number; label?: string }[] = rewards.posicoes || [];
      const pos = vendedor.posicao;
      if (!pos) return { valor: 0, formula: "Não classificado para premiação" };
      const match = posicoes.find(p => p.posicao === pos);
      if (match) {
        return {
          valor: match.valor,
          formula: `${pos}º lugar → R$ ${formatBRL(match.valor)}`,
        };
      }
      return { valor: 0, formula: `${pos}º lugar (sem prêmio configurado para esta posição)` };
    }
    case "FAIXA":
    case "PROGRESSAO": {
      const ref =
        mode === "ranking_crescimento"
          ? (vendedor as any).crescimentoPerc ?? vendedor.valorApuracao ?? 0
          : vendedor.valorApuracao ?? 0;
      const tiers = ((rewards.tiers || []) as any[]).sort((a, b) => (a.min || 0) - (b.min || 0));
      for (const tier of tiers) {
        const min = tier.min ?? 0;
        const max = tier.max !== null && tier.max !== undefined ? tier.max : Infinity;
        if (ref >= min && ref <= max) {
          const label = tier.label || `${min} – ${max === Infinity ? "∞" : max}`;
          return {
            valor: tier.value,
            formula: `Faixa "${label}" (ref: ${ref.toFixed(2)}): R$ ${formatBRL(tier.value)}`,
          };
        }
      }
      return { valor: 0, formula: `Nenhuma faixa aplicável (ref: ${ref.toFixed(2)})` };
    }
    default:
      return { valor: 0, formula: "Tipo de premiação não reconhecido" };
  }
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Main apuração ─────────────────────────────────────────────────────────

export function apurarCampanha(campaignId: string, actor: string): ApuracaoResult {
  const campaign = getCampaignById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada");

  const mode: string = (campaign as any).campaign_mode || "atingimento";
  const bases: Bases = (campaign as any).bases || {};
  const targets = (campaign as any).targets || {};
  const rewards = (campaign as any).rewards || {};
  const limits = (campaign as any).limits || {};

  const periodoInicio = campaign.starts_at;
  const periodoFim = campaign.ends_at;

  // Resolve product bases
  const mainProductBase: ProdutoBase | null = targets.produtos || null;
  const baseElegibilidade: ProdutoBase | null = bases.elegibilidade?.produtos ?? mainProductBase;
  const baseApuracao: ProdutoBase | null = bases.apuracao?.produtos ?? mainProductBase;
  const basePagamento: ProdutoBase | null = bases.pagamento?.produtos ?? baseApuracao;
  const mixMinimo: number = bases.elegibilidade?.mix_minimo ?? 0;
  const rankingTipo: string = bases.ranking?.tipo || "volume";
  const periodoComparativo = bases.ranking?.periodo_comparativo || null;

  // ── Fetch sales data ────────────────────────────────────────────────────
  const salesApuracao = querySalesByVendedor(periodoInicio, periodoFim, baseApuracao);
  const salesPagamento =
    basePagamento === baseApuracao
      ? salesApuracao
      : querySalesByVendedor(periodoInicio, periodoFim, basePagamento);
  const salesElegibilidade =
    baseElegibilidade === baseApuracao
      ? salesApuracao
      : querySalesByVendedor(periodoInicio, periodoFim, baseElegibilidade);

  // For growth ranking: fetch comparative period
  let salesComparativo: Map<string, { valor: number; qtd: number; mix: number; nome: string }> | null = null;
  if (rankingTipo === "crescimento" && periodoComparativo) {
    salesComparativo = querySalesByVendedor(
      periodoComparativo.starts_at,
      periodoComparativo.ends_at,
      baseApuracao,
    );
  }

  // ── Determine eligible vendedores ───────────────────────────────────────
  const targetVendedores = targets.vendedores || { mode: "all", ids: [], groupIds: [], exclude: [] };
  let eligibleIds: Set<string> | null = null;

  if (targetVendedores.mode === "specific" && targetVendedores.ids?.length > 0) {
    eligibleIds = new Set(targetVendedores.ids);
  }
  // For 'group' mode we'd need to resolve groups — for now treat as all
  // (group resolution needs async; can be enhanced later)

  // Union of all vendedores who had any sales in the apuracao period
  const allVendedorIds = new Set([
    ...salesApuracao.keys(),
    ...(eligibleIds ? [...eligibleIds] : []),
  ]);

  // Remove excluded vendedores
  const excluded: Set<string> = new Set(targetVendedores.exclude || []);

  // ── Load individual trigger goals ───────────────────────────────────────
  const goalsYear = new Date(periodoInicio).getFullYear();
  const goalRows = sqlite.prepare(`
    SELECT salespersonId, triggerValue
    FROM campaign_goals
    WHERE campaignName = ? AND year = ?
  `).all(campaignId, goalsYear) as { salespersonId: string; triggerValue: number }[];
  const goalsMap = new Map(goalRows.map(g => [g.salespersonId, g.triggerValue]));

  // ── Process each vendedor ───────────────────────────────────────────────
  const detalhes: (VendedorApuracao & { crescimentoPerc?: number })[] = [];

  for (const vid of allVendedorIds) {
    // Skip excluded
    if (excluded.has(vid)) continue;
    // Apply specific vendedor filter
    if (eligibleIds && !eligibleIds.has(vid)) continue;

    const apData = salesApuracao.get(vid) || { valor: 0, qtd: 0, mix: 0, nome: vid };
    const pgData = salesPagamento.get(vid) || { valor: 0, qtd: 0, mix: 0, nome: vid };
    const elData = salesElegibilidade.get(vid) || { valor: 0, qtd: 0, mix: 0, nome: vid };

    const nome = apData.nome || pgData.nome || vid;
    const valorApuracao = apData.valor;
    const valorPagamento = pgData.valor;
    const qtdTotal = apData.qtd;
    const mixCount = elData.mix;
    const gatilhoValor = goalsMap.get(vid) ?? 0;

    const passos: string[] = [];
    const motivosNaoParticipacao: string[] = [];

    passos.push(`Vendedor: ${nome} (${vid})`);
    passos.push(`Período: ${periodoInicio} a ${periodoFim}`);
    passos.push(`Base de apuração: ${describeBase(baseApuracao)}`);
    passos.push(`Valor apurado: R$ ${formatBRL(valorApuracao)}`);
    passos.push(`Quantidade apurada: ${qtdTotal.toFixed(0)} un.`);

    if (baseApuracao !== basePagamento) {
      passos.push(`Base de pagamento: ${describeBase(basePagamento)}`);
      passos.push(`Valor elegível para pagamento: R$ ${formatBRL(valorPagamento)}`);
    } else {
      passos.push(`Base de pagamento: mesma da apuração`);
    }

    // Mix check
    if (mixMinimo > 0) {
      passos.push(`Mix mínimo exigido: ${mixMinimo} produto(s) distintos`);
      passos.push(`Mix do vendedor: ${mixCount} produto(s) distintos`);
      if (mixCount < mixMinimo) {
        motivosNaoParticipacao.push(`Mix insuficiente: ${mixCount}/${mixMinimo} produtos distintos`);
      }
    }

    // Trigger check
    const gatilhoAtingido = gatilhoValor === 0 || valorApuracao >= gatilhoValor;
    if (gatilhoValor > 0) {
      passos.push(`Gatilho individual: R$ ${formatBRL(gatilhoValor)}`);
      passos.push(
        gatilhoAtingido
          ? `✓ Gatilho atingido (R$ ${formatBRL(valorApuracao)} ≥ R$ ${formatBRL(gatilhoValor)})`
          : `✗ Gatilho não atingido (R$ ${formatBRL(valorApuracao)} < R$ ${formatBRL(gatilhoValor)})`,
      );
      if (!gatilhoAtingido) {
        motivosNaoParticipacao.push(
          `Gatilho não atingido: R$ ${formatBRL(valorApuracao)} de R$ ${formatBRL(gatilhoValor)} necessários`,
        );
      }
    } else {
      passos.push("Sem gatilho individual configurado");
    }

    const participou = motivosNaoParticipacao.length === 0 && valorApuracao > 0;
    const atingiu = participou && gatilhoAtingido;

    if (!participou && valorApuracao === 0) {
      motivosNaoParticipacao.push("Sem vendas no período na base configurada");
    }

    // Crescimento
    let crescimentoPerc: number | undefined;
    if (rankingTipo === "crescimento" && salesComparativo) {
      const prevData = salesComparativo.get(vid) || { valor: 0, qtd: 0, mix: 0, nome };
      const prev = prevData.valor;
      if (prev > 0) {
        crescimentoPerc = ((valorApuracao - prev) / prev) * 100;
        passos.push(
          `Período comparativo: R$ ${formatBRL(prev)} → Crescimento: ${crescimentoPerc.toFixed(1)}%`,
        );
      } else {
        crescimentoPerc = valorApuracao > 0 ? 100 : 0;
        passos.push(`Sem venda no período anterior (crescimento base: ${crescimentoPerc.toFixed(1)}%)`);
      }
    }

    const detRow: VendedorApuracao & { crescimentoPerc?: number } = {
      vendedorId: vid,
      vendedorNome: nome,
      elegivel: true,
      participou,
      gatilhoAtingido,
      atingiu,
      premiado: false,
      posicao: undefined,
      valorApuracao,
      valorPagamento,
      qtdTotal,
      mixCount,
      gatilhoValor,
      premioCalculado: 0,
      premioFinal: 0,
      motivosNaoParticipacao,
      crescimentoPerc,
      memoriaCalculo: {
        passos,
        baseApuracao: describeBase(baseApuracao),
        basePagamento: describeBase(basePagamento),
        criterioRanking: rankingTipo,
        formulaPremio: "",
        periodo: `${periodoInicio} a ${periodoFim}`,
      },
    };

    detalhes.push(detRow);
  }

  // ── Ranking ──────────────────────────────────────────────────────────────
  const isRankingMode = mode === "ranking_volume" || mode === "ranking_crescimento" || mode === "ranking";

  if (isRankingMode) {
    const eligible = detalhes.filter(d => d.atingiu || (mode !== "ranking" && d.participou));

    eligible.sort((a, b) => {
      if (rankingTipo === "crescimento") {
        return (b.crescimentoPerc ?? 0) - (a.crescimentoPerc ?? 0);
      }
      if (rankingTipo === "mix") {
        return b.mixCount - a.mixCount;
      }
      return b.valorApuracao - a.valorApuracao;
    });

    let pos = 1;
    for (let i = 0; i < eligible.length; i++) {
      const cur = eligible[i];
      if (i > 0) {
        const prev = eligible[i - 1];
        const prevMetric =
          rankingTipo === "crescimento"
            ? (prev.crescimentoPerc ?? 0)
            : rankingTipo === "mix"
              ? prev.mixCount
              : prev.valorApuracao;
        const curMetric =
          rankingTipo === "crescimento"
            ? (cur.crescimentoPerc ?? 0)
            : rankingTipo === "mix"
              ? cur.mixCount
              : cur.valorApuracao;
        if (prevMetric !== curMetric) pos = i + 1;
      }
      cur.posicao = pos;
    }
  }

  // ── Calculate prizes ──────────────────────────────────────────────────────
  const maxPosPremiada = rewards.type === "RANKING"
    ? Math.max(...((rewards.posicoes || []) as any[]).map((p: any) => p.posicao || 0), 0)
    : Infinity;

  for (const d of detalhes) {
    const deveCalcular =
      mode === "comissao" ? d.participou :
      mode === "faixa" ? d.participou :
      isRankingMode ? (d.posicao !== undefined && d.posicao <= maxPosPremiada) :
      d.atingiu;

    if (!deveCalcular) {
      d.memoriaCalculo.formulaPremio = d.participou
        ? "Não classificado para premiação"
        : motivoNaoParticipouTexto(d.motivosNaoParticipacao);
      continue;
    }

    const { valor, formula } = calcularPremio(rewards, d, mode);
    let premioFinal = valor;

    // Apply per-vendedor limit
    if (limits.maxPerVendedor && premioFinal > limits.maxPerVendedor) {
      premioFinal = limits.maxPerVendedor;
      d.memoriaCalculo.passos.push(`Prêmio limitado a R$ ${formatBRL(limits.maxPerVendedor)} (limite por vendedor)`);
    }

    // Apply min cutoff
    if (limits.minCutoff && premioFinal < limits.minCutoff) {
      d.memoriaCalculo.passos.push(`Prêmio R$ ${formatBRL(premioFinal)} abaixo do mínimo R$ ${formatBRL(limits.minCutoff)} — desconsiderado`);
      premioFinal = 0;
      d.memoriaCalculo.formulaPremio = formula + ` (abaixo do corte mínimo)`;
      continue;
    }

    d.premioCalculado = valor;
    d.premioFinal = premioFinal;
    d.premiado = premioFinal > 0;
    d.memoriaCalculo.formulaPremio = formula;
    d.memoriaCalculo.passos.push(`Prêmio final: R$ ${formatBRL(premioFinal)}`);
  }

  // ── Summaries ────────────────────────────────────────────────────────────
  const totalElegiveis = detalhes.length;
  const totalParticipantes = detalhes.filter(d => d.participou).length;
  const totalAtingidos = detalhes.filter(d => d.atingiu).length;
  const totalPremiados = detalhes.filter(d => d.premiado).length;
  const valorTotalApuracao = detalhes.reduce((s, d) => s + d.valorApuracao, 0);
  const valorTotalPagamento = detalhes.reduce((s, d) => s + d.valorPagamento, 0);
  const valorTotalPremio = detalhes.filter(d => d.premiado).reduce((s, d) => s + d.premioFinal, 0);

  // ── Persist results ───────────────────────────────────────────────────────
  const resultId = randomUUID();
  const agora = new Date().toISOString();

  sqlite.prepare(`
    INSERT INTO campaign_results (
      id, campaign_id, apurado_em, apurado_por,
      periodo_inicio, periodo_fim, campaign_mode,
      total_elegiveis, total_participantes, total_atingidos, total_premiados,
      valor_total_apuracao, valor_total_pagamento, valor_total_premio, summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    resultId, campaignId, agora, actor,
    periodoInicio, periodoFim, mode,
    totalElegiveis, totalParticipantes, totalAtingidos, totalPremiados,
    valorTotalApuracao, valorTotalPagamento, valorTotalPremio,
    JSON.stringify({ rankingTipo, bases: { apuracao: describeBase(baseApuracao), pagamento: describeBase(basePagamento) } }),
  );

  const insertDetail = sqlite.prepare(`
    INSERT INTO campaign_result_details (
      id, result_id, campaign_id, vendedor_id, vendedor_nome,
      elegivel, participou, gatilho_atingido, atingiu, premiado, posicao,
      valor_apuracao, valor_pagamento, qtd_total, mix_count, gatilho_valor,
      premio_calculado, premio_final, motivos_nao_participacao, memoria_calculo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = sqlite.transaction(() => {
    for (const d of detalhes) {
      insertDetail.run(
        randomUUID(), resultId, campaignId, d.vendedorId, d.vendedorNome,
        d.elegivel ? 1 : 0, d.participou ? 1 : 0,
        d.gatilhoAtingido ? 1 : 0, d.atingiu ? 1 : 0, d.premiado ? 1 : 0,
        d.posicao ?? null,
        d.valorApuracao, d.valorPagamento, d.qtdTotal, d.mixCount, d.gatilhoValor,
        d.premioCalculado, d.premioFinal,
        JSON.stringify(d.motivosNaoParticipacao),
        JSON.stringify(d.memoriaCalculo),
      );
    }
  });
  insertAll();

  // Audit log
  sqlite.prepare(`
    INSERT INTO campaign_audit_logs (id, campaign_id, action, actor, new_values)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    randomUUID(), campaignId, "apurado", actor,
    JSON.stringify({ resultId, totalPremiados, valorTotalPremio, periodoInicio, periodoFim }),
  );

  return {
    id: resultId,
    campaignId,
    campaignName: campaign.name,
    campaignCode: campaign.code,
    apuradoEm: agora,
    apuradoPor: actor,
    periodoInicio,
    periodoFim,
    campaignMode: mode,
    totalElegiveis,
    totalParticipantes,
    totalAtingidos,
    totalPremiados,
    valorTotalApuracao,
    valorTotalPagamento,
    valorTotalPremio,
    detalhes: detalhes.map(d => ({
      vendedorId: d.vendedorId,
      vendedorNome: d.vendedorNome,
      elegivel: d.elegivel,
      participou: d.participou,
      gatilhoAtingido: d.gatilhoAtingido,
      atingiu: d.atingiu,
      premiado: d.premiado,
      posicao: d.posicao,
      valorApuracao: d.valorApuracao,
      valorPagamento: d.valorPagamento,
      qtdTotal: d.qtdTotal,
      mixCount: d.mixCount,
      gatilhoValor: d.gatilhoValor,
      premioCalculado: d.premioCalculado,
      premioFinal: d.premioFinal,
      motivosNaoParticipacao: d.motivosNaoParticipacao,
      memoriaCalculo: d.memoriaCalculo,
      crescimentoPerc: (d as any).crescimentoPerc,
    })),
  };
}

function motivoNaoParticipouTexto(motivos: string[]): string {
  if (!motivos.length) return "Sem vendas no período";
  return motivos.join("; ");
}

// ─── Get latest result ──────────────────────────────────────────────────────

export function getLatestResult(campaignId: string): ApuracaoResult | null {
  const row = sqlite.prepare(`
    SELECT * FROM campaign_results
    WHERE campaign_id = ?
    ORDER BY apurado_em DESC
    LIMIT 1
  `).get(campaignId) as any;

  if (!row) return null;

  const details = sqlite.prepare(`
    SELECT * FROM campaign_result_details
    WHERE result_id = ?
    ORDER BY posicao ASC NULLS LAST, valor_apuracao DESC
  `).all(row.id) as any[];

  const campaign = getCampaignById(campaignId);

  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignName: campaign?.name || campaignId,
    campaignCode: campaign?.code || "",
    apuradoEm: row.apurado_em,
    apuradoPor: row.apurado_por,
    periodoInicio: row.periodo_inicio,
    periodoFim: row.periodo_fim,
    campaignMode: row.campaign_mode,
    totalElegiveis: row.total_elegiveis,
    totalParticipantes: row.total_participantes,
    totalAtingidos: row.total_atingidos,
    totalPremiados: row.total_premiados,
    valorTotalApuracao: row.valor_total_apuracao,
    valorTotalPagamento: row.valor_total_pagamento,
    valorTotalPremio: row.valor_total_premio,
    detalhes: details.map(d => ({
      vendedorId: d.vendedor_id,
      vendedorNome: d.vendedor_nome,
      elegivel: Boolean(d.elegivel),
      participou: Boolean(d.participou),
      gatilhoAtingido: Boolean(d.gatilho_atingido),
      atingiu: Boolean(d.atingiu),
      premiado: Boolean(d.premiado),
      posicao: d.posicao,
      valorApuracao: d.valor_apuracao,
      valorPagamento: d.valor_pagamento,
      qtdTotal: d.qtd_total,
      mixCount: d.mix_count,
      gatilhoValor: d.gatilho_valor,
      premioCalculado: d.premio_calculado,
      premioFinal: d.premio_final,
      motivosNaoParticipacao: safeJson(d.motivos_nao_participacao, []),
      memoriaCalculo: safeJson(d.memoria_calculo, { passos: [], formulaPremio: "" }),
    })),
  };
}

export function listResults(campaignId: string) {
  return sqlite.prepare(`
    SELECT id, apurado_em, apurado_por, periodo_inicio, periodo_fim,
           total_elegiveis, total_participantes, total_atingidos, total_premiados,
           valor_total_premio, campaign_mode
    FROM campaign_results
    WHERE campaign_id = ?
    ORDER BY apurado_em DESC
  `).all(campaignId);
}

function safeJson(str: string | null, fallback: any) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}
