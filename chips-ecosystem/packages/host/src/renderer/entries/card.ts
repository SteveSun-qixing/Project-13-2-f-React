/**
 * 卡片窗口入口（应用窗口壳的 RenderHost 组合根）。
 *
 * 权威：`05-渲染引擎设计` §2.2–§2.4（六阶段链路与渲染会话模型）、§3.2（React 壳分层：
 * Surface 一个会话一个挂载点）、§6.4（降级占位）、§9.1（帧入口经 `chips-resource://platform/`
 * 装载）、§7.3（卡片帧 `maxNestedFrames = 0`）；`02-Bridge三层设计` §2.1（渲染进程只经
 * `window.chips` 正式链路）。
 *
 * @remarks
 * - 本入口只**消费**渲染面既有导出（`../index.js`），不修改其中任何一行。
 * - `mountCardWindow` 是完整组合根：Bridge 网关 + 冻结契约视图臂 + 帧环境 + React
 *   `CardRenderer` 挂载，输入为一张卡片的窗口装载描述（`ICardWindowInit`）。
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

import { CardRenderer, createBridgeDocumentGateway, createRenderEngine } from '../index.js';
import type { DesignTokens, IChipsRequestFacade, IRenderEngineBindings, RenderRequest } from '../index.js';
import type { DiagnosticsSink } from '../../shared/diagnostics.js';
import { createBridgeCardViewBuilder, createFrameActionForwarder } from './bridge-data-plane.js';

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
  /** 资源基址（资源管理器作用域产物；W3 接线前由装载输入携带）。 */
  readonly resourceBase: string;
  /** 插件渲染入口映射（类型标识 → 插件渲染入口 URL；装载器正式绑定随插件链路波次）。 */
  readonly pluginEntries: Readonly<Record<string, string>>;
  /** Design Tokens（CSS 变量表；`@chips/ui` token 经主进程快照下发）。 */
  readonly tokens: DesignTokens;
}

/**
 * 组装卡片窗口的渲染引擎绑定（全部数据触达经 `window.chips` 正式链路）。
 *
 * @param chips `window.chips` 方法面。
 * @param init 窗口装载描述。
 * @param diagnostics 诊断口。
 */
export function createCardWindowBindings(
  chips: IChipsRequestFacade,
  init: ICardWindowInit,
  diagnostics: IRenderEngineBindings['diagnostics']
): IRenderEngineBindings {
  return {
    document: createBridgeDocumentGateway(chips),
    viewBuilder: createBridgeCardViewBuilder(chips),
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

/** 卡片窗口挂载句柄。 */
export interface ICardWindowHandle {
  /** 卸载 React 根（窗口文档销毁路径消费；常规关闭由窗口销毁整体回收）。 */
  unmount(): void;
}

/**
 * 挂载一张卡片窗口的完整渲染组合：引擎 + `CardRenderer`（加载 / 内容 / 降级占位）。
 *
 * @param container 窗口根容器。
 * @param chips `window.chips` 方法面。
 * @param init 窗口装载描述。
 * @param diagnostics 诊断口。
 */
export function mountCardWindow(
  container: HTMLElement,
  chips: IChipsRequestFacade,
  init: ICardWindowInit,
  diagnostics: IRenderEngineBindings['diagnostics']
): ICardWindowHandle {
  const engine = createRenderEngine(createCardWindowBindings(chips, init, diagnostics));
  const request: RenderRequest = { kind: 'card', source: init.source, mode: 'view' };
  const root = createRoot(container);
  root.render(createElement(CardRenderer, { engine, request }));
  return {
    unmount(): void {
      root.unmount();
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
export function readChipsFacade(): IChipsRequestFacade | null {
  const chips = (window as unknown as { chips?: IChipsRequestFacade }).chips;
  return chips !== undefined && typeof chips.request === 'function' ? chips : null;
}

/**
 * 入口自举：桥可用且已收到装载输入时挂载完整组合；否则呈现诚实空载态。
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
  const init = chips === null ? null : (initProvider?.() ?? null);
  if (chips === null || init === null) {
    renderIdleState(container);
    return;
  }
  mountCardWindow(container, chips, init, createRendererDiagnostics());
}

// 构建产物自举：真实卡片窗口装载本脚本即进入空载等待态（装载输入投递臂转正后经注入位生效）。
bootCardWindow();
