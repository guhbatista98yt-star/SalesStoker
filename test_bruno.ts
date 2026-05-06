import { Client } from 'pg';

async function run() {
  const c = new Client({ connectionString: "postgresql://postgres:1234@127.0.0.1:5435/database" });
  await c.connect();
  const res = await c.query("SELECT DISTINCT \"IDVENDEDOR\", \"NOME_VENDEDOR\" FROM cache_vendas WHERE \"NOME_VENDEDOR\" LIKE '%BRUNO%'");
  console.log(res.rows);
  await c.end();
}
run();
