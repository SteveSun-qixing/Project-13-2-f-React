/**
 * 资源打开路由域的端口契约（`14-资源打开与默认处理器契约` §3.4、§4.3、§4.6、§5.5）。
 *
 * 权威：`14.03` §3.4（候选集合：只来自 `active` 插件）、`14.04` §4.3（按角色投递表）、
 * §4.6（未命中降级）、`14.05` §5.5（`resource:opened` 定向投递）、§5.1（启动参数扩展）。
 *
 * @remarks
 * - 路由域不感知插件装载与窗口实现（平台机制与具体格式解耦，OR-3）：候选声明、用户偏好、
 *   处理器投递与未命中降级各自由端口注入；生产适配器见 `adapters/`。
 * - 投递语义（§4.3）由服务层编排：启用失败按原错误码拒绝、不尝试下一候选；`resource:opened`
 *   的「事件先到、`openFile` 后到」顺序在服务层钉死（§5.5）。
 */

import type { IResourceOpenContext } from './context.js';
import type { IResourceOpenLaunchArgs } from './context.js';
import type { IHandlerDeclaration } from './resolve-handler.js';

/** 处理器候选目录（§3.4：解析时的即时快照；候选只来自 `active` 插件）。 */
export interface IHandlerCatalogPort {
  /** 取当前候选声明快照（app / service 角色；`active` 状态）。 */
  snapshot(): Promise<readonly IHandlerDeclaration[]>;
}

/** 默认处理器偏好来源（§6.1：`platform.fileOpen.defaults` 生效值）。 */
export interface IHandlerPreferencePort {
  /** 读当前生效偏好（`Record<slot-key, pluginId>`；未登记返回空对象）。 */
  defaults(): Promise<Readonly<Record<string, string>>>;
}

/** 应用实例投递端口（§4.3 表 `app` 行）。 */
export interface IAppInstancePort {
  /** 实例状态：`absent`（未启用/无实例）或 `active`（运行中实例）。 */
  state(pluginId: string): 'absent' | 'active';
  /**
   * 新建实例投递：按启动流程请求启用，并以资源打开启动参数创建实例（§4.3、§5.1）。
   * 启用或启动失败按原错误码抛出（`KERNEL_*` / `APP_LAUNCH_FAILED`），服务层不改投候选。
   */
  launch(pluginId: string, args: IResourceOpenLaunchArgs): Promise<{ readonly windowId: number | null }>;
  /** 运行中实例投递 `openFile(uri)`（§4.3；未实现 `openFile` 时抛 `APP_OPEN_FILE_UNSUPPORTED`）。 */
  openFile(pluginId: string, uri: string): Promise<void>;
  /**
   * 定向发布 `resource:opened` 给该插件实例（§5.5：主逻辑经 `ctx.on`、UI 经 `chips.subscribe`；
   * 事件是通知，不承担请求-响应，订阅失败不阻断投递）。
   */
  publishOpened(pluginId: string, context: IResourceOpenContext): void;
}

/** 服务实例投递端口（§4.3 表 `service` 行：启用后调用 `handleFile(uri)`）。 */
export interface IServiceInstancePort {
  /** 启用（未启用时按文件关联路由请求启用）并调用 `handleFile(uri)`；失败按原错误码抛出。 */
  handleFile(pluginId: string, uri: string): Promise<void>;
}

/** 文档作用域形态探针（§4.6 Directory/Archive 判别：目录态文档走 shell、归档成员不可回退）。 */
export interface IDocumentScopeFormPort {
  /**
   * 查文档作用域形态：`directory`（目录态，附包根路径）或 `archive`（归档态）；不在册返回 `null`。
   */
  probe(scope: string): { readonly form: 'directory'; readonly path: string } | { readonly form: 'archive' } | null;
}

/** 未命中降级端口（§4.6：`external` 交系统浏览器、`shell` 交操作系统默认程序）。 */
export interface IResourceOpenFallbackPort {
  /**
   * External 作用域未命中：交系统浏览器打开（`mode: 'external'`）。
   * 系统打开不可用或失败时抛 `RESOURCE_HANDLER_MISSING`（§4.6 回退失败语义）。
   */
  openExternal(originUrl: string): Promise<void>;
  /**
   * Directory 来源未命中：交操作系统默认程序打开（`mode: 'shell'`）。
   * 平台在端口内部完成底层真实路径解析（OR-5：不经能力面暴露路径）；不可用或失败时抛
   * `RESOURCE_HANDLER_MISSING`。
   */
  openWithSystemDefault(target: { readonly kind: 'document-root'; readonly path: string }): Promise<void>;
}
