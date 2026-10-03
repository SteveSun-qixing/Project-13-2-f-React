import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/AppError.js';
import type { AppConfig } from '../config/env.js';

/**
 * 限流（契约 §6.3）：按账号与来源 IP 两个维度分别计数，任一维度触发即 429；
 * 响应携带 `Retry-After`（秒）与 `X-RateLimit-Limit/Remaining/Reset`；
 * 认证类接口与传输控制面使用比浏览接口更严格的档位（阈值由服务端配置）。
 *
 * 计数存储为进程内固定窗口（部署拓扑为单 API 容器；《14》§2.1）。
 * 存储经 RateLimitStore 端口抽象：行 6 接入 Redis 时替换实现，不留兼容层。
 */

export type RateLimitTier = 'browse' | 'auth' | 'transfer';

export interface RateLimitStore {
  /** 命中计数并返回窗口状态；key 由调用方按维度构造。 */
  hit(key: string, windowSeconds: number, now: number): WindowState;
}

export interface WindowState {
  count: number;
  limit: number;
  /** 窗口结束时刻（Unix 毫秒）。 */
  windowEndsAt: number;
}

interface Counter {
  count: number;
  windowEndsAt: number;
}

/** 进程内固定窗口计数器：超量自动清扫过期键，避免长期驻留泄漏。 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly counters = new Map<string, Counter>();
  private sweeps = 0;

  hit(key: string, windowSeconds: number, now: number): WindowState {
    if (this.counters.size > 10_000 || this.sweeps >= 10_000) {
      this.sweep(now);
    }
    const existing = this.counters.get(key);
    if (existing === undefined || existing.windowEndsAt <= now) {
      const fresh: Counter = { count: 1, windowEndsAt: now + windowSeconds * 1000 };
      this.counters.set(key, fresh);
      this.sweeps += 1;
      return {
        count: fresh.count,
        limit: Number.POSITIVE_INFINITY,
        windowEndsAt: fresh.windowEndsAt,
      };
    }
    existing.count += 1;
    return {
      count: existing.count,
      limit: Number.POSITIVE_INFINITY,
      windowEndsAt: existing.windowEndsAt,
    };
  }

  private sweep(now: number): void {
    for (const [key, counter] of this.counters) {
      if (counter.windowEndsAt <= now) {
        this.counters.delete(key);
      }
    }
    this.sweeps = 0;
  }
}

export interface RateLimitPluginDeps {
  config: Pick<
    AppConfig,
    'rateLimitWindowSeconds' | 'rateLimitBrowseMax' | 'rateLimitAuthMax' | 'rateLimitTransferMax'
  >;
  store: RateLimitStore;
}

function tierLimit(config: RateLimitPluginDeps['config'], tier: RateLimitTier | undefined): number {
  switch (tier) {
    case 'auth':
      return config.rateLimitAuthMax;
    case 'transfer':
      return config.rateLimitTransferMax;
    default:
      return config.rateLimitBrowseMax;
  }
}

export async function rateLimitPlugin(
  fastify: FastifyInstance,
  deps: RateLimitPluginDeps
): Promise<void> {
  const { config, store } = deps;

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const tier = request.routeOptions.config?.rateLimitTier;
    const limit = tierLimit(config, tier);
    const now = Date.now();
    const windowSeconds = config.rateLimitWindowSeconds;

    // 未认证请求按来源 IP 计数；已认证请求账号与 IP 两维度分别计数（契约 §6.3）。
    const dimensions: Array<{ key: string }> = [{ key: `ip:${request.ip}` }];
    if (request.user !== null) {
      dimensions.unshift({ key: `account:${request.user.userId}` });
    }

    let constrained: (WindowState & { limit: number }) | null = null;
    for (const dimension of dimensions) {
      const state = store.hit(`${tier ?? 'browse'}:${dimension.key}`, windowSeconds, now);
      const counted: WindowState & { limit: number } = { ...state, limit };
      if (state.count > limit) {
        constrained = counted;
        break;
      }
      if (constrained === null || state.count / limit > constrained.count / constrained.limit) {
        constrained = counted;
      }
    }

    const state = constrained;
    if (state !== null) {
      const resetSeconds = Math.max(1, Math.ceil((state.windowEndsAt - now) / 1000));
      reply.header('X-RateLimit-Limit', String(limit));
      reply.header('X-RateLimit-Remaining', String(Math.max(0, limit - state.count)));
      reply.header('X-RateLimit-Reset', String(Math.ceil(state.windowEndsAt / 1000)));
      if (state.count > limit) {
        reply.header('Retry-After', String(resetSeconds));
        throw AppError.tooManyRequests('COMMUNITY_RATE_LIMITED', '请求过于频繁，请稍后重试');
      }
    }
  });
}
