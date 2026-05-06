import { Client } from 'pg';

async function run() {
  const c = new Client({ connectionString: "postgresql://postgres:1234@127.0.0.1:5435/database" });
  await c.connect();
  
  const res = await c.query(`
    SELECT "IDVENDEDOR", "NOME_VENDEDOR", SUM("TOTALVENDA_LINHA") as total 
    FROM cache_vendas 
    WHERE "NOME_VENDEDOR" LIKE '%CARLISON%' AND "DT_MOVIMENTO" >= '2026-05-01' AND "DT_MOVIMENTO" <= '2026-05-31'
    GROUP BY "IDVENDEDOR", "NOME_VENDEDOR"
  `);
  console.log('Carlison May total:', res.rows);

  const res2 = await c.query(`
    SELECT "DT_MOVIMENTO", SUM("TOTALVENDA_LINHA") as total 
    FROM cache_vendas 
    WHERE "NOME_VENDEDOR" LIKE '%CARLISON%' AND "DT_MOVIMENTO" >= '2026-05-01' AND "DT_MOVIMENTO" <= '2026-05-05'
    GROUP BY "DT_MOVIMENTO"
    ORDER BY "DT_MOVIMENTO"
  `);
  console.log('Carlison daily May:', res2.rows);

  const res3 = await c.query(`
    SELECT "IDVENDEDOR", "NOME_VENDEDOR", SUM("TOTALVENDA_LINHA") as total
    FROM cache_vendas
    WHERE "NOME_VENDEDOR" LIKE '%BRUNO%' AND "DT_MOVIMENTO" >= '2026-05-01' AND "DT_MOVIMENTO" <= '2026-05-05'
    GROUP BY "IDVENDEDOR", "NOME_VENDEDOR"
  `);
  console.log('Bruno total:', res3.rows);

  await c.end();
}
run();
