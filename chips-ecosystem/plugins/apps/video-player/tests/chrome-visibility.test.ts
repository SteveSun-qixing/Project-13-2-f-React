// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_AUTO_HIDE_DELAY_MS,
  shouldAutoHideChrome,
  useChromeVisibility,
} from '../src/player/useChromeVisibility';

describe('useChromeVisibility（迁移判例：控制层自动隐藏）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('默认延迟常量为 2200ms', () => {
    expect(DEFAULT_AUTO_HIDE_DELAY_MS).toBe(2200);
  });

  it('不打断的播放状态下按延迟隐藏，reveal 重置计时', () => {
    const { result, rerender } = renderHook(() =>
      useChromeVisibility({
        state: { hasVideo: true, isPlaying: true, isMorePanelOpen: false, isDragActive: false, hasOverlay: false },
      }),
    );
    expect(result.current.visible).toBe(true);

    act(() => {
      vi.advanceTimersByTime(DEFAULT_AUTO_HIDE_DELAY_MS);
    });
    expect(result.current.visible).toBe(false);

    rerender();

    act(() => {
      result.current.reveal();
    });
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(DEFAULT_AUTO_HIDE_DELAY_MS - 1);
    });
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.visible).toBe(false);
  });

  it('播放暂停、面板打开等打断态立即恢复可见', () => {
    const { result, rerender } = renderHook(
      ({ isPlaying }: { isPlaying: boolean }) =>
        useChromeVisibility({
          state: { hasVideo: true, isPlaying, isMorePanelOpen: false, isDragActive: false, hasOverlay: false },
        }),
      { initialProps: { isPlaying: true } },
    );

    act(() => {
      vi.advanceTimersByTime(DEFAULT_AUTO_HIDE_DELAY_MS);
    });
    expect(result.current.visible).toBe(false);

    rerender({ isPlaying: false });
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(DEFAULT_AUTO_HIDE_DELAY_MS * 3);
    });
    expect(result.current.visible).toBe(true);
  });

  it('toggle 手动显隐：隐态切换后重新计时', () => {
    const { result } = renderHook(() =>
      useChromeVisibility({
        state: { hasVideo: true, isPlaying: true, isMorePanelOpen: false, isDragActive: false, hasOverlay: false },
        autoHideDelayMs: 1000,
      }),
    );

    act(() => {
      result.current.toggle();
    });
    expect(result.current.visible).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.visible).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.visible).toBe(false);
  });

  it('shouldAutoHideChrome 与迁移纯函数一致', () => {
    expect(
      shouldAutoHideChrome({ hasVideo: true, isPlaying: true, isMorePanelOpen: false, isDragActive: false, hasOverlay: false }),
    ).toBe(true);
    expect(
      shouldAutoHideChrome({ hasVideo: true, isPlaying: true, isMorePanelOpen: false, isDragActive: true, hasOverlay: false }),
    ).toBe(false);
    expect(
      shouldAutoHideChrome({ hasVideo: true, isPlaying: true, isMorePanelOpen: false, isDragActive: false, hasOverlay: true }),
    ).toBe(false);
  });
});
