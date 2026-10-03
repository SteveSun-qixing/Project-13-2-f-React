import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { strongETag } from '../lib/http-tokens.js';

/**
 * 条件请求与缓存（契约 §6.4）：
 * - 公开浏览类 GET（路由 config `etag: true`）返回 ETag；携带 If-None-Match 命中返回 304 无正文；
 * - 认证、传输控制面、查看/封面入口与渲染状态接口（路由 config `noStore: true`）返回
 *   `Cache-Control: no-store`。
 */
export function conditionalGetPlugin(fastify: FastifyInstance): void {
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
    const config = request.routeOptions.config ?? {};
    if (config.noStore === true) {
      reply.header('Cache-Control', 'no-store');
      return payload;
    }
    if (config.etag !== true || request.method !== 'GET' || reply.statusCode !== 200) {
      return payload;
    }
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload ?? null);
    const etag = strongETag(body);
    reply.header('ETag', etag);
    const ifNoneMatch = request.headers['if-none-match'];
    if (typeof ifNoneMatch === 'string') {
      const candidates = ifNoneMatch.split(',').map((value) => value.trim().replace(/^W\//, ''));
      if (candidates.includes(etag) || candidates.includes('*')) {
        // 304 无正文：onSend 中返回空串覆盖已序列化载荷（返回 undefined 不改动载荷）。
        reply.code(304);
        return '';
      }
    }
    return payload;
  });
}
