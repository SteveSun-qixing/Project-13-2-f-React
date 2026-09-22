/**
 * 权限审计写入器公共形状与在册常量（工单046 段二 / W3-P0-3 立项书段二）。
 *
 * 权威：《08-权限系统设计》链路四（`08.08` v1.0.3）——
 * - §8.2：条目形状唯一事实源为 `@chips/bridge` `IPermissionAuditEntry`（十六字段，本模块只消费不重定义）；
 * - §8.3：落盘为 JSON Lines `<userData>/logs/audit/audit-YYYY-MM-DD.jsonl`，一行一条 JSON 对象
 *   （样例为单行形态；键序不作契约，`JSON.stringify` 拾取序呈现）；
 * - §8.4：按日切分；当日文件超过 10 MB 切换到同日序号文件；留存期常规至少 180 天、
 *   涉及高/极高风险权限的记录至少 365 天（风险级别决定留存档位、不决定是否记录——工单046 裁定一）；
 *   到期由平台清理，审计文件 append-only、插件无读写；
 * - §8.5：脱敏规则（不记录凭证值/文件内容/网络请求体；网络目标只记录 scheme、host 与 port；
 *   URI query 审计脱敏沿用 `protocol/resource-uri.ts` 在册口径）。
 *
 * @remarks
 * - **常开**：本写入器不受 `CHIPS_TRACE` 门控（工单041「诊断≠审计、审计常开」隔离口径；
 *   `shared/host-trace.ts` 只借其队列/背压/故障隔离工程形态，门控语义禁借）。
 * - 留存档位判定字段 = 条目 `permission`（基础权限 ID）按《08.04》§4.1 内置权限清单
 *   「敏感级别」列（§4.2 低/中/高/极高四档词表）映射档位；本表逐行照抄该文，禁止自造档位。
 */

import type {
  PermissionAuditAction,
  PermissionAuditSource,
  PermissionDenyReason,
  IPermissionAuditEntry,
} from '@chips/bridge';

/** 审计落盘子目录（§8.3：`<userData>/logs/audit/`）。 */
export const AUDIT_DIRECTORY = ['logs', 'audit'] as const;

/** 当日文件大小超过该字节数即切换同日序号文件（§8.4「超过 10 MB」）。 */
export const AUDIT_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** 常规审计留存天数下限（§8.4「至少 180 天」）。 */
export const AUDIT_RETENTION_REGULAR_DAYS = 180;

/** 高/极高风险权限记录留存天数下限（§8.4「至少 365 天」）。 */
export const AUDIT_RETENTION_HIGH_RISK_DAYS = 365;

/**
 * 有界队列容量（条）。RFC-权限审计跨层采集sink裁定 §六条 2 明载「队列容量、drain 策略与
 * dropped 告警载荷归宿主实现，非 crate 契约面」；取 1024 与同序单写链的落盘速率相称
 * （持续洪峰超出该深度即满则丢 + 计数 + 诊断告警，判定面永不阻塞）。
 */
export const AUDIT_QUEUE_CAPACITY = 1024;

/** 权限风险级别四档（《08.04》§4.2 词表：低 / 中 / 高 / 极高）。 */
export type PermissionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * 内置权限 → 风险级别映射（《08.04》§4.1 总表「敏感级别」列逐行照抄，v1.0.1）。
 *
 * @remarks 现行内置清单无「极高」档位条目，`critical` 档为词表在册档，随
 * 《08.04》清单增补时同步；档位对留存的效力只有「高/极高 → 365 天」与
 * 「低/中 → 180 天」两臂（§8.4），见 `retention.ts`。
 */
export const PERMISSION_RISK_LEVELS: Readonly<Record<string, PermissionRiskLevel>> = Object.freeze({
  'filesystem:read': 'high',
  'filesystem:write': 'high',
  'filesystem:delete': 'high',
  'resources:read': 'medium',
  'resources:write': 'high',
  'window:control': 'high',
  'menu:manage': 'medium',
  'tray:manage': 'low',
  'shortcut:manage': 'high',
  'system:read': 'low',
  'power:read': 'low',
  'power:manage': 'medium',
  'transfer:manage': 'medium',
  'notifications:send': 'low',
  'clipboard:access': 'high',
  'dialogs:use': 'low',
  'shell:external': 'high',
  'network:http': 'medium',
  'config:read': 'low',
  'config:write': 'medium',
  'credential:manage': 'high',
  'events:publish': 'low',
  'command:read': 'low',
  'command:write': 'low',
  'command:execute': 'medium',
});

/** `action` 词表（§8.2 `PermissionAuditAction`；exhaustive 记录漂移即编译红）。 */
const AUDIT_ACTION_WORDS = { grant: true, revoke: true, deny: true, allow: true } as const satisfies Record<
  PermissionAuditAction,
  true
>;

/** `source` 词表（§8.2 `PermissionAuditSource`）。 */
const AUDIT_SOURCE_WORDS = {
  enable: true,
  'first-call': true,
  settings: true,
  update: true,
  uninstall: true,
} as const satisfies Record<PermissionAuditSource, true>;

/** `reason` 词表（§8.2 `PermissionDenyReason`）。 */
const AUDIT_REASON_WORDS = {
  not_granted: true,
  revoked: true,
  out_of_scope: true,
  user_rejected: true,
  policy: true,
} as const satisfies Record<PermissionDenyReason, true>;

/** §8.2 `actor` 词表。 */
const AUDIT_ACTOR_WORDS = { user: true, system: true } as const satisfies Record<IPermissionAuditEntry['actor'], true>;

/** 条目 `action` 是否落在 §8.2 词表。 */
export function isPermissionAuditAction(value: string): value is PermissionAuditAction {
  return Object.hasOwn(AUDIT_ACTION_WORDS, value);
}

/** 条目 `source` 是否落在 §8.2 词表。 */
export function isPermissionAuditSource(value: string): value is PermissionAuditSource {
  return Object.hasOwn(AUDIT_SOURCE_WORDS, value);
}

/** 条目 `reason` 是否落在 §8.2 词表。 */
export function isPermissionDenyReason(value: string): value is PermissionDenyReason {
  return Object.hasOwn(AUDIT_REASON_WORDS, value);
}

/** 条目 `actor` 是否落在 §8.2 词表。 */
export function isPermissionAuditActor(value: string): value is IPermissionAuditEntry['actor'] {
  return Object.hasOwn(AUDIT_ACTOR_WORDS, value);
}

/** 审计文件名解析结果（§8.3 命名：首文件 `audit-YYYY-MM-DD.jsonl`，溢出序号文件 `audit-YYYY-MM-DD.N.jsonl`）。 */
export interface ParsedAuditFileName {
  /** UTC 日历日（`YYYY-MM-DD`）。 */
  readonly day: string;
  /** 同日序号（首文件 0；§8.4 序号文件从 1 起——命名形态系文面「同日序号文件」的实现落定）。 */
  readonly serial: number;
}

/** 审计文件名词法（§8.3 按日切分 + §8.4 同日序号）。 */
const AUDIT_FILE_NAME_PATTERN = /^audit-(\d{4}-\d{2}-\d{2})(?:\.(\d+))?\.jsonl$/;

/** 取某一 UTC 日历日的审计文件名（serial=0 为当日首文件）。 */
export function auditFileName(day: string, serial: number): string {
  return serial === 0 ? `audit-${day}.jsonl` : `audit-${day}.${serial}.jsonl`;
}

/** 解析审计文件名；非审计词法或日期非法（如 2026-13-45）返回 `null`。 */
export function parseAuditFileName(name: string): ParsedAuditFileName | null {
  const match = AUDIT_FILE_NAME_PATTERN.exec(name);
  if (match === null) {
    return null;
  }
  const day = match[1] as string;
  const serialText = match[2];
  if (serialText !== undefined && !/^(?:0|[1-9]\d*)$/.test(serialText)) {
    return null;
  }
  const [year, month, date] = day.split('-').map((part) => Number.parseInt(part, 10));
  const stamp = Date.UTC(year as number, (month as number) - 1, date);
  if (
    !Number.isFinite(stamp) ||
    new Date(stamp).toISOString().slice(0, 10) !== day ||
    (serialText !== undefined && Number.parseInt(serialText, 10) === 0)
  ) {
    return null;
  }
  return { day, serial: serialText === undefined ? 0 : Number.parseInt(serialText, 10) };
}

/** 写入器诊断快照（并入宿主 `report()` 面，供平台侧观察常开状态）。 */
export interface IPermissionAuditWriterReport {
  /** 落盘目录（`<userData>/logs/audit`）。 */
  readonly directory: string;
  /** 累计成功落盘条数。 */
  readonly written: number;
  /** 累计丢弃条数（队列满载 / 条目非法 / 写盘失败 / 关闭后投递，全部计入并伴随诊断告警）。 */
  readonly dropped: number;
  /** 当前在队待落盘条数。 */
  readonly queued: number;
  /** 是否已关闭（关闭后 `enqueue` 一律丢弃 + 计数 + 诊断）。 */
  readonly closed: boolean;
}

/**
 * 权限审计写入器（段二唯一生产消费面）。
 *
 * @remarks
 * - {@link IPermissionAuditWriter.enqueue} 是唯一消费入口：同步、永不抛错、有界队列
 *   （满则丢新条目 + 计数 + 诊断载荷，RFC §六条 2 背压口径）；段三判定面挂钩与接线波
 *   native observer 的 TS 消费函数直对本入口，禁止第二入口。
 * - 落盘经同序异步链追加（保序 + 写失败不阻塞判定，§8.1）；`flush()` 等待链尾完成，
 *   `close()` flush 收尾且幂等。
 */
export interface IPermissionAuditWriter {
  /** 接收一条审计条目（永不抛错；见接口头注）。 */
  enqueue(entry: IPermissionAuditEntry): void;
  /** 等待当前在途入队与落盘全部完成（含已排队的留存清理步）。 */
  flush(): Promise<void>;
  /** 关闭：拒收新条目并 flush 收尾；幂等。 */
  close(): Promise<void>;
  /** 诊断快照。 */
  report(): IPermissionAuditWriterReport;
}
