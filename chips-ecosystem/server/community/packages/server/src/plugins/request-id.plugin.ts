import type { FastifyInstance } from 'fastify';
import { generateRequestId, isValidRequestId } from '../lib/http-tokens.js';

/**
 * 请求追踪（契约 §2.4）：请求可携带 `X-Request-Id`（32–128 个可见 ASCII 字符），
 * 服务端原样回显，未携带时生成并回显；错误响应 `error.details.traceId` 取同一标识。
 */
export function requestIdPlugin(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async (request, reply) => {
    const raw = request.headers['x-request-id'];
    const value = typeof raw === 'string' && isValidRequestId(raw) ? raw : generateRequestId();
    request.id = value;
    reply.header('X-Request-Id', value);
  });
}
