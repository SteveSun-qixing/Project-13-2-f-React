//! 薯片平台核心公共层。
//!
//! 本 crate 是 Rust 核心（`chips-core` / `chips-cordis` / `chips-bridge` /
//! `chips-parser` / `chips-resource`）的公共类型唯一来源，内容与
//! 《核心接口规范》第三章一致：
//!
//! - 标识别名：[`PluginId`]、[`ServiceName`]、[`EventName`]、[`ServiceValue`] 与 ID 族；
//! - 取消令牌：[`CancelToken`]；
//! - 跨边界错误：[`ChipsError`]；
//! - 权限判定出站观察面：[`DecisionObserver`] 与素材类型
//!   [`PermissionDecision`]（RFC-权限审计跨层采集sink裁定 §5.1）；
//! - 版本工具：[`Version`] / [`VersionRange`]（语义化版本规则与范围语法）；
//! - 版本常量：[`PLATFORM_VERSION`] / [`CORE_ABI_VERSION`]。
//!
//! 子系统错误保持各自强类型枚举（如 `chips-cordis` 的 `KernelError`），在
//! Neon 边界归一为 [`ChipsError`]。

#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod audit;
pub mod cancel;
pub mod constants;
pub mod error;
pub mod ids;
pub mod version;

pub use audit::{
    emit_permission_decision, DecisionAction, DecisionDomain, DecisionObserver, FnDecisionObserver,
    NoopDecisionObserver, PermissionDecision, PermissionDenyReason,
};
pub use cancel::CancelToken;
pub use constants::{CORE_ABI_VERSION, PLATFORM_VERSION};
pub use error::ChipsError;
pub use ids::{
    ContextId, EventName, ForkId, HandleId, InjectionId, PluginId, ServiceName, ServiceValue,
    SessionId,
};
pub use version::{Version, VersionError, VersionRange};
