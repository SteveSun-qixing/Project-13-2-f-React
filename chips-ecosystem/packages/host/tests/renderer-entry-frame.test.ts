/**
 * 平台帧运行时入口（子帧侧通道状态机）单测（jsdom；金链路刀4 / 任务 #100）。
 *
 * 权威：`05-渲染引擎设计` §9.1（令牌握手）、§9.2（封套与清单）、§9.3（约束）、
 * §9.4（子帧侧高度算法：rAF 合并、≥1px、epoch 单调、ack 前重发、超上限冻结）、
 * §9.6（入站封套与登记一致性校验）。
 *
 * @remarks DOM 依赖全部经注入环境承载，本套件以确定性替身驱动握手、端口、rAF 与
 * 高度观察四臂；生产环境装配臂（`createDefaultFrameRuntimeEnvironment`）在 jsdom 下
 * 单测令牌解码、token 写入与节点容器创建。
 */

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFrameEnvelope, createHandshakeTransfer } from '../src/renderer/index.js';
import type { FrameInitPayload, FrameNodeInit } from '../src/renderer/index.js';
import {
  createDefaultFrameRuntimeEnvironment,
  parseHostEnvelope,
  startFrameRuntime,
} from '../src/renderer/entries/frame.js';
import type {
  IFrameHandshakeEvent,
  IFrameRuntimeEnvironment,
  IFrameRuntimePort,
} from '../src/renderer/entries/frame.js';

const SESSION_ID = 'sess-1';
const FRAME_ID = 'frame-1';
const TOKEN = 'tok-abc';

const NODES: readonly FrameNodeInit[] = [
  { node_id: 'n-1', card_type: 'basic.note', containerId: 'chips-node-n-1' },
  { node_id: 'n-2', card_type: 'basic.text', containerId: 'chips-node-n-2' },
];

const INIT_PAYLOAD: FrameInitPayload = {
  role: 'card',
  view: {
    kind: 'card',
    revision: 1,
    card_id: 'card-0001',
    name: '示例卡片',
    chip_standards_version: '1.0',
    cover_ratio: '4:3',
    tags: [],
    cover: { entry: 'chips-resource://platform/cover/a.png', ratio: '4:3' },
    content_nodes: NODES.map((node) => ({ node_id: node.node_id, card_type: node.card_type, content: {} })),
  },
  nodes: NODES,
  resourceBase: 'chips-resource://platform/documents/',
  pluginEntries: {},
  tokens: { '--chips-color-primary': '#1677ff' },
  limits: { minHeight: 1, maxHeight: 200, maxNestedFrames: 0 },
};

interface Harness {
  readonly env: IFrameRuntimeEnvironment;
  readonly posted: Array<Record<string, unknown>>;
  readonly port: IFrameRuntimePort & { closeCount: { value: number }; started: { value: number } };
  fireHandshake(event: IFrameHandshakeEvent): void;
  firePort(data: unknown): void;
  fireHeight(): void;
  runFrames(count?: number): void;
  setMeasure(value: number): void;
  readonly calls: {
    applyTokens: ReturnType<typeof vi.fn>;
    createNodeContainers: ReturnType<typeof vi.fn>;
    clearNodeContainers: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  handshakeDetached(): boolean;
}

function createHarness(token: string = TOKEN): Harness {
  const posted: Array<Record<string, unknown>> = [];
  let handshakeListener: ((event: IFrameHandshakeEvent) => void) | null = null;
  let detached = false;
  let portListener: ((event: { data: unknown }) => void) | null = null;
  let heightListener: (() => void) | null = null;
  const frames: Array<() => void> = [];
  let measure = 100;
  const closeCount = { value: 0 };
  const started = { value: 0 };
  const port = {
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    closeCount,
    started,
    close(): void {
      closeCount.value += 1;
    },
    start(): void {
      started.value += 1;
    },
  };
  const calls = {
    applyTokens: vi.fn(),
    createNodeContainers: vi.fn(),
    clearNodeContainers: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const env: IFrameRuntimeEnvironment = {
    readToken: () => token,
    addHandshakeListener(listener) {
      handshakeListener = listener;
      return () => {
        handshakeListener = null;
        detached = true;
      };
    },
    addPortListener(_port, listener) {
      portListener = listener;
    },
    scheduleFrame(callback) {
      frames.push(callback);
    },
    measureHeight: () => measure,
    observeHeight(listener) {
      heightListener = listener;
      return () => {
        heightListener = null;
      };
    },
    applyTokens: calls.applyTokens,
    createNodeContainers: calls.createNodeContainers,
    clearNodeContainers: calls.clearNodeContainers,
    post(_port, message) {
      posted.push(message as Record<string, unknown>);
    },
    diagnostics: { warn: calls.warn, error: calls.error },
  };
  return {
    env,
    posted,
    port,
    fireHandshake(event) {
      handshakeListener?.(event);
    },
    firePort(data) {
      portListener?.({ data });
    },
    fireHeight() {
      heightListener?.();
    },
    runFrames(count = 1) {
      for (let index = 0; index < count && frames.length > 0; index += 1) {
        (frames.shift() as () => void)();
      }
    },
    setMeasure(value) {
      measure = value;
    },
    calls,
    handshakeDetached: () => detached,
  };
}

function hostMessage(harness: Harness, type: string, payload: unknown): void {
  harness.firePort(createFrameEnvelope(SESSION_ID, FRAME_ID, { type, payload }));
}

function handshake(
  harness: Harness,
  overrides: Partial<{ sessionId: string; frameId: string; token: string }> = {},
): void {
  harness.fireHandshake({
    data: createHandshakeTransfer(
      overrides.sessionId ?? SESSION_ID,
      overrides.frameId ?? FRAME_ID,
      overrides.token ?? TOKEN,
    ),
    ports: [harness.port],
  });
}

function initializedHarness(): Harness {
  const harness = createHarness();
  startFrameRuntime(harness.env);
  handshake(harness);
  hostMessage(harness, 'host:init', INIT_PAYLOAD);
  harness.runFrames(); // 首帧高度上报
  return harness;
}

function lastHeight(harness: Harness): { height: number; epoch: number } {
  const envelope = harness.posted[harness.posted.length - 1] as {
    message: { type: string; payload: { height: number; epoch: number } };
  };
  expect(envelope.message.type).toBe('frame:height');
  return envelope.message.payload;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('握手与令牌闸', () => {
  it('令牌缺失：运行时不启动，登记错误诊断', () => {
    const harness = createHarness('');
    const handle = startFrameRuntime(harness.env);
    expect(harness.calls.error).toHaveBeenCalledTimes(1);
    expect(handle.session).toBeNull();
    harness.fireHandshake({ data: createHandshakeTransfer(SESSION_ID, FRAME_ID, ''), ports: [harness.port] });
    expect(handle.session).toBeNull();
    expect(harness.posted).toHaveLength(0);
  });

  it('令牌不符 / 载体形状违约：忽略握手', () => {
    const harness = createHarness();
    const handle = startFrameRuntime(harness.env);
    harness.fireHandshake({ data: createHandshakeTransfer(SESSION_ID, FRAME_ID, 'wrong'), ports: [harness.port] });
    harness.fireHandshake({
      data: { protocol: 'other', type: 'host:handshake', sessionId: SESSION_ID, frameId: FRAME_ID, token: TOKEN },
      ports: [harness.port],
    });
    harness.fireHandshake({ data: 'not-a-record', ports: [] });
    expect(handle.session).toBeNull();
    expect(harness.calls.warn).toHaveBeenCalledTimes(3);
  });

  it('握手未携带可用端口：错误诊断且不建立会话', () => {
    const harness = createHarness();
    const handle = startFrameRuntime(harness.env);
    harness.fireHandshake({ data: createHandshakeTransfer(SESSION_ID, FRAME_ID, TOKEN), ports: [] });
    harness.fireHandshake({
      data: createHandshakeTransfer(SESSION_ID, FRAME_ID, TOKEN),
      ports: [{ notAPort: true }],
    });
    expect(handle.session).toBeNull();
    expect(harness.calls.error).toHaveBeenCalledTimes(2);
  });

  it('握手成功：登记会话、注销握手监听、激活端口；重复握手忽略', () => {
    const harness = createHarness();
    const handle = startFrameRuntime(harness.env);
    handshake(harness);
    expect(handle.session).toEqual({ sessionId: SESSION_ID, frameId: FRAME_ID });
    expect(harness.handshakeDetached()).toBe(true);
    expect(harness.port.started.value).toBe(1);
    handshake(harness, { sessionId: 'sess-2' });
    expect(handle.session).toEqual({ sessionId: SESSION_ID, frameId: FRAME_ID });
  });
});

describe('host:init 装载', () => {
  it('应用 token、逐项创建节点容器、一次性 frame:ready 与首帧高度', () => {
    const harness = createHarness();
    const handle = startFrameRuntime(harness.env);
    handshake(harness);
    hostMessage(harness, 'host:init', INIT_PAYLOAD);
    expect(handle.initialized).toBe(true);
    expect(harness.calls.applyTokens).toHaveBeenCalledWith(INIT_PAYLOAD.tokens);
    expect(harness.calls.createNodeContainers).toHaveBeenCalledWith(NODES);
    const ready = harness.posted[0] as {
      protocol: string;
      sessionId: string;
      frameId: string;
      message: { type: string; payload: { capabilities: readonly string[] } };
    };
    expect([ready.protocol, ready.sessionId, ready.frameId, ready.message.type]).toEqual([
      'chips-frame/1',
      SESSION_ID,
      FRAME_ID,
      'frame:ready',
    ]);
    expect(ready.message.payload.capabilities).toEqual(['measure']);
    harness.runFrames();
    expect(harness.posted).toHaveLength(2);
    expect(lastHeight(harness)).toEqual({ height: 100, epoch: 1 });
  });

  it('host:init 每会话一次：重复下发忽略并记录', () => {
    const harness = initializedHarness();
    const before = harness.posted.length;
    hostMessage(harness, 'host:init', INIT_PAYLOAD);
    expect(harness.posted).toHaveLength(before);
    expect(harness.calls.warn).toHaveBeenCalledWith(expect.stringContaining('重复下发'));
  });

  it('host:update 先于 init 到达：忽略；init 后清空容器并合流高度', () => {
    const harness = createHarness();
    const handle = startFrameRuntime(harness.env);
    handshake(harness);
    hostMessage(harness, 'host:update', { view: INIT_PAYLOAD.view, revision: 2 });
    expect(harness.calls.clearNodeContainers).not.toHaveBeenCalled();
    hostMessage(harness, 'host:init', INIT_PAYLOAD);
    harness.runFrames();
    hostMessage(harness, 'host:update', { view: INIT_PAYLOAD.view, revision: 2 });
    expect(harness.calls.clearNodeContainers).toHaveBeenCalledTimes(1);
    const before = harness.posted.length;
    harness.runFrames();
    expect(harness.posted).toHaveLength(before); // 高度未变（1px 内）不重复上报
    expect(handle.initialized).toBe(true);
  });
});

describe('子帧高度算法（§9.4）', () => {
  it('同帧多次变化合并为一条上报，epoch 单调递增', () => {
    const harness = initializedHarness();
    harness.setMeasure(120);
    harness.fireHeight();
    harness.fireHeight();
    harness.fireHeight();
    const before = harness.posted.length;
    harness.runFrames(3);
    expect(harness.posted).toHaveLength(before + 1);
    expect(lastHeight(harness)).toEqual({ height: 120, epoch: 2 });
  });

  it('已 ack 后 <1px 变化：忽略上报', () => {
    const harness = initializedHarness();
    hostMessage(harness, 'host:height-ack', { epoch: 1 });
    harness.setMeasure(100.5);
    harness.fireHeight();
    const before = harness.posted.length;
    harness.runFrames(3);
    expect(harness.posted).toHaveLength(before);
  });

  it('ack 前累积的不一致变化：下一次 flush 重发（§9.4 第 4 条）', () => {
    const harness = initializedHarness(); // epoch1 h100 未 ack
    harness.setMeasure(100.5);
    harness.fireHeight();
    harness.runFrames(3);
    expect(lastHeight(harness)).toEqual({ height: 100.5, epoch: 2 });
    // ack 落后于最近变化时不追溯撤销，后续 flush 与登记对齐后静止
    hostMessage(harness, 'host:height-ack', { epoch: 2 });
    const before = harness.posted.length;
    harness.runFrames(1);
    expect(harness.posted).toHaveLength(before);
  });

  it('超过 maxHeight：冻结在钳制值，不再增长', () => {
    const harness = initializedHarness(); // limits.maxHeight = 200
    harness.setMeasure(260);
    harness.fireHeight();
    harness.runFrames(3);
    expect(lastHeight(harness)).toEqual({ height: 200, epoch: 2 });
    hostMessage(harness, 'host:height-ack', { epoch: 2 });
    harness.setMeasure(300);
    harness.fireHeight();
    const before = harness.posted.length;
    harness.runFrames(3);
    expect(harness.posted).toHaveLength(before);
  });

  it('height-ack：倒退/非法 epoch 拒绝，合法推进登记', () => {
    const harness = initializedHarness();
    hostMessage(harness, 'host:height-ack', { epoch: 1 });
    hostMessage(harness, 'host:height-ack', { epoch: 0 });
    expect(harness.calls.warn).toHaveBeenCalledWith(expect.stringContaining('倒退'));
    hostMessage(harness, 'host:height-ack', { epoch: 'x' });
    expect(harness.calls.warn).toHaveBeenCalledWith(expect.stringContaining('非法'));
  });
});

describe('入站清单与登记一致性（§9.3 / §9.6）', () => {
  it('封套与会话登记不符：忽略并记录', () => {
    const harness = initializedHarness();
    const before = harness.posted.length;
    harness.firePort(
      createFrameEnvelope('other-session', FRAME_ID, {
        type: 'host:update',
        payload: { view: INIT_PAYLOAD.view, revision: 9 },
      }),
    );
    harness.firePort(
      createFrameEnvelope(SESSION_ID, 'other-frame', {
        type: 'host:update',
        payload: { view: INIT_PAYLOAD.view, revision: 9 },
      }),
    );
    expect(harness.posted).toHaveLength(before);
    expect(harness.calls.clearNodeContainers).not.toHaveBeenCalled();
    expect(harness.calls.warn).toHaveBeenCalledTimes(2);
  });

  it('清单外类型与子帧方向消息：忽略并记录', () => {
    const harness = initializedHarness();
    hostMessage(harness, 'host:bogus', {});
    hostMessage(harness, 'frame:height', { height: 10, epoch: 1 });
    expect(harness.calls.warn).toHaveBeenCalledWith(expect.stringContaining('忽略并记录'));
  });

  it('host:action-error：诊断记录请求与契约码', () => {
    const harness = initializedHarness();
    hostMessage(harness, 'host:action-error', {
      requestId: 'req-1',
      error: { code: 'BRIDGE_PERMISSION_DENIED', message: '拒绝', retryable: false, name: 'ChipsError' },
    });
    expect(harness.calls.warn).toHaveBeenCalledWith(
      '父帧拒绝了帧动作',
      expect.objectContaining({ requestId: 'req-1', code: 'BRIDGE_PERMISSION_DENIED' }),
    );
  });

  it('host:entries：卡片帧收到按协议违规记录；布局帧登记待消费波次', () => {
    const card = initializedHarness();
    hostMessage(card, 'host:entries', { requestId: 'req-1', tickets: [] });
    expect(card.calls.warn).toHaveBeenCalledWith(expect.stringContaining('非布局帧'));

    const layout = createHarness();
    startFrameRuntime(layout.env);
    handshake(layout);
    hostMessage(layout, 'host:init', { ...INIT_PAYLOAD, role: 'box-layout' });
    layout.runFrames();
    hostMessage(layout, 'host:entries', { requestId: 'req-1', tickets: [] });
    expect(layout.calls.warn).toHaveBeenCalledWith(expect.stringContaining('布局帧条目消费'));
  });
});

describe('销毁收口', () => {
  it('host:dispose：先回执后断道；回执后一切静默', () => {
    const harness = initializedHarness();
    hostMessage(harness, 'host:dispose', null);
    const ack = harness.posted[harness.posted.length - 1] as {
      message: { type: string; payload: unknown };
    };
    expect(ack.message).toEqual({ type: 'frame:dispose-ack', payload: null });
    expect(harness.port.closeCount.value).toBe(1);
    const before = harness.posted.length;
    hostMessage(harness, 'host:update', { view: INIT_PAYLOAD.view, revision: 4 });
    harness.fireHeight();
    harness.runFrames(3);
    expect(harness.posted).toHaveLength(before);
    expect(harness.handshakeDetached()).toBe(true);
  });

  it('abort：静默断道，不发送任何消息', () => {
    const harness = createHarness();
    const handle = startFrameRuntime(harness.env);
    handshake(harness);
    hostMessage(harness, 'host:init', INIT_PAYLOAD);
    harness.runFrames();
    const before = harness.posted.length;
    handle.abort();
    expect(harness.posted).toHaveLength(before);
    expect(harness.port.closeCount.value).toBe(1);
    harness.fireHeight();
    harness.runFrames(3);
    expect(harness.posted).toHaveLength(before);
  });
});

describe('parseHostEnvelope：子帧入站封套闸', () => {
  it('host:* 清单与 null 载荷规则', () => {
    expect(
      parseHostEnvelope(createFrameEnvelope('s', 'f', { type: 'host:height-ack', payload: { epoch: 1 } })),
    ).not.toBeNull();
    expect(parseHostEnvelope(createFrameEnvelope('s', 'f', { type: 'host:dispose', payload: null }))).not.toBeNull();
    expect(parseHostEnvelope(createFrameEnvelope('s', 'f', { type: 'host:update', payload: null }))).toBeNull();
    expect(
      parseHostEnvelope({
        protocol: 'chips-frame/2',
        sessionId: 's',
        frameId: 'f',
        message: { type: 'host:dispose', payload: null },
      }),
    ).toBeNull();
    expect(
      parseHostEnvelope(createFrameEnvelope('s', 'f', { type: 'frame:ready', payload: { capabilities: [] } })),
    ).toBeNull();
    expect(
      parseHostEnvelope({ protocol: 'chips-frame/1', message: { type: 'host:dispose', payload: null } }),
    ).toBeNull();
    expect(parseHostEnvelope(null)).toBeNull();
  });
});

describe('createDefaultFrameRuntimeEnvironment（jsdom 生产装配臂）', () => {
  function createEnv(): IFrameRuntimeEnvironment {
    return createDefaultFrameRuntimeEnvironment(globalThis.window, document);
  }

  it('readToken：解码 URL fragment 一次性令牌', () => {
    globalThis.window.history.replaceState(null, '', '#tok%402026');
    expect(createEnv().readToken()).toBe('tok@2026');
    globalThis.window.history.replaceState(null, '', '#');
    expect(createEnv().readToken()).toBe('');
  });

  it('applyTokens：CSS 变量写入文档根元素', () => {
    createEnv().applyTokens({ '--chips-color-primary': '#1677ff' });
    expect(document.documentElement.style.getPropertyValue('--chips-color-primary')).toBe('#1677ff');
  });

  it('createNodeContainers / clearNodeContainers：容器宿主逐项创建与清空', () => {
    const host = document.createElement('div');
    host.id = 'chips-frame-nodes';
    document.body.append(host);
    const env = createEnv();
    env.createNodeContainers(NODES);
    expect(host.children).toHaveLength(2);
    const first = host.children[0] as HTMLElement;
    expect(first.id).toBe('chips-node-n-1');
    expect(first.dataset['chipsNodeId']).toBe('n-1');
    expect(first.dataset['chipsCardType']).toBe('basic.note');
    env.clearNodeContainers();
    expect(host.children).toHaveLength(0);
  });

  it('measureHeight：根滚动元素整数高度；post 直投端口', () => {
    const env = createEnv();
    expect(Number.isInteger(env.measureHeight())).toBe(true);
    const port = { postMessage: vi.fn(), addEventListener: vi.fn(), close: vi.fn() };
    env.post(port, { marker: true });
    expect(port.postMessage).toHaveBeenCalledWith({ marker: true });
  });
});
