import { describe, expect, it } from 'vitest';
import { PerfError } from '../src/errors';
import { runParserBench, type ParseFixture, type ParserUnderTest } from '../src/parser-bench';

function fixtureOf(size: number): ParseFixture {
  return {
    id: `fixture-${String(size)}`,
    title: `合成夹具 ${String(size)}`,
    totalBytes: size,
    payload: new Uint8Array(size).fill(1),
  };
}

describe('解析基准（parser-bench）', () => {
  it('warmup 不计入样本，轮次与统计正确（注入时钟）', async () => {
    const clock = [0, 10, 10, 30, 30, 65];
    let calls = 0;
    const parser: ParserUnderTest = {
      name: 'fake-parser',
      parse(): void {
        calls += 1;
      },
    };
    const result = await runParserBench(parser, fixtureOf(16), {
      metricId: 'parse_10mb_ms',
      rounds: 2,
      warmupRounds: 1,
      now: () => {
        const value = clock.shift();
        if (value === undefined) {
          throw new Error('测试时钟耗尽');
        }
        return value;
      },
    });
    expect(calls).toBe(3);
    expect(result.samplesMs).toEqual([20, 35]);
    expect(result.stats.count).toBe(2);
    expect(result.stats.median).toBe(27.5);
    expect(result.fixtureBytes).toBe(16);
    expect(result.metricId).toBe('parse_10mb_ms');
  });

  it('真实时钟下也可执行（结构校验，不判定门禁）', async () => {
    const parser: ParserUnderTest = {
      name: 'scan-parser',
      parse(fixture): void {
        let sink = 0;
        for (const byte of fixture.payload) {
          sink += byte;
        }
        void sink;
      },
    };
    const result = await runParserBench(parser, fixtureOf(1024), {
      metricId: 'parse_10mb_ms',
      rounds: 3,
      warmupRounds: 1,
    });
    expect(result.samplesMs).toHaveLength(3);
    for (const sample of result.samplesMs) {
      expect(sample).toBeGreaterThanOrEqual(0);
    }
  });

  it('非法轮次、夹具不一致与空载荷抛出 PerfError', async () => {
    const parser: ParserUnderTest = { name: 'p', parse(): void {} };
    await expect(
      runParserBench(parser, fixtureOf(8), {
        metricId: 'parse_10mb_ms',
        rounds: 0,
        warmupRounds: 0,
      })
    ).rejects.toThrowError(PerfError);
    await expect(
      runParserBench(parser, fixtureOf(8), {
        metricId: 'parse_10mb_ms',
        rounds: 1,
        warmupRounds: -1,
      })
    ).rejects.toThrowError(PerfError);
    await expect(
      runParserBench(
        parser,
        { id: 'bad', title: 'bad', totalBytes: 4, payload: new Uint8Array(8) },
        { metricId: 'parse_10mb_ms', rounds: 1, warmupRounds: 0 }
      )
    ).rejects.toThrowError(PerfError);
    await expect(
      runParserBench(
        parser,
        { id: 'empty', title: 'empty', totalBytes: 0, payload: new Uint8Array(0) },
        { metricId: 'parse_10mb_ms', rounds: 1, warmupRounds: 0 }
      )
    ).rejects.toThrowError(PerfError);
  });
});
