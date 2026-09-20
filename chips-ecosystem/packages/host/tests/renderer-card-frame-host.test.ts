// @vitest-environment jsdom
/**
 * 顶层卡片帧宿主单测（jsdom 环境，内存端口对替身）。
 *
 * 权威：`05-渲染引擎设计` §6.2（帧初始化与节点容器声明）、§4.2（iframe 沙箱基线）、
 * §9.1（通道建立：一次性令牌入 fragment + 端口转移）、§9.3/§9.4（高度回执与冻结解除）、
 * §6.4（帧级错误边界）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { CardFrameHost } from '../src/renderer/card-frame-host.js';
import type { IFramePortPair } from '../src/renderer/frame-channel.js';
import { FRAME_DISPOSE_ACK_TIMEOUT_MS, createFrameEnvelope } from '../src/renderer/frame-protocol.js';
import type {
  DesignTokens,
  FrameActionPayload,
  FrameLimits,
  ICardRenderView,
  IFrameHandshakeTransfer,
} from '../src/renderer/frame-protocol.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';

const LIMITS: FrameLimits = { minHeight: 80, maxHeight: 600, maxNestedFrames: 0 };

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

/** 卡片渲染视图基线（两个内容节点）。 */
function cardView(revision = 1): ICardRenderView {
  return {
    kind: 'card',
    revision,
    card_id: 'Ab3dEf6Gh8',
    name: '测试卡片',
    chip_standards_version: '1.0.0',
    cover_ratio: '3:2',
    tags: ['示例'],
    cover: { entry: 'cover', ratio: '3:2' },
    content_nodes: [
      { node_id: 'node-1', card_type: 'text', content: { text: '第一块' } },
      { node_id: 'node-2', card_type: 'image', content: { url: 'chips-resource://default/1.png' } },
    ],
  };
}

/** 帧宿主夹具面。 */
interface IHostFixture {
  readonly host: CardFrameHost;
  readonly pair: ReturnType<typeof createFakePortPair>;
  readonly transfers: IFrameHandshakeTransfer[];
  readonly diagnostics: ReturnType<typeof createDiagnostics>;
  readonly executeAction: Mock<(action: FrameActionPayload) => Promise<void>>;
  readonly frameId: string;
}

/** 帧宿主测试夹具。 */
const createHost = (overrides?: {
  readonly heightCache?: { estimate(key: string): number | undefined };
  readonly view?: ICardRenderView;
}): IHostFixture => {
  const pair = createFakePortPair();
  const transfers: IFrameHandshakeTransfer[] = [];
  const diagnostics = createDiagnostics();
  const executeAction = vi.fn((_action: FrameActionPayload) => Promise.resolve());
  const host = new CardFrameHost({
    sessionId: 'session-1',
    source: 'chips-resource://default/card/Ab3dEf6Gh8.card',
    view: overrides?.view ?? cardView(),
    frameEntryUrl: 'chips-resource://platform/frame.html',
    resourceBase: 'chips-resource://default',
    pluginEntries: { text: 'chips-resource://plugins/text/render.js' },
    tokens: { '--chips-font-size': '14px' },
    limits: LIMITS,
    executeAction,
    diagnostics,
    ...(overrides?.heightCache === undefined ? {} : { heightCache: overrides.heightCache as never }),
    channelEnvironment: {
      createPortPair: () => pair,
      postToFrame: (message) => {
        transfers.push(message);
      },
    },
    frameLoadSignal: Promise.resolve(),
  });
  const frameId = host.element.getAttribute('data-chips-frame-id') ?? '';
  return { host, pair, transfers, diagnostics, executeAction, frameId };
};

/** 通道消息快捷注入。 */
function deliver(pair: ReturnType<typeof createFakePortPair>, frameId: string, message: unknown): void {
  pair.deliver(createFrameEnvelope('session-1', frameId, message));
}

describe('卡片帧宿主（05.09 §4.2/§9.1/§6.2）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('iframe 沙箱基线：sandbox/title/referrerpolicy/src fragment 令牌逐项固定', () => {
    const context = createHost();
    const element = context.host.element;
    expect(element.getAttribute('sandbox')).toBe('allow-scripts');
    expect(element.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(element.getAttribute('title')).toBe('卡片渲染帧');
    expect(element.style.width).toBe('100%');
    // 初始高度取下限占位（无缓存命中）。
    expect(element.style.height).toBe(`${LIMITS.minHeight}px`);
    void context.transfers;
  });

  it('初始高度优先取高度缓存的历史估算值（首屏占位）', () => {
    const context = createHost({
      heightCache: {
        estimate: (key) =>
          key === `card\u0000chips-resource://default/card/Ab3dEf6Gh8.card\u0000r1` ? 320 : undefined,
      },
    });
    expect(context.host.element.style.height).toBe('320px');
  });

  it('beginHandshake：一次性令牌入 fragment，host:init 与视图节点逐项对应', async () => {
    const context = createHost();
    await context.host.beginHandshake();

    expect(context.transfers).toHaveLength(1);
    const transfer = context.transfers[0];
    if (transfer === undefined) {
      throw new Error('握手转移消息缺失');
    }
    expect(transfer.type).toBe('host:handshake');
    expect(transfer.sessionId).toBe('session-1');
    expect(transfer.frameId).toBe(context.frameId);
    expect(context.host.element.getAttribute('src')).toBe(`chips-resource://platform/frame.html#${transfer.token}`);

    expect(context.pair.sent).toHaveLength(1);
    const initEnvelope = context.pair.sent[0] as {
      sessionId: string;
      frameId: string;
      message: { type: string; payload: { nodes: { node_id: string; card_type: string; containerId: string }[]; tokens: DesignTokens; pluginEntries: Record<string, string>; resourceBase: string; limits: FrameLimits } };
    };
    expect(initEnvelope.sessionId).toBe('session-1');
    expect(initEnvelope.frameId).toBe(context.frameId);
    expect(initEnvelope.message.type).toBe('host:init');
    expect(initEnvelope.message.payload.nodes).toEqual([
      { node_id: 'node-1', card_type: 'text', containerId: 'chips-node-node-1' },
      { node_id: 'node-2', card_type: 'image', containerId: 'chips-node-node-2' },
    ]);
    expect(initEnvelope.message.payload.pluginEntries).toEqual({ text: 'chips-resource://plugins/text/render.js' });
    expect(initEnvelope.message.payload.limits).toEqual(LIMITS);
  });

  it('frame:ready 交付就绪；高度上报应用到 iframe 并回执 host:height-ack', async () => {
    const context = createHost();
    await context.host.beginHandshake();

    deliver(context.pair, context.frameId, { type: 'frame:ready', payload: { capabilities: ['measure'] } });
    await expect(context.host.ready).resolves.toBeUndefined();

    const heights: number[] = [];
    context.host.onHeightChanged((heightPx) => {
      heights.push(heightPx);
    });
    deliver(context.pair, context.frameId, { type: 'frame:height', payload: { height: 300, epoch: 1 } });
    expect(context.host.element.style.height).toBe('300px');
    expect(heights).toEqual([300]);
    const ack = context.pair.sent[1] as { message: { type: string; payload: { epoch: number } } };
    expect(ack.message.type).toBe('host:height-ack');
    expect(ack.message.payload.epoch).toBe(1);
  });

  it('host:update 下发新视图与 revision（封套登记一致）', async () => {
    const context = createHost();
    await context.host.beginHandshake();
    deliver(context.pair, context.frameId, { type: 'frame:ready', payload: { capabilities: [] } });
    await expect(context.host.ready).resolves.toBeUndefined();

    const view = cardView(2);
    context.host.update(view, 2);
    const updateEnvelope = context.pair.sent[1] as {
      message: { type: string; payload: { view: ICardRenderView; revision: number } };
    };
    expect(updateEnvelope.message.type).toBe('host:update');
    expect(updateEnvelope.message.payload.revision).toBe(2);
    expect(updateEnvelope.message.payload.view.revision).toBe(2);
  });

  it('dispose（已握手）：host:dispose → ack → 端口关闭 → 元素摘除', async () => {
    const context = createHost();
    const container = document.createElement('div');
    context.host.attach(container);
    await context.host.beginHandshake();

    const disposePromise = context.host.dispose();
    const disposeEnvelope = context.pair.sent[1] as { message: { type: string } };
    expect(disposeEnvelope.message.type).toBe('host:dispose');
    deliver(context.pair, context.frameId, { type: 'frame:dispose-ack', payload: null });
    await expect(disposePromise).resolves.toBeUndefined();
    expect(context.pair.closeCount()).toBe(1);
    expect(container.children).toHaveLength(0);
  });

  it('dispose（未握手）：端口对尚未建立，直接收口且不下发 host:dispose', async () => {
    const context = createHost();
    await context.host.dispose();
    // 通道 start 未调用：MessageChannel 端口对从未创建，无可关闭端口。
    expect(context.pair.sent).toHaveLength(0);
    expect(context.pair.closeCount()).toBe(0);
    // 超时上限不该被等待（dispose 已即时收口）。
    vi.advanceTimersByTime(FRAME_DISPOSE_ACK_TIMEOUT_MS + 1);
  });

  it('frame:error 只记录诊断，不改就绪状态（§6.4 单帧失败边界）', async () => {
    const context = createHost();
    await context.host.beginHandshake();
    deliver(context.pair, context.frameId, {
      type: 'frame:error',
      payload: { code: 'RENDER_PLUGIN_FAILED', message: '插件渲染出现错误', retryable: true },
    });
    let rejected = false;
    context.host.ready.catch(() => {
      rejected = true;
    });
    await vi.advanceTimersByTimeAsync(10);
    expect(rejected).toBe(false);
    expect(context.diagnostics.lines.some((line) => line.message.includes('帧内错误'))).toBe(true);
    // 就绪仍可正常交付。
    deliver(context.pair, context.frameId, { type: 'frame:ready', payload: { capabilities: [] } });
    await expect(context.host.ready).resolves.toBeUndefined();
  });

  it('attach/detach 往返：摘除后帧保持存活可重新挂载', () => {
    const context = createHost();
    const first = document.createElement('div');
    context.host.attach(first);
    expect(first.children).toHaveLength(1);
    context.host.detach();
    expect(first.children).toHaveLength(0);
    const second = document.createElement('div');
    context.host.attach(second);
    expect(second.children).toHaveLength(1);
  });
});
