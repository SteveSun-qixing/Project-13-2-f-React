import { describe, expect, it, vi } from 'vitest';

import { assertCallActive, bindCallSignal, scheduleCallDeadline, withCallContext } from '../src/platform/call-guard.js';
import { PAL_ERROR_CODES, isPalPortError } from '../src/platform/errors.js';

describe('assertCallActive', () => {
  it('should accept an absent context', () => {
    expect(() => assertCallActive(undefined)).not.toThrow();
  });

  it('should reject aborted signals', () => {
    const controller = new AbortController();
    controller.abort();
    try {
      assertCallActive({ signal: controller.signal });
      throw new Error('expected rejection');
    } catch (error) {
      expect(isPalPortError(error)).toBe(true);
      if (isPalPortError(error)) {
        expect(error.code).toBe(PAL_ERROR_CODES.BRIDGE_CANCELLED);
      }
    }
  });

  it('should reject expired deadlines', () => {
    try {
      assertCallActive({ deadline: Date.now() - 1 });
      throw new Error('expected rejection');
    } catch (error) {
      expect(isPalPortError(error)).toBe(true);
      if (isPalPortError(error)) {
        expect(error.code).toBe(PAL_ERROR_CODES.BRIDGE_TIMEOUT);
      }
    }
  });
});

describe('bindCallSignal', () => {
  it('should be a no-op without a signal', () => {
    const controller = new AbortController();
    const unbind = bindCallSignal(undefined, controller);
    expect(controller.signal.aborted).toBe(false);
    expect(() => unbind()).not.toThrow();
  });

  it('should abort immediately for an already aborted signal', () => {
    const controller = new AbortController();
    const source = new AbortController();
    source.abort();
    bindCallSignal({ signal: source.signal }, controller);
    expect(controller.signal.aborted).toBe(true);
  });

  it('should propagate later aborts and stop after unbind', () => {
    const controller = new AbortController();
    const source = new AbortController();
    const unbind = bindCallSignal({ signal: source.signal }, controller);

    source.abort();
    expect(controller.signal.aborted).toBe(true);

    const second = new AbortController();
    const secondSource = new AbortController();
    const secondUnbind = bindCallSignal({ signal: secondSource.signal }, second);
    secondUnbind();
    secondSource.abort();
    expect(second.signal.aborted).toBe(false);

    unbind();
  });
});

describe('scheduleCallDeadline', () => {
  it('should be a no-op without a deadline', () => {
    const onExpired = vi.fn();
    const cleanup = scheduleCallDeadline(undefined, onExpired);
    expect(onExpired).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow();
  });

  it('should fire immediately for a past deadline', () => {
    const onExpired = vi.fn();
    scheduleCallDeadline({ deadline: Date.now() - 1 }, onExpired);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('should fire after the remaining time and be cancellable', async () => {
    const onExpired = vi.fn();
    scheduleCallDeadline({ deadline: Date.now() + 5 }, onExpired);
    await vi.waitFor(() => {
      expect(onExpired).toHaveBeenCalledTimes(1);
    });

    const cancelled = vi.fn();
    const cleanup = scheduleCallDeadline({ deadline: Date.now() + 30 }, cancelled);
    cleanup();
    await new Promise<void>((resolve) => setTimeout(resolve, 40));
    expect(cancelled).not.toHaveBeenCalled();
  });
});

describe('withCallContext', () => {
  it('should pass through operations without a context', async () => {
    await expect(withCallContext(Promise.resolve('ok'), undefined)).resolves.toBe('ok');
  });

  it('should reject already aborted calls without awaiting the operation', async () => {
    const controller = new AbortController();
    controller.abort();
    const onAbort = vi.fn();

    await expect(
      withCallContext(new Promise(() => undefined), { signal: controller.signal }, onAbort),
    ).rejects.toMatchObject({ code: PAL_ERROR_CODES.BRIDGE_CANCELLED });
    expect(onAbort).not.toHaveBeenCalled();
  });

  it('should reject expired calls', async () => {
    await expect(withCallContext(new Promise(() => undefined), { deadline: Date.now() - 1 })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_TIMEOUT,
    });
  });

  it('should abort pending operations when the signal fires', async () => {
    const controller = new AbortController();
    const onAbort = vi.fn();
    const pending = withCallContext(new Promise<string>(() => undefined), { signal: controller.signal }, onAbort);

    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: PAL_ERROR_CODES.BRIDGE_CANCELLED });
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('should time out pending operations at the deadline', async () => {
    const pending = withCallContext(new Promise<string>(() => undefined), {
      deadline: Date.now() + 5,
    });
    await expect(pending).rejects.toMatchObject({ code: PAL_ERROR_CODES.BRIDGE_TIMEOUT });
  });

  it('should settle with the operation result and ignore later aborts', async () => {
    const controller = new AbortController();
    const onAbort = vi.fn();
    await expect(withCallContext(Promise.resolve(42), { signal: controller.signal }, onAbort)).resolves.toBe(42);

    controller.abort();
    expect(onAbort).not.toHaveBeenCalled();
  });

  it('should propagate operation failures unchanged', async () => {
    const failure = new Error('operation failed');
    await expect(withCallContext(Promise.reject(failure), undefined)).rejects.toBe(failure);
  });
});
