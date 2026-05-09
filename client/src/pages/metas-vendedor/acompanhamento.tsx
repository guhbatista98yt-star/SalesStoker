import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Target, PieChart, Clock, CheckCircle2, TrendingUp, RefreshCw } from "lucide-react";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { formatCurrency, formatDateBR } from "@/lib/calendar-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/campanhas/collapsible-section";
import { cn } from "@/lib/utils";

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function getStatusFromPct(pct: number) {
  if (pct >= 100) return "atingido" as const;
  if (pct >= 75)  return "quase" as const;
  if (pct >= 50)  return "em_curso" as const;
  return "pendente" as const;
}

const statusBar: Record<string, string> = {
  atingido: "bg-emerald-500",
  quase:    "bg-amber-500",
  em_curso: "bg-primary",
  pendente: "bg-red-400",
};

const statusBadge: Record<string, string> = {
  atingido: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  quase:    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  em_curso: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  pendente: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const statusLabel: Record<string, string> = {
  atingido: "Concluída",
  quase:    "Quase lá",
  em_curso: "Em progresso",
  pendente: "Pendente",
};

/* ── Meta goal card ───────────────────────────────────────────────────────── */
interface GoalCardProps {
  title: string;
  subtitle: string;
  valorAtual: number;
  meta: number;
  percentual: number;
  faltante: number;
  diasRestantes: number;
  accentColor: string;
  accentBg: string;
  icon: React.ReactNode;
}

function GoalCard({
  title, subtitle, valorAtual, meta, percentual, faltante,
  diasRestantes, accentColor, accentBg, icon,
}: GoalCardProps) {
  const pct = Math.min(percentual, 100);
  const status = getStatusFromPct(percentual);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card card-hover overflow-hidden flex flex-col">
      {/* Top accent */}
      <div className={cn("h-0.5 w-full", statusBar[status])} />

      <div className="p-5 flex flex-col gap-5 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", accentBg)}>
              <span className={accentColor}>{icon}</span>
            </div>
            <div>
              <p className="text-base font-bold text-foreground leading-tight">{title}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{subtitle}</p>
            </div>
          </div>
          <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 mt-0.5", statusBadge[status])}>
            {statusLabel[status]}
          </span>
        </div>

        {/* Values */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Vendido</p>
            <p className="text-2xl font-black tabular-nums text-foreground leading-none truncate">
              {formatCurrency(valorAtual)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-medium mb-1">Meta</p>
            <p className="text-lg font-bold text-muted-foreground leading-none truncate">
              {meta > 0 ? formatCurrency(meta) : "Não definida"}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Progresso</span>
            <span className={cn(
              "text-sm font-black tabular-nums",
              status === "atingido" ? "text-emerald-600" : status === "quase" ? "text-amber-600" : "text-foreground"
            )}>
              {percentual}%
            </span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", statusBar[status])}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {diasRestantes > 0 ? `${diasRestantes} dias restantes` : "Período encerrado"}
          </div>
          {faltante > 0 && meta > 0 ? (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-500">
              Faltam {formatCurrency(faltante)}
            </span>
          ) : status === "atingido" ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Meta atingida!
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Mix donut card ───────────────────────────────────────────────────────── */
function MixCard({ mix_geral }: { mix_geral: any }) {
  const pctConexoes = Math.min(mix_geral.percentual_conexoes, 100);
  const circumference = 2 * Math.PI * 36; // r=36
  const dash = (pctConexoes / 100) * circumference;
  const gap  = circumference - dash;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-card card-hover overflow-hidden flex flex-col">
      <div className="h-0.5 w-full bg-purple-400" />
      <div className="p-5 flex flex-col gap-5 flex-1">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
            <PieChart className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="text-base font-bold text-foreground leading-tight">Mix Geral</p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Conexões × Tubos — todas as marcas
            </p>
          </div>
        </div>

        {/* Donut */}
        <div className="flex justify-center py-2">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              {/* Track */}
              <circle
                cx="40" cy="40" r="36"
                fill="none"
                strokeWidth="8"
                className="stroke-muted"
              />
              {/* Progress */}
              <circle
                cx="40" cy="40" r="36"
                fill="none"
                strokeWidth="8"
                stroke="#9333ea"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${gap}`}
                style={{ transition: "stroke-dasharray 0.7s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-foreground leading-none">
                {mix_geral.percentual_conexoes}%
              </span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-0.5">
                Conexões
              </span>
            </div>
          </div>
        </div>

        {/* Legend rows */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 dark:bg-purple-900/15 border border-purple-100 dark:border-purple-800/30">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
              <span className="text-sm font-semibold text-purple-900 dark:text-purple-300">Conexões</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-purple-800 dark:text-purple-300">
              {formatCurrency(mix_geral.valor_conexoes)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
              <span className="text-sm font-semibold text-muted-foreground">Tubos</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-foreground">
              {formatCurrency(mix_geral.valor_tubos)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="skeleton rounded-2xl h-[56px]" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton rounded-2xl h-[340px]" />)}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function AcompanhamentoTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/metas/acompanhamento"],
    refetchInterval: 60_000,
  });

  if (isLoading) return <Skeleton />;

  if (isError || !data) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar dados</AlertTitle>
        <AlertDescription>Não foi possível carregar os dados de acompanhamento.</AlertDescription>
      </Alert>
    );
  }

  const { last_update, loja1, loja3, mix_geral, periodo: periodoData } = data as any;

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-card rounded-2xl border border-border shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-foreground leading-tight">Acompanhamento de Metas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Meta semanal · {formatDateBR(periodoData.inicio)} – {formatDateBR(periodoData.fim)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatusBar routine="vendas" label="Vendas" />
          <Badge variant="outline" className="gap-1.5 text-xs font-medium bg-primary/5 border-primary/20 text-primary">
            <RefreshCw className="h-3 w-3" />
            Tempo real
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDateBR(last_update)}</span>
        </div>
      </div>

      {/* Cards */}
      <CollapsibleSection id="acomp-metas" title="Metas da Semana">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <GoalCard
            title="Varejo"
            subtitle={`Meta semanal · ${formatDateBR(periodoData.inicio)} – ${formatDateBR(periodoData.fim)}`}
            valorAtual={loja1.valor_atual}
            meta={loja1.meta}
            percentual={loja1.percentual}
            faltante={loja1.faltante}
            diasRestantes={periodoData.dias_restantes}
            accentColor="text-blue-600"
            accentBg="bg-blue-50 dark:bg-blue-900/20"
            icon={<Target className="h-5 w-5" />}
          />

          <GoalCard
            title="Atacado"
            subtitle={`Meta semanal · ${formatDateBR(periodoData.inicio)} – ${formatDateBR(periodoData.fim)}`}
            valorAtual={loja3.valor_atual}
            meta={loja3.meta}
            percentual={loja3.percentual}
            faltante={loja3.faltante}
            diasRestantes={periodoData.dias_restantes}
            accentColor="text-red-600"
            accentBg="bg-red-50 dark:bg-red-900/20"
            icon={<TrendingUp className="h-5 w-5" />}
          />

          <MixCard mix_geral={mix_geral} />
        </div>
      </CollapsibleSection>
    </div>
  );
}
