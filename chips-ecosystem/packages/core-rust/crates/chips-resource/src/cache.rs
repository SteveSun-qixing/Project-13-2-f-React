//! 缓存策略面（《04-资源管理设计》§六，B4；段三主体 #185 产化）。
//!
//! 三层落地（§6.1）：
//! - L0 元数据缓存：URI → size / mime / version，容量
//!   [`ResourceLimits::metadata_cache_entries`]（4096 条），随作用域失效；
//!   External 条目按 TTL 惰性失效（§6.3 HttpProvider 行）。
//! - L1 内存字节缓存：键 `(scope, path, version)`（§6.5，External 额外
//!   含 origin；query 参与键、fragment 不参与——fragment 在 URI 语法层已
//!   拒绝），按字节加权 LRU，预算 [`ResourceLimits::memory_cache_bytes`]
//!   （64 MiB）；单条超过 [`ResourceLimits::max_inline_bytes`]（8 MiB）
//!   不入 L1（§6.2）。淘汰遇钉住条目改标 `evict_pending`，引用归零后淘汰。
//! - L2 外部磁盘缓存：仅服务 External 作用域的 `http(s)` 响应体，预算
//!   [`ResourceLimits::disk_cache_bytes`]（512 MiB），条目包含响应头副本
//!   与校验信息（ETag / Last-Modified / 新鲜期），跨进程重启（打开时扫描
//!   根目录重建索引）。根目录由宿主装配注入（用户缓存目录，接线在册）。
//!
//! 并发与一致性（§6.4）：
//! - [`SingleFlight`] 以缓存键合并并发读取：首个调用执行后端读取，其余
//!   等待共享结果，完成后移除在途记录；
//! - 缓存只写入完整读取成功的结果——范围读不写入 L1、流式读取不写入
//!   字节缓存只更新元数据（消费侧约束由管理器把守；本模块的
//!   [`CacheStore::memory_insert`] 只接受完整体入口）；
//! - 锁规则：本模块同步锁临界区内绝不 `await`（异步面仅 [`SingleFlight`]
//!   的 `tokio::sync` 单元，注册表锁不出 `await` 点）；
//! - 失效与在途读取竞态：失效标记（epoch 递增）先于数据清理，在途结果
//!   提交时以读取开始时快照的 epoch 再校验，过期结果丢弃
//!   （[`CacheStore::memory_insert`] 返回 `false`）。
//!
//! 缓存统计（命中率、字节数、淘汰数、钉住数）经 [`CacheStats`] 供主进程
//! 日志诊断消费，不作为发布指标（§6.2）。

use std::collections::{BTreeMap, HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use chips_core::ChipsError;
use serde::{Deserialize, Serialize};
use tokio::sync::OnceCell;

use crate::constants::ResourceLimits;
use crate::error::ResourceError;
use crate::scope::ScopeId;

/// L0/L1/L2 共用的资源键（《04》§6.5）。
///
/// `path` 取规范 URI 的路径段（External 含 query；fragment 已在 URI 语法
/// 层拒绝，天然不参与）。External 资源额外以 `origin` 区分。
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CacheKey {
    /// 作用域 ID。
    pub scope: ScopeId,
    /// 规范化路径（External 含 query）。
    pub path: String,
    /// 版本戳（无版本戳不进缓存，《04.13》约束 #6）。
    pub version: String,
    /// External origin（受管作用域为 `None`）。
    pub origin: Option<String>,
}

impl CacheKey {
    /// 受管作用域键。
    #[must_use]
    pub fn managed(scope: &str, path: &str, version: &str) -> Self {
        Self {
            scope: scope.to_owned(),
            path: path.to_owned(),
            version: version.to_owned(),
            origin: None,
        }
    }

    /// External 键（origin 参与键，《04》§6.5）。
    #[must_use]
    pub fn external(origin: &str, path: &str, version: &str) -> Self {
        Self {
            scope: crate::uri::EXTERNAL_SCOPE.to_owned(),
            path: path.to_owned(),
            version: version.to_owned(),
            origin: Some(origin.to_owned()),
        }
    }

    /// 身份部分（不含版本戳）：L0 键与失效清扫维度。
    fn identity(&self) -> (ScopeId, String, Option<String>) {
        (self.scope.clone(), self.path.clone(), self.origin.clone())
    }

    /// SingleFlight 合并键（完整缓存键文本化，《04》§6.4「以缓存键合并」）。
    pub(crate) fn flight_key(&self) -> String {
        match &self.origin {
            Some(origin) => format!("ext|{origin}|{}/{}@{}", self.scope, self.path, self.version),
            None => format!("man|{}/{}@{}", self.scope, self.path, self.version),
        }
    }

    /// L2 条目文件名基（FNV-1a 稳定散列；仅文件名派生，非安全用途）。
    fn disk_stem(&self) -> String {
        stable_hash(self.flight_key().as_bytes())
    }
}

/// FNV-1a 64 位稳定散列（跨进程重启同名命中）。
fn stable_hash(material: &[u8]) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in material {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100_0000_01b3);
    }
    format!("{hash:016x}")
}

/// 当前 Unix 毫秒（诊断与 LRU 时钟；时钟回拨按 0 收敛）。
fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|span| span.as_millis() as u64)
        .unwrap_or(0)
}

/// L0 元数据条目（URI → size / mime / version + 校验信息）。
#[derive(Debug, Clone)]
pub struct CachedMetadata {
    /// 资源大小（字节）。
    pub size: u64,
    /// MIME 类型。
    pub mime: String,
    /// 版本戳（Directory `mtime+size` / Archive 归档戳 / Http `ETag` 等）。
    pub version: String,
    /// `ETag` 响应头副本（仅 External）。
    pub etag: Option<String>,
    /// `Last-Modified` 响应头副本（仅 External）。
    pub last_modified: Option<String>,
    /// 新鲜期截止（仅 External；`None` 表示事件失效型受管条目）。
    pub expires_at: Option<Instant>,
}

impl CachedMetadata {
    /// 新鲜期是否已过（TTL 惰性失效，《04》§6.3 HttpProvider 行）。
    #[must_use]
    pub fn is_expired(&self) -> bool {
        self.expires_at
            .is_some_and(|deadline| deadline <= Instant::now())
    }
}

/// 缓存诊断统计（§6.2；只增计数 + 当前驻留）。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
    /// L0 命中次数。
    pub l0_hits: u64,
    /// L0 未命中次数。
    pub l0_misses: u64,
    /// L1 命中次数。
    pub l1_hits: u64,
    /// L1 未命中次数。
    pub l1_misses: u64,
    /// 当前 L1 驻留字节数。
    pub l1_bytes: u64,
    /// L1 淘汰次数。
    pub l1_evictions: u64,
    /// 钉住发生次数（命中即钉；淘汰遇钉住改标）。
    pub l1_pins: u64,
    /// L2 命中次数。
    pub l2_hits: u64,
    /// L2 未命中次数。
    pub l2_misses: u64,
    /// L2 淘汰次数。
    pub l2_evictions: u64,
    /// 当前 L2 驻留字节数。
    pub l2_bytes: u64,
}

/// L1 驻留条目。
#[derive(Debug, Clone)]
struct L1Entry {
    bytes: Arc<Vec<u8>>,
    pinned: usize,
    evict_pending: bool,
    last_used: Instant,
}

/// L0 表：容量把守、插入序 FIFO（《04》§6.1 仅在册容量与「随作用域
/// 失效」两约束，未在册 L0 淘汰算法，FIFO 即合规承载）。
#[derive(Debug)]
struct L0Table {
    entries: HashMap<(ScopeId, String, Option<String>), CachedMetadata>,
    order: VecDeque<(ScopeId, String, Option<String>)>,
    capacity: usize,
}

/// L1 表：字节加权 LRU + 钉住 / `evict_pending`。
#[derive(Debug)]
struct L1Table {
    entries: HashMap<CacheKey, L1Entry>,
    resident_bytes: u64,
    budget_bytes: u64,
    max_entry_bytes: u64,
}

/// 缓存主体（§6.1–§6.5 全量落地）。
#[derive(Debug)]
pub struct CacheStore {
    l0: Mutex<L0Table>,
    l1: Mutex<L1Table>,
    /// 失效标记（§6.4 竞态规则）：任何失效先行递增、后清数据。
    epoch: AtomicU64,
    /// 外部资源默认 TTL（§12 `externalTtlSeconds`；响应头有效期优先）。
    external_ttl: Duration,
    stats: CacheStatsCounters,
    /// L2 磁盘缓存（仅 External；根目录由宿主装配注入）。
    disk: Mutex<Option<DiskCache>>,
}

/// 原子统计计数（导出为 [`CacheStats`]）。
#[derive(Debug, Default)]
struct CacheStatsCounters {
    l0_hits: AtomicU64,
    l0_misses: AtomicU64,
    l1_hits: AtomicU64,
    l1_misses: AtomicU64,
    l1_bytes: AtomicU64,
    l1_evictions: AtomicU64,
    l1_pins: AtomicU64,
    l2_hits: AtomicU64,
    l2_misses: AtomicU64,
    l2_evictions: AtomicU64,
    l2_bytes: AtomicU64,
}

impl CacheStore {
    /// 以生产限额构造（容量与预算一律取自《04》§12 合流后的
    /// [`ResourceLimits`]，取值源唯一）。
    #[must_use]
    pub fn new(limits: &ResourceLimits) -> Self {
        Self {
            l0: Mutex::new(L0Table {
                entries: HashMap::new(),
                order: VecDeque::new(),
                capacity: limits.metadata_cache_entries.max(1),
            }),
            l1: Mutex::new(L1Table {
                entries: HashMap::new(),
                resident_bytes: 0,
                budget_bytes: limits.memory_cache_bytes,
                max_entry_bytes: limits.max_inline_bytes,
            }),
            epoch: AtomicU64::new(1),
            external_ttl: Duration::from_secs(limits.external_ttl_seconds),
            stats: CacheStatsCounters::default(),
            disk: Mutex::new(None),
        }
    }

    /// 装配 L2 磁盘缓存根目录（宿主用户缓存目录，生产装配路径；未装配
    /// 则 L2 不启用，External 仅 L0/L1 层，《04》§6.2）。
    pub fn attach_disk(&self, root: PathBuf, budget_bytes: u64) -> Result<(), ChipsError> {
        let cache = DiskCache::open(root, budget_bytes)?;
        let bytes = cache.used_bytes();
        self.disk
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .replace(cache);
        self.stats.l2_bytes.store(bytes, Ordering::Relaxed);
        Ok(())
    }

    /// 当前失效 epoch（后端读取开始前快照、提交时回验）。
    #[must_use]
    pub fn epoch(&self) -> u64 {
        self.epoch.load(Ordering::Acquire)
    }

    /// 诊断统计快照（§6.2，主进程日志消费，不作发布指标）。
    #[must_use]
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            l0_hits: self.stats.l0_hits.load(Ordering::Relaxed),
            l0_misses: self.stats.l0_misses.load(Ordering::Relaxed),
            l1_hits: self.stats.l1_hits.load(Ordering::Relaxed),
            l1_misses: self.stats.l1_misses.load(Ordering::Relaxed),
            l1_bytes: self.stats.l1_bytes.load(Ordering::Relaxed),
            l1_evictions: self.stats.l1_evictions.load(Ordering::Relaxed),
            l1_pins: self.stats.l1_pins.load(Ordering::Relaxed),
            l2_hits: self.stats.l2_hits.load(Ordering::Relaxed),
            l2_misses: self.stats.l2_misses.load(Ordering::Relaxed),
            l2_evictions: self.stats.l2_evictions.load(Ordering::Relaxed),
            l2_bytes: self.stats.l2_bytes.load(Ordering::Relaxed),
        }
    }

    // -- L0 元数据面 --------------------------------------------------------

    /// L0 读取：TTL 过期惰性剔除；受管条目依赖事件失效（§6.3 表）。
    #[must_use]
    pub fn metadata_get(&self, key: &CacheKey) -> Option<CachedMetadata> {
        let mut table = self.l0.lock().unwrap_or_else(PoisonError::into_inner);
        let identity = key.identity();
        match table.entries.get(&identity) {
            Some(entry) if !entry.is_expired() => {
                self.stats.l0_hits.fetch_add(1, Ordering::Relaxed);
                Some(entry.clone())
            }
            Some(_) => {
                table.entries.remove(&identity);
                table.order.retain(|item| item != &identity);
                self.stats.l0_misses.fetch_add(1, Ordering::Relaxed);
                None
            }
            None => {
                self.stats.l0_misses.fetch_add(1, Ordering::Relaxed);
                None
            }
        }
    }

    /// L0 验证器线索面（段三 #192 随 HttpProvider L2 条件复验面追加）：
    /// 无视 TTL 惰性失效、原样返回在册记录，且不动 hit/miss 统计。
    /// 仅用于 L2 磁盘键的 version 线索构造——陈旧条目的条件请求复验
    /// 不得因 L0 记录过期而失去线索（《04》§6.2/§8.4）。
    #[must_use]
    pub fn metadata_probe(&self, key: &CacheKey) -> Option<CachedMetadata> {
        let table = self.l0.lock().unwrap_or_else(PoisonError::into_inner);
        table.entries.get(&key.identity()).cloned()
    }

    /// L0 写入（读穿回填；流式读取「只更新元数据」也走本通道，《04》§6.4）。
    pub fn metadata_insert(&self, key: &CacheKey, entry: CachedMetadata) {
        let mut table = self.l0.lock().unwrap_or_else(PoisonError::into_inner);
        let identity = key.identity();
        if !table.entries.contains_key(&identity) {
            while table.entries.len() >= table.capacity {
                match table.order.pop_front() {
                    Some(oldest) => {
                        table.entries.remove(&oldest);
                    }
                    None => break,
                }
            }
            table.order.push_back(identity.clone());
        }
        table.entries.insert(identity, entry);
    }

    // -- L1 字节面 ----------------------------------------------------------

    /// L1 读取并顺带钉住（活跃读取期间不被淘汰，《04》§6.2）。
    #[must_use]
    pub fn memory_get_pinned(&self, key: &CacheKey) -> Option<Arc<Vec<u8>>> {
        let mut table = self.l1.lock().unwrap_or_else(PoisonError::into_inner);
        match table.entries.get_mut(key) {
            Some(entry) => {
                entry.pinned += 1;
                entry.last_used = Instant::now();
                self.stats.l1_hits.fetch_add(1, Ordering::Relaxed);
                self.stats.l1_pins.fetch_add(1, Ordering::Relaxed);
                Some(Arc::clone(&entry.bytes))
            }
            None => {
                self.stats.l1_misses.fetch_add(1, Ordering::Relaxed);
                None
            }
        }
    }

    /// 解除钉住；条目已标 `evict_pending` 时引用归零即淘汰（§6.2）。
    pub fn memory_unpin(&self, key: &CacheKey) {
        let mut table = self.l1.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(entry) = table.entries.get_mut(key) {
            entry.pinned = entry.pinned.saturating_sub(1);
            if entry.pinned == 0 && entry.evict_pending {
                Self::drop_entry(&mut table, key);
                self.stats.l1_evictions.fetch_add(1, Ordering::Relaxed);
            }
            self.stats
                .l1_bytes
                .store(table.resident_bytes, Ordering::Relaxed);
        }
    }

    /// L1 写入（仅完整读取成功的结果可入，§6.4 消费侧把守）。
    ///
    /// `read_epoch` 为后端读取开始前快照的失效标记；与当前值不一致说明
    /// 读取期间发生失效，过期结果丢弃（返回 `false`，§6.4 竞态规则）。
    /// 单条超过 `max_inline_bytes` 不入 L1（§6.2）。
    pub fn memory_insert(&self, key: &CacheKey, bytes: Vec<u8>, read_epoch: u64) -> bool {
        if read_epoch != self.epoch() {
            return false;
        }
        let mut table = self.l1.lock().unwrap_or_else(PoisonError::into_inner);
        let size = bytes.len() as u64;
        if size > table.max_entry_bytes || size > table.budget_bytes {
            return false;
        }
        let fresh = Arc::new(bytes);
        match table.entries.get_mut(key) {
            Some(existing) => {
                let old_size = existing.bytes.len() as u64;
                existing.bytes = fresh;
                existing.last_used = Instant::now();
                existing.evict_pending = false;
                table.resident_bytes += size - old_size;
            }
            None => {
                table.entries.insert(
                    key.clone(),
                    L1Entry {
                        bytes: fresh,
                        pinned: 0,
                        evict_pending: false,
                        last_used: Instant::now(),
                    },
                );
                table.resident_bytes += size;
            }
        }
        self.converge_l1(&mut table);
        true
    }

    /// 预算收敛（《04》§6.2）：按最近最少使用选受害者——受害者被钉住时
    /// 改标 `evict_pending` 跳过（引用归零后由 [`Self::memory_unpin`] 淘汰），
    /// 未钉住者就地淘汰；全部候选处置完毕仍超预算（即余者皆钉住）时允许
    /// 短时超预算，读取不被阻塞。
    fn converge_l1(&self, table: &mut L1Table) {
        while table.resident_bytes > table.budget_bytes {
            let victim = table
                .entries
                .iter()
                .filter(|(_, entry)| !entry.evict_pending)
                .min_by_key(|(_, entry)| entry.last_used)
                .map(|(key, entry)| (key.clone(), entry.pinned));
            let Some((victim_key, pinned)) = victim else {
                break;
            };
            if pinned > 0 {
                if let Some(entry) = table.entries.get_mut(&victim_key) {
                    entry.evict_pending = true;
                }
                continue;
            }
            Self::drop_entry(table, &victim_key);
            self.stats.l1_evictions.fetch_add(1, Ordering::Relaxed);
        }
        self.stats
            .l1_bytes
            .store(table.resident_bytes, Ordering::Relaxed);
    }

    fn drop_entry(table: &mut L1Table, key: &CacheKey) {
        if let Some(entry) = table.entries.remove(key) {
            table.resident_bytes -= entry.bytes.len() as u64;
        }
    }

    /// 单资源失效（写提交 / 删除 / 改名 / 复制后刷新，《04》§6.3 表）：
    /// 失效标记先行，L0 + 该身份全部 L1 版本 + L2 条目一并清扫。
    pub fn invalidate_resource(&self, scope: &str, path: &str) {
        self.mark_invalidated();
        {
            let mut table = self.l0.lock().unwrap_or_else(PoisonError::into_inner);
            let doomed: Vec<_> = table
                .entries
                .keys()
                .filter(|(entry_scope, entry_path, _)| entry_scope == scope && entry_path == path)
                .cloned()
                .collect();
            for identity in doomed {
                table.entries.remove(&identity);
                table.order.retain(|item| item != &identity);
            }
        }
        {
            let mut table = self.l1.lock().unwrap_or_else(PoisonError::into_inner);
            let doomed: Vec<CacheKey> = table
                .entries
                .keys()
                .filter(|key| key.scope == scope && key.path == path)
                .cloned()
                .collect();
            for key in doomed {
                Self::drop_entry(&mut table, &key);
                self.stats.l1_evictions.fetch_add(1, Ordering::Relaxed);
            }
            self.stats
                .l1_bytes
                .store(table.resident_bytes, Ordering::Relaxed);
        }
        let disk_slot = self
            .disk
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .take();
        if let Some(mut disk) = disk_slot {
            let before = disk.len();
            disk.remove_matching(scope, path);
            let removed = (before - disk.len()) as u64;
            if removed > 0 {
                self.stats
                    .l2_evictions
                    .fetch_add(removed, Ordering::Relaxed);
            }
            self.stats
                .l2_bytes
                .store(disk.used_bytes(), Ordering::Relaxed);
            self.disk
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .replace(disk);
        }
    }

    /// 作用域整体失效（注销 / 撤销，《04》§6.1「随作用域失效」）。
    ///
    /// 失效顺序由调用侧（管理器）保证：句柄转 `invalidated` →
    /// `onInvalidate` 通知 → 本清理 → 底层读取器关闭（§6.3）。
    pub fn invalidate_scope(&self, scope: &ScopeId) {
        self.mark_invalidated();
        {
            let mut table = self.l0.lock().unwrap_or_else(PoisonError::into_inner);
            let doomed: Vec<_> = table
                .entries
                .keys()
                .filter(|(entry_scope, _, _)| entry_scope == scope)
                .cloned()
                .collect();
            for identity in doomed {
                table.entries.remove(&identity);
                table.order.retain(|item| item != &identity);
            }
        }
        {
            let mut table = self.l1.lock().unwrap_or_else(PoisonError::into_inner);
            let doomed: Vec<CacheKey> = table
                .entries
                .keys()
                .filter(|key| &key.scope == scope)
                .cloned()
                .collect();
            for key in doomed {
                Self::drop_entry(&mut table, &key);
                self.stats.l1_evictions.fetch_add(1, Ordering::Relaxed);
            }
            self.stats
                .l1_bytes
                .store(table.resident_bytes, Ordering::Relaxed);
        }
        let disk_slot = self
            .disk
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .take();
        if let Some(mut disk) = disk_slot {
            disk.remove_matching_scope(scope);
            self.stats
                .l2_bytes
                .store(disk.used_bytes(), Ordering::Relaxed);
            self.disk
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .replace(disk);
        }
    }

    /// 失效标记先行：epoch 递增（§6.4 竞态规则第一步）。
    fn mark_invalidated(&self) {
        self.epoch.fetch_add(1, Ordering::AcqRel);
    }

    /// External 默认 TTL（响应头有效期优先由 HttpProvider 裁决）。
    #[must_use]
    pub fn external_ttl(&self) -> Duration {
        self.external_ttl
    }

    // -- L2 磁盘面（仅 External，消费侧 HttpProvider 把守） ------------------

    /// L2 读取（未装配根目录一律未命中）。
    #[must_use]
    pub fn disk_get(&self, key: &CacheKey) -> Option<DiskEntry> {
        let mut guard = self.disk.lock().unwrap_or_else(PoisonError::into_inner);
        let cache = guard.as_mut()?;
        let hit = cache.get(&key.disk_stem());
        match &hit {
            Some(_) => {
                self.stats.l2_hits.fetch_add(1, Ordering::Relaxed);
                self.stats
                    .l2_bytes
                    .store(cache.used_bytes(), Ordering::Relaxed);
            }
            None => {
                self.stats.l2_misses.fetch_add(1, Ordering::Relaxed);
            }
        }
        hit
    }

    /// L2 写入（响应体 + 响应头副本与校验信息，《04》§6.2）。
    ///
    /// 返回 `false` 表示未装配、失效竞态丢弃（epoch 再校验，同 L1 规则）
    /// 或条目超预算。
    pub fn disk_insert(
        &self,
        key: &CacheKey,
        body: Vec<u8>,
        meta: DiskMeta,
        read_epoch: u64,
    ) -> bool {
        if read_epoch != self.epoch() {
            return false;
        }
        let mut guard = self.disk.lock().unwrap_or_else(PoisonError::into_inner);
        let Some(cache) = guard.as_mut() else {
            return false;
        };
        let evictions = match cache.put(key.disk_stem(), body, meta) {
            Ok(evictions) => evictions,
            Err(_) => return false,
        };
        self.stats
            .l2_evictions
            .fetch_add(evictions, Ordering::Relaxed);
        self.stats
            .l2_bytes
            .store(cache.used_bytes(), Ordering::Relaxed);
        true
    }
}

/// L2 条目响应头副本与校验信息（§6.2「条目包含响应头副本与校验信息」）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskMeta {
    /// 完整缓存键标识（诊断与再校验）。
    pub cache_key: String,
    /// `ETag` 响应头副本（缺省表示无验证器）。
    pub etag: Option<String>,
    /// `Last-Modified` 响应头副本。
    pub last_modified: Option<String>,
    /// 新鲜期截止（Unix 毫秒；TTL 与响应头裁决后的落盘值）。
    pub fresh_until_millis: u64,
    /// 落盘时刻（Unix 毫秒，LRU 依据）。
    pub stored_at_millis: u64,
}

/// L2 读取产物。
#[derive(Debug, Clone)]
pub struct DiskEntry {
    /// 响应头副本与校验信息。
    pub meta: DiskMeta,
    /// 响应体字节。
    pub body: Vec<u8>,
}

impl DiskEntry {
    /// 新鲜期是否已过（过期条目必须走条件请求，《04》§6.3）。
    #[must_use]
    pub fn is_fresh(&self) -> bool {
        now_millis() < self.meta.fresh_until_millis
    }
}

/// L2 磁盘缓存：根目录 + 字节预算 LRU（§6.2）。
///
/// 条目以 `<stem>.bin`（响应体）+ `<stem>.json`（响应头副本与校验信息）
/// 成对落盘；打开时扫描根目录重建索引（跨进程重启）。全部方法为同步
/// `std::fs` 操作，由调用侧经 `spawn_blocking` 移出事件敏感路径；本类型
/// 自身不在持锁期 `await`。
#[derive(Debug)]
pub struct DiskCache {
    root: PathBuf,
    budget_bytes: u64,
    entries: BTreeMap<String, DiskIndexEntry>,
    used_bytes: u64,
}

#[derive(Debug, Clone)]
struct DiskIndexEntry {
    size: u64,
    accessed_at_millis: u64,
}

impl DiskCache {
    /// 打开（或创建）根目录并扫描重建索引；残缺条目（体缺失 / 头非法）
    /// 就地清理，不留半态。
    pub fn open(root: PathBuf, budget_bytes: u64) -> Result<Self, ChipsError> {
        std::fs::create_dir_all(&root).map_err(|_| ResourceError::Internal)?;
        let mut cache = Self {
            root,
            budget_bytes,
            entries: BTreeMap::new(),
            used_bytes: 0,
        };
        cache.rescan()?;
        Ok(cache)
    }

    /// 根目录（测试断言与宿主诊断）。
    #[must_use]
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// 当前驻留字节数。
    #[must_use]
    pub fn used_bytes(&self) -> u64 {
        self.used_bytes
    }

    /// 在册条目数。
    #[must_use]
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// 条目表是否为空。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    fn body_path(&self, stem: &str) -> PathBuf {
        self.root.join(format!("{stem}.bin"))
    }

    fn meta_path(&self, stem: &str) -> PathBuf {
        self.root.join(format!("{stem}.json"))
    }

    fn rescan(&mut self) -> Result<(), ChipsError> {
        self.entries.clear();
        self.used_bytes = 0;
        let read = std::fs::read_dir(&self.root).map_err(|_| ResourceError::Internal)?;
        for item in read {
            let Ok(item) = item else { continue };
            let path = item.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
                continue;
            }
            let Some(stem) = path.file_stem().and_then(|name| name.to_str()) else {
                continue;
            };
            let parsed = std::fs::read_to_string(&path)
                .ok()
                .and_then(|text| serde_json::from_str::<DiskMeta>(&text).ok());
            let Some(meta) = parsed else {
                let _ = std::fs::remove_file(&path);
                continue;
            };
            let Ok(size) = std::fs::metadata(self.body_path(stem)).map(|stat| stat.len()) else {
                let _ = std::fs::remove_file(&path);
                continue;
            };
            self.entries.insert(
                stem.to_owned(),
                DiskIndexEntry {
                    size,
                    accessed_at_millis: meta.stored_at_millis,
                },
            );
            self.used_bytes += size;
        }
        Ok(())
    }

    /// 读取条目（命中刷新访问时间）。
    pub fn get(&mut self, stem: &str) -> Option<DiskEntry> {
        if !self.entries.contains_key(stem) {
            return None;
        }
        let text = std::fs::read_to_string(self.meta_path(stem)).ok()?;
        let meta = serde_json::from_str::<DiskMeta>(&text).ok()?;
        let body = std::fs::read(self.body_path(stem)).ok()?;
        self.entries.insert(
            stem.to_owned(),
            DiskIndexEntry {
                size: body.len() as u64,
                accessed_at_millis: now_millis(),
            },
        );
        Some(DiskEntry { meta, body })
    }

    /// 写入条目：预算收敛（按访问时间 LRU）后成对落盘（`.bin` 经临时
    /// 文件 + rename 原子建立）。返回被淘汰条目数。
    pub fn put(&mut self, stem: String, body: Vec<u8>, meta: DiskMeta) -> Result<u64, ChipsError> {
        let size = body.len() as u64;
        if size > self.budget_bytes {
            return Err(ResourceError::TooLarge {
                uri: format!("l2://{}", meta.cache_key),
                size,
                limit: self.budget_bytes,
            }
            .into());
        }
        if self.entries.contains_key(&stem) {
            self.remove(&stem);
        }
        let mut evictions = 0u64;
        while self.used_bytes + size > self.budget_bytes {
            let victim = self
                .entries
                .iter()
                .min_by_key(|(_, index)| index.accessed_at_millis)
                .map(|(victim_stem, _)| victim_stem.clone());
            let Some(victim) = victim else { break };
            self.remove(&victim);
            evictions += 1;
        }
        let body_path = self.body_path(&stem);
        let tmp_path = self.root.join(format!("{stem}.bin.tmp"));
        std::fs::write(&tmp_path, &body).map_err(|_| ResourceError::Internal)?;
        std::fs::rename(&tmp_path, &body_path).map_err(|_| {
            let _ = std::fs::remove_file(&tmp_path);
            ResourceError::Internal
        })?;
        if let Err(error) = std::fs::write(
            self.meta_path(&stem),
            serde_json::to_vec(&meta).map_err(|_| ResourceError::Internal)?,
        ) {
            let _ = std::fs::remove_file(&body_path);
            let _ = error;
            return Err(ResourceError::Internal.into());
        }
        self.entries.insert(
            stem,
            DiskIndexEntry {
                size,
                accessed_at_millis: meta.stored_at_millis.max(1),
            },
        );
        self.used_bytes += size;
        Ok(evictions)
    }

    /// 删除条目（成对摘除）。
    pub fn remove(&mut self, stem: &str) {
        if let Some(index) = self.entries.remove(stem) {
            self.used_bytes = self.used_bytes.saturating_sub(index.size);
            let _ = std::fs::remove_file(self.body_path(stem));
            let _ = std::fs::remove_file(self.meta_path(stem));
        }
    }

    /// 按身份（scope + path 文本）清扫：L2 文件名不含身份信息，以头文件
    /// `cache_key` 字段匹配（写入侧保证 `cache_key` 携带 `scope/path`）。
    pub fn remove_matching(&mut self, scope: &str, path: &str) {
        let needle = format!("\"cacheKey\":\"{scope}/{path}");
        let doomed: Vec<String> = self
            .entries
            .keys()
            .filter(|stem| {
                std::fs::read_to_string(self.meta_path(stem))
                    .ok()
                    .is_some_and(|text| {
                        text.contains(&needle)
                            || (path.is_empty()
                                && text.contains(&format!("\"cacheKey\":\"{scope}/")))
                    })
            })
            .cloned()
            .collect();
        for stem in doomed {
            self.remove(&stem);
        }
    }

    /// 作用域整体清扫。
    pub fn remove_matching_scope(&mut self, scope: &str) {
        self.remove_matching(scope, "");
    }
}

// ---------------------------------------------------------------------------
// SingleFlight（《04》§6.4）
// ---------------------------------------------------------------------------

/// 在途调用共享体（`tokio::sync::OnceCell`：初始化者恰好一名，其余等待
/// 共享结果；错误不驻留，等待者同感败果）。
struct Flight<T> {
    cell: OnceCell<T>,
}

impl<T> Default for Flight<T> {
    fn default() -> Self {
        Self {
            cell: OnceCell::new(),
        }
    }
}

/// 缓存键并发合流器（《04》§6.4 SingleFlight）。
#[derive(Default)]
pub struct SingleFlight<T> {
    inner: Mutex<HashMap<String, Arc<Flight<T>>>>,
}

impl<T> std::fmt::Debug for SingleFlight<T> {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let inflight = self
            .inner
            .lock()
            .map(|table| table.len())
            .unwrap_or_default();
        formatter
            .debug_struct("SingleFlight")
            .field("inflight", &inflight)
            .finish()
    }
}

impl<T: Clone + Send + Sync + 'static> SingleFlight<T> {
    /// 以键合流执行：同键并发只落一次后端读取，结果共享；完成后移除
    /// 在途记录。
    ///
    /// 锁规则：注册表锁在取出 `Arc<Flight>` 后立即释放，全部 `await`
    /// 发生在锁外（§6.4「绝不在持有锁时 await」）。
    pub async fn run_once<F>(
        self: &Arc<Self>,
        key: &str,
        load: impl FnOnce() -> F + Send + 'static,
    ) -> Result<T, ChipsError>
    where
        F: std::future::Future<Output = Result<T, ChipsError>> + Send + 'static,
    {
        let flight = {
            let mut table = self.inner.lock().unwrap_or_else(PoisonError::into_inner);
            table
                .entry(key.to_owned())
                .or_insert_with(|| Arc::new(Flight::default()))
                .clone()
        };
        let result = match flight.cell.get_or_try_init(load).await {
            Ok(value) => Ok(value.clone()),
            Err(error) => Err(error.clone()),
        };
        // 完成后移除在途记录；仍指向本次 Flight 才摘除（后续调用顶替时
        // 保留新记录）。
        let mut table = self.inner.lock().unwrap_or_else(PoisonError::into_inner);
        if table
            .get(key)
            .is_some_and(|current| Arc::ptr_eq(current, &flight))
        {
            table.remove(key);
        }
        result
    }

    /// 当前在途键数（诊断）。
    #[must_use]
    pub fn inflight_count(&self) -> usize {
        self.inner
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .len()
    }
}

// ---------------------------------------------------------------------------
// 单元测试（《04》§6 逐则锁测）
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicU64;

    fn limits_with(memory_cache_bytes: u64, max_entry: u64, l0_capacity: usize) -> ResourceLimits {
        ResourceLimits {
            memory_cache_bytes,
            max_inline_bytes: max_entry,
            metadata_cache_entries: l0_capacity,
            ..ResourceLimits::default()
        }
    }

    fn key(path: &str, version: &str) -> CacheKey {
        CacheKey::managed("card-1", path, version)
    }

    fn meta(version: &str) -> CachedMetadata {
        CachedMetadata {
            size: 10,
            mime: "text/plain".into(),
            version: version.into(),
            etag: None,
            last_modified: None,
            expires_at: None,
        }
    }

    fn scratch_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "chips-cache-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().name().unwrap_or("anon")
        ));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn l0_capacity_fifo_eviction() {
        let store = CacheStore::new(&limits_with(64 * 1024 * 1024, 8 * 1024 * 1024, 2));
        store.metadata_insert(&key("a", "v1"), meta("v1"));
        store.metadata_insert(&key("b", "v1"), meta("v1"));
        store.metadata_insert(&key("c", "v1"), meta("v1"));
        assert!(
            store.metadata_get(&key("a", "v1")).is_none(),
            "超容最早条目必须被 FIFO 淘汰（4096 条即《04》§6.1 容量）"
        );
        assert!(store.metadata_get(&key("b", "v1")).is_some());
        assert!(store.metadata_get(&key("c", "v1")).is_some());
    }

    #[test]
    fn l0_ttl_lazy_expiry_external() {
        let store = CacheStore::new(&ResourceLimits::default());
        let external = CacheKey::external("https://x.test", "/f?q=1", "v1");
        store.metadata_insert(
            &external,
            CachedMetadata {
                expires_at: Some(Instant::now() + Duration::from_millis(10)),
                ..meta("v1")
            },
        );
        assert!(store.metadata_get(&external).is_some(), "新鲜期内必须命中");
        std::thread::sleep(Duration::from_millis(25));
        assert!(
            store.metadata_get(&external).is_none(),
            "TTL 过期惰性失效（§6.3）"
        );
    }

    #[test]
    fn l1_rejects_entry_above_max_inline() {
        let store = CacheStore::new(&limits_with(64 * 1024 * 1024, 4, 8));
        let epoch = store.epoch();
        assert!(
            !store.memory_insert(&key("big", "v"), vec![0u8; 5], epoch),
            "单条超过 8 MiB 位（此处 4 B）不入 L1（§6.2）"
        );
        assert!(store.memory_insert(&key("fit", "v"), vec![0u8; 4], epoch));
    }

    #[test]
    fn l1_byte_weighted_lru() {
        let store = CacheStore::new(&limits_with(10, 10, 8));
        let epoch = store.epoch();
        assert!(store.memory_insert(&key("a", "v"), vec![1u8; 4], epoch));
        assert!(store.memory_insert(&key("b", "v"), vec![2u8; 4], epoch));
        // 触碰 a：b 成为最久未使用。
        let hit = store.memory_get_pinned(&key("a", "v")).expect("a 命中");
        store.memory_unpin(&key("a", "v"));
        drop(hit);
        assert!(store.memory_insert(&key("c", "v"), vec![3u8; 4], epoch));
        assert!(
            store.memory_get_pinned(&key("b", "v")).is_none(),
            "字节加权 LRU 受害者必为最久未使用的 b"
        );
        assert!(store.memory_get_pinned(&key("a", "v")).is_some());
        assert!(store.memory_get_pinned(&key("c", "v")).is_some());
        assert_eq!(store.stats().l1_bytes, 8, "驻留字节必须如实记账");
    }

    #[test]
    fn l1_pinned_evict_pending_then_unpin_evicts() {
        let store = CacheStore::new(&limits_with(8, 8, 8));
        let epoch = store.epoch();
        assert!(store.memory_insert(&key("pinned", "v"), vec![0u8; 6], epoch));
        let held = store
            .memory_get_pinned(&key("pinned", "v"))
            .expect("命中并钉住");
        // 塞入 6 字节迫使淘汰：最久未使用的钉住条目按 §6.2 改标
        // evict_pending 跳过，收敛落到后来的未钉住条目自身。
        assert!(store.memory_insert(&key("fresh", "v"), vec![1u8; 6], epoch));
        {
            let table = store.l1.lock().unwrap_or_else(PoisonError::into_inner);
            let entry = table
                .entries
                .get(&key("pinned", "v"))
                .expect("钉住条目仍在");
            assert!(entry.evict_pending, "钉住条目应转入 evict_pending（§6.2）");
            assert!(
                !table.entries.contains_key(&key("fresh", "v")),
                "超预算部分由未钉住条目承担，钉住条目不被强拆"
            );
        }
        store.memory_unpin(&key("pinned", "v"));
        assert!(
            !store
                .l1
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .entries
                .contains_key(&key("pinned", "v")),
            "引用归零后淘汰（§6.2）"
        );
        drop(held);
    }

    #[test]
    fn stale_epoch_inflight_result_discarded() {
        let store = CacheStore::new(&ResourceLimits::default());
        let read_epoch = store.epoch();
        // 读取期间发生失效：提交必须被拒（§6.4 竞态规则）。
        store.invalidate_resource("card-1", "anything");
        assert!(
            !store.memory_insert(&key("late", "v"), vec![0u8; 8], read_epoch),
            "失效标记先于清理、过期在途结果丢弃（§6.4）"
        );
        assert!(store.memory_insert(&key("late", "v"), vec![0u8; 8], store.epoch()));
    }

    #[test]
    fn invalidate_resource_clears_l0_and_all_l1_versions() {
        let store = CacheStore::new(&ResourceLimits::default());
        let epoch = store.epoch();
        store.metadata_insert(&key("x", "v1"), meta("v1"));
        store.metadata_insert(&key("x", "v2"), meta("v2"));
        store.memory_insert(&key("x", "v1"), vec![0u8; 2], epoch);
        store.memory_insert(&key("x", "v2"), vec![1u8; 2], epoch);
        store.memory_insert(&key("y", "v1"), vec![2u8; 2], epoch);
        store.invalidate_resource("card-1", "x");
        assert!(store.metadata_get(&key("x", "v1")).is_none());
        assert!(
            store.memory_get_pinned(&key("x", "v1")).is_none(),
            "同身份全部版本清扫"
        );
        assert!(store.memory_get_pinned(&key("x", "v2")).is_none());
        assert!(
            store.memory_get_pinned(&key("y", "v1")).is_some(),
            "无辜资源不受波及"
        );
    }

    #[test]
    fn invalidate_scope_clears_l0_l1() {
        let store = CacheStore::new(&ResourceLimits::default());
        let epoch = store.epoch();
        store.metadata_insert(&key("x", "v"), meta("v"));
        store.memory_insert(&key("x", "v"), vec![0u8; 2], epoch);
        store.invalidate_scope(&"card-1".to_owned());
        assert!(store.metadata_get(&key("x", "v")).is_none());
        assert!(store.memory_get_pinned(&key("x", "v")).is_none());
    }

    #[test]
    fn external_key_includes_origin_query_participates() {
        let left = CacheKey::external("https://a.test", "/f?q=1", "v");
        let right = CacheKey::external("https://b.test", "/f?q=1", "v");
        assert_ne!(left, right, "External 键必须含 origin（§6.5）");
        let query_a = CacheKey::external("https://a.test", "/f?q=1", "v");
        let query_b = CacheKey::external("https://a.test", "/f?q=2", "v");
        assert_ne!(query_a, query_b, "query 参与键（§6.5）");
        assert_eq!(left.disk_stem().len(), 16, "散列文件名基稳定 16 hex");
    }

    #[tokio::test]
    async fn single_flight_shares_one_backend_call() {
        let flights = Arc::new(SingleFlight::<Vec<u8>>::default());
        let calls = Arc::new(AtomicU64::new(0));
        let gate = Arc::new(tokio::sync::Semaphore::new(0));
        let mut handles = Vec::new();
        for _ in 0..4 {
            let flights = Arc::clone(&flights);
            let calls = Arc::clone(&calls);
            let gate = Arc::clone(&gate);
            handles.push(tokio::spawn(async move {
                flights
                    .run_once("k", move || {
                        let gate = Arc::clone(&gate);
                        let calls = Arc::clone(&calls);
                        async move {
                            calls.fetch_add(1, Ordering::Relaxed);
                            gate.acquire().await.expect("许可").forget();
                            Ok::<Vec<u8>, ChipsError>(vec![42u8])
                        }
                    })
                    .await
                    .expect("合流读取必须放行")
            }));
            tokio::task::yield_now().await;
        }
        gate.add_permits(8);
        for handle in handles {
            assert_eq!(handle.await.expect("任务收敛"), vec![42u8]);
        }
        assert_eq!(
            calls.load(Ordering::Relaxed),
            1,
            "同键并发只落一次后端读取（§6.4）"
        );
        assert_eq!(flights.inflight_count(), 0, "完成后在途记录移除（§6.4）");
    }

    #[tokio::test]
    async fn single_flight_distinct_keys_do_not_merge() {
        let flights = Arc::new(SingleFlight::<u8>::default());
        let calls = Arc::new(AtomicU64::new(0));
        let mut handles = Vec::new();
        for index in 0..3u8 {
            let flights = Arc::clone(&flights);
            let calls = Arc::clone(&calls);
            handles.push(tokio::spawn(async move {
                flights
                    .run_once(&format!("key-{index}"), move || {
                        let calls = Arc::clone(&calls);
                        async move {
                            calls.fetch_add(1, Ordering::Relaxed);
                            Ok::<u8, ChipsError>(index)
                        }
                    })
                    .await
                    .expect("放行")
            }));
        }
        for handle in handles {
            let _ = handle.await.expect("收敛");
        }
        assert_eq!(calls.load(Ordering::Relaxed), 3, "异键各自落取");
    }

    #[test]
    fn disk_cache_roundtrip_budget_and_rescan() {
        let dir = scratch_dir("roundtrip");
        let meta = DiskMeta {
            cache_key: "card-1/x@v".into(),
            etag: Some("\"e1\"".into()),
            last_modified: None,
            fresh_until_millis: u64::MAX,
            stored_at_millis: 1,
        };
        {
            let mut cache = DiskCache::open(dir.clone(), 10).expect("打开 L2");
            assert_eq!(
                cache
                    .put("aaaa".into(), vec![7u8; 6], meta.clone())
                    .expect("落盘"),
                0
            );
            let hit = cache.get("aaaa").expect("命中");
            assert_eq!(hit.body, vec![7u8; 6], "响应体成对落盘");
            assert_eq!(
                hit.meta.etag.as_deref(),
                Some("\"e1\""),
                "响应头副本在册（§6.2）"
            );
            assert!(hit.is_fresh());
            // 预算 10：再塞 6 字节迫使按 LRU 淘汰旧条目。
            assert_eq!(
                cache
                    .put("bbbb".into(), vec![8u8; 6], meta)
                    .expect("第二条落盘"),
                1
            );
            assert!(cache.get("aaaa").is_none(), "预算收敛淘汰");
            assert_eq!(cache.used_bytes(), 6);
        }
        {
            let mut reopened = DiskCache::open(dir.clone(), 10).expect("重启扫描");
            assert!(
                reopened.get("bbbb").is_some(),
                "L2 跨进程重启（索引重建，《04》§6.1）"
            );
            assert_eq!(reopened.used_bytes(), 6);
        }
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn disk_rejects_entry_above_budget() {
        let dir = scratch_dir("overbudget");
        let mut cache = DiskCache::open(dir.clone(), 4).expect("打开");
        let error = cache
            .put(
                "c1".into(),
                vec![0u8; 8],
                DiskMeta {
                    cache_key: "card-1/big".into(),
                    etag: None,
                    last_modified: None,
                    fresh_until_millis: 0,
                    stored_at_millis: 0,
                },
            )
            .expect_err("超预算条目必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_TOO_LARGE);
        assert!(cache.is_empty());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn disk_remove_matching_identity_and_scope() {
        let dir = scratch_dir("matching");
        let mut cache = DiskCache::open(dir.clone(), 100).expect("打开");
        let write = |cache: &mut DiskCache, stem: &str, cache_key: &str| {
            cache
                .put(
                    stem.to_owned(),
                    vec![0u8; 5],
                    DiskMeta {
                        cache_key: cache_key.to_owned(),
                        etag: None,
                        last_modified: None,
                        fresh_until_millis: 0,
                        stored_at_millis: 0,
                    },
                )
                .expect("落盘")
        };
        write(&mut cache, "s1", "card-1/x@v1");
        write(&mut cache, "s2", "card-1/y@v1");
        write(&mut cache, "s3", "card-2/x@v1");
        cache.remove_matching("card-1", "x");
        assert!(cache.get("s1").is_none(), "身份命中条目清扫");
        assert!(cache.get("s2").is_some());
        assert!(cache.get("s3").is_some());
        cache.remove_matching_scope("card-1");
        assert!(cache.get("s2").is_none());
        assert!(cache.get("s3").is_some());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn cache_store_without_disk_root_returns_miss_and_no_insert() {
        let store = CacheStore::new(&ResourceLimits::default());
        let key = CacheKey::external("https://x.test", "/f", "v");
        assert!(store.disk_get(&key).is_none(), "未装配 L2 一律未命中");
        assert!(
            !store.disk_insert(
                &key,
                vec![0u8; 2],
                DiskMeta {
                    cache_key: "external/f@v".into(),
                    etag: None,
                    last_modified: None,
                    fresh_until_millis: 0,
                    stored_at_millis: 0,
                },
                store.epoch()
            ),
            "未装配 L2 写入必为无副作用且不留半态"
        );
    }

    #[test]
    fn cache_store_disk_roundtrip_via_store() {
        let dir = scratch_dir("store-disk");
        let store = CacheStore::new(&ResourceLimits::default());
        store.attach_disk(dir.clone(), 64).expect("装配 L2");
        let key = CacheKey::external("https://x.test", "/f?q=1", "v9");
        let epoch = store.epoch();
        assert!(store.disk_insert(
            &key,
            b"body!".to_vec(),
            DiskMeta {
                cache_key: format!("{}/{}", key.scope, key.path),
                etag: Some("\"e\"".into()),
                last_modified: None,
                fresh_until_millis: u64::MAX,
                stored_at_millis: 1,
            },
            epoch
        ));
        let hit = store.disk_get(&key).expect("命中");
        assert_eq!(hit.body, b"body!".to_vec());
        assert_eq!(store.stats().l2_bytes, 5);
        store.invalidate_scope(&crate::uri::EXTERNAL_SCOPE.to_owned());
        assert!(store.disk_get(&key).is_none(), "作用域失效联动 L2");
        let _ = std::fs::remove_dir_all(dir);
    }
}
