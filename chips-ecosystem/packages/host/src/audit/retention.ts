/**
 * 审计留存清理（§8.4；工单046 段二）。
 *
 * 权威逐条对应：
 * - 「留存期：常规审计至少 180 天；涉及高、极高风险权限的记录至少 365 天」——档位判定
 *   字段 = 条目 `permission`（基础权限 ID），按《08.04》§4.1 敏感级别列（§4.2 四档词表）
 *   映射：高/极高 → 365 天档，低/中 → 180 天档；风险级别只决定档位、不决定是否记录
 *   （工单046 裁定一）。
 * - 「到期由平台清理；插件与一般应用无删除接口」——清理只由本模块（平台侧）执行。
 * - 「审计文件为追加写入（append-only）」——清理只做整文件删除，绝不改写既有文件；
 *   180~365 天窗口内的文件若混有高档位条目则整体保留（不可改写剔行），至 365 天档
 *   超期后整文件删除。
 *
 * @remarks
 * - **日粒度过期判据**：文件归属 UTC 日历日 D，其内条目的落盘时刻 ∈ [D, D+1)。
 *   「至少 R 天」要求删除时刻与条目落盘时刻差 ≥ R 天；日粒度下的最迟条目可迟至
 *   D+1−ε，故安全条件为 `今日 − D > R`（严格超过）。该判据可能多留至多约 2 个日历日，
 *   「至少」口径下多留合规、早删违规。
 * - **未登记权限兜底**：`permission` 不在《08.04》§4.1 词表（含文法非法形态）时取
 *   365 天保守档——两档均为「至少」下限，取长档恒不违 §8.4 文面；文面未裁该臂，
 *   如实登记于报告挂账。
 * - 清理触发时机（立项书段二逐字）：**启动期 + 跨日界**到期清理；两步均经写入器
 *   同序异步链排队执行，单实例同一时刻至多一个清理任务。
 */

import { readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { parsePermissionId } from '@chips/bridge';

import type { DiagnosticsSink } from '../shared/diagnostics.js';
import {
  AUDIT_RETENTION_HIGH_RISK_DAYS,
  AUDIT_RETENTION_REGULAR_DAYS,
  parseAuditFileName,
  PERMISSION_RISK_LEVELS,
  type PermissionRiskLevel,
} from './types.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 单条权限的留存档位天数（§8.4 两档：180 / 365）。 */
export function auditRetentionDaysForPermission(permission: string): number {
  const parsed = parsePermissionId(permission);
  const base = parsed === undefined ? permission : `${parsed.domain}:${parsed.scope}`;
  const level: PermissionRiskLevel | undefined = PERMISSION_RISK_LEVELS[base];
  if (level === undefined) {
    return AUDIT_RETENTION_HIGH_RISK_DAYS; // 未登记臂：保守取长档（见模块头注）。
  }
  return level === 'high' || level === 'critical' ? AUDIT_RETENTION_HIGH_RISK_DAYS : AUDIT_RETENTION_REGULAR_DAYS;
}

/** 清理计数可变形（内部累积用；对外快照形为 {@link AuditSweepReport}）。 */
interface SweepCounters {
  skipped: boolean;
  scanned: number;
  deleted: number;
  retainedHighRisk: number;
}

/** 一轮清理的结果快照（诊断与锁测共用）。 */
export interface AuditSweepReport {
  /** 目录缺失等无可清理面的空转臂为 true。 */
  readonly skipped: boolean;
  /** 命中审计词法的文件总数。 */
  readonly scanned: number;
  /** 本轮删除文件数。 */
  readonly deleted: number;
  /** 超 180 天但含高/极高风险条目（或不可证明为纯常规档）而保留的文件数。 */
  readonly retainedHighRisk: number;
}

/** 逐行扫描文件是否含 365 天档条目；不可解析行按保守臂保留（返回 true）。 */
async function containsHighRiskEntry(filePath: string): Promise<boolean> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch {
    return true; // 不可读即不可证明已到期常规档：保守保留。
  }
  for (const line of text.split('\n')) {
    if (line.length === 0) {
      continue;
    }
    try {
      const entry = JSON.parse(line) as { permission?: unknown };
      if (typeof entry?.permission !== 'string') {
        return true;
      }
      if (auditRetentionDaysForPermission(entry.permission) === AUDIT_RETENTION_HIGH_RISK_DAYS) {
        return true;
      }
    } catch {
      return true; // 行不可解析：内容无法证明，保守保留。
    }
  }
  return false;
}

/**
 * 到期清理一轮（§8.4「到期由平台清理」；触发时机见模块头注）。
 *
 * @param directory 审计目录（`<userData>/logs/audit`）。
 * @param nowMs 当前时刻（Unix 毫秒，测试可注入）。
 * @param diagnostics 诊断口（删除失败 / 扫描异常留痕，绝不抛出）。
 */
export async function sweepExpiredAuditFiles(
  directory: string,
  nowMs: number,
  diagnostics: DiagnosticsSink,
): Promise<AuditSweepReport> {
  const empty: SweepCounters = { skipped: true, scanned: 0, deleted: 0, retainedHighRisk: 0 };
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return { ...empty }; // 目录未诞生（尚无落盘）即无可清理面。
  }
  const todayDayIndex = Math.floor(nowMs / MS_PER_DAY);
  const report: SweepCounters = { skipped: false, scanned: 0, deleted: 0, retainedHighRisk: 0 };
  for (const name of names) {
    const parsedName = parseAuditFileName(name);
    if (parsedName === null) {
      continue; // 非审计词法文件不触碰（清理只对自身产物负责）。
    }
    report.scanned += 1;
    const fileDayIndex =
      Date.UTC(
        Number.parseInt(parsedName.day.slice(0, 4), 10),
        Number.parseInt(parsedName.day.slice(5, 7), 10) - 1,
        Number.parseInt(parsedName.day.slice(8, 10), 10),
      ) / MS_PER_DAY;
    const dayDiff = todayDayIndex - fileDayIndex;
    if (dayDiff <= AUDIT_RETENTION_REGULAR_DAYS) {
      continue; // 未超常规档：两档都未到期。
    }
    const filePath = join(directory, name);
    if (dayDiff > AUDIT_RETENTION_HIGH_RISK_DAYS) {
      await removeAuditFile(filePath, name, report, diagnostics);
      continue;
    }
    // 180 < dayDiff ≤ 365：常规档已到期、高风险档未到期——含高档条目则整体保留。
    if (await containsHighRiskEntry(filePath)) {
      report.retainedHighRisk += 1;
      continue;
    }
    await removeAuditFile(filePath, name, report, diagnostics);
  }
  return report;
}

/** 删除一个已过档审计文件；失败只落诊断不抛出（§8.1 失败不阻塞同族纪律）。 */
async function removeAuditFile(
  filePath: string,
  name: string,
  report: SweepCounters,
  diagnostics: DiagnosticsSink,
): Promise<void> {
  try {
    await unlink(filePath);
    report.deleted += 1;
  } catch (error: unknown) {
    diagnostics.error('permission-audit', '审计留存清理删除失败', {
      file: name,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
