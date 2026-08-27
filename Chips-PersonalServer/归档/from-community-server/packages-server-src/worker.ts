import { randomUUID } from 'crypto';
import { env } from './config/env';
import { runMigrations } from './db/migrate';
import { connectRedis, closeRedis } from './cache/redis';
import { initStorageBuckets } from './storage/init';
import { closeDb } from './db/client';
import { hostIntegration } from './services/host-integration';
import { CardRenderCacheService } from './services/card-render-cache.service';

let shuttingDown = false;
let cleanerTimer: NodeJS.Timeout | null = null;

async function runWorkerLoop(workerId: string): Promise<void> {
  while (!shuttingDown) {
    const jobId = await CardRenderCacheService.takeNextJobId();
    if (!jobId || shuttingDown) {
      continue;
    }

    try {
      const result = await CardRenderCacheService.processJob(jobId, workerId);
      console.info(`[CardRenderWorker] ${workerId} processed job ${jobId}: ${result.status}`);
    } catch (error) {
      console.error(`[CardRenderWorker] ${workerId} failed while processing job ${jobId}:`, error);
    }
  }
}

async function runCacheCleanerOnce(): Promise<void> {
  try {
    const deleted = await CardRenderCacheService.deleteExpiredCaches();
    if (deleted > 0) {
      console.info(`[CardRenderCleaner] Deleted ${deleted} expired render cache(s).`);
    }
  } catch (error) {
    console.error('[CardRenderCleaner] Failed to clean expired render caches:', error);
  }
}

async function start(): Promise<void> {
  await runMigrations();
  await connectRedis();
  await initStorageBuckets();
  await hostIntegration.init();

  const workerId = `card-render-worker-${randomUUID()}`;
  const requeued = await CardRenderCacheService.requeueStaleProcessingJobs(workerId);
  if (requeued > 0) {
    console.info(`[CardRenderWorker] Requeued ${requeued} stale jobs.`);
  }

  const workerCount = env.CARD_RENDER_WORKER_CONCURRENCY;
  console.info(`[CardRenderWorker] Starting ${workerCount} worker loop(s) as ${workerId}.`);

  await runCacheCleanerOnce();
  cleanerTimer = setInterval(() => {
    void runCacheCleanerOnce();
  }, 60 * 60 * 1000);

  await Promise.all(
    Array.from({ length: workerCount }, (_, index) => runWorkerLoop(`${workerId}-${index + 1}`)),
  );
}

async function shutdown(): Promise<void> {
  shuttingDown = true;
  if (cleanerTimer) {
    clearInterval(cleanerTimer);
    cleanerTimer = null;
  }
  await hostIntegration.stop();
  await closeRedis();
  await closeDb();
}

process.on('SIGTERM', () => {
  void shutdown().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  void shutdown().then(() => process.exit(0));
});

process.on('uncaughtException', (error) => {
  console.error('[CardRenderWorker] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CardRenderWorker] Unhandled rejection:', reason);
  process.exit(1);
});

start().catch(async (error) => {
  console.error('[CardRenderWorker] Failed to start:', error);
  await shutdown().catch(() => undefined);
  process.exit(1);
});
