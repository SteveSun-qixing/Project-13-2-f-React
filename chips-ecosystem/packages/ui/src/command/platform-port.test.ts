import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveCommandBridgePort } from './platform-port';

const globalWithChips = globalThis as { chips?: unknown };

afterEach(() => {
  delete globalWithChips.chips;
  vi.restoreAllMocks();
});

describe('resolveCommandBridgePort', () => {
  it('无 window.chips 时返回 null', () => {
    expect(resolveCommandBridgePort()).toBeNull();
  });

  it('结构不完整时返回 null', () => {
    globalWithChips.chips = { request: () => Promise.resolve() };
    expect(resolveCommandBridgePort()).toBeNull();
    globalWithChips.chips = { subscribe: () => ({ dispose: () => undefined }) };
    expect(resolveCommandBridgePort()).toBeNull();
    globalWithChips.chips = 'chips';
    expect(resolveCommandBridgePort()).toBeNull();
  });

  it('解析出的端口转发 request 与 subscribe', async () => {
    const dispose = vi.fn();
    const request = vi.fn().mockResolvedValue({ ok: true });
    const subscribe = vi.fn().mockReturnValue({ dispose });
    globalWithChips.chips = { request, subscribe };

    const port = resolveCommandBridgePort();
    expect(port).not.toBeNull();
    await expect(port?.request('command:list', { includeHidden: false })).resolves.toEqual({
      ok: true,
    });
    expect(request).toHaveBeenCalledWith('command:list', { includeHidden: false });

    const handler = (): void => undefined;
    const subscription = port?.subscribe('command:invoked', handler);
    expect(subscribe).toHaveBeenCalledWith('command:invoked', handler);
    subscription?.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
