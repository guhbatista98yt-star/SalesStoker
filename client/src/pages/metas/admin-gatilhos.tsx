import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, subDays } from "date-fns";
import { Save, Loader2, ArrowLeft } from "lucide-react";
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

const CAMPAIGNS = [
    { id: "dtr_amanco", name: "DTR Amanco" },
    { id: "tv_amanco", name: "TV Amanco" },
    { id: "elit", name: "Tintas Elit" },
];

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

    const [selectedCampaign, setSelectedCampaign] = useState<string>("dtr_amanco");
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
    const [localGoals, setLocalGoals] = useState<Record<string, number>>({});
    const [isDirty, setIsDirty] = useState(false);

    const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const endDate = format(new Date(), 'yyyy-MM-dd');

    const { data: salespeopleRaw, isLoading: loadingSalespeople } = useQuery<SalespersonWithStats[]>({
        queryKey: [`/api/salespersons/1/${startDate}/${endDate}`],
    });

    const salespeople = salespeopleRaw
        ? Array.from(
            new Map(salespeopleRaw.map(s => [s.salesperson.id, s.salesperson])).values()
        ).sort((a, b) => a.name.localeCompare(b.name))
        : [];

    const { data: campaignGoals, isLoading: loadingGoals } = useQuery<CampaignGoal[]>({
        queryKey: ["/api/metas/admin/campaign-goals", selectedCampaign, selectedYear],
        queryFn: async () => {
            const res = await fetch(`/api/metas/admin/campaign-goals?campaign=${selectedCampaign}&year=${selectedYear}`);
            if (!res.ok) throw new Error("Failed to fetch goals");
            return res.json();
        }
    });

    const { data: vendorGroups } = useQuery<VendorGroup[]>({
        queryKey: ["/api/admin/vendor-groups"],
    });

    const filteredSalespeople = salespeople.filter(sp => {
        if (selectedGroupId === "all") return true;
        const group = vendorGroups?.find(g => g.id === selectedGroupId);
        return group?.members.includes(sp.id) || false;
    });

    useEffect(() => {
        if (campaignGoals && salespeople.length) {
            const goalsMap: Record<string, number> = {};
            salespeople.forEach(sp => { goalsMap[sp.id] = 0; });
            campaignGoals.forEach(goal => { goalsMap[goal.salespersonId] = goal.triggerValue; });
            setLocalGoals(goalsMap);
            setIsDirty(false);
        }
    }, [campaignGoals, selectedCampaign, selectedYear]);

    const saveMutation = useMutation({
        mutationFn: async (payload: { campaignName: string, year: number, goals: CampaignGoal[] }) => {
            const res = await fetch("/api/metas/admin/campaign-goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Failed to save");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Gatilhos Salvos!", description: "As metas individuais foram salvas com sucesso." });
            setIsDirty(false);
            queryClient.invalidateQueries({ queryKey: ["/api/metas/admin/campaign-goals"] });
        },
        onError: (err) => {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        }
    });

    const handleGoalChange = (salespersonId: string, value: string) => {
        const numValue = parseFloat(value.replace(/[^0-9.-]+/g, ""));
        setLocalGoals(prev => ({
            ...prev,
            [salespersonId]: isNaN(numValue) ? 0 : numValue
        }));
        setIsDirty(true);
    };

    const handleSave = () => {
        const payload = {
            campaignName: selectedCampaign,
            year: selectedYear,
            goals: Object.entries(localGoals).map(([salespersonId, triggerValue]) => ({
                salespersonId,
                triggerValue
            }))
        };
        saveMutation.mutate(payload);
    };

    if (loadingSalespeople || loadingGoals) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

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
                        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Gatilhos</h1>
                        <p className="text-muted-foreground">Configurar alvos mínimos individuais (em R$) por vendedor.</p>
                    </div>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div className="space-y-1">
                            <CardTitle>Filtros</CardTitle>
                            <CardDescription>Selecione a campanha para exibir os vendedores.</CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="Ano" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={(new Date().getFullYear() - 1).toString()}>{new Date().getFullYear() - 1}</SelectItem>
                                    <SelectItem value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</SelectItem>
                                    <SelectItem value={(new Date().getFullYear() + 1).toString()}>{new Date().getFullYear() + 1}</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Campanha" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CAMPAIGNS.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Equipe" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Equipes</SelectItem>
                                    {vendorGroups?.map(g => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <VendorGroupsDialog salespeople={salespeople} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">ID</TableHead>
                                        <TableHead>Vendedor</TableHead>
                                        <TableHead className="text-right w-[250px]">Gatilho Mínimo (R$)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSalespeople.map((sp) => (
                                        <TableRow key={sp.id}>
                                            <TableCell className="font-medium">{sp.id}</TableCell>
                                            <TableCell>{sp.name}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end">
                                                    <span className="text-muted-foreground mr-2">R$</span>
                                                    <Input
                                                        className="w-[140px] text-right"
                                                        type="number"
                                                        step="0.01"
                                                        value={localGoals[sp.id] || ""}
                                                        onChange={(e) => handleGoalChange(sp.id, e.target.value)}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {!filteredSalespeople.length && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center">
                                                Nenhum vendedor encontrado no período ou grupo.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex justify-end mt-6">
                            <Button
                                onClick={handleSave}
                                disabled={!isDirty || saveMutation.isPending}
                                className="gap-2"
                            >
                                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar Alterações
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
