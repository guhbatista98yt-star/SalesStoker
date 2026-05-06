import { pool } from './server/pg-client';

async function main() {
  const res = await pool.query(`
    SELECT "column_name" FROM information_schema.columns 
    WHERE table_name = 'cache_campanhas'
  `);
  console.log("CACHE CAMPANHAS COLUMNS:", res.rows.map(r => r.column_name));
  process.exit(0);
}

main().catch(console.error);
