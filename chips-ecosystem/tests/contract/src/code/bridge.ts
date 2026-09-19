/**
 * 实现侧（Bridge）契约登记表：契约测试读取的代码侧事实。
 *
 * 说明：W1 阶段 `@chips/bridge` 的包入口与构建产物尚未落地，此处按源码相对路径读取
 * 登记表模块；只读取纯数据类型与常量模块，不引入 Electron / Node 依赖。
 * 包入口发布后，本文件是唯一需要切换导入路径的位置。
 */

import {
  BUILTIN_CAPABILITIES,
  type IBuiltinCapabilityContract,
} from '../../../../packages/bridge/src/protocol/capability-contracts';
import {
  BRIDGE_ERROR_CODES,
  BRIDGE_ERROR_RETRYABLE,
  KERNEL_INVALID_TRANSITION,
  PERMISSION_ERROR_CODES,
} from '../../../../packages/bridge/src/protocol/errors';
import {
  EVENT_ERROR_CODES,
  STANDARD_EVENTS,
  type EventVisibility,
  type IStandardEventDefinition,
} from '../../../../packages/bridge/src/protocol/events';
import {
  BUILTIN_PERMISSIONS,
  type IPermissionDefinition,
} from '../../../../packages/bridge/src/protocol/permissions';
import { RESOURCE_ERROR_CODES } from '../../../../packages/bridge/src/protocol/resource';

export interface CodeCapability {
  readonly id: string;
  readonly permissions: readonly string[];
  readonly targets: readonly {
    readonly permission: string;
    readonly targetFields: readonly string[];
  }[];
  readonly ownerBound: boolean;
}

export interface CodeEvent {
  readonly id: string;
  /** 归一为文档可见性判定键（如 `plugin-field:pluginId`、`owner-lookup:command`）。 */
  readonly visibility: string;
}

export interface BridgeCodeModel {
  readonly capabilities: readonly CodeCapability[];
  readonly permissionIds: readonly string[];
  readonly permissions: readonly IPermissionDefinition[];
  readonly events: readonly CodeEvent[];
  readonly errors: {
    readonly channel: readonly string[];
    readonly event: readonly string[];
    readonly permissionRegistration: readonly string[];
    readonly kernel: readonly string[];
    readonly resource: readonly string[];
  };
  readonly channelRetryable: Readonly<Record<string, boolean>>;
}

export function normalizeVisibility(visibility: EventVisibility): string {
  switch (visibility.kind) {
    case 'public':
      return 'public';
    case 'platform':
      return 'platform';
    case 'plugin-field':
      return `plugin-field:${visibility.field}`;
    case 'config-namespace':
      return 'config-namespace';
    case 'owner-lookup':
      return `owner-lookup:${visibility.scope}`;
  }
}

function toCodeCapability(contract: IBuiltinCapabilityContract): CodeCapability {
  return {
    id: contract.id,
    permissions: [...contract.permissions].sort((left, right) => left.localeCompare(right)),
    targets: contract.targets.map((target) => ({
      permission: target.permission,
      targetFields: [...target.targetFields],
    })),
    ownerBound: contract.ownerBound === true,
  };
}

function toCodeEvent(definition: IStandardEventDefinition): CodeEvent {
  return { id: definition.id, visibility: normalizeVisibility(definition.visibility) };
}

export function loadBridgeCodeModel(): BridgeCodeModel {
  return {
    capabilities: BUILTIN_CAPABILITIES.map((contract) => toCodeCapability(contract)).sort(
      (left, right) => left.id.localeCompare(right.id)
    ),
    permissionIds: [...BUILTIN_PERMISSIONS.map((definition) => definition.id)].sort((left, right) =>
      left.localeCompare(right)
    ),
    permissions: [...BUILTIN_PERMISSIONS],
    events: STANDARD_EVENTS.map((definition) => toCodeEvent(definition)),
    errors: {
      channel: Object.values(BRIDGE_ERROR_CODES),
      event: Object.values(EVENT_ERROR_CODES),
      permissionRegistration: Object.values(PERMISSION_ERROR_CODES),
      kernel: [KERNEL_INVALID_TRANSITION],
      resource: Object.values(RESOURCE_ERROR_CODES),
    },
    channelRetryable: BRIDGE_ERROR_RETRYABLE,
  };
}
