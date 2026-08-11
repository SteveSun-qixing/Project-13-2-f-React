import type { FastifyPluginAsync } from 'fastify';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import {
  RegisterSchema,
  LoginSchema,
} from '../schemas/auth.schemas';
import { env } from '../config/env';

/** Refresh token cookie 名称 */
const REFRESH_TOKEN_COOKIE = 'chips_refresh_token';

/** Refresh token 的 maxAge（秒 → 毫秒） */
const REFRESH_TOKEN_MAX_AGE_MS =
  AuthService.parseExpiresInToSeconds(env.JWT_REFRESH_EXPIRES_IN) * 1000;

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── POST /api/v1/auth/register ──────────────────────────────────

  fastify.post('/api/v1/auth/register', async (request, reply) => {
    const body = RegisterSchema.parse(request.body);

    const user = await UserService.create(body.username, body.password);
    const tokens = AuthService.generateTokenPair(fastify, user);

    reply.setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });

    return reply.status(201).send({
      data: {
        user: UserService.toPrivateProfile(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  });

  // ─── POST /api/v1/auth/login ─────────────────────────────────────

  fastify.post('/api/v1/auth/login', async (request, reply) => {
    const body = LoginSchema.parse(request.body);

    // 检查账号锁定
    const locked = await AuthService.isAccountLocked(body.username);
    if (locked) {
      throw AppError.tooManyRequests(
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        'Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.',
      );
    }

    const user = await UserService.findByUsername(body.username);
    if (!user) {
      await AuthService.recordLoginFailure(body.username);
      throw AppError.unauthorized(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid credentials');
    }

    if (!user.isActive) {
      throw AppError.unauthorized(ErrorCode.USER_ACCOUNT_DISABLED, 'Account is disabled');
    }

    const validPassword = await UserService.validatePassword(user, body.password);
    if (!validPassword) {
      await AuthService.recordLoginFailure(body.username);
      throw AppError.unauthorized(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid credentials');
    }

    // 登录成功：清除失败计数
    await AuthService.clearLoginFailure(body.username);

    const tokens = AuthService.generateTokenPair(fastify, user);

    reply.setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });

    return reply.status(200).send({
      data: {
        user: UserService.toPrivateProfile(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  });

  // ─── POST /api/v1/auth/refresh ───────────────────────────────────

  fastify.post('/api/v1/auth/refresh', async (request, reply) => {
    const body = (request.body as Record<string, string> | null | undefined) ?? {};
    const refreshToken =
      request.cookies?.[REFRESH_TOKEN_COOKIE] ??
      body['refreshToken'];

    if (!refreshToken) {
      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
      return reply.status(204).send();
    }

    let payload: import('../services/auth.service').JwtPayload;
    try {
      payload = AuthService.verifyRefreshToken(fastify, refreshToken);
    } catch {
      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
      return reply.status(204).send();
    }

    if (!payload.jti) {
      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
      return reply.status(204).send();
    }

    // 检查黑名单
    const revoked = await AuthService.isTokenRevoked(payload.jti);
    if (revoked) {
      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
      return reply.status(204).send();
    }

    // 吊销旧 refresh token（rotation）
    const refreshTtl = AuthService.parseExpiresInToSeconds(env.JWT_REFRESH_EXPIRES_IN);
    await AuthService.revokeToken(payload.jti, refreshTtl);

    const user = await UserService.findById(payload.userId);
    if (!user || !user.isActive) {
      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
      return reply.status(204).send();
    }

    const tokens = AuthService.generateTokenPair(fastify, user);

    reply.setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });

    return reply.status(200).send({
      data: { accessToken: tokens.accessToken },
    });
  });

  // ─── POST /api/v1/auth/logout ─────────────────────────────────────

  fastify.post('/api/v1/auth/logout', async (request, reply) => {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];

    if (refreshToken) {
      try {
        const payload = AuthService.verifyRefreshToken(fastify, refreshToken);
        const ttl = AuthService.parseExpiresInToSeconds(env.JWT_REFRESH_EXPIRES_IN);
        await AuthService.revokeToken(payload.jti, ttl);
      } catch {
        // token 已过期，忽略
      }
    }

    reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
    return reply.status(204).send();
  });
};

export default authRoutes;
