import { Client } from 'pg';

async function run() {
  const c = new Client({ connectionString: "postgresql://postgres:1234@127.0.0.1:5435/database" });
  await c.connect();
  const res = await c.query('SELECT "TIPO_PRODUTO", count(*) FROM cache_tubos_conexoes GROUP BY "TIPO_PRODUTO"');
  console.log('TIPO_PRODUTO counts:', res.rows);
  const res2 = await c.query('SELECT * FROM cache_vendas LIMIT 1');
  console.log('cache_vendas sample:', res2.rows[0]);
  await c.end();
}
run();
