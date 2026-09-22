/**
 * 权限治理能力契约类型（04-能力契约规范 §7.18，工单046 登记）。
 *
 * 口径：
 * - 四项能力（`permission:grant` / `permission:revoke` / `permission:restore` /
 *   `permission:audit-read`）声明空权限数组，按调用方平台治理身份校验，仅平台内置
 *   设置界面可达（§6.2 注 8）；治理身份校验与失败臂错误码、授权存储写入链路、
 *   审计写入器均归工单046 后续实现波次（§7.18 约束段），本文件只登记编译期契约形状；
 * - **审计条目面单一事实源**：`IPermissionAuditEntry` 与其枚举词表
 *   （`PermissionAuditAction` / `PermissionAuditSource` / `PermissionDenyReason`）的
 *   权威定义在 `@chips/bridge` 协议层（形状权威为《08-权限系统设计》§8.2 十六字段），
 *   本模块只做 `import type` 转发、不手抄复制定义（比照 `types/bridge.ts` 的
 *   `IChipsBridge` 转发先例；工单046 段一「禁三型并存」收口）；
 * - `ICapabilityContracts` 中权限治理四行的契约类型即本文件类型（04 §2.3）。
 */

import type {
  IPermissionAuditEntry,
  PermissionAuditAction,
  PermissionAuditSource,
  PermissionDenyReason,
} from '@chips/bridge';

export type {
  IPermissionAuditEntry,
  PermissionAuditAction,
  PermissionAuditSource,
  PermissionDenyReason,
};

/** 治理动作终态（04 §7.18；granted/denied 两态，08 §6.1）。 */
export type PermissionGovernanceState = 'granted' | 'denied';

/** `permission:grant` / `permission:revoke` / `permission:restore` 共用输入（04 §7.18）。 */
export interface IPermissionGrantInput {
  readonly pluginId: string;
  readonly permission: string;
  /** 限定值（变量形式存储，判定时展开）。 */
  readonly qualifier?: string;
}

/**
 * 治理动作共用输出（04 §7.18）：写入终态、递增授权版本号并使旧会话快照失效
 * （08 §6.1/§6.5）；成功记审计。
 */
export interface IPermissionGrantOutput {
  readonly pluginId: string;
  readonly permission: string;
  readonly state: PermissionGovernanceState;
  readonly scopeVersion: number;
}

/** `permission:audit-read` 输入：筛选与分页（04 §7.18；`limit` 缺省 100，上限 500）。 */
export interface IPermissionAuditReadInput {
  readonly pluginId?: string;
  readonly action?: PermissionAuditAction;
  readonly permissionDomain?: string;
  readonly source?: PermissionAuditSource;
  readonly from?: string;
  readonly to?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/** `permission:audit-read` 输出；`entries` 条目形状 = 08 §8.2 `IPermissionAuditEntry`。 */
export interface IPermissionAuditReadOutput {
  readonly entries: ReadonlyArray<IPermissionAuditEntry>;
  readonly nextCursor?: string;
}
