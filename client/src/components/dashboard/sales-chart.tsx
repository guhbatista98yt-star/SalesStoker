import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/calendar-utils";

interface SalesChartData {
  label: string;
  atual: number;
  anterior: number;
  variacao: number | null;
}

interface SalesChartProps {
  weeklyData: SalesChartData[];
  monthlyData: SalesChartData[];
  loading?: boolean;
  dragHandle?: React.ReactNode;
}

function useChartColors() {
  const getColors = () => {
    const s = getComputedStyle(document.documentElement);
    const p = s.getPropertyValue("--primary").trim();
    const mf = s.getPropertyValue("--muted-foreground").trim();
    return { primary: `hsl(${p})`, muted: `hsl(${mf} / 0.4)` };
  };
  const [colors, setColors] = useState(getColors);
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(getColors()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-logo-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return colors;
}

/* ── Premium tooltip ─────────────────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover border border-border rounded-xl shadow-md p-3 min-w-[160px]">
      <p className="text-xs font-semibold text-foreground mb-2 border-b border-border pb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-xs font-semibold text-foreground">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Chart skeleton ──────────────────────────────────────────────────────────── */
function ChartSkeleton() {
  return (
    <div className="h-[280px] flex items-end gap-2 px-4 pb-4">
      {[40, 65, 50, 80, 55, 70, 45, 90, 60, 75, 55, 85].map((h, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end gap-1">
          <div className="skeleton rounded-t-sm" style={{ height: `${h * 0.7}%` }} />
          <div className="skeleton rounded-t-sm opacity-40" style={{ height: `${h * 0.4}%` }} />
        </div>
      ))}
    </div>
  );
}

/* ── Chart content ───────────────────────────────────────────────────────────── */
function SalesBarChart({ data, primaryColor, mutedColor }: { data: SalesChartData[]; primaryColor: string; mutedColor: string }) {
  const total = data.reduce((s, d) => s + (Number(d.atual) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2 px-0.5">
        <span className="text-2xl font-bold tracking-tight tabular-nums">{formatCurrency(total)}</span>
        <TrendingUp className="h-4 w-4 text-emerald-500" />
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%" debounce={300}>
          <ComposedChart data={data} barGap={2}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.6}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => {
                const abs = Math.abs(v);
                if (abs >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)} tri`;
                if (abs >= 1_000_000_000)     return `${(v / 1_000_000_000).toFixed(1)} bi`;
                if (abs >= 1_000_000)         return `${(v / 1_000_000).toFixed(1)} mi`;
                if (abs >= 1_000)             return `${(v / 1_000).toFixed(0)}k`;
                return String(v);
              }}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)", radius: 6 }} />
            <Bar
              dataKey="atual"
              name="Período Atual"
              fill={primaryColor}
              radius={[5, 5, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Bar
              dataKey="anterior"
              name="Ano Anterior"
              fill={mutedColor}
              radius={[5, 5, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────────── */
export function SalesChart({ weeklyData, monthlyData, loading, dragHandle }: SalesChartProps) {
  const { primary: primaryColor, muted: mutedColor } = useChartColors();

  return (
    <Card data-testid="sales-chart">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {dragHandle}
          <BarChart3 className="h-4 w-4 text-primary" />
          Evolução de Vendas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : (
          <Tabs defaultValue="monthly" className="w-full">
            <TabsList className="h-8 rounded-lg mb-4">
              <TabsTrigger value="weekly" className="text-xs h-6 rounded-md px-3" data-testid="tab-sales-weekly">
                Semanal
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs h-6 rounded-md px-3" data-testid="tab-sales-monthly">
                Mensal
              </TabsTrigger>
            </TabsList>
            <TabsContent value="weekly">
              <SalesBarChart data={weeklyData} primaryColor={primaryColor} mutedColor={mutedColor} />
            </TabsContent>
            <TabsContent value="monthly">
              <SalesBarChart data={monthlyData} primaryColor={primaryColor} mutedColor={mutedColor} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
