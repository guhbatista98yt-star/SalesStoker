import { Client } from 'pg';
const c = new Client({ connectionString: 'postgresql://postgres:1234@127.0.0.1:5435/database' });
c.connect()
  .then(() => c.query('SELECT DISTINCT "FABRICANTE", "TIPO_PRODUTO" FROM cache_tubos_conexoes LIMIT 20'))
  .then(r => { console.table(r.rows); return c.end(); })
  .catch(e => console.error(e));
