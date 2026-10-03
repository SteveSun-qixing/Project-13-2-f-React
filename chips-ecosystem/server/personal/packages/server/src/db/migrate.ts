import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PersonalDb } from './client.js';

/**
 * 启动迁移（《个人服务器设计》§2.2 db/：启动时自动执行迁移）。
 * 迁移产物由 drizzle-kit generate 生成于 src/db/migrations，构建期原样拷贝到 dist。
 */
export async function runMigrations(db: PersonalDb, migrationsFolder: string): Promise<void> {
  await migrate(db, { migrationsFolder });
}
