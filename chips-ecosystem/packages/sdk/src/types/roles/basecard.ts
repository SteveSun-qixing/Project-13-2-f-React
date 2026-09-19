/**
 * 基础卡片插件角色类型（08-基础卡片插件接口 §2 IBaseCardPlugin、§4 IBaseCardEditor）。
 *
 * 权威归属：
 * - 方法签名与调用契约以 08 §2.1–§2.5 为准；编辑句柄与变更载荷以 08 §4 为准
 *   （02-SDK-API规范 §2.2「插件角色」行以角色接口文档标注的 SDK 导出名为准）；
 * - 入参视图 `BaseCardView` 的权威定义在核心接口规范 §6.6（本模块引用 `types/views.ts`，
 *   不复制形状）；
 * - 布局编辑句柄 `ILayoutEditor` 是另一套独立类型（09 §7.1），SDK 分别导出两者，
 *   不导出笼统的 `IEditor`。
 */

import type { BaseCardView } from '../views.js';
import type { ISubscription } from '../bridge.js';
import type { Dispose, EditorState } from './common.js';

/**
 * 卡片内容增量操作（08 §4.1）。
 *
 * `path` 为 RFC 6901 指针，相对 `content` 根，不允许根指针；`op` 为 `add` / `replace`
 * 时 `value` 必填（08 §4.3 规则 4）。
 */
export interface ICardPatchOperation {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

/**
 * 卡片编辑变更载荷（08 §4.1）。
 *
 * `replace` 提交完整节点内容（节点字段由编辑链路按会话当前视图组装）；
 * `patch` 只描述 `content` 的增量。
 */
export type BaseCardChange =
  | { kind: 'replace'; content: Record<string, unknown> }
  | { kind: 'patch'; operations: readonly ICardPatchOperation[] };

/** 编辑器事件与载荷映射（08 §4.1）。 */
export interface IBaseCardEditorEventMap {
  change: { change: BaseCardChange };
  dirty: { isDirty: boolean };
}

/**
 * 基础卡片编辑器句柄（08 §4.1、§4.2）。
 *
 * 回流唯一时序（08 §4.3 规则 1）：`getChange()` → 编辑链路校验 → `document:write` →
 * 渲染会话 `update(view, revision)` → `markCommitted(revision)`；
 * 编辑器不负责保存，`dispose()` 丢弃待提交变更且不发布事件（08 §4.3 规则 9）。
 */
export interface IBaseCardEditor {
  readonly state: EditorState;
  /** 是否存在尚未回流的变更；等价于 `getChange() !== null`。 */
  isDirty(): boolean;
  /** 返回相对基线的累计变更；无变更返回 `null`。 */
  getChange(): BaseCardChange | null;
  /** 编辑链路成功回流后调用；以该 revision 更新基线并清除已提交变更。 */
  markCommitted(revision: number): void;
  /** 会话视图因外部变化前进时调用，以新节点视图替换基线；调用前编辑器必须无待提交变更。 */
  update(basecard: BaseCardView, revision: number): void;
  /** 订阅 `change` / `dirty`；`dispose()` 幂等。 */
  subscribe<TEvent extends keyof IBaseCardEditorEventMap>(
    event: TEvent,
    handler: (payload: IBaseCardEditorEventMap[TEvent]) => void
  ): ISubscription;
  /** 请求编辑器获取焦点；由编辑链路在窗口激活、用户进入编辑时调用。 */
  focus(): void;
  /** 释放编辑器与其全部订阅；幂等。 */
  dispose(): void;
}

/**
 * 基础卡片插件入口接口（08 §2.1）。
 *
 * 双入口职责（08 §2.5）：主进程入口 `dist/index.js` 承载 `validateConfig` /
 * `createInitialContent` / `collectResourcePaths` 纯函数；渲染入口 `render.js` 承载
 * `renderView` / `renderEditor` / `export`。全部方法只由平台（渲染帧运行时、编辑链路、
 * 导出链路）调用；应用插件不得 import 插件代码。
 */
export interface IBaseCardPlugin {
  /** 查看态：把一个节点视图渲染到容器；返回释放句柄或 void（08 §2.4.1）。 */
  renderView(basecard: BaseCardView, container: HTMLElement): void | Dispose;

  /** 编辑态：在容器内挂载节点编辑器并返回编辑句柄（08 §2.4.2）。 */
  renderEditor(basecard: BaseCardView, container: HTMLElement): IBaseCardEditor;

  /** 校验节点内容中的 config；纯函数，`undefined` / `null` 必须返回 `true`（08 §2.4.3）。 */
  validateConfig(config: unknown): boolean;

  /** 创建新节点时的初始内容；主进程纯函数（08 §2.4.4）。 */
  createInitialContent(): Record<string, unknown>;

  /** 收集节点内容引用的包内相对路径；主进程纯函数，去重且稳定排序（08 §2.4.5）。 */
  collectResourcePaths(basecard: BaseCardView): string[];

  /** 可选：把节点视图导出为指定格式的产物；格式不支持时 reject `CARD_EXPORT_UNSUPPORTED`（08 §2.4.6）。 */
  export?(basecard: BaseCardView, format: string): Promise<Blob>;
}
