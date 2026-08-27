import type { FastifyPluginAsync } from 'fastify';
import * as crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';

declare module 'fastify' {
  interface FastifyInstance {
    requireApiToken: () => (request: {
      headers: Record<string, string | string[] | undefined>;
    }) => Promise<void>;
  }
}

/**
 * 个人服务器写接口保护插件。
 *
 * 个人服务器没有多用户与账号体系，写操作（上传、删除、更新）通过
 * `Authorization: Bearer <API_TOKEN>` 携带服务器管理令牌保护。
 * 令牌使用常量时间比较，避免时序侧信道。
 */
export function isApiTokenValid(token: string | undefined): boolean {
  if (!token || !token.startsWith('Bearer ')) {
    return false;
  }
  const provided = token.slice('Bearer '.length).trim();
  if (provided.length === 0) {
    return false;
  }
  const expected = Buffer.from(env.API_TOKEN);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export const apiTokenPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('requireApiToken', () => async (request) => {
    const authorization = request.headers.authorization;
    if (!isApiTokenValid(typeof authorization === 'string' ? authorization : undefined)) {
      throw AppError.unauthorized(ErrorCode.API_TOKEN_INVALID, 'Invalid or missing API token');
    }
  });
};
