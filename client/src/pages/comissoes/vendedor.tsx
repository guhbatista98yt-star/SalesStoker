import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DollarSign, TrendingUp, Target, CheckCircle2, XCircle,
  ChevronDown, Calendar, BarChart3, Layers, AlertTriangle,
} from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/lib/auth-context";
import { useMemo, useState } from "react";
import type { CommissionResult } from "@shared/schema";

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtPct(v: number) {
  return `${v.toFixed(2)}%`;
}

function layerLabel(layer: number) {
  switch (layer) {
    case 1: return "Base";
    case 2: return "Bônus Semanal";
    case 3: return "Acelerador";
    case 4: return "Estratégico";
    case 5: return "Mix";
    case 6: return "Redutor";
    case 7: return "Campanha";
    default: return `Camada ${layer}`;
  }
}

function layerColor(layer: number): string {
  switch (layer) {
    case 1: return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case 2: return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case 3: return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case 4: return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case 5: return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400";
    case 6: return "bg-red-500/10 text-red-600 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function VendedorView() {
  const { user } = useAuth();
  const [auditOpen, setAuditOpen] = useState(false);

  const { today, MONTH, YEAR } = useMemo(() => {
    const d = new Date();
    return { today: d, MONTH: d.getMonth() + 1, YEAR: d.getFullYear() };
  }, []);

  const { data, isLoading, error } = useQuery<CommissionResult>({
    queryKey: ["/api/commissions/me", MONTH, YEAR],
    queryFn: async () => {
      const res = await fetch(`/api/commissions/me/${MONTH}/${YEAR}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      return res.json();
    },
  });

  const monthLabel = format(startOfMonth(today), "MMMM yyyy", { locale: ptBR });

  if (isLoading) {
    return (
      <div className="h-full overflow-auto p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-card rounded-xl animate-pulse border border-border" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground space-y-2">
          <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" />
          <p className="text-lg font-medium">Vendedor não encontrado na base de dados</p>
          <p className="text-sm">Verifique se seu nome cadastrado corresponde ao nome no sistema de vendas.</p>
        </div>
      </div>
    );
  }

  const achievePct = Math.min(data.goalAchievement, 200);
  const nextThresholds = [85, 95, 100, 110, 120];
  const nextTarget = nextThresholds.find(t => data.goalAchievement < t) ?? null;
  const missingToNext = nextTarget
    ? Math.max(0, (nextTarget / 100) * data.goalMonthly - data.netSales)
    : 0;

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight">Minhas Comissões</h1>
            <span className="hidden sm:inline text-xs text-muted-foreground capitalize">{monthLabel}</span>
          </div>
          <Badge variant="outline" className="text-xs capitalize">{monthLabel}</Badge>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="col-span-2 sm:col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                Comissão Projetada
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {fmtBRL(data.totalAmount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{data.summary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <BarChart3 className="h-3.5 w-3.5" />
                Venda Líquida
              </div>
              <p className="text-lg font-bold">{fmtBRL(data.netSales)}</p>
              <p className="text-xs text-muted-foreground">Meta: {fmtBRL(data.goalMonthly)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Target className="h-3.5 w-3.5" />
                Atingimento
              </div>
              <p className="text-lg font-bold">{fmtPct(data.goalAchievement)}</p>
              <p className="text-xs text-muted-foreground">da meta mensal</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Progresso da Meta Mensal
              </span>
              <span className="text-muted-foreground">{fmtPct(data.goalAchievement)}</span>
            </div>
            <Progress value={Math.min(achievePct, 100)} className="h-3" />
            {nextTarget && data.goalMonthly > 0 && (
              <p className="text-xs text-muted-foreground">
                Faltam <strong>{fmtBRL(missingToNext)}</strong> para atingir {nextTarget}% e subir de faixa
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Semanas do Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {data.weeksTotal === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma meta semanal configurada para este mês.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: data.weeksTotal }, (_, i) => {
                  const achieved = i < data.weeksAchieved;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${achieved
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                        : "bg-muted border-border text-muted-foreground"}`}
                    >
                      {achieved
                        ? <CheckCircle2 className="h-3.5 w-3.5" />
                        : <XCircle className="h-3.5 w-3.5" />}
                      Semana {i + 1}
                    </div>
                  );
                })}
                {data.weeksTotal > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400 ml-auto">
                    {data.weeksAchieved}/{data.weeksTotal} semanas batidas
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Composição da Comissão
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {[
              { label: "Comissão Base",   val: data.baseAmount,       color: "text-blue-600 dark:text-blue-400" },
              { label: "Bônus Semanal",   val: data.bonusAmount,      color: "text-emerald-600 dark:text-emerald-400" },
              { label: "Bônus Estratégico", val: data.strategicAmount, color: "text-purple-600 dark:text-purple-400" },
              { label: "Deduções",        val: -data.deductions,      color: "text-red-600 dark:text-red-400" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={`font-semibold ${row.color}`}>{fmtBRL(row.val)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-base font-bold pt-1">
              <span>Total Projetado</span>
              <span className="text-emerald-600 dark:text-emerald-400">{fmtBRL(data.totalAmount)}</span>
            </div>
          </CardContent>
        </Card>

        <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Memória de Cálculo
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${auditOpen ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-4 space-y-2">
                {data.steps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma regra aplicada.</p>
                ) : (
                  data.steps.map((step, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/40 border border-border/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${layerColor(step.layer)}`}>
                            {layerLabel(step.layer)}
                          </span>
                          <span className="text-sm font-medium">{step.name}</span>
                        </div>
                        <span className={`text-sm font-bold ${step.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {step.amount >= 0 ? "+" : ""}{fmtBRL(step.amount)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-1">{step.detail}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
