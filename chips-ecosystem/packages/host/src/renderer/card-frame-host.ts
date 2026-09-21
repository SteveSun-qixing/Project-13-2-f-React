/**
 * 顶层卡片帧宿主：RenderHost 与单个卡片渲染帧（iframe 沙箱）之间的协议承载。
 *
 * 权威：`05-渲染引擎设计` §6.2（帧初始化与节点容器声明）、§6.3（编排与测量）、
 * §4.2（sandbox 属性基线）、§9.1/§9.3/§9.6（通道与协议）。
 *
 * @remarks
 * - 帧入口 URL 与动作执行器经端口注入（渲染帧运行时随平台构建产物经 `chips-resource://platform/`
 *   提供，正式绑定见开发计划「遗留与移交」）；本模块承载的协议时序是完整实现。
 * - 单帧失败不影响兄弟帧与会话（§6.4）：`frame:error` 只记录诊断，不改会话状态。
 */

import { FrameChannel } from './frame-channel.js';
import type { IFrameChannelEnvironment } from './frame-channel.js';
import { FrameHeightController, FrameHeightCache, frameHeightCacheKey } from './frame-height.js';
import { createRenderError, RENDER_ERROR_CODES } from './codes.js';
import { ChipsError } from '../preload/chips-error.js';
import type {
  DesignTokens,
  FrameActionPayload,
  FrameInitPayload,
  FrameLimits,
  FrameNodeInit,
  FrameRole,
  ICardRenderView,
} from './frame-protocol.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';

/** 卡片帧宿主选项。 */
export interface ICardFrameHostOptions {
  /** 渲染会话标识（封套登记）。 */
  readonly sessionId: string;
  /** 文档来源 URI（高度缓存键与诊断）。 */
  readonly source: string;
  /** 帧角色（本交付面为卡片帧）。 */
  readonly role?: FrameRole;
  /** 初始卡片渲染视图（文档视图构建器产物，只读）。 */
  readonly view: ICardRenderView;
  /** 渲染帧入口 URL（平台帧运行时，`chips-resource://platform/frame.html`）。 */
  readonly frameEntryUrl: string;
  readonly resourceBase: string;
  readonly pluginEntries: Readonly<Record<string, string>>;
  readonly tokens: DesignTokens;
  readonly limits: FrameLimits;
  /** 帧动作执行器（RenderHost 经 Bridge 转发并做权限判定）。 */
  readonly executeAction: (action: FrameActionPayload) => Promise<void>;
  readonly diagnostics: DiagnosticsSink;
  /** 高度缓存（首屏占位估算，跨会话共享）。 */
  readonly heightCache?: FrameHeightCache;
  /** DOM 文档（缺省 `globalThis.document`；测试注入）。 */
  readonly document?: Document;
  /** 通道环境（缺省 MessageChannel + contentWindow.postMessage；测试注入）。 */
  readonly channelEnvironment?: IFrameChannelEnvironment;
  /** 帧 load 完成信号（缺省等待 iframe `load` 事件；测试注入立即 resolve 的信号）。 */
  readonly frameLoadSignal?: Promise<void>;
}

/** 卡片帧宿主消费面（渲染会话只依赖此面，便于测试注入替身）。 */
export interface ICardFrameHostLike {
  /** 帧根元素（iframe；由会话挂载/摘除到目标容器）。 */
  readonly element: HTMLElement;
  /** 帧就绪（`frame:ready` 送达）；失败以渲染域 `ChipsError` 拒绝。 */
  readonly ready: Promise<void>;
  /** 已应用高度（未上报过为 `null`）。 */
  readonly appliedHeight: number | null;
  /** 挂载到目标容器。 */
  attach(container: HTMLElement): void;
  /** 从容器摘除（帧保持存活，供重新挂载）。 */
  detach(): void;
  /** 下发 `host:update` 并解除高度冻结。 */
  update(view: ICardRenderView, revision: number): void;
  /** 销毁帧（`host:dispose` → ack/1s 超时 → 端口关闭 → 元素摘除）。 */
  dispose(): Promise<void>;
  /** 订阅已应用高度变化（clamp 后的 iframe 高度）。 */
  onHeightChanged(listener: (heightPx: number) => void): void;
  /** 开始握手（等待帧 load → 通道建立 → 下发 `host:init`）。 */
  beginHandshake(): Promise<void>;
}

/** 把一次性握手令牌并入帧入口 URL 的 fragment（§9.1 第 1 条：URL 携带令牌，仅子帧脚本可读）。 */
function appendTokenFragment(frameEntryUrl: string, token: string): string {
  const hashIndex = frameEntryUrl.indexOf('#');
  const base = hashIndex === -1 ? frameEntryUrl : frameEntryUrl.slice(0, hashIndex);
  return `${base}#${token}`;
}

/** 按视图内容节点逐项构造节点容器声明（与 `content_nodes` 逐项对应且顺序一致，§6.2）。 */
function buildNodeInits(view: ICardRenderView): readonly FrameNodeInit[] {
  return view.content_nodes.map((node) => ({
    node_id: node.node_id,
    card_type: node.card_type,
    containerId: `chips-node-${node.node_id}`,
  }));
}

/**
 * 顶层卡片帧宿主。
 */
export class CardFrameHost implements ICardFrameHostLike {
  private readonly options: ICardFrameHostOptions;
  private readonly frameId: string;
  private readonly token: string;
  private readonly frameElement: HTMLIFrameElement;
  private readonly channel: FrameChannel;
  private readonly heightController: FrameHeightController;
  private readonly listeners = new Set<(heightPx: number) => void>();
  private readonly loadSignal: Promise<void>;
  private readonly readyPromise: Promise<void>;
  private settleReady: ((value: void) => void) | null = null;
  private settleFailed: ((error: ChipsError) => void) | null = null;
  private handshakeStarted = false;
  private disposed = false;

  constructor(options: ICardFrameHostOptions) {
    this.options = options;
    this.frameId = `frame-${crypto.randomUUID()}`;
    this.token = crypto.randomUUID();
    const dom = options.document ?? globalThis.document;
    this.frameElement = dom.createElement('iframe');
    this.frameElement.setAttribute('title', '卡片渲染帧');
    this.frameElement.setAttribute('sandbox', 'allow-scripts');
    this.frameElement.setAttribute('referrerpolicy', 'no-referrer');
    this.frameElement.setAttribute('data-chips-frame-id', this.frameId);
    this.frameElement.src = appendTokenFragment(options.frameEntryUrl, this.token);
    // 初始高度：高度缓存命中时用历史值做首屏占位（§9.4 第 8 条），否则取下限。
    const initialKey = frameHeightCacheKey({
      role: options.role ?? 'card',
      source: options.source,
      revision: options.view.revision,
    });
    const initialHeight = options.heightCache?.estimate(initialKey) ?? options.limits.minHeight;
    this.frameElement.style.width = '100%';
    this.frameElement.style.height = `${initialHeight}px`;
    this.frameElement.style.border = 'none';
    this.frameElement.style.display = 'block';

    this.loadSignal =
      options.frameLoadSignal ??
      new Promise<void>((resolve) => {
        this.frameElement.addEventListener('load', () => {
          resolve();
        });
      });

    this.channel = new FrameChannel(
      {
        sessionId: options.sessionId,
        frameId: this.frameId,
        token: this.token,
        role: options.role ?? 'card',
        environment: options.channelEnvironment ?? this.createDefaultEnvironment(),
        diagnostics: options.diagnostics,
      },
      {
        onReady: () => {
          this.settleReady?.();
        },
        onHeight: (report) => {
          this.heightController.handleReport(report.height, report.epoch);
        },
        executeAction: (action) => options.executeAction(action),
        onFrameError: (error) => {
          // 帧级错误边界（§6.4）：记录诊断，不改会话状态、不断开通道。
          options.diagnostics.warn('render.frame', '帧内错误', { frameId: this.frameId, code: error.code });
        },
      },
      {
        onReadyTimeout: () => {
          this.settleFailed?.(
            createRenderError({ code: RENDER_ERROR_CODES.frameTimeout, details: { frameId: this.frameId } }),
          );
        },
        onProtocolViolation: (error) => {
          this.settleFailed?.(error);
        },
      },
    );

    this.heightController = new FrameHeightController({
      limits: options.limits,
      applyHeight: (heightPx) => {
        this.frameElement.style.height = `${heightPx}px`;
        for (const listener of this.listeners) {
          listener(heightPx);
        }
      },
      sendAck: (epoch) => {
        this.channel.sendHeightAck(epoch);
      },
      diagnostics: options.diagnostics,
    });

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.settleReady = resolve;
      this.settleFailed = reject;
    });
  }

  /** 帧根元素。 */
  get element(): HTMLIFrameElement {
    return this.frameElement;
  }

  /** 帧就绪承诺。 */
  get ready(): Promise<void> {
    return this.readyPromise;
  }

  /** 已应用高度。 */
  get appliedHeight(): number | null {
    return this.heightController.appliedHeight;
  }

  /** 挂载到目标容器。 */
  attach(container: HTMLElement): void {
    container.appendChild(this.frameElement);
  }

  /** 从容器摘除（帧保持存活，供重新挂载）。 */
  detach(): void {
    this.frameElement.remove();
  }

  /** 订阅已应用高度变化。 */
  onHeightChanged(listener: (heightPx: number) => void): void {
    this.listeners.add(listener);
  }

  /** 开始握手：等待帧 load → 通道建立 → 下发 `host:init`（§9.1 时序）。 */
  async beginHandshake(): Promise<void> {
    if (this.handshakeStarted) {
      return;
    }
    if (this.disposed) {
      throw createRenderError({ code: RENDER_ERROR_CODES.sessionDisposed });
    }
    this.handshakeStarted = true;
    await this.loadSignal;
    if (this.disposed) {
      return;
    }
    this.channel.start();
    const payload: FrameInitPayload = {
      role: this.options.role ?? 'card',
      view: this.options.view,
      nodes: buildNodeInits(this.options.view),
      resourceBase: this.options.resourceBase,
      pluginEntries: this.options.pluginEntries,
      tokens: this.options.tokens,
      limits: this.options.limits,
    };
    this.channel.sendInit(payload);
  }

  /** 下发 `host:update` 并解除高度冻结（新视图内容重建后高度重新跟随）。 */
  update(view: ICardRenderView, revision: number): void {
    if (this.disposed) {
      throw createRenderError({ code: RENDER_ERROR_CODES.sessionDisposed });
    }
    this.heightController.resetFreeze();
    this.channel.sendUpdate(view, revision);
  }

  /** 销毁帧。 */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.handshakeStarted) {
      await this.channel.requestDispose();
    } else {
      this.channel.closePort();
    }
    this.frameElement.remove();
  }

  /** 生产通道环境：MessageChannel 端口对 + contentWindow 端口转移（§9.1 第 2 条）。 */
  private createDefaultEnvironment(): IFrameChannelEnvironment {
    return {
      createPortPair: () => {
        const pair = new MessageChannel();
        return { local: pair.port1, remote: pair.port2 };
      },
      postToFrame: (message, remotePort) => {
        this.frameElement.contentWindow?.postMessage(message, '*', [remotePort as Transferable]);
      },
    };
  }
}
