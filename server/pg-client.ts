/**
 * CONECTUBOS — PostgreSQL connection pool & query helpers
 *
 * Production-hardened pool settings:
 *   - Connection timeout prevents hung startup in broken environments
 *   - Idle timeout releases unused connections promptly
 *   - Pool cap prevents runaway connection growth under load
 *   - SSL in production only (Replit dev doesn't use SSL)
 *
 * Query helpers (pgGet, pgAll, pgRun) use ? placeholders for readability;
 * toNumbered() converts them to PostgreSQL-native $1, $2, … before execution.
 */

import { Pool, type PoolClient } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("[pg-client] DATABASE_URL não definida — impossível iniciar.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,

  // Maximum simultaneous connections — keeps DB resource usage predictable
  max: 10,

  // Time (ms) to wait for an available connection before throwing
  connectionTimeoutMillis: 8_000,

  // Close idle connections after 30 s to avoid stale sockets
  idleTimeoutMillis: 30_000,

  // Fail fast if the DB is unreachable (no indefinite retry)
  allowExitOnIdle: false,
});

pool.on("error", (err) => {
  console.error("[pg-client] Erro inesperado em conexão ociosa:", err.message);
});

// ---------------------------------------------------------------------------
// ? → $n placeholder converter
// ---------------------------------------------------------------------------

function toNumbered(query: string): string {
  let n = 0;
  return query.replace(/\?/g, () => `$${++n}`);
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Returns the first row, or undefined if no rows. */
export async function pgGet<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
  const r = await pool.query(toNumbered(sql), params);
  return r.rows[0] as T | undefined;
}

/** Returns all rows. */
export async function pgAll<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const r = await pool.query(toNumbered(sql), params);
  return r.rows as T[];
}

/** Executes a DML statement; returns affected row count. */
export async function pgRun(sql: string, params?: any[]): Promise<number> {
  const r = await pool.query(toNumbered(sql), params);
  return r.rowCount ?? 0;
}

/** Executes raw SQL without parameter substitution (DDL, etc.). */
export async function pgExec(sql: string): Promise<void> {
  await pool.query(sql);
}

// ---------------------------------------------------------------------------
// Transaction helper
// ---------------------------------------------------------------------------

/**
 * Runs `fn` inside a serialisable transaction.
 * Automatically commits on success and rolls back on any thrown error.
 * The connection is always released back to the pool.
 *
 * Usage:
 *   await pgTransaction(async (client) => {
 *     await client.query("INSERT INTO ...", [...]);
 *     await client.query("UPDATE ...",  [...]);
 *   });
 */
export async function pgTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
