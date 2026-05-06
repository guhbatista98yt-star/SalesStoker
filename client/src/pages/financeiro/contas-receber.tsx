import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign, AlertTriangle, Clock, TrendingUp, Users, FileText,
  Search, Filter, Download, RefreshCw, ChevronRight, ChevronLeft,
  ChevronDown, MoreVertical, Eye, Phone, MessageSquare, Calendar,
  Printer, Building2, MapPin, User, List, ArrowUpDown,
  CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Auth helper ────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { ...authHeaders(), ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Erro desconhecido");
  }
  return res.json();
}

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
  }).format(Number(v));
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("pt-BR");
}

function fmtDatetime(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  VENCIDO:    { label: "Vencido",     color: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-950/40",    border: "border-red-200 dark:border-red-900" },
  VENCE_HOJE: { label: "Vence hoje",  color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-900" },
  A_VENCER:   { label: "A vencer",    color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",   border: "border-blue-200 dark:border-blue-900" },
  RECEBIDO:   { label: "Recebido",    color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-900" },
};

const RISCO_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICO:  { label: "Crítico",  color: "text-red-600 dark:text-red-400" },
  ATRASADO: { label: "Atrasado", color: "text-amber-600 dark:text-amber-400" },
  ATENCAO:  { label: "Atenção",  color: "text-yellow-600 dark:text-yellow-400" },
  EM_DIA:   { label: "Em dia",   color: "text-emerald-600 dark:text-emerald-400" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" };
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border",
      cfg.color, cfg.bg, cfg.border
    )}>
      {cfg.label}
    </span>
  );
}

function RiscoBadge({ risco }: { risco: string }) {
  const cfg = RISCO_CONFIG[risco] ?? { label: risco, color: "text-muted-foreground" };
  return <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>;
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({
  title, value, subtitle, icon: Icon, iconBg, loading, alert,
}: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; iconBg: string; loading?: boolean; alert?: boolean;
}) {
  return (
    <Card className={cn("relative overflow-hidden", alert && "ring-2 ring-red-500/20")}>
      <CardContent className="p-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground leading-tight mb-1">{title}</p>
              <p className="text-xl font-bold tabular-nums leading-tight truncate">{value}</p>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className={cn("p-2 rounded-xl shrink-0", iconBg)}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Resumo hook ────────────────────────────────────────────────────────────

function useResumo() {
  return useQuery({
    queryKey: ["/api/financeiro/contas-receber/resumo"],
    queryFn: () => apiFetch("/api/financeiro/contas-receber/resumo"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// ── Filters ────────────────────────────────────────────────────────────────

interface Filters {
  status: string;
  empresa: string;
  busca: string;
  venc_de: string;
  venc_ate: string;
  uf: string;
  forma_recebimento: string;
  somente_vencidos: string;
}

const DEFAULT_FILTERS: Filters = {
  status: "todos",
  empresa: "all",
  busca: "",
  venc_de: "",
  venc_ate: "",
  uf: "",
  forma_recebimento: "",
  somente_vencidos: "0",
};

function buildQS(filters: Filters, extra: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  Object.entries({ ...filters, ...extra }).forEach(([k, v]) => {
    if (v != null && v !== "" && v !== "todos" && v !== "all") qs.set(k, String(v));
  });
  return qs.toString() ? `?${qs.toString()}` : "";
}


// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ContasReceber() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"clientes" | "duplicatas" | "vendedores" | "fila">("clientes");
  const [delinquencyDays, setDelinquencyDays] = useState<number>(10);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [buscaInput, setBuscaInput] = useState("");
  const [clientePage, setClientePage] = useState(1);
  const [duplicataPage, setDuplicataPage] = useState(1);
  const [clienteDetalhe, setClienteDetalhe] = useState<number | null>(null);
  const [vendedorDetalhe, setVendedorDetalhe] = useState<number | null>(null);
  const [showFiltros, setShowFiltros] = useState(false);
  const [showCobrancaDialog, setShowCobrancaDialog] = useState<{
    chave: string; idclifor: number; idtitulo: number; digitotitulo?: string; serienota?: string; idempresa?: number; cliente?: string;
  } | null>(null);
  const [sortClientes, setSortClientes] = useState<{ sort: string; dir: string }>({ sort: "total_vencido", dir: "desc" });
  const [sortDuplicatas, setSortDuplicatas] = useState<{ sort: string; dir: string }>({ sort: "dtvencimento", dir: "asc" });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters(f => ({ ...f, busca: buscaInput }));
      setClientePage(1);
      setDuplicataPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [buscaInput]);

  const setFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters(f => ({ ...f, [key]: value }));
    setClientePage(1);
    setDuplicataPage(1);
  }, []);

  // ── Queries ────────────────────────────────────────────────────────────

  const resumo = useResumo();

  const clientesQS = buildQS(filters, { page: clientePage, limit: 50, ...sortClientes });
  const clientesQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/clientes", clientesQS],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/clientes${clientesQS}`),
    staleTime: 30_000,
  });

  const dupsQS = buildQS(filters, { page: duplicataPage, limit: 100, ...sortDuplicatas });
  const dupsQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/duplicatas", dupsQS],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/duplicatas${dupsQS}`),
    enabled: tab === "duplicatas",
    staleTime: 30_000,
  });

  const vendedoresQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/vendedores"],
    queryFn: () => apiFetch("/api/financeiro/contas-receber/vendedores"),
    enabled: tab === "vendedores",
    staleTime: 30_000,
  });

  const filaQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/fila-cobranca"],
    queryFn: () => apiFetch("/api/financeiro/contas-receber/fila-cobranca"),
    enabled: tab === "fila",
    staleTime: 30_000,
  });

  const clienteDetalheQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/cliente", clienteDetalhe],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/cliente/${clienteDetalhe}`),
    enabled: clienteDetalhe != null,
    staleTime: 15_000,
  });

  const vendedorDetalheQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/vendedor", vendedorDetalhe],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/vendedor/${vendedorDetalhe}`),
    enabled: vendedorDetalhe != null,
    staleTime: 15_000,
  });

  // ── Sync mutation ──────────────────────────────────────────────────────

  const syncMut = useMutation({
    mutationFn: () => apiFetch("/api/admin/financeiro/admin/sync", { method: "POST" }),
    onSuccess: (data) => {
      toast({
        title: "Cache verificado",
        description: `${data.registros_importados} títulos | ${fmtBRL(data.valor_total_aberto)} em aberto`,
      });
      qc.invalidateQueries({ queryKey: ["/api/financeiro/contas-receber"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // ── Exportar ───────────────────────────────────────────────────────────

  function handleExportar() {
    const qs = buildQS(filters);
    const url = `/api/financeiro/contas-receber/exportar${qs}`;
    const a = document.createElement("a");
    a.href = url;
    a.click();
  }

  // ── Imprimir ───────────────────────────────────────────────────────────

  function handlePrint() {
    window.print();
  }

  const r = resumo.data;
  const isEmptyCache = r && r.qtd_total === 0;
  const pctInadimplente = r && r.total_aberto > 0
    ? ((r.total_vencido / r.total_aberto) * 100).toFixed(1)
    : "0";

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background print:bg-white">

      {/* ── Print-only header ─────────────────────────────────────────── */}
      <div className="hidden print:block px-6 pt-6 pb-2">
        <h1 className="text-lg font-bold">CONECTUBOS — Contas a Receber</h1>
        <p className="text-xs text-gray-500">Emitido em: {new Date().toLocaleString("pt-BR")}</p>
        <hr className="mt-2" />
      </div>

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 shrink-0 border-b border-border print:hidden">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Contas a Receber</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {r?.ultima_atualizacao
              ? `Última atualização: ${fmtDatetime(r.ultima_atualizacao)}`
              : "Aguardando sincronização com ERP"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="sm"
            onClick={handlePrint}
            className="hidden sm:flex"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Imprimir
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={handleExportar}
            className="hidden sm:flex"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Exportar CSV
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncMut.isPending && "animate-spin")} />
            Atualizar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="sm:hidden h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrint}><Printer className="h-3.5 w-3.5 mr-2" />Imprimir</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportar}><Download className="h-3.5 w-3.5 mr-2" />Exportar CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-5 pb-10">

          {/* ── Empty state ─────────────────────────────────────────────── */}
          {isEmptyCache && (
            <Card className="border-dashed">
              <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-muted-foreground">
                  Dados financeiros ainda não sincronizados.
                </p>
                <p className="text-sm text-muted-foreground/70">
                  Execute o script <code className="font-mono">erp_sync.py contas_receber</code> para importar os títulos do ERP.
                </p>
                <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncMut.isPending && "animate-spin")} />
                  Verificar status
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── KPI Cards ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 print:grid-cols-5">
            <KPICard
              title="Total em Aberto"
              value={fmtBRL(r?.total_aberto)}
              subtitle={`${r?.qtd_total ?? 0} títulos`}
              icon={DollarSign}
              iconBg="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400"
              loading={resumo.isLoading}
            />
            <KPICard
              title="Total Vencido"
              value={fmtBRL(r?.total_vencido)}
              subtitle={`${pctInadimplente}% do total`}
              icon={AlertTriangle}
              iconBg="bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
              loading={resumo.isLoading}
              alert={(r?.total_vencido ?? 0) > 0}
            />
            <KPICard
              title="Vence Hoje"
              value={fmtBRL(r?.total_vence_hoje)}
              subtitle={`${r?.qtd_hoje ?? 0} títulos`}
              icon={Clock}
              iconBg="bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
              loading={resumo.isLoading}
            />
            <KPICard
              title="A Vencer"
              value={fmtBRL(r?.total_a_vencer)}
              subtitle={`${r?.qtd_a_vencer ?? 0} títulos`}
              icon={TrendingUp}
              iconBg="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
              loading={resumo.isLoading}
            />
            <KPICard
              title="Juros Pendente"
              value={fmtBRL(r?.total_juros)}
              subtitle={`${r?.clientes_vencidos ?? 0} clientes em atraso`}
              icon={Users}
              iconBg="bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400"
              loading={resumo.isLoading}
            />
          </div>

          {/* ── Delinquency threshold (simulation) ──────────────────────── */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 print:hidden">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Simulação de inadimplência:</span>
            <span className="text-xs text-amber-700 dark:text-amber-400">considerar inadimplente após</span>
            <Input
              type="number"
              min={1}
              max={365}
              value={delinquencyDays}
              onChange={e => setDelinquencyDays(Math.max(1, Number(e.target.value) || 1))}
              className="h-7 w-16 text-xs text-center px-1"
            />
            <span className="text-xs text-amber-700 dark:text-amber-400">dias em atraso</span>
            <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-500 italic">Apenas visualização</span>
          </div>

          {/* ── Filters & Search ─────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-2 print:hidden">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, vendedor, cidade, nº título..."
                value={buscaInput}
                onChange={e => setBuscaInput(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={filters.status} onValueChange={v => setFilter("status", v)}>
              <SelectTrigger className="h-9 w-[140px] text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="VENCIDO">Vencido</SelectItem>
                <SelectItem value="VENCE_HOJE">Vence hoje</SelectItem>
                <SelectItem value="A_VENCER">A vencer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFiltros(v => !v)}
              className={cn("h-9", showFiltros && "bg-primary/10 border-primary/30")}
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Filtros
            </Button>
            {(filters.busca || filters.status !== "todos" || filters.venc_de || filters.venc_ate || filters.uf || filters.somente_vencidos === "1") && (
              <Button
                variant="ghost" size="sm"
                onClick={() => { setFilters(DEFAULT_FILTERS); setBuscaInput(""); }}
                className="h-9 text-muted-foreground"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Limpar
              </Button>
            )}
          </div>

          {/* ── Advanced Filters ──────────────────────────────────────────── */}
          {showFiltros && (
            <Card className="print:hidden">
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <Label className="text-xs">Vencimento de</Label>
                    <Input type="date" className="h-8 text-sm mt-1"
                      value={filters.venc_de}
                      onChange={e => setFilter("venc_de", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Vencimento até</Label>
                    <Input type="date" className="h-8 text-sm mt-1"
                      value={filters.venc_ate}
                      onChange={e => setFilter("venc_ate", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">UF</Label>
                    <Input className="h-8 text-sm mt-1" placeholder="SP, MG..."
                      value={filters.uf}
                      onChange={e => setFilter("uf", e.target.value.toUpperCase())}
                      maxLength={2} />
                  </div>
                  <div>
                    <Label className="text-xs">Forma de Recebimento</Label>
                    <Input className="h-8 text-sm mt-1" placeholder="Boleto, PIX..."
                      value={filters.forma_recebimento}
                      onChange={e => setFilter("forma_recebimento", e.target.value)} />
                  </div>
                  <div className="flex items-end pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.somente_vencidos === "1"}
                        onChange={e => setFilter("somente_vencidos", e.target.checked ? "1" : "0")}
                        className="rounded"
                      />
                      <span className="text-sm">Somente vencidos</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Tabs ──────────────────────────────────────────────────────── */}
          <div className="flex gap-1 border-b border-border print:hidden">
            {([
              { key: "clientes",   label: "Clientes",     icon: Users },
              { key: "duplicatas", label: "Duplicatas",   icon: FileText },
              { key: "vendedores", label: "Por Vendedor", icon: User },
              { key: "fila",       label: "Fila Cobrança",icon: List },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  "whitespace-nowrap",
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* ================================================================
              TAB: Clientes
              ================================================================ */}
          {tab === "clientes" && (
            <ClientesTab
              data={clientesQ.data}
              loading={clientesQ.isLoading}
              page={clientePage}
              onPage={setClientePage}
              sort={sortClientes}
              onSort={setSortClientes}
              onSelectCliente={setClienteDetalhe}
              onCobranca={setShowCobrancaDialog}
            />
          )}

          {/* ================================================================
              TAB: Duplicatas
              ================================================================ */}
          {tab === "duplicatas" && (
            <DuplicatasTab
              data={dupsQ.data}
              loading={dupsQ.isLoading}
              page={duplicataPage}
              onPage={setDuplicataPage}
              sort={sortDuplicatas}
              onSort={setSortDuplicatas}
              onCobranca={setShowCobrancaDialog}
              onSelectCliente={setClienteDetalhe}
            />
          )}

          {/* ================================================================
              TAB: Vendedores
              ================================================================ */}
          {tab === "vendedores" && (
            <VendedoresTab
              data={vendedoresQ.data}
              loading={vendedoresQ.isLoading}
              onSelectVendedor={setVendedorDetalhe}
            />
          )}

          {/* ================================================================
              TAB: Fila de Cobrança
              ================================================================ */}
          {tab === "fila" && (
            <FilaCobrancaTab
              data={filaQ.data}
              loading={filaQ.isLoading}
              onSelectCliente={setClienteDetalhe}
              onCobranca={setShowCobrancaDialog}
            />
          )}
        </div>
      </div>

      {/* ── Detalhe Cliente Sheet ──────────────────────────────────────── */}
      <Sheet open={clienteDetalhe != null} onOpenChange={o => { if (!o) setClienteDetalhe(null); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do Cliente</SheetTitle>
            <SheetDescription>Todas as duplicatas em aberto</SheetDescription>
          </SheetHeader>
          {clienteDetalheQ.isLoading ? (
            <div className="space-y-3 mt-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : clienteDetalheQ.data?.data ? (
            <ClienteDetalheContent
              info={clienteDetalheQ.data.data}
              duplicatas={clienteDetalheQ.data.duplicatas}
              cobrancas={clienteDetalheQ.data.cobrancas}
              onCobranca={setShowCobrancaDialog}
            />
          ) : (
            <div className="mt-8 text-center text-muted-foreground">
              <AlertCircle className="mx-auto h-8 w-8 mb-2" />
              <p>Este cliente não possui pendências.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Detalhe Vendedor Sheet ─────────────────────────────────────── */}
      <Sheet open={vendedorDetalhe != null} onOpenChange={o => { if (!o) setVendedorDetalhe(null); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pendências por Vendedor</SheetTitle>
            <SheetDescription>Clientes inadimplentes vinculados</SheetDescription>
          </SheetHeader>
          {vendedorDetalheQ.isLoading ? (
            <div className="space-y-3 mt-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : vendedorDetalheQ.data ? (
            <VendedorDetalheContent
              resumo={vendedorDetalheQ.data.resumo}
              clientes={vendedorDetalheQ.data.clientes}
              topTitulos={vendedorDetalheQ.data.top_titulos}
              onSelectCliente={id => { setVendedorDetalhe(null); setClienteDetalhe(id); }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ── Cobrança Dialog ────────────────────────────────────────────── */}
      {showCobrancaDialog != null && (
        <CobrancaDialog
          info={showCobrancaDialog}
          onClose={() => setShowCobrancaDialog(null)}
          onSuccess={() => {
            setShowCobrancaDialog(null);
            qc.invalidateQueries({ queryKey: ["/api/financeiro/contas-receber/cliente"] });
            qc.invalidateQueries({ queryKey: ["/api/financeiro/contas-receber/fila"] });
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// TAB: Clientes
// ============================================================================

function ClientesTab({
  data, loading, page, onPage, sort, onSort, onSelectCliente, onCobranca,
}: {
  data: any; loading: boolean; page: number; onPage: (p: number) => void;
  sort: { sort: string; dir: string }; onSort: (s: { sort: string; dir: string }) => void;
  onSelectCliente: (id: number) => void;
  onCobranca: (info: any) => void;
}) {
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  function SortBtn({ field, label }: { field: string; label: string }) {
    const active = sort.sort === field;
    return (
      <button
        className={cn("flex items-center gap-1 hover:text-foreground", active ? "text-foreground font-semibold" : "text-muted-foreground")}
        onClick={() => onSort({ sort: field, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    );
  }

  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
    </div>
  );

  if (!rows.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <Users className="mx-auto h-10 w-10 mb-3 opacity-30" />
      <p className="font-medium">Nenhum cliente encontrado para os filtros selecionados.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Desktop header */}
      <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-3 px-4 text-xs text-muted-foreground">
        <SortBtn field="nomecliente" label="Cliente" />
        <SortBtn field="total_vencido" label="Vencido" />
        <SortBtn field="total_aberto" label="Total Aberto" />
        <SortBtn field="maior_atraso" label="Maior Atraso" />
        <SortBtn field="juros" label="Juros" />
        <span>Ações</span>
      </div>

      {rows.map((row: any) => (
        <Card
          key={row.idclifor}
          className={cn(
            "transition-all hover:shadow-md cursor-pointer",
            row.maior_atraso > 30 ? "border-red-200 dark:border-red-900/50" :
            row.maior_atraso > 7  ? "border-amber-200 dark:border-amber-900/50" : ""
          )}
          onClick={() => onSelectCliente(row.idclifor)}
        >
          <CardContent className="p-4">
            <div className="flex flex-col md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-2 md:gap-3 md:items-center">
              {/* Client info */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{row.nomecliente}</p>
                  <RiscoBadge risco={row.status_cliente} />
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <User className="h-3 w-3" />
                    {row.nomevendedor ?? "—"}
                  </span>
                  {row.cidade_cobranca && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {row.cidade_cobranca}/{row.uf_cobranca}
                    </span>
                  )}
                  <span>{row.qtd_titulos} título{row.qtd_titulos !== 1 ? "s" : ""}</span>
                </div>
              </div>

              {/* Mobile value summary */}
              <div className="flex items-center gap-3 md:hidden text-sm">
                <span className="text-red-600 dark:text-red-400 font-semibold">{fmtBRL(row.total_vencido)}</span>
                <span className="text-muted-foreground">| Total: {fmtBRL(row.total_aberto)}</span>
              </div>

              {/* Desktop columns */}
              <div className="hidden md:block text-right">
                <p className="font-semibold text-sm text-red-600 dark:text-red-400">{fmtBRL(row.total_vencido)}</p>
                <p className="text-[10px] text-muted-foreground">vencido</p>
              </div>
              <div className="hidden md:block text-right">
                <p className="font-semibold text-sm">{fmtBRL(row.total_aberto)}</p>
                <p className="text-[10px] text-muted-foreground">em aberto</p>
              </div>
              <div className="hidden md:block text-right">
                {row.maior_atraso > 0 ? (
                  <>
                    <p className={cn("font-semibold text-sm", row.maior_atraso > 30 ? "text-red-600 dark:text-red-400" : "text-amber-600")}>
                      {row.maior_atraso}d
                    </p>
                    <p className="text-[10px] text-muted-foreground">atraso</p>
                  </>
                ) : <p className="text-[10px] text-muted-foreground">—</p>}
              </div>
              <div className="hidden md:block text-right">
                <p className="text-sm">{fmtBRL(row.juros_pendente)}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <Button
                  size="sm" variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => onSelectCliente(row.idclifor)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => onCobranca({
                    chave: "", idclifor: row.idclifor, idtitulo: 0,
                    cliente: row.nomecliente,
                  })}
                >
                  <Phone className="h-3.5 w-3.5" />
                </Button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Pagination */}
      {pages > 1 && (
        <Pagination page={page} pages={pages} total={total} onPage={onPage} />
      )}
    </div>
  );
}

// ============================================================================
// TAB: Duplicatas
// ============================================================================

function DuplicatasTab({
  data, loading, page, onPage, sort, onSort, onCobranca, onSelectCliente,
}: {
  data: any; loading: boolean; page: number; onPage: (p: number) => void;
  sort: { sort: string; dir: string }; onSort: (s: { sort: string; dir: string }) => void;
  onCobranca: (info: any) => void; onSelectCliente: (id: number) => void;
}) {
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  function SortBtn({ field, label }: { field: string; label: string }) {
    const active = sort.sort === field;
    return (
      <button
        className={cn("flex items-center gap-1 hover:text-foreground text-xs", active ? "text-foreground font-semibold" : "text-muted-foreground")}
        onClick={() => onSort({ sort: field, dir: active && sort.dir === "asc" ? "desc" : "asc" })}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    );
  }

  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
    </div>
  );

  if (!rows.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <FileText className="mx-auto h-10 w-10 mb-3 opacity-30" />
      <p className="font-medium">Nenhum título encontrado para os filtros selecionados.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2.5"><SortBtn field="nomecliente" label="Cliente" /></th>
              <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Título</th>
              <th className="text-left px-4 py-2.5"><SortBtn field="dtvencimento" label="Vencimento" /></th>
              <th className="text-left px-4 py-2.5"><SortBtn field="dias_atraso" label="Atraso" /></th>
              <th className="text-right px-4 py-2.5 text-xs text-muted-foreground">V. Original</th>
              <th className="text-right px-4 py-2.5"><SortBtn field="valor_aberto" label="V. Aberto" /></th>
              <th className="text-left px-4 py-2.5"><SortBtn field="status" label="Status" /></th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row: any) => (
              <tr
                key={row.id}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onSelectCliente(row.idclifor)}
              >
                <td className="px-4 py-3">
                  <p className="font-medium truncate max-w-[200px]">{row.nomecliente}</p>
                  <p className="text-[10px] text-muted-foreground">{row.nomevendedor}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {row.idtitulo}/{row.digitotitulo}
                  {row.serienota ? `-${row.serienota}` : ""}
                </td>
                <td className="px-4 py-3 text-sm">{fmtDate(row.dtvencimento)}</td>
                <td className="px-4 py-3">
                  {row.dias_atraso > 0 ? (
                    <span className={cn("text-sm font-semibold",
                      row.dias_atraso > 30 ? "text-red-600 dark:text-red-400" : "text-amber-600")}>
                      {row.dias_atraso}d
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-sm text-muted-foreground">
                  {fmtBRL(row.valor_original)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-sm">
                  {fmtBRL(row.valor_aberto)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => onCobranca({
                      chave: row.chave_titulo,
                      idclifor: row.idclifor,
                      idtitulo: row.idtitulo,
                      digitotitulo: row.digitotitulo,
                      serienota: row.serienota,
                      idempresa: row.idempresa,
                      cliente: row.nomecliente,
                    })}
                  >
                    <Phone className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {rows.map((row: any) => (
          <Card key={row.id} className="cursor-pointer hover:shadow-sm" onClick={() => onSelectCliente(row.idclifor)}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{row.nomecliente}</p>
                  <p className="text-[10px] text-muted-foreground">Tít. {row.idtitulo}/{row.digitotitulo} · Vence {fmtDate(row.dtvencimento)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{fmtBRL(row.valor_aberto)}</p>
                  <StatusBadge status={row.status} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pages > 1 && (
        <Pagination page={page} pages={pages} total={total} onPage={onPage} />
      )}
    </div>
  );
}

// ============================================================================
// TAB: Vendedores
// ============================================================================

function VendedoresTab({
  data, loading, onSelectVendedor,
}: {
  data: any; loading: boolean; onSelectVendedor: (id: number) => void;
}) {
  const rows = data?.data ?? [];

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
    </div>
  );

  if (!rows.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <User className="mx-auto h-10 w-10 mb-3 opacity-30" />
      <p className="font-medium">Sem pendências por vendedor.</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map((row: any) => (
        <Card
          key={row.idvendedor}
          className="cursor-pointer hover:shadow-md transition-all"
          onClick={() => onSelectVendedor(row.idvendedor)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold">{row.nomevendedor ?? `Vendedor ${row.idvendedor}`}</p>
                <RiscoBadge risco={row.status_risco} />
              </div>
              <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onSelectVendedor(row.idvendedor); }}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Pendências
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{fmtBRL(row.total_vencido)}</p>
                <p className="text-[10px] text-muted-foreground">Vencido</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{fmtBRL(row.total_aberto)}</p>
                <p className="text-[10px] text-muted-foreground">Em aberto</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums">{row.clientes_vencidos ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Cli. vencidos</p>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{row.qtd_titulos} título{row.qtd_titulos !== 1 ? "s" : ""}</span>
              <span>Maior atraso: {row.maior_atraso > 0 ? `${row.maior_atraso}d` : "—"}</span>
              <span>Juros: {fmtBRL(row.juros_pendente)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// TAB: Fila de Cobrança
// ============================================================================

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ALTA:  { label: "Prioridade Alta",  color: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-950/30" },
  MEDIA: { label: "Prioridade Média", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
  BAIXA: { label: "Prioridade Baixa", color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30" },
};

function FilaCobrancaTab({
  data, loading, onSelectCliente, onCobranca,
}: {
  data: any; loading: boolean;
  onSelectCliente: (id: number) => void;
  onCobranca: (info: any) => void;
}) {
  const rows = data?.data ?? [];
  const hoje = new Date().toISOString().split("T")[0];

  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
    </div>
  );

  if (!rows.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <CheckCircle2 className="mx-auto h-10 w-10 mb-3 text-emerald-500/50" />
      <p className="font-medium">Nenhuma cobrança pendente.</p>
    </div>
  );

  const grouped = {
    ALTA: rows.filter((r: any) => r.prioridade === "ALTA"),
    MEDIA: rows.filter((r: any) => r.prioridade === "MEDIA"),
    BAIXA: rows.filter((r: any) => r.prioridade === "BAIXA"),
  };

  return (
    <div className="space-y-5">
      {(["ALTA", "MEDIA", "BAIXA"] as const).map(prioridade => {
        const group = grouped[prioridade];
        if (!group.length) return null;
        const cfg = PRIORIDADE_CONFIG[prioridade];
        return (
          <div key={prioridade}>
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg mb-2", cfg.bg)}>
              <p className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</p>
              <Badge variant="secondary" className="text-[10px]">{group.length}</Badge>
            </div>
            <div className="space-y-2">
              {group.map((row: any) => {
                const promessaVencida = row.promessa_pagamento === "S" &&
                  row.data_promessa_pagamento && row.data_promessa_pagamento < hoje;
                return (
                  <Card
                    key={row.idclifor}
                    className={cn(
                      "cursor-pointer hover:shadow-sm transition-all",
                      promessaVencida && "border-red-400 dark:border-red-700"
                    )}
                    onClick={() => onSelectCliente(row.idclifor)}
                  >
                    <CardContent className="p-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{row.nomecliente}</p>
                            {promessaVencida && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-full px-2 py-0.5 border border-red-200 dark:border-red-900">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Promessa vencida
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                            <span><User className="inline h-2.5 w-2.5 mr-0.5" />{row.nomevendedor}</span>
                            {row.cidade_cobranca && <span><MapPin className="inline h-2.5 w-2.5 mr-0.5" />{row.cidade_cobranca}/{row.uf_cobranca}</span>}
                            <span>{row.qtd_vencidos} título{row.qtd_vencidos !== 1 ? "s" : ""} vencidos</span>
                            {row.maior_atraso > 0 && <span>Maior atraso: {row.maior_atraso}d</span>}
                            {row.data_proxima_acao && <span><Calendar className="inline h-2.5 w-2.5 mr-0.5" />Próx. ação: {fmtDate(row.data_proxima_acao)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-red-600 dark:text-red-400 font-bold text-sm">{fmtBRL(row.total_vencido)}</p>
                            <p className="text-[10px] text-muted-foreground">{fmtBRL(row.total_aberto)} total</p>
                          </div>
                          <Button
                            size="sm" variant="outline"
                            className="h-8"
                            onClick={e => { e.stopPropagation(); onCobranca({ chave: "", idclifor: row.idclifor, idtitulo: 0, cliente: row.nomecliente }); }}
                          >
                            <Phone className="h-3.5 w-3.5 mr-1" />
                            Cobrar
                          </Button>
                        </div>
                      </div>
                      {row.ultima_cobranca && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 border-t border-border pt-1.5">
                          Última cobrança: {fmtDate(row.ultima_cobranca)}
                          {row.status_interno ? ` · ${row.status_interno}` : ""}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Cliente Detalhe Content
// ============================================================================

function ClienteDetalheContent({
  info, duplicatas, cobrancas, onCobranca,
}: {
  info: any; duplicatas: any[]; cobrancas: any[];
  onCobranca: (info: any) => void;
}) {
  return (
    <div className="mt-6 space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Vencido</p>
            <p className="text-base font-bold text-red-600 dark:text-red-400">{fmtBRL(info.total_vencido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total em Aberto</p>
            <p className="text-base font-bold">{fmtBRL(info.total_aberto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Maior Atraso</p>
            <p className="text-base font-bold">{info.maior_atraso > 0 ? `${info.maior_atraso} dias` : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Juros Pendente</p>
            <p className="text-base font-bold">{fmtBRL(info.juros_pendente)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <div className="space-y-1 text-sm text-muted-foreground">
        {info.nomevendedor && <p><User className="inline h-3.5 w-3.5 mr-1" />Vendedor: <span className="text-foreground font-medium">{info.nomevendedor}</span></p>}
        {info.cidade_cobranca && <p><MapPin className="inline h-3.5 w-3.5 mr-1" />{info.endereco_cobranca ? `${info.endereco_cobranca}, ` : ""}{info.bairro_cobranca ? `${info.bairro_cobranca} — ` : ""}{info.cidade_cobranca}/{info.uf_cobranca}</p>}
        {info.ultimo_pagamento && <p><Calendar className="inline h-3.5 w-3.5 mr-1" />Último pagamento: <span className="text-foreground">{fmtDate(info.ultimo_pagamento)}</span></p>}
        {info.proximo_vencimento && <p><Clock className="inline h-3.5 w-3.5 mr-1" />Próximo vencimento: <span className="text-foreground">{fmtDate(info.proximo_vencimento)}</span></p>}
      </div>

      <Button
        className="w-full"
        onClick={() => onCobranca({
          chave: "", idclifor: info.idclifor, idtitulo: 0,
          cliente: info.nomecliente,
        })}
      >
        <Phone className="h-3.5 w-3.5 mr-2" />
        Registrar Cobrança
      </Button>

      {/* Duplicatas */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Duplicatas em Aberto ({duplicatas.length})</h3>
        <div className="space-y-2">
          {duplicatas.map((d: any) => (
            <div
              key={d.id}
              className={cn(
                "flex items-center justify-between gap-2 p-3 rounded-xl border text-sm",
                d.status === "VENCIDO" ? "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20" :
                d.status === "VENCE_HOJE" ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20" :
                "border-border bg-muted/30"
              )}
            >
              <div>
                <p className="font-mono text-xs text-muted-foreground">
                  Tít. {d.idtitulo}/{d.digitotitulo}{d.serienota ? `-${d.serienota}` : ""}
                  {d.numnota ? ` · NF ${d.numnota}` : ""}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Venc: {fmtDate(d.dtvencimento)}
                  {d.dias_atraso > 0 ? ` · ${d.dias_atraso}d em atraso` : ""}
                  {d.forma_recebimento ? ` · ${d.forma_recebimento}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold">{fmtBRL(d.valor_aberto)}</p>
                <StatusBadge status={d.status} />
              </div>
            </div>
          ))}
          {duplicatas.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">Nenhuma duplicata em aberto.</p>
          )}
        </div>
      </div>

      {/* Histórico de cobranças */}
      {cobrancas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Histórico de Cobranças</h3>
          <div className="space-y-2">
            {cobrancas.slice(0, 10).map((c: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-primary/30 pl-3 py-1">
                <div className="flex-1">
                  <p className="font-medium">{c.status_interno ?? c.acao}</p>
                  {c.observacao && <p className="text-muted-foreground">{c.observacao}</p>}
                </div>
                <div className="text-right shrink-0 text-muted-foreground">
                  <p>{c.usuario ?? c.hist_usuario}</p>
                  <p>{fmtDate(c.hist_em ?? c.data_cobranca)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Vendedor Detalhe Content
// ============================================================================

function VendedorDetalheContent({
  resumo, clientes, topTitulos, onSelectCliente,
}: {
  resumo: any; clientes: any[]; topTitulos: any[];
  onSelectCliente: (id: number) => void;
}) {
  if (!resumo) return (
    <div className="mt-8 text-center text-muted-foreground">
      <p>Nenhuma pendência encontrada.</p>
    </div>
  );

  return (
    <div className="mt-6 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Total Vencido</p>
          <p className="text-base font-bold text-red-600 dark:text-red-400">{fmtBRL(resumo.total_vencido)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Total em Aberto</p>
          <p className="text-base font-bold">{fmtBRL(resumo.total_aberto)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Clientes Vencidos</p>
          <p className="text-base font-bold">{resumo.clientes_vencidos ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Maior Atraso</p>
          <p className="text-base font-bold">{resumo.maior_atraso > 0 ? `${resumo.maior_atraso}d` : "—"}</p>
        </CardContent></Card>
      </div>

      {topTitulos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Títulos mais antigos vencidos</h3>
          <div className="space-y-1.5">
            {topTitulos.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20 text-sm cursor-pointer hover:bg-red-100/50" onClick={() => onSelectCliente(t.idclifor)}>
                <div>
                  <p className="font-medium text-xs">{t.nomecliente}</p>
                  <p className="text-[10px] text-muted-foreground">Tít. {t.idtitulo} · Venc. {fmtDate(t.dtvencimento)} · {t.dias_atraso}d</p>
                </div>
                <p className="font-bold text-red-600 dark:text-red-400">{fmtBRL(t.valor_aberto)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">Clientes com pendência ({clientes.length})</h3>
        <div className="space-y-2">
          {clientes.map((c: any) => (
            <div
              key={c.idclifor}
              className="flex items-center justify-between gap-2 p-3 rounded-xl border cursor-pointer hover:bg-muted/50 text-sm"
              onClick={() => onSelectCliente(c.idclifor)}
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{c.nomecliente}</p>
                <p className="text-[11px] text-muted-foreground">{c.cidade_cobranca}/{c.uf_cobranca} · {c.qtd_titulos} tít.</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-red-600 dark:text-red-400">{fmtBRL(c.total_vencido)}</p>
                <RiscoBadge risco={c.status_cliente} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Cobrança Dialog
// ============================================================================

function CobrancaDialog({
  info, onClose, onSuccess,
}: {
  info: { chave: string; idclifor: number; idtitulo: number; digitotitulo?: string; serienota?: string; idempresa?: number; cliente?: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState("COBRADO");
  const [canal, setCanal] = useState("Telefone");
  const [obs, setObs] = useState("");
  const [motivo, setMotivo] = useState("");
  const [proximaAcao, setProximaAcao] = useState("");
  const [dataProximaAcao, setDataProximaAcao] = useState("");
  const [promessa, setPromessa] = useState("N");
  const [dataPromessa, setDataPromessa] = useState("");

  const mut = useMutation({
    mutationFn: () => apiFetch("/api/financeiro/contas-receber/cobranca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chave_titulo: info.chave,
        idempresa: info.idempresa,
        idclifor: info.idclifor,
        idtitulo: info.idtitulo,
        digitotitulo: info.digitotitulo,
        serienota: info.serienota,
        status_interno: status,
        observacao: obs,
        motivo_atraso: motivo,
        canal_contato: canal,
        proxima_acao: proximaAcao,
        data_proxima_acao: dataProximaAcao || null,
        promessa_pagamento: promessa,
        data_promessa_pagamento: dataPromessa || null,
      }),
    }),
    onSuccess: () => {
      toast({ title: "Cobrança registrada", description: "Histórico salvo com sucesso." });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Cobrança</DialogTitle>
          <DialogDescription>
            {info.cliente ? `Cliente: ${info.cliente}` : `Cód. ${info.idclifor}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COBRADO">Cobrado</SelectItem>
                  <SelectItem value="SEM_CONTATO">Sem contato</SelectItem>
                  <SelectItem value="AGUARDANDO">Aguardando</SelectItem>
                  <SelectItem value="PROMESSA">Promessa de pagamento</SelectItem>
                  <SelectItem value="NEGOCIACAO">Em negociação</SelectItem>
                  <SelectItem value="CONTESTADO">Contestado</SelectItem>
                  <SelectItem value="IRRECUPERAVEL">Irrecuperável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Canal de Contato</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger className="h-8 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Telefone">Telefone</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="E-mail">E-mail</SelectItem>
                  <SelectItem value="Visita">Visita presencial</SelectItem>
                  <SelectItem value="Carta">Carta/Notificação</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea
              className="text-sm mt-1 resize-none"
              placeholder="Descreva o contato realizado..."
              rows={3}
              value={obs}
              onChange={e => setObs(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs">Motivo do atraso</Label>
            <Input
              className="h-8 text-sm mt-1"
              placeholder="Financeiro, esquecimento, disputa..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Próxima ação</Label>
              <Input
                className="h-8 text-sm mt-1"
                placeholder="Ligar novamente, enviar boleto..."
                value={proximaAcao}
                onChange={e => setProximaAcao(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Data próxima ação</Label>
              <Input
                type="date" className="h-8 text-sm mt-1"
                value={dataProximaAcao}
                onChange={e => setDataProximaAcao(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={promessa === "S"}
                onChange={e => setPromessa(e.target.checked ? "S" : "N")}
                className="rounded"
              />
              <span className="text-sm">Promessa de pagamento</span>
            </label>
            {promessa === "S" && (
              <Input
                type="date" className="h-8 text-sm flex-1"
                value={dataPromessa}
                onChange={e => setDataPromessa(e.target.value)}
                placeholder="Data prometida"
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Pagination
// ============================================================================

function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2 print:hidden">
      <p className="text-xs text-muted-foreground">{total} registro{total !== 1 ? "s" : ""}</p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page === 1} className="h-7 w-7 p-0">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground px-2">Pág. {page} de {pages}</span>
        <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages} className="h-7 w-7 p-0">
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
