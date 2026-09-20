import { describe, expect, it } from 'vitest';

import {
  buildProductionManifest,
  createProductionAssembly,
  createProductionRuntime,
} from '../src/main/production-assembly.js';
import { RESERVED_DOCUMENT_CAPABILITIES } from '../src/runtime/capabilities/reserved.js';
import type { IHostCapabilityDescriptor } from '../src/runtime/capability/contracts.js';
import type { IPalHost, SystemInfo } from '../src/platform/contracts/index.js';
import type { HostRuntimeContext } from '../src/main/runtime-provider.js';

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

const host: IPalHost = {
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

/** 外部提供方夹具：仅证明注入契约形状，不代表 `document:*` 的真实业务实现（接线单交付）。 */
const documentProvider: readonly IHostCapabilityDescriptor[] = [
  { id: 'document:open', permissions: ['resources:read'], handler: () => Promise.resolve({ documentId: 'd1' }) },
];

const context: HostRuntimeContext = { palHost: host, platformRoot: '/tmp/platform', userDataPath: '/tmp/user' };

describe('生产组合根：清单装配', () => {
  it('清单 = 内置 + 外部提供方（内置在前）', () => {
    const manifest = buildProductionManifest(host, [documentProvider]);
    expect(manifest.map((d) => d.id)).toEqual(['system:info', 'document:open']);
    expect(manifest[0]).toMatchObject({ id: 'system:info', permissions: [] });
    expect(manifest[1]).toMatchObject({ id: 'document:open', permissions: ['resources:read'] });
  });

  it('无外部提供方时清单只有内置能力（document:* 不在其中）', () => {
    const manifest = buildProductionManifest(host);
    expect(manifest.map((d) => d.id)).toEqual(['system:info']);
    expect(manifest.some((d) => d.id.startsWith('document:'))).toBe(false);
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

describe('生产组合根：预留槽位诊断面（已预留、待接线）', () => {
  it('未接线时 document:* 全部 wired=false，调用得到真实未命中错误', async () => {
    const runtime = createProductionRuntime(context);
    await runtime.start(host, { pushSessionPermissions: () => undefined });
    const report = runtime.report();
    expect(report.reserved.map((item) => item.id)).toEqual(RESERVED_DOCUMENT_CAPABILITIES.map((item) => item.id));
    expect(report.reserved.every((item) => item.wired === false)).toBe(true);
    expect(report.capabilities.byDomain['document'] ?? 0).toBe(0);

    const response = await runtime.ipc.handleRequest(
      { windowId: 1, frameId: null },
      { requestId: 'r2', capabilityId: 'document:read', input: { documentId: 'd1' } },
    );
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
    }
    await runtime.shutdown();
  });

  it('提供方注册后同名槽位 wired=true，其余槽位仍待接线', async () => {
    const runtime = createProductionRuntime(context, { capabilityProviders: [documentProvider] });
    await runtime.start(host, { pushSessionPermissions: () => undefined });
    const reserved = new Map(runtime.report().reserved.map((item) => [item.id, item]));
    expect(reserved.get('document:open')).toMatchObject({
      wired: true,
      provider: 'document',
      permissions: ['resources:read'],
    });
    expect(reserved.get('document:save')?.wired).toBe(false);
    await runtime.shutdown();
  });
});
