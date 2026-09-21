import { describe, expect, it } from 'vitest';

import { assertValidAdapter, validateMetricSamples } from '../src/adapters';
import { PerfError } from '../src/errors';
import { MARKERS, scenarioDefinition } from '../src/scenarios';
import { adapter, collectFrameTimestamps, createRealHostAdapter } from '../src/real/adapter';
import {
  coldStartMarkers,
  observationTimeline,
  openCardMarkers,
  unmeasurableArmNotes,
  unmeasurableArmsOf,
} from '../src/real/observations';
import {
  buildRealSamplesDocument,
  buildRealUnmeasurableDocument,
  extractSamplesFromReport,
  realSamplesFileName,
  realUnmeasurableFileName,
} from '../src/real/samples';
import { parseCollectArgs } from '../src/real/collect';
import type { PageSurface } from '../src/real/e2e-runtime';
import { makeReport } from './helpers';

/**
 * 真进程采集适配器纯逻辑面（可控输入，不拉真进程）：
 * 适配器契约校验、外部观测 → 标记点时间线归一、缺测臂登记、
 * 样本文件组装（ingest 契约）与报告样本提取、采集参数解析。
 */

describe('真进程适配器契约（adapters）', () => {
  it('默认适配器与新建适配器均通过 assertValidAdapter', () => {
    expect(() => assertValidAdapter(adapter)).not.toThrow();
    expect(() => assertValidAdapter(createRealHostAdapter())).not.toThrow();
    expect(adapter.id).toBe('chips-host-real-process');
    expect(adapter.provides).toEqual(['cold-start', 'open-card', 'scroll-fps', 'idle-memory']);
  });

  it('构造零副作用：未显式 run 不触达任何进程', async () => {
    const failingAdapter = createRealHostAdapter({
      runtime: () => Promise.reject(new Error('不应装载 e2e 运行时')),
    });
    await expect(failingAdapter.run({ scenarioId: 'idle-memory', iteration: 0 })).rejects.toThrow(
      '不应装载 e2e 运行时'
    );
  });

  it('未提供场景 run 拒绝（open-box 不在 provides）', async () => {
    const failingAdapter = createRealHostAdapter({
      runtime: () => Promise.reject(new Error('不应触达真进程')),
    });
    await expect(failingAdapter.run({ scenarioId: 'open-box', iteration: 0 })).rejects.toThrow(
      /未提供场景/
    );
  });
});

describe('外部观测 → 标记点时间线归一（observations）', () => {
  it('冷启动观测归一为 startup:* 规范标记点并以时间线求跨度', () => {
    const markers = coldStartMarkers({ launchedAtMs: 1_000, readyAtMs: 1_840 });
    expect(markers.map((marker) => marker.name)).toEqual([
      MARKERS.processStart,
      MARKERS.windowReady,
    ]);
    const timeline = observationTimeline(markers);
    const coldStart = scenarioDefinition('cold-start');
    expect(coldStart.totalSpan).toBeDefined();
    expect(timeline.duration(coldStart.totalSpan ?? { from: '', to: '' })).toBe(840);
    expect(markers.every((marker) => marker.category?.startsWith('external-proxy:'))).toBe(true);
  });

  it('打开卡片观测归一为 open-called → first-frame-commit（代理口径）并求 totalSpan', () => {
    const markers = openCardMarkers({ openCalledAtMs: 50, openResolvedAtMs: 123.5 });
    expect(markers.map((marker) => marker.name)).toEqual([
      MARKERS.openCalled,
      MARKERS.firstFrameCommit,
    ]);
    const timeline = observationTimeline(markers);
    const openCard = scenarioDefinition('open-card');
    expect(timeline.duration(openCard.totalSpan ?? { from: '', to: '' })).toBeCloseTo(73.5, 5);
  });

  it('时序非法（终点早于起点 / 非有限值）拒绝', () => {
    expect(() => coldStartMarkers({ launchedAtMs: 10, readyAtMs: 5 })).toThrowError(PerfError);
    expect(() => openCardMarkers({ openCalledAtMs: Number.NaN, openResolvedAtMs: 5 })).toThrowError(
      PerfError
    );
  });

  it('缺测臂登记：open-card 含三条阶段缺测、scroll-fps 含 render_update_ms、open-box 整场景', () => {
    expect(unmeasurableArmsOf('open-card').filter((arm) => arm.kind === 'phase')).toHaveLength(3);
    expect(unmeasurableArmsOf('scroll-fps').map((arm) => arm.target)).toContain('render_update_ms');
    expect(unmeasurableArmsOf('open-box').some((arm) => arm.kind === 'scenario')).toBe(true);
    const notes = unmeasurableArmNotes('open-card');
    expect(notes.length).toBeGreaterThanOrEqual(4);
    expect(notes.every((note) => note.startsWith('缺测臂（'))).toBe(true);
    expect(() => unmeasurableArmNotes('未知场景')).toThrowError(PerfError);
  });
});

describe('rAF 帧采集回包闸（可控页面替身）', () => {
  it('页面函数产出严格递增帧时间戳序列', async () => {
    const pending: ((time: number) => void)[] = [];
    const globals = globalThis as unknown as Record<string, unknown>;
    const previous = globals['requestAnimationFrame'];
    globals['requestAnimationFrame'] = (callback: (time: number) => void): number => {
      pending.push(callback);
      return pending.length;
    };
    try {
      let settled = false;
      const fakeWindow: PageSurface = {
        async evaluate<T>(pageFunction: unknown): Promise<T> {
          if (typeof pageFunction !== 'string') {
            throw new Error('页面函数必须是纯 JS 字符串源（__name 注入消除纪律）。');
          }
          // 钉住 IIFE 调用表达式契约：Playwright 对字符串表达式求值**不会**自动调用
          // （实测「字符串 + 参数」回包为 undefined），时长实参必须内联在调用括号里。
          const durationMatch = /\)\((\d+)\)$/.exec(pageFunction);
          if (durationMatch === null) {
            throw new Error('rAF 采集必须以 IIFE 调用表达式内联时长实参。');
          }
          const duration = Number(durationMatch[1]);
          // 以字符串源求值：同时钉住「页面侧源码零转译依赖」的可序列化契约。
          // 本替身的职责就是模拟 Playwright 对字符串源的编译求值（设计 §二 实测钉桩），
          // `new Function` 是该契约的唯一忠实实现，且仅存在于测试面，不进任何产物。
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          const build = new Function(`return (${pageFunction})`) as () => Promise<number[]>;
          const promise = build().then((value) => {
            settled = true;
            return value;
          });
          // 虚拟时钟逐帧推进（每帧 20 ms），直到页面侧采集 resolve。
          let virtualTime = 0;
          while (!settled) {
            const callbacks = pending.splice(0, pending.length);
            virtualTime += 20;
            for (const callback of callbacks) {
              callback(virtualTime);
            }
            await Promise.resolve();
            if (pending.length === 0 && !settled && virtualTime > duration * 10) {
              throw new Error('虚拟帧泵未在合理步数内完成（替身实现错误）。');
            }
          }
          return (await promise) as T;
        },
        mouse: {
          async wheel(): Promise<void> {
            /* 本用例不驱动滚动 */
          },
        },
      };
      const timestamps = await collectFrameTimestamps(fakeWindow, 100);
      expect(timestamps.length).toBeGreaterThanOrEqual(5);
      for (let index = 1; index < timestamps.length; index += 1) {
        expect((timestamps[index] ?? 0) > (timestamps[index - 1] ?? 0)).toBe(true);
      }
    } finally {
      if (previous === undefined) {
        delete globals['requestAnimationFrame'];
      } else {
        globals['requestAnimationFrame'] = previous;
      }
    }
  });
});

describe('真进程样本文件组装（ingest 契约）', () => {
  const meta = {
    buildType: 'debug' as const,
    deviceLabel: 'test-device',
    hostVersion: '0.0.0-test',
    notes: ['测试注记'],
  };

  it('组装产物满足 ingest 双闸：指标已登记 + 场景已声明', () => {
    const document = buildRealSamplesDocument(
      { scenarioId: 'cold-start', status: 'measured', samples: { cold_start_ms: [900, 950, 980] } },
      meta
    );
    expect(() => validateMetricSamples(document.samples)).not.toThrow();
    expect(document.meta.buildType).toBe('debug');
    expect(document.meta.notes).toContain('测试注记');
    expect(
      (document.meta.notes ?? []).some(
        (note) => note.includes('external') || note.includes('代理') || note.includes('缺测臂')
      )
    ).toBe(true);
  });

  it('未声明指标、空数组与 undefined 值处理', () => {
    expect(() =>
      buildRealSamplesDocument(
        { scenarioId: 'cold-start', status: 'measured', samples: { open_card_ms: [1] } },
        meta
      )
    ).toThrowError(/未声明指标/);
    expect(() =>
      buildRealSamplesDocument(
        { scenarioId: 'cold-start', status: 'measured', samples: { cold_start_ms: [] } },
        meta
      )
    ).toThrowError(PerfError);
    const document = buildRealSamplesDocument(
      {
        scenarioId: 'scroll-fps',
        status: 'measured',
        samples: { sustained_fps: [60, 61], render_update_ms: undefined },
      },
      meta
    );
    expect(Object.keys(document.samples)).toEqual(['sustained_fps']);
  });

  it('文件名约定：real-samples-<scenario> / real-unmeasurable-<scenario>', () => {
    expect(realSamplesFileName('open-card')).toBe('real-samples-open-card.json');
    expect(realUnmeasurableFileName('open-box')).toBe('real-unmeasurable-open-box.json');
  });

  it('从报告提取实测样本：跳过 no-data 指标，缺测不产空数组', () => {
    const report = makeReport({
      scenarioId: 'scroll-fps',
      samples: { sustained_fps: [59.8, 60.2, 61], render_update_ms: [] },
    });
    const samples = extractSamplesFromReport(report, 'scroll-fps');
    expect(Object.keys(samples)).toEqual(['sustained_fps']);
    expect(samples['sustained_fps']).toHaveLength(3);
    expect(() => extractSamplesFromReport(report, 'cold-start')).toThrowError(/不一致/);
    const emptyReport = makeReport({ scenarioId: 'cold-start', samples: { cold_start_ms: [] } });
    expect(() => extractSamplesFromReport(emptyReport, 'cold-start')).toThrowError(
      /无任何实测样本/
    );
  });

  it('不可测结论文件：零数值、原因去重合并、场景名如实', () => {
    const document = buildRealUnmeasurableDocument(
      'open-box',
      ['真进程探针：取视图通道回包判别 document-view:error（在册码 BRIDGE_INVALID_INPUT）。'],
      '2026-09-27T00:00:00.000Z'
    );
    expect(document.kind).toBe('chips-perf-real-unmeasurable');
    expect(document.status).toBe('unmeasurable');
    expect(document.scenarioTitle).toBe('打开箱子');
    expect(document.reasons.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(document)).not.toMatch(/"samples"/);
  });
});

describe('采集器参数解析（parseCollectArgs）', () => {
  it('默认 all 覆盖五指标场景并读取包内策略配置', () => {
    const args = parseCollectArgs([]);
    expect(args.scenarioIds).toEqual([
      'cold-start',
      'open-card',
      'open-box',
      'scroll-fps',
      'idle-memory',
    ]);
    expect(args.config.measurement.rounds).toBeGreaterThanOrEqual(1);
    expect(args.config.measurement.idleWindowMs).toBeGreaterThan(0);
  });

  it('场景白名单与选项校验', () => {
    const args = parseCollectArgs(['--scenario', 'cold-start,idle-memory']);
    expect(args.scenarioIds).toEqual(['cold-start', 'idle-memory']);
    expect(() => parseCollectArgs(['--scenario', 'parse-metadata'])).toThrowError(
      /不在五指标采集面内/
    );
    expect(() => parseCollectArgs(['--scenario', '不存在'])).toThrowError(/未登记场景/);
    expect(() => parseCollectArgs(['--nope'])).toThrowError(/未知选项/);
    expect(() => parseCollectArgs(['--out'])).toThrowError(/缺少取值/);
    expect(() => parseCollectArgs(['多余'])).toThrowError(/位置参数/);
  });
});
