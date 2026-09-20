//! `chips-parser`：薯片平台文档解析器的 Rust 权威实现。
//!
//! 本 crate 是 `.card` / `.box` 的唯一读取入口，实现《核心接口规范》§6
//! 的公开面与《06-文档解析器设计》的六阶段流水线、双模式数据源、惰性层级
//! （L0 metadata / L1 structure / L2 content+entries / L3 resources）、
//! 两级错误模型与校验体系：
//!
//! - 入口：[`CardParser`] / [`BoxParser`] / [`open_document`]（§6.2）；
//! - 句柄：[`DocumentHandle`]（§6.3，`Send + Sync`，惰性层级共享）；
//! - 选项：[`ParseOptions`] / [`ParseLimits`]（§6.1 与设计稿 §9.1）；
//! - 模型：[`DocumentMetadata`] / [`StructureModel`] / [`ContentNode`] /
//!   [`Entry`] / [`DocumentValue`]（设计稿 §11.3）；
//! - 错误：[`DocumentError`]（致命）与 [`Diagnostic`]（非致命），码表见
//!   设计稿 §8；致命错误经 `From<DocumentError> for ChipsError` 在 Neon
//!   边界归一（《核心接口规范》§3.3）；
//! - 视图：[`build_document_view`]（《核心接口规范》§6.6）。
//!
//! 依赖方向铁律（《核心接口规范》§2.1 规则 5）：本 crate 只依赖
//! `chips-core` 的基础类型，不依赖任何 TS 包，不做跨层直连。
//!
//! # 示例
//!
//! ```
//! use std::path::Path;
//!
//! use chips_core::ChipsError;
//! use chips_parser::{CardParser, DocumentHandle, ParseOptions};
//!
//! /// 打开卡片并把解析错误归一为跨边界错误。
//! pub fn open_card_normalized(path: &Path) -> Result<DocumentHandle, ChipsError> {
//!     CardParser::new(ParseOptions::default())
//!         .open(path)
//!         .map_err(ChipsError::from)
//! }
//!
//! // 目录态最小卡片夹具随集成测试入库；这里只验证入口签名可编译。
//! assert!(open_card_normalized(Path::new("nonexistent.card")).is_err());
//! ```

#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod cache;
pub mod error;
pub mod model;
pub mod parser;
pub mod schema;
pub mod source;
pub mod view;
pub mod yaml;

mod digest;

pub use cache::ParseCache;
pub use error::{Diagnostic, DocumentError, Severity};
pub use model::{
    BoxMetadata, CardMetadata, ContentIndex, ContentNode, DocumentKind, DocumentMetadata,
    DocumentStatistics, DocumentValue, Entry, FileInfo, ParseLimits, ParseOptions,
    SourceFingerprint, StructureModel, Tag, ValidationReport, ValidationStatus,
};
pub use parser::{BoxParser, CardParser, DocumentHandle, CURRENT_CHIP_STANDARDS_VERSION};
pub use source::{ByteStream, DocumentSource, MemberMeta, MemberMethod, PackagePath, SourceKind};
pub use view::{
    build_document_view, BoxCoverView, BoxRenderView, CardNodeView, CardRenderView, CoverView,
    DocumentView, EntryView, TagView,
};

/// 自动识别 `.card` / `.box`；扩展名与探测结果矛盾时以探测结果为准，
/// 并记录 `DOCUMENT_EXTENSION_MISMATCH`（警告）。
///
/// 见《核心接口规范》§6.2 与《06-文档解析器设计》§3.2 第 4 条。
pub fn open_document(
    path: &std::path::Path,
    options: &ParseOptions,
) -> Result<DocumentHandle, DocumentError> {
    parser::open_document(path, options)
}
