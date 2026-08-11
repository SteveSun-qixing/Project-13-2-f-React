import { afterEach, describe, expect, it, vi } from 'vitest';

const cardsTable = { id: 'cards.id' };
let queryCardResult: Record<string, unknown> | null = null;
const updateSetMock = vi.fn();
const deletePrefixMock = vi.fn();
const deleteObjectMock = vi.fn();
const parseObjectUrlMock = vi.fn();
const deleteCachesForCardMock = vi.fn();
const enqueueForCardMock = vi.fn();

vi.mock('../db/client', () => ({
  db: {
    query: {
      cards: {
        findFirst: vi.fn(async () => queryCardResult),
      },
    },
    update: vi.fn(() => ({
      set: updateSetMock,
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
  },
}));

vi.mock('../db/schema/cards', () => ({
  cards: cardsTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left, right) => ({ left, right, op: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, op: 'and' })),
  isNull: vi.fn((column) => ({ column, op: 'isNull' })),
  desc: vi.fn((column) => ({ column, op: 'desc' })),
  count: vi.fn(() => ({ op: 'count' })),
}));

vi.mock('../storage/s3', () => ({
  deleteObject: deleteObjectMock,
  deleteObjectsByPrefix: deletePrefixMock,
  parseObjectUrl: parseObjectUrlMock,
}));

vi.mock('../storage/buckets', () => ({
  Bucket: {
    CARD_RESOURCES: 'chips-card-resources',
    COVERS: 'chips-covers',
    CARD_FILES: 'chips-card-files',
    CARD_RENDER_CACHE: 'chips-card-render-cache',
    CARD_RENDER_CACHE_PRIVATE: 'chips-card-render-cache-private',
    CARD_COVER_CACHE: 'chips-card-cover-cache',
    CARD_COVER_CACHE_PRIVATE: 'chips-card-cover-cache-private',
  },
}));

vi.mock('./card-render-cache.service', () => ({
  CardRenderCacheService: {
    viewRenderProfile: 'community-web',
    coverRenderProfile: 'community-cover',
    deleteCachesForCard: deleteCachesForCardMock,
    enqueueForCard: enqueueForCardMock,
  },
}));

function mockUpdateReturning(record: Record<string, unknown>) {
  updateSetMock.mockReturnValue({
    where: vi.fn(() => ({
      returning: vi.fn(async () => [record]),
    })),
  });
}

afterEach(() => {
  queryCardResult = null;
  vi.clearAllMocks();
});

describe('CardService cache and resource cleanup', () => {
  it('invalidates render caches when card visibility changes', async () => {
    const { CardService } = await import('./card.service');
    queryCardResult = {
      id: 'card-1',
      userId: 'user-1',
      visibility: 'public',
    };
    mockUpdateReturning({
      id: 'card-1',
      userId: 'user-1',
      visibility: 'private',
    });

    await CardService.update('card-1', 'user-1', { visibility: 'private' });

    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'private',
        htmlUrl: null,
        coverUrl: null,
      }),
    );
    expect(deleteCachesForCardMock).toHaveBeenCalledWith('card-1');
    expect(enqueueForCardMock).toHaveBeenCalledWith({
      cardId: 'card-1',
      createdBy: 'manual',
      renderProfile: 'community-web',
      priority: 50,
    });
    expect(enqueueForCardMock).toHaveBeenCalledWith({
      cardId: 'card-1',
      createdBy: 'manual',
      renderProfile: 'community-cover',
      priority: 40,
    });
  });

  it('deletes upload-session resources recorded in resource manifest when card is removed', async () => {
    const { CardService } = await import('./card.service');
    queryCardResult = {
      id: 'card-1',
      userId: 'user-1',
      visibility: 'public',
      resourceManifest: {
        verifiedResources: [
          {
            publicUrl: 'https://file.example/chips-card-resources/users/user-1/uploads/upload-1/resources/photo.png',
          },
          {
            publicUrl: 'https://file.example/chips-card-render-cache/card-1/cache/index.html',
          },
        ],
      },
    };
    parseObjectUrlMock.mockImplementation((url: string) => {
      if (url.includes('chips-card-resources')) {
        return {
          bucket: 'chips-card-resources',
          key: 'users/user-1/uploads/upload-1/resources/photo.png',
        };
      }
      return {
        bucket: 'chips-card-render-cache',
        key: 'card-1/cache/index.html',
      };
    });

    await CardService.delete('card-1', 'user-1');

    expect(deleteObjectMock).toHaveBeenCalledTimes(1);
    expect(deleteObjectMock).toHaveBeenCalledWith(
      'chips-card-resources',
      'users/user-1/uploads/upload-1/resources/photo.png',
    );
    expect(deletePrefixMock).toHaveBeenCalledWith('chips-card-files', 'user-1/card-1/');
    expect(deletePrefixMock).toHaveBeenCalledWith('chips-card-render-cache', 'card-1/');
    expect(deletePrefixMock).toHaveBeenCalledWith('chips-card-cover-cache', 'card-1/');
  });
});
