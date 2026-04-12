import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export type MetricStatus = "atingido" | "quase" | "pendente" | "info";

interface MetricCardProps {
  title: string;
  subtitle?: string;
  value: string;
  targetLabel?: string;
  remainingLabel?: string;
  pct: number;
  status: MetricStatus;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  progressColor?: string;
  note?: string;
  className?: string;
}

const statusChip: Record<MetricStatus, { label: string; cls: string }> = {
  atingido: { label: "Atingido",  cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  quase:    { label: "Quase lá", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  pendente: { label: "Pendente",  cls: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
  info:     { label: "Info",      cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

const progressColors: Record<MetricStatus, string> = {
  atingido: "bg-emerald-500",
  quase:    "bg-amber-500",
  pendente: "bg-red-400",
  info:     "bg-primary",
};

export function MetricCard({
  title,
  subtitle,
  value,
  targetLabel,
  remainingLabel,
  pct,
  status,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  progressColor,
  note,
  className,
}: MetricCardProps) {
  const chip = statusChip[status];
  const barColor = progressColor ?? progressColors[status];
  const clampedPct = Math.min(pct, 100);

  return (
    <div className={cn(
      "bg-card rounded-2xl border border-border shadow-card hover:shadow-card-hover transition-shadow duration-200 overflow-hidden flex flex-col",
      className
    )}>
      {/* Top accent line */}
      <div className={cn(
        "h-0.5 w-full",
        status === "atingido" ? "bg-emerald-400" : status === "quase" ? "bg-amber-400" : status === "pendente" ? "bg-red-400" : "bg-primary"
      )} />

      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Row 1: icon + title + chip */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
              <Icon className={cn("h-4.5 w-4.5", iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight truncate">{title}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 mt-0.5", chip.cls)}>
            {chip.label}
          </span>
        </div>

        {/* Row 2: main value */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-black tracking-tight tabular-nums text-foreground leading-none">
            {value}
          </span>
          {targetLabel && (
            <span className="text-xs text-muted-foreground font-medium">{targetLabel}</span>
          )}
        </div>

        {/* Row 3: progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Progresso</span>
            <span className={cn(
              "text-xs font-bold tabular-nums",
              status === "atingido" ? "text-emerald-600" : status === "quase" ? "text-amber-600" : "text-muted-foreground"
            )}>
              {clampedPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", barColor)}
              style={{ width: `${clampedPct}%` }}
            />
          </div>
        </div>

        {/* Row 4: remaining / note */}
        {(remainingLabel || note) && (
          <div className={cn(
            "flex items-center gap-1.5 p-2 rounded-lg text-xs font-medium",
            status === "atingido"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/15 dark:text-emerald-400"
              : status === "quase"
              ? "bg-amber-50 text-amber-700 dark:bg-amber-900/15 dark:text-amber-400"
              : status === "pendente"
              ? "bg-red-50 text-red-600 dark:bg-red-900/15 dark:text-red-400"
              : "bg-muted/60 text-muted-foreground"
          )}>
            {status === "atingido"
              ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              : status === "quase"
              ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              : <Clock className="h-3.5 w-3.5 shrink-0" />
            }
            <span className="truncate">{remainingLabel ?? note}</span>
          </div>
        )}
      </div>
    </div>
  );
}
