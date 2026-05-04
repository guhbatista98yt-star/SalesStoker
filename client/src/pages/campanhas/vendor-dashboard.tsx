import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/campanhas/collapsible-section";
import {
  ChevronLeft, RefreshCw, Loader2, Trophy, Gift, TrendingUp,
  TrendingDown, Target, CheckCircle2, XCircle, AlertCircle,
  Package, Star, Award, Users, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  type Campaign, type ApuracaoResult, type VendedorApuracao,
  STATUS_LABEL, CAMPAIGN_MODE_LABEL, REWARD_TYPE_LABEL,
} from "./types";

// ─── Amanco brand palette ──────────────────────────────────────────────────
const AMANCO = {
  cyan:   "#00A8E1",
  navy:   "#002269",
  green:  "#00953B",
  orange: "#F68025",
  gray:   "#F1F2F2",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}
function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
function daysLeft(end: string) {
  return Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
}
function pct(val: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, (val / total) * 100));
}

// ─── Amanco brand colors from campaign.brand_color or fallback ────────────
function brandPalette(color?: string) {
  const primary = color || AMANCO.cyan;
  return { primary, navy: AMANCO.navy, green: AMANCO.green, orange: AMANCO.orange };
}

// ─── Amanco Geometric SVG (brand pattern) ────────────────────────────────────
function AmancoGeomSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 140" className={className} aria-hidden>
      {/* Quarter circles in Amanco brand palette */}
      {/* Top-left cyan quarter */}
      <path d="M0,0 L70,0 A70,70 0 0,0 0,70 Z" fill="#00A8E1" opacity="0.92" />
      {/* Top-right green */}
      <path d="M70,0 L140,0 L140,70 A70,70 0 0,0 70,0 Z" fill="#00953B" opacity="0.88" />
      {/* Bottom-left navy */}
      <path d="M0,70 A70,70 0 0,0 70,140 L0,140 Z" fill="#002269" opacity="0.85" />
      {/* Bottom-right cyan arc */}
      <path d="M70,140 A70,70 0 0,0 140,70 L140,140 Z" fill="#00A8E1" opacity="0.75" />
      {/* Center overlap arc: inner cyan */}
      <circle cx="70" cy="70" r="28" fill="white" opacity="0.12" />
      {/* Small circle accent */}
      <circle cx="70" cy="70" r="14" fill="white" opacity="0.08" />
    </svg>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({
  value, color, className,
}: { value: number; color: string; className?: string }) {
  return (
    <div className={cn("w-full h-2 rounded-full bg-black/10 overflow-hidden", className)}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Radial progress (SVG donut) ──────────────────────────────────────────────
function RadialPct({
  value, color, size = 80, strokeWidth = 8,
}: { value: number; color: string; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────
function CampaignHeroAmanco({
  campaign,
  onBack,
  isActive,
  daysLeft: dl,
}: {
  campaign: Campaign;
  onBack: () => void;
  isActive: boolean;
  daysLeft: number;
}) {
  const status = campaign.status;
  const statusColors: Record<string, string> = {
    ativa: "#00953B",
    pausada: "#F68025",
    encerrada: "#6B7280",
    cancelada: "#EF4444",
    rascunho: "#6B7280",
  };
  const statusLabel: Record<string, string> = {
    ativa: "Ativa",
    pausada: "Pausada",
    encerrada: "Encerrada",
    cancelada: "Cancelada",
    rascunho: "Rascunho",
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-lg select-none"
      style={{ background: `linear-gradient(135deg, ${AMANCO.navy} 0%, #001040 100%)` }}
    >
      {/* Geometric decoration — top right */}
      <div className="absolute -top-6 -right-6 w-40 h-40 opacity-80">
        <AmancoGeomSvg />
      </div>
      {/* Extra small accent circle — bottom left */}
      <div className="absolute bottom-0 left-0 w-24 h-24 opacity-20 -translate-x-6 translate-y-6">
        <AmancoGeomSvg />
      </div>

      <div className="relative z-10 p-5 pb-6">
        {/* Back + logo row */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onBack}
            className="h-8 w-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
          {campaign.logo_url ? (
            <img
              src={campaign.logo_url}
              alt={campaign.supplier_name || "Logo"}
              className="h-9 w-auto object-contain max-w-[120px] rounded"
            />
          ) : (
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center text-white text-sm font-black"
              style={{ backgroundColor: AMANCO.cyan }}
            >
              {(campaign.supplier_name || "A").slice(0, 2).toUpperCase()}
            </div>
          )}
          {/* Status pill */}
          <div className="ml-auto shrink-0">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
              style={{ backgroundColor: statusColors[status] || "#6B7280" }}
            >
              {statusLabel[status] || status}
            </span>
          </div>
        </div>

        {/* Campaign name */}
        <h1 className="text-xl font-black text-white leading-tight mb-1">
          {campaign.name}
        </h1>
        <p className="text-sm text-white/60 mb-4">
          {fmtDate(campaign.starts_at)} – {fmtDate(campaign.ends_at)}
          {campaign.code && <span className="ml-2 opacity-50">· {campaign.code}</span>}
        </p>

        {/* Mode + countdown row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${AMANCO.cyan}25`, color: AMANCO.cyan, border: `1px solid ${AMANCO.cyan}50` }}
          >
            {CAMPAIGN_MODE_LABEL[campaign.campaign_mode] || campaign.campaign_mode}
          </span>
          {isActive && dl > 0 && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              {dl === 1 ? "Último dia" : `${dl} dias restantes`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Eligibility status card ──────────────────────────────────────────────────
function EligibilityCard({ vendor }: { vendor: VendedorApuracao }) {
  const isEligible = vendor.participou && vendor.atingiu;
  const isAwarded = vendor.premiado;

  if (isAwarded) {
    return (
      <div className="rounded-2xl border border-green-200 dark:border-green-800 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-4 bg-green-50 dark:bg-green-950/30">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#00953B" }}>
            <Trophy className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <p className="font-bold text-green-800 dark:text-green-200 text-sm">
              Parabéns! Você é premiado nesta campanha
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
              {vendor.categoria ? `Categoria ${vendor.categoria}` : "Meta atingida com sucesso"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isEligible) {
    return (
      <div className="rounded-2xl border overflow-hidden"
        style={{ borderColor: `${AMANCO.cyan}40` }}>
        <div className="flex items-center gap-3 px-4 py-4"
          style={{ backgroundColor: `${AMANCO.cyan}0f` }}>
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: AMANCO.cyan }}>
            <CheckCircle2 className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: AMANCO.navy }}>
              Elegível — aguardando encerramento do período
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Continue vendendo para garantir sua premiação
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-200 dark:border-red-800 overflow-hidden">
      <div className="px-4 py-3 bg-red-50 dark:bg-red-950/30 flex items-center gap-3 border-b border-red-200 dark:border-red-800">
        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
        <p className="font-bold text-red-800 dark:text-red-200 text-sm">
          Ainda não elegível para premiação
        </p>
      </div>
      <div className="px-4 py-3 bg-red-50/50 dark:bg-red-950/20 space-y-1.5">
        {vendor.motivosNaoParticipacao.length > 0
          ? vendor.motivosNaoParticipacao.map((m, i) => (
              <div key={i} className="flex items-start gap-2">
                <Minus className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-300">{m}</p>
              </div>
            ))
          : <p className="text-xs text-red-600">Verifique os requisitos da campanha</p>
        }
      </div>
    </div>
  );
}

// ─── KPI card: Faturamento ────────────────────────────────────────────────────
function FaturamentoCard({ vendor }: { vendor: VendedorApuracao }) {
  const progress = pct(vendor.valorApuracao, vendor.gatilhoValor);
  const reached = vendor.gatilhoAtingido;
  const falta = Math.max(0, vendor.gatilhoValor - vendor.valorApuracao);

  return (
    <div className="rounded-2xl bg-white dark:bg-card border border-border shadow-sm overflow-hidden">
      {/* Accent bar */}
      <div className="h-1" style={{ backgroundColor: reached ? AMANCO.green : AMANCO.cyan }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${AMANCO.cyan}18` }}>
              <Target className="h-3.5 w-3.5" style={{ color: AMANCO.cyan }} />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Gatilho Mínimo
            </p>
          </div>
          {reached
            ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            : <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          }
        </div>
        <p className="text-xs text-muted-foreground mb-0.5">Faturamento Amanco no trimestre</p>
        <p className="text-2xl font-black mb-0.5" style={{ color: AMANCO.navy }}>
          {fmtBRL(vendor.valorApuracao)}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Meta: {fmtBRL(vendor.gatilhoValor)}
        </p>
        <ProgressBar value={progress} color={reached ? AMANCO.green : AMANCO.cyan} className="mb-2" />
        <div className="flex items-center justify-between">
          <p className={cn("text-xs font-semibold", reached ? "text-green-600" : "text-red-500")}>
            {reached
              ? "✓ Meta atingida!"
              : `Falta: ${fmtBRL(falta)}`
            }
          </p>
          <p className="text-xs font-bold" style={{ color: AMANCO.cyan }}>
            {progress.toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── KPI card: Mix ────────────────────────────────────────────────────────────
function MixCard({ vendor, mixMinimo }: { vendor: VendedorApuracao; mixMinimo: number }) {
  const progress = pct(vendor.mixCount, mixMinimo);
  const reached = vendor.mixCount >= mixMinimo;

  return (
    <div className="rounded-2xl bg-white dark:bg-card border border-border shadow-sm overflow-hidden">
      <div className="h-1" style={{ backgroundColor: reached ? AMANCO.green : AMANCO.orange }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${AMANCO.green}18` }}>
              <Package className="h-3.5 w-3.5" style={{ color: AMANCO.green }} />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Mix de Produtos
            </p>
          </div>
          {reached
            ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            : <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          }
        </div>
        <p className="text-xs text-muted-foreground mb-0.5">Produtos distintos vendidos</p>
        <p className="text-2xl font-black mb-0.5" style={{ color: AMANCO.navy }}>
          {vendor.mixCount}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Mínimo: {mixMinimo} produto{mixMinimo !== 1 ? "s" : ""}
        </p>
        <ProgressBar value={progress} color={reached ? AMANCO.green : AMANCO.orange} className="mb-2" />
        <div className="flex items-center justify-between">
          <p className={cn("text-xs font-semibold", reached ? "text-green-600" : "text-orange-500")}>
            {reached
              ? "✓ Mix atingido!"
              : `Faltam ${mixMinimo - vendor.mixCount} produto${mixMinimo - vendor.mixCount !== 1 ? "s" : ""}`
            }
          </p>
          <p className="text-xs font-bold" style={{ color: AMANCO.green }}>
            {progress.toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── KPI card: Crescimento ───────────────────────────────────────────────────
function CrescimentoCard({ vendor }: { vendor: VendedorApuracao }) {
  const perc = vendor.crescimentoPerc ?? 0;
  const positive = perc >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? AMANCO.green : AMANCO.orange;

  return (
    <div className="rounded-2xl bg-white dark:bg-card border border-border shadow-sm overflow-hidden">
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}18` }}>
            <Icon className="h-3.5 w-3.5" style={{ color }} />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Crescimento vs. Ano Anterior
          </p>
        </div>
        <p className="text-xs text-muted-foreground mb-1">Seu crescimento em relação ao ano anterior</p>
        <div className="flex items-end gap-2 mb-3">
          <p className="text-3xl font-black" style={{ color }}>
            {positive ? "+" : ""}{perc.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground pb-1">de crescimento pessoal</p>
        </div>
        {/* Simple bar */}
        <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, Math.abs(perc))}%`,
              backgroundColor: color,
              marginLeft: positive ? 0 : "auto",
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {positive
            ? "Crescimento acima do ano anterior"
            : "Abaixo do período comparativo"}
        </p>
      </div>
    </div>
  );
}

// ─── KPI card: Prêmio / Posição ───────────────────────────────────────────────
function PremioCard({ vendor }: { vendor: VendedorApuracao }) {
  const awarded = vendor.premiado;
  const color = awarded ? AMANCO.green : AMANCO.navy;

  return (
    <div className="rounded-2xl bg-white dark:bg-card border border-border shadow-sm overflow-hidden">
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}18` }}>
            <Gift className="h-3.5 w-3.5" style={{ color }} />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {awarded ? "Meu Prêmio" : "Minha Posição"}
          </p>
        </div>

        {awarded && vendor.premioFinal > 0 ? (
          <>
            <p className="text-xs text-muted-foreground mb-1">Comissão calculada</p>
            <p className="text-2xl font-black mb-1" style={{ color: AMANCO.green }}>
              {fmtBRL(vendor.premioFinal)}
            </p>
            {vendor.categoria && (
              <p className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1"
                style={{ backgroundColor: `${AMANCO.green}15`, color: AMANCO.green }}>
                {vendor.categoria}
              </p>
            )}
          </>
        ) : vendor.posicao != null ? (
          <>
            <p className="text-xs text-muted-foreground mb-1">Posição no ranking atual</p>
            <p className="text-2xl font-black" style={{ color: AMANCO.navy }}>
              #{vendor.posicao}º lugar
            </p>
            {vendor.posicaoCrescimento != null && vendor.posicaoCrescimento !== vendor.posicao && (
              <p className="text-xs text-muted-foreground mt-1">
                #{vendor.posicaoCrescimento}º crescimento
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-1">Prêmio estimado</p>
            <p className="text-lg font-bold text-muted-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-1">Atingir os requisitos para habilitar</p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Ranking geral ────────────────────────────────────────────────────────────
function RankingSection({ results }: { results: ApuracaoResult }) {
  const podiumColors = [AMANCO.orange, "#C0C0C0", "#CD7F32"];
  const sorted = [...results.detalhes]
    .filter(d => d.posicao != null && d.participou)
    .sort((a, b) => (a.posicao ?? 999) - (b.posicao ?? 999))
    .slice(0, 10);

  if (sorted.length === 0) return (
    <p className="text-sm text-muted-foreground text-center py-4">
      Nenhum participante no ranking ainda.
    </p>
  );

  return (
    <div className="rounded-2xl bg-white dark:bg-card border border-border overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2"
        style={{ backgroundColor: `${AMANCO.navy}08` }}>
        <Trophy className="h-4 w-4" style={{ color: AMANCO.cyan }} />
        <p className="text-sm font-bold" style={{ color: AMANCO.navy }}>Ranking de Volume</p>
      </div>
      <div className="divide-y divide-border">
        {sorted.map(d => {
          const pos = d.posicao!;
          const isPodium = pos <= 3;
          return (
            <div key={d.vendedorId} className={cn(
              "flex items-center gap-3 px-4 py-3",
              isPodium && "bg-amber-50/40 dark:bg-amber-900/10"
            )}>
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black"
                style={{
                  backgroundColor: isPodium ? podiumColors[pos - 1] : `${AMANCO.cyan}20`,
                  color: isPodium ? "white" : AMANCO.navy,
                }}
              >
                {pos}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{d.vendedorNome}</p>
                {d.categoria && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${AMANCO.cyan}15`, color: AMANCO.cyan }}>
                    {d.categoria}
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums" style={{ color: AMANCO.navy }}>
                  {fmtBRL(d.valorApuracao)}
                </p>
                {d.premiado && (
                  <p className="text-[10px] font-semibold" style={{ color: AMANCO.green }}>
                    {fmtBRL(d.premioFinal)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Summary footer */}
      <div className="px-4 py-3 border-t border-border grid grid-cols-3 gap-2"
        style={{ backgroundColor: `${AMANCO.navy}05` }}>
        {[
          { label: "Participantes", value: results.totalParticipantes, Icon: Users },
          { label: "Atingiram meta", value: results.totalAtingidos, Icon: Target },
          { label: "Premiados", value: results.totalPremiados, Icon: Gift },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className="text-lg font-black" style={{ color: AMANCO.cyan }}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Premiação section ────────────────────────────────────────────────────────
function PremiacaoSection({ campaign }: { campaign: Campaign }) {
  const { rewards } = campaign;
  const isTier = rewards.type === "FAIXA";
  const isComissao = rewards.type === "COMISSAO_PERCENTUAL" || rewards.type === "PERCENTUAL";
  const isFixo = rewards.type === "VALOR_FIXO";

  return (
    <div className="rounded-2xl bg-white dark:bg-card border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2"
        style={{ backgroundColor: `${AMANCO.green}0a` }}>
        <Gift className="h-4 w-4" style={{ color: AMANCO.green }} />
        <div>
          <p className="text-sm font-bold" style={{ color: AMANCO.navy }}>
            {REWARD_TYPE_LABEL[rewards.type] || rewards.type}
          </p>
          <p className="text-xs text-muted-foreground">{rewards.scope === "individual" ? "Prêmio individual" : "Prêmio coletivo"}</p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {(isFixo || isComissao) && rewards.baseValue != null && rewards.baseValue > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-xl"
            style={{ backgroundColor: `${AMANCO.cyan}0a`, border: `1px solid ${AMANCO.cyan}25` }}>
            <div>
              <p className="text-xs text-muted-foreground">
                {isFixo ? "Prêmio fixo por atingimento" : "Comissão percentual sobre vendas"}
              </p>
              <p className="text-2xl font-black" style={{ color: AMANCO.navy }}>
                {isFixo ? fmtBRL(rewards.baseValue) : `${rewards.baseValue}%`}
              </p>
            </div>
          </div>
        )}

        {isTier && rewards.tiers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {rewards.tiers.some(t => t.percent && t.percent > 0) ? "Faixas de comissão" : "Faixas de prêmio"}
            </p>
            {rewards.tiers.map((tier, i) => {
              const isPercent = tier.percent != null && tier.percent > 0;
              const colors = [AMANCO.cyan, AMANCO.green, AMANCO.navy, AMANCO.orange];
              const col = colors[i % colors.length];
              return (
                <div key={tier.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black text-white"
                      style={{ backgroundColor: col }}>
                      {i + 1}
                    </div>
                    <div>
                      {tier.label && <p className="text-sm font-bold">{tier.label}</p>}
                      <p className="text-xs text-muted-foreground">
                        {tier.min !== undefined && tier.max != null
                          ? `${fmtBRL(tier.min)} – ${fmtBRL(tier.max)}`
                          : tier.min !== undefined ? `≥ ${fmtBRL(tier.min)}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black" style={{ color: col }}>
                    {isPercent ? `${tier.percent}%` : fmtBRL(tier.value)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {rewards.type === "RANKING" && rewards.posicoes && rewards.posicoes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Premiação por posição
            </p>
            {rewards.posicoes.map((pos, i) => {
              const icons = [Trophy, Award, Star];
              const Icon = icons[Math.min(i, 2)];
              const cols = [AMANCO.orange, "#9CA3AF", "#CD7F32"];
              const col = cols[Math.min(i, 2)];
              return (
                <div key={pos.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 shrink-0" style={{ color: col }} />
                    <div>
                      <p className="text-sm font-bold">{pos.posicao}º lugar</p>
                      {pos.label && <p className="text-xs text-muted-foreground">{pos.label}</p>}
                    </div>
                  </div>
                  <span className="text-sm font-black" style={{ color: AMANCO.navy }}>
                    {fmtBRL(pos.valor)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {rewards.minCutoff != null && rewards.minCutoff > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: `${AMANCO.orange}15`, color: AMANCO.orange, border: `1px solid ${AMANCO.orange}30` }}>
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Corte mínimo: {fmtBRL(rewards.minCutoff)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-[180px] rounded-2xl" style={{ backgroundColor: `${AMANCO.navy}20` }} />
      <div className="h-20 rounded-2xl bg-muted/50" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-[140px] rounded-2xl bg-muted/40" />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VendorCampaignDashboard({ campaignId }: { campaignId: string }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: campaign, isLoading, isError } = useQuery<Campaign>({
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

  const liveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/resultados/live`, {});
      if (!res.ok) throw new Error("Erro ao calcular resultados");
      return res.json() as Promise<ApuracaoResult>;
    },
    onSuccess: (data) => {
      qc.setQueryData([`/api/campaigns/${campaignId}/resultados`], data);
    },
  });

  useEffect(() => {
    liveMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  if (isLoading) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Skeleton />
    </div>
  );

  if (isError || !campaign) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <AlertCircle className="h-10 w-10 text-destructive/60" />
      <p>Campanha não encontrada.</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/campanhas")}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
      </Button>
    </div>
  );

  const isActive = campaign.status === "ativa";
  const dl = daysLeft(campaign.ends_at);
  const isCalc = liveMutation.isPending;

  // My personal result
  const myResult: VendedorApuracao | null =
    results?.detalhes?.find(d => d.vendedorId === user?.vendorId) ?? null;

  // Mix threshold from campaign config
  const mixMinimo = campaign.bases?.elegibilidade?.mix_minimo ?? 0;

  // Decide which KPI cards to show
  const showMix = mixMinimo > 0;
  const showCrescimento = myResult?.crescimentoPerc != null;

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: AMANCO.gray }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-5 py-5 space-y-4 pb-10">

        {/* ── Hero ── */}
        <CampaignHeroAmanco
          campaign={campaign}
          onBack={() => navigate("/campanhas")}
          isActive={isActive}
          daysLeft={dl}
        />

        {/* ── Calculating state ── */}
        {isCalc && !results && (
          <div
            className="flex items-center gap-3 px-4 py-4 rounded-2xl text-sm shadow-sm"
            style={{ backgroundColor: `${AMANCO.cyan}12`, border: `1px solid ${AMANCO.cyan}30` }}
          >
            <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: AMANCO.cyan }} />
            <p style={{ color: AMANCO.navy }} className="font-medium">
              Calculando seus resultados em tempo real…
            </p>
          </div>
        )}

        {/* ── Meu resultado pessoal ── */}
        {myResult && (
          <>
            {/* Eligibility card */}
            <EligibilityCard vendor={myResult} />

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
              <FaturamentoCard vendor={myResult} />

              {showMix
                ? <MixCard vendor={myResult} mixMinimo={mixMinimo} />
                : <PremioCard vendor={myResult} />
              }

              {showCrescimento
                ? <CrescimentoCard vendor={myResult} />
                : !showMix
                  ? null
                  : <PremioCard vendor={myResult} />
              }

              {showMix && <PremioCard vendor={myResult} />}
            </div>

            {/* Update timestamp + refresh */}
            {results && (
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-muted-foreground">
                  Atualizado em {fmtDate(results.apuradoEm)}
                </p>
                <button
                  onClick={() => liveMutation.mutate()}
                  disabled={isCalc}
                  className="flex items-center gap-1.5 text-xs font-semibold transition-colors px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: `${AMANCO.cyan}15`,
                    color: AMANCO.cyan,
                    border: `1px solid ${AMANCO.cyan}30`,
                  }}
                >
                  <RefreshCw className={cn("h-3 w-3", isCalc && "animate-spin")} />
                  Atualizar
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Ranking geral ── */}
        {results && (
          <CollapsibleSection id={`vd-ranking-${campaignId}`} title="Ranking Geral" defaultOpen={false}>
            <RankingSection results={results} />
          </CollapsibleSection>
        )}

        {/* ── Premiação ── */}
        <CollapsibleSection id={`vd-premio-${campaignId}`} title="Premiação" defaultOpen={false}>
          <PremiacaoSection campaign={campaign} />
        </CollapsibleSection>

        {/* ── Regras (natural language description) ── */}
        {campaign.natural_language && (
          <CollapsibleSection id={`vd-regras-${campaignId}`} title="Como funciona" defaultOpen={false}>
            <div className="rounded-2xl bg-white dark:bg-card border border-border p-4 shadow-sm">
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {campaign.natural_language}
              </p>
            </div>
          </CollapsibleSection>
        )}

        {/* Footer */}
        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            {campaign.code} · {STATUS_LABEL[campaign.status]} · Período {fmtDate(campaign.starts_at)} a {fmtDate(campaign.ends_at)}
          </p>
          {/* Amanco brand mark */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <div className="flex gap-1">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: AMANCO.cyan }} />
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: AMANCO.green }} />
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: AMANCO.navy }} />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">AMANCO WAVIN</span>
          </div>
        </div>

      </div>
    </div>
  );
}
