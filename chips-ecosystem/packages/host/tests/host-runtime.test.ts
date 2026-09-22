import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createHostRuntime, windowIdOfSessionId } from '../src/runtime/host-runtime.js';
import { createSystemInfoCapability } from '../src/runtime/capabilities/system-info.js';
import type { IHostSessionProvisioner, IHostSessionGrant } from '../src/runtime/capability/session.js';
import type { IHostCapabilityDescriptor } from '../src/runtime/capability/contracts.js';
import type { IPalHost, SystemInfo } from '../src/platform/contracts/index.js';
import type { IPlatformHostChannel, IEventSink } from '../src/runtime/contracts.js';
import type { ISessionPermissionsUpdate } from '../src/protocol/wire.js';

const SYSTEM_SNAPSHOT: SystemInfo = {
  platform: 'darwin',
  osVersion: '15.0',
  arch: 'arm64',
  appVersion: '0.1.0',
  locale: 'zh-CN',
  paths: {
    userHome: '/Users/tester',
    userDocuments: '/Users/tester/Documents',
    userDownloads: '/Users/tester/Downloads',
    userDesktop: '/Users/tester/Desktop',
    userPictures: '/Users/tester/Pictures',
    userMusic: '/Users/tester/Music',
    userVideos: '/Users/tester/Videos',
    userData: '/Users/tester/Library/Application Support/Chips',
    temp: '/tmp',
  },
};

function palHost(): IPalHost {
  return {
    info: {
      shell: 'desktop',
      platform: 'macos',
      osVersion: '15.0',
      arch: 'arm64',
      appVersion: '0.1.0',
      locale: 'zh-CN',
      paths: {},
    },
    matrix: {
      window: false,
      dialog: false,
      notification: false,
      clipboard: false,
      menu: false,
      tray: false,
      shortcut: false,
      power: false,
      systemInfo: true,
      transfer: false,
      shellOpen: false,
      http: false,
    },
    ports: {
      storage: {},
      system: { getInfo: (): Promise<SystemInfo> => Promise.resolve(SYSTEM_SNAPSHOT) },
    } as IPalHost['ports'],
  };
}

function channel(): IPlatformHostChannel & { updates: ISessionPermissionsUpdate[] } {
  const updates: ISessionPermissionsUpdate[] = [];
  return {
    updates,
    pushSessionPermissions(_windowId, update) {
      updates.push(update);
    },
  };
}

function provisioner(
  grant: (source: { windowId: number; frameId: number | null }) => IHostSessionGrant | null,
): IHostSessionProvisioner {
  return { provision: (source) => grant(source) };
}

const platformGrant: IHostSessionGrant = { pluginId: 'platform', grantedPermissions: ['*'] };

describe('生产运行时：能力清单装配与路由', () => {
  const host = palHost();
  const builtins = [createSystemInfoCapability(host)];

  it('start 注册内置能力；system:info 返回真实快照', async () => {
    const runtime = createHostRuntime({ capabilities: builtins });
    await runtime.start(host, channel());
    const report = runtime.report();
    expect(report.state).toBe('running');
    expect(report.capabilities.byDomain).toMatchObject({ system: 1 });

    const response = await runtime.ipc.handleRequest(
      { windowId: 1, frameId: null },
      { requestId: 'r1', capabilityId: 'system:info' },
    );
    expect(response).toEqual({ requestId: 'r1', ok: true, result: SYSTEM_SNAPSHOT });
    await runtime.shutdown();
  });

  it('未注册能力：真实 BRIDGE_CAPABILITY_NOT_FOUND（非空壳统一）', async () => {
    const runtime = createHostRuntime({ capabilities: builtins });
    await runtime.start(host, channel());
    const response = await runtime.ipc.handleRequest(
      { windowId: 1, frameId: null },
      { requestId: 'r2', capabilityId: 'document:open' },
    );
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
    }
    await runtime.shutdown();
  });

  it('会话来源无法授权：BRIDGE_SESSION_UNKNOWN', async () => {
    const runtime = createHostRuntime({ capabilities: builtins, sessionProvisioner: provisioner(() => null) });
    await runtime.start(host, channel());
    const response = await runtime.ipc.handleRequest(
      { windowId: 9, frameId: null },
      { requestId: 'r3', capabilityId: 'system:info' },
    );
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    }
    await runtime.shutdown();
  });

  it('会话懒建并推送权限快照；快照变更再推送', async () => {
    const ch = channel();
    const runtime = createHostRuntime({ capabilities: builtins, sessionProvisioner: provisioner(() => platformGrant) });
    await runtime.start(host, ch);
    await runtime.ipc.handleRequest({ windowId: 3, frameId: null }, { requestId: 'r4', capabilityId: 'system:info' });
    expect(ch.updates).toHaveLength(1);
    expect(ch.updates[0]).toMatchObject({ permissionVersion: 0, grantedPermissions: ['*'] });
    expect(runtime.report().activeSessions).toBe(1);
    await runtime.shutdown();
    expect(runtime.report().activeSessions).toBe(0);
    expect(runtime.report().state).toBe('stopped');
  });

  it('权限不足的能力调用：BRIDGE_PERMISSION_DENIED', async () => {
    const guarded: IHostCapabilityDescriptor = {
      id: 'doc:write',
      permissions: ['resources:write'],
      handler: () => Promise.resolve('should-not-run'),
    };
    const runtime = createHostRuntime({
      capabilities: [guarded],
      sessionProvisioner: provisioner(() => ({ pluginId: 'demo', grantedPermissions: [] })),
    });
    await runtime.start(host, channel());
    const response = await runtime.ipc.handleRequest(
      { windowId: 1, frameId: null },
      { requestId: 'r5', capabilityId: 'doc:write' },
    );
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_PERMISSION_DENIED');
    }
    await runtime.shutdown();
  });

  it('横切贯通端到端：请求帧 traceId 随事件下行封套透出（工单046 段一）', async () => {
    const emitter: IHostCapabilityDescriptor = {
      id: 'demo:emit',
      permissions: [],
      handler: (_input, ctx) => {
        ctx.emit('document:saved', { id: 'd9' });
        return Promise.resolve('emitted');
      },
    };
    const runtime = createHostRuntime({
      capabilities: [emitter],
      sessionProvisioner: provisioner(() => platformGrant),
    });
    await runtime.start(host, channel());
    const deliver = vi.fn();
    runtime.forwardEvents({ deliver });
    await runtime.ipc.handleEventControl(
      { windowId: 5, frameId: null },
      { controlId: 'c1', action: 'subscribe', eventId: 'document:saved' },
    );
    await runtime.ipc.handleRequest(
      { windowId: 5, frameId: null },
      { requestId: 'r-tr', capabilityId: 'demo:emit', traceId: 't-tr' },
    );
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0]?.[1]).toMatchObject({
      eventId: 'document:saved',
      payload: { id: 'd9' },
      traceId: 't-tr',
      requestId: 'r-tr',
    });
    await runtime.shutdown();
  });

  it('事件订阅 + 能力 emit 经 sink 下行到订阅窗口', async () => {
    const emitter: IHostCapabilityDescriptor = {
      id: 'demo:emit',
      permissions: [],
      handler: (_input, ctx) => {
        ctx.emit('document:saved', { id: 'd1' });
        return Promise.resolve('emitted');
      },
    };
    const runtime = createHostRuntime({
      capabilities: [emitter],
      sessionProvisioner: provisioner(() => platformGrant),
    });
    await runtime.start(host, channel());
    const deliver = vi.fn();
    const sink: IEventSink = { deliver };
    runtime.forwardEvents(sink);

    // 未订阅时 emit 不投递
    await runtime.ipc.handleRequest({ windowId: 5, frameId: null }, { requestId: 'a', capabilityId: 'demo:emit' });
    expect(deliver).not.toHaveBeenCalled();

    await runtime.ipc.handleEventControl(
      { windowId: 5, frameId: null },
      { controlId: 'c1', action: 'subscribe', eventId: 'document:saved' },
    );
    await runtime.ipc.handleRequest({ windowId: 5, frameId: null }, { requestId: 'b', capabilityId: 'demo:emit' });
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0]?.[1]).toMatchObject({ eventId: 'document:saved', payload: { id: 'd1' } });
    expect(runtime.report().eventSubscriptions).toBe(1);

    // 窗口关闭回收订阅与会话
    runtime.ipc.handleWindowClosed(5);
    expect(runtime.report().eventSubscriptions).toBe(0);
    expect(runtime.report().activeSessions).toBe(0);
    await runtime.shutdown();
  });
});

describe('生产运行时：资源句柄控制', () => {
  let root: string;
  const host = palHost();

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'chips-host-rt-'));
    await writeFile(join(root, 'shell.html'), '<html>ok</html>');
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('platform 作用域 open 返回元数据并登记句柄', async () => {
    const runtime = createHostRuntime({
      capabilities: [],
      platformRoot: root,
      sessionProvisioner: provisioner(() => platformGrant),
    });
    await runtime.start(host, channel());
    const response = await runtime.ipc.handleResourceControl(
      { windowId: 1, frameId: null },
      { requestId: 'rq1', operation: 'open', uri: 'chips-resource://platform/shell.html' },
    );
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.metadata).toMatchObject({ uri: 'chips-resource://platform/shell.html', mimeType: 'text/html' });
    }
    expect(runtime.report().resourceHandles).toBe(1);

    const released = await runtime.ipc.handleResourceControl(
      { windowId: 1, frameId: null },
      { requestId: 'rq2', operation: 'release', uri: 'chips-resource://platform/shell.html' },
    );
    expect(released.ok).toBe(true);
    expect(runtime.report().resourceHandles).toBe(0);
    await runtime.shutdown();
  });

  it('非 platform 作用域且无 resources:read：BRIDGE_PERMISSION_DENIED', async () => {
    const runtime = createHostRuntime({
      capabilities: [],
      platformRoot: root,
      sessionProvisioner: provisioner(() => ({ pluginId: 'demo', grantedPermissions: [] })),
    });
    await runtime.start(host, channel());
    const response = await runtime.ipc.handleResourceControl(
      { windowId: 1, frameId: null },
      { requestId: 'rq3', operation: 'open', uri: 'chips-resource://card-1/a.bin' },
    );
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_PERMISSION_DENIED');
    }
    await runtime.shutdown();
  });
});

/* ------------------------------------------------------------------ *
 * G2 归属臂·身份取证腿：会话标识词法逆向解析（工单043-A4）
 * ------------------------------------------------------------------ */

describe('windowIdOfSessionId：会话标识 → 归属窗口 ID 的词法逆向', () => {
  it('与正向词法 sessionSourceId 构成 round-trip 恒等（main / 数值 frame 双腿）', () => {
    const forward = (windowId: number, frameId: number | null): string =>
      `session:${String(windowId)}:${frameId === null ? 'main' : String(frameId)}`;
    for (const [windowId, frameId] of [
      [0, null],
      [7, null],
      [7, 123],
      [11, 0],
      [22, 4567],
    ] as const) {
      expect(windowIdOfSessionId(forward(windowId, frameId)), `window=${windowId} frame=${String(frameId)}`).toBe(
        windowId,
      );
    }
  });

  it('真实运行时产出的会话 ID 逐字可逆：关闭联动回调交付的 sessionId 反解回发起窗口', async () => {
    const closed: string[] = [];
    const runtime = createHostRuntime({
      capabilities: [],
      sessionProvisioner: provisioner(() => platformGrant),
      onBridgeSessionClosed: (sessionId) => {
        closed.push(sessionId);
      },
    });
    await runtime.start(palHost(), channel());
    await runtime.ipc.handleRequest({ windowId: 9, frameId: null }, { requestId: 'rt-1', capabilityId: 'no:such' });
    runtime.ipc.handleWindowClosed(9);
    expect(closed).toEqual(['session:9:main']);
    expect(windowIdOfSessionId(closed[0] as string)).toBe(9);
    await runtime.shutdown();
  });

  it('词法外 / 载体 / 越界标识一律 null：调用方按无法归属如实拒绝', () => {
    for (const sessionId of [
      'session:carrier:c-1',
      'session:carrier:main',
      'session-a:main',
      'session:07:main',
      'session:-1:main',
      'session:1.5:main',
      'session:1:',
      'session:1',
      'session::main',
      'session:1:main:extra',
      ' Session:1:main',
      'session:1:main ',
      `session:${String(Number.MAX_SAFE_INTEGER + 1000)}:main`,
      'session:nan:main',
      'session:1e9:main',
      '',
    ]) {
      expect(windowIdOfSessionId(sessionId), JSON.stringify(sessionId)).toBeNull();
    }
  });
});

/**
 * 运行时会话权限快照查询面（08 §7.6 快照本体）——工单036 §五.3-1 / 开发日志刀4 缝①收口锁测：
 * 组合根据此把文档守卫端口的会话来源默认绑定到本运行时的会话登记表（判定输入与路由侧准入同源）。
 */
describe('运行时会话权限快照查询面（工单036 §五.3-1 / 刀4 缝①）', () => {
  it('空表零快照；IPC 建会话后透出完整权限集；与诊断视图同源；停机后终态入快照不静默消失', async () => {
    const runtime = createHostRuntime({
      capabilities: [],
      sessionProvisioner: provisioner(() => platformGrant),
    });
    await runtime.start(palHost(), channel());
    expect(runtime.sessionPermissionSnapshots()).toEqual([]);

    await runtime.ipc.handleRequest(
      { windowId: 4, frameId: null },
      { requestId: 'snap-1', capabilityId: 'no:such:capability' },
    );
    const snapshots = runtime.sessionPermissionSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.sessionId).toBe('session:4:main');
    expect(snapshots[0]?.state).toBe('active');
    expect([...(snapshots[0]?.grantedPermissions ?? [])]).toEqual(['*']);

    // 与 `report().sessions` 诊断视图同一会话实体派生（禁第二会话表）。
    const view = runtime.report().sessions.find((item) => item.sessionId === 'session:4:main');
    expect(view?.state).toBe('active');
    expect(view?.grantedCount).toBe(snapshots[0]?.grantedPermissions.size);

    await runtime.shutdown();
    expect(runtime.sessionPermissionSnapshots()[0]?.state).toBe('closed');
  });

  it('按来源差异化授权：快照逐会话透出各自权限集（不猜测、不外溢，主框架与子帧分离）', async () => {
    const runtime = createHostRuntime({
      capabilities: [],
      sessionProvisioner: provisioner((source) =>
        source.frameId === null
          ? { pluginId: 'demo', grantedPermissions: ['resources:read', 'resources:write'] }
          : { pluginId: 'demo', grantedPermissions: ['resources:read'] },
      ),
    });
    await runtime.start(palHost(), channel());
    await runtime.ipc.handleRequest(
      { windowId: 5, frameId: null },
      { requestId: 'snap-2', capabilityId: 'no:such:capability' },
    );
    await runtime.ipc.handleRequest(
      { windowId: 5, frameId: 8 },
      { requestId: 'snap-3', capabilityId: 'no:such:capability' },
    );

    const main = runtime.sessionPermissionSnapshots().find((item) => item.sessionId === 'session:5:main');
    const subFrame = runtime.sessionPermissionSnapshots().find((item) => item.sessionId === 'session:5:8');
    expect([...(main?.grantedPermissions ?? [])]).toEqual(['resources:read', 'resources:write']);
    expect([...(subFrame?.grantedPermissions ?? [])]).toEqual(['resources:read']);
    expect(runtime.report().sessions.find((item) => item.sessionId === 'session:5:8')?.grantedCount).toBe(1);
    await runtime.shutdown();
  });
});
