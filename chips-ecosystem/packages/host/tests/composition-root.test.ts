/**
 * 组合根接线全链套件（任务 #27：Host 生产组合根，自举 + 能力注册接线）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动顺序：PAL 自举 → 运行时装配 → Bridge 接线）、
 * `02-Bridge三层设计` §2.1 / §7（主进程适配层与 IPC 通道）、
 * `04-能力契约规范` §6.2 / §7.3（`document:*` 权限映射与内置能力契约）。
 *
 * @remarks
 * - 与 `production-assembly.test.ts`（组合根单元面）的分工：本套件从壳启动入口
 *   （`startHostMain`）出发，锁定接线的**传递链**——PalHostContext / HostRuntimeContext 逐段一致、
 *   真实注册表被壳消费、`bridge:request` 通道端到端可达、document 挂载声明与提供方注入形态、
 *   注册冲突终止启动、收口状态归位。
 * - document 提供方夹具只证明注入契约形状（`document:open` 一条）；真实业务实现属
 *   `capabilities/document/`（并行路 R28 交付），本套件不 import 该目录。
 */

import { describe, expect, it, vi } from 'vitest';

import { BRIDGE_REQUEST_CHANNEL } from '../src/protocol/channels.js';
import { createProductionAssembly } from '../src/main/production-assembly.js';
import { startHostMain } from '../src/main/main.js';
import { createHostAssembly, type HostRuntimeContext, type PalHostContext } from '../src/main/runtime-provider.js';
import { RESERVED_DOCUMENT_CAPABILITIES } from '../src/runtime/capabilities/reserved.js';
import { HostStartupError } from '../src/shared/errors.js';
import type { IHostCapabilityDescriptor } from '../src/runtime/capability/contracts.js';
import type { IPalHost, SystemInfo } from '../src/platform/contracts/index.js';
import type { IHostRuntime } from '../src/runtime/host-runtime.js';
import { createFakePalHost, EMPTY_MATRIX } from './helpers/fake-pal-host.js';
import { createFakeElectron, type FakeElectronModule } from './helpers/shell-electron.js';

const PRELOAD_PATH = '/app/dist/preload/index.js';
const PLATFORM_ROOT = '/app/dist/renderer';

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

/** 带 `system` 端口的 PAL 宿主替身（矩阵与端口一致性由 `validatePalHost` 把关）。 */
function createSystemPalHost(): IPalHost {
  return createFakePalHost({
    matrix: { ...EMPTY_MATRIX, systemInfo: true },
    ports: {
      storage: {},
      system: { getInfo: (): Promise<SystemInfo> => Promise.resolve(SYSTEM_SNAPSHOT) },
    } as IPalHost['ports'],
  });
}

/** document 提供方夹具（注入契约形状；非 R28 真实业务实现）。 */
const documentOpenProvider: readonly IHostCapabilityDescriptor[] = [
  {
    id: 'document:open',
    permissions: ['resources:read'],
    handler: (input: unknown): Promise<unknown> =>
      Promise.resolve({ documentId: 'doc-42', echoed: (input as { source?: string }).source ?? null }),
  },
];

interface CompositionScenario {
  readonly fake: FakeElectronModule;
  readonly palHost: IPalHost;
  readonly palCalls: { electronModule: unknown; context: PalHostContext }[];
  readonly runtimeCalls: HostRuntimeContext[];
  readonly diagnostics: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  readonly handle: NonNullable<Awaited<ReturnType<typeof startHostMain>>>;
  readonly runtime: IHostRuntime;
}

/**
 * 以生产组合根装配驱动壳启动全链，并捕获逐段接线上下文。
 *
 * @param providers 外部能力提供方清单（模拟 document 接线单注入形态）。
 */
async function startComposition(
  providers: readonly (readonly IHostCapabilityDescriptor[])[] = [],
): Promise<CompositionScenario> {
  const fake = createFakeElectron();
  const palHost = createSystemPalHost();
  const palCalls: { electronModule: unknown; context: PalHostContext }[] = [];
  const runtimeCalls: HostRuntimeContext[] = [];
  let runtime: IHostRuntime | null = null;
  const production = createProductionAssembly({
    ...(providers.length === 0 ? {} : { capabilityProviders: providers }),
    // 原生绑定装载诊断经收集口吸收（生产默认 stderr 口会把 fixture 的缺产物回退
    // 警告打进测试输出；装载链本体由 production-assembly 套件断言）。
    diagnostics: { warn: vi.fn(), error: vi.fn() },
    createPalHost: (electronModule, context) => {
      palCalls.push({ electronModule, context });
      return palHost;
    },
  });
  // 外层包裹仅用于捕获组合根产出的真实运行时实例；装配语义全部来自 production 装配。
  const assembly = createHostAssembly<IHostRuntime>({
    createPalHost: (electronModule, context) => production.createPalHost(electronModule, context),
    createRuntime: async (context) => {
      runtimeCalls.push(context);
      const created = await production.createRuntime(context);
      runtime = created;
      return created;
    },
  });
  const diagnostics = { warn: vi.fn(), error: vi.fn() };
  const promise = startHostMain({
    electronModule: fake.module,
    assembly,
    preloadPath: PRELOAD_PATH,
    platformRoot: PLATFORM_ROOT,
    diagnostics,
  });
  await Promise.resolve();
  fake.app.resolveReady();
  const handle = await promise;
  if (handle === null || runtime === null) {
    throw new Error('组合根场景预期壳启动成功并装配运行时');
  }
  return { fake, palHost, palCalls, runtimeCalls, diagnostics, handle, runtime };
}

/** 取启动窗口的 `webContents.id`（替身自 100 起编号）。 */
function bootstrapWindowId(fake: FakeElectronModule): number {
  const id = fake.windows[0]!.webContents.id;
  expect(Number.isInteger(id)).toBe(true);
  return id;
}

describe('组合根全链：壳启动 → PAL 自举 → 运行时装配 → 能力注册', () => {
  it('PAL 自举与运行时装配的上下文与壳输入逐段一致', async () => {
    const { fake, palHost, palCalls, runtimeCalls, handle } = await startComposition();
    expect(palCalls).toHaveLength(1);
    expect(palCalls[0]!.electronModule).toBe(fake.module);
    expect(palCalls[0]!.context).toEqual({
      userDataPath: fake.app.getPath('userData'),
      preloadPath: PRELOAD_PATH,
      platformRoot: PLATFORM_ROOT,
    });
    expect(runtimeCalls).toHaveLength(1);
    expect(runtimeCalls[0]!.palHost).toBe(palHost);
    expect(runtimeCalls[0]!.platformRoot).toBe(PLATFORM_ROOT);
    expect(runtimeCalls[0]!.userDataPath).toBe(fake.app.getPath('userData'));
    expect(handle.application.state).toBe('running');
  });

  it('能力注册表真实注册：system:info 经壳端口返回 PAL 真实快照', async () => {
    const { fake, runtime } = await startComposition();
    const report = runtime.report();
    expect(report.state).toBe('running');
    expect(report.capabilities.active).toBe(2);
    expect(report.capabilities.byDomain).toMatchObject({ system: 1, event: 1 });

    const response = await runtime.ipc.handleRequest(
      { windowId: bootstrapWindowId(fake), frameId: null },
      { requestId: 'cr-system-1', capabilityId: 'system:info', input: {} },
    );
    expect(response).toEqual({ requestId: 'cr-system-1', ok: true, result: SYSTEM_SNAPSHOT });
  });

  it('Bridge 接线面：bridge:request 通道端到端可达真实注册表', async () => {
    const { fake } = await startComposition();
    const windowId = bootstrapWindowId(fake);

    const ok = await fake.ipcMain.invoke(
      BRIDGE_REQUEST_CHANNEL,
      { sender: { id: windowId }, senderFrame: null },
      {
        requestId: 'cr-channel-1',
        capabilityId: 'system:info',
        input: {},
      },
    );
    expect(ok).toEqual({ requestId: 'cr-channel-1', ok: true, result: SYSTEM_SNAPSHOT });

    const unknown = (await fake.ipcMain.invoke(
      BRIDGE_REQUEST_CHANNEL,
      { sender: { id: 9999 }, senderFrame: null },
      {
        requestId: 'cr-channel-2',
        capabilityId: 'system:info',
        input: {},
      },
    )) as { requestId: string; ok: boolean; error?: { code: string } };
    expect(unknown.ok).toBe(false);
    expect(unknown.error?.code).toBe('BRIDGE_SESSION_UNKNOWN');
  });

  it('document 服务挂载声明：四项与契约一致、未接线时调用得到真实未命中错误', async () => {
    const { runtime } = await startComposition();
    const report = runtime.report();
    expect(report.reserved).toEqual(
      RESERVED_DOCUMENT_CAPABILITIES.map((declaration) => ({ ...declaration, wired: false })),
    );
    expect(RESERVED_DOCUMENT_CAPABILITIES.map((declaration) => [declaration.id, declaration.permissions])).toEqual([
      ['document:open', ['resources:read']],
      ['document:read', ['resources:read']],
      ['document:write', ['resources:write']],
      ['document:save', ['resources:write']],
    ]);

    const response = await runtime.ipc.handleRequest(
      { windowId: 100, frameId: null },
      { requestId: 'cr-doc-1', capabilityId: 'document:write', input: { documentId: 'd1' } },
    );
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
    }
  });

  it('提供方接线后：通道调用穿透真实 handler、槽位 wired=true、清单域计数同步', async () => {
    const { fake, runtime } = await startComposition([documentOpenProvider]);
    const windowId = bootstrapWindowId(fake);

    const response = (await fake.ipcMain.invoke(
      BRIDGE_REQUEST_CHANNEL,
      { sender: { id: windowId }, senderFrame: null },
      { requestId: 'cr-wired-1', capabilityId: 'document:open', input: { source: 'chips-resource://platform/a' } },
    )) as { requestId: string; ok: boolean; result?: unknown };
    expect(response).toEqual({
      requestId: 'cr-wired-1',
      ok: true,
      result: { documentId: 'doc-42', echoed: 'chips-resource://platform/a' },
    });

    const report = runtime.report();
    expect(report.capabilities.active).toBe(3);
    expect(report.capabilities.byDomain).toMatchObject({ system: 1, document: 1, event: 1 });
    const reserved = new Map(report.reserved.map((item) => [item.id, item]));
    expect(reserved.get('document:open')).toMatchObject({ wired: true, provider: 'document' });
    expect(reserved.get('document:save')?.wired).toBe(false);
  });

  it('注册冲突终止壳启动：与内置同 ID 的提供方使 createRuntime 抛出、退出码 1', async () => {
    const conflictProvider: readonly IHostCapabilityDescriptor[] = [
      { id: 'system:info', permissions: [], handler: () => Promise.resolve(null) },
    ];
    const fake = createFakeElectron();
    const palHost = createSystemPalHost();
    const production = createProductionAssembly({
      capabilityProviders: [conflictProvider],
      diagnostics: { warn: vi.fn(), error: vi.fn() },
      createPalHost: () => palHost,
    });
    const diagnostics = { warn: vi.fn(), error: vi.fn() };
    const promise = startHostMain({
      electronModule: fake.module,
      assembly: production,
      preloadPath: PRELOAD_PATH,
      platformRoot: PLATFORM_ROOT,
      diagnostics,
    });
    await Promise.resolve();
    fake.app.resolveReady();
    await expect(promise).rejects.toBeInstanceOf(HostStartupError);
    expect(fake.app.exitCodes).toEqual([1]);
    expect(diagnostics.error).toHaveBeenCalledWith(
      'startup',
      expect.stringContaining('HOST_STARTUP_FAILED'),
      expect.objectContaining({ stage: 'core-start' }),
    );
  });

  it('收口：quit 逆序停机后运行时状态归位 stopped', async () => {
    const { fake, runtime, handle } = await startComposition();
    await handle.quit();
    expect(fake.app.exitCodes).toEqual([0]);
    expect(runtime.report().state).toBe('stopped');
  });
});
