import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/calendar-utils";
import type { LucideIcon } from "lucide-react";

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
}: KPICardProps) {
  const formattedValue = loading
    ? "..."
    : typeof value === "number"
    ? format === "currency"
      ? formatCurrency(value)
      : format === "percentage"
      ? `${value.toFixed(1)}%`
      : value.toLocaleString("pt-BR")
    : value;

  const getTrendIcon = () => {
    if (yoyChange === null || yoyChange === undefined) return null;
    if (yoyChange > 0) return <TrendingUp className="h-4 w-4" />;
    if (yoyChange < 0) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (yoyChange === null || yoyChange === undefined) return "text-muted-foreground";
    if (yoyChange > 0) return "text-emerald-600 dark:text-emerald-400";
    if (yoyChange < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  return (
    <Card data-testid={`kpi-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {dragHandle}
              <p className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </p>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-semibold tracking-tight">
                {status === "SEM_TUBOS" || status === "SEM_DADOS" ? "N/A" : formattedValue}
              </span>
              {yoyChange !== null && yoyChange !== undefined && (
                <span className={`flex items-center gap-0.5 text-sm font-medium ${getTrendColor()}`}>
                  {getTrendIcon()}
                  {formatPercentage(yoyChange)}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">
                {status === "SEM_TUBOS" ? "Sem vendas de tubos no período" : subtitle}
              </p>
            )}
          </div>
          {Icon && (
            <div className="flex-shrink-0 p-2.5 rounded-md bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
