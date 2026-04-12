/**
 * Commission module initializer.
 *
 * Table creation is handled by schema-bootstrap.ts.
 * This module only seeds default rules if the table is empty.
 */

import { pgGet, pgRun } from "../pg-client";
import { randomUUID } from "crypto";

export async function initCommissionTables(): Promise<void> {
  const seeded = await ensureDefaultRules();
  if (seeded) {
    console.log("[Comissões] Regras padrão criadas.");
  }
  console.log("[Comissões] Módulo inicializado.");
}

async function ensureDefaultRules(): Promise<boolean> {
  const existing = await pgGet<{ count: string }>(
    `SELECT COUNT(*) AS count FROM commission_rules`,
  );
  if (parseInt(existing?.count ?? "0", 10) > 0) return false;

  const now = new Date().toISOString();

  const defaults = [
    {
      id: randomUUID(),
      name: "Comissão Base Mensal",
      description: "Percentual sobre vendas líquidas conforme faixa de atingimento da meta mensal",
      type: "base_monthly",
      is_active: 1,
      priority: 10,
      applies_to: "all",
      config: JSON.stringify({
        thresholds: [
          { from: 0,   to: 84.99,  rate: 0 },
          { from: 85,  to: 94.99,  rate: 0.35 },
          { from: 95,  to: 99.99,  rate: 0.60 },
          { from: 100, to: 109.99, rate: 1.00 },
          { from: 110, to: 119.99, rate: 1.20 },
          { from: 120, to: 9999,   rate: 1.50 },
        ],
      }),
    },
    {
      id: randomUUID(),
      name: "Bônus por Semana Batida",
      description: "Adicional sobre vendas líquidas para cada semana em que a meta foi atingida",
      type: "weekly_bonus",
      is_active: 1,
      priority: 20,
      applies_to: "all",
      config: JSON.stringify({ rate: 0.05 }),
    },
    {
      id: randomUUID(),
      name: "Bônus Todas as Semanas",
      description: "Adicional extra quando o vendedor bate todas as semanas do mês",
      type: "weekly_all_bonus",
      is_active: 1,
      priority: 21,
      applies_to: "all",
      config: JSON.stringify({ rate: 0.15 }),
    },
  ];

  for (const rule of defaults) {
    await pgRun(
      `INSERT INTO commission_rules
         (id, name, description, type, is_active, priority, applies_to, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.id, rule.name, rule.description, rule.type,
        rule.is_active, rule.priority, rule.applies_to, rule.config,
        now, now,
      ],
    );
  }
  return true;
}
