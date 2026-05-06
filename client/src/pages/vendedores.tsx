import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth-context";
import { HelpButton, HelpDrawer, HELP_CONTENT } from "@/components/help";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { CompanySelector } from "@/components/dashboard/company-selector";
import { SalespersonCard, type FinancialSummary } from "@/components/dashboard/salesperson-card";
import { Search, Grid3X3, List, Users } from "lucide-react";
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
  const [companyId, setCompanyId] = useState<string>("1");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");

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

  const canSeeFinanceiro = isAdmin || isSupervisor;

  const { data: financialVendedores } = useQuery<{ data: FinancialSummary[] }>({
    queryKey: ["/api/financeiro/contas-receber/vendedores"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch("/api/financeiro/contas-receber/vendedores", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { data: [] };
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

  const selectedGroup = selectedGroupId === "all"
    ? undefined
    : normalizedGroups.find(g => g.id === selectedGroupId);

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

  const showGroupFilter = (isAdmin || isSupervisor) && normalizedGroups.length > 0;

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Vendedores</h1>
            <HelpButton onClick={() => setHelpOpen(true)} />
            <span className="hidden sm:inline text-xs text-muted-foreground font-medium">Desempenho individual</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {showGroupFilter && (
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="h-8 text-xs w-36 gap-1.5">
                  <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Grupo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os grupos</SelectItem>
                  {normalizedGroups.map(g => (
                    <SelectItem key={g.id} value={g.id} className="text-xs">{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 flex-1 w-full">
            <div className="relative flex-1 sm:max-w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-salesperson"
              />
            </div>
            {selectedGroup && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {filteredSalespersons.length}/{dedupedSalespersons.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {salespersonsLoading ? (
          <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
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
          <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 max-w-2xl"}`}>
            {filteredSalespersons.map(({ salesperson, stats }) => (
              <SalespersonCard
                key={salesperson.id}
                salesperson={salesperson}
                stats={stats}
                period={{ startDate: period.startDate, endDate: period.endDate }}
                showMovimentacoesButton={showMovimentacoesButton()}
                showFinanceiroButton={canSeeFinanceiro}
                financialSummary={canSeeFinanceiro ? (financialByVendedor.get(salesperson.id) ?? null) : null}
              />
            ))}
          </div>
        )}
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.vendedores} />
    </div>
  );
}
