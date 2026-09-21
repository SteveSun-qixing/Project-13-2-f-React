//! YAML 层补测（任务 #131，《06-文档解析器设计》§6.2、§3.4）。
//!
//! 两面合一：
//! 1. `SpanIndex::build` 缩进扫描直测（块映射键/块序列元素/引号键/
//!    裸 `-`/块标量跳过/指令行/无键行/未闭合引号/空键等定位臂）；
//! 2. `yaml::parse` 入口限额与归一臂经由公开解析器面触发：
//!    `max_yaml_bytes`/`max_aliases` 超限、BOM 与非法 UTF-8（repair 开/关）、
//!    CRLF 归一信息诊断、根节点非映射、保留扫描语料（注释/引号内 `!`/
//!    行内别名计数）。
//!    `ValueScan` 公开观测面（`nodes`/`current_pointer`）一并直测。

use std::fs;
use std::path::{Path, PathBuf};

use chips_parser::error::{
    Diagnostic, DOCUMENT_LIMIT_EXCEEDED, DOCUMENT_METADATA_INVALID, DOCUMENT_UNICODE_NORMALIZED,
    YAML_SYNTAX_ERROR, YAML_UNSUPPORTED_TAG,
};
use chips_parser::model::{ParseLimits, ParseOptions, ScanLimits};
use chips_parser::yaml::value::{ScanFailure, ValueScan};
use chips_parser::yaml::SpanIndex;
use chips_parser::CardParser;

const NODE: &str = "a1B2c3D4e5";

fn temp_root(tag: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!(
        "chips-parser-t131-yaml-{tag}-{}-{:?}",
        std::process::id(),
        std::thread::current().id()
    ));
    let _ = fs::remove_dir_all(&base);
    fs::create_dir_all(&base).expect("创建夹具根目录");
    base
}

fn write(root: impl AsRef<Path>, relative: &str, bytes: &[u8]) {
    let target = root.as_ref().join(relative);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).expect("创建成员父目录");
    }
    fs::write(target, bytes).expect("写入成员");
}

fn has_code(diagnostics: &[Diagnostic], code: &str) -> bool {
    diagnostics.iter().any(|item| item.code == code)
}

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

/// 只写 metadata 的目录树（限额类断言不需要完整文档）。
fn open_metadata(
    root: &Path,
    metadata: &[u8],
    options: ParseOptions,
) -> Result<(), chips_parser::DocumentError> {
    write(root, ".card/metadata.yaml", metadata);
    CardParser::new(options).open(root).map(drop)
}

// ---------------------------------------------------------------------------
// SpanIndex 直测
// ---------------------------------------------------------------------------

const SPAN_CORPUS: &str = "\
---
# heading comment
top: 1
visit http://example.com no-key line
nested:
  key: v
  list:
    - a
    - b: 2
      c: 3
    -
seq:
- x
quoted:
  \"double key\": 1
  'single': 2
url_like: http://example.com/x
block: |
  line1
  line2
after: 9
\"abc: 1
: v
\"\": 3
outer:
  - tags:
      - deep
trailing: ok
...
after_dots: 1
";

#[test]
fn span索引定位块映射与序列各层() {
    let index = SpanIndex::build(SPAN_CORPUS);
    assert!(!index.is_empty());
    // 顶层键（`---` 与注释行不占位，`top` 在第 3 行）。
    assert_eq!(index.locate("/top"), Some((3, 1)));
    assert_eq!(index.locate("/nested"), Some((5, 1)));
    assert_eq!(index.locate("/nested/key"), Some((6, 3)));
    assert_eq!(index.locate("/nested/list"), Some((7, 3)));
    // 序列元素逐下标登记。
    assert_eq!(index.locate("/nested/list/0"), Some((8, 5)));
    assert_eq!(index.locate("/nested/list/1"), Some((9, 5)));
    assert_eq!(index.locate("/nested/list/1/b"), Some((9, 7)));
    assert_eq!(index.locate("/nested/list/1/c"), Some((10, 7)));
    // 裸 `-` 也占一个下标。
    assert_eq!(index.locate("/nested/list/2"), Some((11, 5)));
    // 零缩进序列挂在键下。
    assert_eq!(index.locate("/seq"), Some((12, 1)));
    assert_eq!(index.locate("/seq/0"), Some((13, 1)));
    // 序列内嵌套序列（帧下钻 + 计数）。
    assert_eq!(index.locate("/outer"), Some((25, 1)));
    assert_eq!(index.locate("/outer/0"), Some((26, 3)));
    assert_eq!(index.locate("/outer/0/tags"), Some((26, 5)));
    assert_eq!(index.locate("/outer/0/tags/0"), Some((27, 7)));
}

#[test]
fn span索引引号键与特殊行处理() {
    let index = SpanIndex::build(SPAN_CORPUS);
    // 单/双引号键按去引号文本登记。
    assert_eq!(index.locate("/quoted/double key"), Some((15, 3)));
    assert_eq!(index.locate("/quoted/single"), Some((16, 3)));
    // 值内含 `http://` 的行不误判为键，键本身正常登记。
    assert_eq!(index.locate("/url_like"), Some((17, 1)));
    assert_eq!(index.locate("/url_like/http"), None);
    // 无键行、未闭合引号行、空键行、引号空键行均不登记。
    assert!(index.locate("/visit http").is_none());
    assert_eq!(index.locate(""), None);
    // 块标量：键登记、内部行与后续行分界正确。
    assert_eq!(index.locate("/block"), Some((18, 1)));
    assert_eq!(index.locate("/after"), Some((21, 1)));
    // `...` 指令行跳过后仍可登记其后的键。
    assert_eq!(index.locate("/trailing"), Some((28, 1)));
    assert_eq!(index.locate("/after_dots"), Some((30, 1)));
    // 未命中返回 None。
    assert!(index.locate("/missing/deep").is_none());
    assert!(SpanIndex::default().is_empty());
    assert_eq!(SpanIndex::default().len(), 0);
    assert!(SpanIndex::default().locate("/top").is_none());
    assert_eq!(SpanIndex::build("").len(), 0);
}

// ---------------------------------------------------------------------------
// ValueScan 观测面
// ---------------------------------------------------------------------------

#[test]
fn 值扫描观测面节点计数与指针复位() {
    let scan = ValueScan::new(ScanLimits::default());
    assert_eq!(scan.nodes(), 0);
    assert_eq!(scan.current_pointer(), "");
    assert_eq!(scan.failure(), None);
    assert_eq!(scan.failure_pointer(), None);
    let mut scan = ValueScan::new(ScanLimits::default());
    let value = chips_parser::yaml::value::from_deserializer(
        serde_yaml::Deserializer::from_str("a: 1\nb:\n  - x\n"),
        &mut scan,
    )
    .expect("语料必须可解析");
    assert_eq!(value.get("a").and_then(|v| v.as_i64()), Some(1));
    // 根层完成后指针回到空串，节点数记账（根映射 + a 值 + b 序列 + 元素 x）。
    assert_eq!(scan.current_pointer(), "");
    assert_eq!(scan.nodes(), 4);
    assert_eq!(scan.failure(), None);
    // 失败指针在深层重复键处落点。
    let mut failed = ValueScan::new(ScanLimits::default());
    let error = chips_parser::yaml::value::from_deserializer(
        serde_yaml::Deserializer::from_str("outer:\n  inner:\n    dup: 1\n    dup: 2\n"),
        &mut failed,
    )
    .expect_err("重复键必须失败");
    assert!(error.to_string().contains("映射键重复"));
    assert_eq!(failed.failure(), Some(ScanFailure::DuplicateKey));
    assert_eq!(failed.failure_pointer(), Some("/outer/inner/dup"));
    assert!(failed.nodes() > 0);
    // 失败文案族。
    assert_eq!(ScanFailure::DepthExceeded.message(), "嵌套深度超出限额");
    assert_eq!(
        ScanFailure::NodeBudgetExceeded.message(),
        "展开节点总数超出限额"
    );
}

// ---------------------------------------------------------------------------
// yaml::parse 入口臂（经公开解析器面）
// ---------------------------------------------------------------------------

#[test]
fn 单文件字节超限走limit_exceeded() {
    let root = temp_root("yaml-bytes");
    let options = ParseOptions {
        limits: ParseLimits {
            max_yaml_bytes: 16,
            ..ParseLimits::default()
        },
        ..ParseOptions::default()
    };
    let error = open_metadata(&root, card_metadata("1.0.0", "").as_bytes(), options)
        .expect_err("超字节限额必须致命");
    assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn 别名计数超限走limit_exceeded() {
    let root = temp_root("yaml-aliases");
    let options = ParseOptions {
        limits: ParseLimits {
            max_aliases: 0,
            ..ParseLimits::default()
        },
        ..ParseOptions::default()
    };
    let text = format!("{}\nanchor: &x 1\nalias: *x\n", card_metadata("1.0.0", ""));
    let error = open_metadata(&root, text.as_bytes(), options).expect_err("别名超限必须致命");
    assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn bom在repair开关下双面() {
    // repair 开启：剥离 BOM 并记信息级归一诊断，文档可开。
    let root = temp_root("yaml-bom-repair");
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend(card_metadata("1.0.0", "").as_bytes());
    write(&root, ".card/metadata.yaml", &bytes);
    write(
        &root,
        ".card/structure.yaml",
        b"structure: []\nmanifest:\n  card_count: 0\n  resource_count: 0\n",
    );
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("repair 模式必须剥 BOM");
    assert!(has_code(&handle.diagnostics(), DOCUMENT_UNICODE_NORMALIZED));
    fs::remove_dir_all(root).expect("清理");

    // repair 关闭：BOM 直接判语法错误且致命。
    let root = temp_root("yaml-bom-strict-repair-off");
    write(&root, ".card/metadata.yaml", &bytes);
    let error = open_metadata(
        &root,
        &bytes,
        ParseOptions {
            repair: false,
            ..ParseOptions::default()
        },
    )
    .expect_err("关 repair 时 BOM 必须致命");
    assert_eq!(error.code(), DOCUMENT_METADATA_INVALID);
    assert!(has_code(error.diagnostics(), YAML_SYNTAX_ERROR));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn 非法utf8字节判语法错误() {
    let root = temp_root("yaml-utf8");
    let mut bytes = b"chip_standards_version: ".to_vec();
    bytes.extend([0xFF, 0xFE, 0x00, 0x80]);
    let error =
        open_metadata(&root, &bytes, ParseOptions::default()).expect_err("非法 UTF-8 必须致命");
    assert_eq!(error.code(), DOCUMENT_METADATA_INVALID);
    assert!(has_code(error.diagnostics(), YAML_SYNTAX_ERROR));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn crlf归一记信息诊断() {
    let root = temp_root("yaml-crlf");
    let text = card_metadata("1.0.0", "").replace('\n', "\r\n");
    write(&root, ".card/metadata.yaml", text.as_bytes());
    write(
        &root,
        ".card/structure.yaml",
        b"structure: []\nmanifest:\n  card_count: 0\n  resource_count: 0\n",
    );
    let handle = CardParser::new(ParseOptions::default())
        .open(&root)
        .expect("CRLF 归一后可开");
    assert!(has_code(&handle.diagnostics(), DOCUMENT_UNICODE_NORMALIZED));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn 根节点非映射判语法错误() {
    let root = temp_root("yaml-root-seq");
    let error =
        open_metadata(&root, b"- 1\n- 2\n", ParseOptions::default()).expect_err("根序列必须致命");
    assert_eq!(error.code(), DOCUMENT_METADATA_INVALID);
    let syntax = error
        .diagnostics()
        .iter()
        .find(|item| item.code == YAML_SYNTAX_ERROR)
        .expect("必须有根节点诊断");
    assert_eq!(syntax.line, Some(1));
    assert_eq!(syntax.column, Some(1));
    assert!(syntax.message.contains("根节点必须是映射"));
    fs::remove_dir_all(root).expect("清理");

    // 根标量同样命中该臂。
    let root = temp_root("yaml-root-scalar");
    let error =
        open_metadata(&root, b"just text\n", ParseOptions::default()).expect_err("根标量必须致命");
    assert!(has_code(error.diagnostics(), YAML_SYNTAX_ERROR));
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn 保留扫描语料覆盖注释引号与标签臂() {
    // 语料设计：注释行内 `!` 不算标签（`#` 先截断）；引号内 `!x`/`*y`
    // 不算保留符；值位 `!tag` 记 YAML_UNSUPPORTED_TAG；`mid*star` 的
    // `*` 前有非空白不算别名；行首 `*alias` 计数。
    let root = temp_root("yaml-reserved");
    let text = format!(
        "{}\n# 注释里有 !bang 与 *star 不算数\nnote: 值里 ! 不算 # tag: after-hash\n\
         quoted: \"!inside *inside\"\nlate: tail*not-alias\nbad_tag: !custom something\n",
        card_metadata("1.0.0", "")
    );
    write(&root, ".card/metadata.yaml", text.as_bytes());
    let error = open_metadata(&root, text.as_bytes(), ParseOptions::default())
        .expect_err("禁用标签必须致命");
    assert!(has_code(error.diagnostics(), YAML_UNSUPPORTED_TAG));
    let tagged = error
        .diagnostics()
        .iter()
        .find(|item| item.code == YAML_UNSUPPORTED_TAG)
        .expect("标签诊断");
    // 行内值位的 `!` 在第 11 行（bad_tag 行），列号为 `!` 的 1 起位置。
    assert_eq!(tagged.line, Some(11));
    assert_eq!(tagged.column, Some(10));
    fs::remove_dir_all(root).expect("清理");
}
