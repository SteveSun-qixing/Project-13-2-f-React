//! 工单036 波 C2a-1 集成锁：提交日志（写意图落盘 prepare–commit 两相）、
//! 挂载时恢复扫描（崩溃中间态确定性收敛）与孤儿临时物回收（无账不删判据）。
//!
//! 口径要点：夹具一律真实临时目录（Drop 自清）；「崩溃」以协议落盘时序的
//! 磁盘终态复现（意图记录先于临时物在册、终结未及），不 mock 运行时；
//! 恢复扫描的公开可达性即 `mount_directory` / `register_temp_scope` 汇聚
//! seam（`attach_root`）；处置账目经 `directory_recovery_report` 查询。
//! 四类判据：①崩溃中间态重启后收敛（残体回滚 + 目标旧态 + 记录终结）；
//! ②并发在途不被误删（同进程在途账保护，双挂载/重叠根形态）；③日志与
//! 真实文件系统状态一致性（记录内容 ↔ 临时物/目标逐项对表、终结零残留）；
//! ④级联中止与日志协同（会话关闭/作用域注销撤账零残留）。错误码零新增
//! （恢复面不产错、写侧失败复用在册 `RESOURCE_WRITE_FAILED`）。

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use chips_core::NoopDecisionObserver;

use chips_resource::{
    CommitRecord, FsOpRequest, JournalRecoveryReport, Origin, ResourceLimits, ResourceManager,
    ScopeKind, ScopePolicy, ScopeRegistration, SessionKind, VirtualPath, WriteRequest,
    WriteStreamRequest, JOURNAL_FILE_SUFFIX, TEMP_FILE_PREFIX,
};

/// 临时夹具序号（进程号 + 原子序号防碰撞）。
static FIXTURE_SEQ: AtomicU64 = AtomicU64::new(0);

/// 临时目录夹具：Drop 自清。
struct TempRoot(PathBuf);

impl TempRoot {
    fn new(tag: &str) -> Self {
        let base = std::env::temp_dir().join(format!(
            "chips-journal-it-{}-{}-{}",
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

fn writer_session(manager: &ResourceManager) -> chips_core::SessionId {
    manager
        .open_session(
            SessionKind::Document,
            &owner(),
            BTreeSet::new(),
            ["resources:read", "resources:write"]
                .iter()
                .map(|permission| (*permission).to_owned())
                .collect::<Vec<_>>(),
        )
        .expect("会话创建必须成功")
}

fn mount_directory(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    scope: &str,
    kind: ScopeKind,
    root: &Path,
) -> String {
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
        .expect("目录挂载必须成功")
}

fn commit_request(
    session: chips_core::SessionId,
    scope: &str,
    path: &str,
    bytes: Vec<u8>,
    manager: &ResourceManager,
) -> WriteRequest {
    WriteRequest {
        session,
        scope: scope.into(),
        path: VirtualPath::validate(path, "chips-resource://probe", manager.limits())
            .expect("在册路径"),
        bytes,
    }
}

/// 目录下全部 `.chips-tmp-*` 族残留探测（含 sidecar 记录，递归）。
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

/// 落一份「崩溃残留」磁盘终态：意图记录（含内容）+ 同名临时物。
/// 返回 (记录路径, 临时物路径)。
fn plant_crash_state(
    dir: &Path,
    token: &str,
    temp_relative: &str,
    target_relative: &str,
) -> (PathBuf, PathBuf) {
    let temp_path = dir.join(format!("{TEMP_FILE_PREFIX}{token}"));
    let journal_path = dir.join(format!("{TEMP_FILE_PREFIX}{token}{JOURNAL_FILE_SUFFIX}"));
    fs::write(&temp_path, b"half-written").expect("夹具临时物必须可写");
    let record = CommitRecord {
        temp: temp_relative.to_owned(),
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

/// 恢复扫描判据面：records/temps 处置账目。
fn assert_disposal(
    report: &JournalRecoveryReport,
    removed_records: usize,
    reclaimed_temp_files: usize,
    unbacked_temp_files: usize,
) {
    assert_eq!(
        (
            report.removed_records,
            report.reclaimed_temp_files,
            report.unbacked_temp_files
        ),
        (removed_records, reclaimed_temp_files, unbacked_temp_files),
        "处置账目必须逐值命中（报告形制：removed/…）：{report:?}"
    );
}

// ---------------------------------------------------------------------------
// ① 崩溃中间态重启后收敛
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_crashed_prepare_renamed_target_survives_and_ledger_converges() {
    // 「临时物已建但未 rename」中间态（prepare 相落盘后进程崩溃）：
    // 重启挂载 → 回滚删临时物、终结记录，目标保持旧态（既有失败回滚语义）。
    let fixture = TempRoot::new("crash-rollback");
    fixture.write("notes.txt", b"OLD");
    let target = fixture.path().join("notes.txt");
    let (journal_path, temp_path) = plant_crash_state(
        fixture.path(),
        "950001-1",
        ".chips-tmp-950001-1",
        "notes.txt",
    );
    assert!(journal_path.is_file() && temp_path.is_file());

    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    let report = manager
        .directory_recovery_report(&"workspace-1".to_owned())
        .expect("挂载即产恢复报告");
    assert_disposal(&report, 1, 1, 0);
    assert_eq!(report.io_failures, 0, "{report:?}");
    assert!(!temp_path.exists());
    assert!(!journal_path.exists());
    assert_eq!(
        fs::read(&target).expect("目标仍可读"),
        b"OLD",
        "目标保持旧态"
    );
    // 收敛后正常提交仍可覆盖目标（旧态→新态原子换代）。
    manager
        .commit_write(commit_request(
            session,
            "workspace-1",
            "notes.txt",
            b"NEW".to_vec(),
            &manager,
        ))
        .await
        .expect("收敛后提交放行");
    assert_eq!(fs::read(&target).expect("目标仍可读"), b"NEW");
    assert!(sweep_residue(fixture.path()).is_empty(), "成功提交零残留");
}

#[tokio::test]
async fn test_completed_but_unfinalized_journal_never_touches_new_target() {
    // 「已完成但日志未及终结」中间态（rename 落定、记录撤销前崩溃）：
    // 记录在、临时物不在 → 只撤记录，绝不误删合法（新态）目标。
    let fixture = TempRoot::new("crash-committed");
    fixture.write("report.md", b"FINAL");
    let (journal_path, temp_path) = plant_crash_state(
        fixture.path(),
        "950002-1",
        ".chips-tmp-950002-1",
        "report.md",
    );
    // 注意：撤销同名临时物（rename 已成功的磁盘终态 = 记录在、临时物不在）。
    fs::remove_file(&temp_path).expect("夹具撤临时物");
    manager_mount_and_scan_at(fixture.path(), "workspace-1");
    assert!(!journal_path.exists(), "残记录被终结");
    assert!(
        fixture.path().join("report.md").is_file(),
        "新态目标绝不误删"
    );
    assert_eq!(
        fs::read(fixture.path().join("report.md")).unwrap(),
        b"FINAL"
    );
}

#[tokio::test]
async fn test_corrupted_journal_content_still_finalizes_by_name_binding() {
    // 记录内容损坏（断电半写）仍按文件名词柄配对处置：同名临时物回滚删除、
    // 残记录终结、目标不动。
    let fixture = TempRoot::new("crash-corrupt");
    fixture.write("keep.txt", b"KEEP");
    let temp = fixture.path().join(".chips-tmp-950003-1");
    fs::write(&temp, b"junk").expect("夹具临时物必须可写");
    let journal = fixture.path().join(".chips-tmp-950003-1.j");
    fs::write(&journal, b"{\"temp\": \"truncated").expect("夹具残记录必须可写");
    let manager = manager_mount_and_scan_at(fixture.path(), "workspace-1");
    let report = manager
        .directory_recovery_report(&"workspace-1".to_owned())
        .expect("挂载即产恢复报告");
    assert_disposal(&report, 1, 1, 0);
    assert!(!temp.exists() && !journal.exists());
    assert!(fixture.path().join("keep.txt").is_file(), "目标保持旧态");
}

#[tokio::test]
async fn test_crashed_state_in_nested_directory_is_converged() {
    // 恢复扫描全树覆盖：子目录内的崩溃中间态同样收敛（不跟随符号链接的
    // 深度预算遍历）。
    let fixture = TempRoot::new("crash-nested");
    fs::create_dir_all(fixture.path().join("assets/img")).expect("夹具子目录必须可建");
    fixture.write("assets/img/a.png", b"PNG-OLD");
    let (journal_path, temp_path) = plant_crash_state(
        &fixture.path().join("assets/img"),
        "950004-1",
        "assets/img/.chips-tmp-950004-1",
        "assets/img/a.png",
    );
    let manager = manager_mount_and_scan_at(fixture.path(), "workspace-1");
    let report = manager
        .directory_recovery_report(&"workspace-1".to_owned())
        .expect("挂载即产恢复报告");
    assert_disposal(&report, 1, 1, 0);
    assert!(!temp_path.exists());
    assert!(!journal_path.exists());
    assert!(fixture.path().join("assets/img/a.png").is_file());
}

// ---------------------------------------------------------------------------
// ② 并发在途不被误删（在途账单源判据）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_in_flight_stream_survives_concurrent_mount_recovery_scan() {
    // 同进程并发在途：作用域 A 的目录写流打开（意图记录已落盘）期间，
    // 作用域 B 挂载同一根触发恢复扫描——在途账保护，记录与临时物原样
    // 幸存；流随后正常提交成功（新态落定、账目零残留）。
    let fixture = TempRoot::new("inflight-same-root");
    fixture.write("data.bin", b"OLD");
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    let handle = manager
        .open_write_stream(WriteStreamRequest {
            session,
            scope: "workspace-1".into(),
            path: VirtualPath::validate("data.bin", "u", manager.limits()).expect("在册路径"),
            expected_size: Some(4),
        })
        .expect("写流打开");
    manager
        .append_write_stream(&handle, b"NEWW")
        .expect("分块送入");
    let temp_names = sweep_residue(fixture.path());
    assert_eq!(temp_names.len(), 2, "在途 = 临时物 + sidecar 记录");

    // 另一管理器实例（同进程）挂载同一根 → 恢复扫描必须跳过在途记录。
    let other = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let other_session = writer_session(&other);
    mount_directory(
        &other,
        other_session,
        "workspace-2",
        ScopeKind::Workspace,
        fixture.path(),
    );
    let report = other
        .directory_recovery_report(&"workspace-2".to_owned())
        .expect("挂载即产恢复报告");
    assert_eq!(report.skipped_in_flight, 1, "在途记录必须计入跳过保护");
    assert_eq!(
        (report.removed_records, report.reclaimed_temp_files),
        (0, 0),
        "在途零处置：{report:?}"
    );
    assert_eq!(report.unbacked_temp_files, 0, "有账临时物不得计为无账");
    assert_eq!(sweep_residue(fixture.path()).len(), 2, "在途残体原样幸存");

    let metadata = manager
        .commit_write_stream(handle)
        .await
        .expect("在途保护后正常提交");
    assert_eq!(metadata.size, 4);
    assert_eq!(fs::read(fixture.path().join("data.bin")).unwrap(), b"NEWW");
    assert!(sweep_residue(fixture.path()).is_empty(), "提交后零残留");
}

#[tokio::test]
async fn test_unbacked_temp_and_foreign_shape_are_kept_not_deleted() {
    // 无意图账支撑的 `.chips-tmp-*`（协议外对象/他进程形态）：按「存在即
    // 删」禁令一律保留不删、如实计数；在册名形态之外（如目录伪装名）
    // 同样不触碰。
    let fixture = TempRoot::new("unbacked");
    fixture.write(".chips-tmp-950005-1", b"someone-else");
    fs::create_dir(fixture.path().join(".chips-tmp-950005-2.j")).expect("夹具伪目录必须可建");
    fixture.write(".chips-tmp-not-a-token", b"shape-mismatch");
    let manager = manager_mount_and_scan_at(fixture.path(), "workspace-1");
    let report = manager
        .directory_recovery_report(&"workspace-1".to_owned())
        .expect("挂载即产恢复报告");
    assert_eq!(report.unbacked_temp_files, 1, "仅严格名形态无账临时物计数");
    assert_eq!(
        (report.removed_records, report.reclaimed_temp_files),
        (0, 0),
        "{report:?}"
    );
    assert!(
        fixture.path().join(".chips-tmp-950005-1").is_file(),
        "无账不删"
    );
    assert!(fixture.path().join(".chips-tmp-950005-2.j").is_dir());
    assert!(fixture.path().join(".chips-tmp-not-a-token").is_file());
}

// ---------------------------------------------------------------------------
// ③ 日志与真实文件系统状态一致性
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_journal_record_matches_real_fs_state_during_stream() {
    // 在途一致性：sidecar 记录与临时物同目录成对存在（文件名配对单源）；
    // 经管理器公开入口驱动真实写流，随后走一次「模拟重启」的恢复扫描
    // （显式 `recover_root` 公开入口）——在途账保护下账实相符、零处置。
    let fixture = TempRoot::new("consistency");
    fs::create_dir_all(fixture.path().join("sub")).expect("夹具子目录必须可建");
    fixture.write("sub/target.txt", b"OLD");
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    let handle = manager
        .open_write_stream(WriteStreamRequest {
            session,
            scope: "workspace-1".into(),
            path: VirtualPath::validate("sub/target.txt", "u", manager.limits()).expect("在册路径"),
            expected_size: None,
        })
        .expect("写流打开");
    manager
        .append_write_stream(&handle, b"PARTIAL")
        .expect("分块送入");
    // 磁盘终态：恰一对临时物 + 记录（同目录 sidecar 配对）。
    let residue = sweep_residue(fixture.path());
    assert_eq!(residue.len(), 2);
    let journal_path = PathBuf::from(
        residue
            .iter()
            .find(|name| name.ends_with(JOURNAL_FILE_SUFFIX))
            .expect("必有记录"),
    );
    let temp_path = PathBuf::from(
        journal_path
            .to_string_lossy()
            .trim_end_matches(JOURNAL_FILE_SUFFIX)
            .to_string(),
    );
    assert!(temp_path.is_file());
    assert_eq!(
        temp_path.parent(),
        Some(fixture.path().join("sub").as_path()),
        "记录与临时物同目录成对"
    );
    let record = chips_resource::read_commit_record(&journal_path).expect("在册记录必可解析");
    // 逐值对表：记录 temp/target 为相对挂载根路径，与磁盘实况一致。
    assert!(record.temp.contains(TEMP_FILE_PREFIX));
    assert!(temp_path
        .file_name()
        .is_some_and(|name| record.temp.ends_with(&name.to_string_lossy().into_owned())));
    assert!(record.temp.starts_with("sub/"), "temp 相对挂载根登记");
    assert_eq!(record.target, "sub/target.txt");
    assert!(record.created_unix_ms > 0);
    // 在途保护复核（公开显式扫描入口，与挂载接线同一实现）。
    let report = chips_resource::recover_root(fixture.path());
    assert_eq!(report.skipped_in_flight, 1, "账载在途 ⇒ 扫描零处置");
    assert_eq!(report.unbacked_temp_files, 0);
    manager.abort_write_stream(&handle).expect("中止在途流");
    assert!(sweep_residue(fixture.path()).is_empty(), "中止后账实两清");
    assert_eq!(
        fs::read(fixture.path().join("sub/target.txt")).unwrap(),
        b"OLD"
    );
}

#[tokio::test]
async fn test_successful_commit_and_copy_leave_no_ledger_or_temp() {
    // 正常路径两相收口：一次性提交与拷贝落盘后，意图记录与临时物同步
    // 撤销（终结单通道），根目录只剩在册成员。
    let fixture = TempRoot::new("clean-commit");
    fixture.write("seed.txt", b"SEED");
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    manager
        .commit_write(commit_request(
            session,
            "workspace-1",
            "fresh.txt",
            b"FRESH".to_vec(),
            &manager,
        ))
        .await
        .expect("一次性提交");
    manager
        .copy(FsOpRequest {
            session,
            source: "chips-resource://workspace-1/seed.txt".into(),
            target: Some("chips-resource://workspace-1/seed-copy.txt".into()),
            recursive: false,
        })
        .await
        .expect("拷贝落盘");
    assert!(sweep_residue(fixture.path()).is_empty(), "成功路径零账残");
    assert_eq!(
        fs::read(fixture.path().join("fresh.txt")).unwrap(),
        b"FRESH"
    );
    assert_eq!(
        fs::read(fixture.path().join("seed-copy.txt")).unwrap(),
        b"SEED"
    );
}

// ---------------------------------------------------------------------------
// ④ 级联中止与日志协同
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_session_close_and_scope_unregister_undo_journal_with_temp() {
    // 会话关闭级联与作用域注销级联中止在途写流：临时物与意图记录经同一
    // Drop 通道同步撤销（临时物先、记录后），恢复扫描复跑零可处置残留。
    for cascade in ["close_session", "unregister_scope"] {
        let fixture = TempRoot::new(&format!("cascade-{cascade}"));
        fixture.write("cascade.txt", b"OLD");
        let manager =
            ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
        let session = writer_session(&manager);
        let scope = mount_directory(
            &manager,
            session,
            "workspace-1",
            ScopeKind::Workspace,
            fixture.path(),
        );
        let handle = manager
            .open_write_stream(WriteStreamRequest {
                session,
                scope: "workspace-1".into(),
                path: VirtualPath::validate("cascade.txt", "u", manager.limits())
                    .expect("在册路径"),
                expected_size: None,
            })
            .expect("写流打开");
        manager
            .append_write_stream(&handle, b"INFLIGHT")
            .expect("分块送入");
        assert_eq!(sweep_residue(fixture.path()).len(), 2, "级联前在途成对");
        match cascade {
            "close_session" => manager.close_session(session).expect("会话关闭"),
            _ => manager.unregister_scope(&scope).expect("作用域注销"),
        }
        assert_eq!(manager.open_write_stream_count(), 0, "级联清空写流登记");
        assert!(sweep_residue(fixture.path()).is_empty(), "级联撤账零残留");
        assert_eq!(
            fs::read(fixture.path().join("cascade.txt")).unwrap(),
            b"OLD",
            "级联中止目标保持旧态"
        );
        // 级联后复扫：无残体可处置（账实两清的确定性证明）。
        let report = chips_resource::recover_root(fixture.path());
        assert_eq!(
            report,
            JournalRecoveryReport::default(),
            "级联后复扫必为全零账目：{report:?}"
        );
    }
}

#[tokio::test]
async fn test_overflow_rollback_removes_journal_alongside_temp() {
    // 写流超限回滚（append 超 max_resource_bytes → TOO_LARGE 弃记录）同样
    // 经 sink Drop 撤意图记录：回滚后账实两清、目标旧态。
    let fixture = TempRoot::new("overflow");
    fixture.write("cap.txt", b"OLD");
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    manager
        .mount_directory(
            session,
            ScopeRegistration {
                scope: "workspace-1".into(),
                kind: ScopeKind::Workspace,
                owner: owner(),
                provider_id: "directory".into(),
                origin: Origin::Directory(fixture.path().to_path_buf()),
                policy: ScopePolicy {
                    read_only: false,
                    // 16 字节作用域上限：送入 32 字节必超限回滚。
                    max_resource_bytes: 16,
                    allowed_hosts: Vec::new(),
                },
            },
        )
        .expect("目录挂载必须成功");
    let handle = manager
        .open_write_stream(WriteStreamRequest {
            session,
            scope: "workspace-1".into(),
            path: VirtualPath::validate("cap.txt", "u", manager.limits()).expect("在册路径"),
            expected_size: None,
        })
        .expect("写流打开");
    let error = manager
        .append_write_stream(&handle, &[7u8; 32])
        .expect_err("超限必须回滚");
    assert_eq!(error.code(), chips_resource::error::RESOURCE_TOO_LARGE);
    assert!(sweep_residue(fixture.path()).is_empty(), "回滚撤账零残留");
    assert_eq!(fs::read(fixture.path().join("cap.txt")).unwrap(), b"OLD");
}

/// 便捷通道：挂一个新管理器并挂载根（触发挂载即恢复扫描）。
fn manager_mount_and_scan_at(root: &Path, scope: &str) -> ResourceManager {
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    mount_directory(&manager, session, scope, ScopeKind::Workspace, root);
    manager
}
