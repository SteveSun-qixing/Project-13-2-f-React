/**
 * 资源打开与默认处理器治理类型（14-资源打开与默认处理器契约 §2.2、§3.1、§4.5、§5.1、§6.2）。
 *
 * `resource:open` 与 `resource:list-handlers` 是资源打开路由的单一能力入口；
 * 打开不产生持久授权，文件关联只决定路由。
 */

import type { IAppLaunchArgs } from './roles/app.js';

/** 打开意图。 */
export type OpenIntent = 'view' | 'edit';

/** 打开来源。 */
export type OpenOrigin = 'os-association' | 'drop' | 'in-app' | 'frame';

/** 打开请求中的资源描述。 */
export interface IResourceOpenResource {
  /** 目标资源受管引用；能力调用只接受 `chips-resource://`。 */
  readonly uri: string;
  /** MIME 提示；省略时由平台按扩展名推断。 */
  readonly mimeType?: string;
  /** 展示用文件名（含扩展名）。 */
  readonly fileName?: string;
  /** 展示用标题。 */
  readonly title?: string;
  /** 业务上下文；平台原样透传给命中处理器。 */
  readonly payload?: Readonly<Record<string, unknown>>;
}

/** 打开请求：`resource:open` 能力的输入。 */
export interface IResourceOpenRequest {
  /** 打开意图；缺省 `view`。 */
  readonly intent?: OpenIntent;
  readonly resource: IResourceOpenResource;
}

/** 处理器层级。 */
export type HandlerTier = 'primary' | 'fallback';

/** 投递模式。 */
export type ResourceOpenMode = 'app' | 'service' | 'shell' | 'external';

/** 打开结果。 */
export interface IResourceOpenResult {
  readonly mode: ResourceOpenMode;
  /** mode 为 app / service 时命中处理器插件 ID。 */
  readonly pluginId?: string;
  /** mode 为 app 且实例主窗口已创建时的窗口 ID。 */
  readonly windowId?: number;
  /** 命中槽位键（`mime:<mime>` / `ext:<ext>`）；shell / external 模式缺席。 */
  readonly slot?: string;
  /** 归一后的资源视图，供日志与诊断。 */
  readonly resolved: {
    readonly uri: string;
    readonly mimeType: string;
    readonly extension?: string;
    readonly fileName?: string;
  };
}

/** 资源打开上下文：随启动参数投递给接收方实例。 */
export interface IResourceOpenContext {
  readonly intent: OpenIntent;
  readonly origin: OpenOrigin;
  /** 主资源受管引用；与 `args.files[0]` 同值。 */
  readonly uri: string;
  /** 归一后的 MIME。 */
  readonly mimeType: string;
  /** 含点小写扩展名；无法判定时缺席。 */
  readonly extension?: string;
  /** 展示用文件名（含扩展名）；无法判定时缺席。 */
  readonly fileName?: string;
  /** 展示用标题；调用方未提供时缺席。 */
  readonly title?: string;
  /** 命中槽位键（`mime:<mime>` / `ext:<ext>`）。 */
  readonly slot: string;
  /** 发起方业务上下文；平台原样透传，不解释。 */
  readonly payload?: Readonly<Record<string, unknown>>;
}

/** 资源打开来源下的启动参数。 */
export interface IResourceOpenLaunchArgs extends IAppLaunchArgs {
  readonly source: 'file-association';
  readonly resourceOpen: IResourceOpenContext;
}

/** 槽位候选。 */
export interface IHandlerCandidate {
  readonly pluginId: string;
  /** manifest name。 */
  readonly name: string;
  readonly role: 'app' | 'service';
  readonly tier: HandlerTier;
  /** 该候选是否被用户偏好选中。 */
  readonly isPreferred: boolean;
}

/** 处理器槽位。 */
export interface IHandlerSlot {
  /** 槽位键：`mime:<mime>` 或 `ext:<ext>`。 */
  readonly slot: string;
  /** 槽位为 MIME 槽位时的 MIME。 */
  readonly mimeType?: string;
  /** 槽位为扩展名槽位时的扩展名。 */
  readonly extension?: string;
  /** 偏好键上的原始记录；可能指向已停用、失败或已卸载插件。 */
  readonly preferencePluginId: string | null;
  /** 当前生效默认：有效偏好优先，否则按解析顺序后的首个候选。 */
  readonly defaultPluginId: string | null;
  /** 候选清单：有效偏好项在前，其后 primary、fallback。 */
  readonly handlers: readonly IHandlerCandidate[];
}

/** `resource:list-handlers` 输出。 */
export interface IListHandlersOutput {
  readonly slots: readonly IHandlerSlot[];
}
