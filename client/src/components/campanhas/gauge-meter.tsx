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
  const cx = 100;
  const cy = 110;
  const r = 76;
  const trackW = 14;
  const clamped = Math.min(Math.max(pct, 0), 100);

  /* ── stroke-dasharray approach ─────────────────────────────────────────────
     C = full circle circumference; halfC = top semicircle arc length.
     dashoffset = C/2 shifts the start point from 3-o-clock to 9-o-clock.
     The circle draws clockwise, so from 9-o-clock it goes through 12 (top)
     to 3-o-clock — exactly the upper semicircle we want.
  ─────────────────────────────────────────────────────────────────────────── */
  const C     = 2 * Math.PI * r;          // ≈ 477.5
  const halfC = C / 2;                     // ≈ 238.7
  const fillC = (clamped / 100) * halfC;  // arc length to fill
  const offset = C / 2;                   // shift so arc starts at 9-o-clock

  const c = COLORS[status];

  /* ── Tick marks ─────────────────────────────────────────────────────────── */
  const TICKS = 36;
  const rOut   = r + trackW / 2 + 9;
  const rMinor = rOut - 7;
  const rMajor = rOut - 12;
  const filledCount = Math.round((clamped / 100) * TICKS);

  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => {
    // angle: 180° = left (0%), 360° = right (100%), through 270° = top (50%)
    const angle   = 180 + (i / TICKS) * 180;
    const isMajor = i % 6 === 0;
    const outer   = polarToXY(cx, cy, rOut, angle);
    const inner   = polarToXY(cx, cy, isMajor ? rMajor : rMinor, angle);
    return { outer, inner, isMajor, filled: i < filledCount };
  });

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <svg viewBox="0 0 200 120" className="w-full max-w-[240px]" aria-hidden>
        <defs>
          <filter id={`glow-${status}`} x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={c.fill} floodOpacity="0.4" />
          </filter>
        </defs>

        {/* ── Background track (top semicircle) ── */}
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

        {/* ── Tick marks (positioned with trigonometry, same angle as arcs) ── */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.outer.x.toFixed(2)} y1={t.outer.y.toFixed(2)}
            x2={t.inner.x.toFixed(2)} y2={t.inner.y.toFixed(2)}
            stroke={t.filled ? c.fill : "#e5e7eb"}
            strokeWidth={t.isMajor ? 2.2 : 1.1}
            strokeLinecap="round"
          />
        ))}

        {/* ── Center dot ── */}
        <circle cx={cx} cy={cy} r={3.5} fill={c.fill} />

        {/* ── Main value ── */}
        <text
          x={cx} y={cy - 20}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground"
          style={{ fontSize: 28, fontWeight: 900, fontFamily: "inherit", letterSpacing: "-0.5px" }}
        >
          {value}
        </text>

        {/* ── Target label ── */}
        {targetLabel && (
          <text
            x={cx} y={cy - 4}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 10, fontFamily: "inherit" }}
          >
            {targetLabel}
          </text>
        )}

        {/* ── Scale labels ── */}
        <text x={18} y={cy + 14} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "inherit" }}>0%</text>
        <text x={182} y={cy + 14} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "inherit" }}>100%</text>
      </svg>

      {/* ── Remaining / note ── */}
      {remainingLabel && (
        <p className={cn("text-center text-xs font-medium px-3 py-1.5 rounded-lg w-full", STATUS_BG[status])}>
          {remainingLabel}
        </p>
      )}
    </div>
  );
}
