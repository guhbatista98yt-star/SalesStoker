import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, ArrowLeft, Download, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "wouter";

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

export default function AdminReports() {
    const [selectedCampaign, setSelectedCampaign] = useState<string>("dtr_amanco");

    const { data: reportData, isLoading } = useQuery<CampaignReportRow[]>({
        queryKey: ["/api/metas/admin/campaign-report", selectedCampaign],
        queryFn: async () => {
            const res = await fetch(`/api/metas/admin/campaign-report?campaign=${selectedCampaign}`);
            if (!res.ok) throw new Error("Failed to fetch report");
            return res.json();
        }
    });

    const exportToCSV = () => {
        if (!reportData || reportData.length === 0) return;

        const headers = ["ID Vendedor", "Nome", "Gatilho Alvo (R$)", "Situação Atual (R$)", "% Atingido", "Ganhador (Elegível)"];
        const rows = reportData.map(row => [
            row.salespersonId,
            `"${row.salespersonName}"`, // escape commas in names
            row.targetTrigger.toFixed(2),
            row.currentSales.toFixed(2),
            row.percentAchieved.toFixed(2),
            row.isEligible ? "SIM" : "NÃO"
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `relatorio_campanha_${selectedCampaign}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link); // Required for FF
        link.click();
        document.body.removeChild(link);
    };

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
                        <h1 className="text-3xl font-bold tracking-tight">Relatórios de Campanha</h1>
                        <p className="text-muted-foreground">Analise o desempenho de todos os vendedores e visualize os ganhadores.</p>
                    </div>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div className="space-y-1">
                            <CardTitle>Análise de Ganhadores</CardTitle>
                            <CardDescription>A elegibilidade considera gatilhos, travas de loja e mix de produtos (quando aplicável).</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Selecione a Campanha" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CAMPAIGNS.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button onClick={exportToCSV} variant="secondary" className="gap-2" disabled={!reportData || reportData.length === 0}>
                                <Download className="w-4 h-4" />
                                Exportar CSV
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">ID</TableHead>
                                        <TableHead>Vendedor</TableHead>
                                        <TableHead className="text-right">Gatilho Alvo (R$)</TableHead>
                                        <TableHead className="text-right">Vendas na Campanha</TableHead>
                                        <TableHead className="text-right">% Atingido</TableHead>
                                        <TableHead className="text-center w-[120px]">Elegível?</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center">
                                                <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                            </TableCell>
                                        </TableRow>
                                    ) : reportData && reportData.length > 0 ? (
                                        reportData.map((row) => (
                                            <TableRow key={row.salespersonId}>
                                                <TableCell className="font-medium text-xs text-muted-foreground">{row.salespersonId}</TableCell>
                                                <TableCell className="font-medium">{row.salespersonName}</TableCell>
                                                <TableCell className="text-right">
                                                    R$ {row.targetTrigger.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    R$ {row.currentSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={row.percentAchieved >= 100 ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                                                        {row.percentAchieved.toFixed(1)}%
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {row.isEligible ? (
                                                        <Badge variant="default" className="bg-green-600 hover:bg-green-700 w-full justify-center">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" /> SIM
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground w-full justify-center">
                                                            <XCircle className="w-3 h-3 mr-1" /> NÃO
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                Nenhum dado encontrado para esta campanha.
                                            </TableCell>
                                        </TableRow>
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
