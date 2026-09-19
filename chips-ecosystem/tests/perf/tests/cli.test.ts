import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { main, parseCliArgs } from '../src/cli';
import { PerfError } from '../src/errors';
import { parseReport } from '../src/report';

const AT = '2026-09-19T00:00:00.000Z';

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceStdio(): MockInstance {
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  return stdout;
}

describe('命令行（cli）', () => {
  it('参数解析支持 --key value、--key=value 与布尔开关', () => {
    const args = parseCliArgs([
      'measure',
      '--adapter=synthetic:golden',
      '--scenario',
      'open-card',
      '--no-write',
    ]);
    expect(args.command).toBe('measure');
    expect(args.flags.get('adapter')).toBe('synthetic:golden');
    expect(args.flags.get('scenario')).toBe('open-card');
    expect(args.flags.get('no-write')).toBe(true);
  });

  it('未知选项、缺值与多余位置参数抛出 PerfError', () => {
    expect(() => parseCliArgs(['list', '--unknown'])).toThrowError(PerfError);
    expect(() => parseCliArgs(['measure', '--adapter'])).toThrowError(PerfError);
    expect(() => parseCliArgs(['list', 'extra'])).toThrowError(PerfError);
  });

  it('help 与 list 命令返回 0 并输出内容', async () => {
    const stdout = silenceStdio();
    expect(await main(['help'])).toBe(0);
    expect(await main(['list'])).toBe(0);
    const writes = stdout.mock.calls.map((call) => String(call[0])).join('');
    expect(writes).toContain('用法');
    expect(writes).toContain('cold_start_ms');
  });

  it('measure 达标档退出 0、劣化档退出 1，并写出 JSON+Markdown', async () => {
    silenceStdio();
    const outputDir = await mkdtemp(join(tmpdir(), 'chips-perf-measure-'));
    const goldenCode = await main([
      'measure',
      '--adapter',
      'synthetic:golden',
      '--scenario',
      'cold-start',
      '--out',
      outputDir,
      '--at',
      AT,
    ]);
    expect(goldenCode).toBe(0);
    const regressedDir = await mkdtemp(join(tmpdir(), 'chips-perf-measure-regressed-'));
    const regressedCode = await main([
      'measure',
      '--adapter',
      'synthetic:regressed',
      '--scenario',
      'cold-start',
      '--out',
      regressedDir,
      '--at',
      AT,
    ]);
    expect(regressedCode).toBe(1);
    expect(await readdir(outputDir)).toContain('2026-09-19T00-00-00-000Z-cold-start.json');
    expect(await readdir(outputDir)).toContain('2026-09-19T00-00-00-000Z-cold-start.md');
  }, 30_000);

  it('compare 检出回归（退出 1）并在 debug 构建下判不可比（退出 3）', async () => {
    silenceStdio();
    const directory = await mkdtemp(join(tmpdir(), 'chips-perf-compare-'));
    await main([
      'measure',
      '--adapter',
      'synthetic:golden',
      '--scenario',
      'cold-start',
      '--out',
      directory,
      '--at',
      AT,
    ]);
    const regressedAt = '2026-09-19T00:00:01.000Z';
    await main([
      'measure',
      '--adapter',
      'synthetic:regressed',
      '--scenario',
      'cold-start',
      '--out',
      directory,
      '--at',
      regressedAt,
    ]);
    const baseline = join(directory, '2026-09-19T00-00-00-000Z-cold-start.json');
    const candidate = join(directory, '2026-09-19T00-00-01-000Z-cold-start.json');
    expect(
      await main([
        'compare',
        '--baseline',
        baseline,
        '--candidate',
        candidate,
        '--out',
        directory,
        '--at',
        AT,
      ])
    ).toBe(1);
    expect(
      await main(['compare', '--baseline', baseline, '--candidate', baseline, '--no-write'])
    ).toBe(0);

    const debugDir = await mkdtemp(join(tmpdir(), 'chips-perf-debug-'));
    await main([
      'measure',
      '--adapter',
      'synthetic:golden',
      '--scenario',
      'cold-start',
      '--out',
      debugDir,
      '--build-type',
      'debug',
      '--at',
      AT,
    ]);
    const debugReport = join(debugDir, '2026-09-19T00-00-00-000Z-cold-start.json');
    expect(
      await main(['compare', '--baseline', debugReport, '--candidate', debugReport, '--no-write'])
    ).toBe(3);
  }, 30_000);

  it('ingest 导入外部样本并生成报告', async () => {
    silenceStdio();
    const directory = await mkdtemp(join(tmpdir(), 'chips-perf-ingest-'));
    const samplesPath = join(directory, 'samples.json');
    await writeFile(
      samplesPath,
      `${JSON.stringify({
        meta: { deviceLabel: 'ingest-device' },
        samples: {
          plugin_load_ms: [70, 72, 74],
          kernel_service_call_us: [0.5, 0.6, 0.55],
          kernel_event_emit_us: [0.5, 0.6, 0.7],
          kernel_event_emit_empty_us: [0.05, 0.06, 0.07],
          bridge_forward_enqueue_ms: [0.5, 0.6, 0.55],
        },
      })}\n`,
      'utf8'
    );
    const code = await main([
      'ingest',
      '--input',
      samplesPath,
      '--scenario',
      'kernel-latency',
      '--out',
      directory,
      '--at',
      AT,
    ]);
    expect(code).toBe(0);
    const report = parseReport(
      await readFile(join(directory, '2026-09-19T00-00-00-000Z-kernel-latency.json'), 'utf8')
    );
    expect(report.summary.verdict).toBe('pass');
    expect(report.meta.deviceLabel).toBe('ingest-device');
    expect(report.meta.adapterId).toBe('ingest');
  });

  it('用法错误返回 2', async () => {
    silenceStdio();
    expect(await main(['unknown-command'])).toBe(2);
    expect(await main(['measure'])).toBe(2);
    expect(
      await main(['compare', '--baseline', 'missing.json', '--candidate', 'missing.json'])
    ).toBe(2);
  });
});
