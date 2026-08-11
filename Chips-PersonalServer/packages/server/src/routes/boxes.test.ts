import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';

const BOX_ID = '11111111-1111-4111-8111-111111111111';

const createPresignedGetUrlMock = vi.fn();

vi.mock('../storage/s3', () => ({
  createPresignedGetUrl: createPresignedGetUrlMock,
  buildObjectUrl: (bucket: string, key: string) => `http://localhost:9000/${bucket}/${key}`,
}));

vi.mock('../storage/buckets', () => ({
  Bucket: {
    COVERS: 'chips-covers',
  },
}));

const boxServiceMock = {
  getAccessible: vi.fn(),
  enrichCardRefs: vi.fn(),
  toDTO: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  listByUser: vi.fn(),
  toSummaryDTO: vi.fn(),
};

const userServiceMock = {
  findById: vi.fn(),
  toPublicProfile: vi.fn(),
  findByUsername: vi.fn(),
};

vi.mock('../services/box.service', () => ({
  BoxService: boxServiceMock,
}));

vi.mock('../services/user.service', () => ({
  UserService: userServiceMock,
}));

async function buildBoxesApp() {
  const { default: boxRoutes } = await import('./boxes');
  const { default: errorHandlerPlugin } = await import('../plugins/error-handler.plugin');
  const app = Fastify();
  await errorHandlerPlugin(app, {});
  app.decorate('authenticate', async (request: { user?: unknown }) => {
    request.user = { userId: 'user-1', role: 'user', jti: 'jwt-1' };
  });
  app.decorate('optionalAuthenticate', async (request: { user?: unknown }) => {
    request.user = null;
  });
  await app.register(boxRoutes);
  return app;
}

function boxRecord(overrides?: Record<string, unknown>) {
  return {
    id: BOX_ID,
    boxFileId: 'b1C2d3E4f5',
    userId: 'user-1',
    roomId: null,
    title: '旅行箱',
    coverUrl: null,
    coverRatio: '3:4',
    documentUrl: `/api/v1/boxes/${BOX_ID}/view`,
    layoutPlugin: 'chips.layout.grid',
    metadata: {
      box_id: 'b1C2d3E4f5',
      name: '旅行箱',
      description: '第一次旅行的记录',
      active_layout_type: 'chips.layout.grid',
    },
    structure: {
      entries: [
        {
          entry_id: 'e1A2b3C4d5',
          url: 'https://example.com/day-01.card',
          enabled: true,
          snapshot: { document_id: 'c1C2d3E4f5' },
        },
        {
          entry_id: 'e2A2b3C4d5',
          url: 'cards/day-02.card',
          enabled: true,
        },
      ],
    },
    visibility: 'public',
    fileSizeBytes: 2048,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function enrichedEntries() {
  return [
    {
      entry_id: 'e1A2b3C4d5',
      url: 'https://example.com/day-01.card',
      document_id: 'c1C2d3E4f5',
      title: '第一天',
      embedded: false,
      communityCardId: 'card-uuid-1',
      communityViewUrl: '/api/v1/cards/card-uuid-1/view',
      communityRenderStatusUrl: '/api/v1/cards/card-uuid-1/render-status',
    },
    {
      entry_id: 'e2A2b3C4d5',
      url: 'cards/day-02.card',
      title: '第二天',
      embedded: true,
      communityCardId: undefined,
    },
  ];
}

beforeEach(() => {
  boxServiceMock.enrichCardRefs.mockResolvedValue(enrichedEntries());
  createPresignedGetUrlMock.mockReturnValue({
    url: 'https://s3.example/chips-box-files/box.box?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc',
    method: 'GET',
    headers: {},
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('box routes', () => {
  it('renders the read-only box document for public boxes', async () => {
    const app = await buildBoxesApp();
    boxServiceMock.getAccessible.mockResolvedValue(boxRecord());

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/boxes/${BOX_ID}/view`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(boxServiceMock.getAccessible).toHaveBeenCalledWith(BOX_ID, null);
    expect(boxServiceMock.enrichCardRefs).toHaveBeenCalledWith(
      expect.objectContaining({ entries: expect.any(Array) }),
    );
    const html = response.body;
    expect(html).toContain('<title>旅行箱</title>');
    expect(html).toContain('<h1>旅行箱</h1>');
    expect(html).toContain('第一次旅行的记录');
    expect(html).toContain('<a href="/cards/card-uuid-1">第一天</a>');
    expect(html).toContain('内嵌：cards/day-02.card');

    await app.close();
  });

  it('escapes all user content in the read-only box document', async () => {
    const app = await buildBoxesApp();
    boxServiceMock.getAccessible.mockResolvedValue(
      boxRecord({
        title: '<script>alert("box")</script>',
        metadata: {
          description: '<img src=x onerror=alert(1)>',
        },
      }),
    );
    boxServiceMock.enrichCardRefs.mockResolvedValue([
      {
        entry_id: 'e1',
        url: "https://example.com/x.card' onclick='alert(1)",
        title: '<b>标题</b>',
        embedded: false,
        communityCardId: undefined,
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/boxes/${BOX_ID}/view`,
    });

    expect(response.statusCode).toBe(200);
    const html = response.body;
    expect(html).toContain('&lt;script&gt;alert(&quot;box&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert("box")</script>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;b&gt;标题&lt;/b&gt;');

    await app.close();
  });

  it('returns 404 for private boxes when the requester is not the owner', async () => {
    const app = await buildBoxesApp();
    boxServiceMock.getAccessible.mockRejectedValue(
      AppError.notFound(ErrorCode.BOX_NOT_FOUND, 'Box not found'),
    );

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/boxes/${BOX_ID}/view`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('BOX_NOT_FOUND');

    await app.close();
  });

  it('keeps the box detail route emitting enriched cards from formal entries', async () => {
    const app = await buildBoxesApp();
    boxServiceMock.getAccessible.mockResolvedValue(boxRecord());
    boxServiceMock.toDTO.mockReturnValue({
      id: BOX_ID,
      boxFileId: 'b1C2d3E4f5',
      userId: 'user-1',
      roomId: null,
      title: '旅行箱',
      coverUrl: null,
      documentUrl: `/api/v1/boxes/${BOX_ID}/view`,
      coverRatio: '3:4',
      layoutPlugin: 'chips.layout.grid',
      visibility: 'public',
      fileSizeBytes: 2048,
      metadata: {},
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    userServiceMock.findById.mockResolvedValue({ id: 'user-1', username: 'alice' });
    userServiceMock.toPublicProfile.mockReturnValue({ username: 'alice' });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/boxes/${BOX_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      id: BOX_ID,
      cards: expect.arrayContaining([
        expect.objectContaining({
          entry_id: 'e1A2b3C4d5',
          embedded: false,
          communityCardId: 'card-uuid-1',
        }),
      ]),
      user: { username: 'alice' },
    });

    await app.close();
  });

  it('returns a presigned download URL for boxes with a source object', async () => {
    const app = await buildBoxesApp();
    boxServiceMock.getAccessible.mockResolvedValue(
      boxRecord({
        sourceBoxBucket: 'chips-box-files',
        sourceBoxKey: 'boxes/11111111-1111-4111-8111-111111111111/versions/v1/box.box',
      }),
    );

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/boxes/${BOX_ID}/download`,
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data).toMatchObject({
      boxId: BOX_ID,
      bucket: 'chips-box-files',
      objectKey: 'boxes/11111111-1111-4111-8111-111111111111/versions/v1/box.box',
      suggestedFileName: '旅行箱.box',
      method: 'GET',
    });
    expect(data.downloadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(data.expiresInSeconds).toBe(900);

    await app.close();
  });

  it('returns 404 for box download when the source object is missing', async () => {
    const app = await buildBoxesApp();
    boxServiceMock.getAccessible.mockResolvedValue(boxRecord());

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/boxes/${BOX_ID}/download`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('BOX_NOT_FOUND');

    await app.close();
  });

  it('redirects to the published cover HTML object for boxes with a cover', async () => {
    const app = await buildBoxesApp();
    boxServiceMock.getAccessible.mockResolvedValue(
      boxRecord({
        coverUrl: `/api/v1/boxes/${BOX_ID}/cover`,
        coverBucket: 'chips-covers',
        coverKey: `boxes/${BOX_ID}/cover/index.html`,
      }),
    );

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/boxes/${BOX_ID}/cover`,
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'http://localhost:9000/chips-covers/boxes/11111111-1111-4111-8111-111111111111/cover/index.html',
    );

    await app.close();
  });

  it('returns a preparing placeholder when the box cover is not published yet', async () => {
    const app = await buildBoxesApp();
    boxServiceMock.getAccessible.mockResolvedValue(boxRecord());

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/boxes/${BOX_ID}/cover`,
    });

    expect(response.statusCode).toBe(202);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('旅行箱');

    await app.close();
  });
});
