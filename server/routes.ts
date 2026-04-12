import type { Express, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import type { RankingCriteria } from "@shared/schema";
import { createAuthRouter, isAuthenticated, isAdmin, AuthRequest } from "./auth";
import campaignRoutes from "./campaigns/routes";
import { initCampaignTables } from "./campaigns/init";
import { startAlertEngine } from "./alert-engine";
import { db, sqlite } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

function resolveGroupTeamMembers(groupId: string, supervisorTeam?: string[]): string[] {
  try {
    const memberRows = sqlite.prepare(
      `SELECT salesperson_id FROM vendor_group_members WHERE group_id = ?`
    ).all(groupId) as { salesperson_id: string }[];
    if (memberRows.length === 0) return supervisorTeam ?? [];
    const ids = memberRows.map(r => r.salesperson_id);
    const placeholders = ids.map(() => "?").join(",");
    const nameRows = sqlite.prepare(
      `SELECT DISTINCT NOME_VENDEDOR FROM cache_vendas WHERE IDVENDEDOR IN (${placeholders}) LIMIT 100`
    ).all(...ids) as { NOME_VENDEDOR: string }[];
    const groupNames = nameRows.map(r => r.NOME_VENDEDOR);
    if (supervisorTeam && supervisorTeam.length > 0) {
      return groupNames.filter(name =>
        supervisorTeam.some(tm => name.toUpperCase().includes(tm.toUpperCase()))
      );
    }
    return groupNames;
  } catch {
    return supervisorTeam ?? [];
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  initCampaignTables();
  startAlertEngine();

  app.use("/api/auth", createAuthRouter());

  app.get("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar empresas" });
    }
  });

  app.get("/api/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const company = await storage.getCompany(req.params.id as string);
      if (!company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar empresa" });
    }
  });

  app.get("/api/teams/:companyId", isAuthenticated, async (req, res) => {
    try {
      const teams = await storage.getTeams(req.params.companyId as string);
      res.json(teams);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar equipes" });
    }
  });

  app.get("/api/salespersons/:companyId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.companyId as string;
      const startDate = req.params.startDate as string;
      const endDate = req.params.endDate as string;
      const salespersons = await storage.getSalespersonsWithStats(companyId, startDate, endDate, req.teamMembers);
      res.json(salespersons);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar vendedores" });
    }
  });

  app.get("/api/products/:companyId", isAuthenticated, async (req, res) => {
    try {
      const products = await storage.getProducts(req.params.companyId as string);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar produtos" });
    }
  });

  app.get("/api/vendor-groups", isAuthenticated, async (req, res) => {
    try {
      const groups = await storage.getVendorGroups();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar grupos de vendedores" });
    }
  });

  app.get("/api/kpis/:companyId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.companyId as string;
      const startDate = req.params.startDate as string;
      const endDate = req.params.endDate as string;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const kpis = await storage.getKPISummary(companyId, startDate, endDate, team);
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar KPIs" });
    }
  });

  app.get("/api/rankings/:companyId/:startDate/:endDate/:criteria", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.companyId as string;
      const startDate = req.params.startDate as string;
      const endDate = req.params.endDate as string;
      const criteria = req.params.criteria as string;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const rankings = await storage.getRankings(
        companyId,
        startDate,
        endDate,
        criteria as RankingCriteria,
        team
      );
      res.json(rankings);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar rankings" });
    }
  });

  app.get("/api/product-mix/:companyId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.companyId as string;
      const startDate = req.params.startDate as string;
      const endDate = req.params.endDate as string;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const productMix = await storage.getProductMix(companyId, startDate, endDate, team);
      res.json(productMix);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar mix de produtos" });
    }
  });

  app.get("/api/goals/:companyId/:month/:year", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.companyId as string;
      const month = req.params.month as string;
      const year = req.params.year as string;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const goals = await storage.getGoals(
        companyId,
        parseInt(month),
        parseInt(year),
        team
      );
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar metas" });
    }
  });

  app.post("/api/goals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const goal = await storage.createGoal(req.body);
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar meta" });
    }
  });

  app.put("/api/goals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const goal = await storage.updateGoal(req.params.id as string, req.body);
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar meta" });
    }
  });

  app.delete("/api/goals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteGoal(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao deletar meta" });
    }
  });

  app.get("/api/goals-config/:month/:year", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const month = parseInt(req.params.month as string);
      const year = parseInt(req.params.year as string);

      const salespersons = await storage.getSalespersons(req.userRole === "admin" ? "all" : "1", req.teamMembers);

      // Carrega settings e goals UMA vez (batch) em vez de N queries individuais
      const allSettings = await storage.getGoalSettings("all", month, year);
      const allGoals = await storage.getSalespersonGoalsRaw(month, year);

      const config = salespersons.map((sp) => {
        const settings = allSettings.filter(s => s.salespersonId === sp.id);
        const goals = allGoals.filter(g => g.salespersonId === sp.id);

        const weeklySetting = settings.find(s => s.type === "weekly");
        const monthlySetting = settings.find(s => s.type === "monthly");

        return {
          salespersonId: sp.id,
          weeklyMode: weeklySetting?.mode || "split",
          monthlyMode: monthlySetting?.mode || "split",
          goals: goals.map(g => ({
            type: g.type,
            companyId: g.companyId,
            value: g.targetValue
          }))
        };
      });

      res.json(config);
    } catch (error) {
      console.error("Error fetching goal config:", error);
      res.status(500).json({ error: "Erro ao buscar configurações de meta" });
    }
  });

  app.post("/api/goals-config", isAuthenticated, isAdmin, async (req, res) => {
    /*
      Payload: {
        salespersonId: string,
        type: "weekly" | "monthly",
        mode: "unified" | "split",
        month: number,
        year: number,
        values: {
          "all": number | null,
          "1": number | null,
          "3": number | null
        }
      }
    */
    try {
      const { salespersonId, type, mode, month, year, values } = req.body;

      // 1. Save Setting
      await storage.saveGoalSettings({
        id: "", // generated in storage
        salespersonId,
        type,
        mode,
        month,
        year
      });

      // 2. Save Goals (Atomic Logic)
      // Existing goals logic uses createGoal/updateGoal/deleteGoal. 
      // We will loop through the values.

      const goals = await storage.getSalespersonGoals(salespersonId, month, year);

      for (const [companyId, value] of Object.entries(values)) {
        const existing = goals.find(g => g.type === type && g.companyId === companyId);

        if (value === null || value === undefined) {
          if (existing) {
            await storage.deleteGoal(existing.id);
          }
        } else {
          if (existing) {
            await storage.updateGoal(existing.id, { targetValue: Number(value) });
          } else {
            await storage.createGoal({
              companyId,
              salespersonId,
              type,
              targetValue: Number(value),
              month,
              year,
              week: 1 // Default placeholder for now if needed
            });
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving goal config:", error);
      res.status(500).json({ error: "Erro ao salvar configuração de meta" });
    }
  });

  app.get("/api/alerts/:companyId", isAuthenticated, async (req, res) => {
    try {
      const alerts = await storage.getAlertNotifications(req.params.companyId as string);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar alertas" });
    }
  });

  app.post("/api/alerts/:id/read", isAuthenticated, async (req, res) => {
    try {
      const found = await storage.markAlertRead(req.params.id as string);
      if (!found) return res.status(404).json({ error: "Alerta não encontrado" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao marcar alerta como lido" });
    }
  });

  app.delete("/api/alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const found = await storage.dismissAlert(req.params.id as string);
      if (!found) return res.status(404).json({ error: "Alerta não encontrado" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao dispensar alerta" });
    }
  });

  app.get("/api/alert-configs", isAuthenticated, async (req, res) => {
    try {
      const companyId = (req.query.companyId as string) || "all";
      const configs = await storage.getAlertConfigs(companyId);
      res.json(configs);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar configurações de alertas" });
    }
  });

  app.patch("/api/alert-configs/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Campo 'enabled' é obrigatório e deve ser boolean" });
      }
      const found = await storage.updateAlertConfig(req.params.id as string, enabled);
      if (!found) return res.status(404).json({ error: "Configuração de alerta não encontrada" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar configuração de alerta" });
    }
  });

  app.get("/api/afaturar-vendedores/:companyId", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.companyId as string;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const afaturar = await storage.getAFaturarPorVendedor(companyId, team);
      res.json(afaturar);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar A Faturar por vendedor" });
    }
  });

  app.get("/api/weekly-view/:companyId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.companyId as string;
      const startDate = req.params.startDate as string;
      const endDate = req.params.endDate as string;
      const weeklyData = await storage.getWeeklyView(companyId, startDate, endDate, req.teamMembers);
      res.json(weeklyData);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar visão semanal" });
    }
  });

  app.get("/api/monthly-view/:companyId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.companyId as string;
      const startDate = req.params.startDate as string;
      const endDate = req.params.endDate as string;
      const monthlyData = await storage.getMonthlyView(companyId, startDate, endDate, req.teamMembers);
      res.json(monthlyData);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar visão mensal" });
    }
  });

  app.get("/api/afaturar/:companyId", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.companyId as string;
      const afaturar = await storage.getAFaturarPorVendedor(companyId, req.teamMembers);
      res.json(afaturar);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar A Faturar" });
    }
  });

  app.get("/api/sales-evolution/:companyId", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = req.params.companyId as string;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const salesEvolution = await storage.getSalesEvolution(companyId, team);
      res.json(salesEvolution);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar evolução de vendas" });
    }
  });

  // TV Mode Routes
  app.get("/api/tv/dashboard", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const { weekStart, weekEnd } = req.query;
      if (!weekStart || !weekEnd) {
        return res.status(400).json({ error: "weekStart e weekEnd são obrigatórios" });
      }

      const dashboardData = await storage.getTVDashboardData(
        weekStart as string,
        weekEnd as string,
        req.userRole || "admin",
        req.teamMembers
      );
      res.json(dashboardData);
    } catch (error) {
      console.error("TV Dashboard Error:", error);
      res.status(500).json({ error: "Erro ao buscar dados do painel TV" });
    }
  });

  app.get("/api/admin/vendor-settings", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getVendorDisplaySettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar configurações de vendedores" });
    }
  });

  app.post("/api/admin/vendor-settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const setting = await storage.updateVendorDisplaySetting(req.body);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "Erro ao salvar configuração" });
    }
  });

  app.get("/api/app-settings/:key", isAuthenticated, async (req, res) => {
    try {
      const value = await storage.getAppSetting(req.params.key);
      res.json({ key: req.params.key, value });
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar configuração" });
    }
  });

  app.post("/api/admin/app-settings", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { key, value } = req.body as { key: string; value: string };
      if (!key || value === undefined) return res.status(400).json({ error: "key e value são obrigatórios" });
      await storage.setAppSetting(key, value);
      res.json({ key, value });
    } catch (error) {
      res.status(500).json({ error: "Erro ao salvar configuração" });
    }
  });

  // Metas de Vendas Module Routes

  app.get("/api/metas/admin/campaign-goals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const campaignName = req.query.campaign as string;
      const year = parseInt(req.query.year as string);

      if (!campaignName || isNaN(year)) {
        return res.status(400).json({ error: "Missing required query params" });
      }

      const data = await storage.getCampaignGoals(campaignName, year);
      res.json(data);
    } catch (error) {
      console.error("Erro getCampaignGoals:", error);
      res.status(500).json({ error: "Erro ao buscar gratilhos" });
    }
  });

  app.post("/api/metas/admin/campaign-goals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { campaignName, year, goals } = req.body;

      if (!campaignName || isNaN(year) || !Array.isArray(goals)) {
        return res.status(400).json({ error: "Invalid payload format" });
      }

      await storage.saveCampaignGoals(campaignName, year, goals);
      res.json({ success: true });
    } catch (error) {
      console.error("Erro saveCampaignGoals:", error);
      res.status(500).json({ error: "Erro ao salvar gatilhos" });
    }
  });

  // Vendor Groups API
  app.get("/api/admin/vendor-groups", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const groups = await storage.getVendorGroups();
      res.json(groups);
    } catch (error) {
      console.error("Erro getVendorGroups:", error);
      res.status(500).json({ error: "Erro ao buscar grupos de vendedores" });
    }
  });

  app.post("/api/admin/vendor-groups", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id, name, members } = req.body;
      if (!id || !name || !Array.isArray(members)) {
        return res.status(400).json({ error: "Invalid payload format" });
      }
      await storage.saveVendorGroup(id, name, members);
      res.json({ id, name, members });
    } catch (error) {
      console.error("Erro saveVendorGroup:", error);
      res.status(500).json({ error: "Erro ao salvar grupo de vendedores" });
    }
  });

  app.delete("/api/admin/vendor-groups/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      await storage.deleteVendorGroup(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Erro deleteVendorGroup:", error);
      res.status(500).json({ error: "Erro ao deletar grupo de vendedores" });
    }
  });

  // Campaign Reports API
  app.get("/api/metas/admin/campaign-report", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const campaignName = req.query.campaign as string;
      if (!campaignName) {
        return res.status(400).json({ error: "Missing campaign query param" });
      }
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const quarter = req.query.quarter !== undefined ? parseInt(req.query.quarter as string) : undefined;
      const data = await storage.getCampaignReport(campaignName, year, quarter);
      res.json(data);
    } catch (error) {
      console.error("Erro getCampaignReport:", error);
      res.status(500).json({ error: "Erro ao buscar relatório da campanha" });
    }
  });
  app.get("/api/metas/acompanhamento", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      let vendedorId = req.userRole === "admin" ? (req.query.vendedor_id as string || req.userEmail) : req.userEmail;
      if (!vendedorId) return res.status(400).json({ error: "Vendedor não identificado" });

      if (req.userRole !== "admin" || (!req.query.vendedor_id && req.userEmail)) {
        vendedorId = await storage.getVendedorIdByEmail(vendedorId);
      }

      const data = await storage.getMetasAcompanhamento(vendedorId);
      res.json(data);
    } catch (error) {
      console.error("Erro metas acompanhamento:", error);
      res.status(500).json({ error: "Erro ao buscar acompanhamento" });
    }
  });

  app.get("/api/metas/amanco/dtr", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      let vendedorId = req.userRole === "admin" ? (req.query.vendedor_id as string || req.userEmail) : req.userEmail;
      if (!vendedorId) return res.status(400).json({ error: "Vendedor não identificado" });

      if (req.userRole !== "admin" || (!req.query.vendedor_id && req.userEmail)) {
        vendedorId = await storage.getVendedorIdByEmail(vendedorId);
      }

      // ── Lógica de período com grace period ──────────────────────────────
      const graceSetting = await storage.getAppSetting("dtrGracePeriodDays");
      const graceDays = Math.max(0, parseInt(graceSetting ?? "5") || 5);

      const now = new Date();
      const currentQuarterIdx = Math.floor(now.getMonth() / 3);
      const currentYear = now.getFullYear();

      // Início do trimestre corrente (1º dia do mês inicial do trimestre)
      const currentQuarterStart = new Date(currentYear, currentQuarterIdx * 3, 1);

      // Fim do grace period
      const gracePeriodEnd = new Date(currentQuarterStart);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);

      const inGracePeriod = graceDays > 0 && now >= currentQuarterStart && now < gracePeriodEnd;
      const daysLeft = inGracePeriod
        ? Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Trimestre anterior
      const prevQuarterIdx = currentQuarterIdx === 0 ? 3 : currentQuarterIdx - 1;
      const prevYear = currentQuarterIdx === 0 ? currentYear - 1 : currentYear;

      const quarterNames = ["JAN/FEV/MAR", "ABR/MAI/JUN", "JUL/AGO/SET", "OUT/NOV/DEZ"];

      // Qual trimestre exibir?
      const viewPrev = req.query.view === "prev" && inGracePeriod;
      const targetQuarter = viewPrev ? prevQuarterIdx : currentQuarterIdx;
      const targetYear    = viewPrev ? prevYear       : currentYear;

      const data = await storage.getMetasAmancoDTR(vendedorId, targetYear, targetQuarter);

      const graceInfo = {
        inGracePeriod,
        daysLeft,
        graceDays,
        viewingPrev: viewPrev,
        currentQuarterName: `${quarterNames[currentQuarterIdx]} ${currentYear}`,
        prevQuarterName:    `${quarterNames[prevQuarterIdx]} ${prevYear}`,
        gracePeriodEndDate: gracePeriodEnd.toISOString().split("T")[0],
      };

      res.json({ ...data, graceInfo });
    } catch (error) {
      console.error("Erro metas amanco dtr:", error);
      res.status(500).json({ error: "Erro ao buscar DTR" });
    }
  });

  app.get("/api/metas/amanco/tv", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      let vendedorId = req.userRole === "admin" ? (req.query.vendedor_id as string || req.userEmail) : req.userEmail;
      if (!vendedorId) return res.status(400).json({ error: "Vendedor não identificado" });

      if (req.userRole !== "admin" || (!req.query.vendedor_id && req.userEmail)) {
        vendedorId = await storage.getVendedorIdByEmail(vendedorId);
      }

      const data = await storage.getMetasAmancoTV(vendedorId);
      res.json(data);
    } catch (error) {
      console.error("Erro metas amanco tv:", error);
      res.status(500).json({ error: "Erro ao buscar TV" });
    }
  });

  app.get("/api/metas/elit", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      let vendedorId = req.userRole === "admin" ? (req.query.vendedor_id as string || req.userEmail) : req.userEmail;
      if (!vendedorId) return res.status(400).json({ error: "Vendedor não identificado" });

      if (req.userRole !== "admin" || (!req.query.vendedor_id && req.userEmail)) {
        vendedorId = await storage.getVendedorIdByEmail(vendedorId);
      }

      const data = await storage.getMetasElit(vendedorId);
      res.json(data);
    } catch (error) {
      console.error("Erro metas elit:", error);
      res.status(500).json({ error: "Erro ao buscar metas elit" });
    }
  });

  const isAdminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.userRole !== "admin") {
      return res.status(403).json({ message: "Acesso restrito a administradores" });
    }
    next();
  };

  app.get("/api/users", isAuthenticated, isAdminOnly, async (req: AuthRequest, res) => {
    try {
      const allUsers = db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        modulePermissions: users.modulePermissions,
      }).from(users).all();

      const result = allUsers.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role || "admin",
        modulePermissions: u.modulePermissions ? (() => {
          try { return JSON.parse(u.modulePermissions!); } catch { return null; }
        })() : null,
      }));

      res.json(result);
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      res.status(500).json({ error: "Erro ao listar usuários" });
    }
  });

  app.patch("/api/users/:id/permissions", isAuthenticated, isAdminOnly, async (req: AuthRequest, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const { modulePermissions } = req.body;
      if (!modulePermissions || typeof modulePermissions !== "object" || Array.isArray(modulePermissions)) {
        return res.status(400).json({ error: "Permissões inválidas" });
      }

      const ALLOWED_MODULES = [
        "Dashboard", "Vendedores", "Metas", "Alertas",
        "Visão Semanal", "Visão Mensal", "Visão em Loja", "Campanhas",
      ];

      const sanitized: Record<string, boolean> = {};
      for (const key of ALLOWED_MODULES) {
        if (key in modulePermissions) {
          sanitized[key] = Boolean(modulePermissions[key]);
        }
      }

      db.update(users)
        .set({ modulePermissions: JSON.stringify(sanitized) })
        .where(eq(users.id, userId))
        .run();

      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao atualizar permissões:", error);
      res.status(500).json({ error: "Erro ao atualizar permissões" });
    }
  });

  app.use("/api/campaigns", campaignRoutes);

  // Movimentações por vendedor
  app.get("/api/movimentacoes/:vendedorId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const { vendedorId, startDate, endDate } = req.params;

      // Vendedores only see their own data; admin/supervisor can see any
      if (req.userRole !== "admin" && req.userRole !== "supervisor") {
        // Resolve vendedorId from the authenticated user's email/identity
        const ownId = await storage.getVendedorIdByEmail(req.userEmail || "");
        if (ownId !== vendedorId) {
          return res.status(403).json({ error: "Acesso negado: vendedor pode consultar apenas suas próprias movimentações" });
        }
      }

      const data = await storage.getMovimentacoesPorVendedor(vendedorId, startDate, endDate);
      res.json(data);
    } catch (error) {
      console.error("Erro movimentacoes:", error);
      res.status(500).json({ error: "Erro ao buscar movimentações" });
    }
  });

  return httpServer;
}
