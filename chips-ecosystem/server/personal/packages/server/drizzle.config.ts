import { defineConfig } from 'drizzle-kit';

/** 迁移生成配置：只读 schema 生成 SQL（generate 为离线操作，不连接数据库）。 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  strict: true,
  verbose: false,
});
