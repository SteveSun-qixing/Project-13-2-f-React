//! `ResourceManager`：解析流水线与句柄生命周期的管理器侧门面
//! （《04-资源管理设计》§5.1、§11.1，《03-核心接口规范》§7.1）。
//!
//! 段一交付：URI 语法 → 作用域查找 → PathGuard → 会话与权限判定的完整
//! 流水线（[`ResourceManager::resolve`]），以及句柄 `open` / `stat` /
//! `read_range` / `read_chunk` / `release` 三态状态机、会话与作用域级联。
//! 缓存、写入提交与文件系统挂载属段二/三，本段不挂载对应入口。
//!
//! 错误口径：同步判定入口返回强类型 [`ResourceError`]；异步入口（会触达
//! Provider）以跨边界统一单形 `ChipsError` 收口，错误码保持《06》§7.2 在册
//! 值原样上抛——管理器不改写、不折算 Provider 的错误码。

use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Mutex};

use chips_core::{ChipsError, HandleId, PluginId, SessionId};

use crate::constants::ResourceLimits;
use crate::error::{InvalidateReason, ResourceError, ResourceResult};
use crate::handle::{HandleEntry, HandleTable, StreamSlot};
use crate::permission::{PermissionChecker, ResourceOperation};
use crate::provider::{ByteRange, ResourceAddress, ResourceMetadata, ResourceProvider};
use crate::scope::{ScopeId, ScopeKind, ScopeRegistration, ScopeRegistry};
use crate::session::{ResourceSession, SessionKind, SessionRegistry};
use crate::uri::{resolve_input, CanonicalUri, ExternalOrigin};

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

/// 资源管理器（《04》§11.1 核心结构；段一不含 CacheStore/SingleFlight/
/// WriteCoordinator）。
#[derive(Debug)]
pub struct ResourceManager {
    limits: ResourceLimits,
    scopes: Arc<ScopeRegistry>,
    sessions: Arc<SessionRegistry>,
    providers: Arc<ProviderRegistry>,
    handles: Arc<HandleTable>,
}

impl Default for ResourceManager {
    fn default() -> Self {
        Self::new(ResourceLimits::default())
    }
}

impl ResourceManager {
    /// 以限额构造管理器。
    #[must_use]
    pub fn new(limits: ResourceLimits) -> Self {
        let handles = HandleTable::new(limits.max_handles_per_plugin, limits.max_handles_total);
        Self {
            limits,
            scopes: Arc::new(ScopeRegistry::new()),
            sessions: Arc::new(SessionRegistry::new()),
            providers: Arc::new(ProviderRegistry::default()),
            handles: Arc::new(handles),
        }
    }

    /// 限额快照。
    #[must_use]
    pub fn limits(&self) -> &ResourceLimits {
        &self.limits
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

    /// 注销作用域：级联失效并释放其全部句柄、终止流（《06》§3.2 注销级联）。
    pub fn unregister_scope(&self, scope: &ScopeId) -> ResourceResult<()> {
        self.scopes.unregister(scope)?;
        self.sessions.detach_scope(scope);
        self.handles
            .invalidate_and_release_where(InvalidateReason::ScopeRevoked, |entry: &HandleEntry| {
                &entry.scope == scope
            });
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

    /// 关闭会话并级联归还全部租约（句柄失效并释放，《04》§10.1）。
    pub fn close_session(&self, session: SessionId) -> ResourceResult<()> {
        let closed = self.sessions.close_session(session)?;
        let closed_ids: BTreeSet<SessionId> = closed.iter().map(|record| record.id).collect();
        self.handles.invalidate_and_release_where(
            InvalidateReason::SessionClosed,
            |entry: &HandleEntry| closed_ids.contains(&entry.session),
        );
        Ok(())
    }

    /// 失效作用域全部句柄（`source-changed` 等；句柄保留至显式释放，
    /// 后续读返回 `RESOURCE_HANDLE_INVALIDATED`）。
    pub fn invalidate_scope(&self, scope: &ScopeId, reason: InvalidateReason) {
        self.handles
            .invalidate_where(reason, |entry: &HandleEntry| &entry.scope == scope);
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
        // 4. 会话与权限判定（失败：PERMISSION_DENIED）。
        PermissionChecker::new(
            &session_record.owner,
            &session_record,
            &registration,
            operation,
            &session_record.permissions,
            uri.external.as_ref(),
        )
        .decide()
        .into_result()?;
        // 5. Provider 选择与地址构建。
        let path = uri.path.clone().ok_or_else(|| ResourceError::NotFound {
            uri: uri.to_canonical_string(),
        })?;
        let address = ResourceAddress {
            scope: registration.scope.clone(),
            path,
            uri: uri.to_canonical_string(),
        };
        Ok(ResolvedResource {
            uri,
            registration,
            session: session_record,
            address,
        })
    }

    /// 解析、权限判定与打开（《03》§7.1 `open`）：通过后分配句柄并登记租约。
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
        Ok(OpenHandle {
            id,
            metadata: metadata_view(&resolved.address.uri, resolved.registration.kind, metadata),
        })
    }

    /// 读元数据（《03》§7.1 `stat`）。
    pub async fn stat(&self, handle: HandleId) -> ManagerResult<ResourceMetadata> {
        let (address, provider_id, kind) = self.handles.acquire_for_read(handle)?;
        let provider = self
            .providers
            .lookup(&provider_id)
            .ok_or(ResourceError::Internal)?;
        let metadata = provider.stat(&address).await?;
        self.handles.touch(handle, 0);
        Ok(metadata_view(&address.uri, kind, metadata))
    }

    /// 范围读（与流互斥，《03》§7.1 `read_range`，《06》§6.6）。
    pub async fn read_range(&self, handle: HandleId, range: ByteRange) -> ManagerResult<Vec<u8>> {
        let (address, provider_id) = self.handles.acquire_for_range_read(handle)?;
        if let Some(length) = range.length {
            check_size(&address.uri, self.limits.max_resource_bytes, length)?;
        }
        let provider = self
            .providers
            .lookup(&provider_id)
            .ok_or(ResourceError::Internal)?;
        let bytes = provider.read_range(&address, range).await?;
        self.handles.touch(handle, bytes.len() as u64);
        Ok(bytes)
    }

    /// 流式拉取（《03》§7.1 `read_chunk`）：首次调用打开游标；单次上限
    /// `chunk_bytes`；返回 `None` 表示结尾并释放流槽位。
    pub async fn read_chunk(
        &self,
        handle: HandleId,
        max_bytes: usize,
    ) -> ManagerResult<Option<Vec<u8>>> {
        let max_bytes = max_bytes.min(self.limits.chunk_bytes);
        let mut stream = match self.handles.begin_stream(handle)? {
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

    /// 释放句柄与租约；幂等（《03》§7.1 `release`）。
    pub fn release(&self, handle: HandleId) -> ResourceResult<()> {
        self.handles.release(handle)
    }
}

/// External 作用域固定由 `http` / `webdav` Provider 承载（段二挂载实现）。
fn external_provider_id(uri: &CanonicalUri) -> &'static str {
    match uri.external.as_ref().map(|origin| origin.scheme.as_str()) {
        Some("webdav") => "webdav",
        _ => "http",
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

    use crate::provider::{DirectoryEntry, FileMetadata, ResourceStream};
    use crate::scope::{Origin, ScopePolicy};

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
        let manager = ResourceManager::default();
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
        manager.release(handle.id).unwrap();
        assert!(manager.handles().is_empty());
        let error = manager.stat(handle.id).await.expect_err("陈旧句柄必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_HANDLE_RELEASED);
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
        let manager = ResourceManager::default();
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
            .read_chunk(handle.id, 4)
            .await
            .expect("流首块")
            .expect("非结尾");
        assert_eq!(first, b"0123".to_vec());
        let error = manager
            .read_range(
                handle.id,
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
            .read_chunk(handle.id, 8)
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
            .read_chunk(child_handle.id, 4)
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
            .stat(handle.id)
            .await
            .expect_err("失效句柄读取必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_HANDLE_INVALIDATED);
        assert_eq!(error.details().unwrap()["reason"], "source-changed");
        assert_eq!(open_handle_count(&manager), 1, "失效不归还租约");
        manager.release(handle.id).unwrap();
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
        let manager = ResourceManager::default();
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
}
