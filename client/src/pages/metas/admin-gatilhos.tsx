import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { format, subDays } from "date-fns";
import { Save, Loader2, ArrowLeft, Search, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { VendorGroupsDialog, type VendorGroup } from "@/components/admin/vendor-groups-dialog";

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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CAMPAIGNS = [
    { id: "dtr_amanco", name: "DTR Amanco" },
    { id: "tv_amanco", name: "TV Amanco" },
    { id: "elit", name: "Tintas Elit" },
];

const YEARS = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i);

interface Salesperson {
    id: string;
    name: string;
}

interface SalespersonWithStats {
    salesperson: Salesperson;
    stats: { totalVendas: number };
}

interface CampaignGoal {
    salespersonId: string;
    triggerValue: number;
}

export default function AdminGatilhos() {
    const { user } = useAuth();
    const { toast } = useToast();
    const isAdmin = user?.role === "admin" || user?.role === "supervisor";

    const [selectedCampaign, setSelectedCampaign] = useState<string>("dtr_amanco");
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
    const [search, setSearch] = useState("");
    const [localGoals, setLocalGoals] = useState<Record<string, string>>({});
    const [isDirty, setIsDirty] = useState(false);

    const startDate = format(subDays(new Date(), 60), "yyyy-MM-dd");
    const endDate = format(new Date(), "yyyy-MM-dd");

    const { data: salespeopleRaw = [], isLoading: loadingSalespeople } = useQuery<SalespersonWithStats[]>({
        queryKey: [`/api/salespersons/all/${startDate}/${endDate}`],
        enabled: isAdmin,
    });

    const salespeople = useMemo<Salesperson[]>(() => {
        return Array.from(
            new Map(salespeopleRaw.map(s => [s.salesperson.id, s.salesperson])).values()
        ).sort((a, b) => a.name.localeCompare(b.name));
    }, [salespeopleRaw]);

    const { data: campaignGoals = [], isLoading: loadingGoals } = useQuery<CampaignGoal[]>({
        queryKey: ["/api/metas/admin/campaign-goals", selectedCampaign, selectedYear],
        queryFn: async () => {
            const res = await apiRequest(
                "GET",
                `/api/metas/admin/campaign-goals?campaign=${selectedCampaign}&year=${selectedYear}`
            );
            return res.json();
        },
        enabled: isAdmin,
    });

    const { data: vendorGroups = [] } = useQuery<VendorGroup[]>({
        queryKey: ["/api/admin/vendor-groups"],
        enabled: isAdmin,
    });

    const filteredSalespeople = useMemo(() => {
        let list = salespeople;
        if (selectedGroupId !== "all") {
            const group = vendorGroups.find(g => g.id === selectedGroupId);
            list = list.filter(sp => group?.members.includes(sp.id));
        }
        const term = search.toLowerCase().trim();
        if (term) {
            list = list.filter(sp =>
                sp.name.toLowerCase().includes(term) || sp.id.includes(term)
            );
        }
        return list;
    }, [salespeople, selectedGroupId, vendorGroups, search]);

    useEffect(() => {
        if (salespeople.length > 0) {
            const map: Record<string, string> = {};
            salespeople.forEach(sp => { map[sp.id] = ""; });
            campaignGoals.forEach(g => { map[g.salespersonId] = g.triggerValue > 0 ? String(g.triggerValue) : ""; });
            setLocalGoals(map);
            setIsDirty(false);
        }
    }, [campaignGoals, salespeople, selectedCampaign, selectedYear]);

    const saveMutation = useMutation({
        mutationFn: async (payload: { campaignName: string; year: number; goals: CampaignGoal[] }) => {
            const res = await apiRequest("POST", "/api/metas/admin/campaign-goals", payload);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Gatilhos salvos com sucesso!" });
            setIsDirty(false);
            queryClient.invalidateQueries({ queryKey: ["/api/metas/admin/campaign-goals"] });
        },
        onError: (err: Error) => {
            toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
        },
    });

    const handleGoalChange = (salespersonId: string, value: string) => {
        setLocalGoals(prev => ({ ...prev, [salespersonId]: value }));
        setIsDirty(true);
    };

    const handleSave = () => {
        const goals: CampaignGoal[] = Object.entries(localGoals)
            .map(([salespersonId, val]) => ({
                salespersonId,
                triggerValue: val === "" ? 0 : parseFloat(val),
            }))
            .filter(g => !isNaN(g.triggerValue));

        saveMutation.mutate({ campaignName: selectedCampaign, year: selectedYear, goals });
    };

    const getSavedValue = (spId: string) => {
        const found = campaignGoals.find(g => g.salespersonId === spId);
        return found && found.triggerValue > 0
            ? found.triggerValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
            : "—";
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

    const isLoading = loadingSalespeople || loadingGoals;

    return (
        <div className="h-full overflow-y-auto">
            <div className="p-6 max-w-5xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/metas">
                        <Button variant="outline" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Gerenciar Gatilhos</h1>
                        <p className="text-muted-foreground text-sm">
                            Configure os alvos mínimos individuais (em R$) por vendedor para cada campanha.
                        </p>
                    </div>
                </div>

                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-wrap items-center gap-3 justify-between">
                            <div>
                                <CardTitle className="text-base">Filtros</CardTitle>
                                <CardDescription>Campanha, ano e equipe.</CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Select
                                    value={selectedYear.toString()}
                                    onValueChange={v => setSelectedYear(parseInt(v))}
                                >
                                    <SelectTrigger className="w-[110px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {YEARS.map(y => (
                                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedCampaign} onValueChange={v => { setSelectedCampaign(v); setSearch(""); }}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CAMPAIGNS.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue placeholder="Equipe" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas as Equipes</SelectItem>
                                        {vendorGroups.map(g => (
                                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <VendorGroupsDialog salespeople={salespeople} />
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar vendedor..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-9 h-9 text-sm"
                                />
                            </div>
                            <Badge variant="secondary" className="text-xs">
                                {filteredSalespeople.length} vendedores
                            </Badge>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[90px]">ID</TableHead>
                                            <TableHead>Vendedor</TableHead>
                                            <TableHead className="text-right w-[200px]">Salvo (R$)</TableHead>
                                            <TableHead className="text-right w-[200px]">Gatilho Mínimo (R$)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredSalespeople.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                    Nenhum vendedor encontrado.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredSalespeople.map(sp => (
                                                <TableRow
                                                    key={sp.id}
                                                    className={localGoals[sp.id] !== (campaignGoals.find(g => g.salespersonId === sp.id)?.triggerValue?.toString() ?? "") ? "bg-primary/5" : ""}
                                                >
                                                    <TableCell className="font-mono text-xs text-muted-foreground">{sp.id}</TableCell>
                                                    <TableCell className="font-medium">{sp.name}</TableCell>
                                                    <TableCell className="text-right text-muted-foreground text-sm">
                                                        {getSavedValue(sp.id)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span className="text-muted-foreground text-sm">R$</span>
                                                            <Input
                                                                className="w-[130px] text-right h-8 text-sm"
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={localGoals[sp.id] ?? ""}
                                                                onChange={e => handleGoalChange(sp.id, e.target.value)}
                                                                placeholder="0,00"
                                                            />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-4">
                            <p className="text-xs text-muted-foreground">
                                {isDirty ? "Há alterações não salvas." : "Sem alterações pendentes."}
                            </p>
                            <Button
                                onClick={handleSave}
                                disabled={!isDirty || saveMutation.isPending}
                                className="gap-2"
                            >
                                {saveMutation.isPending
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Save className="w-4 h-4" />
                                }
                                Salvar Alterações
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
