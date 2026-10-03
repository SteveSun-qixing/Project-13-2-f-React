import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/AppError.js';
import { isValidIdempotencyKey } from '../lib/http-tokens.js';
import { hashPayload } from '../lib/pagination.js';
import type { AppConfig } from '../config/env.js';
import type { IdempotencyClaim } from '../types/fastify.js';

/**
 * 幂等（契约 §6.2）：幂等键取请求头 `Idempotency-Key`（8–128 个可见 ASCII 字符）。
 * 同一账号在同一端点上相同键重复请求：请求体一致 → 重放首次结果（状态码与响应体，
 * 会话 ID 相同）；请求体不一致 → 409 COMMUNITY_IDEMPOTENCY_CONFLICT。
 * 5xx 不缓存为重放结果并释放占用（重试按新请求处理）。
 *
 * 裁定：并发同键请求（首响应未落）返回 409 COMMUNITY_IDEMPOTENCY_CONFLICT——契约未
 * 登记「处理中」业务码，重试将在首响应落库后获得重放（裁定记录见开发日志）。
 */

export interface IdempotencyPluginDeps {
  config: Pick<AppConfig, 'idempotencyRecordTtlMinutes'>;
}

export function idempotencyPlugin(fastify: FastifyInstance, deps: IdempotencyPluginDeps): void {
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
    const claim: IdempotencyClaim | undefined = request.idempotencyClaim;
    if (claim === undefined) {
      return payload;
    }
    const repositories = fastify.repositories;
    if (reply.statusCode >= 500) {
      await repositories.idempotency.release(claim.accountId, claim.endpoint, claim.key);
      return payload;
    }
    let body: unknown = payload;
    if (typeof payload === 'string' && payload.length > 0) {
      try {
        body = JSON.parse(payload) as unknown;
      } catch {
        body = payload;
      }
    }
    await repositories.idempotency.fulfill(claim.accountId, claim.endpoint, claim.key, {
      statusCode: reply.statusCode,
      responseBody: body,
    });
    return payload;
  });

  fastify.decorate(
    'idempotencyGuard',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const endpoint =
        request.routeOptions.config?.idempotency ?? request.routeOptions.url ?? request.method;
      const raw = request.headers['idempotency-key'];
      // 未携带幂等键：契约标注「可选」的端点直接按普通请求处理（必须端点由路由层拒绝）。
      if (raw === undefined) {
        return;
      }
      if (typeof raw !== 'string' || !isValidIdempotencyKey(raw)) {
        throw AppError.badRequest(
          'COMMUNITY_VALIDATION_ERROR',
          '幂等键必须为 8 到 128 个可见 ASCII 字符',
          {
            field: 'Idempotency-Key',
          }
        );
      }
      const accountId = request.user?.userId;
      if (accountId === undefined) {
        // 幂等以账号维度生效（契约 §6.2）；要求幂等的端点均为认证端点。
        throw AppError.badRequest('COMMUNITY_VALIDATION_ERROR', '幂等端点必须先完成认证');
      }
      const requestHash = hashPayload(request.body ?? null);
      const now = new Date();
      const repositories = fastify.repositories;
      const existing = await repositories.idempotency.find(accountId, endpoint, raw, now);
      if (existing !== null) {
        if (existing.requestHash !== requestHash) {
          throw AppError.conflict('COMMUNITY_IDEMPOTENCY_CONFLICT', '幂等键已用于不同请求体');
        }
        if (existing.statusCode !== null) {
          const replayBody = existing.responseBody ?? null;
          await reply.code(existing.statusCode).send(replayBody);
          return;
        }
        throw AppError.conflict('COMMUNITY_IDEMPOTENCY_CONFLICT', '相同幂等键的请求正在处理中');
      }
      const expiresAt = new Date(now.getTime() + deps.config.idempotencyRecordTtlMinutes * 60_000);
      const claimed = await repositories.idempotency.claim({
        accountId,
        endpoint,
        idempotencyKey: raw,
        requestHash,
        statusCode: null,
        responseBody: null,
        expiresAt,
      });
      if (!claimed) {
        // 并发竞态：占用失败后按既有记录重放或判冲突。
        const raced = await repositories.idempotency.find(accountId, endpoint, raw, now);
        if (raced !== null && raced.requestHash === requestHash && raced.statusCode !== null) {
          await reply.code(raced.statusCode).send(raced.responseBody ?? null);
          return;
        }
        throw AppError.conflict('COMMUNITY_IDEMPOTENCY_CONFLICT', '幂等键冲突');
      }
      request.idempotencyClaim = { accountId, endpoint, key: raw, requestHash };
    }
  );
}

declare module 'fastify' {
  interface FastifyInstance {
    repositories: import('../repositories/types.js').Repositories;
    idempotencyGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
