import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { db } from '../db/client';
import {
  cardRenderCaches,
  cardRenderJobs,
  type CardRenderCache,
  type CardRenderJob,
  type NewCardRenderCache,
  type NewCardRenderJob,
} from '../db/schema/card-render';
import { cards, type Card } from '../db/schema/cards';
import { env } from '../config/env';
import { Bucket } from '../storage/buckets';
import {
  buildObjectUrl,
  deleteObjectsByPrefix,
  downloadFile,
  getObjectStream,
  uploadFile,
} from '../storage/s3';
import { hostIntegration } from './host-integration';
import { mapWithConcurrency } from '../utils/async';
import { createDefaultCoverHtml, isEmptyCoverHtml } from '../utils/card-file';
import { unpackCard } from '../pipeline/card-unpack';

const RENDER_QUEUE_KEY = 'ccps:card-render:queue';
const DEFAULT_LOCALE = 'zh-CN';
const VIEW_RENDER_PROFILE = 'community-web';
const COVER_RENDER_PROFILE = 'community-cover';
const CACHE_TTL_MS = env.CARD_RENDER_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
const JOB_STALE_MS = 30 * 60 * 1000;

function addCacheTtl(from = new Date()): Date {
  return new Date(from.getTime() + CACHE_TTL_MS);
}

function resolveSourceVersion(card: Pick<Card, 'sourceCardSha256' | 'sourceCardKey'>): string {
  return card.sourceCardSha256 ?? (card.sourceCardKey ? `network-card:${card.sourceCardKey}` : 'missing-source');
}

function createCacheVersion(
  card: Pick<Card, 'id' | 'sourceCardSha256' | 'sourceCardKey'>,
  renderProfile: string,
  locale = DEFAULT_LOCALE,
): string {
  return [
    env.CARD_RENDERER_VERSION,
    renderProfile,
    env.HOST_ACTIVE_THEME_ID,
    locale,
    resolveSourceVersion(card),
  ].join('__').replace(/[^a-zA-Z0-9._-]/g, '-');
}

function createCacheBucket(card: Pick<Card, 'visibility'>, renderProfile: string): string {
  if (renderProfile === COVER_RENDER_PROFILE) {
    return card.visibility === 'private' ? Bucket.CARD_COVER_CACHE_PRIVATE : Bucket.CARD_COVER_CACHE;
  }
  return card.visibility === 'private' ? Bucket.CARD_RENDER_CACHE_PRIVATE : Bucket.CARD_RENDER_CACHE;
}

function isPublicCacheBucket(bucket: string): bucket is typeof Bucket.CARD_RENDER_CACHE | typeof Bucket.CARD_COVER_CACHE {
  return bucket === Bucket.CARD_RENDER_CACHE || bucket === Bucket.CARD_COVER_CACHE;
}

function createPrivateCacheRoute(params: {
  cardId: string;
  renderProfile: string;
  cacheVersion: string;
  assetPath: string;
}): string {
  const route = params.renderProfile === COVER_RENDER_PROFILE ? 'cover-cache' : 'render-cache';
  return `/api/v1/cards/${params.cardId}/${route}/${params.cacheVersion}/${params.assetPath}`;
}

function createEntryUrl(params: {
  cardId: string;
  cacheBucket: string;
  cacheVersion: string;
  entryObjectKey: string;
  renderProfile: string;
}): string {
  if (isPublicCacheBucket(params.cacheBucket)) {
    return buildObjectUrl(params.cacheBucket, params.entryObjectKey);
  }

  return createPrivateCacheRoute({
    cardId: params.cardId,
    renderProfile: params.renderProfile,
    cacheVersion: params.cacheVersion,
    assetPath: 'index.html',
  });
}

function listFilesRecursive(rootDir: string): string[] {
  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        files.push(path.relative(rootDir, absolutePath).split(path.sep).join('/'));
      }
    }
  }

  files.sort();
  return files;
}

async function uploadDirectory(params: {
  rootDir: string;
  bucket: string;
  keyPrefix: string;
}): Promise<{ sizeBytes: number; fileCount: number }> {
  const files = listFilesRecursive(params.rootDir);
  const stats = files.map((relativePath) => ({
    relativePath,
    size: fs.statSync(path.join(params.rootDir, relativePath)).size,
  }));
  const sizeBytes = stats.reduce((total, item) => total + item.size, 0);

  await mapWithConcurrency(stats, env.CARD_RENDER_CACHE_UPLOAD_CONCURRENCY, async ({ relativePath }) => {
    const absolutePath = path.join(params.rootDir, relativePath);
    await uploadFile({
      bucket: params.bucket,
      key: `${params.keyPrefix}/${relativePath}`,
      filePath: absolutePath,
    });
  });

  return { sizeBytes, fileCount: stats.length };
}

function copyCoverAssets(unpackedCardDir: string, coverOutputDir: string): void {
  const coverAssetDir = path.join(unpackedCardDir, '.card', 'cardcover');
  if (!fs.existsSync(coverAssetDir)) {
    return;
  }

  fs.cpSync(coverAssetDir, path.join(coverOutputDir, 'cardcover'), {
    recursive: true,
    force: true,
  });
}

function normalizeCacheAssetPath(assetPath: string): string {
  const normalized = path.posix.normalize(assetPath.replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Invalid render cache asset path: ${assetPath}`);
  }
  return normalized;
}

export const CardRenderCacheService = {
  queueKey: RENDER_QUEUE_KEY,
  viewRenderProfile: VIEW_RENDER_PROFILE,
  coverRenderProfile: COVER_RENDER_PROFILE,

  getRendererVersion(): string {
    return env.CARD_RENDERER_VERSION;
  },

  async enqueueForCard(params: {
    cardId: string;
    createdBy: 'upload' | 'view_miss' | 'cover_miss' | 'manual' | 'system_rebuild';
    renderProfile?: string;
    priority?: number;
  }): Promise<CardRenderJob | null> {
    const card = await db.query.cards.findFirst({
      where: eq(cards.id, params.cardId),
    });

    if (!card || !card.sourceCardBucket || !card.sourceCardKey) {
      return null;
    }

    const locale = DEFAULT_LOCALE;
    const renderProfile = params.renderProfile ?? VIEW_RENDER_PROFILE;
    const sourceVersion = resolveSourceVersion(card);
    const existingReady = await this.findReadyCache(card.id, { renderProfile });
    if (existingReady) {
      return null;
    }

    const existingJob = await db.query.cardRenderJobs.findFirst({
      where: and(
        eq(cardRenderJobs.cardId, card.id),
        eq(cardRenderJobs.sourceCardSha256, sourceVersion),
        eq(cardRenderJobs.rendererVersion, env.CARD_RENDERER_VERSION),
        eq(cardRenderJobs.renderProfile, renderProfile),
        eq(cardRenderJobs.locale, locale),
        or(eq(cardRenderJobs.status, 'queued'), eq(cardRenderJobs.status, 'processing')),
      ),
    });

    if (existingJob) {
      if (existingJob.status === 'queued') {
        await this.pushJob(existingJob.id);
      }
      return existingJob;
    }

    const [job] = await db
      .insert(cardRenderJobs)
      .values({
        cardId: card.id,
        sourceCardSha256: sourceVersion,
        rendererVersion: env.CARD_RENDERER_VERSION,
        renderProfile,
        locale,
        priority: params.priority ?? (params.createdBy === 'view_miss' || params.createdBy === 'cover_miss' ? 10 : 100),
        maxAttempts: env.CARD_RENDER_JOB_MAX_ATTEMPTS,
        createdBy: params.createdBy,
      } satisfies Partial<NewCardRenderJob> as NewCardRenderJob)
      .returning();

    await this.pushJob(job.id);
    return job;
  },

  async findReadyCache(cardId: string, options?: { renderProfile?: string }): Promise<CardRenderCache | null> {
    const card = await db.query.cards.findFirst({
      where: eq(cards.id, cardId),
      columns: {
        id: true,
        sourceCardSha256: true,
        sourceCardKey: true,
      },
    });
    if (!card) {
      return null;
    }

    const sourceVersion = resolveSourceVersion(card);
    const now = new Date();
    const result = await db.query.cardRenderCaches.findFirst({
      where: and(
        eq(cardRenderCaches.cardId, cardId),
        eq(cardRenderCaches.sourceCardSha256, sourceVersion),
        eq(cardRenderCaches.rendererVersion, env.CARD_RENDERER_VERSION),
        eq(cardRenderCaches.renderProfile, options?.renderProfile ?? VIEW_RENDER_PROFILE),
        eq(cardRenderCaches.themeId, env.HOST_ACTIVE_THEME_ID),
        eq(cardRenderCaches.locale, DEFAULT_LOCALE),
        eq(cardRenderCaches.status, 'ready'),
      ),
      orderBy: [desc(cardRenderCaches.generatedAt)],
    });

    if (!result || !result.expiresAt || result.expiresAt <= now) {
      return null;
    }

    return result;
  },

  async touchCache(cacheId: string): Promise<CardRenderCache> {
    const now = new Date();
    const [updated] = await db
      .update(cardRenderCaches)
      .set({
        lastAccessedAt: now,
        expiresAt: addCacheTtl(now),
        updatedAt: now,
      })
      .where(eq(cardRenderCaches.id, cacheId))
      .returning();
    return updated;
  },

  async getLatestJob(cardId: string, options?: { renderProfile?: string }): Promise<CardRenderJob | null> {
    const job = await db.query.cardRenderJobs.findFirst({
      where: and(
        eq(cardRenderJobs.cardId, cardId),
        eq(cardRenderJobs.renderProfile, options?.renderProfile ?? VIEW_RENDER_PROFILE),
      ),
      orderBy: [desc(cardRenderJobs.createdAt)],
    });
    return job ?? null;
  },

  async pushJob(jobId: string): Promise<void> {
    const { getRedis } = await import('../cache/redis.js');
    await getRedis().lpush(RENDER_QUEUE_KEY, jobId);
  },

  async takeNextJobId(): Promise<string | null> {
    const { getRedis } = await import('../cache/redis.js');
    const result = await getRedis().brpop(RENDER_QUEUE_KEY, env.CARD_RENDER_QUEUE_POLL_TIMEOUT_SEC);
    return result?.[1] ?? null;
  },

  async requeueStaleProcessingJobs(workerId: string): Promise<number> {
    const staleBefore = new Date(Date.now() - JOB_STALE_MS);
    const staleJobs = await db.query.cardRenderJobs.findMany({
      where: and(
        eq(cardRenderJobs.status, 'processing'),
        lt(cardRenderJobs.lockedAt, staleBefore),
      ),
    });

    for (const job of staleJobs) {
      await db
        .update(cardRenderJobs)
        .set({
          status: 'queued',
          lockedBy: null,
          lockedAt: null,
          lastError: `Worker ${job.lockedBy ?? 'unknown'} timed out; requeued by ${workerId}`,
          updatedAt: new Date(),
        })
        .where(eq(cardRenderJobs.id, job.id));
      await this.pushJob(job.id);
    }

    return staleJobs.length;
  },

  async processJob(jobId: string, workerId: string): Promise<{ status: string; jobId: string }> {
    const job = await db.query.cardRenderJobs.findFirst({ where: eq(cardRenderJobs.id, jobId) });
    if (!job || job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return { status: 'stale', jobId };
    }

    const [lockedJob] = await db
      .update(cardRenderJobs)
      .set({
        status: 'processing',
        lockedBy: workerId,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cardRenderJobs.id, jobId),
          eq(cardRenderJobs.status, 'queued'),
          isNull(cardRenderJobs.lockedAt),
        ),
      )
      .returning();

    if (!lockedJob) {
      return { status: 'stale', jobId };
    }

    try {
      await this.renderJob(lockedJob);
      await db
        .update(cardRenderJobs)
        .set({
          status: 'succeeded',
          lockedBy: workerId,
          finishedAt: new Date(),
          updatedAt: new Date(),
          lastError: null,
        })
        .where(eq(cardRenderJobs.id, lockedJob.id));
      return { status: 'succeeded', jobId };
    } catch (error) {
      const attemptCount = lockedJob.attemptCount + 1;
      const shouldRetry = attemptCount < lockedJob.maxAttempts;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await db
        .update(cardRenderJobs)
        .set({
          status: shouldRetry ? 'queued' : 'failed',
          attemptCount,
          lockedBy: shouldRetry ? null : workerId,
          lockedAt: shouldRetry ? null : lockedJob.lockedAt,
          lastError: errorMessage,
          finishedAt: shouldRetry ? null : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(cardRenderJobs.id, lockedJob.id));

      if (lockedJob.renderCacheId) {
        await db
          .update(cardRenderCaches)
          .set({
            status: shouldRetry ? 'queued' : 'error',
            errorCode: 'CARD_RENDER_ERROR',
            errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(cardRenderCaches.id, lockedJob.renderCacheId));
      }

      if (shouldRetry) {
        await this.pushJob(lockedJob.id);
        return { status: 'retrying', jobId };
      }

      return { status: 'failed', jobId };
    }
  },

  async renderJob(job: CardRenderJob): Promise<CardRenderCache> {
    if (job.renderProfile === COVER_RENDER_PROFILE) {
      return this.renderCoverJob(job);
    }
    return this.renderViewJob(job);
  },

  async renderViewJob(job: CardRenderJob): Promise<CardRenderCache> {
    const card = await db.query.cards.findFirst({ where: eq(cards.id, job.cardId) });
    if (!card || !card.sourceCardBucket || !card.sourceCardKey) {
      throw new Error(`Card source file is missing for render job ${job.id}`);
    }

    const sourceVersion = resolveSourceVersion(card);
    const cacheBucket = createCacheBucket(card, job.renderProfile);
    const cacheVersion = createCacheVersion(card, job.renderProfile, job.locale);
    const cacheKeyPrefix = `${card.id}/${cacheVersion}`;
    const entryObjectKey = `${cacheKeyPrefix}/index.html`;
    const entryUrl = createEntryUrl({
      cardId: card.id,
      cacheBucket,
      cacheVersion,
      entryObjectKey,
      renderProfile: job.renderProfile,
    });

    const [cache] = await db
      .insert(cardRenderCaches)
      .values({
        cardId: card.id,
        sourceCardSha256: sourceVersion,
        rendererVersion: job.rendererVersion,
        renderProfile: job.renderProfile,
        locale: job.locale,
        themeId: env.HOST_ACTIVE_THEME_ID,
        status: 'rendering',
        cacheBucket,
        cacheKeyPrefix,
        entryObjectKey,
        entryUrl,
        pluginVersionManifest: {},
      } satisfies Partial<NewCardRenderCache> as NewCardRenderCache)
      .onConflictDoUpdate({
        target: [cardRenderCaches.cacheBucket, cardRenderCaches.cacheKeyPrefix],
        set: {
          status: 'rendering',
          errorCode: null,
          errorMessage: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await db
      .update(cardRenderJobs)
      .set({ renderCacheId: cache.id, updatedAt: new Date() })
      .where(eq(cardRenderJobs.id, job.id));

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `ccps-card-render-${card.id}-`));
    const sourcePath = path.join(workDir, 'source.card');
    const htmlOutputDir = path.join(workDir, 'html');

    try {
      await downloadFile({
        bucket: card.sourceCardBucket,
        key: card.sourceCardKey,
        filePath: sourcePath,
      });

      await hostIntegration.convertCardToHtml({
        cardFile: sourcePath,
        outputPath: htmlOutputDir,
        overwrite: true,
        locale: job.locale,
        themeId: env.HOST_ACTIVE_THEME_ID,
      });

      const uploaded = await uploadDirectory({
        rootDir: htmlOutputDir,
        bucket: cacheBucket,
        keyPrefix: cacheKeyPrefix,
      });

      const now = new Date();
      const [updated] = await db
        .update(cardRenderCaches)
        .set({
          status: 'ready',
          entryUrl,
          coverObjectKey: null,
          coverUrl: null,
          renderManifest: {
            fileCount: uploaded.fileCount,
            cacheVersion,
            entryObjectKey,
            renderProfile: job.renderProfile,
          },
          sizeBytes: uploaded.sizeBytes,
          generatedAt: now,
          lastAccessedAt: now,
          expiresAt: addCacheTtl(now),
          errorCode: null,
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(cardRenderCaches.id, cache.id))
        .returning();

      await db
        .update(cards)
        .set({
          htmlUrl: entryUrl,
          status: 'ready',
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(cards.id, card.id));

      return updated;
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  },

  async renderCoverJob(job: CardRenderJob): Promise<CardRenderCache> {
    const card = await db.query.cards.findFirst({ where: eq(cards.id, job.cardId) });
    if (!card || !card.sourceCardBucket || !card.sourceCardKey) {
      throw new Error(`Card source file is missing for cover render job ${job.id}`);
    }

    const sourceVersion = resolveSourceVersion(card);
    const cacheBucket = createCacheBucket(card, job.renderProfile);
    const cacheVersion = createCacheVersion(card, job.renderProfile, job.locale);
    const cacheKeyPrefix = `${card.id}/${cacheVersion}`;
    const entryObjectKey = `${cacheKeyPrefix}/index.html`;
    const entryUrl = createEntryUrl({
      cardId: card.id,
      cacheBucket,
      cacheVersion,
      entryObjectKey,
      renderProfile: job.renderProfile,
    });

    const [cache] = await db
      .insert(cardRenderCaches)
      .values({
        cardId: card.id,
        sourceCardSha256: sourceVersion,
        rendererVersion: job.rendererVersion,
        renderProfile: job.renderProfile,
        locale: job.locale,
        themeId: env.HOST_ACTIVE_THEME_ID,
        status: 'rendering',
        cacheBucket,
        cacheKeyPrefix,
        entryObjectKey,
        entryUrl,
        coverObjectKey: entryObjectKey,
        coverUrl: entryUrl,
        pluginVersionManifest: {},
      } satisfies Partial<NewCardRenderCache> as NewCardRenderCache)
      .onConflictDoUpdate({
        target: [cardRenderCaches.cacheBucket, cardRenderCaches.cacheKeyPrefix],
        set: {
          status: 'rendering',
          errorCode: null,
          errorMessage: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await db
      .update(cardRenderJobs)
      .set({ renderCacheId: cache.id, updatedAt: new Date() })
      .where(eq(cardRenderJobs.id, job.id));

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `ccps-card-cover-${card.id}-`));
    const sourcePath = path.join(workDir, 'source.card');
    const coverOutputDir = path.join(workDir, 'cover');

    try {
      await downloadFile({
        bucket: card.sourceCardBucket,
        key: card.sourceCardKey,
        filePath: sourcePath,
      });

      const unpacked = await unpackCard(sourcePath);
      try {
        fs.mkdirSync(coverOutputDir, { recursive: true });
        const coverHtml = isEmptyCoverHtml(unpacked.coverHtml ?? null)
          ? createDefaultCoverHtml(card.title)
          : unpacked.coverHtml as string;
        fs.writeFileSync(path.join(coverOutputDir, 'index.html'), coverHtml, 'utf-8');
        copyCoverAssets(unpacked.tempDir, coverOutputDir);
      } finally {
        fs.rmSync(unpacked.tempDir, { recursive: true, force: true });
      }

      const uploaded = await uploadDirectory({
        rootDir: coverOutputDir,
        bucket: cacheBucket,
        keyPrefix: cacheKeyPrefix,
      });

      const now = new Date();
      const [updated] = await db
        .update(cardRenderCaches)
        .set({
          status: 'ready',
          entryUrl,
          coverObjectKey: entryObjectKey,
          coverUrl: entryUrl,
          renderManifest: {
            fileCount: uploaded.fileCount,
            cacheVersion,
            entryObjectKey,
            renderProfile: job.renderProfile,
            includesCardCoverAssets: fs.existsSync(path.join(coverOutputDir, 'cardcover')),
          },
          sizeBytes: uploaded.sizeBytes,
          generatedAt: now,
          lastAccessedAt: now,
          expiresAt: addCacheTtl(now),
          errorCode: null,
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(cardRenderCaches.id, cache.id))
        .returning();

      await db
        .update(cards)
        .set({
          coverUrl: `/api/v1/cards/${card.id}/cover`,
          status: 'ready',
          errorMessage: null,
          updatedAt: now,
        })
        .where(eq(cards.id, card.id));

      return updated;
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  },

  async deleteExpiredCaches(limit = 100): Promise<number> {
    const now = new Date();
    const expired = await db.query.cardRenderCaches.findMany({
      where: and(
        eq(cardRenderCaches.status, 'ready'),
        lt(cardRenderCaches.expiresAt, now),
      ),
      limit,
    });

    let deleted = 0;
    for (const cache of expired) {
      const [marked] = await db
        .update(cardRenderCaches)
        .set({ status: 'deleting', updatedAt: new Date() })
        .where(and(
          eq(cardRenderCaches.id, cache.id),
          eq(cardRenderCaches.status, 'ready'),
          lt(cardRenderCaches.expiresAt, now),
        ))
        .returning();

      if (!marked) {
        continue;
      }

      await deleteObjectsByPrefix(marked.cacheBucket, `${marked.cacheKeyPrefix}/`);
      await db
        .update(cardRenderCaches)
        .set({ status: 'deleted', updatedAt: new Date() })
        .where(eq(cardRenderCaches.id, marked.id));
      deleted += 1;
    }

    return deleted;
  },

  async deleteCachesForCard(cardId: string): Promise<number> {
    const existingCaches = await db.query.cardRenderCaches.findMany({
      where: eq(cardRenderCaches.cardId, cardId),
    });

    await Promise.all([
      deleteObjectsByPrefix(Bucket.CARD_RENDER_CACHE, `${cardId}/`),
      deleteObjectsByPrefix(Bucket.CARD_RENDER_CACHE_PRIVATE, `${cardId}/`),
      deleteObjectsByPrefix(Bucket.CARD_COVER_CACHE, `${cardId}/`),
      deleteObjectsByPrefix(Bucket.CARD_COVER_CACHE_PRIVATE, `${cardId}/`),
    ]);

    await db
      .update(cardRenderCaches)
      .set({
        status: 'deleted',
        updatedAt: new Date(),
      })
      .where(eq(cardRenderCaches.cardId, cardId));

    return existingCaches.length;
  },

  async streamPrivateCache(params: {
    cardId: string;
    renderProfile?: string;
    cacheVersion: string;
    assetPath: string;
    range?: string;
  }) {
    const keyPrefix = `${params.cardId}/${params.cacheVersion}`;
    const assetPath = normalizeCacheAssetPath(params.assetPath);
    return getObjectStream({
      bucket: params.renderProfile === COVER_RENDER_PROFILE
        ? Bucket.CARD_COVER_CACHE_PRIVATE
        : Bucket.CARD_RENDER_CACHE_PRIVATE,
      key: `${keyPrefix}/${assetPath}`,
      range: params.range,
    });
  },
};
