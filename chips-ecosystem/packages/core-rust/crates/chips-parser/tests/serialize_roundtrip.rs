//! 序列化往返性锁测（任务 #240，工单036 波 C1 核心判据）。
//!
//! 三条锁链全部走 `chips_parser` 公开面：
//!
//! 1. 目录态「文档值 → 成员字节 → 回读全等」：发射产物经解析域权威读侧
//!    `serialize::decode_member_value` 回读，与入参模型逐字段等价；
//! 2. `file_info.total_size` 自引用定点：写盘后声明值等于最终全部成员字节
//!    之和、`checksum` 等于包内容摘要（除 metadata），且以落盘终态再序列化
//!    产出零成员（定点稳定的幂等锁）；
//! 3. ZIP Store 写侧回读对拍（OQ-3 裁定 G）：写侧归档由读侧
//!    `ArchiveSource` 逐成员原样回读，归档态 `total_size` 闭式和与模拟
//!    提交后归档实际字节数相等（RFC 点位四 §7.3 归档态）。

use std::collections::BTreeMap;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chips_parser::serialize::{
    archive_total_size, decode_member_value, member_digest, package_content_digest,
    serialize_document, ContentMemberValue, DocumentSerializeRequest, SerializeForm,
    SerializedMember, ZipArchiveWriter,
};
use chips_parser::source::archive::ArchiveSource;
use chips_parser::source::{DocumentSource, PackagePath};
use chips_parser::{DocumentKind, DocumentValue, ParseLimits};

const OLD_NODE: &str = "a1B2c3D4e5";
const NEW_NODE: &str = "f6G7h8I9j0";
const PHOTO: &[u8] = b"1234567890";

fn temp_root(tag: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!(
        "chips-parser-t240-{tag}-{}-{:?}",
        std::process::id(),
        std::thread::current().id()
    ));
    let _ = fs::remove_dir_all(&base);
    fs::create_dir_all(&base).expect("创建夹具根目录");
    base
}

fn write(root: &Path, relative: &str, bytes: &[u8]) {
    let target = root.join(relative);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).expect("创建成员父目录");
    }
    fs::write(target, bytes).expect("写入成员");
}

fn mapping(pairs: &[(&str, DocumentValue)]) -> DocumentValue {
    DocumentValue::Mapping(
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_owned(), value.clone()))
            .collect(),
    )
}

fn text(value: &str) -> DocumentValue {
    DocumentValue::String(value.to_owned())
}

fn integer(value: i64) -> DocumentValue {
    DocumentValue::Integer(value)
}

/// 固定保存时刻：2026-03-22T08:00:00.000Z（DOS 区间内，纯函数入参）。
fn saved_at() -> SystemTime {
    UNIX_EPOCH + Duration::from_millis(1_774_166_400_000)
}

/// 建立最小目录态卡片夹具（metadata / structure 均为待覆写的旧形）。
fn seed_directory(root: &Path) {
    write(
        root,
        ".card/metadata.yaml",
        "chip_standards_version: \"1.0.0\"\ncard_id: a1B2c3D4e5\nname: 旧名\n".as_bytes(),
    );
    write(root, ".card/structure.yaml", b"structure: []\n");
    write(
        root,
        &format!("content/{OLD_NODE}.yaml"),
        b"card_type: base.image\n",
    );
    write(
        root,
        &format!("content/{NEW_NODE}.yaml"),
        "card_type: base.image\nstale: 旧值\n".as_bytes(),
    );
    write(root, "photo.jpg", PHOTO);
}

/// 与夹具对应的序列化入参：覆写新节点内容，清单复算随动。
fn card_request(local_path: PathBuf, form: SerializeForm) -> DocumentSerializeRequest {
    DocumentSerializeRequest {
        kind: DocumentKind::Card,
        form,
        local_path,
        metadata: mapping(&[
            ("chip_standards_version", text("1.0.0")),
            ("card_id", text(OLD_NODE)),
            ("name", text("序列化夹具")),
            ("created_at", text("2026-01-15T08:00:00.000Z")),
            ("modified_at", text("2026-03-22T08:00:00.000Z")),
        ]),
        structure: mapping(&[
            (
                "structure",
                DocumentValue::Sequence(vec![mapping(&[
                    ("id", text(OLD_NODE)),
                    ("type", text("base.image")),
                ])]),
            ),
            (
                "manifest",
                mapping(&[
                    ("card_count", integer(999)),
                    ("resource_count", integer(999)),
                    (
                        "resources",
                        DocumentValue::Sequence(vec![mapping(&[
                            ("path", text("photo.jpg")),
                            ("size", integer(1)),
                            ("type", text("image/jpeg")),
                        ])]),
                    ),
                ]),
            ),
        ]),
        contents: vec![ContentMemberValue {
            node_id: NEW_NODE.to_owned(),
            value: mapping(&[("card_type", text("base.video"))]),
        }],
        layout_config: None,
        changed_parts: vec![format!("content/{NEW_NODE}.yaml")],
        removed_node_ids: Vec::new(),
    }
}

fn member_bytes<'a>(members: &'a [SerializedMember], path: &str) -> &'a [u8] {
    members
        .iter()
        .find(|member| member.package_path.as_str() == path)
        .unwrap_or_else(|| panic!("产出集缺少 {path}"))
        .bytes
        .as_slice()
}

fn decode(bytes: &[u8], path: &str) -> DocumentValue {
    let file = PackagePath::new(path).expect("合法路径");
    decode_member_value(bytes, &file).expect("发射字节必须可回读")
}

/// 递归收集目录下全部成员（相对路径 → 字节）。
fn collect_members(root: &Path) -> BTreeMap<String, Vec<u8>> {
    fn walk(dir: &Path, base: &Path, sink: &mut BTreeMap<String, Vec<u8>>) {
        for entry in fs::read_dir(dir).expect("遍历目录") {
            let path = entry.expect("目录项").path();
            if path.is_dir() {
                walk(&path, base, sink);
            } else {
                let relative = path.strip_prefix(base).expect("相对路径").display();
                sink.insert(relative.to_string(), fs::read(&path).expect("读成员"));
            }
        }
    }
    let mut sink = BTreeMap::new();
    walk(root, root, &mut sink);
    sink
}

#[test]
fn directory_roundtrip_value_bytes_value_field_by_field() {
    // 锁 1：文档值 → 成员字节 → 回读全等（含未修订成员的字节比对过滤）。
    let root = temp_root("rt-value");
    seed_directory(&root);
    let request = card_request(root.clone(), SerializeForm::Directory);
    let members = serialize_document(&request, saved_at()).expect("序列化成功");
    let new_content_path = format!("content/{NEW_NODE}.yaml");
    let paths: Vec<&str> = members
        .iter()
        .map(|member| member.package_path.as_str())
        .collect();
    assert_eq!(
        paths,
        vec![
            ".card/metadata.yaml",
            ".card/structure.yaml",
            new_content_path.as_str(),
        ],
        "产出集=变更成员+清单依赖成员，按路径升序（未修订的 {OLD_NODE} 被过滤）"
    );

    // 内容成员：回读与入参模型逐字段全等。
    let back = decode(member_bytes(&members, &new_content_path), &new_content_path);
    assert_eq!(back, request.contents[0].value, "内容成员回读必须全等");

    // 元数据：业务字段逐字段全等，`file_info` 为注入区。
    let metadata = decode(
        member_bytes(&members, ".card/metadata.yaml"),
        ".card/metadata.yaml",
    );
    for (key, value) in request.metadata.as_mapping().expect("映射") {
        assert_eq!(metadata.get(key), Some(value), "元数据字段 {key} 回读全等");
    }
    let generated_at = metadata
        .get("file_info")
        .and_then(|info| info.get("generated_at"))
        .and_then(DocumentValue::as_str)
        .expect("generated_at");
    assert_eq!(generated_at, "2026-03-22T08:00:00.000Z");

    // 结构：manifest 复算逐字段核证（尺寸/摘要按真实字节重算）。
    let structure = decode(
        member_bytes(&members, ".card/structure.yaml"),
        ".card/structure.yaml",
    );
    let resources = structure
        .get("manifest")
        .and_then(|manifest| manifest.get("resources"))
        .and_then(DocumentValue::as_sequence)
        .expect("resources");
    assert_eq!(resources.len(), 1);
    assert_eq!(
        resources[0].get("size").and_then(DocumentValue::as_i64),
        Some(PHOTO.len() as i64),
        "尺寸必须按真实字节重算"
    );
    assert_eq!(
        resources[0].get("checksum").and_then(DocumentValue::as_str),
        Some(member_digest(PHOTO).as_str()),
        "摘要必须按真实字节重算"
    );
    assert_eq!(
        structure
            .get("manifest")
            .and_then(|manifest| manifest.get("card_count"))
            .and_then(DocumentValue::as_i64),
        Some(1)
    );
    fs::remove_dir_all(&root).expect("清理夹具");
}

#[test]
fn directory_fixed_point_total_size_checksum_and_idempotence() {
    // 锁 2：定点写盘后 total_size/checksum 与终态字节自洽，二次序列化零产出。
    let root = temp_root("rt-fixedpoint");
    seed_directory(&root);
    let request = card_request(root.clone(), SerializeForm::Directory);
    let members = serialize_document(&request, saved_at()).expect("序列化成功");
    for member in &members {
        write(&root, member.package_path.as_str(), &member.bytes);
    }
    let final_members = collect_members(&root);
    let metadata = decode(
        final_members
            .get(".card/metadata.yaml")
            .expect("metadata 在盘"),
        ".card/metadata.yaml",
    );
    let info = metadata.get("file_info").expect("file_info");
    let declared_total = info
        .get("total_size")
        .and_then(DocumentValue::as_i64)
        .expect("整数");
    let actual_total: u64 = final_members
        .values()
        .map(|bytes| bytes.len() as u64)
        .sum::<u64>();
    assert_eq!(
        declared_total as u64, actual_total,
        "total_size 必须等于最终全部成员字节之和（含 metadata 自身）"
    );
    assert_eq!(
        info.get("file_count").and_then(DocumentValue::as_i64),
        Some(final_members.len() as i64),
        "file_count 必须等于最终成员数"
    );

    // checksum：覆盖除 metadata 外全部成员字节的包内容摘要。
    let owned: Vec<(PackagePath, u64, String)> = final_members
        .iter()
        .filter(|(path, _)| *path != ".card/metadata.yaml")
        .map(|(path, bytes)| {
            let package = PackagePath::new(path).expect("合法");
            (package, bytes.len() as u64, member_digest(bytes))
        })
        .collect();
    let entries: Vec<(&PackagePath, u64, String)> = owned
        .iter()
        .map(|(path, size, digest)| (path, *size, digest.clone()))
        .collect();
    assert_eq!(
        info.get("checksum").and_then(DocumentValue::as_str),
        Some(package_content_digest(&entries).as_str()),
        "checksum 必须等于 §5.5 拼接式的包内容摘要"
    );

    // 幂等锁：以落盘终态为源再序列化 → 全部字节逐字节相同 → 零产出。
    let second = serialize_document(&request, saved_at()).expect("二次序列化成功");
    assert!(
        second.is_empty(),
        "定点稳定后二次序列化必须零产出：{:?}",
        second
            .iter()
            .map(|member| member.package_path.to_string())
            .collect::<Vec<_>>()
    );
    fs::remove_dir_all(&root).expect("清理夹具");
}

/// 终态目录夹具：播种 + 序列化 + 落盘，返回最终成员集（升序）。
fn serialized_directory_state(root: &Path) -> Vec<(PackagePath, Vec<u8>)> {
    seed_directory(root);
    let request = card_request(root.to_path_buf(), SerializeForm::Directory);
    let members = serialize_document(&request, saved_at()).expect("序列化成功");
    for member in &members {
        write(root, member.package_path.as_str(), &member.bytes);
    }
    collect_members(root)
        .into_iter()
        .map(|(path, bytes)| (PackagePath::new(&path).expect("合法"), bytes))
        .collect()
}

fn build_archive(entries: &[(PackagePath, Vec<u8>)]) -> (Vec<u8>, u64) {
    let mut writer = ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at()).expect("写入器");
    for (path, bytes) in entries {
        writer.add_entry(path, bytes).expect("写出成员");
    }
    let total = writer.finish().expect("收尾");
    (writer.into_inner().into_inner(), total)
}

#[test]
fn archive_store_roundtrip_and_closed_form_total_size() {
    // 锁 3：ZIP Store 写侧↔读侧对拍 + 归档态 total_size 闭式和终锁。
    let root = temp_root("rt-archive");
    let final_state = serialized_directory_state(&root);
    let (archive, written_total) = build_archive(&final_state);
    assert_eq!(
        written_total as usize,
        archive.len(),
        "finish 返回的归档总字节必须等于实际写出字节"
    );
    let sizes: Vec<(PackagePath, u64)> = final_state
        .iter()
        .map(|(path, bytes)| (path.clone(), bytes.len() as u64))
        .collect();
    assert_eq!(
        archive_total_size(&sizes).expect("闭式和可解"),
        written_total,
        "闭式和必须与实际写出逐字节一致（RFC §7.3 归档态）"
    );

    // 读侧对拍：写侧产物由 ArchiveSource 逐成员原样回读。
    let source = ArchiveSource::from_bytes(archive.clone(), &ParseLimits::default())
        .expect("读侧必须接受写侧产物");
    for (path, bytes) in &final_state {
        assert_eq!(
            source.read(path).expect("成员读取"),
            *bytes,
            "{} 必须逐字节回读",
            path.as_str()
        );
    }

    // 归档态序列化：覆写一个内容成员后模拟提交重建归档，
    // 声明 total_size 必须等于新归档实际字节数（闭式和正确性终锁）。
    let archive_path = root.join("sample.card");
    fs::write(&archive_path, &archive).expect("落盘归档");
    let mut request = card_request(archive_path.clone(), SerializeForm::Archive);
    request.contents = vec![ContentMemberValue {
        node_id: NEW_NODE.to_owned(),
        value: mapping(&[("card_type", text("base.richtext"))]),
    }];
    let emitted = serialize_document(&request, saved_at()).expect("归档态序列化成功");
    let metadata_member = member_bytes(&emitted, ".card/metadata.yaml");
    let replaced: BTreeMap<String, Vec<u8>> = emitted
        .iter()
        .map(|member| {
            (
                member.package_path.as_str().to_owned(),
                member.bytes.clone(),
            )
        })
        .collect();
    let mut final_after_commit: Vec<(PackagePath, Vec<u8>)> = Vec::new();
    for (path, bytes) in &final_state {
        let bytes = replaced
            .get(path.as_str())
            .cloned()
            .unwrap_or_else(|| bytes.clone());
        final_after_commit.push((path.clone(), bytes));
    }
    final_after_commit
        .sort_by(|left, right| left.0.as_str().as_bytes().cmp(right.0.as_str().as_bytes()));
    let (new_archive, new_total) = build_archive(&final_after_commit);
    let metadata = decode(metadata_member, ".card/metadata.yaml");
    let declared = metadata
        .get("file_info")
        .and_then(|info| info.get("total_size"))
        .and_then(DocumentValue::as_i64)
        .expect("total_size");
    assert_eq!(
        declared as u64, new_total,
        "归档态 total_size 必须等于提交后归档实际字节数"
    );
    // 新归档读侧回读：metadata 成员与产出集逐字节一致。
    let reopened =
        ArchiveSource::from_bytes(new_archive, &ParseLimits::default()).expect("新归档必须可读");
    let path = PackagePath::new(".card/metadata.yaml").expect("合法");
    assert_eq!(
        reopened.read(&path).expect("读 metadata"),
        metadata_member,
        "归档内 metadata 必须与序列化产物逐字节一致"
    );
    fs::remove_dir_all(&root).expect("清理夹具");
}
