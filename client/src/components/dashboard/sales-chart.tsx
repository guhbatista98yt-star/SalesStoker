import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { BarChart3 } from "lucide-react";
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border rounded-md shadow-lg p-3">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function SalesChart({ weeklyData, monthlyData, loading, dragHandle }: SalesChartProps) {
  return (
    <Card data-testid="sales-chart">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {dragHandle}
          <BarChart3 className="h-5 w-5 text-primary" />
          Evolução de Vendas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[350px] flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        ) : (
          <Tabs defaultValue="weekly" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="weekly" data-testid="tab-sales-weekly">Semanal</TabsTrigger>
              <TabsTrigger value="monthly" data-testid="tab-sales-monthly">Mensal</TabsTrigger>
            </TabsList>
            <TabsContent value="weekly">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis 
                      className="text-xs" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                      dataKey="atual" 
                      name="Período Atual" 
                      fill="hsl(217, 91%, 50%)" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="anterior" 
                      name="Ano Anterior" 
                      fill="hsl(217, 20%, 70%)" 
                      radius={[4, 4, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
            <TabsContent value="monthly">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis 
                      className="text-xs" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                      dataKey="atual" 
                      name="Período Atual" 
                      fill="hsl(217, 91%, 50%)" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="anterior" 
                      name="Ano Anterior" 
                      fill="hsl(217, 20%, 70%)" 
                      radius={[4, 4, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
