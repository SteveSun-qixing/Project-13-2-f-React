//! 段二 B1 集成锁：MemoryProvider 挂载端到端面（《04》§3.2/§3.3、
//! 《06.04》§4.3 行 9）与 Unicode 触发臂在公开 URI 入口的产生面
//! （《06》§2.4，工单042 裁定④）。
//!
//! 口径要点：会话内可写不落盘、禁止持久化与跨会话传递、目录列举不支持、
//! 能力预检在管理器层收口（不透传 Provider）；错误码零自造，全部取自
//! 《06》§7.2 在册表。

use std::collections::BTreeSet;

use chips_resource::error::{
    RESOURCE_ALREADY_EXISTS, RESOURCE_HANDLE_RELEASED, RESOURCE_NOT_FOUND, RESOURCE_NOT_SUPPORTED,
    RESOURCE_PATH_INVALID, RESOURCE_PERMISSION_DENIED, RESOURCE_READ_ONLY,
};
use chips_resource::{
    ByteRange, FsOpRequest, OpenRequest, ResourceLimits, ResourceManager, ResourceOperation,
    ScopeKind, SessionKind, VirtualPath, WriteRequest,
};

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
                .map(|p| (*p).to_owned())
                .collect::<Vec<_>>(),
        )
        .expect("会话创建必须成功")
}

fn mounted(manager: &ResourceManager) -> chips_core::SessionId {
    let session = session_with(manager, &["resources:write"]);
    manager
        .mount_memory(session)
        .expect("MemoryProvider 挂载必须成功");
    session
}

#[tokio::test]
async fn test_memory_mount_read_write_lifecycle() {
    let manager = ResourceManager::default();
    let session = mounted(&manager);
    let metadata = manager
        .commit_write(WriteRequest {
            session,
            scope: "memory".into(),
            path: VirtualPath::validate("notes/memo.txt", "u", manager.limits()).expect("在册路径"),
            bytes: b"runtime-memory-bytes".to_vec(),
        })
        .await
        .expect("提交放行");
    assert_eq!(metadata.mime_type, "text/plain");
    assert_eq!(metadata.size, 20);
    let handle = manager
        .open(OpenRequest {
            uri: metadata.uri.clone(),
            session,
        })
        .await
        .expect("创建者会话读取免重复校验");
    assert_eq!(handle.metadata.version, metadata.version);
    let bytes = manager
        .read_range(
            handle.id,
            ByteRange {
                offset: 8,
                length: Some(6),
            },
        )
        .await
        .expect("范围读");
    assert_eq!(bytes, b"memory".to_vec());
    // 流式读取全量并与原字节一致（supports_streaming 如实声明）。
    let mut streamed = Vec::new();
    while let Some(chunk) = manager.read_chunk(handle.id, 8).await.expect("流读放行") {
        streamed.extend_from_slice(&chunk);
    }
    assert_eq!(streamed, b"runtime-memory-bytes".to_vec());
    manager.release(handle.id).expect("释放幂等面");
    // delete 在册（Memory 属删除种类白名单）。
    manager
        .delete(FsOpRequest {
            session,
            source: metadata.uri,
            target: None,
            recursive: false,
        })
        .await
        .expect("会话内删除");
}

#[tokio::test]
async fn test_memory_rename_copy_and_no_overwrite() {
    let manager = ResourceManager::default();
    let session = mounted(&manager);
    for (path, bytes) in [("a.txt", &b"AAA"[..]), ("taken.txt", &b"T"[..])] {
        manager
            .commit_write(WriteRequest {
                session,
                scope: "memory".into(),
                path: VirtualPath::validate(path, "u", manager.limits()).expect("在册路径"),
                bytes: bytes.to_vec(),
            })
            .await
            .expect("提交");
    }
    let error = manager
        .rename(FsOpRequest {
            session,
            source: "chips-resource://memory/a.txt".into(),
            target: Some("chips-resource://memory/taken.txt".into()),
            recursive: false,
        })
        .await
        .expect_err("rename 不覆盖");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    manager
        .rename(FsOpRequest {
            session,
            source: "chips-resource://memory/a.txt".into(),
            target: Some("chips-resource://memory/b.txt".into()),
            recursive: false,
        })
        .await
        .expect("会话内 rename");
    let error = manager
        .open(OpenRequest {
            uri: "chips-resource://memory/a.txt".into(),
            session,
        })
        .await
        .expect_err("rename 后源消失");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    manager
        .copy(FsOpRequest {
            session,
            source: "chips-resource://memory/b.txt".into(),
            target: Some("chips-resource://memory/c.txt".into()),
            recursive: false,
        })
        .await
        .expect("会话内 copy");
    let error = manager
        .copy(FsOpRequest {
            session,
            source: "chips-resource://memory/b.txt".into(),
            target: Some("chips-resource://memory/c.txt".into()),
            recursive: false,
        })
        .await
        .expect_err("copy 不覆盖（《06》§7.2）");
    assert_eq!(error.code(), RESOURCE_ALREADY_EXISTS);
    // rename/copy 出会话（跨作用域）：不存在源先行 NOT_FOUND；
    // 结构性跨作用域拒绝（NOT_SUPPORTED rename / CROSS_SCOPE copy 缺权）
    // 由管理器单测覆盖（src/manager.rs tests）。
    let error = manager
        .rename(FsOpRequest {
            session,
            source: "chips-resource://memory/ghost-src.txt".into(),
            target: Some("chips-resource://memory/b.txt".into()),
            recursive: false,
        })
        .await
        .expect_err("源不存在");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    let outsider = session_with(&manager, &[]);
    let error = manager
        .copy(FsOpRequest {
            session: outsider,
            source: "chips-resource://memory/b.txt".into(),
            target: Some("chips-resource://memory/d.txt".into()),
            recursive: false,
        })
        .await
        .expect_err("未绑定会话不得触碰 memory");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
}

#[tokio::test]
async fn test_memory_capability_prechecks_at_manager() {
    let manager = ResourceManager::default();
    let session = mounted(&manager);
    manager
        .commit_write(WriteRequest {
            session,
            scope: "memory".into(),
            path: VirtualPath::validate("x.txt", "u", manager.limits()).expect("在册路径"),
            bytes: vec![1],
        })
        .await
        .expect("提交");
    // 目录列举：管理器层直接 NOT_SUPPORTED（不透传 Provider）。
    let error = manager
        .list_directory(OpenRequest {
            uri: "chips-resource://memory/x.txt".into(),
            session,
        })
        .await
        .expect_err("Memory 列举不支持");
    assert_eq!(error.code(), RESOURCE_NOT_SUPPORTED);
    let details = error.details().expect("scope details");
    assert_eq!(details["operation"], "list");
    assert_eq!(details["scope"], "memory");
    // create_directory：Memory 无目录层级。
    let error = manager
        .create_directory(FsOpRequest {
            session,
            source: "chips-resource://memory/dir".into(),
            target: None,
            recursive: false,
        })
        .await
        .expect_err("Memory 建目录不支持");
    assert_eq!(error.code(), RESOURCE_NOT_SUPPORTED);
    assert_eq!(error.details().unwrap()["operation"], "create_directory");
    // 写族缺 resources:write：判定矩阵拒绝（未绑定会话更拒绝）。
    let reader = session_with(&manager, &[]);
    let error = manager
        .commit_write(WriteRequest {
            session: reader,
            scope: "memory".into(),
            path: VirtualPath::validate("y.txt", "u", manager.limits()).expect("在册路径"),
            bytes: vec![1],
        })
        .await
        .expect_err("只读会话不得提交");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    // 只读能力 Provider 作用域（Platform 只读策略）在
    // `test_commit_write_read_only_capability_surface` 单独锁。
    let error = manager
        .commit_write(WriteRequest {
            session,
            scope: "card-ghost".into(),
            path: VirtualPath::validate("z.png", "u", manager.limits()).expect("在册路径"),
            bytes: vec![1],
        })
        .await
        .expect_err("未注册作用域");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
}

#[tokio::test]
async fn test_close_creator_session_evicts_without_persistence() {
    let manager = ResourceManager::default();
    let session = mounted(&manager);
    manager
        .commit_write(WriteRequest {
            session,
            scope: "memory".into(),
            path: VirtualPath::validate("ghost.txt", "u", manager.limits()).expect("在册路径"),
            bytes: b"volatile".to_vec(),
        })
        .await
        .expect("提交");
    let handle = manager
        .open(OpenRequest {
            uri: "chips-resource://memory/ghost.txt".into(),
            session,
        })
        .await
        .expect("打开");
    manager.close_session(session).expect("关闭创建者会话");
    // 句柄级联失效归还；作用域注销。
    let error = manager
        .stat(handle.id)
        .await
        .expect_err("租约必须随会话归还");
    assert_eq!(error.code(), RESOURCE_HANDLE_RELEASED);
    let fresh = session_with(&manager, &["resources:write"]);
    manager.mount_memory(fresh).expect("可重新挂载");
    let error = manager
        .open(OpenRequest {
            uri: "chips-resource://memory/ghost.txt".into(),
            session: fresh,
        })
        .await
        .expect_err("禁止持久化：旧条目不得幸存");
    assert_eq!(error.code(), RESOURCE_NOT_FOUND);
    // 未绑定新会话读取旧路径同样拒绝（跨会话传递禁止）。
    let outsider = session_with(&manager, &[]);
    let error = manager
        .resolve(
            "chips-resource://memory/ghost.txt",
            outsider,
            ResourceOperation::Read,
        )
        .expect_err("跨会话禁止");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
}

#[tokio::test]
async fn test_unicode_trigger_arm_at_uri_layer() {
    // 工单042 裁定④（2026-09-21 码归属更正）：触发臂产生
    // `RESOURCE_PATH_INVALID` + reason=unicode；
    // NFC 差异永不构成拒绝。
    let manager = ResourceManager::default();
    let session = session_with(&manager, &[]);
    for input in [
        "chips-resource://memory/a%FFb",
        "chips-resource://memory/%C0%AF",
        "chips-resource://memory/%ED%A0%80",
        "chips-resource://memory/%F5%80%80%80",
        "chips-resource://memory/a%EF%BF%BDb",
        "chips-resource://memory/a%EF%BF%BEb",
        // 工单043 裁定 A1 Unicode 全集补臂（段三收口）：平面 16 末端与非字符区
        // U+FDD0–U+FDEF 在 URI 公开入口同码同 reason。
        "chips-resource://memory/a%F4%8F%BF%BEb",
        "chips-resource://memory/a%EF%B7%90b",
    ] {
        let error = manager
            .resolve(input, session, ResourceOperation::Read)
            .expect_err("Unicode 臂必须拒绝");
        assert_eq!(error.code(), RESOURCE_PATH_INVALID, "{input}");
        assert_eq!(error.details().unwrap()["reason"], "unicode", "{input}");
    }
    // NFC 等价异字节序永不触发 unicode 臂：双双放行且规范形一致
    // （语法层放行后读取判定返回 NOT_FOUND，不属 unicode）。
    let limits = ResourceLimits::default();
    let composed = chips_resource::resolve_input("chips-resource://memory/caf%C3%A9", &limits)
        .expect("NFC 预组合形态放行");
    let decomposed = chips_resource::resolve_input("chips-resource://memory/cafe%CC%81", &limits)
        .expect("NFC 分解形态放行");
    assert_eq!(
        composed.to_canonical_string(),
        decomposed.to_canonical_string()
    );
    // %zz 语法臂分流不变（invalid_encoding，URI 8 词表不扩词）。
    let error = manager
        .resolve(
            "chips-resource://memory/a%zzb",
            session,
            ResourceOperation::Read,
        )
        .expect_err("语法非法必须拒绝");
    assert_eq!(error.details().unwrap()["reason"], "invalid_encoding");
}

#[tokio::test]
async fn test_commit_write_read_only_capability_surface() {
    // 只读来源的 commit_write 在管理器层收口，两层各自锁：
    // ① Platform：判定矩阵直接按策略拒绝写入（《06.04》§4.3 行 6）；
    // ② dialog:open 只读临时授权：能力预检返回 READ_ONLY（持久化写禁止）。
    let manager = ResourceManager::default();
    let session = session_with(&manager, &["resources:write"]);
    manager
        .register_scope(chips_resource::ScopeRegistration {
            scope: "platform".into(),
            kind: ScopeKind::Platform,
            owner: owner(),
            provider_id: "platform".into(),
            origin: chips_resource::Origin::Platform("embed".into()),
            policy: chips_resource::ScopePolicy {
                read_only: true,
                max_resource_bytes: ResourceLimits::default().max_resource_bytes,
                allowed_hosts: Vec::new(),
            },
        })
        .expect("Platform 作用域注册");
    let error = manager
        .commit_write(WriteRequest {
            session,
            scope: "platform".into(),
            path: VirtualPath::validate("icons/a.png", "u", manager.limits()).expect("在册路径"),
            bytes: vec![1],
        })
        .await
        .expect_err("Platform 写入禁止");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    assert_eq!(error.details().unwrap()["reason"], "policy");
    manager
        .register_scope(chips_resource::ScopeRegistration {
            scope: "temp-1".into(),
            kind: ScopeKind::Temporary,
            owner: owner(),
            provider_id: "directory".into(),
            origin: chips_resource::Origin::Directory("/fixture/readonly-grant".into()),
            policy: chips_resource::ScopePolicy {
                read_only: true,
                max_resource_bytes: ResourceLimits::default().max_resource_bytes,
                allowed_hosts: Vec::new(),
            },
        })
        .expect("临时作用域注册");
    manager
        .attach_scope(session, &"temp-1".to_owned())
        .expect("临时授权绑定");
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
}
