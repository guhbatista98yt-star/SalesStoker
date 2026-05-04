import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft, Trophy, Gift, Calendar, Target, CheckCircle2,
  Zap, ShieldCheck, AlertCircle, Loader2, TrendingUp, DollarSign,
  Layers, Star, Award, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CampaignHero } from "@/components/campanhas/campaign-hero";
import { CampaignRules } from "@/components/campanhas/campaign-rules";
import { CollapsibleSection } from "@/components/campanhas/collapsible-section";
import {
  type Campaign,
  type ApuracaoResult,
  STATUS_LABEL, CAMPAIGN_MODE_LABEL,
  REWARD_TYPE_LABEL,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function daysLeft(endsAt: string) {
  const diff = Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);
  return diff;
}

function darkenHex(hex: string, amount = 30): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `#${[r, g, b].map((c: number) => Math.max(0, c - amount).toString(16).padStart(2, "0")).join("")}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-[160px] rounded-2xl bg-muted/50" />
      <div className="h-[200px] rounded-2xl bg-muted/50" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map(i => <div key={i} className="h-[180px] rounded-2xl bg-muted/50" />)}
      </div>
    </div>
  );
}

// ─── Rewards Display ──────────────────────────────────────────────────────────

function RewardsCard({ campaign }: { campaign: Campaign }) {
  const { rewards } = campaign;
  const brandColor = campaign.brand_color || "#0057A8";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandColor}20` }}>
          <Gift className="h-3.5 w-3.5" style={{ color: brandColor }} />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">Premiação</p>
          <p className="text-xs text-muted-foreground leading-tight">{REWARD_TYPE_LABEL[rewards.type] || rewards.type}</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Valor fixo / comissão */}
        {(rewards.type === "VALOR_FIXO" || rewards.type === "COMISSAO_PERCENTUAL" || rewards.type === "PERCENTUAL") && rewards.baseValue != null && rewards.baseValue > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: `${brandColor}30`, backgroundColor: `${brandColor}08` }}>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${brandColor}15` }}>
              {rewards.type === "VALOR_FIXO"
                ? <DollarSign className="h-6 w-6" style={{ color: brandColor }} />
                : <TrendingUp className="h-6 w-6" style={{ color: brandColor }} />
              }
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {rewards.type === "VALOR_FIXO" ? "Prêmio fixo por atingimento" : `Comissão percentual`}
              </p>
              <p className="text-2xl font-black" style={{ color: brandColor }}>
                {rewards.type === "VALOR_FIXO"
                  ? fmtCurrency(rewards.baseValue)
                  : `${rewards.baseValue}%`
                }
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rewards.scope === "individual" ? "Por vendedor" : "Prêmio coletivo"}
              </p>
            </div>
          </div>
        )}

        {/* Faixas */}
        {rewards.type === "FAIXA" && rewards.tiers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Faixas de prêmio</p>
            {rewards.tiers.map((tier, i) => (
              <div key={tier.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <div>
                    {tier.label && <p className="text-sm font-semibold">{tier.label}</p>}
                    <p className="text-xs text-muted-foreground">
                      {tier.min !== undefined && tier.max !== undefined && tier.max !== null
                        ? `${tier.unit === "R$" ? fmtCurrency(tier.min) : tier.min} – ${tier.unit === "R$" ? fmtCurrency(tier.max) : tier.max}`
                        : tier.min !== undefined
                        ? `≥ ${tier.unit === "R$" ? fmtCurrency(tier.min) : tier.min}`
                        : ""}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold" style={{ color: brandColor }}>
                  {fmtCurrency(tier.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Ranking */}
        {rewards.type === "RANKING" && rewards.posicoes && rewards.posicoes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prêmios por posição</p>
            {rewards.posicoes.map(pos => {
              const icons = [Star, Award, Trophy];
              const Icon = icons[Math.min(pos.posicao - 1, 2)] || Trophy;
              const colors = ["text-amber-500", "text-slate-400", "text-orange-600"];
              const col = colors[Math.min(pos.posicao - 1, 2)] || "text-slate-500";
              return (
                <div key={pos.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <Icon className={cn("h-5 w-5 shrink-0", col)} />
                    <div>
                      <p className="text-sm font-semibold">{pos.posicao}º lugar</p>
                      {pos.label && <p className="text-xs text-muted-foreground">{pos.label}</p>}
                    </div>
                  </div>
                  <span className="text-sm font-bold" style={{ color: brandColor }}>
                    {fmtCurrency(pos.valor)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {rewards.minCutoff != null && rewards.minCutoff > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Mínimo de corte: {fmtCurrency(rewards.minCutoff)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ranking result card ───────────────────────────────────────────────────────

function RankingCard({ results, campaign }: { results: ApuracaoResult; campaign: Campaign }) {
  const brandColor = campaign.brand_color || "#0057A8";
  const top = [...results.detalhes]
    .filter(d => d.posicao && d.posicao <= 10)
    .sort((a, b) => (a.posicao ?? 999) - (b.posicao ?? 999))
    .slice(0, 5);

  if (top.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandColor}20` }}>
          <Trophy className="h-3.5 w-3.5" style={{ color: brandColor }} />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Ranking atual</p>
          <p className="text-xs text-muted-foreground">Top colocações até o momento</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {top.map(d => {
          const podiumColors = ["bg-amber-400", "bg-slate-300", "bg-orange-500"];
          const podiumColor = (d.posicao && d.posicao <= 3) ? podiumColors[d.posicao - 1] : "bg-muted-foreground/20";
          return (
            <div key={d.vendedorId} className="flex items-center gap-3 px-5 py-3">
              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold", podiumColor)}>
                {d.posicao}
              </div>
              <span className="flex-1 text-sm font-medium">{d.vendedorNome}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: brandColor }}>
                {fmtCurrency(d.valorApuracao)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function SummaryStats({ results, brandColor }: { results: ApuracaoResult; brandColor: string }) {
  const stats = [
    { label: "Participantes", value: results.totalParticipantes, icon: Users },
    { label: "Atingiram meta", value: results.totalAtingidos, icon: Target },
    { label: "Premiados", value: results.totalPremiados, icon: Gift },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl border border-border bg-card p-3 text-center">
          <s.icon className="h-4 w-4 mx-auto mb-1" style={{ color: brandColor }} />
          <p className="text-xl font-black" style={{ color: brandColor }}>{s.value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main vendor dashboard ────────────────────────────────────────────────────

export default function VendorCampaignDashboard({ campaignId }: { campaignId: string }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: campaign, isLoading: loadingCampaign, isError: errorCampaign } = useQuery<Campaign>({
    queryKey: [`/api/campaigns/${campaignId}`],
  });

  const { data: results } = useQuery<ApuracaoResult | null>({
    queryKey: [`/api/campaigns/${campaignId}/resultados`],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const r = await fetch(`/api/campaigns/${campaignId}/resultados`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) return null;
      return r.json();
    },
    retry: false,
  });

  if (loadingCampaign) return <Skeleton />;

  if (errorCampaign || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <AlertCircle className="h-10 w-10 text-destructive/60" />
        <p>Campanha não encontrada.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/campanhas")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  const brandColor = campaign.brand_color || "#0057A8";
  const brandDark  = darkenHex(brandColor, 30);
  const supplierName = campaign.supplier_name || "Campanha";
  const initials = supplierName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const remaining = daysLeft(campaign.ends_at);
  const isActive  = campaign.status === "ativa";
  const isPaused  = campaign.status === "pausada";
  const isEnded   = campaign.status === "encerrada" || campaign.status === "cancelada";

  const heroStatus: "ativa" | "encerrada" | "futura" | "pausada" =
    campaign.status === "ativa" ? "ativa"
    : campaign.status === "pausada" ? "pausada"
    : campaign.status === "encerrada" || campaign.status === "cancelada" ? "encerrada"
    : "futura";

  const modeLabel = campaign.campaign_mode === "atingimento" ? "atingimento"
    : campaign.campaign_mode === "comissao" ? "comissao"
    : campaign.campaign_mode === "ranking_volume" || campaign.campaign_mode === "ranking_crescimento" ? "ranking"
    : "atingimento";

  const hasRanking = campaign.campaign_mode === "ranking_volume" || campaign.campaign_mode === "ranking_crescimento";

  // Build campaign rules from natural language + mode
  const ruleGroups: any[] = [];

  if (campaign.natural_language) {
    ruleGroups.push({
      title: "Sobre esta campanha",
      icon: Layers,
      iconColor: "text-primary",
      items: [campaign.natural_language],
    });
  }

  ruleGroups.push({
    title: "Modalidade",
    icon: Target,
    iconColor: "text-blue-500",
    items: [
      CAMPAIGN_MODE_LABEL[campaign.campaign_mode] || campaign.campaign_mode,
      campaign.rewards.scope === "individual" ? "Prêmio individual por vendedor" : "Prêmio coletivo da equipe",
      campaign.is_cumulative ? "Acumulável com outras campanhas" : "Não acumulável com outras campanhas",
    ],
  });

  if (campaign.targets.produtos.suppliers.length > 0) {
    ruleGroups.push({
      title: "Produtos válidos",
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      items: campaign.targets.produtos.suppliers.map(s => `Produtos do fornecedor: ${s}`),
    });
  }

  ruleGroups.push({
    title: "Regras gerais",
    icon: ShieldCheck,
    iconColor: "text-slate-500",
    items: [
      `Campanha válida de ${fmtDate(campaign.starts_at)} a ${fmtDate(campaign.ends_at)}`,
      ...(campaign.is_exclusive ? ["Campanha exclusiva — não acumulável"] : []),
      ...(campaign.limits.maxPerVendedor != null ? [`Limite máximo por vendedor: ${fmtCurrency(campaign.limits.maxPerVendedor)}`] : []),
      ...(campaign.bases.elegibilidade?.mix_minimo && campaign.bases.elegibilidade.mix_minimo > 0
        ? [`Mix mínimo de ${campaign.bases.elegibilidade.mix_minimo} produto(s) para elegibilidade`]
        : []),
      "Dados apurados com base nas notas fiscais do período",
    ].filter(Boolean),
  });

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Back button ── */}
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate("/campanhas")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-base font-bold leading-tight">Minhas Campanhas</h1>
            <p className="text-xs text-muted-foreground">Acompanhe seu desempenho</p>
          </div>
        </div>

        {/* ── Hero ── */}
        <CampaignHero
          supplierName={supplierName}
          supplierInitials={initials}
          logoUrl={campaign.logo_url}
          brandColor={brandColor}
          brandColorDark={brandDark}
          campaignName={campaign.name}
          subtitle={campaign.description || campaign.objective || undefined}
          periodStart={campaign.starts_at}
          periodEnd={campaign.ends_at}
          status={heroStatus}
          type={modeLabel as any}
          typeLabel={CAMPAIGN_MODE_LABEL[campaign.campaign_mode]?.split(" ")[0] || campaign.campaign_mode}
          eligible={false}
          eligibleLabel={
            isEnded
              ? "Campanha encerrada — aguarde a apuração final"
              : isPaused
              ? "Campanha pausada temporariamente"
              : isActive && remaining > 0
              ? `Ainda ${remaining} ${remaining === 1 ? "dia" : "dias"} para o encerramento`
              : "Campanha em andamento"
          }
        />

        {/* ── Period countdown (active only) ── */}
        {isActive && remaining > 0 && remaining <= 30 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ borderColor: `${brandColor}40`, backgroundColor: `${brandColor}0a` }}>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${brandColor}20` }}>
              <span className="text-lg font-black" style={{ color: brandColor }}>{remaining}</span>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: brandColor }}>
                {remaining === 1 ? "Último dia!" : `${remaining} dias restantes`}
              </p>
              <p className="text-xs text-muted-foreground">Encerra em {fmtDate(campaign.ends_at)}</p>
            </div>
          </div>
        )}

        {/* ── Results summary (when apuração exists) ── */}
        {results && (
          <CollapsibleSection id={`camp-results-${campaignId}`} title="Resultado da Apuração">
            <div className="space-y-4">
              <SummaryStats results={results} brandColor={brandColor} />
              {hasRanking && <RankingCard results={results} campaign={campaign} />}
              <p className="text-xs text-center text-muted-foreground">
                Apurado em {fmtDate(results.apuradoEm)} · Período {fmtDate(results.periodoInicio)} a {fmtDate(results.periodoFim)}
              </p>
            </div>
          </CollapsibleSection>
        )}

        {/* ── Premiação ── */}
        <CollapsibleSection id={`camp-premio-${campaignId}`} title="Premiação">
          <RewardsCard campaign={campaign} />
        </CollapsibleSection>

        {/* ── Regras ── */}
        <CollapsibleSection id={`camp-regras-${campaignId}`} title="Como funciona">
          <CampaignRules groups={ruleGroups} />
        </CollapsibleSection>

        {/* ── No results yet notice ── */}
        {!results && !isEnded && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-muted/40 border border-border text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mt-0.5 shrink-0 opacity-60" />
            <p>Os resultados individuais serão exibidos após a apuração da campanha. Continue vendendo!</p>
          </div>
        )}

        {/* ── Footer ── */}
        <p className="text-center text-xs text-muted-foreground pt-1 pb-4">
          {campaign.code} · {STATUS_LABEL[campaign.status]} · v{campaign.current_version}
        </p>

      </div>
    </div>
  );
}
