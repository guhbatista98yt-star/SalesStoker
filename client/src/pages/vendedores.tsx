import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { CompanySelector } from "@/components/dashboard/company-selector";
import { SalespersonCard } from "@/components/dashboard/salesperson-card";
import { Search, Grid3X3, List } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { DatePeriod, Company, SalespersonWithStats } from "@shared/schema";

export default function Vendedores() {
  const today = new Date();
  const [period, setPeriod] = useState<DatePeriod>({
    startDate: format(startOfMonth(today), "yyyy-MM-dd"),
    endDate: format(endOfMonth(today), "yyyy-MM-dd"),
    mode: { type: "livre" },
  });
  const [companyId, setCompanyId] = useState<string>("1");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: salespersons = [], isLoading: salespersonsLoading } = useQuery<SalespersonWithStats[]>({
    queryKey: ["/api/salespersons", companyId, period.startDate, period.endDate],
  });

  const filteredSalespersons = salespersons.filter(({ salesperson }) =>
    salesperson.name.toLowerCase().includes(search.toLowerCase()) ||
    (salesperson.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Vendedores</h1>
            <span className="hidden sm:inline text-xs text-muted-foreground font-medium">Desempenho individual</span>
          </div>
          <div className="flex items-center gap-2">
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

      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-salesperson"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              data-testid="button-view-grid"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {salespersonsLoading ? (
          <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-card rounded-md animate-pulse" />
            ))}
          </div>
        ) : filteredSalespersons.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">Nenhum vendedor encontrado</p>
            <p className="text-sm">Tente ajustar os filtros ou período</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
            {filteredSalespersons.map(({ salesperson, stats }) => (
              <SalespersonCard
                key={salesperson.id}
                salesperson={salesperson}
                stats={stats}
                period={{ startDate: period.startDate, endDate: period.endDate }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
