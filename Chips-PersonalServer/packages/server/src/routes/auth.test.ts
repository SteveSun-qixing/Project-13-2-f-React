import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const userServiceMock = {
  create: vi.fn(),
  findByUsername: vi.fn(),
  validatePassword: vi.fn(),
  toPrivateProfile: vi.fn((user: Record<string, unknown>) => user),
  isAccountLocked: vi.fn(),
  recordLoginFailure: vi.fn(),
  clearLoginFailure: vi.fn(),
};

const authServiceMock = {
  generateTokenPair: vi.fn(),
  parseExpiresInToSeconds: vi.fn(() => 2592000),
  isAccountLocked: vi.fn(),
  recordLoginFailure: vi.fn(),
  clearLoginFailure: vi.fn(),
  verifyRefreshToken: vi.fn(),
  isTokenRevoked: vi.fn(),
  revokeToken: vi.fn(),
};

const envMock = {
  NODE_ENV: 'development',
  JWT_SECRET: 'test-secret-test-secret-test-secret-test-secret-1234',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '30d',
  BASE_URL: 'http://localhost',
  CORS_EXTRA_ORIGINS: '',
};

vi.mock('../services/user.service', () => ({
  UserService: userServiceMock,
}));

vi.mock('../services/auth.service', () => ({
  AuthService: authServiceMock,
}));

vi.mock('../config/env', () => ({
  env: envMock,
}));

async function buildAuthApp() {
  const { default: authRoutes } = await import('./auth');
  const app = Fastify();
  await app.register(fastifyJwt, {
    secret: envMock.JWT_SECRET,
    sign: { algorithm: 'HS256' },
  });
  await app.register(fastifyCookie, {
    secret: envMock.JWT_SECRET,
    parseOptions: {},
  });
  await app.register(authRoutes);
  return app;
}

const fakeUser = {
  id: 'user-1',
  username: 'alice',
  displayName: 'Alice',
  bio: null,
  avatarUrl: null,
  role: 'user',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  authServiceMock.parseExpiresInToSeconds.mockReturnValue(2592000);
  authServiceMock.generateTokenPair.mockReturnValue({
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
  });
  userServiceMock.toPrivateProfile.mockImplementation((user: Record<string, unknown>) => user);
});

describe('auth route token response', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('注册响应体返回 accessToken 与 refreshToken 明文', async () => {
    userServiceMock.create.mockResolvedValue(fakeUser);

    const app = await buildAuthApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'alice', password: 'password-123' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.accessToken).toBe('access-token-1');
    expect(body.data.refreshToken).toBe('refresh-token-1');
    expect(response.cookies).toHaveLength(1);
    expect(response.cookies[0]?.name).toBe('chips_refresh_token');
  });

  it('登录响应体返回 accessToken 与 refreshToken 明文', async () => {
    authServiceMock.isAccountLocked.mockResolvedValue(false);
    userServiceMock.findByUsername.mockResolvedValue(fakeUser);
    userServiceMock.validatePassword.mockResolvedValue(true);
    authServiceMock.clearLoginFailure.mockResolvedValue(undefined);

    const app = await buildAuthApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'alice', password: 'password-123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.accessToken).toBe('access-token-1');
    expect(body.data.refreshToken).toBe('refresh-token-1');
    expect(response.cookies).toHaveLength(1);
    expect(response.cookies[0]?.name).toBe('chips_refresh_token');
  });
});

describe('isClientCorsOriginAllowed', () => {
  it('放行 chips-render: 前缀的 Host 客户端来源', async () => {
    const { isClientCorsOriginAllowed } = await import('../app');
    expect(isClientCorsOriginAllowed('chips-render://plugin/com.chips.community-client')).toBe(true);
  });

  it('放行 null origin（file:// 客户端页面）', async () => {
    const { isClientCorsOriginAllowed } = await import('../app');
    expect(isClientCorsOriginAllowed('null')).toBe(true);
  });

  it('放行 CORS_EXTRA_ORIGINS 白名单中的来源', async () => {
    const { isClientCorsOriginAllowed } = await import('../app');
    expect(isClientCorsOriginAllowed('https://client.example.com', ['https://client.example.com'])).toBe(true);
  });

  it('拒绝未知来源', async () => {
    const { isClientCorsOriginAllowed } = await import('../app');
    expect(isClientCorsOriginAllowed('https://evil.example.com')).toBe(false);
  });
});
