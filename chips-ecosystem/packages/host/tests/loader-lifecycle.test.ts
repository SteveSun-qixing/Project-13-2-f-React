/**
 * 插件生命周期状态机单测（计划书测试面第 3 条全量；任务 #56 段二阶段五交付）。
 *
 * 覆盖：T1–T14 全迁移（enable 首启用授权快照、重复启用幂等、pending 依赖等待 → 就绪自动续、
 * pending 取消、failed retry、apply 超时 `KERNEL_LIFECYCLE_TIMEOUT`、stop 超时 10s 不阻断撤销、
 * 非法迁移 `KERNEL_INVALID_TRANSITION`、卸载前置、依赖级联拒绝 `KERNEL_DEPENDENCY_CONFLICT`、
 * 依赖版本互斥 `KERNEL_DEPENDENCY_VERSION`、依赖环 `KERNEL_DEPENDENCY_CYCLE`）；§4.6 启动恢复
 * 矩阵（拓扑序启用、失败隔离、pending 保持、遮蔽与偏好清理、starting/stopping 残留回滚）；
 * service 激活经正式端口注册能力 → Bridge 路由真实链路调用（不绕行）；`plugin:loaded`
 * payload 与 `plugin:*` 事件序。
 *
 * @remarks
 * - 插件包经开发目录态构造（`development` 渠道跳过归档与签名两阶段）；激活通道以测试内
 *   `IPluginActivationPort` 实现注入（正式内核通道属工单 025；波 3 起组合根默认接线
 *   波 2 正式通道，本套件的端口注入位即显式覆盖口，S6 口径）；超时上限注入等形小值，
 *   默认口径仍取 `limits.ts`（30s/10s，由契约套件锁定）。
 * - 激活失败归一（波 3 裁定，RFC §5.1 第五行）：在册形状 Error（真 `Error` +
 *   `code` 形如 `<DOMAIN>_<REASON>` + 布尔 `retryable`）在 T7 面原样透传不再包壳；
 *   非在册形状归一 `KERNEL_APPLY_FAILED`（原文只进 `details.cause`）。
 * - 错误码一律取自 `codes.ts` 登记码；断言只增不减零放宽。
 */

import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHostCapabilityRegistry } from '../src/runtime/capability/registry.js';
import { createHostCallScheduler } from '../src/runtime/capability/scheduler.js';
import { createHostCapabilityRouter } from '../src/runtime/capability/router.js';
import type { IHostSession } from '../src/runtime/capability/contracts.js';
import {
  createPluginActivationContext,
  type IPluginActivationContext,
  type IPluginActivationPort,
} from '../src/loader/activation.js';
import { LoaderError } from '../src/loader/errors.js';
import {
  createCpkPluginLoader,
  PLUGIN_LIFECYCLE_EVENTS,
  type ICpkPluginLoader,
  type ICpkPluginLoaderDeps,
} from '../src/loader/lifecycle.js';
import { openPluginRegistry } from '../src/loader/registry.js';
import { loadCpkArchive, loadCpkDirectory, type ICpkPackage } from '../src/loader/provider.js';
import { createTrustRootRegistryFromDocument, type ITrustRootRegistry } from '../src/loader/trust-roots.js';

function fixtureAsset(relative: string): string {
  return fileURLToPath(new URL(`../../../tests/e2e/fixtures/cpk/${relative}`, import.meta.url));
}

const HOST_VERSION = '0.1.0';
const TEST_TIMEOUTS = { applyMs: 200, stopMs: 200 } as const;
const tempRoots: string[] = [];

afterAll(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })));
});

let trustRoots: ITrustRootRegistry;
let helloArchive: ICpkPackage;

beforeAll(async () => {
  trustRoots = createTrustRootRegistryFromDocument(
    JSON.parse(readFileSync(fixtureAsset('keys/trust-roots.json'), 'utf8')) as unknown,
    'fixture',
  );
  helloArchive = await loadCpkArchive(fixtureAsset('packages/hello-0.1.0.cpk'));
});

/** 端口脚本：按插件 ID 提供 apply/stop 行为。 */
type IPortScript = Omit<Partial<IPluginActivationPort>, 'apply' | 'stop'> & {
  apply?: (context: IPluginActivationContext) => Promise<void> | void;
  stop?: (context: IPluginActivationContext) => Promise<void> | void;
};

interface ILoaderHarness {
  readonly loader: ICpkPluginLoader;
  readonly deps: ICpkPluginLoaderDeps;
  readonly pluginsRoot: string;
  readonly base: string;
  readonly events: { id: string; payload: unknown }[];
  readonly capabilityRegistry: ReturnType<typeof createHostCapabilityRegistry>;
  readonly ports: Map<string, IPortScript>;
  readonly contexts: IPluginActivationContext[];
  readonly registryFilePath: string;
}

async function createHarness(
  overrides: Partial<{ [K in keyof ICpkPluginLoaderDeps]: ICpkPluginLoaderDeps[K] | undefined }> = {},
): Promise<ILoaderHarness> {
  const base = await mkdtemp(join(tmpdir(), 'cpk-lifecycle-'));
  tempRoots.push(base);
  const pluginsRoot = join(base, 'plugins');
  const registryFilePath = join(base, 'registry.json');
  const events: { id: string; payload: unknown }[] = [];
  const capabilityRegistry = createHostCapabilityRegistry();
  const ports = new Map<string, IPortScript>();
  const contexts: IPluginActivationContext[] = [];
  const registry = await openPluginRegistry({ filePath: registryFilePath });
  const deps: ICpkPluginLoaderDeps = {
    pluginsRoot,
    registry,
    hostCapabilityRegistry: capabilityRegistry,
    emitEvent: (id, payload) => {
      events.push({ id, payload });
    },
    hostVersion: HOST_VERSION,
    trustRoots,
    timeouts: TEST_TIMEOUTS,
    activationPortFor: (plugin) => {
      const script = ports.get(plugin.id);
      if (script === undefined) {
        return undefined;
      }
      return {
        apply: async (context) => {
          contexts.push(context);
          await script.apply?.(context);
        },
        stop: async (context) => {
          await script.stop?.(context);
        },
      };
    },
  };
  // 显式传 undefined 的键表示「移除该依赖」（exactOptionalPropertyTypes 下用
  // Object.assign 覆写而非字面量展开）。
  Object.assign(deps, overrides);
  const loader = createCpkPluginLoader(deps);
  return { loader, deps, pluginsRoot, base, events, capabilityRegistry, ports, contexts, registryFilePath };
}

/** 开发目录态最小 service 插件（可携带依赖声明）。 */
async function writeServicePlugin(
  root: string,
  id: string,
  version: string,
  dependencies: readonly { readonly id: string; readonly version: string }[] = [],
): Promise<string> {
  const pluginRoot = join(root, `${id}-${version}`);
  await mkdir(join(pluginRoot, 'dist'), { recursive: true });
  const dependencyLines = dependencies
    .map((dependency) => `  - id: ${dependency.id}\n    version: "${dependency.version}"`)
    .join('\n');
  const dependencyBlock =
    dependencies.length > 0 ? `dependencies:\n${dependencyLines}\n` : '';
  await writeFile(
    join(pluginRoot, 'manifest.yaml'),
    `id: ${id}\nversion: ${version}\ntype: service\nname: 示例服务\nruntime:\n  targets: [host]\n  background: true\n${dependencyBlock}`,
    'utf8',
  );
  await writeFile(join(pluginRoot, 'dist', 'index.js'), 'export const ready = true;\n', 'utf8');
  return pluginRoot;
}

async function installServicePlugin(
  harness: ILoaderHarness,
  id: string,
  version: string,
  dependencies: readonly { readonly id: string; readonly version: string }[] = [],
  enabled = false,
): Promise<void> {
  const pluginRoot = await writeServicePlugin(harness.base, id, version, dependencies);
  const pkg = await loadCpkDirectory(pluginRoot);
  await harness.loader.install({ pkg, source: 'development', enabled });
}

function eventsOf(harness: ILoaderHarness, id: string): readonly string[] {
  return harness.events.filter((event) => event.id === id).map((event) => event.id);
}

function failuresOf(harness: ILoaderHarness): readonly { pluginId: string; code: string }[] {
  return harness.events
    .filter((event) => event.id === PLUGIN_LIFECYCLE_EVENTS.failed)
    .map((event) => {
      const payload = event.payload as { pluginId: string; error: { code: string } };
      return { pluginId: payload.pluginId, code: payload.error.code };
    });
}

/** 开发目录态 app 插件（ui.surface: window，无 launcher 图标校验路径依赖）。 */
async function writeAppPlugin(root: string, id: string, version: string): Promise<string> {
  const pluginRoot = join(root, `${id}-${version}`);
  await mkdir(join(pluginRoot, 'dist'), { recursive: true });
  await mkdir(join(pluginRoot, 'assets', 'icons'), { recursive: true });
  await writeFile(
    join(pluginRoot, 'manifest.yaml'),
    `id: ${id}\nversion: ${version}\ntype: app\nname: 示例应用\nruntime:\n  targets: [host]\nui:\n  surface: window\n  launcher:\n    icon: assets/icons/app.svg\n    name: 示例应用\n`,
    'utf8',
  );
  await writeFile(join(pluginRoot, 'dist', 'index.js'), 'export const ready = true;\n', 'utf8');
  await writeFile(join(pluginRoot, 'render.js'), 'export const render = () => null;\n', 'utf8');
  await writeFile(
    join(pluginRoot, 'assets', 'icons', 'app.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>\n',
    'utf8',
  );
  return pluginRoot;
}

describe('T2/T6/T8/T9：启用 → active → 停用 → installed', () => {
  it('启用成功：状态 active、授权快照、事件序 installed → loaded → enabled，偏好写入', async () => {
    const harness = await createHarness();
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    harness.ports.set(id, { apply: () => undefined, stop: () => undefined });

    // 首启用授权快照：安装不产生授权（grantedPermissions 为空集合），启用快照取注册表授权。
    const record = await harness.loader.enable(id);
    expect(record.state).toBe('active');
    expect(record.activatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record.grantedPermissions).toEqual([]);

    expect(harness.events.map((event) => event.id)).toEqual([
      PLUGIN_LIFECYCLE_EVENTS.installed,
      PLUGIN_LIFECYCLE_EVENTS.loaded,
      PLUGIN_LIFECYCLE_EVENTS.enabled,
    ]);
    const loaded = harness.events.find((event) => event.id === PLUGIN_LIFECYCLE_EVENTS.loaded);
    expect(loaded?.payload).toStrictEqual({ pluginId: id, version: '0.1.0', role: 'service' });

    // 停用：T8 → T9，偏好关闭，事件 disabled → unloaded。
    const disableResult = await harness.loader.disable(id);
    expect(disableResult.record.state).toBe('installed');
    expect(disableResult.record.activatedAt).toBeUndefined();
    expect(disableResult.stopError).toBeUndefined();
    expect(harness.events.slice(-2).map((event) => event.id)).toEqual([
      PLUGIN_LIFECYCLE_EVENTS.disabled,
      PLUGIN_LIFECYCLE_EVENTS.unloaded,
    ]);

    // 再次启用：快照随注册表授权集合更新。
    await harness.deps.registry.setGrantedPermissions(id, ['command:write']);
    const reenabled = await harness.loader.enable(id);
    expect(reenabled.grantedPermissions).toEqual(['command:write']);
  });

  it('重复启用幂等：active/pending/starting 下 enable 直接成功且不重复发事件', async () => {
    const harness = await createHarness();
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    harness.ports.set(id, { apply: () => undefined });
    await harness.loader.enable(id);
    const loadedCount = eventsOf(harness, PLUGIN_LIFECYCLE_EVENTS.loaded).length;
    const again = await harness.loader.enable(id);
    expect(again.state).toBe('active');
    expect(eventsOf(harness, PLUGIN_LIFECYCLE_EVENTS.loaded)).toHaveLength(loadedCount);
  });

  it('starting 可随时被 disable 取消：副作用回收、无 failed 事件、enable 落定 installed', async () => {
    const harness = await createHarness();
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    harness.ports.set(id, {
      apply: async (context) => {
        context.registerCapability({
          id: 'demo:slow',
          permissions: [],
          handler: () => Promise.resolve({}),
        });
        await new Promise<void>((resolve) => {
          context.signal.addEventListener('abort', () => resolve(), { once: true });
        });
      },
    });
    const enablePromise = harness.loader.enable(id);
    await expect
      .poll(() => harness.loader.get(id)?.state, { timeout: 2_000 })
      .toBe('starting');
    const disableResult = await harness.loader.disable(id);
    expect(disableResult.record.state).toBe('installed');
    const settled = await enablePromise;
    expect(settled.state).toBe('installed');
    expect(harness.capabilityRegistry.get('demo:slow')).toBeUndefined();
    expect(failuresOf(harness)).toEqual([]);
  });
});

describe('T3/T4/T5：pending 依赖等待、就绪自动续与取消', () => {
  it('依赖未安装 → pending（T3）；依赖启用成功后自动续跑（T4，loaded 序 A 先于 B）', async () => {
    const harness = await createHarness();
    const a = 'chips.example.dep';
    const b = 'chips.example.dependent';
    await installServicePlugin(harness, b, '0.1.0', [{ id: a, version: '>=0.1.0' }]);
    harness.ports.set(a, { apply: () => undefined });
    harness.ports.set(b, { apply: () => undefined });

    const pending = await harness.loader.enable(b);
    expect(pending.state).toBe('pending');
    // pending 不执行任何插件代码：未产生激活上下文。
    expect(harness.contexts).toHaveLength(0);

    await installServicePlugin(harness, a, '0.1.0');
    const activeA = await harness.loader.enable(a);
    expect(activeA.state).toBe('active');
    // T4：依赖就绪后 B 自动继续激活。
    await expect.poll(() => harness.loader.get(b)?.state, { timeout: 2_000 }).toBe('active');
    const loadedOrder = harness.events
      .filter((event) => event.id === PLUGIN_LIFECYCLE_EVENTS.loaded)
      .map((event) => (event.payload as { pluginId: string }).pluginId);
    expect(loadedOrder).toEqual([a, b]);
  });

  it('依赖处于 pending/failed 时等待；pending 可被 disable 取消（T5）', async () => {
    const harness = await createHarness();
    const a = 'chips.example.dep';
    const b = 'chips.example.dependent';
    await installServicePlugin(harness, a, '0.1.0');
    await installServicePlugin(harness, b, '0.1.0', [{ id: a, version: '>=0.1.0' }]);
    // A 处于 failed：B 的启用请求转入 pending 等待恢复。
    // 在册形状域码 Error（波 3 透传臂）：A 的失败码原样上抛，不再被改写为 KERNEL_APPLY_FAILED。
    harness.ports.set(a, {
      apply: () => {
        throw Object.assign(new Error('激活失败'), { code: 'APP_COMMAND_FAILED', retryable: true });
      },
    });
    await expect(harness.loader.enable(a)).rejects.toMatchObject({
      code: 'APP_COMMAND_FAILED',
      retryable: true,
    });
    // 落册 `lastError` 与 `plugin:failed` 同为透传码（§5.1 原样保留，无信息损耗）。
    expect(harness.loader.get(a)?.lastError).toMatchObject({ code: 'APP_COMMAND_FAILED', retryable: true });
    expect(failuresOf(harness)).toEqual([{ pluginId: a, code: 'APP_COMMAND_FAILED' }]);
    harness.ports.set(b, { apply: () => undefined });
    const waiting = await harness.loader.enable(b);
    expect(waiting.state).toBe('pending');

    const cancelled = await harness.loader.disable(b);
    expect(cancelled.record.state).toBe('installed');
  });
});

describe('T7/T11：激活失败、副作用回滚与 retry', () => {
  it('apply 抛错（非在册形状）→ failed（KERNEL_APPLY_FAILED）、能力回滚、plugin:failed payload；retry → active', async () => {
    const harness = await createHarness();
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    harness.ports.set(id, {
      apply: (context) => {
        context.registerCapability({
          id: 'demo:broken',
          permissions: [],
          handler: () => Promise.resolve({}),
        });
        // 非在册形状（真 Error 无域码/布尔 retryable）：维持归一（波 3 裁定后半句），
        // 原文只进 details.cause。
        throw new Error('激活失败');
      },
    });
    let caught: unknown;
    try {
      await harness.loader.enable(id);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoaderError);
    expect((caught as LoaderError).code).toBe('KERNEL_APPLY_FAILED');
    expect((caught as LoaderError).details).toMatchObject({ pluginId: id, cause: '激活失败' });
    const failed = harness.loader.get(id);
    expect(failed?.state).toBe('failed');
    expect(failed?.lastError).toMatchObject({ code: 'KERNEL_APPLY_FAILED', message: '插件激活失败' });
    expect(failed?.activatedAt).toBeUndefined();
    // 副作用回滚：激活期间注册的能力已摘除。
    expect(harness.capabilityRegistry.get('demo:broken')).toBeUndefined();
    expect(failuresOf(harness)).toEqual([{ pluginId: id, code: 'KERNEL_APPLY_FAILED' }]);

    // T11：failed → retry → starting → active。
    harness.ports.set(id, { apply: () => undefined });
    const retried = await harness.loader.retry(id);
    expect(retried.state).toBe('active');
  });

  it('在册形状 Error 原样透传（波 3 裁定 / RFC §5.1 第五行）：同实例上抛、码与 retryable/details 零损耗', async () => {
    const harness = await createHarness();
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    const domainError = Object.assign(new Error('应用态不可用'), {
      code: 'APP_STATE_INVALID',
      retryable: true,
      details: { reason: 'quota-exhausted' },
    });
    harness.ports.set(id, {
      apply: (context) => {
        context.registerCapability({
          id: 'demo:passthrough-rollback',
          permissions: [],
          handler: () => Promise.resolve({}),
        });
        throw domainError;
      },
    });
    let caught: unknown;
    try {
      await harness.loader.enable(id);
    } catch (error) {
      caught = error;
    }
    // 原样透传：同一实例上抛，不再包壳为 LoaderError（波 2 端口边界同形口径）。
    expect(caught).toBe(domainError);
    expect(caught).not.toBeInstanceOf(LoaderError);
    const failed = harness.loader.get(id);
    expect(failed?.state).toBe('failed');
    // 落册与事件载荷保留原码、原 retryable 与 details（信息零损耗）。
    expect(failed?.lastError).toMatchObject({
      code: 'APP_STATE_INVALID',
      message: '应用态不可用',
      retryable: true,
      details: { reason: 'quota-exhausted' },
    });
    // 回滚与状态机其余语义不变。
    expect(harness.capabilityRegistry.get('demo:passthrough-rollback')).toBeUndefined();
    expect(failuresOf(harness)).toEqual([{ pluginId: id, code: 'APP_STATE_INVALID' }]);

    harness.ports.set(id, { apply: () => undefined });
    const retried = await harness.loader.retry(id);
    expect(retried.state).toBe('active');
  });

  it('apply 超时：KERNEL_LIFECYCLE_TIMEOUT（details.phase=apply）→ failed', async () => {
    const harness = await createHarness();
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    harness.ports.set(id, {
      apply: () =>
        new Promise<void>(() => {
          // 永不落定，由装载器超时强制撤销（ctx.signal 已被中止）。
        }),
    });
    let caught: unknown;
    try {
      await harness.loader.enable(id);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoaderError);
    const failure = caught as LoaderError;
    expect(failure.code).toBe('KERNEL_LIFECYCLE_TIMEOUT');
    expect(failure.details).toMatchObject({ pluginId: id, phase: 'apply', timeoutMs: 200 });
    expect(harness.loader.get(id)?.state).toBe('failed');
    expect(failuresOf(harness)).toEqual([{ pluginId: id, code: 'KERNEL_LIFECYCLE_TIMEOUT' }]);
  });

  it('stop 超时不阻断撤销：仍进入 installed，KERNEL_LIFECYCLE_TIMEOUT 随停用结果上报', async () => {
    const harness = await createHarness();
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    harness.ports.set(id, {
      apply: (context) => {
        context.registerCapability({
          id: 'demo:echo',
          permissions: [],
          handler: () => Promise.resolve({}),
        });
      },
      stop: () =>
        new Promise<void>(() => {
          // 停用回调超时（10s 上限的注入等形），不阻断强制撤销。
        }),
    });
    await harness.loader.enable(id);
    const disableResult = await harness.loader.disable(id);
    expect(disableResult.record.state).toBe('installed');
    expect(disableResult.stopError).toMatchObject({
      code: 'KERNEL_LIFECYCLE_TIMEOUT',
      details: { pluginId: id, phase: 'stop', timeoutMs: 200 },
    });
    // 强制撤销：能力随停用摘除（04.24 §9.1）。
    expect(harness.capabilityRegistry.get('demo:echo')).toBeUndefined();
    expect(eventsOf(harness, PLUGIN_LIFECYCLE_EVENTS.disabled)).toHaveLength(1);
    expect(eventsOf(harness, PLUGIN_LIFECYCLE_EVENTS.unloaded)).toHaveLength(1);
  });
});

describe('T12/T13：卸载前置与 builtin 拒绝', () => {
  it('卸载：目录删除、注册表移除、事件 unloaded → uninstalled；重复卸载未命中', async () => {
    const harness = await createHarness();
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    await harness.loader.uninstall(id);
    expect(harness.loader.get(id)).toBeUndefined();
    const rootEntries = (await readdir(harness.pluginsRoot)).filter(
      (name) => name !== '.cpk-install-tmp',
    );
    expect(rootEntries).toEqual([]);
    expect(harness.events.slice(-2).map((event) => event.id)).toEqual([
      PLUGIN_LIFECYCLE_EVENTS.unloaded,
      PLUGIN_LIFECYCLE_EVENTS.uninstalled,
    ]);
    await expect(harness.loader.uninstall(id)).rejects.toMatchObject({
      code: 'KERNEL_PLUGIN_NOT_FOUND',
    });
  });

  it('active 卸载拒绝（T13）；存在依赖者拒绝；builtin 来源拒绝', async () => {
    const harness = await createHarness();
    const a = 'chips.example.dep';
    const b = 'chips.example.dependent';
    await installServicePlugin(harness, a, '0.1.0');
    await installServicePlugin(harness, b, '0.1.0', [{ id: a, version: '>=0.1.0' }]);

    // §4.5[2]：存在已安装依赖者，卸载拒绝并列出依赖者。
    await expect(harness.loader.uninstall(a)).rejects.toMatchObject({
      code: 'KERNEL_DEPENDENCY_CONFLICT',
      details: { pluginId: a, dependents: [b] },
    });

    // T13：active/stopping 必须先停用。
    harness.ports.set(a, { apply: () => undefined });
    await harness.loader.enable(a);
    await expect(harness.loader.uninstall(a)).rejects.toMatchObject({
      code: 'KERNEL_INVALID_TRANSITION',
      details: { pluginId: a, state: 'active' },
    });

    // builtin 来源不可卸载（§4.5 规则；夹具签名在信任根内，可按 builtin 渠道安装）。
    const builtin = await harness.loader.install({ pkg: helloArchive, source: 'builtin' });
    await expect(harness.loader.uninstall(builtin.id)).rejects.toMatchObject({
      code: 'KERNEL_INVALID_TRANSITION',
      details: { source: 'builtin' },
    });
  });
});

describe('依赖冲突域：级联拒绝、版本互斥与环', () => {
  it('存在 active 依赖者：默认拒绝（KERNEL_DEPENDENCY_CONFLICT）；显式级联逆拓扑先停依赖者', async () => {
    const harness = await createHarness();
    const a = 'chips.example.dep';
    const b = 'chips.example.dependent';
    await installServicePlugin(harness, a, '0.1.0');
    await installServicePlugin(harness, b, '0.1.0', [{ id: a, version: '>=0.1.0' }]);
    harness.ports.set(a, { apply: () => undefined, stop: () => undefined });
    harness.ports.set(b, { apply: () => undefined, stop: () => undefined });
    await harness.loader.enable(a);
    await harness.loader.enable(b);

    let caught: unknown;
    try {
      await harness.loader.disable(a);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LoaderError);
    expect((caught as LoaderError).code).toBe('KERNEL_DEPENDENCY_CONFLICT');
    expect((caught as LoaderError).details).toMatchObject({ pluginId: a, dependents: [b] });

    await harness.loader.disable(a, { cascade: true });
    const disabledOrder = harness.events
      .filter((event) => event.id === PLUGIN_LIFECYCLE_EVENTS.disabled)
      .map((event) => (event.payload as { pluginId: string }).pluginId);
    expect(disabledOrder).toEqual([b, a]);
    expect(harness.loader.get(a)?.state).toBe('installed');
    expect(harness.loader.get(b)?.state).toBe('installed');
  });

  it('依赖版本范围不可满足：KERNEL_DEPENDENCY_VERSION → failed（§4.3[4]）', async () => {
    const harness = await createHarness();
    const a = 'chips.example.dep';
    const b = 'chips.example.dependent';
    await installServicePlugin(harness, a, '0.1.0');
    await installServicePlugin(harness, b, '0.1.0', [{ id: a, version: '>=9.0.0' }]);
    harness.ports.set(a, { apply: () => undefined });
    harness.ports.set(b, { apply: () => undefined });
    await expect(harness.loader.enable(b)).rejects.toMatchObject({
      code: 'KERNEL_DEPENDENCY_VERSION',
      details: { pluginId: b, dependencyId: a, required: '>=9.0.0', actual: '0.1.0' },
    });
    expect(harness.loader.get(b)?.state).toBe('failed');
  });

  it('依赖环：KERNEL_DEPENDENCY_CYCLE → failed（内核 §6.2）', async () => {
    const harness = await createHarness();
    const a = 'chips.example.cycle-a';
    const b = 'chips.example.cycle-b';
    await installServicePlugin(harness, a, '0.1.0', [{ id: b, version: '>=0.1.0' }]);
    await installServicePlugin(harness, b, '0.1.0', [{ id: a, version: '>=0.1.0' }]);
    harness.ports.set(a, { apply: () => undefined });
    harness.ports.set(b, { apply: () => undefined });
    await expect(harness.loader.enable(a)).rejects.toMatchObject({
      code: 'KERNEL_DEPENDENCY_CYCLE',
    });
    expect(harness.loader.get(a)?.state).toBe('failed');
  });
});

describe('迁移守卫与未命中', () => {
  it('未命中：enable/disable/uninstall/retry 未知 ID → KERNEL_PLUGIN_NOT_FOUND', async () => {
    const harness = await createHarness();
    await expect(harness.loader.enable('chips.missing')).rejects.toMatchObject({
      code: 'KERNEL_PLUGIN_NOT_FOUND',
    });
    await expect(harness.loader.disable('chips.missing')).rejects.toMatchObject({
      code: 'KERNEL_PLUGIN_NOT_FOUND',
    });
    await expect(harness.loader.uninstall('chips.missing')).rejects.toMatchObject({
      code: 'KERNEL_PLUGIN_NOT_FOUND',
    });
    await expect(harness.loader.retry('chips.missing')).rejects.toMatchObject({
      code: 'KERNEL_PLUGIN_NOT_FOUND',
    });
  });

  it('retry 仅接受 failed；failed 不可 disable（KERNEL_INVALID_TRANSITION）', async () => {
    const harness = await createHarness();
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    await expect(harness.loader.retry(id)).rejects.toMatchObject({
      code: 'KERNEL_INVALID_TRANSITION',
    });
    harness.ports.set(id, {
      apply: () => {
        // 在册形状（含 KERNEL_* 同构域码 + 布尔 retryable）：透传臂命中，原实例上抛。
        throw Object.assign(new Error('激活失败'), { code: 'KERNEL_APPLY_FAILED', retryable: false });
      },
    });
    await expect(harness.loader.enable(id)).rejects.toMatchObject({
      code: 'KERNEL_APPLY_FAILED',
      retryable: false,
    });
    expect(harness.loader.get(id)?.lastError).toMatchObject({ code: 'KERNEL_APPLY_FAILED', retryable: false });
    await expect(harness.loader.disable(id)).rejects.toMatchObject({
      code: 'KERNEL_INVALID_TRANSITION',
    });
  });
});

describe('激活通道缺位诚实降级（波 3 口径收窄：通道构造失败臂，RFC §3.2.2 S2 / 工单 025）', () => {
  // 波 3 起组合根默认接线波 2 正式通道（恒返回端口），本臂仅覆盖「注入位缺位/
  // 通道构造失败」的诚实降级路径：enable 报 BRIDGE_INTERNAL，不伪造空实现。
  it('activationPortFor 未注入：enable 报内部错误 BRIDGE_INTERNAL，插件落 failed 并发布 plugin:failed', async () => {
    const harness = await createHarness({ activationPortFor: undefined });
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    await expect(harness.loader.enable(id)).rejects.toMatchObject({
      code: 'BRIDGE_INTERNAL',
    });
    const failed = harness.loader.get(id);
    expect(failed?.state).toBe('failed');
    expect(failed?.lastError).toMatchObject({ code: 'BRIDGE_INTERNAL' });
    expect(failuresOf(harness)).toEqual([{ pluginId: id, code: 'BRIDGE_INTERNAL' }]);
  });
});

describe('激活上下文：角色约束、配置快照与事件发布', () => {
  it('非 service 角色注册能力 → 激活失败（KERNEL_APPLY_FAILED，04.24 §9.1）', async () => {
    const harness = await createHarness();
    const appRoot = await writeAppPlugin(harness.base, 'chips.example.app', '0.1.0');
    const pkg = await loadCpkDirectory(appRoot);
    await harness.loader.install({ pkg, source: 'development' });
    harness.ports.set('chips.example.app', {
      apply: (context) => {
        context.registerCapability({
          id: 'demo:forbidden',
          permissions: [],
          handler: () => Promise.resolve({}),
        });
      },
    });
    await expect(harness.loader.enable('chips.example.app')).rejects.toMatchObject({
      code: 'KERNEL_APPLY_FAILED',
    });
    expect(harness.loader.get('chips.example.app')?.state).toBe('failed');
  });

  it('service 注册能力 owner 预绑定插件 ID；配置只读快照（未登记生效值为空对象）', async () => {
    const harness = await createHarness();
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    harness.ports.set(id, {
      apply: (context) => {
        context.registerCapability({
          id: 'demo:echo',
          permissions: [],
          schema: {
            type: 'object',
            required: ['text'],
            properties: { text: { type: 'string' } },
          },
          handler: (input) => Promise.resolve({ echoed: (input as { text: string }).text }),
        });
        context.publishEvent('demo:custom', { note: '来自插件的事件' });
      },
    });
    await harness.loader.enable(id);
    const entry = harness.capabilityRegistry.get('demo:echo');
    expect(entry?.owner).toBe(id);
    const context = harness.contexts[0];
    expect(context).toBeDefined();
    // 配置命名空间未登记：生效值为空对象（10 §2.5）。
    expect(context?.config).toEqual({});
    expect(Object.isFrozen(context?.config)).toBe(true);
    // 插件事件经上下文发布出口透传。
    expect(
      harness.events.some(
        (event) => event.id === 'demo:custom' && (event.payload as { note: string }).note === '来自插件的事件',
      ),
    ).toBe(true);
  });

  it('configReader 提供命名空间生效值：apply 期间快照只读', async () => {
    const harness = await createHarness({
      configReader: (pluginId) =>
        pluginId === 'chips.example.svc' ? { greeting: '你好' } : {},
    });
    const id = 'chips.example.svc';
    await installServicePlugin(harness, id, '0.1.0');
    let seen: Readonly<Record<string, unknown>> | undefined;
    harness.ports.set(id, {
      apply: (context) => {
        seen = context.config;
      },
    });
    await harness.loader.enable(id);
    expect(seen).toEqual({ greeting: '你好' });
    expect(Object.isFrozen(seen)).toBe(true);
  });
});

describe('service 激活经正式端口注册能力 → Bridge 路由真实链路', () => {
  it('路由真实调用成功；停用摘除后路由返回注册表未命中', async () => {
    const harness = await createHarness();
    const id = 'chips.service.demo';
    const scheduler = createHostCallScheduler();
    const router = createHostCapabilityRouter({
      registry: harness.capabilityRegistry,
      scheduler,
      now: () => Date.now(),
      publishEvent: () => undefined,
      sessionSignalFor: () => undefined,
    });
    const session: IHostSession = {
      sessionId: 'session-1',
      pluginId: 'chips.example.caller',
      windowId: 1,
      frameId: null,
      grantedPermissions: new Set<string>(),
      openedDocuments: new Set<string>(),
      state: 'active',
      permissionVersion: 1,
    };

    await installServicePlugin(harness, id, '0.1.0');
    harness.ports.set(id, {
      apply: (context) => {
        context.registerCapability({
          id: 'demo:echo',
          permissions: [],
          schema: {
            type: 'object',
            required: ['text'],
            properties: { text: { type: 'string' } },
          },
          handler: (input) => Promise.resolve({ echoed: (input as { text: string }).text }),
        });
      },
      stop: () => undefined,
    });
    await harness.loader.enable(id);

    // 真实链路：注册表命中 → 权限判定 → Schema 准入 → 并发闸门 → 处理器执行 → 响应编码。
    const routed = await router.route(session, {
      requestId: 'req-1',
      capabilityId: 'demo:echo',
      input: { text: '你好' },
    });
    expect(routed).toStrictEqual({ requestId: 'req-1', ok: true, result: { echoed: '你好' } });

    await harness.loader.disable(id);
    const afterDisable = await router.route(session, {
      requestId: 'req-2',
      capabilityId: 'demo:echo',
      input: { text: '你好' },
    });
    expect(afterDisable.ok).toBe(false);
    expect(afterDisable.ok === false && afterDisable.error.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
  });
});

describe('§4.6 启动恢复', () => {
  it('恢复矩阵：拓扑序重新启用、非偏好保持 installed、失效记录与偏好清理、残留回滚', async () => {
    const harness = await createHarness();
    const a = 'chips.example.restore-a';
    const b = 'chips.example.restore-b';
    const c = 'chips.example.restore-c';
    const d = 'chips.example.restore-d';
    harness.ports.set(a, { apply: () => undefined });
    harness.ports.set(b, { apply: () => undefined });
    harness.ports.set(c, { apply: () => undefined });
    await installServicePlugin(harness, a, '0.1.0', [], true);
    await installServicePlugin(harness, b, '0.1.0', [{ id: a, version: '>=0.1.0' }], true);
    await installServicePlugin(harness, c, '0.1.0', [], false);
    await installServicePlugin(harness, d, '0.1.0', [], true);
    // 遮蔽与偏好清理：d 的插件目录缺失。
    await rm(join(harness.pluginsRoot, d), { recursive: true, force: true });
    // 上次运行中断残留：starting / stopping 痕迹（§3.4）。
    const document = JSON.parse(await readFile(harness.registryFilePath, 'utf8')) as {
      plugins: { id: string; state?: string }[];
    };
    for (const entry of document.plugins) {
      if (entry.id === a) {
        entry.state = 'starting';
      }
      if (entry.id === c) {
        entry.state = 'stopping';
      }
    }
    await writeFile(harness.registryFilePath, JSON.stringify(document), 'utf8');

    // 启动恢复：在持久化文档之上重新打开装载器（残留回滚发生在注册表加载期，§3.4）。
    const restoreRegistry = await openPluginRegistry({ filePath: harness.registryFilePath });
    const restoreEvents: { id: string; payload: unknown }[] = [];
    const restoreLoader = createCpkPluginLoader({
      ...harness.deps,
      registry: restoreRegistry,
      emitEvent: (id, payload) => {
        restoreEvents.push({ id, payload });
      },
    });
    const report = await restoreLoader.restore();
    expect(report.enabled).toEqual([a, b]);
    expect(report.failed).toEqual([]);
    expect(report.cleaned).toEqual([d]);
    expect(restoreLoader.get(a)?.state).toBe('active');
    expect(restoreLoader.get(b)?.state).toBe('active');
    expect(restoreLoader.get(c)?.state).toBe('installed');
    expect(restoreLoader.get(d)).toBeUndefined();
    // 残留回滚诊断（§3.4）与失效清理诊断（§4.6 矩阵末行）。
    expect(report.diagnostics.some((line) => line.includes(a) && line.includes('starting'))).toBe(
      true,
    );
    expect(report.diagnostics.some((line) => line.includes(c) && line.includes('stopping'))).toBe(
      true,
    );
    expect(report.diagnostics.some((line) => line.includes(d) && line.includes('清理'))).toBe(true);
    // 拓扑序：loaded 事件 A 先于 B。
    const loadedOrder = restoreEvents
      .filter((event) => event.id === PLUGIN_LIFECYCLE_EVENTS.loaded)
      .map((event) => (event.payload as { pluginId: string }).pluginId);
    expect(loadedOrder).toEqual([a, b]);
    // 恢复持久化：残留痕迹已回写归一。
    const persisted = JSON.parse(await readFile(harness.registryFilePath, 'utf8')) as {
      plugins: { id: string; state?: string }[];
    };
    expect(persisted.plugins.every((entry) => entry.state === undefined)).toBe(true);
  });

  it('失败隔离：依赖启用失败的插件保持 pending，不阻塞其余插件', async () => {
    const harness = await createHarness();
    const f = 'chips.example.restore-f';
    const e = 'chips.example.restore-e';
    const g = 'chips.example.restore-g';
    harness.ports.set(f, {
      apply: () => {
        // 在册形状域码：恢复面失败报告（`wireOf`）同样透传原码（§5.1 原样保留）。
        throw Object.assign(new Error('激活失败'), { code: 'CARD_EXPORT_FAILED', retryable: false });
      },
    });
    harness.ports.set(g, { apply: () => undefined });
    await installServicePlugin(harness, f, '0.1.0', [], true);
    await installServicePlugin(harness, e, '0.1.0', [{ id: f, version: '>=0.1.0' }], true);
    await installServicePlugin(harness, g, '0.1.0', [], true);

    const report = await harness.loader.restore();
    expect(report.enabled).toEqual([g]);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]?.id).toBe(f);
    expect(report.failed[0]?.error).toMatchObject({ code: 'CARD_EXPORT_FAILED', retryable: false });
    expect(harness.loader.get(f)?.state).toBe('failed');
    expect(harness.loader.get(e)?.state).toBe('pending');
    expect(report.diagnostics.some((line) => line.includes(e) && line.includes('pending'))).toBe(
      true,
    );
  });

  it('启用偏好成环：环成员整组 failed（KERNEL_DEPENDENCY_CYCLE），不阻塞恢复其余', async () => {
    const harness = await createHarness();
    const a = 'chips.example.loop-a';
    const b = 'chips.example.loop-b';
    const g = 'chips.example.loop-g';
    await installServicePlugin(harness, a, '0.1.0', [{ id: b, version: '>=0.1.0' }], true);
    await installServicePlugin(harness, b, '0.1.0', [{ id: a, version: '>=0.1.0' }], true);
    await installServicePlugin(harness, g, '0.1.0', [], true);
    harness.ports.set(g, { apply: () => undefined });

    const report = await harness.loader.restore();
    expect(report.enabled).toEqual([g]);
    expect(report.failed.map((failure) => failure.id).sort()).toEqual([a, b].sort());
    expect(report.failed.every((failure) => failure.error.code === 'KERNEL_DEPENDENCY_CYCLE')).toBe(
      true,
    );
  });
});

describe('createPluginActivationContext 直构面', () => {
  it('注销他人能力被拒绝；本插件能力幂等注销', async () => {
    const harness = await createHarness();
    const owner = 'chips.service.owner';
    const other = 'chips.service.other';
    harness.capabilityRegistry.register({
      id: 'other:capability',
      permissions: [],
      owner: other,
      handler: () => Promise.resolve({}),
    });
    const context = createPluginActivationContext({
      pluginId: owner,
      version: '0.1.0',
      role: 'service',
      hostCapabilityRegistry: harness.capabilityRegistry,
      publishEvent: () => undefined,
    });
    expect(() => context.unregisterCapability('other:capability')).toThrowError(
      /不得注销其他提供方注册的能力/,
    );
    context.registerCapability({ id: 'owner:capability', permissions: [], handler: () => Promise.resolve({}) });
    expect(context.registeredCapabilities()).toEqual(['owner:capability']);
    context.unregisterCapability('owner:capability');
    expect(context.registeredCapabilities()).toEqual([]);
    expect(harness.capabilityRegistry.get('owner:capability')).toBeUndefined();
    expect(harness.capabilityRegistry.get('other:capability')).toBeDefined();
  });
});
