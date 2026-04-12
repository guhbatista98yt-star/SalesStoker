import type { Express } from "express";
import { isAuthenticated, isAdmin, type AuthRequest } from "../auth";
import { pgGet, pgAll, pgRun } from "../pg-client";
import { randomUUID } from "crypto";
import { calculateCommission } from "./engine";
import { db } from "../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

function parseIntParam(val: string, name: string): number {
  const n = parseInt(val, 10);
  if (isNaN(n)) throw new Error(`Parâmetro inválido: ${name}`);
  return n;
}

export function registerCommissionRoutes(app: Express) {

  app.get("/api/commissions/rules", isAuthenticated, async (_req, res) => {
    try {
      const rules = await pgAll(`SELECT * FROM commission_rules ORDER BY priority ASC`);
      res.json(rules.map(r => {
        let config = {};
        try { config = JSON.parse(r.config as string); } catch { /* keep empty */ }
        return { ...r, config };
      }));
    } catch (e: any) {
      console.error("[commissions] GET rules error:", e);
      res.status(500).json({ error: "Erro ao buscar regras de comissão" });
    }
  });

  app.post("/api/admin/commissions/rules", isAuthenticated, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { name, description, type, is_active, priority, applies_to, config } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Nome da regra é obrigatório" });
      }
      if (!type || typeof type !== "string") {
        return res.status(400).json({ error: "Tipo da regra é obrigatório" });
      }

      const id = randomUUID();
      const now = new Date().toISOString();
      await pgRun(
        `INSERT INTO commission_rules (id, name, description, type, is_active, priority, applies_to, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name.trim(), description ?? "", type, is_active ? 1 : 0, priority ?? 0, applies_to ?? "all", JSON.stringify(config ?? {}), now, now]
      );
      const created = await pgGet(`SELECT * FROM commission_rules WHERE id = ?`, [id]);
      if (!created) return res.status(500).json({ error: "Falha ao recuperar regra criada" });
      let cfg = {};
      try { cfg = JSON.parse((created as any).config); } catch { /* keep empty */ }
      res.status(201).json({ ...(created as any), config: cfg });
    } catch (e: any) {
      console.error("[commissions] POST rule error:", e);
      res.status(500).json({ error: "Erro ao criar regra de comissão" });
    }
  });

  app.patch("/api/admin/commissions/rules/:id", isAuthenticated, isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { name, description, type, is_active, priority, applies_to, config } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Nome da regra é obrigatório" });
      }
      if (!type || typeof type !== "string") {
        return res.status(400).json({ error: "Tipo da regra é obrigatório" });
      }

      const existing = await pgGet(`SELECT id FROM commission_rules WHERE id = ?`, [id]);
      if (!existing) return res.status(404).json({ error: "Regra não encontrada" });

      const now = new Date().toISOString();
      await pgRun(
        `UPDATE commission_rules SET name=?, description=?, type=?, is_active=?, priority=?, applies_to=?, config=?, updated_at=? WHERE id=?`,
        [name.trim(), description ?? "", type, is_active ? 1 : 0, priority ?? 0, applies_to ?? "all", JSON.stringify(config ?? {}), now, id]
      );
      const updated = await pgGet(`SELECT * FROM commission_rules WHERE id = ?`, [id]);
      let cfg = {};
      try { cfg = JSON.parse((updated as any).config); } catch { /* keep empty */ }
      res.json({ ...(updated as any), config: cfg });
    } catch (e: any) {
      console.error("[commissions] PATCH rule error:", e);
      res.status(500).json({ error: "Erro ao atualizar regra de comissão" });
    }
  });

  app.delete("/api/admin/commissions/rules/:id", isAuthenticated, isAdmin, async (req: AuthRequest, res) => {
    try {
      const existing = await pgGet(`SELECT id FROM commission_rules WHERE id = ?`, [req.params.id]);
      if (!existing) return res.status(404).json({ error: "Regra não encontrada" });
      await pgRun(`DELETE FROM commission_rules WHERE id = ?`, [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[commissions] DELETE rule error:", e);
      res.status(500).json({ error: "Erro ao excluir regra de comissão" });
    }
  });

  app.get("/api/commissions/calculate/:salespersonId/:month/:year", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const month = parseIntParam(req.params.month, "month");
      const year  = parseIntParam(req.params.year, "year");
      if (month < 1 || month > 12) return res.status(400).json({ error: "Mês inválido (1–12)" });
      if (year < 2000 || year > 2100) return res.status(400).json({ error: "Ano inválido" });

      const { salespersonId } = req.params;
      const companyId = typeof req.query.companyId === "string" ? req.query.companyId : "all";

      const sp = await pgGet<{ NOME_VENDEDOR: string }>(
        `SELECT MIN("NOME_VENDEDOR") as "NOME_VENDEDOR" FROM cache_vendas WHERE "IDVENDEDOR" = ? LIMIT 1`,
        [salespersonId]
      );
      const name = sp?.NOME_VENDEDOR ?? salespersonId;

      const result = await calculateCommission(salespersonId, name, month, year, companyId);
      res.json(result);
    } catch (e: any) {
      if (e.message?.startsWith("Parâmetro inválido")) return res.status(400).json({ error: e.message });
      console.error("[commissions] calculate error:", e);
      res.status(500).json({ error: "Erro ao calcular comissão" });
    }
  });

  app.get("/api/commissions/team/:month/:year", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const month = parseIntParam(req.params.month, "month");
      const year  = parseIntParam(req.params.year, "year");
      if (month < 1 || month > 12) return res.status(400).json({ error: "Mês inválido (1–12)" });
      if (year < 2000 || year > 2100) return res.status(400).json({ error: "Ano inválido" });

      const companyId = typeof req.query.companyId === "string" ? req.query.companyId : "all";

      const salespeople = await pgAll<{ id: string; name: string }>(
        `SELECT "IDVENDEDOR" as id, MIN("NOME_VENDEDOR") as name FROM cache_vendas
         WHERE "IDVENDEDOR" IS NOT NULL AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
         GROUP BY "IDVENDEDOR" ORDER BY name`
      );

      const teamMembers = req.teamMembers ?? [];

      let filtered = salespeople;
      if (teamMembers.length > 0) {
        filtered = salespeople.filter(sp =>
          teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase()))
        );
      }

      const results = await Promise.all(
        filtered.map(sp =>
          calculateCommission(sp.id, sp.name, month, year, companyId)
            .catch(err => {
              console.error(`[commissions] team calc error for ${sp.name}:`, err);
              return null;
            })
        )
      );

      res.json(results.filter(Boolean).sort((a: any, b: any) => b.totalAmount - a.totalAmount));
    } catch (e: any) {
      if (e.message?.startsWith("Parâmetro inválido")) return res.status(400).json({ error: e.message });
      console.error("[commissions] team error:", e);
      res.status(500).json({ error: "Erro ao carregar comissões da equipe" });
    }
  });

  app.get("/api/commissions/me/:month/:year", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const month = parseIntParam(req.params.month, "month");
      const year  = parseIntParam(req.params.year, "year");
      if (month < 1 || month > 12) return res.status(400).json({ error: "Mês inválido (1–12)" });
      if (year < 2000 || year > 2100) return res.status(400).json({ error: "Ano inválido" });

      const companyId = typeof req.query.companyId === "string" ? req.query.companyId : "all";

      const firstName = req.userFirstName ?? "";
      if (!firstName) {
        return res.status(404).json({ error: "Perfil de vendedor não vinculado. Contate o administrador." });
      }

      const sp = await pgGet<{ IDVENDEDOR: string; NOME_VENDEDOR: string }>(
        `SELECT "IDVENDEDOR", MIN("NOME_VENDEDOR") as "NOME_VENDEDOR" FROM cache_vendas
         WHERE UPPER("NOME_VENDEDOR") LIKE UPPER(?) GROUP BY "IDVENDEDOR" LIMIT 1`,
        [`%${firstName}%`]
      );

      if (!sp) {
        return res.status(404).json({ error: "Vendedor não encontrado na base de dados" });
      }

      const result = await calculateCommission(sp.IDVENDEDOR, sp.NOME_VENDEDOR, month, year, companyId);
      res.json(result);
    } catch (e: any) {
      if (e.message?.startsWith("Parâmetro inválido")) return res.status(400).json({ error: e.message });
      console.error("[commissions] me error:", e);
      res.status(500).json({ error: "Erro ao carregar sua comissão" });
    }
  });
}
