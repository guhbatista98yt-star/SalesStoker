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
  Users,
  Target,
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
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Upload,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

const YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i);

const NAV_ITEMS = [
  { id: "equipes", label: "Equipes", icon: Users },
  { id: "metas", label: "Metas de Venda", icon: Target },
  { id: "permissoes", label: "Permissões", icon: ShieldCheck },
];

const ALL_MODULES = [
  "Dashboard",
  "Vendedores",
  "Metas",
  "Alertas",
  "Visão Semanal",
  "Visão Mensal",
  "Visão em Loja",
  "Campanhas",
  "Comissões",
] as const;

interface UserWithPermissions {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  modulePermissions: Record<string, boolean> | null;
}

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
// SECTION: Permissões de Módulos
// ═══════════════════════════════════════════════════════════════════════════════

function getRoleLabel(role: string) {
  switch (role) {
    case "admin": return "Admin";
    case "supervisor": return "Supervisor";
    case "vendedor": return "Vendedor";
    case "loja": return "Loja";
    default: return role;
  }
}

function LogoUploadRow({
  label, description, currentUrl, isPending,
  onUpload, onRemove,
}: {
  label: string;
  description?: string;
  currentUrl: string | null | undefined;
  isPending: boolean;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
}) {
  const { toast } = useToast();
  const url = currentUrl || null;
  return (
    <div className="px-4 py-4">
      <p className="text-sm font-medium">{label}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">{description}</p>
      )}
      {url ? (
        <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/20 max-w-sm mt-2">
          <div className="h-14 w-14 rounded border bg-white flex items-center justify-center overflow-hidden shrink-0">
            <img src={url} alt={label} className="h-full w-full object-contain p-1" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Logo atual</p>
            <p className="text-[10px] text-muted-foreground">{Math.round(url.length * 0.75 / 1024)} KB</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={onRemove}
            disabled={isPending}
          >
            Remover
          </Button>
        </div>
      ) : (
        <label className="inline-flex items-center gap-2 cursor-pointer mt-2">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-dashed rounded-lg hover:border-primary hover:bg-muted/30 transition-colors text-sm text-muted-foreground hover:text-primary">
            <Upload className="h-4 w-4" />
            <span>Escolher arquivo</span>
          </div>
          <span className="text-xs text-muted-foreground">PNG, JPG ou SVG · máx. 500 KB</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="sr-only"
            disabled={isPending}
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 512 * 1024) {
                toast({ title: "Imagem muito grande. Máx. 500 KB.", variant: "destructive" });
                return;
              }
              const reader = new FileReader();
              reader.onload = ev => onUpload(ev.target?.result as string);
              reader.readAsDataURL(file);
            }}
          />
        </label>
      )}
    </div>
  );
}

function PermissoesSection() {
  const { toast } = useToast();
  const { user: currentUser, refreshUser } = useAuth();
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [localPerms, setLocalPerms] = useState<Record<number, Record<string, boolean>>>({});

  const { data: settingAcomp }  = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showAcompanhamentoTab"],       staleTime: 0 });
  const { data: settingDtr }    = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showDtrAmancoTab"],            staleTime: 0 });
  const { data: settingTv }     = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showTvAmancoTab"],             staleTime: 0 });
  const { data: settingElit }   = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showTintasElitTab"],           staleTime: 0 });
  const { data: settingMovimt } = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showMovimentacoesButton"],     staleTime: 0 });

  const { data: settingGrace }    = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/dtrGracePeriodDays"],   staleTime: 0 });
  const { data: settingDtrLogo }  = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/dtrAmancoLogoUrl"],      staleTime: 0 });
  const { data: settingTvLogo }   = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/tvAmancoLogoUrl"],       staleTime: 0 });
  const { data: settingElitLogo } = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/tintasElitLogoUrl"],     staleTime: 0 });
  const [graceDaysInput, setGraceDaysInput] = useState<string>("");

  useEffect(() => {
    const val = settingGrace?.value ?? "5";
    setGraceDaysInput(val);
  }, [settingGrace?.value]);

  const saveGraceMutation = useMutation({
    mutationFn: async (days: string) => {
      const res = await apiRequest("POST", "/api/admin/app-settings", { key: "dtrGracePeriodDays", value: days });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings/dtrGracePeriodDays"] });
      toast({ title: "Prazo de consulta salvo." });
    },
    onError: () => {
      toast({ title: "Erro ao salvar prazo", variant: "destructive" });
    },
  });

  const saveDtrLogoMutation = useMutation({
    mutationFn: async (logoUrl: string | null) => {
      const res = await apiRequest("POST", "/api/admin/app-settings", { key: "dtrAmancoLogoUrl", value: logoUrl ?? "" });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/app-settings/dtrAmancoLogoUrl"] }); toast({ title: "Logo salva." }); },
    onError: () => toast({ title: "Erro ao salvar logo", variant: "destructive" }),
  });

  const saveTvLogoMutation = useMutation({
    mutationFn: async (logoUrl: string | null) => {
      const res = await apiRequest("POST", "/api/admin/app-settings", { key: "tvAmancoLogoUrl", value: logoUrl ?? "" });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/app-settings/tvAmancoLogoUrl"] }); toast({ title: "Logo salva." }); },
    onError: () => toast({ title: "Erro ao salvar logo", variant: "destructive" }),
  });

  const saveElitLogoMutation = useMutation({
    mutationFn: async (logoUrl: string | null) => {
      const res = await apiRequest("POST", "/api/admin/app-settings", { key: "tintasElitLogoUrl", value: logoUrl ?? "" });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/app-settings/tintasElitLogoUrl"] }); toast({ title: "Logo salva." }); },
    onError: () => toast({ title: "Erro ao salvar logo", variant: "destructive" }),
  });

  const TAB_FLAGS = [
    { key: "showAcompanhamentoTab",    label: 'Aba "Acompanhamento"',              description: "Visão geral de metas semanais e mensais.",                                              defaultVisible: false, setting: settingAcomp  },
    { key: "showDtrAmancoTab",         label: 'Aba "DTR Amanco"',                  description: "Campanha trimestral de faturamento e mix Amanco.",                                      defaultVisible: true,  setting: settingDtr    },
    { key: "showTvAmancoTab",          label: 'Aba "TV Amanco"',                   description: "Campanha Amanco 15/02 a 15/04 — sorteio e crescimento.",                               defaultVisible: true,  setting: settingTv     },
    { key: "showTintasElitTab",        label: 'Aba "Tintas Elit"',                 description: "Campanha semanal de bonificação para produtos Tintas Elit.",                           defaultVisible: true,  setting: settingElit   },
    { key: "showMovimentacoesButton",  label: "Movimentações visíveis ao Supervisor", description: "Permite que o supervisor visualize as movimentações de vendas de cada vendedor.",  defaultVisible: true,  setting: settingMovimt },
  ] as const;

  function isTabVisible(flag: typeof TAB_FLAGS[number]): boolean {
    const val = flag.setting?.value;
    if (val === null || val === undefined) return flag.defaultVisible;
    return val === "true";
  }

  const toggleTabMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/app-settings", { key, value: String(value) });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [`/api/app-settings/${vars.key}`] });
      toast({ title: "Configuração salva." });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configuração", variant: "destructive" });
    },
  });

  const { data: userList = [], isLoading } = useQuery<UserWithPermissions[]>({
    queryKey: ["/api/users"],
  });

  useEffect(() => {
    if (userList.length > 0) {
      const perms: Record<number, Record<string, boolean>> = {};
      for (const u of userList) {
        perms[u.id] = {};
        for (const mod of ALL_MODULES) {
          perms[u.id][mod] = u.modulePermissions ? (u.modulePermissions[mod] !== false) : true;
        }
      }
      setLocalPerms(perms);
    }
  }, [userList]);

  const updatePermMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: number; permissions: Record<string, boolean> }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/permissions`, { modulePermissions: permissions });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      if (currentUser && String(vars.userId) === String(currentUser.id)) {
        refreshUser();
      }
    },
    onError: () => {
      toast({ title: "Erro ao salvar permissão", variant: "destructive" });
    },
  });

  function handleToggle(userId: number, moduleName: string, value: boolean) {
    const newPerms = { ...localPerms[userId], [moduleName]: value };
    setLocalPerms(prev => ({ ...prev, [userId]: newPerms }));
    updatePermMutation.mutate({ userId, permissions: newPerms });
  }

  const filtered = search
    ? userList.filter(u => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ").toLowerCase();
        return name.includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      })
    : userList;

  return (
    <div className="space-y-6">
      {/* ── Feature flags de vendedores ────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold">Funcionalidades dos Vendedores</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Controle quais recursos ficam visíveis para vendedores no portal deles.
        </p>
        <div className="border rounded-lg divide-y divide-border">
          {TAB_FLAGS.map(flag => (
            <div key={flag.key} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{flag.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
              </div>
              <Switch
                checked={isTabVisible(flag)}
                onCheckedChange={val => toggleTabMutation.mutate({ key: flag.key, value: val })}
                disabled={toggleTabMutation.isPending}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Configurações da campanha DTR Amanco ────────────── */}
      <div>
        <h2 className="text-lg font-semibold">Campanha DTR Amanco</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Parâmetros de exibição e renovação automática por trimestre.
        </p>
        <div className="border rounded-lg divide-y divide-border">
          {/* Grace period */}
          <div className="px-4 py-4">
            <p className="text-sm font-medium">Prazo de consulta do trimestre anterior</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              Número de dias após o início de um novo trimestre em que os vendedores podem consultar os resultados do trimestre anterior. Padrão: 5 dias. Use 0 para desativar.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="30"
                className="w-20 h-8 text-sm"
                value={graceDaysInput}
                onChange={e => setGraceDaysInput(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">dias</span>
              <Button
                size="sm"
                onClick={() => {
                  const days = Math.max(0, Math.min(30, parseInt(graceDaysInput) || 0));
                  setGraceDaysInput(String(days));
                  saveGraceMutation.mutate(String(days));
                }}
                disabled={saveGraceMutation.isPending}
              >
                {saveGraceMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span className="ml-1.5">Salvar</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Exemplo: com 5 dias, em 1 de abril os vendedores ainda podem ver os resultados de Janeiro-Março até o dia 5 de abril.
            </p>
          </div>

          {/* Renovação automática — informativo */}
          <div className="flex items-start gap-3 px-4 py-4">
            <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Renovação trimestral automática</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A cada novo trimestre (Jan, Abr, Jul, Out) os dados são exibidos automaticamente para o novo período. Nenhuma ação do administrador é necessária.
              </p>
            </div>
          </div>

          {/* Logo da campanha DTR */}
          <LogoUploadRow
            label="Logo da campanha DTR Amanco"
            description="Exibida no card de identificação da campanha na aba do vendedor."
            currentUrl={settingDtrLogo?.value}
            isPending={saveDtrLogoMutation.isPending}
            onUpload={url => saveDtrLogoMutation.mutate(url)}
            onRemove={() => saveDtrLogoMutation.mutate(null)}
          />
        </div>
      </div>

      {/* ── Campanha TV Amanco ───────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold">Campanha TV Amanco</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Identidade visual da campanha de crescimento e sorteio Amanco.
        </p>
        <div className="border rounded-lg divide-y divide-border">
          <LogoUploadRow
            label="Logo da campanha TV Amanco"
            description="Exibida no card de identificação da campanha na aba do vendedor."
            currentUrl={settingTvLogo?.value}
            isPending={saveTvLogoMutation.isPending}
            onUpload={url => saveTvLogoMutation.mutate(url)}
            onRemove={() => saveTvLogoMutation.mutate(null)}
          />
        </div>
      </div>

      {/* ── Campanha Tintas Elit ─────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold">Campanha Tintas Elit</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Identidade visual da campanha semanal de bonificação Tintas Elit.
        </p>
        <div className="border rounded-lg divide-y divide-border">
          <LogoUploadRow
            label="Logo da campanha Tintas Elit"
            description="Exibida no card de identificação da campanha na aba do vendedor."
            currentUrl={settingElitLogo?.value}
            isPending={saveElitLogoMutation.isPending}
            onUpload={url => saveElitLogoMutation.mutate(url)}
            onRemove={() => saveElitLogoMutation.mutate(null)}
          />
        </div>
      </div>

      {/* ── Permissões por usuário ──────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold">Permissões de Acesso</h2>
        <p className="text-sm text-muted-foreground">
          Controle quais módulos cada usuário pode visualizar no menu de navegação.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar usuário..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const isExpanded = expandedUser === u.id;
            const perms = localPerms[u.id] ?? {};
            const displayName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
            const enabledCount = ALL_MODULES.filter(m => perms[m] !== false).length;

            return (
              <div key={u.id} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {getRoleLabel(u.role)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {enabledCount}/{ALL_MODULES.length} módulos
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="px-4 py-3 border-t bg-background">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ALL_MODULES.map(mod => (
                        <div key={mod} className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-sm">{mod}</span>
                          <Switch
                            checked={perms[mod] !== false}
                            onCheckedChange={val => handleToggle(u.id, mod, val)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
      <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur px-4 sm:px-6 py-3 flex items-baseline gap-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Configurações</h1>
        <span className="hidden sm:inline text-xs text-muted-foreground font-medium">
          Equipes, metas, alertas e campanhas
        </span>
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
            {activeSection === "permissoes" && (
              <PermissoesSection />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
