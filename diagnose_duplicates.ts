import { pgAll } from './server/pg-client';

async function diagnose() {
  console.log("--- Diagnosing Duplicate Salespeople ---");
  
  // 1. Check exact rows in cache_vendas that might cause duplicates in the GROUP BY
  const rows = await pgAll(`
    SELECT "IDVENDEDOR", "NOME_VENDEDOR", COUNT(*) as count
    FROM cache_vendas
    WHERE "IDVENDEDOR" IS NOT NULL AND "IDVENDEDOR" != '' AND "NOME_VENDEDOR" IS NOT NULL
    GROUP BY "IDVENDEDOR", "NOME_VENDEDOR"
    HAVING COUNT(*) > 1
    LIMIT 20
  `);
  
  console.log("Groupings with more than 1 row (expected if vendor sold in multi companies):", rows.length);

  // 2. Check if there are different NOME_VENDEDOR for the same IDVENDEDOR
  const nameDiffs = await pgAll(`
    SELECT "IDVENDEDOR", COUNT(DISTINCT "NOME_VENDEDOR") as name_count
    FROM cache_vendas
    GROUP BY "IDVENDEDOR"
    HAVING COUNT(DISTINCT "NOME_VENDEDOR") > 1
  `);
  
  console.log("IDs with multiple names:", nameDiffs);

  // 3. Check for trailing spaces
  const spaces = await pgAll(`
    SELECT "IDVENDEDOR", length("IDVENDEDOR") as len
    FROM cache_vendas
    WHERE "IDVENDEDOR" LIKE '% ' OR "IDVENDEDOR" LIKE ' %'
    LIMIT 5
  `);
  console.log("IDs with spaces:", spaces);

  // 4. Run the actual query used in the repository to see what it returns for BRUNO
  const brunoRows = await pgAll(`
    SELECT "IDVENDEDOR", "NOME_VENDEDOR", MIN("IDEMPRESA") as "IDEMPRESA" 
    FROM cache_vendas 
    WHERE "NOME_VENDEDOR" LIKE '%BRUNO%'
    GROUP BY "IDVENDEDOR", "NOME_VENDEDOR"
  `);
  console.log("Bruno results from repository query:", JSON.stringify(brunoRows, null, 2));
}

diagnose().catch(console.error);
