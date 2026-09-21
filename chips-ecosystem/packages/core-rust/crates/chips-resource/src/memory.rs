//! 《04-资源管理设计》§3.2/§3.3 内置 MemoryProvider：运行时内存字节。
//!
//! 形态口径（§3.3 内置 Provider 表）：只读或会话内可写、**禁止持久化、
//! 不进入磁盘缓存**；写入 = 会话内支持（创建者会话关闭即整体失效）；
//! 目录列举 = 不支持（`RESOURCE_NOT_SUPPORTED`，`operation = list`）。
//! 能力三元组如实声明：`supports_write = true`（会话内写）、
//! `supports_streaming = true`（内存字节分片切分零成本）。
//! 授权面（《06.04》§4.3 行 9）由管理器判定矩阵与挂载入口共同收口：
//! 创建者会话内免重复校验读、`resources:write` 写、禁止跨会话传递。

use std::collections::BTreeMap;
use std::sync::{Mutex, MutexGuard, PoisonError};

use async_trait::async_trait;
use chips_core::ChipsError;

use crate::constants::DEFAULT_CHUNK_BYTES;
use crate::error::{ResourceError, ScopeOperation};
use crate::path_guard::VirtualPath;
use crate::provider::{
    ByteRange, DirectoryEntry, FileMetadata, ResourceAddress, ResourceMetadata, ResourceProvider,
    ResourceStream, VersionStamp,
};
use crate::scope::ScopeKind;
use crate::uri::MEMORY_SCOPE;

/// 单个内存条目：运行时字节 + 版本戳（每次成功写入递增）。
#[derive(Debug, Clone)]
struct MemoryEntry {
    bytes: Vec<u8>,
    version: VersionStamp,
}

/// 内置 MemoryProvider：扁平键空间（规范化虚拟路径），无目录层级。
#[derive(Debug, Default)]
pub struct MemoryProvider {
    entries: Mutex<BTreeMap<String, MemoryEntry>>,
    next_version: Mutex<u64>,
}

impl MemoryProvider {
    /// 构造空 Provider。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    fn store(&self) -> MutexGuard<'_, BTreeMap<String, MemoryEntry>> {
        self.entries.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn bump_version(&self) -> VersionStamp {
        let mut guard = self
            .next_version
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        *guard += 1;
        format!("mem-{}", *guard)
    }

    fn snapshot(&self, address: &ResourceAddress) -> Result<MemoryEntry, ChipsError> {
        self.store()
            .get(address.path.as_str())
            .cloned()
            .ok_or_else(|| {
                ResourceError::NotFound {
                    uri: address.uri.clone(),
                }
                .to_chips_error()
            })
    }

    fn put(&self, path: &str, bytes: &[u8]) -> MemoryEntry {
        let entry = MemoryEntry {
            bytes: bytes.to_vec(),
            version: self.bump_version(),
        };
        self.store().insert(path.to_owned(), entry.clone());
        entry
    }

    fn metadata_of(&self, address: &ResourceAddress, entry: &MemoryEntry) -> ResourceMetadata {
        ResourceMetadata {
            uri: address.uri.clone(),
            size: u64::try_from(entry.bytes.len()).unwrap_or(u64::MAX),
            mime_type: guess_mime_type(address.path.as_str()),
            version: entry.version.clone(),
            scope: ScopeKind::Memory,
        }
    }

    /// 清空全部内存条目：创建者会话关闭时由管理器调用（不落盘、整体失效）。
    pub fn clear(&self) {
        self.store().clear();
    }

    /// 在册条目数（测试与审计断言入口）。
    #[must_use]
    pub fn len(&self) -> usize {
        self.store().len()
    }

    /// 是否无在册条目。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// 《04》§3.4 判定规则的静态表形态：扩展名 → MIME，未知回退
/// `application/octet-stream`。
#[must_use]
pub fn guess_mime_type(path: &str) -> String {
    let extension = path
        .rsplit('/')
        .next()
        .and_then(|name| name.rsplit_once('.'))
        .map(|(_, extension)| extension.to_ascii_lowercase())
        .unwrap_or_default();
    let mime = match extension.as_str() {
        "txt" => "text/plain",
        "md" => "text/markdown",
        "json" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "wasm" => "application/wasm",
        "css" => "text/css",
        "js" => "text/javascript",
        _ => "application/octet-stream",
    };
    mime.to_owned()
}

fn not_supported(address: &ResourceAddress, operation: ScopeOperation) -> ChipsError {
    ResourceError::NotSupported {
        uri: address.uri.clone(),
        scope: ScopeKind::Memory,
        operation,
    }
    .to_chips_error()
}

fn memory_path_of(address: &ResourceAddress) -> Result<&VirtualPath, ChipsError> {
    if address.scope == MEMORY_SCOPE {
        return Ok(&address.path);
    }
    // 装配兜底：MemoryProvider 只承载 `memory` 保留作用域（《06》§2.1），
    // 越界寻址属启动期装配错误（《06》§7.2 协议层兜底口径）。
    Err(ResourceError::Internal.to_chips_error())
}

#[async_trait]
impl ResourceProvider for MemoryProvider {
    fn id(&self) -> &'static str {
        "memory"
    }

    fn supports_streaming(&self) -> bool {
        true
    }

    fn supports_write(&self) -> bool {
        true
    }

    async fn stat(&self, address: &ResourceAddress) -> Result<ResourceMetadata, ChipsError> {
        memory_path_of(address)?;
        let entry = self.snapshot(address)?;
        Ok(self.metadata_of(address, &entry))
    }

    async fn read_range(
        &self,
        address: &ResourceAddress,
        range: ByteRange,
    ) -> Result<Vec<u8>, ChipsError> {
        memory_path_of(address)?;
        let entry = self.snapshot(address)?;
        let start = usize::try_from(range.offset).unwrap_or(entry.bytes.len());
        let end = match range.length {
            Some(length) => {
                let length = usize::try_from(length).unwrap_or(entry.bytes.len());
                start.saturating_add(length).min(entry.bytes.len())
            }
            None => entry.bytes.len(),
        };
        if start >= end {
            return Ok(Vec::new());
        }
        Ok(entry.bytes[start..end].to_vec())
    }

    async fn open_stream(
        &self,
        address: &ResourceAddress,
    ) -> Result<Box<dyn ResourceStream>, ChipsError> {
        memory_path_of(address)?;
        let entry = self.snapshot(address)?;
        Ok(Box::new(MemoryStream {
            bytes: entry.bytes,
            cursor: 0,
        }))
    }

    async fn list_directory(
        &self,
        address: &ResourceAddress,
    ) -> Result<Vec<DirectoryEntry>, ChipsError> {
        Err(not_supported(address, ScopeOperation::List))
    }

    async fn write(
        &self,
        address: &ResourceAddress,
        data: &[u8],
    ) -> Result<ResourceMetadata, ChipsError> {
        let path = memory_path_of(address)?;
        let entry = self.put(path.as_str(), data);
        Ok(self.metadata_of(address, &entry))
    }

    async fn delete(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
        let path = memory_path_of(address)?;
        self.store().remove(path.as_str()).ok_or_else(|| {
            ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error()
        })?;
        Ok(())
    }

    async fn rename(&self, from: &ResourceAddress, to: &ResourceAddress) -> Result<(), ChipsError> {
        let (source, target) = (memory_path_of(from)?, memory_path_of(to)?);
        if source == target {
            return Ok(());
        }
        let mut entries = self.store();
        let entry = entries
            .remove(source.as_str())
            .ok_or_else(|| ResourceError::NotFound {
                uri: from.uri.clone(),
            })?;
        if entries.contains_key(target.as_str()) {
            // 目标已存在：不覆盖，源条目原样归还（《06》§7.2）。
            entries.insert(source.as_str().to_owned(), entry);
            return Err(ResourceError::AlreadyExists {
                uri: to.uri.clone(),
            }
            .to_chips_error());
        }
        drop(entries);
        self.put(target.as_str(), &entry.bytes);
        Ok(())
    }

    async fn copy(&self, from: &ResourceAddress, to: &ResourceAddress) -> Result<(), ChipsError> {
        let (source, target) = (memory_path_of(from)?, memory_path_of(to)?);
        let entry = self.snapshot(from)?;
        if source != target && self.store().contains_key(target.as_str()) {
            return Err(ResourceError::AlreadyExists {
                uri: to.uri.clone(),
            }
            .to_chips_error());
        }
        if source == target {
            return Ok(());
        }
        self.put(target.as_str(), &entry.bytes);
        Ok(())
    }

    async fn create_directory(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
        // 内存形态为扁平字节键空间，无目录层级（§3.3）。
        Err(not_supported(address, ScopeOperation::CreateDirectory))
    }

    async fn set_metadata(
        &self,
        address: &ResourceAddress,
        _metadata: FileMetadata,
    ) -> Result<(), ChipsError> {
        // 元数据（MIME/时间戳）按 §3.4 由路径与写入时刻派生，不开放修改；
        // 写入族操作类别就近归入 `write`（《06》§7.3 六词在册，无 metadata 词）。
        Err(not_supported(address, ScopeOperation::Write))
    }
}

/// MemoryProvider 流式游标：`next_chunk` 按上限切片，游标严格累进，
/// `None` 仅表示结尾（《04》§3.2）。
#[derive(Debug)]
pub struct MemoryStream {
    bytes: Vec<u8>,
    cursor: usize,
}

impl MemoryStream {
    /// 当前游标位置（测试断言用）。
    #[must_use]
    pub fn cursor(&self) -> usize {
        self.cursor
    }
}

#[async_trait]
impl ResourceStream for MemoryStream {
    async fn next_chunk(&mut self, max_bytes: usize) -> Result<Option<Vec<u8>>, ChipsError> {
        if self.cursor >= self.bytes.len() {
            return Ok(None);
        }
        let cap = max_bytes.clamp(1, DEFAULT_CHUNK_BYTES);
        let end = (self.cursor + cap).min(self.bytes.len());
        let chunk = self.bytes[self.cursor..end].to_vec();
        self.cursor = end;
        Ok(Some(chunk))
    }
}

#[cfg(test)]
mod tests {
    use super::{guess_mime_type, MemoryProvider, MemoryStream};
    use crate::error::ResourceError;
    use crate::path_guard::VirtualPath;
    use crate::provider::{
        ByteRange, FileMetadata, ResourceAddress, ResourceProvider, ResourceStream,
    };

    fn address(path: &str) -> ResourceAddress {
        ResourceAddress {
            scope: "memory".to_owned(),
            path: VirtualPath::from_validated(path.to_owned()),
            uri: format!("chips-resource://memory/{path}"),
        }
    }

    #[test]
    fn test_mime_static_table_and_fallback() {
        assert_eq!(guess_mime_type("dir/note.txt"), "text/plain");
        assert_eq!(guess_mime_type("a.JSON"), "application/json");
        assert_eq!(guess_mime_type("m.wasm"), "application/wasm");
        assert_eq!(guess_mime_type("noext"), "application/octet-stream");
        assert_eq!(guess_mime_type("deep/x.png"), "image/png");
    }

    #[tokio::test]
    async fn test_write_then_stat_read_range() {
        let provider = MemoryProvider::new();
        let addr = address("blob.bin");
        let meta = provider
            .write(&addr, b"hello memory")
            .await
            .expect("write ok");
        assert_eq!(meta.size, 12);
        assert_eq!(meta.mime_type, "application/octet-stream");
        assert_eq!(meta.scope, crate::scope::ScopeKind::Memory);
        assert!(meta.version.starts_with("mem-"));
        let stat = provider.stat(&addr).await.expect("stat ok");
        assert_eq!(stat.version, meta.version);
        let bytes = provider
            .read_range(
                &addr,
                ByteRange {
                    offset: 6,
                    length: Some(6),
                },
            )
            .await
            .expect("read ok");
        assert_eq!(bytes, b"memory".to_vec());
        let tail = provider
            .read_range(
                &addr,
                ByteRange {
                    offset: 0,
                    length: None,
                },
            )
            .await
            .expect("tail ok");
        assert_eq!(tail, b"hello memory".to_vec());
        assert_eq!(provider.len(), 1);
    }

    #[tokio::test]
    async fn test_missing_entries_report_not_found() {
        let provider = MemoryProvider::new();
        let addr = address("ghost.txt");
        let error = provider.stat(&addr).await.expect_err("stat 缺失必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
        let error = provider
            .read_range(
                &addr,
                ByteRange {
                    offset: 0,
                    length: Some(2),
                },
            )
            .await
            .expect_err("read 缺失必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
        let error = provider
            .delete(&addr)
            .await
            .expect_err("delete 缺失必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
        assert!(provider.is_empty());
    }

    #[tokio::test]
    async fn test_stream_chunks_monotonic_and_terminate() {
        let provider = MemoryProvider::new();
        let payload = vec![9u8; 300 * 1024];
        let addr = address("stream.bin");
        provider.write(&addr, &payload).await.expect("write ok");
        let mut stream = provider.open_stream(&addr).await.expect("stream ok");
        let mut consumed = 0usize;
        let mut pulls = 0usize;
        loop {
            let Some(chunk) = stream.next_chunk(128 * 1024).await.expect("chunk ok") else {
                break;
            };
            assert!(!chunk.is_empty(), "非结束分片不得为空");
            assert!(chunk.len() <= 128 * 1024);
            consumed += chunk.len();
            pulls += 1;
            assert!(pulls < 100, "游标必须推进，防死循环");
        }
        assert_eq!(consumed, payload.len());
        assert_eq!(pulls, 3);
        assert!(stream.next_chunk(16).await.expect("after eof").is_none());
    }

    #[tokio::test]
    async fn test_stream_empty_resource_ends_immediately() {
        let mut stream = MemoryStream {
            bytes: Vec::new(),
            cursor: 0,
        };
        assert!(stream.next_chunk(8).await.expect("eof ok").is_none());
        assert_eq!(stream.cursor(), 0);
    }

    #[tokio::test]
    async fn test_list_and_create_directory_not_supported() {
        let provider = MemoryProvider::new();
        let addr = address("dir");
        let error = provider
            .list_directory(&addr)
            .await
            .expect_err("目录列举不支持");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
        let details = error.details().expect("必须携带 scope details");
        assert_eq!(details["operation"], "list");
        assert_eq!(details["scope"], "memory");
        let error = provider
            .create_directory(&addr)
            .await
            .expect_err("目录层级不存在");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
        assert_eq!(
            error.details().expect("details")["operation"],
            "create_directory"
        );
        let error = provider
            .set_metadata(
                &addr,
                FileMetadata {
                    modified: None,
                    created: None,
                    permissions: None,
                },
            )
            .await
            .expect_err("元数据修改不开放");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
        assert_eq!(error.details().expect("details")["operation"], "write");
    }

    #[tokio::test]
    async fn test_rename_and_copy_never_overwrite() {
        let provider = MemoryProvider::new();
        provider
            .write(&address("src.txt"), b"content")
            .await
            .unwrap();
        provider
            .write(&address("taken.txt"), b"other")
            .await
            .unwrap();
        let error = provider
            .rename(&address("src.txt"), &address("taken.txt"))
            .await
            .expect_err("rename 不覆盖");
        assert_eq!(error.code(), crate::error::RESOURCE_ALREADY_EXISTS);
        // 失败 rename 必须无损：源与目标都在册。
        assert_eq!(provider.len(), 2);
        provider
            .rename(&address("src.txt"), &address("moved.txt"))
            .await
            .expect("rename ok");
        assert!(provider.stat(&address("src.txt")).await.is_err());
        let moved = provider.stat(&address("moved.txt")).await.expect("moved");
        assert_eq!(moved.size, 7);
        provider
            .copy(&address("moved.txt"), &address("copy.txt"))
            .await
            .expect("copy ok");
        let copied = provider
            .read_range(
                &address("copy.txt"),
                ByteRange {
                    offset: 0,
                    length: None,
                },
            )
            .await
            .expect("read copy");
        assert_eq!(copied, b"content".to_vec());
        let error = provider
            .copy(&address("moved.txt"), &address("copy.txt"))
            .await
            .expect_err("copy 不覆盖");
        assert_eq!(error.code(), crate::error::RESOURCE_ALREADY_EXISTS);
        let error = provider
            .copy(&address("ghost.txt"), &address("t.txt"))
            .await
            .expect_err("源缺失");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
        let error = provider
            .rename(&address("ghost.txt"), &address("t.txt"))
            .await
            .expect_err("源缺失");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_FOUND);
    }

    #[tokio::test]
    async fn test_delete_and_clear_session_eviction() {
        let provider = MemoryProvider::new();
        provider.write(&address("a.txt"), b"x").await.unwrap();
        provider.delete(&address("a.txt")).await.expect("delete ok");
        assert!(provider.is_empty());
        provider.write(&address("b.txt"), b"y").await.unwrap();
        provider.write(&address("c.txt"), b"z").await.unwrap();
        provider.clear();
        assert!(provider.is_empty(), "clear 即整体失效（不落盘）");
    }

    #[tokio::test]
    async fn test_version_increments_per_write() {
        let provider = MemoryProvider::new();
        let addr = address("v.txt");
        let v1 = provider.write(&addr, b"one").await.expect("v1").version;
        let v2 = provider.write(&addr, b"two").await.expect("v2").version;
        assert_ne!(v1, v2, "提交成功必须递增版本戳（《04》§4.10）");
        let v3 = provider.stat(&addr).await.expect("stat").version;
        assert_eq!(v2, v3);
    }

    #[tokio::test]
    async fn test_cross_scope_address_is_internal_guardrail() {
        let provider = MemoryProvider::new();
        let rogue = ResourceAddress {
            scope: "card-1".to_owned(),
            path: VirtualPath::from_validated("a.png".to_owned()),
            uri: "chips-resource://card-1/a.png".to_owned(),
        };
        let error = provider.write(&rogue, b"x").await.expect_err("装配兜底");
        assert_eq!(error.code(), crate::error::RESOURCE_INTERNAL);
    }

    #[test]
    fn test_resource_error_not_supported_details_shape() {
        // 直接锁 ResourceError 面（管理器预检复用同一形状）。
        let error = ResourceError::NotSupported {
            uri: "chips-resource://memory/dir".to_owned(),
            scope: crate::scope::ScopeKind::Memory,
            operation: crate::error::ScopeOperation::List,
        };
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
        let details = error.details().expect("details");
        assert_eq!(details["uri"], "chips-resource://memory/dir");
        assert_eq!(details["operation"], "list");
    }
}
