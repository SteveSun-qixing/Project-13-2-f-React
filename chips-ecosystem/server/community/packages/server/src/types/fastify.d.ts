import type { FastifyRequest } from 'fastify';

/**
 * Fastify 类型扩展：认证身份与路由配置标记。
 * - `request.user`：authenticate 装配的当前认证身份（optionalAuthenticate 时可为 null）；
 * - 路由 config：`rateLimitTier`（限流档位）、`noStore`（Cache-Control: no-store）、
 *   `etag`（公开浏览类 GET 条件请求）、`idempotency`（幂等端点登记名）。
 */

export interface AuthTokenPayload {
  userId: string;
  role: 'user' | 'admin';
  jti: string;
  /** 令牌用途：access 用于 API 鉴权，refresh 仅用于刷新端点。 */
  typ: 'access' | 'refresh';
}

declare module 'fastify' {
  interface FastifyContextConfig {
    rateLimitTier?: 'browse' | 'auth' | 'transfer';
    noStore?: boolean;
    etag?: boolean;
    idempotency?: string;
  }
}

declare module '@fastify/jwt' {
  // user 允许为 null：optionalAuthenticate（契约 §4.2「认证：可选」）的匿名语义。
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload | null;
  }
}

/** 请求内幂等 claim（插件间传递用，不对外）。 */
export interface IdempotencyClaim {
  accountId: string;
  endpoint: string;
  key: string;
  requestHash: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** 仅幂等 preHandler 占用成功后写入；onSend 阶段回填首响。 */
    idempotencyClaim?: IdempotencyClaim;
  }
}

export type RequestUser = NonNullable<FastifyRequest['user']>;
