import { BaseRepository } from "./base.repository";
import { pgAll, pgGet, pgRun } from "../pg-client";
import { VendorDisplaySettings } from "../../shared/schema";

export class SettingsRepository extends BaseRepository {
  async getVendorDisplaySettings(): Promise<VendorDisplaySettings[]> {
    try {
      const rows = await pgAll<any>(`SELECT * FROM vendor_display_settings`);
      return rows.map((r) => ({
        id: r.id,
        vendorId: r.vendorId,
        displayCode: r.displayCode,
        displayName: r.displayName,
        isHidden: r.isHidden === 1 || r.isHidden === true,
        showOnTv: r.showOnTv === 0 ? false : true,
        companyId: r.companyId,
      }));
    } catch {
      return [];
    }
  }

  async upsertVendorDisplaySettings(settings: Omit<VendorDisplaySettings, "id">): Promise<void> {
    try {
      await pgRun(
        `INSERT INTO vendor_display_settings (vendorId, displayCode, displayName, isHidden, showOnTv, companyId)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (vendorId) 
         DO UPDATE SET displayCode = ?, displayName = ?, isHidden = ?, showOnTv = ?, companyId = ?`,
        [
          settings.vendorId,
          settings.displayCode,
          settings.displayName,
          settings.isHidden ? 1 : 0,
          settings.showOnTv ? 1 : 0,
          settings.companyId,
          settings.displayCode,
          settings.displayName,
          settings.isHidden ? 1 : 0,
          settings.showOnTv ? 1 : 0,
          settings.companyId,
        ],
      );
    } catch (err) {
      console.error("Erro upsertVendorDisplaySettings:", err);
    }
  }

  async getVendorsTVSettings(): Promise<Array<{ vendorId: string; displayName: string; displayCode: string; showOnTv: boolean }>> {
    try {
      const rows = await pgAll<any>(`SELECT vendor_id, display_name, display_code, show_on_tv FROM tv_dashboard_settings`);
      return rows.map((r) => ({
        vendorId: r.vendor_id,
        displayName: r.display_name,
        displayCode: r.display_code,
        showOnTv: r.show_on_tv === 1 || r.show_on_tv === true,
      }));
    } catch {
      return [];
    }
  }

  async saveVendorsTVSettings(settings: Array<{ vendorId: string; displayName: string; displayCode: string; showOnTv: boolean }>): Promise<void> {
    try {
      await pgRun(`DELETE FROM tv_dashboard_settings`);
      for (const s of settings) {
        await pgRun(
          `INSERT INTO tv_dashboard_settings (vendor_id, display_name, display_code, show_on_tv) VALUES (?, ?, ?, ?)`,
          [s.vendorId, s.displayName, s.displayCode, s.showOnTv ? 1 : 0],
        );
      }
    } catch (err) {
      console.error("Erro saveVendorsTVSettings:", err);
    }
  }

  async getAppSetting(key: string): Promise<string | null> {
    try {
      const row = await pgGet<{ value: string }>(`SELECT value FROM app_settings WHERE key = ?`, [key]);
      return row?.value ?? null;
    } catch {
      return null;
    }
  }

  async setAppSetting(key: string, value: string): Promise<void> {
    await pgRun(`
      INSERT INTO app_settings (key, value) VALUES (?, ?)
      ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `, [key, value, value]);
  }
}
