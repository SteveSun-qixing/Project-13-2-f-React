import { describe, expect, it, vi } from 'vitest';

import { pushSessionPermissions, resolveIpcSession } from '../src/main/session-resolver.js';
import type { ShellWebContents } from '../src/main/shell-api.js';
import type { ShellSession } from '../src/main/shell-api.js';

const session: ShellSession = {
  key: 'chips-window-1',
  protocol: {
    handle(): void {
      return;
    },
    unhandle(): void {
      return;
    },
    isProtocolHandled(): boolean {
      return false;
    },
  },
};

function createWebContents(overrides: Partial<ShellWebContents> = {}): ShellWebContents {
  return {
    id: 7,
    session,
    isDestroyed: () => false,
    send: vi.fn(),
    close: vi.fn(),
    onDestroyed: vi.fn(),
    ...overrides,
  };
}

describe('resolveIpcSession', () => {
  it('按来源解析窗口与会话帧', () => {
    const result = resolveIpcSession({ sender: { id: 7 }, senderFrame: { routingId: 3 } }, () => true);
    expect(result).toEqual({ windowId: 7, frameId: 3 });
  });

  it('senderFrame 缺失时 frameId 为 null', () => {
    expect(resolveIpcSession({ sender: { id: 7 }, senderFrame: null }, () => true)).toEqual({
      windowId: 7,
      frameId: null,
    });
  });

  it('窗口不存在或已关闭时拒绝解析', () => {
    expect(resolveIpcSession({ sender: { id: 7 }, senderFrame: null }, () => false)).toBeNull();
    expect(resolveIpcSession({ sender: { id: Number.NaN }, senderFrame: null }, () => true)).toBeNull();
    expect(resolveIpcSession({ sender: {} as { id: number }, senderFrame: null }, () => true)).toBeNull();
  });
});

describe('pushSessionPermissions', () => {
  it('向存活窗口投递权限快照', () => {
    const webContents = createWebContents();
    const delivered = pushSessionPermissions(webContents, 'session:permissions', {
      sessionId: 's1',
      grantedPermissions: ['resources:read'],
      permissionVersion: 1,
    });
    expect(delivered).toBe(true);
    expect(webContents.send).toHaveBeenCalledWith('session:permissions', {
      sessionId: 's1',
      grantedPermissions: ['resources:read'],
      permissionVersion: 1,
    });
  });

  it('窗口已销毁时不投递', () => {
    const webContents = createWebContents({ isDestroyed: () => true });
    const delivered = pushSessionPermissions(webContents, 'session:permissions', {
      sessionId: 's1',
      grantedPermissions: [],
      permissionVersion: 2,
    });
    expect(delivered).toBe(false);
    expect(webContents.send).not.toHaveBeenCalled();
  });
});
