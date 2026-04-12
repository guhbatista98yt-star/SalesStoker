import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency, formatPercentage, getCurrentWeekPeriod, formatDateBR } from "@/lib/calendar-utils";
import type { WeeklySalesperson } from "@shared/schema";

function getTrendIcon(value: number | null) {
  if (value === null) return null;
  if (value > 0) return <TrendingUp className="h-3.5 w-3.5" />;
  if (value < 0) return <TrendingDown className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
}

function getValueColor(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
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

export default function Semanal() {
  const weekPeriod = getCurrentWeekPeriod();

  const { data: weeklyData = [], isLoading: weeklyLoading } = useQuery<WeeklySalesperson[]>({
    queryKey: ["/api/weekly-view", "all", weekPeriod.startDate, weekPeriod.endDate],
  });

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Visão Semanal</h1>
              <p className="text-sm text-muted-foreground">
                Desempenho por vendedor na semana
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" className="gap-2" disabled>
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">{formatDateBR(weekPeriod.startDate)} - {formatDateBR(weekPeriod.endDate)}</span>
                <span className="sm:hidden">{formatDateBR(weekPeriod.startDate).slice(0, 5)} - {formatDateBR(weekPeriod.endDate).slice(0, 5)}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {weeklyLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-40 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : weeklyData.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhum dado disponível para o período</p>
          </div>
        ) : (
          <div className="space-y-6">
            {weeklyData.map(({ salesperson, dailySales, totalWeek, yoyVariacao, metaProgress }) => {
              const initials = salesperson.name.split(" ").map(n => n[0]).slice(0, 2).join("");
              
              return (
                <Card key={salesperson.id} data-testid={`weekly-card-${salesperson.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{salesperson.name}</CardTitle>
                          <p className="text-sm text-muted-foreground truncate">{salesperson.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-2 sm:mt-0">
                        <div className="text-left sm:text-right">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs text-muted-foreground">Total Semana:</span>
                            <span className="text-base sm:text-lg font-semibold">{formatCurrency(totalWeek)}</span>
                          </div>
                          <div className={`flex items-center gap-1 ${getValueColor(yoyVariacao)} mt-0.5`}>
                            {getTrendIcon(yoyVariacao)}
                            <span className="text-xs font-medium whitespace-nowrap">
                              {formatPercentage(yoyVariacao)} YoY
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={metaProgress} className="w-24 sm:w-32 h-2" />
                          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                            {metaProgress.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailySales}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="day" 
                            className="text-xs" 
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <YAxis 
                            className="text-xs" 
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar 
                            dataKey="value" 
                            name="Atual" 
                            fill="hsl(217, 91%, 50%)" 
                            radius={[3, 3, 0, 0]}
                          />
                          <Bar 
                            dataKey="yoyValue" 
                            name="Ano Anterior" 
                            fill="hsl(217, 20%, 75%)" 
                            radius={[3, 3, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
