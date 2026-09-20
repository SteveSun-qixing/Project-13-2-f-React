//! 箱子文档级 schema（《箱子文件格式》§4、§5、§6；《06-文档解析器设计》§6.3）。
//!
//! 字段规格逐条对照《箱子文件格式》各节原文编译期内嵌：`metadata.yaml`
//! （§4.2、§4.3）、`structure.yaml` 条目（§5）、`content.yaml` 布局配置
//! （§6.3、§6.4）。`snapshot`、`layout_hints` 与 `layout_configs` 的
//! 内部结构属摘要/插件专有信息（§5.4、§5.6、§6.4），schema 层只做映射
//! 类型约束、不逐项收窄；语义细化由流水线引用校验承担（§3.5）。

use super::{FieldFormat, FieldKind, FieldSpec, SpecDefault};

/// `.box/metadata.yaml` 字段规格（《箱子文件格式》§4.2、§4.3）。
pub const METADATA_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("chip_standards_version", FieldKind::String)
        .with_format(FieldFormat::StrictVersion),
    FieldSpec::required("box_id", FieldKind::String).with_format(FieldFormat::Base62Id),
    FieldSpec::required("name", FieldKind::String).with_max_length(500),
    FieldSpec::required("created_at", FieldKind::String).with_format(FieldFormat::DateTime),
    FieldSpec::required("modified_at", FieldKind::String).with_format(FieldFormat::DateTime),
    FieldSpec::required("active_layout_type", FieldKind::String),
    FieldSpec::optional("description", FieldKind::String),
    FieldSpec::optional("tags", FieldKind::TagList).with_default(SpecDefault::EmptySequence),
    FieldSpec::optional("cover_ratio", FieldKind::String).with_format(FieldFormat::CoverRatio),
    FieldSpec::optional("cover_asset", FieldKind::String).with_format(FieldFormat::AssetPath),
    FieldSpec::optional("owner", FieldKind::String),
    FieldSpec::optional("source", FieldKind::Mapping),
];

/// `.box/structure.yaml` 字段规格（《箱子文件格式》§5.2、§5.3、§5.7）。
pub const STRUCTURE_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("entries", FieldKind::Sequence).with_children(&ENTRY_ITEM_FIELDS),
];

/// `entries[]` 条目字段：`entry_id`、`url`、`enabled` 必填（§5.7 第 5 条），
/// `snapshot`/`layout_hints` 为可选摘要与布局索引（§5.4、§5.6），内部
/// 结构不逐项收窄。
const ENTRY_ITEM_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("entry_id", FieldKind::String).with_format(FieldFormat::Base62Id),
    FieldSpec::required("url", FieldKind::String),
    FieldSpec::required("enabled", FieldKind::Boolean),
    FieldSpec::optional("snapshot", FieldKind::Mapping),
    FieldSpec::optional("layout_hints", FieldKind::Mapping),
];

/// `.box/content.yaml` 布局配置字段规格（《箱子文件格式》§6.3、§6.4）。
///
/// `layout_configs` 的键为任意布局类型标识，配置项内部（`schema_version`
/// / `props` / `asset_refs`）由布局插件与平台兼容门禁处理（§6.4 说明），
/// schema 层只约束顶层两字段的类型。
pub const CONTENT_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("active_layout_type", FieldKind::String),
    FieldSpec::optional("layout_configs", FieldKind::Mapping),
];

#[cfg(test)]
mod tests {
    use super::*;

    /// 按名称取字段规格。
    fn find<'a>(fields: &'a [FieldSpec], name: &str) -> &'a FieldSpec {
        fields
            .iter()
            .find(|spec| spec.name == name)
            .unwrap_or_else(|| panic!("缺少字段规格 {name}"))
    }

    #[test]
    fn test_metadata_required_fields_match_spec() {
        let required: Vec<&str> = METADATA_FIELDS
            .iter()
            .filter(|spec| spec.required)
            .map(|spec| spec.name)
            .collect();
        assert_eq!(
            required,
            vec![
                "chip_standards_version",
                "box_id",
                "name",
                "created_at",
                "modified_at",
                "active_layout_type"
            ],
            "必填集合必须与《箱子文件格式》§4.2 必需字段表逐字一致"
        );
    }

    #[test]
    fn test_metadata_optional_fields() {
        assert_eq!(find(METADATA_FIELDS, "cover_asset").format, FieldFormat::AssetPath);
        assert_eq!(find(METADATA_FIELDS, "cover_ratio").format, FieldFormat::CoverRatio);
        assert_eq!(find(METADATA_FIELDS, "tags").kind, FieldKind::TagList);
        assert!(!find(METADATA_FIELDS, "source").required);
        assert_eq!(find(METADATA_FIELDS, "source").kind, FieldKind::Mapping);
        assert!(find(METADATA_FIELDS, "source").children.is_empty());
    }

    #[test]
    fn test_structure_entry_required_trio() {
        let entries = find(STRUCTURE_FIELDS, "entries");
        assert!(entries.required);
        assert_eq!(entries.kind, FieldKind::Sequence);
        assert!(find(entries.children, "entry_id").required);
        assert_eq!(find(entries.children, "entry_id").format, FieldFormat::Base62Id);
        assert!(find(entries.children, "url").required);
        assert!(find(entries.children, "enabled").required);
        assert_eq!(find(entries.children, "enabled").kind, FieldKind::Boolean);
        assert!(!find(entries.children, "snapshot").required);
        assert!(!find(entries.children, "layout_hints").required);
    }

    #[test]
    fn test_content_fields() {
        assert!(find(CONTENT_FIELDS, "active_layout_type").required);
        let configs = find(CONTENT_FIELDS, "layout_configs");
        assert!(!configs.required);
        assert_eq!(configs.kind, FieldKind::Mapping);
        assert!(configs.children.is_empty(), "布局配置键为任意布局类型，不逐项收窄");
    }
}
