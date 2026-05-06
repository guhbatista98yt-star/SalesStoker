import { Client } from 'pg';

async function run() {
  const c = new Client({ connectionString: "postgresql://postgres:1234@127.0.0.1:5435/database" });
  await c.connect();
  const res = await c.query("SELECT DISTINCT \"IDVENDEDOR\", \"NOME_VENDEDOR\", \"IDEMPRESA\" FROM cache_vendas WHERE \"NOME_VENDEDOR\" LIKE '%BRUNO%' ORDER BY \"NOME_VENDEDOR\"");
  console.log("Bruno cache:", res.rows);
  const allRes = await c.query("SELECT DISTINCT \"IDVENDEDOR\", \"NOME_VENDEDOR\", \"IDEMPRESA\" FROM cache_vendas ORDER BY \"NOME_VENDEDOR\" LIMIT 15");
  console.log("All cache:", allRes.rows);
  await c.end();
}
run();
