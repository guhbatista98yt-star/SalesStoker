import { useQuery } from "@tanstack/react-query";
import { Percent, Store, Target, TrendingUp, Tv2 } from "lucide-react";
import { formatCurrency } from "@/lib/calendar-utils";
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
  ORANGE,
  daysRemaining,
  safeDiv,
  signedPct,
} from "./campaign-ui";

type TvData = {
  last_update: string;
  periodo: { inicio: string; fim: string; encerrado?: boolean };
  faturamento_amanco: {
    valor_atual: number;
    meta_gatilho: number;
    faltante: number;
    percentual: number;
    gatilho_atingido: boolean;
  };
  crescimento_vendedor: {
    crescimento_percentual: number | null;
    sem_dados?: boolean;
    meta_percentual: number;
    status_ok: boolean;
  };
  mix_amanco: {
    percentual_conexoes: number;
    meta_percentual: number;
    status_ok: boolean;
  };
  crescimento_loja: {
    crescimento_percentual: number | null;
    sem_dados?: boolean;
    meta_percentual: number;
    status_ok: boolean;
  };
  elegibilidade: { participando: boolean; motivos?: string[] };
};

export default function TvAmancoTab() {
  const { data, isLoading, isError, dataUpdatedAt, refetch } = useQuery<TvData>({
    queryKey: ["/api/metas/amanco/tv"],
    queryFn: () => apiRequest("GET", "/api/metas/amanco/tv").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const { data: logoSetting } = useQuery<{ key: string; value: string | null }>({
    queryKey: ["/api/app-settings/tvAmancoLogoUrl"],
    staleTime: 60_000,
  });

  if (isLoading) return <CampaignLoading />;
  if (isError || !data) return <CampaignError campaignName="Campanha TV Amanco" />;

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
        title="Campanha TV Amanco"
        startDate={data.periodo.inicio}
        endDate={data.periodo.fim}
        eligible={el.participando}
        logoUrl={logoSetting?.value || undefined}
        closed={periodoEncerrado}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 28px" }}>
        <EligibilityBanner
          tv
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
            accentColor={cv.sem_dados ? ORANGE : (cv.status_ok ? GREEN : ORANGE)}
            icon={<TrendingUp size={18} />}
            label="Crescimento Vendedor"
            value={cv.sem_dados || cv.crescimento_percentual === null ? "Sem dados" : signedPct(cv.crescimento_percentual, 1)}
            subtitle={cv.sem_dados ? "Sem dados do ano anterior para comparar" : `Meta individual: +${cv.meta_percentual}%`}
            progressValue={cv.crescimento_percentual !== null ? safeDiv(cv.crescimento_percentual, cv.meta_percentual) * 100 : 0}
            progressLeft={cv.crescimento_percentual !== null ? `${Math.max(0, cv.crescimento_percentual).toFixed(1)}%` : "—"}
            progressRight={`Meta ${cv.meta_percentual}%`}
          />

          <KpiCard
            accentColor={cl.sem_dados ? ORANGE : (cl.status_ok ? GREEN : ORANGE)}
            icon={<Store size={18} />}
            label="Crescimento Loja"
            value={cl.sem_dados || cl.crescimento_percentual === null ? "Sem dados" : signedPct(cl.crescimento_percentual, 2)}
            subtitle={cl.sem_dados ? "Sem dados do ano anterior para comparar" : `Trava da loja: +${cl.meta_percentual}%`}
            progressValue={cl.crescimento_percentual !== null ? safeDiv(cl.crescimento_percentual, cl.meta_percentual) * 100 : 0}
            progressLeft={cl.crescimento_percentual !== null ? `${Math.max(0, cl.crescimento_percentual).toFixed(1)}%` : "—"}
            progressRight={`Meta ${cl.meta_percentual}%`}
          />

          <GaugeCard
            valuePct={mx.percentual_conexoes}
            metaPct={mx.meta_percentual}
            label="Conexoes sobre Tubos"
          />

          <KpiCard
            accentColor={el.participando ? GREEN : CYAN}
            icon={<Tv2 size={18} />}
            label="Sorteio"
            value={el.participando ? "Elegivel" : "Pendente"}
            subtitle={el.participando ? "Apto ao sorteio da TV" : "Complete os criterios para participar"}
          />

          <KpiCard
            accentColor={mx.status_ok ? GREEN : ORANGE}
            icon={<Percent size={18} />}
            label="Mix Amanco"
            value={`${mx.percentual_conexoes.toFixed(1)}%`}
            subtitle={`Meta: ${mx.meta_percentual}% de conexoes sobre tubos`}
            progressValue={safeDiv(mx.percentual_conexoes, mx.meta_percentual) * 100}
            progressLeft={`${mx.percentual_conexoes.toFixed(1)}%`}
            progressRight={`Meta ${mx.meta_percentual}%`}
          />
        </div>

        <FooterRefresh
          updatedAt={updatedAt}
          onRefresh={() => refetch()}
          label="Amanco Campanha TV"
          syncRoutine="campanhas"
        />
      </div>
    </CampaignPage>
  );
}
