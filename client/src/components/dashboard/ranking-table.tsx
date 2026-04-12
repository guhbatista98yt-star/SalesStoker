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
import { Badge } from "@/components/ui/badge";
import { Trophy, ChevronDown, TrendingUp, TrendingDown, Minus, Award, Medal } from "lucide-react";
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
  maior_valor_vendido: "Classificado por valor total de vendas",
  maior_positivacao: "Classificado por número de clientes atendidos",
  maior_mix_produtos: "Classificado por variedade de produtos vendidos",
  conexoes_sobre_tubos: "Classificado por % de conexões sobre tubos",
};

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
  return <span className="text-sm font-semibold text-muted-foreground w-5 text-center">{rank}</span>;
}

function getTrendIndicator(value: number | null) {
  if (value === null || value === undefined) return null;
  if (value > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (value < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function getValueColor(value: number | null): string {
  if (value === null || value === undefined) return "text-muted-foreground";
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

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
    <Card data-testid="ranking-table">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            {dragHandle}
            <Trophy className="h-5 w-5 text-amber-500" />
            Ranking de Vendedores
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1" data-testid="button-ranking-criteria">
                {criteriaLabels[criteria]}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(criteriaLabels).map(([key, label]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => onCriteriaChange(key as RankingCriteria)}
                  data-testid={`menu-item-criteria-${key}`}
                >
                  <div className="flex flex-col">
                    <span>{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {criteriaDescriptions[key as RankingCriteria]}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-muted/30 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : rankings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        ) : (
          <div className="space-y-2">
            {rankings.map((ranking) => (
              <div
                key={ranking.salesperson.id}
                className="flex items-center gap-3 p-3 rounded-md hover-elevate transition-colors"
                data-testid={`ranking-row-${ranking.salesperson.id}`}
              >
                <div className="flex items-center justify-center w-8">
                  {getRankIcon(ranking.rank)}
                </div>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {ranking.salesperson.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{ranking.salesperson.name}</span>
                    {ranking.rank <= 3 && (
                      <Badge variant="secondary" className="text-xs">
                        Top {ranking.rank}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {getMainValue(ranking)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  {getTrendIndicator(ranking.yoyVariacao)}
                  <span className={getValueColor(ranking.yoyVariacao)}>
                    {formatPercentage(ranking.yoyVariacao)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
