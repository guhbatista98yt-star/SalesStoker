import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Loader2,
    ArrowLeft,
    Download,
    CheckCircle2,
    XCircle,
    ShieldAlert,
    Trophy,
    TrendingUp,
    Users,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const CAMPAIGNS = [
    { id: "dtr_amanco", name: "DTR Amanco" },
    { id: "tv_amanco", name: "TV Amanco" },
    { id: "elit", name: "Tintas Elit" },
];

export interface CampaignReportRow {
    salespersonId: string;
    salespersonName: string;
    targetTrigger: number;
    currentSales: number;
    percentAchieved: number;
    isEligible: boolean;
}

function formatBRL(value: number | undefined | null) {
    return (value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AdminReports() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin" || user?.role === "supervisor";
    const [selectedCampaign, setSelectedCampaign] = useState<string>("dtr_amanco");

    const { data: reportData = [], isLoading, error } = useQuery<CampaignReportRow[]>({
        queryKey: ["/api/metas/admin/campaign-report", selectedCampaign],
        queryFn: async () => {
            const res = await apiRequest(
                "GET",
                `/api/metas/admin/campaign-report?campaign=${selectedCampaign}`
            );
            return res.json();
        },
        enabled: isAdmin,
    });

    const stats = useMemo(() => {
        const eligible = reportData.filter(r => r.isEligible).length;
        const avgPct =
            reportData.length > 0
                ? reportData.reduce((s, r) => s + r.percentAchieved, 0) / reportData.length
                : 0;
        return { total: reportData.length, eligible, avgPct };
    }, [reportData]);

    const sorted = useMemo(
        () => [...reportData].sort((a, b) => b.percentAchieved - a.percentAchieved),
        [reportData]
    );

    const exportToXLSX = async () => {
        if (!reportData.length) return;
        const XLSX = await import("xlsx");
        const headers = ["ID", "Nome", "Gatilho (R$)", "Vendas (R$)", "% Atingido", "Elegível"];
        const rows = reportData.map(r => [
            r.salespersonId,
            r.salespersonName,
            Number((r.targetTrigger ?? 0).toFixed(2)),
            Number((r.currentSales ?? 0).toFixed(2)),
            Number((r.percentAchieved ?? 0).toFixed(2)),
            r.isEligible ? "SIM" : "NÃO",
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws["!cols"] = [{ wch: 8 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 8 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relatório");
        XLSX.writeFile(wb, `relatorio_${selectedCampaign}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    };

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-12">
                <ShieldAlert className="h-12 w-12 text-muted-foreground" />
                <h2 className="text-xl font-semibold">Acesso Restrito</h2>
                <p className="text-muted-foreground">Esta área é exclusiva para administradores.</p>
                <Link href="/metas">
                    <Button variant="outline">Voltar para Metas</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/metas">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Relatórios de Campanha</h1>
                        <p className="text-muted-foreground text-sm">
                            Analise o desempenho por vendedor e identifique os ganhadores.
                        </p>
                    </div>
                </div>

                {/* Summary cards */}
                {!isLoading && reportData.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-6 flex items-center gap-3">
                                <Users className="h-8 w-8 text-muted-foreground" />
                                <div>
                                    <p className="text-2xl font-bold">{stats.total}</p>
                                    <p className="text-xs text-muted-foreground">Vendedores</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6 flex items-center gap-3">
                                <Trophy className="h-8 w-8 text-amber-500" />
                                <div>
                                    <p className="text-2xl font-bold text-amber-600">{stats.eligible}</p>
                                    <p className="text-xs text-muted-foreground">Elegíveis / Ganhadores</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6 flex items-center gap-3">
                                <TrendingUp className="h-8 w-8 text-blue-500" />
                                <div>
                                    <p className="text-2xl font-bold text-blue-600">{stats.avgPct.toFixed(1)}%</p>
                                    <p className="text-xs text-muted-foreground">Atingimento médio</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <CardTitle>Análise de Ganhadores</CardTitle>
                                <CardDescription>
                                    Elegibilidade considera gatilhos, travas de loja e mix de produtos.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CAMPAIGNS.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={exportToXLSX}
                                    variant="secondary"
                                    size="sm"
                                    className="gap-2"
                                    disabled={!reportData.length}
                                >
                                    <Download className="w-4 h-4" />
                                    Exportar XLSX
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">ID</TableHead>
                                        <TableHead>Vendedor</TableHead>
                                        <TableHead className="text-right">Gatilho (R$)</TableHead>
                                        <TableHead className="text-right">Vendas (R$)</TableHead>
                                        <TableHead className="w-[160px]">Progresso</TableHead>
                                        <TableHead className="text-center w-[100px]">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center">
                                                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                                            </TableCell>
                                        </TableRow>
                                    ) : error ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-destructive">
                                                Erro ao carregar relatório. Tente novamente.
                                            </TableCell>
                                        </TableRow>
                                    ) : sorted.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                Nenhum dado encontrado para esta campanha.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        sorted.map(row => (
                                            <TableRow
                                                key={row.salespersonId}
                                                className={row.isEligible ? "bg-green-50 dark:bg-green-950/20" : ""}
                                            >
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {row.salespersonId}
                                                </TableCell>
                                                <TableCell className="font-medium">{row.salespersonName}</TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {row.targetTrigger > 0 ? `R$ ${formatBRL(row.targetTrigger)}` : "—"}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    R$ {formatBRL(row.currentSales)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress
                                                            value={Math.min(row.percentAchieved, 100)}
                                                            className="h-2 flex-1"
                                                        />
                                                        <span
                                                            className={`text-xs font-medium w-12 text-right ${
                                                                row.percentAchieved >= 100
                                                                    ? "text-green-600"
                                                                    : "text-muted-foreground"
                                                            }`}
                                                        >
                                                            {(row.percentAchieved ?? 0).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {row.isEligible ? (
                                                        <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> SIM
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground gap-1">
                                                            <XCircle className="w-3 h-3" /> NÃO
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
