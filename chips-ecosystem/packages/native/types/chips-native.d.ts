/**
 * chips-native（Neon 绑定）ABI 类型声明。
 *
 * 事实源：`abi/export-surface.json` 与《核心接口规范》§8.6 导出总表；
 * 本文件只声明 JS 侧可见形状，不承载实现。声明面与运行时导出面必须一致：
 * 未在本文件声明的函数不注册，未注册的函数不在本文件声明。
 *
 * 能力执行导出（`bridgeRegister` / `bridgeUnregister` / `bridgeRequest` /
 * `bridgeCancelSession`）、激活与会话扩展导出（`bridgeActivateProvider` /
 * `bridgeDeactivateProvider` / `bridgeGrantCapabilityId` / `bridgeOpenSession` /
 * `bridgeCloseSession` / `bridgeShutdown`，《核心接口规范》§5.5–§5.7）、文档解析
 * 域导出（`openDocument` / `openCard` / `openBox` / `document*` /
 * `buildDocumentView`，《核心接口规范》§6.4、§6.6，《06-文档解析器设计》§12）
 * 与元信息、Context、取消令牌导出共用本入口；导出表只增不改，
 * 签名变化递增 `coreAbiVersion`。
 *
 * 约束：
 * - 句柄（ContextHandle / CancelTokenHandle / DocumentHandle）不透明、无字段、
 *   不可序列化；
 * - 时间与 ID 用 number（ID 低于 2^53）；
 * - 二进制一律 `Uint8Array`（主进程 Buffer 为其子类），禁止 base64。
 */

declare const contextHandleBrand: unique symbol;
declare const cancelTokenHandleBrand: unique symbol;
declare const documentHandleBrand: unique symbol;

/** 不透明 Context 句柄；由内核插件管理层创建并经 `context*` 系列使用。 */
export interface ContextHandle {
  readonly [contextHandleBrand]: 'chips-native.context';
}

/** 不透明取消令牌句柄；`createCancelToken` 创建，`cancelTokenCancel` 触发。 */
export interface CancelTokenHandle {
  readonly [cancelTokenHandleBrand]: 'chips-native.cancel-token';
}

/**
 * 不透明文档解析句柄；`openDocument` / `openCard` / `openBox` 创建，
 * `document*` 系列与 `buildDocumentView` 消费，`documentClose` 显式释放
 * （《核心接口规范》§6.4；内部结构不暴露，未关闭时由 GC 终结器兜底）。
 */
export interface DocumentHandle {
  readonly [documentHandleBrand]: 'chips-native.document';
}

/** 能力执行上下文；与 `ICapabilityContext` 一致（《核心接口规范》§5.3）。 */
export interface INativeCapabilityContext {
  /** 取消信号；会话销毁、超时、能力注销或 Bridge 关闭时触发。 */
  readonly signal: AbortSignal;
  /** 调用截止时间（Unix epoch 毫秒）；内核准入时即确定。 */
  readonly deadline: number;
}

/** TS 能力注册形状；`handler` 在 JS 线程调用，返回值被等待。 */
export interface INativeCapabilityRegistration {
  descriptor: {
    id: string;
    schema: Record<string, unknown>;
    permissions: string[];
  };
  owner: string;
  timeoutMs: number;
  concurrency: 'parallel' | 'serial';
  maxQueue: number;
  handler: (input: unknown, ctx: INativeCapabilityContext) => Promise<unknown>;
}

/** 能力调用请求；`bin` 为 `x-chips-binary` 字段的字节表（键为 JSON Pointer）。 */
export interface INativeBridgeRequest {
  requestId: string;
  capabilityId: string;
  sessionId: number;
  input: unknown;
  bin?: Record<string, Uint8Array>;
}

/**
 * 提供方登记（《核心接口规范》§5.5 `ProviderRegistration` 的 JS 侧形状）；
 * `permissions` 为 manifest 声明的申请权限集合。
 */
export interface INativeProviderRegistration {
  /** 提供方标识（反向域名式插件 ID 或平台服务域 ID）。 */
  id: string;
  /** 提供方类别；与内核 `ProviderKind` 逐值对应。 */
  kind: 'platformService' | 'servicePlugin';
  /** manifest 声明的权限 ID 集合（安装时提交的申请集合）。 */
  permissions: string[];
}

/**
 * 会话登记快照（《核心接口规范》§5.6 `open_session` 入参的 JS 侧形状）；
 * 授权变更后重新登记即按新快照覆盖。
 */
export interface INativeSessionRegistration {
  /** 会话键（低于 2^53 的非负整数）。 */
  sessionId: number;
  /** 承载会话的插件 ID。 */
  pluginId: string;
  /** 会话授权权限快照。 */
  grantedPermissions: string[];
}

/** 文档格式判别（与 backing `DocumentKind` 序列化逐字一致）。 */
export type INativeDocumentKind = 'card' | 'box';

/** 解析诊断严重级（《06-文档解析器设计》§8.4）。 */
export type INativeDiagnosticSeverity = 'error' | 'warning' | 'info';

/** 解析诊断（《06-文档解析器设计》§12.3 `Diagnostic`；可选字段缺省时不出现）。 */
export interface INativeDiagnostic {
  severity: INativeDiagnosticSeverity;
  code: string;
  message: string;
  file?: string;
  pointer?: string;
  line?: number;
  column?: number;
  hint?: string;
}

/**
 * 解析限额（《06-文档解析器设计》§9.1 `ParseLimits` 的 JS 侧 camelCase 形状）；
 * 缺省字段回落 backing 默认值。
 */
export interface INativeParseLimits {
  maxUncompressedBytes?: number;
  maxYamlBytes?: number;
  maxEntryCount?: number;
  maxCompressionRatio?: number;
  maxAliases?: number;
  maxDepth?: number;
}

/**
 * 解析选项（《核心接口规范》§6.1 `ParseOptions` 的 JS 侧 camelCase 形状）；
 * 缺省回落 `ParseOptions::default`（strict=false、repair=true、
 * verifyHashes=false、parallelism=4）。
 */
export interface INativeParseOptions {
  strict?: boolean;
  repair?: boolean;
  verifyHashes?: boolean;
  parallelism?: number;
  limits?: INativeParseLimits;
}

/** `documentEntries` 分页窗口（项数语义，越界端点由解析器收敛）。 */
export interface IDocumentEntriesRange {
  offset: number;
  limit: number;
}

/** `documentReadResource` 字节窗口（绝对偏移；end 越出成员长度即失败）。 */
export interface IDocumentResourceRange {
  offset: number;
  length: number;
}

/** L0 元数据结果（《核心接口规范》§6.4 `{ kind, value, diagnostics }`）。 */
export interface IDocumentMetadataResult {
  kind: INativeDocumentKind;
  /** 格式对应投影（`CardMetadata` / `BoxMetadata` 字段，snake_case）。 */
  value: Record<string, unknown>;
  diagnostics: INativeDiagnostic[];
}

/** L1 结构结果（`value` 为卡片结构或箱子条目索引）。 */
export interface IDocumentStructureResult {
  kind: INativeDocumentKind;
  value: Record<string, unknown>;
  diagnostics: INativeDiagnostic[];
}

/** L2 内容节点结果（《06-文档解析器设计》§11.3 `ContentNode` 投影）。 */
export interface IDocumentContentResult {
  kind: INativeDocumentKind;
  value: {
    node_id: string;
    file: string;
    card_type: string;
    value: Record<string, unknown>;
    diagnostics: INativeDiagnostic[];
  };
  diagnostics: INativeDiagnostic[];
}

/** 箱子条目（《核心接口规范》§6.3 `Entry` 序列化形状，snake_case）。 */
export interface IDocumentEntry {
  entry_id: string;
  url: string;
  enabled: boolean;
  snapshot?: Record<string, unknown>;
  layout_hints?: Record<string, unknown>;
}

/** L2 条目分页结果（卡片句柄调用以契约错误拒绝）。 */
export interface IDocumentEntriesResult {
  kind: INativeDocumentKind;
  value: IDocumentEntry[];
  diagnostics: INativeDiagnostic[];
}

/**
 * L2 箱子布局配置结果（`.box/content.yaml` 根值，`DocumentValue` 的
 * JSON 兼容投影，映射键保持文档顺序）；卡片句柄调用以契约错误拒绝，
 * 布局单元缺失 / 校验失败按 §8.4 返回空映射占位并携带错误级诊断。
 */
export interface IDocumentLayoutConfigResult {
  kind: INativeDocumentKind;
  value: Record<string, unknown>;
  diagnostics: INativeDiagnostic[];
}

/**
 * 修订结果的源指纹成员（工单034 §五.1 冻结形状：`modifiedMillis` / `crc32`
 * 对应 Rust `Option` → `null`；目录态无 CRC32，恒为 `null`）。
 */
export interface IDocumentRevisionMember {
  /** 包内路径（`/` 分隔）。 */
  path: string;
  /** 解压后字节数。 */
  size: number;
  /** 修改时间（Unix epoch 毫秒）；无时间信息时为 `null`。 */
  modifiedMillis: number | null;
  /** 归档条目 CRC32；目录态为 `null`。 */
  crc32: number | null;
}

/**
 * 修订与源指纹结果（`documentRevision` 返回，`DocumentHandle::revision()` 的
 * DTO 直投，工单034 正式化导出）：成员按包内路径升序；构建为常数时间，
 * 不读取资源正文（《06-文档解析器设计》§5.4、《11-文档服务设计》§5.5）。
 * 宿主侧 `digest.ts` 的 `ISourceFingerprint` 以本形状为唯一取数口径。
 */
export interface IDocumentRevisionResult {
  source: {
    kind: 'directory' | 'archive';
    members: IDocumentRevisionMember[];
  };
  chipStandardsVersion: string;
  /** 索引摘要（SHA-256 十六进制小写）。 */
  indexDigest: string;
}

/** 严格校验报告（《06-文档解析器设计》§6.5 `ValidationReport` 投影）。 */
export interface IDocumentValidationReport {
  kind: INativeDocumentKind;
  chip_standards_version: string;
  status: 'valid' | 'validwithwarnings' | 'invalid';
  statistics: {
    member_count: number;
    yaml_bytes: number;
    resource_count: number;
    entry_count: number;
    uncompressed_bytes: number;
  };
  diagnostics: INativeDiagnostic[];
}

/* ------- 文档视图类型（《核心接口规范》§6.6 正式定义，逐字登记） ------- */

/** 文档视图联合（`buildDocumentView` 返回；只读快照，可结构化克隆）。 */
export type DocumentView = CardRenderView | BoxRenderView;

/** 标签视图（简单标签为字符串；结构化标签首项为键、其余为值）。 */
export type TagView = string | string[];

/** 封面视图（正式封面入口路径，不读取、不解析、不执行）。 */
export interface CoverView {
  entry: string;
  ratio: string;
}

/** 卡片内容节点视图。 */
export interface CardNodeView {
  node_id: string;
  card_type: string;
  content: Record<string, unknown>;
}

/** 卡片渲染视图。 */
export interface CardRenderView {
  kind: 'card';
  revision: number;
  card_id: string;
  name: string;
  chip_standards_version: string;
  cover_ratio: string;
  tags: TagView[];
  cover: CoverView;
  content_nodes: CardNodeView[];
}

/** 箱子条目视图（`url` 为唯一正式定位字段，保持文件原样）。 */
export interface EntryView {
  entry_id: string;
  url: string;
  enabled: boolean;
  snapshot?: Record<string, unknown>;
  layout_hints?: Record<string, unknown>;
}

/** 箱子渲染视图。 */
export interface BoxRenderView {
  kind: 'box';
  revision: number;
  box_id: string;
  name: string;
  chip_standards_version: string;
  active_layout_type: string;
  layout_config: Record<string, unknown>;
  cover: CoverView;
  entries: EntryView[];
}

/** 平台版本；与全部平台包同一版本号。 */
export function coreVersion(): string;

/** 原生绑定 ABI 版本；导出面不兼容变化时递增。 */
export function coreAbiVersion(): number;

/** 在当前 Context 注册服务；同名服务被替换并触发级联重建。 */
export function contextProvide(handle: ContextHandle, name: string, value: unknown): void;

/** 声明依赖并注入回调；依赖就绪时回调在 JS 线程调用，参数为 Context 句柄。 */
export function contextInject(
  handle: ContextHandle,
  dependencies: readonly string[],
  callback: (ctx: ContextHandle) => void
): number;

/** 按作用域链获取服务；未注册返回 undefined，非 JS 服务返回类型不匹配错误。 */
export function contextGet(handle: ContextHandle, name: string): unknown;

/** 订阅事件；`once` 为真时首次投递后自动退订；返回监听令牌。 */
export function contextOn(
  handle: ContextHandle,
  event: string,
  listener: (payload: unknown) => void,
  once: boolean
): number;

/** 退订；幂等。 */
export function contextUnsubscribe(handle: ContextHandle, token: number): void;

/** 同步广播事件；无监听器零分配。 */
export function contextEmit(handle: ContextHandle, event: string, payload: unknown): void;

/** 登记自定义清理逻辑；随当前 Fork 撤销。 */
export function contextEffect(handle: ContextHandle, cleanup: () => void): void;

/** 创建取消令牌。 */
export function createCancelToken(): CancelTokenHandle;

/** 触发取消；幂等；可从任意线程调用。 */
export function cancelTokenCancel(token: CancelTokenHandle): void;

/** 注册 TS 能力并持有其 handler；注册期校验失败抛出 `ChipsError` 同构错误。 */
export function bridgeRegister(registration: INativeCapabilityRegistration): void;

/** 注销能力；在途调用由内核按取消收口。 */
export function bridgeUnregister(capabilityId: string): void;

/**
 * 发起一次能力调用；输入按 `{ json, bin }` 信封解码，输出中 `x-chips-binary`
 * 位置以 `Uint8Array` 嵌回；失败以 `ChipsError` 同构 `Error` 拒绝。
 */
export function bridgeRequest(request: INativeBridgeRequest): Promise<unknown>;

/** 取消会话全部在途调用；幂等；会话保持可用。 */
export function bridgeCancelSession(sessionId: number): void;

/**
 * 登记并激活提供方（§5.5）；激活后其能力方可注册，`permissions` 为 manifest
 * 申请的权限集合。失败以 `ChipsError` 同构 `Error` 抛出（权限 ID 未注册 →
 * `PERMISSION_UNKNOWN`；内核已关闭 → `BRIDGE_CANCELLED`）；重复激活同 ID 覆盖。
 */
export function bridgeActivateProvider(registration: INativeProviderRegistration): void;

/** 停用提供方（§5.5）；注销其全部能力并在途调用按取消收口；幂等，无错误返回。 */
export function bridgeDeactivateProvider(owner: string): void;

/**
 * 登记第三方能力 ID 并绑定提供方（§5.5 / 契约 §9.1）；绑定不可转让、不可改绑。
 * 失败以 `ChipsError` 同构 `Error` 抛出（文法非法 / 内置保留 / 改绑 →
 * `BRIDGE_CAPABILITY_CONFLICT`；提供方未激活 → `KERNEL_INVALID_TRANSITION`）。
 */
export function bridgeGrantCapabilityId(capabilityId: string, owner: string): void;

/**
 * 登记会话快照（§5.6）；`request` 前的会话登记前置，授权变更重新登记即覆盖。
 * 失败以 `ChipsError` 同构 `Error` 抛出（内核已关闭 → `BRIDGE_CANCELLED`）。
 */
export function bridgeOpenSession(session: INativeSessionRegistration): void;

/** 关闭会话（§5.6）；拒绝新调用并取消该会话全部在途调用；幂等，无错误返回。 */
export function bridgeCloseSession(sessionId: number): void;

/**
 * 关闭进程级 Bridge 内核（§5.7）；取消全部在途调用并拒绝新请求；幂等。
 * 仅关闭内核状态，不停止 Neon 绑定自身的运行时。
 */
export function bridgeShutdown(): void;

/**
 * 打开文档并解析到 L0（自动识别 `.card` / `.box`，《核心接口规范》§6.2）；
 * 失败以 `ChipsError` 同构 `Error` 拒绝（契约码 `DOCUMENT_*` 原样透传）。
 */
export function openDocument(path: string, options?: INativeParseOptions): Promise<DocumentHandle>;

/** 严格 card 入口；形状与错误语义同 `openDocument`。 */
export function openCard(path: string, options?: INativeParseOptions): Promise<DocumentHandle>;

/** 严格 box 入口；形状与错误语义同 `openDocument`。 */
export function openBox(path: string, options?: INativeParseOptions): Promise<DocumentHandle>;

/** L0 元数据（打开时冻结，常数时间）+ 句柄诊断快照。 */
export function documentMetadata(handle: DocumentHandle): Promise<IDocumentMetadataResult>;

/** L1 结构与引用索引（首次访问触发解析）+ 诊断快照。 */
export function documentStructure(handle: DocumentHandle): Promise<IDocumentStructureResult>;

/** L2 单个内容节点；`nodeId` 为 10 位 Base62 字母数字编号。 */
export function documentContent(
  handle: DocumentHandle,
  nodeId: string
): Promise<IDocumentContentResult>;

/** L2 条目分页读取（箱子句柄）；卡片句柄以 `DOCUMENT_*` 契约码拒绝。 */
export function documentEntries(
  handle: DocumentHandle,
  range?: IDocumentEntriesRange
): Promise<IDocumentEntriesResult>;

/**
 * L2 箱子布局配置单元（`.box/content.yaml` 根值 + 诊断快照）；
 * 卡片句柄以 `DOCUMENT_*` 契约码拒绝（绑定层不做 kind 预判，判别归 backing）。
 */
export function documentLayoutConfig(handle: DocumentHandle): Promise<IDocumentLayoutConfigResult>;

/**
 * 修订与源指纹（工单034 正式化导出，《06-文档解析器设计》§12.1 访问器一一对应
 * 规则自 `DocumentHandle::revision()` 机械导出）：常数时间构建，不读取资源正文；
 * 形状见 {@link IDocumentRevisionResult}。
 */
export function documentRevision(handle: DocumentHandle): Promise<IDocumentRevisionResult>;

/** L3 资源字节（解析阶段永不读取资源正文）；产物为 `Uint8Array`（Buffer 子类）。 */
export function documentReadResource(
  handle: DocumentHandle,
  path: string,
  range?: IDocumentResourceRange
): Promise<Uint8Array>;

/** 严格校验报告；同一输入必产生字节级一致的报告（§6.5）。 */
export function documentValidate(handle: DocumentHandle): Promise<IDocumentValidationReport>;

/**
 * 文档视图构建器（§6.6）：句柄 + 渲染会话投影为可结构化克隆的只读快照；
 * 不读取资源字节、不拼接资源 URI。
 */
export function buildDocumentView(handle: DocumentHandle, session: number): Promise<DocumentView>;

/** 显式释放归档映射；幂等，未关闭时由 GC 终结器兜底。 */
export function documentClose(handle: DocumentHandle): Promise<void>;
