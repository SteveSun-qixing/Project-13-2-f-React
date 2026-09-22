//! 资源句柄与租约状态机（《04-资源管理设计》§4.2、§4.6，
//! 《06-资源协议规范》§6）。
//!
//! 三态：`open → released`（终态、句柄 ID 永不复用）、`open → invalidated →
//! released`；非法迁移一律拒绝。每个句柄归属一个资源会话并持有租约；会话
//! 关闭级联归还全部租约。读操作按状态返回 `RESOURCE_HANDLE_RELEASED` /
//! `RESOURCE_HANDLE_INVALIDATED`；`release()` 幂等。
//!
//! 会话归属闸（工单043 巡检分件 §一.1 N-1 判据，《04》§11.1，《03》§7.1）：
//! `acquire_for_read` / `acquire_for_range_read` / `begin_stream` /
//! `release_for_session` 四个准入入口在状态闸之后强制比对
//! `entry.session == caller_session`，异值以在册拒绝形
//! `RESOURCE_PERMISSION_DENIED`（`permission: "session"`、
//! `reason: out_of_scope`，与 `resolve` 会话未知臂同形）拒绝；句柄 ID 为
//! 单调递增整数而非不可猜 token，归属比对在核心层构成硬闸，任何持有
//! `HandleId` 的调用方都不能跨会话读写或释放他会话句柄。级联面
//! （`invalidate_and_release_where` → `release`）是核心自持的无调用方
//! 通道，不经归属闸。

use std::collections::{BTreeMap, BTreeSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use chips_core::{HandleId, PluginId, SessionId};

use crate::error::{HandleState, InvalidateReason, PoolKind, ResourceError, ResourceResult};
use crate::provider::{ResourceAddress, ResourceStream};
use crate::scope::{ScopeId, ScopeKind};
use crate::session::MAX_JS_SAFE_ID;

/// 租约失效订阅回调。
pub type InvalidateListener = Arc<dyn Fn(InvalidateReason) + Send + Sync>;

/// 流槽位准入结果（《04》§3.2 游标生命周期，《06》§6.6 互斥）。
pub enum StreamSlot {
    /// 首次开流：调用方须打开底层游标并经 `store_stream` 归位。
    FirstOpen {
        /// 资源地址快照。
        address: ResourceAddress,
        /// 承载 Provider。
        provider_id: String,
    },
    /// 续用已开游标。
    Reuse {
        /// 取出的游标。
        stream: Box<dyn ResourceStream>,
        /// 资源地址快照。
        address: ResourceAddress,
        /// 承载 Provider。
        provider_id: String,
    },
}

impl std::fmt::Debug for StreamSlot {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::FirstOpen {
                address,
                provider_id,
            } => formatter
                .debug_struct("FirstOpen")
                .field("address", address)
                .field("provider_id", provider_id)
                .finish(),
            Self::Reuse {
                address,
                provider_id,
                ..
            } => formatter
                .debug_struct("Reuse")
                .field("address", address)
                .field("provider_id", provider_id)
                .finish(),
        }
    }
}

/// 句柄表条目（《04》§4.6 `HandleEntry` + 流游标与订阅者）。
pub struct HandleEntry {
    /// 句柄 ID。
    pub id: HandleId,
    /// 代次校验位（防旧 ID 误命中，《04》§4.6）。
    pub generation: u64,
    /// 资源地址。
    pub address: ResourceAddress,
    /// 归属会话。
    pub session: SessionId,
    /// 归属插件（会话所有者）。
    pub owner: PluginId,
    /// 承载 Provider。
    pub provider_id: String,
    /// 当前状态。
    pub state: HandleState,
    /// 创建时刻。
    pub created_at: Instant,
    /// 最近成功使用时刻（租约延续，《06》§6.3）。
    pub last_used_at: Instant,
    /// 累计读取字节。
    pub bytes_read: u64,
    /// 承载作用域 ID（注销级联定位）。
    pub scope: ScopeId,
    /// 承载作用域种类（元数据视图定值）。
    pub scope_kind: ScopeKind,
    /// 失效原因（`invalidated` 态在册）
    pub invalidate_reason: Option<InvalidateReason>,
    pub(crate) stream: Option<Box<dyn ResourceStream>>,
    pub(crate) stream_open: bool,
    listeners: Vec<InvalidateListener>,
}

impl std::fmt::Debug for HandleEntry {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("HandleEntry")
            .field("id", &self.id)
            .field("generation", &self.generation)
            .field("address", &self.address)
            .field("session", &self.session)
            .field("owner", &self.owner)
            .field("provider_id", &self.provider_id)
            .field("state", &self.state)
            .field("bytes_read", &self.bytes_read)
            .field("scope", &self.scope)
            .field("scope_kind", &self.scope_kind)
            .field("invalidate_reason", &self.invalidate_reason)
            .field("stream_open", &self.stream_open)
            .finish_non_exhaustive()
    }
}

/// 已释放句柄墓碑：保持状态可查询且 ID 永不复用（《04》§4.2）。
#[derive(Debug, Clone)]
struct ReleasedTombstone {
    uri: String,
    generation: u64,
}

#[derive(Debug, Default)]
struct HandleTableState {
    entries: BTreeMap<HandleId, HandleEntry>,
    tombstones: BTreeMap<HandleId, ReleasedTombstone>,
    handles_per_plugin: BTreeMap<PluginId, usize>,
}

/// 句柄表：分配、状态迁移、租约归属与池上限。
#[derive(Debug, Default)]
pub struct HandleTable {
    state: Mutex<HandleTableState>,
    next_id: AtomicU64,
    max_per_plugin: usize,
    max_total: usize,
}

impl HandleTable {
    /// 以池上限构造。
    #[must_use]
    pub fn new(max_per_plugin: usize, max_total: usize) -> Self {
        Self {
            state: Mutex::new(HandleTableState::default()),
            next_id: AtomicU64::new(0),
            max_per_plugin,
            max_total,
        }
    }

    fn allocate_id(&self) -> ResourceResult<HandleId> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        if id > MAX_JS_SAFE_ID {
            return Err(ResourceError::Internal);
        }
        Ok(id)
    }

    /// 登记新句柄（`open` 态）；池超限返回 `RESOURCE_POOL_EXHAUSTED`。
    pub fn insert(
        &self,
        address: ResourceAddress,
        session: SessionId,
        owner: PluginId,
        provider_id: String,
        scope: ScopeId,
        scope_kind: ScopeKind,
    ) -> ResourceResult<HandleId> {
        let id = self.allocate_id()?;
        let mut state = self.state.lock().expect("句柄表锁不得中毒");
        if state.entries.len() >= self.max_total {
            return Err(ResourceError::PoolExhausted {
                kind: PoolKind::Handles,
                limit: self.max_total,
            });
        }
        let per_plugin = state.handles_per_plugin.entry(owner.clone()).or_insert(0);
        if *per_plugin >= self.max_per_plugin {
            return Err(ResourceError::PoolExhausted {
                kind: PoolKind::Handles,
                limit: self.max_per_plugin,
            });
        }
        *per_plugin += 1;
        let generation = id;
        state.entries.insert(
            id,
            HandleEntry {
                id,
                generation,
                address,
                session,
                owner,
                provider_id,
                state: HandleState::Open,
                created_at: Instant::now(),
                last_used_at: Instant::now(),
                bytes_read: 0,
                scope,
                scope_kind,
                invalidate_reason: None,
                stream: None,
                stream_open: false,
                listeners: Vec::new(),
            },
        );
        Ok(id)
    }

    /// 当前状态（未知 ID 视为已释放终态之外的陈旧命中：返回 `None`）。
    #[must_use]
    pub fn state_of(&self, id: HandleId) -> Option<HandleState> {
        let state = self.state.lock().expect("句柄表锁不得中毒");
        state
            .entries
            .get(&id)
            .map(|entry| entry.state)
            .or_else(|| state.tombstones.get(&id).map(|_| HandleState::Released))
    }

    /// 读操作准入：仅 `open` 态且归属会话匹配放行；其余按状态与归属返回
    /// 在册错误（跨会话 → `RESOURCE_PERMISSION_DENIED`，N-1 归属闸）。
    ///
    /// 返回 `(address, provider_id, scope_kind)` 快照供锁外异步读取。
    pub fn acquire_for_read(
        &self,
        id: HandleId,
        session: SessionId,
    ) -> ResourceResult<(ResourceAddress, String, ScopeKind)> {
        let state = self.state.lock().expect("句柄表锁不得中毒");
        let entry = state
            .entries
            .get(&id)
            .ok_or_else(|| ResourceError::HandleReleased {
                uri: state
                    .tombstones
                    .get(&id)
                    .map_or_else(String::new, |tombstone| tombstone.uri.clone()),
            })?;
        Self::require_open(entry)?;
        Self::require_session(entry, session)?;
        Ok((
            entry.address.clone(),
            entry.provider_id.clone(),
            entry.scope_kind,
        ))
    }

    /// 记录成功使用：刷新 `last_used_at` 并累计字节（租约延续，《06》§6.3）。
    pub fn touch(&self, id: HandleId, bytes_read: u64) {
        let mut state = self.state.lock().expect("句柄表锁不得中毒");
        if let Some(entry) = state.entries.get_mut(&id) {
            entry.last_used_at = Instant::now();
            entry.bytes_read += bytes_read;
        }
    }

    /// 流式读取准入：首次占槽（`FirstOpen`）、续用取回游标（`Reuse`）；
    /// 游标在途（已借出未归位）时返回 `RESOURCE_BUSY`；跨会话调用返回
    /// `RESOURCE_PERMISSION_DENIED`（N-1 归属闸）。
    pub fn begin_stream(&self, id: HandleId, session: SessionId) -> ResourceResult<StreamSlot> {
        let mut state = self.state.lock().expect("句柄表锁不得中毒");
        if !state.entries.contains_key(&id) {
            return Err(ResourceError::HandleReleased {
                uri: state
                    .tombstones
                    .get(&id)
                    .map_or_else(String::new, |tombstone| tombstone.uri.clone()),
            });
        }
        let entry = state.entries.get_mut(&id).expect("上一步已确认在册");
        Self::require_open(entry)?;
        Self::require_session(entry, session)?;
        let address = entry.address.clone();
        let provider_id = entry.provider_id.clone();
        if let Some(stream) = entry.stream.take() {
            return Ok(StreamSlot::Reuse {
                stream,
                address,
                provider_id,
            });
        }
        if entry.stream_open {
            return Err(ResourceError::Busy {
                uri: address.uri.clone(),
            });
        }
        entry.stream_open = true;
        Ok(StreamSlot::FirstOpen {
            address,
            provider_id,
        })
    }

    /// 范围读准入：流占用期间返回 `RESOURCE_BUSY`（《06》§6.6 互斥）；
    /// 跨会话调用返回 `RESOURCE_PERMISSION_DENIED`（N-1 归属闸）。
    pub fn acquire_for_range_read(
        &self,
        id: HandleId,
        session: SessionId,
    ) -> ResourceResult<(ResourceAddress, String)> {
        let state = self.state.lock().expect("句柄表锁不得中毒");
        let entry = state
            .entries
            .get(&id)
            .ok_or_else(|| ResourceError::HandleReleased {
                uri: state
                    .tombstones
                    .get(&id)
                    .map_or_else(String::new, |tombstone| tombstone.uri.clone()),
            })?;
        let uri = entry.address.uri.clone();
        match entry.state {
            HandleState::Open => {}
            HandleState::Invalidated => {
                return Err(ResourceError::HandleInvalidated {
                    uri,
                    reason: entry
                        .invalidate_reason
                        .unwrap_or(InvalidateReason::ScopeRevoked),
                })
            }
            HandleState::Released => return Err(ResourceError::HandleReleased { uri }),
        }
        Self::require_session(entry, session)?;
        if entry.stream_open {
            return Err(ResourceError::Busy { uri });
        }
        Ok((entry.address.clone(), entry.provider_id.clone()))
    }

    /// 归位流游标；`None` 结果时关闭槽位（结尾即释放互斥）。
    pub fn store_stream(&self, id: HandleId, stream: Option<Box<dyn ResourceStream>>) {
        let mut state = self.state.lock().expect("句柄表锁不得中毒");
        if let Some(entry) = state.entries.get_mut(&id) {
            let closed_at_eof = stream.is_none();
            entry.stream = stream;
            if closed_at_eof {
                entry.stream_open = false;
            }
        }
    }

    fn require_open(entry: &HandleEntry) -> ResourceResult<()> {
        match entry.state {
            HandleState::Open => Ok(()),
            HandleState::Invalidated => Err(ResourceError::HandleInvalidated {
                uri: entry.address.uri.clone(),
                reason: entry
                    .invalidate_reason
                    .unwrap_or(InvalidateReason::ScopeRevoked),
            }),
            HandleState::Released => Err(ResourceError::HandleReleased {
                uri: entry.address.uri.clone(),
            }),
        }
    }

    /// 会话归属闸（N-1 判据）：句柄登记时刻固化的归属会话（打开路径
    /// `insert` 写入）必须与调用方会话一致；异值以在册拒绝形
    /// `RESOURCE_PERMISSION_DENIED` 收口（`permission: "session"`、
    /// `reason: out_of_scope`，与 `resolve` 会话未知臂同形）。
    fn require_session(entry: &HandleEntry, session: SessionId) -> ResourceResult<()> {
        if entry.session == session {
            return Ok(());
        }
        Err(ResourceError::PermissionDenied {
            target: entry.address.uri.clone(),
            permission: "session".to_owned(),
            required: Vec::new(),
            missing: Vec::new(),
            granted: Vec::new(),
            reason: crate::error::PermissionDenyReason::OutOfScope,
        })
    }

    /// 带归属闸的释放：在途句柄要求调用方会话与在册归属一致（N-1），
    /// 跨会话拒绝且句柄保持原状；未在册（已释放墓碑与从未在册陈旧 ID）
    /// 维持幂等 no-op 口径。
    pub fn release_for_session(&self, id: HandleId, session: SessionId) -> ResourceResult<()> {
        let state = self.state.lock().expect("句柄表锁不得中毒");
        if let Some(entry) = state.entries.get(&id) {
            Self::require_session(entry, session)?;
        }
        drop(state);
        self.release(id)
    }

    /// 失效迁移：`open → invalidated`（非法态幂等跳过），并通知订阅者。
    ///
    /// 返回被失效的句柄 ID 集合。
    pub fn invalidate_where<F>(&self, reason: InvalidateReason, matches: F) -> BTreeSet<HandleId>
    where
        F: Fn(&HandleEntry) -> bool,
    {
        let mut state = self.state.lock().expect("句柄表锁不得中毒");
        let mut affected = BTreeSet::new();
        let mut notifications: Vec<Vec<InvalidateListener>> = Vec::new();
        for entry in state.entries.values_mut() {
            if entry.state == HandleState::Open && matches(entry) {
                entry.state = HandleState::Invalidated;
                entry.invalidate_reason = Some(reason);
                entry.stream = None;
                entry.stream_open = false;
                affected.insert(entry.id);
                notifications.push(entry.listeners.clone());
            }
        }
        drop(state);
        for listeners in notifications {
            for listener in listeners {
                listener(reason);
            }
        }
        affected
    }

    /// 失效并释放（`document:closed` / 插件卸载 / 作用域注销级联）：先通知
    /// 订阅者，再归还租约并移除。
    pub fn invalidate_and_release_where<F>(
        &self,
        reason: InvalidateReason,
        matches: F,
    ) -> Vec<HandleId>
    where
        F: Fn(&HandleEntry) -> bool + Copy,
    {
        let affected = self.invalidate_where(reason, matches);
        let mut released = Vec::new();
        for id in affected {
            if self.release(id).is_ok() {
                released.push(id);
            }
        }
        released
    }

    /// 释放句柄：`open` / `invalidated` → `released`；幂等，重复释放为
    /// no-op。核心自持的无调用方通道（级联回收与 `release_for_session`
    /// 闸后转发）；带调用方会话的释放必须走 [`Self::release_for_session`]。
    pub fn release(&self, id: HandleId) -> ResourceResult<()> {
        let mut state = self.state.lock().expect("句柄表锁不得中毒");
        let Some(entry) = state.entries.remove(&id) else {
            // 幂等：已释放（墓碑在册）与从未在册的陈旧 ID 都是 no-op。
            return Ok(());
        };
        state.tombstones.insert(
            id,
            ReleasedTombstone {
                uri: entry.address.uri.clone(),
                generation: entry.generation,
            },
        );
        if let Some(count) = state.handles_per_plugin.get_mut(&entry.owner) {
            *count = count.saturating_sub(1);
        }
        Ok(())
    }

    /// 订阅句柄失效；句柄已失效时立即回调一次并携带原因（《06》§6.4）。
    pub fn subscribe_invalidate(
        &self,
        id: HandleId,
        listener: InvalidateListener,
    ) -> Option<InvalidateReason> {
        let mut state = self.state.lock().expect("句柄表锁不得中毒");
        let entry = state.entries.get_mut(&id)?;
        if entry.state == HandleState::Invalidated {
            entry.listeners.push(listener.clone());
            // 已失效后注册：立即回调在册原因（调用方在锁外执行回调由订阅者自持）。
            return Some(
                entry
                    .invalidate_reason
                    .unwrap_or(InvalidateReason::ScopeRevoked),
            );
        }
        entry.listeners.push(listener);
        None
    }

    /// 在途句柄快照（测试与泄漏审计用；断言表空即泄漏检测，《04》§10.3）。
    #[must_use]
    pub fn snapshot(&self) -> Vec<HandleEntrySnapshot> {
        let state = self.state.lock().expect("句柄表锁不得中毒");
        state
            .entries
            .values()
            .map(|entry| HandleEntrySnapshot {
                id: entry.id,
                uri: entry.address.uri.clone(),
                session: entry.session,
                owner: entry.owner.clone(),
                scope: entry.scope.clone(),
                state: entry.state,
                bytes_read: entry.bytes_read,
                stream_open: entry.stream_open,
            })
            .collect()
    }

    /// 已释放句柄的代次（《04》§4.6 代次校验：陈旧 ID 命中墓碑时可用于
    /// 区分「曾在本表的哪一代」；从未在册返回 `None`）。
    #[must_use]
    pub fn released_generation(&self, id: HandleId) -> Option<u64> {
        self.state
            .lock()
            .expect("句柄表锁不得中毒")
            .tombstones
            .get(&id)
            .map(|tombstone| tombstone.generation)
    }

    /// 在途句柄数。
    #[must_use]
    pub fn len(&self) -> usize {
        self.state.lock().expect("句柄表锁不得中毒").entries.len()
    }

    /// 是否无在途句柄。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// 句柄条目只读快照。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandleEntrySnapshot {
    /// 句柄 ID。
    pub id: HandleId,
    /// 规范 URI。
    pub uri: String,
    /// 归属会话。
    pub session: SessionId,
    /// 归属插件。
    pub owner: PluginId,
    /// 承载作用域。
    pub scope: ScopeId,
    /// 状态。
    pub state: HandleState,
    /// 累计读取字节。
    pub bytes_read: u64,
    /// 流槽位是否占用。
    pub stream_open: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::path_guard::VirtualPath;

    /// 立即 EOF 的游标替身。
    struct DoneStream;

    #[async_trait::async_trait]
    impl ResourceStream for DoneStream {
        async fn next_chunk(
            &mut self,
            _max_bytes: usize,
        ) -> Result<Option<Vec<u8>>, chips_core::ChipsError> {
            Ok(None)
        }
    }

    fn address(uri: &str) -> ResourceAddress {
        ResourceAddress {
            scope: "card-1".into(),
            path: VirtualPath::from_validated("a.png".into()),
            uri: uri.into(),
        }
    }

    fn table() -> HandleTable {
        HandleTable::new(2, 3)
    }

    fn try_insert(
        table: &HandleTable,
        session: SessionId,
        owner: &str,
    ) -> ResourceResult<HandleId> {
        table.insert(
            address("chips-resource://card-1/a.png"),
            session,
            owner.into(),
            "directory".into(),
            "card-1".into(),
            ScopeKind::Document,
        )
    }

    fn insert(table: &HandleTable, session: SessionId, owner: &str) -> HandleId {
        try_insert(table, session, owner).expect("登记句柄必须成功")
    }

    #[test]
    fn test_state_machine_transitions() {
        let table = table();
        let id = insert(&table, 1, "chips.a");
        assert_eq!(table.state_of(id), Some(HandleState::Open));
        table.invalidate_where(InvalidateReason::SourceChanged, |_| true);
        assert_eq!(table.state_of(id), Some(HandleState::Invalidated));
        table.release(id).expect("失效句柄仍可释放");
        assert_eq!(table.state_of(id), Some(HandleState::Released));
        assert!(table.release(id).is_ok(), "release 幂等");
        assert!(table.is_empty());
    }

    #[test]
    fn test_id_never_reused_and_monotonic() {
        let table = table();
        let first = insert(&table, 1, "chips.a");
        table.release(first).unwrap();
        let second = insert(&table, 1, "chips.a");
        assert!(second > first, "句柄 ID 单调递增且不复用");
        // 陈旧 ID 命中墓碑：返回已释放错误而非误中新句柄。
        let error = table
            .acquire_for_read(first, 1)
            .expect_err("陈旧 ID 必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_HANDLE_RELEASED);
    }

    #[test]
    fn test_invalidated_read_returns_invalidate_code() {
        let table = table();
        let id = insert(&table, 1, "chips.a");
        let notified = Arc::new(AtomicU64::new(0));
        let sink = Arc::clone(&notified);
        table.subscribe_invalidate(
            id,
            Arc::new(move |_| {
                sink.fetch_add(1, Ordering::Relaxed);
            }),
        );
        table.invalidate_where(InvalidateReason::SourceChanged, |_| true);
        assert_eq!(notified.load(Ordering::Relaxed), 1, "失效必须通知订阅者");
        let error = table
            .acquire_for_read(id, 1)
            .expect_err("失效句柄读必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_HANDLE_INVALIDATED);
        assert!(error.retryable());
        // 已失效后注册：立即回调。
        let late = Arc::new(AtomicU64::new(0));
        let late_sink = Arc::clone(&late);
        let immediate = table.subscribe_invalidate(
            id,
            Arc::new(move |_| {
                late_sink.fetch_add(1, Ordering::Relaxed);
            }),
        );
        assert_eq!(immediate, Some(InvalidateReason::SourceChanged));
    }

    #[test]
    fn test_pool_limits() {
        let table = table();
        let a1 = insert(&table, 1, "chips.a");
        let a2 = insert(&table, 2, "chips.a");
        let error = try_insert(&table, 3, "chips.a").expect_err("单插件 2 上限");
        assert_eq!(error.code(), crate::error::RESOURCE_POOL_EXHAUSTED);
        assert_eq!(error.details().unwrap()["kind"], "handles");
        assert_eq!(error.details().unwrap()["limit"], 2);
        let b1 = insert(&table, 4, "chips.b");
        let error = try_insert(&table, 5, "chips.c").expect_err("全局 3 上限");
        assert_eq!(error.code(), crate::error::RESOURCE_POOL_EXHAUSTED);
        table.release(a1).unwrap();
        table.release(a2).unwrap();
        table.release(b1).unwrap();
        try_insert(&table, 6, "chips.c").expect("释放后额度恢复");
    }

    #[test]
    fn test_stream_range_exclusivity() {
        let table = table();
        let id = insert(&table, 1, "chips.a");
        // 首次开流：占槽并返回 FirstOpen。
        match table.begin_stream(id, 1).expect("首次开流必须成功") {
            StreamSlot::FirstOpen { address, .. } => {
                assert_eq!(address.uri, "chips-resource://card-1/a.png");
            }
            StreamSlot::Reuse { .. } => panic!("首次开流不得返回复用游标"),
        }
        let error = table.begin_stream(id, 1).expect_err("游标在途时必须互斥");
        assert_eq!(error.code(), crate::error::RESOURCE_BUSY);
        let error = table
            .acquire_for_range_read(id, 1)
            .expect_err("流占用期间范围读互斥");
        assert_eq!(error.code(), crate::error::RESOURCE_BUSY);
        // 游标归位后可续用；范围读仍互斥。
        table.store_stream(id, Some(Box::new(DoneStream)));
        match table.begin_stream(id, 1).expect("归位游标必须可续用") {
            StreamSlot::Reuse { .. } => {}
            StreamSlot::FirstOpen { .. } => panic!("已归位游标不得再次占槽"),
        }
        // EOF（归位 None）：槽位释放，范围读恢复放行。
        table.store_stream(id, None);
        assert!(
            table.acquire_for_range_read(id, 1).is_ok(),
            "EOF 后必须解除互斥"
        );
        assert!(!table.snapshot()[0].stream_open);
    }

    /// N-1 归属闸两臂（表级）：同会话四准入全放行，跨会话全以在册
    /// 拒绝形 `RESOURCE_PERMISSION_DENIED` 收口且句柄保持原状。
    #[test]
    fn test_session_ownership_gate_two_arms() {
        let table = table();
        let id = insert(&table, 1, "chips.a");
        // 合法臂：同会话（1）四准入全放行。
        table.acquire_for_read(id, 1).expect("同会话读准入必须放行");
        table
            .acquire_for_range_read(id, 1)
            .expect("同会话范围读准入必须放行");
        match table.begin_stream(id, 1).expect("同会话开流必须放行") {
            StreamSlot::FirstOpen { .. } => {}
            StreamSlot::Reuse { .. } => panic!("首次开流不得返回复用游标"),
        }
        table.store_stream(id, None);
        // 越权臂：会话 2 跨会话访问同一句柄 ID，四准入逐一拒绝且落
        // `RESOURCE_PERMISSION_DENIED`（`permission: "session"`、
        // `reason: out_of_scope`）。
        for error in [
            table
                .acquire_for_read(id, 2)
                .expect_err("跨会话读准入必须拒绝"),
            table
                .acquire_for_range_read(id, 2)
                .expect_err("跨会话范围读必须拒绝"),
            table.begin_stream(id, 2).expect_err("跨会话开流必须拒绝"),
            table
                .release_for_session(id, 2)
                .expect_err("跨会话释放必须拒绝"),
        ] {
            assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
            let details = error.details().expect("拒绝形 details 在册");
            assert_eq!(details["permission"], "session");
            assert_eq!(details["reason"], "out_of_scope");
        }
        // 拒绝不产生副作用：句柄仍在册且归属不变。
        assert_eq!(table.state_of(id), Some(HandleState::Open));
        table
            .release_for_session(id, 1)
            .expect("归属会话释放必须放行");
        assert_eq!(table.state_of(id), Some(HandleState::Released));
    }

    /// N-1 归属闸幂等口径：未在册（陈旧 ID / 墓碑）释放仍为 no-op，
    /// 与《03》§7.1 `release` 幂等承诺一致。
    #[test]
    fn test_release_for_session_keeps_idempotency_for_unknown_ids() {
        let table = table();
        let id = insert(&table, 1, "chips.a");
        table.release_for_session(id, 1).expect("归属释放");
        table
            .release_for_session(id, 1)
            .expect("已释放句柄重复释放必须幂等");
        table
            .release_for_session(9_999, 2)
            .expect("从未在册的陈旧 ID 释放必须幂等 no-op");
    }
}
