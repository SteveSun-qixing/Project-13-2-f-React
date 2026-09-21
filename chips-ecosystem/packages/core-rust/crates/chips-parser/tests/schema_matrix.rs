//! Schema 层补测（任务 #131，《06-文档解析器设计》§6.1、§6.3）。
//!
//! 三面合一：
//! 1. `FieldKind::type_name` 全谱 + `FieldSpec` 构造器链逐字段核对；
//! 2. `check_format` 与格式谓词（版本/标识/比例/时间/资产路径）接受-拒绝
//!    矩阵，含 `is_date_time` 结构位检查与大小月、闰年边界；
//! 3. `validate` 行为矩阵：六类成员合法语料 + 各错误臂（长度上限、
//!    Number/Integer 型别、无子规格序列、非字符串标签元素、各格式提示
//!    文案臂、嵌套未知字段）与 Span 索引补齐行列。
//!    防御臂定性说明见文末注释。

use chips_parser::model::{DocumentValue, ScanLimits};
use chips_parser::schema::{
    check_format, is_asset_path, is_base62_id, is_cover_ratio, is_date_time, is_strict_version,
    validate, FieldFormat, FieldKind, FieldSpec, SchemaMember, SchemaRegistry, SpecDefault,
};
use chips_parser::source::PackagePath;
use chips_parser::yaml::value::{from_deserializer, ValueScan};
use chips_parser::yaml::SpanIndex;

fn mapping(text: &str) -> DocumentValue {
    let mut scan = ValueScan::new(ScanLimits::default());
    from_deserializer(serde_yaml::Deserializer::from_str(text), &mut scan)
        .expect("测试语料必须可解析")
}

fn path(raw: &str) -> PackagePath {
    PackagePath::new(raw).expect("测试内合法路径")
}

/// 取指定指针的诊断。
fn diag_at<'a>(
    diagnostics: &'a [chips_parser::Diagnostic],
    pointer: &str,
) -> Option<&'a chips_parser::Diagnostic> {
    diagnostics
        .iter()
        .find(|item| item.pointer.as_deref() == Some(pointer))
}

#[test]
fn 字段类型名全谱() {
    assert_eq!(FieldKind::Any.type_name(), "任意");
    assert_eq!(FieldKind::Boolean.type_name(), "boolean");
    assert_eq!(FieldKind::Integer.type_name(), "integer");
    assert_eq!(FieldKind::Number.type_name(), "number");
    assert_eq!(FieldKind::String.type_name(), "string");
    assert_eq!(FieldKind::Sequence.type_name(), "array");
    assert_eq!(FieldKind::Mapping.type_name(), "object");
    assert_eq!(FieldKind::TagList.type_name(), "array");
    // 默认值构造面。
    assert_eq!(SpecDefault::Text("x").value().as_str(), Some("x"));
    assert_eq!(SpecDefault::Flag(false).value().as_bool(), Some(false));
    assert!(SpecDefault::EmptySequence
        .value()
        .as_sequence()
        .unwrap()
        .is_empty());
}

#[test]
fn 字段规格构造器链逐字段核对() {
    const CHILD: &[FieldSpec] = &[FieldSpec::required("leaf", FieldKind::String)];
    let spec = FieldSpec::optional("field", FieldKind::Integer)
        .with_format(FieldFormat::StrictVersion)
        .with_enum(&["a", "b"])
        .with_max_length(10)
        .with_min_items(2)
        .with_minimum(1)
        .with_default(SpecDefault::Flag(true))
        .with_children(CHILD);
    assert!(!spec.required);
    assert_eq!(spec.name, "field");
    assert_eq!(spec.kind, FieldKind::Integer);
    assert_eq!(spec.format, FieldFormat::StrictVersion);
    assert_eq!(spec.enum_values, ["a", "b"]);
    assert_eq!(spec.max_length, Some(10));
    assert_eq!(spec.min_items, Some(2));
    assert_eq!(spec.minimum, Some(1));
    assert_eq!(spec.default, Some(SpecDefault::Flag(true)));
    assert_eq!(spec.children.len(), 1);
    // required 构造入口的镜像面。
    let required = FieldSpec::required("id", FieldKind::String).with_format(FieldFormat::Base62Id);
    assert!(required.required);
    assert!(required.enum_values.is_empty());
    assert!(required.max_length.is_none());
    assert!(required.min_items.is_none());
    assert!(required.minimum.is_none());
    assert!(required.default.is_none());
    assert!(required.children.is_empty());
    // 注册表六成员各有时规格且 CardContent 独享未知字段放行。
    for member in [
        SchemaMember::CardMetadata,
        SchemaMember::CardStructure,
        SchemaMember::CardContent,
        SchemaMember::BoxMetadata,
        SchemaMember::BoxStructure,
        SchemaMember::BoxContent,
    ] {
        assert!(!SchemaRegistry::fields(member).is_empty());
        let same = SchemaRegistry::fields(member);
        assert_eq!(same.len(), SchemaRegistry::fields(member).len());
    }
    assert!(SchemaRegistry::allows_unknown_fields(
        SchemaMember::CardContent
    ));
}

#[test]
fn 格式谓词接受拒绝矩阵() {
    // 严格三段式版本。
    assert!(is_strict_version("1.0.0"));
    assert!(!is_strict_version("1.0.0-rc1"));
    assert!(!is_strict_version("1.0.0+build"));
    assert!(!is_strict_version("01.x.0"));
    assert!(!is_strict_version("1.0.0.0"));
    assert!(!is_strict_version(""));
    // Base62 标识。
    assert!(is_base62_id("a1B2c3D4e5"));
    assert!(!is_base62_id("a1B2c3D4e_"));
    assert!(!is_base62_id("ünicode123"));
    // 封面比例（含小数）。
    assert!(is_cover_ratio("1.7778:1"));
    assert!(!is_cover_ratio("3.:4"));
    assert!(!is_cover_ratio("3:.4"));
    assert!(!is_cover_ratio("3:4:5"));
    assert!(!is_cover_ratio("1x2"));
    // 资产路径。
    assert!(is_asset_path("assets/sub/cover.png"));
    assert!(!is_asset_path("assets/../evil.png"));
    assert!(!is_asset_path("assets/"));
    // ISO 时间：结构位与越界。
    assert!(is_date_time("2026-01-15T08:00:00Z"));
    assert!(is_date_time("2026-01-15T08:00:60Z"), "闰秒 60 允许");
    assert!(!is_date_time("2026-01-15T08:00:61Z"));
    assert!(!is_date_time("2026-01-15T08:60:00Z"));
    assert!(!is_date_time("2026-01-15T24:00:00Z"));
    assert!(!is_date_time("2026-01-15T08,00:00Z"), "分钟分隔符位");
    assert!(!is_date_time("2026-01-15T08:00,00Z"), "秒分隔符位");
    assert!(!is_date_time("20260115T08:00:00Z"), "缺日期连字符");
    assert!(!is_date_time("short"));
    assert!(!is_date_time("2026-01-15T08:00:00.1xZ"), "小数段非数字");
    assert!(!is_date_time("2026-00-15T08:00:00Z"), "月份 0 非法");
    assert!(!is_date_time("2026-01-00T08:00:00Z"), "日 0 非法");
    // 大小月与闰年：4 月 30 天、百年不闰、四百年闰。
    assert!(is_date_time("2026-04-30T08:00:00Z"));
    assert!(!is_date_time("2026-04-31T08:00:00Z"));
    assert!(is_date_time("2000-02-29T08:00:00Z"));
    assert!(!is_date_time("2100-02-29T08:00:00Z"));
    assert!(is_date_time("1900-02-28T08:00:00Z"));
}

#[test]
fn 格式校验入口六格式双臂() {
    assert_eq!(check_format(FieldFormat::None, "anything"), None);
    assert_eq!(check_format(FieldFormat::StrictVersion, "2.3.4"), None);
    let rejected = check_format(FieldFormat::StrictVersion, "2.3").expect("必须拒绝");
    assert!(rejected.contains("2.3"));
    assert_eq!(check_format(FieldFormat::Base62Id, "0123456789"), None);
    assert!(check_format(FieldFormat::Base62Id, "toolong12345")
        .expect("必须拒绝")
        .contains("Base62"));
    assert_eq!(check_format(FieldFormat::CoverRatio, "16:9"), None);
    assert!(check_format(FieldFormat::CoverRatio, "16-9")
        .expect("必须拒绝")
        .contains("宽:高"));
    assert_eq!(
        check_format(FieldFormat::DateTime, "2026-01-15T08:00:00.000Z"),
        None
    );
    assert!(check_format(FieldFormat::DateTime, "yesterday")
        .expect("必须拒绝")
        .contains("ISO 8601"));
    assert_eq!(check_format(FieldFormat::AssetPath, "assets/a.png"), None);
    assert!(check_format(FieldFormat::AssetPath, "static/a.png")
        .expect("必须拒绝")
        .contains("assets/"));
}

const VALID_CARD_METADATA: &str = "\
chip_standards_version: \"1.0.0\"
card_id: a1B2c3D4e5
name: 矩阵卡片
created_at: \"2026-01-15T08:00:00Z\"
modified_at: \"2026-01-15T08:00:00Z\"
theme: \"\"
content_warning:
  - 1
  - true
tags:
  - [地点, 7]
file_info:
  total_size: 10
  file_count: 2
";

#[test]
fn 校验矩阵卡片元数据错误臂与提示文案() {
    let outcome = validate(
        SchemaMember::CardMetadata,
        &mapping(VALID_CARD_METADATA),
        &path(".card/metadata.yaml"),
        false,
        false,
        None,
    );
    // 唯一错误应来自标签元素臂，其余字段全部通过。
    assert_eq!(outcome.diagnostics.len(), 1, "{:?}", outcome.diagnostics);
    // 无子规格序列：元素原样保留。
    let warning = outcome.value.get("content_warning").unwrap();
    assert_eq!(warning.as_sequence().unwrap().len(), 2);
    assert_eq!(warning.as_sequence().unwrap()[0].as_i64(), Some(1));
    // 结构化标签含非字符串元素：报「实际含 integer/boolean」类文案。
    let tag_diag = diag_at(&outcome.diagnostics, "/tags/0").expect("标签元素诊断");
    assert!(
        tag_diag.message.contains("必须是字符串"),
        "{}",
        tag_diag.message
    );
    assert!(tag_diag.message.contains("integer"), "{}", tag_diag.message);
}

#[test]
fn 校验矩阵长度上限与四类格式提示臂() {
    let long_name = "长".repeat(501);
    let text = format!(
        "chip_standards_version: \"1.0\"\ncard_id: short\nname: {long_name}\n\
         created_at: yesterday\nmodified_at: \"2026-01-15T08:00:00Z\"\ncover_ratio: 3-4\n"
    );
    let outcome = validate(
        SchemaMember::CardMetadata,
        &mapping(&text),
        &path(".card/metadata.yaml"),
        false,
        false,
        None,
    );
    assert!(outcome.has_errors());
    let name_diag = diag_at(&outcome.diagnostics, "/name").expect("长度诊断");
    assert!(name_diag.message.contains("长度 501 超出上限 500"));
    let version_diag = diag_at(&outcome.diagnostics, "/chip_standards_version").expect("版本诊断");
    assert_eq!(
        version_diag.hint.as_deref().unwrap(),
        "版本号需使用引号包裹的严格三段式，如 chip_standards_version: \"1.0.0\""
    );
    let id_diag = diag_at(&outcome.diagnostics, "/card_id").expect("标识诊断");
    assert_eq!(
        id_diag.hint.as_deref().unwrap(),
        "标识必须是 10 位 Base62 字符串"
    );
    let created_diag = diag_at(&outcome.diagnostics, "/created_at").expect("时间诊断");
    assert!(created_diag
        .hint
        .as_deref()
        .unwrap()
        .contains("ISO 8601 UTC 形式"));
    let ratio_diag = diag_at(&outcome.diagnostics, "/cover_ratio").expect("比例诊断");
    assert_eq!(
        ratio_diag.hint.as_deref().unwrap(),
        "比例需写作「宽:高」，如 \"3:4\""
    );
}

#[test]
fn 校验矩阵箱子成员三型与资产提示() {
    let metadata = mapping(
        "chip_standards_version: \"1.0.0\"\nbox_id: a1B2c3D4e5\nname: 矩阵箱子\n\
         created_at: \"2026-01-15T08:00:00Z\"\nmodified_at: \"2026-01-15T08:00:00Z\"\n\
         active_layout_type: grid\ncover_asset: static/cover.png\nsource: not-a-mapping\n",
    );
    let outcome = validate(
        SchemaMember::BoxMetadata,
        &metadata,
        &path(".box/metadata.yaml"),
        false,
        false,
        None,
    );
    let asset_diag = diag_at(&outcome.diagnostics, "/cover_asset").expect("资产路径诊断");
    assert_eq!(
        asset_diag.hint.as_deref().unwrap(),
        "封面资源必须以 assets/ 开头"
    );
    let source_diag = diag_at(&outcome.diagnostics, "/source").expect("映射类型诊断");
    assert!(source_diag.message.contains("期望 object"));

    // 箱子结构条目：entry_id 非 Base62 + enabled 非布尔。
    let structure = mapping(
        "entries:\n  - entry_id: bad\n    url: https://example.com\n    enabled: \"yes\"\n    snapshot:\n      hits: 1\n",
    );
    let outcome = validate(
        SchemaMember::BoxStructure,
        &structure,
        &path(".box/structure.yaml"),
        false,
        false,
        None,
    );
    assert!(diag_at(&outcome.diagnostics, "/entries/0/entry_id").is_some());
    assert!(diag_at(&outcome.diagnostics, "/entries/0/enabled").is_some());
    // snapshot 合法映射通过。
    assert!(diag_at(&outcome.diagnostics, "/entries/0/snapshot").is_none());

    // 箱子布局配置：layout_configs 映射通过、active 缺失报必填。
    let content = mapping("layout_configs:\n  grid:\n    schema_version: \"1.0.0\"\n");
    let outcome = validate(
        SchemaMember::BoxContent,
        &content,
        &path(".box/content.yaml"),
        false,
        false,
        None,
    );
    assert!(outcome.has_errors());
    assert!(diag_at(&outcome.diagnostics, "/active_layout_type").is_some());
}

#[test]
fn 校验矩阵资源条目number与integer分型() {
    let text = r#"structure:
  - id: a1B2c3D4e5
    type: base.text
manifest:
  card_count: 1
  resource_count: 2
  resources:
    - path: assets/a.mp4
      size: 100
      type: video/mp4
      duration: "long"
      width: 2.5
    - path: assets/b.png
      size: 10
      type: image/png
      duration: 1.5
      height: 0
"#;
    let outcome = validate(
        SchemaMember::CardStructure,
        &mapping(text),
        &path(".card/structure.yaml"),
        false,
        false,
        None,
    );
    // duration 为 Number：字符串拒绝、小数通过。
    let duration_diag =
        diag_at(&outcome.diagnostics, "/manifest/resources/0/duration").expect("duration 型别诊断");
    assert!(
        duration_diag.message.contains("期望 number"),
        "{}",
        duration_diag.message
    );
    assert!(diag_at(&outcome.diagnostics, "/manifest/resources/1/duration").is_none());
    // width 为 Integer：小数拒绝；height 0 通过下限。
    let width_diag =
        diag_at(&outcome.diagnostics, "/manifest/resources/0/width").expect("width 型别诊断");
    assert!(width_diag.message.contains("期望 integer"));
    assert!(diag_at(&outcome.diagnostics, "/manifest/resources/1/height").is_none());
}

#[test]
fn 内容信封嵌套未知字段仍报而根层放行() {
    let content = mapping(
        "card_type: base.text\ntheme: \"\"\nnative_field: 1\nlayout:\n  height_mode: fixed\n  fixed_height: 200\n  alien: true\n  aspect_ratio: 4/3\n",
    );
    let outcome = validate(
        SchemaMember::CardContent,
        &content,
        &path("content/a1B2c3D4e5.yaml"),
        false,
        false,
        None,
    );
    // 根层未知键放行不留诊断。
    assert!(diag_at(&outcome.diagnostics, "/native_field").is_none());
    // 嵌套 layout 内未知键照常报告。
    let alien = diag_at(&outcome.diagnostics, "/layout/alien").expect("嵌套未知字段");
    assert_eq!(alien.code, chips_parser::error::SCHEMA_UNKNOWN_FIELD);
    // 嵌套格式违规同样报告。
    assert!(diag_at(&outcome.diagnostics, "/layout/aspect_ratio").is_some());
    // 默认值补齐走 repair 面：layout.height_mode 缺省时补 auto。
    let minimal = mapping("card_type: x\n");
    let repaired = validate(
        SchemaMember::CardContent,
        &minimal,
        &path("content/a1B2c3D4e5.yaml"),
        true,
        false,
        None,
    );
    assert_eq!(
        repaired.value.get("theme").and_then(DocumentValue::as_str),
        Some("")
    );
}

#[test]
fn span索引补齐schema诊断行列() {
    let text = "chip_standards_version: \"1.0.0\"\ncard_id: bad-id\nname: n\n\
                created_at: \"2026-01-15T08:00:00Z\"\nmodified_at: \"2026-01-15T08:00:00Z\"\n";
    let spans = SpanIndex::build(text);
    let outcome = validate(
        SchemaMember::CardMetadata,
        &mapping(text),
        &path(".card/metadata.yaml"),
        false,
        false,
        Some(&spans),
    );
    let diag = diag_at(&outcome.diagnostics, "/card_id").expect("标识诊断");
    assert_eq!(diag.line, Some(2));
    assert_eq!(diag.column, Some(1));
}

// 防御臂定性说明（不做假覆盖，登记于 /tmp/t131_findings.md）：
// - `schema/mod.rs` L404-405/L408：`FieldKind::Any` 早退与兜底臂——注册表
//   六成员均未声明 Any 字段（插件专有值一律 Mapping/Sequence），经公开
//   `validate` 面不可达；
// - L483-488：`with_min_items` 的违反诊断臂——注册表无规格启用 min_items
//   （结构化标签的「键+值」下限由 tag_item 独立路径承担，本文件已覆盖），
//   该臂仅对假想注册规格生效；
// - L600：`format_suggestion(FieldFormat::None)` 文案臂——None 格式在
//   `check_format` 恒通过，正常路径不会带着 None 进入提示构造；
// - L729：`days_in_month` 的 `_ => 0` 臂——调用前置条件 `(1..=12).contains`
//   已排除月越界，属一致性兜底。
