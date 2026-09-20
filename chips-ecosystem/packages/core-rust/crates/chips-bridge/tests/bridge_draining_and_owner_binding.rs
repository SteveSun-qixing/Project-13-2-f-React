//! 《能力契约规范》§4.4 残口收口回归：原 owner 重注册绑定与蓝绿 draining。
//!
//! 依据条文（§4.4 注销与在途调用）：
//! - 「注销后停止接受新调用（`BRIDGE_CAPABILITY_NOT_FOUND`）；在途调用按
//!   《Bridge三层设计》第 8 节收口，调用方收到结果或 `BRIDGE_CANCELLED`。」
//! - 「注销完成后，同一 ID 只能由原 owner 重新注册；其他提供方不得抢占，
//!   重注册校验与首次注册一致。」
//! - 「蓝绿更新代际切换：旧代际注册项进入 `draining`，新代际接管
//!   （第 9.3 节、第十节）。」
//!
//! 配套口径：§9.3「蓝绿更新的代际接管——唯一允许的同 ID 覆盖」「其他 owner
//! 抢占已注销 ID——拒绝，`BRIDGE_CAPABILITY_CONFLICT`」；§10.1 状态机
//! （`draining`：拒绝新调用；在途调用完成或按超时收口；在途收口后进入
//! 已注销）；§11.2（draining 后的新调用报 `BRIDGE_CAPABILITY_NOT_FOUND`，
//! 注册冲突报 `BRIDGE_CAPABILITY_CONFLICT`，均不可重试）。

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, CapabilityState, Concurrency,
    ProviderKind, ProviderRegistration, BRIDGE_CAPABILITY_CONFLICT, BRIDGE_CAPABILITY_NOT_FOUND,
    BRIDGE_INTERNAL, BRIDGE_TIMEOUT, DEFAULT_MAX_QUEUE,
};
use chips_core::ChipsError;
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

/// 代际标记执行器：输出带 `generation` 字段，用于区分新旧代际的处理结果。
struct GenerationEcho {
    generation: i64,
}

#[async_trait::async_trait]
impl CapabilityExecutor for GenerationEcho {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        Ok(CapabilityOutput {
            json: json!({
                "generation": self.generation,
                "path": input.json.get("path").cloned().unwrap_or(json!(null)),
            }),
            bin: BTreeMap::new(),
        })
    }
}

/// 挂起执行器：记录启动顺序，轮询释放标志；6 秒兜底防悬挂。
struct HoldExecutor {
    started: Arc<AtomicUsize>,
    release: Arc<AtomicBool>,
    order: Arc<Mutex<Vec<i64>>>,
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
        for _ in 0..3_000 {
            if self.release.load(Ordering::SeqCst) {
                return Ok(CapabilityOutput {
                    json: input.json,
                    bin: input.bin,
                });
            }
            tokio::time::sleep(Duration::from_millis(2)).await;
        }
        Err(ChipsError::new(
            BRIDGE_INTERNAL,
            "挂起执行器超时（测试装置兜底）",
        ))
    }
}

/// 无视取消的长眠执行器：用于 draining 期间按超时收口的验证。
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

fn host_provider() -> ProviderRegistration {
    ProviderRegistration {
        id: "chips.official.host".to_owned(),
        kind: ProviderKind::PlatformService,
        permissions: Vec::new(),
    }
}

/// 第二个平台服务域提供方：用于验证内置 ID 的原 owner 绑定约束。
fn secondary_platform_provider() -> ProviderRegistration {
    ProviderRegistration {
        id: "chips.official.secondary".to_owned(),
        kind: ProviderKind::PlatformService,
        permissions: Vec::new(),
    }
}

fn echo_schema() -> serde_json::Value {
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

fn registration_of(
    id: &str,
    owner: &str,
    executor: Arc<dyn CapabilityExecutor>,
    timeout_ms: u64,
) -> CapabilityRegistration {
    CapabilityRegistration {
        descriptor: CapabilityDescriptor {
            id: id.to_owned(),
            schema: echo_schema(),
            permissions: Vec::new(),
        },
        owner: owner.to_owned(),
        timeout_ms,
        concurrency: Concurrency::default(),
        max_queue: DEFAULT_MAX_QUEUE,
        executor,
    }
}

fn request_of(session: u64, capability_id: &str, request_id: &str) -> BridgeRequest {
    BridgeRequest {
        request_id: request_id.to_owned(),
        capability_id: capability_id.to_owned(),
        session,
        input: CapabilityInput::json_only(json!({ "path": "readme.md" })),
    }
}

fn hold_request(session: u64, capability_id: &str, request_id: &str, tag: i64) -> BridgeRequest {
    BridgeRequest {
        request_id: request_id.to_owned(),
        capability_id: capability_id.to_owned(),
        session,
        input: CapabilityInput::json_only(json!({ "path": "readme.md", "tag": tag })),
    }
}

/// 等待在途执行数达到目标值（真实时钟短轮询）。
async fn wait_started(counter: &AtomicUsize, target: usize) {
    for _ in 0..500 {
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

/// 等待在途登记出现（不依赖执行器计数的准入完成判定）。
async fn wait_admitted(bridge: &Bridge, session: u64, request_id: &str) {
    for _ in 0..500 {
        if bridge.invocation_context(session, request_id).is_some() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(4)).await;
    }
    panic!("在限定时间内未出现在途登记：{request_id}");
}

/// 等待注册项状态归零（draining 收口完成 → 已注销）。
async fn wait_state_none(bridge: &Bridge, capability_id: &str) {
    for _ in 0..500 {
        if bridge.capability_state(capability_id).is_none() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(4)).await;
    }
    panic!("在限定时间内 draining 未完成收口：{capability_id}");
}

// ---------------------------------------------------------------------------
// 语义一：同一 ID 只能由原 owner 重新注册（§4.4、§9.3）
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_builtin_id_re_register_bound_to_original_owner() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(host_provider())
        .expect("平台服务域激活应成功");
    bridge
        .activate_provider(secondary_platform_provider())
        .expect("第二平台服务域激活应成功");
    bridge
        .register(registration_of(
            "file:read",
            "chips.official.host",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect("内置能力注册应成功");
    bridge
        .unregister("file:read")
        .expect("注销应成功（幂等基面见 bridge_unregister_idempotent）");
    // 非原 owner 抢注已注销的内置 ID：拒绝（§4.4「其他提供方不得抢占」、
    // §9.3「登记绑定不可转让、不可继承」，错误码取既有 BRIDGE_CAPABILITY_CONFLICT）。
    let error = bridge
        .register(registration_of(
            "file:read",
            "chips.official.secondary",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect_err("非原 owner 抢注已注销 ID 必须拒绝");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    assert!(!error.retryable(), "BRIDGE_CAPABILITY_CONFLICT 不可重试");
    let details = error.details().expect("冲突拒绝必须携带详情");
    assert_eq!(
        details["reason"],
        json!("同一 ID 只能由原 owner 重新注册，其他提供方不得抢占")
    );
    assert_eq!(details["capabilityId"], json!("file:read"));
    // 原 owner 重新注册：成功且调用链路恢复（§4.4「重注册校验与首次注册一致」）。
    bridge
        .register(registration_of(
            "file:read",
            "chips.official.host",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect("原 owner 重新注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let output = bridge
        .request(request_of(1, "file:read", "req-re-register"))
        .await
        .expect("原 owner 重注册后调用链路应恢复");
    assert_eq!(output.json["path"], json!("readme.md"));
}

#[test]
fn test_cross_owner_registration_rejected_while_id_held() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(host_provider())
        .expect("平台服务域激活应成功");
    bridge
        .activate_provider(secondary_platform_provider())
        .expect("第二平台服务域激活应成功");
    bridge
        .register(registration_of(
            "file:list",
            "chips.official.host",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect("内置能力注册应成功");
    // §4.2 第 3 项「ID 未被其他提供方占用」：占用中的抢注同样按原 owner
    // 绑定口径拒绝，且不得破坏既有注册项。
    let error = bridge
        .register(registration_of(
            "file:list",
            "chips.official.secondary",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect_err("其他提供方不得抢占在册 ID");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    assert!(
        bridge.has_capability("file:list"),
        "抢注失败不得破坏在册注册项"
    );
    assert_eq!(
        bridge.capability_state("file:list"),
        Some(CapabilityState::Active)
    );
}

#[test]
fn test_unregistered_id_has_no_owner_binding_yet() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(host_provider())
        .expect("平台服务域激活应成功");
    bridge
        .activate_provider(secondary_platform_provider())
        .expect("第二平台服务域激活应成功");
    // 从未成功注册过的 ID 不产生原 owner 绑定（注销 no-op 也不得登记绑定）。
    bridge
        .unregister("file:copy")
        .expect("未注册 ID 注销为 no-op");
    bridge
        .register(registration_of(
            "file:copy",
            "chips.official.secondary",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect("首次注册由谁完成即绑定谁为原 owner");
    let error = bridge
        .register(registration_of(
            "file:copy",
            "chips.official.host",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect_err("注册后的 ID 只能由该首注册方持有");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
}

// ---------------------------------------------------------------------------
// 语义二：蓝绿 draining（§4.4、§9.3、§10.1、§11.2）
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_draining_rejects_new_calls_and_finishes_in_flight() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    bridge
        .activate_provider(host_provider())
        .expect("激活应成功");
    bridge
        .register(registration_of(
            "file:watch",
            "chips.official.host",
            Arc::new(HoldExecutor {
                started: Arc::clone(&started),
                release: Arc::clone(&release),
                order: Arc::clone(&order),
            }),
            30_000,
        ))
        .expect("挂起能力注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let in_flight = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:watch", "req-drain-hold", 1))
                .await
        })
    };
    wait_started(&started, 1).await;
    assert_eq!(
        bridge.capability_state("file:watch"),
        Some(CapabilityState::Active)
    );
    // 代际切换：旧代际进入 draining。
    bridge
        .begin_draining("file:watch")
        .expect("进入 draining 应成功");
    assert_eq!(
        bridge.capability_state("file:watch"),
        Some(CapabilityState::Draining),
        "§10.1：draining 是蓝绿更新的唯一过渡态"
    );
    assert!(
        bridge.has_capability("file:watch"),
        "draining 未收口前注册项仍在册（§4.3 编目 state）"
    );
    // draining 后的新调用：按 NOT_FOUND 拒绝（§11.2）。
    let error = bridge
        .request(request_of(1, "file:watch", "req-after-drain"))
        .await
        .expect_err("draining 期间不得接受新调用");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_NOT_FOUND);
    assert!(!error.retryable());
    // 在途调用不被强杀：有序收尾，调用方收到结果（§10.1「在途调用完成」）。
    release.store(true, Ordering::SeqCst);
    let output = in_flight
        .await
        .expect("在途任务应收口")
        .expect("draining 的在途调用应正常收尾而非取消");
    assert_eq!(output.json["path"], json!("readme.md"));
    assert_eq!(*order.lock().expect("顺序锁应可用"), vec![1_i64]);
    // 在途清零：draining → 已注销（§10.1 状态机）。
    wait_state_none(&bridge, "file:watch").await;
    assert!(!bridge.has_capability("file:watch"));
    // 幂等：已注销与未知 ID 再次进入 draining 均为 no-op。
    bridge
        .begin_draining("file:watch")
        .expect("收口后重复进入 draining 应为 no-op");
    bridge
        .begin_draining("file:never-registered")
        .expect("未注册 ID 进入 draining 应为 no-op");
    // 收口后原 owner 重注册恢复正常（§4.4「注销完成后……重注册校验与首次一致」）。
    bridge
        .register(registration_of(
            "file:watch",
            "chips.official.host",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect("收口后原 owner 重注册应成功");
    let output = bridge
        .request(request_of(1, "file:watch", "req-restored"))
        .await
        .expect("重注册后链路恢复");
    assert_eq!(output.json["path"], json!("readme.md"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_draining_in_flight_times_out_then_unregisters() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(host_provider())
        .expect("激活应成功");
    // timeout_ms=500 而执行体无视取消长眠 3 秒：收口只能按超时完成。
    bridge
        .register(registration_of(
            "file:copy",
            "chips.official.host",
            Arc::new(SleepExecutor { millis: 3_000 }),
            500,
        ))
        .expect("注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let in_flight = {
        let bridge = bridge.clone();
        tokio::spawn(async move { bridge.request(request_of(1, "file:copy", "req-slow")).await })
    };
    wait_admitted(&bridge, 1, "req-slow").await;
    bridge
        .begin_draining("file:copy")
        .expect("进入 draining 应成功");
    assert_eq!(
        bridge.capability_state("file:copy"),
        Some(CapabilityState::Draining)
    );
    // §10.1：在途调用「完成或按超时收口」。
    let error = in_flight
        .await
        .expect("在途任务应收口")
        .expect_err("无视取消的在途调用应按超时收口");
    assert_eq!(error.code(), BRIDGE_TIMEOUT);
    assert!(error.retryable(), "BRIDGE_TIMEOUT 可重试（§9.2）");
    wait_state_none(&bridge, "file:copy").await;
    assert!(!bridge.has_capability("file:copy"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_takeover_register_swaps_generation_and_drains_old() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    bridge
        .activate_provider(host_provider())
        .expect("激活应成功");
    bridge
        .register(registration_of(
            "file:watch",
            "chips.official.host",
            Arc::new(HoldExecutor {
                started: Arc::clone(&started),
                release: Arc::clone(&release),
                order: Arc::clone(&order),
            }),
            30_000,
        ))
        .expect("旧代际注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let old_call = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:watch", "req-old-gen", 1))
                .await
        })
    };
    wait_started(&started, 1).await;
    // 原子切换点：新代际接管注册（定义不同——执行器换为代际标记回声）。
    bridge
        .takeover_register(registration_of(
            "file:watch",
            "chips.official.host",
            Arc::new(GenerationEcho { generation: 2 }),
            30_000,
        ))
        .expect("同 owner 蓝绿接管注册应成功（§9.3 唯一允许的同 ID 覆盖）");
    assert_eq!(
        bridge.capability_state("file:watch"),
        Some(CapabilityState::Active),
        "接管后注册表立即指向新代际"
    );
    // 新调用由新代际处理（§6.3 更新对调用方原子可见）。
    let new_output = bridge
        .request(request_of(1, "file:watch", "req-new-gen"))
        .await
        .expect("接管后的调用应成功");
    assert_eq!(new_output.json["generation"], json!(2), "必须由新代际处理");
    // 旧代际在途调用进入 draining 收尾：不受切换强杀，收到结果（§4.4、§10.1）。
    release.store(true, Ordering::SeqCst);
    let old_output = old_call
        .await
        .expect("旧代际在途任务应收口")
        .expect("旧代际在途调用应正常收尾而非取消");
    assert_eq!(old_output.json["tag"], json!(1), "结果由旧代际执行器产生");
    assert!(
        old_output.json.get("generation").is_none(),
        "旧代际结果不得混入新代际输出"
    );
    // 收口完成后新代际注册项不受旧代际收尾影响（§9.3「切换完成后旧代际
    // 注销不影响新注册」）。
    assert_eq!(
        bridge.capability_state("file:watch"),
        Some(CapabilityState::Active)
    );
    let after = bridge
        .request(request_of(1, "file:watch", "req-still-new"))
        .await
        .expect("旧代际收口后新代际持续生效");
    assert_eq!(after.json["generation"], json!(2));
}

#[test]
fn test_takeover_register_rejects_cross_owner_and_ungranted_id() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(host_provider())
        .expect("平台服务域激活应成功");
    bridge
        .activate_provider(secondary_platform_provider())
        .expect("第二平台服务域激活应成功");
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.service.hello".to_owned(),
            kind: ProviderKind::ServicePlugin,
            permissions: Vec::new(),
        })
        .expect("服务插件激活应成功");
    bridge
        .register(registration_of(
            "file:read",
            "chips.official.host",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect("注册应成功");
    // 蓝绿接管同样受原 owner 绑定约束：跨 owner 接管按 CONFLICT 拒绝。
    let error = bridge
        .takeover_register(registration_of(
            "file:read",
            "chips.official.secondary",
            Arc::new(GenerationEcho { generation: 2 }),
            30_000,
        ))
        .expect_err("接管不得成为跨 owner 抢占的后门");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    let details = error.details().expect("冲突拒绝必须携带详情");
    assert_eq!(
        details["reason"],
        json!("同一 ID 只能由原 owner 重新注册，其他提供方不得抢占")
    );
    // 接管的重注册校验与首次注册一致：未登记第三方 ID 同样拒绝。
    let error = bridge
        .takeover_register(registration_of(
            "hello:greet",
            "chips.service.hello",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect_err("未登记 ID 不得经接管写入");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    let details = error.details().expect("冲突拒绝必须携带详情");
    assert_eq!(details["reason"], json!("未登记 ID"));
    // 接管被拒绝不得破坏在册注册项。
    assert!(bridge.has_capability("file:read"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_takeover_while_draining_installs_active_generation() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    bridge
        .activate_provider(host_provider())
        .expect("激活应成功");
    bridge
        .register(registration_of(
            "file:watch",
            "chips.official.host",
            Arc::new(HoldExecutor {
                started: Arc::clone(&started),
                release: Arc::clone(&release),
                order: Arc::clone(&order),
            }),
            30_000,
        ))
        .expect("旧代际注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let old_call = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:watch", "req-old", 1))
                .await
        })
    };
    wait_started(&started, 1).await;
    bridge
        .begin_draining("file:watch")
        .expect("进入 draining 应成功");
    // draining 中的普通注册不得唤醒过渡态（§10.1：draining 只能经在途收口退出）。
    bridge
        .register(registration_of(
            "file:watch",
            "chips.official.host",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect("同定义幂等注册应成功");
    assert_eq!(
        bridge.capability_state("file:watch"),
        Some(CapabilityState::Draining),
        "同定义重注册不得解除 draining 过渡态"
    );
    // 新代际接管：槽位即时转为 active，旧在途继续收尾。
    bridge
        .takeover_register(registration_of(
            "file:watch",
            "chips.official.host",
            Arc::new(GenerationEcho { generation: 3 }),
            30_000,
        ))
        .expect("draining 中的代际接管应成功");
    assert_eq!(
        bridge.capability_state("file:watch"),
        Some(CapabilityState::Active)
    );
    let output = bridge
        .request(request_of(1, "file:watch", "req-new"))
        .await
        .expect("接管后调用应由新代际处理");
    assert_eq!(output.json["generation"], json!(3));
    release.store(true, Ordering::SeqCst);
    let old_output = old_call
        .await
        .expect("旧在途应收口")
        .expect("旧在途应正常收尾");
    assert_eq!(old_output.json["tag"], json!(1));
    assert_eq!(
        bridge.capability_state("file:watch"),
        Some(CapabilityState::Active),
        "旧代际收口不影响新代际在册"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_draining_keeps_serial_queue_waiters_and_rejects_arrivals() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    bridge
        .activate_provider(host_provider())
        .expect("激活应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:move".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::Serial,
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(HoldExecutor {
                started: Arc::clone(&started),
                release: Arc::clone(&release),
                order: Arc::clone(&order),
            }),
        })
        .expect("串行能力注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let a = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:move", "req-a", 1))
                .await
        })
    };
    wait_started(&started, 1).await;
    let b = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:move", "req-b", 2))
                .await
        })
    };
    wait_admitted(&bridge, 1, "req-b").await;
    // A 执行中、B 排队中：进入 draining。
    bridge
        .begin_draining("file:move")
        .expect("进入 draining 应成功");
    let error = bridge
        .request(hold_request(1, "file:move", "req-c", 3))
        .await
        .expect_err("draining 期间新到达的调用必须拒绝");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_NOT_FOUND);
    // 已在途（含排队）的调用按 FIFO 有序收尾，不取消（§10.1）。
    release.store(true, Ordering::SeqCst);
    let output_a = a.await.expect("A 应收口").expect("A 应正常收尾");
    assert_eq!(output_a.json["tag"], json!(1));
    let output_b = b.await.expect("B 应收口").expect("B 应正常收尾");
    assert_eq!(output_b.json["tag"], json!(2));
    assert_eq!(
        *order.lock().expect("顺序锁应可用"),
        vec![1_i64, 2],
        "串行收尾必须保持 FIFO"
    );
    wait_state_none(&bridge, "file:move").await;
    // 收口后串行状态一并清理，原 owner 重注册可正常使用。
    bridge
        .register(registration_of(
            "file:move",
            "chips.official.host",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect("收口后原 owner 重注册应成功");
    let output = bridge
        .request(request_of(1, "file:move", "req-after"))
        .await
        .expect("重注册后链路恢复");
    assert_eq!(output.json["path"], json!("readme.md"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_begin_draining_without_in_flight_unregisters_immediately() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(host_provider())
        .expect("激活应成功");
    bridge
        .register(registration_of(
            "file:read",
            "chips.official.host",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect("注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    // 无在途调用：draining 即刻完成收口 → 已注销（§10.1 状态机）。
    bridge
        .begin_draining("file:read")
        .expect("进入 draining 应成功");
    assert_eq!(bridge.capability_state("file:read"), None);
    assert!(!bridge.has_capability("file:read"));
    let error = bridge
        .request(request_of(1, "file:read", "req-post"))
        .await
        .expect_err("收口后新调用按未找到拒绝");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_NOT_FOUND);
    // 收口即完成「注销」：重复 draining 与注销均为 no-op（§4.4 幂等）。
    bridge
        .begin_draining("file:read")
        .expect("收口后重复 draining 应为 no-op");
    bridge
        .unregister("file:read")
        .expect("收口后注销应为 no-op");
    // 原 owner 绑定已建立：非原 owner 仍不得抢占。
    bridge
        .activate_provider(secondary_platform_provider())
        .expect("第二平台服务域激活应成功");
    let error = bridge
        .register(registration_of(
            "file:read",
            "chips.official.secondary",
            Arc::new(EchoExecutor),
            30_000,
        ))
        .expect_err("draining 收口后同样受原 owner 绑定约束");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
}
