import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calculator, Download, RefreshCw, Trophy, Users, CheckCircle2,
  XCircle, ChevronDown, ChevronRight, Loader2, Clock, Info,
  TrendingUp, DollarSign, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApuracaoResult, VendedorApuracao } from "../types";

interface ResultadosTabProps {
  campaignId: string;
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return ok ? (
    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-[10px]">
      <CheckCircle2 className="h-2.5 w-2.5 mr-1" />{label || "Sim"}
    </Badge>
  ) : (
    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px]">
      <XCircle className="h-2.5 w-2.5 mr-1" />{label || "Não"}
    </Badge>
  );
}

function MedailhaIcon({ posicao }: { posicao: number }) {
  if (posicao === 1) return <span className="text-amber-500 font-bold text-sm">🥇</span>;
  if (posicao === 2) return <span className="text-zinc-400 font-bold text-sm">🥈</span>;
  if (posicao === 3) return <span className="text-amber-700 font-bold text-sm">🥉</span>;
  return <span className="text-xs text-muted-foreground font-mono">{posicao}º</span>;
}

function SummaryCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", color || "text-muted-foreground")} />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function VendedorRow({ d, mode }: { d: VendedorApuracao; mode: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      "border rounded-md overflow-hidden",
      d.premiado ? "border-green-200 dark:border-green-800" : "border-border",
    )}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Position */}
        <div className="w-8 shrink-0 flex justify-center">
          {d.posicao
            ? <MedailhaIcon posicao={d.posicao} />
            : <span className="text-[10px] text-muted-foreground">—</span>}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{d.vendedorNome}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{d.vendedorId}</p>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge ok={d.atingiu} label={d.atingiu ? "Atingiu" : "Não atingiu"} />
          {d.premiado && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px]">
              <Trophy className="h-2.5 w-2.5 mr-1" />Premiado
            </Badge>
          )}
        </div>

        {/* Values */}
        <div className="hidden sm:flex items-center gap-4 shrink-0 text-xs text-right">
          <div>
            <p className="text-[10px] text-muted-foreground">Apurado</p>
            <p className="font-mono font-medium">R$ {formatBRL(d.valorApuracao)}</p>
          </div>
          {d.premiado && (
            <div>
              <p className="text-[10px] text-muted-foreground">Prêmio</p>
              <p className="font-mono font-bold text-green-700 dark:text-green-400">R$ {formatBRL(d.premioFinal)}</p>
            </div>
          )}
          {mode === "ranking_crescimento" && d.crescimentoPerc !== undefined && (
            <div>
              <p className="text-[10px] text-muted-foreground">Crescimento</p>
              <p className={cn("font-mono font-medium text-xs", d.crescimentoPerc >= 0 ? "text-green-600" : "text-red-600")}>
                {d.crescimentoPerc >= 0 ? "+" : ""}{d.crescimentoPerc.toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {/* Expand icon */}
        <div className="shrink-0">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded memory */}
      {expanded && (
        <div className="border-t bg-muted/20 px-3 py-3 space-y-3">
          {/* Quick numbers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-[10px] text-muted-foreground">Valor apurado</p>
              <p className="font-mono font-medium">R$ {formatBRL(d.valorApuracao)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Valor pagamento</p>
              <p className="font-mono">R$ {formatBRL(d.valorPagamento)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Qtd apurada</p>
              <p className="font-mono">{d.qtdTotal.toFixed(0)} un.</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Mix (produtos distintos)</p>
              <p className="font-mono">{d.mixCount}</p>
            </div>
            {d.gatilhoValor > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground">Gatilho individual</p>
                <p className="font-mono">R$ {formatBRL(d.gatilhoValor)}</p>
              </div>
            )}
            {d.premiado && (
              <>
                <div>
                  <p className="text-[10px] text-muted-foreground">Prêmio calculado</p>
                  <p className="font-mono">R$ {formatBRL(d.premioCalculado)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Prêmio final</p>
                  <p className="font-mono font-bold text-green-700 dark:text-green-400">R$ {formatBRL(d.premioFinal)}</p>
                </div>
              </>
            )}
          </div>

          {/* Status flags */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge ok={d.elegivel} label="Elegível" />
            <StatusBadge ok={d.participou} label="Participou" />
            <StatusBadge ok={d.gatilhoAtingido} label="Gatilho atingido" />
            <StatusBadge ok={d.atingiu} label="Atingiu condições" />
            <StatusBadge ok={d.premiado} label="Premiado" />
          </div>

          {/* Non-participation reasons */}
          {d.motivosNaoParticipacao.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-red-600 dark:text-red-400">Motivos de não participação:</p>
              {d.motivosNaoParticipacao.map((m, i) => (
                <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                  <XCircle className="h-3 w-3 shrink-0 text-red-400 mt-0.5" /> {m}
                </p>
              ))}
            </div>
          )}

          {/* Memory of calculation steps */}
          {d.memoriaCalculo?.passos?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Memória de cálculo:</p>
              <div className="space-y-0.5 pl-2 border-l-2 border-muted">
                {d.memoriaCalculo.passos.map((p, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground">{p}</p>
                ))}
              </div>
              {d.memoriaCalculo.formulaPremio && (
                <p className="text-[10px] font-medium text-foreground mt-2 pl-2">
                  Fórmula: {d.memoriaCalculo.formulaPremio}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ResultadosTab({ campaignId }: ResultadosTabProps) {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"ranking" | "todos">("ranking");

  const { data: result, isLoading, refetch } = useQuery<ApuracaoResult>({
    queryKey: [`/api/campaigns/${campaignId}/resultados`],
    retry: false,
  });

  const apurarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/apurar`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro na apuração");
      }
      return res.json() as Promise<ApuracaoResult>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/campaigns/${campaignId}/resultados`], data);
      toast({ title: "Apuração concluída!", description: `${data.totalPremiados} vendedor(es) premiado(s)` });
    },
    onError: (e: any) => toast({ title: "Erro na apuração", description: e.message, variant: "destructive" }),
  });

  function exportCSV() {
    const url = `/api/campaigns/${campaignId}/resultados/export.csv`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.click();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando resultados...</span>
      </div>
    );
  }

  const mode = result?.campaignMode || "atingimento";

  const sortedDetails = result ? [...result.detalhes].sort((a, b) => {
    if (a.posicao !== undefined && b.posicao !== undefined) return a.posicao - b.posicao;
    if (a.posicao !== undefined) return -1;
    if (b.posicao !== undefined) return 1;
    if (b.premiado !== a.premiado) return b.premiado ? 1 : -1;
    return b.valorApuracao - a.valorApuracao;
  }) : [];

  const rankingDetails = sortedDetails.filter(d => d.posicao !== undefined);
  const naoPremiadoDetails = sortedDetails.filter(d => !d.premiado);

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Apuração da Campanha</h3>
          {result ? (
            <div className="flex items-center gap-2 mt-0.5">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground">
                Última apuração: {formatDate(result.apuradoEm)} por {result.apuradoPor}
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-0.5">Nenhuma apuração realizada ainda.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportCSV}>
              <Download className="h-3 w-3" /> Exportar CSV
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => apurarMutation.mutate()}
            disabled={apurarMutation.isPending}
          >
            {apurarMutation.isPending
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Apurando...</>
              : <><Calculator className="h-3 w-3" /> {result ? "Reapurar" : "Apurar Agora"}</>}
          </Button>
        </div>
      </div>

      {!result && !apurarMutation.isPending && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center border rounded-lg bg-muted/20">
          <Calculator className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma apuração disponível</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Clique em "Apurar Agora" para rodar o cálculo contra os dados reais de vendas.
            </p>
          </div>
        </div>
      )}

      {result && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Elegíveis"
              value={result.totalElegiveis}
              icon={Users}
              color="text-blue-500"
            />
            <SummaryCard
              label="Participantes"
              value={result.totalParticipantes}
              sub={`${result.totalElegiveis > 0 ? Math.round(result.totalParticipantes / result.totalElegiveis * 100) : 0}% do total`}
              icon={CheckCircle2}
              color="text-teal-500"
            />
            <SummaryCard
              label="Atingiram"
              value={result.totalAtingidos}
              sub={`${result.totalParticipantes > 0 ? Math.round(result.totalAtingidos / result.totalParticipantes * 100) : 0}% dos part.`}
              icon={TrendingUp}
              color="text-amber-500"
            />
            <SummaryCard
              label="Premiados"
              value={result.totalPremiados}
              icon={Trophy}
              color="text-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              label="Total Apurado (R$)"
              value={`R$ ${formatBRL(result.valorTotalApuracao)}`}
              icon={Package}
              color="text-blue-500"
            />
            <SummaryCard
              label="Total Premiação (R$)"
              value={`R$ ${formatBRL(result.valorTotalPremio)}`}
              icon={DollarSign}
              color="text-green-500"
            />
          </div>

          <Separator />

          {/* View toggle */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={activeView === "ranking" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setActiveView("ranking")}
            >
              <Trophy className="h-3 w-3 mr-1.5" />
              {mode.startsWith("ranking") ? "Ranking" : "Premiados"}
            </Button>
            <Button
              size="sm"
              variant={activeView === "todos" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setActiveView("todos")}
            >
              <Users className="h-3 w-3 mr-1.5" />
              Todos os vendedores
            </Button>
          </div>

          {/* Period info */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/40 rounded px-2 py-1.5">
            <Info className="h-3 w-3 shrink-0" />
            Período: {result.periodoInicio} a {result.periodoFim}
            {" · "}Modo: <strong>{result.campaignMode}</strong>
          </div>

          {/* Ranking/all list */}
          <div className="space-y-2">
            {activeView === "ranking" && (
              <>
                {/* Premiados */}
                {sortedDetails.filter(d => d.premiado).length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhum vendedor premiado nesta apuração.
                  </div>
                ) : (
                  <>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Premiados ({sortedDetails.filter(d => d.premiado).length})
                    </p>
                    {sortedDetails.filter(d => d.premiado).map(d => (
                      <VendedorRow key={d.vendedorId} d={d} mode={mode} />
                    ))}
                  </>
                )}

                {/* Atingiram mas não premiados */}
                {sortedDetails.filter(d => d.atingiu && !d.premiado).length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Atingiram (sem prêmio configurado)
                    </p>
                    {sortedDetails.filter(d => d.atingiu && !d.premiado).map(d => (
                      <VendedorRow key={d.vendedorId} d={d} mode={mode} />
                    ))}
                  </>
                )}
              </>
            )}

            {activeView === "todos" && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Todos os vendedores ({sortedDetails.length})
                </p>
                {sortedDetails.map(d => (
                  <VendedorRow key={d.vendedorId} d={d} mode={mode} />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
