import { describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { renderHook } from '@testing-library/react';
import {
  PLAYER_KEY_HELP_ITEMS,
  dispatchPlayerKeyboardAction,
  usePlayerKeyboard,
} from '../src/player/usePlayerKeyboard';

/**
 * 播放器键位判例（重写件）：键位表 → 动作派发映射；可编辑元素聚焦时不抢占。
 */

interface KeyboardActionsStub {
  togglePlayback: ReturnType<typeof vi.fn>;
  seekBy: ReturnType<typeof vi.fn>;
  volumeStep: ReturnType<typeof vi.fn>;
  toggleMute: ReturnType<typeof vi.fn>;
  toggleLoopMode: ReturnType<typeof vi.fn>;
  goNext: ReturnType<typeof vi.fn>;
  goPrevious: ReturnType<typeof vi.fn>;
}

const createActions = (): KeyboardActionsStub => ({
  togglePlayback: vi.fn(),
  seekBy: vi.fn(),
  volumeStep: vi.fn(),
  toggleMute: vi.fn(),
  toggleLoopMode: vi.fn(),
  goNext: vi.fn(),
  goPrevious: vi.fn(),
});

const createKeyEvent = (
  key: string,
  target: EventTarget | null,
): { event: KeyboardEvent<HTMLElement>; preventDefault: ReturnType<typeof vi.fn> } => {
  const preventDefault = vi.fn();
  const event = {
    key,
    target,
    preventDefault,
    repeat: false,
  } as unknown as KeyboardEvent<HTMLElement>;
  return { event, preventDefault };
};

describe('dispatchPlayerKeyboardAction（键位映射）', () => {
  it('播放/进度/音量/静音/循环/切歌全部映射到动作', () => {
    const actions = createActions();

    expect(dispatchPlayerKeyboardAction(actions, ' ')).toBe(true);
    expect(actions.togglePlayback).toHaveBeenCalledTimes(1);

    expect(dispatchPlayerKeyboardAction(actions, 'ArrowLeft')).toBe(true);
    expect(actions.seekBy).toHaveBeenLastCalledWith(-5);
    expect(dispatchPlayerKeyboardAction(actions, 'ArrowRight')).toBe(true);
    expect(actions.seekBy).toHaveBeenLastCalledWith(5);

    expect(dispatchPlayerKeyboardAction(actions, 'ArrowUp')).toBe(true);
    expect(actions.volumeStep).toHaveBeenLastCalledWith(1);
    expect(dispatchPlayerKeyboardAction(actions, 'ArrowDown')).toBe(true);
    expect(actions.volumeStep).toHaveBeenLastCalledWith(-1);

    expect(dispatchPlayerKeyboardAction(actions, 'm')).toBe(true);
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
    expect(dispatchPlayerKeyboardAction(actions, 'l')).toBe(true);
    expect(actions.toggleLoopMode).toHaveBeenCalledTimes(1);
    expect(dispatchPlayerKeyboardAction(actions, 'n')).toBe(true);
    expect(actions.goNext).toHaveBeenCalledTimes(1);
    expect(dispatchPlayerKeyboardAction(actions, 'p')).toBe(true);
    expect(actions.goPrevious).toHaveBeenCalledTimes(1);
  });

  it('未命中键位返回 false 且不派发', () => {
    const actions = createActions();
    expect(dispatchPlayerKeyboardAction(actions, 'a')).toBe(false);
    expect(dispatchPlayerKeyboardAction(actions, 'Escape')).toBe(false);
    expect(actions.togglePlayback).not.toHaveBeenCalled();
  });

  it('键位帮助条目与映射表同源且非空', () => {
    expect(PLAYER_KEY_HELP_ITEMS.length).toBeGreaterThan(0);
    for (const item of PLAYER_KEY_HELP_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});

describe('usePlayerKeyboard（容器处理器）', () => {
  it('派发命中键位并阻止默认行为', () => {
    const actions = createActions();
    const { result } = renderHook(() => usePlayerKeyboard(actions));
    const { event, preventDefault } = createKeyEvent(' ', document.body);

    result.current(event);

    expect(actions.togglePlayback).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('输入控件聚焦时不抢占键位（表单输入优先）', () => {
    const actions = createActions();
    const { result } = renderHook(() => usePlayerKeyboard(actions));
    const input = document.createElement('input');
    const { event, preventDefault } = createKeyEvent(' ', input);

    result.current(event);

    expect(actions.togglePlayback).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('动作表按渲染换代现取（ref 引用）', () => {
    const first = createActions();
    const second = createActions();
    const { result, rerender } = renderHook(({ current }: { current: KeyboardActionsStub }) => usePlayerKeyboard(current), {
      initialProps: { current: first },
    });
    rerender({ current: second });

    const { event } = createKeyEvent('n', document.body);
    result.current(event);

    expect(first.goNext).not.toHaveBeenCalled();
    expect(second.goNext).toHaveBeenCalledTimes(1);
  });
});
