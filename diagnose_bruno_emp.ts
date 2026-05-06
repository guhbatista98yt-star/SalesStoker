import { pgAll } from './server/pg-client';

async function diagnose() {
  const rows = await pgAll(`
    SELECT "IDEMPRESA", SUM("TOTALVENDA_LINHA") as total
    FROM cache_vendas
    WHERE "IDVENDEDOR" = '1014430' AND "DT_MOVIMENTO" >= '2026-05-01' AND "DT_MOVIMENTO" <= '2026-05-31'
    GROUP BY "IDEMPRESA"
  `);
  console.log("Bruno total per company:", rows);
}

diagnose().catch(console.error);
