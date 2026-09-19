import { afterEach, describe, expect, it } from 'vitest';
import { ChipsError, SDK_BRIDGE_UNAVAILABLE } from '../errors.js';
import { chips } from '../client/chips-bridge.js';
import type { IChipsBridge } from '../types/bridge.js';
import { createMockBridge } from './mock-bridge.js';
import type { IMockBridge } from './mock-bridge.js';
import { installMockBridge, uninstallMockBridge } from './install-mock-bridge.js';
import { mountWindow, windowHost } from '../../tests/helpers/window.js';
import type { WindowHost } from '../../tests/helpers/window.js';

/** 本文件的安装层级计数：`afterEach` 依据它把安装栈排空，避免用例间相互污染。 */
let depth = 0;

/** 最近一次挂载的 `window` 恢复函数。 */
let restoreWindow: (() => void) | undefined;

/** 挂载 `window` 夹具并返回其可写宿主。 */
function useWindow(): WindowHost {
  restoreWindow = mountWindow();
  const host = windowHost();
  if (host === undefined) {
    throw new Error('window 夹具挂载失败');
  }
  return host;
}

/** 安装 Mock 并登记层级。 */
function install(bridge?: IMockBridge): IMockBridge {
  const installed = installMockBridge(bridge);
  depth += 1;
  return installed;
}

/** 卸载一层并回退层级计数。 */
function uninstall(): void {
  uninstallMockBridge();
  depth -= 1;
}

/** 取当前 `window.chips`；未注入时为 `undefined`。 */
function currentChips(): IChipsBridge | undefined {
  return windowHost()?.chips;
}

/** 同步调用并取抛出的 ChipsError 错误码；未抛错时返回 `undefined`，断言随之失败。 */
function thrownCode(run: () => unknown): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof Error && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined;
  }
}

afterEach(() => {
  while (depth > 0) {
    uninstall();
  }
  restoreWindow?.();
  restoreWindow = undefined;
});

describe('installMockBridge', () => {
  it('无 window 的运行时安装时抛 SDK_BRIDGE_UNAVAILABLE', () => {
    expect(windowHost()).toBeUndefined();
    expect(() => installMockBridge()).toThrowError(ChipsError);
    expect(thrownCode(() => installMockBridge())).toBe(SDK_BRIDGE_UNAVAILABLE);
    expect(windowHost()).toBeUndefined();
  });

  it('省略参数时新建 Mock 并挂到 window.chips', () => {
    useWindow();
    const bridge = install();
    expect(currentChips()).toBe(bridge);
    expect(bridge.calls).toEqual([]);
  });

  it('传入 Mock 时安装该实例本身', () => {
    useWindow();
    const provided = createMockBridge({
      resources: { 'chips-resource://workspace/a.card': { data: '薯片' } },
    });
    expect(install(provided)).toBe(provided);
    expect(currentChips()).toBe(provided);
  });

  it('安装只写 chips 一个成员，不改动 window 上的其他对象', () => {
    const host = useWindow() as WindowHost & Record<string, unknown>;
    const marker = { note: '保留' };
    host.note = marker;
    install();
    expect(host.note).toBe(marker);
    expect(Object.keys(host).sort()).toEqual(['chips', 'note']);
  });
});

describe('uninstallMockBridge', () => {
  it('恢复安装前的 chips 值；栈空时卸载为无操作', () => {
    const host = useWindow();
    const previous = createMockBridge();
    host.chips = previous;
    install();
    expect(currentChips()).not.toBe(previous);
    uninstall();
    expect(currentChips()).toBe(previous);
    expect(() => uninstallMockBridge()).not.toThrow();
    expect(currentChips()).toBe(previous);
  });

  it('安装前不存在 chips 时卸载删除该成员', () => {
    const host = useWindow();
    install();
    expect('chips' in host).toBe(true);
    uninstall();
    expect('chips' in host).toBe(false);
  });

  it('嵌套安装按后进先出恢复', () => {
    useWindow();
    const outer = install();
    const inner = install();
    expect(currentChips()).toBe(inner);
    uninstall();
    expect(currentChips()).toBe(outer);
    uninstall();
    expect(currentChips()).toBeUndefined();
  });

  it('window 在卸载前消失时该层卸载为无操作，安装栈仍保持平衡', () => {
    const restore = mountWindow();
    install();
    // 页面级卸载后 window 不复存在：没有可写宿主，本层只能空转，但记录必须出栈
    restore();
    expect(windowHost()).toBeUndefined();
    expect(() => uninstallMockBridge()).not.toThrow();
    depth -= 1;
    // 栈已弹出该层：重新挂载后的安装/卸载仍按后进先出恢复前值，不受残留记录影响
    const host = useWindow();
    expect(host.chips).toBeUndefined();
    const previous = createMockBridge();
    host.chips = previous;
    install();
    expect(currentChips()).not.toBe(previous);
    uninstall();
    expect(currentChips()).toBe(previous);
  });
});

describe('Mock 安装与默认客户端 chips 的联动（02-SDK-API规范 §11 约束 8）', () => {
  it('安装后 chips 立即走 Mock，卸载后回到不可用', async () => {
    useWindow();
    const bridge = install();
    bridge.handle('file:read', (input: { path: string }) => ({
      content: `读取 ${input.path}`,
      encoding: 'utf-8',
    }));
    await expect(chips.request('file:read', { path: '.card/metadata.yaml' })).resolves.toEqual({
      content: '读取 .card/metadata.yaml',
      encoding: 'utf-8',
    });
    expect(bridge.calls).toEqual([
      { capabilityId: 'file:read', input: { path: '.card/metadata.yaml' } },
    ]);
    uninstall();
    const afterUninstall = chips.request('file:read', { path: '.card/metadata.yaml' });
    await expect(afterUninstall).rejects.toMatchObject({ code: SDK_BRIDGE_UNAVAILABLE });
  });

  it('安装后 chips 的订阅面命中 Mock，卸载后同步抛不可用', () => {
    useWindow();
    const bridge = install();
    const subscription = chips.subscribe('file:changed', () => undefined);
    expect(bridge.subscriptionCount('file:changed')).toBe(1);
    subscription.dispose();
    expect(bridge.subscriptionCount('file:changed')).toBe(0);
    uninstall();
    expect(thrownCode(() => chips.resource('chips-resource://workspace/a.card'))).toBe(
      SDK_BRIDGE_UNAVAILABLE,
    );
    expect(thrownCode(() => chips.subscribe('file:changed', () => undefined))).toBe(
      SDK_BRIDGE_UNAVAILABLE,
    );
  });

  it('嵌套安装不同 Mock 时卸载回退到外层 Mock 桩', async () => {
    useWindow();
    const first = install();
    const second = install(createMockBridge());
    first.handle('system:info', () => ({ platform: 'darwin' }));
    second.handle('system:info', () => ({ platform: 'win32' }));
    await expect(chips.request('system:info')).resolves.toEqual({ platform: 'win32' });
    uninstall();
    await expect(chips.request('system:info')).resolves.toEqual({ platform: 'darwin' });
    uninstall();
    await expect(chips.request('system:info')).rejects.toMatchObject({
      code: SDK_BRIDGE_UNAVAILABLE,
    });
  });
});
