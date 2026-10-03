import type { FastifyInstance } from 'fastify';

/**
 * 健康检查（契约 §2.3）：不套用统一信封、无需认证，直接返回 status/timestamp/version。
 */

export interface HealthRouteDeps {
  version: string;
}

export function healthRoute(fastify: FastifyInstance, deps: HealthRouteDeps): void {
  fastify.get('/api/v1/health', () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: deps.version,
    };
  });
}
