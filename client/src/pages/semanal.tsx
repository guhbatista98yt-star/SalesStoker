import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Calendar, TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import { formatCurrency, formatPercentage, getCurrentWeekPeriod, formatDateBR } from "@/lib/calendar-utils";
import { useAuth } from "@/lib/auth-context";
import type { WeeklySalesperson } from "@shared/schema";

interface VendorGroup {
  id: string;
  name: string;
  members: string[];
}

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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";

  const weekPeriod = getCurrentWeekPeriod();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");

  const { data: weeklyData = [], isLoading: weeklyLoading } = useQuery<WeeklySalesperson[]>({
    queryKey: ["/api/weekly-view", "all", weekPeriod.startDate, weekPeriod.endDate],
  });

  const { data: groups = [] } = useQuery<VendorGroup[]>({
    queryKey: ["/api/vendor-groups"],
    enabled: isAdmin || isSupervisor,
  });

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const filteredData = weeklyData.filter(({ salesperson }) =>
    !selectedGroup || selectedGroup.members.includes(String(salesperson.id))
  );

  const showGroupFilter = (isAdmin || isSupervisor) && groups.length > 0;

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Visão Semanal</h1>
            <span className="hidden sm:inline text-xs text-muted-foreground font-medium">Desempenho por vendedor</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {showGroupFilter && (
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="h-8 text-xs w-40 gap-1.5">
                  <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Grupo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos os grupos</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id} className="text-xs">{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs rounded-lg" disabled>
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{formatDateBR(weekPeriod.startDate)} — {formatDateBR(weekPeriod.endDate)}</span>
              <span className="sm:hidden">{formatDateBR(weekPeriod.startDate).slice(0, 5)} — {formatDateBR(weekPeriod.endDate).slice(0, 5)}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {selectedGroup && !weeklyLoading && (
          <p className="text-xs text-muted-foreground">
            Grupo: <strong>{selectedGroup.name}</strong> · {filteredData.length} de {weeklyData.length} vendedores
          </p>
        )}

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
        ) : filteredData.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhum dado disponível para o período</p>
            {selectedGroup && <p className="text-sm mt-1">Tente selecionar outro grupo ou "Todos os grupos"</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredData.map(({ salesperson, dailySales, totalWeek, yoyVariacao, metaProgress }) => {
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
