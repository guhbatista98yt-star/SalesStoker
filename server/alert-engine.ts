import { pgGet, pgAll, pgRun } from "./pg-client";
import { randomUUID } from "crypto";

const EVAL_INTERVAL_MS = 10 * 60 * 1000;
let engineStarted = false;

interface AlertConfigRow {
  id: string;
  companyId: string;
  type: string;
  threshold: number;
  enabled: number;
  message: string;
  severity: string;
}

interface CompanyRow {
  id: string;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function getPeriodKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function startOfMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

async function notificationAlreadyExists(alertId: string, companyId: string, periodKey: string): Promise<boolean> {
  try {
    const row = await pgGet<{ id: string }>(`
      SELECT id FROM alert_notifications
      WHERE "alertId" = ? AND "companyId" = ? AND "triggeredAt" >= ?
    `, [alertId, companyId, `${periodKey}-01`]);
    return !!row;
  } catch {
    return false;
  }
}

async function insertNotification(alertId: string, companyId: string, message: string, severity: string, data: Record<string, unknown>): Promise<void> {
  const id = randomUUID();
  await pgRun(`
    INSERT INTO alert_notifications (id, "alertId", "companyId", "triggeredAt", message, severity, read, data)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `, [id, alertId, companyId, new Date().toISOString(), message, severity, JSON.stringify(data)]);
}

async function evaluateYoyQueda(config: AlertConfigRow, companies: string[]): Promise<void> {
  const now = new Date();
  const start = startOfMonth(now);
  const end = getToday();
  const periodKey = getPeriodKey(now);

  const yoyStart = startOfMonth(new Date(now.getFullYear() - 1, now.getMonth(), 1));
  const yoyDate = new Date(now); yoyDate.setFullYear(yoyDate.getFullYear() - 1);
  const yoyEnd = yoyDate.toISOString().split("T")[0];

  for (const companyId of companies) {
    if (await notificationAlreadyExists(config.id, companyId, periodKey)) continue;

    const isAll = companyId === "all";
    const current = isAll
      ? await pgGet<{ total: number }>(`SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total FROM cache_vendas WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?`, [start, end])
      : await pgGet<{ total: number }>(`SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total FROM cache_vendas WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? AND "IDEMPRESA" = ?`, [start, end, companyId]);

    const previous = isAll
      ? await pgGet<{ total: number }>(`SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total FROM cache_vendas WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?`, [yoyStart, yoyEnd])
      : await pgGet<{ total: number }>(`SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total FROM cache_vendas WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? AND "IDEMPRESA" = ?`, [yoyStart, yoyEnd, companyId]);

    if (!previous || previous.total === 0) continue;
    const cur = current?.total ?? 0;
    const variacao = ((cur - previous.total) / previous.total) * 100;

    if (variacao < -config.threshold) {
      const companyLabel = isAll ? "Geral" : `Empresa ${companyId}`;
      await insertNotification(
        config.id, companyId,
        `${companyLabel}: Queda YoY de ${Math.abs(variacao).toFixed(1)}% (limite: ${config.threshold}%). Vendas atuais R$${cur.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vs ano anterior R$${previous.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
        config.severity,
        { variacao, current: cur, previous: previous.total }
      );
    }
  }
}

async function evaluateTicketBaixo(config: AlertConfigRow, companies: string[]): Promise<void> {
  const now = new Date();
  const start = startOfMonth(now);
  const end = getToday();
  const periodKey = getPeriodKey(now);

  for (const companyId of companies) {
    if (await notificationAlreadyExists(config.id, companyId, periodKey)) continue;

    const isAll = companyId === "all";
    const result = isAll
      ? await pgGet<{ total: number; pedidos: number }>(`SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total, COALESCE(COUNT(DISTINCT "IDPLANILHA"), 0) as pedidos FROM cache_vendas WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?`, [start, end])
      : await pgGet<{ total: number; pedidos: number }>(`SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total, COALESCE(COUNT(DISTINCT "IDPLANILHA"), 0) as pedidos FROM cache_vendas WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? AND "IDEMPRESA" = ?`, [start, end, companyId]);

    if (!result || Number(result.pedidos) === 0) continue;

    const ticketMedio = result.total / Number(result.pedidos);

    if (ticketMedio < config.threshold) {
      const companyLabel = isAll ? "Geral" : `Empresa ${companyId}`;
      await insertNotification(
        config.id, companyId,
        `${companyLabel}: Ticket médio R$${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} está abaixo do limite de R$${config.threshold.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${result.pedidos} pedidos no mês).`,
        config.severity,
        { ticketMedio, threshold: config.threshold, pedidos: result.pedidos }
      );
    }
  }
}

async function runEvaluationCycle(): Promise<void> {
  console.log("[AlertEngine] Running evaluation cycle...");
  try {
    const allConfigs = await pgAll<AlertConfigRow>(`SELECT * FROM alert_configs WHERE enabled = 1`);

    const companyRows = await pgAll<CompanyRow>(`SELECT DISTINCT CAST("IDEMPRESA" AS TEXT) as id FROM cache_vendas`);
    const companiesInData = companyRows.map(r => r.id);
    if (companiesInData.length === 0) companiesInData.push("1");

    for (const config of allConfigs) {
      const relevantCompanies = config.companyId === "all" ? companiesInData : [config.companyId];

      if (config.type === "yoy_queda") {
        await evaluateYoyQueda(config, relevantCompanies);
      } else if (config.type === "ticket_baixo") {
        await evaluateTicketBaixo(config, relevantCompanies);
      }
    }
    console.log("[AlertEngine] Evaluation cycle complete.");
  } catch (err) {
    console.error("[AlertEngine] Error during evaluation:", err);
  }
}

export function startAlertEngine(): void {
  if (engineStarted) return;
  engineStarted = true;
  runEvaluationCycle().catch(console.error);
  setInterval(() => runEvaluationCycle().catch(console.error), EVAL_INTERVAL_MS);
  console.log(`[AlertEngine] Started. Evaluating every ${EVAL_INTERVAL_MS / 60000} minutes.`);
}
