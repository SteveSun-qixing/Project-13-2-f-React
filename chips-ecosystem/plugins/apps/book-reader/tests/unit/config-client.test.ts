import { describe, expect, it, vi } from 'vitest';
import {
  createMemoryReadingConfigClient,
  createResilientReadingConfigClient,
  type ReadingConfigClient,
} from '../../src/reading/config-client';

describe('createMemoryReadingConfigClient', () => {
  it('在会话内存中完成读写与重置', async () => {
    const client = createMemoryReadingConfigClient();
    await client.set('preferences', { fontScale: 1.2 });
    await expect(client.get('preferences')).resolves.toEqual({ fontScale: 1.2 });
    await client.reset('preferences');
    await expect(client.get('preferences')).resolves.toBeUndefined();
  });
});

describe('createResilientReadingConfigClient', () => {
  it('正式面可用时直通 config 域且保持 config 形态', async () => {
    const primary = {
      get: vi.fn(() => Promise.resolve({ value: 42 })),
      set: vi.fn(() => Promise.resolve()),
      reset: vi.fn(() => Promise.resolve()),
    } as unknown as ReadingConfigClient;
    const client = createResilientReadingConfigClient(primary);
    await expect(client.get('preferences')).resolves.toEqual({ value: 42 });
    await client.set('preferences', { fontScale: 1 });
    await client.reset('preferences');
    expect(client.mode).toBe('config');
  });

  it('正式面首次失败即整体降级内存态并上报形态切换', async () => {
    const failing: ReadingConfigClient = {
      get: () => Promise.reject(new Error('BRIDGE_CAPABILITY_NOT_FOUND')),
      set: () => Promise.reject(new Error('BRIDGE_CAPABILITY_NOT_FOUND')),
      reset: () => Promise.reject(new Error('BRIDGE_CAPABILITY_NOT_FOUND')),
    };
    const client = createResilientReadingConfigClient(failing);
    const modeChanges: string[] = [];
    client.onModeChange((mode) => {
      modeChanges.push(mode);
    });

    await client.set('preferences', { fontScale: 1.3 });
    expect(client.mode).toBe('memory');
    expect(modeChanges).toEqual(['memory']);
    // 降级后读写都在内存态内闭环，不再触碰正式面
    await expect(client.get('preferences')).resolves.toEqual({ fontScale: 1.3 });
    await client.reset('preferences');
    await expect(client.get('preferences')).resolves.toBeUndefined();
  });

  it('get 失败同样触发降级且本次返回内存态缺省', async () => {
    const client = createResilientReadingConfigClient({
      get: () => Promise.reject(new Error('CONFIG_UNAVAILABLE')),
      set: () => Promise.resolve(),
      reset: () => Promise.resolve(),
    });
    await expect(client.get('preferences')).resolves.toBeUndefined();
    expect(client.mode).toBe('memory');
  });
});
