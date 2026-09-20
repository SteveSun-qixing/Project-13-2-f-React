//! 卡片文档级 schema（《卡片文件格式》§4.1、§5.1、§6.1；《06-文档解析器设计》§6.3）。
//!
//! 字段规格逐条对照《卡片文件格式》各节 JSON Schema 原文编译期内嵌：
//! `metadata.yaml`（§4）、`structure.yaml`（§5）、`content/*.yaml` 通用
//! 信封（§6.1）。内容文件的插件专有字段不进入本表（§6.3 第 3 条），由
//! [`super::SchemaRegistry::allows_unknown_fields`] 在根层放行并原样保留。

use super::{FieldFormat, FieldKind, FieldSpec, SpecDefault};

/// `.card/metadata.yaml` 字段规格（《卡片文件格式》§4.1）。
pub const METADATA_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("chip_standards_version", FieldKind::String)
        .with_format(FieldFormat::StrictVersion),
    FieldSpec::required("card_id", FieldKind::String).with_format(FieldFormat::Base62Id),
    FieldSpec::required("name", FieldKind::String).with_max_length(500),
    FieldSpec::required("created_at", FieldKind::String).with_format(FieldFormat::DateTime),
    FieldSpec::required("modified_at", FieldKind::String).with_format(FieldFormat::DateTime),
    FieldSpec::optional("theme", FieldKind::String).with_default(SpecDefault::Text("")),
    FieldSpec::optional("cover_ratio", FieldKind::String)
        .with_format(FieldFormat::CoverRatio)
        .with_default(SpecDefault::Text("3:4")),
    FieldSpec::optional("tags", FieldKind::TagList).with_default(SpecDefault::EmptySequence),
    FieldSpec::optional("visibility", FieldKind::String)
        .with_enum(&["public", "private", "unlisted"])
        .with_default(SpecDefault::Text("private")),
    FieldSpec::optional("downloadable", FieldKind::Boolean).with_default(SpecDefault::Flag(true)),
    FieldSpec::optional("remixable", FieldKind::Boolean).with_default(SpecDefault::Flag(true)),
    FieldSpec::optional("commentable", FieldKind::Boolean).with_default(SpecDefault::Flag(true)),
    FieldSpec::optional("license", FieldKind::String),
    FieldSpec::optional("age_rating", FieldKind::String)
        .with_enum(&["all", "pg", "pg13", "r", "nc17"]),
    FieldSpec::optional("content_warning", FieldKind::Sequence),
    FieldSpec::optional("file_info", FieldKind::Mapping).with_children(FILE_INFO_FIELDS),
];

/// `metadata.file_info` 内部字段（§4.1；模型侧 `total_size`/`file_count`
/// 为 `u64`，故取非负整数下限）。
const FILE_INFO_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("total_size", FieldKind::Integer).with_minimum(0),
    FieldSpec::required("file_count", FieldKind::Integer).with_minimum(0),
    FieldSpec::optional("checksum", FieldKind::String),
    FieldSpec::optional("generated_at", FieldKind::String).with_format(FieldFormat::DateTime),
];

/// `.card/structure.yaml` 字段规格（《卡片文件格式》§5.1）。
pub const STRUCTURE_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("structure", FieldKind::Sequence).with_children(STRUCTURE_ITEM_FIELDS),
    FieldSpec::required("manifest", FieldKind::Mapping).with_children(MANIFEST_FIELDS),
];

/// `structure[]` 条目字段（§5.1、§5.3：`id` 为 10 位 Base62，`type` 为
/// 基础卡片正式类型标识；历史别名归一属语义层，不在 schema 枚举内收窄）。
const STRUCTURE_ITEM_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("id", FieldKind::String).with_format(FieldFormat::Base62Id),
    FieldSpec::required("type", FieldKind::String),
];

/// `manifest` 字段（§5.1）。
const MANIFEST_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("card_count", FieldKind::Integer).with_minimum(0),
    FieldSpec::required("resource_count", FieldKind::Integer).with_minimum(0),
    FieldSpec::optional("resources", FieldKind::Sequence).with_children(RESOURCE_ITEM_FIELDS),
];

/// `manifest.resources[]` 条目字段（§5.1、§5.3）。
const RESOURCE_ITEM_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("path", FieldKind::String),
    FieldSpec::required("size", FieldKind::Integer).with_minimum(0),
    FieldSpec::required("type", FieldKind::String),
    FieldSpec::optional("duration", FieldKind::Number).with_minimum(0),
    FieldSpec::optional("width", FieldKind::Integer).with_minimum(0),
    FieldSpec::optional("height", FieldKind::Integer).with_minimum(0),
    FieldSpec::optional("language", FieldKind::String),
    FieldSpec::optional("checksum", FieldKind::String),
];

/// `content/<id>.yaml` 通用信封字段（《卡片文件格式》§6.1）。
///
/// 仅校验信封结构（`card_type` 必填字符串、`theme` 与 `layout` 通用可选）；
/// 类型专有字段由插件在渲染层校验，根层未知键放行（§6.3 第 3 条）。
pub const CONTENT_FIELDS: &[FieldSpec] = &[
    FieldSpec::required("card_type", FieldKind::String),
    FieldSpec::optional("theme", FieldKind::String).with_default(SpecDefault::Text("")),
    FieldSpec::optional("layout", FieldKind::Mapping).with_children(LAYOUT_FIELDS),
];

/// `layout` 通用布局参数字段（§6.1）。
const LAYOUT_FIELDS: &[FieldSpec] = &[
    FieldSpec::optional("height_mode", FieldKind::String)
        .with_enum(&["auto", "fixed"])
        .with_default(SpecDefault::Text("auto")),
    FieldSpec::optional("fixed_height", FieldKind::Integer).with_minimum(1),
    FieldSpec::optional("aspect_ratio", FieldKind::String).with_format(FieldFormat::CoverRatio),
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
                "card_id",
                "name",
                "created_at",
                "modified_at"
            ],
            "必填集合必须与《卡片文件格式》§4.1 required 列表逐字一致"
        );
    }

    #[test]
    fn test_metadata_formats_enums_and_defaults() {
        assert_eq!(
            find(METADATA_FIELDS, "chip_standards_version").format,
            FieldFormat::StrictVersion
        );
        assert_eq!(
            find(METADATA_FIELDS, "card_id").format,
            FieldFormat::Base62Id
        );
        assert_eq!(find(METADATA_FIELDS, "name").max_length, Some(500));
        assert_eq!(
            find(METADATA_FIELDS, "created_at").format,
            FieldFormat::DateTime
        );
        assert_eq!(
            find(METADATA_FIELDS, "cover_ratio").format,
            FieldFormat::CoverRatio
        );
        assert_eq!(
            find(METADATA_FIELDS, "cover_ratio").default,
            Some(SpecDefault::Text("3:4"))
        );
        assert_eq!(
            find(METADATA_FIELDS, "visibility").default,
            Some(SpecDefault::Text("private"))
        );
        assert_eq!(
            find(METADATA_FIELDS, "visibility").enum_values,
            ["public", "private", "unlisted"]
        );
        assert_eq!(
            find(METADATA_FIELDS, "age_rating").enum_values,
            ["all", "pg", "pg13", "r", "nc17"]
        );
        assert_eq!(
            find(METADATA_FIELDS, "downloadable").default,
            Some(SpecDefault::Flag(true))
        );
        assert_eq!(find(METADATA_FIELDS, "tags").kind, FieldKind::TagList);
        assert_eq!(
            find(METADATA_FIELDS, "tags").default,
            Some(SpecDefault::EmptySequence)
        );
    }

    #[test]
    fn test_file_info_children() {
        let file_info = find(METADATA_FIELDS, "file_info");
        assert!(!file_info.required);
        assert_eq!(file_info.kind, FieldKind::Mapping);
        assert_eq!(find(file_info.children, "total_size").minimum, Some(0));
        assert_eq!(find(file_info.children, "file_count").minimum, Some(0));
        assert!(find(file_info.children, "total_size").required);
        assert!(find(file_info.children, "file_count").required);
        assert!(!find(file_info.children, "checksum").required);
        assert_eq!(
            find(file_info.children, "generated_at").format,
            FieldFormat::DateTime
        );
    }

    #[test]
    fn test_structure_children_and_manifest() {
        let structure = find(STRUCTURE_FIELDS, "structure");
        assert!(structure.required);
        assert_eq!(find(structure.children, "id").format, FieldFormat::Base62Id);
        assert!(find(structure.children, "type").required);
        let manifest = find(STRUCTURE_FIELDS, "manifest");
        assert!(find(manifest.children, "card_count").required);
        assert!(find(manifest.children, "resource_count").required);
        let resources = find(manifest.children, "resources");
        assert!(!resources.required);
        assert!(find(resources.children, "path").required);
        assert!(find(resources.children, "size").required);
        assert_eq!(find(resources.children, "size").minimum, Some(0));
        assert!(!find(resources.children, "duration").required);
    }

    #[test]
    fn test_content_envelope() {
        assert!(find(CONTENT_FIELDS, "card_type").required);
        assert_eq!(
            find(CONTENT_FIELDS, "theme").default,
            Some(SpecDefault::Text(""))
        );
        let layout = find(CONTENT_FIELDS, "layout");
        let height_mode = find(layout.children, "height_mode");
        assert_eq!(height_mode.enum_values, ["auto", "fixed"]);
        assert_eq!(height_mode.default, Some(SpecDefault::Text("auto")));
        assert_eq!(
            find(layout.children, "aspect_ratio").format,
            FieldFormat::CoverRatio
        );
    }
}
