//! `ResourceManager`：解析流水线与句柄生命周期的管理器侧门面
//! （《04-资源管理设计》§5.1、§11.1，《03-核心接口规范》§7.1）。
//!
//! 段一交付：URI 语法 → 作用域查找 → PathGuard → 会话与权限判定的完整
//! 流水线（[`ResourceManager::resolve`]），以及句柄 `open` / `stat` /
//! `read_range` / `read_chunk` / `release` 三态状态机、会话与作用域级联。
//! 句柄操作四臂（`stat` / `read_range` / `read_chunk` / `release`）携带
//! `SessionId` 归属参数并经句柄↔会话注册表比对（`entry.session ==
//! session`，跨会话以在册拒绝形 `RESOURCE_PERMISSION_DENIED` 收口，
//! 工单043 巡检分件 §一.1 N-1 判据，《04》§11.1）。
//! 段二 B1 追加：内置 MemoryProvider 挂载（[`ResourceManager::mount_memory`]）
//! 与写入提交/文件系统操作入口（《04》§11.1 `commit_write` / `delete` /
//! `rename` / `copy` / `create_directory` / `list_directory`），能力预检在
//! 管理器层按 `supports_write` 与作用域策略直接返回
//! `RESOURCE_READ_ONLY` / `RESOURCE_NOT_SUPPORTED`，不透传 Provider
//! （《04》§3.3）。段二 B2 追加：内置 DirectoryProvider 挂载
//! （[`ResourceManager::mount_directory`]，真实文件系统目录域，《04》§3.3）。
//! 段二 B3 追加：内置 ArchiveProvider 挂载（[`ResourceManager::mount_archive`]，
//! ZIP Store 归档只读域，ZIP 解析复用 `chips-parser` 归档层，《04.03》§3.3）、
//! 流式写入提交面（[`ResourceManager::open_write_stream`] /
//! [`ResourceManager::append_write_stream`] /
//! [`ResourceManager::commit_write_stream`]，《03.07》§7.1、《04.04》§4.8）
//! 与 `WriteCoordinator` 路径写锁（目录写族全部提交点单写者化，
//! 《04.13》§13-3）。段三后续（工单036 波 C2a-1）追加：目录域提交日志
//! （`journal` 模块 prepare–commit 两相，写流/一次性提交的在途意图落盘）
//! 与挂载时恢复扫描（`mount_directory` / `register_temp_scope` 汇聚 seam
//! 触发，崩溃中间态确定性收敛，处置账目经
//! [`ResourceManager::directory_recovery_report`] 可查）。缓存与单一飞行
//! 属段二后续/段三，本段不挂载。
//!
//! 错误口径：同步判定入口返回强类型 [`ResourceError`]；异步入口（会触达
//! Provider）以跨边界统一单形 `ChipsError` 收口，错误码保持《06》§7.2 在册
//! 值原样上抛——管理器不改写、不折算 Provider 的错误码。

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use chips_core::{
    emit_permission_decision, ChipsError, DecisionAction, DecisionDomain, DecisionObserver,
    HandleId, PermissionDecision, PluginId, SessionId,
};

use crate::archive::{ArchiveProvider, ARCHIVE_PROVIDER_ID};
use crate::cache::{CacheKey, CacheStore, CachedMetadata, SingleFlight};
use crate::constants::ResourceLimits;
use crate::directory::{DirectoryProvider, DirectoryStreamSink, DIRECTORY_PROVIDER_ID};
use crate::error::{InvalidateReason, ResourceError, ResourceResult, ScopeOperation};
use crate::handle::{HandleEntry, HandleTable, StreamSlot};
use crate::memory::MemoryProvider;
use crate::path_guard::{canonical_percent_encode, resolve_within_root, VirtualPath};
use crate::permission::{DecisionArm, PermissionChecker, ResourceOperation};
use crate::provider::{
    ByteRange, DirectoryEntry, ResourceAddress, ResourceMetadata, ResourceProvider,
};
use crate::scope::{Origin, ScopeId, ScopeKind, ScopePolicy, ScopeRegistration, ScopeRegistry};
use crate::session::{ResourceSession, SessionKind, SessionRegistry};
use crate::uri::{resolve_input, CanonicalUri, ExternalOrigin, MEMORY_SCOPE, RESOURCE_SCHEME};
use crate::write_coord::{PathWritePermit, WriteCoordinator};

/// 管理器异步面的结果别名：`ChipsError` 单形承载全部在册 `RESOURCE_*` 码。
pub type ManagerResult<T> = Result<T, ChipsError>;

/// 解析流水线的成功产物：规范 URI + 作用域注册项 + 会话 + 地址。
#[derive(Debug, Clone)]
pub struct ResolvedResource {
    /// 规范 URI。
    pub uri: CanonicalUri,
    /// 作用域注册项。
    pub registration: ScopeRegistration,
    /// 调用会话。
    pub session: ResourceSession,
    /// Provider 寻址地址。
    pub address: ResourceAddress,
}

/// 打开成功返回的句柄视图（《03》§7.1 `OpenHandle`）。
#[derive(Debug, Clone)]
pub struct OpenHandle {
    /// 句柄 ID。
    pub id: HandleId,
    /// 元数据快照。
    pub metadata: ResourceMetadata,
}

/// 打开请求（《03》§7.1 `OpenRequest`）。
#[derive(Debug, Clone)]
pub struct OpenRequest {
    /// 规范 URI 或裸 `http(s)://` 输入。
    pub uri: String,
    /// 资源会话。
    pub session: SessionId,
}

/// 一次性写入提交请求（《04》§11.1 `WriteRequest`；字节 ≤ `max_inline_bytes`，
/// 超限走 `commit_write_stream`——段二后续波次，本段入口对超限直接
/// `RESOURCE_TOO_LARGE` 收口，《04.04》§4.8）。
#[derive(Debug, Clone)]
pub struct WriteRequest {
    /// 发起会话。
    pub session: SessionId,
    /// 目标作用域 ID。
    pub scope: ScopeId,
    /// 目标虚拟路径（经 PathGuard 复检，《04.04》§4.8）。
    pub path: VirtualPath,
    /// 提交字节。
    pub bytes: Vec<u8>,
}

/// 文件系统操作请求（《04》§11.1 `FsOpRequest`；rename/copy 用
/// `source` + `target`，delete/create_directory/list 用 `source`）。
#[derive(Debug, Clone)]
pub struct FsOpRequest {
    /// 发起会话。
    pub session: SessionId,
    /// 源规范 URI。
    pub source: String,
    /// 目标规范 URI（rename/copy 必填）。
    pub target: Option<String>,
    /// 递归标志（在册形状字段；Provider 面本段不消费）。
    pub recursive: bool,
}

/// 流式写入提交请求（《04.11》§11.1 `WriteStreamRequest`：`scope` /
/// `path` / `session` / `expected_size`；字节 > `max_inline_bytes` 的大
/// 资源提交面，《04.04》§4.8）。
#[derive(Debug, Clone)]
pub struct WriteStreamRequest {
    /// 发起会话。
    pub session: SessionId,
    /// 目标作用域 ID。
    pub scope: ScopeId,
    /// 目标虚拟路径（经 PathGuard 复检，《04.04》§4.8）。
    pub path: VirtualPath,
    /// 预期终尺寸（可选；提交时不符即回滚，不产生半写文件）。
    pub expected_size: Option<u64>,
}

/// 流式写入句柄（《03.07》§7.1 `WriteStreamHandle`：文档未定形其字段面，
/// 取「登记表键 + 目标规范 URI」最小承载，findings 登记）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WriteStreamHandle {
    /// 登记表键（单调分配，不复用）。
    pub id: u64,
    /// 目标资源规范 URI（错误回执与审计定位用）。
    pub uri: String,
}

/// 流式写入落盘通道：目录域走隐藏临时文件（B2 原子形态的流式承载），
/// 其余可写 Provider 走内存缓冲后一次性 `Provider::write`（findings
/// 登记：文档未为 Provider 抽象定义流式契约）。
#[derive(Debug)]
enum StreamSink {
    Directory(DirectoryStreamSink),
    Buffer(Vec<u8>),
}

impl StreamSink {
    fn append(&mut self, bytes: &[u8]) -> ManagerResult<()> {
        match self {
            Self::Directory(sink) => sink.append(bytes),
            Self::Buffer(buffer) => {
                buffer.extend_from_slice(bytes);
                Ok(())
            }
        }
    }
}

/// 活动流式写入记录：路径写锁许可随流生命周期持有（《04.04》§4.9
/// 单写者；临时文件经 [`DirectoryStreamSink`] 的 `Drop` 通道零残留清理）。
#[derive(Debug)]
struct WriteStreamRecord {
    session: SessionId,
    address: ResourceAddress,
    provider_id: String,
    max_resource_bytes: u64,
    expected_size: Option<u64>,
    received: u64,
    _permit: Arc<PathWritePermit>,
    sink: StreamSink,
}

/// MemoryProvider 挂载记录：创建者会话 + 在册 Provider 句柄。
#[derive(Debug)]
struct MemoryMount {
    session: SessionId,
    provider: Arc<MemoryProvider>,
}

/// Provider 注册表。
#[derive(Default)]
pub struct ProviderRegistry {
    providers: Mutex<BTreeMap<String, Arc<dyn ResourceProvider>>>,
}

impl std::fmt::Debug for ProviderRegistry {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let ids: Vec<String> = self
            .providers
            .lock()
            .map(|providers| providers.keys().cloned().collect())
            .unwrap_or_default();
        formatter
            .debug_struct("ProviderRegistry")
            .field("ids", &ids)
            .finish()
    }
}

impl ProviderRegistry {
    /// 注册 Provider；重复 ID 返回 `RESOURCE_ALREADY_EXISTS`。
    pub fn register(&self, provider: Arc<dyn ResourceProvider>) -> ResourceResult<()> {
        let mut providers = self.providers.lock().expect("Provider 锁不得中毒");
        let id = provider.id().to_owned();
        if providers.contains_key(&id) {
            return Err(ResourceError::AlreadyExists { uri: id });
        }
        providers.insert(id, provider);
        Ok(())
    }

    /// 查找 Provider。
    #[must_use]
    pub fn lookup(&self, id: &str) -> Option<Arc<dyn ResourceProvider>> {
        self.providers
            .lock()
            .expect("Provider 锁不得中毒")
            .get(id)
            .cloned()
    }
}

/// 资源管理器（《04》§11.1 核心结构；段二 B3 起含 WriteCoordinator
/// 路径写锁与流式写入登记表；段三主体 #185 起挂载 B4 缓存面
/// [`CacheStore`] 与单一飞行 [`SingleFlight`]，字段名对齐《04》§11.1）。
pub struct ResourceManager {
    limits: ResourceLimits,
    scopes: Arc<ScopeRegistry>,
    sessions: Arc<SessionRegistry>,
    providers: Arc<ProviderRegistry>,
    cache: Arc<CacheStore>,
    handles: Arc<HandleTable>,
    inflight: Arc<SingleFlight<Vec<u8>>>,
    memory_provider: Arc<MemoryProvider>,
    memory_mount: Mutex<Option<MemoryMount>>,
    directory_provider: Arc<DirectoryProvider>,
    archive_provider: Arc<ArchiveProvider>,
    write_coordinator: WriteCoordinator,
    write_streams: Mutex<BTreeMap<u64, WriteStreamRecord>>,
    next_write_stream_id: AtomicU64,
    next_temp_scope_id: AtomicU64,
    /// 权限判定出站观察面：构造期注入、终身不可换（RFC §八条 1）；判定
    /// 素材在 `resolve` 的 `decide` 收敛处、各注册表锁外发射（RFC §六条 4）。
    observer: Arc<dyn DecisionObserver>,
}

impl std::fmt::Debug for ResourceManager {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("ResourceManager")
            .field("limits", &self.limits)
            .field("scopes", &self.scopes)
            .field("sessions", &self.sessions)
            .field("providers", &self.providers)
            .field("cache", &self.cache)
            .field("handles", &self.handles)
            .field("inflight", &self.inflight)
            .field("memory_provider", &self.memory_provider)
            .field("memory_mount", &self.memory_mount)
            .field("directory_provider", &self.directory_provider)
            .field("archive_provider", &self.archive_provider)
            .field("write_coordinator", &self.write_coordinator)
            .field("write_streams", &self.write_streams)
            .field("next_write_stream_id", &self.next_write_stream_id)
            .field("next_temp_scope_id", &self.next_temp_scope_id)
            .field("observer", &"DecisionObserver")
            .finish()
    }
}

impl ResourceManager {
    /// 以限额与权限判定观察面构造管理器。
    ///
    /// `observer` 为权限判定出站观察面（`chips_core::DecisionObserver`，
    /// RFC-权限审计跨层采集sink裁定 §5.1/§八）：构造期显式注入、终身不可
    /// 换；`Default` 实现随波收口移除，不留默认无观察形态。测试与接线波
    /// 落地前显式注入 `chips_core::NoopDecisionObserver`。
    #[must_use]
    pub fn new(limits: ResourceLimits, observer: Arc<dyn DecisionObserver>) -> Self {
        let handles = HandleTable::new(limits.max_handles_per_plugin, limits.max_handles_total);
        // #140 §四.2 合流（段三 #185）：内置 Provider 的拉取上限与缓存面
        // （L0/L1/L2 容量、TTL）一律来自本构造注入的 `ResourceLimits`，
        // 生产装配路径取值源唯一。
        let cache = Arc::new(CacheStore::new(&limits));
        let memory_provider = MemoryProvider::with_chunk_limit(limits.chunk_bytes);
        let directory_provider = DirectoryProvider::with_chunk_limit(limits.chunk_bytes);
        let archive_provider = ArchiveProvider::with_chunk_limit(limits.chunk_bytes);
        Self {
            limits,
            scopes: Arc::new(ScopeRegistry::new()),
            sessions: Arc::new(SessionRegistry::new()),
            providers: Arc::new(ProviderRegistry::default()),
            cache,
            handles: Arc::new(handles),
            inflight: Arc::new(SingleFlight::default()),
            memory_provider: Arc::new(memory_provider),
            memory_mount: Mutex::new(None),
            directory_provider: Arc::new(directory_provider),
            archive_provider: Arc::new(archive_provider),
            write_coordinator: WriteCoordinator::new(),
            write_streams: Mutex::new(BTreeMap::new()),
            next_write_stream_id: AtomicU64::new(1),
            next_temp_scope_id: AtomicU64::new(1),
            observer,
        }
    }

    /// 限额快照。
    #[must_use]
    pub fn limits(&self) -> &ResourceLimits {
        &self.limits
    }

    /// B4 缓存面在册句柄（诊断统计与宿主装配注入 L2 根目录用，《04》§6.2）。
    #[must_use]
    pub fn cache(&self) -> &Arc<CacheStore> {
        &self.cache
    }

    /// 由资源地址与版本戳构造缓存键（《04》§6.5：External 键含 origin、
    /// query 参与键、fragment 已在 URI 语法层拒绝）。键形构造经
    /// [`cache_key_for_uri`] 与 HttpProvider L0/L2 面共用，杜绝双侧漂移。
    fn cache_key_for(&self, address: &ResourceAddress, version: &str) -> CacheKey {
        cache_key_for_uri(&self.limits, address, version)
    }

    /// L0 回填（《04》§6.1/§6.4「流式只更新元数据」的写入通道）：
    /// External 条目记默认 TTL 新鲜期（响应头有效期由 HttpProvider 侧
    /// 覆盖裁决），受管条目走事件失效不设过期。
    fn l0_fill(&self, key: &CacheKey, metadata: &ResourceMetadata) {
        let expires_at = key
            .origin
            .is_some()
            .then(|| Instant::now() + self.cache.external_ttl());
        self.cache.metadata_insert(
            key,
            CachedMetadata {
                size: metadata.size,
                mime: metadata.mime_type.clone(),
                version: metadata.version.clone(),
                etag: None,
                last_modified: None,
                expires_at,
            },
        );
    }

    /// 在册句柄表（级联与测试断言入口）。
    #[must_use]
    pub fn handles(&self) -> &Arc<HandleTable> {
        &self.handles
    }

    /// 作用域注册表。
    #[must_use]
    pub fn scopes(&self) -> &Arc<ScopeRegistry> {
        &self.scopes
    }

    /// 会话注册表。
    #[must_use]
    pub fn sessions(&self) -> &Arc<SessionRegistry> {
        &self.sessions
    }

    /// Provider 注册表。
    #[must_use]
    pub fn providers(&self) -> &Arc<ProviderRegistry> {
        &self.providers
    }

    /// 注册资源来源提供者；启动期完成（《03》§7.1）。
    pub fn register_provider(&self, provider: Arc<dyn ResourceProvider>) -> ResourceResult<()> {
        self.providers.register(provider)
    }

    /// 注册作用域（《06》§3.2：注册时绑定所有者与来源；注册不等于授权）。
    ///
    /// 返回平台分配的 `ScopeId`；重复注册返回 `RESOURCE_ALREADY_EXISTS`。
    pub fn register_scope(&self, registration: ScopeRegistration) -> ResourceResult<ScopeId> {
        self.scopes.register(registration)
    }

    /// 把作用域绑定到会话（授权落地，《06》§4.2）。
    pub fn attach_scope(&self, session: SessionId, scope: &ScopeId) -> ResourceResult<()> {
        self.sessions.attach_scope(session, scope)
    }

    /// 注销作用域：级联失效并释放其全部句柄、终止流（《06》§3.2 注销级联）；
    /// 目录域作用域同步摘除 Provider 侧根目录挂载、归档域同步摘除归档挂载
    /// （段二 B2/B3，无泄漏收口）；该作用域活动流式写入一律中止并清理
    /// 临时文件（《04.04》§4.9 零残留）。
    pub fn unregister_scope(&self, scope: &ScopeId) -> ResourceResult<()> {
        self.scopes.unregister(scope)?;
        self.sessions.detach_scope(scope);
        self.directory_provider.detach_root(scope);
        self.archive_provider.detach_archive(scope);
        self.abort_write_streams(|record| &record.address.scope == scope);
        self.handles
            .invalidate_and_release_where(InvalidateReason::ScopeRevoked, |entry: &HandleEntry| {
                &entry.scope == scope
            });
        // 《04》§6.3 失效顺序：句柄处置后清理缓存条目（L0/L1/L2 随作用域
        // 失效，《04》§6.1）。
        self.cache.invalidate_scope(scope);
        Ok(())
    }

    /// 创建顶层资源会话。
    pub fn open_session(
        &self,
        kind: SessionKind,
        owner: &PluginId,
        scopes: impl IntoIterator<Item = ScopeId>,
        permissions: impl IntoIterator<Item = String>,
    ) -> ResourceResult<SessionId> {
        self.sessions.open_session(
            kind,
            owner,
            scopes.into_iter().collect(),
            permissions.into_iter().collect(),
        )
    }

    /// 派生子会话（只继承父会话作用域与权限子集，不允许扩权）。
    pub fn derive_session(
        &self,
        parent: SessionId,
        scopes: &[ScopeId],
        permissions: &BTreeSet<String>,
    ) -> ResourceResult<SessionId> {
        self.sessions.derive_session(parent, scopes, permissions)
    }

    /// 向活会话追加权限字符串集（工单053 点位五，RFC 裁定J §二.2 Rust
    /// 挂点）：`SessionRegistry::grant_permission` 的薄包装，入参形比照
    /// [`Self::open_session`] 的 `impl IntoIterator<Item = String>`；
    /// 语义三问（幂等静默 / 不撤销 / 字符串透传）在注册表单点承载，
    /// 判定入口（`resolve` 的 `PermissionChecker` 构造与 `granted` 注入）
    /// 零触碰。
    pub fn grant_session(
        &self,
        session: SessionId,
        permissions: impl IntoIterator<Item = String>,
    ) -> ResourceResult<()> {
        self.sessions.grant_permission(session, permissions)
    }

    /// 关闭会话并级联归还全部租约（句柄失效并释放，《04》§10.1）。
    /// 创建者会话关闭时，Memory 挂载整体失效：内存条目清空、作用域注销
    /// （禁止持久化与跨会话传递，《06.04》§4.3 行 9）。
    pub fn close_session(&self, session: SessionId) -> ResourceResult<()> {
        let closed = self.sessions.close_session(session)?;
        let closed_ids: BTreeSet<SessionId> = closed.iter().map(|record| record.id).collect();
        self.handles.invalidate_and_release_where(
            InvalidateReason::SessionClosed,
            |entry: &HandleEntry| closed_ids.contains(&entry.session),
        );
        // 中断的流式写入随会话关闭一律中止：临时文件由管理器清理，零残留
        // （《04.04》§4.9）。
        self.abort_write_streams(|record| closed_ids.contains(&record.session));
        self.evict_memory_mount(&closed_ids);
        Ok(())
    }

    /// 失效作用域全部句柄（`source-changed` 等；句柄保留至显式释放，
    /// 后续读返回 `RESOURCE_HANDLE_INVALIDATED`）。
    pub fn invalidate_scope(&self, scope: &ScopeId, reason: InvalidateReason) {
        self.handles
            .invalidate_where(reason, |entry: &HandleEntry| &entry.scope == scope);
        // 句柄转 invalidated 后清理缓存条目（《04》§6.3 失效顺序第 3 步；
        // 底层读取器关闭由句柄流槽位归还承担）。
        self.cache.invalidate_scope(scope);
    }

    /// 解析流水线（《04》§5.1）：语法解析 → 作用域查找 → 路径校验 →
    /// 会话与权限判定 → 地址构建。
    ///
    /// 段一把「路径校验」并入「语法解析」步（规范 URI 与虚拟路径同源经
    /// PathGuard 校验），故非法路径优先于未注册作用域报错（保守收口）。
    pub fn resolve(
        &self,
        input: &str,
        session: SessionId,
        operation: ResourceOperation,
    ) -> ResourceResult<ResolvedResource> {
        // 1. 语法解析与归一化 + 2. 路径校验（失败：INVALID_URI /
        //    UNSUPPORTED_SCHEME / PATH_INVALID）。
        let uri = resolve_input(input, &self.limits)?;
        // 3. 作用域查找（External 按 origin 惰性注册；失败：NOT_FOUND）。
        let session_record =
            self.sessions
                .get(session)
                .ok_or_else(|| ResourceError::PermissionDenied {
                    target: input.to_owned(),
                    permission: "session".to_owned(),
                    required: Vec::new(),
                    missing: Vec::new(),
                    granted: Vec::new(),
                    reason: crate::error::PermissionDenyReason::OutOfScope,
                })?;
        let registration = self.scopes.resolve_registration(
            &uri,
            &session_record.owner,
            external_provider_id(&uri),
            self.limits.max_resource_bytes,
        )?;
        // 直接请求作用域根：目录不可作为资源读取（《06》§2.4）。
        if uri.is_scope_root() {
            return Err(ResourceError::NotFound {
                uri: uri.to_canonical_string(),
            });
        }
        // 4. 会话与权限判定（失败：PERMISSION_DENIED）。判定矩阵的
        // `RESOURCE_READ_ONLY` 臂携带目标精确 uri（工单044 裁定 §三.5-⑧-2
        // 统一形，《06.07》§7.3）：
        let canonical_uri = uri.to_canonical_string();
        let (decision, arm) = PermissionChecker::new(
            &session_record.owner,
            &session_record,
            &registration,
            operation,
            &session_record.permissions,
            uri.external.as_ref(),
            canonical_uri.clone(),
        )
        .decide_with_arm();
        // 判定素材发射：decide 经 into_result 收敛处、各注册表锁外（decide
        // 为纯函数，RFC §六条 4/P2 clone-out 同族约束）。直通臂与
        // READ_ONLY 非权限臂不产素材，deny 臂（含 Policy 类）全发
        // （RFC §九 9.3-3）。
        if let Some(material) =
            resource_decision_material(&arm, &session_record.owner, session, &canonical_uri)
        {
            emit_permission_decision(&*self.observer, &material);
        }
        decision.into_result()?;
        // 5. Provider 选择与地址构建。
        let path = uri.path.clone().ok_or_else(|| ResourceError::NotFound {
            uri: canonical_uri.clone(),
        })?;
        let address = ResourceAddress {
            scope: registration.scope.clone(),
            path,
            uri: canonical_uri,
        };
        Ok(ResolvedResource {
            uri,
            registration,
            session: session_record,
            address,
        })
    }

    /// 解析、权限判定与打开（《03》§7.1 `open`）：通过后分配句柄并登记租约。
    ///
    /// 打开成功即以 Provider 回读的最新元数据回填 L0（《04》§6.1；External
    /// 条目按 TTL 记新鲜期，《04》§6.3 HttpProvider 行）。
    pub async fn open(&self, request: OpenRequest) -> ManagerResult<OpenHandle> {
        let resolved = self.resolve(&request.uri, request.session, ResourceOperation::Read)?;
        let provider = self
            .providers
            .lookup(&resolved.registration.provider_id)
            .ok_or(ResourceError::Internal)?;
        let metadata = provider.stat(&resolved.address).await?;
        check_size(
            &resolved.address.uri,
            resolved.registration.policy.max_resource_bytes,
            metadata.size,
        )?;
        let id = self.handles.insert(
            resolved.address.clone(),
            resolved.session.id,
            resolved.session.owner.clone(),
            resolved.registration.provider_id.clone(),
            resolved.registration.scope.clone(),
            resolved.registration.kind,
        )?;
        let view = metadata_view(&resolved.address.uri, resolved.registration.kind, metadata);
        let key = self.cache_key_for(&resolved.address, &view.version);
        self.l0_fill(&key, &view);
        Ok(OpenHandle { id, metadata: view })
    }

    /// 读元数据（《03》§7.1 `stat`）。
    ///
    /// 会话归属闸（N-1）：`session` 必须与句柄在册归属一致，跨会话以
    /// 在册拒绝形 `RESOURCE_PERMISSION_DENIED` 收口。
    ///
    /// External 作用域按 L0 新鲜期直返（TTL 未过期不打网络，《04》§6.3
    /// HttpProvider 行）；受管作用域读取前经 Provider 校验版本戳
    /// （§6.3 Directory/Archive 行）并回填 L0。
    pub async fn stat(
        &self,
        handle: HandleId,
        session: SessionId,
    ) -> ManagerResult<ResourceMetadata> {
        let (address, provider_id, kind) = self.handles.acquire_for_read(handle, session)?;
        if kind == ScopeKind::External {
            // External：L0 新鲜期内直返（TTL 惰性失效，《04》§6.3）。
            let probe_key = self.cache_key_for(&address, "");
            if let Some(entry) = self.cache.metadata_get(&probe_key) {
                let metadata = ResourceMetadata {
                    uri: address.uri.clone(),
                    size: entry.size,
                    mime_type: entry.mime,
                    version: entry.version,
                    scope: kind,
                };
                self.handles.touch(handle, 0);
                return Ok(metadata_view(&address.uri, kind, metadata));
            }
        }
        let provider = self
            .providers
            .lookup(&provider_id)
            .ok_or(ResourceError::Internal)?;
        let metadata = provider.stat(&address).await?;
        let view = metadata_view(&address.uri, kind, metadata);
        let key = self.cache_key_for(&address, &view.version);
        self.l0_fill(&key, &view);
        self.handles.touch(handle, 0);
        Ok(view)
    }

    /// 范围读（与流互斥，《03》§7.1 `read_range`，《06》§6.6）。
    ///
    /// 会话归属闸（N-1）：`session` 必须与句柄在册归属一致，跨会话以
    /// 在册拒绝形 `RESOURCE_PERMISSION_DENIED` 收口。
    ///
    /// B4 缓存联动（《04》§6.3/§6.4）：
    /// - 完整读（`offset = 0` 且 `length = None`）：读取前经 Provider `stat`
    ///   校验版本戳，命中 L1 即免后端字节拉取；未命中经 SingleFlight 合流
    ///   读取，成功结果写 L1（单条 ≤ `max_inline_bytes` 才入）并回填 L0；
    ///   提交时按读取前 epoch 再校验，失效竞态下过期结果丢弃。
    /// - 范围读（非完整读）：直通 Provider，绝不写入 L1（§6.4）。
    pub async fn read_range(
        &self,
        handle: HandleId,
        session: SessionId,
        range: ByteRange,
    ) -> ManagerResult<Vec<u8>> {
        let (address, provider_id) = self.handles.acquire_for_range_read(handle, session)?;
        if let Some(length) = range.length {
            check_size(&address.uri, self.limits.max_resource_bytes, length)?;
        }
        let provider = self
            .providers
            .lookup(&provider_id)
            .ok_or(ResourceError::Internal)?;
        let full_read = range.offset == 0 && range.length.is_none();
        if !full_read {
            // 范围读不写入 L1（《04》§6.4）：原样直通。
            let bytes = provider.read_range(&address, range).await?;
            self.handles.touch(handle, bytes.len() as u64);
            return Ok(bytes);
        }
        // 读取前校验版本戳（§6.3 Directory/Archive 行；External 走
        // HttpProvider 的 stat 语义，不产生网络体拉取）。
        let metadata = provider.stat(&address).await?;
        let key = self.cache_key_for(&address, &metadata.version);
        if let Some(bytes) = self.cache.memory_get_pinned(&key) {
            self.cache.memory_unpin(&key);
            self.l0_fill(&key, &metadata);
            self.handles.touch(handle, bytes.len() as u64);
            return Ok((*bytes).clone());
        }
        let read_epoch = self.cache.epoch();
        let flight_key = key.flight_key();
        let read_address = address.clone();
        let read_provider = Arc::clone(&provider);
        let flights = Arc::clone(&self.inflight);
        let bytes = flights
            .run_once(&flight_key, move || async move {
                read_provider
                    .read_range(
                        &read_address,
                        ByteRange {
                            offset: 0,
                            length: None,
                        },
                    )
                    .await
            })
            .await?;
        // 完整读取成功：只写完整读取结果（§6.4）；预算与钉住规则由
        // CacheStore 将守。
        self.cache.memory_insert(&key, bytes.clone(), read_epoch);
        self.l0_fill(&key, &metadata);
        self.handles.touch(handle, bytes.len() as u64);
        Ok(bytes)
    }

    /// 流式拉取（《03》§7.1 `read_chunk`）：首次调用打开游标；单次上限
    /// `chunk_bytes`；返回 `None` 表示结尾并释放流槽位。
    ///
    /// 会话归属闸（N-1）：`session` 必须与句柄在册归属一致，跨会话以
    /// 在册拒绝形 `RESOURCE_PERMISSION_DENIED` 收口且不占流槽位。
    pub async fn read_chunk(
        &self,
        handle: HandleId,
        session: SessionId,
        max_bytes: usize,
    ) -> ManagerResult<Option<Vec<u8>>> {
        let max_bytes = max_bytes.min(self.limits.chunk_bytes);
        let mut stream = match self.handles.begin_stream(handle, session)? {
            StreamSlot::Reuse { stream, .. } => stream,
            StreamSlot::FirstOpen {
                address,
                provider_id,
            } => {
                let provider = self
                    .providers
                    .lookup(&provider_id)
                    .ok_or(ResourceError::Internal)?;
                match provider.open_stream(&address).await {
                    Ok(stream) => stream,
                    Err(error) => {
                        // 打开失败：归还槽位，避免句柄永久 BUSY。
                        self.handles.store_stream(handle, None);
                        return Err(error);
                    }
                }
            }
        };
        let chunk = stream.next_chunk(max_bytes).await;
        match chunk {
            Ok(Some(bytes)) => {
                let consumed = bytes.len() as u64;
                self.handles.store_stream(handle, Some(stream));
                self.handles.touch(handle, consumed);
                Ok(Some(bytes))
            }
            Ok(None) => {
                self.handles.store_stream(handle, None);
                Ok(None)
            }
            Err(error) => {
                self.handles.store_stream(handle, Some(stream));
                Err(error)
            }
        }
    }

    /// 释放句柄与租约（《03》§7.1 `release`）：归属会话内幂等（重复释放
    /// 与陈旧 ID 均为 no-op 成功）；跨会话经归属闸以在册拒绝形
    /// `RESOURCE_PERMISSION_DENIED` 拒绝且句柄保持原状（N-1）。
    pub fn release(&self, handle: HandleId, session: SessionId) -> ResourceResult<()> {
        self.handles.release_for_session(handle, session)
    }

    /// 挂载内置 MemoryProvider 到创建者会话（《04》§3.3 / 《06.04》§4.3 行 9）。
    ///
    /// 幂等注册 `memory` Provider；注册保留作用域 `memory`（`Origin::Memory`，
    /// 可写策略）并绑定到会话。作用域唯一：已挂载时返回
    /// `RESOURCE_ALREADY_EXISTS`；禁止跨会话传递（其余会话未绑定即拒绝）。
    pub fn mount_memory(&self, session: SessionId) -> ResourceResult<ScopeId> {
        let record = self
            .sessions
            .get(session)
            .ok_or_else(|| ResourceError::PermissionDenied {
                target: format!("chips-resource://{MEMORY_SCOPE}/"),
                permission: "session".to_owned(),
                required: Vec::new(),
                missing: Vec::new(),
                granted: Vec::new(),
                reason: crate::error::PermissionDenyReason::OutOfScope,
            })?;
        if self.memory_mount.lock().expect("挂载锁不得中毒").is_some() {
            return Err(ResourceError::AlreadyExists {
                uri: MEMORY_SCOPE.to_owned(),
            });
        }
        if self.providers.lookup(MEMORY_SCOPE).is_none() {
            let typed = Arc::clone(&self.memory_provider);
            let provider: Arc<dyn ResourceProvider> = typed;
            self.register_provider(provider)?;
        }
        let scope = self.register_scope(ScopeRegistration {
            scope: MEMORY_SCOPE.to_owned(),
            kind: ScopeKind::Memory,
            owner: record.owner.clone(),
            provider_id: MEMORY_SCOPE.to_owned(),
            origin: Origin::Memory,
            policy: ScopePolicy {
                read_only: false,
                max_resource_bytes: self.limits.max_resource_bytes,
                allowed_hosts: Vec::new(),
            },
        })?;
        self.attach_scope(record.id, &scope)?;
        *self.memory_mount.lock().expect("挂载锁不得中毒") = Some(MemoryMount {
            session: record.id,
            provider: Arc::clone(&self.memory_provider),
        });
        Ok(scope)
    }

    /// 内存挂载在册状态（只读探测：是否已挂载）。
    #[must_use]
    pub fn memory_mounted(&self) -> bool {
        self.memory_mount.lock().expect("挂载锁不得中毒").is_some()
    }

    /// 挂载内置 DirectoryProvider 目录域作用域（段二 B2，《04》§3.3 /
    /// 《04.05》§5.3）。
    ///
    /// 幂等注册 `directory` Provider；把注册项的 `provider_id` 强制归一为
    /// `directory` 后注册作用域并绑定创建者会话。`origin` 必须是
    /// `Origin::Directory`，种类限 Workspace / Document / Plugin / Temporary
    /// （Platform 内嵌、External 代理、Memory 字节各有专责 Provider，
    /// `dialog:open` 临时授权域以 `policy.read_only = true` 走只读臂）。
    /// 重复挂载同一作用域返回 `RESOURCE_ALREADY_EXISTS`（《06》§7.2）；
    /// 根目录不存在或非目录返回 `RESOURCE_NOT_FOUND`（细节仅携作用域
    /// URI，《06》§7.1 不泄露真实路径）。任一登记步骤失败即回滚已完成的
    /// 挂载，不留半挂载态。目录域作用域不随 `close_session` 自动摘除
    /// （宿主显式 `unregister_scope` 注销，《06.03》§3.2 注销时机表），
    /// `unregister_scope` 时同步 detach 根目录。
    pub fn mount_directory(
        &self,
        session: SessionId,
        mut registration: ScopeRegistration,
    ) -> ResourceResult<ScopeId> {
        let record = self
            .sessions
            .get(session)
            .ok_or_else(|| ResourceError::PermissionDenied {
                target: format!("chips-resource://{}/", registration.scope),
                permission: "session".to_owned(),
                required: Vec::new(),
                missing: Vec::new(),
                granted: Vec::new(),
                reason: crate::error::PermissionDenyReason::OutOfScope,
            })?;
        let Origin::Directory(root) = registration.origin.clone() else {
            return Err(ResourceError::Internal);
        };
        if !matches!(
            registration.kind,
            ScopeKind::Workspace | ScopeKind::Document | ScopeKind::Plugin | ScopeKind::Temporary
        ) {
            return Err(ResourceError::Internal);
        }
        registration.provider_id = DIRECTORY_PROVIDER_ID.to_owned();
        if self.providers.lookup(DIRECTORY_PROVIDER_ID).is_none() {
            let typed = Arc::clone(&self.directory_provider);
            let provider: Arc<dyn ResourceProvider> = typed;
            self.register_provider(provider)?;
        }
        let scope_id = registration.scope.clone();
        self.directory_provider
            .attach_root(&scope_id, &root, registration.kind)?;
        let scope = match self.register_scope(registration) {
            Ok(scope) => scope,
            Err(error) => {
                self.directory_provider.detach_root(&scope_id);
                return Err(error);
            }
        };
        if let Err(error) = self.attach_scope(record.id, &scope) {
            self.directory_provider.detach_root(&scope_id);
            let _ = self.scopes.unregister(&scope);
            return Err(error);
        }
        Ok(scope)
    }

    /// 目录域在册状态探测（指定作用域是否已挂载真实根目录）。
    #[must_use]
    pub fn directory_mounted(&self, scope: &ScopeId) -> bool {
        self.directory_provider.is_mounted(scope)
    }

    /// 目录域挂载恢复扫描报告（工单036 波 C2a-1）：该作用域最近一次进入
    /// 引擎（挂载/临时注册）时对崩溃残留提交日志与临时物的处置账目
    /// （`journal::JournalRecoveryReport`，处置三态见 `journal` 模块头）；
    /// 未挂载或非目录域为 `None`。扫描随挂载同步执行、失败不改变挂载
    /// 成败，逐项如实计数（宿主侧接线可据此观测恢复质量）。
    #[must_use]
    pub fn directory_recovery_report(
        &self,
        scope: &ScopeId,
    ) -> Option<crate::journal::JournalRecoveryReport> {
        self.directory_provider.recovery_report(scope)
    }

    /// 挂载内置 ArchiveProvider 归档域作用域（段二 B3，《04.03》§3.3
    /// ArchiveProvider 行）。
    ///
    /// 幂等注册 `archive` Provider；把注册项的 `provider_id` 强制归一为
    /// `archive`、`policy.read_only` 强制翻真（归档永不就地改写，
    /// 《04.04》§4.8）后注册作用域并绑定会话。`origin` 必须是
    /// `Origin::Archive`，种类限 Document / Plugin（`.card` / `.box` /
    /// `.cpk` 归档载体；其余种类各有专责 Provider，越界属装配错误 →
    /// `RESOURCE_INTERNAL`，零自造码）。归档缺失 → `RESOURCE_NOT_FOUND`；
    /// 非归档 / 结构损坏 / 含非普通文件条目（解析器索引期拒绝，《04.03》
    /// §3.3 尾部）→ `RESOURCE_INTERNAL` 兜底；重复挂载 →
    /// `RESOURCE_ALREADY_EXISTS`；任一步失败回滚，不留半挂载态。
    /// 归档域作用域与目录域同款**不**随 `close_session` 自动摘除（宿主
    /// 显式 `unregister_scope` 注销，《06.03》§3.2 注销时机表），
    /// `unregister_scope` 时同步摘除归档挂载。
    pub fn mount_archive(
        &self,
        session: SessionId,
        mut registration: ScopeRegistration,
    ) -> ResourceResult<ScopeId> {
        let record = self
            .sessions
            .get(session)
            .ok_or_else(|| ResourceError::PermissionDenied {
                target: format!("chips-resource://{}/", registration.scope),
                permission: "session".to_owned(),
                required: Vec::new(),
                missing: Vec::new(),
                granted: Vec::new(),
                reason: crate::error::PermissionDenyReason::OutOfScope,
            })?;
        let Origin::Archive(archive_path) = registration.origin.clone() else {
            return Err(ResourceError::Internal);
        };
        if !matches!(registration.kind, ScopeKind::Document | ScopeKind::Plugin) {
            return Err(ResourceError::Internal);
        }
        registration.provider_id = ARCHIVE_PROVIDER_ID.to_owned();
        registration.policy.read_only = true;
        if self.providers.lookup(ARCHIVE_PROVIDER_ID).is_none() {
            let typed = Arc::clone(&self.archive_provider);
            let provider: Arc<dyn ResourceProvider> = typed;
            self.register_provider(provider)?;
        }
        let scope_id = registration.scope.clone();
        self.archive_provider
            .attach_archive(&scope_id, &archive_path, registration.kind)?;
        let scope = match self.register_scope(registration) {
            Ok(scope) => scope,
            Err(error) => {
                self.archive_provider.detach_archive(&scope_id);
                return Err(error);
            }
        };
        if let Err(error) = self.attach_scope(record.id, &scope) {
            self.archive_provider.detach_archive(&scope_id);
            let _ = self.scopes.unregister(&scope);
            return Err(error);
        }
        Ok(scope)
    }

    /// 归档域在册状态探测（指定作用域是否已挂载归档文件）。
    #[must_use]
    pub fn archive_mounted(&self, scope: &ScopeId) -> bool {
        self.archive_provider.is_mounted(scope)
    }

    /// 注册临时作用域（《04》§11.1 `register_temp_scope`，段三主体 #185
    /// 随 `resourceRegisterTempScope` 产化）：对话框授权完成后由平台把
    /// 用户临时授权宿主路径挂载进资源引擎。
    ///
    /// 口径：根必须存在且为目录（登记失败不降级，《06》§3.2；缺失按
    /// `RESOURCE_NOT_FOUND`，与 `mount_directory` 挂根同型——失败即整体
    /// 回滚注销，不留半挂载）；种类固定 Temporary、命名 `temp-{n}` 单调
    /// 递增（受管作用域在册前缀，《06》§2.2）；Provider 强制归一
    /// `directory`；owner 为平台哨兵 [`TEMP_SCOPE_OWNER`]（§11.1 签名
    /// 无 owner 参数，取平台所有并 README 在册）；`writable = false`
    /// 折算只读策略。会话绑定由调用方经 [`Self::attach_scope`] 完成
    /// （注册不等于授权，《06》§3.2）。
    pub fn register_temp_scope(&self, path: PathBuf, writable: bool) -> ResourceResult<ScopeId> {
        let index = self.next_temp_scope_id.fetch_add(1, Ordering::Relaxed);
        let scope = format!("temp-{index}");
        if self.providers.lookup(DIRECTORY_PROVIDER_ID).is_none() {
            let typed = Arc::clone(&self.directory_provider);
            let provider: Arc<dyn ResourceProvider> = typed;
            self.register_provider(provider)?;
        }
        self.register_scope(ScopeRegistration {
            scope: scope.clone(),
            kind: ScopeKind::Temporary,
            owner: TEMP_SCOPE_OWNER.to_owned(),
            provider_id: DIRECTORY_PROVIDER_ID.to_owned(),
            origin: Origin::Directory(path.clone()),
            policy: ScopePolicy {
                read_only: !writable,
                max_resource_bytes: self.limits.max_resource_bytes,
                allowed_hosts: Vec::new(),
            },
        })?;
        if let Err(error) = self
            .directory_provider
            .attach_root(&scope, &path, ScopeKind::Temporary)
        {
            // 挂根失败整体回滚：不留半挂载（零泄漏收口同段二 B2 口径）。
            let _ = self.unregister_scope(&scope);
            return Err(error);
        }
        Ok(scope)
    }

    /// 点位三正向换算（W3 波 B，RFC §六 C2 裁定）：受管引用 → 本地可读路径。
    ///
    /// 判序与绑定面挂载/注销臂同构：URI 解析单源复用 [`resolve_input`]
    /// （非法语法 `RESOURCE_INVALID_URI`、非受管 scheme `RESOURCE_UNSUPPORTED_SCHEME`；
    /// 裸 `http(s)` 与 `webdav://` 归一出的 External 形态**在本导出同样按
    /// 非受管 scheme 拒绝**——受管引用唯一输入形为 `chips-resource://` 规范形，
    /// RFC §6.1 错误码口径零新码）→ 会话活体/绑定闸（缺失即
    /// `RESOURCE_PERMISSION_DENIED`、`reason = out_of_scope`、`target` 仅携作用域
    /// 根 URI 不回显真实路径，与 `mount_directory` 会话闸同形）→ 作用域查找
    /// （已绑定但不在册 → `RESOURCE_NOT_FOUND`，陈旧绑定形态）。Origin 臂：
    /// 目录态成员路径以 [`resolve_within_root`] 单源拼接（符号链接根内复检、
    /// PathGuard 在册校验，零第二套归一）；作用域基址形返回 Origin 根
    /// （目录态包根）；归档态恒返回归档文件路径（包内成员无独立本地可读形，
    /// 经 §6.2 既有读组合承载）；Platform / Memory / Http Origin 无本地可读
    /// 位置 → `RESOURCE_NOT_SUPPORTED`（操作词表六词封闭《06》§7.3，换算臂
    /// 就近归入 `list`——directory.rs `set_metadata` 臂「词表无新词、就近归入」
    /// 同判例族，该归入口径候主裁复核，波 B 报告在册交回）。产物 UTF-8 收口：
    /// Origin 经非绑定面登记且携非 UTF-8 字节属装配错误，fail-closed 回
    /// `RESOURCE_INTERNAL`（在册码，零新码）。
    pub fn local_path_of(&self, input: &str, session: SessionId) -> ResourceResult<String> {
        let canonical = resolve_input(input, &self.limits)?;
        if canonical.external.is_some() {
            // `resolve_input` 对裸 http(s) 的归一产物在读取链合法，但受管引用
            // 换算面只认 `chips-resource://` 规范形（scheme 非受管拒绝口径）。
            return Err(ResourceError::UnsupportedScheme {
                uri: input.to_owned(),
            });
        }
        self.require_session_bound_scope(session, &canonical.scope)?;
        let registration =
            self.scopes
                .lookup(&canonical.scope)
                .ok_or_else(|| ResourceError::NotFound {
                    uri: canonical.to_canonical_string(),
                })?;
        let path = match &registration.origin {
            Origin::Directory(root) => match &canonical.path {
                Some(virtual_path) => resolve_within_root(root, virtual_path)?,
                None => root.clone(),
            },
            Origin::Archive(file) => file.clone(),
            _ => {
                return Err(ResourceError::NotSupported {
                    uri: canonical.to_canonical_string(),
                    scope: registration.kind,
                    // 六词封闭表就近归入臂（见方法头注），非新词。
                    operation: ScopeOperation::List,
                });
            }
        };
        path.into_os_string()
            .into_string()
            .map_err(|_| ResourceError::Internal)
    }

    /// 点位三反向换算（W3 波 B，RFC §六 C2 裁定）：本地绝对路径 → 规范受管
    /// 引用（绑定会话作用域集内 Origin 最长前缀匹配，含 `temp-*`）。
    ///
    /// 未命中一律返回 `None`（不区分「路径不存在」「会话不在册」「未绑定」「他
    /// 会话作用域覆盖」——零信息泄露口径即体现在返回类型里，RFC §6.1 安全裁定；
    /// 装载闸 `registerScope` 失败即打开失败，误配不存在）。路径规范化复用核心
    /// 既有唯一权威 [`std::fs::canonicalize`]（与 `attach_root` 入表前规范化同一
    /// 权威，绑定层零二次实现）；匹配只在给定会话绑定集内查注册项
    /// （[`ScopeRegistry::snapshot_scopes`] 只读遍历小增量）；目录 Origin 取
    /// `starts_with` 组件前缀、归档 Origin 取等值命中，深度以规范化根的组件数
    /// 计，最长前缀胜出；「同根双登记」等深平局按 `scope` 升序取先（快照稳定
    /// 序承载，口径候主裁复核、波 B 报告在册交回）。命中根之下的相对段以
    /// [`canonical_percent_encode`] 逐段编码后经 [`VirtualPath::validate`] 单源
    /// 校验构造（NFC / 段规则与 URI 解析面同源），产物经 [`CanonicalUri`]
    /// `to_canonical_string` 输出规范形——与正向解析共享同一语法权威，互逆由
    /// 锁测钉死。段文本非 UTF-8 或超 PathGuard 预算属不可表示形态，按未命中
    /// 收口（`None`，不伪造引用）。
    #[must_use]
    pub fn managed_uri_of_path(&self, path: &Path, session: SessionId) -> Option<String> {
        let record = self.sessions.get(session)?;
        if record.scopes.is_empty() {
            return None;
        }
        let candidate = std::fs::canonicalize(path).ok()?;
        let mut best: Option<(usize, ScopeRegistration)> = None;
        for registration in self.scopes.snapshot_scopes(&record.scopes) {
            let root = match &registration.origin {
                Origin::Directory(root) | Origin::Archive(root) => root,
                _ => continue,
            };
            let Ok(canonical_root) = std::fs::canonicalize(root) else {
                continue;
            };
            let matched = match &registration.origin {
                Origin::Directory(_) => candidate.starts_with(&canonical_root),
                Origin::Archive(_) => candidate == canonical_root,
                _ => false,
            };
            if !matched {
                continue;
            }
            let depth = canonical_root.components().count();
            match best {
                // 严格更长前缀才替换：等深平局保留快照升序下的先到者（确定性裁决）。
                Some((previous, _)) if previous >= depth => {}
                _ => best = Some((depth, registration)),
            }
        }
        let (depth, registration) = best?;
        let (Origin::Directory(root) | Origin::Archive(root)) = &registration.origin else {
            return None;
        };
        let canonical_root = std::fs::canonicalize(root).ok()?;
        if canonical_root.components().count() != depth {
            return None;
        }
        let scope_uri = format!("{RESOURCE_SCHEME}://{}/", registration.scope);
        match &registration.origin {
            // 归档态：命中即归档文件本体，回作用域基址形（成员无独立本地可读形）。
            Origin::Archive(_) => Some(scope_uri),
            Origin::Directory(_) => {
                let relative = candidate.strip_prefix(&canonical_root).ok()?;
                if relative.as_os_str().is_empty() {
                    return Some(scope_uri);
                }
                let mut segments = Vec::new();
                for component in relative.components() {
                    let Component::Normal(segment) = component else {
                        return None;
                    };
                    segments.push(canonical_percent_encode(segment.to_str()?));
                }
                let path =
                    VirtualPath::validate(&segments.join("/"), &scope_uri, &self.limits).ok()?;
                Some(
                    CanonicalUri {
                        scope: registration.scope.clone(),
                        path: Some(path),
                        external: None,
                        query: None,
                    }
                    .to_canonical_string(),
                )
            }
            _ => None,
        }
    }

    /// 会话活体/绑定闸（正向换算臂）：与 `mount_directory` / `mount_archive`
    /// 会话存在性臂及绑定层 `require_session_bound` 同一拒绝形——
    /// `RESOURCE_PERMISSION_DENIED`、`details.permission = "session"`、
    /// `reason = out_of_scope`、`target` 仅携作用域根 URI。
    fn require_session_bound_scope(
        &self,
        session: SessionId,
        scope: &ScopeId,
    ) -> ResourceResult<()> {
        match self.sessions.get(session) {
            None => Err(ResourceError::PermissionDenied {
                target: format!("{RESOURCE_SCHEME}://{scope}/"),
                permission: "session".to_owned(),
                required: Vec::new(),
                missing: Vec::new(),
                granted: Vec::new(),
                reason: crate::error::PermissionDenyReason::OutOfScope,
            }),
            Some(record) if record.scopes.contains(scope) => Ok(()),
            Some(record) => Err(ResourceError::PermissionDenied {
                target: format!("{RESOURCE_SCHEME}://{scope}/"),
                permission: "session".to_owned(),
                required: Vec::new(),
                missing: vec![scope.clone()],
                granted: record.scopes.iter().cloned().collect(),
                reason: crate::error::PermissionDenyReason::OutOfScope,
            }),
        }
    }

    /// 一次性写入提交（《04》§11.1 `commit_write`，《04.04》§4.8）：
    /// 句柄只读，写入统一由管理器提交。流水线复检（PathGuard + 会话权限
    /// `resources:write`）→ 能力预检（只读策略 / `supports_write` 不支持 →
    /// `RESOURCE_READ_ONLY`）→ 单次字节上限（> `max_inline_bytes` →
    /// `RESOURCE_TOO_LARGE`）→ Provider 落写并返回新版本元数据。
    pub async fn commit_write(&self, request: WriteRequest) -> ManagerResult<ResourceMetadata> {
        let uri = format!(
            "chips-resource://{}/{}",
            request.scope,
            request.path.as_str()
        );
        let size = u64::try_from(request.bytes.len()).unwrap_or(u64::MAX);
        if size > self.limits.max_inline_bytes {
            return Err(ResourceError::TooLarge {
                uri: uri.clone(),
                size,
                limit: self.limits.max_inline_bytes,
            }
            .to_chips_error());
        }
        let resolved = self.resolve(&uri, request.session, ResourceOperation::Write)?;
        check_size(
            &resolved.address.uri,
            resolved.registration.policy.max_resource_bytes,
            size,
        )?;
        let provider = self.writable_provider(&resolved)?;
        // WriteCoordinator 单写者路径锁（《04.04》§4.9、《04.13》§13-3）：
        // 同名路径提交互斥排队，锁覆盖 Provider 提交全程；异步入口走异步臂
        // （#151 残账段三收口：同步 Condvar 等待不占执行器线程）。
        let _write_permit = self
            .write_coordinator
            .lock_async([path_lock_key(&resolved)])
            .await;
        let metadata = provider.write(&resolved.address, &request.bytes).await?;
        // 写提交事件失效 + 新版本回填 L0（《04》§6.3 表）。
        self.cache
            .invalidate_resource(&resolved.address.scope, resolved.address.path.as_str());
        let view = metadata_view(&resolved.address.uri, resolved.registration.kind, metadata);
        let key = self.cache_key_for(&resolved.address, &view.version);
        self.l0_fill(&key, &view);
        Ok(view)
    }

    /// 删除（《04》§11.1 `delete`，《04.04》§4.9）：写入族鉴权与能力预检后，
    /// 仅 Plugin / Temporary / Memory 种类在册接受删除；其余返回
    /// `RESOURCE_NOT_SUPPORTED`（`operation = delete`），不透传 Provider。
    pub async fn delete(&self, request: FsOpRequest) -> ManagerResult<()> {
        let resolved = self.resolve(&request.source, request.session, ResourceOperation::Write)?;
        let provider = self.writable_provider(&resolved)?;
        self.check_write_kind_gate(&resolved, ScopeOperation::Delete)?;
        let _write_permit = self
            .write_coordinator
            .lock_async([path_lock_key(&resolved)])
            .await;
        provider.delete(&resolved.address).await?;
        // 删除事件失效（《04》§6.3：随写入族事件清缓存）。
        self.cache
            .invalidate_resource(&resolved.address.scope, resolved.address.path.as_str());
        Ok(())
    }

    /// 重命名/移动（《04》§11.1 `rename`，《04.04》§4.9）：同作用域 only，
    /// 跨作用域返回 `RESOURCE_NOT_SUPPORTED`（`operation = rename`）；
    /// 目标已存在不覆盖（`RESOURCE_ALREADY_EXISTS`，Provider 面收口）。
    pub async fn rename(&self, request: FsOpRequest) -> ManagerResult<ResourceMetadata> {
        let target_uri = self.require_target(&request)?;
        let source = self.resolve(&request.source, request.session, ResourceOperation::Write)?;
        let target = self.resolve(&target_uri, request.session, ResourceOperation::Write)?;
        if source.address.scope != target.address.scope {
            return Err(ResourceError::NotSupported {
                uri: target_uri,
                scope: target.registration.kind,
                operation: ScopeOperation::Rename,
            }
            .to_chips_error());
        }
        let provider = self.writable_provider(&source)?;
        // rename A→B 同时锁 {A, B}：与对 B 的并发写互斥（《04.04》§4.9）。
        let _write_permit = self
            .write_coordinator
            .lock_async([path_lock_key(&source), path_lock_key(&target)])
            .await;
        provider.rename(&source.address, &target.address).await?;
        // 改名/移动双端事件失效（源与目标身份皆变，《04》§6.3）。
        self.cache
            .invalidate_resource(&source.address.scope, source.address.path.as_str());
        self.cache
            .invalidate_resource(&target.address.scope, target.address.path.as_str());
        let metadata = provider.stat(&target.address).await?;
        let view = metadata_view(&target.address.uri, target.registration.kind, metadata);
        let key = self.cache_key_for(&target.address, &view.version);
        self.l0_fill(&key, &view);
        Ok(view)
    }

    /// 复制（《04》§11.1 `copy`，《04.04》§4.9/§4.10）：源按读鉴权、目标按写
    /// 鉴权；跨作用域且缺目标权限 → `RESOURCE_CROSS_SCOPE`（《06》§7.2）；
    /// 目标已存在不覆盖（《06》§7.2 ALREADY_EXISTS 口径，README 漂移登记）。
    /// 单次提交体量守 `max_inline_bytes`（一次性写入面）。
    pub async fn copy(&self, request: FsOpRequest) -> ManagerResult<ResourceMetadata> {
        let target_uri = self.require_target(&request)?;
        let source = self.resolve(&request.source, request.session, ResourceOperation::Read)?;
        let cross_scope = resolve_input(&target_uri, &self.limits)?.scope != source.address.scope;
        let target = self
            .resolve(&target_uri, request.session, ResourceOperation::Write)
            .map_err(|error| match error {
                ResourceError::PermissionDenied {
                    permission,
                    required,
                    missing,
                    granted,
                    reason,
                    ..
                } if cross_scope => ResourceError::CrossScope {
                    target: target_uri.clone(),
                    permission,
                    required,
                    missing,
                    granted,
                    reason,
                },
                other => other,
            })?;
        let source_provider = self
            .providers
            .lookup(&source.registration.provider_id)
            .ok_or(ResourceError::Internal)?;
        let target_provider = self.writable_provider(&target)?;
        let stat = source_provider.stat(&source.address).await?;
        check_size(
            &target.address.uri,
            target.registration.policy.max_resource_bytes,
            stat.size,
        )?;
        if stat.size > self.limits.max_inline_bytes {
            return Err(ResourceError::TooLarge {
                uri: target.address.uri.clone(),
                size: stat.size,
                limit: self.limits.max_inline_bytes,
            }
            .to_chips_error());
        }
        if source.registration.provider_id == target.registration.provider_id {
            let _write_permit = self
                .write_coordinator
                .lock_async([path_lock_key(&target)])
                .await;
            target_provider
                .copy(&source.address, &target.address)
                .await?;
        } else {
            let _write_permit = self
                .write_coordinator
                .lock_async([path_lock_key(&target)])
                .await;
            if target_provider.stat(&target.address).await.is_ok() {
                return Err(ResourceError::AlreadyExists {
                    uri: target.address.uri.clone(),
                }
                .to_chips_error());
            }
            let bytes = source_provider
                .read_range(
                    &source.address,
                    ByteRange {
                        offset: 0,
                        length: Some(stat.size),
                    },
                )
                .await?;
            target_provider.write(&target.address, &bytes).await?;
        }
        // 复制目标事件失效（目标为新内容身份，《04》§6.3）。
        self.cache
            .invalidate_resource(&target.address.scope, target.address.path.as_str());
        let metadata = target_provider.stat(&target.address).await?;
        let view = metadata_view(&target.address.uri, target.registration.kind, metadata);
        let key = self.cache_key_for(&target.address, &view.version);
        self.l0_fill(&key, &view);
        Ok(view)
    }

    /// 创建目录（《04》§11.1 `create_directory`，《04.04》§4.9）：仅 Plugin /
    /// Temporary 在册接受；Memory（扁平字节键空间无目录层级）及其余种类
    /// 返回 `RESOURCE_NOT_SUPPORTED`（`operation = create_directory`）。
    pub async fn create_directory(&self, request: FsOpRequest) -> ManagerResult<()> {
        let resolved = self.resolve(&request.source, request.session, ResourceOperation::Write)?;
        let provider = self.writable_provider(&resolved)?;
        if !matches!(
            resolved.registration.kind,
            ScopeKind::Plugin | ScopeKind::Temporary
        ) {
            return Err(ResourceError::NotSupported {
                uri: resolved.address.uri.clone(),
                scope: resolved.registration.kind,
                operation: ScopeOperation::CreateDirectory,
            }
            .to_chips_error());
        }
        let _write_permit = self
            .write_coordinator
            .lock_async([path_lock_key(&resolved)])
            .await;
        provider.create_directory(&resolved.address).await?;
        // 目录创建事件失效（列举面不缓存《04.13》§13-15；此处清资源身份
        // 条目，《04》§6.3）。
        self.cache
            .invalidate_resource(&resolved.address.scope, resolved.address.path.as_str());
        Ok(())
    }

    /// 目录列举（《04》§11.1 `list_directory`）：Platform / External /
    /// Memory 在册不支持（《04》§3.3 / §5.2），管理器层直接返回
    /// `RESOURCE_NOT_SUPPORTED`（`operation = list`），不透传 Provider。
    pub async fn list_directory(&self, request: OpenRequest) -> ManagerResult<Vec<DirectoryEntry>> {
        let resolved = self.resolve(&request.uri, request.session, ResourceOperation::Read)?;
        if matches!(
            resolved.registration.kind,
            ScopeKind::Platform | ScopeKind::External | ScopeKind::Memory
        ) {
            return Err(ResourceError::NotSupported {
                uri: resolved.address.uri.clone(),
                scope: resolved.registration.kind,
                operation: ScopeOperation::List,
            }
            .to_chips_error());
        }
        let provider = self
            .providers
            .lookup(&resolved.registration.provider_id)
            .ok_or(ResourceError::Internal)?;
        provider.list_directory(&resolved.address).await
    }

    /// 打开流式写入通道（《03.07》§7.1 `open_write_stream`，同步签名；
    /// 《04.04》§4.8 大资源 > `max_inline_bytes` 的分块提交入口）：
    /// 解析流水线写鉴权 → 能力预检（归档 / 只读策略 → `RESOURCE_READ_ONLY`
    /// 精确目标 uri 臂）→ `expected_size` 上限预核 → 取得
    /// `WriteCoordinator` 路径写锁并贯穿流生命周期（《04.13》§13-3 写
    /// 路径唯一）→ 目录域先落提交日志 prepare 相（sidecar 意图记录 fsync
    /// 后再建隐藏临时文件，波 C2a-1：进程崩溃时在途流重启后可判读回收）。
    /// 目标为在册目录 → `ALREADY_EXISTS`、父目录缺失 → `NOT_FOUND`
    /// （与一次性提交同口径，锁内判定无竞态）。
    pub fn open_write_stream(
        &self,
        request: WriteStreamRequest,
    ) -> ManagerResult<WriteStreamHandle> {
        let uri = format!(
            "chips-resource://{}/{}",
            request.scope,
            request.path.as_str()
        );
        let resolved = self.resolve(&uri, request.session, ResourceOperation::Write)?;
        if let Some(expected) = request.expected_size {
            check_size(
                &resolved.address.uri,
                resolved.registration.policy.max_resource_bytes,
                expected,
            )
            .map_err(|error| error.to_chips_error())?;
        }
        let _ = self.writable_provider(&resolved)?;
        // 写流入口为《03.07》§7.1 同步签名：维持同步臂形态（锁贯穿流生命
        // 周期、随记录 Drop 归还）；异步写族入口的排队统一走 `lock_async`。
        let permit = self.write_coordinator.lock([path_lock_key(&resolved)]);
        let sink = if resolved.registration.provider_id == DIRECTORY_PROVIDER_ID {
            StreamSink::Directory(
                self.directory_provider
                    .begin_stream_write(&resolved.address)?,
            )
        } else {
            StreamSink::Buffer(Vec::new())
        };
        let id = self.next_write_stream_id.fetch_add(1, Ordering::Relaxed);
        let handle = WriteStreamHandle {
            id,
            uri: resolved.address.uri.clone(),
        };
        self.write_streams
            .lock()
            .expect("写流登记表锁不得中毒")
            .insert(
                id,
                WriteStreamRecord {
                    session: resolved.session.id,
                    address: resolved.address,
                    provider_id: resolved.registration.provider_id,
                    max_resource_bytes: resolved.registration.policy.max_resource_bytes,
                    expected_size: request.expected_size,
                    received: 0,
                    _permit: permit,
                    sink,
                },
            );
        Ok(handle)
    }

    /// 分块送入（背压承载：调用方不送入即不推进，《04.04》§4.8）：
    /// 累计超出作用域 `max_resource_bytes` → `RESOURCE_TOO_LARGE` 并回滚
    /// （临时文件即时清理）；超出 `expected_size` → `RESOURCE_WRITE_FAILED`
    /// 并回滚（findings 登记裁量）；宿主 IO 失败 → `RESOURCE_WRITE_FAILED`
    /// 并回滚。陈旧句柄（已提交/中止/随会话注销）→ `RESOURCE_NOT_FOUND`
    /// （写流句柄不进出册句柄三态状态机，findings 登记）。
    pub fn append_write_stream(
        &self,
        handle: &WriteStreamHandle,
        bytes: &[u8],
    ) -> ManagerResult<()> {
        let added = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
        let mut streams = self.write_streams.lock().expect("写流登记表锁不得中毒");
        let Some(record) = streams.get_mut(&handle.id) else {
            return Err(ResourceError::NotFound {
                uri: handle.uri.clone(),
            }
            .to_chips_error());
        };
        let total = record.received.saturating_add(added);
        let failure = if total > record.max_resource_bytes {
            Some(
                ResourceError::TooLarge {
                    uri: handle.uri.clone(),
                    size: total,
                    limit: record.max_resource_bytes,
                }
                .to_chips_error(),
            )
        } else if record
            .expected_size
            .is_some_and(|expected| total > expected)
        {
            Some(
                ResourceError::WriteFailed {
                    uri: handle.uri.clone(),
                }
                .to_chips_error(),
            )
        } else {
            match record.sink.append(bytes) {
                Ok(()) => {
                    record.received = total;
                    None
                }
                Err(error) => Some(error),
            }
        };
        if failure.is_some() {
            // 失败即回滚：弃置记录（临时文件 Drop 清理、写锁归还）。
            streams.remove(&handle.id);
        }
        failure.map_or(Ok(()), Err)
    }

    /// 提交流式写入（《03.07》§7.1 `commit_write_stream`，异步签名）：
    /// 目录域 `flush` + `sync_all` + 原子 `rename`（《04.04》§4.8），rename
    /// 落定后撤销提交日志意图记录（波 C2a-1）；其余可写 Provider 一次性
    /// `Provider::write` 落定；`expected_size` 不符即回滚不提交（《04.07》
    /// §7.3 失败回滚临时物）；失败删除临时文件与意图记录、目标保持旧态；
    /// 提交成功归还路径写锁并返回新版本元数据。
    pub async fn commit_write_stream(
        &self,
        handle: WriteStreamHandle,
    ) -> ManagerResult<ResourceMetadata> {
        let Some(record) = self
            .write_streams
            .lock()
            .expect("写流登记表锁不得中毒")
            .remove(&handle.id)
        else {
            return Err(ResourceError::NotFound {
                uri: handle.uri.clone(),
            }
            .to_chips_error());
        };
        let WriteStreamRecord {
            address,
            provider_id,
            expected_size,
            received,
            _permit,
            sink,
            ..
        } = record;
        if expected_size.is_some_and(|expected| expected != received) {
            // 尺寸不符：sink 弃置（临时文件 Drop 清理）→ WRITE_FAILED。
            drop(sink);
            return Err(ResourceError::WriteFailed {
                uri: address.uri.clone(),
            }
            .to_chips_error());
        }
        let provider = self
            .providers
            .lookup(&provider_id)
            .ok_or(ResourceError::Internal)?;
        match sink {
            StreamSink::Directory(sink) => {
                sink.finish()?;
            }
            StreamSink::Buffer(bytes) => {
                provider.write(&address, &bytes).await?;
            }
        }
        // 元数据视图（提交后新版本，《04.04》§4.10）。
        let registration = self.scopes.lookup(&address.scope).ok_or_else(|| {
            ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error()
        })?;
        // 写提交事件失效（《04》§6.3 TemporaryProvider 行「写入提交后刷新」）。
        self.cache
            .invalidate_resource(&address.scope, address.path.as_str());
        let metadata = provider.stat(&address).await?;
        let view = metadata_view(&address.uri, registration.kind, metadata);
        let key = self.cache_key_for(&address, &view.version);
        self.l0_fill(&key, &view);
        Ok(view)
    }

    /// 主动中止流式写入：弃置通道并清理临时文件（零残留，《04.04》§4.9），
    /// 归还路径写锁。陈旧句柄 → `RESOURCE_NOT_FOUND`（与 append 同口径）。
    pub fn abort_write_stream(&self, handle: &WriteStreamHandle) -> ManagerResult<()> {
        let taken = self
            .write_streams
            .lock()
            .expect("写流登记表锁不得中毒")
            .remove(&handle.id);
        match taken {
            Some(record) => {
                drop(record);
                Ok(())
            }
            None => Err(ResourceError::NotFound {
                uri: handle.uri.clone(),
            }
            .to_chips_error()),
        }
    }

    /// 活动流式写入计数（装配与级联测试探测）。
    #[must_use]
    pub fn open_write_stream_count(&self) -> usize {
        self.write_streams
            .lock()
            .expect("写流登记表锁不得中毒")
            .len()
    }

    /// 按谓词中止活动流式写入（会话关闭 / 作用域注销级联）：记录整体
    /// 弃置，临时文件与路径写锁随之归还。
    fn abort_write_streams(&self, predicate: impl Fn(&WriteStreamRecord) -> bool) {
        let mut streams = self.write_streams.lock().expect("写流登记表锁不得中毒");
        let doomed: Vec<u64> = streams
            .iter()
            .filter(|(_, record)| predicate(record))
            .map(|(id, _)| *id)
            .collect();
        for id in doomed {
            streams.remove(&id);
        }
    }

    /// rename/copy 的目标 URI 在册必需字段校验（缺失按语法级非法路径收口）。
    fn require_target(&self, request: &FsOpRequest) -> ResourceResult<String> {
        request
            .target
            .clone()
            .ok_or_else(|| ResourceError::InvalidUri {
                uri: request.source.clone(),
                reason: crate::error::UriErrorReason::MalformedPath,
            })
    }

    /// 写入族能力预检（《04》§3.3）：只读策略或 Provider 不支持写入 →
    /// `RESOURCE_READ_ONLY`，Manager 层直接返回，不透传 Provider。
    fn writable_provider(
        &self,
        resolved: &ResolvedResource,
    ) -> ResourceResult<Arc<dyn ResourceProvider>> {
        if resolved.registration.policy.read_only {
            return Err(ResourceError::ReadOnly {
                uri: resolved.address.uri.clone(),
            });
        }
        let provider = self
            .providers
            .lookup(&resolved.registration.provider_id)
            .ok_or(ResourceError::Internal)?;
        if !provider.supports_write() {
            return Err(ResourceError::ReadOnly {
                uri: resolved.address.uri.clone(),
            });
        }
        Ok(provider)
    }

    /// 删除/建目录的种类门（《04.04》§4.9）在 `delete` 中的复用面。
    fn check_write_kind_gate(
        &self,
        resolved: &ResolvedResource,
        operation: ScopeOperation,
    ) -> ResourceResult<()> {
        let allowed = match operation {
            ScopeOperation::Delete => matches!(
                resolved.registration.kind,
                ScopeKind::Plugin | ScopeKind::Temporary | ScopeKind::Memory
            ),
            _ => true,
        };
        if allowed {
            return Ok(());
        }
        Err(ResourceError::NotSupported {
            uri: resolved.address.uri.clone(),
            scope: resolved.registration.kind,
            operation,
        })
    }

    /// 创建者会话（含级联）关闭时摘除 Memory 挂载：条目整体清空（不落盘）、
    /// 作用域注销（在册句柄级联失效由 `unregister_scope` 承担）。
    fn evict_memory_mount(&self, closed_ids: &BTreeSet<SessionId>) {
        let taken = {
            let mut mount = self.memory_mount.lock().expect("挂载锁不得中毒");
            match mount.as_ref() {
                Some(record) if closed_ids.contains(&record.session) => mount.take(),
                _ => None,
            }
        };
        if let Some(mount) = taken {
            mount.provider.clear();
            let _ = self.unregister_scope(&MEMORY_SCOPE.to_owned());
        }
    }
}

/// 临时作用域的平台所有者哨兵（《04》§11.1 `register_temp_scope` 签名
/// 无 owner 参数；授权来源是对话框用户许可而非任何插件，故以平台哨兵
/// 登记所有者，README 在册该解释性决定）。
pub const TEMP_SCOPE_OWNER: &str = "chips.official.host";

/// External 作用域固定由 `http` / `webdav` Provider 承载（段二挂载实现）。
fn external_provider_id(uri: &CanonicalUri) -> &'static str {
    match uri.external.as_ref().map(|origin| origin.scheme.as_str()) {
        Some("webdav") => "webdav",
        _ => "http",
    }
}

/// 由资源地址与版本戳构造缓存键（《04》§6.5 在册键形）。
///
/// Manager L1 面与 HttpProvider L0/L2 面共用本函数，杜绝双侧键漂移；
/// External 键含 origin（`scheme://host[:port]`）、query 参与键、
/// fragment 已在 URI 语法层拒绝天然不参与。
pub(crate) fn cache_key_for_uri(
    limits: &ResourceLimits,
    address: &ResourceAddress,
    version: &str,
) -> CacheKey {
    if address.scope == crate::uri::EXTERNAL_SCOPE {
        let (origin, path) = match resolve_input(&address.uri, limits) {
            Ok(uri) => {
                let origin = uri.external.as_ref().map_or_else(
                    || format!("scope:{}", address.scope),
                    |external| format!("{}://{}", external.scheme, external.host_authority()),
                );
                let path = match (&uri.path, &uri.query) {
                    (Some(path), Some(query)) => format!("{}?{}", path.as_str(), query),
                    (Some(path), None) => path.as_str().to_owned(),
                    (None, Some(query)) => format!("?{query}"),
                    (None, None) => String::new(),
                };
                (origin, path)
            }
            Err(_) => (
                format!("scope:{}", address.scope),
                address.path.as_str().to_owned(),
            ),
        };
        return CacheKey::external(&origin, &path, version);
    }
    CacheKey::managed(&address.scope, address.path.as_str(), version)
}

/// Resource 域判定素材组装（RFC-权限审计跨层采集sink裁定 §5.1 字段口径）：
/// `plugin_id` = `session.owner`；`resource_uri` = 规范 URI 原值（§8.5 脱敏
/// 归宿主写入侧）；`target` = `denied()` 的 `chips-resource://<scope>/`
/// 形态（allow 臂可缺省）；`capability_id` / `request_id` / `trace_id` /
/// `qualifier` 恒 None（resource 域无该键轨，宿主以段一横切补挂，RFC §5.3）。
/// 直通臂与非权限拒绝臂返回 `None`——不发素材（RFC §九 9.3-3）。
fn resource_decision_material(
    arm: &DecisionArm,
    owner: &PluginId,
    session: SessionId,
    resource_uri: &str,
) -> Option<PermissionDecision> {
    match arm {
        DecisionArm::PassThrough | DecisionArm::NonPermissionDenied => None,
        DecisionArm::JudgedAllow { required } => Some(PermissionDecision {
            domain: DecisionDomain::Resource,
            action: DecisionAction::Allow,
            plugin_id: owner.clone(),
            session_id: session,
            permission: required.first().cloned().unwrap_or_default(),
            required: required.clone(),
            missing: Vec::new(),
            reason: None,
            capability_id: None,
            resource_uri: Some(resource_uri.to_owned()),
            target: None,
            request_id: None,
            trace_id: None,
            qualifier: None,
        }),
        DecisionArm::JudgedDeny {
            permission,
            required,
            missing,
            reason,
            target,
        } => Some(PermissionDecision {
            domain: DecisionDomain::Resource,
            action: DecisionAction::Deny,
            plugin_id: owner.clone(),
            session_id: session,
            permission: permission.clone(),
            required: required.clone(),
            missing: missing.clone(),
            reason: Some(*reason),
            capability_id: None,
            resource_uri: Some(resource_uri.to_owned()),
            target: Some(target.clone()),
            request_id: None,
            trace_id: None,
            qualifier: None,
        }),
    }
}

/// 大小上限校验（《04》§12：`maxResourceBytes`；超限 `RESOURCE_TOO_LARGE`）。
fn check_size(uri: &str, limit: u64, size: u64) -> ResourceResult<()> {
    if size > limit {
        return Err(ResourceError::TooLarge {
            uri: uri.to_owned(),
            size,
            limit,
        });
    }
    Ok(())
}

/// `WriteCoordinator` 路径锁键：作用域 ID + 规范虚拟路径文本
/// （《04.04》§4.9 单写者判定粒度）。
fn path_lock_key(resolved: &ResolvedResource) -> (ScopeId, String) {
    (
        resolved.address.scope.clone(),
        resolved.address.path.as_str().to_owned(),
    )
}

/// 组装对外的元数据视图：`uri` 与 `scope` 由管理器在册定值。
fn metadata_view(uri: &str, kind: ScopeKind, metadata: ResourceMetadata) -> ResourceMetadata {
    ResourceMetadata {
        uri: uri.to_owned(),
        size: metadata.size,
        mime_type: metadata.mime_type,
        version: metadata.version,
        scope: kind,
    }
}

/// External origin（供段二网络面复用装配）。
#[must_use]
pub fn external_origin_of(uri: &CanonicalUri) -> Option<&ExternalOrigin> {
    uri.external.as_ref()
}

/// 打开后未释放句柄计数（泄漏检测入口，《04》§10.3）。
#[must_use]
pub fn open_handle_count(manager: &ResourceManager) -> usize {
    manager.handles.len()
}

/// 句柄归属索引（审计与会话级联测试辅助）。
#[must_use]
pub fn handles_of_session(manager: &ResourceManager, session: SessionId) -> Vec<HandleId> {
    manager
        .handles
        .snapshot()
        .into_iter()
        .filter(|entry| entry.session == session)
        .map(|entry| entry.id)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    use chips_core::NoopDecisionObserver;

    use crate::provider::{DirectoryEntry, FileMetadata, ResourceStream};
    use crate::scope::{Origin, ScopePolicy};
    use crate::uri::PLATFORM_SCOPE;

    /// 最小 Provider 替身：固定内容 `b"0123456789abcdef"`。
    struct StubProvider {
        id: &'static str,
        size: u64,
    }

    impl StubProvider {
        fn new(id: &'static str, size: u64) -> Self {
            Self { id, size }
        }
    }

    struct StubStream {
        cursor: usize,
    }

    #[async_trait::async_trait]
    impl ResourceStream for StubStream {
        async fn next_chunk(&mut self, max_bytes: usize) -> Result<Option<Vec<u8>>, ChipsError> {
            const DATA: &[u8] = b"0123456789abcdef";
            if self.cursor >= DATA.len() {
                return Ok(None);
            }
            let end = (self.cursor + max_bytes).min(DATA.len());
            let chunk = DATA[self.cursor..end].to_vec();
            self.cursor = end;
            Ok(Some(chunk))
        }
    }

    #[async_trait::async_trait]
    impl ResourceProvider for StubProvider {
        fn id(&self) -> &'static str {
            self.id
        }
        fn supports_streaming(&self) -> bool {
            true
        }
        fn supports_write(&self) -> bool {
            false
        }
        async fn stat(&self, address: &ResourceAddress) -> Result<ResourceMetadata, ChipsError> {
            if address.path.as_str().contains("missing") {
                return Err(ResourceError::NotFound {
                    uri: address.uri.clone(),
                }
                .to_chips_error());
            }
            Ok(ResourceMetadata {
                uri: address.uri.clone(),
                size: self.size,
                mime_type: "application/octet-stream".into(),
                version: "stub-v1".into(),
                scope: ScopeKind::Document,
            })
        }
        async fn read_range(
            &self,
            address: &ResourceAddress,
            range: ByteRange,
        ) -> Result<Vec<u8>, ChipsError> {
            const DATA: &[u8] = b"0123456789abcdef";
            let start = range.offset as usize;
            if start >= DATA.len() {
                return Ok(Vec::new());
            }
            let end = match range.length {
                Some(length) => (start + length as usize).min(DATA.len()),
                None => DATA.len(),
            };
            let _ = address;
            Ok(DATA[start..end].to_vec())
        }
        async fn open_stream(
            &self,
            _address: &ResourceAddress,
        ) -> Result<Box<dyn ResourceStream>, ChipsError> {
            Ok(Box::new(StubStream { cursor: 0 }))
        }
        async fn list_directory(
            &self,
            _address: &ResourceAddress,
        ) -> Result<Vec<DirectoryEntry>, ChipsError> {
            Ok(Vec::new())
        }
        async fn write(
            &self,
            address: &ResourceAddress,
            _data: &[u8],
        ) -> Result<ResourceMetadata, ChipsError> {
            Err(ResourceError::ReadOnly {
                uri: address.uri.clone(),
            }
            .to_chips_error())
        }
        async fn delete(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
            Err(ResourceError::ReadOnly {
                uri: address.uri.clone(),
            }
            .to_chips_error())
        }
        async fn rename(
            &self,
            from: &ResourceAddress,
            _to: &ResourceAddress,
        ) -> Result<(), ChipsError> {
            Err(ResourceError::ReadOnly {
                uri: from.uri.clone(),
            }
            .to_chips_error())
        }
        async fn copy(
            &self,
            from: &ResourceAddress,
            _to: &ResourceAddress,
        ) -> Result<(), ChipsError> {
            Err(ResourceError::ReadOnly {
                uri: from.uri.clone(),
            }
            .to_chips_error())
        }
        async fn create_directory(&self, _address: &ResourceAddress) -> Result<(), ChipsError> {
            Err(ResourceError::ReadOnly { uri: "stub".into() }.to_chips_error())
        }
        async fn set_metadata(
            &self,
            _address: &ResourceAddress,
            _metadata: FileMetadata,
        ) -> Result<(), ChipsError> {
            Err(ResourceError::ReadOnly { uri: "stub".into() }.to_chips_error())
        }
    }

    /// 带闸可写替身：`write` 先等闸许可再提交，模拟真实 Provider 在持锁
    /// 期间挂起（Pending）的窗口（#151 残账段三收口判定面）。
    struct GatedWriteProvider {
        gate: Arc<tokio::sync::Semaphore>,
        commits: std::sync::atomic::AtomicUsize,
    }

    #[async_trait::async_trait]
    impl ResourceProvider for GatedWriteProvider {
        fn id(&self) -> &'static str {
            "gated"
        }
        fn supports_streaming(&self) -> bool {
            false
        }
        fn supports_write(&self) -> bool {
            true
        }
        async fn stat(&self, address: &ResourceAddress) -> Result<ResourceMetadata, ChipsError> {
            Err(ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error())
        }
        async fn read_range(
            &self,
            address: &ResourceAddress,
            _range: ByteRange,
        ) -> Result<Vec<u8>, ChipsError> {
            Err(ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error())
        }
        async fn open_stream(
            &self,
            address: &ResourceAddress,
        ) -> Result<Box<dyn ResourceStream>, ChipsError> {
            Err(ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error())
        }
        async fn list_directory(
            &self,
            _address: &ResourceAddress,
        ) -> Result<Vec<DirectoryEntry>, ChipsError> {
            Ok(Vec::new())
        }
        async fn write(
            &self,
            address: &ResourceAddress,
            _data: &[u8],
        ) -> Result<ResourceMetadata, ChipsError> {
            let _gate = self.gate.acquire().await.expect("闸 semaphore 不关闭");
            let seq = self.commits.fetch_add(1, Ordering::SeqCst);
            Ok(ResourceMetadata {
                uri: address.uri.clone(),
                size: 1,
                mime_type: "application/octet-stream".into(),
                version: format!("gated-v{seq}"),
                scope: ScopeKind::Plugin,
            })
        }
        async fn delete(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
            Err(ResourceError::ReadOnly {
                uri: address.uri.clone(),
            }
            .to_chips_error())
        }
        async fn rename(
            &self,
            from: &ResourceAddress,
            _to: &ResourceAddress,
        ) -> Result<(), ChipsError> {
            Err(ResourceError::ReadOnly {
                uri: from.uri.clone(),
            }
            .to_chips_error())
        }
        async fn copy(
            &self,
            from: &ResourceAddress,
            _to: &ResourceAddress,
        ) -> Result<(), ChipsError> {
            Err(ResourceError::ReadOnly {
                uri: from.uri.clone(),
            }
            .to_chips_error())
        }
        async fn create_directory(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
            Err(ResourceError::ReadOnly {
                uri: address.uri.clone(),
            }
            .to_chips_error())
        }
        async fn set_metadata(
            &self,
            _address: &ResourceAddress,
            _metadata: FileMetadata,
        ) -> Result<(), ChipsError> {
            Err(ResourceError::ReadOnly {
                uri: "gated".into(),
            }
            .to_chips_error())
        }
    }

    fn registration(scope: &str, kind: ScopeKind, provider_id: &str) -> ScopeRegistration {
        ScopeRegistration {
            scope: scope.into(),
            kind,
            owner: "chips.official.editor".into(),
            provider_id: provider_id.into(),
            origin: Origin::Directory(PathBuf::from("/fixture/root")),
            policy: ScopePolicy {
                read_only: false,
                max_resource_bytes: 1024,
                allowed_hosts: Vec::new(),
            },
        }
    }

    fn manager_with_stub() -> ResourceManager {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        manager
            .register_provider(Arc::new(StubProvider::new("directory", 16)))
            .expect("Provider 注册必须成功");
        manager
            .register_scope(registration("card-1", ScopeKind::Document, "directory"))
            .expect("作用域注册必须成功");
        manager
    }

    fn session_of(manager: &ResourceManager, scopes: &[&str]) -> SessionId {
        let scopes: BTreeSet<String> = scopes.iter().map(|scope| (*scope).to_owned()).collect();
        manager
            .open_session(
                SessionKind::Document,
                &"chips.official.editor".into(),
                scopes.clone(),
                Vec::<String>::new(),
            )
            .expect("会话创建必须成功")
    }

    #[test]
    fn test_resolve_pipeline_success() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        let resolved = manager
            .resolve(
                "chips-resource://card-1/images/photo.jpg",
                session,
                ResourceOperation::Read,
            )
            .expect("已绑定作用域读取必须放行");
        assert_eq!(resolved.address.scope, "card-1");
        assert_eq!(resolved.address.path.as_str(), "images/photo.jpg");
        assert_eq!(resolved.registration.kind, ScopeKind::Document);
    }

    #[test]
    fn test_resolve_unregistered_scope_is_not_found() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        let error = manager
            .resolve(
                "chips-resource://card-9/a.png",
                session,
                ResourceOperation::Read,
            )
            .expect_err("未注册作用域必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
    }

    #[test]
    fn test_resolve_unknown_session_is_permission_denied() {
        let manager = manager_with_stub();
        let error = manager
            .resolve("chips-resource://card-1/a.png", 99, ResourceOperation::Read)
            .expect_err("不可解析会话必须按拒绝收口");
        assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
    }

    #[test]
    fn test_resolve_scope_root_is_not_found() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        let error = manager
            .resolve("chips-resource://card-1/", session, ResourceOperation::Read)
            .expect_err("作用域根不可作为资源");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
    }

    #[test]
    fn test_unregister_scope_detaches_sessions() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        manager.unregister_scope(&"card-1".to_owned()).unwrap();
        let error = manager
            .resolve(
                "chips-resource://card-1/a.png",
                session,
                ResourceOperation::Read,
            )
            .expect_err("注销后作用域必须不存在");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
    }

    #[tokio::test]
    async fn test_open_then_release_flow() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        let handle = manager
            .open(OpenRequest {
                uri: "chips-resource://card-1/a.png".into(),
                session,
            })
            .await
            .expect("打开必须成功");
        assert_eq!(handle.metadata.size, 16);
        assert_eq!(handle.metadata.uri, "chips-resource://card-1/a.png");
        assert_eq!(open_handle_count(&manager), 1);
        manager.release(handle.id, session).unwrap();
        assert!(manager.handles().is_empty());
        let error = manager
            .stat(handle.id, session)
            .await
            .expect_err("陈旧句柄必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_HANDLE_RELEASED);
    }

    /// N-1 归属闸两臂（判据：《安全巡检残项复核-2026-09-23》§一.1，
    /// 母型 = IPC 三列账巡检 §六.2 G2 服务端归属比对）：同会话四臂
    /// 合法放行；外来会话以会话 A 的句柄 ID 逐一调用 `stat` /
    /// `read_range` / `read_chunk` / `release` 全部拒绝并落在册拒绝形
    /// （`RESOURCE_PERMISSION_DENIED`、`permission: "session"`、
    /// `reason: out_of_scope`、`target` 为句柄在册 URI），且拒绝零副
    /// 作用——句柄不释放、流槽位不占用、归属不改写。
    #[tokio::test]
    async fn test_handle_arms_cross_session_denied_two_arms() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        let foreign = session_of(&manager, &["card-1"]);
        assert_ne!(session, foreign, "两会话必须互异以构成跨会话臂");
        let handle = manager
            .open(OpenRequest {
                uri: "chips-resource://card-1/a.png".into(),
                session,
            })
            .await
            .expect("归属会话打开必须成功");
        // 合法臂：归属会话四臂全放行。
        manager
            .stat(handle.id, session)
            .await
            .expect("同会话 stat 必须放行");
        manager
            .read_range(
                handle.id,
                session,
                ByteRange {
                    offset: 0,
                    length: Some(4),
                },
            )
            .await
            .expect("同会话 read_range 必须放行");
        manager
            .read_chunk(handle.id, session, 4)
            .await
            .expect("同会话 read_chunk 必须放行")
            .expect("载荷非空资源首块必在");
        // 越权臂：外来会话逐臂拒绝且落在册拒绝形。read_chunk 越权拒绝
        // 不得抢占流槽位（归属闸先于占槽）；release 越权拒绝不得归还
        // 租约（可用性面防线）。
        for error in [
            manager
                .stat(handle.id, foreign)
                .await
                .expect_err("跨会话 stat 必须拒绝"),
            manager
                .read_range(
                    handle.id,
                    foreign,
                    ByteRange {
                        offset: 0,
                        length: Some(4),
                    },
                )
                .await
                .expect_err("跨会话 read_range 必须拒绝"),
            manager
                .read_chunk(handle.id, foreign, 4)
                .await
                .expect_err("跨会话 read_chunk 必须拒绝"),
            manager
                .release(handle.id, foreign)
                .map_err(chips_core::ChipsError::from)
                .expect_err("跨会话 release 必须拒绝"),
        ] {
            assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
            let details = error.details().expect("拒绝形 details 在册");
            assert_eq!(details["permission"], "session");
            assert_eq!(details["reason"], "out_of_scope");
            assert_eq!(details["target"], "chips-resource://card-1/a.png");
        }
        // 拒绝零副作用：句柄在册、归属不改写；流槽位在途事实不变——
        // 归属者范围读仍 BUSY（互斥口径不因归属闸改变），读到结尾后
        // 归属会话释放放行。
        assert_eq!(open_handle_count(&manager), 1, "越权拒绝不得释放句柄");
        assert_eq!(
            manager.handles().snapshot()[0].session,
            session,
            "越权拒绝不得改写归属"
        );
        let error = manager
            .read_range(
                handle.id,
                session,
                ByteRange {
                    offset: 0,
                    length: Some(1),
                },
            )
            .await
            .expect_err("流占用期间归属者范围读仍互斥");
        assert_eq!(error.code(), crate::error::RESOURCE_BUSY);
        while manager
            .read_chunk(handle.id, session, 8)
            .await
            .expect("归属者流续读")
            .is_some()
        {}
        manager
            .release(handle.id, session)
            .expect("归属会话释放必须放行");
        assert!(manager.handles().is_empty());
    }

    #[tokio::test]
    async fn test_open_provider_not_found_passes_code_through() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        let error = manager
            .open(OpenRequest {
                uri: "chips-resource://card-1/missing.png".into(),
                session,
            })
            .await
            .expect_err("Provider 缺失必须原样上抛在册码");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
        assert_eq!(open_handle_count(&manager), 0, "失败打开不得泄漏句柄");
    }

    #[tokio::test]
    async fn test_open_size_over_policy_limit() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        manager
            .register_provider(Arc::new(StubProvider::new("directory", 4096)))
            .unwrap();
        manager
            .register_scope(registration("card-1", ScopeKind::Document, "directory"))
            .unwrap();
        let session = session_of(&manager, &["card-1"]);
        let error = manager
            .open(OpenRequest {
                uri: "chips-resource://card-1/big.png".into(),
                session,
            })
            .await
            .expect_err("超过作用域大小上限必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_TOO_LARGE);
        assert_eq!(error.details().unwrap()["limit"], 1024);
    }

    #[tokio::test]
    async fn test_read_range_and_stream_mutual_exclusion() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        let handle = manager
            .open(OpenRequest {
                uri: "chips-resource://card-1/a.png".into(),
                session,
            })
            .await
            .unwrap();
        let bytes = manager
            .read_range(
                handle.id,
                session,
                ByteRange {
                    offset: 2,
                    length: Some(4),
                },
            )
            .await
            .expect("范围读必须放行");
        assert_eq!(bytes, b"2345".to_vec());
        // 打开流槽位后范围读返回 BUSY。
        let first = manager
            .read_chunk(handle.id, session, 4)
            .await
            .expect("流首块")
            .expect("非结尾");
        assert_eq!(first, b"0123".to_vec());
        let error = manager
            .read_range(
                handle.id,
                session,
                ByteRange {
                    offset: 0,
                    length: Some(1),
                },
            )
            .await
            .expect_err("流占用期间范围读必须互斥");
        assert_eq!(error.code(), crate::error::RESOURCE_BUSY);
        // 读到结尾：槽位释放，范围读恢复放行。
        let mut pulled = 1;
        while manager
            .read_chunk(handle.id, session, 8)
            .await
            .expect("流续读")
            .is_some()
        {
            pulled += 1;
            assert!(pulled <= 8, "游标必须单调推进");
        }
        manager
            .read_range(
                handle.id,
                session,
                ByteRange {
                    offset: 0,
                    length: Some(2),
                },
            )
            .await
            .expect("EOF 后槽位必须释放");
        assert_eq!(
            manager.handles().snapshot()[0].bytes_read,
            4 + 4 + 8 + 4 + 2
        );
    }

    #[tokio::test]
    async fn test_close_session_returns_leases_of_handles() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        let child = manager
            .derive_session(session, &["card-1".to_owned()], &BTreeSet::new())
            .expect("同作用域派生不得扩权");
        let handle = manager
            .open(OpenRequest {
                uri: "chips-resource://card-1/a.png".into(),
                session,
            })
            .await
            .unwrap();
        let child_handle = manager
            .open(OpenRequest {
                uri: "chips-resource://card-1/b.png".into(),
                session: child,
            })
            .await
            .unwrap();
        assert_eq!(handles_of_session(&manager, session), vec![handle.id]);
        manager.close_session(session).unwrap();
        assert!(manager.handles().is_empty(), "级联必须归还全部租约");
        let error = manager
            .read_chunk(child_handle.id, child, 4)
            .await
            .expect_err("子会话租约必须随父会话归还");
        assert_eq!(error.code(), crate::error::RESOURCE_HANDLE_RELEASED);
    }

    #[tokio::test]
    async fn test_invalidate_scope_keeps_handle_until_release() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        let handle = manager
            .open(OpenRequest {
                uri: "chips-resource://card-1/a.png".into(),
                session,
            })
            .await
            .unwrap();
        manager.invalidate_scope(&"card-1".to_owned(), InvalidateReason::SourceChanged);
        let error = manager
            .stat(handle.id, session)
            .await
            .expect_err("失效句柄读取必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_HANDLE_INVALIDATED);
        assert_eq!(error.details().unwrap()["reason"], "source-changed");
        assert_eq!(open_handle_count(&manager), 1, "失效不归还租约");
        manager.release(handle.id, session).unwrap();
        assert!(manager.handles().is_empty());
    }

    #[test]
    fn test_duplicate_provider_registration_rejected() {
        let manager = manager_with_stub();
        let error = manager
            .register_provider(Arc::new(StubProvider::new("directory", 16)))
            .expect_err("重复 Provider 必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_ALREADY_EXISTS);
    }

    #[tokio::test]
    async fn test_scope_pointing_unregistered_provider_is_internal() {
        // 装配兜底：作用域注册项指向未注册 Provider（启动期装配错误），
        // `open` 返回 `RESOURCE_INTERNAL`（《06》§7.2 协议层兜底），不泄漏句柄。
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        manager
            .register_scope(registration("card-1", ScopeKind::Document, "absent"))
            .expect("作用域注册必须成功");
        let session = session_of(&manager, &["card-1"]);
        let error = manager
            .open(OpenRequest {
                uri: "chips-resource://card-1/a.png".into(),
                session,
            })
            .await
            .expect_err("缺失 Provider 必须按兜底口径拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_INTERNAL);
        assert_eq!(open_handle_count(&manager), 0, "兜底拒绝不得泄漏句柄");
    }

    fn writer_session(manager: &ResourceManager, scopes: &[&str]) -> SessionId {
        let scopes: BTreeSet<String> = scopes.iter().map(|scope| (*scope).to_owned()).collect();
        manager
            .open_session(
                SessionKind::Document,
                &"chips.official.editor".into(),
                scopes,
                vec![crate::permission::PERMISSION_RESOURCES_WRITE.to_owned()],
            )
            .expect("写会话创建必须成功")
    }

    fn memory_manager() -> (ResourceManager, SessionId) {
        let manager = manager_with_stub();
        let session = writer_session(&manager, &["card-1"]);
        let scope = manager.mount_memory(session).expect("挂载必须成功");
        assert_eq!(scope, "memory");
        (manager, session)
    }

    fn write_request(session: SessionId, path: &str, bytes: &[u8]) -> WriteRequest {
        WriteRequest {
            session,
            scope: "memory".into(),
            path: crate::path_guard::VirtualPath::from_validated(path.into()),
            bytes: bytes.to_vec(),
        }
    }

    #[test]
    fn test_mount_memory_requires_existing_session() {
        let manager = manager_with_stub();
        let error = manager.mount_memory(4242).expect_err("未知会话不得挂载");
        assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
        assert!(!manager.memory_mounted());
    }

    #[test]
    fn test_mount_memory_twice_is_already_exists() {
        let (manager, session) = memory_manager();
        let error = manager.mount_memory(session).expect_err("作用域唯一");
        assert_eq!(error.code(), crate::error::RESOURCE_ALREADY_EXISTS);
        assert!(manager.memory_mounted());
    }

    #[tokio::test]
    async fn test_memory_commit_open_read_roundtrip() {
        let (manager, session) = memory_manager();
        let metadata = manager
            .commit_write(write_request(session, "scratch/memo.txt", b"mem-bytes"))
            .await
            .expect("会话内提交必须放行");
        assert_eq!(metadata.size, 9);
        assert_eq!(metadata.mime_type, "text/plain");
        assert_eq!(metadata.scope, ScopeKind::Memory);
        assert!(metadata.version.starts_with("mem-"));
        let handle = manager
            .open(OpenRequest {
                uri: "chips-resource://memory/scratch/memo.txt".into(),
                session,
            })
            .await
            .expect("创建者会话读取免重复校验");
        let bytes = manager
            .read_range(
                handle.id,
                session,
                ByteRange {
                    offset: 4,
                    length: Some(5),
                },
            )
            .await
            .expect("范围读");
        assert_eq!(bytes, b"bytes".to_vec());
        let mut stream_total = 0usize;
        while let Some(chunk) = manager
            .read_chunk(handle.id, session, 4)
            .await
            .expect("流读")
        {
            stream_total += chunk.len();
        }
        assert_eq!(stream_total, 9);
        manager.release(handle.id, session).unwrap();
        // 提交成功递增版本戳（《04.04》§4.10）。
        let second = manager
            .commit_write(write_request(session, "scratch/memo.txt", b"v2"))
            .await
            .expect("覆盖提交");
        assert_ne!(second.version, metadata.version);
    }

    #[tokio::test]
    async fn test_commit_write_async_arm_does_not_starve_single_thread_executor() {
        // 异步形收口锁测（#151 残账，段三 #157）：Manager 异步写族入口的排队
        // 不得占用执行器线程——单线程 runtime 下，任务 A 持路径写锁停在
        // Provider 写（Pending），同路径任务 B 必须异步排队、A 释放后放行。
        // 旧同步 Condvar 形态下 B 等待独占线程、A 的释放点永不可达，本测试
        // 必永挂（挂死即回归信号）。
        let gate = Arc::new(tokio::sync::Semaphore::new(0));
        let provider = Arc::new(GatedWriteProvider {
            gate: Arc::clone(&gate),
            commits: std::sync::atomic::AtomicUsize::new(0),
        });
        let manager = Arc::new(ResourceManager::new(
            ResourceLimits::default(),
            Arc::new(NoopDecisionObserver),
        ));
        manager
            .register_provider(provider)
            .expect("gated Provider 注册必须成功");
        manager
            .register_scope(registration("plugin-gated-1", ScopeKind::Plugin, "gated"))
            .expect("作用域注册必须成功");
        let session = writer_session(&manager, &["plugin-gated-1"]);
        let first = {
            let manager = Arc::clone(&manager);
            tokio::spawn(async move {
                manager
                    .commit_write(WriteRequest {
                        session,
                        scope: "plugin-gated-1".into(),
                        path: crate::path_guard::VirtualPath::from_validated("x/a.bin".into()),
                        bytes: vec![7],
                    })
                    .await
            })
        };
        let second = {
            let manager = Arc::clone(&manager);
            tokio::spawn(async move {
                manager
                    .commit_write(WriteRequest {
                        session,
                        scope: "plugin-gated-1".into(),
                        path: crate::path_guard::VirtualPath::from_validated("x/a.bin".into()),
                        bytes: vec![8],
                    })
                    .await
            })
        };
        for _ in 0..16 {
            tokio::task::yield_now().await;
        }
        assert!(
            !first.is_finished() && !second.is_finished(),
            "闸未开前两次提交都不得完成"
        );
        gate.add_permits(2);
        let first_metadata = first
            .await
            .expect("首个任务不得 panic")
            .expect("首个提交必须成功");
        let second_metadata = second
            .await
            .expect("排队任务不得 panic")
            .expect("释放后排队提交必须成功");
        assert_ne!(
            first_metadata.version, second_metadata.version,
            "两次提交按序各得新版本"
        );
    }

    #[tokio::test]
    async fn test_memory_commit_requires_resources_write() {
        let manager = manager_with_stub();
        let session = session_of(&manager, &["card-1"]);
        manager.mount_memory(session).expect("挂载必须成功");
        let error = manager
            .commit_write(write_request(session, "a.txt", b"x"))
            .await
            .expect_err("缺 resources:write 不得提交");
        assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
    }

    #[test]
    fn test_memory_cross_session_read_denied() {
        let (manager, session) = memory_manager();
        let outsider = session_of(&manager, &["card-1"]);
        assert_ne!(outsider, session);
        let error = manager
            .resolve(
                "chips-resource://memory/a.txt",
                outsider,
                ResourceOperation::Read,
            )
            .expect_err("禁止跨会话传递");
        assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
        assert_eq!(error.details().unwrap()["reason"], "out_of_scope");
    }

    #[tokio::test]
    async fn test_close_creator_session_evicts_memory() {
        let (manager, session) = memory_manager();
        manager
            .commit_write(write_request(session, "a.txt", b"data"))
            .await
            .expect("提交");
        let child = manager
            .derive_session(session, &[], &BTreeSet::new())
            .expect("派生");
        let handle = manager
            .open(OpenRequest {
                uri: "chips-resource://memory/a.txt".into(),
                session,
            })
            .await
            .unwrap();
        manager.close_session(child).expect("子会话关闭");
        assert!(manager.memory_mounted(), "子会话关闭不得摘除父会话挂载");
        manager.close_session(session).expect("创建者会话关闭");
        assert!(!manager.memory_mounted(), "创建者关闭即整体失效");
        // 条目清空且不落盘：重挂载后读旧路径返回 NOT_FOUND。
        let fresh = writer_session(&manager, &["card-1"]);
        manager.mount_memory(fresh).expect("重新挂载");
        let error = manager
            .open(OpenRequest {
                uri: "chips-resource://memory/a.txt".into(),
                session: fresh,
            })
            .await
            .expect_err("旧条目必须已失效");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
        assert_eq!(
            open_handle_count(&manager),
            0,
            "级联失效后原句柄不得保留租约"
        );
        let _ = manager.release(handle.id, session);
    }

    #[tokio::test]
    async fn test_commit_write_capability_prechecks() {
        let (manager, session) = memory_manager();
        // 只读能力 Provider（StubProvider supports_write=false）→ READ_ONLY。
        let error = manager
            .commit_write(WriteRequest {
                session,
                scope: "card-1".into(),
                path: crate::path_guard::VirtualPath::from_validated("a.png".into()),
                bytes: vec![1],
            })
            .await
            .expect_err("能力预检不透传 Provider");
        assert_eq!(error.code(), crate::error::RESOURCE_READ_ONLY);
        // 单次提交超 max_inline_bytes → TOO_LARGE（《04.04》§4.8）。
        let error = manager
            .commit_write(write_request(
                session,
                "big.bin",
                &vec![0u8; 16 * 1024 * 1024],
            ))
            .await
            .expect_err("一次性写入超限");
        assert_eq!(error.code(), crate::error::RESOURCE_TOO_LARGE);
        assert_eq!(
            error.details().unwrap()["limit"],
            manager.limits().max_inline_bytes
        );
    }

    #[tokio::test]
    async fn test_memory_fs_ops_and_gates() {
        let (manager, session) = memory_manager();
        manager
            .commit_write(write_request(session, "src.txt", b"payload"))
            .await
            .expect("提交");
        // 目录列举：Memory 在册不支持，管理器层直接拒绝。
        let error = manager
            .list_directory(OpenRequest {
                uri: "chips-resource://memory/src.txt".into(),
                session,
            })
            .await
            .expect_err("列举不支持");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
        assert_eq!(error.details().unwrap()["operation"], "list");
        // create_directory：Memory 无目录层级。
        let error = manager
            .create_directory(FsOpRequest {
                session,
                source: "chips-resource://memory/dir".into(),
                target: None,
                recursive: false,
            })
            .await
            .expect_err("建目录不支持");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
        assert_eq!(error.details().unwrap()["operation"], "create_directory");
        // 同作用域 rename 放行并更新版本面。
        let renamed = manager
            .rename(FsOpRequest {
                session,
                source: "chips-resource://memory/src.txt".into(),
                target: Some("chips-resource://memory/dst.txt".into()),
                recursive: false,
            })
            .await
            .expect("会话内 rename");
        assert_eq!(renamed.uri, "chips-resource://memory/dst.txt");
        // 出会话（跨作用域）rename → NOT_SUPPORTED（《04.04》§4.9 同作用域 only）。
        let error = manager
            .rename(FsOpRequest {
                session,
                source: "chips-resource://memory/dst.txt".into(),
                target: Some("chips-resource://card-1/x.png".into()),
                recursive: false,
            })
            .await
            .expect_err("rename 出会话");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
        assert_eq!(error.details().unwrap()["operation"], "rename");
        // 跨作用域 copy 缺目标写权限 → CROSS_SCOPE（《06》§7.2）。
        let error = manager
            .copy(FsOpRequest {
                session,
                source: "chips-resource://memory/dst.txt".into(),
                target: Some("chips-resource://card-1/y.png".into()),
                recursive: false,
            })
            .await
            .expect_err("card-1 由只读能力 Provider 承载前先行鉴权");
        // StubProvider supports_write=false：目标能力预检 READ_ONLY；
        // 换 plugin 作用域验证真实 CROSS_SCOPE。
        assert_eq!(error.code(), crate::error::RESOURCE_READ_ONLY);
        let no_write = session_of(&manager, &["card-1"]);
        let error = manager
            .copy(FsOpRequest {
                session: no_write,
                source: "chips-resource://card-1/a.png".into(),
                target: Some("chips-resource://memory/from-doc.txt".into()),
                recursive: false,
            })
            .await
            .expect_err("跨作用域缺目标权限");
        assert_eq!(error.code(), crate::error::RESOURCE_CROSS_SCOPE);
        assert_eq!(error.details().unwrap()["reason"], "out_of_scope");
        assert_eq!(
            error.details().unwrap()["target"],
            "chips-resource://memory/from-doc.txt"
        );
        // 会话内 delete 放行（Memory 在删除种类白名单内）。
        manager
            .delete(FsOpRequest {
                session,
                source: "chips-resource://memory/dst.txt".into(),
                target: None,
                recursive: false,
            })
            .await
            .expect("会话内删除");
        let error = manager
            .delete(FsOpRequest {
                session,
                source: "chips-resource://memory/dst.txt".into(),
                target: None,
                recursive: false,
            })
            .await
            .expect_err("重复删除");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
    }

    #[tokio::test]
    async fn test_delete_document_scope_kind_gate() {
        let (manager, session) = memory_manager();
        // Document 种类不在删除白名单（《04.04》§4.9）：即便能力可写也拒绝。
        let error = manager
            .delete(FsOpRequest {
                session,
                source: "chips-resource://card-1/a.png".into(),
                target: None,
                recursive: false,
            })
            .await
            .expect_err("Document 删除不支持");
        assert_eq!(error.code(), crate::error::RESOURCE_READ_ONLY);
        // StubProvider supports_write=false 先行收口为 READ_ONLY；种类门
        // （NOT_SUPPORTED）在能力预检之后，见 `check_write_kind_gate`。
    }

    #[tokio::test]
    async fn test_copy_within_memory_scope_succeeds() {
        let (manager, session) = memory_manager();
        manager
            .commit_write(write_request(session, "one.txt", b"abc"))
            .await
            .expect("提交");
        let metadata = manager
            .copy(FsOpRequest {
                session,
                source: "chips-resource://memory/one.txt".into(),
                target: Some("chips-resource://memory/two.txt".into()),
                recursive: false,
            })
            .await
            .expect("会话内 copy");
        assert_eq!(metadata.uri, "chips-resource://memory/two.txt");
        assert_eq!(metadata.size, 3);
        let error = manager
            .copy(FsOpRequest {
                session,
                source: "chips-resource://memory/one.txt".into(),
                target: Some("chips-resource://memory/two.txt".into()),
                recursive: false,
            })
            .await
            .expect_err("copy 不覆盖（《06》§7.2）");
        assert_eq!(error.code(), crate::error::RESOURCE_ALREADY_EXISTS);
    }

    /// 目录挂载专用临时根（自建自清）。
    fn temp_root(tag: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("chips-mgr-mount-{}-{}", tag, std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("临时根必须可建");
        root
    }

    fn directory_registration(
        scope: &str,
        kind: ScopeKind,
        root: PathBuf,
        read_only: bool,
    ) -> ScopeRegistration {
        ScopeRegistration {
            scope: scope.into(),
            kind,
            owner: "chips.official.editor".into(),
            provider_id: "directory".into(),
            origin: Origin::Directory(root),
            policy: ScopePolicy {
                read_only,
                max_resource_bytes: 1024,
                allowed_hosts: Vec::new(),
            },
        }
    }

    #[test]
    fn test_mount_directory_requires_existing_session() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let error = manager
            .mount_directory(
                4242,
                directory_registration(
                    "workspace-1",
                    ScopeKind::Workspace,
                    temp_root("no-session"),
                    false,
                ),
            )
            .expect_err("未知会话不得挂载");
        assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
        assert_eq!(error.details().unwrap()["reason"], "out_of_scope");
        assert!(!manager.directory_mounted(&"workspace-1".to_owned()));
    }

    #[test]
    fn test_mount_directory_rejects_foreign_origin_or_kind() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let session = writer_session(&manager, &[]);
        // 非目录 origin（Memory）走 ZIP/内存等专责通道，不在此入口。
        let mut foreign_origin = directory_registration(
            "workspace-1",
            ScopeKind::Workspace,
            temp_root("bad-origin"),
            false,
        );
        foreign_origin.origin = Origin::Memory;
        let error = manager
            .mount_directory(session, foreign_origin)
            .expect_err("非目录 origin 必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_INTERNAL);
        // Platform 种类不在目录挂载面（内嵌资源专责 Provider）。
        let bad_kind = ScopeRegistration {
            kind: ScopeKind::Platform,
            ..directory_registration(
                "workspace-9",
                ScopeKind::Workspace,
                temp_root("bad-kind"),
                false,
            )
        };
        let error = manager
            .mount_directory(session, bad_kind)
            .expect_err("Platform 种类必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_INTERNAL);
        assert!(!manager.directory_mounted(&"workspace-9".to_owned()));
    }

    #[test]
    fn test_mount_directory_absent_root_is_not_found() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let session = writer_session(&manager, &[]);
        let absent = temp_root("absent").join("no-such-dir");
        let error = manager
            .mount_directory(
                session,
                directory_registration("workspace-1", ScopeKind::Workspace, absent, false),
            )
            .expect_err("根目录不存在必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
        assert!(!manager.directory_mounted(&"workspace-1".to_owned()));
        // 根为文件同样拒绝（非目录）。
        let root = temp_root("file-root");
        let file_root = root.join("plain.bin");
        std::fs::write(&file_root, b"x").unwrap();
        let error = manager
            .mount_directory(
                session,
                directory_registration("workspace-2", ScopeKind::Workspace, file_root, false),
            )
            .expect_err("根为文件必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn test_mount_directory_twice_is_already_exists_and_normalizes_provider() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let session = writer_session(&manager, &[]);
        let root = temp_root("dup");
        let mut registration =
            directory_registration("workspace-1", ScopeKind::Workspace, root.clone(), false);
        // 传入杂牌 provider_id 必须被强制归一为 directory。
        registration.provider_id = "zip-store".into();
        let scope = manager
            .mount_directory(session, registration)
            .expect("首挂放行");
        assert_eq!(scope, "workspace-1");
        let record = manager.scopes().lookup(&scope).expect("作用域在册");
        assert_eq!(record.provider_id, DIRECTORY_PROVIDER_ID);
        assert!(manager.directory_mounted(&scope));
        let error = manager
            .mount_directory(
                session,
                directory_registration("workspace-1", ScopeKind::Workspace, root.clone(), false),
            )
            .expect_err("重复挂载作用域唯一");
        assert_eq!(error.code(), crate::error::RESOURCE_ALREADY_EXISTS);
        // 注销即摘根；重挂放行（无半挂载残留）。
        manager.unregister_scope(&scope).expect("注销放行");
        assert!(!manager.directory_mounted(&scope));
        manager
            .mount_directory(
                session,
                directory_registration("workspace-1", ScopeKind::Workspace, root, false),
            )
            .expect("注销后可重挂");
        let _ = std::fs::remove_dir_all(temp_root("dup"));
    }

    // -- #140 §四.2 生产取值合流锁测（段三主体 #185） ---------------------

    fn memory_manager_with_chunk_limit(chunk_bytes: usize) -> (ResourceManager, SessionId) {
        let manager = ResourceManager::new(
            ResourceLimits {
                chunk_bytes,
                ..ResourceLimits::default()
            },
            Arc::new(NoopDecisionObserver),
        );
        let session = writer_session(&manager, &[]);
        manager.mount_memory(session).expect("挂载必须成功");
        (manager, session)
    }

    #[tokio::test]
    async fn test_chunk_budget_below_default_flows_to_streams() {
        // 收紧预算（64 B）必须一路穿透到 Provider 流：块长上限即注入值，
        // 不存在「管理器钳一层、Provider 再钳常量」的双源分叉。
        let (manager, session) = memory_manager_with_chunk_limit(64);
        manager
            .commit_write(write_request(session, "merge/tight.bin", &[7u8; 200]))
            .await
            .expect("提交放行");
        let handle = manager
            .open(OpenRequest {
                uri: "chips-resource://memory/merge/tight.bin".into(),
                session,
            })
            .await
            .expect("开句柄放行");
        let first = manager
            .read_chunk(handle.id, session, usize::MAX)
            .await
            .expect("流读放行")
            .expect("首块必在");
        assert_eq!(first.len(), 64, "块长上限即注入的 chunk_bytes=64");
        let mut total = first.len();
        while let Some(chunk) = manager
            .read_chunk(handle.id, session, usize::MAX)
            .await
            .expect("流读")
        {
            assert!(chunk.len() <= 64, "续块同样受注入上限把守");
            total += chunk.len();
        }
        assert_eq!(total, 200);
    }

    #[tokio::test]
    async fn test_chunk_budget_above_legacy_hardcap_is_honored() {
        // 旧形态：Provider 流自带 256 KiB 常量钳制，注入再大也被静默截断
        // （#140 §四.2 双源漂移）。合流后 512 KiB 预算必须真实生效——
        // 300 KiB 资源一块拉满，回归即红。
        let legacy_hardcap = 256 * 1024;
        assert_eq!(legacy_hardcap, crate::constants::DEFAULT_CHUNK_BYTES);
        let (manager, session) = memory_manager_with_chunk_limit(512 * 1024);
        let payload = vec![3u8; 300 * 1024];
        manager
            .commit_write(write_request(session, "merge/wide.bin", &payload))
            .await
            .expect("提交放行");
        let handle = manager
            .open(OpenRequest {
                uri: "chips-resource://memory/merge/wide.bin".into(),
                session,
            })
            .await
            .expect("开句柄放行");
        let first = manager
            .read_chunk(handle.id, session, 512 * 1024)
            .await
            .expect("流读放行")
            .expect("首块必在");
        assert_eq!(
            first.len(),
            payload.len(),
            "300 KiB 在 512 KiB 注入预算下必须单块完整返回"
        );
        assert!(manager
            .read_chunk(handle.id, session, 512 * 1024)
            .await
            .expect("收尾流读")
            .is_none());
    }

    // -------------------------------------------------------------------
    // 点位三双向换算锁测（W3 波 B，RFC §六 C2：managedUri ↔ localPath
    // 原生单源互逆；四类负例——不存在 / 未挂载 / 越权 / 陈旧——逐臂在册，
    // 错误码零新增、reason 词表零触碰）。
    // -------------------------------------------------------------------

    /// 绑定会话 + 直注冊作用域（换算只依赖注册表与会话绑定集，不触 Provider；
    /// 挂载链形态的换算臂由 `test_local_path_of_stale_after_unregister_core` 覆盖）。
    fn bound_document_scope(manager: &ResourceManager, scope: &str, origin: Origin) -> SessionId {
        manager
            .register_scope(ScopeRegistration {
                scope: scope.into(),
                kind: ScopeKind::Document,
                owner: "chips.official.editor".into(),
                provider_id: "directory".into(),
                origin,
                policy: ScopePolicy {
                    read_only: false,
                    max_resource_bytes: 1024,
                    allowed_hosts: Vec::new(),
                },
            })
            .expect("夹具注册必须成功");
        writer_session(manager, &[scope])
    }

    #[test]
    fn test_local_path_of_directory_member_and_base_form() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let root = temp_root("conv-fwd");
        std::fs::create_dir_all(root.join("meta")).expect("夹具子目录必须可建");
        std::fs::write(root.join("meta/卡片.yaml"), b"kind: card").expect("夹具文件必须可写");
        let session = bound_document_scope(&manager, "card-conv1", Origin::Directory(root.clone()));
        // 作用域基址形 → 目录态包根（Origin 根原样）。
        let base = manager
            .local_path_of("chips-resource://card-conv1/", session)
            .expect("基址换算必须成功");
        assert_eq!(base, root.to_string_lossy().as_ref());
        // 成员形 → Origin 根 + 包内相对段拼接（NFC 中文段与 %20 空格臂）。
        let member = manager
            .local_path_of(
                "chips-resource://card-conv1/meta/%E5%8D%A1%E7%89%87.yaml",
                session,
            )
            .expect("成员换算必须成功");
        assert_eq!(
            member,
            root.join("meta/卡片.yaml").to_string_lossy().as_ref()
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn test_local_path_of_and_managed_uri_of_path_are_inverse_roundtrip() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let root = temp_root("conv-round");
        std::fs::create_dir_all(root.join("sub dir")).expect("夹具目录必须可建");
        std::fs::write(root.join("sub dir/50%.md"), b"x").expect("夹具文件必须可写");
        let session = bound_document_scope(&manager, "card-conv2", Origin::Directory(root.clone()));
        let uri = "chips-resource://card-conv2/sub%20dir/50%25.md";
        let local = manager
            .local_path_of(uri, session)
            .expect("正向换算必须成功");
        assert!(local.ends_with("sub dir/50%.md"), "拼接形失准：{local}");
        // 回环：localPath → managedUri 与原受管引用逐字互逆（含 `%25` 字面
        // 百分号与 `%20` 空格的双向编码臂）。
        let back = manager
            .managed_uri_of_path(Path::new(&local), session)
            .expect("反向换算必须命中");
        assert_eq!(back, uri, "两向互逆锁");
        // 基址回环：包根目录本身反查回作用域基址形。
        let base_back = manager
            .managed_uri_of_path(root.as_path(), session)
            .expect("包根反查必须命中");
        assert_eq!(base_back, "chips-resource://card-conv2/");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn test_local_path_of_archive_returns_archive_file() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let root = temp_root("conv-arch");
        let archive = root.join("package.card");
        std::fs::write(&archive, b"not-a-zip-but-registered-origin").expect("夹具归档必须可写");
        let session =
            bound_document_scope(&manager, "card-conv3", Origin::Archive(archive.clone()));
        // 归档态：成员 URI 与基址形都回归档文件路径（成员经 §6.2 既有读组合承载）。
        for uri in [
            "chips-resource://card-conv3/",
            "chips-resource://card-conv3/meta.yaml",
        ] {
            let local = manager
                .local_path_of(uri, session)
                .expect("归档换算必须成功");
            assert_eq!(local, archive.to_string_lossy().as_ref(), "{uri} 归档臂");
        }
        // 反查：归档文件路径命中作用域基址形；成员相对段无本地可反查形。
        let back = manager
            .managed_uri_of_path(archive.as_path(), session)
            .expect("归档反查必须命中");
        assert_eq!(back, "chips-resource://card-conv3/");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn test_local_path_of_uri_arms_use_registered_codes() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let root = temp_root("conv-neg");
        let session = bound_document_scope(&manager, "card-conv4", Origin::Directory(root.clone()));
        // `file://` 在资源核心维持拒收（《06》§2.2，归一责任在文档侧零移动）。
        let error = manager
            .local_path_of("file:///tmp/whatever", session)
            .expect_err("file:// 必须拒收");
        assert_eq!(error.code(), crate::error::RESOURCE_UNSUPPORTED_SCHEME);
        // 裸 http(s) 归一产物在换算面同样按 scheme 非受管拒绝（RFC §6.1 两码口径）。
        for bare in ["http://host/a", "https://host/a", "webdav://host/a"] {
            let error = manager
                .local_path_of(bare, session)
                .expect_err("非受管 scheme 必须拒绝：{bare}");
            assert_eq!(error.code(), crate::error::RESOURCE_UNSUPPORTED_SCHEME);
        }
        // 语法非法走 `resolve_input` 既有判定（无 scheme 输入按 INVALID_URI 归位）。
        let error = manager
            .local_path_of("card-conv4/meta.yaml", session)
            .expect_err("无 scheme 输入必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_INVALID_URI);
        // 目录穿越段维持 PathGuard 在册拒绝形（零第二套校验）。
        let error = manager
            .local_path_of("chips-resource://card-conv4/../escape", session)
            .expect_err("越根段必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_PATH_INVALID);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn test_local_path_of_permission_and_not_found_arms() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let root = temp_root("conv-gate");
        let owner_session =
            bound_document_scope(&manager, "card-conv5", Origin::Directory(root.clone()));
        let uri = "chips-resource://card-conv5/a.txt";
        assert!(manager.local_path_of(uri, owner_session).is_ok());
        // 越权：会话在册但未绑定该作用域 → 在册拒绝形，details 零路径泄漏。
        let stranger = writer_session(&manager, &[]);
        let error = manager
            .local_path_of(uri, stranger)
            .expect_err("未绑定会话必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
        let details = error.details().expect("拒绝必携在册 details");
        assert_eq!(details["reason"], "out_of_scope");
        assert_eq!(details["target"], "chips-resource://card-conv5/");
        assert!(
            !details
                .to_string()
                .contains(root.to_string_lossy().as_ref()),
            "拒绝回执不得泄露真实路径"
        );
        // 会话不在册 → 同形活体闸。
        let error = manager
            .local_path_of(uri, 987_654)
            .expect_err("不在册会话必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
        // 陈旧绑定：绑定集在册但注册表已无该项 → RESOURCE_NOT_FOUND（查找臂）。
        let ghost_session = writer_session(&manager, &["card-ghost"]);
        let error = manager
            .local_path_of("chips-resource://card-ghost/x.txt", ghost_session)
            .expect_err("陈旧绑定必须按未注册收口");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn test_local_path_of_non_local_origin_is_not_supported() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        // Memory Origin 夹具改走 Memory 种籍合法形（注册闸 kind-origin 配对在册，
        // 换算臂拒绝的正是「Origin 无本地可读位置」这一事实本身，与种籍无关）。
        manager
            .register_scope(ScopeRegistration {
                scope: MEMORY_SCOPE.into(),
                kind: ScopeKind::Memory,
                owner: "chips.official.editor".into(),
                provider_id: "memory".into(),
                origin: Origin::Memory,
                policy: ScopePolicy {
                    read_only: false,
                    max_resource_bytes: 1024,
                    allowed_hosts: Vec::new(),
                },
            })
            .expect("Memory 夹具注册必须成功");
        let session = writer_session(&manager, &["memory"]);
        let error = manager
            .local_path_of("chips-resource://memory/x", session)
            .expect_err("Memory Origin 无本地可读位置");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
        // 操作词表六词封闭（《06》§7.3），换算臂就近归入 `list`（在册判例族，
        // 波 B 交回口径复核）——禁新词锁即此断言。
        assert_eq!(error.details().unwrap()["operation"], "list");
        // Platform Origin 同臂。
        manager
            .register_scope(ScopeRegistration {
                scope: PLATFORM_SCOPE.into(),
                kind: ScopeKind::Platform,
                owner: "chips.official.editor".into(),
                provider_id: "platform".into(),
                origin: Origin::Platform("embedded/icon.png".into()),
                policy: ScopePolicy {
                    read_only: true,
                    max_resource_bytes: 1024,
                    allowed_hosts: Vec::new(),
                },
            })
            .expect("Platform 形夹具注册必须成功");
        manager
            .attach_scope(session, &"platform".to_owned())
            .expect("夹具绑定必须成功");
        let error = manager
            .local_path_of("chips-resource://platform/", session)
            .expect_err("Platform Origin 无本地可读位置");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
    }

    #[test]
    fn test_managed_uri_of_path_negative_classes_are_null_and_leak_free() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let root = temp_root("conv-rev");
        std::fs::create_dir_all(root.join("inner")).expect("夹具目录必须可建");
        let outsider = temp_root("conv-out");
        std::fs::write(outsider.join("private.txt"), b"x").expect("夹具文件必须可写");
        let session = bound_document_scope(&manager, "card-conv7", Origin::Directory(root.clone()));
        // 不存在：路径不在盘上 → null（与「未绑定」同臂，零存在性泄露）。
        assert_eq!(
            manager.managed_uri_of_path(&root.join("nope.txt"), session),
            None
        );
        // 未挂载：路径在盘上但会话绑定集无覆盖 Origin → null。
        assert_eq!(
            manager.managed_uri_of_path(outsider.join("private.txt").as_path(), session),
            None
        );
        // 越权：作用域注册于他会话——本会话反查同一路径不得命中（不泄露他会话作用域）。
        let other_root = temp_root("conv-other");
        manager
            .register_scope(ScopeRegistration {
                scope: "card-secret".into(),
                kind: ScopeKind::Document,
                owner: "chips.official.editor".into(),
                provider_id: "directory".into(),
                origin: Origin::Directory(other_root.clone()),
                policy: ScopePolicy {
                    read_only: false,
                    max_resource_bytes: 1024,
                    allowed_hosts: Vec::new(),
                },
            })
            .expect("他会话夹具注册必须成功");
        assert_eq!(
            manager.managed_uri_of_path(other_root.as_path(), session),
            None
        );
        // 会话不在册 / 空绑定集 → null。
        assert_eq!(manager.managed_uri_of_path(root.as_path(), 4242), None);
        let unbound = writer_session(&manager, &[]);
        assert_eq!(manager.managed_uri_of_path(root.as_path(), unbound), None);
        // 陈旧：注销后级联脱绑，原路径反查回 null。
        manager
            .unregister_scope(&"card-conv7".to_owned())
            .expect("注销必须成功");
        assert_eq!(manager.managed_uri_of_path(root.as_path(), session), None);
        let error = manager
            .local_path_of("chips-resource://card-conv7/", session)
            .expect_err("注销后正向命中绑定闸（绑定形）");
        assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
        let _ = std::fs::remove_dir_all(root);
        let _ = std::fs::remove_dir_all(outsider);
        let _ = std::fs::remove_dir_all(other_root);
    }

    #[test]
    fn test_managed_uri_of_path_longest_prefix_and_temp_scope_tie() {
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let outer = temp_root("conv-long");
        let inner = outer.join("nested");
        std::fs::create_dir_all(&inner).expect("夹具目录必须可建");
        std::fs::write(inner.join("leaf.md"), b"x").expect("夹具文件必须可写");
        // 同会话三层绑定：外层 workspace、内层 temp-*、最深 card-*——最长前缀胜出。
        let session =
            bound_document_scope(&manager, "card-deepest", Origin::Directory(inner.clone()));
        manager
            .register_scope(ScopeRegistration {
                scope: "temp-9".into(),
                kind: ScopeKind::Temporary,
                owner: TEMP_SCOPE_OWNER.into(),
                provider_id: "directory".into(),
                origin: Origin::Directory(outer.clone()),
                policy: ScopePolicy {
                    read_only: false,
                    max_resource_bytes: 1024,
                    allowed_hosts: Vec::new(),
                },
            })
            .expect("temp 夹具注册必须成功");
        manager
            .attach_scope(session, &"temp-9".to_owned())
            .expect("temp 绑定必须成功");
        let leaf = inner.join("leaf.md");
        let hit = manager
            .managed_uri_of_path(leaf.as_path(), session)
            .expect("最深作用域必须命中");
        assert_eq!(hit, "chips-resource://card-deepest/leaf.md");
        // outer 之下、inner 之外的路径落 temp-* 覆盖集（反向查询含 temp-* 在册）。
        std::fs::write(outer.join("top.txt"), b"x").expect("夹具文件必须可写");
        let hit = manager
            .managed_uri_of_path(outer.join("top.txt").as_path(), session)
            .expect("temp 覆盖必须命中");
        assert_eq!(hit, "chips-resource://temp-9/top.txt");
        // 同根双登记等深平局：快照升序取先，确定性锁（口径候主裁复核，波 B 交回项）。
        let twin_root = temp_root("conv-twin");
        std::fs::write(twin_root.join("dup.md"), b"x").expect("夹具文件必须可写");
        for scope in ["card-zeta", "card-alpha"] {
            manager
                .register_scope(ScopeRegistration {
                    scope: scope.into(),
                    kind: ScopeKind::Document,
                    owner: "chips.official.editor".into(),
                    provider_id: "directory".into(),
                    origin: Origin::Directory(twin_root.clone()),
                    policy: ScopePolicy {
                        read_only: false,
                        max_resource_bytes: 1024,
                        allowed_hosts: Vec::new(),
                    },
                })
                .expect("双登记夹具注册必须成功");
            manager
                .attach_scope(session, &scope.to_owned())
                .expect("双登记绑定必须成功");
        }
        let hit = manager
            .managed_uri_of_path(twin_root.join("dup.md").as_path(), session)
            .expect("同根双登记必须命中");
        assert_eq!(
            hit, "chips-resource://card-alpha/dup.md",
            "等深平局必须按 scope 升序取先（确定性裁决锁）"
        );
        let _ = std::fs::remove_dir_all(outer);
        let _ = std::fs::remove_dir_all(twin_root);
    }

    #[test]
    fn test_local_path_of_mounted_directory_chain_matches_provider_root() {
        // 挂载链形态（非直注册夹具）：`mount_directory` 成功后正向换算与
        // `attach_root` 规范化同源——symlink 段经 `resolve_within_root` 根内复检。
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let session = writer_session(&manager, &[]);
        let root = temp_root("conv-mount");
        std::fs::create_dir_all(root.join("deep")).expect("夹具目录必须可建");
        std::fs::write(root.join("deep/file.bin"), b"x").expect("夹具文件必须可写");
        manager
            .mount_directory(
                session,
                directory_registration("card-mount1", ScopeKind::Document, root.clone(), false),
            )
            .expect("挂载必须成功");
        let local = manager
            .local_path_of("chips-resource://card-mount1/deep/file.bin", session)
            .expect("挂载链换算必须成功");
        assert_eq!(local, root.join("deep/file.bin").to_string_lossy().as_ref());
        let back = manager
            .managed_uri_of_path(Path::new(&local), session)
            .expect("挂载链反查必须命中");
        assert_eq!(back, "chips-resource://card-mount1/deep/file.bin");
        let _ = std::fs::remove_dir_all(root);
    }
}
