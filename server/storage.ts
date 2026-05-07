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

  getSalespersons(companyId: string, teamMembers?: string[], showHidden?: boolean): Promise<Salesperson[]>;
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

  getSalespersonsWithStats(companyId: string, startDate: string, endDate: string, teamMembers?: string[], showHidden?: boolean): Promise<SalespersonWithStats[]>;

  getWeeklyView(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<WeeklySalesperson[]>;
  getMonthlyView(companyId: string, startDate: string, endDate: string, teamMembers?: string[]): Promise<MonthlySalesperson[]>;
  getAFaturarPorVendedor(companyId: string, teamMembers?: string[]): Promise<SalespersonAFaturar[]>;

  getVendorDisplaySettings(): Promise<VendorDisplaySettings[]>;
  updateVendorDisplaySetting(setting: VendorDisplaySettings): Promise<VendorDisplaySettings>;
  getVendorsTVSettings(): Promise<Array<{ vendorId: string; displayName: string; displayCode: string; showOnTv: boolean }>>;
  setVendorTVVisible(vendorId: string, showOnTv: boolean): Promise<void>;
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

import { CompanyRepository, TeamRepository, SettingsRepository, CampaignRepository } from "./repositories";

export class PostgresStorage implements IStorage {
  private companyRepo = new CompanyRepository();
  private teamRepo = new TeamRepository();
  private settingsRepo = new SettingsRepository();
  private campaignRepo = new CampaignRepository();

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

  private normalizeVendorId(value: unknown): string {
    return String(value ?? "").trim();
  }

  private normalizeVendorName(value: unknown): string {
    return String(value ?? "").trim();
  }

  private matchesTeamMember(salesperson: { id: string; name: string }, teamMembers?: string[]): boolean {
    if (!teamMembers || teamMembers.length === 0) return true;

    const salespersonId = this.normalizeVendorId(salesperson.id);
    const salespersonName = this.normalizeVendorName(salesperson.name).toUpperCase();

    return teamMembers.some(member => {
      const normalizedMember = this.normalizeVendorId(member);
      if (!normalizedMember) return false;
      if (normalizedMember === salespersonId) return true;
      return salespersonName.includes(normalizedMember.toUpperCase());
    });
  }

  private buildTeamFilter(
    teamMembers?: string[],
    nameColumn: string = `"NOME_VENDEDOR"`,
    idColumn: string = `"IDVENDEDOR"`,
  ): string {
    const filters: string[] = [];
    const hasNameColumn = nameColumn.trim().length > 0;
    const hasIdColumn = idColumn.trim().length > 0;

    if (hasNameColumn) {
      filters.push(`UPPER(${nameColumn}) NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%'`);
    }

    const validMembers = (teamMembers ?? []).map(member => this.normalizeVendorId(member)).filter(Boolean);
    if (validMembers.length > 0) {
      const conditions = validMembers.map(member => {
        const safeId = member.replace(/\\/g, "\\\\").replace(/'/g, "''");
        const clauses = hasIdColumn ? [`TRIM(CAST(${idColumn} AS TEXT)) = '${safeId}'`] : [];

        if (hasNameColumn) {
          const safeName = member.replace(/\\/g, "\\\\").replace(/'/g, "''").toUpperCase();
          clauses.push(`UPPER(${nameColumn}) LIKE '%${safeName}%'`);
        }

        if (clauses.length === 0) return "FALSE";
        return `(${clauses.join(" OR ")})`;
      }).join(" OR ");

      filters.push(`(${conditions})`);
    }

    return filters.length > 0 ? ` AND ${filters.join(" AND ")}` : "";
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
          COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Conexao' THEN "TOTALVENDA_LINHA" ELSE 0 END), 0) as conexoes,
          COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Tubo' THEN "TOTALVENDA_LINHA" ELSE 0 END), 0) as tubos
        FROM cache_tubos_conexoes
        WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? ${whereCompany} ${wherePeriod}
      `, [this.normalizeVendorId(vendedorId)]);

      const tubosNum = Number(result?.tubos || 0);
      const conexoesNum = Number(result?.conexoes || 0);

      if (!result || tubosNum === 0) return null;
      return (conexoesNum / tubosNum) * 100;
    } catch (e) {
      return null;
    }
  }

  // Company name/CNPJ lookup — update via Configurações or this mapping:
  private static COMPANY_MAP: Record<string, { name: string; cnpj: string }> = {
    "1": { name: "Conectubos Atacarejo da Construção", cnpj: "05.443.069/0001-03" },
    "2": { name: "D & C Comercial",                   cnpj: "05.443.069/0002-94" },
    "3": { name: "Conectubos",                         cnpj: "52.846.814/0001-45" },
  };

  private async getCompaniesFromCache(): Promise<Company[]> {
    try {
      // Try to load overrides from app_settings
      const settingRow = await pgGet<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = 'companies_config' LIMIT 1`
      );
      if (settingRow?.value) {
        try {
          const cfg = JSON.parse(settingRow.value);
          if (Array.isArray(cfg) && cfg.length > 0) {
            PostgresStorage.COMPANY_MAP = {};
            for (const c of cfg) {
              PostgresStorage.COMPANY_MAP[String(c.id)] = { name: c.name, cnpj: c.cnpj ?? "" };
            }
          }
        } catch { /* ignore parse errors */ }
      }

      const rows = await pgAll<{ id: string }>(
        `SELECT DISTINCT CAST("IDEMPRESA" AS TEXT) as id FROM cache_vendas ORDER BY id`
      );

      if (rows.length === 0) {
        return [{ id: "1", name: "Conectubos", cnpj: "" }];
      }

      return rows.map(row => {
        const info = PostgresStorage.COMPANY_MAP[row.id];
        return {
          id: row.id,
          name: info?.name ?? `Empresa ${row.id}`,
          cnpj: info?.cnpj ?? "",
        };
      });
    } catch (err) {
      return [{ id: "1", name: "Conectubos", cnpj: "" }];
    }
  }

  private async getSalespersonsFromCache(companyId?: string, showHidden = false): Promise<Salesperson[]> {
    try {
      // Load hidden vendor IDs from vendor_display_settings
      let hiddenIds: Set<string> = new Set();
      if (!showHidden) {
        try {
          const hiddenRows = await pgAll<{ vendorId: string }>(
            `SELECT "vendorId" FROM vendor_display_settings WHERE "isHidden" = TRUE OR "isHidden" = 1`
          );
          hiddenIds = new Set(hiddenRows.map(r => this.normalizeVendorId(r.vendorId)));
        } catch { /* table may be empty */ }
      }

      let rows: { id: string; name: string; companyId: string }[];

      if (companyId && companyId !== "all") {
        rows = await pgAll(`
          SELECT
            TRIM(CAST("IDVENDEDOR" AS TEXT)) as id,
            MIN(TRIM("NOME_VENDEDOR")) as name,
            CAST("IDEMPRESA" AS TEXT) as "companyId"
          FROM cache_vendas
          WHERE "IDVENDEDOR" IS NOT NULL
            AND TRIM(CAST("IDVENDEDOR" AS TEXT)) != ''
            AND "NOME_VENDEDOR" IS NOT NULL
            AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
            AND UPPER("NOME_VENDEDOR") NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%'
            AND "IDEMPRESA" = ?
          GROUP BY TRIM(CAST("IDVENDEDOR" AS TEXT)), CAST("IDEMPRESA" AS TEXT)
          ORDER BY name
        `, [parseInt(companyId)]);
      } else {
        rows = await pgAll(`
          SELECT
            TRIM(CAST("IDVENDEDOR" AS TEXT)) as id,
            MIN(TRIM("NOME_VENDEDOR")) as name,
            MIN(TRIM(CAST("IDEMPRESA" AS TEXT))) as "companyId"
          FROM cache_vendas
          WHERE "IDVENDEDOR" IS NOT NULL
            AND TRIM(CAST("IDVENDEDOR" AS TEXT)) != ''
            AND "NOME_VENDEDOR" IS NOT NULL
            AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
            AND UPPER("NOME_VENDEDOR") NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%'
          GROUP BY TRIM(CAST("IDVENDEDOR" AS TEXT))
          ORDER BY name
        `);
      }

      return rows
        .filter((row: any) => showHidden || !hiddenIds.has(this.normalizeVendorId(row.id ?? row.IDVENDEDOR ?? row.idvendedor ?? "")))
        .map((row: any) => ({
          id: this.normalizeVendorId(row.id ?? row.IDVENDEDOR ?? row.idvendedor ?? ""),
          name: String(row.name ?? row.NOME_VENDEDOR ?? row.nome_vendedor ?? "Nome não encontrado"),
          email: "",
          teamId: "t1",
          companyId: this.normalizeVendorId(row.companyId ?? row.idempresa ?? "1") || "1",
        }));
    } catch (err) {
      console.error("Error getting salespersons from cache:", err);
      return [];
    }
  }

  async getAllSalespersonsWithVisibility(): Promise<{ id: string; name: string; companyId: string; isHidden: boolean }[]> {
    try {
      const rows = await pgAll<{ id: string; name: string; companyId: string }>(`
        SELECT
          TRIM(CAST("IDVENDEDOR" AS TEXT)) as id,
          MIN(TRIM("NOME_VENDEDOR")) as name,
          MIN(TRIM(CAST("IDEMPRESA" AS TEXT))) as "companyId"
        FROM cache_vendas
        WHERE "IDVENDEDOR" IS NOT NULL
          AND TRIM(CAST("IDVENDEDOR" AS TEXT)) != ''
          AND "NOME_VENDEDOR" IS NOT NULL
          AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
          AND UPPER("NOME_VENDEDOR") NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%'
        GROUP BY TRIM(CAST("IDVENDEDOR" AS TEXT))
        ORDER BY name
      `);

      const hiddenRows = await pgAll<{ vendorId: string }>(
        `SELECT "vendorId" FROM vendor_display_settings WHERE "isHidden" = TRUE OR "isHidden" = 1`
      ).catch(() => [] as { vendorId: string }[]);
      const hiddenIds = new Set(hiddenRows.map(r => this.normalizeVendorId(r.vendorId)));

      return rows.map((row: any) => ({
        id: this.normalizeVendorId(row.id),
        name: this.normalizeVendorName(row.name),
        companyId: this.normalizeVendorId(row.companyId) || "1",
        isHidden: hiddenIds.has(this.normalizeVendorId(row.id)),
      }));
    } catch (err) {
      console.error("Error getting all salespersons with visibility:", err);
      return [];
    }
  }

  async setVendorHidden(vendorId: string, isHidden: boolean): Promise<void> {
    try {
      const existing = await pgGet(
        `SELECT id FROM vendor_display_settings WHERE "vendorId" = $1`, [vendorId]
      );
      if (existing) {
        await pgRun(
          `UPDATE vendor_display_settings SET "isHidden" = $1 WHERE "vendorId" = $2`,
          [isHidden, vendorId]
        );
      } else {
        const newId = Math.random().toString(36).substring(2, 15);
        await pgRun(
          `INSERT INTO vendor_display_settings (id, "vendorId", "displayCode", "displayName", "isHidden", "companyId")
           VALUES ($1, $2, NULL, NULL, $3, NULL)`,
          [newId, vendorId, isHidden]
        );
      }
    } catch (err) {
      console.error("Error setting vendor hidden:", err);
      throw err;
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
    return this.companyRepo.getCompanies();
  }

  async getCompany(id: string): Promise<Company | undefined> {
    return this.companyRepo.getCompany(id);
  }

  async getTeams(companyId: string): Promise<Team[]> {
    return this.teamRepo.getTeams(companyId);
  }

  async getTeam(id: string): Promise<Team | undefined> {
    return this.teamRepo.getTeam(id);
  }

  async getSalespersons(companyId: string, teamMembers?: string[], showHidden = false): Promise<Salesperson[]> {
    return this.teamRepo.getSalespersons(companyId, teamMembers, showHidden);
  }

  async getSalesperson(id: string): Promise<Salesperson | undefined> {
    return this.teamRepo.getSalesperson(id);
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

      const vendasPeriodoResult = await pgGet<{ total: number }>(`
        SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
        FROM cache_vendas
        WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany} ${teamFilter}
      `, [startDate, endDate]);

      const now = new Date();
      const mesStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const hoje = now.toISOString().split('T')[0];

      const vendasMesResult = await pgGet<{ total: number }>(`
        SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
        FROM cache_vendas
        WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany} ${teamFilter}
      `, [mesStart, hoje]);

      // YoY para o mês atual: compara os MESMOS dias do ano anterior (justo)
      const mesStartAnoAnterior = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
      const hojeAnoAnterior = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split('T')[0];
      const vendasMesAnoAnteriorResult = await pgGet<{ total: number }>(`
        SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
        FROM cache_vendas
        WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany} ${teamFilter}
      `, [mesStartAnoAnterior, hojeAnoAnterior]);

      const totalMesAtual = Number(vendasMesResult?.total ?? 0);
      const totalMesAnoAnterior = Number(vendasMesAnoAnteriorResult?.total ?? 0);
      const yoyMesAtual = totalMesAnoAnterior > 0
        ? ((totalMesAtual - totalMesAnoAnterior) / totalMesAnoAnterior) * 100
        : null;

      const teamFilterPendentes = this.buildTeamFilter(teamMembers, `"NOME_VENDEDOR"`, "");
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
        totalVendasSemanal: Number(vendasPeriodoResult?.total ?? 0),
        totalVendasMensal: totalMesAtual,
        valorAFaturar: Number(aFaturarResult?.total ?? 0),
        pedidosAtendidos: Number(pedidosResult?.total ?? 0),
        yoyMesAtual,
      };
    } catch (err) {
      console.error("Error getting KPIs:", err);
      return { totalVendasSemanal: 0, totalVendasMensal: 0, valorAFaturar: 0, pedidosAtendidos: 0, yoyMesAtual: null };
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

      const salesRows = await pgAll<{
        id: string; name: string; companyId: string;
        totalVendas: number; totalLucro: number;
        positivacao: number; mixProdutos: number; qtdPedidos: number;
      }>(`
        SELECT
          TRIM(CAST("IDVENDEDOR" AS TEXT)) as id,
          MIN(TRIM("NOME_VENDEDOR")) as name,
          MIN(TRIM(CAST("IDEMPRESA" AS TEXT))) as "companyId",
          COALESCE(SUM("TOTALVENDA_LINHA"), 0) as "totalVendas",
          0::numeric as "totalLucro",
          COUNT(DISTINCT NULLIF("IDCLIENTE", '0')) as positivacao,
          COUNT(DISTINCT "IDPLANILHA") as "mixProdutos",
          COUNT(DISTINCT "IDPLANILHA") as "qtdPedidos"
        FROM cache_vendas
        WHERE "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
          AND "IDVENDEDOR" IS NOT NULL
          AND TRIM(CAST("IDVENDEDOR" AS TEXT)) != ''
          AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
          ${whereCompany} ${teamFilter}
        GROUP BY TRIM(CAST("IDVENDEDOR" AS TEXT))
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
            WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
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

      const teamFilterCamp = this.buildTeamFilter(teamMembers, "", `"IDVENDEDOR"`);
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

      return rows.map((row, idx) => {
        const tv = Number(row.totalValue) || 0;
        const pct = totalValue > 0 ? (tv / totalValue) * 100 : 0;
        const abcCurve: "A" | "B" | "C" = pct >= 10 ? "A" : pct >= 3 ? "B" : "C";
        return {
          product: {
            id: row.category || `cat-${idx}`,
            sku: "",
            name: row.category || "Sem Fabricante",
            category: row.category || "Sem Fabricante",
            abcCurve,
            companyId: companyId,
          },
          totalValue: tv,
          percentage: pct,
          quantity: Number(row.quantity) || 0,
        };
      });
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
        const variacao = previous > 0 ? ((current - previous) / previous) * 100 : null;

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
        const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
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

    const filtered = salespersons.filter(sp => this.matchesTeamMember(sp, teamMembers));

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    let whereCompany = "";
    if (companyId !== "all") {
      whereCompany = `AND "IDEMPRESA" = ${parseInt(companyId)}`;
    }

    const results: GoalWithProgress[] = [];
    await Promise.all(filtered.map(async (sp) => {
      const spGoals = this.goals.filter(g =>
        g.salespersonId === sp.id &&
        g.month === month &&
        g.year === year &&
        (companyId === "all" || g.companyId === companyId)
      );

      if (spGoals.length === 0) return;

      const salesRow = await pgGet<{ total: number }>(`
        SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
        FROM cache_vendas
        WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? ${whereCompany}
      `, [sp.id, startDate, endDate]);

      const currentValue = Number(salesRow?.total ?? 0);

      for (const g of spGoals) {
        const progress = g.targetValue > 0
          ? Math.min(100, Math.round((currentValue / g.targetValue) * 100))
          : 0;
        results.push({
          ...g,
          currentValue,
          progress,
          salespersonName: sp.name,
        });
      }
    }));
    return results;
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
      WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
    `, [salespersonId, startDate, endDate]);

    const currentValue = Number(progress?.total ?? 0);
    return goals.map(g => {
      const prog = g.targetValue > 0 ? Math.min(100, Math.round((currentValue / g.targetValue) * 100)) : 0;
      return { ...g, currentValue, progress: prog, salespersonName: sp.name };
    });
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

  async getSalespersonsWithStats(companyId: string, startDate: string, endDate: string, teamMembers?: string[], showHidden = false): Promise<SalespersonWithStats[]> {
    const allSalespersons = await this.getSalespersons(companyId, teamMembers, showHidden);
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
    salespersons = salespersons.filter(sp => this.matchesTeamMember(sp, teamMembers));

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
            WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" = ?
          `, [sp.id, dateStr]);

          const resultYoy = await pgGet<{ total: number }>(`
            SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
            FROM cache_vendas
            WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" = ?
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
    salespersons = salespersons.filter(sp => this.matchesTeamMember(sp, teamMembers));

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
            WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
          `, [sp.id, weekStart, weekEnd]);

          const resultYoy = await pgGet<{ total: number }>(`
            SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
            FROM cache_vendas
            WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
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
          WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
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
      const teamFilter = this.buildTeamFilter(teamMembers, `"NOME_VENDEDOR"`, "");
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
    return this.settingsRepo.getVendorDisplaySettings();
  }

  async getVendorsTVSettings(): Promise<Array<{ vendorId: string; displayName: string; displayCode: string; showOnTv: boolean }>> {
    try {
      const salespersons = await this.getSalespersonsFromCache();
      const settings = await this.getVendorDisplaySettings();
      return salespersons.map(sp => {
        const s = settings.find(x => x.vendorId === sp.id);
        return {
          vendorId: sp.id,
          displayName: s?.displayName || sp.name.split(' ')[0],
          displayCode: s?.displayCode || sp.id.slice(0, 4),
          showOnTv: s ? (s.showOnTv !== false) : true,
        };
      });
    } catch {
      return [];
    }
  }

  async setVendorTVVisible(vendorId: string, showOnTv: boolean): Promise<void> {
    try {
      const existing = await pgGet(`SELECT * FROM vendor_display_settings WHERE "vendorId" = ?`, [vendorId]);
      if (existing) {
        await pgRun(`UPDATE vendor_display_settings SET "showOnTv" = ?, updated_at = CURRENT_TIMESTAMP WHERE "vendorId" = ?`,
          [showOnTv ? 1 : 0, vendorId]);
      } else {
        const { randomUUID } = await import("crypto");
        await pgRun(`INSERT INTO vendor_display_settings (id, "vendorId", "isHidden", "showOnTv", "companyId") VALUES (?, ?, 0, ?, 'all')`,
          [randomUUID(), vendorId, showOnTv ? 1 : 0]);
      }
    } catch (err) {
      console.error("Error updating TV visibility:", err);
      throw err;
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

    salespersons = salespersons.filter(sp => this.matchesTeamMember(sp, teamMembers));

    const settings = await this.getVendorDisplaySettings();

    const yoyStart = new Date(weekStart); yoyStart.setFullYear(yoyStart.getFullYear() - 1);
    const yoyEnd = new Date(weekEnd); yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);
    const yoyStartStr = yoyStart.toISOString().split('T')[0];
    const yoyEndStr = yoyEnd.toISOString().split('T')[0];

    // Define IDEMPRESA da matriz = 1
    let matrizEmpresaId: number | null = 1;

    const latestMovement = await pgGet<{ dt: string }>(`
      SELECT MAX("DT_MOVIMENTO") as dt
      FROM cache_vendas
      WHERE "DT_MOVIMENTO" <= CURRENT_DATE
    `);
    const todayStr = latestMovement?.dt
      ? new Date(latestMovement.dt).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const vendorsData = (await Promise.all(salespersons.map(async (sp) => {
      const setting = settings.find(s => s.vendorId === sp.id);
      if (setting?.isHidden) return null;
      if (setting && setting.showOnTv === false) return null;

      let l01Sales = 0, l03Sales = 0, lMatrizSales = 0;
      try {
        const rowL01 = await pgGet<{ total: number }>(`
          SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
          FROM cache_vendas
          WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? AND "IDEMPRESA" = 1
        `, [sp.id, weekStart, weekEnd]);
        l01Sales = rowL01?.total ?? 0;

        const rowL03 = await pgGet<{ total: number }>(`
          SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
          FROM cache_vendas
          WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ? AND "IDEMPRESA" = 3
        `, [sp.id, weekStart, weekEnd]);
        l03Sales = rowL03?.total ?? 0;

        if (matrizEmpresaId !== null) {
          const rowMatriz = await pgGet<{ total: number }>(`
            SELECT COALESCE(SUM("TOTALVENDA_LINHA"), 0) as total
            FROM cache_vendas
            WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" = ? AND "IDEMPRESA" = ?
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
          WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ? AND "DT_MOVIMENTO" >= ? AND "DT_MOVIMENTO" <= ?
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

      const user = await pgGet<{ first_name: string; vendor_code: string | null }>(
        "SELECT first_name, vendor_code FROM users WHERE LOWER(email) = LOWER(?)",
        [email]
      );
      if (!user) return email;

      if (user.vendor_code && user.vendor_code.trim()) {
        return user.vendor_code.trim();
      }

      if (!user.first_name) return email;

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
    return this.campaignRepo.getMetasAcompanhamento(vendedorId);
  }

  async getMetasAmancoDTR(vendedorId: string, targetYear?: number, targetQuarter?: number): Promise<any> {
    return this.campaignRepo.getMetasAmancoDTR(vendedorId, targetYear, targetQuarter);
  }

  async getMetasAmancoTV(vendedorId: string): Promise<any> {
    return this.campaignRepo.getMetasAmancoTV(vendedorId);
  }

  async getMetasElit(vendedorId: string): Promise<any> {
    return this.campaignRepo.getMetasElit(vendedorId);
  }

  async getCampaignGoals(campaignName: string, year: number): Promise<{ salespersonId: string; triggerValue: number }[]> {
    return this.campaignRepo.getCampaignGoals(campaignName, year);
  }

  async saveCampaignGoals(campaignName: string, year: number, goals: { salespersonId: string; triggerValue: number }[]): Promise<void> {
    return this.campaignRepo.saveCampaignGoals(campaignName, year, goals);
  }

  async getVendorGroups(): Promise<{ id: string; name: string; members: string[] }[]> {
    return this.teamRepo.getVendorGroups();
  }

  async saveVendorGroup(id: string, name: string, members: string[]): Promise<void> {
    const normalizedId = String(id ?? "").trim();
    const normalizedName = this.normalizeVendorName(name);
    const normalizedMembers = Array.from(new Set((members ?? []).map(member => this.normalizeVendorId(member)).filter(Boolean)));

    const existing = await pgGet(`SELECT id FROM vendor_groups WHERE id = ?`, [normalizedId]);
    if (existing) {
      await pgRun(`UPDATE vendor_groups SET name = ? WHERE id = ?`, [normalizedName, normalizedId]);
    } else {
      await pgRun(`INSERT INTO vendor_groups (id, name) VALUES (?, ?)`, [normalizedId, normalizedName]);
    }
    await pgRun(`DELETE FROM vendor_group_members WHERE group_id = ?`, [normalizedId]);
    for (const member of normalizedMembers) {
      await pgRun(`INSERT INTO vendor_group_members (group_id, salesperson_id) VALUES (?, ?)`, [normalizedId, member]);
    }
  }

  async deleteVendorGroup(id: string): Promise<void> {
    const normalizedId = String(id ?? "").trim();
    await pgRun(`DELETE FROM vendor_group_members WHERE group_id = ?`, [normalizedId]);
    await pgRun(`DELETE FROM vendor_groups WHERE id = ?`, [normalizedId]);
  }

  async getCampaignReport(campaignName: string): Promise<any[]> {
    return this.campaignRepo.getCampaignReport(campaignName);
  }

  async getMovimentacoesPorVendedor(vendedorId: string, startDate: string, endDate: string): Promise<any[]> {
    try {
      const rows = await pgAll(`
        SELECT
          "DT_MOVIMENTO"              AS "dtMovimento",
          "IDCLIENTE"                 AS "idCliente",
          "NOME_CLIENTE"              AS "nomeCliente",
          "IDEMPRESA"                 AS "idEmpresa",
          "IDPLANILHA"                AS "numNota",
          ''                          AS "serieNota",
          CASE WHEN SUM("TOTALVENDA_LINHA") < 0 THEN 'D' ELSE 'V' END AS "tipoMovimento",
          CASE WHEN SUM("TOTALVENDA_LINHA") < 0 THEN true ELSE false END AS "isDevolucao",
          SUM("TOTALVENDA_LINHA")     AS "valContabil",
          0                           AS lucro
        FROM cache_vendas
        WHERE TRIM(CAST("IDVENDEDOR" AS TEXT)) = ?
          AND "DT_MOVIMENTO" >= ?
          AND "DT_MOVIMENTO" <= ?
        GROUP BY "DT_MOVIMENTO", "IDCLIENTE", "NOME_CLIENTE", "IDEMPRESA", "IDPLANILHA"
        ORDER BY "DT_MOVIMENTO" DESC, "IDPLANILHA"
      `, [this.normalizeVendorId(vendedorId), startDate, endDate]);
      return rows.map(r => ({
        ...r,
        valContabil: Number(r.valContabil),
        lucro: Number(r.lucro),
      }));
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
  getSalespersonsWithStats: (cid: string, sd: string, ed: string, tm?: string[], showHidden?: boolean) => getStorage().then(s => s.getSalespersonsWithStats(cid, sd, ed, tm, showHidden)),
  getAllSalespersonsWithVisibility: () => getStorage().then(s => s.getAllSalespersonsWithVisibility()),
  setVendorHidden: (vid: string, hidden: boolean) => getStorage().then(s => s.setVendorHidden(vid, hidden)),
  getWeeklyView: (cid: string, sd: string, ed: string, tm?: string[]) => getStorage().then(s => s.getWeeklyView(cid, sd, ed, tm)),
  getMonthlyView: (cid: string, sd: string, ed: string, tm?: string[]) => getStorage().then(s => s.getMonthlyView(cid, sd, ed, tm)),
  getAFaturarPorVendedor: (cid: string, tm?: string[]) => getStorage().then(s => s.getAFaturarPorVendedor(cid, tm)),
  getVendorDisplaySettings: () => getStorage().then(s => s.getVendorDisplaySettings()),
  updateVendorDisplaySetting: (set: VendorDisplaySettings) => getStorage().then(s => s.updateVendorDisplaySetting(set)),
  getVendorsTVSettings: () => getStorage().then(s => s.getVendorsTVSettings()),
  setVendorTVVisible: (vid: string, showOnTv: boolean) => getStorage().then(s => s.setVendorTVVisible(vid, showOnTv)),
  getTVDashboardData: (ws: string, we: string, ur: string, tm?: string[]) => getStorage().then(s => s.getTVDashboardData(ws, we, ur, tm)),
  getGoalSettings: (spid: string, m: number, y: number) => getStorage().then(s => s.getGoalSettings(spid, m, y)),
  saveGoalSettings: (set: GoalSetting) => getStorage().then(s => s.saveGoalSettings(set)),
  getSalespersonGoalsRaw: (m: number, y: number) => getStorage().then(s => s.getSalespersonGoalsRaw(m, y)),
  getVendedorIdByEmail: (email: string) => getStorage().then(s => s.getVendedorIdByEmail(email)),
  getMetasAcompanhamento: (vid: string, _p?: any) => getStorage().then(s => s.getMetasAcompanhamento(vid)),
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
