//! 权限判定出站观察面集成锁（《RFC-权限审计跨层采集sink裁定》§5.1/§六/§九）：
//!
//! - `admit` 权限段两发射点：allow 于判定收敛处（required 判空后、Schema
//!   校验前、并发准入第二段锁前），deny 于 `return Err` 前；bridge 域无直通
//!   臂，一切判定 allow/deny 皆发（§九 9.3-3）；
//! - 字段填充口径逐字照 §5.1（deny permission=首个缺失项、allow
//!   permission=required 声明序首项、missing allow 恒空、reason deny 必携、
//!   capability_id=Some、resource_uri/target=None、request_id/trace_id
//!   取自在册现场）；
//! - panic 注入用例：observer 内 panic → 判定结果与错误返回零扰动（G2）；
//! - 锁外纪律用例：observer 实现内回调本 crate 读接口（`Clone` 句柄 +
//!   注册表查询）不死锁（§六条 4）；
//! - 禁阻塞形用例：observer 仅「拷素材 → 入有界收集 → 立即返回」
//!   （Mutex<Vec> 收集母型，§六条 2）。

use std::sync::{Arc, Mutex};

use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, Concurrency, ProviderKind,
    ProviderRegistration, BRIDGE_PERMISSION_DENIED, DEFAULT_MAX_QUEUE, DEFAULT_TIMEOUT_MS,
};
use chips_core::{
    DecisionAction, DecisionDomain, DecisionObserver, FnDecisionObserver, NoopDecisionObserver,
    PermissionDecision, PermissionDenyReason,
};
use serde_json::json;

/// 回声执行器：原样返回输入。
struct EchoExecutor;

#[async_trait::async_trait]
impl CapabilityExecutor for EchoExecutor {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, chips_core::ChipsError> {
        Ok(CapabilityOutput {
            json: input.json,
            bin: input.bin,
        })
    }
}

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

fn echo_schema() -> serde_json::Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["path"],
        "properties": { "path": { "type": "string", "minLength": 1 } }
    })
}

/// 装配：激活平台服务域、注册声明 `permissions` 的能力、开一个持
/// `granted` 权限的会话。
fn wired_bridge(
    observer: Arc<dyn DecisionObserver>,
    capability_permissions: &[&str],
    granted: &[&str],
) -> Bridge {
    let bridge = Bridge::new(observer);
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: capability_permissions
                .iter()
                .map(|item| (*item).to_owned())
                .collect(),
        })
        .expect("平台服务域激活");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: echo_schema(),
                permissions: capability_permissions
                    .iter()
                    .map(|item| (*item).to_owned())
                    .collect(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: DEFAULT_TIMEOUT_MS,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect("能力注册");
    bridge
        .open_session(
            7,
            "chips.official.editor".to_owned(),
            granted.iter().map(|item| (*item).to_owned()).collect(),
        )
        .expect("会话登记");
    bridge
}

fn request_of(input: serde_json::Value) -> BridgeRequest {
    BridgeRequest {
        request_id: "req-audit-1".to_owned(),
        capability_id: "file:read".to_owned(),
        session: 7,
        input: CapabilityInput::json_only(input),
    }
}

fn runtime() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .enable_time()
        .build()
        .expect("tokio 运行时（观察面集成锁）")
}

#[test]
fn test_allow_emits_single_material_at_convergence() {
    let observer = Arc::new(CollectingObserver::default());
    let bridge = wired_bridge(
        observer.clone(),
        &["filesystem:read", "network:http"],
        &["filesystem:read", "network:http"],
    );
    let outcome = runtime()
        .block_on(bridge.request(request_of(json!({ "path": "readme.md" }))))
        .expect("授权齐备必须放行");
    assert_eq!(outcome.json["path"], "readme.md");
    let materials = observer.drain();
    // 一次判定一条素材（RFC §5.4 条 1）；allow 素材字段照 §5.1 口径。
    assert_eq!(materials.len(), 1, "一次 admit 权限段收敛必须恰发一条素材");
    let material = &materials[0];
    assert_eq!(material.domain, DecisionDomain::Capability);
    assert_eq!(material.action, DecisionAction::Allow);
    assert_eq!(material.plugin_id, "chips.official.editor");
    assert_eq!(material.session_id, 7);
    // allow permission = required 声明序首项（RFC §5.4 条 2）。
    assert_eq!(material.permission, "filesystem:read");
    assert_eq!(material.required, vec!["filesystem:read", "network:http"]);
    assert!(material.missing.is_empty(), "allow 臂 missing 恒空");
    assert_eq!(material.reason, None, "allow 恒 None");
    assert_eq!(material.capability_id.as_deref(), Some("file:read"));
    assert_eq!(
        material.resource_uri, None,
        "Capability 域 resource_uri 恒 None"
    );
    assert_eq!(
        material.target, None,
        "Capability 域 target 恒 None（宿主按能力域补）"
    );
    assert_eq!(material.request_id.as_deref(), Some("req-audit-1"));
    assert!(
        material
            .trace_id
            .as_deref()
            .is_some_and(|id| !id.is_empty()),
        "trace_id 取自在册生成现场"
    );
    assert_eq!(material.qualifier, None, "限定值槽现行恒 None");
}

#[test]
fn test_deny_emits_material_before_error_return() {
    let observer = Arc::new(CollectingObserver::default());
    let bridge = wired_bridge(
        observer.clone(),
        &["filesystem:read", "network:http"],
        &["network:http"],
    );
    let error = runtime()
        .block_on(bridge.request(request_of(json!({ "path": "readme.md" }))))
        .expect_err("缺 filesystem:read 必须拒绝");
    assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
    let materials = observer.drain();
    assert_eq!(materials.len(), 1, "deny 臂必须恰发一条素材");
    let material = &materials[0];
    assert_eq!(material.domain, DecisionDomain::Capability);
    assert_eq!(material.action, DecisionAction::Deny);
    assert_eq!(material.plugin_id, "chips.official.editor");
    assert_eq!(material.session_id, 7);
    // deny permission = 首个缺失项（与 denied_error 短路口径同值）。
    assert_eq!(material.permission, "filesystem:read");
    assert_eq!(material.required, vec!["filesystem:read", "network:http"]);
    assert_eq!(material.missing, vec!["filesystem:read"]);
    assert_eq!(material.reason, Some(PermissionDenyReason::NotGranted));
    assert_eq!(material.capability_id.as_deref(), Some("file:read"));
    assert_eq!(material.request_id.as_deref(), Some("req-audit-1"));
    assert!(material.trace_id.is_some());
}

#[test]
fn test_empty_required_capability_still_emits_allow() {
    // bridge 域无直通臂：一切判定 allow/deny 皆发（RFC §九 9.3-3）；
    // 空 required 的收敛仍是「经过授予判定」的 allow。
    let observer = Arc::new(CollectingObserver::default());
    let bridge = wired_bridge(observer.clone(), &[], &[]);
    runtime()
        .block_on(bridge.request(request_of(json!({ "path": "readme.md" }))))
        .expect("空权限声明能力放行");
    let materials = observer.drain();
    assert_eq!(materials.len(), 1);
    assert_eq!(materials[0].action, DecisionAction::Allow);
    assert_eq!(materials[0].permission, "", "required 为空时首项口径取空串");
    assert!(materials[0].required.is_empty());
}

#[test]
fn test_allow_emitted_before_schema_and_admission_stages() {
    // 判定事实与后续准入结果解耦（RFC §六条 4）：Schema 校验失败仍已发
    // allow 素材（发射点在判空后、Schema 校验前、第二段锁前）。
    let observer = Arc::new(CollectingObserver::default());
    let bridge = wired_bridge(observer.clone(), &["filesystem:read"], &["filesystem:read"]);
    let error = runtime()
        .block_on(bridge.request(request_of(json!({ "not-path": 1 }))))
        .expect_err("非法输入必须被 Schema 拒绝");
    assert_eq!(error.code(), chips_bridge::BRIDGE_INVALID_INPUT);
    let materials = observer.drain();
    assert_eq!(materials.len(), 1);
    assert_eq!(materials[0].action, DecisionAction::Allow);
}

#[test]
fn test_observer_panic_leaves_decision_untouched() {
    // panic 注入（RFC §六条 3/G2）：observer panic = 素材丢失，判定结果与
    // 错误返回零扰动。
    let panicking = Arc::new(FnDecisionObserver::new(|_decision: &PermissionDecision| {
        panic!("观察面注入 panic")
    }));
    let bridge = wired_bridge(
        panicking.clone(),
        &["filesystem:read"],
        &["filesystem:read"],
    );
    let outcome = runtime()
        .block_on(bridge.request(request_of(json!({ "path": "readme.md" }))))
        .expect("observer panic 不得扰动 allow 判定");
    assert_eq!(outcome.json["path"], "readme.md");

    let deny_bridge = wired_bridge(panicking, &["filesystem:read"], &[]);
    let error = runtime()
        .block_on(deny_bridge.request(request_of(json!({ "path": "readme.md" }))))
        .expect_err("缺权仍必须拒绝");
    assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
    let details = error.details().expect("拒绝详情零扰动");
    assert_eq!(details["permission"], json!("filesystem:read"));
    assert_eq!(details["reason"], json!("not_granted"));
}

#[test]
fn test_observer_reentrant_reads_do_not_deadlock() {
    // 锁外纪律（RFC §六条 4「锁内调用即红」动态面）：observer 回调体内
    // 经 `Clone` 句柄调用本 crate 持 `CoreState` 锁的读接口——发射点若持锁
    // 本用例即死锁挂红；正常通过即证明两处发射均在锁外。
    let slot: Arc<Mutex<Option<Bridge>>> = Arc::new(Mutex::new(None));
    let read_slot = Arc::clone(&slot);
    let observer = Arc::new(FnDecisionObserver::new(
        move |decision: &PermissionDecision| {
            let bridge = read_slot.lock().unwrap().clone().expect("句柄已回填");
            // 持锁读接口：注册表查询与状态查询。
            assert!(bridge.has_capability(&decision.capability_id.clone().unwrap()));
            assert_eq!(
                bridge.capability_state("file:read"),
                Some(chips_bridge::CapabilityState::Active)
            );
        },
    ));
    let bridge = wired_bridge(observer, &["filesystem:read"], &["filesystem:read"]);
    slot.lock().unwrap().replace(bridge.clone());
    runtime()
        .block_on(bridge.request(request_of(json!({ "path": "readme.md" }))))
        .expect("锁外回读不死锁");
    // deny 路径同样回读一次（发射点在 return Err 前、锁外）。
    let deny_slot = Arc::clone(&slot);
    let deny_bridge = wired_bridge(
        Arc::new(FnDecisionObserver::new(
            move |decision: &PermissionDecision| {
                let bridge = deny_slot.lock().unwrap().clone().expect("句柄已回填");
                assert_eq!(decision.action, DecisionAction::Deny);
                assert!(!bridge.has_capability("unregistered:capability"));
            },
        )),
        &["filesystem:read"],
        &[],
    );
    slot.lock().unwrap().replace(deny_bridge.clone());
    let error = runtime()
        .block_on(deny_bridge.request(request_of(json!({ "path": "readme.md" }))))
        .expect_err("缺权拒绝");
    assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
}

#[test]
fn test_noop_observer_keeps_pipeline_identical() {
    // Noop 注入（native 波界随行形态）：判定管线与收集 observer 完全一致。
    let bridge = wired_bridge(
        Arc::new(NoopDecisionObserver),
        &["filesystem:read"],
        &["filesystem:read"],
    );
    let outcome = runtime()
        .block_on(bridge.request(request_of(json!({ "path": "ok.md" }))))
        .expect("Noop 注入不影响放行");
    assert_eq!(outcome.json["path"], "ok.md");
    let seen: Arc<Mutex<usize>> = Arc::new(Mutex::new(0));
    let counter = Arc::clone(&seen);
    let bridge = Bridge::new(Arc::new(FnDecisionObserver::new(
        move |_decision: &PermissionDecision| {
            *counter.lock().unwrap() += 1;
        },
    )));
    // 会话校验失败与注册表未命中段不产素材（素材面只挂权限判定段）。
    bridge
        .open_session(9, "chips.x".to_owned(), vec!["filesystem:read".to_owned()])
        .expect("会话登记");
    let error = runtime()
        .block_on(bridge.request(BridgeRequest {
            request_id: "req-missing".to_owned(),
            capability_id: "file:read".to_owned(),
            session: 1_000_000,
            input: CapabilityInput::json_only(json!({ "path": "a" })),
        }))
        .expect_err("未知会话拒绝");
    assert_eq!(error.code(), chips_bridge::BRIDGE_SESSION_UNKNOWN);
    assert_eq!(*seen.lock().unwrap(), 0, "权限段之前的失败不发素材");
}
