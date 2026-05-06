import { BaseRepository } from "./base.repository";
import { pgAll, pgGet } from "../pg-client";
import { Team, Salesperson } from "../../shared/schema";

export class TeamRepository extends BaseRepository {
  private normalizeVendorId(value: unknown): string {
    return String(value ?? "").trim();
  }

  private normalizeVendorName(value: unknown): string {
    return String(value ?? "").trim();
  }

  private matchesTeamMember(salesperson: Salesperson, teamMembers?: string[]): boolean {
    if (!teamMembers || teamMembers.length === 0) return true;

    const salespersonId = this.normalizeVendorId(salesperson.id);
    const salespersonName = this.normalizeVendorName(salesperson.name).toUpperCase();

    return teamMembers.some(member => {
      const normalizedMember = this.normalizeVendorId(member);
      if (!normalizedMember) return false;
      if (normalizedMember === salespersonId) return true;
      return salespersonName.includes(normalizedMember.toUpperCase());
    });
  }

  async getSalespersonsFromCache(companyId?: string, showHidden = false): Promise<Salesperson[]> {
    const filterSql = this.buildCompanyFilter(companyId);
    const rows = await pgAll<{ IDVENDEDOR: string; NOME_VENDEDOR: string; IDEMPRESA: string }>(
      `SELECT
         TRIM(CAST("IDVENDEDOR" AS TEXT)) as "IDVENDEDOR",
         MIN(TRIM("NOME_VENDEDOR")) as "NOME_VENDEDOR",
         MIN(TRIM(CAST("IDEMPRESA" AS TEXT))) as "IDEMPRESA" 
       FROM cache_vendas 
       WHERE "IDVENDEDOR" IS NOT NULL
         AND TRIM(CAST("IDVENDEDOR" AS TEXT)) != ''
         AND "NOME_VENDEDOR" IS NOT NULL
         AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
         AND UPPER("NOME_VENDEDOR") NOT LIKE '%BRUNO LEANDRO OLIVEIRA SANTOS%'
       ${filterSql}
       GROUP BY TRIM(CAST("IDVENDEDOR" AS TEXT))
       ORDER BY "NOME_VENDEDOR"`
    );
    
    let salespersons: Salesperson[] = rows.map((r) => ({
      id: this.normalizeVendorId(r.IDVENDEDOR),
      name: this.normalizeVendorName(r.NOME_VENDEDOR),
      companyId: this.normalizeVendorId(r.IDEMPRESA) || "1",
      isHidden: false,
      email: "",
      teamId: "all",
    }));

    if (!showHidden) {
      const hiddenIds = await this.getHiddenSalespersonIds();
      if (hiddenIds.size > 0) {
        salespersons = salespersons.filter((s) => !hiddenIds.has(s.id));
      }
    }

    return salespersons;
  }

  private async getHiddenSalespersonIds(): Promise<Set<string>> {
    const hiddenConfigs = await pgAll<{ vendorId: string }>(
      `SELECT "vendorId" FROM vendor_display_settings WHERE "isHidden" = TRUE OR "isHidden" = 1`
    ).catch(() => []);
    return new Set(hiddenConfigs.map((c) => this.normalizeVendorId(c.vendorId)));
  }

  async getSalespersons(companyId: string, teamMembers?: string[], showHidden = false): Promise<Salesperson[]> {
    const all = await this.getSalespersonsFromCache(companyId, showHidden);
    return all.filter((s) => this.matchesTeamMember(s, teamMembers));
  }

  async getSalesperson(id: string): Promise<Salesperson | undefined> {
    const all = await this.getSalespersonsFromCache(undefined, true);
    return all.find((s) => s.id === id);
  }

  async getTeams(companyId: string): Promise<Team[]> {
    const mockTeam: Team = {
      id: "all",
      name: "Equipe Principal",
      companyId: this.normalizeCompanyId(companyId),
      supervisorId: "admin",
    };
    return [mockTeam];
  }

  async getTeam(id: string): Promise<Team | undefined> {
    if (id === "all") {
      return {
        id: "all",
        name: "Equipe Principal",
        companyId: "all",
        supervisorId: "admin",
      };
    }
    return undefined;
  }

  async getVendorGroups(): Promise<{ id: string; name: string; members: string[] }[]> {
    try {
      const groups = await pgAll<{ id: string; name: string }>(`SELECT * FROM vendor_groups ORDER BY name`);
      return Promise.all(groups.map(async (g) => {
        const members = await pgAll<{ salesperson_id: string }>(`
          SELECT DISTINCT TRIM(CAST(salesperson_id AS TEXT)) as salesperson_id
          FROM vendor_group_members
          WHERE group_id = ? AND TRIM(CAST(salesperson_id AS TEXT)) != ''
          ORDER BY salesperson_id
        `, [g.id]);
        return {
          id: String(g.id),
          name: this.normalizeVendorName(g.name),
          members: members.map(m => this.normalizeVendorId(m.salesperson_id)).filter(Boolean),
        };
      }));
    } catch {
      return [];
    }
  }
}
