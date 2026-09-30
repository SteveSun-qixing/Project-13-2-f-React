// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FRAME_STEP_SECONDS, isEditableTarget, usePlayerKeyboard, type PlayerKeyboardActions } from '../src/player/usePlayerKeyboard';

function createActions(): PlayerKeyboardActions & Record<keyof PlayerKeyboardActions, ReturnType<typeof vi.fn>> {
  return {
    togglePlayback: vi.fn(),
    seekBy: vi.fn(),
    seekToFraction: vi.fn(),
    adjustVolume: vi.fn(),
    toggleMute: vi.fn(),
    toggleFullscreen: vi.fn(),
    togglePictureInPicture: vi.fn(),
    openKeyHelp: vi.fn(),
    toggleChrome: vi.fn(),
    frameStep: vi.fn(),
  };
}

function fireKey(key: string, init?: Partial<{ shiftKey: boolean }>): ReactKeyboardEvent<HTMLElement> {
  return {
    key,
    shiftKey: init?.shiftKey ?? false,
    preventDefault: vi.fn(),
    target: null,
  } as unknown as ReactKeyboardEvent<HTMLElement>;
}

describe('usePlayerKeyboard（迁移判例：媒体键位语义）', () => {
  it('空格/K 触发播放切换', () => {
    const actions = createActions();
    const { result } = renderHook(() => usePlayerKeyboard(actions));
    act(() => {
      result.current.handleKeyDown(fireKey(' '));
      result.current.handleKeyDown(fireKey('k'));
      result.current.handleKeyDown(fireKey('K'));
    });
    expect(actions.togglePlayback).toHaveBeenCalledTimes(3);
  });

  it('左右方向键按 5 秒，Shift 组合按 30 秒，J/L 按 10 秒', () => {
    const actions = createActions();
    const { result } = renderHook(() => usePlayerKeyboard(actions));
    act(() => {
      result.current.handleKeyDown(fireKey('ArrowLeft'));
      result.current.handleKeyDown(fireKey('ArrowRight', { shiftKey: true }));
      result.current.handleKeyDown(fireKey('j'));
      result.current.handleKeyDown(fireKey('L'));
    });
    expect(actions.seekBy).toHaveBeenNthCalledWith(1, -5);
    expect(actions.seekBy).toHaveBeenNthCalledWith(2, 30);
    expect(actions.seekBy).toHaveBeenNthCalledWith(3, -10);
    expect(actions.seekBy).toHaveBeenNthCalledWith(4, 10);
  });

  it('上下方向键调节音量，M 切换静音', () => {
    const actions = createActions();
    const { result } = renderHook(() => usePlayerKeyboard(actions));
    act(() => {
      result.current.handleKeyDown(fireKey('ArrowUp'));
      result.current.handleKeyDown(fireKey('ArrowDown'));
      result.current.handleKeyDown(fireKey('m'));
    });
    expect(actions.adjustVolume).toHaveBeenNthCalledWith(1, 0.05);
    expect(actions.adjustVolume).toHaveBeenNthCalledWith(2, -0.05);
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
  });

  it('F/P 切换全屏与画中画', () => {
    const actions = createActions();
    const { result } = renderHook(() => usePlayerKeyboard(actions));
    act(() => {
      result.current.handleKeyDown(fireKey('f'));
      result.current.handleKeyDown(fireKey('P'));
    });
    expect(actions.toggleFullscreen).toHaveBeenCalledTimes(1);
    expect(actions.togglePictureInPicture).toHaveBeenCalledTimes(1);
  });

  it('数字键按百分比跳转，Home/End 跳转首尾', () => {
    const actions = createActions();
    const { result } = renderHook(() => usePlayerKeyboard(actions));
    act(() => {
      result.current.handleKeyDown(fireKey('0'));
      result.current.handleKeyDown(fireKey('5'));
      result.current.handleKeyDown(fireKey('9'));
      result.current.handleKeyDown(fireKey('Home'));
      result.current.handleKeyDown(fireKey('End'));
    });
    expect(actions.seekToFraction).toHaveBeenNthCalledWith(1, 0);
    expect(actions.seekToFraction).toHaveBeenNthCalledWith(2, 0.5);
    expect(actions.seekToFraction).toHaveBeenNthCalledWith(3, 0.9);
    expect(actions.seekToFraction).toHaveBeenNthCalledWith(4, 0);
    expect(actions.seekToFraction).toHaveBeenNthCalledWith(5, 1);
  });

  it('方括号逐帧，问号打开键位帮助', () => {
    const actions = createActions();
    const { result } = renderHook(() => usePlayerKeyboard(actions));
    act(() => {
      result.current.handleKeyDown(fireKey('['));
      result.current.handleKeyDown(fireKey(']'));
      result.current.handleKeyDown(fireKey('?'));
    });
    expect(actions.frameStep).toHaveBeenNthCalledWith(1, 'backward');
    expect(actions.frameStep).toHaveBeenNthCalledWith(2, 'forward');
    expect(actions.openKeyHelp).toHaveBeenCalledTimes(1);
    expect(FRAME_STEP_SECONDS).toBeGreaterThan(0);
  });

  it('可编辑目标与输入控件内不触发媒体键位', () => {
    const actions = createActions();
    const { result } = renderHook(() => usePlayerKeyboard(actions));
    const input = document.createElement('input');
    act(() => {
      result.current.handleKeyDown({
        key: ' ',
        preventDefault: vi.fn(),
        target: input,
      } as unknown as ReactKeyboardEvent<HTMLElement>);
    });
    expect(actions.togglePlayback).not.toHaveBeenCalled();
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
