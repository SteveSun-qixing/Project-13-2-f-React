import type { User } from '../db/schema/users';

export interface AuthTokenPayload {
  userId: string;
  role: string;
  jti: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}

// 扩展 FastifyRequest，注入已认证用户信息
declare module 'fastify' {
  interface FastifyRequest {
    /**
     * 当前认证用户的 JWT payload。
     * - 使用 authenticate preHandler 时，此字段保证非 null
     * - 使用 optionalAuthenticate 时，未登录则为 null
     */
    user: {
      userId: string;
      role: string;
      jti: string;
    } | null;
  }
}

// 导出用于路由中的类型辅助
export type AuthenticatedUser = NonNullable<import('fastify').FastifyRequest['user']>;

// 为了让 User 类型可以在需要时导入
export type { User };
