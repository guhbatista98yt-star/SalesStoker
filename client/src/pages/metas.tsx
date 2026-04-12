import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/calendar-utils";
import type { GoalWithProgress } from "@shared/schema";
import { HelpButton, HelpDrawer, HELP_CONTENT } from "@/components/help";

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

export default function Metas() {
  const [helpOpen, setHelpOpen] = useState(false);
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const { data: goals = [], isLoading: goalsLoading, isError: goalsError } = useQuery<GoalWithProgress[]>({
    queryKey: ["/api/goals", "all", currentMonth.toString(), currentYear.toString()],
  });

  const summary = {
    total: goals.length,
    atingidas: goals.filter(g => g.progress >= 100).length,
    noCaminho: goals.filter(g => g.progress >= 75 && g.progress < 100).length,
    atencao: goals.filter(g => g.progress >= 50 && g.progress < 75).length,
    critico: goals.filter(g => g.progress < 50).length,
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Metas</h1>
          <HelpButton onClick={() => setHelpOpen(true)} />
          <span className="hidden sm:inline text-xs text-muted-foreground font-medium">
            {monthNames[currentMonth - 1]} {currentYear}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{summary.atingidas}</p>
              <p className="text-xs text-muted-foreground">Atingidas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.noCaminho}</p>
              <p className="text-xs text-muted-foreground">No Caminho</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{summary.atencao}</p>
              <p className="text-xs text-muted-foreground">Atenção</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{summary.critico}</p>
              <p className="text-xs text-muted-foreground">Crítico</p>
            </CardContent>
          </Card>
        </div>

        {goalsLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-20 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : goalsError ? (
          <div className="text-center py-16 flex flex-col items-center gap-3 text-destructive">
            <AlertCircle className="h-10 w-10 opacity-60" />
            <p className="text-base font-medium">Erro ao carregar metas</p>
            <p className="text-sm text-muted-foreground">Verifique a conexão e tente novamente.</p>
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhuma meta cadastrada</p>
            <p className="text-sm">Configure metas na aba de Configurações</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <Card key={goal.id} data-testid={`goal-card-${goal.id}`}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold truncate">
                          {goal.salespersonName}
                        </h3>
                        <Badge variant="outline" className={goal.type === "weekly" 
                          ? "text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800" 
                          : "text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800"}>
                          {goal.type === "weekly" ? "Semanal" : "Mensal"}
                        </Badge>
                        {getStatusBadge(goal.progress)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>Progresso: <span className="font-medium text-foreground">{formatCurrency(goal.currentValue)}</span></span>
                        <span>Meta: <span className="font-medium text-foreground">{formatCurrency(goal.targetValue)}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <Progress
                        value={Math.min(goal.progress, 100)}
                        className={`h-3 flex-1 ${getProgressColor(goal.progress)}`}
                      />
                      <span className="font-semibold min-w-[55px] text-right">
                        {goal.progress.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.metas} />
    </div>
  );
}
