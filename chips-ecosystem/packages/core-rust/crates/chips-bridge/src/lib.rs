//! `chips-bridge`：Bridge 能力内核的 Rust 权威实现（《核心接口规范》§5）。
//!
//! 本 crate 是桌面端与移动端共享的能力注册表与调用收口内核：
//! - [`Bridge`]：注册表、会话表、权限判定、Schema 校验、并发准入、超时与
//!   取消的唯一权威实例（`src/bridge.rs`）；
//! - [`CapabilityDescriptor`] 等注册与调用类型与《核心接口规范》§5.1 逐字
//!   对齐（`src/descriptor.rs`）；
//! - 权限判定采用「精确匹配 + 域通配」快照模型（《Bridge三层设计》§5，
//!   `src/permissions.rs`）；
//! - 输入校验基于 `jsonschema` 离线编译 + 平台严格语义扫描（《能力契约
//!   规范》§5，`src/schema.rs`）；
//! - 错误码常量见 [`error_codes`]，策略常量（超时、队列上限、缓存容量等）
//!   经根路径重导出，ID 文法与内置保留集见 [`naming`]。
//!
//! 依赖方向铁律（《核心接口规范》§2.1）：本 crate 只依赖 `chips-core` 的
//! 基础类型，不依赖任何 TS 包，也不得向宿主暴露业务语义。
//!
//! # 示例
//!
//! ```
//! use std::collections::BTreeMap;
//! use std::sync::Arc;
//!
//! use chips_bridge::{
//!     Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityInput,
//!     CapabilityOutput, CapabilityRegistration, Concurrency, ProviderKind,
//!     ProviderRegistration,
//! };
//! use serde_json::json;
//!
//! /// 回声执行器：原样返回输入。
//! struct Echo;
//!
//! #[async_trait::async_trait]
//! impl chips_bridge::CapabilityExecutor for Echo {
//!     async fn execute(
//!         &self,
//!         _ctx: &CapabilityContext,
//!         input: CapabilityInput,
//!     ) -> Result<CapabilityOutput, chips_core::ChipsError> {
//!         Ok(CapabilityOutput {
//!             json: input.json,
//!             bin: BTreeMap::new(),
//!         })
//!     }
//! }
//!
//! # async fn run() -> Result<(), chips_core::ChipsError> {
//! let bridge = Bridge::new();
//! bridge.activate_provider(ProviderRegistration {
//!     id: "chips.official.host".to_owned(),
//!     kind: ProviderKind::PlatformService,
//!     permissions: Vec::new(),
//! })?;
//! bridge.register(CapabilityRegistration {
//!     descriptor: CapabilityDescriptor {
//!         id: "file:read".to_owned(),
//!         schema: json!({"type":"object","additionalProperties":false,"properties":{"path":{"type":"string"}},"required":["path"]}),
//!         permissions: Vec::new(),
//!     },
//!     owner: "chips.official.host".to_owned(),
//!     timeout_ms: chips_bridge::DEFAULT_TIMEOUT_MS,
//!     concurrency: Concurrency::default(),
//!     max_queue: chips_bridge::DEFAULT_MAX_QUEUE,
//!     executor: Arc::new(Echo),
//! })?;
//! bridge.open_session(1, "chips.official.editor".to_owned(), Vec::new())?;
//! let output = bridge
//!     .request(BridgeRequest {
//!         request_id: "req-1".to_owned(),
//!         capability_id: "file:read".to_owned(),
//!         session: 1,
//!         input: CapabilityInput::json_only(json!({"path": "readme.md"})),
//!     })
//!     .await?;
//! assert_eq!(output.json["path"], "readme.md");
//! # Ok(())
//! # }
//! #
//! # fn main() {
//! #     let runtime = tokio::runtime::Builder::new_current_thread()
//! #         .enable_time()
//! #         .build()
//! #         .expect("tokio 运行时构建（文档示例）");
//! #     runtime.block_on(run()).expect("Bridge 回声调用（文档示例）");
//! # }
//! ```

#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod bridge;
mod constants;
mod descriptor;
pub mod error_codes;
pub mod naming;
pub mod permissions;
mod schema;

pub use bridge::{Bridge, ProviderKind, ProviderRegistration};
pub use constants::{
    DEFAULT_MAX_QUEUE, DEFAULT_TIMEOUT_MS, MAX_VALIDATION_ISSUES, SCHEMA_CACHE_CAPACITY,
    SESSION_IN_FLIGHT_LIMIT,
};
pub use descriptor::{
    BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor, CapabilityInput,
    CapabilityOutput, CapabilityRegistration, Concurrency, InvocationContext,
};
pub use error_codes::{
    BRIDGE_CANCELLED, BRIDGE_CAPABILITY_CONFLICT, BRIDGE_CAPABILITY_NOT_FOUND, BRIDGE_INTERNAL,
    BRIDGE_INVALID_INPUT, BRIDGE_INVALID_SCHEMA, BRIDGE_PERMISSION_DENIED, BRIDGE_QUEUE_OVERFLOW,
    BRIDGE_SESSION_BUSY, BRIDGE_SESSION_UNKNOWN, BRIDGE_TIMEOUT, KERNEL_INVALID_TRANSITION,
    PERMISSION_INVALID, PERMISSION_NOT_DECLARED, PERMISSION_ROLE_NOT_ALLOWED, PERMISSION_UNKNOWN,
};
