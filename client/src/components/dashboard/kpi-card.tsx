import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/calendar-utils";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  yoyChange?: number | null;
  icon?: LucideIcon;
  loading?: boolean;
  format?: "currency" | "percentage" | "number";
  status?: "OK" | "SEM_TUBOS" | "SEM_DADOS";
  dragHandle?: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  yoyChange,
  icon: Icon,
  loading,
  format = "number",
  status,
  dragHandle,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
}: KPICardProps) {
  const formattedValue = loading
    ? null
    : typeof value === "number"
    ? format === "currency"
      ? formatCurrency(value)
      : format === "percentage"
      ? `${value.toFixed(1)}%`
      : value.toLocaleString("pt-BR")
    : value;

  const isNA = status === "SEM_TUBOS" || status === "SEM_DADOS";

  const trendPositive = yoyChange !== null && yoyChange !== undefined && yoyChange > 0;
  const trendNegative = yoyChange !== null && yoyChange !== undefined && yoyChange < 0;
  const trendNeutral  = yoyChange !== null && yoyChange !== undefined && yoyChange === 0;

  return (
    <div
      data-testid={`kpi-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "bg-card rounded-lg border border-card-border p-5 flex flex-col gap-3",
        "shadow-card hover:shadow-card-hover transition-shadow duration-200",
        "animate-fade-in",
      )}
    >
      {/* Header row: label + drag handle + icon */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {dragHandle}
          <p className="text-xs font-medium text-muted-foreground truncate leading-none">
            {title}
          </p>
        </div>
        {Icon && (
          <div className={cn("shrink-0 w-9 h-9 rounded-lg flex items-center justify-center", iconBg)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
        )}
      </div>

      {/* Main value */}
      <div>
        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-8 w-32 rounded-md" />
            <div className="skeleton h-4 w-20 rounded-md" />
          </div>
        ) : (
          <>
            <p className={cn(
              "text-2xl font-bold tracking-tight tabular-nums leading-tight",
              "animate-count-up",
            )}>
              {isNA ? "—" : formattedValue}
            </p>
            {isNA && (
              <p className="text-xs text-muted-foreground mt-1">
                {status === "SEM_TUBOS" ? "Sem tubos no período" : "Sem dados"}
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer: trend + subtitle */}
      {!loading && (
        <div className="flex items-center gap-2 flex-wrap mt-auto pt-0">
          {yoyChange !== null && yoyChange !== undefined && (
            <span className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md",
              trendPositive && "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
              trendNegative && "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
              trendNeutral  && "bg-muted text-muted-foreground",
            )}>
              {trendPositive && <TrendingUp className="h-3 w-3" />}
              {trendNegative && <TrendingDown className="h-3 w-3" />}
              {trendNeutral  && <Minus className="h-3 w-3" />}
              {formatPercentage(yoyChange)}
            </span>
          )}
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
