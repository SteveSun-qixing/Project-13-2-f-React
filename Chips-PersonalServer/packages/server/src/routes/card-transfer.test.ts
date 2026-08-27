import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CARD_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const BOX_ID = '33333333-3333-4333-8333-333333333333';
const API_TOKEN = 'personal-server-test-token-1234';

const uploadSessionServiceMock = {
  create: vi.fn(),
  getById: vi.fn(),
};

const cardServiceMock = {
  create: vi.fn(),
  getAccessible: vi.fn(),
  recordRenderArtifacts: vi.fn(),
};

const boxServiceMock = {
  createPlaceholder: vi.fn(),
  create: vi.fn(),
};

const createPresignedPutUrlMock = vi.fn();
const createPresignedGetUrlMock = vi.fn();
const buildObjectUrlMock = vi.fn((bucket: string, key: string) => `https://cdn.example/${bucket}/${key}`);
const headObjectMock = vi.fn();

const dbUpdateCalls: Array<{ table: unknown; values: Record<string, unknown>; condition: unknown }> = [];
let updatedCardResult: Record<string, unknown> | null = null;

const dbMock = {
  update: vi.fn((table: unknown) => ({
    set: vi.fn((values: Record<string, unknown>) => ({
      where: vi.fn((condition: unknown) => {
        dbUpdateCalls.push({ table, values, condition });
        return {
          returning: vi.fn(async () => (updatedCardResult ? [updatedCardResult] : [])),
        };
      }),
    })),
  })),
};

vi.mock('../services/upload-session.service', () => ({
  UploadSessionService: uploadSessionServiceMock,
}));

vi.mock('../services/card.service', () => ({
  CardService: cardServiceMock,
}));

vi.mock('../services/box.service', () => ({
  BoxService: boxServiceMock,
}));

vi.mock('../storage/buckets', () => ({
  Bucket: {
    CARD_RESOURCES: 'chips-card-resources',
    BOX_FILES: 'chips-box-files',
    CARD_RENDER_CACHE: 'chips-card-render-cache',
    CARD_RENDER_CACHE_PRIVATE: 'chips-card-render-cache-private',
    CARD_COVER_CACHE: 'chips-card-cover-cache',
    CARD_COVER_CACHE_PRIVATE: 'chips-card-cover-cache-private',
    COVERS: 'chips-covers',
  },
}));

vi.mock('../storage/s3', () => ({
  buildObjectUrl: buildObjectUrlMock,
  createPresignedPutUrl: createPresignedPutUrlMock,
  createPresignedGetUrl: createPresignedGetUrlMock,
  headObject: headObjectMock,
}));

vi.mock('../db/client', () => ({
  db: dbMock,
}));

vi.mock('../db/schema/cards', () => ({
  cards: {
    id: 'cards.id',
  },
}));

vi.mock('../db/schema/upload-sessions', () => ({
  uploadSessions: {
    id: 'upload_sessions.id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
}));

vi.mock('../config/env', () => ({
  env: {
    BASE_URL: 'https://personal.example',
    UPLOAD_SESSION_TTL_MINUTES: 30,
    API_TOKEN,
  },
}));

async function buildCardTransferApp() {
  const { default: cardTransferRoutes } = await import('./card-transfer');
  const { default: errorHandlerPlugin } = await import('../plugins/error-handler.plugin');
  const { apiTokenPlugin } = await import('../plugins/api-token.plugin');
  const app = Fastify();
  await errorHandlerPlugin(app, {});
  await apiTokenPlugin(app, {});
  await app.register(cardTransferRoutes);
  return app;
}

const authHeaders = { authorization: `Bearer ${API_TOKEN}` };

function transferMetadata(overrides?: Record<string, unknown>) {
  return {
    transferKind: 'network-resource-card',
    cardId: CARD_ID,
    versionId: VERSION_ID,
    resourcePrefix: `cards/${CARD_ID}/versions/${VERSION_ID}/resources`,
    networkCardObjectKey: `cards/${CARD_ID}/versions/${VERSION_ID}/network-card/card.card`,
    renderCacheVersion: VERSION_ID,
    renderObjects: [],
    ...overrides,
  };
}

function boxTransferMetadata() {
  return {
    transferKind: 'box-source',
    boxId: BOX_ID,
    versionId: VERSION_ID,
    resourcePrefix: `boxes/${BOX_ID}/versions/${VERSION_ID}`,
    boxFileObjectKey: `boxes/${BOX_ID}/versions/${VERSION_ID}/box.box`,
  };
}

function boxFileObjectPayload(overrides?: Record<string, unknown>) {
  return {
    bucket: 'chips-box-files',
    objectKey: `boxes/${BOX_ID}/versions/${VERSION_ID}/box.box`,
    publicUrl: null,
    sizeBytes: 2048,
    mimeType: 'application/vnd.chips.box+zip',
    ...overrides,
  };
}

beforeEach(() => {
  dbUpdateCalls.length = 0;
  updatedCardResult = null;
  uploadSessionServiceMock.create.mockResolvedValue({
    id: VERSION_ID,
    fileName: 'demo.card',
    expiresAt: new Date('2026-08-05T00:30:00.000Z'),
    clientMetadata: {},
  });
  cardServiceMock.create.mockResolvedValue({
    id: CARD_ID,
  });
  createPresignedPutUrlMock.mockImplementation((input: { key: string; contentType: string }) => ({
    url: `https://s3.example/put/${input.key}`,
    method: 'PUT',
    headers: {
      'content-type': input.contentType,
    },
  }));
  createPresignedGetUrlMock.mockImplementation((input: { key: string }) => ({
    url: `https://s3.example/get/${input.key}`,
    method: 'GET',
    headers: {},
  }));
  headObjectMock.mockResolvedValue({ contentLength: 100 });
  boxServiceMock.createPlaceholder.mockResolvedValue({ id: BOX_ID, title: 'Travel' });
  boxServiceMock.create.mockResolvedValue({ id: BOX_ID, title: '2026 旅行箱' });
  cardServiceMock.recordRenderArtifacts.mockResolvedValue({ id: CARD_ID, status: 'ready' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('card transfer routes', () => {
  it('creates upload sessions with render artifact mode and object-storage layout metadata', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.create.mockResolvedValue({
      id: VERSION_ID,
      fileName: 'demo.card',
      expiresAt: new Date('2026-08-05T00:30:00.000Z'),
      includeRenderArtifacts: true,
      clientMetadata: {},
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/card-transfer/upload-sessions',
      headers: authHeaders,
      payload: {
        fileName: 'demo.card',
        includeRenderArtifacts: true,
        idempotencyKey: 'idem-1',
        client: {
          name: 'desktop-transfer',
          version: '1.0.0',
          platform: 'desktop',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(uploadSessionServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'card',
        visibility: 'public',
        fileName: 'demo.card',
        includeRenderArtifacts: true,
        idempotencyKey: 'idem-1',
      }),
    );
    expect(cardServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'demo',
        visibility: 'public',
        fileSizeBytes: 0,
        publishedByClient: 'desktop-transfer',
        publishedClientVersion: '1.0.0',
      }),
    );
    expect(dbUpdateCalls[0]?.values).toMatchObject({
      resourcePrefix: `cards/${CARD_ID}/versions/${VERSION_ID}/resources`,
      clientMetadata: expect.objectContaining(transferMetadata()),
    });
    expect(response.json().data).toMatchObject({
      uploadId: VERSION_ID,
      cardId: CARD_ID,
      versionId: VERSION_ID,
      includeRenderArtifacts: true,
      networkCard: {
        bucket: 'chips-card-resources',
        objectKey: `cards/${CARD_ID}/versions/${VERSION_ID}/network-card/card.card`,
      },
    });

    await app.close();
  });

  it('rejects requests without a valid API token', async () => {
    const app = await buildCardTransferApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/card-transfer/upload-sessions',
      headers: { authorization: 'Bearer wrong-token' },
      payload: { fileName: 'demo.card' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('API_TOKEN_INVALID');

    await app.close();
  });

  it('presigns resources, network card and render artifacts', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      visibility: 'public',
      clientMetadata: transferMetadata(),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/objects:presign`,
      headers: { ...authHeaders, 'content-type': 'application/json' },
      payload: {
        objects: [
          {
            role: 'resource',
            relativePath: 'images/hero.png',
            sizeBytes: 10,
            mimeType: 'image/png',
          },
          {
            role: 'network-card',
            sizeBytes: 100,
            mimeType: 'application/vnd.chips.card+zip',
          },
          {
            role: 'render-file',
            relativePath: 'index.html',
            sizeBytes: 500,
            mimeType: 'text/html',
          },
          {
            role: 'cover-file',
            relativePath: 'index.html',
            sizeBytes: 300,
            mimeType: 'text/html',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(uploadSessionServiceMock.getById).toHaveBeenCalledWith(VERSION_ID);
    expect(createPresignedPutUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'chips-card-resources',
        key: `cards/${CARD_ID}/versions/${VERSION_ID}/resources/images/hero.png`,
      }),
    );
    expect(createPresignedPutUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'chips-card-render-cache',
        key: `${CARD_ID}/${VERSION_ID}/index.html`,
      }),
    );
    expect(createPresignedPutUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'chips-card-cover-cache',
        key: `${CARD_ID}/${VERSION_ID}/index.html`,
      }),
    );
    expect(response.json().data.objects).toEqual([
      expect.objectContaining({ role: 'resource', relativePath: 'images/hero.png' }),
      expect.objectContaining({ role: 'network-card', relativePath: null }),
      expect.objectContaining({
        role: 'render-file',
        relativePath: 'index.html',
        bucket: 'chips-card-render-cache',
        objectKey: `${CARD_ID}/${VERSION_ID}/index.html`,
      }),
      expect.objectContaining({
        role: 'cover-file',
        relativePath: 'index.html',
        bucket: 'chips-card-cover-cache',
        objectKey: `${CARD_ID}/${VERSION_ID}/index.html`,
      }),
    ]);
    // 渲染产物对象被记录到会话元数据，供 complete 校验
    expect(dbUpdateCalls[0]?.values).toMatchObject({
      clientMetadata: expect.objectContaining({
        renderObjects: [
          expect.objectContaining({ role: 'render-file', relativePath: 'index.html' }),
          expect.objectContaining({ role: 'cover-file', relativePath: 'index.html' }),
        ],
      }),
    });

    await app.close();
  });

  it('presigns private card render artifacts into private buckets without public URLs', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      visibility: 'private',
      clientMetadata: transferMetadata(),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/objects:presign`,
      headers: { ...authHeaders, 'content-type': 'application/json' },
      payload: {
        objects: [
          {
            role: 'render-file',
            relativePath: 'index.html',
            sizeBytes: 500,
            mimeType: 'text/html',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.objects[0]).toMatchObject({
      role: 'render-file',
      bucket: 'chips-card-render-cache-private',
      publicUrl: '',
    });

    await app.close();
  });

  it('completes uploads with render artifacts and marks the card ready', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      fileName: 'demo.card',
      clientName: 'desktop-transfer',
      clientVersion: '1.0.0',
      visibility: 'public',
      clientMetadata: transferMetadata({
        renderObjects: [
          {
            role: 'render-file',
            relativePath: 'index.html',
            bucket: 'chips-card-render-cache',
            objectKey: `${CARD_ID}/${VERSION_ID}/index.html`,
            sizeBytes: 500,
            mimeType: 'text/html',
          },
          {
            role: 'cover-file',
            relativePath: 'index.html',
            bucket: 'chips-card-cover-cache',
            objectKey: `${CARD_ID}/${VERSION_ID}/index.html`,
            sizeBytes: 300,
            mimeType: 'text/html',
          },
        ],
      }),
    });
    headObjectMock.mockImplementation(async (input: { bucket: string; key: string }) => ({
      contentLength: input.key.endsWith('card.card')
        ? 100
        : input.bucket === 'chips-card-render-cache'
          ? 500
          : input.bucket === 'chips-card-cover-cache'
            ? 300
            : 10,
    }));
    updatedCardResult = {
      id: CARD_ID,
      status: 'ready',
    };

    const networkCardObjectKey = `cards/${CARD_ID}/versions/${VERSION_ID}/network-card/card.card`;
    const resourceObjectKey = `cards/${CARD_ID}/versions/${VERSION_ID}/resources/images/hero.png`;
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/complete`,
      headers: authHeaders,
      payload: {
        title: 'Demo Card',
        cardFileId: 'AbCdEf1234',
        coverRatio: '3:4',
        networkCard: {
          bucket: 'chips-card-resources',
          objectKey: networkCardObjectKey,
          publicUrl: `https://cdn.example/chips-card-resources/${networkCardObjectKey}`,
          sizeBytes: 100,
          mimeType: 'application/vnd.chips.card+zip',
        },
        resources: [
          {
            originalRelativePath: 'images/hero.png',
            networkUrl: `https://cdn.example/chips-card-resources/${resourceObjectKey}`,
            bucket: 'chips-card-resources',
            objectKey: resourceObjectKey,
            publicUrl: `https://cdn.example/chips-card-resources/${resourceObjectKey}`,
            sizeBytes: 10,
            mimeType: 'image/png',
          },
        ],
        restoreManifest: {
          schemaVersion: '1.0.0',
          zipEntries: [{ path: 'images/hero.png', order: 1 }],
        },
        cardMetadata: {
          card_id: 'AbCdEf1234',
          name: 'Demo Card',
        },
        renderArtifacts: {
          rendererVersion: 'client-renderer-1',
          themeId: 'chips-official.default-theme',
          locale: 'zh-CN',
          view: {
            entryRelativePath: 'index.html',
            fileCount: 3,
            sizeBytes: 500,
          },
          cover: {
            entryRelativePath: 'index.html',
            fileCount: 2,
            sizeBytes: 300,
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({});
    const cardUpdate = dbUpdateCalls.find((call) => call.values.resourceManifest);
    expect(cardUpdate?.values).toMatchObject({
      title: 'Demo Card',
      fileSizeBytes: 100,
      sourceCardBucket: 'chips-card-resources',
      sourceCardKey: networkCardObjectKey,
      status: 'ready',
    });
    expect(cardServiceMock.recordRenderArtifacts).toHaveBeenCalledWith(
      CARD_ID,
      expect.objectContaining({
        rendererVersion: 'client-renderer-1',
        view: expect.objectContaining({
          cacheVersion: VERSION_ID,
          bucket: 'chips-card-render-cache',
          keyPrefix: `${CARD_ID}/${VERSION_ID}`,
          entryObjectKey: `${CARD_ID}/${VERSION_ID}/index.html`,
          entryUrl: `https://cdn.example/chips-card-render-cache/${CARD_ID}/${VERSION_ID}/index.html`,
        }),
        cover: expect.objectContaining({
          bucket: 'chips-card-cover-cache',
          entryUrl: `https://cdn.example/chips-card-cover-cache/${CARD_ID}/${VERSION_ID}/index.html`,
        }),
      }),
    );
    expect(response.json().data).toMatchObject({
      cardId: CARD_ID,
      versionId: VERSION_ID,
      status: 'ready',
      communityUrl: `https://personal.example/cards/${CARD_ID}`,
    });

    await app.close();
  });

  it('completes uploads without render artifacts and keeps the card pending', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      fileName: 'demo.card',
      clientName: 'desktop-transfer',
      clientVersion: '1.0.0',
      visibility: 'public',
      clientMetadata: transferMetadata(),
    });
    headObjectMock.mockResolvedValue({ contentLength: 100 });
    updatedCardResult = {
      id: CARD_ID,
      status: 'pending',
    };

    const networkCardObjectKey = `cards/${CARD_ID}/versions/${VERSION_ID}/network-card/card.card`;
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/complete`,
      headers: authHeaders,
      payload: {
        title: 'Demo Card',
        networkCard: {
          bucket: 'chips-card-resources',
          objectKey: networkCardObjectKey,
          publicUrl: null,
          sizeBytes: 100,
          mimeType: 'application/vnd.chips.card+zip',
        },
        resources: [],
        restoreManifest: {
          schemaVersion: '1.0.0',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(cardServiceMock.recordRenderArtifacts).not.toHaveBeenCalled();
    expect(response.json().data).toMatchObject({
      cardId: CARD_ID,
      versionId: VERSION_ID,
      status: 'pending',
    });

    await app.close();
  });

  it('rejects render artifacts whose entry object was not presigned', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      fileName: 'demo.card',
      visibility: 'public',
      clientMetadata: transferMetadata({ renderObjects: [] }),
    });
    headObjectMock.mockResolvedValue({ contentLength: 100 });

    const networkCardObjectKey = `cards/${CARD_ID}/versions/${VERSION_ID}/network-card/card.card`;
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/complete`,
      headers: authHeaders,
      payload: {
        title: 'Demo Card',
        networkCard: {
          bucket: 'chips-card-resources',
          objectKey: networkCardObjectKey,
          publicUrl: null,
          sizeBytes: 100,
          mimeType: 'application/vnd.chips.card+zip',
        },
        resources: [],
        restoreManifest: {
          schemaVersion: '1.0.0',
        },
        renderArtifacts: {
          rendererVersion: 'client-renderer-1',
          view: {
            entryRelativePath: 'index.html',
            fileCount: 1,
            sizeBytes: 500,
          },
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toContain('render-file');

    await app.close();
  });

  it('rejects malformed restore manifests on complete', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      visibility: 'public',
      clientMetadata: transferMetadata(),
    });

    const networkCardObjectKey = `cards/${CARD_ID}/versions/${VERSION_ID}/network-card/card.card`;
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/complete`,
      headers: authHeaders,
      payload: {
        title: 'Demo Card',
        networkCard: {
          bucket: 'chips-card-resources',
          objectKey: networkCardObjectKey,
          sizeBytes: 100,
          mimeType: 'application/vnd.chips.card+zip',
        },
        resources: [],
        restoreManifest: {
          zipEntries: [{ path: 'hero.png' }],
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(response.json().error.message).toContain('schemaVersion');

    await app.close();
  });

  it('rejects resource objects that do not belong to the upload session', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      visibility: 'public',
      clientMetadata: transferMetadata(),
    });

    const networkCardObjectKey = `cards/${CARD_ID}/versions/${VERSION_ID}/network-card/card.card`;
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/complete`,
      headers: authHeaders,
      payload: {
        title: 'Demo Card',
        networkCard: {
          bucket: 'chips-card-resources',
          objectKey: networkCardObjectKey,
          sizeBytes: 100,
          mimeType: 'application/vnd.chips.card+zip',
        },
        resources: [
          {
            originalRelativePath: '../escape/hero.png',
            networkUrl: 'https://cdn.example/hero.png',
            bucket: 'chips-card-resources',
            objectKey: `cards/${CARD_ID}/versions/${VERSION_ID}/resources/../escape/hero.png`,
            sizeBytes: 10,
            mimeType: 'image/png',
          },
        ],
        restoreManifest: {
          schemaVersion: '1.0.0',
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('returns download plans with object locations and restore manifests without streaming card bytes', async () => {
    const app = await buildCardTransferApp();
    const networkCardObjectKey = `cards/${CARD_ID}/versions/${VERSION_ID}/network-card/card.card`;
    const resourceObjectKey = `cards/${CARD_ID}/versions/${VERSION_ID}/resources/images/hero.png`;
    cardServiceMock.getAccessible.mockResolvedValue({
      id: CARD_ID,
      title: 'Demo Card',
      resourceManifest: {
        schemaVersion: '1.0.0',
        mode: 'network-resource-card',
        cardId: CARD_ID,
        cardVersionId: VERSION_ID,
        networkCard: {
          bucket: 'chips-card-resources',
          objectKey: networkCardObjectKey,
          publicUrl: `https://cdn.example/chips-card-resources/${networkCardObjectKey}`,
          sizeBytes: 100,
          mimeType: 'application/vnd.chips.card+zip',
        },
        resources: [
          {
            originalRelativePath: 'images/hero.png',
            networkUrl: `https://cdn.example/chips-card-resources/${resourceObjectKey}`,
            bucket: 'chips-card-resources',
            objectKey: resourceObjectKey,
            publicUrl: `https://cdn.example/chips-card-resources/${resourceObjectKey}`,
            sizeBytes: 10,
            mimeType: 'image/png',
          },
        ],
        restoreManifest: {
          schemaVersion: '1.0.0',
        },
      },
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/card-transfer/download-sessions',
      headers: authHeaders,
      payload: {
        cardId: CARD_ID,
        client: {
          name: 'desktop-transfer',
        },
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(cardServiceMock.getAccessible).toHaveBeenCalledWith(CARD_ID);
    expect(createResponse.json().data.planUrl).toBe(`/api/v1/card-transfer/download-sessions/${CARD_ID}/plan`);

    const planResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/card-transfer/download-sessions/${CARD_ID}/plan`,
      headers: authHeaders,
    });

    expect(planResponse.statusCode).toBe(200);
    expect(createPresignedGetUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'chips-card-resources',
        key: networkCardObjectKey,
        responseContentDisposition: 'attachment; filename="Demo%20Card.card"',
      }),
    );
    expect(planResponse.json().data).toMatchObject({
      schemaVersion: '1.0.0',
      cardId: CARD_ID,
      versionId: VERSION_ID,
      suggestedFileName: 'Demo Card.card',
      networkCard: expect.objectContaining({
        bucket: 'chips-card-resources',
        objectKey: networkCardObjectKey,
      }),
    });

    await app.close();
  });

  it('does not accept binary card payloads on the card-transfer control plane', async () => {
    const app = await buildCardTransferApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/card-transfer/upload-sessions',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('fake-card-zip-bytes'),
    });
    expect(createResponse.statusCode).toBe(415);

    await app.close();
  });

  it('creates box upload sessions with a placeholder box and a box-file target', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.create.mockResolvedValue({
      id: VERSION_ID,
      fileName: 'Travel.box',
      expiresAt: new Date('2026-08-05T00:30:00.000Z'),
      clientMetadata: {},
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/card-transfer/upload-sessions',
      headers: authHeaders,
      payload: {
        contentType: 'box',
        fileName: 'Travel.box',
        idempotencyKey: 'idem-box-1',
        client: {
          name: 'desktop-transfer',
          version: '1.0.0',
          platform: 'desktop',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(uploadSessionServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'box',
        visibility: 'public',
        fileName: 'Travel.box',
        idempotencyKey: 'idem-box-1',
      }),
    );
    expect(boxServiceMock.createPlaceholder).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Travel',
        visibility: 'public',
        publishedByClient: 'desktop-transfer',
      }),
    );
    expect(dbUpdateCalls[0]?.values).toMatchObject({
      resourcePrefix: `boxes/${BOX_ID}/versions/${VERSION_ID}`,
      clientMetadata: expect.objectContaining(boxTransferMetadata()),
    });
    expect(response.json().data).toMatchObject({
      uploadId: VERSION_ID,
      boxId: BOX_ID,
      versionId: VERSION_ID,
      resourcePrefix: `boxes/${BOX_ID}/versions/${VERSION_ID}`,
      boxFile: {
        bucket: 'chips-box-files',
        objectKey: `boxes/${BOX_ID}/versions/${VERSION_ID}/box.box`,
      },
    });

    await app.close();
  });

  it('presigns a single box-file object for box sessions and rejects card roles', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      visibility: 'public',
      clientMetadata: boxTransferMetadata(),
    });

    const presignUrl = `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/objects:presign`;
    const response = await app.inject({
      method: 'POST',
      url: presignUrl,
      headers: { ...authHeaders, 'content-type': 'application/json' },
      payload: {
        objects: [
          {
            role: 'box-file',
            sizeBytes: 2048,
            mimeType: 'application/vnd.chips.box+zip',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(createPresignedPutUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'chips-box-files',
        key: `boxes/${BOX_ID}/versions/${VERSION_ID}/box.box`,
      }),
    );
    expect(response.json().data.objects).toEqual([
      expect.objectContaining({
        role: 'box-file',
        relativePath: null,
        bucket: 'chips-box-files',
        objectKey: `boxes/${BOX_ID}/versions/${VERSION_ID}/box.box`,
      }),
    ]);

    const rejected = await app.inject({
      method: 'POST',
      url: presignUrl,
      headers: { ...authHeaders, 'content-type': 'application/json' },
      payload: {
        objects: [
          {
            role: 'resource',
            relativePath: 'video.mp4',
            sizeBytes: 10,
            mimeType: 'video/mp4',
          },
        ],
      },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json().error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('completes box sessions by persisting the box with source object info', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      fileName: 'Travel.box',
      visibility: 'public',
      clientMetadata: boxTransferMetadata(),
    });
    headObjectMock.mockResolvedValue({ contentLength: 2048 });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/complete`,
      headers: authHeaders,
      payload: {
        title: '2026 旅行箱',
        boxFileId: 'b1C2d3E4f5',
        layoutPlugin: 'chips.layout.grid',
        coverRatio: '3:4',
        boxFile: boxFileObjectPayload(),
        metadata: {
          box_id: 'b1C2d3E4f5',
          name: '2026 旅行箱',
          active_layout_type: 'chips.layout.grid',
        },
        structure: {
          entries: [
            {
              entry_id: 'e1A2b3C4d5',
              url: 'cards/day-01.card',
              enabled: true,
            },
          ],
        },
        content: {
          active_layout_type: 'chips.layout.grid',
          layout_configs: {},
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(headObjectMock).toHaveBeenCalledWith({
      bucket: 'chips-box-files',
      key: `boxes/${BOX_ID}/versions/${VERSION_ID}/box.box`,
    });
    expect(boxServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'public',
        fileSizeBytes: 2048,
        sourceBoxBucket: 'chips-box-files',
        sourceBoxKey: `boxes/${BOX_ID}/versions/${VERSION_ID}/box.box`,
        boxFileId: 'b1C2d3E4f5',
        title: '2026 旅行箱',
        boxId: BOX_ID,
      }),
    );
    const sessionUpdate = dbUpdateCalls.find((call) => call.values.status === 'source_ready');
    expect(sessionUpdate?.values).toMatchObject({
      sourceBoxBucket: 'chips-box-files',
      sourceBoxKey: `boxes/${BOX_ID}/versions/${VERSION_ID}/box.box`,
    });
    expect(response.json().data).toMatchObject({
      boxId: BOX_ID,
      versionId: VERSION_ID,
      status: 'ready',
      communityUrl: `https://personal.example/boxes/${BOX_ID}`,
      boxViewUrl: `/api/v1/boxes/${BOX_ID}/view`,
    });

    await app.close();
  });

  it('rejects box sessions whose box file object does not belong to the session', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      visibility: 'public',
      clientMetadata: boxTransferMetadata(),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/complete`,
      headers: authHeaders,
      payload: {
        title: '2026 旅行箱',
        boxFile: boxFileObjectPayload({
          objectKey: 'boxes/evil/versions/xxx/box.box',
        }),
        metadata: { box_id: 'b1C2d3E4f5', name: '旅行箱', active_layout_type: 'chips.layout.grid' },
        structure: { entries: [] },
        content: {},
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(boxServiceMock.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('aborts upload sessions without persisting anything', async () => {
    const app = await buildCardTransferApp();
    uploadSessionServiceMock.getById.mockResolvedValue({
      id: VERSION_ID,
      visibility: 'public',
      clientMetadata: boxTransferMetadata(),
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/card-transfer/upload-sessions/${VERSION_ID}/abort`,
      headers: { ...authHeaders, 'content-type': 'application/json' },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ uploadId: VERSION_ID, status: 'cancelled' });
    expect(dbUpdateCalls[0]?.values).toMatchObject({ status: 'cancelled' });
    expect(boxServiceMock.create).not.toHaveBeenCalled();

    await app.close();
  });
});
