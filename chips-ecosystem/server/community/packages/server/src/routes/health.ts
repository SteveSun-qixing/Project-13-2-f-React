import type { FastifyInstance } from 'fastify';

/**
 * 健康检查（契约 §2.5）：不使用统一信封、无需认证。
 * 失败返回 503 与 status: "degraded"，details 列出不可用组件。
 * 组件检查器按已接入依赖登记：本臂登记 database；redis / storage 由对象存储臂、
 * 渲染 Worker 臂接入对应客户端后注册检查器（组件集合见契约 §2.5）。
 */

export type HealthComponent = 'database' | 'redis' | 'storage';

export type ComponentChecker = () => Promise<void>;

export class HealthRegistry {
  private readonly checkers = new Map<HealthComponent, ComponentChecker>();

  register(component: HealthComponent, checker: ComponentChecker): void {
    this.checkers.set(component, checker);
  }

  async check(): Promise<{ healthy: boolean; unavailable: HealthComponent[] }> {
    const unavailable: HealthComponent[] = [];
    await Promise.all(
      [...this.checkers.entries()].map(async ([component, checker]) => {
        try {
          await checker();
        } catch {
          unavailable.push(component);
        }
      })
    );
    return { healthy: unavailable.length === 0, unavailable };
  }
}

export interface HealthRouteDeps {
  registry: HealthRegistry;
  version: string;
  apiVersion: 'v1';
}

export async function healthRoute(fastify: FastifyInstance, deps: HealthRouteDeps): Promise<void> {
  fastify.get('/api/v1/health', async (_request, reply) => {
    const { healthy, unavailable } = await deps.registry.check();
    const body = {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: deps.version,
      apiVersion: deps.apiVersion,
      ...(healthy ? {} : { details: { unavailableComponents: unavailable } }),
    };
    return reply.status(healthy ? 200 : 503).send(body);
  });
}
