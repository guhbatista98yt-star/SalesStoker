import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  Save, Search, Users, Zap, Loader2, RotateCcw,
  ChevronDown, Percent, Hash, AlertCircle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SalespersonGoal {
  id: string;
  name: string;
  triggerValue: number | null;
}

interface GatilhosData {
  campaign: { id: string; name: string; code: string };
  year: number;
  salespersons: SalespersonGoal[];
}

interface VendorGroup {
  id: string;
  name: string;
  members: string[];
}

interface GatilhosTabProps {
  campaignId: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);
}

function parseBRL(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function GatilhosTab({ campaignId }: GatilhosTabProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();

  const [year, setYear] = useState(CURRENT_YEAR);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"fixed" | "percent">("fixed");
  const [bulkValue, setBulkValue] = useState("");

  const { data, isLoading, error } = useQuery<GatilhosData>({
    queryKey: [`/api/campaigns/${campaignId}/gatilhos`, year],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/gatilhos?year=${year}`);
      return res.json();
    },
  });

  const { data: groups = [] } = useQuery<VendorGroup[]>({
    queryKey: [`/api/campaigns/${campaignId}/groups`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/groups`);
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (goals: { salespersonId: string; triggerValue: number | null }[]) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/gatilhos`, { year, goals });
      return res.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/gatilhos`, year] });
      setEdits({});
      toast({ title: `${r.saved} gatilhos salvos com sucesso.` });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const groupMembers = useMemo(() => {
    if (groupFilter === "all") return null;
    const g = groups.find(g => g.id === groupFilter);
    return g ? new Set(g.members) : null;
  }, [groups, groupFilter]);

  const salespersons = useMemo(() => {
    if (!data) return [];
    return data.salespersons.filter(sp => {
      if (groupMembers && !groupMembers.has(sp.id)) return false;
      if (search) {
        const q = search.toLowerCase();
        return sp.name.toLowerCase().includes(q) || sp.id.includes(q);
      }
      return true;
    });
  }, [data, groupMembers, search]);

  const pendingCount = Object.keys(edits).length;
  const setCount = (data?.salespersons || []).filter(sp =>
    edits[sp.id] !== undefined
      ? edits[sp.id] !== "" && parseBRL(edits[sp.id]) !== null
      : sp.triggerValue !== null
  ).length;

  function handleEdit(spId: string, raw: string) {
    setEdits(prev => ({ ...prev, [spId]: raw }));
  }

  function getCurrentValue(sp: SalespersonGoal): string {
    if (edits[sp.id] !== undefined) return edits[sp.id];
    return sp.triggerValue !== null ? String(sp.triggerValue) : "";
  }

  function handleApplyBulk() {
    const val = parseBRL(bulkValue);
    if (val === null) return;
    const newEdits: Record<string, string> = { ...edits };
    for (const sp of salespersons) {
      if (bulkMode === "fixed") {
        newEdits[sp.id] = String(val);
      } else {
        const base = parseBRL(getCurrentValue(sp));
        if (base !== null) {
          newEdits[sp.id] = String(Math.round(base * (1 + val / 100)));
        } else {
          newEdits[sp.id] = String(val);
        }
      }
    }
    setEdits(newEdits);
    setBulkValue("");
    setBulkOpen(false);
    toast({ title: `Gatilho atualizado para ${salespersons.length} vendedores (não salvo ainda)` });
  }

  function handleSave() {
    const goals = (data?.salespersons || []).map(sp => {
      const rawEdit = edits[sp.id];
      if (rawEdit === undefined) {
        return { salespersonId: sp.id, triggerValue: sp.triggerValue };
      }
      if (rawEdit === "") {
        return { salespersonId: sp.id, triggerValue: null };
      }
      return { salespersonId: sp.id, triggerValue: parseBRL(rawEdit) };
    });
    saveMutation.mutate(goals);
  }

  function handleReset() {
    setEdits({});
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Carregando gatilhos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-destructive">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">Erro ao carregar gatilhos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Gatilhos Mínimos por Vendedor
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defina a meta mínima de vendas para cada vendedor ser elegível nesta campanha.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Year selector */}
          <Select value={String(year)} onValueChange={v => { setYear(Number(v)); setEdits({}); }}>
            <SelectTrigger className="h-8 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (
                <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bulk action */}
          {isAdmin && (
            <Popover open={bulkOpen} onOpenChange={setBulkOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                  Aplicar em Lote
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3 space-y-3">
                <p className="text-xs font-medium">
                  Aplicar para <span className="font-bold text-foreground">{salespersons.length}</span> vendedores visíveis
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm" variant={bulkMode === "fixed" ? "default" : "outline"}
                    className="h-7 text-xs flex-1 gap-1"
                    onClick={() => setBulkMode("fixed")}
                  >
                    <Hash className="h-3 w-3" /> Valor fixo
                  </Button>
                  <Button
                    size="sm" variant={bulkMode === "percent" ? "default" : "outline"}
                    className="h-7 text-xs flex-1 gap-1"
                    onClick={() => setBulkMode("percent")}
                  >
                    <Percent className="h-3 w-3" /> % aumento
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {bulkMode === "fixed" ? "Valor em R$" : "Percentual de aumento"}
                  </Label>
                  <Input
                    className="h-7 text-xs"
                    placeholder={bulkMode === "fixed" ? "Ex: 15000" : "Ex: 10"}
                    value={bulkValue}
                    onChange={e => setBulkValue(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleApplyBulk()}
                  />
                </div>
                <Button size="sm" className="w-full h-7 text-xs" onClick={handleApplyBulk}>
                  Aplicar
                </Button>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{data?.salespersons.length}</span>
          <span className="text-muted-foreground">vendedores</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-950/30 text-xs text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50">
          <CheckCircle2 className="h-3 w-3" />
          <span className="font-medium">{setCount}</span>
          <span>com gatilho</span>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
            <AlertCircle className="h-3 w-3" />
            <span className="font-medium">{pendingCount}</span>
            <span>alterações pendentes</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Buscar vendedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {groups.length > 0 && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="h-8 text-xs w-44">
              <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Todos os grupos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os grupos</SelectItem>
              {groups.map(g => (
                <SelectItem key={g.id} value={g.id} className="text-xs">
                  {g.name} ({g.members.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-16">ID</TableHead>
              <TableHead className="text-xs">Vendedor</TableHead>
              <TableHead className="text-xs text-right w-32">Valor Salvo</TableHead>
              {isAdmin && <TableHead className="text-xs w-44">Novo Gatilho (R$)</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {salespersons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-xs text-muted-foreground">
                  Nenhum vendedor encontrado
                </TableCell>
              </TableRow>
            ) : (
              salespersons.map(sp => {
                const isDirty = edits[sp.id] !== undefined;
                const hasValue = sp.triggerValue !== null;
                return (
                  <TableRow
                    key={sp.id}
                    className={cn(
                      "transition-colors",
                      isDirty && "bg-amber-50/50 dark:bg-amber-950/20",
                    )}
                  >
                    <TableCell className="text-xs font-mono text-muted-foreground">{sp.id}</TableCell>
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-2">
                        {sp.name}
                        {!hasValue && !isDirty && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4 text-muted-foreground">
                            Sem gatilho
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono">
                      {hasValue ? (
                        <span className="text-green-700 dark:text-green-400 font-medium">
                          {fmtBRL(sp.triggerValue!)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Input
                          className={cn(
                            "h-7 text-xs font-mono text-right w-40",
                            isDirty && "border-amber-400 ring-1 ring-amber-300",
                          )}
                          placeholder="Ex: 15000"
                          value={getCurrentValue(sp)}
                          onChange={e => handleEdit(sp.id, e.target.value)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Mostrando {salespersons.length} de {data?.salespersons.length} vendedores
      </p>

      {/* Footer actions */}
      {isAdmin && pendingCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
          <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">
            {pendingCount} alteração{pendingCount > 1 ? "ões" : ""} pendente{pendingCount > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={handleReset}>
              <RotateCcw className="h-3 w-3" /> Descartar
            </Button>
            <Button
              size="sm" className="h-7 text-xs gap-1.5"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Salvar Alterações
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
