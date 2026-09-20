//! 解析结果缓存 [`ParseCache`]（《06-文档解析器设计》§5.3、§5.4）。
//!
//! 两级缓存、同一实例内分离存放：
//!
//! - **单元级**：以 `(规范化路径, 成员指纹)`（外加影响解析结果的选项关键项）
//!   为键保存解析单元 `Arc`；跨修订复用——数据源指纹变化时，未变化成员的
//!   单元条目天然保持可命中（§5.4 增量重解析）；
//! - **句柄级（文档级）**：以 `(入口路径, 数据源指纹, 选项关键项)` 为键保存
//!   全量解析结果；缓存不持有过期数据源映射——只保存冻结的模型 `Arc`，
//!   数据源指纹变化即整体失效该入口路径的句柄条目（§5.3），单元条目按成员
//!   指纹独立保留。
//!
//! 淘汰策略：LRU + 内存配额（§5.3「LRU 淘汰并带内存配额」）。文档未给出
//! 配额数值（§9.1 明确限额由平台统一配置、解析器不内置第二套上限），因此
//! 配额是构造参数：[`ParseCache::new`] 使用 [`ParseCache::DEFAULT_MEMORY_BYTES`]
//! 与 [`ParseCache::DEFAULT_MAX_ENTRIES`] 的可配置默认值，宿主可经
//! [`ParseCache::with_quota`] 按平台配置收紧或放宽。设计稿没有 TTL 语义：
//! 「过期」一律由指纹失配（§5.4）与显式 [`ParseCache::invalidate_source`]
//! 触发，不引入时间性失效。
//!
//! 线程安全：内部状态由互斥锁保护，`ParseCache` 为 `Send + Sync`，可跨
//! L2 并行工作线程共享（§5.3 并行解析）。

use std::any::{Any, TypeId};
use std::collections::HashMap;
use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use crate::digest::sha256;
use crate::model::{
    ContentNode, DocumentMetadata, DocumentValue, Entry, ParseLimits, ParseOptions, StructureModel,
};
use crate::source::{MemberFingerprint, PackagePath, SourceFingerprint};

/// 选项关键项：只有影响解析结果（模型或诊断内容）的字段进入缓存键。
///
/// `parallelism` 只改并发度、不改结果，故不参与键（§5.3）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct OptionsKey {
    strict: bool,
    repair: bool,
    verify_hashes: bool,
    limits: ParseLimits,
}

impl OptionsKey {
    fn of(options: &ParseOptions) -> Self {
        Self {
            strict: options.strict,
            repair: options.repair,
            verify_hashes: options.verify_hashes,
            limits: options.limits,
        }
    }
}

/// 单元级缓存键：`(规范化路径, 成员指纹)` + 选项关键项（§5.3）。
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct UnitKey {
    path: PackagePath,
    fingerprint: MemberFingerprint,
    options: OptionsKey,
}

/// 句柄级缓存键：入口路径 + 数据源指纹摘要 + 选项关键项（§5.3、§5.4）。
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct DocumentKey {
    source_path: String,
    fingerprint_digest: String,
    options: OptionsKey,
}

/// 数据源指纹的稳定摘要：对 `serde_json` 序列化字节做 SHA-256。
///
/// `SourceFingerprint.members` 为有序 `Vec`，序列化字节对同一指纹恒定，
/// 摘要即可作为 `HashMap` 键（不承担安全职责，仅做等值鉴别）。
fn fingerprint_digest_of(source: &SourceFingerprint) -> String {
    let bytes = serde_json::to_vec(source).unwrap_or_default();
    sha256(&bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// 缓存中的解析单元（§5.3「保存解析单元 `Arc`」）。
///
/// 每个变体对应一个惰性层级（§5.1）的单元产物；全部为冻结模型，
/// 不持有任何数据源映射或资源字节。
#[derive(Debug, Clone)]
pub enum ParsedUnit {
    /// L0：metadata 成员解析产物。
    Metadata(Arc<DocumentMetadata>),
    /// L1：structure 成员解析产物。
    Structure(Arc<StructureModel>),
    /// L2：单个内容节点解析产物。
    Content(Arc<ContentNode>),
    /// L2：箱子条目集合解析产物。
    Entries(Arc<Vec<Entry>>),
    /// L2：布局配置（`.box/content.yaml`）解析产物。
    LayoutConfig(Arc<DocumentValue>),
}

impl ParsedUnit {
    /// 单元内存占用估算（缓存配额核算用，与 `ContentNode::memory_hint`
    /// 同口径的粗略近似，不承担精确计费职责）。
    #[must_use]
    pub fn memory_bytes(&self) -> usize {
        match self {
            Self::Metadata(metadata) => serde_json::to_vec(metadata.as_ref())
                .map(|bytes| bytes.len())
                .unwrap_or(0)
                + std::mem::size_of::<DocumentMetadata>(),
            Self::Structure(structure) => serde_json::to_vec(structure.as_ref())
                .map(|bytes| bytes.len())
                .unwrap_or(0)
                + std::mem::size_of::<StructureModel>(),
            Self::Content(node) => node.memory_hint(),
            Self::Entries(entries) => entries
                .iter()
                .map(|entry| {
                    entry.entry_id.len()
                        + entry.url.len()
                        + entry
                            .snapshot
                            .as_ref()
                            .map_or(0, DocumentValue::estimated_bytes)
                        + entry
                            .layout_hints
                            .as_ref()
                            .map_or(0, DocumentValue::estimated_bytes)
                        + 64
                })
                .sum::<usize>()
                + std::mem::size_of::<Vec<Entry>>(),
            Self::LayoutConfig(value) => value.estimated_bytes(),
        }
    }

    /// 变体的产物类型标识（观测与测试用）。
    #[must_use]
    pub fn value_type_id(&self) -> TypeId {
        match self {
            Self::Metadata(_) => TypeId::of::<DocumentMetadata>(),
            Self::Structure(_) => TypeId::of::<StructureModel>(),
            Self::Content(_) => TypeId::of::<ContentNode>(),
            Self::Entries(_) => TypeId::of::<Entry>(),
            Self::LayoutConfig(_) => TypeId::of::<DocumentValue>(),
        }
    }

    /// 按 metadata 单元读取。
    #[must_use]
    pub fn as_metadata(&self) -> Option<&Arc<DocumentMetadata>> {
        match self {
            Self::Metadata(value) => Some(value),
            _ => None,
        }
    }

    /// 按 structure 单元读取。
    #[must_use]
    pub fn as_structure(&self) -> Option<&Arc<StructureModel>> {
        match self {
            Self::Structure(value) => Some(value),
            _ => None,
        }
    }

    /// 按内容节点单元读取。
    #[must_use]
    pub fn as_content(&self) -> Option<&Arc<ContentNode>> {
        match self {
            Self::Content(value) => Some(value),
            _ => None,
        }
    }

    /// 按条目集合单元读取。
    #[must_use]
    pub fn as_entries(&self) -> Option<&Arc<Vec<Entry>>> {
        match self {
            Self::Entries(value) => Some(value),
            _ => None,
        }
    }

    /// 按布局配置单元读取。
    #[must_use]
    pub fn as_layout_config(&self) -> Option<&Arc<DocumentValue>> {
        match self {
            Self::LayoutConfig(value) => Some(value),
            _ => None,
        }
    }
}

/// 缓存内部条目：值 + 内存占用 + LRU 时间戳（单调逻辑时钟）。
struct CachedEntry<V> {
    value: V,
    memory: usize,
    last_used: u64,
}

/// 两级缓存的共享状态（单锁保证两级统计一致；临界区无 IO）。
struct CacheState {
    units: HashMap<UnitKey, CachedEntry<ParsedUnit>>,
    documents: HashMap<DocumentKey, CachedEntry<Arc<dyn Any + Send + Sync>>>,
    unit_memory: usize,
    document_memory: usize,
}

/// 解析结果缓存（§5.3）。`Send + Sync`，可跨句柄与并行工作线程共享。
pub struct ParseCache {
    state: Mutex<CacheState>,
    clock: AtomicU64,
    max_memory_bytes: usize,
    max_entries: usize,
}

/// 手工 `Debug`：只展示配额与规模观测面，不遍历缓存内容
/// （条目值含 `Arc<dyn Any>`，无统一 `Debug` 形态）。
impl fmt::Debug for ParseCache {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let (units, documents, memory) = self.stats();
        formatter
            .debug_struct("ParseCache")
            .field("max_memory_bytes", &self.max_memory_bytes)
            .field("max_entries", &self.max_entries)
            .field("units", &units)
            .field("documents", &documents)
            .field("memory_bytes", &memory)
            .finish()
    }
}

impl ParseCache {
    /// 默认内存配额（64 MiB）。文档未定值（§9.1 限额由平台统一配置），
    /// 此默认值为工程配置项，宿主可经 [`ParseCache::with_quota`] 覆盖。
    pub const DEFAULT_MEMORY_BYTES: usize = 64 * 1024 * 1024;

    /// 默认条目总数上限（两级合计）。对应 §9.4「无界缓存」禁令的工程
    /// 兜底值，可由 [`ParseCache::with_quota`] 覆盖。
    pub const DEFAULT_MAX_ENTRIES: usize = 4096;

    /// 以默认配额创建空缓存。
    #[must_use]
    pub fn new() -> Self {
        Self::with_quota(Self::DEFAULT_MEMORY_BYTES, Self::DEFAULT_MAX_ENTRIES)
    }

    /// 以指定内存配额与条目总数上限创建空缓存。
    ///
    /// 两个上界都不可为零：为零时缓存没有可容纳的条目，因此至少取 1。
    #[must_use]
    pub fn with_quota(max_memory_bytes: usize, max_entries: usize) -> Self {
        Self {
            state: Mutex::new(CacheState {
                units: HashMap::new(),
                documents: HashMap::new(),
                unit_memory: 0,
                document_memory: 0,
            }),
            clock: AtomicU64::new(0),
            max_memory_bytes: max_memory_bytes.max(1),
            max_entries: max_entries.max(1),
        }
    }

    /// 读取单元级缓存（§5.4 增量重解析：同路径同成员指纹同选项即命中）。
    #[must_use]
    pub fn get_unit(
        &self,
        path: &PackagePath,
        fingerprint: MemberFingerprint,
        options: &ParseOptions,
    ) -> Option<ParsedUnit> {
        let key = UnitKey {
            path: path.clone(),
            fingerprint,
            options: OptionsKey::of(options),
        };
        let mut state = self.lock();
        let now = self.tick();
        let entry = state.units.get_mut(&key)?;
        entry.last_used = now;
        Some(entry.value.clone())
    }

    /// 写入单元级缓存；单条超出内存配额的条目不进入缓存（防止无界
    /// 增长），写入后按 LRU 淘汰到配额之内。
    pub fn insert_unit(
        &self,
        path: &PackagePath,
        fingerprint: MemberFingerprint,
        options: &ParseOptions,
        unit: ParsedUnit,
    ) {
        let memory = unit.memory_bytes();
        if memory > self.max_memory_bytes {
            return;
        }
        let key = UnitKey {
            path: path.clone(),
            fingerprint,
            options: OptionsKey::of(options),
        };
        let now = self.tick();
        let mut state = self.lock();
        if let Some(previous) = state
            .units
            .insert(key, CachedEntry { value: unit, memory, last_used: now })
        {
            state.unit_memory = state.unit_memory.saturating_sub(previous.memory);
        }
        state.unit_memory = state.unit_memory.saturating_add(memory);
        self.evict(&mut state);
    }

    /// 读取句柄级缓存的解析结果；类型不符或键未命中都返回 `None`。
    #[must_use]
    pub fn get_document<T: Any + Send + Sync>(
        &self,
        source_path: &str,
        source: &SourceFingerprint,
        options: &ParseOptions,
    ) -> Option<Arc<T>> {
        let key = DocumentKey {
            source_path: source_path.to_owned(),
            fingerprint_digest: fingerprint_digest_of(source),
            options: OptionsKey::of(options),
        };
        let mut state = self.lock();
        let now = self.tick();
        let entry = state.documents.get_mut(&key)?;
        entry.last_used = now;
        entry.value.clone().downcast::<T>().ok()
    }

    /// 写入句柄级缓存的解析结果。同一入口路径下指纹不同的旧句柄条目
    /// 整体失效（§5.3「数据源指纹变化即整体失效该路径的句柄条目」），
    /// 单元条目不受影响、按成员指纹继续复用。
    pub fn insert_document<T: Any + Send + Sync>(
        &self,
        source_path: &str,
        source: &SourceFingerprint,
        options: &ParseOptions,
        value: Arc<T>,
    ) {
        let memory = std::mem::size_of_val(value.as_ref());
        if memory > self.max_memory_bytes {
            return;
        }
        let digest = fingerprint_digest_of(source);
        let now = self.tick();
        let mut state = self.lock();
        let stale_keys: Vec<DocumentKey> = state
            .documents
            .keys()
            .filter(|existing| {
                existing.source_path == source_path && existing.fingerprint_digest != digest
            })
            .cloned()
            .collect();
        for stale in stale_keys {
            if let Some(entry) = state.documents.remove(&stale) {
                state.document_memory = state.document_memory.saturating_sub(entry.memory);
            }
        }
        let key = DocumentKey {
            source_path: source_path.to_owned(),
            fingerprint_digest: digest,
            options: OptionsKey::of(options),
        };
        if let Some(previous) =
            state.documents.insert(key, CachedEntry { value, memory, last_used: now })
        {
            state.document_memory = state.document_memory.saturating_sub(previous.memory);
        }
        state.document_memory = state.document_memory.saturating_add(memory);
        self.evict(&mut state);
    }

    /// 整体失效指定入口路径的句柄级条目（数据源指纹变化 / 文档关闭时由
    /// 调用方触发）；单元级条目按指纹保留（§5.3）。
    pub fn invalidate_source(&self, source_path: &str) {
        let mut state = self.lock();
        let keys: Vec<DocumentKey> = state
            .documents
            .keys()
            .filter(|existing| existing.source_path == source_path)
            .cloned()
            .collect();
        for key in keys {
            if let Some(entry) = state.documents.remove(&key) {
                state.document_memory = state.document_memory.saturating_sub(entry.memory);
            }
        }
    }

    /// 清空全部两级缓存。
    pub fn clear(&self) {
        let mut state = self.lock();
        state.units.clear();
        state.documents.clear();
        state.unit_memory = 0;
        state.document_memory = 0;
    }

    /// 当前统计：`(单元数, 句柄数, 估算内存字节)`（监控与测试观测面）。
    #[must_use]
    pub fn stats(&self) -> (usize, usize, usize) {
        let state = self.lock();
        (
            state.units.len(),
            state.documents.len(),
            state.unit_memory + state.document_memory,
        )
    }

    /// 缓存是否为空。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        let state = self.lock();
        state.units.is_empty() && state.documents.is_empty()
    }

    /// 取锁（中毒时继续：缓存条目不存在必须保持一致的跨线程不变量）。
    fn lock(&self) -> MutexGuard<'_, CacheState> {
        self.state.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// 推进并读取 LRU 逻辑时钟。
    fn tick(&self) -> u64 {
        self.clock.fetch_add(1, Ordering::Relaxed) + 1
    }

    /// LRU 淘汰：先句柄级后单元级，直到条目数与内存都回到配额之内。
    ///
    /// 句柄条目优先淘汰：其内容可由单元条目按 §5.4 增量重建，淘汰代价低。
    fn evict(&self, state: &mut CacheState) {
        loop {
            let total_entries = state.units.len() + state.documents.len();
            let total_memory = state.unit_memory + state.document_memory;
            if total_entries <= self.max_entries && total_memory <= self.max_memory_bytes {
                return;
            }
            if let Some(key) = state
                .documents
                .iter()
                .min_by_key(|(_, entry)| entry.last_used)
                .map(|(key, _)| key.clone())
            {
                if let Some(entry) = state.documents.remove(&key) {
                    state.document_memory = state.document_memory.saturating_sub(entry.memory);
                }
                continue;
            }
            let oldest = state
                .units
                .iter()
                .min_by_key(|(_, entry)| entry.last_used)
                .map(|(key, _)| key.clone());
            let Some(key) = oldest else {
                return;
            };
            if let Some(entry) = state.units.remove(&key) {
                state.unit_memory = state.unit_memory.saturating_sub(entry.memory);
            }
        }
    }
}

impl Default for ParseCache {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{NodeId, Tag};
    use crate::source::SourceKind;
    use std::thread;

    fn options() -> ParseOptions {
        ParseOptions::default()
    }

    fn member_fingerprint(size: u64, crc32: Option<u32>) -> MemberFingerprint {
        MemberFingerprint { size, modified_millis: None, crc32 }
    }

    fn content_node(name: &str) -> Arc<ContentNode> {
        Arc::new(ContentNode {
            node_id: NodeId::new("a1B2c3D4e5").expect("合法标识"),
            file: PackagePath::new("content/a1B2c3D4e5.yaml").expect("合法路径"),
            card_type: name.to_owned(),
            value: DocumentValue::String("x".repeat(100)),
            diagnostics: Vec::new(),
        })
    }

    fn card_metadata() -> Arc<DocumentMetadata> {
        Arc::new(DocumentMetadata::Card(CardMetadataFixture::value()))
    }

    /// 测试专用构造入口：最小合法卡片元数据。
    struct CardMetadataFixture;

    impl CardMetadataFixture {
        fn value() -> crate::model::CardMetadata {
            crate::model::CardMetadata {
                chip_standards_version: "1.0.0".to_owned(),
                card_id: "a1B2c3D4e5".to_owned(),
                name: "缓存夹具".to_owned(),
                created_at: "2026-01-15T08:00:00.000Z".to_owned(),
                modified_at: "2026-01-15T08:00:00.000Z".to_owned(),
                cover_ratio: None,
                tags: Vec::<Tag>::new(),
                theme: None,
                visibility: None,
                downloadable: None,
                remixable: None,
                commentable: None,
                license: None,
                age_rating: None,
                content_warning: None,
                file_info: None,
            }
        }
    }

    fn source(size: u64) -> SourceFingerprint {
        SourceFingerprint {
            kind: SourceKind::Directory,
            members: vec![(
                PackagePath::new(".card/metadata.yaml").expect("合法路径"),
                member_fingerprint(size, None),
            )],
        }
    }

    #[test]
    fn test_parse_cache_is_send_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<ParseCache>();
        assert_send_sync::<ParsedUnit>();
    }

    #[test]
    fn test_unit_hit_miss_by_fingerprint() {
        let cache = ParseCache::new();
        let path = PackagePath::new("content/a1B2c3D4e5.yaml").expect("合法路径");
        let fingerprint = member_fingerprint(10, Some(1));
        assert!(cache.get_unit(&path, fingerprint, &options()).is_none());
        cache.insert_unit(
            &path,
            fingerprint,
            &options(),
            ParsedUnit::Content(content_node("base.image")),
        );
        let hit = cache.get_unit(&path, fingerprint, &options()).expect("同指纹必须命中");
        assert_eq!(hit.as_content().expect("内容单元").card_type, "base.image");
        // 成员指纹变化（尺寸变化）即未命中（§5.4 增量重解析口径）。
        let changed = member_fingerprint(11, Some(1));
        assert!(cache.get_unit(&path, changed, &options()).is_none());
        assert!(cache.get_unit(&path, fingerprint, &options()).is_some(), "旧条目不受影响");
    }

    #[test]
    fn test_unit_options_key_semantics() {
        let cache = ParseCache::new();
        let path = PackagePath::new("content/a1B2c3D4e5.yaml").expect("合法路径");
        let fingerprint = member_fingerprint(10, None);
        cache.insert_unit(
            &path,
            fingerprint,
            &options(),
            ParsedUnit::Content(content_node("base.score")),
        );
        // `parallelism` 不改变解析结果，不参与键。
        let parallel_only = ParseOptions { parallelism: 8, ..ParseOptions::default() };
        assert!(cache.get_unit(&path, fingerprint, &parallel_only).is_some());
        // `strict` 改变诊断升级结果，必须区分键。
        let strict = ParseOptions { strict: true, ..ParseOptions::default() };
        assert!(cache.get_unit(&path, fingerprint, &strict).is_none());
        // 限额变化同样区分键。
        let limits_changed = ParseOptions {
            limits: ParseLimits { max_aliases: 9, ..ParseLimits::default() },
            ..ParseOptions::default()
        };
        assert!(cache.get_unit(&path, fingerprint, &limits_changed).is_none());
    }

    #[test]
    fn test_unit_lru_eviction_by_entry_count() {
        let cache = ParseCache::with_quota(1024 * 1024, 2);
        let make = |name: &str| PackagePath::new(name).expect("合法路径");
        let fingerprint = member_fingerprint(10, None);
        let a = make("content/aaaaaaaaaa.yaml");
        let b = make("content/bbbbbbbbbb.yaml");
        let c = make("content/cccccccccc.yaml");
        cache.insert_unit(&a, fingerprint, &options(), ParsedUnit::Content(content_node("a")));
        cache.insert_unit(&b, fingerprint, &options(), ParsedUnit::Content(content_node("b")));
        // 触碰 a，使 b 成为最久未用。
        assert!(cache.get_unit(&a, fingerprint, &options()).is_some());
        cache.insert_unit(&c, fingerprint, &options(), ParsedUnit::Content(content_node("c")));
        let (units, documents, _) = cache.stats();
        assert_eq!((units, documents), (2, 0));
        assert!(cache.get_unit(&a, fingerprint, &options()).is_some(), "最近使用必须保留");
        assert!(cache.get_unit(&c, fingerprint, &options()).is_some());
        assert!(cache.get_unit(&b, fingerprint, &options()).is_none(), "最久未用必须淘汰");
    }

    #[test]
    fn test_memory_quota_eviction_and_oversize_rejection() {
        // 每个内容单元约 132 字节：配额 200 允许一条、装不下两条，
        // 第二条写入必须触发内存淘汰。
        let cache = ParseCache::with_quota(200, 100);
        let fingerprint = member_fingerprint(10, None);
        let a = PackagePath::new("content/aaaaaaaaaa.yaml").expect("合法路径");
        let b = PackagePath::new("content/bbbbbbbbbb.yaml").expect("合法路径");
        cache.insert_unit(&a, fingerprint, &options(), ParsedUnit::Content(content_node("a")));
        let first = cache.stats().2;
        assert!(first <= 200 && first > 0);
        cache.insert_unit(&b, fingerprint, &options(), ParsedUnit::Content(content_node("b")));
        let (units, _, memory) = cache.stats();
        assert!(memory <= 200, "总内存必须收敛在配额内");
        assert_eq!(units, 1, "超配额后必须淘汰旧单元");
        // 单条超过整份配额的单元不进入缓存（§9.4 无界缓存禁令）。
        let huge = Arc::new(ContentNode {
            node_id: NodeId::new("d1E2f3G4h5").expect("合法标识"),
            file: PackagePath::new("content/d1E2f3G4h5.yaml").expect("合法路径"),
            card_type: "base.richtext".to_owned(),
            value: DocumentValue::String("y".repeat(10_000)),
            diagnostics: Vec::new(),
        });
        let path = huge.file.clone();
        cache.insert_unit(&path, fingerprint, &options(), ParsedUnit::Content(huge));
        assert!(cache.get_unit(&path, fingerprint, &options()).is_none());
    }

    #[test]
    fn test_document_level_fingerprint_invalidation() {
        let cache = ParseCache::new();
        let old_source = source(10);
        let new_source = source(11);
        let unit_path = PackagePath::new(".card/metadata.yaml").expect("合法路径");
        let unit_fingerprint = member_fingerprint(10, None);
        cache.insert_unit(
            &unit_path,
            unit_fingerprint,
            &options(),
            ParsedUnit::Metadata(card_metadata()),
        );
        assert!(cache
            .get_document::<DocumentMetadata>("/tmp/demo.card", &old_source, &options())
            .is_none());
        cache.insert_document("/tmp/demo.card", &old_source, &options(), card_metadata());
        assert!(cache
            .get_document::<DocumentMetadata>("/tmp/demo.card", &old_source, &options())
            .is_some());
        // 指纹变化写入新句柄条目：该路径旧条目整体失效（§5.3），
        // 单元条目按成员指纹保留并跨修订复用（§5.4）。
        cache.insert_document("/tmp/demo.card", &new_source, &options(), card_metadata());
        assert!(cache
            .get_document::<DocumentMetadata>("/tmp/demo.card", &old_source, &options())
            .is_none(),
            "旧指纹句柄条目必须整体失效");
        assert!(cache
            .get_document::<DocumentMetadata>("/tmp/demo.card", &new_source, &options())
            .is_some());
        assert!(
            cache.get_unit(&unit_path, unit_fingerprint, &options()).is_some(),
            "未变化成员的单元条目必须跨修订保留"
        );
        // 显式失效只清句柄条目、不动单元条目。
        cache.invalidate_source("/tmp/demo.card");
        assert_eq!(cache.stats().1, 0);
        assert!(cache.get_unit(&unit_path, unit_fingerprint, &options()).is_some());
    }

    #[test]
    fn test_document_type_mismatch_and_path_isolation() {
        let cache = ParseCache::new();
        let fingerprint = source(10);
        cache.insert_document("/tmp/a.card", &fingerprint, &options(), card_metadata());
        assert!(
            cache.get_document::<ContentNode>("/tmp/a.card", &fingerprint, &options()).is_none(),
            "类型不符视为未命中"
        );
        assert!(cache
            .get_document::<DocumentMetadata>("/tmp/b.card", &fingerprint, &options())
            .is_none(),
            "不同入口路径互不命中");
        cache.clear();
        assert!(cache.is_empty());
    }

    #[test]
    fn test_cross_thread_reuse() {
        let cache = Arc::new(ParseCache::new());
        let path = PackagePath::new("content/a1B2c3D4e5.yaml").expect("合法路径");
        let fingerprint = member_fingerprint(10, Some(7));
        let writer = Arc::clone(&cache);
        let writer_path = path.clone();
        thread::spawn(move || {
            writer.insert_unit(
                &writer_path,
                fingerprint,
                &options(),
                ParsedUnit::Content(content_node("base.music")),
            );
        })
        .join()
        .expect("写线程正常退出");
        let reader = Arc::clone(&cache);
        let reader_path = path.clone();
        let handle = thread::spawn(move || {
            reader.get_unit(&reader_path, fingerprint, &options()).map(|unit| {
                unit.as_content().map(|node| node.card_type.clone())
            })
        });
        assert_eq!(
            handle.join().expect("读线程正常退出"),
            Some(Some("base.music".to_owned())),
            "跨线程必须可复用同一缓存"
        );
    }
}
