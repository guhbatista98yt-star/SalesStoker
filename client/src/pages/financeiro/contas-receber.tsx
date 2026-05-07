import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign, AlertTriangle, Clock, TrendingUp, Users, FileText,
  Search, Filter, Download, RefreshCw, ChevronRight, ChevronLeft,
  ChevronDown, MoreVertical, Eye, MessageSquare, CalendarIcon,
  Printer, Building2, MapPin, User, List, ArrowUpDown,
  CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

// ── DatePicker component ────────────────────────────────────────────────────

function DatePicker({ value, onChange, placeholder = "Qualquer data" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value + "T00:00:00") : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 text-sm mt-1 w-full justify-start font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
          {date ? format(date, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={date}
          onSelect={d => { onChange(d ? format(d, "yyyy-MM-dd") : ""); setOpen(false); }}
          locale={ptBR}
          initialFocus
        />
        {value && (
          <div className="border-t p-2">
            <Button
              variant="ghost" size="sm"
              className="w-full h-7 text-xs text-muted-foreground"
              onClick={() => { onChange(""); setOpen(false); }}
            >
              Limpar data
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

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

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-primary/60 transition-colors"
        aria-label="Remover filtro"
      >
        <XCircle className="h-3 w-3" />
      </button>
    </span>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KPICard({
  title, value, subtitle, icon: Icon, iconBg, loading, alert, onClick, active,
}: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; iconBg: string; loading?: boolean; alert?: boolean;
  onClick?: () => void; active?: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all",
        alert && "ring-2 ring-red-500/20",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        active && "ring-2 ring-primary border-primary/50"
      )}
      onClick={onClick}
    >
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
        {active && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
        )}
      </CardContent>
    </Card>
  );
}

// ── Filters ────────────────────────────────────────────────────────────────

interface Filters {
  status: string;
  empresa: string;
  busca: string;
  venc_de: string;
  venc_ate: string;
  forma_recebimento: string;
  somente_vencidos: string;
  cod_cliente: string;
  cod_vendedor: string;
  idtitulo: string;
  numnota: string;
}

const DEFAULT_FILTERS: Filters = {
  status: "todos",
  empresa: "all",
  busca: "",
  venc_de: "",
  venc_ate: "",
  forma_recebimento: "",
  somente_vencidos: "0",
  cod_cliente: "",
  cod_vendedor: "",
  idtitulo: "",
  numnota: "",
};

const FORMAS_RECEBIMENTO = [
  "BOLETO", "DUPLICATA", "PIX", "CHEQUE", "TRANSFERÊNCIA",
  "DINHEIRO", "CARTÃO", "DOC", "TED", "DÉBITO AUTOMÁTICO",
];

function buildQS(filters: Filters, extra: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  const mapped: Record<string, string | number> = {
    ...extra,
    status: filters.status,
    empresa: filters.empresa,
    busca: filters.busca,
    venc_de: filters.venc_de,
    venc_ate: filters.venc_ate,
    forma_recebimento: filters.forma_recebimento,
    somente_vencidos: filters.somente_vencidos,
    idclifor: filters.cod_cliente,
    idvendedor: filters.cod_vendedor,
    idtitulo: filters.idtitulo,
    numnota: filters.numnota,
  };
  Object.entries(mapped).forEach(([k, v]) => {
    if (v != null && v !== "" && v !== "todos" && v !== "all" && v !== "0") qs.set(k, String(v));
  });
  return qs.toString() ? `?${qs.toString()}` : "";
}


// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ContasReceber() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"clientes" | "duplicatas" | "vendedores">("clientes");
  const [delinquencyDays, setDelinquencyDays] = useState<number>(10);
  const [delinquencyEnabled, setDelinquencyEnabled] = useState<boolean>(true);
  const [showDelinquency, setShowDelinquency] = useState<boolean>(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [buscaInput, setBuscaInput] = useState("");
  const [clientePage, setClientePage] = useState(1);
  const [duplicataPage, setDuplicataPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [clienteDetalhe, setClienteDetalhe] = useState<number | null>(null);
  const [vendedorDetalhe, setVendedorDetalhe] = useState<number | null>(null);
  const [showFiltros, setShowFiltros] = useState(false);
  const [formaSearch, setFormaSearch] = useState("");
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

  // ── Active filter count ─────────────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.status !== "todos") n++;
    if (filters.busca) n++;
    if (filters.venc_de) n++;
    if (filters.venc_ate) n++;
    if (filters.forma_recebimento) n++;
    if (filters.somente_vencidos === "1") n++;
    if (filters.cod_cliente) n++;
    if (filters.cod_vendedor) n++;
    if (filters.idtitulo) n++;
    if (filters.numnota) n++;
    return n;
  }, [filters]);

  // ── Queries ────────────────────────────────────────────────────────────

  // Resumo (KPI cards) — passes same filters so cards stay consistent with all tabs
  const resumoQS = buildQS(filters);
  const resumoQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/resumo", resumoQS],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/resumo${resumoQS}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const resumo = resumoQ;

  const clientesQS = buildQS(filters, { page: clientePage, limit: perPage, ...sortClientes });
  const clientesQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/clientes", clientesQS],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/clientes${clientesQS}`),
    staleTime: 30_000,
  });

  const dupsQS = buildQS(filters, { page: duplicataPage, limit: perPage, ...sortDuplicatas });
  const dupsQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/duplicatas", dupsQS],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/duplicatas${dupsQS}`),
    enabled: tab === "duplicatas",
    staleTime: 30_000,
  });

  // Vendedores — passes same filters so tab totals match cards
  const vendedoresQS = buildQS(filters);
  const vendedoresQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/vendedores", vendedoresQS],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/vendedores${vendedoresQS}`),
    enabled: tab === "vendedores",
    staleTime: 30_000,
  });


  // Print query — sempre busca TODOS os registros sem paginação
  const printDupsQS = buildQS(filters, { sort: "nomecliente", dir: "asc" });
  const printDupsQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/duplicatas/all", printDupsQS],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/duplicatas/all${printDupsQS}`),
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
    a.download = `contas-receber-${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
  }

  // ── Imprimir ───────────────────────────────────────────────────────────

  function handlePrint() {
    window.print();
  }

  // ── Formas de recebimento (dinâmico) ──────────────────────────────────
  const formasQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/formas-recebimento"],
    queryFn: () => apiFetch("/api/financeiro/contas-receber/formas-recebimento"),
    staleTime: 300_000,
  });
  const formasList: string[] = formasQ.data?.formas ?? FORMAS_RECEBIMENTO;

  const r = resumo.data;
  const isEmptyCache = r && r.qtd_total === 0;
  const pctInadimplente = r && r.total_aberto > 0
    ? ((r.total_vencido / r.total_aberto) * 100).toFixed(1)
    : "0";

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background print:bg-white print:h-auto print:overflow-visible">

      {/* ── Professional Print Layout ─────────────────────────────────── */}
      <PrintReport filters={filters} resumo={r} clientesData={clientesQ.data} dupsData={printDupsQ.data} tab={tab} />

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
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", syncMut.isPending && "animate-spin")} />
            Atualizar
          </Button>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 print:grid-cols-5 print:gap-2">
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
          <div className="print:hidden">
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowDelinquency(v => !v)}
            >
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              Simulação de inadimplência
              <ChevronDown className={cn("h-3 w-3 transition-transform", showDelinquency && "rotate-180")} />
            </button>
            {showDelinquency && (
              <div className="mt-2 flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-800 dark:text-amber-300">
                  <input
                    type="checkbox"
                    checked={delinquencyEnabled}
                    onChange={e => setDelinquencyEnabled(e.target.checked)}
                    className="rounded"
                  />
                  Ativar
                </label>
                {delinquencyEnabled && (
                  <>
                    <span className="text-xs text-amber-700 dark:text-amber-400">Considerar inadimplente após</span>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={delinquencyDays}
                      onChange={e => setDelinquencyDays(Math.max(0, Number(e.target.value) || 0))}
                      className="h-7 w-16 text-xs text-center px-1"
                    />
                    <span className="text-xs text-amber-700 dark:text-amber-400">dias em atraso</span>
                  </>
                )}
                <span className="ml-auto text-[10px] text-amber-600 dark:text-amber-500 italic">Apenas visualização</span>
              </div>
            )}
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
              {activeFilterCount > 0 && (
                <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost" size="sm"
                onClick={() => { setFilters(DEFAULT_FILTERS); setBuscaInput(""); }}
                className="h-9 text-muted-foreground"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Limpar tudo
              </Button>
            )}
          </div>

          {/* ── Active Filter Chips ───────────────────────────────────────── */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 print:hidden">
              {filters.status !== "todos" && (
                <FilterChip
                  label={`Status: ${STATUS_CONFIG[filters.status]?.label ?? filters.status}`}
                  onRemove={() => setFilter("status", "todos")}
                />
              )}
              {filters.busca && (
                <FilterChip
                  label={`Busca: "${filters.busca}"`}
                  onRemove={() => { setBuscaInput(""); setFilters(f => ({ ...f, busca: "" })); }}
                />
              )}
              {filters.venc_de && (
                <FilterChip
                  label={`Venc. de: ${fmtDate(filters.venc_de)}`}
                  onRemove={() => setFilter("venc_de", "")}
                />
              )}
              {filters.venc_ate && (
                <FilterChip
                  label={`Venc. até: ${fmtDate(filters.venc_ate)}`}
                  onRemove={() => setFilter("venc_ate", "")}
                />
              )}
              {filters.forma_recebimento && (
                <FilterChip
                  label={`Forma: ${filters.forma_recebimento}`}
                  onRemove={() => { setFilter("forma_recebimento", ""); setFormaSearch(""); }}
                />
              )}
              {filters.somente_vencidos === "1" && (
                <FilterChip
                  label="Somente vencidos"
                  onRemove={() => setFilter("somente_vencidos", "0")}
                />
              )}
              {filters.cod_cliente && (
                <FilterChip
                  label={`Cliente: ${filters.cod_cliente}`}
                  onRemove={() => setFilter("cod_cliente", "")}
                />
              )}
              {filters.cod_vendedor && (
                <FilterChip
                  label={`Vendedor: ${filters.cod_vendedor}`}
                  onRemove={() => setFilter("cod_vendedor", "")}
                />
              )}
              {filters.idtitulo && (
                <FilterChip
                  label={`Título: ${filters.idtitulo}`}
                  onRemove={() => setFilter("idtitulo", "")}
                />
              )}
              {filters.numnota && (
                <FilterChip
                  label={`NF: ${filters.numnota}`}
                  onRemove={() => setFilter("numnota", "")}
                />
              )}
            </div>
          )}

          {/* ── Advanced Filters ──────────────────────────────────────────── */}
          {showFiltros && (
            <Card className="print:hidden">
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Vencimento de</Label>
                    <DatePicker
                      value={filters.venc_de}
                      onChange={v => setFilter("venc_de", v)}
                      placeholder="Qualquer data"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Vencimento até</Label>
                    <DatePicker
                      value={filters.venc_ate}
                      onChange={v => setFilter("venc_ate", v)}
                      placeholder="Qualquer data"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cód. Cliente</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm mt-1"
                      placeholder="Ex: 12345"
                      value={filters.cod_cliente}
                      onChange={e => setFilter("cod_cliente", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cód. Vendedor</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm mt-1"
                      placeholder="Ex: 10"
                      value={filters.cod_vendedor}
                      onChange={e => setFilter("cod_vendedor", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nº Título</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm mt-1"
                      placeholder="Ex: 2335879"
                      value={filters.idtitulo}
                      onChange={e => setFilter("idtitulo", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nota Fiscal</Label>
                    <Input
                      className="h-8 text-sm mt-1"
                      placeholder="Nº da nota"
                      value={filters.numnota}
                      onChange={e => setFilter("numnota", e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <div className="relative mt-1">
                      <Input
                        className="h-8 text-sm pr-8"
                        placeholder="Digite ou selecione..."
                        value={formaSearch || filters.forma_recebimento}
                        onChange={e => {
                          setFormaSearch(e.target.value);
                          setFilter("forma_recebimento", e.target.value);
                        }}
                      />
                      {(filters.forma_recebimento || formaSearch) && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => { setFormaSearch(""); setFilter("forma_recebimento", ""); }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {formaSearch && (
                      <div className="absolute z-20 top-full mt-0.5 left-0 right-0 bg-background border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {formasList.filter(f => f.toLowerCase().includes(formaSearch.toLowerCase())).map(f => (
                          <button
                            key={f}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                            onClick={() => {
                              setFilter("forma_recebimento", f);
                              setFormaSearch("");
                            }}
                          >
                            {f}
                          </button>
                        ))}
                        {formasList.filter(f => f.toLowerCase().includes(formaSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            Pressione Enter para usar "{formaSearch}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-end pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.somente_vencidos === "1"}
                        onChange={e => setFilter("somente_vencidos", e.target.checked ? "1" : "")}
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
          <div className="flex gap-1 border-b border-border print:hidden overflow-x-auto">
            {([
              {
                key: "clientes",
                label: "Por Cliente",
                shortLabel: "Clientes",
                icon: Users,
                title: "Exposição financeira agrupada por cliente — todos os status.",
              },
              {
                key: "duplicatas",
                label: "Títulos",
                shortLabel: "Títulos",
                icon: FileText,
                title: "Cada título/duplicata individualmente com status e vencimento.",
              },
              {
                key: "vendedores",
                label: "Por Vendedor",
                shortLabel: "Vendedor",
                icon: User,
                title: "Saldo em aberto agrupado por representante comercial.",
              },
            ] as const).map(({ key, label, shortLabel, icon: Icon, title }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                title={title}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  "whitespace-nowrap shrink-0",
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{label}</span>
                <span className="lg:hidden hidden sm:inline">{shortLabel}</span>
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
              perPage={perPage}
              onPerPage={n => { setPerPage(n); setClientePage(1); setDuplicataPage(1); }}
              sort={sortClientes}
              onSort={setSortClientes}
              onSelectCliente={setClienteDetalhe}
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
              perPage={perPage}
              onPerPage={n => { setPerPage(n); setClientePage(1); setDuplicataPage(1); }}
              sort={sortDuplicatas}
              onSort={setSortDuplicatas}
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

    </div>
  );
}

// ============================================================================
// TAB: Clientes
// ============================================================================

function ClientesTab({
  data, loading, page, onPage, perPage, onPerPage, sort, onSort, onSelectCliente,
}: {
  data: any; loading: boolean; page: number; onPage: (p: number) => void;
  perPage: number; onPerPage: (n: number) => void;
  sort: { sort: string; dir: string }; onSort: (s: { sort: string; dir: string }) => void;
  onSelectCliente: (id: number) => void;
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
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {(pages > 1 || total > 0) && (
        <Pagination page={page} pages={pages} total={total} onPage={onPage} perPage={perPage} onPerPage={onPerPage} />
      )}
    </div>
  );
}

// ============================================================================
// TAB: Duplicatas
// ============================================================================

function DuplicatasTab({
  data, loading, page, onPage, perPage, onPerPage, sort, onSort, onSelectCliente,
}: {
  data: any; loading: boolean; page: number; onPage: (p: number) => void;
  perPage: number; onPerPage: (n: number) => void;
  sort: { sort: string; dir: string }; onSort: (s: { sort: string; dir: string }) => void;
  onSelectCliente: (id: number) => void;
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

      {(pages > 1 || total > 0) && (
        <Pagination page={page} pages={pages} total={total} onPage={onPage} perPage={perPage} onPerPage={onPerPage} />
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
  data, loading, onSelectCliente,
}: {
  data: any; loading: boolean;
  onSelectCliente: (id: number) => void;
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
                            {row.data_proxima_acao && <span><CalendarIcon className="inline h-2.5 w-2.5 mr-0.5" />Próx. ação: {fmtDate(row.data_proxima_acao)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-red-600 dark:text-red-400 font-bold text-sm">{fmtBRL(row.total_vencido)}</p>
                            <p className="text-[10px] text-muted-foreground">{fmtBRL(row.total_aberto)} total</p>
                          </div>
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
  info, duplicatas, cobrancas,
}: {
  info: any; duplicatas: any[]; cobrancas: any[];
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
        {info.ultimo_pagamento && <p><CalendarIcon className="inline h-3.5 w-3.5 mr-1" />Último pagamento: <span className="text-foreground">{fmtDate(info.ultimo_pagamento)}</span></p>}
        {info.proximo_vencimento && <p><Clock className="inline h-3.5 w-3.5 mr-1" />Próximo vencimento: <span className="text-foreground">{fmtDate(info.proximo_vencimento)}</span></p>}
      </div>


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
// _placeholder_cobranca_removed
// ============================================================================


// ============================================================================
// Print Report — layout profissional visível apenas no print
// ============================================================================

function PrintReport({
  filters, resumo, clientesData, dupsData, tab,
}: {
  filters: Filters;
  resumo: any;
  clientesData: any;
  dupsData: any;
  tab: string;
}) {
  const now = new Date().toLocaleString("pt-BR");
  const allDups: any[] = dupsData?.data ?? [];

  // Group by client (server already sorted by nomecliente, idclifor, dtvencimento)
  const byClient = new Map<number, { info: any; rows: any[] }>();
  for (const row of allDups) {
    if (!byClient.has(row.idclifor)) {
      byClient.set(row.idclifor, { info: row, rows: [] });
    }
    byClient.get(row.idclifor)!.rows.push(row);
  }
  const clientGroups = Array.from(byClient.values());

  // Grand totals
  let grandVencido = 0, grandAVencer = 0, grandJuros = 0, grandPago = 0, grandSaldo = 0;
  for (const row of allDups) {
    if (row.status === "VENCIDO") grandVencido += Number(row.valor_original) || 0;
    else grandAVencer += Number(row.valor_original) || 0;
    grandJuros += Number(row.valor_juros_pendente) || 0;
    grandPago  += Number(row.valor_pago) || 0;
    grandSaldo += Number(row.valor_aberto) || 0;
  }

  // ERP-style number formatter — zeros shown as ",00"
  function fmtN(v: number | null | undefined) {
    const n = Number(v) || 0;
    if (n === 0) return ",00";
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  // Base font/color for all cells
  const MONO = "'Courier New', Courier, monospace";
  const base: React.CSSProperties = { fontFamily: MONO, fontSize: "7.5pt", color: "#000", lineHeight: "1.3" };

  // th/td helpers
  const th = (align: React.CSSProperties["textAlign"]): React.CSSProperties => ({
    ...base, textAlign: align, padding: "2px 3px", fontWeight: "bold",
    borderTop: "1px solid #000", borderBottom: "1px solid #000",
    whiteSpace: "nowrap",
  });
  const td = (align: React.CSSProperties["textAlign"], extra: React.CSSProperties = {}): React.CSSProperties => ({
    ...base, textAlign: align, padding: "0px 3px", verticalAlign: "top", ...extra,
  });

  // Column widths
  const W = ["13%","11%","5%","9%","9%","4%","8%","7%","9%","8%","8%","9%"] as const;

  // Filter params lines (ERP style)
  const filterLines = [
    `Informe a(s) empresa(s) = ( ${filters.empresa === "all" ? "Todas" : filters.empresa} )`,
    `Informe o cliente ou branco para todos = ${filters.cod_cliente || ""}`,
    `Informe a(s) forma(s) de pagto ou branco p/ todas = ${filters.forma_recebimento || ""}`,
    filters.venc_de  ? `Data de vencimento inicial = '${fmtDate(filters.venc_de)}'` : null,
    filters.venc_ate ? `Data de vencimento final = '${fmtDate(filters.venc_ate)}'`   : null,
    filters.busca    ? `Busca = "${filters.busca}"` : null,
    filters.cod_vendedor ? `Vendedor = ${filters.cod_vendedor}` : null,
    filters.somente_vencidos === "1" ? "Somente vencidos = Sim" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="hidden print:block" style={{ ...base, backgroundColor: "#fff", padding: "0" }}>

      {/* Print-specific CSS: repeat thead on every page, keep tbody groups together */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm 8mm; }
          .pr-thead { display: table-header-group; }
          .pr-tfoot { display: table-footer-group; }
          .pr-tbody { page-break-inside: avoid; }
        }
      `}</style>

      {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1px", ...base }}>
        <div style={{ fontWeight: "bold" }}>Conectubos Atacarejo da Construção</div>
        <div>{now}</div>
      </div>
      <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: "2px", ...base }}>
        150020-Extrato para Cobrança 2.0
      </div>
      <div style={{ textAlign: "center", fontSize: "7pt", lineHeight: "1.7", ...base }}>
        {filterLines.map((line, i) => <div key={i}>{line}</div>)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", marginBottom: "3px", ...base, fontSize: "7pt" }}>
        <span>Financeiro</span>
        <span>{allDups.length} título(s) · {clientGroups.length} cliente(s)</span>
        <span>V. 05</span>
      </div>

      {/* ── Main table ─────────────────────────────────────────────────── */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>

        {/* thead repeats on every printed page automatically */}
        <thead className="pr-thead">
          <tr>
            <th style={{ ...th("left"),   width: W[0]  }}>Nota / Série</th>
            <th style={{ ...th("left"),   width: W[1]  }}>Titulo / Dígito</th>
            <th style={{ ...th("center"), width: W[2]  }}>Pgto.</th>
            <th style={{ ...th("right"),  width: W[3]  }}>Valor Vencido</th>
            <th style={{ ...th("right"),  width: W[4]  }}>Valor a Vencer</th>
            <th style={{ ...th("center"), width: W[5]  }}>Atraso</th>
            <th style={{ ...th("right"),  width: W[6]  }}>Juros</th>
            <th style={{ ...th("right"),  width: W[7]  }}>Valor Pago</th>
            <th style={{ ...th("right"),  width: W[8]  }}>Saldo a Pagar</th>
            <th style={{ ...th("center"), width: W[9]  }}>Emissão</th>
            <th style={{ ...th("center"), width: W[10] }}>Vencimento</th>
            <th style={{ ...th("left"),   width: W[11] }}>Nota</th>
          </tr>
        </thead>

        {/* tfoot prints at the bottom of the last page */}
        <tfoot className="pr-tfoot">
          <tr style={{ borderTop: "2px solid #000" }}>
            <td colSpan={3} style={{ ...td("left"), fontWeight: "bold", padding: "1px 3px" }}>
              TOTAL GERAL:
            </td>
            <td style={{ ...td("right"), fontWeight: "bold", padding: "1px 3px" }}>{fmtN(grandVencido)}</td>
            <td style={{ ...td("right"), fontWeight: "bold", padding: "1px 3px" }}>{fmtN(grandAVencer)}</td>
            <td></td>
            <td style={{ ...td("right"), fontWeight: "bold", padding: "1px 3px" }}>{fmtN(grandJuros)}</td>
            <td style={{ ...td("right"), fontWeight: "bold", padding: "1px 3px" }}>{fmtN(grandPago)}</td>
            <td style={{ ...td("right"), fontWeight: "bold", padding: "1px 3px" }}>{fmtN(grandSaldo)}</td>
            <td colSpan={3} style={{ ...td("right"), fontSize: "6.5pt", color: "#555", padding: "1px 3px" }}>
              {allDups.length} títulos · {clientGroups.length} clientes · Emitido: {now}
            </td>
          </tr>
        </tfoot>

        {/* One <tbody> per client — browser keeps each group on the same page */}
        {clientGroups.map(({ info, rows }) => {
          let clVencido = 0, clAVencer = 0, clJuros = 0, clPago = 0, clSaldo = 0;
          for (const r of rows) {
            if (r.status === "VENCIDO") clVencido += Number(r.valor_original) || 0;
            else clAVencer += Number(r.valor_original) || 0;
            clJuros += Number(r.valor_juros_pendente) || 0;
            clPago  += Number(r.valor_pago) || 0;
            clSaldo += Number(r.valor_aberto) || 0;
          }
          const locParts = [
            info.endereco_cobranca, info.bairro_cobranca,
            info.cidade_cobranca,   info.uf_cobranca,
          ].filter(Boolean);

          return (
            <tbody key={info.idclifor} className="pr-tbody">

              {/* Client info rows */}
              <tr style={{ borderTop: "1px solid #999" }}>
                <td colSpan={12} style={{ ...td("left"), fontWeight: "bold", paddingTop: "2px" }}>
                  Cliente: {info.idclifor} - {info.nomecliente}
                  {info.nomevendedor && (
                    <span style={{ fontWeight: "normal", marginLeft: "20px" }}>
                      Vendedor: {info.nomevendedor}
                    </span>
                  )}
                </td>
              </tr>
              {locParts.length > 0 && (
                <tr>
                  <td colSpan={12} style={{ ...td("left"), paddingBottom: "1px" }}>
                    Localização:{"\u00A0\u00A0"}{locParts.join("\u00A0\u00A0\u00A0")}
                  </td>
                </tr>
              )}

              {/* Title rows */}
              {rows.map((row: any) => {
                const isVencido = row.status === "VENCIDO";
                const valVencido = isVencido ? (Number(row.valor_original) || 0) : 0;
                const valAVencer = !isVencido ? (Number(row.valor_original) || 0) : 0;
                const nota  = row.numnota ?? "PRE";
                const serie = row.serienota ? ` - ${row.serienota}` : "";
                const titulo = `${row.idtitulo} - ${String(row.digitotitulo ?? "01").padStart(2, "0")}`;

                return (
                  <tr key={row.id}>
                    <td style={td("left")}>{nota}{serie}</td>
                    <td style={td("left")}>{titulo}</td>
                    <td style={td("center")}>{row.forma_recebimento ?? ""}</td>
                    <td style={td("right")}>{fmtN(valVencido)}</td>
                    <td style={td("right")}>{fmtN(valAVencer)}</td>
                    <td style={td("center")}>{row.dias_atraso > 0 ? row.dias_atraso : ""}</td>
                    <td style={td("right")}>{fmtN(Number(row.valor_juros_pendente) || 0)}</td>
                    <td style={td("right")}>{fmtN(Number(row.valor_pago) || 0)}</td>
                    <td style={td("right")}>{fmtN(Number(row.valor_aberto) || 0)}</td>
                    <td style={td("center")}>{fmtDate(row.dtmovimento)}</td>
                    <td style={td("center")}>{fmtDate(row.dtvencimento)}</td>
                    <td style={td("left", { fontSize: "6.5pt" })}>{row.numnota ?? ""}</td>
                  </tr>
                );
              })}

              {/* Per-client total row */}
              <tr style={{ borderTop: "1px solid #aaa", borderBottom: "1px solid #ccc" }}>
                <td colSpan={3} style={{ ...td("left"), fontWeight: "bold", paddingTop: "1px", paddingBottom: "2px" }}>
                  {"    "}Total do Cliente:
                </td>
                <td style={{ ...td("right"), fontWeight: "bold" }}>{fmtN(clVencido)}</td>
                <td style={{ ...td("right"), fontWeight: "bold" }}>{fmtN(clAVencer)}</td>
                <td></td>
                <td style={{ ...td("right"), fontWeight: "bold" }}>{fmtN(clJuros)}</td>
                <td style={{ ...td("right"), fontWeight: "bold" }}>{fmtN(clPago)}</td>
                <td style={{ ...td("right"), fontWeight: "bold" }}>{fmtN(clSaldo)}</td>
                <td colSpan={3}></td>
              </tr>

            </tbody>
          );
        })}

      </table>

      {allDups.length === 0 && (
        <div style={{ ...base, textAlign: "center", padding: "20px" }}>
          Nenhum título encontrado com os filtros aplicados.
        </div>
      )}

    </div>
  );
}

// ============================================================================
// Pagination
// ============================================================================

function Pagination({
  page, pages, total, onPage, perPage, onPerPage,
}: {
  page: number; pages: number; total: number;
  onPage: (p: number) => void;
  perPage?: number; onPerPage?: (n: number) => void;
}) {
  const pp = perPage ?? 25;
  const from = total === 0 ? 0 : (page - 1) * pp + 1;
  const to = Math.min(page * pp, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 print:hidden">
      <p className="text-xs text-muted-foreground">
        {total === 0
          ? "Nenhum registro"
          : `Exibindo ${from}–${to} de ${total} registro${total !== 1 ? "s" : ""}`}
      </p>
      <div className="flex items-center gap-3">
        {onPerPage && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Por página:</span>
            <select
              value={perPage}
              onChange={e => { onPerPage(Number(e.target.value)); onPage(1); }}
              className="h-7 text-xs border border-input rounded-md bg-background px-2 cursor-pointer"
            >
              {[10, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="sm"
            onClick={() => onPage(1)} disabled={page === 1}
            className="h-7 w-7 p-0" title="Primeira página"
          >
            <ChevronLeft className="h-3 w-3" style={{ marginRight: "-4px" }} />
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page === 1} className="h-7 w-7 p-0" title="Página anterior">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground px-2 whitespace-nowrap">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages} className="h-7 w-7 p-0" title="Próxima página">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => onPage(pages)} disabled={page >= pages}
            className="h-7 w-7 p-0" title="Última página"
          >
            <ChevronRight className="h-3 w-3" style={{ marginLeft: "-4px" }} />
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
