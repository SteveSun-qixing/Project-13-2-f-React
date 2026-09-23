/**
 * 权限审计写入器模块出口（工单046 段二）。
 *
 * @remarks
 * - 消费入口唯一：`IPermissionAuditWriter.enqueue`——段三判定面挂钩与接线波 native
 *   observer 的宿主 TS 消费函数（`decision-intake.ts`，工单046 段四接线波）直对该
 *   API（RFC §九 9.2-2「单条目单落点」），本模块不提供第二入口。
 * - 判定面挂钩发射位不在本波（工单046 裁定三硬绑 025③，禁双挂点）；native 素材侧
 *   消费点已由接线波交付（`createPermissionDecisionIntake`），宿主 TS 判定臂维持
 *   段三在册接线位。
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
export {
  bindNativeDecisionSink,
  createPermissionDecisionIntake,
  type INativeAuditDecisionFrame,
  type INativePermissionDecision,
  type IPermissionDecisionIntake,
  type IPermissionDecisionIntakeReport,
  type NativeAuditBindOutcome,
  type PermissionDecisionIntakeOptions,
  type PermissionDecisionSink,
} from './decision-intake.js';
