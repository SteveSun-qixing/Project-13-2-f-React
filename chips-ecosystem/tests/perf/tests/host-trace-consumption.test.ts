import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PerfError } from '../src/errors';
import {
  VIEW_BUILT_PHASE,
  VIEW_BUILD_FAILED_PHASE,
  hostTraceDir,
  hostTraceFileName,
  openCardStagesFromTrace,
  parseHostTraceLines,
  readHostTraceRecords,
  selectCurrentHostRunRecords,
  waitForOpenCardStages,
  type HostTraceRecord,
} from '../src/real/host-trace';

/**
 * 宿主 CHIPS_TRACE 导出面消费侧（工单041① / 任务 #135）纯逻辑面：
 * JSONL 解析闸、时间窗读取、open-card 三段关联链还原与 fail-closed 唯一性。
 * 记录形状与宿主 `packages/host/src/shared/host-trace.ts` 落盘字段逐一对齐。
 */

function record(overrides: Partial<HostTraceRecord> & { phase: string }): HostTraceRecord {
  return {
    timestamp: '2026-09-27T08:00:00.000Z',
    category: 'render',
    traceId: null,
    sessionId: null,
    outcome: 'ok',
    errorCode: null,
    durationMs: null,
    details: null,
    ...overrides,
  };
}

function anchorRecord(iso: string): HostTraceRecord {
  return record({
    phase: 'startup:process-start',
    category: 'startup',
    timestamp: iso,
    outcome: null,
    durationMs: null,
  });
}

function happyChain(sourceUri: string, probeId: string): HostTraceRecord[] {
  return [
    record({
      phase: 'render:request-accepted',
      traceId: 't-op-1',
      durationMs: 4.2,
      details: { capabilityId: 'document.open', source: sourceUri },
    }),
    record({
      phase: 'document:parsed',
      traceId: 't-op-1',
      durationMs: 18.75,
      details: { capabilityId: 'document.open', documentId: 'doc-abc', reusedRecord: false },
    }),
    record({
      phase: VIEW_BUILT_PHASE,
      durationMs: 11.5,
      details: { requestId: probeId, source: sourceUri, documentId: 'doc-abc', kind: 'card' },
    }),
  ];
}

describe('CHIPS_TRACE JSONL 解析闸（parseHostTraceLines）', () => {
  it('正常行解析、空行跳过、缺位字段归一为 null', () => {
    const lines = [
      JSON.stringify(happyChain('chips-managed:/a.zip', 'p-1')[0]),
      '',
      '   ',
      JSON.stringify({
        timestamp: '2026-09-27T08:00:01.000Z',
        category: 'bridge',
        phase: 'execute',
      }),
      '\n',
    ].join('\n');
    const records = parseHostTraceLines(lines);
    expect(records).toHaveLength(2);
    expect(records[1]?.traceId).toBeNull();
    expect(records[1]?.durationMs).toBeNull();
    expect(records[1]?.details).toBeNull();
    expect(records[0]?.phase).toBe('render:request-accepted');
  });

  it('坏 JSON、非对象行与缺必备字段 fail-closed', () => {
    expect(() => parseHostTraceLines('{broken')).toThrowError(PerfError);
    expect(() => parseHostTraceLines('[1,2]\n')).toThrowError(/不是对象/);
    expect(() => parseHostTraceLines('{"category":"render","phase":"x"}\n')).toThrowError(
      /必备字段/
    );
    expect(() =>
      parseHostTraceLines('{"timestamp":1,"category":"render","phase":"x"}\n')
    ).toThrowError(/必备字段/);
  });
});

describe('追踪目录与文件名（与宿主同规则）', () => {
  it('trace-YYYY-MM-DD.jsonl / logs/trace 落位', () => {
    expect(hostTraceFileName('2026-09-27T08:00:00.000Z')).toBe('trace-2026-09-27.jsonl');
    expect(hostTraceDir('/tmp/x')).toBe(join('/tmp/x', 'logs', 'trace'));
  });
});

describe('时间窗读取（readHostTraceRecords）', () => {
  it('跨日文件聚合、窗口起点前移放宽窗、缺失文件容忍', async () => {
    const base = await mkdtemp(join(tmpdir(), 'perf-host-trace-'));
    try {
      const traceDir = hostTraceDir(base);
      await mkdir(traceDir, { recursive: true });
      const previousDay = [
        record({ phase: 'render:request-accepted', traceId: 'old', durationMs: 1 }),
      ];
      const today = happyChain('chips-managed:/a.zip', 'p-1');
      await writeFile(
        join(traceDir, 'trace-2026-09-26.jsonl'),
        previousDay.map((entry) => `${JSON.stringify(entry)}\n`).join(''),
        'utf8'
      );
      await writeFile(
        join(traceDir, 'trace-2026-09-27.jsonl'),
        today
          .map((entry) => JSON.stringify({ ...entry, timestamp: '2026-09-27T08:00:05.000Z' }))
          .join('\n') + '\n',
        'utf8'
      );
      // 起点 08:00:04 → 放宽 2 s 后窗口 [08:00:02, ∞)：当日 3 条命中、前日 1 条剔除。
      const records = await readHostTraceRecords(base, '2026-09-27T08:00:04.000Z');
      expect(records).toHaveLength(3);
      // 起点 08:00:08 → 全部剔除。
      const none = await readHostTraceRecords(base, '2026-09-27T08:00:08.000Z');
      expect(none).toHaveLength(0);
      // 空 userData 目录：无文件可读，容忍为空。
      const empty = await mkdtemp(join(tmpdir(), 'perf-host-trace-empty-'));
      try {
        expect(await readHostTraceRecords(empty, '2026-09-27T08:00:00.000Z')).toHaveLength(0);
      } finally {
        await rm(empty, { recursive: true, force: true });
      }
      await expect(readHostTraceRecords(base, '非时间')).rejects.toThrowError(PerfError);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});

describe('open-card 三段关联链还原（openCardStagesFromTrace）', () => {
  it('装载/解析/视图构建齐备：按探针 ID → documentId → traceId 链还原并交叉核验 source', () => {
    const stages = openCardStagesFromTrace(happyChain('chips-managed:/a.zip', 'p-1'), 'p-1');
    expect(stages).toEqual({
      loadMs: 4.2,
      parseMs: 18.75,
      viewBuildMs: 11.5,
      traceId: 't-op-1',
      documentId: 'doc-abc',
    });
  });

  it('探针记录缺位 / 歧义 / durationMs 无效均 fail-closed', () => {
    expect(() => openCardStagesFromTrace([], 'p-1')).toThrowError(/缺少 视图构建段/);
    const chain = happyChain('u', 'p-1');
    expect(() => openCardStagesFromTrace([...chain, ...chain], 'p-1')).toThrowError(/不唯一/);
    const noDuration = happyChain('u', 'p-1').map((entry) =>
      entry.phase === VIEW_BUILT_PHASE
        ? record({ phase: VIEW_BUILT_PHASE, details: entry.details })
        : entry
    );
    expect(() => openCardStagesFromTrace(noDuration, 'p-1')).toThrowError(/durationMs/);
  });

  it('解析段缺失（traceId 不闭合）与 source 交叉核验失败拒绝', () => {
    const missingParsed = happyChain('u', 'p-1').filter(
      (entry) => entry.phase !== 'document:parsed'
    );
    expect(() => openCardStagesFromTrace(missingParsed, 'p-1')).toThrowError(/缺少 解析段/);
    const crossed = happyChain('u', 'p-1').map((entry) =>
      entry.phase === 'render:request-accepted'
        ? { ...entry, details: { ...entry.details, source: 'chips-managed:/other.zip' } }
        : entry
    );
    expect(() => openCardStagesFromTrace(crossed, 'p-1')).toThrowError(/source 交叉核验失败/);
  });

  it('构建失败记录（建议名 render:view-build-failed）不参与成功链', () => {
    const records = [
      ...happyChain('u', 'p-1'),
      record({
        phase: VIEW_BUILD_FAILED_PHASE,
        outcome: 'error',
        errorCode: 'BRIDGE_INVALID_INPUT',
        durationMs: 3,
        details: { requestId: 'p-2' },
      }),
    ];
    expect(openCardStagesFromTrace(records, 'p-1').viewBuildMs).toBe(11.5);
  });
});

describe('宿主运行段截取（selectCurrentHostRunRecords）', () => {
  it('最后一条 startup:process-start 之后的记录构成当前运行段（历史轮同 documentId 不碰撞）', () => {
    const previousRun = [anchorRecord('2026-09-27T07:00:00.000Z'), ...happyChain('u', 'p-old')];
    const currentRun = [anchorRecord('2026-09-27T08:00:00.000Z'), ...happyChain('u', 'p-new')];
    const segment = selectCurrentHostRunRecords([...previousRun, ...currentRun]);
    expect(segment).toHaveLength(3);
    // 段内直接走关联链：历史轮 document:parsed 同 documentId 不参与唯一性判定。
    const stages = openCardStagesFromTrace(segment, 'p-new');
    expect(stages.traceId).toBe('t-op-1');
    expect(() => openCardStagesFromTrace(segment, 'p-old')).toThrowError(/缺少 视图构建段/);
  });

  it('无锚 fail-closed（startup 里程碑导出缺位不静默降级）', () => {
    expect(() => selectCurrentHostRunRecords(happyChain('u', 'p-1'))).toThrowError(/运行段锚/);
    expect(() => selectCurrentHostRunRecords([])).toThrowError(PerfError);
  });
});

describe('轮等读取（waitForOpenCardStages）', () => {
  it('落行滞后：视图构建记录迟到仍在时限内还原', async () => {
    const base = await mkdtemp(join(tmpdir(), 'perf-host-trace-wait-'));
    try {
      const traceDir = hostTraceDir(base);
      await mkdir(traceDir, { recursive: true });
      const fileName = hostTraceFileName('2026-09-27T08:00:05.000Z');
      const records = [
        anchorRecord('2026-09-27T08:00:04.800Z'),
        ...happyChain('chips-managed:/a.zip', 'p-late').map((entry) => ({
          ...entry,
          timestamp: '2026-09-27T08:00:05.500Z',
        })),
      ];
      const late = setTimeout(() => {
        void writeFile(
          join(traceDir, fileName),
          records.map((e) => `${JSON.stringify(e)}\n`).join(''),
          'utf8'
        );
      }, 150);
      const stages = await waitForOpenCardStages(base, '2026-09-27T08:00:05.000Z', 'p-late', {
        timeoutMs: 3_000,
        intervalMs: 25,
      });
      clearTimeout(late);
      expect(stages.parseMs).toBe(18.75);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('跨轮共享文件同 documentId（在册红态复现）：分段后轮等还原当前轮三段不碰撞', async () => {
    // 复现 /tmp/w135_real_opencard.log 登记失败：共享 userData 追踪文件里
    // 历史轮与当前轮 document:parsed 同 documentId（确定性文档 ID 跨轮相同），
    // 窗口同时覆盖两轮时旧实现按窗口全量求唯一 → 「解析段不唯一（2 条）」红。
    // 修复口径：以最后一条 startup:process-start 截取当前运行段后再走关联链。
    const base = await mkdtemp(join(tmpdir(), 'perf-host-trace-cross-'));
    try {
      const traceDir = hostTraceDir(base);
      await mkdir(traceDir, { recursive: true });
      const sharedSource = 'chips-managed:/same-card.zip';
      const previousRun = [
        anchorRecord('2026-09-27T07:59:30.000Z'),
        ...happyChain(sharedSource, 'p-old').map((entry) => ({
          ...entry,
          timestamp: '2026-09-27T07:59:40.000Z',
        })),
      ];
      const currentRun = [
        anchorRecord('2026-09-27T08:00:00.000Z'),
        ...happyChain(sharedSource, 'p-new').map((entry) => ({
          ...entry,
          timestamp: '2026-09-27T08:00:05.000Z',
        })),
      ];
      await writeFile(
        join(traceDir, hostTraceFileName('2026-09-27T08:00:05.000Z')),
        [...previousRun, ...currentRun].map((entry) => `${JSON.stringify(entry)}\n`).join(''),
        'utf8'
      );
      // 窗口起点覆盖两轮全部记录：不截段则解析段必为 2 条。
      const stages = await waitForOpenCardStages(base, '2026-09-27T07:59:00.000Z', 'p-new', {
        timeoutMs: 500,
        intervalMs: 25,
      });
      expect(stages).toEqual({
        loadMs: 4.2,
        parseMs: 18.75,
        viewBuildMs: 11.5,
        traceId: 't-op-1',
        documentId: 'doc-abc',
      });
      // 历史轮探针在当前段内不可见：仍如实抛缺位，不串轮取数。
      await expect(
        waitForOpenCardStages(base, '2026-09-27T07:59:00.000Z', 'p-old', {
          timeoutMs: 120,
          intervalMs: 25,
        })
      ).rejects.toThrowError(/缺少 视图构建段/);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('构建被拒：发现当轮失败记录立即抛错附在册码', async () => {
    const base = await mkdtemp(join(tmpdir(), 'perf-host-trace-fail-'));
    try {
      const traceDir = hostTraceDir(base);
      await mkdir(traceDir, { recursive: true });
      const failed = record({
        phase: VIEW_BUILD_FAILED_PHASE,
        outcome: 'error',
        errorCode: 'BRIDGE_INTERNAL',
        durationMs: 2,
        details: { requestId: 'p-reject' },
        timestamp: '2026-09-27T08:00:05.100Z',
      });
      await writeFile(
        join(traceDir, hostTraceFileName(failed.timestamp)),
        [anchorRecord('2026-09-27T08:00:05.000Z'), failed]
          .map((entry) => `${JSON.stringify(entry)}\n`)
          .join(''),
        'utf8'
      );
      await expect(
        waitForOpenCardStages(base, '2026-09-27T08:00:05.000Z', 'p-reject', {
          timeoutMs: 500,
          intervalMs: 25,
        })
      ).rejects.toThrowError(/BRIDGE_INTERNAL/);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('时限内始终无记录：如实抛缺少视图构建段（不静默降级）', async () => {
    const base = await mkdtemp(join(tmpdir(), 'perf-host-trace-none-'));
    try {
      await expect(
        waitForOpenCardStages(base, new Date().toISOString(), 'p-none', {
          timeoutMs: 120,
          intervalMs: 25,
        })
      ).rejects.toThrowError(/缺少 视图构建段/);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
