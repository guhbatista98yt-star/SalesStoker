import { useState } from "react";
import { Link } from "wouter";
import { useComprasProdutoDetalhe } from "./use-compras";
import { useComprasCompany } from "./use-company";
import { CriticidadeBadge } from "./criticidade";
import type { Criticidade } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Package, Clock, TrendingDown, Calendar, ShoppingCart, BarChart3,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

function getCriticidadeFromDias(dias: number): Criticidade {
  if (dias <= 0) return "critico";
  if (dias <= 3) return "critico";
  if (dias <= 7) return "alto";
  if (dias <= 14) return "moderado";
  if (dias <= 30) return "atencao";
  return "normal";
}

export default function ProdutoDetalhe({ id }: { id: string }) {
  const { companyId } = useComprasCompany();
  const { data: produto, isLoading, isError, error, refetch } = useComprasProdutoDetalhe(id, companyId !== "all" ? companyId : undefined);
  const [quantidade, setQuantidade] = useState("");

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Package className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Falha ao carregar produto</p>
          <p className="max-w-md text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Tente atualizar a pagina."}
          </p>
          <Button onClick={() => refetch()}>Tentar novamente</Button>
          <Link href="/compras"><Button variant="outline">Voltar</Button></Link>
        </div>
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Package className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Produto não encontrado</p>
          <Link href="/compras"><Button variant="outline">Voltar</Button></Link>
        </div>
      </div>
    );
  }

  const consumoDiario = produto.consumoDiario || 1;
  const coberturaAntes = produto.coberturaDias;
  const quantidadeNumerica = Number.isFinite(Number(quantidade)) ? Math.max(0, Number(quantidade)) : 0;
  const coberturaDepois = quantidadeNumerica > 0
    ? Math.round((produto.estoqueAtual + quantidadeNumerica) / consumoDiario)
    : coberturaAntes;
  const criticidadeDepois = getCriticidadeFromDias(coberturaDepois);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/compras">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Compras
            </Button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link href={`/compras/fornecedores/${produto.fornecedorId}`}>
            <Button variant="ghost" size="sm" className="text-muted-foreground px-1">{produto.fornecedor}</Button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold truncate max-w-[200px]">{produto.descricao}</span>
          <CriticidadeBadge value={produto.criticidade} />
        </div>

        {/* Info header */}
        <div>
          <p className="text-xs text-muted-foreground font-mono">{produto.codigo}</p>
          <h1 className="text-lg font-bold">{produto.descricao}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">Fornecedor: {produto.fornecedor}</p>
            {produto.semHistorico && <Badge variant="outline">Sem historico de consumo</Badge>}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 shrink-0">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Estoque Disponível
                    {produto.estoqueErpDisponivel && (
                      <span className="inline-flex items-center text-[10px] font-semibold bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 px-1 rounded">ERP</span>
                    )}
                  </p>
                  <p className="text-2xl font-bold">{produto.saldoDisponivel}</p>
                  {produto.qtdReserva > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Reservado: {produto.qtdReserva}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Mín: {produto.estoqueSeguranca}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <div className={cn("p-2 rounded-xl shrink-0", produto.coberturaDias <= 3 ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" : "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400")}>
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cobertura</p>
                  <p className="text-2xl font-bold">{produto.coberturaDias}d</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Consumo Diário</p>
                  <p className="text-2xl font-bold">{produto.consumoDiario}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 shrink-0">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ruptura Est.</p>
                  <p className="text-sm font-bold">{produto.dataEstimadaRuptura}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Consumo e giro */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Consumo Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-xl bg-muted/40">
                <p className="text-xs text-muted-foreground mb-1">Diário</p>
                <p className="text-2xl font-bold">{produto.consumoDiario}</p>
                <p className="text-xs text-muted-foreground">un/dia</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/40">
                <p className="text-xs text-muted-foreground mb-1">Semanal</p>
                <p className="text-2xl font-bold">{produto.consumoSemanal}</p>
                <p className="text-xs text-muted-foreground">un/sem</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/40">
                <p className="text-xs text-muted-foreground mb-1">Mensal</p>
                <p className="text-2xl font-bold">{produto.consumoMensal}</p>
                <p className="text-xs text-muted-foreground">un/mês</p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {produto.ultimaCompra && (
                <p className="text-xs text-muted-foreground">
                  Última compra: <span className="font-medium">{produto.ultimaCompra}</span>
                  {produto.ultimaQtdComprada != null && <span> · {produto.ultimaQtdComprada} un</span>}
                  {produto.ultimaValorCompra != null && produto.ultimaValorCompra > 0 && (
                    <span> · <span className="font-semibold text-foreground">R$ {produto.ultimaValorCompra.toFixed(2)}/un</span></span>
                  )}
                </p>
              )}
              {produto.pedidosAbertos > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Pedido de compra aberto: <span className="font-semibold">{produto.pedidosAbertos} un</span> em trânsito
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Sugestão: <span className="font-semibold text-foreground">{produto.sugestaoCompra} unidades</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Histórico de consumo */}
        {produto.historico.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Histórico de Consumo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={produto.historico} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | string) => [`${v} un`, "Consumo"]} />
                  <Bar dataKey="consumo" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Simulação inline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Simulação de Compra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="space-y-1.5 flex-1">
                <label className="text-sm font-medium">Quantidade a comprar</label>
                <Input
                  type="number"
                  min={0}
                  placeholder={`Sugestão: ${produto.sugestaoCompra} un`}
                  value={quantidade}
                  onChange={e => setQuantidade(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            </div>

            {quantidadeNumerica > 0 && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Situação Atual</p>
                    <div className="p-4 rounded-xl bg-muted/40 space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Cobertura</p>
                        <p className="text-2xl font-bold">{coberturaAntes}d</p>
                      </div>
                      <CriticidadeBadge value={produto.criticidade} />
                      <p className="text-xs text-muted-foreground">Ruptura: {produto.dataEstimadaRuptura}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Após a Compra</p>
                    <div className="p-4 rounded-xl bg-muted/40 space-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Cobertura</p>
                        <p className="text-2xl font-bold">{coberturaDepois}d</p>
                      </div>
                      <CriticidadeBadge value={criticidadeDepois} />
                      <p className="text-xs text-muted-foreground">
                        Melhora: +{coberturaDepois - coberturaAntes}d de cobertura
                      </p>
                    </div>
                  </div>
                </div>
                <Button className="w-full sm:w-auto" disabled={quantidadeNumerica <= 0}>
                  Confirmar Sugestão de {quantidade} unidades
                </Button>
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
