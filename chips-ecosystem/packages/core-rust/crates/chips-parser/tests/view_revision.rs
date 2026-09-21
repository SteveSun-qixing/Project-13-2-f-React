//! 视图投影修订号行为级测试（工单037：`buildDocumentView` 修订投影形态）。
//!
//! 权威口径：
//! - 《05-渲染引擎设计》§2.4 第 5 条：`update(view, revision)` 的 `revision`
//!   严格递增，回退或重复被拒；
//! - 《11-文档服务设计》§3.4：会话修订从 1 起（首次成功写入产出 1），渲染
//!   会话视图与编辑链路共享该序列——首开基线为 0（未写状态），回流唯一
//!   时序 `document:write → 写后重建 → update(view, revision)` 下第 k 次
//!   重建恒得 k-1，与写臂交付值精确对位；
//! - Neon 线格式契约 `< 2^53`（packages/native README §五、convert.rs
//!   `MAX_SAFE_INTEGER`）：投影值必须是有界安全整数，禁指纹全域 u64 直投。
//!
//! 夹具一律目录态（与 `pipeline_error_codes.rs` 同纪律），每测试独立小树。

use std::fs;
use std::path::{Path, PathBuf};

use chips_parser::model::ParseOptions;
use chips_parser::{build_document_view, BoxParser, CardParser, DocumentView, SourceKind};

/// JS 安全整数边界（线格式契约上限，`2^53`）。
const MAX_SAFE_INTEGER: u64 = 1 << 53;

/// 10 位 Base62 测试节点标识。
const NODE: &str = "a1B2c3D4e5";

/// 在临时目录开辟一棵独立小树；返回根路径。
fn temp_root(tag: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!(
        "chips-parser-view-revision-{tag}-{}-{:?}",
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

/// 最小合法卡片夹具。
fn write_minimal_card(root: &Path) {
    write(
        root,
        ".card/metadata.yaml",
        format!(
            "chip_standards_version: \"1.0.0\"\n\
             card_id: {NODE}\n\
             name: 修订投影卡片\n\
             created_at: \"2024-01-01T00:00:00Z\"\n\
             modified_at: \"2024-01-02T00:00:00Z\"\n"
        )
        .as_bytes(),
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

/// 最小合法箱子夹具。
fn write_minimal_box(root: &Path) {
    write(
        root,
        ".box/metadata.yaml",
        "chip_standards_version: \"1.0.0\"\n\
         box_id: z9Y8x7W6v5\n\
         name: 修订投影箱子\n\
         created_at: \"2024-01-01T00:00:00Z\"\n\
         modified_at: \"2024-01-02T00:00:00Z\"\n\
         active_layout_type: grid\n"
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

/// 打开卡片句柄（严格入口）。
fn open_card(root: &Path) -> chips_parser::DocumentHandle {
    CardParser::new(ParseOptions::default())
        .open(root)
        .expect("最小卡片夹具必须可打开")
}

/// 打开箱子句柄（严格入口）。
fn open_box(root: &Path) -> chips_parser::DocumentHandle {
    BoxParser::new(ParseOptions::default())
        .open(root)
        .expect("最小箱子夹具必须可打开")
}

/// 取视图修订号并核验线格式边界（每次构建都过一遍 `<2^53` 契约断言）。
fn build_revision(handle: &chips_parser::DocumentHandle, session: u64) -> u64 {
    let view = build_document_view(handle, session)
        .expect("视图构建必须成功（工单037 前恒拒即本锁的复现面）");
    let revision = match &view {
        DocumentView::Card(card) => card.revision,
        DocumentView::Box(box_view) => box_view.revision,
    };
    assert!(
        revision < MAX_SAFE_INTEGER,
        "视图修订必须落在 JS 安全整数线格式契约内：{revision}"
    );
    revision
}

#[test]
fn test_card_first_open_projection_is_session_baseline_zero() {
    // 首开基线：与文档服务会话修订基线（0，首次成功写入产出 1）同序列，
    // 使回流唯一时序的首个 `update(view, 1)` 恒过宿主严格递增锁。
    let root = temp_root("card-baseline");
    write_minimal_card(&root);
    let handle = open_card(&root);
    assert_eq!(build_revision(&handle, 1), 0, "首开必须产出合法基线 0");
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_card_view_revision_strictly_increases_across_consecutive_builds() {
    // 严格递增矩阵：连续 buildDocumentView 逐次 +1，无回退、无重复、无跳号。
    let root = temp_root("card-increment");
    write_minimal_card(&root);
    let handle = open_card(&root);
    let mut previous = None;
    for build in 0..5_u64 {
        let revision = build_revision(&handle, 1);
        assert_eq!(revision, build, "第 {} 次构建恒取会话序列值", build + 1);
        if let Some(last) = previous {
            assert!(revision > last, "跨连续构建必须严格递增（§2.4 第 5 条）");
        }
        previous = Some(revision);
    }
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_card_view_revision_advances_after_write_commit_rebuild() {
    // 写事务提交后的重建视图修订必然大于前值：先开卡取视图（0），
    // 数据源写入一次内容提交（写事务落成员），写后重建必然前进。
    let root = temp_root("card-after-write");
    write_minimal_card(&root);
    let handle = open_card(&root);
    let before = build_revision(&handle, 1);
    write(
        &root,
        "content/a1B2c3D4e5.yaml",
        "card_type: base.text\ntext: 你好（编辑回写）\n".as_bytes(),
    );
    let after = build_revision(&handle, 1);
    assert!(after > before, "写事务提交后视图 revision 必然大于前值");
    // 写后重建句柄视角同样成立（文档服务重锚句柄的会话级对位）。
    let reopened = open_card(&root);
    assert_eq!(build_revision(&reopened, 1), 0, "新句柄即新会话基线");
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_view_field_projection_deterministic_across_builds() {
    // §6.6 规则 5 承载面：修订号是唯一的逐构建序列字段，其余字段投影
    // 对同一层级产物输出确定（源未变时重复构建除 revision 外逐字段一致）。
    let root = temp_root("card-determinism");
    write_minimal_card(&root);
    let handle = open_card(&root);
    let first = match build_document_view(&handle, 1).expect("首开构建必须成功") {
        DocumentView::Card(view) => view,
        DocumentView::Box(_) => panic!("卡片句柄必须产出卡片视图"),
    };
    let second = match build_document_view(&handle, 1).expect("重复构建必须成功") {
        DocumentView::Card(view) => view,
        DocumentView::Box(_) => panic!("卡片句柄必须产出卡片视图"),
    };
    assert_eq!(second.revision, first.revision + 1, "修订号逐构建前进");
    let mut reference = first;
    reference.revision = second.revision;
    assert_eq!(second, reference, "除修订号外字段投影逐字段确定");
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_box_view_revision_same_protocol_as_card() {
    // 箱子视图与卡片视图同序列口径（§6.6 同形态字段，工单037 统一裁定）。
    let root = temp_root("box-protocol");
    write_minimal_box(&root);
    let handle = open_box(&root);
    assert_eq!(build_revision(&handle, 1), 0, "箱子首开同为基线 0");
    assert_eq!(build_revision(&handle, 2), 1, "箱子跨构建同为严格递增");
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_handle_view_revision_and_document_revision_are_decoupled() {
    // 修订身份（无序指纹 DTO，工单034 冻结）与视图投影修订号解耦：
    // `revision()` 对同一句柄确定返回指纹身份，序列源不参与其构建。
    let root = temp_root("decoupled");
    write_minimal_card(&root);
    let handle = open_card(&root);
    let identity = handle.revision();
    assert_eq!(identity.chip_standards_version, "1.0.0");
    assert_eq!(identity.source.kind, SourceKind::Directory);
    assert_eq!(build_revision(&handle, 1), 0);
    assert_eq!(handle.revision(), identity, "指纹身份与取号互不扰动");
    fs::remove_dir_all(root).expect("清理");
}

#[test]
fn test_session_ids_never_leak_into_revision_sequence() {
    // 视图字段不依赖 session（§6.6）：不同会话标识交错的构建共享同一
    // 句柄序列源，取号只随构建推进、与会话号无关。
    let root = temp_root("session-interleave");
    write_minimal_card(&root);
    let handle = open_card(&root);
    assert_eq!(build_revision(&handle, 9_000), 0);
    assert_eq!(build_revision(&handle, 1), 1);
    assert_eq!(build_revision(&handle, 4_000_000), 2);
    fs::remove_dir_all(root).expect("清理");
}
