import { pgAll } from './server/pg-client';

async function diagnose() {
  const members = await pgAll(`
    SELECT m.salesperson_id, g.name as group_name
    FROM vendor_group_members m
    JOIN vendor_groups g ON m.group_id = g.id
    WHERE g.name = 'VENDAS EXTERNAS'
  `);
  console.log("VENDAS EXTERNAS members in DB:", members);
}

diagnose().catch(console.error);
