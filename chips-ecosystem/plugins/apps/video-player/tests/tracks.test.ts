import { describe, expect, it } from 'vitest';
import { isSubtitleTextTrack, readAudioTracks, readSubtitleTracks } from '../src/player/useTracks';
import { isSurfaceFullscreen } from '../src/player/useFullscreen';

describe('轨道读取（迁移判例：旧仓 tests/unit/video-player-controller.test.ts）', () => {
  it('读取字幕轨道时只暴露 subtitles 与 captions，并保留选中状态', () => {
    const tracks = readSubtitleTracks({
      textTracks: {
        length: 4,
        0: { kind: 'subtitles', label: '简体中文', language: 'zh-CN', mode: 'showing' },
        1: { kind: 'metadata', label: 'Chapter', language: 'en', mode: 'hidden' },
        2: { kind: 'captions', label: 'English CC', language: 'en', mode: 'disabled' },
        3: { kind: 'descriptions', label: 'Descriptions', language: 'en', mode: 'disabled' },
      },
    });

    expect(tracks).toEqual([
      { index: 0, label: '简体中文', language: 'zh-CN', kind: 'subtitles', selected: true },
      { index: 2, label: 'English CC', language: 'en', kind: 'captions', selected: false },
    ]);
  });

  it('读取音频轨道时保留语言、类型和当前启用状态', () => {
    const tracks = readAudioTracks({
      audioTracks: {
        length: 2,
        0: { kind: 'main', label: 'Stereo', language: 'en', enabled: true },
        1: { kind: 'translation', label: '中文配音', language: 'zh-CN', enabled: false },
      },
    });

    expect(tracks).toEqual([
      { index: 0, label: 'Stereo', language: 'en', kind: 'main', selected: true },
      { index: 1, label: '中文配音', language: 'zh-CN', kind: 'translation', selected: false },
    ]);
  });

  it('无音频轨列表与缺字段轨道按空值收敛', () => {
    expect(readAudioTracks({})).toEqual([]);
    expect(readSubtitleTracks({ textTracks: { length: 1, 0: undefined } })).toEqual([]);
    expect(isSubtitleTextTrack({ kind: 'subtitles' })).toBe(true);
    expect(isSubtitleTextTrack({ kind: 'chapters' })).toBe(false);
  });
});

describe('全屏判定（迁移判例：旧仓 tests/unit/video-player-controller.test.ts）', () => {
  it('根据 fullscreenElement 恢复当前 surface 的全屏状态', () => {
    const surface = { nodeType: 1 } as Element;
    const otherSurface = { nodeType: 1 } as Element;

    expect(isSurfaceFullscreen(surface, surface)).toBe(true);
    expect(isSurfaceFullscreen(otherSurface, surface)).toBe(false);
    expect(isSurfaceFullscreen(null, surface)).toBe(false);
    expect(isSurfaceFullscreen(surface, null)).toBe(false);
  });
});
