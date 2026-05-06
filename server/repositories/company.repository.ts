import { BaseRepository } from "./base.repository";
import { pgAll, pgGet } from "../pg-client";
import { Company } from "../../shared/schema";

export class CompanyRepository extends BaseRepository {
  private static COMPANY_MAP: Record<string, { name: string; cnpj: string }> = {
    "1": { name: "Conectubos Atacarejo da Construção", cnpj: "05.443.069/0001-03" },
    "2": { name: "D & C Comercial",                   cnpj: "05.443.069/0002-94" },
    "3": { name: "Conectubos",                         cnpj: "52.846.814/0001-45" },
  };

  async getCompaniesFromCache(): Promise<Company[]> {
    try {
      const settingRow = await pgGet<{ value: string }>(
        `SELECT value FROM app_settings WHERE key = 'companies_config' LIMIT 1`
      );
      if (settingRow?.value) {
        try {
          const cfg = JSON.parse(settingRow.value);
          if (Array.isArray(cfg) && cfg.length > 0) {
            CompanyRepository.COMPANY_MAP = {};
            for (const c of cfg) {
              CompanyRepository.COMPANY_MAP[String(c.id)] = { name: c.name, cnpj: c.cnpj ?? "" };
            }
          }
        } catch { /* ignore parse errors */ }
      }

      const rows = await pgAll<{ id: string }>(
        `SELECT DISTINCT CAST("IDEMPRESA" AS TEXT) as id FROM cache_vendas ORDER BY id`
      );

      if (rows.length === 0) {
        return [{ id: "1", name: "Conectubos", cnpj: "" }];
      }

      return rows.map(row => {
        const info = CompanyRepository.COMPANY_MAP[row.id];
        return {
          id: row.id,
          name: info?.name ?? `Empresa ${row.id}`,
          cnpj: info?.cnpj ?? "",
        };
      });
    } catch (err) {
      return [{ id: "1", name: "Conectubos", cnpj: "" }];
    }
  }

  async getCompanies(): Promise<Company[]> {
    return this.getCompaniesFromCache();
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const companies = await this.getCompaniesFromCache();
    return companies.find((c) => c.id === id);
  }
}
