//! 工单036 波 C2a-3 集成锁：归档态**整包重建**写通路
//! （[`ResourceManager::rebuild_archive`]，临时归档整包写出 → 意图账登记 →
//! publish 相 `rename` 原子换代，写出侧消费 `chips-parser` 归档写侧公开面
//! [`chips_parser::serialize::ZipArchiveWriter`]）。
//!
//! 口径要点（与 `tests/changeset_commit.rs` / `tests/journal_recovery.rs` 同
//! 方言）：夹具一律真实临时目录与真实 ZIP Store 归档（Drop 自清），归档夹具
//! 由解析器写侧产出（不在本 crate 自造 ZIP 字节）；「崩溃」以协议落盘时序的
//! 磁盘终态复现（prepare 相意图记录先于临时物在册、终结未及），不 mock 运行
//! 时；恢复闭环由归档挂载即扫（`mount_archive` →
//! [`chips_resource::recover_package_slot`]）承担。错误码零新增（《06.02》
//! §2.4 九词冻结，失败臂一律在册词表）。
//!
//! 判据分组：
//! ① 整包重建往返与换代后读面即新包（覆写 + 新增 + 删除 + 未变更成员
//!    常内存流式复用逐字节等同）；
//! ② prepare 窗口崩溃残骸由挂载槽位扫描收敛旧态（正式归档零触碰、零残留）；
//! ③ 失败臂全不现（尺寸/歧义/缺失删除目标拒绝前后正式归档字节完全一致、
//!    同级目录零 `.chips-tmp-*` 残体）；
//! ④ 拒绝臂错误码与既有写族同形（权限、载体、种类、幂等 no-op）；
//! ⑤ 并发两笔换代串行收敛（单写者，终态恰为其中一笔、无撕裂）；
//! ⑥ 目录载体交叉锁真生效（承载 `.card` 的目录作用域在途写流未终结时，
//!    整包换代排队——禁止绕锁直写正式路径）；
//! ⑦ 发布形态合规（全条目 Store、时间戳统一取保存时刻）。

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use chips_core::NoopDecisionObserver;
use chips_parser::model::ParseLimits;
use chips_parser::serialize::ZipArchiveWriter;
use chips_parser::source::archive::ArchiveSource;
use chips_parser::source::{MemberMethod, PackagePath};

use chips_resource::error::{
    RESOURCE_ALREADY_EXISTS, RESOURCE_NOT_FOUND, RESOURCE_NOT_SUPPORTED,
    RESOURCE_PERMISSION_DENIED, RESOURCE_TOO_LARGE,
};
use chips_resource::{
    ArchiveRebuildRequest, ByteRange, ChangesetMember, OpenRequest, Origin, ResourceLimits,
    ResourceManager, ScopeKind, ScopePolicy, ScopeRegistration, SessionKind, VirtualPath,
    WriteStreamRequest, JOURNAL_FILE_SUFFIX, TEMP_FILE_PREFIX,
};

/// 临时夹具序号（进程号 + 原子序号防碰撞）。
static FIXTURE_SEQ: AtomicU64 = AtomicU64::new(0);

/// 保存时刻（整秒且为偶数秒：DOS 时间字段 2 秒粒度，便于逐条比对）。
fn saved_at() -> SystemTime {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("系统时钟必须在 Unix 纪元之后");
    let even_seconds = (now.as_secs() / 2) * 2;
    UNIX_EPOCH + std::time::Duration::from_secs(even_seconds)
}

/// 临时目录夹具：Drop 自清。
struct TempRoot(PathBuf);

impl TempRoot {
    fn new(tag: &str) -> Self {
        let base = std::env::temp_dir().join(format!(
            "chips-archive-rebuild-{}-{}-{}",
            tag,
            std::process::id(),
            FIXTURE_SEQ.fetch_add(1, Ordering::SeqCst)
        ));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).expect("临时夹具根必须可建");
        Self(base)
    }

    fn path(&self) -> &Path {
        &self.0
    }

    fn join(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }
}

impl Drop for TempRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// 以解析器归档写侧产出整包夹具（条目按 UTF-8 字节升序写出）。
fn build_package(path: &Path, entries: &[(&str, &[u8])], saved_at: SystemTime) {
    let mut ordered: Vec<(&str, &[u8])> = entries.to_vec();
    ordered.sort_by_key(|(name, _)| (*name).to_owned());
    let file = fs::File::create(path).expect("夹具归档必须可建");
    let mut writer = ZipArchiveWriter::new(file, saved_at).expect("夹具写入器必须可建");
    for (name, bytes) in ordered {
        let package_path = PackagePath::new(name).expect("夹具包内路径必须在册");
        writer
            .add_entry(&package_path, bytes)
            .expect("夹具成员必须可写");
    }
    writer.finish().expect("夹具归档必须可收尾");
}

/// 在册基线归档：清单 + 结构 + 嵌套正文 + 200 KiB 二进制（跨块复用臂）。
fn baseline_entries() -> Vec<(&'static str, Vec<u8>)> {
    vec![
        ("card.json", b"{\"kind\":\"card\",\"rev\":1}".to_vec()),
        (
            "content/note.txt",
            b"old note body, replaced on save".to_vec(),
        ),
        ("manifest.yaml", b"schema: 1\n".to_vec()),
        (
            "media/blob.bin",
            (0u32..200 * 1024).map(|i| (i % 251) as u8).collect(),
        ),
    ]
}

fn write_baseline(dir: &Path, saved_at: SystemTime) -> PathBuf {
    let archive = dir.join("note.card");
    let base = baseline_entries();
    let owned: Vec<(&str, &[u8])> = base
        .iter()
        .map(|(name, bytes)| (*name, bytes.as_slice()))
        .collect();
    build_package(&archive, &owned, saved_at);
    archive
}

fn owner() -> chips_core::PluginId {
    "chips.official.editor".into()
}

fn new_manager() -> Arc<ResourceManager> {
    Arc::new(ResourceManager::new(
        ResourceLimits::default(),
        Arc::new(NoopDecisionObserver),
    ))
}

fn session_with(manager: &ResourceManager, permissions: &[&str]) -> chips_core::SessionId {
    manager
        .open_session(
            SessionKind::Document,
            &owner(),
            BTreeSet::new(),
            permissions
                .iter()
                .map(|permission| (*permission).to_owned())
                .collect::<Vec<_>>(),
        )
        .expect("会话创建必须成功")
}

fn writer_session(manager: &ResourceManager) -> chips_core::SessionId {
    session_with(manager, &["resources:read", "resources:write"])
}

fn mount_archive(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    scope: &str,
    path: &Path,
    kind: ScopeKind,
    max_resource_bytes: u64,
) {
    manager
        .mount_archive(
            session,
            ScopeRegistration {
                scope: scope.into(),
                kind,
                owner: owner(),
                provider_id: "archive".into(),
                origin: Origin::Archive(path.to_path_buf()),
                policy: ScopePolicy {
                    read_only: false,
                    max_resource_bytes,
                    allowed_hosts: Vec::new(),
                },
            },
        )
        .expect("归档挂载必须成功");
}

fn mount_directory(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    scope: &str,
    root: &Path,
) {
    manager
        .mount_directory(
            session,
            ScopeRegistration {
                scope: scope.into(),
                kind: ScopeKind::Workspace,
                owner: owner(),
                provider_id: "directory".into(),
                origin: Origin::Directory(root.to_path_buf()),
                policy: ScopePolicy {
                    read_only: false,
                    max_resource_bytes: 8 * 1024 * 1024,
                    allowed_hosts: Vec::new(),
                },
            },
        )
        .expect("目录挂载必须成功");
}

fn vpath(manager: &ResourceManager, path: &str) -> VirtualPath {
    VirtualPath::validate(path, "chips-resource://probe", manager.limits()).expect("在册路径")
}

fn rebuild_request(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    scope: &str,
    members: &[(&str, &[u8])],
    removals: &[&str],
    saved_at: SystemTime,
) -> ArchiveRebuildRequest {
    ArchiveRebuildRequest {
        session,
        scope: scope.into(),
        members: members
            .iter()
            .map(|(path, bytes)| ChangesetMember {
                path: vpath(manager, path),
                bytes: (*bytes).to_vec(),
            })
            .collect(),
        removals: removals.iter().map(|path| vpath(manager, path)).collect(),
        saved_at,
    }
}

async fn read_member(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    uri: &str,
) -> Vec<u8> {
    let handle = manager
        .open(OpenRequest {
            uri: uri.into(),
            session,
        })
        .await
        .expect("成员必须可读");
    let bytes = manager
        .read_range(
            handle.id,
            session,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("成员范围读");
    manager.release(handle.id, session).expect("释放");
    bytes
}

/// 同级目录全部 `.chips-tmp-*` 族残体（含 sidecar 记录）名单。
fn slot_residue(dir: &Path) -> Vec<String> {
    let mut found: Vec<String> = fs::read_dir(dir)
        .expect("夹具目录必须可读")
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| name.starts_with(TEMP_FILE_PREFIX))
        .collect();
    found.sort();
    found
}

/// 归档文件的成员索引（包内路径 → 元数据）。
fn open_index(path: &Path) -> Vec<(String, u64, MemberMethod, Option<SystemTime>)> {
    let source = ArchiveSource::open(path, &ParseLimits::default()).expect("换代后归档必须可解析");
    source
        .members()
        .iter()
        .map(|(path, member)| {
            (
                path.as_str().to_owned(),
                member.meta.size,
                member.meta.method,
                member.meta.modified,
            )
        })
        .collect()
}

// ---------------------------------------------------------------------------
// ① 整包重建往返：覆写 + 新增 + 删除 + 未变更成员流式复用
// ---------------------------------------------------------------------------

#[tokio::test]
async fn rebuild_replaces_whole_package_and_read_side_sees_new_generation() {
    let dir = TempRoot::new("roundtrip");
    let saved_at = saved_at();
    let archive = write_baseline(dir.path(), saved_at);
    let manager = new_manager();
    let session = writer_session(&manager);
    mount_archive(
        &manager,
        session,
        "card-1",
        &archive,
        ScopeKind::Document,
        8 << 20,
    );
    let blob = (0u32..200 * 1024)
        .map(|i| (i % 251) as u8)
        .collect::<Vec<u8>>();
    assert_eq!(
        read_member(&manager, session, "chips-resource://card-1/media/blob.bin").await,
        blob,
        "基线二进制成员可读（复用臂的对照源）"
    );

    let later = saved_at + std::time::Duration::from_secs(60);
    let receipt = manager
        .rebuild_archive(rebuild_request(
            &manager,
            session,
            "card-1",
            &[
                ("card.json", b"{\"kind\":\"card\",\"rev\":2}".as_slice()),
                ("content/new.txt", b"brand new member".as_slice()),
            ],
            &["content/note.txt"],
            later,
        ))
        .await
        .expect("整包重建必须成功");
    assert_eq!(receipt.written_members, 2, "覆写/新增成员账目");
    assert_eq!(receipt.reused_members, 2, "未变更成员承接账目");
    assert_eq!(receipt.removed_members, 1, "不承接成员账目");
    assert_eq!(
        receipt.total_bytes,
        fs::metadata(&archive).expect("换代后文件在册").len(),
        "回执总字节即盘上实况"
    );
    assert!(receipt.total_bytes > 200 * 1024, "整包尺寸含二进制成员");

    // 换代后读面即新包（无需重挂）。
    assert_eq!(
        read_member(&manager, session, "chips-resource://card-1/card.json").await,
        b"{\"kind\":\"card\",\"rev\":2}".to_vec()
    );
    assert_eq!(
        read_member(&manager, session, "chips-resource://card-1/content/new.txt").await,
        b"brand new member".to_vec()
    );
    assert_eq!(
        read_member(&manager, session, "chips-resource://card-1/media/blob.bin").await,
        blob,
        "未变更二进制成员逐字节等同（分块流式复用不失真）"
    );
    let error = manager
        .open(OpenRequest {
            uri: "chips-resource://card-1/content/note.txt".into(),
            session,
        })
        .await
        .expect_err("删除成员换代后必不可读");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);

    // 零残留：换代终结后同级目录不得留临时物与意图记录。
    assert_eq!(slot_residue(dir.path()), Vec::<String>::new(), "零残留");
    let names: Vec<String> = open_index(&archive)
        .into_iter()
        .map(|(name, _, _, _)| name)
        .collect();
    assert_eq!(
        names,
        vec![
            "card.json".to_owned(),
            "content/new.txt".to_owned(),
            "manifest.yaml".to_owned(),
            "media/blob.bin".to_owned(),
        ],
        "终成员集 =（旧 − 删除）∪ 新增，按包内路径升序"
    );
}

// ---------------------------------------------------------------------------
// ② prepare 窗口崩溃：挂载槽位扫描回滚旧态
// ---------------------------------------------------------------------------

#[tokio::test]
async fn mount_slot_recovery_reclaims_crash_residue_and_spares_official_package() {
    let dir = TempRoot::new("crash");
    let saved_at = saved_at();
    let archive = write_baseline(dir.path(), saved_at);
    let before = fs::read(&archive).expect("基线归档可读");

    // 复现崩溃终态：意图记录已在册（prepare 相先落账）、半截临时整包在位、
    // 换代未及执行（正式归档保持旧态）。
    let token = "900123-7".to_owned();
    let temp = dir.join(&format!("{TEMP_FILE_PREFIX}{token}"));
    let journal = dir.join(&format!("{TEMP_FILE_PREFIX}{token}{JOURNAL_FILE_SUFFIX}"));
    fs::write(&temp, b"half-written whole package bytes").expect("夹具临时整包必可写");
    let record = chips_resource::CommitRecord {
        temp: temp.file_name().unwrap().to_string_lossy().into_owned(),
        target: "note.card".to_owned(),
        created_unix_ms: 1,
    };
    fs::write(
        &journal,
        serde_json::to_vec(&record).expect("夹具记录必可序列化"),
    )
    .expect("夹具记录必可写");

    let manager = new_manager();
    let session = writer_session(&manager);
    mount_archive(
        &manager,
        session,
        "card-1",
        &archive,
        ScopeKind::Document,
        8 << 20,
    );
    let report = manager
        .archive_recovery_report(&"card-1".to_owned())
        .expect("挂载必留槽位扫描报告");
    assert_eq!(report.removed_records, 1, "崩溃记录终结：{report:?}");
    assert_eq!(report.reclaimed_temp_files, 1, "半截整包回滚");
    assert_eq!(report.unbacked_temp_files, 0);
    assert_eq!(report.io_failures, 0);
    assert!(!temp.exists() && !journal.exists(), "残骸零留存");
    assert_eq!(
        fs::read(&archive).expect("正式归档仍可读"),
        before,
        "崩溃换代未落定 ⇒ 正式归档保持旧态"
    );
    assert_eq!(
        read_member(&manager, session, "chips-resource://card-1/card.json").await,
        b"{\"kind\":\"card\",\"rev\":1}".to_vec(),
        "旧态可读且读面即旧包"
    );

    // 收敛后同一归档可正常换代（恢复臂与提交臂闭环）。
    manager
        .rebuild_archive(rebuild_request(
            &manager,
            session,
            "card-1",
            &[("card.json", b"{\"kind\":\"card\",\"rev\":9}".as_slice())],
            &[],
            saved_at + std::time::Duration::from_secs(120),
        ))
        .await
        .expect("收敛后换代必须成功");
    assert_eq!(slot_residue(dir.path()), Vec::<String>::new(), "闭环零残留");
}

// ---------------------------------------------------------------------------
// ③ 失败臂全不现（拒绝前后正式归档字节完全一致、零残体）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn rejected_rebuilds_leave_official_package_untouched_and_slot_clean() {
    let dir = TempRoot::new("reject");
    let saved_at = saved_at();
    let archive = write_baseline(dir.path(), saved_at);
    let before = fs::read(&archive).expect("基线归档可读");
    let manager = new_manager();
    let session = writer_session(&manager);
    mount_archive(
        &manager,
        session,
        "card-1",
        &archive,
        ScopeKind::Document,
        8 << 20,
    );

    // 删除目标不在旧包 → NOT_FOUND（prepare 前判定，零盘上动作）。
    let error = manager
        .rebuild_archive(rebuild_request(
            &manager,
            session,
            "card-1",
            &[("card.json", b"x".as_slice())],
            &["content/ghost.txt"],
            saved_at,
        ))
        .await
        .expect_err("缺失删除目标必拒");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    assert_eq!(
        error.details().unwrap()["uri"],
        "chips-resource://card-1/content/ghost.txt",
        "错误定位为成员精确 uri"
    );

    // 单成员超内联上限 → TOO_LARGE（取锁前）。
    let giant = vec![0u8; (manager.limits().max_inline_bytes + 1) as usize];
    let error = manager
        .rebuild_archive(rebuild_request(
            &manager,
            session,
            "card-1",
            &[("media/giant.bin", giant.as_slice())],
            &[],
            saved_at,
        ))
        .await
        .expect_err("超内联体量必拒");
    assert_eq!(error.code(), RESOURCE_TOO_LARGE);

    // 整包发布尺寸超作用域上限 → TOO_LARGE（闭式和提前拒绝臂）。
    let tight = new_manager();
    let tight_session = writer_session(&tight);
    mount_archive(
        &tight,
        tight_session,
        "card-2",
        &archive,
        ScopeKind::Document,
        1024,
    );
    let error = tight
        .rebuild_archive(rebuild_request(
            &tight,
            tight_session,
            "card-2",
            &[("card.json", b"tiny".as_slice())],
            &[],
            saved_at,
        ))
        .await
        .expect_err("整包超作用域上限必拒");
    assert_eq!(error.code(), RESOURCE_TOO_LARGE);

    assert_eq!(
        fs::read(&archive).expect("归档仍可读"),
        before,
        "全部失败臂之后正式归档字节完全一致"
    );
    assert_eq!(
        slot_residue(dir.path()),
        Vec::<String>::new(),
        "失败臂零残体"
    );
}

// ---------------------------------------------------------------------------
// ④ 拒绝臂错误码与既有写族同形
// ---------------------------------------------------------------------------

#[tokio::test]
async fn rejection_arms_share_registered_codes() {
    let dir = TempRoot::new("arms");
    let saved_at = saved_at();
    let archive = write_baseline(dir.path(), saved_at);
    let before = fs::read(&archive).expect("基线归档可读");
    let manager = new_manager();

    // 缺 `resources:write` → PERMISSION_DENIED（not_granted 臂）。
    let reader = session_with(&manager, &["resources:read"]);
    mount_archive(
        &manager,
        reader,
        "card-1",
        &archive,
        ScopeKind::Document,
        8 << 20,
    );
    let error = manager
        .rebuild_archive(rebuild_request(
            &manager,
            reader,
            "card-1",
            &[("card.json", b"nope".as_slice())],
            &[],
            saved_at,
        ))
        .await
        .expect_err("无写权限必拒");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    assert_eq!(error.details().unwrap()["reason"], "not_granted");

    // 成员路径重复 / 成员与删除交叉 → ALREADY_EXISTS（请求歧义）。
    let session = writer_session(&manager);
    let duplicated: Vec<ChangesetMember> = vec![
        ChangesetMember {
            path: vpath(&manager, "card.json"),
            bytes: b"a".to_vec(),
        },
        ChangesetMember {
            path: vpath(&manager, "card.json"),
            bytes: b"b".to_vec(),
        },
    ];
    let error = manager
        .rebuild_archive(ArchiveRebuildRequest {
            session,
            scope: "card-1".into(),
            members: duplicated,
            removals: Vec::new(),
            saved_at,
        })
        .await
        .expect_err("同一路径第二次出现必拒");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    let error = manager
        .rebuild_archive(rebuild_request(
            &manager,
            session,
            "card-1",
            &[("card.json", b"a".as_slice())],
            &["card.json"],
            saved_at,
        ))
        .await
        .expect_err("覆写与删除交叉必拒");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);

    // 会话未绑定作用域 → PERMISSION_DENIED（out_of_scope 臂）。
    let stranger = session_with(&manager, &["resources:read", "resources:write"]);
    let error = manager
        .rebuild_archive(rebuild_request(
            &manager,
            stranger,
            "card-1",
            &[("card.json", b"a".as_slice())],
            &[],
            saved_at,
        ))
        .await
        .expect_err("未绑定会话必拒");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    assert_eq!(error.details().unwrap()["reason"], "out_of_scope");

    // 未注册作用域 → NOT_FOUND。
    let error = manager
        .rebuild_archive(rebuild_request(
            &manager,
            session,
            "card-absent",
            &[("card.json", b"a".as_slice())],
            &[],
            saved_at,
        ))
        .await
        .expect_err("未注册作用域必拒");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);

    // Plugin 载体（`.cpk`）不承载文档保存语义 → NOT_SUPPORTED。
    let plugin_archive = dir.join("signed.cpk");
    let owned: Vec<(&str, &[u8])> = vec![("manifest.json", b"{}".as_slice())];
    build_package(&plugin_archive, &owned, saved_at);
    mount_archive(
        &manager,
        session,
        "plugin-1",
        &plugin_archive,
        ScopeKind::Plugin,
        8 << 20,
    );
    let error = manager
        .rebuild_archive(rebuild_request(
            &manager,
            session,
            "plugin-1",
            &[("manifest.json", b"{}".as_slice())],
            &[],
            saved_at,
        ))
        .await
        .expect_err("插件包归档不接受整包换代");
    assert_eq!(error.code(), RESOURCE_NOT_SUPPORTED);

    // 目录态作用域不走整包通路 → NOT_SUPPORTED（目录态用 commit_changeset）。
    let workspace = TempRoot::new("arms-dir");
    mount_directory(&manager, session, "workspace-9", workspace.path());
    let error = manager
        .rebuild_archive(rebuild_request(
            &manager,
            session,
            "workspace-9",
            &[("a.txt", b"x".as_slice())],
            &[],
            saved_at,
        ))
        .await
        .expect_err("目录载体不走归档换代臂");
    assert_eq!(error.code(), RESOURCE_NOT_SUPPORTED);

    // 空变更集 → 幂等 no-op（不取锁、不写账、零换代）。
    let receipt = manager
        .rebuild_archive(rebuild_request(
            &manager,
            session,
            "card-1",
            &[],
            &[],
            saved_at,
        ))
        .await
        .expect("空变更集即幂等 no-op");
    assert_eq!(receipt.total_bytes, 0);
    assert_eq!(receipt.written_members, 0);
    assert_eq!(receipt.reused_members, 0);
    assert_eq!(receipt.removed_members, 0);
    assert_eq!(
        fs::read(&archive).expect("归档仍可读"),
        before,
        "no-op 之后正式归档字节完全一致"
    );
    assert_eq!(
        slot_residue(dir.path()),
        Vec::<String>::new(),
        "no-op 零残体"
    );
}

// ---------------------------------------------------------------------------
// ⑤ 并发两笔换代串行收敛（整包槽位单写者）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn concurrent_rebuilds_over_same_slot_serialize_into_single_generation() {
    let dir = TempRoot::new("concurrent");
    let saved_at = saved_at();
    let archive = write_baseline(dir.path(), saved_at);
    let manager = new_manager();
    let session = writer_session(&manager);
    mount_archive(
        &manager,
        session,
        "card-1",
        &archive,
        ScopeKind::Document,
        8 << 20,
    );

    let left = Arc::clone(&manager);
    let right = Arc::clone(&manager);
    let left_request = rebuild_request(
        &manager,
        session,
        "card-1",
        &[("card.json", b"{\"rev\":\"left\"}".as_slice())],
        &[],
        saved_at,
    );
    let right_request = rebuild_request(
        &manager,
        session,
        "card-1",
        &[("card.json", b"{\"rev\":\"right\"}".as_slice())],
        &[],
        saved_at,
    );
    let left_done = Arc::new(AtomicBool::new(false));
    let right_done = Arc::new(AtomicBool::new(false));
    let left_flag = Arc::clone(&left_done);
    let right_flag = Arc::clone(&right_done);
    let left_task = tokio::spawn(async move {
        let receipt = left
            .rebuild_archive(left_request)
            .await
            .expect("左路换代必须成功");
        left_flag.store(true, Ordering::SeqCst);
        receipt
    });
    let right_task = tokio::spawn(async move {
        let receipt = right
            .rebuild_archive(right_request)
            .await
            .expect("右路换代必须成功");
        right_flag.store(true, Ordering::SeqCst);
        receipt
    });
    for _ in 0..4 {
        tokio::task::yield_now().await;
    }
    let left_receipt = left_task.await.expect("左路任务不得 panic");
    let right_receipt = right_task.await.expect("右路任务不得 panic");
    assert!(left_done.load(Ordering::SeqCst) && right_done.load(Ordering::SeqCst));
    // 两笔各自的账目同形：1 员覆写 + 3 员承接、无删除（换代串行，
    // 后一笔的源即前一笔的产物，成员集恒为 4）。
    for receipt in [&left_receipt, &right_receipt] {
        assert_eq!(receipt.written_members, 1, "覆写账目：{receipt:?}");
        assert_eq!(receipt.reused_members, 3, "承接账目：{receipt:?}");
        assert_eq!(receipt.removed_members, 0);
    }

    // 终态恰为其中一笔的完整代际：成员集完整（4 员齐在）+ 正文取值为
    // 两候选之一——撕裂态（半截整包、缺员、正文混排）必不通过本断言。
    let index = open_index(&archive);
    let names: Vec<String> = index.into_iter().map(|(name, _, _, _)| name).collect();
    assert_eq!(
        names,
        vec![
            "card.json".to_owned(),
            "content/note.txt".to_owned(),
            "manifest.yaml".to_owned(),
            "media/blob.bin".to_owned(),
        ],
        "终成员集完整无损（串行换代无撕裂、无掉员）"
    );
    let content = read_member(&manager, session, "chips-resource://card-1/card.json").await;
    assert!(
        content == b"{\"rev\":\"left\"}".to_vec() || content == b"{\"rev\":\"right\"}".to_vec(),
        "正文取值为终态一笔，无撕裂"
    );
    // 盘上实况必为两笔回执之一（终态代际的总字节账目一致）。
    let on_disk = fs::metadata(&archive).expect("文件在册").len();
    assert!(
        on_disk == left_receipt.total_bytes || on_disk == right_receipt.total_bytes,
        "盘上总字节必等某笔回执：disk={on_disk} left={} right={}",
        left_receipt.total_bytes,
        right_receipt.total_bytes
    );
    assert_eq!(slot_residue(dir.path()), Vec::<String>::new(), "并发零残留");
}

// ---------------------------------------------------------------------------
// ⑥ 目录载体交叉锁：在途写流未终结时整包换代排队
// ---------------------------------------------------------------------------

#[tokio::test]
async fn directory_carrier_stream_blocks_whole_package_rebuild() {
    let dir = TempRoot::new("carrier");
    let saved_at = saved_at();
    let archive = write_baseline(dir.path(), saved_at);
    let manager = new_manager();
    let session = writer_session(&manager);
    // 同一宿主目录既作目录态载体挂载，其内 `.card` 又作归档态挂载。
    mount_directory(&manager, session, "workspace-1", dir.path());
    mount_archive(
        &manager,
        session,
        "card-1",
        &archive,
        ScopeKind::Document,
        8 << 20,
    );

    let stream = manager
        .open_write_stream(WriteStreamRequest {
            session,
            scope: "workspace-1".into(),
            path: vpath(&manager, "note.card"),
            expected_size: None,
        })
        .expect("载体写流建档");
    manager
        .append_write_stream(&stream, b"partial bytes")
        .expect("载体写流追加");

    let task_manager = Arc::clone(&manager);
    let request = rebuild_request(
        &manager,
        session,
        "card-1",
        &[("card.json", b"{\"rev\":\"cross\"}".as_slice())],
        &[],
        saved_at,
    );
    let pending = Arc::new(AtomicBool::new(true));
    let flag = Arc::clone(&pending);
    let task = tokio::spawn(async move {
        let receipt = task_manager
            .rebuild_archive(request)
            .await
            .expect("换代必须成功");
        flag.store(false, Ordering::SeqCst);
        receipt
    });
    for _ in 0..8 {
        tokio::task::yield_now().await;
    }
    assert!(
        pending.load(Ordering::SeqCst),
        "目录载体在途写流未得锁时，整包换代不得放行（绕锁直写面）"
    );
    manager.abort_write_stream(&stream).expect("载体写流中止");
    for _ in 0..8 {
        tokio::task::yield_now().await;
    }
    let receipt = task.await.expect("换代任务不得 panic");
    assert!(!pending.load(Ordering::SeqCst), "锁归还后换代放行");
    assert!(receipt.total_bytes > 0);
    assert_eq!(
        read_member(&manager, session, "chips-resource://card-1/card.json").await,
        b"{\"rev\":\"cross\"}".to_vec()
    );
    assert_eq!(slot_residue(dir.path()), Vec::<String>::new(), "零残留");
}

// ---------------------------------------------------------------------------
// ⑦ 发布形态合规：全条目 Store + 时间戳统一取保存时刻
// ---------------------------------------------------------------------------

#[tokio::test]
async fn rebuilt_package_is_store_only_and_carries_saved_at_timestamps() {
    let dir = TempRoot::new("shape");
    let saved_at = saved_at();
    let archive = write_baseline(dir.path(), saved_at);
    let manager = new_manager();
    let session = writer_session(&manager);
    mount_archive(
        &manager,
        session,
        "card-1",
        &archive,
        ScopeKind::Document,
        8 << 20,
    );
    let published_at = saved_at + std::time::Duration::from_secs(240);
    manager
        .rebuild_archive(rebuild_request(
            &manager,
            session,
            "card-1",
            &[("card.json", b"{\"rev\":3}".as_slice())],
            &[],
            published_at,
        ))
        .await
        .expect("换代必须成功");
    let index = open_index(&archive);
    assert_eq!(index.len(), 4, "成员数（未变更 + 覆写）");
    for (name, size, method, modified) in &index {
        assert_eq!(*method, MemberMethod::Store, "发布侧一律 Store：{name}");
        let modified = modified.expect("条目时间戳在册");
        let delta = modified
            .duration_since(published_at)
            .unwrap_or_else(|error| error.duration());
        assert!(
            delta.as_secs() < 2,
            "全部条目时间戳统一取保存时刻（DOS 2 秒粒度）：{name} → {modified:?}"
        );
        let expected = baseline_entries()
            .into_iter()
            .find(|(baseline, _)| baseline == name)
            .map(|(_, bytes)| bytes.len() as u64);
        let expected = if name == "card.json" {
            9
        } else {
            expected.unwrap()
        };
        assert_eq!(*size, expected, "成员尺寸如实：{name}");
    }
    assert_eq!(slot_residue(dir.path()), Vec::<String>::new());
}
