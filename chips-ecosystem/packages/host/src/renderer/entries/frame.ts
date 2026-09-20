/**
 * 平台帧运行时入口（渲染帧 iframe 子页，帧协议子帧侧完整通道面）。
 *
 * 权威：`05-渲染引擎设计` §9.1（通道建立：URL fragment 一次性令牌 + `host:handshake` 端口
 * 转移，信任边界为令牌 + 端口所有权）、§9.2（消息封套与载荷）、§9.3（消息清单与约束）、
 * §9.4（高度自适应算法之子帧侧：根滚动元素测量、rAF 合并且每帧至多一条、<1px 忽略、epoch
 * 单调递增、ack 前累积重发、超上限冻结增长）、§9.6（入站封套与登记一致性校验）；
 * §6.2（节点容器声明 `FrameNodeInit.containerId` 逐项创建）。
 *
 * @remarks
 * - 本入口只**消费**渲染面既有导出（`../index.js`），不修改其中任何一行；子帧不加载
 *   `window.chips`（沙箱帧无 preload 语境），一切系统触达经父帧按 §9.3 转发。
 * - 插件内容装载臂（按 `pluginEntries` 加载基础卡片插件执行 `renderView` 到节点容器）属
 *   插件执行通道波次（工单025 剩余 / #85 RFC 落波）；本模块交付帧协议子帧侧通道、令牌
 *   校验、初始化容器、高度上报与销毁回执的完整实现，插件臂接入点即 `host:init` 后
 *   按声明创建的节点容器本身。
 * - DOM 依赖全部经环境注入（监听器、端口、rAF、ResizeObserver、容器宿主），使通道时序
 *   可在 Node/jsdom 环境确定性测试；生产形态由 `createDefaultFrameRuntimeEnvironment()` 提供。
 */

/// <reference lib="dom" />

import { FRAME_PROTOCOL, createFrameEnvelope } from '../index.js';
import type {
  DesignTokens,
  FrameCapability,
  FrameEnvelope,
  FrameInitPayload,
  FrameLimits,
  FrameNodeInit,
  FrameRole,
  HostOutboundMessage,
} from '../index.js';

/** 帧端口结构（与 DOM `MessagePort` 同构子集；`start` 为 MessagePort 激活臂）。 */
export interface IFrameRuntimePort {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
  close(): void;
  start?(): void;
}

/** 一次性握手事件形状（window `message` 事件的消费子集）。 */
export interface IFrameHandshakeEvent {
  readonly data: unknown;
  readonly ports: readonly unknown[];
}

/** 帧运行时诊断口。 */
export interface IFrameRuntimeDiagnostics {
  warn(message: string, details?: Readonly<Record<string, unknown>>): void;
  error(message: string, details?: Readonly<Record<string, unknown>>): void;
}

/** 帧运行时环境（全部宿主触达臂注入）。 */
export interface IFrameRuntimeEnvironment {
  /** 读取 `location.hash` 剥除 `#` 后的一次性握手令牌；无令牌为空串。 */
  readToken(): string;
  /** 注册 window `message` 监听（握手载体）；返回注销函数。 */
  addHandshakeListener(listener: (event: IFrameHandshakeEvent) => void): () => void;
  /** 注册端口 `message` 监听。 */
  addPortListener(port: IFrameRuntimePort, listener: (event: { readonly data: unknown }) => void): void;
  /** rAF 调度（每帧一次合并窗口）。 */
  scheduleFrame(callback: () => void): void;
  /** 读取根滚动元素高度（§9.4 第 1 条：每帧 rAF 结束时读取一次测量值）。 */
  measureHeight(): number;
  /** 订阅高度变化源（生产形态为根滚动元素 `ResizeObserver`）；返回取消函数。 */
  observeHeight(listener: () => void): () => void;
  /** 应用 Design Tokens（CSS 变量写入帧根元素 style）。 */
  applyTokens(tokens: DesignTokens): void;
  /** 按节点容器声明创建节点独立容器（§6.2：`containerId` 逐项对应、顺序一致）。 */
  createNodeContainers(nodes: readonly FrameNodeInit[]): void;
  /** 清空全部节点容器内容（`host:update` 后按新视图重建，插件臂在清空后的容器内装载）。 */
  clearNodeContainers(): void;
  /** 向端口 `postMessage`。 */
  post(port: IFrameRuntimePort, message: unknown): void;
  /** 诊断输出。 */
  diagnostics: IFrameRuntimeDiagnostics;
}

/** 帧运行时句柄。 */
export interface IFrameRuntimeHandle {
  /** 当前会话登记（握手建立前为 `null`）。 */
  readonly session: { readonly sessionId: string; readonly frameId: string } | null;
  /** 是否已完成 `host:init` 装载。 */
  readonly initialized: boolean;
  /** 主动断开通道（不发送任何消息；用于宿主回收路径）。 */
  abort(): void;
}

/** 父帧 → 子帧入站消息类型集合（§9.2 `HostOutboundMessage` 清单；清单外一律忽略并记录）。 */
const HOST_INBOUND_TYPES: ReadonlySet<string> = new Set<string>([
  'host:init',
  'host:update',
  'host:entries',
  'host:height-ack',
  'host:action-error',
  'host:dispose',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 子帧封套闸：协议版本、封套字段与 §9.2 `host:*` 消息清单逐项校验；
 * 清单外类型与形状不符一律返回 `null`（调用方忽略并记录诊断，§9.3 / §9.6）。
 */
export function parseHostEnvelope(data: unknown): FrameEnvelope<HostOutboundMessage> | null {
  if (
    !isRecord(data) ||
    data['protocol'] !== FRAME_PROTOCOL ||
    typeof data['sessionId'] !== 'string' ||
    typeof data['frameId'] !== 'string'
  ) {
    return null;
  }
  const message = data['message'];
  if (!isRecord(message) || typeof message['type'] !== 'string' || !HOST_INBOUND_TYPES.has(message['type'])) {
    return null;
  }
  const payload = message['payload'];
  if (payload === null) {
    if (message['type'] !== 'host:dispose') {
      return null;
    }
  } else if (!isRecord(payload)) {
    return null;
  }
  return data as unknown as FrameEnvelope<HostOutboundMessage>;
}

/**
 * 启动平台帧运行时（子帧侧通道状态机）。
 *
 * @param environment 注入环境。
 * @returns 运行时句柄。
 */
export function startFrameRuntime(environment: IFrameRuntimeEnvironment): IFrameRuntimeHandle {
  const diagnostics = environment.diagnostics;
  const token = environment.readToken();
  let disposed = false;
  let port: IFrameRuntimePort | null = null;
  let session: { sessionId: string; frameId: string } | null = null;
  let initialized = false;
  let role: FrameRole = 'card';
  let limits: FrameLimits | null = null;
  let detachHandshake: (() => void) | null = null;
  let detachHeightObserver: (() => void) | null = null;

  // --- 高度上报状态（§9.4 子帧侧算法）---
  let frameQueued = false;
  let pendingHeight: number | null = null;
  let lastSentHeight: number | null = null;
  let lastSentEpoch = 0;
  let lastAckedEpoch = 0;

  const teardown = (): void => {
    disposed = true;
    detachHandshake?.();
    detachHandshake = null;
    detachHeightObserver?.();
    detachHeightObserver = null;
    port?.close();
    port = null;
  };

  const send = (message: { readonly type: string; readonly payload: unknown }): void => {
    if (port === null || session === null) {
      return;
    }
    environment.post(port, createFrameEnvelope(session.sessionId, session.frameId, message));
  };

  const queueHeightFrame = (): void => {
    if (disposed || port === null || frameQueued) {
      return;
    }
    frameQueued = true;
    environment.scheduleFrame(() => {
      frameQueued = false;
      flushHeight();
    });
  };

  /** rAF 末读取测量并合并上报：同帧多次变化只产生一条；<1px 忽略；epoch 单调递增。 */
  const flushHeight = (): void => {
    if (disposed || port === null || !initialized) {
      return;
    }
    const measured = pendingHeight ?? environment.measureHeight();
    pendingHeight = measured;
    // §9.4 第 5 条：超过 maxHeight 不再增长（上报冻结在钳制值，帧内转纵向滚动）。
    const reported = limits === null ? measured : Math.min(measured, limits.maxHeight);
    const deltaEnough = lastSentHeight === null || Math.abs(reported - lastSentHeight) >= 1;
    const awaitingResend = lastSentHeight !== null && reported !== lastSentHeight && lastAckedEpoch < lastSentEpoch;
    if (!deltaEnough && !awaitingResend) {
      return;
    }
    const epoch = lastSentEpoch + 1;
    send({ type: 'frame:height', payload: { height: reported, epoch } });
    lastSentEpoch = epoch;
    lastSentHeight = reported;
  };

  const onPortMessage = (event: { readonly data: unknown }): void => {
    if (disposed || port === null || session === null) {
      return;
    }
    const envelope = parseHostEnvelope(event.data);
    if (
      envelope === null ||
      envelope.sessionId !== session.sessionId ||
      envelope.frameId !== session.frameId
    ) {
      diagnostics.warn('入站消息未列入 host:* 清单或封套与登记不一致，忽略并记录');
      return;
    }
    dispatchHostMessage(envelope.message);
  };

  const applyInit = (payload: FrameInitPayload): void => {
    role = payload.role;
    limits = payload.limits;
    environment.applyTokens(payload.tokens);
    environment.createNodeContainers(payload.nodes);
    initialized = true;
    // §9.3：`frame:ready` 于装载完成、首帧提交后一次性发送（插件内容臂由后续波次在同一
    // 装载时序内接入；本运行时提交的是平台帧壳首帧）。
    const capabilities: readonly FrameCapability[] = ['measure'];
    send({ type: 'frame:ready', payload: { capabilities } });
    detachHeightObserver = environment.observeHeight(() => {
      pendingHeight = environment.measureHeight();
      queueHeightFrame();
    });
    queueHeightFrame();
  };

  const dispatchHostMessage = (message: HostOutboundMessage): void => {
    switch (message.type) {
      case 'host:init': {
        if (initialized) {
          diagnostics.warn('host:init 重复下发（每会话仅一次），忽略');
          return;
        }
        applyInit(message.payload);
        return;
      }
      case 'host:update': {
        if (!initialized) {
          diagnostics.warn('host:update 先于 host:init 到达，忽略');
          return;
        }
        environment.clearNodeContainers();
        queueHeightFrame();
        return;
      }
      case 'host:height-ack': {
        const ackEpoch = message.payload.epoch;
        if (typeof ackEpoch !== 'number' || ackEpoch < lastAckedEpoch) {
          diagnostics.warn('height-ack epoch 非法或倒退，忽略');
          return;
        }
        lastAckedEpoch = ackEpoch;
        // ack 前累积的变化若与最近发送值不一致，下一次 rAF 重发（§9.4 第 4 条）。
        if (pendingHeight !== null && reportedCandidateDiffers()) {
          queueHeightFrame();
        }
        return;
      }
      case 'host:action-error': {
        diagnostics.warn('父帧拒绝了帧动作', { requestId: message.payload.requestId, code: message.payload.error.code });
        return;
      }
      case 'host:entries': {
        // 条目 ticket 只允许发往布局帧（§9.3）；布局帧的条目消费面随箱子渲染波次开通。
        if (role === 'box-layout') {
          diagnostics.warn('host:entries 已收到（布局帧条目消费随箱子渲染波次开通），暂不处理');
        } else {
          diagnostics.warn('非布局帧收到 host:entries（协议违规），忽略');
        }
        return;
      }
      case 'host:dispose': {
        send({ type: 'frame:dispose-ack', payload: null });
        teardown();
        return;
      }
      default: {
        return;
      }
    }
  };

  /** pending 与最近发送值是否不一致（与 §9.4 第 4 条的重发判定同源，含 maxHeight 钳制）。 */
  const reportedCandidateDiffers = (): boolean => {
    if (pendingHeight === null) {
      return false;
    }
    const reported = limits === null ? pendingHeight : Math.min(pendingHeight, limits.maxHeight);
    return reported !== lastSentHeight;
  };

  const handle: IFrameRuntimeHandle = {
    get session() {
      return session;
    },
    get initialized() {
      return initialized;
    },
    abort(): void {
      teardown();
    },
  };

  if (token.length === 0) {
    diagnostics.error('帧入口缺少一次性握手令牌（URL fragment），运行时不启动');
    return handle;
  }
  detachHandshake = environment.addHandshakeListener(onHandshake);
  return handle;

  function onHandshake(event: IFrameHandshakeEvent): void {
    if (disposed || port !== null) {
      return;
    }
    const data = event.data;
    if (
      !isRecord(data) ||
      data['protocol'] !== FRAME_PROTOCOL ||
      data['type'] !== 'host:handshake' ||
      typeof data['sessionId'] !== 'string' ||
      typeof data['frameId'] !== 'string' ||
      data['token'] !== token
    ) {
      diagnostics.warn('握手消息未通过令牌/形状校验，忽略');
      return;
    }
    const remotePort = event.ports[0];
    if (
      typeof remotePort !== 'object' ||
      remotePort === null ||
      typeof (remotePort as IFrameRuntimePort).postMessage !== 'function' ||
      typeof (remotePort as IFrameRuntimePort).addEventListener !== 'function'
    ) {
      diagnostics.error('握手未携带可用端口');
      return;
    }
    session = { sessionId: data['sessionId'], frameId: data['frameId'] };
    port = remotePort as IFrameRuntimePort;
    detachHandshake?.();
    detachHandshake = null;
    environment.addPortListener(port, onPortMessage);
    port.start?.();
  }
}

// --- 生产环境装配（浏览器语境自举）---

/** 构造生产形态帧运行时环境（DOM / MessagePort / ResizeObserver / rAF 直连）。 */
export function createDefaultFrameRuntimeEnvironment(
  win: Window & typeof globalThis,
  doc: Document
): IFrameRuntimeEnvironment {
  const rootScroller = (): HTMLElement => doc.body;
  return {
    readToken(): string {
      return decodeURIComponent(win.location.hash.replace(/^#/, ''));
    },
    addHandshakeListener(listener): () => void {
      const handler = (event: MessageEvent): void => {
        listener({ data: event.data, ports: event.ports });
      };
      win.addEventListener('message', handler);
      return () => {
        win.removeEventListener('message', handler);
      };
    },
    addPortListener(port, listener): void {
      // 运行时真实对象为 DOM `MessagePort`；注入面 `IFrameRuntimePort` 是其结构子集，
      // 事件形状只消费 `data` 字段，经结构桥接传递。
      (port as unknown as MessagePort).addEventListener('message', (event: MessageEvent) => {
        listener({ data: event.data });
      });
    },
    scheduleFrame(callback): void {
      win.requestAnimationFrame(() => {
        callback();
      });
    },
    measureHeight(): number {
      return Math.ceil(rootScroller().scrollHeight);
    },
    observeHeight(listener): () => void {
      const observer = new win.ResizeObserver(listener);
      observer.observe(rootScroller());
      return () => {
        observer.disconnect();
      };
    },
    applyTokens(tokens): void {
      for (const [name, value] of Object.entries(tokens)) {
        doc.documentElement.style.setProperty(name, value);
      }
    },
    createNodeContainers(nodes): void {
      const host = doc.getElementById('chips-frame-nodes');
      if (host === null) {
        return;
      }
      for (const node of nodes) {
        const container = doc.createElement('div');
        container.id = node.containerId;
        container.dataset['chipsNodeId'] = node.node_id;
        container.dataset['chipsCardType'] = node.card_type;
        host.append(container);
      }
    },
    clearNodeContainers(): void {
      const host = doc.getElementById('chips-frame-nodes');
      if (host !== null) {
        host.replaceChildren();
      }
    },
    post(port, message): void {
      port.postMessage(message);
    },
    diagnostics: {
      warn(message, details): void {
        console.warn(`[chips-frame] ${message}`, details ?? '');
      },
      error(message, details): void {
        console.error(`[chips-frame] ${message}`, details ?? '');
      },
    },
  };
}

/** 浏览器语境自举守卫：帧入口页加载即启动运行时（真实 iframe 环境带令牌 fragment）。 */
if (typeof globalThis.window !== 'undefined' && typeof globalThis.document !== 'undefined') {
  startFrameRuntime(createDefaultFrameRuntimeEnvironment(globalThis.window, globalThis.document));
}
