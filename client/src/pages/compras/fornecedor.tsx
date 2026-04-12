import { Link } from "wouter";
import { useComprasFornecedorDetalhe } from "./use-compras";
import { CriticidadeBadge, CriticidadeDot } from "./criticidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Building2, Package, Clock, DollarSign, AlertTriangle, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

export default function FornecedorDetalhe({ id }: { id: string }) {
  const { data: fornecedor, isLoading } = useComprasFornecedorDetalhe(id);

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!fornecedor) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Fornecedor não encontrado</p>
          <Link href="/compras"><Button variant="outline">Voltar</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/compras">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Compras
            </Button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">{fornecedor.nome}</span>
          <CriticidadeBadge value={fornecedor.criticidade} />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Itens Críticos</p>
                  <p className="text-2xl font-bold">{fornecedor.itensCriticos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 shrink-0">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cobertura Média</p>
                  <p className="text-2xl font-bold">{fornecedor.coberturaMedia}d</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lead Time</p>
                  <p className="text-2xl font-bold">{fornecedor.leadTime}d</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <div className="p-2 rounded-xl bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 shrink-0">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Estimado</p>
                  <p className="text-lg font-bold">R$ {(fornecedor.valorEstimado / 1000).toFixed(1)}k</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cobertura por produto */}
        {fornecedor.coberturaPorProduto.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Cobertura por Produto (dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={fornecedor.coberturaPorProduto} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="produto" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | string) => [`${v} dias`, "Cobertura"]} />
                  <Bar dataKey="dias" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Produtos do fornecedor */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos ({fornecedor.totalProdutos})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {fornecedor.produtos.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum produto crítico encontrado</div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Código</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Descrição</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Estoque</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Cobertura</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Ruptura Est.</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Sugestão</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Criticidade</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {fornecedor.produtos.map(p => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{p.codigo}</td>
                          <td className="px-3 py-3 font-medium max-w-[220px] truncate">{p.descricao}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{p.estoqueAtual}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={cn("font-medium tabular-nums", p.coberturaDias <= 3 ? "text-red-600 dark:text-red-400" : p.coberturaDias <= 7 ? "text-orange-600" : "")}>
                              {p.coberturaDias}d
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{p.dataEstimadaRuptura}</td>
                          <td className="px-3 py-3 text-center">
                            {p.sugestaoCompra > 0
                              ? <Badge variant="outline" className="text-xs">{p.sugestaoCompra} un</Badge>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-3 text-center"><CriticidadeBadge value={p.criticidade} /></td>
                          <td className="px-4 py-3">
                            <Link href={`/compras/produtos/${p.id}`}>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                Ver <ChevronRight className="h-3 w-3 ml-0.5" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile */}
                <div className="sm:hidden divide-y">
                  {fornecedor.produtos.map(p => (
                    <div key={p.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{p.descricao}</p>
                          <p className="text-xs text-muted-foreground font-mono">{p.codigo}</p>
                        </div>
                        <CriticidadeBadge value={p.criticidade} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div><p className="font-semibold text-foreground">{p.estoqueAtual}</p>Estoque</div>
                        <div><p className={cn("font-semibold", p.coberturaDias <= 3 ? "text-red-600" : "text-foreground")}>{p.coberturaDias}d</p>Cobertura</div>
                        <div><p className="font-semibold text-foreground">{p.sugestaoCompra > 0 ? `${p.sugestaoCompra} un` : "—"}</p>Sugestão</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Ruptura: {p.dataEstimadaRuptura}</span>
                        <Link href={`/compras/produtos/${p.id}`}>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs">Detalhe</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
