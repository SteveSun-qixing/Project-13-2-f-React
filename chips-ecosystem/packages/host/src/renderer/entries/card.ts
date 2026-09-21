/**
 * 卡片窗口入口（应用窗口壳的 RenderHost 组合根）。
 *
 * 权威：`05-渲染引擎设计` §2.2–§2.4（六阶段链路与渲染会话模型）、§2.3（跨进程时序：
 * 解析请求经 Bridge、`DocumentView` 经宿主内部取视图通道回传）、§2.6（构建执行位主进程）、
 * §3.2（React 壳分层：Surface 一个会话一个挂载点）、§6.4（降级占位）、§8.3（变更回流唯一
 * 时序：`document:write` → 写后重建 → `session.update`）、§9.1（帧入口经
 * `chips-resource://platform/` 装载）、§7.3（卡片帧 `maxNestedFrames = 0`）；
 * `02-Bridge三层设计` §2.1（渲染进程数据触达经 `window.chips` 正式链路）；
 * 工单035 裁定一（取视图通道是宿主自有壳进程↔主进程 IPC，非插件能力、不经 `window.chips`）。
 *
 * @remarks
 * - 本入口只**消费**渲染面既有导出（`../index.js`），不修改其中任何一行。
 * - `mountCardWindow` 是完整组合根：Bridge 文档网关 + 冻结契约取视图通道消费臂 + 帧环境 +
 *   React `CardRenderer` 挂载 + 编辑回流协调器生产组合，输入为一张卡片的窗口装载描述
 *   （`ICardWindowInit`）。
 * - 视图臂（缝②收口，任务 #112）：`viewBuilder` = `createDocumentViewChannelBuilder`——
 *   消费 #105 冻结封套经宿主内部 `document-view:request` 通道取视图，替代 #100 波次的暂行
 *   `createBridgeCardViewBuilder`（旧臂走 `document:read` 结构分片，已退役归档）。传输注入端口
 *   `IDocumentViewChannelInvoke` 由窗口装载层（preload 第二 contextBridge 世界
 *   `window[HOST_VIEW_CHANNEL_SURFACE_KEY]`）供给，通道名钉死在 preload 侧，本入口不触达任意 IPC。
 * - 回流协调器（缝③收口，任务 #112）：`createDocumentReflowCoordinator` 生产组合接入本入口——
 *   每次 `engine.open` 得到会话即按该会话构造协调器（写臂 `createBridgeDocumentWritePort` 经
 *   `window.chips`、视图重建经同一取视图通道消费臂、变更订阅经 `window.chips.subscribe`），
 *   `handle.executeAction` 承载 §8.3 唯一时序；随会话 dispose 幂等收口。
 * - 窗口装载描述的投递臂（任务 #120 接线，契约 #119 冻结）：经第三 contextBridge 世界
 *   `window[CARD_WINDOW_INIT_SURFACE_KEY]` 的 `requestInit` 往返主进程登记表——请求封套发送侧
 *   自检 `validateCardWindowInitRequest`、到达侧权威闸 `validateCardWindowInitResponse`，
 *   `payload` 与 `ICardWindowInit` 逐字段同形（编译期互派生锁保证零适配直传 `mountCardWindow`）；
 *   pending/绑定未就绪为合法瞬态——有上限的诚实空闲重试（`setTimeout` 节奏），终态码落诊断收口，
 *   全程不伪造装载（工单035 §10.3 待办 3）。
 * - 空载态与降级占位全部经 `@chips/ui` `StateBoundary`；界面文案简体中文直写；
 *   视觉走 `@chips/ui` / antd token，本文件不写样式。
 */

/// <reference lib="dom" />

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { normalizeError } from '@chips/bridge';
import { StateBoundary } from '@chips/ui';

import {
  CardRenderer,
  RENDER_ERROR_CODES,
  createBridgeDocumentGateway,
  createBridgeDocumentWritePort,
  createDocumentReflowCoordinator,
  createDocumentViewChannelBuilder,
  createRenderEngine,
  createRenderError,
} from '../index.js';
import type {
  DesignTokens,
  DocumentReflowAction,
  IChipsRequestFacade,
  IDocumentReflowCoordinator,
  IDocumentViewBuilder,
  IDocumentViewChannelInvoke,
  IRenderEngine,
  IRenderEngineBindings,
  IRenderSession,
  RenderRequest,
} from '../index.js';
import type { DiagnosticsSink } from '../../shared/diagnostics.js';
import {
  CARD_WINDOW_INIT_CHANNEL_ERROR_CODES,
  CARD_WINDOW_INIT_SURFACE_KEY,
  createCardWindowInitFetchRequest,
  isCardWindowInitPending,
  isCardWindowInitResult,
  validateCardWindowInitRequest,
  validateCardWindowInitResponse,
} from '../../shared/card-window-init-surface.js';
import type { ICardWindowInitSurface } from '../../shared/card-window-init-surface.js';
import { HOST_VIEW_CHANNEL_SURFACE_KEY } from '../../shared/host-view-channel-surface.js';
import type { IHostViewChannelSurface } from '../../shared/host-view-channel-surface.js';
import { createFrameActionForwarder } from './bridge-data-plane.js';

/** 渲染层入口侧的帧运行时入口 URL（与主进程 `window-entries.ts` 登记一致，注册表锁锁定）。 */
export const FRAME_ENTRY_URL = 'chips-resource://platform/entries/frame.html';

/** 平台卡片帧限制初始值（`maxNestedFrames = 0` 为 §7.3 冻结值；上下限随装载输入覆盖）。 */
export const PLATFORM_CARD_FRAME_LIMITS: IRenderEngineBindings['limits'] = Object.freeze({
  minHeight: 1,
  maxHeight: 100_000,
  maxNestedFrames: 0,
});

/** 卡片窗口装载描述（主进程编排 → 窗口壳的输入面；投递臂属集成缝）。 */
export interface ICardWindowInit {
  /** 文档来源引用（`RenderRequest.source`）。 */
  readonly source: string;
  /**
   * 本窗口展示文档的稳定标识（十位 Base62 `card_id` 别名，`05-ID生成规范` §二.1）——
   * 回流协调器（§8.3 写后重建）的会话级定位键。查看态视图构建的 `documentId` 由解析管线的
   * `document:open` 回包提供（与本源指向同一文档，二者一致性由主进程装载投递臂承载，属 #99
   * 在册集成缝）；本字段服务于编辑回流腿，不替代管线自身的 open→buildView 定位链。
   */
  readonly documentId: string;
  /** 资源基址（资源管理器作用域产物；W3 接线前由装载输入携带）。 */
  readonly resourceBase: string;
  /** 插件渲染入口映射（类型标识 → 插件渲染入口 URL；装载器正式绑定随插件链路波次）。 */
  readonly pluginEntries: Readonly<Record<string, string>>;
  /** Design Tokens（CSS 变量表；`@chips/ui` token 经主进程快照下发）。 */
  readonly tokens: DesignTokens;
}

/**
 * 卡片窗口消费的 `window.chips` 面（在渲染网关最小面之上追加事件订阅腿）。
 *
 * @remarks 回流协调器的 `document:changed` 订阅臂（§8.3 跨窗口/外部变更回流）经
 * `subscribe` 建立；正式实现即 preload 挂载的 `window.chips.subscribe`（返回面与
 * `IDocumentReflowSubscription` 同构，只消费 `dispose`）。
 */
export interface IChipsCardWindowFacade {
  request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput>;
  subscribe(eventId: string, handler: (payload: unknown) => void): { dispose(): void };
}

/**
 * 组装卡片窗口的渲染引擎绑定（文档/帧数据经 `window.chips` 正式链路，视图经宿主内部取视图通道）。
 *
 * @param chips `window.chips` 方法面（文档网关腿只用 `request`）。
 * @param init 窗口装载描述。
 * @param diagnostics 诊断口。
 * @param viewChannel 宿主内部取视图通道的传输注入端口（真实臂 = 窗口装载层注入）。
 */
export function createCardWindowBindings(
  chips: IChipsRequestFacade,
  init: ICardWindowInit,
  diagnostics: IRenderEngineBindings['diagnostics'],
  viewChannel: IDocumentViewChannelInvoke,
): IRenderEngineBindings {
  return buildBindings(chips, init, diagnostics, createDocumentViewChannelBuilder({ invoke: viewChannel }));
}

/** 绑定组装内部件（视图端口外部注入，令 `mountCardWindow` 与回流协调器共享同一消费臂实例）。 */
function buildBindings(
  chips: IChipsRequestFacade,
  init: ICardWindowInit,
  diagnostics: IRenderEngineBindings['diagnostics'],
  viewBuilder: IDocumentViewBuilder,
): IRenderEngineBindings {
  return {
    document: createBridgeDocumentGateway(chips),
    viewBuilder,
    frames: {
      frameEntryUrl: FRAME_ENTRY_URL,
      tokens: init.tokens,
      executeAction: createFrameActionForwarder(chips),
    },
    resourceBase: init.resourceBase,
    pluginEntries: init.pluginEntries,
    limits: { ...PLATFORM_CARD_FRAME_LIMITS },
    diagnostics,
  };
}

/**
 * 构造卡片窗口的编辑回流协调器（§8.3 唯一时序的宿主侧承载，会话级）。
 *
 * @remarks 写臂经 `window.chips.request`（`createBridgeDocumentWritePort`，R19 权限判定在
 * Bridge 侧）；写后重建视图经与渲染管线同一个取视图通道消费臂；外部/跨窗口变更回流经
 * `window.chips.subscribe`（`document:changed`）。本函数是纯组合工厂：会话、视图端口由调用方
 * 注入，令生产组合（`mountCardWindow`）与单测共享同一构造路径，不旁路会话状态机。
 *
 * @param chips 卡片窗口 `window.chips` 面（`request` + `subscribe`）。
 * @param init 窗口装载描述（提供 `source` 与回流定位键 `documentId`）。
 * @param viewBuilder 视图构建端口（正式实现 = 取视图通道消费臂）。
 * @param session 被回流的渲染会话。
 * @param diagnostics 诊断口。
 */
export function createCardReflowCoordinator(
  chips: IChipsCardWindowFacade,
  init: ICardWindowInit,
  viewBuilder: IDocumentViewBuilder,
  session: IRenderSession,
  diagnostics: IRenderEngineBindings['diagnostics'],
): IDocumentReflowCoordinator {
  return createDocumentReflowCoordinator({
    source: init.source,
    documentId: init.documentId,
    kind: 'card',
    session,
    write: createBridgeDocumentWritePort(chips),
    viewBuilder,
    subscribe: (eventId, handler) => chips.subscribe(eventId, handler),
    diagnostics,
  });
}

/** 卡片窗口挂载句柄。 */
export interface ICardWindowHandle {
  /** 卸载 React 根并收口回流协调器（幂等）。 */
  unmount(): void;
  /**
   * 执行编辑动作（§8.3 唯一时序：`document:write` → 取视图通道写后重建 → `session.update`）。
   *
   * @remarks 委托至当前会话的回流协调器；解析管线尚未产出会话时以 `RENDER_SESSION_DISPOSED`
   *   确定性拒绝（不伪造更新）。
   */
  executeAction(action: DocumentReflowAction): Promise<void>;
}

/**
 * 挂载一张卡片窗口的完整渲染组合：引擎 + `CardRenderer`（加载 / 内容 / 降级占位）+ 回流协调器。
 *
 * @param container 窗口根容器。
 * @param chips `window.chips` 方法面。
 * @param init 窗口装载描述。
 * @param diagnostics 诊断口。
 * @param viewChannel 宿主内部取视图通道传输注入端口（视图臂与回流臂共享同一消费臂实例）。
 */
export function mountCardWindow(
  container: HTMLElement,
  chips: IChipsCardWindowFacade,
  init: ICardWindowInit,
  diagnostics: IRenderEngineBindings['diagnostics'],
  viewChannel: IDocumentViewChannelInvoke,
): ICardWindowHandle {
  const viewBuilder = createDocumentViewChannelBuilder({ invoke: viewChannel });
  const baseEngine = createRenderEngine(buildBindings(chips, init, diagnostics, viewBuilder));

  // 会话级协调器随 `engine.open` 产出的最新会话重建并绑定（重走链路=换会话=换协调器；
  // 旧协调器幂等 dispose，其 `document:changed` 订阅随之注销）。
  let coordinator: IDocumentReflowCoordinator | null = null;
  const engine: IRenderEngine = {
    open(request: RenderRequest): Promise<IRenderSession> {
      return baseEngine.open(request).then((session) => {
        coordinator?.dispose();
        coordinator = createCardReflowCoordinator(chips, init, viewBuilder, session, diagnostics);
        return session;
      });
    },
  };

  const request: RenderRequest = { kind: 'card', source: init.source, mode: 'view' };
  const root = createRoot(container);
  root.render(createElement(CardRenderer, { engine, request }));
  return {
    unmount(): void {
      coordinator?.dispose();
      coordinator = null;
      root.unmount();
    },
    executeAction(action: DocumentReflowAction): Promise<void> {
      if (coordinator === null) {
        return Promise.reject(
          createRenderError({
            code: RENDER_ERROR_CODES.sessionDisposed,
            message: '卡片窗口渲染会话尚未建立，编辑动作被拒绝',
            details: { documentId: init.documentId, source: init.source },
          }),
        );
      }
      return coordinator.executeAction(action);
    },
  };
}

/**
 * 空载态视图：等待主进程装载输入（加载态占位，不伪造任何数据请求）。
 *
 * @returns 卸载句柄——挂载真实组合前必须先卸载空闲根（同一容器上 React 根互斥）。
 */
export function renderIdleState(container: HTMLElement): { unmount(): void } {
  const root = createRoot(container);
  root.render(createElement(StateBoundary, { loading: true, error: null }, null));
  return {
    unmount(): void {
      root.unmount();
    },
  };
}

/** 渲染侧最小诊断口（console 承载；平台日志子系统接入前不外露细节）。 */
export function createRendererDiagnostics(): IRenderEngineBindings['diagnostics'] {
  const emit = (
    level: 'warn' | 'error',
    scope: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): void => {
    const line = `[chips-renderer] [${scope}] ${message}`;
    if (level === 'warn') {
      console.warn(line, details ?? '');
    } else {
      console.error(line, details ?? '');
    }
  };
  const sink: DiagnosticsSink = {
    warn: (scope, message, details) => emit('warn', scope, message, details),
    error: (scope, message, details) => emit('error', scope, message, details),
  };
  return sink;
}

/** 读取 `window.chips` 方法面（preload 桥缺席时为 `null`）。 */
export function readChipsFacade(): IChipsCardWindowFacade | null {
  const chips = (window as unknown as { chips?: IChipsCardWindowFacade }).chips;
  if (chips === undefined || typeof chips.request !== 'function' || typeof chips.subscribe !== 'function') {
    return null;
  }
  return chips;
}

/**
 * 读取宿主内部取视图通道的窗口装载面（preload 第二 contextBridge 世界缺席时为 `null`）。
 *
 * @remarks 缺席即视为通路未就绪——本入口据此进入诚实空载态（不降级到已退役的 `document:read`
 *   结构分片通路，避免复活暂行臂）。
 */
export function readHostViewChannelSurface(): IHostViewChannelSurface | null {
  const surface = (window as unknown as Record<string, unknown>)[HOST_VIEW_CHANNEL_SURFACE_KEY];
  if (
    typeof surface === 'object' &&
    surface !== null &&
    typeof (surface as IHostViewChannelSurface).requestView === 'function'
  ) {
    return surface as IHostViewChannelSurface;
  }
  return null;
}

/** 把窗口装载面适配为取视图通道消费臂的注入端口（通道名由 preload 侧钉死，本处忽略入参 channel）。 */
export function createViewChannelInvoke(surface: IHostViewChannelSurface): IDocumentViewChannelInvoke {
  return {
    invoke(_channel: string, payload: unknown): Promise<unknown> {
      return surface.requestView(payload);
    },
  };
}

/**
 * 读取卡片窗口装载输入投递的窗口装载面（preload 第三 contextBridge 世界缺席时为 `null`）。
 *
 * @remarks 缺席即投递通路未就绪——本入口据此进入诚实空载态（与取视图装载面同一纪律）。
 */
export function readCardWindowInitSurface(): ICardWindowInitSurface | null {
  const surface = (window as unknown as Record<string, unknown>)[CARD_WINDOW_INIT_SURFACE_KEY];
  if (
    typeof surface === 'object' &&
    surface !== null &&
    typeof (surface as ICardWindowInitSurface).requestInit === 'function'
  ) {
    return surface as ICardWindowInitSurface;
  }
  return null;
}

/** 装载输入投递轮询的缺省节奏与上限（工单035 §10.3 待办 3：重试节奏归接线波——本波钉此值）。 */
export const CARD_WINDOW_INIT_DEFAULTS = Object.freeze({
  /** 相邻两次取回请求的最小间隔（毫秒）。 */
  retryDelayMs: 400,
  /** 诚实空载重试的次数上限（耗尽即收口空闲态并落一次诊断，不无限轮询）。 */
  maxAttempts: 30,
});

/** 装载输入提供器可调项（测试注入口；生产走缺省节奏）。 */
export interface ICardWindowInitProviderOptions {
  readonly retryDelayMs?: number;
  readonly maxAttempts?: number;
  /** 排程注入位（缺省 `setTimeout`；测试以即时排程驱动重试环）。 */
  readonly schedule?: (callback: () => void, delayMs: number) => void;
  /** 关联标识铸造注入位（缺省为本提供器实例的单调序列；契约闸只要求非空字符串）。 */
  readonly mintRequestId?: () => string;
}

/**
 * 构造经投递通道的窗口装载描述提供臂（正式投递腿，工单035 §10.3 待办 3）。
 *
 * @remarks 每轮一次的完整语义：铸造 `requestId` → 请求封套发送侧自检
 * （{@link validateCardWindowInitRequest}，契约明载发送侧复用同一函数）→ `surface.requestInit`
 * 往返 → 到达侧权威闸（{@link validateCardWindowInitResponse}，`requestId` 逐字关联）。
 * 竞态收敛（契约三臂语义的渲染侧消费口径）：
 * - `pending`（登记表未命中的合法瞬态）与 `DOCUMENT_NOT_OPEN`（绑定腿未就绪）→ 诚实空闲重试
 *   （`setTimeout` 节奏、{@link ICardWindowInitProviderOptions.maxAttempts} 上限，耗尽落诊断收口）；
 * - 其余终态码（`BRIDGE_SESSION_UNKNOWN` / `BRIDGE_INVALID_INPUT` / `BRIDGE_INTERNAL` 与闸违约、
 *   传输拒绝）→ 收口空闲态并落诊断（不无限轮询死窗口、不采信破损封套）；
 * - 就绪臂 → `payload` 原样直传（与 `ICardWindowInit` 逐字段同形由契约编译期互派生锁钉死，
 *   本臂零适配、零改写）。
 * 本函数不抛出：一切失败路径以 `null` 收口（调用方维持空载态）。
 *
 * @param surface 第三世界的投递暴露面（{@link readCardWindowInitSurface} 产出）。
 * @param diagnostics 诊断口（终态收口与重试耗尽各落一次，逐轮 pending 静默——与桥面同纪律）。
 * @param options 节奏与铸造可调项。
 */
export function createCardWindowInitProvider(
  surface: ICardWindowInitSurface,
  diagnostics: DiagnosticsSink,
  options: ICardWindowInitProviderOptions = {},
): () => Promise<ICardWindowInit | null> {
  const retryDelayMs = options.retryDelayMs ?? CARD_WINDOW_INIT_DEFAULTS.retryDelayMs;
  const maxAttempts = options.maxAttempts ?? CARD_WINDOW_INIT_DEFAULTS.maxAttempts;
  const schedule =
    options.schedule ?? ((callback: () => void, delay: number): void => void setTimeout(callback, delay));
  let sequence = 0;
  const mintRequestId = options.mintRequestId ?? ((): string => `card-window-init-${(sequence += 1)}`);
  const wait = (): Promise<void> =>
    new Promise((resolve) => {
      schedule(resolve, retryDelayMs);
    });
  return async (): Promise<ICardWindowInit | null> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const requestId = mintRequestId();
      let data: unknown;
      try {
        const request = validateCardWindowInitRequest(createCardWindowInitFetchRequest(requestId));
        data = await surface.requestInit(request);
      } catch (error: unknown) {
        const normalized = normalizeError(error);
        if (normalized.code === CARD_WINDOW_INIT_CHANNEL_ERROR_CODES.documentNotOpen) {
          await wait();
          continue;
        }
        diagnostics.error('card-window-init', '装载输入取回传输失败，维持空载态', { code: normalized.code });
        return null;
      }
      let response;
      try {
        response = validateCardWindowInitResponse(data, requestId);
      } catch (error: unknown) {
        // 到达闸违约 = 主进程回包契约漂移（闸内已归一 BRIDGE_INTERNAL），渲染侧不采信。
        diagnostics.error('card-window-init', '装载输入回包未过契约闸，维持空载态', {
          code: normalizeError(error).code,
        });
        return null;
      }
      if (isCardWindowInitResult(response)) {
        return response.payload;
      }
      if (isCardWindowInitPending(response)) {
        // 登记表未命中的合法瞬态（结构性时窗）：诚实空闲重试（末轮不空转等待）。
        if (attempt < maxAttempts) {
          await wait();
        }
        continue;
      }
      // 其余为失败臂（到达闸已把判别收敛为三臂）：绑定未就绪继续等待，终态码收口落诊断。
      if (response.error.code === CARD_WINDOW_INIT_CHANNEL_ERROR_CODES.documentNotOpen) {
        if (attempt < maxAttempts) {
          await wait();
        }
        continue;
      }
      diagnostics.error('card-window-init', '装载输入投递被通道在册错误面拒绝，维持空载态', {
        code: response.error.code,
      });
      return null;
    }
    diagnostics.warn('card-window-init', '装载输入在重试上限内未就绪，维持空载态', { maxAttempts });
    return null;
  };
}

/**
 * 入口自举：桥可用、取视图通道面就绪且已收到装载输入时挂载完整组合；否则呈现诚实空载态。
 *
 * @param initProvider 窗口装载描述提供臂的注入位——同步提供（既有测试/嵌入方口径）直接挂载；
 *   异步提供臂（投递通道 `createCardWindowInitProvider` 形态）先渲染空闲根、就绪后卸载空闲根
 *   再挂真实组合（同一容器 React 根互斥）；缺省且第三世界装载面在位时自动接入正式投递臂。
 */
export function bootCardWindow(initProvider?: () => ICardWindowInit | null | Promise<ICardWindowInit | null>): void {
  const container = document.getElementById('chips-card-root');
  if (container === null) {
    return;
  }
  const chips = readChipsFacade();
  const surface = readHostViewChannelSurface();
  if (chips === null || surface === null) {
    renderIdleState(container);
    return;
  }
  const initSurface = readCardWindowInitSurface();
  const provider: (() => ICardWindowInit | null | Promise<ICardWindowInit | null>) | null =
    initProvider ??
    (initSurface === null ? null : createCardWindowInitProvider(initSurface, createRendererDiagnostics()));
  if (provider === null) {
    renderIdleState(container);
    return;
  }
  const outcome = provider();
  if (typeof outcome === 'object' && outcome !== null && 'then' in outcome) {
    const idle = renderIdleState(container);
    outcome.then(
      (init) => {
        if (init === null) {
          return;
        }
        idle.unmount();
        mountCardWindow(container, chips, init, createRendererDiagnostics(), createViewChannelInvoke(surface));
      },
      () => {
        // 正式提供臂内部不拒绝；此臂兜底外部注入提供的异步腿——拒绝即维持空闲态。
      },
    );
    return;
  }
  if (outcome === null) {
    renderIdleState(container);
    return;
  }
  mountCardWindow(container, chips, outcome, createRendererDiagnostics(), createViewChannelInvoke(surface));
}

// 构建产物自举：真实卡片窗口装载本脚本即接入投递通道（第三世界缺席时维持诚实空载等待态）。
bootCardWindow();
