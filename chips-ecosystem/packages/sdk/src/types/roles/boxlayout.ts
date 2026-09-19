/**
 * 箱子布局插件角色类型（09-箱子布局插件接口 §3 IBoxLayoutPlugin、§6.1 帧运行时、§7.1 ILayoutEditor）。
 *
 * 权威归属：
 * - 方法签名与调用契约以 09 §3 为准；帧运行时与动作面以 09 §6.1 为准；
 *   编辑句柄与变更载荷以 09 §7.1、§7.2 为准（02-SDK-API规范 §2.2「插件角色」行以角色
 *   接口文档标注的 SDK 导出名为准）；
 * - `EntryTicket` 的完整结构以 05-渲染引擎设计 §7.2 为准；
 * - 入参视图 `BoxRenderView` / `EntryView` 的权威定义在核心接口规范 §6.6（本模块引用
 *   `types/views.ts`，不复制形状）；
 * - 基础卡片编辑句柄 `IBaseCardEditor` 是另一套独立类型，两者只共享成员语义、
 *   不共享类型名（09 §7.1）。
 */

import type { ISubscription } from '../bridge.js';
import type { BoxCoverView, BoxRenderView, CardRenderView } from '../views.js';
import type { Dispose, EditorState } from './common.js';

/** 帧运行时通知载荷（09 §6.1）；`message` 为简体中文。 */
export interface FrameNotification {
  level: 'info' | 'warning' | 'error';
  message: string;
}

/** 条目帧请求（09 §6.1）；平台只为允许范围（可见 ± overscan）返回票证。 */
export interface EntryRequest {
  entryIds: readonly string[];
}

/**
 * 条目票证（05-渲染引擎设计 §7.2）。
 *
 * 票证由平台解释并按 `view.kind` 渲染条目卡片视图或目标箱子的正式封面；
 * 布局插件不得修改票证，不得自行加载票证指向的模块（09 §6.2）。
 */
export interface EntryTicket {
  entry_id: string;
  slotIndex: number;
  /** 条目目标视图，按 `kind` 判别：`card` 为卡片文档视图，`box` 为受控封面视图。 */
  view: CardRenderView | BoxCoverView;
  /** 条目目标文档自身作用域。 */
  resourceBase: string;
  /** 条目目标视图的插件入口；箱子目标为空对象。 */
  pluginEntries: Readonly<Record<string, string>>;
  /** 箱子布局插件用于槽位估算。 */
  estimatedHeight: number;
}

/**
 * 布局帧运行时句柄（09 §6.1）。
 *
 * 由帧运行时在首次调用 `renderLayout` 前注入实现了 `IBoxLayoutRuntimeAware` 的插件入口；
 * 全部动作经帧协议的 action 通道转发给 RenderHost，再由 RenderHost 经 Bridge 执行权限判
 * 定与审计（09 §6.1）。
 */
export interface IBoxLayoutFrameRuntime {
  /** 请求指定条目的条目票证；平台只为允许范围返回，其余忽略。 */
  requestEntries(request: EntryRequest): Promise<EntryTicket[]>;
  /** 把平台管理的条目帧挂载到插件提供的槽位容器；返回释放句柄（幂等）。 */
  mountEntry(ticket: EntryTicket, container: HTMLElement): Promise<Dispose>;
  /** 经帧动作通道请求平台打开条目文档；失败以 `ChipsError` 拒绝。 */
  openDocument(source: string): Promise<void>;
  /** 在系统默认程序中打开外部链接。 */
  openExternal(url: string): Promise<void>;
  /** 复制文本到剪贴板。 */
  copyText(text: string): Promise<void>;
  /** 发送用户通知；`message` 为简体中文。 */
  notify(notification: FrameNotification): Promise<void>;
}

/**
 * 帧运行时注入面（09 §6.1）。
 *
 * 需要请求条目帧或执行帧动作的布局插件实现本接口；`attachRuntime` 由帧运行时调用，
 * 每个渲染帧恰好一次，句柄只在本帧生命周期内使用，不得转存到跨帧共享的全局状态。
 * 不需要条目帧与帧动作的布局插件可以不实现本接口。
 */
export interface IBoxLayoutRuntimeAware {
  attachRuntime(runtime: IBoxLayoutFrameRuntime): void;
}

/**
 * 布局配置增量操作（09 §7.1）。
 *
 * `path` 为 RFC 6901 指针，相对 `layout_config` 根，不允许根指针；`op` 为 `add` / `replace`
 * 时 `value` 必填；`patch` 不改变 `schema_version`（09 §7.2 规则 3）。
 */
export interface ILayoutPatchOperation {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

/**
 * 布局编辑变更载荷（09 §7.1）。
 *
 * `replace` 提交插件归一化后的完整布局配置，`schemaVersion` 为编辑器写入的配置 schema 版本
 * （09 §7.2 规则 2）；`patch` 只描述 `layout_config` 的增量。
 */
export type LayoutChange =
  | { kind: 'replace'; config: Record<string, unknown>; schemaVersion: string }
  | { kind: 'patch'; operations: readonly ILayoutPatchOperation[] };

/** 布局编辑器事件与载荷映射（09 §7.1）。 */
export interface ILayoutEditorEventMap {
  change: { change: LayoutChange };
  dirty: { isDirty: boolean };
}

/**
 * 箱子布局编辑器句柄（09 §7.1）。
 *
 * 成员语义与基础卡片侧一致（08 §4.2、§4.3），差异只在变更载荷与 `update` 参数类型；
 * 编辑器只产出配置变更，不写文件、不保存、不修改会话视图（09 §3.4 规则 4）。
 */
export interface ILayoutEditor {
  readonly state: EditorState;
  /** 是否存在尚未回流的变更；等价于 `getChange() !== null`。 */
  isDirty(): boolean;
  /** 返回相对基线的累计变更；无变更返回 `null`。 */
  getChange(): LayoutChange | null;
  /** 编辑链路成功回流后调用；以该 revision 更新基线并清除已提交变更。 */
  markCommitted(revision: number): void;
  /** 会话视图因外部变化前进时调用，以新 `BoxRenderView` 替换基线；调用前编辑器必须无待提交变更。 */
  update(box: BoxRenderView, revision: number): void;
  /** 订阅 `change` / `dirty`；`dispose()` 幂等。 */
  subscribe<TEvent extends keyof ILayoutEditorEventMap>(
    event: TEvent,
    handler: (payload: ILayoutEditorEventMap[TEvent]) => void
  ): ISubscription;
  /** 请求编辑器获取焦点；由编辑链路在窗口激活、用户进入编辑时调用。 */
  focus(): void;
  /** 释放编辑器与其全部订阅；幂等；待提交变更直接丢弃。 */
  dispose(): void;
}

/**
 * 箱子布局插件入口接口（09 §3.1）。
 *
 * 双入口职责与基础卡片插件一致（08 §2.5）：主进程入口承载 `validateConfig` 纯函数，
 * 渲染入口承载 `renderLayout` / `renderEditor`；一个入口只实现一个角色接口（R1）。
 */
export interface IBoxLayoutPlugin {
  /** 查看态：把箱子渲染进容器；产生副作用时必须返回释放句柄（09 §3.3）。 */
  renderLayout(box: BoxRenderView, container: HTMLElement): void | Dispose;

  /** 编辑态：把布局配置编辑器挂载到容器，返回编辑器句柄（09 §3.4）。 */
  renderEditor(box: BoxRenderView, container: HTMLElement): ILayoutEditor;

  /** 校验布局配置是否可用于渲染；纯函数、同步、不得抛出（09 §3.5）。 */
  validateConfig(config: unknown): boolean;
}
