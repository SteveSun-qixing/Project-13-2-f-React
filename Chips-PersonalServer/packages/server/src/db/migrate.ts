import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';
import { db, closeDb } from './client';

async function runMigrations(): Promise<void> {
  const migrationsFolder = path.resolve(__dirname, './migrations');

  console.info('Running database migrations...');
  await migrate(db, { migrationsFolder });
  console.info('Database migrations completed successfully.');
}

// 支持两种使用方式：
// 1. 直接执行：tsx src/db/migrate.ts
// 2. 作为模块在应用启动时调用
export { runMigrations };

if (require.main === module) {
  runMigrations()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
