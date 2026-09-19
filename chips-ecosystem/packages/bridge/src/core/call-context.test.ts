import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChipsError } from '../protocol/errors.js';
import { createCallContext } from './call-context.js';

describe('createCallContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('组装 capabilityContext：sessionId / callerId / deadline', () => {
    const now = 1_000_000;
    const context = createCallContext({
      sessionId: 's1',
      callerId: 'chips.official.editor',
      timeoutMs: 5000,
      now: () => now,
    });
    expect(context.capabilityContext.sessionId).toBe('s1');
    expect(context.capabilityContext.callerId).toBe('chips.official.editor');
    expect(context.capabilityContext.deadline).toBe(now + 5000);
    expect(context.capabilityContext.signal.aborted).toBe(false);
    context.dispose();
  });

  it('超时触发 signal 中止，reason 为 BRIDGE_TIMEOUT 且标记不幂等重复', () => {
    const context = createCallContext({
      sessionId: 's1',
      callerId: 'p',
      timeoutMs: 1000,
      now: () => 0,
    });
    vi.advanceTimersByTime(1000);
    expect(context.capabilityContext.signal.aborted).toBe(true);
    expect(context.timedOut).toBe(true);
    expect(context.capabilityContext.signal.reason).toMatchObject({ code: 'BRIDGE_TIMEOUT' });
    context.timeout();
    context.cancel();
    expect((context.capabilityContext.signal.reason as ChipsError).code).toBe('BRIDGE_TIMEOUT');
  });

  it('会话信号中止时透传原因', () => {
    const sessionController = new AbortController();
    const context = createCallContext({
      sessionId: 's1',
      callerId: 'p',
      timeoutMs: 10000,
      sessionSignal: sessionController.signal,
      now: () => 0,
    });
    const reason = new ChipsError({ code: 'BRIDGE_CANCELLED', message: '会话已关闭' });
    sessionController.abort(reason);
    expect(context.capabilityContext.signal.aborted).toBe(true);
    expect(context.capabilityContext.signal.reason).toBe(reason);
    context.dispose();
  });

  it('会话信号已中止时立即中止', () => {
    const sessionController = new AbortController();
    sessionController.abort();
    const context = createCallContext({
      sessionId: 's1',
      callerId: 'p',
      timeoutMs: 10000,
      sessionSignal: sessionController.signal,
      now: () => 0,
    });
    expect(context.capabilityContext.signal.aborted).toBe(true);
    context.dispose();
  });

  it('cancel 使用缺省 BRIDGE_CANCELLED 或自定义错误', () => {
    const defaultContext = createCallContext({
      sessionId: 's1',
      callerId: 'p',
      timeoutMs: 10000,
      now: () => 0,
    });
    defaultContext.cancel();
    expect(defaultContext.capabilityContext.signal.reason).toMatchObject({
      code: 'BRIDGE_CANCELLED',
    });
    defaultContext.cancel();
    defaultContext.timeout();

    const customContext = createCallContext({
      sessionId: 's2',
      callerId: 'p',
      timeoutMs: 10000,
      now: () => 0,
    });
    const custom = new ChipsError({ code: 'BRIDGE_CANCELLED', message: '能力已注销' });
    customContext.cancel(custom);
    expect(customContext.capabilityContext.signal.reason).toBe(custom);
    customContext.dispose();
  });

  it('dispose 清理定时器与会话监听', () => {
    const sessionController = new AbortController();
    const context = createCallContext({
      sessionId: 's1',
      callerId: 'p',
      timeoutMs: 1000,
      sessionSignal: sessionController.signal,
      now: () => 0,
    });
    context.dispose();
    vi.advanceTimersByTime(5000);
    expect(context.capabilityContext.signal.aborted).toBe(false);
    sessionController.abort();
    expect(context.capabilityContext.signal.aborted).toBe(false);
  });
});
