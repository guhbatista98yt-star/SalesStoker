import { useQuery } from "@tanstack/react-query";
import { AlertCircle, PaintBucket, CheckCircle2, Gift, ShieldCheck, Zap, Calendar } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/calendar-utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
      <div className="skeleton rounded-2xl h-[160px]" />
      <div className="skeleton rounded-2xl h-[220px]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="skeleton rounded-2xl h-[260px]" />
        <div className="skeleton rounded-2xl h-[260px]" />
      </div>
    </div>
  );
}

export default function TintasElitTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/metas/elit"],
    refetchInterval: 300000,
  });

  const { data: logoSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/app-settings/tintasElitLogoUrl"],
    staleTime: 60000,
  });

  if (isLoading) return <Skeleton />;

  if (isError || !data) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar dados</AlertTitle>
        <AlertDescription>Não foi possível carregar os dados da Campanha Tintas Elit.</AlertDescription>
      </Alert>
    );
  }

  const { last_update, periodo, gatilho_minimo, valor_vendido, faltante, participando } = data as any;

  const safeDiv = (num: number, den: number, fallback = 0) =>
    den === 0 || !isFinite(den) ? fallback : num / den;
  const progressPct = Math.min(safeDiv(valor_vendido, gatilho_minimo) * 100, 200);

  const requirements: Requirement[] = [
    {
      id: "gatilho",
      label: "Gatilho Mínimo de Vendas",
      sublabel: `Ciclo: ${formatDateBR(periodo.inicio)} até ${formatDateBR(periodo.fim)}`,
      value: formatCurrency(valor_vendido),
      target: formatCurrency(gatilho_minimo),
      pct: progressPct,
      ok: participando,
      critical: true,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <CampaignHero
        supplierName="Tintas Elit"
        supplierInitials="TE"
        logoUrl={logoSetting?.value || undefined}
        brandColor="#EA580C"
        brandColorDark="#9A3412"
        campaignName="Campanha Tintas Elit"
        subtitle="Incentivo de ciclo semanal com premiação imediata"
        periodStart={periodo.inicio}
        periodEnd={periodo.fim}
        status="ativa"
        type="gatilho"
        typeLabel="Gatilho Semanal"
        eligible={participando}
        metrics={[
          {
            label: "Gatilho Mínimo",
            value: `${Math.min(progressPct, 100).toFixed(0)}%`,
            pct: progressPct,
            ok: participando,
          },
        ]}
      />

      {/* Payment info strip */}
      {periodo.pagamento_em && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50/60 border border-amber-100 dark:bg-amber-900/10 dark:border-amber-800/30">
          <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Calendar className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              {participando ? "Prêmio confirmado!" : "Pagamento previsto se você atingir o gatilho"}
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
              Sábado, {formatDateBR(periodo.pagamento_em)}
            </p>
          </div>
        </div>
      )}

      {/* Status banner */}
      <CollapsibleSection id="elit-status" title="Critérios de Elegibilidade">
        <CampaignStatusBanner
          eligible={participando}
          requirements={requirements}
          callToAction={
            participando
              ? `Gatilho atingido! Prêmio confirmado para sábado ${formatDateBR(periodo.pagamento_em)}.`
              : faltante > 0
              ? `Faltam ${formatCurrency(faltante)} para atingir o gatilho e receber o prêmio do ciclo.`
              : "Acompanhe seu progresso abaixo."
          }
          rewardLabel={participando ? "Prêmio garantido" : `Faltam ${formatCurrency(faltante)}`}
        />
      </CollapsibleSection>

      {/* Main metric card - large */}
      <CollapsibleSection id="elit-desempenho" title="Desempenho no Ciclo Atual">
        <MetricCard
          title="Vendas Tintas Elit no Ciclo"
          subtitle={`Ciclo semanal: ${formatDateBR(periodo.inicio)} – ${formatDateBR(periodo.fim)}`}
          value={formatCurrency(valor_vendido)}
          targetLabel={`Gatilho: ${formatCurrency(gatilho_minimo)}`}
          remainingLabel={
            participando
              ? `Gatilho atingido! Você qualificou para o prêmio deste ciclo.`
              : `Faltam ${formatCurrency(faltante)} para destravar o prêmio`
          }
          pct={progressPct}
          status={
            participando ? "atingido"
            : progressPct >= 75 ? "quase"
            : "pendente"
          }
          icon={PaintBucket}
          iconColor="text-orange-600"
          iconBg="bg-orange-50 dark:bg-orange-900/20"
          className="max-w-lg"
        />
      </CollapsibleSection>

      {/* Calculation memory + Rules */}
      <CollapsibleSection id="elit-calculo" title="Como foi Calculado" defaultOpen={false}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CalculationMemory
            steps={[
              {
                label: "Faturamento Elit no ciclo",
                value: formatCurrency(valor_vendido),
                status: participando ? "ok" : "fail",
                note: `Produtos Tintas Elit apenas`,
              },
              {
                label: "Gatilho mínimo do ciclo",
                value: formatCurrency(gatilho_minimo),
                status: "neutral",
                note: "Valor fixo definido pela campanha",
              },
              {
                label: "Percentual atingido",
                value: `${Math.min(progressPct, 100).toFixed(1)}%`,
                status: participando ? "ok" : progressPct >= 75 ? "warn" : "fail",
                note: participando ? "Gatilho superado" : `Faltam ${formatCurrency(faltante)}`,
              },
              {
                label: "Pagamento previsto",
                value: periodo.pagamento_em ? formatDateBR(periodo.pagamento_em) : "—",
                status: participando ? "ok" : "neutral",
                note: participando ? "Prêmio confirmado" : "Condicionado ao atingimento do gatilho",
              },
            ]}
            conclusion={
              participando
                ? `Gatilho atingido! Prêmio confirmado para ${formatDateBR(periodo.pagamento_em)}.`
                : `Ainda não elegível. Faltam ${formatCurrency(faltante)} para destravar o prêmio deste ciclo.`
            }
            conclusionStatus={participando ? "ok" : progressPct >= 75 ? "warn" : "fail"}
          />

          <CampaignRules
            groups={[
              {
                title: "Como funciona",
                icon: Zap,
                iconColor: "text-orange-500",
                items: [
                  "Campanha com ciclo semanal (sábado a sexta)",
                  "Prêmio pago no sábado seguinte se o gatilho for atingido",
                  "Cada ciclo é independente — você pode ganhar toda semana",
                ],
              },
              {
                title: "O que conta",
                icon: CheckCircle2,
                iconColor: "text-emerald-500",
                items: [
                  "Apenas produtos Tintas Elit são considerados",
                  "Faturamento apurado no período de sábado a sexta",
                  "Notas fiscais emitidas dentro do ciclo",
                ],
              },
              {
                title: "Premiação",
                icon: Gift,
                iconColor: "text-amber-500",
                items: [
                  "Prêmio fixo por ciclo ao atingir o gatilho mínimo",
                  "Pagamento realizado no sábado seguinte ao ciclo",
                  "Não há acúmulo entre ciclos",
                ],
              },
              {
                title: "Regras importantes",
                icon: ShieldCheck,
                iconColor: "text-slate-500",
                items: [
                  "O gatilho mínimo é definido pela Tintas Elit por ciclo",
                  "Dados atualizados automaticamente a cada 5 minutos",
                  "Em caso de dúvida, consulte o regulamento oficial",
                ],
              },
            ]}
          />
        </div>
      </CollapsibleSection>

      <p className="text-center text-xs text-muted-foreground pt-1">
        Dados atualizados em {formatDateBR(last_update)} · Ciclo: {formatDateBR(periodo.inicio)} – {formatDateBR(periodo.fim)}
      </p>
    </div>
  );
}
