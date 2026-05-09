import { useQuery } from "@tanstack/react-query";
import { Calendar, Gift, PaintBucket, Target } from "lucide-react";
import { formatCurrency, formatDateBR } from "@/lib/calendar-utils";
import { apiRequest } from "@/lib/queryClient";
import {
  CampaignError,
  CampaignHero,
  CampaignLoading,
  CampaignPage,
  EligibilityBanner,
  FooterRefresh,
  GREEN,
  KpiCard,
  ORANGE,
  SmallInfoCard,
  daysRemaining,
  safeDiv,
} from "./campaign-ui";

type ElitData = {
  last_update: string;
  periodo: { inicio: string; fim: string; pagamento?: string; pagamento_em?: string };
  gatilho_minimo: number;
  valor_vendido: number;
  faltante: number;
  participando: boolean;
  premiacao?: { total_receber?: number };
};

export default function TintasElitTab() {
  const { data, isLoading, isError, dataUpdatedAt, refetch } = useQuery<ElitData>({
    queryKey: ["/api/metas/elit"],
    queryFn: () => apiRequest("GET", "/api/metas/elit").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const { data: logoSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/app-settings/tintasElitLogoUrl"],
    staleTime: 60_000,
  });

  if (isLoading) return <CampaignLoading />;
  if (isError || !data) return <CampaignError campaignName="Campanha Tintas Elit" />;

  const pagamento = data.periodo.pagamento_em ?? data.periodo.pagamento;
  const progressPct = safeDiv(data.valor_vendido, data.gatilho_minimo) * 100;
  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : new Date(data.last_update).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <CampaignPage>
      <CampaignHero
        title="Campanha Tintas Elit"
        startDate={data.periodo.inicio}
        endDate={data.periodo.fim}
        eligible={data.participando}
        logoUrl={logoSetting?.value || undefined}
        logoAlt="Tintas Elit"
        closed={daysRemaining(data.periodo.fim) === 0}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 28px" }}>
        <EligibilityBanner
          eligible={data.participando}
          closed={Boolean(pagamento && daysRemaining(data.periodo.fim) === 0)}
          motivos={data.participando ? [] : [`Faltam ${formatCurrency(data.faltante)} para atingir o gatilho do ciclo.`]}
        />

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}>
          <KpiCard
            wide
            accentColor={data.participando ? GREEN : ORANGE}
            icon={<Target size={18} />}
            label="Gatilho Minimo - Tintas Elit"
            value={formatCurrency(data.valor_vendido)}
            subtitle={data.participando ? "Gatilho semanal atingido" : `Faltam ${formatCurrency(data.faltante)}`}
            progressValue={progressPct}
            progressLeft={`${Math.min(progressPct, 100).toFixed(0)}%`}
            progressRight={`Meta ${formatCurrency(data.gatilho_minimo)}`}
          />

          <SmallInfoCard
            icon={PaintBucket}
            title="Ciclo"
            value={`${formatDateBR(data.periodo.inicio)} a ${formatDateBR(data.periodo.fim)}`}
            accentColor={ORANGE}
          />

          <SmallInfoCard
            icon={Gift}
            title="Premiacao"
            value={formatCurrency(data.premiacao?.total_receber ?? 0)}
            accentColor={data.participando ? GREEN : ORANGE}
          />

          {pagamento && (
            <SmallInfoCard
              icon={Calendar}
              title="Pagamento"
              value={formatDateBR(pagamento)}
              accentColor={GREEN}
            />
          )}
        </div>

        <FooterRefresh
          updatedAt={updatedAt}
          onRefresh={() => refetch()}
          label="Campanha Tintas Elit"
          syncRoutine="campanhas"
        />
      </div>
    </CampaignPage>
  );
}
