import { cn } from "@/lib/utils";
import type { MetricStatus } from "./metric-card";

interface GaugeMeterProps {
  pct: number;
  value: string;
  targetLabel?: string;
  remainingLabel?: string;
  status: MetricStatus;
  className?: string;
}

const COLORS: Record<MetricStatus, { fill: string; track: string }> = {
  atingido: { fill: "#10b981", track: "#d1fae5" },
  quase:    { fill: "#f59e0b", track: "#fef3c7" },
  pendente: { fill: "#ef4444", track: "#fee2e2" },
  info:     { fill: "#6366f1", track: "#e0e7ff" },
};

const STATUS_BG: Record<MetricStatus, string> = {
  atingido: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  quase:    "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  pendente: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  info:     "bg-muted/60 text-muted-foreground",
};

function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function GaugeMeter({ pct, value, targetLabel, remainingLabel, status, className }: GaugeMeterProps) {
  /* ── Layout constants ─────────────────────────────────────────────────────
     viewBox: 200 × 128
     Center:  cx=100, cy=104  (lower than before → more room at top for ticks)
     Radius:  72               (slightly smaller to fit tick marks inside)
     Track:   12px wide
  ────────────────────────────────────────────────────────────────────────── */
  const cx = 100;
  const cy = 104;
  const r  = 72;
  const trackW = 12;
  const clamped = Math.min(Math.max(pct, 0), 100);

  const C     = 2 * Math.PI * r;
  const halfC = C / 2;
  const fillC = (clamped / 100) * halfC;
  const offset = C / 2;

  const c = COLORS[status];

  /* ── Tick marks ─────────────────────────────────────────────────────────── */
  const TICKS   = 36;
  const rOut    = r + trackW / 2 + 7;   // outer edge of tick
  const rMinor  = rOut - 6;
  const rMajor  = rOut - 10;
  const filledCount = Math.round((clamped / 100) * TICKS);

  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => {
    const angle   = 180 + (i / TICKS) * 180;
    const isMajor = i % 6 === 0;
    const outer   = polarToXY(cx, cy, rOut, angle);
    const inner   = polarToXY(cx, cy, isMajor ? rMajor : rMinor, angle);
    return { outer, inner, isMajor, filled: i < filledCount };
  });

  /* ── Scale label positions (anchored to the arc endpoints) ─────────────── */
  // Arc endpoints at 180° (left) and 360°/0° (right), both at y=cy
  // Scale labels sit slightly below the arc endpoints
  const labelY = cy + 13;

  return (
    <div className={cn("flex flex-col items-center gap-2 w-full", className)}>
      {/* viewBox height = 128 → comfortably contains cy=104, labelY=117, ticks top≈20 */}
      <svg viewBox="0 0 200 128" className="w-full max-w-[240px]" aria-hidden>
        <defs>
          <filter id={`glow-${status}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={c.fill} floodOpacity="0.4" />
          </filter>
        </defs>

        {/* ── Background track ── */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={c.track}
          strokeWidth={trackW}
          strokeDasharray={`${halfC.toFixed(2)} ${C.toFixed(2)}`}
          strokeDashoffset={offset.toFixed(2)}
          strokeLinecap="round"
        />

        {/* ── Fill arc ── */}
        {clamped > 0.5 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={c.fill}
            strokeWidth={trackW}
            strokeDasharray={`${fillC.toFixed(2)} ${C.toFixed(2)}`}
            strokeDashoffset={offset.toFixed(2)}
            strokeLinecap="round"
            filter={`url(#glow-${status})`}
          />
        )}

        {/* ── Tick marks ── */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.outer.x.toFixed(2)} y1={t.outer.y.toFixed(2)}
            x2={t.inner.x.toFixed(2)} y2={t.inner.y.toFixed(2)}
            stroke={t.filled ? c.fill : "#e5e7eb"}
            strokeWidth={t.isMajor ? 2 : 1}
            strokeLinecap="round"
          />
        ))}

        {/* ── Center dot ── */}
        <circle cx={cx} cy={cy} r={3} fill={c.fill} />

        {/* ── Main value — sits above center ── */}
        <text
          x={cx} y={cy - 22}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground"
          style={{ fontSize: 26, fontWeight: 900, fontFamily: "inherit", letterSpacing: "-0.5px" }}
        >
          {value}
        </text>

        {/* ── Target label — just below value ── */}
        {targetLabel && (
          <text
            x={cx} y={cy - 6}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 9.5, fontFamily: "inherit" }}
          >
            {targetLabel}
          </text>
        )}

        {/* ── Scale labels — safely inside viewBox ── */}
        <text
          x={22} y={labelY}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 8.5, fontFamily: "inherit" }}
        >
          0%
        </text>
        <text
          x={178} y={labelY}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 8.5, fontFamily: "inherit" }}
        >
          100%
        </text>

        {/* ── 50% mid label (above the top tick) ── */}
        <text
          x={cx} y={14}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 8, fontFamily: "inherit" }}
        >
          50%
        </text>
      </svg>

      {/* ── Remaining / note pill ── */}
      {remainingLabel && (
        <p className={cn(
          "text-center text-xs font-medium px-3 py-1.5 rounded-lg w-full leading-snug",
          STATUS_BG[status]
        )}>
          {remainingLabel}
        </p>
      )}
    </div>
  );
}
