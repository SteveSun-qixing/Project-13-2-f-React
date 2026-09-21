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
//! [`ResourceProvider`] 是段二文件系统抽象层的在册契约（本段只有测试替身）。
//!
//! # 错误口径
//!
//! 全部错误码取自《06》§7.2 唯一权威码表（见 [`error`] 模块常量），
//! 本 crate 不新增码、不自造 ID；错误只以 `code` 分支消费。同步判定入口
//! 返回 [`ResourceError`]，触达 Provider 的异步入口以跨边界单形
//! `ChipsError` 收口（`From<ResourceError> for ChipsError`）。
//!
//! # 段一边界
//!
//! 具体 Provider 挂载（目录 / ZIP Store / 内存 / HTTP）、缓存与单一飞
//! 行（§六之外的 P2/P3）、断点续传与 Range 合并、`file:*` / `resource:*`
//! 能力面接线、Neon 绑定与 host TS 适配层均不在本段。
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

pub mod constants;
pub mod error;
pub mod handle;
pub mod manager;
pub mod path_guard;
pub mod permission;
pub mod provider;
pub mod scope;
pub mod session;
pub mod uri;

pub use constants::ResourceLimits;
pub use error::{
    HandleState, InvalidateReason, PathErrorReason, PermissionDenyReason, PoolKind, ResourceError,
    UriErrorReason,
};
pub use handle::{HandleEntrySnapshot, HandleTable, InvalidateListener, StreamSlot};
pub use manager::{
    external_origin_of, handles_of_session, open_handle_count, ManagerResult, OpenHandle,
    OpenRequest, ProviderRegistry, ResolvedResource, ResourceManager,
};
pub use path_guard::{resolve_within_root, VirtualPath};
pub use permission::{
    Decision, PermissionChecker, ResourceOperation, PERMISSION_NETWORK_HTTP_PREFIX,
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

/// crate 内统一的资源域结果别名（公开可消费）。
pub type ResourceResult<T> = Result<T, ResourceError>;
