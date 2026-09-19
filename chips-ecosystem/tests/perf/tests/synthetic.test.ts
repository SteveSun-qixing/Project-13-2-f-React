import { describe, expect, it } from 'vitest';
import { timelineFromMarkers } from '../src/markers';
import {
  createSyntheticAdapter,
  deriveSeed,
  mulberry32,
  payloadDigest,
  syntheticBox10kFixture,
  syntheticCard10mbFixture,
  syntheticFrameTimestamps,
  syntheticMarkers,
  syntheticMemorySamples,
  syntheticSamples,
  syntheticYamlPayload,
  SYNTHETIC_NOTE,
} from '../src/fixtures/synthetic';

describe('合成数据（fixtures/synthetic）', () => {
  it('PRNG 与派生种子确定性', () => {
    const first = Array.from({ length: 5 }, mulberry32(42));
    const second = Array.from({ length: 5 }, mulberry32(42));
    expect(first).toEqual(second);
    expect(deriveSeed(1, 'a', 0)).toBe(deriveSeed(1, 'a', 0));
    expect(deriveSeed(1, 'a', 0)).not.toBe(deriveSeed(1, 'a', 1));
  });

  it('10 MB 卡片夹具：字节数精确、确定性一致', () => {
    const fixture = syntheticCard10mbFixture();
    expect(fixture.totalBytes).toBe(10 * 1024 * 1024);
    expect(fixture.payload.byteLength).toBe(10 * 1024 * 1024);
    expect(payloadDigest(syntheticCard10mbFixture().payload)).toBe(payloadDigest(fixture.payload));
  });

  it('10 000 条目箱子夹具条目数正确', () => {
    const fixture = syntheticBox10kFixture();
    const text = new TextDecoder().decode(fixture.payload);
    expect(text.startsWith('entries:\n')).toBe(true);
    expect(text.match(/entry_id:/g)).toHaveLength(10_000);
  });

  it('YAML 载荷长度精确且为 ASCII', () => {
    const payload = syntheticYamlPayload(4096);
    expect(payload.byteLength).toBe(4096);
    expect(payload.every((byte) => byte < 128)).toBe(true);
  });

  it('合成标记点确定且构成合法时间线', () => {
    const markers = syntheticMarkers('open-card', 'golden', 0);
    const timeline = timelineFromMarkers(markers);
    expect(
      timeline.duration({ from: 'render:open-called', to: 'render:first-frame-commit' })
    ).toBeGreaterThan(0);
    expect(JSON.stringify(syntheticMarkers('open-card', 'golden', 0))).toBe(
      JSON.stringify(markers)
    );
    expect(JSON.stringify(syntheticMarkers('open-card', 'golden', 1))).not.toBe(
      JSON.stringify(markers)
    );
  });

  it('合成帧时间戳严格递增且总时长固定', () => {
    const timestamps = syntheticFrameTimestamps('golden');
    expect(timestamps[0]).toBe(0);
    expect(timestamps[timestamps.length - 1]).toBe(10_000);
    for (let index = 1; index < timestamps.length; index += 1) {
      expect((timestamps[index] ?? 0) > (timestamps[index - 1] ?? 0)).toBe(true);
    }
  });

  it('合成内存采样覆盖 5 分钟窗口', () => {
    const samples = syntheticMemorySamples('golden');
    const last = samples[samples.length - 1];
    expect(last?.at).toBe(660_000);
    expect(samples.length).toBeGreaterThan(100);
  });

  it('合成样本数量与档位差异', () => {
    const golden = syntheticSamples('parse_10mb_ms', 'golden', 5);
    const regressed = syntheticSamples('parse_10mb_ms', 'regressed', 5);
    expect(golden).toHaveLength(5);
    expect(Math.max(...golden)).toBeLessThan(Math.min(...regressed));
  });

  it('合成适配器覆盖全部场景并标注合成数据', async () => {
    const adapter = createSyntheticAdapter('golden');
    expect(adapter.provides.length).toBeGreaterThanOrEqual(10);
    const result = await adapter.run({ scenarioId: 'open-card', iteration: 0 });
    expect(result.notes).toContain(SYNTHETIC_NOTE);
    expect(result.markers?.length).toBeGreaterThan(0);
    const frames = await adapter.run({ scenarioId: 'scroll-fps', iteration: 0 });
    expect(frames.frameTimestampsMs?.length).toBeGreaterThan(0);
  });
});
