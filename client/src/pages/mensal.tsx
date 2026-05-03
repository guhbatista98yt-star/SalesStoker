import { useState, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpButton, HelpDrawer, HELP_CONTENT } from "@/components/help";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CalendarDays, TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import { formatCurrency, formatPercentage } from "@/lib/calendar-utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/lib/auth-context";
import type { MonthlySalesperson } from "@shared/schema";

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

interface MonthlyCardProps {
  salesperson: { id: string; name: string; email: string };
  weeklySales: { week: string; cumulative: number; yoyCumulative: number }[];
  totalMonth: number;
  yoyVariacao: number | null;
  metaProgress: number;
}

const MonthlyCard = memo(function MonthlyCard({ salesperson, weeklySales, totalMonth, yoyVariacao, metaProgress }: MonthlyCardProps) {
  const initials = salesperson.name.split(" ").map(n => n[0]).slice(0, 2).join("");
  return (
    <Card data-testid={`monthly-card-${salesperson.id}`}>
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
                <span className="text-xs text-muted-foreground">Total Mês:</span>
                <span className="text-base sm:text-lg font-semibold">{formatCurrency(totalMonth)}</span>
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
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklySales}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="cumulative" name="Acumulado Atual"
                stroke="hsl(217, 91%, 50%)" fill="hsl(217, 91%, 50%)" fillOpacity={0.1}
                strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="yoyCumulative" name="Acumulado Anterior"
                stroke="hsl(217, 20%, 65%)" fill="hsl(217, 20%, 65%)" fillOpacity={0.05}
                strokeWidth={2} strokeDasharray="5 5" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export default function Mensal() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";

  const today = new Date();
  const startDate = format(startOfMonth(today), "yyyy-MM-dd");
  const endDate = format(endOfMonth(today), "yyyy-MM-dd");
  const monthLabel = format(today, "MMMM yyyy", { locale: ptBR });

  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");

  const { data: monthlyData = [], isLoading: monthlyLoading } = useQuery<MonthlySalesperson[]>({
    queryKey: ["/api/monthly-view", "all", startDate, endDate],
  });

  const { data: groups = [] } = useQuery<VendorGroup[]>({
    queryKey: ["/api/vendor-groups"],
    enabled: isAdmin || isSupervisor,
  });

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const filteredData = monthlyData.filter(({ salesperson }) =>
    !selectedGroup || selectedGroup.members.includes(String(salesperson.id))
  );

  const showGroupFilter = (isAdmin || isSupervisor) && groups.length > 0;

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Visão Mensal</h1>
            <HelpButton onClick={() => setHelpOpen(true)} />
            <span className="hidden sm:inline text-xs text-muted-foreground font-medium capitalize">{monthLabel}</span>
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
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs rounded-lg capitalize" disabled>
              <CalendarDays className="h-3.5 w-3.5" />
              {monthLabel}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {selectedGroup && !monthlyLoading && (
          <p className="text-xs text-muted-foreground">
            Grupo: <strong>{selectedGroup.name}</strong> · {filteredData.length} de {monthlyData.length} vendedores
          </p>
        )}

        {monthlyLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-48 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nenhum dado disponível para o período</p>
            {selectedGroup && <p className="text-sm mt-1">Tente selecionar outro grupo ou "Todos os grupos"</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredData.map(({ salesperson, weeklySales, totalMonth, yoyVariacao, metaProgress }) => (
              <MonthlyCard
                key={salesperson.id}
                salesperson={salesperson}
                weeklySales={weeklySales}
                totalMonth={totalMonth}
                yoyVariacao={yoyVariacao}
                metaProgress={metaProgress}
              />
            ))}
          </div>
        )}
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.mensal} />
    </div>
  );
}
