//! 流水线分支补测（《06-文档解析器设计》§3.2、§3.4–§3.7、§6.4、§8.4）：
//! 可选字段的模型构建臂、格式判定的扩展名/索引组合臂、结构与布局的失败
//! 归一、清单完整性与条目引用分类的未触达分支，以及句柄观测面。
//!
//! 夹具一律目录态（§4.2），每个测试独占一棵临时小树并在结束时清理。
//!
//! 本文件不覆盖、按定性登记的防御臂（公开入口不可达，刷行即假覆盖）：
//! - `pipeline.rs` L405-411：`enum_or_none` 闭包定义后立即 `let _ =` 丢弃，
//!   为死代码（已登记 `/tmp/t131_findings.md`）；
//! - `pipeline.rs` L355 / L360（`tags` 含非字符串项、`tags` 非序列）、
//!   L387（`content_warning` 非序列）、L403（`file_info` 非映射）、
//!   L426 / L439（`visibility` / `age_rating` 枚举越界）、L392-393 的 `?`
//!   回退：schema 层（`METADATA_FIELDS` 的枚举与类型收窄）先行判错，
//!   走到构建期即已排除这些形态；
//! - `pipeline.rs` L555-556、L573-582、L647、L808-809、L832-849：
//!   `structure` / `entries` / `manifest` 及其条目必填集合由 schema 保证，
//!   未通过时在 L518 归一致命，构建期分支不可达；
//! - `pipeline.rs` L119、L127-130（头部字节读取的 IO 与中断分支）、
//!   L256、L493（`other => other` 归一臂）、L978-982（内容文件在索引内
//!   却读取 NotFound 的竞争窗口）需要真实 IO 故障注入；
//! - `parser/mod.rs` L208（并发写窗口）、L493 与 L589-596（工作线程结果
//!   缺失复核）、L621 / L656（结构模型与句柄格式不符）为内部不变量保护。

use std::fs;
use std::path::{Path, PathBuf};

use chips_parser::error::{
    Diagnostic, Severity, DOCUMENT_EXTENSION_MISMATCH, DOCUMENT_FORMAT_UNKNOWN, DOCUMENT_IO,
    DOCUMENT_LIMIT_EXCEEDED, DOCUMENT_METADATA_INVALID, DOCUMENT_METADATA_MISSING,
    DOCUMENT_RESOURCE_INTEGRITY_MISMATCH, DOCUMENT_STRUCTURE_INVALID, DOCUMENT_UNREFERENCED_FILE,
    ENTRY_FAILED, ENTRY_SOURCE_INVALID, ENTRY_TARGET_MISSING, SCHEMA_DEFAULT_APPLIED,
    SCHEMA_REQUIRED_MISSING, SCHEMA_TYPE_MISMATCH, SCHEMA_UNKNOWN_FIELD, STRUCTURE_CONTENT_MISSING,
    STRUCTURE_NODE_FAILED, YAML_SYNTAX_ERROR,
};
use chips_parser::model::{
    AgeRating, DocumentKind, DocumentMetadata, DocumentValue, ParseLimits, ParseOptions,
    StructureModel, Tag, ValidationStatus, Visibility,
};
use chips_parser::{open_document, BoxParser, CardParser};

/// 10 位 Base62 测试节点标识。
const NODE: &str = "a1B2c3D4e5";

/// `b"abc"` 的 SHA256（公开测试向量，用于资源摘要断言）。
const ABC_SHA256: &str = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

fn temp_root(tag: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!(
        "chips-parser-t131-{tag}-{}-{:?}",
        std::process::id(),
        std::thread::current().id()
    ));
    let _ = fs::remove_dir_all(&base);
    fs::create_dir_all(&base).expect("创建夹具根目录");
    base
}

fn write(root: impl AsRef<Path>, relative: &str, bytes: impl AsRef<[u8]>) {
    let target = root.as_ref().join(relative);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).expect("创建成员父目录");
    }
    fs::write(target, bytes.as_ref()).expect("写入成员");
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

fn has_code(diagnostics: &[Diagnostic], code: &str) -> bool {
    diagnostics.iter().any(|item| item.code == code)
}

/// 取指定码的全部诊断（多次触发时逐条核对）。
fn coded<'a>(diagnostics: &'a [Diagnostic], code: &str) -> Vec<&'a Diagnostic> {
    diagnostics
        .iter()
        .filter(|item| item.code == code)
        .collect()
}

/// 以默认选项打开卡片。
fn open_card(root: &Path) -> chips_parser::DocumentHandle {
    CardParser::new(ParseOptions::default())
        .open(root)
        .expect("打开卡片")
}

/// 以默认选项打开箱子。
fn open_box(root: &Path) -> chips_parser::DocumentHandle {
    BoxParser::new(ParseOptions::default())
        .open(root)
        .expect("打开箱子")
}

// ---------------------------------------------------------------------------
// 句柄观测面与统计归零臂
// ---------------------------------------------------------------------------

#[test]
fn 句柄选项与未加载结构的统计归零() {
    let root = temp_root("handle-surface");
    write_minimal_card(&root, "1.0.0", "");
    write(&root, "assets/ok.bin", b"abc");
    write(
        &root,
        ".card/structure.yaml",
        r#"structure:
  - id: a1B2c3D4e5
    type: base.text
manifest:
  card_count: 1
  resource_count: 1
  resources:
    - path: assets/ok.bin
      size: 3
      type: application/octet-stream
"#,
    );

    let parser = CardParser::new(ParseOptions::default());
    assert!(parser.options().repair, "入口选项访问器回显构造入参");
    let handle = parser.open(&root).expect("打开卡片");
    assert!(!handle.options().strict, "句柄选项访问器回显打开入参");

    // 结构未加载：资源/条目计数为 0，成员计数即时可得。
    let before = handle.statistics();
    assert_eq!(before.member_count, 4, "元数据 + 结构 + 内容 + 资源");
    assert_eq!(before.resource_count, 0, "结构未加载时资源计数归零");
    assert_eq!(before.entry_count, 0);
    assert!(before.yaml_bytes > 0, "L0 已消耗元数据字节");

    let structure = handle.structure().expect("结构解析成功");
    let after = handle.statistics();
    assert_eq!(after.resource_count, 1, "结构加载后清单计数入账");
    assert!(after.yaml_bytes > before.yaml_bytes, "结构字节并入统计");
    let debug_text = format!("{handle:?}");
    assert!(debug_text.contains("DocumentHandle"));
    assert!(debug_text.contains("a1B2c3D4e5"), "Debug 露出文档标识");
    assert!(debug_text.contains("1.0.0"), "Debug 露出标准版本");
    assert!(matches!(
        structure.as_ref(),
        StructureModel::Card {
            structure: nodes,
            ..
        } if nodes.len() == 1
    ));

    // 箱子侧同臂：条目计数在结构加载前后由 0 变 1。
    let box_root = temp_root("handle-surface-box");
    write_minimal_box(&box_root, "1.0.0");
    let box_parser = BoxParser::new(ParseOptions::default());
    assert_eq!(box_parser.options().parallelism, 4);
    let box_handle = box_parser.open(&box_root).expect("打开箱子");
    assert_eq!(box_handle.statistics().entry_count, 0);
    assert!(!box_handle.options().verify_hashes);
    let _ = box_handle.entries(None).expect("条目集合");
    assert_eq!(box_handle.statistics().entry_count, 1);
    fs::remove_dir_all(root).expect("清理");
    fs::remove_dir_all(box_root).expect("清理");
}

// ---------------------------------------------------------------------------
// §3.4 第 6 步 · 可选字段的模型构建臂
// ---------------------------------------------------------------------------

#[test]
fn 卡片元数据可选字段全臂建模() {
    let root = temp_root("card-optional-full");
    write(
        &root,
        ".card/metadata.yaml",
        r#"chip_standards_version: "1.0.0"
card_id: a1B2c3D4e5
name: 测试卡片
created_at: "2024-01-01T00:00:00Z"
modified_at: "2024-01-02T00:00:00Z"
theme: 暗色
cover_ratio: "16:9"
tags:
  - travel
  - [city, hangzhou]
visibility: unlisted
downloadable: false
remixable: true
commentable: false
license: MIT-0
age_rating: nc17
content_warning:
  - violence
  - spoiler
file_info:
  total_size: 4096
  file_count: 3
  checksum: sha256:deadbeef
  generated_at: "2024-01-03T00:00:00Z"
"#
        .as_bytes(),
    );
    write(
        &root,
        ".card/structure.yaml",
        b"structure: []\nmanifest:\n  card_count: 0\n  resource_count: 0\n",
    );
    let handle = open_card(&root);
    let metadata = handle.metadata();
    let DocumentMetadata::Card(card) = metadata.as_ref() else {
        panic!("卡片元数据");
    };
    assert_eq!(card.theme.as_deref(), Some("暗色"));
    assert_eq!(card.cover_ratio.as_deref(), Some("16:9"));
    assert_eq!(card.license.as_deref(), Some("MIT-0"));
    assert_eq!(card.visibility, Some(Visibility::Unlisted));
    assert_eq!(card.age_rating, Some(AgeRating::Nc17));
    assert_eq!(
        (card.downloadable, card.remixable, card.commentable),
        (Some(false), Some(true), Some(false))
    );
    assert_eq!(
        card.tags,
        vec![
            Tag::Simple("travel".to_owned()),
            Tag::Structured(vec!["city".to_owned(), "hangzhou".to_owned()]),
        ],
        "简单标签与结构化标签分别建模"
    );
    assert_eq!(
        card.content_warning.as_deref(),
        Some(&["violence".to_owned(), "spoiler".to_owned()][..])
    );
    let info = card.file_info.as_ref().expect("文件信息入账");
    assert_eq!(info.total_size, 4096);
    assert_eq!(info.file_count, 3);
    assert_eq!(info.checksum.as_deref(), Some("sha256:deadbeef"));
    assert_eq!(info.generated_at.as_deref(), Some("2024-01-03T00:00:00Z"));
    assert!(!has_code(&handle.diagnostics(), SCHEMA_UNKNOWN_FIELD));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn 关闭修复后可选字段留空且不补默认() {
    let root = temp_root("card-no-repair");
    write_minimal_card(&root, "1.0.0", "");
    let options = ParseOptions {
        repair: false,
        ..ParseOptions::default()
    };
    let handle = CardParser::new(options.clone())
        .open(&root)
        .expect("打开卡片");
    let metadata = handle.metadata();
    let DocumentMetadata::Card(card) = metadata.as_ref() else {
        panic!("卡片元数据");
    };
    assert!(card.tags.is_empty(), "缺 tags 即空标签集");
    assert_eq!(card.visibility, None, "关闭修复后不补 private 默认");
    assert_eq!(card.age_rating, None);
    assert_eq!(card.theme, None);
    assert_eq!(card.cover_ratio, None);
    assert_eq!(card.license, None);
    assert_eq!(card.downloadable, None);
    assert_eq!(card.content_warning, None, "缺 content_warning 保持 None");
    assert_eq!(card.file_info, None, "缺 file_info 保持 None");
    assert!(
        !has_code(&handle.diagnostics(), SCHEMA_DEFAULT_APPLIED),
        "repair 关闭时不得有补默认诊断"
    );

    // 箱子侧同一臂：无 tags 且关闭修复 → tags 保持 None。
    let box_root = temp_root("box-no-repair");
    write_minimal_box(&box_root, "1.0.0");
    let box_handle = BoxParser::new(options).open(&box_root).expect("打开箱子");
    let metadata = box_handle.metadata();
    let DocumentMetadata::Box(model) = metadata.as_ref() else {
        panic!("箱子元数据");
    };
    assert_eq!(model.tags, None);
    assert_eq!(model.description, None);
    assert_eq!(model.cover_asset, None);
    assert_eq!(model.owner, None);
    assert_eq!(model.source, None);
    fs::remove_dir_all(root).expect("清理");
    fs::remove_dir_all(box_root).expect("清理");
}

#[test]
fn 可见性与年龄分级枚举逐值建模() {
    let visibility_cases = [
        ("public", Visibility::Public),
        ("private", Visibility::Private),
        ("unlisted", Visibility::Unlisted),
    ];
    for (raw, expected) in visibility_cases {
        let root = temp_root(&format!("visibility-{raw}"));
        write_minimal_card(&root, "1.0.0", &format!("visibility: {raw}\n"));
        let handle = open_card(&root);
        let metadata = handle.metadata();
        let DocumentMetadata::Card(card) = metadata.as_ref() else {
            panic!("卡片元数据");
        };
        assert_eq!(card.visibility, Some(expected), "{raw} 建模失败");
        fs::remove_dir_all(root).expect("清理");
    }

    let rating_cases = [
        ("all", AgeRating::All),
        ("pg", AgeRating::Pg),
        ("pg13", AgeRating::Pg13),
        ("r", AgeRating::R),
        ("nc17", AgeRating::Nc17),
    ];
    for (raw, expected) in rating_cases {
        let root = temp_root(&format!("age-rating-{raw}"));
        write_minimal_card(&root, "1.0.0", &format!("age_rating: {raw}\n"));
        let handle = open_card(&root);
        let metadata = handle.metadata();
        let DocumentMetadata::Card(card) = metadata.as_ref() else {
            panic!("卡片元数据");
        };
        assert_eq!(card.age_rating, Some(expected), "{raw} 建模失败");
        fs::remove_dir_all(root).expect("清理");
    }
}

#[test]
fn 内容警告含非字符串项判模型构建失败() {
    // schema 层对 content_warning 只收窄到序列（无子项规格）；
    // 整数项在构建期回退 None，由调用方归一致命（§11.3 防御臂）。
    let root = temp_root("content-warning-int");
    write(
        &root,
        ".card/metadata.yaml",
        card_metadata("1.0.0", "content_warning:\n- 1\n").as_bytes(),
    );
    let error = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect_err("内容警告项形态不符必须致命");
    assert_eq!(error.code(), DOCUMENT_METADATA_INVALID);
    assert!(
        format!("{error}").contains("元数据模型构建失败"),
        "实际文案：{error}"
    );
    assert_eq!(
        error
            .diagnostics()
            .iter()
            .filter(|item| item.code == SCHEMA_DEFAULT_APPLIED)
            .count(),
        7,
        "repair 补齐七个可选字段后仅剩信息级默认值诊断"
    );
    assert!(
        error
            .diagnostics()
            .iter()
            .all(|item| item.severity != Severity::Error),
        "错误级判定来自模型构建而非 schema 校验：{:?}",
        error
            .diagnostics()
            .iter()
            .map(|item| (item.code, item.severity))
            .collect::<Vec<_>>()
    );
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn 箱子元数据可选字段全臂建模() {
    let root = temp_root("box-optional-full");
    write(
        &root,
        ".box/metadata.yaml",
        r#"chip_standards_version: "1.0.0"
box_id: z9Y8x7W6v5
name: 测试箱子
created_at: "2024-01-01T00:00:00Z"
modified_at: "2024-01-02T00:00:00Z"
active_layout_type: grid
description: 一个用于回归的箱子
tags:
  - reading
  - [topic, rust]
cover_ratio: "3:4"
cover_asset: assets/cover.png
owner: 张三
source:
  origin: local
  revision: 7
"#
        .as_bytes(),
    );
    write(&root, ".box/structure.yaml", b"entries: []\n");
    write(&root, ".box/content.yaml", b"active_layout_type: grid\n");
    let handle = open_box(&root);
    let metadata = handle.metadata();
    let DocumentMetadata::Box(model) = metadata.as_ref() else {
        panic!("箱子元数据");
    };
    assert_eq!(model.description.as_deref(), Some("一个用于回归的箱子"));
    assert_eq!(
        model.tags,
        Some(vec![
            Tag::Simple("reading".to_owned()),
            Tag::Structured(vec!["topic".to_owned(), "rust".to_owned()]),
        ])
    );
    assert_eq!(model.cover_ratio.as_deref(), Some("3:4"));
    assert_eq!(model.cover_asset.as_deref(), Some("assets/cover.png"));
    assert_eq!(model.owner.as_deref(), Some("张三"));
    let source = model.source.as_ref().expect("source 映射入账");
    assert_eq!(
        source.get("origin").and_then(DocumentValue::as_str),
        Some("local")
    );
    assert_eq!(
        source.get("revision").and_then(DocumentValue::as_i64),
        Some(7)
    );
    fs::remove_dir_all(root).expect("清理");
}

// ---------------------------------------------------------------------------
// §3.2 第 4 条 · 格式判定残余臂
// ---------------------------------------------------------------------------

#[test]
fn 配置目录歧义与扩展名组合判定() {
    // 同时存在 .card 与 .box 配置目录：判定歧义，致命。
    let both = temp_root("detect-both");
    write(
        &both,
        ".card/metadata.yaml",
        card_metadata("1.0.0", "").as_bytes(),
    );
    write(
        &both,
        ".box/metadata.yaml",
        b"chip_standards_version: \"1.0.0\"\n",
    );
    let error = open_document(&both, &ParseOptions::default()).expect_err("双配置必须判歧义");
    assert_eq!(error.code(), DOCUMENT_FORMAT_UNKNOWN);
    assert!(format!("{error}").contains("同时存在 .card 与 .box"));
    fs::remove_dir_all(both).expect("清理");

    // 无扩展名 + 探测到卡片配置：以探测结果为准，不记扩展名矛盾。
    let noext = temp_root("detect-noext");
    let noext_root = noext.join("plainname");
    write_minimal_card(&noext_root, "1.0.0", "");
    let handle = open_document(&noext_root, &ParseOptions::default()).expect("按探测打开");
    assert_eq!(handle.kind(), DocumentKind::Card);
    assert!(
        !has_code(&handle.diagnostics(), DOCUMENT_EXTENSION_MISMATCH),
        "无扩展名不构成矛盾"
    );
    fs::remove_dir_all(noext).expect("清理");

    // `.box` 扩展名 + 探测一致：按扩展名分支判定。
    let boxed = temp_root("detect-box-ext");
    let boxed_root = boxed.join("shelf.box");
    write_minimal_box(&boxed_root, "1.0.0");
    let handle = open_document(&boxed_root, &ParseOptions::default()).expect("按扩展名打开");
    assert_eq!(handle.kind(), DocumentKind::Box);
    assert!(!has_code(
        &handle.diagnostics(),
        DOCUMENT_EXTENSION_MISMATCH
    ));
    fs::remove_dir_all(boxed).expect("清理");

    // `.card` 扩展名 + 探测为空：以扩展名续行，缺元数据归一为 MetadataMissing。
    let bare = temp_root("detect-ext-only");
    let bare_root = bare.join("shell.card");
    write(
        &bare_root,
        ".card/structure.yaml",
        b"structure: []\nmanifest:\n  card_count: 0\n  resource_count: 0\n",
    );
    let error =
        open_document(&bare_root, &ParseOptions::default()).expect_err("仅有结构文件必须缺元数据");
    assert_eq!(error.code(), DOCUMENT_METADATA_MISSING);
    fs::remove_dir_all(bare).expect("清理");

    // 自动识别：扩展名与索引双双无凭据。
    let nothing = temp_root("detect-none");
    let nothing_root = nothing.join("mystery");
    fs::create_dir_all(&nothing_root).expect("创建空目录");
    write(&nothing_root, "notes.txt", "无关文件".as_bytes());
    let error =
        open_document(&nothing_root, &ParseOptions::default()).expect_err("双双无凭据必须致命");
    assert_eq!(error.code(), DOCUMENT_FORMAT_UNKNOWN);
    assert!(format!("{error}").contains("扩展名未知且索引中不存在"));
    fs::remove_dir_all(nothing).expect("清理");

    // 严格入口：探测为空且扩展名与声明不一致 → 索引与扩展名均无法确认。
    let strict_root = temp_root("detect-strict-unconfirmed");
    let strict_dir = strict_root.join("nomatch.card");
    fs::create_dir_all(&strict_dir).expect("创建目录");
    write(&strict_dir, "content/keep.txt", b"x");
    let error = BoxParser::new(ParseOptions::default())
        .open(&strict_dir)
        .expect_err("声明箱子但无任何配置必须致命");
    assert_eq!(error.code(), DOCUMENT_FORMAT_UNKNOWN);
    assert!(format!("{error}").contains("索引与扩展名均无法确认声明的文档格式"));
    fs::remove_dir_all(strict_root).expect("清理");
}

#[test]
fn 短文件与不可达路径的致命归一() {
    // 不足 4 字节的普通文件：签名探测提前收敛，判格式未知。
    let root = temp_root("short-read");
    let tiny = root.join("tiny.bin");
    fs::write(&tiny, b"PK").expect("写入两字节文件");
    let error = open_document(&tiny, &ParseOptions::default()).expect_err("两字节必须判格式未知");
    assert_eq!(error.code(), DOCUMENT_FORMAT_UNKNOWN);
    assert!(format!("{error}").contains("既不是目录也不是 ZIP 归档"));
    fs::remove_dir_all(root).expect("清理");

    // 入口父段是普通文件：元数据枚举失败归一为 IO（非 NotFound）。
    let io_root = temp_root("io-path");
    let file = io_root.join("regular.txt");
    fs::write(&file, b"not a package").expect("写入普通文件");
    let error = open_document(&file.join("child.card"), &ParseOptions::default())
        .expect_err("路径穿透普通文件必须 IO 失败");
    assert_eq!(error.code(), DOCUMENT_IO);
    assert!(format!("{error}").contains("无法访问入口路径"));
    fs::remove_dir_all(io_root).expect("清理");
}

// ---------------------------------------------------------------------------
// §3.5 · 结构层失败归一与节点去重
// ---------------------------------------------------------------------------

#[test]
fn 结构成员缺失与schema失败归一致命() {
    // 缺 structure.yaml：L0 可开，L1 归一为「缺少结构文件」。
    let missing = temp_root("structure-missing");
    write(
        &missing,
        ".card/metadata.yaml",
        card_metadata("1.0.0", "").as_bytes(),
    );
    let handle = open_card(&missing);
    let error = handle.structure().expect_err("缺结构文件必须结构层级致命");
    assert_eq!(error.code(), DOCUMENT_STRUCTURE_INVALID);
    assert!(format!("{error}").contains("缺少结构文件"));
    fs::remove_dir_all(missing).expect("清理");

    // 结构 schema 失败（缺 type 与 manifest）：归一为「未通过 schema 校验」。
    let invalid = temp_root("structure-schema");
    write_minimal_card(&invalid, "1.0.0", "");
    write(
        &invalid,
        ".card/structure.yaml",
        b"structure:\n  - id: a1B2c3D4e5\n",
    );
    let handle = open_card(&invalid);
    let error = handle.structure().expect_err("schema 失败必须结构层级致命");
    assert_eq!(error.code(), DOCUMENT_STRUCTURE_INVALID);
    assert!(format!("{error}").contains("未通过 schema 校验"));
    assert!(has_code(error.diagnostics(), SCHEMA_REQUIRED_MISSING));
    assert!(has_code(&handle.diagnostics(), SCHEMA_REQUIRED_MISSING));
    fs::remove_dir_all(invalid).expect("清理");

    // 结构根节点非映射：语法归一臂。
    let scalar = temp_root("structure-scalar");
    write_minimal_card(&scalar, "1.0.0", "");
    write(&scalar, ".card/structure.yaml", b"just text\n");
    let handle = open_card(&scalar);
    let error = handle
        .structure()
        .expect_err("根节点非映射必须结构层级致命");
    assert_eq!(error.code(), DOCUMENT_STRUCTURE_INVALID);
    assert!(has_code(error.diagnostics(), YAML_SYNTAX_ERROR));
    fs::remove_dir_all(scalar).expect("清理");
}

#[test]
fn 重复节点标识按失败处理并保序() {
    let root = temp_root("duplicate-node");
    write_minimal_card(&root, "1.0.0", "");
    write(
        &root,
        ".card/structure.yaml",
        r#"structure:
  - id: a1B2c3D4e5
    type: base.text
  - id: a1B2c3D4e5
    type: base.image
  - id: b1B2c3D4e5
    type: base.text
manifest:
  card_count: 2
  resource_count: 0
"#,
    );
    write(&root, "content/b1B2c3D4e5.yaml", b"card_type: base.text\n");
    let handle = open_card(&root);
    let structure = handle.structure().expect("重复节点不阻断结构");
    let StructureModel::Card {
        structure: nodes, ..
    } = structure.as_ref()
    else {
        panic!("卡片结构模型");
    };
    assert_eq!(nodes.len(), 2, "后出现的重复节点被剔除，其余保序");
    assert_eq!(nodes[1].node_id.as_str(), "b1B2c3D4e5");
    let diagnostics = handle.diagnostics();
    let failed = coded(&diagnostics, STRUCTURE_NODE_FAILED);
    assert_eq!(failed.len(), 1, "仅重复节点记一条失败诊断");
    assert!(failed[0].message.contains("重复，后出现的节点按失败处理"));
    assert_eq!(failed[0].pointer.as_deref(), Some("/structure/1"));
    assert_eq!(
        failed[0]
            .file
            .as_ref()
            .map(|item| item.to_string())
            .unwrap_or_default(),
        ".card/structure.yaml"
    );
    assert_eq!(failed[0].severity, Severity::Error);
    fs::remove_dir_all(root).expect("清理");
}

// ---------------------------------------------------------------------------
// §6.4 · 清单路径合法性与资源摘要
// ---------------------------------------------------------------------------

#[test]
fn 清单非法路径与资源摘要校验() {
    let root = temp_root("manifest-integrity");
    write_minimal_card(&root, "1.0.0", "");
    write(&root, "assets/ok.bin", b"abc");
    write(&root, "assets/bad.bin", b"abc");
    write(
        &root,
        ".card/structure.yaml",
        r#"structure:
  - id: a1B2c3D4e5
    type: base.text
manifest:
  card_count: 1
  resource_count: 3
  resources:
    - path: ../outside.bin
      size: 3
      type: application/octet-stream
    - path: assets/bad.bin
      size: 3
      type: application/octet-stream
      checksum: "0000000000000000000000000000000000000000000000000000000000000000"
    - path: assets/ok.bin
      size: 3
      type: application/octet-stream
      checksum: "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
"#,
    );

    // 关闭摘要校验：仅记非法路径，不比对 checksum。
    let handle = open_card(&root);
    let _ = handle.structure().expect("结构解析成功");
    let diagnostics = handle.diagnostics();
    let illegal = coded(&diagnostics, ENTRY_SOURCE_INVALID);
    assert_eq!(illegal.len(), 1);
    assert!(illegal[0]
        .message
        .contains("资源清单路径非法：../outside.bin"));
    assert_eq!(
        illegal[0].pointer.as_deref(),
        Some("/manifest/resources/0"),
        "非法路径条目按清单下标定位"
    );
    assert!(!has_code(
        &diagnostics,
        DOCUMENT_RESOURCE_INTEGRITY_MISMATCH
    ));
    let model = handle.structure().expect("结构模型");
    let StructureModel::Card { manifest, .. } = model.as_ref() else {
        panic!("卡片结构模型");
    };
    assert_eq!(manifest.card_count, 1);
    assert_eq!(manifest.resource_count, 3);
    assert_eq!(manifest.resources.len(), 2, "非法路径条目不入清单模型");
    assert_eq!(manifest.resources[0].path.as_str(), "assets/bad.bin");
    assert_eq!(manifest.resources[1].size, 3);
    assert_eq!(
        manifest.resources[1].checksum.as_deref(),
        Some(format!("sha256:{ABC_SHA256}").as_str())
    );
    fs::remove_dir_all(root).expect("清理");

    // 开启摘要校验：错误声明值记错误级不匹配，正确声明值静默通过。
    let verify_root = temp_root("manifest-verify");
    write_minimal_card(&verify_root, "1.0.0", "");
    write(&verify_root, "assets/ok.bin", b"abc");
    write(&verify_root, "assets/upper.bin", b"abc");
    write(&verify_root, "assets/bad.bin", b"abc");
    write(
        &verify_root,
        ".card/structure.yaml",
        r#"structure:
  - id: a1B2c3D4e5
    type: base.text
manifest:
  card_count: 1
  resource_count: 3
  resources:
    - path: assets/bad.bin
      size: 3
      type: application/octet-stream
      checksum: "0000000000000000000000000000000000000000000000000000000000000000"
    - path: assets/upper.bin
      size: 3
      type: application/octet-stream
      checksum: "SHA256:BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD"
    - path: assets/ok.bin
      size: 3
      type: application/octet-stream
      checksum: "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
"#,
    );
    let options = ParseOptions {
        verify_hashes: true,
        ..ParseOptions::default()
    };
    let handle = CardParser::new(options)
        .open(&verify_root)
        .expect("打开卡片");
    let _ = handle.structure().expect("结构解析成功");
    let diagnostics = handle.diagnostics();
    let mismatches = coded(&diagnostics, DOCUMENT_RESOURCE_INTEGRITY_MISMATCH);
    assert_eq!(mismatches.len(), 2, "声明值错误的两条资源各记一条不匹配");
    assert!(mismatches[0].message.contains("SHA256 与声明值不符"));
    assert!(mismatches[0].message.contains("assets/bad.bin"));
    assert_eq!(mismatches[0].severity, Severity::Error);
    assert_eq!(
        mismatches[0].pointer.as_deref(),
        Some("/manifest/resources/0")
    );
    // 前缀 `sha256:` 的剥离按大小写敏感匹配：等价的大写前缀声明值判为不匹配
    // （行为观察已登记），小写前缀的等价声明值静默通过。
    assert!(mismatches[1].message.contains("assets/upper.bin"));
    assert_eq!(
        mismatches[1].pointer.as_deref(),
        Some("/manifest/resources/1")
    );
    assert!(
        !mismatches
            .iter()
            .any(|item| item.message.contains("assets/ok.bin")),
        "小写前缀的正确声明值必须通过摘要比对"
    );
    fs::remove_dir_all(verify_root).expect("清理");
}

// ---------------------------------------------------------------------------
// §3.5 / §3.6 · 箱子条目引用分类与限额
// ---------------------------------------------------------------------------

#[test]
fn 条目引用分类残余臂与条目数限额() {
    let root = temp_root("entry-classify");
    write_minimal_box(&root, "1.0.0");
    write(&root, "assets/in.bin", b"in-resource");
    write(
        &root,
        ".box/structure.yaml",
        r#"entries:
  - entry_id: a1B2c3D4e5
    url: data://payload
    enabled: true
  - entry_id: b1B2c3D4e5
    url: ../escape.txt
    enabled: true
  - entry_id: c1B2c3D4e5
    url: assets/in.bin
    enabled: false
  - entry_id: d1B2c3D4e5
    url: data:text/plain,hello
    enabled: true
"#,
    );
    let handle = open_box(&root);
    let structure = handle.structure().expect("结构解析成功");
    let StructureModel::Box { entries, .. } = structure.as_ref() else {
        panic!("箱子结构模型");
    };
    assert_eq!(entries.len(), 4, "全部条目保留位置");
    assert!(!entries[2].enabled);
    let diagnostics = handle.diagnostics();
    let rejected = coded(&diagnostics, ENTRY_SOURCE_INVALID);
    assert_eq!(rejected.len(), 2, "data 方案与非法相对路径各记一条");
    assert!(rejected[0].message.contains("data: 引用仅限运行时内存形态"));
    assert_eq!(rejected[0].pointer.as_deref(), Some("/entries/0"));
    assert!(rejected[1].message.contains("不是合法的包内相对路径"));
    assert_eq!(rejected[1].pointer.as_deref(), Some("/entries/1"));
    // 现形 data URI（无 `://`）不进 scheme 分类臂，按包内相对路径处理：
    // 判定为「目标缺失」警告而非「scheme 不允许」错误（已登记观察项）。
    let missing = coded(&diagnostics, ENTRY_TARGET_MISSING);
    assert_eq!(
        missing.len(),
        1,
        "已存在的包内目标不得记缺失，仅 data URI 记一条"
    );
    assert!(missing[0].message.contains("data:text/plain,hello"));
    assert_eq!(missing[0].pointer.as_deref(), Some("/entries/3"));
    assert_eq!(missing[0].severity, Severity::Warning);
    assert!(!has_code(&diagnostics, ENTRY_FAILED));
    fs::remove_dir_all(root).expect("清理");

    // 严格模式：包内引用计入引用集合，孤儿文件仍单独记账。
    let strict_root = temp_root("entry-classify-strict");
    write_minimal_box(&strict_root, "1.0.0");
    write(&strict_root, "assets/in.bin", b"in-resource");
    write(&strict_root, "stray.txt", b"orphan");
    write(
        &strict_root,
        ".box/structure.yaml",
        b"entries:\n  - entry_id: a1B2c3D4e5\n    url: assets/in.bin\n    enabled: true\n",
    );
    let handle = BoxParser::new(ParseOptions {
        strict: true,
        ..ParseOptions::default()
    })
    .open(&strict_root)
    .expect("打开箱子");
    let _ = handle.structure().expect("结构解析成功");
    let diagnostics = handle.diagnostics();
    let unreferenced = coded(&diagnostics, DOCUMENT_UNREFERENCED_FILE);
    assert_eq!(unreferenced.len(), 1, "仅孤儿文件未计入引用集合");
    assert!(unreferenced[0].message.contains("stray.txt"));
    assert!(
        !diagnostics
            .iter()
            .any(|item| item.code == DOCUMENT_UNREFERENCED_FILE
                && item.message.contains("assets/in.bin")),
        "包内引用的目标文件不得判未引用"
    );
    fs::remove_dir_all(strict_root).expect("清理");

    // 条目数量超限：返回限额错误并携带成员定位。
    let limit_root = temp_root("entry-limit");
    write_minimal_box(&limit_root, "1.0.0");
    write(
        &limit_root,
        ".box/structure.yaml",
        r#"entries:
  - entry_id: a1B2c3D4e5
    url: https://example.com/a
    enabled: true
  - entry_id: b1B2c3D4e5
    url: https://example.com/b
    enabled: true
"#,
    );
    let options = ParseOptions {
        limits: ParseLimits {
            max_entry_count: 1,
            ..ParseLimits::default()
        },
        ..ParseOptions::default()
    };
    let handle = BoxParser::new(options).open(&limit_root).expect("打开箱子");
    let error = handle.structure().expect_err("条目超限必须返回限额错误");
    assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
    match error {
        chips_parser::error::DocumentError::LimitExceeded {
            limit,
            actual,
            file,
        } => {
            assert_eq!(limit, "max_entry_count");
            assert!(actual.contains("2 条目"), "实际计数：{actual}");
            assert_eq!(
                file.as_ref().map(|item| item.to_string()),
                Some(".box/structure.yaml".to_owned())
            );
        }
        other => panic!("应为限额错误，实际 {other:?}"),
    }
    fs::remove_dir_all(limit_root).expect("清理");
}

// ---------------------------------------------------------------------------
// §3.6 / §8.4 · 内容单元与布局单元的部分成功
// ---------------------------------------------------------------------------

#[test]
fn 内容单元schema失败占位与读取故障上抛() {
    // 内容文件通过语法但信封类型不符：单元失败占位（非致命）。
    let root = temp_root("content-schema-fail");
    write_minimal_card(&root, "1.0.0", "");
    write(&root, "content/a1B2c3D4e5.yaml", b"card_type: 5\n");
    let handle = open_card(&root);
    let node = handle
        .content(&chips_parser::model::NodeId::new(NODE).expect("测试标识合法"))
        .expect("部分成功：占位模型");
    assert!(matches!(node.value, DocumentValue::Mapping(ref items) if items.is_empty()));
    assert_eq!(node.card_type, "base.text", "占位模型回退结构声明类型");
    let diagnostics = &node.diagnostics;
    let failed = coded(diagnostics, STRUCTURE_NODE_FAILED);
    assert_eq!(failed.len(), 1);
    assert!(failed[0].message.contains("内容节点"));
    assert_eq!(failed[0].pointer.as_deref(), Some("/structure/0"));
    assert!(has_code(diagnostics, SCHEMA_TYPE_MISMATCH));
    fs::remove_dir_all(root).expect("清理");

    // 内容文件在索引建立后被移除：读取故障按真致命上抛。
    let race_root = temp_root("content-io-fail");
    write_minimal_card(&race_root, "1.0.0", "");
    let handle = open_card(&race_root);
    let structure = handle.structure().expect("结构解析成功");
    let StructureModel::Card {
        structure: nodes, ..
    } = structure.as_ref()
    else {
        panic!("卡片结构模型");
    };
    assert!(nodes[0].present, "索引建立时内容文件在册");
    fs::remove_file(race_root.join("content/a1B2c3D4e5.yaml")).expect("移除内容文件");
    let error = handle
        .content(&chips_parser::model::NodeId::new(NODE).expect("测试标识合法"))
        .expect_err("成员读取故障必须上抛");
    assert_eq!(error.code(), DOCUMENT_IO);
    fs::remove_dir_all(race_root).expect("清理");
}

#[test]
fn 布局配置失败臂与限额上抛() {
    // 根节点非映射：空映射占位 + 生效布局不可用。
    let scalar_root = temp_root("layout-scalar");
    write_minimal_box(&scalar_root, "1.0.0");
    write(&scalar_root, ".box/content.yaml", b"just text\n");
    let handle = open_box(&scalar_root);
    let layout = handle.layout_config().expect("部分成功：空映射占位");
    assert!(matches!(layout.as_ref(), DocumentValue::Mapping(items) if items.is_empty()));
    let diagnostics = handle.diagnostics();
    let failed = coded(&diagnostics, STRUCTURE_NODE_FAILED);
    assert_eq!(failed.len(), 1);
    assert!(failed[0]
        .message
        .contains("布局配置单元解析失败，生效布局不可用"));
    assert!(has_code(&diagnostics, YAML_SYNTAX_ERROR));
    fs::remove_dir_all(scalar_root).expect("清理");

    // schema 失败（缺 active_layout_type）：同为空映射占位，诊断文案不同。
    let schema_root = temp_root("layout-schema");
    write_minimal_box(&schema_root, "1.0.0");
    write(
        &schema_root,
        ".box/content.yaml",
        b"layout_configs:\n  grid:\n    schema_version: \"1.0.0\"\n",
    );
    let handle = open_box(&schema_root);
    let layout = handle.layout_config().expect("部分成功：空映射占位");
    assert!(matches!(layout.as_ref(), DocumentValue::Mapping(items) if items.is_empty()));
    let diagnostics = handle.diagnostics();
    let failed = coded(&diagnostics, STRUCTURE_NODE_FAILED);
    assert_eq!(failed.len(), 1);
    assert!(failed[0]
        .message
        .contains("布局配置未通过 schema 校验，生效布局不可用"));
    assert!(has_code(&diagnostics, SCHEMA_REQUIRED_MISSING));
    fs::remove_dir_all(schema_root).expect("清理");

    // 布局文件超字节限额：真致命上抛，且同句柄二次访问返回同一错误。
    let limit_root = temp_root("layout-limit");
    write_minimal_box(&limit_root, "1.0.0");
    let padding = "x".repeat(400);
    write(
        &limit_root,
        ".box/content.yaml",
        format!("active_layout_type: grid\nnote: {padding}\n").as_bytes(),
    );
    let options = ParseOptions {
        limits: ParseLimits {
            max_yaml_bytes: 220,
            ..ParseLimits::default()
        },
        ..ParseOptions::default()
    };
    let handle = BoxParser::new(options).open(&limit_root).expect("打开箱子");
    let error = handle.layout_config().expect_err("布局文件超限必须上抛");
    assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
    assert!(format!("{error}").contains("max_yaml_bytes"));
    let second = handle.layout_config().expect_err("失败结果连同记忆");
    assert_eq!(second.code(), DOCUMENT_LIMIT_EXCEEDED);
    assert!(
        !has_code(&handle.diagnostics(), STRUCTURE_CONTENT_MISSING),
        "限额致命错误不携带结构缺失诊断"
    );
    fs::remove_dir_all(limit_root).expect("清理");
}

// ---------------------------------------------------------------------------
// §6.5 · 严格校验报告状态聚合
// ---------------------------------------------------------------------------

#[test]
fn 严格校验报告聚合错误与警告两态() {
    // 内容单元失败：错误级诊断在严格重扫下不致命，聚合为 Invalid。
    let invalid_root = temp_root("validate-invalid");
    write_minimal_card(&invalid_root, "1.0.0", "");
    write(
        &invalid_root,
        "content/a1B2c3D4e5.yaml",
        b"card_type: base.text\nbroken: [1,\n",
    );
    let handle = open_card(&invalid_root);
    let report = handle.validate().expect("校验成功");
    assert_eq!(report.status, ValidationStatus::Invalid);
    assert_eq!(report.kind, DocumentKind::Card);
    assert_eq!(report.chip_standards_version, "1.0.0");
    assert!(report
        .diagnostics
        .iter()
        .any(|item| item.code == STRUCTURE_NODE_FAILED && item.severity == Severity::Error));
    assert!(has_code(&report.diagnostics, YAML_SYNTAX_ERROR));
    assert_eq!(report.statistics.entry_count, 0);
    assert_eq!(report.statistics.resource_count, 0);
    fs::remove_dir_all(invalid_root).expect("清理");

    // 元数据未知字段：严格重扫把它升级为错误级 → 归一致命而非报告状态；
    // 同时 validate 不改动句柄自身的诊断集合（§6.1 惰性层级隔离）。
    let fatal_root = temp_root("validate-metadata-fatal");
    write_minimal_card(&fatal_root, "1.0.0", "mystery: 1\n");
    let handle = open_card(&fatal_root);
    let before = handle
        .diagnostics()
        .iter()
        .filter(|item| item.code == SCHEMA_UNKNOWN_FIELD)
        .count();
    let error = handle
        .validate()
        .expect_err("元数据严格矛盾上抛而非报告 Invalid");
    assert_eq!(error.code(), DOCUMENT_METADATA_INVALID);
    assert!(has_code(error.diagnostics(), SCHEMA_UNKNOWN_FIELD));
    assert!(has_code(error.diagnostics(), SCHEMA_DEFAULT_APPLIED));
    let after = handle
        .diagnostics()
        .iter()
        .filter(|item| item.code == SCHEMA_UNKNOWN_FIELD)
        .count();
    assert_eq!(before, after, "validate 不得向句柄追加诊断");
    fs::remove_dir_all(fatal_root).expect("清理");

    // 仅警告（清单资源文件缺失）：ValidWithWarnings。
    let warn_root = temp_root("validate-warn");
    write_minimal_card(&warn_root, "1.0.0", "");
    write(
        &warn_root,
        ".card/structure.yaml",
        r#"structure:
  - id: a1B2c3D4e5
    type: base.text
manifest:
  card_count: 1
  resource_count: 1
  resources:
    - path: assets/gone.bin
      size: 4
      type: application/octet-stream
"#,
    );
    let handle = open_card(&warn_root);
    let report = handle.validate().expect("校验成功");
    assert_eq!(report.status, ValidationStatus::ValidWithWarnings);
    assert!(report
        .diagnostics
        .iter()
        .all(|item| item.severity != Severity::Error));
    assert!(report.diagnostics.iter().any(|item| item.code
        == chips_parser::error::DOCUMENT_RESOURCE_FILE_MISSING
        && item.severity == Severity::Warning));
    assert_eq!(report.statistics.resource_count, 1);
    assert_eq!(
        report.statistics.member_count, 3,
        "夹具含元数据、结构与内容三成员"
    );
    fs::remove_dir_all(warn_root).expect("清理");
}

#[test]
fn 内容文件缺失的诊断在两层同源去重() {
    // 结构层与内容占位模型共用构造函数：句柄诊断排序去重后仅一条。
    let root = temp_root("dedup-content-missing");
    write_minimal_card(&root, "1.0.0", "");
    fs::remove_file(root.join("content/a1B2c3D4e5.yaml")).expect("移除内容文件");
    let handle = open_card(&root);
    let _ = handle.structure().expect("结构解析成功");
    let node = handle
        .content(&chips_parser::model::NodeId::new(NODE).expect("测试标识合法"))
        .expect("部分成功");
    assert!(has_code(&node.diagnostics, STRUCTURE_CONTENT_MISSING));
    let _ = handle.content(&chips_parser::model::NodeId::new(NODE).expect("合法"));
    let diagnostics = handle.diagnostics();
    let counted = coded(&diagnostics, STRUCTURE_CONTENT_MISSING);
    assert_eq!(counted.len(), 1, "同指针同消息的诊断只保留一条");
    assert_eq!(counted[0].pointer.as_deref(), Some("/structure/0"));
    assert!(counted[0].message.contains("content/a1B2c3D4e5.yaml"));
    fs::remove_dir_all(root).expect("清理");
}
