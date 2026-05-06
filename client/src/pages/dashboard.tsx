import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw, CalendarDays, Download, DollarSign, Receipt, Package, GripVertical, ChevronDown, Check, Calendar, RotateCcw, AlertCircle, SlidersHorizontal, Users } from "lucide-react";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import { GroupSelector, type VendorGroup } from "@/components/dashboard/group-selector";
import { HelpButton, HelpDrawer, HELP_CONTENT } from "@/components/help";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KPICard } from "@/components/dashboard/kpi-card";
import { CompanySelector } from "@/components/dashboard/company-selector";
import { RankingTable } from "@/components/dashboard/ranking-table";
import { ProductMixChart } from "@/components/dashboard/product-mix-chart";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { GoalsCard } from "@/components/dashboard/goals-card";
import { AFaturarVendedores } from "@/components/dashboard/afaturar-vendedores";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getClosedMonthPeriod, getCurrentWeekPeriod, getCurrentMonthPeriod, formatDateBR } from "@/lib/calendar-utils";
import type { DatePeriod, RankingCriteria, Company, KPISummary, SalespersonRanking, ProductMix, AlertNotification, GoalWithProgress, SalesEvolutionData, SalespersonAFaturar } from "@shared/schema";

function DragHandle({ id, attributes, listeners }: { id: string; attributes: any; listeners: any }) {
  return (
    <button
      {...attributes}
      {...listeners}
      className="p-1 rounded-md hover:bg-muted cursor-grab active:cursor-grabbing transition-colors touch-manipulation"
      data-testid={`drag-handle-${id}`}
      aria-label="Arrastar para reorganizar"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function SortableItem({ id, children, className }: { id: string; children: (dragHandle: React.ReactNode) => React.ReactNode; className?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragHandle = <DragHandle id={id} attributes={attributes} listeners={listeners} />;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-50 opacity-90", className)}
      data-testid={`draggable-card-${id}`}
    >
      {children(dragHandle)}
    </div>
  );
}

type DashboardPeriodMode = "semana" | "mes" | "fechado" | "custom";

interface DashboardSavedFilters {
  companyId?: string;
  rankingCriteria?: RankingCriteria;
  periodMode?: DashboardPeriodMode;
  selectedGroupId?: string | null;
  customStart?: string;
  customEnd?: string;
}

const DASHBOARD_FILTERS_KEY = "sales_dashboard_filters_v1";
const LIVE_REFETCH_INTERVAL_MS = 60_000;

function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function readSavedFilters(): DashboardSavedFilters {
  try {
    const raw = localStorage.getItem(DASHBOARD_FILTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DashboardSavedFilters;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeSavedCompanyId(value: unknown): string {
  if (value === "all") return "all";
  return typeof value === "string" && /^\d+$/.test(value) && Number(value) > 0 ? String(Number(value)) : "all";
}

function normalizeRankingCriteria(value: unknown): RankingCriteria {
  return value === "maior_valor_vendido"
    || value === "maior_positivacao"
    || value === "maior_mix_produtos"
    || value === "conexoes_sobre_tubos"
    ? value
    : "maior_valor_vendido";
}

function normalizePeriodMode(value: unknown): DashboardPeriodMode {
  return value === "semana" || value === "mes" || value === "fechado" || value === "custom" ? value : "semana";
}

import { useAuth } from "@/lib/auth-context";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const savedFilters = useMemo(() => readSavedFilters(), []);

  const today = new Date();
  const [helpOpen, setHelpOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string>(() => normalizeSavedCompanyId(savedFilters.companyId));
  const [rankingCriteria, setRankingCriteria] = useState<RankingCriteria>(() => normalizeRankingCriteria(savedFilters.rankingCriteria));
  const [isScrolled, setIsScrolled] = useState(false);
  const [periodMode, setPeriodMode] = useState<DashboardPeriodMode>(() => normalizePeriodMode(savedFilters.periodMode));
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(savedFilters.selectedGroupId ?? null);
  const [periodOpen, setPeriodOpen] = useState(false);

  // Custom date range state
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return isDateString(savedFilters.customStart) ? savedFilters.customStart : d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => isDateString(savedFilters.customEnd) ? savedFilters.customEnd : new Date().toISOString().slice(0, 10));
  const [customDraft, setCustomDraft] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify({
        companyId,
        rankingCriteria,
        periodMode,
        selectedGroupId,
        customStart,
        customEnd,
      }));
    } catch {}
  }, [companyId, rankingCriteria, periodMode, selectedGroupId, customStart, customEnd]);

  const currentWeek = getCurrentWeekPeriod();
  const monthPeriod = useMemo(() => getCurrentMonthPeriod(), [today.getMonth(), today.getFullYear()]);

  const closedMonth = useMemo(() => {
    return getClosedMonthPeriod(today.getFullYear(), today.getMonth() + 1);
  }, [today.getFullYear(), today.getMonth()]);

  const period: DatePeriod = useMemo(() => {
    if (periodMode === "fechado") {
      return {
        startDate: closedMonth.periodStart,
        endDate: closedMonth.periodEnd,
        mode: { type: "fechado_semanas" as const },
      };
    }
    if (periodMode === "mes") {
      return {
        startDate: monthPeriod.startDate,
        endDate: monthPeriod.endDate,
        mode: { type: "livre" as const },
      };
    }
    if (periodMode === "custom") {
      return {
        startDate: customStart,
        endDate: customEnd,
        mode: { type: "livre" as const },
      };
    }
    return {
      startDate: currentWeek.startDate,
      endDate: currentWeek.endDate,
      mode: { type: "livre" as const },
    };
  }, [periodMode, closedMonth, currentWeek, monthPeriod, customStart, customEnd]);

  function gUrl(base: string): string {
    return selectedGroupId ? `${base}?groupId=${encodeURIComponent(selectedGroupId)}` : base;
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setIsScrolled(scrollTop > 50);
  };

  const { layout, updateKpiOrder, updateSidebarOrder, updateBottomOrder, updateMainOrder, resetLayout } = useDashboardLayout();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    refetchInterval: LIVE_REFETCH_INTERVAL_MS,
  });

  const { data: groups = [] } = useQuery<VendorGroup[]>({
    queryKey: ["/api/vendor-groups"],
    enabled: user?.role === "admin" || user?.role === "supervisor",
    refetchInterval: LIVE_REFETCH_INTERVAL_MS,
  });

  const { data: kpis, isLoading: kpisLoading, isError: kpisError, error: kpisErrorObj } = useQuery<KPISummary>({
    queryKey: [gUrl(`/api/kpis/${companyId}/${period.startDate}/${period.endDate}`)],
    refetchInterval: LIVE_REFETCH_INTERVAL_MS,
  });

  const { data: rankings = [], isLoading: rankingsLoading, isError: rankingsError } = useQuery<SalespersonRanking[]>({
    queryKey: [gUrl(`/api/rankings/${companyId}/${period.startDate}/${period.endDate}/${rankingCriteria}`)],
    refetchInterval: LIVE_REFETCH_INTERVAL_MS,
  });

  const { data: productMix = [], isLoading: productMixLoading, isError: productMixError } = useQuery<ProductMix[]>({
    queryKey: [gUrl(`/api/product-mix/${companyId}/${period.startDate}/${period.endDate}`)],
    refetchInterval: LIVE_REFETCH_INTERVAL_MS,
  });

  const { data: alerts = [], isLoading: alertsLoading, isError: alertsError } = useQuery<AlertNotification[]>({
    queryKey: [gUrl(`/api/alerts/${companyId}`)],
    refetchInterval: LIVE_REFETCH_INTERVAL_MS,
  });

  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const { data: goals = [], isLoading: goalsLoading, isError: goalsError } = useQuery<GoalWithProgress[]>({
    queryKey: [gUrl(`/api/goals/${companyId}/${currentMonth}/${currentYear}`)],
    refetchInterval: LIVE_REFETCH_INTERVAL_MS,
  });

  const { data: salesData, isLoading: salesLoading, isError: salesError } = useQuery<SalesEvolutionData>({
    queryKey: [gUrl(`/api/sales-evolution/${companyId}`)],
    refetchInterval: LIVE_REFETCH_INTERVAL_MS,
  });

  const { data: aFaturarData = [], isLoading: aFaturarLoading, isError: aFaturarError } = useQuery<SalespersonAFaturar[]>({
    queryKey: [gUrl(`/api/afaturar-vendedores/${companyId}`)],
    refetchInterval: LIVE_REFETCH_INTERVAL_MS,
  });

  const isLoading = companiesLoading || kpisLoading;
  const hasDashboardError = kpisError || rankingsError || productMixError || alertsError || goalsError || salesError || aFaturarError;

  function handleExport() {
    const now = new Date();
    const periodLabel =
      periodMode === "semana" ? "Semana Atual" :
      periodMode === "mes" ? "Mês Atual" :
      periodMode === "fechado" ? "Semanas Fechadas" : "Período Personalizado";

    const fmt = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
    const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
    const row = (cols: (string | number)[]) =>
      cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";");

    const lines: string[] = [];

    // ── Cabeçalho ──────────────────────────────────────────────
    lines.push(row(["CONECTUBOS — Relatório do Dashboard"]));
    lines.push(row(["Exportado em", format(now, "dd/MM/yyyy HH:mm", { locale: ptBR })]));
    lines.push(row(["Período", periodLabel]));
    lines.push(row(["De", formatDateBR(period.startDate), "Até", formatDateBR(period.endDate)]));
    lines.push(row(["Empresa", companyId === "all" ? "Todas" : (companies.find(c => String(c.id) === companyId)?.name ?? companyId)]));
    lines.push("");

    // ── KPIs ──────────────────────────────────────────────────
    lines.push(row(["=== KPIs DO PERÍODO ==="]));
    lines.push(row(["Indicador", "Valor"]));
    if (kpis) {
      lines.push(row([periodoCardTitle, fmt(kpis.totalVendasSemanal)]));
      lines.push(row(["Mês Atual", fmt(kpis.totalVendasMensal)]));
      lines.push(row(["A Faturar Total", fmt(kpis.valorAFaturar)]));
      lines.push(row(["Pedidos em aberto", kpis.pedidosAtendidos]));
    }
    lines.push("");

    // ── Ranking de Vendedores ──────────────────────────────────
    lines.push(row(["=== RANKING DE VENDEDORES ==="]));
    lines.push(row(["Posição", "Vendedor", "Empresa", "Valor Vendido", "Variação YoY", "Pedidos", "Produtos distintos", "Conexões/Tubos"]));
    for (const r of rankings) {
      lines.push(row([
        r.rank,
        r.salesperson.name,
        r.salesperson.companyId ?? "",
        fmt(r.value),
        r.yoyVariacao != null ? pct(r.yoyVariacao) : "-",
        r.positivacao,
        r.mixProdutos,
        r.conexoesSobreTubos != null ? pct(r.conexoesSobreTubos) : "-",
      ]));
    }
    lines.push("");

    // ── A Faturar por Vendedor ────────────────────────────────
    if (aFaturarData.length > 0) {
      lines.push(row(["=== A FATURAR POR VENDEDOR ==="]));
      lines.push(row(["Vendedor", "Empresa", "Valor a Faturar"]));
      for (const a of aFaturarData) {
        lines.push(row([
          a.salesperson.name,
          a.salesperson.companyId ?? "",
          fmt(a.valorAFaturar),
        ]));
      }
      lines.push("");
    }

    // ── Mix por fabricante ─────────────────────────────────────
    if (productMix.length > 0) {
      lines.push(row(["=== MIX POR FABRICANTE ==="]));
      lines.push(row(["Fabricante", "Valor Total", "Quantidade", "Participação (%)"]));
      for (const p of productMix) {
        lines.push(row([
          p.product.name,
          fmt(p.totalValue),
          p.quantity,
          `${p.percentage.toFixed(1)}%`,
        ]));
      }
      lines.push("");
    }

    // ── Metas ─────────────────────────────────────────────────
    if (goals.length > 0) {
      lines.push(row(["=== METAS DO MÊS ==="]));
      lines.push(row(["Vendedor", "Tipo", "Meta", "Realizado", "Progresso (%)"]));
      for (const g of goals) {
        lines.push(row([
          g.salespersonName,
          g.type === "weekly" ? "Semanal" : "Mensal",
          fmt(g.targetValue),
          fmt(g.currentValue),
          `${g.progress.toFixed(1)}%`,
        ]));
      }
      lines.push("");
    }

    // ── Trigger download ──────────────────────────────────────
    const bom = "\uFEFF"; // UTF-8 BOM para abrir corretamente no Excel
    const csvContent = bom + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conectubos-dashboard-${format(now, "yyyy-MM-dd-HHmm")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "Relatório exportado!", description: "Arquivo CSV gerado com sucesso." });
  }

  function handleKpiDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = layout.kpiCards.indexOf(active.id as string);
      const newIndex = layout.kpiCards.indexOf(over.id as string);
      updateKpiOrder(arrayMove(layout.kpiCards, oldIndex, newIndex));
    }
  }

  function handleSidebarDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = layout.sidebarCards.indexOf(active.id as string);
      const newIndex = layout.sidebarCards.indexOf(over.id as string);
      updateSidebarOrder(arrayMove(layout.sidebarCards, oldIndex, newIndex));
    }
  }

  function handleBottomDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = layout.bottomCards.indexOf(active.id as string);
      const newIndex = layout.bottomCards.indexOf(over.id as string);
      updateBottomOrder(arrayMove(layout.bottomCards, oldIndex, newIndex));
    }
  }

  function handleMainDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = layout.mainCards.indexOf(active.id as string);
      const newIndex = layout.mainCards.indexOf(over.id as string);
      updateMainOrder(arrayMove(layout.mainCards, oldIndex, newIndex));
    }
  }

  // Derive sparkline data and YoY change from evolution data
  const weeklySparkline = useMemo(() =>
    (salesData?.weekly ?? []).slice(-10).map(w => w.atual),
    [salesData?.weekly]
  );
  const monthlySparkline = useMemo(() =>
    (salesData?.monthly ?? []).slice(-8).map(m => m.atual),
    [salesData?.monthly]
  );
  const weeklyVariacao = useMemo<number | null>(() => {
    const last = salesData?.weekly?.at(-1);
    return last != null ? last.variacao : null;
  }, [salesData?.weekly]);
  const monthlyVariacao = useMemo<number | null>(() => {
    const last = salesData?.monthly?.at(-1);
    return last != null ? last.variacao : null;
  }, [salesData?.monthly]);

  const periodoCardTitle = periodMode === "semana"
    ? "Vendas da Semana"
    : periodMode === "mes"
    ? "Vendas do Mês"
    : periodMode === "fechado"
    ? "Período Fechado"
    : "Vendas do Período";

  const periodoCardSubtitle = periodMode === "semana"
    ? "semana selecionada"
    : periodMode === "mes"
    ? "mês selecionado"
    : periodMode === "fechado"
    ? "semanas fechadas"
    : `${period.startDate} — ${period.endDate}`;

  const renderKpiCard = (id: string, dragHandle: React.ReactNode) => {
    switch (id) {
      case "vendas-semanal":
        return (
          <KPICard
            title={periodoCardTitle}
            value={kpisError ? "Erro" : kpis?.totalVendasSemanal ?? 0}
            format="currency"
            icon={DollarSign}
            loading={isLoading}
            subtitle={kpisError ? "falha ao carregar KPI" : periodoCardSubtitle}
            yoyChange={kpisError ? null : weeklyVariacao}
            dragHandle={dragHandle}
            sparklineData={weeklySparkline}
            sparklineId="spark-semanal"
          />
        );
      case "vendas-mensal":
        return (
          <KPICard
            title="Mês Atual"
            value={kpisError ? "Erro" : kpis?.totalVendasMensal ?? 0}
            format="currency"
            icon={Receipt}
            loading={isLoading}
            subtitle="acumulado do mês corrente"
            yoyChange={kpisError ? null : kpis?.yoyMesAtual ?? null}
            dragHandle={dragHandle}
            sparklineData={monthlySparkline}
            sparklineId="spark-mensal"
          />
        );
      case "afaturar-total":
        return (
          <KPICard
            title="A Faturar Total"
            value={kpisError ? "Erro" : kpis?.valorAFaturar ?? 0}
            format="currency"
            icon={Package}
            loading={isLoading}
            subtitle="Pedidos em aberto"
            dragHandle={dragHandle}
            iconBg="bg-amber-50 dark:bg-amber-900/20"
            iconColor="text-amber-600 dark:text-amber-400"
          />
        );
      default:
        return null;
    }
  };

  const renderSidebarCard = (id: string, dragHandle: React.ReactNode) => {
    switch (id) {
      case "afaturar-vendedores":
        return <AFaturarVendedores data={aFaturarData} loading={aFaturarLoading} dragHandle={dragHandle} />;
      case "goals":
        return <GoalsCard goals={goals} loading={goalsLoading} dragHandle={dragHandle} />;
      case "alerts":
        return <AlertsPanel alerts={alerts} loading={alertsLoading} dragHandle={dragHandle} />;
      default:
        return null;
    }
  };

  const renderBottomCard = (id: string, dragHandle: React.ReactNode) => {
    switch (id) {
      case "ranking":
        return (
          <RankingTable
            rankings={rankings}
            criteria={rankingCriteria}
            onCriteriaChange={setRankingCriteria}
            loading={rankingsLoading}
            dragHandle={dragHandle}
          />
        );
      case "product-mix":
        return <ProductMixChart data={productMix} loading={productMixLoading} dragHandle={dragHandle} />;
      default:
        return null;
    }
  };

  const renderMainCard = (id: string, dragHandle: React.ReactNode) => {
    switch (id) {
      case "sales-chart":
        return (
          <SalesChart
            weeklyData={salesData?.weekly ?? []}
            monthlyData={salesData?.monthly ?? []}
            loading={salesLoading}
            dragHandle={dragHandle}
          />
        );
      default:
        return null;
    }
  };

  const activeFiltersCount = [
    companyId !== "1" && companyId !== "all",
    selectedGroupId !== null,
    periodMode !== "semana",
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Left: title + date info */}
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <HelpButton onClick={() => setHelpOpen(true)} />
            <span className="hidden sm:inline text-xs text-muted-foreground font-medium">
              {format(today, "d 'de' MMMM", { locale: ptBR })}
            </span>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2">
            {/* Mobile: Filtros button */}
            <Button
              variant={activeFiltersCount > 0 ? "secondary" : "outline"}
              size="sm"
              className="sm:hidden h-8 gap-1.5 text-xs"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => queryClient.invalidateQueries()}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hidden sm:flex"
              data-testid="button-refresh-data"
              title="Atualizar dados"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={resetLayout}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hidden sm:flex"
              data-testid="button-reset-layout"
              title="Restaurar layout"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hidden sm:flex"
              data-testid="button-export-csv"
              title="Exportar relatório CSV"
              disabled={isLoading}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>

            <div className="hidden sm:flex items-center gap-2">
              <CompanySelector
                companies={companies}
                selectedId={companyId}
                onChange={setCompanyId}
                loading={companiesLoading}
                compact={false}
              />

              <GroupSelector
                groups={groups}
                selectedGroupId={selectedGroupId}
                onChange={setSelectedGroupId}
              />
            </div>

            <Popover open={periodOpen} onOpenChange={open => {
              setPeriodOpen(open);
              if (open) {
                setCustomDraft({
                  from: customStart ? new Date(customStart + "T00:00:00") : undefined,
                  to: customEnd ? new Date(customEnd + "T00:00:00") : undefined,
                });
              }
            }}>
              <PopoverTrigger asChild>
                <Button
                  variant={periodMode !== "semana" ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 text-xs font-medium rounded-lg"
                  data-testid="period-selector"
                >
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {periodMode === "semana"  && `Semana · ${formatDateBR(currentWeek.startDate).slice(0, 5)}–${formatDateBR(currentWeek.endDate).slice(0, 5)}`}
                    {periodMode === "mes"     && `Mês · ${monthPeriod.label}`}
                    {periodMode === "fechado" && `Fechado · ${formatDateBR(closedMonth.periodStart).slice(0, 5)}–${formatDateBR(closedMonth.periodEnd).slice(0, 5)}`}
                    {periodMode === "custom"  && `${formatDateBR(customStart).slice(0, 5)}–${formatDateBR(customEnd).slice(0, 5)}`}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0" sideOffset={6}>
                {/* ── Presets ── */}
                <div className="p-2 space-y-0.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">Períodos rápidos</p>
                  {([
                    {
                      key: "semana" as const,
                      label: "Semana Atual",
                      sub: `${formatDateBR(currentWeek.startDate)} – ${formatDateBR(currentWeek.endDate)}`,
                    },
                    {
                      key: "mes" as const,
                      label: "Mês Atual",
                      sub: `${formatDateBR(monthPeriod.startDate)} – ${formatDateBR(monthPeriod.endDate)}`,
                    },
                    {
                      key: "fechado" as const,
                      label: "Semanas Fechadas",
                      sub: `${formatDateBR(closedMonth.periodStart)} – ${formatDateBR(closedMonth.periodEnd)}`,
                    },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted transition-colors",
                        periodMode === opt.key && "bg-primary/8 text-primary"
                      )}
                      onClick={() => {
                        setPeriodMode(opt.key);
                        setPeriodOpen(false);
                      }}
                    >
                      <Check className={cn("h-3.5 w-3.5 shrink-0", periodMode === opt.key ? "opacity-100 text-primary" : "opacity-0")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{opt.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <Separator />

                {/* ── Custom Range ── */}
                <div className="p-2 space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Período personalizado</p>
                  </div>
                  {customDraft?.from && (
                    <p className="text-[11px] text-center text-muted-foreground px-1">
                      {customDraft.from.toLocaleDateString("pt-BR")}
                      {customDraft.to ? ` – ${customDraft.to.toLocaleDateString("pt-BR")}` : " → selecione o fim"}
                    </p>
                  )}
                  <CalendarPicker
                    mode="range"
                    selected={customDraft}
                    onSelect={setCustomDraft}
                    locale={ptBR}
                    className="rounded-md p-0"
                    numberOfMonths={1}
                    disabled={{ after: new Date() }}
                    classNames={{
                      months: "flex flex-col",
                      caption_label: "text-xs font-medium",
                      head_cell: "text-muted-foreground w-8 font-normal text-[0.7rem]",
                      cell: "h-8 w-8 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 text-xs",
                    }}
                  />
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    disabled={!customDraft?.from || !customDraft?.to}
                    onClick={() => {
                      if (!customDraft?.from || !customDraft?.to) return;
                      const from = customDraft.from <= customDraft.to ? customDraft.from : customDraft.to;
                      const to = customDraft.from <= customDraft.to ? customDraft.to : customDraft.from;
                      const start = from.toISOString().slice(0, 10);
                      const end = to.toISOString().slice(0, 10);
                      setCustomStart(start);
                      setCustomEnd(end);
                      setPeriodMode("custom");
                      setPeriodOpen(false);
                      toast({
                        title: "Período personalizado aplicado",
                        description: `${formatDateBR(start)} até ${formatDateBR(end)}`,
                      });
                    }}
                  >
                    Aplicar período
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium rounded-lg hidden sm:flex"
              onClick={handleExport}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      {/* ── Mobile Filters Sheet ──────────────────────────────── */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-xl pb-8 max-h-[90dvh] overflow-y-auto">
          <SheetHeader className="pb-4 border-b mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              Filtros
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-5">
            {/* Empresa */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</p>
              <CompanySelector
                companies={companies}
                selectedId={companyId}
                onChange={v => { setCompanyId(v); }}
                loading={companiesLoading}
              />
            </div>

            {/* Grupo */}
            {groups.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grupo</p>
                <Select
                  value={selectedGroupId ?? "all"}
                  onValueChange={v => setSelectedGroupId(v === "all" ? null : v)}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground mr-1 shrink-0" />
                    <SelectValue placeholder="Grupo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os grupos</SelectItem>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Período */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Período</p>
              <div className="space-y-1.5">
                {([
                  { key: "semana" as const, label: "Semana Atual", sub: `${formatDateBR(currentWeek.startDate)} – ${formatDateBR(currentWeek.endDate)}` },
                  { key: "mes" as const, label: "Mês Atual", sub: `${formatDateBR(monthPeriod.startDate)} – ${formatDateBR(monthPeriod.endDate)}` },
                  { key: "fechado" as const, label: "Semanas Fechadas", sub: `${formatDateBR(closedMonth.periodStart)} – ${formatDateBR(closedMonth.periodEnd)}` },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left border transition-colors",
                      periodMode === opt.key
                        ? "bg-primary/8 border-primary/30 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                    onClick={() => { setPeriodMode(opt.key); setFiltersOpen(false); }}
                  >
                    <Check className={cn("h-4 w-4 shrink-0", periodMode === opt.key ? "opacity-100 text-primary" : "opacity-0")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom date range */}
              <div className="pt-2 space-y-2 border-t mt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Período personalizado
                </p>
                {customDraft?.from && (
                  <p className="text-xs text-center text-muted-foreground">
                    {customDraft.from.toLocaleDateString("pt-BR")}
                    {customDraft.to ? ` – ${customDraft.to.toLocaleDateString("pt-BR")}` : " → selecione o fim"}
                  </p>
                )}
                <CalendarPicker
                  mode="range"
                  selected={customDraft}
                  onSelect={setCustomDraft}
                  locale={ptBR}
                  className="rounded-md p-0 w-full"
                  numberOfMonths={1}
                  disabled={{ after: new Date() }}
                  classNames={{
                    months: "flex flex-col",
                    caption_label: "text-xs font-medium",
                    head_cell: "text-muted-foreground w-8 font-normal text-[0.7rem]",
                    cell: "h-8 w-8 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                    day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 text-xs",
                  }}
                />
                <Button
                  size="sm"
                  className="w-full h-9 text-sm"
                  disabled={!customDraft?.from || !customDraft?.to}
                  onClick={() => {
                    if (!customDraft?.from || !customDraft?.to) return;
                    const from = customDraft.from <= customDraft.to ? customDraft.from : customDraft.to;
                    const to = customDraft.from <= customDraft.to ? customDraft.to : customDraft.from;
                    const start = from.toISOString().slice(0, 10);
                    const end = to.toISOString().slice(0, 10);
                    setCustomStart(start);
                    setCustomEnd(end);
                    setPeriodMode("custom");
                    setFiltersOpen(false);
                    toast({
                      title: "Período personalizado aplicado",
                      description: `${formatDateBR(start)} até ${formatDateBR(end)}`,
                    });
                  }}
                >
                  Aplicar período personalizado
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {hasDashboardError && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Falha ao carregar dados reais do dashboard.</p>
              <p className="text-xs opacity-80">
                {kpisErrorObj instanceof Error ? kpisErrorObj.message : "Atualize a pagina ou ajuste os filtros."}
              </p>
            </div>
          </div>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleKpiDragEnd}
        >
          <SortableContext items={layout.kpiCards} strategy={horizontalListSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {layout.kpiCards.map((id) => (
                <SortableItem key={id} id={id}>
                  {(dragHandle) => renderKpiCard(id, dragHandle)}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleMainDragEnd}
          >
            <SortableContext items={layout.mainCards} strategy={verticalListSortingStrategy}>
              <div className="lg:col-span-2">
                {layout.mainCards.map((id) => (
                  <SortableItem key={id} id={id}>
                    {(dragHandle) => renderMainCard(id, dragHandle)}
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSidebarDragEnd}
          >
            <SortableContext items={layout.sidebarCards} strategy={verticalListSortingStrategy}>
              <div className="space-y-6">
                {layout.sidebarCards.map((id) => (
                  <SortableItem key={id} id={id}>
                    {(dragHandle) => renderSidebarCard(id, dragHandle)}
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleBottomDragEnd}
        >
          <SortableContext items={layout.bottomCards} strategy={horizontalListSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {layout.bottomCards.map((id) => (
                <SortableItem key={id} id={id}>
                  {(dragHandle) => renderBottomCard(id, dragHandle)}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.dashboard} />
    </div>
  );
}
