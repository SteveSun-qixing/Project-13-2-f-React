//! 段二 B3 集成锁：ArchiveProvider 挂载面（`mount_archive`）、归档域
//! Manager 读面端到端、写入族只读臂统一形（工单044 §三.5 裁定⑧-2：
//! `RESOURCE_READ_ONLY` 的 `details.uri` 一律精确目标 uri），与流式写入
//! 提交面（`open_write_stream → append_write_stream → commit_write_stream /
//! abort_write_stream`，《04.04》§4.8）+ `WriteCoordinator` 路径写锁
//! （《04.04》§4.9、《04.13》§13-3 写路径唯一）的 Manager 层全景。
//!
//! 口径要点：ZIP 夹具自建自清（Store + Deflate + 目录条目 + 隐藏条目）；
//! 归档域 `provider_id` 强制归一、`policy.read_only` 强制翻真；挂载失败
//! 回滚不留半挂载态；归档域不随 `close_session` 自动摘除（《06.03》§3.2，
//! 宿主显式注销）；流式写临时文件失败/中止/级联中断均零残留（《04.04》
//! §4.9）；同路径第二个写者排队等待（单写者）。错误码零自造。

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use chips_resource::error::{
    RESOURCE_ALREADY_EXISTS, RESOURCE_INTERNAL, RESOURCE_NOT_FOUND, RESOURCE_PERMISSION_DENIED,
    RESOURCE_READ_ONLY, RESOURCE_TOO_LARGE, RESOURCE_WRITE_FAILED,
};
use chips_resource::{
    FsOpRequest, OpenRequest, Origin, ResourceManager, ScopeKind, ScopePolicy, ScopeRegistration,
    SessionKind, VirtualPath, WriteRequest, WriteStreamHandle, WriteStreamRequest,
};

/// 临时夹具序号（进程号 + 原子序号防碰撞）。
static FIXTURE_SEQ: AtomicU64 = AtomicU64::new(0);

/// 临时夹具目录根（进程号 + 原子序号防碰撞，Drop 自清）。
fn fixture_root(tag: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "chips-b3-it-{}-{}-{}",
        tag,
        std::process::id(),
        FIXTURE_SEQ.fetch_add(1, Ordering::SeqCst)
    ))
}

/// 归档夹具文件路径（`.card` 后缀，Drop 自删）。
fn fixture_archive_path(tag: &str) -> PathBuf {
    fixture_root(tag).with_extension("card")
}

/// 临时目录夹具：Drop 自清。
struct TempRoot {
    root: PathBuf,
}

impl TempRoot {
    fn new(tag: &str) -> Self {
        let root = fixture_root(tag);
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

/// 写临时文件的 B3 残留探测（`.chips-tmp-*` 前缀，《04.04》§4.9 零残留）。
fn temp_residue(root: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(root)
        .expect("夹具根必须可扫描")
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| name.starts_with(".chips-tmp-"))
        .collect();
    names.sort();
    names
}

/// 归档夹具文件（Drop 自删）。
struct TempArchive(PathBuf);

impl TempArchive {
    fn new(bytes: &[u8]) -> Self {
        let path = fixture_archive_path("archive");
        fs::write(&path, bytes).expect("夹具归档必须可写");
        Self(path)
    }
    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempArchive {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

// ---------------------------------------------------------------------------
// ZIP 夹具构造（Store + Deflate 裸存储块 + 目录条目 + 隐藏条目）
// ---------------------------------------------------------------------------

fn crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for byte in data {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            crc = if crc & 1 == 1 {
                (crc >> 1) ^ 0xEDB8_8320
            } else {
                crc >> 1
            };
        }
    }
    !crc
}

/// Deflate 裸存储块（BTYPE=00，`deflate-member` 夹具免真实压缩）。
fn deflate_stored_block(plain: &[u8]) -> Vec<u8> {
    let len = u16::try_from(plain.len()).expect("夹具长度受限");
    let mut compressed = vec![0x01u8];
    compressed.extend_from_slice(&len.to_le_bytes());
    compressed.extend_from_slice(&(!len).to_le_bytes());
    compressed.extend_from_slice(plain);
    compressed
}

fn zip_entry(name: &str, data: &[u8], method: u16) -> (Vec<u8>, Vec<u8>) {
    let name_bytes = name.as_bytes();
    let stored: Vec<u8> = if method == 8 {
        deflate_stored_block(data)
    } else {
        data.to_vec()
    };
    let checksum = crc32(data);
    let mut local = Vec::new();
    local.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
    local.extend_from_slice(&20u16.to_le_bytes());
    local.extend_from_slice(&0x0800u16.to_le_bytes());
    local.extend_from_slice(&method.to_le_bytes());
    local.extend_from_slice(&0u16.to_le_bytes());
    local.extend_from_slice(&0x0021u16.to_le_bytes());
    local.extend_from_slice(&checksum.to_le_bytes());
    local.extend_from_slice(&(stored.len() as u32).to_le_bytes());
    local.extend_from_slice(&(data.len() as u32).to_le_bytes());
    local.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
    local.extend_from_slice(&0u16.to_le_bytes());
    local.extend_from_slice(name_bytes);
    local.extend_from_slice(&stored);
    let mut central = Vec::new();
    central.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
    central.extend_from_slice(&20u16.to_le_bytes());
    central.extend_from_slice(&20u16.to_le_bytes());
    central.extend_from_slice(&0x0800u16.to_le_bytes());
    central.extend_from_slice(&method.to_le_bytes());
    central.extend_from_slice(&0u16.to_le_bytes());
    central.extend_from_slice(&0x0021u16.to_le_bytes());
    central.extend_from_slice(&checksum.to_le_bytes());
    central.extend_from_slice(&(stored.len() as u32).to_le_bytes());
    central.extend_from_slice(&(data.len() as u32).to_le_bytes());
    central.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
    central.extend_from_slice(&0u16.to_le_bytes());
    central.extend_from_slice(&0u16.to_le_bytes());
    central.extend_from_slice(&0u16.to_le_bytes());
    central.extend_from_slice(&0u16.to_le_bytes());
    central.extend_from_slice(&0u32.to_le_bytes());
    central.extend_from_slice(&0u32.to_le_bytes());
    central.extend_from_slice(name_bytes);
    (local, central)
}

/// 组装完整归档：局部头区按序拼接，中央目录回填真实偏移。
fn zip_archive(specs: &[(&str, &[u8], u16)]) -> Vec<u8> {
    let mut locals = Vec::new();
    for (name, data, method) in specs {
        locals.push(zip_entry(name, data, *method));
    }
    let mut archive = Vec::new();
    let mut offsets = Vec::new();
    for (local, _) in &locals {
        offsets.push(archive.len() as u32);
        archive.extend_from_slice(local);
    }
    let central_offset = archive.len() as u32;
    for ((_, central), offset) in locals.iter().zip(&offsets) {
        let mut central = central.clone();
        // 回填本地头偏移（中央目录第 46 字节起 u32）。
        central[42..46].copy_from_slice(&offset.to_le_bytes());
        archive.extend_from_slice(&central);
    }
    let central_size = archive.len() as u32 - central_offset;
    archive.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
    archive.extend_from_slice(&0u16.to_le_bytes());
    archive.extend_from_slice(&0u16.to_le_bytes());
    archive.extend_from_slice(&(locals.len() as u16).to_le_bytes());
    archive.extend_from_slice(&(locals.len() as u16).to_le_bytes());
    archive.extend_from_slice(&central_size.to_le_bytes());
    archive.extend_from_slice(&central_offset.to_le_bytes());
    archive.extend_from_slice(&0u16.to_le_bytes());
    archive
}

/// 在册夹具归档：目录条目 + 嵌套 Store + 隐藏条目 + Deflate 成员。
fn fixture_archive_bytes() -> Vec<u8> {
    zip_archive(&[
        ("content/", b"", 0),
        ("content/note.txt", b"hello archive", 0),
        (".DS_Store", b"junk", 0),
        ("content/deep/video.mp4", b"\0\x01\x02\x03", 0),
        ("content/deflated.txt", b"deflate-member", 8),
    ])
}

// ---------------------------------------------------------------------------
// 会话与挂载快捷入口
// ---------------------------------------------------------------------------

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

fn archive_registration(scope: &str, kind: ScopeKind, path: &Path) -> ScopeRegistration {
    ScopeRegistration {
        scope: scope.into(),
        kind,
        owner: owner(),
        provider_id: "archive".into(),
        origin: Origin::Archive(path.to_path_buf()),
        policy: ScopePolicy {
            read_only: false,
            max_resource_bytes: 8 * 1024 * 1024,
            allowed_hosts: Vec::new(),
        },
    }
}

fn mount_archive(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    scope: &str,
    path: &Path,
) -> String {
    manager
        .mount_archive(
            session,
            archive_registration(scope, ScopeKind::Document, path),
        )
        .expect("归档挂载必须成功")
}

fn mount_directory(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    scope: &str,
    root: &Path,
    max_resource_bytes: u64,
) -> String {
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

fn vpath(manager: &ResourceManager, path: &str) -> VirtualPath {
    VirtualPath::validate(path, "u", manager.limits()).expect("在册路径")
}

fn stream_request(
    manager: &ResourceManager,
    session: chips_core::SessionId,
    scope: &str,
    path: &str,
    expected_size: Option<u64>,
) -> WriteStreamRequest {
    WriteStreamRequest {
        session,
        scope: scope.into(),
        path: vpath(manager, path),
        expected_size,
    }
}

// ---------------------------------------------------------------------------
// mount_archive 挂载流水线
// ---------------------------------------------------------------------------

#[test]
fn test_mount_archive_pipeline_normalization_and_rollback() {
    let fixture = TempArchive::new(&fixture_archive_bytes());
    let manager = ResourceManager::default();
    let session = writer_session(&manager);

    // 会话不存在 → PERMISSION_DENIED（与目录域同臂）。
    let error = manager
        .mount_archive(
            999,
            archive_registration("card-1", ScopeKind::Document, fixture.path()),
        )
        .expect_err("无会话挂载必须拒绝");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);

    // origin 非 Archive / 种类越界 → INTERNAL 装配兜底。
    let error = manager
        .mount_archive(
            session,
            ScopeRegistration {
                origin: Origin::Directory(fixture.path().to_path_buf()),
                ..archive_registration("card-1", ScopeKind::Document, fixture.path())
            },
        )
        .expect_err("非归档 origin 必须拒绝");
    assert_eq!(error.code(), RESOURCE_INTERNAL);
    let error = manager
        .mount_archive(
            session,
            archive_registration("card-1", ScopeKind::Workspace, fixture.path()),
        )
        .expect_err("Workspace 种类归档必须拒绝");
    assert_eq!(error.code(), RESOURCE_INTERNAL);

    // 归档缺失 → NOT_FOUND 且回滚不留半挂载态。
    let error = manager
        .mount_archive(
            session,
            archive_registration(
                "card-1",
                ScopeKind::Document,
                &fixture_archive_path("absent"),
            ),
        )
        .expect_err("缺失归档必须拒绝");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    assert!(!manager.archive_mounted(&"card-1".to_owned()));
    assert!(manager.scopes().lookup("card-1").is_none());

    // 非归档字节 → INTERNAL 兜底（结构损坏不降级）。
    let junk = TempArchive::new(b"not a zip at all");
    let error = manager
        .mount_archive(
            session,
            archive_registration("card-1", ScopeKind::Document, junk.path()),
        )
        .expect_err("损坏归档必须拒绝");
    assert_eq!(error.code(), RESOURCE_INTERNAL);
    assert!(!manager.archive_mounted(&"card-1".to_owned()));

    // 成功挂载：provider_id 强制归一 + read_only 强制翻真（外部登记故意
    // 携带异值 `directory` / 可写策略）。
    let mut registration = archive_registration("card-1", ScopeKind::Document, fixture.path());
    registration.provider_id = "directory".into();
    registration.policy.read_only = false;
    let scope = manager
        .mount_archive(session, registration)
        .expect("合法归档必须放行");
    assert_eq!(scope, "card-1");
    assert!(manager.archive_mounted(&scope));
    let registered = manager.scopes().lookup("card-1").expect("在册作用域");
    assert_eq!(registered.provider_id, "archive");
    assert!(registered.policy.read_only, "归档永不就地改写");
    // 重复挂载 → ALREADY_EXISTS。
    let error = manager
        .mount_archive(
            session,
            archive_registration("card-1", ScopeKind::Document, fixture.path()),
        )
        .expect_err("重复挂载必须拒绝");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    // 归档域不随 close_session 摘除（《06.03》§3.2 注销时机表）；
    // unregister_scope 同步摘除归档挂载。
    manager.close_session(session).expect("会话关闭");
    assert!(
        manager.archive_mounted(&"card-1".to_owned()),
        "归档域持久挂载"
    );
    manager
        .unregister_scope(&"card-1".to_owned())
        .expect("注销放行");
    assert!(!manager.archive_mounted(&"card-1".to_owned()));
}

// ---------------------------------------------------------------------------
// 归档域 Manager 读面端到端
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_archive_read_face_through_manager() {
    let fixture = TempArchive::new(&fixture_archive_bytes());
    let manager = ResourceManager::default();
    let session = writer_session(&manager);
    mount_archive(&manager, session, "card-1", fixture.path());

    let handle = manager
        .open(open_request(
            session,
            "chips-resource://card-1/content/note.txt",
        ))
        .await
        .expect("归档成员打开放行");
    assert_eq!(handle.metadata.size, 13);
    assert_eq!(handle.metadata.mime_type, "text/plain");
    assert_eq!(handle.metadata.scope, ScopeKind::Document);
    assert_eq!(
        handle.metadata.uri,
        "chips-resource://card-1/content/note.txt"
    );
    let mid = manager
        .read_range(
            handle.id,
            chips_resource::ByteRange {
                offset: 6,
                length: Some(7),
            },
        )
        .await
        .expect("范围读放行");
    assert_eq!(mid, b"archive".to_vec());
    manager.release(handle.id).expect("释放");

    // 流读：块形 ∈ (0, min(max_bytes, 256KiB)]，游标严格累计（《04.03》§3.2）。
    let handle = manager
        .open(open_request(
            session,
            "chips-resource://card-1/content/note.txt",
        ))
        .await
        .expect("重开句柄");
    let mut consumed = Vec::new();
    let mut pulls = 0;
    while let Some(chunk) = manager.read_chunk(handle.id, 4).await.expect("流读放行") {
        assert!(!chunk.is_empty() && chunk.len() <= 4, "块形契约");
        consumed.extend_from_slice(&chunk);
        pulls += 1;
        assert!(pulls < 10, "游标推进");
    }
    assert_eq!(consumed, b"hello archive".to_vec());
    manager.release(handle.id).expect("释放");

    // Deflate 成员经解析器解码面（Manager → Provider → chips-parser）。
    let deflated = manager
        .open(open_request(
            session,
            "chips-resource://card-1/content/deflated.txt",
        ))
        .await
        .expect("Deflate 成员打开");
    let bytes = manager
        .read_range(
            deflated.id,
            chips_resource::ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("Deflate 范围读");
    assert_eq!(bytes, b"deflate-member".to_vec());
    manager.release(deflated.id).expect("释放");

    // 列举面：目录树前缀合成 + 隐藏条目过滤 + 定序（《04.04》§4.10）。
    let entries = manager
        .list_directory(open_request(session, "chips-resource://card-1/content"))
        .await
        .expect("归档列举放行");
    let names: Vec<(&str, bool)> = entries
        .iter()
        .map(|entry| (entry.name.as_str(), entry.is_directory))
        .collect();
    assert_eq!(
        names,
        vec![("deep", true), ("deflated.txt", false), ("note.txt", false),],
        "目录态合成、隐藏过滤、按名定序"
    );

    // 成员不存在 / 目录态寻址 → NOT_FOUND。
    let error = manager
        .open(open_request(
            session,
            "chips-resource://card-1/content/ghost.txt",
        ))
        .await
        .expect_err("缺失成员必须拒绝");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    let error = manager
        .open(open_request(session, "chips-resource://card-1/content"))
        .await
        .expect_err("目录态不作资源");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
}

// ---------------------------------------------------------------------------
// 归档域写入族只读臂（⑧-2 统一精确 uri）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_archive_write_family_precise_read_only_uri() {
    let fixture = TempArchive::new(&fixture_archive_bytes());
    let manager = ResourceManager::default();
    let session = writer_session(&manager);
    mount_archive(&manager, session, "card-1", fixture.path());
    let target = "chips-resource://card-1/content/note.txt";

    let error = manager
        .commit_write(WriteRequest {
            session,
            scope: "card-1".into(),
            path: vpath(&manager, "content/note.txt"),
            bytes: vec![0],
        })
        .await
        .expect_err("归档不得就地写");
    assert_eq!(error.code(), RESOURCE_READ_ONLY);
    assert_eq!(error.details().expect("READ_ONLY 必携 uri")["uri"], target);

    let error = manager
        .delete(fs_request(session, target, None))
        .await
        .expect_err("归档不得删除");
    assert_eq!(error.code(), RESOURCE_READ_ONLY);
    assert_eq!(error.details().expect("READ_ONLY 必携 uri")["uri"], target);

    let error = manager
        .create_directory(fs_request(
            session,
            "chips-resource://card-1/content/new-dir",
            None,
        ))
        .await
        .expect_err("归档不得建目录");
    assert_eq!(error.code(), RESOURCE_READ_ONLY);
    assert_eq!(
        error.details().expect("READ_ONLY 必携 uri")["uri"],
        "chips-resource://card-1/content/new-dir"
    );

    // 流式写入口同样在能力预检收口（精确目标 uri 臂，工单044 ⑧-2）。
    let error = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "card-1",
            "content/note.txt",
            None,
        ))
        .expect_err("归档不得开写流");
    assert_eq!(error.code(), RESOURCE_READ_ONLY);
    assert_eq!(error.details().expect("READ_ONLY 必携 uri")["uri"], target);
    assert_eq!(manager.open_write_stream_count(), 0);
}

// ---------------------------------------------------------------------------
// 流式写入提交面生命周期（目录域）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_write_stream_directory_lifecycle() {
    let manager = ResourceManager::default();
    let session = writer_session(&manager);
    let fixture = TempRoot::new("stream");
    fixture.write("keep.txt", b"old");
    fs::create_dir_all(fixture.path().join("out")).expect("父目录必须可建");
    mount_directory(&manager, session, "workspace-1", fixture.path(), 1024);

    // 正常通道：分块送入 → 提交原子落位 → 零临时残留。
    let handle = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "workspace-1",
            "out/report.txt",
            Some(10),
        ))
        .expect("开流必须放行");
    assert_eq!(handle.uri, "chips-resource://workspace-1/out/report.txt");
    assert_eq!(manager.open_write_stream_count(), 1);
    manager
        .append_write_stream(&handle, b"0123")
        .expect("首块送入");
    manager
        .append_write_stream(&handle, b"456789")
        .expect("末块送入");
    let metadata = manager
        .commit_write_stream(handle)
        .await
        .expect("提交流式写入");
    assert_eq!(metadata.size, 10);
    assert_eq!(metadata.uri, "chips-resource://workspace-1/out/report.txt");
    assert_eq!(
        fs::read(fixture.path().join("out/report.txt")).expect("目标必须落位"),
        b"0123456789".to_vec()
    );
    assert_eq!(manager.open_write_stream_count(), 0);
    assert!(
        temp_residue(&fixture.path().join("out")).is_empty(),
        "零残留"
    );

    // expected_size 超送即回滚（WRITE_FAILED）：记录弃置、目标不落位。
    let handle = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "workspace-1",
            "oversize.txt",
            Some(4),
        ))
        .expect("开流");
    manager
        .append_write_stream(&handle, b"1234")
        .expect("恰量送入");
    let error = manager
        .append_write_stream(&handle, b"5")
        .expect_err("超出预期尺寸必须拒绝");
    assert_eq!(error.code(), RESOURCE_WRITE_FAILED);
    assert_eq!(error.details().expect("必携 uri")["uri"], handle.uri);
    assert_eq!(manager.open_write_stream_count(), 0);
    assert!(!fixture.path().join("oversize.txt").exists());
    assert!(temp_residue(fixture.path()).is_empty());

    // 作用域 max_resource_bytes 超限 → TOO_LARGE 回滚。
    let handle = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "workspace-1",
            "huge.txt",
            None,
        ))
        .expect("开流");
    let error = manager
        .append_write_stream(&handle, &vec![7u8; 1025])
        .expect_err("超上限必须拒绝");
    assert_eq!(error.code(), RESOURCE_TOO_LARGE);
    assert_eq!(manager.open_write_stream_count(), 0);
    assert!(temp_residue(fixture.path()).is_empty());

    // 提交时尺寸不符 → WRITE_FAILED、目标保持旧态、零残留。
    manager
        .commit_write(WriteRequest {
            session,
            scope: "workspace-1".into(),
            path: vpath(&manager, "keep.txt"),
            bytes: b"old".to_vec(),
        })
        .await
        .expect("基线写");
    let handle = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "workspace-1",
            "keep.txt",
            Some(9),
        ))
        .expect("开流");
    manager.append_write_stream(&handle, b"sh").expect("送入");
    let error = manager
        .commit_write_stream(handle)
        .await
        .expect_err("尺寸不符不得提交");
    assert_eq!(error.code(), RESOURCE_WRITE_FAILED);
    assert_eq!(
        fs::read(fixture.path().join("keep.txt")).expect("目标保持旧态"),
        b"old".to_vec()
    );
    assert!(temp_residue(fixture.path()).is_empty());

    // 主动中止：弃置通道零残留；陈旧句柄三面 NOT_FOUND。
    let handle = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "workspace-1",
            "aborted.txt",
            None,
        ))
        .expect("开流");
    manager.append_write_stream(&handle, b"x").expect("送入");
    manager.abort_write_stream(&handle).expect("中止放行");
    assert_eq!(manager.open_write_stream_count(), 0);
    assert!(!fixture.path().join("aborted.txt").exists());
    assert!(temp_residue(fixture.path()).is_empty());
    let stale = WriteStreamHandle {
        id: handle.id,
        uri: handle.uri.clone(),
    };
    assert_eq!(
        manager
            .abort_write_stream(&stale)
            .expect_err("重放中止")
            .code(),
        RESOURCE_NOT_FOUND
    );
    assert_eq!(
        manager
            .append_write_stream(&stale, b"y")
            .expect_err("陈旧句柄送入")
            .code(),
        RESOURCE_NOT_FOUND
    );
    assert_eq!(
        manager
            .commit_write_stream(stale)
            .await
            .expect_err("陈旧句柄提交")
            .code(),
        RESOURCE_NOT_FOUND
    );

    // 目标为在册目录 → ALREADY_EXISTS；父目录缺失 → NOT_FOUND（开流即拒，
    // 不自动建层，与一次性提交同口径）。
    fs::create_dir_all(fixture.path().join("adir")).expect("目录夹具");
    let error = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "workspace-1",
            "adir",
            None,
        ))
        .expect_err("目录实体不得作为写流目标");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    let error = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "workspace-1",
            "nodir/file.txt",
            None,
        ))
        .expect_err("缺父目录不得开流");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    assert_eq!(manager.open_write_stream_count(), 0);
}

// ---------------------------------------------------------------------------
// 级联中断：会话关闭 / 作用域注销一律中止活动写流（零残留）
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_write_stream_cascade_abort_zero_residue() {
    let manager = ResourceManager::default();
    let session = writer_session(&manager);
    let fixture = TempRoot::new("cascade");
    mount_directory(&manager, session, "workspace-1", fixture.path(), 1024);

    let handle = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "workspace-1",
            "half.txt",
            None,
        ))
        .expect("开流");
    manager.append_write_stream(&handle, b"half").expect("送入");
    assert_eq!(manager.open_write_stream_count(), 1);
    manager.close_session(session).expect("会话关闭");
    assert_eq!(
        manager.open_write_stream_count(),
        0,
        "会话级联必须中止活动写流"
    );
    assert!(!fixture.path().join("half.txt").exists());
    assert!(temp_residue(fixture.path()).is_empty(), "中断零临时残留");

    // 作用域注销级联：另一会话的写流随 unregister_scope 中止。
    let manager = ResourceManager::default();
    let mounter = writer_session(&manager);
    let writer = writer_session(&manager);
    let fixture = TempRoot::new("cascade2");
    mount_directory(&manager, mounter, "workspace-1", fixture.path(), 1024);
    manager
        .attach_scope(writer, &"workspace-1".to_owned())
        .expect("写流会话必须绑定作用域");
    let handle = manager
        .open_write_stream(stream_request(
            &manager,
            writer,
            "workspace-1",
            "x.txt",
            None,
        ))
        .expect("开流");
    manager.append_write_stream(&handle, b"x").expect("送入");
    manager
        .unregister_scope(&"workspace-1".to_owned())
        .expect("注销放行");
    assert_eq!(manager.open_write_stream_count(), 0);
    assert!(temp_residue(fixture.path()).is_empty());
}

// ---------------------------------------------------------------------------
// WriteCoordinator：同路径单写者排队、异路径互不阻塞
// ---------------------------------------------------------------------------

#[test]
fn test_write_coordinator_serializes_same_path() {
    let manager = Arc::new(ResourceManager::default());
    let session = writer_session(&manager);
    let fixture = TempRoot::new("coord");
    fs::create_dir_all(fixture.path().join("lock")).expect("锁夹具目录");
    mount_directory(&manager, session, "workspace-1", fixture.path(), 1024);

    let held = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "workspace-1",
            "lock/a.txt",
            None,
        ))
        .expect("首位写者开流");
    // 异路径即刻通过（锁粒度：作用域 + 规范虚拟路径）。
    let other = manager
        .open_write_stream(stream_request(
            &manager,
            session,
            "workspace-1",
            "lock/b.txt",
            None,
        ))
        .expect("异路径写者不得被阻塞");
    assert_eq!(manager.open_write_stream_count(), 2);

    // 同路径第二写者排队：许可释放前不得放行（《04.04》§4.9 单写者）。
    let acquired = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&acquired);
    let blocked_manager = Arc::clone(&manager);
    let blocked = std::thread::spawn(move || {
        let handle = blocked_manager
            .open_write_stream(stream_request(
                &blocked_manager,
                session,
                "workspace-1",
                "lock/a.txt",
                None,
            ))
            .expect("排队写者最终必须放行");
        flag.store(true, Ordering::SeqCst);
        blocked_manager
            .abort_write_stream(&handle)
            .expect("排队写者中止归还");
    });
    std::thread::sleep(std::time::Duration::from_millis(80));
    assert!(
        !acquired.load(Ordering::SeqCst),
        "同路径在写锁占用期不得放行第二写者"
    );
    manager.abort_write_stream(&held).expect("首位写者归还许可");
    blocked.join().expect("排队写者必须最终取得锁");
    assert!(acquired.load(Ordering::SeqCst));
    manager.abort_write_stream(&other).expect("异路径写者归还");
    assert_eq!(manager.open_write_stream_count(), 0);
    assert!(temp_residue(&fixture.path().join("lock")).is_empty());
}
