import { cn } from "@/lib/utils";
import { Calculator, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export interface CalcStep {
  label: string;
  value: string;
  status?: "ok" | "fail" | "warn" | "neutral";
  note?: string;
}

interface CalculationMemoryProps {
  steps: CalcStep[];
  conclusion: string;
  conclusionStatus: "ok" | "fail" | "warn";
  className?: string;
}

const statusIcon = {
  ok:      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />,
  fail:    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />,
  warn:    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
  neutral: <span className="h-3.5 w-3.5 rounded-full bg-muted-foreground/30 shrink-0 inline-block" />,
};

export function CalculationMemory({ steps, conclusion, conclusionStatus, className }: CalculationMemoryProps) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border shadow-sm overflow-hidden", className)}>
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Calculator className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">Memória de Cálculo</p>
          <p className="text-xs text-muted-foreground leading-tight">Como o sistema calculou seu status</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start justify-between gap-3 py-1 border-b border-border/40 last:border-0">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <div className="mt-0.5">{statusIcon[step.status ?? "neutral"]}</div>
              <div className="min-w-0">
                <p className="text-sm text-foreground font-medium leading-tight">{step.label}</p>
                {step.note && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{step.note}</p>}
              </div>
            </div>
            <span className={cn(
              "text-sm font-bold tabular-nums shrink-0",
              step.status === "ok" ? "text-emerald-600 dark:text-emerald-400"
              : step.status === "fail" ? "text-red-600 dark:text-red-400"
              : step.status === "warn" ? "text-amber-600 dark:text-amber-400"
              : "text-foreground"
            )}>
              {step.value}
            </span>
          </div>
        ))}
      </div>

      {/* Conclusion */}
      <div className={cn(
        "mx-5 mb-5 p-3 rounded-xl text-sm font-medium flex items-start gap-2",
        conclusionStatus === "ok"   ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/15 dark:text-emerald-400"
        : conclusionStatus === "warn" ? "bg-amber-50 text-amber-700 dark:bg-amber-900/15 dark:text-amber-400"
        : "bg-red-50 text-red-700 dark:bg-red-900/15 dark:text-red-400"
      )}>
        {conclusionStatus === "ok"
          ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          : conclusionStatus === "warn"
          ? <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          : <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
        }
        {conclusion}
      </div>
    </div>
  );
}
