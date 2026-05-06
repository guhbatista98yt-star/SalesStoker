import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Percent, Store, Target, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/calendar-utils";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import {
  CYAN,
  CampaignError,
  CampaignHero,
  CampaignLoading,
  CampaignPage,
  EligibilityBanner,
  FooterRefresh,
  GREEN,
  GaugeCard,
  KpiCard,
  NAVY,
  ORANGE,
  daysRemaining,
  safeDiv,
  signedPct,
} from "./campaign-ui";

type DtrData = {
  last_update: string;
  periodo: { inicio: string; fim: string; nome?: string; encerrado?: boolean };
  faturamento_amanco: {
    valor_atual: number;
    meta_gatilho: number;
    faltante: number;
    percentual: number;
    gatilho_atingido: boolean;
  };
  crescimento_vendedor: {
    crescimento_percentual: number;
  };
  mix_amanco: {
    percentual_conexoes: number;
    meta_percentual: number;
    status_ok: boolean;
  };
  crescimento_loja: {
    crescimento_percentual: number;
    meta_percentual: number;
    status_ok: boolean;
  };
  elegibilidade: { participando: boolean; motivos?: string[] };
  graceInfo?: {
    inGracePeriod: boolean;
    daysLeft: number;
    viewingPrev: boolean;
    currentQuarterName: string;
    prevQuarterName: string;
    gracePeriodEndDate: string;
  };
};

function GracePeriodBanner({
  graceInfo,
  viewPrev,
  onToggle,
}: {
  graceInfo?: DtrData["graceInfo"];
  viewPrev: boolean;
  onToggle: () => void;
}) {
  if (!graceInfo?.inGracePeriod) return null;

  return (
    <div style={{
      maxWidth: 1200,
      margin: "0 auto 16px",
      padding: "0 24px",
    }}>
      <div style={{
        background: viewPrev ? "#FFF7ED" : "#EFF6FF",
        border: `1px solid ${viewPrev ? "#FED7AA" : "#BFDBFE"}`,
        borderRadius: 14,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <Clock size={18} color={viewPrev ? ORANGE : CYAN} />
        <div style={{ flex: 1, minWidth: 240, fontSize: 13, color: "#374151" }}>
          {viewPrev
            ? `Visualizando ${graceInfo.prevQuarterName}. Disponivel por mais ${graceInfo.daysLeft} dia(s), ate ${graceInfo.gracePeriodEndDate}.`
            : `Novo trimestre ${graceInfo.currentQuarterName} iniciado. Voce ainda pode consultar ${graceInfo.prevQuarterName} por ${graceInfo.daysLeft} dia(s).`}
        </div>
        <Button size="sm" variant="outline" onClick={onToggle}>
          {viewPrev ? "Ver trimestre atual" : "Ver trimestre anterior"}
        </Button>
      </div>
    </div>
  );
}

export default function DtrAmancoTab() {
  const [viewPrev, setViewPrev] = useState(false);

  const { data, isLoading, isError, dataUpdatedAt, refetch } = useQuery<DtrData>({
    queryKey: ["/api/metas/amanco/dtr", viewPrev ? "prev" : "current"],
    queryFn: () =>
      apiRequest("GET", `/api/metas/amanco/dtr${viewPrev ? "?view=prev" : ""}`).then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const { data: logoSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/app-settings/dtrAmancoLogoUrl"],
    staleTime: 60_000,
  });

  if (isLoading) return <CampaignLoading />;
  if (isError || !data) return <CampaignError campaignName="Campanha DTR Amanco" />;

  const fat = data.faturamento_amanco;
  const cv = data.crescimento_vendedor;
  const mx = data.mix_amanco;
  const cl = data.crescimento_loja;
  const el = data.elegibilidade;
  const periodoEncerrado = data.periodo.encerrado ?? daysRemaining(data.periodo.fim) === 0;
  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : new Date(data.last_update).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <CampaignPage>
      <CampaignHero
        title="Campanha DTR Amanco"
        startDate={data.periodo.inicio}
        endDate={data.periodo.fim}
        eligible={el.participando}
        logoUrl={logoSetting?.value || undefined}
        closed={periodoEncerrado}
      />

      <GracePeriodBanner
        graceInfo={data.graceInfo}
        viewPrev={viewPrev}
        onToggle={() => setViewPrev((v) => !v)}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 28px" }}>
        <EligibilityBanner
          eligible={el.participando}
          closed={periodoEncerrado}
          motivos={el.motivos}
        />

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}>
          <KpiCard
            wide
            accentColor={fat.gatilho_atingido ? GREEN : CYAN}
            icon={<Target size={18} />}
            label="Gatilho Minimo - Faturamento Amanco"
            value={formatCurrency(fat.valor_atual)}
            subtitle={fat.gatilho_atingido ? "Gatilho de faturamento atingido" : `Faltam ${formatCurrency(fat.faltante)}`}
            progressValue={fat.percentual}
            progressLeft={`${Math.min(fat.percentual, 100).toFixed(0)}%`}
            progressRight={`Meta ${formatCurrency(fat.meta_gatilho)}`}
          />

          <KpiCard
            accentColor={cv.crescimento_percentual >= 0 ? GREEN : ORANGE}
            icon={<TrendingUp size={18} />}
            label="Seu Crescimento (informativo)"
            value={signedPct(cv.crescimento_percentual, 1)}
            subtitle="Comparativo com o mesmo periodo do ano anterior"
            progressValue={(cv.crescimento_percentual + 100) / 2}
            progressLeft="Ano anterior"
            progressRight="Ano atual"
          />

          <KpiCard
            accentColor={cl.status_ok ? GREEN : ORANGE}
            icon={<Store size={18} />}
            label="Crescimento Loja"
            value={signedPct(cl.crescimento_percentual, 2)}
            subtitle={`Trava da loja: +${cl.meta_percentual}%`}
            progressValue={safeDiv(cl.crescimento_percentual, cl.meta_percentual) * 100}
            progressLeft={`${Math.max(0, cl.crescimento_percentual).toFixed(1)}%`}
            progressRight={`Meta ${cl.meta_percentual}%`}
          />

          <GaugeCard
            valuePct={mx.percentual_conexoes}
            metaPct={mx.meta_percentual}
            label="Conexoes sobre Tubos"
          />

          <KpiCard
            accentColor={el.participando ? GREEN : NAVY}
            icon={<Percent size={18} />}
            label="Status Geral"
            value={el.participando ? "Elegivel" : "Pendente"}
            subtitle={el.participando ? "Todos os criterios foram atingidos" : "Acompanhe os criterios pendentes acima"}
          />
        </div>

        <FooterRefresh
          updatedAt={updatedAt}
          onRefresh={() => refetch()}
          label="Amanco Campanha DTR"
        />
      </div>
    </CampaignPage>
  );
}
