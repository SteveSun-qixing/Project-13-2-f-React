import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestHarness,
  registerAccount,
  type RegisteredAccount,
  type TestHarness,
} from './helpers/harness.js';
import { hashPayload } from '../src/lib/pagination.js';
import { InMemoryRateLimitStore } from '../src/plugins/rate-limit.plugin.js';
import { buildPagination, offsetOf, parsePagination } from '../src/lib/pagination.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import {
  generateRequestId,
  isValidIdempotencyKey,
  isValidRequestId,
  parseExpiresInToSeconds,
  strongETag,
} from '../src/lib/http-tokens.js';

/**
 * 限流（契约 §6.3）与幂等（契约 §6.2）中间件契约，及基础库单元测试。
 * 幂等端点（上传/下载会话、房间创建）归传输臂/内容写域臂挂接；本臂以测试路由
 * 验证中间件语义（插件为正式实现，测试路由仅是夹具）。
 */

describe('限流契约（账号与来源 IP 双维度）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;
  let account: RegisteredAccount;

  beforeAll(async () => {
    harness = await buildTestHarness({
      config: {
        rateLimitWindowSeconds: 60,
        rateLimitAuthMax: 2,
        rateLimitBrowseMax: 3,
      },
    });
    app = harness.app;
    account = await registerAccount(app, { username: 'ratelimit-user' });
    // 浏览档位测试路由（browse 档）
    app.get('/api/v1/__browse', async () => ({ data: { ok: true } }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('浏览档位：超过阈值返回 429 COMMUNITY_RATE_LIMITED 与限流响应头', async () => {
    for (let i = 0; i < 3; i += 1) {
      const ok = await app.inject({ method: 'GET', url: '/api/v1/__browse' });
      expect(ok.statusCode).toBe(200);
    }
    const limited = await app.inject({ method: 'GET', url: '/api/v1/__browse' });
    expect(limited.statusCode).toBe(429);
    const body = limited.json() as { error: { code: string; retryable: boolean } };
    expect(body.error.code).toBe('COMMUNITY_RATE_LIMITED');
    expect(body.error.retryable).toBe(true);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['x-ratelimit-limit']).toBe('3');
    expect(limited.headers['x-ratelimit-remaining']).toBe('0');
    expect(Number(limited.headers['x-ratelimit-reset'])).toBeGreaterThan(0);
  });

  it('认证档位比浏览档位更严格（认证类接口独立档位）', async () => {
    let sawLimit = false;
    for (let i = 0; i < 5; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: 'nobody', password: 'wrong-password' },
      });
      if (response.statusCode === 429) {
        sawLimit = true;
        expect((response.json() as { error: { code: string } }).error.code).toBe('COMMUNITY_RATE_LIMITED');
        break;
      }
    }
    expect(sawLimit).toBe(true);
  });

  it('进程内存储：窗口过期后计数重置', async () => {
    const store = new InMemoryRateLimitStore();
    const now = Date.now();
    store.hit('k', 1, now);
    store.hit('k', 1, now);
    const state = store.hit('k', 1, now);
    expect(state.count).toBe(3);
    const next = store.hit('k', 1, now + 2000);
    expect(next.count).toBe(1);
  });
});

describe('幂等中间件契约（同键同体重放首响，同键异体 409）', () => {
  let harness: TestHarness;
  let app: FastifyInstance;
  let account: RegisteredAccount;

  beforeAll(async () => {
    harness = await buildTestHarness();
    app = harness.app;
    account = await registerAccount(app, { username: 'idem-user' });
    // 夹具路由：声明幂等端点（正式端点由内容写域臂/传输臂按契约 §6.2 挂接）
    app.post(
      '/api/v1/__idempotent',
      {
        preHandler: [app.authenticate, app.idempotencyGuard],
        config: { idempotency: 'POST /api/v1/__idempotent' },
      },
      async (request) => {
        const body = request.body as { value: number };
        return { data: { value: body.value, echo: 'first-result' } };
      },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('非法幂等键（长度不足）→ 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/__idempotent',
      headers: { ...authHeader(account.accessToken), 'idempotency-key': 'short' },
      payload: { value: 1 },
    });
    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: { code: string } }).error.code).toBe('COMMUNITY_VALIDATION_ERROR');
  });

  it('同键同体：重放首次结果（状态码与响应体一致）', async () => {
    const key = 'idem-key-0001';
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/__idempotent',
      headers: { ...authHeader(account.accessToken), 'idempotency-key': key },
      payload: { value: 42 },
    });
    expect(first.statusCode).toBe(200);
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/__idempotent',
      headers: { ...authHeader(account.accessToken), 'idempotency-key': key },
      payload: { value: 42 },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toBe(first.body);
    expect(JSON.parse(replay.body)).toEqual({ data: { value: 42, echo: 'first-result' } });
  });

  it('同键异体：409 COMMUNITY_IDEMPOTENCY_CONFLICT', async () => {
    const key = 'idem-key-0002';
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/__idempotent',
      headers: { ...authHeader(account.accessToken), 'idempotency-key': key },
      payload: { value: 1 },
    });
    expect(first.statusCode).toBe(200);
    const conflict = await app.inject({
      method: 'POST',
      url: '/api/v1/__idempotent',
      headers: { ...authHeader(account.accessToken), 'idempotency-key': key },
      payload: { value: 2 },
    });
    expect(conflict.statusCode).toBe(409);
    expect((conflict.json() as { error: { code: string } }).error.code).toBe('COMMUNITY_IDEMPOTENCY_CONFLICT');
  });

  it('不同账号同键互不影响（账号维度隔离）', async () => {
    const other = await registerAccount(app, { username: 'idem-other' });
    const key = 'idem-key-0003';
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/__idempotent',
      headers: { ...authHeader(account.accessToken), 'idempotency-key': key },
      payload: { value: 7 },
    });
    expect(first.statusCode).toBe(200);
    const otherResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/__idempotent',
      headers: { ...authHeader(other.accessToken), 'idempotency-key': key },
      payload: { value: 7 },
    });
    expect(otherResponse.statusCode).toBe(200);
    expect(otherResponse.body).toBe(first.body);
  });

  it('5xx 不缓存为重放结果并释放占用', async () => {
    app.post(
      '/api/v1/__idem-boom',
      {
        preHandler: [app.authenticate, app.idempotencyGuard],
        config: { idempotency: 'POST /api/v1/__idem-boom' },
      },
      async () => {
        throw new Error('失败');
      },
    );
    const key = 'idem-key-boom';
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/__idem-boom',
      headers: { ...authHeader(account.accessToken), 'idempotency-key': key },
      payload: {},
    });
    expect(first.statusCode).toBe(500);
    // 失败后重试按新请求处理（占用已释放）
    const retry = await app.inject({
      method: 'POST',
      url: '/api/v1/__idem-boom',
      headers: { ...authHeader(account.accessToken), 'idempotency-key': key },
      payload: {},
    });
    expect(retry.statusCode).toBe(500);
  });
});

describe('基础库单元', () => {
  it('parsePagination：缺省与非法分支', () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 20 });
    expect(parsePagination({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
    expect(() => parsePagination({ page: '0' })).toThrow();
    expect(() => parsePagination({ pageSize: '101' })).toThrow();
    expect(() => parsePagination({ page: 'abc' })).toThrow();
  });

  it('buildPagination：totalPages 向上取整', () => {
    expect(buildPagination({ page: 1, pageSize: 20 }, 100)).toEqual({
      page: 1,
      pageSize: 20,
      total: 100,
      totalPages: 5,
    });
    expect(buildPagination({ page: 1, pageSize: 20 }, 1)).toMatchObject({ totalPages: 1 });
    expect(buildPagination({ page: 5, pageSize: 20 }, 0)).toMatchObject({ totalPages: 0 });
    expect(offsetOf({ page: 3, pageSize: 20 })).toBe(40);
  });

  it('hashPassword/verifyPassword：scrypt 往返与错误口令', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct-horse-battery', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
    expect(await verifyPassword('x', 'malformed')).toBe(false);
  });

  it('parseExpiresInToSeconds：单位解析与回退', () => {
    expect(parseExpiresInToSeconds('15m', 0)).toBe(900);
    expect(parseExpiresInToSeconds('30d', 0)).toBe(2_592_000);
    expect(parseExpiresInToSeconds('1h', 0)).toBe(3600);
    expect(parseExpiresInToSeconds('45s', 0)).toBe(45);
    expect(parseExpiresInToSeconds('bogus', 123)).toBe(123);
  });

  it('请求标识与幂等键校验（契约 §2.4/§6.2 字符集口径）', () => {
    const id = generateRequestId();
    expect(id).toHaveLength(32);
    expect(isValidRequestId(id)).toBe(true);
    expect(isValidRequestId('short')).toBe(false);
    expect(isValidRequestId('x'.repeat(129))).toBe(false);
    expect(isValidRequestId('contains space'.padEnd(32, 'x'))).toBe(false);
    expect(isValidIdempotencyKey('a'.repeat(8))).toBe(true);
    expect(isValidIdempotencyKey('a'.repeat(7))).toBe(false);
    expect(isValidIdempotencyKey('a'.repeat(129))).toBe(false);
  });

  it('strongETag 与 hashPayload 稳定性', () => {
    const body = JSON.stringify({ hello: '世界' });
    expect(strongETag(body)).toBe(strongETag(body));
    expect(strongETag(body)).toMatch(/^"[0-9a-f]{64}"$/);
    expect(hashPayload({ a: 1 })).toBe(hashPayload({ a: 1 }));
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
    expect(hashPayload(undefined)).toBe(hashPayload(null));
  });
});
