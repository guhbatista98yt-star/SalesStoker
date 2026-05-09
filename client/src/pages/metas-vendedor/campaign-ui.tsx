import { AlertCircle, Award, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatDateBR } from "@/lib/calendar-utils";
import { SyncStatusBar } from "@/components/sync-status-bar";

export const NAVY = "#002269";
export const CYAN = "#00A8E1";
export const GREEN = "#00953B";
export const ORANGE = "#F68025";
export const PAGE_BG = "#EBF7FB";

export function daysRemaining(endDateStr: string): number {
  if (!endDateStr) return 0;
  const end = new Date(endDateStr.length === 10 ? `${endDateStr}T23:59:59` : endDateStr);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function signedPct(value: number, digits = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe >= 0 ? "+" : ""}${safe.toFixed(digits)}%`;
}

export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, 100));
}

export function safeDiv(num: number, den: number, fallback = 0): number {
  return den === 0 || !Number.isFinite(den) ? fallback : num / den;
}

export function CampaignLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
      <Loader2 size={36} color={CYAN} className="animate-spin" />
    </div>
  );
}

export function CampaignError({ campaignName }: { campaignName: string }) {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{
        background: "#FEF2F2",
        border: "1px solid #FECACA",
        borderRadius: 14,
        padding: 20,
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}>
        <AlertCircle size={20} color="#EF4444" />
        <span style={{ color: "#B91C1C", fontWeight: 500 }}>
          Nao foi possivel carregar os dados da {campaignName}.
        </span>
      </div>
    </div>
  );
}

export function CampaignPage({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: PAGE_BG }}>
      {children}
    </div>
  );
}

export function CampaignHero({
  title,
  startDate,
  endDate,
  eligible,
  logoUrl = "/amanco-wavin-logo-color-nobg.png",
  logoAlt = "Amanco Wavin",
  closed,
}: {
  title: string;
  startDate: string;
  endDate: string;
  eligible: boolean;
  logoUrl?: string;
  logoAlt?: string;
  closed?: boolean;
}) {
  const days = daysRemaining(endDate);
  const periodoEncerrado = closed ?? days === 0;

  return (
    <div style={{
      background: "linear-gradient(140deg, #002269 0%, #001245 100%)",
      padding: "32px 40px 36px",
      position: "relative",
      marginBottom: 24,
    }}>
      <span style={{
        position: "absolute",
        top: 20,
        right: 24,
        background: eligible ? "#00953B22" : "#ffffff22",
        border: `1px solid ${eligible ? GREEN : "#ffffff44"}`,
        color: eligible ? "#4ADE80" : "#ffffff99",
        fontSize: 12,
        fontWeight: 700,
        borderRadius: 99,
        padding: "4px 14px",
      }}>
        {eligible ? "ATIVA" : "PENDENTE"}
      </span>

      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        gap: 32,
        flexWrap: "wrap",
      }}>
        <div style={{
          background: "#fff",
          borderRadius: 20,
          padding: "14px 28px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          minWidth: 148,
          minHeight: 92,
        }}>
          <img
            src={logoUrl}
            alt={logoAlt}
            style={{ height: 64, width: "auto", display: "block" }}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: 0 }}>
            {title}
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
            {formatDateBR(startDate)} - {formatDateBR(endDate)}
          </div>
        </div>

        {!periodoEncerrado ? (
          <div style={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 99,
            padding: "8px 22px",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            flexShrink: 0,
          }}>
            {days} dias restantes
          </div>
        ) : (
          <div style={{
            background: "rgba(0,149,59,0.25)",
            border: "1px solid rgba(0,149,59,0.4)",
            borderRadius: 99,
            padding: "8px 22px",
            fontSize: 14,
            fontWeight: 600,
            color: "#4ADE80",
            flexShrink: 0,
          }}>
            Periodo encerrado
          </div>
        )}
      </div>
    </div>
  );
}

export function EligibilityBanner({
  eligible,
  closed,
  motivos = [],
  tv = false,
}: {
  eligible: boolean;
  closed: boolean;
  motivos?: string[];
  tv?: boolean;
}) {
  const awarded = eligible && closed;
  const bg = awarded ? "#F0FDF4" : eligible ? "#E0F7FF" : "#FEF2F2";
  const border = awarded ? "#86EFAC" : eligible ? "#7DD3FC" : "#FECACA";
  const iconColor = awarded ? GREEN : eligible ? CYAN : "#EF4444";
  const Icon = awarded ? Award : eligible ? CheckCircle2 : AlertCircle;
  const title = awarded
    ? tv ? "Elegivel para o Sorteio - Premio Garantido!" : "Premio Garantido!"
    : eligible
    ? tv ? "Elegivel para o Sorteio! Aguardando encerramento do periodo." : "Voce esta Elegivel! Aguardando encerramento do periodo."
    : "Ainda nao elegivel";

  return (
    <div style={{
      background: bg,
      border: `1.5px solid ${border}`,
      borderRadius: 14,
      padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: `${iconColor}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={20} color={iconColor} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: iconColor }}>{title}</div>
          {!eligible && motivos.length > 0 && (
            <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
              {motivos.map((motivo, index) => (
                <div key={`${motivo}-${index}`} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#B91C1C" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
                  <span>{motivo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function KpiCard({
  accentColor,
  icon,
  label,
  value,
  subtitle,
  progressValue,
  progressLeft,
  progressRight,
  wide,
}: {
  accentColor: string;
  icon: ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  progressValue?: number;
  progressLeft?: string;
  progressRight?: string;
  wide?: boolean;
}) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      border: "1px solid #F3F4F6",
      boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
      overflow: "hidden",
      height: "100%",
      gridColumn: wide ? "1 / -1" : undefined,
    }}>
      <div style={{ height: 4, background: accentColor }} />
      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: `${accentColor}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: accentColor,
          }}>
            {icon}
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "#9CA3AF",
            textTransform: "uppercase",
          }}>
            {label}
          </span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", lineHeight: 1.15 }}>{value}</div>
        {subtitle && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{subtitle}</div>}
        {progressValue !== undefined && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 12 }}>
              {progressLeft && <span style={{ fontSize: 11, color: "#9CA3AF" }}>{progressLeft}</span>}
              {progressRight && <span style={{ fontSize: 11, color: "#9CA3AF" }}>{progressRight}</span>}
            </div>
            <div style={{ height: 6, borderRadius: 99, background: `${accentColor}20`, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${clampPct(progressValue)}%`,
                background: accentColor,
                borderRadius: 99,
                transition: "width 700ms ease",
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function pt(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number) {
  const s = pt(cx, cy, r, fromDeg);
  const e = pt(cx, cy, r, toDeg);
  const large = (fromDeg - toDeg) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export function GaugeCard({
  valuePct,
  metaPct,
  label,
}: {
  valuePct: number;
  metaPct: number;
  label: string;
}) {
  const CX = 160;
  const CY = 130;
  const R = 100;
  const drawPct = clampPct(valuePct);
  const endDeg = 180 - drawPct * 1.8;
  const metaDeg = 180 - clampPct(metaPct) * 1.8;
  const accent = valuePct >= metaPct ? GREEN : ORANGE;
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      border: "1px solid #F3F4F6",
      boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
      overflow: "hidden",
      height: "100%",
    }}>
      <div style={{ height: 4, background: accent }} />
      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: `${accent}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: accent,
          }}>
            {label.slice(0, 1)}
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "#9CA3AF", textTransform: "uppercase" }}>
            {label}
          </span>
        </div>
        <svg viewBox="0 0 320 184" style={{ width: "100%", display: "block" }}>
          <path d={arc(CX, CY, R, 180, 120)} stroke={NAVY} strokeOpacity="0.18" strokeWidth="20" fill="none" strokeLinecap="round" />
          <path d={arc(CX, CY, R, 120, 60)} stroke={CYAN} strokeOpacity="0.18" strokeWidth="20" fill="none" strokeLinecap="round" />
          <path d={arc(CX, CY, R, 60, 0)} stroke={GREEN} strokeOpacity="0.18" strokeWidth="20" fill="none" strokeLinecap="round" />
          {drawPct > 0.5 && (
            <path d={arc(CX, CY, R, 180, endDeg)} stroke={accent} strokeWidth="20" fill="none" strokeLinecap="round" />
          )}
          {ticks.map(tick => {
            const deg = 180 - tick * 1.8;
            const inner = pt(CX, CY, R - 14, deg);
            const outer = pt(CX, CY, R + 14, deg);
            const text = pt(CX, CY, R + 27, deg);
            return (
              <g key={tick}>
                <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#D1D5DB" strokeWidth="1.5" />
                <text x={text.x} y={text.y + 3} textAnchor="middle" fontSize="9" fill="#9CA3AF">{tick}%</text>
              </g>
            );
          })}
          {(() => {
            const inner = pt(CX, CY, R - 20, metaDeg);
            const outer = pt(CX, CY, R + 20, metaDeg);
            const text = pt(CX, CY, R + 34, metaDeg);
            return (
              <g>
                <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#374151" strokeDasharray="4 3" strokeWidth="2.5" />
                <text x={text.x} y={text.y + 3} textAnchor="middle" fontSize="9" fill="#374151">meta {metaPct}%</text>
              </g>
            );
          })()}
          {(() => {
            const needle = pt(CX, CY, R - 14, endDeg);
            return <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke={accent} strokeWidth="3" strokeLinecap="round" />;
          })()}
          <circle cx={CX} cy={CY} r="9" fill={accent} />
          <circle cx={CX} cy={CY} r="4" fill="#fff" />
          <text x={CX} y={CY + 24} textAnchor="middle" fontSize="28" fontWeight="700" fill="#111827">
            {valuePct.toFixed(1)}%
          </text>
          <text x={CX} y={CY + 44} textAnchor="middle" fontSize="11" fill="#6B7280">
            sobre tubos - meta: {metaPct}%
          </text>
        </svg>
      </div>
    </div>
  );
}

export function FooterRefresh({
  updatedAt,
  onRefresh,
  label,
  syncRoutine,
}: {
  updatedAt: string;
  onRefresh: () => void;
  label: string;
  /** Rotina de sync ERP para exibir o botão de sincronização manual (ex: "campanhas") */
  syncRoutine?: string;
}) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, gap: 12 }}>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>Atualizado as {updatedAt}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {syncRoutine && (
            <SyncStatusBar routine={syncRoutine} label={label} />
          )}
          <button
            onClick={onRefresh}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#00A8E115",
              border: "1px solid #00A8E140",
              color: CYAN,
              borderRadius: 99,
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: CYAN }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: NAVY }} />
        <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 6 }}>{label}</span>
      </div>
    </>
  );
}

export function SmallInfoCard({
  icon: Icon,
  title,
  value,
  accentColor,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  accentColor: string;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #F3F4F6", padding: 16, boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${accentColor}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} color={accentColor} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{title}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{value}</div>
        </div>
      </div>
    </div>
  );
}
