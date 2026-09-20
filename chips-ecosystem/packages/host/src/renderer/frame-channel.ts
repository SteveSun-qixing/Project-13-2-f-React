/**
 * 父帧通道：宿主侧（父帧）帧协议通道的建立、路由与生命周期。
 *
 * 权威：`05-渲染引擎设计` §9.1（通道建立：一次性令牌 + MessageChannel 端口转移，信任边界为
 * 令牌 + 端口所有权，不依赖 `event.origin`）、§9.3（消息清单与约束）、§9.5（超时）、
 * §9.6（通道安全校验）。
 *
 * @remarks
 * - DOM 依赖经端口注入（端口对创建与端口转移），使通道时序可在 Node 环境确定性测试；
 *   生产形态为 `new MessageChannel()` + `iframe.contentWindow.postMessage(msg, '*', [port])`。
 * - 未列入 §9.3 清单的端口消息一律忽略并记录诊断；`sessionId` / `frameId` 与本地登记不一致的
 *   封套拒绝处理（§9.6）。
 * - `host:entries`（条目 ticket 下发）只允许发往布局帧，属箱子渲染波次（见开发计划
 *   「遗留与移交」），本通道不提供发送面。
 */

import {
  FRAME_ACTION_TIMEOUT_MS,
  FRAME_DISPOSE_ACK_TIMEOUT_MS,
  FRAME_READY_TIMEOUT_MS,
  createFrameEnvelope,
  createHandshakeTransfer,
  envelopeMatchesSession,
  asFrameAction,
  asFrameHeight,
  isFrameDisposeAck,
  isFrameEntryRequest,
  isFrameError,
  isFrameReady,
  parseFrameEnvelope,
} from './frame-protocol.js';
import type {
  FrameActionPayload,
  FrameCapability,
  FrameInitPayload,
  FrameInboundMessage,
  FrameView,
  HostInit,
  HostUpdate,
  IFrameHandshakeTransfer,
} from './frame-protocol.js';
import { createRenderError, RENDER_ERROR_CODES } from './codes.js';
import { ChipsError } from '../preload/chips-error.js';
import type { IChipsErrorShape } from '../preload/chips-error.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';

/** 端口事件形状（与 DOM `MessagePort` 同构的子集）。 */
export interface IFramePortLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { readonly data: unknown }) => void): void;
  close(): void;
}

/** 端口对（本端持有、远端转移给子帧）。 */
export interface IFramePortPair {
  readonly local: IFramePortLike;
  /** 远端端口（可转移对象；生产形态为 `MessagePort`）。 */
  readonly remote: unknown;
}

/** 通道环境依赖（DOM 交互面，可注入替身）。 */
export interface IFrameChannelEnvironment {
  /** 创建端口对；生产形态为 `new MessageChannel()`。 */
  readonly createPortPair: () => IFramePortPair;
  /**
   * 把握手转移消息与远端端口投递给子帧；生产形态为
   * `iframe.contentWindow.postMessage(message, '*', [remotePort])`（目标 `'*'`，沙箱帧为不透明源）。
   */
  readonly postToFrame: (message: IFrameHandshakeTransfer, remotePort: unknown) => void;
}

/** 通道依赖。 */
export interface IFrameChannelDeps {
  readonly sessionId: string;
  readonly frameId: string;
  /** 一次性握手令牌（随帧 URL fragment 下发，仅子帧脚本可读）。 */
  readonly token: string;
  /** 帧角色（决定协议校验分支：非布局帧的 `frame:entry-request` 视为越级违规）。 */
  readonly role: FrameRole;
  readonly environment: IFrameChannelEnvironment;
  readonly diagnostics: DiagnosticsSink;
  /** 诊断 scope；缺省 `render.channel`。 */
  readonly scope?: string;
}

/** 帧角色（重导出窄化，避免业务文件直接依赖协议模块内部）。 */
type FrameRole = 'card' | 'box-layout' | 'entry' | 'cover';

/** 帧能力就绪信息。 */
export interface IFrameReadyInfo {
  readonly capabilities: readonly FrameCapability[];
}

/** 通道入站处理回调。 */
export interface IFrameChannelHandlers {
  /** 帧就绪（每会话至多一次；重发视为协议违规）。 */
  readonly onReady: (info: IFrameReadyInfo) => void;
  /** 高度上报（逐条转发给高度控制器）。 */
  readonly onHeight: (report: { readonly height: number; readonly epoch: number }) => void;
  /** 帧动作执行；失败或超时由通道回 `host:action-error`。 */
  readonly executeAction: (action: FrameActionPayload) => Promise<void>;
  /** 帧内错误（帧级隔离：记录诊断，不改会话状态）。 */
  readonly onFrameError: (error: ChipsError) => void;
}

/** 本通道实际发送的 host:* 消息联合（`error` 以结构化克隆兼容形状过端口）。 */
type HostOutboundSend =
  | HostInit
  | HostUpdate
  | { readonly type: 'host:height-ack'; readonly payload: { readonly epoch: number } }
  | { readonly type: 'host:action-error'; readonly payload: { readonly requestId: string; readonly error: IChipsErrorShape } }
  | { readonly type: 'host:dispose'; readonly payload: null };
/** 动作请求的挂起登记。 */
interface IPendingAction {
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * 父帧帧协议通道。
 */
export class FrameChannel {
  private readonly deps: IFrameChannelDeps;
  private readonly handlers: IFrameChannelHandlers;
  private readonly events: IFrameChannelEvents;
  private localPort: IFramePortLike | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private readyConfirmed = false;
  private disposed = false;
  private readonly pendingActions = new Map<string, IPendingAction>();
  private disposeWaiter: ((value: 'ack' | 'timeout') => void) | null = null;
  private disposeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: IFrameChannelDeps, handlers: IFrameChannelHandlers, events: IFrameChannelEvents) {
    this.deps = deps;
    this.handlers = handlers;
    this.events = events;
  }

  /**
   * 启动通道：创建端口对、转移远端端口（随一次性令牌）、启动就绪超时（§9.1 第 2/3 步、§9.5）。
   */
  start(): void {
    if (this.disposed) {
      throw createRenderError({ code: RENDER_ERROR_CODES.sessionDisposed });
    }
    const pair = this.deps.environment.createPortPair();
    this.localPort = pair.local;
    pair.local.addEventListener('message', (event) => {
      this.handlePortMessage(event.data);
    });
    this.deps.environment.postToFrame(
      createHandshakeTransfer(this.deps.sessionId, this.deps.frameId, this.deps.token),
      pair.remote
    );
    this.readyTimer = setTimeout(() => {
      if (this.readyConfirmed || this.disposed) {
        return;
      }
      this.events.onReadyTimeout();
    }, FRAME_READY_TIMEOUT_MS);
  }

  /** 下发初始装载载荷（每会话仅一次；封套与通道登记一致，§9.3）。 */
  sendInit(payload: FrameInitPayload): void {
    this.sendHostMessage({ type: 'host:init', payload });
  }

  /** 下发会话视图更新（`revision` 严格递增且来自 `document:write`，由会话层守卫）。 */
  sendUpdate(view: FrameView, revision: number): void {
    this.sendHostMessage({ type: 'host:update', payload: { view, revision } });
  }

  /** 下发高度回执（高度控制器消费）。 */
  sendHeightAck(epoch: number): void {
    this.sendHostMessage({ type: 'host:height-ack', payload: { epoch } });
  }

  /** 回执动作失败（动作执行器失败或超时，requestId 必须与请求对应）。 */
  sendActionError(requestId: string, error: IChipsErrorShape): void {
    this.sendHostMessage({ type: 'host:action-error', payload: { requestId, error } });
  }

  /**
   * 下发销毁指令并等待 ack（§9.5：等待 ack 或 1s 超时后强制移除）。
   * 返回 `'ack'`（子帧确认）或 `'timeout'`（超时强制收口）。
   */
  async requestDispose(): Promise<'ack' | 'timeout'> {
    if (this.disposed) {
      return 'ack';
    }
    const outcome = await new Promise<'ack' | 'timeout'>((resolve) => {
      this.disposeWaiter = resolve;
      this.disposeTimer = setTimeout(() => {
        resolve('timeout');
      }, FRAME_DISPOSE_ACK_TIMEOUT_MS);
      this.sendHostMessage({ type: 'host:dispose', payload: null });
    });
    this.closePort();
    return outcome;
  }

  /** 关闭端口并停止全部等待（强制收口路径）。 */
  closePort(): void {
    this.disposed = true;
    if (this.readyTimer !== null) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    if (this.disposeTimer !== null) {
      clearTimeout(this.disposeTimer);
      this.disposeTimer = null;
    }
    for (const pending of this.pendingActions.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingActions.clear();
    const waiter = this.disposeWaiter;
    this.disposeWaiter = null;
    waiter?.('timeout');
    this.localPort?.close();
    this.localPort = null;
  }

  /** 发送父帧 → 子帧消息（端口已关闭或未建立时静默丢弃，不抛错）。 */
  private sendHostMessage(message: HostOutboundSend): void {
    const port = this.localPort;
    if (port === null || this.disposed) {
      return;
    }
    port.postMessage(createFrameEnvelope(this.deps.sessionId, this.deps.frameId, message));
  }

  /** 端口入站消息处理（§9.6 校验 → §9.3 路由）。 */
  private handlePortMessage(data: unknown): void {
    if (this.disposed) {
      return;
    }
    const envelope = parseFrameEnvelope(data);
    if (envelope === null) {
      this.warn('忽略未列入协议清单或形状不符的端口消息');
      return;
    }
    if (!envelopeMatchesSession(envelope, this.deps.sessionId, this.deps.frameId)) {
      this.events.onProtocolViolation(
        createRenderError({
          code: RENDER_ERROR_CODES.protocolViolation,
          details: { reason: 'session-mismatch' },
        })
      );
      return;
    }
    const message: FrameInboundMessage = envelope.message;
    if (isFrameReady(message)) {
      this.handleReady(message.payload.capabilities);
      return;
    }
    if (isFrameDisposeAck(message)) {
      const waiter = this.disposeWaiter;
      this.disposeWaiter = null;
      if (this.disposeTimer !== null) {
        clearTimeout(this.disposeTimer);
        this.disposeTimer = null;
      }
      waiter?.('ack');
      return;
    }
    const height = asFrameHeight(message);
    if (height !== null) {
      this.handlers.onHeight(height);
      return;
    }
    const action = asFrameAction(message);
    if (action !== null) {
      this.handleAction(action.requestId, action.action);
      return;
    }
    if (isFrameError(message)) {
      this.handlers.onFrameError(message.payload);
      return;
    }
    if (isFrameEntryRequest(message)) {
      // 条目请求只允许来自布局帧；其他帧发送即为越级协议违规（§9.3）。
      if (this.deps.role === 'box-layout') {
        this.warn('收到布局帧条目请求（布局帧渲染属后续波次，暂不消费）');
        return;
      }
      this.events.onProtocolViolation(
        createRenderError({
          code: RENDER_ERROR_CODES.protocolViolation,
          details: { reason: 'entry-request-from-non-layout-frame' },
        })
      );
      return;
    }
    this.warn('忽略无法归类的端口消息');
  }

  /** 就绪处理：清超时、登记能力；重发视为协议违规（§9.3）。 */
  private handleReady(capabilities: readonly FrameCapability[]): void {
    if (this.readyConfirmed) {
      this.events.onProtocolViolation(
        createRenderError({
          code: RENDER_ERROR_CODES.protocolViolation,
          details: { reason: 'frame-ready-resend' },
        })
      );
      return;
    }
    this.readyConfirmed = true;
    if (this.readyTimer !== null) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    this.handlers.onReady({ capabilities });
  }

  /** 动作处理：requestId 关联 + 5s 超时 + 失败回 `host:action-error`（§9.3/§9.5）。 */
  private handleAction(requestId: string, action: FrameActionPayload): void {
    if (this.pendingActions.has(requestId)) {
      this.warn('忽略重复 requestId 的帧动作', { requestId });
      return;
    }
    const timer = setTimeout(() => {
      if (this.pendingActions.delete(requestId)) {
        this.sendActionError(requestId, {
          code: 'BRIDGE_TIMEOUT',
          message: '帧动作执行超时',
          retryable: true,
          details: { requestId },
        });
      }
    }, FRAME_ACTION_TIMEOUT_MS);
    this.pendingActions.set(requestId, { timer });
    void this.handlers
      .executeAction(action)
      .then(() => {
        // 成功动作无回执消息（§9.3 清单中只有 host:action-error 一支）。
        this.settleAction(requestId);
      })
      .catch((error: unknown) => {
        this.settleAction(requestId);
        this.sendActionError(requestId, toChipsErrorShapeOf(error));
      });
  }

  /** 收口挂起动作（成功与失败共用；超时收口后重复收口无效）。 */
  private settleAction(requestId: string): void {
    const pending = this.pendingActions.get(requestId);
    if (pending === undefined) {
      return;
    }
    clearTimeout(pending.timer);
    this.pendingActions.delete(requestId);
  }

  /** 输出一行诊断。 */
  private warn(message: string, details?: Readonly<Record<string, unknown>>): void {
    this.deps.diagnostics.warn(this.deps.scope ?? 'render.channel', message, details);
  }
}

/** 通道生命周期事件（超时/违规归一为已登记渲染错误码）。 */
export interface IFrameChannelEvents {
  /** 就绪超时（`RENDER_FRAME_TIMEOUT`）。 */
  readonly onReadyTimeout: () => void;
  /** 协议违规（`RENDER_PROTOCOL_VIOLATION`）。 */
  readonly onProtocolViolation: (error: ChipsError) => void;
}

/** 把任意异常归一为结构化错误形状（未知异常按插件执行失败兜底）。 */
function toChipsErrorShapeOf(error: unknown): IChipsErrorShape {
  if (error instanceof ChipsError) {
    return error.toPlain();
  }
  const shape = error as { code?: unknown; message?: unknown; retryable?: unknown } | null;
  if (
    typeof shape === 'object' &&
    shape !== null &&
    typeof shape['code'] === 'string' &&
    typeof shape['message'] === 'string'
  ) {
    return {
      code: shape['code'],
      message: shape['message'],
      retryable: shape['retryable'] === true,
    };
  }
  return createRenderError({ code: RENDER_ERROR_CODES.pluginFailed, message: '帧动作执行失败' }).toPlain();
}
