import { pgAll } from './server/pg-client';

async function diagnose() {
  const rows = await pgAll(`
    SELECT "IDVENDEDOR", "NOME_VENDEDOR", "DT_MOVIMENTO", "IDEMPRESA", SUM("TOTALVENDA_LINHA") as total
    FROM cache_vendas
    WHERE "TOTALVENDA_LINHA" > 0
    GROUP BY "IDVENDEDOR", "NOME_VENDEDOR", "DT_MOVIMENTO", "IDEMPRESA"
    HAVING SUM("TOTALVENDA_LINHA") BETWEEN 28352.00 AND 28352.10
  `);
  console.log("Value 28352.03 global search:", rows);
}

diagnose().catch(console.error);
