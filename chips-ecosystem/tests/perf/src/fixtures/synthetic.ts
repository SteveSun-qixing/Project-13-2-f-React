import { createHash } from 'node:crypto';
import type { AdapterRunResult, PerfAdapter } from '../adapters';
import { BYTES_PER_MB, type MemorySample } from '../memory';
import type { PerfMarker } from '../markers';
import type { MetricId } from '../metrics';
import { MARKERS, SCENARIO_IDS, scenarioDefinition, type ScenarioId } from '../scenarios';
import type { ParseFixture } from '../parser-bench';

/**
 * 合成数据生成器（自测专用）。
 *
 * 重要边界：
 * - 本文件的数值全部是**合成夹具值**，不是性能门禁；门禁只在 `src/metrics.ts` 编码；
 * - 生成过程使用固定种子的 PRNG，同一（质量档位、场景、轮次）产出完全一致，保证自测可复现；
 * - 合成适配器在报告 notes 中显式标注「合成数据」，防止与真实测量混淆。
 */

/** 合成数据档位：达标（golden）与劣化（regressed）。 */
export type SyntheticQuality = 'golden' | 'regressed';

/** 合成数据默认种子（确定性；与性能门禁无关）。 */
export const SYNTHETIC_SEED = 20260919;

/** 合成适配器 notes 标记。 */
export const SYNTHETIC_NOTE = '合成数据（非真实测量），用于性能工具自测';

/** mulberry32 PRNG：32 位种子、确定性、无外部依赖。 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 字符串散列，用于从（种子、场景、轮次）派生独立 PRNG 流。 */
export function deriveSeed(seed: number, key: string, iteration: number): number {
  let hash = 0x811c9dc5 ^ (seed >>> 0);
  const text = `${key}#${String(iteration)}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

interface SampleTarget {
  readonly value: number;
  readonly spreadPercent: number;
}

interface MarkerTargets {
  readonly acceptMs: number;
  readonly parseMs: number;
  readonly schedulingMs: number;
  readonly frameReadyMs: number;
  readonly commitMs: number;
}

interface MarkerTargetTable {
  readonly coldStartMs: number;
  readonly card: MarkerTargets;
  readonly box: MarkerTargets;
}

/** 合成标记点目标（毫秒）；数值为夹具值，不是门禁。 */
const MARKER_TARGETS: Readonly<Record<SyntheticQuality, MarkerTargetTable>> = {
  golden: {
    coldStartMs: 790,
    card: { acceptMs: 2, parseMs: 26, schedulingMs: 3, frameReadyMs: 28, commitMs: 20 },
    box: { acceptMs: 3, parseMs: 52, schedulingMs: 4, frameReadyMs: 62, commitMs: 50 },
  },
  regressed: {
    coldStartMs: 1480,
    card: { acceptMs: 5, parseMs: 50, schedulingMs: 6, frameReadyMs: 52, commitMs: 36 },
    box: { acceptMs: 8, parseMs: 84, schedulingMs: 10, frameReadyMs: 92, commitMs: 76 },
  },
};

/** 合成样本目标（单位与指标注册表一致）；数值为夹具值，不是门禁。 */
const SAMPLE_TARGETS: Readonly<
  Record<SyntheticQuality, Readonly<Partial<Record<MetricId, SampleTarget>>>>
> = {
  golden: {
    render_update_ms: { value: 9.5, spreadPercent: 6 },
    parse_10mb_ms: { value: 86, spreadPercent: 3 },
    parse_open_ms: { value: 7.6, spreadPercent: 3 },
    parse_metadata_ms: { value: 4.1, spreadPercent: 3 },
    parse_structure_ms: { value: 8.2, spreadPercent: 3 },
    parse_content_yaml_ms: { value: 52, spreadPercent: 3 },
    parse_entries_10k_ms: { value: 88, spreadPercent: 3 },
    parse_model_build_ms: { value: 6.2, spreadPercent: 3 },
    plugin_load_ms: { value: 72, spreadPercent: 4 },
    kernel_service_call_us: { value: 0.62, spreadPercent: 5 },
    kernel_event_emit_us: { value: 0.74, spreadPercent: 5 },
    kernel_event_emit_empty_us: { value: 0.07, spreadPercent: 8 },
    bridge_forward_enqueue_ms: { value: 0.7, spreadPercent: 5 },
    frame_pool_size: { value: 24, spreadPercent: 6 },
    parse_cache_entries: { value: 48, spreadPercent: 8 },
    cover_cache_entries: { value: 40, spreadPercent: 8 },
  },
  regressed: {
    render_update_ms: { value: 18, spreadPercent: 6 },
    parse_10mb_ms: { value: 172, spreadPercent: 3 },
    parse_open_ms: { value: 12.4, spreadPercent: 3 },
    parse_metadata_ms: { value: 7.4, spreadPercent: 3 },
    parse_structure_ms: { value: 13.1, spreadPercent: 3 },
    parse_content_yaml_ms: { value: 88, spreadPercent: 3 },
    parse_entries_10k_ms: { value: 146, spreadPercent: 3 },
    parse_model_build_ms: { value: 11.2, spreadPercent: 3 },
    plugin_load_ms: { value: 134, spreadPercent: 4 },
    kernel_service_call_us: { value: 1.42, spreadPercent: 5 },
    kernel_event_emit_us: { value: 1.6, spreadPercent: 5 },
    kernel_event_emit_empty_us: { value: 0.18, spreadPercent: 8 },
    bridge_forward_enqueue_ms: { value: 1.3, spreadPercent: 5 },
    frame_pool_size: { value: 40, spreadPercent: 5 },
    parse_cache_entries: { value: 96, spreadPercent: 6 },
    cover_cache_entries: { value: 78, spreadPercent: 6 },
  },
};

/** 合成帧率目标（fps）。 */
const FPS_TARGETS: Readonly<Record<SyntheticQuality, number>> = { golden: 62.5, regressed: 44 };

/** 合成内存目标（MB）。 */
const MEMORY_TARGETS: Readonly<
  Record<SyntheticQuality, { readonly startMb: number; readonly stableMb: number }>
> = {
  golden: { startMb: 300, stableMb: 430 },
  regressed: { startMb: 420, stableMb: 640 },
};

function jitter(prng: () => number, value: number, spreadPercent: number): number {
  return value * (1 + ((prng() - 0.5) * spreadPercent) / 100);
}

/** 生成指定场景的合成标记点时间线；同一（档位、场景、轮次）结果确定。 */
export function syntheticMarkers(
  scenarioId: ScenarioId,
  quality: SyntheticQuality,
  iteration: number,
  seed: number = SYNTHETIC_SEED
): readonly PerfMarker[] {
  const prng = mulberry32(deriveSeed(seed, `markers:${scenarioId}:${quality}`, iteration));
  const targets = MARKER_TARGETS[quality];
  const spread = 3;
  if (scenarioId === 'cold-start') {
    const base = 1_000 + iteration * 10;
    return [
      { name: MARKERS.processStart, at: base },
      { name: MARKERS.windowReady, at: base + jitter(prng, targets.coldStartMs, spread) },
    ];
  }
  if (scenarioId !== 'open-card' && scenarioId !== 'open-box') {
    throw new Error(`合成标记点不支持场景：${scenarioId}`);
  }
  const markerTargets = scenarioId === 'open-card' ? targets.card : targets.box;
  const accept = jitter(prng, markerTargets.acceptMs, spread);
  const parse = jitter(prng, markerTargets.parseMs, spread);
  const scheduling = jitter(prng, markerTargets.schedulingMs, spread);
  const frameReady = jitter(prng, markerTargets.frameReadyMs, spread);
  const commit = jitter(prng, markerTargets.commitMs, spread);
  const base = 2_000 + iteration * 10;
  const openCalled = base;
  const requestAccepted = openCalled + accept;
  const documentParsed = requestAccepted + parse;
  const frameCreated = documentParsed + scheduling;
  const ready = frameCreated + frameReady;
  const firstCommit = ready + commit;
  const markers: PerfMarker[] = [
    { name: MARKERS.openCalled, at: openCalled },
    { name: MARKERS.requestAccepted, at: requestAccepted },
    { name: MARKERS.documentParsed, at: documentParsed },
    { name: MARKERS.frameCreated, at: frameCreated },
    { name: MARKERS.frameReady, at: ready },
  ];
  if (scenarioId === 'open-card') {
    markers.push({ name: MARKERS.firstFrameCommit, at: firstCommit });
  } else {
    markers.push({ name: MARKERS.entriesFirstScreenCommit, at: firstCommit });
  }
  return markers;
}

/**
 * 生成合成帧时间戳序列：总时长固定为 `durationMs`，帧间隔围绕目标帧率抖动。
 * 数值为夹具值（如 62.5fps 达标档、44fps 劣化档），不是门禁。
 */
export function syntheticFrameTimestamps(
  quality: SyntheticQuality,
  durationMs = 10_000,
  iteration = 0,
  seed: number = SYNTHETIC_SEED
): readonly number[] {
  const prng = mulberry32(deriveSeed(seed, `frames:${quality}`, iteration));
  const targetFps = FPS_TARGETS[quality];
  const baseInterval = 1000 / targetFps;
  const timestamps: number[] = [0];
  let current = 0;
  while (true) {
    const interval = jitter(prng, baseInterval, 2.5);
    const next = current + interval;
    if (next >= durationMs) {
      break;
    }
    timestamps.push(next);
    current = next;
  }
  timestamps.push(durationMs);
  return timestamps;
}

/** 生成合成指标样本（多轮）；同一（档位、指标、轮次）结果确定。 */
export function syntheticSamples(
  metricId: MetricId,
  quality: SyntheticQuality,
  count: number,
  iteration = 0,
  seed: number = SYNTHETIC_SEED
): readonly number[] {
  const target = SAMPLE_TARGETS[quality][metricId];
  if (target === undefined) {
    throw new Error(`合成样本缺少目标定义：${quality}/${metricId}`);
  }
  const prng = mulberry32(deriveSeed(seed, `samples:${metricId}:${quality}`, iteration));
  return Array.from({ length: count }, () => jitter(prng, target.value, target.spreadPercent));
}

/**
 * 生成合成内存采样：前 `rampMs` 从起始值爬升到稳定值，其后稳定值抖动；
 * 总时长 660 s（覆盖 5 分钟门禁窗口与 60 s 快检窗口），采样间隔 5 s。
 */
export function syntheticMemorySamples(
  quality: SyntheticQuality,
  seed: number = SYNTHETIC_SEED
): readonly MemorySample[] {
  const prng = mulberry32(deriveSeed(seed, `memory:${quality}`, 0));
  const targets = MEMORY_TARGETS[quality];
  const rampMs = 60_000;
  const durationMs = 660_000;
  const intervalMs = 5_000;
  const samples: MemorySample[] = [];
  for (let at = 0; at <= durationMs; at += intervalMs) {
    const progress = Math.min(1, at / rampMs);
    const base = targets.startMb + (targets.stableMb - targets.startMb) * progress;
    const megabytes = jitter(prng, base, progress >= 1 ? 1 : 2);
    samples.push({ at, rssBytes: megabytes * BYTES_PER_MB });
  }
  return samples;
}

/** 生成 10 MB 卡片夹具：1 MiB ASCII YAML + 9 MiB 资源字节（确定性）。 */
export function syntheticCard10mbFixture(): ParseFixture {
  const yamlBytes = 1 * BYTES_PER_MB;
  const resourceBytes = 9 * BYTES_PER_MB;
  const totalBytes = yamlBytes + resourceBytes;
  const payload = new Uint8Array(totalBytes);
  payload.set(syntheticYamlPayload(yamlBytes), 0);
  for (let index = yamlBytes; index < totalBytes; index += 1) {
    payload[index] = (index * 31 + 7) % 251;
  }
  return {
    id: 'synthetic-card-10mb',
    title: '合成 10 MB 卡片（1 MB YAML + 9 MB 资源）',
    totalBytes,
    payload,
  };
}

/** 生成 10 000 条目箱子夹具（ASCII YAML 载荷，确定性）。 */
export function syntheticBox10kFixture(entryCount = 10_000): ParseFixture {
  const lines: string[] = ['entries:'];
  for (let index = 0; index < entryCount; index += 1) {
    lines.push(`  - entry_id: e${String(index).padStart(5, '0')}`);
    lines.push(`    url: ./notes/entry-${String(index).padStart(5, '0')}.card`);
    lines.push('    enabled: true');
  }
  const payload = new TextEncoder().encode(lines.join('\n'));
  return {
    id: `synthetic-box-${String(entryCount)}`,
    title: `合成 ${String(entryCount)} 条目箱子`,
    totalBytes: payload.byteLength,
    payload,
  };
}

/** 生成精确 `bytes` 长度的 ASCII YAML 载荷（确定性）。 */
export function syntheticYamlPayload(bytes: number): Uint8Array {
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new Error(`合成 YAML 载荷长度必须是正整数：${String(bytes)}`);
  }
  const header = 'chip_standards_version: 1.0\nnodes:\n';
  const chunk = Array.from(
    { length: 256 },
    (_, index) =>
      `  - node_${String(index).padStart(3, '0')}: value_${String(index).padStart(3, '0')}\n`
  ).join('');
  let text = header;
  while (text.length < bytes) {
    const remaining = bytes - text.length;
    text += remaining >= chunk.length ? chunk : chunk.slice(0, remaining);
  }
  const encoded = new TextEncoder().encode(text);
  return encoded.slice(0, bytes);
}

/** 计算载荷 SHA-256（自测用于确定性校验）。 */
export function payloadDigest(payload: Uint8Array): string {
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * 合成适配器：覆盖全部场景，按档位生成达标或劣化数据。
 *
 * 该适配器只用于工具自测；真实接入使用 W2 的 Host/RenderEngine/解析器适配器。
 */
export function createSyntheticAdapter(
  quality: SyntheticQuality,
  seed: number = SYNTHETIC_SEED
): PerfAdapter {
  return {
    id: `synthetic-${quality}`,
    title: `合成适配器（${quality === 'golden' ? '达标档' : '劣化档'}）`,
    description: '生成确定性的合成标记点、帧时间戳、内存采样与指标样本，用于性能工具自测',
    // 工单056 分流闸：合成臂显式登记 `synthetic` 形态，真测登记一律被拒绝。
    measurementForm: 'synthetic',
    provides: [...SCENARIO_IDS],
    run(context): Promise<AdapterRunResult> {
      const definition = scenarioDefinition(context.scenarioId);
      const base: AdapterRunResult = { notes: [SYNTHETIC_NOTE] };
      switch (definition.kind) {
        case 'markers':
          return Promise.resolve({
            ...base,
            markers: syntheticMarkers(context.scenarioId, quality, context.iteration, seed),
          });
        case 'frames':
          return Promise.resolve({
            ...base,
            frameTimestampsMs: syntheticFrameTimestamps(quality, 10_000, context.iteration, seed),
            metricSamples: {
              render_update_ms: syntheticSamples(
                'render_update_ms',
                quality,
                300,
                context.iteration,
                seed
              ),
            },
          });
        case 'memory':
          return Promise.resolve({ ...base, memorySamples: syntheticMemorySamples(quality, seed) });
        case 'samples': {
          const metricSamples: Partial<Record<MetricId, readonly number[]>> = {};
          for (const metricId of definition.metricIds) {
            metricSamples[metricId] = syntheticSamples(
              metricId,
              quality,
              5,
              context.iteration,
              seed
            );
          }
          return Promise.resolve({ ...base, metricSamples });
        }
      }
    },
  };
}
