// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVideoPlayerController } from '../src/player/useVideoPlayerController';
import { createVideoSourceFromUri, type VideoSource } from '../src/player/videoPlayer';
import { createVideoPlayerPreferenceStore, DEFAULT_PREFERENCES, type VideoPlayerPreferenceStore } from '../src/player/preferences';

interface MockVideo {
  raw: {
    paused: boolean;
    muted: boolean;
    volume: number;
    duration: number;
    currentTime: number;
    playbackRate: number;
    loop: boolean;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
  };
  element: HTMLVideoElement;
}

function createMockVideo(): MockVideo {
  const raw = {
    paused: true,
    muted: false,
    volume: 0.85,
    duration: 120,
    currentTime: 0,
    playbackRate: 1,
    loop: false,
    error: null,
    buffered: { length: 0 },
    textTracks: {
      length: 0,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined,
    },
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
  };
  const element = raw as unknown as HTMLVideoElement;
  return { raw, element };
}

interface RenderControllerOptions {
  source: VideoSource | null;
  preferenceStore?: VideoPlayerPreferenceStore;
  attachVideo?: boolean;
}

interface RenderControllerResult {
  result: { current: ReturnType<typeof useVideoPlayerController> };
  rerender: (props: { src: VideoSource | null }) => void;
  unmount: () => void;
  video: HTMLVideoElement;
  raw: MockVideo['raw'];
}

function renderController({ source, preferenceStore, attachVideo = true }: RenderControllerOptions): RenderControllerResult {
  const { raw, element } = createMockVideo();
  const rendered = renderHook(
    ({ src }: { src: VideoSource | null }) =>
      useVideoPlayerController({
        source: src,
        ...(preferenceStore !== undefined ? { preferenceStore } : {}),
      }),
    { initialProps: { src: source } },
  );
  if (attachVideo) {
    rendered.result.current.videoRef.current = element;
  }
  return { ...rendered, video: element, raw };
}

describe('useVideoPlayerController（重写件装配判例）', () => {
  it('空态暴露空会话，未挂载媒体元素时空转不抛错', async () => {
    const { result, raw } = renderController({ source: null, attachVideo: false, preferenceStore: createVideoPlayerPreferenceStore() });
    expect(result.current.sessionKey).toBeNull();
    expect(result.current.volume).toBe(DEFAULT_PREFERENCES.volume);
    await act(async () => {
      await result.current.togglePlayback();
    });
    expect(raw.play).not.toHaveBeenCalled();
  });

  it('会话键由来源与修订号构成', () => {
    const source = createVideoSourceFromUri('file:///media/demo.mp4');
    const store = createVideoPlayerPreferenceStore();
    const { result, rerender } = renderHook(
      ({ src }: { src: VideoSource | null }) => useVideoPlayerController({ source: src, preferenceStore: store }),
      { initialProps: { src: source } },
    );
    expect(result.current.sessionKey).toBe('file:///media/demo.mp4#1');
    const revised: VideoSource = { ...(source as VideoSource), revision: 2 };
    rerender({ src: revised });
    expect(result.current.sessionKey).toBe('file:///media/demo.mp4#2');
    rerender({ src: null });
    expect(result.current.sessionKey).toBeNull();
  });

  it('音量调整写回注入的偏好存储，新会话按上次偏好起播', () => {
    const source = createVideoSourceFromUri('file:///media/demo.mp4');
    const store = createVideoPlayerPreferenceStore();
    const first = renderController({ source, preferenceStore: store });
    act(() => {
      first.result.current.setVolumeLevel(0.3);
    });
    expect(first.result.current.volume).toBe(0.3);
    expect(store.read().volume).toBe(0.3);

    const second = renderController({ source, preferenceStore: store });
    expect(second.result.current.volume).toBe(0.3);
  });

  it('载荷入口参数优先于用户偏好（muted 提权且音量归零）', () => {
    const base = createVideoSourceFromUri('file:///media/demo.mp4') as VideoSource;
    const source: VideoSource = {
      ...base,
      playbackHints: { autoplay: false, loop: false, muted: true, playbackRate: 1.25, startTime: 5 },
    };
    const store = createVideoPlayerPreferenceStore();
    store.write({ muted: false, volume: 0.6, playbackRate: 0.75 });
    const { result } = renderController({ source, preferenceStore: store });
    expect(result.current.isMuted).toBe(true);
    expect(result.current.volume).toBe(0);
    expect(result.current.playbackRate).toBe(1.25);
  });

  it('seekToFraction 按当前时长比例提交并钳制', () => {
    const source = createVideoSourceFromUri('file:///media/demo.mp4');
    const { result, video } = renderController({ source, preferenceStore: createVideoPlayerPreferenceStore() });

    act(() => {
      result.current.seekToFraction(0.5);
    });
    expect(video.currentTime).toBe(60);

    Object.defineProperty(video, 'duration', { value: 200, configurable: true });
    act(() => {
      result.current.seekToFraction(0.5);
    });
    expect(video.currentTime).toBe(100);

    act(() => {
      result.current.seekToFraction(2);
    });
    expect(video.currentTime).toBe(200);
  });

  it('cyclePlaybackRate 在白名单序列内轮转', () => {
    const source = createVideoSourceFromUri('file:///media/demo.mp4');
    const { result } = renderController({ source, preferenceStore: createVideoPlayerPreferenceStore() });
    act(() => {
      result.current.setPlaybackRate(1.5);
    });
    act(() => {
      result.current.cyclePlaybackRate();
    });
    expect(result.current.playbackRate).toBe(2);
    act(() => {
      result.current.cyclePlaybackRate();
    });
    expect(result.current.playbackRate).toBe(0.5);
  });

  it('帧步进在播放中先暂停，再按 1/24 秒偏移提交', () => {
    const source = createVideoSourceFromUri('file:///media/demo.mp4');
    const { result, video, raw } = renderController({ source, preferenceStore: createVideoPlayerPreferenceStore() });
    Object.defineProperty(video, 'duration', { value: 120, configurable: true });
    video.currentTime = 10;
    raw.paused = false;

    act(() => {
      result.current.frameStep('forward');
    });
    expect(raw.pause).toHaveBeenCalled();
    expect(video.currentTime).toBeCloseTo(10 + 1 / 24, 10);

    act(() => {
      result.current.frameStep('backward');
    });
    expect(video.currentTime).toBeCloseTo(10, 10);
  });

  it('静音切换回写偏好存储', () => {
    const source = createVideoSourceFromUri('file:///media/demo.mp4');
    const store = createVideoPlayerPreferenceStore();
    const { result } = renderController({ source, preferenceStore: store });
    act(() => {
      result.current.toggleMute();
    });
    expect(result.current.isMuted).toBe(true);
    expect(store.read().muted).toBe(true);
  });
});
