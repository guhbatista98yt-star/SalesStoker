import { pgAll } from './server/pg-client';

async function diagnose() {
  console.log("--- Thorough Diagnostic ---");
  
  // 1. Check for exact rows that would be returned by getSalespersonsFromCache
  const rows = await pgAll(`
    SELECT "IDVENDEDOR", "NOME_VENDEDOR", MIN("IDEMPRESA") as emp
    FROM cache_vendas
    WHERE "IDVENDEDOR" IS NOT NULL AND "IDVENDEDOR" != '' AND "NOME_VENDEDOR" IS NOT NULL
    GROUP BY "IDVENDEDOR", "NOME_VENDEDOR"
  `);
  
  console.log("Total unique (ID, Name) pairs:", rows.length);
  
  const idCounts: Record<string, number> = {};
  rows.forEach(r => {
    idCounts[r.IDVENDEDOR] = (idCounts[r.IDVENDEDOR] || 0) + 1;
  });
  
  const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);
  console.log("IDs with multiple Name variants:", duplicates);
  
  duplicates.forEach(([id, count]) => {
    const variants = rows.filter(r => r.IDVENDEDOR === id);
    console.log(`Variants for ID ${id}:`, variants);
  });

  // 2. Check for Bruno specifically
  const brunos = rows.filter(r => r.NOME_VENDEDOR.includes("BRUNO"));
  console.log("Brunos in list:", brunos);

  // 3. Check what the rankings return for these IDs
  const rankings = await pgAll(`
    SELECT "IDVENDEDOR", SUM("TOTALVENDA_LINHA") as total
    FROM cache_vendas
    WHERE "DT_MOVIMENTO" >= '2026-05-01' AND "DT_MOVIMENTO" <= '2026-05-31'
    GROUP BY "IDVENDEDOR"
  `);
  
  brunos.forEach(b => {
    const rank = rankings.find(r => r.IDVENDEDOR === b.IDVENDEDOR);
    console.log(`Rank for ${b.NOME_VENDEDOR} (${b.IDVENDEDOR}):`, rank ? rank.total : "No rank");
  });
}

diagnose().catch(console.error);
