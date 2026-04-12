import { startOfWeek, endOfWeek, addDays, format, getDay, startOfMonth, endOfMonth, addWeeks, subWeeks, isBefore, isAfter, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { WeeklyPeriod, ClosedMonthPeriod, DatePeriod } from "@shared/schema";

export function getWeekStartSunday(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 0 });
}

export function getWeekEndSaturday(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 0 });
}

export function getClosedMonthPeriod(year: number, month: number): ClosedMonthPeriod {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = endOfMonth(firstDayOfMonth);

  const dayOfWeek = getDay(firstDayOfMonth);

  let periodStart: Date;
  if (dayOfWeek <= 3) {
    periodStart = getWeekStartSunday(firstDayOfMonth);
  } else {
    periodStart = addWeeks(getWeekStartSunday(firstDayOfMonth), 1);
  }

  const lastDayDow = getDay(lastDayOfMonth);
  let periodEnd: Date;
  if (lastDayDow >= 3) {
    periodEnd = getWeekEndSaturday(lastDayOfMonth);
  } else {
    periodEnd = subWeeks(getWeekEndSaturday(lastDayOfMonth), 1);
    periodEnd = getWeekEndSaturday(periodEnd);
  }

  const weeksIncluded: WeeklyPeriod[] = [];
  let currentWeekStart = periodStart;

  while (isBefore(currentWeekStart, periodEnd) || currentWeekStart.getTime() === periodEnd.getTime()) {
    const weekEnd = getWeekEndSaturday(currentWeekStart);
    weeksIncluded.push({
      weekNumber: getWeek(currentWeekStart, { weekStartsOn: 0 }),
      year: getYear(currentWeekStart),
      startDate: format(currentWeekStart, "yyyy-MM-dd"),
      endDate: format(weekEnd, "yyyy-MM-dd"),
    });
    currentWeekStart = addWeeks(currentWeekStart, 1);
    if (isAfter(currentWeekStart, periodEnd)) break;
  }

  return {
    month,
    year,
    periodStart: format(periodStart, "yyyy-MM-dd"),
    periodEnd: format(periodEnd, "yyyy-MM-dd"),
    weeksIncluded,
  };
}

export function getCurrentMonthPeriod(): { startDate: string; endDate: string; label: string } {
  const today = new Date();
  const start = startOfMonth(today);
  const end = today;
  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
    label: format(today, "MMMM/yyyy", { locale: ptBR }),
  };
}

export function getCurrentWeekPeriod(): WeeklyPeriod {
  const today = new Date();
  const start = getWeekStartSunday(today);
  const end = getWeekEndSaturday(today);

  return {
    weekNumber: getWeek(today, { weekStartsOn: 0 }),
    year: getYear(today),
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
  };
}

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    // Se vier 'YYYY-MM-DD', adiciona T00:00:00 para evitar conflitos de fuso
    let parsedDateStr = dateStr;
    if (dateStr.length === 10 && dateStr.includes('-')) {
      parsedDateStr += "T00:00:00";
    }
    const date = new Date(parsedDateStr);

    // Fallback: se for inválido, tenta substituir ' ' por 'T' ('YYYY-MM-DD HH:MM:SS')
    if (isNaN(date.getTime())) {
      const fallbackDate = new Date(dateStr.replace(' ', 'T'));
      if (!isNaN(fallbackDate.getTime())) {
        return format(fallbackDate, "dd/MM/yyyy", { locale: ptBR });
      }
      return dateStr; // Retorna original em último caso
    }

    return format(date, "dd/MM/yyyy", { locale: ptBR });
  } catch (e) {
    return dateStr;
  }
}

export function formatPeriodLabel(period: DatePeriod): string {
  const start = formatDateBR(period.startDate);
  const end = formatDateBR(period.endDate);
  return `${start} - ${end}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const fmt = (n: number, suffix: string) =>
    `${sign}R$\u00a0${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ${suffix}`;

  if (abs >= 1_000_000_000_000) return fmt(abs / 1_000_000_000_000, "tri");
  if (abs >= 1_000_000_000)     return fmt(abs / 1_000_000_000, "bi");
  if (abs >= 1_000_000)         return fmt(abs / 1_000_000, "mi");
  if (abs >= 1_000)             return fmt(abs / 1_000, "mil");
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);
}

export function formatPercentage(value: number | null): string {
  if (value === null) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}
