/**
 * 渲染会话与渲染引擎（壳渲染进程 RenderHost 层）。
 *
 * 权威：`05-渲染引擎设计` §2.2（六阶段链路）、§2.4（渲染会话模型）、§2.3（跨进程时序）、
 * §9.3（`host:update` 的 revision 约束）、§11（错误模型）。
 *
 * @remarks
 * - 会话状态机：`opening → ready | error`，终态 `disposed`；`update(view, revision)` 仅在 `ready`
 *   生效，revision 严格递增、回退/重复忽略并记录诊断（§2.4 第 5 条）。
 * - dispose 固定顺序（§2.4 第 4 条）：帧销毁 → 端口关闭 → 挂载点清理；幂等。
 * - 编辑态回流（§8.3 唯一时序）由编辑链路经 `document:write` 推进 revision 后调用
 *   `update(view, revision)`；本模块不接收裸提交。
 */

import { CardFrameHost } from './card-frame-host.js';
import type { ICardFrameHostLike, ICardFrameHostOptions } from './card-frame-host.js';
import { FrameHeightCache, frameHeightCacheKey } from './frame-height.js';
import { createRenderError, RENDER_ERROR_CODES } from './codes.js';
import type { RenderErrorCode } from './codes.js';
import { normalizeDocumentFailure } from './document-gateway.js';
import type { IRenderDocumentGateway } from './document-gateway.js';
import { ChipsError, toChipsError } from '../preload/chips-error.js';
import type { DocumentKind } from '../capabilities/document/contract.js';
import type { FrameActionPayload, FrameLimits, FrameRole, ICardRenderView } from './frame-protocol.js';
import type { DesignTokens } from './frame-protocol.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';

/** 渲染模式（§2.4 `RenderMode`）。 */
export type RenderMode = 'view' | 'edit';

/** 渲染会话状态（§2.4 `RenderSessionState`）。 */
export type RenderSessionState = 'opening' | 'ready' | 'error' | 'disposed';

/** 渲染请求（§2.4 `RenderRequest`）。 */
export interface RenderRequest {
  readonly kind: DocumentKind;
  readonly source: string;
  readonly mode: RenderMode;
  readonly options?: {
    /** 高度上限（px）；缺省取平台帧限制。 */
    readonly maxHeight?: number;
    /** 取消信号；触发后会话静默停止（不进入 error）。 */
    readonly signal?: AbortSignal;
  };
}

/** 渲染会话事件表（§2.4 `RenderEventMap`）。 */
export interface RenderEventMap {
  ready: { readonly sessionId: string };
  error: ChipsError;
  'height-changed': { readonly height: number };
  disposed: { readonly sessionId: string };
}

/** 渲染事件名联合。 */
export type RenderEventName = keyof RenderEventMap;

/** 事件订阅句柄。 */
export interface IRenderSubscription {
  dispose(): void;
}

/** 渲染会话（§2.4 `IRenderSession`）。 */
export interface IRenderSession {
  readonly id: string;
  readonly kind: DocumentKind;
  readonly mode: RenderMode;
  readonly state: RenderSessionState;
  /** 会话失败信息（未失败为 `null`）。 */
  readonly error: ChipsError | null;
  mount(container: HTMLElement): Promise<void>;
  unmount(): void;
  update(view: ICardRenderView, revision: number): Promise<void>;
  subscribe<TEvent extends RenderEventName>(
    event: TEvent,
    handler: (payload: RenderEventMap[TEvent]) => void,
  ): IRenderSubscription;
  dispose(): Promise<void>;
}

/** 渲染引擎（§2.4 `IRenderEngine`）。 */
export interface IRenderEngine {
  open(request: RenderRequest): Promise<IRenderSession>;
}

/** 渲染帧环境（平台侧注入，见开发计划「遗留与移交」集成缝 2/4）。 */
export interface IRenderFrameEnvironment {
  /** 渲染帧运行时入口 URL（`chips-resource://platform/frame.html`）。 */
  readonly frameEntryUrl: string;
  /** 渲染进程 Design Tokens（`@chips/ui` Design Tokens 的 CSS 变量表）。 */
  readonly tokens: DesignTokens;
  /** 帧动作执行器：RenderHost 经 Bridge 能力转发并做权限判定（§9.3）。 */
  readonly executeAction: (action: FrameActionPayload) => Promise<void>;
}

/**
 * 文档视图构建端口（正式实现=主进程文档视图构建器，05.02 §2.6；集成缝 1，刀3 交付：
 * `document-view-builder.ts` `createDocumentViewBuilder`——经 §6.4 冻结注入面逐字调用
 * `buildDocumentView(handle, sessionId)`，组合根接线属刀4）。
 */
export interface IDocumentViewBuilder {
  buildView(input: {
    readonly source: string;
    readonly documentId: string;
    readonly kind: DocumentKind;
  }): Promise<ICardRenderView>;
}

/** 渲染引擎绑定依赖。 */
export interface IRenderEngineBindings {
  /** 文档消费网关（Bridge 或服务形态）。 */
  readonly document: IRenderDocumentGateway;
  /** 文档视图构建端口。 */
  readonly viewBuilder: IDocumentViewBuilder;
  /** 渲染帧环境。 */
  readonly frames: IRenderFrameEnvironment;
  /** 资源基址（`resourceBase`；资源管理器正式绑定属 W3，集成缝 2）。 */
  readonly resourceBase: string;
  /** 插件渲染入口映射（类型标识 → 插件渲染入口；装载器正式绑定属 #56，集成缝 2）。 */
  readonly pluginEntries: Readonly<Record<string, string>>;
  /** 平台帧尺寸限制。 */
  readonly limits: FrameLimits;
  /** 高度缓存（跨会话共享，可缺省）。 */
  readonly heightCache?: FrameHeightCache;
  /** 诊断口。 */
  readonly diagnostics: DiagnosticsSink;
  /** 帧宿主工厂（测试注入替身；缺省创建 {@link CardFrameHost}）。 */
  readonly frameHostFactory?: (options: ICardFrameHostOptions) => ICardFrameHostLike;
}

/** 会话事件监听器集合（按事件名分组）。 */
type ListenerMap = {
  [TEvent in RenderEventName]: Set<(payload: RenderEventMap[TEvent]) => void>;
};

/**
 * 创建渲染引擎（§2.4 `IRenderEngine.open`）。
 *
 * @remarks 本交付面为卡片查看态（`kind: 'card'` + `mode: 'view'`）；箱子渲染（§7）与编辑态就近
 * 渲染容器（§8，随编辑链路交付）属后续波次，请求校验对其余取值按输入无效拒绝。
 */
export function createRenderEngine(bindings: IRenderEngineBindings): IRenderEngine {
  const diagnostics = bindings.diagnostics;

  function validateRequest(request: RenderRequest): void {
    if (request.kind !== 'card' || request.mode !== 'view') {
      throw new ChipsError({
        code: 'BRIDGE_INVALID_INPUT',
        message: '渲染请求无效：当前渲染入口仅支持卡片查看态（kind=card、mode=view）',
      });
    }
    if (request.source.length === 0) {
      throw new ChipsError({
        code: 'BRIDGE_INVALID_INPUT',
        message: '渲染请求无效：来源 URI 不能为空',
      });
    }
  }

  return {
    open(request: RenderRequest): Promise<IRenderSession> {
      validateRequest(request);
      const sessionId = `render-${crypto.randomUUID()}`;
      const session = new CardRenderSession(sessionId, request, bindings, diagnostics);
      void session.startPipeline();
      return Promise.resolve(session);
    },
  };
}

/**
 * 卡片渲染会话实现。
 */
class CardRenderSession implements IRenderSession {
  readonly id: string;
  readonly kind: DocumentKind = 'card';
  readonly mode: RenderMode = 'view';
  private stateValue: RenderSessionState = 'opening';
  private readonly request: RenderRequest;
  private readonly bindings: IRenderEngineBindings;
  private readonly diagnostics: DiagnosticsSink;
  private readonly listeners: ListenerMap = {
    ready: new Set(),
    error: new Set(),
    'height-changed': new Set(),
    disposed: new Set(),
  };
  private readonly limits: FrameLimits;
  private readonly abortController = new AbortController();
  private frameHost: ICardFrameHostLike | null = null;
  private container: HTMLElement | null = null;
  private lastView: ICardRenderView | null = null;
  private lastRevision = 0;
  private lastError: ChipsError | null = null;
  private mountWaiter: (() => void) | null = null;
  private started = false;

  constructor(id: string, request: RenderRequest, bindings: IRenderEngineBindings, diagnostics: DiagnosticsSink) {
    this.id = id;
    this.request = request;
    this.bindings = bindings;
    this.diagnostics = diagnostics;
    const maxHeight =
      request.options?.maxHeight === undefined
        ? bindings.limits.maxHeight
        : Math.min(request.options.maxHeight, bindings.limits.maxHeight);
    this.limits = { ...bindings.limits, maxHeight };
  }

  /** 当前会话状态。 */
  get state(): RenderSessionState {
    return this.stateValue;
  }

  /** 会话失败信息（未失败为 `null`）。 */
  get error(): ChipsError | null {
    return this.lastError;
  }

  /** 启动解析管线（引擎 open 内调用一次；重复调用为编程错误）。 */
  async startPipeline(): Promise<void> {
    if (this.started) {
      throw createRenderError({ code: RENDER_ERROR_CODES.sessionDisposed, message: '渲染管线重复启动' });
    }
    this.started = true;
    try {
      const opened = await this.bindings.document.open({ source: this.request.source, kind: this.request.kind });
      this.throwIfAborted();
      const view = await this.bindings.viewBuilder.buildView({
        source: this.request.source,
        documentId: opened.documentId,
        kind: opened.kind,
      });
      this.throwIfAborted();
      this.lastView = view;
      this.lastRevision = view.revision;
      if (this.stateValue === 'disposed') {
        return;
      }
      this.createFrameHost(view);
      this.settleMountWaiter();
    } catch (error) {
      if (this.abortController.signal.aborted) {
        return;
      }
      this.fail(this.normalizePipelineFailure(error));
    }
  }

  /** 挂载到目标容器（可重复调用：先 `unmount()` 再挂载，§2.4 第 2 条）。 */
  async mount(container: HTMLElement): Promise<void> {
    this.assertAlive();
    if (this.stateValue === 'error') {
      // 失败会话无帧可挂载：界面由状态边界呈现降级占位，挂载即返回。
      return;
    }
    this.container = container;
    const host = this.frameHost;
    if (host !== null) {
      host.attach(container);
      return;
    }
    // 帧宿主尚未创建（解析管线在途）：等待创建后自动挂载；失败/销毁时随状态收敛返回。
    await new Promise<void>((resolve) => {
      this.mountWaiter = resolve;
    });
  }

  /** 从容器摘除（会话保持存活，可重新挂载）。 */
  unmount(): void {
    this.assertAlive();
    this.frameHost?.detach();
    this.container = null;
  }

  /** 会话视图更新（编辑链路在 `document:write` 成功后调用，revision 取其返回值）。 */
  update(view: ICardRenderView, revision: number): Promise<void> {
    try {
      this.applyUpdate(view, revision);
      return Promise.resolve();
    } catch (error) {
      // applyUpdate 的全部抛出路径均为 ChipsError；toChipsError 对其原样透传，不重复包装。
      return Promise.reject(toChipsError(error, RENDER_ERROR_CODES.updateFailed, '渲染会话更新失败'));
    }
  }

  /** 更新主体（同步校验与转发；失败保留旧帧，不产生半更新状态，§2.4 第 5 条）。 */
  private applyUpdate(view: ICardRenderView, revision: number): void {
    this.assertAlive();
    if (this.stateValue !== 'ready') {
      this.diagnostics.warn('render.session', '会话未就绪，更新被忽略', { sessionId: this.id, state: this.stateValue });
      return;
    }
    if (!Number.isInteger(revision) || revision <= this.lastRevision) {
      this.diagnostics.warn('render.session', '忽略回退或重复的 revision', {
        sessionId: this.id,
        revision,
        lastRevision: this.lastRevision,
      });
      return;
    }
    const host = this.frameHost;
    if (host === null) {
      throw createRenderError({ code: RENDER_ERROR_CODES.updateFailed, details: { sessionId: this.id } });
    }
    const previousView = this.lastView;
    const previousRevision = this.lastRevision;
    try {
      host.update(view, revision);
    } catch (error) {
      // 更新失败保留旧帧，不产生半更新状态（§2.4 第 5 条）。
      this.lastView = previousView;
      this.lastRevision = previousRevision;
      throw createRenderError({
        code: RENDER_ERROR_CODES.updateFailed,
        details: { sessionId: this.id, reason: describeError(error) },
      });
    }
    this.lastView = view;
    this.lastRevision = revision;
  }

  /** 订阅会话事件。 */
  subscribe<TEvent extends RenderEventName>(
    event: TEvent,
    handler: (payload: RenderEventMap[TEvent]) => void,
  ): IRenderSubscription {
    const set = this.listeners[event] as Set<(payload: RenderEventMap[TEvent]) => void>;
    set.add(handler);
    return {
      dispose: () => {
        set.delete(handler);
      },
    };
  }

  /** 释放会话（固定顺序、幂等）。 */
  async dispose(): Promise<void> {
    if (this.stateValue === 'disposed') {
      return;
    }
    this.stateValue = 'disposed';
    this.abortController.abort();
    const host = this.frameHost;
    this.frameHost = null;
    if (host !== null) {
      await host.dispose();
    }
    this.container = null;
    this.settleMountWaiter();
    this.emit('disposed', { sessionId: this.id });
    for (const set of Object.values(this.listeners)) {
      set.clear();
    }
  }

  /** 管线取消探针。 */
  private throwIfAborted(): void {
    if (this.abortController.signal.aborted) {
      throw new AbortError();
    }
  }

  /** 创建帧宿主并开始握手（解析成功后调用）。 */
  private createFrameHost(view: ICardRenderView): void {
    if (this.stateValue === 'disposed') {
      return;
    }
    const factory = this.bindings.frameHostFactory ?? ((options: ICardFrameHostOptions) => new CardFrameHost(options));
    const host = factory({
      sessionId: this.id,
      source: this.request.source,
      role: 'card' satisfies FrameRole,
      view,
      frameEntryUrl: this.bindings.frames.frameEntryUrl,
      resourceBase: this.bindings.resourceBase,
      pluginEntries: this.bindings.pluginEntries,
      tokens: this.bindings.frames.tokens,
      limits: this.limits,
      executeAction: this.bindings.frames.executeAction,
      diagnostics: this.diagnostics,
      ...(this.bindings.heightCache === undefined ? {} : { heightCache: this.bindings.heightCache }),
    });
    this.frameHost = host;
    host.onHeightChanged((heightPx) => {
      this.bindings.heightCache?.remember(
        frameHeightCacheKey({ role: 'card', source: this.request.source, revision: this.lastRevision }),
        heightPx,
      );
      this.emit('height-changed', { height: heightPx });
    });
    if (this.container !== null) {
      host.attach(this.container);
    }
    void host.ready
      .then(() => {
        if (this.stateValue !== 'opening') {
          return;
        }
        this.stateValue = 'ready';
        this.emit('ready', { sessionId: this.id });
      })
      .catch((error: ChipsError) => {
        this.fail(error);
      });
    host.beginHandshake().catch((error: unknown) => {
      // 帧加载失败（URL 不可达等）：按渲染失败收敛，不悬挂在 opening。
      this.fail(toChipsError(error, RENDER_ERROR_CODES.frameTimeout, '渲染帧加载失败'));
    });
  }

  /** 归一管线失败（文档域码按 §11 映射；其余原样透传）。 */
  private normalizePipelineFailure(error: unknown): ChipsError {
    if (error instanceof ChipsError) {
      return error;
    }
    return normalizeDocumentFailure(error);
  }

  /** 进入 error 状态并发事件（会话保持可 dispose）。 */
  private fail(error: ChipsError): void {
    if (this.stateValue === 'disposed' || this.stateValue === 'error') {
      return;
    }
    this.stateValue = 'error';
    this.lastError = error;
    this.diagnostics.error('render.session', '渲染会话失败', { sessionId: this.id, code: error.code });
    this.emit('error', error);
    this.settleMountWaiter();
  }

  /** 收口挂载等待（挂载完成、失败或销毁都会返回，保证 mount 有界）。 */
  private settleMountWaiter(): void {
    const waiter = this.mountWaiter;
    this.mountWaiter = null;
    waiter?.();
  }

  /** 断言会话存活（dispose 后一切操作拒绝，§2.4 第 2 条）。 */
  private assertAlive(): void {
    if (this.stateValue === 'disposed') {
      throw createRenderError({
        code: RENDER_ERROR_CODES.sessionDisposed,
        details: { sessionId: this.id },
      });
    }
  }

  /** 发布事件（监听器异常不阻断会话）。 */
  private emit<TEvent extends RenderEventName>(event: TEvent, payload: RenderEventMap[TEvent]): void {
    for (const handler of [...this.listeners[event]]) {
      try {
        handler(payload);
      } catch (error) {
        this.diagnostics.warn('render.session', '事件监听器抛错', {
          sessionId: this.id,
          event,
          reason: describeError(error),
        });
      }
    }
  }
}

/** 取消信号触发的内部中止。 */
class AbortError extends Error {
  constructor() {
    super('渲染管线已取消');
    this.name = 'AbortError';
  }
}

/** 提取错误摘要（诊断用，不含敏感内容）。 */
function describeError(error: unknown): string {
  if (error instanceof ChipsError) {
    return error.code;
  }
  return toChipsError(error).code;
}

/** 渲染错误码重导出（本层错误面唯一入口）。 */
export type { RenderErrorCode };
