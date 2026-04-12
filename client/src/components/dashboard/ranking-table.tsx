import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, ChevronDown, TrendingUp, TrendingDown, Minus, Award, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercentage } from "@/lib/calendar-utils";
import type { SalespersonRanking, RankingCriteria } from "@shared/schema";

interface RankingTableProps {
  rankings: SalespersonRanking[];
  criteria: RankingCriteria;
  onCriteriaChange: (criteria: RankingCriteria) => void;
  loading?: boolean;
  dragHandle?: React.ReactNode;
}

const criteriaLabels: Record<RankingCriteria, string> = {
  maior_valor_vendido: "Maior Valor Vendido",
  maior_positivacao: "Maior Positivação",
  maior_mix_produtos: "Maior Mix de Produtos",
  conexoes_sobre_tubos: "% Conexões/Tubos",
};

const criteriaDescriptions: Record<RankingCriteria, string> = {
  maior_valor_vendido: "Valor total de vendas",
  maior_positivacao: "Clientes atendidos",
  maior_mix_produtos: "Variedade de produtos",
  conexoes_sobre_tubos: "% conexões sobre tubos",
};

/* ── Rank badge ──────────────────────────────────────────────────────────────── */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="h-7 w-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
        <Trophy className="h-3.5 w-3.5 text-amber-500" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="h-7 w-7 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
        <Medal className="h-3.5 w-3.5 text-slate-400" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="h-7 w-7 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center">
        <Award className="h-3.5 w-3.5 text-amber-700" />
      </div>
    );
  return (
    <div className="h-7 w-7 rounded-full bg-muted/60 border border-border flex items-center justify-center">
      <span className="text-xs font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}

/* ── Trend chip ──────────────────────────────────────────────────────────────── */
function TrendChip({ value }: { value: number | null }) {
  if (value === null || value === undefined) return null;
  const isPositive = value > 0;
  const isNeutral = value === 0;
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        isNeutral
          ? "bg-muted text-muted-foreground"
          : isPositive
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
          : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
      )}
    >
      {isNeutral ? (
        <Minus className="h-3 w-3" />
      ) : isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {formatPercentage(value)}
    </div>
  );
}

/* ── Skeleton rows ───────────────────────────────────────────────────────────── */
function SkeletonRows() {
  return (
    <div className="divide-y divide-border">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <div className="skeleton h-7 w-7 rounded-full" />
          <div className="skeleton h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3.5 w-28 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────────── */
export function RankingTable({
  rankings,
  criteria,
  onCriteriaChange,
  loading,
  dragHandle,
}: RankingTableProps) {
  const getMainValue = (ranking: SalespersonRanking): string => {
    switch (criteria) {
      case "maior_valor_vendido":
        return formatCurrency(ranking.value);
      case "maior_positivacao":
        return `${ranking.positivacao} clientes`;
      case "maior_mix_produtos":
        return `${ranking.mixProdutos} produtos`;
      case "conexoes_sobre_tubos":
        return ranking.conexoesSobreTubos !== null
          ? `${ranking.conexoesSobreTubos.toFixed(1)}%`
          : "N/A";
    }
  };

  return (
    <Card data-testid="ranking-table" className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            {dragHandle}
            <Trophy className="h-4 w-4 text-amber-500" />
            Ranking de Vendedores
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs rounded-lg"
                data-testid="button-ranking-criteria"
              >
                {criteriaLabels[criteria]}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {Object.entries(criteriaLabels).map(([key, label]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => onCriteriaChange(key as RankingCriteria)}
                  data-testid={`menu-item-criteria-${key}`}
                  className={cn("flex flex-col items-start gap-0.5", criteria === key && "bg-primary/5 text-primary")}
                >
                  <span className="font-medium text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {criteriaDescriptions[key as RankingCriteria]}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <SkeletonRows />
        ) : rankings.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum dado disponível</p>
          </div>
        ) : (
          <div className="divide-y divide-border -mx-1">
            {rankings.map((ranking) => (
              <div
                key={ranking.salesperson.id}
                className="flex items-center gap-3 px-1 py-2.5 rounded-lg hover:bg-muted/40 transition-colors cursor-default"
                data-testid={`ranking-row-${ranking.salesperson.id}`}
              >
                <RankBadge rank={ranking.rank} />

                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-semibold",
                      ranking.rank === 1
                        ? "bg-amber-100 text-amber-700"
                        : ranking.rank === 2
                        ? "bg-slate-100 text-slate-600"
                        : ranking.rank === 3
                        ? "bg-orange-100 text-orange-700"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {ranking.salesperson.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-tight">
                    {ranking.salesperson.name}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {getMainValue(ranking)}
                  </p>
                </div>

                <TrendChip value={ranking.yoyVariacao} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
