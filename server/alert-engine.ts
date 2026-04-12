import { sqlite } from "./db";
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

function notificationAlreadyExists(alertId: string, companyId: string, periodKey: string): boolean {
  try {
    const row = sqlite.prepare(`
      SELECT id FROM alert_notifications
      WHERE alertId = ? AND companyId = ? AND triggeredAt >= ?
    `).get(alertId, companyId, `${periodKey}-01`) as { id: string } | undefined;
    return !!row;
  } catch {
    return false;
  }
}

function insertNotification(alertId: string, companyId: string, message: string, severity: string, data: Record<string, unknown>): void {
  const id = randomUUID();
  sqlite.prepare(`
    INSERT INTO alert_notifications (id, alertId, companyId, triggeredAt, message, severity, read, data)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, alertId, companyId, new Date().toISOString(), message, severity, JSON.stringify(data));
}

function evaluateYoyQueda(config: AlertConfigRow, companies: string[]): void {
  const now = new Date();
  const start = startOfMonth(now);
  const end = getToday();
  const periodKey = getPeriodKey(now);

  const yoyStart = startOfMonth(new Date(now.getFullYear() - 1, now.getMonth(), 1));
  const yoyDate = new Date(now);
  yoyDate.setFullYear(yoyDate.getFullYear() - 1);
  const yoyEnd = yoyDate.toISOString().split("T")[0];

  for (const companyId of companies) {
    if (notificationAlreadyExists(config.id, companyId, periodKey)) continue;

    const isAll = companyId === "all";
    const currentQuery = isAll
      ? sqlite.prepare(`SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total FROM cache_vendas WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?`)
      : sqlite.prepare(`SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total FROM cache_vendas WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ? AND IDEMPRESA = ?`);

    const current = (isAll
      ? currentQuery.get(start, end)
      : currentQuery.get(start, end, companyId)) as { total: number };

    const previousQuery = isAll
      ? sqlite.prepare(`SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total FROM cache_vendas WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?`)
      : sqlite.prepare(`SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total FROM cache_vendas WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ? AND IDEMPRESA = ?`);

    const previous = (isAll
      ? previousQuery.get(yoyStart, yoyEnd)
      : previousQuery.get(yoyStart, yoyEnd, companyId)) as { total: number };

    if (previous.total === 0) continue;

    const variacao = ((current.total - previous.total) / previous.total) * 100;

    if (variacao < -config.threshold) {
      const companyLabel = isAll ? "Geral" : `Empresa ${companyId}`;
      insertNotification(
        config.id,
        companyId,
        `${companyLabel}: Queda YoY de ${Math.abs(variacao).toFixed(1)}% (limite: ${config.threshold}%). Vendas atuais R$${current.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} vs ano anterior R$${previous.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
        config.severity,
        { variacao, current: current.total, previous: previous.total }
      );
    }
  }
}

function evaluateTicketBaixo(config: AlertConfigRow, companies: string[]): void {
  const now = new Date();
  const start = startOfMonth(now);
  const end = getToday();
  const periodKey = getPeriodKey(now);

  for (const companyId of companies) {
    if (notificationAlreadyExists(config.id, companyId, periodKey)) continue;

    const isAll = companyId === "all";
    const query = isAll
      ? sqlite.prepare(`SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total, COALESCE(COUNT(DISTINCT IDPLANILHA), 0) as pedidos FROM cache_vendas WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?`)
      : sqlite.prepare(`SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total, COALESCE(COUNT(DISTINCT IDPLANILHA), 0) as pedidos FROM cache_vendas WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ? AND IDEMPRESA = ?`);

    const result = (isAll
      ? query.get(start, end)
      : query.get(start, end, companyId)) as { total: number; pedidos: number };

    if (result.pedidos === 0) continue;

    const ticketMedio = result.total / result.pedidos;

    if (ticketMedio < config.threshold) {
      const companyLabel = isAll ? "Geral" : `Empresa ${companyId}`;
      insertNotification(
        config.id,
        companyId,
        `${companyLabel}: Ticket médio R$${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} está abaixo do limite de R$${config.threshold.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${result.pedidos} pedidos no mês).`,
        config.severity,
        { ticketMedio, threshold: config.threshold, pedidos: result.pedidos }
      );
    }
  }
}

function runEvaluationCycle(): void {
  console.log("[AlertEngine] Running evaluation cycle...");
  try {
    const allConfigs = sqlite.prepare(`SELECT * FROM alert_configs WHERE enabled = 1`).all() as AlertConfigRow[];

    const companyRows = sqlite.prepare(`SELECT DISTINCT CAST(IDEMPRESA AS TEXT) as id FROM cache_vendas`).all() as CompanyRow[];
    const companiesInData = companyRows.map(r => r.id);
    if (companiesInData.length === 0) {
      companiesInData.push("1");
    }

    for (const config of allConfigs) {
      const relevantCompanies = config.companyId === "all"
        ? companiesInData
        : [config.companyId];

      if (config.type === "yoy_queda") {
        evaluateYoyQueda(config, relevantCompanies);
      } else if (config.type === "ticket_baixo") {
        evaluateTicketBaixo(config, relevantCompanies);
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
  runEvaluationCycle();
  setInterval(runEvaluationCycle, EVAL_INTERVAL_MS);
  console.log(`[AlertEngine] Started. Evaluating every ${EVAL_INTERVAL_MS / 60000} minutes.`);
}
