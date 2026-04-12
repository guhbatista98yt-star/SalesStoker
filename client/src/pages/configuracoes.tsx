import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Save,
  Loader2,
  Calendar,
  CalendarDays,
  Search,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/calendar-utils";
import { useAuth } from "@/lib/auth-context";
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
import { GoalSwitch } from "@/components/goal-switch";

interface GoalConfigItem {
  salespersonId: string;
  weeklyMode: "unified" | "split";
  monthlyMode: "unified" | "split";
  goals: Array<{
    type: "weekly" | "monthly";
    companyId: string;
    value: number;
  }>;
}

interface RowGoalState {
  mode: "unified" | "split";
  all: string;
  l01: string;
  l03: string;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
}

interface LocalGoalValues {
  [salespersonId: string]: {
    weekly: RowGoalState;
    monthly: RowGoalState;
  };
}

const DEFAULT_ROW_STATE: RowGoalState = {
  mode: "split",
  all: "",
  l01: "",
  l03: "",
  dirty: false,
  saving: false,
  saved: false,
};

function buildInitialValues(
  salespersons: { id: string; name: string }[],
  serverConfig: GoalConfigItem[]
): LocalGoalValues {
  const values: LocalGoalValues = {};

  const getVal = (goals: GoalConfigItem["goals"] | undefined, type: "weekly" | "monthly", cid: string) => {
    if (!goals) return "";
    const g = goals.find(x => x.type === type && x.companyId === cid);
    return g ? String(g.value) : "";
  };

  for (const sp of salespersons) {
    const cfg = serverConfig.find(c => c.salespersonId === sp.id);
    values[sp.id] = {
      weekly: {
        mode: cfg?.weeklyMode ?? "split",
        all: getVal(cfg?.goals, "weekly", "all"),
        l01: getVal(cfg?.goals, "weekly", "1"),
        l03: getVal(cfg?.goals, "weekly", "3"),
        dirty: false,
        saving: false,
        saved: false,
      },
      monthly: {
        mode: cfg?.monthlyMode ?? "split",
        all: getVal(cfg?.goals, "monthly", "all"),
        l01: getVal(cfg?.goals, "monthly", "1"),
        l03: getVal(cfg?.goals, "monthly", "3"),
        dirty: false,
        saving: false,
        saved: false,
      },
    };
  }

  return values;
}

export default function Configuracoes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    salespersonId: string;
    type: "weekly" | "monthly";
    targetMode: "unified" | "split";
  } | null>(null);

  const [localValues, setLocalValues] = useState<LocalGoalValues>({});
  const [initialized, setInitialized] = useState(false);

  const { data: serverConfig = [], isLoading: configLoading } = useQuery<GoalConfigItem[]>({
    queryKey: ["/api/goals-config", currentMonth.toString(), currentYear.toString()],
  });

  const { data: salespersonsRaw = [], isLoading: spLoading } = useQuery<any[]>({
    queryKey: [`/api/salespersons/all/${currentYear}-${String(currentMonth).padStart(2, "0")}-01/${currentYear}-${String(currentMonth).padStart(2, "0")}-28`],
  });

  const salespersons = useMemo<{ id: string; name: string }[]>(() => {
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

  useEffect(() => {
    if (!initialized && salespersons.length > 0 && serverConfig !== undefined) {
      setLocalValues(buildInitialValues(salespersons, serverConfig));
      setInitialized(true);
    }
  }, [salespersons, serverConfig, initialized]);

  const isLoading = configLoading || spLoading;

  const filteredSalespersons = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return salespersons;
    return salespersons.filter(sp => sp.name.toLowerCase().includes(term));
  }, [salespersons, search]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      salespersonId: string;
      type: "weekly" | "monthly";
      mode: "unified" | "split";
      values: { all: number | null; "1": number | null; "3": number | null };
    }) => {
      return apiRequest("POST", "/api/goals-config", {
        ...payload,
        month: currentMonth,
        year: currentYear,
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals-config"] });
      setLocalValues(prev => ({
        ...prev,
        [vars.salespersonId]: {
          ...prev[vars.salespersonId],
          [vars.type]: {
            ...prev[vars.salespersonId][vars.type],
            dirty: false,
            saving: false,
            saved: true,
          },
        },
      }));
      setTimeout(() => {
        setLocalValues(prev => ({
          ...prev,
          [vars.salespersonId]: {
            ...prev[vars.salespersonId],
            [vars.type]: {
              ...prev[vars.salespersonId]?.[vars.type],
              saved: false,
            },
          },
        }));
      }, 2500);
    },
    onError: (_, vars) => {
      setLocalValues(prev => ({
        ...prev,
        [vars.salespersonId]: {
          ...prev[vars.salespersonId],
          [vars.type]: {
            ...prev[vars.salespersonId][vars.type],
            saving: false,
          },
        },
      }));
      toast({ title: "Erro ao salvar meta", variant: "destructive" });
    },
  });

  const handleInputChange = (
    salespersonId: string,
    type: "weekly" | "monthly",
    field: "all" | "l01" | "l03",
    value: string
  ) => {
    if (!isAdmin) return;
    setLocalValues(prev => ({
      ...prev,
      [salespersonId]: {
        ...prev[salespersonId],
        [type]: {
          ...prev[salespersonId]?.[type],
          [field]: value,
          dirty: true,
          saved: false,
        },
      },
    }));
  };

  const handleSwitchToggle = (
    salespersonId: string,
    type: "weekly" | "monthly",
    checked: boolean
  ) => {
    if (!isAdmin) return;
    setConfirmDialog({
      open: true,
      salespersonId,
      type,
      targetMode: checked ? "unified" : "split",
    });
  };

  const handleConfirmSwitch = () => {
    if (!confirmDialog) return;
    const { salespersonId, type, targetMode } = confirmDialog;
    setLocalValues(prev => ({
      ...prev,
      [salespersonId]: {
        ...prev[salespersonId],
        [type]: {
          mode: targetMode,
          all: "",
          l01: "",
          l03: "",
          dirty: true,
          saving: false,
          saved: false,
        },
      },
    }));
    setConfirmDialog(null);
  };

  const parseVal = (v: string) => (v === "" ? null : parseFloat(v.replace(",", ".")));

  const handleSave = (salespersonId: string, type: "weekly" | "monthly") => {
    const current = localValues[salespersonId]?.[type];
    if (!current || !current.dirty) return;
    setLocalValues(prev => ({
      ...prev,
      [salespersonId]: {
        ...prev[salespersonId],
        [type]: { ...prev[salespersonId][type], saving: true },
      },
    }));
    saveMutation.mutate({
      salespersonId,
      type,
      mode: current.mode,
      values: {
        all: parseVal(current.all),
        "1": parseVal(current.l01),
        "3": parseVal(current.l03),
      },
    });
  };

  const handleSaveAll = (type: "weekly" | "monthly") => {
    const dirty = salespersons.filter(sp => localValues[sp.id]?.[type]?.dirty);
    if (!dirty.length) {
      toast({ title: "Nenhuma alteração pendente" });
      return;
    }
    dirty.forEach(sp => handleSave(sp.id, type));
    toast({ title: `Salvando ${dirty.length} metas...` });
  };

  const getSavedLabel = (spId: string, type: "weekly" | "monthly", companyId: string) => {
    const cfg = serverConfig.find(c => c.salespersonId === spId);
    if (!cfg) return "—";
    const g = cfg.goals.find(g => g.type === type && g.companyId === companyId);
    return g ? formatCurrency(g.value) : "Sem meta";
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const dirtyCount = (type: "weekly" | "monthly") =>
    salespersons.filter(sp => localValues[sp.id]?.[type]?.dirty).length;

  const renderGoalRow = (sp: { id: string; name: string }, type: "weekly" | "monthly") => {
    const config = localValues[sp.id]?.[type];
    if (!config) return null;
    const isUnified = config.mode === "unified";

    return (
      <div
        key={sp.id}
        className={`flex flex-col gap-3 p-4 rounded-lg border transition-colors ${
          config.dirty ? "border-primary/40 bg-primary/5" : "bg-muted/30"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-[180px]">
            <p className="font-semibold text-sm">{sp.name}</p>
            <p className="text-xs text-muted-foreground font-mono">ID: {sp.id}</p>
          </div>

          <div className="flex flex-col gap-3 flex-1">
            <GoalSwitch
              mode={config.mode}
              onToggle={(c) => handleSwitchToggle(sp.id, type, c)}
              disabled={!isAdmin}
            />

            <div className="flex flex-wrap gap-3 items-end">
              {isUnified ? (
                <div>
                  <Label className="text-xs mb-1 block text-muted-foreground">Meta Individual</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">R$</span>
                    <Input
                      disabled={!isAdmin}
                      type="number"
                      min="0"
                      step="1"
                      className="pl-8 w-36 text-sm"
                      value={config.all}
                      onChange={e => handleInputChange(sp.id, type, "all", e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Salvo: {getSavedLabel(sp.id, type, "all")}
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs mb-1 block text-muted-foreground">Varejo (L01)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">R$</span>
                      <Input
                        disabled={!isAdmin}
                        type="number"
                        min="0"
                        step="1"
                        className="pl-8 w-36 text-sm"
                        value={config.l01}
                        onChange={e => handleInputChange(sp.id, type, "l01", e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Salvo: {getSavedLabel(sp.id, type, "1")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block text-muted-foreground">Atacado (L03)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">R$</span>
                      <Input
                        disabled={!isAdmin}
                        type="number"
                        min="0"
                        step="1"
                        className="pl-8 w-36 text-sm"
                        value={config.l03}
                        onChange={e => handleInputChange(sp.id, type, "l03", e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Salvo: {getSavedLabel(sp.id, type, "3")}
                    </p>
                  </div>
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
                <Button
                  size="sm"
                  variant={config.dirty ? "default" : "outline"}
                  disabled={!config.dirty || config.saving}
                  onClick={() => handleSave(sp.id, type)}
                  className="gap-1 text-xs h-8"
                >
                  {config.saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
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
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Configurações de Metas</h1>
            <p className="text-sm text-muted-foreground">
              Definição de metas por vendedor — {monthNames[currentMonth - 1]} {currentYear}
            </p>
          </div>
          {!isAdmin && (
            <Badge variant="secondary" className="gap-1 self-start">
              <Lock className="h-3 w-3" /> Somente leitura
            </Badge>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Metas de Vendedores
                </CardTitle>
                <CardDescription>
                  Configure o modo (Geral ou Por Empresa) e os valores de meta para cada vendedor.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar vendedor..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={v => setActiveTab(v as "weekly" | "monthly")}
              className="w-full"
            >
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <TabsList className="h-auto bg-transparent p-0 border-b w-full sm:w-auto rounded-none">
                  <TabsTrigger
                    value="weekly"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Semanais
                    {dirtyCount("weekly") > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">{dirtyCount("weekly")}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="monthly"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Mensais
                    {dirtyCount("monthly") > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">{dirtyCount("monthly")}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveAll(activeTab)}
                    disabled={dirtyCount(activeTab) === 0 || saveMutation.isPending}
                    className="gap-1 text-xs"
                  >
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
                    {filteredSalespersons.length === 0 ? (
                      <p className="text-center text-muted-foreground py-12 text-sm">
                        Nenhum vendedor encontrado.
                      </p>
                    ) : (
                      filteredSalespersons.map(sp => renderGoalRow(sp, "weekly"))
                    )}
                  </TabsContent>
                  <TabsContent value="monthly" className="space-y-3 mt-0">
                    {filteredSalespersons.length === 0 ? (
                      <p className="text-center text-muted-foreground py-12 text-sm">
                        Nenhum vendedor encontrado.
                      </p>
                    ) : (
                      filteredSalespersons.map(sp => renderGoalRow(sp, "monthly"))
                    )}
                  </TabsContent>
                </>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirmDialog} onOpenChange={open => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.targetMode === "unified"
                ? "Alterar para Meta Individual?"
                : "Alterar para Metas Separadas?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.targetMode === "unified"
                ? "Ao ativar a Meta Individual, as metas separadas por loja serão descartadas ao salvar."
                : "Ao alterar para Metas Separadas, o valor da Meta Individual será descartado ao salvar."}
              {" "}Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSwitch}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
