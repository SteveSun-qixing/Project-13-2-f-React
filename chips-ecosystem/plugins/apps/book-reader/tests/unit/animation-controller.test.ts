import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationController } from '../../src/engine/animation-controller';

describe('AnimationController', () => {
  let callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;

  beforeEach(() => {
    callbacks = new Map();
    nextId = 1;
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      callbacks.delete(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function flushAnimationFrame(time: number): void {
    const pending = Array.from(callbacks.entries());
    callbacks.clear();
    for (const [, callback] of pending) {
      callback(time);
    }
  }

  it('会平滑滚动到目标位置并触发完成回调', () => {
    const scrollTo = vi.fn();
    const onComplete = vi.fn();
    const controller = new AnimationController({
      duration: 200,
      minDuration: 200,
      maxDuration: 200,
    });

    controller.animateScroll({
      element: { scrollTo } as unknown as Element,
      from: 0,
      to: 120,
      axis: 'y',
      onComplete,
    });

    flushAnimationFrame(100);
    flushAnimationFrame(200);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith({
      top: 120,
      behavior: 'auto',
    });
    expect(controller.isAnimating()).toBe(false);
  });

  it('取消动画时会停止 requestAnimationFrame 并触发取消回调', () => {
    const scrollTo = vi.fn();
    const onCancel = vi.fn();
    const controller = new AnimationController({
      duration: 200,
      minDuration: 200,
      maxDuration: 200,
    });

    controller.animateScroll({
      element: { scrollTo } as unknown as Element,
      from: 0,
      to: 80,
      axis: 'x',
      onCancel,
    });

    expect(controller.isAnimating()).toBe(true);
    controller.cancel();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(controller.isAnimating()).toBe(false);
    expect(callbacks.size).toBe(0);
  });
});
