import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { RefreshCw, Calendar, Download, DollarSign, Receipt, Package, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GroupSelector, type VendorGroup } from "@/components/dashboard/group-selector";
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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getClosedMonthPeriod, getCurrentWeekPeriod, formatDateBR } from "@/lib/calendar-utils";
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

import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Redirect Gestor to Visão em Loja
  if (user?.role === "gerente") {
    setLocation("/analises/visao-em-loja");
    return null;
  }

  const today = new Date();
  const [companyId, setCompanyId] = useState<string>("all");
  const [rankingCriteria, setRankingCriteria] = useState<RankingCriteria>("maior_valor_vendido");
  const [isScrolled, setIsScrolled] = useState(false);
  const [useSemanaFechada, setUseSemanaFechada] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const currentWeek = getCurrentWeekPeriod();

  const closedMonth = useMemo(() => {
    return getClosedMonthPeriod(today.getFullYear(), today.getMonth() + 1);
  }, [today.getFullYear(), today.getMonth()]);

  const period: DatePeriod = useMemo(() => {
    if (useSemanaFechada) {
      return {
        startDate: closedMonth.periodStart,
        endDate: closedMonth.periodEnd,
        mode: { type: "fechado_semanas" as const },
      };
    }
    return {
      startDate: currentWeek.startDate,
      endDate: currentWeek.endDate,
      mode: { type: "livre" as const },
    };
  }, [useSemanaFechada, closedMonth, currentWeek]);

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
  });

  const { data: groups = [] } = useQuery<VendorGroup[]>({
    queryKey: ["/api/vendor-groups"],
    enabled: user?.role === "admin" || user?.role === "supervisor",
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery<KPISummary>({
    queryKey: [gUrl(`/api/kpis/${companyId}/${period.startDate}/${period.endDate}`)],
  });

  const { data: rankings = [], isLoading: rankingsLoading } = useQuery<SalespersonRanking[]>({
    queryKey: [gUrl(`/api/rankings/${companyId}/${period.startDate}/${period.endDate}/${rankingCriteria}`)],
  });

  const { data: productMix = [], isLoading: productMixLoading } = useQuery<ProductMix[]>({
    queryKey: [gUrl(`/api/product-mix/${companyId}/${period.startDate}/${period.endDate}`)],
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<AlertNotification[]>({
    queryKey: [gUrl(`/api/alerts/${companyId}`)],
    refetchInterval: 60 * 1000,
  });

  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const { data: goals = [], isLoading: goalsLoading } = useQuery<GoalWithProgress[]>({
    queryKey: [gUrl(`/api/goals/${companyId}/${currentMonth}/${currentYear}`)],
  });

  const { data: salesData, isLoading: salesLoading } = useQuery<SalesEvolutionData>({
    queryKey: [gUrl(`/api/sales-evolution/${companyId}`)],
  });

  const { data: aFaturarData = [], isLoading: aFaturarLoading } = useQuery<SalespersonAFaturar[]>({
    queryKey: [gUrl(`/api/afaturar-vendedores/${companyId}`)],
  });

  const isLoading = companiesLoading || kpisLoading;

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

  const renderKpiCard = (id: string, dragHandle: React.ReactNode) => {
    switch (id) {
      case "vendas-semanal":
        return (
          <KPICard
            title="Vendas Semanal"
            value={kpis?.totalVendasSemanal ?? 0}
            format="currency"
            icon={DollarSign}
            loading={isLoading}
            subtitle="vs semana anterior"
            yoyChange={weeklyVariacao}
            dragHandle={dragHandle}
            sparklineData={weeklySparkline}
            sparklineId="spark-semanal"
          />
        );
      case "vendas-mensal":
        return (
          <KPICard
            title="Vendas Mensal"
            value={kpis?.totalVendasMensal ?? 0}
            format="currency"
            icon={Receipt}
            loading={isLoading}
            subtitle="vs mês anterior"
            yoyChange={monthlyVariacao}
            dragHandle={dragHandle}
            sparklineData={monthlySparkline}
            sparklineId="spark-mensal"
          />
        );
      case "afaturar-total":
        return (
          <KPICard
            title="A Faturar Total"
            value={kpis?.valorAFaturar ?? 0}
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Page header ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          {/* Left: title + date info */}
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <span className="hidden sm:inline text-xs text-muted-foreground font-medium">
              {format(today, "d 'de' MMMM", { locale: ptBR })}
            </span>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { resetLayout(); queryClient.invalidateQueries(); }}
              className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hidden sm:flex"
              data-testid="button-refresh-data"
              title="Atualizar dados"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

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

            <Button
              variant={useSemanaFechada ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                const next = !useSemanaFechada;
                setUseSemanaFechada(next);
                if (next) {
                  toast({
                    title: "Período alterado: Semanas Fechadas",
                    description: `${formatDateBR(closedMonth.periodStart)} até ${formatDateBR(closedMonth.periodEnd)}`,
                  });
                } else {
                  toast({
                    title: "Período alterado: Semana Atual",
                    description: `${formatDateBR(currentWeek.startDate)} até ${formatDateBR(currentWeek.endDate)}`,
                  });
                }
              }}
              className="h-auto gap-1.5 px-2.5 py-1 rounded-lg flex-col items-start min-w-[110px] sm:min-w-[120px]"
              data-testid="toggle-semana-fechada"
              title={useSemanaFechada ? "Clique para ver a semana atual" : "Clique para ver as semanas fechadas do mês"}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium w-full">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                {useSemanaFechada ? "S. Fechadas" : "Semana Atual"}
              </span>
              <span className="text-[10px] font-normal text-muted-foreground leading-none pl-5">
                {useSemanaFechada
                  ? `${formatDateBR(closedMonth.periodStart).slice(0, 5)} – ${formatDateBR(closedMonth.periodEnd).slice(0, 5)}`
                  : `${formatDateBR(currentWeek.startDate).slice(0, 5)} – ${formatDateBR(currentWeek.endDate).slice(0, 5)}`
                }
              </span>
            </Button>

            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium rounded-lg hidden sm:flex"
              onClick={() => queryClient.invalidateQueries()}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      <div onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
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
    </div>
  );
}
