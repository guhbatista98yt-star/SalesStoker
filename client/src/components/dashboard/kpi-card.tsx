import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/calendar-utils";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Tiny sparkline ──────────────────────────────────────────────────────────── */
function Sparkline({
  data,
  positive = true,
  id,
}: {
  data: number[];
  positive?: boolean;
  id: string;
}) {
  const color = positive ? "#10b981" : "#ef4444";
  const chartData = data.map((v) => ({ v }));

  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={chartData} margin={{ top: 3, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.18} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${id})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Props ───────────────────────────────────────────────────────────────────── */
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
  sparklineData?: number[];
  sparklineId?: string;
}

/* ── Component ───────────────────────────────────────────────────────────────── */
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
  sparklineData,
  sparklineId = "sparkline",
}: KPICardProps) {
  const formattedValue =
    typeof value === "number"
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
  const hasSparkline = sparklineData && sparklineData.length > 1;

  return (
    <div
      data-testid={`kpi-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "bg-card rounded-xl border border-card-border flex flex-col",
        "shadow-card hover:shadow-card-hover transition-shadow duration-200",
        "animate-fade-in overflow-hidden",
      )}
    >
      {/* Top section: label + icon */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {dragHandle}
          <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase leading-none truncate">
            {title}
          </p>
        </div>
        {Icon && (
          <div className={cn("shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", iconBg)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
        )}
      </div>

      {/* Middle: metric value + trend */}
      <div className="px-5">
        {loading ? (
          <div className="space-y-2 pb-2">
            <div className="skeleton h-8 w-32 rounded-md" />
            <div className="skeleton h-4 w-20 rounded-md" />
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-foreground leading-none animate-count-up">
              {isNA ? "—" : formattedValue}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
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
              {subtitle && !isNA && (
                <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
              )}
              {isNA && (
                <p className="text-[11px] text-muted-foreground">
                  {status === "SEM_TUBOS" ? "Sem tubos no período" : "Sem dados"}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: sparkline */}
      {!loading && hasSparkline && (
        <div className="mt-2 px-1">
          <Sparkline
            data={sparklineData!}
            positive={trendPositive || (!trendNegative)}
            id={sparklineId}
          />
        </div>
      )}
      {!loading && !hasSparkline && <div className="pb-5" />}
    </div>
  );
}
