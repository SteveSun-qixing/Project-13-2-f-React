/**
 * 输出端口与任务进度（[CLI 完整参考] §2.4、§3.10.4）：stdout 只承载最终结果、
 * stderr 承载进度；TTY 原地刷新、非交互按行、缺省静默。
 */

import { describe, expect, it } from 'vitest';

import { createNodeOutputSink, type IOutputSink } from '../src/output/io.js';
import { createProgressWriter, formatProgress, type IProgressReport } from '../src/output/progress.js';

interface IFakeStream {
  readonly chunks: string[];
  readonly isTTY: boolean | undefined;
  write(text: string): boolean;
}

function fakeStream(isTTY: boolean | undefined): IFakeStream {
  return {
    chunks: [],
    isTTY,
    write(text: string): boolean {
      this.chunks.push(text);
      return true;
    },
  };
}

/** 在假 stdout/stderr 下执行断言体，结束后还原进程流。 */
function withProcessStreams(
  stdout: IFakeStream,
  stderr: IFakeStream,
  action: () => void,
): void {
  const originalOut = process.stdout;
  const originalErr = process.stderr;
  Object.defineProperty(process, 'stdout', { value: stdout, configurable: true });
  Object.defineProperty(process, 'stderr', { value: stderr, configurable: true });
  try {
    action();
  } finally {
    Object.defineProperty(process, 'stdout', { value: originalOut, configurable: true });
    Object.defineProperty(process, 'stderr', { value: originalErr, configurable: true });
  }
}

/** 收集写出文本的输出出口替身。 */
function captureSink(isTTY: boolean): { sink: IOutputSink; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    sink: {
      get isTTY(): boolean {
        return isTTY;
      },
      writeOut(text: string): void {
        out.push(text);
      },
      writeErr(text: string): void {
        err.push(text);
      },
    },
  };
}

describe('createNodeOutputSink（§2.4 输出纪律）', () => {
  it('双标准流都是 TTY 时才判定为 TTY', () => {
    const cases: readonly [boolean | undefined, boolean | undefined, boolean][] = [
      [true, true, true],
      [true, false, false],
      [false, true, false],
      [undefined, undefined, false],
    ];
    for (const [outTTY, errTTY, expected] of cases) {
      const out = fakeStream(outTTY);
      const err = fakeStream(errTTY);
      withProcessStreams(out, err, () => {
        const sink = createNodeOutputSink();
        expect(sink.isTTY).toBe(expected);
        // 二次读取仍按绑定时的流实例判定，不缓存首次结果。
        expect(sink.isTTY).toBe(expected);
      });
    }
  });

  it('writeOut 只写 stdout，writeErr 只写 stderr', () => {
    const out = fakeStream(true);
    const err = fakeStream(true);
    withProcessStreams(out, err, () => {
      const sink = createNodeOutputSink();
      sink.writeOut('结果\n');
      sink.writeErr('进度\n');
    });
    expect(out.chunks).toEqual(['结果\n']);
    expect(err.chunks).toEqual(['进度\n']);
  });
});

describe('formatProgress（§3.10.4 展示文本）', () => {
  it('仅百分比、仅阶段与两者同时', () => {
    expect(formatProgress({ percent: 42 })).toBe('进度 42%');
    expect(formatProgress({ stage: '解包归档' })).toBe('进度 解包归档');
    expect(formatProgress({ percent: 42, stage: '解包归档' })).toBe('进度 42% 解包归档');
  });

  it('百分比四舍五入并夹在 0 至 100', () => {
    expect(formatProgress({ percent: 12.6 })).toBe('进度 13%');
    expect(formatProgress({ percent: -20 })).toBe('进度 0%');
    expect(formatProgress({ percent: 120.4 })).toBe('进度 100%');
  });

  it('无可用字段、空阶段名与非法类型一律不展示', () => {
    expect(formatProgress({})).toBeNull();
    expect(formatProgress({ stage: '' })).toBeNull();
    expect(formatProgress({ stage: 7 })).toBeNull();
    expect(formatProgress({ percent: '50' })).toBeNull();
    expect(formatProgress({ percent: Number.NaN })).toBeNull();
    expect(formatProgress({ percent: Number.POSITIVE_INFINITY })).toBeNull();
    expect(formatProgress({ totalBytes: 1024 })).toBeNull();
    expect(formatProgress({ stage: '解包归档', percent: Number.NaN })).toBe('进度 解包归档');
  });
});

describe('createProgressWriter（§3.10.4 三态）', () => {
  it('TTY：原地刷新序列 \\r + 清行转义，且连续重复不上屏', () => {
    const { sink, out, err } = captureSink(true);
    const writer = createProgressWriter({ sink, env: {} });
    writer.update({ percent: 10, stage: '解包' });
    writer.update({ percent: 10, stage: '解包' });
    writer.update({ percent: 30 });
    writer.update({});
    expect(out).toEqual([]);
    expect(err).toEqual(['\r进度 10% 解包\u001b[K', '\r进度 30%\u001b[K']);
  });

  it('TTY：clear 收起进度行，且清空去重基线使同一进度可再次展示', () => {
    const { sink, err } = captureSink(true);
    const writer = createProgressWriter({ sink, env: {} });
    writer.clear();
    expect(err).toEqual([]);
    writer.update({ percent: 50 });
    writer.clear();
    expect(err).toEqual(['\r进度 50%\u001b[K', '\r\u001b[K']);
    writer.clear();
    expect(err).toHaveLength(2);
    writer.update({ percent: 50 });
    expect(err).toHaveLength(3);
    expect(err[2]).toBe('\r进度 50%\u001b[K');
  });

  it('非交互缺省静默：CHIPS_CLI_JOB_PROGRESS 未开启时一条都不写', () => {
    const { sink, out, err } = captureSink(false);
    const writer = createProgressWriter({ sink, env: { CHIPS_CLI_JOB_PROGRESS: '0' } });
    writer.update({ percent: 10 });
    writer.update({ percent: 90, stage: '校验' });
    writer.clear();
    expect(out).toEqual([]);
    expect(err).toEqual([]);
  });

  it('非交互 + CHIPS_CLI_JOB_PROGRESS=1：按行写 stderr，去重且 clear 不追加清行', () => {
    const { sink, out, err } = captureSink(false);
    const writer = createProgressWriter({ sink, env: { CHIPS_CLI_JOB_PROGRESS: '1' } });
    const reports: IProgressReport[] = [
      { percent: 25, stage: '解包' },
      { percent: 25, stage: '解包' },
      { percent: 75, stage: '校验' },
      { totalBytes: 4096 },
    ];
    for (const report of reports) {
      writer.update(report);
    }
    writer.clear();
    writer.update({ percent: 25, stage: '解包' });
    expect(out).toEqual([]);
    expect(err).toEqual(['进度 25% 解包\n', '进度 75% 校验\n', '进度 25% 解包\n']);
  });

  it('同一写出器实例的状态互不影响', () => {
    const first = captureSink(true);
    const second = captureSink(true);
    const left = createProgressWriter({ sink: first.sink, env: {} });
    const right = createProgressWriter({ sink: second.sink, env: {} });
    left.update({ percent: 5 });
    left.update({ percent: 5 });
    right.update({ percent: 5 });
    expect(first.err).toEqual(['\r进度 5%\u001b[K']);
    expect(second.err).toEqual(['\r进度 5%\u001b[K']);
  });
});
