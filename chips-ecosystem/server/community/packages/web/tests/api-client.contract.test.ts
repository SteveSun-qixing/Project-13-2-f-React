import { describe, expect, it, vi } from 'vitest';

import { CommunityApiClient } from '../src/api/client';
import { CommunityApiError } from '../src/api/errors';
import type { ICommunityAuthSession, ICommunityUserMe } from '../src/api/types';
import {
  createClient,
  jsonResponse,
  lastCall,
  loginSuccessBody,
  parseJsonBody,
  requestUrl,
  SESSION_USER,
  type FetchCall,
} from './helpers';

/**
 * API 客户端契约测试（《11 契约》§2/§3/§7）：fetch mock 逐字段对齐信封、DTO、
 * 错误归一（业务码透传、COMMUNITY_RESPONSE_INVALID 归一、网络失败）与 401 自动刷新
 * single-flight（§3.6）。
 */

describe('认证域请求（契约 §3.2）', () => {
  it('login：POST /api/v1/auth/login，请求体与头逐字段，凭据 include，成功返回会话（令牌写入由认证域封装负责）', async () => {
    const { client, calls, enqueue } = createClient();
    enqueue(jsonResponse(200, loginSuccessBody()));

    const session = await client.request<ICommunityAuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'alice@example.com', password: 'password-123' }),
    });

    const call = lastCall(calls);
    expect(call.url).toBe('/api/v1/auth/login');
    expect(call.init.method).toBe('POST');
    expect(call.init.credentials).toBe('include');
    const headers = new Headers(call.init.headers);
    expect(headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(headers.get('Authorization')).toBeNull();
    const requestId = headers.get('X-Request-Id');
    expect(requestId).not.toBeNull();
    expect(requestId).toMatch(/^[\x21-\x7E]{32,128}$/);

    expect(session.user).toEqual(SESSION_USER);
    expect(session.accessToken).toBe('access-token-a');
    expect(session.refreshToken).toBe('refresh-token-a');
    // 传输层不持有令牌：accessToken 的写入是认证域封装（api/auth）的职责
    expect(client.getAccessToken()).toBeNull();
  });

  it('register：POST /api/v1/auth/register，请求体逐字段，displayName 可缺省，201 返回会话', async () => {
    const { client, calls, enqueue } = createClient();
    enqueue(jsonResponse(201, loginSuccessBody('access-token-b', 'refresh-token-b')));

    const session = await client.request<ICommunityAuthSession>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password-123',
      }),
    });

    const call = lastCall(calls);
    expect(call.url).toBe('/api/v1/auth/register');
    expect(call.init.method).toBe('POST');
    expect(parseJsonBody(call.init)).toEqual({
      username: 'alice',
      email: 'alice@example.com',
      password: 'password-123',
    });
    expect(session.user.username).toBe('alice');
    expect(client.getAccessToken()).toBeNull();
  });

  it('已有内存令牌时自动附带 Authorization: Bearer', async () => {
    const { client, calls, enqueue } = createClient();
    client.setAccessToken('token-in-memory');
    enqueue(
      jsonResponse(200, {
        data: {
          ...SESSION_USER,
          email: 'alice@example.com',
          role: 'user',
          updatedAt: '2026-09-20T08:00:00.000Z',
        },
      })
    );

    await client.get('/users/me');

    const call = lastCall(calls);
    expect(call.url).toBe('/api/v1/users/me');
    const headers = new Headers(call.init.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-in-memory');
  });
});

describe('users 域 DTO（契约 §4.3）', () => {
  it('getMe：返回 ICommunityUserMe 逐字段；toSessionUser 收敛为会话用户口径', async () => {
    const { CommunityUsersApi } = await import('../src/api/users');
    const { client, calls, enqueue } = createClient();
    client.setAccessToken('token-me');
    enqueue(
      jsonResponse(200, {
        data: {
          id: SESSION_USER.id,
          username: 'alice',
          displayName: 'Alice',
          bio: '简介',
          avatarUrl: 'https://cdn.example.test/a.png',
          createdAt: '2026-09-19T08:00:00.000Z',
          email: 'alice@example.com',
          role: 'user',
          updatedAt: '2026-09-20T08:00:00.000Z',
        },
      })
    );

    const usersApi = new CommunityUsersApi(client);
    const me: ICommunityUserMe = await usersApi.getMe();
    expect(me).toEqual({
      id: SESSION_USER.id,
      username: 'alice',
      displayName: 'Alice',
      bio: '简介',
      avatarUrl: 'https://cdn.example.test/a.png',
      createdAt: '2026-09-19T08:00:00.000Z',
      email: 'alice@example.com',
      role: 'user',
      updatedAt: '2026-09-20T08:00:00.000Z',
    });
    expect(lastCall(calls).init.method).toBe('GET');

    const sessionUser = usersApi.toSessionUser(me);
    expect(sessionUser).toEqual({
      id: SESSION_USER.id,
      username: 'alice',
      displayName: 'Alice',
      bio: '简介',
      avatarUrl: 'https://cdn.example.test/a.png',
      role: 'user',
      createdAt: '2026-09-19T08:00:00.000Z',
    });
  });
});

describe('错误归一（契约 §7.2/§7.4）', () => {
  it('4xx 业务失败：同名业务码透传，details 附加 httpStatus，retryable 缺省按登记表', async () => {
    const { client, enqueue } = createClient();
    enqueue(
      jsonResponse(401, {
        error: {
          code: 'COMMUNITY_AUTH_INVALID_CREDENTIALS',
          message: '账号或口令错误',
          details: {},
        },
      })
    );

    const error = await client
      .post('/auth/login', { identifier: 'alice', password: 'bad' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CommunityApiError);
    const apiError = error as CommunityApiError;
    expect(apiError.code).toBe('COMMUNITY_AUTH_INVALID_CREDENTIALS');
    expect(apiError.message).toBe('账号或口令错误');
    expect(apiError.httpStatus).toBe(401);
    expect(apiError.retryable).toBe(false);
    expect(apiError.details).toMatchObject({ httpStatus: 401 });
  });

  it('retryable 缺省取登记表值：账号锁定默认可重试；显式字段优先', async () => {
    const { client, enqueue } = createClient();
    enqueue(
      jsonResponse(403, { error: { code: 'COMMUNITY_AUTH_ACCOUNT_LOCKED', message: '账号锁定中' } })
    );
    const locked = await client
      .post('/auth/login', { identifier: 'alice', password: 'x' })
      .catch((caught: unknown) => caught);
    expect((locked as CommunityApiError).retryable).toBe(true);

    enqueue(
      jsonResponse(403, {
        error: { code: 'COMMUNITY_AUTH_ACCOUNT_LOCKED', message: '账号锁定中', retryable: false },
      })
    );
    const explicit = await client
      .post('/auth/login', { identifier: 'alice', password: 'x' })
      .catch((caught: unknown) => caught);
    expect((explicit as CommunityApiError).retryable).toBe(false);
  });

  it('5xx 与 429：同名业务码透传且按登记表可重试', async () => {
    const { client, enqueue } = createClient();
    enqueue(
      jsonResponse(500, { error: { code: 'COMMUNITY_INTERNAL_ERROR', message: '服务内部错误' } })
    );
    const internal = await client.get('/users/alice').catch((caught: unknown) => caught);
    expect((internal as CommunityApiError).code).toBe('COMMUNITY_INTERNAL_ERROR');
    expect((internal as CommunityApiError).retryable).toBe(true);

    enqueue(
      jsonResponse(429, { error: { code: 'COMMUNITY_RATE_LIMITED', message: '请求过于频繁' } })
    );
    const limited = await client.get('/users/alice').catch((caught: unknown) => caught);
    expect((limited as CommunityApiError).code).toBe('COMMUNITY_RATE_LIMITED');
    expect((limited as CommunityApiError).retryable).toBe(true);
  });

  it('未登记业务码 → COMMUNITY_RESPONSE_INVALID（retryable true），traceId 记入诊断', async () => {
    const { client, enqueue } = createClient();
    enqueue(
      jsonResponse(400, {
        error: {
          code: 'COMMUNITY_NOT_REGISTERED',
          message: '未知错误',
          details: { traceId: 'trace-1' },
        },
      })
    );

    const error = (await client
      .get('/users/alice')
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(error.code).toBe('COMMUNITY_RESPONSE_INVALID');
    expect(error.retryable).toBe(true);
    expect(error.httpStatus).toBe(400);
    expect(error.traceId).toBe('trace-1');
  });

  it('错误信封缺 error 对象或字段非法 → COMMUNITY_RESPONSE_INVALID', async () => {
    const { client, enqueue } = createClient();
    enqueue(jsonResponse(500, { message: 'not-an-envelope' }));
    const missing = (await client
      .get('/users/alice')
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(missing.code).toBe('COMMUNITY_RESPONSE_INVALID');

    enqueue(jsonResponse(400, { error: { message: '缺 code' } }));
    const noCode = (await client
      .get('/users/alice')
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(noCode.code).toBe('COMMUNITY_RESPONSE_INVALID');
  });

  it('成功响应缺 data 或携带未知键 → COMMUNITY_RESPONSE_INVALID', async () => {
    const { client, enqueue } = createClient();
    enqueue(jsonResponse(200, { value: 1 }));
    const missingData = (await client
      .get('/users/alice')
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(missingData.code).toBe('COMMUNITY_RESPONSE_INVALID');

    enqueue(jsonResponse(200, { data: {}, extra: true }));
    const extraKeys = (await client
      .get('/users/alice')
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(extraKeys.code).toBe('COMMUNITY_RESPONSE_INVALID');
  });

  it('列表信封：data + pagination 合法返回', async () => {
    const { client, enqueue } = createClient();
    enqueue(
      jsonResponse(200, {
        data: [{ id: 'card-1' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      })
    );

    const payload = await client.get<Array<{ id: string }>>('/users/alice/cards');
    expect(payload).toEqual([{ id: 'card-1' }]);
  });

  it('网络未达服务端 → HTTP_REQUEST_FAILED（retryable true，httpStatus 0）', async () => {
    const client = new CommunityApiClient({
      fetchImpl: (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch,
    });

    const error = (await client
      .get('/users/alice')
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(error.code).toBe('HTTP_REQUEST_FAILED');
    expect(error.retryable).toBe(true);
    expect(error.httpStatus).toBe(0);
  });

  it('204 无正文成功不解析信封，返回 undefined', async () => {
    const { client, calls, enqueue } = createClient();
    enqueue(new Response(null, { status: 204 }));

    const payload = await client.post('/auth/logout');
    expect(payload).toBeUndefined();
    expect(lastCall(calls).init.method).toBe('POST');
  });

  it('get 查询串：params 以 URLSearchParams 序列化', async () => {
    const { client, calls, enqueue } = createClient();
    enqueue(
      jsonResponse(200, {
        data: [],
        pagination: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
      })
    );

    await client.get('/users/alice/cards', { page: '2', pageSize: '20' });

    expect(lastCall(calls).url).toBe('/api/v1/users/alice/cards?page=2&pageSize=20');
  });
});

describe('401 自动刷新（契约 §3.6）', () => {
  function expiredEnvelope(): Response {
    return jsonResponse(401, {
      error: { code: 'COMMUNITY_AUTH_TOKEN_EXPIRED', message: '登录状态已过期' },
    });
  }

  it('401 过期 → 合并刷新一次 → 新令牌重放原请求', async () => {
    const { client, calls, enqueue } = createClient();
    client.setAccessToken('stale-token');
    enqueue(expiredEnvelope());
    enqueue(jsonResponse(200, { data: { accessToken: 'fresh-token' } }));
    enqueue(jsonResponse(200, { data: { id: 'card-1' } }));

    const payload = await client.get('/cards/card-1');
    expect(payload).toEqual({ id: 'card-1' });
    expect(calls).toHaveLength(3);
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[1]?.url).toBe('/api/v1/auth/refresh');
    expect(calls[1]?.init.method).toBe('POST');
    expect(calls[1]?.init.credentials).toBe('include');
    expect(new Headers(calls[1]?.init.headers).get('Authorization')).toBeNull();
    expect(calls[2]?.url).toBe('/api/v1/cards/card-1');
    expect(new Headers(calls[2]?.init.headers).get('Authorization')).toBe('Bearer fresh-token');
    expect(client.getAccessToken()).toBe('fresh-token');
  });

  it('并发 401 合并为单次刷新（single-flight），各请求分别重放', async () => {
    const { client, calls, enqueue } = createClient();
    enqueue(expiredEnvelope());
    enqueue(expiredEnvelope());
    enqueue(jsonResponse(200, { data: { accessToken: 'fresh-token' } }));
    enqueue(jsonResponse(200, { data: { a: 1 } }));
    enqueue(jsonResponse(200, { data: { b: 2 } }));

    const [first, second] = await Promise.all([client.get('/a'), client.get('/b')]);
    expect(first).toEqual({ a: 1 });
    expect(second).toEqual({ b: 2 });

    const refreshCalls = calls.filter((call) => call.url === '/api/v1/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
    expect(calls).toHaveLength(5);
  });

  it('刷新返回 204：清空内存令牌、通知会话丢失，原始 401 交给业务层', async () => {
    const { client, calls, enqueue } = createClient();
    client.setAccessToken('stale-token');
    const onSessionLost = vi.fn();
    client.onSessionLost(onSessionLost);
    enqueue(expiredEnvelope());
    enqueue(new Response(null, { status: 204 }));

    const error = (await client
      .get('/users/me')
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(error.code).toBe('COMMUNITY_AUTH_TOKEN_EXPIRED');
    expect(client.getAccessToken()).toBeNull();
    expect(onSessionLost).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });

  it('刷新网络失败：同样清空会话并把原始 401 交给业务层', async () => {
    const { client, calls, enqueue } = createClient();
    client.setAccessToken('stale-token');
    const onSessionLost = vi.fn();
    client.onSessionLost(onSessionLost);
    enqueue(expiredEnvelope());
    enqueue(new TypeError('fetch failed'));

    const error = (await client
      .get('/users/me')
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(error.code).toBe('COMMUNITY_AUTH_TOKEN_EXPIRED');
    expect(client.getAccessToken()).toBeNull();
    expect(onSessionLost).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });

  it('非可刷新 401（TOKEN_MISSING 等）不触发刷新', async () => {
    const { client, calls, enqueue } = createClient();
    enqueue(
      jsonResponse(401, {
        error: { code: 'COMMUNITY_AUTH_TOKEN_MISSING', message: '未携带访问令牌' },
      })
    );

    const error = (await client
      .get('/users/me')
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(error.code).toBe('COMMUNITY_AUTH_TOKEN_MISSING');
    expect(calls).toHaveLength(1);
  });

  it('每个请求最多重放一次：重放再 401 不再刷新', async () => {
    const { client, calls, enqueue } = createClient();
    enqueue(expiredEnvelope());
    enqueue(jsonResponse(200, { data: { accessToken: 'fresh-token' } }));
    enqueue(expiredEnvelope());

    const error = (await client
      .get('/users/me')
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(error.code).toBe('COMMUNITY_AUTH_TOKEN_EXPIRED');
    expect(calls).toHaveLength(3);
    expect(calls.filter((call) => call.url === '/api/v1/auth/refresh')).toHaveLength(1);
  });
});

describe('认证域 API 封装（api/auth）', () => {
  it('login/register 设置内存令牌并返回会话；logout 后清空', async () => {
    const { CommunityAuthApi } = await import('../src/api/auth');
    const { client, calls, enqueue } = createClient();
    const authApi = new CommunityAuthApi(client);

    enqueue(jsonResponse(200, loginSuccessBody('token-login', 'refresh-login')));
    const loggedIn = await authApi.login({ identifier: 'alice', password: 'password-123' });
    expect(loggedIn.user.username).toBe('alice');
    expect(client.getAccessToken()).toBe('token-login');
    expect(parseJsonBody(lastCall(calls).init)).toEqual({
      identifier: 'alice',
      password: 'password-123',
    });

    enqueue(jsonResponse(201, loginSuccessBody('token-register', 'refresh-register')));
    const registered = await authApi.register({
      username: 'alice',
      email: 'alice@example.com',
      password: 'password-123',
    });
    expect(registered.user.username).toBe('alice');
    expect(client.getAccessToken()).toBe('token-register');

    enqueue(new Response(null, { status: 204 }));
    await authApi.logout();
    expect(client.getAccessToken()).toBeNull();
  });

  it('会话响应缺 refreshToken → COMMUNITY_RESPONSE_INVALID', async () => {
    const { CommunityAuthApi } = await import('../src/api/auth');
    const { client, enqueue } = createClient();
    const authApi = new CommunityAuthApi(client);
    enqueue(jsonResponse(200, { data: { user: { ...SESSION_USER }, accessToken: 'token-only' } }));

    const error = (await authApi
      .login({ identifier: 'alice', password: 'x' })
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(error.code).toBe('COMMUNITY_RESPONSE_INVALID');
    expect(client.getAccessToken()).toBeNull();
  });

  it('会话用户缺 role → COMMUNITY_RESPONSE_INVALID', async () => {
    const { CommunityAuthApi } = await import('../src/api/auth');
    const { client, enqueue } = createClient();
    const authApi = new CommunityAuthApi(client);
    enqueue(
      jsonResponse(200, {
        data: { user: { ...SESSION_USER, role: undefined }, accessToken: 't', refreshToken: 'r' },
      })
    );

    const error = (await authApi
      .login({ identifier: 'alice', password: 'x' })
      .catch((caught: unknown) => caught)) as CommunityApiError;
    expect(error.code).toBe('COMMUNITY_RESPONSE_INVALID');
  });
});

describe('请求方法与基址', () => {
  it('post/patch/put/delete 各方法与 JSON 请求体', async () => {
    const { client, calls, enqueue } = createClient();
    enqueue(jsonResponse(200, { data: {} }));
    enqueue(jsonResponse(200, { data: {} }));
    enqueue(jsonResponse(200, { data: {} }));
    enqueue(new Response(null, { status: 204 }));

    await client.post('/rooms', { name: '房间' });
    await client.patch('/cards/card-1', { visibility: 'private' });
    await client.put('/users/me/password', { currentPassword: 'a', newPassword: 'b' });
    await client.delete('/cards/card-1');

    expect(calls.map((call) => call.init.method)).toEqual(['POST', 'PATCH', 'PUT', 'DELETE']);
    expect(parseJsonBody(calls[0]?.init ?? {})).toEqual({ name: '房间' });
    expect(parseJsonBody(calls[1]?.init ?? {})).toEqual({ visibility: 'private' });
    expect(parseJsonBody(calls[2]?.init ?? {})).toEqual({ currentPassword: 'a', newPassword: 'b' });
  });

  it('自定义 baseUrl 前缀拼接在版本前缀之前', async () => {
    const calls: FetchCall[] = [];
    const client = new CommunityApiClient({
      baseUrl: 'https://community.example.test',
      fetchImpl: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        calls.push({ url: requestUrl(input), init: init ?? {} });
        return Promise.resolve(jsonResponse(200, { data: {} }));
      },
    });

    await client.get('/health');
    expect(calls[0]?.url).toBe('https://community.example.test/api/v1/health');
  });
});
