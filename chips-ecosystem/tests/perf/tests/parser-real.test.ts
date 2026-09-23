import { mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  SYNTHETIC_ADAPTER_ID_PREFIX,
  assertRealParseDomainAdapter,
  assertValidAdapter,
  isSyntheticAdapterId,
  type PerfAdapter,
} from '../src/adapters';
import { createSyntheticAdapter } from '../src/fixtures/synthetic';
import { DEFAULT_CONFIG } from '../src/thresholds';
import { METRIC_IDS, type MetricId } from '../src/metrics';
import { PARSE_DOMAIN_SCENARIO_IDS, isParseDomainScenario } from '../src/scenarios';
import { measureScenario } from '../src/runner';
import {
  base62Id,
  buildPerfBox10kArchive,
  buildPerfCard10mbArchive,
  crc32,
  writePerfParseFixtures,
} from '../src/real/parse-fixtures';
import {
  CORE_ABI_VERSION_PIN,
  NATIVE_PARSER_REQUIRED_EXPORTS,
  loadNativeParserSurface,
} from '../src/real/native-parser';
import { REAL_PARSE_ADAPTER_ID, adapter, createRealParseAdapter } from '../src/real/parser-adapter';
import type {
  NativeDocumentHandle,
  NativeDocumentValueResult,
  NativeParserSurface,
  NativeValidationReportShape,
} from '../src/real/native-parser';

/**
 * 解析域真测臂锁测（工单056 期望行为 1「合成臂与真臂可分辨」+ 形 A 协议钉桩）。
 *
 * 全部纯逻辑：注入假解析面与受控时钟，不触达真产物、不拉真进程
 * （与真进程适配器 `real-process.test.ts` 同一纪律）；真产物臂的实跑证据
 * 走 `pnpm run measure --adapter src/real/parser-adapter.ts`（flag-gated 手跑账）。
 */

function valueResult(): NativeDocumentValueResult {
  return { kind: 'card', value: {}, diagnostics: [] };
}

interface FakeSurfaceCalls {
  openCard: number;
  openBox: number;
  structure: number;
  content: number;
  layoutConfig: number;
  close: number;
  validate: number;
}

function fakeSurface(overrides: Partial<NativeParserSurface> = {}): {
  surface: NativeParserSurface;
  calls: FakeSurfaceCalls;
} {
  const calls: FakeSurfaceCalls = {
    openCard: 0,
    openBox: 0,
    structure: 0,
    content: 0,
    layoutConfig: 0,
    close: 0,
    validate: 0,
  };
  const handle = {} as NativeDocumentHandle;
  const report: NativeValidationReportShape = {
    kind: 'card',
    chip_standards_version: '1.0.0',
    status: 'valid',
    statistics: {
      member_count: 4,
      yaml_bytes: 1_048_576,
      resource_count: 1,
      entry_count: 10_000,
      uncompressed_bytes: 10_485_760,
    },
    diagnostics: [],
  };
  const surface: NativeParserSurface = {
    coreVersion: () => '0.1.0-fake',
    coreAbiVersion: () => CORE_ABI_VERSION_PIN,
    openCard: () => {
      calls.openCard += 1;
      return Promise.resolve(handle);
    },
    openBox: () => {
      calls.openBox += 1;
      return Promise.resolve(handle);
    },
    documentMetadata: () => Promise.resolve(valueResult()),
    documentStructure: () => {
      calls.structure += 1;
      return Promise.resolve(valueResult());
    },
    documentContent: () => {
      calls.content += 1;
      return Promise.resolve({
        kind: 'card',
        value: {
          node_id: 'PerfCardN0',
          file: '',
          card_type: 'base.richtext',
          value: {},
          diagnostics: [],
        },
        diagnostics: [],
      });
    },
    documentLayoutConfig: () => {
      calls.layoutConfig += 1;
      return Promise.resolve(valueResult());
    },
    documentValidate: () => {
      calls.validate += 1;
      return Promise.resolve(report);
    },
    documentClose: () => {
      calls.close += 1;
      return Promise.resolve();
    },
    ...overrides,
  };
  return { surface, calls };
}

/** 受控时钟：每调用一次前进 `stepMs` 毫秒。 */
function steppingClock(stepMs: number): () => number {
  let ticks = 0;
  return () => {
    const value = ticks * stepMs;
    ticks += 1;
    return value;
  };
}

async function tempFixtureDir(label: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `chips-perf-parse-test-${label}-`));
  return dir;
}

describe('解析域真测适配器登记（real 形 + 分流闸）', () => {
  it('缺省适配器契约合法且登记为 real 形、覆盖两解析域场景、ID 非合成命名', () => {
    expect(() => assertValidAdapter(adapter)).not.toThrow();
    expect(adapter.id).toBe(REAL_PARSE_ADAPTER_ID);
    expect(adapter.measurementForm).toBe('real');
    expect(adapter.provides).toEqual([...PARSE_DOMAIN_SCENARIO_IDS]);
    expect(isSyntheticAdapterId(adapter.id)).toBe(false);
    expect(PARSE_DOMAIN_SCENARIO_IDS.every(isParseDomainScenario)).toBe(true);
  });

  it('分流闸放行真臂（assertRealParseDomainAdapter 不抛错）', () => {
    expect(() => assertRealParseDomainAdapter(adapter)).not.toThrow();
    expect(() => assertRealParseDomainAdapter(createRealParseAdapter())).not.toThrow();
  });

  it('合成臂冒充解析域真测被逐项点名拒绝（golden/regressed/伪造 real 名三形）', () => {
    expect(() => assertRealParseDomainAdapter(createSyntheticAdapter('golden'))).toThrowError(
      new RegExp(`${SYNTHETIC_ADAPTER_ID_PREFIX}.*合成臂命名`)
    );
    expect(() => assertRealParseDomainAdapter(createSyntheticAdapter('regressed'))).toThrowError(
      /合成臂命名/
    );
    const masked = createSyntheticAdapter('golden');
    const disguised: PerfAdapter = { ...masked, id: 'chips-native-wannabe' };
    expect(() => assertRealParseDomainAdapter(disguised)).toThrowError(/measurementForm/);
    const missingForm: PerfAdapter = {
      id: adapter.id,
      title: adapter.title,
      description: adapter.description,
      provides: adapter.provides,
      run: (context) => adapter.run(context),
    };
    expect(() => assertRealParseDomainAdapter(missingForm)).toThrowError(/measurementForm/);
  });

  it('分流闸拒绝非解析域/覆盖不全的适配器', () => {
    const noParseDomain: PerfAdapter = {
      ...adapter,
      provides: ['cold-start'],
    };
    expect(() => assertRealParseDomainAdapter(noParseDomain)).toThrowError(/未声明任何解析域场景/);
    const halfCoverage: PerfAdapter = {
      ...adapter,
      provides: ['parse-box-10k'],
    };
    expect(() => assertRealParseDomainAdapter(halfCoverage)).toThrowError(/两场景齐备/);
  });

  it('构造零副作用：假装载器抛错前不落夹具、不触产物；未提供场景拒绝', async () => {
    const fixtureDir = join(await tempFixtureDir('zero-side'), 'unused');
    const failing = createRealParseAdapter({
      loadSurface: () => {
        throw new Error('不应装载原生解析面');
      },
      fixtureDir,
    });
    await expect(failing.run({ scenarioId: 'parse-card-10mb', iteration: 0 })).rejects.toThrow(
      '不应装载原生解析面'
    );
    expect(existsSync(fixtureDir)).toBe(false);
    await expect(failing.run({ scenarioId: 'open-card', iteration: 0 })).rejects.toThrowError(
      new RegExp('未提供场景')
    );
  });
});

describe('解析域真测计时协议（假解析面 + 受控时钟）', () => {
  it('卡片场景：逐段样本恰为同轮打点差值，warmup 不记录，缺测臂不产样本', async () => {
    const { surface, calls } = fakeSurface();
    const fixtureDir = await tempFixtureDir('card');
    const parsed = createRealParseAdapter({
      loadSurface: () => surface,
      clock: steppingClock(10),
      rounds: 2,
      warmupRounds: 1,
      fixtureDir,
    });
    const result = await parsed.run({ scenarioId: 'parse-card-10mb', iteration: 0 });
    // 每轮 4 次打点（start/opened/structured/contentAt）；warmup 轮消耗 0/10/20/30，
    // 正式两轮分别消耗 40..70 与 80..110 → 每段恒为 10 ms、全链恒为 30 ms。
    expect(result.metricSamples?.['parse_open_ms']).toEqual([10, 10]);
    expect(result.metricSamples?.['parse_structure_ms']).toEqual([10, 10]);
    expect(result.metricSamples?.['parse_content_yaml_ms']).toEqual([10, 10]);
    expect(result.metricSamples?.['parse_10mb_ms']).toEqual([30, 30]);
    expect(result.metricSamples).not.toHaveProperty('parse_metadata_ms');
    expect(result.metricSamples).not.toHaveProperty('parse_model_build_ms');
    // warmup 1 + 正式 2 + 体检 1 = 4 次 open/close；structure 3 + 体检 1 = 4。
    expect(calls.openCard).toBe(4);
    expect(calls.close).toBe(4);
    expect(calls.structure).toBe(4);
    expect(calls.validate).toBe(1);
    const notes = (result.notes ?? []).join('\n');
    expect(notes).toContain('缺测臂');
    expect(notes).toContain('parse_metadata_ms');
    expect(notes).toContain('chips-native.node');
    // 夹具真实落盘（>1 MB 运行时生成，不入库）。
    const paths = await writePerfParseFixtures(fixtureDir);
    expect(paths.cardBytes).toBeGreaterThan(10 * 1024 * 1024);
  });

  it('箱子场景：parse_entries_10k_ms 取条目索引解析段；伴生卡片口径指标不张冠李戴', async () => {
    const { surface } = fakeSurface();
    const fixtureDir = await tempFixtureDir('box');
    const parsed = createRealParseAdapter({
      loadSurface: () => surface,
      clock: steppingClock(10),
      rounds: 2,
      warmupRounds: 1,
      fixtureDir,
    });
    const result = await parsed.run({ scenarioId: 'parse-box-10k', iteration: 0 });
    // 箱子轮 4 次打点（start/opened/structured/layoutAt）→ structure 段恒 10 ms。
    expect(result.metricSamples?.['parse_entries_10k_ms']).toEqual([10, 10]);
    expect(result.metricSamples).not.toHaveProperty('parse_10mb_ms');
    const notes = (result.notes ?? []).join('\n');
    expect(notes).toContain('张冠李戴');
    expect(notes).toContain('如实 noData');
  });

  it('错误级诊断与 invalid 体检均 fail-closed（句柄仍显式释放）', async () => {
    const broken = fakeSurface({
      documentStructure: (): Promise<NativeDocumentValueResult> =>
        Promise.resolve({
          kind: 'card',
          value: {},
          diagnostics: [{ severity: 'error', code: 'DOCUMENT_YAML_INVALID', message: '坏夹具' }],
        }),
    });
    const fixtureDir = await tempFixtureDir('failclosed');
    const parsed = createRealParseAdapter({
      loadSurface: () => broken.surface,
      rounds: 1,
      warmupRounds: 0,
      fixtureDir,
    });
    await expect(parsed.run({ scenarioId: 'parse-card-10mb', iteration: 0 })).rejects.toThrowError(
      /DOCUMENT_YAML_INVALID.*fail-closed/
    );
    expect(broken.calls.close).toBe(1);

    const invalidCheck = fakeSurface({
      documentValidate: (): Promise<NativeValidationReportShape> =>
        Promise.resolve({
          kind: 'card',
          chip_standards_version: '1.0.0',
          status: 'invalid',
          statistics: {
            member_count: 0,
            yaml_bytes: 0,
            resource_count: 0,
            entry_count: 0,
            uncompressed_bytes: 0,
          },
          diagnostics: [{ severity: 'error', code: 'PERF_TEST_INVALID', message: '体检拒绝' }],
        }),
    });
    const parsed2 = createRealParseAdapter({
      loadSurface: () => invalidCheck.surface,
      rounds: 1,
      warmupRounds: 0,
      fixtureDir,
    });
    await expect(parsed2.run({ scenarioId: 'parse-card-10mb', iteration: 0 })).rejects.toThrowError(
      /严格校验判 invalid/
    );
  });

  it('管线贯通：measureScenario 消费真臂样本，meta.adapterId 可分辨、缺测臂落 no-data', async () => {
    const { surface } = fakeSurface();
    const fixtureDir = await tempFixtureDir('pipeline');
    const parsed = createRealParseAdapter({
      loadSurface: () => surface,
      clock: steppingClock(1),
      rounds: 3,
      warmupRounds: 0,
      fixtureDir,
    });
    const report = await measureScenario({
      scenarioId: 'parse-card-10mb',
      adapter: parsed,
      config: DEFAULT_CONFIG,
      meta: {
        buildType: 'release',
        deviceLabel: 'unit-test-device',
        platform: process.platform,
        nodeVersion: process.version,
      },
      generatedAt: '2026-09-23T00:00:00.000Z',
    });
    expect(report.meta.adapterId).toBe(REAL_PARSE_ADAPTER_ID);
    expect(isSyntheticAdapterId(report.meta.adapterId)).toBe(false);
    const byId = new Map(report.metrics.map((metric) => [metric.metricId, metric]));
    expect(byId.get('parse_10mb_ms')?.verdict).toBe('pass'); // 全链 3 tick ≤ 100
    expect(byId.get('parse_metadata_ms')?.verdict).toBe('no-data');
    expect(byId.get('parse_model_build_ms')?.verdict).toBe('no-data');
    expect(
      report.metrics.every((metric) => (METRIC_IDS as readonly string[]).includes(metric.metricId))
    ).toBe(true);
  });
});

describe('解析域真测夹具与装载闸（fail-closed 钉桩）', () => {
  it('夹具确定性：同参数两次生成逐字节一致（10 MB 卡片与 10 000 条目箱子）', () => {
    const cardA = buildPerfCard10mbArchive();
    const cardB = buildPerfCard10mbArchive();
    expect(cardA.byteLength).toBe(cardB.byteLength);
    expect(crc32(cardA)).toBe(crc32(cardB));
    expect(cardA.byteLength).toBeGreaterThan(10 * 1024 * 1024);
    const boxA = buildPerfBox10kArchive();
    const boxB = buildPerfBox10kArchive();
    expect(crc32(boxA)).toBe(crc32(boxB));
  }, 30_000);

  it('ZIP Store 结构自洽 + CRC-32 标准校验向量 + Base62 标识形状', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const archive = buildPerfBox10kArchive(32);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50); // 本地文件头签名
    const eocd = view.getUint32(archive.byteLength - 22, true);
    expect(eocd).toBe(0x06054b50);
    expect(view.getUint16(archive.byteLength - 14, true)).toBe(4); // 条目数（3 根 + structure 共 4 项）
    for (let index = 0; index < 40; index += 1) {
      expect(base62Id(index)).toMatch(/^[0-9A-Za-z]{10}$/);
    }
    expect(base62Id(0)).toBe('0000000000');
    expect(() => base62Id(-1)).toThrow(Error);
    expect(() => base62Id(62 ** 10)).toThrow(Error);
  });

  it('writePerfParseFixtures 落盘两夹具并回报字节数', async () => {
    const dir = await tempFixtureDir('disk');
    const paths = await writePerfParseFixtures(join(dir, 'sub'));
    expect(existsSync(paths.cardPath)).toBe(true);
    expect(existsSync(paths.boxPath)).toBe(true);
    expect(paths.cardBytes).toBeGreaterThan(10 * 1024 * 1024);
    expect(paths.boxBytes).toBeGreaterThan(1024 * 1024);
  }, 30_000);

  it('装载闸：产物缺位、导出缺位、ABI 漂移三臂全部 fail-closed', async () => {
    expect(() =>
      loadNativeParserSurface(join(tmpdir(), 'chips-perf-absent', 'chips-native.node'))
    ).toThrowError(/原生绑定产物不存在/);
    const dir = await tempFixtureDir('stub');
    const emptyStub = join(dir, 'empty-stub.cjs');
    await writeFile(emptyStub, 'module.exports = {};\n', 'utf8');
    expect(() => loadNativeParserSurface(emptyStub)).toThrowError(
      new RegExp(`必备导出缺位.*${NATIVE_PARSER_REQUIRED_EXPORTS[0]}`)
    );
    const abiStub = join(dir, 'abi-stub.cjs');
    const fns = NATIVE_PARSER_REQUIRED_EXPORTS.map((name) => `${name}: () => {},`).join('\n');
    await writeFile(
      abiStub,
      `module.exports = { ${fns} coreVersion: () => '0.0.0-stub', coreAbiVersion: () => ${String(CORE_ABI_VERSION_PIN + 999)} };\n`,
      'utf8'
    );
    expect(() => loadNativeParserSurface(abiStub)).toThrowError(/ABI 漂移|coreAbiVersion/);
  });

  it('指标登记面零扰动：真臂只向已登记指标供样（parse 域族清单钉桩）', () => {
    const parseMetrics = METRIC_IDS.filter((metricId) => metricId.startsWith('parse_'));
    for (const metricId of [
      'parse_10mb_ms',
      'parse_open_ms',
      'parse_metadata_ms',
      'parse_structure_ms',
      'parse_content_yaml_ms',
      'parse_entries_10k_ms',
      'parse_model_build_ms',
    ] as const) {
      expect(parseMetrics).toContain(metricId satisfies MetricId);
    }
  });
});
