//! 调用生命周期集成测试：主链路执行、panic 归一、并发准入（在途上限、串行
//! 队列）、超时与四路取消（会话销毁见 `bridge_session.rs`，此处覆盖能力注销、
//! `signal`、Bridge 关闭与提供方停用），以及 `retryable` 口径矩阵。
//!
//! 断言口径以《核心接口规范》§5.2 阶段表与《Bridge三层设计》§8（超时、取消
//! 与并发）、§9.2（错误码表）为准。

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, Concurrency, ProviderKind,
    ProviderRegistration, BRIDGE_CANCELLED, BRIDGE_CAPABILITY_CONFLICT,
    BRIDGE_CAPABILITY_NOT_FOUND, BRIDGE_INTERNAL, BRIDGE_INVALID_INPUT, BRIDGE_INVALID_SCHEMA,
    BRIDGE_PERMISSION_DENIED, BRIDGE_QUEUE_OVERFLOW, BRIDGE_SESSION_BUSY, BRIDGE_SESSION_UNKNOWN,
    BRIDGE_TIMEOUT, DEFAULT_MAX_QUEUE, KERNEL_INVALID_TRANSITION, PERMISSION_NOT_DECLARED,
    PERMISSION_UNKNOWN, SESSION_IN_FLIGHT_LIMIT,
};
use chips_core::ChipsError;
use serde_json::json;

/// 回声执行器：原样返回输入信封（含二进制表）。
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

/// 挂起执行器：记录启动顺序与在途数，轮询释放标志；6 秒兜底防悬挂。
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
        let tag = input.json.get("tag").and_then(serde_json::Value::as_i64);
        if let Some(tag) = tag {
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

/// 无视取消的长眠执行器：用于超时收口验证。
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

/// panic 执行器：验证 `JoinError` 归一为 `BRIDGE_INTERNAL`。
struct PanicExecutor;

#[async_trait::async_trait]
impl CapabilityExecutor for PanicExecutor {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        _input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        panic!("测试装置 panic：应由 Bridge 捕获并归一")
    }
}

/// 业务错误执行器：返回固定 `ChipsError`，验证原样透传。
struct FailExecutor {
    error: ChipsError,
}

#[async_trait::async_trait]
impl CapabilityExecutor for FailExecutor {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        _input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        Err(self.error.clone())
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

/// 激活平台服务域并注册一个回声内置能力。
fn register_host_echo(
    bridge: &Bridge,
    id: &str,
    timeout_ms: u64,
    concurrency: Concurrency,
    max_queue: usize,
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
                id: id.to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms,
            concurrency,
            max_queue,
            executor: Arc::new(EchoExecutor),
        })
        .expect("能力注册应成功");
}

/// 激活平台服务域并注册一个由挂起执行器承载的内置能力。
fn register_host_hold(
    bridge: &Bridge,
    id: &str,
    concurrency: Concurrency,
    max_queue: usize,
    started: &Arc<AtomicUsize>,
    release: &Arc<AtomicBool>,
    order: &Arc<Mutex<Vec<i64>>>,
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
                id: id.to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency,
            max_queue,
            executor: Arc::new(HoldExecutor {
                started: Arc::clone(started),
                release: Arc::clone(release),
                order: Arc::clone(order),
            }),
        })
        .expect("挂起能力注册应成功");
}

fn request_with_json(
    session: u64,
    capability_id: &str,
    request_id: &str,
    json_body: serde_json::Value,
) -> BridgeRequest {
    BridgeRequest {
        request_id: request_id.to_owned(),
        capability_id: capability_id.to_owned(),
        session,
        input: CapabilityInput::json_only(json_body),
    }
}

fn hold_request(session: u64, capability_id: &str, request_id: &str, tag: i64) -> BridgeRequest {
    request_with_json(
        session,
        capability_id,
        request_id,
        json!({ "path": "x", "tag": tag }),
    )
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_request_success_and_binary_envelope_roundtrip() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("激活应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: json!({
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["path", "payload"],
                    "properties": { "path": { "type": "string" }, "payload": { "x-chips-binary": 4 } }
                }),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect("二进制能力注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    // 合法信封：json 键引用 + bin 表字节。
    let mut bin = BTreeMap::new();
    bin.insert("blob".to_owned(), vec![1_u8, 2, 3]);
    let output = bridge
        .request(BridgeRequest {
            request_id: "req-bin-ok".to_owned(),
            capability_id: "file:read".to_owned(),
            session: 1,
            input: CapabilityInput {
                json: json!({ "path": "card.png", "payload": "blob" }),
                bin,
            },
        })
        .await
        .expect("合法二进制信封应成功");
    assert_eq!(output.json["path"], json!("card.png"));
    assert_eq!(
        output.bin.get("blob").map(Vec::as_slice),
        Some(&[1_u8, 2, 3][..])
    );
    // bin 表缺少被引用的键：BRIDGE_INVALID_INPUT。
    let error = bridge
        .request(BridgeRequest {
            request_id: "req-bin-missing".to_owned(),
            capability_id: "file:read".to_owned(),
            session: 1,
            input: CapabilityInput::json_only(json!({ "path": "card.png", "payload": "blob" })),
        })
        .await
        .expect_err("缺 bin 键必须拒绝");
    assert_eq!(error.code(), BRIDGE_INVALID_INPUT);
    assert!(!error.retryable(), "BRIDGE_INVALID_INPUT 不可重试");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_request_invalid_input_aggregates_details() {
    let bridge = Bridge::new();
    register_host_echo(
        &bridge,
        "file:read",
        30_000,
        Concurrency::default(),
        DEFAULT_MAX_QUEUE,
    );
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let error = bridge
        .request(request_with_json(
            1,
            "file:read",
            "req-bad",
            json!({ "path": "" }),
        ))
        .await
        .expect_err("空 path 违反 minLength 应拒绝");
    assert_eq!(error.code(), BRIDGE_INVALID_INPUT);
    assert!(!error.retryable());
    let details = error
        .details()
        .expect("校验失败必须携带聚合详情（《能力契约规范》§5.4）");
    assert_eq!(details["capabilityId"], json!("file:read"));
    assert_eq!(details["truncated"], json!(false));
    let issues = details["errors"].as_array().expect("errors 应为数组");
    assert!(!issues.is_empty(), "至少聚合一条校验问题");
    assert_eq!(issues[0]["keyword"], json!("minLength"));
    assert_eq!(issues[0]["pointer"], json!("/path"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_executor_business_error_passes_through_unchanged() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("激活应成功");
    let business_error = ChipsError::new("FILE_NOT_FOUND", "目标不存在")
        .with_details(json!({ "path": "missing.md" }))
        .with_retryable(false);
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(FailExecutor {
                error: business_error.clone(),
            }),
        })
        .expect("注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let error = bridge
        .request(request_with_json(
            1,
            "file:read",
            "req-fail",
            json!({ "path": "missing.md" }),
        ))
        .await
        .expect_err("执行器业务错误应透传");
    assert_eq!(error.code(), "FILE_NOT_FOUND", "Host 业务错误码原样透传");
    assert_eq!(error.message(), "目标不存在");
    assert!(!error.retryable());
    assert_eq!(
        error.details().expect("详情应透传")["path"],
        json!("missing.md")
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_executor_panic_normalized_to_internal() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("激活应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(PanicExecutor),
        })
        .expect("注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let error = bridge
        .request(request_with_json(
            1,
            "file:read",
            "req-panic",
            json!({ "path": "a" }),
        ))
        .await
        .expect_err("执行器 panic 必须归一");
    assert_eq!(
        error.code(),
        BRIDGE_INTERNAL,
        "panic 归一为 BRIDGE_INTERNAL"
    );
    assert!(!error.retryable(), "BRIDGE_INTERNAL 不可重试");
    let details = error.details().expect("归一错误必须携带阶段详情");
    assert_eq!(details["phase"], json!("execute"));
    // panic 后内核仍可用：注册第二个能力并成功调用。
    register_host_echo(
        &bridge,
        "file:list",
        30_000,
        Concurrency::default(),
        DEFAULT_MAX_QUEUE,
    );
    let output = bridge
        .request(request_with_json(
            1,
            "file:list",
            "req-after-panic",
            json!({ "path": "a" }),
        ))
        .await
        .expect("panic 不应污染内核状态");
    assert_eq!(output.json["path"], json!("a"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_timeout_returns_retryable_timeout_error() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("激活应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 40,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(SleepExecutor { millis: 3_000 }),
        })
        .expect("注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let started = Instant::now();
    let error = bridge
        .request(request_with_json(
            1,
            "file:read",
            "req-timeout",
            json!({ "path": "a" }),
        ))
        .await
        .expect_err("执行超过 timeout_ms 必须超时");
    assert_eq!(error.code(), BRIDGE_TIMEOUT);
    assert!(
        error.retryable(),
        "BRIDGE_TIMEOUT 可重试（《Bridge三层设计》§9.2）"
    );
    let elapsed = started.elapsed();
    assert!(
        elapsed >= Duration::from_millis(30) && elapsed < Duration::from_secs(2),
        "超时应按注册项 timeout_ms 收口：{elapsed:?}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_session_busy_when_in_flight_limit_exceeded() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    register_host_hold(
        &bridge,
        "file:read",
        Concurrency::Parallel,
        DEFAULT_MAX_QUEUE,
        &started,
        &release,
        &order,
    );
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let mut handles = Vec::new();
    for index in 0..SESSION_IN_FLIGHT_LIMIT {
        let bridge = bridge.clone();
        handles.push(tokio::spawn(async move {
            bridge
                .request(hold_request(
                    1,
                    "file:read",
                    &format!("req-{index}"),
                    index as i64,
                ))
                .await
        }));
    }
    wait_started(&started, SESSION_IN_FLIGHT_LIMIT).await;
    // 同会话第 65 个在途调用：SESSION_BUSY（《Bridge三层设计》§8.3）。
    let error = bridge
        .request(hold_request(1, "file:read", "req-overflow", 999))
        .await
        .expect_err("超过在途上限必须拒绝");
    assert_eq!(error.code(), BRIDGE_SESSION_BUSY);
    assert!(error.retryable(), "BRIDGE_SESSION_BUSY 可重试");
    // 其它会话不受该会话在途配额影响。
    bridge
        .open_session(2, "chips.official.viewer".to_owned(), Vec::new())
        .expect("旁证会话登记应成功");
    let other = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(2, "file:read", "req-other-session", 1_000))
                .await
        })
    };
    wait_started(&started, SESSION_IN_FLIGHT_LIMIT + 1).await;
    release.store(true, Ordering::SeqCst);
    for handle in handles {
        let output = handle
            .await
            .expect("任务应收口")
            .expect("在途调用应成功返回");
        assert_eq!(output.json["path"], json!("x"));
    }
    let output = other
        .await
        .expect("旁证任务应收口")
        .expect("旁证调用应成功");
    assert_eq!(output.json["tag"], json!(1_000));
    // 在途全部释放后可继续发起调用（计数复位）。
    let output = bridge
        .request(hold_request(1, "file:read", "req-final", 2_000))
        .await
        .expect("释放后应重新放行");
    assert_eq!(output.json["tag"], json!(2_000));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_serial_queue_overflow_and_fifo_handoff() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.service.hello".to_owned(),
            kind: ProviderKind::ServicePlugin,
            permissions: Vec::new(),
        })
        .expect("服务插件激活应成功");
    bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect("登记应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "hello:greet".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.service.hello".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::Serial,
            max_queue: 1,
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
    // A 占用串行槽位。
    let a = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "hello:greet", "req-a", 1))
                .await
        })
    };
    wait_started(&started, 1).await;
    // B 进入 FIFO 队列（max_queue=1 允许 1 个等待者）。
    let b = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "hello:greet", "req-b", 2))
                .await
        })
    };
    tokio::time::sleep(Duration::from_millis(40)).await;
    // C 溢出：队列已有 1 个等待者。
    let error = bridge
        .request(hold_request(1, "hello:greet", "req-c", 3))
        .await
        .expect_err("串行队列满必须拒绝");
    assert_eq!(error.code(), BRIDGE_QUEUE_OVERFLOW);
    assert!(error.retryable(), "BRIDGE_QUEUE_OVERFLOW 可重试");
    // 释放 A：槽位按 FIFO 移交 B，B 随即完成。
    release.store(true, Ordering::SeqCst);
    let output_a = a.await.expect("A 应收口").expect("A 应成功");
    assert_eq!(output_a.json["tag"], json!(1));
    let output_b = b.await.expect("B 应收口").expect("B 应成功");
    assert_eq!(output_b.json["tag"], json!(2));
    assert_eq!(
        *order.lock().expect("顺序锁应可用"),
        vec![1_i64, 2],
        "串行执行必须按 FIFO 顺序启动"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_unregister_cancels_running_and_queued_calls() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    register_host_hold(
        &bridge,
        "file:read",
        Concurrency::Serial,
        DEFAULT_MAX_QUEUE,
        &started,
        &release,
        &order,
    );
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let a = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:read", "req-a", 1))
                .await
        })
    };
    wait_started(&started, 1).await;
    let b = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:read", "req-b", 2))
                .await
        })
    };
    tokio::time::sleep(Duration::from_millis(40)).await;
    // 注销：在途调用按取消收口（《核心接口规范》§5.1、《Bridge三层设计》§8.2）。
    bridge
        .unregister("file:read")
        .expect("存在在途调用时注销应成功");
    let error_a = a.await.expect("A 应收口").expect_err("在途执行应被取消");
    assert_eq!(error_a.code(), BRIDGE_CANCELLED);
    assert!(!error_a.retryable());
    let error_b = b.await.expect("B 应收口").expect_err("排队调用应被取消");
    assert_eq!(
        error_b.code(),
        BRIDGE_CANCELLED,
        "等待串行槽位的调用同样按取消收口"
    );
    let error = bridge
        .request(hold_request(1, "file:read", "req-c", 3))
        .await
        .expect_err("注销后不得接受新调用");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_NOT_FOUND);
    assert!(!bridge.has_capability("file:read"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_deactivate_provider_cancels_in_flight_and_allows_re_register() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.service.hello".to_owned(),
            kind: ProviderKind::ServicePlugin,
            permissions: Vec::new(),
        })
        .expect("服务插件激活应成功");
    bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect("登记应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "hello:greet".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.service.hello".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(HoldExecutor {
                started: Arc::clone(&started),
                release: Arc::clone(&release),
                order: Arc::clone(&order),
            }),
        })
        .expect("注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let a = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "hello:greet", "req-a", 1))
                .await
        })
    };
    wait_started(&started, 1).await;
    // 停用提供方：注销其全部能力并在途调用按取消收口。
    bridge.deactivate_provider("chips.service.hello");
    let error = a
        .await
        .expect("任务应收口")
        .expect_err("停用后在途调用应被取消");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    assert!(!error.retryable());
    assert!(
        !bridge.has_capability("hello:greet"),
        "停用应摘除其能力注册项"
    );
    // 登记绑定仍在：重新激活并由原 owner 重注册。
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.service.hello".to_owned(),
            kind: ProviderKind::ServicePlugin,
            permissions: Vec::new(),
        })
        .expect("重新激活应成功");
    register_host_echo(
        &bridge,
        "file:read",
        30_000,
        Concurrency::default(),
        DEFAULT_MAX_QUEUE,
    );
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "hello:greet".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.service.hello".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect("原 owner 重注册应成功");
    release.store(true, Ordering::SeqCst);
    let output = bridge
        .request(hold_request(1, "hello:greet", "req-new", 2))
        .await
        .expect("重注册后调用链路应恢复");
    assert_eq!(output.json["tag"], json!(2));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_cancel_via_invocation_context_signal() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    register_host_hold(
        &bridge,
        "file:read",
        Concurrency::Parallel,
        DEFAULT_MAX_QUEUE,
        &started,
        &release,
        &order,
    );
    bridge
        .open_session(9, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    assert!(
        bridge.invocation_context(9, "req-signal").is_none(),
        "未发起调用时应无在途上下文"
    );
    let a = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(9, "file:read", "req-signal", 1))
                .await
        })
    };
    wait_started(&started, 1).await;
    let context = bridge
        .invocation_context(9, "req-signal")
        .expect("在途调用应可读取完整上下文");
    assert_eq!(context.request_id, "req-signal");
    assert_eq!(context.capability_id, "file:read");
    assert_eq!(context.owner, "chips.official.host");
    assert_eq!(context.session, 9);
    assert_eq!(context.plugin_id, "chips.official.editor");
    assert_eq!(context.trace_id.len(), 24, "追踪 ID 为 16+8 位十六进制");
    assert!(
        context.deadline > Instant::now(),
        "默认 30 秒超时下截止时刻应在未来"
    );
    assert!(bridge.invocation_context(9, "req-other-id").is_none());
    // 适配层经上下文令牌触发取消（《Bridge三层设计》§8.2 取消传播）。
    context.cancel.cancel();
    let error = a
        .await
        .expect("任务应收口")
        .expect_err("signal 取消应返回取消错误");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    assert!(!error.retryable());
    // 收口后上下文不再可见。
    for _ in 0..250 {
        if bridge.invocation_context(9, "req-signal").is_none() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(4)).await;
    }
    assert!(
        bridge.invocation_context(9, "req-signal").is_none(),
        "取消收口后在途登记应被清理"
    );
    release.store(true, Ordering::SeqCst);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_shutdown_cancels_in_flight_and_rejects_all_entries() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    register_host_hold(
        &bridge,
        "file:read",
        Concurrency::Parallel,
        DEFAULT_MAX_QUEUE,
        &started,
        &release,
        &order,
    );
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let a = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:read", "req-a", 1))
                .await
        })
    };
    wait_started(&started, 1).await;
    assert!(!bridge.is_shutdown());
    // 平台退出：取消全部在途调用并拒绝新请求（《Bridge三层设计》§8.2）。
    bridge.shutdown();
    let error = a
        .await
        .expect("任务应收口")
        .expect_err("关闭后在途调用应被取消");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    assert!(!error.retryable());
    assert!(bridge.is_shutdown());
    assert!(bridge.clone().is_shutdown(), "克隆句柄共享关闭状态");
    // 幂等：重复关闭不 panic。
    bridge.shutdown();
    assert!(bridge.is_shutdown());
    // 各公开入口一律按取消拒绝。
    let error = bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect_err("关闭后激活必须拒绝");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    let error = bridge
        .grant_capability_id("hello:greet", "chips.official.host")
        .expect_err("关闭后登记必须拒绝");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    let error = bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:list".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect_err("关闭后注册必须拒绝");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    let error = bridge
        .open_session(2, "chips.official.viewer".to_owned(), Vec::new())
        .expect_err("关闭后会话登记必须拒绝");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    let error = bridge
        .request(hold_request(1, "file:read", "req-post-shutdown", 2))
        .await
        .expect_err("关闭后调用必须拒绝");
    assert_eq!(error.code(), BRIDGE_CANCELLED);
    // 关闭态下的无害幂等操作。
    bridge.close_session(1);
    bridge.cancel_session(1);
    bridge.deactivate_provider("chips.official.host");
    assert!(
        !bridge.has_capability("file:list"),
        "关闭后的注册拒绝不得留下注册项"
    );
    release.store(true, Ordering::SeqCst);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_registration_error_retryable_matrix() {
    let bridge = Bridge::new();
    // CONFLICT：文法非法。
    let error = bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "bad:id:x:y".to_owned(),
                schema: echo_schema(),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect_err("文法非法必须拒绝");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    assert!(!error.retryable());
    // KERNEL_INVALID_TRANSITION：owner 未激活。
    let error = bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect_err("未激活提供方不得登记");
    assert_eq!(error.code(), KERNEL_INVALID_TRANSITION);
    // 激活后登记，用于 INVALID_SCHEMA / PERMISSION_* 分支。
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.service.hello".to_owned(),
            kind: ProviderKind::ServicePlugin,
            permissions: vec!["config:read".to_owned()],
        })
        .expect("激活应成功");
    bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect("登记应成功");
    // INVALID_SCHEMA：白名单外关键字。
    let error = bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "hello:greet".to_owned(),
                schema: json!({ "type": "object", "additionalProperties": false, "if": {} }),
                permissions: Vec::new(),
            },
            owner: "chips.service.hello".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect_err("非法关键字必须拒绝编译");
    assert_eq!(error.code(), BRIDGE_INVALID_SCHEMA);
    assert!(!error.retryable());
    // PERMISSION_UNKNOWN：词表外权限。
    let error = bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "hello:greet".to_owned(),
                schema: echo_schema(),
                permissions: vec!["filesystem:wipe".to_owned()],
            },
            owner: "chips.service.hello".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect_err("词表外权限必须拒绝");
    assert_eq!(error.code(), PERMISSION_UNKNOWN);
    assert!(!error.retryable());
    // PERMISSION_NOT_DECLARED：词表内但 manifest 未声明。
    let error = bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "hello:greet".to_owned(),
                schema: echo_schema(),
                permissions: vec!["config:write".to_owned()],
            },
            owner: "chips.service.hello".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect_err("未声明权限必须拒绝");
    assert_eq!(error.code(), PERMISSION_NOT_DECLARED);
    assert!(!error.retryable());
    // PERMISSION_UNKNOWN：激活期同样拒绝。
    let error = bridge
        .activate_provider(ProviderRegistration {
            id: "chips.service.other".to_owned(),
            kind: ProviderKind::ServicePlugin,
            permissions: vec!["not:a:permission".to_owned()],
        })
        .expect_err("激活期词表外权限必须拒绝");
    assert_eq!(error.code(), PERMISSION_UNKNOWN);
    assert!(!error.retryable());
    assert!(
        !bridge.has_capability("hello:greet"),
        "全部拒绝分支不得写入注册表"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_call_error_retryable_matrix() {
    let bridge = Bridge::new();
    let started = Arc::new(AtomicUsize::new(0));
    let release = Arc::new(AtomicBool::new(false));
    let order = Arc::new(Mutex::new(Vec::new()));
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: vec!["filesystem:read".to_owned()],
        })
        .expect("激活应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: echo_schema(),
                permissions: vec!["filesystem:read".to_owned()],
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 40,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(SleepExecutor { millis: 3_000 }),
        })
        .expect("注册应成功");
    bridge
        .open_session(
            1,
            "chips.official.editor".to_owned(),
            vec!["filesystem:read".to_owned()],
        )
        .expect("会话登记应成功");
    // SESSION_UNKNOWN。
    let error = bridge
        .request(hold_request(404, "file:read", "req-no-session", 1))
        .await
        .expect_err("未知会话必须拒绝");
    assert_eq!(error.code(), BRIDGE_SESSION_UNKNOWN);
    assert!(!error.retryable());
    // CAPABILITY_NOT_FOUND。
    let error = bridge
        .request(hold_request(1, "file:write", "req-no-cap", 1))
        .await
        .expect_err("未注册能力必须拒绝");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_NOT_FOUND);
    assert!(!error.retryable());
    // PERMISSION_DENIED（快照未覆盖）。
    bridge
        .open_session(2, "chips.official.viewer".to_owned(), Vec::new())
        .expect("未授权会话登记应成功");
    let error = bridge
        .request(hold_request(2, "file:read", "req-denied", 1))
        .await
        .expect_err("未授权快照必须拒绝");
    assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
    assert!(!error.retryable());
    // INVALID_INPUT（schema 不过）。
    let error = bridge
        .request(request_with_json(
            1,
            "file:read",
            "req-bad-input",
            json!({}),
        ))
        .await
        .expect_err("缺少必填字段必须拒绝");
    assert_eq!(error.code(), BRIDGE_INVALID_INPUT);
    assert!(!error.retryable());
    // TIMEOUT。
    let error = bridge
        .request(hold_request(1, "file:read", "req-timeout", 1))
        .await
        .expect_err("超过 timeout_ms 必须超时");
    assert_eq!(error.code(), BRIDGE_TIMEOUT);
    assert!(error.retryable());
    // INTERNAL（panic 归一）。
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
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(PanicExecutor),
        })
        .expect("panic 能力注册应成功");
    let error = bridge
        .request(hold_request(1, "file:list", "req-panic", 1))
        .await
        .expect_err("panic 必须归一");
    assert_eq!(error.code(), BRIDGE_INTERNAL);
    assert!(!error.retryable());
    // QUEUE_OVERFLOW：max_queue=0 的串行能力，A 占位后 B 立即溢出。
    register_host_hold(
        &bridge,
        "file:move",
        Concurrency::Serial,
        0,
        &started,
        &release,
        &order,
    );
    let a = {
        let bridge = bridge.clone();
        tokio::spawn(async move {
            bridge
                .request(hold_request(1, "file:move", "req-a", 1))
                .await
        })
    };
    wait_started(&started, 1).await;
    let error = bridge
        .request(hold_request(1, "file:move", "req-b", 2))
        .await
        .expect_err("无等待位时第二个调用必须溢出");
    assert_eq!(error.code(), BRIDGE_QUEUE_OVERFLOW);
    assert!(error.retryable());
    release.store(true, Ordering::SeqCst);
    a.await.expect("A 应收口").expect("A 应成功");
    // CANCELLED（能力注销路径）。
    bridge
        .unregister("file:list")
        .expect("注销 panic 能力不应影响其余注册项");
    assert!(
        bridge.has_capability("file:read"),
        "注销单个能力不得波及其它注册项"
    );
}
