import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Calendar, CalendarDays } from "lucide-react";
import { formatCurrency } from "@/lib/calendar-utils";
import type { GoalWithProgress } from "@shared/schema";

interface GoalsCardProps {
  goals: GoalWithProgress[];
  loading?: boolean;
  dragHandle?: React.ReactNode;
}

function getProgressColor(progress: number): string {
  if (progress >= 100) return "bg-emerald-500";
  if (progress >= 75) return "bg-blue-500";
  if (progress >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function getStatusBadge(progress: number) {
  if (progress >= 100) {
    return <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Atingida</Badge>;
  }
  if (progress >= 75) {
    return <Badge variant="secondary" className="text-xs">No caminho</Badge>;
  }
  if (progress >= 50) {
    return <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Atenção</Badge>;
  }
  return <Badge variant="destructive" className="text-xs">Crítico</Badge>;
}

function getTypeBadge(type: "weekly" | "monthly") {
  if (type === "weekly") {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Calendar className="h-3 w-3" />
        Semanal
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <CalendarDays className="h-3 w-3" />
      Mensal
    </Badge>
  );
}

export function GoalsCard({ goals, loading, dragHandle }: GoalsCardProps) {
  const topGoals = goals.slice(0, 5);

  return (
    <Card data-testid="goals-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {dragHandle}
          <Target className="h-5 w-5 text-primary" />
          Metas do Período
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </div>
                <div className="h-2 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhuma meta definida</p>
          </div>
        ) : (
          <div className="space-y-4">
            {topGoals.map((goal) => (
              <div key={goal.id} className="space-y-2" data-testid={`goal-item-${goal.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate max-w-[120px]">
                      {goal.salespersonName}
                    </span>
                    {getTypeBadge(goal.type)}
                  </div>
                  {getStatusBadge(goal.progress)}
                </div>
                <div className="flex items-center gap-3">
                  <Progress 
                    value={Math.min(goal.progress, 100)} 
                    className={`h-2 flex-1 ${getProgressColor(goal.progress)}`}
                  />
                  <span className="text-sm font-medium min-w-[50px] text-right">
                    {goal.progress.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Atual: {formatCurrency(goal.currentValue)}</span>
                  <span>Meta: {formatCurrency(goal.targetValue)}</span>
                </div>
              </div>
            ))}
            {goals.length > 5 && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                +{goals.length - 5} outras metas
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
