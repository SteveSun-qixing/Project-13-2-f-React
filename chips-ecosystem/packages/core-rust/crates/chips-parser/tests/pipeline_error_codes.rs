//! 流水线行为级测试：§8 错误码逐码覆盖与 `DocumentHandle` 访问器面
//! （《06-文档解析器设计》§8、§5.2；《核心接口规范》§6）。
//!
//! 夹具一律使用目录态（§4.2）在临时目录构建；每个测试独占一棵小树，
//! 结束时清理。致命错误经 `DocumentError::code()` 断言，非致命诊断经
//! `Diagnostic::code` 断言，码值取自 `chips_parser::error` 公开码表。

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use chips_parser::error::{
    Diagnostic, Severity, DOCUMENT_EXTENSION_MISMATCH, DOCUMENT_FORMAT_UNKNOWN, DOCUMENT_IO,
    DOCUMENT_METADATA_INVALID, DOCUMENT_METADATA_MISSING, DOCUMENT_NOT_FOUND,
    DOCUMENT_RESOURCE_FILE_MISSING, DOCUMENT_RESOURCE_INTEGRITY_MISMATCH,
    DOCUMENT_UNICODE_NORMALIZED, DOCUMENT_UNREFERENCED_FILE, DOCUMENT_VERSION_MISMATCH,
    DOCUMENT_VERSION_OUTDATED, DOCUMENT_VERSION_UNSUPPORTED, ENTRY_FAILED, ENTRY_SOURCE_INVALID,
    ENTRY_TARGET_MISSING, SCHEMA_DEFAULT_APPLIED, SCHEMA_REQUIRED_MISSING, SCHEMA_TYPE_MISMATCH,
    SCHEMA_UNKNOWN_FIELD, STRUCTURE_CONTENT_MISSING, STRUCTURE_NODE_FAILED, YAML_SYNTAX_ERROR,
    YAML_UNSUPPORTED_TAG,
};
use chips_parser::model::{DocumentKind, DocumentValue, NodeId, ParseOptions, StructureModel};
use chips_parser::source::PackagePath;
use chips_parser::{open_document, BoxParser, CardParser};

/// 10 位 Base62 测试节点标识。
const NODE: &str = "a1B2c3D4e5";

/// 在临时目录开辟一棵独立小树；返回根路径。
fn temp_root(tag: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!(
        "chips-parser-r54-{tag}-{}-{:?}",
        std::process::id(),
        std::thread::current().id()
    ));
    let _ = fs::remove_dir_all(&base);
    fs::create_dir_all(&base).expect("创建夹具根目录");
    base
}

/// 写入成员（自动创建父目录）。
fn write(root: impl AsRef<Path>, relative: &str, bytes: &[u8]) {
    let target = root.as_ref().join(relative);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).expect("创建成员父目录");
    }
    fs::write(target, bytes).expect("写入成员");
}

/// 合法卡片 metadata.yaml（可指定标准版本与额外行）。
fn card_metadata(version: &str, extra: &str) -> String {
    format!(
        "chip_standards_version: \"{version}\"\n\
         card_id: {NODE}\n\
         name: 测试卡片\n\
         created_at: \"2024-01-01T00:00:00Z\"\n\
         modified_at: \"2024-01-02T00:00:00Z\"\n\
         {extra}"
    )
}

/// 最小合法卡片夹具：metadata + structure（单节点）+ 内容文件。
fn write_minimal_card(root: &Path, version: &str, metadata_extra: &str) {
    write(
        root,
        ".card/metadata.yaml",
        card_metadata(version, metadata_extra).as_bytes(),
    );
    write(
        root,
        ".card/structure.yaml",
        b"structure:\n  - id: a1B2c3D4e5\n    type: base.text\nmanifest:\n  card_count: 1\n  resource_count: 0\n",
    );
    write(
        root,
        "content/a1B2c3D4e5.yaml",
        "card_type: base.text\ntext: 你好\n".as_bytes(),
    );
}

/// 最小合法箱子夹具：metadata + structure（单条目）+ 布局配置。
fn write_minimal_box(root: &Path, version: &str) {
    write(
        root,
        ".box/metadata.yaml",
        format!(
            "chip_standards_version: \"{version}\"\n\
             box_id: z9Y8x7W6v5\n\
             name: 测试箱子\n\
             created_at: \"2024-01-01T00:00:00Z\"\n\
             modified_at: \"2024-01-02T00:00:00Z\"\n\
             active_layout_type: grid\n"
        )
        .as_bytes(),
    );
    write(
        root,
        ".box/structure.yaml",
        b"entries:\n  - entry_id: a1B2c3D4e5\n    url: https://example.com/page-a\n    enabled: true\n",
    );
    write(
        root,
        ".box/content.yaml",
        b"active_layout_type: grid\nlayout_configs:\n  grid:\n    schema_version: \"1.0.0\"\n",
    );
}

/// 诊断集合中是否存在指定码。
fn has_code(diagnostics: &[Diagnostic], code: &str) -> bool {
    diagnostics.iter().any(|item| item.code == code)
}

// ---------------------------------------------------------------------------
// §8.2 致命错误码 · 行为触发
// ---------------------------------------------------------------------------

#[test]
fn test_document_metadata_missing() {
    // 目录以 .card 命名且仅含 structure.yaml：探测靠扩展名成立，
    // 元数据成员缺失归一为 DOCUMENT_METADATA_MISSING。
    let base = temp_root("metadata-missing");
    let root = base.join("doc.card");
    write(
        &root,
        ".card/structure.yaml",
        b"structure: []\nmanifest:\n  card_count: 0\n  resource_count: 0\n",
    );
    let error = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect_err("缺元数据必须致命");
    assert_eq!(error.code(), DOCUMENT_METADATA_MISSING);
    fs::remove_dir_all(base).expect("清理");
}

#[test]
fn test_document_metadata_invalid_carries_required_missing() {
    let root = temp_root("metadata-invalid");
    write(
        &root,
        ".card/metadata.yaml",
        b"chip_standards_version: \"1.0.0\"\n",
    );
    let error = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect_err("缺必填字段必须致命");
    assert_eq!(error.code(), DOCUMENT_METADATA_INVALID);
    assert!(has_code(error.diagnostics(), SCHEMA_REQUIRED_MISSING));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_document_metadata_invalid_carries_type_mismatch() {
    let root = temp_root("metadata-type");
    write(
        &root,
        ".card/metadata.yaml",
        b"chip_standards_version: \"1.0.0\"\n\
         card_id: a1B2c3D4e5\n\
         name: 123\n\
         created_at: \"2024-01-01T00:00:00Z\"\n\
         modified_at: \"2024-01-02T00:00:00Z\"\n",
    );
    let error = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect_err("字段类型不符必须致命");
    assert_eq!(error.code(), DOCUMENT_METADATA_INVALID);
    assert!(has_code(error.diagnostics(), SCHEMA_TYPE_MISMATCH));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_document_version_outdated_and_unsupported() {
    let outdated_root = temp_root("version-outdated");
    write_minimal_card(&outdated_root, "0.9.0", "");
    let error = CardParser::new(ParseOptions::default())
        .open(&outdated_root)
        .expect_err("主版本过旧必须致命");
    assert_eq!(error.code(), DOCUMENT_VERSION_OUTDATED);
    fs::remove_dir_all(outdated_root).expect("清理");

    let unsupported_root = temp_root("version-unsupported");
    write_minimal_card(&unsupported_root, "2.0.0", "");
    let error = CardParser::new(ParseOptions::default())
        .open(&unsupported_root)
        .expect_err("主版本过新必须致命");
    assert_eq!(error.code(), DOCUMENT_VERSION_UNSUPPORTED);
    fs::remove_dir_all(unsupported_root).expect("清理");
}

#[test]
fn test_document_format_unknown_for_plain_file_and_entry_mismatch() {
    let plain = temp_root("format-unknown-plain");
    let plain_file = plain.join("plain.txt");
    fs::write(&plain_file, "不是目录也不是 ZIP").expect("写入普通文件");
    let error =
        open_document(&plain_file, &ParseOptions::default()).expect_err("普通文件必须判格式未知");
    assert_eq!(error.code(), DOCUMENT_FORMAT_UNKNOWN);
    fs::remove_dir_all(plain).expect("清理");

    // 严格入口：声明卡片、实际箱子 → 格式未知。
    let box_root = temp_root("format-unknown-mismatch");
    write_minimal_box(&box_root, "1.0.0");
    let error = CardParser::new(ParseOptions::default())
        .open(&box_root)
        .expect_err("严格入口探测矛盾必须失败");
    assert_eq!(error.code(), DOCUMENT_FORMAT_UNKNOWN);
    fs::remove_dir_all(box_root).expect("清理");
}

#[test]
fn test_document_format_unknown_for_accessor_misuse() {
    let card_root = temp_root("misuse-card");
    write_minimal_card(&card_root, "1.0.0", "");
    let card = CardParser::new(ParseOptions::default())
        .open(&card_root)
        .expect("打开卡片");
    let error = card.entries(None).expect_err("卡片句柄没有条目集合");
    assert_eq!(error.code(), DOCUMENT_FORMAT_UNKNOWN);
    let error = card.layout_config().expect_err("卡片句柄没有布局配置");
    assert_eq!(error.code(), DOCUMENT_FORMAT_UNKNOWN);
    fs::remove_dir_all(card_root).expect("清理");

    let box_root = temp_root("misuse-box");
    write_minimal_box(&box_root, "1.0.0");
    let handle = BoxParser::new(ParseOptions::default())
        .open(&box_root)
        .expect("打开箱子");
    let error = handle
        .content(&NodeId::new(NODE).expect("测试标识合法"))
        .expect_err("箱子句柄没有内容节点");
    assert_eq!(error.code(), DOCUMENT_FORMAT_UNKNOWN);
    fs::remove_dir_all(box_root).expect("清理");
}

#[test]
fn test_document_not_found_for_unknown_node_and_resource() {
    let root = temp_root("not-found");
    write_minimal_card(&root, "1.0.0", "");
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    let ghost = NodeId::new("ffffffffff").expect("测试标识合法");
    let error = handle.content(&ghost).expect_err("结构外节点必须 NotFound");
    assert_eq!(error.code(), DOCUMENT_NOT_FOUND);
    let missing = PackagePath::new("assets/absent.bin").expect("合法路径");
    let error = handle
        .read_resource(&missing, None)
        .expect_err("索引外资源必须 NotFound");
    assert_eq!(error.code(), DOCUMENT_NOT_FOUND);
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_document_io_for_out_of_range_resource_window() {
    let root = temp_root("io-range");
    write_minimal_card(&root, "1.0.0", "");
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    let path = PackagePath::new("content/a1B2c3D4e5.yaml").expect("合法路径");
    let error = handle
        .read_resource(&path, Some(0..u64::MAX))
        .expect_err("越界读取窗口必须 DOCUMENT_IO");
    assert_eq!(error.code(), DOCUMENT_IO);
    fs::remove_dir_all(root).expect("清理");
}

// ---------------------------------------------------------------------------
// §8.3 诊断码 · 行为触发
// ---------------------------------------------------------------------------

#[test]
fn test_schema_unknown_field_warning_and_default_applied_info() {
    let root = temp_root("schema-warn-info");
    write_minimal_card(&root, "1.0.0", "mystery: 1\n");
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    let diagnostics = handle.diagnostics();
    assert!(
        has_code(&diagnostics, SCHEMA_UNKNOWN_FIELD),
        "非严格模式未知字段记警告"
    );
    assert!(
        has_code(&diagnostics, SCHEMA_DEFAULT_APPLIED),
        "repair 补默认值记信息"
    );
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_version_mismatch_minor_warning() {
    let root = temp_root("version-mismatch");
    write_minimal_card(&root, "1.1.0", "");
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    assert!(has_code(&handle.diagnostics(), DOCUMENT_VERSION_MISMATCH));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_extension_mismatch_prefers_probe() {
    // 目录名 .card 但内部是 .box 配置：以探测结果为准并记警告。
    let base = temp_root("extension-mismatch");
    let root = base.join("doc.card");
    write_minimal_box(&root, "1.0.0");
    let handle = open_document(&root, &ParseOptions::default()).expect("按探测结果打开");
    assert_eq!(handle.kind(), DocumentKind::Box);
    assert!(has_code(&handle.diagnostics(), DOCUMENT_EXTENSION_MISMATCH));
    fs::remove_dir_all(base).expect("清理");
}

#[test]
fn test_structure_yaml_syntax_error_is_fatal_with_diagnostic() {
    let root = temp_root("structure-syntax");
    write_minimal_card(&root, "1.0.0", "");
    write(
        &root,
        ".card/structure.yaml",
        b"structure:\n  - id: [1, 2\n",
    );
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开到 L0");
    let error = handle.structure().expect_err("结构语法失败必须致命");
    assert_eq!(error.code(), "DOCUMENT_STRUCTURE_INVALID");
    assert!(has_code(error.diagnostics(), YAML_SYNTAX_ERROR));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_structure_content_missing_keeps_placeholder() {
    let root = temp_root("content-missing");
    write_minimal_card(&root, "1.0.0", "");
    fs::remove_file(root.join("content/a1B2c3D4e5.yaml")).expect("移除内容文件");
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    // 结构层诊断惰性汇入：先触达结构再断言。
    let structure = handle.structure().expect("结构解析成功");
    assert!(has_code(&handle.diagnostics(), STRUCTURE_CONTENT_MISSING));
    let node_id = NodeId::new(NODE).expect("测试标识合法");
    let node = handle.content(&node_id).expect("部分成功：占位模型");
    assert_eq!(node.card_type, "base.text", "占位模型回退结构声明类型");
    assert!(matches!(node.value, DocumentValue::Mapping(ref items) if items.is_empty()));
    assert!(has_code(&node.diagnostics, STRUCTURE_CONTENT_MISSING));
    let StructureModel::Card {
        structure: nodes, ..
    } = structure.as_ref()
    else {
        panic!("卡片结构模型");
    };
    assert!(!nodes[0].present, "缺失内容节点的 present 标记为假");
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_content_node_failed_placeholder() {
    let root = temp_root("node-failed");
    write_minimal_card(&root, "1.0.0", "");
    write(
        &root,
        "content/a1B2c3D4e5.yaml",
        b"card_type: base.text\nbroken: [1,\n",
    );
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    let node = handle
        .content(&NodeId::new(NODE).expect("测试标识合法"))
        .expect("部分成功");
    assert!(has_code(&node.diagnostics, STRUCTURE_NODE_FAILED));
    assert!(has_code(&node.diagnostics, YAML_SYNTAX_ERROR));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_yaml_unsupported_tag_fails_node() {
    let root = temp_root("tag");
    write_minimal_card(&root, "1.0.0", "");
    write(
        &root,
        "content/a1B2c3D4e5.yaml",
        b"card_type: base.text\nvalue: !!binary aGk=\n",
    );
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    let node = handle
        .content(&NodeId::new(NODE).expect("测试标识合法"))
        .expect("部分成功");
    assert!(has_code(&node.diagnostics, YAML_UNSUPPORTED_TAG));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_crlf_normalized_info_diagnostic() {
    let root = temp_root("crlf");
    write_minimal_card(&root, "1.0.0", "");
    write(
        &root,
        "content/a1B2c3D4e5.yaml",
        "card_type: base.text\r\ntext: 你好\r\n".as_bytes(),
    );
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    let node = handle
        .content(&NodeId::new(NODE).expect("测试标识合法"))
        .expect("解析");
    assert!(has_code(&node.diagnostics, DOCUMENT_UNICODE_NORMALIZED));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_entry_source_invalid_and_target_missing() {
    let root = temp_root("entry-refs");
    write_minimal_box(&root, "1.0.0");
    write(
        &root,
        ".box/structure.yaml",
        b"entries:\n\
          \x20 - entry_id: a1B2c3D4e5\n\
          \x20   url: ftp://example.com/a\n\
          \x20   enabled: true\n\
          \x20 - entry_id: b1B2c3D4e5\n\
          \x20   url: assets/gone.bin\n\
          \x20   enabled: true\n",
    );
    let handle = BoxParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    // 结构层诊断惰性汇入：先触达结构再断言。
    let _ = handle.structure().expect("结构解析成功");
    let diagnostics = handle.diagnostics();
    assert!(
        has_code(&diagnostics, ENTRY_SOURCE_INVALID),
        "不允许的 scheme 记错误"
    );
    assert!(
        has_code(&diagnostics, ENTRY_TARGET_MISSING),
        "包内目标缺失记警告"
    );
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_entry_failed_keeps_position_disabled() {
    // schema 层后置的单条目失败：重复 entry_id 通过 schema（无重复约束），
    // 由流水线结构层记 ENTRY_FAILED；两条目均保留位置。
    let root = temp_root("entry-failed");
    write_minimal_box(&root, "1.0.0");
    write(
        &root,
        ".box/structure.yaml",
        b"entries:\n\
          \x20 - entry_id: a1B2c3D4e5\n\
          \x20   url: https://example.com/a\n\
          \x20   enabled: true\n\
          \x20 - entry_id: a1B2c3D4e5\n\
          \x20   url: https://example.com/b\n\
          \x20   enabled: true\n",
    );
    let handle = BoxParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    let entries = handle.entries(None).expect("条目集合");
    assert!(has_code(&handle.diagnostics(), ENTRY_FAILED));
    assert_eq!(entries.len(), 2, "重复条目位置保留");
    assert_eq!(entries[1].url, "https://example.com/b");
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_manifest_resource_missing_and_size_mismatch() {
    let root = temp_root("manifest");
    write_minimal_card(&root, "1.0.0", "");
    write(&root, "assets/pic.txt", b"12345");
    write(
        &root,
        ".card/structure.yaml",
        b"structure:\n  - id: a1B2c3D4e5\n    type: base.text\n\
          manifest:\n\
          \x20 card_count: 1\n\
          \x20 resource_count: 2\n\
          \x20 resources:\n\
          \x20\x20\x20 - path: assets/gone.txt\n\
          \x20\x20\x20   size: 3\n\
          \x20\x20\x20   type: text/plain\n\
          \x20\x20\x20 - path: assets/pic.txt\n\
          \x20\x20\x20   size: 999\n\
          \x20\x20\x20   type: text/plain\n",
    );
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    // 结构层诊断惰性汇入：先触达结构再断言。
    let _ = handle.structure().expect("结构解析成功");
    let diagnostics = handle.diagnostics();
    assert!(has_code(&diagnostics, DOCUMENT_RESOURCE_FILE_MISSING));
    assert!(has_code(&diagnostics, DOCUMENT_RESOURCE_INTEGRITY_MISMATCH));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_strict_unreferenced_file_escalated() {
    let root = temp_root("unreferenced");
    write_minimal_card(&root, "1.0.0", "");
    write(&root, "extra.txt", "孤儿文件".as_bytes());
    let options = ParseOptions {
        strict: true,
        ..ParseOptions::default()
    };
    let handle = CardParser::new(options).open(&root).expect("打开");
    // 未引用文件检查挂在结构解析末尾（严格模式）：先触达结构再断言。
    let _ = handle.structure().expect("结构解析成功");
    let diagnostics = handle.diagnostics();
    assert!(has_code(&diagnostics, DOCUMENT_UNREFERENCED_FILE));
    assert!(
        diagnostics
            .iter()
            .any(|item| item.code == DOCUMENT_UNREFERENCED_FILE && item.severity == Severity::Error),
        "严格模式未引用文件升级为错误级"
    );
    fs::remove_dir_all(root).expect("清理");
}

// ---------------------------------------------------------------------------
// 访问器面与全量解析（正常路径）
// ---------------------------------------------------------------------------

#[test]
fn test_card_handle_full_accessor_surface() {
    let root = temp_root("card-happy");
    write_minimal_card(&root, "1.0.0", "");
    // 资源必须在打开前写入：目录态索引在打开时一次性建立（§3.3）；
    // 资源登记进 manifest 以通过严格校验的未引用文件检查。
    write(&root, "assets/pic.txt", "chips-resource-bytes".as_bytes());
    write(
        &root,
        ".card/structure.yaml",
        b"structure:\n  - id: a1B2c3D4e5\n    type: base.text\n\
          manifest:\n\
          \x20 card_count: 1\n\
          \x20 resource_count: 1\n\
          \x20 resources:\n\
          \x20\x20\x20 - path: assets/pic.txt\n\
          \x20\x20\x20   size: 20\n\
          \x20\x20\x20   type: text/plain\n",
    );
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    assert_eq!(handle.kind(), DocumentKind::Card);

    // L0：metadata 常数时间。
    let metadata = handle.metadata();
    assert_eq!(metadata.name(), "测试卡片");
    assert_eq!(metadata.chip_standards_version(), "1.0.0");

    // L1：结构。
    let structure = handle.structure().expect("结构解析成功");
    let StructureModel::Card {
        structure: nodes, ..
    } = structure.as_ref()
    else {
        panic!("卡片结构模型");
    };
    assert_eq!(nodes.len(), 1);
    assert!(nodes[0].present);

    // L2：内容单元。
    let node = handle
        .content(&NodeId::new(NODE).expect("测试标识合法"))
        .expect("内容");
    assert_eq!(node.card_type, "base.text");
    assert_eq!(
        node.value.get("text").and_then(DocumentValue::as_str),
        Some("你好")
    );

    // 修订与统计。
    let revision = handle.revision();
    assert_eq!(revision.chip_standards_version, "1.0.0");
    assert!(!revision.index_digest.is_empty());
    let statistics = handle.statistics();
    assert!(statistics.yaml_bytes > 0);

    // 诊断快照（干净夹具允许存在 repair 信息级，但不得有错误级）。
    let diagnostics = handle.diagnostics();
    assert!(!diagnostics
        .iter()
        .any(|item| item.severity == Severity::Error));

    // 严格校验报告：合法夹具 → Valid。
    let report = handle.validate().expect("校验成功");
    assert_eq!(report.status, chips_parser::ValidationStatus::Valid);

    // 资源读取：全量与窗口。
    let path = PackagePath::new("assets/pic.txt").expect("合法路径");
    let mut full = handle.read_resource(&path, None).expect("全量读取");
    assert_eq!(
        full.read_to_vec().expect("读出字节"),
        b"chips-resource-bytes"
    );
    let mut window = handle.read_resource(&path, Some(8..15)).expect("窗口读取");
    assert_eq!(window.read_to_vec().expect("读出字节"), b"source-");

    // 内容摘要：确定性。
    assert_eq!(
        handle.content_digest().expect("摘要"),
        handle.content_digest().expect("摘要")
    );
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_box_handle_full_accessor_surface() {
    let root = temp_root("box-happy");
    write_minimal_box(&root, "1.0.0");
    let handle = BoxParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    assert_eq!(handle.kind(), DocumentKind::Box);

    let entries = handle.entries(None).expect("条目全集");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].entry_id, NODE);
    assert!(entries[0].enabled);
    // 分页窗口：越界端点收敛。
    assert_eq!(handle.entries(Some(1..99)).expect("窗口").len(), 0);
    assert_eq!(handle.entries(Some(0..1)).expect("窗口").len(), 1);

    let layout = handle.layout_config().expect("布局配置");
    assert_eq!(
        layout
            .get("active_layout_type")
            .and_then(DocumentValue::as_str),
        Some("grid")
    );

    let report = handle.validate().expect("校验成功");
    assert_eq!(report.status, chips_parser::ValidationStatus::Valid);

    // 全量解析对称入口。
    let parsed = BoxParser::new(ParseOptions::default())
        .parse(&root)
        .expect("全量解析");
    assert_eq!(parsed.metadata.name, "测试箱子");
    assert_eq!(parsed.entries.len(), 1);
    assert_eq!(parsed.statistics.entry_count, 1);
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_layout_config_missing_placeholder() {
    let root = temp_root("layout-missing");
    write_minimal_box(&root, "1.0.0");
    fs::remove_file(root.join(".box/content.yaml")).expect("移除布局配置");
    let handle = BoxParser::new(ParseOptions::default())
        .open(&root)
        .expect("打开");
    let layout = handle.layout_config().expect("§8.4 部分成功：空映射占位");
    assert!(matches!(layout.as_ref(), DocumentValue::Mapping(items) if items.is_empty()));
    assert!(has_code(&handle.diagnostics(), STRUCTURE_CONTENT_MISSING));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_card_parse_full_and_parallel_units() {
    let root = temp_root("card-parallel");
    write_minimal_card(&root, "1.0.0", "");
    let mut structure = String::from("structure:\n");
    for index in 0..5 {
        let id = format!("a1B2c3D4e{index}");
        structure.push_str(&format!("  - id: {id}\n    type: base.text\n"));
        write(
            &root,
            &format!("content/{id}.yaml"),
            format!("card_type: base.text\norder: {index}\n").as_bytes(),
        );
    }
    structure.push_str("manifest:\n  card_count: 5\n  resource_count: 0\n");
    write(&root, ".card/structure.yaml", structure.as_bytes());
    // 移除夹具默认节点的多余内容文件，保持清单一致。
    fs::remove_file(root.join("content/a1B2c3D4e5.yaml")).expect("移除默认内容");

    let parsed = CardParser::new(ParseOptions::default())
        .parse(&root)
        .expect("全量解析");
    assert_eq!(parsed.content.len(), 5, "结构顺序输出全部节点");
    assert_eq!(parsed.structure.node_count(), 5);
    assert_eq!(parsed.statistics.resource_count, 0);
    assert!(parsed
        .diagnostics
        .iter()
        .all(|item| item.severity != Severity::Error));
    for (index, (_, node)) in parsed.content.iter().enumerate() {
        assert_eq!(
            node.value.get("order").and_then(DocumentValue::as_i64),
            Some(index as i64),
            "输出顺序与结构声明一致"
        );
    }
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_card_parse_with_cache_reuse() {
    let root = temp_root("card-cache");
    write_minimal_card(&root, "1.0.0", "");
    let cache = Arc::new(chips_parser::ParseCache::default());
    let parser = CardParser::new(ParseOptions::default()).with_cache(Arc::clone(&cache));
    let first = parser.parse(&root).expect("首次解析");
    let second = parser.parse(&root).expect("二次解析（缓存命中）");
    assert_eq!(first.content, second.content);
    assert!(cache.stats().0 > 0, "内容单元进入缓存");
    fs::remove_dir_all(root).expect("清理");
}
