import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { CommunityDb } from './client.js';

/**
 * 启动迁移（《社区平台设计》§2.2：启动与 Worker 启动时自动执行迁移）。
 * 迁移产物由 drizzle-kit generate 生成于 src/db/migrations，构建期原样拷贝到 dist。
 */
export async function runMigrations(db: CommunityDb, migrationsFolder: string): Promise<void> {
  await migrate(db, { migrationsFolder });
}
