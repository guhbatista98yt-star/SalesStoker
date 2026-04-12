/**
 * Initializes campaign tables on server startup.
 * Tables are pre-created by the PostgreSQL schema migration.
 * This module handles runtime migrations (new columns, etc).
 */

import { pgRun } from "../pg-client";

export async function initCampaignTables(): Promise<void> {
  const migrations = [
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_mode TEXT NOT NULL DEFAULT 'atingimento'`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS bases TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS supplier_name TEXT`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS logo_url TEXT`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS brand_color TEXT`,
  ];

  for (const sql of migrations) {
    try {
      await pgRun(sql);
    } catch {
      // Column already exists — ignore
    }
  }

  console.log("Campaign tables initialized");
}
