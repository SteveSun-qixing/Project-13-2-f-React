import { buildApp } from './app';
import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { initStorageBuckets } from './storage/init';
import { closeDb } from './db/client';

async function start(): Promise<void> {
  // 1. 运行数据库迁移
  await runMigrations();

  // 2. 初始化对象存储 bucket
  await initStorageBuckets();

  // 3. 构建并启动 Fastify
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running at http://${env.HOST}:${env.PORT}`);
    if (env.ENABLE_SWAGGER) {
      app.log.info(`API docs available at ${env.BASE_URL}/api/docs`);
    }
  } catch (err) {
    app.log.error(err);
    await shutdown(app);
    process.exit(1);
  }

  // ─── 优雅退出 ─────────────────────────────────────────────────

  async function shutdown(server: Awaited<ReturnType<typeof buildApp>>): Promise<void> {
    await server.close();
    await closeDb();
  }

  const handleSignal = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await shutdown(app);
    process.exit(0);
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('uncaughtException', (err) => {
    app.log.error({ err }, 'Uncaught exception');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    app.log.error({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
}

start();
