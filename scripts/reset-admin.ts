/**
 * Redefine (ou cria) o usuário admin do sistema.
 *
 * COMO USAR (no shell do Replit):
 *   npx tsx scripts/reset-admin.ts
 *
 * Após executar: login = admin  /  senha = admin123
 * Troque a senha após o primeiro acesso.
 */

import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;

const NEW_PASSWORD = "admin123";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL não está definida.");
    console.error("   Este script precisa ser executado no shell do Replit,");
    console.error("   onde a variável de ambiente DATABASE_URL está disponível.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log("✅ Conectado ao banco de dados.");

  const hashed = await bcrypt.hash(NEW_PASSWORD, 10);

  const { rows } = await client.query(
    `SELECT id, email, first_name FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`
  );

  if (rows.length === 0) {
    await client.query(
      `INSERT INTO users (email, password, first_name, role) VALUES ($1, $2, $3, 'admin')`,
      ["admin", hashed, "Administrador"]
    );
    console.log("\n✅ Usuário admin criado com sucesso!");
    console.log("   Login : admin");
    console.log("   Senha : admin123");
  } else {
    const u = rows[0];
    await client.query(`UPDATE users SET password = $1 WHERE id = $2`, [hashed, u.id]);
    console.log(`\n✅ Senha redefinida com sucesso!`);
    console.log(`   Login : ${u.email}`);
    console.log("   Senha : admin123");
  }

  await client.end();
  console.log("\n⚠️  Troque a senha após o primeiro acesso.");
}

main().catch(e => {
  console.error("❌ Erro:", e.message || e);
  process.exit(1);
});
