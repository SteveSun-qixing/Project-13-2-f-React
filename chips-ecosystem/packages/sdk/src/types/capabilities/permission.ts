/**
 * 权限治理能力契约类型（04-能力契约规范 §7.18，工单046 登记）。
 *
 * 口径：
 * - 四项能力（`permission:grant` / `permission:revoke` / `permission:restore` /
 *   `permission:audit-read`）声明空权限数组，按调用方平台治理身份校验，仅平台内置
 *   设置界面可达（§6.2 注 8）；治理身份校验与失败臂错误码、授权存储写入链路、
 *   审计写入器均归工单046 后续实现波次（§7.18 约束段），本文件只登记编译期契约形状；
 * - `IPermissionAuditEntry` 条目形状以 08-权限系统设计 §8.2 为唯一权威（16 字段）；
 * - `ICapabilityContracts` 中权限治理四行的契约类型即本文件类型（04 §2.3）。
 */

/** 治理动作终态（04 §7.18；granted/denied 两态，08 §6.1）。 */
export type PermissionGovernanceState = 'granted' | 'denied';

/** 审计动作（08 §8.2）。 */
export type PermissionAuditAction = 'grant' | 'revoke' | 'deny' | 'allow';

/** 授权变化来源（08 §8.2；运行时判定记录缺省该字段）。 */
export type PermissionAuditSource = 'enable' | 'first-call' | 'settings' | 'update' | 'uninstall';

/** 拒绝原因五枚举（08 §8.2）。 */
export type PermissionDenyReason =
  'not_granted' | 'revoked' | 'out_of_scope' | 'user_rejected' | 'policy';

/**
 * 审计记录条目（08 §8.2 权威形状，字段逐一照录）。
 *
 * `id` 为 ULID；`timestamp` 为 ISO 8601 UTC；落盘为 JSON Lines（08 §8.3），
 * append-only，插件无读写（08 §8.4）。
 */
export interface IPermissionAuditEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly action: PermissionAuditAction;
  readonly source?: PermissionAuditSource;
  readonly actor: 'user' | 'system';
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly sessionId?: string;
  readonly permission: string;
  readonly qualifier?: string;
  readonly capabilityId?: string;
  readonly target?: string;
  readonly resourceUri?: string;
  readonly reason?: PermissionDenyReason;
  readonly traceId: string;
  readonly requestId?: string;
}

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
