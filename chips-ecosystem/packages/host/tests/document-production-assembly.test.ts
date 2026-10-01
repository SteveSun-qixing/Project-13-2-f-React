/**
 * 金链路刀4a：`packages/host` 组合根文档能力接线测试。
 *
 * 权威：`11-文档服务设计` §二（端口边界与组合根装配）、§九（权限判定每调用查询）、
 * `05-事件契约规范` §4.2（文档事件 payload）、`03-核心接口规范` §6.4（解析导出面）、
 * `04-能力契约规范` document:* 四能力。
 *
 * @remarks
 * - 装载闸正/负两臂：解析域产物经真实 `loadNativeDocumentParserBinding`（17 必备名
 *   fail-closed 闸）判定——行为面夹具（`parser-document-behavior.js`）过闸为正臂，
 *   不存在路径（`module-missing`）与 Bridge 域夹具（`surface-mismatch`，逐项点名缺位
 *   导出）为负臂；守卫快照与资源端口注入面逐项缺位记录同样验证。
 * - 正向端到端走 `createProductionAssembly` 正式通道：`document:*` 四能力经
 *   `createDocumentCapabilityDescriptors` → `createDocumentService` 真实路由，宿主事件
 *   总线（`emitEvent` 出口）绑定经 `pluginLoaderFactory` 构造期完成，事件信封按 §4.2
 *   形状在 sink 侧观察；脏保存经 `documentSerialize` 序列化 → 注入的 storage 端口
 *   `commit` 真实落账，`document:changed/saved` 事件按序发布（工单036 波 C3 终闸翻正
 *   形——刀6 诚实拒绝臂已退役，快照见 `chips-ecosystem/归档/工单036-诚实回退臂退役-波C3/`）。
 * - 诚实回退臂：依赖缺位时不注册 `document:*`，调用得到真实注册表未命中
 *   `BRIDGE_CAPABILITY_NOT_FOUND`、预留槽位 `wired=false`、诊断留痕逐项点名。
 */

import { describe, expect, it } from 'vitest';

import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { createProductionAssembly } from '../src/main/production-assembly.js';
import {
  DOCUMENT_WIRING_DIAGNOSTIC_SCOPE,
  createDocumentCapabilityWiring,
  type IDocumentCapabilityWiringOptions,
  type IDocumentResourcePorts,
} from '../src/capabilities/document/adapters/production-wiring.js';
import {
  createDocumentBridgeSessionGuardPort,
  type DocumentGuardSessionSource,
  type IDocumentGuardSessionView,
} from '../src/capabilities/document/adapters/bridge-session-guard.js';
import { createDocumentHostEventBusPort } from '../src/capabilities/document/adapters/host-event-bus.js';
import { DOCUMENT_EVENT_IDS } from '../src/capabilities/document/contract.js';
import { computePackageContentDigest } from '../src/capabilities/document/digest.js';
import type { IEventEnvelope } from '../src/protocol/wire.js';
import type { IEventSink } from '../src/runtime/contracts.js';
import type { IHostRuntime } from '../src/runtime/host-runtime.js';
import type { IHostCapabilityDescriptor } from '../src/runtime/capability/contracts.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';
import type { IPalHost, SystemInfo } from '../src/platform/contracts/index.js';
import type { HostRuntimeContext } from '../src/main/runtime-provider.js';
import type {
  IDocumentCommitRequest,
  IDocumentScopePort,
  IDocumentScopeRegistration,
  IDocumentStoragePort,
  IResolvedDocumentSource,
} from '../src/capabilities/document/ports.js';

/** 与 `parser-document-behavior.js` 夹具逐字一致的基线常量（受管引用 → 本地路径映射同源）。 */
const CARD_ID = 'Ab3dEf6Gh8';
const NODE_ID_ONE = 'Cd1eFg2Hi3';
const NODE_ID_TWO = 'Jk4lMn5Op6';
const CARD_URI = `chips-resource://default/card/${CARD_ID}.card`;
const CARD_PATH = '/fake/prod-card.card';

const CARD_METADATA = {
  chip_standards_version: '1.0.0',
  card_id: CARD_ID,
  name: '生产接线卡片',
  created_at: '2026-01-02T03:04:05Z',
  modified_at: '2026-01-02T03:04:05Z',
};

const CARD_STRUCTURE = {
  structure: [
    { id: NODE_ID_ONE, type: 'text', title: '第一块' },
    { id: NODE_ID_TWO, type: 'image', title: '第二块' },
  ],
  manifest: { card_count: 2, resource_count: 0 },
};

const CONTENT_ONE = { text: '第一块内容' };
const CONTENT_TWO = { text: '第二块内容' };

/** 夹具磁盘基线的「包内成员 → 文本」集合（fake storage 摘要复算与夹具指纹同源）。 */
const DISK_MEMBERS: readonly { readonly packagePath: string; readonly text: string }[] = [
  { packagePath: 'meta.yaml', text: JSON.stringify(CARD_METADATA) },
  { packagePath: 'structure.yaml', text: JSON.stringify(CARD_STRUCTURE) },
  { packagePath: `content/${NODE_ID_ONE}.yaml`, text: JSON.stringify(CONTENT_ONE) },
  { packagePath: `content/${NODE_ID_TWO}.yaml`, text: JSON.stringify(CONTENT_TWO) },
];

const ENCODER = new TextEncoder();
const BRIDGE_AVAILABLE_FIXTURE = fileURLToPath(new URL('./fixtures/native-binding/available.js', import.meta.url));
const RESOURCE_AVAILABLE_FIXTURE = fileURLToPath(
  new URL('./fixtures/native-binding/resource-available.js', import.meta.url),
);
const PARSER_BEHAVIOR_FIXTURE = fileURLToPath(
  new URL('./fixtures/native-binding/parser-document-behavior.js', import.meta.url),
);

/** 收集型诊断口（与 `production-assembly.test.ts` 同型）。 */
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

const context: HostRuntimeContext = { palHost: host, platformRoot: '/tmp/platform', userDataPath: '/tmp/user' };

/** 壳主框架会话源（路由侧会话 `session:1:main`，与守卫快照视图同键）。 */
const SENDER = { windowId: 1, frameId: null };

/** chips-resource 端口注入面的最小替身（正式 scope 适配器已在册：波 A2b-β 装载段以资源域消费面构造，本替身只承载显式覆盖口通道形状；仅测试使用，生产禁止内存替身，工单 036）。 */
function makeResourcePorts(): IDocumentResourcePorts & {
  readonly registrations: { documentId: string; managedUri: string; kind: string }[];
  readonly unregistrations: { documentId: string; managedUri: string }[];
  readonly commits: IDocumentCommitRequest[];
} {
  const registrations: { documentId: string; managedUri: string; kind: string }[] = [];
  const unregistrations: { documentId: string; managedUri: string }[] = [];
  const commits: IDocumentCommitRequest[] = [];
  /** 替身自持的登记凭号（模拟原生 `resourceOpenSession` 回执；INV-1：记录面只承接本回执）。 */
  let nativeSession = 0;
  const scope: IDocumentScopePort = {
    normalizeSource(source: string): Promise<IResolvedDocumentSource> {
      if (source !== CARD_URI) {
        return Promise.reject(
          Object.assign(new Error('夹具未登记该来源'), { code: 'RESOURCE_NOT_FOUND', retryable: false }),
        );
      }
      return Promise.resolve({ managedUri: CARD_URI, localPath: CARD_PATH, form: 'directory' });
    },
    registerScope(input: {
      documentId: string;
      managedUri: string;
      kind: 'card' | 'box';
    }): Promise<IDocumentScopeRegistration> {
      registrations.push({ documentId: input.documentId, managedUri: input.managedUri, kind: input.kind });
      nativeSession += 1;
      return Promise.resolve({ nativeSession });
    },
    unregisterScope(input: { documentId: string; managedUri: string }): Promise<void> {
      // 两拍第①拍在注入面的触达记录（波 A2b-β 接线：会话释放与打开失败回收一律经端口注销；
      // 真两拍行为面见 `document-scope-adapter.test.ts` / `document-scope-lifecycle.test.ts`）。
      unregistrations.push(input);
      return Promise.resolve();
    },
    // 点位三正向取回替身（波 B2）：服务侧每次磁盘触达现取，替身恒给夹具登记的路径。
    localPathOf(managedUri: string): Promise<string> {
      if (managedUri !== CARD_URI) {
        return Promise.reject(
          Object.assign(new Error('夹具未登记该受管引用'), { code: 'RESOURCE_NOT_FOUND', retryable: false }),
        );
      }
      return Promise.resolve(CARD_PATH);
    },
    scopeRootOf(managedUri: string): string | null {
      return managedUri === CARD_URI ? 'chips-resource://default/' : null;
    },
  };
  const storage: IDocumentStoragePort = {
    commit(request: IDocumentCommitRequest): Promise<void> {
      commits.push(request);
      return Promise.resolve();
    },
    listMembers(localPath: string): Promise<readonly { packagePath: string; bytes: Uint8Array }[]> {
      if (localPath !== CARD_PATH) {
        return Promise.reject(
          Object.assign(new Error('夹具未登记该包根'), { code: 'RESOURCE_NOT_FOUND', retryable: false }),
        );
      }
      return Promise.resolve(
        DISK_MEMBERS.map((member) => ({ packagePath: member.packagePath, bytes: ENCODER.encode(member.text) })),
      );
    },
    readFileBytes(): Promise<Uint8Array> {
      return Promise.reject(
        Object.assign(new Error('归档态读取未用出'), { code: 'RESOURCE_PATH_INVALID', retryable: false }),
      );
    },
  };
  return { scope, storage, registrations, unregistrations, commits };
}

/** 组装一个覆盖当前壳会话的守卫快照提供者。 */
function guardSource(views: readonly IDocumentGuardSessionView[]): DocumentGuardSessionSource {
  return () => views;
}

/** 活跃且授予读写权限的默认快照（正向臂）。 */
function activeGuard(): DocumentGuardSessionSource {
  return guardSource([
    {
      sessionId: 'session:1:main',
      state: 'active',
      grantedPermissions: new Set<string>(['resources:read', 'resources:write']),
    },
  ]);
}

/** 经正式组合根通道装配运行时（`nativeBridgeModulePath` 用 Bridge 域夹具过闸，聚焦文档侧）。 */
async function startAssemblyRuntime(documentWiring?: IDocumentCapabilityWiringOptions): Promise<{
  runtime: IHostRuntime;
  diagnostics: ReturnType<typeof collectDiagnostics>;
}> {
  const diagnostics = collectDiagnostics();
  const assembly = createProductionAssembly({
    createPalHost: () => host,
    nativeBridgeModulePath: BRIDGE_AVAILABLE_FIXTURE,
    ...(documentWiring === undefined ? {} : { documentWiring }),
    diagnostics,
  });
  const runtime = await assembly.createRuntime(context);
  await runtime.start(host, { pushSessionPermissions: () => undefined });
  return { runtime, diagnostics };
}

/** 订阅文档事件并收集下行信封。 */
async function collectEventEnvelopes(runtime: IHostRuntime): Promise<{
  envelopes: { windowId: number; envelope: IEventEnvelope }[];
  stop: () => void;
}> {
  const envelopes: { windowId: number; envelope: IEventEnvelope }[] = [];
  const sink: IEventSink = {
    deliver(windowId: number, envelope: IEventEnvelope): void {
      envelopes.push({ windowId, envelope });
    },
  };
  const stop = runtime.forwardEvents(sink);
  for (const eventId of Object.values(DOCUMENT_EVENT_IDS)) {
    const control = await runtime.ipc.handleEventControl(SENDER, {
      controlId: `sub-${eventId}`,
      action: 'subscribe',
      eventId,
    });
    expect(control.ok).toBe(true);
  }
  return { envelopes, stop };
}

describe('组合根文档装载段：装载闸负臂（逐项缺位，诚实呈现）', () => {
  it('解析域产物不存在：missing 逐项点名 parser（module-missing），其余注入齐备也不装载', () => {
    const diagnostics = collectDiagnostics();
    const wiring = createDocumentCapabilityWiring(
      {
        parserModulePath: '/tmp/chips-native-刀4a-不存在.node',
        guardSessionSource: activeGuard(),
        resourcePorts: makeResourcePorts(),
      },
      context,
      diagnostics,
    );
    expect(wiring.status).toBe('unavailable');
    expect(wiring.descriptors).toEqual([]);
    expect(wiring.missing).toHaveLength(1);
    expect(wiring.missing[0]).toMatchObject({ port: 'parser' });
    expect(wiring.missing[0]?.reason).toContain('module-missing');
    expect(diagnostics.entries).toHaveLength(1);
    expect(diagnostics.entries[0]).toMatchObject({ level: 'warn', scope: DOCUMENT_WIRING_DIAGNOSTIC_SCOPE });
    expect(diagnostics.entries[0]?.details).toMatchObject({
      modulePath: '/tmp/chips-native-刀4a-不存在.node',
    });
  });

  it('解析域产物面漂移（Bridge 域夹具）：surface-mismatch 逐项点名缺位导出，不静默降级', () => {
    const wiring = createDocumentCapabilityWiring(
      {
        parserModulePath: BRIDGE_AVAILABLE_FIXTURE,
        guardSessionSource: activeGuard(),
        resourcePorts: makeResourcePorts(),
      },
      context,
      collectDiagnostics(),
    );
    expect(wiring.status).toBe('unavailable');
    expect(wiring.missing.map((entry) => entry.port)).toEqual(['parser']);
    const reason = wiring.missing[0]?.reason ?? '';
    expect(reason).toContain('surface-mismatch');
    for (const exportName of ['openDocument', 'documentRevision', 'documentLayoutConfig']) {
      expect(reason).toContain(exportName);
    }
  });

  it('守卫快照提供者缺位（直接调用装载段）：missing 只点名 guard（不做本地替身），解析与资源端口齐备不豁免', () => {
    const wiring = createDocumentCapabilityWiring(
      { parserModulePath: PARSER_BEHAVIOR_FIXTURE, resourcePorts: makeResourcePorts() },
      context,
      collectDiagnostics(),
    );
    expect(wiring.status).toBe('unavailable');
    expect(wiring.missing.map((entry) => entry.port)).toEqual(['guard']);
    expect(wiring.missing[0]?.reason).toContain('不做本地替身');
  });

  it('资源端口缺位：missing 点名 scope + storage 并援引工单 036（禁止内存替身）', () => {
    const wiring = createDocumentCapabilityWiring(
      { parserModulePath: PARSER_BEHAVIOR_FIXTURE, guardSessionSource: activeGuard() },
      context,
      collectDiagnostics(),
    );
    expect(wiring.status).toBe('unavailable');
    expect(wiring.missing.map((entry) => entry.port)).toEqual(['scope', 'storage']);
    expect(wiring.missing.every((entry) => entry.reason.includes('工单 036'))).toBe(true);
  });

  it('真实生产缺省（无任何注入）：四项硬依赖全部点名，回退臂不产出注册单元', () => {
    const wiring = createDocumentCapabilityWiring(undefined, context, collectDiagnostics());
    expect(wiring.status).toBe('unavailable');
    expect(wiring.missing.map((entry) => entry.port)).toEqual(['parser', 'guard', 'scope', 'storage']);
    expect(wiring.descriptors).toEqual([]);
    // 未装载臂的总线绑定是 no-op（不抛错、不造假）。
    expect(() => wiring.bindEventBus(() => undefined)).not.toThrow();
  });
});

describe('组合根文档装载段：装载闸正臂（依赖齐备即装配）', () => {
  it('解析域过闸 + 守卫快照 + 资源端口注入 → 产出四条注册单元', () => {
    const wiring = createDocumentCapabilityWiring(
      {
        parserModulePath: PARSER_BEHAVIOR_FIXTURE,
        guardSessionSource: activeGuard(),
        resourcePorts: makeResourcePorts(),
      },
      context,
      collectDiagnostics(),
    );
    expect(wiring.status).toBe('wired');
    expect(wiring.missing).toEqual([]);
    expect(wiring.descriptors.map((descriptor: IHostCapabilityDescriptor) => descriptor.id)).toEqual([
      'document:open',
      'document:read',
      'document:write',
      'document:save',
    ]);
  });

  it('工单036 波 C3：资源域导出面过闸即以正式适配器装配（无 resourcePorts 注入臂）', () => {
    const wiring = createDocumentCapabilityWiring(
      {
        parserModulePath: PARSER_BEHAVIOR_FIXTURE,
        resourceModulePath: RESOURCE_AVAILABLE_FIXTURE,
        guardSessionSource: activeGuard(),
      },
      context,
      collectDiagnostics(),
    );
    expect(wiring.status).toBe('wired');
    expect(wiring.missing).toEqual([]);
    expect(wiring.resourceBinding.status).toBe('available');
    // 四条注册单元由 scope（波 A2b）+ storage（波 C3）两正式适配器承载，零注入。
    expect(wiring.descriptors.map((descriptor: IHostCapabilityDescriptor) => descriptor.id)).toEqual([
      'document:open',
      'document:read',
      'document:write',
      'document:save',
    ]);
  });

  it('工单036 波 C3：资源域导出面为 C3 前旧构建（缺提交链两名）→ scope+storage 仍缺位，点名理由含两名', () => {
    const wiring = createDocumentCapabilityWiring(
      {
        parserModulePath: PARSER_BEHAVIOR_FIXTURE,
        resourceModulePath: fileURLToPath(new URL('./fixtures/native-binding/resource-stale-22.js', import.meta.url)),
        guardSessionSource: activeGuard(),
      },
      context,
      collectDiagnostics(),
    );
    expect(wiring.status).toBe('unavailable');
    expect(wiring.missing.map((entry) => entry.port)).toEqual(['scope', 'storage']);
    // storage 缺位理由点名 C3 补登两名（判据随波机械补登的执行形态）。
    expect(wiring.missing.find((entry) => entry.port === 'storage')?.reason).toContain('resourceCommitChangeset');
    expect(wiring.missing.find((entry) => entry.port === 'storage')?.reason).toContain('resourceRebuildArchive');
  });
});

describe('组合根运行时：诚实回退臂维持真实注册表未命中语义', () => {
  it('无注入（当前真实生产判据）：document:* 不注册，调用得 BRIDGE_CAPABILITY_NOT_FOUND，槽位 wired=false', async () => {
    const { runtime, diagnostics } = await startAssemblyRuntime(undefined);
    const report = runtime.report();
    // 内置 2（system/event）+ 资源打开路由域 2（工单036 残段 T4 恒注册）。
    expect(report.capabilities.active).toBe(4);
    expect(report.capabilities.byDomain['document'] ?? 0).toBe(0);
    expect(report.reserved.every((item) => item.wired === false)).toBe(true);

    const response = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'fallback-1',
      capabilityId: 'document:open',
      input: { source: CARD_URI },
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
    }

    const wiringEntries = diagnostics.entries.filter((entry) => entry.scope === DOCUMENT_WIRING_DIAGNOSTIC_SCOPE);
    expect(wiringEntries).toHaveLength(1);
    expect(wiringEntries[0]?.message).toContain('诚实回退臂');
    const missing = (wiringEntries[0]?.details as { missing?: { port: string }[] }).missing ?? [];
    // 口径翻正（工单036 §五.3-1 / 刀4 缝①）：`guard` 不再点名——组合根已把守卫快照提供者
    // 正式默认绑定到本运行时会话登记表；仍缺位的是解析域产物与资源域两端口。
    expect(missing.map((entry) => entry.port)).toEqual(['parser', 'scope', 'storage']);
    expect(missing.every((entry) => entry.port !== 'guard')).toBe(true);
    await runtime.shutdown();
  });
});

describe('组合根运行时：依赖齐备臂四能力真实路由到 createDocumentService', () => {
  it('open→read→no-op save→write→save 全链路：解析调用、事件信封、刀6 诚实序列化拒绝逐项可观察', async () => {
    const resourcePorts = makeResourcePorts();
    // 与装载闸同一 require 缓存取夹具调用记录（`createRequire` 与
    // `loadNativeDocumentParserBinding` 的加载路径逐字一致）。
    const requireFixture = createRequire(import.meta.url);
    const fixtureModule = requireFixture(PARSER_BEHAVIOR_FIXTURE) as {
      __calls: { export: string; args: Record<string, unknown> }[];
    };
    const callsBefore = fixtureModule.__calls.length;
    const { runtime, diagnostics } = await startAssemblyRuntime({
      parserModulePath: PARSER_BEHAVIOR_FIXTURE,
      guardSessionSource: activeGuard(),
      resourcePorts,
    });

    // 注册面：四条 document:* 覆盖预留槽位（wired=true），加内置 system:info 与
    // 资源打开路由域两能力（工单036 T4）共 8 条。
    const report = runtime.report();
    expect(report.capabilities.active).toBe(8);
    expect(report.capabilities.byDomain['document']).toBe(4);
    expect(report.reserved.every((item) => item.wired === true)).toBe(true);
    // 装载段无缺位留痕。
    expect(diagnostics.entries.filter((entry) => entry.scope === DOCUMENT_WIRING_DIAGNOSTIC_SCOPE)).toEqual([]);

    const { envelopes, stop } = await collectEventEnvelopes(runtime);

    // ① document:open：真解析臂（openCard→metadata→revision）+ 作用域注册 + opened 事件。
    const opened = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'wired-open',
      capabilityId: 'document:open',
      input: { source: CARD_URI },
    });
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.result).toMatchObject({
        documentId: CARD_ID,
        source: CARD_URI,
        kind: 'card',
        title: '生产接线卡片',
      });
      expect(typeof (opened.result as { digest: unknown }).digest).toBe('string');
    }
    expect(resourcePorts.registrations).toEqual([{ documentId: CARD_ID, managedUri: CARD_URI, kind: 'card' }]);
    const openedEvents = envelopes.filter((entry) => entry.envelope.eventId === DOCUMENT_EVENT_IDS.opened);
    expect(openedEvents).toHaveLength(1);
    // `05-事件契约规范` §4.2：payload 恰为 { uri, kind, title }。
    const openedPayload = openedEvents[0]?.envelope.payload as Record<string, unknown>;
    expect(Object.keys(openedPayload).sort()).toEqual(['kind', 'title', 'uri']);
    expect(openedPayload).toEqual({ uri: CARD_URI, kind: 'card', title: '生产接线卡片' });
    expect(openedEvents[0]?.windowId).toBe(1);

    // ② document:read：结构切片经原生端口惰性读取。
    const read = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'wired-read',
      capabilityId: 'document:read',
      input: { documentId: CARD_ID, part: 'structure' },
    });
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect((read.result as { value: unknown }).value).toEqual(CARD_STRUCTURE);
    }

    // ③ no-op save（§4.5 步骤 1）：不落盘、不发布事件，摘要从磁盘（注入的资源端口）复算。
    const noOpSave = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'wired-save-noop',
      capabilityId: 'document:save',
      input: { documentId: CARD_ID },
    });
    expect(noOpSave.ok).toBe(true);
    if (noOpSave.ok) {
      expect((noOpSave.result as { source: unknown }).source).toBe(CARD_URI);
      expect((noOpSave.result as { digest: unknown }).digest).toBe(
        computePackageContentDigest(
          DISK_MEMBERS.map((member) => ({ packagePath: member.packagePath, bytes: ENCODER.encode(member.text) })),
        ),
      );
    }
    expect(resourcePorts.commits).toEqual([]);
    expect(envelopes.filter((entry) => entry.envelope.eventId !== DOCUMENT_EVENT_IDS.opened)).toEqual([]);

    // ④ document:write：指纹复查经真解析端口（fingerprint 复合臂 openDocument+revision+close），
    //    只改内存模型、不落盘不发事件（§4.2）。
    const write = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'wired-write',
      capabilityId: 'document:write',
      input: { documentId: CARD_ID, part: 'content', nodeId: NODE_ID_ONE, value: { text: '组合根改写' } },
    });
    expect(write.ok).toBe(true);
    const readBack = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'wired-read-after-write',
      capabilityId: 'document:read',
      input: { documentId: CARD_ID, part: 'content', nodeId: NODE_ID_ONE },
    });
    expect(readBack.ok).toBe(true);
    if (readBack.ok) {
      expect((readBack.result as { value: unknown }).value).toEqual({ text: '组合根改写' });
    }
    expect(envelopes.filter((entry) => entry.envelope.eventId !== DOCUMENT_EVENT_IDS.opened)).toEqual([]);

    // ⑤ 脏 save（工单036 波 C3 终闸）：写租约与指纹复查通过后，序列化臂真经
    //    `documentSerialize`，提交经注入的 storage 端口 `commit` 落账，保存回执
    //    `{ source, digest }`、`document:changed`/`document:saved` 按序发布（§4.2）。
    const save = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'wired-save-dirty',
      capabilityId: 'document:save',
      input: { documentId: CARD_ID },
    });
    expect(save.ok).toBe(true);
    if (save.ok) {
      expect((save.result as { source: unknown }).source).toBe(CARD_URI);
      expect((save.result as { digest: unknown }).digest).toBe(
        computePackageContentDigest(
          DISK_MEMBERS.map((member) => ({ packagePath: member.packagePath, bytes: ENCODER.encode(member.text) })),
        ),
      );
    }
    // 提交唯一落盘通道：一次 commit，成员含修订内容成员，路径升序、目录态臂。
    expect(resourcePorts.commits).toHaveLength(1);
    const commit = resourcePorts.commits[0];
    expect(commit?.form).toBe('directory');
    expect(commit?.removals).toEqual([]);
    expect(commit?.members.map((member) => member.packagePath)).toEqual([
      'content/Cd1eFg2Hi3.yaml',
      'content/Jk4lMn5Op6.yaml',
      'meta.yaml',
      'structure.yaml',
    ]);
    const revisedMember = commit?.members.find((member) => member.packagePath === 'content/Cd1eFg2Hi3.yaml');
    expect(JSON.parse(new TextDecoder().decode(revisedMember?.bytes ?? new Uint8Array()))).toEqual({
      text: '组合根改写',
    });
    // 事件按序：changed（digest/size 摘要复算面）→ saved。
    const changedEvents = envelopes.filter((entry) => entry.envelope.eventId === DOCUMENT_EVENT_IDS.changed);
    const savedEvents = envelopes.filter((entry) => entry.envelope.eventId === DOCUMENT_EVENT_IDS.saved);
    expect(changedEvents).toHaveLength(1);
    expect(savedEvents).toHaveLength(1);
    const changedPayload = changedEvents[0]?.envelope.payload as Record<string, unknown>;
    expect(Object.keys(changedPayload).sort()).toEqual(['digest', 'documentId', 'kind', 'size', 'uri']);
    expect(changedPayload).toMatchObject({ uri: CARD_URI, documentId: CARD_ID, kind: 'card' });
    expect(savedEvents[0]?.envelope.payload).toEqual({ uri: CARD_URI, kind: 'card' });

    // 解析调用形态逐路可观察：open 走严格 openCard 入口，save 走 fingerprint 复合臂、
    // 结构/内容读取与 documentSerialize 序列化载体（工单036 波 C3）。
    const newCalls = fixtureModule.__calls.slice(callsBefore).map((call) => call.export);
    expect(newCalls).toContain('openCard');
    expect(newCalls).toContain('documentRevision');
    expect(newCalls).toContain('openDocument'); // fingerprint 复合臂
    expect(newCalls).toContain('documentClose'); // 复合臂 finally 回收
    expect(newCalls).toContain('documentStructure'); // save 前序列化请求组装
    expect(newCalls).toContain('documentSerialize'); // 序列化载体真经原生导出
    stop();
    await runtime.shutdown();
    // 主进程退出清理（工单036 波 A2b-β）：停机链在会话关闭联动后**等待**文档释放收口，
    // 记录驱逐的两拍第①拍（端口 `unregisterScope`）在 `shutdown()` 返回前即已触达。
    expect(resourcePorts.unregistrations).toEqual([{ documentId: CARD_ID, managedUri: CARD_URI }]);
  });

  it('守卫快照正式默认绑定（刀4 缝① / 工单036 §五.3-1）：不注入覆盖口即装载成功，判定输入就是本运行时会话登记表', async () => {
    const resourcePorts = makeResourcePorts();
    // 关键差异：本臂**不**注入 `guardSessionSource`——组合根把运行时 `sessionPermissionSnapshots()`
    // 作为默认来源绑定，装载闸的 guard 判据自此在生产通道恒可得。
    const { runtime, diagnostics } = await startAssemblyRuntime({
      parserModulePath: PARSER_BEHAVIOR_FIXTURE,
      resourcePorts,
    });
    // 无缺位留痕、四能力注册（+ 内置 system:info + 资源打开路由域两能力 = 8）。
    expect(diagnostics.entries.filter((entry) => entry.scope === DOCUMENT_WIRING_DIAGNOSTIC_SCOPE)).toEqual([]);
    expect(runtime.report().capabilities.active).toBe(8);
    expect(runtime.report().reserved.every((item) => item.wired === true)).toBe(true);
    // 调用前会话登记表为空（快照如实反映，不猜授权）。
    expect(runtime.sessionPermissionSnapshots()).toEqual([]);

    const opened = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'guard-default-1',
      capabilityId: 'document:open',
      input: { source: CARD_URI },
    });
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.result).toMatchObject({ documentId: CARD_ID, kind: 'card' });
    }
    // 判定输入即登记表实态：路由侧懒建的壳会话（平台全量授权）在快照中逐字可见。
    const snapshot = runtime.sessionPermissionSnapshots().find((item) => item.sessionId === 'session:1:main');
    expect(snapshot?.state).toBe('active');
    expect([...(snapshot?.grantedPermissions ?? [])]).toEqual(['*']);
    expect(resourcePorts.registrations).toEqual([{ documentId: CARD_ID, managedUri: CARD_URI, kind: 'card' }]);
    await runtime.shutdown();
    expect(runtime.sessionPermissionSnapshots()[0]?.state).toBe('closed');
    // 停机收口的两拍第①拍（退出清理不得跑在资源注销之前）。
    expect(resourcePorts.unregistrations).toEqual([{ documentId: CARD_ID, managedUri: CARD_URI }]);
  });

  it('显式覆盖口优先级（S6）：注入空快照源后，登记表已有活跃会话仍被服务复查拒绝（每调用查询，不缓存）', async () => {
    const { runtime } = await startAssemblyRuntime({
      parserModulePath: PARSER_BEHAVIOR_FIXTURE,
      guardSessionSource: guardSource([]),
      resourcePorts: makeResourcePorts(),
    });
    const response = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'guard-override-1',
      capabilityId: 'document:open',
      input: { source: CARD_URI },
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    }
    // 拒绝来自覆盖口快照而非路由准入：登记表侧同一会话确实活跃且全量授权。
    const live = runtime.sessionPermissionSnapshots().find((item) => item.sessionId === 'session:1:main');
    expect(live?.state).toBe('active');
    expect([...(live?.grantedPermissions ?? [])]).toEqual(['*']);
    await runtime.shutdown();
  });

  it('守卫判定接线锁：快照无活跃会话 → 服务第二线拒绝 BRIDGE_SESSION_UNKNOWN（路由准入不替代服务复查）', async () => {
    const { runtime } = await startAssemblyRuntime({
      parserModulePath: PARSER_BEHAVIOR_FIXTURE,
      guardSessionSource: guardSource([
        { sessionId: 'session:1:main', state: 'closed', grantedPermissions: new Set<string>(['*']) },
      ]),
      resourcePorts: makeResourcePorts(),
    });
    const response = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'guard-closed',
      capabilityId: 'document:open',
      input: { source: CARD_URI },
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_SESSION_UNKNOWN');
    }
    await runtime.shutdown();
  });

  it('守卫判定接线锁：快照缺 resources:write → read 放行、write 拒绝 BRIDGE_PERMISSION_DENIED', async () => {
    const { runtime } = await startAssemblyRuntime({
      parserModulePath: PARSER_BEHAVIOR_FIXTURE,
      guardSessionSource: guardSource([
        { sessionId: 'session:1:main', state: 'active', grantedPermissions: new Set<string>(['resources:read']) },
      ]),
      resourcePorts: makeResourcePorts(),
    });
    const opened = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'guard-read',
      capabilityId: 'document:open',
      input: { source: CARD_URI },
    });
    expect(opened.ok).toBe(true);
    const denied = await runtime.ipc.handleRequest(SENDER, {
      requestId: 'guard-write',
      capabilityId: 'document:write',
      input: { documentId: CARD_ID, part: 'content', nodeId: NODE_ID_ONE, value: { text: '越权写入' } },
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe('BRIDGE_PERMISSION_DENIED');
      expect(denied.error.details).toMatchObject({ permission: 'resources:write' });
    }
    await runtime.shutdown();
  });
});

describe('文档守卫端口适配器：Bridge 会话注册表快照判定（复用单点判定本体）', () => {
  const view = (overrides: Partial<IDocumentGuardSessionView>): IDocumentGuardSessionView => ({
    sessionId: 'session:1:main',
    state: 'active',
    grantedPermissions: new Set<string>(['resources:read']),
    ...overrides,
  });

  it('活跃与会话定位：未知会话与已关闭会话均判非活跃', async () => {
    const guard = createDocumentBridgeSessionGuardPort(() => [view({})]);
    await expect(guard.isSessionActive('session:1:main')).resolves.toBe(true);
    await expect(guard.isSessionActive('session:9:main')).resolves.toBe(false);
    const closedGuard = createDocumentBridgeSessionGuardPort(() => [view({ state: 'closed' })]);
    await expect(closedGuard.isSessionActive('session:1:main')).resolves.toBe(false);
    await expect(closedGuard.hasPermission('session:1:main', 'resources:read')).resolves.toBe(false);
  });

  it('权限覆盖判定与 08 §7.2 同源：精确授予、domain:* 与全通配覆盖、未授予拒绝', async () => {
    const exact = createDocumentBridgeSessionGuardPort(() => [view({})]);
    await expect(exact.hasPermission('session:1:main', 'resources:read')).resolves.toBe(true);
    await expect(exact.hasPermission('session:1:main', 'resources:write')).resolves.toBe(false);
    const domain = createDocumentBridgeSessionGuardPort(() => [
      view({ grantedPermissions: new Set<string>(['resources:*']) }),
    ]);
    await expect(domain.hasPermission('session:1:main', 'resources:write')).resolves.toBe(true);
    const wildcard = createDocumentBridgeSessionGuardPort(() => [view({ grantedPermissions: new Set<string>(['*']) })]);
    await expect(wildcard.hasPermission('session:1:main', 'resources:write')).resolves.toBe(true);
  });

  it('每调用查询、不缓存（§9.1）：快照变化即时反映', async () => {
    let views: readonly IDocumentGuardSessionView[] = [view({})];
    const guard = createDocumentBridgeSessionGuardPort(() => views);
    await expect(guard.hasPermission('session:1:main', 'resources:write')).resolves.toBe(false);
    views = [view({ grantedPermissions: new Set<string>(['resources:read', 'resources:write']) })];
    await expect(guard.hasPermission('session:1:main', 'resources:write')).resolves.toBe(true);
    views = [];
    await expect(guard.isSessionActive('session:1:main')).resolves.toBe(false);
  });
});

describe('文档事件端口适配器：宿主事件总线绑定语义', () => {
  it('未绑定总线：发布以在册码 BRIDGE_INTERNAL 诚实拒绝，不静默丢弃', async () => {
    const bus = createDocumentHostEventBusPort();
    expect(bus.bound).toBe(false);
    const failure = await bus.port
      .publish(DOCUMENT_EVENT_IDS.opened, { uri: 'x', kind: 'card', title: 't' })
      .catch((error: unknown) => error as { code: string });
    expect((failure as { code: string }).code).toBe('BRIDGE_INTERNAL');
  });

  it('绑定后逐字转发 (eventId, payload)，不做加工；同步抛出归一为 rejection', async () => {
    const seen: { eventId: string; payload: unknown }[] = [];
    const bus = createDocumentHostEventBusPort();
    bus.bind((eventId, payload) => {
      seen.push({ eventId, payload });
    });
    expect(bus.bound).toBe(true);
    const payload = { uri: CARD_URI, kind: 'card', title: '生产接线卡片' };
    await bus.port.publish(DOCUMENT_EVENT_IDS.opened, payload);
    expect(seen).toEqual([{ eventId: DOCUMENT_EVENT_IDS.opened, payload }]);
    bus.bind(() => {
      throw new Error('总线投递故障');
    });
    await expect(bus.port.publish(DOCUMENT_EVENT_IDS.saved, { uri: CARD_URI, kind: 'card' })).rejects.toThrow(
      '总线投递故障',
    );
  });
});
