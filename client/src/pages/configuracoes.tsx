import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { formatCurrency } from "@/lib/calendar-utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Target,
  Sliders,
  BarChart3,
  Plus,
  Trash2,
  Save,
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  CalendarDays,
  Lock,
  Download,
  Trophy,
  TrendingUp,
  ShieldAlert,
  Pencil,
  Megaphone,
  ArrowRight,
} from "lucide-react";
import { GoalSwitch } from "@/components/goal-switch";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GoalConfigItem {
  salespersonId: string;
  weeklyMode: "unified" | "split";
  monthlyMode: "unified" | "split";
  goals: Array<{ type: "weekly" | "monthly"; companyId: string; value: number }>;
}

interface RowGoalState {
  mode: "unified" | "split";
  all: string; l01: string; l03: string;
  dirty: boolean; saving: boolean; saved: boolean;
}

interface LocalGoalValues {
  [salespersonId: string]: { weekly: RowGoalState; monthly: RowGoalState };
}

interface Salesperson { id: string; name: string }

interface VendorGroup { id: string; name: string; members: string[] }

interface CampaignGoal { salespersonId: string; triggerValue: number }

interface CampaignReportRow {
  salespersonId: string;
  salespersonName: string;
  targetTrigger: number;
  currentSales: number;
  percentAchieved: number;
  isEligible: boolean;
  details?: any;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CAMPAIGNS = [
  { id: "dtr_amanco", name: "DTR Amanco" },
  { id: "tv_amanco", name: "TV Amanco" },
  { id: "elit", name: "Tintas Elit" },
];

const QUARTERS = [
  { value: 0, label: "Q1 — Jan/Fev/Mar" },
  { value: 1, label: "Q2 — Abr/Mai/Jun" },
  { value: 2, label: "Q3 — Jul/Ago/Set" },
  { value: 3, label: "Q4 — Out/Nov/Dez" },
];

const YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i);

const NAV_ITEMS = [
  { id: "equipes", label: "Equipes", icon: Users },
  { id: "metas", label: "Metas de Venda", icon: Target },
  { id: "gatilhos", label: "Gatilhos", icon: Sliders },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
];

// ─── Goal helpers ─────────────────────────────────────────────────────────────

const DEFAULT_ROW: RowGoalState = {
  mode: "split", all: "", l01: "", l03: "", dirty: false, saving: false, saved: false,
};

function buildGoalInitials(
  salespersons: Salesperson[],
  serverConfig: GoalConfigItem[]
): LocalGoalValues {
  const getVal = (goals: GoalConfigItem["goals"] | undefined, type: "weekly" | "monthly", cid: string) => {
    if (!goals) return "";
    const g = goals.find(x => x.type === type && x.companyId === cid);
    return g ? String(g.value) : "";
  };
  const values: LocalGoalValues = {};
  for (const sp of salespersons) {
    const cfg = serverConfig.find(c => c.salespersonId === sp.id);
    values[sp.id] = {
      weekly: {
        mode: cfg?.weeklyMode ?? "split",
        all: getVal(cfg?.goals, "weekly", "all"),
        l01: getVal(cfg?.goals, "weekly", "1"),
        l03: getVal(cfg?.goals, "weekly", "3"),
        dirty: false, saving: false, saved: false,
      },
      monthly: {
        mode: cfg?.monthlyMode ?? "split",
        all: getVal(cfg?.goals, "monthly", "all"),
        l01: getVal(cfg?.goals, "monthly", "1"),
        l03: getVal(cfg?.goals, "monthly", "3"),
        dirty: false, saving: false, saved: false,
      },
    };
  }
  return values;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtBRL(v: number | undefined | null) {
  return (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Equipes
// ═══════════════════════════════════════════════════════════════════════════════

function EquipesSection({ salespeople }: { salespeople: Salesperson[] }) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: groups = [], isLoading } = useQuery<VendorGroup[]>({
    queryKey: ["/api/admin/vendor-groups"],
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: VendorGroup) => {
      const res = await apiRequest("POST", "/api/admin/vendor-groups", payload);
      return res.json();
    },
    onSuccess: (saved: VendorGroup) => {
      toast({ title: "Equipe salva!" });
      setIsCreating(false);
      setSelectedId(saved.id);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendor-groups"] });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/vendor-groups/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Equipe excluída" });
      setSelectedId(null);
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendor-groups"] });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const selectedGroup = groups.find(g => g.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedGroup) {
      setGroupName(selectedGroup.name);
      setMembers(selectedGroup.members);
      setIsCreating(false);
    }
  }, [selectedId, groups]);

  function startNew() {
    setSelectedId(null);
    setGroupName("Nova Equipe");
    setMembers([]);
    setIsCreating(true);
    setMemberSearch("");
  }

  function handleSave() {
    if (!groupName.trim()) {
      toast({ title: "Nome da equipe não pode estar vazio", variant: "destructive" });
      return;
    }
    const id = isCreating
      ? Math.random().toString(36).slice(2, 12)
      : selectedId!;
    saveMutation.mutate({ id, name: groupName, members });
  }

  const filteredMembers = memberSearch
    ? salespeople.filter(sp => sp.name.toLowerCase().includes(memberSearch.toLowerCase()))
    : salespeople;

  const isEditing = isCreating || !!selectedGroup;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Gerenciar Equipes</h2>
        <p className="text-sm text-muted-foreground">
          Crie grupos de vendedores para facilitar filtros e configurações em lote.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[520px]">
        {/* Left: team list */}
        <div className="border rounded-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
            <span className="text-sm font-medium">Equipes ({groups.length})</span>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={startNew}>
              <Plus className="h-3.5 w-3.5" /> Nova
            </Button>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground px-4">
                Nenhuma equipe criada ainda. Clique em "Nova" para começar.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => { setSelectedId(g.id); setIsCreating(false); }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-center justify-between gap-2",
                      selectedId === g.id && !isCreating
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="font-medium truncate">{g.name}</span>
                    <Badge
                      variant={selectedId === g.id && !isCreating ? "secondary" : "outline"}
                      className="text-[10px] shrink-0"
                    >
                      {g.members.length}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: editor */}
        <div className="md:col-span-2 border rounded-lg flex flex-col overflow-hidden">
          {!isEditing ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground flex-col gap-3">
              <Users className="h-10 w-10 text-muted-foreground/40" />
              <p>Selecione uma equipe ou crie uma nova para editar.</p>
            </div>
          ) : (
            <>
              {/* Editor header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/20">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Nome da Equipe</Label>
                  <Input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    className="h-9 text-sm font-medium"
                    placeholder="Nome da equipe..."
                  />
                </div>
                <div className="flex items-end gap-2 pb-0.5">
                  {!isCreating && selectedId && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        if (confirm("Excluir esta equipe?")) deleteMutation.mutate(selectedId);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Salvar
                  </Button>
                </div>
              </div>

              {/* Member count badge + search */}
              <div className="flex items-center gap-3 px-4 py-2 border-b">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar vendedor..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {members.length} selecionados
                </Badge>
                {members.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 text-muted-foreground"
                    onClick={() => setMembers([])}
                  >
                    Limpar
                  </Button>
                )}
              </div>

              {/* Member list */}
              <ScrollArea className="flex-1 p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {filteredMembers.map(sp => {
                    const checked = members.includes(sp.id);
                    return (
                      <label
                        key={sp.id}
                        htmlFor={`m-${sp.id}`}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors text-sm",
                          checked ? "bg-primary/8 border border-primary/20" : "hover:bg-muted/60"
                        )}
                      >
                        <Checkbox
                          id={`m-${sp.id}`}
                          checked={checked}
                          onCheckedChange={val => {
                            setMembers(prev =>
                              val ? [...prev, sp.id] : prev.filter(id => id !== sp.id)
                            );
                          }}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{sp.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{sp.id}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Metas de Venda
// ═══════════════════════════════════════════════════════════════════════════════

function MetasSection({ salespersons, serverConfig, isLoading, isAdmin }: {
  salespersons: Salesperson[];
  serverConfig: GoalConfigItem[];
  isLoading: boolean;
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const [search, setSearch] = useState("");
  const [localValues, setLocalValues] = useState<LocalGoalValues>({});
  const [initialized, setInitialized] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; salespersonId: string; type: "weekly" | "monthly"; targetMode: "unified" | "split";
  } | null>(null);

  useEffect(() => {
    if (!initialized && salespersons.length > 0 && serverConfig !== undefined) {
      setLocalValues(buildGoalInitials(salespersons, serverConfig));
      setInitialized(true);
    }
  }, [salespersons, serverConfig, initialized]);

  const filtered = useMemo(() => {
    const t = search.toLowerCase().trim();
    return t ? salespersons.filter(sp => sp.name.toLowerCase().includes(t)) : salespersons;
  }, [salespersons, search]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      salespersonId: string; type: "weekly" | "monthly"; mode: "unified" | "split";
      values: { all: number | null; "1": number | null; "3": number | null };
    }) => apiRequest("POST", "/api/goals-config", { ...payload, month: currentMonth, year: currentYear }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals-config"] });
      setLocalValues(prev => ({
        ...prev,
        [vars.salespersonId]: {
          ...prev[vars.salespersonId],
          [vars.type]: { ...prev[vars.salespersonId][vars.type], dirty: false, saving: false, saved: true },
        },
      }));
      setTimeout(() => {
        setLocalValues(prev => ({
          ...prev,
          [vars.salespersonId]: {
            ...prev[vars.salespersonId],
            [vars.type]: { ...prev[vars.salespersonId]?.[vars.type], saved: false },
          },
        }));
      }, 2500);
    },
    onError: (_, vars) => {
      setLocalValues(prev => ({
        ...prev,
        [vars.salespersonId]: {
          ...prev[vars.salespersonId],
          [vars.type]: { ...prev[vars.salespersonId][vars.type], saving: false },
        },
      }));
      toast({ title: "Erro ao salvar meta", variant: "destructive" });
    },
  });

  const handleInputChange = (id: string, type: "weekly" | "monthly", field: "all" | "l01" | "l03", value: string) => {
    if (!isAdmin) return;
    setLocalValues(prev => ({
      ...prev,
      [id]: { ...prev[id], [type]: { ...prev[id]?.[type], [field]: value, dirty: true, saved: false } },
    }));
  };

  const parseVal = (v: string) => (v === "" ? null : parseFloat(v.replace(",", ".")));

  const handleSave = (id: string, type: "weekly" | "monthly") => {
    const cur = localValues[id]?.[type];
    if (!cur?.dirty) return;
    setLocalValues(prev => ({
      ...prev,
      [id]: { ...prev[id], [type]: { ...prev[id][type], saving: true } },
    }));
    saveMutation.mutate({
      salespersonId: id, type, mode: cur.mode,
      values: { all: parseVal(cur.all), "1": parseVal(cur.l01), "3": parseVal(cur.l03) },
    });
  };

  const handleSaveAll = (type: "weekly" | "monthly") => {
    const dirty = salespersons.filter(sp => localValues[sp.id]?.[type]?.dirty);
    if (!dirty.length) { toast({ title: "Nenhuma alteração pendente" }); return; }
    dirty.forEach(sp => handleSave(sp.id, type));
    toast({ title: `Salvando ${dirty.length} metas...` });
  };

  const getSaved = (spId: string, type: "weekly" | "monthly", cid: string) => {
    const cfg = serverConfig.find(c => c.salespersonId === spId);
    if (!cfg) return "—";
    const g = cfg.goals.find(g => g.type === type && g.companyId === cid);
    return g ? formatCurrency(g.value) : "Sem meta";
  };

  const dirtyCount = (type: "weekly" | "monthly") =>
    salespersons.filter(sp => localValues[sp.id]?.[type]?.dirty).length;

  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const renderRow = (sp: Salesperson, type: "weekly" | "monthly") => {
    const config = localValues[sp.id]?.[type];
    if (!config) return null;
    const isUnified = config.mode === "unified";

    return (
      <div key={sp.id} className={cn(
        "flex flex-col gap-3 p-4 rounded-lg border transition-colors",
        config.dirty ? "border-primary/40 bg-primary/5" : "bg-muted/20"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-[180px]">
            <p className="font-semibold text-sm">{sp.name}</p>
            <p className="text-xs text-muted-foreground font-mono">ID: {sp.id}</p>
          </div>

          <div className="flex flex-col gap-3 flex-1">
            <GoalSwitch
              mode={config.mode}
              onToggle={(c) => {
                if (!isAdmin) return;
                setConfirmDialog({ open: true, salespersonId: sp.id, type, targetMode: c ? "unified" : "split" });
              }}
              disabled={!isAdmin}
            />
            <div className="flex flex-wrap gap-3 items-end">
              {isUnified ? (
                <div>
                  <Label className="text-xs mb-1 block text-muted-foreground">Meta Individual</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">R$</span>
                    <Input disabled={!isAdmin} type="number" min="0" step="1"
                      className="pl-8 w-36 text-sm" value={config.all}
                      onChange={e => handleInputChange(sp.id, type, "all", e.target.value)} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Salvo: {getSaved(sp.id, type, "all")}</p>
                </div>
              ) : (
                <>
                  {(["l01", "l03"] as const).map((f, i) => (
                    <div key={f}>
                      <Label className="text-xs mb-1 block text-muted-foreground">{i === 0 ? "Varejo (L01)" : "Atacado (L03)"}</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">R$</span>
                        <Input disabled={!isAdmin} type="number" min="0" step="1"
                          className="pl-8 w-36 text-sm" value={config[f]}
                          onChange={e => handleInputChange(sp.id, type, f, e.target.value)} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Salvo: {getSaved(sp.id, type, i === 0 ? "1" : "3")}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center">
              {config.saved ? (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" /> Salvo
                </span>
              ) : (
                <Button size="sm" variant={config.dirty ? "default" : "outline"}
                  disabled={!config.dirty || config.saving}
                  onClick={() => handleSave(sp.id, type)}
                  className="gap-1 text-xs h-8">
                  {config.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salvar
                </Button>
              )}
            </div>
          )}
        </div>
        {!isAdmin && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <Lock className="h-3 w-3" /> Apenas o administrador pode editar metas.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Metas de Venda</h2>
          <p className="text-sm text-muted-foreground">
            {monthNames[currentMonth - 1]} {currentYear} — Configure as metas semanais e mensais por vendedor.
          </p>
        </div>
        {!isAdmin && <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Somente leitura</Badge>}
      </div>

      <Card>
        <CardContent className="pt-4">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <TabsList className="h-auto bg-transparent p-0 border-b rounded-none">
                  {(["weekly", "monthly"] as const).map(type => (
                    <TabsTrigger key={type} value={type}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 gap-2">
                      {type === "weekly" ? <Calendar className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                      {type === "weekly" ? "Semanais" : "Mensais"}
                      {dirtyCount(type) > 0 && (
                        <Badge variant="secondary" className="text-xs">{dirtyCount(type)}</Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="relative">
                  <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={search}
                    onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm w-48" />
                </div>
              </div>
              {isAdmin && (
                <Button size="sm" variant="outline"
                  onClick={() => handleSaveAll(activeTab)}
                  disabled={dirtyCount(activeTab) === 0}
                  className="gap-1 text-xs">
                  <Save className="h-3.5 w-3.5" />
                  Salvar todos ({dirtyCount(activeTab)})
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <TabsContent value="weekly" className="space-y-3 mt-0">
                  {filtered.length === 0
                    ? <p className="text-center text-muted-foreground py-12 text-sm">Nenhum vendedor encontrado.</p>
                    : filtered.map(sp => renderRow(sp, "weekly"))}
                </TabsContent>
                <TabsContent value="monthly" className="space-y-3 mt-0">
                  {filtered.length === 0
                    ? <p className="text-center text-muted-foreground py-12 text-sm">Nenhum vendedor encontrado.</p>
                    : filtered.map(sp => renderRow(sp, "monthly"))}
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDialog} onOpenChange={o => !o && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.targetMode === "unified" ? "Alterar para Meta Individual?" : "Alterar para Metas Separadas?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.targetMode === "unified"
                ? "As metas separadas por loja serão descartadas ao salvar."
                : "O valor da Meta Individual será descartado ao salvar."}
              {" "}Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!confirmDialog) return;
              const { salespersonId, type, targetMode } = confirmDialog;
              setLocalValues(prev => ({
                ...prev,
                [salespersonId]: {
                  ...prev[salespersonId],
                  [type]: { mode: targetMode, all: "", l01: "", l03: "", dirty: true, saving: false, saved: false },
                },
              }));
              setConfirmDialog(null);
            }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Gatilhos de Campanha
// ═══════════════════════════════════════════════════════════════════════════════

function GatilhosSection({ salespeople }: { salespeople: Salesperson[] }) {
  const { toast } = useToast();
  const [campaign, setCampaign] = useState("dtr_amanco");
  const [year, setYear] = useState(new Date().getFullYear());
  const [groupId, setGroupId] = useState("all");
  const [search, setSearch] = useState("");
  const [localGoals, setLocalGoals] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  const { data: campaignGoals = [], isLoading: loadingGoals } = useQuery<CampaignGoal[]>({
    queryKey: ["/api/metas/admin/campaign-goals", campaign, year],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/metas/admin/campaign-goals?campaign=${campaign}&year=${year}`);
      return res.json();
    },
  });

  const { data: vendorGroups = [] } = useQuery<VendorGroup[]>({
    queryKey: ["/api/admin/vendor-groups"],
  });

  const filtered = useMemo(() => {
    let list = salespeople;
    if (groupId !== "all") {
      const g = vendorGroups.find(g => g.id === groupId);
      list = list.filter(sp => g?.members.includes(sp.id));
    }
    const t = search.toLowerCase().trim();
    if (t) list = list.filter(sp => sp.name.toLowerCase().includes(t) || sp.id.includes(t));
    return list;
  }, [salespeople, groupId, vendorGroups, search]);

  useEffect(() => {
    if (salespeople.length > 0) {
      const map: Record<string, string> = {};
      salespeople.forEach(sp => { map[sp.id] = ""; });
      campaignGoals.forEach(g => { map[g.salespersonId] = g.triggerValue > 0 ? String(g.triggerValue) : ""; });
      setLocalGoals(map);
      setIsDirty(false);
    }
  }, [campaignGoals, salespeople, campaign, year]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { campaignName: string; year: number; goals: CampaignGoal[] }) => {
      const res = await apiRequest("POST", "/api/metas/admin/campaign-goals", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Gatilhos salvos!" });
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/metas/admin/campaign-goals"] });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const handleSave = () => {
    const goals: CampaignGoal[] = Object.entries(localGoals)
      .map(([salespersonId, val]) => ({ salespersonId, triggerValue: val === "" ? 0 : parseFloat(val) }))
      .filter(g => !isNaN(g.triggerValue));
    saveMutation.mutate({ campaignName: campaign, year, goals });
  };

  const getSaved = (spId: string) => {
    const f = campaignGoals.find(g => g.salespersonId === spId);
    return f && f.triggerValue > 0 ? f.triggerValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—";
  };

  const isLoading = loadingGoals;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Gatilhos de Campanha</h2>
        <p className="text-sm text-muted-foreground">
          Configure os alvos mínimos individuais (R$) por vendedor para cada campanha.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={campaign} onValueChange={v => { setCampaign(v); setSearch(""); }}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGNS.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todas as equipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as equipes</SelectItem>
                {vendorGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar vendedor..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
            </div>

            <Badge variant="secondary" className="text-xs">{filtered.length} vendedores</Badge>
          </div>
        </CardHeader>

        <CardContent>
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
                    <TableHead className="text-right w-[180px]">Salvo (R$)</TableHead>
                    <TableHead className="text-right w-[200px]">Gatilho Mínimo (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Nenhum vendedor encontrado.</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(sp => {
                      const saved = campaignGoals.find(g => g.salespersonId === sp.id)?.triggerValue;
                      const local = localGoals[sp.id] ?? "";
                      const changed = local !== (saved ? String(saved) : "");
                      return (
                        <TableRow key={sp.id} className={changed ? "bg-primary/5" : ""}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{sp.id}</TableCell>
                          <TableCell className="font-medium">{sp.name}</TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">{getSaved(sp.id)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-muted-foreground text-sm">R$</span>
                              <Input
                                className="w-[130px] text-right h-8 text-sm"
                                type="number" step="0.01" min="0"
                                value={local}
                                onChange={e => {
                                  setLocalGoals(prev => ({ ...prev, [sp.id]: e.target.value }));
                                  setIsDirty(true);
                                }}
                                placeholder="0,00"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              {isDirty ? "Há alterações não salvas." : "Sem alterações pendentes."}
            </p>
            <Button onClick={handleSave} disabled={!isDirty || saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Relatórios de Campanha
// ═══════════════════════════════════════════════════════════════════════════════

function RelatoriosSection() {
  const { toast } = useToast();
  const now = new Date();
  const [campaign, setCampaign] = useState("dtr_amanco");
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [reportQuarter, setReportQuarter] = useState(Math.floor(now.getMonth() / 3));

  const queryKey = useMemo(() => {
    if (campaign === "dtr_amanco") {
      return ["/api/metas/admin/campaign-report", campaign, reportYear, reportQuarter];
    }
    return ["/api/metas/admin/campaign-report", campaign];
  }, [campaign, reportYear, reportQuarter]);

  const { data: reportData = [], isLoading, error } = useQuery<CampaignReportRow[]>({
    queryKey,
    queryFn: async () => {
      let url = `/api/metas/admin/campaign-report?campaign=${campaign}`;
      if (campaign === "dtr_amanco") {
        url += `&year=${reportYear}&quarter=${reportQuarter}`;
      }
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const sorted = useMemo(() => [...reportData].sort((a, b) => b.percentAchieved - a.percentAchieved), [reportData]);

  const stats = useMemo(() => {
    const eligible = reportData.filter(r => r.isEligible).length;
    const avgPct = reportData.length > 0
      ? reportData.reduce((s, r) => s + (r.percentAchieved ?? 0), 0) / reportData.length : 0;
    return { total: reportData.length, eligible, avgPct };
  }, [reportData]);

  const exportCSV = () => {
    if (!reportData.length) return;
    const headers = ["ID", "Nome", "Gatilho (R$)", "Vendas (R$)", "% Atingido", "Elegível"];
    const rows = reportData.map(r => [
      r.salespersonId,
      `"${r.salespersonName}"`,
      (r.targetTrigger ?? 0).toFixed(2),
      (r.currentSales ?? 0).toFixed(2),
      (r.percentAchieved ?? 0).toFixed(2),
      r.isEligible ? "SIM" : "NÃO",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `relatorio_${campaign}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const campaignLabel = CAMPAIGNS.find(c => c.id === campaign)?.name ?? campaign;

  // Period info labels
  const periodLabel = useMemo(() => {
    if (campaign === "dtr_amanco") {
      return `${QUARTERS[reportQuarter]?.label} / ${reportYear}`;
    }
    if (campaign === "tv_amanco") return "15/02/2026 a 15/04/2026 (campanha fixa)";
    if (campaign === "elit") {
      const daysOfWeek = now.getDay();
      const adj = daysOfWeek === 6 ? 7 : daysOfWeek === 0 ? 8 : daysOfWeek + 1;
      const sat = new Date(now); sat.setDate(now.getDate() - adj);
      const fri = new Date(sat); fri.setDate(sat.getDate() + 6);
      return `${format(sat, "dd/MM")} a ${format(fri, "dd/MM/yyyy")} (semana atual)`;
    }
    return "";
  }, [campaign, reportYear, reportQuarter]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Relatórios de Campanha</h2>
        <p className="text-sm text-muted-foreground">
          Analise elegibilidade, atingimento e ganhadores por período.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Campanha</Label>
              <Select value={campaign} onValueChange={setCampaign}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGNS.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {campaign === "dtr_amanco" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Ano</Label>
                  <Select value={String(reportYear)} onValueChange={v => setReportYear(parseInt(v))}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Trimestre</Label>
                  <Select value={String(reportQuarter)} onValueChange={v => setReportQuarter(parseInt(v))}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUARTERS.map(q => <SelectItem key={q.value} value={String(q.value)}>{q.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex-1 flex items-end justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{periodLabel}</span>
              </div>
              <Button variant="secondary" size="sm" className="gap-2" onClick={exportCSV} disabled={!reportData.length}>
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {!isLoading && reportData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Users className="h-8 w-8 text-muted-foreground/60" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Vendedores na campanha</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <Trophy className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.eligible}</p>
                <p className="text-xs text-muted-foreground">Elegíveis / Ganhadores</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.avgPct.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Atingimento médio</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Análise de Ganhadores — {campaignLabel}
          </CardTitle>
          <CardDescription>
            Elegibilidade considera gatilhos, travas de loja e mix de produtos.
          </CardDescription>
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
                      Nenhum dado encontrado para esta campanha/período.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map(row => (
                    <TableRow key={row.salespersonId}
                      className={row.isEligible ? "bg-green-50 dark:bg-green-950/20" : ""}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.salespersonId}</TableCell>
                      <TableCell className="font-medium">{row.salespersonName}</TableCell>
                      <TableCell className="text-right text-sm">
                        {row.targetTrigger > 0 ? `R$ ${fmtBRL(row.targetTrigger)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">R$ {fmtBRL(row.currentSales)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(row.percentAchieved ?? 0, 100)} className="h-2 flex-1" />
                          <span className={cn(
                            "text-xs font-medium w-12 text-right",
                            (row.percentAchieved ?? 0) >= 100 ? "text-green-600" : "text-muted-foreground"
                          )}>
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
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: Configurações Hub
// ═══════════════════════════════════════════════════════════════════════════════

export default function Configuracoes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeSection, setActiveSection] = useState("equipes");

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const { data: serverConfig = [], isLoading: configLoading } = useQuery<GoalConfigItem[]>({
    queryKey: ["/api/goals-config", currentMonth.toString(), currentYear.toString()],
  });

  const startDate = format(subDays(today, 60), "yyyy-MM-dd");
  const endDate = format(today, "yyyy-MM-dd");

  const { data: salespersonsRaw = [], isLoading: spLoading } = useQuery<any[]>({
    queryKey: [`/api/salespersons/all/${startDate}/${endDate}`],
  });

  const salespersons = useMemo<Salesperson[]>(() => {
    if (!salespersonsRaw.length) return [];
    return Array.from(
      new Map(
        salespersonsRaw.map((d: any) => {
          const sp = d.salesperson ?? d;
          return [sp.id, { id: sp.id, name: sp.name }];
        })
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [salespersonsRaw]);

  const isLoading = configLoading || spLoading;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-12">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Esta área é exclusiva para administradores.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b bg-background/95 backdrop-blur px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie equipes, metas, gatilhos e relatórios de campanhas em um só lugar.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <nav className="w-52 shrink-0 border-r bg-muted/20 p-3 flex flex-col gap-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left",
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}

          {/* Campanhas — link externo */}
          <div className="mt-auto pt-3 border-t border-border/60">
            <Link
              href="/campanhas"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Megaphone className="h-4 w-4 shrink-0" />
              Criar Campanhas
              <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </Link>
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            {activeSection === "equipes" && (
              <EquipesSection salespeople={salespersons} />
            )}
            {activeSection === "metas" && (
              <MetasSection
                salespersons={salespersons}
                serverConfig={serverConfig}
                isLoading={isLoading}
                isAdmin={isAdmin}
              />
            )}
            {activeSection === "gatilhos" && (
              <GatilhosSection salespeople={salespersons} />
            )}
            {activeSection === "relatorios" && (
              <RelatoriosSection />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
