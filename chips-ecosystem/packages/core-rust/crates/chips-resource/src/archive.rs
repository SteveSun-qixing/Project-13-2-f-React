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
//! 只读口径（《04.03》§3.3、《04.04》§4.8）：归档永不**就地改写**；成员级
//! 写入族（write/delete/rename/copy/create_directory/set_metadata）在
//! Provider 纵深臂返回 `RESOURCE_READ_ONLY`（`details.uri` 取目标精确 uri，与
//! Manager 预检臂统一，《06.07》§7.3 / 工单044 裁定 §三.5-⑧-2）。
//!
//! # 归档态整包重建写通路（工单036 波 C2a-3）
//!
//! 「保存 = 整包重建 + 原子换代」（《11.05》§5.4 发布态重建）在本模块落为
//! 与目录域同方言的 **prepare–publish 两相**通道（[`ArchiveProvider::
//! stage_rebuild_package`] / [`ArchiveProvider::publish_rebuild_package`]），
//! 与「成员就地改写」是两件事：前者产出全新归档文件后一次性换代，后者被
//! 上面的只读臂永久拒绝。要点：
//!
//! - **写出权威在解析域**：整包字节由 `chips_parser::serialize::write_archive`
//!   的 [`chips_parser::serialize::ZipArchiveWriter`] 产出（Store 条目、CRC
//!   重算、路径升序、发布侧禁 ZIP64、时间戳统一取保存时刻），本模块零 ZIP
//!   写侧自实现，跨 crate 只走 `chips_parser::` 公开面；
//! - **两相与意图账**：prepare 相先落同目录 sidecar 意图记录（[`JournalTicket`]，
//!   C2a-1 既有不变量「记录可见 ⇒ 在途在册」——记录先于临时物建档，与勘查
//!   §五字面枚举的先后无关，以在册协议为准），再把**全部慢 IO**（整包写出 +
//!   `flush` + `sync_all`）收在该相；publish 相是纯元数据动作（`rename` 原子
//!   换代 → 撤账 → 重挂新包），换代前任一失败即整体弃置（临时整包删除、
//!   记录撤销、正式归档零触碰、零残留）；
//! - **崩溃收敛**：崩溃落在 prepare 窗口时，正式归档文件从未被写过（旧态
//!   天然幸存），同级残骸由归档挂载即扫（[`ArchiveProvider::attach_archive`]
//!   → [`journal::recover_package_slot`]）按三态判据回滚，不新造第二套日志；
//! - **未变更成员常内存复用**：旧包成员经 [`chips_parser::source::archive::
//!   ArchiveSource::read_member_range`] 分块流式喂给
//!   `add_entry_with_size`，整包写出不整包载入（《11.05》§5.4「未变更成员」行）；
//! - **锁面**：整包写流全程由管理器 `WriteCoordinator` 路径锁覆盖
//!   （[`crate::write_coord`]），本模块不自行取锁、不存在绕锁直写正式路径的
//!   通道（与目录域 `stage_bundle_member` 同一方言）；
//! - **换代后视图**：publish 成功后 Provider 立即以新归档文件重挂，作用域的
//!   读取面与盘上实况同步；换代前已打开的句柄仍读旧映射（temp+rename 对读者
//!   呈原子替换，《04.04》§4.8 既有口径，与目录域写提交同型）。
//!
//! 平台注记：`rename` 换代要求目标可被覆盖；Windows 上正式归档文件被本进程
//! 映射持有时代名会失败，本通路按既有失败臂如实收口（`RESOURCE_WRITE_FAILED`
//! + 正式归档旧态 + 零残留），不产生半态（macOS/Linux 无此约束）。
//!
//! 条目约束（《04.03》§3.3 尾部）：入域条目限普通文件（符号链接 / 设备
//! 文件在解析器索引期即拒绝整个归档）；条目名经 `PackagePath` 在册校验，
//! 寻址侧仍过 PathGuard（《06》§9.1）。列举面支持：目录树由成员路径
//! 前缀合成，目录态条目 `is_directory = true`（《04.04》§4.9 归档行）。

use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::SystemTime;

use async_trait::async_trait;
use chips_core::ChipsError;
use chips_parser::error::DocumentError;
use chips_parser::serialize::{archive_total_size, entry_overhead, ZipArchiveWriter};
use chips_parser::source::archive::ArchiveSource;
use chips_parser::source::{ByteStream, DocumentSource, Mapping, PackagePath};

use crate::constants::DEFAULT_CHUNK_BYTES;
use crate::error::ResourceError;
use crate::journal::{self, JournalRecoveryReport, JournalTicket, TEMP_FILE_PREFIX};
use crate::memory::guess_mime_type;
use crate::provider::{
    ByteRange, DirectoryEntry, FileMetadata, ResourceAddress, ResourceMetadata, ResourceProvider,
    ResourceStream,
};
use crate::scope::{ScopeId, ScopeKind};

/// 在册 Provider 标识（注册表键；管理器挂载与测试共用）。
pub const ARCHIVE_PROVIDER_ID: &str = "archive";

/// 未变更成员流式复用的分块长度（常数内存面，《11.05》§5.4「未变更成员」行；
/// 与解析器写侧 `STREAM_CHUNK_BYTES` 同量级的工程参数，非协议面）。
const REUSE_CHUNK_BYTES: usize = 64 * 1024;

/// 发布侧经典 ZIP 字段上限（`u32::MAX` 字节）：数值闸的在册口径以解析器为
/// 权威，本常量仅用于把「超上限」如实折算为 `RESOURCE_TOO_LARGE` 的 `limit`
/// 字段（发布侧禁 ZIP64，《06.10》§10.2）。
const CLASSIC_ZIP_FIELD_LIMIT: u64 = 4_294_967_295;

/// 发布侧条目数与名称长度上限（经典 ZIP 计数字段 `u16::MAX`，《06.10》§10.2）。
const CLASSIC_ZIP_COUNT_LIMIT: u64 = 65_535;

/// 单个挂载：只读归档源 + 归档文件宿主路径 + 作用域种类（元数据 `scope`
/// 字段如实回报）。
struct ArchiveMount {
    source: Arc<ArchiveSource>,
    path: PathBuf,
    kind: ScopeKind,
}

impl Clone for ArchiveMount {
    fn clone(&self) -> Self {
        Self {
            source: Arc::clone(&self.source),
            path: self.path.clone(),
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
    /// 挂载时归档槽位恢复扫描报告账（作用域 → 最近一次进入引擎的处置账目，
    /// 波 C2a-3；`detach_archive` 随注销归还，零泄漏）。
    recovery_reports: Mutex<BTreeMap<ScopeId, JournalRecoveryReport>>,
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
            recovery_reports: Mutex::new(BTreeMap::new()),
            chunk_limit: chunk_limit.max(1),
        }
    }

    fn table(&self) -> MutexGuard<'_, BTreeMap<ScopeId, ArchiveMount>> {
        self.mounts.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn reports(&self) -> MutexGuard<'_, BTreeMap<ScopeId, JournalRecoveryReport>> {
        self.recovery_reports
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    /// 挂载归档文件：`path` 必须存在且可经解析器归档层打开（登记失败
    /// 不降级，《06》§3.2）；重复挂载返回 `RESOURCE_ALREADY_EXISTS`。
    ///
    /// 挂载即归档槽位恢复扫描（波 C2a-3 接线位，与目录域 `attach_root` 的
    /// [`journal::recover_root`] 同方言）：打开归档前对**归档文件同级目录**
    /// 做一次单层定向扫描（[`journal::recover_package_slot`]），把整包重建
    /// 崩溃在 prepare 窗口的残骸（意图记录 + 临时整包）按三态判据回滚，
    /// 正式归档保持旧态；处置账目随挂载返回并记入报告账
    /// （[`Self::recovery_report`] 可查）。扫描失败不改变挂载成败，逐项
    /// 如实计入报告。
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
    ) -> Result<JournalRecoveryReport, ResourceError> {
        let scope_root_uri = format!("chips-resource://{scope}/");
        if self.table().contains_key(scope) {
            return Err(ResourceError::AlreadyExists { uri: scope.clone() });
        }
        let report = path
            .parent()
            .map(journal::recover_package_slot)
            .unwrap_or_default();
        let source = ArchiveSource::open(path, &chips_parser::model::ParseLimits::default())
            .map_err(|error| match error {
                DocumentError::Io { .. } => ResourceError::NotFound {
                    uri: scope_root_uri.clone(),
                },
                _ => ResourceError::Internal,
            })?;
        let mut table = self.table();
        if table.contains_key(scope) {
            return Err(ResourceError::AlreadyExists { uri: scope.clone() });
        }
        table.insert(
            scope.clone(),
            ArchiveMount {
                source: Arc::new(source),
                path: path.to_path_buf(),
                kind,
            },
        );
        drop(table);
        self.reports().insert(scope.clone(), report.clone());
        Ok(report)
    }

    /// 摘除作用域归档挂载（注销级联的 Provider 侧归还）；未在册返回
    /// `false`。同步归还该作用域的槽位恢复扫描报告账。
    pub fn detach_archive(&self, scope: &ScopeId) -> bool {
        let detached = self.table().remove(scope).is_some();
        if detached {
            self.reports().remove(scope);
        }
        detached
    }

    /// 作用域最近一次挂载的归档槽位恢复扫描报告（只读探测；未挂载为
    /// `None`，波 C2a-3）。
    #[must_use]
    pub fn recovery_report(&self, scope: &ScopeId) -> Option<JournalRecoveryReport> {
        self.reports().get(scope).cloned()
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

    /// 整包重建 prepare 相（波 C2a-3，《11.05》§5.4 发布态重建的落盘通道）：
    /// 以在册挂载的归档文件宿主路径为换代目标，按「意图记录先建 → 同级隐藏
    /// 临时整包写出 → `flush` + `sync_all`」的顺序把**全部慢 IO** 收在本相，
    /// 不 `rename`（发布由 [`Self::publish_rebuild_package`] 在管理器全事务
    /// 判定完成后执行）。
    ///
    /// 成员集换算：终成员集 = （旧包成员 − `removals` − 被覆写路径）∪
    /// `members`，按包内路径升序单序写出（解析器写侧的严格升序要求由
    /// `BTreeMap` 键序天然满足）；未变更成员经 [`MemberReader`] 分块流式复用
    /// （常内存，不整包载入）。
    ///
    /// 拒绝臂（错误码零新增，《06.02》§2.4）：删除目标不在旧包 →
    /// `RESOURCE_NOT_FOUND`（成员精确 uri）；发布格式上限（条目数 / 名称长度 /
    /// 单成员字节 / 归档总字节闭式和）与作用域 `max_package_bytes` 超限 →
    /// `RESOURCE_TOO_LARGE`（`size` / `limit` 均为真实数值）；未挂载 →
    /// `RESOURCE_INTERNAL`（装配兜底，与读取面同型）；写出任一步 IO 失败 →
    /// `RESOURCE_WRITE_FAILED`（临时整包即时删除、记录撤销、正式归档零触碰）。
    ///
    /// 调用方必须持有整包槽位的写锁许可（管理器 `rebuild_archive` 单源接线，
    /// 本方法不自行取锁）。
    pub(crate) fn stage_rebuild_package(
        &self,
        scope: &ScopeId,
        plan: &ArchiveRebuildPlan<'_>,
    ) -> Result<ArchiveRebuildTransaction, ChipsError> {
        let mount = self
            .table()
            .get(scope)
            .cloned()
            .ok_or_else(|| ResourceError::Internal.to_chips_error())?;
        let target = mount.path.clone();
        let parent = target
            .parent()
            .ok_or_else(|| ResourceError::Internal.to_chips_error())?
            .to_path_buf();
        if !parent.is_dir() {
            return Err(ResourceError::NotFound {
                uri: plan.scope_root_uri.clone(),
            }
            .to_chips_error());
        }
        let entries = assemble_rebuild_entries(&mount.source, plan)?;
        check_publish_bounds(&entries, plan)?;
        check_publish_total_size(&entries, plan)?;
        let token = journal::next_intent_token();
        let temp_path = parent.join(format!("{TEMP_FILE_PREFIX}{token}"));
        // prepare 相：意图记录先于临时物建档（C2a-1 不变量「记录可见 ⇒ 在途
        // 在册」）；记录路径的判读基准取归档同级目录（整包换代的槽位域）。
        let ticket = JournalTicket::prepare(&parent, token, &temp_path, &target).map_err(|_| {
            ResourceError::WriteFailed {
                uri: plan.scope_root_uri.clone(),
            }
            .to_chips_error()
        })?;
        let staged: Result<(u64, usize, usize), ChipsError> = (|| {
            let file = File::create(&temp_path).map_err(|_| write_failed(plan))?;
            let mut writer = ZipArchiveWriter::new(file, plan.saved_at)
                .map_err(|error| publish_error(plan, &error))?;
            let mut written = 0usize;
            let mut reused = 0usize;
            for (path, entry) in &entries {
                match entry {
                    RebuildEntry::Written { bytes } => {
                        writer
                            .add_entry(path, bytes)
                            .map_err(|error| publish_error(plan, &error))?;
                        written += 1;
                    }
                    RebuildEntry::Reused { size } => {
                        let mut reader = MemberReader {
                            source: &mount.source,
                            path: (*path).clone(),
                            offset: 0,
                            remaining: *size,
                        };
                        writer
                            .add_entry_with_size(path, *size, &mut reader)
                            .map_err(|error| publish_error(plan, &error))?;
                        reused += 1;
                    }
                }
            }
            let total = writer
                .finish()
                .map_err(|error| publish_error(plan, &error))?;
            let mut file = writer.into_inner();
            file.flush().map_err(|_| write_failed(plan))?;
            file.sync_all().map_err(|_| write_failed(plan))?;
            drop(file);
            Ok((total, written, reused))
        })();
        let (total_bytes, written_members, reused_members) = match staged {
            Ok(staged) => staged,
            Err(error) => {
                // 整写出败途：临时物即时清理、票据撤账销账（临时物先、
                // 记录后，与目录域 staging 失败臂同通道同序）。
                let _ = fs::remove_file(&temp_path);
                drop(ticket);
                return Err(error);
            }
        };
        // 发布尺寸实然闸（`finish` 返回真实总字节，先于 rename 把守作用域
        // 上限；闭式和只是提前拒绝臂）。
        if total_bytes > plan.max_package_bytes {
            let _ = fs::remove_file(&temp_path);
            drop(ticket);
            return Err(ResourceError::TooLarge {
                uri: plan.scope_root_uri.clone(),
                size: total_bytes,
                limit: plan.max_package_bytes,
            }
            .to_chips_error());
        }
        Ok(ArchiveRebuildTransaction {
            scope: scope.clone(),
            temp_path,
            target_path: target,
            kind: mount.kind,
            scope_root_uri: plan.scope_root_uri.clone(),
            journal: Some(ticket),
            total_bytes,
            written_members,
            reused_members,
            removed_members: plan.removals.len(),
        })
    }

    /// 整包重建 publish 相（波 C2a-3）：`rename` 原子换代 → 撤销意图记录并
    /// 销账 → 以新归档文件重挂作用域（读取面与盘上实况同步）。
    ///
    /// 失败语义：换代 `rename` 失败 → 临时整包删除、记录撤销、正式归档保持
    /// 旧态（`RESOURCE_WRITE_FAILED`，uri 取作用域基址形——整包槽位的受管
    /// 引用即作用域根，《04.11》§11.1 归档态口径）；换代成功但新包重挂失败
    /// （解析器索引期拒绝，实践不可达）→ 摘除陈旧挂载并如实上抛
    /// `RESOURCE_INTERNAL`：宁可不交付视图，绝不交付换代前的旧包视图；
    /// 盘上正式归档此时已是新包（换代事实不可逆，由宿主重挂恢复）。
    pub(crate) fn publish_rebuild_package(
        &self,
        mut transaction: ArchiveRebuildTransaction,
    ) -> Result<ArchiveRebuildReceipt, ChipsError> {
        if fs::rename(&transaction.temp_path, &transaction.target_path).is_err() {
            let _ = fs::remove_file(&transaction.temp_path);
            // `transaction` 随本函数返回 Drop：临时物已清、票据撤账销账。
            return Err(ResourceError::WriteFailed {
                uri: transaction.scope_root_uri.clone(),
            }
            .to_chips_error());
        }
        transaction.temp_path = PathBuf::new();
        drop(transaction.journal.take());
        match ArchiveSource::open(
            &transaction.target_path,
            &chips_parser::model::ParseLimits::default(),
        ) {
            Ok(source) => {
                self.table().insert(
                    transaction.scope.clone(),
                    ArchiveMount {
                        source: Arc::new(source),
                        path: transaction.target_path.clone(),
                        kind: transaction.kind,
                    },
                );
                Ok(ArchiveRebuildReceipt {
                    total_bytes: transaction.total_bytes,
                    written_members: transaction.written_members,
                    reused_members: transaction.reused_members,
                    removed_members: transaction.removed_members,
                })
            }
            Err(_) => {
                self.detach_archive(&transaction.scope);
                Err(ResourceError::Internal.to_chips_error())
            }
        }
    }
}

/// 整包重建的覆写/新增成员（Provider 侧内部载荷：包内路径已过在册校验，
/// 字节以借用方式交付全量新内容，不复制）。
pub(crate) struct ArchiveRebuildMember<'a> {
    /// 包内路径（终成员集中的键）。
    pub(crate) path: PackagePath,
    /// 覆写/新增字节（体量闸在管理器入口把守）。
    pub(crate) bytes: &'a [u8],
}

/// 整包重建计划（波 C2a-3，管理器 → ArchiveProvider 的 crate 间内部载荷）。
pub(crate) struct ArchiveRebuildPlan<'a> {
    /// 作用域基址受管引用（整包槽位错误回执的 uri 形）。
    pub(crate) scope_root_uri: String,
    /// 覆写/新增成员（全量字节，借用自管理器请求体）。
    pub(crate) members: Vec<ArchiveRebuildMember<'a>>,
    /// 不承接的旧成员（换代即消失，无独立删除动作）。
    pub(crate) removals: Vec<PackagePath>,
    /// 保存时刻（全部条目时间戳统一取该时刻，《11.05》§5.4）。
    pub(crate) saved_at: SystemTime,
    /// 发布尺寸上限（作用域策略 `max_resource_bytes`）。
    pub(crate) max_package_bytes: u64,
}

/// 终成员集条目来源（`assemble_rebuild_entries` 的换算产物）。
enum RebuildEntry<'a> {
    /// 覆写/新增：调用方交付全量字节。
    Written { bytes: &'a [u8] },
    /// 未变更：自旧包按声明尺寸流式复用。
    Reused { size: u64 },
}

/// 整包重建 publish 成功回执（换代事实账目）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveRebuildReceipt {
    /// 新归档总字节（解析器写侧 `finish` 实然读数）。
    pub total_bytes: u64,
    /// 覆写/新增成员数。
    pub written_members: usize,
    /// 流式复用的未变更成员数。
    pub reused_members: usize,
    /// 本次换代不再承接的成员数。
    pub removed_members: usize,
}

/// 已 staging 的整包重建事务（prepare 相产物）：临时整包与全量字节已落盘并
/// `sync_all`、意图记录在册，等待 [`ArchiveProvider::publish_rebuild_package`]
/// 换代。未发布即弃置时 `Drop` 清理临时物并撤记录（临时物先、记录后），
/// 正式归档保持旧态、零残留；崩溃落在本窗口由挂载槽位扫描收敛。
pub(crate) struct ArchiveRebuildTransaction {
    scope: ScopeId,
    temp_path: PathBuf,
    target_path: PathBuf,
    kind: ScopeKind,
    scope_root_uri: String,
    journal: Option<JournalTicket>,
    total_bytes: u64,
    written_members: usize,
    reused_members: usize,
    removed_members: usize,
}

impl Drop for ArchiveRebuildTransaction {
    fn drop(&mut self) {
        if !self.temp_path.as_os_str().is_empty() {
            let _ = fs::remove_file(&self.temp_path);
        }
        // `journal` 字段随本体 Drop 撤销意图记录并销账。
    }
}

/// 终成员集换算（旧包索引 − 删除 − 覆写 ∪ 覆写/新增）：`BTreeMap` 键序即
/// 包内路径升序（`PackagePath` 的 `Ord` 为 UTF-8 字节序，与解析器写侧的
/// 严格升序要求同源），故写出序确定性由键空间保证。
fn assemble_rebuild_entries<'a>(
    source: &'a ArchiveSource,
    plan: &'a ArchiveRebuildPlan<'a>,
) -> Result<BTreeMap<&'a PackagePath, RebuildEntry<'a>>, ChipsError> {
    let mut removals: BTreeSet<&str> = BTreeSet::new();
    for path in &plan.removals {
        if source.member(path).is_none() {
            return Err(ResourceError::NotFound {
                uri: member_uri(plan, path),
            }
            .to_chips_error());
        }
        removals.insert(path.as_str());
    }
    let mut entries: BTreeMap<&'a PackagePath, RebuildEntry<'a>> = BTreeMap::new();
    for (path, member) in source.members() {
        if removals.contains(path.as_str()) {
            continue;
        }
        entries.insert(
            path,
            RebuildEntry::Reused {
                size: member.meta.size,
            },
        );
    }
    for member in &plan.members {
        entries.insert(
            &member.path,
            RebuildEntry::Written {
                bytes: member.bytes,
            },
        );
    }
    Ok(entries)
}

/// 成员级受管引用（错误回执定位；作用域基址以 `/` 结尾，直串即规范形）。
fn member_uri(plan: &ArchiveRebuildPlan<'_>, path: &PackagePath) -> String {
    format!("{}{}", plan.scope_root_uri, path.as_str())
}

/// 发布格式数值闸（条目数、名称长度、单成员字节）：数值越界即
/// `RESOURCE_TOO_LARGE`（`size` / `limit` 为真实越界读数；发布侧禁 ZIP64，
/// 权威判定仍在解析器 `check_publish_bounds`，本闸只负责把拒绝折算为在册
/// 错误形，绝不放宽）。
fn check_publish_bounds(
    entries: &BTreeMap<&PackagePath, RebuildEntry<'_>>,
    plan: &ArchiveRebuildPlan<'_>,
) -> Result<(), ChipsError> {
    let too_large = |uri: String, size: u64, limit: u64| {
        ResourceError::TooLarge { uri, size, limit }.to_chips_error()
    };
    if entries.len() > usize::try_from(CLASSIC_ZIP_COUNT_LIMIT).unwrap_or(usize::MAX) {
        return Err(too_large(
            plan.scope_root_uri.clone(),
            entries.len() as u64,
            CLASSIC_ZIP_COUNT_LIMIT,
        ));
    }
    for (path, entry) in entries {
        let name_bytes = u64::try_from(path.as_str().len()).unwrap_or(u64::MAX);
        if name_bytes > CLASSIC_ZIP_COUNT_LIMIT {
            return Err(too_large(
                member_uri(plan, path),
                name_bytes,
                CLASSIC_ZIP_COUNT_LIMIT,
            ));
        }
        if let RebuildEntry::Written { bytes } = entry {
            let size = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
            if size > CLASSIC_ZIP_FIELD_LIMIT {
                return Err(too_large(
                    member_uri(plan, path),
                    size,
                    CLASSIC_ZIP_FIELD_LIMIT,
                ));
            }
        }
    }
    Ok(())
}

/// 归档总字节闭式和闸（解析器 `archive_total_size` 为唯一权威）+ 作用域发布
/// 尺寸预闸：超限即 `RESOURCE_TOO_LARGE`；解析器越界拒绝（累计偏移 / 溢出）
/// 时以本侧可实算的累计字节为 `size`、经典字段上限为 `limit` 如实上报。
/// 本闸是**提前拒绝臂**（避免白写一遍整包），发布尺寸的实然判定在 `finish`
/// 之后另行把守，两者互不放宽。
fn check_publish_total_size(
    entries: &BTreeMap<&PackagePath, RebuildEntry<'_>>,
    plan: &ArchiveRebuildPlan<'_>,
) -> Result<(), ChipsError> {
    let sized: Vec<(PackagePath, u64)> = entries
        .iter()
        .map(|(path, entry)| {
            let size = match entry {
                RebuildEntry::Written { bytes } => u64::try_from(bytes.len()).unwrap_or(u64::MAX),
                RebuildEntry::Reused { size } => *size,
            };
            let owned: PackagePath = (**path).clone();
            (owned, size)
        })
        .collect();
    let total = archive_total_size(&sized).map_err(|_| {
        let accumulated = sized.iter().fold(0u64, |acc, (path, size)| {
            acc.saturating_add(*size)
                .saturating_add(entry_overhead(path.as_str().len()))
        });
        ResourceError::TooLarge {
            uri: plan.scope_root_uri.clone(),
            size: accumulated,
            limit: CLASSIC_ZIP_FIELD_LIMIT,
        }
        .to_chips_error()
    })?;
    if total > plan.max_package_bytes {
        return Err(ResourceError::TooLarge {
            uri: plan.scope_root_uri.clone(),
            size: total,
            limit: plan.max_package_bytes,
        }
        .to_chips_error());
    }
    Ok(())
}

/// 写侧 IO 失败 → `RESOURCE_WRITE_FAILED`（uri 取整包槽位作用域基址形）。
fn write_failed(plan: &ArchiveRebuildPlan<'_>) -> ChipsError {
    ResourceError::WriteFailed {
        uri: plan.scope_root_uri.clone(),
    }
    .to_chips_error()
}

/// 解析器写侧错误 → 资源协议在册码（《06》§7.2 零自造）：发布上限拒绝
/// （`LimitExceeded`，条目数 / 名称长度 / 单成员 / 累计偏移族）折算
/// `RESOURCE_TOO_LARGE`，`size` 取本次成员集实算累计、`limit` 取经典字段
/// 上限；其余（`Io` / `ArchiveInvalid` 防御臂）→ `RESOURCE_WRITE_FAILED`
/// （整包写不出去即写失败，正式归档保持旧态）。
fn publish_error(plan: &ArchiveRebuildPlan<'_>, error: &DocumentError) -> ChipsError {
    match error {
        DocumentError::LimitExceeded { .. } => {
            let accumulated = plan.members.iter().fold(0u64, |acc, member| {
                acc.saturating_add(member.bytes.len() as u64)
            });
            ResourceError::TooLarge {
                uri: plan.scope_root_uri.clone(),
                size: accumulated,
                limit: CLASSIC_ZIP_FIELD_LIMIT,
            }
            .to_chips_error()
        }
        _ => write_failed(plan),
    }
}

/// 未变更成员的流式复用读游标：把解析器归档层的范围读面
/// （[`ArchiveSource::read_member_range`]）适配为写侧
/// `add_entry_with_size` 所需的 `&mut dyn Read`，按 [`REUSE_CHUNK_BYTES`]
/// 常数内存推进（不整包载入，《11.05》§5.4「未变更成员」行）。
/// 读取 IO 失败以 `std::io::Error` 上抛，由写侧统一收敛为
/// `RESOURCE_WRITE_FAILED`；实际可读字节少于声明尺寸时以 `Ok(0)` 收口，
/// 由写侧的声明尺寸一致性闸拒绝（不留半截条目）。
struct MemberReader<'a> {
    source: &'a ArchiveSource,
    path: PackagePath,
    offset: u64,
    remaining: u64,
}

impl Read for MemberReader<'_> {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        if self.remaining == 0 || buffer.is_empty() {
            return Ok(0);
        }
        let want = usize::try_from(self.remaining)
            .unwrap_or(usize::MAX)
            .min(buffer.len())
            .min(REUSE_CHUNK_BYTES);
        let bytes = self
            .source
            .read_member_range(&self.path, self.offset, Some(want as u64))
            .map_err(|_| std::io::Error::other("归档成员复用读取失败"))?;
        let filled = bytes.len().min(buffer.len()).min(usize::MAX);
        if filled == 0 {
            return Ok(0);
        }
        buffer[..filled].copy_from_slice(&bytes[..filled]);
        self.offset += filled as u64;
        self.remaining = self.remaining.saturating_sub(filled as u64);
        Ok(filled)
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
