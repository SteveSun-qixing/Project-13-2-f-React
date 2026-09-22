/**
 * 权限审计写入器波（工单046 段二）测试夹具：临时目录管理、诊断收集口、
 * §8.2 合法条目工厂与 JSONL 行读取器。
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createUlidGenerator, type IPermissionAuditEntry } from '@chips/bridge';

import type { DiagnosticsSink } from '../../src/shared/diagnostics.js';

/** 一条诊断记录。 */
export interface CapturedDiagnostic {
  readonly level: 'warn' | 'error';
  readonly scope: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** 诊断收集口（断言「内部告警」面）。 */
export function createCollectingDiagnostics(): { sink: DiagnosticsSink; records: CapturedDiagnostic[] } {
  const records: CapturedDiagnostic[] = [];
  const sink: DiagnosticsSink = {
    warn(scope, message, details) {
      records.push({ level: 'warn', scope, message, ...(details === undefined ? {} : { details }) });
    },
    error(scope, message, details) {
      records.push({ level: 'error', scope, message, ...(details === undefined ? {} : { details }) });
    },
  };
  return { sink, records };
}

const tempDirs: string[] = [];

/** 建临时 userData 根并登记清理。 */
export async function makeTempUserData(prefix = 'chips-audit-'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** 清理全部登记的临时目录（各测试文件 afterEach 调用）。 */
export async function cleanupTempUserData(): Promise<void> {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

/** 审计目录（§8.3 `<userData>/logs/audit`）。 */
export function auditDirectory(userDataPath: string): string {
  return join(userDataPath, 'logs', 'audit');
}

/** 夹具基准时刻（ISO 8601 UTC，§8.3 样例同轴）。 */
export const FIXTURE_ISO = '2026-09-19T10:20:31.482Z';

/** 夹具基准 ULID 生成器（id 与 timestamp 同毫秒锚定）。 */
const fixtureUlid = createUlidGenerator({ now: () => Date.parse(FIXTURE_ISO) });

/** 构造一条 §8.2 合法运行时 deny 条目（覆写臂供各用例变形）。 */
export function makeAuditEntry(overrides: Partial<IPermissionAuditEntry> = {}): IPermissionAuditEntry {
  return {
    id: fixtureUlid.next(),
    timestamp: FIXTURE_ISO,
    action: 'deny',
    actor: 'system',
    pluginId: 'chips.official.editor',
    pluginVersion: '1.0.0',
    permission: 'filesystem:write',
    traceId: 't-3b91',
    ...overrides,
  };
}

/** 只读审计文件的 JSONL 行集（跳过空行）。 */
export async function readAuditFileLines(filePath: string): Promise<unknown[]> {
  const text = await readFile(filePath, 'utf8');
  return text
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

/** 把 UTC 日历日字符串平移 N 天（留存边界用例的日期算术）。 */
export function shiftUtcDay(day: string, days: number): string {
  const base = Date.UTC(
    Number.parseInt(day.slice(0, 4), 10),
    Number.parseInt(day.slice(5, 7), 10) - 1,
    Number.parseInt(day.slice(8, 10), 10),
  );
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
