import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, Target, Percent, TrendingUp, Store, CheckCircle2, Gift, ShieldCheck, Zap, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/calendar-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CampaignHero } from "@/components/campanhas/campaign-hero";
import { CampaignStatusBanner, type Requirement } from "@/components/campanhas/campaign-status-banner";
import { MetricCard } from "@/components/campanhas/metric-card";
import { CalculationMemory } from "@/components/campanhas/calculation-memory";
import { CampaignRules } from "@/components/campanhas/campaign-rules";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="skeleton rounded-2xl h-[160px]" />
      <div className="skeleton rounded-2xl h-[200px]" />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton rounded-2xl h-[220px]" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="skeleton rounded-2xl h-[280px]" />
        <div className="skeleton rounded-2xl h-[280px]" />
      </div>
    </div>
  );
}

/* ── Grace period banner ──────────────────────────────────────────────────── */
interface GraceBannerProps {
  graceInfo: {
    inGracePeriod: boolean;
    daysLeft: number;
    viewingPrev: boolean;
    currentQuarterName: string;
    prevQuarterName: string;
    gracePeriodEndDate: string;
  };
  viewPrev: boolean;
  onToggle: () => void;
}

function GracePeriodBanner({ graceInfo, viewPrev, onToggle }: GraceBannerProps) {
  if (!graceInfo.inGracePeriod) return null;

  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl border text-sm",
      viewPrev
        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
        : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
    )}>
      <Clock className={cn("w-4 h-4 shrink-0", viewPrev ? "text-amber-600" : "text-blue-600")} />
      <p className={cn("flex-1 leading-snug", viewPrev ? "text-amber-800 dark:text-amber-200" : "text-blue-800 dark:text-blue-200")}>
        {viewPrev
          ? <>Visualizando <strong>{graceInfo.prevQuarterName}</strong> (trimestre anterior). Disponível por mais <strong>{graceInfo.daysLeft} {graceInfo.daysLeft === 1 ? "dia" : "dias"}</strong> até {graceInfo.gracePeriodEndDate}.</>
          : <>Novo trimestre <strong>{graceInfo.currentQuarterName}</strong> iniciado. Você ainda pode consultar <strong>{graceInfo.prevQuarterName}</strong> por <strong>{graceInfo.daysLeft} {graceInfo.daysLeft === 1 ? "dia" : "dias"}</strong>.</>
        }
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={onToggle}
        className={cn(
          "shrink-0 gap-1.5",
          viewPrev
            ? "border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
            : "border-blue-300 text-blue-800 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-200"
        )}
      >
        {viewPrev
          ? <><ChevronRight className="w-3.5 h-3.5" /> Ver trimestre atual</>
          : <><ChevronLeft className="w-3.5 h-3.5" /> Ver trimestre anterior</>
        }
      </Button>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function DtrAmancoTab() {
  const [viewPrev, setViewPrev] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/metas/amanco/dtr", viewPrev ? "prev" : "current"],
    queryFn: () =>
      apiRequest("GET", `/api/metas/amanco/dtr${viewPrev ? "?view=prev" : ""}`)
        .then(r => r.json()),
    refetchInterval: 300000,
  });

  const { data: logoSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/app-settings/dtrAmancoLogoUrl"],
    staleTime: 60000,
  });

  if (isLoading) return <Skeleton />;

  if (isError || !data) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar dados</AlertTitle>
        <AlertDescription>
          Não foi possível carregar os dados da Campanha DTR Amanco. Tente novamente mais tarde.
        </AlertDescription>
      </Alert>
    );
  }

  const {
    last_update,
    periodo,
    faturamento_amanco: fat,
    crescimento_vendedor: cv,
    mix_amanco: mx,
    crescimento_loja: cl,
    elegibilidade: el,
    graceInfo,
  } = data as any;

  const isViewingPrev = graceInfo?.viewingPrev === true;

  /* ── Helpers ── */
  const safeDiv = (num: number, den: number, fallback = 0) =>
    den === 0 || !isFinite(den) ? fallback : num / den;

  /* ── Derived ── */
  const fatPct  = Math.min(safeDiv(fat.valor_atual, fat.meta_gatilho) * 100, 200);
  const mixPct  = Math.min(safeDiv(mx.percentual_conexoes, mx.meta_percentual) * 100, 200);
  const lojaPct = cl.meta_percentual > 0
    ? Math.max(0, Math.min(safeDiv(cl.crescimento_percentual, cl.meta_percentual) * 100, 200))
    : 100;

  /* ── Requirements ── */
  const requirements: Requirement[] = [
    {
      id: "gatilho",
      label: "Gatilho Mínimo de Faturamento",
      sublabel: `Faturamento Amanco no trimestre`,
      value: formatCurrency(fat.valor_atual),
      target: formatCurrency(fat.meta_gatilho),
      pct: fatPct,
      ok: fat.gatilho_atingido,
      critical: true,
    },
    {
      id: "mix",
      label: "Mix de Conexões Amanco",
      sublabel: `Participação de conexões sobre o total`,
      value: `${mx.percentual_conexoes.toFixed(1)}%`,
      target: `${mx.meta_percentual}%`,
      pct: mixPct,
      ok: mx.status_ok,
      critical: true,
    },
    {
      id: "loja",
      label: "Trava Crescimento Loja",
      sublabel: `Crescimento global de todos os vendedores vs. ano anterior`,
      value: `${cl.crescimento_percentual > 0 ? "+" : ""}${cl.crescimento_percentual.toFixed(1)}%`,
      target: `+${cl.meta_percentual}%`,
      pct: lojaPct,
      ok: cl.status_ok,
      critical: false,
    },
  ];

  /* ── Metric card status helper ── */
  function metricStatus(pct: number, ok: boolean) {
    if (ok || pct >= 100) return "atingido" as const;
    if (pct >= 75) return "quase" as const;
    return "pendente" as const;
  }

  /* ── Calculation memory ── */
  const calcSteps = [
    {
      label: "Faturamento Amanco apurado",
      value: formatCurrency(fat.valor_atual),
      status: fat.gatilho_atingido ? "ok" : "fail" as any,
      note: `Meta de gatilho: ${formatCurrency(fat.meta_gatilho)}`,
    },
    {
      label: "% Conexões sobre Tubos",
      value: `${mx.percentual_conexoes.toFixed(1)}%`,
      status: mx.status_ok ? "ok" : "fail" as any,
      note: `Meta mínima: ${mx.meta_percentual}%`,
    },
    {
      label: "Crescimento pessoal vs. ano anterior",
      value: `${cv.crescimento_percentual >= 0 ? "+" : ""}${cv.crescimento_percentual.toFixed(1)}%`,
      status: "neutral" as any,
      note: "Informativo — não bloqueia elegibilidade",
    },
    {
      label: "Crescimento global da loja",
      value: `${cl.crescimento_percentual >= 0 ? "+" : ""}${cl.crescimento_percentual.toFixed(2)}%`,
      status: cl.status_ok ? "ok" : "warn" as any,
      note: `Meta da trava: +${cl.meta_percentual}%`,
    },
  ];

  const pendingIds = requirements.filter(r => !r.ok).map(r => r.label);
  const callToAction = el.participando
    ? "Parabéns! Todos os critérios foram atingidos. Você está elegível para receber o prêmio da campanha."
    : pendingIds.length === 1
    ? `Atenção: ${pendingIds[0]} é o único critério pendente.`
    : `Pendente: ${pendingIds.join(" e ")}.`;

  return (
    <div className="space-y-5">

      {/* ── Grace Period Banner ── */}
      {graceInfo && (
        <GracePeriodBanner
          graceInfo={graceInfo}
          viewPrev={viewPrev}
          onToggle={() => setViewPrev(v => !v)}
        />
      )}

      {/* ── Hero ── */}
      <CampaignHero
        supplierName="Amanco Wavin"
        supplierInitials="AW"
        logoUrl={logoSetting?.value || undefined}
        brandColor="#0057A8"
        brandColorDark="#003D80"
        campaignName="Campanha DTR Amanco"
        subtitle={isViewingPrev
          ? `Resultados do trimestre anterior · ${graceInfo?.prevQuarterName}`
          : "Desenvolvimento e Treinamento de Revendas"}
        periodStart={periodo.inicio}
        periodEnd={periodo.fim}
        status={isViewingPrev ? "encerrada" : "ativa"}
        type="atingimento"
        typeLabel={isViewingPrev ? "Consulta Anterior" : "Atingimento"}
        eligible={el.participando}
        metrics={[
          {
            label: "Gatilho Mínimo",
            value: `${Math.min(fatPct, 100).toFixed(0)}%`,
            pct: fatPct,
            ok: fat.gatilho_atingido,
          },
          {
            label: "Mix Conexões",
            value: `${Math.min(mixPct, 100).toFixed(0)}%`,
            pct: mixPct,
            ok: mx.status_ok,
          },
          {
            label: "Trava Loja",
            value: `${Math.min(lojaPct, 100).toFixed(0)}%`,
            pct: lojaPct,
            ok: cl.status_ok,
          },
        ]}
      />

      {/* ── Status banner ── */}
      <CampaignStatusBanner
        eligible={el.participando}
        requirements={requirements}
        callToAction={callToAction}
        rewardLabel={el.participando ? "Elegível ao prêmio" : "Verifique critérios"}
      />

      {/* ── Metric cards ── */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
          Métricas de Desempenho
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Gatilho */}
          <MetricCard
            title="Gatilho Mínimo"
            subtitle="Faturamento Amanco no trimestre"
            value={formatCurrency(fat.valor_atual)}
            targetLabel={`Meta: ${formatCurrency(fat.meta_gatilho)}`}
            remainingLabel={
              fat.gatilho_atingido
                ? "Gatilho de faturamento atingido!"
                : `Faltam ${formatCurrency(fat.faltante)} para o gatilho`
            }
            pct={fatPct}
            status={metricStatus(fatPct, fat.gatilho_atingido)}
            icon={Target}
            iconColor="text-blue-600"
            iconBg="bg-blue-50 dark:bg-blue-900/20"
          />

          {/* Mix Conexões */}
          <MetricCard
            title="Mix de Conexões"
            subtitle="% conexões Amanco sobre o total"
            value={`${mx.percentual_conexoes.toFixed(1)}%`}
            targetLabel={`Meta: ${mx.meta_percentual}%`}
            remainingLabel={
              mx.status_ok
                ? `${mx.percentual_conexoes.toFixed(1)}% atingido — acima da meta`
                : `Faltam ${Math.max(0, mx.meta_percentual - mx.percentual_conexoes).toFixed(1)}pp para a meta`
            }
            pct={mixPct}
            status={metricStatus(mixPct, mx.status_ok)}
            icon={Percent}
            iconColor="text-purple-600"
            iconBg="bg-purple-50 dark:bg-purple-900/20"
            gauge
          />

          {/* Crescimento Vendedor */}
          <MetricCard
            title="Crescimento Pessoal"
            subtitle="Seu crescimento vs. ano anterior"
            value={`${cv.crescimento_percentual >= 0 ? "+" : ""}${cv.crescimento_percentual.toFixed(1)}%`}
            targetLabel="Informativo"
            note="Não bloqueia sua elegibilidade"
            pct={Math.min(Math.max(cv.crescimento_percentual + 100, 0), 100)}
            status="info"
            icon={TrendingUp}
            iconColor="text-amber-600"
            iconBg="bg-amber-50 dark:bg-amber-900/20"
          />

          {/* Trava Loja */}
          <MetricCard
            title="Trava da Loja"
            subtitle="Crescimento global de todos os vendedores"
            value={`${cl.crescimento_percentual >= 0 ? "+" : ""}${cl.crescimento_percentual.toFixed(1)}%`}
            targetLabel={`Meta: +${cl.meta_percentual}%`}
            remainingLabel={
              cl.status_ok
                ? "Loja atingiu o crescimento necessário"
                : `Loja precisa de mais ${Math.max(0, cl.meta_percentual - cl.crescimento_percentual).toFixed(1)}pp de crescimento`
            }
            pct={lojaPct}
            status={metricStatus(lojaPct, cl.status_ok)}
            icon={Store}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50 dark:bg-indigo-900/20"
          />
        </div>
      </div>

      {/* ── Calculation memory + Rules side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CalculationMemory
          steps={calcSteps}
          conclusion={
            el.participando
              ? "Todos os critérios estão atingidos. Você está elegível para receber o prêmio desta campanha."
              : `Ainda não elegível. ${callToAction}`
          }
          conclusionStatus={el.participando ? "ok" : "fail"}
        />

        <CampaignRules
          groups={[
            {
              title: "O que conta",
              icon: CheckCircle2,
              iconColor: "text-emerald-500",
              items: [
                "Faturamento de produtos Amanco DTR no trimestre",
                "Conexões Amanco sobre tubos (todas as marcas)",
                "Crescimento global da loja vs. ano anterior",
              ],
            },
            {
              title: "Como participar",
              icon: Zap,
              iconColor: "text-blue-500",
              items: [
                "Bater o gatilho mínimo de faturamento Amanco",
                "Atingir o percentual mínimo de conexões",
                "Sua loja precisa ter crescimento positivo vs. ano anterior",
              ],
            },
            {
              title: "Premiação",
              icon: Gift,
              iconColor: "text-amber-500",
              items: [
                "Prêmio por atingimento de todos os critérios",
                "Calculado sobre o faturamento elegível do período",
                "Pagamento após encerramento e apuração da campanha",
              ],
            },
            {
              title: "Regras importantes",
              icon: ShieldCheck,
              iconColor: "text-slate-500",
              items: [
                "A trava da loja é coletiva — impacta todos os vendedores",
                "Crescimento pessoal é informativo nesta campanha",
                "Dados apurados com base nas notas fiscais do período",
              ],
            },
          ]}
        />
      </div>

      {/* ── Footer ── */}
      <p className="text-center text-xs text-muted-foreground pt-1">
        Dados atualizados em {formatDateBR(last_update)} · Apuração automática a cada 5 minutos
      </p>
    </div>
  );
}
