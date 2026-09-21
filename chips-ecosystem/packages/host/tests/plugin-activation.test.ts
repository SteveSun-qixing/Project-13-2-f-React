/**
 * 宿主插件激活端口（`src/main/plugin-activation.ts`）波 2 正式套件（任务 #109；
 * RFC-插件执行通道与ModuleLoader裁定 §八 波 2 验收面）。
 *
 * 覆盖：
 * - A 组 纪律锁（源码文本面）：§6.1 强制点不旁路（零 `setTimeout`/零 `AbortController`
 *   构造/零 `register(`）、零自造码（码面只取 `LIFECYCLE_ERROR_CODES` 在册常量，无
 *   `"KERNEL_*"`/`"CPK_*"` 字符串字面量）、导入面封顶（仅 `../loader/index.js` 与
 *   `../protocol/wire.js`）、四角色契约方法与 §5.1/O1 归一 reason 词表在位；
 * - B 组 角色形状校验（波 1 移交欠账②）：default 导出缺席/非对象、必含方法缺席/非函数、
 *   可选方法非函数、形状通过后入口保管（`activatedEntry`）与非 service 角色零执行
 *   （注册数据源是 manifest，不执行插件注册代码）、signal 预中止取消臂、端口-上下文
 *   身份一致守卫、通道释放拒装与注入装载器不代释放；
 * - C 组 §5.1 失败语义逐码归一：装载器 `LoaderError` 同实例透传、注册表未命中
 *   `KERNEL_PLUGIN_NOT_FOUND`、插件自带在册形状域码原样保留（`APP_*` 实例透传、码不落
 *   message）、普通异常归一 `KERNEL_APPLY_FAILED` + `details.cause`、stop 面同纪律、
 *   真 `createCpkModuleLoader` 在 vitest 代管 import 下的通道活性 fail-closed（真实失败，
 *   不在 vitest 内冒充成功）；
 * - D 组 O1 归档再锚定（波 1 移交欠账①，真注册表 + 真信任根 + 真 Ed25519 签名夹具）：
 *   `development` 原样递交（真防篡改锚）、`builtin`/`user` 签名再锚定后递交目录合并摘要
 *   （≠ 归档摘要）、篡改/缺签/keyId 未登记/符号链接四类确定性拒装逐码归一
 *   （`details.stage='integrity'` + `causeCode`）、`user` 未签名发布者重算摘要臂；
 * - E 组 lifecycle 状态机集成（真 `createCpkPluginLoader` × 本通道注入）：T2/T6/T8/T9
 *   全链事件序与 `start(ctx)` 门面上下文、T7 失败回滚能力注册、apply/stop 超时
 *   （`KERNEL_LIFECYCLE_TIMEOUT` phase=apply/stop，§6.1 强制点在 lifecycle 侧生效）、
 *   stop 抛错不阻断撤销（`stopError` 携在册插件码、T9 仍 → installed）；
 * - F 组 原生机制实测（`tests/fixtures/plugin-activation/run-native-cases.mjs` 真 Node
 *   子进程 × 生产通道 × 真波 1 装载器）：service 真装载求值 + `start` 执行 + 门面副作用
 *   （事件发布/能力注册 owner 预绑定/配置冻结快照）逐痕断言、形状不符真模块执行后拒、
 *   `node:*` 真越界白名单拒且插件体零执行、development 锚真篡改拒（package-hash-mismatch）、
 *   builtin 签名再锚定端到端正向激活、通道释放后拒装。全部失败逐码断言
 *   `KERNEL_APPLY_FAILED`/`KERNEL_PLUGIN_NOT_FOUND` + `details.stage/reason`。
 *
 * @remarks
 * - 错误码断言一律引用 `codes.ts` 在册常量（O1 暂定裁定：实施波零新增码）；
 *   `retryable: true` 为 `KERNEL_APPLY_FAILED` 在登记表口径（对确定性拒装的语义钝差属
 *   O1 在册项，非本层裁量）。
 * - F 组装架子进程以原生 Node 启动（vitest 管线的 `import()` 被 vite-node 代管、ESM 钩子
 *   不触发，波 1 开工实测坐实），生产实现文件零改动地经由 Node type-stripping +
 *   `.js`→`.ts` 替身层装载。
 */

import { execFile } from 'node:child_process';
import { generateKeyPairSync, sign as ed25519Sign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterAll, describe, expect, it } from 'vitest';

import { createHostCapabilityRegistry } from '../src/runtime/capability/registry.js';
import type { IPluginActivationContext } from '../src/loader/activation.js';
import { CPK_ERROR_CODES, LIFECYCLE_ERROR_CODES } from '../src/loader/codes.js';
import { LoaderError } from '../src/loader/errors.js';
import {
  createCpkPluginLoader,
  PLUGIN_LIFECYCLE_EVENTS,
  type ICpkPluginLoader,
  type ICpkPluginLoaderDeps,
} from '../src/loader/lifecycle.js';
import {
  MODULE_LOADER_ENTRY_FILE,
  type ICpkModuleLoader,
  type ICpkModuleLoadTarget,
} from '../src/loader/module-loader.js';
import { loadCpkDirectory, membersToZipEntries } from '../src/loader/provider.js';
import { openPluginRegistry } from '../src/loader/registry.js';
import { computeContentHash, sha256Hex, SIGNATURE_FILE } from '../src/loader/signature.js';
import { createTrustRootRegistry, type ITrustRootRegistry } from '../src/loader/trust-roots.js';
import type { IPersistedPluginEntry, PluginRole } from '../src/loader/types.js';
import type { IHostCapabilityDescriptor } from '../src/runtime/capability/contracts.js';
import { createHostPluginActivationChannel, type IHostPluginActivationChannel } from '../src/main/plugin-activation.js';

const execFileAsync = promisify(execFile);

const HARNESS_PATH = fileURLToPath(new URL('./fixtures/plugin-activation/run-native-cases.mjs', import.meta.url));
const ACTIVATION_SOURCE_PATH = fileURLToPath(new URL('../src/main/plugin-activation.ts', import.meta.url));
const LOADER_INDEX_PATH = fileURLToPath(new URL('../src/loader/index.ts', import.meta.url));

/** 剥离块注释与行注释，得到代码面（纪律锁只对代码断言，JSDoc 允许提及码名）。 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const IMPL_TEXT = readFileSync(ACTIVATION_SOURCE_PATH, 'utf8');
const IMPL_CODE = stripComments(IMPL_TEXT);

/** 本套件创建的全部临时工作区（afterAll 统一清理）。 */
const workspaces: string[] = [];

async function makeWorkspace(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  workspaces.push(dir);
  return dir;
}

afterAll(async () => {
  for (const dir of workspaces) {
    await rm(dir, { recursive: true, force: true });
  }
});

/** 写入插件文件树。 */
async function writeTree(base: string, files: Readonly<Record<string, string>>): Promise<void> {
  for (const [relative, content] of Object.entries(files)) {
    const target = join(base, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
}

/** 目录全成员（含 signature.json）包级合并摘要（与装载器门禁同源复算）。 */
async function packageHashOf(root: string): Promise<string> {
  const pkg = await loadCpkDirectory(root);
  return computeContentHash(membersToZipEntries(pkg.members));
}

// ---------------------------------------------------------------------------
// 测试替身：上下文 / 装载器 / 注册表
// ---------------------------------------------------------------------------

interface IStubContextRecord {
  events: { eventId: string; payload: unknown }[];
  registered: string[];
}

function makeContext(
  overrides: {
    pluginId?: string;
    version?: string;
    role?: PluginRole;
    signal?: AbortSignal;
  } = {},
): { context: IPluginActivationContext; record: IStubContextRecord } {
  const record: IStubContextRecord = { events: [], registered: [] };
  const context: IPluginActivationContext = {
    pluginId: overrides.pluginId ?? 'chips.test.plugin',
    version: overrides.version ?? '0.1.0',
    role: overrides.role ?? 'service',
    config: Object.freeze({}),
    signal: overrides.signal ?? new AbortController().signal,
    registerCapability: (descriptor: IHostCapabilityDescriptor): void => {
      record.registered.push(descriptor.id);
    },
    unregisterCapability: (capabilityId: string): void => {
      const index = record.registered.indexOf(capabilityId);
      if (index >= 0) {
        record.registered.splice(index, 1);
      }
    },
    publishEvent: (eventId: string, payload: unknown): void => {
      record.events.push({ eventId, payload });
    },
    registeredCapabilities: () => [...record.registered],
  };
  return { context, record };
}

interface IStubLoaderOptions {
  exportsFor: (target: ICpkModuleLoadTarget) => Record<string, unknown>;
  failure?: Error;
  hang?: boolean;
}

function makeStubLoader(options: IStubLoaderOptions): {
  loader: ICpkModuleLoader;
  calls: ICpkModuleLoadTarget[];
  disposeCount: () => number;
} {
  const calls: ICpkModuleLoadTarget[] = [];
  let disposeCount = 0;
  const loader: ICpkModuleLoader = {
    loadModule: (target) => {
      calls.push(target);
      if (options.failure !== undefined) {
        return Promise.reject(options.failure);
      }
      if (options.hang === true) {
        return new Promise<never>(() => {
          // 永不落定：模拟在途装载（超时撤销由 lifecycle 侧强制）。
        });
      }
      return Promise.resolve({
        pluginId: target.pluginId,
        nonce: `nonce-${calls.length}`,
        entryUrl: `file:///stub/${target.pluginId}/dist/index.js?chips-nonce=nonce-${calls.length}`,
        exports: Object.freeze({ ...options.exportsFor(target) }),
        gateStats: { resolveAllow: 1, resolveReject: 0, loadAllow: 1, loadReject: 0 },
      });
    },
    dispose: (): void => {
      disposeCount += 1;
    },
    get disposed() {
      return disposeCount > 0;
    },
  };
  return { loader, calls, disposeCount: () => disposeCount };
}

function persistedEntry(
  overrides: Partial<IPersistedPluginEntry> & Pick<IPersistedPluginEntry, 'id' | 'path' | 'hash'>,
): IPersistedPluginEntry {
  return {
    version: '0.1.0',
    role: 'service',
    source: 'development',
    dependencies: [],
    permissions: [],
    grantedPermissions: [],
    installedAt: '2026-01-01T00:00:00.000Z',
    enabled: true,
    ...overrides,
  };
}

function makeRegistryStub(entries: readonly IPersistedPluginEntry[]): {
  registry: Pick<import('../src/loader/registry.js').IPluginRegistry, 'get'>;
} {
  const map = new Map(entries.map((entry) => [entry.id, entry]));
  return { registry: { get: (id: string) => map.get(id) } };
}

const EMPTY_SERVICE_DEFAULT = {
  start: (_context: IPluginActivationContext): void => undefined,
  stop: (): void => undefined,
};
const APP_OK_DEFAULT = { launch: () => ({ ok: true }) };

/** 捕获异常（未抛出即失败，绝不静默放行）。 */
async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('预期失败但未抛出');
}

function loaderErrorOf(caught: unknown): LoaderError {
  expect(caught).toBeInstanceOf(LoaderError);
  return caught as LoaderError;
}

function detailsOf(error: LoaderError): Record<string, unknown> {
  return error.details as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// A 组：纪律锁（源码文本面）
// ---------------------------------------------------------------------------

describe('A 组 纪律锁：§6.1 不旁路 / 零自造码 / 导入面封顶 / 契约词表在位', () => {
  it('A1 §6.1 强制点不旁路：实现零 setTimeout、零 AbortController 构造、零 register( 、零动态 import、零 require(', () => {
    for (const banned of ['setTimeout', 'new AbortController', 'register(', 'import(', 'require(']) {
      expect(IMPL_CODE.includes(banned), `实现不得出现旁路面：${banned}`).toBe(false);
    }
    // 只消费 ctx.signal.aborted（协作式取消），不建控制器、不自设时限。
    expect(IMPL_CODE.includes('signal.aborted')).toBe(true);
  });

  it('A2 零自造码：无 KERNEL_/CPK_ 字符串字面量，码面一律经 LIFECYCLE_ERROR_CODES 在册常量', () => {
    expect(/["'`]KERNEL_/.test(IMPL_CODE)).toBe(false);
    expect(/["'`]CPK_/.test(IMPL_CODE)).toBe(false);
    expect(IMPL_CODE.includes('LIFECYCLE_ERROR_CODES.applyFailed')).toBe(true);
    expect(IMPL_CODE.includes('LIFECYCLE_ERROR_CODES.pluginNotFound')).toBe(true);
    // 插件域码判定用形状正则而非码表白名单（在册 `<DOMAIN>_<REASON>` 原样保留，零枚举）。
    expect(IMPL_CODE.includes('^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$')).toBe(true);
  });

  it('A3 导入面封顶：仅经装载器公共入口与线协议面导入，不深入 loader 子目录、不触碰 runtime', () => {
    const specifiers = [...IMPL_CODE.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(
        specifier === '../loader/index.js' || specifier === '../protocol/wire.js',
        `非法导入面：${specifier}`,
      ).toBe(true);
    }
  });

  it('A4 四角色契约与归一 reason 词表在位（波 1 移交欠账②的契约面锁定）', () => {
    expect(IMPL_CODE.includes("'validateConfig', 'createInitialContent', 'collectResourcePaths'")).toBe(true);
    expect(IMPL_CODE.includes("'launch'")).toBe(true);
    expect(IMPL_CODE.includes("'start', 'stop'")).toBe(true);
    for (const reason of [
      'default-export-missing',
      'default-export-not-object',
      'required-method-missing',
      'method-not-function',
      'signature-reanchor',
      'unsafe-source-tree',
      'apply-threw',
      'channel-disposed',
      'context-plugin-mismatch',
      'cancelled',
    ]) {
      expect(IMPL_CODE.includes(`'${reason}'`), `归一 reason 词表缺位：${reason}`).toBe(true);
    }
  });

  it('A5 无临时分支标记：实现代码面零 TODO/FIXME/简化/临时分支字样（JSDoc 叙述面除外）', () => {
    for (const marker of ['TODO', 'FIXME', '简化', '临时分支', 'simplified']) {
      expect(IMPL_CODE.includes(marker), `实现代码不得携带临时标记：${marker}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// B 组：角色形状校验
// ---------------------------------------------------------------------------

function makeChannel(options: {
  entries: readonly IPersistedPluginEntry[];
  exportsFor?: (target: ICpkModuleLoadTarget) => Record<string, unknown>;
  loaderOptions?: Omit<IStubLoaderOptions, 'exportsFor'>;
  trustRoots?: ITrustRootRegistry;
  sessionRoot?: string;
}): { channel: IHostPluginActivationChannel; calls: ICpkModuleLoadTarget[]; stubDispose: () => number } {
  const stub = makeStubLoader({
    exportsFor: options.exportsFor ?? (() => ({})),
    ...(options.loaderOptions ?? {}),
  });
  const channel = createHostPluginActivationChannel({
    pluginRegistry: makeRegistryStub(options.entries).registry,
    trustRoots: options.trustRoots ?? createTrustRootRegistry([]),
    moduleLoader: stub.loader,
    ...(options.sessionRoot === undefined ? {} : { sessionRoot: options.sessionRoot }),
  });
  return { channel, calls: stub.calls, stubDispose: stub.disposeCount };
}

const DEV_ENTRY = persistedEntry({
  id: 'chips.test.plugin',
  path: '/tmp/chips-test-shape-root',
  hash: `sha256:${'a'.repeat(64)}`,
});

describe('B 组 角色形状：default 导出契约逐项判定与入口保管', () => {
  it('B1 default 缺席 → KERNEL_APPLY_FAILED stage=role reason=default-export-missing，无入口保管', async () => {
    const { channel } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({ marker: 1 }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext().context)));
    expect(caught.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
    expect(caught.retryable).toBe(true);
    expect(detailsOf(caught)).toMatchObject({
      pluginId: DEV_ENTRY.id,
      role: 'service',
      stage: 'role',
      reason: 'default-export-missing',
    });
    expect(channel.activatedEntry(DEV_ENTRY.id)).toBeUndefined();
  });

  it('B2 default 非对象 → default-export-not-object', async () => {
    const { channel } = makeChannel({ entries: [DEV_ENTRY], exportsFor: () => ({ default: 'nope' }) });
    const port = channel.activationPortFor({ id: DEV_ENTRY.id, version: '0.1.0', role: 'app', path: DEV_ENTRY.path });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext({ role: 'app' }).context)));
    expect(detailsOf(caught)).toMatchObject({ stage: 'role', reason: 'default-export-not-object' });
  });

  it('B3 basecard 必含方法缺席 → required-method-missing + method 指名', async () => {
    const { channel } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({
        default: { validateConfig: () => ({}), collectResourcePaths: () => [] },
      }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'basecard',
      path: DEV_ENTRY.path,
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext({ role: 'basecard' }).context)));
    expect(caught.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
    expect(detailsOf(caught)).toMatchObject({
      stage: 'role',
      reason: 'required-method-missing',
      method: 'createInitialContent',
      role: 'basecard',
    });
  });

  it('B4 boxlayout validateConfig 非函数 → method-not-function', async () => {
    const { channel } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({ default: { validateConfig: true } }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'boxlayout',
      path: DEV_ENTRY.path,
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext({ role: 'boxlayout' }).context)));
    expect(detailsOf(caught)).toMatchObject({ stage: 'role', reason: 'method-not-function', method: 'validateConfig' });
  });

  it('B5 app 仅 launch 必填即形状通过；入口保管可取（nonce/entryUrl/形状快照）', async () => {
    const { channel } = makeChannel({ entries: [DEV_ENTRY], exportsFor: () => ({ default: { ...APP_OK_DEFAULT } }) });
    const port = channel.activationPortFor({ id: DEV_ENTRY.id, version: '0.1.0', role: 'app', path: DEV_ENTRY.path });
    await port.apply(makeContext({ role: 'app' }).context);
    const activated = channel.activatedEntry(DEV_ENTRY.id);
    expect(activated).toBeDefined();
    expect(activated?.role).toBe('app');
    expect(activated?.version).toBe('0.1.0');
    expect(activated?.nonce).toBe('nonce-1');
    expect(activated?.entryUrl).toContain('?chips-nonce=nonce-1');
    expect(Object.keys(activated?.entry ?? {}).sort()).toEqual(['launch']);
  });

  it('B6 service 可选方法出现即必须为函数（health 非函数 → method-not-function）', async () => {
    const { channel } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({ default: { ...EMPTY_SERVICE_DEFAULT, health: 42 } }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext().context)));
    expect(detailsOf(caught)).toMatchObject({ stage: 'role', reason: 'method-not-function', method: 'health' });
    expect(channel.activatedEntry(DEV_ENTRY.id)).toBeUndefined();
  });

  it('B7 service 全形状：apply 调 start(ctx)，stop 调 stop() 且会话清空、复停幂等', async () => {
    let startCount = 0;
    let stopCount = 0;
    let received: IPluginActivationContext | undefined;
    const { channel } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({
        default: {
          start: (context: IPluginActivationContext): void => {
            startCount += 1;
            received = context;
          },
          stop: (): void => {
            stopCount += 1;
          },
        },
      }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const { context } = makeContext();
    await port.apply(context);
    expect(startCount).toBe(1);
    // start(ctx) 的参数即激活上下文门面本体（RFC §3.1A 副作用登记面）。
    expect(received).toBe(context);
    await port.stop(context);
    expect(stopCount).toBe(1);
    expect(channel.activatedEntry(DEV_ENTRY.id)).toBeUndefined();
    // 无会话的 stop = 幂等空操作（不再触插件回调）。
    await port.stop(context);
    expect(stopCount).toBe(1);
  });

  it('B8 非 service 角色 apply 零方法执行（注册数据源是 manifest，不执行插件注册代码）', async () => {
    let calls = 0;
    const { channel } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({
        default: {
          validateConfig: (): void => {
            calls += 1;
          },
          createInitialContent: (): void => {
            calls += 1;
          },
          collectResourcePaths: (): void => {
            calls += 1;
          },
        },
      }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'basecard',
      path: DEV_ENTRY.path,
    });
    await port.apply(makeContext({ role: 'basecard' }).context);
    expect(calls).toBe(0);
    expect(channel.activatedEntry(DEV_ENTRY.id)?.role).toBe('basecard');
    // 停用非 service 角色：无插件回调可执行，会话保管随之释放。
    await port.stop(makeContext({ role: 'basecard' }).context);
    expect(channel.activatedEntry(DEV_ENTRY.id)).toBeUndefined();
  });

  it('B9 signal 预中止：激活取消（stage=activation reason=cancelled），取数与装载零触达', async () => {
    const { channel, calls } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({ default: { ...APP_OK_DEFAULT } }),
    });
    const controller = new AbortController();
    controller.abort();
    const port = channel.activationPortFor({ id: DEV_ENTRY.id, version: '0.1.0', role: 'app', path: DEV_ENTRY.path });
    const caught = loaderErrorOf(
      await captureError(port.apply(makeContext({ role: 'app', signal: controller.signal }).context)),
    );
    expect(caught.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
    expect(detailsOf(caught)).toMatchObject({ stage: 'activation', reason: 'cancelled' });
    expect(calls).toHaveLength(0);
  });

  it('B10 端口绑定与上下文身份不一致 → 确定性拒绝（装配错位不吞）', async () => {
    const { channel } = makeChannel({ entries: [DEV_ENTRY] });
    const port = channel.activationPortFor({
      id: 'chips.test.other',
      version: '0.1.0',
      role: 'service',
      path: '/tmp/other',
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext({ pluginId: DEV_ENTRY.id }).context)));
    expect(detailsOf(caught)).toMatchObject({ stage: 'role', reason: 'context-plugin-mismatch' });
  });

  it('B11 通道释放：apply 拒（stage=channel reason=channel-disposed）、stop 幂等空操作、注入装载器不代释放', async () => {
    const { channel, stubDispose } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({ default: { ...APP_OK_DEFAULT } }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const { context } = makeContext();
    channel.dispose();
    channel.dispose(); // 幂等
    const caught = loaderErrorOf(await captureError(port.apply(context)));
    expect(detailsOf(caught)).toMatchObject({ stage: 'channel', reason: 'channel-disposed' });
    await port.stop(context); // 释放后停用面不报错、不残留会话
    expect(stubDispose()).toBe(0); // 注入实例的释放归注入方
  });
});

// ---------------------------------------------------------------------------
// C 组：§5.1 失败语义归一与通道活性（vitest 内真实失败）
// ---------------------------------------------------------------------------

describe('C 组 §5.1 失败语义：逐码归一、在册插件码原样保留、真通道 fail-closed', () => {
  it('C1 装载器 LoaderError 同实例透传（波 1 已按 §5.1 归一，本层不二次包裹）', async () => {
    const boom = new LoaderError(LIFECYCLE_ERROR_CODES.applyFailed, {
      message: '插件装载被门禁拒绝（whitelist：node-builtin）',
      details: { stage: 'whitelist', reason: 'node-builtin' },
    });
    const { channel } = makeChannel({ entries: [DEV_ENTRY], loaderOptions: { failure: boom } });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const caught = await captureError(port.apply(makeContext().context));
    expect(caught).toBe(boom);
  });

  it('C2 注册表未命中 → KERNEL_PLUGIN_NOT_FOUND（retryable=false 确定性失败，不伪装可重试）', async () => {
    const { channel, calls } = makeChannel({ entries: [] });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext().context)));
    expect(caught.code).toBe(LIFECYCLE_ERROR_CODES.pluginNotFound);
    expect(caught.retryable).toBe(false);
    expect(detailsOf(caught)).toMatchObject({ pluginId: DEV_ENTRY.id });
    expect(calls).toHaveLength(0);
  });

  it('C3 插件 start 抛 ChipsError 同构在册形状域码（APP_*）→ 同实例原样保留（§5.1 行 5）', async () => {
    const refusal = Object.assign(new Error('服务拒绝启动'), {
      name: 'ChipsError',
      code: 'APP_LAUNCH_DENIED',
      retryable: false,
    });
    const { channel } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({
        default: {
          ...EMPTY_SERVICE_DEFAULT,
          start: (): void => {
            throw refusal;
          },
        },
      }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const caught = await captureError(port.apply(makeContext().context));
    expect(caught).toBe(refusal);
    // 失败即无会话残留（可重试语义由码主自证）。
    expect(channel.activatedEntry(DEV_ENTRY.id)).toBeUndefined();
  });

  it('C4 插件 start 抛普通异常 → 归一 KERNEL_APPLY_FAILED，原文只进 details.cause 不落 message', async () => {
    const { channel } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({
        default: {
          ...EMPTY_SERVICE_DEFAULT,
          start: (): void => {
            throw new Error('插件内部炸了');
          },
        },
      }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext().context)));
    expect(caught.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
    expect(caught.message).not.toContain('插件内部炸了');
    expect(detailsOf(caught)).toMatchObject({
      pluginId: DEV_ENTRY.id,
      stage: 'plugin',
      reason: 'apply-threw',
      cause: '插件内部炸了',
    });
  });

  it('C5 stop 面同纪律：在册形状域码原样传播（会话已先清），非形状异常归一', async () => {
    const refusal = Object.assign(new Error('拒绝停用'), {
      name: 'ChipsError',
      code: 'APP_STOP_REFUSED',
      retryable: true,
    });
    const { channel } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({
        default: {
          ...EMPTY_SERVICE_DEFAULT,
          stop: (): void => {
            throw refusal;
          },
        },
      }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const { context } = makeContext();
    await port.apply(context);
    const caught = await captureError(port.stop(context));
    expect(caught).toBe(refusal);
    expect(channel.activatedEntry(DEV_ENTRY.id)).toBeUndefined();

    const { channel: channel2 } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({
        default: {
          ...EMPTY_SERVICE_DEFAULT,
          stop: (): void => {
            throw new Error('停用炸了');
          },
        },
      }),
    });
    const port2 = channel2.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const context2 = makeContext().context;
    await port2.apply(context2);
    const caught2 = loaderErrorOf(await captureError(port2.stop(context2)));
    expect(caught2.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
    expect(detailsOf(caught2)).toMatchObject({ stage: 'plugin', reason: 'apply-threw', cause: '停用炸了' });
    expect(channel2.activatedEntry(DEV_ENTRY.id)).toBeUndefined();
  });

  it('C6 非在册形状（缺 retryable 的小写码错误）→ 归一 applyFailed，不冒充在册码', async () => {
    const odd = Object.assign(new Error('形状不足'), { code: 'lowercase_code' });
    const { channel } = makeChannel({
      entries: [DEV_ENTRY],
      exportsFor: () => ({
        default: {
          ...EMPTY_SERVICE_DEFAULT,
          start: (): void => {
            throw odd;
          },
        },
      }),
    });
    const port = channel.activationPortFor({
      id: DEV_ENTRY.id,
      version: '0.1.0',
      role: 'service',
      path: DEV_ENTRY.path,
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext().context)));
    expect(caught.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
    expect(detailsOf(caught)).toMatchObject({ stage: 'plugin', reason: 'apply-threw' });
  });

  it('C7 真 createCpkModuleLoader × vitest 代管 import：通道活性 fail-closed 真实失败（不冒充成功）', async () => {
    const workspace = await makeWorkspace('chips-w2-c7-');
    const root = join(workspace, 'plugins', 'real-loader');
    await writeTree(root, {
      [MODULE_LOADER_ENTRY_FILE]: 'export default { async start() {}, async stop() {} };\n',
    });
    const hash = await packageHashOf(root);
    const entry = persistedEntry({ id: 'chips.test.real-loader', path: root, hash });
    const channel = createHostPluginActivationChannel({
      pluginRegistry: makeRegistryStub([entry]).registry,
      trustRoots: createTrustRootRegistry([]),
      sessionRoot: join(workspace, 'sessions'),
    });
    try {
      const port = channel.activationPortFor({ id: entry.id, version: '0.1.0', role: 'service', path: root });
      const caught = loaderErrorOf(await captureError(port.apply(makeContext({ pluginId: entry.id }).context)));
      expect(caught.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
      // 被代管的 import 不经 ESM 钩子链 → 波 1 fail-closed 口径原样透传（§5.1 通道行）。
      expect(detailsOf(caught)).toMatchObject({ stage: 'channel', reason: 'not-live' });
      expect(channel.activatedEntry(entry.id)).toBeUndefined();
    } finally {
      channel.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// D 组：O1 归档再锚定（真注册表 + 真信任根 + 真 Ed25519 夹具）
// ---------------------------------------------------------------------------

/** 归档字节摘要哨兵（≠ 目录合并摘要：直接递交必然被波 1 复算误拒的口径差代表）。 */
function archiveDigestSentinel(label: string): string {
  return `sha256:${sha256Hex(new TextEncoder().encode(`archive-bytes:${label}`))}`;
}

interface ITestKey {
  keyId: string;
  spkiPem: string;
  sign: (contentHash: string) => string;
}

function makeTestSigningKey(keyId: string): ITestKey {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const spkiPem = String(publicKey.export({ type: 'spki', format: 'pem' }));
  return {
    keyId,
    spkiPem,
    sign: (contentHash: string): string =>
      ed25519Sign(null, Buffer.from(contentHash, 'utf8'), privateKey).toString('base64'),
  };
}

/** 目录夹具按 chips-signature-v1 追加 signature.json（除 signature.json 外全成员摘要）。 */
async function signPluginDir(dir: string, key: ITestKey): Promise<void> {
  const pkg = await loadCpkDirectory(dir);
  const unsigned = new Map([...pkg.members].filter(([path]) => path !== SIGNATURE_FILE));
  const contentHash = computeContentHash(membersToZipEntries(unsigned));
  const document = {
    format: 'chips-signature-v1',
    keyId: key.keyId,
    algorithm: 'ed25519',
    contentHash,
    signature: key.sign(contentHash),
  };
  await writeFile(join(dir, SIGNATURE_FILE), JSON.stringify(document), 'utf8');
}

describe('D 组 O1 归档再锚定：激活取数路径按来源归一期望摘要', () => {
  const key = makeTestSigningKey('w2-test-key-1');
  const SERVICE_EXPORTS = { default: { ...EMPTY_SERVICE_DEFAULT } };

  async function setupD(options: {
    source: 'builtin' | 'user' | 'development';
    signed: boolean;
    recordHash: string;
    trustRootKeys?: ITestKey[];
    extraFiles?: Record<string, string>;
    tamperAfterSign?: boolean;
  }): Promise<{
    entry: IPersistedPluginEntry;
    dir: string;
    channel: IHostPluginActivationChannel;
    calls: ICpkModuleLoadTarget[];
    registryHash: string;
  }> {
    const workspace = await makeWorkspace('chips-w2-d-');
    const dir = join(workspace, 'pkg');
    await writeTree(dir, {
      [MODULE_LOADER_ENTRY_FILE]: 'export default { async start() {}, async stop() {} };\n',
      'chips.plugin.json': '{"id":"chips.test.o1"}\n',
      ...(options.extraFiles ?? {}),
    });
    if (options.signed) {
      await signPluginDir(dir, key);
    }
    if (options.tamperAfterSign === true) {
      await writeFile(
        join(dir, MODULE_LOADER_ENTRY_FILE),
        'export default { async start() {}, async stop() {}, tampered: true };\n',
        'utf8',
      );
    }
    const registryFilePath = join(workspace, 'registry.json');
    const registry = await openPluginRegistry({ filePath: registryFilePath });
    const entry = persistedEntry({
      id: 'chips.test.plugin',
      path: dir,
      source: options.source,
      hash: options.recordHash,
    });
    await registry.upsert(entry);
    const trustRoots = createTrustRootRegistry(
      (options.trustRootKeys ?? [key]).map((item) => ({
        keyId: item.keyId,
        algorithm: 'ed25519' as const,
        spkiPem: item.spkiPem,
        source: 'injected' as const,
      })),
    );
    const stub = makeStubLoader({ exportsFor: () => SERVICE_EXPORTS });
    const channel = createHostPluginActivationChannel({
      pluginRegistry: registry,
      trustRoots,
      moduleLoader: stub.loader,
    });
    const mergedHash = await packageHashOf(dir);
    return { entry, dir, channel, calls: stub.calls, registryHash: mergedHash };
  }

  async function applyEntry(setup: {
    entry: IPersistedPluginEntry;
    channel: IHostPluginActivationChannel;
  }): Promise<void> {
    const port = setup.channel.activationPortFor({
      id: setup.entry.id,
      version: setup.entry.version,
      role: 'service',
      path: setup.entry.path,
    });
    await port.apply(makeContext({ pluginId: setup.entry.id }).context);
  }

  it('D1 development：record.hash 原样递交（目录态即合并摘要口径，真防篡改锚不动）', async () => {
    const sentinel = `sha256:${'b'.repeat(64)}`;
    const setup = await setupD({ source: 'development', signed: false, recordHash: sentinel });
    await applyEntry(setup);
    expect(setup.calls).toHaveLength(1);
    // 原样透传实证：递交值即注册表存储哨兵，未做目录重算替换。
    expect(setup.calls[0]?.expectedPackageHash).toBe(sentinel);
    expect(setup.calls[0]?.rootDir).toBe(setup.dir);
  });

  it('D2 builtin 签名：再锚定后递交装后目录全成员合并摘要（≠ 归档字节摘要，O1 误拒消除）', async () => {
    const archiveSentinel = archiveDigestSentinel('builtin-clean');
    const setup = await setupD({ source: 'builtin', signed: true, recordHash: archiveSentinel });
    await applyEntry(setup);
    expect(setup.calls).toHaveLength(1);
    expect(setup.calls[0]?.expectedPackageHash).toBe(setup.registryHash);
    expect(setup.calls[0]?.expectedPackageHash).not.toBe(archiveSentinel);
    expect(setup.channel.activatedEntry(setup.entry.id)).toBeDefined();
  });

  it('D3 builtin 签名后篡改文件 → 确定性拒装（integrity + causeCode=CPK_SIGNATURE_INVALID），装载零触达', async () => {
    const setup = await setupD({
      source: 'builtin',
      signed: true,
      recordHash: archiveDigestSentinel('tampered'),
      tamperAfterSign: true,
    });
    const port = setup.channel.activationPortFor({
      id: setup.entry.id,
      version: '0.1.0',
      role: 'service',
      path: setup.entry.path,
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext().context)));
    expect(caught.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
    const details = detailsOf(caught);
    expect(details).toMatchObject({
      pluginId: setup.entry.id,
      stage: 'integrity',
      reason: 'signature-reanchor',
      causeCode: CPK_ERROR_CODES.signatureInvalid,
    });
    expect(typeof details.causeMessage).toBe('string');
    expect(setup.calls).toHaveLength(0);
    expect(setup.channel.activatedEntry(setup.entry.id)).toBeUndefined();
  });

  it('D4 builtin 缺 signature.json → causeCode=CPK_SIGNATURE_REQUIRED 归一（确定性拒绝不伪装可重试面）', async () => {
    const setup = await setupD({
      source: 'builtin',
      signed: false,
      recordHash: archiveDigestSentinel('unsigned-builtin'),
    });
    const port = setup.channel.activationPortFor({
      id: setup.entry.id,
      version: '0.1.0',
      role: 'service',
      path: setup.entry.path,
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext().context)));
    expect(detailsOf(caught)).toMatchObject({
      stage: 'integrity',
      reason: 'signature-reanchor',
      causeCode: CPK_ERROR_CODES.signatureRequired,
    });
    expect(setup.calls).toHaveLength(0);
  });

  it('D5 user：签名臂与未签名发布者臂均递交目录合并重算摘要', async () => {
    const signedSetup = await setupD({
      source: 'user',
      signed: true,
      recordHash: archiveDigestSentinel('user-signed'),
    });
    await applyEntry(signedSetup);
    expect(signedSetup.calls[0]?.expectedPackageHash).toBe(signedSetup.registryHash);

    const unsignedSetup = await setupD({
      source: 'user',
      signed: false,
      recordHash: archiveDigestSentinel('user-unsigned'),
    });
    await applyEntry(unsignedSetup);
    // 未签名发布者无持久摘要锚可用：取同一重算口径（O1 固有缝登记，非本层裁量）。
    expect(unsignedSetup.calls[0]?.expectedPackageHash).toBe(unsignedSetup.registryHash);
  });

  it('D6 签名 keyId 不在信任根表 → causeCode=CPK_SIGNATURE_INVALID 确定性拒', async () => {
    const setup = await setupD({
      source: 'user',
      signed: true,
      recordHash: archiveDigestSentinel('unknown-key'),
      trustRootKeys: [],
    });
    const port = setup.channel.activationPortFor({
      id: setup.entry.id,
      version: '0.1.0',
      role: 'service',
      path: setup.entry.path,
    });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext().context)));
    expect(detailsOf(caught)).toMatchObject({
      stage: 'integrity',
      reason: 'signature-reanchor',
      causeCode: CPK_ERROR_CODES.signatureInvalid,
    });
    expect(setup.calls).toHaveLength(0);
  });

  it('D7 源树符号链接（目录重放不可信）→ reason=unsafe-source-tree + causeCode=CPK_PATH_UNSAFE', async () => {
    const workspace = await makeWorkspace('chips-w2-d7-');
    const dir = join(workspace, 'pkg');
    await writeTree(dir, { [MODULE_LOADER_ENTRY_FILE]: 'export default { async start() {}, async stop() {} };\n' });
    await writeFile(join(workspace, 'outside.txt'), 'outside\n', 'utf8');
    await symlink(join(workspace, 'outside.txt'), join(dir, 'link.txt'));
    const registry = await openPluginRegistry({ filePath: join(workspace, 'registry.json') });
    const entry = persistedEntry({
      id: 'chips.test.plugin',
      path: dir,
      source: 'builtin',
      hash: archiveDigestSentinel('symlink'),
    });
    await registry.upsert(entry);
    const stub = makeStubLoader({ exportsFor: () => ({}) });
    const channel = createHostPluginActivationChannel({
      pluginRegistry: registry,
      trustRoots: createTrustRootRegistry([
        { keyId: key.keyId, algorithm: 'ed25519', spkiPem: key.spkiPem, source: 'injected' },
      ]),
      moduleLoader: stub.loader,
    });
    const port = channel.activationPortFor({ id: entry.id, version: '0.1.0', role: 'service', path: entry.path });
    const caught = loaderErrorOf(await captureError(port.apply(makeContext().context)));
    expect(detailsOf(caught)).toMatchObject({
      stage: 'integrity',
      reason: 'unsafe-source-tree',
      causeCode: CPK_ERROR_CODES.pathUnsafe,
    });
    expect(stub.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// E 组：lifecycle 状态机集成（真 createCpkPluginLoader × 本通道）
// ---------------------------------------------------------------------------

interface IServiceCallRecord {
  startCount: number;
  stopCount: number;
  contexts: IPluginActivationContext[];
  startImpl?: (context: IPluginActivationContext) => void | Promise<void>;
  stopImpl?: () => void | Promise<void>;
}

function serviceEntryFrom(record: IServiceCallRecord): Record<string, unknown> {
  return {
    start: async (context: IPluginActivationContext): Promise<void> => {
      record.contexts.push(context);
      record.startCount += 1;
      if (record.startImpl !== undefined) {
        await record.startImpl(context);
      }
    },
    stop: async (): Promise<void> => {
      record.stopCount += 1;
      if (record.stopImpl !== undefined) {
        await record.stopImpl();
      }
    },
  };
}

interface IEHarness {
  loader: ICpkPluginLoader;
  channel: IHostPluginActivationChannel;
  record: IServiceCallRecord;
  calls: ICpkModuleLoadTarget[];
  events: { id: string; payload: unknown }[];
  caps: ReturnType<typeof createHostCapabilityRegistry>;
  id: string;
}

async function createEHarness(
  loaderOptions: { hang?: boolean } = {},
  timeouts: { applyMs: number; stopMs: number } = { applyMs: 150, stopMs: 150 },
): Promise<IEHarness> {
  const base = await makeWorkspace('chips-w2-e-');
  const id = 'chips.example.w2svc';
  const registryFilePath = join(base, 'registry.json');
  const registry = await openPluginRegistry({ filePath: registryFilePath });
  const caps = createHostCapabilityRegistry();
  const events: { id: string; payload: unknown }[] = [];
  const record: IServiceCallRecord = { startCount: 0, stopCount: 0, contexts: [] };
  const stub = makeStubLoader({
    exportsFor: () => ({ default: serviceEntryFrom(record) }),
    ...(loaderOptions.hang === true ? { hang: true } : {}),
  });
  const channel = createHostPluginActivationChannel({
    pluginRegistry: registry,
    trustRoots: createTrustRootRegistry([]),
    moduleLoader: stub.loader,
  });
  const deps: ICpkPluginLoaderDeps = {
    pluginsRoot: join(base, 'plugins'),
    registry,
    hostCapabilityRegistry: caps,
    emitEvent: (eventId, payload) => {
      events.push({ id: eventId, payload });
    },
    hostVersion: '0.1.0',
    trustRoots: createTrustRootRegistry([]),
    timeouts,
    activationPortFor: (plugin) => channel.activationPortFor(plugin),
  };
  const loader = createCpkPluginLoader(deps);
  // 开发目录态最小 service 插件（渠道跳签名，走正式 install 流水线）。
  const sourceRoot = join(base, 'source');
  await mkdir(join(sourceRoot, 'dist'), { recursive: true });
  await writeFile(
    join(sourceRoot, 'manifest.yaml'),
    `id: ${id}\nversion: 0.1.0\ntype: service\nname: 波2示例服务\nruntime:\n  targets: [host]\n  background: true\n`,
    'utf8',
  );
  await writeFile(join(sourceRoot, 'dist', 'index.js'), 'export const ready = true;\n', 'utf8');
  await loader.install({ pkg: await loadCpkDirectory(sourceRoot), source: 'development' });
  return { loader, channel, record, calls: stub.calls, events, caps, id };
}

function failuresOf(harness: IEHarness): readonly { pluginId: string; code: string }[] {
  return harness.events
    .filter((event) => event.id === PLUGIN_LIFECYCLE_EVENTS.failed)
    .map((event) => {
      const payload = event.payload as { pluginId: string; error: { code: string } };
      return { pluginId: payload.pluginId, code: payload.error.code };
    });
}

describe('E 组 lifecycle 集成：本通道经 activationPortFor 注入正式状态机（§6.1 强制点在 lifecycle 侧）', () => {
  it('E1 T2/T6/T8/T9 全链：start(ctx) 收门面上下文、事件序完整、停用后入口释放', async () => {
    const harness = await createEHarness();
    const record = await harness.loader.enable(harness.id);
    expect(record.state).toBe('active');
    expect(harness.record.startCount).toBe(1);
    const context = harness.record.contexts[0];
    expect(context?.pluginId).toBe(harness.id);
    expect(context?.role).toBe('service');
    expect(context?.config).toEqual({}); // 命名空间未登记 → 生效值空对象（10 §2.5）
    expect(Object.isFrozen(context?.config)).toBe(true);
    expect(context?.signal).toBeInstanceOf(AbortSignal);
    expect(typeof context?.registerCapability).toBe('function');
    expect(harness.calls[0]?.expectedPackageHash).toBe(record.hash); // development 原样锚
    expect(harness.channel.activatedEntry(harness.id)?.role).toBe('service');
    expect(harness.events.map((event) => event.id)).toEqual([
      PLUGIN_LIFECYCLE_EVENTS.installed,
      PLUGIN_LIFECYCLE_EVENTS.loaded,
      PLUGIN_LIFECYCLE_EVENTS.enabled,
    ]);

    const disableResult = await harness.loader.disable(harness.id);
    expect(disableResult.record.state).toBe('installed');
    expect(disableResult.stopError).toBeUndefined();
    expect(harness.record.stopCount).toBe(1);
    expect(harness.channel.activatedEntry(harness.id)).toBeUndefined();
    expect(harness.events.slice(-2).map((event) => event.id)).toEqual([
      PLUGIN_LIFECYCLE_EVENTS.disabled,
      PLUGIN_LIFECYCLE_EVENTS.unloaded,
    ]);
  });

  it('E2 T7：start 内注册能力后抛错 → applyFailed 归一、能力回滚、failed 事件同码、retry 可恢复', async () => {
    const harness = await createEHarness();
    harness.record.startImpl = (context): void => {
      context.registerCapability({ id: 'demo:w2rollback', permissions: [], handler: () => Promise.resolve({}) });
      throw new Error('激活内部炸了');
    };
    const caught = loaderErrorOf(await captureError(harness.loader.enable(harness.id)));
    expect(caught.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
    expect(detailsOf(caught)).toMatchObject({ stage: 'plugin', reason: 'apply-threw', cause: '激活内部炸了' });
    expect(harness.loader.get(harness.id)?.state).toBe('failed');
    expect(harness.caps.get('demo:w2rollback')).toBeUndefined(); // 副作用回滚（§4.3 T7）
    expect(failuresOf(harness)).toEqual([{ pluginId: harness.id, code: 'KERNEL_APPLY_FAILED' }]);
    expect(harness.channel.activatedEntry(harness.id)).toBeUndefined();

    // T11 retry：故障解除后经同一通道重新激活成功。
    harness.record.startImpl = (): void => undefined;
    const retried = await harness.loader.retry(harness.id);
    expect(retried.state).toBe('active');
    expect(harness.record.startCount).toBe(2);
  });

  it('E3 apply 装载在途超时：KERNEL_LIFECYCLE_TIMEOUT（details.phase=apply）→ failed，通道不自设时限', async () => {
    const harness = await createEHarness({ hang: true }, { applyMs: 80, stopMs: 80 });
    const caught = loaderErrorOf(await captureError(harness.loader.enable(harness.id)));
    expect(caught.code).toBe(LIFECYCLE_ERROR_CODES.lifecycleTimeout);
    expect(detailsOf(caught)).toMatchObject({ pluginId: harness.id, phase: 'apply', timeoutMs: 80 });
    expect(harness.loader.get(harness.id)?.state).toBe('failed');
    expect(harness.channel.activatedEntry(harness.id)).toBeUndefined();
  });

  it('E4 stop 抛在册形状域码：不阻断撤销（T9 仍 → installed）、stopError 原样携码上报', async () => {
    const harness = await createEHarness();
    await harness.loader.enable(harness.id);
    harness.record.stopImpl = (): never => {
      throw Object.assign(new Error('拒绝停用'), {
        name: 'ChipsError',
        code: 'APP_STOP_REFUSED',
        retryable: false,
      });
    };
    const disableResult = await harness.loader.disable(harness.id);
    expect(disableResult.record.state).toBe('installed');
    expect(disableResult.stopError).toMatchObject({ code: 'APP_STOP_REFUSED', retryable: false });
    expect(harness.channel.activatedEntry(harness.id)).toBeUndefined();
    expect(failuresOf(harness)).toEqual([]); // 停用失败不入 failed、不发 plugin:failed
  });

  it('E5 stop 超时：KERNEL_LIFECYCLE_TIMEOUT（details.phase=stop）随停用结果上报，撤销不阻断', async () => {
    const harness = await createEHarness();
    await harness.loader.enable(harness.id);
    harness.record.stopImpl = (): Promise<void> =>
      new Promise<never>(() => {
        // 永不落定：10s 上限的注入等形，由 lifecycle 强制撤销。
      });
    const disableResult = await harness.loader.disable(harness.id);
    expect(disableResult.record.state).toBe('installed');
    expect(disableResult.stopError).toMatchObject({
      code: 'KERNEL_LIFECYCLE_TIMEOUT',
      details: { pluginId: harness.id, phase: 'stop', timeoutMs: 150 },
    });
  });

  it('E6 停用幂等（T9 无会话路径）：未经激活直接 disable 后 stop 空操作不报错', async () => {
    const harness = await createEHarness();
    await harness.loader.enable(harness.id);
    const context = makeContext().context;
    // 模拟 enable/disable 两侧各取端口的会话共享：disable 前经端口先行手动 stop。
    const earlyPort = harness.channel.activationPortFor({
      id: harness.id,
      version: '0.1.0',
      role: 'service',
      path: '',
    });
    await earlyPort.stop({ ...context, pluginId: harness.id });
    expect(harness.record.stopCount).toBe(1);
    const disableResult = await harness.loader.disable(harness.id);
    expect(disableResult.record.state).toBe('installed');
    expect(disableResult.stopError).toBeUndefined();
    // 会话已被手动 stop 清空：lifecycle 侧 stop 走幂等空操作臂。
    expect(harness.record.stopCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// F 组：原生机制实测（真通道求值，子进程 × 生产 API）
// ---------------------------------------------------------------------------

interface WireShape {
  name: string | null;
  code: string | null;
  message: string;
  retryable: boolean | null;
  details: Record<string, unknown> | null;
}

interface NativeDoc {
  fatal: WireShape | null;
  results: Record<string, unknown>;
}

type NativeOp =
  | { op: 'channel'; as: string; sessionRoot: string }
  | { op: 'apply'; as: string; pluginId: string }
  | { op: 'stop'; as: string; pluginId: string }
  | { op: 'writeFile'; as: string; path: string; text: string }
  | { op: 'globals'; as: string; names: string[] }
  | { op: 'dispose'; as: string; pluginId: string };

interface ActivatedSnapshot {
  pluginId: string;
  version: string;
  role: PluginRole;
  nonce: string;
  entryUrl: string;
  entryKeys: string[];
}

interface ApplyOutcome {
  ok: boolean;
  activatedEntry: ActivatedSnapshot | null;
  capabilities?: { id: string; owner: string }[];
  events?: { eventId: string; payload: Record<string, unknown> }[];
  wire?: WireShape;
}

function resultOf(doc: NativeDoc, key: string): unknown {
  const value = doc.results[key];
  if (value === undefined) {
    throw new Error(`子进程结果缺失：${key}`);
  }
  return value;
}

function expectWireFailure(
  wire: WireShape | undefined,
  code: string,
  stage: string,
  reason: string,
): Record<string, unknown> {
  expect(wire, '失败结果必须携带线协议序列化').toBeDefined();
  const error = wire as WireShape;
  expect(error.name).toBe('ChipsError');
  expect(error.code).toBe(code);
  const details = error.details as Record<string, unknown>;
  expect(details.stage).toBe(stage);
  expect(details.reason).toBe(reason);
  return details;
}

const F_PLUGIN = {
  svc: 'com.chips.w2.svc',
  shape: 'com.chips.w2.shape',
  whitelist: 'com.chips.w2.whitelist',
  tamper: 'com.chips.w2.tamper',
  signed: 'com.chips.w2.signed',
} as const;

const SVC_ENTRY = `globalThis.__F_SVC_EVAL__ = (globalThis.__F_SVC_EVAL__ ?? 0) + 1;
export const extra = 'e';
export default {
  async start(ctx) {
    globalThis.__F_SVC_STARTED__ = ctx.pluginId;
    ctx.publishEvent('demo:started', { v: 1 });
    ctx.publishEvent('demo:config', { greeting: ctx.config.greeting, frozen: Object.isFrozen(ctx.config) });
    ctx.registerCapability({ id: 'demo:fsvc', permissions: [], handler: async () => ({ ok: 1 }) });
  },
  async stop() {
    globalThis.__F_SVC_STOPPED__ = true;
  },
};
`;

const SHAPE_ENTRY = `globalThis.__F_SHAPE_RAN__ = 1;
export default {
  validateConfig: () => ({ valid: true }),
  collectResourcePaths: () => [],
};
`;

const WHITELIST_ENTRY = `import { readFileSync } from 'node:fs';
globalThis.__F_WL_RAN__ = 1;
export default { async start() { void readFileSync; }, async stop() {} };
`;

const TAMPER_ENTRY = `export default { async start() {}, async stop() {} };
`;

it('F1 原生真通道全链：service 真装载求值+start 执行+门面副作用逐痕 / 形状不符执行后拒 / node:* 零执行拒 / development 锚真篡改拒 / builtin 签名再锚定端到端 / 释放后拒装', async () => {
  const workspace = await makeWorkspace('chips-w2-f-');
  const fKey = makeTestSigningKey('w2-f-key');
  const roots: Record<string, string> = {};
  for (const name of ['svc', 'shape', 'whitelist', 'tamper', 'signed']) {
    roots[name] = join(workspace, 'plugins', name);
  }
  await writeTree(roots.svc ?? '', { [MODULE_LOADER_ENTRY_FILE]: SVC_ENTRY });
  await writeTree(roots.shape ?? '', { [MODULE_LOADER_ENTRY_FILE]: SHAPE_ENTRY });
  await writeTree(roots.whitelist ?? '', { [MODULE_LOADER_ENTRY_FILE]: WHITELIST_ENTRY });
  await writeTree(roots.tamper ?? '', {
    [MODULE_LOADER_ENTRY_FILE]: TAMPER_ENTRY,
    'data.txt': 'original\n',
  });
  await writeTree(roots.signed ?? '', { [MODULE_LOADER_ENTRY_FILE]: SVC_ENTRY });
  await signPluginDir(roots.signed ?? '', fKey);

  const svcHash = await packageHashOf(roots.svc ?? '');
  const shapeHash = await packageHashOf(roots.shape ?? '');
  const whitelistHash = await packageHashOf(roots.whitelist ?? '');
  const tamperHash = await packageHashOf(roots.tamper ?? ''); // 篡改前快照 = 注册表锚
  // builtin 归档态 record.hash 不承载目录摘要（口径差即 O1 再锚定的对象），故此处只给哨兵。

  const registryFilePath = join(workspace, 'registry.json');
  const registry = await openPluginRegistry({ filePath: registryFilePath });
  await registry.upsert(
    persistedEntry({ id: F_PLUGIN.svc, path: roots.svc ?? '', source: 'development', hash: svcHash }),
  );
  await registry.upsert(
    persistedEntry({
      id: F_PLUGIN.shape,
      path: roots.shape ?? '',
      source: 'development',
      hash: shapeHash,
      role: 'basecard',
    }),
  );
  await registry.upsert(
    persistedEntry({ id: F_PLUGIN.whitelist, path: roots.whitelist ?? '', source: 'development', hash: whitelistHash }),
  );
  await registry.upsert(
    persistedEntry({ id: F_PLUGIN.tamper, path: roots.tamper ?? '', source: 'development', hash: tamperHash }),
  );
  await registry.upsert(
    persistedEntry({
      id: F_PLUGIN.signed,
      path: roots.signed ?? '',
      source: 'builtin',
      hash: archiveDigestSentinel('f-signed'),
    }),
  );

  const ops: NativeOp[] = [
    { op: 'channel', as: 'channel', sessionRoot: join(workspace, 'sessions') },
    { op: 'apply', as: 'svcApply', pluginId: F_PLUGIN.svc },
    { op: 'globals', as: 'svcPreStop', names: ['__F_SVC_STARTED__', '__F_SVC_STOPPED__'] },
    { op: 'stop', as: 'svcStop', pluginId: F_PLUGIN.svc },
    { op: 'globals', as: 'svcPostStop', names: ['__F_SVC_STOPPED__'] },
    { op: 'apply', as: 'shapeApply', pluginId: F_PLUGIN.shape },
    { op: 'apply', as: 'wlApply', pluginId: F_PLUGIN.whitelist },
    { op: 'globals', as: 'execMarkers', names: ['__F_SHAPE_RAN__', '__F_WL_RAN__'] },
    { op: 'writeFile', as: 'tamper', path: join(roots.tamper ?? '', 'data.txt'), text: 'tampered-after-install\n' },
    { op: 'apply', as: 'tamperApply', pluginId: F_PLUGIN.tamper },
    { op: 'apply', as: 'signedApply', pluginId: F_PLUGIN.signed },
    { op: 'globals', as: 'signedGlobals', names: ['__F_SVC_STARTED__'] },
    { op: 'stop', as: 'signedStop', pluginId: F_PLUGIN.signed },
    { op: 'dispose', as: 'dispose', pluginId: F_PLUGIN.svc },
    { op: 'apply', as: 'afterDispose', pluginId: F_PLUGIN.svc },
  ];

  const argsPath = join(workspace, 'args.json');
  const outFile = join(workspace, 'out.json');
  await writeFile(
    argsPath,
    JSON.stringify({
      outFile,
      registryFile: registryFilePath,
      sources: { activation: ACTIVATION_SOURCE_PATH, loaderIndex: LOADER_INDEX_PATH },
      trustRootKeys: [{ keyId: fKey.keyId, algorithm: 'ed25519', spkiPem: fKey.spkiPem, source: 'injected' }],
      ops,
    }),
    'utf8',
  );
  try {
    await execFileAsync(process.execPath, [HARNESS_PATH, argsPath], {
      env: {},
      timeout: 100_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    if (!existsSync(outFile)) {
      const detail =
        error instanceof Error
          ? `${error.message}\nstderr: ${(error as { stderr?: string }).stderr ?? ''}`
          : String(error);
      throw new Error(`原生实测子进程未产出结果文件：${detail}`);
    }
  }
  const doc: NativeDoc = JSON.parse(await readFile(outFile, 'utf8')) as NativeDoc;
  expect(doc.fatal, `子进程夹具级致命错误：${JSON.stringify(doc.fatal)}`).toBeNull();

  // 真 service 激活：模块求值 + start 执行 + 门面副作用（事件/配置冻结快照/能力 owner 预绑定）。
  const svcApply = resultOf(doc, 'svcApply') as ApplyOutcome;
  expect(svcApply.ok).toBe(true);
  expect(svcApply.activatedEntry).toMatchObject({
    pluginId: F_PLUGIN.svc,
    role: 'service',
    version: '0.1.0',
  });
  expect(svcApply.activatedEntry?.entryKeys).toEqual(['start', 'stop']);
  expect(svcApply.activatedEntry?.entryUrl).toContain(`?chips-nonce=${svcApply.activatedEntry?.nonce}`);
  expect(svcApply.events).toEqual([
    { eventId: 'demo:started', payload: { v: 1 } },
    { eventId: 'demo:config', payload: { greeting: 'hi', frozen: true } },
  ]);
  expect(svcApply.capabilities).toEqual([{ id: 'demo:fsvc', owner: F_PLUGIN.svc }]);
  const svcPreStop = resultOf(doc, 'svcPreStop') as Record<string, unknown>;
  expect(svcPreStop.__F_SVC_STARTED__).toBe(F_PLUGIN.svc);
  expect(svcPreStop.__F_SVC_STOPPED__).toBeNull();
  const svcStop = resultOf(doc, 'svcStop') as ApplyOutcome;
  expect(svcStop.ok).toBe(true);
  expect(svcStop.activatedEntry).toBeNull();
  const svcPostStop = resultOf(doc, 'svcPostStop') as Record<string, unknown>;
  expect(svcPostStop.__F_SVC_STOPPED__).toBe(true);

  // 形状不符（真模块执行后判定）：插件体已求值（执行后拒是诚实语义），入口不保管。
  const shapeApply = resultOf(doc, 'shapeApply') as ApplyOutcome;
  expect(shapeApply.ok).toBe(false);
  const shapeDetails = expectWireFailure(
    shapeApply.wire,
    LIFECYCLE_ERROR_CODES.applyFailed,
    'role',
    'required-method-missing',
  );
  expect(shapeDetails.method).toBe('createInitialContent');
  expect(shapeApply.activatedEntry).toBeNull();

  // 白名单真越界（node:*）：resolve 钩确定性拒、插件体零执行（§5.1 行 1）。
  const wlApply = resultOf(doc, 'wlApply') as ApplyOutcome;
  expect(wlApply.ok).toBe(false);
  const wlDetails = expectWireFailure(wlApply.wire, LIFECYCLE_ERROR_CODES.applyFailed, 'whitelist', 'node-builtin');
  expect(wlDetails.gateStats).toMatchObject({ resolveReject: 1, loadReject: 0 });
  expect(wlApply.activatedEntry).toBeNull();

  // 执行痕语义：形状不符 = 真模块求值后拒（标记置位）；白名单越界 = 插件体零执行（标记缺席）。
  const execMarkers = resultOf(doc, 'execMarkers') as Record<string, unknown>;
  expect(execMarkers.__F_SHAPE_RAN__).toBe(1);
  expect(execMarkers.__F_WL_RAN__).toBeNull();

  // development 真锚篡改拒：注册表锚原样递交，装载器包级复算拒（防篡改锚未被再锚定臂稀释）。
  const tamperApply = resultOf(doc, 'tamperApply') as ApplyOutcome;
  expect(tamperApply.ok).toBe(false);
  expectWireFailure(tamperApply.wire, LIFECYCLE_ERROR_CODES.applyFailed, 'integrity', 'package-hash-mismatch');
  expect(tamperApply.activatedEntry).toBeNull();

  // builtin 归档态端到端：签名再锚定 × 真装载 × start 执行（同一 ESM 求值进程内
  // `__F_SVC_STARTED__` 被 f5 重新置位——nonce 复加载重执行模块体）。
  const signedApply = resultOf(doc, 'signedApply') as ApplyOutcome;
  expect(signedApply.ok, `builtin 再锚定端到端必须成功：${JSON.stringify(signedApply.wire)}`).toBe(true);
  expect(signedApply.activatedEntry?.pluginId).toBe(F_PLUGIN.signed);
  const signedGlobals = resultOf(doc, 'signedGlobals') as Record<string, unknown>;
  expect(signedGlobals.__F_SVC_STARTED__).toBe(F_PLUGIN.signed);
  const signedStop = resultOf(doc, 'signedStop') as ApplyOutcome;
  expect(signedStop.ok).toBe(true);

  // 通道释放：会话清空、后续激活确定性拒。
  const disposed = resultOf(doc, 'dispose') as { ok: boolean; activated: ActivatedSnapshot | null };
  expect(disposed.ok).toBe(true);
  expect(disposed.activated).toBeNull();
  const afterDispose = resultOf(doc, 'afterDispose') as ApplyOutcome;
  expect(afterDispose.ok).toBe(false);
  expectWireFailure(afterDispose.wire, LIFECYCLE_ERROR_CODES.applyFailed, 'channel', 'channel-disposed');
}, 120_000);
