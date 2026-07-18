// ============================================================
// Database Connection Pool — MySQL2
// ============================================================

import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Initialize the MySQL connection pool.
 * Call this once at server startup.
 */
export function initDatabase(config: DbConfig): mysql.Pool {
  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  console.log(
    `[DB] Connection pool created → ${config.host}:${config.port}/${config.database}`
  );

  return pool;
}

/**
 * Get the active connection pool.
 * Throws if initDatabase() has not been called.
 */
export function getPool(): mysql.Pool {
  if (!pool) {
    throw new Error(
      "[DB] Connection pool not initialized. Call initDatabase() first."
    );
  }
  return pool;
}

/**
 * Execute a query against the pool.
 * Convenience wrapper around pool.execute().
 */
export async function query<T extends mysql.RowDataPacket[]>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const p = getPool();
  const [rows] = await p.execute<T>(sql, params);
  return rows;
}

/**
 * Execute an INSERT/UPDATE/DELETE and return the result metadata.
 */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<mysql.ResultSetHeader> {
  const p = getPool();
  const [result] = await p.execute<mysql.ResultSetHeader>(sql, params);
  return result;
}

/**
 * Close the connection pool gracefully.
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("[DB] Connection pool closed.");
  }
}

// Re-export everything
export { initSchema } from "./schema.js";
export * from "./queries.js";
