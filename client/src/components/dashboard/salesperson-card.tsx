import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Minus, List, Loader2, AlertCircle,
  AlertTriangle, CircleDollarSign, ChevronRight,
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

interface SalespersonCardProps {
  salesperson: Salesperson;
  stats: SalespersonStats;
  period?: { startDate: string; endDate: string };
  onClick?: () => void;
  showMovimentacoesButton?: boolean;
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

function riskBg(risco: string): string {
  switch (risco) {
    case "CRITICO":  return "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800";
    case "ATRASADO": return "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800";
    case "ATENCAO":  return "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800";
    default:         return "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800";
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

// ── Movimentações Modal ───────────────────────────────────────────────────────

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
  const totalDevol = data?.filter(m => m.isDevolucao).reduce((s, m) => s + m.valContabil, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle>
            Movimentações — {salesperson.name}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {period.startDate} a {period.endDate}
            </span>
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando movimentações...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-12 gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Erro ao carregar movimentações</span>
          </div>
        )}

        {data && !isLoading && (
          <>
            <div className="flex gap-4 mb-2 text-sm flex-wrap">
              <div className="bg-emerald-50 dark:bg-emerald-950 rounded px-3 py-1.5">
                <span className="text-muted-foreground">Vendas: </span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalVendas)}</span>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded px-3 py-1.5">
                <span className="text-muted-foreground">Devoluções: </span>
                <span className="font-semibold text-red-700 dark:text-red-400">{formatCurrency(totalDevol)}</span>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma movimentação encontrada neste período.
              </div>
            ) : (
              <ScrollArea className="h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Emp.</TableHead>
                      <TableHead>Nota/Cupom</TableHead>
                      <TableHead>Série</TableHead>
                      <TableHead className="text-right">Val. Contábil</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((mov, i) => (
                      <TableRow
                        key={i}
                        className={mov.isDevolucao ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400" : ""}
                      >
                        <TableCell className="whitespace-nowrap">{formatDate(mov.dtMovimento)}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{mov.nomeCliente || "-"}</TableCell>
                        <TableCell>{mov.idEmpresa}</TableCell>
                        <TableCell className="font-mono text-xs">{mov.numNota}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{mov.serieNota || "-"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(mov.valContabil)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Financial Details Sheet ───────────────────────────────────────────────────

function FinancialSheet({
  salesperson,
  open,
  onClose,
}: {
  salesperson: Salesperson;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery<{
    resumo: FinancialSummary | null;
    clientes: ClienteVencido[];
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

  const resumo = data?.resumo;
  const clientes = data?.clientes ?? [];

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
            Pendências Financeiras — {salesperson.name}
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
            <span>Erro ao carregar dados financeiros</span>
          </div>
        )}

        {!isLoading && !error && (
          <div className="mt-6 space-y-6">
            {resumo ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Vencido</p>
                    <p className="text-lg font-bold text-red-700 dark:text-red-400">{formatCurrency(Number(resumo.total_vencido))}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/40">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total em Aberto</p>
                    <p className="text-lg font-bold">{formatCurrency(Number(resumo.total_aberto))}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/40">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Clientes Vencidos</p>
                    <p className="text-lg font-bold">{resumo.clientes_vencidos ?? 0}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/40">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Maior Atraso</p>
                    <p className="text-lg font-bold">{resumo.maior_atraso ?? 0}d</p>
                  </div>
                </div>

                {clientes.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide text-[11px]">
                      Clientes com Pendências
                    </p>
                    <ScrollArea className="h-[360px]">
                      <div className="space-y-2 pr-2">
                        {clientes.map(cli => (
                          <div
                            key={cli.idclifor}
                            className="rounded-lg border p-3 text-sm flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate flex-1">{cli.nomecliente}</span>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] shrink-0", riskColor(cli.status_cliente))}
                              >
                                {riskLabel(cli.status_cliente)}
                              </Badge>
                            </div>
                            {cli.cidade_cobranca && (
                              <span className="text-[11px] text-muted-foreground">
                                {cli.cidade_cobranca}{cli.uf_cobranca ? ` — ${cli.uf_cobranca}` : ""}
                              </span>
                            )}
                            <div className="flex gap-4 text-[11px] mt-0.5">
                              <span className="text-muted-foreground">
                                Vencido: <span className="font-semibold text-red-600 dark:text-red-400">
                                  {formatCurrency(Number(cli.total_vencido))}
                                </span>
                              </span>
                              <span className="text-muted-foreground">
                                Atraso: <span className="font-semibold">{cli.maior_atraso}d</span>
                              </span>
                              <span className="text-muted-foreground">
                                Títulos: <span className="font-semibold">{cli.qtd_titulos}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <CircleDollarSign className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p>Nenhuma pendência financeira</p>
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

// ── Financial Indicator Strip ─────────────────────────────────────────────────

function FinancialIndicator({
  summary,
  onDetails,
}: {
  summary: FinancialSummary;
  onDetails: () => void;
}) {
  const totalVencido = Number(summary.total_vencido) || 0;
  const clientesVencidos = Number(summary.clientes_vencidos) || 0;
  const maiorAtraso = Number(summary.maior_atraso) || 0;
  const risco = summary.status_risco;

  if (totalVencido <= 0) return null;

  return (
    <div
      className={cn(
        "mt-2.5 rounded-lg border px-2.5 py-2 cursor-pointer hover:opacity-80 transition-opacity",
        riskBg(risco)
      )}
      onClick={e => { e.stopPropagation(); onDetails(); }}
      title="Ver pendências financeiras"
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1">
          <AlertTriangle className={cn("h-3 w-3 shrink-0", riskColor(risco))} />
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", riskColor(risco))}>
            Pendências Financeiras
          </span>
        </div>
        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("text-sm font-bold", riskColor(risco))}>
          {formatCurrency(totalVencido)}
        </span>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {clientesVencidos > 0 && `${clientesVencidos} cliente${clientesVencidos !== 1 ? "s" : ""}`}
          {clientesVencidos > 0 && maiorAtraso > 0 && " · "}
          {maiorAtraso > 0 && `${maiorAtraso}d atraso`}
        </span>
      </div>
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export function SalespersonCard({
  salesperson,
  stats,
  period,
  onClick,
  showMovimentacoesButton = true,
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

  return (
    <>
      <Card
        className="hover-elevate cursor-pointer transition-all"
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
          <div className="grid grid-cols-4 gap-x-2 gap-y-1.5 text-[11px] mb-3 bg-muted/40 rounded-lg px-2 py-2">
            <div>
              <p className="text-muted-foreground leading-none mb-0.5">Ticket</p>
              <p className="font-semibold leading-tight">{formatCurrency(stats.ticketMedio)}</p>
            </div>
            <div>
              <p className="text-muted-foreground leading-none mb-0.5">Posit.</p>
              <p className="font-semibold leading-tight">{stats.positivacao}</p>
            </div>
            <div>
              <p className="text-muted-foreground leading-none mb-0.5">Mix</p>
              <p className="font-semibold leading-tight">{stats.mixProdutos}</p>
            </div>
            <div>
              <p className="text-muted-foreground leading-none mb-0.5">T×C</p>
              <p className="font-semibold leading-tight">
                {stats.conexoesSobreTubos !== null
                  ? `${stats.conexoesSobreTubos.toFixed(0)}%`
                  : "—"}
              </p>
            </div>
          </div>

          {/* ── Financial delinquency indicator ───────────────── */}
          {financialSummary && (
            <FinancialIndicator
              summary={financialSummary}
              onDetails={() => setShowFinanceiro(true)}
            />
          )}

          {/* ── Footer: movimentações ──────────────────────────── */}
          {showMovimentacoesButton && (
            <div className={cn("pt-2 border-t border-border/60", financialSummary ? "mt-2.5" : "")}>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1.5 w-full"
                onClick={e => {
                  e.stopPropagation();
                  setShowMovimentacoes(true);
                }}
              >
                <List className="h-3 w-3" />
                Ver Movimentações
              </Button>
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
