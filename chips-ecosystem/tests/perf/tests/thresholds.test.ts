import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PerfError } from '../src/errors';
import {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  loadConfigFile,
  parseConfig,
  resolveThreshold,
  resolveThresholds,
} from '../src/thresholds';

function validConfigInput(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Record<string, unknown>;
}

describe('配置与门禁解析（thresholds）', () => {
  it('默认配置通过校验且门禁零覆盖', () => {
    const config = parseConfig(validConfigInput());
    expect(config.phase).toBe(4);
    expect(config.allowGateOverride).toBe(false);
    expect(resolveThreshold('cold_start_ms', config).value).toBe(1000);
    expect(resolveThreshold('cold_start_ms', config).source).toBe('R18');
  });

  it('Phase 2 使用放宽值；无放宽值的指标回落到正式门禁', () => {
    const config = parseConfig({ ...validConfigInput(), phase: 2 });
    const cold = resolveThreshold('cold_start_ms', config);
    expect(cold.value).toBe(2000);
    expect(cold.source).toBe('R18');
    const parse = resolveThreshold('parse_10mb_ms', config);
    expect(parse.value).toBe(100);
    expect(parse.phaseFallback).toBe(true);
  });

  it('覆盖门禁必须显式开启并写明理由', () => {
    const withOverride = {
      ...validConfigInput(),
      overrides: { cold_start_ms: { value: 1500, rationale: '本机为低功耗验证机' } },
    };
    expect(() => parseConfig(withOverride)).toThrowError(PerfError);
    const allowed = parseConfig({ ...withOverride, allowGateOverride: true });
    const resolved = resolveThreshold('cold_start_ms', allowed);
    expect(resolved.value).toBe(1500);
    expect(resolved.source).toBe('config');
    expect(resolved.overrideRationale).toBe('本机为低功耗验证机');
  });

  it('未知指标与未知配置项被拒绝', () => {
    expect(() =>
      parseConfig({
        ...validConfigInput(),
        allowGateOverride: true,
        overrides: { not_a_metric: { value: 1, rationale: 'x' } },
      })
    ).toThrowError(PerfError);
    expect(() => parseConfig({ ...validConfigInput(), unknownKey: 1 })).toThrowError(PerfError);
    expect(() =>
      parseConfig({
        ...validConfigInput(),
        measurement: { ...DEFAULT_CONFIG.measurement, rounds: 0 },
      })
    ).toThrowError(PerfError);
    expect(() => parseConfig({ ...validConfigInput(), schemaVersion: '2.0.0' })).toThrowError(
      PerfError
    );
  });

  it('回归策略必须覆盖全部单位且非负', () => {
    expect(() =>
      parseConfig({
        ...validConfigInput(),
        regression: { ...DEFAULT_CONFIG.regression, tolerancePercent: { ms: 1 } },
      })
    ).toThrowError(PerfError);
  });

  it('resolveThresholds 覆盖全部已登记指标', () => {
    const resolved = resolveThresholds(DEFAULT_CONFIG);
    expect(resolved.size).toBeGreaterThanOrEqual(21);
    expect(resolved.get('frame_pool_size')?.value).toBe(32);
  });

  it('随包 perf.config.json 可加载且与默认策略一致', () => {
    const config = loadConfigFile(fileURLToPath(new URL('../perf.config.json', import.meta.url)));
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('loadConfigFile 读取合法文件并包装非法 JSON', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'chips-perf-config-'));
    const validPath = join(directory, 'perf.config.json');
    await writeFile(
      validPath,
      `${JSON.stringify({ ...validConfigInput(), schemaVersion: CONFIG_SCHEMA_VERSION })}\n`,
      'utf8'
    );
    expect(loadConfigFile(validPath).schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    const invalidPath = join(directory, 'broken.json');
    await writeFile(invalidPath, '{', 'utf8');
    expect(() => loadConfigFile(invalidPath)).toThrowError(PerfError);
    expect(() => loadConfigFile(join(directory, 'missing.json'))).toThrowError(PerfError);
  });
});
