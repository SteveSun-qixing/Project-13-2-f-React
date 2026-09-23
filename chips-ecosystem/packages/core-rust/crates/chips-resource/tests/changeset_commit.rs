//! 工单036 波 C2a-2 集成锁：目录态包级 changeset 提交事务
//! （[`ResourceManager::commit_changeset`]，覆写 `members[]` + 删除
//! `removals[]` 一包事务，全程持 `WriteCoordinator` 多键锁，意图账复用
//! C2a-1 `journal` prepare–commit phase 语义）。
//!
//! 口径要点（与 `tests/journal_recovery.rs` 同方言）：夹具一律真实临时目录
//! （Drop 自清）；「崩溃」以协议落盘时序的磁盘终态复现（prepare 相意图记录
//! 先于临时物在册、终结未及），不 mock 运行时；恢复闭环由既有挂载即扫描
//! （`mount_directory` → `journal::recover_root`）承担。错误码零新增
//! （《06.02》§2.4 九词冻结，失败臂一律在册词表）。
//!
//! 四类判据：
//! ① 半提交崩溃重放收敛旧态（prepare 窗口崩溃 → 重挂载恢复扫描按意图账
//!    回滚整包、零残留、目标旧态；随后真提交正常换代）；
//! ② 覆写 + 删除混合 changeset 原子性（全成或全不现：prepare 任一步失败
//!    整包回滚零残留，成功则全部落定且零残留）；
//! ③ 并发第二笔 changeset 不互踩（多键锁真生效：重叠键两笔并发提交串行
//!    收敛、终态恰为其中一笔、无撕裂数据、无死锁）；
//! ④ 恢复扫描对本新臂真可达（挂载即清 changeset 崩溃残留，且不误杀同根
//!    在途写流——在途账保护单源判据）。

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use chips_core::NoopDecisionObserver;

use chips_resource::error::{
    RESOURCE_ALREADY_EXISTS, RESOURCE_NOT_EMPTY, RESOURCE_NOT_FOUND, RESOURCE_NOT_SUPPORTED,
    RESOURCE_PERMISSION_DENIED, RESOURCE_TOO_LARGE,
};
use chips_resource::{
    ChangesetMember, ChangesetRequest, CommitRecord, Origin, ResourceLimits, ResourceManager,
    ScopeKind, ScopePolicy, ScopeRegistration, SessionKind, VirtualPath, WriteStreamRequest,
    JOURNAL_FILE_SUFFIX, TEMP_FILE_PREFIX,
};

/// 临时夹具序号（进程号 + 原子序号防碰撞）。
static FIXTURE_SEQ: AtomicU64 = AtomicU64::new(0);

/// 临时目录夹具：Drop 自清。
struct TempRoot(PathBuf);

impl TempRoot {
    fn new(tag: &str) -> Self {
        let base = std::env::temp_dir().join(format!(
            "chips-changeset-it-{}-{}-{}",
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
    fn write(&self, relative: &str, bytes: &[u8]) {
        let target = self.0.join(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).expect("夹具父目录必须可建");
        }
        fs::write(target, bytes).expect("夹具文件必须可写");
    }
}

impl Drop for TempRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn owner() -> chips_core::PluginId {
    "chips.official.editor".into()
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

fn mount_directory(manager: &ResourceManager, session: chips_core::SessionId, root: &Path) {
    mount_directory_as(manager, session, root, "workspace-1", ScopeKind::Workspace);
}

/// 以指定作用域 ID 与种类挂载（种类闸锁测需要 Plugin 形目录作用域：
/// 《04.04》§4.9 删除种类闸仅放行 Plugin/Temporary/Memory）。
fn mount_directory_as(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    root: &Path,
    scope: &str,
    kind: ScopeKind,
) {
    manager
        .mount_directory(
            session,
            ScopeRegistration {
                scope: scope.into(),
                kind,
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

fn validated_path(manager: &ResourceManager, path: &str) -> VirtualPath {
    VirtualPath::validate(path, "chips-resource://probe", manager.limits()).expect("在册路径")
}

/// 根目录（递归）全部 `.chips-tmp-*` 族残留探测（含 sidecar 记录）。
fn sweep_residue(root: &Path) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(reader) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in reader.filter_map(|entry| entry.ok()) {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_dir() {
                stack.push(entry.path());
                continue;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with(TEMP_FILE_PREFIX) {
                found.push(entry.path().to_string_lossy().into_owned());
            }
        }
    }
    found.sort();
    found
}

/// 落一份「prepare 窗口崩溃」磁盘终态（意图记录 + 同名临时物，与
/// `commit_changeset` prepare 相落盘形态同构）。
fn plant_crash_member(dir: &Path, token: &str, target_relative: &str) -> (PathBuf, PathBuf) {
    let temp_path = dir.join(format!("{TEMP_FILE_PREFIX}{token}"));
    let journal_path = dir.join(format!("{TEMP_FILE_PREFIX}{token}{JOURNAL_FILE_SUFFIX}"));
    fs::write(&temp_path, b"half-staged").expect("夹具临时物必须可写");
    let record = CommitRecord {
        temp: format!("{TEMP_FILE_PREFIX}{token}"),
        target: target_relative.to_owned(),
        created_unix_ms: 1,
    };
    fs::write(
        &journal_path,
        serde_json::to_vec(&record).expect("夹具记录必须可序列化"),
    )
    .expect("夹具记录必须可写");
    (journal_path, temp_path)
}

// ---------------------------------------------------------------------------
// ① 半提交崩溃重放收敛旧态（意图账与文件系统一致）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_crashed_prepare_window_replays_back_to_old_state_on_remount() {
    // prepare 窗口崩溃（两成员意图记录与临时物均已落盘、publish 未及）：
    // 重启挂载 → 既有恢复扫描按意图账回滚整包（逐记录删临时物、终结记录），
    // 两个目标全部保持旧态、零残留；随后真 changeset 正常换代并零残留。
    let fixture = TempRoot::new("crash-replay");
    fixture.write("keep/first.txt", b"OLD-1");
    fixture.write("keep/second.txt", b"OLD-2");
    let (journal_1, temp_1) =
        plant_crash_member(&fixture.path().join("keep"), "960001-1", "keep/first.txt");
    let (journal_2, temp_2) =
        plant_crash_member(&fixture.path().join("keep"), "960001-2", "keep/second.txt");
    assert!(
        journal_1.is_file() && temp_1.is_file() && journal_2.is_file() && temp_2.is_file(),
        "崩溃终态双方在册"
    );

    let manager = ResourceManager::new(ResourceLimits::default(), observer_arc());
    let session = writer_session(&manager);
    mount_directory(&manager, session, fixture.path());
    let report = manager
        .directory_recovery_report(&"workspace-1".to_owned())
        .expect("挂载即产恢复报告");
    assert_eq!(
        report.removed_records, 2,
        "两条意图记录全部终结：{report:?}"
    );
    assert_eq!(report.reclaimed_temp_files, 2, "两枚残留临时物全部回滚");
    assert_eq!(report.unbacked_temp_files, 0);
    assert_eq!(report.io_failures, 0, "{report:?}");
    assert!(!journal_1.exists() && !temp_1.exists());
    assert!(!journal_2.exists() && !temp_2.exists());
    assert_eq!(
        fs::read(fixture.path().join("keep/first.txt")).unwrap(),
        b"OLD-1"
    );
    assert_eq!(
        fs::read(fixture.path().join("keep/second.txt")).unwrap(),
        b"OLD-2"
    );

    // 收敛后真 changeset 提交正常换代（恢复臂与提交臂闭环）。
    let views = manager
        .commit_changeset(ChangesetRequest {
            session,
            scope: "workspace-1".into(),
            members: vec![
                ChangesetMember {
                    path: validated_path(&manager, "keep/first.txt"),
                    bytes: b"NEW-1".to_vec(),
                },
                ChangesetMember {
                    path: validated_path(&manager, "keep/second.txt"),
                    bytes: b"NEW-2".to_vec(),
                },
            ],
            removals: Vec::new(),
        })
        .await
        .expect("收敛后包级提交必须放行");
    assert_eq!(views.len(), 2);
    assert_eq!(views[0].size, 5);
    assert_eq!(views[1].size, 5);
    assert_eq!(
        fs::read(fixture.path().join("keep/first.txt")).unwrap(),
        b"NEW-1"
    );
    assert_eq!(
        fs::read(fixture.path().join("keep/second.txt")).unwrap(),
        b"NEW-2"
    );
    assert!(sweep_residue(fixture.path()).is_empty(), "成功提交零残留");
}

#[tokio::test]
async fn test_prepare_phase_failure_midway_rolls_back_whole_changeset() {
    // prepare 相中途失败（成员 staging 已落盘后，删除目标校验非空目录
    // 拒绝）：整包弃置——已 staging 成员临时物与意图记录经同一 Drop 通道
    // 清扫，文件系统全域旧态、零残留（真 all-or-nothing 经公开入口）。
    let fixture = TempRoot::new("prepare-fail");
    fixture.write("a.txt", b"OLD-A");
    fixture.write("full-dir/inner.bin", b"I");
    let manager = ResourceManager::new(ResourceLimits::default(), observer_arc());
    let session = writer_session(&manager);
    // 删除臂涉 Plugin 形目录作用域（《04.04》§4.9 种类闸）。
    mount_directory_as(
        &manager,
        session,
        fixture.path(),
        "plugin-1",
        ScopeKind::Plugin,
    );
    let error = manager
        .commit_changeset(ChangesetRequest {
            session,
            scope: "plugin-1".into(),
            members: vec![ChangesetMember {
                path: validated_path(&manager, "a.txt"),
                bytes: b"NEVER".to_vec(),
            }],
            removals: vec![validated_path(&manager, "full-dir")],
        })
        .await
        .expect_err("非空目录删除校验必须拒绝整包");
    assert_eq!(error.code(), RESOURCE_NOT_EMPTY);
    assert_eq!(fs::read(fixture.path().join("a.txt")).unwrap(), b"OLD-A");
    assert!(fixture.path().join("full-dir/inner.bin").is_file());
    assert!(
        sweep_residue(fixture.path()).is_empty(),
        "整包回滚零残留：{:?}",
        sweep_residue(fixture.path())
    );
    // 弃置后复扫：无残体可处置（账实两清的确定性证明）。
    let report = chips_resource::recover_root(fixture.path());
    assert_eq!(report, chips_resource::JournalRecoveryReport::default());
}

// ---------------------------------------------------------------------------
// ② 覆写 + 删除混合 changeset 原子性（全成或全不现）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_mixed_overwrite_and_removal_changeset_applies_atomically() {
    // 全成臂：覆写既有 + 新建成员 + 删文件 + 删空目录一次提交全部落定；
    // 返回元数据按成员请求序、零残留。
    let fixture = TempRoot::new("mixed-ok");
    fixture.write("a.txt", b"OLD-A");
    fixture.write("gone.bin", b"GONE");
    fs::create_dir(fixture.path().join("fresh")).expect("夹具父目录必须可建");
    fs::create_dir(fixture.path().join("empty-dir")).expect("夹具空目录必须可建");
    let manager = ResourceManager::new(ResourceLimits::default(), observer_arc());
    let session = writer_session(&manager);
    // 删除臂涉 Plugin 形目录作用域（《04.04》§4.9 种类闸）。
    mount_directory_as(
        &manager,
        session,
        fixture.path(),
        "plugin-1",
        ScopeKind::Plugin,
    );
    let views = manager
        .commit_changeset(ChangesetRequest {
            session,
            scope: "plugin-1".into(),
            members: vec![
                ChangesetMember {
                    path: validated_path(&manager, "a.txt"),
                    bytes: b"NEW-A-LONGER".to_vec(),
                },
                ChangesetMember {
                    path: validated_path(&manager, "fresh/fresh.txt"),
                    bytes: b"FRESH".to_vec(),
                },
            ],
            removals: vec![
                validated_path(&manager, "gone.bin"),
                validated_path(&manager, "empty-dir"),
            ],
        })
        .await
        .expect("混合变更集必须整体放行");
    assert_eq!(views.len(), 2, "返回按成员请求序");
    assert_eq!(views[0].uri, "chips-resource://plugin-1/a.txt");
    assert_eq!(views[0].size, 12);
    assert_eq!(views[1].uri, "chips-resource://plugin-1/fresh/fresh.txt");
    assert_eq!(views[1].size, 5);
    assert_eq!(
        fs::read(fixture.path().join("a.txt")).unwrap(),
        b"NEW-A-LONGER"
    );
    assert_eq!(
        fs::read(fixture.path().join("fresh/fresh.txt")).unwrap(),
        b"FRESH"
    );
    assert!(!fixture.path().join("gone.bin").exists(), "文件删除落定");
    assert!(!fixture.path().join("empty-dir").exists(), "空目录删除落定");
    assert!(sweep_residue(fixture.path()).is_empty(), "全成零残留");
}

#[tokio::test]
async fn test_mixed_changeset_with_failing_member_leaves_everything_unborn() {
    // 全不现臂：成员队列第二个目标为在册目录（staging 判定
    // `ALREADY_EXISTS`）——此前已 staging 成员必须随事务弃置清扫，
    // 删除臂不执行、既有目标全部旧态、零残留。
    let fixture = TempRoot::new("mixed-fail");
    fixture.write("a.txt", b"OLD-A");
    fixture.write("gone.bin", b"GONE");
    fs::create_dir(fixture.path().join("occupied")).expect("夹具目录必须可建");
    let manager = ResourceManager::new(ResourceLimits::default(), observer_arc());
    let session = writer_session(&manager);
    // 删除臂涉 Plugin 形目录作用域（《04.04》§4.9 种类闸）。
    mount_directory_as(
        &manager,
        session,
        fixture.path(),
        "plugin-1",
        ScopeKind::Plugin,
    );
    let error = manager
        .commit_changeset(ChangesetRequest {
            session,
            scope: "plugin-1".into(),
            members: vec![
                ChangesetMember {
                    path: validated_path(&manager, "a.txt"),
                    bytes: b"NEVER".to_vec(),
                },
                ChangesetMember {
                    path: validated_path(&manager, "occupied"),
                    bytes: b"NEVER".to_vec(),
                },
            ],
            removals: vec![validated_path(&manager, "gone.bin")],
        })
        .await
        .expect_err("目录目标不覆盖（与单成员写同形）");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    assert_eq!(fs::read(fixture.path().join("a.txt")).unwrap(), b"OLD-A");
    assert!(fixture.path().join("gone.bin").is_file(), "删除臂不执行");
    assert!(fixture.path().join("occupied").is_dir());
    assert!(sweep_residue(fixture.path()).is_empty(), "全不现零残留");
}

// ---------------------------------------------------------------------------
// ③ 并发第二笔 changeset 不互踩（多键锁真生效）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_concurrent_changesets_overlapping_keys_serialize_without_tearing() {
    // 重叠键两笔 changeset 并发提交（A: shared.txt + only-a.txt；
    // B: shared.txt + only-b.txt）：多键锁一次性取锁、事务级互斥——两笔
    // 均成功，shared.txt 终态恰为其中一笔的完整字节（无撕裂数据），
    // 两笔各自独占成员全部落定，零残留、无死锁。
    let fixture = TempRoot::new("concurrent");
    fixture.write("shared.txt", b"BASE");
    let manager = ResourceManager::new(ResourceLimits::default(), observer_arc());
    let session = writer_session(&manager);
    mount_directory(&manager, session, fixture.path());
    let build = |path: &str, bytes: &[u8]| ChangesetMember {
        path: validated_path(&manager, path),
        bytes: bytes.to_vec(),
    };
    let manager_a = &manager;
    let manager_b = &manager;
    let (first, second) = tokio::join!(
        async {
            manager_a
                .commit_changeset(ChangesetRequest {
                    session,
                    scope: "workspace-1".into(),
                    members: vec![
                        build("shared.txt", b"PAYLOAD-A-A-A-A"),
                        build("only-a.txt", b"AAA"),
                    ],
                    removals: Vec::new(),
                })
                .await
        },
        async {
            manager_b
                .commit_changeset(ChangesetRequest {
                    session,
                    scope: "workspace-1".into(),
                    members: vec![
                        build("shared.txt", b"PAYLOAD-B-B-B-B-B-B"),
                        build("only-b.txt", b"BBB"),
                    ],
                    removals: Vec::new(),
                })
                .await
        }
    );
    first.expect("并发第一笔必须成功");
    second.expect("并发第二笔必须成功（多键锁串行放行，不互踩不死锁）");
    let shared = fs::read(fixture.path().join("shared.txt")).expect("shared 可读");
    assert!(
        shared == b"PAYLOAD-A-A-A-A".as_slice() || shared == b"PAYLOAD-B-B-B-B-B-B".as_slice(),
        "重叠键终态必须恰为其中一笔的完整字节（无撕裂）：{shared:?}"
    );
    assert!(
        fixture.path().join("only-a.txt").is_file() && fixture.path().join("only-b.txt").is_file(),
        "两笔各自的独占成员全部落定"
    );
    assert!(sweep_residue(fixture.path()).is_empty(), "并发收敛零残留");
}

// ---------------------------------------------------------------------------
// ④ 恢复扫描对本新臂真可达（挂载即清残留、不误杀在途）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_mount_recovery_clears_changeset_residue_and_spares_in_flight_stream() {
    // 同根双形态：changeset prepare 崩溃残留（意图账回滚收敛）与本进程
    // 在途写流（意图账保护跳过）并存——第二管理器挂载同根触发恢复扫描，
    // 残留清零、在途原样幸存；在途流随后正常提交（不误杀在途）。
    let fixture = TempRoot::new("recovery-reach");
    fixture.write("dead.txt", b"OLD-DEAD");
    fixture.write("live.bin", b"OLD-LIVE");
    let manager = ResourceManager::new(ResourceLimits::default(), observer_arc());
    let session = writer_session(&manager);
    mount_directory(&manager, session, fixture.path());
    // 崩溃夹具在本管理器挂载**之后**落盘（否则其挂载扫描会先收敛掉夹具）。
    let (journal, temp) = plant_crash_member(fixture.path(), "960002-1", "dead.txt");
    let handle = manager
        .open_write_stream(WriteStreamRequest {
            session,
            scope: "workspace-1".into(),
            path: validated_path(&manager, "live.bin"),
            expected_size: Some(4),
        })
        .expect("在途写流打开");
    manager
        .append_write_stream(&handle, b"NEWW")
        .expect("分块送入");

    // 另一管理器实例挂载同根：崩溃残留按意图账回滚，在途记录跳过保护。
    let other = ResourceManager::new(ResourceLimits::default(), observer_arc());
    let other_session = writer_session(&other);
    other
        .mount_directory(
            other_session,
            ScopeRegistration {
                scope: "workspace-2".into(),
                kind: ScopeKind::Workspace,
                owner: owner(),
                provider_id: "directory".into(),
                origin: Origin::Directory(fixture.path().to_path_buf()),
                policy: ScopePolicy {
                    read_only: false,
                    max_resource_bytes: 8 * 1024 * 1024,
                    allowed_hosts: Vec::new(),
                },
            },
        )
        .expect("同根挂载必须成功");
    let report = other
        .directory_recovery_report(&"workspace-2".to_owned())
        .expect("挂载即产恢复报告");
    assert_eq!(
        report.removed_records, 1,
        "changeset 崩溃记录终结：{report:?}"
    );
    assert_eq!(report.reclaimed_temp_files, 1, "changeset 残留临时物回滚");
    assert_eq!(report.skipped_in_flight, 1, "在途写流记录必须被保护跳过");
    assert_eq!(report.unbacked_temp_files, 0);
    assert!(!journal.exists() && !temp.exists(), "崩溃残留收敛");
    assert_eq!(
        fs::read(fixture.path().join("dead.txt")).unwrap(),
        b"OLD-DEAD",
        "崩溃目标保持旧态"
    );

    // 在途流不受扫描影响：正常提交落定新态，全域零残留。
    let metadata = manager
        .commit_write_stream(handle)
        .await
        .expect("在途流提交");
    assert_eq!(metadata.size, 4);
    assert_eq!(fs::read(fixture.path().join("live.bin")).unwrap(), b"NEWW");
    assert!(sweep_residue(fixture.path()).is_empty(), "全域零残留");
}

// ---------------------------------------------------------------------------
// 拒绝臂（在册词表，取锁前/零盘上动作）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_changeset_rejection_arms_share_registered_codes() {
    // 空变更集：幂等 no-op（不取锁、不写账、不落盘）。
    let fixture = TempRoot::new("rejections");
    fixture.write("a.txt", b"OLD");
    let manager = ResourceManager::new(ResourceLimits::default(), observer_arc());
    let session = writer_session(&manager);
    mount_directory(&manager, session, fixture.path());
    let views = manager
        .commit_changeset(ChangesetRequest {
            session,
            scope: "workspace-1".into(),
            members: Vec::new(),
            removals: Vec::new(),
        })
        .await
        .expect("空变更集幂等放行");
    assert!(views.is_empty());

    // 同一路径第二次出现（成员重复 / 成员与删除交叉）：请求歧义，
    // 取锁前 `ALREADY_EXISTS`。
    let error = manager
        .commit_changeset(ChangesetRequest {
            session,
            scope: "workspace-1".into(),
            members: vec![
                ChangesetMember {
                    path: validated_path(&manager, "a.txt"),
                    bytes: b"X".to_vec(),
                },
                ChangesetMember {
                    path: validated_path(&manager, "a.txt"),
                    bytes: b"Y".to_vec(),
                },
            ],
            removals: Vec::new(),
        })
        .await
        .expect_err("成员重复必须拒绝");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    let error = manager
        .commit_changeset(ChangesetRequest {
            session,
            scope: "workspace-1".into(),
            members: vec![ChangesetMember {
                path: validated_path(&manager, "a.txt"),
                bytes: b"X".to_vec(),
            }],
            removals: vec![validated_path(&manager, "a.txt")],
        })
        .await
        .expect_err("成员与删除交叉必须拒绝");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);

    // 内联体量闸（本管理器 `max_inline_bytes = 16`）：`TOO_LARGE`。
    let small = ResourceManager::new(
        ResourceLimits {
            max_inline_bytes: 16,
            ..ResourceLimits::default()
        },
        observer_arc(),
    );
    let small_session = writer_session(&small);
    mount_directory(&small, small_session, fixture.path());
    let error = small
        .commit_changeset(ChangesetRequest {
            session: small_session,
            scope: "workspace-1".into(),
            members: vec![ChangesetMember {
                path: validated_path(&small, "a.txt"),
                bytes: vec![7u8; 32],
            }],
            removals: Vec::new(),
        })
        .await
        .expect_err("超内联上限必须拒绝");
    assert_eq!(error.code(), RESOURCE_TOO_LARGE);

    // Workspace 形作用域删除：《04.04》§4.9 种类闸与单成员 `delete` 同拒
    // （`NOT_SUPPORTED`，`operation = delete`）——包级入口不放宽既有闸。
    let error = manager
        .commit_changeset(ChangesetRequest {
            session,
            scope: "workspace-1".into(),
            members: Vec::new(),
            removals: vec![validated_path(&manager, "a.txt")],
        })
        .await
        .expect_err("Workspace 形删除必须被种类闸拒绝");
    assert_eq!(error.code(), RESOURCE_NOT_SUPPORTED);
    assert_eq!(
        error.details().expect("scope details")["operation"],
        "delete"
    );

    // Plugin 形目录作用域（删除种类闸放行）：删除目标缺失与单成员 delete
    // 同形 `NOT_FOUND`。
    mount_directory_as(
        &manager,
        session,
        fixture.path(),
        "plugin-2",
        ScopeKind::Plugin,
    );
    let error = manager
        .commit_changeset(ChangesetRequest {
            session,
            scope: "plugin-2".into(),
            members: Vec::new(),
            removals: vec![validated_path(&manager, "ghost.txt")],
        })
        .await
        .expect_err("删除目标缺失必须拒绝");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);

    // 非目录态载体（内存域）：包级事务载体判定直拒 `NOT_SUPPORTED`。
    let memory_scope = manager.mount_memory(session).expect("内存域挂载");
    let error = manager
        .commit_changeset(ChangesetRequest {
            session,
            scope: memory_scope,
            members: vec![ChangesetMember {
                path: validated_path(&manager, "mem.txt"),
                bytes: b"M".to_vec(),
            }],
            removals: Vec::new(),
        })
        .await
        .expect_err("内存域无包级事务通道");
    assert_eq!(error.code(), RESOURCE_NOT_SUPPORTED);
    assert_eq!(
        error.details().expect("scope details")["operation"],
        "write"
    );

    // 缺 `resources:write` 的会话：写鉴权链直拒 `PERMISSION_DENIED`。
    // 以独立作用域名挂同一根（scope ID 全局唯一，避免重复登记）。
    let reader = session_with(&manager, &["resources:read"]);
    manager
        .mount_directory(
            reader,
            ScopeRegistration {
                scope: "workspace-2".into(),
                kind: ScopeKind::Workspace,
                owner: owner(),
                provider_id: "directory".into(),
                origin: Origin::Directory(fixture.path().to_path_buf()),
                policy: ScopePolicy {
                    read_only: false,
                    max_resource_bytes: 8 * 1024 * 1024,
                    allowed_hosts: Vec::new(),
                },
            },
        )
        .expect("读者会话作用域挂载必须成功");
    let error = manager
        .commit_changeset(ChangesetRequest {
            session: reader,
            scope: "workspace-2".into(),
            members: vec![ChangesetMember {
                path: validated_path(&manager, "a.txt"),
                bytes: b"N".to_vec(),
            }],
            removals: Vec::new(),
        })
        .await
        .expect_err("未授权写必须拒绝");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);

    // 全部拒绝臂零盘上动作、零残留。
    assert_eq!(fs::read(fixture.path().join("a.txt")).unwrap(), b"OLD");
    assert!(sweep_residue(fixture.path()).is_empty(), "拒绝臂零残留");
}

/// 观察者构造（与 `tests/journal_recovery.rs` 同源）。
fn observer_arc() -> std::sync::Arc<dyn chips_core::DecisionObserver> {
    std::sync::Arc::new(NoopDecisionObserver)
}
