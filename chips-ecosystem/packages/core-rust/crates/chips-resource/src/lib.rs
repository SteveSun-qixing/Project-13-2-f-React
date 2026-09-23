//! `chips-resource`：薯片生态资源寻址内核（Rust 权威实现）。
//!
//! 本 crate 是《06-资源协议规范》与《04-资源管理设计》管理器侧语义的权威
//! 落地，段一只交付「寻址内核」四个面：
//!
//! - **URI 面**（§2、§3）：[`resolve_input`] / [`normalize_reference`] 完成
//!   `chips-resource://<scope>/<path>[?<query>]` 语法解析、External 双权限
//!   origin 拆解、百分号与 Unicode 归一化，产出 [`CanonicalUri`]；
//! - **权限面**（§4、《04》§5.3）：[`PermissionChecker`] 按在册的作用域 ×
//!   能力面矩阵判定，缺权时给出 `required` / `missing` / `granted` 明细；
//! - **路径安全面**（§9、《04》§9）：[`VirtualPath`] 承载全量在册防护
//!   （穿越、归一化、符号链接、大小写与平台特例、长度与控制字符）；
//! - **句柄与租约面**（§6、《04》§4）：[`HandleTable`] 实现 `open →
//!   invalidated → released` 三态与非法迁移拒绝、ID 永不复用、流/范围读
//!   互斥与会话/作用域级联归还。
//!
//! [`ResourceManager`] 把四个面串成《04》§5.1 的解析流水线，并对外提供
//! `open` / `stat` / `read_range` / `read_chunk` / `release` 入口；
//! [`ResourceProvider`] 是文件系统抽象层的在册契约，段二 B1 起挂载内置
//! [`MemoryProvider`]（运行时内存字节，《04》§3.3），段二 B2 起挂载内置
//! [`DirectoryProvider`]（真实文件系统目录域，《04》§3.3），段二 B3 起挂载内置
//! [`ArchiveProvider`]（ZIP Store 归档只读域，《04》§3.3），并交付写入
//! 提交面（`commit_write` / `delete` / `rename` / `copy` /
//! `create_directory` / `list_directory`）与流式提交面
//! （`open_write_stream` / `append_write_stream` / `commit_write_stream` /
//! `abort_write_stream`，由 [`WriteCoordinator`] 提供目录写族单写者路径锁），
//! 段三 #192 起挂载内置 [`http::HttpProvider`]（External 网络抓取策略
//! 引擎，注入式 [`http::HttpRequestPort`]，《04》§八）。
//!
//! # 错误口径
//!
//! 全部错误码取自《06》§7.2 唯一权威码表（见 [`error`] 模块常量），
//! 本 crate 不新增码、不自造 ID；错误只以 `code` 分支消费。同步判定入口
//! 返回 [`ResourceError`]，触达 Provider 的异步入口以跨边界单形
//! `ChipsError` 收口（`From<ResourceError> for ChipsError`）。
//!
//! # 段边界
//!
//! 段一交付寻址内核四面。段二 B1 追加 MemoryProvider 挂载、写入提交面与
//! Unicode 触发臂（工单042 裁定④）。段二 B2 追加 DirectoryProvider
//! （`mount_directory` 真实目录域：读面 + 流面 + 列举面 + 写入提交面，
//! 落位后宿主侧符号链接逃逸防御，《06》§9.1）。段二 B3 追加 ArchiveProvider
//! （`mount_archive` ZIP 归档只读域：读面 + 流面 + 列举面，写入族全量
//! `RESOURCE_READ_ONLY`，归档解析复用 `chips-parser` 归档层公开读取面）
//! 与流式写入提交面（`open_write_stream` → `commit_write_stream`，
//! 《04.04》§4.9 单写者路径锁 + 零残留 temp 清理），并把
//! `RESOURCE_READ_ONLY` 的 `details.uri` 统一到精确目标 uri
//! （工单044 §三.5 裁定⑧-2）。段三 #157 收口捆绑单：Unicode 触发臂按
//! 工单043 裁定 A1 收紧为非字符全集（U+nFFFE/U+nFFFF 全 17 平面 +
//! U+FDD0–U+FDEF + U+FFFD，《06.02》§2.4），Manager 异步写族入口改经
//! `WriteCoordinator::lock_async`（#151 异步形残账收口）。段三主体
//! #185 交付缓存面（L0/L1/L2 + SingleFlight + epoch 竞态失效，《04》§六）
//! 与错误模型 NetworkFailed 族；#192 交付 [`http`] 模块网络抓取策略引擎
//! （SSRF 地址族拦截、逐跳重定向复校验、三超时下发、2 GiB 响应上限、
//! 请求头净化、L2 条件请求复验，《04》§八）。工单036 波 C2a-1 起交付
//! [`journal`] 提交日志（目录域写意图落盘 prepare–commit 两相）与挂载时
//! 恢复扫描（崩溃中间态收敛 + 无账临时物如实计数）。`file:*` /
//! `resource:*` 能力面接线与 host 侧网络端口装配、Neon 绑定面
//! （packages/native）均不在本 crate 本段。
//!
//! # 示例
//!
//! ```
//! use std::collections::BTreeSet;
//!
//! use chips_resource::{resolve_input, ResourceLimits, UriErrorReason};
//!
//! let limits = ResourceLimits::default();
//! let uri = resolve_input("https://CDN.example.com/a%20b.png", &limits)
//!     .expect("裸 http(s) 输入在册接受");
//! assert_eq!(uri.scope, "external");
//! assert_eq!(uri.to_canonical_string(), "chips-resource://external/https/cdn.example.com/a%20b.png");
//!
//! // 受管作用域携带查询串按在册规则拒绝。
//! let error = resolve_input("chips-resource://card-1/a?x=1", &limits)
//!     .expect_err("受管作用域禁止查询串");
//! assert!(matches!(error, chips_resource::ResourceError::InvalidUri {
//!     reason: UriErrorReason::QueryNotAllowed,
//!     ..
//! }));
//! ```

#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod archive;
pub mod cache;
pub mod constants;
pub mod directory;
pub mod error;
pub mod handle;
pub mod http;
pub mod journal;
pub mod manager;
pub mod memory;
pub mod path_guard;
pub mod permission;
pub mod provider;
pub mod scope;
pub mod session;
pub mod uri;
pub mod write_coord;

pub use archive::{ArchiveProvider, ArchiveStream, ARCHIVE_PROVIDER_ID};
pub use cache::{
    CacheKey, CacheStats, CacheStore, CachedMetadata, DiskCache, DiskEntry, DiskMeta, SingleFlight,
};
pub use constants::ResourceLimits;
pub use directory::{DirectoryProvider, FileStream, DIRECTORY_PROVIDER_ID};
pub use error::{
    HandleState, InvalidateReason, NetworkErrorReason, PathErrorReason, PermissionDenyReason,
    PoolKind, ResourceError, ScopeOperation, UriErrorReason,
};
pub use handle::{HandleEntrySnapshot, HandleTable, InvalidateListener, StreamSlot};
pub use http::{
    address_is_blocked, parse_cache_control, parse_target_url, resolve_location, version_stamp,
    CacheDirectives, HttpMethod, HttpPortFailure, HttpRequest, HttpRequestPort, HttpResponse,
    HttpStream, HttpTarget, TargetRejection, IF_MODIFIED_SINCE, IF_NONE_MATCH, PLATFORM_USER_AGENT,
};
pub use http::{HttpProvider, HTTP_PROVIDER_ID};
pub use journal::{
    is_in_flight, journal_file_token, next_intent_token, read_commit_record, recover_root,
    temp_file_token, CommitRecord, JournalRecoveryReport, JournalTicket, JOURNAL_FILE_SUFFIX,
    JOURNAL_RECORD_MAX_BYTES, RECOVERY_WALK_MAX_DEPTH, RECOVERY_WALK_MAX_ENTRIES, TEMP_FILE_PREFIX,
};
pub use manager::{
    external_origin_of, handles_of_session, open_handle_count, FsOpRequest, ManagerResult,
    OpenHandle, OpenRequest, ProviderRegistry, ResolvedResource, ResourceManager, WriteRequest,
    WriteStreamHandle, WriteStreamRequest,
};
pub use memory::{guess_mime_type, MemoryProvider, MemoryStream};
pub use path_guard::{
    is_forbidden_unicode, percent_decode_checked, resolve_within_root, PercentDecodeFailure,
    VirtualPath,
};
pub use permission::{
    Decision, DecisionArm, PermissionChecker, ResourceOperation, PERMISSION_NETWORK_HTTP_PREFIX,
    PERMISSION_RESOURCES_READ, PERMISSION_RESOURCES_READ_EXTERNAL, PERMISSION_RESOURCES_WRITE,
};
pub use provider::{
    ByteRange, DirectoryEntry, FileMetadata, ResourceAddress, ResourceMetadata, ResourceProvider,
    ResourceStream, VersionStamp,
};
pub use scope::{
    external_registration_key, HostPattern, Origin, ScopeId, ScopeKind, ScopePolicy,
    ScopeRegistration, ScopeRegistry,
};
pub use session::{ResourceSession, SessionKind, SessionRegistry, MAX_JS_SAFE_ID};
pub use uri::{
    is_registered_scope_naming, nfc_normalize, normalize_reference, parse_canonical_form,
    resolve_input, CanonicalUri, ExternalOrigin, EXTERNAL_SCOPE, EXTERNAL_TARGET_SCHEMES,
    MANAGED_SCOPE_PREFIXES, MEMORY_SCOPE, PLATFORM_SCOPE, RESOURCE_SCHEME,
};
pub use write_coord::{PathLockKey, PathWritePermit, WriteCoordinator};

/// crate 内统一的资源域结果别名（公开可消费）。
pub type ResourceResult<T> = Result<T, ResourceError>;
