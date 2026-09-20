//! 卡片解析入口 [`CardParser`] 与全量解析结果 [`ParsedCard`]
//! （《06-文档解析器设计》§11.2、《核心接口规范》§6.2）。

use std::path::Path;
use std::sync::Arc;

use crate::cache::ParseCache;
use crate::error::{Diagnostic, DocumentError};
use crate::model::{
    CardMetadata, ContentIndex, DocumentKind, DocumentMetadata, DocumentRevision,
    DocumentStatistics, ParseOptions, StructureModel,
};

use super::DocumentHandle;

/// 严格卡片入口：只接受 `.card`，探测矛盾即 `DOCUMENT_FORMAT_UNKNOWN`。
#[derive(Debug, Clone)]
pub struct CardParser {
    options: ParseOptions,
    cache: Option<Arc<ParseCache>>,
}

impl CardParser {
    /// 以给定选项创建入口（§6.2）。
    #[must_use]
    pub fn new(options: ParseOptions) -> Self {
        Self { options, cache: None }
    }

    /// 挂接单元级 [`ParseCache`]（§5.3 并行与缓存；规范入口签名之外的
    /// 可选扩展，缺省不启用）。
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

    /// 打开并解析到 L0，返回惰性句柄（阶段 1-3）。
    ///
    /// # Errors
    ///
    /// 见 [`DocumentHandle`] 各访问器的致命错误集合（§8.2）。
    pub fn open(&self, path: &Path) -> Result<DocumentHandle, DocumentError> {
        DocumentHandle::open(path, DocumentKind::Card, &self.options, self.cache.clone())
    }

    /// 全量解析（导出、校验、批处理；L0-L2，资源字节不读）。
    ///
    /// 流程即 §11.2 草图：`open` → `metadata` → `structure` →
    /// `parse_all_content` → 修订 / 统计 / 排序去重诊断。
    ///
    /// # Errors
    ///
    /// 打开阶段致命错误，或结构层致命失败（`DOCUMENT_STRUCTURE_INVALID`）
    /// 时上抛；单内容节点失败按 §8.4 以占位模型呈现，不阻断全量解析。
    pub fn parse(&self, path: &Path) -> Result<ParsedCard, DocumentError> {
        let handle = self.open(path)?;
        let metadata = match handle.metadata().as_ref() {
            DocumentMetadata::Card(card) => Arc::new(card.clone()),
            // 严格入口下不可达；矛盾即内部不变量破坏。
            DocumentMetadata::Box(_) => {
                return Err(DocumentError::FormatUnknown {
                    message: "卡片入口解析出箱子元数据".to_owned(),
                })
            }
        };
        let structure = handle.structure()?;
        let content = handle.parse_all_content()?;
        Ok(ParsedCard {
            metadata,
            structure,
            content,
            revision: handle.revision(),
            statistics: handle.statistics(),
            diagnostics: handle.diagnostics(),
        })
    }
}

/// 卡片全量解析结果：模型全部冻结，诊断已排序去重（§11.2）。
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedCard {
    /// L0 元数据（冻结）。
    pub metadata: Arc<CardMetadata>,
    /// L1 结构模型（冻结）。
    pub structure: Arc<StructureModel>,
    /// L2 全量内容索引（结构顺序）。
    pub content: ContentIndex,
    /// 数据源指纹 + 标准版本 + 索引摘要（§3.7）。
    pub revision: DocumentRevision,
    /// 解析统计（§3.7）。
    pub statistics: DocumentStatistics,
    /// 排序去重后的全量诊断（§3.7）。
    pub diagnostics: Vec<Diagnostic>,
}
