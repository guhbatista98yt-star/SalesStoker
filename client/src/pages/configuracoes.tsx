import { useState, useEffect, useMemo } from "react";
import { HelpButton, HelpDrawer, HELP_CONTENT } from "@/components/help";
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
  Bell,
  Tv,
  Eye,
  EyeOff,
  Sparkles,
  Key,
  Bot,
  AlertCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { GoalSwitch } from "@/components/goal-switch";
import { PurchaseAlertPreferences } from "@/components/purchase-alert-preferences";
import { PurchaseAlertAdminSettings } from "@/components/purchase-alert-admin-settings";

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
  { id: "alertas-compras", label: "Alertas de Compras", icon: Bell },
  { id: "tv", label: "Configuração de TV", icon: Tv },
  { id: "ia", label: "Inteligência Artificial", icon: Sparkles },
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
// SECTION: IA
// ═══════════════════════════════════════════════════════════════════════════════

interface AIProvider {
  id: string;
  label: string;
  models: { id: string; label: string }[];
}

interface AIConfig {
  provider: string;
  model: string;
  hasKey: boolean;
  providers: AIProvider[];
}

function AISection() {
  const { toast } = useToast();
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const { data: cfg, isLoading } = useQuery<AIConfig>({
    queryKey: ["/api/campaigns-ai/config"],
  });

  useEffect(() => {
    if (cfg && !provider) {
      setProvider(cfg.provider);
      setModel(cfg.model);
    }
  }, [cfg]);

  const currentProviders = cfg?.providers ?? [];
  const currentProvider = currentProviders.find(p => p.id === provider);
  const availableModels = currentProvider?.models ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/campaigns-ai/config", { provider, model, apiKey: apiKey || undefined });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns-ai/config"] });
      setApiKey("");
      toast({ title: "Configuração de IA salva!" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/campaigns-ai/chat", {
        messages: [{ role: "user", content: "Olá, responda apenas 'OK' para confirmar que está funcionando." }],
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: (d) => {
      setTestResult("ok");
      setTestMsg(d.message?.slice(0, 80) || "IA respondeu com sucesso!");
    },
    onError: (e: any) => {
      setTestResult("error");
      setTestMsg(e.message);
    },
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-600" />
          Inteligência Artificial
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure o provedor e a chave de API usado pelo assistente de criação de campanhas.
        </p>
      </div>

      {/* Status badge */}
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg border text-sm",
        cfg?.hasKey
          ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
          : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800"
      )}>
        {cfg?.hasKey
          ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          : <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
        }
        <span className={cfg?.hasKey ? "text-green-700 dark:text-green-300" : "text-yellow-700 dark:text-yellow-300"}>
          {cfg?.hasKey ? "Chave API configurada e ativa." : "Nenhuma chave API configurada. O assistente de IA não funcionará."}
        </span>
      </div>

      {/* Provider */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Bot className="h-4 w-4" /> Provedor de IA
        </label>
        <select
          className="w-full h-9 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          value={provider}
          onChange={e => {
            setProvider(e.target.value);
            const first = currentProviders.find(p => p.id === e.target.value)?.models[0]?.id ?? "";
            setModel(first);
            setTestResult("idle");
          }}
        >
          {currentProviders.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {provider === "gemini" && (
          <p className="text-xs text-muted-foreground">
            Obtenha sua chave gratuita em{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">aistudio.google.com/app/apikey</a>
            {" "}— sem cartão de crédito, até 1.500 req/dia grátis.
          </p>
        )}
        {provider === "openai" && (
          <p className="text-xs text-muted-foreground">
            Obtenha sua chave em{" "}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com/api-keys</a>
            {" "}— requer conta com créditos.
          </p>
        )}
        {provider === "claude" && (
          <p className="text-xs text-muted-foreground">
            Obtenha sua chave em{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.anthropic.com</a>
            {" "}— requer conta com créditos (sem plano gratuito).
          </p>
        )}
        {provider === "groq" && (
          <p className="text-xs text-muted-foreground">
            Obtenha sua chave gratuita em{" "}
            <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.groq.com/keys</a>
            {" "}— sem cartão de crédito, modelos open-source ultra-rápidos.
          </p>
        )}
        {provider === "mistral" && (
          <p className="text-xs text-muted-foreground">
            Obtenha sua chave em{" "}
            <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.mistral.ai</a>
            {" "}— plano gratuito disponível (La Plateforme).
          </p>
        )}
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Modelo</label>
        <select
          className="w-full h-9 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          value={model}
          onChange={e => setModel(e.target.value)}
        >
          {availableModels.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Key className="h-4 w-4" /> Chave API
        </label>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            className="w-full h-9 px-3 pr-10 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            placeholder={cfg?.hasKey ? "••••••••••••••••••• (deixe em branco para manter atual)" : "Cole sua chave API aqui"}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
          <button
            type="button"
            className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowKey(v => !v)}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">A chave é armazenada de forma segura no banco de dados.</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !provider || !model}
          className="gap-1.5"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configuração
        </Button>

        <Button
          variant="outline"
          onClick={() => { setTestResult("idle"); testMutation.mutate(); }}
          disabled={testMutation.isPending || !cfg?.hasKey}
          className="gap-1.5"
        >
          {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Testar conexão
        </Button>
      </div>

      {/* Test result */}
      {testResult !== "idle" && (
        <div className={cn(
          "p-3 rounded-lg text-sm border flex items-start gap-2",
          testResult === "ok"
            ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/20 dark:border-green-800 dark:text-green-300"
            : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800 dark:text-red-300"
        )}>
          {testResult === "ok"
            ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          }
          <span>{testResult === "ok" ? `✓ Funcionando: "${testMsg}"` : `✗ Erro: ${testMsg}`}</span>
        </div>
      )}

      {/* Info box */}
      <div className="p-4 rounded-lg bg-muted/40 border space-y-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Como funciona o assistente de IA</p>
        <p>Ao criar uma nova campanha, um painel lateral aparece onde você descreve a campanha em linguagem natural. A IA interpreta, faz perguntas se necessário, e preenche automaticamente todos os campos do formulário.</p>
        <p className="text-xs">A IA <strong>nunca salva automaticamente</strong> — você sempre revisa e confirma antes de salvar.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: TV
// ═══════════════════════════════════════════════════════════════════════════════

interface TVVendorSetting {
  vendorId: string;
  displayName: string;
  displayCode: string;
  showOnTv: boolean;
}

function TVSection() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: vendors = [], isLoading } = useQuery<TVVendorSetting[]>({
    queryKey: ["/api/admin/vendor-tv-visibility"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ vendorId, showOnTv }: { vendorId: string; showOnTv: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/vendor-tv-visibility/${vendorId}`, { showOnTv });
      if (!res.ok) throw new Error("Erro ao salvar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vendor-tv-visibility"] });
    },
    onError: () => toast({ title: "Erro ao atualizar configuração de TV", variant: "destructive" }),
  });

  const filtered = vendors.filter(v =>
    !search || v.displayName.toLowerCase().includes(search.toLowerCase()) || v.displayCode.toLowerCase().includes(search.toLowerCase())
  );

  const visibleCount = vendors.filter(v => v.showOnTv).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Tv className="h-5 w-5 text-primary" />
          Configuração do Display de TV
        </h2>
        <p className="text-sm text-muted-foreground">
          Selecione quais vendedores aparecem no painel de TV da loja. Vendedores ocultados aqui não aparecem no display, mas continuam no sistema.
        </p>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border text-sm">
        <Tv className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-muted-foreground">
          {visibleCount} de {vendors.length} vendedores visíveis no TV
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-8 pl-8 pr-3 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Buscar vendedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => {
            vendors.forEach(v => {
              if (!v.showOnTv) toggleMutation.mutate({ vendorId: v.vendorId, showOnTv: true });
            });
          }}
        >
          <Eye className="h-3.5 w-3.5" /> Mostrar todos
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => {
            vendors.forEach(v => {
              if (v.showOnTv) toggleMutation.mutate({ vendorId: v.vendorId, showOnTv: false });
            });
          }}
        >
          <EyeOff className="h-3.5 w-3.5" /> Ocultar todos
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {vendors.length === 0 ? "Nenhum vendedor encontrado no sistema." : "Nenhum vendedor encontrado para a busca."}
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {filtered.map(v => (
            <div key={v.vendorId} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${v.showOnTv ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>
                  {v.displayCode.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className={`text-sm font-medium ${!v.showOnTv ? "text-muted-foreground line-through" : ""}`}>
                    {v.displayName}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">{v.displayCode} · ID {v.vendorId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {v.showOnTv ? (
                  <span className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Visível no TV
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <EyeOff className="h-3 w-3" /> Oculto
                  </span>
                )}
                <Switch
                  checked={v.showOnTv}
                  onCheckedChange={checked => toggleMutation.mutate({ vendorId: v.vendorId, showOnTv: checked })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Equipes
// ═══════════════════════════════════════════════════════════════════════════════

function EquipesSection({ salespeople }: { salespeople: Salesperson[] }) {
  const { toast } = useToast();
  const normalizeMemberId = (value: unknown) => String(value ?? "").trim();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: groups = [], isLoading } = useQuery<VendorGroup[]>({
    queryKey: ["/api/admin/vendor-groups"],
  });

  const normalizedGroups = useMemo<VendorGroup[]>(() => groups.map(group => ({
    ...group,
    id: String(group.id),
    name: String(group.name ?? "").trim(),
    members: Array.from(new Set((group.members ?? []).map(normalizeMemberId).filter(Boolean))),
  })), [groups]);

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

  const selectedGroup = normalizedGroups.find(g => g.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedGroup) {
      setGroupName(selectedGroup.name);
      setMembers(selectedGroup.members);
      setIsCreating(false);
    }
  }, [selectedId, normalizedGroups]);

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
    const normalizedMembers = Array.from(new Set(members.map(normalizeMemberId).filter(Boolean)));
    saveMutation.mutate({ id, name: groupName.trim(), members: normalizedMembers });
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
            <span className="text-sm font-medium">Equipes ({normalizedGroups.length})</span>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={startNew}>
              <Plus className="h-3.5 w-3.5" /> Nova
            </Button>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : normalizedGroups.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground px-4">
                Nenhuma equipe criada ainda. Clique em "Nova" para começar.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {normalizedGroups.map(g => (
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
                    const salespersonId = normalizeMemberId(sp.id);
                    const checked = members.some(id => normalizeMemberId(id) === salespersonId);
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
                              val
                                ? Array.from(new Set([...prev.map(normalizeMemberId), salespersonId].filter(Boolean)))
                                : prev.filter(id => normalizeMemberId(id) !== salespersonId)
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

  const { data: settingMovimt } = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showMovimentacoesButton"], staleTime: 0 });
  const { data: settingSupervisorBell } = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/supervisorPurchaseNotifications"], staleTime: 0 });

  const TAB_FLAGS = [
    { key: "showMovimentacoesButton", label: "Movimentações visíveis ao Supervisor", description: "Permite que o supervisor visualize as movimentações de vendas de cada vendedor.", defaultVisible: true, setting: settingMovimt },
    { key: "supervisorPurchaseNotifications", label: "Notificações de Compras para Supervisor", description: "Exibe o sino de alertas de compras no topo da tela para usuários com perfil Supervisor.", defaultVisible: false, setting: settingSupervisorBell },
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
      {/* ── Feature flags gerais ────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold">Configurações Gerais</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Controle de funcionalidades e permissões do sistema.
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
  const [helpOpen, setHelpOpen] = useState(false);
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
          const id = String(sp.id ?? "").trim();
          return [id, { id, name: String(sp.name ?? "").trim() }];
        })
      ).values()
    ).filter(sp => sp.id).sort((a, b) => a.name.localeCompare(b.name));
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
        <HelpButton onClick={() => setHelpOpen(true)} />
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
            {activeSection === "alertas-compras" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Alertas de Compras</h2>
                  <p className="text-sm text-muted-foreground">
                    Configure suas notificações de compras e os parâmetros globais do sistema.
                  </p>
                </div>
                <PurchaseAlertPreferences />
                <PurchaseAlertAdminSettings />
              </div>
            )}
            {activeSection === "tv" && (
              <TVSection />
            )}
            {activeSection === "ia" && (
              <AISection />
            )}
          </div>
        </main>
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.configuracoes} />
    </div>
  );
}
