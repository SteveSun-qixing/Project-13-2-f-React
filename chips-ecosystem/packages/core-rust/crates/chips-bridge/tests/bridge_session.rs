//! 会话与权限快照集成测试：open/close、权限判定（精确匹配 + 域通配）、
//! 会话级取消。
//!
//! 断言口径以《核心接口规范》§5.2 阶段表、《Bridge三层设计》§5（权限判定）、
//! §8.2（取消来源）与 §9.2（错误码/`retryable`）为准。

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;

use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, Concurrency, ProviderKind,
    ProviderRegistration, BRIDGE_CANCELLED, BRIDGE_INTERNAL, BRIDGE_PERMISSION_DENIED,
    BRIDGE_SESSION_UNKNOWN,
};
use chips_core::{ChipsError, NoopDecisionObserver};
use serde_json::json;

/// 回声执行器：原样返回输入。
struct EchoExecutor;

#[async_trait::async_trait]
impl CapabilityExecutor for EchoExecutor {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        Ok(CapabilityOutput {
            json: input.json,
            bin: input.bin,
        })
    }
}

/// 挂起执行器：进入执行后自增计数并轮询释放标志；6 秒兜底防止测试悬挂。
struct HoldExecutor {
    started: Arc<AtomicUsize>,
    release: Arc<AtomicBool>,
}

#[async_trait::async_trait]
impl CapabilityExecutor for HoldExecutor {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        self.started.fetch_add(1, Ordering::SeqCst);
        for _ in 0..3_000 {
            if self.release.load(Ordering::SeqCst) {
                return Ok(CapabilityOutput {
                    json: input.json,
                    bin: input.bin,
                });
            }
            tokio::time::sleep(std::time::Duration::from_millis(2)).await;
        }
        Err(ChipsError::new(
            BRIDGE_INTERNAL,
            "挂起执行器超时（测试装置兜底）",
        ))
    }
}

/// 等待计数达到目标值（真实时钟短轮询）。
async fn wait_started(counter: &AtomicUsize, target: usize) {
    for _ in 0..500 {
        if counter.load(Ordering::SeqCst) >= target {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(4)).await;
    }
    panic!(
        "在限定时间内未达到 {target} 个在途执行（当前 {}）",
        counter.load(Ordering::SeqCst)
    );
}

fn echo_schema() -> serde_json::Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["path"],
        "properties": { "path": { "type": "string", "minLength": 1 } }
    })
}

/// 注册一个要求 `permissions` 的内置回声能力。
fn register_read_file(bridge: &Bridge, permissions: &[&str]) {
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: permissions.iter().map(|item| (*item).to_owned()).collect(),
        })
        .expect("平台服务域激活应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: echo_schema(),
                permissions: permissions.iter().map(|item| (*item).to_owned()).collect(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: chips_bridge::DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect("能力注册应成功");
}

fn request_of(session: u64, capability_id: &str) -> BridgeRequest {
    BridgeRequest {
        request_id: format!("req-{capability_id}-{session}"),
        capability_id: capability_id.to_owned(),
        session,
        input: CapabilityInput::json_only(json!({ "path": "readme.md" })),
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_request_from_unknown_session_is_rejected() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    register_read_file(&bridge, &[]);
    let error = bridge
        .request(request_of(9_999, "file:read"))
        .await
        .expect_err("未登记会话必须拒绝");
    assert_eq!(
        error.code(),
        BRIDGE_SESSION_UNKNOWN,
        "《核心接口规范》§5.2 会话校验"
    );
    assert!(!error.retryable(), "BRIDGE_SESSION_UNKNOWN 不可重试");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_permission_denied_when_snapshot_empty() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    register_read_file(&bridge, &["filesystem:read"]);
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let error = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect_err("快照未覆盖所需权限必须拒绝");
    assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
    assert!(!error.retryable(), "BRIDGE_PERMISSION_DENIED 不可重试");
    let details = error
        .details()
        .expect("权限拒绝必须携带详情（《08-权限系统设计》§9.2）");
    assert_eq!(details["capabilityId"], json!("file:read"));
    assert_eq!(details["permission"], json!("filesystem:read"));
    assert_eq!(details["missing"], json!(["filesystem:read"]));
    assert_eq!(details["required"], json!(["filesystem:read"]));
    assert_eq!(details["granted"], json!([]));
    assert_eq!(details["reason"], json!("not_granted"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_permission_exact_match_allows_call() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    register_read_file(&bridge, &["filesystem:read"]);
    bridge
        .open_session(
            1,
            "chips.official.editor".to_owned(),
            vec!["filesystem:read".to_owned()],
        )
        .expect("会话登记应成功");
    let output = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect("精确授予的权限应放行");
    assert_eq!(output.json["path"], json!("readme.md"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_permission_domain_wildcard_coverage() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    register_read_file(&bridge, &["filesystem:read", "network:http"]);
    bridge
        .open_session(
            1,
            "chips.official.editor".to_owned(),
            vec!["filesystem:*".to_owned()],
        )
        .expect("会话登记应成功");
    let error = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect_err("通配域不覆盖其它域的所需权限");
    assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
    let details = error.details().expect("权限拒绝必须携带详情");
    assert_eq!(
        details["permission"],
        json!("network:http"),
        "首个缺失为声明序第二项"
    );
    assert_eq!(details["missing"], json!(["network:http"]));
    assert_eq!(
        details["required"],
        json!(["filesystem:read", "network:http"]),
        "required 应按能力声明顺序完整回显"
    );
    // 域通配覆盖同域全部权限。
    bridge
        .open_session(
            2,
            "chips.official.editor".to_owned(),
            vec!["filesystem:*".to_owned(), "network:*".to_owned()],
        )
        .expect("第二会话登记应成功");
    let output = bridge
        .request(request_of(2, "file:read"))
        .await
        .expect("双域通配应放行");
    assert_eq!(output.json["path"], json!("readme.md"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_permission_qualified_snapshot_entry_does_not_widen() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    register_read_file(&bridge, &["filesystem:read"]);
    // 限定值条目不覆盖裸基础权限：Bridge 层按《Bridge三层设计》§5.2 收口。
    bridge
        .open_session(
            1,
            "chips.official.editor".to_owned(),
            vec!["filesystem:read:${userDocuments}/chips".to_owned()],
        )
        .expect("会话登记应成功");
    let error = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect_err("限定值快照条目不得放宽为裸权限");
    assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_session_snapshot_rebuilt_on_reopen() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    register_read_file(&bridge, &["filesystem:read"]);
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("初始会话登记应成功");
    let error = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect_err("初始快照未授权应拒绝");
    assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
    // 授权变更：重新 open_session 即按新快照重建（《08-权限系统设计》§7.6）。
    bridge
        .open_session(
            1,
            "chips.official.editor".to_owned(),
            vec!["filesystem:read".to_owned()],
        )
        .expect("会话重建应成功");
    let output = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect("新快照应放行");
    assert_eq!(output.json["path"], json!("readme.md"));
    // 再次重建为空授权：回到拒绝（撤销表现为快照重建后不再包含该项）。
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话第三次登记应成功");
    let error = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect_err("撤销后快照应再次拒绝");
    assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
    let details = error.details().expect("权限拒绝必须携带详情");
    assert_eq!(details["granted"], json!([]));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_snapshot_isolation_between_sessions() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    register_read_file(&bridge, &["filesystem:read"]);
    bridge
        .open_session(
            1,
            "chips.official.editor".to_owned(),
            vec!["filesystem:read".to_owned()],
        )
        .expect("授权会话登记应成功");
    bridge
        .open_session(2, "chips.official.viewer".to_owned(), Vec::new())
        .expect("未授权会话登记应成功");
    let output = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect("授权会话应放行");
    assert_eq!(output.json["path"], json!("readme.md"));
    let error = bridge
        .request(request_of(2, "file:read"))
        .await
        .expect_err("未授权会话应独立拒绝");
    assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
    let details = error.details().expect("权限拒绝必须携带详情");
    assert_eq!(
        details["granted"],
        json!([]),
        "会话 2 的快照不得混入会话 1 授权"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_close_session_blocks_new_calls_and_is_idempotent() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    register_read_file(&bridge, &[]);
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    bridge.close_session(1);
    let error = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect_err("关闭后的会话调用必须拒绝");
    assert_eq!(error.code(), BRIDGE_SESSION_UNKNOWN);
    // 幂等：重复关闭与关闭未知会话都不产生 panic。
    bridge.close_session(1);
    bridge.close_session(8_888);
    let error = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect_err("重复关闭后会话仍不可用");
    assert_eq!(error.code(), BRIDGE_SESSION_UNKNOWN);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_close_session_cancels_in_flight_calls() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    register_read_file(&bridge, &[]);
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:list".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: chips_bridge::DEFAULT_MAX_QUEUE,
            executor: Arc::new(HoldExecutor {
                started: Arc::clone(&started),
                release: Arc::clone(&release),
            }),
        })
        .expect("挂起能力注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    bridge
        .open_session(2, "chips.official.viewer".to_owned(), Vec::new())
        .expect("旁证会话登记应成功");
    let in_flight = {
        let bridge = bridge.clone();
        tokio::spawn(async move { bridge.request(request_of(1, "file:list")).await })
    };
    wait_started(&started, 1).await;
    // 会话销毁：取消该会话全部在途调用（《Bridge三层设计》§8.2 取消来源之一）。
    bridge.close_session(1);
    let error = in_flight
        .await
        .expect("在途任务应收口")
        .expect_err("会话销毁后在途调用应返回取消");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    assert!(!error.retryable(), "BRIDGE_CANCELLED 不可重试");
    // 其它会话不受影响，可正常发起新调用。
    release.store(true, Ordering::SeqCst);
    let output = bridge
        .request(request_of(2, "file:list"))
        .await
        .expect("释放后旁证会话调用应成功（会话 1 的销毁不影响会话 2）");
    assert_eq!(output.json["path"], json!("readme.md"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_cancel_session_keeps_session_usable() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    register_read_file(&bridge, &[]);
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:list".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: chips_bridge::DEFAULT_MAX_QUEUE,
            executor: Arc::new(HoldExecutor {
                started: Arc::clone(&started),
                release: Arc::clone(&release),
            }),
        })
        .expect("挂起能力注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    // 无在途时取消：幂等且不影响会话可用性。
    bridge.cancel_session(1);
    bridge.cancel_session(7_777);
    let in_flight = {
        let bridge = bridge.clone();
        tokio::spawn(async move { bridge.request(request_of(1, "file:list")).await })
    };
    wait_started(&started, 1).await;
    bridge.cancel_session(1);
    let error = in_flight
        .await
        .expect("在途任务应收口")
        .expect_err("取消后在途调用应返回取消");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    assert!(!error.retryable());
    // 会话保持可用（《核心接口规范》§5.2 cancel_session 语义）。
    release.store(true, Ordering::SeqCst);
    let output = bridge
        .request(request_of(1, "file:list"))
        .await
        .expect("cancel_session 后会话应仍可调用");
    assert_eq!(output.json["path"], json!("readme.md"));
}
