import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "database.db");

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("\nUso: node scripts/create-user.js <email> <senha> [nome] [sobrenome]");
  console.log("\nExemplo:");
  console.log("  node scripts/create-user.js admin@empresa.com 123456 Admin Sistema\n");
  process.exit(1);
}

const [email, password, firstName = null, lastName = null] = args;

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (existing) {
  console.log(`\nErro: O email "${email}" já está cadastrado.\n`);
  process.exit(1);
}

const hashedPassword = bcrypt.hashSync(password, 10);

const result = db.prepare(`
  INSERT INTO users (email, password, first_name, last_name)
  VALUES (?, ?, ?, ?)
`).run(email, hashedPassword, firstName, lastName);

console.log(`\nUsuário criado com sucesso!`);
console.log(`  ID: ${result.lastInsertRowid}`);
console.log(`  Email: ${email}`);
console.log(`  Nome: ${firstName || "(não informado)"} ${lastName || ""}\n`);

db.close();
