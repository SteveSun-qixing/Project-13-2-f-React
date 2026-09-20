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
 * - 窗口装载描述的主进程投递臂（`CardWindowOrchestrator` 登记表 → 本入口的触发通道）依赖
 *   `document:*` 能力接线（#99 在途），是已登记集成缝：本波真实启动的卡片窗口呈现诚实的
 *   空载等待态（不伪造请求、不发空数据调用），装载臂接线后经 `bootCardWindow` 的注入位
 *   接入正式通道，组合逻辑零改动。
 * - 空载态与降级占位全部经 `@chips/ui` `StateBoundary`；界面文案简体中文直写；
 *   视觉走 `@chips/ui` / antd token，本文件不写样式。
 */

/// <reference lib="dom" />

import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

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
  viewChannel: IDocumentViewChannelInvoke
): IRenderEngineBindings {
  return buildBindings(chips, init, diagnostics, createDocumentViewChannelBuilder({ invoke: viewChannel }));
}

/** 绑定组装内部件（视图端口外部注入，令 `mountCardWindow` 与回流协调器共享同一消费臂实例）。 */
function buildBindings(
  chips: IChipsRequestFacade,
  init: ICardWindowInit,
  diagnostics: IRenderEngineBindings['diagnostics'],
  viewBuilder: IDocumentViewBuilder
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
  diagnostics: IRenderEngineBindings['diagnostics']
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
  viewChannel: IDocumentViewChannelInvoke
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
          })
        );
      }
      return coordinator.executeAction(action);
    },
  };
}

/** 空载态视图：等待主进程装载输入（加载态占位，不伪造任何数据请求）。 */
export function renderIdleState(container: HTMLElement): void {
  const root = createRoot(container);
  root.render(createElement(StateBoundary, { loading: true, error: null }, null));
}

/** 渲染侧最小诊断口（console 承载；平台日志子系统接入前不外露细节）。 */
export function createRendererDiagnostics(): IRenderEngineBindings['diagnostics'] {
  const emit = (level: 'warn' | 'error', scope: string, message: string, details?: Readonly<Record<string, unknown>>): void => {
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
  if (
    chips === undefined ||
    typeof chips.request !== 'function' ||
    typeof chips.subscribe !== 'function'
  ) {
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
 * 入口自举：桥可用、取视图通道面就绪且已收到装载输入时挂载完整组合；否则呈现诚实空载态。
 *
 * @param initProvider 窗口装载描述提供臂的注入位——正式投递通道（主进程登记表 → 渲染侧）
 *   随文档链路接线波次转正后由入口装载层接入；缺省空载。集成波次接入本臂即全链路生效。
 */
export function bootCardWindow(initProvider?: () => ICardWindowInit | null): void {
  const container = document.getElementById('chips-card-root');
  if (container === null) {
    return;
  }
  const chips = readChipsFacade();
  const surface = readHostViewChannelSurface();
  const init = chips === null || surface === null ? null : (initProvider?.() ?? null);
  if (chips === null || surface === null || init === null) {
    renderIdleState(container);
    return;
  }
  mountCardWindow(container, chips, init, createRendererDiagnostics(), createViewChannelInvoke(surface));
}

// 构建产物自举：真实卡片窗口装载本脚本即进入空载等待态（装载输入投递臂转正后经注入位生效）。
bootCardWindow();
