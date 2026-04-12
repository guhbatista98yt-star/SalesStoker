import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, TrendingUp, XCircle, Store, Target, Percent } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/calendar-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

function StatusIcon({ ok }: { ok: boolean }) {
    if (ok) return <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
    return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
}

export default function TvAmancoTab() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["/api/metas/amanco/tv"],
        refetchInterval: 300000,
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
                <AlertDescription>Não foi possível carregar os dados da Campanha TV Amanco.</AlertDescription>
            </Alert>
        );
    }

    const {
        last_update,
        periodo,
        faturamento_amanco: fat,
        crescimento_vendedor: cv,
        mix_amanco: mx,
        crescimento_loja: cl,
        elegibilidade: el
    } = data as any;

    return (
        <div className="space-y-4">
            {/* Cabeçalho da campanha */}
            <div className="pt-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                    Campanha TV Amanco
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    {formatDateBR(periodo.inicio)} – {formatDateBR(periodo.fim)}
                    {periodo.encerrado && (
                        <Badge variant="secondary" className="ml-2 text-xs bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Encerrado
                        </Badge>
                    )}
                </p>
            </div>

            {/* Elegibilidade Banner */}
            <div className={`p-4 sm:p-6 rounded-xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-500 ${el.participando ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                <div className="flex items-start gap-3 w-full">
                    <div className={`p-2.5 rounded-full flex-shrink-0 mt-0.5 ${el.participando ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {el.participando ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                        <h2 className={`text-xl font-bold ${el.participando ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                            {el.participando ? "Elegível para o Sorteio!" : "Ainda não elegível"}
                        </h2>
                        {!el.participando && el.motivos && el.motivos.length > 0 && (
                            <ul className="mt-1.5 space-y-1">
                                {el.motivos.map((m: string, i: number) => (
                                    <li key={i} className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                        {m}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Gatilho Mínimo */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Target className="w-4 h-4 text-blue-500 flex-shrink-0" /> Gatilho Mínimo
                                </CardTitle>
                                <CardDescription className="text-xs">Faturamento no período promocional</CardDescription>
                            </div>
                            <StatusIcon ok={fat.gatilho_atingido} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-2xl font-bold">{formatCurrency(fat.valor_atual)}</span>
                            <span className="text-xs text-muted-foreground">Meta: {formatCurrency(fat.meta_gatilho)}</span>
                        </div>
                        <Progress value={Math.min(fat.percentual, 100)} className="h-3 mb-2" />
                        <div className="flex justify-end text-xs">
                            {fat.faltante > 0 && <span className="text-amber-600">Falta: {formatCurrency(fat.faltante)}</span>}
                        </div>
                    </CardContent>
                </Card>

                {/* Conexões sobre Tubos — SEM valores monetários */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Percent className="w-4 h-4 text-purple-500 flex-shrink-0" /> Conexões sobre Tubos
                                </CardTitle>
                                <CardDescription className="text-xs">Participação de Conexões</CardDescription>
                            </div>
                            <StatusIcon ok={mx.status_ok} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-2xl font-bold">{mx.percentual_conexoes.toFixed(1)}%</span>
                            <span className="text-xs text-muted-foreground">Meta Mínima: {mx.meta_percentual}%</span>
                        </div>
                        <Progress value={Math.min((mx.percentual_conexoes / mx.meta_percentual) * 100, 100)} className="h-3 mb-3 bg-purple-100 [&>div]:bg-purple-500" />
                        <div className="text-sm">
                            {mx.status_ok
                                ? <span className="text-emerald-600 font-medium">✓ Meta de {mx.meta_percentual}% atingida.</span>
                                : <span className="text-amber-600 font-medium">Você precisa vender mais conexões Amanco.</span>}
                        </div>
                    </CardContent>
                </Card>

                {/* Crescimento vs. Ano Anterior */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-amber-500 flex-shrink-0" /> Seu Crescimento
                                </CardTitle>
                                <CardDescription className="text-xs">Crescimento vs. Ano Anterior</CardDescription>
                            </div>
                            <StatusIcon ok={cv.status_ok} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 mb-2">
                            <Badge className={`text-base px-3 py-1 ${cv.crescimento_percentual >= cv.meta_percentual ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}`}>
                                {cv.crescimento_percentual >= 0 ? "+" : ""}{cv.crescimento_percentual.toFixed(1)}%
                            </Badge>
                            <span className="text-sm text-muted-foreground">Meta: {cv.meta_percentual}%</span>
                        </div>
                        <Progress value={Math.min((Math.max(cv.crescimento_percentual, 0) / cv.meta_percentual) * 100, 100)} className="h-3 bg-amber-100 [&>div]:bg-amber-500" />
                    </CardContent>
                </Card>

                {/* Trava Global da Loja */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3 border-b bg-muted/30">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Store className="w-4 h-4 text-indigo-500 flex-shrink-0" /> Crescimento Loja
                                </CardTitle>
                                <CardDescription className="text-xs">Crescimento de todos os vendedores vs. Ano Anterior</CardDescription>
                            </div>
                            <StatusIcon ok={cl.status_ok} />
                        </div>
                    </CardHeader>
                    <CardContent className="py-4">
                        <div className="flex justify-between items-end mb-3">
                            <span className="text-2xl font-bold">
                                {cl.crescimento_percentual > 0 ? "+" : ""}{cl.crescimento_percentual.toFixed(2)}%
                            </span>
                            <span className="text-xs text-muted-foreground">Meta: {cl.meta_percentual}%</span>
                        </div>
                        <Progress
                            value={cl.meta_percentual > 0 ? Math.max(0, Math.min((cl.crescimento_percentual / cl.meta_percentual) * 100, 100)) : 100}
                            className={`h-3 mb-3 ${cl.status_ok ? '[&>div]:bg-emerald-500 bg-emerald-100' : '[&>div]:bg-amber-500 bg-amber-100'}`}
                        />
                        <div className="text-sm text-center mt-1">
                            {cl.status_ok
                                ? <span className="text-emerald-600 font-medium">Loja atingiu o crescimento necessário.</span>
                                : <span className="text-amber-600 font-medium">A loja precisa atingir a meta global para destravar os prêmios.</span>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <p className="text-center text-xs text-muted-foreground pt-2">
                Atualizado em {formatDateBR(last_update)}
            </p>
        </div>
    );
}
