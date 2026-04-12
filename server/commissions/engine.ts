import { pgGet, pgAll } from "../pg-client";

export interface CommissionRule {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_active: number;
  priority: number;
  applies_to: string;
  config: string;
}

export interface CalculationStep {
  layer: number;
  name: string;
  ruleId: string | null;
  base: number;
  rate: number;
  amount: number;
  detail: string;
}

export interface CommissionResult {
  salespersonId: string;
  salespersonName: string;
  month: number;
  year: number;
  companyId: string;
  netSales: number;
  eligibleSales: number;
  goalMonthly: number;
  goalAchievement: number;
  weeksTotal: number;
  weeksAchieved: number;
  baseAmount: number;
  bonusAmount: number;
  strategicAmount: number;
  deductions: number;
  totalAmount: number;
  steps: CalculationStep[];
  summary: string;
}

function parseConfig(raw: string): any {
  try { return JSON.parse(raw); } catch { return {}; }
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getWeekRange(year: number, month: number, weekNum: number): { weekStart: string; weekEnd: string } {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const dayOfWeek = firstDay.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const firstMonday = new Date(firstDay);
  firstMonday.setDate(firstDay.getDate() + daysToMonday);

  const wStart = new Date(firstMonday);
  wStart.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
  const wEnd = new Date(wStart);
  wEnd.setDate(wStart.getDate() + 6);

  const clampedStart = wStart < firstDay ? firstDay : wStart;
  const clampedEnd   = wEnd   > lastDay  ? lastDay  : wEnd;

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { weekStart: fmt(clampedStart), weekEnd: fmt(clampedEnd) };
}

export async function calculateCommission(
  salespersonId: string,
  salespersonName: string,
  month: number,
  year: number,
  companyId: string = "all"
): Promise<CommissionResult> {
  const rules = await pgAll<CommissionRule>(
    `SELECT * FROM commission_rules WHERE is_active = 1 ORDER BY priority ASC`
  );

  const monthStr  = String(month).padStart(2, "0");
  const startDate = `${year}-${monthStr}-01`;
  const lastDay   = new Date(year, month, 0).getDate();
  const endDate   = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  let netSalesRow: { total: number } | undefined;
  if (companyId === "all") {
    netSalesRow = await pgGet<{ total: number }>(
      `SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total FROM cache_vendas
       WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?`,
      [salespersonId, startDate, endDate]
    );
  } else {
    netSalesRow = await pgGet<{ total: number }>(
      `SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total FROM cache_vendas
       WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? AND "IDEMPRESA" = ?`,
      [salespersonId, startDate, endDate, parseInt(companyId, 10)]
    );
  }
  const netSales      = netSalesRow?.total ?? 0;
  const eligibleSales = netSales;

  const monthlyGoals = await pgAll<{ targetValue: number; companyId: string }>(
    `SELECT "targetValue", "companyId" FROM goals
     WHERE "salespersonId" = ? AND type = 'monthly' AND month = ? AND year = ?`,
    [salespersonId, month, year]
  );

  let goalMonthly = 0;
  if (companyId === "all") {
    goalMonthly = monthlyGoals.reduce((s, g) => s + (g.targetValue ?? 0), 0);
  } else {
    const g = monthlyGoals.find(g => g.companyId === companyId);
    goalMonthly = g?.targetValue ?? 0;
  }

  const goalAchievement = goalMonthly > 0 ? (netSales / goalMonthly) * 100 : 0;

  const weeklyGoals = await pgAll<{ targetValue: number; week: number; companyId: string }>(
    `SELECT "targetValue", week, "companyId" FROM goals
     WHERE "salespersonId" = ? AND type = 'weekly' AND month = ? AND year = ?`,
    [salespersonId, month, year]
  );

  const weeksTotal = weeklyGoals.length;
  let weeksAchieved = 0;

  for (const wg of weeklyGoals) {
    const weekNum = wg.week ?? 1;
    const { weekStart, weekEnd } = getWeekRange(year, month, weekNum);
    let weekSalesRow: { total: number } | undefined;
    if (companyId === "all" || !wg.companyId || wg.companyId === "all") {
      weekSalesRow = await pgGet<{ total: number }>(
        `SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total FROM cache_vendas
         WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?`,
        [salespersonId, weekStart, weekEnd]
      );
    } else {
      weekSalesRow = await pgGet<{ total: number }>(
        `SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total FROM cache_vendas
         WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? AND "IDEMPRESA" = ?`,
        [salespersonId, weekStart, weekEnd, parseInt(wg.companyId, 10)]
      );
    }
    const weekSales = weekSalesRow?.total ?? 0;
    if (wg.targetValue > 0 && weekSales >= wg.targetValue) weeksAchieved++;
  }

  const steps: CalculationStep[] = [];
  let baseAmount      = 0;
  let bonusAmount     = 0;
  let strategicAmount = 0;
  let deductions      = 0;

  for (const rule of rules) {
    const cfg = parseConfig(rule.config);

    if (rule.type === "base_monthly") {
      const thresholds: { from: number; to: number; rate: number }[] = cfg.thresholds ?? [];
      const sorted = [...thresholds].sort((a, b) => a.from - b.from);
      const bracket = sorted.find(t => goalAchievement >= t.from && goalAchievement <= t.to)
        ?? (goalAchievement > (sorted.at(-1)?.to ?? 0) ? sorted.at(-1) : undefined);
      const rate   = bracket?.rate ?? 0;
      const amount = (eligibleSales * rate) / 100;
      baseAmount  += amount;
      steps.push({
        layer:  1,
        name:   rule.name,
        ruleId: rule.id,
        base:   eligibleSales,
        rate,
        amount,
        detail: `Atingimento: ${goalAchievement.toFixed(1)}% → Faixa ${bracket ? `${bracket.from}%–${bracket.to}%` : "N/A"} → ${rate}%`,
      });
    }

    if (rule.type === "weekly_bonus") {
      const rate   = cfg.rate ?? 0;
      const amount = (eligibleSales * rate * weeksAchieved) / 100;
      bonusAmount += amount;
      steps.push({
        layer:  2,
        name:   rule.name,
        ruleId: rule.id,
        base:   eligibleSales,
        rate:   rate * weeksAchieved,
        amount,
        detail: `${weeksAchieved} semana(s) batida(s) × ${rate}% = ${(rate * weeksAchieved).toFixed(2)}%`,
      });
    }

    if (rule.type === "weekly_all_bonus" && weeksTotal > 0 && weeksAchieved === weeksTotal) {
      const rate   = cfg.rate ?? 0;
      const amount = (eligibleSales * rate) / 100;
      bonusAmount += amount;
      steps.push({
        layer:  2,
        name:   rule.name,
        ruleId: rule.id,
        base:   eligibleSales,
        rate,
        amount,
        detail: `Todas as ${weeksTotal} semana(s) batidas → +${rate}%`,
      });
    }

    if (rule.type === "strategic" && cfg.target && cfg.rate) {
      let strategicBase = 0;
      if (cfg.targetType === "supplier" && cfg.target) {
        const row = await pgGet<{ total: number }>(
          `SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total FROM cache_vendas
           WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
             AND UPPER("FABRICANTE") LIKE UPPER(?)`,
          [salespersonId, startDate, endDate, `%${cfg.target}%`]
        );
        strategicBase = row?.total ?? 0;
      } else if (cfg.targetType === "product" && cfg.target) {
        const row = await pgGet<{ total: number }>(
          `SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total FROM cache_vendas
           WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
             AND ("IDPRODUTO" = ? OR UPPER("DESCRRESPRODUTO") LIKE UPPER(?))`,
          [salespersonId, startDate, endDate, cfg.target, `%${cfg.target}%`]
        );
        strategicBase = row?.total ?? 0;
      }
      const rate         = cfg.rate ?? 0;
      const amount       = (strategicBase * rate) / 100;
      strategicAmount   += amount;
      steps.push({
        layer:  4,
        name:   rule.name,
        ruleId: rule.id,
        base:   strategicBase,
        rate,
        amount,
        detail: `${cfg.targetType === "supplier" ? "Fornecedor" : "Produto"}: ${cfg.target} → Base R$ ${fmtBRL(strategicBase)} × ${rate}%`,
      });
    }

    if (rule.type === "accelerator") {
      const triggerFrom = cfg.triggerFrom ?? 110;
      if (goalMonthly > 0 && goalAchievement >= triggerFrom) {
        const rate          = cfg.rate ?? 0;
        const salesAtTrigger = (triggerFrom / 100) * goalMonthly;
        const extraBase     = Math.max(0, netSales - salesAtTrigger);
        const amount        = (extraBase * rate) / 100;
        bonusAmount        += amount;
        steps.push({
          layer:  3,
          name:   rule.name,
          ruleId: rule.id,
          base:   extraBase,
          rate,
          amount,
          detail: `Acelerador a partir de ${triggerFrom}% da meta → Excedente R$ ${fmtBRL(extraBase)} × ${rate}%`,
        });
      }
    }

    if (rule.type === "reducer" && cfg.condition) {
      const amount   = (eligibleSales * (cfg.reduceRate ?? 0)) / 100;
      deductions    += amount;
      steps.push({
        layer:  6,
        name:   rule.name,
        ruleId: rule.id,
        base:   eligibleSales,
        rate:   -(cfg.reduceRate ?? 0),
        amount: -amount,
        detail: rule.description ?? cfg.condition,
      });
    }
  }

  const totalAmount = Math.max(0, baseAmount + bonusAmount + strategicAmount - deductions);

  const monthName = new Date(year, month - 1, 1).toLocaleString("pt-BR", { month: "long" });
  const summary   = goalMonthly > 0
    ? `Atingimento ${goalAchievement.toFixed(1)}% da meta de ${monthName}/${year}. ` +
      `${weeksAchieved} de ${weeksTotal} semanas batidas. ` +
      `Comissão total projetada: R$ ${fmtBRL(totalAmount)}.`
    : `Sem meta definida para ${monthName}/${year}.`;

  return {
    salespersonId,
    salespersonName,
    month,
    year,
    companyId,
    netSales,
    eligibleSales,
    goalMonthly,
    goalAchievement,
    weeksTotal,
    weeksAchieved,
    baseAmount,
    bonusAmount,
    strategicAmount,
    deductions,
    totalAmount,
    steps,
    summary,
  };
}
