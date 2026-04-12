import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/calendar-utils";
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
  onClick?: () => void;
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

export function SalespersonCard({ salesperson, stats, onClick }: SalespersonCardProps) {
  const initials = salesperson.name.split(" ").map(n => n[0]).slice(0, 2).join("");

  return (
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

            <div className="mt-3 pt-3 border-t flex items-center justify-start">
              <div className="flex items-center gap-1.5">
                {getTrendIcon(stats.yoyVariacao)}
                <span className={`text-sm font-medium ${getValueColor(stats.yoyVariacao)}`}>
                  {formatPercentage(stats.yoyVariacao)} YoY
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
