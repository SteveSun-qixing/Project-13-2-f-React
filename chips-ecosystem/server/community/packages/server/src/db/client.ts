import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

/**
 * Drizzle 客户端（《社区平台设计》§2.2 db/ 职责）。
 * 连接参数由调用方传入；测试不触达真实 PostgreSQL（仓库端口以内存 fake 替换）。
 */

export type CommunityDb = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: CommunityDb;
  close(): Promise<void>;
}

export function buildDb(databaseUrl: string, options?: { log?: boolean }): DbHandle {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', (error) => {
    // 连接池空闲错误只记录，不中断进程（下个取用会重建连接）。
    console.error('PostgreSQL 连接池错误:', error.message);
  });
  const db = drizzle(pool, { schema, logger: options?.log === true });
  return {
    db,
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
