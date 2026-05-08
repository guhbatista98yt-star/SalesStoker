import { randomUUID } from "crypto";
import { pgAll, pgGet, pgRun } from "../pg-client";
import { BaseRepository } from "./base.repository";

export class CampaignRepository extends BaseRepository {
  private normalizeVendorId(vendedorId: string): string {
    return String(vendedorId ?? "").trim();
  }

  private vendorIdPredicate(column: string): string {
    return `TRIM(CAST(${column} AS TEXT)) = ?`;
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  async getMetasAcompanhamento(vendedorId: string): Promise<any> {
    const normalizedVendorId = this.normalizeVendorId(vendedorId);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const inicio = startOfWeek.toISOString().split('T')[0];

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const fim = endOfWeek.toISOString().split('T')[0];

    const dias_restantes = 6 - now.getDay();

    const fatLoja1 = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
      FROM cache_vendas
      WHERE "IDEMPRESA" = 1 AND ${this.vendorIdPredicate('"IDVENDEDOR"')} AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
    `, [normalizedVendorId, inicio, fim]);

    const fatLoja3 = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
      FROM cache_vendas
      WHERE "IDEMPRESA" = 3 AND ${this.vendorIdPredicate('"IDVENDEDOR"')} AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
    `, [normalizedVendorId, inicio, fim]);

    const getGoal = async (companyId: string) => {
      const row = await pgGet<{ totalGoal: number | null }>(`
        SELECT SUM("targetValue") as "totalGoal"
        FROM goals
        WHERE "salespersonId" = ? AND "companyId" = ? AND type = 'weekly' AND month = ? AND year = ?
      `, [normalizedVendorId, companyId, now.getMonth() + 1, now.getFullYear()]);
      return row?.totalGoal || 0;
    };

    const calc = (atual: number, meta: number) => {
      const percentual = meta > 0 ? (atual / meta) * 100 : 0;
      const faltante = meta > atual ? meta - atual : 0;
      return { valor_atual: atual, meta, percentual: parseFloat(percentual.toFixed(2)), faltante };
    };

    const loja1 = calc(fatLoja1?.total || 0, await getGoal('1'));
    const loja3 = calc(fatLoja3?.total || 0, await getGoal('3'));
    const total_atual = (fatLoja1?.total || 0) + (fatLoja3?.total || 0);
    const faturamento_geral = calc(total_atual, await getGoal('all'));

    const mixResult = await pgGet<{ conexoes: number; tubos: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Conexao' THEN "TOTALVENDA_LINHA" ELSE 0 END), 0) as conexoes,
        COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Tubo' THEN "TOTALVENDA_LINHA" ELSE 0 END), 0) as tubos
      FROM cache_tubos_conexoes
      WHERE ${this.vendorIdPredicate('"IDVENDEDOR"')} AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
        AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [normalizedVendorId, inicio, fim]);

    const valor_conexoes = mixResult?.conexoes || 0;
    const valor_tubos = mixResult?.tubos || 0;
    const percentual_conexoes = valor_tubos > 0 ? (valor_conexoes / valor_tubos) * 100 : 0;

    return {
      last_update: now.toISOString(),
      periodo: { tipo: 'semana', inicio, fim, dias_restantes: dias_restantes > 0 ? dias_restantes : 0 },
      loja1,
      loja3,
      faturamento: faturamento_geral,
      mix_geral: {
        percentual_conexoes: parseFloat(percentual_conexoes.toFixed(2)),
        valor_conexoes,
        valor_tubos,
      },
    };
  }

  async getMetasAmancoDTR(vendedorId: string, targetYear?: number, targetQuarter?: number): Promise<any> {
    const normalizedVendorId = this.normalizeVendorId(vendedorId);
    const now = new Date();
    const year = targetYear ?? now.getFullYear();
    const quarter = targetQuarter ?? Math.floor(now.getMonth() / 3);
    const quarterStartMonth = quarter * 3;
    const quarterEndMonth = quarterStartMonth + 2;

    const inicioStr = this.formatLocalDate(new Date(year, quarterStartMonth, 1));
    const fimStr = this.formatLocalDate(new Date(year, quarterEndMonth + 1, 0));
    const isEncerrado = now > new Date(`${fimStr}T23:59:59`);

    const resultAtual = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE ${this.vendorIdPredicate('"IDVENDEDOR"')} AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [normalizedVendorId, inicioStr, fimStr]);

    const valor_atual = resultAtual?.total || 0;

    const resultMix = await pgGet<{ tubos: number; conexoes: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Tubo' THEN "TOTALVENDA_LINHA" ELSE 0 END), 0) as tubos,
        COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Conexao' THEN "TOTALVENDA_LINHA" ELSE 0 END), 0) as conexoes
      FROM cache_tubos_conexoes
      WHERE ${this.vendorIdPredicate('"IDVENDEDOR"')} AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
        AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [normalizedVendorId, inicioStr, fimStr]);

    const tubos = resultMix?.tubos || 0;
    const conexoes = resultMix?.conexoes || 0;
    const percentual_conexoes = tubos > 0 ? (conexoes / tubos) * 100 : 0;

    const lastYear = year - 1;
    const inicioLyStr = this.formatLocalDate(new Date(lastYear, quarterStartMonth, 1));
    const quarterEndDate = new Date(year, quarterEndMonth + 1, 0);
    // Compare same elapsed days: if quarter is still running, cap prior year at equivalent date
    const referenceDate = now < quarterEndDate ? now : quarterEndDate;
    const lyEquivalentDate = new Date(lastYear, referenceDate.getMonth(), referenceDate.getDate());
    const lyQuarterEnd = new Date(lastYear, quarterEndMonth + 1, 0);
    const fimLyStr = this.formatLocalDate(lyEquivalentDate < lyQuarterEnd ? lyEquivalentDate : lyQuarterEnd);

    const resultLy = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE ${this.vendorIdPredicate('"IDVENDEDOR"')} AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [normalizedVendorId, inicioLyStr, fimLyStr]);

    const valor_ano_anterior = resultLy?.total || 0;

    const triggerQuery = await pgGet<{ triggerValue: number }>(`
      SELECT "triggerValue" FROM campaign_goals
      WHERE "salespersonId" = ? AND "campaignName" = 'dtr_amanco' AND year = ?
    `, [normalizedVendorId, year]);

    const gatilho_individual = triggerQuery?.triggerValue || 0;
    const crescimento_percentual: number | null = valor_ano_anterior > 0
      ? ((valor_atual - valor_ano_anterior) / valor_ano_anterior) * 100
      : null;

    const resultLoja = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [inicioStr, fimStr]);
    const loja_valor_atual = resultLoja?.total || 0;

    const resultLojaLy = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [inicioLyStr, fimLyStr]);
    const loja_valor_ano_anterior = resultLojaLy?.total || 0;
    const loja_crescimento_percentual: number | null = loja_valor_ano_anterior > 0
      ? ((loja_valor_atual - loja_valor_ano_anterior) / loja_valor_ano_anterior) * 100
      : null;

    const meta_gatilho = 120000;
    const meta_mix = 40.0;
    const meta_loja = 25.0;

    const gatilho = valor_atual >= (gatilho_individual > 0 ? gatilho_individual : meta_gatilho);
    const percentual_conexoes_arredondado = parseFloat(percentual_conexoes.toFixed(2));
    const mix = percentual_conexoes_arredondado >= meta_mix;
    // Crescimento loja: se sem dados históricos, não bloqueia elegibilidade
    const crescimento_loja = loja_crescimento_percentual === null ? false : loja_crescimento_percentual >= meta_loja;
    const semDadosHistoricosLoja = loja_crescimento_percentual === null;

    const motivos: string[] = [];
    if (!gatilho) motivos.push("Abaixo do gatilho mínimo");
    if (!mix) motivos.push("Mix de conexões abaixo de 40%");
    if (semDadosHistoricosLoja) motivos.push("Sem dados históricos para crescimento da loja");
    else if (!crescimento_loja) motivos.push("Crescimento global da loja insuficiente (meta: 25%)");

    const quarterNames = ["JAN/FEV/MAR", "ABR/MAI/JUN", "JUL/AGO/SET", "OUT/NOV/DEZ"];
    const crescVendPerc = crescimento_percentual !== null ? parseFloat(crescimento_percentual.toFixed(2)) : null;
    const crescLojaPerc = loja_crescimento_percentual !== null ? parseFloat(loja_crescimento_percentual.toFixed(2)) : null;
    return {
      last_update: now.toISOString(),
      periodo: { inicio: inicioStr, fim: fimStr, nome: quarterNames[quarter], encerrado: isEncerrado },
      faturamento_amanco: {
        valor_atual,
        meta_gatilho: gatilho_individual > 0 ? gatilho_individual : meta_gatilho,
        percentual: parseFloat(((gatilho_individual > 0 ? gatilho_individual : meta_gatilho) > 0 ? (valor_atual / (gatilho_individual > 0 ? gatilho_individual : meta_gatilho)) * 100 : 0).toFixed(2)),
        faltante: gatilho ? 0 : (gatilho_individual > 0 ? gatilho_individual : meta_gatilho) - valor_atual,
        gatilho_atingido: gatilho,
      },
      crescimento_vendedor: { valor_atual, valor_ano_anterior, crescimento_percentual: crescVendPerc, sem_dados: crescimento_percentual === null, meta_percentual: 0, status_ok: crescimento_percentual !== null && crescimento_percentual >= 0, ano_anterior: lastYear },
      mix_amanco: { tubos, conexoes, percentual_conexoes: parseFloat(percentual_conexoes.toFixed(2)), meta_percentual: meta_mix, status_ok: mix },
      crescimento_loja: { loja_valor_atual, loja_valor_ano_anterior, crescimento_percentual: crescLojaPerc, sem_dados: loja_crescimento_percentual === null, meta_percentual: meta_loja, status_ok: crescimento_loja, ano_anterior: lastYear },
      elegibilidade: { gatilho, mix, crescimento_loja, participando: gatilho && mix && crescimento_loja, motivos },
    };
  }

  async getMetasAmancoTV(vendedorId: string): Promise<any> {
    const normalizedVendorId = this.normalizeVendorId(vendedorId);
    const now = new Date();
    const year = 2026;
    const inicioStr = `${year}-02-15`;
    const fimStr = `${year}-04-15`;
    const isEncerrado = now > new Date(`${fimStr}T23:59:59`);

    const resultAtual = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE ${this.vendorIdPredicate('"IDVENDEDOR"')} AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [normalizedVendorId, inicioStr, fimStr]);

    const valor_atual = resultAtual?.total || 0;

    const resultMix = await pgGet<{ tubos: number; conexoes: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Tubo' THEN "TOTALVENDA_LINHA" ELSE 0 END), 0) as tubos,
        COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Conexao' THEN "TOTALVENDA_LINHA" ELSE 0 END), 0) as conexoes
      FROM cache_tubos_conexoes
      WHERE ${this.vendorIdPredicate('"IDVENDEDOR"')} AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
        AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [normalizedVendorId, inicioStr, fimStr]);

    const tubos = resultMix?.tubos || 0;
    const conexoes = resultMix?.conexoes || 0;
    const percentual_conexoes = tubos > 0 ? (conexoes / tubos) * 100 : 0;

    const lastYear = year - 1;
    const inicioLyStr = `${lastYear}-02-15`;
    const fimLyStr = `${lastYear}-04-15`;

    const resultLy = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE ${this.vendorIdPredicate('"IDVENDEDOR"')} AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [normalizedVendorId, inicioLyStr, fimLyStr]);

    const valor_ano_anterior = resultLy?.total || 0;

    const triggerQuery = await pgGet<{ triggerValue: number }>(`
      SELECT "triggerValue" FROM campaign_goals
      WHERE "salespersonId" = ? AND "campaignName" = 'tv_amanco' AND year = ?
    `, [normalizedVendorId, year]);

    const gatilho_individual = triggerQuery?.triggerValue || 0;
    const crescimento_percentual: number | null = valor_ano_anterior > 0
      ? ((valor_atual - valor_ano_anterior) / valor_ano_anterior) * 100
      : null;

    const resultLoja = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [inicioStr, fimStr]);
    const loja_valor_atual = resultLoja?.total || 0;

    const resultLojaLy = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND UPPER("FABRICANTE") LIKE 'AMANCO%'
    `, [inicioLyStr, fimLyStr]);
    const loja_valor_ano_anterior = resultLojaLy?.total || 0;
    const loja_crescimento_percentual: number | null = loja_valor_ano_anterior > 0
      ? ((loja_valor_atual - loja_valor_ano_anterior) / loja_valor_ano_anterior) * 100
      : null;

    const meta_gatilho = 60000;
    const meta_mix = 45.0;
    const meta_crescimento_vendedor = 20.0;
    const meta_loja = 25.0;

    const gatilho = valor_atual >= (gatilho_individual > 0 ? gatilho_individual : meta_gatilho);
    const crescimento_vendedor_ok = crescimento_percentual !== null && crescimento_percentual >= meta_crescimento_vendedor;
    const semDadosHistoricosCrescimento = crescimento_percentual === null;
    const percentual_conexoes_arredondado = parseFloat(percentual_conexoes.toFixed(2));
    const mix = percentual_conexoes_arredondado >= meta_mix;
    const crescimento_loja_ok = loja_crescimento_percentual !== null && loja_crescimento_percentual >= meta_loja;
    const semDadosHistoricosLoja = loja_crescimento_percentual === null;

    const motivos: string[] = [];
    if (!gatilho) motivos.push("Abaixo do gatilho mínimo");
    if (semDadosHistoricosCrescimento) motivos.push("Sem dados históricos para crescimento do vendedor");
    else if (!crescimento_vendedor_ok) motivos.push("Crescimento vs. ano anterior abaixo de 20%");
    if (!mix) motivos.push("Mix de conexões abaixo de 45%");
    if (semDadosHistoricosLoja) motivos.push("Sem dados históricos para crescimento da loja");
    else if (!crescimento_loja_ok) motivos.push("Crescimento global da loja insuficiente (meta: 25%)");

    const crescVendPerc = crescimento_percentual !== null ? parseFloat(crescimento_percentual.toFixed(2)) : null;
    const crescLojaPerc = loja_crescimento_percentual !== null ? parseFloat(loja_crescimento_percentual.toFixed(2)) : null;

    return {
      last_update: now.toISOString(),
      periodo: { inicio: inicioStr, fim: fimStr, encerrado: isEncerrado },
      faturamento_amanco: {
        valor_atual,
        meta_gatilho: gatilho_individual > 0 ? gatilho_individual : meta_gatilho,
        percentual: parseFloat(((gatilho_individual > 0 ? gatilho_individual : meta_gatilho) > 0 ? (valor_atual / (gatilho_individual > 0 ? gatilho_individual : meta_gatilho)) * 100 : 0).toFixed(2)),
        faltante: gatilho ? 0 : (gatilho_individual > 0 ? gatilho_individual : meta_gatilho) - valor_atual,
        gatilho_atingido: gatilho,
      },
      crescimento_vendedor: { valor_atual, valor_ano_anterior, crescimento_percentual: crescVendPerc, sem_dados: semDadosHistoricosCrescimento, meta_percentual: meta_crescimento_vendedor, status_ok: crescimento_vendedor_ok },
      mix_amanco: { tubos, conexoes, percentual_conexoes: parseFloat(percentual_conexoes.toFixed(2)), meta_percentual: meta_mix, status_ok: mix },
      crescimento_loja: { loja_valor_atual, loja_valor_ano_anterior, crescimento_percentual: crescLojaPerc, sem_dados: semDadosHistoricosLoja, meta_percentual: meta_loja, status_ok: crescimento_loja_ok },
      elegibilidade: { gatilho, crescimento_vendedor: crescimento_vendedor_ok, mix, crescimento_loja: crescimento_loja_ok, participando: gatilho && crescimento_vendedor_ok && mix && crescimento_loja_ok, motivos },
    };
  }

  async getMetasElit(vendedorId: string): Promise<any> {
    const normalizedVendorId = this.normalizeVendorId(vendedorId);
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    let daysSinceSaturday: number;

    if (currentDayOfWeek === 6) { daysSinceSaturday = 7; }
    else if (currentDayOfWeek === 0) { daysSinceSaturday = 8; }
    else { daysSinceSaturday = currentDayOfWeek + 1; }

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysSinceSaturday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const payoutDate = new Date(endOfWeek);
    payoutDate.setDate(endOfWeek.getDate() + 1);

    const inicioStr = this.formatLocalDate(startOfWeek);
    const fimStr = this.formatLocalDate(endOfWeek);
    const pagStr = this.formatLocalDate(payoutDate);

    const result = await pgAll<{ total: number; DESCRICAOPRODUTO: string; qty: number }>(`
      SELECT
        COALESCE(SUM("VALOR_LIQUIDO"), 0) as total,
        "IDPRODUTO" as "DESCRICAOPRODUTO",
        SUM("QTD") as qty
      FROM cache_campanhas
      WHERE ${this.vendorIdPredicate('"IDVENDEDOR"')} AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND ("FABRICANTE" IS NULL OR UPPER("FABRICANTE") NOT LIKE 'AMANCO%')
      GROUP BY "IDPRODUTO"
    `, [normalizedVendorId, inicioStr, fimStr]);

    const valor_vendido = result.reduce((acc, curr) => acc + curr.total, 0);

    const goalsRows = await pgAll<{ triggerValue: number }>(`
      SELECT "triggerValue" FROM campaign_goals WHERE "salespersonId" = ? AND "campaignName" = 'elit' AND year = ?
    `, [normalizedVendorId, now.getFullYear()]);
    const gatilho_minimo = goalsRows.length > 0 ? goalsRows[0].triggerValue : 3000.0;

    const participando = valor_vendido >= gatilho_minimo;
    const faltante = participando ? 0 : gatilho_minimo - valor_vendido;

    let total_receber = 0;
    const detalhes = [];

    const commissionMap: Record<string, number> = {
      "BORRACHA LIQ. SEMIACET. 21,5KG": 10.0, "TINTA EMBORR. 18KG": 7.0,
      "IMPERMEABILIZANTE 18KG": 5.0, "IMPERMEABILIZANTE GL": 5.0,
      "TINTA DIRETO GESSO 18L": 5.0, "TINTA DIRETO GESSO GL": 5.0,
      "TEXTURA RUSTIC. 23KG": 3.0, "MASSA ACRILICA": 2.0,
      "TEXTURA LISA 23KG": 2.0, "TINTA ESM. (BASE AGUA) 3,6L": 3.0,
      "TINTA ESM. 3,6L": 2.0, "TINTA ESM. 900ML": 0.50,
      "TINTA PISO 18L": 3.0, "TINTA PISO 15L": 3.0, "TINTA PISO 3,6L": 2.0,
      "TINTA SUPER REND. 20L": 4.0, "TINTA SUPER REND. 18L": 3.0,
      "TINTA SUPER COMPL 18L": 3.0, "TINTA SUPER REND. 15L": 2.0,
      "TINTA SUPER REND. SEMIBRILHO 15L": 2.0, "TINTA SUPER REND. 3,6L": 1.50,
      "TINTA SUPER COMPL 3,6L": 2.0, "TINTA VINIL ACR. 18L": 3.0,
      "TINTA VINIL ACR. 15L": 2.0, "TINTA VINIL ACR. 3,6L": 0.50,
      "VERNIZ COPAL 3,6L": 2.0, "VERNIZ MARITIMO 3,6L": 2.0, "ZARCAO 3,6L": 2.0,
      "VERNIZ COPAL 900ML": 0.50, "VERNIZ MARITIMO 900ML": 0.50, "ZARCAO 900ML": 0.50,
      "HIPERFLOOR DEMAR. VIARIA BASE SOLV. 18L": 3.0,
      "TINTA CLAS. 18L": 3.0, "TINTA CLAS. 3,6L": 2.0,
      "TINTA PROFIS. 18L": 2.0, "TINTA ACRI. MAX PROF. 18L": 2.0,
      "TINTA SUBLIME 18L": 2.0, "TINTA ACRI. MAX PROF. 3,6L": 1.0,
      "TINTA PROFIS. 3,6L": 1.0, "SELADOR ESM. (BASE AGUA) GL": 2.0,
    };

    const isExcluded = (desc: string): boolean =>
      desc.includes("FUNDO PREPARADOR") || desc.includes("REJUNTE") || desc.includes("RESINA") ||
      desc.includes("SELADOR") || desc.includes("THINNER") || desc.includes("112,5ML");

    const getElitCommission = (desc: string): number => {
      const d = desc.toUpperCase();
      if (isExcluded(d) && !d.includes("SELADOR ESM. (BASE AGUA) GL")) return 0;
      if (d.includes("TINTA SUPER REND. 3,6L")) {
        if (d.includes("SEMIBRILHO")) return 2.0;
        return commissionMap["TINTA SUPER REND. 3,6L"] || 1.50;
      }
      for (const [key, val] of Object.entries(commissionMap)) {
        if (d.includes(key)) return val;
      }
      return 0;
    };

    for (const item of result) {
      if (!item.DESCRICAOPRODUTO) continue;
      const commission = getElitCommission(item.DESCRICAOPRODUTO);
      if (commission > 0 && item.qty > 0) {
        const premio = commission * (item.qty || 0);
        total_receber += premio;
        detalhes.push({
          produto: item.DESCRICAOPRODUTO,
          qty: item.qty,
          comissao_unit: commission,
          premio,
        });
      }
    }

    total_receber = participando ? total_receber : 0;

    return {
      last_update: now.toISOString(),
      periodo: { inicio: inicioStr, fim: fimStr, pagamento: pagStr, pagamento_em: pagStr },
      gatilho_minimo,
      valor_vendido,
      faltante,
      participando,
      elegibilidade: { participando, valor_vendido, gatilho_minimo, faltante },
      premiacao: { total_receber, detalhes },
    };
  }

  async getCampaignGoals(campaignName: string, year: number): Promise<{ salespersonId: string; triggerValue: number }[]> {
    try {
      const rows = await pgAll<{ salespersonId: string; triggerValue: number }>(`
        SELECT "salespersonId", "triggerValue"
        FROM campaign_goals
        WHERE "campaignName" = ? AND year = ?
      `, [campaignName, year]);
      return rows;
    } catch {
      return [];
    }
  }

  async saveCampaignGoals(campaignName: string, year: number, goals: { salespersonId: string; triggerValue: number }[]): Promise<void> {
    for (const g of goals) {
      const existing = await pgGet(`
        SELECT id FROM campaign_goals WHERE "salespersonId" = ? AND "campaignName" = ? AND year = ?
      `, [g.salespersonId, campaignName, year]);

      if (existing) {
        await pgRun(`
          UPDATE campaign_goals SET "triggerValue" = ? WHERE "salespersonId" = ? AND "campaignName" = ? AND year = ?
        `, [g.triggerValue, g.salespersonId, campaignName, year]);
      } else {
        await pgRun(`
          INSERT INTO campaign_goals (id, "salespersonId", "campaignName", year, "triggerValue")
          VALUES (?, ?, ?, ?, ?)
        `, [randomUUID(), g.salespersonId, campaignName, year, g.triggerValue]);
      }
    }
  }

  async getCampaignReport(campaignName: string): Promise<any[]> {
    try {
      const rows = await pgAll(`
        SELECT * FROM campaign_result_details
        WHERE campaign_id IN (SELECT id FROM campaigns WHERE name = ?)
        ORDER BY posicao ASC
      `, [campaignName]);
      return rows;
    } catch {
      return [];
    }
  }
}
