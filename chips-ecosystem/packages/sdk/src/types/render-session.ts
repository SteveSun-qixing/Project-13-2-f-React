/**
 * 渲染会话模型（05-渲染引擎设计 §2.4 渲染会话模型）。
 *
 * 权威归属：
 * - 本模块只落编辑链路会话面所需的会话模型闭包：`IEditSession.preview` 的类型
 *   `IRenderSession` 及其直接引用的 `RenderMode` / `RenderSessionState` / `RenderEventMap`
 *   （12-编辑引擎设计 §3.1、§3.3；05 §2.4 原文逐字）；
 * - 视图入参 `DocumentView` 的权威定义在核心接口规范 §6.6（本模块引用 `types/views.ts`，
 *   不复制形状）；错误载荷 `ChipsError` 与订阅句柄 `ISubscription` 沿用 SDK 既有单点；
 * - `revision` 语义：`update(view, revision)` 的修订号必须严格递增，回退或重复的 revision
 *   被忽略并记录诊断；修订号取自 `document:write` 的输出（05 §2.4 会话规则 5、
 *   12 §3.5），与 `document:write` 回执 `IDocumentWriteOutput['revision']` 同一序列。
 */

import type { ChipsError } from '../errors.js';
import type { ISubscription } from './bridge.js';
import type { DocumentKind } from './capabilities/common.js';
import type { DocumentView } from './views.js';

/** 渲染模式：查看态与编辑态共用同一会话模型（05 §2.4；编辑态由编辑链路创建，12 §3.2）。 */
export type RenderMode = 'view' | 'edit';

/**
 * 渲染会话状态机：`opening → ready | error → disposed`（05 §2.4）。
 */
export type RenderSessionState = 'opening' | 'ready' | 'error' | 'disposed';

/** 渲染会话事件与载荷映射（05 §2.4）。 */
export interface RenderEventMap {
  ready: { sessionId: string };
  error: ChipsError;
  'height-changed': { height: number };
  disposed: { sessionId: string };
}

/**
 * 渲染会话句柄（05 §2.4）。
 *
 * 编辑态预览（`mode: 'edit'`）由编辑链路在 `open` 时创建，与应用插件共享同一解析结果
 * 与 revision 序列（12 §3.3 规则 1）；应用插件把 `session.preview` 挂载到自身容器后
 * 不得再开同源渲染会话承担预览（12 §3.1 规则 3，R8）。会话释放时先 `unmount()` 再
 * `dispose()`（12 §3.3 规则 5）。
 */
export interface IRenderSession {
  readonly id: string;
  readonly kind: DocumentKind;
  readonly mode: RenderMode;
  readonly state: RenderSessionState;
  /** 绑定目标容器；`mount()` 可重复调用（先 `unmount()` 再挂载）（05 §2.4 会话规则 2）。 */
  mount(container: HTMLElement): Promise<void>;
  unmount(): void;
  /**
   * 以新视图与严格递增的 revision 更新会话；只在 `state` 为 `ready` 时生效，
   * 更新失败返回 `RENDER_UPDATE_FAILED` 并保留旧帧（05 §2.4 会话规则 5）。
   * 编辑态的调用权在编辑链路：revision 取自 `document:write` 输出，不得自行推算（12 §3.5）。
   */
  update(view: DocumentView, revision: number): Promise<void>;
  subscribe<TEvent extends keyof RenderEventMap>(
    event: TEvent,
    handler: (payload: RenderEventMap[TEvent]) => void
  ): ISubscription;
  /** 按固定顺序反向清理，幂等（05 §2.4 会话规则 4）；释放后一切操作返回 `RENDER_SESSION_DISPOSED`。 */
  dispose(): Promise<void>;
}
