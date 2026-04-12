import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Trophy, Users, TrendingUp, Download, Search, Loader2,
  AlertCircle, CheckCircle2, XCircle, Calendar, BarChart3,
  Medal, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportEntry {
  salespersonId: string;
  salespersonName: string;
  targetTrigger: number;
  currentSales: number;
  percentAchieved: number | null;
  isEligible: boolean;
  hasGoal: boolean;
}

interface ReportSummary {
  total: number;
  withGoal: number;
  eligible: number;
  avgPercent: number;
  period: { startDate: string; endDate: string; year: number; quarter: number | null };
  suppliers: string[];
}

interface RelatorioData {
  campaign: { id: string; name: string; code: string };
  summary: ReportSummary;
  results: ReportEntry[];
}

interface RelatorioTabProps {
  campaignId: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);
const QUARTERS = [
  { value: "all", label: "Período da campanha" },
  { value: "1", label: "Q1 — Jan / Fev / Mar" },
  { value: "2", label: "Q2 — Abr / Mai / Jun" },
  { value: "3", label: "Q3 — Jul / Ago / Set" },
  { value: "4", label: "Q4 — Out / Nov / Dez" },
];

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function MedalIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Medal className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-zinc-400" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
  return <span className="text-xs font-mono text-muted-foreground w-4 text-center">{rank}</span>;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border bg-card">
      <div className={cn("p-2.5 rounded-lg", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground leading-none mb-1">{label}</p>
        <p className="text-xl font-bold leading-none">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function AchievementBar({ percent, isEligible, hasGoal }: { percent: number | null; isEligible: boolean; hasGoal: boolean }) {
  if (!hasGoal) {
    return <span className="text-[10px] text-muted-foreground italic">Sem gatilho</span>;
  }
  const normalised = Math.min((percent ?? 0) / 1.5, 100);
  const display = percent !== null ? `${percent.toFixed(1)}%` : "—";
  return (
    <div className="space-y-1 min-w-32">
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-xs font-semibold",
          isEligible ? "text-green-600 dark:text-green-400"
            : (percent ?? 0) >= 80 ? "text-amber-600 dark:text-amber-400"
            : "text-red-500 dark:text-red-400"
        )}>
          {display}
        </span>
      </div>
      <Progress
        value={normalised}
        className={cn(
          "h-1.5",
          isEligible ? "[&>div]:bg-green-500"
            : (percent ?? 0) >= 80 ? "[&>div]:bg-amber-500"
            : "[&>div]:bg-red-400"
        )}
      />
    </div>
  );
}

export function RelatorioTab({ campaignId }: RelatorioTabProps) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [quarter, setQuarter] = useState("all");
  const [search, setSearch] = useState("");
  const [showOnly, setShowOnly] = useState<"all" | "eligible" | "not_eligible">("all");

  const { data, isLoading, error, isFetching } = useQuery<RelatorioData>({
    queryKey: [`/api/campaigns/${campaignId}/relatorio`, year, quarter],
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(year) });
      if (quarter !== "all") params.set("quarter", quarter);
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/relatorio?${params}`);
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.results.filter(r => {
      if (showOnly === "eligible" && !r.isEligible) return false;
      if (showOnly === "not_eligible" && r.isEligible) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.salespersonName.toLowerCase().includes(q) || r.salespersonId.includes(q);
      }
      return true;
    });
  }, [data, search, showOnly]);

  function exportCSV() {
    if (!data) return;
    const headers = ["#", "ID", "Vendedor", "Gatilho (R$)", "Vendas (R$)", "Atingimento (%)", "Elegível"];
    const rows = data.results.map((r, i) => [
      i + 1,
      r.salespersonId,
      r.salespersonName,
      r.targetTrigger,
      r.currentSales.toFixed(2),
      r.percentAchieved !== null ? r.percentAchieved.toFixed(1) : "S/G",
      r.isEligible ? "SIM" : "NÃO",
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${data.campaign.code}-${year}${quarter !== "all" ? `-Q${quarter}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Calculando relatório de performance...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-destructive">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">Erro ao carregar relatório</p>
      </div>
    );
  }

  const s = data?.summary;

  return (
    <div className="space-y-5">
      {/* Header & filters */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Relatório de Performance
            {isFetching && !isLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe o atingimento dos gatilhos por vendedor no período selecionado.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={exportCSV} disabled={!data}>
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>
      </div>

      {/* Period selectors */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          Período:
        </div>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {YEARS.map(y => (
              <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={quarter} onValueChange={setQuarter}>
          <SelectTrigger className="h-8 text-xs w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {QUARTERS.map(q => (
              <SelectItem key={q.value} value={q.value} className="text-xs">{q.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {s && (
          <Badge variant="outline" className="text-[11px] h-7 px-2.5 font-normal text-muted-foreground">
            {fmtDate(s.period.startDate)} → {fmtDate(s.period.endDate)}
          </Badge>
        )}
        {s?.suppliers && s.suppliers.length > 0 && (
          <Badge variant="secondary" className="text-[11px] h-7 px-2.5 gap-1">
            <Star className="h-3 w-3" />
            {s.suppliers.join(", ")}
          </Badge>
        )}
      </div>

      {/* Summary cards */}
      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            icon={Users}
            label="Total Vendedores"
            value={s.total}
            sub={`${s.withGoal} com gatilho`}
            color="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
          />
          <SummaryCard
            icon={Trophy}
            label="Elegíveis"
            value={s.eligible}
            sub={s.withGoal > 0 ? `${Math.round(s.eligible / s.withGoal * 100)}% do total` : "—"}
            color="bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400"
          />
          <SummaryCard
            icon={TrendingUp}
            label="Atingimento Médio"
            value={s.avgPercent > 0 ? `${s.avgPercent}%` : "—"}
            sub="Entre vendedores com gatilho"
            color="bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400"
          />
          <SummaryCard
            icon={XCircle}
            label="Não Elegíveis"
            value={s.withGoal - s.eligible}
            sub={s.withGoal > 0 ? `${Math.round((s.withGoal - s.eligible) / s.withGoal * 100)}% do total` : "—"}
            color="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
          />
        </div>
      )}

      {/* Table filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Buscar vendedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-md border overflow-hidden text-xs">
          {(["all", "eligible", "not_eligible"] as const).map(v => {
            const labels = { all: "Todos", eligible: "Elegíveis", not_eligible: "Não elegíveis" };
            return (
              <button
                key={v}
                onClick={() => setShowOnly(v)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  showOnly === v
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {labels[v]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs w-10">#</TableHead>
              <TableHead className="text-xs w-14">ID</TableHead>
              <TableHead className="text-xs">Vendedor</TableHead>
              <TableHead className="text-xs text-right">Gatilho</TableHead>
              <TableHead className="text-xs text-right">Vendas</TableHead>
              <TableHead className="text-xs w-40">Atingimento</TableHead>
              <TableHead className="text-xs text-center w-24">Elegível</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-xs text-muted-foreground">
                  Nenhum vendedor encontrado para os filtros selecionados
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r, idx) => {
                const globalRank = (data?.results || []).findIndex(x => x.salespersonId === r.salespersonId) + 1;
                return (
                  <TableRow
                    key={r.salespersonId}
                    className={cn(
                      "transition-colors",
                      r.isEligible && "bg-green-50/40 dark:bg-green-950/10",
                    )}
                  >
                    <TableCell className="py-2">
                      <div className="flex items-center justify-center">
                        <MedalIcon rank={globalRank} />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground py-2">{r.salespersonId}</TableCell>
                    <TableCell className="text-xs font-medium py-2">{r.salespersonName}</TableCell>
                    <TableCell className="text-xs text-right font-mono py-2">
                      {r.hasGoal ? (
                        <span className="text-foreground">{fmtBRL(r.targetTrigger)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono py-2">
                      <span className={cn(
                        r.isEligible ? "text-green-600 dark:text-green-400 font-semibold"
                          : (r.percentAchieved ?? 0) >= 80 ? "text-amber-600 dark:text-amber-400"
                          : "text-foreground"
                      )}>
                        {fmtBRL(r.currentSales)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      <AchievementBar
                        percent={r.percentAchieved}
                        isEligible={r.isEligible}
                        hasGoal={r.hasGoal}
                      />
                    </TableCell>
                    <TableCell className="text-center py-2">
                      {!r.hasGoal ? (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      ) : r.isEligible ? (
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">SIM</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <XCircle className="h-4 w-4 text-red-400" />
                          <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">NÃO</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Mostrando {filtered.length} de {data?.results.length} vendedores ·{" "}
        {data?.summary.suppliers.length ? `Fabricantes: ${data.summary.suppliers.join(", ")}` : "Todos os fabricantes"}
      </p>
    </div>
  );
}
