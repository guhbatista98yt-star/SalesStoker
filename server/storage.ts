import { randomUUID } from "crypto";
import { sqlite } from "./db";
import type {
  Company,
  Team,
  Salesperson,
  Product,
  Alert,
  AlertNotification,
  KPISummary,
  SalespersonRanking,
  ProductMix,
  RankingCriteria,
  Goal,
  GoalWithProgress,
  SalespersonWithStats,
  WeeklySalesperson,
  MonthlySalesperson,
  SalesEvolutionData,
  SalespersonAFaturar,
  VendorDisplaySettings,
  TVDashboardData,
  GoalSetting,
} from "@shared/schema";

export interface IStorage {
  getCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;

  getTeams(companyId: string): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;

  getSalespersons(companyId: string, teamMembers?: string[]): Promise<Salesperson[]>;
  getSalesperson(id: string): Promise<Salesperson | undefined>;

  getProducts(companyId: string): Promise<Product[]>;

  getKPISummary(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<KPISummary>;

  getRankings(
    companyId: string,
    startDate: string,
    endDate: string,
    criteria: RankingCriteria,
    teamMembers?: string[]
  ): Promise<SalespersonRanking[]>;

  getProductMix(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<ProductMix[]>;

  getSalesEvolution(companyId: string, teamMembers?: string[]): Promise<SalesEvolutionData>;

  getGoals(companyId: string, month: number, year: number, teamMembers?: string[]): Promise<GoalWithProgress[]>;
  createGoal(goal: Omit<Goal, "id">): Promise<Goal>;
  updateGoal(id: string, data: Partial<Goal>): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;
  getSalespersonGoals(salespersonId: string, month: number, year: number): Promise<GoalWithProgress[]>;

  getAlertNotifications(companyId: string): Promise<AlertNotification[]>;
  markAlertRead(id: string): Promise<boolean>;
  dismissAlert(id: string): Promise<boolean>;

  getAlertConfigs(companyId: string): Promise<Alert[]>;
  updateAlertConfig(id: string, enabled: boolean): Promise<boolean>;

  getSalespersonsWithStats(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<SalespersonWithStats[]>;

  getWeeklyView(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<WeeklySalesperson[]>;
  getMonthlyView(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<MonthlySalesperson[]>;
  getAFaturarPorVendedor(companyId: string, teamMembers?: string[]): Promise<SalespersonAFaturar[]>;

  // TV Mode
  getVendorDisplaySettings(): Promise<VendorDisplaySettings[]>;
  updateVendorDisplaySetting(setting: VendorDisplaySettings): Promise<VendorDisplaySettings>;
  getTVDashboardData(weekStart: string, weekEnd: string, userRole: string, teamMembers?: string[]): Promise<TVDashboardData>;

  getGoalSettings(salespersonId: string, month: number, year: number): Promise<GoalSetting[]>;
  saveGoalSettings(settings: GoalSetting): Promise<GoalSetting>;
  getSalespersonGoalsRaw(month: number, year: number): Promise<Goal[]>;

  // Metas de Vendas Module
  getVendedorIdByEmail(email: string): Promise<string>;
  getMetasAcompanhamento(vendedorId: string, periodo: "semana" | "mes"): Promise<any>;
  getMetasAmancoDTR(vendedorId: string): Promise<any>;
  getMetasAmancoTV(vendedorId: string): Promise<any>;
  getMetasElit(vendedorId: string): Promise<any>;

  getCampaignGoals(campaignName: string, year: number): Promise<{ salespersonId: string; triggerValue: number }[]>;
  saveCampaignGoals(campaignName: string, year: number, goals: { salespersonId: string; triggerValue: number }[]): Promise<void>;

  // Vendor Groups (Equipes)
  getVendorGroups(): Promise<{ id: string, name: string, members: string[] }[]>;
  saveVendorGroup(id: string, name: string, members: string[]): Promise<void>;
  deleteVendorGroup(id: string): Promise<void>;

  // Campaign Reports
  getCampaignReport(campaignName: string): Promise<any[]>;

  // Movimentações por vendedor
  getMovimentacoesPorVendedor(vendedorId: string, startDate: string, endDate: string): Promise<any[]>;

  // App feature flags / settings
  getAppSetting(key: string): Promise<string | null>;
  setAppSetting(key: string, value: string): Promise<void>;
}

const teams: Team[] = [
  { id: "t1", name: "Equipe Vendas", companyId: "1", supervisorId: "s1" },
];

export class SqliteStorage implements IStorage {
  private goals: Goal[] = [];
  private goalSettings: GoalSetting[] = [];

  constructor() {
    this.initGoalsTable();
    this.initGoalSettingsTable();
    this.initVendorSettingsTable();
    this.initCampaignGoalsTable();
    this.initVendorGroupsTable();
    this.initAlertConfigsTable();
    this.initAlertNotificationsTable();
    this.initAppSettingsTable();
    this.loadGoalsFromDb();
    this.loadGoalSettingsFromDb();
  }

  private initAppSettingsTable() {
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    } catch (err) {
      console.error("Error creating app_settings table:", err);
    }
  }

  private initCampaignGoalsTable() {
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS campaign_goals (
          id TEXT PRIMARY KEY,
          salespersonId TEXT NOT NULL,
          campaignName TEXT NOT NULL,
          year INTEGER NOT NULL,
          triggerValue REAL NOT NULL,
          UNIQUE(salespersonId, campaignName, year)
        )
      `);
    } catch (err) {
      console.error("Error creating campaign_goals table:", err);
    }
  }

  private initVendorGroupsTable() {
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS vendor_groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        )
      `);
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS vendor_group_members (
          group_id TEXT NOT NULL,
          salesperson_id TEXT NOT NULL,
          PRIMARY KEY (group_id, salesperson_id),
          FOREIGN KEY (group_id) REFERENCES vendor_groups(id) ON DELETE CASCADE
        )
      `);
    } catch (err) {
      console.error("Error creating vendor_groups table:", err);
    }
  }

  private initVendorSettingsTable() {
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS vendor_display_settings (
          id TEXT PRIMARY KEY,
          vendorId TEXT NOT NULL,
          displayCode TEXT NOT NULL,
          displayName TEXT,
          isHidden INTEGER DEFAULT 0,
          companyId TEXT
        )
      `);
    } catch (err) {
      console.error("Error creating vendor_display_settings table:", err);
    }
  }

  private initGoalSettingsTable() {
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS goal_settings (
          id TEXT PRIMARY KEY,
          salespersonId TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('weekly', 'monthly')),
          mode TEXT NOT NULL CHECK(mode IN ('unified', 'split')),
          month INTEGER NOT NULL,
          year INTEGER NOT NULL
        )
      `);
    } catch (err) {
      console.error("Error creating goal_settings table:", err);
    }
  }

  private loadGoalSettingsFromDb() {
    try {
      const rows = sqlite.prepare(`SELECT * FROM goal_settings`).all() as GoalSetting[];
      this.goalSettings = rows;
    } catch (err) {
      console.error("Error loading goal settings:", err);
      this.goalSettings = [];
    }
  }

  private initGoalsTable() {
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS goals (
          id TEXT PRIMARY KEY,
          companyId TEXT NOT NULL,
          salespersonId TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('weekly', 'monthly')),
          targetValue REAL NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          week INTEGER
        )
      `);
    } catch (err) {
      console.error("Error creating goals table:", err);
    }
  }

  private initAlertConfigsTable() {
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS alert_configs (
          id TEXT PRIMARY KEY,
          companyId TEXT NOT NULL,
          type TEXT NOT NULL,
          threshold REAL NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          message TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'warning'
        )
      `);
      const count = (sqlite.prepare(`SELECT COUNT(*) as c FROM alert_configs`).get() as { c: number }).c;
      if (count === 0) {
        const seed = [
          { id: "ac1", companyId: "1", type: "yoy_queda", threshold: 15, enabled: 1, message: "Alerta quando vendedor tem queda em relação ao ano anterior", severity: "warning" },
          { id: "ac2", companyId: "1", type: "ticket_baixo", threshold: 500, enabled: 1, message: "Alerta quando ticket médio está baixo", severity: "warning" },
          { id: "ac3", companyId: "3", type: "yoy_queda", threshold: 15, enabled: 1, message: "Alerta quando vendedor tem queda em relação ao ano anterior", severity: "warning" },
          { id: "ac4", companyId: "3", type: "ticket_baixo", threshold: 500, enabled: 1, message: "Alerta quando ticket médio está baixo", severity: "warning" },
        ];
        const stmt = sqlite.prepare(`INSERT INTO alert_configs (id, companyId, type, threshold, enabled, message, severity) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        for (const s of seed) {
          stmt.run(s.id, s.companyId, s.type, s.threshold, s.enabled, s.message, s.severity);
        }
      }
    } catch (err) {
      console.error("Error creating alert_configs table:", err);
    }
  }

  private initAlertNotificationsTable() {
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS alert_notifications (
          id TEXT PRIMARY KEY,
          alertId TEXT NOT NULL,
          companyId TEXT NOT NULL DEFAULT 'all',
          triggeredAt TEXT NOT NULL,
          message TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'warning',
          read INTEGER NOT NULL DEFAULT 0,
          data TEXT NOT NULL DEFAULT '{}'
        )
      `);
    } catch (err) {
      console.error("Error creating alert_notifications table:", err);
    }
  }

  private loadGoalsFromDb() {
    try {
      const rows = sqlite.prepare(`
        SELECT id, companyId, salespersonId, type, targetValue, month, year, week
        FROM goals
      `).all() as Goal[];
      this.goals = rows;
      console.log(`Loaded ${rows.length} goals from database`);
    } catch (err) {
      console.error("Error loading goals:", err);
      this.goals = [];
    }
  }

  private buildTeamFilter(teamMembers?: string[], columnName: string = "NOME_VENDEDOR"): string {
    const excludeBruno = ` AND UPPER(${columnName}) NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%' `;
    if (!teamMembers || teamMembers.length === 0) return excludeBruno;
    const conditions = teamMembers.map(name => `UPPER(${columnName}) LIKE '%${name.toUpperCase()}%'`).join(" OR ");
    return `${excludeBruno} AND (${conditions})`;
  }

  private getConexoesSobreTubos(vendedorId: string, companyId?: string, startDate?: string, endDate?: string): number | null {
    try {
      let whereCompany = "";
      if (companyId && companyId !== "all") {
        whereCompany = `AND IDEMPRESA = ${companyId}`;
      }
      let wherePeriod = "";
      if (startDate && endDate) {
        wherePeriod = `AND DT_MOVIMENTO >= '${startDate}' AND DT_MOVIMENTO <= '${endDate}'`;
      }

      const result = sqlite.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN TIPO_PRODUTO = 'Conexao' THEN VALOR_LIQUIDO ELSE 0 END), 0) as conexoes,
          COALESCE(SUM(CASE WHEN TIPO_PRODUTO = 'Tubo' THEN VALOR_LIQUIDO ELSE 0 END), 0) as tubos
        FROM cache_tubos_conexoes
        WHERE IDVENDEDOR = ? ${whereCompany} ${wherePeriod}
      `).get(vendedorId) as { conexoes: number; tubos: number } | undefined;

      if (!result || result.tubos === 0) return null;
      return (result.conexoes / result.tubos) * 100;
    } catch (e) {
      return null;
    }
  }

  private getCompaniesFromCache(): Company[] {
    try {
      const rows = sqlite.prepare(`
        SELECT DISTINCT 
          CAST(IDEMPRESA AS TEXT) as id,
          RAZAO_SOCIAL_EMPRESA as name,
          CNPJ_EMPRESA as cnpj
        FROM cache_vendas
        WHERE CNPJ_EMPRESA IS NOT NULL AND CNPJ_EMPRESA != ''
        ORDER BY IDEMPRESA
      `).all() as { id: string; name: string; cnpj: string }[];

      if (rows.length === 0) {
        return [{ id: "1", name: "Conectubos", cnpj: "00.000.000/0001-00" }];
      }

      return rows;
    } catch (err) {
      return [{ id: "1", name: "Conectubos", cnpj: "00.000.000/0001-00" }];
    }
  }

  private getSalespersonsFromCache(companyId?: string): Salesperson[] {
    try {
      let query: string;

      if (companyId && companyId !== "all") {
        query = `
          SELECT DISTINCT 
            IDVENDEDOR as id, 
            NOME_VENDEDOR as name,
            CAST(IDEMPRESA AS TEXT) as companyId
          FROM cache_vendas 
          WHERE IDVENDEDOR IS NOT NULL 
            AND NOME_VENDEDOR IS NOT NULL
            AND NOME_VENDEDOR NOT LIKE '%SEM VENDEDOR%'
            AND UPPER(NOME_VENDEDOR) NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%'
            AND IDEMPRESA = ${companyId}
          ORDER BY NOME_VENDEDOR
        `;
      } else {
        query = `
          SELECT 
            IDVENDEDOR as id, 
            MIN(NOME_VENDEDOR) as name,
            MIN(CAST(IDEMPRESA AS TEXT)) as companyId
          FROM cache_vendas 
          WHERE IDVENDEDOR IS NOT NULL 
            AND NOME_VENDEDOR IS NOT NULL
            AND NOME_VENDEDOR NOT LIKE '%SEM VENDEDOR%'
            AND UPPER(NOME_VENDEDOR) NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%'
          GROUP BY IDVENDEDOR
          ORDER BY name
        `;
      }

      const rows = sqlite.prepare(query).all() as { id: string; name: string; companyId: string }[];

      return rows.map((row: any) => {
        const id = row.id ?? row.ID ?? row.IDVENDEDOR ?? row.idvendedor;
        const name = row.name ?? row.NAME ?? row.NOME_VENDEDOR ?? row.nome_vendedor;
        const companyId = row.companyId ?? row.companyid ?? row.COMPANYID ?? row.IDEMPRESA;

        return {
          id: String(id),
          name: name ? String(name) : "Nome não encontrado",
          email: "",
          teamId: "t1",
          companyId: String(companyId),
        };
      });
    } catch (err) {
      console.error("Error getting salespersons from cache:", err);
      return [];
    }
  }

  async getCompanies(): Promise<Company[]> {
    return this.getCompaniesFromCache();
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const companies = this.getCompaniesFromCache();
    return companies.find(c => c.id === id);
  }

  async getTeams(companyId: string): Promise<Team[]> {
    if (companyId === "all") return teams;
    return teams.filter(t => t.companyId === companyId);
  }

  async getTeam(id: string): Promise<Team | undefined> {
    return teams.find(t => t.id === id);
  }

  async getSalespersons(companyId: string, teamMembers?: string[]): Promise<Salesperson[]> {
    const all = this.getSalespersonsFromCache(companyId);
    if (!teamMembers || teamMembers.length === 0) return all;
    return all.filter(sp => teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase())));
  }

  async getSalesperson(id: string): Promise<Salesperson | undefined> {
    const all = this.getSalespersonsFromCache();
    return all.find(s => s.id === id);
  }

  async getProducts(companyId: string): Promise<Product[]> {
    return [];
  }

  async getKPISummary(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<KPISummary> {
    try {
      let whereCompany = "";
      if (companyId !== "all") {
        whereCompany = `AND IDEMPRESA = ${companyId}`;
      }
      const teamFilter = this.buildTeamFilter(teamMembers);

      const vendasResult = sqlite.prepare(`
        SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
        FROM cache_vendas 
        WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ? ${whereCompany} ${teamFilter}
      `).get(startDate, endDate) as { total: number };

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const weekStart = startOfWeek.toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      const weeklyResult = sqlite.prepare(`
        SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
        FROM cache_vendas 
        WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ? ${whereCompany} ${teamFilter}
      `).get(weekStart, today) as { total: number };

      const teamFilterPendentes = this.buildTeamFilter(teamMembers, "NOME_VENDEDOR");
      let whereCompanyPendentes = "";
      if (companyId !== "all") {
        whereCompanyPendentes = `AND IDEMPRESA = ${companyId}`;
      }

      const aFaturarResult = sqlite.prepare(`
        SELECT COALESCE(SUM(VALOR_TOTAL), 0) as total
        FROM cache_vendas_pendentes
        WHERE 1=1 ${whereCompanyPendentes} ${teamFilterPendentes}
      `).get() as { total: number };

      const pedidosResult = sqlite.prepare(`
        SELECT COUNT(*) as total
        FROM cache_vendas_pendentes
        WHERE 1=1 ${whereCompanyPendentes} ${teamFilterPendentes}
      `).get() as { total: number };

      return {
        totalVendasSemanal: weeklyResult.total,
        totalVendasMensal: vendasResult.total,
        valorAFaturar: aFaturarResult.total,
        pedidosAtendidos: pedidosResult.total,
      };
    } catch (err) {
      console.error("Error getting KPIs:", err);
      return {
        totalVendasSemanal: 0,
        totalVendasMensal: 0,
        valorAFaturar: 0,
        pedidosAtendidos: 0,
      };
    }
  }

  async getRankings(
    companyId: string,
    startDate: string,
    endDate: string,
    criteria: RankingCriteria,
    teamMembers?: string[]
  ): Promise<SalespersonRanking[]> {
    try {
      let whereCompany = "";
      if (companyId !== "all") {
        whereCompany = `AND IDEMPRESA = ${companyId}`;
      }
      const teamFilter = this.buildTeamFilter(teamMembers);

      const groupBy = companyId === "all"
        ? "IDVENDEDOR, NOME_VENDEDOR"
        : "IDVENDEDOR, NOME_VENDEDOR, IDEMPRESA";

      const salesRows = sqlite.prepare(`
        SELECT 
          IDVENDEDOR as id,
          NOME_VENDEDOR as name,
          MIN(CAST(IDEMPRESA AS TEXT)) as companyId,
          SUM(TOTALVENDA_LINHA) as totalVendas,
          SUM(LUCRO_LINHA) as totalLucro,
          COUNT(DISTINCT IDCLIENTE) as positivacao,
          COUNT(DISTINCT IDPRODUTO) as mixProdutos,
          COUNT(DISTINCT IDPLANILHA) as qtdPedidos
        FROM cache_vendas
        WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
          AND NOME_VENDEDOR NOT LIKE '%SEM VENDEDOR%'
          ${whereCompany} ${teamFilter}
        GROUP BY ${groupBy}
        ORDER BY totalVendas DESC
      `).all(startDate, endDate) as {
        id: string;
        name: string;
        companyId: string;
        totalVendas: number;
        totalLucro: number;
        positivacao: number;
        mixProdutos: number;
        qtdPedidos: number;
      }[];

      const start = new Date(startDate);
      const end = new Date(endDate);
      const yoyStart = new Date(start);
      yoyStart.setFullYear(yoyStart.getFullYear() - 1);
      const yoyEnd = new Date(end);
      yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);
      const yoyStartStr = yoyStart.toISOString().split('T')[0];
      const yoyEndStr = yoyEnd.toISOString().split('T')[0];

      const rankings: SalespersonRanking[] = salesRows.map((row, index) => {
        let value: number;

        switch (criteria) {
          case "maior_valor_vendido":
            value = row.totalVendas;
            break;
          case "maior_positivacao":
            value = row.positivacao;
            break;
          case "maior_mix_produtos":
            value = row.mixProdutos;
            break;
          case "conexoes_sobre_tubos":
            value = 0;
            break;
          default:
            value = row.totalVendas;
        }

        let yoyVariacao = 0;
        try {
          const yoyResult = sqlite.prepare(`
            SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
            FROM cache_vendas
            WHERE IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
          `).get(row.id, yoyStartStr, yoyEndStr) as { total: number };

          if (yoyResult.total > 0) {
            yoyVariacao = ((row.totalVendas - yoyResult.total) / yoyResult.total) * 100;
          }
        } catch (e) { }

        const conexoesSobreTubos = this.getConexoesSobreTubos(row.id, companyId, startDate, endDate);

        const ticketMedio = row.qtdPedidos > 0 ? row.totalVendas / row.qtdPedidos : 0;

        return {
          salesperson: {
            id: row.id,
            name: row.name,
            email: "",
            teamId: "t1",
            companyId: row.companyId,
          },
          value: criteria === "conexoes_sobre_tubos" ? (conexoesSobreTubos || 0) : value,
          rank: index + 1,
          yoyVariacao,
          positivacao: row.positivacao,
          mixProdutos: row.mixProdutos,
          conexoesSobreTubos,
          ticketMedio,
        };
      });

      if (criteria !== "maior_valor_vendido") {
        rankings.sort((a, b) => b.value - a.value);
        rankings.forEach((r, i) => { r.rank = i + 1; });
      }

      return rankings;
    } catch (err) {
      console.error("Error getting rankings:", err);
      return [];
    }
  }

  async getProductMix(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<ProductMix[]> {
    try {
      let whereCompany = "";
      if (companyId !== "all") {
        whereCompany = `AND IDEMPRESA = ${companyId}`;
      }
      const teamFilter = this.buildTeamFilter(teamMembers);

      const rows = sqlite.prepare(`
        SELECT 
          DESCRRESPRODUTO as category,
          SUM(TOTALVENDA_LINHA) as totalValue,
          SUM(QTDPRODUTO) as quantity
        FROM cache_vendas
        WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
          AND DESCRRESPRODUTO IS NOT NULL AND DESCRRESPRODUTO != ''
          ${whereCompany} ${teamFilter}
        GROUP BY DESCRRESPRODUTO
        ORDER BY totalValue DESC
        LIMIT 10
      `).all(startDate, endDate) as { category: string; totalValue: number; quantity: number }[];

      const total = rows.reduce((sum, r) => sum + (r.totalValue || 0), 0);

      return rows.map((row, index) => ({
        product: {
          id: `p${index + 1}`,
          sku: row.category || '',
          name: row.category || '',
          category: row.category || '',
          abcCurve: index < 3 ? "A" as const : index < 6 ? "B" as const : "C" as const,
          companyId: companyId === "all" ? "1" : companyId,
        },
        totalValue: row.totalValue || 0,
        percentage: total > 0 ? ((row.totalValue || 0) / total) * 100 : 0,
        quantity: row.quantity || 0,
      }));
    } catch (err) {
      console.error("Error getting product mix:", err);
      return [];
    }
  }

  async getSalesEvolution(companyId: string, teamMembers?: string[]): Promise<SalesEvolutionData> {
    try {
      let whereCompany = "";
      if (companyId !== "all") {
        whereCompany = `AND IDEMPRESA = ${companyId}`;
      }
      const teamFilter = this.buildTeamFilter(teamMembers);

      const now = new Date();
      const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const weekly = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();

        const result = sqlite.prepare(`
          SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
          FROM cache_vendas 
          WHERE DT_MOVIMENTO = ? ${whereCompany} ${teamFilter}
        `).get(dateStr) as { total: number };

        const lastYearDate = new Date(date);
        lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
        const lastYearStr = lastYearDate.toISOString().split('T')[0];

        const lastYearResult = sqlite.prepare(`
          SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
          FROM cache_vendas 
          WHERE DT_MOVIMENTO = ? ${whereCompany} ${teamFilter}
        `).get(lastYearStr) as { total: number };

        const atual = result.total;
        const anterior = lastYearResult.total;

        weekly.push({
          label: weekDays[dayOfWeek],
          atual,
          anterior,
          variacao: anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0,
        });
      }

      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const monthly = [];

      for (let m = 0; m <= now.getMonth(); m++) {
        const monthStart = new Date(now.getFullYear(), m, 1).toISOString().split('T')[0];
        const monthEnd = new Date(now.getFullYear(), m + 1, 0).toISOString().split('T')[0];

        const result = sqlite.prepare(`
          SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
          FROM cache_vendas 
          WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ? ${whereCompany} ${teamFilter}
        `).get(monthStart, monthEnd) as { total: number };

        const lastYearStart = new Date(now.getFullYear() - 1, m, 1).toISOString().split('T')[0];
        const lastYearEnd = new Date(now.getFullYear() - 1, m + 1, 0).toISOString().split('T')[0];

        const lastYearResult = sqlite.prepare(`
          SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
          FROM cache_vendas 
          WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ? ${whereCompany} ${teamFilter}
        `).get(lastYearStart, lastYearEnd) as { total: number };

        const atual = result.total;
        const anterior = lastYearResult.total;

        monthly.push({
          label: months[m],
          atual,
          anterior,
          variacao: anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0,
        });
      }

      return { weekly, monthly };
    } catch (err) {
      console.error("Error getting sales evolution:", err);
      return { weekly: [], monthly: [] };
    }
  }

  async getGoals(companyId: string, month: number, year: number, teamMembers?: string[]): Promise<GoalWithProgress[]> {
    let filteredGoals = this.goals.filter(g => {
      const matchCompany = companyId === "all" || g.companyId === companyId;
      const matchPeriod = g.month === month && g.year === year;
      return matchCompany && matchPeriod;
    });

    let salespersons = this.getSalespersonsFromCache();

    if (teamMembers && teamMembers.length > 0) {
      const spIds = salespersons
        .filter(sp => teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase())))
        .map(sp => sp.id);
      filteredGoals = filteredGoals.filter(g => spIds.includes(g.salespersonId));
    }

    return filteredGoals.map(goal => {
      const sp = salespersons.find(s => s.id === goal.salespersonId);

      try {
        const now = new Date();
        let currentValue = 0;

        if (goal.type === "weekly") {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          const weekStart = startOfWeek.toISOString().split('T')[0];
          const today = now.toISOString().split('T')[0];

          const result = sqlite.prepare(`
            SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
            FROM cache_vendas 
            WHERE IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
          `).get(goal.salespersonId, weekStart, today) as { total: number };

          currentValue = result.total;
        } else {
          const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
          const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];

          const result = sqlite.prepare(`
            SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
            FROM cache_vendas 
            WHERE IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
          `).get(goal.salespersonId, monthStart, monthEnd) as { total: number };

          currentValue = result.total;
        }

        return {
          ...goal,
          currentValue,
          progress: goal.targetValue > 0 ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100)) : 0,
          salespersonName: sp?.name || "Vendedor",
        };
      } catch (err) {
        return {
          ...goal,
          currentValue: 0,
          progress: 0,
          salespersonName: sp?.name || "Vendedor",
        };
      }
    });
  }

  async createGoal(data: Omit<Goal, "id">): Promise<Goal> {
    const goal: Goal = {
      id: randomUUID(),
      ...data,
    };

    try {
      sqlite.prepare(`
        INSERT INTO goals (id, companyId, salespersonId, type, targetValue, month, year, week)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(goal.id, goal.companyId, goal.salespersonId, goal.type, goal.targetValue, goal.month, goal.year, goal.week ?? null);
      this.goals.push(goal);
    } catch (err) {
      console.error("Error creating goal:", err);
      throw err;
    }

    return goal;
  }

  async updateGoal(id: string, data: Partial<Goal>): Promise<Goal> {
    const index = this.goals.findIndex(g => g.id === id);
    if (index === -1) throw new Error("Meta não encontrada");

    const updatedGoal = { ...this.goals[index], ...data };

    try {
      sqlite.prepare(`
        UPDATE goals SET 
          companyId = ?, salespersonId = ?, type = ?, targetValue = ?, month = ?, year = ?, week = ?
        WHERE id = ?
      `).run(updatedGoal.companyId, updatedGoal.salespersonId, updatedGoal.type, updatedGoal.targetValue, updatedGoal.month, updatedGoal.year, updatedGoal.week ?? null, id);
      this.goals[index] = updatedGoal;
    } catch (err) {
      console.error("Error updating goal:", err);
      throw err;
    }

    return updatedGoal;
  }

  async deleteGoal(id: string): Promise<void> {
    try {
      sqlite.prepare(`DELETE FROM goals WHERE id = ?`).run(id);
      this.goals = this.goals.filter(g => g.id !== id);
    } catch (err) {
      console.error("Error deleting goal:", err);
      throw err;
    }
  }

  async getSalespersonGoals(salespersonId: string, month: number, year: number): Promise<GoalWithProgress[]> {
    const allGoals = await this.getGoals("all", month, year);
    return allGoals.filter(g => g.salespersonId === salespersonId);
  }

  async getAlertNotifications(companyId: string): Promise<AlertNotification[]> {
    try {
      let rows: any[];
      if (companyId === "all") {
        rows = sqlite.prepare(`SELECT * FROM alert_notifications ORDER BY triggeredAt DESC LIMIT 100`).all();
      } else {
        rows = sqlite.prepare(`SELECT * FROM alert_notifications WHERE companyId = ? OR companyId = 'all' ORDER BY triggeredAt DESC LIMIT 100`).all(companyId);
      }
      return rows.map(r => ({
        id: r.id,
        alertId: r.alertId,
        triggeredAt: r.triggeredAt,
        message: r.message,
        severity: r.severity as "info" | "warning" | "critical",
        read: r.read === 1,
        data: (() => { try { return JSON.parse(r.data); } catch { return {}; } })(),
      }));
    } catch (err) {
      console.error("Error getting alert notifications:", err);
      return [];
    }
  }

  async markAlertRead(id: string): Promise<boolean> {
    try {
      const result = sqlite.prepare(`UPDATE alert_notifications SET read = 1 WHERE id = ?`).run(id);
      return result.changes > 0;
    } catch (err) {
      console.error("Error marking alert read:", err);
      return false;
    }
  }

  async dismissAlert(id: string): Promise<boolean> {
    try {
      const result = sqlite.prepare(`DELETE FROM alert_notifications WHERE id = ?`).run(id);
      return result.changes > 0;
    } catch (err) {
      console.error("Error dismissing alert:", err);
      return false;
    }
  }

  async getAlertConfigs(companyId: string): Promise<Alert[]> {
    try {
      let rows: any[];
      if (companyId === "all") {
        rows = sqlite.prepare(`SELECT * FROM alert_configs ORDER BY id`).all();
      } else {
        rows = sqlite.prepare(`SELECT * FROM alert_configs WHERE companyId = ? ORDER BY id`).all(companyId);
      }
      return rows.map(r => ({
        id: r.id,
        companyId: r.companyId,
        type: r.type as Alert["type"],
        threshold: r.threshold,
        enabled: r.enabled === 1,
        message: r.message,
        severity: r.severity as Alert["severity"],
      }));
    } catch (err) {
      console.error("Error getting alert configs:", err);
      return [];
    }
  }

  async updateAlertConfig(id: string, enabled: boolean): Promise<boolean> {
    try {
      const result = sqlite.prepare(`UPDATE alert_configs SET enabled = ? WHERE id = ?`).run(enabled ? 1 : 0, id);
      return result.changes > 0;
    } catch (err) {
      console.error("Error updating alert config:", err);
      return false;
    }
  }

  async createAlertNotification(notification: Omit<AlertNotification, "id"> & { companyId: string }): Promise<AlertNotification> {
    const id = randomUUID();
    sqlite.prepare(`
      INSERT INTO alert_notifications (id, alertId, companyId, triggeredAt, message, severity, read, data)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, notification.alertId, notification.companyId, notification.triggeredAt, notification.message, notification.severity, JSON.stringify(notification.data || {}));
    return { ...notification, id, read: false };
  }

  async getSalespersonsWithStats(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<SalespersonWithStats[]> {
    const allSalespersons = await this.getSalespersons(companyId, teamMembers);
    const rankings = await this.getRankings(companyId, startDate, endDate, "maior_valor_vendido", teamMembers);

    return allSalespersons.map(sp => {
      const rank = rankings.find(r => r.salesperson.id === sp.id);

      if (rank) {
        return {
          salesperson: rank.salesperson,
          stats: {
            totalVendas: rank.value,
            ticketMedio: rank.ticketMedio || 0,
            yoyVariacao: rank.yoyVariacao,
            metaProgress: 0,
            positivacao: rank.positivacao,
            mixProdutos: rank.mixProdutos,
            conexoesSobreTubos: rank.conexoesSobreTubos || 0,
          },
        };
      }

      return {
        salesperson: sp,
        stats: {
          totalVendas: 0,
          ticketMedio: 0,
          yoyVariacao: 0,
          metaProgress: 0,
          positivacao: 0,
          mixProdutos: 0,
          conexoesSobreTubos: 0,
        },
      };
    });
  }

  async getWeeklyView(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<WeeklySalesperson[]> {
    let salespersons = this.getSalespersonsFromCache(companyId);
    if (teamMembers && teamMembers.length > 0) {
      salespersons = salespersons.filter(sp =>
        teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase()))
      );
    }
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const now = new Date();

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weekStart = startOfWeek.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    return salespersons.map(sp => {
      const dailySales = [];
      let totalWeek = 0;
      let totalWeekYoy = 0;

      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();

        const dateYoy = new Date(date);
        dateYoy.setFullYear(dateYoy.getFullYear() - 1);
        const dateStrYoy = dateYoy.toISOString().split('T')[0];

        try {
          const result = sqlite.prepare(`
            SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
            FROM cache_vendas 
            WHERE IDVENDEDOR = ? AND DT_MOVIMENTO = ?
          `).get(sp.id, dateStr) as { total: number };

          const resultYoy = sqlite.prepare(`
            SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
            FROM cache_vendas 
            WHERE IDVENDEDOR = ? AND DT_MOVIMENTO = ?
          `).get(sp.id, dateStrYoy) as { total: number };

          dailySales.push({
            day: days[dayOfWeek],
            value: result.total,
            yoyValue: resultYoy.total,
          });
          totalWeek += result.total;
          totalWeekYoy += resultYoy.total;
        } catch {
          dailySales.push({ day: days[dayOfWeek], value: 0, yoyValue: 0 });
        }
      }

      const yoyVariacao = totalWeekYoy > 0 ? ((totalWeek - totalWeekYoy) / totalWeekYoy) * 100 : 0;

      // Buscar meta semanal do vendedor (global - todas empresas)
      const weeklyGoal = this.goals.find(g =>
        g.salespersonId === sp.id &&
        g.type === "weekly" &&
        g.month === (now.getMonth() + 1) &&
        g.year === now.getFullYear()
      );

      // Calcular vendas totais da semana (todas empresas) para comparar com meta global
      return {
        salesperson: sp,
        dailySales,
        totalWeek,
        yoyVariacao,
        metaProgress: weeklyGoal && weeklyGoal.targetValue > 0 ? Math.min(100, Math.round((totalWeek / weeklyGoal.targetValue) * 100)) : 0,
      };
    });
  }


  async getMonthlyView(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<MonthlySalesperson[]> {
    let salespersons = this.getSalespersonsFromCache(companyId);
    if (teamMembers && teamMembers.length > 0) {
      salespersons = salespersons.filter(sp =>
        teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase()))
      );
    }
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    return salespersons.map(sp => {
      const weeklySales = [];
      let cumulative = 0;
      let cumulativeYoy = 0;

      for (let week = 0; week < 4; week++) {
        const weekStartDay = 1 + week * 7;
        const weekEndDay = Math.min(7 + week * 7, lastDayOfMonth);
        const weekStart = new Date(year, month, weekStartDay);
        const weekEnd = new Date(year, month, weekEndDay);

        const weekStartYoy = new Date(year - 1, month, weekStartDay);
        const weekEndYoy = new Date(year - 1, month, Math.min(weekEndDay, new Date(year - 1, month + 1, 0).getDate()));

        try {
          const result = sqlite.prepare(`
            SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
            FROM cache_vendas 
            WHERE IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
          `).get(sp.id, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]) as { total: number };

          const resultYoy = sqlite.prepare(`
            SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
            FROM cache_vendas 
            WHERE IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
          `).get(sp.id, weekStartYoy.toISOString().split('T')[0], weekEndYoy.toISOString().split('T')[0]) as { total: number };

          const value = result.total;
          const yoyValue = resultYoy.total;
          cumulative += value;
          cumulativeYoy += yoyValue;

          weeklySales.push({
            week: `Sem ${week + 1}`,
            value,
            yoyValue,
            cumulative,
            yoyCumulative: cumulativeYoy,
          });
        } catch {
          weeklySales.push({
            week: `Sem ${week + 1}`,
            value: 0,
            yoyValue: 0,
            cumulative,
            yoyCumulative: 0,
          });
        }
      }

      // Buscar meta mensal do vendedor (global - todas empresas)
      const monthlyGoal = this.goals.find(g =>
        g.salespersonId === sp.id &&
        g.type === "monthly" &&
        g.month === (month + 1) &&
        g.year === year
      );

      // Calcular vendas totais do mês (todas empresas) para comparar com meta global
      let totalMonthAllCompanies = 0;
      try {
        const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
        const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];
        const result = sqlite.prepare(`
          SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
          FROM cache_vendas 
          WHERE IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
        `).get(sp.id, monthStart, monthEnd) as { total: number };
        totalMonthAllCompanies = result.total;
      } catch {
        totalMonthAllCompanies = cumulative;
      }

      const metaProgress = monthlyGoal && monthlyGoal.targetValue > 0
        ? Math.min(100, Math.round((totalMonthAllCompanies / monthlyGoal.targetValue) * 100))
        : 0;

      const yoyVariacao = cumulativeYoy > 0 ? ((cumulative - cumulativeYoy) / cumulativeYoy) * 100 : 0;

      return {
        salesperson: sp,
        weeklySales,
        totalMonth: cumulative,
        yoyVariacao,
        metaProgress,
      };
    });
  }

  async getAFaturarPorVendedor(companyId: string, teamMembers?: string[]): Promise<SalespersonAFaturar[]> {
    try {
      const teamFilter = this.buildTeamFilter(teamMembers, "NOME_VENDEDOR");
      let whereCompany = "";
      if (companyId !== "all") {
        whereCompany = `AND IDEMPRESA = ${parseInt(companyId)}`;
      }

      const rows = sqlite.prepare(`
        SELECT 
          CODIGO_VENDEDOR as id,
          NOME_VENDEDOR as name,
          SUM(VALOR_TOTAL) as valorAFaturar
        FROM cache_vendas_pendentes
        WHERE 1=1 ${whereCompany} ${teamFilter}
        GROUP BY CODIGO_VENDEDOR, NOME_VENDEDOR
        HAVING SUM(VALOR_TOTAL) > 0
        ORDER BY valorAFaturar DESC
      `).all() as { id: string; name: string; valorAFaturar: number }[];

      return rows.map(row => ({
        salesperson: {
          id: row.id,
          name: row.name,
          email: "",
          teamId: "t1",
          companyId: companyId === "all" ? "1" : companyId,
        },
        valorAFaturar: row.valorAFaturar,
      }));
    } catch (err) {
      console.error("Error getting A Faturar:", err);
      return [];
    }
  }
  async getVendorDisplaySettings(): Promise<VendorDisplaySettings[]> {
    try {
      return sqlite.prepare(`SELECT * FROM vendor_display_settings`).all() as VendorDisplaySettings[];
    } catch {
      return [];
    }
  }

  async updateVendorDisplaySetting(setting: VendorDisplaySettings): Promise<VendorDisplaySettings> {
    try {
      const existing = sqlite.prepare(`SELECT * FROM vendor_display_settings WHERE vendorId = ?`).get(setting.vendorId);

      if (existing) {
        sqlite.prepare(`
          UPDATE vendor_display_settings 
          SET displayCode = ?, displayName = ?, isHidden = ?, companyId = ?
          WHERE vendorId = ?
        `).run(setting.displayCode, setting.displayName, setting.isHidden ? 1 : 0, setting.companyId, setting.vendorId);
      } else {
        sqlite.prepare(`
          INSERT INTO vendor_display_settings (id, vendorId, displayCode, displayName, isHidden, companyId)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(setting.id, setting.vendorId, setting.displayCode, setting.displayName, setting.isHidden ? 1 : 0, setting.companyId);
      }
      return setting;
    } catch (err) {
      console.error("Error updating vendor settings:", err);
      throw err;
    }
  }

  async getTVDashboardData(weekStart: string, weekEnd: string, userRole: string, teamMembers?: string[]): Promise<TVDashboardData> {
    const rawSalespersons = this.getSalespersonsFromCache();
    let salespersons = rawSalespersons;

    // Filter by team
    if (teamMembers && teamMembers.length > 0) {
      salespersons = salespersons.filter(sp =>
        teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase()))
      );
    }

    const settings = await this.getVendorDisplaySettings();

    // Calculate Week YoY dates
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    const yoyStart = new Date(start);
    yoyStart.setFullYear(yoyStart.getFullYear() - 1);
    const yoyEnd = new Date(end);
    yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);

    const yoyStartStr = yoyStart.toISOString().split('T')[0];
    const yoyEndStr = yoyEnd.toISOString().split('T')[0];

    const vendorsData = salespersons.map(sp => {
      const setting = settings.find(s => s.vendorId === sp.id);

      // Skip hidden vendors
      if (setting?.isHidden) return null;

      // 1. Fetch Sales (L01 and L03)
      let l01Sales = 0;
      let l03Sales = 0;
      try {
        const rowL01 = sqlite.prepare(`
          SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
          FROM cache_vendas 
          WHERE IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ? AND IDEMPRESA = 1
        `).get(sp.id, weekStart, weekEnd) as { total: number };
        l01Sales = rowL01.total;

        const rowL03 = sqlite.prepare(`
          SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
          FROM cache_vendas 
          WHERE IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ? AND IDEMPRESA = 3
        `).get(sp.id, weekStart, weekEnd) as { total: number };
        l03Sales = rowL03.total;
      } catch (e) {
        console.error("Error fetching sales for TV:", e);
      }

      const totalSales = l01Sales + l03Sales;

      // 2. Fetch YoY
      let yoyValue = 0;
      try {
        const rowYoy = sqlite.prepare(`
          SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
          FROM cache_vendas 
          WHERE IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
        `).get(sp.id, yoyStartStr, yoyEndStr) as { total: number };
        yoyValue = rowYoy.total;
      } catch (e) { }

      const yoyPercentage = yoyValue > 0 ? ((totalSales - yoyValue) / yoyValue) * 100 : 0;

      // 3. Fetch Goals
      // Logic: Supervisor = Single Goal (Total). Manager = Store Goals (L01, L03). 
      // Existing goal table has 'companyId', 'salespersonId', 'type'='weekly'.
      // Assumption: Supervisor meta is stored with companyId='all' or handled by convention?
      // User says: "A meta única (geral) por vendedor já existe e já funciona: NÃO alterar a regra/estrutura atual dessa meta."
      // Let's assume the 'weekly' goal existing is the "General" one for now, or check how goals are stored.
      // If companyId is specific, it's store goal. If companyId is 'all' or not present, it's general.

      // Fetch all weekly goals for this salesperson for this week/month
      // Assuming existing goals are monthly or weekly? Schema has 'type'.
      // User says "A meta é SEMANAL".

      const goals = sqlite.prepare(`
        SELECT * FROM goals 
        WHERE salespersonId = ? AND type = 'weekly' AND month = ? AND year = ?
      `).all(sp.id, (new Date(weekEnd)).getMonth() + 1, (new Date(weekEnd)).getFullYear()) as Goal[];

      let goalValue = 0;
      let isSingle = userRole === 'supervisor';
      let goalL01 = 0;
      let goalL03 = 0;

      if (userRole === 'supervisor') {
        // Sum all goals or find specific "All Company" goal?
        // User says "A meta única (geral) por vendedor já existe". 
        // I'll sum all goals found for the week to be safe as the "Total".
        // Or look for companyId = '1' and '3' and sum them?
        // Let's sum everything found.
        goalValue = goals.reduce((sum, g) => sum + g.targetValue, 0);
      } else {
        // Manager: Needs split
        const g01 = goals.find(g => g.companyId === '1');
        const g03 = goals.find(g => g.companyId === '3');
        goalL01 = g01 ? g01.targetValue : 0;
        goalL03 = g03 ? g03.targetValue : 0;
        goalValue = goalL01 + goalL03;
        isSingle = false;
      }

      const achievement = goalValue > 0 ? (totalSales / goalValue) * 100 : 0;

      return {
        id: sp.id,
        displayCode: setting?.displayCode || sp.id.slice(0, 4), // Fallback
        displayName: setting?.displayName || sp.name.split(' ')[0], // Fallback
        sales: {
          loja01: l01Sales,
          loja03: l03Sales,
          total: totalSales
        },
        goal: {
          value: goalValue,
          isSingle,
          loja01: goalL01,
          loja03: goalL03
        },
        yoy: {
          value: yoyValue,
          percentage: yoyPercentage
        },
        achievement
      };
    }).filter(v => v !== null); // Remove hidden

    // Sort by Total Sales Descending
    vendorsData.sort((a, b) => b!.sales.total - a!.sales.total);

    return {
      meta: {
        weekStart,
        weekEnd,
        lastSync: new Date().toISOString() // In a real app, fetch from sync log
      },
      vendors: vendorsData as any // Typescript trick to avoid strict null checks on filter
    };
  }

  async getGoalSettings(salespersonId: string, month: number, year: number): Promise<GoalSetting[]> {
    if (salespersonId === "all") {
      return this.goalSettings.filter(s => s.month === month && s.year === year);
    }
    return this.goalSettings.filter(
      s => s.salespersonId === salespersonId && s.month === month && s.year === year
    );
  }

  async getSalespersonGoalsRaw(month: number, year: number): Promise<Goal[]> {
    // Returns raw goals without running progress queries — fast batch load for config screen
    return this.goals.filter((g: Goal) => g.month === month && g.year === year);
  }

  async saveGoalSettings(setting: GoalSetting): Promise<GoalSetting> {
    try {
      const existing = this.goalSettings.find(
        s => s.salespersonId === setting.salespersonId &&
          s.type === setting.type &&
          s.month === setting.month &&
          s.year === setting.year
      );

      if (existing) {
        sqlite.prepare(`
          UPDATE goal_settings 
          SET mode = ? 
          WHERE id = ?
        `).run(setting.mode, existing.id);

        Object.assign(existing, { mode: setting.mode });
        return existing;
      } else {
        const id = randomUUID();
        const newSetting = { ...setting, id };

        sqlite.prepare(`
          INSERT INTO goal_settings (id, salespersonId, type, mode, month, year)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, newSetting.salespersonId, newSetting.type, newSetting.mode, newSetting.month, newSetting.year);

        this.goalSettings.push(newSetting);
        return newSetting;
      }
    } catch (err) {
      console.error("Error saving goal setting:", err);
      throw err;
    }
  }

  // === METAS DE VENDAS MODULE ===

  async getVendedorIdByEmail(email: string): Promise<string> {
    try {
      // Buscar o usuário pelo email/username (pode ser C#### ou nome)
      const user = sqlite.prepare("SELECT first_name FROM users WHERE lower(email) = lower(?)").get(email) as { first_name: string } | undefined;
      if (!user || !user.first_name) return email;

      // first_name guarda o NOME COMPLETO do vendedor (ex: "JOANES SILVA")
      // Buscar o IDVENDEDOR pelo nome no cache_vendas
      const row = sqlite.prepare(`
        SELECT CAST(IDVENDEDOR AS TEXT) as IDVENDEDOR 
        FROM cache_vendas 
        WHERE UPPER(NOME_VENDEDOR) = UPPER(?) 
           OR UPPER(NOME_VENDEDOR) LIKE UPPER(?) 
        LIMIT 1
      `).get(user.first_name, `${user.first_name}%`) as { IDVENDEDOR: string } | undefined;

      return row?.IDVENDEDOR ? String(row.IDVENDEDOR) : email;
    } catch (e) {
      return email;
    }
  }

  async getMetasAcompanhamento(vendedorId: string): Promise<any> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const inicio = startOfWeek.toISOString().split('T')[0];

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const fim = endOfWeek.toISOString().split('T')[0];

    const dias_restantes = 6 - now.getDay();

    // Faturamento Loja 1
    const fatLoja1 = sqlite.prepare(`
      SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
      FROM cache_vendas 
      WHERE IDEMPRESA = 1 AND IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
    `).get(vendedorId, inicio, fim) as { total: number };

    // Faturamento Loja 3
    const fatLoja3 = sqlite.prepare(`
      SELECT COALESCE(SUM(TOTALVENDA_LINHA), 0) as total
      FROM cache_vendas 
      WHERE IDEMPRESA = 3 AND IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
    `).get(vendedorId, inicio, fim) as { total: number };

    // Metas Loja 1 e 3
    const getGoal = (companyId: string) => {
      const row = sqlite.prepare(`
          SELECT SUM(targetValue) as totalGoal
          FROM goals 
          WHERE salespersonId = ? AND companyId = ? AND type = 'weekly' AND month = ? AND year = ?
        `).get(vendedorId, companyId, now.getMonth() + 1, now.getFullYear()) as { totalGoal: number | null };
      return row?.totalGoal || 0;
    };

    const calc = (atual: number, meta: number) => {
      const percentual = meta > 0 ? (atual / meta) * 100 : 0;
      const faltante = meta > atual ? meta - atual : 0;
      return { valor_atual: atual, meta, percentual: parseFloat(percentual.toFixed(2)), faltante };
    };

    const loja1 = calc(fatLoja1?.total || 0, getGoal('1'));
    const loja3 = calc(fatLoja3?.total || 0, getGoal('3'));

    // Faturamento Geral fallback
    const total_atual = (fatLoja1?.total || 0) + (fatLoja3?.total || 0);
    const faturamento_geral = calc(total_atual, getGoal('all'));

    // Mix Geral (Todas as Marcas) via cache_tubos_conexoes
    const mixResult = sqlite.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN TIPO_PRODUTO = 'Conexao' THEN VALOR_LIQUIDO ELSE 0 END), 0) as conexoes,
        COALESCE(SUM(CASE WHEN TIPO_PRODUTO = 'Tubo' THEN VALOR_LIQUIDO ELSE 0 END), 0) as tubos
      FROM cache_tubos_conexoes
      WHERE IDVENDEDOR = ? AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
    `).get(vendedorId, inicio, fim) as { conexoes: number; tubos: number };

    const valor_conexoes = mixResult?.conexoes || 0;
    const valor_tubos = mixResult?.tubos || 0;
    const percentual_conexoes = valor_tubos > 0 ? (valor_conexoes / valor_tubos) * 100 : 0;

    return {
      last_update: now.toISOString(),
      periodo: {
        tipo: 'semana',
        inicio,
        fim,
        dias_restantes: dias_restantes > 0 ? dias_restantes : 0
      },
      loja1,
      loja3,
      faturamento: faturamento_geral,
      mix_geral: {
        percentual_conexoes: parseFloat(percentual_conexoes.toFixed(2)),
        valor_conexoes,
        valor_tubos
      }
    };
  }

  async getMetasAmancoDTR(vendedorId: string, targetYear?: number, targetQuarter?: number): Promise<any> {
    const now = new Date();
    const year = targetYear ?? now.getFullYear();

    // Calculate quarter boundaries
    const quarter = targetQuarter ?? Math.floor(now.getMonth() / 3);
    const quarterStartMonth = quarter * 3;
    const quarterEndMonth = quarterStartMonth + 2;

    const firstDay = new Date(year, quarterStartMonth, 1);
    const lastDay = new Date(year, quarterEndMonth + 1, 0); // Last day of the end month

    const inicioStr = firstDay.toISOString().split('T')[0];
    const fimStr = lastDay.toISOString().split('T')[0];

    // Atual Vendedor Total Amanco
    const resultAtual = sqlite.prepare(`
      SELECT COALESCE(SUM(VALOR_LIQUIDO), 0) as total
      FROM cache_campanhas 
      WHERE IDVENDEDOR = ? AND DTMOVIMENTO >= ? AND DTMOVIMENTO <= ? AND FABRICANTE = 'AMANCO'
    `).get(vendedorId, inicioStr, fimStr) as { total: number };

    const valor_atual = resultAtual?.total || 0;

    // Mix Amanco in the exact same Trimester period
    const resultMix = sqlite.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN TipoProduto = 'Tubo' THEN VALOR_LIQUIDO ELSE 0 END), 0) as tubos,
        COALESCE(SUM(CASE WHEN TipoProduto = 'Conexão' THEN VALOR_LIQUIDO ELSE 0 END), 0) as conexoes
      FROM cache_amanco_mix 
      WHERE IDVENDEDOR = ? AND DTMOVIMENTO >= ? AND DTMOVIMENTO <= ?
    `).get(vendedorId, inicioStr, fimStr) as { tubos: number, conexoes: number };

    const tubos = resultMix?.tubos || 0;
    const conexoes = resultMix?.conexoes || 0;
    const percentual_conexoes = tubos > 0 ? (conexoes / tubos) * 100 : 0; // Fixed Mix formula here too (Conexoes over Tubos)

    // Ano Anterior Vendedor - Exactly the same trimester last year
    const lastYear = year - 1;
    const firstDayLy = new Date(lastYear, quarterStartMonth, 1);
    const lastDayLy = new Date(lastYear, quarterEndMonth + 1, 0);
    const inicioLyStr = firstDayLy.toISOString().split('T')[0];
    const fimLyStr = lastDayLy.toISOString().split('T')[0];

    const resultLy = sqlite.prepare(`
      SELECT COALESCE(SUM(VALOR_LIQUIDO), 0) as total
      FROM cache_campanhas 
      WHERE IDVENDEDOR = ? AND DTMOVIMENTO >= ? AND DTMOVIMENTO <= ? AND FABRICANTE = 'AMANCO'
    `).get(vendedorId, inicioLyStr, fimLyStr) as { total: number };

    const valor_ano_anterior = resultLy?.total || 0;

    // Get individualized gatilho logic for DTR Amanco
    const triggerQuery = sqlite.prepare(`
      SELECT triggerValue FROM campaign_goals 
      WHERE salespersonId = ? AND campaignName = 'dtr_amanco' AND year = ?
    `).get(vendedorId, year) as { triggerValue: number } | undefined;

    const gatilho_individual = triggerQuery?.triggerValue || 0;

    // Crescimento real: sempre usa valor_ano_anterior como denominador (meta não interfere no %)
    const crescimento_percentual = valor_ano_anterior > 0 ? ((valor_atual - valor_ano_anterior) / valor_ano_anterior) * 100 : (valor_atual > 0 ? 100 : 0);

    // Loja (Todas Vendas Amanco) no mesmo trimestre
    const resultLoja = sqlite.prepare(`
      SELECT COALESCE(SUM(VALOR_LIQUIDO), 0) as total
      FROM cache_campanhas 
      WHERE DTMOVIMENTO >= ? AND DTMOVIMENTO <= ? AND FABRICANTE = 'AMANCO'
    `).get(inicioStr, fimStr) as { total: number };
    const loja_valor_atual = resultLoja?.total || 0;

    const resultLojaLy = sqlite.prepare(`
      SELECT COALESCE(SUM(VALOR_LIQUIDO), 0) as total
      FROM cache_campanhas 
      WHERE DTMOVIMENTO >= ? AND DTMOVIMENTO <= ? AND FABRICANTE = 'AMANCO'
    `).get(inicioLyStr, fimLyStr) as { total: number };
    const loja_valor_ano_anterior = resultLojaLy?.total || 0;
    const loja_crescimento_percentual = loja_valor_ano_anterior > 0 ? ((loja_valor_atual - loja_valor_ano_anterior) / loja_valor_ano_anterior) * 100 : (loja_valor_atual > 0 ? 100 : 0);

    // Hardcoded logic according to spec for DTR Amanco
    const meta_gatilho = 120000;
    const meta_mix = 40.0;
    const meta_loja = 25.0;

    // The individual gatilho is the minimum goal they must reach
    // They must hit Gatilho OR base_comparacao
    const gatilho = valor_atual >= (gatilho_individual > 0 ? gatilho_individual : meta_gatilho);
    // Arredonda percentual antes de comparar para evitar erro de ponto flutuante (ex: 44.9999... = 45.0% exibido)
    const percentual_conexoes_arredondado = parseFloat(percentual_conexoes.toFixed(2));
    const mix = percentual_conexoes_arredondado >= meta_mix;
    const crescimento_loja = loja_crescimento_percentual >= meta_loja;

    // Coleta todos os motivos de não elegibilidade
    const motivos: string[] = [];
    if (!gatilho) motivos.push("Abaixo do gatilho mínimo");
    if (!mix) motivos.push("Mix de conexões abaixo de 40%");
    if (!crescimento_loja) motivos.push("Crescimento global da loja insuficiente (meta: 25%)");

    const quarterNames = ["JAN/FEV/MAR", "ABR/MAI/JUN", "JUL/AGO/SET", "OUT/NOV/DEZ"];
    return {
      last_update: now.toISOString(),
      periodo: { inicio: inicioStr, fim: fimStr, nome: quarterNames[quarter] },
      faturamento_amanco: {
        valor_atual,
        meta_gatilho: gatilho_individual > 0 ? gatilho_individual : meta_gatilho,
        percentual: (() => {
          const den = gatilho_individual > 0 ? gatilho_individual : meta_gatilho;
          return parseFloat((den > 0 ? (valor_atual / den) * 100 : 0).toFixed(2));
        })(),
        faltante: gatilho ? 0 : (gatilho_individual > 0 ? gatilho_individual : meta_gatilho) - valor_atual,
        gatilho_atingido: gatilho
      },
      crescimento_vendedor: {
        valor_atual,
        valor_ano_anterior,
        crescimento_percentual: parseFloat(crescimento_percentual.toFixed(2))
      },
      mix_amanco: {
        tubos,
        conexoes,
        percentual_conexoes: parseFloat(percentual_conexoes.toFixed(2)),
        meta_percentual: meta_mix,
        status_ok: mix
      },
      crescimento_loja: {
        loja_valor_atual,
        loja_valor_ano_anterior,
        crescimento_percentual: parseFloat(loja_crescimento_percentual.toFixed(2)),
        meta_percentual: meta_loja,
        status_ok: crescimento_loja
      },
      elegibilidade: {
        gatilho,
        mix,
        crescimento_loja,
        participando: gatilho && mix && crescimento_loja,
        motivos
      }
    };
  }

  async getMetasAmancoTV(vendedorId: string): Promise<any> {
    const now = new Date();
    // Campanha TV Amanco 2026: 15/02/2026 a 15/04/2026
    const year = 2026;
    const inicioStr = `${year}-02-15`;
    const fimStr = `${year}-04-15`;

    const isEncerrado = now > new Date(`${fimStr}T23:59:59`);

    // Atual Vendedor
    const resultAtual = sqlite.prepare(`
      SELECT COALESCE(SUM(VALOR_LIQUIDO), 0) as total
      FROM cache_campanhas 
      WHERE IDVENDEDOR = ? AND DTMOVIMENTO >= ? AND DTMOVIMENTO <= ? AND FABRICANTE = 'AMANCO'
    `).get(vendedorId, inicioStr, fimStr) as { total: number };

    const valor_atual = resultAtual?.total || 0;

    // Mix Amanco
    const resultMix = sqlite.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN TipoProduto = 'Tubo' THEN VALOR_LIQUIDO ELSE 0 END), 0) as tubos,
        COALESCE(SUM(CASE WHEN TipoProduto = 'Conexão' THEN VALOR_LIQUIDO ELSE 0 END), 0) as conexoes
      FROM cache_amanco_mix 
      WHERE IDVENDEDOR = ? AND DTMOVIMENTO >= ? AND DTMOVIMENTO <= ?
    `).get(vendedorId, inicioStr, fimStr) as { tubos: number, conexoes: number };

    const tubos = resultMix?.tubos || 0;
    const conexoes = resultMix?.conexoes || 0;
    const percentual_conexoes = tubos > 0 ? (conexoes / tubos) * 100 : 0;

    // Ano Anterior Vendedor — mesmo intervalo do ano anterior (15/02 a 15/04)
    const lastYear = year - 1;
    const inicioLyStr = `${lastYear}-02-15`;
    const fimLyStr = `${lastYear}-04-15`;

    const resultLy = sqlite.prepare(`
      SELECT COALESCE(SUM(VALOR_LIQUIDO), 0) as total
      FROM cache_campanhas 
      WHERE IDVENDEDOR = ? AND DTMOVIMENTO >= ? AND DTMOVIMENTO <= ? AND FABRICANTE = 'AMANCO'
    `).get(vendedorId, inicioLyStr, fimLyStr) as { total: number };

    const valor_ano_anterior = resultLy?.total || 0;

    // Gatilho individualizado para TV Amanco (apenas como critério de elegibilidade)
    const triggerQuery = sqlite.prepare(`
      SELECT triggerValue FROM campaign_goals 
      WHERE salespersonId = ? AND campaignName = 'tv_amanco' AND year = ?
    `).get(vendedorId, year) as { triggerValue: number } | undefined;

    const gatilho_individual = triggerQuery?.triggerValue || 0;

    // Crescimento real: sempre usa valor_ano_anterior como denominador (meta não interfere no %)
    const crescimento_percentual = valor_ano_anterior > 0 ? ((valor_atual - valor_ano_anterior) / valor_ano_anterior) * 100 : (valor_atual > 0 ? 100 : 0);

    // Loja (Todas Vendas)
    const resultLoja = sqlite.prepare(`
      SELECT COALESCE(SUM(VALOR_LIQUIDO), 0) as total
      FROM cache_campanhas 
      WHERE DTMOVIMENTO >= ? AND DTMOVIMENTO <= ? AND FABRICANTE = 'AMANCO'
    `).get(inicioStr, fimStr) as { total: number };
    const loja_valor_atual = resultLoja?.total || 0;

    const resultLojaLy = sqlite.prepare(`
      SELECT COALESCE(SUM(VALOR_LIQUIDO), 0) as total
      FROM cache_campanhas 
      WHERE DTMOVIMENTO >= ? AND DTMOVIMENTO <= ? AND FABRICANTE = 'AMANCO'
    `).get(inicioLyStr, fimLyStr) as { total: number };
    const loja_valor_ano_anterior = resultLojaLy?.total || 0;
    const loja_crescimento_percentual = loja_valor_ano_anterior > 0 ? ((loja_valor_atual - loja_valor_ano_anterior) / loja_valor_ano_anterior) * 100 : (loja_valor_atual > 0 ? 100 : 0);

    // Metas da Campanha TV Amanco
    const meta_gatilho = 60000;
    const meta_mix = 45.0; // 45% Mix
    const meta_crescimento_vendedor = 20.0;
    const meta_loja = 25.0;

    const gatilho = valor_atual >= (gatilho_individual > 0 ? gatilho_individual : meta_gatilho);
    const crescimento_vendedor_ok = crescimento_percentual >= meta_crescimento_vendedor;
    // Arredonda percentual antes de comparar para evitar erro de ponto flutuante (ex: 44.9999... = 45.0% exibido)
    const percentual_conexoes_arredondado = parseFloat(percentual_conexoes.toFixed(2));
    const mix = percentual_conexoes_arredondado >= meta_mix;
    const crescimento_loja_ok = loja_crescimento_percentual >= meta_loja;

    // Coleta todos os motivos de não elegibilidade
    const motivos: string[] = [];
    if (!gatilho) motivos.push("Abaixo do gatilho mínimo");
    if (!crescimento_vendedor_ok) motivos.push("Crescimento vs. ano anterior abaixo de 20%");
    if (!mix) motivos.push("Mix de conexões abaixo de 45%");
    if (!crescimento_loja_ok) motivos.push("Crescimento global da loja insuficiente (meta: 25%)");

    return {
      last_update: now.toISOString(),
      periodo: { inicio: inicioStr, fim: fimStr, encerrado: isEncerrado },
      faturamento_amanco: {
        valor_atual,
        meta_gatilho: gatilho_individual > 0 ? gatilho_individual : meta_gatilho,
        percentual: (() => {
          const den = gatilho_individual > 0 ? gatilho_individual : meta_gatilho;
          return parseFloat((den > 0 ? (valor_atual / den) * 100 : 0).toFixed(2));
        })(),
        faltante: gatilho ? 0 : (gatilho_individual > 0 ? gatilho_individual : meta_gatilho) - valor_atual,
        gatilho_atingido: gatilho
      },
      crescimento_vendedor: {
        valor_atual,
        valor_ano_anterior,
        crescimento_percentual: parseFloat(crescimento_percentual.toFixed(2)),
        meta_percentual: meta_crescimento_vendedor,
        status_ok: crescimento_vendedor_ok
      },
      mix_amanco: {
        tubos,
        conexoes,
        percentual_conexoes: parseFloat(percentual_conexoes.toFixed(2)),
        meta_percentual: meta_mix,
        status_ok: mix
      },
      crescimento_loja: {
        loja_valor_atual,
        loja_valor_ano_anterior,
        crescimento_percentual: parseFloat(loja_crescimento_percentual.toFixed(2)),
        meta_percentual: meta_loja,
        status_ok: crescimento_loja_ok
      },
      elegibilidade: {
        gatilho,
        crescimento_vendedor: crescimento_vendedor_ok,
        mix,
        crescimento_loja: crescimento_loja_ok,
        participando: gatilho && crescimento_vendedor_ok && mix && crescimento_loja_ok,
        motivos
      }
    };
  }

  async getMetasElit(vendedorId: string): Promise<any> {
    const now = new Date();

    // Elit Weekly Cycle (Saturday -> Friday), payout on next Saturday
    // Find the most recent Saturday (or today if today is Saturday)
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    let daysSinceSaturday;
    
    if (currentDayOfWeek === 6) {
      // Sábado: mostrar a semana anterior (sábado passado até sexta de ontem)
      daysSinceSaturday = 7;
    } else if (currentDayOfWeek === 0) {
      // Domingo: continuar mostrando a semana anterior
      daysSinceSaturday = 8;
    } else {
      // Segunda a Sexta: mostrar a semana atual (que começou no sábado mais recente)
      daysSinceSaturday = currentDayOfWeek + 1;
    }

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysSinceSaturday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Friday
    endOfWeek.setHours(23, 59, 59, 999);

    const payoutDate = new Date(endOfWeek);
    payoutDate.setDate(endOfWeek.getDate() + 1); // Next Saturday

    const formatLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const inicioStr = formatLocal(startOfWeek);
    const fimStr = formatLocal(endOfWeek);
    const pagStr = formatLocal(payoutDate);

    const result = sqlite.prepare(`
      SELECT 
        COALESCE(SUM(VALOR_LIQUIDO), 0) as total,
        DESCRICAO_PRODUTO as DESCRICAOPRODUTO,
        SUM(QTD) as qty
      FROM cache_campanhas 
      WHERE IDVENDEDOR = ? AND DTMOVIMENTO >= ? AND DTMOVIMENTO <= ? AND (FABRICANTE IS NULL OR FABRICANTE <> 'AMANCO')
      GROUP BY DESCRICAO_PRODUTO
    `).all(vendedorId, inicioStr, fimStr) as { total: number, DESCRICAOPRODUTO: string, qty: number }[];

    const valor_vendido = result.reduce((acc, curr) => acc + curr.total, 0);

    const goalsRows = sqlite.prepare(`
      SELECT triggerValue FROM campaign_goals WHERE salespersonId = ? AND campaignName = 'elit' AND year = ?
    `).all(vendedorId, now.getFullYear()) as { triggerValue: number }[];
    const gatilho_minimo = goalsRows.length > 0 ? goalsRows[0].triggerValue : 3000.0;

    const participando = valor_vendido >= gatilho_minimo;
    const faltante = participando ? 0 : gatilho_minimo - valor_vendido;

    let total_receber = 0;
    const detalhes = [];

    const commissionMap: Record<string, number> = {
      "BORRACHA LIQ. SEMIACET. 21,5KG": 10.0,
      "TINTA EMBORR. 18KG": 7.0,
      "IMPERMEABILIZANTE 18KG": 5.0,
      "IMPERMEABILIZANTE GL": 5.0,
      "TINTA DIRETO GESSO 18L": 5.0,
      "TINTA DIRETO GESSO GL": 5.0,
      "TEXTURA RUSTIC. 23KG": 3.0,
      "MASSA ACRILICA": 2.0,
      "TEXTURA LISA 23KG": 2.0,
      "TINTA ESM. (BASE AGUA) 3,6L": 3.0,
      "TINTA ESM. 3,6L": 2.0,
      "TINTA ESM. 900ML": 0.50,
      "TINTA PISO 18L": 3.0,
      "TINTA PISO 15L": 3.0,
      "TINTA PISO 3,6L": 2.0,
      "TINTA SUPER REND. 20L": 4.0,
      "TINTA SUPER REND. 18L": 3.0,
      "TINTA SUPER COMPL 18L": 3.0,
      "TINTA SUPER REND. 15L": 2.0,
      "TINTA SUPER REND. SEMIBRILHO 15L": 2.0,
      "TINTA SUPER REND. 3,6L": 1.50, // Default for 3.6L, specific cases handled below
      "TINTA SUPER COMPL 3,6L": 2.0,
      "TINTA VINIL ACR. 18L": 3.0,
      "TINTA VINIL ACR. 15L": 2.0,
      "TINTA VINIL ACR. 3,6L": 0.50,
      "VERNIZ COPAL 3,6L": 2.0,
      "VERNIZ MARITIMO 3,6L": 2.0,
      "ZARCAO 3,6L": 2.0,
      "VERNIZ COPAL 900ML": 0.50,
      "VERNIZ MARITIMO 900ML": 0.50,
      "ZARCAO 900ML": 0.50,
      "HIPERFLOOR DEMAR. VIARIA BASE SOLV. 18L": 3.0,
      "TINTA CLAS. 18L": 3.0,
      "TINTA CLAS. 3,6L": 2.0,
      "TINTA PROFIS. 18L": 2.0,
      "TINTA ACRI. MAX PROF. 18L": 2.0,
      "TINTA SUBLIME 18L": 2.0,
      "TINTA ACRI. MAX PROF. 3,6L": 1.0,
      "TINTA PROFIS. 3,6L": 1.0,
      "SELADOR ESM. (BASE AGUA) GL": 2.0
    };

    const isExcluded = (desc: string): boolean => {
      return desc.includes("FUNDO PREPARADOR") ||
        desc.includes("REJUNTE") ||
        desc.includes("RESINA") ||
        desc.includes("SELADOR") ||
        desc.includes("THINNER") ||
        desc.includes("112,5ML");
    };

    const getElitCommission = (desc: string): number => {
      const d = desc.toUpperCase();

      // Preserve original structure: check exclusions first (they override the map)
      if (isExcluded(d) && !d.includes("SELADOR ESM. (BASE AGUA) GL")) return 0;

      // Specific cases for "TINTA SUPER REND. 3,6L"
      if (d.includes("TINTA SUPER REND. 3,6L")) {
        if (d.includes("MEL") || d.includes("VD PISCINA")) return 2.0;
        return commissionMap["TINTA SUPER REND. 3,6L"]; // Default 1.50
      }

      // O(1) map checking optimization instead of multiple nested if/includes
      for (const [key, value] of Object.entries(commissionMap)) {
        if (d.includes(key)) return value;
      }
      return 0; // Produtos não mapeados não geram recompensa default para segurança
    };

    for (const r of result) {
      const descName = r.DESCRICAOPRODUTO || "Tinta Elit Genérica";
      const recompensa_unit = getElitCommission(descName);

      // Quantidades no banco (QTD) vêm em gramas/ml na query do DB2 (ex: 3000 para 3 latas).
      // Precisamos dividir por 1000 para ter a quantidade de UNIDADES reais do produto.
      const qtd_unidades = r.qty / 1000;
      const itemTotal = qtd_unidades * recompensa_unit;

      if (participando) {
        total_receber += itemTotal;
      }

      detalhes.push({
        produto: descName,
        qtd: qtd_unidades,
        recompensa_unit,
        total: itemTotal
      });
    }

    // Filtrar apenas produtos que geram comissão ou que foram vendidos para não poluir
    const detalhesFiltrados = detalhes.filter(d => d.qtd > 0 && d.recompensa_unit > 0);

    return {
      last_update: now.toISOString(),
      periodo: { inicio: inicioStr, fim: fimStr, pagamento_em: pagStr },
      gatilho_minimo,
      valor_vendido,
      faltante,
      participando,
      total_receber: participando ? total_receber : 0,
      detalhes: detalhesFiltrados,
      observacao: `Total a receber só é liberado a partir de R$ ${gatilho_minimo.toFixed(2)} no ciclo.`
    };
  }

  async getCampaignGoals(campaignName: string, year: number): Promise<{ salespersonId: string; triggerValue: number }[]> {
    const rows = sqlite.prepare(`
      SELECT salespersonId, triggerValue 
      FROM campaign_goals
      WHERE campaignName = ? AND year = ?
    `).all(campaignName, year) as { salespersonId: string; triggerValue: number }[];
    return rows;
  }

  async saveCampaignGoals(campaignName: string, year: number, goals: { salespersonId: string; triggerValue: number }[]): Promise<void> {
    const stmt = sqlite.prepare(`
      INSERT INTO campaign_goals (id, salespersonId, campaignName, year, triggerValue)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(salespersonId, campaignName, year) 
      DO UPDATE SET triggerValue = excluded.triggerValue
    `);

    const insertMany = sqlite.transaction((items) => {
      for (const item of items) {
        stmt.run(
          Math.random().toString(36).substring(2, 15),
          item.salespersonId,
          campaignName,
          year,
          item.triggerValue
        );
      }
    });

    try {
      insertMany(goals);
    } catch (err) {
      console.error("Failed to save campaign goals:", err);
      throw err;
    }
  }

  // --- Vendor Groups ---
  async getVendorGroups(): Promise<{ id: string, name: string, members: string[] }[]> {
    const groups = sqlite.prepare(`SELECT id, name FROM vendor_groups`).all() as { id: string, name: string }[];
    const members = sqlite.prepare(`SELECT group_id, salesperson_id FROM vendor_group_members`).all() as { group_id: string, salesperson_id: string }[];

    return groups.map(g => ({
      id: g.id,
      name: g.name,
      members: members.filter(m => m.group_id === g.id).map(m => m.salesperson_id)
    }));
  }

  async saveVendorGroup(id: string, name: string, members: string[]): Promise<void> {
    sqlite.prepare(`
      INSERT INTO vendor_groups (id, name) VALUES (?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name
    `).run(id, name);

    sqlite.prepare(`DELETE FROM vendor_group_members WHERE group_id = ?`).run(id);

    const insertMember = sqlite.prepare(`
      INSERT INTO vendor_group_members (group_id, salesperson_id) VALUES (?, ?)
    `);

    sqlite.transaction(() => {
      for (const memberId of members) {
        insertMember.run(id, memberId);
      }
    })();
  }

  async deleteVendorGroup(id: string): Promise<void> {
    // ON DELETE CASCADE is enabled, so this also deletes members
    sqlite.prepare(`DELETE FROM vendor_groups WHERE id = ?`).run(id);
  }

  // --- Campaign Reports ---
  async getCampaignReport(campaignName: string, periodYear?: number, periodQuarter?: number): Promise<any[]> {
    const salespeople = await this.getSalespersons('1');
    const reportList = [];

    for (const sp of salespeople) {
      // Pular "SEM VENDEDOR" etc se necessário, mas getSalespersons ja filtra
      let data;
      let targetTrigger = 0;
      let currentSales = 0;
      let percentAchieved = 0;
      let isEligible = false;

      try {
        if (campaignName === 'dtr_amanco') {
          data = await this.getMetasAmancoDTR(sp.id, periodYear, periodQuarter);
          targetTrigger = data.faturamento_amanco?.meta_gatilho || 0;
          currentSales = data.faturamento_amanco?.valor_atual || 0;
          percentAchieved = data.faturamento_amanco?.percentual || 0;
          isEligible = data.elegibilidade?.participando === true;
        } else if (campaignName === 'tv_amanco') {
          data = await this.getMetasAmancoTV(sp.id);
          targetTrigger = data.faturamento_amanco?.meta_gatilho || 0;
          currentSales = data.faturamento_amanco?.valor_atual || 0;
          percentAchieved = data.faturamento_amanco?.percentual || 0;
          isEligible = data.elegibilidade?.participando === true;
        } else if (campaignName === 'elit') {
          data = await this.getMetasElit(sp.id);
          targetTrigger = data.gatilho_minimo || 0;
          currentSales = data.valor_vendido || 0;
          percentAchieved = targetTrigger > 0 ? (currentSales / targetTrigger) * 100 : 0;
          isEligible = data.participando === true;
        } else {
          continue;
        }

        reportList.push({
          salespersonId: sp.id,
          salespersonName: sp.name,
          targetTrigger,
          currentSales,
          percentAchieved,
          isEligible,
          details: data // Include raw data for potential advanced UI usage
        });
      } catch (err) {
        console.warn(`Error generating report for ${sp.name}:`, err);
      }
    }

    // Sort by percentAchieved descending
    return reportList.sort((a, b) => b.percentAchieved - a.percentAchieved);
  }

  async getMovimentacoesPorVendedor(vendedorId: string, startDate: string, endDate: string): Promise<any[]> {
    const rows = sqlite.prepare(`
      SELECT
        DT_MOVIMENTO as dtMovimento,
        IDCLIENTE as idCliente,
        NOME_CLIENTE as nomeCliente,
        IDEMPRESA as idEmpresa,
        IDPLANILHA as numNota,
        TIPOMOVIMENTO as tipoMovimento,
        SUM(TOTALVENDA_LINHA) as valContabil,
        SUM(LUCRO_LINHA) as lucro
      FROM cache_vendas
      WHERE IDVENDEDOR = ?
        AND DT_MOVIMENTO >= ?
        AND DT_MOVIMENTO <= ?
      GROUP BY DT_MOVIMENTO, IDCLIENTE, NOME_CLIENTE, IDEMPRESA, IDPLANILHA, TIPOMOVIMENTO
      ORDER BY DT_MOVIMENTO DESC, IDPLANILHA
    `).all(vendedorId, startDate, endDate) as any[];

    return rows.map(row => {
      const isDevolucao = row.tipoMovimento === "E";
      const nomeBase = row.nomeCliente ?? "";
      return {
        dtMovimento: row.dtMovimento,
        idCliente: row.idCliente,
        nomeCliente: isDevolucao ? `${nomeBase}-DEV` : nomeBase,
        idEmpresa: row.idEmpresa,
        numNota: row.numNota,
        serieNota: "",
        tipoMovimento: row.tipoMovimento,
        isDevolucao,
        valContabil: row.valContabil ?? 0,
        lucro: row.lucro ?? 0,
      };
    });
  }

  async getAppSetting(key: string): Promise<string | null> {
    try {
      const row = sqlite.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as { value: string } | undefined;
      return row ? row.value : null;
    } catch {
      return null;
    }
  }

  async setAppSetting(key: string, value: string): Promise<void> {
    sqlite.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value);
  }
}

export const storage = new SqliteStorage();
