/**
 * Copiloto de Compras — Motor de Alertas (unificado)
 *
 * Combina:
 *   - Infraestrutura de entrega SSE (createOrUpdateAlert, delivery state, broadcast)
 *   - Ciclo de avaliação BI (calcularTodasSugestoes → alertas por produto/fornecedor)
 *
 * Exporta:
 *   startComprasAlertEngine()   — alias histórico (inicia o singleton)
 *   startPurchaseAlertEngine()  — nome canônico (inicia o mesmo singleton)
 *   createOrUpdateAlert()       — usado pelas rotas de teste/admin
 */

import { pgGet, pgAll, pgRun } from "../pg-client";
import { randomUUID, createHash } from "crypto";
import { broadcastToUser } from "./sse-manager";
import { calcularTodasSugestoes, type SuggestionEngineConfig } from "./suggestion-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertStatus =
  | "novo"
  | "nao_lido"
  | "lido"
  | "reconhecido"
  | "adiado"
  | "silenciado"
  | "resolvido"
  | "reaberto";

export type AlertSeverity = "critico" | "importante" | "info";

interface PurchaseAlert {
  id: string;
  userId: number;
  type: string;
  referenceKey: string;
  severityBand: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: AlertStatus;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryState {
  id: string;
  dedupe_key: string;
  user_id: number;
  last_alert_id: string;
  last_severity_band: string;
  last_triggered_at: string;
  cooldown_until: string | null;
}

interface PurchaseSetting {
  chave: string;
  valor: string;
}

// ---------------------------------------------------------------------------
// Engine control
// ---------------------------------------------------------------------------

const EVAL_INTERVAL_MS = 30 * 60 * 1000;
const ENGINE_INTERVAL_MS = 5 * 60 * 1000;
let engineStarted = false;

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function severityBand(severity: AlertSeverity): number {
  if (severity === "critico") return 3;
  if (severity === "importante") return 2;
  return 1;
}

function mapSeveridade(severidade: string): AlertSeverity {
  if (severidade === "critical" || severidade === "critico") return "critico";
  if (severidade === "warning" || severidade === "importante") return "importante";
  return "info";
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

async function getSettingValue(key: string, fallback: string): Promise<string> {
  try {
    const row = await pgGet<{ valor: string }>(
      `SELECT valor FROM purchase_settings WHERE chave = ?`,
      [key]
    );
    return row?.valor ?? fallback;
  } catch {
    return fallback;
  }
}

async function isSystemEnabled(): Promise<boolean> {
  const v = await getSettingValue("alerts_enabled", "true");
  return v === "true";
}

async function getCooldownMinutes(): Promise<number> {
  const v = await getSettingValue("cooldown_minutes", "60");
  return parseInt(v, 10) || 60;
}

async function getMinSeverityForSound(): Promise<string> {
  return await getSettingValue("min_severity_sound", "importante");
}

async function getRetentionDays(): Promise<number> {
  const v = await getSettingValue("retention_days", "90");
  return parseInt(v, 10) || 90;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function logAlertEvent(
  alertId: string,
  userId: number,
  action: string,
  rule: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await pgRun(
      `INSERT INTO purchase_alert_events (id, alert_id, user_id, action, rule_name, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        alertId,
        userId,
        action,
        rule,
        JSON.stringify(details ?? {}),
        new Date().toISOString(),
      ]
    );
  } catch (err) {
    console.error("[PurchaseAlertEngine] logAlertEvent error:", err);
  }
}

// ---------------------------------------------------------------------------
// User helpers
// ---------------------------------------------------------------------------

async function getUserAlertPreferences(userId: number): Promise<{
  enabled: boolean;
  soundEnabled: boolean;
  onlyCriticalSound: boolean;
  mutedUntil: string | null;
}> {
  try {
    const row = await pgGet<{
      enabled: number;
      sound_enabled: number;
      only_critical_sound: number;
      muted_until: string | null;
    }>(
      `SELECT enabled, sound_enabled, only_critical_sound, muted_until
       FROM user_alert_preferences WHERE user_id = ?`,
      [userId]
    );
    if (!row) return { enabled: true, soundEnabled: true, onlyCriticalSound: false, mutedUntil: null };
    return {
      enabled: Boolean(row.enabled),
      soundEnabled: Boolean(row.sound_enabled),
      onlyCriticalSound: Boolean(row.only_critical_sound),
      mutedUntil: row.muted_until,
    };
  } catch {
    return { enabled: true, soundEnabled: true, onlyCriticalSound: false, mutedUntil: null };
  }
}

async function getPurchasingUsers(): Promise<number[]> {
  try {
    const rows = await pgAll<{ id: number }>(
      `SELECT id FROM users WHERE role IN ('admin', 'supervisor', 'compras') AND status = 'ativo'`
    );
    return rows.map(r => r.id);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Core delivery: createOrUpdateAlert (with SSE broadcast)
// ---------------------------------------------------------------------------

export async function createOrUpdateAlert(params: {
  userId: number;
  type: string;
  referenceKey: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  rule: string;
  data?: Record<string, unknown>;
}): Promise<{ alertId: string; isNew: boolean } | null> {
  const { userId, type, referenceKey, severity, title, message, rule, data = {} } = params;

  const band = severityBand(severity);
  const dedupeKey = `${type}:${referenceKey}:${band}`;
  const now = new Date();
  const nowIso = now.toISOString();

  const cooldownMinutes = await getCooldownMinutes();
  const cooldownMs = cooldownMinutes * 60 * 1000;

  try {
    const delivery = await pgGet<DeliveryState>(
      `SELECT * FROM alert_delivery_state WHERE dedupe_key = ? AND user_id = ?`,
      [dedupeKey, userId]
    );

    if (delivery) {
      if (delivery.cooldown_until && new Date(delivery.cooldown_until) > now) {
        return null;
      }

      const existingAlert = await pgGet<PurchaseAlert>(
        `SELECT * FROM purchase_alerts WHERE id = ?`,
        [delivery.last_alert_id]
      );

      if (existingAlert && existingAlert.status !== "resolvido") {
        await pgRun(
          `UPDATE purchase_alerts SET message = ?, updated_at = ? WHERE id = ?`,
          [message, nowIso, delivery.last_alert_id]
        );

        const cooldownUntil = new Date(now.getTime() + cooldownMs).toISOString();
        await pgRun(
          `UPDATE alert_delivery_state SET last_triggered_at = ?, cooldown_until = ? WHERE dedupe_key = ? AND user_id = ?`,
          [nowIso, cooldownUntil, dedupeKey, userId]
        );

        await logAlertEvent(delivery.last_alert_id, userId, "atualizado", rule, { severity, message });
        return { alertId: delivery.last_alert_id, isNew: false };
      }
    }

    const alertId = randomUUID();
    await pgRun(
      `INSERT INTO purchase_alerts (id, user_id, type, reference_key, severity_band, severity, title, message, status, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'nao_lido', ?, ?, ?)`,
      [alertId, userId, type, referenceKey, String(band), severity, title, message, JSON.stringify(data), nowIso, nowIso]
    );

    const cooldownUntil = new Date(now.getTime() + cooldownMs).toISOString();
    if (delivery) {
      await pgRun(
        `UPDATE alert_delivery_state SET last_alert_id = ?, last_severity_band = ?, last_triggered_at = ?, cooldown_until = ? WHERE dedupe_key = ? AND user_id = ?`,
        [alertId, String(band), nowIso, cooldownUntil, dedupeKey, userId]
      );
    } else {
      await pgRun(
        `INSERT INTO alert_delivery_state (id, dedupe_key, user_id, last_alert_id, last_severity_band, last_triggered_at, cooldown_until)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), dedupeKey, userId, alertId, String(band), nowIso, cooldownUntil]
      );
    }

    await logAlertEvent(alertId, userId, "criado", rule, { severity, title, message, data });

    const minSeverityForSound = await getMinSeverityForSound();
    const minBand = severityBand(minSeverityForSound as AlertSeverity);
    const shouldPlaySound = band >= minBand;

    broadcastToUser(userId, "purchase_alert", {
      alertId,
      type,
      severity,
      title,
      message,
      playSound: shouldPlaySound,
      data,
      timestamp: nowIso,
    });

    return { alertId, isNew: true };
  } catch (err) {
    console.error("[PurchaseAlertEngine] createOrUpdateAlert error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Purge old resolved/read alerts
// ---------------------------------------------------------------------------

async function purgeExpiredAlerts(): Promise<void> {
  try {
    const retentionDays = await getRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    await pgRun(
      `DELETE FROM purchase_alerts WHERE status IN ('resolvido', 'lido') AND updated_at < ?`,
      [cutoff]
    );
  } catch (err) {
    console.error("[PurchaseAlertEngine] purgeExpiredAlerts error:", err);
  }
}

// ---------------------------------------------------------------------------
// BI Evaluation helpers (adapted from HEAD to use new schema via createOrUpdateAlert)
// ---------------------------------------------------------------------------

function makeReferenceKey(produtoId: string | null, fabricante: string | null): string {
  return createHash("sha256")
    .update(`${produtoId ?? ""}|${fabricante ?? ""}`)
    .digest("hex")
    .substring(0, 16);
}

async function dispararAlertaPorUsuarios(
  tipo: string,
  produtoId: string | null,
  fabricante: string | null,
  titulo: string,
  mensagem: string,
  severidade: string,
  dados: Record<string, unknown>
): Promise<void> {
  const severity = mapSeveridade(severidade);
  const referenceKey = produtoId ?? fabricante ?? makeReferenceKey(produtoId, fabricante);
  const userIds = await getPurchasingUsers();

  for (const userId of userIds) {
    const prefs = await getUserAlertPreferences(userId);
    if (!prefs.enabled) continue;
    if (prefs.mutedUntil && new Date(prefs.mutedUntil) > new Date()) continue;

    await createOrUpdateAlert({
      userId,
      type: tipo,
      referenceKey,
      severity,
      title: titulo,
      message: mensagem,
      rule: tipo,
      data: dados,
    });
  }
}

async function runBIEvaluationCycle(): Promise<void> {
  console.log("[ComprasAlertEngine] Iniciando ciclo de avaliação BI...");

  try {
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

    const sugestoes = await calcularTodasSugestoes(engineCfg);

    if (sugestoes.length === 0) {
      console.log("[ComprasAlertEngine] Sem dados de produtos para avaliar.");
      return;
    }

    for (const s of sugestoes) {
      if (s.coberturaDias <= 0 || (s.leadTimeDias > 0 && s.coberturaDias <= s.leadTimeDias)) {
        await dispararAlertaPorUsuarios(
          "ruptura_iminente",
          s.produtoId,
          s.fabricante,
          `Ruptura iminente: ${s.produtoId}`,
          `Produto ${s.produtoId} (${s.fabricante}) tem cobertura de ${s.coberturaDias.toFixed(1)} dias, menor ou igual ao lead time de ${s.leadTimeDias} dias.`,
          "critical",
          { coberturaDias: s.coberturaDias, leadTimeDias: s.leadTimeDias },
        );
      }

      if (s.estoqueAtual < s.estoqueSeguranca && s.estoqueSeguranca > 0) {
        await dispararAlertaPorUsuarios(
          "abaixo_seguranca",
          s.produtoId,
          s.fabricante,
          `Abaixo do estoque de segurança: ${s.produtoId}`,
          `Estoque atual (${s.estoqueAtual}) abaixo do estoque de segurança (${s.estoqueSeguranca}) para o produto ${s.produtoId}.`,
          "warning",
          { estoqueAtual: s.estoqueAtual, estoqueSeguranca: s.estoqueSeguranca },
        );
      }

      if (s.leadTimeDias > s.coberturaDias && s.coberturaDias > 0) {
        await dispararAlertaPorUsuarios(
          "lead_time_maior_cobertura",
          s.produtoId,
          s.fabricante,
          `Lead time maior que cobertura: ${s.produtoId}`,
          `Lead time (${s.leadTimeDias} dias) é maior que a cobertura atual (${s.coberturaDias.toFixed(1)} dias) para ${s.produtoId}.`,
          "warning",
          { leadTimeDias: s.leadTimeDias, coberturaDias: s.coberturaDias },
        );
      }

      const coberturaExcesso = s.coberturaAlvoDias * 3;
      if (s.coberturaDias > coberturaExcesso && s.consumoMedioDiario > 0) {
        await dispararAlertaPorUsuarios(
          "excesso_estoque",
          s.produtoId,
          s.fabricante,
          `Excesso de estoque: ${s.produtoId}`,
          `Produto ${s.produtoId} tem cobertura de ${s.coberturaDias.toFixed(0)} dias (${(s.coberturaDias / s.coberturaAlvoDias).toFixed(1)}x acima do alvo).`,
          "info",
          { coberturaDias: s.coberturaDias, coberturaAlvoDias: s.coberturaAlvoDias },
        );
      }

      const pontoReposicao = s.pontoReposicao;
      if (s.pedidosAbertos > 0 && s.pedidosAbertos < pontoReposicao && s.urgencia !== "ok") {
        await dispararAlertaPorUsuarios(
          "pedido_insuficiente",
          s.produtoId,
          s.fabricante,
          `Pedido em aberto insuficiente: ${s.produtoId}`,
          `Pedidos em aberto (${s.pedidosAbertos}) insuficientes para atingir ponto de reposição (${pontoReposicao.toFixed(0)}) do produto ${s.produtoId}.`,
          "warning",
          { pedidosAbertos: s.pedidosAbertos, pontoReposicao },
        );
      }
    }

    const fabricantesCriticos = new Map<string, number>();
    for (const s of sugestoes) {
      if (s.urgencia === "critica" || s.urgencia === "alta") {
        fabricantesCriticos.set(s.fabricante, (fabricantesCriticos.get(s.fabricante) ?? 0) + 1);
      }
    }

    for (const [fab, count] of fabricantesCriticos.entries()) {
      if (count >= 3) {
        await dispararAlertaPorUsuarios(
          "fornecedor_critico",
          null,
          fab,
          `Fornecedor crítico: ${fab}`,
          `Fornecedor ${fab} tem ${count} SKUs com urgência crítica ou alta.`,
          "critical",
          { fabricante: fab, skusCriticos: count },
        );
      }
    }

    console.log(`[ComprasAlertEngine] Ciclo BI completo. ${sugestoes.length} produtos avaliados.`);
  } catch (err) {
    console.error("[ComprasAlertEngine] Erro no ciclo de avaliação BI:", err);
  }
}

// ---------------------------------------------------------------------------
// Main evaluation cycle (BI eval + purge)
// ---------------------------------------------------------------------------

async function runEvaluationCycle(): Promise<void> {
  const enabled = await isSystemEnabled();
  if (!enabled) return;

  await runBIEvaluationCycle();
  await purgeExpiredAlerts();
}

// ---------------------------------------------------------------------------
// Engine starters (both export same singleton)
// ---------------------------------------------------------------------------

export function startComprasAlertEngine(): void {
  if (engineStarted) return;
  engineStarted = true;
  runEvaluationCycle().catch(console.error);
  setInterval(() => runEvaluationCycle().catch(console.error), EVAL_INTERVAL_MS);
  console.log(`[ComprasAlertEngine] Iniciado. Avaliando a cada ${EVAL_INTERVAL_MS / 60000} minutos.`);
}

export function startPurchaseAlertEngine(): void {
  if (engineStarted) return;
  engineStarted = true;
  runEvaluationCycle().catch(console.error);
  setInterval(() => runEvaluationCycle().catch(console.error), ENGINE_INTERVAL_MS);
  console.log(`[PurchaseAlertEngine] Started. Evaluating every ${ENGINE_INTERVAL_MS / 60000} minutes.`);
}
