import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle pg client", err);
});

function toNumbered(query: string): string {
  let n = 0;
  return query.replace(/\?/g, () => `$${++n}`);
}

export async function pgGet<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
  const r = await pool.query(toNumbered(sql), params);
  return r.rows[0] as T | undefined;
}

export async function pgAll<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const r = await pool.query(toNumbered(sql), params);
  return r.rows as T[];
}

export async function pgRun(sql: string, params?: any[]): Promise<number> {
  const r = await pool.query(toNumbered(sql), params);
  return r.rowCount ?? 0;
}

export async function pgExec(sql: string): Promise<void> {
  await pool.query(sql);
}
