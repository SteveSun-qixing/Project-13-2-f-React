import type { FastifyInstance, FastifyReply } from 'fastify';
import { AppError } from '../errors/AppError.js';
import type { AppConfig } from '../config/env.js';
import type { AuthSchemas } from '../schemas/auth.schemas.js';
import type { AuthService } from '../services/auth.service.js';
import type { UserService } from '../services/user.service.js';

/**
 * 认证与令牌路由（契约 §三）：注册、登录、刷新、登出。
 * - 注册/登录成功 201/200，响应体含 user（公开资料 + role）与两个令牌，浏览器同时写
 *   `chips_refresh_token` Cookie（HttpOnly、Path=/api/v1/auth、HTTPS 下 Secure、SameSite=Strict）；
 * - 刷新不区分「令牌不存在/失效/用户不可用」，一律 204（§3.3），仅请求体格式错误返回 400；
 * - 登出幂等，一律 204（§3.4）。
 */

const REFRESH_TOKEN_COOKIE = 'chips_refresh_token';

export interface AuthRouteDeps {
  config: AppConfig;
  schemas: AuthSchemas;
  authService: AuthService;
  userService: UserService;
}

export function authRoutes(fastify: FastifyInstance, deps: AuthRouteDeps): void {
  const { config, schemas, authService, userService } = deps;
  const cookieBasePath = '/api/v1/auth';

  const setRefreshCookie = (reply: FastifyReply, token: string): void => {
    const ttlSeconds = parseRefreshTtl(config.refreshExpiresIn);
    reply.setCookie(REFRESH_TOKEN_COOKIE, token, {
      path: cookieBasePath,
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: ttlSeconds,
    });
  };

  const clearRefreshCookie = (reply: FastifyReply): void => {
    reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: cookieBasePath });
  };

  fastify.post(
    '/api/v1/auth/register',
    { config: { rateLimitTier: 'auth' } },
    async (request, reply) => {
      const body = schemas.register.parse(request.body);
      const user = await userService.register(
        body.displayName === undefined
          ? { username: body.username, email: body.email, password: body.password }
          : {
              username: body.username,
              email: body.email,
              password: body.password,
              displayName: body.displayName,
            }
      );
      const tokens = await authService.issueSession(user);
      setRefreshCookie(reply, tokens.refreshToken);
      return reply.status(201).send({
        data: {
          user: userService.toSessionProfile(user),
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    }
  );

  fastify.post(
    '/api/v1/auth/login',
    { config: { rateLimitTier: 'auth' } },
    async (request, reply) => {
      const body = schemas.login.parse(request.body);
      const user = await userService.findByLoginIdentifier(body.identifier);
      if (user === null) {
        throw AppError.unauthorized('COMMUNITY_AUTH_INVALID_CREDENTIALS', '账号或口令错误');
      }
      if (authService.isLocked(user)) {
        throw AppError.forbidden('COMMUNITY_AUTH_ACCOUNT_LOCKED', '账号已锁定，请稍后重试');
      }
      const valid = await userService.validatePassword(user, body.password);
      if (!valid) {
        await authService.recordLoginFailure(user);
        throw AppError.unauthorized('COMMUNITY_AUTH_INVALID_CREDENTIALS', '账号或口令错误');
      }
      if (!user.isActive) {
        throw AppError.forbidden('COMMUNITY_USER_ACCOUNT_DISABLED', '账号已被停用');
      }
      await authService.clearLoginFailures(user.id);
      const tokens = await authService.issueSession(user);
      setRefreshCookie(reply, tokens.refreshToken);
      return reply.status(200).send({
        data: {
          user: userService.toSessionProfile(user),
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    }
  );

  fastify.post(
    '/api/v1/auth/refresh',
    { config: { rateLimitTier: 'auth', noStore: true } },
    async (request, reply) => {
      // 请求体格式错误（字段类型错误）返回 400（契约 §3.3）；缺省体走 Cookie 路径。
      if (request.body !== undefined) {
        const parsed = schemas.refresh.safeParse(request.body);
        if (!parsed.success) {
          throw AppError.badRequest('COMMUNITY_VALIDATION_ERROR', '请求体字段类型错误', {
            field: 'refreshToken',
          });
        }
      }
      const bodyRefreshToken = (request.body as { refreshToken?: unknown } | null | undefined)
        ?.refreshToken;
      const cookieToken = request.cookies?.[REFRESH_TOKEN_COOKIE];
      const refreshToken =
        typeof bodyRefreshToken === 'string' && bodyRefreshToken.length > 0
          ? bodyRefreshToken
          : (cookieToken ?? null);
      const tokens = await authService.rotateSession(refreshToken);
      if (tokens === null) {
        clearRefreshCookie(reply);
        return reply.status(204).send();
      }
      setRefreshCookie(reply, tokens.refreshToken);
      return reply.status(200).send({
        data: {
          accessToken: tokens.accessToken,
          // 轮换时返回新 refreshToken，客户端必须原子替换（契约 §3.3）。
          refreshToken: tokens.refreshToken,
        },
      });
    }
  );

  fastify.post(
    '/api/v1/auth/logout',
    { config: { rateLimitTier: 'auth', noStore: true } },
    async (request, reply) => {
      const cookieToken = request.cookies?.[REFRESH_TOKEN_COOKIE] ?? null;
      const bodyRefreshToken = (request.body as { refreshToken?: unknown } | null | undefined)
        ?.refreshToken;
      const refreshToken =
        typeof bodyRefreshToken === 'string' && bodyRefreshToken.length > 0
          ? bodyRefreshToken
          : cookieToken;
      await authService.revokeByToken(refreshToken);
      clearRefreshCookie(reply);
      return reply.status(204).send();
    }
  );
}

function parseRefreshTtl(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  if (match === null) {
    return 30 * 24 * 3600;
  }
  const amount = Number.parseInt(match[1] ?? '', 10);
  const unit = units[match[2] ?? ''];
  if (!Number.isFinite(amount) || unit === undefined) {
    return 30 * 24 * 3600;
  }
  return amount * unit;
}
