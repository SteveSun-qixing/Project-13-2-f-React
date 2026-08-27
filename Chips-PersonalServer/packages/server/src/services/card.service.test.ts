import { afterEach, describe, expect, it, vi } from 'vitest';

const cardsTable = { id: 'cards.id' };
let queryCardResult: Record<string, unknown> | null = null;
const updateSetMock = vi.fn();
const deletePrefixMock = vi.fn();
const deleteObjectMock = vi.fn();
const parseObjectUrlMock = vi.fn();

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

describe('CardService render artifacts and resource cleanup', () => {
  it('records client-rendered artifacts and marks the card ready', async () => {
    const { CardService } = await import('./card.service');
    mockUpdateReturning({
      id: 'card-1',
      status: 'ready',
      htmlUrl: 'https://cdn.example/chips-card-render-cache/card-1/ver-1/index.html',
    });

    const card = await CardService.recordRenderArtifacts('card-1', {
      rendererVersion: 'client-renderer-1',
      themeId: 'chips-official.default-theme',
      view: {
        cacheVersion: 'ver-1',
        bucket: 'chips-card-render-cache',
        keyPrefix: 'card-1/ver-1',
        entryObjectKey: 'card-1/ver-1/index.html',
        entryUrl: 'https://cdn.example/chips-card-render-cache/card-1/ver-1/index.html',
        fileCount: 3,
        sizeBytes: 1000,
      },
    });

    expect(card.status).toBe('ready');
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        htmlUrl: 'https://cdn.example/chips-card-render-cache/card-1/ver-1/index.html',
        renderArtifacts: expect.objectContaining({
          rendererVersion: 'client-renderer-1',
        }),
        renderedAt: expect.any(Date),
      }),
    );
  });

  it('invalidates render artifacts when card visibility changes', async () => {
    const { CardService } = await import('./card.service');
    queryCardResult = {
      id: 'card-1',
      visibility: 'public',
      renderArtifacts: {
        view: {
          bucket: 'chips-card-render-cache',
          keyPrefix: 'card-1/ver-1',
        },
        cover: {
          bucket: 'chips-card-cover-cache',
          keyPrefix: 'card-1/ver-1',
        },
      },
    };
    mockUpdateReturning({
      id: 'card-1',
      visibility: 'private',
    });

    await CardService.update('card-1', { visibility: 'private' });

    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'private',
        htmlUrl: null,
        coverUrl: null,
      }),
    );
    expect(deletePrefixMock).toHaveBeenCalledWith('chips-card-render-cache', 'card-1/ver-1/');
    expect(deletePrefixMock).toHaveBeenCalledWith('chips-card-cover-cache', 'card-1/ver-1/');
  });

  it('deletes upload-session resources and render artifacts when card is removed', async () => {
    const { CardService } = await import('./card.service');
    queryCardResult = {
      id: 'card-1',
      visibility: 'public',
      resourceManifest: {
        verifiedResources: [
          {
            publicUrl: 'https://file.example/chips-card-resources/cards/card-1/versions/v1/resources/photo.png',
          },
          {
            publicUrl: 'https://file.example/chips-card-render-cache/card-1/ver-1/index.html',
          },
        ],
      },
      renderArtifacts: {
        view: {
          bucket: 'chips-card-render-cache',
          keyPrefix: 'card-1/ver-1',
        },
      },
    };
    parseObjectUrlMock.mockImplementation((url: string) => {
      if (url.includes('chips-card-resources')) {
        return {
          bucket: 'chips-card-resources',
          key: 'cards/card-1/versions/v1/resources/photo.png',
        };
      }
      return {
        bucket: 'chips-card-render-cache',
        key: 'card-1/ver-1/index.html',
      };
    });
    mockUpdateReturning({ id: 'card-1' });

    await CardService.delete('card-1');

    expect(deleteObjectMock).toHaveBeenCalledTimes(1);
    expect(deleteObjectMock).toHaveBeenCalledWith(
      'chips-card-resources',
      'cards/card-1/versions/v1/resources/photo.png',
    );
    expect(deletePrefixMock).toHaveBeenCalledWith('chips-card-render-cache', 'card-1/ver-1/');
  });
});
