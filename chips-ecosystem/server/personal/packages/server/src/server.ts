import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadAppConfig } from './config/env.js';
import { buildDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { createDrizzleRepositories } from './repositories/drizzle/index.js';
import { buildApp } from './app.js';

/**
 * API 进程入口（《个人服务器设计》§2.1 单进程形态）：加载配置（校验失败拒绝启动）→
 * 连接数据库 → 自动迁移 → 组装 Fastify → 监听 → 优雅退出。
 */

async function main(): Promise<void> {
  const config = loadAppConfig();
  const handle = buildDb(config.databaseUrl, { log: config.nodeEnv === 'development' });

  const here = path.dirname(fileURLToPath(import.meta.url));
  await runMigrations(handle.db, path.join(here, 'db', 'migrations'));
  const repositories = createDrizzleRepositories(handle.db);

  const require = createRequire(import.meta.url);
  const { version } = require('../package.json') as { version: string };

  const app = await buildApp({ config, repositories, version });

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`薯片个人服务器 API 已就绪：${config.baseUrl}（API 版本 v1，实现版本 ${version}）`);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    app.log.info(`收到 ${signal}，开始优雅退出`);
    try {
      await app.close();
      await handle.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, '优雅退出失败');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

main().catch((error: unknown) => {
  console.error('服务端启动失败:', error);
  process.exit(1);
});
