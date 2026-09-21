/**
 * `document:*` 能力的依赖注入端口。
 *
 * 权威：`11-文档服务设计` §二（总体架构：解析器句柄复用、受控写路径、事件发布职责）、
 * `04-资源管理设计` §5.2（作用域注册）、`03-核心接口规范` §六（chips-parser 公开面与 Neon 导出）。
 *
 * @remarks
 * - 文档服务本体（会话、修订、脏状态、写租约、结构校验、摘要复算、事件时序、错误归一）
 *   在 `@chips/host` 的 TS 侧实现；跨语言与跨子系统的能力全部收敛到以下端口，由组合根注入：
 *   解析/序列化/指纹端口由 chips-parser 侧（Neon 绑定 `openDocument` / `documentMetadata` /
 *   `documentStructure` / `documentContent` / `documentEntries` / `documentClose`）承载，
 *   受控写与目录列举由资源管理器受控提交路径承载，权限判定入口为 Bridge 会话权限快照，
 *   事件发布入口为内核事件总线。生产适配器的组合根装载段已交付（金链路刀4，
 *   `adapters/production-wiring.ts`：parser=chips-native、events=宿主事件总线、
 *   guard=Bridge 会话注册表判定面；scope/storage 载体为 W3 chips-resource，正式适配器
 *   缺位已登记工单 036，缺位时装载段诚实回退、`document:*` 不注册）。
 * - 服务不自行放行、不缓存授权（`11-文档服务设计` §9.1）：{@link IDocumentGuardPort} 只是
 *   Bridge 权限判定与会话注册表的调用入口，判定逻辑本体在 Bridge。
 */

import type {
  DocumentForm,
  DocumentKind,
  DocumentPart,
  DocumentValue,
  IDocumentCapabilityContext,
  IDocumentDiagnostic,
} from './contract.js';
import type { ISourceFingerprint } from './digest.js';
import type { DiagnosticsSink } from '../../shared/diagnostics.js';

/** 作用域归一结果：受管引用与本地可读位置。 */
export interface IResolvedDocumentSource {
  /** 规范受管引用（`chips-resource://`；输出与会话键均用它）。 */
  readonly managedUri: string;
  /** 解析器可读的本地绝对路径（目录态包根或归档文件）。 */
  readonly localPath: string;
  /** 源形态：目录态工作副本或归档态单文件。 */
  readonly form: DocumentForm;
}

/**
 * 资源作用域端口（生产适配器由资源管理器承载）。
 *
 * 失败以已登记 `RESOURCE_*` 码抛出（`RESOURCE_NOT_FOUND` / `RESOURCE_PERMISSION_DENIED` /
 * `RESOURCE_PATH_INVALID` 等），由能力层原样透传。
 */
export interface IDocumentScopePort {
  /**
   * 把输入 `source` 归一为受管引用与本地可读位置。
   *
   * 覆盖 `chips-resource://` 受管作用域、裸 `file://` / `http(s)://` / `webdav://` 按
   * `06-资源协议规范` §2.6 归一为受管作用域的路径；远端来源的物化（下载/缓存）由适配器完成。
   */
  normalizeSource(source: string, ctx: IDocumentCapabilityContext): Promise<IResolvedDocumentSource>;
  /** 文档记录建立后注册资源作用域（`04-资源管理设计` §5.2）；失败即打开失败，不产生半开会话。 */
  registerScope(input: {
    readonly documentId: string;
    readonly managedUri: string;
    readonly kind: DocumentKind;
  }): Promise<void>;
}

/** 解析器只读句柄（chips-parser `DocumentHandle` 的壳侧不透明投影）。 */
export interface IDocumentHandle {
  /** 品牌标记：仅解析端口构造，服务不解释内部结构。 */
  readonly documentHandleBrand: 'chips-parser';
}

/** 解析到 L0 的结果。 */
export interface IDocumentParseOutcome {
  readonly handle: IDocumentHandle;
  /** 稳定文档标识（`card_id` / `box_id`）。 */
  readonly documentId: string;
  readonly kind: DocumentKind;
  readonly title: string;
  readonly metadata: DocumentValue;
  readonly fingerprint: ISourceFingerprint;
  readonly diagnostics: readonly IDocumentDiagnostic[];
}

/** 惰性切片读取请求（L1/L2）。 */
export interface IDocumentPartRequest {
  readonly part: DocumentPart;
  readonly nodeId?: string;
  readonly range?: { readonly offset: number; readonly limit: number };
}

/** 惰性切片读取结果。 */
export interface IDocumentPartOutcome {
  readonly value: DocumentValue;
  readonly diagnostics: readonly IDocumentDiagnostic[];
}

/** 序列化请求：当前会话模型 + 本次变更集范围（保存与写事件摘要共用）。 */
export interface IDocumentSerializeRequest {
  readonly kind: DocumentKind;
  readonly form: DocumentForm;
  /** 目录态包根或归档文件路径（用于未修订成员的字节复用）。 */
  readonly localPath: string;
  readonly metadata: DocumentValue;
  /** 卡片结构或箱子结构（含条目）；箱子 `entries` 变更已并入该切片。 */
  readonly structure: DocumentValue;
  /** 卡片内容成员（nodeId → 值）；箱子为空数组。 */
  readonly contents: readonly { readonly nodeId: string; readonly value: DocumentValue }[];
  /** 箱子 `.box/content.yaml` 布局配置；卡片为 `null`。 */
  readonly layoutConfig: DocumentValue | null;
  /** 被修订的分片集合：只序列化变更成员与其依赖成员（`11-文档服务设计` §5.1）。 */
  readonly changedParts: readonly DocumentPart[];
  /** 卡片被删除的内容成员 nodeId（删除成员不写出，变更集含移除路径）。 */
  readonly removedNodeIds: readonly string[];
}

/** 序列化产出的包内成员（含依赖成员重算结果：`file_info`、`manifest` 由序列化侧复算）。 */
export interface IDocumentSerializedMember {
  readonly packagePath: string;
  readonly bytes: Uint8Array;
}

/**
 * 解析/序列化端口（生产适配器由 chips-parser 经 Neon 绑定承载；解析、版本门禁、
 * YAML 序列化与清单重算的算法权威在 `06-文档解析器设计`）。
 *
 * 失败以解析域已登记 `DOCUMENT_*` 码抛出（`DOCUMENT_NOT_FOUND` / `DOCUMENT_IO` /
 * `DOCUMENT_METADATA_INVALID` / `DOCUMENT_STRUCTURE_INVALID` / `DOCUMENT_VERSION_*` 等）。
 */
export interface IDocumentParserPort {
  /** 打开并解析到 L0（自动识别或严格 kind）；返回稳定标识、标题、metadata 与源指纹。 */
  open(input: {
    readonly localPath: string;
    readonly kind: DocumentKind | null;
    readonly signal: AbortSignal;
  }): Promise<IDocumentParseOutcome>;
  /** 惰性读取 L1/L2 切片（structure / content / entries）。 */
  readPart(handle: IDocumentHandle, request: IDocumentPartRequest, signal: AbortSignal): Promise<IDocumentPartOutcome>;
  /** 重新取源指纹（保存前复查基线的依据，`11-文档服务设计` §7.1）。 */
  fingerprint(localPath: string): Promise<ISourceFingerprint>;
  /** 序列化变更成员与依赖成员（清单/`file_info` 重算在序列化侧完成，§5.1、§5.5）。 */
  serialize(request: IDocumentSerializeRequest, signal: AbortSignal): Promise<readonly IDocumentSerializedMember[]>;
  /** 显式释放解析句柄（幂等；保存后重建句柄与打开失败回收共用）。 */
  release(handle: IDocumentHandle): Promise<void>;
}

/** 受控提交请求：变更集写入 + 成员移除；原子性与回滚由适配器保证（§5.2、§5.3）。 */
export interface IDocumentCommitRequest {
  readonly localPath: string;
  readonly form: DocumentForm;
  /** 待写入成员（路径升序）；未列出的成员保持不动。 */
  readonly members: readonly IDocumentSerializedMember[];
  /** 待移除的包内路径（卡片删除成员）。 */
  readonly removals: readonly string[];
  readonly signal: AbortSignal;
}

/** 包内成员字节（目录态摘要复算输入）。 */
export interface IPackageMemberBytes {
  readonly packagePath: string;
  readonly bytes: Uint8Array;
}

/**
 * 文件系统 / 受控写端口（生产适配器由资源管理器受控提交路径与 WriteCoordinator 承载：
 * 临时物 + fsync + 提交日志 + 原子替换 + 失败回滚，同一目标单写者）。
 */
export interface IDocumentStoragePort {
  /** 原子提交变更集；失败抛出携带登记码的异常（能力层映射为 `DOCUMENT_SAVE_FAILED`，§10.3）。 */
  commit(request: IDocumentCommitRequest): Promise<void>;
  /** 枚举目录态包根内全部成员（摘要复算输入；不含目录条目与平台保留临时物）。 */
  listMembers(localPath: string): Promise<readonly IPackageMemberBytes[]>;
  /** 读取归档态单文件字节（文件摘要复算输入）。 */
  readFileBytes(localPath: string): Promise<Uint8Array>;
}

/**
 * 事件发布端口（生产适配器为内核事件总线；信封构造与订阅投递在事件系统，
 * payload 口径以 `05-事件契约规范` §4.2 为准）。
 */
export interface IDocumentEventsPort {
  publish(eventId: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
}

/**
 * 权限与会话判定入口端口（Bridge 会话注册表与权限快照的调用面；
 * 判定逻辑本体在 Bridge，服务每调用查询、不缓存，`11-文档服务设计` §9.1）。
 */
export interface IDocumentGuardPort {
  /** Bridge 会话是否仍然活跃；不活跃时能力调用返回 `BRIDGE_SESSION_UNKNOWN`。 */
  isSessionActive(sessionId: string): Promise<boolean>;
  /** 会话权限快照是否覆盖指定基础权限 ID；`document:*` 无限定值目标（读源作用域除外）。 */
  hasPermission(sessionId: string, permission: string): Promise<boolean>;
}

/** 四能力共享的服务依赖。 */
export interface IDocumentServiceDependencies {
  readonly scope: IDocumentScopePort;
  readonly parser: IDocumentParserPort;
  readonly storage: IDocumentStoragePort;
  readonly events: IDocumentEventsPort;
  readonly guard: IDocumentGuardPort;
  /** 宿主诊断口（壳统一日志面）；端口与事件侧的不可恢复异常在此落日志（不进入跨 Bridge 错误返回）。 */
  readonly diagnostics?: DiagnosticsSink;
}

/**
 * 能力执行器签名（与 `@chips/bridge` `ICapability.execute` 同构）。
 *
 * @remarks `TInput` 一律为 `unknown`：运行时（壳侧路由 / Bridge 内核）交付的输入在类型上是未定型的，
 * 能力入口守卫负责类型恢复与业务校验（`04-能力契约规范` §5.2 规则 8），契约声明的输入形状
 * （`IDocumentOpenInput` 等）是守卫产出的结构视图，不是入参的类型保证。
 */
export type DocumentCapabilityExecutor<TInput, TOutput> = (
  input: TInput,
  ctx: IDocumentCapabilityContext,
) => Promise<TOutput>;
