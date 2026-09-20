/**
 * CLI 命令发现类型与 `cliCommand` 接口面（07-CLI完整参考 §5.6、§5.8；02-SDK-API规范 §3.5）。
 *
 * 口径：
 * - `cliCommand` 只读：读取当前工作区命令索引，不修改插件状态（§3.5）；发现索引由平台在安装、
 *   启用、禁用、卸载后重建，CLI、补全与 TUI 每次读取最新索引，不缓存、不推断（§5.8）；
 * - 传输是 §5.8 登记的 `cli.command.list` / `cli.command.get` / `cli.command.resolve` 服务路由，
 *   经客户端目标 Bridge 转发，SDK 不新增通道、不维护第二份命令索引（§11 约束 12）；
 * - `CliCommandView.declaration` 是 manifest `cli.commands[]` 条目在发现面上的视图，字段权威
 *   见 §5.1 命令级字段表与 §5.2 参数模型表；本文件中未列入 §2.2 清单的类型不从主入口导出，
 *   消费方经 `CliCommandView['declaration']` 取得该形状；
 * - 查询参数非法返回 `CLI_COMMAND_QUERY_INVALID`、多匹配返回 `CLI_COMMAND_CONFLICT`，均由平台
 *   判定并以 `ChipsError` 透出（§3.5、§5.8）。
 */

/** 发现查询的目标类型（§5.6：`'app' | 'service'`，与插件角色一致）。 */
export type CliCommandTargetType = 'app' | 'service';

/**
 * 发现查询参数（§5.6）。
 *
 * `entryId` 与 `commandPath` 至少其一才构成可定位查询（§5.8）；`pluginId` 用于显式消解冲突
 * （§5.5）；`includeDisabled` 只服务治理视图，缺省 `false`（§5.5、§5.8）。
 */
export interface CliCommandQueryOptions {
  /** CLI 入口标识，`<pluginId>.cli.<commandPath 点分>`（§5.1）。 */
  readonly entryId?: string;
  /** 命令路径，单段字符串或多段数组（§5.1）。 */
  readonly commandPath?: string | readonly string[];
  /** 限定 owner 插件 ID（§5.5 冲突消解）。 */
  readonly pluginId?: string;
  /** 限定目标类型（§5.3）。 */
  readonly targetType?: CliCommandTargetType;
  /** 治理视图需要包含禁用插件的命令时置 `true`；缺省 `false`。 */
  readonly includeDisabled?: boolean;
}

/** 参数类型 11 种（§5.2 参数类型表）。 */
export type CliCommandParameterType =
  | 'string'
  | 'stringList'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'path'
  | 'json'
  | 'jsonFile'
  | 'text'
  | 'textFile';

/** 路径规则（§5.2 路径规则表）。 */
export interface CliCommandPathRules {
  /** 目标类型；不符返回 `CLI_PATH_INVALID`。 */
  readonly kind?: 'file' | 'directory' | 'any';
  /** 输入路径或输出路径；`overwrite` 策略仅 `output` 有效。 */
  readonly role?: 'input' | 'output';
  /** `true` 时路径不存在返回 `CLI_PATH_NOT_FOUND`。 */
  readonly exists?: boolean;
  /** 输出目录按需创建。 */
  readonly create?: boolean;
  /** 扩展名白名单（不含点，大小写不敏感）。 */
  readonly extensions?: readonly string[];
  /** 输出冲突策略，缺省 `fail`。 */
  readonly overwrite?: 'fail' | 'overwrite' | 'rename' | 'skip';
}

/** 批量规则（§5.2 批量规则表）。 */
export interface CliCommandBatchRules {
  /** 按行读取并过滤空行；或要求 JSON 顶层为数组。 */
  readonly format?: 'lines' | 'json-array';
  /** 批量项是普通值或路径。 */
  readonly itemType?: 'value' | 'path';
  /** 仅 `itemType: path` 允许声明。 */
  readonly itemPath?: CliCommandPathRules;
}

/** 取值校验规则（§5.2 `validation` 字段）。 */
export interface CliCommandValidationRules {
  readonly min?: number;
  readonly max?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

/** TUI 控件提示（§5.2 TUI 控件提示表）。 */
export interface CliCommandUiHints {
  readonly control?:
    | 'select'
    | 'multiSelect'
    | 'toggle'
    | 'stepper'
    | 'slider'
    | 'pathInput'
    | 'pasteBox'
    | 'textarea';
  /** 控件候选项。 */
  readonly choices?: readonly unknown[];
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** 输入框占位文案（简体中文）。 */
  readonly placeholder?: string;
}

/** 单个参数声明（§5.2 参数字段表；`arguments` 与 `options` 共用同一模型）。 */
export interface CliCommandParameterDeclaration {
  /** 参数名，`^[a-z][a-z0-9-]*$/i`。 */
  readonly name: string;
  /** 短名；单个字母或数字。 */
  readonly short?: string;
  /** 参数类型。 */
  readonly type: CliCommandParameterType;
  /** 仅 `arguments`：非负整数，同命令内唯一。 */
  readonly position?: number;
  /** 缺省 `false`；缺失必填参数返回 `CLI_ARGUMENT_INVALID`。 */
  readonly required?: boolean;
  /** 未提供时写入 payload 的默认值。 */
  readonly default?: unknown;
  /** payload 点分路径；缺省为参数名。 */
  readonly mapsTo?: string;
  /** 允许值集合；`enum` 必须声明。 */
  readonly choices?: readonly unknown[];
  /** 允许重复传入并合并为数组。 */
  readonly multiple?: boolean;
  readonly validation?: CliCommandValidationRules;
  readonly path?: CliCommandPathRules;
  readonly batch?: CliCommandBatchRules;
  readonly ui?: CliCommandUiHints;
}

/** 命令目标（§5.3；`type` 必须等于插件角色）。 */
export interface CliCommandTargetDeclaration {
  readonly type: CliCommandTargetType;
  /** 目标插件 ID。 */
  readonly pluginId: string;
  /** `service` 目标的能力 ID；`app` 目标不得声明（§5.1 校验规则 7）。 */
  readonly capability?: string;
  /** 仅 `app` 目标允许声明。 */
  readonly surface?: {
    readonly open?: boolean;
    readonly focus?: boolean;
    readonly reuse?: 'always' | 'never' | 'preferred';
  };
}

/** 输出与产物声明（§5.4）。 */
export interface CliCommandOutputDeclaration {
  readonly mode?: 'human' | 'json';
  readonly json?: 'supported' | 'required' | 'unsupported';
  /** 产物字段路径列表。 */
  readonly artifacts?: readonly string[];
}

/** 任务等待策略声明（§5.7；仅 `app` 目标允许声明）。 */
export interface CliCommandJobDeclaration {
  readonly wait?: boolean;
  readonly cancelOnInterrupt?: boolean;
}

/** 冲突治理元数据（§5.5；`namespace` 不参与自动解析）。 */
export interface CliCommandConflictDeclaration {
  /** 冲突时优先参与自动解析；数值高者优先，缺省 0。 */
  readonly priority?: number;
  readonly namespace?: string;
}

/**
 * 命令声明视图（§5.1 `cli.commands[]` 条目）。
 *
 * 校验规则由 `chips plugin pack` 与安装校验执行（§5.1 规则 1 至 8），发现面只回传已入库声明。
 */
export interface CliCommandDeclaration {
  readonly commandPath: string | readonly string[];
  /** 运行时命令 ID，`<domain>:<action>`；`app` 目标必填、`service` 目标禁止声明。 */
  readonly commandId?: string;
  /** 显示标题（简体中文直写）。 */
  readonly title: string;
  readonly description?: string;
  /** 每条为可执行的完整命令示例。 */
  readonly examples?: readonly string[];
  /** 本命令执行所需的已登记权限 ID（R19）。 */
  readonly permissions?: readonly string[];
  readonly target: CliCommandTargetDeclaration;
  readonly arguments?: readonly CliCommandParameterDeclaration[];
  readonly options?: readonly CliCommandParameterDeclaration[];
  readonly output?: CliCommandOutputDeclaration;
  readonly job?: CliCommandJobDeclaration;
  readonly conflict?: CliCommandConflictDeclaration;
}

/** 冲突条目（§5.5）：与 `CliCommandView` 同用 `owner` 表达所属插件（§5.6）。 */
export interface CliCommandConflict {
  readonly entryId: string;
  readonly commandPath: readonly string[];
  /** 冲突入口的 owner 插件 ID。 */
  readonly owner: string;
  /** 参与自动解析的优先级（`conflict.priority`，缺省 0）。 */
  readonly priority: number;
  /** 治理分组名，仅用于诊断展示。 */
  readonly namespace?: string;
}

/**
 * CLI 命令视图（§5.6）：同时携带 CLI 侧标识与运行时命令引用。
 *
 * `commandId` 仅在 `app` 目标存在，指向运行时命令注册表的命令 ID。
 */
export interface CliCommandView {
  /** CLI 入口标识，`<pluginId>.cli.<commandPath 点分>`（§5.1）。 */
  readonly entryId: string;
  /** 命令路径段。 */
  readonly commandPath: readonly string[];
  /** `app` 目标的运行时命令 ID。 */
  readonly commandId?: string;
  /** owner 插件 ID。 */
  readonly owner: string;
  /** 所属插件是否启用；禁用命令默认不参与可执行匹配（§5.5）。 */
  readonly enabled: boolean;
  readonly declaration: CliCommandDeclaration;
  /** 与该入口形成同键冲突的全部入口（§5.5）。 */
  readonly conflicts: readonly CliCommandConflict[];
}

/** 发现索引：命令路径键 → `entryId` 列表（§5.6、§5.8「条目路径 → entryId 列表」）。 */
export type CliCommandIndex = Readonly<Record<string, readonly string[]>>;

/** `cli.command.list` 结果（§5.6、§5.8）。 */
export interface CliCommandListResult {
  readonly index: CliCommandIndex;
  readonly commands: readonly CliCommandView[];
}

/** `cli.command.resolve` 结果：未限定 `pluginId` / `entryId` 时不自动选择冲突入口（§5.5）。 */
export interface CliCommandResolveResult {
  readonly command?: CliCommandView;
  readonly conflicts: readonly CliCommandConflict[];
}

/**
 * `ChipsBridge.cliCommand` 命名空间形状（§3.5、§5.6）。
 *
 * SDK 只做类型化封装：三个方法一律经目标 Bridge 的 `request` 转发到 §5.8 的服务路由，
 * 不缓存索引、不复算冲突、不自定义错误码。
 */
export interface CliCommandApi {
  /**
   * 列出命中查询条件的命令与当前索引。
   *
   * @param options - 查询参数；省略即全量读取当前工作区命令索引
   * @returns `{ index, commands }`
   */
  list(options?: CliCommandQueryOptions): Promise<CliCommandListResult>;

  /**
   * 读取唯一命令视图。
   *
   * @param options - 查询参数，必须能定位单一入口
   * @returns 命令视图；无匹配返回 `undefined`
   */
  get(options: CliCommandQueryOptions): Promise<CliCommandView | undefined>;

  /**
   * 解析命令路径并透出冲突组。
   *
   * @param options - 查询参数
   * @returns `{ command?, conflicts }`
   */
  resolve(options: CliCommandQueryOptions): Promise<CliCommandResolveResult>;
}
