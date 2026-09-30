// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { SyntheticEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createPlaybackState, usePlaybackEngine } from '../src/player/usePlaybackEngine';
import { DEFAULT_PREFERENCES } from '../src/player/preferences';

/** 测试媒体元素：在 HTMLVideoElement 之上放开测试所需的可写字段。 */
type MutableVideo = HTMLVideoElement & {
  paused: boolean;
  muted: boolean;
  volume: number;
  duration: number;
  currentTime: number;
  playbackRate: number;
  loop: boolean;
  videoWidth: number;
  videoHeight: number;
  error: MediaError | null;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
};

function createMockVideo(): { element: MutableVideo; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> } {
  const play = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn();
  const element = {
    paused: true,
    muted: false,
    volume: 0.85,
    duration: 120,
    currentTime: 0,
    playbackRate: 1,
    loop: false,
    videoWidth: 0,
    videoHeight: 0,
    error: null,
    buffered: { length: 0 },
    textTracks: {
      length: 0,
      addEventListener: (): void => undefined,
      removeEventListener: (): void => undefined,
    },
    play,
    pause,
  } as unknown as MutableVideo;
  return { element, play, pause };
}

describe('createPlaybackState（迁移判例）', () => {
  it('偏好参与初始状态，载荷 muted 优先且音量归零', () => {
    const state = createPlaybackState({ autoplay: false, loop: true, muted: true, playbackRate: 1.5, startTime: 9 }, {
      ...DEFAULT_PREFERENCES,
      volume: 0.4,
      loop: false,
      playbackRate: 0.75,
    });
    expect(state.volume).toBe(0);
    expect(state.isMuted).toBe(true);
    expect(state.playbackRate).toBe(1.5);
    expect(state.loop).toBe(true);

    const fallback = createPlaybackState(undefined, { ...DEFAULT_PREFERENCES, volume: 0.4, playbackRate: 0.75 });
    expect(fallback.volume).toBe(0.4);
    expect(fallback.playbackRate).toBe(0.75);
    expect(fallback.loop).toBe(false);
  });

  it('倍速不在白名单时回退 1', () => {
    const state = createPlaybackState({ autoplay: false, loop: false, muted: false, playbackRate: 3, startTime: 0 });
    expect(state.playbackRate).toBe(1);
  });
});

describe('usePlaybackEngine 播放会话', () => {
  it('ended 后 isEnded 置位，commitSeek 后复位', () => {
    const { element: video } = createMockVideo();
    const videoRef = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => usePlaybackEngine({ sessionKey: 's1', videoRef }));
    videoRef.current = video;

    act(() => {
      result.current.handleEnded();
    });
    expect(result.current.state.isEnded).toBe(true);

    act(() => {
      result.current.commitSeek(10);
    });
    expect(result.current.state.isEnded).toBe(false);
    expect(video.currentTime).toBe(10);
  });

  it('seekPreviewTo 只更新进度不写 video.currentTime', () => {
    const { element: video } = createMockVideo();
    const videoRef = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => usePlaybackEngine({ sessionKey: 's2', videoRef }));
    videoRef.current = video;

    act(() => {
      result.current.seekPreviewTo(42);
    });
    expect(video.currentTime).toBe(0);
    expect(result.current.state.currentTime).toBe(42);

    act(() => {
      result.current.commitSeek(42);
    });
    expect(video.currentTime).toBe(42);
  });

  it('commitSeek 超出时长时钳制', () => {
    const { element: video } = createMockVideo();
    const videoRef = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => usePlaybackEngine({ sessionKey: 's3', videoRef }));
    videoRef.current = video;

    act(() => {
      result.current.commitSeek(999);
    });
    expect(video.currentTime).toBe(120);

    act(() => {
      result.current.commitSeek(-30);
    });
    expect(video.currentTime).toBe(0);
  });

  it('seekBy 按偏移提交', () => {
    const { element: video } = createMockVideo();
    video.currentTime = 20;
    const videoRef = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => usePlaybackEngine({ sessionKey: 's4', videoRef }));
    videoRef.current = video;

    act(() => {
      result.current.seekBy(5);
    });
    expect(video.currentTime).toBe(25);

    act(() => {
      result.current.seekBy(-30);
    });
    expect(video.currentTime).toBe(0);
  });

  it('音量钳制并联动静音，toggleMute 切换', () => {
    const { element: video } = createMockVideo();
    const videoRef = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => usePlaybackEngine({ sessionKey: 's5', videoRef }));
    videoRef.current = video;

    act(() => {
      result.current.setVolumeLevel(2);
    });
    expect(video.volume).toBe(1);
    expect(video.muted).toBe(false);
    expect(result.current.state.volume).toBe(1);
    expect(result.current.state.isMuted).toBe(false);

    act(() => {
      result.current.setVolumeLevel(0);
    });
    expect(video.muted).toBe(true);
    expect(result.current.state.isMuted).toBe(true);

    act(() => {
      result.current.toggleMute();
    });
    expect(video.muted).toBe(false);
    expect(result.current.state.isMuted).toBe(false);
  });

  it('倍速非白名单值归一为 1，白名单值写入媒体元素', () => {
    const { element: video } = createMockVideo();
    const videoRef = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => usePlaybackEngine({ sessionKey: 's6', videoRef }));
    videoRef.current = video;

    act(() => {
      result.current.setPlaybackRate(1.5);
    });
    expect(video.playbackRate).toBe(1.5);
    expect(result.current.state.playbackRate).toBe(1.5);

    act(() => {
      result.current.setPlaybackRate(4);
    });
    expect(video.playbackRate).toBe(1);
    expect(result.current.state.playbackRate).toBe(1);
  });

  it('toggleLoop 翻转并同步媒体元素', () => {
    const { element: video } = createMockVideo();
    const videoRef = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => usePlaybackEngine({ sessionKey: 's7', videoRef }));
    videoRef.current = video;

    act(() => {
      result.current.toggleLoop();
    });
    expect(video.loop).toBe(true);
    expect(result.current.state.loop).toBe(true);
  });

  it('togglePlayback：暂停态请求播放，播放态调用 pause；播放拒绝时归一错误键', async () => {
    const { element: video, play, pause } = createMockVideo();
    const videoRef = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => usePlaybackEngine({ sessionKey: 's8', videoRef }));
    videoRef.current = video;

    await act(async () => {
      await result.current.togglePlayback();
    });
    expect(play).toHaveBeenCalledTimes(1);

    video.paused = false;
    await act(async () => {
      await result.current.togglePlayback();
    });
    expect(pause).toHaveBeenCalled();

    const rejecting = createMockVideo();
    rejecting.element.play = vi.fn().mockRejectedValue(new DOMException('interrupted', 'AbortError'));
    const refB = { current: null as HTMLVideoElement | null };
    const renderedB = renderHook(() => usePlaybackEngine({ sessionKey: 's9', videoRef: refB }));
    refB.current = rejecting.element;
    await act(async () => {
      await renderedB.result.current.togglePlayback();
    });
    expect(renderedB.result.current.state.errorKey).toBe('mediaSource');
  });

  it('handleLoadedMetadata 记录尺寸与时长，handleError 归一错误键', () => {
    const { element: video } = createMockVideo();
    video.videoWidth = 1920;
    video.videoHeight = 1080;
    const videoRef = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => usePlaybackEngine({ sessionKey: 's10', videoRef }));
    videoRef.current = video;

    act(() => {
      result.current.handleLoadedMetadata({ currentTarget: video } as unknown as SyntheticEvent<HTMLVideoElement>);
    });
    expect(result.current.state.videoSize).toEqual({ width: 1920, height: 1080 });
    expect(result.current.state.duration).toBe(120);

    const mediaError = { code: 2 } as MediaError;
    video.error = mediaError;
    act(() => {
      result.current.handleError();
    });
    expect(result.current.state.errorKey).toBe('mediaNetwork');
    expect(result.current.state.isPlaying).toBe(false);
  });
});

describe('会话复位与偏好参与（迁移判例）', () => {
  it('无 video 引用时引擎返回空会话动作不抛错', async () => {
    const videoRef = { current: null as HTMLVideoElement | null };
    const { result } = renderHook(() => usePlaybackEngine({ sessionKey: 'empty', videoRef }));
    await act(async () => {
      await result.current.togglePlayback();
    });
    act(() => {
      result.current.commitSeek(3);
      result.current.setVolumeLevel(0.5);
      result.current.toggleMute();
      result.current.setPlaybackRate(2);
      result.current.toggleLoop();
    });
    expect(result.current.state.duration).toBe(0);
    expect(result.current.state.volume).toBe(DEFAULT_PREFERENCES.volume);
  });
});
