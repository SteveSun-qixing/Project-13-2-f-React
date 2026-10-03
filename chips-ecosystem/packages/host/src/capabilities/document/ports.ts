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
 *   guard=Bridge 会话注册表判定面，快照来源由组合根默认绑定运行时 `sessionPermissionSnapshots`
 *   （工单 036 §五.3-1 / 刀4 缝①）；scope/storage 载体为 chips-resource（Rust 侧能力面与
 *   §11.3 Neon 文档挂载 / 作用域注册载体已落位在册（波 A1 任务 #209 三补名），原子提交 /
 *   落盘序列化载体随点位四后续波；scope 正式适配器归波 A2b——未接线期装载段诚实回退、
 *   `document:*` 不注册，工单 036 收口）。
 * - 点位三（`managedUri ↔ localPath` 双向换算，波 B 任务 #231 原生落位）的**宿主消费臂**在
 *   波 B2（工单036 残余缺口）接线翻正：作用域端口扩员
 *   {@link IDocumentScopePort.localPathOf}（正向单源取回）与
 *   {@link IDocumentScopePort.scopeRootOf}（注册表作用域根查询），文档服务与记录面自此
 *   **不再自存 `localPath`、不再词法切片自算作用域根**（无双份事实源）。
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

/**
 * 作用域登记回执（INV-1：记录级原生数值会话的唯一来源）。
 *
 * @remarks `nativeSession` 必须是 `resourceOpenSession` 的真实返回句柄（backing `SessionId`，
 * u64 的 JS 安全整数子集形态）。历史上宿主记录面该字段取 `session-store.ts` 的 TS 单调计数器，
 * 该形态自波 A2b-β 起不存在（计数器已删）：拿非原生返回的 id 去原生侧会话表 `get()` 恒
 * `None`，归属闸对一切后续资源操作恒 `PERMISSION_DENIED`（`packages/native/src/resource.rs`
 * 归属判定臂，#213 附带发现），两拍注销与任何按会话归属的资源调用形同虚设。
 * 消费位（`adapters/view-channel.ts` → 原生 `buildDocumentView`）随本回执取真值。
 */
export interface IDocumentScopeRegistration {
  readonly nativeSession: number;
}

/**
 * 目标作用域保障回执（W5 T-ws：非打开文档的作用域注册臂交付形状）。
 *
 * @remarks `nativeSession` 与 {@link IDocumentScopeRegistration.nativeSession} 同权威——
 * `resourceOpenSession` 的真实返回句柄（INV-1），复用臂交付既有活绑定的同一句柄；
 * `localPath` 经点位三正向口向资源管理器现取（本端口 {@link IDocumentScopePort.localPathOf}
 * 同源，不取自 TS 账本缓存值）；`existedBefore` = 本臂调用前该受管引用的活绑定是否已在位
 * （已注册→复用 ⇒ `true`；未注册→新注册 ⇒ `false`）——export 的 overwrite 判定与
 * create 的落点判定据此区分「此前已注册的目标」与「本次新建注册的目标」，落点的磁盘
 * 存在性由归一前置（normalizeSource 存在性判据）保证，不因本臂放宽。
 */
export interface IDocumentTargetScopeAssurance {
  /** 活绑定的原生会话句柄（INV-1 真值；复用臂与首注册臂同源）。 */
  readonly nativeSession: number;
  /** 点位三正向取回的本地可读位置（目录态包根或归档态归档文件）。 */
  readonly localPath: string;
  /** 目标形态：目录态工作副本或归档态单文件。 */
  readonly form: DocumentForm;
  /** 本臂调用前该受管引用的活绑定是否已在位。 */
  readonly existedBefore: boolean;
}

/** 作用域归一结果：受管引用与本地可读位置。 */
export interface IResolvedDocumentSource {
  /** 规范受管引用（`chips-resource://`；输出与会话键均用它）。 */
  readonly managedUri: string;
  /**
   * 解析器可读的本地绝对路径（目录态包根或归档文件）。
   *
   * @remarks **只在打开链的挂载前段有效**（`parser.open` 的第一跳输入）：此刻记录尚无原生会话，
   * 点位三正向换算（会话绑定闸）不可达，故本字段是「归一时的路径」而非「长期路径事实源」。
   * 挂载建立后（记录存续期）一切磁盘触达改经
   * {@link IDocumentScopePort.localPathOf} 向资源管理器单源取回（工单036 波 B2 /
   * RFC §6 消费面「消除 TS 私有路径缓存」），服务与记录面均不再缓存本值。
   */
  readonly localPath: string;
  /** 源形态：目录态工作副本或归档态单文件。 */
  readonly form: DocumentForm;
}

/**
 * 资源作用域端口（生产适配器由资源管理器承载）。
 *
 * 失败以已登记 `RESOURCE_*` 码抛出（`RESOURCE_NOT_FOUND` / `RESOURCE_PERMISSION_DENIED` /
 * `RESOURCE_ALREADY_EXISTS` 等），由能力层原样透传。
 *
 * @remarks 失败码列举按裁决I-② 翻正：挂载链对宿主机路径参数**零产生**
 * `RESOURCE_PATH_INVALID`（该码按《06.02》§2.4 只覆盖虚拟路径域九词 reason；
 * canonicalize 失败/根缺失/根非目录/归档缺失的真实落码是 `RESOURCE_NOT_FOUND`，
 * `chips-resource/src/directory.rs:107-114`、`archive.rs:131-134` 实读在册）。
 */
export interface IDocumentScopePort {
  /**
   * 把输入 `source` 归一为受管引用与本地可读位置。
   *
   * 覆盖 `chips-resource://` 受管作用域、裸 `file://` / `http(s)://` / `webdav://` 按
   * `06-资源协议规范` §2.6 归一为受管作用域的路径；远端来源的物化（下载/缓存）由适配器完成。
   */
  normalizeSource(source: string, ctx: IDocumentCapabilityContext): Promise<IResolvedDocumentSource>;
  /**
   * 文档记录建立后注册资源作用域（`04-资源管理设计` §5.2）；失败即打开失败，不产生半开会话。
   *
   * @remarks 回执 {@link IDocumentScopeRegistration.nativeSession} 即本次挂载所用的原生会话句柄
   * （幂等复用臂返回既有活绑定的同一句柄），由服务原样落入文档记录——记录面数值会话的
   * **唯一来源**（INV-1，波 A2b-β 接线）。
   */
  registerScope(input: {
    readonly documentId: string;
    readonly managedUri: string;
    readonly kind: DocumentKind;
  }): Promise<IDocumentScopeRegistration>;
  /**
   * 文档记录驱逐/应用退出清理时注销常驻作用域（工单036 裁决I-① 两拍时序，`06-资源协议规范`
   * §3.2 注销时机表；`04.11` §11.3 挂载/注销会话闸注记）。
   *
   * @remarks
   * - **两拍次序（INV-2，形状即承载）**：本成员必须在记录原生会话**关闭之前**被调用——
   *   适配器内部执行 ① `resourceUnregisterScope(scope, nativeSession)` → ② `resourceCloseSession(nativeSession)`；
   *   目录域/归档域持久挂载不随 `close_session` 自动摘除（工单044 裁定⑧-1），次序倒置即自造
   *   JS 面不可恢复的孤儿常驻 scope（#213 §2.1(d) 死锁推演在册）。释放臂接线已在册（波 A2b-β）：
   *   `session-store.ts` `releaseSessionsOf` 经 `releaseScope` 依赖位在排空在途任务后、释放解析句柄前
   *   触达本成员，`service.ts` 打开失败回收臂 `rollbackFreshRecord` 同点接线。
   * - 返回判定式（§2.1(g) 第 6 阶段）：核心形 `RESOURCE_NOT_FOUND`（已被别处注销）视为已达、
   *   放行收口；`RESOURCE_PERMISSION_DENIED` **不得静默**——记审计并置「疑似孤儿」告警后如实抛出，
   *   禁止转而 close 掩盖（掩盖即不可恢复）；注销入口全仓唯一（INV-6，禁第二注销形）。
   */
  unregisterScope(input: { readonly documentId: string; readonly managedUri: string }): Promise<void>;
  /**
   * 非打开文档的目标作用域注册臂（W5 T-ws，工单036 残段收尾波）：为 export 目标/暂存物与
   * create 落点提供正式的账本注册生命周期——账本未注册→注册（幂等），已注册→复用。
   *
   * @remarks
   * - **归一前置不放宽**：`managedUri` 必须是 {@link normalizeSource} 的产物形
   *   （`chips-resource://<scope>/<basename>`）；未在册一律 `RESOURCE_INVALID_URI`
   *   （禁跳册直挂——本域唯一归一入口是 normalizeSource，落点存在性判据由其承载，
   *   本臂不自建归一通道、不触文件系统创建面）。
   * - **注册身份**：新注册的活绑定落 `DOCUMENT_TARGET_SCOPE_BINDING_ID` 哨兵（尚无文档
   *   记录可归属）；create 落地后文档记录以真实 `documentId` 调 {@link registerScope}
   *   即接管同一活绑定（哨兵位翻正，INV-1 同会话不分叉）。
   * - **不做保留区判定**：平台暂存物（`.chips-export-<随机>` 等）合法地落在保留前缀下
   *   （13.04 §4.2 规则 8、13.06 §6.3.3），本臂若判保留区即自锁导出链；用户落点的
   *   `WORKSPACE_RESERVED_PATH` 闸在能力服务层经 `isReservedPath` 执行（scope 域单源）。
   * - **种类一致性**：`kind` 与在册账种类不符即 `RESOURCE_ALREADY_EXISTS`（真冲突，
   *   禁抢占，INV-5）。
   */
  ensureTargetScope(managedUri: string, kind: DocumentKind): Promise<IDocumentTargetScopeAssurance>;
  /**
   * 目标作用域释放臂（W5 T-ws）：export 用完即释、create 失败回滚的正式出口；内部严格
   * 走 INV-2 两拍（① `resourceUnregisterScope` → ② `resourceCloseSession`）并经
   * {@link unregisterScope} 的同一注销通道（INV-6 注销入口唯一，禁第二注销形）。
   *
   * @remarks
   * - **哨兵归属闸**：仅 `DOCUMENT_TARGET_SCOPE_BINDING_ID` 哨兵绑定的作用域可经本臂释放；
   *   已被文档记录接管的活绑定（真实 `documentId` 在位）一律 `RESOURCE_PERMISSION_DENIED`
   *   如实拒绝——文档作用域的注销时机归文档记录生命周期（06-资源协议规范 §3.2 注销时机表），
   *   目标释放臂不得代释。
   * - 未在册 / 仅归一未挂载 = 释放已达（幂等静默收口，同 unregisterScope 的 NOT_FOUND
   *   已达口径）；挂载在途的注销失败如实上浮（第 6 阶段判定式，PERMISSION_DENIED 疑似
   *   孤儿告警不掩盖）。
   */
  releaseTargetScope(managedUri: string): Promise<void>;
  /**
   * 记录存续期的本地可读路径单源取回（点位三正向消费臂，`04.11` §11.3 行 19）。
   *
   * @remarks
   * - **形状即承载**：本成员是文档服务在挂载建立后取得磁盘路径的**唯一入口**——服务与记录面
   *   一律不自存 `localPath`（消除「TS 侧私有路径缓存 vs 核心 `ScopeRegistry` Origin」双份事实
   *   源；RFC §6.1 消费面「`recomputeDigestFromDisk` 由 record 持有 `localPath` 改为经端口取回」）。
   *   换算权威在核心：正式适配器以受管引用的**作用域基址形**
   *   （{@link IDocumentScopePort.scopeRootOf} 的投影，`chips-resource://<scope>/`）调
   *   `resourceLocalPathOf(uri, nativeSession)`，取回目录态包根 / 归档态归档文件路径
   *   （§11.3 行 19「归档 scope 恒返回归档文件路径，目录态作用域基址形返回包根」）。
   * - `nativeSession` 一律取文档记录级的原生会话句柄（INV-1 回执交付值），会话绑定闸
   *   （`out_of_scope`）即在此生效——服务不猜会话、不缓存路径。
   * - 失败以已登记 `RESOURCE_*` 码原样抛出并由能力层透传（端口头注口径）：作用域不在册
   *   `RESOURCE_NOT_FOUND`（陈旧绑定形）、会话未绑定 `RESOURCE_PERMISSION_DENIED`、
   *   Origin 无本地可读位置 `RESOURCE_NOT_SUPPORTED`；URI 非法 `RESOURCE_INVALID_URI`。
   */
  localPathOf(managedUri: string, nativeSession: number): Promise<string>;
  /**
   * 受管引用的资源作用域根（`chips-resource://<scope>/`）——**正式作用域注册表的单源查询**。
   *
   * @remarks
   * - 服务侧（卡片窗口装载投递的 `resourceBase` 口径）此前以字符串切片从受管引用自行截出
   *   authority 段，属注册表之外的第二套派生实现；本成员把该投影收敛到注册表：正式适配器
   *   以在册账里**挂载回执核验过的 `scope`**（`resourceMountDirectory` / `resourceMountArchive`
   *   返回值与派生值一致性闸，波 A2b-α）合形，不解释受管引用的其余词法。
   * - 未在册（未经本适配器归一的引用、已随注销销账的引用）返回 `null`——调用方据此如实
   *   拒收，不猜测基址（与原「词法不可投影」臂同一处置形，判据从词法升为登记事实）。
   * - 本成员是注册表内存查询，故同步；路径事实请走 {@link IDocumentScopePort.localPathOf}。
   */
  scopeRootOf(managedUri: string): string | null;
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
  /**
   * 目录态包根或归档文件路径（用于未修订成员的字节复用）。
   *
   * @remarks 点位三消费臂口径：由服务在每次序列化前经
   * {@link IDocumentScopePort.localPathOf} 向资源管理器取回（不是记录面缓存值）。
   */
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
 *
 * @remarks
 * - **形状冻结（跨层契约）**：三成员的 `localPath` 形参语义不变——本端口是「持本地路径面」的
 *   契约，正式适配器内部按 RFC §6.1 消费面口径以点位三**反向**换算（`resourceManagedUriOfPath`）
 *   把路径收敛为受管引用后再走受管面（波 C 载体）。
 * - **入参来源随动（工单036 波 B2）**：调用侧交付的 `localPath` 一律是
 *   {@link IDocumentScopePort.localPathOf}（点位三正向）当场取回的值，不再取自文档记录的长期
 *   缓存——路径事实源唯一在资源管理器；本端口形状与真接位随波 C 的正式适配器落地（生产装载段
 *   维持 fail-closed，`adapters/production-wiring.ts` 头注在册）。
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

/**
 * 会话→归属窗口解析口（工单043-A4 G2 归属臂）：把桥接会话标识解析为其归属窗口的
 * `webContents` id；无法归属（载体会话、词法外标识、已注销会话）返回 `null`。
 *
 * @remarks 窗口↔会话归属比对的**数据源**，判定本体在
 * `service.ts` `resolveViewSession`（工单043 §五 G2 修复形态）；实现注入位为服务依赖
 * {@link IDocumentServiceDependencies.sessionWindowOf}，生产由组合根装载段接壳侧会话
 * 标识词法唯一权威（`runtime/host-runtime.ts` `windowIdOfSessionId`，与注册表
 * `IHostSession.windowId` 同源），公共契约 `ISessionSource` / `IHostSession` 形状不动
 * （波 1 裁定：载体判别留壳内注册表）。
 */
export type DocumentSessionWindowResolver = (sessionId: string) => number | null;

/** 四能力共享的服务依赖。 */
export interface IDocumentServiceDependencies {
  readonly scope: IDocumentScopePort;
  readonly parser: IDocumentParserPort;
  readonly storage: IDocumentStoragePort;
  readonly events: IDocumentEventsPort;
  readonly guard: IDocumentGuardPort;
  /** 会话→归属窗口解析口（取视图通道归属比对消费；见 {@link DocumentSessionWindowResolver}）。 */
  readonly sessionWindowOf: DocumentSessionWindowResolver;
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
