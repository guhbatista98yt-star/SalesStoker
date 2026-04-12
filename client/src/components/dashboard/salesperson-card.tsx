import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Minus, List, Loader2, AlertCircle } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/calendar-utils";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Salesperson } from "@shared/schema";

interface SalespersonStats {
  totalVendas: number;
  ticketMedio: number;
  positivacao: number;
  mixProdutos: number;
  conexoesSobreTubos: number | null;
  yoyVariacao: number;
  metaProgress: number;
}

interface SalespersonCardProps {
  salesperson: Salesperson;
  stats: SalespersonStats;
  period?: { startDate: string; endDate: string };
  onClick?: () => void;
  showMovimentacoesButton?: boolean;
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = dateStr.split("T")[0];
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

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

export function SalespersonCard({
  salesperson,
  stats,
  period,
  onClick,
  showMovimentacoesButton = true,
}: SalespersonCardProps) {
  const initials = salesperson.name.split(" ").map(n => n[0]).slice(0, 2).join("");
  const [showMovimentacoes, setShowMovimentacoes] = useState(false);

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

          {/* ── Footer: movimentações ──────────────────────────── */}
          {showMovimentacoesButton && (
            <div className="pt-2 border-t border-border/60">
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
    </>
  );
}
