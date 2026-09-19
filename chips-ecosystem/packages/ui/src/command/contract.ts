/**
 * 命令契约类型（`@chips/ui` 侧结构投影）。
 *
 * 权威：《薯片生态文档库/05-接口与契约/13-命令系统契约》§2（命令模型）、§3.2（输入输出）、
 * §5.6（应用 UI 命令运行时）。本文件逐字段对齐契约；插件侧的权威导出落位为 `@chips/sdk`
 * （见开发计划 §四.1），两侧为结构等价类型，本包不复制其实现。
 */

/** 命令触发来源：由消费入口在调用时声明。 */
export type CommandSource =
  'palette' | 'menu' | 'context-menu' | 'tray' | 'toolbar' | 'shortcut' | 'api' | 'cli';

/** 作用域种类。 */
export type CommandScopeKind = 'global' | 'app' | 'surface' | 'document';

/** 执行目标：由注册通道决定，注册方不可自选。 */
export type CommandTarget = 'platform' | 'main' | 'ui';

/** 命令作用域。 */
export interface ICommandScope {
  readonly kind: CommandScopeKind;
  /** app 作用域的应用插件 ID；缺省等于 owner pluginId。 */
  readonly appId?: string;
  /** surface 作用域的表面 ID（窗口 ID）。 */
  readonly surfaceId?: string;
  /** document 作用域的文档 ID。 */
  readonly documentId?: string;
}

/** 结构化条件：只允许契约登记的条件键，不引入表达式语言。 */
export interface ICommandCondition {
  readonly key: string;
  readonly equals?: unknown;
  readonly notEquals?: unknown;
  readonly in?: readonly unknown[];
  readonly truthy?: boolean;
}

/** 命令适用条件；三个状态独立求值。 */
export interface ICommandWhen {
  readonly enabled?: boolean | ICommandCondition;
  readonly visible?: boolean | ICommandCondition;
  readonly checked?: boolean | ICommandCondition;
}

/** 命令在某一菜单中的放置信息。 */
export interface ICommandMenuPlacement {
  readonly menuId: string;
  readonly group?: string;
  readonly order?: number;
}

/** 命令在某一工具栏中的放置信息。 */
export interface ICommandToolbarPlacement {
  readonly toolbarId: string;
  readonly group?: string;
  readonly order?: number;
}

/** 命令定义：注册方提交给平台的完整元数据（不含任何函数）。 */
export interface ICommandDefinition {
  /** 命令 ID，`<domain>:<action>`。 */
  readonly id: string;
  /** 显示标题（简体中文直写）。 */
  readonly title: string;
  /** 补充说明（简体中文直写）。 */
  readonly description?: string;
  /** 图标：插件命令为包内 `assets/` 相对路径，平台命令为 `chips-resource://platform/...`。 */
  readonly icon?: string;
  /** 默认窗口内快捷键，文法见契约 §2.6。 */
  readonly shortcut?: string | readonly string[];
  /** 是否允许在可编辑上下文中派发该快捷键；缺省 false。 */
  readonly shortcutInEditable?: boolean;
  /** 作用域。 */
  readonly scope?: ICommandScope;
  /** 适用条件。 */
  readonly when?: ICommandWhen;
  /** 调用参数 schema（平台 JSON Schema 子集，顶层 object + `additionalProperties: false`）。 */
  readonly paramsSchema?: Readonly<Record<string, unknown>>;
  /** 命令面板搜索关键词。 */
  readonly keywords?: readonly string[];
  /** 命令面板分组名（简体中文）。 */
  readonly group?: string;
  /** 菜单放置信息。 */
  readonly menus?: readonly ICommandMenuPlacement[];
  /** 工具栏放置信息。 */
  readonly toolbars?: readonly ICommandToolbarPlacement[];
  /** 应用 UI 本地处理器标识；ui 目标必填。 */
  readonly handlerId?: string;
}

/** 命令 owner。 */
export interface ICommandOwner {
  readonly kind: 'platform' | 'plugin';
  readonly pluginId: string | null;
  readonly sessionId: string | null;
}

/** 命令状态：平台按求值上下文计算，消费方不得自行推导。 */
export interface ICommandState {
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly checked: boolean;
  readonly reason?: string;
}

/** 命令视图：注册表对外的唯一读取形态。 */
export interface ICommandView {
  readonly definition: ICommandDefinition;
  /** 归一化后的图标 URI；未声明时为 null。 */
  readonly iconUri: string | null;
  readonly owner: ICommandOwner;
  readonly target: CommandTarget;
  readonly state: ICommandState;
  /** 最近一次注册/更新的时刻（ISO 8601 UTC）。 */
  readonly updatedAt: string;
}

/** 调用上下文；省略时平台按调用会话实际上下文求值。 */
export interface ICommandContext {
  readonly appId?: string;
  readonly surfaceId?: string;
  readonly documentId?: string;
}

/** `command:list` 输入。 */
export interface ICommandListInput {
  readonly context?: ICommandContext;
  /** 跨 owner 查询；仅平台组件与 CLI 可携带。 */
  readonly ownerPluginId?: string;
  readonly scopeKind?: CommandScopeKind;
  readonly includeHidden?: boolean;
}

/** `command:list` 输出。 */
export interface ICommandListOutput {
  readonly views: readonly ICommandView[];
}

/** `command:get` 输入。 */
export interface ICommandGetInput {
  readonly commandId: string;
  readonly context?: ICommandContext;
}

/** `command:get` 输出。 */
export interface ICommandGetOutput {
  readonly view: ICommandView;
}

/** `command:invoke` 输入。 */
export interface ICommandInvokeInput {
  readonly commandId: string;
  readonly payload?: unknown;
  /** 触发来源；消费入口必须如实声明。 */
  readonly source: CommandSource;
  readonly context?: ICommandContext;
}

/** `command:invoke` 输出。 */
export interface ICommandInvokeOutput {
  readonly invocationId: string;
  readonly commandId: string;
  readonly target: CommandTarget;
  readonly status: 'completed' | 'dispatched';
}

/** 可退订句柄；结构与《01-Bridge-API规范》§2.3 的 `ISubscription` 等价。 */
export interface ICommandSubscription {
  dispose(): void;
}

/** 本地处理器：与 `command:invoked` 事件配对执行。 */
export type CommandLocalHandler = (payload: unknown) => void | Promise<void>;

/** 本地处理器注册项。 */
export interface ICommandLocalRegistration {
  readonly commandId: string;
  readonly handlerId: string;
  readonly handler: CommandLocalHandler;
}

/** 应用 UI 命令运行时：平台注册表的无头适配层，不是第二套注册表。 */
export interface ICommandRuntime {
  /** 注册本地处理器；返回句柄，dispose 后撤销（幂等）。 */
  attach(registrations: readonly ICommandLocalRegistration[]): ICommandSubscription;
  /** 查询当前上下文的命令视图。 */
  list(input?: ICommandListInput): Promise<readonly ICommandView[]>;
  /** 调用命令；统一经 `command:invoke`。 */
  invoke(input: ICommandInvokeInput): Promise<ICommandInvokeOutput>;
}

/**
 * 命令运行时的平台访问端口。
 *
 * 结构与 `IChipsBridge` 的两项能力子集一致（`request` + `subscribe`）；默认实现从
 * 渲染进程的 `window.chips`（preload 注入）解析，平台壳与测试可显式注入。
 */
export interface ICommandBridgePort {
  request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput>;
  subscribe(eventId: string, handler: (payload: unknown) => void): ICommandSubscription;
}

/** `command:invoked` 事件载荷（契约 §4.2）。 */
export interface ICommandInvokedPayload {
  readonly invocationId: string;
  readonly commandId: string;
  readonly handlerId: string;
  readonly source: CommandSource;
  readonly payload?: unknown;
  readonly context: ICommandContext;
}

/** 命令运行时结构化诊断（本包内部观测面，不是平台错误码）。 */
export interface ICommandDiagnostic {
  /** 诊断标识：`HANDLER_MISSING` / `HANDLER_FAILED` / `PAYLOAD_INVALID` / `BRIDGE_UNAVAILABLE` / `LIST_FAILED` / `INVOKE_FAILED` / `SUBSCRIBE_FAILED`。 */
  readonly code: string;
  /** 简体中文诊断说明。 */
  readonly message: string;
  readonly commandId?: string;
  readonly handlerId?: string;
  /** 原始错误或载荷（仅诊断，不面向用户展示） */
  readonly detail?: unknown;
}
