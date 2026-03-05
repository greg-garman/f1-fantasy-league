import { createPool, type VercelPoolClient } from '@vercel/postgres';

const pool = createPool();

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | undefined> {
  const { rows } = await pool.query(text, params);
  return rows[0] as T | undefined;
}

export async function execute(text: string, params?: any[]): Promise<number> {
  const { rowCount } = await pool.query(text, params);
  return rowCount ?? 0;
}

export async function executeReturning<T = any>(text: string, params?: any[]): Promise<T> {
  const { rows } = await pool.query(text, params);
  return rows[0] as T;
}

export async function transaction<T>(fn: (client: VercelPoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export { pool };
