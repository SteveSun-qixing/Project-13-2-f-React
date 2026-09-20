//! 箱子元数据模型（《06-文档解析器设计》§11.3、《箱子文件格式》§4）。

use serde::Serialize;

use crate::model::{DocumentValue, Tag};

/// `.box/metadata.yaml` 的解析结果。
///
/// 必填字段见《箱子文件格式》§4.2；未在 §4.2、§4.3 定义的字段不得写入
/// 正式文件，因此本类型不保留扩展位（未知字段由 schema 层记诊断）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct BoxMetadata {
    /// 薯片标准版本号（严格三段式）。
    pub chip_standards_version: String,
    /// 箱子唯一 ID（10 位 Base62）。
    pub box_id: String,
    /// 箱子名称。
    pub name: String,
    /// 创建时间（ISO 8601 UTC）。
    pub created_at: String,
    /// 修改时间（ISO 8601 UTC）。
    pub modified_at: String,
    /// 当前生效布局类型（须与 `content.yaml` 一致）。
    pub active_layout_type: String,
    /// 箱子描述。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub description: Option<String>,
    /// 标签集合。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub tags: Option<Vec<Tag>>,
    /// 封面比例（`宽:高`）。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub cover_ratio: Option<String>,
    /// 封面资源路径（必须以 `assets/` 开头）。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub cover_asset: Option<String>,
    /// 逻辑所有者标识。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub owner: Option<String>,
    /// 来源信息（不透明值）。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub source: Option<DocumentValue>,
}
