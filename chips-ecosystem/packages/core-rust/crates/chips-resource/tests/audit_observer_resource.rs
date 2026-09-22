//! 权限判定出站观察面集成锁（Resource 域，《RFC-权限审计跨层采集sink裁定》
//! §5.1/§六/§九 9.3-3）：
//!
//! - 发射在 `resolve` 判定收敛处（`decide_with_arm` → 素材组装 →
//!   `into_result`），各注册表锁外；
//! - 免权限直通臂（Platform 公开只读 / Plugin 自身作用域读 / Document
//!   会话绑定读，另含在册推广 Temporary·Memory 会话绑定读）**零发射**
//!   （工单046 裁定二）；
//! - deny 臂（含 `Policy` 类，如 platform 写）**全发**，字段与 `denied()`
//!   错误载体逐字同值；`RESOURCE_READ_ONLY` 非权限臂与权限段前的未知会话
//!   直构拒绝不产权限素材；句柄归属闸（N-1）四臂的越权拒绝与归属放行
//!   同属权限段外原始拒绝，一律零发射；
//! - 字段口径：`domain=Resource`、`plugin_id=session.owner`、
//!   `resource_uri`=规范 URI 原值、`target=chips-resource://<scope>/`、
//!   `capability_id/request_id/trace_id/qualifier` 恒 None；
//! - panic 注入零扰动（G2）；锁纪律回读用例（§六条 4）；
//! - `PermissionDenyReason` 上移 chips-core 后 serde 线上值快照零变化。

use std::path::PathBuf;
use std::sync::{Arc, Mutex, Weak};

use chips_core::{
    DecisionAction, DecisionDomain, DecisionObserver, FnDecisionObserver, NoopDecisionObserver,
    PermissionDecision, PermissionDenyReason, PluginId,
};
use chips_resource::error::{RESOURCE_PERMISSION_DENIED, RESOURCE_READ_ONLY};
use chips_resource::{
    ExternalOrigin, OpenRequest, Origin, PermissionDenyReason as ResourceDenyReason, ResourceError,
    ResourceLimits, ResourceManager, ResourceOperation, ScopeKind, ScopePolicy, ScopeRegistration,
    SessionKind, VirtualPath, WriteRequest,
};

/// 素材收集器：禁阻塞形母型——拷素材、入有界收集、立即返回（§六条 2）。
#[derive(Clone, Default)]
struct CollectingObserver {
    seen: Arc<Mutex<Vec<PermissionDecision>>>,
}

impl DecisionObserver for CollectingObserver {
    fn on_permission_decision(&self, decision: &PermissionDecision) {
        self.seen.lock().unwrap().push(decision.clone());
    }
}

impl CollectingObserver {
    fn drain(&self) -> Vec<PermissionDecision> {
        std::mem::take(&mut *self.seen.lock().unwrap())
    }
}

fn editor() -> PluginId {
    "chips.official.editor".to_owned()
}

fn directory_scope(
    scope: &str,
    kind: ScopeKind,
    owner: &str,
    read_only: bool,
) -> ScopeRegistration {
    ScopeRegistration {
        scope: scope.to_owned(),
        kind,
        owner: owner.to_owned(),
        provider_id: "directory".to_owned(),
        origin: Origin::Directory(PathBuf::from("/tmp/chips-audit-it")),
        policy: ScopePolicy {
            read_only,
            max_resource_bytes: 1 << 30,
            allowed_hosts: Vec::new(),
        },
    }
}

fn manager_with(observer: Arc<dyn DecisionObserver>) -> ResourceManager {
    ResourceManager::new(ResourceLimits::default(), observer)
}

#[test]
fn test_passthrough_arms_emit_no_material() {
    // 直通臂零发射（工单046 裁定二/RFC §九 9.3-3）：三在册臂 +
    // Temporary/Memory 会话绑定读推广臂（裁定二类别论，E7 三臂为在册实例）。
    let observer = Arc::new(CollectingObserver::default());
    let manager = manager_with(observer.clone());
    let owner = editor();
    let session = manager
        .open_session(
            SessionKind::Document,
            &owner,
            [
                "card-1".to_owned(),
                "temp-1".to_owned(),
                "memory".to_owned(),
            ],
            Vec::<String>::new(),
        )
        .expect("会话登记");
    manager
        .register_scope(directory_scope(
            "card-1",
            ScopeKind::Document,
            "chips.official.editor",
            false,
        ))
        .expect("Document 作用域");
    manager
        .register_scope(directory_scope(
            "temp-1",
            ScopeKind::Temporary,
            "chips.official.editor",
            true,
        ))
        .expect("Temporary 作用域");
    manager
        .register_scope(ScopeRegistration {
            scope: "memory".to_owned(),
            kind: ScopeKind::Memory,
            owner: owner.clone(),
            provider_id: "memory".to_owned(),
            origin: Origin::Memory,
            policy: ScopePolicy {
                read_only: false,
                max_resource_bytes: 1 << 30,
                allowed_hosts: Vec::new(),
            },
        })
        .expect("Memory 作用域");
    manager
        .register_scope(ScopeRegistration {
            scope: "platform".to_owned(),
            kind: ScopeKind::Platform,
            owner: "chips.platform".to_owned(),
            provider_id: "platform".to_owned(),
            origin: Origin::Platform("base".to_owned()),
            policy: ScopePolicy {
                read_only: true,
                max_resource_bytes: 1 << 30,
                allowed_hosts: Vec::new(),
            },
        })
        .expect("Platform 作用域");
    manager
        .register_scope(directory_scope(
            "plugin-editor",
            ScopeKind::Plugin,
            "chips.official.editor",
            false,
        ))
        .expect("Plugin 作用域");

    // 五直通臂全部放行且不产素材。
    for uri in [
        "chips-resource://platform/icons/base.png", // Platform 公开只读
        "chips-resource://plugin-editor/data/blob.bin", // Plugin 自身作用域读
        "chips-resource://card-1/notes/todo.md",    // Document 会话绑定读
        "chips-resource://temp-1/scratch/open.bin", // Temporary 会话绑定读
        "chips-resource://memory/notes/memo.txt",   // Memory 会话绑定读
    ] {
        let resolved = manager
            .resolve(uri, session, ResourceOperation::Read)
            .unwrap_or_else(|error| panic!("{uri} 直通必须放行：{error:?}"));
        assert_eq!(resolved.address.uri, uri, "resource_uri 组装为规范原值");
    }
    assert!(
        observer.drain().is_empty(),
        "免权限直通臂未经过授予判定，一律不发素材"
    );
}

#[test]
fn test_document_out_of_session_read_deny_emits_not_granted_material() {
    let observer = Arc::new(CollectingObserver::default());
    let manager = manager_with(observer.clone());
    manager
        .register_scope(directory_scope(
            "card-1",
            ScopeKind::Document,
            "chips.a",
            false,
        ))
        .expect("Document 作用域");
    let intruder: PluginId = "chips.b".to_owned();
    let session = manager
        .open_session(
            SessionKind::Document,
            &intruder,
            Vec::<String>::new(),
            Vec::<String>::new(),
        )
        .expect("会话登记");
    let error = manager
        .resolve(
            "chips-resource://card-1/notes/todo.md",
            session,
            ResourceOperation::Read,
        )
        .expect_err("会话外默认拒绝");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);

    let materials = observer.drain();
    assert_eq!(materials.len(), 1, "deny 臂必须恰发一条素材");
    let material = &materials[0];
    assert_eq!(material.domain, DecisionDomain::Resource);
    assert_eq!(material.action, DecisionAction::Deny);
    assert_eq!(
        material.plugin_id, intruder,
        "resource 域 plugin_id=session.owner"
    );
    assert_eq!(material.session_id, session);
    assert_eq!(
        material.permission, "resources:read:card-1",
        "deny = 首个缺失项"
    );
    assert_eq!(material.required, vec!["resources:read:card-1"]);
    assert_eq!(material.missing, vec!["resources:read:card-1"]);
    assert_eq!(material.reason, Some(PermissionDenyReason::NotGranted));
    assert_eq!(
        material.capability_id, None,
        "Resource 域 capability_id 恒 None"
    );
    assert_eq!(
        material.resource_uri.as_deref(),
        Some("chips-resource://card-1/notes/todo.md"),
        "resource_uri = 规范 URI 原值（脱敏归宿主写入侧）"
    );
    assert_eq!(
        material.target.as_deref(),
        Some("chips-resource://card-1/"),
        "target = denied() 的 chips-resource://<scope>/ 形态"
    );
    assert_eq!(material.request_id, None, "resource 域无请求键轨");
    assert_eq!(material.trace_id, None, "resource 域无追踪键轨");
    assert_eq!(material.qualifier, None);
}

#[test]
fn test_platform_write_deny_emits_policy_material() {
    // Policy 类拒绝照发（RFC §九 9.3-3「deny 臂含 Policy 全发」）。
    let observer = Arc::new(CollectingObserver::default());
    let manager = manager_with(observer.clone());
    manager
        .register_scope(ScopeRegistration {
            scope: "platform".to_owned(),
            kind: ScopeKind::Platform,
            owner: "chips.platform".to_owned(),
            provider_id: "platform".to_owned(),
            origin: Origin::Platform("base".to_owned()),
            policy: ScopePolicy {
                read_only: true,
                max_resource_bytes: 1 << 30,
                allowed_hosts: Vec::new(),
            },
        })
        .expect("Platform 作用域");
    let owner = editor();
    let session = manager
        .open_session(
            SessionKind::Document,
            &owner,
            Vec::<String>::new(),
            vec!["resources:write".to_owned()],
        )
        .expect("会话登记");
    let error = manager
        .resolve(
            "chips-resource://platform/icons/base.png",
            session,
            ResourceOperation::Write,
        )
        .expect_err("Platform 写入禁止");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    let materials = observer.drain();
    assert_eq!(materials.len(), 1);
    assert_eq!(materials[0].action, DecisionAction::Deny);
    assert_eq!(materials[0].reason, Some(PermissionDenyReason::Policy));
    assert_eq!(materials[0].permission, "resources:write");
    assert!(materials[0].required.is_empty(), "策略臂无权限源明细");
    assert!(materials[0].missing.is_empty());
    assert_eq!(
        materials[0].target.as_deref(),
        Some("chips-resource://platform/")
    );
}

#[test]
fn test_unbound_temp_read_deny_emits_out_of_scope_material() {
    let observer = Arc::new(CollectingObserver::default());
    let manager = manager_with(observer.clone());
    manager
        .register_scope(directory_scope(
            "temp-1",
            ScopeKind::Temporary,
            "chips.a",
            false,
        ))
        .expect("Temporary 作用域");
    let outsider: PluginId = "chips.b".to_owned();
    let session = manager
        .open_session(
            SessionKind::Document,
            &outsider,
            Vec::<String>::new(),
            Vec::<String>::new(),
        )
        .expect("会话登记");
    let error = manager
        .resolve(
            "chips-resource://temp-1/scratch/open.bin",
            session,
            ResourceOperation::Read,
        )
        .expect_err("会话外临时域拒绝");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    let materials = observer.drain();
    assert_eq!(materials.len(), 1);
    assert_eq!(materials[0].reason, Some(PermissionDenyReason::OutOfScope));
    assert_eq!(materials[0].permission, "resources:read:temp-1");
    assert!(materials[0].required.is_empty());
    assert!(materials[0].missing.is_empty());
    assert_eq!(
        materials[0].target.as_deref(),
        Some("chips-resource://temp-1/")
    );
}

#[test]
fn test_workspace_judged_allow_emits_material() {
    // 经过授予判定的 allow 照发：permission = required 声明序首项、
    // missing 恒空、reason None、target 可缺省（allow 臂不带）。
    let observer = Arc::new(CollectingObserver::default());
    let manager = manager_with(observer.clone());
    manager
        .register_scope(directory_scope(
            "workspace-1",
            ScopeKind::Workspace,
            "chips.host",
            false,
        ))
        .expect("Workspace 作用域");
    let owner = editor();
    let session = manager
        .open_session(
            SessionKind::Document,
            &owner,
            ["workspace-1".to_owned()],
            vec!["resources:read:workspace-1".to_owned()],
        )
        .expect("会话登记");
    manager
        .resolve(
            "chips-resource://workspace-1/src/main.rs",
            session,
            ResourceOperation::Read,
        )
        .expect("限定值授权放行");
    let materials = observer.drain();
    assert_eq!(materials.len(), 1);
    let material = &materials[0];
    assert_eq!(material.domain, DecisionDomain::Resource);
    assert_eq!(material.action, DecisionAction::Allow);
    assert_eq!(material.plugin_id, owner);
    assert_eq!(material.permission, "resources:read:workspace-1");
    assert_eq!(material.required, vec!["resources:read:workspace-1"]);
    assert!(material.missing.is_empty(), "allow 臂 missing 恒空");
    assert_eq!(material.reason, None, "allow 恒 None");
    assert_eq!(material.target, None, "allow 臂 target 缺省");
    assert_eq!(
        material.resource_uri.as_deref(),
        Some("chips-resource://workspace-1/src/main.rs")
    );
}

#[test]
fn test_external_allow_empty_required_carries_empty_permission() {
    // External 双权限齐备且经全局读+host 限定满足：该臂 required 为空
    // → allow 素材 permission 取空串（§5.4 条 2 首项口径的在册退化形）。
    let observer = Arc::new(CollectingObserver::default());
    let manager = manager_with(observer.clone());
    let owner = editor();
    let session = manager
        .open_session(
            SessionKind::Document,
            &owner,
            Vec::<String>::new(),
            vec![
                "resources:read".to_owned(),
                "network:http:cdn.example.com".to_owned(),
            ],
        )
        .expect("会话登记");
    manager
        .resolve(
            "chips-resource://external/https/cdn.example.com/img/logo.png",
            session,
            ResourceOperation::Read,
        )
        .expect("双权限 External 读放行");
    let materials = observer.drain();
    assert_eq!(materials.len(), 1);
    assert_eq!(materials[0].action, DecisionAction::Allow);
    assert_eq!(materials[0].permission, "");
    assert!(materials[0].required.is_empty());
    assert_eq!(
        materials[0].resource_uri.as_deref(),
        Some("chips-resource://external/https/cdn.example.com/img/logo.png")
    );
}

#[test]
fn test_external_missing_network_deny_emits_material() {
    let observer = Arc::new(CollectingObserver::default());
    let manager = manager_with(observer.clone());
    let owner = editor();
    let session = manager
        .open_session(
            SessionKind::Document,
            &owner,
            Vec::<String>::new(),
            vec!["resources:read:external".to_owned()],
        )
        .expect("会话登记");
    let error = manager
        .resolve(
            "chips-resource://external/https/cdn.example.com/img/logo.png",
            session,
            ResourceOperation::Read,
        )
        .expect_err("缺 network:http 限定必须拒绝");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    let materials = observer.drain();
    assert_eq!(materials.len(), 1);
    let material = &materials[0];
    assert_eq!(material.action, DecisionAction::Deny);
    assert_eq!(material.reason, Some(PermissionDenyReason::NotGranted));
    // deny permission = 首个缺失项：本臂缺失序首项为 host 网络限定。
    assert_eq!(material.permission, "network:http:cdn.example.com");
    assert_eq!(material.missing, vec!["network:http:cdn.example.com"]);
    assert_eq!(
        material.target.as_deref(),
        Some("chips-resource://external/")
    );
    // origin 形态在册可查（惰性注册面不受观察面影响）。
    let origin = ExternalOrigin {
        scheme: "https".to_owned(),
        host: "cdn.example.com".to_owned(),
        port: None,
    };
    assert!(manager
        .scopes()
        .lookup_external(&origin)
        .is_some_and(|registration| registration.kind == ScopeKind::External));
}

#[test]
fn test_read_only_arm_emits_no_permission_material() {
    // RESOURCE_READ_ONLY 非权限判定臂：不产权限素材、错误照回。
    let observer = Arc::new(CollectingObserver::default());
    let manager = manager_with(observer.clone());
    manager
        .register_scope(directory_scope(
            "temp-1",
            ScopeKind::Temporary,
            "chips.a",
            true,
        ))
        .expect("只读临时域");
    let owner: PluginId = "chips.a".to_owned();
    let session = manager
        .open_session(
            SessionKind::Document,
            &owner,
            ["temp-1".to_owned()],
            vec!["resources:write".to_owned()],
        )
        .expect("会话登记");
    let error = manager
        .resolve(
            "chips-resource://temp-1/scratch/open.bin",
            session,
            ResourceOperation::Write,
        )
        .expect_err("只读策略拒绝");
    assert_eq!(error.code(), RESOURCE_READ_ONLY);
    assert!(observer.drain().is_empty(), "非权限臂不伪造 reason/素材");
}

#[test]
fn test_unknown_session_direct_deny_emits_nothing() {
    // 权限段之前的未知会话直构拒绝（无判定臂参与）：现行不发素材。
    // 挂账在册（升级事项）：接线波如需该臂素材再补，不改 trait。
    let observer = Arc::new(CollectingObserver::default());
    let manager = manager_with(observer.clone());
    manager
        .register_scope(directory_scope(
            "card-1",
            ScopeKind::Document,
            "chips.a",
            false,
        ))
        .expect("Document 作用域");
    let error = manager
        .resolve(
            "chips-resource://card-1/notes/todo.md",
            1_000_000,
            ResourceOperation::Read,
        )
        .expect_err("未知会话拒绝");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    assert!(observer.drain().is_empty());
}

#[test]
fn test_observer_panic_does_not_disturb_resolve_outcome() {
    // panic 注入（RFC §六条 3/G2）：observer panic = 素材丢失，
    // resolve 放行与拒绝结果零扰动。
    let bomb = Arc::new(FnDecisionObserver::new(|_decision: &PermissionDecision| {
        panic!("观察面注入 panic")
    }));
    let manager = manager_with(bomb);
    manager
        .register_scope(directory_scope(
            "card-1",
            ScopeKind::Document,
            "chips.a",
            false,
        ))
        .expect("Document 作用域");
    // allow 面取「经过授予判定」臂（JudgedAllow 必发射）：panic 被
    // catch_unwind 吞住后 resolve 仍放行。
    let granter: PluginId = "chips.b".to_owned();
    let allowed_session = manager
        .open_session(
            SessionKind::Document,
            &granter,
            Vec::<String>::new(),
            vec!["resources:read:card-1".to_owned()],
        )
        .expect("会话登记");
    manager
        .resolve(
            "chips-resource://card-1/notes/todo.md",
            allowed_session,
            ResourceOperation::Read,
        )
        .expect("JudgedAllow 发射点 panic 不得扰动放行");
    let intruder: PluginId = "chips.b".to_owned();
    let deny_session = manager
        .open_session(
            SessionKind::Document,
            &intruder,
            Vec::<String>::new(),
            Vec::<String>::new(),
        )
        .expect("会话登记");
    let error = manager
        .resolve(
            "chips-resource://card-1/notes/todo.md",
            deny_session,
            ResourceOperation::Read,
        )
        .expect_err("缺权仍必须拒绝");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    let details = error.details().expect("拒绝详情零扰动");
    assert_eq!(details["reason"], "not_granted");
}

#[test]
fn test_observer_reentrant_manager_reads_do_not_deadlock() {
    // 锁外纪律动态面（RFC §六条 4「锁内调用即红」）：observer 回调体内
    // 回读 manager 三个持锁注册表接口（会话/作用域/句柄计数）。发射点
    // 若在任何注册表锁内，本用例即死锁挂红。
    let seen: Arc<Mutex<Vec<PermissionDecision>>> = Arc::new(Mutex::new(Vec::new()));
    let read_seen = Arc::clone(&seen);
    let manager: Arc<ResourceManager> = Arc::new_cyclic(|weak| {
        let weak = Weak::<ResourceManager>::clone(weak);
        ResourceManager::new(
            ResourceLimits::default(),
            Arc::new(FnDecisionObserver::new(
                move |decision: &PermissionDecision| {
                    let manager = weak.upgrade().expect("调用期强引用在场");
                    // 回读面：会话注册表锁、作用域注册表锁、句柄表锁。
                    let record = manager
                        .sessions()
                        .get(decision.session_id)
                        .expect("判定会话必可回读");
                    assert_eq!(record.owner, decision.plugin_id);
                    assert!(manager.scopes().lookup("card-1").is_some());
                    assert!(
                        chips_resource::handles_of_session(&manager, decision.session_id)
                            .is_empty()
                    );
                    read_seen.lock().unwrap().push(decision.clone());
                },
            )),
        )
    });
    manager
        .register_scope(directory_scope(
            "card-1",
            ScopeKind::Document,
            "chips.b",
            false,
        ))
        .expect("Document 作用域");
    let owner: PluginId = "chips.a".to_owned();
    let session = manager
        .open_session(
            SessionKind::Document,
            &owner,
            Vec::<String>::new(),
            Vec::<String>::new(),
        )
        .expect("会话登记");
    // deny 判定：素材在收敛处交回本闭包、闭包内完成三回读。
    let error = manager
        .resolve(
            "chips-resource://card-1/notes/todo.md",
            session,
            ResourceOperation::Read,
        )
        .expect_err("缺权拒绝");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
    let materials = std::mem::take(&mut *seen.lock().unwrap());
    assert_eq!(materials.len(), 1, "回读闭包收到判定素材");
}

#[test]
fn test_deny_reason_alias_and_wire_snapshot_unchanged() {
    // PermissionDenyReason 上移 chips-core 后：resource 侧收口别名与
    // 原路径为同一类型（编译期函数签名即证明），serde snake_case 线上值
    // 逐字不变（错误载体 details.reason 与素材 reason 双面对照）。
    fn alias_identity(value: PermissionDenyReason) -> ResourceDenyReason {
        value
    }
    let mapped = alias_identity(PermissionDenyReason::NotGranted);
    assert!(matches!(mapped, PermissionDenyReason::NotGranted));

    let observer = Arc::new(NoopDecisionObserver);
    let manager = manager_with(observer);
    manager
        .register_scope(directory_scope(
            "card-1",
            ScopeKind::Document,
            "chips.a",
            false,
        ))
        .expect("Document 作用域");
    let intruder: PluginId = "chips.b".to_owned();
    let session = manager
        .open_session(
            SessionKind::Document,
            &intruder,
            Vec::<String>::new(),
            Vec::<String>::new(),
        )
        .expect("会话登记");
    let denied: ResourceError = manager
        .resolve(
            "chips-resource://card-1/notes/todo.md",
            session,
            ResourceOperation::Read,
        )
        .expect_err("拒绝错误");
    let details = denied.details().expect("拒绝必携 details");
    assert_eq!(
        details["reason"], "not_granted",
        "错误载体 reason 线上值快照（上移后零变化）"
    );

    // 五值全量线上快照（与上移前 chips-resource 定义逐字对照）。
    let wire: Vec<String> = [
        PermissionDenyReason::NotGranted,
        PermissionDenyReason::Revoked,
        PermissionDenyReason::OutOfScope,
        PermissionDenyReason::UserRejected,
        PermissionDenyReason::Policy,
    ]
    .into_iter()
    .map(|reason| serde_json::to_string(&alias_identity(reason)).expect("serde 可序列化"))
    .collect();
    assert_eq!(
        wire,
        vec![
            "\"not_granted\"",
            "\"revoked\"",
            "\"out_of_scope\"",
            "\"user_rejected\"",
            "\"policy\"",
        ]
    );
}

#[test]
fn test_noop_observer_keeps_resolve_pipeline_identical() {
    // Noop 注入（构造必显式注入的默认随行形态）：判定管线与收集 observer
    // 完全一致——放行、拒绝、错误码三面同值。
    let manager = manager_with(Arc::new(NoopDecisionObserver));
    manager
        .register_scope(directory_scope(
            "card-1",
            ScopeKind::Document,
            "chips.a",
            false,
        ))
        .expect("Document 作用域");
    let owner: PluginId = "chips.a".to_owned();
    let bound = manager
        .open_session(
            SessionKind::Document,
            &owner,
            ["card-1".to_owned()],
            Vec::<String>::new(),
        )
        .expect("会话登记");
    manager
        .resolve(
            "chips-resource://card-1/notes/todo.md",
            bound,
            ResourceOperation::Read,
        )
        .expect("Noop 注入不影响放行");
    let intruder: PluginId = "chips.b".to_owned();
    let unbound = manager
        .open_session(
            SessionKind::Document,
            &intruder,
            Vec::<String>::new(),
            Vec::<String>::new(),
        )
        .expect("会话登记");
    let error = manager
        .resolve(
            "chips-resource://card-1/notes/todo.md",
            unbound,
            ResourceOperation::Read,
        )
        .expect_err("Noop 注入不改变拒绝");
    assert_eq!(error.code(), RESOURCE_PERMISSION_DENIED);
}

#[tokio::test]
async fn test_handle_ownership_gate_emits_no_material_two_arms() {
    // N-1 句柄归属闸（安全巡检残项复核 §一.1 交回上收）：四臂越权拒绝
    // 落在册 ChipsError 拒绝形，但归属比对发生在权限判定段之外——
    // 与工单046 裁定二「未经过授予判定零发射」同口径，拒绝与放行
    // 两臂一律不发素材。
    let observer = Arc::new(CollectingObserver::default());
    let manager = manager_with(observer.clone());
    let owner_session = manager
        .open_session(
            SessionKind::Document,
            &editor(),
            Vec::<String>::new(),
            vec!["resources:write".to_owned()],
        )
        .expect("归属会话登记");
    manager
        .mount_memory(owner_session)
        .expect("MemoryProvider 挂载");
    let metadata = manager
        .commit_write(WriteRequest {
            session: owner_session,
            scope: "memory".to_owned(),
            path: VirtualPath::validate("gate.txt", "u", manager.limits()).expect("在册路径"),
            bytes: b"payload".to_vec(),
        })
        .await
        .expect("提交放行");
    let handle = manager
        .open(OpenRequest {
            uri: metadata.uri.clone(),
            session: owner_session,
        })
        .await
        .expect("创建者会话打开免重复校验");
    // 先行沉淀建路权限段已发素材（commit_write 经授予判定），
    // 本用例只看句柄闸自身。
    observer.drain();
    let outsider = manager
        .open_session(
            SessionKind::Document,
            &editor(),
            Vec::<String>::new(),
            Vec::<String>::new(),
        )
        .expect("外来会话登记");

    // 越权臂：四臂逐臂拒绝且落在册拒绝形（permission=session /
    // reason=out_of_scope / target=规范 URI 原值）。
    let stat_error = manager
        .stat(handle.id, outsider)
        .await
        .expect_err("跨会话 stat 必须拒绝");
    assert_eq!(stat_error.code(), RESOURCE_PERMISSION_DENIED);
    let range_error = manager
        .read_range(
            handle.id,
            outsider,
            chips_resource::ByteRange {
                offset: 0,
                length: Some(4),
            },
        )
        .await
        .expect_err("跨会话 read_range 必须拒绝");
    assert_eq!(range_error.code(), RESOURCE_PERMISSION_DENIED);
    let chunk_error = manager
        .read_chunk(handle.id, outsider, 4)
        .await
        .expect_err("跨会话 read_chunk 必须拒绝");
    assert_eq!(chunk_error.code(), RESOURCE_PERMISSION_DENIED);
    let release_error: chips_core::ChipsError = manager
        .release(handle.id, outsider)
        .expect_err("跨会话 release 必须拒绝")
        .into();
    assert_eq!(release_error.code(), RESOURCE_PERMISSION_DENIED);
    for error in [stat_error, range_error, chunk_error, release_error] {
        let details = error.details().expect("拒绝形 details 在册");
        assert_eq!(details["permission"], "session");
        assert_eq!(details["reason"], "out_of_scope");
        assert_eq!(details["target"], metadata.uri);
    }

    // 归属臂：归属会话照常放行。
    manager
        .stat(handle.id, owner_session)
        .await
        .expect("归属会话 stat 放行");
    manager
        .release(handle.id, owner_session)
        .expect("归属会话 release 放行");

    assert!(
        observer.drain().is_empty(),
        "句柄归属闸两臂皆未经授予判定段，一律不发权限素材"
    );
}
