import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { isClientCorsOriginAllowed } from '../src/app.js';
import {
  buildTestApp,
  fixtureDates,
  makeCard,
  TEST_API_TOKEN,
  type FakeState,
  type TestHarness,
} from './helpers/harness.js';
import type { CardSummaryDto } from '../src/services/card.service.js';

/**
 * API_TOKEN 鉴权臂契约测试（《15》§5.2、契约 §三）：三分支＝缺失 / 错误 / 放行，
 * 校验失败统一 401 API_TOKEN_INVALID（不区分原因、不泄露细节、不锁定来源）；
 * 读操作永不要求令牌（§5.1）；管理读（cards/manage）为令牌放行的验证面。
 */

describe('API_TOKEN 鉴权三分支（契约 §3.1/§3.2）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    const state: FakeState = {
      cards: [
        makeCard({ id: 'card-public', title: '公开', createdAt: fixtureDates.a }),
        makeCard({
          id: 'card-private',
          title: '私密',
          visibility: 'private',
          createdAt: fixtureDates.b,
        }),
        makeCard({
          id: 'card-pending',
          title: '未渲染',
          status: 'pending',
          createdAt: fixtureDates.c,
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

  it('分支一（缺失）：无 Authorization 头 → 401 API_TOKEN_INVALID，信封含 retryable:false 与 traceId', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cards/manage' });
    expect(response.statusCode).toBe(401);
    const body = response.json<{
      error: { code: string; message: string; retryable: boolean; details: { traceId: string } };
    }>();
    expect(body.error.code).toBe('API_TOKEN_INVALID');
    expect(body.error.retryable).toBe(false);
    expect(typeof body.error.details.traceId).toBe('string');
    // 不区分原因：缺失与错误共用同一文案（§3.2 不返回差异细节）
    expect(body.error.message).toBe('管理令牌缺失、格式错误或不匹配');
  });

  it('分支二（错误）：Bearer 错误令牌 → 401 同码同文案，响应不回显令牌', async () => {
    const wrongToken = `${TEST_API_TOKEN.slice(0, -1)}X`;
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/manage',
      headers: { authorization: `Bearer ${wrongToken}` },
    });
    expect(response.statusCode).toBe(401);
    const body = response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe('API_TOKEN_INVALID');
    expect(body.error.message).toBe('管理令牌缺失、格式错误或不匹配');
    expect(response.body).not.toContain(wrongToken);
    expect(response.body).not.toContain(TEST_API_TOKEN);
  });

  it('分支二（格式错误）：非 Bearer 前缀与空 Bearer → 401 同码（格式错误并入统一口径）', async () => {
    const raw = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/manage',
      headers: { authorization: TEST_API_TOKEN },
    });
    expect(raw.statusCode).toBe(401);
    expect(raw.json<{ error: { code: string } }>().error.code).toBe('API_TOKEN_INVALID');

    const empty = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/manage',
      headers: { authorization: 'Bearer ' },
    });
    expect(empty.statusCode).toBe(401);
    expect(empty.json<{ error: { code: string } }>().error.code).toBe('API_TOKEN_INVALID');
  });

  it('分支三（放行）：正确 Bearer 令牌 → 200，manage 列表含私密与未渲染（全部可见性与状态）', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/manage',
      headers: { authorization: `Bearer ${TEST_API_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      data: CardSummaryDto[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }>();
    expect(body.data.map((item) => item.id)).toEqual([
      'card-pending',
      'card-private',
      'card-public',
    ]);
    expect(body.data.map((item) => item.visibility).sort()).toEqual([
      'private',
      'public',
      'public',
    ]);
    expect(body.pagination).toEqual({ page: 1, pageSize: 20, total: 3, totalPages: 1 });
  });

  it('管理读分页与公开读同口径（page/pageSize 生效）', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards/manage?page=2&pageSize=2',
      headers: { authorization: `Bearer ${TEST_API_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ data: CardSummaryDto[]; pagination: { totalPages: number } }>();
    expect(body.data).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
  });

  it('公开读永不要求令牌（§5.1）：列表/详情/健康检查无令牌 → 200', async () => {
    for (const url of [
      '/api/v1/cards',
      '/api/v1/boxes',
      '/api/v1/health',
      '/api/v1/cards/card-public',
    ]) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode, url).toBe(200);
    }
  });
});

describe('CORS 来源放行（契约 §3.6）', () => {
  it('isClientCorsOriginAllowed：chips-render: 前缀与 null 来源放行，白名单外拒绝', () => {
    expect(isClientCorsOriginAllowed('chips-render://plugin-page', [])).toBe(true);
    expect(isClientCorsOriginAllowed('null', [])).toBe(true);
    expect(isClientCorsOriginAllowed('https://extra.example', ['https://extra.example'])).toBe(
      true
    );
    expect(isClientCorsOriginAllowed('https://evil.example', [])).toBe(false);
  });

  it('生产模式：同源与白名单来源回显 ACAO，陌生来源不回显；开发模式放行全部来源', async () => {
    const prod = await buildTestApp({
      config: { nodeEnv: 'production', corsExtraOrigins: ['https://extra.example'] },
    });
    const sameOrigin = await prod.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://personal.example.test' },
    });
    expect(sameOrigin.headers['access-control-allow-origin']).toBe('https://personal.example.test');

    const host = await prod.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'chips-render://preview' },
    });
    expect(host.headers['access-control-allow-origin']).toBe('chips-render://preview');

    const stranger = await prod.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(stranger.headers['access-control-allow-origin']).toBeUndefined();
    await prod.app.close();

    const dev = await buildTestApp({ config: { nodeEnv: 'development' } });
    const anyOrigin = await dev.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(anyOrigin.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    await dev.app.close();
  });
});
