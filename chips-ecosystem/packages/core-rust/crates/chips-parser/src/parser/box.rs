//! 箱子解析入口 [`BoxParser`] 与全量解析结果 [`ParsedBox`]
//! （《06-文档解析器设计》§11.2「与 CardParser 对称」、《核心接口规范》§6.2）。
//!
//! 文件名 `box.rs` 为规范布局（§11.4）；`box` 是 Rust 保留字，模块名在
//! `parser/mod.rs` 中以 `#[path]` 转写为 `box_parser`。

use std::path::Path;
use std::sync::Arc;

use crate::cache::ParseCache;
use crate::error::{Diagnostic, DocumentError};
use crate::model::{
    BoxMetadata, DocumentKind, DocumentMetadata, DocumentRevision, DocumentStatistics,
    DocumentValue, Entry, ParseOptions, StructureModel,
};

use super::DocumentHandle;

/// 严格箱子入口：只接受 `.box`，探测矛盾即 `DOCUMENT_FORMAT_UNKNOWN`。
#[derive(Debug, Clone)]
pub struct BoxParser {
    options: ParseOptions,
    cache: Option<Arc<ParseCache>>,
}

impl BoxParser {
    /// 以给定选项创建入口（§6.2）。
    #[must_use]
    pub fn new(options: ParseOptions) -> Self {
        Self { options, cache: None }
    }

    /// 挂接单元级 [`ParseCache`]（§5.3；规范入口签名之外的可选扩展，
    /// 缺省不启用）。箱子侧布局配置单元不自带诊断，不入缓存（见
    /// `parser/mod.rs` 模块注释）；当前缓存对箱子入口为待接入状态。
    #[must_use]
    pub fn with_cache(mut self, cache: Arc<ParseCache>) -> Self {
        self.cache = Some(cache);
        self
    }

    /// 本入口的解析选项。
    #[must_use]
    pub fn options(&self) -> &ParseOptions {
        &self.options
    }

    /// 打开并解析到 L0，返回惰性句柄（阶段 1-3；严格 box 入口）。
    ///
    /// # Errors
    ///
    /// 见 [`DocumentHandle`] 各访问器的致命错误集合（§8.2）。
    pub fn open(&self, path: &Path) -> Result<DocumentHandle, DocumentError> {
        DocumentHandle::open(path, DocumentKind::Box, &self.options, self.cache.clone())
    }

    /// 全量解析（L0-L2：结构、条目全集与布局配置单元；资源字节不读）。
    ///
    /// 与 `CardParser::parse` 对称；条目失败按 §8.4 以禁用态保留位置，
    /// 布局配置非法按空映射占位，均不阻断全量解析。
    ///
    /// # Errors
    ///
    /// 打开阶段致命错误，或结构层致命失败（`DOCUMENT_STRUCTURE_INVALID`、
    /// 条目数超限 `DOCUMENT_LIMIT_EXCEEDED`）时上抛。
    pub fn parse(&self, path: &Path) -> Result<ParsedBox, DocumentError> {
        let handle = self.open(path)?;
        let metadata = match handle.metadata().as_ref() {
            DocumentMetadata::Box(card) => Arc::new(card.clone()),
            // 严格入口下不可达；矛盾即内部不变量破坏。
            DocumentMetadata::Card(_) => {
                return Err(DocumentError::FormatUnknown {
                    message: "箱子入口解析出卡片元数据".to_owned(),
                })
            }
        };
        let structure = handle.structure()?;
        let entries = handle.entries(None)?;
        let layout_config = handle.layout_config()?;
        Ok(ParsedBox {
            metadata,
            structure,
            entries,
            layout_config,
            revision: handle.revision(),
            statistics: handle.statistics(),
            diagnostics: handle.diagnostics(),
        })
    }
}

/// 箱子全量解析结果：模型全部冻结，诊断已排序去重（§11.2 对称口径）。
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedBox {
    /// L0 元数据（冻结）。
    pub metadata: Arc<BoxMetadata>,
    /// L1 结构模型（冻结，含条目结构诊断）。
    pub structure: Arc<StructureModel>,
    /// L2 全量条目（声明顺序；失败条目以禁用态保留位置）。
    pub entries: Arc<[Entry]>,
    /// L2 布局配置单元根值（`.box/content.yaml`；不可用时为空映射）。
    pub layout_config: Arc<DocumentValue>,
    /// 数据源指纹 + 标准版本 + 索引摘要（§3.7）。
    pub revision: DocumentRevision,
    /// 解析统计（§3.7）。
    pub statistics: DocumentStatistics,
    /// 排序去重后的全量诊断（§3.7）。
    pub diagnostics: Vec<Diagnostic>,
}
