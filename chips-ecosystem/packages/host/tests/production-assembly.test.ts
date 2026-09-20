import { describe, expect, it } from 'vitest';

import { buildProductionManifest, createProductionAssembly, createProductionRuntime } from '../src/main/production-assembly.js';
import type { IHostCapabilityDescriptor } from '../src/runtime/capability/contracts.js';
import type { IPalHost, SystemInfo } from '../src/platform/contracts/index.js';
import type { HostRuntimeContext } from '../src/main/runtime-provider.js';

const host: IPalHost = {
  info: { shell: 'desktop', platform: 'macos', osVersion: '15.0', arch: 'arm64', appVersion: '0.1.0', locale: 'zh-CN', paths: {} },
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
    system: { getInfo: async (): Promise<SystemInfo> => ({ platform: 'darwin', osVersion: '15.0', arch: 'arm64', appVersion: '0.1.0', locale: 'zh-CN', paths: {} }) },
  } as IPalHost['ports'],
};

const documentProvider: readonly IHostCapabilityDescriptor[] = [
  { id: 'document:open', permissions: ['resources:read'], handler: async () => ({ documentId: 'd1' }) },
];

const context: HostRuntimeContext = { palHost: host, platformRoot: '/tmp/platform', userDataPath: '/tmp/user' };

describe('生产组合根：清单装配', () => {
  it('清单 = 内置 + 外部提供方（内置在前）', () => {
    const manifest = buildProductionManifest(host, [documentProvider]);
    expect(manifest.map((d) => d.id)).toEqual(['system:info', 'document:open']);
    expect(manifest[0]).toMatchObject({ id: 'system:info', permissions: [] });
    expect(manifest[1]).toMatchObject({ id: 'document:open', permissions: ['resources:read'] });
  });

  it('createProductionRuntime 注册清单并可路由 document:open', async () => {
    const runtime = createProductionRuntime(context, { capabilityProviders: [documentProvider] });
    await runtime.start(host, { pushSessionPermissions: () => undefined });
    const report = runtime.report();
    expect(report.capabilities.byDomain).toMatchObject({ system: 1, document: 1 });

    const response = await runtime.ipc.handleRequest(
      { windowId: 1, frameId: null },
      { requestId: 'r1', capabilityId: 'document:open', input: { source: 'file:///a' } },
    );
    expect(response).toEqual({ requestId: 'r1', ok: true, result: { documentId: 'd1' } });
    await runtime.shutdown();
  });

  it('createProductionAssembly 通过契约校验并暴露 createRuntime', async () => {
    const assembly = createProductionAssembly({
      createPalHost: () => host,
      capabilityProviders: [documentProvider],
    });
    expect(typeof assembly.createPalHost).toBe('function');
    expect(typeof assembly.createRuntime).toBe('function');
    const runtime = await assembly.createRuntime(context);
    await runtime.start(host, { pushSessionPermissions: () => undefined });
    expect(runtime.report().capabilities.active).toBe(2);
    await runtime.shutdown();
  });
});
