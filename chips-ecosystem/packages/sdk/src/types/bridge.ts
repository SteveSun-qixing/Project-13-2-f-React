/**
 * Bridge 协议类型与角色调用面投影。
 *
 * 权威：
 * - `@chips/bridge` 是 Bridge 协议类型的唯一来源，本模块以 `import type` 转发、不复制定义
 *   （02-SDK-API规范 §2.3）；
 * - `IAppBridge` / `IServiceBridge` 是主进程调用面的收窄投影（去掉 `subscribe`），
 *   形状见 01-Bridge-API规范 §2.6；`@chips/bridge` 尚未导出这两个类型，本模块按权威形状
 *   以 `Pick<IChipsBridge, 'request' | 'resource'>` 定义（工单 005 跟踪转回收口）。
 */

import type { IChipsBridge } from '@chips/bridge';

export type {
  ICapability,
  ICapabilityContext,
  IChipsBridge,
  IPermissionDeniedDetails,
  IResourceHandle,
  IResourceMetadata,
  ISubscription,
  JSONSchema,
  ResourceInvalidateReason,
  ResourceScope,
  ResourceState,
} from '@chips/bridge';

/**
 * 应用插件主进程调用面：仅 `request` 与 `resource`，没有 `subscribe`。
 *
 * 事件订阅使用 `IAppContext` 的 `on` / `once`（内核事件总线）。
 */
export type IAppBridge = Pick<IChipsBridge, 'request' | 'resource'>;

/**
 * 服务插件主进程调用面：仅 `request` 与 `resource`，没有 `subscribe`。
 *
 * 事件订阅使用 `IServiceContext` 的 `on` / `once`（内核事件总线）。
 */
export type IServiceBridge = Pick<IChipsBridge, 'request' | 'resource'>;
