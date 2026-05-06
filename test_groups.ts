import { TeamRepository } from './server/repositories/team.repository';
import { db } from './server/db'; // Wait, do we need to initialize DB?

// Let's just run the exact code from teamRepo
import { Client } from 'pg';

async function run() {
  const c = new Client({ connectionString: "postgresql://postgres:1234@127.0.0.1:5435/database" });
  await c.connect();
  
  const groups = await c.query('SELECT * FROM vendor_groups ORDER BY name');
  const result = await Promise.all(groups.rows.map(async (g) => {
    const members = await c.query('SELECT salesperson_id FROM vendor_group_members WHERE group_id = $1', [g.id]);
    return { id: g.id, name: g.name, members: members.rows.map(m => m.salesperson_id) };
  }));
  
  console.log(JSON.stringify(result, null, 2));

  await c.end();
}
run();
