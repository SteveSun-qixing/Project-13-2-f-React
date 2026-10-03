import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestHarness,
  registerAccount,
  type RegisteredAccount,
  type TestHarness,
} from './helpers/harness.js';

type InjectResponse = Awaited<ReturnType<FastifyInstance['inject']>>;
type InjectCookie = InjectResponse['cookies'][number];

/**
 * 认证与令牌契约（《11 契约》§三）：注册、登录、刷新（含轮换与 204 口径）、登出、
 * 账号锁定、停用账号、Cookie 属性。
 */

interface SessionBody {
  data: {
    user: {
      id: string;
      username: string;
      displayName: string;
      bio: string | null;
      avatarUrl: string | null;
      role: string;
      createdAt: string;
      email?: string;
    };
    accessToken: string;
    refreshToken: string;
  };
}

function findCookie(cookies: InjectCookie[], name: string): InjectCookie | undefined {
  return cookies.find((cookie) => cookie.name === name);
}

describe('认证与令牌契约', () => {
  let harness: TestHarness;
  let app: FastifyInstance;

  beforeAll(async () => {
    harness = await buildTestHarness();
    app = harness.app;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('201：创建账号并直接建立会话，user 字段按 §3.2 示例', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          username: 'alice',
          email: 'alice@example.test',
          password: 'password-123',
          displayName: 'Alice',
        },
      });
      expect(response.statusCode).toBe(201);
      const body = response.json<SessionBody>();
      expect(Object.keys(body.data).sort()).toEqual(['accessToken', 'refreshToken', 'user']);
      expect(Object.keys(body.data.user).sort()).toEqual([
        'avatarUrl',
        'bio',
        'createdAt',
        'displayName',
        'id',
        'role',
        'username',
      ]);
      expect(body.data.user.username).toBe('alice');
      expect(body.data.user.displayName).toBe('Alice');
      expect(body.data.user.role).toBe('user');
      expect(body.data.user.email).toBeUndefined();
      // UUID v4 实体 ID（契约 §2.2）
      expect(body.data.user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('displayName 缺省取 username；浏览器写入 HttpOnly Cookie（Path=/api/v1/auth、SameSite=Strict）', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { username: 'bob', email: 'bob@example.test', password: 'password-123' },
      });
      expect(response.statusCode).toBe(201);
      const body = response.json<SessionBody>();
      expect(body.data.user.displayName).toBe('bob');
      const cookie = findCookie(response.cookies, 'chips_refresh_token');
      expect(cookie).toBeDefined();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.path).toBe('/api/v1/auth');
      expect(cookie?.sameSite).toBe('Strict');
      // Secure 仅在 HTTPS（production）下携带：set-cookie 原始头不含 Secure 属性
      // （set-cookie-parser 只在属性存在时产出 secure 字段，无法断言 false）。
      const setCookieHeader = response.headers['set-cookie'];
      const rawCookie = Array.isArray(setCookieHeader)
        ? setCookieHeader.join('\n')
        : String(setCookieHeader ?? '');
      expect(rawCookie).not.toContain('Secure');
    });

    it('username 含大写或非法字符 → 400 COMMUNITY_VALIDATION_ERROR', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { username: 'Alice!', email: 'a@example.test', password: 'password-123' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: { code: string } }>().error.code).toBe(
        'COMMUNITY_VALIDATION_ERROR'
      );
    });

    it('口令短于策略下限 → 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { username: 'shortpw', email: 'shortpw@example.test', password: 'short' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('用户名或邮箱已注册 → 409 COMMUNITY_AUTH_USER_EXISTS', async () => {
      await registerAccount(app, { username: 'dupuser', email: 'dup@example.test' });
      const sameName = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { username: 'dupuser', email: 'other@example.test', password: 'password-123' },
      });
      expect(sameName.statusCode).toBe(409);
      expect(sameName.json<{ error: { code: string } }>().error.code).toBe(
        'COMMUNITY_AUTH_USER_EXISTS'
      );
      const sameEmail = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { username: 'otheruser', email: 'dup@example.test', password: 'password-123' },
      });
      expect(sameEmail.statusCode).toBe(409);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let account: RegisteredAccount;

    beforeAll(async () => {
      account = await registerAccount(app, { username: 'carol', email: 'carol@example.test' });
    });

    it('200：邮箱或用户名均可作为标识', async () => {
      for (const identifier of ['carol', 'carol@example.test']) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { identifier, password: 'correct-horse-battery' },
        });
        expect(response.statusCode).toBe(200);
        const body = response.json<SessionBody>();
        expect(body.data.user.id).toBe(account.userId);
        expect(body.data.user.role).toBe('user');
      }
    });

    it('口令错误 → 401 COMMUNITY_AUTH_INVALID_CREDENTIALS', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: 'carol', password: 'wrong-password' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json<{ error: { code: string } }>().error.code).toBe(
        'COMMUNITY_AUTH_INVALID_CREDENTIALS'
      );
    });

    it('连续失败达到阈值 → 403 COMMUNITY_AUTH_ACCOUNT_LOCKED（retryable）', async () => {
      const name = `lockme-${Math.random().toString(36).slice(2, 8)}`;
      await registerAccount(app, { username: name, password: 'password-123' });
      for (let i = 0; i < 3; i += 1) {
        const failed = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { identifier: name, password: 'wrong-password' },
        });
        expect(failed.statusCode).toBe(401);
      }
      const locked = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: name, password: 'password-123' },
      });
      expect(locked.statusCode).toBe(403);
      const body = locked.json<{ error: { code: string; retryable: boolean } }>();
      expect(body.error.code).toBe('COMMUNITY_AUTH_ACCOUNT_LOCKED');
      expect(body.error.retryable).toBe(true);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('200：轮换返回新令牌对；旧 refresh 立即失效（再刷 → 204）', async () => {
      const account = await registerAccount(app, { username: 'refresh-a' });
      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: account.refreshToken },
      });
      expect(first.statusCode).toBe(200);
      const body = first.json<{ data: { accessToken: string; refreshToken: string } }>();
      expect(typeof body.data.accessToken).toBe('string');
      expect(typeof body.data.refreshToken).toBe('string');

      const replay = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: account.refreshToken },
      });
      expect(replay.statusCode).toBe(204);
      expect(replay.body).toBe('');
    });

    it('Cookie 路径可刷新（浏览器）', async () => {
      const account = await registerAccount(app, { username: 'refresh-b' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: { chips_refresh_token: account.cookie ?? '' },
      });
      expect(response.statusCode).toBe(200);
    });

    it('无令牌 / 已失效 / 篡改令牌一律 204，不泄露会话状态', async () => {
      for (const payload of [undefined, { refreshToken: 'not-a-jwt' }]) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/refresh',
          ...(payload === undefined ? {} : { payload }),
        });
        expect(response.statusCode).toBe(204);
      }
    });

    it('请求体字段类型错误 → 400 COMMUNITY_VALIDATION_ERROR（契约 §3.3）', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: 123 },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: { code: string } }>().error.code).toBe(
        'COMMUNITY_VALIDATION_ERROR'
      );
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('204：吊销当前 refresh 会话并清除 Cookie；重复调用仍 204（幂等）', async () => {
      const account = await registerAccount(app, { username: 'logout-a' });
      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: { refreshToken: account.refreshToken },
      });
      expect(first.statusCode).toBe(204);
      const cleared = findCookie(first.cookies, 'chips_refresh_token');
      expect(cleared?.value).toBe('');

      const replay = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: { refreshToken: account.refreshToken },
      });
      expect(replay.statusCode).toBe(204);

      const afterLogout = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: account.refreshToken },
      });
      expect(afterLogout.statusCode).toBe(204);
    });
  });

  describe('停用账号与角色', () => {
    it('改密后除当前会话外的 refresh 会话被吊销（契约 §4.3）', async () => {
      const account = await registerAccount(app, { username: 'pwchange' });
      // 第二个会话
      const second = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: 'pwchange', password: 'correct-horse-battery' },
      });
      const secondBody = second.json<SessionBody>();

      const change = await app.inject({
        method: 'PUT',
        url: '/api/v1/users/me/password',
        headers: authHeader(account.accessToken),
        payload: { currentPassword: 'correct-horse-battery', newPassword: 'new-password-456' },
      });
      expect(change.statusCode).toBe(204);

      // 当前会话仍可刷新
      const currentSession = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: account.refreshToken },
      });
      expect(currentSession.statusCode).toBe(200);
      // 其他会话已被吊销
      const otherSession = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: secondBody.data.refreshToken },
      });
      expect(otherSession.statusCode).toBe(204);

      // 旧口令与新口令
      const oldPassword = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: 'pwchange', password: 'correct-horse-battery' },
      });
      expect(oldPassword.statusCode).toBe(401);
      const newPassword = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: 'pwchange', password: 'new-password-456' },
      });
      expect(newPassword.statusCode).toBe(200);
    });

    it('停用账号：登录按 403 USER_ACCOUNT_DISABLED，受保护访问按不可用处理', async () => {
      const account = await registerAccount(app, { username: 'disabled-a' });
      const row = harness.state.users.find((user) => user.id === account.userId);
      expect(row).toBeDefined();
      row!.isActive = false;

      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: 'disabled-a', password: 'correct-horse-battery' },
      });
      expect(login.statusCode).toBe(403);
      expect(login.json<{ error: { code: string } }>().error.code).toBe(
        'COMMUNITY_USER_ACCOUNT_DISABLED'
      );

      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: authHeader(account.accessToken),
      });
      expect(me.statusCode).toBe(403);
      expect(me.json<{ error: { code: string } }>().error.code).toBe(
        'COMMUNITY_USER_ACCOUNT_DISABLED'
      );

      // 刷新：一律 204（不区分用户不可用，契约 §3.3）
      const refresh = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken: account.refreshToken },
      });
      expect(refresh.statusCode).toBe(204);
    });
  });

  describe('认证失败码区分（契约 §7.3）', () => {
    it('缺 token → TOKEN_MISSING；篡改 → TOKEN_INVALID；过期 → TOKEN_EXPIRED', async () => {
      const missing = await app.inject({ method: 'GET', url: '/api/v1/users/me' });
      expect(missing.statusCode).toBe(401);
      expect(missing.json<{ error: { code: string } }>().error.code).toBe(
        'COMMUNITY_AUTH_TOKEN_MISSING'
      );

      const invalid = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: authHeader('not-a-jwt'),
      });
      expect(invalid.statusCode).toBe(401);
      expect(invalid.json<{ error: { code: string } }>().error.code).toBe(
        'COMMUNITY_AUTH_TOKEN_INVALID'
      );

      // 篡改 refresh token 打访问接口同样按非法处理
      const account = await registerAccount(app, { username: 'tokentype' });
      const wrongType = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: authHeader(account.refreshToken),
      });
      expect(wrongType.statusCode).toBe(401);
      expect(wrongType.json<{ error: { code: string } }>().error.code).toBe(
        'COMMUNITY_AUTH_TOKEN_INVALID'
      );

      const expiredApp = await buildTestHarness({ config: { accessExpiresIn: '1s' } });
      const expAccount = await registerAccount(expiredApp.app, { username: 'expired-a' });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const expired = await expiredApp.app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: authHeader(expAccount.accessToken),
      });
      expect(expired.statusCode).toBe(401);
      expect(expired.json<{ error: { code: string } }>().error.code).toBe(
        'COMMUNITY_AUTH_TOKEN_EXPIRED'
      );
      await expiredApp.app.close();
    });
  });
});
