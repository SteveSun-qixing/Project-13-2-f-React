import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env';
import * as schema from './schema/index';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

export const db = drizzle(pool, { schema, logger: env.NODE_ENV === 'development' });

export type Database = typeof db;

/** 关闭数据库连接池（用于优雅退出） */
export async function closeDb(): Promise<void> {
  await pool.end();
}
