//! 模型层公开面补测（任务 #131，《06-文档解析器设计》§11.1/§11.3）。
//!
//! 面向 `src/model/mod.rs` 中未被流水线冒烟路径覆盖的访问器与值树方法：
//! `DocumentKind` 成员路径族、`NodeId` 构造/Display/反序列化、`Tag` 键值
//! 拆分、`DocumentMetadata`/`StructureModel` 双变体访问器、`ContentIndex`
//! 索引面与序列化顺序、`DocumentValue` 全套读取器/指针/JSON 互转。
//! 全部为真实行为断言（精确值比较），不做无断言调用刷行。

use std::sync::Arc;

use chips_parser::error::{Diagnostic, Severity};
use chips_parser::model::{
    AgeRating, BoxMetadata, CardMetadata, ContentIndex, ContentNode, DocumentKind, DocumentValue,
    Entry, ManifestResource, NodeId, ParseLimits, ParseOptions, ScanLimits, StructureEntry,
    StructureManifest, StructureModel, Tag, ValidationStatus, Visibility, CARD_CONTENT_DIR,
};
use chips_parser::source::{MemberFingerprint, PackagePath, SourceFingerprint, SourceKind};

fn node_id(text: &str) -> NodeId {
    NodeId::new(text).expect("测试内固定 10 位 Base62 标识")
}

fn package_path(raw: &str) -> PackagePath {
    PackagePath::new(raw).expect("测试内合法包内路径")
}

fn card_metadata() -> CardMetadata {
    CardMetadata {
        chip_standards_version: "1.0.0".to_owned(),
        card_id: "a1B2c3D4e5".to_owned(),
        name: "模型面卡片".to_owned(),
        created_at: "2026-01-01T00:00:00Z".to_owned(),
        modified_at: "2026-01-02T00:00:00Z".to_owned(),
        cover_ratio: Some("3:4".to_owned()),
        tags: vec![Tag::Simple("food".to_owned())],
        theme: None,
        visibility: Some(Visibility::Public),
        downloadable: Some(true),
        remixable: None,
        commentable: None,
        license: None,
        age_rating: Some(AgeRating::Pg13),
        content_warning: None,
        file_info: None,
    }
}

fn box_metadata(tags: Option<Vec<Tag>>) -> BoxMetadata {
    BoxMetadata {
        chip_standards_version: "1.0.0".to_owned(),
        box_id: "z9Y8x7W6v5".to_owned(),
        name: "模型面箱子".to_owned(),
        created_at: "2026-01-01T00:00:00Z".to_owned(),
        modified_at: "2026-01-02T00:00:00Z".to_owned(),
        active_layout_type: "grid".to_owned(),
        description: None,
        tags,
        cover_ratio: None,
        cover_asset: None,
        owner: None,
        source: None,
    }
}

#[test]
fn 文档类别成员路径族() {
    assert_eq!(DocumentKind::Card.metadata_file(), ".card/metadata.yaml");
    assert_eq!(DocumentKind::Box.metadata_file(), ".box/metadata.yaml");
    assert_eq!(DocumentKind::Card.structure_file(), ".card/structure.yaml");
    assert_eq!(DocumentKind::Box.structure_file(), ".box/structure.yaml");
    assert_eq!(DocumentKind::Card.cover_file(), ".card/cover.html");
    assert_eq!(DocumentKind::Box.cover_file(), ".box/cover.html");
    assert_eq!(DocumentKind::Card.extension(), ".card");
    assert_eq!(DocumentKind::Box.extension(), ".box");
    assert_eq!(DocumentKind::Card.config_dir(), ".card");
    assert_eq!(DocumentKind::Box.config_dir(), ".box");
}

#[test]
fn 节点标识构造校验与内容路径() {
    assert!(NodeId::new("a1B2c3D4e5").is_some());
    assert!(NodeId::new("0123456789").is_some());
    // 长度不足 / 超长 / 含非字母数字各判一次。
    assert!(NodeId::new("a1B2c3D4e").is_none());
    assert!(NodeId::new("a1B2c3D4e5f").is_none());
    assert!(NodeId::new("a1B2c3D4e-").is_none());
    assert!(NodeId::new("").is_none());
    let id = node_id("a1B2c3D4e5");
    assert_eq!(id.as_str(), "a1B2c3D4e5");
    assert_eq!(id.to_string(), "a1B2c3D4e5");
    assert_eq!(
        id.content_file().as_str(),
        format!("{CARD_CONTENT_DIR}/a1B2c3D4e5.yaml")
    );
    assert_eq!(id.content_file().parent().unwrap().as_str(), "content");
}

#[test]
fn 节点标识反序列化双向() {
    let text = "\"a1B2c3D4e5\"";
    let decoded: NodeId = serde_json::from_str(text).unwrap();
    assert_eq!(decoded, node_id("a1B2c3D4e5"));
    assert_eq!(serde_json::to_string(&decoded).unwrap(), text);
    let err = serde_json::from_str::<NodeId>("\"too-short\"").unwrap_err();
    assert!(err.to_string().contains("10 位 Base62"));
}

#[test]
fn 标签键值拆分含空结构化标签() {
    let simple = Tag::Simple("travel".to_owned());
    assert_eq!(simple.key(), "travel");
    assert!(simple.values().is_empty());
    let structured = Tag::Structured(vec![
        "city".to_owned(),
        "hangzhou".to_owned(),
        "west-lake".to_owned(),
    ]);
    assert_eq!(structured.key(), "city");
    assert_eq!(structured.values().len(), 2);
    assert_eq!(structured.values()[0], "hangzhou");
    // 仅含键的结构化标签退化为无值，不 panic。
    let key_only = Tag::Structured(vec!["lonely".to_owned()]);
    assert_eq!(key_only.key(), "lonely");
    assert!(key_only.values().is_empty());
    // 空数组标签：键为空串、值为空。
    let empty = Tag::Structured(Vec::new());
    assert_eq!(empty.key(), "");
    assert!(empty.values().is_empty());
    // 反序列化按 untagged 顺序判别：字符串 → Simple，数组 → Structured。
    let tags: Vec<Tag> =
        serde_json::from_str("[\"travel\",[\"city\",\"hangzhou\",\"west-lake\"]]").unwrap();
    assert_eq!(tags[0], simple);
    assert_eq!(tags[1], structured);
}

#[test]
fn 元数据统一访问器卡片侧() {
    use chips_parser::model::DocumentMetadata;
    let metadata = DocumentMetadata::Card(card_metadata());
    assert_eq!(metadata.kind(), DocumentKind::Card);
    assert_eq!(metadata.chip_standards_version(), "1.0.0");
    assert_eq!(metadata.document_id(), "a1B2c3D4e5");
    assert_eq!(metadata.name(), "模型面卡片");
    assert_eq!(metadata.cover_ratio(), Some("3:4"));
    assert_eq!(metadata.tags().len(), 1);
    assert_eq!(metadata.tags()[0].key(), "food");
}

#[test]
fn 元数据统一访问器箱子侧含缺省标签() {
    use chips_parser::model::DocumentMetadata;
    let with_tags = DocumentMetadata::Box(box_metadata(Some(vec![Tag::Structured(vec![
        "k".to_owned(),
        "v".to_owned(),
    ])])));
    assert_eq!(with_tags.kind(), DocumentKind::Box);
    assert_eq!(with_tags.document_id(), "z9Y8x7W6v5");
    assert_eq!(with_tags.name(), "模型面箱子");
    assert_eq!(with_tags.cover_ratio(), None);
    assert_eq!(with_tags.tags().len(), 1);
    assert_eq!(with_tags.tags()[0].key(), "k");
    // 箱子 tags 缺省视为空集合。
    let without_tags = DocumentMetadata::Box(box_metadata(None));
    assert!(without_tags.tags().is_empty());
}

#[test]
fn 元数据枚举序列化带kind判别壳() {
    use chips_parser::model::DocumentMetadata;
    let metadata = DocumentMetadata::Card(card_metadata());
    let json = serde_json::to_value(&metadata).unwrap();
    assert_eq!(json["kind"], "card");
    assert_eq!(json["value"]["card_id"], "a1B2c3D4e5");
    assert_eq!(json["value"]["visibility"], "public");
    assert_eq!(json["value"]["age_rating"], "pg13");
}

#[test]
fn 结构模型双变体访问器() {
    let entry = StructureEntry {
        node_id: node_id("a1B2c3D4e5"),
        card_type: "BasicText".to_owned(),
        file: package_path("content/a1B2c3D4e5.yaml"),
        present: true,
    };
    let manifest = StructureManifest {
        card_count: 1,
        resource_count: 1,
        resources: vec![ManifestResource {
            path: package_path("assets/a.png"),
            size: 128,
            mime_type: "image/png".to_owned(),
            duration: None,
            width: Some(100),
            height: Some(80),
            language: None,
            checksum: None,
        }],
    };
    let card_model = StructureModel::Card {
        structure: vec![entry],
        manifest,
    };
    assert_eq!(card_model.kind(), DocumentKind::Card);
    assert_eq!(card_model.node_count(), 1);
    assert_eq!(card_model.entry_count(), 0);
    assert_eq!(card_model.resources().len(), 1);
    assert_eq!(card_model.resources()[0].path.as_str(), "assets/a.png");

    let box_model = StructureModel::Box {
        entries: vec![
            Entry {
                entry_id: "e1".to_owned(),
                url: "card://a1B2c3D4e5".to_owned(),
                enabled: true,
                snapshot: None,
                layout_hints: None,
            },
            Entry {
                entry_id: "e2".to_owned(),
                url: "asset://assets/a.png".to_owned(),
                enabled: false,
                snapshot: Some(DocumentValue::Integer(1)),
                layout_hints: Some(DocumentValue::Null),
            },
        ],
        diagnostics: vec![Diagnostic::new(
            Severity::Warning,
            "ENTRY_TARGET_MISSING",
            "测试诊断",
        )],
    };
    assert_eq!(box_model.kind(), DocumentKind::Box);
    assert_eq!(box_model.node_count(), 0);
    assert_eq!(box_model.entry_count(), 2);
    assert!(box_model.resources().is_empty());
    // 卡片侧清单缺省 resources 也可序列化。
    let empty_manifest = StructureManifest::default();
    assert_eq!(empty_manifest.card_count, 0);
    assert!(empty_manifest.resources.is_empty());
}

#[test]
fn 内容索引构建查询与序列化顺序() {
    let first = Arc::new(ContentNode {
        node_id: node_id("a1B2c3D4e5"),
        file: package_path("content/a1B2c3D4e5.yaml"),
        card_type: "BasicText".to_owned(),
        value: DocumentValue::Mapping(vec![(
            "card_type".to_owned(),
            DocumentValue::String("BasicText".to_owned()),
        )]),
        diagnostics: Vec::new(),
    });
    let second = Arc::new(ContentNode {
        node_id: node_id("z9Y8x7W6v5"),
        file: package_path("content/z9Y8x7W6v5.yaml"),
        card_type: "BasicImage".to_owned(),
        value: DocumentValue::Null,
        diagnostics: vec![Diagnostic::new(
            Severity::Error,
            "STRUCTURE_NODE_FAILED",
            "占位",
        )],
    });
    let index = ContentIndex::new(vec![
        (node_id("a1B2c3D4e5"), Arc::clone(&first)),
        (node_id("z9Y8x7W6v5"), Arc::clone(&second)),
    ]);
    assert_eq!(index.len(), 2);
    assert!(!index.is_empty());
    assert!(ContentIndex::new(Vec::new()).is_empty());
    assert_eq!(
        index.get(&node_id("z9Y8x7W6v5")).unwrap().card_type,
        "BasicImage"
    );
    assert!(index.get(&node_id("q1W2e3R4t5")).is_none());
    let ids: Vec<String> = index.iter().map(|(id, _)| id.to_string()).collect();
    assert_eq!(ids, vec!["a1B2c3D4e5", "z9Y8x7W6v5"]);
    assert_eq!(index.as_slice().len(), 2);
    // 序列化按结构顺序输出节点数组。
    let json = serde_json::to_value(&index).unwrap();
    assert_eq!(json.as_array().unwrap().len(), 2);
    assert_eq!(json[0]["node_id"], "a1B2c3D4e5");
    assert_eq!(json[1]["card_type"], "BasicImage");
    // 内存粗算 = 值树 + 诊断占位。
    assert!(second.memory_hint() >= first.memory_hint());
    assert!(first.memory_hint() >= "card_type".len() + 32 + 24);
}

#[test]
fn 修订指纹摘要确定性与选项默认值() {
    let fingerprint = SourceFingerprint {
        kind: SourceKind::Directory,
        members: vec![
            (
                package_path(".card/metadata.yaml"),
                MemberFingerprint {
                    size: 10,
                    modified_millis: Some(1),
                    crc32: None,
                },
            ),
            (
                package_path(".card/structure.yaml"),
                MemberFingerprint {
                    size: 20,
                    modified_millis: None,
                    crc32: Some(42),
                },
            ),
        ],
    };
    let left = chips_parser::model::DocumentRevision::new(fingerprint.clone(), "1.0.0");
    let right = chips_parser::model::DocumentRevision::new(fingerprint, "1.0.0");
    assert_eq!(left, right);
    assert_eq!(left.index_digest.len(), 64);
    assert!(left.index_digest.chars().all(|c| c.is_ascii_hexdigit()));
    let limits = ParseLimits::default();
    assert_eq!(limits.max_yaml_bytes, 8 * 1024 * 1024);
    assert_eq!(limits.max_entry_count, 10_000);
    assert_eq!(limits.max_uncompressed_bytes, 512 * 1024 * 1024);
    assert_eq!(limits.max_compression_ratio, 200);
    assert_eq!(limits.max_aliases, 1_000);
    assert_eq!(limits.max_depth, 32);
    let options = ParseOptions::default();
    assert!(!options.strict);
    assert!(options.repair);
    assert!(!options.verify_hashes);
    assert_eq!(options.parallelism, 4);
    assert_eq!(options.limits, limits);
    let scan = ScanLimits::default();
    assert_eq!(scan.max_depth, 32);
    assert_eq!(scan.node_budget, limits.max_yaml_bytes / 8);
    // ValidationStatus 序列化为小写口径。
    assert_eq!(
        serde_json::to_value(ValidationStatus::ValidWithWarnings).unwrap(),
        serde_json::json!("validwithwarnings")
    );
    let decoded: ValidationStatus = serde_json::from_str("\"invalid\"").unwrap();
    assert_eq!(decoded, ValidationStatus::Invalid);
}

#[test]
fn 值树标量读取器各型() {
    assert!(DocumentValue::null().is_null());
    assert_eq!(DocumentValue::Null.type_name(), "null");
    assert_eq!(DocumentValue::Bool(true).type_name(), "boolean");
    assert_eq!(DocumentValue::Integer(-7).type_name(), "integer");
    assert_eq!(DocumentValue::Float(1.5).type_name(), "number");
    assert_eq!(DocumentValue::String("s".into()).type_name(), "string");
    assert_eq!(DocumentValue::Sequence(vec![]).type_name(), "array");
    assert_eq!(DocumentValue::Mapping(vec![]).type_name(), "object");
    assert_eq!(DocumentValue::String("hi".into()).as_str(), Some("hi"));
    assert_eq!(DocumentValue::Integer(1).as_str(), None);
    assert_eq!(DocumentValue::Bool(false).as_bool(), Some(false));
    assert_eq!(DocumentValue::Null.as_bool(), None);
    assert_eq!(DocumentValue::Integer(9).as_i64(), Some(9));
    assert_eq!(DocumentValue::Float(9.0).as_i64(), None);
    assert_eq!(DocumentValue::Integer(9).as_f64(), Some(9.0));
    assert_eq!(DocumentValue::Float(2.5).as_f64(), Some(2.5));
    assert_eq!(DocumentValue::String("2.5".into()).as_f64(), None);
}

#[test]
fn 值树容器读取与键序() {
    let mapping = DocumentValue::Mapping(vec![
        ("b".to_owned(), DocumentValue::Integer(1)),
        ("a".to_owned(), DocumentValue::String("x".to_owned())),
    ]);
    assert_eq!(mapping.get("b").unwrap().as_i64(), Some(1));
    assert!(mapping.get("missing").is_none());
    assert_eq!(DocumentValue::Null.get("b"), None);
    assert_eq!(mapping.as_mapping().unwrap().len(), 2);
    assert!(mapping.as_sequence().is_none());
    let keys: Vec<&str> = mapping.keys().unwrap().collect();
    assert_eq!(keys, vec!["b", "a"]);
    assert!(DocumentValue::Null.keys().is_none());
    let sequence = DocumentValue::Sequence(vec![DocumentValue::Null, mapping.clone()]);
    assert_eq!(sequence.as_sequence().unwrap().len(), 2);
    assert!(sequence.as_mapping().is_none());
    assert!(sequence.keys().is_none());
}

#[test]
fn 值树指针寻址与转义() {
    let value = DocumentValue::Mapping(vec![(
        "items".to_owned(),
        DocumentValue::Sequence(vec![DocumentValue::Mapping(vec![
            ("a/b".to_owned(), DocumentValue::Integer(1)),
            ("m~n".to_owned(), DocumentValue::Integer(2)),
        ])]),
    )]);
    assert_eq!(value.pointer("/items/0/a~1b").unwrap().as_i64(), Some(1));
    assert_eq!(value.pointer("/items/0/m~0n").unwrap().as_i64(), Some(2));
    // 无前置斜杠的指针同样按 token 序列解析。
    assert_eq!(
        value
            .pointer("items/0")
            .unwrap()
            .as_mapping()
            .unwrap()
            .len(),
        2
    );
    // 越界、非数字、标量继续下钻均返回 None。
    assert!(value.pointer("/items/9").is_none());
    assert!(value.pointer("/items/x").is_none());
    assert!(value.pointer("/items/0/a~1b/deeper").is_none());
    assert!(value.pointer("/nope").is_none());
    // 空指针按「取键名为 "" 的映射项」处理：本树无空键，故未命中。
    assert!(value.pointer("").is_none());
}

#[test]
fn 值树深度节点数与内存估算() {
    assert_eq!(DocumentValue::Null.depth(), 1);
    assert_eq!(DocumentValue::Sequence(vec![]).depth(), 1);
    let nested = DocumentValue::Mapping(vec![(
        "k".to_owned(),
        DocumentValue::Sequence(vec![DocumentValue::Integer(1)]),
    )]);
    assert_eq!(nested.depth(), 3);
    assert_eq!(nested.node_count(), 3);
    assert_eq!(DocumentValue::Null.node_count(), 1);
    assert_eq!(DocumentValue::String("abcd".into()).estimated_bytes(), 36);
    assert_eq!(DocumentValue::Bool(true).estimated_bytes(), 24);
    // 序列 = 子项之和 + 32；映射 = 键长 + 值 + 48 求和 + 32。
    assert_eq!(
        DocumentValue::Sequence(vec![DocumentValue::Null]).estimated_bytes(),
        24 + 32
    );
    assert_eq!(
        DocumentValue::Mapping(vec![("kk".to_owned(), DocumentValue::Null)]).estimated_bytes(),
        2 + 24 + 48 + 32
    );
}

#[test]
fn 值树json互转全支与nan降级() {
    let value = DocumentValue::Mapping(vec![
        ("null".to_owned(), DocumentValue::Null),
        ("bool".to_owned(), DocumentValue::Bool(true)),
        ("int".to_owned(), DocumentValue::Integer(-3)),
        ("float".to_owned(), DocumentValue::Float(0.25)),
        ("str".to_owned(), DocumentValue::String("s".to_owned())),
        (
            "seq".to_owned(),
            DocumentValue::Sequence(vec![DocumentValue::Integer(1)]),
        ),
    ]);
    let json = value.to_json();
    assert!(json["null"].is_null());
    assert_eq!(json["bool"], true);
    assert_eq!(json["int"], -3);
    assert_eq!(json["float"], 0.25);
    assert_eq!(json["str"], "s");
    assert_eq!(json["seq"][0], 1);
    // 非有限浮点降级为 JSON null。
    assert!(DocumentValue::Float(f64::NAN).to_json().is_null());
    assert!(DocumentValue::Float(f64::INFINITY).to_json().is_null());
    // from_json：整数保持整数语义，浮点走 f64 分支。
    let source: serde_json::Value = serde_json::from_str(
        r#"{"i":7,"f":1.5,"s":"t","b":false,"n":null,"a":[1,2],"o":{"x":"y"}}"#,
    )
    .unwrap();
    let back = DocumentValue::from_json(&source);
    assert_eq!(back.get("i").unwrap().as_i64(), Some(7));
    assert_eq!(back.get("f").unwrap().type_name(), "number");
    assert_eq!(back.get("f").unwrap().as_f64(), Some(1.5));
    assert_eq!(back.get("s").unwrap().as_str(), Some("t"));
    assert_eq!(back.get("b").unwrap().as_bool(), Some(false));
    assert!(back.get("n").unwrap().is_null());
    assert_eq!(back.get("a").unwrap().as_sequence().unwrap().len(), 2);
    assert_eq!(back.get("o").unwrap().get("x").unwrap().as_str(), Some("y"));
    // 往返一致（映射经 serde_json 后顺序不承诺，逐项比较）。
    let round = DocumentValue::from_json(&value.to_json());
    for (key, item) in value.as_mapping().unwrap() {
        assert_eq!(round.get(key).unwrap(), item);
    }
}

#[test]
fn 值树序列化与反序列化() {
    let value = DocumentValue::Mapping(vec![
        ("num".to_owned(), DocumentValue::Integer(42)),
        (
            "list".to_owned(),
            DocumentValue::Sequence(vec![DocumentValue::Bool(false), DocumentValue::Null]),
        ),
    ]);
    let json = serde_json::to_string(&value).unwrap();
    let decoded: DocumentValue = serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.get("num").unwrap().as_i64(), Some(42));
    let list = decoded.get("list").unwrap().as_sequence().unwrap();
    assert_eq!(list[0], DocumentValue::Bool(false));
    assert!(list[1].is_null());
    // 标量单独往返。
    let text: DocumentValue = serde_json::from_str("\"hello\"").unwrap();
    assert_eq!(text, DocumentValue::String("hello".to_owned()));
    let floaty: DocumentValue = serde_json::from_str("2.5").unwrap();
    assert_eq!(floaty, DocumentValue::Float(2.5));
    assert_eq!(serde_json::to_string(&DocumentValue::Null).unwrap(), "null");
}
