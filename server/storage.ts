import { randomUUID } from "crypto";
import { pgGet, pgAll, pgRun } from "./pg-client";
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

  getVendorDisplaySettings(): Promise<VendorDisplaySettings[]>;
  updateVendorDisplaySetting(setting: VendorDisplaySettings): Promise<VendorDisplaySettings>;
  getTVDashboardData(weekStart: string, weekEnd: string, userRole: string, teamMembers?: string[]): Promise<TVDashboardData>;

  getGoalSettings(salespersonId: string, month: number, year: number): Promise<GoalSetting[]>;
  saveGoalSettings(settings: GoalSetting): Promise<GoalSetting>;
  getSalespersonGoalsRaw(month: number, year: number): Promise<Goal[]>;

  getVendedorIdByEmail(email: string): Promise<string>;
  getMetasAcompanhamento(vendedorId: string, periodo?: "semana" | "mes"): Promise<any>;
  getMetasAmancoDTR(vendedorId: string, targetYear?: number, targetQuarter?: number): Promise<any>;
  getMetasAmancoTV(vendedorId: string): Promise<any>;
  getMetasElit(vendedorId: string): Promise<any>;

  getCampaignGoals(campaignName: string, year: number): Promise<{ salespersonId: string; triggerValue: number }[]>;
  saveCampaignGoals(campaignName: string, year: number, goals: { salespersonId: string; triggerValue: number }[]): Promise<void>;

  getVendorGroups(): Promise<{ id: string; name: string; members: string[] }[]>;
  saveVendorGroup(id: string, name: string, members: string[]): Promise<void>;
  deleteVendorGroup(id: string): Promise<void>;

  getCampaignReport(campaignName: string): Promise<any[]>;

  getMovimentacoesPorVendedor(vendedorId: string, startDate: string, endDate: string): Promise<any[]>;

  getAppSetting(key: string): Promise<string | null>;
  setAppSetting(key: string, value: string): Promise<void>;
}

const teams: Team[] = [
  { id: "t1", name: "Equipe Vendas", companyId: "1", supervisorId: "s1" },
];

export class PostgresStorage implements IStorage {
  private goals: Goal[] = [];
  private goalSettings: GoalSetting[] = [];

  static async create(): Promise<PostgresStorage> {
    const s = new PostgresStorage();
    await s.init();
    return s;
  }

  private async init() {
    await this.loadGoalsFromDb();
    await this.loadGoalSettingsFromDb();
  }

  private buildTeamFilter(teamMembers?: string[], columnName: string = `"NOME_VENDEDOR"`): string {
    const excludeInternal = ` AND UPPER(${columnName}) NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%' `;
    if (!teamMembers || teamMembers.length === 0) return excludeInternal;
    const validNames = teamMembers.filter(n => n.trim().length > 0);
    if (validNames.length === 0) return excludeInternal;
    const conditions = validNames.map(name => {
      const safe = name.replace(/\\/g, "\\\\").replace(/'/g, "''").toUpperCase();
      return `UPPER(${columnName}) LIKE '%${safe}%'`;
    }).join(" OR ");
    return `${excludeInternal} AND (${conditions})`;
  }

  private async getConexoesSobreTubos(vendedorId: string, companyId?: string, startDate?: string, endDate?: string): Promise<number | null> {
    try {
      let whereCompany = "";
      if (companyId && companyId !== "all") {
        whereCompany = `AND "IDEMPRESA" = ${parseInt(companyId)}`;
      }
      let wherePeriod = "";
      if (startDate && endDate) {
        wherePeriod = `AND "DT_MOVIMENTO" >= '${startDate}' AND "DT_MOVIMENTO" <= '${endDate}'`;
      }

      const result = await pgGet<{ conexoes: number; tubos: number }>(`
        SELECT
          COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Conexao' THEN "VALOR_LIQUIDO" ELSE 0 END), 0) as conexoes,
          COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Tubo' THEN "VALOR_LIQUIDO" ELSE 0 END), 0) as tubos
        FROM cache_tubos_conexoes
        WHERE "IDVENDEDOR" = ? ${whereCompany} ${wherePeriod}
      `, [vendedorId]);

      if (!result || result.tubos === 0) return null;
      return (result.conexoes / result.tubos) * 100;
    } catch (e) {
      return null;
    }
  }

  private async getCompaniesFromCache(): Promise<Company[]> {
    try {
      const rows = await pgAll<{ id: string; name: string; cnpj: string }>(`
        SELECT DISTINCT
          CAST("IDEMPRESA" AS TEXT) as id,
          "RAZAO_SOCIAL_EMPRESA" as name,
          "CNPJ_EMPRESA" as cnpj
        FROM cache_vendas
        WHERE "CNPJ_EMPRESA" IS NOT NULL AND "CNPJ_EMPRESA" != ''
        ORDER BY id
      `);

      if (rows.length === 0) {
        return [{ id: "1", name: "Conectubos", cnpj: "00.000.000/0001-00" }];
      }
      return rows;
    } catch (err) {
      return [{ id: "1", name: "Conectubos", cnpj: "00.000.000/0001-00" }];
    }
  }

  private async getSalespersonsFromCache(companyId?: string): Promise<Salesperson[]> {
    try {
      let rows: { id: string; name: string; companyId: string }[];

      if (companyId && companyId !== "all") {
        rows = await pgAll(`
          SELECT DISTINCT
            "IDVENDEDOR" as id,
            "NOME_VENDEDOR" as name,
            CAST("IDEMPRESA" AS TEXT) as "companyId"
          FROM cache_vendas
          WHERE "IDVENDEDOR" IS NOT NULL
            AND "NOME_VENDEDOR" IS NOT NULL
            AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
            AND UPPER("NOME_VENDEDOR") NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%'
            AND "IDEMPRESA" = ?
          ORDER BY "NOME_VENDEDOR"
        `, [parseInt(companyId)]);
      } else {
        rows = await pgAll(`
          SELECT
            "IDVENDEDOR" as id,
            MIN("NOME_VENDEDOR") as name,
            MIN(CAST("IDEMPRESA" AS TEXT)) as "companyId"
          FROM cache_vendas
          WHERE "IDVENDEDOR" IS NOT NULL
            AND "NOME_VENDEDOR" IS NOT NULL
            AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
            AND UPPER("NOME_VENDEDOR") NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%'
          GROUP BY "IDVENDEDOR"
          ORDER BY name
        `);
      }

      return rows.map((row: any) => ({
        id: String(row.id ?? row.IDVENDEDOR ?? row.idvendedor ?? ""),
        name: String(row.name ?? row.NOME_VENDEDOR ?? row.nome_vendedor ?? "Nome não encontrado"),
        email: "",
        teamId: "t1",
        companyId: String(row.companyId ?? row.idempresa ?? "1"),
      }));
    } catch (err) {
      console.error("Error getting salespersons from cache:", err);
      return [];
    }
  }

  private async loadGoalsFromDb() {
    try {
      const rows = await pgAll<Goal>(`
        SELECT id, "companyId", "salespersonId", type, "targetValue", month, year, week
        FROM goals
      `);
      this.goals = rows;
      console.log(`Loaded ${rows.length} goals from database`);
    } catch (err) {
      console.error("Error loading goals:", err);
      this.goals = [];
    }
  }

  private async loadGoalSettingsFromDb() {
    try {
      const rows = await pgAll<GoalSetting>(`SELECT * FROM goal_settings`);
      this.goalSettings = rows;
    } catch (err) {
      console.error("Error loading goal settings:", err);
      this.goalSettings = [];
    }
  }

  async getCompanies(): Promise<Company[]> {
    return this.getCompaniesFromCache();
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const companies = await this.getCompaniesFromCache();
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
    const all = await this.getSalespersonsFromCache(companyId);
    if (!teamMembers || teamMembers.length === 0) return all;
    return all.filter(sp => teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase())));
  }

  async getSalesperson(id: string): Promise<Salesperson | undefined> {
    const all = await this.getSalespersonsFromCache();
    return all.find(s => s.id === id);
  }

  async getProducts(_companyId: string): Promise<Product[]> {
    return [];
  }

  async getKPISummary(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<KPISummary> {
    try {
      let whereCompany = "";
      if (companyId !== "all") {
        whereCompany = `AND "IDEMPRESA" = ${parseInt(companyId)}`;
      }
      const teamFilter = this.buildTeamFilter(teamMembers);

      const vendasResult = await pgGet<{ total: number }>(`
        SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
        FROM cache_vendas
        WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany} ${teamFilter}
      `, [startDate, endDate]);

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const weekStart = startOfWeek.toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      const weeklyResult = await pgGet<{ total: number }>(`
        SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
        FROM cache_vendas
        WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany} ${teamFilter}
      `, [weekStart, today]);

      const teamFilterPendentes = this.buildTeamFilter(teamMembers, `"NOME_VENDEDOR"`);
      let whereCompanyPendentes = "";
      if (companyId !== "all") {
        whereCompanyPendentes = `AND "IDEMPRESA" = ${parseInt(companyId)}`;
      }

      const aFaturarResult = await pgGet<{ total: number }>(`
        SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
        FROM cache_vendas_pendentes
        WHERE 1=1 ${whereCompanyPendentes} ${teamFilterPendentes}
      `);

      const pedidosResult = await pgGet<{ total: number }>(`
        SELECT COUNT(*) as total
        FROM cache_vendas_pendentes
        WHERE 1=1 ${whereCompanyPendentes} ${teamFilterPendentes}
      `);

      return {
        totalVendasSemanal: weeklyResult?.total ?? 0,
        totalVendasMensal: vendasResult?.total ?? 0,
        valorAFaturar: aFaturarResult?.total ?? 0,
        pedidosAtendidos: Number(pedidosResult?.total ?? 0),
      };
    } catch (err) {
      console.error("Error getting KPIs:", err);
      return { totalVendasSemanal: 0, totalVendasMensal: 0, valorAFaturar: 0, pedidosAtendidos: 0 };
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
        whereCompany = `AND "IDEMPRESA" = ${parseInt(companyId)}`;
      }
      const teamFilter = this.buildTeamFilter(teamMembers);

      const groupBy = companyId === "all"
        ? `"IDVENDEDOR", "NOME_VENDEDOR"`
        : `"IDVENDEDOR", "NOME_VENDEDOR", "IDEMPRESA"`;

      const salesRows = await pgAll<{
        id: string; name: string; companyId: string;
        totalVendas: number; totalLucro: number;
        positivacao: number; mixProdutos: number; qtdPedidos: number;
      }>(`
        SELECT
          "IDVENDEDOR" as id,
          "NOME_VENDEDOR" as name,
          MIN(CAST("IDEMPRESA" AS TEXT)) as "companyId",
          COALESCE(SUM("TOTALVENDA_LINHA"), 0) as "totalVendas",
          0::numeric as "totalLucro",
          0 as positivacao,
          COUNT(DISTINCT "IDPLANILHA") as "mixProdutos",
          COUNT(DISTINCT "IDPLANILHA") as "qtdPedidos"
        FROM cache_vendas
        WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
          AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
          ${whereCompany} ${teamFilter}
        GROUP BY ${groupBy}
        ORDER BY "totalVendas" DESC
      `, [startDate, endDate]);

      const start = new Date(startDate);
      const end = new Date(endDate);
      const yoyStart = new Date(start); yoyStart.setFullYear(yoyStart.getFullYear() - 1);
      const yoyEnd = new Date(end); yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);
      const yoyStartStr = yoyStart.toISOString().split('T')[0];
      const yoyEndStr = yoyEnd.toISOString().split('T')[0];

      const rankings: SalespersonRanking[] = await Promise.all(salesRows.map(async (row, index) => {
        let value: number;
        switch (criteria) {
          case "maior_valor_vendido": value = row.totalVendas; break;
          case "maior_positivacao": value = row.positivacao; break;
          case "maior_mix_produtos": value = row.mixProdutos; break;
          case "conexoes_sobre_tubos": value = 0; break;
          default: value = row.totalVendas;
        }

        let yoyVariacao = 0;
        try {
          const yoyResult = await pgGet<{ total: number }>(`
            SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
            FROM cache_vendas
            WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
          `, [row.id, yoyStartStr, yoyEndStr]);
          if (yoyResult && yoyResult.total > 0) {
            yoyVariacao = ((row.totalVendas - yoyResult.total) / yoyResult.total) * 100;
          }
        } catch { }

        const conexoesSobreTubos = await this.getConexoesSobreTubos(row.id, companyId, startDate, endDate);
        const ticketMedio = row.qtdPedidos > 0 ? row.totalVendas / row.qtdPedidos : 0;

        return {
          salesperson: { id: row.id, name: row.name, email: "", teamId: "t1", companyId: row.companyId },
          value: criteria === "conexoes_sobre_tubos" ? (conexoesSobreTubos || 0) : value,
          rank: index + 1,
          yoyVariacao,
          positivacao: row.positivacao,
          mixProdutos: row.mixProdutos,
          conexoesSobreTubos,
          ticketMedio,
        };
      }));

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
        whereCompany = `AND "IDEMPRESA" = ${parseInt(companyId)}`;
      }
      const teamFilter = this.buildTeamFilter(teamMembers);

      const teamFilterCamp = this.buildTeamFilter(teamMembers, `"IDVENDEDOR"`);
      const rows = await pgAll<{ category: string; totalValue: number; quantity: number }>(`
        SELECT
          COALESCE("FABRICANTE", 'Sem Fabricante') as category,
          COALESCE(SUM("VALOR_LIQUIDO"), 0) as "totalValue",
          COALESCE(SUM("QTD"), 0) as quantity
        FROM cache_campanhas
        WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ?
          AND "FABRICANTE" IS NOT NULL
          ${teamFilterCamp}
        GROUP BY "FABRICANTE"
        ORDER BY "totalValue" DESC
        LIMIT 20
      `, [startDate, endDate]);

      const totalValue = rows.reduce((sum, row) => sum + (row.totalValue || 0), 0);

      return rows.map(row => ({
        category: row.category || "Outros",
        value: row.totalValue || 0,
        percentage: totalValue > 0 ? ((row.totalValue || 0) / totalValue) * 100 : 0,
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
        whereCompany = `AND "IDEMPRESA" = ${parseInt(companyId)}`;
      }
      const teamFilter = this.buildTeamFilter(teamMembers);

      const now = new Date();
      const months: { label: string; start: string; end: string }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = d.toISOString().split('T')[0];
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        months.push({ label, start, end });
      }

      const monthlyData = await Promise.all(months.map(async (m) => {
        const result = await pgGet<{ total: number }>(`
          SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
          FROM cache_vendas
          WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany} ${teamFilter}
        `, [m.start, m.end]);

        const yoyD = new Date(m.start);
        yoyD.setFullYear(yoyD.getFullYear() - 1);
        const yoyResult = await pgGet<{ total: number }>(`
          SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
          FROM cache_vendas
          WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany} ${teamFilter}
        `, [yoyD.toISOString().split('T')[0], new Date(yoyD.getFullYear(), yoyD.getMonth() + 1, 0).toISOString().split('T')[0]]);

        const current = Number(result?.total ?? 0);
        const previous = Number(yoyResult?.total ?? 0);
        const variacao = previous > 0 ? ((current - previous) / previous) * 100 : 0;

        return { label: m.label, atual: current, anterior: previous, variacao };
      }));

      // Build weekly data: last 10 ISO weeks
      const weeks: { label: string; start: string; end: string }[] = [];
      for (let i = 9; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const day = d.getDay();
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - day);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const label = `S${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
        weeks.push({
          label,
          start: weekStart.toISOString().split('T')[0],
          end: weekEnd.toISOString().split('T')[0],
        });
      }

      const weeklyData = await Promise.all(weeks.map(async (w) => {
        const res = await pgGet<{ total: number }>(`
          SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
          FROM cache_vendas
          WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany} ${teamFilter}
        `, [w.start, w.end]);
        const yoyStart = new Date(w.start);
        yoyStart.setFullYear(yoyStart.getFullYear() - 1);
        const yoyEnd = new Date(w.end);
        yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);
        const resY = await pgGet<{ total: number }>(`
          SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
          FROM cache_vendas
          WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany} ${teamFilter}
        `, [yoyStart.toISOString().split('T')[0], yoyEnd.toISOString().split('T')[0]]);
        const atual = Number(res?.total ?? 0);
        const anterior = Number(resY?.total ?? 0);
        const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
        return { label: w.label, atual, anterior, variacao };
      }));

      return { monthly: monthlyData, weekly: weeklyData };
    } catch (err) {
      console.error("Error getting sales evolution:", err);
      return { monthly: [], weekly: [] };
    }
  }

  async getGoals(companyId: string, month: number, year: number, teamMembers?: string[]): Promise<GoalWithProgress[]> {
    const salespersons = await this.getSalespersonsFromCache(companyId === "all" ? undefined : companyId);

    const filtered = !teamMembers || teamMembers.length === 0
      ? salespersons
      : salespersons.filter(sp => teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase())));

    return Promise.all(filtered.map(async (sp) => {
      const goals = this.goals.filter(g =>
        g.salespersonId === sp.id &&
        g.month === month &&
        g.year === year &&
        (companyId === "all" || g.companyId === companyId)
      );

      const totalTarget = goals.reduce((sum, g) => sum + g.targetValue, 0);

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      let whereCompany = "";
      if (companyId !== "all") {
        whereCompany = `AND "IDEMPRESA" = ${parseInt(companyId)}`;
      }

      const progress = await pgGet<{ total: number }>(`
        SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
        FROM cache_vendas
        WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany}
      `, [sp.id, startDate, endDate]);

      const currentValue = progress?.total ?? 0;
      const progressPercent = totalTarget > 0 ? Math.min(100, Math.round((currentValue / totalTarget) * 100)) : 0;

      return {
        salesperson: sp,
        goals,
        totalTarget,
        currentValue,
        progressPercent,
      };
    }));
  }

  async createGoal(goal: Omit<Goal, "id">): Promise<Goal> {
    const id = randomUUID();
    const newGoal: Goal = { ...goal, id };

    await pgRun(`
      INSERT INTO goals (id, "companyId", "salespersonId", type, "targetValue", month, year, week)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, goal.companyId, goal.salespersonId, goal.type, goal.targetValue, goal.month, goal.year, goal.week ?? null]);

    this.goals.push(newGoal);
    return newGoal;
  }

  async updateGoal(id: string, data: Partial<Goal>): Promise<Goal> {
    const idx = this.goals.findIndex(g => g.id === id);
    if (idx === -1) throw new Error("Goal not found");

    const updated = { ...this.goals[idx], ...data };
    await pgRun(`
      UPDATE goals SET "companyId" = ?, "salespersonId" = ?, type = ?, "targetValue" = ?, month = ?, year = ?, week = ?
      WHERE id = ?
    `, [updated.companyId, updated.salespersonId, updated.type, updated.targetValue, updated.month, updated.year, updated.week ?? null, id]);

    this.goals[idx] = updated;
    return updated;
  }

  async deleteGoal(id: string): Promise<void> {
    await pgRun(`DELETE FROM goals WHERE id = ?`, [id]);
    this.goals = this.goals.filter(g => g.id !== id);
  }

  async getSalespersonGoals(salespersonId: string, month: number, year: number): Promise<GoalWithProgress[]> {
    const sp = await this.getSalesperson(salespersonId);
    if (!sp) return [];

    const goals = this.goals.filter(g =>
      g.salespersonId === salespersonId && g.month === month && g.year === year
    );

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const progress = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
      FROM cache_vendas
      WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
    `, [salespersonId, startDate, endDate]);

    const totalTarget = goals.reduce((sum, g) => sum + g.targetValue, 0);
    const currentValue = progress?.total ?? 0;
    const progressPercent = totalTarget > 0 ? Math.min(100, Math.round((currentValue / totalTarget) * 100)) : 0;

    return [{ salesperson: sp, goals, totalTarget, currentValue, progressPercent }];
  }

  async getAlertNotifications(companyId: string): Promise<AlertNotification[]> {
    try {
      let rows: any[];
      if (companyId === "all") {
        rows = await pgAll(`SELECT * FROM alert_notifications ORDER BY "triggeredAt" DESC LIMIT 50`);
      } else {
        rows = await pgAll(`SELECT * FROM alert_notifications WHERE "companyId" = ? ORDER BY "triggeredAt" DESC LIMIT 50`, [companyId]);
      }
      return rows.map(r => ({
        id: r.id,
        alertId: r.alertId,
        companyId: r.companyId,
        triggeredAt: r.triggeredAt,
        message: r.message,
        severity: r.severity as AlertNotification["severity"],
        read: r.read === 1 || r.read === true,
        data: (() => { try { return JSON.parse(r.data); } catch { return {}; } })(),
      }));
    } catch (err) {
      console.error("Error getting alert notifications:", err);
      return [];
    }
  }

  async markAlertRead(id: string): Promise<boolean> {
    try {
      const rowCount = await pgRun(`UPDATE alert_notifications SET read = 1 WHERE id = ?`, [id]);
      return rowCount > 0;
    } catch (err) {
      console.error("Error marking alert read:", err);
      return false;
    }
  }

  async dismissAlert(id: string): Promise<boolean> {
    try {
      const rowCount = await pgRun(`DELETE FROM alert_notifications WHERE id = ?`, [id]);
      return rowCount > 0;
    } catch (err) {
      console.error("Error dismissing alert:", err);
      return false;
    }
  }

  async getAlertConfigs(companyId: string): Promise<Alert[]> {
    try {
      let rows: any[];
      if (companyId === "all") {
        rows = await pgAll(`SELECT * FROM alert_configs ORDER BY id`);
      } else {
        rows = await pgAll(`SELECT * FROM alert_configs WHERE "companyId" = ? ORDER BY id`, [companyId]);
      }
      return rows.map(r => ({
        id: r.id,
        companyId: r.companyId,
        type: r.type as Alert["type"],
        threshold: r.threshold,
        enabled: r.enabled === 1 || r.enabled === true,
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
      const rowCount = await pgRun(`UPDATE alert_configs SET enabled = ? WHERE id = ?`, [enabled ? 1 : 0, id]);
      return rowCount > 0;
    } catch (err) {
      console.error("Error updating alert config:", err);
      return false;
    }
  }

  async createAlertNotification(notification: Omit<AlertNotification, "id"> & { companyId: string }): Promise<AlertNotification> {
    const id = randomUUID();
    await pgRun(`
      INSERT INTO alert_notifications (id, "alertId", "companyId", "triggeredAt", message, severity, read, data)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `, [id, notification.alertId, notification.companyId, notification.triggeredAt, notification.message, notification.severity, JSON.stringify(notification.data || {})]);
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
        stats: { totalVendas: 0, ticketMedio: 0, yoyVariacao: 0, metaProgress: 0, positivacao: 0, mixProdutos: 0, conexoesSobreTubos: 0 },
      };
    });
  }

  async getWeeklyView(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<WeeklySalesperson[]> {
    let salespersons = await this.getSalespersonsFromCache(companyId === "all" ? undefined : companyId);
    if (teamMembers && teamMembers.length > 0) {
      salespersons = salespersons.filter(sp => teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase())));
    }

    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return Promise.all(salespersons.map(async (sp) => {
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
          const result = await pgGet<{ total: number }>(`
            SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
            FROM cache_vendas
            WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" = ?
          `, [sp.id, dateStr]);

          const resultYoy = await pgGet<{ total: number }>(`
            SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
            FROM cache_vendas
            WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" = ?
          `, [sp.id, dateStrYoy]);

          dailySales.push({ day: days[dayOfWeek], value: result?.total ?? 0, yoyValue: resultYoy?.total ?? 0 });
          totalWeek += result?.total ?? 0;
          totalWeekYoy += resultYoy?.total ?? 0;
        } catch {
          dailySales.push({ day: days[dayOfWeek], value: 0, yoyValue: 0 });
        }
      }

      const yoyVariacao = totalWeekYoy > 0 ? ((totalWeek - totalWeekYoy) / totalWeekYoy) * 100 : 0;

      const weeklyGoal = this.goals.find(g =>
        g.salespersonId === sp.id &&
        g.type === "weekly" &&
        g.month === (now.getMonth() + 1) &&
        g.year === now.getFullYear()
      );

      return {
        salesperson: sp,
        dailySales,
        totalWeek,
        yoyVariacao,
        metaProgress: weeklyGoal && weeklyGoal.targetValue > 0
          ? Math.min(100, Math.round((totalWeek / weeklyGoal.targetValue) * 100))
          : 0,
      };
    }));
  }

  async getMonthlyView(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<MonthlySalesperson[]> {
    let salespersons = await this.getSalespersonsFromCache(companyId === "all" ? undefined : companyId);
    if (teamMembers && teamMembers.length > 0) {
      salespersons = salespersons.filter(sp => teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase())));
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    return Promise.all(salespersons.map(async (sp) => {
      const weeklySales = [];
      let cumulative = 0;
      let cumulativeYoy = 0;

      for (let week = 0; week < 4; week++) {
        const weekStartDay = 1 + week * 7;
        const weekEndDay = Math.min(7 + week * 7, lastDayOfMonth);
        const weekStart = new Date(year, month, weekStartDay).toISOString().split('T')[0];
        const weekEnd = new Date(year, month, weekEndDay).toISOString().split('T')[0];

        const weekStartYoy = new Date(year - 1, month, weekStartDay).toISOString().split('T')[0];
        const weekEndYoy = new Date(year - 1, month, Math.min(weekEndDay, new Date(year - 1, month + 1, 0).getDate())).toISOString().split('T')[0];

        try {
          const result = await pgGet<{ total: number }>(`
            SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
            FROM cache_vendas
            WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
          `, [sp.id, weekStart, weekEnd]);

          const resultYoy = await pgGet<{ total: number }>(`
            SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
            FROM cache_vendas
            WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
          `, [sp.id, weekStartYoy, weekEndYoy]);

          const value = result?.total ?? 0;
          const yoyValue = resultYoy?.total ?? 0;
          cumulative += value;
          cumulativeYoy += yoyValue;

          weeklySales.push({ week: `Sem ${week + 1}`, value, yoyValue, cumulative, yoyCumulative: cumulativeYoy });
        } catch {
          weeklySales.push({ week: `Sem ${week + 1}`, value: 0, yoyValue: 0, cumulative, yoyCumulative: 0 });
        }
      }

      const monthlyGoal = this.goals.find(g =>
        g.salespersonId === sp.id &&
        g.type === "monthly" &&
        g.month === (month + 1) &&
        g.year === year
      );

      let totalMonthAllCompanies = 0;
      try {
        const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
        const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];
        const result = await pgGet<{ total: number }>(`
          SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
          FROM cache_vendas
          WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
        `, [sp.id, monthStart, monthEnd]);
        totalMonthAllCompanies = result?.total ?? cumulative;
      } catch {
        totalMonthAllCompanies = cumulative;
      }

      const metaProgress = monthlyGoal && monthlyGoal.targetValue > 0
        ? Math.min(100, Math.round((totalMonthAllCompanies / monthlyGoal.targetValue) * 100))
        : 0;

      const yoyVariacao = cumulativeYoy > 0 ? ((cumulative - cumulativeYoy) / cumulativeYoy) * 100 : 0;

      return { salesperson: sp, weeklySales, totalMonth: cumulative, yoyVariacao, metaProgress };
    }));
  }

  async getAFaturarPorVendedor(companyId: string, teamMembers?: string[]): Promise<SalespersonAFaturar[]> {
    try {
      const teamFilter = this.buildTeamFilter(teamMembers, `"NOME_VENDEDOR"`);
      let whereCompany = "";
      if (companyId !== "all") {
        whereCompany = `AND "IDEMPRESA" = ${parseInt(companyId)}`;
      }

      const rows = await pgAll<{ id: string; name: string; valorAFaturar: number }>(`
        SELECT
          "NOME_VENDEDOR" as id,
          "NOME_VENDEDOR" as name,
          SUM("TOTALVENDA_LINHA") as "valorAFaturar"
        FROM cache_vendas_pendentes
        WHERE 1=1 ${whereCompany} ${teamFilter}
        GROUP BY "NOME_VENDEDOR"
        HAVING SUM("TOTALVENDA_LINHA") > 0
        ORDER BY "valorAFaturar" DESC
      `);

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
      const rows = await pgAll(`SELECT * FROM vendor_display_settings`);
      return rows.map(r => ({
        id: r.id,
        vendorId: r.vendorId,
        displayCode: r.displayCode,
        displayName: r.displayName,
        isHidden: r.isHidden === 1 || r.isHidden === true,
        companyId: r.companyId,
      }));
    } catch {
      return [];
    }
  }

  async updateVendorDisplaySetting(setting: VendorDisplaySettings): Promise<VendorDisplaySettings> {
    try {
      const existing = await pgGet(`SELECT * FROM vendor_display_settings WHERE "vendorId" = ?`, [setting.vendorId]);

      if (existing) {
        await pgRun(`
          UPDATE vendor_display_settings
          SET "displayCode" = ?, "displayName" = ?, "isHidden" = ?, "companyId" = ?
          WHERE "vendorId" = ?
        `, [setting.displayCode, setting.displayName, setting.isHidden ? 1 : 0, setting.companyId, setting.vendorId]);
      } else {
        await pgRun(`
          INSERT INTO vendor_display_settings (id, "vendorId", "displayCode", "displayName", "isHidden", "companyId")
          VALUES (?, ?, ?, ?, ?, ?)
        `, [setting.id, setting.vendorId, setting.displayCode, setting.displayName, setting.isHidden ? 1 : 0, setting.companyId]);
      }
      return setting;
    } catch (err) {
      console.error("Error updating vendor settings:", err);
      throw err;
    }
  }

  async getTVDashboardData(weekStart: string, weekEnd: string, userRole: string, teamMembers?: string[]): Promise<TVDashboardData> {
    const rawSalespersons = await this.getSalespersonsFromCache();
    let salespersons = rawSalespersons;

    if (teamMembers && teamMembers.length > 0) {
      salespersons = salespersons.filter(sp => teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase())));
    }

    const settings = await this.getVendorDisplaySettings();

    const yoyStart = new Date(weekStart); yoyStart.setFullYear(yoyStart.getFullYear() - 1);
    const yoyEnd = new Date(weekEnd); yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);
    const yoyStartStr = yoyStart.toISOString().split('T')[0];
    const yoyEndStr = yoyEnd.toISOString().split('T')[0];

    // Descobre o IDEMPRESA da loja matriz (CNPJ 05.443.069/0001-03) uma única vez
    const MATRIZ_CNPJ = '05.443.069/0001-03';
    let matrizEmpresaId: number | null = null;
    try {
      const matrizRow = await pgGet<{ id: number }>(`
        SELECT "IDEMPRESA" as id FROM cache_vendas
        WHERE "CNPJ_EMPRESA" = ? LIMIT 1
      `, [MATRIZ_CNPJ]);
      matrizEmpresaId = matrizRow?.id ?? null;
    } catch { }

    const todayStr = new Date().toISOString().split('T')[0];

    const vendorsData = (await Promise.all(salespersons.map(async (sp) => {
      const setting = settings.find(s => s.vendorId === sp.id);
      if (setting?.isHidden) return null;

      let l01Sales = 0, l03Sales = 0, lMatrizSales = 0;
      try {
        const rowL01 = await pgGet<{ total: number }>(`
          SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
          FROM cache_vendas
          WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? AND "IDEMPRESA" = 1
        `, [sp.id, weekStart, weekEnd]);
        l01Sales = rowL01?.total ?? 0;

        const rowL03 = await pgGet<{ total: number }>(`
          SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
          FROM cache_vendas
          WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? AND "IDEMPRESA" = 3
        `, [sp.id, weekStart, weekEnd]);
        l03Sales = rowL03?.total ?? 0;

        if (matrizEmpresaId !== null) {
          const rowMatriz = await pgGet<{ total: number }>(`
            SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
            FROM cache_vendas
            WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" = ? AND "IDEMPRESA" = ?
          `, [sp.id, todayStr, matrizEmpresaId]);
          lMatrizSales = rowMatriz?.total ?? 0;
        }
      } catch (e) { }

      const totalSales = l01Sales + l03Sales;

      let yoyValue = 0;
      try {
        const rowYoy = await pgGet<{ total: number }>(`
          SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
          FROM cache_vendas
          WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
        `, [sp.id, yoyStartStr, yoyEndStr]);
        yoyValue = rowYoy?.total ?? 0;
      } catch { }

      const yoyPercentage = yoyValue > 0 ? ((totalSales - yoyValue) / yoyValue) * 100 : 0;

      const goals = await pgAll<Goal>(`
        SELECT * FROM goals
        WHERE "salespersonId" = ? AND type = 'weekly' AND month = ? AND year = ?
      `, [sp.id, (new Date(weekEnd)).getMonth() + 1, (new Date(weekEnd)).getFullYear()]);

      let goalValue = 0, goalL01 = 0, goalL03 = 0, goalLMatriz = 0;
      const isSingle = userRole === 'supervisor';

      if (userRole === 'supervisor') {
        goalValue = goals.reduce((sum, g) => sum + g.targetValue, 0);
      } else {
        const g01 = goals.find(g => g.companyId === '1');
        const g03 = goals.find(g => g.companyId === '3');
        const gMatriz = matrizEmpresaId !== null ? goals.find(g => g.companyId === String(matrizEmpresaId)) : undefined;
        goalL01 = g01?.targetValue ?? 0;
        goalL03 = g03?.targetValue ?? 0;
        // Meta diária da matriz: meta semanal / 6 dias úteis
        goalLMatriz = gMatriz ? Math.round(gMatriz.targetValue / 6) : Math.round(goalValue / 12);
        goalValue = goalL01 + goalL03;
      }

      const achievement = goalValue > 0 ? (totalSales / goalValue) * 100 : 0;

      return {
        id: sp.id,
        displayCode: setting?.displayCode || sp.id.slice(0, 4),
        displayName: setting?.displayName || sp.name.split(' ')[0],
        sales: { loja01: l01Sales, loja03: l03Sales, lojaMatriz: lMatrizSales, total: totalSales },
        goal: { value: goalValue, isSingle, loja01: goalL01, loja03: goalL03, lojaMatriz: goalLMatriz },
        yoy: { value: yoyValue, percentage: yoyPercentage },
        achievement,
      };
    }))).filter(v => v !== null);

    vendorsData.sort((a, b) => b!.sales.total - a!.sales.total);

    return {
      meta: { weekStart, weekEnd, lastSync: new Date().toISOString() },
      vendors: vendorsData as any,
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
        await pgRun(`UPDATE goal_settings SET mode = ? WHERE id = ?`, [setting.mode, existing.id]);
        Object.assign(existing, { mode: setting.mode });
        return existing;
      } else {
        const id = randomUUID();
        const newSetting = { ...setting, id };
        await pgRun(`
          INSERT INTO goal_settings (id, "salespersonId", type, mode, month, year)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [id, newSetting.salespersonId, newSetting.type, newSetting.mode, newSetting.month, newSetting.year]);
        this.goalSettings.push(newSetting);
        return newSetting;
      }
    } catch (err) {
      console.error("Error saving goal setting:", err);
      throw err;
    }
  }

  async getVendedorIdByEmail(email: string): Promise<string> {
    try {
      if (/^\d+$/.test(email.trim())) return email.trim();

      const user = await pgGet<{ first_name: string }>(
        "SELECT first_name FROM users WHERE LOWER(email) = LOWER(?)",
        [email]
      );
      if (!user || !user.first_name) return email;

      const numericUser = await pgGet<{ email: string }>(
        "SELECT email FROM users WHERE UPPER(first_name) = UPPER(?) AND email ~ '^[0-9]' LIMIT 1",
        [user.first_name]
      );
      if (numericUser?.email) return numericUser.email;

      const row = await pgGet<{ IDVENDEDOR: string }>(`
        SELECT CAST("IDVENDEDOR" AS TEXT) as "IDVENDEDOR"
        FROM cache_vendas
        WHERE UPPER("NOME_VENDEDOR") = UPPER(?)
           OR UPPER("NOME_VENDEDOR") LIKE UPPER(?)
        LIMIT 1
      `, [user.first_name, `${user.first_name}%`]);

      return row?.IDVENDEDOR ? String(row.IDVENDEDOR) : email;
    } catch {
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

    const fatLoja1 = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
      FROM cache_vendas
      WHERE "IDEMPRESA" = 1 AND "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
    `, [vendedorId, inicio, fim]);

    const fatLoja3 = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
      FROM cache_vendas
      WHERE "IDEMPRESA" = 3 AND "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
    `, [vendedorId, inicio, fim]);

    const getGoal = async (companyId: string) => {
      const row = await pgGet<{ totalGoal: number | null }>(`
        SELECT SUM("targetValue") as "totalGoal"
        FROM goals
        WHERE "salespersonId" = ? AND "companyId" = ? AND type = 'weekly' AND month = ? AND year = ?
      `, [vendedorId, companyId, now.getMonth() + 1, now.getFullYear()]);
      return row?.totalGoal || 0;
    };

    const calc = (atual: number, meta: number) => {
      const percentual = meta > 0 ? (atual / meta) * 100 : 0;
      const faltante = meta > atual ? meta - atual : 0;
      return { valor_atual: atual, meta, percentual: parseFloat(percentual.toFixed(2)), faltante };
    };

    const loja1 = calc(fatLoja1?.total || 0, await getGoal('1'));
    const loja3 = calc(fatLoja3?.total || 0, await getGoal('3'));
    const total_atual = (fatLoja1?.total || 0) + (fatLoja3?.total || 0);
    const faturamento_geral = calc(total_atual, await getGoal('all'));

    const mixResult = await pgGet<{ conexoes: number; tubos: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Conexao' THEN "VALOR_LIQUIDO" ELSE 0 END), 0) as conexoes,
        COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Tubo' THEN "VALOR_LIQUIDO" ELSE 0 END), 0) as tubos
      FROM cache_tubos_conexoes
      WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
    `, [vendedorId, inicio, fim]);

    const valor_conexoes = mixResult?.conexoes || 0;
    const valor_tubos = mixResult?.tubos || 0;
    const percentual_conexoes = valor_tubos > 0 ? (valor_conexoes / valor_tubos) * 100 : 0;

    return {
      last_update: now.toISOString(),
      periodo: { tipo: 'semana', inicio, fim, dias_restantes: dias_restantes > 0 ? dias_restantes : 0 },
      loja1,
      loja3,
      faturamento: faturamento_geral,
      mix_geral: {
        percentual_conexoes: parseFloat(percentual_conexoes.toFixed(2)),
        valor_conexoes,
        valor_tubos,
      },
    };
  }

  async getMetasAmancoDTR(vendedorId: string, targetYear?: number, targetQuarter?: number): Promise<any> {
    const now = new Date();
    const year = targetYear ?? now.getFullYear();
    const quarter = targetQuarter ?? Math.floor(now.getMonth() / 3);
    const quarterStartMonth = quarter * 3;
    const quarterEndMonth = quarterStartMonth + 2;

    const inicioStr = new Date(year, quarterStartMonth, 1).toISOString().split('T')[0];
    const fimStr = new Date(year, quarterEndMonth + 1, 0).toISOString().split('T')[0];

    const resultAtual = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "IDVENDEDOR" = ? AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND "FABRICANTE" = 'AMANCO'
    `, [vendedorId, inicioStr, fimStr]);

    const valor_atual = resultAtual?.total || 0;

    const resultMix = await pgGet<{ tubos: number; conexoes: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN "TipoProduto" = 'Tubo' THEN "VALOR_LIQUIDO" ELSE 0 END), 0) as tubos,
        COALESCE(SUM(CASE WHEN "TipoProduto" = 'Conexão' THEN "VALOR_LIQUIDO" ELSE 0 END), 0) as conexoes
      FROM cache_amanco_mix
      WHERE "IDVENDEDOR" = ? AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ?
    `, [vendedorId, inicioStr, fimStr]);

    const tubos = resultMix?.tubos || 0;
    const conexoes = resultMix?.conexoes || 0;
    const percentual_conexoes = tubos > 0 ? (conexoes / tubos) * 100 : 0;

    const lastYear = year - 1;
    const inicioLyStr = new Date(lastYear, quarterStartMonth, 1).toISOString().split('T')[0];
    const fimLyStr = new Date(lastYear, quarterEndMonth + 1, 0).toISOString().split('T')[0];

    const resultLy = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "IDVENDEDOR" = ? AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND "FABRICANTE" = 'AMANCO'
    `, [vendedorId, inicioLyStr, fimLyStr]);

    const valor_ano_anterior = resultLy?.total || 0;

    const triggerQuery = await pgGet<{ triggerValue: number }>(`
      SELECT "triggerValue" FROM campaign_goals
      WHERE "salespersonId" = ? AND "campaignName" = 'dtr_amanco' AND year = ?
    `, [vendedorId, year]);

    const gatilho_individual = triggerQuery?.triggerValue || 0;
    const crescimento_percentual = valor_ano_anterior > 0 ? ((valor_atual - valor_ano_anterior) / valor_ano_anterior) * 100 : (valor_atual > 0 ? 100 : 0);

    const resultLoja = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND "FABRICANTE" = 'AMANCO'
    `, [inicioStr, fimStr]);
    const loja_valor_atual = resultLoja?.total || 0;

    const resultLojaLy = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND "FABRICANTE" = 'AMANCO'
    `, [inicioLyStr, fimLyStr]);
    const loja_valor_ano_anterior = resultLojaLy?.total || 0;
    const loja_crescimento_percentual = loja_valor_ano_anterior > 0 ? ((loja_valor_atual - loja_valor_ano_anterior) / loja_valor_ano_anterior) * 100 : (loja_valor_atual > 0 ? 100 : 0);

    const meta_gatilho = 120000;
    const meta_mix = 40.0;
    const meta_loja = 25.0;

    const gatilho = valor_atual >= (gatilho_individual > 0 ? gatilho_individual : meta_gatilho);
    const percentual_conexoes_arredondado = parseFloat(percentual_conexoes.toFixed(2));
    const mix = percentual_conexoes_arredondado >= meta_mix;
    const crescimento_loja = loja_crescimento_percentual >= meta_loja;

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
        percentual: parseFloat(((gatilho_individual > 0 ? gatilho_individual : meta_gatilho) > 0 ? (valor_atual / (gatilho_individual > 0 ? gatilho_individual : meta_gatilho)) * 100 : 0).toFixed(2)),
        faltante: gatilho ? 0 : (gatilho_individual > 0 ? gatilho_individual : meta_gatilho) - valor_atual,
        gatilho_atingido: gatilho,
      },
      crescimento_vendedor: { valor_atual, valor_ano_anterior, crescimento_percentual: parseFloat(crescimento_percentual.toFixed(2)) },
      mix_amanco: { tubos, conexoes, percentual_conexoes: parseFloat(percentual_conexoes.toFixed(2)), meta_percentual: meta_mix, status_ok: mix },
      crescimento_loja: { loja_valor_atual, loja_valor_ano_anterior, crescimento_percentual: parseFloat(loja_crescimento_percentual.toFixed(2)), meta_percentual: meta_loja, status_ok: crescimento_loja },
      elegibilidade: { gatilho, mix, crescimento_loja, participando: gatilho && mix && crescimento_loja, motivos },
    };
  }

  async getMetasAmancoTV(vendedorId: string): Promise<any> {
    const now = new Date();
    const year = 2026;
    const inicioStr = `${year}-02-15`;
    const fimStr = `${year}-04-15`;
    const isEncerrado = now > new Date(`${fimStr}T23:59:59`);

    const resultAtual = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "IDVENDEDOR" = ? AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND "FABRICANTE" = 'AMANCO'
    `, [vendedorId, inicioStr, fimStr]);

    const valor_atual = resultAtual?.total || 0;

    const resultMix = await pgGet<{ tubos: number; conexoes: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN "TipoProduto" = 'Tubo' THEN "VALOR_LIQUIDO" ELSE 0 END), 0) as tubos,
        COALESCE(SUM(CASE WHEN "TipoProduto" = 'Conexão' THEN "VALOR_LIQUIDO" ELSE 0 END), 0) as conexoes
      FROM cache_amanco_mix
      WHERE "IDVENDEDOR" = ? AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ?
    `, [vendedorId, inicioStr, fimStr]);

    const tubos = resultMix?.tubos || 0;
    const conexoes = resultMix?.conexoes || 0;
    const percentual_conexoes = tubos > 0 ? (conexoes / tubos) * 100 : 0;

    const lastYear = year - 1;
    const inicioLyStr = `${lastYear}-02-15`;
    const fimLyStr = `${lastYear}-04-15`;

    const resultLy = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "IDVENDEDOR" = ? AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND "FABRICANTE" = 'AMANCO'
    `, [vendedorId, inicioLyStr, fimLyStr]);

    const valor_ano_anterior = resultLy?.total || 0;

    const triggerQuery = await pgGet<{ triggerValue: number }>(`
      SELECT "triggerValue" FROM campaign_goals
      WHERE "salespersonId" = ? AND "campaignName" = 'tv_amanco' AND year = ?
    `, [vendedorId, year]);

    const gatilho_individual = triggerQuery?.triggerValue || 0;
    const crescimento_percentual = valor_ano_anterior > 0 ? ((valor_atual - valor_ano_anterior) / valor_ano_anterior) * 100 : (valor_atual > 0 ? 100 : 0);

    const resultLoja = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND "FABRICANTE" = 'AMANCO'
    `, [inicioStr, fimStr]);
    const loja_valor_atual = resultLoja?.total || 0;

    const resultLojaLy = await pgGet<{ total: number }>(`
      SELECT COALESCE(SUM("VALOR_LIQUIDO"), 0) as total
      FROM cache_campanhas
      WHERE "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND "FABRICANTE" = 'AMANCO'
    `, [inicioLyStr, fimLyStr]);
    const loja_valor_ano_anterior = resultLojaLy?.total || 0;
    const loja_crescimento_percentual = loja_valor_ano_anterior > 0 ? ((loja_valor_atual - loja_valor_ano_anterior) / loja_valor_ano_anterior) * 100 : (loja_valor_atual > 0 ? 100 : 0);

    const meta_gatilho = 60000;
    const meta_mix = 45.0;
    const meta_crescimento_vendedor = 20.0;
    const meta_loja = 25.0;

    const gatilho = valor_atual >= (gatilho_individual > 0 ? gatilho_individual : meta_gatilho);
    const crescimento_vendedor_ok = crescimento_percentual >= meta_crescimento_vendedor;
    const percentual_conexoes_arredondado = parseFloat(percentual_conexoes.toFixed(2));
    const mix = percentual_conexoes_arredondado >= meta_mix;
    const crescimento_loja_ok = loja_crescimento_percentual >= meta_loja;

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
        percentual: parseFloat(((gatilho_individual > 0 ? gatilho_individual : meta_gatilho) > 0 ? (valor_atual / (gatilho_individual > 0 ? gatilho_individual : meta_gatilho)) * 100 : 0).toFixed(2)),
        faltante: gatilho ? 0 : (gatilho_individual > 0 ? gatilho_individual : meta_gatilho) - valor_atual,
        gatilho_atingido: gatilho,
      },
      crescimento_vendedor: { valor_atual, valor_ano_anterior, crescimento_percentual: parseFloat(crescimento_percentual.toFixed(2)), meta_percentual: meta_crescimento_vendedor, status_ok: crescimento_vendedor_ok },
      mix_amanco: { tubos, conexoes, percentual_conexoes: parseFloat(percentual_conexoes.toFixed(2)), meta_percentual: meta_mix, status_ok: mix },
      crescimento_loja: { loja_valor_atual, loja_valor_ano_anterior, crescimento_percentual: parseFloat(loja_crescimento_percentual.toFixed(2)), meta_percentual: meta_loja, status_ok: crescimento_loja_ok },
      elegibilidade: { gatilho, crescimento_vendedor: crescimento_vendedor_ok, mix, crescimento_loja: crescimento_loja_ok, participando: gatilho && crescimento_vendedor_ok && mix && crescimento_loja_ok, motivos },
    };
  }

  async getMetasElit(vendedorId: string): Promise<any> {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    let daysSinceSaturday: number;

    if (currentDayOfWeek === 6) { daysSinceSaturday = 7; }
    else if (currentDayOfWeek === 0) { daysSinceSaturday = 8; }
    else { daysSinceSaturday = currentDayOfWeek + 1; }

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysSinceSaturday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const payoutDate = new Date(endOfWeek);
    payoutDate.setDate(endOfWeek.getDate() + 1);

    const formatLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const inicioStr = formatLocal(startOfWeek);
    const fimStr = formatLocal(endOfWeek);
    const pagStr = formatLocal(payoutDate);

    const result = await pgAll<{ total: number; DESCRICAOPRODUTO: string; qty: number }>(`
      SELECT
        COALESCE(SUM("VALOR_LIQUIDO"), 0) as total,
        "IDPRODUTO" as "DESCRICAOPRODUTO",
        SUM("QTD") as qty
      FROM cache_campanhas
      WHERE "IDVENDEDOR" = ? AND "DTMOVIMENTO" >= ? AND "DTMOVIMENTO" <= ? AND ("FABRICANTE" IS NULL OR "FABRICANTE" <> 'AMANCO')
      GROUP BY "IDPRODUTO"
    `, [vendedorId, inicioStr, fimStr]);

    const valor_vendido = result.reduce((acc, curr) => acc + curr.total, 0);

    const goalsRows = await pgAll<{ triggerValue: number }>(`
      SELECT "triggerValue" FROM campaign_goals WHERE "salespersonId" = ? AND "campaignName" = 'elit' AND year = ?
    `, [vendedorId, now.getFullYear()]);
    const gatilho_minimo = goalsRows.length > 0 ? goalsRows[0].triggerValue : 3000.0;

    const participando = valor_vendido >= gatilho_minimo;
    const faltante = participando ? 0 : gatilho_minimo - valor_vendido;

    let total_receber = 0;
    const detalhes = [];

    const commissionMap: Record<string, number> = {
      "BORRACHA LIQ. SEMIACET. 21,5KG": 10.0, "TINTA EMBORR. 18KG": 7.0,
      "IMPERMEABILIZANTE 18KG": 5.0, "IMPERMEABILIZANTE GL": 5.0,
      "TINTA DIRETO GESSO 18L": 5.0, "TINTA DIRETO GESSO GL": 5.0,
      "TEXTURA RUSTIC. 23KG": 3.0, "MASSA ACRILICA": 2.0,
      "TEXTURA LISA 23KG": 2.0, "TINTA ESM. (BASE AGUA) 3,6L": 3.0,
      "TINTA ESM. 3,6L": 2.0, "TINTA ESM. 900ML": 0.50,
      "TINTA PISO 18L": 3.0, "TINTA PISO 15L": 3.0, "TINTA PISO 3,6L": 2.0,
      "TINTA SUPER REND. 20L": 4.0, "TINTA SUPER REND. 18L": 3.0,
      "TINTA SUPER COMPL 18L": 3.0, "TINTA SUPER REND. 15L": 2.0,
      "TINTA SUPER REND. SEMIBRILHO 15L": 2.0, "TINTA SUPER REND. 3,6L": 1.50,
      "TINTA SUPER COMPL 3,6L": 2.0, "TINTA VINIL ACR. 18L": 3.0,
      "TINTA VINIL ACR. 15L": 2.0, "TINTA VINIL ACR. 3,6L": 0.50,
      "VERNIZ COPAL 3,6L": 2.0, "VERNIZ MARITIMO 3,6L": 2.0, "ZARCAO 3,6L": 2.0,
      "VERNIZ COPAL 900ML": 0.50, "VERNIZ MARITIMO 900ML": 0.50, "ZARCAO 900ML": 0.50,
      "HIPERFLOOR DEMAR. VIARIA BASE SOLV. 18L": 3.0,
      "TINTA CLAS. 18L": 3.0, "TINTA CLAS. 3,6L": 2.0,
      "TINTA PROFIS. 18L": 2.0, "TINTA ACRI. MAX PROF. 18L": 2.0,
      "TINTA SUBLIME 18L": 2.0, "TINTA ACRI. MAX PROF. 3,6L": 1.0,
      "TINTA PROFIS. 3,6L": 1.0, "SELADOR ESM. (BASE AGUA) GL": 2.0,
    };

    const isExcluded = (desc: string): boolean =>
      desc.includes("FUNDO PREPARADOR") || desc.includes("REJUNTE") || desc.includes("RESINA") ||
      desc.includes("SELADOR") || desc.includes("THINNER") || desc.includes("112,5ML");

    const getElitCommission = (desc: string): number => {
      const d = desc.toUpperCase();
      if (isExcluded(d) && !d.includes("SELADOR ESM. (BASE AGUA) GL")) return 0;
      if (d.includes("TINTA SUPER REND. 3,6L")) {
        if (d.includes("SEMIBRILHO")) return 2.0;
        return commissionMap["TINTA SUPER REND. 3,6L"] || 1.50;
      }
      for (const [key, val] of Object.entries(commissionMap)) {
        if (d.includes(key)) return val;
      }
      return 0;
    };

    for (const item of result) {
      if (!item.DESCRICAOPRODUTO) continue;
      const commission = getElitCommission(item.DESCRICAOPRODUTO);
      if (commission > 0 && item.qty > 0) {
        const premio = commission * (item.qty || 0);
        total_receber += premio;
        detalhes.push({
          produto: item.DESCRICAOPRODUTO,
          qty: item.qty,
          comissao_unit: commission,
          premio,
        });
      }
    }

    total_receber = participando ? total_receber : 0;

    return {
      last_update: now.toISOString(),
      periodo: { inicio: inicioStr, fim: fimStr, pagamento: pagStr },
      elegibilidade: { participando, valor_vendido, gatilho_minimo, faltante },
      premiacao: { total_receber, detalhes },
    };
  }

  async getCampaignGoals(campaignName: string, year: number): Promise<{ salespersonId: string; triggerValue: number }[]> {
    try {
      const rows = await pgAll<{ salespersonId: string; triggerValue: number }>(`
        SELECT "salespersonId", "triggerValue"
        FROM campaign_goals
        WHERE "campaignName" = ? AND year = ?
      `, [campaignName, year]);
      return rows;
    } catch {
      return [];
    }
  }

  async saveCampaignGoals(campaignName: string, year: number, goals: { salespersonId: string; triggerValue: number }[]): Promise<void> {
    for (const g of goals) {
      const existing = await pgGet(`
        SELECT id FROM campaign_goals WHERE "salespersonId" = ? AND "campaignName" = ? AND year = ?
      `, [g.salespersonId, campaignName, year]);

      if (existing) {
        await pgRun(`
          UPDATE campaign_goals SET "triggerValue" = ? WHERE "salespersonId" = ? AND "campaignName" = ? AND year = ?
        `, [g.triggerValue, g.salespersonId, campaignName, year]);
      } else {
        await pgRun(`
          INSERT INTO campaign_goals (id, "salespersonId", "campaignName", year, "triggerValue")
          VALUES (?, ?, ?, ?, ?)
        `, [randomUUID(), g.salespersonId, campaignName, year, g.triggerValue]);
      }
    }
  }

  async getVendorGroups(): Promise<{ id: string; name: string; members: string[] }[]> {
    try {
      const groups = await pgAll<{ id: string; name: string }>(`SELECT * FROM vendor_groups ORDER BY name`);
      return Promise.all(groups.map(async (g) => {
        const members = await pgAll<{ salesperson_id: string }>(`
          SELECT salesperson_id FROM vendor_group_members WHERE group_id = ?
        `, [g.id]);
        return { id: g.id, name: g.name, members: members.map(m => m.salesperson_id) };
      }));
    } catch {
      return [];
    }
  }

  async saveVendorGroup(id: string, name: string, members: string[]): Promise<void> {
    const existing = await pgGet(`SELECT id FROM vendor_groups WHERE id = ?`, [id]);
    if (existing) {
      await pgRun(`UPDATE vendor_groups SET name = ? WHERE id = ?`, [name, id]);
    } else {
      await pgRun(`INSERT INTO vendor_groups (id, name) VALUES (?, ?)`, [id, name]);
    }
    await pgRun(`DELETE FROM vendor_group_members WHERE group_id = ?`, [id]);
    for (const m of members) {
      await pgRun(`INSERT INTO vendor_group_members (group_id, salesperson_id) VALUES (?, ?)`, [id, m]);
    }
  }

  async deleteVendorGroup(id: string): Promise<void> {
    await pgRun(`DELETE FROM vendor_group_members WHERE group_id = ?`, [id]);
    await pgRun(`DELETE FROM vendor_groups WHERE id = ?`, [id]);
  }

  async getCampaignReport(campaignName: string): Promise<any[]> {
    try {
      const rows = await pgAll(`
        SELECT * FROM campaign_result_details
        WHERE campaign_id IN (SELECT id FROM campaigns WHERE name = ?)
        ORDER BY posicao ASC
      `, [campaignName]);
      return rows;
    } catch {
      return [];
    }
  }

  async getMovimentacoesPorVendedor(vendedorId: string, startDate: string, endDate: string): Promise<any[]> {
    try {
      const rows = await pgAll(`
        SELECT
          "DT_MOVIMENTO" as data,
          NULL::text as clienteId,
          NULL::text as clienteNome,
          "IDPLANILHA" as pedidoId,
          NULL::text as produtoId,
          NULL::text as produtoCategoria,
          NULL::text as produtoNome,
          NULL::numeric as quantidade,
          "TOTALVENDA_LINHA" as valorTotal,
          CAST("IDEMPRESA" AS TEXT) as empresa
        FROM cache_vendas
        WHERE "IDVENDEDOR" = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
        ORDER BY "DT_MOVIMENTO" DESC, "IDPLANILHA"
      `, [vendedorId, startDate, endDate]);
      return rows;
    } catch (err) {
      console.error("Error getting movimentacoes:", err);
      return [];
    }
  }

  async getAppSetting(key: string): Promise<string | null> {
    try {
      const row = await pgGet<{ value: string }>(`SELECT value FROM app_settings WHERE key = ?`, [key]);
      return row?.value ?? null;
    } catch {
      return null;
    }
  }

  async setAppSetting(key: string, value: string): Promise<void> {
    await pgRun(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [key, value]);
  }
}

let _storage: PostgresStorage | null = null;

export async function getStorage(): Promise<PostgresStorage> {
  if (!_storage) {
    _storage = await PostgresStorage.create();
  }
  return _storage;
}

export const storage = {
  getCompanies: () => getStorage().then(s => s.getCompanies()),
  getCompany: (id: string) => getStorage().then(s => s.getCompany(id)),
  getTeams: (cid: string) => getStorage().then(s => s.getTeams(cid)),
  getTeam: (id: string) => getStorage().then(s => s.getTeam(id)),
  getSalespersons: (cid: string, tm?: string[]) => getStorage().then(s => s.getSalespersons(cid, tm)),
  getSalesperson: (id: string) => getStorage().then(s => s.getSalesperson(id)),
  getProducts: (cid: string) => getStorage().then(s => s.getProducts(cid)),
  getKPISummary: (cid: string, sd: string, ed: string, tm?: string[]) => getStorage().then(s => s.getKPISummary(cid, sd, ed, tm)),
  getRankings: (cid: string, sd: string, ed: string, cr: RankingCriteria, tm?: string[]) => getStorage().then(s => s.getRankings(cid, sd, ed, cr, tm)),
  getProductMix: (cid: string, sd: string, ed: string, tm?: string[]) => getStorage().then(s => s.getProductMix(cid, sd, ed, tm)),
  getSalesEvolution: (cid: string, tm?: string[]) => getStorage().then(s => s.getSalesEvolution(cid, tm)),
  getGoals: (cid: string, m: number, y: number, tm?: string[]) => getStorage().then(s => s.getGoals(cid, m, y, tm)),
  createGoal: (g: Omit<Goal, "id">) => getStorage().then(s => s.createGoal(g)),
  updateGoal: (id: string, d: Partial<Goal>) => getStorage().then(s => s.updateGoal(id, d)),
  deleteGoal: (id: string) => getStorage().then(s => s.deleteGoal(id)),
  getSalespersonGoals: (spid: string, m: number, y: number) => getStorage().then(s => s.getSalespersonGoals(spid, m, y)),
  getAlertNotifications: (cid: string) => getStorage().then(s => s.getAlertNotifications(cid)),
  markAlertRead: (id: string) => getStorage().then(s => s.markAlertRead(id)),
  dismissAlert: (id: string) => getStorage().then(s => s.dismissAlert(id)),
  getAlertConfigs: (cid: string) => getStorage().then(s => s.getAlertConfigs(cid)),
  updateAlertConfig: (id: string, en: boolean) => getStorage().then(s => s.updateAlertConfig(id, en)),
  createAlertNotification: (n: any) => getStorage().then(s => s.createAlertNotification(n)),
  getSalespersonsWithStats: (cid: string, sd: string, ed: string, tm?: string[]) => getStorage().then(s => s.getSalespersonsWithStats(cid, sd, ed, tm)),
  getWeeklyView: (cid: string, sd: string, ed: string, tm?: string[]) => getStorage().then(s => s.getWeeklyView(cid, sd, ed, tm)),
  getMonthlyView: (cid: string, sd: string, ed: string, tm?: string[]) => getStorage().then(s => s.getMonthlyView(cid, sd, ed, tm)),
  getAFaturarPorVendedor: (cid: string, tm?: string[]) => getStorage().then(s => s.getAFaturarPorVendedor(cid, tm)),
  getVendorDisplaySettings: () => getStorage().then(s => s.getVendorDisplaySettings()),
  updateVendorDisplaySetting: (set: VendorDisplaySettings) => getStorage().then(s => s.updateVendorDisplaySetting(set)),
  getTVDashboardData: (ws: string, we: string, ur: string, tm?: string[]) => getStorage().then(s => s.getTVDashboardData(ws, we, ur, tm)),
  getGoalSettings: (spid: string, m: number, y: number) => getStorage().then(s => s.getGoalSettings(spid, m, y)),
  saveGoalSettings: (set: GoalSetting) => getStorage().then(s => s.saveGoalSettings(set)),
  getSalespersonGoalsRaw: (m: number, y: number) => getStorage().then(s => s.getSalespersonGoalsRaw(m, y)),
  getVendedorIdByEmail: (email: string) => getStorage().then(s => s.getVendedorIdByEmail(email)),
  getMetasAcompanhamento: (vid: string, p?: any) => getStorage().then(s => s.getMetasAcompanhamento(vid, p)),
  getMetasAmancoDTR: (vid: string, ty?: number, tq?: number) => getStorage().then(s => s.getMetasAmancoDTR(vid, ty, tq)),
  getMetasAmancoTV: (vid: string) => getStorage().then(s => s.getMetasAmancoTV(vid)),
  getMetasElit: (vid: string) => getStorage().then(s => s.getMetasElit(vid)),
  getCampaignGoals: (cn: string, y: number) => getStorage().then(s => s.getCampaignGoals(cn, y)),
  saveCampaignGoals: (cn: string, y: number, g: any[]) => getStorage().then(s => s.saveCampaignGoals(cn, y, g)),
  getVendorGroups: () => getStorage().then(s => s.getVendorGroups()),
  saveVendorGroup: (id: string, n: string, m: string[]) => getStorage().then(s => s.saveVendorGroup(id, n, m)),
  deleteVendorGroup: (id: string) => getStorage().then(s => s.deleteVendorGroup(id)),
  getCampaignReport: (cn: string) => getStorage().then(s => s.getCampaignReport(cn)),
  getMovimentacoesPorVendedor: (vid: string, sd: string, ed: string) => getStorage().then(s => s.getMovimentacoesPorVendedor(vid, sd, ed)),
  getAppSetting: (key: string) => getStorage().then(s => s.getAppSetting(key)),
  setAppSetting: (key: string, val: string) => getStorage().then(s => s.setAppSetting(key, val)),
};
