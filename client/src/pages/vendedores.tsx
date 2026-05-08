import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth-context";
import { HelpButton, HelpDrawer, HELP_CONTENT } from "@/components/help";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GroupSelector } from "@/components/dashboard/group-selector";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { CompanySelector } from "@/components/dashboard/company-selector";
import { SalespersonCard, type FinancialSummary } from "@/components/dashboard/salesperson-card";
import { Search, SlidersHorizontal } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import type { DatePeriod, Company, SalespersonWithStats } from "@shared/schema";

interface VendorGroup {
  id: string;
  name: string;
  members: string[];
}

function normalizeVendorId(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeVendorName(value: unknown): string {
  return String(value ?? "").trim();
}

export default function Vendedores() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";

  const today = new Date();
  const [period, setPeriod] = useState<DatePeriod>({
    startDate: format(startOfMonth(today), "yyyy-MM-dd"),
    endDate: format(endOfMonth(today), "yyyy-MM-dd"),
    mode: { type: "livre" },
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string>("1");
  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  useEffect(() => {
    if (companies.length > 0 && !companies.find(c => c.id === companyId)) {
      setCompanyId(companies[0].id);
    }
  }, [companies, companyId]);

  const { data: salespersons = [], isLoading: salespersonsLoading } = useQuery<SalespersonWithStats[]>({
    queryKey: ["/api/salespersons", companyId, period.startDate, period.endDate],
    queryFn: async () => {
      const token = getAuthToken();
      const url = `/api/salespersons/${encodeURIComponent(companyId)}/${period.startDate}/${period.endDate}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Erro ao buscar vendedores");
      return res.json();
    },
  });

  const { data: groups = [] } = useQuery<VendorGroup[]>({
    queryKey: ["/api/vendor-groups"],
    enabled: isAdmin || isSupervisor,
  });

  const { data: settingMovimt } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/app-settings/showMovimentacoesButton"],
    enabled: isSupervisor,
  });

  const { data: settingFinanceiroPendencias } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/app-settings/showFinanceiroPendenciasButton"],
    enabled: isSupervisor,
  });

  const hasFinanceiroModulePermission = user?.modulePermissions?.Financeiro !== false;
  const canSeeFinanceiro = isAdmin
    || (isSupervisor && hasFinanceiroModulePermission && settingFinanceiroPendencias?.value === "true");

  const { data: financialVendedores, error: financialError } = useQuery<{ data: FinancialSummary[] }>({
    queryKey: ["/api/financeiro/contas-receber/vendedores", companyId],
    queryFn: async () => {
      const token = getAuthToken();
      const qs = companyId && companyId !== "all" ? `?empresa=${companyId}` : "";
      const res = await fetch(`/api/financeiro/contas-receber/vendedores${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao buscar pendências financeiras" }));
        throw new Error(err.error ?? err.message ?? "Erro ao buscar pendências financeiras");
      }
      return res.json();
    },
    enabled: canSeeFinanceiro,
    staleTime: 5 * 60_000,
  });

  const financialByVendedor = useMemo<Map<string, FinancialSummary>>(() => {
    const map = new Map<string, FinancialSummary>();
    for (const fs of financialVendedores?.data ?? []) {
      map.set(String(fs.idvendedor), fs);
    }
    return map;
  }, [financialVendedores]);

  const normalizedGroups = useMemo<VendorGroup[]>(() => (
    groups.map(group => ({
      ...group,
      id: String(group.id),
      name: normalizeVendorName(group.name),
      members: Array.from(new Set((group.members ?? []).map(normalizeVendorId).filter(Boolean))),
    }))
  ), [groups]);

  const dedupedSalespersons = useMemo(() => {
    const byId = new Map<string, SalespersonWithStats>();
    for (const row of salespersons) {
      const normalizedId = normalizeVendorId(row.salesperson.id);
      if (!normalizedId) continue;
      const normalizedRow: SalespersonWithStats = {
        ...row,
        salesperson: {
          ...row.salesperson,
          id: normalizedId,
          name: normalizeVendorName(row.salesperson.name),
          email: String(row.salesperson.email ?? ""),
        },
      };
      const current = byId.get(normalizedId);
      if (!current || normalizedRow.stats.totalVendas > current.stats.totalVendas) {
        byId.set(normalizedId, normalizedRow);
      }
    }
    return Array.from(byId.values());
  }, [salespersons]);

  const selectedGroup = selectedGroupId ? normalizedGroups.find(g => g.id === selectedGroupId) : undefined;

  const filteredSalespersons = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const groupMembers = selectedGroup
      ? new Set(selectedGroup.members.map(normalizeVendorId))
      : null;
    return dedupedSalespersons.filter(({ salesperson }) => {
      const matchesSearch =
        !searchTerm ||
        salesperson.name.toLowerCase().includes(searchTerm) ||
        (salesperson.email ?? "").toLowerCase().includes(searchTerm);
      if (!matchesSearch) return false;
      if (!groupMembers) return true;
      return groupMembers.has(normalizeVendorId(salesperson.id));
    });
  }, [dedupedSalespersons, search, selectedGroup]);

  function showMovimentacoesButton(): boolean {
    if (isAdmin) return true;
    if (isSupervisor) {
      const val = settingMovimt?.value;
      return val === null || val === undefined ? true : val === "true";
    }
    return false;
  }

  const showGroupFilter = isAdmin || isSupervisor;

  // Count active non-default filters for badge
  const activeFiltersCount = [
    companyId !== "1" && companyId !== "all",
    selectedGroupId !== null,
  ].filter(Boolean).length;

  return (
    <div className="h-full overflow-auto">
      {/* ── Sticky header ───────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0">
        <div className="px-4 sm:px-6 py-3">
          {/* Row 1: Title + mobile filter button + view toggles */}
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Vendedores</h1>
              <HelpButton onClick={() => setHelpOpen(true)} />
              <span className="hidden sm:inline text-xs text-muted-foreground font-medium">Desempenho individual</span>
            </div>

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

              {/* Desktop: Inline filter controls */}
              <div className="hidden sm:flex items-center gap-2 flex-wrap">
                {showGroupFilter && (
                  <GroupSelector
                    groups={normalizedGroups}
                    selectedGroupId={selectedGroupId}
                    onChange={setSelectedGroupId}
                  />
                )}
                <CompanySelector
                  companies={companies}
                  selectedId={companyId}
                  onChange={setCompanyId}
                  loading={companiesLoading}
                />
                <PeriodSelector value={period} onChange={setPeriod} />
              </div>

            </div>
          </div>

          {/* Row 2: Search (always visible) + desktop period summary */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:max-w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
                data-testid="input-search-salesperson"
              />
            </div>
            {selectedGroup && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {filteredSalespersons.length}/{dedupedSalespersons.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {canSeeFinanceiro && financialError && (
        <div className="mx-4 sm:mx-6 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Não foi possível carregar as pendências financeiras dos vendedores. Os botões continuam disponíveis, mas os totais não serão exibidos até a API responder.
        </div>
      )}

      {/* ── Mobile Filters Sheet ─────────────────────────────── */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-xl pb-8">
          <SheetHeader className="pb-4 border-b mb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              Filtros
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            {showGroupFilter && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grupo</p>
                <Select
                  value={selectedGroupId ?? "all"}
                  onValueChange={v => setSelectedGroupId(v === "all" ? null : v)}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Grupo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os grupos</SelectItem>
                    {normalizedGroups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa</p>
              <CompanySelector
                companies={companies}
                selectedId={companyId}
                onChange={setCompanyId}
                loading={companiesLoading}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Período</p>
              <PeriodSelector
                value={period}
                onChange={p => { setPeriod(p); setFiltersOpen(false); }}
                inline
              />
            </div>

            <Button
              className="w-full h-10"
              onClick={() => setFiltersOpen(false)}
            >
              Aplicar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Cards grid ─────────────────────────────────────────── */}
      <div className="p-4 sm:p-6 space-y-4">
        {salespersonsLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 bg-card rounded-md animate-pulse" />
            ))}
          </div>
        ) : filteredSalespersons.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">Nenhum vendedor encontrado</p>
            <p className="text-sm">Tente ajustar os filtros ou período</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSalespersons.map(({ salesperson, stats }) => (
              <SalespersonCard
                key={salesperson.id}
                salesperson={salesperson}
                stats={stats}
                period={{ startDate: period.startDate, endDate: period.endDate }}
                showMovimentacoesButton={showMovimentacoesButton()}
                showFinanceiroButton={canSeeFinanceiro}
                financialSummary={canSeeFinanceiro ? (financialByVendedor.get(salesperson.id) ?? null) : null}
                companyId={companyId}
              />
            ))}
          </div>
        )}
      </div>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.vendedores} />
    </div>
  );
}
