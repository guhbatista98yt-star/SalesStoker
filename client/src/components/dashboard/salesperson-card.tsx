import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Minus, ChevronRight, List, Loader2, AlertCircle } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/calendar-utils";
import { apiRequest } from "@/lib/queryClient";
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

function getTrendIcon(value: number | null) {
  if (value === null) return null;
  if (value > 0) return <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function getValueColor(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
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
  const totalLucro = data?.reduce((s, m) => s + m.lucro, 0) ?? 0;

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
              <div className="bg-muted rounded px-3 py-1.5">
                <span className="text-muted-foreground">Lucro: </span>
                <span className={`font-semibold ${totalLucro >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                  {formatCurrency(totalLucro)}
                </span>
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
                      <TableHead className="text-right">Lucro</TableHead>
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
                        <TableCell className="text-right whitespace-nowrap">
                          {formatCurrency(mov.lucro)}
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

export function SalespersonCard({ salesperson, stats, period, onClick }: SalespersonCardProps) {
  const initials = salesperson.name.split(" ").map(n => n[0]).slice(0, 2).join("");
  const [showMovimentacoes, setShowMovimentacoes] = useState(false);

  const defaultPeriod = period ?? {
    startDate: new Date().toISOString().split("T")[0].slice(0, 7) + "-01",
    endDate: new Date().toISOString().split("T")[0],
  };

  return (
    <>
      <Card 
        className="hover-elevate cursor-pointer transition-all"
        onClick={onClick}
        data-testid={`salesperson-card-${salesperson.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="font-semibold truncate">{salesperson.name}</h3>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
              <p className="text-sm text-muted-foreground truncate mb-3">
                {salesperson.email}
              </p>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Vendas</p>
                  <p className="font-medium">{formatCurrency(stats.totalVendas)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ticket Médio</p>
                  <p className="font-medium">{formatCurrency(stats.ticketMedio)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">% Tubos x Conexões</p>
                  <p className="font-medium">
                    {stats.conexoesSobreTubos !== null 
                      ? `${stats.conexoesSobreTubos.toFixed(1)}%` 
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Positivação</p>
                  <p className="font-medium">{stats.positivacao} clientes</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Mix</p>
                  <p className="font-medium">{stats.mixProdutos} produtos</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {getTrendIcon(stats.yoyVariacao)}
                  <span className={`text-sm font-medium ${getValueColor(stats.yoyVariacao)}`}>
                    {formatPercentage(stats.yoyVariacao)} YoY
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={e => {
                    e.stopPropagation();
                    setShowMovimentacoes(true);
                  }}
                >
                  <List className="h-3 w-3" />
                  Movimentações
                </Button>
              </div>
            </div>
          </div>
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
