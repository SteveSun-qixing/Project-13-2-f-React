import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { getRedis } from '../cache/redis';
import { env } from '../config/env';
import { db } from '../db/client';
import {
  cardPipelineJobs,
  type CardPipelineJob,
  type NewCardPipelineJob,
} from '../db/schema/card-pipeline-jobs';
import { cards } from '../db/schema/cards';
import { Bucket } from '../storage/buckets';
import { deleteObject, downloadFile, uploadFile } from '../storage/s3';
import { runCardPipeline } from '../pipeline/card-pipeline';

const QUEUE_KEY = 'ccps:card-pipeline:queue';
const INPUT_FILE_NAME = 'source.card';

export interface EnqueueCardPipelineJobInput {
  cardId: string;
  userId: string;
  sourceFilePath: string;
}

export interface CardPipelineJobProcessResult {
  status: 'succeeded' | 'retrying' | 'failed' | 'stale';
  jobId: string;
}

function createSourceKey(userId: string, cardId: string): string {
  return `${userId}/${cardId}/${INPUT_FILE_NAME}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return String(error);
}

async function pushJobId(jobId: string): Promise<void> {
  await getRedis().lpush(QUEUE_KEY, jobId);
}

export const CardPipelineQueueService = {
  queueKey: QUEUE_KEY,

  async enqueue(input: EnqueueCardPipelineJobInput): Promise<CardPipelineJob> {
    const existingJob = await db.query.cardPipelineJobs.findFirst({
      where: eq(cardPipelineJobs.cardId, input.cardId),
    });

    if (existingJob) {
      if (existingJob.status === 'queued') {
        await pushJobId(existingJob.id);
      }
      return existingJob;
    }

    const sourceKey = createSourceKey(input.userId, input.cardId);
    await uploadFile({
      bucket: Bucket.CARD_PIPELINE_INPUTS,
      key: sourceKey,
      filePath: input.sourceFilePath,
      contentType: 'application/vnd.chips.card+zip',
    });

    try {
      const [job] = await db
        .insert(cardPipelineJobs)
        .values({
          cardId: input.cardId,
          userId: input.userId,
          sourceBucket: Bucket.CARD_PIPELINE_INPUTS,
          sourceKey,
          maxRetries: env.CARD_PIPELINE_JOB_MAX_RETRIES,
        } satisfies Partial<NewCardPipelineJob> as NewCardPipelineJob)
        .returning();

      await pushJobId(job.id);
      return job;
    } catch (error) {
      await deleteObject(Bucket.CARD_PIPELINE_INPUTS, sourceKey).catch((cleanupError) => {
        console.error(
          `[CardPipelineQueue] Failed to delete source object after enqueue failure for card ${input.cardId}:`,
          cleanupError,
        );
      });
      throw error;
    }
  },

  async requeueStaleProcessingJobs(workerId: string): Promise<number> {
    const staleBefore = new Date(Date.now() - 30 * 60 * 1000);
    const staleJobs = await db.query.cardPipelineJobs.findMany({
      where: and(
        eq(cardPipelineJobs.status, 'processing'),
        lt(cardPipelineJobs.lockedAt, staleBefore),
      ),
    });

    for (const job of staleJobs) {
      await db
        .update(cardPipelineJobs)
        .set({
          status: 'queued',
          lockedBy: null,
          lockedAt: null,
          lastError: `Worker ${job.lockedBy ?? 'unknown'} timed out; requeued by ${workerId}`,
          updatedAt: new Date(),
        })
        .where(eq(cardPipelineJobs.id, job.id));
      await pushJobId(job.id);
    }

    return staleJobs.length;
  },

  async takeNextJobId(): Promise<string | null> {
    const result = await getRedis().brpop(QUEUE_KEY, env.CARD_PIPELINE_QUEUE_POLL_TIMEOUT_SEC);
    return result?.[1] ?? null;
  },

  async processJob(jobId: string, workerId: string): Promise<CardPipelineJobProcessResult> {
    const job = await db.query.cardPipelineJobs.findFirst({
      where: eq(cardPipelineJobs.id, jobId),
    });

    if (!job || job.status === 'succeeded' || job.status === 'failed') {
      return { status: 'stale', jobId };
    }

    const [lockedJob] = await db
      .update(cardPipelineJobs)
      .set({
        status: 'processing',
        lockedBy: workerId,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cardPipelineJobs.id, jobId),
          eq(cardPipelineJobs.status, 'queued'),
          isNull(cardPipelineJobs.lockedAt),
        ),
      )
      .returning();

    if (!lockedJob) {
      return { status: 'stale', jobId };
    }

    const workDir = path.join(os.tmpdir(), `ccps-card-pipeline-job-${jobId}-${uuidv4()}`);
    const sourceFilePath = path.join(workDir, INPUT_FILE_NAME);

    try {
      await downloadFile({
        bucket: lockedJob.sourceBucket,
        key: lockedJob.sourceKey,
        filePath: sourceFilePath,
      });

      await runCardPipeline({
        cardFilePath: sourceFilePath,
        cardDbId: lockedJob.cardId,
        userId: lockedJob.userId,
      });

      const processedCard = await db.query.cards.findFirst({
        where: eq(cards.id, lockedJob.cardId),
      });

      if (!processedCard || processedCard.status !== 'ready') {
        throw new Error(processedCard?.errorMessage ?? 'Card pipeline finished without ready status');
      }

      await db
        .update(cardPipelineJobs)
        .set({
          status: 'succeeded',
          lastError: null,
          lockedBy: workerId,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(cardPipelineJobs.id, lockedJob.id));
      await deleteObject(lockedJob.sourceBucket, lockedJob.sourceKey).catch((error) => {
        console.error(`[CardPipelineQueue] Failed to delete source object for job ${lockedJob.id}:`, error);
      });
      return { status: 'succeeded', jobId };
    } catch (error) {
      const retryCount = lockedJob.retryCount + 1;
      const errorMessage = getErrorMessage(error);
      const shouldRetry = retryCount <= lockedJob.maxRetries;

      await db
        .update(cardPipelineJobs)
        .set({
          status: shouldRetry ? 'queued' : 'failed',
          retryCount,
          lastError: errorMessage,
          lockedBy: shouldRetry ? null : workerId,
          lockedAt: shouldRetry ? null : lockedJob.lockedAt,
          finishedAt: shouldRetry ? null : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(cardPipelineJobs.id, lockedJob.id));

      if (shouldRetry) {
        if (env.CARD_PIPELINE_RETRY_DELAY_MS > 0) {
          await new Promise((resolve) => setTimeout(resolve, env.CARD_PIPELINE_RETRY_DELAY_MS));
        }
        await pushJobId(lockedJob.id);
        return { status: 'retrying', jobId };
      }

      await db
        .update(cards)
        .set({ status: 'error', errorMessage, updatedAt: new Date() })
        .where(eq(cards.id, lockedJob.cardId));
      return { status: 'failed', jobId };
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  },
};
