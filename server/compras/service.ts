/**
 * Copiloto de Compras — Service Layer
 *
 * Funções de negócio para:
 *   - Dashboard KPIs de compras
 *   - Ranking de fornecedores por criticidade
 *   - Ranking de produtos críticos
 *   - Detalhe de fornecedor
 *   - Detalhe de produto
 *   - Simulação de compra
 *   - Notificações de compras do usuário
 */

import { pgGet, pgAll, pgRun } from "../pg-client";
import { randomUUID } from "crypto";
import {
  calcularTodasSugestoes,
  calcularSugestoesPorFornecedor,
  calcularSugestaoProduto,
  simularCompra,
  type ProductSuggestion,
  type SuggestionEngineConfig,
} from "./suggestion-engine";

export interface ComprasDashboardKPIs {
  totalFornecedores: number;
  totalProdutosCriticos: number;
  totalAlertasAtivos: number;
  totalSugestoesPendentes: number;
  valorEstimadoCompra: number;
  produtosRuptura: number;
  produtosAbaixoSeguranca: number;
  produtosExcesso: number;
  distribuicaoUrgencia: {
    critica: number;
    alta: number;
    media: number;
    baixa: number;
    ok: number;
  };
  fornecedoresCriticos: Array<{
    fabricante: string;
    skusCriticos: number;
    urgenciaMaxima: string;
  }>;
}

export interface FornecedorRankingItem {
  fabricante: string;
  totalSkus: number;
  skusCriticos: number;
  skusAlerta: number;
  skusOk: number;
  criticidadeMedia: number;
  urgenciaMaxima: string;
  coberturaMediaDias: number;
  consumoMedioDiario: number;
}

export interface ProdutoRankingItem {
  produtoId: string;
  produtoNome: string;
  fabricante: string;
  urgencia: string;
  criticidade: number;
  coberturaDias: number;
  pontoReposicao: number;
  consumoMedioDiario: number;
  quantidadeSugerida: number;
  estoqueAtual: number;
}

async function getSugestoesComConfig(): Promise<ProductSuggestion[]> {
  const config = await pgGet<{ valor: string }>(
    `SELECT valor FROM purchase_settings WHERE chave = 'engine_config'`,
  );

  let engineCfg: Partial<SuggestionEngineConfig> = {};
  if (config?.valor) {
    try {
      engineCfg = JSON.parse(config.valor);
    } catch {
      /* usa padrão */
    }
  }

  return calcularTodasSugestoes(engineCfg);
}

export async function getDashboardKPIs(): Promise<ComprasDashboardKPIs> {
  const sugestoes = await getSugestoesComConfig();

  const alertasAtivos = await pgGet<{ total: number }>(
    `SELECT COUNT(*) as total FROM purchase_alerts WHERE status NOT IN ('resolvido', 'silenciado')`,
  );

  const distribuicao = { critica: 0, alta: 0, media: 0, baixa: 0, ok: 0 };
  let produtosRuptura = 0;
  let produtosAbaixoSeguranca = 0;
  let produtosExcesso = 0;
  let valorEstimadoCompra = 0;

  const fabricantesMap = new Map<
    string,
    { skusCriticos: number; urgencias: string[] }
  >();

  for (const s of sugestoes) {
    distribuicao[s.urgencia] = (distribuicao[s.urgencia] ?? 0) + 1;

    if (s.coberturaDias <= 0 || s.coberturaDias <= s.leadTimeDias) produtosRuptura++;
    if (s.estoqueAtual < s.estoqueSeguranca && s.estoqueSeguranca > 0) produtosAbaixoSeguranca++;
    if (s.coberturaDias > s.coberturaAlvoDias * 3 && s.consumoMedioDiario > 0) produtosExcesso++;

    if (s.quantidadeSugerida > 0) {
      valorEstimadoCompra += s.quantidadeSugerida;
    }

    if (!fabricantesMap.has(s.fabricante)) {
      fabricantesMap.set(s.fabricante, { skusCriticos: 0, urgencias: [] });
    }
    const fab = fabricantesMap.get(s.fabricante)!;
    fab.urgencias.push(s.urgencia);
    if (s.urgencia === "critica" || s.urgencia === "alta") fab.skusCriticos++;
  }

  const urgenciaOrder: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3, ok: 4 };
  const fornecedoresCriticos: Array<{
    fabricante: string;
    skusCriticos: number;
    urgenciaMaxima: string;
  }> = [];

  for (const [fab, data] of Array.from(fabricantesMap.entries())) {
    if (data.skusCriticos > 0) {
      const urgenciaMaxima = data.urgencias.sort(
        (a: string, b: string) => (urgenciaOrder[a] ?? 5) - (urgenciaOrder[b] ?? 5),
      )[0];
      fornecedoresCriticos.push({
        fabricante: fab,
        skusCriticos: data.skusCriticos,
        urgenciaMaxima,
      });
    }
  }

  fornecedoresCriticos.sort((a, b) => b.skusCriticos - a.skusCriticos);

  return {
    totalFornecedores: fabricantesMap.size,
    totalProdutosCriticos: distribuicao.critica + distribuicao.alta,
    totalAlertasAtivos: Number(alertasAtivos?.total ?? 0),
    totalSugestoesPendentes: sugestoes.filter((s) => s.quantidadeSugerida > 0).length,
    valorEstimadoCompra: Math.round(valorEstimadoCompra),
    produtosRuptura,
    produtosAbaixoSeguranca,
    produtosExcesso,
    distribuicaoUrgencia: distribuicao,
    fornecedoresCriticos: fornecedoresCriticos.slice(0, 10),
  };
}

export async function getRankingFornecedores(): Promise<FornecedorRankingItem[]> {
  const sugestoes = await getSugestoesComConfig();

  const fabricantesMap = new Map<string, ProductSuggestion[]>();
  for (const s of sugestoes) {
    if (!fabricantesMap.has(s.fabricante)) fabricantesMap.set(s.fabricante, []);
    fabricantesMap.get(s.fabricante)!.push(s);
  }

  const urgenciaOrder: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3, ok: 4 };

  const ranking: FornecedorRankingItem[] = [];
  for (const [fab, skus] of Array.from(fabricantesMap.entries())) {
    const skusCriticos = skus.filter(
      (s: ProductSuggestion) => s.urgencia === "critica" || s.urgencia === "alta",
    ).length;
    const skusAlerta = skus.filter((s: ProductSuggestion) => s.urgencia === "media").length;
    const skusOk = skus.filter((s: ProductSuggestion) => s.urgencia === "baixa" || s.urgencia === "ok").length;
    const criticidadeMedia =
      skus.reduce((sum: number, s: ProductSuggestion) => sum + s.criticidade, 0) / Math.max(1, skus.length);
    const coberturaMedia =
      skus.reduce((sum: number, s: ProductSuggestion) => sum + s.coberturaDias, 0) / Math.max(1, skus.length);
    const consumoTotal = skus.reduce((sum: number, s: ProductSuggestion) => sum + s.consumoMedioDiario, 0);
    const urgenciaMaxima = skus
      .map((s: ProductSuggestion) => s.urgencia)
      .sort((a: string, b: string) => (urgenciaOrder[a] ?? 5) - (urgenciaOrder[b] ?? 5))[0];

    ranking.push({
      fabricante: fab,
      totalSkus: skus.length,
      skusCriticos,
      skusAlerta,
      skusOk,
      criticidadeMedia: Math.round(criticidadeMedia),
      urgenciaMaxima,
      coberturaMediaDias: Math.round(coberturaMedia * 10) / 10,
      consumoMedioDiario: Math.round(consumoTotal * 100) / 100,
    });
  }

  return ranking.sort((a, b) => b.criticidadeMedia - a.criticidadeMedia);
}

export async function getDetalheFornecedor(fabricante: string): Promise<{
  fabricante: string;
  ranking: FornecedorRankingItem | null;
  produtos: ProdutoRankingItem[];
  alertas: any[];
}> {
  const config = await pgGet<{ valor: string }>(
    `SELECT valor FROM purchase_settings WHERE chave = 'engine_config'`,
  );
  let engineCfg: Partial<SuggestionEngineConfig> = {};
  if (config?.valor) {
    try {
      engineCfg = JSON.parse(config.valor);
    } catch {
      /* usa padrão */
    }
  }

  const sugestoes = await calcularSugestoesPorFornecedor(fabricante, engineCfg);
  const alertas = await pgAll<any>(
    `SELECT * FROM purchase_alerts
     WHERE fabricante = ? AND status NOT IN ('resolvido', 'silenciado')
     ORDER BY created_at DESC`,
    [fabricante],
  );

  const urgenciaOrder: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3, ok: 4 };
  const urgenciaMaxima = sugestoes
    .map((s) => s.urgencia)
    .sort((a, b) => (urgenciaOrder[a] ?? 5) - (urgenciaOrder[b] ?? 5))[0];

  const rankingItem: FornecedorRankingItem | null =
    sugestoes.length > 0
      ? {
          fabricante,
          totalSkus: sugestoes.length,
          skusCriticos: sugestoes.filter(
            (s) => s.urgencia === "critica" || s.urgencia === "alta",
          ).length,
          skusAlerta: sugestoes.filter((s) => s.urgencia === "media").length,
          skusOk: sugestoes.filter((s) => s.urgencia === "baixa" || s.urgencia === "ok").length,
          criticidadeMedia: Math.round(
            sugestoes.reduce((sum, s) => sum + s.criticidade, 0) / sugestoes.length,
          ),
          urgenciaMaxima,
          coberturaMediaDias:
            Math.round(
              (sugestoes.reduce((sum, s) => sum + s.coberturaDias, 0) / sugestoes.length) * 10,
            ) / 10,
          consumoMedioDiario:
            Math.round(
              sugestoes.reduce((sum, s) => sum + s.consumoMedioDiario, 0) * 100,
            ) / 100,
        }
      : null;

  const produtos: ProdutoRankingItem[] = sugestoes.map((s) => ({
    produtoId: s.produtoId,
    produtoNome: s.produtoNome,
    fabricante: s.fabricante,
    urgencia: s.urgencia,
    criticidade: s.criticidade,
    coberturaDias: s.coberturaDias,
    pontoReposicao: s.pontoReposicao,
    consumoMedioDiario: s.consumoMedioDiario,
    quantidadeSugerida: s.quantidadeSugerida,
    estoqueAtual: s.estoqueAtual,
  }));

  return {
    fabricante,
    ranking: rankingItem,
    produtos: produtos.sort((a, b) => b.criticidade - a.criticidade),
    alertas: alertas.map((a) => ({
      ...a,
      dados: safeJson(a.dados, {}),
    })),
  };
}

export async function getRankingProdutos(
  filtros: { urgencia?: string; fabricante?: string } = {},
): Promise<ProdutoRankingItem[]> {
  const sugestoes = await getSugestoesComConfig();

  let filtered = sugestoes;
  if (filtros.urgencia) filtered = filtered.filter((s) => s.urgencia === filtros.urgencia);
  if (filtros.fabricante) filtered = filtered.filter((s) => s.fabricante === filtros.fabricante);

  return filtered
    .sort((a, b) => b.criticidade - a.criticidade)
    .map((s) => ({
      produtoId: s.produtoId,
      produtoNome: s.produtoNome,
      fabricante: s.fabricante,
      urgencia: s.urgencia,
      criticidade: s.criticidade,
      coberturaDias: s.coberturaDias,
      pontoReposicao: s.pontoReposicao,
      consumoMedioDiario: s.consumoMedioDiario,
      quantidadeSugerida: s.quantidadeSugerida,
      estoqueAtual: s.estoqueAtual,
    }));
}

export async function getDetalheProduto(produtoId: string): Promise<{
  sugestao: ProductSuggestion | null;
  alertas: any[];
  historico: any[];
}> {
  const sugestao = await calcularSugestaoProduto(produtoId);
  const alertas = await pgAll<any>(
    `SELECT * FROM purchase_alerts
     WHERE produto_id = ? AND status NOT IN ('resolvido', 'silenciado')
     ORDER BY created_at DESC`,
    [produtoId],
  );

  const historico = await pgAll<{ total_vendido: number; periodo: string }>(
    `SELECT
       TO_CHAR("DTMOVIMENTO", 'YYYY-MM') as periodo,
       COALESCE(SUM("QTD"), 0) as total_vendido
     FROM cache_campanhas
     WHERE "IDPRODUTO" = ?
       AND "DTMOVIMENTO" >= CURRENT_DATE - INTERVAL '6 months'
     GROUP BY TO_CHAR("DTMOVIMENTO", 'YYYY-MM')
     ORDER BY periodo DESC`,
    [produtoId],
  );

  return {
    sugestao,
    alertas: alertas.map((a) => ({ ...a, dados: safeJson(a.dados, {}) })),
    historico,
  };
}

export async function getSugestoes(
  filtros: { urgencia?: string; fabricante?: string } = {},
): Promise<ProductSuggestion[]> {
  const sugestoes = await getSugestoesComConfig();

  let filtered = sugestoes.filter((s) => s.quantidadeSugerida > 0 || s.urgencia !== "ok");
  if (filtros.urgencia) filtered = filtered.filter((s) => s.urgencia === filtros.urgencia);
  if (filtros.fabricante) filtered = filtered.filter((s) => s.fabricante === filtros.fabricante);

  return filtered.sort((a, b) => b.criticidade - a.criticidade);
}

export async function getSugestoesPorFornecedor(
  fabricante: string,
): Promise<ProductSuggestion[]> {
  const config = await pgGet<{ valor: string }>(
    `SELECT valor FROM purchase_settings WHERE chave = 'engine_config'`,
  );
  let engineCfg: Partial<SuggestionEngineConfig> = {};
  if (config?.valor) {
    try {
      engineCfg = JSON.parse(config.valor);
    } catch {
      /* usa padrão */
    }
  }
  return calcularSugestoesPorFornecedor(fabricante, engineCfg);
}

export interface SimulacaoResultado {
  antes: { produtoId: string; coberturaDias: number; urgencia: string }[];
  depois: { produtoId: string; coberturaDias: number; urgencia: string }[];
  totalProdutos: number;
  produtosMelhorados: number;
  resumo: string;
}

export async function runSimulacao(
  produtoIds: string[],
  quantidades: Record<string, number>,
): Promise<SimulacaoResultado> {
  const sugestoes: ProductSuggestion[] = [];

  for (const id of produtoIds) {
    const s = await calcularSugestaoProduto(id);
    if (s) sugestoes.push(s);
  }

  if (sugestoes.length === 0) {
    return {
      antes: [],
      depois: [],
      totalProdutos: 0,
      produtosMelhorados: 0,
      resumo: "Nenhum produto encontrado para simulação.",
    };
  }

  const resultado = await simularCompra(sugestoes, quantidades);

  return {
    antes: resultado.antes,
    depois: resultado.depois,
    totalProdutos: resultado.totalProdutos,
    produtosMelhorados: resultado.produtosMelhorados,
    resumo: `${resultado.produtosMelhorados} de ${resultado.totalProdutos} produtos melhorariam sua situação de estoque com esta compra.`,
  };
}

export async function getAlertas(filtros: {
  status?: string;
  tipo?: string;
  fabricante?: string;
  severidade?: string;
} = {}): Promise<any[]> {
  let sql = `SELECT * FROM purchase_alerts WHERE 1=1`;
  const params: any[] = [];

  if (filtros.status) {
    sql += ` AND status = ?`;
    params.push(filtros.status);
  } else {
    // 'silenciado' foi removido como status global — silenciamento é agora por usuário
    // via alert_delivery_state.silenciado_em
    sql += ` AND status NOT IN ('resolvido')`;
  }
  if (filtros.tipo) {
    sql += ` AND tipo = ?`;
    params.push(filtros.tipo);
  }
  if (filtros.fabricante) {
    sql += ` AND fabricante = ?`;
    params.push(filtros.fabricante);
  }
  if (filtros.severidade) {
    sql += ` AND severidade = ?`;
    params.push(filtros.severidade);
  }

  sql += ` ORDER BY
    CASE severidade
      WHEN 'critical' THEN 0
      WHEN 'warning' THEN 1
      ELSE 2
    END,
    created_at DESC`;

  const rows = await pgAll<any>(sql, params);
  return rows.map((r) => ({ ...r, dados: safeJson(r.dados, {}) }));
}

export async function getNotificacoesUsuario(userId: number): Promise<any[]> {
  const prefs = await pgGet<{ configuracoes: string }>(
    `SELECT configuracoes FROM user_alert_preferences WHERE user_id = ?`,
    [userId],
  );

  // Exclui alertas que este usuário silenciou (via alert_delivery_state.silenciado_em)
  // e alertas globalmente resolvidos. Outros usuários continuam recebendo alertas não silenciados.
  const rows = await pgAll<any>(
    `SELECT pa.*, pad.user_id as delivered_to, pad.lido_em, pad.silenciado_em
     FROM purchase_alerts pa
     LEFT JOIN alert_delivery_state pad ON pad.alert_id = pa.id AND pad.user_id = ?
     WHERE pa.status NOT IN ('resolvido')
       AND pad.silenciado_em IS NULL
     ORDER BY pa.created_at DESC
     LIMIT 50`,
    [userId],
  );

  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    titulo: r.titulo,
    mensagem: r.mensagem,
    severidade: r.severidade,
    status: r.status,
    lida: !!r.lido_em,
    lidaEm: r.lido_em,
    createdAt: r.created_at,
    dados: safeJson(r.dados, {}),
  }));
}

/**
 * Verifica se o alerta está visível para o usuário (foi entregue ou é novo para ele).
 * Alertas globais (sem user_id específico) são visíveis a todos os usuários autenticados.
 * Usamos alert_delivery_state para rastrear visibilidade por usuário.
 * Retorna o alerta se acessível, null se não encontrado ou sem acesso.
 */
async function getAlertaParaUsuario(
  alertId: string,
  userId: number,
): Promise<{ id: string; status: string } | null> {
  // Busca o alerta (alertas de compras são globais e visíveis a todos os usuários logados)
  const alert = await pgGet<{ id: string; status: string; user_id: number | null }>(
    `SELECT id, status, user_id FROM purchase_alerts WHERE id = ?`,
    [alertId],
  );
  if (!alert) return null;

  // Alertas sem user_id são globais — qualquer usuário autenticado pode interagir
  // Alertas com user_id específico só podem ser manipulados pelo próprio usuário
  if (alert.user_id !== null && alert.user_id !== userId) return null;

  return alert;
}

export async function marcarNotificacaoLida(
  alertId: string,
  userId: number,
): Promise<boolean> {
  const alert = await getAlertaParaUsuario(alertId, userId);
  if (!alert) return false;

  const now = new Date().toISOString();
  const existing = await pgGet<{ id: string }>(
    `SELECT id FROM alert_delivery_state WHERE alert_id = ? AND user_id = ?`,
    [alertId, userId],
  );

  if (existing) {
    await pgRun(
      `UPDATE alert_delivery_state SET lido_em = ?, updated_at = ? WHERE alert_id = ? AND user_id = ?`,
      [now, now, alertId, userId],
    );
  } else {
    await pgRun(
      `INSERT INTO alert_delivery_state (id, alert_id, user_id, lido_em, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), alertId, userId, now, now, now],
    );
  }

  // Marca o alerta global como lido apenas se ainda estava novo
  await pgRun(
    `UPDATE purchase_alerts SET status = 'lido', updated_at = ? WHERE id = ? AND status = 'novo'`,
    [now, alertId],
  );

  return true;
}

export async function silenciarAlerta(
  alertId: string,
  userId: number,
  motivo?: string,
): Promise<boolean> {
  const alert = await getAlertaParaUsuario(alertId, userId);
  if (!alert) return false;

  const now = new Date().toISOString();

  // Silenciamento é POR USUÁRIO — gravado em alert_delivery_state para não afetar outros usuários.
  // O status global do alerta permanece inalterado; apenas este usuário deixa de recebê-lo.
  await pgRun(
    `INSERT INTO alert_delivery_state (id, alert_id, user_id, silenciado_em, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (alert_id, user_id) DO UPDATE SET silenciado_em = excluded.silenciado_em, updated_at = excluded.updated_at`,
    [randomUUID(), alertId, userId, now, now, now],
  );
  await pgRun(
    `INSERT INTO purchase_alert_events (id, alert_id, evento, dados, created_at)
     VALUES (?, ?, 'silenciado_usuario', ?, ?)`,
    [randomUUID(), alertId, JSON.stringify({ userId, motivo }), now],
  );

  return true;
}

export async function reconhecerAlerta(alertId: string, userId: number): Promise<boolean> {
  const alert = await getAlertaParaUsuario(alertId, userId);
  if (!alert) return false;

  const now = new Date().toISOString();
  await pgRun(
    `UPDATE purchase_alerts SET status = 'reconhecido', updated_at = ? WHERE id = ?`,
    [now, alertId],
  );
  await pgRun(
    `INSERT INTO purchase_alert_events (id, alert_id, evento, dados, created_at)
     VALUES (?, ?, 'reconhecido', ?, ?)`,
    [randomUUID(), alertId, JSON.stringify({ userId }), now],
  );

  await pgRun(
    `INSERT INTO alert_acknowledgements (id, alert_id, user_id, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (alert_id, user_id) DO NOTHING`,
    [randomUUID(), alertId, userId, now],
  );

  return true;
}

export async function adiarAlerta(
  alertId: string,
  userId: number,
  snoozeAte: string,
): Promise<boolean> {
  const alert = await getAlertaParaUsuario(alertId, userId);
  if (!alert) return false;

  const now = new Date().toISOString();
  await pgRun(
    `UPDATE purchase_alerts SET status = 'adiado', updated_at = ? WHERE id = ?`,
    [now, alertId],
  );
  await pgRun(
    `INSERT INTO alert_snoozes (id, alert_id, user_id, snooze_ate, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), alertId, userId, snoozeAte, now],
  );

  return true;
}

export async function getConfiguracoes(userId: number): Promise<Record<string, any>> {
  const prefs = await pgGet<{ configuracoes: string }>(
    `SELECT configuracoes FROM user_alert_preferences WHERE user_id = ?`,
    [userId],
  );
  const sound = await pgGet<{ configuracoes: string }>(
    `SELECT configuracoes FROM alert_sound_preferences WHERE user_id = ?`,
    [userId],
  );
  const globalConfig = await pgAll<{ chave: string; valor: string }>(
    `SELECT chave, valor FROM purchase_settings`,
  );

  const configMap: Record<string, any> = {};
  for (const row of globalConfig) {
    try {
      configMap[row.chave] = JSON.parse(row.valor);
    } catch {
      configMap[row.chave] = row.valor;
    }
  }

  return {
    alertas: safeJson(prefs?.configuracoes ?? null, {}),
    som: safeJson(sound?.configuracoes ?? null, {}),
    global: configMap,
  };
}

/**
 * Salva preferências pessoais do usuário (alertas e som).
 * Qualquer usuário autenticado pode atualizar suas próprias preferências.
 */
export async function salvarPreferenciasUsuario(
  userId: number,
  body: { alertas?: Record<string, unknown>; som?: Record<string, unknown> },
): Promise<void> {
  const now = new Date().toISOString();

  if (body.alertas !== undefined) {
    const existing = await pgGet<{ user_id: number }>(
      `SELECT user_id FROM user_alert_preferences WHERE user_id = ?`,
      [userId],
    );
    if (existing) {
      await pgRun(
        `UPDATE user_alert_preferences SET configuracoes = ?, updated_at = ? WHERE user_id = ?`,
        [JSON.stringify(body.alertas), now, userId],
      );
    } else {
      await pgRun(
        `INSERT INTO user_alert_preferences (id, user_id, configuracoes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), userId, JSON.stringify(body.alertas), now, now],
      );
    }
  }

  if (body.som !== undefined) {
    const existing = await pgGet<{ user_id: number }>(
      `SELECT user_id FROM alert_sound_preferences WHERE user_id = ?`,
      [userId],
    );
    if (existing) {
      await pgRun(
        `UPDATE alert_sound_preferences SET configuracoes = ?, updated_at = ? WHERE user_id = ?`,
        [JSON.stringify(body.som), now, userId],
      );
    } else {
      await pgRun(
        `INSERT INTO alert_sound_preferences (id, user_id, configuracoes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), userId, JSON.stringify(body.som), now, now],
      );
    }
  }
}

/**
 * Salva configurações globais do módulo de compras (engine config, limiares, etc.).
 * Restrito a administradores e supervisores — verificado no route handler via isAdmin.
 */
export async function salvarConfiguracoesGlobais(
  config: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  for (const [chave, valor] of Object.entries(config)) {
    await pgRun(
      `INSERT INTO purchase_settings (chave, valor, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = EXCLUDED.updated_at`,
      [chave, JSON.stringify(valor), now],
    );
  }
}

function safeJson(str: string | null, fallback: any): any {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
