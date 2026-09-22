//! 《04-资源管理设计》§3.2/§3.3 内置 ArchiveProvider：ZIP Store 归档只读域
//! （段二 B3，《04.03》§3.3 表 ArchiveProvider 行）。
//!
//! 形态口径：承载 `.card` / `.box` / `.cpk` 归档文件的资源寻址；ZIP 解析
//! **复用 `chips-parser` 归档层公开读取面**（EOCD / ZIP64 / 中央目录 /
//! 索引，[`chips_parser::source::archive::ArchiveSource`]），本模块零
//! ZIP / Deflate 自实现（《04.03》§3.3「资源管理器不得重复实现 ZIP 解析」）。
//! Store 成员直取映射切片（《04.07》§7.2），Deflate 成员经解析器既有解码
//! 面呈现为解码流。
//!
//! 只读口径（《04.03》§3.3、《04.04》§4.8）：归档永不就地改写；写入族
//! （write/delete/rename/copy/create_directory/set_metadata）在 Provider
//! 纵深臂返回 `RESOURCE_READ_ONLY`（`details.uri` 取目标精确 uri，与
//! Manager 预检臂统一，《06.07》§7.3 / 工单044 裁定 §三.5-⑧-2）；文档
//! 保存流程整体重建归档并纳入 WriteCoordinator 路径锁归后续波次。
//!
//! 条目约束（《04.03》§3.3 尾部）：入域条目限普通文件（符号链接 / 设备
//! 文件在解析器索引期即拒绝整个归档）；条目名经 `PackagePath` 在册校验，
//! 寻址侧仍过 PathGuard（《06》§9.1）。列举面支持：目录树由成员路径
//! 前缀合成，目录态条目 `is_directory = true`（《04.04》§4.9 归档行）。

use std::collections::BTreeMap;
use std::io::Read;
use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use async_trait::async_trait;
use chips_core::ChipsError;
use chips_parser::source::archive::ArchiveSource;
use chips_parser::source::{ByteStream, DocumentSource, Mapping, PackagePath};

use crate::constants::DEFAULT_CHUNK_BYTES;
use crate::error::ResourceError;
use crate::memory::guess_mime_type;
use crate::provider::{
    ByteRange, DirectoryEntry, FileMetadata, ResourceAddress, ResourceMetadata, ResourceProvider,
    ResourceStream,
};
use crate::scope::{ScopeId, ScopeKind};

/// 在册 Provider 标识（注册表键；管理器挂载与测试共用）。
pub const ARCHIVE_PROVIDER_ID: &str = "archive";

/// 单个挂载：只读归档源 + 作用域种类（元数据 `scope` 字段如实回报）。
struct ArchiveMount {
    source: Arc<ArchiveSource>,
    kind: ScopeKind,
}

impl Clone for ArchiveMount {
    fn clone(&self) -> Self {
        Self {
            source: Arc::clone(&self.source),
            kind: self.kind,
        }
    }
}

/// 内置 ArchiveProvider：ZIP Store 归档只读作用域。
///
/// 挂载表由管理器在 `mount_archive` 时写入（作用域 ID → 归档源）；
/// 未挂载作用域的寻址属启动期装配错误，按 `RESOURCE_INTERNAL` 兜底
/// （与 Memory / Directory Provider 越界寻址口径同型，《06》§7.2）。
/// `chunk_limit` 为流式拉取单块上限的单一取值源投影视图（#140 §四.2 合流，
/// 段三 #185）：经 [`with_chunk_limit`](Self::with_chunk_limit) 由管理器
/// `ResourceLimits::chunk_bytes` 注入。
pub struct ArchiveProvider {
    mounts: Mutex<BTreeMap<ScopeId, ArchiveMount>>,
    chunk_limit: usize,
}

impl Default for ArchiveProvider {
    fn default() -> Self {
        Self::with_chunk_limit(DEFAULT_CHUNK_BYTES)
    }
}

impl std::fmt::Debug for ArchiveProvider {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let scopes: Vec<ScopeId> = self
            .mounts
            .lock()
            .map(|mounts| mounts.keys().cloned().collect())
            .unwrap_or_default();
        formatter
            .debug_struct("ArchiveProvider")
            .field("scopes", &scopes)
            .finish()
    }
}

impl ArchiveProvider {
    /// 构造空挂载 Provider（默认拉取上限）。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// 以生产装配路径注入的拉取上限构造（《04》§12 `chunkBytes`）。
    #[must_use]
    pub fn with_chunk_limit(chunk_limit: usize) -> Self {
        Self {
            mounts: Mutex::new(BTreeMap::new()),
            chunk_limit: chunk_limit.max(1),
        }
    }

    fn table(&self) -> MutexGuard<'_, BTreeMap<ScopeId, ArchiveMount>> {
        self.mounts.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// 挂载归档文件：`path` 必须存在且可经解析器归档层打开（登记失败
    /// 不降级，《06》§3.2）；重复挂载返回 `RESOURCE_ALREADY_EXISTS`。
    ///
    /// 错误口径（findings 登记）：文件缺失 → `RESOURCE_NOT_FOUND`；
    /// 非归档 / 结构损坏 / 含非普通文件条目（解析器索引期拒绝）→
    /// 协议层兜底 `RESOURCE_INTERNAL`（诊断写宿主日志，`details` 不
    /// 携带真实文件路径，《06》§7.1/§7.2）。
    pub fn attach_archive(
        &self,
        scope: &ScopeId,
        path: &Path,
        kind: ScopeKind,
    ) -> Result<(), ResourceError> {
        let scope_root_uri = format!("chips-resource://{scope}/");
        if self.table().contains_key(scope) {
            return Err(ResourceError::AlreadyExists { uri: scope.clone() });
        }
        let source = ArchiveSource::open(path, &chips_parser::model::ParseLimits::default())
            .map_err(|error| match error {
                chips_parser::error::DocumentError::Io { .. } => ResourceError::NotFound {
                    uri: scope_root_uri.clone(),
                },
                _ => ResourceError::Internal,
            })?;
        self.table().insert(
            scope.clone(),
            ArchiveMount {
                source: Arc::new(source),
                kind,
            },
        );
        Ok(())
    }

    /// 摘除作用域归档挂载（注销级联的 Provider 侧归还）；未在册返回
    /// `false`。
    pub fn detach_archive(&self, scope: &ScopeId) -> bool {
        self.table().remove(scope).is_some()
    }

    /// 作用域是否已挂载（只读探测）。
    #[must_use]
    pub fn is_mounted(&self, scope: &ScopeId) -> bool {
        self.table().contains_key(scope)
    }

    /// 挂载记录（未在册 → `RESOURCE_INTERNAL` 装配兜底）。
    fn mount(&self, address: &ResourceAddress) -> Result<ArchiveMount, ChipsError> {
        self.table()
            .get(&address.scope)
            .cloned()
            .ok_or_else(|| ResourceError::Internal.to_chips_error())
    }

    /// 虚拟路径 → 包内路径：`VirtualPath` 已过 PathGuard 在册校验，
    /// 残余失配属装配不变量破坏 → `RESOURCE_INTERNAL`（不自造 reason）。
    fn package_path(address: &ResourceAddress) -> Result<PackagePath, ChipsError> {
        PackagePath::new(address.path.as_str())
            .map_err(|_| ResourceError::Internal.to_chips_error())
    }

    /// 解析器域错误 → 资源协议错误（《06》§7.2 在册码，零自造）：
    /// 成员不存在 → `RESOURCE_NOT_FOUND`；其余（结构损坏 / 解码超限 /
    /// IO）→ 协议层兜底 `RESOURCE_INTERNAL`（findings 登记口径）。
    fn map_source_error(error: chips_parser::error::DocumentError, uri: &str) -> ChipsError {
        match error {
            chips_parser::error::DocumentError::NotFound { .. } => ResourceError::NotFound {
                uri: uri.to_owned(),
            },
            _ => ResourceError::Internal,
        }
        .to_chips_error()
    }

    /// 成员元数据行（缺失 → `RESOURCE_NOT_FOUND{uri}`）。
    fn member_meta(
        mount: &ArchiveMount,
        address: &ResourceAddress,
    ) -> Result<chips_parser::source::MemberMeta, ChipsError> {
        let path = Self::package_path(address)?;
        mount.source.member(&path).ok_or_else(|| {
            ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error()
        })
    }

    /// 归档条目版本戳（《04》§1.3：归档条目 CRC 的字符串形态）。
    fn version_of(meta: &chips_parser::source::MemberMeta) -> String {
        match meta.crc32 {
            Some(crc) => format!("crc32-{crc:08x}-{}", meta.size),
            None => format!("size-{}", meta.size),
        }
    }

    /// 写入族只读纵深臂（《04.03》§3.3 ArchiveProvider 行；Manager 预检
    /// 先行收口，此处为 Provider 纵深，uri 取目标精确形态）。
    fn read_only(address: &ResourceAddress) -> ChipsError {
        ResourceError::ReadOnly {
            uri: address.uri.clone(),
        }
        .to_chips_error()
    }
}

#[async_trait]
impl ResourceProvider for ArchiveProvider {
    fn id(&self) -> &'static str {
        ARCHIVE_PROVIDER_ID
    }

    fn supports_streaming(&self) -> bool {
        true
    }

    fn supports_write(&self) -> bool {
        false
    }

    async fn stat(&self, address: &ResourceAddress) -> Result<ResourceMetadata, ChipsError> {
        let mount = self.mount(address)?;
        let meta = Self::member_meta(&mount, address)?;
        Ok(ResourceMetadata {
            uri: address.uri.clone(),
            size: meta.size,
            mime_type: guess_mime_type(address.path.as_str()),
            version: Self::version_of(&meta),
            scope: mount.kind,
        })
    }

    async fn read_range(
        &self,
        address: &ResourceAddress,
        range: ByteRange,
    ) -> Result<Vec<u8>, ChipsError> {
        let mount = self.mount(address)?;
        let path = Self::package_path(address)?;
        mount
            .source
            .read_member_range(&path, range.offset, range.length)
            .map_err(|error| Self::map_source_error(error, &address.uri))
    }

    async fn open_stream(
        &self,
        address: &ResourceAddress,
    ) -> Result<Box<dyn ResourceStream>, ChipsError> {
        let mount = self.mount(address)?;
        let path = Self::package_path(address)?;
        let stream = mount
            .source
            .open_stream(&path)
            .map_err(|error| Self::map_source_error(error, &address.uri))?;
        let cursor = match stream {
            // Store 成员：映射切片游标（零解压，《04.07》§7.2）。
            ByteStream::Mapped {
                source,
                offset,
                length,
            } => StreamCursor::Mapped {
                mapping: source,
                offset,
                length,
            },
            // Deflate 成员：解析器限额内现场解码后的读游标。
            ByteStream::Decoded(reader) => StreamCursor::Decoded { reader },
        };
        Ok(Box::new(ArchiveStream {
            cursor,
            position: 0,
            chunk_limit: self.chunk_limit,
        }))
    }

    async fn list_directory(
        &self,
        address: &ResourceAddress,
    ) -> Result<Vec<DirectoryEntry>, ChipsError> {
        let mount = self.mount(address)?;
        let prefix = format!("{}/", address.path.as_str());
        let mut files: BTreeMap<String, (u64, i64)> = BTreeMap::new();
        let mut directories: BTreeSetLite = BTreeSetLite::default();
        let mut direct_hit = false;
        for (member_path, member) in mount.source.members() {
            let Some(rel) = member_path.as_str().strip_prefix(&prefix) else {
                continue;
            };
            direct_hit = true;
            match rel.find('/') {
                Some(cut) => {
                    let segment = &rel[..cut];
                    if list_hidden(segment) {
                        continue;
                    }
                    directories.insert(segment.to_owned());
                }
                None => {
                    if list_hidden(rel) {
                        continue;
                    }
                    files.insert(
                        rel.to_owned(),
                        (
                            member.meta.size,
                            modified_unix_seconds_opt(member.meta.modified),
                        ),
                    );
                }
            }
        }
        if !direct_hit {
            // 前缀下无任何成员：目录不存在或前缀本身是文件（《06》§7.2，
            // 与目录域同口径收口为 NOT_FOUND）。
            return Err(ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error());
        }
        let mut entries: Vec<DirectoryEntry> = directories
            .names()
            .map(|name| DirectoryEntry {
                name: name.clone(),
                is_directory: true,
                size: 0,
                modified_unix_seconds: 0,
            })
            .collect();
        entries.extend(
            files
                .into_iter()
                .map(|(name, (size, modified))| DirectoryEntry {
                    name,
                    is_directory: false,
                    size,
                    modified_unix_seconds: modified,
                }),
        );
        // 确定性输出：按条目名排序（同输入必同输出，《06》§5.1）。
        entries.sort_by(|left, right| left.name.cmp(&right.name));
        // 同名目录与文件并存（ZIP 扁平键空间允许）：目录优先呈现一次。
        entries.dedup_by(|left, right| left.name == right.name);
        Ok(entries)
    }

    async fn write(
        &self,
        address: &ResourceAddress,
        _data: &[u8],
    ) -> Result<ResourceMetadata, ChipsError> {
        Err(Self::read_only(address))
    }

    async fn delete(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
        Err(Self::read_only(address))
    }

    async fn rename(
        &self,
        from: &ResourceAddress,
        _to: &ResourceAddress,
    ) -> Result<(), ChipsError> {
        Err(Self::read_only(from))
    }

    async fn copy(&self, from: &ResourceAddress, _to: &ResourceAddress) -> Result<(), ChipsError> {
        Err(Self::read_only(from))
    }

    async fn create_directory(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
        Err(Self::read_only(address))
    }

    async fn set_metadata(
        &self,
        address: &ResourceAddress,
        _metadata: FileMetadata,
    ) -> Result<(), ChipsError> {
        Err(Self::read_only(address))
    }
}

/// 列举面过滤（与目录域同款《04.04》§4.10 口径）：隐藏点文件与
/// `Thumbs.db` 不呈现（归档条目限普通文件已由解析器索引期收口）。
fn list_hidden(name: &str) -> bool {
    name.starts_with('.') || name == "Thumbs.db"
}

/// 修改时间（Unix 秒；不可得为 0，与 `DirectoryEntry` 在册口径一致）。
fn modified_unix_seconds_opt(time: Option<std::time::SystemTime>) -> i64 {
    time.and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|elapsed| i64::try_from(elapsed.as_secs()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

/// 目录名集合（std BTreeSet 的薄封装，避免额外导入面）。
#[derive(Default)]
struct BTreeSetLite(BTreeMap<String, ()>);

impl BTreeSetLite {
    fn insert(&mut self, name: String) {
        self.0.insert(name, ());
    }

    fn names(&self) -> impl Iterator<Item = &String> {
        self.0.keys()
    }
}

/// 流游标载体：映射切片（Store）或解码读（Deflate）。
enum StreamCursor {
    Mapped {
        mapping: Arc<Mapping>,
        offset: u64,
        length: u64,
    },
    Decoded {
        reader: Box<dyn std::io::Read + Send>,
    },
}

/// ArchiveProvider 流式游标：块长 ∈ (0, min(`max_bytes`, 注入拉取上限)]，
/// `None` 唯一终结，游标自 0 严格累计（《04.03》§3.2 流契，与 `FileStream`
/// 同型；BUSY 占用由 `HandleTable` 强制，Provider 不重复记账）。
pub struct ArchiveStream {
    cursor: StreamCursor,
    position: u64,
    chunk_limit: usize,
}

impl ArchiveStream {
    /// 当前游标位置（等于此前全部已返回块长度之和，《04》§3.2）。
    #[must_use]
    pub fn cursor(&self) -> u64 {
        self.position
    }
}

/// 映射切片游标推进：`position` 单独借出，避免与 `self.cursor` 的
/// 字段级双借用冲突。
fn next_mapped(
    position: &mut u64,
    mapping: &Arc<Mapping>,
    offset: u64,
    length: u64,
    cap: usize,
) -> Result<Option<Vec<u8>>, ChipsError> {
    if *position >= length {
        return Ok(None);
    }
    let span = (length - *position).min(cap as u64);
    let bytes = mapping
        .slice(offset + *position, span)
        .ok_or_else(|| ResourceError::Internal.to_chips_error())?
        .to_vec();
    *position += bytes.len() as u64;
    Ok(Some(bytes))
}

#[async_trait]
impl ResourceStream for ArchiveStream {
    async fn next_chunk(&mut self, max_bytes: usize) -> Result<Option<Vec<u8>>, ChipsError> {
        let cap = max_bytes.clamp(1, self.chunk_limit);
        match &mut self.cursor {
            StreamCursor::Mapped {
                mapping,
                offset,
                length,
            } => next_mapped(&mut self.position, mapping, *offset, *length, cap),
            StreamCursor::Decoded { reader } => {
                let mut buffer = vec![0u8; cap];
                let mut filled = 0usize;
                while filled < cap {
                    match reader.read(&mut buffer[filled..]) {
                        Ok(0) => break,
                        Ok(read) => filled += read,
                        Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                        Err(_) => {
                            return Err(ResourceError::Internal.to_chips_error());
                        }
                    }
                }
                if filled == 0 {
                    return Ok(None);
                }
                buffer.truncate(filled);
                self.position += filled as u64;
                Ok(Some(buffer))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    use crate::error::{RESOURCE_INTERNAL, RESOURCE_NOT_FOUND, RESOURCE_READ_ONLY};
    use crate::path_guard::VirtualPath;

    /// 手工 ZIP 夹具（Store + Deflate + 目录条目 + 隐藏条目 + 嵌套路径）。
    fn crc32(data: &[u8]) -> u32 {
        // 与解析器同款的表无关朴素实现（测试夹具专用）。
        let mut crc: u32 = 0xFFFF_FFFF;
        for byte in data {
            crc ^= u32::from(*byte);
            for _ in 0..8 {
                crc = if crc & 1 == 1 {
                    (crc >> 1) ^ 0xEDB8_8320
                } else {
                    crc >> 1
                };
            }
        }
        !crc
    }

    fn entry_pair(
        name: &str,
        data: &[u8],
        stored: &[u8],
        method: u16,
        offset: u32,
    ) -> (Vec<u8>, Vec<u8>) {
        let name_bytes = name.as_bytes();
        let checksum = crc32(data);
        let mut local = Vec::new();
        local.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
        local.extend_from_slice(&20u16.to_le_bytes());
        local.extend_from_slice(&0x0800u16.to_le_bytes());
        local.extend_from_slice(&method.to_le_bytes());
        local.extend_from_slice(&0u16.to_le_bytes());
        local.extend_from_slice(&0x0021u16.to_le_bytes());
        local.extend_from_slice(&checksum.to_le_bytes());
        local.extend_from_slice(&(stored.len() as u32).to_le_bytes());
        local.extend_from_slice(&(data.len() as u32).to_le_bytes());
        local.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        local.extend_from_slice(&0u16.to_le_bytes());
        local.extend_from_slice(name_bytes);
        local.extend_from_slice(stored);
        let mut central = Vec::new();
        central.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&0x0800u16.to_le_bytes());
        central.extend_from_slice(&method.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0x0021u16.to_le_bytes());
        central.extend_from_slice(&checksum.to_le_bytes());
        central.extend_from_slice(&(stored.len() as u32).to_le_bytes());
        central.extend_from_slice(&(data.len() as u32).to_le_bytes());
        central.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u32.to_le_bytes());
        central.extend_from_slice(&offset.to_le_bytes());
        central.extend_from_slice(name_bytes);
        (local, central)
    }

    fn deflate_stored_block(plain: &[u8]) -> Vec<u8> {
        let len = u16::try_from(plain.len()).expect("夹具长度受限");
        let mut compressed = vec![0x01u8];
        compressed.extend_from_slice(&len.to_le_bytes());
        compressed.extend_from_slice(&(!len).to_le_bytes());
        compressed.extend_from_slice(plain);
        compressed
    }

    /// 归档夹具：目录条目 + 隐藏条目 + 嵌套 Store + Deflate。
    fn fixture_archive() -> Vec<u8> {
        let specs: Vec<(String, &[u8], u16)> = vec![
            ("content/".to_owned(), b"", 0),
            ("content/note.txt".to_owned(), b"hello archive", 0),
            (".DS_Store".to_owned(), b"junk", 0),
            ("Thumbs.db".to_owned(), b"junk", 0),
            ("content/deep/video.mp4".to_owned(), b"\0\x01\x02\x03", 0),
            ("content/deflated.txt".to_owned(), b"deflate-member", 8),
        ];
        let mut locals = Vec::new();
        let mut centrals = Vec::new();
        let mut offset = 0u32;
        for (name, data, method) in specs {
            let stored: Vec<u8> = if method == 8 {
                deflate_stored_block(data)
            } else {
                data.to_vec()
            };
            let (local, central) = entry_pair(&name, data, &stored, method, offset);
            offset += local.len() as u32;
            locals.push(local);
            centrals.push(central);
        }
        let mut archive = Vec::new();
        for local in &locals {
            archive.extend_from_slice(local);
        }
        let central_offset = archive.len() as u32;
        for central in &centrals {
            archive.extend_from_slice(central);
        }
        let central_size = archive.len() as u32 - central_offset;
        archive.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive.extend_from_slice(&(locals.len() as u16).to_le_bytes());
        archive.extend_from_slice(&(locals.len() as u16).to_le_bytes());
        archive.extend_from_slice(&central_size.to_le_bytes());
        archive.extend_from_slice(&central_offset.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive
    }

    struct TempArchive(PathBuf);

    impl TempArchive {
        fn new(bytes: &[u8]) -> Self {
            static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "chips-archive-{}-{}.card",
                std::process::id(),
                SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            ));
            std::fs::write(&path, bytes).expect("夹具归档必须可写");
            Self(path)
        }
    }

    impl Drop for TempArchive {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    fn address(scope: &str, path: &str) -> ResourceAddress {
        ResourceAddress {
            scope: scope.to_owned(),
            path: VirtualPath::from_validated(path.to_owned()),
            uri: format!("chips-resource://{scope}/{path}"),
        }
    }

    fn mounted(fixture: &TempArchive) -> ArchiveProvider {
        let provider = ArchiveProvider::new();
        provider
            .attach_archive(&"card-1".to_owned(), &fixture.0, ScopeKind::Document)
            .expect("挂载必须成功");
        provider
    }

    #[test]
    fn test_attach_detach_and_guards() {
        let fixture = TempArchive::new(&fixture_archive());
        let provider = ArchiveProvider::new();
        let scope = "card-1".to_owned();
        provider
            .attach_archive(&scope, &fixture.0, ScopeKind::Document)
            .expect("合法归档必须放行");
        assert!(provider.is_mounted(&scope));
        let error = provider
            .attach_archive(&scope, &fixture.0, ScopeKind::Document)
            .expect_err("重复挂载必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_ALREADY_EXISTS);
        // 缺失文件 → NOT_FOUND（登记失败不降级）。
        let error = provider
            .attach_archive(
                &"card-2".to_owned(),
                &fixture.0.with_extension("absent"),
                ScopeKind::Document,
            )
            .expect_err("缺失归档必须拒绝");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        // 非归档字节 → INTERNAL 兜底（结构损坏不降级为 NOT_FOUND）。
        let junk = TempArchive::new(b"not a zip at all");
        let error = provider
            .attach_archive(&"card-3".to_owned(), &junk.0, ScopeKind::Document)
            .expect_err("损坏归档必须拒绝");
        assert_eq!(error.code(), RESOURCE_INTERNAL);
        assert!(provider.detach_archive(&scope));
        assert!(!provider.detach_archive(&scope), "摘除幂等探测");
    }

    #[tokio::test]
    async fn test_stat_read_range_roundtrip() {
        let fixture = TempArchive::new(&fixture_archive());
        let provider = mounted(&fixture);
        let addr = address("card-1", "content/note.txt");
        let stat = provider.stat(&addr).await.expect("stat 放行");
        assert_eq!(stat.size, 13);
        assert_eq!(stat.mime_type, "text/plain");
        assert_eq!(stat.scope, ScopeKind::Document);
        assert!(stat.version.starts_with("crc32-"), "归档条目 CRC 版本戳");
        let mid = provider
            .read_range(
                &addr,
                ByteRange {
                    offset: 6,
                    length: Some(7),
                },
            )
            .await
            .expect("范围读");
        assert_eq!(mid, b"archive".to_vec());
        // Deflate 成员读取经解析器解码面。
        let deflated = address("card-1", "content/deflated.txt");
        let bytes = provider
            .read_range(
                &deflated,
                ByteRange {
                    offset: 0,
                    length: None,
                },
            )
            .await
            .expect("Deflate 范围读");
        assert_eq!(bytes, b"deflate-member".to_vec());
        // 成员不存在 → NOT_FOUND；目录态不作为资源。
        let error = provider
            .stat(&address("card-1", "content/ghost.txt"))
            .await
            .expect_err("缺失成员");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        let error = provider
            .stat(&address("card-1", "content"))
            .await
            .expect_err("目录态不作资源");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        let error = provider
            .stat(&address("card-9", "a"))
            .await
            .expect_err("未挂载作用域兜底");
        assert_eq!(error.code(), RESOURCE_INTERNAL);
    }

    #[tokio::test]
    async fn test_stream_shape_and_deflate_stream() {
        let fixture = TempArchive::new(&fixture_archive());
        let provider = mounted(&fixture);
        let mut stream = provider
            .open_stream(&address("card-1", "content/note.txt"))
            .await
            .expect("开流");
        let mut consumed: Vec<u8> = Vec::new();
        let mut pulls = 0;
        loop {
            let Some(chunk) = stream.next_chunk(4).await.expect("拉块") else {
                break;
            };
            assert!(!chunk.is_empty() && chunk.len() <= 4, "块形契约");
            consumed.extend_from_slice(&chunk);
            pulls += 1;
            assert!(pulls < 10, "游标推进");
        }
        assert_eq!(consumed, b"hello archive".to_vec());
        assert_eq!(consumed.len(), 13, "全文即游标累计");
        assert_eq!(pulls, 4, "4 字节块分 4 块读完 13 字节");
        assert!(stream.next_chunk(8).await.expect("结束后").is_none());
        // Deflate 成员流读同样可用。
        let mut stream = provider
            .open_stream(&address("card-1", "content/deflated.txt"))
            .await
            .expect("Deflate 开流");
        let mut total = Vec::new();
        while let Some(chunk) = stream.next_chunk(5).await.expect("拉块") {
            total.extend_from_slice(&chunk);
        }
        assert_eq!(total, b"deflate-member".to_vec());
    }

    #[tokio::test]
    async fn test_list_synthesizes_directory_tree() {
        let fixture = TempArchive::new(&fixture_archive());
        let provider = mounted(&fixture);
        let entries = provider
            .list_directory(&address("card-1", "content"))
            .await
            .expect("列举放行");
        let names: Vec<(&str, bool)> = entries
            .iter()
            .map(|entry| (entry.name.as_str(), entry.is_directory))
            .collect();
        assert_eq!(
            names,
            vec![("deep", true), ("deflated.txt", false), ("note.txt", false),],
            "隐藏条目过滤、目录态合成、按名定序"
        );
        let nested = provider
            .list_directory(&address("card-1", "content/deep"))
            .await
            .expect("嵌套列举");
        assert_eq!(nested.len(), 1);
        assert_eq!(nested[0].name, "video.mp4");
        // 前缀下无成员：NOT_FOUND（文件/不存在目录列举，同目录域口径）。
        let error = provider
            .list_directory(&address("card-1", "content/note.txt"))
            .await
            .expect_err("文件不可列举");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        let error = provider
            .list_directory(&address("card-1", "absent"))
            .await
            .expect_err("不存在目录不可列举");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    }

    #[tokio::test]
    async fn test_write_family_is_read_only() {
        let fixture = TempArchive::new(&fixture_archive());
        let provider = mounted(&fixture);
        let addr = address("card-1", "content/note.txt");
        let other = address("card-1", "content/other.txt");
        let cases: Vec<ChipsError> = vec![
            provider.write(&addr, b"x").await.unwrap_err(),
            provider.delete(&addr).await.unwrap_err(),
            provider.rename(&addr, &other).await.unwrap_err(),
            provider.copy(&addr, &other).await.unwrap_err(),
            provider.create_directory(&addr).await.unwrap_err(),
            provider
                .set_metadata(&addr, FileMetadata::default())
                .await
                .unwrap_err(),
        ];
        for error in cases {
            assert_eq!(error.code(), RESOURCE_READ_ONLY);
            // 工单044 ⑧-2 统一形：details.uri 取目标精确 uri。
            assert_eq!(error.details().unwrap()["uri"], addr.uri);
        }
    }
}
