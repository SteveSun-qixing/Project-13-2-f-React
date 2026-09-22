//! 准入阶段「两段锁」竞态窗口的并发回归（《核心接口规范》§5.2 阶段表、
//! §2.2 规则 3「公开函数不得在持锁状态下 await」；《能力契约规范》§10.1/
//! §11.2 draining 拒绝新调用；《Bridge三层设计》§8.2 取消来源）：
//! - 会话校验与并发准入之间内核被关闭 → 按 `BRIDGE_CANCELLED` 拒绝；
//! - 两段锁之间能力进入 draining → 按 `BRIDGE_CAPABILITY_NOT_FOUND` 拒绝；
//! - 两段锁之间会话被关闭 → 按 `BRIDGE_SESSION_UNKNOWN` 拒绝（已进入执行
//!   的在途调用则按取消收口）。
//!
//! 由于「拒绝/放行」取决于对手线程落在窗口的哪一侧，单条请求的合法结果
//! 是一个确定集合；断言取集合成员关系与最终一致性（draining 风暴后注册
//! 项自动收口、会话关闭后链路不可用），不依赖调度顺序。慢输入校验用于
//! 拉宽锁外窗口，提高对手动作落入窗口内的概率。

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, CapabilityState, Concurrency,
    ProviderKind, ProviderRegistration, BRIDGE_CANCELLED, BRIDGE_CAPABILITY_NOT_FOUND,
    BRIDGE_SESSION_UNKNOWN, DEFAULT_MAX_QUEUE,
};
use chips_core::{ChipsError, NoopDecisionObserver};
use serde_json::json;

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

fn field_count() -> usize {
    400
}

fn heavy_schema(marker: usize) -> serde_json::Value {
    let mut properties = serde_json::Map::new();
    let mut required = Vec::new();
    for index in 0..field_count() {
        let name = format!("k{index}");
        required.push(json!(name.clone()));
        properties.insert(name, json!({ "type": "string", "minLength": 1 }));
    }
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": required,
        "properties": properties,
        "description": format!("admission-round-{marker}"),
    })
}

fn heavy_input() -> CapabilityInput {
    let mut fields = serde_json::Map::new();
    for index in 0..field_count() {
        fields.insert(format!("k{index}"), json!("v"));
    }
    CapabilityInput {
        json: serde_json::Value::Object(fields),
        bin: BTreeMap::new(),
    }
}

/// 新 Bridge + 平台服务域 + 大 schema 回声能力 + 指定会话。
fn setup(marker: usize, session: u64) -> Bridge {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
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
                id: "file:read".to_owned(),
                schema: heavy_schema(marker),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::Parallel,
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor) as Arc<dyn CapabilityExecutor>,
        })
        .expect("能力注册应成功");
    bridge
        .open_session(session, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    bridge
}

fn request(session: u64, request_id: &str) -> BridgeRequest {
    BridgeRequest {
        request_id: request_id.to_owned(),
        capability_id: "file:read".to_owned(),
        session,
        input: heavy_input(),
    }
}

fn spawn_requests(
    bridge: &Bridge,
    session: u64,
    count: usize,
) -> Vec<tokio::task::JoinHandle<ChipsError>> {
    (0..count)
        .map(|index| {
            let bridge = bridge.clone();
            tokio::spawn(async move {
                let outcome = bridge
                    .request(request(session, &format!("req-{index}")))
                    .await;
                match outcome {
                    // 成功路径以哨兵错误码回传，便于跨任务统一断言。
                    Ok(_) => ChipsError::new("__OK__", "成功哨兵"),
                    Err(error) => error,
                }
            })
        })
        .collect()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_shutdown_between_admission_locks_allowed_outcomes() {
    let round_counter = AtomicUsize::new(0);
    for _round in 0..10 {
        let round = round_counter.fetch_add(1, Ordering::SeqCst);
        let bridge = setup(round, 1);
        let handles = spawn_requests(&bridge, 1, 20);
        // 微错位：关闭动作可能落在各请求两段锁之间、入口锁之前或全部放行之后。
        tokio::time::sleep(Duration::from_micros(150 + (round as u64 % 5) * 120)).await;
        bridge.shutdown();
        for handle in handles {
            let error = handle.await.expect("请求任务应收口");
            assert!(
                matches!(error.code(), "__OK__" | BRIDGE_CANCELLED),
                "准入与关闭竞态只允许成功或取消收口，实得 {}",
                error.code()
            );
        }
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_draining_between_admission_locks_rejects_new_calls() {
    let round_counter = AtomicUsize::new(0);
    for _round in 0..10 {
        let round = round_counter.fetch_add(1, Ordering::SeqCst);
        let bridge = setup(round, 1);
        let handles = spawn_requests(&bridge, 1, 20);
        tokio::time::sleep(Duration::from_micros(150 + (round as u64 % 5) * 120)).await;
        bridge
            .begin_draining("file:read")
            .expect("draining 指令应成功");
        for handle in handles {
            let error = handle.await.expect("请求任务应收口");
            assert!(
                matches!(error.code(), "__OK__" | BRIDGE_CAPABILITY_NOT_FOUND),
                "draining 竞态只允许放行或按未找到拒绝（§11.2），实得 {}",
                error.code()
            );
        }
        // 全部收口后旧代际自动注销（§10.1 状态机）。
        assert_eq!(bridge.capability_state("file:read"), None);
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_close_session_between_admission_locks_rejects_new_calls() {
    let round_counter = AtomicUsize::new(0);
    for _round in 0..10 {
        let round = round_counter.fetch_add(1, Ordering::SeqCst);
        let bridge = setup(round, 7);
        let handles = spawn_requests(&bridge, 7, 20);
        tokio::time::sleep(Duration::from_micros(150 + (round as u64 % 5) * 120)).await;
        bridge.close_session(7);
        for handle in handles {
            let error = handle.await.expect("请求任务应收口");
            assert!(
                matches!(
                    error.code(),
                    "__OK__" | BRIDGE_SESSION_UNKNOWN | BRIDGE_CANCELLED
                ),
                "会话关闭竞态只允许放行、未解析拒绝或取消收口，实得 {}",
                error.code()
            );
        }
        assert!(
            !bridge.has_capability("file:read")
                || bridge.capability_state("file:read") == Some(CapabilityState::Active),
            "会话收口不得改变注册表状态"
        );
        // 会话关闭后同会话新调用一律按未解析拒绝。
        let error = bridge
            .request(request(7, "req-after-close"))
            .await
            .expect_err("关闭后的会话不得再准入");
        assert_eq!(error.code(), BRIDGE_SESSION_UNKNOWN);
    }
}
