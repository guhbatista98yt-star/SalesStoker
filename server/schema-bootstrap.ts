/**
 * CONECTUBOS — PostgreSQL Schema Bootstrap
 *
 * Single source of truth for ALL database structure.
 * Runs on every app startup — fully idempotent, never destructive.
 *
 * Guarantees the application can start from zero in any environment.
 *
 * Tables covered:
 *   Application:  users, goals, goal_settings, alert_notifications,
 *                 alert_configs, vendor_display_settings, vendor_groups,
 *                 vendor_group_members, app_settings
 *   Campaigns:    campaigns, campaign_audit_logs, campaign_versions,
 *                 campaign_simulations, campaign_results, campaign_result_details,
 *                 campaign_goals
 *   Commissions:  commission_rules, commission_records
 *   Sync control: sync_state, sync_logs, job_locks
 *   Cache (ERP):  cache_vendas, cache_campanhas, cache_vendas_pendentes,
 *                 cache_tubos_conexoes
 */

import { pool } from "./pg-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function exec(sql: string): Promise<void> {
  await pool.query(sql);
}

async function addColumnIfMissing(
  table: string,
  column: string,
  definition: string,
): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );
  if (res.rowCount === 0) {
    await pool.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`,
    );
    return true;
  }
  return false;
}

async function tableExists(name: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [name],
  );
  return (res.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Application tables
// ---------------------------------------------------------------------------

async function bootstrapUsers(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password      TEXT NOT NULL,
      first_name    TEXT,
      last_name     TEXT,
      role          TEXT NOT NULL DEFAULT 'admin',
      team_members  TEXT,
      module_permissions TEXT,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email))`);
}

async function bootstrapGoals(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id              TEXT PRIMARY KEY,
      "companyId"     TEXT NOT NULL DEFAULT 'all',
      "salespersonId" TEXT NOT NULL,
      type            TEXT NOT NULL,
      "targetValue"   REAL NOT NULL DEFAULT 0,
      month           INTEGER NOT NULL,
      year            INTEGER NOT NULL,
      week            INTEGER,
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_goals_period
    ON goals (year, month, "companyId")`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_goals_salesperson
    ON goals ("salespersonId", year, month)`);
}

async function bootstrapGoalSettings(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS goal_settings (
      id              TEXT PRIMARY KEY,
      "salespersonId" TEXT NOT NULL,
      type            TEXT NOT NULL,
      mode            TEXT NOT NULL DEFAULT 'manual',
      month           INTEGER NOT NULL,
      year            INTEGER NOT NULL,
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_settings_unique
    ON goal_settings ("salespersonId", type, month, year)`);
}

async function bootstrapAlerts(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS alert_configs (
      id          TEXT PRIMARY KEY,
      "companyId" TEXT NOT NULL DEFAULT 'all',
      type        TEXT NOT NULL,
      threshold   REAL NOT NULL DEFAULT 0,
      enabled     INTEGER NOT NULL DEFAULT 1,
      message     TEXT,
      severity    TEXT NOT NULL DEFAULT 'warning',
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_alert_configs_company
    ON alert_configs ("companyId")`);

  await exec(`
    CREATE TABLE IF NOT EXISTS alert_notifications (
      id             TEXT PRIMARY KEY,
      "alertId"      TEXT NOT NULL,
      "companyId"    TEXT NOT NULL DEFAULT 'all',
      "triggeredAt"  TEXT NOT NULL,
      message        TEXT NOT NULL,
      severity       TEXT NOT NULL DEFAULT 'warning',
      read           INTEGER NOT NULL DEFAULT 0,
      data           TEXT NOT NULL DEFAULT '{}',
      created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_alert_notifications_company
    ON alert_notifications ("companyId", "triggeredAt" DESC)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert
    ON alert_notifications ("alertId", "companyId")`);
}

async function bootstrapVendorSettings(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS vendor_display_settings (
      id            TEXT PRIMARY KEY,
      "vendorId"    TEXT NOT NULL UNIQUE,
      "displayCode" TEXT,
      "displayName" TEXT,
      "isHidden"    INTEGER NOT NULL DEFAULT 0,
      "companyId"   TEXT NOT NULL DEFAULT 'all',
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_vendor_display_company
    ON vendor_display_settings ("companyId")`);
}

async function bootstrapVendorGroups(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS vendor_groups (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`
    CREATE TABLE IF NOT EXISTS vendor_group_members (
      group_id        TEXT NOT NULL REFERENCES vendor_groups(id) ON DELETE CASCADE,
      salesperson_id  TEXT NOT NULL,
      PRIMARY KEY (group_id, salesperson_id)
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_vgm_salesperson
    ON vendor_group_members (salesperson_id)`);
}

async function bootstrapAppSettings(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// ---------------------------------------------------------------------------
// Campaign tables
// ---------------------------------------------------------------------------

async function bootstrapCampaigns(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id               TEXT PRIMARY KEY,
      code             TEXT NOT NULL UNIQUE,
      name             TEXT NOT NULL,
      description      TEXT,
      objective        TEXT,
      supplier_name    TEXT,
      logo_url         TEXT,
      brand_color      TEXT,
      campaign_type    TEXT NOT NULL DEFAULT 'padrao',
      campaign_mode    TEXT NOT NULL DEFAULT 'atingimento',
      sub_type         TEXT,
      status           TEXT NOT NULL DEFAULT 'rascunho',
      priority         INTEGER NOT NULL DEFAULT 50,
      is_cumulative    INTEGER NOT NULL DEFAULT 1,
      is_exclusive     INTEGER NOT NULL DEFAULT 0,
      parent_id        TEXT,
      current_version  INTEGER NOT NULL DEFAULT 1,
      starts_at        TEXT NOT NULL,
      ends_at          TEXT NOT NULL,
      time_start       TEXT,
      time_end         TEXT,
      valid_weekdays   TEXT NOT NULL DEFAULT '[]',
      recurrence       TEXT,
      targets          TEXT NOT NULL DEFAULT '{}',
      bases            TEXT NOT NULL DEFAULT '{}',
      conditions       TEXT NOT NULL DEFAULT '{}',
      triggers         TEXT NOT NULL DEFAULT '[]',
      rewards          TEXT NOT NULL DEFAULT '{}',
      limits           TEXT NOT NULL DEFAULT '{}',
      exceptions       TEXT NOT NULL DEFAULT '[]',
      natural_language TEXT,
      internal_notes   TEXT,
      created_by       TEXT NOT NULL,
      updated_by       TEXT,
      change_reason    TEXT,
      created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_campaigns_status
    ON campaigns (status)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_campaigns_dates
    ON campaigns (starts_at, ends_at)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_campaigns_type
    ON campaigns (campaign_type, status)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS campaign_audit_logs (
      id            TEXT PRIMARY KEY,
      campaign_id   TEXT NOT NULL,
      action        TEXT NOT NULL,
      actor         TEXT NOT NULL,
      prev_values   TEXT,
      new_values    TEXT,
      change_reason TEXT,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_campaign_audit_campaign
    ON campaign_audit_logs (campaign_id, created_at DESC)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS campaign_versions (
      id            TEXT PRIMARY KEY,
      campaign_id   TEXT NOT NULL,
      version       INTEGER NOT NULL,
      snapshot      TEXT NOT NULL,
      created_by    TEXT NOT NULL,
      change_reason TEXT,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_versions_unique
    ON campaign_versions (campaign_id, version)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS campaign_simulations (
      id          TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      input_data  TEXT NOT NULL DEFAULT '{}',
      result      TEXT NOT NULL DEFAULT '{}',
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_campaign_simulations_campaign
    ON campaign_simulations (campaign_id, created_at DESC)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS campaign_results (
      id                    TEXT PRIMARY KEY,
      campaign_id           TEXT NOT NULL,
      apurado_em            TEXT NOT NULL,
      apurado_por           TEXT NOT NULL,
      periodo_inicio        TEXT NOT NULL,
      periodo_fim           TEXT NOT NULL,
      campaign_mode         TEXT NOT NULL DEFAULT 'atingimento',
      total_elegiveis       INTEGER NOT NULL DEFAULT 0,
      total_participantes   INTEGER NOT NULL DEFAULT 0,
      total_atingidos       INTEGER NOT NULL DEFAULT 0,
      total_premiados       INTEGER NOT NULL DEFAULT 0,
      valor_total_apuracao  REAL NOT NULL DEFAULT 0,
      valor_total_pagamento REAL NOT NULL DEFAULT 0,
      valor_total_premio    REAL NOT NULL DEFAULT 0,
      summary               TEXT NOT NULL DEFAULT '{}',
      created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_campaign_results_campaign
    ON campaign_results (campaign_id, apurado_em DESC)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS campaign_result_details (
      id                       TEXT PRIMARY KEY,
      result_id                TEXT NOT NULL,
      campaign_id              TEXT NOT NULL,
      vendedor_id              TEXT NOT NULL,
      vendedor_nome            TEXT,
      elegivel                 INTEGER NOT NULL DEFAULT 0,
      participou               INTEGER NOT NULL DEFAULT 0,
      gatilho_atingido         INTEGER NOT NULL DEFAULT 0,
      atingiu                  INTEGER NOT NULL DEFAULT 0,
      premiado                 INTEGER NOT NULL DEFAULT 0,
      posicao                  INTEGER,
      valor_apuracao           REAL NOT NULL DEFAULT 0,
      valor_pagamento          REAL NOT NULL DEFAULT 0,
      qtd_total                REAL NOT NULL DEFAULT 0,
      mix_count                INTEGER NOT NULL DEFAULT 0,
      gatilho_valor            REAL NOT NULL DEFAULT 0,
      premio_calculado         REAL NOT NULL DEFAULT 0,
      premio_final             REAL NOT NULL DEFAULT 0,
      motivos_nao_participacao TEXT NOT NULL DEFAULT '[]',
      memoria_calculo          TEXT NOT NULL DEFAULT '{}',
      created_at               TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_crd_result
    ON campaign_result_details (result_id)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_crd_campaign_vendor
    ON campaign_result_details (campaign_id, vendedor_id)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS campaign_goals (
      id              TEXT PRIMARY KEY,
      "salespersonId" TEXT NOT NULL,
      "campaignName"  TEXT NOT NULL,
      year            INTEGER NOT NULL,
      "triggerValue"  REAL NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_goals_unique
    ON campaign_goals ("salespersonId", "campaignName", year)`);
}

// ---------------------------------------------------------------------------
// Commission tables
// ---------------------------------------------------------------------------

async function bootstrapCommissions(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS commission_rules (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      description TEXT,
      type       TEXT NOT NULL,
      is_active  INTEGER NOT NULL DEFAULT 1,
      priority   INTEGER NOT NULL DEFAULT 0,
      applies_to TEXT NOT NULL DEFAULT 'all',
      config     TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_commission_rules_active
    ON commission_rules (is_active, priority)`);

  await exec(`
    CREATE TABLE IF NOT EXISTS commission_records (
      id               TEXT PRIMARY KEY,
      salesperson_id   TEXT NOT NULL,
      salesperson_name TEXT,
      month            INTEGER NOT NULL,
      year             INTEGER NOT NULL,
      company_id       TEXT NOT NULL DEFAULT 'all',
      net_sales        REAL NOT NULL DEFAULT 0,
      eligible_sales   REAL NOT NULL DEFAULT 0,
      goal_monthly     REAL NOT NULL DEFAULT 0,
      goal_achievement REAL NOT NULL DEFAULT 0,
      weeks_total      INTEGER NOT NULL DEFAULT 0,
      weeks_achieved   INTEGER NOT NULL DEFAULT 0,
      base_amount      REAL NOT NULL DEFAULT 0,
      bonus_amount     REAL NOT NULL DEFAULT 0,
      strategic_amount REAL NOT NULL DEFAULT 0,
      deductions       REAL NOT NULL DEFAULT 0,
      total_amount     REAL NOT NULL DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'projetada',
      calculation      TEXT NOT NULL DEFAULT '{}',
      created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_commission_records_period
    ON commission_records (year, month, salesperson_id)`);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_records_unique
    ON commission_records (salesperson_id, month, year, company_id)`);
}

// ---------------------------------------------------------------------------
// Sync control tables  (used by the external Python ERP sync process)
// ---------------------------------------------------------------------------

async function bootstrapSyncControl(): Promise<void> {
  // Tracks the state of each sync routine (watermark, last run, counters)
  await exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      routine_name      TEXT PRIMARY KEY,
      last_success_at   TIMESTAMPTZ,
      last_watermark    TEXT,
      last_dt_movimento DATE,
      status            TEXT NOT NULL DEFAULT 'idle',
      last_error        TEXT,
      records_read      INTEGER NOT NULL DEFAULT 0,
      records_written   INTEGER NOT NULL DEFAULT 0,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Append-only log of every sync run
  await exec(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id            SERIAL PRIMARY KEY,
      routine_name  TEXT NOT NULL,
      started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at      TIMESTAMPTZ,
      duration_ms   INTEGER,
      parameters    JSONB NOT NULL DEFAULT '{}',
      records_read  INTEGER NOT NULL DEFAULT 0,
      records_written INTEGER NOT NULL DEFAULT 0,
      success       BOOLEAN NOT NULL DEFAULT FALSE,
      message       TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_sync_logs_routine
    ON sync_logs (routine_name, started_at DESC)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_sync_logs_started
    ON sync_logs (started_at DESC)`);

  // Advisory lock: prevents two instances of the same routine running at once
  await exec(`
    CREATE TABLE IF NOT EXISTS job_locks (
      routine_name TEXT PRIMARY KEY,
      locked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_by    TEXT NOT NULL,
      expires_at   TIMESTAMPTZ NOT NULL
    )
  `);
}

// ---------------------------------------------------------------------------
// Cache tables  (written by the Python ERP sync, read by this app)
// Columns use UPPERCASE names to match the ERP source schema 1-to-1.
// The CREATE TABLE is intentionally minimal — the sync script may add more.
// ---------------------------------------------------------------------------

async function bootstrapCacheTables(): Promise<void> {
  // Main sales cache — most queried table in the application
  await exec(`
    CREATE TABLE IF NOT EXISTS cache_vendas (
      "IDVENDEDOR"      TEXT,
      "NOME_VENDEDOR"   TEXT,
      "IDEMPRESA"       INTEGER,
      "IDPLANILHA"      TEXT,
      "DT_MOVIMENTO"    DATE,
      "TOTALVENDA_LINHA" NUMERIC(18,2) NOT NULL DEFAULT 0,
      synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // These three indexes cover 90%+ of queries against cache_vendas
  await exec(`CREATE INDEX IF NOT EXISTS idx_cv_dt_empresa
    ON cache_vendas ("DT_MOVIMENTO", "IDEMPRESA")`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_cv_vendedor_dt
    ON cache_vendas ("IDVENDEDOR", "DT_MOVIMENTO")`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_cv_empresa
    ON cache_vendas ("IDEMPRESA")`);

  // Pending sales (orders not yet invoiced)
  await exec(`
    CREATE TABLE IF NOT EXISTS cache_vendas_pendentes (
      "NOME_VENDEDOR"    TEXT,
      "IDEMPRESA"        INTEGER,
      "TOTALVENDA_LINHA" NUMERIC(18,2) NOT NULL DEFAULT 0,
      synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_cvp_empresa
    ON cache_vendas_pendentes ("IDEMPRESA")`);

  // Campaign product-level sales cache
  await exec(`
    CREATE TABLE IF NOT EXISTS cache_campanhas (
      "IDVENDEDOR"   TEXT,
      "NOMEVENDEDOR" TEXT,
      "IDPRODUTO"    TEXT,
      "FABRICANTE"   TEXT,
      "VALOR_LIQUIDO" NUMERIC(18,2) NOT NULL DEFAULT 0,
      "QTD"          NUMERIC(18,4) NOT NULL DEFAULT 0,
      "DTMOVIMENTO"  DATE,
      synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_cc_dt
    ON cache_campanhas ("DTMOVIMENTO")`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_cc_vendedor_dt
    ON cache_campanhas ("IDVENDEDOR", "DTMOVIMENTO")`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_cc_fabricante
    ON cache_campanhas ("FABRICANTE", "DTMOVIMENTO")`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_cc_produto
    ON cache_campanhas ("IDPRODUTO", "DTMOVIMENTO")`);

  // Tubes & connections product category cache
  await exec(`
    CREATE TABLE IF NOT EXISTS cache_tubos_conexoes (
      "IDVENDEDOR"       TEXT,
      "NOME_VENDEDOR"    TEXT,
      "IDEMPRESA"        INTEGER,
      "DT_MOVIMENTO"     DATE,
      "TOTALVENDA_LINHA" NUMERIC(18,2) NOT NULL DEFAULT 0,
      synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_ctc_vendedor_dt
    ON cache_tubos_conexoes ("IDVENDEDOR", "DT_MOVIMENTO")`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_ctc_empresa_dt
    ON cache_tubos_conexoes ("IDEMPRESA", "DT_MOVIMENTO")`);
}

// ---------------------------------------------------------------------------
// Runtime column additions  (backwards-compatible additions to existing tables)
// ---------------------------------------------------------------------------

async function applyRuntimeMigrations(added: string[]): Promise<void> {
  const migrations: [string, string, string][] = [
    // [table, column, definition]
    ["campaigns", "campaign_mode",  "TEXT NOT NULL DEFAULT 'atingimento'"],
    ["campaigns", "bases",          "TEXT NOT NULL DEFAULT '{}'"],
    ["campaigns", "supplier_name",  "TEXT"],
    ["campaigns", "logo_url",       "TEXT"],
    ["campaigns", "brand_color",    "TEXT"],
    ["goals",     "created_at",     "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"],
    ["goals",     "updated_at",     "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"],
    // Users — extended profile & governance fields
    ["users", "display_name",   "TEXT"],
    ["users", "vendor_code",    "TEXT"],
    ["users", "phone",          "TEXT"],
    ["users", "cargo",          "TEXT"],
    ["users", "company_id",     "TEXT"],
    ["users", "supervisor_id",  "INTEGER"],
    ["users", "status",         "TEXT NOT NULL DEFAULT 'ativo'"],
    ["users", "last_login_at",  "TEXT"],
    ["users", "notes",          "TEXT"],
    ["users", "created_by",     "INTEGER"],
  ];

  for (const [table, col, def] of migrations) {
    const did = await addColumnIfMissing(table, col, def);
    if (did) added.push(`${table}.${col}`);
  }
}

// ---------------------------------------------------------------------------
// Roles & Permissions tables
// ---------------------------------------------------------------------------

async function bootstrapRoles(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL UNIQUE,
      display_name  TEXT NOT NULL,
      description   TEXT,
      is_system     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_roles_name ON roles (name)`);

  const SYSTEM_ROLES = [
    { name: "admin",       display_name: "Administrador",      description: "Acesso total ao sistema",           is_system: true  },
    { name: "supervisor",  display_name: "Supervisor",         description: "Gerencia equipes e resultados",     is_system: true  },
    { name: "gerente",     display_name: "Gerente de Loja",    description: "Visão de loja e equipe",            is_system: true  },
    { name: "vendedor",    display_name: "Vendedor",           description: "Acesso a dados próprios",           is_system: true  },
    { name: "loja",        display_name: "Display de Loja",    description: "Exibição em televisão/monitor",     is_system: true  },
    { name: "financeiro",  display_name: "Financeiro",         description: "Acesso a valores e comissões",      is_system: false },
    { name: "marketing",   display_name: "Marketing / Indústria", description: "Visualização de campanhas",     is_system: false },
  ];

  for (const r of SYSTEM_ROLES) {
    await exec(`
      INSERT INTO roles (name, display_name, description, is_system)
      VALUES ('${r.name}', '${r.display_name.replace(/'/g, "''")}', '${r.description.replace(/'/g, "''")}', ${r.is_system})
      ON CONFLICT (name) DO NOTHING
    `);
  }
}

async function bootstrapRolePermissions(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id          SERIAL PRIMARY KEY,
      role_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      module      TEXT NOT NULL,
      action      TEXT NOT NULL,
      scope       TEXT NOT NULL DEFAULT 'all',
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (role_id, module, action)
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_rp_role ON role_permissions (role_id)`);
}

async function bootstrapAccessAudit(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS access_audit (
      id           SERIAL PRIMARY KEY,
      actor_id     INTEGER,
      actor_email  TEXT,
      target_id    INTEGER,
      target_email TEXT,
      action       TEXT NOT NULL,
      entity       TEXT NOT NULL,
      before_val   TEXT,
      after_val    TEXT,
      ip           TEXT,
      created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_audit_actor ON access_audit (actor_id)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_audit_target ON access_audit (target_id)`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_audit_created ON access_audit (created_at)`);
}

// ---------------------------------------------------------------------------
// Schema validation  (warns loudly if a critical table is still missing)
// ---------------------------------------------------------------------------

const REQUIRED_TABLES = [
  "users", "goals", "goal_settings", "alert_configs", "alert_notifications",
  "vendor_display_settings", "vendor_groups", "vendor_group_members", "app_settings",
  "campaigns", "campaign_audit_logs", "campaign_versions", "campaign_simulations",
  "campaign_results", "campaign_result_details", "campaign_goals",
  "commission_rules", "commission_records",
  "sync_state", "sync_logs", "job_locks",
  "cache_vendas", "cache_vendas_pendentes", "cache_campanhas", "cache_tubos_conexoes",
  "roles", "role_permissions", "access_audit",
];

async function validateSchema(): Promise<void> {
  const missing: string[] = [];
  for (const t of REQUIRED_TABLES) {
    if (!(await tableExists(t))) missing.push(t);
  }
  if (missing.length > 0) {
    throw new Error(
      `[schema-bootstrap] CRITICAL: tables still missing after bootstrap: ${missing.join(", ")}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function runSchemaBootstrap(): Promise<void> {
  const start = Date.now();
  console.log("[schema-bootstrap] Iniciando verificação e criação do schema PostgreSQL...");

  const created: string[] = [];

  try {
    // Check which tables are new (for logging)
    const wasNew: Record<string, boolean> = {};
    for (const t of REQUIRED_TABLES) {
      wasNew[t] = !(await tableExists(t));
    }

    // ── Application core ──────────────────────────────────────────────────
    await bootstrapUsers();
    await bootstrapGoals();
    await bootstrapGoalSettings();
    await bootstrapAlerts();
    await bootstrapVendorSettings();
    await bootstrapVendorGroups();
    await bootstrapAppSettings();

    // ── Campaigns ─────────────────────────────────────────────────────────
    await bootstrapCampaigns();

    // ── Commissions ───────────────────────────────────────────────────────
    await bootstrapCommissions();

    // ── Roles & Permissions ────────────────────────────────────────────────
    await bootstrapRoles();
    await bootstrapRolePermissions();
    await bootstrapAccessAudit();

    // ── Sync control ──────────────────────────────────────────────────────
    await bootstrapSyncControl();

    // ── ERP cache ─────────────────────────────────────────────────────────
    await bootstrapCacheTables();

    // ── Runtime column migrations ─────────────────────────────────────────
    const addedCols: string[] = [];
    await applyRuntimeMigrations(addedCols);
    if (addedCols.length) {
      console.log(`[schema-bootstrap] Colunas adicionadas: ${addedCols.join(", ")}`);
    }

    // Log newly created tables
    for (const t of REQUIRED_TABLES) {
      if (wasNew[t]) created.push(t);
    }
    if (created.length) {
      console.log(`[schema-bootstrap] Tabelas criadas: ${created.join(", ")}`);
    }

    // Final safety check
    await validateSchema();

    const ms = Date.now() - start;
    console.log(`[schema-bootstrap] Schema OK — ${REQUIRED_TABLES.length} tabelas verificadas em ${ms}ms`);
  } catch (err) {
    console.error("[schema-bootstrap] FALHA CRÍTICA:", err);
    throw err;
  }
}
