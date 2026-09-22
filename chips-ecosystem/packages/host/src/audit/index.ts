/**
 * 权限审计写入器模块出口（工单046 段二）。
 *
 * @remarks
 * - 消费入口唯一：`IPermissionAuditWriter.enqueue`——段三判定面挂钩与接线波 native
 *   observer 的宿主 TS 消费函数直对该 API（RFC §九 9.2-2「单条目单落点」），本模块
 *   不提供第二入口。
 * - 判定面挂钩发射位不在本波（工单046 裁定三硬绑 025③，禁双挂点）；本波交付形态为
 *   「写入器常开待消费」。
 */

export {
  AUDIT_DIRECTORY,
  AUDIT_MAX_FILE_BYTES,
  AUDIT_QUEUE_CAPACITY,
  AUDIT_RETENTION_HIGH_RISK_DAYS,
  AUDIT_RETENTION_REGULAR_DAYS,
  PERMISSION_RISK_LEVELS,
  auditFileName,
  parseAuditFileName,
  isPermissionAuditAction,
  isPermissionAuditSource,
  isPermissionDenyReason,
  isPermissionAuditActor,
  type PermissionRiskLevel,
  type ParsedAuditFileName,
  type IPermissionAuditWriter,
  type IPermissionAuditWriterReport,
} from './types.js';
export { sanitizeAuditEntry, sanitizeAuditUriValue, type SanitizedAuditRecord } from './sanitize.js';
export { auditRetentionDaysForPermission, sweepExpiredAuditFiles, type AuditSweepReport } from './retention.js';
export { createPermissionAuditWriter, validateAuditEntry, type PermissionAuditWriterOptions } from './writer.js';
