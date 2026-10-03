import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestHarness,
  fixtureCard,
  fixtureRenderCache,
  fixtureUser,
  registerAccount,
  type TestHarness,
} from './helpers/harness.js';

/**
 * 卡片内容只读域契约（契约 §4.5、§6.4）：detail / open-view / status / render-status /
 * view / cover 入口；可见性（私有按 404）；ETag 条件请求；Cache-Control: no-store。
 */

describe('卡片内容只读域契约', () => {
  let harness: TestHarness;
  let app: FastifyInstance;
  let author: Awaited<ReturnType<typeof registerAccount>>;
  let viewer: Awaited<ReturnType<typeof registerAccount>>;

  const AUTHOR_TIME = Date.parse('2026-09-15T00:00:00.000Z');

  beforeAll(async () => {
    harness = await buildTestHarness();
    app = harness.app;
    author = await registerAccount(app, { username: 'author' });
    viewer = await registerAccount(app, { username: 'viewer' });
    harness.state.users.push(
      fixtureUser({ id: 'author-row', username: 'legacy-author', email: 'legacy@example.test' })
    );
    harness.state.cards.push(
      fixtureCard({
        id: 'card-11111111-1111-4111-8111-111111111111',
        userId: author.userId,
        name: '东京旅记',
        cardFileId: 'cardAPub1',
        status: 'ready',
        visibility: 'public',
        coverRatio: '2:3',
        tags: ['旅行', ['东京', '美食']],
        chipStandardsVersion: '1.2.0',
        fileSizeBytes: 4096,
        sha256: 'ab'.repeat(32),
        createdAt: new Date(AUTHOR_TIME),
        updatedAt: new Date(AUTHOR_TIME + 1000),
      }),
      fixtureCard({
        id: 'card-22222222-2222-4222-8222-222222222222',
        userId: author.userId,
        name: '私密手账',
        cardFileId: 'cardAPriv',
        status: 'ready',
        visibility: 'private',
        createdAt: new Date(AUTHOR_TIME + 2000),
      }),
      fixtureCard({
        id: 'card-33333333-3333-4333-8333-333333333333',
        userId: 'author-row',
        name: '渲染失败卡片',
        cardFileId: 'cardAErr1',
        status: 'ready',
        visibility: 'public',
        createdAt: new Date(AUTHOR_TIME + 3000),
      })
    );
    // 渲染缓存记录：查看就绪（公开内容入口为公开缓存地址）
    harness.state.renderCaches.push(
      fixtureRenderCache({
        id: 'cache-view-1',
        cardId: 'card-11111111-1111-4111-8111-111111111111',
        renderProfile: 'community-web',
        state: 'ready',
        attemptCount: 2,
        cacheVersion: 'cv-20260915',
        viewEntryUrl: 'https://cdn.example.test/cards/card-1/view/index.html',
        coverEntryUrl: 'https://cdn.example.test/cards/card-1/cover/index.html',
        updatedAt: new Date(AUTHOR_TIME + 5000),
      }),
      fixtureRenderCache({
        id: 'cache-cover-1',
        cardId: 'card-11111111-1111-4111-8111-111111111111',
        renderProfile: 'community-cover',
        state: 'ready',
        coverEntryUrl: 'https://cdn.example.test/cards/card-1/cover/index.html',
        updatedAt: new Date(AUTHOR_TIME + 5000),
      }),
      fixtureRenderCache({
        id: 'cache-view-err',
        cardId: 'card-33333333-3333-4333-8333-333333333333',
        renderProfile: 'community-web',
        state: 'error',
        attemptCount: 3,
        errorCode: 'COMMUNITY_CARD_RENDER_ERROR',
        errorMessage: '渲染引擎超时',
        updatedAt: new Date(AUTHOR_TIME + 6000),
      })
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/cards/:cardId（ICommunityCardDetail 逐字段）', () => {
    it('公开卡片匿名可读，字段集与契约一致', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-11111111-1111-4111-8111-111111111111',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: Record<string, unknown> }>();
      expect(Object.keys(body.data).sort()).toEqual([
        'cardFileId',
        'chipStandardsVersion',
        'coverRatio',
        'coverUrl',
        'createdAt',
        'fileSizeBytes',
        'id',
        'name',
        'renderStatusUrl',
        'roomId',
        'sha256',
        'status',
        'tags',
        'updatedAt',
        'user',
        'userId',
        'viewUrl',
        'visibility',
      ]);
      expect(body.data['cardFileId']).toBe('cardAPub1');
      expect(body.data['name']).toBe('东京旅记');
      expect(body.data['coverRatio']).toBe('2:3');
      expect(body.data['chipStandardsVersion']).toBe('1.2.0');
      expect(body.data['tags']).toEqual(['旅行', ['东京', '美食']]);
      expect(body.data['fileSizeBytes']).toBe(4096);
      expect(body.data['sha256']).toBe('ab'.repeat(32));
      expect(body.data['roomId']).toBeNull();
      expect(body.data['status']).toBe('ready');
      expect(body.data['visibility']).toBe('public');
      expect(body.data['coverUrl']).toBe(
        '/api/v1/cards/card-11111111-1111-4111-8111-111111111111/cover'
      );
      expect(body.data['viewUrl']).toBe(
        '/api/v1/cards/card-11111111-1111-4111-8111-111111111111/view'
      );
      expect(body.data['renderStatusUrl']).toBe(
        '/api/v1/cards/card-11111111-1111-4111-8111-111111111111/render-status'
      );
      const user = body.data['user'] as Record<string, unknown>;
      expect(Object.keys(user).sort()).toEqual([
        'avatarUrl',
        'bio',
        'createdAt',
        'displayName',
        'id',
        'username',
      ]);
      // 摘要字段语义：coverRatio 缺省 3:4
    });

    it('coverRatio 缺省 3:4；未就绪卡片 coverUrl 为 null、viewUrl 为 null', async () => {
      harness.state.cards.push(
        fixtureCard({
          id: 'card-44444444-4444-4444-8444-444444444444',
          userId: author.userId,
          name: '待处理卡片',
          cardFileId: 'cardAPend',
          status: 'pending',
          coverRatio: '',
        })
      );
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-44444444-4444-4444-8444-444444444444',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json<{
        data: { coverRatio: string; coverUrl: string | null; viewUrl: string | null };
      }>();
      expect(body.data.coverRatio).toBe('3:4');
      expect(body.data.coverUrl).toBeNull();
      expect(body.data.viewUrl).toBeNull();
    });

    it('私有卡片：匿名 404、他人 404、作者本人可读（不暴露存在性）', async () => {
      const url = '/api/v1/cards/card-22222222-2222-4222-8222-222222222222';
      const anon = await app.inject({ method: 'GET', url });
      expect(anon.statusCode).toBe(404);
      expect(anon.json<{ error: { code: string } }>().error.code).toBe('COMMUNITY_CARD_NOT_FOUND');
      const other = await app.inject({
        method: 'GET',
        url,
        headers: authHeader(viewer.accessToken),
      });
      expect(other.statusCode).toBe(404);
      const self = await app.inject({
        method: 'GET',
        url,
        headers: authHeader(author.accessToken),
      });
      expect(self.statusCode).toBe(200);
    });

    it('ETag：公开浏览类 GET 支持 If-None-Match → 304 无正文', async () => {
      const url = '/api/v1/cards/card-11111111-1111-4111-8111-111111111111';
      const first = await app.inject({ method: 'GET', url });
      expect(first.statusCode).toBe(200);
      const etag = first.headers.etag;
      expect(typeof etag).toBe('string');
      const second = await app.inject({
        method: 'GET',
        url,
        headers: { 'if-none-match': String(etag) },
      });
      expect(second.statusCode).toBe(304);
      expect(second.body).toBe('');
    });
  });

  describe('GET /api/v1/cards/:cardId/open-view（轻量视图）', () => {
    it('只含轻量字段集（不含标签/大小/摘要）', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-11111111-1111-4111-8111-111111111111/open-view',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json<{ data: Record<string, unknown> }>();
      expect(Object.keys(body.data).sort()).toEqual([
        'cardFileId',
        'chipStandardsVersion',
        'coverRatio',
        'coverUrl',
        'createdAt',
        'id',
        'name',
        'renderStatusUrl',
        'status',
        'updatedAt',
        'user',
        'viewState',
        'viewUrl',
        'visibility',
      ]);
      expect(body.data['viewState']).toBe('ready');
      expect(body.data['tags']).toBeUndefined();
      expect(body.data['fileSizeBytes']).toBeUndefined();
      expect(body.data['sha256']).toBeUndefined();
    });
  });

  describe('GET /api/v1/cards/:cardId/status', () => {
    it('返回 ICommunityCardStatus（viewState 派生 + hasRenderArtifacts）', async () => {
      const ready = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-11111111-1111-4111-8111-111111111111/status',
      });
      expect(ready.statusCode).toBe(200);
      const readyBody = ready.json<{ data: Record<string, unknown> }>();
      expect(Object.keys(readyBody.data).sort()).toEqual([
        'cardId',
        'hasRenderArtifacts',
        'status',
        'updatedAt',
        'viewState',
      ]);
      expect(readyBody.data['cardId']).toBe('card-11111111-1111-4111-8111-111111111111');
      expect(readyBody.data['viewState']).toBe('ready');
      expect(readyBody.data['hasRenderArtifacts']).toBe(true);

      const pending = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-44444444-4444-4444-8444-444444444444/status',
      });
      const pendingBody = pending.json<{ data: Record<string, unknown> }>();
      expect(pendingBody.data['viewState']).toBe('pending');
      expect(pendingBody.data['hasRenderArtifacts']).toBe(false);
    });
  });

  describe('GET /api/v1/cards/:cardId/render-status', () => {
    it('就绪：viewState ready + attemptCount + viewUrl；error：error.code/message', async () => {
      const ready = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-11111111-1111-4111-8111-111111111111/render-status',
      });
      expect(ready.statusCode).toBe(200);
      expect(ready.headers['cache-control']).toBe('no-store');
      const readyBody = ready.json<{ data: Record<string, unknown> }>();
      expect(Object.keys(readyBody.data).sort()).toEqual([
        'attemptCount',
        'cardId',
        'error',
        'updatedAt',
        'viewState',
        'viewUrl',
      ]);
      expect(readyBody.data['viewState']).toBe('ready');
      expect(readyBody.data['attemptCount']).toBe(2);
      expect(readyBody.data['error']).toBeNull();

      const failed = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-33333333-3333-4333-8333-333333333333/render-status',
      });
      const failedBody = failed.json<{
        data: {
          viewState: string;
          attemptCount: number;
          error: { code: string; message: string } | null;
        };
      }>();
      expect(failedBody.data.viewState).toBe('error');
      expect(failedBody.data.attemptCount).toBe(3);
      expect(failedBody.data.error?.code).toBe('COMMUNITY_CARD_RENDER_ERROR');
      expect(failedBody.data.error?.message).toBe('渲染引擎超时');
    });

    it('无缓存记录的卡片：viewState pending、attemptCount 0（契约 §4.5 等待生成语义）', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-44444444-4444-4444-8444-444444444444/render-status',
      });
      const body = response.json<{
        data: { viewState: string; attemptCount: number; viewUrl: string | null };
      }>();
      expect(body.data.viewState).toBe('pending');
      expect(body.data.attemptCount).toBe(0);
      expect(body.data.viewUrl).toBeNull();
    });
  });

  describe('GET /api/v1/cards/:cardId/view（查看入口，契约 §6.4）', () => {
    it('ready：302 到公开缓存地址（私有内容 302 到受控代理路径）', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-11111111-1111-4111-8111-111111111111/view',
      });
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(
        'https://cdn.example.test/cards/card-1/view/index.html'
      );
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('处理中：202 + Retry-After；失败：409 COMMUNITY_CARD_RENDER_ERROR', async () => {
      const processing = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-44444444-4444-4444-8444-444444444444/view',
      });
      expect(processing.statusCode).toBe(202);
      expect(processing.headers['retry-after']).toBe('3');

      const failed = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-33333333-3333-4333-8333-333333333333/view',
      });
      expect(failed.statusCode).toBe(409);
      expect(failed.json<{ error: { code: string; retryable: boolean } }>().error.code).toBe(
        'COMMUNITY_CARD_RENDER_ERROR'
      );
    });

    it('私有就绪卡片：作者视角 302 到受控代理路径；他人 404', async () => {
      harness.state.renderCaches.push(
        fixtureRenderCache({
          id: 'cache-view-priv',
          cardId: 'card-22222222-2222-4222-8222-222222222222',
          renderProfile: 'community-web',
          state: 'ready',
          cacheVersion: 'cv-priv',
          updatedAt: new Date(AUTHOR_TIME + 7000),
        })
      );
      const self = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-22222222-2222-4222-8222-222222222222/view',
        headers: authHeader(author.accessToken),
      });
      expect(self.statusCode).toBe(302);
      expect(self.headers.location).toBe(
        '/api/v1/cards/card-22222222-2222-4222-8222-222222222222/render-cache/cv-priv/index.html'
      );
      const other = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-22222222-2222-4222-8222-222222222222/view',
        headers: authHeader(viewer.accessToken),
      });
      expect(other.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/cards/:cardId/cover（封面入口）', () => {
    it('ready：302 到封面缓存；处理中：202 占位页（text/html + Retry-After）；失败：回退默认封面', async () => {
      const ready = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-11111111-1111-4111-8111-111111111111/cover',
      });
      expect(ready.statusCode).toBe(302);
      expect(ready.headers.location).toBe('https://cdn.example.test/cards/card-1/cover/index.html');

      const processing = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-44444444-4444-4444-8444-444444444444/cover',
      });
      expect(processing.statusCode).toBe(202);
      expect(processing.headers['content-type']).toContain('text/html');
      expect(processing.headers['retry-after']).toBe('3');
      expect(processing.body).toContain('封面正在生成');

      const failed = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/card-33333333-3333-4333-8333-333333333333/cover',
      });
      expect(failed.statusCode).toBe(302);
      expect(failed.headers.location).toBe('https://cdn.example.test/default-cover.svg');
    });
  });

  it('渲染状态接口不缓存、详情接口带 ETag（契约 §6.4 缓存口径分流）', async () => {
    const detail = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-11111111-1111-4111-8111-111111111111',
    });
    expect(detail.headers['cache-control']).toBeUndefined();
    expect(detail.headers.etag).toBeDefined();
    const renderStatus = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-11111111-1111-4111-8111-111111111111/render-status',
    });
    expect(renderStatus.headers.etag).toBeUndefined();
  });
});
