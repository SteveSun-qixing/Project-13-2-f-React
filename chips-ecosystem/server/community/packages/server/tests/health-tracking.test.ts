import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestHarness, registerAccount, type TestHarness } from './helpers/harness.js';

/**
 * 健康检查与请求追踪契约（契约 §2.4/§2.5）。
 */

describe('GET /api/v1/health', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    harness = await buildTestHarness();
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('健康时返回 200 与固定四字段（不使用统一信封）', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json<Record<string, unknown>>();
    expect(body['status']).toBe('ok');
    expect(typeof body['timestamp']).toBe('string');
    expect(new Date(body['timestamp'] as string).toISOString()).toBe(body['timestamp']);
    expect(body['version']).toBe('0.1.0');
    expect(body['apiVersion']).toBe('v1');
    expect(body['data']).toBeUndefined();
    expect(body['error']).toBeUndefined();
  });

  it('数据库组件不可用时返回 503 与 degraded，并列出不可用组件', async () => {
    const degraded = await buildTestHarness();
    degraded.serverDeps.healthRegistry.register('database', () =>
      Promise.reject(new Error('连接失败'))
    );
    const response = await degraded.app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(503);
    const body = response.json<{ status: string; details: { unavailableComponents: string[] } }>();
    expect(body.status).toBe('degraded');
    expect(body.details.unavailableComponents).toEqual(['database']);
    await degraded.app.close();
  });
});

describe('请求追踪（X-Request-Id）', () => {
  it('携带合法 X-Request-Id 时原样回显', async () => {
    const harness = await buildTestHarness();
    const requestId = 'abcdefghijklmnopabcdefghijklmnop';
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-request-id': requestId },
    });
    expect(response.headers['x-request-id']).toBe(requestId);
    await harness.app.close();
  });

  it('未携带时生成 32 字符请求标识并回显', async () => {
    const harness = await buildTestHarness();
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/health' });
    const echoed = response.headers['x-request-id'];
    expect(typeof echoed).toBe('string');
    expect((echoed as string).length).toBe(32);
    await harness.app.close();
  });

  it('非法 X-Request-Id（长度不足）被替换为服务端生成值', async () => {
    const harness = await buildTestHarness();
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { 'x-request-id': 'too-short' },
    });
    expect(response.headers['x-request-id']).not.toBe('too-short');
    expect((response.headers['x-request-id'] as string).length).toBe(32);
    await harness.app.close();
  });
});

describe('统一错误信封（契约 §7.2）', () => {
  it('未知路由返回 404 与已登记业务码信封', async () => {
    const harness = await buildTestHarness();
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(response.statusCode).toBe(404);
    const body = response.json<{
      error: { code: string; message: string; details: { traceId: string }; retryable: boolean };
    }>();
    expect(body.error.code).toBe('COMMUNITY_VALIDATION_ERROR');
    expect(body.error.message).toBe('请求的资源不存在');
    expect(typeof body.error.details.traceId).toBe('string');
    expect(body.error.retryable).toBe(false);
    await harness.app.close();
  });

  it('未归一异常归一为 500 COMMUNITY_INTERNAL_ERROR 且不回显堆栈', async () => {
    const harness = await buildTestHarness();
    harness.app.post('/api/v1/__boom', () => {
      throw new Error('内部堆栈细节');
    });
    const response = await harness.app.inject({ method: 'POST', url: '/api/v1/__boom' });
    expect(response.statusCode).toBe(500);
    const body = response.json<{ error: { code: string; message: string; retryable: boolean } }>();
    expect(body.error.code).toBe('COMMUNITY_INTERNAL_ERROR');
    expect(body.error.message).not.toContain('内部堆栈细节');
    expect(body.error.retryable).toBe(true);
    await harness.app.close();
  });

  it('非法 JSON 请求体归一为 400 COMMUNITY_VALIDATION_ERROR', async () => {
    const harness = await buildTestHarness();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: '{not-json',
      headers: { 'content-type': 'application/json' },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('COMMUNITY_VALIDATION_ERROR');
    await harness.app.close();
  });
});

describe('注册夹具连通性', () => {
  it('注册返回 201 并可登录', async () => {
    const harness = await buildTestHarness();
    const account = await registerAccount(harness.app, { username: 'alice' });
    const login = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'alice', password: 'correct-horse-battery' },
    });
    expect(login.statusCode).toBe(200);
    expect(account.accessToken.length).toBeGreaterThan(0);
    await harness.app.close();
  });
});
