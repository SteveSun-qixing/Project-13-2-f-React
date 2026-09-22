/**
 * 审计留存与轮转基础设施单测（《08.08》§8.4 + 《08.04》§4.1/§4.2 档位词表；
 * 工单046 段二）。
 *
 * @remarks 落帧/清理触发时机的集成臂在 `audit-writer.test.ts`；本件锁纯函数面：
 * 档位映射逐值、文件名词法、过期判据边界（日粒度「严格超过」口径）与扫描保守臂。
 */

import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { BUILTIN_PERMISSIONS } from '@chips/bridge';

import {
  AUDIT_MAX_FILE_BYTES,
  AUDIT_RETENTION_HIGH_RISK_DAYS,
  AUDIT_RETENTION_REGULAR_DAYS,
  PERMISSION_RISK_LEVELS,
  auditFileName,
  parseAuditFileName,
} from '../src/audit/types.js';
import { auditRetentionDaysForPermission, sweepExpiredAuditFiles } from '../src/audit/retention.js';
import { createCollectingDiagnostics, shiftUtcDay } from './helpers/audit-fixture.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 以 UTC 日为轴构造 now 毫秒（dayDiff 精确控制）。 */
function dayStartMs(day: string): number {
  return Date.UTC(
    Number.parseInt(day.slice(0, 4), 10),
    Number.parseInt(day.slice(5, 7), 10) - 1,
    Number.parseInt(day.slice(8, 10), 10),
  );
}

const tempDirs: string[] = [];

async function makeAuditDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'chips-audit-retention-'));
  tempDirs.push(dir);
  return dir;
}

afterAll(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe('轮转/留存在册常量（§8.4 文面数字）', () => {
  it('10 MB 阈值与 180/365 天档位常量逐字在册（10 MiB 口径：生态容量族 1024 进制）', () => {
    expect(AUDIT_MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(AUDIT_RETENTION_REGULAR_DAYS).toBe(180);
    expect(AUDIT_RETENTION_HIGH_RISK_DAYS).toBe(365);
  });
});

describe('审计文件名词法（§8.3 命名 + §8.4 同日序号）', () => {
  it('auditFileName：serial 0 出日文件、N≥1 出序号文件', () => {
    expect(auditFileName('2026-09-19', 0)).toBe('audit-2026-09-19.jsonl');
    expect(auditFileName('2026-09-19', 1)).toBe('audit-2026-09-19.1.jsonl');
    expect(auditFileName('2026-09-19', 12)).toBe('audit-2026-09-19.12.jsonl');
  });

  it('parseAuditFileName：合法词法回解、非词法/非法历日/零序号一律 null', () => {
    expect(parseAuditFileName('audit-2026-09-19.jsonl')).toEqual({ day: '2026-09-19', serial: 0 });
    expect(parseAuditFileName('audit-2026-09-19.3.jsonl')).toEqual({ day: '2026-09-19', serial: 3 });
    for (const name of [
      'trace-2026-09-19.jsonl',
      'audit-2026-09-19.json',
      'audit-2026-13-45.jsonl', // 月份越界（回解不恒等）
      'audit-2026-02-30.jsonl', // 二月三十（回解漂移）
      'audit-2026-09-19.0.jsonl', // 零序号非法（首文件无序号腿）
      'audit-2026-09-19.-2.jsonl',
      'audit-2026-09-19.01.jsonl', // 前导零非法
      'notes.txt',
    ]) {
      expect(parseAuditFileName(name), name).toBeNull();
    }
  });
});

describe('留存档位映射（§8.4 两档 ×《08.04》§4.1 敏感级别列，工单046 裁定一）', () => {
  it('§4.1 全表 25 内置权限逐值对表：高/极高 → 365，低/中 → 180', () => {
    expect(Object.keys(PERMISSION_RISK_LEVELS)).toHaveLength(25);
    expect(new Set(BUILTIN_PERMISSIONS.map((definition) => definition.id))).toEqual(
      new Set(Object.keys(PERMISSION_RISK_LEVELS)),
    );
    const highRisk = [
      'filesystem:read',
      'filesystem:write',
      'filesystem:delete',
      'resources:write',
      'window:control',
      'shortcut:manage',
      'clipboard:access',
      'shell:external',
      'credential:manage',
    ];
    const regularRisk = [
      'resources:read',
      'menu:manage',
      'tray:manage',
      'system:read',
      'power:read',
      'power:manage',
      'transfer:manage',
      'notifications:send',
      'dialogs:use',
      'network:http',
      'config:read',
      'config:write',
      'events:publish',
      'command:read',
      'command:write',
      'command:execute',
    ];
    for (const permission of highRisk) {
      expect(auditRetentionDaysForPermission(permission), permission).toBe(AUDIT_RETENTION_HIGH_RISK_DAYS);
    }
    for (const permission of regularRisk) {
      expect(auditRetentionDaysForPermission(permission), permission).toBe(AUDIT_RETENTION_REGULAR_DAYS);
    }
    expect(PERMISSION_RISK_LEVELS['tray:manage']).toBe('low');
    expect(PERMISSION_RISK_LEVELS['network:http']).toBe('medium');
    expect(PERMISSION_RISK_LEVELS['filesystem:read']).toBe('high');
  });

  it('限定值形态取基础段判档；词表外/文法非法一律 365 保守档（挂账裁量臂）', () => {
    expect(auditRetentionDaysForPermission('filesystem:read:/Users/user/Documents')).toBe(
      AUDIT_RETENTION_HIGH_RISK_DAYS,
    );
    expect(auditRetentionDaysForPermission('config:read:ns.sub')).toBe(AUDIT_RETENTION_REGULAR_DAYS);
    expect(auditRetentionDaysForPermission('custom:power')).toBe(AUDIT_RETENTION_HIGH_RISK_DAYS);
    expect(auditRetentionDaysForPermission('nonsense')).toBe(AUDIT_RETENTION_HIGH_RISK_DAYS);
    expect(auditRetentionDaysForPermission('')).toBe(AUDIT_RETENTION_HIGH_RISK_DAYS);
  });
});

describe('到期清理纯函数臂（sweepExpiredAuditFiles：日粒度「严格超过」判据 + 扫描保守臂）', () => {
  /** 构造审计目录并落指定日文件。 */
  async function setup(files: ReadonlyArray<readonly [string, string]>): Promise<string> {
    const dir = await makeAuditDir();
    for (const [name, content] of files) {
      await writeFile(join(dir, name), content, 'utf8');
    }
    return dir;
  }

  it('边界逐值：dayDiff=180 保留、181 纯常规删、365 含高档保留、366 无条件删', async () => {
    const today = '2026-09-20';
    const now = dayStartMs(today);
    // 日期一律由平移算术构造（免手工历日核算出错）；dayDiff 以毫秒差复核钉死。
    const at180 = auditFileName(shiftUtcDay(today, -180), 0);
    const at181 = auditFileName(shiftUtcDay(today, -181), 0);
    const at365 = auditFileName(shiftUtcDay(today, -365), 0);
    const at366 = auditFileName(shiftUtcDay(today, -366), 0);
    expect((now - dayStartMs(at180.slice(6, 16))) / MS_PER_DAY).toBe(180);
    expect((now - dayStartMs(at181.slice(6, 16))) / MS_PER_DAY).toBe(181);
    expect((now - dayStartMs(at365.slice(6, 16))) / MS_PER_DAY).toBe(365);
    expect((now - dayStartMs(at366.slice(6, 16))) / MS_PER_DAY).toBe(366);
    const dir = await setup([
      [at180, '{"permission":"config:read"}\n'],
      [at181, '{"permission":"config:read"}\n'],
      [at365, '{"permission":"filesystem:write"}\n'],
      [at366, 'corrupt\n'],
    ]);
    const { sink, records } = createCollectingDiagnostics();
    const report = await sweepExpiredAuditFiles(dir, now + 1, sink);
    expect(report).toEqual({ skipped: false, scanned: 4, deleted: 2, retainedHighRisk: 1 });
    const survivors = await readdir(dir);
    expect(survivors.sort()).toEqual([at180, at365].sort());
    expect(records).toHaveLength(0); // 纯函数臂不自发告警（告警在写入器链上呈现）
  });

  it('扫描保守臂：不可解析行 / 缺 permission / 词表外权限的文件整体保留', async () => {
    const now = dayStartMs('2026-09-20');
    const windowDay = shiftUtcDay('2026-09-20', -200); // 180 < dayDiff ≤ 365：进入逐行扫描臂
    const dir = await setup([
      [auditFileName(windowDay, 0), 'not-json-at-all\n'],
      [auditFileName(windowDay, 1), '{"permission":"resources:read"}\n{"traceId":"t"}\n'],
      [auditFileName(windowDay, 2), '{"permission":"custom:mystery"}\n'],
    ]);
    const { sink } = createCollectingDiagnostics();
    const report = await sweepExpiredAuditFiles(dir, now, sink);
    expect(report).toEqual({ skipped: false, scanned: 3, deleted: 0, retainedHighRisk: 3 });
    expect(await readdir(dir)).toHaveLength(3);
  });

  it('纯常规混档文件整体删（scan 证否即无高档）；目录缺失走 skipped 空转臂', async () => {
    const now = dayStartMs('2026-09-20');
    const dir = await setup([
      ['audit-2026-01-15.jsonl', '{"permission":"system:read"}\n{"permission":"command:execute"}\n'],
      ['audit-2026-01-15.1.jsonl', '{"permission":"power:read"}\n'],
      ['readme.md', 'ignore me'],
    ]);
    const { sink } = createCollectingDiagnostics();
    const report = await sweepExpiredAuditFiles(dir, now, sink);
    expect(report).toEqual({ skipped: false, scanned: 2, deleted: 2, retainedHighRisk: 0 });
    expect(await readdir(dir)).toEqual(['readme.md']);
    const missing = await sweepExpiredAuditFiles(join(dir, 'no-such-dir'), now, sink);
    expect(missing).toEqual({ skipped: true, scanned: 0, deleted: 0, retainedHighRisk: 0 });
  });

  it('删除失败不抛出：只落诊断（§8.1 失败不阻塞同族纪律，清理步永不炸链）', async () => {
    const now = dayStartMs('2026-09-20');
    const expiredName = 'audit-2025-08-01.jsonl'; // dayDiff 415 > 365：直接删除臂
    const dir = await makeAuditDir();
    // 同名位是目录 → unlink 必失败（EPERM/EISDIR），清理步只留痕不抛出。
    await mkdir(join(dir, expiredName));
    const { sink, records } = createCollectingDiagnostics();
    const report = await sweepExpiredAuditFiles(dir, now, sink);
    expect(report).toEqual({ skipped: false, scanned: 1, deleted: 0, retainedHighRisk: 0 });
    const alarm = records.find((record) => record.message === '审计留存清理删除失败');
    expect(alarm?.details).toEqual({ file: expiredName, reason: expect.any(String) as string });
  });
});
