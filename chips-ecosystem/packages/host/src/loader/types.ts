/**
 * 装载器共享类型：插件注册表记录与来源/角色/状态口径。
 *
 * 权威：`01-架构设计/01-子系统设计/03.03-插件架构设计` §3.1–§3.3（状态定义与注册表记录）、
 * §3.4（持久化边界）。
 *
 * @remarks
 * - 类型形态与《03-插件架构设计》§3.3 的 `IPluginRecord` 逐项一致（该接口在契约侧的落点属
 *   `chips-bridge`/内核交付面；壳装载器以本模块为结构视图，内核交付后由内核注册表承接同一形状）。
 * - 运行态（`pending` / `starting` / `active` / `stopping` / `failed`）不持久化，由启动恢复重建。
 */

import type { IWireChipsError } from '../protocol/wire.js';

/** 插件角色（四种，《03-插件架构设计》§二）。 */
export type PluginRole = 'basecard' | 'boxlayout' | 'app' | 'service';

/** 插件生命周期状态（《03-插件架构设计》§3.1）。 */
export type PluginState = 'discovered' | 'installed' | 'pending' | 'starting' | 'active' | 'stopping' | 'failed';

/** 插件来源渠道（《03-插件包格式》§6.3 渠道规则）。 */
export type PluginSource = 'builtin' | 'user' | 'development';

/** 直接依赖声明（清单 `dependencies[]` 归一形态）。 */
export interface IPluginDependency {
  readonly id: string;
  readonly version: string;
}

/** 注册表记录（《03-插件架构设计》§3.3）。 */
export interface IPluginRecord {
  /** 反向域名插件 ID，全局唯一。 */
  readonly id: string;
  /** 语义化版本。 */
  readonly version: string;
  readonly role: PluginRole;
  readonly state: PluginState;
  readonly source: PluginSource;
  /** 插件目录绝对路径（仅内核/装载管理层使用，不暴露给其它插件）。 */
  readonly path: string;
  /** 安装包内容摘要（`sha256:` + 整包字节 SHA-256；目录态为内容清单摘要）。 */
  readonly hash: string;
  readonly dependencies: readonly IPluginDependency[];
  /** 清单申请集合。 */
  readonly permissions: readonly string[];
  /** 授权集合的会话快照。 */
  readonly grantedPermissions: readonly string[];
  readonly installedAt: string;
  readonly activatedAt?: string;
  readonly lastError?: IWireChipsError;
}

/** 持久化的注册表条目（§3.4：安装集合、启用偏好、授权集合）。 */
export interface IPersistedPluginEntry {
  readonly id: string;
  readonly version: string;
  readonly role: PluginRole;
  readonly source: PluginSource;
  readonly path: string;
  readonly hash: string;
  readonly dependencies: readonly IPluginDependency[];
  readonly permissions: readonly string[];
  readonly grantedPermissions: readonly string[];
  readonly installedAt: string;
  /** 启用偏好：上次退出时处于启用族状态（active/starting/stopping/pending）或用户显式启用。 */
  readonly enabled: boolean;
}

/** 清单归一结果（安装与注册表所需的清单字段投影）。 */
export interface INormalizedManifest {
  readonly id: string;
  readonly version: string;
  readonly role: PluginRole;
  readonly name: string;
  readonly dependencies: readonly IPluginDependency[];
  readonly permissions: readonly string[];
}
