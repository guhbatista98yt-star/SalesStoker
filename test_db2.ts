import { Client } from 'pg';

async function run() {
  const c = new Client({ connectionString: "postgresql://postgres:1234@127.0.0.1:5435/database" });
  await c.connect();
  const res = await c.query(`
    SELECT
      COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Conexao' THEN "TOTALVENDA_LINHA" ELSE 0 END), 0) as conexoes,
      COALESCE(SUM(CASE WHEN "TIPO_PRODUTO" = 'Tubo' THEN "TOTALVENDA_LINHA" ELSE 0 END), 0) as tubos
    FROM cache_tubos_conexoes
    WHERE "IDVENDEDOR" = '0'
  `);
  console.log(res.rows[0]);
  console.log(typeof res.rows[0].tubos);
  console.log(Number(res.rows[0].tubos) === 0);
  await c.end();
}
run();
