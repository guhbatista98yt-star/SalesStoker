import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, Target, Percent, TrendingUp, Store, CheckCircle2, Gift, ShieldCheck, Zap, Tv2 } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/calendar-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CampaignHero } from "@/components/campanhas/campaign-hero";
import { CampaignStatusBanner, type Requirement } from "@/components/campanhas/campaign-status-banner";
import { MetricCard } from "@/components/campanhas/metric-card";
import { CalculationMemory } from "@/components/campanhas/calculation-memory";
import { CampaignRules } from "@/components/campanhas/campaign-rules";
import { CollapsibleSection } from "@/components/campanhas/collapsible-section";

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

export default function TvAmancoTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/metas/amanco/tv"],
    refetchInterval: 300000,
  });

  const { data: logoSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/app-settings/tvAmancoLogoUrl"],
    staleTime: 60000,
  });

  if (isLoading) return <Skeleton />;

  if (isError || !data) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar dados</AlertTitle>
        <AlertDescription>Não foi possível carregar os dados da Campanha TV Amanco.</AlertDescription>
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
  } = data as any;

  const safeDiv = (num: number, den: number, fallback = 0) =>
    den === 0 || !isFinite(den) ? fallback : num / den;

  const fatPct  = Math.min(safeDiv(fat.valor_atual, fat.meta_gatilho) * 100, 200);
  const mixPct  = Math.min(safeDiv(mx.percentual_conexoes, mx.meta_percentual) * 100, 200);
  const cvPct   = Math.min(Math.max(safeDiv(cv.crescimento_percentual, cv.meta_percentual || 1) * 100, 0), 200);
  const lojaPct = cl.meta_percentual > 0
    ? Math.max(0, Math.min(safeDiv(cl.crescimento_percentual, cl.meta_percentual) * 100, 200))
    : 100;

  function metricStatus(pct: number, ok: boolean) {
    if (ok || pct >= 100) return "atingido" as const;
    if (pct >= 75) return "quase" as const;
    return "pendente" as const;
  }

  const requirements: Requirement[] = [
    {
      id: "gatilho",
      label: "Gatilho Mínimo de Faturamento",
      sublabel: "Faturamento Amanco no período promocional",
      value: formatCurrency(fat.valor_atual),
      target: formatCurrency(fat.meta_gatilho),
      pct: fatPct,
      ok: fat.gatilho_atingido,
      critical: true,
    },
    {
      id: "mix",
      label: "Mix de Conexões Amanco",
      sublabel: "Participação de conexões sobre o total",
      value: `${mx.percentual_conexoes.toFixed(1)}%`,
      target: `${mx.meta_percentual}%`,
      pct: mixPct,
      ok: mx.status_ok,
      critical: true,
    },
    {
      id: "cv",
      label: "Crescimento Pessoal",
      sublabel: "Seu crescimento vs. ano anterior",
      value: `${cv.crescimento_percentual >= 0 ? "+" : ""}${cv.crescimento_percentual.toFixed(1)}%`,
      target: `+${cv.meta_percentual}%`,
      pct: cvPct,
      ok: cv.status_ok,
      critical: true,
    },
    {
      id: "loja",
      label: "Trava Crescimento Loja",
      sublabel: "Crescimento global de todos os vendedores",
      value: `${cl.crescimento_percentual >= 0 ? "+" : ""}${cl.crescimento_percentual.toFixed(1)}%`,
      target: `+${cl.meta_percentual}%`,
      pct: lojaPct,
      ok: cl.status_ok,
      critical: false,
    },
  ];

  const pendingIds = requirements.filter(r => !r.ok).map(r => r.label);
  const callToAction = el.participando
    ? "Todos os critérios atingidos! Você está elegível para o sorteio da campanha TV Amanco."
    : pendingIds.length === 1
    ? `Falta apenas: ${pendingIds[0]}.`
    : `Pendentes: ${pendingIds.join("; ")}.`;

  const campaignStatus = periodo.encerrado ? "encerrada" as const : "ativa" as const;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <CampaignHero
        supplierName="Amanco Wavin"
        supplierInitials="AW"
        logoUrl={logoSetting?.value || undefined}
        brandColor="#0057A8"
        brandColorDark="#003D80"
        campaignName="Campanha TV Amanco"
        subtitle="Promoção de incentivo com sorteio de televisores"
        periodStart={periodo.inicio}
        periodEnd={periodo.fim}
        status={campaignStatus}
        type="sorteio"
        typeLabel="Sorteio"
        eligible={el.participando}
        metrics={[
          { label: "Gatilho", value: `${Math.min(fatPct, 100).toFixed(0)}%`, pct: fatPct, ok: fat.gatilho_atingido },
          { label: "Conexões", value: `${Math.min(mixPct, 100).toFixed(0)}%`, pct: mixPct, ok: mx.status_ok },
          { label: "Crescimento", value: `${Math.min(cvPct, 100).toFixed(0)}%`, pct: cvPct, ok: cv.status_ok },
          { label: "Loja", value: `${Math.min(lojaPct, 100).toFixed(0)}%`, pct: lojaPct, ok: cl.status_ok },
        ]}
      />

      {/* Encerrado banner */}
      {periodo.encerrado && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900/20 dark:border-slate-700">
          <Badge variant="secondary" className="bg-slate-200 text-slate-700">Encerrada</Badge>
          <p className="text-sm text-muted-foreground">
            Esta campanha foi encerrada. Os dados exibidos refletem o resultado final apurado.
          </p>
        </div>
      )}

      {/* Status banner */}
      <CollapsibleSection id="tv-status" title="Critérios de Elegibilidade">
        <CampaignStatusBanner
          eligible={el.participando}
          requirements={requirements}
          callToAction={callToAction}
          rewardLabel={el.participando ? "Elegível ao sorteio" : "Verifique critérios"}
        />
      </CollapsibleSection>

      {/* Metric cards */}
      <CollapsibleSection id="tv-metricas" title="Métricas de Desempenho">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Gatilho Mínimo"
            subtitle="Faturamento Amanco no período"
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

          <MetricCard
            title="Mix de Conexões"
            subtitle="% conexões Amanco sobre o total"
            value={`${mx.percentual_conexoes.toFixed(1)}%`}
            targetLabel={`Meta: ${mx.meta_percentual}%`}
            remainingLabel={
              mx.status_ok
                ? `${mx.percentual_conexoes.toFixed(1)}% — acima da meta`
                : `Faltam ${Math.max(0, mx.meta_percentual - mx.percentual_conexoes).toFixed(1)}pp`
            }
            pct={mixPct}
            status={metricStatus(mixPct, mx.status_ok)}
            icon={Percent}
            iconColor="text-purple-600"
            iconBg="bg-purple-50 dark:bg-purple-900/20"
            gauge
          />

          <MetricCard
            title="Crescimento Pessoal"
            subtitle={`Meta: +${cv.meta_percentual}% vs. ano anterior`}
            value={`${cv.crescimento_percentual >= 0 ? "+" : ""}${cv.crescimento_percentual.toFixed(1)}%`}
            targetLabel={`Meta: +${cv.meta_percentual}%`}
            remainingLabel={
              cv.status_ok
                ? "Crescimento pessoal atingido!"
                : `Faltam ${Math.max(0, cv.meta_percentual - cv.crescimento_percentual).toFixed(1)}pp`
            }
            pct={cvPct}
            status={metricStatus(cvPct, cv.status_ok)}
            icon={TrendingUp}
            iconColor="text-amber-600"
            iconBg="bg-amber-50 dark:bg-amber-900/20"
          />

          <MetricCard
            title="Trava da Loja"
            subtitle="Crescimento global dos vendedores"
            value={`${cl.crescimento_percentual >= 0 ? "+" : ""}${cl.crescimento_percentual.toFixed(1)}%`}
            targetLabel={`Meta: +${cl.meta_percentual}%`}
            remainingLabel={
              cl.status_ok
                ? "Loja atingiu o crescimento necessário"
                : `Loja precisa de +${Math.max(0, cl.meta_percentual - cl.crescimento_percentual).toFixed(1)}pp`
            }
            pct={lojaPct}
            status={metricStatus(lojaPct, cl.status_ok)}
            icon={Store}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50 dark:bg-indigo-900/20"
          />
        </div>
      </CollapsibleSection>

      {/* Calculation memory + Rules */}
      <CollapsibleSection id="tv-calculo" title="Como foi Calculado" defaultOpen={false}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CalculationMemory
            steps={[
              {
                label: "Faturamento Amanco apurado",
                value: formatCurrency(fat.valor_atual),
                status: fat.gatilho_atingido ? "ok" : "fail",
                note: `Meta de gatilho: ${formatCurrency(fat.meta_gatilho)}`,
              },
              {
                label: "% Conexões sobre Tubos",
                value: `${mx.percentual_conexoes.toFixed(1)}%`,
                status: mx.status_ok ? "ok" : "fail",
                note: `Meta mínima: ${mx.meta_percentual}%`,
              },
              {
                label: "Crescimento pessoal vs. ano anterior",
                value: `${cv.crescimento_percentual >= 0 ? "+" : ""}${cv.crescimento_percentual.toFixed(1)}%`,
                status: cv.status_ok ? "ok" : "fail",
                note: `Meta: +${cv.meta_percentual}%`,
              },
              {
                label: "Crescimento global da loja",
                value: `${cl.crescimento_percentual >= 0 ? "+" : ""}${cl.crescimento_percentual.toFixed(2)}%`,
                status: cl.status_ok ? "ok" : "warn",
                note: `Meta da trava: +${cl.meta_percentual}%`,
              },
            ]}
            conclusion={
              el.participando
                ? "Todos os critérios atingidos. Você está elegível para participar do sorteio."
                : callToAction
            }
            conclusionStatus={el.participando ? "ok" : "fail"}
          />

          <CampaignRules
            groups={[
              {
                title: "Prêmio — O sorteio",
                icon: Tv2,
                iconColor: "text-blue-500",
                items: [
                  "Sorteio de televisores entre os vendedores elegíveis",
                  "Para participar, você precisa atingir todos os critérios",
                  "Quanto mais critérios atingir, maior a chance (se aplicável)",
                ],
              },
              {
                title: "Critérios de elegibilidade",
                icon: CheckCircle2,
                iconColor: "text-emerald-500",
                items: [
                  "Atingir o faturamento mínimo de produtos Amanco",
                  `Manter ${mx.meta_percentual}% de conexões sobre o total`,
                  `Crescer ${cv.meta_percentual}% vs. ano anterior`,
                  "Loja deve crescer globalmente vs. ano anterior",
                ],
              },
              {
                title: "Regras importantes",
                icon: ShieldCheck,
                iconColor: "text-slate-500",
                items: [
                  "A trava da loja é coletiva e impacta todos os vendedores",
                  "Faturamento apurado apenas com produtos Amanco DTR",
                  "Sorteio realizado após encerramento da campanha",
                ],
              },
              {
                title: "Como funciona",
                icon: Zap,
                iconColor: "text-amber-500",
                items: [
                  "Dados atualizados automaticamente a cada 5 minutos",
                  "Critérios verificados em tempo real",
                  "Resultado final apurado após encerramento do período",
                ],
              },
            ]}
          />
        </div>
      </CollapsibleSection>

      <p className="text-center text-xs text-muted-foreground pt-1">
        Dados atualizados em {formatDateBR(last_update)} · Apuração automática a cada 5 minutos
      </p>
    </div>
  );
}
