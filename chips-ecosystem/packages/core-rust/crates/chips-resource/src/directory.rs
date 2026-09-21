//! 《04-资源管理设计》§3.2/§3.3 内置 DirectoryProvider：目录态文件系统作用域。
//!
//! 形态口径（§3.3 内置 Provider 表）：承载目录态 `.card` / `.box`、工作区目录、
//! 插件目录与用户授权路径（`dialog:*` 临时作用域）；复用解析器目录语义
//! （不跟随符号链接、忽略系统生成物）；文件 `seek` 范围读；在册支持
//! `write` / `delete` / `rename` / `copy` / `create_directory` / `list_directory`；
//! 能力三元组如实声明：`supports_write = true`、`supports_streaming = true`
//! （逐块拉取、游标自 0 严格累计、`None` 唯一结束，《04》§3.2 细则）。
//!
//! 路径安全（《04》§9.2、《06》§9.1）：`VirtualPath` → 宿主路径拼接唯一经
//! [`crate::path_guard::resolve_within_root`]（组件语义根校验 + 最深存在前缀
//! `canonicalize` 复检）；符号链接指向作用域根外一律
//! `RESOURCE_PATH_INVALID` + `reason = symlink`；`details` 不携带真实文件系统
//! 路径（《06》§7.1，只载规范 URI 与虚拟路径文本）。
//!
//! 写入原子性（《04.04》§4.8/§4.9）：一次性 `write` 与 `copy` 走同目录隐藏
//! 临时文件 + `sync_all` + `rename` 原子替换；失败清理临时物、不产生半写
//! 文件；宿主写侧 IO 错误 → `RESOURCE_WRITE_FAILED`（《06》§7.2 磁盘臂）。

use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::UNIX_EPOCH;

use async_trait::async_trait;
use chips_core::ChipsError;

use crate::constants::DEFAULT_CHUNK_BYTES;
use crate::error::{ResourceError, ScopeOperation};
use crate::memory::guess_mime_type;
use crate::path_guard::resolve_within_root;
use crate::provider::{
    ByteRange, DirectoryEntry, FileMetadata, ResourceAddress, ResourceMetadata, ResourceProvider,
    ResourceStream, VersionStamp,
};
use crate::scope::{ScopeId, ScopeKind};

/// 在册 Provider 标识（注册表键；管理器挂载与测试共用）。
pub const DIRECTORY_PROVIDER_ID: &str = "directory";

/// 范围读与拷贝落盘的流式中转缓冲大小（64 KiB，《04.04》§4.9「大文件流式
/// 拷贝，不整体加载到内存」的工程承载；非协议面参数）。
const TRANSFER_BUFFER_BYTES: usize = 64 * 1024;

/// 单个挂载：规范化宿主目录根 + 作用域种类（元数据 `scope` 字段如实回报）。
#[derive(Debug, Clone)]
struct DirectoryMount {
    root: PathBuf,
    kind: ScopeKind,
}

/// 内置 DirectoryProvider：真实文件系统目录作用域。
///
/// 挂载表由管理器在 `mount_directory` 时写入（作用域 ID → 规范化根）；
/// 未挂载作用域的寻址属启动期装配错误，按 `RESOURCE_INTERNAL` 兜底
/// （与 MemoryProvider 越界寻址口径同型，《06》§7.2 协议层兜底）。
#[derive(Debug, Default)]
pub struct DirectoryProvider {
    mounts: Mutex<BTreeMap<ScopeId, DirectoryMount>>,
    next_temp_id: AtomicU64,
}

impl DirectoryProvider {
    /// 构造空挂载 Provider。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    fn table(&self) -> MutexGuard<'_, BTreeMap<ScopeId, DirectoryMount>> {
        self.mounts.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// 挂载作用域根：`root` 必须存在且为目录（登记失败不降级，《06》§3.2），
    /// 入表前规范化（消解符号链接根段，如 macOS `/var → /private/var`）；
    /// 重复挂载返回 `RESOURCE_ALREADY_EXISTS`。
    pub fn attach_root(
        &self,
        scope: &ScopeId,
        root: &Path,
        kind: ScopeKind,
    ) -> Result<(), ResourceError> {
        let scope_root_uri = format!("chips-resource://{scope}/");
        let canonical = fs::canonicalize(root).map_err(|_| ResourceError::NotFound {
            uri: scope_root_uri.clone(),
        })?;
        if !canonical.is_dir() {
            return Err(ResourceError::NotFound {
                uri: scope_root_uri,
            });
        }
        let mut table = self.table();
        if table.contains_key(scope) {
            return Err(ResourceError::AlreadyExists { uri: scope.clone() });
        }
        table.insert(
            scope.clone(),
            DirectoryMount {
                root: canonical,
                kind,
            },
        );
        Ok(())
    }

    /// 摘除作用域根（注销级联的 Provider 侧归还）；未在册返回 `false`。
    pub fn detach_root(&self, scope: &ScopeId) -> bool {
        self.table().remove(scope).is_some()
    }

    /// 作用域是否已挂载（只读探测）。
    #[must_use]
    pub fn is_mounted(&self, scope: &ScopeId) -> bool {
        self.table().contains_key(scope)
    }

    /// 挂载记录 + 宿主路径解析（PathGuard 在册校验与符号链接根内复检；
    /// `PathInvalid` 回填规范 URI，《06》§7.3 `IResourcePathErrorDetails`）。
    fn locate(&self, address: &ResourceAddress) -> Result<(DirectoryMount, PathBuf), ChipsError> {
        let mount = self
            .table()
            .get(&address.scope)
            .cloned()
            .ok_or_else(|| ResourceError::Internal.to_chips_error())?;
        let path =
            resolve_within_root(&mount.root, &address.path).map_err(|error| match error {
                ResourceError::PathInvalid { path, reason, .. } => ResourceError::PathInvalid {
                    uri: address.uri.clone(),
                    path,
                    reason,
                }
                .to_chips_error(),
                other => other.to_chips_error(),
            })?;
        Ok((mount, path))
    }

    /// 读取面元数据：不存在 → `RESOURCE_NOT_FOUND`；目录态（目录不可作为
    /// 资源读取，《06》§2.4）同样按 `RESOURCE_NOT_FOUND` 收口（findings
    /// 登记裁定）；其余宿主 IO 异常按协议层兜底 `RESOURCE_INTERNAL`。
    fn readable_metadata(path: &Path, uri: &str) -> Result<fs::Metadata, ChipsError> {
        fs::metadata(path)
            .map_err(|error| read_io_error(error, uri))
            .and_then(|metadata| {
                if metadata.is_dir() {
                    return Err(ResourceError::NotFound {
                        uri: uri.to_owned(),
                    }
                    .to_chips_error());
                }
                Ok(metadata)
            })
    }

    /// 版本戳（《04》§1.3：`mtime + size` 统一字符串形态）。
    fn version_of(metadata: &fs::Metadata) -> VersionStamp {
        format!("{}-{}", modified_unix_seconds(metadata), metadata.len())
    }

    /// 同作用域约束的 Provider 侧兜底（管理器已按《04.04》§4.9 先行拒绝；
    /// 越界到达此处属装配错误 → `RESOURCE_INTERNAL`，与 Memory 同型）。
    fn same_scope_guard(
        &self,
        from: &ResourceAddress,
        to: &ResourceAddress,
    ) -> Result<(), ChipsError> {
        if from.scope == to.scope {
            return Ok(());
        }
        Err(ResourceError::Internal.to_chips_error())
    }

    /// 原子替换写入（《04.04》§4.8）：同目录隐藏临时文件（`.` 前缀，列举面
    /// 在册过滤）+ `sync_all` + `rename`；任何一步失败清理临时物；宿主写侧
    /// IO 错误 → `RESOURCE_WRITE_FAILED`。
    fn atomic_write_with(
        &self,
        target: &Path,
        uri: &str,
        fill: impl FnOnce(&mut File) -> std::io::Result<()>,
    ) -> Result<(), ChipsError> {
        let parent = target
            .parent()
            .ok_or_else(|| ResourceError::Internal.to_chips_error())?;
        let temp_path = parent.join(format!(
            ".chips-tmp-{}-{}",
            std::process::id(),
            self.next_temp_id.fetch_add(1, Ordering::Relaxed)
        ));
        let result: std::io::Result<()> = (|| {
            let mut file = File::create(&temp_path)?;
            fill(&mut file)?;
            file.flush()?;
            file.sync_all()?;
            drop(file);
            fs::rename(&temp_path, target)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temp_path);
        }
        result.map_err(|_| {
            ResourceError::WriteFailed {
                uri: uri.to_owned(),
            }
            .to_chips_error()
        })
    }
}

/// 读取面宿主 IO 错误分流：不存在 → `RESOURCE_NOT_FOUND`；其余 → 协议层兜底
/// `RESOURCE_INTERNAL`（读面无在册 IO 码，《06》§7.2，findings 登记）。
fn read_io_error(error: std::io::Error, uri: &str) -> ChipsError {
    match error.kind() {
        std::io::ErrorKind::NotFound => ResourceError::NotFound {
            uri: uri.to_owned(),
        },
        _ => ResourceError::Internal,
    }
    .to_chips_error()
}

/// 元数据修改时间（Unix 秒；不可得为 0，与 `DirectoryEntry` 在册口径一致）。
fn modified_unix_seconds(metadata: &fs::Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| i64::try_from(elapsed.as_secs()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

/// 列举过滤（《04.04》§4.10 + 《04》§3.3「复用解析器目录语义」）：
/// 隐藏文件（以 `.` 开头，覆盖 `.DS_Store` / `.git`）与 `Thumbs.db` 默认
/// 过滤；符号链接条目不跟随、不列举（指向根外的链接在读取面必
/// `PATH_INVALID/symlink` 拒绝，列举面如实隐藏避免交付不可读条目）；
/// 非 UTF-8 文件名无法承载为 `VirtualPath`，跳过。
fn filtered_from_list(name: &str, file_type: &fs::FileType) -> bool {
    file_type.is_symlink() || name.starts_with('.') || name == "Thumbs.db"
}

#[async_trait]
impl ResourceProvider for DirectoryProvider {
    fn id(&self) -> &'static str {
        DIRECTORY_PROVIDER_ID
    }

    fn supports_streaming(&self) -> bool {
        true
    }

    fn supports_write(&self) -> bool {
        true
    }

    async fn stat(&self, address: &ResourceAddress) -> Result<ResourceMetadata, ChipsError> {
        let (mount, path) = self.locate(address)?;
        let metadata = Self::readable_metadata(&path, &address.uri)?;
        Ok(ResourceMetadata {
            uri: address.uri.clone(),
            size: metadata.len(),
            mime_type: guess_mime_type(address.path.as_str()),
            version: Self::version_of(&metadata),
            scope: mount.kind,
        })
    }

    async fn read_range(
        &self,
        address: &ResourceAddress,
        range: ByteRange,
    ) -> Result<Vec<u8>, ChipsError> {
        let (_, path) = self.locate(address)?;
        Self::readable_metadata(&path, &address.uri)?;
        let mut file = File::open(&path).map_err(|error| read_io_error(error, &address.uri))?;
        file.seek(SeekFrom::Start(range.offset))
            .map_err(|error| read_io_error(error, &address.uri))?;
        let mut remaining = match range.length {
            Some(length) => usize::try_from(length).unwrap_or(usize::MAX),
            None => usize::MAX,
        };
        let mut collected: Vec<u8> = Vec::new();
        let mut buffer = vec![0u8; TRANSFER_BUFFER_BYTES];
        while remaining > 0 {
            let span = remaining.min(buffer.len());
            match file.read(&mut buffer[..span]) {
                Ok(0) => break,
                Ok(read) => {
                    collected.extend_from_slice(&buffer[..read]);
                    remaining -= read;
                }
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(error) => return Err(read_io_error(error, &address.uri)),
            }
        }
        Ok(collected)
    }

    async fn open_stream(
        &self,
        address: &ResourceAddress,
    ) -> Result<Box<dyn ResourceStream>, ChipsError> {
        let (_, path) = self.locate(address)?;
        Self::readable_metadata(&path, &address.uri)?;
        let file = File::open(&path).map_err(|error| read_io_error(error, &address.uri))?;
        Ok(Box::new(FileStream {
            file,
            uri: address.uri.clone(),
            cursor: 0,
        }))
    }

    async fn list_directory(
        &self,
        address: &ResourceAddress,
    ) -> Result<Vec<DirectoryEntry>, ChipsError> {
        let (_, path) = self.locate(address)?;
        let directory =
            fs::symlink_metadata(&path).map_err(|error| read_io_error(error, &address.uri))?;
        if !directory.is_dir() {
            // 非目录路径无列举语义：按作用域内「目录不存在」收口
            // （《06》§7.2 `RESOURCE_NOT_FOUND` 触发条件，findings 登记裁定）。
            return Err(ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error());
        }
        let reader = fs::read_dir(&path).map_err(|error| read_io_error(error, &address.uri))?;
        let mut entries: Vec<DirectoryEntry> = Vec::new();
        for entry in reader {
            let Ok(entry) = entry else {
                continue;
            };
            let Ok(name) = entry.file_name().into_string() else {
                continue;
            };
            // `DirEntry::file_type` 不跟随符号链接（lstat 语义，《06》§9.1）。
            let Ok(entry_type) = entry.file_type() else {
                continue;
            };
            if filtered_from_list(&name, &entry_type) {
                continue;
            }
            let Ok(entry_metadata) = entry.metadata() else {
                continue;
            };
            entries.push(DirectoryEntry {
                name,
                is_directory: entry_metadata.is_dir(),
                size: entry_metadata.len(),
                modified_unix_seconds: modified_unix_seconds(&entry_metadata),
            });
        }
        // 确定性输出：按条目名排序（文档未定序，同输入必同输出，《06》§5.1）。
        entries.sort_by(|left, right| left.name.cmp(&right.name));
        Ok(entries)
    }

    async fn write(
        &self,
        address: &ResourceAddress,
        data: &[u8],
    ) -> Result<ResourceMetadata, ChipsError> {
        let (_, path) = self.locate(address)?;
        // 目标为在册目录：目录不是可替换的文件目标（《06》§2.4），不覆盖。
        if fs::symlink_metadata(&path).is_ok_and(|metadata| metadata.is_dir()) {
            return Err(ResourceError::AlreadyExists {
                uri: address.uri.clone(),
            }
            .to_chips_error());
        }
        // 父目录必须存在：写入不自动建层（`create_directory` 为在册独立操作）。
        if !path.parent().is_some_and(|parent| parent.is_dir()) {
            return Err(ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error());
        }
        let payload = data.to_vec();
        self.atomic_write_with(&path, &address.uri, move |file| file.write_all(&payload))?;
        self.stat(address).await
    }

    async fn delete(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
        let (_, path) = self.locate(address)?;
        let metadata =
            fs::symlink_metadata(&path).map_err(|error| read_io_error(error, &address.uri))?;
        let write_failed = || ResourceError::WriteFailed {
            uri: address.uri.clone(),
        };
        if metadata.is_dir() {
            // 非递归模式（Provider 签名不携 `recursive`，《04.04》§4.9）：
            // 目录含任何条目即 `RESOURCE_NOT_EMPTY`（宿主真实面判定，不做
            // 列举过滤后的乐观放宽，findings 登记裁定）。
            let has_children = fs::read_dir(&path)
                .map_err(|_| ResourceError::Internal.to_chips_error())?
                .next()
                .is_some();
            if has_children {
                return Err(ResourceError::NotEmpty {
                    uri: address.uri.clone(),
                }
                .to_chips_error());
            }
            return fs::remove_dir(&path).map_err(|_| write_failed().to_chips_error());
        }
        // 文件与根内符号链接：删除条目本身（不跟随，《04》§3.3）。
        fs::remove_file(&path).map_err(|_| write_failed().to_chips_error())
    }

    async fn rename(&self, from: &ResourceAddress, to: &ResourceAddress) -> Result<(), ChipsError> {
        self.same_scope_guard(from, to)?;
        let source = self.locate(from)?.1;
        let target = self.locate(to)?.1;
        if source == target {
            return Ok(());
        }
        fs::symlink_metadata(&source).map_err(|error| read_io_error(error, &from.uri))?;
        if fs::symlink_metadata(&target).is_ok() {
            // 目标已存在不覆盖（《04.04》§4.9、《06》§7.2）。
            return Err(ResourceError::AlreadyExists {
                uri: to.uri.clone(),
            }
            .to_chips_error());
        }
        fs::rename(&source, &target).map_err(|_| {
            ResourceError::WriteFailed {
                uri: to.uri.clone(),
            }
            .to_chips_error()
        })
    }

    async fn copy(&self, from: &ResourceAddress, to: &ResourceAddress) -> Result<(), ChipsError> {
        self.same_scope_guard(from, to)?;
        let source = self.locate(from)?.1;
        let target = self.locate(to)?.1;
        if source == target {
            return Ok(());
        }
        Self::readable_metadata(&source, &from.uri)?;
        if fs::symlink_metadata(&target).is_ok() {
            return Err(ResourceError::AlreadyExists {
                uri: to.uri.clone(),
            }
            .to_chips_error());
        }
        if !target.parent().is_some_and(|parent| parent.is_dir()) {
            return Err(ResourceError::NotFound {
                uri: to.uri.clone(),
            }
            .to_chips_error());
        }
        let mut reader = File::open(&source).map_err(|error| read_io_error(error, &from.uri))?;
        // 流式拷贝：64 KiB 中转逐块落临时文件，不整体加载到内存（§4.9）。
        self.atomic_write_with(&target, &to.uri, move |file| {
            let mut buffer = vec![0u8; TRANSFER_BUFFER_BYTES];
            loop {
                let read = reader.read(&mut buffer)?;
                if read == 0 {
                    return Ok(());
                }
                file.write_all(&buffer[..read])?;
            }
        })
    }

    async fn create_directory(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
        let (_, path) = self.locate(address)?;
        match fs::symlink_metadata(&path) {
            // 幂等（《04.04》§4.9：已存在返回成功）。
            Ok(metadata) if metadata.is_dir() => return Ok(()),
            Ok(_) => {
                return Err(ResourceError::AlreadyExists {
                    uri: address.uri.clone(),
                }
                .to_chips_error())
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err(ResourceError::Internal.to_chips_error()),
        }
        match fs::create_dir(&path) {
            Ok(()) => Ok(()),
            // 单层创建：父目录缺失按作用域内不存在收口（递归建层不在册）。
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                Err(ResourceError::NotFound {
                    uri: address.uri.clone(),
                }
                .to_chips_error())
            }
            Err(_) => Err(ResourceError::WriteFailed {
                uri: address.uri.clone(),
            }
            .to_chips_error()),
        }
    }

    async fn set_metadata(
        &self,
        address: &ResourceAddress,
        _metadata: FileMetadata,
    ) -> Result<(), ChipsError> {
        let kind = self
            .table()
            .get(&address.scope)
            .map(|mount| mount.kind)
            .unwrap_or(ScopeKind::Workspace);
        // 《04》§3.3 目录行的在册支持面为 write/delete/rename/copy/
        // create_directory/list 五操作，`set_metadata` 不在册；操作类别词表
        // 六词（《06》§7.3）无 metadata 词，就近归入 `write`（B1 Memory 先例）。
        Err(ResourceError::NotSupported {
            uri: address.uri.clone(),
            scope: kind,
            operation: ScopeOperation::Write,
        }
        .to_chips_error())
    }
}

/// DirectoryProvider 流式游标：文件句柄 + 单调游标；`next_chunk` 逐块
/// `read`（块长 ∈ (0, min(`max_bytes`, 256 KiB)]），读到 0 字节即 `None`
/// 唯一结束（《04》§3.2 细则）；不整读进内存（《04.07》§7.3）。
#[derive(Debug)]
pub struct FileStream {
    file: File,
    uri: String,
    cursor: u64,
}

impl FileStream {
    /// 当前游标位置（等于此前全部已返回块长度之和，《04》§3.2）。
    #[must_use]
    pub fn cursor(&self) -> u64 {
        self.cursor
    }
}

#[async_trait]
impl ResourceStream for FileStream {
    async fn next_chunk(&mut self, max_bytes: usize) -> Result<Option<Vec<u8>>, ChipsError> {
        let cap = max_bytes.clamp(1, DEFAULT_CHUNK_BYTES);
        let mut buffer = vec![0u8; cap];
        let mut filled = 0usize;
        while filled < cap {
            match self.file.read(&mut buffer[filled..]) {
                Ok(0) => break,
                Ok(read) => filled += read,
                Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(error) => return Err(read_io_error(error, &self.uri)),
            }
        }
        if filled == 0 {
            return Ok(None);
        }
        buffer.truncate(filled);
        self.cursor += filled as u64;
        Ok(Some(buffer))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::{
        RESOURCE_ALREADY_EXISTS, RESOURCE_INTERNAL, RESOURCE_NOT_EMPTY, RESOURCE_NOT_FOUND,
        RESOURCE_PATH_INVALID,
    };
    use crate::path_guard::VirtualPath;

    /// 真实临时目录夹具：Drop 自清理（禁止残留宿主垃圾文件）。
    struct TempRoot(PathBuf);

    impl TempRoot {
        fn new() -> Self {
            static SEQ: AtomicU64 = AtomicU64::new(0);
            let base = std::env::temp_dir().join(format!(
                "chips-directory-{}-{}",
                std::process::id(),
                SEQ.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&base).expect("临时夹具必须可建");
            Self(base)
        }

        fn path(&self) -> &Path {
            &self.0
        }

        fn write_file(&self, name: &str, bytes: &[u8]) {
            let target = self.0.join(name);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).expect("夹具父目录必须可建");
            }
            fs::write(target, bytes).expect("夹具文件必须可写");
        }
    }

    impl Drop for TempRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn address(scope: &str, path: &str) -> ResourceAddress {
        ResourceAddress {
            scope: scope.to_owned(),
            path: VirtualPath::from_validated(path.to_owned()),
            uri: format!("chips-resource://{scope}/{path}"),
        }
    }

    fn mounted(fixture: &TempRoot) -> DirectoryProvider {
        let provider = DirectoryProvider::new();
        provider
            .attach_root(
                &"workspace-1".to_owned(),
                fixture.path(),
                ScopeKind::Workspace,
            )
            .expect("挂载必须成功");
        provider
    }

    #[test]
    fn test_attach_detach_and_assembly_guardrails() {
        let fixture = TempRoot::new();
        let provider = DirectoryProvider::new();
        let scope = "workspace-1".to_owned();
        let error = provider
            .attach_root(&scope, &fixture.path().join("absent"), ScopeKind::Workspace)
            .expect_err("根不存在必须拒绝（登记失败不降级，《06》§3.2）");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        provider
            .attach_root(&scope, fixture.path(), ScopeKind::Workspace)
            .expect("真实目录根必须放行");
        assert!(provider.is_mounted(&scope));
        let error = provider
            .attach_root(&scope, fixture.path(), ScopeKind::Workspace)
            .expect_err("重复挂载必须拒绝");
        assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
        assert!(provider.detach_root(&scope));
        assert!(!provider.detach_root(&scope), "摘除幂等探测");
    }

    #[tokio::test]
    async fn test_unmounted_scope_is_internal_assembly_guardrail() {
        let provider = DirectoryProvider::new();
        let error = provider
            .stat(&address("workspace-9", "a.txt"))
            .await
            .expect_err("未挂载作用域必须兜底");
        assert_eq!(error.code(), RESOURCE_INTERNAL);
    }

    #[tokio::test]
    async fn test_stat_and_read_range_roundtrip() {
        let fixture = TempRoot::new();
        fixture.write_file("notes/memo.txt", b"hello directory");
        let provider = mounted(&fixture);
        let addr = address("workspace-1", "notes/memo.txt");
        let stat = provider.stat(&addr).await.expect("stat 必须放行");
        assert_eq!(stat.size, 15);
        assert_eq!(stat.mime_type, "text/plain");
        assert_eq!(stat.scope, ScopeKind::Workspace);
        assert!(stat.version.contains('-'), "版本戳 mtime+size 形态");
        let tail = provider
            .read_range(
                &addr,
                ByteRange {
                    offset: 6,
                    length: Some(9),
                },
            )
            .await
            .expect("中段范围读");
        assert_eq!(tail, b"directory".to_vec());
        let to_end = provider
            .read_range(
                &addr,
                ByteRange {
                    offset: 0,
                    length: None,
                },
            )
            .await
            .expect("读到结尾");
        assert_eq!(to_end, b"hello directory".to_vec());
        let beyond = provider
            .read_range(
                &addr,
                ByteRange {
                    offset: 999,
                    length: Some(4),
                },
            )
            .await
            .expect("越界偏移按空结果收口（与 Memory 同型）");
        assert!(beyond.is_empty());
        // 目录态读取面拒绝：目录不可作为资源（《06》§2.4）。
        let error = provider
            .stat(&address("workspace-1", "notes"))
            .await
            .expect_err("目录不得作为资源 stat");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        let error = provider
            .open_stream(&address("workspace-1", "notes"))
            .await
            .map(|_stream| ())
            .expect_err("目录不得作为资源开流");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        let error = provider
            .read_range(
                &address("workspace-1", "notes"),
                ByteRange {
                    offset: 0,
                    length: Some(4),
                },
            )
            .await
            .expect_err("目录不得作为资源范围读");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    }

    #[tokio::test]
    async fn test_stream_chunks_shape_cursor_and_termination() {
        let fixture = TempRoot::new();
        let payload = vec![7u8; 300 * 1024];
        fixture.write_file("big.bin", &payload);
        let provider = mounted(&fixture);
        let mut stream = provider
            .open_stream(&address("workspace-1", "big.bin"))
            .await
            .expect("开流必须放行");
        let mut consumed = 0usize;
        let mut pulls = 0usize;
        loop {
            let Some(chunk) = stream.next_chunk(1024 * 1024).await.expect("拉块必须放行")
            else {
                break;
            };
            pulls += 1;
            assert!(!chunk.is_empty(), "非结束信号块必为非空");
            assert!(
                chunk.len() <= DEFAULT_CHUNK_BYTES,
                "块长必 ≤ 256 KiB 在册上限"
            );
            // 游标严格累计（无空洞、不重叠）以块内容按累计偏移逐一锁定。
            assert_eq!(payload[..consumed + chunk.len()][consumed..], chunk[..]);
            consumed += chunk.len();
            assert!(pulls < 10, "游标必须推进，防死循环");
        }
        assert_eq!(consumed, payload.len());
        assert_eq!(pulls, 2, "300 KiB 按 256 KiB 上限切两块");
        assert!(stream.next_chunk(16).await.expect("结束后再拉").is_none());
        // 小上限逐块形态：非末块恰为 min(max_bytes, 256 KiB)。
        let mut stream = provider
            .open_stream(&address("workspace-1", "big.bin"))
            .await
            .expect("再开流");
        let mut read_total = 0u64;
        for _ in 0..4 {
            let chunk = stream
                .next_chunk(64 * 1024)
                .await
                .expect("拉块")
                .expect("非结尾");
            assert_eq!(chunk.len(), 64 * 1024);
            read_total += chunk.len() as u64;
        }
        assert_eq!(read_total, 4 * 64 * 1024, "四块累计即游标位置");
    }

    #[tokio::test]
    async fn test_empty_file_stream_ends_immediately() {
        let fixture = TempRoot::new();
        fixture.write_file("empty.txt", b"");
        let provider = mounted(&fixture);
        let mut stream = provider
            .open_stream(&address("workspace-1", "empty.txt"))
            .await
            .expect("空资源可开流");
        assert!(stream.next_chunk(8).await.expect("读块").is_none());
        assert!(
            stream.next_chunk(8).await.expect("结束后再拉").is_none(),
            "空资源游标停在 0，None 为唯一结束信号"
        );
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn test_symlink_escape_is_path_invalid_symlink() {
        let fixture = TempRoot::new();
        let outside = TempRoot::new();
        fs::write(outside.path().join("secret.txt"), b"outside").unwrap();
        std::os::unix::fs::symlink(
            outside.path().join("secret.txt"),
            fixture.path().join("escape"),
        )
        .expect("夹具符号链接必须可建");
        let provider = mounted(&fixture);
        let error = provider
            .stat(&address("workspace-1", "escape"))
            .await
            .expect_err("根外符号链接必须拒绝（《06》§9.1）");
        assert_eq!(error.code(), RESOURCE_PATH_INVALID);
        let details = error.details().expect("路径族必携 details");
        assert_eq!(details["reason"], "symlink");
        assert_eq!(details["uri"], "chips-resource://workspace-1/escape");
        // details 不携带真实文件系统路径（《06》§7.1）。
        assert!(!details["path"]
            .as_str()
            .unwrap()
            .contains(&outside.path().to_string_lossy().to_string()));
        let error = provider
            .list_directory(&address("workspace-1", "escape"))
            .await
            .expect_err("根外符号链接目录同样拒绝");
        assert_eq!(error.details().unwrap()["reason"], "symlink");
    }

    #[tokio::test]
    async fn test_write_atomic_replace_and_guards() {
        let fixture = TempRoot::new();
        fixture.write_file("keep.txt", b"old");
        fs::create_dir(fixture.path().join("dir")).unwrap();
        let provider = mounted(&fixture);
        let addr = address("workspace-1", "keep.txt");
        let metadata = provider
            .write(&addr, b"new-bytes")
            .await
            .expect("覆盖提交（临时文件 + 原子替换）");
        assert_eq!(metadata.size, 9);
        assert_eq!(
            fs::read(fixture.path().join("keep.txt")).unwrap(),
            b"new-bytes"
        );
        // 原子替换无残留：目录只余在册条目（隐藏临时文件不得幸存）。
        let leftovers: Vec<String> = fs::read_dir(fixture.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            leftovers,
            vec!["dir".to_owned(), "keep.txt".to_owned()]
                .into_iter()
                .collect::<std::collections::BTreeSet<_>>()
                .into_iter()
                .collect::<Vec<_>>()
        );
        // 父目录缺失：不自动建层。
        let error = provider
            .write(&address("workspace-1", "absent-dir/x.txt"), b"x")
            .await
            .expect_err("缺父目录必须拒绝");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        // 目标为目录：不覆盖。
        let error = provider
            .write(&address("workspace-1", "dir"), b"x")
            .await
            .expect_err("目录目标必须拒绝");
        assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    }

    #[tokio::test]
    async fn test_delete_rename_copy_and_not_empty() {
        let fixture = TempRoot::new();
        fixture.write_file("a.txt", b"AAA");
        fixture.write_file("taken.txt", b"T");
        fs::create_dir(fixture.path().join("full")).unwrap();
        fs::write(fixture.path().join("full/inner.bin"), b"i").unwrap();
        fs::create_dir(fixture.path().join("empty")).unwrap();
        let provider = mounted(&fixture);
        let error = provider
            .delete(&address("workspace-1", "full"))
            .await
            .expect_err("非空目录非递归删除必须拒绝（《06》§7.2）");
        assert_eq!(error.code(), RESOURCE_NOT_EMPTY);
        assert_eq!(
            error.details().unwrap()["uri"],
            "chips-resource://workspace-1/full"
        );
        assert!(fixture.path().join("full").is_dir(), "拒绝不得留残留");
        provider
            .delete(&address("workspace-1", "empty"))
            .await
            .expect("空目录删除放行");
        let error = provider
            .rename(
                &address("workspace-1", "a.txt"),
                &address("workspace-1", "taken.txt"),
            )
            .await
            .expect_err("rename 不覆盖");
        assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
        provider
            .rename(
                &address("workspace-1", "a.txt"),
                &address("workspace-1", "b.txt"),
            )
            .await
            .expect("rename 放行");
        assert!(!fixture.path().join("a.txt").exists());
        provider
            .copy(
                &address("workspace-1", "b.txt"),
                &address("workspace-1", "c.txt"),
            )
            .await
            .expect("copy 放行");
        assert_eq!(fs::read(fixture.path().join("c.txt")).unwrap(), b"AAA");
        let error = provider
            .copy(
                &address("workspace-1", "b.txt"),
                &address("workspace-1", "c.txt"),
            )
            .await
            .expect_err("copy 不覆盖（《06》§7.2，B1 裁定沿用）");
        assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
        provider
            .delete(&address("workspace-1", "c.txt"))
            .await
            .expect("文件删除");
        let error = provider
            .delete(&address("workspace-1", "c.txt"))
            .await
            .expect_err("重复删除");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        // 跨作用域装配兜底（管理器按 §4.9 先行拒绝，此处为 Provider 纵深）。
        let error = provider
            .rename(&address("workspace-1", "b.txt"), &address("plugin-1", "x"))
            .await
            .expect_err("跨作用域必须兜底");
        assert_eq!(error.code(), RESOURCE_INTERNAL);
        let error = provider
            .copy(
                &address("workspace-1", "ghost.txt"),
                &address("workspace-1", "x"),
            )
            .await
            .expect_err("源缺失");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    }

    #[tokio::test]
    async fn test_list_directory_filter_order_and_guards() {
        let fixture = TempRoot::new();
        fixture.write_file("zeta.txt", b"Z");
        fixture.write_file(".DS_Store", b"junk");
        fixture.write_file(".hidden", b"junk");
        fixture.write_file("Thumbs.db", b"junk");
        fs::create_dir(fixture.path().join("images")).unwrap();
        fs::create_dir(fixture.path().join("sub")).unwrap();
        fixture.write_file("sub/nested.txt", b"N");
        #[cfg(unix)]
        std::os::unix::fs::symlink(
            fixture.path().join("zeta.txt"),
            fixture.path().join("sub/link.txt"),
        )
        .expect("夹具符号链接必须可建");
        let provider = mounted(&fixture);
        // 根级无法经 Provider 寻址（`VirtualPath` 不收空串）；子目录列举锁形。
        let entries = provider
            .list_directory(&address("workspace-1", "sub"))
            .await
            .expect("列举放行");
        assert_eq!(entries.len(), 1, "符号链接条目过滤后仅余嵌套文件");
        assert_eq!(entries[0].name, "nested.txt");
        assert!(!entries[0].is_directory);
        // 建目录 + 幂等（《04.04》§4.9）+ 同名文件占用。
        provider
            .create_directory(&address("workspace-1", "made"))
            .await
            .expect("建目录放行");
        assert!(fixture.path().join("made").is_dir());
        provider
            .create_directory(&address("workspace-1", "made"))
            .await
            .expect("幂等：已存在目录返回成功");
        let error = provider
            .create_directory(&address("workspace-1", "zeta.txt"))
            .await
            .expect_err("同名文件占用");
        assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
        // 缺父目录的单层创建。
        let error = provider
            .create_directory(&address("workspace-1", "absent/child"))
            .await
            .expect_err("父缺失不自动建层");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        // 列举作用于文件：无目录语义。
        let error = provider
            .list_directory(&address("workspace-1", "zeta.txt"))
            .await
            .expect_err("文件不可列举");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        // 不存在的目录。
        let error = provider
            .list_directory(&address("workspace-1", "absent-dir"))
            .await
            .expect_err("不存在目录不可列举");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    }

    /// 符号链接过滤断言专用：`sub` 下列举不含链接项（仅 Unix 造链接）。
    #[cfg(unix)]
    #[tokio::test]
    async fn test_list_skips_symlink_entries() {
        let fixture = TempRoot::new();
        fs::create_dir(fixture.path().join("sub")).unwrap();
        fixture.write_file("target.txt", b"T");
        std::os::unix::fs::symlink(
            fixture.path().join("target.txt"),
            fixture.path().join("sub/out-link.txt"),
        )
        .expect("夹具符号链接必须可建");
        let provider = mounted(&fixture);
        let entries = provider
            .list_directory(&address("workspace-1", "sub"))
            .await
            .expect("列举放行");
        assert!(entries.is_empty(), "符号链接条目不跟随、不列举");
    }

    #[tokio::test]
    async fn test_set_metadata_not_supported() {
        let fixture = TempRoot::new();
        fixture.write_file("a.txt", b"A");
        let provider = mounted(&fixture);
        let error = provider
            .set_metadata(&address("workspace-1", "a.txt"), FileMetadata::default())
            .await
            .expect_err("set_metadata 不在目录行在册支持面");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
        let details = error.details().expect("scope details");
        assert_eq!(details["operation"], "write");
        assert_eq!(details["scope"], "workspace");
    }
}
