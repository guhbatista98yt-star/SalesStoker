import fs from 'fs';
let content = fs.readFileSync('scratch-campaign.txt', 'utf8');

let lines = content.split('\n').map(l => l.replace(/^>?\s*server\\storage\.ts:\d+:\s?/, '').replace(/\r$/, ''));

let startIdx = lines.findIndex(l => l.includes('async getMetasAcompanhamento('));
let endIdx = lines.findIndex(l => l.includes('async getAppSetting('));

if (startIdx !== -1 && endIdx !== -1) {
    let extracted = lines.slice(startIdx, endIdx).join('\n');
    
    extracted = extracted.replace(/  async getVendorGroups[\s\S]*?deleteVendorGroup[\s\S]*?}\n\n/g, '');

    const repoContent = `import { BaseRepository } from "./base.repository";
import { pgAll, pgGet, pgRun } from "../pg-client";
import { randomUUID } from "crypto";

export class CampaignRepository extends BaseRepository {
` + extracted + `}
`;
    fs.writeFileSync('server/repositories/campaign.repository.ts', repoContent);
    console.log('Fixed campaign.repository.ts');
} else {
    console.log('Lines not found');
}
