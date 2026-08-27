import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../cache/redis';
import { env } from '../config/env';
import type { User } from '../db/schema/users';

/**
 * JWT payload 结构
 */
export interface JwtPayload {
  userId: string;
  role: string;
  jti: string; // JWT ID，用于吊销
}

/**
 * Token 对
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** 登录失败计数 Redis key 格式 */
const loginFailKey = (username: string) => `login:fail:${username.toLowerCase()}`;

/** JWT 黑名单 Redis key 格式 */
const blacklistKey = (jti: string) => `token:blacklist:${jti}`;

/** 最大登录失败次数 */
const MAX_FAIL_COUNT = 5;

/** 账号锁定时长（秒） */
const LOCK_DURATION_SECONDS = 15 * 60; // 15 分钟

export const AuthService = {
  /**
   * 签发 access token + refresh token
   */
  generateTokenPair(
    fastify: import('fastify').FastifyInstance,
    user: Pick<User, 'id' | 'role'>,
  ): TokenPair {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const accessToken = fastify.jwt.sign(
      { userId: user.id, role: user.role, jti: accessJti } satisfies JwtPayload,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
    );

    const refreshToken = fastify.jwt.sign(
      { userId: user.id, role: user.role, jti: refreshJti } satisfies JwtPayload,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN },
    );

    return { accessToken, refreshToken };
  },

  /**
   * 验证 refresh token，返回其 payload（不检查黑名单，由调用方检查）
   */
  verifyRefreshToken(
    fastify: import('fastify').FastifyInstance,
    token: string,
  ): JwtPayload {
    return fastify.jwt.verify<JwtPayload>(token);
  },

  /**
   * 将 jti 加入 Redis 黑名单，TTL 与 token 剩余有效期对齐
   */
  async revokeToken(jti: string, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    await redis.set(blacklistKey(jti), '1', 'EX', ttlSeconds);
  },

  /**
   * 检查 jti 是否在黑名单中
   */
  async isTokenRevoked(jti: string): Promise<boolean> {
    const redis = getRedis();
    const val = await redis.exists(blacklistKey(jti));
    return val === 1;
  },

  /**
   * 登录失败：计数 +1。超过上限时返回 true（账号应被锁定）
   */
  async recordLoginFailure(username: string): Promise<{ locked: boolean; count: number }> {
    const redis = getRedis();
    const key = loginFailKey(username);
    const count = await redis.incr(key);
    if (count === 1) {
      // 首次失败，设置 TTL
      await redis.expire(key, LOCK_DURATION_SECONDS);
    }
    return { locked: count >= MAX_FAIL_COUNT, count };
  },

  /**
   * 登录成功：清除失败计数
   */
  async clearLoginFailure(username: string): Promise<void> {
    const redis = getRedis();
    await redis.del(loginFailKey(username));
  },

  /**
   * 检查账号是否被锁定
   */
  async isAccountLocked(username: string): Promise<boolean> {
    const redis = getRedis();
    const key = loginFailKey(username);
    const count = await redis.get(key);
    return count !== null && parseInt(count, 10) >= MAX_FAIL_COUNT;
  },

  /**
   * 从 JWT_REFRESH_EXPIRES_IN 字符串解析 TTL 秒数（用于黑名单 TTL 计算）
   */
  parseExpiresInToSeconds(expiresIn: string): number {
    const map: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 86400 * 30; // 默认 30 天
    return parseInt(match[1]!, 10) * (map[match[2]!] ?? 1);
  },
};
