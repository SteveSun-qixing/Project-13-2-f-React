//! 缓存单元面补测（任务 #131，《06-文档解析器设计》§5.3）。
//!
//! 内联单测已覆盖命中/未命中/淘汰主链，本文件补齐差集面：
//! `ParsedUnit` 五个变体的 `memory_bytes`/`value_type_id`/`as_*` 读取器、
//! 同键覆写时的内存回冲、超配额 `insert_document` 拒写、
//! 文档级条目优先淘汰次序、`ParseCache` 手工 `Debug` 观测面。
//! 防御分支定性说明见文末注释与 `/tmp/t131_findings.md`。

use std::any::TypeId;
use std::sync::Arc;

use chips_parser::cache::{ParseCache, ParsedUnit};
use chips_parser::model::{
    BoxMetadata, ContentNode, DocumentMetadata, DocumentValue, Entry, NodeId, ParseLimits,
    ParseOptions, SourceFingerprint, StructureManifest, StructureModel,
};
use chips_parser::source::{MemberFingerprint, PackagePath, SourceKind};

fn options() -> ParseOptions {
    ParseOptions::default()
}

fn fingerprint(size: u64) -> MemberFingerprint {
    MemberFingerprint {
        size,
        modified_millis: None,
        crc32: None,
    }
}

fn path(raw: &str) -> PackagePath {
    PackagePath::new(raw).expect("测试内合法路径")
}

fn metadata_unit() -> ParsedUnit {
    ParsedUnit::Metadata(Arc::new(DocumentMetadata::Box(BoxMetadata {
        chip_standards_version: "1.0.0".to_owned(),
        box_id: "a1B2c3D4e5".to_owned(),
        name: "缓存单元".to_owned(),
        created_at: "2026-01-01T00:00:00Z".to_owned(),
        modified_at: "2026-01-01T00:00:00Z".to_owned(),
        active_layout_type: "grid".to_owned(),
        description: None,
        tags: None,
        cover_ratio: None,
        cover_asset: None,
        owner: None,
        source: None,
    })))
}

fn source(tag: u64) -> SourceFingerprint {
    SourceFingerprint {
        kind: SourceKind::Directory,
        members: vec![(path(".box/metadata.yaml"), fingerprint(tag))],
    }
}

#[test]
fn 单元五变体内存估算与类型标识() {
    let metadata = metadata_unit();
    assert_eq!(metadata.value_type_id(), TypeId::of::<DocumentMetadata>());
    assert!(metadata.memory_bytes() > std::mem::size_of::<DocumentMetadata>());

    let structure = ParsedUnit::Structure(Arc::new(StructureModel::Card {
        structure: Vec::new(),
        manifest: StructureManifest {
            card_count: 0,
            resource_count: 0,
            resources: Vec::new(),
        },
    }));
    assert_eq!(structure.value_type_id(), TypeId::of::<StructureModel>());
    assert!(structure.memory_bytes() > std::mem::size_of::<StructureModel>());

    let content = ParsedUnit::Content(Arc::new(ContentNode {
        node_id: NodeId::new("a1B2c3D4e5").expect("合法标识"),
        file: path("content/a1B2c3D4e5.yaml"),
        card_type: "base.text".to_owned(),
        value: DocumentValue::String("z".repeat(50)),
        diagnostics: Vec::new(),
    }));
    assert_eq!(content.value_type_id(), TypeId::of::<ContentNode>());
    assert!(content.memory_bytes() >= 50 + 32);

    // Entries：快照/布局提示为 None 与 Some 两臂各计一次。
    let entries_bare = ParsedUnit::Entries(Arc::new(vec![Entry {
        entry_id: "e1".to_owned(),
        url: "card://a1B2c3D4e5".to_owned(),
        enabled: true,
        snapshot: None,
        layout_hints: None,
    }]));
    assert_eq!(entries_bare.value_type_id(), TypeId::of::<Entry>());
    // 2 + 17 + 64 + Vec 头部。
    assert_eq!(
        entries_bare.memory_bytes(),
        2 + 17 + 64 + std::mem::size_of::<Vec<Entry>>()
    );
    let entries_full = ParsedUnit::Entries(Arc::new(vec![Entry {
        entry_id: "e1".to_owned(),
        url: "card://a1B2c3D4e5".to_owned(),
        enabled: true,
        snapshot: Some(DocumentValue::String("abcd".to_owned())),
        layout_hints: Some(DocumentValue::Null),
    }]));
    assert_eq!(
        entries_full.memory_bytes(),
        entries_bare.memory_bytes() + ("abcd".len() + 32) + 24
    );

    let layout = ParsedUnit::LayoutConfig(Arc::new(DocumentValue::Sequence(vec![
        DocumentValue::Integer(1),
    ])));
    assert_eq!(layout.value_type_id(), TypeId::of::<DocumentValue>());
    assert_eq!(layout.memory_bytes(), 24 + 32);
}

#[test]
fn 单元读取器命中与错型双臂() {
    let metadata = metadata_unit();
    assert!(metadata.as_metadata().is_some());
    assert!(metadata.as_structure().is_none());
    assert!(metadata.as_content().is_none());
    assert!(metadata.as_entries().is_none());
    assert!(metadata.as_layout_config().is_none());

    let structure = ParsedUnit::Structure(Arc::new(StructureModel::Box {
        entries: Vec::new(),
        diagnostics: Vec::new(),
    }));
    assert!(structure.as_structure().is_some());
    assert!(structure.as_metadata().is_none());

    let layout = ParsedUnit::LayoutConfig(Arc::new(DocumentValue::Null));
    assert!(layout.as_layout_config().is_some());
    let entries = ParsedUnit::Entries(Arc::new(Vec::new()));
    assert!(entries.as_entries().is_some());
    assert!(entries.as_entries().unwrap().is_empty());
    let content = ParsedUnit::Content(Arc::new(ContentNode {
        node_id: NodeId::new("a1B2c3D4e5").expect("合法标识"),
        file: path("content/a1B2c3D4e5.yaml"),
        card_type: "x".to_owned(),
        value: DocumentValue::Null,
        diagnostics: Vec::new(),
    }));
    assert!(content.as_content().is_some());
    assert!(content.as_layout_config().is_none());
}

#[test]
fn 同键覆写内存回冲与文档覆写() {
    let cache = ParseCache::new();
    let key_path = path(".box/metadata.yaml");
    let fp = fingerprint(10);
    cache.insert_unit(&key_path, fp, &options(), metadata_unit());
    let (_, _, first_memory) = cache.stats();
    // 覆写同键：单元数不变，内存按新条目重算。
    cache.insert_unit(&key_path, fp, &options(), metadata_unit());
    let (units, documents, memory) = cache.stats();
    assert_eq!((units, documents), (1, 0));
    assert_eq!(memory, first_memory);

    cache.insert_document("/tmp/overwrite.box", &source(1), &options(), Arc::new(1u8));
    let after_doc = cache.stats().2;
    assert!(after_doc > memory);
    // 同键文档覆写不增条目数。
    cache.insert_document(
        "/tmp/overwrite.box",
        &source(1),
        &options(),
        Arc::new(255u8),
    );
    let (units2, documents2, memory2) = cache.stats();
    assert_eq!((units2, documents2), (1, 1));
    assert_eq!(memory2, after_doc);
    assert_eq!(
        cache
            .get_document::<u8>("/tmp/overwrite.box", &source(1), &options())
            .expect("覆写后可读"),
        Arc::new(255u8)
    );
}

#[test]
fn 超配额文档条目拒写与零配额下限() {
    // 配额 1 字节：任何文档条目（u32 计 4 字节）都装不下，必须走拒写分支而非 panic。
    let cache = ParseCache::with_quota(1, 0);
    cache.insert_document("/tmp/tiny.box", &source(1), &options(), Arc::new(7u32));
    assert!(cache.is_empty());
    assert_eq!(cache.stats(), (0, 0, 0));
    // with_quota 的两个零值参数被抬升为 1（无零容量缓存语义）。
    let zero = ParseCache::with_quota(0, 0);
    zero.insert_unit(
        &path(".box/metadata.yaml"),
        fingerprint(1),
        &options(),
        ParsedUnit::LayoutConfig(Arc::new(DocumentValue::Null)),
    );
    // 单元本身 24 字节 > 1 字节配额，同样拒写。
    assert!(zero.is_empty());
}

#[test]
fn 淘汰次序文档级优先于单元级() {
    // 条目上限 1：写入单元时已有的文档条目必须最先被淘汰（§5.3 复用重建）。
    let cache = ParseCache::with_quota(64 * 1024, 1);
    cache.insert_document("/tmp/order.box", &source(1), &options(), Arc::new(1u8));
    assert_eq!(cache.stats().1, 1);
    cache.insert_unit(
        &path(".box/metadata.yaml"),
        fingerprint(1),
        &options(),
        ParsedUnit::LayoutConfig(Arc::new(DocumentValue::Null)),
    );
    let (units, documents, _) = cache.stats();
    assert_eq!((units, documents), (1, 0), "文档条目必须让位");
    assert!(cache
        .get_document::<u8>("/tmp/order.box", &source(1), &options())
        .is_none());
    // 单元内存配额挤兑：内存超限且无文档条目时淘汰最久未用单元。
    let tight = ParseCache::with_quota(200, 100);
    let fp = fingerprint(1);
    let a = path("content/aaaaaaaaaa.yaml");
    let b = path("content/bbbbbbbbbb.yaml");
    let big = |text: &str| {
        ParsedUnit::Content(Arc::new(ContentNode {
            node_id: NodeId::new("a1B2c3D4e5").expect("合法标识"),
            file: path("content/a1B2c3D4e5.yaml"),
            card_type: text.to_owned(),
            value: DocumentValue::String("x".repeat(100)),
            diagnostics: Vec::new(),
        }))
    };
    tight.insert_unit(&a, fp, &options(), big("a"));
    tight.insert_unit(&b, fp, &options(), big("b"));
    let (units, _, memory) = tight.stats();
    assert!(memory <= 200);
    assert!(units >= 1);
    assert!(tight.get_unit(&b, fp, &options()).is_some(), "最新条目保留");
}

#[test]
fn 缓存观测面调试输出只露配额与规模() {
    let cache = ParseCache::with_quota(4096, 32);
    cache.insert_unit(
        &path(".box/content.yaml"),
        fingerprint(3),
        &options(),
        ParsedUnit::LayoutConfig(Arc::new(DocumentValue::Null)),
    );
    let text = format!("{cache:?}");
    assert!(text.contains("ParseCache"));
    assert!(text.contains("max_memory_bytes: 4096"));
    assert!(text.contains("max_entries: 32"));
    assert!(text.contains("units: 1"));
    assert!(text.contains("documents: 0"));
    // 默认配额常量口径。
    assert_eq!(ParseCache::DEFAULT_MEMORY_BYTES, 64 * 1024 * 1024);
    assert_eq!(ParseCache::DEFAULT_MAX_ENTRIES, 4096);
    assert_eq!(ParseCache::default().stats(), (0, 0, 0));
}

#[test]
fn 限额派生面经由公开选项生效() {
    // node_budget / max_single_member_bytes 等派生值经 ParseLimits 口径核对。
    let limits = ParseLimits::default();
    let options = ParseOptions {
        limits: ParseLimits {
            max_yaml_bytes: 1024,
            ..limits
        },
        ..options()
    };
    let cache = ParseCache::new();
    let key = path(".box/content.yaml");
    let fp = fingerprint(1);
    cache.insert_unit(
        &key,
        fp,
        &options,
        ParsedUnit::LayoutConfig(Arc::new(DocumentValue::Null)),
    );
    // parallelism 不入键。
    let parallel = ParseOptions {
        parallelism: 16,
        ..options.clone()
    };
    assert!(cache.get_unit(&key, fp, &parallel).is_some());
    // repair 入键。
    let no_repair = ParseOptions {
        repair: false,
        ..options.clone()
    };
    assert!(cache.get_unit(&key, fp, &no_repair).is_none());
    // verify_hashes 入键。
    let verify = ParseOptions {
        verify_hashes: true,
        ..options.clone()
    };
    assert!(cache.get_unit(&key, fp, &verify).is_none());
}

// 防御分支定性说明（不做假覆盖）：
// - `cache.rs` L479-480：`evict` 中「两级皆空但预算仍超」的提前返回在
//   公开写入面上不可达（任何成功插入的条目自身即占预算，循环顶条件必先
//   收敛），保留为一致性兜底，无法用真实断言触达。
// - `ParsedUnit::memory_bytes` 中 `serde_json::to_vec(...).unwrap_or(0)`
//   的 Err 臂（L113/L118）：Metadata/Structure 均为可序列化冻结模型，
//   正常路径不会失败，属兜底臂。
