/**
 * 服务插件入口契约断言：IServicePlugin 形状、Cordis 服务注册名与操作面、幂等停机与健康探针。
 */

import { describe, expect, it } from 'vitest';

import type { IServiceBridge, IServiceConfig, IServiceContext } from '@chips/sdk';

import entry, { CONTENT_CONVERTER_SERVICE_NAME } from '../src/plugin.js';
import type { IContentConverterService } from '../src/types.js';

interface IProvidedService {
  readonly name: string;
  readonly value: unknown;
}

/** 入口契约测试不触达能力调用，出站面以即时失败桩收口（防测试假绿）。 */
const stubBridge: IServiceBridge = {
  request: () => Promise.reject(new Error('入口契约测试不触达 Bridge 能力调用')),
  resource: () => {
    throw new Error('入口契约测试不触达资源句柄');
  },
};

/** 入口契约测试不触达配置访问，配置面以即时失败桩收口（防测试假绿）。 */
const stubConfig: IServiceConfig = {
  get: () => Promise.reject(new Error('入口契约测试不触达配置读取')),
  snapshot: () => Promise.reject(new Error('入口契约测试不触达配置快照')),
  set: () => Promise.reject(new Error('入口契约测试不触达配置写入')),
  reset: () => Promise.reject(new Error('入口契约测试不触达配置重置')),
  watch: () => {
    throw new Error('入口契约测试不触达配置订阅');
  },
};

function createContext(): {
  ctx: IServiceContext;
  provided: IProvidedService[];
  logs: string[];
} {
  const provided: IProvidedService[] = [];
  const logs: string[] = [];
  const ctx: IServiceContext = {
    pluginId: 'chips.service.cardtohtml',
    bridge: stubBridge,
    config: stubConfig,
    logger: {
      debug: () => undefined,
      info: (message: string) => {
        logs.push(message);
      },
      warn: () => undefined,
      error: () => undefined,
    },
    provide: (name: string, service: object) => {
      provided.push({ name, value: service });
    },
    inject: () => undefined,
    on: () => ({ dispose: () => undefined }),
    once: () => ({ dispose: () => undefined }),
    emit: () => undefined,
    registerCapability: () => undefined,
    effect: () => undefined,
  };
  return { ctx, provided, logs };
}

describe('入口模块形状', () => {
  it('默认导出实现 IServicePlugin 三方法，且以对象方法可直接调用', () => {
    expect(typeof entry.start).toBe('function');
    expect(typeof entry.stop).toBe('function');
    expect(typeof entry.health).toBe('function');
  });

  it('start 注册 Cordis 服务 content-converter，操作面为 cardToHtml', async () => {
    const { ctx, provided, logs } = createContext();
    await entry.start(ctx);
    expect(provided.length).toBe(1);
    expect(provided[0]?.name).toBe(CONTENT_CONVERTER_SERVICE_NAME);
    const service = provided[0]?.value as IContentConverterService;
    expect(typeof service.cardToHtml).toBe('function');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('stop 幂等（重复调用为 no-op），health 恒真', async () => {
    await expect(entry.stop()).resolves.toBeUndefined();
    await expect(entry.stop()).resolves.toBeUndefined();
    await expect(entry.health()).resolves.toBe(true);
  });

  it('服务名符合内核服务文法且带 content- 前缀（04-能力契约规范 §8.2）', () => {
    expect(CONTENT_CONVERTER_SERVICE_NAME).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    expect(CONTENT_CONVERTER_SERVICE_NAME.startsWith('content-')).toBe(true);
  });
});
