import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Target, TrendingUp, AlertCircle, PieChart, Clock } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/calendar-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

function getProgressColor(progress: number): string {
    if (progress >= 100) return "bg-emerald-500";
    if (progress >= 75) return "bg-blue-500";
    if (progress >= 50) return "bg-amber-500";
    return "bg-red-500";
}

export default function AcompanhamentoTab() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["/api/metas/acompanhamento"],
        refetchInterval: 300000, // 5 min
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>Não foi possível carregar os dados de acompanhamento.</AlertDescription>
            </Alert>
        );
    }

    const { last_update, loja1, loja3, mix_geral, periodo: periodoData } = data as any;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border shadow-sm">
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-3 py-1 text-sm bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <Clock className="w-3.5 h-3.5 mr-1.5 inline-block" />
                        Atualizado em tempo real
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        {formatDateBR(last_update)}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-700">

                {/* Faturamento Loja Azul */}
                <Card className="col-span-1 shadow-md hover:shadow-lg transition-all border-blue-100 dark:border-blue-900/50">
                    <CardHeader className="pb-3 border-b bg-blue-50/50 dark:bg-blue-900/10 space-y-1">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                <Target className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                                Varejo
                            </CardTitle>
                            {loja1.percentual >= 100 && (
                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-none">
                                    Concluída
                                </Badge>
                            )}
                        </div>
                        <CardDescription>
                            Meta Semanal ({formatDateBR(periodoData.inicio)} - {formatDateBR(periodoData.fim)})
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-col justify-between gap-4 mb-3">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Vendidos</p>
                                <div className="text-3xl font-black tracking-tight text-foreground truncate">
                                    {formatCurrency(loja1.valor_atual)}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Meta</p>
                                <div className="text-lg font-bold text-muted-foreground">
                                    {loja1.meta > 0 ? formatCurrency(loja1.meta) : "Não definida"}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 mt-6">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Progresso</span>
                                <span className={loja1.percentual >= 100 ? "text-emerald-600" : ""}>
                                    {loja1.percentual}%
                                </span>
                            </div>
                            <Progress
                                value={Math.min(loja1.percentual, 100)}
                                className={`h-4 ${getProgressColor(loja1.percentual)}`}
                            />

                            <div className="flex justify-between items-center pt-2">
                                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    {periodoData.dias_restantes} dias restantes
                                </p>

                                {loja1.faltante > 0 && loja1.meta > 0 && (
                                    <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
                                        Faltam {formatCurrency(loja1.faltante)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Faturamento Loja Vermelha */}
                <Card className="col-span-1 shadow-md hover:shadow-lg transition-all border-red-100 dark:border-red-900/50">
                    <CardHeader className="pb-3 border-b bg-red-50/50 dark:bg-red-900/10 space-y-1">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl flex items-center gap-2 text-red-700 dark:text-red-400">
                                <Target className="w-5 h-5 text-red-600 dark:text-red-500" />
                                Atacado
                            </CardTitle>
                            {loja3.percentual >= 100 && (
                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-none">
                                    Concluída
                                </Badge>
                            )}
                        </div>
                        <CardDescription>
                            Meta Semanal ({formatDateBR(periodoData.inicio)} - {formatDateBR(periodoData.fim)})
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-col justify-between gap-4 mb-3">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Vendidos</p>
                                <div className="text-3xl font-black tracking-tight text-foreground truncate">
                                    {formatCurrency(loja3.valor_atual)}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Meta</p>
                                <div className="text-lg font-bold text-muted-foreground">
                                    {loja3.meta > 0 ? formatCurrency(loja3.meta) : "Não definida"}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 mt-6">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Progresso</span>
                                <span className={loja3.percentual >= 100 ? "text-emerald-600" : ""}>
                                    {loja3.percentual}%
                                </span>
                            </div>
                            <Progress
                                value={Math.min(loja3.percentual, 100)}
                                className={`h-4 ${getProgressColor(loja3.percentual)}`}
                            />

                            <div className="flex justify-between items-center pt-2">
                                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    {periodoData.dias_restantes} dias restantes
                                </p>

                                {loja3.faltante > 0 && loja3.meta > 0 && (
                                    <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
                                        Faltam {formatCurrency(loja3.faltante)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Mix Geral */}
                <Card className="col-span-1 shadow-md hover:shadow-lg transition-all flex flex-col">
                    <CardHeader className="pb-3 border-b bg-gray-50/50 dark:bg-white/5 space-y-1">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-purple-500" />
                            Mix Geral
                        </CardTitle>
                        <CardDescription>
                            Conexões x Tubos (Todas as Marcas)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 flex-1 flex flex-col justify-center">

                        <div className="flex justify-center mb-6">
                            <div className="relative w-32 h-32 flex items-center justify-center rounded-full border-8 border-muted">
                                <svg className="absolute inset-0 w-full h-full -rotate-90">
                                    <circle
                                        cx="50%"
                                        cy="50%"
                                        r="46%"
                                        fill="none"
                                        strokeWidth="8"
                                        className="stroke-purple-600"
                                        strokeDasharray={`${Math.min(mix_geral.percentual_conexoes, 100) * 2.89} 300`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="text-center">
                                    <span className="text-2xl font-bold">{mix_geral.percentual_conexoes}%</span>
                                    <span className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Conexões</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                                    <span className="font-medium text-sm">Conexões</span>
                                </div>
                                <span className="font-bold text-purple-900 dark:text-purple-300">
                                    {formatCurrency(mix_geral.valor_conexoes)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-zinc-800/50 border">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-muted-foreground/30"></div>
                                    <span className="font-medium text-sm">Tubos</span>
                                </div>
                                <span className="font-bold">
                                    {formatCurrency(mix_geral.valor_tubos)}
                                </span>
                            </div>
                        </div>

                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
