import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import {
  RefreshCw, Loader2, TrendingUp, TrendingDown, Target,
  CheckCircle2, XCircle, Minus, Store, Link2, AlertCircle,
  Trophy, Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  type Campaign, type ApuracaoResult, type VendedorApuracao,
  STATUS_LABEL,
} from "./types";

// ─── Amanco brand palette ──────────────────────────────────────────────────
const A = {
  cyan:   "#00A8E1",
  navy:   "#002269",
  green:  "#00953B",
  orange: "#F68025",
  gray:   "#F1F2F2",
  lightBlue: "#EBF7FB",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }); }
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

// ─── Amanco Geometric SVG ────────────────────────────────────────────────────
function AmancoGeomSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 140" className={className} aria-hidden>
      <path d="M0,0 L70,0 A70,70 0 0,0 0,70 Z" fill="#00A8E1" opacity="0.9" />
      <path d="M70,0 L140,0 L140,70 A70,70 0 0,0 70,0 Z" fill="#00953B" opacity="0.85" />
      <path d="M0,70 A70,70 0 0,0 70,140 L0,140 Z" fill="#002269" opacity="0.8" />
      <path d="M70,140 A70,70 0 0,0 140,70 L140,140 Z" fill="#00A8E1" opacity="0.7" />
      <circle cx="70" cy="70" r="28" fill="white" opacity="0.1" />
    </svg>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, color, bg = "rgba(0,0,0,0.08)" }: { value: number; color: string; bg?: string }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: bg }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function CampaignHero({
  campaign, isActive, dl,
}: {
  campaign: Campaign; isActive: boolean; dl: number;
}) {
  const statusColors: Record<string, string> = {
    ativa: A.green, pausada: A.orange, encerrada: "#6B7280", cancelada: "#EF4444", rascunho: "#6B7280",
  };
  const statusLabel: Record<string, string> = {
    ativa: "Ativa", pausada: "Pausada", encerrada: "Encerrada", cancelada: "Cancelada", rascunho: "Rascunho",
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: `linear-gradient(140deg, ${A.navy} 0%, #001245 100%)` }}
    >
      {/* Geometric decoration */}
      <div className="absolute -top-8 -right-8 w-44 h-44 opacity-70 pointer-events-none">
        <AmancoGeomSvg />
      </div>
      <div className="absolute -bottom-10 -left-10 w-32 h-32 opacity-15 pointer-events-none">
        <AmancoGeomSvg />
      </div>

      <div className="relative z-10 px-4 pt-5 pb-6 max-w-2xl mx-auto">
        {/* Status pill — top right */}
        <div className="flex justify-end mb-3">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: statusColors[campaign.status] || "#6B7280" }}
          >
            {statusLabel[campaign.status] || campaign.status}
          </span>
        </div>

        {/* Logo — centred, prominent */}
        {campaign.logo_url ? (
          <div className="flex justify-center mb-5">
            <div
              className="bg-white rounded-2xl shadow-xl flex items-center justify-center"
              style={{ padding: "10px 24px", border: "2px solid rgba(255,255,255,0.9)" }}
            >
              <img
                src={campaign.logo_url}
                alt={campaign.supplier_name || "Logo"}
                className="h-12 w-auto object-contain"
                style={{ maxWidth: 180 }}
              />
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-5">
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-xl"
              style={{ backgroundColor: A.cyan }}
            >
              {(campaign.supplier_name || "A").slice(0, 2).toUpperCase()}
            </div>
          </div>
        )}

        {/* Campaign name */}
        <h1 className="text-2xl font-black text-white leading-tight mb-1 text-center">
          {campaign.name}
        </h1>
        <p className="text-sm text-white/55 mb-4 text-center">
          {fmtDate(campaign.starts_at)} – {fmtDate(campaign.ends_at)}
        </p>

        {/* Countdown chip */}
        {isActive && dl > 0 && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.18)" }}>
              {dl === 1 ? "Último dia!" : `${dl} dias restantes`}
            </div>
          </div>
        )}
      </div>

      {/* Bottom fade into page bg */}
      <div className="h-3" style={{ background: `linear-gradient(to bottom, transparent, ${A.lightBlue})` }} />
    </div>
  );
}

// ─── Eligibility card ─────────────────────────────────────────────────────────
function EligibilityCard({ vendor }: { vendor: VendedorApuracao }) {
  if (vendor.premiado) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-sm"
        style={{ backgroundColor: `${A.green}15`, border: `1.5px solid ${A.green}40` }}>
        <Trophy className="h-5 w-5 shrink-0" style={{ color: A.green }} />
        <div>
          <p className="font-bold text-sm" style={{ color: A.green }}>Parabéns — você é premiado!</p>
          {vendor.categoria && <p className="text-xs opacity-70">{vendor.categoria}</p>}
        </div>
      </div>
    );
  }
  if (vendor.participou && vendor.atingiu) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-sm"
        style={{ backgroundColor: `${A.cyan}12`, border: `1.5px solid ${A.cyan}40` }}>
        <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: A.cyan }} />
        <p className="font-bold text-sm" style={{ color: A.navy }}>Elegível — aguardando encerramento do período</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-red-200">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-red-50">
        <XCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
        <p className="font-bold text-red-800 text-sm">Ainda não elegível para premiação</p>
      </div>
      {vendor.motivosNaoParticipacao.length > 0 && (
        <div className="px-4 py-2.5 bg-red-50/60 space-y-1">
          {vendor.motivosNaoParticipacao.map((m, i) => (
            <div key={i} className="flex items-start gap-2">
              <Minus className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{m}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Generic KPI card ─────────────────────────────────────────────────────────
interface KpiProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accentColor: string;
  progress?: number;
  progressLabel?: string;
  progressRight?: string;
  statusIcon?: React.ReactNode;
}
function KpiCard({ icon, label, value, sub, accentColor, progress, progressLabel, progressRight, statusIcon }: KpiProps) {
  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden border border-gray-100">
      <div className="h-1" style={{ backgroundColor: accentColor }} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${accentColor}15` }}>
              {icon}
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
          </div>
          {statusIcon}
        </div>
        <div className="mb-1.5">{value}</div>
        {sub && <p className="text-xs text-gray-400 mb-3">{sub}</p>}
        {progress !== undefined && (
          <>
            <ProgressBar value={progress} color={accentColor} />
            {(progressLabel || progressRight) && (
              <div className="flex justify-between mt-2">
                {progressLabel && <p className="text-xs font-semibold" style={{ color: accentColor }}>{progressLabel}</p>}
                {progressRight && <p className="text-xs font-bold text-gray-400">{progressRight}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Faturamento card ─────────────────────────────────────────────────────────
function FaturamentoCard({ vendor }: { vendor: VendedorApuracao }) {
  const progress = pct(vendor.valorApuracao, vendor.gatilhoValor);
  const reached = vendor.gatilhoAtingido;
  const falta = Math.max(0, vendor.gatilhoValor - vendor.valorApuracao);
  const color = reached ? A.green : A.cyan;

  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden border border-gray-100 col-span-2">
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
              <Target className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Gatilho Mínimo</p>
              <p className="text-xs text-gray-400">Faturamento Amanco no trimestre</p>
            </div>
          </div>
          {reached
            ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            : <XCircle className="h-5 w-5 text-red-400 shrink-0" />
          }
        </div>
        <div className="flex items-end gap-3 mb-4">
          <p className="text-4xl font-black leading-none" style={{ color: A.navy }}>{fmtBRL(vendor.valorApuracao)}</p>
          <p className="text-sm text-gray-400 mb-1">de {fmtBRL(vendor.gatilhoValor)}</p>
        </div>
        <ProgressBar value={progress} color={color} bg="rgba(0,0,0,0.06)" />
        <div className="flex justify-between mt-2.5">
          <p className={cn("text-sm font-semibold", reached ? "text-green-600" : "text-red-500")}>
            {reached ? "✓ Meta atingida!" : `Falta ${fmtBRL(falta)}`}
          </p>
          <p className="text-sm font-black" style={{ color }}>{progress.toFixed(0)}%</p>
        </div>
      </div>
    </div>
  );
}

// ─── Crescimento Pessoal card ─────────────────────────────────────────────────
function CrescimentoPessoalCard({ vendor }: { vendor: VendedorApuracao }) {
  const perc = vendor.crescimentoPerc ?? 0;
  const positive = perc >= 0;
  const color = positive ? A.green : A.orange;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <KpiCard
      icon={<Icon className="h-3.5 w-3.5" style={{ color }} />}
      label="Crescimento Pessoal"
      accentColor={color}
      value={
        <p className="text-2xl font-black" style={{ color }}>
          {positive ? "+" : ""}{perc.toFixed(1)}%
        </p>
      }
      sub={positive ? "↑ Acima do ano anterior" : "↓ Abaixo do ano anterior"}
      progress={Math.min(100, Math.abs(perc))}
      progressLabel={positive ? "Crescimento" : "Queda"}
      progressRight="vs ano anterior"
    />
  );
}

// ─── Crescimento Loja card ────────────────────────────────────────────────────
function CrescimentoLojaCard({ perc }: { perc: number | null | undefined }) {
  if (perc == null) {
    return (
      <KpiCard
        icon={<Store className="h-4 w-4" style={{ color: A.navy }} />}
        label="Crescimento Loja"
        accentColor={A.navy}
        value={<p className="text-sm font-semibold text-gray-400">Sem período comparativo</p>}
        sub="Configure o período base nas regras"
      />
    );
  }
  const positive = perc >= 0;
  const color = positive ? A.green : A.orange;
  return (
    <KpiCard
      icon={<Store className="h-4 w-4" style={{ color }} />}
      label="Crescimento Loja"
      accentColor={color}
      value={
        <p className="text-2xl font-black" style={{ color }}>
          {positive ? "+" : ""}{perc.toFixed(1)}%
        </p>
      }
      sub={positive ? "↑ Loja acima do ano anterior" : "↓ Loja abaixo do ano anterior"}
      progress={Math.min(100, Math.abs(perc))}
      progressLabel={positive ? "Crescimento geral" : "Queda geral"}
      progressRight="vs ano anterior"
    />
  );
}

// ─── Gauge / Velocímetro SVG ──────────────────────────────────────────────────
function GaugeMeter({
  value,        // 0‒100
  label,
  sublabel,
  color,
  pending = false,
}: {
  value: number;
  label: string;
  sublabel?: string;
  color: string;
  pending?: boolean;
}) {
  // Half-circle gauge: arc from 180° to 0° (left → right)
  const W = 200;
  const H = 114;
  const cx = W / 2;
  const cy = H - 6;
  const R = 80;
  const strokeW = 14;

  // Convert value (0-100) to angle (180° → 0°, i.e. left to right)
  const angleDeg = 180 - (Math.min(100, Math.max(0, value)) / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;
  const needleX = cx + (R - strokeW / 2 - 2) * Math.cos(angleRad);
  const needleY = cy - (R - strokeW / 2 - 2) * Math.sin(angleRad);

  // Arc path helper: full half-circle from left to right
  function arcPath(r: number, fromDeg: number, toDeg: number) {
    const f = (d: number) => ({
      x: cx + r * Math.cos((d * Math.PI) / 180),
      y: cy - r * Math.sin((d * Math.PI) / 180),
    });
    const start = f(fromDeg);
    const end = f(toDeg);
    const sweep = toDeg > fromDeg ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 0 ${sweep} ${end.x} ${end.y}`;
  }

  // Zone colors for the track (red→orange→green)
  const zones = [
    { from: 180, to: 120, color: "#EF4444" },
    { from: 120, to: 60,  color: A.orange },
    { from: 60,  to: 0,   color: A.green },
  ];

  return (
    <div className="flex flex-col items-center">
      <svg width={W} height={H + 8} viewBox={`0 0 ${W} ${H + 8}`} className="overflow-visible">
        {/* Track zones */}
        {zones.map((z, i) => (
          <path
            key={i}
            d={arcPath(R, z.from, z.to)}
            fill="none"
            stroke={z.color}
            strokeWidth={strokeW}
            strokeLinecap="butt"
            opacity={0.18}
          />
        ))}
        {/* Value arc (from 180° down to current angle) */}
        {!pending && value > 0 && (
          <path
            d={arcPath(R, 180, angleDeg)}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        )}
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((t) => {
          const tDeg = 180 - (t / 100) * 180;
          const tRad = (tDeg * Math.PI) / 180;
          const inner = R - strokeW / 2 - 2;
          const outer = R + strokeW / 2 + 1;
          return (
            <line
              key={t}
              x1={cx + inner * Math.cos(tRad)} y1={cy - inner * Math.sin(tRad)}
              x2={cx + outer * Math.cos(tRad)} y2={cy - outer * Math.sin(tRad)}
              stroke="rgba(0,0,0,0.2)" strokeWidth={1.5}
            />
          );
        })}
        {/* Needle */}
        {!pending && (
          <>
            <line
              x1={cx} y1={cy}
              x2={needleX} y2={needleY}
              stroke={color} strokeWidth={3.5} strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r={8} fill={color} />
            <circle cx={cx} cy={cy} r={4} fill="white" />
          </>
        )}
        {/* Centre value text */}
        <text x={cx} y={cy - 16} textAnchor="middle" fontSize={pending ? 11 : 20}
          fontWeight="800" fill={pending ? "#9CA3AF" : color}>
          {pending ? "—" : `${value.toFixed(0)}%`}
        </text>
        {/* Min/Max labels */}
        <text x={6} y={H + 8} fontSize={9} fill="#9CA3AF">0%</text>
        <text x={W - 6} y={H + 8} fontSize={9} fill="#9CA3AF" textAnchor="end">100%</text>
      </svg>
      {label && <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">{label}</p>}
      {sublabel && <p className="text-xs text-gray-400 text-center mt-1">{sublabel}</p>}
    </div>
  );
}

// ─── Conexões sobre Tubos card (velocímetro — full width) ─────────────────────
function ConexoesTubosCard({ vendor: _vendor }: { vendor: VendedorApuracao }) {
  const pending = true;
  const value = 0;
  const color = A.cyan;

  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden border border-gray-100 col-span-2">
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}15` }}>
            <Link2 className="h-4 w-4" style={{ color }} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Conexões / Tubos</p>
            <p className="text-xs text-gray-400">Proporção de conexões sobre tubos vendidos</p>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <GaugeMeter
            value={value}
            label=""
            sublabel={pending ? "Classificação de produtos pendente" : undefined}
            color={color}
            pending={pending}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Posição / Prêmio card ────────────────────────────────────────────────────
function PosicaoCard({ vendor }: { vendor: VendedorApuracao }) {
  const awarded = vendor.premiado;
  const color = awarded ? A.green : A.navy;
  return (
    <KpiCard
      icon={<Gift className="h-3.5 w-3.5" style={{ color }} />}
      label={awarded ? "Meu Prêmio" : "Minha Posição"}
      accentColor={color}
      statusIcon={awarded ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : undefined}
      value={
        awarded && vendor.premioFinal > 0 ? (
          <p className="text-xl font-black" style={{ color: A.green }}>{fmtBRL(vendor.premioFinal)}</p>
        ) : vendor.posicao != null ? (
          <p className="text-xl font-black" style={{ color: A.navy }}>#{vendor.posicao}º lugar</p>
        ) : (
          <p className="text-sm font-semibold text-gray-400">—</p>
        )
      }
      sub={
        awarded
          ? vendor.categoria || "Meta atingida"
          : vendor.posicao != null
            ? "no ranking atual"
            : "Atingir os requisitos"
      }
    />
  );
}

// ─── Mix card ─────────────────────────────────────────────────────────────────
function MixCard({ vendor, mixMinimo }: { vendor: VendedorApuracao; mixMinimo: number }) {
  const progress = pct(vendor.mixCount, mixMinimo);
  const reached = vendor.mixCount >= mixMinimo;
  const color = reached ? A.green : A.orange;
  return (
    <KpiCard
      icon={<Trophy className="h-3.5 w-3.5" style={{ color }} />}
      label="Mix de Produtos"
      accentColor={color}
      statusIcon={reached
        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        : <XCircle className="h-3.5 w-3.5 text-red-400" />
      }
      value={
        <p className="text-xl font-black" style={{ color: A.navy }}>
          {vendor.mixCount} <span className="text-sm font-semibold text-gray-400">/ {mixMinimo}</span>
        </p>
      }
      sub={reached ? "✓ Mix atingido!" : `Faltam ${mixMinimo - vendor.mixCount} produto(s)`}
      progress={progress}
      progressLabel={reached ? "Completo" : `${progress.toFixed(0)}%`}
      progressRight="produtos"
    />
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div>
      <div className="h-44 animate-pulse" style={{ backgroundColor: `${A.navy}30` }} />
      <div className="px-4 py-4 space-y-3 max-w-2xl mx-auto">
        <div className="h-14 rounded-2xl bg-gray-200 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
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

  if (isLoading) return <Skeleton />;

  if (isError || !campaign) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
      <AlertCircle className="h-10 w-10 text-destructive/60" />
      <p>Campanha não encontrada.</p>
    </div>
  );

  const isActive = campaign.status === "ativa";
  const dl = daysLeft(campaign.ends_at);
  const isCalc = liveMutation.isPending;

  const myResult: VendedorApuracao | null =
    results?.detalhes?.find(d => d.vendedorId === user?.vendorId) ?? null;

  const mixMinimo = campaign.bases?.elegibilidade?.mix_minimo ?? 0;
  const showMix = mixMinimo > 0;
  const showCrescimento = myResult?.crescimentoPerc != null;

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: A.lightBlue }}>

      {/* ── Full-width hero ── */}
      <CampaignHero campaign={campaign} isActive={isActive} dl={dl} />

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto px-4 sm:px-5 py-4 space-y-3 pb-10">

        {/* Calculating banner */}
        {isCalc && !results && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm"
            style={{ backgroundColor: `${A.cyan}12`, border: `1px solid ${A.cyan}30` }}
          >
            <Loader2 className="h-4 w-4 animate-spin shrink-0" style={{ color: A.cyan }} />
            <p style={{ color: A.navy }} className="font-medium text-sm">Calculando seus resultados em tempo real…</p>
          </div>
        )}

        {/* ── Personal result ── */}
        {myResult && (
          <>
            <EligibilityCard vendor={myResult} />

            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Faturamento — full width */}
              <FaturamentoCard vendor={myResult} />

              {/* Crescimento Pessoal + Crescimento Loja */}
              {showCrescimento && <CrescimentoPessoalCard vendor={myResult} />}
              <CrescimentoLojaCard perc={results?.crescimentoLojaPerc} />

              {/* Conexões / Tubos — full width gauge */}
              <ConexoesTubosCard vendor={myResult} />

              {/* Mix — full width if configured */}
              {showMix && (
                <div className="col-span-2">
                  <MixCard vendor={myResult} mixMinimo={mixMinimo} />
                </div>
              )}
            </div>

            {/* Refresh row */}
            <div className="flex items-center justify-between px-1 pt-1">
              <p className="text-xs text-gray-400">
                {results ? `Atualizado em ${fmtDate(results.apuradoEm)}` : "Calculando…"}
              </p>
              <button
                onClick={() => liveMutation.mutate()}
                disabled={isCalc}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
                style={{ backgroundColor: `${A.cyan}15`, color: A.cyan, border: `1px solid ${A.cyan}30` }}
              >
                <RefreshCw className={cn("h-3 w-3", isCalc && "animate-spin")} />
                Atualizar
              </button>
            </div>
          </>
        )}

        {/* No result yet — show refresh prompt */}
        {!myResult && !isCalc && (
          <div className="text-center py-10">
            <p className="text-sm text-gray-400 mb-3">Nenhum resultado encontrado para este período.</p>
            <button
              onClick={() => liveMutation.mutate()}
              className="text-xs font-semibold px-4 py-2 rounded-full"
              style={{ backgroundColor: `${A.cyan}15`, color: A.cyan, border: `1px solid ${A.cyan}30` }}
            >
              <RefreshCw className="h-3 w-3 inline mr-1.5" />
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── Amanco footer mark ── */}
        <div className="pt-4 text-center space-y-1.5">
          <div className="flex items-center justify-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: A.cyan }} />
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: A.green }} />
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: A.navy }} />
          </div>
          <p className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">Amanco Wavin · {STATUS_LABEL[campaign.status]}</p>
          <p className="text-[10px] text-gray-300">
            {fmtDate(campaign.starts_at)} a {fmtDate(campaign.ends_at)}
          </p>
        </div>

      </div>
    </div>
  );
}
