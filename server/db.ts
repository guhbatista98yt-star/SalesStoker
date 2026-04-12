import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "database.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

// Inicializa o schema do banco de dados
function initializeSchema() {
  const schemaPath = path.join(process.cwd(), "scripts", "database-schema.sql");
  
  if (fs.existsSync(schemaPath)) {
    try {
      const schema = fs.readFileSync(schemaPath, "utf-8");
      
      // Divide o schema em statements individuais e executa cada um
      const statements = schema
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith("--"));
      
      for (const statement of statements) {
        try {
          sqlite.exec(statement + ";");
        } catch (err) {
          // Ignora erros de "already exists" ou views
          const errorMessage = (err as Error).message || "";
          if (!errorMessage.includes("already exists")) {
            console.warn(`Schema warning: ${errorMessage}`);
          }
        }
      }
      
      console.log("Database schema initialized successfully");
    } catch (err) {
      console.error("Failed to initialize schema:", err);
    }
  }
}

initializeSchema();

export const db = drizzle(sqlite);
export { sqlite };
