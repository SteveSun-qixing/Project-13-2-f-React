/**
 * 父帧通道时序单测（内存端口对替身，Node 环境确定性驱动）。
 *
 * 权威：`05-渲染引擎设计` §9.1（通道建立）、§9.3（消息清单与约束）、§9.5（超时）、§9.6（通道安全校验）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { FrameChannel } from '../src/renderer/frame-channel.js';
import type { IFramePortPair, IFrameReadyInfo } from '../src/renderer/frame-channel.js';
import {
  FRAME_ACTION_TIMEOUT_MS,
  FRAME_DISPOSE_ACK_TIMEOUT_MS,
  FRAME_READY_TIMEOUT_MS,
  createFrameEnvelope,
} from '../src/renderer/frame-protocol.js';
import type { FrameInitPayload, IFrameHandshakeTransfer } from '../src/renderer/frame-protocol.js';
import type { ChipsError } from '../src/preload/chips-error.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';

/** 内存端口对替身：捕获父帧发出的消息，测试以子帧身份注入入站消息。 */
function createFakePortPair(): IFramePortPair & {
  readonly sent: unknown[];
  deliver(message: unknown): void;
  closeCount(): number;
} {
  let listener: ((event: { readonly data: unknown }) => void) | null = null;
  let closed = 0;
  const sent: unknown[] = [];
  return {
    sent,
    local: {
      postMessage(message: unknown) {
        sent.push(message);
      },
      addEventListener(_type: 'message', handler: (event: { readonly data: unknown }) => void) {
        listener = handler;
      },
      close() {
        closed += 1;
      },
    },
    remote: { kind: 'fake-remote-port' },
    deliver(message: unknown) {
      listener?.({ data: message });
    },
    closeCount: () => closed,
  };
}

/** 诊断记录器。 */
function createDiagnostics(): DiagnosticsSink & { readonly lines: { level: string; message: string }[] } {
  const lines: { level: string; message: string }[] = [];
  return {
    lines,
    warn(_scope: string, message: string) {
      lines.push({ level: 'warn', message });
    },
    error(_scope: string, message: string) {
      lines.push({ level: 'error', message });
    },
  };
}

/** 通道夹具面。 */
interface IChannelFixture {
  readonly channel: FrameChannel;
  readonly pair: ReturnType<typeof createFakePortPair>;
  readonly diagnostics: ReturnType<typeof createDiagnostics>;
  readonly transfers: IFrameHandshakeTransfer[];
  readonly ready: Mock<(info: IFrameReadyInfo) => void>;
  readonly readyTimeout: Mock<() => void>;
  readonly violation: Mock<(error: ChipsError) => void>;
  readonly frameError: Mock<(error: ChipsError) => void>;
  readonly executeAction: Mock<(action: { readonly kind: string }) => Promise<void>>;
  readonly heightReports: { readonly height: number; readonly epoch: number }[];
}

/** 通道测试夹具。 */
const createChannel = (overrides?: { role?: 'card' | 'box-layout' }): IChannelFixture => {
  const pair = createFakePortPair();
  const diagnostics = createDiagnostics();
  const transfers: IFrameHandshakeTransfer[] = [];
  const ready = vi.fn<(info: IFrameReadyInfo) => void>();
  const readyTimeout = vi.fn<() => void>();
  const violation = vi.fn<(error: ChipsError) => void>();
  const frameError = vi.fn<(error: ChipsError) => void>();
  const executeAction = vi.fn<(action: { readonly kind: string }) => Promise<void>>();
  const channel = new FrameChannel(
    {
      sessionId: 'session-1',
      frameId: 'frame-1',
      token: 'token-1',
      role: overrides?.role ?? 'card',
      environment: {
        createPortPair: () => pair,
        postToFrame: (message) => {
          transfers.push(message);
        },
      },
      diagnostics,
    },
    {
      onReady: (info) => {
        ready(info);
      },
      onHeight: (report) => {
        heightReports.push(report);
      },
      executeAction: (action) => executeAction(action),
      onFrameError: (error) => {
        frameError(error);
      },
    },
    {
      onReadyTimeout: () => {
        readyTimeout();
      },
      onProtocolViolation: (error) => {
        violation(error);
      },
    },
  );
  const heightReports: { readonly height: number; readonly epoch: number }[] = [];
  return {
    channel,
    pair,
    diagnostics,
    transfers,
    ready,
    readyTimeout,
    violation,
    frameError,
    executeAction,
    heightReports,
  };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('父帧通道（05.09 §9.1/§9.3/§9.5/§9.6）', () => {
  it('start 转移一次性令牌与远端端口，host:init 封套与会话登记一致', () => {
    const context = createChannel();
    const payload: FrameInitPayload = {
      role: 'card',
      view: { kind: 'card', revision: 1 } as never,
      nodes: [{ node_id: 'n1', card_type: 'text', containerId: 'chips-node-n1' }],
      resourceBase: 'chips-resource://default',
      pluginEntries: { text: 'chips-resource://plugins/text/render.js' },
      tokens: { '--chips-font-size': '14px' },
      limits: { minHeight: 80, maxHeight: 600, maxNestedFrames: 0 },
    };
    context.channel.start();
    context.channel.sendInit(payload);

    expect(context.transfers).toHaveLength(1);
    expect(context.transfers[0]).toEqual({
      protocol: 'chips-frame/1',
      type: 'host:handshake',
      sessionId: 'session-1',
      frameId: 'frame-1',
      token: 'token-1',
    });
    expect(context.pair.sent).toHaveLength(1);
    const envelope = context.pair.sent[0] as {
      sessionId: string;
      frameId: string;
      message: { type: string; payload: FrameInitPayload };
    };
    expect(envelope.sessionId).toBe('session-1');
    expect(envelope.frameId).toBe('frame-1');
    expect(envelope.message.type).toBe('host:init');
    expect(envelope.message.payload.nodes).toEqual(payload.nodes);
    expect(envelope.message.payload.pluginEntries).toEqual(payload.pluginEntries);
  });

  it('frame:ready 触发就绪回调；就绪后超时不再触发', () => {
    const context = createChannel();
    context.channel.start();
    context.pair.deliver(
      createFrameEnvelope('session-1', 'frame-1', { type: 'frame:ready', payload: { capabilities: ['measure'] } }),
    );
    expect(context.ready).toHaveBeenCalledWith({ capabilities: ['measure'] });

    vi.advanceTimersByTime(FRAME_READY_TIMEOUT_MS + 1);
    expect(context.readyTimeout).not.toHaveBeenCalled();
  });

  it('就绪超时（5s）触发 RENDER_FRAME_TIMEOUT 路径', () => {
    const context = createChannel();
    context.channel.start();
    vi.advanceTimersByTime(FRAME_READY_TIMEOUT_MS - 1);
    expect(context.readyTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(context.readyTimeout).toHaveBeenCalledTimes(1);
  });

  it('高度上报逐条转发给高度回调', () => {
    const context = createChannel();
    context.channel.start();
    context.pair.deliver(
      createFrameEnvelope('session-1', 'frame-1', { type: 'frame:height', payload: { height: 300, epoch: 1 } }),
    );
    expect(context.heightReports).toEqual([{ height: 300, epoch: 1 }]);
  });

  it('frame:action 成功不回执，失败回 host:action-error 且 requestId 对应', async () => {
    const context = createChannel();
    context.channel.start();
    context.executeAction.mockResolvedValueOnce(undefined);

    context.pair.deliver(
      createFrameEnvelope('session-1', 'frame-1', {
        type: 'frame:action',
        payload: { requestId: 'ok-1', action: { kind: 'copy-text', text: '文本' } },
      }),
    );
    await vi.waitFor(() => {
      expect(context.executeAction).toHaveBeenCalledTimes(1);
    });
    expect(context.pair.sent).toHaveLength(0);

    const failure = Object.assign(new Error('资源打开失败'), { code: 'BRIDGE_INTERNAL' });
    context.executeAction.mockRejectedValueOnce(failure);
    context.pair.deliver(
      createFrameEnvelope('session-1', 'frame-1', {
        type: 'frame:action',
        payload: { requestId: 'fail-1', action: { kind: 'open-external', url: 'https://example.com' } },
      }),
    );
    await vi.waitFor(() => {
      const errorEnvelope = context.pair.sent[0] as {
        message: { type: string; payload: { requestId: string; error: { code: string } } };
      };
      expect(errorEnvelope.message.type).toBe('host:action-error');
      expect(errorEnvelope.message.payload.requestId).toBe('fail-1');
      expect(errorEnvelope.message.payload.error.code).toBe('BRIDGE_INTERNAL');
    });
  });

  it('frame:action 超时（5s）回 host:action-error', async () => {
    const context = createChannel();
    context.channel.start();
    context.executeAction.mockReturnValueOnce(new Promise<void>(() => undefined));

    context.pair.deliver(
      createFrameEnvelope('session-1', 'frame-1', {
        type: 'frame:action',
        payload: { requestId: 'slow-1', action: { kind: 'copy-text', text: '文本' } },
      }),
    );
    await vi.waitFor(() => {
      expect(context.executeAction).toHaveBeenCalledTimes(1);
    });
    vi.advanceTimersByTime(FRAME_ACTION_TIMEOUT_MS);
    const errorEnvelope = context.pair.sent[0] as {
      message: { type: string; payload: { requestId: string; error: { code: string; retryable: boolean } } };
    };
    expect(errorEnvelope.message.type).toBe('host:action-error');
    expect(errorEnvelope.message.payload.error.code).toBe('BRIDGE_TIMEOUT');
    expect(errorEnvelope.message.payload.error.retryable).toBe(true);
  });

  it('会话登记不匹配的封套按协议违规拒绝（§9.6）', () => {
    const context = createChannel();
    context.channel.start();
    context.pair.deliver(
      createFrameEnvelope('session-evil', 'frame-1', { type: 'frame:ready', payload: { capabilities: [] } }),
    );
    expect(context.violation).toHaveBeenCalledTimes(1);
    expect(context.violation.mock.calls[0]?.[0].code).toBe('RENDER_PROTOCOL_VIOLATION');
    expect(context.ready).not.toHaveBeenCalled();
  });

  it('未列入清单的消息类型忽略并记录诊断（§9.3）', () => {
    const context = createChannel();
    context.channel.start();
    context.pair.deliver(createFrameEnvelope('session-1', 'frame-1', { type: 'frame:future', payload: {} } as never));
    expect(context.violation).not.toHaveBeenCalled();
    expect(context.diagnostics.lines.some((line) => line.message.includes('忽略'))).toBe(true);
  });

  it('非布局帧的 frame:entry-request 视为越级违规；布局帧侧暂不消费', () => {
    const card = createChannel();
    card.channel.start();
    card.pair.deliver(
      createFrameEnvelope('session-1', 'frame-1', {
        type: 'frame:entry-request',
        payload: { requestId: 'r', entry_ids: [], firstVisible: 0, lastVisible: 0 },
      }),
    );
    expect(card.violation).toHaveBeenCalledTimes(1);

    const layout = createChannel({ role: 'box-layout' });
    layout.channel.start();
    layout.pair.deliver(
      createFrameEnvelope('session-1', 'frame-1', {
        type: 'frame:entry-request',
        payload: { requestId: 'r', entry_ids: [], firstVisible: 0, lastVisible: 0 },
      }),
    );
    expect(layout.violation).not.toHaveBeenCalled();
    expect(layout.diagnostics.lines.some((line) => line.message.includes('条目请求'))).toBe(true);
  });

  it('dispose：等待 ack 返回 ack 并关闭端口；无 ack 时 1s 强制收口', async () => {
    const withAck = createChannel();
    withAck.channel.start();
    const disposePromise = withAck.channel.requestDispose();
    const disposeEnvelope = withAck.pair.sent[0] as { message: { type: string } };
    expect(disposeEnvelope.message.type).toBe('host:dispose');
    withAck.pair.deliver(createFrameEnvelope('session-1', 'frame-1', { type: 'frame:dispose-ack', payload: null }));
    await expect(disposePromise).resolves.toBe('ack');
    expect(withAck.pair.closeCount()).toBe(1);

    const withoutAck = createChannel();
    withoutAck.channel.start();
    const timeoutDispose = withoutAck.channel.requestDispose();
    vi.advanceTimersByTime(FRAME_DISPOSE_ACK_TIMEOUT_MS);
    await expect(timeoutDispose).resolves.toBe('timeout');
    expect(withoutAck.pair.closeCount()).toBe(1);
  });

  it('closePort 后再收消息与发送均被忽略', () => {
    const context = createChannel();
    context.channel.start();
    context.channel.closePort();
    context.pair.deliver(
      createFrameEnvelope('session-1', 'frame-1', { type: 'frame:ready', payload: { capabilities: [] } }),
    );
    context.channel.sendInit({
      role: 'card',
      view: { kind: 'card', revision: 1 } as never,
      nodes: [],
      resourceBase: '',
      pluginEntries: {},
      tokens: {},
      limits: { minHeight: 0, maxHeight: 1, maxNestedFrames: 0 },
    });
    expect(context.pair.sent).toHaveLength(0);
    expect(context.ready).not.toHaveBeenCalled();
  });
});
