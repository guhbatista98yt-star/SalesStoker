import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DollarSign, TrendingUp, Target, Users, Search,
  ChevronDown, Calendar, AlertTriangle, Trophy, Settings,
} from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import type { CommissionResult } from "@shared/schema";

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function getRankBadge(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return `${i + 1}º`;
}

function getStatusVariant(pct: number): "default" | "secondary" | "destructive" | "outline" {
  if (pct >= 100) return "default";
  if (pct >= 85) return "secondary";
  return "destructive";
}

export default function GestorView() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { today, MONTH, YEAR } = useMemo(() => {
    const d = new Date();
    return { today: d, MONTH: d.getMonth() + 1, YEAR: d.getFullYear() };
  }, []);

  const monthLabel = format(startOfMonth(today), "MMMM yyyy", { locale: ptBR });

  const { data: teamData = [], isLoading } = useQuery<CommissionResult[]>({
    queryKey: ["/api/commissions/team", MONTH, YEAR],
    queryFn: async () => {
      const res = await fetch(`/api/commissions/team/${MONTH}/${YEAR}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar comissões da equipe");
      return res.json();
    },
  });

  const filtered = teamData.filter(r =>
    r.salespersonName.toLowerCase().includes(search.toLowerCase())
  );

  const totalCommission = teamData.reduce((s, r) => s + r.totalAmount, 0);
  const totalSales = teamData.reduce((s, r) => s + r.netSales, 0);
  const avgAchievement = teamData.length > 0
    ? teamData.reduce((s, r) => s + r.goalAchievement, 0) / teamData.length
    : 0;
  const withTravas = teamData.filter(r => r.goalAchievement < 85).length;

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight">Comissões — Gestão</h1>
            <span className="hidden sm:inline text-xs text-muted-foreground capitalize">{monthLabel}</span>
          </div>
          {isAdmin && (
            <Link href="/comissoes/configurar">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Settings className="h-3.5 w-3.5" />
                Configurar Regras
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3.5 w-3.5" /> Comissão Total
              </div>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmtBRL(totalCommission)}</p>
              <p className="text-xs text-muted-foreground">{teamData.length} vendedores</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5" /> Vendas Líquidas
              </div>
              <p className="text-xl font-bold">{fmtBRL(totalSales)}</p>
              <p className="text-xs text-muted-foreground">soma da equipe</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Target className="h-3.5 w-3.5" /> Atingimento Médio
              </div>
              <p className="text-xl font-bold">{avgAchievement.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">da meta mensal</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Abaixo de 85%
              </div>
              <p className={`text-xl font-bold ${withTravas > 0 ? "text-red-500" : "text-emerald-500"}`}>
                {withTravas}
              </p>
              <p className="text-xs text-muted-foreground">sem comissão base</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar vendedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.length} de {teamData.length}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-card rounded-xl animate-pulse border border-border" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum vendedor encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r, i) => {
              const initials = r.salespersonName.split(" ").map(n => n[0]).slice(0, 2).join("");
              const isExpanded = expandedId === r.salespersonId;
              const rankIndex = teamData.findIndex(x => x.salespersonId === r.salespersonId);

              return (
                <Collapsible
                  key={r.salespersonId}
                  open={isExpanded}
                  onOpenChange={v => setExpandedId(v ? r.salespersonId : null)}
                >
                  <Card>
                    <CollapsibleTrigger className="w-full text-left">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-bold text-muted-foreground w-7 text-center shrink-0">
                            {getRankBadge(rankIndex)}
                          </div>
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold truncate">{r.salespersonName}</p>
                              <Badge
                                variant={getStatusVariant(r.goalAchievement)}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {r.goalAchievement.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <Progress value={Math.min(r.goalAchievement, 100)} className="flex-1 h-1.5" />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {r.weeksAchieved}/{r.weeksTotal} sem.
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                              {fmtBRL(r.totalAmount)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{fmtBRL(r.netSales)}</p>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-0 border-t border-border/50 space-y-2 mt-0">
                        <div className="grid grid-cols-3 gap-3 pt-3">
                          {[
                            { label: "Base", val: r.baseAmount },
                            { label: "Semanal", val: r.bonusAmount },
                            { label: "Estratégico", val: r.strategicAmount },
                          ].map(c => (
                            <div key={c.label} className="text-center p-2 rounded-lg bg-muted/40">
                              <p className="text-xs text-muted-foreground">{c.label}</p>
                              <p className="text-sm font-semibold mt-0.5">{fmtBRL(c.val)}</p>
                            </div>
                          ))}
                        </div>
                        {r.steps.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <p className="text-xs font-medium text-muted-foreground">Memória de cálculo</p>
                            {r.steps.map((step, si) => (
                              <div key={si} className="flex items-start justify-between gap-2 text-xs">
                                <span className="text-muted-foreground flex-1">{step.detail}</span>
                                <span className={`font-semibold shrink-0 ${step.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                  {step.amount >= 0 ? "+" : ""}{fmtBRL(step.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
