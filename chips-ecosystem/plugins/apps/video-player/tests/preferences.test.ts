// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createVideoPlayerPreferenceStore, DEFAULT_PREFERENCES } from '../src/player/preferences';

describe('视频播放器偏好存储（config:* 降级内存态判例）', () => {
  it('新存储返回默认值', () => {
    const store = createVideoPlayerPreferenceStore();
    expect(store.read()).toEqual(DEFAULT_PREFERENCES);
  });

  it('写入并读回偏好', () => {
    const store = createVideoPlayerPreferenceStore();
    store.write({ volume: 0.5, muted: true, playbackRate: 1.5, loop: true, subtitleIndex: 2 });
    const prefs = store.read();
    expect(prefs.volume).toBe(0.5);
    expect(prefs.muted).toBe(true);
    expect(prefs.playbackRate).toBe(1.5);
    expect(prefs.loop).toBe(true);
    expect(prefs.subtitleIndex).toBe(2);
  });

  it('音量越界时钳制到 [0,1]', () => {
    const store = createVideoPlayerPreferenceStore();
    store.write({ volume: 99 });
    expect(store.read().volume).toBe(1);
    store.write({ volume: -1 });
    expect(store.read().volume).toBe(0);
  });

  it('倍速不在白名单时回退默认值', () => {
    const store = createVideoPlayerPreferenceStore();
    store.write({ playbackRate: 1.1 });
    expect(store.read().playbackRate).toBe(1);
    store.write({ playbackRate: 0.75 });
    expect(store.read().playbackRate).toBe(0.75);
  });

  it('非法字段类型不污染既有偏好', () => {
    const store = createVideoPlayerPreferenceStore();
    store.write({ volume: 0.3, loop: true });
    store.write({ volume: Number.NaN, loop: 'yes' as unknown as boolean });
    const prefs = store.read();
    expect(prefs.volume).toBe(0.3);
    expect(prefs.loop).toBe(true);
    expect(prefs.muted).toBe(DEFAULT_PREFERENCES.muted);
  });

  it('各存储实例相互隔离', () => {
    const a = createVideoPlayerPreferenceStore();
    const b = createVideoPlayerPreferenceStore();
    a.write({ volume: 0.2 });
    expect(b.read().volume).toBe(DEFAULT_PREFERENCES.volume);
  });
});
