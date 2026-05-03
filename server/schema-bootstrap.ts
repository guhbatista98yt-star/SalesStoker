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
      "showOnTv"    INTEGER NOT NULL DEFAULT 1,
      "companyId"   TEXT NOT NULL DEFAULT 'all',
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_vendor_display_company
    ON vendor_display_settings ("companyId")`);
  await exec(`ALTER TABLE vendor_display_settings ADD COLUMN IF NOT EXISTS "showOnTv" INTEGER NOT NULL DEFAULT 1`).catch(() => {});
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

  // Controls the 2-year historical bootstrap — one row per (routine, month)
  await exec(`
    CREATE TABLE IF NOT EXISTS bootstrap_historico (
      id                SERIAL PRIMARY KEY,
      routine_name      TEXT NOT NULL,
      periodo_inicio    DATE NOT NULL,
      periodo_fim       DATE NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pendente',
      records_read      INTEGER NOT NULL DEFAULT 0,
      records_written   INTEGER NOT NULL DEFAULT 0,
      started_at        TIMESTAMPTZ,
      finished_at       TIMESTAMPTZ,
      error_msg         TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (routine_name, periodo_inicio)
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_bh_routine_status ON bootstrap_historico (routine_name, status)`);

  // Top-level flag: 'pendente' | 'em_andamento' | 'concluido' | 'erro'
  await exec(`
    CREATE TABLE IF NOT EXISTS bootstrap_status (
      id            SERIAL PRIMARY KEY,
      routine_name  TEXT NOT NULL UNIQUE,
      status        TEXT NOT NULL DEFAULT 'pendente',
      data_inicio   DATE,
      data_fim      DATE,
      total_meses   INTEGER NOT NULL DEFAULT 0,
      meses_ok      INTEGER NOT NULL DEFAULT 0,
      total_records INTEGER NOT NULL DEFAULT 0,
      started_at    TIMESTAMPTZ,
      finished_at   TIMESTAMPTZ,
      error_msg     TEXT,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_bs_status ON bootstrap_status (status)`);

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

  // Stock snapshot for Copiloto de Compras suggestion engine
  // One row per (IDPRODUTO, FABRICANTE) — matches cache_campanhas join keys.
  // Full-replace strategy: TRUNCATE + INSERT on every sync (no watermark).
  await exec(`
    CREATE TABLE IF NOT EXISTS cache_estoque_sugestao (
      "IDPRODUTO"        TEXT NOT NULL,
      "FABRICANTE"       TEXT NOT NULL,
      "SALDO_ATUAL"      NUMERIC(18,4) NOT NULL DEFAULT 0,
      "QTDRESERVA"       NUMERIC(18,4) NOT NULL DEFAULT 0,
      "SALDO_DISPONIVEL" NUMERIC(18,4) NOT NULL DEFAULT 0,
      "QTDREPOSICAO"     NUMERIC(18,4) NOT NULL DEFAULT 0,
      "DTULT_COMPRA"     DATE,
      "VAL_UNITARIO"     NUMERIC(18,4) NOT NULL DEFAULT 0,
      "QTDPENDENTE"      NUMERIC(18,4) NOT NULL DEFAULT 0,
      synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ces_produto_fabricante
    ON cache_estoque_sugestao ("IDPRODUTO", "FABRICANTE")`);
  await exec(`CREATE INDEX IF NOT EXISTS idx_ces_fabricante
    ON cache_estoque_sugestao ("FABRICANTE")`);
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
    ["campaigns", "cycle_type",     "TEXT NOT NULL DEFAULT 'none'"],
    ["campaigns", "auto_renew",     "INTEGER NOT NULL DEFAULT 0"],
    ["campaigns", "cycle_count",    "INTEGER NOT NULL DEFAULT 0"],
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
    // Vendor visibility — per-role restriction
    ["vendor_display_settings", "allowed_roles", "TEXT NOT NULL DEFAULT ''"],
    // cache_estoque_sugestao — product description from ERP
    ["cache_estoque_sugestao", "DESCRICAO", "TEXT NOT NULL DEFAULT ''"],
    // cache_campanhas — company ID from ERP (enables per-company filtering)
    ["cache_campanhas", "IDEMPRESA", "TEXT NOT NULL DEFAULT ''"],
    // compras config tables — company isolation
    ["compras_fornecedores_config", "company_id", "INTEGER NOT NULL DEFAULT 1"],
    ["compras_produtos_config",     "company_id", "INTEGER NOT NULL DEFAULT 1"],
  ];

  for (const [table, col, def] of migrations) {
    const did = await addColumnIfMissing(table, col, def);
    if (did) added.push(`${table}.${col}`);
  }
}

// ---------------------------------------------------------------------------
// Unique constraint migrations — expand UNIQUE keys to include company_id
// ---------------------------------------------------------------------------

async function applyUniqueConstraintMigrations(): Promise<void> {
  // compras_fornecedores_config: drop single-column unique, add compound with company_id
  await exec(`
    ALTER TABLE compras_fornecedores_config
      DROP CONSTRAINT IF EXISTS compras_fornecedores_config_fabricante_nome_key
  `).catch(() => null);
  await exec(`
    DROP INDEX IF EXISTS idx_cfc_fabricante
  `).catch(() => null);
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cfc_company_fabricante
      ON compras_fornecedores_config (company_id, fabricante_nome)
  `).catch(() => null);

  // compras_produtos_config: drop single-company unique, add compound with company_id
  await exec(`
    ALTER TABLE compras_produtos_config
      DROP CONSTRAINT IF EXISTS compras_produtos_config_produto_id_fornecedor_nome_key
  `).catch(() => null);
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cpc_company_produto_forn
      ON compras_produtos_config (company_id, produto_id, fornecedor_nome)
  `).catch(() => null);
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
// Purchase / Compras tables
// ---------------------------------------------------------------------------

async function bootstrapCompras(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS purchase_alerts (
      id              TEXT PRIMARY KEY,
      user_id         INTEGER NOT NULL,
      type            TEXT NOT NULL DEFAULT 'geral',
      reference_key   TEXT NOT NULL DEFAULT '',
      severity_band   TEXT NOT NULL DEFAULT '1',
      severity        TEXT NOT NULL DEFAULT 'info',
      title           TEXT NOT NULL DEFAULT '',
      message         TEXT NOT NULL DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'nao_lido',
      data            TEXT NOT NULL DEFAULT '{}',
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Migrate: add columns if they don't exist yet (safe idempotent ALTERs)
  for (const col of [
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'geral'`,
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS reference_key TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS severity_band TEXT NOT NULL DEFAULT '1'`,
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'`,
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'nao_lido'`,
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS data TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE purchase_alerts ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  ]) {
    await exec(col).catch(() => {});
  }
  await exec(`CREATE INDEX IF NOT EXISTS idx_purchase_alerts_user
    ON purchase_alerts (user_id, status, created_at DESC)`).catch(() => {});
  await exec(`CREATE INDEX IF NOT EXISTS idx_purchase_alerts_ref
    ON purchase_alerts (user_id, type, reference_key)`).catch(() => {});

  await exec(`
    CREATE TABLE IF NOT EXISTS purchase_alert_events (
      id          TEXT PRIMARY KEY,
      alert_id    TEXT NOT NULL,
      user_id     INTEGER NOT NULL,
      action      TEXT NOT NULL,
      rule_name   TEXT NOT NULL DEFAULT '',
      details     TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Migrate: add columns for purchase_alert_events if missing
  for (const col of [
    `ALTER TABLE purchase_alert_events ADD COLUMN IF NOT EXISTS alert_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE purchase_alert_events ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE purchase_alert_events ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE purchase_alert_events ADD COLUMN IF NOT EXISTS rule_name TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE purchase_alert_events ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE purchase_alert_events ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  ]) {
    await exec(col).catch(() => {});
  }
  await exec(`CREATE INDEX IF NOT EXISTS idx_pae_alert
    ON purchase_alert_events (alert_id, created_at DESC)`).catch(() => {});
  await exec(`CREATE INDEX IF NOT EXISTS idx_pae_user
    ON purchase_alert_events (user_id, created_at DESC)`).catch(() => {});

  await exec(`
    CREATE TABLE IF NOT EXISTS user_alert_preferences (
      id                  TEXT PRIMARY KEY,
      user_id             INTEGER NOT NULL UNIQUE,
      enabled             INTEGER NOT NULL DEFAULT 1,
      sound_enabled       INTEGER NOT NULL DEFAULT 1,
      only_critical_sound INTEGER NOT NULL DEFAULT 0,
      muted_until         TEXT,
      created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  for (const col of [
    `ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS enabled INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS sound_enabled INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS only_critical_sound INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS muted_until TEXT`,
    `ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE user_alert_preferences ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  ]) {
    await exec(col).catch(() => {});
  }
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_uap_user ON user_alert_preferences (user_id)`).catch(() => {});

  await exec(`
    CREATE TABLE IF NOT EXISTS alert_delivery_state (
      id                  TEXT PRIMARY KEY,
      dedupe_key          TEXT NOT NULL,
      user_id             INTEGER NOT NULL,
      last_alert_id       TEXT NOT NULL,
      last_severity_band  TEXT NOT NULL DEFAULT '1',
      last_triggered_at   TEXT NOT NULL,
      cooldown_until      TEXT
    )
  `);
  for (const col of [
    `ALTER TABLE alert_delivery_state ADD COLUMN IF NOT EXISTS dedupe_key TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE alert_delivery_state ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE alert_delivery_state ADD COLUMN IF NOT EXISTS last_alert_id TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE alert_delivery_state ADD COLUMN IF NOT EXISTS last_severity_band TEXT NOT NULL DEFAULT '1'`,
    `ALTER TABLE alert_delivery_state ADD COLUMN IF NOT EXISTS last_triggered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE alert_delivery_state ADD COLUMN IF NOT EXISTS cooldown_until TEXT`,
  ]) {
    await exec(col).catch(() => {});
  }
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_dedupe
    ON alert_delivery_state (dedupe_key, user_id)`).catch(() => {});

  await exec(`
    CREATE TABLE IF NOT EXISTS purchase_settings (
      chave       TEXT PRIMARY KEY,
      valor       TEXT NOT NULL DEFAULT '',
      updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_settings' AND column_name='key') THEN
        ALTER TABLE purchase_settings RENAME COLUMN "key" TO chave;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchase_settings' AND column_name='value') THEN
        ALTER TABLE purchase_settings RENAME COLUMN "value" TO valor;
      END IF;
    END $$
  `).catch(() => {});
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_settings_key ON purchase_settings (chave)`).catch(() => {});

  // ── Configuração de Fornecedores ──────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS compras_fornecedores_config (
      id                  TEXT PRIMARY KEY,
      fabricante_nome     TEXT NOT NULL UNIQUE,
      codigo              TEXT NOT NULL DEFAULT '',
      razao_social        TEXT NOT NULL DEFAULT '',
      nome_fantasia       TEXT NOT NULL DEFAULT '',
      ativo               INTEGER NOT NULL DEFAULT 1,
      periodo_compra_dias INTEGER NOT NULL DEFAULT 30,
      lead_time_dias      INTEGER NOT NULL DEFAULT 7,
      pedido_minimo_valor REAL    NOT NULL DEFAULT 0,
      observacoes         TEXT    NOT NULL DEFAULT '',
      created_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cfc_fabricante ON compras_fornecedores_config (fabricante_nome)`).catch(() => {});

  // ── Configuração de Produtos ───────────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS compras_produtos_config (
      id                  TEXT PRIMARY KEY,
      produto_id          TEXT NOT NULL,
      fornecedor_nome     TEXT NOT NULL,
      estoque_minimo      REAL    NOT NULL DEFAULT 0,
      estoque_maximo      REAL    NOT NULL DEFAULT 0,
      lote_minimo         REAL    NOT NULL DEFAULT 1,
      multiplo_embalagem  REAL    NOT NULL DEFAULT 1,
      giro_periodo_dias   INTEGER NOT NULL DEFAULT 90,
      ativo               INTEGER NOT NULL DEFAULT 1,
      created_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (produto_id, fornecedor_nome)
    )
  `);
  await exec(`CREATE INDEX IF NOT EXISTS idx_cpc_produto ON compras_produtos_config (produto_id)`).catch(() => {});
  await exec(`CREATE INDEX IF NOT EXISTS idx_cpc_fornecedor ON compras_produtos_config (fornecedor_nome)`).catch(() => {});
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
  "bootstrap_historico", "bootstrap_status",
  "cache_vendas", "cache_vendas_pendentes", "cache_campanhas", "cache_tubos_conexoes",
  "cache_estoque_sugestao",
  "roles", "role_permissions", "access_audit",
  "purchase_alerts", "purchase_alert_events", "purchase_settings",
  "user_alert_preferences", "alert_delivery_state",
  "compras_fornecedores_config", "compras_produtos_config",
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

    // ── Compras / Copiloto de Compras ──────────────────────────────────────
    await bootstrapCompras();

    // ── Runtime column migrations ─────────────────────────────────────────
    const addedCols: string[] = [];
    await applyRuntimeMigrations(addedCols);
    if (addedCols.length) {
      console.log(`[schema-bootstrap] Colunas adicionadas: ${addedCols.join(", ")}`);
    }

    // ── Unique constraint migrations (company isolation) ──────────────────
    await applyUniqueConstraintMigrations();

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
