import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, Info } from "lucide-react";

export interface Requirement {
  id: string;
  label: string;
  sublabel?: string;
  value: string;
  target: string;
  pct: number;
  ok: boolean;
  critical?: boolean;
}

interface CampaignStatusBannerProps {
  eligible: boolean;
  requirements: Requirement[];
  callToAction?: string;
  rewardLabel?: string;
  className?: string;
}

function RequirementRow({ req }: { req: Requirement }) {
  const pct = Math.min(req.pct, 100);

  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-xl border transition-colors",
      req.ok
        ? "bg-emerald-50/60 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/30"
        : req.pct >= 80
        ? "bg-amber-50/60 border-amber-100 dark:bg-amber-900/10 dark:border-amber-800/30"
        : "bg-red-50/40 border-red-100 dark:bg-red-900/10 dark:border-red-800/30"
    )}>
      {/* Status icon + label */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
          req.ok ? "bg-emerald-100 dark:bg-emerald-900/30" : req.pct >= 80 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-red-100 dark:bg-red-900/30"
        )}>
          {req.ok
            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            : req.pct >= 80
            ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            : <XCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
          }
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{req.label}</p>
          {req.sublabel && <p className="text-xs text-muted-foreground leading-tight truncate">{req.sublabel}</p>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-1 min-w-[100px] max-w-[180px] sm:max-w-[200px]">
        <div className="h-1.5 bg-white/80 dark:bg-black/20 rounded-full overflow-hidden border border-border/30">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              req.ok ? "bg-emerald-500" : req.pct >= 80 ? "bg-amber-500" : "bg-red-400"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Value + target */}
      <div className="flex items-center gap-2 text-right shrink-0">
        <div>
          <p className={cn(
            "text-sm font-bold tabular-nums leading-tight",
            req.ok ? "text-emerald-700 dark:text-emerald-400" : req.pct >= 80 ? "text-amber-700 dark:text-amber-400" : "text-red-600 dark:text-red-400"
          )}>
            {req.value}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">meta: {req.target}</p>
        </div>
        <span className={cn(
          "text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0",
          req.ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                 : req.pct >= 80 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                 : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        )}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export function CampaignStatusBanner({
  eligible,
  requirements,
  callToAction,
  rewardLabel,
  className,
}: CampaignStatusBannerProps) {
  const completedCount = requirements.filter(r => r.ok).length;
  const pendingReqs = requirements.filter(r => !r.ok);

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden shadow-sm",
      eligible
        ? "border-emerald-200 dark:border-emerald-800"
        : "border-border",
      className
    )}>
      {/* Header strip */}
      <div className={cn(
        "px-5 py-3.5 flex items-center justify-between gap-4",
        eligible
          ? "bg-emerald-50 dark:bg-emerald-900/10"
          : "bg-muted/40"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
            eligible ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-muted"
          )}>
            {eligible
              ? <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
              : <Info className="h-4 w-4 text-muted-foreground" />
            }
          </div>
          <div>
            <p className={cn(
              "text-base font-bold leading-tight",
              eligible ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
            )}>
              {eligible ? "Você está elegível!" : "Situação atual"}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">
              {completedCount} de {requirements.length} critérios atingidos
            </p>
          </div>
        </div>

        {rewardLabel && (
          <div className={cn(
            "text-right hidden sm:block",
            eligible ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
          )}>
            <p className="text-xs font-medium uppercase tracking-wide">Prêmio</p>
            <p className="text-sm font-bold">{rewardLabel}</p>
          </div>
        )}
      </div>

      {/* Requirements list */}
      <div className="bg-card px-5 py-4 space-y-2">
        {requirements.map(req => (
          <RequirementRow key={req.id} req={req} />
        ))}
      </div>

      {/* Call to action / info */}
      {(callToAction || pendingReqs.length > 0) && (
        <div className={cn(
          "px-5 py-3 border-t flex items-center gap-2",
          eligible ? "bg-emerald-50/50 dark:bg-emerald-900/5 border-emerald-100 dark:border-emerald-800/30" : "bg-muted/20 border-border"
        )}>
          <ArrowRight className={cn(
            "h-3.5 w-3.5 shrink-0",
            eligible ? "text-emerald-600" : "text-muted-foreground"
          )} />
          <p className={cn(
            "text-xs font-medium",
            eligible ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
          )}>
            {callToAction || (pendingReqs.length === 1
              ? `Falta apenas 1 critério para você se tornar elegível`
              : `Faltam ${pendingReqs.length} critérios para elegibilidade`
            )}
          </p>
        </div>
      )}
    </div>
  );
}
