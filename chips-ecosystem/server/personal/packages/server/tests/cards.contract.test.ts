import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buildTestApp,
  fixtureDates,
  makeCard,
  makeReadyRenderArtifacts,
  type FakeState,
  type TestHarness,
} from './helpers/harness.js';
import type {
  CardDetailDto,
  CardOpenViewDto,
  CardStatusDto,
  CardSummaryDto,
} from '../src/services/card.service.js';

/**
 * 卡片内容只读域契约测试（《12 契约》§4.2 逐字段断言 + §2.2 信封 + §6.1 分页）。
 * 夹具为真实形态卡片行；真实 PG/S3 不进入测试（端口 fake）。
 */

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const SUMMARY_KEYS = [
  'coverRatio',
  'coverUrl',
  'createdAt',
  'htmlUrl',
  'id',
  'status',
  'title',
  'visibility',
].sort();

const DETAIL_KEYS = [
  'cardFileId',
  'cardMetadata',
  'cardStructure',
  'coverRatio',
  'coverUrl',
  'createdAt',
  'fileSizeBytes',
  'htmlUrl',
  'id',
  'sourceCardSha256',
  'status',
  'title',
  'updatedAt',
  'viewUrl',
  'visibility',
].sort();

const OPEN_VIEW_KEYS = [
  'coverRatio',
  'coverUrl',
  'createdAt',
  'id',
  'status',
  'title',
  'updatedAt',
  'viewState',
  'viewUrl',
  'visibility',
].sort();

const STATUS_KEYS = [
  'cardId',
  'errorMessage',
  'hasRenderArtifacts',
  'htmlUrl',
  'status',
  'updatedAt',
  'viewUrl',
].sort();

describe('GET /api/v1/cards（公开列表，契约 §4.2.1/§6.1）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    const state: FakeState = {
      cards: [
        makeCard({ id: 'card-1', title: '早的卡片', createdAt: fixtureDates.a }),
        makeCard({
          id: 'card-2',
          title: '新的公开卡片',
          createdAt: fixtureDates.c,
          htmlUrl: '/api/v1/cards/card-2/render-cache/s2/index.html',
          status: 'ready',
        }),
        // 私密作品在公开接口按不存在处理，绝不入列（§3.1.4）
        makeCard({
          id: 'card-3',
          title: '私密卡片',
          visibility: 'private',
          createdAt: fixtureDates.b,
        }),
      ],
      boxes: [],
    };
    harness = await buildTestApp({ state });
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('返回 data 数组 + pagination 四字段，仅公开作品、createdAt 倒序', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      data: CardSummaryDto[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>();
    expect(Object.keys(body)).toEqual(['data', 'pagination']);
    expect(body.data).toHaveLength(2);
    expect(body.data.map((item) => item.id)).toEqual(['card-2', 'card-1']);
    expect(body.pagination).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
  });

  it('摘要 DTO 逐字段对齐契约 §4.2.1（无多余字段，时间 ISO 8601 UTC）', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards' });
    const body = response.json<{ data: CardSummaryDto[] }>();
    const first = body.data[0] as CardSummaryDto;
    expect(Object.keys(first).sort()).toEqual(SUMMARY_KEYS);
    expect(first).toMatchObject({
      id: 'card-2',
      title: '新的公开卡片',
      status: 'ready',
      visibility: 'public',
    });
    expect(first.htmlUrl).toBe('/api/v1/cards/card-2/render-cache/s2/index.html');
    expect(first.coverUrl).toBeNull();
    expect(first.coverRatio).toBeNull();
    expect(first.createdAt).toBe('2026-09-03T00:00:00.000Z');
    expect(ISO_UTC.test(first.createdAt)).toBe(true);
  });

  it('page/pageSize 分页生效；超过 totalPages 的页返回空数组与正确分页对象', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/v1/cards?page=1&pageSize=1' });
    const firstBody = first.json<{ data: unknown[]; pagination: { totalPages: number } }>();
    expect(firstBody.data).toHaveLength(1);
    expect(firstBody.pagination).toEqual({ page: 1, pageSize: 1, total: 2, totalPages: 2 });

    const beyond = await app.inject({ method: 'GET', url: '/api/v1/cards?page=99&pageSize=20' });
    expect(beyond.statusCode).toBe(200);
    const beyondBody = beyond.json<{ data: unknown[]; pagination: { total: number } }>();
    expect(beyondBody.data).toEqual([]);
    expect(beyondBody.pagination.total).toBe(2);
  });

  it('非法分页参数返回 400 VALIDATION_ERROR（retryable: false，信封含 traceId）', async () => {
    for (const query of ['page=0', 'page=abc', 'pageSize=101', 'pageSize=0', 'page=1.5']) {
      const response = await app.inject({ method: 'GET', url: `/api/v1/cards?${query}` });
      expect(response.statusCode, query).toBe(400);
      const body = response.json<{
        error: { code: string; retryable: boolean; details: { traceId: string } };
      }>();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.retryable).toBe(false);
      expect(typeof body.error.details.traceId).toBe('string');
    }
  });
});

describe('GET /api/v1/cards/:cardId（公开详情，契约 §4.2.2/§3.5）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    const state: FakeState = {
      cards: [
        makeCard({
          id: 'card-detail',
          cardFileId: 'Ab3Cd4Ef5g',
          title: '详情卡片',
          coverRatio: '3:4',
          htmlUrl: '/api/v1/cards/card-detail/render-cache/s9/index.html',
          status: 'ready',
          sourceCardSha256: 'deadbeef',
          fileSizeBytes: 2048,
          cardMetadata: { name: '详情卡片', cover_ratio: '16:9' },
          cardStructure: { pages: [] },
        }),
        makeCard({ id: 'card-private', title: '私密卡片', visibility: 'private' }),
      ],
      boxes: [],
    };
    harness = await buildTestApp({ state });
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('详情 DTO 逐字段对齐契约 §4.2.2（无多余字段）', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards/card-detail' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: CardDetailDto }>();
    expect(Object.keys(body.data).sort()).toEqual(DETAIL_KEYS);
    expect(body.data).toMatchObject({
      id: 'card-detail',
      cardFileId: 'Ab3Cd4Ef5g',
      title: '详情卡片',
      coverUrl: null,
      coverRatio: '3:4',
      htmlUrl: '/api/v1/cards/card-detail/render-cache/s9/index.html',
      sourceCardSha256: 'deadbeef',
      viewUrl: '/api/v1/cards/card-detail/view',
      status: 'ready',
      visibility: 'public',
      fileSizeBytes: 2048,
      cardMetadata: { name: '详情卡片', cover_ratio: '16:9' },
      cardStructure: { pages: [] },
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('私密与不存在一律 404 CARD_NOT_FOUND，不可区分（§3.1.4）', async () => {
    const priv = await app.inject({ method: 'GET', url: '/api/v1/cards/card-private' });
    const missing = await app.inject({ method: 'GET', url: '/api/v1/cards/card-absent' });
    expect(priv.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    const privBody = priv.json<{ error: { code: string; message: string } }>();
    const missingBody = missing.json<{ error: { code: string; message: string } }>();
    expect(privBody.error.code).toBe('CARD_NOT_FOUND');
    expect(missingBody.error.code).toBe('CARD_NOT_FOUND');
    expect(privBody.error.message).toBe(missingBody.error.message);
    expect(privBody.error).not.toHaveProperty('visibility');
  });
});

describe('GET /api/v1/cards/:cardId/open-view（打开视图，契约 §4.2.3）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    const state: FakeState = {
      cards: [
        makeCard({
          id: 'card-ready',
          title: '已渲染',
          status: 'ready',
          renderArtifacts: makeReadyRenderArtifacts('card-ready'),
        }),
        makeCard({ id: 'card-pending', title: '尚未渲染', status: 'pending' }),
        makeCard({
          id: 'card-error',
          title: '发布失败',
          status: 'error',
          errorMessage: '校验失败',
        }),
      ],
      boxes: [],
    };
    harness = await buildTestApp({ state });
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('打开视图 DTO 逐字段对齐契约 §4.2.3；就绪卡 viewState=ready', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards/card-ready/open-view' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: CardOpenViewDto }>();
    expect(Object.keys(body.data).sort()).toEqual(OPEN_VIEW_KEYS);
    expect(body.data.viewState).toBe('ready');
    expect(body.data.status).toBe('ready');
    expect(body.data.viewUrl).toBe('/api/v1/cards/card-ready/view');
    expect(body.data.coverUrl).toBe('/api/v1/cards/card-ready/cover');
  });

  it('未渲染卡 viewState 回落为卡片 status（pending/error）', async () => {
    const pending = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/card-pending/open-view',
    });
    const pendingBody = pending.json<{ data: CardOpenViewDto }>();
    expect(pendingBody.data.viewState).toBe('pending');
    expect(pendingBody.data.coverUrl).toBeNull();

    const failed = await app.inject({ method: 'GET', url: '/api/v1/cards/card-error/open-view' });
    const failedBody = failed.json<{ data: CardOpenViewDto }>();
    expect(failedBody.data.viewState).toBe('error');
  });
});

describe('GET /api/v1/cards/:cardId/status（状态，契约 §4.2.4）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    const state: FakeState = {
      cards: [
        makeCard({
          id: 'card-ready',
          status: 'ready',
          htmlUrl: '/api/v1/cards/card-ready/render-cache/s1/index.html',
          renderArtifacts: makeReadyRenderArtifacts('card-ready'),
          updatedAt: fixtureDates.b,
        }),
        makeCard({ id: 'card-pending', status: 'pending', updatedAt: fixtureDates.b }),
      ],
      boxes: [],
    };
    harness = await buildTestApp({ state });
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('状态 DTO 逐字段对齐契约 §4.2.4（cardId/status/errorMessage/htmlUrl/viewUrl/hasRenderArtifacts/updatedAt）', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards/card-ready/status' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: CardStatusDto }>();
    expect(Object.keys(body.data).sort()).toEqual(STATUS_KEYS);
    expect(body.data).toEqual({
      cardId: 'card-ready',
      status: 'ready',
      errorMessage: null,
      htmlUrl: '/api/v1/cards/card-ready/render-cache/s1/index.html',
      viewUrl: '/api/v1/cards/card-ready/view',
      hasRenderArtifacts: true,
      updatedAt: '2026-09-02T00:00:00.000Z',
    });
  });

  it('未渲染卡 hasRenderArtifacts=false、htmlUrl=null', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards/card-pending/status' });
    const body = response.json<{ data: CardStatusDto }>();
    expect(body.data.hasRenderArtifacts).toBe(false);
    expect(body.data.htmlUrl).toBeNull();
  });
});

describe('GET /api/v1/cards/:cardId/view 与 /cover（入口重定向，契约 §4.2.5/§3.2）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    const state: FakeState = {
      cards: [
        makeCard({
          id: 'card-ready',
          title: '已渲染',
          status: 'ready',
          renderArtifacts: makeReadyRenderArtifacts('card-ready'),
        }),
        makeCard({ id: 'card-pending', title: '尚未渲染', status: 'pending' }),
        makeCard({ id: 'card-private', title: '私密', visibility: 'private' }),
      ],
      boxes: [],
    };
    harness = await buildTestApp({ state });
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('view：有查看产物 → 302 重定向到产物入口', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards/card-ready/view' });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      '/api/v1/cards/card-ready/render-cache/session-card-ready/index.html'
    );
  });

  it('view：无产物 → 409 CARD_RENDER_NOT_READY（状态冲突，retryable: true）', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards/card-pending/view' });
    expect(response.statusCode).toBe(409);
    const body = response.json<{ error: { code: string; retryable: boolean } }>();
    expect(body.error.code).toBe('CARD_RENDER_NOT_READY');
    expect(body.error.retryable).toBe(true);
  });

  it('view：私密卡 404 CARD_NOT_FOUND（不泄露存在性）', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards/card-private/view' });
    expect(response.statusCode).toBe(404);
    expect(response.json<{ error: { code: string } }>().error.code).toBe('CARD_NOT_FOUND');
  });

  it('cover：有封面产物 → 302 重定向到封面入口', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards/card-ready/cover' });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      '/api/v1/cards/card-ready/cover-cache/session-card-ready/cover.html'
    );
  });

  it('cover：无封面产物 → 200 text/html 默认占位页（标题转义）', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards/card-pending/cover' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('<h1>尚未渲染</h1>');
    expect(response.body).toContain('lang="zh-CN"');
  });
});

describe('健康检查与未匹配路由（契约 §2.3/§7.2）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    harness = await buildTestApp();
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health 不套用信封，直接返回 status/timestamp/version', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ status: string; timestamp: string; version: string }>();
    expect(Object.keys(body).sort()).toEqual(['status', 'timestamp', 'version'].sort());
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    expect(ISO_UTC.test(body.timestamp)).toBe(true);
  });

  it('未匹配路由返回 404 NOT_FOUND（契约 §7.2 登记码）', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(response.statusCode).toBe(404);
    const body = response.json<{ error: { code: string; retryable: boolean } }>();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.retryable).toBe(false);
  });
});
