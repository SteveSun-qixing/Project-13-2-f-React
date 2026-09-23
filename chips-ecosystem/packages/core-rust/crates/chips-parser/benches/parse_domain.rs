//! 解析域真测点基准（工单056 · 形 B）：`chips-parser` 的 criterion `[[bench]]` 目标。
//!
//! 背景：`open_box_ms` 豁免所引解析域替代证据曾为 `tests/perf` 合成适配器自测值，
//! 工单056 已改判「在册缺测」；形 A（`tests/perf` 真适配器，任务 #243）已落册，
//! 本形 B 在 Rust 解析器 crate 侧补**可重复、非合成的原生测点**（工单056 §四.1）。
//!
//! # 纪律（工单056 §四.3 门禁零扰动）
//!
//! - 本文件**只做测量与落册，不做断言闸**：门禁判定唯一执行位仍在
//!   `tests/perf`（注册表值、算子、历史报告零扰动）；criterion 读数若低于
//!   在册预算，处置是如实记录 + 归因（判例：fps 59.90 严判失败不改闸），
//!   禁改门禁、禁调夹具凑数。
//! - 夹具一律 bench 内**确定性生成**（与形 A `tests/perf/src/real/parse-fixtures.ts`
//!   同族口径：固定保存时刻、固定字节填充 `(i*31+7)%251`、Base62 序号补零、
//!   条目外部绝对 URL 引用），ZIP Store 归档经 crate 自身在册写侧
//!   `serialize::ZipArchiveWriter` 落盘，>1 MB 字节不入库；禁手填假数字。
//!
//! # 场景 ↔ 在册口径对照表
//!
//! 权威预算位：《06-文档解析器设计》§9.2 与 §9.5（criterion 四组基准）；
//! 门禁位：`tests/perf/src/metrics.ts`（median/lte，本表只引用不改值）。
//!
//! | bench 组名（= 注册表指标 ID） | 夹具与测段 | 在册预算 | 形 A 口径对齐 |
//! |---|---|---|---|
//! | `parse_open_ms` | 10 MB 卡片 / 10 000 条目箱子 ZIP 归档打开到 L0（容器索引 + metadata 解析校验） | ≤ 10 ms | `parse_open_ms`＝`openCard`/`openBox` 完整往返 |
//! | `parse_metadata_ms` | `.card/metadata.yaml` / `.box/metadata.yaml` 成员字节单独 YAML 解码 + Schema 校验（§9.5「metadata 单独解析」组） | ≤ 5 ms | 形 A 导出面无独立形（noData 在册）；本形以 crate 公开面补独立测点 |
//! | `parse_structure_ms` | 1 000 节点卡片 structure 解析与节点引用核对（§9.5「1 000 节点卡片」组） | ≤ 10 ms | `parse_structure_ms`＝structure 段 |
//! | `parse_content_yaml_ms` | 10 MB 卡片 1 MiB content YAML 单元解析（L2 触达） | ≤ 60 ms | 形 A 同夹具同 accessor（`documentContent` 段） |
//! | `parse_10mb_ms` | 10 MB 卡片全链：open → structure → content（资源字节不入计时，`validate` 不计入） | ≤ 100 ms | `parse_10mb_ms`＝open→structure→content 全链 |
//! | `parse_entries_10k_ms` | 10 000 条目箱子：open → structure（条目索引解析段，总预算 ≤ 200 ms 口径） | ≤ 100 ms | `parse_entries_10k_ms`＝`openBox`→`documentStructure` 段 |
//!
//! 口径差异如实登记：`parse_metadata_ms` 单独臂经 `serialize::decode_member_value`
//! 走生产同源 YAML 解码器但**不建 SpanIndex**（`schema::validate` 收 `None`，
//! 诊断缺行列定位），与流水线内嵌形态的差异仅此定位辅助；`parse_model_build_ms`
//! 在公开面上融于全链、无独立可测形，**本形如实缺测**（与形 A 同一处置，不折算）。

use std::fs;
use std::hint::black_box;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chips_parser::model::NodeId;
use chips_parser::schema::SchemaMember;
use chips_parser::serialize::{decode_member_value, ZipArchiveWriter};
use chips_parser::{BoxParser, CardParser, DocumentHandle, PackagePath, ParseOptions, Severity};
use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};

/// 卡片身份与节点标识（与形 A 夹具同族字面量，10 位字母数字）。
const PERF_CARD_ID: &str = "PerfCardId";
const PERF_CARD_NODE_ID: &str = "PerfCardN0";
const PERF_LARGE_CARD_ID: &str = "PerfCardK1";
const PERF_BOX_ID: &str = "PerfBox10k";
const PERF_FIXTURE_STANDARDS_VERSION: &str = "1.0.0";
const FIXED_TIMESTAMP_ISO: &str = "2026-09-19T00:00:00.000Z";

/// 规模口径（《06》§9.2：10 MB 卡片＝1 MB YAML + 9 MB 资源；§9.1：条目上限 10 000）。
const PERF_CARD_YAML_TARGET_BYTES: usize = 1024 * 1024;
const PERF_CARD_RESOURCE_BYTES: usize = 9 * 1024 * 1024;
const PERF_BOX_ENTRY_COUNT: usize = 10_000;
const PERF_LARGE_CARD_NODE_COUNT: usize = 1_000;

/// 固定保存时刻：2026-09-19T00:00:00.000Z（Unix 毫秒 1 789 776 000 000，
/// DOS 区间内；与形 A 夹具同一时间戳口径，保证逐字节可复现）。
fn fixed_saved_at() -> SystemTime {
    UNIX_EPOCH + Duration::from_millis(1_789_776_000_000)
}

/// Base62 字母表（与形 A `BASE62_ALPHABET` 同序）。
const BASE62_ALPHABET: &[u8; 62] =
    b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/// 把非负整数确定性地编码为 10 位 Base62 标识（左侧补 `0`，与形 A 同式）。
fn base62_id(index: usize) -> String {
    let mut value = index;
    let mut digits: Vec<u8> = Vec::new();
    loop {
        digits.push(BASE62_ALPHABET[value % 62]);
        value /= 62;
        if value == 0 {
            break;
        }
    }
    let mut text: String = digits.iter().rev().map(|byte| char::from(*byte)).collect();
    while text.len() < 10 {
        text.insert(0, '0');
    }
    text
}

/// 确定性资源字节填充（与形 A 同式：`(index * 31 + 7) % 251`）。
fn deterministic_resource_bytes(size: usize) -> Vec<u8> {
    (0..size)
        .map(|index| ((index * 31 + 7) % 251) as u8)
        .collect()
}

/// 生成 ≥ `target_bytes` 的确定性 Markdown 文本（每行自带序号，无随机源；
/// 与形 A `deterministicMarkdown` 同一族规）。
fn deterministic_markdown(target_bytes: usize) -> String {
    let mut text = String::from("# 性能真测 10 MB 卡片\n\n");
    let mut index = 0usize;
    while text.len() < target_bytes {
        text.push_str(&format!(
            "## 段落 {index:06}\n\n- 行 {index:06}：确定性填充文本，用于把 content YAML 推过 1 MiB 基准口径。\n"
        ));
        index += 1;
    }
    text
}

/// content YAML 块标量缩进（每非空行前置两空格）。
fn indented_block_scalar(markdown: &str) -> String {
    markdown
        .lines()
        .map(|line| {
            if line.is_empty() {
                String::new()
            } else {
                format!("  {line}")
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn cover_html() -> String {
    "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title>Perf Domain Criterion Fixtures</title>\n</head>\n<body>\n  <div>薯片解析域形 B criterion 基准夹具</div>\n</body>\n</html>\n"
        .to_owned()
}

fn card_metadata_yaml(document_id: &str, name: &str) -> String {
    format!(
        "chip_standards_version: \"{PERF_FIXTURE_STANDARDS_VERSION}\"\ncard_id: \"{document_id}\"\nname: \"{name}\"\ncreated_at: \"{FIXED_TIMESTAMP_ISO}\"\nmodified_at: \"{FIXED_TIMESTAMP_ISO}\"\ntheme: \"\"\ncover_ratio: \"3:4\"\ntags: [\"perf\", [\"用途\", \"解析域基准\"]]\nvisibility: \"private\"\ndownloadable: true\nremixable: true\ncommentable: false\n"
    )
}

fn box_metadata_yaml() -> String {
    format!(
        "chip_standards_version: \"{PERF_FIXTURE_STANDARDS_VERSION}\"\nbox_id: \"{PERF_BOX_ID}\"\nname: \"性能基准 10000 条目箱子\"\ncreated_at: \"{FIXED_TIMESTAMP_ISO}\"\nmodified_at: \"{FIXED_TIMESTAMP_ISO}\"\nactive_layout_type: \"chips.layout.list\"\ncover_ratio: \"3:4\"\ndescription: \"薯片解析域形 B criterion 基准箱子夹具（10 000 外部引用条目）\"\ntags: [\"perf\"]\n"
    )
}

/// 10 MB 卡片 structure：单富文本节点 + 9 MiB 在册资源清单（§8.4 资源字节
/// 永不进入解析计时）。
fn card_10mb_structure_yaml() -> String {
    format!(
        "structure:\n  - id: \"{PERF_CARD_NODE_ID}\"\n    type: \"base.richtext\"\nmanifest:\n  card_count: 1\n  resource_count: 1\n  resources:\n    - path: \"perf/blob-0.bin\"\n      size: {}\n      type: \"application/octet-stream\"\n",
        PERF_CARD_RESOURCE_BYTES
    )
}

fn card_content_yaml(node_card_type: &str, markdown: &str) -> String {
    format!(
        "card_type: \"{node_card_type}\"\ncontent_format: \"markdown\"\ncontent_source: \"inline\"\ncontent_text: |-\n{}\nlocale: \"zh-CN\"\ntheme: \"\"\n",
        indented_block_scalar(markdown)
    )
}

/// 1 000 节点卡片 structure：节点 id 取 `base62_id(0..999)`，
/// manifest 计数与结构一致。
fn card_1000_structure_yaml() -> String {
    let mut text = String::from("structure:\n");
    for index in 0..PERF_LARGE_CARD_NODE_COUNT {
        text.push_str(&format!(
            "  - id: \"{}\"\n    type: \"base.richtext\"\n",
            base62_id(index)
        ));
    }
    text.push_str("manifest:\n  card_count: 1000\n  resource_count: 0\n");
    text
}

/// 10 000 条目箱子 structure：全部外部绝对 URL 引用（《箱子文件格式》§13.2
/// 合法形态，解析期不存在包内目标缺失诊断；与形 A 同一口径）。
fn box_10k_structure_yaml() -> String {
    let mut text = String::from("entries:\n");
    for index in 0..PERF_BOX_ENTRY_COUNT {
        let entry_id = base62_id(index);
        text.push_str(&format!(
            "  - entry_id: \"{entry_id}\"\n    url: \"file:///chips-perf-fixture/entries/{entry_id}.card\"\n    enabled: true\n"
        ));
    }
    text
}

fn box_content_yaml() -> String {
    "active_layout_type: \"chips.layout.list\"\nlayout_configs:\n  \"chips.layout.list\":\n    schema_version: \"1.0.0\"\n"
        .to_owned()
}

/// 以 crate 自身 ZIP Store 写侧（`ZipArchiveWriter`，BTreeMap 保证成员路径
/// UTF-8 字节序升序）把成员集落盘为归档文件；返回落盘字节数。
fn write_archive_file(path: &Path, members: &std::collections::BTreeMap<String, Vec<u8>>) -> u64 {
    let mut writer = ZipArchiveWriter::new(Cursor::new(Vec::new()), fixed_saved_at())
        .expect("固定保存时刻在 DOS 区间内，写入器构造必然成功");
    for (name, bytes) in members {
        let package_path = PackagePath::new(name).expect("夹具成员路径为常量族拼接，构造必然合法");
        writer
            .add_entry(&package_path, bytes)
            .expect("夹具成员写入归档");
    }
    let total = writer.finish().expect("归档中央目录与 EOCD 落位");
    let archive_bytes = writer.into_inner().into_inner();
    assert_eq!(
        archive_bytes.len() as u64,
        total,
        "夹具归档字节与写入器收尾核算一致"
    );
    fs::write(path, &archive_bytes).expect("夹具归档落盘");
    total
}

/// 三份基准夹具（真 `.card`/`.box` ZIP 归档字节，运行时确定性生成、不入库；
/// 落位于 `std::env::temp_dir()/chips-parser-t251-parse-domain-<pid>/`）。
struct Fixtures {
    card_10mb: PathBuf,
    card_1000: PathBuf,
    box_10k: PathBuf,
}

fn build_fixtures() -> Fixtures {
    let root = std::env::temp_dir().join(format!(
        "chips-parser-t251-parse-domain-{}",
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).expect("创建夹具根目录");

    let mut card_small_content =
        String::from("确定性短内容填充，供 1 000 节点卡片的每个内容单元复用。\n");
    while card_small_content.len() < 128 {
        card_small_content.push_str("行填充。\n");
    }

    let mut card_10mb_members: std::collections::BTreeMap<String, Vec<u8>> =
        std::collections::BTreeMap::new();
    card_10mb_members.insert(".card/cover.html".to_owned(), cover_html().into_bytes());
    card_10mb_members.insert(
        ".card/metadata.yaml".to_owned(),
        card_metadata_yaml(PERF_CARD_ID, "性能基准 10 MB 卡片").into_bytes(),
    );
    card_10mb_members.insert(
        ".card/structure.yaml".to_owned(),
        card_10mb_structure_yaml().into_bytes(),
    );
    card_10mb_members.insert(
        format!("content/{PERF_CARD_NODE_ID}.yaml"),
        card_content_yaml(
            "base.richtext",
            &deterministic_markdown(PERF_CARD_YAML_TARGET_BYTES),
        )
        .into_bytes(),
    );
    card_10mb_members.insert(
        "perf/blob-0.bin".to_owned(),
        deterministic_resource_bytes(PERF_CARD_RESOURCE_BYTES),
    );

    let mut card_1000_members: std::collections::BTreeMap<String, Vec<u8>> =
        std::collections::BTreeMap::new();
    card_1000_members.insert(".card/cover.html".to_owned(), cover_html().into_bytes());
    card_1000_members.insert(
        ".card/metadata.yaml".to_owned(),
        card_metadata_yaml(PERF_LARGE_CARD_ID, "性能基准 1000 节点卡片").into_bytes(),
    );
    card_1000_members.insert(
        ".card/structure.yaml".to_owned(),
        card_1000_structure_yaml().into_bytes(),
    );
    for index in 0..PERF_LARGE_CARD_NODE_COUNT {
        card_1000_members.insert(
            format!("content/{}.yaml", base62_id(index)),
            card_content_yaml("base.richtext", &card_small_content).into_bytes(),
        );
    }

    let mut box_members: std::collections::BTreeMap<String, Vec<u8>> =
        std::collections::BTreeMap::new();
    box_members.insert(
        ".box/content.yaml".to_owned(),
        box_content_yaml().into_bytes(),
    );
    box_members.insert(".box/cover.html".to_owned(), cover_html().into_bytes());
    box_members.insert(
        ".box/metadata.yaml".to_owned(),
        box_metadata_yaml().into_bytes(),
    );
    box_members.insert(
        ".box/structure.yaml".to_owned(),
        box_10k_structure_yaml().into_bytes(),
    );

    let card_10mb = root.join("perf-card-10mb.card");
    let card_1000 = root.join("perf-card-1000.card");
    let box_10k = root.join("perf-box-10k.box");
    let card_bytes = write_archive_file(&card_10mb, &card_10mb_members);
    let large_bytes = write_archive_file(&card_1000, &card_1000_members);
    let box_bytes = write_archive_file(&box_10k, &box_members);
    assert!(
        card_bytes > 10 * 1024 * 1024 && large_bytes > 100 * 1024 && box_bytes > 1024 * 1024,
        "夹具规模达标（卡片 10 MB 口径 / 1 000 节点 / 10 000 条目）：\
         card={card_bytes}, card1000={large_bytes}, box={box_bytes}"
    );
    Fixtures {
        card_10mb,
        card_1000,
        box_10k,
    }
}

fn fixtures() -> &'static Fixtures {
    static FIXTURES: OnceLock<Fixtures> = OnceLock::new();
    FIXTURES.get_or_init(build_fixtures)
}

fn default_options() -> ParseOptions {
    ParseOptions::default()
}

/// 句柄诊断面自检：夹具必须零错误级诊断（读侧真验收，非假数冒领）。
fn assert_no_error_diagnostics(handle: &DocumentHandle, what: &str) {
    let offenders: Vec<&'static str> = handle
        .diagnostics()
        .iter()
        .filter(|item| item.severity == Severity::Error)
        .map(|item| item.code)
        .collect();
    assert!(offenders.is_empty(), "{what} 出现错误级诊断：{offenders:?}");
}

/// 从已打开句柄经资源出口读回成员字节（成员在归档索引内，L3 出口对配置
/// 成员同样可用；夹具真字节的取用路径）。
fn read_member_bytes(handle: &DocumentHandle, raw_path: &str) -> Vec<u8> {
    let path = PackagePath::new(raw_path).expect("常量为合法包内路径");
    let mut stream = handle
        .read_resource(&path, None)
        .unwrap_or_else(|error| panic!("读取成员 {raw_path} 失败：{error}"));
    stream.read_to_vec().expect("成员字节流整读")
}

/// `parse_open_ms`（≤ 10 ms 在册预算）：ZIP 归档打开到 L0＝容器索引 +
/// metadata 解析校验的完整往返（形 A 同一口径）。
fn bench_parse_open(c: &mut Criterion) {
    let f = fixtures();
    let options = default_options();
    let card_parser = CardParser::new(options.clone());
    let box_parser = BoxParser::new(options.clone());
    let mut group = c.benchmark_group("parse_open_ms");
    group.bench_function("card-10mb", |b| {
        b.iter(|| {
            let handle = card_parser
                .open(black_box(&f.card_10mb))
                .expect("10 MB 卡片夹具必然打开到 L0");
            black_box(handle.metadata().chip_standards_version());
        });
    });
    group.bench_function("box-10k", |b| {
        b.iter(|| {
            let handle = box_parser
                .open(black_box(&f.box_10k))
                .expect("10 000 条目箱子夹具必然打开到 L0");
            black_box(handle.metadata().chip_standards_version());
        });
    });
    group.finish();
}

/// `parse_metadata_ms`（≤ 5 ms 在册预算）：metadata 成员单独解析组
/// （§9.5 四组之三「metadata 单独解析」）。测段＝YAML 解码（生产同源
/// `yaml::parse`，经公开面 `decode_member_value`）+ `schema::validate`
/// （repair/strict 取 `ParseOptions::default()` 生产缺省，与打开链路同参）。
fn bench_parse_metadata(c: &mut Criterion) {
    let f = fixtures();
    let options = default_options();
    let card_path = PackagePath::new(".card/metadata.yaml").expect("常量路径合法");
    let box_path = PackagePath::new(".box/metadata.yaml").expect("常量路径合法");
    let card_bytes = read_member_bytes(
        &CardParser::new(options.clone())
            .open(&f.card_10mb)
            .expect("卡片句柄"),
        ".card/metadata.yaml",
    );
    let box_bytes = read_member_bytes(
        &BoxParser::new(options.clone())
            .open(&f.box_10k)
            .expect("箱子句柄"),
        ".box/metadata.yaml",
    );
    let mut group = c.benchmark_group("parse_metadata_ms");
    group.bench_function("card-member-alone", |b| {
        b.iter(|| {
            let value = decode_member_value(black_box(&card_bytes), &card_path)
                .expect("卡片 metadata 成员必然可回读");
            let outcome = schema_validate(&value, SchemaMemberKind::Card, &card_path, &options);
            black_box((outcome.has_errors(), outcome.value))
        });
    });
    group.bench_function("box-member-alone", |b| {
        b.iter(|| {
            let value = decode_member_value(black_box(&box_bytes), &box_path)
                .expect("箱子 metadata 成员必然可回读");
            let outcome = schema_validate(&value, SchemaMemberKind::Box, &box_path, &options);
            black_box((outcome.has_errors(), outcome.value))
        });
    });
    group.finish();
}

/// `SchemaMember` 二选一薄封装（卡片/箱子 metadata 同构校验）。
enum SchemaMemberKind {
    Card,
    Box,
}

fn schema_validate(
    value: &chips_parser::DocumentValue,
    member: SchemaMemberKind,
    file: &PackagePath,
    options: &ParseOptions,
) -> chips_parser::schema::SchemaOutcome {
    let member = match member {
        SchemaMemberKind::Card => SchemaMember::CardMetadata,
        SchemaMemberKind::Box => SchemaMember::BoxMetadata,
    };
    chips_parser::schema::validate(member, value, file, options.repair, options.strict, None)
}

/// `parse_structure_ms`（≤ 10 ms 在册预算）：1 000 节点卡片 structure
/// 解析与节点引用核对（§9.5 四组之二）。测段隔离：每轮 setup 现场打开
/// 句柄（不计费），计费段仅 `structure()` 惰性触发。
fn bench_parse_structure(c: &mut Criterion) {
    let f = fixtures();
    let options = default_options();
    let card_1000 = &f.card_1000;
    let mut group = c.benchmark_group("parse_structure_ms");
    group.bench_function(BenchmarkId::from_parameter("card-1000-nodes"), |b| {
        b.iter_with_setup(
            || {
                let handle = CardParser::new(options.clone())
                    .open(card_1000)
                    .expect("1 000 节点卡片夹具必然打开到 L0");
                assert_no_error_diagnostics(&handle, "打开（1 000 节点卡片）");
                handle
            },
            |handle: DocumentHandle| {
                let structure = handle.structure().expect("structure 必然解析成功");
                black_box(structure.node_count())
            },
        );
    });
    group.finish();
}

/// `parse_content_yaml_ms`（≤ 60 ms 在册预算）：10 MB 卡片 1 MiB content
/// YAML 单元解析（形 A 同夹具同 accessor；在册 measurement 载明「10 MB 全
/// 为 YAML 的最坏情况」，本臂与形 A 一致取 1 MiB 在册口径，差异如实留文）。
/// 测段隔离：setup 打开句柄并预触发 structure，计费段仅 `content(node)`。
fn bench_parse_content(c: &mut Criterion) {
    let f = fixtures();
    let options = default_options();
    let card_10mb = &f.card_10mb;
    let node_id = NodeId::new(PERF_CARD_NODE_ID).expect("常量节点标识合法");
    let mut group = c.benchmark_group("parse_content_yaml_ms");
    group.bench_function(BenchmarkId::from_parameter("card-10mb-node"), |b| {
        b.iter_with_setup(
            || {
                let handle = CardParser::new(options.clone())
                    .open(card_10mb)
                    .expect("10 MB 卡片夹具必然打开到 L0");
                let structure = handle.structure().expect("structure 必然解析成功");
                assert_eq!(structure.node_count(), 1, "10 MB 卡片为单节点口径");
                assert_no_error_diagnostics(&handle, "structure（10 MB 卡片）");
                handle
            },
            |handle: DocumentHandle| {
                let node = handle
                    .content(black_box(&node_id))
                    .expect("内容单元必然解析成功");
                assert!(
                    node.diagnostics
                        .iter()
                        .all(|item| item.severity != Severity::Error),
                    "内容单元零错误级诊断"
                );
                black_box(&node.value);
            },
        );
    });
    group.finish();
}

/// `parse_10mb_ms`（≤ 100 ms 在册预算）：10 MB 卡片全链 open → structure →
/// content（§9.2「10 MB 卡片全量解析合计」；资源字节与严格 `validate` 不计入，
/// 形 A 同一口径）。
fn bench_parse_10mb(c: &mut Criterion) {
    let f = fixtures();
    let options = default_options();
    let card_parser = CardParser::new(options.clone());
    let card_10mb = f.card_10mb.clone();
    let node_id = NodeId::new(PERF_CARD_NODE_ID).expect("常量节点标识合法");
    let mut group = c.benchmark_group("parse_10mb_ms");
    group.bench_function("card-full-chain", |b| {
        b.iter(|| {
            let handle = card_parser
                .open(black_box(&card_10mb))
                .expect("10 MB 卡片夹具必然打开到 L0");
            let structure = handle.structure().expect("structure 必然解析成功");
            let node = handle.content(&node_id).expect("内容单元必然解析成功");
            assert!(
                node.diagnostics
                    .iter()
                    .all(|item| item.severity != Severity::Error),
                "全链内容单元零错误级诊断"
            );
            black_box((structure.node_count(), &node.value));
        });
    });
    group.finish();
}

/// `parse_entries_10k_ms`（≤ 100 ms 在册预算，R18 与《06》§9.2「打开箱子
/// 总预算 ≤ 200 ms」口径）：10 000 条目箱子 open → structure（条目索引
/// 解析段，形 A 同一口径；`entries` 集合即 structure 派生，计数核对入测）。
fn bench_parse_entries(c: &mut Criterion) {
    let f = fixtures();
    let options = default_options();
    let box_parser = BoxParser::new(options.clone());
    let box_10k = f.box_10k.clone();
    let mut group = c.benchmark_group("parse_entries_10k_ms");
    group.bench_function("box-10k-open-structure", |b| {
        b.iter(|| {
            let handle = box_parser
                .open(black_box(&box_10k))
                .expect("10 000 条目箱子夹具必然打开到 L0");
            let structure = handle.structure().expect("structure 必然解析成功");
            let entries = handle
                .entries(None)
                .expect("条目集合必然可读取（structure 已触发）");
            black_box((structure.entry_count(), entries.len()));
        });
    });
    group.finish();
}

criterion_group!(
    name = parse_domain;
    config = Criterion::default();
    targets = bench_parse_open,
        bench_parse_metadata,
        bench_parse_structure,
        bench_parse_content,
        bench_parse_10mb,
        bench_parse_entries
);
criterion_main!(parse_domain);
