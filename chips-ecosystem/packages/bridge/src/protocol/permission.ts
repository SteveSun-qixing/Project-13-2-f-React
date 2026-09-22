/**
 * 权限判定模型（08-权限系统设计 §7.1、§7.2、§9.2）与权限审计条目形状（§8.2）。
 */

/** 拒绝原因枚举；与权限系统共用。 */
export type PermissionDenyReason =
  'not_granted' | 'revoked' | 'out_of_scope' | 'user_rejected' | 'policy';

/** 审计动作（08-权限系统设计 §8.2）：授予、撤销、拒绝、放行。 */
export type PermissionAuditAction = 'grant' | 'revoke' | 'deny' | 'allow';

/** 授权变化来源（08-权限系统设计 §8.2）；运行时判定记录缺省该字段。 */
export type PermissionAuditSource = 'enable' | 'first-call' | 'settings' | 'update' | 'uninstall';

/**
 * 权限审计条目（08-权限系统设计 §8.2 十六字段，全生态唯一权威形状）。
 *
 * @remarks
 * - 本接口是审计条目面的**单一事实源**：SDK 声明面（`@chips/sdk` 权限治理类型）与
 *   `@chips/bridge` 核心判定审计钩子一律锚定/引用本定义，禁止并存第二形状（工单046 段一）；
 *   `tests/contract` 以《08.08》§8.2 文档代码块与本声明做逐字段锁测。
 * - `id` 为 ULID（供给面 `@chips/bridge` `createUlidGenerator`）；`timestamp` 为 ISO 8601 UTC；
 *   落盘为 JSON Lines（§8.3），append-only、插件无读写（§8.4）。
 * - 运行时条目（`action` 为 `allow` / `deny`）的 `permission` 取值粒度：`deny` 为首个缺失项、
 *   `allow` 为本次判定 `required` 声明序首项（§8.2 补注，RFC-权限审计跨层采集sink裁定 §5.4）。
 * - `traceId` 取自横切链路（preload→`bridge:request`→router→事件下行，工单046 段一），
 *   禁另造关联键；`requestId` 为单次请求关联键，同链路透传。
 * - `source` / `actor` / 条目组装时的 `pluginVersion` 补挂归宿主授权/会话权威侧
 *   （RFC §5.3 对齐表）；grant/revoke 动作产生位随链路二交付（工单046 §二.4）。
 */
export interface IPermissionAuditEntry {
  /** 审计记录唯一标识（ULID）。 */
  readonly id: string;
  /** ISO 8601 UTC 时间。 */
  readonly timestamp: string;
  readonly action: PermissionAuditAction;
  /** 授权变化来源；运行时记录缺省。 */
  readonly source?: PermissionAuditSource;
  /** 操作者：`user` 用户操作、`system` 平台判定。 */
  readonly actor: 'user' | 'system';
  readonly pluginId: string;
  readonly pluginVersion: string;
  /** 运行时判定所在会话。 */
  readonly sessionId?: string;
  /** 判定的基础权限 ID。 */
  readonly permission: string;
  /** 解析后的限定值（变量已展开）。 */
  readonly qualifier?: string;
  /** 能力调用涉及的审计目标。 */
  readonly capabilityId?: string;
  /** 本次调用目标（路径、域名、窗口 ID 等）。 */
  readonly target?: string;
  /** 资源访问的目标 URI。 */
  readonly resourceUri?: string;
  /** 拒绝原因。 */
  readonly reason?: PermissionDenyReason;
  /** 全链路追踪 ID，与日志标准一致。 */
  readonly traceId: string;
  /** 单次请求 ID。 */
  readonly requestId?: string;
}

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
