//! draining 与关闭态交界的公开行为面回归：
//! - 关闭后的 `begin_draining` 按取消拒绝（《Bridge三层设计》§8.2「Bridge 关
//!   闭」为取消来源，关闭态拒绝一切新动作；与 `bridge_lifecycle.rs` 中
//!   `activate_provider`/`grant_capability_id`/`register`/`open_session`/
//!   `request` 的关闭态拒绝矩阵同口径）；
//! - 有在途调用时重复 `begin_draining` 为幂等 no-op（《能力契约规范》§10.1
//!   状态机：`active →draining` 至多一次；过渡态只能经在途收口退出），
//!   第二次调用不得重复登记、不得唤醒、不得取消在途调用。
//!
//! 断言一律取公开行为面（返回值、`capability_state`、`has_capability`、
//! 调用结果），不触碰内核内部符号。

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;

use chips_bridge::{
    Bridge, CapabilityContext, CapabilityDescriptor, CapabilityExecutor, CapabilityInput,
    CapabilityOutput, CapabilityRegistration, CapabilityState, Concurrency, ProviderKind,
    ProviderRegistration, BRIDGE_CANCELLED, DEFAULT_MAX_QUEUE,
};
use chips_core::ChipsError;
use serde_json::json;

/// 挂起执行器：轮询释放标志后原样返回输入；6 秒兜底防悬挂。
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
        Ok(CapabilityOutput {
            json: input.json,
            bin: input.bin,
        })
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

/// 激活平台服务域、注册内置回声能力并登记调用会话。
fn setup_bridge(bridge: &Bridge, capability_id: &str, executor: Arc<dyn CapabilityExecutor>) {
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("平台服务域激活应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: capability_id.to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::Parallel,
            max_queue: DEFAULT_MAX_QUEUE,
            executor,
        })
        .expect("能力注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
}

fn echo_request(capability_id: &str) -> chips_bridge::BridgeRequest {
    chips_bridge::BridgeRequest {
        request_id: "req-drain-edge".to_owned(),
        capability_id: capability_id.to_owned(),
        session: 1,
        input: CapabilityInput::json_only(json!({ "path": "readme.md" })),
    }
}

/// 等待在途执行数达到目标值（真实时钟短轮询）。
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

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_begin_draining_after_shutdown_is_cancelled() {
    let bridge = Bridge::new();
    setup_bridge(
        &bridge,
        "file:read",
        Arc::new(HoldExecutor {
            started: Arc::new(AtomicUsize::new(0)),
            release: Arc::new(AtomicBool::new(true)),
        }),
    );
    bridge.shutdown();
    assert!(bridge.is_shutdown());
    // 关闭态下的代际切换指令按取消拒绝，且不得留下任何状态变化。
    let error = bridge
        .begin_draining("file:read")
        .expect_err("关闭后 begin_draining 必须拒绝");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    assert!(!error.retryable(), "BRIDGE_CANCELLED 不可重试");
    assert!(
        bridge.has_capability("file:read"),
        "关闭态拒绝不得额外摘除注册项（关闭本身不改注册表）"
    );
    assert_eq!(
        bridge.capability_state("file:read"),
        Some(CapabilityState::Active),
        "被拒绝的 draining 指令不得改变生命周期状态"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_begin_draining_twice_with_in_flight_is_idempotent_noop() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    setup_bridge(
        &bridge,
        "file:read",
        Arc::new(HoldExecutor {
            started: Arc::clone(&started),
            release: Arc::clone(&release),
        }),
    );
    let running = {
        let bridge = bridge.clone();
        tokio::spawn(async move { bridge.request(echo_request("file:read")).await })
    };
    wait_started(&started, 1).await;
    // 第一次：进入 draining，在册拒绝新调用，在途不强杀（§10.1）。
    bridge
        .begin_draining("file:read")
        .expect("首次 draining 应成功");
    assert_eq!(
        bridge.capability_state("file:read"),
        Some(CapabilityState::Draining),
        "在册且有在途时应处于过渡态"
    );
    // 第二次：已在过渡态，重复调用为幂等 no-op（不得唤醒、不得报错）。
    bridge
        .begin_draining("file:read")
        .expect("重复 draining 应为幂等 no-op");
    assert_eq!(
        bridge.capability_state("file:read"),
        Some(CapabilityState::Draining)
    );
    let error = bridge
        .request(echo_request("file:read"))
        .await
        .expect_err("draining 期间新调用必须按未找到拒绝");
    assert_eq!(error.code(), chips_bridge::BRIDGE_CAPABILITY_NOT_FOUND);
    // 释放：在途调用正常收尾（非取消），收口后自动进入「已注销」。
    release.store(true, Ordering::SeqCst);
    let output = running
        .await
        .expect("在途任务应收口")
        .expect("在途调用应完成收到结果");
    assert_eq!(output.json["path"], json!("readme.md"));
    for _ in 0..250 {
        if bridge.capability_state("file:read").is_none() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(4)).await;
    }
    assert!(
        !bridge.has_capability("file:read"),
        "在途清零后旧代际应自动收口为已注销（§10.1 状态机）"
    );
    // 收口后再触发 draining 仍为幂等 no-op。
    bridge
        .begin_draining("file:read")
        .expect("收口后 draining 应为 no-op");
}
