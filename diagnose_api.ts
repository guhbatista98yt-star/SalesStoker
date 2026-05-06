import { storage } from './server/storage';

async function diagnose() {
  const companyId = "all";
  const startDate = "2026-05-01";
  const endDate = "2026-05-31";
  
  const salespersons = await storage.getSalespersonsWithStats(companyId, startDate, endDate, undefined, false);
  
  const brunos = salespersons.filter(s => s.salesperson.name.includes("BRUNO"));
  console.log("Brunos in API response:", JSON.stringify(brunos, null, 2));
  console.log("Total salespeople in API response:", salespersons.length);
}

diagnose().catch(console.error);
