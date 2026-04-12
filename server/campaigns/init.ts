/**
 * Initializes campaign tables on server startup.
 * Called before routes are registered.
 */

import { sqlite } from "../db";

export function initCampaignTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      objective TEXT,
      campaign_type TEXT NOT NULL DEFAULT 'padrao',
      campaign_mode TEXT NOT NULL DEFAULT 'atingimento',
      sub_type TEXT,
      status TEXT NOT NULL DEFAULT 'rascunho',
      priority INTEGER NOT NULL DEFAULT 50,
      is_cumulative INTEGER NOT NULL DEFAULT 1,
      is_exclusive INTEGER NOT NULL DEFAULT 0,
      parent_id TEXT,
      current_version INTEGER NOT NULL DEFAULT 1,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      time_start TEXT,
      time_end TEXT,
      valid_weekdays TEXT DEFAULT '[]',
      recurrence TEXT,
      targets TEXT NOT NULL DEFAULT '{}',
      bases TEXT NOT NULL DEFAULT '{}',
      conditions TEXT NOT NULL DEFAULT '{}',
      triggers TEXT NOT NULL DEFAULT '[]',
      rewards TEXT NOT NULL DEFAULT '{}',
      limits TEXT NOT NULL DEFAULT '{}',
      exceptions TEXT NOT NULL DEFAULT '[]',
      natural_language TEXT,
      internal_notes TEXT,
      created_by TEXT NOT NULL,
      updated_by TEXT,
      change_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_versions (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      created_by TEXT NOT NULL,
      change_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_audit_logs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      prev_values TEXT,
      new_values TEXT,
      change_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_simulations (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      input_data TEXT NOT NULL,
      result TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_results (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      apurado_em TEXT DEFAULT CURRENT_TIMESTAMP,
      apurado_por TEXT NOT NULL,
      periodo_inicio TEXT NOT NULL,
      periodo_fim TEXT NOT NULL,
      campaign_mode TEXT NOT NULL,
      total_elegiveis INTEGER DEFAULT 0,
      total_participantes INTEGER DEFAULT 0,
      total_atingidos INTEGER DEFAULT 0,
      total_premiados INTEGER DEFAULT 0,
      valor_total_apuracao REAL DEFAULT 0,
      valor_total_pagamento REAL DEFAULT 0,
      valor_total_premio REAL DEFAULT 0,
      summary TEXT DEFAULT '{}',
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    )`,
    `CREATE TABLE IF NOT EXISTS campaign_result_details (
      id TEXT PRIMARY KEY,
      result_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      vendedor_id TEXT NOT NULL,
      vendedor_nome TEXT NOT NULL,
      elegivel INTEGER DEFAULT 1,
      participou INTEGER DEFAULT 0,
      gatilho_atingido INTEGER DEFAULT 0,
      atingiu INTEGER DEFAULT 0,
      premiado INTEGER DEFAULT 0,
      posicao INTEGER,
      valor_apuracao REAL DEFAULT 0,
      valor_pagamento REAL DEFAULT 0,
      qtd_total REAL DEFAULT 0,
      mix_count INTEGER DEFAULT 0,
      gatilho_valor REAL DEFAULT 0,
      premio_calculado REAL DEFAULT 0,
      premio_final REAL DEFAULT 0,
      motivos_nao_participacao TEXT DEFAULT '[]',
      memoria_calculo TEXT DEFAULT '{}',
      FOREIGN KEY (result_id) REFERENCES campaign_results(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status)`,
    `CREATE INDEX IF NOT EXISTS idx_campaigns_period ON campaigns (starts_at, ends_at)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_versions_campaign ON campaign_versions (campaign_id, version)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_audit_campaign ON campaign_audit_logs (campaign_id)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_audit_created ON campaign_audit_logs (created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_results_campaign ON campaign_results (campaign_id)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_result_details_result ON campaign_result_details (result_id)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_result_details_vendedor ON campaign_result_details (campaign_id, vendedor_id)`,
  ];

  // Migrations: add new columns to existing campaigns table if they don't exist
  const migrations = [
    `ALTER TABLE campaigns ADD COLUMN campaign_mode TEXT NOT NULL DEFAULT 'atingimento'`,
    `ALTER TABLE campaigns ADD COLUMN bases TEXT NOT NULL DEFAULT '{}'`,
  ];

  for (const sql of statements) {
    try {
      sqlite.exec(sql);
    } catch (err: any) {
      if (!err.message?.includes("already exists")) {
        console.warn("Campaign init warning:", err.message);
      }
    }
  }

  for (const sql of migrations) {
    try {
      sqlite.exec(sql);
    } catch {
      // Column already exists — silently ignore
    }
  }

  console.log("Campaign tables initialized");
}
