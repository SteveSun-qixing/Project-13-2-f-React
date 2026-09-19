/**
 * 能力注册表（02-Bridge三层设计 §4、04-能力契约规范 §4.2）。
 *
 * 每次注册在写入注册表前完成全部校验，任一项失败都原子拒绝，不产生部分注册：
 * ID 文法 → 契约登记与 owner 绑定 → 占用 → R3 → Schema 编译 → 权限词表与 manifest 声明 → owner 激活状态。
 * 注销幂等；注销后同一 ID 只能由原 owner 重新注册（登记绑定不可转让）。
 */

import {
  BRIDGE_ERROR_CODES,
  ChipsError,
  createBridgeError,
  KERNEL_INVALID_TRANSITION,
  PERMISSION_ERROR_CODES,
} from '../protocol/errors.js';
import {
  CAPABILITY_REGISTRATION_DEFAULTS,
  type CapabilityConcurrency,
  type ICapability,
  type ICapabilityCatalog,
  type ICapabilityCatalogFilter,
  type ICapabilityDescriptor,
  type ICapabilityRegistration,
} from '../protocol/capability.js';
import {
  findBuiltinCapability,
  PLATFORM_CAPABILITY_OWNER,
  type IBuiltinCapabilityContract,
  type IPermissionTargetRule,
} from '../protocol/capability-contracts.js';
import { isKnownBasePermission } from '../protocol/permissions.js';
import type { ICompiledSchema, ISchemaCompiler } from '../schema/compile.js';

/**
 * 能力 ID 文法：`<domain>:<action>[:<target>]`。
 * `domain` 全小写；`action` 允许驼峰（R19 内置能力含 `window:setTitle` / `window:setState`，
 * 口径与 `tools/contract-gen` 一致；文档文法与内置表的差异见 工单003）。
 */
const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][A-Za-z0-9-]*(:[a-z0-9][a-z0-9.-]*)?$/;

/** 第三方能力登记记录（登记前置，04-能力契约规范 §9）。 */
export interface ICapabilityContractRecord {
  readonly id: string;
  readonly owner: string;
  readonly permissions: readonly string[];
  /** 限定值目标字段规则；省略表示无目标字段。 */
  readonly targets?: readonly IPermissionTargetRule[];
}

export interface ICapabilityRegistryOptions {
  /** 注册期 Schema 编译器（带 LRU 缓存）。 */
  readonly compiler: ISchemaCompiler;
  /** 提供方 manifest 已声明且通过安装校验的权限集合（无声明时返回空集合）。 */
  readonly declaredPermissions: (owner: string) => ReadonlySet<string>;
  /** owner 是否处于激活状态（插件运行时/内核生命周期查询）。 */
  readonly isOwnerActive?: (owner: string) => boolean;
  /** 内置能力的提供方标识；默认 `chips.platform`。 */
  readonly builtinOwner?: string;
  /** 第三方 Bridge 能力登记记录（平台评审登记数据）。 */
  readonly contracts?: readonly ICapabilityContractRecord[];
  /** 注销回调：宿主据此中止该能力的在途调用。 */
  readonly onUnregistered?: (capabilityId: string, owner: string) => void;
}

/** 注册表内部注册项：注册项结构 + 编译后的 Schema 句柄 + 状态（注册参数已归一为必填）。 */
export interface IRegisteredCapability extends ICapabilityRegistration {
  readonly builtin: boolean;
  readonly state: 'active' | 'draining';
  /** 注册期已编译的校验器句柄；调用期零编译。 */
  readonly compiledSchema: ICompiledSchema;
  /** 登记契约中的限定值目标字段规则（权限判定用）。 */
  readonly targets: readonly IPermissionTargetRule[];
  readonly timeoutMs: number;
  readonly concurrency: CapabilityConcurrency;
  readonly maxQueue: number;
  readonly sessionInFlightLimit: number;
}

export interface ICapabilityRegistryCore {
  register(registration: ICapabilityRegistration): void;
  unregister(capabilityId: string): void;
  get(capabilityId: string): ICapabilityRegistration | undefined;
  /** 查询注册项（含 `draining` 状态，供路由与诊断使用）。 */
  getRegistered(capabilityId: string): IRegisteredCapability | undefined;
  /** 蓝绿更新：标记旧代际注册项为 `draining`（停止新调用，保留编目）。 */
  markDraining(capabilityId: string): void;
  /** 平台内部只读编目。 */
  readonly catalog: ICapabilityCatalog;
  /** 活跃注册项数量。 */
  readonly size: number;
}

function conflict(message: string, details: Record<string, unknown>): ChipsError {
  return createBridgeError(BRIDGE_ERROR_CODES.capabilityConflict, {
    message,
    details,
    retryable: false,
  });
}

function permissionError(
  code: string,
  message: string,
  details: Record<string, unknown>
): ChipsError {
  return new ChipsError({ code, message, details, retryable: false });
}

function normalizeRegistration(registration: ICapabilityRegistration): {
  timeoutMs: number;
  concurrency: CapabilityConcurrency;
  maxQueue: number;
  sessionInFlightLimit: number;
} {
  const timeoutMs = registration.timeoutMs ?? CAPABILITY_REGISTRATION_DEFAULTS.timeoutMs;
  const concurrency = registration.concurrency ?? CAPABILITY_REGISTRATION_DEFAULTS.concurrency;
  const maxQueue = registration.maxQueue ?? CAPABILITY_REGISTRATION_DEFAULTS.maxQueue;
  const sessionInFlightLimit =
    registration.sessionInFlightLimit ?? CAPABILITY_REGISTRATION_DEFAULTS.sessionInFlightLimit;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw conflict('能力超时必须为正整数', { field: 'timeoutMs' });
  }
  if (concurrency !== 'parallel' && concurrency !== 'serial') {
    throw conflict('并发策略取值非法', { field: 'concurrency' });
  }
  if (!Number.isInteger(maxQueue) || maxQueue < 0) {
    throw conflict('等待队列上限必须为非负整数', { field: 'maxQueue' });
  }
  if (!Number.isInteger(sessionInFlightLimit) || sessionInFlightLimit <= 0) {
    throw conflict('会话在途上限必须为正整数', { field: 'sessionInFlightLimit' });
  }
  return { timeoutMs, concurrency, maxQueue, sessionInFlightLimit };
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function assertCapabilityShape(registration: ICapabilityRegistration): void {
  const capability = registration.capability as ICapability | undefined;
  if (capability === undefined || typeof capability !== 'object') {
    throw conflict('注册项缺少能力定义', { field: 'capability' });
  }
  if (typeof capability.id !== 'string') {
    throw conflict('能力缺少 ID', { field: 'id' });
  }
  if (typeof capability.execute !== 'function') {
    throw conflict('能力缺少 execute 实现', { capabilityId: capability.id });
  }
  if (typeof capability.schema !== 'object' || capability.schema === null) {
    throw conflict('能力缺少输入 schema', { capabilityId: capability.id });
  }
  if (!Array.isArray(capability.permissions)) {
    throw conflict('能力 permissions 必须为字符串数组', { capabilityId: capability.id });
  }
  if (capability.permissions.some((item) => typeof item !== 'string')) {
    throw conflict('能力 permissions 必须为字符串数组', { capabilityId: capability.id });
  }
  if (typeof registration.owner !== 'string' || registration.owner.length === 0) {
    throw conflict('注册项缺少 owner', { capabilityId: capability.id });
  }
}

export function createCapabilityRegistry(
  options: ICapabilityRegistryOptions
): ICapabilityRegistryCore {
  const builtinOwner = options.builtinOwner ?? PLATFORM_CAPABILITY_OWNER;
  const entries = new Map<string, IRegisteredCapability>();
  const ownerBindings = new Map<string, string>();
  const thirdPartyContracts = new Map<string, ICapabilityContractRecord>(
    (options.contracts ?? []).map((record) => [record.id, record])
  );

  const contractFor = (
    capabilityId: string
  ): IBuiltinCapabilityContract | ICapabilityContractRecord | undefined =>
    findBuiltinCapability(capabilityId) ?? thirdPartyContracts.get(capabilityId);

  const contractOwner = (capabilityId: string): string | undefined => {
    const builtin = findBuiltinCapability(capabilityId);
    if (builtin !== undefined) {
      return builtinOwner;
    }
    return thirdPartyContracts.get(capabilityId)?.owner;
  };

  const register = (registration: ICapabilityRegistration): void => {
    assertCapabilityShape(registration);
    const capability = registration.capability;
    const capabilityId = capability.id;

    if (!CAPABILITY_ID_PATTERN.test(capabilityId)) {
      throw conflict('能力 ID 格式不合法', { capabilityId });
    }
    const contract = contractFor(capabilityId);
    if (contract === undefined) {
      throw conflict('能力 ID 未登记', { capabilityId });
    }
    const expectedOwner = contractOwner(capabilityId);
    if (expectedOwner !== registration.owner) {
      throw conflict('能力登记提供方与注册 owner 不一致', {
        capabilityId,
        owner: registration.owner,
      });
    }
    const boundOwner = ownerBindings.get(capabilityId);
    if (boundOwner !== undefined && boundOwner !== registration.owner) {
      throw conflict('能力 ID 已绑定其他提供方', { capabilityId });
    }
    const existing = entries.get(capabilityId);
    if (existing !== undefined && existing.owner !== registration.owner) {
      throw conflict('能力 ID 已被其他提供方注册', { capabilityId });
    }
    if (isKnownBasePermission(capabilityId)) {
      throw conflict('能力 ID 不得与权限 ID 相同', { capabilityId });
    }
    const compiledSchema = options.compiler.compile(capability.schema);
    const normalized = normalizeRegistration(registration);
    if (existing !== undefined && existing.state === 'active') {
      const identical =
        existing.compiledSchema.digest === compiledSchema.digest &&
        sameStringSet(existing.capability.permissions, capability.permissions) &&
        existing.timeoutMs === normalized.timeoutMs &&
        existing.concurrency === normalized.concurrency &&
        existing.maxQueue === normalized.maxQueue &&
        existing.sessionInFlightLimit === normalized.sessionInFlightLimit;
      if (identical) {
        return;
      }
      throw conflict('能力已注册且定义不一致', { capabilityId });
    }
    for (const permission of capability.permissions) {
      if (!isKnownBasePermission(permission)) {
        throw permissionError(PERMISSION_ERROR_CODES.unknown, '能力声明了未注册的权限', {
          capabilityId,
          permission,
        });
      }
      if (!options.declaredPermissions(registration.owner).has(permission)) {
        throw permissionError(PERMISSION_ERROR_CODES.notDeclared, '能力所需权限未在插件清单声明', {
          capabilityId,
          permission,
          owner: registration.owner,
        });
      }
    }
    if (!sameStringSet(capability.permissions, contract.permissions)) {
      throw conflict('能力权限集合与登记契约不一致', { capabilityId });
    }
    if (options.isOwnerActive !== undefined && !options.isOwnerActive(registration.owner)) {
      throw new ChipsError({
        code: KERNEL_INVALID_TRANSITION,
        message: '提供方未处于激活状态',
        details: { capabilityId, owner: registration.owner },
        retryable: false,
      });
    }
    entries.set(capabilityId, {
      capability,
      owner: registration.owner,
      timeoutMs: normalized.timeoutMs,
      concurrency: normalized.concurrency,
      maxQueue: normalized.maxQueue,
      sessionInFlightLimit: normalized.sessionInFlightLimit,
      builtin: findBuiltinCapability(capabilityId) !== undefined,
      state: 'active',
      compiledSchema,
      targets:
        findBuiltinCapability(capabilityId)?.targets ??
        thirdPartyContracts.get(capabilityId)?.targets ??
        [],
    });
    ownerBindings.set(capabilityId, registration.owner);
  };

  const catalog: ICapabilityCatalog = {
    get(capabilityId: string): ICapabilityDescriptor | undefined {
      const entry = entries.get(capabilityId);
      if (entry === undefined) {
        return undefined;
      }
      return {
        id: entry.capability.id,
        owner: entry.owner,
        permissions: entry.capability.permissions,
        schema: entry.capability.schema,
        builtin: entry.builtin,
        state: entry.state,
      };
    },
    list(filter: ICapabilityCatalogFilter = {}): readonly ICapabilityDescriptor[] {
      const result: ICapabilityDescriptor[] = [];
      for (const entry of entries.values()) {
        if (filter.owner !== undefined && entry.owner !== filter.owner) {
          continue;
        }
        if (filter.builtin !== undefined && entry.builtin !== filter.builtin) {
          continue;
        }
        if (filter.domain !== undefined && !entry.capability.id.startsWith(`${filter.domain}:`)) {
          continue;
        }
        result.push({
          id: entry.capability.id,
          owner: entry.owner,
          permissions: entry.capability.permissions,
          schema: entry.capability.schema,
          builtin: entry.builtin,
          state: entry.state,
        });
      }
      return result;
    },
  };

  return {
    register,
    unregister(capabilityId: string): void {
      const entry = entries.get(capabilityId);
      if (entry === undefined) {
        return;
      }
      if (entry.state === 'active') {
        entries.delete(capabilityId);
        options.onUnregistered?.(capabilityId, entry.owner);
      } else {
        entries.delete(capabilityId);
      }
    },
    get(capabilityId: string): ICapabilityRegistration | undefined {
      const entry = entries.get(capabilityId);
      return entry === undefined || entry.state !== 'active' ? undefined : entry;
    },
    getRegistered(capabilityId: string): IRegisteredCapability | undefined {
      return entries.get(capabilityId);
    },
    markDraining(capabilityId: string): void {
      const entry = entries.get(capabilityId);
      if (entry === undefined || entry.state === 'draining') {
        return;
      }
      entries.set(capabilityId, { ...entry, state: 'draining' });
    },
    catalog,
    get size(): number {
      let count = 0;
      for (const entry of entries.values()) {
        if (entry.state === 'active') {
          count += 1;
        }
      }
      return count;
    },
  };
}
