import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/calendar-utils";
import { Calendar, CheckCircle2, Clock, Lock, Zap } from "lucide-react";

export type CampaignStatus = "ativa" | "encerrada" | "futura" | "pausada";
export type CampaignType = "atingimento" | "ranking" | "comissao" | "crescimento" | "mix" | "gatilho" | "sorteio";

interface CampaignHeroProps {
  supplierName: string;
  supplierInitials: string;
  brandColor: string;
  brandColorDark: string;
  campaignName: string;
  subtitle?: string;
  periodStart: string;
  periodEnd: string;
  status: CampaignStatus;
  type: CampaignType;
  typeLabel: string;
  eligible: boolean;
  eligibleLabel?: string;
  metrics?: { label: string; value: string; pct: number; ok: boolean }[];
}

const statusConfig: Record<CampaignStatus, { label: string; cls: string }> = {
  ativa:     { label: "Ativa",     cls: "bg-emerald-500/20 text-emerald-700 border-emerald-300" },
  encerrada: { label: "Encerrada", cls: "bg-slate-100 text-slate-600 border-slate-300" },
  futura:    { label: "Em breve",  cls: "bg-amber-100 text-amber-700 border-amber-300" },
  pausada:   { label: "Pausada",   cls: "bg-orange-100 text-orange-700 border-orange-300" },
};

const typeConfig: Record<CampaignType, { label: string; icon: React.ReactNode }> = {
  atingimento: { label: "Atingimento", icon: <CheckCircle2 className="h-3 w-3" /> },
  ranking:     { label: "Ranking",     icon: <Zap className="h-3 w-3" /> },
  comissao:    { label: "Comissão",    icon: <Zap className="h-3 w-3" /> },
  crescimento: { label: "Crescimento", icon: <Zap className="h-3 w-3" /> },
  mix:         { label: "Mix",         icon: <Zap className="h-3 w-3" /> },
  gatilho:     { label: "Gatilho",     icon: <Zap className="h-3 w-3" /> },
  sorteio:     { label: "Sorteio",     icon: <Zap className="h-3 w-3" /> },
};

export function CampaignHero({
  supplierName,
  supplierInitials,
  brandColor,
  brandColorDark,
  campaignName,
  subtitle,
  periodStart,
  periodEnd,
  status,
  type,
  typeLabel,
  eligible,
  eligibleLabel,
  metrics = [],
}: CampaignHeroProps) {
  const statusCfg = statusConfig[status];

  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-card">
      {/* ── Brand band ── */}
      <div
        className="relative px-5 sm:px-8 pt-6 pb-5"
        style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColorDark} 100%)` }}
      >
        {/* Subtle noise overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
        />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: logo + name */}
          <div className="flex items-center gap-4">
            {/* Supplier logo placeholder */}
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shrink-0">
              <span className="text-white font-black text-lg tracking-tighter">{supplierInitials}</span>
            </div>
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest leading-none mb-1">
                {supplierName}
              </p>
              <h1 className="text-white text-xl sm:text-2xl font-black tracking-tight leading-tight">
                {campaignName}
              </h1>
              {subtitle && (
                <p className="text-white/75 text-sm mt-0.5 font-medium">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right: status + type badges */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:flex-col sm:items-end">
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold", statusCfg.cls)}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                status === "ativa" ? "bg-emerald-500 animate-pulse" : "bg-current opacity-60"
              )} />
              {statusCfg.label}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold">
              {typeConfig[type]?.icon}
              {typeLabel || typeConfig[type]?.label}
            </span>
          </div>
        </div>

        {/* Period row */}
        <div className="relative flex items-center gap-2 mt-4">
          <Calendar className="h-3.5 w-3.5 text-white/60 shrink-0" />
          <span className="text-white/70 text-xs font-medium">
            {formatDateBR(periodStart)} — {formatDateBR(periodEnd)}
          </span>
        </div>
      </div>

      {/* ── White body with mini metric strip ── */}
      <div className="bg-card px-5 sm:px-8 py-4">
        {metrics.length > 0 ? (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {metrics.map((m, i) => (
              <div key={i} className="flex flex-col gap-1 min-w-[120px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                  <span className={cn(
                    "text-xs font-bold",
                    m.ok ? "text-emerald-600" : m.pct >= 75 ? "text-amber-600" : "text-red-500"
                  )}>
                    {m.value}
                  </span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      m.ok ? "bg-emerald-500" : m.pct >= 75 ? "bg-amber-500" : "bg-red-400"
                    )}
                    style={{ width: `${Math.min(m.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {eligible ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
            )}
            <span className={cn(
              "text-sm font-semibold",
              eligible ? "text-emerald-700" : "text-amber-700"
            )}>
              {eligibleLabel || (eligible ? "Você está elegível para esta campanha" : "Acompanhe seu progresso abaixo")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
