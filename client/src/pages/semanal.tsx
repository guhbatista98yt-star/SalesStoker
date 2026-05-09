import { useState, useEffect, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpButton, HelpDrawer, HELP_CONTENT } from "@/components/help";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { GroupSelector, type VendorGroup } from "@/components/dashboard/group-selector";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { formatCurrency, formatPercentage, getCurrentWeekPeriod, formatDateBR } from "@/lib/calendar-utils";
import { useAuth } from "@/lib/auth-context";
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

function useChartColors() {
  const getColors = () => {
    const s = getComputedStyle(document.documentElement);
    const p = s.getPropertyValue("--primary").trim();
    const mf = s.getPropertyValue("--muted-foreground").trim();
    return { primary: `hsl(${p})`, muted: `hsl(${mf} / 0.45)` };
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

interface WeeklyCardProps {
  salesperson: { id: string; name: string; email: string };
  dailySales: { day: string; value: number; yoyValue: number }[];
  totalWeek: number;
  yoyVariacao: number | null;
  metaProgress: number;
  primaryColor: string;
  mutedColor: string;
}

const WeeklyCard = memo(function WeeklyCard({ salesperson, dailySales, totalWeek, yoyVariacao, metaProgress, primaryColor, mutedColor }: WeeklyCardProps) {
  const initials = salesperson.name.split(" ").map(n => n[0]).slice(0, 2).join("");
  return (
    <Card data-testid={`weekly-card-${salesperson.id}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
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
                <span className="text-base sm:text-lg font-semibold">{formatCurrency(totalWeek || 0)}</span>
              </div>
              <div className={`flex items-center gap-1 ${getValueColor(yoyVariacao)} mt-0.5`}>
                {getTrendIcon(yoyVariacao)}
                <span className="text-xs font-medium whitespace-nowrap">{formatPercentage(yoyVariacao)} YoY</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Progress value={metaProgress} className="w-24 sm:w-32 h-2" />
              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{metaProgress.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]" style={{ contain: "layout size" }}>
          <ResponsiveContainer width="100%" height="100%" debounce={300}>
            <BarChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="value" name="Atual" fill={primaryColor} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="yoyValue" name="Ano Anterior" fill={mutedColor} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export default function Semanal() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";
  const chartColors = useChartColors();

  const weekPeriod = getCurrentWeekPeriod();
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const { data: weeklyData = [], isLoading: weeklyLoading } = useQuery<WeeklySalesperson[]>({
    queryKey: ["/api/weekly-view", "all", weekPeriod.startDate, weekPeriod.endDate],
  });

  const { data: groups = [] } = useQuery<VendorGroup[]>({
    queryKey: ["/api/vendor-groups"],
    enabled: isAdmin || isSupervisor,
  });

  const selectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : undefined;

  const filteredData = weeklyData.filter(({ salesperson }) =>
    !selectedGroup || selectedGroup.members.includes(String(salesperson.id))
  );

  const showGroupFilter = isAdmin || isSupervisor;

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Visão Semanal</h1>
            <HelpButton onClick={() => setHelpOpen(true)} />
            <span className="hidden sm:inline text-xs text-muted-foreground font-medium">Desempenho por vendedor</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SyncStatusBar routine="vendas" label="Vendas" className="hidden sm:flex mr-1" />
            {showGroupFilter && (
              <GroupSelector
                groups={groups}
                selectedGroupId={selectedGroupId}
                onChange={setSelectedGroupId}
              />
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
            {filteredData.map(({ salesperson, dailySales, totalWeek, yoyVariacao, metaProgress }) => (
              <WeeklyCard
                key={salesperson.id}
                salesperson={salesperson}
                dailySales={dailySales}
                totalWeek={totalWeek}
                yoyVariacao={yoyVariacao}
                metaProgress={metaProgress}
                primaryColor={chartColors.primary}
                mutedColor={chartColors.muted}
              />
            ))}
          </div>
        )}
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.semanal} />
    </div>
  );
}
