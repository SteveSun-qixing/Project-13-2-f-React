/**
 * 权限审计写入器单测（工单046 段二 / W3-P0-3 立项书段二「写入器单测矩阵」）。
 *
 * 权威：《08.08》§8.1（异步追加、失败不阻塞但必录内部告警）、§8.2（十六字段契约形）、
 * §8.3（JSONL 一行一条、`<userData>/logs/audit/audit-YYYY-MM-DD.jsonl`）、
 * §8.4（按日切分 + 当日超过 10 MB 切同日序号文件、留存 180/365 天）；
 * 工单046 裁定一（全量记录、风险只决定档位）；RFC §六条 2（有界队列满则丢 + 计数 +
 * dropped 告警载荷）；工单041（审计常开、不受 CHIPS_TRACE 门控）。
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { IPermissionAuditEntry } from '@chips/bridge';

import {
  AUDIT_RETENTION_HIGH_RISK_DAYS,
  AUDIT_RETENTION_REGULAR_DAYS,
  auditFileName,
  createPermissionAuditWriter,
  validateAuditEntry,
} from '../src/audit/index.js';
import {
  auditDirectory,
  cleanupTempUserData,
  createCollectingDiagnostics,
  FIXTURE_ISO,
  makeAuditEntry,
  makeTempUserData,
  readAuditFileLines,
  shiftUtcDay,
  type CapturedDiagnostic,
} from './helpers/audit-fixture.js';

/** 夹具「当前时刻」：2026-09-20 UTC（所有测试注入同一 now，留存清理面与真实时钟解耦）。 */
const NOW_MS = Date.UTC(2026, 8, 20);

afterEach(async () => {
  await cleanupTempUserData();
});

describe('落帧语义（§8.3 JSONL 一行一条）', () => {
  it('合法运行时 deny 条目逐字段完整落帧：必填八字段恒在、缺省可选字段键不出现', async () => {
    const userData = await makeTempUserData();
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    writer.enqueue(makeAuditEntry());
    await writer.flush();
    const lines = await readAuditFileLines(join(auditDirectory(userData), auditFileName('2026-09-19', 0)));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      id: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/) as string,
      timestamp: FIXTURE_ISO,
      action: 'deny',
      actor: 'system',
      pluginId: 'chips.official.editor',
      pluginVersion: '1.0.0',
      permission: 'filesystem:write',
      traceId: 't-3b91',
    });
    await writer.close();
  });

  it('可选八字段齐备的 grant 条目全字段落帧（键序不作契约：按解析对象对表）', async () => {
    const userData = await makeTempUserData();
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    writer.enqueue(
      makeAuditEntry({
        action: 'grant',
        source: 'enable',
        actor: 'user',
        sessionId: 's-7f2a',
        qualifier: '/Users/user/Documents/chips',
        capabilityId: 'file:write',
        target: '/Users/user/Desktop/draft.card',
        requestId: 'r-5c02',
      }),
    );
    await writer.flush();
    const lines = (await readAuditFileLines(join(auditDirectory(userData), 'audit-2026-09-19.jsonl'))) as Array<
      Record<string, unknown>
    >;
    expect(Object.keys(lines[0] as Record<string, unknown>).sort()).toEqual(
      [
        'id',
        'timestamp',
        'action',
        'source',
        'actor',
        'pluginId',
        'pluginVersion',
        'sessionId',
        'permission',
        'qualifier',
        'capabilityId',
        'target',
        'traceId',
        'requestId',
      ].sort(),
    );
    expect(lines[0]?.['action']).toBe('grant');
    expect(lines[0]?.['source']).toBe('enable');
    expect(lines[0]?.['qualifier']).toBe('/Users/user/Documents/chips');
    await writer.close();
  });

  it('同序异步追加：多条入队按调用序落行、换行注入被 JSON 转义保持单行对象形态', async () => {
    const userData = await makeTempUserData();
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    for (const permission of ['config:read', 'system:read', 'command:execute']) {
      writer.enqueue(makeAuditEntry({ action: 'allow', permission, target: `evil\nline-${permission}` }));
    }
    await writer.flush();
    const filePath = join(auditDirectory(userData), 'audit-2026-09-19.jsonl');
    const raw = await readFile(filePath, 'utf8');
    const physicalLines = raw.split('\n');
    expect(physicalLines[physicalLines.length - 1]).toBe(''); // 行行以 \n 收尾
    expect(physicalLines).toHaveLength(4); // 3 条记录 + 尾部空段：换行不裂行
    const parsed = (await readAuditFileLines(filePath)) as Array<{ permission: string; target: string }>;
    expect(parsed.map((line) => line.permission)).toEqual(['config:read', 'system:read', 'command:execute']);
    expect(parsed[0]?.target).toBe('evil\nline-config:read');
    await writer.close();
  });

  it('按日切分：不同 UTC 日条目落各自日文件（§8.4 按日切分臂）', async () => {
    const userData = await makeTempUserData();
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    writer.enqueue(makeAuditEntry({ timestamp: '2026-09-19T23:00:00.000Z' }));
    writer.enqueue(makeAuditEntry({ timestamp: '2026-09-20T00:00:00.000Z' }));
    await writer.flush();
    expect(await readAuditFileLines(join(auditDirectory(userData), 'audit-2026-09-19.jsonl'))).toHaveLength(1);
    expect(await readAuditFileLines(join(auditDirectory(userData), 'audit-2026-09-20.jsonl'))).toHaveLength(1);
    await writer.close();
  });

  it('append-only：既有日文件只追加不改写（种子行原样、行数递增）', async () => {
    const userData = await makeTempUserData();
    await mkdir(auditDirectory(userData), { recursive: true });
    const filePath = join(auditDirectory(userData), 'audit-2026-09-19.jsonl');
    const seed = '{"id":"01J8Z0M4N6Q7R8S9T0V1W2X3Y4","note":"seed"}\n';
    await writeFile(filePath, seed, 'utf8');
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    writer.enqueue(makeAuditEntry());
    await writer.flush();
    const raw = await readFile(filePath, 'utf8');
    expect(raw.startsWith(seed)).toBe(true);
    expect(raw.split('\n').filter((line) => line.length > 0)).toHaveLength(2);
    await writer.close();
  });
});

describe('轮转（§8.4 当日超过 10 MB 切同日序号文件）', () => {
  it('体量越阈即切序号：小阈值注入臂落 .jsonl / .1 / .2 三文件', async () => {
    const userData = await makeTempUserData();
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({
      userDataPath: userData,
      diagnostics: sink,
      now: () => NOW_MS,
      maxFileBytes: 64,
    });
    for (const permission of ['config:read', 'system:read', 'power:read']) {
      writer.enqueue(makeAuditEntry({ action: 'allow', permission }));
    }
    await writer.flush();
    expect(writer.report().written).toBe(3);
    expect(await readAuditFileLines(join(auditDirectory(userData), 'audit-2026-09-19.jsonl'))).toHaveLength(1);
    expect(await readAuditFileLines(join(auditDirectory(userData), 'audit-2026-09-19.1.jsonl'))).toHaveLength(1);
    expect(await readAuditFileLines(join(auditDirectory(userData), 'audit-2026-09-19.2.jsonl'))).toHaveLength(1);
    await writer.close();
  });

  it('未超阈不切：注入臂缺省即文档 10 MiB 阈值，条目同落首文件、无序号文件诞生', async () => {
    const userData = await makeTempUserData();
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    writer.enqueue(makeAuditEntry());
    writer.enqueue(makeAuditEntry());
    await writer.flush();
    const info = await stat(join(auditDirectory(userData), 'audit-2026-09-19.jsonl'));
    expect(info.size).toBeLessThan(10 * 1024 * 1024);
    await expect(readFile(join(auditDirectory(userData), 'audit-2026-09-19.1.jsonl'), 'utf8')).rejects.toThrow();
    expect(await readAuditFileLines(join(auditDirectory(userData), 'audit-2026-09-19.jsonl'))).toHaveLength(2);
    await writer.close();
  });

  it('进程重启续档：既有超阈文件被跳过、续写进入首个未超阈序号（多级续扫）', async () => {
    const userData = await makeTempUserData();
    await mkdir(auditDirectory(userData), { recursive: true });
    await writeFile(join(auditDirectory(userData), 'audit-2026-09-19.jsonl'), 'x'.repeat(500), 'utf8');
    await writeFile(join(auditDirectory(userData), 'audit-2026-09-19.1.jsonl'), 'y'.repeat(500), 'utf8');
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({
      userDataPath: userData,
      diagnostics: sink,
      now: () => NOW_MS,
      maxFileBytes: 64,
    });
    writer.enqueue(makeAuditEntry());
    await writer.flush();
    expect(await readFile(join(auditDirectory(userData), 'audit-2026-09-19.jsonl'), 'utf8')).toBe('x'.repeat(500));
    expect(await readFile(join(auditDirectory(userData), 'audit-2026-09-19.1.jsonl'), 'utf8')).toBe('y'.repeat(500));
    // 两文件皆超阈且非零体量 → 首个可写序号为 .2 之后（.2 不存在亦超不了阈——种子臂逐序探测落 .2）
    expect(await readAuditFileLines(join(auditDirectory(userData), 'audit-2026-09-19.2.jsonl'))).toHaveLength(1);
    await writer.close();
  });
});

describe('条目形状闸（§8.2 十六字段契约：非法即拒落 + dropped 计数 + 告警）', () => {
  it('validateAuditEntry：合法臂（含可选词表值与无毫秒 ISO）返回 null', () => {
    expect(validateAuditEntry(makeAuditEntry())).toBeNull();
    expect(validateAuditEntry(makeAuditEntry({ source: 'enable' }))).toBeNull();
    expect(validateAuditEntry(makeAuditEntry({ reason: 'policy' }))).toBeNull();
    expect(validateAuditEntry(makeAuditEntry({ timestamp: '2026-09-19T10:20:31Z' }))).toBeNull();
  });

  it('validateAuditEntry：逐非法臂返回可读定性（词表越界 / 非 ULID / 非 UTC ISO / 空必填 / 可选非串）', () => {
    // 运行时形状闸臂：覆写形取裸记录（词表越界值与显式 undefined 都在运行时层校验，
    // 编译期类型面由 `makeAuditEntry` 的合法基线保证）。
    const invalidCases: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ['id 非 ULID', { id: 'not-a-ulid' }],
      ['timestamp 带时区偏移腿', { timestamp: '2026-09-19T18:20:31.482+08:00' }],
      ['timestamp 非法历日', { timestamp: '2026-13-45T10:20:31.482Z' }],
      ['action 越词表', { action: 'denyx' }],
      ['actor 越词表', { actor: 'robot' }],
      ['source 越词表', { source: 'enablex' }],
      ['reason 越词表', { reason: 'because' }],
      ['必填 pluginId 空串', { pluginId: '' }],
      ['必填 traceId 缺位', { traceId: undefined }],
      ['可选 sessionId 非字符串', { sessionId: 42 }],
    ];
    for (const [label, overrides] of invalidCases) {
      expect(validateAuditEntry(makeAuditEntry(overrides as Partial<IPermissionAuditEntry>)), label).toBeTypeOf(
        'string',
      );
    }
    expect(validateAuditEntry(null as unknown as IPermissionAuditEntry)).toContain('非对象');
  });

  it('非法条目不入队不落盘：dropped 递增 + error 告警携 droppedCount 载荷、目录零诞生', async () => {
    const userData = await makeTempUserData();
    const { sink, records } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    writer.enqueue(makeAuditEntry({ id: 'bad' }));
    writer.enqueue(makeAuditEntry({ action: 'nope' as IPermissionAuditEntry['action'] }));
    await writer.flush();
    const report = writer.report();
    expect(report.written).toBe(0);
    expect(report.dropped).toBe(2);
    const alarms = records.filter((record: CapturedDiagnostic) => record.message.includes('形状非法'));
    expect(alarms).toHaveLength(2);
    expect(alarms[0]?.details).toEqual({ droppedCount: 1, reason: expect.stringContaining('ULID') as string });
    expect(alarms[1]?.details).toEqual({ droppedCount: 2, reason: expect.stringContaining('action') as string });
    await expect(readFile(join(auditDirectory(userData), 'audit-2026-09-19.jsonl'), 'utf8')).rejects.toThrow();
    await writer.close();
  });

  it('越形状夹带键不入帧：运行期对象多余字段（凭证/内容形态）被拾取闸挡下', async () => {
    const userData = await makeTempUserData();
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    const sneaky = {
      ...makeAuditEntry(),
      credentialValue: 'hunter2',
      fileContent: 'TOP-SECRET',
      requestBody: '{"a":1}',
    };
    writer.enqueue(sneaky);
    await writer.flush();
    const filePath = join(auditDirectory(userData), 'audit-2026-09-19.jsonl');
    const lines = (await readAuditFileLines(filePath)) as Array<Record<string, unknown>>;
    expect(Object.keys(lines[0] as Record<string, unknown>).sort()).toEqual(
      ['action', 'actor', 'id', 'permission', 'pluginId', 'pluginVersion', 'timestamp', 'traceId'].sort(),
    );
    const raw = await readFile(filePath, 'utf8');
    expect(raw).not.toContain('hunter2');
    expect(raw).not.toContain('TOP-SECRET');
    await writer.close();
  });
});

describe('有界队列与背压（RFC §六条 2：满则丢 + 计数 + dropped 告警载荷，判定面永不阻塞）', () => {
  it('同宏任务洪峰超出容量：溢出条目丢弃计数、告警载荷可观测、在队条目照常落盘', async () => {
    const userData = await makeTempUserData();
    const { sink, records } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({
      userDataPath: userData,
      diagnostics: sink,
      now: () => NOW_MS,
      queueCapacity: 2,
    });
    writer.enqueue(makeAuditEntry({ action: 'allow', permission: 'config:read' }));
    writer.enqueue(makeAuditEntry({ action: 'allow', permission: 'system:read' }));
    writer.enqueue(makeAuditEntry({ action: 'allow', permission: 'power:read' })); // 第三条溢出
    const overflowAlarm = records.find((record) => record.message.includes('队列满载'));
    expect(overflowAlarm).toBeDefined();
    expect(overflowAlarm?.details).toEqual({ droppedCount: 1, reason: 'queue-full:2' });
    await writer.flush();
    expect(await readAuditFileLines(join(auditDirectory(userData), 'audit-2026-09-19.jsonl'))).toHaveLength(2);
    expect(writer.report().dropped).toBe(1);
    await writer.close();
  });

  it('enqueue 同步永不抛错：写盘故障臂只落诊断、flush/close 收敛、调用侧零感知', async () => {
    const userData = await makeTempUserData();
    // `logs` 位放一个普通文件冒充目录 → mkdir/append 全链故障
    await writeFile(join(userData, 'logs'), 'blocker', 'utf8');
    const { sink, records } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    expect(() => writer.enqueue(makeAuditEntry())).not.toThrow();
    await writer.flush();
    await writer.close(); // 故障态 close 仍收敛（不抛出）
    const report = writer.report();
    expect(report.written).toBe(0);
    expect(report.dropped).toBe(1);
    const failure = records.find((record) => record.message === '审计落盘写入失败');
    expect(failure).toBeDefined();
    expect(failure?.details).toEqual({ droppedCount: 1, reason: expect.any(String) as string });
  });
});

describe('常开与关闭语义', () => {
  it('不受 CHIPS_TRACE 门控（工单041：诊断≠审计、审计常开）', async () => {
    const userData = await makeTempUserData();
    const previous = process.env['CHIPS_TRACE'];
    process.env['CHIPS_TRACE'] = ''; // 追踪全关臂
    try {
      const { sink } = createCollectingDiagnostics();
      const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
      writer.enqueue(makeAuditEntry());
      await writer.flush();
      expect(writer.report().written).toBe(1);
      await writer.close();
    } finally {
      if (previous === undefined) {
        delete process.env['CHIPS_TRACE'];
      } else {
        process.env['CHIPS_TRACE'] = previous;
      }
    }
  });

  it('close 幂等 + flush 收尾：关闭后 enqueue 拒收计数告警、既有落盘零扰动', async () => {
    const userData = await makeTempUserData();
    const { sink, records } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    writer.enqueue(makeAuditEntry());
    await writer.close();
    await writer.close(); // 幂等
    expect(writer.report().closed).toBe(true);
    writer.enqueue(makeAuditEntry());
    const report = writer.report();
    expect(report.written).toBe(1);
    expect(report.dropped).toBe(1);
    expect(records.at(-1)?.message).toBe('审计写入器已关闭，条目拒收');
    expect(await readAuditFileLines(join(auditDirectory(userData), 'audit-2026-09-19.jsonl'))).toHaveLength(1);
  });

  it('report() 呈现目录/计数/队列/关闭四面', async () => {
    const userData = await makeTempUserData();
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    expect(writer.report()).toEqual({
      directory: auditDirectory(userData),
      written: 0,
      dropped: 0,
      queued: 0,
      closed: false,
    });
    await writer.close();
    expect(writer.report().closed).toBe(true);
  });
});

describe('留存清理触发时机（立项书段二逐字：启动期 + 跨日界）', () => {
  it('启动期清理：构造即挂一轮，已到期纯常规文件被清、含高档条目文件保留、未到期不动', async () => {
    const userData = await makeTempUserData();
    await mkdir(auditDirectory(userData), { recursive: true });
    const expiredRegular = shiftUtcDay('2026-09-20', -(AUDIT_RETENTION_REGULAR_DAYS + 1));
    const expiredHighRisk = shiftUtcDay('2026-09-20', -(AUDIT_RETENTION_REGULAR_DAYS + 30));
    const freshDay = shiftUtcDay('2026-09-20', -(AUDIT_RETENTION_REGULAR_DAYS - 30));
    await writeFile(
      join(auditDirectory(userData), `audit-${expiredRegular}.jsonl`),
      '{"permission":"config:read"}\n{"permission":"network:http"}\n',
      'utf8',
    );
    await writeFile(
      join(auditDirectory(userData), `audit-${expiredHighRisk}.jsonl`),
      '{"permission":"clipboard:access"}\n',
      'utf8',
    );
    await writeFile(
      join(auditDirectory(userData), `audit-${freshDay}.jsonl`),
      '{"permission":"config:read"}\n',
      'utf8',
    );
    const { sink, records } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    await writer.flush(); // 构造期清理步在链首，flush 等其完成
    await expect(readFile(join(auditDirectory(userData), `audit-${expiredRegular}.jsonl`), 'utf8')).rejects.toThrow();
    expect(await readFile(join(auditDirectory(userData), `audit-${expiredHighRisk}.jsonl`), 'utf8')).toContain(
      'clipboard:access',
    );
    expect(await readFile(join(auditDirectory(userData), `audit-${freshDay}.jsonl`), 'utf8')).toContain('config:read');
    const sweepLog = records.find((record) => record.message === '审计留存清理完成');
    expect(sweepLog?.details).toEqual({ skipped: false, scanned: 3, deleted: 1, retainedHighRisk: 1 });
    await writer.close();
  });

  it('跨日界清理：日界切换的落帧后触发一轮到期清除；未跨日不回头', async () => {
    const userData = await makeTempUserData();
    const { sink } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    writer.enqueue(makeAuditEntry({ timestamp: '2026-09-19T23:00:00.000Z' }));
    await writer.flush();
    // 构造期清理之后新落一个已过档文件：未跨日界，写入器不回头清理
    const expiredDay = shiftUtcDay('2026-09-20', -(AUDIT_RETENTION_REGULAR_DAYS + 20));
    await mkdir(auditDirectory(userData), { recursive: true });
    await writeFile(
      join(auditDirectory(userData), `audit-${expiredDay}.jsonl`),
      '{"permission":"tray:manage"}\n',
      'utf8',
    );
    await writer.flush();
    expect(await readFile(join(auditDirectory(userData), `audit-${expiredDay}.jsonl`), 'utf8')).toContain(
      'tray:manage',
    );
    writer.enqueue(makeAuditEntry({ timestamp: '2026-09-20T00:00:00.000Z' })); // 跨日界
    await writer.flush();
    await expect(readFile(join(auditDirectory(userData), `audit-${expiredDay}.jsonl`), 'utf8')).rejects.toThrow();
    await writer.close();
  });

  it('高风险档 365 天到期臂：窗口内保留、超 365 天档整文件清除（含不可解析内容臂）', async () => {
    const userData = await makeTempUserData();
    await mkdir(auditDirectory(userData), { recursive: true });
    const inWindow = shiftUtcDay('2026-09-20', -(AUDIT_RETENTION_HIGH_RISK_DAYS - 10));
    const overTier = shiftUtcDay('2026-09-20', -(AUDIT_RETENTION_HIGH_RISK_DAYS + 1));
    await writeFile(
      join(auditDirectory(userData), `audit-${inWindow}.jsonl`),
      '{"permission":"filesystem:write"}\n',
      'utf8',
    );
    await writeFile(join(auditDirectory(userData), `audit-${overTier}.jsonl`), 'corrupted-not-json\n', 'utf8');
    const { sink, records } = createCollectingDiagnostics();
    const writer = createPermissionAuditWriter({ userDataPath: userData, diagnostics: sink, now: () => NOW_MS });
    await writer.flush();
    expect(await readFile(join(auditDirectory(userData), `audit-${inWindow}.jsonl`), 'utf8')).toContain(
      'filesystem:write',
    ); // 高档未满 365：保
    await expect(readFile(join(auditDirectory(userData), `audit-${overTier}.jsonl`), 'utf8')).rejects.toThrow(); // 超档即清，内容不可解析亦不再扫
    expect(records.find((record) => record.message === '审计留存清理完成')?.details).toEqual({
      skipped: false,
      scanned: 2,
      deleted: 1,
      retainedHighRisk: 1,
    });
    await writer.close();
  });
});
