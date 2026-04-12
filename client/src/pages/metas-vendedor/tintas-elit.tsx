import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, XCircle, PaintBucket } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/calendar-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

function StatusIcon({ ok }: { ok: boolean }) {
    if (ok) return <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
    return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
}

export default function TintasElitTab() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["/api/metas/elit"],
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
                <AlertDescription>Não foi possível carregar os dados da Campanha Tintas Elit.</AlertDescription>
            </Alert>
        );
    }

    const {
        last_update,
        periodo,
        gatilho_minimo,
        valor_vendido,
        faltante,
        participando,
    } = data as any;

    const progressPercent = Math.min((valor_vendido / gatilho_minimo) * 100, 100);

    return (
        <div className="space-y-4">
            {/* Cabeçalho da campanha */}
            <div className="pt-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                    Campanha Tintas Elit
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Ciclo: Sábado {formatDateBR(periodo.inicio)} até Sexta-feira {formatDateBR(periodo.fim)}
                </p>
            </div>

            {/* Elegibilidade Banner */}
            <div className={`p-4 sm:p-6 rounded-xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-500 ${participando ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-full flex-shrink-0 ${participando ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        {participando ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                    </div>
                    <div>
                        <h2 className={`text-xl font-bold ${participando ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                            {participando ? "Gatilho Atingido!" : "Quase lá!"}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Pagamento previsto para Sábado, {formatDateBR(periodo.pagamento_em)}
                        </p>
                    </div>
                </div>

                <Badge variant="outline" className={`text-sm font-medium self-start sm:self-center ${participando ? 'border-emerald-300 text-emerald-700 dark:text-emerald-400' : 'border-amber-300 text-amber-700 dark:text-amber-400'}`}>
                    {progressPercent.toFixed(0)}% do gatilho
                </Badge>
            </div>

            {/* Card de Vendas no Ciclo */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b bg-gray-50/50 dark:bg-white/5 space-y-1">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <PaintBucket className="w-4 h-4 text-orange-500 flex-shrink-0" /> Vendas no Ciclo
                            </CardTitle>
                            <CardDescription className="text-xs">Gatilho Mínimo: {formatCurrency(gatilho_minimo)}</CardDescription>
                        </div>
                        <StatusIcon ok={participando} />
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-1 mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Faturamento Elit</span>
                        <span className="text-4xl font-black tracking-tight text-foreground">{formatCurrency(valor_vendido)}</span>
                    </div>

                    <Progress value={progressPercent} className="h-4 my-3" />

                    <div className="flex justify-end text-sm">
                        {!participando && faltante > 0 && (
                            <span className="text-amber-600 font-medium">Falta: {formatCurrency(faltante)}</span>
                        )}
                    </div>

                    {participando && (
                        <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 text-center">
                            <span className="text-emerald-700 dark:text-emerald-300 font-semibold text-sm">
                                ✓ Gatilho atingido! Você está qualificado para receber o prêmio do ciclo.
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground pt-2">
                Atualizado em {formatDateBR(last_update)}
            </p>
        </div>
    );
}
