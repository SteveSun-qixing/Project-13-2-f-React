import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  jobs: new Map<string, Record<string, unknown>>(),
  cards: new Map<string, Record<string, unknown>>(),
  redisQueue: [] as string[],
  nextJobId: 'job-1',
  updatingJobId: 'job-1',
};

const redisMock = {
  lpush: vi.fn(async (_key: string, jobId: string) => {
    state.redisQueue.unshift(jobId);
  }),
  brpop: vi.fn(async () => {
    const jobId = state.redisQueue.pop();
    return jobId ? ['ccps:card-pipeline:queue', jobId] : null;
  }),
};

function createReturningQuery(rowFactory: () => Record<string, unknown> | undefined) {
  return {
    values(values: Record<string, unknown>) {
      state.jobs.set(state.nextJobId, {
        id: state.nextJobId,
        status: 'queued',
        retryCount: 0,
        maxRetries: 2,
        lockedAt: null,
        lockedBy: null,
        finishedAt: null,
        createdAt: new Date('2026-05-23T00:00:00.000Z'),
        updatedAt: new Date('2026-05-23T00:00:00.000Z'),
        ...values,
      });
      return {
        returning: vi.fn(async () => [rowFactory()]),
      };
    },
  };
}

function getJobIdFromWhere(_where: unknown): string {
  return state.updatingJobId;
}

function createUpdateQuery() {
  let patch: Record<string, unknown> = {};
  let updated: Record<string, unknown> | undefined;
  return {
    set(nextPatch: Record<string, unknown>) {
      patch = nextPatch;
      return {
        where(where: unknown) {
          const jobId = getJobIdFromWhere(where);
          const job = state.jobs.get(jobId);
          if (job) {
            const isLockAttempt = patch.status === 'processing' && patch.lockedAt;
            if (!isLockAttempt || (job.status === 'queued' && job.lockedAt === null)) {
              updated = { ...job, ...patch };
              state.jobs.set(job.id, updated);
            }
          }
          return {
            returning: vi.fn(async () => (updated ? [updated] : [])),
          };
        },
      };
    },
  };
}

const dbMock = {
  query: {
    cardPipelineJobs: {
      findFirst: vi.fn(async ({ where: _where }: { where: unknown }) => {
        if (state.jobs.size === 0) {
          return undefined;
        }
        return state.jobs.get(state.updatingJobId);
      }),
      findMany: vi.fn(async () => []),
    },
    cards: {
      findFirst: vi.fn(async () => state.cards.get('card-1')),
    },
  },
  insert: vi.fn(() => createReturningQuery(() => state.jobs.get(state.nextJobId))),
  update: vi.fn((table: unknown) => {
    const tableRecord = table as Record<string, unknown>;
    if ('htmlUrl' in tableRecord || 'title' in tableRecord) {
      return {
        set(patch: Record<string, unknown>) {
          return {
            where(_where: unknown) {
              const card = state.cards.get('card-1') ?? { id: 'card-1' };
              state.cards.set('card-1', { ...card, ...patch });
              return {
                returning: vi.fn(async () => [state.cards.get('card-1')]),
              };
            },
          };
        },
      };
    }
    return createUpdateQuery();
  }),
};

const uploadFileMock = vi.fn(async () => '');
const downloadFileMock = vi.fn(async () => undefined);
const deleteObjectMock = vi.fn(async () => undefined);
const runCardPipelineMock = vi.fn(async () => undefined);

vi.mock('../cache/redis', () => ({
  getRedis: () => redisMock,
}));

vi.mock('../config/env', () => ({
  env: {
    CARD_PIPELINE_JOB_MAX_RETRIES: 2,
    CARD_PIPELINE_RETRY_DELAY_MS: 0,
    CARD_PIPELINE_QUEUE_POLL_TIMEOUT_SEC: 1,
  },
}));

vi.mock('../db/client', () => ({
  db: dbMock,
}));

vi.mock('../storage/s3', () => ({
  uploadFile: uploadFileMock,
  downloadFile: downloadFileMock,
  deleteObject: deleteObjectMock,
}));

vi.mock('../pipeline/card-pipeline', () => ({
  runCardPipeline: runCardPipelineMock,
}));

describe('CardPipelineQueueService', () => {
  beforeEach(() => {
    state.jobs.clear();
    state.cards.clear();
    state.redisQueue = [];
    state.nextJobId = 'job-1';
    state.updatingJobId = 'job-1';
    vi.clearAllMocks();
  });

  it('uploads card source and enqueues a job id', async () => {
    const { CardPipelineQueueService } = await import('./card-pipeline-queue.service');

    const job = await CardPipelineQueueService.enqueue({
      cardId: 'card-1',
      userId: 'user-1',
      sourceFilePath: '/tmp/source.card',
    });

    expect(job.id).toBe('job-1');
    expect(uploadFileMock).toHaveBeenCalledWith(expect.objectContaining({
      bucket: 'chips-card-pipeline-inputs',
      key: 'user-1/card-1/source.card',
    }));
    expect(redisMock.lpush).toHaveBeenCalledWith('ccps:card-pipeline:queue', 'job-1');
  });

  it('reuses an existing queued job when the same card is enqueued again', async () => {
    const { CardPipelineQueueService } = await import('./card-pipeline-queue.service');

    const firstJob = await CardPipelineQueueService.enqueue({
      cardId: 'card-1',
      userId: 'user-1',
      sourceFilePath: '/tmp/source.card',
    });
    const secondJob = await CardPipelineQueueService.enqueue({
      cardId: 'card-1',
      userId: 'user-1',
      sourceFilePath: '/tmp/source.card',
    });

    expect(secondJob.id).toBe(firstJob.id);
    expect(uploadFileMock).toHaveBeenCalledTimes(1);
    expect(redisMock.lpush).toHaveBeenCalledTimes(2);
  });

  it('marks a job succeeded after pipeline returns ready card status', async () => {
    const { CardPipelineQueueService } = await import('./card-pipeline-queue.service');

    await CardPipelineQueueService.enqueue({
      cardId: 'card-1',
      userId: 'user-1',
      sourceFilePath: '/tmp/source.card',
    });
    state.cards.set('card-1', { id: 'card-1', status: 'ready' });

    const result = await CardPipelineQueueService.processJob('job-1', 'worker-1');

    expect(result.status).toBe('succeeded');
    expect(runCardPipelineMock).toHaveBeenCalled();
    expect(deleteObjectMock).toHaveBeenCalledWith('chips-card-pipeline-inputs', 'user-1/card-1/source.card');
    expect(state.jobs.get('job-1')?.status).toBe('succeeded');
  });

  it('requeues a failed job while retries remain', async () => {
    const { CardPipelineQueueService } = await import('./card-pipeline-queue.service');

    await CardPipelineQueueService.enqueue({
      cardId: 'card-1',
      userId: 'user-1',
      sourceFilePath: '/tmp/source.card',
    });
    runCardPipelineMock.mockRejectedValueOnce(new Error('conversion failed'));

    const result = await CardPipelineQueueService.processJob('job-1', 'worker-1');

    expect(result.status).toBe('retrying');
    expect(state.jobs.get('job-1')?.status).toBe('queued');
    expect(state.jobs.get('job-1')?.retryCount).toBe(1);
    expect(redisMock.lpush).toHaveBeenLastCalledWith('ccps:card-pipeline:queue', 'job-1');
  });

  it('marks card and job failed after retries are exhausted', async () => {
    const { CardPipelineQueueService } = await import('./card-pipeline-queue.service');

    await CardPipelineQueueService.enqueue({
      cardId: 'card-1',
      userId: 'user-1',
      sourceFilePath: '/tmp/source.card',
    });
    state.jobs.set('job-1', { ...state.jobs.get('job-1'), retryCount: 2, maxRetries: 2 });
    runCardPipelineMock.mockRejectedValueOnce(new Error('still broken'));

    const result = await CardPipelineQueueService.processJob('job-1', 'worker-1');

    expect(result.status).toBe('failed');
    expect(state.jobs.get('job-1')?.status).toBe('failed');
    expect(state.cards.get('card-1')?.status).toBe('error');
    expect(state.cards.get('card-1')?.errorMessage).toBe('still broken');
  });
});
