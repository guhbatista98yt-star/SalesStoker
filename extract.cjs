const fs = require('fs');
const file = 'server/storage.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('async getMetasAcompanhamento('));
const endIdx = lines.findIndex(l => l.includes('async getAppSetting('));

if (startIdx !== -1 && endIdx !== -1) {
    let extracted = lines.slice(startIdx, endIdx).join('\n');
    
    // remove the teamRepo references that were in the middle
    extracted = extracted.replace(/  async getVendorGroups[\s\S]*?deleteVendorGroup[\s\S]*?\n/g, '');

    const repoContent = `import { BaseRepository } from "./base.repository";
import { pgAll, pgGet, pgRun } from "../pg-client";

export class CampaignRepository extends BaseRepository {
` + extracted + `}
`;
    fs.writeFileSync('server/repositories/campaign.repository.ts', repoContent);
    console.log('Created campaign.repository.ts');
    
    const delegation = `  async getMetasAcompanhamento(vendedorId: string): Promise<any> { return this.campaignRepo.getMetasAcompanhamento(vendedorId); }
  async getMetasAmancoDTR(vendedorId: string, targetYear?: number, targetQuarter?: number): Promise<any> { return this.campaignRepo.getMetasAmancoDTR(vendedorId, targetYear, targetQuarter); }
  async getMetasAmancoTV(vendedorId: string): Promise<any> { return this.campaignRepo.getMetasAmancoTV(vendedorId); }
  async getMetasElit(vendedorId: string): Promise<any> { return this.campaignRepo.getMetasElit(vendedorId); }
  async getCampaignGoals(campaignName: string, year: number): Promise<{ salespersonId: string; triggerValue: number }[]> { return this.campaignRepo.getCampaignGoals(campaignName, year); }
  async saveCampaignGoals(campaignName: string, year: number, goals: { salespersonId: string; triggerValue: number }[]): Promise<void> { return this.campaignRepo.saveCampaignGoals(campaignName, year, goals); }
  
  async getVendorGroups(): Promise<{ id: string; name: string; members: string[] }[]> { return this.teamRepo.getVendorGroups(); }
  async saveVendorGroup(id: string, name: string, members: string[]): Promise<void> { return this.teamRepo.saveVendorGroup(id, name, members); }
  async deleteVendorGroup(id: string): Promise<void> { return this.teamRepo.deleteVendorGroup(id); }
  
  async getCampaignReport(campaignName: string): Promise<any[]> { return this.campaignRepo.getCampaignReport(campaignName); }
  async getMovimentacoesPorVendedor(vendedorId: string, startDate: string, endDate: string): Promise<any[]> { return this.campaignRepo.getMovimentacoesPorVendedor(vendedorId, startDate, endDate); }
`;
    lines.splice(startIdx, endIdx - startIdx, delegation);
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Updated storage.ts');
} else {
    console.log('Lines not found');
}
