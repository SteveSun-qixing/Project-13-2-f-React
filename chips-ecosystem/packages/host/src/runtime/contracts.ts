/**
 * 平台运行时端口（壳 → 核心）与核心 → 壳的内部回调面。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动与退出顺序）、§3.2（唯一交互面）、
 * `02-Bridge三层设计` §2.1（主进程适配层职责）、§7（IPC 通道与消息格式）。
 *
 * @remarks
 * - 壳只把"已按来源解析的会话 + 已编解码的消息"交给核心；会话有效性、权限、schema、路由与
 *   错误归一全部在核心，壳不重复实现（SB-1/SB-2/SB-6）。
 * - 平台核心（Cordis 内核 + Bridge）装配由组合根提供；本文件只定义壳消费的端口。
 */

import type { IPalHost } from '../platform/contracts/index.js';
import type {
  IBridgeRequest,
  IBridgeResponse,
  IEventControlRequest,
  IEventControlResponse,
  IEventEnvelope,
  IResourceControlRequest,
  IResourceControlResponse,
  ISessionPermissionsUpdate,
  IWireChipsError,
} from '../protocol/wire.js';

/** 会话来源；由壳按 IPC 来源（`webContents` + frame）或协议来源（窗口 session）解析。 */
export interface ISessionSource {
  /** Electron `webContents.id`。 */
  readonly windowId: number;
  /** 主框架 routing id。 */
  readonly frameId: number | null;
}

/**
 * 壳层启动输入的核心投递形态。
 *
 * 权威：`14-资源打开与默认处理器契约` §2.1、§2.4（`os-association` 由壳接收并归一为受管引用）、
 * `13-工作区设计` §7（开发工作区选择）。
 *
 * @remarks 壳只传递原始路径；路径归一、临时作用域注册与打开路由全部由核心完成。
 */
export type IPlatformStartupInput =
  { readonly kind: 'open-path'; readonly path: string } | { readonly kind: 'workspace'; readonly path: string };

/** 能力调用、资源控制与事件控制的核心端点。 */
export interface IPlatformIpcEndpoint {
  /** 处理能力调用；返回 `IBridgeResponse`。 */
  handleRequest(session: ISessionSource, request: IBridgeRequest): Promise<IBridgeResponse>;
  /** 处理资源句柄控制（open / release）。 */
  handleResourceControl(session: ISessionSource, request: IResourceControlRequest): Promise<IResourceControlResponse>;
  /** 处理事件订阅控制（subscribe / unsubscribe）并回执。 */
  handleEventControl(session: ISessionSource, request: IEventControlRequest): Promise<IEventControlResponse>;
  /** 窗口关闭：核心据此清理会话、订阅、句柄并取消在途调用。 */
  handleWindowClosed(windowId: number): void;
}

/** 事件下行投递口；核心按窗口订阅计数调用。 */
export interface IEventSink {
  /** 向指定窗口投递事件信封；窗口不存在时静默丢弃。 */
  deliver(windowId: number, envelope: IEventEnvelope): void;
}

/** 核心 → 壳 的内部回调面（`session:permissions` 推送；平台内部通道，插件不可订阅）。 */
export interface IPlatformHostChannel {
  /** 推送会话权限快照；preload 据此刷新快速失败预检缓存（白名单通道）。 */
  pushSessionPermissions(windowId: number, update: ISessionPermissionsUpdate): void;
}

/** 协议路径的资源读取请求（由壳的 `chips-resource://` 处理器构造）。 */
export interface IResourceReadRequest {
  /** 规范化后的资源 URI。 */
  readonly uri: string;
  /** 解析后的会话来源；`null` 表示会话无法解析。 */
  readonly session: ISessionSource | null;
  /** HTTP 方法（已限定为 `GET` 或 `HEAD`）。 */
  readonly method: 'GET' | 'HEAD';
  /** 解析后的字节范围（`Range: bytes=start-end`）；无范围请求时为 `null`。 */
  readonly range: { readonly start: number; readonly end: number | null } | null;
  /** 请求头（原始，仅供核心判定缓存与条件请求）。 */
  readonly headers: Readonly<Record<string, string>>;
}

/** 协议路径的资源读取结果。 */
export interface IResourceReadResult {
  /** HTTP 状态；核心可返回 200 / 206 / 416 等。 */
  readonly status: number;
  /** 响应头；壳会补充固定安全头与 CORS 头。 */
  readonly headers: Readonly<Record<string, string>>;
  /** 响应体；`HEAD` 请求可为 `null`。 */
  readonly body: Uint8Array | ReadableStream<Uint8Array> | null;
}

/** 资源读取后端（核心资源管理器）。 */
export interface IResourceBackend {
  /**
   * 读取资源；失败时抛出 `IWireChipsError` 同构错误（`code` 为 `RESOURCE_*`）。
   *
   * @throws {Error} 带 `code` 字段的错误对象；壳映射为 HTTP 状态并写审计。
   */
  read(request: IResourceReadRequest): Promise<IResourceReadResult>;
}

/**
 * 宿主内部取视图通道端点（壳渲染进程 RenderHost ↔ 主进程；工单035 裁定 C+B）。
 *
 * @remarks
 * - 封套形状与两侧校验闸的权威在 `renderer/document-view-channel.ts` 契约（本端口不重复
 *   声明消息类型，避免跨层类型依赖；端点两侧均为平台自身代码，不经 Bridge 能力注册表、
 *   无 capability ID、权限判定不适用）。
 * - `handleRequest` 接收渲染侧 `ipcRenderer.invoke` 的原始载荷：内部先过请求闸
 *   （非法载荷以在册错误面失败臂回包，不静默、不上抛），成功路径返回守门后的结果臂；
 *   返回值必为可结构化克隆的通道响应封套（`DocumentViewBuildResponse` 形状）。
 */
export interface IDocumentViewChannelEndpoint {
  handleRequest(data: unknown): Promise<unknown>;
}

/**
 * 卡片窗口装载投递的文档绑定（`document:open` 回包同源字段的结构投影）。
 *
 * @remarks 字段与 `capabilities/document/service.ts` 的 `ICardWindowDocumentBinding` 逐字段同形；
 * 本端口层不 import 能力层类型（与 {@link IDocumentViewChannelEndpoint} 同纪律：不在跨层边界
 * 重复声明形状权威，只做结构切片），能力侧交付的实现以其自身类型满足本投影。
 */
export interface ICardWindowDocumentBindingView {
  /** 稳定文档标识（十位 Base62；`document:open` 回包的 `documentId` 同源字段）。 */
  readonly documentId: string;
  /** 资源基址（受管引用的作用域根 URI，资源管理器作用域身份）。 */
  readonly resourceBase: string;
}

/**
 * 文档绑定解析端口（按来源引用定位存活会话记录；无绑定为 `null`）。
 *
 * @remarks 口径与取视图通道的 `resolveViewSession` 一致（同一会话存储、同一 `source` 即受管
 * 引用会话键）；同步查询，主进程内部消费，不出主进程。
 */
export type CardWindowDocumentBindingResolver = (source: string) => ICardWindowDocumentBindingView | null;

/** 平台运行时端口。 */
export interface IPlatformRuntime {
  /**
   * 启动平台核心：内核 → 解析器 / 资源管理器 / 文档服务 → Bridge 按能力矩阵注册内置能力。
   *
   * @param host 壳构造的 PAL 宿主（壳信息、能力矩阵、端口集合）。
   * @param channel 核心 → 壳的内部回调面（会话权限推送）。
   * @throws {Error} 注册校验失败时抛出，壳终止启动。
   */
  start(host: IPalHost, channel: IPlatformHostChannel): Promise<void>;
  /** 按启用偏好恢复插件（拓扑序），创建窗口之后调用。 */
  restorePlugins(): Promise<void>;
  /**
   * 投递壳层启动输入（操作系统打开事件、第二实例参数、工作区开关）。
   *
   * @param inputs 结构化启动输入；核心按打开路由契约归一与投递。
   */
  handleStartupInputs(inputs: readonly IPlatformStartupInput[]): Promise<void>;
  /** 停用插件并完成 Fork 撤销；`app` 角色在此阶段关闭窗口。 */
  stopPlugins(): Promise<void>;
  /** 关闭 Bridge、注销全部能力、核心进入停机。 */
  shutdown(): Promise<void>;
  /** IPC 端点。 */
  readonly ipc: IPlatformIpcEndpoint;
  /** 资源读取后端。 */
  readonly resources: IResourceBackend;
  /**
   * 宿主内部取视图通道端点（可选；组合根装配文档能力时交付，未装配即缺位——
   * 壳启动 `ipc` 段据此决定 `document-view:request` 通道的注册与注销）。
   */
  readonly documentViewChannel?: IDocumentViewChannelEndpoint;
  /**
   * 卡片窗口装载投递的文档绑定解析端口（可选；组合根文档能力装载段交付）。
   *
   * @remarks 主进程内部查询面：卡片窗口装载投递腿（`main/card-window-init-channel.ts`）凭它
   * 把登记表 `source` 解析为 `document:open` 回包同源的稳定标识与资源基址，钉死
   * `windowId ↔ source ↔ documentId` 一致性（工单035 §九待裁随账收口）。缺位即绑定腿未就绪，
   * 投递臂按在册码 `DOCUMENT_NOT_OPEN` 如实拒收（不伪造装载）。
   */
  readonly cardWindowDocumentBinding?: CardWindowDocumentBindingResolver;
  /** 注册事件下行投递口；返回注销函数（幂等）。 */
  forwardEvents(sink: IEventSink): () => void;
}

/** 判断未知异常是否为带 `code` 的资源错误。 */
export function asWireError(error: unknown): IWireChipsError {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const candidate = error as { code?: unknown; message?: unknown; details?: unknown; retryable?: unknown };
    if (typeof candidate.code === 'string') {
      const result: IWireChipsError = {
        code: candidate.code,
        message: typeof candidate.message === 'string' ? candidate.message : '资源读取失败',
        retryable: typeof candidate.retryable === 'boolean' ? candidate.retryable : false,
      };
      return candidate.details === undefined ? result : { ...result, details: candidate.details };
    }
  }
  return { code: 'RESOURCE_INTERNAL', message: '资源读取失败', retryable: false };
}
