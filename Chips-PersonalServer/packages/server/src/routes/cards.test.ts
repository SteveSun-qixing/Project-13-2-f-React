import Fastify from 'fastify';
import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

const cardServiceMock = {
  getAccessible: vi.fn(),
  getOpenViewWithArtifacts: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  toDTO: vi.fn((card: Record<string, unknown>) => card),
  toSummaryDTO: vi.fn((card: Record<string, unknown>) => card),
  toOpenViewDTO: vi.fn((card: Record<string, unknown>) => ({
    ...card,
    viewUrl: `/api/v1/cards/${String(card.id)}/view`,
  })),
};

const getObjectStreamMock = vi.fn();

vi.mock('../services/card.service', () => ({
  CardService: cardServiceMock,
}));

vi.mock('../storage/s3', () => ({
  getObjectStream: getObjectStreamMock,
}));

vi.mock('../config/env', () => ({
  env: {
    API_TOKEN: 'personal-server-test-token-1234',
  },
}));

describe('cards routes', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  async function buildApp() {
    const { default: cardRoutes } = await import('./cards');
    const { default: errorHandlerPlugin } = await import('../plugins/error-handler.plugin');
    const { apiTokenPlugin } = await import('../plugins/api-token.plugin');
    const app = Fastify();
    await errorHandlerPlugin(app, {});
    await apiTokenPlugin(app, {});
    await app.register(cardRoutes);
    return app;
  }

  it('公开卡片详情接口无需令牌访问', async () => {
    const app = await buildApp();
    cardServiceMock.getAccessible.mockResolvedValue({
      id: 'card-1',
      title: 'Demo',
      status: 'ready',
      visibility: 'public',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-1',
    });

    expect(response.statusCode).toBe(200);
    expect(cardServiceMock.getAccessible).toHaveBeenCalledWith('card-1');

    await app.close();
  });

  it('卡片 view 接口在产物就绪时重定向到渲染产物入口', async () => {
    const app = await buildApp();
    cardServiceMock.getAccessible.mockResolvedValue({
      id: 'card-ready',
      status: 'ready',
      visibility: 'public',
      renderArtifacts: {
        view: {
          entryUrl: 'https://file.example/chips-card-render-cache/card-ready/ver-1/index.html',
        },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-ready/view',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('https://file.example/chips-card-render-cache/card-ready/ver-1/index.html');

    await app.close();
  });

  it('卡片 view 接口在产物缺失时返回未就绪错误', async () => {
    const app = await buildApp();
    cardServiceMock.getAccessible.mockResolvedValue({
      id: 'card-pending',
      status: 'pending',
      visibility: 'public',
      renderArtifacts: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-pending/view',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('CARD_RENDER_NOT_READY');

    await app.close();
  });

  it('渲染产物资源代理支持视频播放器需要的 Range 分段读取', async () => {
    const app = await buildApp();
    cardServiceMock.getAccessible.mockResolvedValue({
      id: 'card-video',
      status: 'ready',
      visibility: 'public',
      renderArtifacts: {
        view: {
          cacheVersion: 'ver-1',
          bucket: 'chips-card-render-cache',
          keyPrefix: 'card-video/ver-1',
        },
      },
    });
    getObjectStreamMock.mockResolvedValue({
      body: Readable.from(Buffer.from('video-chunk')),
      contentType: 'video/mp4',
      contentLength: 1024,
      contentRange: 'bytes 0-1023/4096',
      acceptRanges: 'bytes',
      etag: '"video-etag"',
      statusCode: 206,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-video/render-cache/ver-1/assets/content/videos/demo.mp4',
      headers: {
        range: 'bytes=0-1023',
      },
    });

    expect(response.statusCode).toBe(206);
    expect(response.headers['content-type']).toBe('video/mp4');
    expect(response.headers['content-range']).toBe('bytes 0-1023/4096');
    expect(getObjectStreamMock).toHaveBeenCalledWith({
      bucket: 'chips-card-render-cache',
      key: 'card-video/ver-1/assets/content/videos/demo.mp4',
      range: 'bytes=0-1023',
    });

    await app.close();
  });

  it('渲染产物代理拒绝版本不匹配的请求', async () => {
    const app = await buildApp();
    cardServiceMock.getAccessible.mockResolvedValue({
      id: 'card-video',
      status: 'ready',
      visibility: 'public',
      renderArtifacts: {
        view: {
          cacheVersion: 'ver-1',
          bucket: 'chips-card-render-cache',
          keyPrefix: 'card-video/ver-1',
        },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-video/render-cache/evil-version/index.html',
    });

    expect(response.statusCode).toBe(404);
    expect(getObjectStreamMock).not.toHaveBeenCalled();

    await app.close();
  });

  it('卡片打开轻量接口返回产物状态且不返回完整 JSONB 字段', async () => {
    const app = await buildApp();
    cardServiceMock.getOpenViewWithArtifacts.mockResolvedValue({
      id: 'card-1',
      title: '公开卡片',
      coverUrl: null,
      coverRatio: '3:4',
      status: 'ready',
      visibility: 'public',
      createdAt: new Date('2026-04-09T00:00:00.000Z'),
      updatedAt: new Date('2026-04-09T00:00:00.000Z'),
      renderArtifacts: {
        view: {
          cacheVersion: 'ver-1',
          bucket: 'chips-card-render-cache',
          keyPrefix: 'card-1/ver-1',
          entryObjectKey: 'card-1/ver-1/index.html',
          entryUrl: 'https://file.example/chips-card-render-cache/card-1/ver-1/index.html',
          fileCount: 3,
          sizeBytes: 1000,
        },
        cover: {
          cacheVersion: 'ver-1',
          bucket: 'chips-card-cover-cache',
          keyPrefix: 'card-1/ver-1',
          entryObjectKey: 'card-1/ver-1/index.html',
          entryUrl: 'https://file.example/chips-card-cover-cache/card-1/ver-1/index.html',
          fileCount: 2,
          sizeBytes: 500,
        },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-1/open-view',
    });

    expect(response.statusCode).toBe(200);
    expect(cardServiceMock.getOpenViewWithArtifacts).toHaveBeenCalledWith('card-1');
    const payload = response.json();
    expect(payload.data.cardMetadata).toBeUndefined();
    expect(payload.data.htmlUrl).toBeUndefined();
    expect(payload.data.viewUrl).toBe('/api/v1/cards/card-1/view');
    expect(payload.data.coverUrl).toBe('/api/v1/cards/card-1/cover');
    expect(payload.data.viewState).toBe('ready');

    await app.close();
  });

  it('卡片打开轻量接口对未渲染卡片返回 pending 状态', async () => {
    const app = await buildApp();
    cardServiceMock.getOpenViewWithArtifacts.mockResolvedValue({
      id: 'card-pending',
      title: '待渲染',
      coverUrl: null,
      coverRatio: null,
      status: 'pending',
      visibility: 'public',
      createdAt: new Date('2026-04-09T00:00:00.000Z'),
      updatedAt: new Date('2026-04-09T00:00:00.000Z'),
      renderArtifacts: null,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-pending/open-view',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.viewState).toBe('pending');
    expect(response.json().data.coverUrl).toBe(null);

    await app.close();
  });

  it('封面接口在无封面产物时返回默认占位 HTML', async () => {
    const app = await buildApp();
    cardServiceMock.getAccessible.mockResolvedValue({
      id: 'card-no-cover',
      title: '没有封面',
      status: 'ready',
      visibility: 'public',
      renderArtifacts: {
        view: {
          entryUrl: 'https://file.example/view/index.html',
        },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-no-cover/cover',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('没有封面');

    await app.close();
  });

  it('封面接口在封面产物就绪时重定向到封面产物入口', async () => {
    const app = await buildApp();
    cardServiceMock.getAccessible.mockResolvedValue({
      id: 'card-cover',
      title: '有封面',
      status: 'ready',
      visibility: 'public',
      renderArtifacts: {
        view: {
          entryUrl: 'https://file.example/view/index.html',
        },
        cover: {
          entryUrl: 'https://file.example/chips-card-cover-cache/card-cover/ver-1/index.html',
        },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-cover/cover',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('https://file.example/chips-card-cover-cache/card-cover/ver-1/index.html');

    await app.close();
  });

  it('卡片列表接口返回公开作品摘要', async () => {
    const app = await buildApp();
    cardServiceMock.list.mockResolvedValue({
      items: [{ id: 'card-1', title: 'Demo', status: 'ready', visibility: 'public' }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards',
    });

    expect(response.statusCode).toBe(200);
    expect(cardServiceMock.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
      { visibility: 'public' },
    );
    expect(response.json().data).toHaveLength(1);

    await app.close();
  });
});
