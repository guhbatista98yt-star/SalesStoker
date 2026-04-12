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
    `CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status)`,
    `CREATE INDEX IF NOT EXISTS idx_campaigns_period ON campaigns (starts_at, ends_at)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_versions_campaign ON campaign_versions (campaign_id, version)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_audit_campaign ON campaign_audit_logs (campaign_id)`,
    `CREATE INDEX IF NOT EXISTS idx_campaign_audit_created ON campaign_audit_logs (created_at)`,
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

  console.log("Campaign tables initialized");
}
