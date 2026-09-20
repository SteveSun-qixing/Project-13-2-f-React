//! 卡片元数据模型（《06-文档解析器设计》§11.3、《卡片文件格式》§4）。

use serde::{Deserialize, Serialize};

use crate::model::{FileInfo, Tag};

/// 可见性取值（《卡片文件格式》§4.1 `visibility`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Visibility {
    /// 公开。
    Public,
    /// 私有（默认）。
    Private,
    /// 仅链接可见。
    Unlisted,
}

/// 年龄分级取值（《卡片文件格式》§4.1 `age_rating`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgeRating {
    /// 全年龄。
    All,
    /// 儿童需陪同。
    Pg,
    /// 13 岁以上。
    Pg13,
    /// 限制级。
    R,
    /// 成人级。
    Nc17,
}

/// `.card/metadata.yaml` 的解析结果。
///
/// 必填字段与《核心接口规范》§11.3 一致；可选扩展字段与
/// `packages/sdk/src/types/document.ts` 的 `CardMetadata` 对齐。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CardMetadata {
    /// 薯片标准版本号（严格三段式）。
    pub chip_standards_version: String,
    /// 卡片唯一 ID（10 位 Base62）。
    pub card_id: String,
    /// 卡片名称（最长 500 字符）。
    pub name: String,
    /// 创建时间（ISO 8601 UTC）。
    pub created_at: String,
    /// 最后修改时间（ISO 8601 UTC）。
    pub modified_at: String,
    /// 封面比例（`宽:高`，缺省按 schema 默认值 `3:4` 补齐）。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub cover_ratio: Option<String>,
    /// 标签集合。
    pub tags: Vec<Tag>,
    /// 保留字段（写入时为空字符串，当前不消费）。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub theme: Option<String>,
    /// 可见性。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub visibility: Option<Visibility>,
    /// 是否允许下载。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub downloadable: Option<bool>,
    /// 是否允许二次创作。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub remixable: Option<bool>,
    /// 是否允许评论。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub commentable: Option<bool>,
    /// 许可证类型。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub license: Option<String>,
    /// 年龄分级。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub age_rating: Option<AgeRating>,
    /// 内容警告标签。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub content_warning: Option<Vec<String>>,
    /// 文件信息（系统生成）。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub file_info: Option<FileInfo>,
}
