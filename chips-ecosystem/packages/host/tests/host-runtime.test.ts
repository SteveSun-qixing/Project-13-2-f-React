import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createHostRuntime } from '../src/runtime/host-runtime.js';
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
      system: { getInfo: async () => SYSTEM_SNAPSHOT },
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

    const response = await runtime.ipc.handleRequest({ windowId: 1, frameId: null }, { requestId: 'r1', capabilityId: 'system:info' });
    expect(response).toEqual({ requestId: 'r1', ok: true, result: SYSTEM_SNAPSHOT });
    await runtime.shutdown();
  });

  it('未注册能力：真实 BRIDGE_CAPABILITY_NOT_FOUND（非空壳统一）', async () => {
    const runtime = createHostRuntime({ capabilities: builtins });
    await runtime.start(host, channel());
    const response = await runtime.ipc.handleRequest({ windowId: 1, frameId: null }, { requestId: 'r2', capabilityId: 'document:open' });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
    }
    await runtime.shutdown();
  });

  it('会话来源无法授权：BRIDGE_SESSION_UNKNOWN', async () => {
    const runtime = createHostRuntime({ capabilities: builtins, sessionProvisioner: provisioner(() => null) });
    await runtime.start(host, channel());
    const response = await runtime.ipc.handleRequest({ windowId: 9, frameId: null }, { requestId: 'r3', capabilityId: 'system:info' });
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
      handler: async () => 'should-not-run',
    };
    const runtime = createHostRuntime({
      capabilities: [guarded],
      sessionProvisioner: provisioner(() => ({ pluginId: 'demo', grantedPermissions: [] })),
    });
    await runtime.start(host, channel());
    const response = await runtime.ipc.handleRequest({ windowId: 1, frameId: null }, { requestId: 'r5', capabilityId: 'doc:write' });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_PERMISSION_DENIED');
    }
    await runtime.shutdown();
  });

  it('事件订阅 + 能力 emit 经 sink 下行到订阅窗口', async () => {
    const emitter: IHostCapabilityDescriptor = {
      id: 'demo:emit',
      permissions: [],
      handler: async (_input, ctx) => {
        ctx.emit('document:saved', { id: 'd1' });
        return 'emitted';
      },
    };
    const runtime = createHostRuntime({ capabilities: [emitter], sessionProvisioner: provisioner(() => platformGrant) });
    await runtime.start(host, channel());
    const deliver = vi.fn();
    const sink: IEventSink = { deliver };
    runtime.forwardEvents(sink);

    // 未订阅时 emit 不投递
    await runtime.ipc.handleRequest({ windowId: 5, frameId: null }, { requestId: 'a', capabilityId: 'demo:emit' });
    expect(deliver).not.toHaveBeenCalled();

    await runtime.ipc.handleEventControl({ windowId: 5, frameId: null }, { controlId: 'c1', action: 'subscribe', eventId: 'document:saved' });
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
    const runtime = createHostRuntime({ capabilities: [], platformRoot: root, sessionProvisioner: provisioner(() => platformGrant) });
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
