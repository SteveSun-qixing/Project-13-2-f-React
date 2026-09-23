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
//! 写入原子性（《04.04》§4.8/§4.9 + 工单036 波 C2a-1 提交日志）：一次性
//! `write` 与 `copy` 走同目录隐藏临时文件 + `sync_all` + `rename` 原子替换；
//! 临时物建档前先落同目录 sidecar 意图记录（`journal` 模块 prepare–commit
//! 两相），提交终结撤销记录；任一步失败清理临时物与记录、目标保持旧态；
//! 宿主写侧 IO 错误 → `RESOURCE_WRITE_FAILED`（《06》§7.2 磁盘臂）。
//! 挂载即恢复扫描：`attach_root` 对根执行一次 `journal::recover_root`
//! （崩溃中间态收敛 + 无账临时物如实计数、不删），处置账目随挂载返回并可
//! 经 `recovery_report` 查询。
//!
//! 包级 changeset 事务（工单036 波 C2a-2，《04.04》§4.8「受控提交路径」的
//! 目录态包级承载）：[`DirectoryProvider::stage_bundle_member`] /
//! [`DirectoryProvider::plan_bundle_removal`] / [`BundleTransaction`] 构成
//! prepare–publish 两相的盘上引擎——prepare 相把全部覆写成员落为隐藏临时
//! 物 + 同目录 sidecar 意图记录（复用 C2a-1 `journal` phase 语义，全部慢
//! IO 与 fsync 收在此相），删除目标只做校验不做盘上动作；publish 相为纯
//! 元数据动作（rename 批量换代 → unlink/rmdir 批量删除）。prepare 任一
//! 失败经 [`BundleTransaction`] 的 `Drop` 通道整体清扫（临时物与意图记录
//! 同步撤销、零残留、文件系统全域保持旧态）；崩溃落在 prepare 窗口时由
//! 既有挂载恢复扫描按「记录在、临时物在 → 回滚删除」收敛到旧态。

use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::UNIX_EPOCH;

use async_trait::async_trait;
use chips_core::ChipsError;

use crate::constants::DEFAULT_CHUNK_BYTES;
use crate::error::{ResourceError, ScopeOperation};
use crate::journal::{self, JournalRecoveryReport, JournalTicket, TEMP_FILE_PREFIX};
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
/// `chunk_limit` 为流式拉取单块上限的单一取值源投影视图（#140 §四.2 合流，
/// 段三 #185）：经 [`with_chunk_limit`](Self::with_chunk_limit) 由管理器
/// `ResourceLimits::chunk_bytes` 注入。
#[derive(Debug)]
pub struct DirectoryProvider {
    mounts: Mutex<BTreeMap<ScopeId, DirectoryMount>>,
    /// 挂载时恢复扫描报告账（作用域 → 最近一次进入引擎的处置账目，
    /// C2a-1；`detach_root` 随注销归还，零泄漏）。
    recovery_reports: Mutex<BTreeMap<ScopeId, JournalRecoveryReport>>,
    chunk_limit: usize,
}

impl Default for DirectoryProvider {
    fn default() -> Self {
        Self::with_chunk_limit(DEFAULT_CHUNK_BYTES)
    }
}

impl DirectoryProvider {
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
            recovery_reports: Mutex::new(BTreeMap::new()),
            chunk_limit: chunk_limit.max(1),
        }
    }

    fn table(&self) -> MutexGuard<'_, BTreeMap<ScopeId, DirectoryMount>> {
        self.mounts.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// 挂载作用域根：`root` 必须存在且为目录（登记失败不降级，《06》§3.2），
    /// 入表前规范化（消解符号链接根段，如 macOS `/var → /private/var`）；
    /// 重复挂载返回 `RESOURCE_ALREADY_EXISTS`。
    ///
    /// 挂载即恢复扫描（C2a-1 接线位）：校验通过后、登记挂载表前，对该根
    /// 执行一次 [`journal::recover_root`]（提交日志重放回滚 + 无账临时物
    /// 如实计数，模块头「处置三态」）；扫描处置失败不改变挂载成败，逐项
    /// 计入返回报告（本作用域最近报告经 [`Self::recovery_report`】可查）。
    /// 接线理由：`mount_directory` / `register_temp_scope` 两个公开入口的
    /// 唯一汇聚 seam，即「重启后该文件系统域首次进入引擎」的时刻；构造期
    /// 无根可扫、写路径逐次扫描为无界 IO，均不可行。
    pub fn attach_root(
        &self,
        scope: &ScopeId,
        root: &Path,
        kind: ScopeKind,
    ) -> Result<JournalRecoveryReport, ResourceError> {
        let scope_root_uri = format!("chips-resource://{scope}/");
        let canonical = fs::canonicalize(root).map_err(|_| ResourceError::NotFound {
            uri: scope_root_uri.clone(),
        })?;
        if !canonical.is_dir() {
            return Err(ResourceError::NotFound {
                uri: scope_root_uri,
            });
        }
        let report = journal::recover_root(&canonical);
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
        drop(table);
        self.recovery_reports
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(scope.clone(), report.clone());
        Ok(report)
    }

    /// 摘除作用域根（注销级联的 Provider 侧归还）；未在册返回 `false`。
    /// 同步归还该作用域的恢复扫描报告账。
    pub fn detach_root(&self, scope: &ScopeId) -> bool {
        let detached = self.table().remove(scope).is_some();
        if detached {
            self.recovery_reports
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .remove(scope);
        }
        detached
    }

    /// 作用域最近一次挂载的恢复扫描报告（只读探测；未挂载为 `None`）。
    #[must_use]
    pub fn recovery_report(&self, scope: &ScopeId) -> Option<JournalRecoveryReport> {
        self.recovery_reports
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .get(scope)
            .cloned()
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

    /// 原子替换写入（《04.04》§4.8 + 工单036 波 C2a-1 提交日志两相）：
    /// prepare 相先落同目录 sidecar 意图记录（journal 先于临时物建档并
    /// fsync，崩溃中间态可判读）→ 同目录隐藏临时文件（`.` 前缀，列举面
    /// 在册过滤）+ `sync_all` + `rename` → commit 相撤销记录；任何一步
    /// 失败清理临时物与记录（票据 Drop 单通道）；宿主写侧 IO 错误（含
    /// 记录建档失败）→ `RESOURCE_WRITE_FAILED`（《06》§7.2 磁盘臂，
    /// 错误码零新增）。
    fn atomic_write_with(
        &self,
        root: &Path,
        target: &Path,
        uri: &str,
        fill: impl FnOnce(&mut File) -> std::io::Result<()>,
    ) -> Result<(), ChipsError> {
        let parent = target
            .parent()
            .ok_or_else(|| ResourceError::Internal.to_chips_error())?;
        let token = journal::next_intent_token();
        let temp_path = parent.join(format!("{TEMP_FILE_PREFIX}{token}"));
        let ticket = JournalTicket::prepare(root, token, &temp_path, target).map_err(|_| {
            ResourceError::WriteFailed {
                uri: uri.to_owned(),
            }
            .to_chips_error()
        })?;
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
        // commit 相终结：撤销意图记录并销账（临时物处置先行、记录最后撤，
        // 与在途账「记录可见 ⇒ 在途在册」不变量同序）。
        drop(ticket);
        result.map_err(|_| {
            ResourceError::WriteFailed {
                uri: uri.to_owned(),
            }
            .to_chips_error()
        })
    }

    /// 流式写入落盘槽建档（段二 B3，《04.04》§4.8 `commit_write_stream`
    /// 的目录域通道 + 工单036 波 C2a-1 提交日志两相）：与一次性提交同款
    /// 原子形态——prepare 相先落同目录 sidecar 意图记录（journal 先于
    /// 临时物建档并 fsync，崩溃时在途流重启后可判读回收），同目录临时
    /// 文件先建档，逐块 append，提交时 `sync_all` + `rename` 原子替换并
    /// 撤销记录。目标为在册目录 → `RESOURCE_ALREADY_EXISTS`（不覆盖）；
    /// 父目录缺失 → `RESOURCE_NOT_FOUND`（不自动建层）；记录建档或临时物
    /// 建档 IO 失败 → `RESOURCE_WRITE_FAILED`（零残留）。
    pub(crate) fn begin_stream_write(
        &self,
        address: &ResourceAddress,
    ) -> Result<DirectoryStreamSink, ChipsError> {
        let (mount, path) = self.locate(address)?;
        if fs::symlink_metadata(&path).is_ok_and(|metadata| metadata.is_dir()) {
            return Err(ResourceError::AlreadyExists {
                uri: address.uri.clone(),
            }
            .to_chips_error());
        }
        let parent = path
            .parent()
            .ok_or_else(|| ResourceError::Internal.to_chips_error())?;
        if !parent.is_dir() {
            return Err(ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error());
        }
        let token = journal::next_intent_token();
        let temp_path = parent.join(format!("{TEMP_FILE_PREFIX}{token}"));
        // prepare 相：意图记录先于临时物建档；票据局部持有，下方任一步
        // 失败随票据 Drop 撤记录销账（临时物尚未或即时清理，零残留）。
        let ticket =
            JournalTicket::prepare(&mount.root, token, &temp_path, &path).map_err(|_| {
                ResourceError::WriteFailed {
                    uri: address.uri.clone(),
                }
                .to_chips_error()
            })?;
        let file = File::create(&temp_path).map_err(|_| {
            ResourceError::WriteFailed {
                uri: address.uri.clone(),
            }
            .to_chips_error()
        })?;
        Ok(DirectoryStreamSink {
            temp_path,
            target_path: path,
            uri: address.uri.clone(),
            file: Some(file),
            journal: Some(ticket),
        })
    }

    /// 包级事务 prepare 相——覆写/新建成员的 staging 落盘（波 C2a-2）：与
    /// 一次性提交同款前置判定（目标为在册目录 → `RESOURCE_ALREADY_EXISTS`
    /// 不覆盖、父目录缺失 → `RESOURCE_NOT_FOUND` 不自动建层），随后
    /// prepare 两相落盘：同目录 sidecar 意图记录先建并 fsync（复用
    /// [`JournalTicket`]，崩溃中间态可判读），隐藏临时文件建档写入新字节
    /// 并 `sync_all`，**不 rename**——发布（publish）由
    /// [`BundleTransaction`] 在管理器全事务校验完成后统一执行。任一步
    /// IO 失败即清理临时物并撤销记录（`RESOURCE_WRITE_FAILED`，零残留）；
    /// 判定错误即原样上抛（此时尚无盘上动作）。调用方必须持有目标路径的
    /// 写锁许可（管理器 `commit_changeset` 单源接线，本方法不自行取锁）。
    pub(crate) fn stage_bundle_member(
        &self,
        address: &ResourceAddress,
        bytes: &[u8],
    ) -> Result<StagedBundleMember, ChipsError> {
        let (mount, path) = self.locate(address)?;
        if fs::symlink_metadata(&path).is_ok_and(|metadata| metadata.is_dir()) {
            return Err(ResourceError::AlreadyExists {
                uri: address.uri.clone(),
            }
            .to_chips_error());
        }
        let parent = path
            .parent()
            .ok_or_else(|| ResourceError::Internal.to_chips_error())?;
        if !parent.is_dir() {
            return Err(ResourceError::NotFound {
                uri: address.uri.clone(),
            }
            .to_chips_error());
        }
        let token = journal::next_intent_token();
        let temp_path = parent.join(format!("{TEMP_FILE_PREFIX}{token}"));
        let ticket =
            JournalTicket::prepare(&mount.root, token, &temp_path, &path).map_err(|_| {
                ResourceError::WriteFailed {
                    uri: address.uri.clone(),
                }
                .to_chips_error()
            })?;
        let result: std::io::Result<()> = (|| {
            let mut file = File::create(&temp_path)?;
            file.write_all(bytes)?;
            file.flush()?;
            file.sync_all()
        })();
        if result.is_err() {
            // staging 失败：临时物即时清理、票据撤销销账（与
            // `atomic_write_with` 失败臂同通道同序：临时物先、记录后）。
            let _ = fs::remove_file(&temp_path);
            drop(ticket);
            return Err(ResourceError::WriteFailed {
                uri: address.uri.clone(),
            }
            .to_chips_error());
        }
        Ok(StagedBundleMember {
            temp_path,
            target_path: path,
            uri: address.uri.clone(),
            journal: Some(ticket),
        })
    }

    /// 包级事务 prepare 相——删除目标的纯校验（波 C2a-2）：不存在 →
    /// `RESOURCE_NOT_FOUND`（与 `delete` 同一读侧错误分流）；目录且非空 →
    /// `RESOURCE_NOT_EMPTY`（非递归口径沿《06》§7.2 既有语义）；空目录与
    /// 文件（含根内符号链接本身）登记为可删形态。**不做任何盘上动作**——
    /// 删除的不可逆动作收在 publish 相，prepare 失败时目标原样幸存。
    pub(crate) fn plan_bundle_removal(
        &self,
        address: &ResourceAddress,
    ) -> Result<StagedBundleRemoval, ChipsError> {
        let (_, path) = self.locate(address)?;
        let metadata =
            fs::symlink_metadata(&path).map_err(|error| read_io_error(error, &address.uri))?;
        let remove_directory = metadata.is_dir();
        if remove_directory {
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
        }
        Ok(StagedBundleRemoval {
            path,
            uri: address.uri.clone(),
            remove_directory,
        })
    }
}

/// 目录域流式写入落盘槽（B3 + 工单036 波 C2a-1 提交日志）：临时文件句柄 +
/// 目标路径 + 意图记录票据（[`JournalTicket`]，在途账凭据）；
/// `finish` 原子替换并撤销记录、`abort`/`Drop` 清理临时文件与记录——失败
/// 与中断均零残留（《04.04》§4.9「管理器清理失败/中断的临时文件」）。
/// 进程崩溃时在途流的意图记录已先于临时物落盘（prepare 相），重启挂载的
/// 恢复扫描据账回滚回收（`journal` 模块头处置三态）。
#[derive(Debug)]
pub struct DirectoryStreamSink {
    temp_path: PathBuf,
    target_path: PathBuf,
    uri: String,
    file: Option<File>,
    /// 意图记录票据：Drop 序在临时文件句柄之后——临时物处置先行、记录
    /// 撤销与销账最后，全程维持「记录可见 ⇒ 在途在册」不变量。
    journal: Option<JournalTicket>,
}

impl DirectoryStreamSink {
    /// 在途意图记录路径（`#[cfg(test)]` 装配与恢复联动锁测消费面；已终结为
    /// `None`）。锁测经此直读 sink 内部票据，与文件系统实况对表。
    #[cfg(test)]
    #[must_use]
    pub(crate) fn journal_path(&self) -> Option<&Path> {
        self.journal.as_ref().map(JournalTicket::journal_path)
    }

    /// 在途意图记录内容（`temp` / `target` / `createdUnixMs`，`#[cfg(test)]`
    /// 一致性锁测消费面；已终结为 `None`）。
    #[cfg(test)]
    #[must_use]
    pub(crate) fn commit_record(&self) -> Option<&journal::CommitRecord> {
        self.journal.as_ref().map(JournalTicket::record)
    }

    /// 追加一块字节；宿主 IO 失败 → `RESOURCE_WRITE_FAILED`（临时文件
    /// 由 Drop 通道清理）。
    pub(crate) fn append(&mut self, bytes: &[u8]) -> Result<(), ChipsError> {
        let write_failed = || ResourceError::WriteFailed {
            uri: self.uri.clone(),
        };
        let file = self.file.as_mut().ok_or_else(write_failed)?;
        file.write_all(bytes)
            .map_err(|_| write_failed().to_chips_error())
    }

    /// 提交：`flush` + `sync_all` + `rename` 原子替换；任何一步失败删除
    /// 临时文件并返回 `RESOURCE_WRITE_FAILED`（目标保持旧态，《04.04》§4.8）。
    /// rename 落定后撤销意图记录（commit 相终结；撤销失败遗留的记录由
    /// 恢复扫描按「记录在、临时物不在」形态幂等终结，绝不误删目标）。
    pub(crate) fn finish(mut self) -> Result<(), ChipsError> {
        let temp = self.temp_path.clone();
        let outcome: std::io::Result<()> = (|| {
            if let Some(file) = self.file.as_mut() {
                file.flush()?;
                file.sync_all()?;
            }
            fs::rename(&self.temp_path, &self.target_path)
        })();
        // 处置权移交完成：成功与失败均显式清理路径记账。
        self.file = None;
        self.temp_path = PathBuf::new();
        match outcome {
            Ok(()) => {
                drop(self.journal.take());
                Ok(())
            }
            Err(_) => {
                // `rename` 失败时临时文件仍在原位，删除之（目标保持旧态），
                // 再撤记录销账。
                let _ = fs::remove_file(&temp);
                drop(self.journal.take());
                Err(ResourceError::WriteFailed {
                    uri: self.uri.clone(),
                }
                .to_chips_error())
            }
        }
    }
}

impl Drop for DirectoryStreamSink {
    fn drop(&mut self) {
        // 未提交即弃（abort / 会话关闭 / 超限回滚）：删除临时文件零残留；
        // 意图记录票据随字段 Drop 撤销并销账（声明序在 `journal` 之前完成
        // 本体会体，临时物先、记录后）。
        if !self.temp_path.as_os_str().is_empty() {
            let _ = fs::remove_file(&self.temp_path);
        }
    }
}

/// 包级事务中的已 staging 成员（波 C2a-2 prepare 相产物）：临时物与新字节
/// 已落盘并 fsync、意图记录在册（[`JournalTicket`] 在途凭据），等待 publish
/// 相 `rename` 换代。`Drop` 时未发布成员即时清理临时物并撤销记录（临时物
/// 先、记录后，维持「记录可见 ⇒ 在途在册」不变量），已发布成员两处标记
/// 均已清空、`Drop` 为 no-op——回滚与终结共用单清理通道。
#[derive(Debug)]
pub(crate) struct StagedBundleMember {
    temp_path: PathBuf,
    target_path: PathBuf,
    uri: String,
    journal: Option<JournalTicket>,
}

impl Drop for StagedBundleMember {
    fn drop(&mut self) {
        if !self.temp_path.as_os_str().is_empty() {
            let _ = fs::remove_file(&self.temp_path);
        }
        // `journal` 字段随本体 Drop 撤销意图记录并销账（上方临时物处置先行）。
    }
}

/// 包级事务中的删除目标（prepare 相校验产物，publish 相才执行 unlink /
/// 空目录 rmdir；无盘上在途形态，故不携意图记录——删除在 unlink 之前对
/// 文件系统零改动，恢复扫描无处置对象）。
#[derive(Debug)]
pub(crate) struct StagedBundleRemoval {
    path: PathBuf,
    uri: String,
    remove_directory: bool,
}

/// 目录态包级 changeset 事务（波 C2a-2，《04.04》§4.8 受控提交路径的包级
/// 编排）：持有全部已 staging 成员与已校验删除目标，[`publish`](Self::publish)
/// 一次性执行发布相。发布序固定为「成员 rename 批量 → 删除目标 unlink/rmdir
/// 批量」：成员换代全部落定前不发生任何不可逆删除。
///
/// 失败与崩溃语义（与模块头「包级 changeset 事务」一致）：
///
/// - publish 前任一失败（含调用方弃置本事务）：`Drop` 通道整体清扫未发布
///   成员的临时物与意图记录，文件系统零变化、零残留；
/// - publish 中途 IO 失败：失败成员及其后未发布成员经同一 `Drop` 通道即时
///   清扫（目标保持旧态），此前已 `rename` 成员按 per-member 提交点落定新
///   态并撤销记录——与单成员原子替换的提交点口径同型，上抛
///   `RESOURCE_WRITE_FAILED`（失败成员 uri），残余中间态由既有恢复扫描
///   幂等收敛（记录在、临时物已没 → 只撤记录，绝不误删目标）；
/// - prepare 窗口崩溃（全部慢 IO 所在窗口）：重启挂载的恢复扫描按
///   「记录在、临时物在 → 回滚删除」把整包收敛回旧态、零残留。
#[derive(Debug)]
pub(crate) struct BundleTransaction {
    members: Vec<StagedBundleMember>,
    removals: Vec<StagedBundleRemoval>,
}

impl BundleTransaction {
    /// 构造空事务（成员与删除目标由 prepare 相逐个登记）。
    pub(crate) fn new() -> Self {
        Self {
            members: Vec::new(),
            removals: Vec::new(),
        }
    }

    /// 登记一个已 staging 成员（prepare 相产物，发布前保持 Drop 可清扫态）。
    pub(crate) fn push_member(&mut self, member: StagedBundleMember) {
        self.members.push(member);
    }

    /// 登记一个已校验删除目标（prepare 相产物，无盘上动作）。
    pub(crate) fn push_removal(&mut self, removal: StagedBundleRemoval) {
        self.removals.push(removal);
    }

    /// 发布相：成员按请求序 `rename` 原子换代（每落定一员即撤销其意图记录
    /// = 该成员的提交点），全部落定后删除目标批量 `unlink` / 空目录
    /// `rmdir`。任一 `rename` 失败即中止（未发布成员随本函数结束的 `Drop`
    /// 清扫，零残留），上抛失败成员 `RESOURCE_WRITE_FAILED`；删除执行的
    /// 极端 IO 失败同样上抛 `RESOURCE_WRITE_FAILED`（成员换代此时已全部
    /// 落定，如实报告）。成功即整体换代完成——本事务无在途残体。
    pub(crate) fn publish(mut self) -> Result<(), ChipsError> {
        let mut index = 0usize;
        while index < self.members.len() {
            let member = &mut self.members[index];
            match fs::rename(&member.temp_path, &member.target_path) {
                Ok(()) => {
                    member.temp_path = PathBuf::new();
                    drop(member.journal.take());
                    index += 1;
                }
                Err(_) => break,
            }
        }
        if index < self.members.len() {
            let uri = self.members[index].uri.clone();
            // self 在此结束并 Drop：members[index..] 的临时物与意图记录、
            // 以及失败成员自身残体统一随 Drop 清扫。
            return Err(ResourceError::WriteFailed { uri }.to_chips_error());
        }
        for removal in &self.removals {
            let outcome = if removal.remove_directory {
                fs::remove_dir(&removal.path)
            } else {
                fs::remove_file(&removal.path)
            };
            if outcome.is_err() {
                return Err(ResourceError::WriteFailed {
                    uri: removal.uri.clone(),
                }
                .to_chips_error());
            }
        }
        Ok(())
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
            chunk_limit: self.chunk_limit,
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
        let (mount, path) = self.locate(address)?;
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
        self.atomic_write_with(&mount.root, &path, &address.uri, move |file| {
            file.write_all(&payload)
        })?;
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
        let (mount, source) = self.locate(from)?;
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
        self.atomic_write_with(&mount.root, &target, &to.uri, move |file| {
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
    chunk_limit: usize,
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
        let cap = max_bytes.clamp(1, self.chunk_limit);
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
    use std::sync::atomic::{AtomicU64, Ordering};

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

    /// 波 C2a-1 探针消费面：在途写流的意图记录路径与内容与磁盘实况、
    /// 在途账逐项对表（文件名配对单源、记录相对路径一致），Drop 中止后
    /// 记录与临时物同步撤销、账目清空、目标不动。
    #[test]
    fn test_write_stream_journal_probes_and_in_flight_record() {
        let fixture = TempRoot::new();
        fixture.write_file("stream-src.txt", b"OLD");
        let provider = mounted(&fixture);
        let mut sink = provider
            .begin_stream_write(&address("workspace-1", "stream-src.txt"))
            .expect("流式写建档必须成功");
        sink.append(b"CHUNK").expect("分块送入");
        let journal_path = sink
            .journal_path()
            .expect("在途流必有意图记录")
            .to_path_buf();
        let temp_path = sink.temp_path.clone();
        let record = sink.commit_record().expect("在途记录内容可判读").clone();
        // 文件名配对单源：记录名与临时物名解析出同一令牌。
        let temp_name = temp_path
            .file_name()
            .and_then(|name| name.to_str())
            .expect("夹具名必 UTF-8");
        let journal_name = journal_path
            .file_name()
            .and_then(|name| name.to_str())
            .expect("夹具名必 UTF-8");
        let token = journal::temp_file_token(temp_name).expect("临时物在册名形态");
        assert_eq!(journal::journal_file_token(journal_name), Some(token));
        // 内容与磁盘实况逐项对表（相对挂载根）。
        assert_eq!(record.target, "stream-src.txt");
        assert_eq!(record.temp, temp_name);
        assert!(
            journal_path.is_file() && temp_path.is_file(),
            "prepare 相双方在册"
        );
        assert!(journal::is_in_flight(token), "在途账在册");
        drop(sink); // Drop 通道中止：临时物先处置、记录与销账同步撤销
        assert!(
            !journal_path.exists() && !temp_path.exists(),
            "中止后账实两清"
        );
        assert!(!journal::is_in_flight(token), "中止后销账");
        assert_eq!(
            fs::read(fixture.path().join("stream-src.txt")).expect("目标仍可读"),
            b"OLD",
            "中止不动目标"
        );
    }

    /// 包级事务 prepare 相形态锁（波 C2a-2）：staging 产物与 `journal`
    /// 协议单源同型——sidecar 记录先于临时物在册、令牌配对、记录内容
    /// （temp/target 相对挂载根）与磁盘实况逐项对表、在途账在册；
    /// publish 成功后全部临时物与记录同步消失（成员提交点=记录撤销），
    /// 目标换代、零残留。
    #[test]
    fn test_bundle_staging_matches_journal_protocol_and_publish_swaps() {
        let fixture = TempRoot::new();
        fixture.write_file("a.txt", b"OLD-A");
        fs::create_dir(fixture.path().join("empty-dir")).unwrap();
        let provider = mounted(&fixture);
        let mut transaction = BundleTransaction::new();
        transaction.push_member(
            provider
                .stage_bundle_member(&address("workspace-1", "a.txt"), b"NEW-A")
                .expect("覆写成员 staging 必须放行"),
        );
        transaction.push_member(
            provider
                .stage_bundle_member(&address("workspace-1", "fresh.txt"), b"FRESH")
                .expect("新建成员 staging 必须放行"),
        );
        transaction.push_removal(
            provider
                .plan_bundle_removal(&address("workspace-1", "empty-dir"))
                .expect("空目录删除校验必须放行"),
        );
        transaction.push_removal(
            provider
                .plan_bundle_removal(&address("workspace-1", "a.txt"))
                .expect("覆写+删除同路径不合法由管理器集合闸把守，Provider 面独立校验仍放行"),
        );
        // 在途形态：两个 staging 成员各携「临时物 + sidecar 记录」一对，
        // 目标旧态未动（删除臂零盘上动作）。
        let residue: Vec<String> = fs::read_dir(fixture.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|name| name.starts_with(TEMP_FILE_PREFIX))
            .collect();
        assert_eq!(
            residue.len(),
            4,
            "两成员 = 临时物 + 记录各一对：{residue:?}"
        );
        let journal_name = residue
            .iter()
            .find(|name| name.ends_with(journal::JOURNAL_FILE_SUFFIX))
            .expect("必有记录")
            .clone();
        let journal_path = fixture.path().join(&journal_name);
        let record = journal::read_commit_record(&journal_path).expect("在册记录必可解析");
        let token = journal::journal_file_token(&journal_name).expect("记录名在册形态");
        assert!(
            residue.contains(&format!("{TEMP_FILE_PREFIX}{token}")),
            "sidecar 配对单源：记录名与临时物名同令牌"
        );
        assert!(journal::is_in_flight(token), "staging 即在途账在册");
        assert!(
            record.temp.ends_with(&format!("{TEMP_FILE_PREFIX}{token}")),
            "记录 temp 指向配对临时物：{record:?}"
        );
        assert!(
            matches!(record.target.as_str(), "a.txt" | "fresh.txt"),
            "记录 target 为在册成员相对路径：{record:?}"
        );
        assert_eq!(
            fs::read(fixture.path().join("a.txt")).unwrap(),
            b"OLD-A",
            "publish 前目标保持旧态"
        );
        transaction.publish().expect("发布必须放行");
        // Provider 面发布序锁形：成员 rename 批量先落定、删除臂后执行——
        // 同路径「覆写+删除」（管理器集合闸禁止的组合，Provider 独立校验
        // 放行）的确定性终态 = 删除臂胜出，目标不存在。
        assert!(
            !fixture.path().join("a.txt").exists(),
            "发布序 = 成员换代 → 删除执行，同路径终态为已删除"
        );
        assert_eq!(
            fs::read(fixture.path().join("fresh.txt")).unwrap(),
            b"FRESH"
        );
        assert!(!fixture.path().join("empty-dir").exists(), "空目录删除落定");
        assert!(
            fs::read_dir(fixture.path())
                .unwrap()
                .filter_map(|entry| entry.ok())
                .all(|entry| {
                    !entry
                        .file_name()
                        .to_string_lossy()
                        .starts_with(TEMP_FILE_PREFIX)
                }),
            "publish 成功后临时物与记录零残留"
        );
        assert!(!journal::is_in_flight(token), "提交点终结即销账");
    }

    /// 包级事务回滚通道锁（C2a-2）：staging 后未发布即弃置（prepare 中途
    /// 失败/调用方中止的同一 Drop 通道）——临时物与意图记录同步撤销、
    /// 在途账清空、目标全域旧态、零残留。
    #[test]
    fn test_bundle_transaction_drop_rolls_back_without_trace() {
        let fixture = TempRoot::new();
        fixture.write_file("keep.txt", b"OLD");
        let provider = mounted(&fixture);
        {
            let mut transaction = BundleTransaction::new();
            transaction.push_member(
                provider
                    .stage_bundle_member(&address("workspace-1", "keep.txt"), b"NEVER")
                    .expect("staging 必须放行"),
            );
            transaction.push_member(
                provider
                    .stage_bundle_member(&address("workspace-1", "ghost.txt"), b"NEVER")
                    .expect("staging 必须放行"),
            );
        }
        assert_eq!(
            fs::read(fixture.path().join("keep.txt")).unwrap(),
            b"OLD",
            "弃置事务不动目标"
        );
        assert!(
            !fixture.path().join("ghost.txt").exists(),
            "新建成员不得显形"
        );
        let residue: Vec<String> = fs::read_dir(fixture.path())
            .unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name.starts_with(TEMP_FILE_PREFIX))
            .collect();
        assert!(residue.is_empty(), "弃置后账实两清：{residue:?}");
    }

    /// 发布相极端 IO 失败锁（C2a-2）：成员 `rename` 中途失败（此处以临时物
    /// 被外部消失复现）——失败成员及其后未发布成员即时清扫零残留、目标
    /// 旧态，此前已落定成员按提交点保持新态，上抛失败成员
    /// `RESOURCE_WRITE_FAILED`；删除臂在成员未全部落定时不执行（发布序
    /// 锁形：在册删除目标幸存）。
    #[test]
    fn test_bundle_publish_midway_failure_sweeps_unpublished_and_keeps_removals() {
        let fixture = TempRoot::new();
        fixture.write_file("first.txt", b"OLD-1");
        fixture.write_file("second.txt", b"OLD-2");
        fixture.write_file("victim.txt", b"V");
        let provider = mounted(&fixture);
        let mut transaction = BundleTransaction::new();
        transaction.push_member(
            provider
                .stage_bundle_member(&address("workspace-1", "first.txt"), b"NEW-1")
                .expect("staging 必须放行"),
        );
        transaction.push_member(
            provider
                .stage_bundle_member(&address("workspace-1", "second.txt"), b"NEW-2")
                .expect("staging 必须放行"),
        );
        transaction.push_removal(
            provider
                .plan_bundle_removal(&address("workspace-1", "victim.txt"))
                .expect("删除校验必须放行"),
        );
        // 文件系统异常注入：第二成员的临时物被外部消失 → 其 rename 必败。
        let second_temp: PathBuf = fs::read_dir(fixture.path())
            .unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .find(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| {
                        journal::temp_file_token(name).is_some()
                            && fs::read(path).is_ok_and(|bytes| bytes == b"NEW-2")
                    })
            })
            .expect("第二成员临时物必在册");
        fs::remove_file(&second_temp).expect("注入清理必须成功");
        let error = transaction
            .publish()
            .expect_err("rename 中途失败必须如实上抛");
        assert_eq!(error.code(), crate::error::RESOURCE_WRITE_FAILED);
        assert_eq!(
            error.details().unwrap()["uri"],
            "chips-resource://workspace-1/second.txt",
            "失败回执定位到失败成员"
        );
        assert_eq!(
            fs::read(fixture.path().join("first.txt")).unwrap(),
            b"NEW-1",
            "已落定成员按提交点保持新态"
        );
        assert_eq!(
            fs::read(fixture.path().join("second.txt")).unwrap(),
            b"OLD-2",
            "失败成员回滚旧态"
        );
        assert!(
            fixture.path().join("victim.txt").is_file(),
            "成员未全部落定前删除臂不执行"
        );
        let residue: Vec<String> = fs::read_dir(fixture.path())
            .unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name.starts_with(TEMP_FILE_PREFIX))
            .collect();
        assert!(residue.is_empty(), "未发布成员清扫零残留：{residue:?}");
    }

    /// prepare 相校验臂锁（C2a-2）：与一次性写/删除同一在册拒绝形——
    /// 成员目标为在册目录 → `ALREADY_EXISTS`、缺父目录 → `NOT_FOUND`；
    /// 删除目标缺失 → `NOT_FOUND`、非空目录 → `NOT_EMPTY`；校验失败零盘上
    /// 动作（无临时物、无记录）。
    #[test]
    fn test_bundle_prepare_guards_share_single_member_reject_shapes() {
        let fixture = TempRoot::new();
        fixture.write_file("dir/a.txt", b"A");
        let provider = mounted(&fixture);
        let error = provider
            .stage_bundle_member(&address("workspace-1", "dir"), b"x")
            .expect_err("目录目标不覆盖");
        assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
        let error = provider
            .stage_bundle_member(&address("workspace-1", "absent/x.txt"), b"x")
            .expect_err("缺父目录不自动建层");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        let error = provider
            .plan_bundle_removal(&address("workspace-1", "ghost.txt"))
            .expect_err("删除目标缺失");
        assert_eq!(error.code(), RESOURCE_NOT_FOUND);
        let error = provider
            .plan_bundle_removal(&address("workspace-1", "dir"))
            .expect_err("非空目录非递归拒绝");
        assert_eq!(error.code(), RESOURCE_NOT_EMPTY);
        let residue: Vec<String> = fs::read_dir(fixture.path())
            .unwrap()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name.starts_with(TEMP_FILE_PREFIX))
            .collect();
        assert!(residue.is_empty(), "校验失败零盘上动作：{residue:?}");
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
