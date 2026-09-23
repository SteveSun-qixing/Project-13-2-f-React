//! 会话授权注入面集成锁测（工单053 点位五 D1 波，RFC 裁定J §八 T2）：
//! `grant_permission` 端到端使能 Document 写臂判定，并锁死两条语义边界——
//! ①限定形不扩 Document 写臂（§三.3 (c) 明确不做：Document 写臂只认
//! `resources:write` 精确基串，授予 `resources:write:<scope>` 后仍拒，
//! 判定矩阵冻结不借道）；②字符串透传正证（§三.3 (a)：Workspace 形限定串
//! 经 `require()` 臂自然被既有矩阵消费放行，授予侧零语法判断）。
//!
//! 判定素材经 `PermissionChecker::decide_with_arm` 的在册臂视图断言
//! （`JudgedDeny{reason: NotGranted, missing 含 resources:write}` /
//! `JudgedAllow`），与 `manager.rs` 判定入口构造点同源，零第二套模型。

use std::path::PathBuf;
use std::sync::Arc;

use chips_core::{NoopDecisionObserver, PermissionDenyReason};
use chips_resource::{
    DecisionArm, Origin, PermissionChecker, ResourceLimits, ResourceManager, ResourceOperation,
    ResourceSession, ScopeKind, ScopePolicy, ScopeRegistration, SessionKind,
    PERMISSION_RESOURCES_WRITE,
};

fn registration(kind: ScopeKind, scope: &str, owner: &str, read_only: bool) -> ScopeRegistration {
    ScopeRegistration {
        scope: scope.into(),
        kind,
        owner: owner.into(),
        provider_id: "directory".into(),
        origin: Origin::Directory(PathBuf::from("/tmp/chips-resource-grant-lock")),
        policy: ScopePolicy {
            read_only,
            max_resource_bytes: 1 << 30,
            allowed_hosts: Vec::new(),
        },
    }
}

/// 以会话在册权限集为 granted 注入执行判定臂（与 `manager.rs` 判定入口
/// `&session_record.permissions` 注入形同源）。
fn write_arm(session: &ResourceSession, target: &ScopeRegistration) -> DecisionArm {
    PermissionChecker::new(
        &session.owner.clone(),
        session,
        target,
        ResourceOperation::Write,
        &session.permissions,
        None,
        format!("chips-resource://{}/target.bin", target.scope),
    )
    .decide_with_arm()
    .1
}

fn expect_not_granted_deny(arm: &DecisionArm) {
    match arm {
        DecisionArm::JudgedDeny {
            permission,
            required,
            missing,
            reason,
            ..
        } => {
            assert_eq!(permission, PERMISSION_RESOURCES_WRITE);
            assert_eq!(reason, &PermissionDenyReason::NotGranted);
            assert_eq!(required, &vec![PERMISSION_RESOURCES_WRITE.to_owned()]);
            assert!(
                missing.contains(&PERMISSION_RESOURCES_WRITE.to_owned()),
                "缺权拒绝必携基串缺失项：{missing:?}"
            );
        }
        other => panic!("Document 写臂缺权时必须落 JudgedDeny(NotGranted)，实际：{other:?}"),
    }
}

#[test]
fn test_grant_enables_document_write() {
    let manager = ResourceManager::new(ResourceLimits::default(), Arc::new(NoopDecisionObserver));
    let doc = registration(
        ScopeKind::Document,
        "card-1",
        "chips.official.document-service",
        false,
    );

    // 臂一（正向闭环）：空权限会话 Document 写判定缺权拒 →
    // `grant_session` 授基串 → 复判放行。
    let session = manager
        .open_session(
            SessionKind::Document,
            &"chips.official.document-service".to_owned(),
            [],
            Vec::<String>::new(),
        )
        .expect("顶层会话必须成功");
    let record = manager.sessions().get(session).expect("会话必须可查");
    expect_not_granted_deny(&write_arm(&record, &doc));
    manager
        .grant_session(session, [PERMISSION_RESOURCES_WRITE.to_owned()])
        .expect("授予基串必须成功");
    let record = manager.sessions().get(session).expect("会话必须可查");
    assert_eq!(
        record.permissions.iter().cloned().collect::<Vec<_>>(),
        vec![PERMISSION_RESOURCES_WRITE.to_owned()]
    );
    match write_arm(&record, &doc) {
        DecisionArm::JudgedAllow { required } => {
            assert_eq!(required, vec![PERMISSION_RESOURCES_WRITE.to_owned()]);
        }
        other => panic!("授予基串后 Document 写臂必须 JudgedAllow，实际：{other:?}"),
    }

    // 臂二（§三.3 (c) 不扩性锁证）：只授限定串 `resources:write:<scope>`，
    // Document 写臂只认精确基串、仍拒——授予侧照投，判定矩阵不借道扩形。
    let qualified_only = manager
        .open_session(
            SessionKind::Document,
            &"chips.official.document-service".to_owned(),
            [],
            Vec::<String>::new(),
        )
        .expect("顶层会话必须成功");
    manager
        .grant_session(qualified_only, ["resources:write:card-1".to_owned()])
        .expect("限定串透传授予必须成功");
    let record = manager
        .sessions()
        .get(qualified_only)
        .expect("会话必须可查");
    assert!(
        record.permissions.contains("resources:write:card-1"),
        "限定串必须原样入集（透传零语法判断）"
    );
    expect_not_granted_deny(&write_arm(&record, &doc));

    // 臂三（§三.3 (a) 透传正证）：Workspace 形限定串经 `require()` 臂
    // 自然放行——投什么放行什么由判定矩阵单点裁决；授予前仍缺权拒。
    let workspace = registration(ScopeKind::Workspace, "ws-1", "chips.editor", false);
    let scoped_session = manager
        .open_session(
            SessionKind::Plugin,
            &"chips.editor".to_owned(),
            ["ws-1".to_owned()],
            Vec::<String>::new(),
        )
        .expect("顶层会话必须成功");
    let record = manager
        .sessions()
        .get(scoped_session)
        .expect("会话必须可查");
    match write_arm(&record, &workspace) {
        DecisionArm::JudgedDeny { missing, .. } => {
            assert_eq!(missing, vec!["resources:write:ws-1".to_owned()]);
        }
        other => panic!("Workspace 未授予限定串时必须拒，实际：{other:?}"),
    }
    manager
        .grant_session(scoped_session, ["resources:write:ws-1".to_owned()])
        .expect("限定串透传授予必须成功");
    let record = manager
        .sessions()
        .get(scoped_session)
        .expect("会话必须可查");
    match write_arm(&record, &workspace) {
        DecisionArm::JudgedAllow { required } => {
            assert_eq!(required, vec!["resources:write:ws-1".to_owned()]);
        }
        other => panic!("限定串经 require() 臂必须放行（透传正证），实际：{other:?}"),
    }
}
