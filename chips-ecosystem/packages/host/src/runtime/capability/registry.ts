/**
 * 壳侧能力注册表（04-能力契约规范 §4.2、02-Bridge三层设计 §4）。
 *
 * 权威：`04-能力契约规范` §4.2（注册校验顺序：ID 文法 → 契约登记 → 占用 → 权限词表 → manifest 声明）、
 * `02-Bridge三层设计` §4.1（注册项与默认值）、§4.3（只读编目）。
 *
 * @remarks
 * - 每次注册写入前完成全部校验，任一失败原子拒绝，不产生部分注册（`HostCapabilityRegistrationError` 携带线协议码）。
 * - 注销幂等；注销后可由同 owner 重新注册。蓝绿更新经 `markDraining` 停新调用、保留编目。
 * - `knownPermissions` / `isOwnerAuthorized` 为接线注入点：组合根据宿主 manifest 提供，缺省时不拦（平台内置
 *   能力恒授权，见 08 §4.4 平台自身免权限）。
 */

import { BRIDGE_ERROR_CODES, PERMISSION_ERROR_CODES, bridgeWireError } from '../../protocol/error-codes.js';
import type { IWireChipsError } from '../../protocol/wire.js';
import {
  HOST_CAPABILITY_DEFAULTS,
  HOST_CAPABILITY_OWNER,
  isHostCapabilityId,
  isHostPermissionId,
  type HostCapabilityConcurrency,
  type IHostCapabilityDescriptor,
  type IHostCapabilityDescriptorView,
  type IHostCapabilityRegistryReport,
  type IRegisteredHostCapability,
} from './contracts.js';

/** 注册期失败；携带线协议错误码（`BRIDGE_CAPABILITY_CONFLICT` / `PERMISSION_*`）。 */
export class HostCapabilityRegistrationError extends Error {
  readonly wire: IWireChipsError;

  constructor(wire: IWireChipsError) {
    super(wire.message);
    this.name = 'HostCapabilityRegistrationError';
    this.wire = wire;
  }
}

/** 注册表选项（接线注入）。 */
export interface IHostCapabilityRegistryOptions {
  /** 已知权限词表；省略表示不校验权限是否登记（仅校验文法）。 */
  readonly knownPermissions?: ReadonlySet<string>;
  /** 提供方 manifest 已声明权限集合的解析器；无声明时返回空集合。 */
  readonly declaredPermissions?: (owner: string) => ReadonlySet<string>;
  /** 注册表默认 owner（描述未显式声明时使用）。 */
  readonly defaultOwner?: string;
}

/** 注册表接口（组合根消费）。 */
export interface IHostCapabilityRegistry {
  /** 注册一条能力；重复注册同一定义幂等通过，冲突则抛 {@link HostCapabilityRegistrationError}。 */
  register(descriptor: IHostCapabilityDescriptor): void;
  /** 批量注册（组合根接线一行调用）。 */
  registerAll(descriptors: readonly IHostCapabilityDescriptor[]): void;
  /** 注销；幂等。 */
  unregister(capabilityId: string): void;
  /** 标记为 `draining`（停止新调用，保留编目）。 */
  markDraining(capabilityId: string): void;
  /** 取活跃注册项；`draining` 或未注册返回 `undefined`。 */
  get(capabilityId: string): IRegisteredHostCapability | undefined;
  /** 取注册项（含 `draining`）。 */
  getRegistered(capabilityId: string): IRegisteredHostCapability | undefined;
  /** 只读编目。 */
  list(filter?: { readonly domain?: string; readonly owner?: string }): readonly IRegisteredHostCapability[];
  /** 活跃注册项数量。 */
  readonly size: number;
  /** 诊断快照。 */
  report(): IHostCapabilityRegistryReport;
}

function conflict(message: string, details: Record<string, unknown>): HostCapabilityRegistrationError {
  return new HostCapabilityRegistrationError(
    bridgeWireError(BRIDGE_ERROR_CODES.capabilityConflict, { message, details }),
  );
}

function permissionFailure(code: string, message: string, details: Record<string, unknown>): HostCapabilityRegistrationError {
  return new HostCapabilityRegistrationError({
    code,
    message,
    retryable: false,
    details,
  });
}

function normalize(descriptor: IHostCapabilityDescriptor): {
  timeoutMs: number;
  concurrency: HostCapabilityConcurrency;
  maxQueue: number;
  sessionInFlightLimit: number;
} {
  const timeoutMs = descriptor.timeoutMs ?? HOST_CAPABILITY_DEFAULTS.timeoutMs;
  const concurrency = descriptor.concurrency ?? HOST_CAPABILITY_DEFAULTS.concurrency;
  const maxQueue = descriptor.maxQueue ?? HOST_CAPABILITY_DEFAULTS.maxQueue;
  const sessionInFlightLimit = descriptor.sessionInFlightLimit ?? HOST_CAPABILITY_DEFAULTS.sessionInFlightLimit;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw conflict('能力超时必须为正整数', { capabilityId: descriptor.id, field: 'timeoutMs' });
  }
  if (concurrency !== 'parallel' && concurrency !== 'serial') {
    throw conflict('并发策略取值非法', { capabilityId: descriptor.id, field: 'concurrency' });
  }
  if (!Number.isInteger(maxQueue) || maxQueue < 0) {
    throw conflict('等待队列上限必须为非负整数', { capabilityId: descriptor.id, field: 'maxQueue' });
  }
  if (!Number.isInteger(sessionInFlightLimit) || sessionInFlightLimit <= 0) {
    throw conflict('会话在途上限必须为正整数', { capabilityId: descriptor.id, field: 'sessionInFlightLimit' });
  }
  return { timeoutMs, concurrency, maxQueue, sessionInFlightLimit };
}

function viewOf(entry: IRegisteredHostCapability): IHostCapabilityDescriptorView {
  return {
    id: entry.id,
    owner: entry.owner,
    permissions: entry.permissions,
    state: entry.state,
    timeoutMs: entry.timeoutMs,
    concurrency: entry.concurrency,
    maxQueue: entry.maxQueue,
    sessionInFlightLimit: entry.sessionInFlightLimit,
  };
}

/** 创建壳侧能力注册表。 */
export function createHostCapabilityRegistry(
  options: IHostCapabilityRegistryOptions = {},
): IHostCapabilityRegistry {
  const defaultOwner = options.defaultOwner ?? HOST_CAPABILITY_OWNER;
  const entries = new Map<string, IRegisteredHostCapability>();

  const sameDefinition = (left: IRegisteredHostCapability, right: IRegisteredHostCapability): boolean =>
    left.owner === right.owner &&
    left.permissions.join('|') === right.permissions.join('|') &&
    left.timeoutMs === right.timeoutMs &&
    left.concurrency === right.concurrency &&
    left.maxQueue === right.maxQueue &&
    left.sessionInFlightLimit === right.sessionInFlightLimit &&
    left.descriptor.handler === right.descriptor.handler;

  const register = (descriptor: IHostCapabilityDescriptor): void => {
    const id = descriptor.id;
    if (!isHostCapabilityId(id)) {
      throw conflict('能力 ID 格式不合法', { capabilityId: id });
    }
    if (typeof descriptor.handler !== 'function') {
      throw conflict('能力缺少 handler 实现', { capabilityId: id });
    }
    if (!Array.isArray(descriptor.permissions) || descriptor.permissions.some((item) => typeof item !== 'string')) {
      throw conflict('能力 permissions 必须为字符串数组', { capabilityId: id });
    }
    const owner = descriptor.owner ?? defaultOwner;

    for (const permission of descriptor.permissions) {
      if (!isHostPermissionId(permission)) {
        throw permissionFailure(
          PERMISSION_ERROR_CODES.invalid,
          '权限 ID 文法非法',
          { capabilityId: id, permission },
        );
      }
      if (options.knownPermissions !== undefined && !options.knownPermissions.has(permission)) {
        throw permissionFailure(
          PERMISSION_ERROR_CODES.unknown,
          '能力声明了未注册的权限',
          { capabilityId: id, permission },
        );
      }
      if (
        options.declaredPermissions !== undefined &&
        !options.declaredPermissions(owner).has(permission)
      ) {
        throw permissionFailure(
          PERMISSION_ERROR_CODES.notDeclared,
          '能力所需权限未在提供方清单声明',
          { capabilityId: id, permission, owner },
        );
      }
    }

    const normalized = normalize(descriptor);
    const candidate: IRegisteredHostCapability = {
      descriptor,
      id,
      owner,
      permissions: [...descriptor.permissions],
      targets: descriptor.targets ?? [],
      state: 'active',
      ...normalized,
    };

    const existing = entries.get(id);
    if (existing !== undefined) {
      if (existing.owner !== owner) {
        throw conflict('能力 ID 已被其他提供方注册', { capabilityId: id, owner });
      }
      if (sameDefinition(existing, candidate)) {
        return;
      }
      if (existing.state === 'active') {
        throw conflict('能力已注册且定义不一致', { capabilityId: id });
      }
    }
    entries.set(id, candidate);
  };

  return {
    register,
    registerAll(descriptors: readonly IHostCapabilityDescriptor[]): void {
      for (const descriptor of descriptors) {
        register(descriptor);
      }
    },
    unregister(capabilityId: string): void {
      entries.delete(capabilityId);
    },
    markDraining(capabilityId: string): void {
      const entry = entries.get(capabilityId);
      if (entry === undefined || entry.state === 'draining') {
        return;
      }
      entries.set(capabilityId, { ...entry, state: 'draining' });
    },
    get(capabilityId: string): IRegisteredHostCapability | undefined {
      const entry = entries.get(capabilityId);
      return entry === undefined || entry.state !== 'active' ? undefined : entry;
    },
    getRegistered(capabilityId: string): IRegisteredHostCapability | undefined {
      return entries.get(capabilityId);
    },
    list(filter: { readonly domain?: string; readonly owner?: string } = {}): readonly IRegisteredHostCapability[] {
      const result: IRegisteredHostCapability[] = [];
      for (const entry of entries.values()) {
        if (filter.owner !== undefined && entry.owner !== filter.owner) {
          continue;
        }
        if (filter.domain !== undefined && !entry.id.startsWith(`${filter.domain}:`)) {
          continue;
        }
        result.push(entry);
      }
      return result;
    },
    get size(): number {
      let count = 0;
      for (const entry of entries.values()) {
        if (entry.state === 'active') {
          count += 1;
        }
      }
      return count;
    },
    report(): IHostCapabilityRegistryReport {
      const views: IHostCapabilityDescriptorView[] = [];
      const byOwner: Record<string, number> = {};
      const byDomain: Record<string, number> = {};
      let active = 0;
      let draining = 0;
      for (const entry of entries.values()) {
        views.push(viewOf(entry));
        if (entry.state === 'active') {
          active += 1;
        } else {
          draining += 1;
        }
        byOwner[entry.owner] = (byOwner[entry.owner] ?? 0) + 1;
        const domain = entry.id.slice(0, entry.id.indexOf(':'));
        byDomain[domain] = (byDomain[domain] ?? 0) + 1;
      }
      views.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
      return {
        total: entries.size,
        active,
        draining,
        byOwner,
        byDomain,
        capabilities: views,
      };
    },
  };
}
