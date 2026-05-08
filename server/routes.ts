import type { Express, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import type { RankingCriteria } from "@shared/schema";
import { createAuthRouter, isAuthenticated, isAdmin, AuthRequest } from "./auth";
import campaignRoutes from "./campaigns/routes";
import campaignAIRouter from "./campaigns/ai-assistant";
import { initCampaignTables } from "./campaigns/init";
import { initCommissionTables } from "./commissions/init";
import { registerCommissionRoutes } from "./commissions/routes";
import { startAlertEngine } from "./alert-engine";
import { startComprasAlertEngine, startPurchaseAlertEngine } from "./compras/alert-engine";
import comprasRouter from "./compras/routes";
import financeiroRouter from "./routes/financeiro";
import usersAdminRouter from "./routes/users-admin";
import { db } from "./db";
import { pgAll, pgGet, pool } from "./pg-client";
import { users } from "@shared/models/auth";
import { APP_MODULE_LABELS } from "@shared/module-catalog";
import { eq } from "drizzle-orm";

const NO_VENDOR_MATCH = "__NO_VENDOR_MATCH__";

async function resolveGroupTeamMembers(groupId: string, supervisorTeam?: string[]): Promise<string[]> {
  try {
    const memberRows = await pgAll<{ salesperson_id: string }>(
      `SELECT DISTINCT TRIM(CAST(salesperson_id AS TEXT)) as salesperson_id
       FROM vendor_group_members
       WHERE group_id = ? AND TRIM(CAST(salesperson_id AS TEXT)) != ''
       ORDER BY salesperson_id`,
      [groupId]
    );

    const groupIds = memberRows.map(r => String(r.salesperson_id ?? "").trim()).filter(Boolean);
    if (groupIds.length === 0) return [NO_VENDOR_MATCH];
    if (!supervisorTeam || supervisorTeam.length === 0) return groupIds;

    const normalizedSupervisorTeam = supervisorTeam.map(member => String(member ?? "").trim()).filter(Boolean);
    if (normalizedSupervisorTeam.length === 0) return [NO_VENDOR_MATCH];

    const supervisorIdSet = new Set(normalizedSupervisorTeam);
    const directIdMatches = groupIds.filter(id => supervisorIdSet.has(id));
    return directIdMatches.length > 0 ? directIdMatches : [NO_VENDOR_MATCH];
  } catch {
    return [NO_VENDOR_MATCH];
  }
}

function filterGroupsForUser(
  groups: { id: string; name: string; members: string[] }[],
  req: AuthRequest,
): { id: string; name: string; members: string[] }[] {
  if (req.userRole !== "supervisor") return groups;
  const team = new Set((req.teamMembers ?? []).map(member => String(member ?? "").trim()).filter(Boolean));
  if (team.size === 0) return [];
  return groups
    .map(group => ({
      ...group,
      members: (group.members ?? []).map(member => String(member ?? "").trim()).filter(member => team.has(member)),
    }))
    .filter(group => group.members.length > 0);
}

function parseCompanyParam(raw: string | undefined, res: Response): string | null {
  const value = String(raw ?? "").trim();
  if (value === "all") return "all";
  if (/^\d+$/.test(value) && Number(value) > 0) return String(Number(value));
  res.status(400).json({ error: "Empresa invalida" });
  return null;
}

function parseDateRangeParams(
  startRaw: string | undefined,
  endRaw: string | undefined,
  res: Response,
): { startDate: string; endDate: string } | null {
  const startDate = String(startRaw ?? "").trim();
  const endDate = String(endRaw ?? "").trim();
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day;
  };
  if (!validDate(startDate) || !validDate(endDate)) {
    res.status(400).json({ error: "Periodo invalido. Use YYYY-MM-DD." });
    return null;
  }
  if (startDate > endDate) {
    res.status(400).json({ error: "Periodo invalido: data inicial maior que data final." });
    return null;
  }
  return { startDate, endDate };
}

function parseMonthYearParams(monthRaw: string | undefined, yearRaw: string | undefined, res: Response): { month: number; year: number } | null {
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    res.status(400).json({ error: "Mes ou ano invalido" });
    return null;
  }
  return { month, year };
}

function isRankingCriteria(value: string): value is RankingCriteria {
  return value === "maior_valor_vendido"
    || value === "maior_positivacao"
    || value === "maior_mix_produtos"
    || value === "conexoes_sobre_tubos";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await initCampaignTables();
  await initCommissionTables();
  registerCommissionRoutes(app);
  startAlertEngine();
  startComprasAlertEngine();
  startPurchaseAlertEngine();

  app.use("/api/compras", comprasRouter);
  app.use("/api/financeiro/contas-receber", financeiroRouter);
  app.use("/api/admin/financeiro", financeiroRouter);

  app.get("/api/health", async (_req, res) => {
    try {
      await pgGet<{ ok: number }>("SELECT 1 AS ok");
      res.json({
        success: true,
        status: "ok",
        database: "ok",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[health] database check failed:", error);
      res.status(503).json({
        success: false,
        status: "error",
        database: "error",
        message: "Banco de dados indisponível",
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get("/api/system/status", isAuthenticated, isAdmin, async (_req: AuthRequest, res) => {
    try {
      const countTable = async (table: string): Promise<number | null> => {
        const exists = await pgGet<{ exists: boolean }>(
          `SELECT to_regclass($1) IS NOT NULL AS exists`,
          [`public.${table}`],
        );
        if (!exists?.exists) return null;
        const row = await pgGet<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
        return Number(row?.count ?? 0);
      };

      const [vendas, contasReceber, campanhas, estoque, syncRows] = await Promise.all([
        countTable("cache_vendas"),
        countTable("cache_contas_receber"),
        countTable("cache_campanhas"),
        countTable("cache_estoque_sugestao"),
        pgAll<{ routine_name: string; last_success_at: string | null; status: string | null; records_read: number | null; records_written: number | null }>(
          `SELECT routine_name, last_success_at, status, records_read, records_written
           FROM sync_state
           ORDER BY routine_name`
        ).catch(() => []),
      ]);

      res.json({
        success: true,
        status: "ok",
        database: "ok",
        timestamp: new Date().toISOString(),
        counts: {
          cache_vendas: vendas,
          cache_contas_receber: contasReceber,
          cache_campanhas: campanhas,
          cache_estoque_sugestao: estoque,
        },
        sync: syncRows,
      });
    } catch (error) {
      console.error("[system/status] failed:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao consultar status do sistema",
        error_code: "SYSTEM_STATUS_ERROR",
      });
    }
  });

  app.use("/api/auth", createAuthRouter());
  app.use("/api/admin", usersAdminRouter);

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
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      if (!companyId) return;
      const teams = await storage.getTeams(companyId);
      res.json(teams);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar equipes" });
    }
  });

  app.get("/api/salespersons/:companyId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      const period = parseDateRangeParams(req.params.startDate as string, req.params.endDate as string, res);
      if (!companyId || !period) return;
      const showHidden = req.query.showHidden === "true";
      const salespersons = await storage.getSalespersonsWithStats(companyId, period.startDate, period.endDate, req.teamMembers, showHidden);
      res.json(salespersons);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar vendedores" });
    }
  });

  app.get("/api/products/:companyId", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      if (!companyId) return;
      const products = await storage.getProducts(companyId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar produtos" });
    }
  });

  app.get("/api/vendor-groups", isAuthenticated, async (req, res) => {
    try {
      const groups = await storage.getVendorGroups();
      res.json(filterGroupsForUser(groups, req as AuthRequest));
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar grupos de vendedores" });
    }
  });

  app.get("/api/kpis/:companyId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      const period = parseDateRangeParams(req.params.startDate as string, req.params.endDate as string, res);
      if (!companyId || !period) return;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? await resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const kpis = await storage.getKPISummary(companyId, period.startDate, period.endDate, team);
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar KPIs" });
    }
  });

  app.get("/api/rankings/:companyId/:startDate/:endDate/:criteria", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      const period = parseDateRangeParams(req.params.startDate as string, req.params.endDate as string, res);
      if (!companyId || !period) return;
      const criteria = req.params.criteria as string;
      if (!isRankingCriteria(criteria)) {
        return res.status(400).json({ error: "Criterio de ranking invalido" });
      }
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? await resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const rankings = await storage.getRankings(
        companyId,
        period.startDate,
        period.endDate,
        criteria,
        team
      );
      res.json(rankings);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar rankings" });
    }
  });

  app.get("/api/product-mix/:companyId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      const period = parseDateRangeParams(req.params.startDate as string, req.params.endDate as string, res);
      if (!companyId || !period) return;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? await resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const productMix = await storage.getProductMix(companyId, period.startDate, period.endDate, team);
      res.json(productMix);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar mix de produtos" });
    }
  });

  app.get("/api/goals/:companyId/:month/:year", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      const parsed = parseMonthYearParams(req.params.month as string, req.params.year as string, res);
      if (!companyId || !parsed) return;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? await resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const goals = await storage.getGoals(
        companyId,
        parsed.month,
        parsed.year,
        team
      );
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar metas" });
    }
  });

  app.post("/api/goals", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { companyId, salespersonId, type, targetValue, month, year, week } = req.body;
      if (!salespersonId || !type || targetValue === undefined || !month || !year) {
        return res.status(400).json({ error: "Campos obrigatórios: salespersonId, type, targetValue, month, year" });
      }
      if (typeof targetValue !== "number" || targetValue < 0) {
        return res.status(400).json({ error: "targetValue deve ser um número positivo" });
      }
      const goal = await storage.createGoal(req.body);
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: "Erro ao criar meta" });
    }
  });

  app.put("/api/goals/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { targetValue } = req.body;
      if (targetValue !== undefined && (typeof targetValue !== "number" || targetValue < 0)) {
        return res.status(400).json({ error: "targetValue deve ser um número positivo" });
      }
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

  app.get("/api/goals-config/:month/:year", isAuthenticated, isAdmin, async (req: AuthRequest, res) => {
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
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      if (!companyId) return;
      const alerts = await storage.getAlertNotifications(companyId);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar alertas" });
    }
  });

  app.post("/api/alerts/:id/read", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const found = await storage.markAlertRead(req.params.id as string);
      if (!found) return res.status(404).json({ error: "Alerta não encontrado" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao marcar alerta como lido" });
    }
  });

  app.delete("/api/alerts/:id", isAuthenticated, isAdmin, async (req, res) => {
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
      const companyId = parseCompanyParam((req.query.companyId as string) || "all", res);
      if (!companyId) return;
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
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      if (!companyId) return;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? await resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const afaturar = await storage.getAFaturarPorVendedor(companyId, team);
      res.json(afaturar);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar A Faturar por vendedor" });
    }
  });

  app.get("/api/weekly-view/:companyId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      const period = parseDateRangeParams(req.params.startDate as string, req.params.endDate as string, res);
      if (!companyId || !period) return;
      const weeklyData = await storage.getWeeklyView(companyId, period.startDate, period.endDate, req.teamMembers);
      res.json(weeklyData);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar visão semanal" });
    }
  });

  app.get("/api/monthly-view/:companyId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      const period = parseDateRangeParams(req.params.startDate as string, req.params.endDate as string, res);
      if (!companyId || !period) return;
      const monthlyData = await storage.getMonthlyView(companyId, period.startDate, period.endDate, req.teamMembers);
      res.json(monthlyData);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar visão mensal" });
    }
  });

  app.get("/api/afaturar/:companyId", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      if (!companyId) return;
      const afaturar = await storage.getAFaturarPorVendedor(companyId, req.teamMembers);
      res.json(afaturar);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar A Faturar" });
    }
  });

  app.get("/api/sales-evolution/:companyId", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const companyId = parseCompanyParam(req.params.companyId as string, res);
      if (!companyId) return;
      const groupId = req.query.groupId as string | undefined;
      const team = groupId ? await resolveGroupTeamMembers(groupId, req.teamMembers) : req.teamMembers;
      const salesEvolution = await storage.getSalesEvolution(companyId, team);
      res.json(salesEvolution);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar evolução de vendas" });
    }
  });

  // TV Mode Routes
  app.get("/api/tv/dashboard", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      // Restrict TV dashboard to admin, supervisor, gerente, diretor, and loja
      if (req.userRole === "vendedor" || req.userRole === "comprador") {
        return res.status(403).json({ error: "Acesso restrito ao painel de TV" });
      }
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

  app.get("/api/admin/vendor-settings", isAuthenticated, isAdmin, async (req, res) => {
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

  // Vendor visibility management (admin + supervisor)
  app.get("/api/admin/vendor-visibility", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "supervisor" && req.userRole !== "gerente") {
        return res.status(403).json({ error: "Sem permissão" });
      }
      const vendors = await storage.getAllSalespersonsWithVisibility();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar visibilidade dos vendedores" });
    }
  });

  app.patch("/api/admin/vendor-visibility/:vendorId", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "supervisor" && req.userRole !== "gerente") {
        return res.status(403).json({ error: "Sem permissão" });
      }
      const { vendorId } = req.params;
      const { isHidden } = req.body as { isHidden: boolean };
      if (typeof isHidden !== "boolean") return res.status(400).json({ error: "isHidden deve ser boolean" });
      await storage.setVendorHidden(String(vendorId), isHidden);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar visibilidade do vendedor" });
    }
  });

  // TV visibility management
  app.get("/api/admin/vendor-tv-visibility", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "supervisor") {
        return res.status(403).json({ error: "Sem permissão" });
      }
      const vendors = await storage.getVendorsTVSettings();
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar configuração de TV" });
    }
  });

  app.patch("/api/admin/vendor-tv-visibility/:vendorId", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "supervisor") {
        return res.status(403).json({ error: "Sem permissão" });
      }
      const { vendorId } = req.params;
      const { showOnTv } = req.body as { showOnTv: boolean };
      if (typeof showOnTv !== "boolean") return res.status(400).json({ error: "showOnTv deve ser boolean" });
      await storage.setVendorTVVisible(String(vendorId), showOnTv);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao atualizar visibilidade na TV" });
    }
  });

  app.get("/api/app-settings/:key", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      // Only admin/supervisor can read arbitrary settings; other roles only get whitelisted keys
      const key = String(req.params.key);
      const PUBLIC_KEYS = [
        "dtrGracePeriodDays",
        "showAcompanhamentoTab",
        "showDtrAmancoTab",
        "showTvAmancoTab",
        "showTintasElitTab",
        "dtrAmancoLogoUrl",
        "tvAmancoLogoUrl",
        "tintasElitLogoUrl",
        "visao_loja_config",
      ];
      if (req.userRole !== "admin" && req.userRole !== "supervisor" && !PUBLIC_KEYS.includes(key)) {
        return res.status(403).json({ error: "Sem permissão para acessar esta configuração" });
      }
      const value = await storage.getAppSetting(key);
      res.json({ key, value });
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
      const data = await storage.getCampaignReport(campaignName);
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
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        modulePermissions: users.modulePermissions,
      }).from(users);

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
      const userId = parseInt(String(req.params.id), 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const { modulePermissions } = req.body;
      if (!modulePermissions || typeof modulePermissions !== "object" || Array.isArray(modulePermissions)) {
        return res.status(400).json({ error: "Permissões inválidas" });
      }

      const sanitized: Record<string, boolean> = {};
      for (const key of APP_MODULE_LABELS) {
        if (key in modulePermissions) {
          sanitized[key] = Boolean(modulePermissions[key]);
        }
      }

      await db.update(users)
        .set({ modulePermissions: JSON.stringify(sanitized) })
        .where(eq(users.id, userId));

      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao atualizar permissões:", error);
      res.status(500).json({ error: "Erro ao atualizar permissões" });
    }
  });

  // ── Sync & Bootstrap Status ────────────────────────────────────────────────
  app.get("/api/sync/status", isAuthenticated, async (_req, res) => {
    try {
      const [syncState, bootstrapStatus, bootstrapMeses] = await Promise.all([
        pgAll(
          "SELECT routine_name, status, last_success_at, last_dt_movimento, " +
          "records_read, records_written, last_error, updated_at " +
          "FROM sync_state ORDER BY routine_name"
        ),
        pgAll(
          "SELECT routine_name, status, data_inicio, data_fim, total_meses, " +
          "meses_ok, total_records, started_at, finished_at, error_msg, updated_at " +
          "FROM bootstrap_status ORDER BY routine_name"
        ),
        pgAll(
          "SELECT routine_name, periodo_inicio, periodo_fim, status, " +
          "records_written, started_at, finished_at, error_msg " +
          "FROM bootstrap_historico ORDER BY routine_name, periodo_inicio"
        ),
      ]);
      res.json({ syncState, bootstrapStatus, bootstrapMeses });
    } catch (error) {
      console.error("Erro ao buscar status de sync:", error);
      res.status(500).json({ error: "Erro ao buscar status de sync" });
    }
  });

  // ── Sync / Bootstrap helpers ──────────────────────────────────────────────
  function spawnPyBackground(scriptPath: string, args: string[], logTag: string): string {
    const logDir = path.join(process.cwd(), "sync", "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, `${logTag}_${Date.now()}.log`);
    const fd = fs.openSync(logFile, "w");
    const child = spawn("py", [scriptPath, ...args], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", fd, fd],
      env: process.env,
      windowsHide: true,
    });
    child.on("error", (err) => {
      // py not found — fallback to python
      const child2 = spawn("python", [scriptPath, ...args], {
        cwd: process.cwd(),
        detached: true,
        stdio: ["ignore", fd, fd],
        env: process.env,
        windowsHide: true,
      });
      child2.unref();
    });
    child.unref();
    return logFile;
  }

  // ── Sync Trigger ──────────────────────────────────────────────────────────
  const VALID_SYNC_ROTINAS = new Set([
    "vendas", "campanhas", "tubos", "pendentes",
    "estoque_sugestao", "contas_receber", "sync_config", "all",
  ]);

  app.post("/api/sync/trigger", isAuthenticated, async (req: AuthRequest, res) => {
    if (req.userRole !== "admin") return res.status(403).json({ error: "Apenas administradores podem disparar sync" });
    const rotina = String(req.body?.rotina ?? "all").trim();
    if (!VALID_SYNC_ROTINAS.has(rotina)) return res.status(400).json({ error: "Rotina inválida" });
    const scriptPath = path.join(process.cwd(), "sync", "erp_sync.py");
    const logFile = spawnPyBackground(scriptPath, [rotina], `sync_${rotina}`);
    res.json({ success: true, rotina, logFile, message: `Sync '${rotina}' iniciado em background` });
  });

  // ── Sync Reload (reset watermark + re-sync last 1 year) ───────────────────
  const RELOAD_TABLE_MAP: Record<string, string> = {
    tubos: "cache_tubos_conexoes",
    vendas: "cache_vendas",
    campanhas: "cache_campanhas",
  };
  const RELOAD_DATE_COL: Record<string, string> = {
    tubos: "DT_MOVIMENTO",
    vendas: "DT_MOVIMENTO",
    campanhas: "DTMOVIMENTO",
  };

  app.post("/api/sync/reload", isAuthenticated, async (req: AuthRequest, res) => {
    if (req.userRole !== "admin") return res.status(403).json({ error: "Apenas administradores podem recarregar sync" });
    const rotina = String(req.body?.rotina ?? "").trim();
    if (!RELOAD_TABLE_MAP[rotina]) return res.status(400).json({ error: "Rotina não suportada para reload" });

    const table = RELOAD_TABLE_MAP[rotina];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneYearAgo.setDate(1); // primeiro dia do mês
    const dateStr = oneYearAgo.toISOString().split("T")[0];

    const dateCol = RELOAD_DATE_COL[rotina];
    // Clear watermark, lock, and recent rows so next sync fetches fresh with FABRICANTE
    await pool.query("DELETE FROM sync_state WHERE routine_name = $1", [table]);
    await pool.query("DELETE FROM job_locks WHERE routine_name = $1", [table]);
    await pool.query(`DELETE FROM ${table} WHERE "${dateCol}" >= $1`, [dateStr]);

    const scriptPath = path.join(process.cwd(), "sync", "erp_sync.py");
    const logFile = spawnPyBackground(scriptPath, [rotina, "--force"], `sync_reload_${rotina}`);
    res.json({ success: true, rotina, logFile, message: `Reload de '${rotina}' iniciado — último 1 ano será re-sincronizado` });
  });

  // ── Bootstrap Trigger ─────────────────────────────────────────────────────
  const VALID_BOOTSTRAP_ROTINAS = new Set(["vendas", "campanhas", "tubos", "all"]);

  app.post("/api/sync/bootstrap", isAuthenticated, async (req: AuthRequest, res) => {
    if (req.userRole !== "admin") return res.status(403).json({ error: "Apenas administradores podem disparar bootstrap" });
    const rotina = String(req.body?.rotina ?? "all").trim();
    const force = Boolean(req.body?.force ?? true);
    if (!VALID_BOOTSTRAP_ROTINAS.has(rotina)) return res.status(400).json({ error: "Rotina inválida" });
    const scriptPath = path.join(process.cwd(), "sync", "bootstrap_historico.py");
    const args = rotina === "all" ? (force ? ["--force"] : []) : ["--rotina", rotina, ...(force ? ["--force"] : [])];
    const logFile = spawnPyBackground(scriptPath, args, `bootstrap_${rotina}`);
    res.json({ success: true, rotina, force, logFile, message: `Bootstrap '${rotina}' iniciado em background` });
  });

  // ── Sync Log Reader ────────────────────────────────────────────────────────
  app.get("/api/sync/log/:filename", isAuthenticated, (req: AuthRequest, res) => {
    if (req.userRole !== "admin") return res.status(403).json({ error: "Acesso negado" });
    const filename = path.basename(String(req.params.filename)); // sanitize: no path traversal
    const logPath = path.join(process.cwd(), "sync", "logs", filename);
    if (!fs.existsSync(logPath)) return res.status(404).json({ error: "Log não encontrado" });
    const content = fs.readFileSync(logPath, "utf-8");
    res.json({ filename, content: content.slice(-8000) }); // last 8KB
  });

  app.use("/api/campaigns", campaignRoutes);
  app.use("/api/campaigns-ai", campaignAIRouter);

  // Movimentações por vendedor
  app.get("/api/movimentacoes/:vendedorId/:startDate/:endDate", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const vendedorId = String(req.params.vendedorId ?? "").trim();
      const startDate = String(req.params.startDate);
      const endDate = String(req.params.endDate);

      // Vendedores only see their own data; admin/supervisor can see any
      if (req.userRole !== "admin" && req.userRole !== "supervisor") {
        // Resolve vendedorId from the authenticated user's email/identity
        const ownId = String(await storage.getVendedorIdByEmail(req.userEmail || "")).trim();
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
