import type { Express } from "express";
import { isAuthenticated, isAdmin, type AuthRequest } from "../auth";
import { pgGet, pgAll, pgRun } from "../pg-client";
import { randomUUID } from "crypto";
import { calculateCommission } from "./engine";

export function registerCommissionRoutes(app: Express) {

  app.get("/api/commissions/rules", isAuthenticated, async (_req, res) => {
    try {
      const rules = await pgAll(`SELECT * FROM commission_rules ORDER BY priority ASC`);
      res.json(rules.map(r => ({ ...r, config: JSON.parse(r.config as string) })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/commissions/rules", isAdmin, async (req: AuthRequest, res) => {
    try {
      const { name, description, type, is_active, priority, applies_to, config } = req.body;
      const id = randomUUID();
      const now = new Date().toISOString();
      await pgRun(
        `INSERT INTO commission_rules (id, name, description, type, is_active, priority, applies_to, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, description ?? "", type, is_active ? 1 : 0, priority ?? 0, applies_to ?? "all", JSON.stringify(config ?? {}), now, now]
      );
      const created = await pgGet(`SELECT * FROM commission_rules WHERE id = ?`, [id]);
      res.json({ ...(created as any), config: JSON.parse((created as any).config) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/admin/commissions/rules/:id", isAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { name, description, type, is_active, priority, applies_to, config } = req.body;
      const now = new Date().toISOString();
      await pgRun(
        `UPDATE commission_rules SET name=?, description=?, type=?, is_active=?, priority=?, applies_to=?, config=?, updated_at=? WHERE id=?`,
        [name, description ?? "", type, is_active ? 1 : 0, priority ?? 0, applies_to ?? "all", JSON.stringify(config ?? {}), now, id]
      );
      const updated = await pgGet(`SELECT * FROM commission_rules WHERE id = ?`, [id]);
      res.json({ ...(updated as any), config: JSON.parse((updated as any).config) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/admin/commissions/rules/:id", isAdmin, async (req: AuthRequest, res) => {
    try {
      await pgRun(`DELETE FROM commission_rules WHERE id = ?`, [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/commissions/calculate/:salespersonId/:month/:year", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const { salespersonId, month, year } = req.params;
      const companyId = (req.query.companyId as string) ?? "all";

      const sp = await pgGet<{ NOME_VENDEDOR: string }>(
        `SELECT MIN("NOME_VENDEDOR") as "NOME_VENDEDOR" FROM cache_vendas WHERE "IDVENDEDOR" = ? LIMIT 1`,
        [salespersonId]
      );
      const name = sp?.NOME_VENDEDOR ?? salespersonId;

      const result = await calculateCommission(
        salespersonId,
        name,
        parseInt(month),
        parseInt(year),
        companyId
      );
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/commissions/team/:month/:year", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const { month, year } = req.params;
      const companyId = (req.query.companyId as string) ?? "all";

      const salespeople = await pgAll<{ id: string; name: string }>(
        `SELECT "IDVENDEDOR" as id, MIN("NOME_VENDEDOR") as name FROM cache_vendas
         WHERE "IDVENDEDOR" IS NOT NULL AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
         GROUP BY "IDVENDEDOR" ORDER BY name`
      );

      const teamMembers: string[] = req.user?.teamMembers
        ? req.user.teamMembers.split(",").map((s: string) => s.trim()).filter(Boolean)
        : [];

      let filtered = salespeople;
      if (teamMembers.length > 0) {
        filtered = salespeople.filter(sp =>
          teamMembers.some(tm => sp.name.toUpperCase().includes(tm.toUpperCase()))
        );
      }

      const results = await Promise.all(
        filtered.map(sp =>
          calculateCommission(sp.id, sp.name, parseInt(month), parseInt(year), companyId)
            .catch(() => null)
        )
      );

      res.json(results.filter(Boolean).sort((a: any, b: any) => b.totalAmount - a.totalAmount));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/commissions/me/:month/:year", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const { month, year } = req.params;
      const user = req.user!;
      const companyId = (req.query.companyId as string) ?? "all";

      const firstName = user.firstName ?? "";
      const lastName = user.lastName ?? "";
      const fullName = `${firstName} ${lastName}`.trim();

      const sp = await pgGet<{ IDVENDEDOR: string; NOME_VENDEDOR: string }>(
        `SELECT "IDVENDEDOR", MIN("NOME_VENDEDOR") as "NOME_VENDEDOR" FROM cache_vendas
         WHERE UPPER("NOME_VENDEDOR") LIKE UPPER(?) GROUP BY "IDVENDEDOR" LIMIT 1`,
        [`%${firstName}%`]
      );

      if (!sp) {
        return res.status(404).json({ error: "Vendedor não encontrado na base de dados" });
      }

      const result = await calculateCommission(
        sp.IDVENDEDOR,
        sp.NOME_VENDEDOR,
        parseInt(month),
        parseInt(year),
        companyId
      );
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
