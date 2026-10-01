/**
 * 资源打开路由域的类型面（结构视图）。
 *
 * 权威：`14-资源打开与默认处理器契约` §2.2（打开请求模型）、§4.5（结果模型）、§5.1（启动
 * 参数扩展）、§5.5（`resource:opened` payload）、§6.2（槽位视图）；`07-应用插件接口` §4.3
 * （`IAppLaunchArgs` 基础字段）。
 *
 * @remarks
 * - `@chips/host` 不在 `@chips/sdk` 的依赖边内（架构边界，与 `capabilities/document/` 同纪律），
 *   故在本模块镜像 `packages/sdk/src/types/resource-open.ts` 与 `types/roles/app.ts` 的相关形状；
 *   双源不漂移由 `tests/resource-open-contract.test.ts` 读取 SDK 源原文比对锁定。
 */

/** 打开意图（§2.2）。 */
export type OpenIntent = 'view' | 'edit';

/** 打开来源（§2.2）。 */
export type OpenOrigin = 'os-association' | 'drop' | 'in-app' | 'frame';

/** 打开请求中的资源描述（§2.2）。 */
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

/** 打开请求：`resource:open` 能力的输入（§2.2）。 */
export interface IResourceOpenRequest {
  /** 打开意图；缺省 `view`。 */
  readonly intent?: OpenIntent;
  readonly resource: IResourceOpenResource;
}

/** 投递模式（§4.5）。 */
export type ResourceOpenMode = 'app' | 'service' | 'shell' | 'external';

/** 打开结果（§4.5 `IResourceOpenResult` 同构）。 */
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

/** 资源打开上下文：随启动参数投递给接收方实例（§5.1 `IResourceOpenContext` 同构）。 */
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

/** 应用启动参数基础字段（`07-应用插件接口` §4.3 `IAppLaunchArgs` 同构投影）。 */
export interface IAppLaunchArgsView {
  readonly source: 'launcher' | 'file-association' | 'command' | 'deep-link';
  readonly files: readonly string[];
}

/** 资源打开来源下的启动参数（§5.1 `IResourceOpenLaunchArgs` 同构）。 */
export interface IResourceOpenLaunchArgs extends IAppLaunchArgsView {
  readonly source: 'file-association';
  readonly resourceOpen: IResourceOpenContext;
}

/** `resource:opened` 事件 payload（§5.5）。 */
export interface IResourceOpenedPayload {
  readonly pluginId: string;
  readonly context: IResourceOpenContext;
}
