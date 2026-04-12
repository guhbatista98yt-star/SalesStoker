export * from "./models/auth";

export type UserRole = "supervisor" | "gerente" | "diretor";

export interface Company {
  id: string;
  name: string;
  cnpj: string;
}

export interface Team {
  id: string;
  name: string;
  companyId: string;
  supervisorId: string;
}

export interface Salesperson {
  id: string;
  name: string;
  email: string;
  teamId: string;
  companyId: string;
  photoUrl?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  abcCurve: "A" | "B" | "C";
  companyId: string;
}

export interface Sale {
  id: string;
  date: string;
  salespersonId: string;
  companyId: string;
  productId: string;
  quantity: number;
  totalValue: number;
  invoiceNumber?: string;
  status: "faturada" | "a_faturar";
}

export interface DailySales {
  date: string;
  companyId: string;
  salespersonId: string;
  totalValue: number;
  orderCount: number;
  productCount: number;
  uniqueClients: number;
}

export interface PipesConnectionsKPI {
  companyId: string;
  period: string;
  salespersonId?: string;
  valorConexoes: number;
  valorTubos: number;
  percentual: number | null;
  status: "OK" | "SEM_TUBOS" | "SEM_DADOS";
}

export interface Goal {
  id: string;
  companyId: string;
  salespersonId: string;
  type: "weekly" | "monthly";
  targetValue: number;
  month: number;
  year: number;
  week?: number;
}

export interface GoalWithProgress extends Goal {
  currentValue: number;
  progress: number;
  salespersonName: string;
}

export interface SalespersonWithStats {
  salesperson: Salesperson;
  stats: {
    totalVendas: number;
    ticketMedio: number;
    positivacao: number;
    mixProdutos: number;
    conexoesSobreTubos: number | null;
    yoyVariacao: number;
    metaProgress: number;
  };
}

export interface SalespersonAFaturar {
  salesperson: Salesperson;
  valorAFaturar: number;
}

export interface WeeklySalesperson {
  salesperson: Salesperson;
  dailySales: Array<{
    day: string;
    value: number;
    yoyValue: number;
  }>;
  totalWeek: number;
  yoyVariacao: number;
  metaProgress: number;
}

export interface MonthlySalesperson {
  salesperson: Salesperson;
  weeklySales: Array<{
    week: string;
    value: number;
    yoyValue: number;
    cumulative: number;
    yoyCumulative: number;
  }>;
  totalMonth: number;
  yoyVariacao: number;
  metaProgress: number;
}

export interface SalesEvolutionData {
  weekly: Array<{ label: string; atual: number; anterior: number; variacao: number }>;
  monthly: Array<{ label: string; atual: number; anterior: number; variacao: number }>;
}

export interface Alert {
  id: string;
  companyId: string;
  type: "yoy_queda" | "ticket_baixo" | "conexoes_tubos_fora" | "a_faturar_anomalia";
  threshold: number;
  enabled: boolean;
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface KPISummary {
  totalVendasSemanal: number;
  totalVendasMensal: number;
  valorAFaturar: number;
  pedidosAtendidos: number;
}

export interface SalespersonRanking {
  salesperson: Salesperson;
  value: number;
  rank: number;
  yoyVariacao: number;
  positivacao: number;
  mixProdutos: number;
  conexoesSobreTubos: number | null;
  ticketMedio?: number;
}

export interface ProductMix {
  product: Product;
  totalValue: number;
  percentage: number;
  quantity: number;
}

export interface PeriodMode {
  type: "livre" | "fechado_semanas";
}

export interface DatePeriod {
  startDate: string;
  endDate: string;
  mode: PeriodMode;
}

export interface WeeklyPeriod {
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
}

export interface ClosedMonthPeriod {
  month: number;
  year: number;
  periodStart: string;
  periodEnd: string;
  weeksIncluded: WeeklyPeriod[];
}

export type RankingCriteria =
  | "maior_valor_vendido"
  | "maior_positivacao"
  | "maior_mix_produtos"
  | "conexoes_sobre_tubos";

export interface DashboardFilters {
  companyId: string;
  period: DatePeriod;
  teamId?: string;
  salespersonId?: string;
  rankingCriteria: RankingCriteria;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  triggeredAt: string;
  message: string;
  severity: "info" | "warning" | "critical";
  read: boolean;
  data: Record<string, unknown>;
}

// TV Mode Specifics
export interface VendorDisplaySettings {
  id: string;
  vendorId: string;
  displayCode: string; // e.g., "1014938"
  displayName: string; // e.g., "JANIO SOARES"
  isHidden: boolean; // For "LAURA LETICIA" etc.
  companyId?: string; // Optional
}

export interface TVDashboardData {
  meta: {
    weekStart: string;
    weekEnd: string;
    lastSync: string;
  };
  vendors: Array<{
    id: string;
    displayCode: string;
    displayName: string;
    sales: {
      loja01: number;
      loja03: number;
      lojaMatriz: number;
      total: number;
    };
    goal: {
      value: number; // For Supervisor: Total Goal. For Manager: Sum of Store Goals
      isSingle: boolean; // true if Supervisor (Single Stacked Bar)
      loja01?: number; // For Manager
      loja03?: number; // For Manager
      lojaMatriz?: number; // Today's goal for matriz (weekly/6)
    };
    yoy: {
      value: number;
      percentage: number;
    };
    // ... existing code ...
    achievement: number; // Percentage
  }>;
}

export interface GoalSetting {
  id: string;
  salespersonId: string;
  type: "weekly" | "monthly";
  mode: "unified" | "split";
  month: number;
  year: number;
}
