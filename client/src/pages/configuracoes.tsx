import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Save, Loader2, Calendar, CalendarDays } from "lucide-react";
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

interface LocalGoalValues {
  [salespersonId: string]: {
    weekly: {
      mode: "unified" | "split";
      all: string; // Using string to allow empty state logic
      l01: string;
      l03: string;
    };
    monthly: {
      mode: "unified" | "split";
      all: string;
      l01: string;
      l03: string;
    };
  };
}

export default function Configuracoes() {
  const { user } = useAuth();
  const isAdmin = user?.email === "admin@conectubos.com";
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const { toast } = useToast();
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    salespersonId: string;
    type: "weekly" | "monthly";
    targetMode: "unified" | "split";
  } | null>(null);

  // Local State
  const [localValues, setLocalValues] = useState<LocalGoalValues>({});

  const { data: serverConfig = [], isLoading } = useQuery<GoalConfigItem[]>({
    queryKey: ["/api/goals-config", currentMonth.toString(), currentYear.toString()],
  });

  const { data: salespersons = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/salespersons", "all", "2026-01-01", "2026-01-31"], // Date range just to fetch list
    select: (data: any) => data.map((d: any) => d.salesperson || d),
  });

  // Sync server state to local state
  useEffect(() => {
    // Prevent resetting state if already initialized and user is editing
    if (Object.keys(localValues).length > 0) return;

    if (salespersons.length > 0) {
      const initialValues: LocalGoalValues = {};

      salespersons.forEach(sp => {
        const cfg = serverConfig.find(c => c.salespersonId === sp.id);

        // Helper to get value or empty string
        const getVal = (goals: any[] | undefined, cid: string) => {
          if (!goals) return "";
          const g = goals.find((x: any) => x.companyId === cid);
          return g ? String(g.value) : "";
        };

        const weeklyGoals = cfg?.goals.filter(g => g.type === "weekly");
        const monthlyGoals = cfg?.goals.filter(g => g.type === "monthly");

        initialValues[sp.id] = {
          weekly: {
            mode: cfg?.weeklyMode || "split",
            all: getVal(weeklyGoals, "all"),
            l01: getVal(weeklyGoals, "1"),
            l03: getVal(weeklyGoals, "3"),
          },
          monthly: {
            mode: cfg?.monthlyMode || "split",
            all: getVal(monthlyGoals, "all"),
            l01: getVal(monthlyGoals, "1"),
            l03: getVal(monthlyGoals, "3"),
          }
        };
      });
      setLocalValues(initialValues);
    }
  }, [serverConfig, salespersons]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      salespersonId: string;
      type: "weekly" | "monthly";
      mode: "unified" | "split";
      values: { all: number | null; "1": number | null; "3": number | null }
    }) => {
      return apiRequest("POST", "/api/goals-config", {
        ...payload,
        month: currentMonth,
        year: currentYear
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals-config"] });
      toast({ title: "Meta salva com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  });

  const handleInputChange = (salespersonId: string, type: "weekly" | "monthly", field: "all" | "l01" | "l03", value: string) => {
    if (!isAdmin) return;
    setLocalValues(prev => ({
      ...prev,
      [salespersonId]: {
        ...prev[salespersonId],
        [type]: {
          ...prev[salespersonId]?.[type],
          [field]: value
        }
      }
    }));
  };

  const handleSwitchToggle = (salespersonId: string, type: "weekly" | "monthly", checked: boolean) => {
    if (!isAdmin) return;

    // Ask Confirmation for both directions (switching always implies some data reset/change)
    setConfirmDialog({
      open: true,
      salespersonId,
      type,
      targetMode: checked ? "unified" : "split"
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
          all: targetMode === "unified" ? "0" : "", // If going Unified, init all=0. If Split, init all defaults empty
          l01: targetMode === "split" ? "" : "", // Init empty for fresh start
          l03: targetMode === "split" ? "" : "",
        }
      }
    }));
    setConfirmDialog(null);
  };

  const handleSave = (salespersonId: string, type: "weekly" | "monthly") => {
    const current = localValues[salespersonId]?.[type];
    if (!current) return;

    const parseVal = (v: string) => (v === "" ? null : parseFloat(v.replace(",", ".")));

    saveMutation.mutate({
      salespersonId,
      type,
      mode: current.mode,
      values: {
        all: parseVal(current.all),
        "1": parseVal(current.l01),
        "3": parseVal(current.l03)
      }
    });
  };

  const handleSaveAll = (type: "weekly" | "monthly") => {
    salespersons.forEach(sp => handleSave(sp.id, type));
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // Helper to find saved value from serverConfig
  const getSavedValue = (spId: string, type: "weekly" | "monthly", companyId: string) => {
    const cfg = serverConfig.find(c => c.salespersonId === spId);
    if (!cfg) return "R$ 0,00"; // Should not happen if initialized
    const goals = cfg.goals.filter(g => g.type === type && g.companyId === companyId);
    if (goals.length > 0) return `${formatCurrency(goals[0].value)}`;
    return "Sem meta salva";
  };

  const renderGoalRow = (sp: { id: string; name: string }, type: "weekly" | "monthly") => {
    const config = localValues[sp.id]?.[type];
    if (!config) return null;

    const isUnified = config.mode === "unified";

    // Debugging name issue
    console.log("Rendering row for:", sp);

    return (
      <div key={sp.id} className="flex flex-col gap-4 p-4 bg-muted/50 rounded-lg border">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-[200px]">
            <p className="font-semibold text-base">{sp.name || "Nome desconhecido"}</p>
            <p className="text-xs text-muted-foreground">ID: {sp.id ? sp.id.toString().slice(0, 8) : "N/A"}...</p>
          </div>

          <div className="flex flex-col gap-4 flex-1">
            <GoalSwitch
              mode={config.mode}
              onToggle={(c) => sp.id && handleSwitchToggle(sp.id, type, c)}
              disabled={!isAdmin || (sp.id === "undefined" || !sp.id)}
            />

            <div className="flex flex-wrap gap-4 items-end">
              {isUnified ? (
                <div className="w-full sm:w-auto">
                  <Label className="text-xs mb-1.5 block">Meta Individual</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
                    <Input
                      disabled={!isAdmin}
                      type="number"
                      min="0"
                      step="1"
                      className="pl-8 w-40"
                      value={config.all}
                      onChange={(e) => handleInputChange(sp.id, type, "all", e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Salvo: {getSavedValue(sp.id, type, "all")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-full sm:w-auto">
                    <Label className="text-xs mb-1.5 block">Varejo (01)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
                      <Input
                        disabled={!isAdmin}
                        type="number"
                        min="0"
                        step="1"
                        className="pl-8 w-40"
                        value={config.l01}
                        onChange={(e) => handleInputChange(sp.id, type, "l01", e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Salvo: {getSavedValue(sp.id, type, "1")}
                    </p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <Label className="text-xs mb-1.5 block">Atacado (03)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">R$</span>
                      <Input
                        disabled={!isAdmin}
                        type="number"
                        min="0"
                        step="1"
                        className="pl-8 w-40"
                        value={config.l03}
                        onChange={(e) => handleInputChange(sp.id, type, "l03", e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Salvo: {getSavedValue(sp.id, type, "3")}
                    </p>
                  </div>
                </>
              )}
            </div>
            {!isAdmin && (
              <p className="text-xs text-amber-600 mt-1">Apenas o administrador pode editar metas.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações de Metas</h1>
        <p className="text-sm text-muted-foreground">Definição de metas por vendedor ({monthNames[currentMonth - 1]} {currentYear})</p>
      </div>

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Metas de Vendedores
            </CardTitle>
            <CardDescription>
              Configure o modo de meta (Geral ou Por Empresa) e os valores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
              <TabsList className="mb-6 w-full justify-start border-b rounded-none bg-transparent h-auto p-0">
                <TabsTrigger
                  value="weekly"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Metas Semanais
                </TabsTrigger>
                <TabsTrigger
                  value="monthly"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Metas Mensais
                </TabsTrigger>
              </TabsList>

              <TabsContent value="weekly" className="space-y-4">
                {isLoading ? <Loader2 className="animate-spin" /> : salespersons.map(sp => renderGoalRow(sp, "weekly"))}
              </TabsContent>
              <TabsContent value="monthly" className="space-y-4">
                {isLoading ? <Loader2 className="animate-spin" /> : salespersons.map(sp => renderGoalRow(sp, "monthly"))}
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-4 sticky bottom-0 bg-background">
            {isAdmin && (
              <Button onClick={() => handleSaveAll(activeTab)} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Metas {activeTab === "weekly" ? "Semanais" : "Mensais"}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.targetMode === "unified"
                ? "Alterar para Meta Individual?"
                : "Alterar para Metas Separadas?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.targetMode === "unified"
                ? "Ao ativar a Meta Individual, as metas separadas de Varejo e Atacado serão perdidas."
                : "Ao alterar para Metas Separadas, o valor da Meta Individual será perdido."}
              <br />Deseja continuar?
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
