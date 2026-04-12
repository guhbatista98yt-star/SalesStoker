import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Line, ComposedChart, Area, AreaChart,
} from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/calendar-utils";

interface SalesChartData {
  label: string;
  atual: number;
  anterior: number;
  variacao: number;
}

interface SalesChartProps {
  weeklyData: SalesChartData[];
  monthlyData: SalesChartData[];
  loading?: boolean;
  dragHandle?: React.ReactNode;
}

/* ── Premium tooltip ─────────────────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover border border-border rounded-xl shadow-panel p-3 min-w-[160px]">
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
function SalesBarChart({ data }: { data: SalesChartData[] }) {
  const total = data.reduce((s, d) => s + d.atual, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2 px-0.5">
        <span className="text-2xl font-bold tracking-tight tabular-nums">{formatCurrency(total)}</span>
        <TrendingUp className="h-4 w-4 text-emerald-500" />
      </div>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
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
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)", radius: 6 }} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar
              dataKey="atual"
              name="Período Atual"
              fill="hsl(217 93% 52%)"
              radius={[5, 5, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="anterior"
              name="Ano Anterior"
              fill="hsl(214 20% 85%)"
              radius={[5, 5, 0, 0]}
              maxBarSize={32}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────────── */
export function SalesChart({ weeklyData, monthlyData, loading, dragHandle }: SalesChartProps) {
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
              <SalesBarChart data={weeklyData} />
            </TabsContent>
            <TabsContent value="monthly">
              <SalesBarChart data={monthlyData} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
