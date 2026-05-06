import { Client } from 'pg';

async function run() {
  const c = new Client({ connectionString: "postgresql://postgres:1234@127.0.0.1:5435/database" });
  await c.connect();
  
  // Check total sales for Carlison (14060) on 2026-05-05
  const res = await c.query(`
    SELECT 
      SUM("TOTALVENDA_LINHA") as total,
      COUNT(*) as count,
      COUNT(DISTINCT "IDPLANILHA") as planilhas
    FROM cache_vendas
    WHERE "IDVENDEDOR" = '14060' AND "DT_MOVIMENTO" = '2026-05-05'
  `);
  console.log('Carlison sales 05/05:', res.rows[0]);

  // Check if there are duplicate IDPLANILHAs
  const res2 = await c.query(`
    SELECT "IDPLANILHA", COUNT(*) as c 
    FROM cache_vendas 
    WHERE "IDVENDEDOR" = '14060' AND "DT_MOVIMENTO" = '2026-05-05'
    GROUP BY "IDPLANILHA"
    HAVING COUNT(*) > 1
    LIMIT 5
  `);
  console.log('Duplicate planilhas:', res2.rows);

  // Compare Bruno (1014430)
  const res3 = await c.query(`
    SELECT 
      SUM("TOTALVENDA_LINHA") as total,
      COUNT(*) as count
    FROM cache_vendas
    WHERE "IDVENDEDOR" = '1014430' AND "DT_MOVIMENTO" = '2026-05-05'
  `);
  console.log('Bruno sales 05/05:', res3.rows[0]);

  // Compare Alan (1014115)
  const res4 = await c.query(`
    SELECT 
      SUM("TOTALVENDA_LINHA") as total,
      COUNT(*) as count
    FROM cache_vendas
    WHERE "IDVENDEDOR" = '1014115' AND "DT_MOVIMENTO" = '2026-05-05'
  `);
  console.log('Alan sales 05/05:', res4.rows[0]);

  await c.end();
}
run();
