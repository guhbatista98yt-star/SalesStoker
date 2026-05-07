import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Minus, List, Loader2, AlertCircle,
  CircleDollarSign, AlertTriangle, ChevronRight,
} from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/calendar-utils";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Salesperson } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────────

interface SalespersonStats {
  totalVendas: number;
  ticketMedio: number;
  positivacao: number;
  mixProdutos: number;
  conexoesSobreTubos: number | null;
  yoyVariacao: number;
  metaProgress: number;
}

export interface FinancialSummary {
  idvendedor: number;
  nomevendedor: string;
  clientes_pendencia: number;
  clientes_vencidos: number;
  qtd_titulos: number;
  qtd_titulos_vencidos: number;
  total_aberto: number;
  total_vencido: number;
  juros_pendente: number;
  maior_atraso: number;
  status_risco: "CRITICO" | "ATRASADO" | "ATENCAO" | "EM_DIA";
}

interface TituloVencido {
  idtitulo: number;
  digitotitulo: string;
  serienota: string;
  nomecliente: string;
  idclifor: number;
  dtvencimento: string;
  dias_atraso: number;
  valor_aberto: number;
  status: string;
}

interface SalespersonCardProps {
  salesperson: Salesperson;
  stats: SalespersonStats;
  period?: { startDate: string; endDate: string };
  onClick?: () => void;
  showMovimentacoesButton?: boolean;
  showFinanceiroButton?: boolean;
  financialSummary?: FinancialSummary | null;
}

interface Movimentacao {
  dtMovimento: string;
  idCliente: string;
  nomeCliente: string;
  idEmpresa: number;
  numNota: string;
  serieNota: string;
  tipoMovimento: string;
  isDevolucao: boolean;
  valContabil: number;
  lucro: number;
}

interface ClienteVencido {
  idclifor: number;
  nomecliente: string;
  cidade_cobranca: string;
  uf_cobranca: string;
  qtd_titulos: number;
  total_aberto: number;
  total_vencido: number;
  maior_atraso: number;
  status_cliente: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = dateStr.split("T")[0];
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function riskColor(risco: string): string {
  switch (risco) {
    case "CRITICO":  return "text-red-600 dark:text-red-400";
    case "ATRASADO": return "text-orange-600 dark:text-orange-400";
    case "ATENCAO":  return "text-amber-600 dark:text-amber-400";
    default:         return "text-emerald-600 dark:text-emerald-400";
  }
}

function riskLabel(risco: string): string {
  switch (risco) {
    case "CRITICO":  return "Crítico";
    case "ATRASADO": return "Atrasado";
    case "ATENCAO":  return "Atenção";
    default:         return "Em dia";
  }
}

// ── Movimentações Sheet ───────────────────────────────────────────────────────

function MovimentacoesModal({
  salesperson,
  period,
  open,
  onClose,
}: {
  salesperson: Salesperson;
  period: { startDate: string; endDate: string };
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery<Movimentacao[]>({
    queryKey: ["/api/movimentacoes", salesperson.id, period.startDate, period.endDate],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/movimentacoes/${encodeURIComponent(salesperson.id)}/${period.startDate}/${period.endDate}`
      );
      return res.json();
    },
    enabled: open,
  });

  const totalVendas = data?.filter(m => !m.isDevolucao).reduce((s, m) => s + m.valContabil, 0) ?? 0;
  const totalDevol  = data?.filter(m => m.isDevolucao).reduce((s, m) => s + m.valContabil, 0) ?? 0;

  const totalNFs  = data?.filter(m => !m.isDevolucao).length ?? 0;
  const totalDevs = data?.filter(m => m.isDevolucao).length ?? 0;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="h-[85dvh] sm:h-auto sm:max-h-[90vh] sm:w-[680px] sm:right-0 sm:left-auto sm:rounded-l-xl rounded-t-xl flex flex-col">
        <SheetHeader className="pb-2 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base leading-tight">
            <List className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">Movimentações — {salesperson.name}</span>
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {period.startDate} a {period.endDate}
          </p>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando movimentações...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-16 gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Erro ao carregar movimentações</span>
          </div>
        )}

        {data && !isLoading && (
          <div className="flex-1 overflow-y-auto mt-4 pb-6 space-y-3">
            {/* Totais */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border p-3 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Vendas</p>
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 truncate">{formatCurrency(totalVendas)}</p>
              </div>
              <div className="rounded-lg border p-3 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Devoluções</p>
                <p className="text-base font-bold text-red-700 dark:text-red-400 truncate">{formatCurrency(totalDevol)}</p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/40">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Qtd. NFs</p>
                <p className="text-base font-bold">{totalNFs}</p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/40">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Qtd. Devol.</p>
                <p className="text-base font-bold">{totalDevs}</p>
              </div>
            </div>

            {/* Lista */}
            {data.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <List className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhuma movimentação</p>
                <p className="text-sm mt-1">Sem registros neste período.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap w-[90px]">Data</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap w-[70px]">NF</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Cliente</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap w-[110px]">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((mov, i) => (
                        <tr
                          key={i}
                          className={cn(
                            "border-b last:border-0 transition-colors",
                            mov.isDevolucao
                              ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                              : "hover:bg-muted/30"
                          )}
                        >
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDate(mov.dtMovimento)}</td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap">{mov.numNota || "—"}</td>
                          <td className="px-3 py-2">
                            <span className="block truncate max-w-[180px] sm:max-w-none">{mov.nomeCliente || "—"}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                            {formatCurrency(mov.valContabil)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Helpers para dias em atraso ───────────────────────────────────────────────

function diasAtrasoColor(dias: number): string {
  if (dias > 30) return "text-red-600 dark:text-red-400 font-bold";
  if (dias >= 8)  return "text-orange-600 dark:text-orange-400 font-semibold";
  if (dias >= 1)  return "text-amber-600 dark:text-amber-400 font-semibold";
  return "text-muted-foreground";
}

// ── Financial Pendencies Sheet ────────────────────────────────────────────────

function FinancialSheet({
  salesperson,
  open,
  onClose,
}: {
  salesperson: Salesperson;
  open: boolean;
  onClose: () => void;
}) {
  const [expandedClientId, setExpandedClientId] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery<{
    resumo: FinancialSummary | null;
    clientes: ClienteVencido[];
    top_titulos: TituloVencido[];
  }>({
    queryKey: ["/api/financeiro/contas-receber/vendedor", salesperson.id],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/financeiro/contas-receber/vendedor/${encodeURIComponent(salesperson.id)}`
      );
      return res.json();
    },
    enabled: open,
  });

  const resumo   = data?.resumo;
  const clientes = data?.clientes ?? [];
  const titulos  = data?.top_titulos ?? [];

  // Group titles by client id for quick lookup
  const titulosByCliente = titulos.reduce<Record<number, TituloVencido[]>>((acc, t) => {
    const key = t.idclifor;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  function toggleCliente(id: number) {
    setExpandedClientId(prev => (prev === id ? null : id));
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="bottom" className="h-[85dvh] sm:h-auto sm:max-h-[90vh] sm:w-[600px] sm:right-0 sm:left-auto sm:rounded-l-xl rounded-t-xl flex flex-col">
        <SheetHeader className="pb-2 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base leading-tight">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">Pendências — {salesperson.name}</span>
          </SheetTitle>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando...</span>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-16 gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Erro ao carregar dados</span>
          </div>
        )}

        {!isLoading && !error && (
          <div className="flex-1 overflow-y-auto mt-4 space-y-4 pb-6">
            {resumo ? (
              <>
                {/* ── KPI Cards ─────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border p-3 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Vencido</p>
                    <p className="text-base font-bold text-red-700 dark:text-red-400 truncate">{formatCurrency(Number(resumo.total_vencido))}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/40">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total em Aberto</p>
                    <p className="text-base font-bold truncate">{formatCurrency(Number(resumo.total_aberto))}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/40">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Clientes Vencidos</p>
                    <p className="text-base font-bold">{resumo.clientes_vencidos ?? 0}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/40">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Títulos Vencidos</p>
                    <p className="text-base font-bold">{Number(resumo.qtd_titulos_vencidos) || titulos.length}</p>
                  </div>
                </div>

                {/* ── Accordion por cliente ──────────────────────────── */}
                {clientes.length > 0 ? (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">
                      Clientes com Pendências
                    </p>
                    <div className="rounded-lg border overflow-hidden divide-y divide-border">
                      {clientes.map(c => {
                        const isExpanded = expandedClientId === c.idclifor;
                        const clienteTitulos = titulosByCliente[c.idclifor] ?? [];
                        const maiorAtraso = Number(c.maior_atraso);

                        return (
                          <div key={c.idclifor}>
                            {/* ── Linha do cliente (clicável) ── */}
                            <button
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors",
                                isExpanded
                                  ? "bg-muted/60"
                                  : "hover:bg-muted/30"
                              )}
                              onClick={() => toggleCliente(c.idclifor)}
                            >
                              <ChevronRight
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                                  isExpanded && "rotate-90"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate leading-snug">{c.nomecliente}</p>
                                {(c.cidade_cobranca || c.uf_cobranca) && (
                                  <p className="text-[10px] text-muted-foreground leading-tight">
                                    {[c.cidade_cobranca, c.uf_cobranca].filter(Boolean).join(" — ")}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 font-normal"
                                >
                                  {c.qtd_titulos} tít.
                                </Badge>
                                <span className={cn(
                                  "text-xs font-bold tabular-nums",
                                  diasAtrasoColor(maiorAtraso)
                                )}>
                                  {maiorAtraso}d
                                </span>
                                <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums whitespace-nowrap">
                                  {formatCurrency(Number(c.total_vencido))}
                                </span>
                              </div>
                            </button>

                            {/* ── Sub-lista de títulos (expansível) ── */}
                            {isExpanded && (
                              <div className="border-t border-border bg-muted/20">
                                {clienteTitulos.length === 0 ? (
                                  <p className="text-xs text-muted-foreground px-4 py-3">
                                    Detalhes não disponíveis.
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                      <thead>
                                        <tr className="border-b border-border bg-muted/40">
                                          <th className="text-left px-4 py-1.5 font-semibold text-muted-foreground">Título</th>
                                          <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Vencimento</th>
                                          <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Atraso</th>
                                          <th className="text-right px-4 py-1.5 font-semibold text-muted-foreground whitespace-nowrap">Valor</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {clienteTitulos.map((t, i) => (
                                          <tr
                                            key={`${t.idtitulo}-${i}`}
                                            className="border-b last:border-0 border-border/60 hover:bg-muted/30 transition-colors"
                                          >
                                            <td className="px-4 py-2 font-mono text-muted-foreground">
                                              {t.idtitulo}{t.digitotitulo ? `-${t.digitotitulo}` : ""}
                                            </td>
                                            <td className="px-2 py-2 text-center tabular-nums whitespace-nowrap">
                                              {formatDate(t.dtvencimento)}
                                            </td>
                                            <td className={cn("px-2 py-2 text-center tabular-nums whitespace-nowrap", diasAtrasoColor(Number(t.dias_atraso)))}>
                                              {Number(t.dias_atraso)}d
                                            </td>
                                            <td className="px-4 py-2 text-right font-semibold tabular-nums whitespace-nowrap text-red-600 dark:text-red-400">
                                              {formatCurrency(Number(t.valor_aberto))}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : titulos.length > 0 ? (
                  /* Fallback: se não tem clientes agrupados mas tem títulos, mostra plano */
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">
                      Títulos em Atraso
                    </p>
                    <div className="rounded-lg border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-muted/40 border-b">
                              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Cliente</th>
                              <th className="text-center px-2 py-2 font-semibold text-muted-foreground whitespace-nowrap w-[90px]">Vencimento</th>
                              <th className="text-center px-2 py-2 font-semibold text-muted-foreground whitespace-nowrap w-[60px]">Atraso</th>
                              <th className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap w-[100px]">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {titulos.map((t, i) => (
                              <tr key={`${t.idtitulo}-${i}`} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="px-3 py-2">
                                  <span className="block font-medium leading-snug">{t.nomecliente}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    Tít. {t.idtitulo}{t.digitotitulo ? `-${t.digitotitulo}` : ""}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-center tabular-nums whitespace-nowrap">{formatDate(t.dtvencimento)}</td>
                                <td className={cn("px-2 py-2 text-center tabular-nums whitespace-nowrap", diasAtrasoColor(Number(t.dias_atraso)))}>
                                  {Number(t.dias_atraso)}d
                                </td>
                                <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap text-red-600 dark:text-red-400">
                                  {formatCurrency(Number(t.valor_aberto))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum título vencido.</p>
                )}
              </>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <CircleDollarSign className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Sem pendências financeiras</p>
                <p className="text-sm mt-1">Este vendedor não possui duplicatas em aberto.</p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetaBar({ value }: { value: number }) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const color =
    value >= 100 ? "bg-emerald-500" :
    value >= 80  ? "bg-emerald-400" :
    value >= 60  ? "bg-amber-400" :
    "bg-red-400";
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function YoyBadge({ value }: { value: number }) {
  if (value > 0) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
      <TrendingUp className="h-2.5 w-2.5" />
      {formatPercentage(value)}
    </span>
  );
  if (value < 0) return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 shrink-0">
      <TrendingDown className="h-2.5 w-2.5" />
      {formatPercentage(value)}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
      <Minus className="h-2.5 w-2.5" />
      0%
    </span>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export function SalespersonCard({
  salesperson,
  stats,
  period,
  onClick,
  showMovimentacoesButton = true,
  showFinanceiroButton = false,
  financialSummary,
}: SalespersonCardProps) {
  const initials = salesperson.name.split(" ").map(n => n[0]).slice(0, 2).join("");
  const [showMovimentacoes, setShowMovimentacoes] = useState(false);
  const [showFinanceiro, setShowFinanceiro] = useState(false);

  const defaultPeriod = period ?? {
    startDate: new Date().toISOString().split("T")[0].slice(0, 7) + "-01",
    endDate: new Date().toISOString().split("T")[0],
  };

  const metaPct = stats.metaProgress ?? 0;
  const metaLabel =
    metaPct >= 100 ? "Meta atingida!" :
    metaPct >= 80  ? `Meta ${metaPct.toFixed(0)}%` :
    metaPct > 0    ? `Meta ${metaPct.toFixed(0)}%` :
    "Sem meta";

  const metaLabelColor =
    metaPct >= 100 ? "text-emerald-600 dark:text-emerald-400" :
    metaPct >= 80  ? "text-emerald-600 dark:text-emerald-400" :
    metaPct >= 60  ? "text-amber-600 dark:text-amber-400" :
    "text-red-600 dark:text-red-400";

  const hasFooter = showMovimentacoesButton || showFinanceiroButton;

  // Badge for overdue count on the Pendências button
  const vencidosCount = financialSummary ? Number(financialSummary.qtd_titulos_vencidos) || 0 : 0;

  return (
    <>
      <Card
        className="hover-elevate cursor-pointer transition-all overflow-hidden"
        onClick={onClick}
        data-testid={`salesperson-card-${salesperson.id}`}
      >
        <CardContent className="p-4">
          {/* ── Header: avatar + name + YoY badge ─────────────── */}
          <div className="flex items-center gap-2.5 mb-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <h3 className="font-semibold text-sm truncate leading-tight">{salesperson.name}</h3>
                <YoyBadge value={stats.yoyVariacao} />
              </div>
              <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                {salesperson.email}
              </p>
            </div>
          </div>

          {/* ── Main metric: Vendas + meta bar ─────────────────── */}
          <div className="mb-3">
            <div className="flex items-baseline justify-between mb-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Vendas</span>
              <span className={cn("text-[10px] font-medium", metaLabelColor)}>{metaLabel}</span>
            </div>
            <p className="text-xl font-bold tracking-tight leading-none mb-1.5">
              {formatCurrency(stats.totalVendas)}
            </p>
            <MetaBar value={metaPct} />
          </div>

          {/* ── Secondary metrics 4-col grid ──────────────────── */}
          <div className="grid grid-cols-4 gap-x-1 gap-y-1.5 text-[11px] mb-3 bg-muted/40 rounded-lg px-2 py-2">
            <div className="min-w-0">
              <p className="text-muted-foreground leading-none mb-0.5 truncate">Ticket</p>
              <p className="font-semibold leading-tight truncate">{formatCurrency(stats.ticketMedio)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground leading-none mb-0.5">Posit.</p>
              <p className="font-semibold leading-tight">{stats.positivacao}</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground leading-none mb-0.5">Mix</p>
              <p className="font-semibold leading-tight">{stats.mixProdutos}</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground leading-none mb-0.5">T×C</p>
              <p className="font-semibold leading-tight">
                {stats.conexoesSobreTubos !== null
                  ? `${stats.conexoesSobreTubos.toFixed(0)}%`
                  : "—"}
              </p>
            </div>
          </div>

          {/* ── Footer buttons ─────────────────────────────────── */}
          {hasFooter && (
            <div className="pt-2 border-t border-border/60">
              <div className={cn(
                "grid gap-1.5",
                showMovimentacoesButton && showFinanceiroButton ? "grid-cols-2" : "grid-cols-1"
              )}>
                {showMovimentacoesButton && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1 w-full min-w-0"
                    onClick={e => { e.stopPropagation(); setShowMovimentacoes(true); }}
                  >
                    <List className="h-3 w-3 shrink-0" />
                    <span className="truncate">Movimentações</span>
                  </Button>
                )}
                {showFinanceiroButton && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "h-7 px-2 text-xs gap-1 w-full min-w-0",
                      vencidosCount > 0 && "border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                    )}
                    onClick={e => { e.stopPropagation(); setShowFinanceiro(true); }}
                  >
                    {vencidosCount > 0
                      ? <AlertTriangle className="h-3 w-3 shrink-0" />
                      : <CircleDollarSign className="h-3 w-3 shrink-0" />
                    }
                    <span className="truncate">Pendências</span>
                    {vencidosCount > 0 && (
                      <span className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900 text-[9px] font-bold text-red-700 dark:text-red-300">
                        {vencidosCount > 99 ? "99+" : vencidosCount}
                      </span>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showMovimentacoes && (
        <MovimentacoesModal
          salesperson={salesperson}
          period={defaultPeriod}
          open={showMovimentacoes}
          onClose={() => setShowMovimentacoes(false)}
        />
      )}

      {showFinanceiro && (
        <FinancialSheet
          salesperson={salesperson}
          open={showFinanceiro}
          onClose={() => setShowFinanceiro(false)}
        />
      )}
    </>
  );
}
