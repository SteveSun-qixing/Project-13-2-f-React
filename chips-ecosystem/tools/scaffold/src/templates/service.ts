import type { IScaffoldContext, IScaffoldFile } from '../types.js';

/** `service` 角色模板：一个带配置、心跳、健康检查与可逆清理的服务插件。 */

function indexTs(): string {
  return `import type { IServiceContext, IServicePlugin } from '@chips/sdk';

const CONFIG_KEY = 'interval-seconds';
const DEFAULT_INTERVAL_SECONDS = 30;
const MIN_INTERVAL_SECONDS = 1;
const MAX_INTERVAL_SECONDS = 3600;

/**
 * 服务插件实现。
 *
 * start 中登记的定时器与清理全部归属插件 Fork；stop 与 effect 清理幂等。
 */
class ServicePlugin implements IServicePlugin {
  private context: IServiceContext | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  public async start(ctx: IServiceContext): Promise<void> {
    this.context = ctx;
    const intervalSeconds = await this.readIntervalSeconds(ctx);
    const timer = setInterval(() => {
      ctx.logger.debug('服务心跳', { pluginId: ctx.pluginId });
    }, intervalSeconds * 1000);
    this.heartbeatTimer = timer;
    ctx.effect(() => {
      clearInterval(timer);
    });
    ctx.logger.info('服务已启动', { pluginId: ctx.pluginId, intervalSeconds });
  }

  public async stop(): Promise<void> {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.context = null;
  }

  public async health(): Promise<boolean> {
    return this.context !== null;
  }

  /**
   * 读取心跳周期配置；缺失或非法时回退默认值。
   *
   * @param ctx - 服务上下文
   * @returns 归一后的周期秒数
   */
  private async readIntervalSeconds(ctx: IServiceContext): Promise<number> {
    try {
      const view = await ctx.config.get(CONFIG_KEY);
      const value = view.value;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.min(Math.max(Math.round(value), MIN_INTERVAL_SECONDS), MAX_INTERVAL_SECONDS);
      }
    } catch {
      // 配置缺失或读取失败时回退默认值，不阻断服务启动
    }
    return DEFAULT_INTERVAL_SECONDS;
  }
}

export default new ServicePlugin();
`;
}

function configSchema(context: IScaffoldContext): string {
  return `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: `${context.options.name}配置`,
      'x-chips-schema-version': 1,
      type: 'object',
      additionalProperties: false,
      properties: {
        'interval-seconds': {
          type: 'integer',
          minimum: 1,
          maximum: 3600,
          default: 30,
          title: '心跳周期（秒）',
        },
      },
    },
    null,
    2
  )}\n`;
}

function testsTs(context: IScaffoldContext): string {
  return `import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IServiceContext } from '@chips/sdk';
import plugin from '../src/index';

interface IContextStub {
  readonly ctx: IServiceContext;
  readonly info: ReturnType<typeof vi.fn>;
  readonly debug: ReturnType<typeof vi.fn>;
}

function createContext(intervalSeconds: number): IContextStub {
  const info = vi.fn();
  const debug = vi.fn();
  const ctx = {
    pluginId: '${context.options.pluginId}',
    config: {
      get: async (): Promise<Record<string, unknown>> => ({
        key: 'plugins.${context.options.pluginId}.interval-seconds',
        value: intervalSeconds,
        layer: 'plugin',
        isDefault: true,
      }),
    },
    logger: { debug, info, warn: vi.fn(), error: vi.fn() },
    effect: vi.fn(),
  } as unknown as IServiceContext;
  return { ctx, info, debug };
}

describe('服务插件生命周期', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await plugin.stop();
    vi.useRealTimers();
  });

  it('start 后健康，心跳按配置周期输出日志', async () => {
    const { ctx, info, debug } = createContext(2);
    await plugin.start(ctx);
    expect(await plugin.health()).toBe(true);
    expect(info).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it('stop 后不健康且心跳停止', async () => {
    const { ctx, debug } = createContext(5);
    await plugin.start(ctx);
    await plugin.stop();
    expect(await plugin.health()).toBe(false);

    vi.advanceTimersByTime(10000);
    expect(debug).not.toHaveBeenCalled();
  });
});
`;
}

/** 构建 `service` 角色的全部角色文件（公共文件由模板装配器补充）。 */
export function buildServiceFiles(context: IScaffoldContext): IScaffoldFile[] {
  return [
    { path: 'src/index.ts', content: indexTs() },
    { path: 'assets/schemas/config.schema.json', content: configSchema(context) },
    { path: 'tests/service.test.ts', content: testsTs(context) },
  ];
}
