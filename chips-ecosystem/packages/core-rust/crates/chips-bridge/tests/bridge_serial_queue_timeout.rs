//! 串行队列等待期的超时与收口回归：
//! - 排队调用在等待槽位期间按注册项 `timeout_ms` 收口为 `BRIDGE_TIMEOUT`
//!   （可重试，《核心接口规范》§5.2 执行阶段、《Bridge三层设计》§8.1/§8.3），
//!   且排队者提前收口**不得**释放在执持有者的槽位（《核心接口规范》§5.1
//!   `Concurrency::Serial`「同一能力 ID 全局串行」——本用例同时钉住该缺陷
//!   修复：持有者仍在前台执行时，新调用必须继续排队而非插队并发执行）；
//! - 注销清理串行队列时，排队调用按 `BRIDGE_CANCELLED` 收口（§8.2 取消来源
//!   「能力注销」；无论唤醒分支先到排队者还是队列先被清理，收口结果一致）；
//! - 准入完成后截止时刻已过（慢校验输入 + 极小 `timeout_ms`）的执行期收口
//!   按 `BRIDGE_TIMEOUT` 返回，截止睡眠走「已过期立即返回」路径
//!   （§8.1：超时从 Bridge 层收到请求起算，而非执行器启动起算）。
//!
//! 断言一律取公开行为面与执行器可观测副作用（启动计数、并发在执峰值、
//! 启动顺序），不触碰内核内部符号。

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, Concurrency, ProviderKind,
    ProviderRegistration, BRIDGE_CANCELLED, BRIDGE_TIMEOUT,
};
use chips_core::ChipsError;
use serde_json::json;

/// 挂起执行器：记录启动顺序与并发在执峰值，轮询释放标志；6 秒兜底防悬挂。
struct HoldExecutor {
    started: Arc<AtomicUsize>,
    ticks: Arc<AtomicUsize>,
    inflight: Arc<AtomicUsize>,
    max_inflight: Arc<AtomicUsize>,
    release: Arc<AtomicBool>,
    order: Arc<Mutex<Vec<i64>>>,
}

impl HoldExecutor {
    fn new() -> Self {
        Self {
            started: Arc::new(AtomicUsize::new(0)),
            ticks: Arc::new(AtomicUsize::new(0)),
            inflight: Arc::new(AtomicUsize::new(0)),
            max_inflight: Arc::new(AtomicUsize::new(0)),
            release: Arc::new(AtomicBool::new(false)),
            order: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

/// 在执计数守卫：随执行器 future 落弃（含被强止）自动复位，保证
/// 并发在执峰值测量不被取消路径污染。
struct InflightGuard {
    inflight: Arc<AtomicUsize>,
}

impl InflightGuard {
    fn new(inflight: Arc<AtomicUsize>, max_inflight: &AtomicUsize) -> Self {
        let now = inflight.fetch_add(1, Ordering::SeqCst) + 1;
        max_inflight.fetch_max(now, Ordering::SeqCst);
        Self { inflight }
    }
}

impl Drop for InflightGuard {
    fn drop(&mut self) {
        self.inflight.fetch_sub(1, Ordering::SeqCst);
    }
}

#[async_trait::async_trait]
impl CapabilityExecutor for HoldExecutor {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        if let Some(tag) = input.json.get("tag").and_then(serde_json::Value::as_i64) {
            self.order.lock().expect("顺序记录锁应可用").push(tag);
        }
        self.started.fetch_add(1, Ordering::SeqCst);
        let _guard = InflightGuard::new(Arc::clone(&self.inflight), &self.max_inflight);
        let output = CapabilityOutput {
            json: input.json,
            bin: input.bin,
        };
        loop {
            if self.release.load(Ordering::SeqCst)
                || self.ticks.fetch_add(1, Ordering::SeqCst) > 3_000
            {
                return Ok(output);
            }
            tokio::time::sleep(Duration::from_millis(2)).await;
        }
    }
}

/// 无视取消的长眠执行器：用于截止时刻过期后的执行期收口验证。
struct SleepExecutor {
    millis: u64,
}

#[async_trait::async_trait]
impl CapabilityExecutor for SleepExecutor {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        tokio::time::sleep(Duration::from_millis(self.millis)).await;
        Ok(CapabilityOutput {
            json: input.json,
            bin: input.bin,
        })
    }
}

fn field_count() -> usize {
    600
}

/// 大 schema：600 个字符串字段（注册期编译成本与调用期校验成本均为毫秒级），
/// `marker` 保证跨轮次内容摘要不同、不命中编译缓存。
fn heavy_schema(marker: &str) -> serde_json::Value {
    let mut properties = serde_json::Map::new();
    let mut required = Vec::new();
    for index in 0..field_count() {
        let name = format!("k{index}");
        required.push(json!(name.clone()));
        properties.insert(
            name,
            json!({ "type": "string", "minLength": 1, "maxLength": 32 }),
        );
    }
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": required,
        "properties": properties,
        "description": marker,
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

fn hold_request(session: u64, capability_id: &str, request_id: &str, tag: i64) -> BridgeRequest {
    BridgeRequest {
        request_id: request_id.to_owned(),
        capability_id: capability_id.to_owned(),
        session,
        input: CapabilityInput::json_only(json!({ "path": "x", "tag": tag })),
    }
}

fn simple_schema() -> serde_json::Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["path"],
        "properties": {
            "path": { "type": "string", "minLength": 1 },
            "tag": { "type": "integer" }
        }
    })
}

/// 激活平台服务域并注册由指定执行器承载的内置串行能力。
fn register_host_serial(
    bridge: &Bridge,
    capability_id: &str,
    timeout_ms: u64,
    max_queue: usize,
    executor: Arc<dyn CapabilityExecutor>,
) {
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
                schema: simple_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms,
            concurrency: Concurrency::Serial,
            max_queue,
            executor,
        })
        .expect("串行能力注册应成功");
}

/// 等待在途执行数达到目标值（真实时钟短轮询）。
async fn wait_started(counter: &AtomicUsize, target: usize) {
    for _ in 0..1_500 {
        if counter.load(Ordering::SeqCst) >= target {
            return;
        }
        tokio::time::sleep(Duration::from_millis(4)).await;
    }
    panic!(
        "在限定时间内未达到 {target} 个在途执行（当前 {}）",
        counter.load(Ordering::SeqCst)
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_queued_call_times_out_without_releasing_holder_slot() {
    let bridge = Bridge::new();
    let executor = Arc::new(HoldExecutor::new());
    register_host_serial(
        &bridge,
        "file:move",
        30_000,
        64,
        Arc::clone(&executor) as Arc<dyn CapabilityExecutor>,
    );
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    // A 取得串行槽位并在前台挂起执行。
    let a = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:move", "req-a", 1))
                .await
        })
    };
    wait_started(&executor.started, 1).await;
    // 蓝绿接管把注册项超时收紧到 12 毫秒（《能力契约规范》§9.3 允许的同
    // owner 定义覆盖）：后续新调用按新超时收口，A 仍持旧快照执行。
    bridge
        .takeover_register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:move".to_owned(),
                schema: simple_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 12,
            concurrency: Concurrency::Serial,
            max_queue: 64,
            executor: Arc::clone(&executor) as Arc<dyn CapabilityExecutor>,
        })
        .expect("原 owner 接管注册应成功");
    // B 排队等待槽位，12 毫秒截止在队列中到期：按超时收口。
    let error_b = bridge
        .request(hold_request(1, "file:move", "req-b", 2))
        .await
        .expect_err("排队调用必须按截止时刻收口");
    assert_eq!(error_b.code(), BRIDGE_TIMEOUT);
    assert!(error_b.retryable(), "BRIDGE_TIMEOUT 可重试");
    // D 随后到达：A 仍在执行，串行槽位必须由 A 持有——排队者 B 的收口
    // 不得提前释放持有者槽位（回归：旧实现以布尔 busy 记账，排队者释放
    // 即清 busy，导致 D 与 A 并发执行的串行违背）。
    let d = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:move", "req-d", 4))
                .await
        })
    };
    let error_d = d
        .await
        .expect("D 任务应收口")
        .expect_err("D 同样在队列中超时");
    assert_eq!(error_d.code(), BRIDGE_TIMEOUT);
    assert!(error_d.retryable(), "D 超时收口同样可重试");
    // 全程并发在执峰值必须为 1（同一能力 ID 全局串行）。
    assert_eq!(
        executor.max_inflight.load(Ordering::SeqCst),
        1,
        "排队者超时不得让后续调用插队并发执行"
    );
    assert_eq!(
        *executor.order.lock().expect("顺序锁应可用"),
        vec![1_i64],
        "仅持有者 A 应进入执行器"
    );
    // 释放 A：槽位正常回收，链路恢复可用。
    executor.release.store(true, Ordering::SeqCst);
    let output_a = a
        .await
        .expect("A 任务应收口")
        .expect("A 应正常完成收到结果");
    assert_eq!(output_a.json["tag"], json!(1));
    bridge
        .takeover_register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:move".to_owned(),
                schema: simple_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::Serial,
            max_queue: 64,
            executor: Arc::clone(&executor) as Arc<dyn CapabilityExecutor>,
        })
        .expect("恢复超时的接管注册应成功");
    let output_e = bridge
        .request(hold_request(1, "file:move", "req-e", 5))
        .await
        .expect("槽位回收后新调用应串行执行成功");
    assert_eq!(output_e.json["tag"], json!(5));
    assert_eq!(
        executor.max_inflight.load(Ordering::SeqCst),
        1,
        "收尾链路同样必须保持全局串行"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_unregister_while_queued_wakes_waiters_as_cancelled() {
    let bridge = Bridge::new();
    let executor = Arc::new(HoldExecutor::new());
    register_host_serial(
        &bridge,
        "file:move",
        30_000,
        64,
        Arc::clone(&executor) as Arc<dyn CapabilityExecutor>,
    );
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    bridge
        .open_session(2, "chips.official.viewer".to_owned(), Vec::new())
        .expect("旁证会话登记应成功");
    let a = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:move", "req-a", 1))
                .await
        })
    };
    wait_started(&executor.started, 1).await;
    // 双会话各 24 个排队者，占满串行队列（max_queue=64 足够容纳）。
    let mut waiters = Vec::new();
    for index in 0..48 {
        let bridge = bridge.clone();
        let session = if index % 2 == 0 { 1 } else { 2 };
        waiters.push(tokio::spawn(async move {
            bridge
                .request(hold_request(
                    session,
                    "file:move",
                    &format!("req-w-{index}"),
                    index as i64,
                ))
                .await
        }));
    }
    tokio::time::sleep(Duration::from_millis(60)).await;
    // 注销：取消全部在途调用并清理串行队列；排队者或被令牌取消唤醒、或经
    // 队列清理（通道关闭）唤醒，两种到达顺序都按 BRIDGE_CANCELLED 收口
    // （《核心接口规范》§5.2 取消阶段）。
    bridge
        .unregister("file:move")
        .expect("存在在途与排队调用时注销应成功");
    let error_a = a
        .await
        .expect("A 任务应收口")
        .expect_err("持有者应按取消收口");
    assert_eq!(error_a.code(), BRIDGE_CANCELLED);
    assert!(!error_a.retryable());
    for handle in waiters {
        let error = handle
            .await
            .expect("排队任务应收口")
            .expect_err("排队调用应按取消收口");
        assert_eq!(error.code(), BRIDGE_CANCELLED);
    }
    // 注销后队列与串行态整体清理：同 ID 由原 owner 重注册后链路恢复。
    register_host_serial(
        &bridge,
        "file:move",
        30_000,
        64,
        Arc::clone(&executor) as Arc<dyn CapabilityExecutor>,
    );
    executor.release.store(true, Ordering::SeqCst);
    let output = bridge
        .request(hold_request(1, "file:move", "req-after", 9))
        .await
        .expect("重注册后串行链路应恢复");
    assert_eq!(output.json["tag"], json!(9));
    assert_eq!(
        executor.max_inflight.load(Ordering::SeqCst),
        1,
        "风暴收口全程不得出现并发越界执行"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_admission_overrun_deadline_times_out_at_execute_stage() {
    let bridge = Bridge::new();
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
                schema: heavy_schema("deadline-overrun"),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 1,
            concurrency: Concurrency::Parallel,
            max_queue: 1,
            executor: Arc::new(SleepExecutor { millis: 500 }) as Arc<dyn CapabilityExecutor>,
        })
        .expect("大 schema 注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    // 超时从收到请求起算（《Bridge三层设计》§8.1）：慢输入校验让截止时刻
    // 在准入/执行阶段前到期，执行期收口必须仍按 BRIDGE_TIMEOUT 返回。
    // 多轮重复以覆盖「截止已过期立即返回」的调度兜底路径。
    for round in 0..30 {
        let error = bridge
            .request(BridgeRequest {
                request_id: format!("req-overrun-{round}"),
                capability_id: "file:read".to_owned(),
                session: 1,
                input: heavy_input(),
            })
            .await
            .expect_err("截止已过的调用必须按超时收口");
        assert_eq!(error.code(), BRIDGE_TIMEOUT, "第 {round} 轮收口码不符");
        assert!(error.retryable(), "BRIDGE_TIMEOUT 可重试");
    }
    assert_eq!(
        bridge.capability_state("file:read"),
        Some(chips_bridge::CapabilityState::Active),
        "超时收口不得改变注册项状态"
    );
}
