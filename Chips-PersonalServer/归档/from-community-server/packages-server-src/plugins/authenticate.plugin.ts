import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { getRedis } from '../cache/redis';
import type { AuthTokenPayload } from '../types/fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * JWT 认证插件
 * 提供三个 preHandler hook：
 *   - authenticate：必须认证，token 无效则 401
 *   - optionalAuthenticate：可选认证，token 无效时 request.user 为 null
 *   - requireAdmin：必须认证且 role === 'admin'
 */
const authenticatePlugin: FastifyPluginAsync = async (fastify) => {
  /**
   * 从 Authorization header 中解析并验证 token
   * @returns 解码后的 payload，或 null（token 缺失/无效时）
   */
  async function decodeToken(
    request: FastifyRequest,
  ): Promise<AuthTokenPayload | null> {
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);

    try {
      const payload = fastify.jwt.verify<AuthTokenPayload>(token);

      // 检查 Redis 黑名单（jti）
      const redis = getRedis();
      const isRevoked = await redis.exists(`token:blacklist:${payload.jti}`);
      if (isRevoked) return null;

      return payload;
    } catch {
      return null;
    }
  }

  fastify.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = await decodeToken(request);
    if (!payload) {
      throw AppError.unauthorized(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Authentication required',
      );
    }
    (request as unknown as { user: AuthTokenPayload }).user = payload;
  });

  fastify.decorate('optionalAuthenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = await decodeToken(request);
    (request as unknown as { user: AuthTokenPayload | null }).user = payload;
  });

  fastify.decorate('requireAdmin', async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = await decodeToken(request);
    if (!payload) {
      throw AppError.unauthorized(ErrorCode.AUTH_TOKEN_INVALID, 'Authentication required');
    }
    if (payload.role !== 'admin') {
      throw AppError.forbidden(
        ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
        'Admin permission required',
      );
    }
    (request as unknown as { user: AuthTokenPayload }).user = payload;
  });
};

export default authenticatePlugin;
