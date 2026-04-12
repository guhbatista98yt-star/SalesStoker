import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Calendar, CalendarDays, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/calendar-utils";
import type { GoalWithProgress } from "@shared/schema";

interface GoalsCardProps {
  goals: GoalWithProgress[];
  loading?: boolean;
  dragHandle?: React.ReactNode;
}

const VISIBLE_COUNT = 5;

function getProgressBarColor(p: number) {
  if (p >= 100) return "bg-emerald-500";
  if (p >= 75) return "bg-primary";
  if (p >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function StatusBadge({ progress }: { progress: number }) {
  if (progress >= 100)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Atingida
      </span>
    );
  if (progress >= 75)
    return <span className="text-[11px] font-semibold text-primary">No caminho</span>;
  if (progress >= 50)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Atenção
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
      <AlertTriangle className="h-3 w-3" />
      Crítico
    </span>
  );
}

function TypeChip({ type }: { type: "weekly" | "monthly" }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
      {type === "weekly" ? (
        <><Calendar className="h-2.5 w-2.5" />Semanal</>
      ) : (
        <><CalendarDays className="h-2.5 w-2.5" />Mensal</>
      )}
    </span>
  );
}

function SkeletonGoals() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="skeleton h-3.5 w-28 rounded" />
            <div className="skeleton h-3.5 w-16 rounded" />
          </div>
          <div className="skeleton h-2 w-full rounded-full" />
          <div className="flex justify-between">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GoalsCard({ goals, loading, dragHandle }: GoalsCardProps) {
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? goals : goals.slice(0, VISIBLE_COUNT);
  const hidden = goals.length - VISIBLE_COUNT;

  return (
    <Card data-testid="goals-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {dragHandle}
          <Target className="h-4 w-4 text-primary" />
          Metas do Período
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SkeletonGoals />
        ) : goals.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhuma meta definida</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map((goal) => {
              const progress = goal.progress ?? 0;
              const pct = Math.min(progress, 100);
              return (
                <div key={goal.id} className="space-y-1.5" data-testid={`goal-item-${goal.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {goal.salespersonName}
                      </span>
                      <TypeChip type={goal.type} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold tabular-nums">{progress.toFixed(0)}%</span>
                      <StatusBadge progress={progress} />
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", getProgressBarColor(progress))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Atual: <span className="font-medium text-foreground">{formatCurrency(goal.currentValue ?? 0)}</span></span>
                    <span>Meta: <span className="font-medium text-foreground">{formatCurrency(goal.targetValue ?? 0)}</span></span>
                  </div>
                </div>
              );
            })}
            {hidden > 0 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className={cn(
                  "w-full flex items-center justify-center gap-1.5 pt-1",
                  "text-xs font-medium text-muted-foreground hover:text-foreground transition-colors",
                  "rounded-md hover:bg-muted/60 py-1.5"
                )}
                data-testid="goals-toggle-more"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    +{hidden} {hidden === 1 ? "outra meta" : "outras metas"}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
