import { describe, expect, it } from 'vitest';
import {
  PLAYBACK_RATES,
  SUPPORTED_VIDEO_EXTENSIONS,
  clampPlaybackTime,
  clampVolume,
  createVideoSourceFromUri,
  formatDuration,
  formatPlaybackRate,
  formatResolution,
  inferVideoMimeType,
  isDirectPlayableUri,
  isSupportedVideoResource,
  normalizeVideoPlaybackOpenHints,
  resolveExtension,
  resolveFileName,
  resolveMediaErrorKey,
  resolveVideoFormatLabel,
  resolveVideoTitle,
  shouldAutoHideChrome,
} from '../src/player/videoPlayer';

describe('视频格式表与播放参数（迁移判例：旧仓 tests/unit/video-player.test.ts）', () => {
  it('按扩展名与 MIME 判定受支持的视频资源', () => {
    expect(isSupportedVideoResource({ sourceId: '/tmp/demo.mp4' })).toBe(true);
    expect(isSupportedVideoResource({ sourceId: 'https://example.com/demo.webm' })).toBe(true);
    expect(isSupportedVideoResource({ sourceId: 'chips-resource://video/1', mimeType: 'video/mp4' })).toBe(true);
    expect(isSupportedVideoResource({ sourceId: '/tmp/demo.txt' })).toBe(false);
    expect(SUPPORTED_VIDEO_EXTENSIONS).toEqual(['.mp4', '.webm', '.mov', '.m4v', '.ogv']);
  });

  it('判定可直播 URI 与解析文件名', () => {
    expect(isDirectPlayableUri('https://example.com/demo.mp4')).toBe(true);
    expect(isDirectPlayableUri('blob:https://example.com/token')).toBe(true);
    expect(isDirectPlayableUri('file:///tmp/demo.mp4')).toBe(true);
    expect(isDirectPlayableUri('/tmp/demo.mp4')).toBe(false);
    expect(resolveFileName('/tmp/video/demo.mov')).toBe('demo.mov');
    expect(resolveFileName('https://example.com/video/demo.webm')).toBe('demo.webm');
    expect(resolveExtension('/tmp/Clip.MP4')).toBe('.mp4');
  });

  it('格式化播放标签并钳制数值', () => {
    expect(formatDuration(5)).toBe('00:05');
    expect(formatDuration(3725)).toBe('01:02:05');
    expect(formatPlaybackRate(1.25)).toBe('1.25x');
    expect(formatPlaybackRate(1)).toBe('1x');
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
    expect(clampPlaybackTime(16, 12)).toBe(12);
    expect(clampPlaybackTime(-4, 12)).toBe(0);
    expect(PLAYBACK_RATES).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
  });

  it('推断标题、MIME 与分辨率文案', () => {
    expect(resolveVideoTitle({ sourceId: '/tmp/demo.ogv', title: '演示视频' })).toBe('演示视频');
    expect(resolveVideoTitle({ sourceId: '/tmp/demo.ogv' })).toBe('demo.ogv');
    expect(inferVideoMimeType('/tmp/demo.webm')).toBe('video/webm');
    expect(resolveVideoFormatLabel('/tmp/demo.webm')).toBe('WEBM');
    expect(resolveVideoFormatLabel('chips-resource://video/1', 'video/x-m4v')).toBe('M4V');
    expect(formatResolution({ width: 1920, height: 1080 })).toBe('1920 × 1080');
    expect(formatResolution(null)).toBe('');
  });

  it('按卡片文件格式 §6.2 playback 段归一播放入口参数', () => {
    expect(
      normalizeVideoPlaybackOpenHints({
        autoplay: true,
        loop: true,
        muted: true,
        playback_rate: 1.25,
        start_time: 12,
      }),
    ).toEqual({
      autoplay: true,
      loop: true,
      muted: true,
      playbackRate: 1.25,
      startTime: 12,
    });

    expect(
      normalizeVideoPlaybackOpenHints({
        autoplay: true,
        loop: false,
        muted: false,
        playback_rate: 1.1,
        start_time: -3,
      }),
    ).toEqual({
      autoplay: true,
      loop: false,
      muted: false,
      playbackRate: 1,
      startTime: 0,
    });

    expect(normalizeVideoPlaybackOpenHints(undefined)).toEqual({
      autoplay: false,
      loop: false,
      muted: false,
      playbackRate: 1,
      startTime: 0,
    });
  });

  it('媒体错误码映射到稳定错误键', () => {
    expect(resolveMediaErrorKey({ code: 1 } as MediaError)).toBe('mediaAborted');
    expect(resolveMediaErrorKey({ code: 2 } as MediaError)).toBe('mediaNetwork');
    expect(resolveMediaErrorKey({ code: 3 } as MediaError)).toBe('mediaDecode');
    expect(resolveMediaErrorKey({ code: 4 } as MediaError)).toBe('mediaSource');
    expect(resolveMediaErrorKey({ code: 99 } as MediaError)).toBe('loadFailed');
    expect(resolveMediaErrorKey(null)).toBe('mediaSource');
  });

  it('仅在不被打断的播放状态下自动隐藏控制层', () => {
    expect(
      shouldAutoHideChrome({
        hasVideo: true,
        isPlaying: true,
        isMorePanelOpen: false,
        isDragActive: false,
        hasOverlay: false,
      }),
    ).toBe(true);

    expect(
      shouldAutoHideChrome({
        hasVideo: true,
        isPlaying: true,
        isMorePanelOpen: true,
        isDragActive: false,
        hasOverlay: false,
      }),
    ).toBe(false);

    expect(
      shouldAutoHideChrome({
        hasVideo: false,
        isPlaying: false,
        isMorePanelOpen: false,
        isDragActive: false,
        hasOverlay: false,
      }),
    ).toBe(false);
  });

  it('由可直接播放的 URI 构建播放会话来源，拒绝不可直播 URI', () => {
    const source = createVideoSourceFromUri('https://example.com/media/教学演示.mp4');
    expect(source).not.toBeNull();
    expect(source?.resourceUri).toBe('https://example.com/media/教学演示.mp4');
    expect(source?.fileName).toBe('教学演示.mp4');
    expect(source?.title).toBe('教学演示.mp4');
    expect(source?.mimeType).toBe('video/mp4');
    expect(source?.extension).toBe('.mp4');
    expect(source?.isRemote).toBe(true);
    expect(source?.revision).toBe(1);

    const local = createVideoSourceFromUri('file:///media/library/demo.webm');
    expect(local?.fileName).toBe('demo.webm');
    expect(local?.mimeType).toBe('video/webm');
    expect(local?.isRemote).toBe(false);

    expect(createVideoSourceFromUri('/tmp/demo.mp4')).toBeNull();
    expect(createVideoSourceFromUri('   ')).toBeNull();
  });
});
