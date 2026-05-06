import { pgAll } from './server/pg-client';

async function diagnose() {
  const rows = await pgAll(`
    SELECT "IDVENDEDOR", "NOME_VENDEDOR", SUM("TOTALVENDA_LINHA") as total
    FROM cache_vendas
    WHERE "DT_MOVIMENTO" >= '2026-05-01' AND "DT_MOVIMENTO" <= '2026-05-31'
    GROUP BY "IDVENDEDOR", "NOME_VENDEDOR"
    HAVING SUM("TOTALVENDA_LINHA") BETWEEN 28352.00 AND 28352.10
  `);
  console.log("Value 28352.03 search:", rows);
}

diagnose().catch(console.error);
