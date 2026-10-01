import { afterAll, describe, expect, it, vi } from 'vitest';

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildProductionManifest,
  createProductionAssembly,
  createProductionRuntime,
} from '../src/main/production-assembly.js';
import { LIFECYCLE_ERROR_CODES } from '../src/loader/codes.js';
import { LoaderError } from '../src/loader/errors.js';
import { loadCpkDirectory } from '../src/loader/provider.js';
import type { IPluginActivationContext } from '../src/loader/activation.js';
import type { ICpkPluginLoader, ICpkPluginLoaderDeps } from '../src/loader/lifecycle.js';
import type { PluginRole } from '../src/loader/types.js';
import { RESERVED_DOCUMENT_CAPABILITIES } from '../src/runtime/capabilities/reserved.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';
import type { IHostCapabilityDescriptor } from '../src/runtime/capability/contracts.js';
import type { IPalHost, SystemInfo } from '../src/platform/contracts/index.js';
import type { HostRuntimeContext } from '../src/main/runtime-provider.js';

// 波 3 接线锁观测缝：透传包裹 `createCpkPluginLoader`，捕获组合根构造装载器的真实
// deps（生产实现零改动——mock 工厂全量透传 actual，仅记录调用）。
const capture = vi.hoisted(() => ({
  calls: [] as { readonly deps: ICpkPluginLoaderDeps; readonly loader: ICpkPluginLoader }[],
}));
vi.mock('../src/loader/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/loader/index.js')>();
  return {
    ...actual,
    createCpkPluginLoader: (deps: Parameters<typeof actual.createCpkPluginLoader>[0]) => {
      const loader = actual.createCpkPluginLoader(deps);
      capture.calls.push({ deps, loader });
      return loader;
    },
  };
});

function lastCaptured(): { readonly deps: ICpkPluginLoaderDeps; readonly loader: ICpkPluginLoader } {
  const last = capture.calls[capture.calls.length - 1];
  if (last === undefined) {
    throw new Error('组合根未构造装载器：捕获队列为空（接线缺位即测试失败，不静默）');
  }
  return last;
}

/** 收集型诊断口（断言原生绑定装载留痕用）。 */
function collectDiagnostics(): DiagnosticsSink & {
  entries: { level: 'warn' | 'error'; scope: string; message: string; details?: Readonly<Record<string, unknown>> }[];
} {
  const entries: {
    level: 'warn' | 'error';
    scope: string;
    message: string;
    details?: Readonly<Record<string, unknown>>;
  }[] = [];
  return {
    entries,
    warn(scope, message, details) {
      entries.push({ level: 'warn', scope, message, ...(details === undefined ? {} : { details }) });
    },
    error(scope, message, details) {
      entries.push({ level: 'error', scope, message, ...(details === undefined ? {} : { details }) });
    },
  };
}

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
    config: false,
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
    expect(manifest.map((d) => d.id)).toEqual(['system:info', 'event:publish', 'document:open']);
    expect(manifest[0]).toMatchObject({ id: 'system:info', permissions: [] });
    expect(manifest[2]).toMatchObject({ id: 'document:open', permissions: ['resources:read'] });
  });

  it('无外部提供方时清单只有内置能力（document:* 不在其中）', () => {
    const manifest = buildProductionManifest(host);
    expect(manifest.map((d) => d.id)).toEqual(['system:info', 'event:publish']);
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
      diagnostics: collectDiagnostics(),
    });
    expect(typeof assembly.createPalHost).toBe('function');
    expect(typeof assembly.createRuntime).toBe('function');
    const runtime = await assembly.createRuntime(context);
    await runtime.start(host, { pushSessionPermissions: () => undefined });
    expect(runtime.report().capabilities.active).toBe(3);
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

describe('生产组合根：原生绑定装载（工单 025 消费链接线点）', () => {
  const availableFixture = fileURLToPath(new URL('./fixtures/native-binding/available.js', import.meta.url));

  it('绑定不可用：诊断留痕 module-missing，运行时装配与启动不受影响（诚实回退臂）', async () => {
    const diagnostics = collectDiagnostics();
    const assembly = createProductionAssembly({
      createPalHost: () => host,
      nativeBridgeModulePath: '/tmp/chips-native-025-组合根-不存在.node',
      diagnostics,
    });
    const runtime = await assembly.createRuntime(context);
    await runtime.start(host, { pushSessionPermissions: () => undefined });
    expect(runtime.report().capabilities.active).toBe(2);

    const nativeEntries = diagnostics.entries.filter((entry) => entry.scope === 'native-bridge');
    expect(nativeEntries).toHaveLength(1);
    expect(nativeEntries[0]?.level).toBe('warn');
    expect(nativeEntries[0]?.message).toContain('工单 025 剩余项');
    expect(nativeEntries[0]?.details).toMatchObject({
      reason: 'module-missing',
      modulePath: '/tmp/chips-native-025-组合根-不存在.node',
    });
    await runtime.shutdown();
  });

  it('绑定可用（夹具面）：无原生域警告留痕，装配照常完成并进入运行', async () => {
    const diagnostics = collectDiagnostics();
    const assembly = createProductionAssembly({
      createPalHost: () => host,
      capabilityProviders: [documentProvider],
      nativeBridgeModulePath: availableFixture,
      diagnostics,
    });
    const runtime = await assembly.createRuntime(context);
    await runtime.start(host, { pushSessionPermissions: () => undefined });
    expect(runtime.report().capabilities.active).toBe(3);
    expect(diagnostics.entries.filter((entry) => entry.scope === 'native-bridge')).toEqual([]);
    await runtime.shutdown();
  });
});

// ---------------------------------------------------------------------------
// 波 3 组合根缺省接线锁（工单 025；RFC §3.2.2 S2 / §八 波 3 验收面）
// ---------------------------------------------------------------------------

/** 本组临时工作区（afterAll 统一清理）。 */
const wave3Workspaces: string[] = [];

async function makeWave3Workspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cpk-wave3-'));
  wave3Workspaces.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(wave3Workspaces.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** 开发目录态最小 service 插件源树（与生命周期套件同形夹具）。 */
async function writeWave3ServicePlugin(root: string, id: string, version: string): Promise<string> {
  const pluginRoot = join(root, `${id}-${version}`);
  await mkdir(join(pluginRoot, 'dist'), { recursive: true });
  await writeFile(
    join(pluginRoot, 'manifest.yaml'),
    `id: ${id}\nversion: ${version}\ntype: service\nname: 波3接线示例\nruntime:\n  targets: [host]\n  background: true\n`,
    'utf8',
  );
  await writeFile(join(pluginRoot, 'dist', 'index.js'), 'export const ready = true;\n', 'utf8');
  return pluginRoot;
}

function makeStubActivationContext(pluginId: string, role: PluginRole): IPluginActivationContext {
  return {
    pluginId,
    version: '0.1.0',
    role,
    config: Object.freeze({}),
    signal: new AbortController().signal,
    registerCapability: () => undefined,
    unregisterCapability: () => undefined,
    publishEvent: () => undefined,
    registeredCapabilities: () => [],
  };
}

const ALL_ROLES: readonly PluginRole[] = ['basecard', 'boxlayout', 'app', 'service'];

describe('波 3 组合根缺省接线：activationPort 为真实端口（工单 025）', () => {
  it('装配后装载器 deps 携缺省 activationPortFor：四角色端口恒在，绝非 undefined', async () => {
    const workspace = await makeWave3Workspace();
    const wave3Context: HostRuntimeContext = {
      palHost: host,
      platformRoot: '/tmp/platform',
      userDataPath: workspace,
    };
    const assembly = createProductionAssembly({
      createPalHost: () => host,
      diagnostics: collectDiagnostics(),
    });
    const runtime = await assembly.createRuntime(wave3Context);
    const { deps } = lastCaptured();
    const portFor = deps.activationPortFor;
    if (portFor === undefined) {
      throw new Error('波 3 缺省接线缺位：deps.activationPortFor 未注入');
    }
    for (const role of ALL_ROLES) {
      const port = portFor({
        id: `chips.example.wire3.${role}`,
        version: '0.1.0',
        role,
        path: join(workspace, role),
      });
      expect(port).toBeDefined();
      expect(port).toHaveProperty('apply');
      expect(port).toHaveProperty('stop');
    }
    await runtime.shutdown();
  });

  it('失败语义逐码（apply 面经真实通道）：未在册 ID → KERNEL_PLUGIN_NOT_FOUND；身份错位 → stage=role；全程无 BRIDGE_INTERNAL 回退臂', async () => {
    const workspace = await makeWave3Workspace();
    const wave3Context: HostRuntimeContext = {
      palHost: host,
      platformRoot: '/tmp/platform',
      userDataPath: workspace,
    };
    const assembly = createProductionAssembly({
      createPalHost: () => host,
      diagnostics: collectDiagnostics(),
    });
    const runtime = await assembly.createRuntime(wave3Context);
    const { deps } = lastCaptured();
    const portFor = deps.activationPortFor;
    if (portFor === undefined) {
      throw new Error('波 3 缺省接线缺位：deps.activationPortFor 未注入');
    }
    for (const role of ALL_ROLES) {
      const ghostId = `chips.example.ghost.${role}`;
      const port = portFor({ id: ghostId, version: '0.1.0', role, path: join(workspace, role) });
      if (port === undefined) {
        throw new Error(`缺省通道未出端口：role=${role}（波 3 直连恒出端口，undefined 即接线缺陷）`);
      }
      let caught: unknown;
      try {
        await port.apply(makeStubActivationContext(ghostId, role));
      } catch (error) {
        caught = error;
      }
      // 真实通道取数：注册表未命中报在册码（旧接线此路径只能是 BRIDGE_INTERNAL）。
      expect(caught).toBeInstanceOf(LoaderError);
      expect((caught as LoaderError).code).toBe(LIFECYCLE_ERROR_CODES.pluginNotFound);
    }
    // 端口-上下文身份一致守卫（装配错位确定性拒绝）。
    const mismatchPort = portFor({
      id: 'chips.example.bound',
      version: '0.1.0',
      role: 'service',
      path: join(workspace, 'bound'),
    });
    if (mismatchPort === undefined) {
      throw new Error('缺省通道未出端口：身份错位用例（波 3 直连恒出端口，undefined 即接线缺陷）');
    }
    let mismatchCaught: unknown;
    try {
      await mismatchPort.apply(makeStubActivationContext('chips.example.other', 'service'));
    } catch (error) {
      mismatchCaught = error;
    }
    expect((mismatchCaught as LoaderError).code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
    expect((mismatchCaught as LoaderError).details).toMatchObject({
      stage: 'role',
      reason: 'context-plugin-mismatch',
    });
    await runtime.shutdown();
  });

  it('enable 面通道即通：在装 development service 插件经真实通道装载，失败语义为波 1 门禁逐码（stage=channel），绝不落回退臂', async () => {
    const workspace = await makeWave3Workspace();
    const wave3Context: HostRuntimeContext = {
      palHost: host,
      platformRoot: '/tmp/platform',
      userDataPath: workspace,
    };
    const assembly = createProductionAssembly({
      createPalHost: () => host,
      diagnostics: collectDiagnostics(),
    });
    const runtime = await assembly.createRuntime(wave3Context);
    const { loader } = lastCaptured();
    const id = 'chips.example.wire3.live';
    const pluginRoot = await writeWave3ServicePlugin(workspace, id, '0.1.0');
    const pkg = await loadCpkDirectory(pluginRoot);
    await loader.install({ pkg, source: 'development' });
    let caught: unknown;
    try {
      await loader.enable(id);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoaderError);
    const loaderError = caught as LoaderError;
    expect(loaderError.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
    // vitest 代管 import 下波 1 通道活性 fail-closed（真实失败，不在 vitest 内冒充
    // 成功；正向全链由波 2 F 组真 Node 子进程套件锁定）。旧接线此处只能是 BRIDGE_INTERNAL。
    expect(loaderError.details).toMatchObject({ stage: 'channel', reason: 'not-live' });
    const failed = loader.get(id);
    expect(failed?.state).toBe('failed');
    expect(failed?.lastError).toMatchObject({ code: LIFECYCLE_ERROR_CODES.applyFailed });
    expect(failed?.lastError?.code).not.toBe('BRIDGE_INTERNAL');
    await runtime.shutdown();
  });

  it('缺省接线零启动副作用：通道构造不触盘（会话目录惰性建立）', async () => {
    const workspace = await makeWave3Workspace();
    // 预置判据目录：装配期除注册表文件外不得有任何新增落盘。
    const pluginsDir = join(workspace, 'chips-plugins');
    await mkdir(pluginsDir, { recursive: true });
    await writeFile(join(pluginsDir, 'marker.txt'), '波3接线判据：装配期零新增落盘\n', 'utf8');
    const wave3Context: HostRuntimeContext = {
      palHost: host,
      platformRoot: '/tmp/platform',
      userDataPath: workspace,
    };
    const assembly = createProductionAssembly({
      createPalHost: () => host,
      diagnostics: collectDiagnostics(),
    });
    const runtime = await assembly.createRuntime(wave3Context);
    // 装配完成后未发生任何装载：激活会话目录首载才建（`module-loader.ts`
    // `ensureSession` 惰性口径），注册表文件之外零新增。
    const after = (await readdir(pluginsDir)).filter((name) => name !== 'registry.json').sort();
    expect(after).toEqual(['marker.txt']);
    expect(await readFile(join(pluginsDir, 'marker.txt'), 'utf8')).toContain('零新增落盘');
    await runtime.shutdown();
  });

  it('显式覆盖位（S6）：pluginActivationPortFor 注入时优先于缺省通道', async () => {
    const workspace = await makeWave3Workspace();
    const wave3Context: HostRuntimeContext = {
      palHost: host,
      platformRoot: '/tmp/platform',
      userDataPath: workspace,
    };
    const override = vi.fn(() => ({
      apply: (): Promise<void> => Promise.resolve(),
      stop: (): Promise<void> => Promise.resolve(),
    }));
    const assembly = createProductionAssembly({
      createPalHost: () => host,
      pluginActivationPortFor: override,
      diagnostics: collectDiagnostics(),
    });
    const runtime = await assembly.createRuntime(wave3Context);
    const { deps } = lastCaptured();
    expect(deps.activationPortFor).toBe(override);
    await runtime.shutdown();
  });
});
