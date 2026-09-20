/**
 * CPK 插件装载器：T1–T14 生命周期状态机、启动恢复与生命周期事件（《03-插件架构设计》§3.2、§4）。
 *
 * 权威：`01-架构设计/01-子系统设计/03.03-插件架构设计-三、生命周期状态机与注册表` §3.1–§3.4、
 * `03.04-…-四、生命周期流程` §4.2–§4.6、`01.06-薯片内核设计-六` §6.2–§6.7（状态机与超时）、
 * `05-接口与契约/05.05-事件契约规范-四、标准事件-4.1 插件生命周期`（事件 payload）。
 *
 * @remarks
 * - 状态机（§3.2 迁移表 T1–T14）：`install`（T1，经 `install.ts` + 注册表）、
 *   `enable`（T2 依赖满足 / T3 依赖未满足 → `pending`）、`pending` 就绪自动续（T4）、
 *   `pending` 取消（T5）、激活成功（T6，发布 `plugin:loaded`）、激活失败（T7，回滚能力注册）、
 *   `disable`（T8 → `stopping` → T9 `installed`，写入启用偏好）、`retry`（T11）、
 *   卸载（T12 `installed`/`failed`；T13 `active`/`stopping` 拒绝）、更新（T14：同 ID 安装
 *   一律拒绝，须经 §6.2 蓝绿替换流程，见 `install.ts`）。
 * - 授权快照（§4.3[3]）：`enable` 以注册表授权集合生成会话快照（记录 `grantedPermissions`）；
 *   安装不产生授权，首次启用时快照即注册表当前授权。
 * - 依赖（§7）：启用按依赖递归激活（拓扑由递归序保证）；依赖暂缺 → `pending` 并在依赖
 *   就绪后自动续（§4.3 失败处理、§4.6[4]）；版本范围不可满足 → `KERNEL_DEPENDENCY_VERSION`
 *   进 `failed`；成环 → `KERNEL_DEPENDENCY_CYCLE` 进 `failed`；停用存在 `active` 依赖者
 *   默认拒绝（`KERNEL_DEPENDENCY_CONFLICT`），显式级联按逆拓扑先停依赖者（§4.4[1]）。
 * - 超时（内核 §6.7）：`apply` 30s 超时 → `KERNEL_LIFECYCLE_TIMEOUT`（`failed`）、
 *   `stop` 10s 超时 → 不阻断撤销（仍 `installed`，错误随停用结果上报）；数值取
 *   `limits.ts` `LIFECYCLE_TIMEOUTS`，测试可注入等形（不放宽默认值）。
 * - 激活通道未注入（工单 025 正式通道开放前）：`enable` 按 #27「资源管理器未装配」同类
 *   诚实回退报内部错误（`BRIDGE_INTERNAL`），不伪造空实现。
 * - 生命周期事件（05.05 §4.1）：`plugin:installed` / `plugin:uninstalled` / `plugin:loaded` /
 *   `plugin:enabled` / `plugin:disabled` / `plugin:unloaded` / `plugin:failed`，
 *   payload 逐事件锁定（`tests/loader-contract.test.ts` 漂移锁）。
 */

import { rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

import { BRIDGE_ERROR_CODES } from '../protocol/error-codes.js';
import { toWireError, type IWireChipsError } from '../protocol/wire.js';
import type { IHostCapabilityRegistry } from '../runtime/capability/registry.js';
import {
  createPluginActivationContext,
  type IPluginActivationContext,
  type IPluginActivationPort,
} from './activation.js';
import { LIFECYCLE_ERROR_CODES, loaderWireError } from './codes.js';
import { LoaderError, asLoaderWireError } from './errors.js';
import { installCpkPackage, removeInstalledPluginDirectory } from './install.js';
import type { IPermissionCatalog } from './manifest.js';
import type { IPluginRegistry } from './registry.js';
import { satisfies } from './semver.js';
import { LIFECYCLE_TIMEOUTS } from './limits.js';
import type { ITrustRootRegistry } from './trust-roots.js';
import type { IPluginDependency, IPluginRecord, IPersistedPluginEntry, PluginRole, PluginSource } from './types.js';
import type { ICpkPackage } from './provider.js';

/** 插件生命周期标准事件 ID（05.05 §4.1；漂移锁在 `tests/loader-contract.test.ts`）。 */
export const PLUGIN_LIFECYCLE_EVENTS = {
  installed: 'plugin:installed',
  uninstalled: 'plugin:uninstalled',
  loaded: 'plugin:loaded',
  enabled: 'plugin:enabled',
  disabled: 'plugin:disabled',
  unloaded: 'plugin:unloaded',
  failed: 'plugin:failed',
} as const;

/** 插件生命周期标准事件 ID 联合类型。 */
export type PluginLifecycleEventId = (typeof PLUGIN_LIFECYCLE_EVENTS)[keyof typeof PLUGIN_LIFECYCLE_EVENTS];

/** `plugin:installed` payload（05.05 §4.1）。 */
export interface IPluginInstalledPayload {
  readonly pluginId: string;
  readonly version: string;
}

/** `plugin:uninstalled` payload（05.05 §4.1）。 */
export interface IPluginUninstalledPayload {
  readonly pluginId: string;
}

/** `plugin:loaded` payload（05.05 §4.1）。 */
export interface IPluginLoadedPayload {
  readonly pluginId: string;
  readonly version: string;
  readonly role: PluginRole;
}

/** `plugin:enabled` / `plugin:disabled` / `plugin:unloaded` payload（05.05 §4.1）。 */
export interface IPluginStatePayload {
  readonly pluginId: string;
}

/** `plugin:failed` payload（05.05 §4.1）。 */
export interface IPluginFailedPayload {
  readonly pluginId: string;
  readonly error: IWireChipsError;
}

/** 装载器依赖。 */
export interface ICpkPluginLoaderDeps {
  /** 插件落盘根目录（安装目标 `<pluginsRoot>/<id>/<version>/`）。 */
  readonly pluginsRoot: string;
  /** 持久化注册表（§3.4：安装集合/启用偏好/授权集合）。 */
  readonly registry: IPluginRegistry;
  /** 宿主能力注册表（service 激活经激活上下文注册，04.24）。 */
  readonly hostCapabilityRegistry: IHostCapabilityRegistry;
  /** 事件发布出口（05.05 生命周期事件经此投递）。 */
  readonly emitEvent: (eventId: string, payload: unknown) => void;
  /** 当前宿主平台版本（安装 `engines.chips` 门禁）。 */
  readonly hostVersion: string;
  /** 安装验签信任根注册表。 */
  readonly trustRoots: ITrustRootRegistry;
  /** 权限登记目录（缺省用宿主内置表）。 */
  readonly catalog?: IPermissionCatalog;
  /**
   * 激活端口供给（内核 §6.1 `PluginRunner` 通道；工单 025）。未注入时 `enable`
   * 按内部错误诚实回退（不伪造实现）。
   */
  readonly activationPortFor?: (plugin: {
    readonly id: string;
    readonly version: string;
    readonly role: PluginRole;
    readonly path: string;
  }) => IPluginActivationPort | undefined;
  /** 配置命名空间读取（10 §2.5）；缺省视为命名空间未登记（生效值为空对象）。 */
  readonly configReader?: (pluginId: string) => Readonly<Record<string, unknown>>;
  /** 生命周期超时（缺省取 `limits.ts` `LIFECYCLE_TIMEOUTS`；测试注入不改变默认口径）。 */
  readonly timeouts?: { readonly applyMs: number; readonly stopMs: number };
  /** 时钟；缺省系统时间。 */
  readonly now?: () => Date;
}

/** 安装输入。 */
export interface ILoaderInstallInput {
  /** Provider 产出的包内容（归档态或目录态）。 */
  readonly pkg: ICpkPackage;
  /** 来源渠道。 */
  readonly source: PluginSource;
  /** 启用偏好（缺省 false；安装不自动启用，§4.2 规则）。 */
  readonly enabled?: boolean;
}

/** 停用结果（stop 超时/失败不阻断撤销，错误随结果上报供审计）。 */
export interface IPluginDisableResult {
  readonly record: IPluginRecord;
  /** 停用回调失败或超时的归一错误（正常完成时缺省）。 */
  readonly stopError?: IWireChipsError;
}

/** 启动恢复报告（§4.6）。 */
export interface IRestoreReport {
  /** 恢复为 `active` 的插件（按拓扑完成序）。 */
  readonly enabled: readonly string[];
  /** 恢复失败的插件（隔离错误，§4.6[3]）。 */
  readonly failed: readonly { readonly id: string; readonly error: IWireChipsError }[];
  /** 被清理的失效记录（目录缺失/遮蔽；偏好一并清理）。 */
  readonly cleaned: readonly string[];
  /** 诊断（残留回滚、依赖等待等；简体中文）。 */
  readonly diagnostics: readonly string[];
}

/** CPK 插件装载器公共面。 */
export interface ICpkPluginLoader {
  /** 安装（T1）：解包校验 → 原子落盘 → 注册表 → `plugin:installed`。 */
  install(input: ILoaderInstallInput): Promise<IPluginRecord>;
  /** 启用（T2/T3）：依赖满足 → 激活；未满足 → `pending`。 */
  enable(id: string): Promise<IPluginRecord>;
  /** 停用（T5/T8/T9）：`active` → `stopping` → `installed`；`pending` → `installed`。 */
  disable(id: string, options?: { readonly cascade?: boolean }): Promise<IPluginDisableResult>;
  /** 卸载（T12/T13）：仅 `installed`/`failed`；builtin 拒绝；存在依赖者拒绝。 */
  uninstall(id: string): Promise<void>;
  /** 重试（T11）：仅 `failed`。 */
  retry(id: string): Promise<IPluginRecord>;
  /** 启动恢复（§4.6）。 */
  restore(): Promise<IRestoreReport>;
  /** 全部记录快照。 */
  list(): readonly IPluginRecord[];
  /** 按 ID 查找记录。 */
  get(id: string): IPluginRecord | undefined;
  /** 停用全部运行态插件（宿主停机面；按逆拓扑停用）。 */
  stopAll(): Promise<void>;
}

function wireOf(error: unknown): IWireChipsError {
  const loaderWire = asLoaderWireError(error);
  if (loaderWire !== undefined) {
    return loaderWire;
  }
  const carried = (error as { wire?: unknown } | null | undefined)?.wire;
  if (
    typeof carried === 'object' &&
    carried !== null &&
    typeof (carried as { code?: unknown }).code === 'string' &&
    typeof (carried as { message?: unknown }).message === 'string'
  ) {
    return carried as IWireChipsError;
  }
  return toWireError(error);
}

function invalidTransition(message: string, details: Record<string, unknown>): LoaderError {
  return new LoaderError(LIFECYCLE_ERROR_CODES.invalidTransition, { message, details });
}

function pluginNotFound(id: string): LoaderError {
  return new LoaderError(LIFECYCLE_ERROR_CODES.pluginNotFound, { details: { pluginId: id } });
}

/** 依赖激活子图拓扑排序（Kahn；确定性按输入序）。 */
function topologicalOrder(
  ids: readonly string[],
  records: ReadonlyMap<string, IPluginRecord>,
): { readonly order: readonly string[]; readonly cyclic: readonly string[] } {
  const idSet = new Set(ids);
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const id of ids) {
    indegree.set(id, 0);
    dependents.set(id, []);
  }
  for (const id of ids) {
    const record = records.get(id);
    if (record === undefined) {
      continue;
    }
    for (const dependency of record.dependencies) {
      if (!idSet.has(dependency.id)) {
        continue;
      }
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
      dependents.get(dependency.id)?.push(id);
    }
  }
  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        queue.push(dependent);
      }
    }
  }
  return { order, cyclic: ids.filter((id) => !order.includes(id)) };
}

/** 在途激活会话（取消与代际防陈旧）。 */
interface IActivationSession {
  readonly generation: number;
  readonly controller: AbortController;
  readonly port: IPluginActivationPort;
  readonly context: IPluginActivationContext;
}

/**
 * 创建 CPK 插件装载器（T1–T14 状态机宿主侧实现）。
 *
 * @param deps 装载器依赖（注册表、能力注册表、事件出口、信任根与激活通道注入位）。
 * @returns 装载器公共面。
 */
export function createCpkPluginLoader(deps: ICpkPluginLoaderDeps): ICpkPluginLoader {
  const applyMs = deps.timeouts?.applyMs ?? LIFECYCLE_TIMEOUTS.applyMs;
  const stopMs = deps.timeouts?.stopMs ?? LIFECYCLE_TIMEOUTS.stopMs;
  const nowIso = (): string => (deps.now !== undefined ? deps.now() : new Date()).toISOString();
  const activationNotWired = (): IWireChipsError => ({
    code: BRIDGE_ERROR_CODES.internal,
    message: '插件激活通道未装配（内核 PluginRunner 通道尚未接入，工单 025）',
    retryable: false,
  });

  // 运行态记录：由注册表安装集合重建（§3.4 运行态不持久化）。
  const records = new Map<string, IPluginRecord>();
  for (const entry of deps.registry.list()) {
    records.set(entry.id, {
      id: entry.id,
      version: entry.version,
      role: entry.role,
      state: 'installed',
      source: entry.source,
      path: entry.path,
      hash: entry.hash,
      dependencies: entry.dependencies,
      permissions: entry.permissions,
      grantedPermissions: entry.grantedPermissions,
      installedAt: entry.installedAt,
    });
  }

  const inFlight = new Map<string, IActivationSession>();
  const stopInFlight = new Map<string, Promise<IPluginDisableResult>>();
  const generations = new Map<string, number>();
  let continuing = false;

  const emit = (eventId: string, payload: unknown): void => {
    deps.emitEvent(eventId, payload);
  };

  const patch = (record: IPluginRecord, changes: Record<string, unknown>): IPluginRecord => {
    const next: Record<string, unknown> = { ...record };
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
    }
    const updated = next as unknown as IPluginRecord;
    records.set(record.id, updated);
    return updated;
  };

  const requireRecord = (id: string): IPluginRecord => {
    const record = records.get(id);
    if (record === undefined) {
      throw pluginNotFound(id);
    }
    return record;
  };

  const markFailed = (record: IPluginRecord, error: IWireChipsError): IPluginRecord => {
    const updated = patch(record, { state: 'failed', lastError: error });
    emit(PLUGIN_LIFECYCLE_EVENTS.failed, { pluginId: record.id, error } satisfies IPluginFailedPayload);
    return updated;
  };

  const rollbackCapabilities = (context: IPluginActivationContext | undefined): void => {
    for (const capabilityId of context?.registeredCapabilities() ?? []) {
      deps.hostCapabilityRegistry.unregister(capabilityId);
    }
  };

  const withTimeout = async <T>(
    action: () => Promise<T>,
    timeoutMs: number,
    build: () => LoaderError,
  ): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(build()), timeoutMs);
    });
    try {
      return await Promise.race([action(), timeout]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  };

  const detectCycle = (startId: string): boolean => {
    const marks = new Map<string, 1 | 2>();
    const visit = (id: string): boolean => {
      const mark = marks.get(id);
      if (mark === 2) {
        return false;
      }
      if (mark === 1) {
        return true;
      }
      marks.set(id, 1);
      const record = records.get(id);
      if (record !== undefined) {
        for (const dependency of record.dependencies) {
          if (records.has(dependency.id) && visit(dependency.id)) {
            return true;
          }
        }
      }
      marks.set(id, 2);
      return false;
    };
    return visit(startId);
  };

  const dependencySatisfiedBy = (dependency: IPluginDependency, candidate: IPluginRecord): boolean =>
    candidate.state === 'active' && satisfies(candidate.version, dependency.version);

  const start = async (record: IPluginRecord): Promise<IPluginRecord> => {
    const id = record.id;
    const generation = (generations.get(id) ?? 0) + 1;
    generations.set(id, generation);
    const port = deps.activationPortFor?.({
      id,
      version: record.version,
      role: record.role,
      path: record.path,
    });
    if (port === undefined) {
      // #27 同类诚实回退：激活通道未装配（工单 025 正式通道），报内部错误，不伪造实现。
      const wire = activationNotWired();
      markFailed(record, wire);
      throw Object.assign(new Error(wire.message), { code: wire.code, retryable: false, wire });
    }
    const controller = new AbortController();
    const configSnapshot = deps.configReader?.(id);
    const context = createPluginActivationContext({
      pluginId: id,
      version: record.version,
      role: record.role,
      hostCapabilityRegistry: deps.hostCapabilityRegistry,
      publishEvent: deps.emitEvent,
      ...(configSnapshot === undefined ? {} : { config: configSnapshot }),
      signal: controller.signal,
    });
    inFlight.set(id, { generation, controller, port, context });
    patch(record, { state: 'starting' });
    try {
      await withTimeout(
        () => port.apply(context),
        applyMs,
        () =>
          new LoaderError(LIFECYCLE_ERROR_CODES.lifecycleTimeout, {
            details: { pluginId: id, phase: 'apply', timeoutMs: applyMs },
          }),
      );
      if (generations.get(id) !== generation || inFlight.get(id)?.context !== context) {
        // starting 期间被 disable 取消：本次激活结果作废，以取消方落定的状态为准。
        return requireRecord(id);
      }
      inFlight.delete(id);
      const active = patch(requireRecord(id), {
        state: 'active',
        activatedAt: nowIso(),
        // 授权快照（§4.3[3]）：以注册表授权集合生成会话快照；安装不产生授权。
        grantedPermissions: [...(deps.registry.get(id)?.grantedPermissions ?? [])],
      });
      await deps.registry.setEnabled(id, true);
      emit(PLUGIN_LIFECYCLE_EVENTS.loaded, {
        pluginId: id,
        version: record.version,
        role: record.role,
      } satisfies IPluginLoadedPayload);
      emit(PLUGIN_LIFECYCLE_EVENTS.enabled, { pluginId: id } satisfies IPluginStatePayload);
      await continuePending();
      return active;
    } catch (error) {
      inFlight.delete(id);
      controller.abort();
      if (generations.get(id) !== generation) {
        return requireRecord(id);
      }
      // 激活失败归一（内核 §6.3[4]：`Ok(Err(_))` → `KERNEL_APPLY_FAILED`；
      // 装载器自身抛出的 LoaderError——超时、注册冲突等——按原码保留）。
      const normalized =
        error instanceof LoaderError
          ? error
          : new LoaderError(LIFECYCLE_ERROR_CODES.applyFailed, {
              details: {
                pluginId: id,
                cause: error instanceof Error ? error.message : String(error),
              },
            });
      const current = requireRecord(id);
      rollbackCapabilities(context);
      markFailed(current, normalized.toWireError());
      throw normalized;
    }
  };

  const continuePending = async (): Promise<void> => {
    if (continuing) {
      return;
    }
    continuing = true;
    try {
      for (const record of [...records.values()]) {
        if (record.state !== 'pending') {
          continue;
        }
        const ready = record.dependencies.every((dependency) => {
          const candidate = records.get(dependency.id);
          return candidate !== undefined && dependencySatisfiedBy(dependency, candidate);
        });
        if (!ready) {
          continue;
        }
        try {
          await start(requireRecord(record.id));
        } catch {
          // pending 续跑失败已隔离落 failed（§4.3 失败处理），不阻塞其余插件。
        }
      }
    } finally {
      continuing = false;
    }
  };

  const resolveAndStart = async (record: IPluginRecord): Promise<IPluginRecord> => {
    const id = record.id;
    // 依赖版本与存在性解析（§4.3[4]、内核 §6.2）。
    for (const dependency of record.dependencies) {
      const candidate = records.get(dependency.id);
      if (candidate === undefined) {
        continue;
      }
      if (!satisfies(candidate.version, dependency.version)) {
        const error = loaderWireError(LIFECYCLE_ERROR_CODES.dependencyVersion, {
          details: {
            pluginId: id,
            dependencyId: dependency.id,
            required: dependency.version,
            actual: candidate.version,
          },
        });
        markFailed(record, error);
        throw new LoaderError(LIFECYCLE_ERROR_CODES.dependencyVersion, {
          details: {
            pluginId: id,
            dependencyId: dependency.id,
            required: dependency.version,
            actual: candidate.version,
          },
        });
      }
    }
    if (detectCycle(id)) {
      const error = loaderWireError(LIFECYCLE_ERROR_CODES.dependencyCycle, {
        details: { pluginId: id },
      });
      markFailed(record, error);
      throw new LoaderError(LIFECYCLE_ERROR_CODES.dependencyCycle, { details: { pluginId: id } });
    }
    const missing = record.dependencies.filter(
      (dependency) => records.get(dependency.id) === undefined,
    );
    if (missing.length > 0) {
      // 依赖暂缺不是失败：转入 pending 等待（T3；不执行任何插件代码）。
      return patch(record, { state: 'pending' });
    }
    // 依赖激活：installed 的依赖先启用；pending/starting/failed 的依赖 → 等待其就绪。
    for (const dependency of record.dependencies) {
      const candidate = requireRecord(dependency.id);
      if (candidate.state === 'active') {
        continue;
      }
      if (candidate.state !== 'installed') {
        return patch(record, { state: 'pending' });
      }
      try {
        await resolveAndStart(candidate);
      } catch {
        // 依赖启用失败：本插件保持 pending，待其恢复后自动继续（§4.3）。
        return patch(requireRecord(id), { state: 'pending' });
      }
    }
    return await start(requireRecord(id));
  };

  const stopActive = async (record: IPluginRecord): Promise<IPluginDisableResult> => {
    const id = record.id;
    const stopController = new AbortController();
    const configSnapshot = deps.configReader?.(id);
    const context = createPluginActivationContext({
      pluginId: id,
      version: record.version,
      role: record.role,
      hostCapabilityRegistry: deps.hostCapabilityRegistry,
      publishEvent: deps.emitEvent,
      ...(configSnapshot === undefined ? {} : { config: configSnapshot }),
      signal: stopController.signal,
    });
    patch(record, { state: 'stopping' });
    let stopError: IWireChipsError | undefined;
    const port = deps.activationPortFor?.({
      id,
      version: record.version,
      role: record.role,
      path: record.path,
    });
    try {
      if (port === undefined) {
        stopError = activationNotWired();
      } else {
        await withTimeout(
          () => port.stop(context),
          stopMs,
          () =>
            new LoaderError(LIFECYCLE_ERROR_CODES.lifecycleTimeout, {
              details: { pluginId: id, phase: 'stop', timeoutMs: stopMs },
            }),
        );
      }
    } catch (error) {
      // stop 回调失败/超时不阻断撤销（§4.4 规则、内核 §6.4[2][3]）；错误随结果上报。
      stopError = wireOf(error);
    } finally {
      stopController.abort();
    }
    // 摘除本插件注册的全部能力（04.24 §9.1：stop 时撤销）。
    for (const entry of deps.hostCapabilityRegistry.list({ owner: id })) {
      deps.hostCapabilityRegistry.unregister(entry.id);
    }
    const installed = patch(requireRecord(id), { state: 'installed', activatedAt: undefined });
    await deps.registry.setEnabled(id, false);
    emit(PLUGIN_LIFECYCLE_EVENTS.disabled, { pluginId: id } satisfies IPluginStatePayload);
    emit(PLUGIN_LIFECYCLE_EVENTS.unloaded, { pluginId: id } satisfies IPluginStatePayload);
    return stopError === undefined ? { record: installed } : { record: installed, stopError };
  };

  const activeDependentsOf = (id: string): readonly string[] =>
    [...records.values()]
      .filter(
        (candidate) =>
          candidate.id !== id &&
          candidate.state === 'active' &&
          candidate.dependencies.some((dependency) => dependency.id === id),
      )
      .map((candidate) => candidate.id);

  const loader: ICpkPluginLoader = {
    async install(input: ILoaderInstallInput): Promise<IPluginRecord> {
      const result = await installCpkPackage(input.pkg, {
        pluginsRoot: deps.pluginsRoot,
        source: input.source,
        trustRoots: deps.trustRoots,
        hostVersion: deps.hostVersion,
        ...(deps.catalog === undefined ? {} : { catalog: deps.catalog }),
        installedVersionOf: (id) => deps.registry.get(id)?.version,
        ...(deps.now === undefined ? {} : { now: deps.now }),
      });
      const persisted: IPersistedPluginEntry = { ...result.persisted, enabled: input.enabled ?? false };
      try {
        await deps.registry.upsert(persisted);
      } catch (error) {
        // 注册表写入失败不留半成品：回滚已落盘目录（§4.2 规则）。
        await removeInstalledPluginDirectory(deps.pluginsRoot, result.record.id, result.record.version);
        throw error;
      }
      records.set(result.record.id, result.record);
      emit(PLUGIN_LIFECYCLE_EVENTS.installed, {
        pluginId: result.record.id,
        version: result.record.version,
      } satisfies IPluginInstalledPayload);
      return result.record;
    },

    async enable(id: string): Promise<IPluginRecord> {
      const record = requireRecord(id);
      if (record.state === 'active' || record.state === 'starting' || record.state === 'pending') {
        // 重复启用幂等（内核 §6.3[4]：已 Active 直接成功；pending/starting 已受理）。
        return record;
      }
      if (record.state === 'stopping') {
        throw invalidTransition(`插件 ${id} 正在停用，不能启用`, { pluginId: id, state: record.state });
      }
      return await resolveAndStart(record);
    },

    async disable(
      id: string,
      options: { readonly cascade?: boolean } = {},
    ): Promise<IPluginDisableResult> {
      const inFlightStop = stopInFlight.get(id);
      if (inFlightStop !== undefined) {
        return await inFlightStop;
      }
      const record = requireRecord(id);
      switch (record.state) {
        case 'installed':
          // 已停用，幂等成功。
          return { record };
        case 'discovered':
          throw invalidTransition(`插件 ${id} 尚未安装完成`, {
            pluginId: id,
            state: record.state,
          });
        case 'pending': {
          // T5：取消等待。
          const updated = patch(record, { state: 'installed' });
          await deps.registry.setEnabled(id, false);
          return { record: updated };
        }
        case 'starting': {
          // pending/starting 可随时被 disable 取消（§3.2 规则）；副作用即刻回收。
          const session = inFlight.get(id);
          generations.set(id, (generations.get(id) ?? 0) + 1);
          inFlight.delete(id);
          session?.controller.abort();
          rollbackCapabilities(session?.context);
          const updated = patch(requireRecord(id), { state: 'installed' });
          await deps.registry.setEnabled(id, false);
          return { record: updated };
        }
        case 'failed':
          throw invalidTransition(`插件 ${id} 处于 failed，仅可 retry 或 uninstall`, {
            pluginId: id,
            state: record.state,
          });
        case 'stopping':
          return await stopActive(record);
        case 'active': {
          const dependents = activeDependentsOf(id);
          if (dependents.length > 0 && options.cascade !== true) {
            throw new LoaderError(LIFECYCLE_ERROR_CODES.dependencyConflict, {
              message: `插件 ${id} 存在运行中的依赖者，停用被拒绝`,
              details: { pluginId: id, dependents, rule: '03.04 §4.4[1]' },
            });
          }
          if (options.cascade === true) {
            for (const dependentId of dependents) {
              await loader.disable(dependentId, { cascade: true });
            }
          }
          const stopPromise = stopActive(requireRecord(id));
          stopInFlight.set(id, stopPromise);
          try {
            return await stopPromise;
          } finally {
            stopInFlight.delete(id);
          }
        }
      }
    },

    async uninstall(id: string): Promise<void> {
      const record = requireRecord(id);
      if (record.state !== 'installed' && record.state !== 'failed') {
        // T13 / §4.5[1]：active/stopping 必须先停用；pending/starting 先取消。
        throw invalidTransition(`插件 ${id} 处于 ${record.state}，不能卸载`, {
          pluginId: id,
          state: record.state,
          rule: '03.04 §4.5[1]',
        });
      }
      if (record.source === 'builtin') {
        throw invalidTransition(`内置插件 ${id} 不可卸载，只能停用`, {
          pluginId: id,
          source: record.source,
          rule: '03.04 §4.5 规则',
        });
      }
      const dependents = [...records.values()]
        .filter(
          (candidate) =>
            candidate.id !== id && candidate.dependencies.some((dependency) => dependency.id === id),
        )
        .map((candidate) => candidate.id);
      if (dependents.length > 0) {
        throw new LoaderError(LIFECYCLE_ERROR_CODES.dependencyConflict, {
          message: `插件 ${id} 存在已安装的依赖者，卸载被拒绝`,
          details: { pluginId: id, dependents, rule: '03.04 §4.5[2]' },
        });
      }
      await rm(record.path, { recursive: true, force: true });
      // 插件目录（ID 目录）一并移除；同 ID 单版本不变量由安装冲突检查保证。
      await rm(dirname(record.path), { recursive: true, force: true });
      await deps.registry.remove(id);
      records.delete(id);
      emit(PLUGIN_LIFECYCLE_EVENTS.unloaded, { pluginId: id } satisfies IPluginStatePayload);
      emit(PLUGIN_LIFECYCLE_EVENTS.uninstalled, { pluginId: id } satisfies IPluginUninstalledPayload);
    },

    async retry(id: string): Promise<IPluginRecord> {
      const record = requireRecord(id);
      if (record.state !== 'failed') {
        throw invalidTransition(`插件 ${id} 处于 ${record.state}，retry 仅接受 failed`, {
          pluginId: id,
          state: record.state,
          rule: '03.03 §3.2 T11',
        });
      }
      return await resolveAndStart(record);
    },

    async restore(): Promise<IRestoreReport> {
      const diagnostics: string[] = [...deps.registry.loadDiagnostics];
      const cleaned: string[] = [];
      // 遮蔽与偏好清理：插件目录缺失（被删除/遮蔽失效）的记录整条移除（§4.6 矩阵末行）。
      for (const entry of deps.registry.list()) {
        const exists = await stat(entry.path).then(
          () => true,
          () => false,
        );
        if (!exists) {
          await deps.registry.remove(entry.id);
          records.delete(entry.id);
          cleaned.push(entry.id);
          diagnostics.push(`清理失效插件记录：${entry.id}（插件目录缺失，启用偏好一并清理）`);
        }
      }
      const enabledIds = [...records.values()]
        .filter((record) => deps.registry.get(record.id)?.enabled === true)
        .map((record) => record.id);
      const { order, cyclic } = topologicalOrder(enabledIds, records);
      const failed: { id: string; error: IWireChipsError }[] = [];
      for (const id of cyclic) {
        const error = loaderWireError(LIFECYCLE_ERROR_CODES.dependencyCycle, {
          details: { pluginId: id },
        });
        markFailed(requireRecord(id), error);
        failed.push({ id, error });
      }
      const enabled: string[] = [];
      for (const id of order) {
        try {
          const record = await loader.enable(id);
          if (record.state === 'active') {
            enabled.push(id);
          } else if (record.state === 'pending') {
            diagnostics.push(`插件 ${id} 依赖未就绪，保持 pending（§4.6[4]）`);
          }
        } catch (error) {
          // 单个失败被隔离，不阻塞后续插件（§4.6[3]）。
          failed.push({ id, error: wireOf(error) });
        }
      }
      return { enabled, failed, cleaned, diagnostics };
    },

    list: () => [...records.values()],
    get: (id: string) => records.get(id),

    async stopAll(): Promise<void> {
      const runtimeIds = [...records.values()]
        .filter((record) =>
          ['active', 'starting', 'pending', 'stopping'].includes(record.state),
        )
        .map((record) => record.id);
      const { order } = topologicalOrder(runtimeIds, records);
      for (const id of [...order].reverse()) {
        await loader.disable(id, { cascade: true });
      }
    },
  };

  return loader;
}
