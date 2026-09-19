/**
 * 权限判定模型（08-权限系统设计 §7.1、§7.2、§9.2）。
 */

/** 拒绝原因枚举；与权限系统共用。 */
export type PermissionDenyReason =
  | 'not_granted'
  | 'revoked'
  | 'out_of_scope'
  | 'user_rejected'
  | 'policy';

/** 授权记录（物化自授权存储）。 */
export interface IPermissionGrant {
  /** 基础权限 ID（`<domain>:<scope>`）。 */
  readonly base: string;
  /** 解析后的限定值；无限定值的权限省略。 */
  readonly qualifier?: string;
  readonly state: 'granted' | 'denied';
  readonly source: 'enable' | 'first-call' | 'settings' | 'update';
}

/** 会话限权域；判定只使用一个快照版本。 */
export interface ISessionScope {
  readonly sessionId: string;
  readonly pluginId: string;
  readonly scopeVersion: number;
  readonly grants: readonly IPermissionGrant[];
}

/** 判定结果（08-权限系统设计 §7.2）。 */
export interface IPermissionDecision {
  readonly allowed: boolean;
  /** 未满足的权限 ID；允许时为空字符串。 */
  readonly permission: string;
  readonly reason?: PermissionDenyReason;
}

/** 权限拒绝详情（08-权限系统设计 §9.2）。 */
export interface IPermissionDeniedDetails {
  capabilityId?: string;
  permission: string;
  required: string[];
  missing: string[];
  granted: string[];
  reason: PermissionDenyReason;
  target?: string;
}
