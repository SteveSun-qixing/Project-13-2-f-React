/**
 * 编辑链路类型域出口（工单036 残段 T1：契约类型面）。
 *
 * 本出口只做类型面的域内组织，不承载任何运行时实现（SDK 红线：只做类型化封装）；
 * 各类型的权威与契约出处见各模块头注：
 * - `./session.js`：编辑会话 `IEditEngine` / `IEditSession` 与事件、请求、条目、元数据类型
 *   （12-编辑引擎设计 §三）；
 * - `./facade.js`：渲染侧插件装载受管门面 `IManagedPluginRuntime`（12 §4.1）；
 * - `./history.js`：撤销/重做历史记录模型 `EditHistoryEntry` / `ChangePayload` /
 *   `EditPayloadPart`（12 §7.2）；
 * - 编辑句柄 `IBaseCardEditor`（08 §4.1）与 `ILayoutEditor`（09 §7.1）及其变更载荷、
 *   预览渲染会话 `IRenderSession`（05 §2.4）为既有单点，此处按域聚合再导出，不复制形状。
 *
 * 主入口导出面板威见 `src/index.ts` 编辑链路段：会话面与预览会话经主入口导出供应用插件
 * `import type` 消费；受管门面（12 §4.1 规则 1 禁止应用插件持有）与历史记录模型
 * （12 §7.1 归编辑链路持有）只在本域出口在册，不经主入口导出。
 */

export type {
  EditEventMap,
  EditOptions,
  EditRequest,
  EditSessionState,
  EntryInput,
  IEditEngine,
  IEditSession,
  MetadataPatch,
} from './session.js';

export type { IManagedPluginRuntime } from './facade.js';

export type { ChangePayload, EditHistoryEntry, EditPayloadPart } from './history.js';

/* 编辑句柄族：单点定义在 `types/roles/*`（08 §4.1、09 §7.1），域内再导出便于
   编辑链路消费方逐名取用；两套句柄只共享成员语义、不共享类型名（09 §7.1）。 */
export type {
  BaseCardChange,
  IBaseCardEditor,
  IBaseCardEditorEventMap,
  ICardPatchOperation,
} from '../types/roles/basecard.js';
export type {
  ILayoutEditor,
  ILayoutEditorEventMap,
  ILayoutPatchOperation,
  LayoutChange,
} from '../types/roles/boxlayout.js';
export type { EditorState } from '../types/roles/common.js';

/* 预览渲染会话族：单点定义在 `types/render-session.ts`（05 §2.4），域内再导出。 */
export type {
  IRenderSession,
  RenderEventMap,
  RenderMode,
  RenderSessionState,
} from '../types/render-session.js';
