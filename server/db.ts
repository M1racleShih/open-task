import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
export const connectionString =
  process.env.DATABASE_URL ??
  "postgres://open_task:open-task-local-only@127.0.0.1:55432/open_task";
export const pool = new pg.Pool({
  connectionString,
  max: 12,
  connectionTimeoutMillis: 5000,
});
export const db = drizzle(pool);
export async function transaction<T>(
  fn: (c: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
