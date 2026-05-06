import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Package } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/calendar-utils";
import type { ProductMix } from "@shared/schema";

interface ProductMixChartProps {
  data: ProductMix[];
  loading?: boolean;
  dragHandle?: React.ReactNode;
}

const COLORS = [
  "hsl(217, 91%, 50%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(340, 75%, 55%)",
  "hsl(200, 80%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(30, 90%, 55%)",
];

function getABCColor(curve: "A" | "B" | "C"): string {
  switch (curve) {
    case "A": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "B": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "C": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  }
}

export function ProductMixChart({ data, loading, dragHandle }: ProductMixChartProps) {
  const chartData = data.slice(0, 8).map((item) => ({
    name: item.product.name,
    value: item.totalValue,
    percentage: item.percentage,
    curve: item.product.abcCurve,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-md shadow-lg p-3">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(data.value)} ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card data-testid="product-mix-chart">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {dragHandle}
          <Package className="h-5 w-5 text-primary" />
          Mix por Fabricante
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2">
              {data.slice(0, 10).map((item, index) => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-3 p-2 rounded-md bg-muted/30"
                  data-testid={`product-mix-item-${item.product.id}`}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.totalValue)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`text-xs ${getABCColor(item.product.abcCurve)}`}>
                      {item.product.abcCurve}
                    </Badge>
                    <span className="text-sm font-medium min-w-[50px] text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
