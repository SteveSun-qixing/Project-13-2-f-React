/**
 * 命令系统类型与 `command:*` 能力契约（13-命令系统契约 §2、§3.2）。
 *
 * 命令 ID 文法 `<domain>:<action>`；owner 与执行目标由注册通道决定，注册方不可自选；
 * 条件求值只允许登记键，不引入表达式语言。
 */

// === 命令模型（§2） ===

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

/** 结构化条件：只允许下列字段，不引入表达式语言。 */
export interface ICommandCondition {
  /** 条件键，取值见命令上下文快照。 */
  readonly key: string;
  readonly equals?: unknown;
  readonly notEquals?: unknown;
  readonly in?: readonly unknown[];
  readonly truthy?: boolean;
}

/** 命令适用条件；三个状态独立求值，缺省 `enabled=true`、`visible=true`、`checked=false`。 */
export interface ICommandWhen {
  readonly enabled?: boolean | ICommandCondition;
  readonly visible?: boolean | ICommandCondition;
  readonly checked?: boolean | ICommandCondition;
}

/** 命令在某一菜单中的放置信息。 */
export interface ICommandMenuPlacement {
  readonly menuId: string;
  /** 菜单内分组名（简体中文）。 */
  readonly group?: string;
  /** 组内排序；缺省按注册顺序。 */
  readonly order?: number;
}

/** 命令在某一工具栏中的放置信息。 */
export interface ICommandToolbarPlacement {
  readonly toolbarId: string;
  readonly group?: string;
  readonly order?: number;
}

/** 命令定义：注册方提交给平台的完整元数据。 */
export interface ICommandDefinition {
  /** 命令 ID，`<domain>:<action>`。 */
  readonly id: string;
  /** 显示标题（简体中文直写）。 */
  readonly title: string;
  readonly description?: string;
  /** 图标：插件命令为 `assets/` 内包内相对路径；平台命令为 `chips-resource://platform/...`。 */
  readonly icon?: string;
  /** 默认窗口内快捷键，文法见 §2.6；单个或一组。 */
  readonly shortcut?: string | readonly string[];
  /** 是否允许在可编辑上下文中派发该快捷键；缺省 `false`。 */
  readonly shortcutInEditable?: boolean;
  /** 作用域；插件命令缺省 `{ kind: 'app' }`，平台命令缺省 `{ kind: 'global' }`。 */
  readonly scope?: ICommandScope;
  readonly when?: ICommandWhen;
  /** 调用参数 schema；编写规则同能力 schema。 */
  readonly paramsSchema?: Readonly<Record<string, unknown>>;
  /** 命令面板搜索关键词，最多 16 个、每个不超过 32 字符。 */
  readonly keywords?: readonly string[];
  /** 命令面板分组名（简体中文）。 */
  readonly group?: string;
  /** 菜单放置信息，最多 8 条。 */
  readonly menus?: readonly ICommandMenuPlacement[];
  /** 工具栏放置信息，最多 8 条。 */
  readonly toolbars?: readonly ICommandToolbarPlacement[];
  /** 应用 UI 本地处理器标识；ui 目标必填，main/platform 目标禁止出现。 */
  readonly handlerId?: string;
}

/** 命令 owner。 */
export interface ICommandOwner {
  readonly kind: 'platform' | 'plugin';
  /** 插件 owner 的插件 ID；平台 owner 为 `null`。 */
  readonly pluginId: string | null;
  /** ui 目标注册时的窗口会话 ID；main/platform 目标为 `null`。 */
  readonly sessionId: string | null;
}

/** 命令状态：平台按求值上下文计算，消费方不得自行推导。 */
export interface ICommandState {
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly checked: boolean;
  /** visible 或 enabled 为 false 时的简体中文原因。 */
  readonly reason?: string;
}

/** 命令视图：注册表对外的唯一读取形态。 */
export interface ICommandView {
  readonly definition: ICommandDefinition;
  /** 归一化后的图标 URI；未声明时为 `null`。 */
  readonly iconUri: string | null;
  readonly owner: ICommandOwner;
  readonly target: CommandTarget;
  readonly state: ICommandState;
  /** 最近一次注册/更新的时刻（ISO 8601 UTC）。 */
  readonly updatedAt: string;
}

// === `command:*` 能力契约（§3.2） ===

/** `command:register` 输入。 */
export interface ICommandRegisterInput {
  readonly definition: ICommandDefinition;
}

/** `command:register` 输出。 */
export interface ICommandRegisterOutput {
  readonly view: ICommandView;
}

/** `command:unregister` 输入；幂等，目标不存在视为成功。 */
export interface ICommandUnregisterInput {
  readonly commandId: string;
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
  /** 管理视图需要包含隐藏命令时置 `true`；缺省 `false`。 */
  readonly includeHidden?: boolean;
}

/** `command:list` 输出；顺序稳定，按 `group`、`order`、注册顺序排列。 */
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
  /** 触发来源；消费入口必须如实声明，平台写入审计。 */
  readonly source: CommandSource;
  /** 显式上下文；仅平台组件与 CLI 可携带。 */
  readonly context?: ICommandContext;
}

/** `command:invoke` 输出。 */
export interface ICommandInvokeOutput {
  readonly invocationId: string;
  readonly commandId: string;
  readonly target: CommandTarget;
  /** main/platform 目标等待处理完成；ui 目标完成派发即返回。 */
  readonly status: 'completed' | 'dispatched';
}
