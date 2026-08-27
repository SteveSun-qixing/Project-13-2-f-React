import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let queryCardsResult: Record<string, unknown> | null = null;
let queryReadyCacheResult: Record<string, unknown> | null = null;
let queryJobsResult: Record<string, unknown> | null = null;
let insertedJob: Record<string, unknown> | null = null;
const pushedJobIds: string[] = [];

const dbMock = {
  query: {
    cards: {
      findFirst: vi.fn(async () => queryCardsResult),
    },
    cardRenderCaches: {
      findFirst: vi.fn(async () => queryReadyCacheResult),
    },
    cardRenderJobs: {
      findFirst: vi.fn(async () => queryJobsResult),
    },
  },
  insert: vi.fn((table: unknown) => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => (insertedJob ? [insertedJob] : [])),
    })),
  })),
};

vi.mock('../db/client', () => ({
  db: dbMock,
}));

vi.mock('../db/schema/cards', () => ({
  cards: { id: 'cards.id', sourceCardSha256: 'cards.source_card_sha256', sourceCardKey: 'cards.source_card_key' },
}));

vi.mock('../db/schema/card-render', () => ({
  cardRenderCaches: { cardId: 'c.card_id', sourceCardSha256: 'c.source_card_sha256', rendererVersion: 'c.renderer_version', renderProfile: 'c.render_profile', themeId: 'c.theme_id', locale: 'c.locale', status: 'c.status' },
  cardRenderJobs: { cardId: 'j.card_id', sourceCardSha256: 'j.source_card_sha256', rendererVersion: 'j.renderer_version', renderProfile: 'j.render_profile', locale: 'j.locale', status: 'j.status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left, right) => ({ left, right, op: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, op: 'and' })),
  or: vi.fn((...conditions) => ({ conditions, op: 'or' })),
  desc: vi.fn((column) => ({ column, op: 'desc' })),
  isNull: vi.fn((column) => ({ column, op: 'isNull' })),
  lt: vi.fn((left, right) => ({ left, right, op: 'lt' })),
}));

vi.mock('../config/env', () => ({
  env: {
    CARD_RENDERER_VERSION: 'community-card-renderer-3',
    CARD_RENDER_JOB_MAX_ATTEMPTS: 2,
    HOST_ACTIVE_THEME_ID: 'chips-official.default-theme',
    CARD_RENDER_CACHE_TTL_DAYS: 30,
    CARD_RENDER_QUEUE_POLL_TIMEOUT_SEC: 5,
  },
}));

vi.mock('../storage/buckets', () => ({
  Bucket: {
    CARD_RESOURCES: 'chips-card-resources',
    CARD_RENDER_CACHE: 'chips-card-render-cache',
    CARD_COVER_CACHE: 'chips-card-cover-cache',
  },
}));

vi.mock('../cache/redis', () => ({
  getRedis: () => ({
    lpush: async (_key: string, value: string) => {
      pushedJobIds.push(value);
    },
    brpop: async () => null,
  }),
}));

const { CardRenderCacheService } = await import('./card-render-cache.service');

describe('CardRenderCacheService.enqueueForCard', () => {
  beforeEach(() => {
    queryCardsResult = null;
    queryReadyCacheResult = null;
    queryJobsResult = null;
    insertedJob = null;
    pushedJobIds.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a render job for a network resource card without sourceCardSha256', async () => {
    queryCardsResult = {
      id: 'card-net-1',
      sourceCardBucket: 'chips-card-resources',
      sourceCardKey: 'cards/card-net-1/versions/v1/network-card/card.card',
      sourceCardSha256: null,
    };
    insertedJob = { id: 'job-1', cardId: 'card-net-1', sourceCardSha256: 'network-card:cards/card-net-1/versions/v1/network-card/card.card' };

    const job = await CardRenderCacheService.enqueueForCard({
      cardId: 'card-net-1',
      createdBy: 'upload',
      renderProfile: CardRenderCacheService.viewRenderProfile,
    });

    expect(job).not.toBeNull();
    expect(dbMock.insert).toHaveBeenCalled();
    expect(pushedJobIds).toContain('job-1');
  });

  it('returns null when the network resource card object location is missing', async () => {
    queryCardsResult = {
      id: 'card-net-2',
      sourceCardBucket: null,
      sourceCardKey: null,
      sourceCardSha256: null,
    };

    const job = await CardRenderCacheService.enqueueForCard({
      cardId: 'card-net-2',
      createdBy: 'upload',
    });

    expect(job).toBeNull();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
