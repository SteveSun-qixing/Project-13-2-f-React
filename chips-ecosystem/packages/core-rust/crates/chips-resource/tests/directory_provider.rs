//! 段二 B2 集成锁：DirectoryProvider 挂载与读面端到端面（《04》§3.2/§3.3、
//! 《04.05》§5.3 能力预检表、《06》§7.2/§7.3 错误形态）。
//!
//! 口径要点：真实文件系统目录域（临时夹具自建自清）；读面不整档入内存
//! （流式分块形态锁）；落位后宿主侧符号链接逃逸防御（PATH_INVALID +
//! reason=symlink，《06》§9.1）；能力预检在管理器层收口（只读临时域
//! READ_ONLY、Workspace/Document 写族 NOT_SUPPORTED）；`RESOURCE_BUSY`
//! 由句柄表在流占用期强制；目录域作用域不随创建者会话关闭自动摘除
//! （《06.03》§3.2 注销时机表，宿主显式注销）。错误码零自造。

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use chips_core::NoopDecisionObserver;

use chips_resource::error::{
    RESOURCE_ALREADY_EXISTS, RESOURCE_BUSY, RESOURCE_NOT_EMPTY, RESOURCE_NOT_FOUND,
    RESOURCE_NOT_SUPPORTED, RESOURCE_PATH_INVALID, RESOURCE_PERMISSION_DENIED, RESOURCE_READ_ONLY,
    RESOURCE_TOO_LARGE,
};
use chips_resource::{
    ByteRange, FsOpRequest, OpenRequest, Origin, ResourceLimits, ResourceManager, ScopeKind,
    ScopePolicy, ScopeRegistration, SessionKind, VirtualPath, WriteRequest,
};

/// 临时目录夹具：进程号 + 原子序号防碰撞，Drop 自清。
static FIXTURE_SEQ: AtomicU64 = AtomicU64::new(0);

struct TempRoot {
    root: PathBuf,
}

impl TempRoot {
    fn new(tag: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "chips-dir-it-{}-{}-{}",
            tag,
            std::process::id(),
            FIXTURE_SEQ.fetch_add(1, Ordering::SeqCst)
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("临时夹具根必须可建");
        Self { root }
    }
    fn path(&self) -> &Path {
        &self.root
    }
    fn write(&self, relative: &str, bytes: &[u8]) {
        let target = self.root.join(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).expect("父目录必须可建");
        }
        fs::write(target, bytes).expect("夹具文件必须可写");
    }
}

impl Drop for TempRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
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

/// 目录挂载快捷入口（默认 8 MiB 单资源上限，可写）。
fn mount_directory(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    scope: &str,
    kind: ScopeKind,
    root: &Path,
) -> String {
    mount_directory_with(manager, session, scope, kind, root, false, 8 * 1024 * 1024)
}

fn mount_directory_with(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    scope: &str,
    kind: ScopeKind,
    root: &Path,
    read_only: bool,
    max_resource_bytes: u64,
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
                    read_only,
                    max_resource_bytes,
                    allowed_hosts: Vec::new(),
                },
            },
        )
        .expect("目录挂载必须成功")
}

fn open_request(session: chips_core::SessionId, uri: &str) -> OpenRequest {
    OpenRequest {
        uri: uri.into(),
        session,
    }
}

fn fs_request(session: chips_core::SessionId, source: &str, target: Option<&str>) -> FsOpRequest {
    FsOpRequest {
        session,
        source: source.into(),
        target: target.map(str::to_owned),
        recursive: false,
    }
}

#[tokio::test]
async fn test_mount_directory_read_and_stream_lifecycle() {
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("lifecycle");
    fixture.write("notes/memo.txt", b"hello-directory");
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    assert!(manager.directory_mounted(&"workspace-1".to_owned()));
    let handle = manager
        .open(open_request(
            session,
            "chips-resource://workspace-1/notes/memo.txt",
        ))
        .await
        .expect("挂载会话读取放行");
    assert_eq!(
        handle.metadata.uri,
        "chips-resource://workspace-1/notes/memo.txt"
    );
    assert_eq!(handle.metadata.size, 15);
    assert_eq!(handle.metadata.mime_type, "text/plain");
    assert_eq!(handle.metadata.scope, ScopeKind::Workspace);
    // 版本戳 `mtime_secs-size` 形态（《04》§1.3）。
    let (mtime, size) = handle
        .metadata
        .version
        .split_once('-')
        .expect("版本戳必为 mtime-size 双段");
    assert!(mtime.parse::<u64>().expect("mtime 为秒级数字") > 0);
    assert_eq!(size.parse::<u64>().expect("size 为数字"), 15);
    let bytes = manager
        .read_range(
            handle.id,
            ByteRange {
                offset: 6,
                length: Some(9),
            },
        )
        .await
        .expect("范围读");
    assert_eq!(bytes, b"directory".to_vec());
    // 小上限逐块流读：非末块恰为 max_bytes，None 唯一终结。
    let mut streamed = Vec::new();
    let mut chunk_sizes = Vec::new();
    while let Some(chunk) = manager.read_chunk(handle.id, 4).await.expect("流读放行") {
        chunk_sizes.push(chunk.len());
        streamed.extend_from_slice(&chunk);
    }
    assert_eq!(chunk_sizes, vec![4, 4, 4, 3]);
    assert_eq!(streamed, b"hello-directory".to_vec());
    manager.release(handle.id).expect("释放放行");
}

#[tokio::test]
async fn test_directory_stream_chunk_cap_and_busy_occupancy() {
    // 300 KiB 载荷：读面全程无整档驻留（分块 ≤ 256 KiB 在册上限）。
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("busy");
    let payload: Vec<u8> = (0..300 * 1024).map(|index| (index % 251) as u8).collect();
    fixture.write("big.bin", &payload);
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    let handle = manager
        .open(open_request(
            session,
            "chips-resource://workspace-1/big.bin",
        ))
        .await
        .expect("打开放行");
    let first = manager
        .read_chunk(handle.id, 1024 * 1024)
        .await
        .expect("首拉")
        .expect("非结尾");
    assert_eq!(first.len(), 256 * 1024, "块长钳制到在册 256 KiB 上限");
    // 流占用期：其余读一律 RESOURCE_BUSY（句柄表强制，《06》§6.6）。
    let error = manager
        .read_range(
            handle.id,
            ByteRange {
                offset: 0,
                length: Some(4),
            },
        )
        .await
        .expect_err("占用期范围读必须 BUSY");
    assert_eq!(error.code(), RESOURCE_BUSY);
    assert_eq!(
        error.details().expect("busy details")["uri"],
        "chips-resource://workspace-1/big.bin"
    );
    let second = manager
        .read_chunk(handle.id, 1024 * 1024)
        .await
        .expect("次拉")
        .expect("非结尾");
    assert_eq!(second.len(), payload.len() - 256 * 1024, "末块为余量");
    assert!(
        manager
            .read_chunk(handle.id, 1024 * 1024)
            .await
            .expect("三拉")
            .is_none(),
        "None 唯一结束信号"
    );
    // 终结后槽位释放：范围读恢复放行。
    let bytes = manager
        .read_range(
            handle.id,
            ByteRange {
                offset: 0,
                length: Some(4),
            },
        )
        .await
        .expect("结束后范围读恢复");
    assert_eq!(bytes, payload[..4].to_vec());
    // 全量内容一致（游标严格累计、无空洞不重叠）。
    let mut streamed = Vec::new();
    while let Some(chunk) = manager
        .read_chunk(handle.id, 1024 * 1024)
        .await
        .expect("二次开流")
    {
        streamed.extend_from_slice(&chunk);
    }
    assert_eq!(streamed, payload);
    manager.release(handle.id).expect("释放");
}

#[tokio::test]
async fn test_directory_read_not_found_family() {
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("notfound");
    fixture.write("notes/memo.txt", b"m");
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    // 资源不存在：details 仅携 uri（《06》§7.3）。
    let error = manager
        .open(open_request(
            session,
            "chips-resource://workspace-1/absent.txt",
        ))
        .await
        .expect_err("缺失资源必须 NOT_FOUND");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    let details = error.details().expect("not-found details");
    assert_eq!(details["uri"], "chips-resource://workspace-1/absent.txt");
    assert!(
        details.get("path").is_none(),
        "真实路径不得入 details（《06》§7.1）"
    );
    // 作用域根与目录态路径不得作为资源读取（《06》§2.4）。
    let error = manager
        .open(open_request(session, "chips-resource://workspace-1/"))
        .await
        .expect_err("作用域根不可读");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    let error = manager
        .open(open_request(session, "chips-resource://workspace-1/notes"))
        .await
        .expect_err("目录不可作为资源");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    // 列举作用于文件与不存在目录：按 NOT_FOUND 收口（findings 登记裁定）。
    let error = manager
        .list_directory(open_request(
            session,
            "chips-resource://workspace-1/notes/memo.txt",
        ))
        .await
        .expect_err("文件无列举语义");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    let error = manager
        .list_directory(open_request(
            session,
            "chips-resource://workspace-1/absent-dir",
        ))
        .await
        .expect_err("不存在目录不可列举");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
}

#[cfg(unix)]
#[tokio::test]
async fn test_directory_symlink_escape_and_traversal_defense() {
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("escape");
    let outside = TempRoot::new("outside");
    fs::write(outside.path().join("secret.txt"), b"outside").unwrap();
    std::os::unix::fs::symlink(
        outside.path().join("secret.txt"),
        fixture.path().join("escape"),
    )
    .expect("夹具符号链接必须可建");
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    // 落位后宿主侧防御：根外符号链接 → PATH_INVALID + reason=symlink。
    for entry in [
        "chips-resource://workspace-1/escape",
        "chips-resource://workspace-1/escape/deeper.txt",
    ] {
        let error = manager
            .open(open_request(session, entry))
            .await
            .expect_err("根外符号链接必须拒绝（《06》§9.1）");
        assert_eq!(error.code(), RESOURCE_PATH_INVALID, "{entry}");
        let details = error.details().expect("路径族必携 details");
        assert_eq!(details["reason"], "symlink", "{entry}");
        assert_eq!(details["uri"], entry, "{entry}");
        let leaked = details
            .as_object()
            .expect("details 为对象")
            .iter()
            .any(|(_, value)| {
                value
                    .to_string()
                    .contains(&outside.path().to_string_lossy().to_string())
            });
        assert!(!leaked, "details 不得泄露根外真实路径");
    }
    // 语法层穿越臂先行拒绝（段一在册，行为不变）。
    let error = manager
        .open(open_request(
            session,
            "chips-resource://workspace-1/../secret",
        ))
        .await
        .expect_err("字面穿越必须语法级拒绝");
    assert_eq!(error.code(), RESOURCE_PATH_INVALID);
    assert_eq!(error.details().unwrap()["reason"], "segment");
}

#[tokio::test]
async fn test_directory_list_surface_shape() {
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("list");
    fixture.write("images/a.png", b"PNG");
    fixture.write("images/b.txt", b"T");
    fixture.write("images/.DS_Store", b"junk");
    fixture.write("images/Thumbs.db", b"junk");
    fs::create_dir(fixture.path().join("images/sub")).unwrap();
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    let entries = manager
        .list_directory(open_request(session, "chips-resource://workspace-1/images"))
        .await
        .expect("Workspace 列举放行");
    let names: Vec<&str> = entries.iter().map(|entry| entry.name.as_str()).collect();
    assert_eq!(
        names,
        vec!["a.png", "b.txt", "sub"],
        "隐藏点文件与 Thumbs.db 过滤、按名定序"
    );
    let directory = entries
        .iter()
        .find(|entry| entry.name == "sub")
        .expect("目录条目在册");
    assert!(directory.is_directory);
    let file = entries
        .iter()
        .find(|entry| entry.name == "b.txt")
        .expect("文件条目在册");
    assert!(!file.is_directory);
    assert_eq!(file.size, 1);
    assert!(file.modified_unix_seconds > 0, "mtime 可得即非零");
}

#[tokio::test]
async fn test_directory_too_large_at_open() {
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("toolarge");
    fixture.write("big.bin", &vec![9u8; 1024]);
    mount_directory_with(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
        false,
        512,
    );
    let error = manager
        .open(open_request(
            session,
            "chips-resource://workspace-1/big.bin",
        ))
        .await
        .expect_err("超作用域上限必须 TOO_LARGE");
    assert_eq!(error.code(), RESOURCE_TOO_LARGE);
    let details = error.details().expect("too-large details");
    assert_eq!(details["uri"], "chips-resource://workspace-1/big.bin");
    assert_eq!(details["size"], 1024);
    assert_eq!(details["limit"], 512);
}

#[tokio::test]
async fn test_mount_directory_duplicate_is_already_exists() {
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("dup");
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    let error = manager
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
                    max_resource_bytes: ResourceLimits::default().max_resource_bytes,
                    allowed_hosts: Vec::new(),
                },
            },
        )
        .expect_err("重复挂载作用域唯一");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    assert_eq!(
        error.details().expect("exists details")["uri"],
        "workspace-1"
    );
    // 未绑定会话不得触碰他域（跨会话传递禁止）。
    let outsider = session_with(&manager, &["resources:read"]);
    let error = manager
        .open(open_request(
            outsider,
            "chips-resource://workspace-1/any.txt",
        ))
        .await
        .expect_err("未绑定会话必须拒绝");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    assert_eq!(error.details().unwrap()["reason"], "out_of_scope");
}

#[tokio::test]
async fn test_directory_read_only_temporary_mount_arm() {
    // `dialog:open` 只读临时授权域：读/列举放行，写族在能力预检收口
    // READ_ONLY（《04.05》§5.3 只读来源臂）。
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("readonly");
    fixture.write("granted.txt", b"RO");
    mount_directory_with(
        &manager,
        session,
        "temp-1",
        ScopeKind::Temporary,
        fixture.path(),
        true,
        8 * 1024 * 1024,
    );
    let handle = manager
        .open(open_request(session, "chips-resource://temp-1/granted.txt"))
        .await
        .expect("只读域读取放行");
    assert_eq!(handle.metadata.size, 2);
    manager.release(handle.id).expect("释放");
    manager
        .list_directory(open_request(session, "chips-resource://temp-1"))
        .await
        .expect_err("作用域根不可列举");
    let error = manager
        .commit_write(WriteRequest {
            session,
            scope: "temp-1".into(),
            path: VirtualPath::validate("draft.txt", "u", manager.limits()).expect("在册路径"),
            bytes: vec![1],
        })
        .await
        .expect_err("只读授权不得持久化写");
    assert_eq!(error.code(), RESOURCE_READ_ONLY);
    // 工单044 §三.5 裁定⑧-2（B3 代码波落地）：READ_ONLY 的 details.uri
    // 一律回填精确目标 uri，权限矩阵臂与 writable_provider 臂统一形态。
    assert_eq!(
        error.details().expect("read-only details")["uri"],
        "chips-resource://temp-1/draft.txt"
    );
    let error = manager
        .delete(fs_request(
            session,
            "chips-resource://temp-1/granted.txt",
            None,
        ))
        .await
        .expect_err("只读授权不得删除");
    assert_eq!(error.code(), RESOURCE_READ_ONLY);
    assert_eq!(
        error.details().expect("delete read-only details")["uri"],
        "chips-resource://temp-1/granted.txt"
    );
}

#[tokio::test]
async fn test_directory_workspace_and_document_kind_gates() {
    // 《04.05》§5.3 种类门：delete 仅 Plugin/Temporary/Memory；
    // create_directory 仅 Plugin/Temporary；Workspace/Document 越界
    // 由管理器层 NOT_SUPPORTED 收口，不透传 Provider。
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let workspace_fixture = TempRoot::new("gate-ws");
    workspace_fixture.write("a.txt", b"A");
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        workspace_fixture.path(),
    );
    let document_fixture = TempRoot::new("gate-doc");
    document_fixture.write("b.txt", b"B");
    mount_directory(
        &manager,
        session,
        "card-1",
        ScopeKind::Document,
        document_fixture.path(),
    );
    for (uri, scope) in [
        ("chips-resource://workspace-1/a.txt", ScopeKind::Workspace),
        ("chips-resource://card-1/b.txt", ScopeKind::Document),
    ] {
        let error = manager
            .delete(fs_request(session, uri, None))
            .await
            .expect_err("该种类删除不在册");
        assert_eq!(error.code(), RESOURCE_NOT_SUPPORTED);
        let details = error.details().expect("scope details");
        assert_eq!(details["operation"], "delete");
        let expected = match scope {
            ScopeKind::Workspace => "workspace",
            _ => "document",
        };
        assert_eq!(details["scope"], expected);
        let error = manager
            .create_directory(fs_request(session, &format!("{uri}-dir"), None))
            .await
            .expect_err("该种类建目录不在册");
        assert_eq!(error.code(), RESOURCE_NOT_SUPPORTED);
        assert_eq!(error.details().unwrap()["operation"], "create_directory");
    }
}

#[tokio::test]
async fn test_directory_plugin_write_family_lifecycle() {
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("plugin");
    mount_directory(
        &manager,
        session,
        "plugin-1",
        ScopeKind::Plugin,
        fixture.path(),
    );
    // 建目录（幂等，《04.04》§4.9）→ 提交写 → 覆盖提交。
    manager
        .create_directory(fs_request(
            session,
            "chips-resource://plugin-1/assets",
            None,
        ))
        .await
        .expect("Plugin 建目录放行");
    manager
        .create_directory(fs_request(
            session,
            "chips-resource://plugin-1/assets",
            None,
        ))
        .await
        .expect("幂等：已存在目录返回成功");
    let metadata = manager
        .commit_write(WriteRequest {
            session,
            scope: "plugin-1".into(),
            path: VirtualPath::validate("assets/icon.png", "u", manager.limits())
                .expect("在册路径"),
            bytes: b"\x89PNG-fake".to_vec(),
        })
        .await
        .expect("持久化提交放行");
    assert_eq!(metadata.mime_type, "image/png");
    assert_eq!(
        fs::read(fixture.path().join("assets/icon.png")).unwrap(),
        b"\x89PNG-fake"
    );
    // rename 不覆盖 + 源消失；copy 不覆盖 + 双活。
    manager
        .commit_write(WriteRequest {
            session,
            scope: "plugin-1".into(),
            path: VirtualPath::validate("taken.txt", "u", manager.limits()).expect("在册路径"),
            bytes: b"T".to_vec(),
        })
        .await
        .expect("提交");
    let error = manager
        .rename(fs_request(
            session,
            "chips-resource://plugin-1/assets/icon.png",
            Some("chips-resource://plugin-1/taken.txt"),
        ))
        .await
        .expect_err("rename 不覆盖（《04.04》§4.9）");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    manager
        .rename(fs_request(
            session,
            "chips-resource://plugin-1/assets/icon.png",
            Some("chips-resource://plugin-1/moved.png"),
        ))
        .await
        .expect("会话内 rename");
    assert!(!fixture.path().join("assets/icon.png").exists());
    let copy = manager
        .copy(fs_request(
            session,
            "chips-resource://plugin-1/moved.png",
            Some("chips-resource://plugin-1/copy.png"),
        ))
        .await
        .expect("会话内 copy");
    assert_eq!(copy.size, 9);
    let error = manager
        .copy(fs_request(
            session,
            "chips-resource://plugin-1/moved.png",
            Some("chips-resource://plugin-1/copy.png"),
        ))
        .await
        .expect_err("copy 不覆盖");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    // 非递归删除：空目录放行、非空目录 NOT_EMPTY（《06》§7.2）。
    manager
        .delete(fs_request(
            session,
            "chips-resource://plugin-1/assets",
            None,
        ))
        .await
        .expect("move 空后的 assets 空目录删除放行");
    manager
        .create_directory(fs_request(session, "chips-resource://plugin-1/full", None))
        .await
        .expect("建目录");
    manager
        .commit_write(WriteRequest {
            session,
            scope: "plugin-1".into(),
            path: VirtualPath::validate("full/x.txt", "u", manager.limits()).expect("在册路径"),
            bytes: vec![1],
        })
        .await
        .expect("提交");
    let error = manager
        .delete(fs_request(session, "chips-resource://plugin-1/full", None))
        .await
        .expect_err("非空目录非递归删除必须 NOT_EMPTY");
    assert_eq!(error.code(), RESOURCE_NOT_EMPTY);
    assert_eq!(
        error.details().expect("not-empty details")["uri"],
        "chips-resource://plugin-1/full"
    );
    // 原子写临时文件零残留（《04.04》§4.9 落地路径卫生）。
    let residue = fs::read_dir(fixture.path())
        .expect("根可列举")
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .starts_with(".chips-tmp-")
        })
        .count();
    assert_eq!(residue, 0, "提交成功不得残留临时文件");
}

#[tokio::test]
async fn test_unregister_scope_detaches_directory_root() {
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("unregister");
    fixture.write("a.txt", b"A");
    let scope = mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    manager
        .open(open_request(session, "chips-resource://workspace-1/a.txt"))
        .await
        .expect("在册读取");
    manager.unregister_scope(&scope).expect("注销放行");
    // 作用域出册：读面按 NOT_FOUND 收口；Provider 侧根同步摘除。
    let error = manager
        .open(open_request(session, "chips-resource://workspace-1/a.txt"))
        .await
        .expect_err("出册作用域不可读");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    assert!(!manager.directory_mounted(&scope), "注销必须 detach 根挂载");
    // 摘除后可重挂（无半挂载残留）。
    mount_directory(
        &manager,
        session,
        "workspace-1",
        ScopeKind::Workspace,
        fixture.path(),
    );
    manager
        .open(open_request(session, "chips-resource://workspace-1/a.txt"))
        .await
        .expect("重挂后读取放行");
}

#[tokio::test]
async fn test_directory_scope_survives_creator_session_close() {
    // 目录域注销时机为宿主驱动（《06.03》§3.2）：创建者会话关闭不自动
    // 摘除作用域（区别于 Memory 挂载的 B1 驱逐臂）。
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let session = writer_session(&manager);
    let fixture = TempRoot::new("survive");
    fixture.write("a.txt", b"A");
    let scope = mount_directory(
        &manager,
        session,
        "temp-9",
        ScopeKind::Temporary,
        fixture.path(),
    );
    manager.close_session(session).expect("创建者会话关闭");
    assert!(
        manager.scopes().lookup(&scope).is_some(),
        "目录域不随会话驱逐"
    );
    assert!(manager.directory_mounted(&scope));
    let fresh = writer_session(&manager);
    let error = manager
        .open(open_request(fresh, "chips-resource://temp-9/a.txt"))
        .await
        .expect_err("未绑定新会话仍需授权");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    manager.attach_scope(fresh, &scope).expect("宿主显式绑定");
    manager
        .open(open_request(fresh, "chips-resource://temp-9/a.txt"))
        .await
        .expect("绑定后放行（根仍挂载）");
    manager.unregister_scope(&scope).expect("宿主显式注销放行");
    assert!(!manager.directory_mounted(&scope));
}
