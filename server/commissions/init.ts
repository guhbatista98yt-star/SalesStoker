import { pgRun } from "../pg-client";

export async function initCommissionTables(): Promise<void> {
  const tables = [
    `CREATE TABLE IF NOT EXISTS commission_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      applies_to TEXT NOT NULL DEFAULT 'all',
      config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS commission_records (
      id TEXT PRIMARY KEY,
      salesperson_id TEXT NOT NULL,
      salesperson_name TEXT,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      company_id TEXT NOT NULL DEFAULT 'all',
      net_sales REAL NOT NULL DEFAULT 0,
      eligible_sales REAL NOT NULL DEFAULT 0,
      goal_monthly REAL NOT NULL DEFAULT 0,
      goal_achievement REAL NOT NULL DEFAULT 0,
      weeks_total INTEGER NOT NULL DEFAULT 0,
      weeks_achieved INTEGER NOT NULL DEFAULT 0,
      base_amount REAL NOT NULL DEFAULT 0,
      bonus_amount REAL NOT NULL DEFAULT 0,
      strategic_amount REAL NOT NULL DEFAULT 0,
      deductions REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'projetada',
      calculation TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const sql of tables) {
    try {
      await pgRun(sql);
    } catch {
    }
  }

  const defaultRules = await ensureDefaultRules();
  if (defaultRules) {
    console.log("[Comissões] Regras padrão criadas.");
  }
  console.log("[Comissões] Tabelas inicializadas.");
}

async function ensureDefaultRules(): Promise<boolean> {
  const { pgGet } = await import("../pg-client");
  const existing = await pgGet<{ count: number }>(
    `SELECT COUNT(*) as count FROM commission_rules`
  );
  if ((existing?.count ?? 0) > 0) return false;

  const { randomUUID } = await import("crypto");
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
      `INSERT INTO commission_rules (id, name, description, type, is_active, priority, applies_to, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule.id, rule.name, rule.description, rule.type, rule.is_active, rule.priority, rule.applies_to, rule.config, now, now]
    );
  }
  return true;
}
