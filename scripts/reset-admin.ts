/**
 * Run this script to reset (or create) the admin user.
 * Usage: npx tsx scripts/reset-admin.ts
 *
 * It will:
 *  - Create an admin user with login "admin" if it doesn't exist
 *  - Or reset the password of the first existing admin user
 * Default credentials after running: login = admin  /  password = admin123
 */

import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;

const NEW_PASSWORD = "admin123";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const hashed = await bcrypt.hash(NEW_PASSWORD, 10);

  // Check if any admin exists
  const { rows } = await client.query(
    `SELECT id, email, first_name FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`
  );

  if (rows.length === 0) {
    // No admin — create one
    await client.query(
      `INSERT INTO users (email, password, first_name, role) VALUES ($1, $2, $3, 'admin')`,
      ["admin", hashed, "Administrador"]
    );
    console.log("✅ Admin criado com sucesso!");
    console.log("   Login:  admin");
    console.log("   Senha:  admin123");
  } else {
    const u = rows[0];
    await client.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashed, u.id]);
    console.log(`✅ Senha do admin redefinida com sucesso!`);
    console.log(`   Login:  ${u.email}`);
    console.log("   Senha:  admin123");
  }

  await client.end();
}

main().catch(e => {
  console.error("Erro:", e.message);
  process.exit(1);
});
