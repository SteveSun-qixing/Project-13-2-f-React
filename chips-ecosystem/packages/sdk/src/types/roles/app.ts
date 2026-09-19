/**
 * 应用插件角色类型（07-应用插件接口 §2 接口总览、§3 IAppPlugin、§4 IAppContext）。
 *
 * 权威归属：
 * - 全部字段的名称、类型与语义以 07-应用插件接口 §2、§3、§4 为准（02-SDK-API规范 §2.2
 *   「插件角色」行以角色接口文档标注的 SDK 导出名为准）；
 * - `IResourceOpenLaunchArgs`（14-资源打开与默认处理器契约 §5.1）在 `IAppLaunchArgs`
 *   之上扩展资源打开成员，基础字段与来源不变量不在该契约内重复定义；
 * - `ConfigLayer` / `ConfigWriteScope` 的权威是 10-配置系统设计 §4，本模块只引用不重定义；
 * - `IAppBridge` 是主进程调用面收窄投影（01-Bridge-API规范 §2.6），定义在 `types/bridge.ts`；
 * - SDK 只声明编译期类型，不构造、不改写这些对象（02-SDK-API规范 §11 约束 1、2）。
 */

import type { IAppBridge, ISubscription } from '../bridge.js';
import type { ConfigLayer, ConfigWriteScope } from '../config.js';
import type { IEventSubscription } from '../kernel.js';

/** 应用表面形态，对应 manifest `ui.surface`（07 §4.2、§5.2）。 */
export type AppSurface = 'window' | 'desktop' | 'tray';

/** 启动来源；取值与 §4.3 不变量表一一对应。 */
export type AppLaunchSource = 'launcher' | 'file-association' | 'command' | 'deep-link';

/** 应用实例退出原因；触发对照见 07 §4.5 退出原因表。 */
export type AppExitReason = 'user' | 'platform' | 'shutdown' | 'failure';

/**
 * 应用实例本次启动的参数。
 *
 * 来源不变量（07-应用插件接口 §4.3）：
 *
 * | `source` | `files` | `command` / `commandArgs` | `url` |
 * |---|---|---|---|
 * | `launcher` | 空数组 | 不出现 | 不出现 |
 * | `file-association` | 1 个及以上 | 不出现 | 不出现 |
 * | `command` | 空数组（`command` 必有、`commandArgs` 可选） | 出现 | 不出现 |
 * | `deep-link` | 空数组（`url` 必有） | 不出现 | 出现 |
 */
export interface IAppLaunchArgs {
  /** 启动来源。 */
  readonly source: AppLaunchSource;
  /** 本次启动需要打开的文件 URI 列表；无文件时为空数组。 */
  readonly files: readonly string[];
  /** `source` 为 `deep-link` 时的深链接 URL。 */
  readonly url?: string;
  /** `source` 为 `command` 时的命令标识。 */
  readonly command?: string;
  /** `source` 为 `command` 时的命令参数。 */
  readonly commandArgs?: unknown;
}

/**
 * 生效的启动器信息（07 §4.2、§5.3）。
 *
 * manifest 未声明 `ui.launcher` 时 `IAppContext.launcher` 为 `null`；声明时缺省字段
 * 由平台按 §5.3 补齐后送达。
 */
export interface IAppLauncherInfo {
  /** 启动器显示名称；缺省取 manifest `name`。 */
  readonly name: string;
  /** 启动器图标（包内相对路径，经 `chips-resource://` 解析）；缺省取插件包默认图标。 */
  readonly icon: string;
  /** 启动器描述；缺省取 manifest `description`。 */
  readonly description?: string;
}

/**
 * 平台创建的应用表面句柄（07 §4.4）。
 *
 * 句柄只代表 manifest 声明的表面窗口，由平台按 R17 安全基线创建；窗口已关闭后调用返回
 * `APP_WINDOW_CLOSED`；运行中额外创建窗口一律经 `window:*` 能力。
 */
export interface IAppWindow {
  /** 窗口 ID；与 `window:created` / `window:closed` payload 中的 `windowId` 同值。 */
  readonly id: number;
  /** 关闭窗口；主窗口关闭可能触发实例退出（07 §6.3）。 */
  close(): Promise<void>;
  /** 聚焦并置前窗口。 */
  focus(): Promise<void>;
  /** 设置窗口标题；`desktop` 表面忽略该调用。 */
  setTitle(title: string): Promise<void>;
  /** 设置窗口内容尺寸（像素）。 */
  setSize(width: number, height: number): Promise<void>;
}

/**
 * 应用实例生命周期钩子（07 §4.5）。
 *
 * `beforeExit` 在退出流程开始时每个实例每轮退出恰好调用一次；不可取消退出；
 * 实例退出时自动撤销全部订阅，返回的句柄仅用于提前撤销。
 */
export interface IAppLifecycle {
  /** 注册退出前钩子；返回句柄用于提前撤销，实例退出时自动撤销。 */
  beforeExit(handler: (reason: AppExitReason) => Promise<void> | void): ISubscription;
}

/** 配置读取结果（07 §2、10-配置系统设计 §4）。 */
export interface IAppConfigView {
  /** 完整键：`plugins.<appId>.<相对键>`。 */
  readonly key: string;
  /** 生效值；未定义且无默认值时由实现决定。 */
  readonly value: unknown;
  /** 生效值所在层。 */
  readonly layer: ConfigLayer;
  /** 是否来自 schema 声明默认值。 */
  readonly isDefault: boolean;
}

/** 配置变更载荷（`config:changed` 事件 payload，07 §7.2、§7.3）。 */
export interface IAppConfigChange {
  /** 完整配置键。 */
  readonly key: string;
  /** 本次变化影响的层。 */
  readonly layer: ConfigLayer;
  /** 该层当前值；`null` 表示覆盖被移除。 */
  readonly value: unknown;
  /** 变化后的生效值。 */
  readonly effectiveValue: unknown;
  /** 生效值是否来自默认值。 */
  readonly isDefault: boolean;
  /** 变更来源；插件写入为 `plugin:<pluginId>`。 */
  readonly origin: string;
}

/**
 * 应用自身命名空间的配置访问（07 §4.6、§7.3）。
 *
 * 作用域固定为 `plugins.<appId>`；`key` 为相对键；写入层只接受 `user` 与 `workspace`；
 * 访问 `platform` 命名空间必须经 `ctx.bridge.request('config:get' | 'config:set', ...)`。
 */
export interface IAppConfig {
  /** 读取相对键的生效值。 */
  get(key: string): Promise<IAppConfigView>;
  /** 返回前缀下合并默认值后的完整生效视图。 */
  snapshot(prefix?: string): Promise<Readonly<Record<string, unknown>>>;
  /** 在用户层或工作区层写入覆盖。 */
  set(key: string, value: unknown, scope: ConfigWriteScope): Promise<void>;
  /** 移除指定层上的覆盖；缺失覆盖为 no-op。 */
  reset(keys: readonly string[], scope: ConfigWriteScope): Promise<void>;
  /** 订阅前缀匹配的变更；句柄随实例退出自动撤销。 */
  watch(prefix: string, handler: (change: IAppConfigChange) => void): IEventSubscription;
}

/** 日志结构化字段；只允许字符串、数字、布尔与 `null` 标量（07 §4.6、10 §3.6）。 */
export type AppLogFields = Readonly<Record<string, string | number | boolean | null>>;

/**
 * 平台日志流（07 §4.6）。
 *
 * 免权限（R19）：按插件命名空间自动归属，写入失败不抛出、不中断应用；
 * `message` 使用简体中文，结构化细节放 `fields`。
 */
export interface IAppLogger {
  debug(message: string, fields?: AppLogFields): void;
  info(message: string, fields?: AppLogFields): void;
  warn(message: string, fields?: AppLogFields): void;
  error(message: string, error?: unknown, fields?: AppLogFields): void;
}

/**
 * 应用实例上下文：内核 `Context` 在应用实例维度的受控视图，由平台在调用 `launch` 前构造
 * （07 §4.1、§4.6）。
 *
 * 规则：
 * - 只在本实例生命周期内有效；实例退出后对象失效，登记的订阅、注入回调与清理自动撤销；
 * - 字段均为只读；实例字段不得跨实例缓存复用；
 * - 访问面不包含 `provide` 与 `registerCapability`（应用不对外提供接口，07 §4.6）；
 * - 事件订阅使用 `on` / `once`，`bridge` 无 `subscribe`（07 §4.6）。
 */
export interface IAppContext {
  /** 应用插件 ID，即 manifest `id`；与 `app:launched` / `window:created` 事件中的 `appId` 一致。 */
  readonly appId: string;
  /** 生效的表面形态。 */
  readonly surface: AppSurface;
  /** 生效的启动器信息；未注册启动器入口时为 `null`。 */
  readonly launcher: IAppLauncherInfo | null;
  /** 本次启动参数。 */
  readonly args: IAppLaunchArgs;
  /** 主窗口句柄；`surface` 为 `tray` 时为 `null`。 */
  readonly window: IAppWindow | null;
  /** 生命周期钩子。 */
  readonly lifecycle: IAppLifecycle;

  /** 主进程出站能力与资源访问。 */
  readonly bridge: IAppBridge;
  /** 自身命名空间配置访问。 */
  readonly config: IAppConfig;
  /** 平台日志流。 */
  readonly logger: IAppLogger;

  /** 声明服务依赖并注入回调；回调随实例退出撤销。 */
  inject(dependencies: readonly string[], callback: (ctx: IAppContext) => void): void;
  /** 订阅内核事件；句柄随实例退出自动撤销。 */
  on<TPayload>(event: string, listener: (payload: TPayload) => void): IEventSubscription;
  /** 订阅内核事件，首次投递后自动退订。 */
  once<TPayload>(event: string, listener: (payload: TPayload) => void): IEventSubscription;
  /** 发布插件自有域事件；不跨进程。 */
  emit<TPayload>(event: string, payload: TPayload): void;
  /** 登记自定义清理；随实例退出撤销。 */
  effect(cleanup: () => void): void;

  /** 请求结束本应用实例；幂等；`code` 随 `app:exited` 的 `exitCode` 透出。 */
  exit(code?: number): Promise<void>;
}

/**
 * 应用插件入口接口（07 §3）。
 *
 * 入口绑定：插件模块入口默认导出实现本接口的对象；模块顶层只允许声明，不得产生副作用。
 * `launch` / `handleCommand` / `openFile` 只由平台调用；运行中投递的上下文经 `launch`
 * 保存的 `IAppContext` 引用访问（07 §3.5、§4.6）。
 */
export interface IAppPlugin {
  /** 启动应用实例；每个实例恰好调用一次；resolve 表示启动完成。 */
  launch(ctx: IAppContext): Promise<void>;
  /** 处理运行中实例收到的命令；未实现时平台返回 `APP_COMMAND_UNSUPPORTED`。 */
  handleCommand?(command: string, args: unknown): Promise<void>;
  /** 处理运行中实例收到的文件打开请求；未实现时平台返回 `APP_OPEN_FILE_UNSUPPORTED`。 */
  openFile?(uri: string): Promise<void>;
}
