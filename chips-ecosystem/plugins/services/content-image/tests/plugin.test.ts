/**
 * 服务插件入口断言：start 提供 Cordis 服务、effect 登记缓存清理、health 只读、stop 幂等。
 */

import type { IServiceContext } from '@chips/sdk';
import { ChipsError } from '@chips/sdk';
import { describe, expect, it, vi } from 'vitest';

import { CONTENT_CAPABILITY_ID, CORDIS_SERVICE_NAME } from '../src/descriptor.js';
import { IMAGE_DECODE_FAILED, PIXEL_SOURCE_UNBOUND } from '../src/errors.js';
import { errorDetails } from './support/error-shape.js';
import contentImagePlugin from '../src/index.js';
import { createContentImagePlugin } from '../src/plugin.js';
import type { IPickColorsService } from '../src/types.js';

interface ContextProbe {
  ctx: IServiceContext;
  provided: Map<string, object>;
  cleanups: Array<() => void>;
  info: ReturnType<typeof vi.fn>;
  registerCapability: ReturnType<typeof vi.fn>;
  inject: ReturnType<typeof vi.fn>;
}

const createContext = (): ContextProbe => {
  const provided = new Map<string, object>();
  const cleanups: Array<() => void> = [];
  const info = vi.fn();
  const registerCapability = vi.fn();
  const inject = vi.fn();

  const ctx = {
    pluginId: 'chips.service.content-image',
    bridge: { request: vi.fn(), resource: vi.fn() },
    config: {
      get: vi.fn(),
      snapshot: vi.fn(),
      set: vi.fn(),
      reset: vi.fn(),
      watch: vi.fn(),
    },
    logger: { debug: vi.fn(), info, warn: vi.fn(), error: vi.fn() },
    provide: (name: string, service: object) => {
      provided.set(name, service);
    },
    inject,
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    registerCapability,
    effect: (cleanup: () => void) => {
      cleanups.push(cleanup);
    },
  };

  return { ctx, provided, cleanups, info, registerCapability, inject };
};

const providedService = (probe: ContextProbe): IPickColorsService => {
  const service = probe.provided.get(CORDIS_SERVICE_NAME);
  expect(service).toBeDefined();
  return service as IPickColorsService;
};

describe('chips.service.content-image 入口', () => {
  it('默认导出可完成 start / health / stop 三面生命周期', async () => {
    const probe = createContext();
    await contentImagePlugin.start(probe.ctx);

    expect(probe.provided.has(CORDIS_SERVICE_NAME)).toBe(true);
    await expect(contentImagePlugin.health?.()).resolves.toBe(true);
    await expect(contentImagePlugin.stop()).resolves.toBeUndefined();
  });

  it('start 只注册 content-image Cordis 服务，不注册 Bridge 能力', async () => {
    const probe = createContext();
    const plugin = createContentImagePlugin();
    await plugin.start(probe.ctx);

    expect(probe.provided.size).toBe(1);
    expect(Array.from(probe.provided.keys())).toEqual([CORDIS_SERVICE_NAME]);
    expect(probe.registerCapability).not.toHaveBeenCalled();
    expect(probe.inject).not.toHaveBeenCalled();
    expect(probe.info).toHaveBeenCalledWith(
      '图像内容处理服务已注册',
      expect.objectContaining({ provider: 'chips.service.content-image' })
    );
  });

  it('提供的服务承载登记的能力 ID 与唯一原子操作', async () => {
    const probe = createContext();
    await createContentImagePlugin().start(probe.ctx);
    const service = providedService(probe);

    expect(service.capabilityId).toBe(CONTENT_CAPABILITY_ID);
    expect('pickColors' in service).toBe(true);
  });

  it('生产装配面 fail-closed：未绑定解码供给下调用按已登记码收口', async () => {
    const probe = createContext();
    await createContentImagePlugin().start(probe.ctx);

    const error = await providedService(probe)
      .pickColors({ image: new Uint8Array([1, 2, 3]), sourceKey: 'test://plugin/probe' })
      .then(
        () => undefined,
        (reason: unknown) => reason
      );

    expect(error).toBeInstanceOf(ChipsError);
    expect((error as ChipsError).code).toBe(IMAGE_DECODE_FAILED);
    expect(errorDetails(error as ChipsError).reason).toBe(PIXEL_SOURCE_UNBOUND);
  });

  it('缓存清理登记为 Fork 副作用且幂等', async () => {
    const probe = createContext();
    await createContentImagePlugin().start(probe.ctx);

    expect(probe.cleanups).toHaveLength(1);
    expect(() => {
      probe.cleanups[0]?.();
      probe.cleanups[0]?.();
    }).not.toThrow();
  });

  it('health 只读可用，stop 幂等无副作用', async () => {
    const plugin = createContentImagePlugin();
    await expect(plugin.health?.()).resolves.toBe(true);
    await expect(plugin.stop?.()).resolves.toBeUndefined();
    await expect(plugin.stop?.()).resolves.toBeUndefined();
  });
});
