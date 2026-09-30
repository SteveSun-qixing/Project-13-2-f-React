import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMusicPlayerController } from '../src/player/useMusicPlayerController';
import type { AudioElementLike } from '../src/player/audioEngine';

/**
 * 播放器元素绑定控制器判例（迁移件 hook）。
 * 以 AudioElementLike 桩挂入 audioRef，验证引擎绑定与会话复位随 sessionKey 触发。
 */

interface FakeAudio extends AudioElementLike {
  playCalls: number;
  pauseCalls: number;
}

function createFakeAudio(initial: Partial<AudioElementLike> = {}): FakeAudio {
  let paused = initial.paused ?? true;
  return {
    get paused() {
      return paused;
    },
    currentTime: initial.currentTime ?? 0,
    get duration() {
      return initial.duration ?? 0;
    },
    volume: initial.volume ?? 1,
    muted: initial.muted ?? false,
    loop: initial.loop ?? false,
    get buffered() {
      return initial.buffered ?? null;
    },
    get error() {
      return initial.error ?? null;
    },
    playCalls: 0,
    pauseCalls: 0,
    play(): Promise<void> {
      this.playCalls += 1;
      paused = false;
      return Promise.resolve();
    },
    pause() {
      this.pauseCalls += 1;
      paused = true;
    },
  };
}

describe('useMusicPlayerController（迁移件 hook）', () => {
  it('绑定 audioRef 元素后播放暂停经引擎推进', async () => {
    const audio = createFakeAudio();
    const { result, rerender } = renderHook(() => useMusicPlayerController({ sessionKey: 'a#1' }));

    act(() => {
      // 元素挂载由舞台承担；测试直接注入引用后触发重装配（attach effect 随渲染执行）。
      (result.current.audioRef as { current: AudioElementLike | null }).current = audio;
    });
    rerender();

    await act(async () => {
      await result.current.togglePlayback();
    });
    // playing 事件由浏览器媒体栈派发；测试环境显式注入引擎事件（迁移判例口径）。
    act(() => {
      result.current.handlePlaying();
    });
    expect(audio.playCalls).toBe(1);
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.volume).toBe(0.82);
    expect(result.current.loopMode).toBe('one');
  });

  it('sessionKey 变化触发会话复位（进度清零、音量保留）', () => {
    const audio = createFakeAudio({ duration: 120, currentTime: 30 });
    const { result, rerender } = renderHook(
      ({ sessionKey }: { sessionKey: string }) => useMusicPlayerController({ sessionKey }),
      { initialProps: { sessionKey: 'a#1' } },
    );

    act(() => {
      (result.current.audioRef as { current: AudioElementLike | null }).current = audio;
    });
    rerender({ sessionKey: 'a#1' });
    act(() => {
      result.current.handleTimeUpdate();
    });
    expect(result.current.currentTime).toBe(30);

    act(() => {
      result.current.setVolumeLevel(0.4);
    });
    rerender({ sessionKey: 'b#1' });

    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.volume).toBe(0.4);
  });

  it('音量/静音/循环经引擎同步到元素', () => {
    const audio = createFakeAudio();
    const { result, rerender } = renderHook(() => useMusicPlayerController({ sessionKey: null }));

    act(() => {
      (result.current.audioRef as { current: AudioElementLike | null }).current = audio;
    });
    rerender();

    act(() => {
      result.current.setVolumeLevel(0.6);
    });
    act(() => {
      result.current.toggleMute();
    });
    act(() => {
      result.current.toggleLoopMode();
    });

    expect(audio.volume).toBe(0.6);
    expect(audio.muted).toBe(true);
    expect(audio.loop).toBe(false);
  });
});
