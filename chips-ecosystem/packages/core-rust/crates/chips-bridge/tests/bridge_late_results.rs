//! 迟到结果与强止竞态的收口回归（《Bridge三层设计》§8.2：取消后到达的
//! 结果按丢弃处理；《核心接口规范》§5.2 取消/执行阶段）：
//! - 执行器触发自身 `signal` 后返回成功：调用方可见结果只有两种合法交错
//!   ——执行期 select 观测到取消（`BRIDGE_CANCELLED`），或成功结果已随
//!   `JoinHandle` 就绪、但收口时 `cancel` 已置位按丢弃（同为
//!   `BRIDGE_CANCELLED`）。两种交错都不得把「已取消调用」的结果回传；
//! - 执行器触发自身 `signal` 后返回业务错误：同理只可能收到
//!   `BRIDGE_CANCELLED`（取消优先）或按取消收口，绝不回传业务错误码；
//! - 外部强止（会话取消携带 `abort`）与执行期 select 的竞态：任务被强止
//!   后 `JoinHandle` 以非 panic 的 `JoinError` 收归，归一为
//!   `BRIDGE_CANCELLED`（不得误报 `BRIDGE_INTERNAL`）。
//!
//! 三类用例的断言在全部合法交错下恒定（错误码唯一），多轮重复以稳定
//! 覆盖竞态两侧的分支，不依赖调度顺序。

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, Concurrency, ProviderKind,
    ProviderRegistration, BRIDGE_CANCELLED, BRIDGE_TIMEOUT, DEFAULT_MAX_QUEUE,
};
use chips_core::ChipsError;
use serde_json::json;

/// 自取消成功执行器：先触发 `ctx.signal`，随即返回成功（结果必为迟到）。
struct SelfCancelOkExecutor;

#[async_trait::async_trait]
impl CapabilityExecutor for SelfCancelOkExecutor {
    async fn execute(
        &self,
        ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        ctx.signal.cancel();
        Ok(CapabilityOutput {
            json: input.json,
            bin: input.bin,
        })
    }
}

/// 自取消业务错误执行器：先触发 `ctx.signal`，再返回业务错误。
struct SelfCancelFailExecutor;

#[async_trait::async_trait]
impl CapabilityExecutor for SelfCancelFailExecutor {
    async fn execute(
        &self,
        ctx: &CapabilityContext,
        _input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        ctx.signal.cancel();
        Err(ChipsError::new("FILE_NOT_FOUND", "目标不存在"))
    }
}

/// 长眠执行器：无视一切信号持续挂起，等待外部强止。
struct SleepExecutor {
    started: Arc<AtomicUsize>,
    millis: u64,
}

#[async_trait::async_trait]
impl CapabilityExecutor for SleepExecutor {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        self.started.fetch_add(1, Ordering::SeqCst);
        tokio::time::sleep(Duration::from_millis(self.millis)).await;
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

fn setup(bridge: &Bridge, capability_id: &str, executor: Arc<dyn CapabilityExecutor>) {
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
}

fn request(session: u64, capability_id: &str, request_id: &str) -> BridgeRequest {
    BridgeRequest {
        request_id: request_id.to_owned(),
        capability_id: capability_id.to_owned(),
        session,
        input: CapabilityInput::json_only(json!({ "path": "readme.md" })),
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_self_cancelled_success_result_never_escapes() {
    let bridge = Bridge::new();
    setup(
        &bridge,
        "file:read",
        Arc::new(SelfCancelOkExecutor) as Arc<dyn CapabilityExecutor>,
    );
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    // 任意合法交错下都只应收到取消收口；多轮重复覆盖「结果先就绪后丢弃」
    // 与「select 先观测到取消」两条收口分支。
    for round in 0..120 {
        let error = bridge
            .request(request(1, "file:read", &format!("req-ok-{round}")))
            .await
            .expect_err("自取消调用的结果不得回传");
        assert_eq!(
            error.code(),
            BRIDGE_CANCELLED,
            "第 {round} 轮收口码不符：取消优先于迟到结果"
        );
        assert!(!error.retryable());
    }
    // 全部在途收口后内核保持可用。
    assert!(bridge.invocation_context(1, "req-ok-0").is_none());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_self_cancelled_business_error_never_escapes() {
    let bridge = Bridge::new();
    setup(
        &bridge,
        "file:read",
        Arc::new(SelfCancelFailExecutor) as Arc<dyn CapabilityExecutor>,
    );
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    for round in 0..120 {
        let error = bridge
            .request(request(1, "file:read", &format!("req-fail-{round}")))
            .await
            .expect_err("自取消执行器的业务错误不得作为迟到结果回传");
        assert_eq!(
            error.code(),
            BRIDGE_CANCELLED,
            "第 {round} 轮：已取消的调用以取消收口优先（§8.2），业务错误码 FILE_NOT_FOUND 被丢弃"
        );
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_external_abort_is_cancelled_not_internal() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    setup(
        &bridge,
        "file:read",
        Arc::new(SleepExecutor {
            started: Arc::clone(&started),
            millis: 2_000,
        }) as Arc<dyn CapabilityExecutor>,
    );
    // 风暴式外部强止：每轮 12 个并发在途调用，逐一执行器挂起后按会话
    // `close_session`（取消 + 强止）收口。被强止任务的非 panic
    // `JoinError` 先于调用方 select 轮询可见时走 `Some(Err)` 收归分支，
    // 调用方先观测到令牌取消时走 `None` 强止分支；两条交错的收口码同为
    // `BRIDGE_CANCELLED`（不得误报 `BRIDGE_INTERNAL`），断言与调度顺序无关。
    for round in 0..40u64 {
        let mut running = Vec::new();
        for slot in 0..12u64 {
            let session = round * 100 + slot;
            bridge
                .open_session(session, "chips.official.editor".to_owned(), Vec::new())
                .expect("会话登记应成功");
            let request_bridge = bridge.clone();
            running.push((
                session,
                tokio::spawn(async move {
                    request_bridge
                        .request(request(
                            session,
                            "file:read",
                            &format!("req-abort-{session}"),
                        ))
                        .await
                }),
            ));
        }
        // 等到全部执行任务真正挂起（abort 句柄已登记、执行器已在眠）。
        for _ in 0..1_000 {
            if started.load(Ordering::SeqCst) >= 12 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(1)).await;
        }
        for (session, _) in &running {
            bridge.close_session(*session);
        }
        for (_, handle) in running {
            let error = handle
                .await
                .expect("任务应收口")
                .expect_err("被强止的调用必须按取消收口");
            assert_eq!(error.code(), BRIDGE_CANCELLED, "第 {round} 轮收口码不符");
            assert!(!error.retryable());
        }
        started.store(0, Ordering::SeqCst);
    }
}
