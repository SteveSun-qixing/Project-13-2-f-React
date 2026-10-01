/**
 * 公开入口导出面与文档规定的测试组合路径（02-SDK-API规范 §2.1、§2.2、§3.2、§3.4、§7.2、§7.3、§8.3）。
 *
 * 分工：主入口的六个值导出与依赖边界由 `src/index.test.ts` 断言，`src/generated` 契约常量的
 * 引用路径由 `tests/generated-contracts.test.ts` 断言；本文件补 `@chips/sdk/testing` 入口
 * （§2.2 末段固定的四个值导出）的导出面，以及「插件代码只依赖主入口 + 测试代码用 testing
 * 入口装配 Mock」这条 §7.3 规定的端到端路径，并覆盖 `@chips/sdk/scaffold` 入口（§8.3）的
 * 值导出面与计划消费路径。入口的类型面由本文件的 `import type` 消费点
 * 承担：`IMockBridge`、`IMockBridgeOptions`、`IMockResourceInit`、`IMockCall` 必须可从入口
 * 取到，否则包级 `typecheck` 失败。§2.2「CLI 扩展」行的 11 个类型名与「manifest」行的
 * 15 个类型名同样在本文件被消费并用于注解夹具：02-SDK-API规范 §3.5 与 07-CLI完整参考 §5.6
 * 的权威示例按原文落地为可执行用例，导入路径缺失或形状不符时包级 `typecheck` 直接失败。
 * 编辑链路会话面（工单036 残段 T1，12-编辑引擎设计 §三）随单扩入：`EditRequest` /
 * `EntryInput` / `MetadataPatch` / `IEditEngine` / `IEditSession` 的主入口消费点在本文件
 * 注解夹具与消费函数中承担；受管门面与历史记录模型不经主入口（各自契约归属见
 * `tests/edit-contract-lock.test.ts` 的在册名单锁）。
 *
 * 绕开的口径（工单 009 登记）：§3.2、§3.3 的 `CapabilityInput` / `CapabilityOutput` 编译期映射
 * 已由主入口导出；本文件的插件示例仍按显式契约接口 `IFileReadInput` / `IFileReadOutput`
 * 注解，以固定校验 §2.2 全部 `I*Input` / `I*Output` 契约名的导出面，运行时形状与 §3.2、§7.3
 * 示例一致。§2.1 的第三个入口 `@chips/sdk/scaffold` 已随 W2 P1-8 落地为对 `@chips/scaffold`
 * 的薄转发，导出面与边界错误归一由 `src/scaffold/index.test.ts` 逐项断言，本文件补一条
 * 入口类型面消费路径（§8.3）。
 */

import { afterEach, describe, expect, it } from 'vitest';
import * as testing from '../src/testing/index.js';
import * as scaffold from '../src/scaffold/index.js';
import type { IScaffoldPlan, IScaffoldTemplate } from '../src/scaffold/index.js';
import {
  assertChipsError,
  createMockBridge,
  installMockBridge,
  uninstallMockBridge,
} from '../src/testing/index.js';
import { assertChipsError as assertChipsErrorImpl } from '../src/testing/assert-chips-error.js';
import { createMockBridge as createMockBridgeImpl } from '../src/testing/mock-bridge.js';
import {
  installMockBridge as installMockBridgeImpl,
  uninstallMockBridge as uninstallMockBridgeImpl,
} from '../src/testing/install-mock-bridge.js';
import { ChipsError, chips, createClient, isChipsError } from '../src/index.js';
import type {
  CliCommandApi,
  CliCommandConflict,
  CliCommandIndex,
  CliCommandListResult,
  CliCommandQueryOptions,
  CliCommandResolveResult,
  CliCommandTargetType,
  CliCommandView,
  CliTaskApi,
  CliTaskRecord,
  CliTaskStatus,
  IChipsBridge,
  IFileReadInput,
  IFileReadOutput,
  IPluginCapabilities,
  IPluginCardType,
  IPluginDeepLink,
  IPluginDependency,
  IPluginEngines,
  IPluginExportFormat,
  IPluginFileAssociation,
  IPluginHealthCheck,
  IPluginLayoutType,
  IPluginManifest,
  IPluginRuntime,
  IPluginUi,
  IResourceHandle,
  ISubscription,
  EditRequest,
  EntryInput,
  IEditEngine,
  IEditSession,
  MetadataPatch,
  PluginRole,
  PluginSurface,
  PluginTarget,
} from '../src/index.js';
import type {
  IMockBridge,
  IMockBridgeOptions,
  IMockCall,
  IMockResourceInit,
} from '../src/testing/index.js';
import { SDK_BRIDGE_UNAVAILABLE } from '../src/errors.js';
import { mountWindow, windowHost } from './helpers/window.js';

/** §7.3 资源夹具示例的封面 URI、夹具与装配选项。 */
const COVER_URI = 'chips-resource://card-7f3a/cover.png';
const COVER_FIXTURE: IMockResourceInit = {
  data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  mimeType: 'image/png',
  version: '1',
};
const RESOURCE_OPTIONS: IMockBridgeOptions = { resources: { [COVER_URI]: COVER_FIXTURE } };

/* §2.2「CLI 扩展」行的 11 个类型名与「manifest」行的 15 个类型名的编译期消费点：
   名字缺失或形状不符时包级 `typecheck` 直接失败。 */

/** 发现查询的目标类型（§2.2 CLI 扩展行）。 */
const CLI_TARGET_TYPE: CliCommandTargetType = 'app';
/** 发现查询参数。 */
const CLI_QUERY: CliCommandQueryOptions = {
  targetType: CLI_TARGET_TYPE,
  commandPath: ['office', 'open'],
};
/** 同键冲突条目。 */
const CLI_CONFLICT: CliCommandConflict = {
  entryId: 'chips.other.cli.office.open',
  commandPath: ['office', 'open'],
  owner: 'chips.other',
  priority: 0,
};
/** 命令视图：CLI 侧标识 + 运行时命令引用（07-CLI完整参考 §5.6）。 */
const CLI_VIEW: CliCommandView = {
  entryId: 'chips.official.office.cli.office.open',
  commandPath: ['office', 'open'],
  commandId: 'office:open',
  owner: 'chips.official.office',
  enabled: true,
  declaration: {
    commandPath: ['office', 'open'],
    commandId: 'office:open',
    title: '打开办公文档',
    target: { type: CLI_TARGET_TYPE, pluginId: 'chips.official.office' },
  },
  conflicts: [CLI_CONFLICT],
};
/** 发现索引：命令路径键 → entryId 列表。 */
const CLI_INDEX: CliCommandIndex = { 'office open': [CLI_VIEW.entryId, CLI_CONFLICT.entryId] };
/** `list` 结果。 */
const CLI_LIST: CliCommandListResult = { index: CLI_INDEX, commands: [CLI_VIEW] };
/** `resolve` 结果：唯一匹配时无冲突。 */
const CLI_RESOLVE: CliCommandResolveResult = { command: CLI_VIEW, conflicts: [] };
/** 任务状态。 */
const TASK_RUNNING: CliTaskStatus = 'running';
/** 任务记录。 */
const TASK_RECORD: CliTaskRecord = {
  taskId: 'task-01',
  pluginId: 'chips.official.office',
  commandId: 'office:open',
  commandPath: ['office', 'open'],
  status: TASK_RUNNING,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

/** manifest 角色 / 目标 / 表面三个联合类型。 */
const ROLE: PluginRole = 'app';
const TARGET: PluginTarget = 'host';
const SURFACE: PluginSurface = 'window';
/** manifest 导出格式条目。 */
const EXPORT_FORMAT: IPluginExportFormat = {
  id: 'pdf',
  name: 'PDF',
  extension: 'pdf',
  mimeType: 'application/pdf',
};
/** manifest 卡片类型条目。 */
const CARD_TYPE: IPluginCardType = {
  id: 'viewer.card',
  name: '查看卡片',
  exportFormats: [EXPORT_FORMAT],
};
/** manifest 布局类型条目。 */
const LAYOUT_TYPE: IPluginLayoutType = {
  id: 'viewer.layout',
  name: '查看布局',
  configSchema: 'schemas/layout.json',
  schemaVersions: '1',
};
/** manifest 角色能力声明。 */
const CAPABILITIES: IPluginCapabilities = { cardTypes: [CARD_TYPE], layouts: [LAYOUT_TYPE] };
/** manifest 运行时声明。 */
const RUNTIME: IPluginRuntime = { targets: [TARGET], background: false };
/** manifest 平台版本门禁。 */
const ENGINES: IPluginEngines = { chips: '>=1.0.0 <2.0.0' };
/** manifest 直接依赖条目。 */
const DEPENDENCY: IPluginDependency = { id: 'chips.official.core', version: '^1.0.0' };
/** manifest 应用界面声明。 */
const UI: IPluginUi = { surface: SURFACE };
/** manifest 文件关联条目。 */
const FILE_ASSOCIATION: IPluginFileAssociation = { extensions: ['.card'], action: 'open' };
/** manifest 深链接条目。 */
const DEEP_LINK: IPluginDeepLink = { scheme: 'chips', host: 'viewer' };
/** manifest 服务健康检查声明。 */
const HEALTH_CHECK: IPluginHealthCheck = { interval: '30s', timeout: '2s' };
/** 完整 manifest 夹具。 */
const MANIFEST: IPluginManifest = {
  id: 'chips.official.viewer',
  version: '1.0.0',
  type: ROLE,
  name: '卡片查看器',
  runtime: RUNTIME,
  engines: ENGINES,
  dependencies: [DEPENDENCY],
  capabilities: CAPABILITIES,
  ui: UI,
  fileAssociations: [FILE_ASSOCIATION],
  deepLinks: [DEEP_LINK],
  healthCheck: HEALTH_CHECK,
};

/** 编辑链路会话面（12-编辑引擎设计 §3.1）：打开请求夹具。 */
const EDIT_REQUEST: EditRequest = {
  kind: 'card',
  source: 'chips-resource://card-7f3a/.card',
  options: { autoSave: true, autoSaveDelayMs: 500, historyLimit: 100 },
};
/** 箱子条目输入夹具（url 为受管引用）。 */
const EDIT_ENTRY: EntryInput = {
  url: 'chips-resource://box-9c4a/pages/p1.card',
  enabled: true,
};
/** 卡片元数据补丁夹具（cover_ratio 为 '宽:高'）。 */
const EDIT_METADATA_PATCH: MetadataPatch = { name: '示例卡片', tags: ['示例'], cover_ratio: '3:4' };

/**
 * §三 会话面消费形态：应用插件把 `session.preview` 挂载到自身容器（12 §3.3 规则 3），
 * 并订阅 revision 事件（回流后修订号前进）。
 *
 * @param session - 编辑会话句柄
 * @param container - 应用自身容器
 */
function mountEditPreview(session: IEditSession, container: HTMLElement): void {
  void session.preview.mount(container);
  session.subscribe('revision-changed', (payload) => {
    expect(payload.revision).toBeGreaterThan(0);
  });
}

/**
 * §三 引擎入口消费形态：由平台注入的 `IEditEngine` 打开会话并按会话面编排
 * （`IEditSession` 是编辑链路对应用插件的唯一入口，12 §3.1 规则 1）。
 *
 * @param engine - 平台注入的编辑引擎
 * @returns 编辑会话 ID
 */
async function openEditSession(engine: IEditEngine): Promise<string> {
  const session = await engine.open(EDIT_REQUEST);
  return session.id;
}

/**
 * §3.5 插件侧完整示例：在命令处理中上报当前 CLI 任务的进度与终态。
 *
 * 原文照抄文档示例，只依赖主入口的 `chips` 与 `cliTask` 命名空间。
 *
 * @param commandId - 运行时命令 ID
 * @param outputPath - 产物路径
 */
async function reportCliTask(commandId: string, outputPath: string): Promise<void> {
  const active: CliTaskRecord | undefined = await chips.cliTask.active(commandId);
  if (active === undefined) {
    return; // 命令未声明 job.wait，无 CLI 任务
  }
  await chips.cliTask.progress(active.taskId, { stage: 'writing', percent: 80 });
  await chips.cliTask.complete(active.taskId, { files: [outputPath] });
}

/**
 * §3.5 发现侧完整示例：读取命令索引并解析命令路径。
 *
 * @param bridge - `@chips/cli` 注入的服务路由目标
 * @returns 命中唯一命令时的 `entryId` 与命令数；未命中或多匹配为 `undefined`
 */
async function discoverCliCommand(
  bridge: IChipsBridge
): Promise<readonly [string, number] | undefined> {
  const client = createClient({ bridge });
  const { commands } = await client.cliCommand.list({ targetType: 'app' });
  const resolved = await client.cliCommand.resolve({ commandPath: 'office open' });
  if (resolved.command !== undefined && resolved.conflicts.length === 0) {
    return [resolved.command.entryId, commands.length];
  }
  return undefined;
}

/**
 * 被测插件代码：只从主入口取客户端与契约类型，运行期不感知 Mock（§2.1、§7.1）。
 */
const pluginUnderTest = {
  /**
   * §3.2 完整示例 `readMetadata`：类型化 `request` 后返回文件文本内容。
   *
   * @param path - 包内相对路径
   * @returns 文件文本内容
   */
  async readMetadata(path: string): Promise<string> {
    const input: IFileReadInput = { path, encoding: 'utf-8' };
    const output: IFileReadOutput = await chips.request<IFileReadOutput>('file:read', input);
    return output.content;
  },

  /**
   * §3.4 完整示例 `openCover`：同步取句柄、首次 `metadata()` 打开、`finally` 释放。
   *
   * @param uri - `chips-resource://` URI
   * @returns 资源字节长度
   */
  async coverSize(uri: string): Promise<number> {
    const handle: IResourceHandle = chips.resource(uri);
    try {
      const metadata = await handle.metadata();
      return metadata.size;
    } finally {
      handle.release();
    }
  },

  /**
   * §3.1 的订阅面：把 handler 交给 `subscribe`，返回可退订句柄。
   *
   * @param handler - 载荷回调
   * @returns 订阅句柄
   */
  watchDocument(handler: (payload: unknown) => void): ISubscription {
    return chips.subscribe('document:changed', handler);
  },
};

/** 本文件用例挂载的 `window` 恢复函数。 */
let restoreWindow: (() => void) | undefined;

/**
 * 挂载 `window` 并把 Mock 安装到 `window.chips`。
 *
 * §7.3 示例在 `describe` 体内安装，依赖 jsdom 常驻的 `window`；本包测试不引入 DOM 实现，
 * 因此按用例挂载并在 `afterEach` 还原为「无 window」原判据。
 *
 * @param bridge - 要安装的 Mock；省略时由 `installMockBridge` 新建
 * @returns 已安装的 Mock Bridge
 */
function installMock(bridge?: IMockBridge): IMockBridge {
  restoreWindow = mountWindow();
  return installMockBridge(bridge);
}

/** 还原 `window` 环境；用例内提前卸载时使用。 */
function releaseWindow(): void {
  restoreWindow?.();
  restoreWindow = undefined;
}

/** 取 Promise 的拒绝原因；未拒绝时断言失败。 */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('预期调用被拒绝');
    },
    (error: unknown) => error
  );
}

/** 取 `assertChipsError` 失败时的消息文本。 */
function assertFailureMessage(run: () => void): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('预期断言失败，但未抛出');
}

afterEach(() => {
  uninstallMockBridge();
  releaseWindow();
});

describe('@chips/sdk/testing 入口值导出面（§2.1、§2.2 末段）', () => {
  it('值导出恰好为文档列出的四项，且无默认导出', () => {
    expect(Object.keys(testing).sort()).toEqual([
      'assertChipsError',
      'createMockBridge',
      'installMockBridge',
      'uninstallMockBridge',
    ]);
    expect('default' in testing).toBe(false);
    expect(typeof testing.assertChipsError).toBe('function');
    expect(typeof testing.createMockBridge).toBe('function');
    expect(typeof testing.installMockBridge).toBe('function');
    expect(typeof testing.uninstallMockBridge).toBe('function');
  });

  it('入口导出即各实现模块本身，未经二次包装', () => {
    expect(testing.assertChipsError).toBe(assertChipsErrorImpl);
    expect(testing.createMockBridge).toBe(createMockBridgeImpl);
    expect(testing.installMockBridge).toBe(installMockBridgeImpl);
    expect(testing.uninstallMockBridge).toBe(uninstallMockBridgeImpl);
  });

  it('testing 入口不导出主入口值、契约常量与 Mock 内部码表', () => {
    const entry = testing as Record<string, unknown>;
    for (const name of [
      'chips',
      'createClient',
      'ChipsBridge',
      'ChipsError',
      'isChipsError',
      'toChipsError',
      'MOCK_ERROR_CODES',
      'mockError',
      'MockResourceHandle',
      'Capability',
      'CAPABILITY_IDS',
      'ERROR_CODES',
      'PLATFORM_VERSION',
    ]) {
      expect(entry[name], name).toBeUndefined();
    }
  });
});

describe('主入口客户端与 testing 入口 Mock 的端到端路径（§7.3）', () => {
  it('类型化 request 命中桩，calls 记录能力 ID 与输入', async () => {
    const bridge = installMock();
    bridge.handle('file:read', () => ({ content: 'name: 示例卡片', encoding: 'utf-8' }));
    await expect(pluginUnderTest.readMetadata('.card/metadata.yaml')).resolves.toBe(
      'name: 示例卡片'
    );
    const calls: readonly IMockCall[] = bridge.calls;
    expect(calls).toEqual([
      { capabilityId: 'file:read', input: { path: '.card/metadata.yaml', encoding: 'utf-8' } },
    ]);
    expect(bridge.calls[0]?.capabilityId).toBe('file:read');
  });

  it('未登记桩时按 BRIDGE_CAPABILITY_NOT_FOUND 拒绝，只按 code 分支即可还原语义', async () => {
    installMock();
    const caught: unknown = await rejection(pluginUnderTest.readMetadata('a.txt'));
    assertChipsError(caught, 'BRIDGE_CAPABILITY_NOT_FOUND');
    expect(caught).toBeInstanceOf(ChipsError);
    expect(isChipsError(caught)).toBe(true);
    expect(caught.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
    expect(caught.retryable).toBe(false);
    expect(caught.details).toEqual({ capabilityId: 'file:read' });
  });

  it('桩抛 ChipsError 时同实例透传到插件代码，错误码不匹配时断言按码报错', async () => {
    const bridge = installMock();
    const denied = new ChipsError({
      code: 'BRIDGE_PERMISSION_DENIED',
      message: '缺少文件读取权限',
      retryable: false,
    });
    bridge.handle('file:read', () => {
      throw denied;
    });
    const caught: unknown = await rejection(pluginUnderTest.readMetadata('.card/metadata.yaml'));
    assertChipsError(caught, 'BRIDGE_PERMISSION_DENIED');
    expect(caught).toBe(denied);
    // §7.2「assertChipsError」行：失败消息同时给出期望与实际错误码
    const message = assertFailureMessage(() => assertChipsError(caught, 'RESOURCE_NOT_FOUND'));
    expect(message).toContain('期望错误码 RESOURCE_NOT_FOUND');
    expect(message).toContain('实际错误码 BRIDGE_PERMISSION_DENIED');
  });

  it('订阅面经默认客户端联动 Mock，dispose 后不再收到派发', () => {
    const bridge = installMock();
    const received: unknown[] = [];
    const subscription = pluginUnderTest.watchDocument((payload) => received.push(payload));
    bridge.emit('document:changed', { documentId: 'a1B2c3D4e5' });
    expect(received).toEqual([{ documentId: 'a1B2c3D4e5' }]);
    expect(bridge.subscriptionCount('document:changed')).toBe(1);
    subscription.dispose();
    bridge.emit('document:changed', { documentId: 'Z9y8X7' });
    expect(received).toHaveLength(1);
    expect(bridge.subscriptionCount('document:changed')).toBe(0);
  });

  it('默认客户端与注入客户端共用同一 Mock 订阅表（§3.2 注入行）', () => {
    const bridge = installMock();
    const injected = createClient({ bridge });
    const subscription = injected.subscribe('document:changed', () => undefined);
    pluginUnderTest.watchDocument(() => undefined);
    expect(bridge.subscriptionCount('document:changed')).toBe(2);
    subscription.dispose();
    expect(bridge.subscriptionCount('document:changed')).toBe(1);
  });

  it('资源夹具按 §7.3 示例给出元数据，插件 release 后同句柄不再可读', async () => {
    const bridge = installMock(createMockBridge(RESOURCE_OPTIONS));
    await expect(pluginUnderTest.coverSize(COVER_URI)).resolves.toBe(4);
    const handle = chips.resource(COVER_URI);
    await expect(handle.metadata()).resolves.toEqual({
      uri: COVER_URI,
      size: 4,
      mimeType: 'image/png',
      version: '1',
      scope: 'memory',
    });
    handle.release();
    const caught: unknown = await rejection(handle.read());
    assertChipsError(caught, 'RESOURCE_HANDLE_RELEASED');
    expect(caught.details).toEqual({ uri: COVER_URI });
    // §7.2「calls」行：resource() 不经能力通道，全部资源访问都不产生调用记录
    expect(bridge.calls).toEqual([]);
  });

  it('未登记资源的读取按 RESOURCE_NOT_FOUND 拒绝', async () => {
    installMock(createMockBridge(RESOURCE_OPTIONS));
    const missing = chips.resource('chips-resource://card-7f3a/none.png');
    const caught: unknown = await rejection(missing.read());
    assertChipsError(caught, 'RESOURCE_NOT_FOUND');
    expect(caught.details).toEqual({ uri: 'chips-resource://card-7f3a/none.png' });
  });

  it('URI 语法非法时 resource 同步抛 ChipsError，插件按 §3.4 的 catch 分支处理', () => {
    installMock();
    let caught: unknown;
    try {
      chips.resource('chips-resource://card-7f3a/images/photo.jpg?v=2');
    } catch (error) {
      caught = error;
    }
    assertChipsError(caught, 'RESOURCE_INVALID_URI');
    expect(caught).toBeInstanceOf(ChipsError);
    expect(caught.details).toMatchObject({
      uri: 'chips-resource://card-7f3a/images/photo.jpg?v=2',
    });
  });

  it('§7.3 的 afterEach reset 惯用法：清空桩与记录后同一调用按未登记拒绝', async () => {
    const bridge = installMock();
    bridge.handle('file:read', () => ({ content: 'name: 示例卡片', encoding: 'utf-8' }));
    await expect(pluginUnderTest.readMetadata('.card/metadata.yaml')).resolves.toBe(
      'name: 示例卡片'
    );
    bridge.reset();
    expect(bridge.calls).toEqual([]);
    const caught: unknown = await rejection(pluginUnderTest.readMetadata('.card/metadata.yaml'));
    assertChipsError(caught, 'BRIDGE_CAPABILITY_NOT_FOUND');
  });

  it('createClient 注入 Mock 后无需 window 即跑通三个方法面', async () => {
    expect(windowHost()).toBeUndefined();
    const mock = createMockBridge(RESOURCE_OPTIONS);
    mock.handle('file:read', () => ({ content: '注入客户端', encoding: 'utf-8' }));
    const client = createClient({ bridge: mock });
    await expect(client.request<IFileReadOutput>('file:read', { path: 'a.txt' })).resolves.toEqual({
      content: '注入客户端',
      encoding: 'utf-8',
    });
    expect(client.resource(COVER_URI).state).toBe('open');
    const received: unknown[] = [];
    client.subscribe('document:changed', (payload) => received.push(payload)).dispose();
    mock.emit('document:changed', { documentId: 'a1B2' });
    expect(received).toEqual([]);
    expect(mock.calls).toEqual([{ capabilityId: 'file:read', input: { path: 'a.txt' } }]);
  });

  it('卸载后默认客户端拒绝 SDK_BRIDGE_UNAVAILABLE，注入客户端仍走同一 Mock', async () => {
    const bridge = installMock();
    bridge.handle('file:read', () => ({ content: '仍可读', encoding: 'utf-8' }));
    const injected = createClient({ bridge });
    uninstallMockBridge();
    releaseWindow();
    expect(windowHost()).toBeUndefined();
    const caught: unknown = await rejection(pluginUnderTest.readMetadata('a.txt'));
    assertChipsError(caught, SDK_BRIDGE_UNAVAILABLE);
    await expect(injected.request<IFileReadOutput>('file:read')).resolves.toEqual({
      content: '仍可读',
      encoding: 'utf-8',
    });
  });
});

describe('主入口 CLI 扩展与 manifest 类型面（§2.2 CLI 扩展行、manifest 行）', () => {
  it('两个扩展命名空间可从主入口类型标注，且实例即文档方法面', () => {
    const client = createClient();
    const cliCommand: CliCommandApi = client.cliCommand;
    const cliTask: CliTaskApi = client.cliTask;
    expect(Object.keys(cliCommand).sort()).toEqual(['get', 'list', 'resolve']);
    expect(Object.keys(cliTask).sort()).toEqual([
      'active',
      'bindInvocation',
      'cancel',
      'complete',
      'create',
      'fail',
      'get',
      'progress',
    ]);
    expect(CLI_LIST.index).toBe(CLI_INDEX);
    expect(CLI_VIEW.conflicts).toEqual([CLI_CONFLICT]);
    expect(CLI_RESOLVE.command).toBe(CLI_VIEW);
    expect(CLI_QUERY.commandPath).toEqual(['office', 'open']);
    expect(TASK_RECORD.status).toBe(TASK_RUNNING);
  });

  it('manifest 类型从主入口可达，夹具形状与 scaffold 生成计划一致', () => {
    const plan: IPluginManifest = scaffold.createScaffoldPlan({
      role: ROLE,
      pluginId: MANIFEST.id,
      name: MANIFEST.name,
      targetDir: 'plugins/viewer',
    }).manifest;
    expect(plan.type).toBe(ROLE);
    expect(plan.runtime.targets).toEqual([TARGET]);
    expect(MANIFEST.ui?.surface).toBe(SURFACE);
    expect(MANIFEST.capabilities?.cardTypes?.[0]?.exportFormats).toEqual([EXPORT_FORMAT]);
    expect(MANIFEST.capabilities?.layouts).toEqual([LAYOUT_TYPE]);
    expect(MANIFEST.dependencies).toEqual([DEPENDENCY]);
    expect(MANIFEST.fileAssociations).toEqual([FILE_ASSOCIATION]);
    expect(MANIFEST.deepLinks).toEqual([DEEP_LINK]);
    expect(MANIFEST.healthCheck).toEqual(HEALTH_CHECK);
  });
});

describe('主入口编辑链路类型面（12-编辑引擎设计 §三）', () => {
  it('会话请求、条目输入与元数据补丁可从主入口逐名装配', () => {
    expect(EDIT_REQUEST.kind).toBe('card');
    expect(EDIT_REQUEST.options?.autoSave).toBe(true);
    expect(EDIT_REQUEST.options?.autoSaveDelayMs).toBe(500);
    expect(EDIT_REQUEST.options?.historyLimit).toBe(100);
    expect(EDIT_ENTRY.enabled).toBe(true);
    expect(EDIT_METADATA_PATCH.name).toBe('示例卡片');
    expect(EDIT_METADATA_PATCH.tags).toEqual(['示例']);
    expect(EDIT_METADATA_PATCH.cover_ratio).toBe('3:4');
  });

  it('会话面消费形态可从主入口类型标注（preview 挂载、订阅与引擎打开链路编译期可达）', () => {
    expect(typeof mountEditPreview).toBe('function');
    expect(typeof openEditSession).toBe('function');
  });
});

describe('主入口 CLI 扩展命名空间的文档示例路径（§3.5 两个完整示例）', () => {
  it('插件侧示例：active → progress → complete 经默认客户端命中三个 cli:task 能力', async () => {
    const bridge = installMock();
    bridge.handle('cli:task-active', () => ({ task: TASK_RECORD }));
    bridge.handle('cli:task-progress', () => ({ task: TASK_RECORD }));
    bridge.handle('cli:task-complete', () => ({
      task: { ...TASK_RECORD, status: 'completed' as const },
    }));
    await expect(reportCliTask('office:open', '/tmp/报告.pdf')).resolves.toBeUndefined();
    expect(bridge.calls).toEqual([
      { capabilityId: 'cli:task-active', input: { commandId: 'office:open' } },
      {
        capabilityId: 'cli:task-progress',
        input: { taskId: 'task-01', progress: { stage: 'writing', percent: 80 } },
      },
      {
        capabilityId: 'cli:task-complete',
        input: { taskId: 'task-01', output: { files: ['/tmp/报告.pdf'] } },
      },
    ]);
  });

  it('插件侧示例：active 返回 undefined 时按文档注释提前返回，不产生后续调用', async () => {
    const bridge = installMock();
    bridge.handle('cli:task-active', () => ({}));
    await expect(reportCliTask('office:open', '/tmp/报告.pdf')).resolves.toBeUndefined();
    expect(bridge.calls).toEqual([
      { capabilityId: 'cli:task-active', input: { commandId: 'office:open' } },
    ]);
  });

  it('发现侧示例：注入服务路由目标后 list → resolve 命中 cli.command.* 并透出唯一命令', async () => {
    const bridge = createMockBridge();
    bridge.handle('cli.command.list', (input: unknown) => {
      expect(input).toEqual({ targetType: 'app' });
      return CLI_LIST;
    });
    bridge.handle('cli.command.resolve', () => CLI_RESOLVE);
    await expect(discoverCliCommand(bridge)).resolves.toEqual([CLI_VIEW.entryId, 1]);
    expect(bridge.calls).toEqual([
      { capabilityId: 'cli.command.list', input: { targetType: 'app' } },
      { capabilityId: 'cli.command.resolve', input: { commandPath: 'office open' } },
    ]);
  });

  it('发现侧示例：多匹配时 conflicts 非空，SDK 不做本地消解', async () => {
    const bridge = createMockBridge();
    bridge.handle('cli.command.list', () => ({ ...CLI_LIST, commands: [CLI_VIEW, CLI_VIEW] }));
    bridge.handle('cli.command.resolve', () => ({
      command: undefined,
      conflicts: CLI_VIEW.conflicts,
    }));
    await expect(discoverCliCommand(bridge)).resolves.toBeUndefined();
    expect(bridge.calls).toHaveLength(2);
  });
});

describe('@chips/sdk/scaffold 入口值导出面与类型消费（§2.1、§8.3）', () => {
  it('值导出恰好为文档列出的两项，且无默认导出', () => {
    expect(Object.keys(scaffold).sort()).toEqual(['createScaffoldPlan', 'listScaffoldTemplates']);
    expect('default' in scaffold).toBe(false);
  });

  it('入口类型面可被 import type 消费，计划与模板形状符合 §8.3', () => {
    const templates: readonly IScaffoldTemplate[] = scaffold.listScaffoldTemplates();
    expect(templates).toHaveLength(4);
    const plan: IScaffoldPlan = scaffold.createScaffoldPlan({
      role: 'app',
      pluginId: 'chips.official.viewer',
      name: '卡片查看器',
      targetDir: 'plugins/viewer',
    });
    expect(plan.template.role).toBe('app');
    expect(plan.manifest.type).toBe('app');
    expect(plan.files.map((file) => file.path)).toContain('src/ui/AppView.tsx');
  });
});
