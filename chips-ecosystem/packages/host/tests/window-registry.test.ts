import { describe, expect, it } from 'vitest';

import { WindowRegistry } from '../src/main/window-registry.js';
import { FakeSession, FakeWebContents } from './helpers/shell-electron.js';

function createWebContents(id: number, key = `s-${id}`): FakeWebContents {
  return new FakeWebContents(id, new FakeSession(key));
}

describe('WindowRegistry', () => {
  it('注册窗口并支持覆盖注册（补全窗口句柄）', () => {
    const registry = new WindowRegistry({ now: () => 1000 });
    const webContents = createWebContents(1);
    const record = registry.register(webContents);
    expect(record.window).toBeNull();
    expect(record.createdAt).toBe(1000);
    expect(registry.isAlive(1)).toBe(true);

    const window = {
      windowId: 1,
      webContents,
      loadURL: async (): Promise<void> => undefined,
      close: (): void => undefined,
      destroy: (): void => undefined,
      isDestroyed: (): boolean => false,
      show: (): void => undefined,
      setTitle: (): void => undefined,
    };
    const updated = registry.register(webContents, window);
    expect(updated.window).toBe(window);
    expect(updated.createdAt).toBe(1000);
    expect(registry.size).toBe(1);
  });

  it('已销毁内容不计为存活', () => {
    const registry = new WindowRegistry();
    const webContents = createWebContents(2);
    registry.register(webContents);
    webContents.destroy();
    expect(registry.isAlive(2)).toBe(false);
    expect(registry.get(2)?.webContents).toBe(webContents);
  });

  it('解注册后不可查询', () => {
    const registry = new WindowRegistry();
    registry.register(createWebContents(3));
    registry.unregister(3);
    expect(registry.get(3)).toBeUndefined();
    expect(registry.isAlive(3)).toBe(false);
    expect(registry.list()).toEqual([]);
  });

  it('closeAll 对已销毁与未销毁窗口区分处理', () => {
    const registry = new WindowRegistry();
    const alive = createWebContents(4);
    const dead = createWebContents(5);
    registry.register(alive);
    registry.register(dead);
    dead.destroy();
    registry.closeAll();
    expect(alive.closeCalls).toBe(1);
    expect(dead.closeCalls).toBe(0);
  });

  it('destroyAll 与 clear', () => {
    const registry = new WindowRegistry();
    const webContents = createWebContents(6);
    registry.register(webContents);
    registry.destroyAll();
    expect(webContents.destroyed).toBe(true);
    registry.clear();
    expect(registry.size).toBe(0);
  });
});
