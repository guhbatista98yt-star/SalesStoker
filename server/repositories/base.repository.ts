export abstract class BaseRepository {
  protected normalizeCompanyId(companyId?: string): string {
    if (!companyId || companyId === "all") return "all";
    const trimmed = String(companyId).trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`Empresa invalida: ${companyId}`);
    }
    return String(Number(trimmed));
  }

  protected buildCompanyFilter(companyId?: string, columnName: string = `"IDEMPRESA"`): string {
    if (!companyId || companyId === "all") return "";
    return ` AND ${columnName} = '${this.normalizeCompanyId(companyId)}'`;
  }
}
