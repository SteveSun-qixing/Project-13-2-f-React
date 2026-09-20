//! 注册路径「锁外编译」竞态窗口的并发回归（《核心接口规范》§5.1 注册校验、
//! 《能力契约规范》§4.4/§9.3）：
//! - `register` 在校验通过后释放内核锁做 schema 离线编译，随后重新加锁
//!   复查（关闭态复查 + ID 占用复查）。并发对手可能恰在编译窗口内完成
//!   安装或关闭内核，因此单个注册请求的合法结果是一个确定集合：
//!   - 普通注册并发同定义：`Ok`（幂等采纳或首装成功）或
//!     `BRIDGE_CAPABILITY_CONFLICT`（首装者视角），竞态败者按
//!     「注册竞态下 ID 已被占用」拒绝；
//!   - 跨 owner 的接管竞态：`Ok` 或 `BRIDGE_CAPABILITY_CONFLICT`
//!     （登记绑定、定义不一致或竞态占用，均为 §9.3 冲突全集）；
//!   - 与 `shutdown` 竞态：`Ok` 或 `BRIDGE_CANCELLED`（关闭态拒绝，《Bridge
//!     三层设计》§8.2）。
//! - 无论交错如何，必须收敛到确定的最终态：ID 在册、状态 `Active`、
//!   原 owner 绑定唯一成立（非安装方事后再注册必被拒）。
//!
//! 断言只取公开行为面与错误码/原因集合，不依赖调度顺序、不设时序假设。

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use chips_bridge::{
    Bridge, CapabilityContext, CapabilityDescriptor, CapabilityExecutor, CapabilityInput,
    CapabilityOutput, CapabilityRegistration, CapabilityState, Concurrency, ProviderKind,
    ProviderRegistration, BRIDGE_CANCELLED, BRIDGE_CAPABILITY_CONFLICT, DEFAULT_MAX_QUEUE,
};
use chips_core::ChipsError;
use serde_json::json;

/// 文档口径的注册冲突原因全集（《能力契约规范》§4.4、§9.3 与
/// 《核心接口规范》§5.1 注册校验条款一一对应）。
const ALLOWED_CONFLICT_REASONS: &[&str] = &[
    "重复注册定义不一致",
    "注册竞态下 ID 已被占用",
    "同一 ID 只能由原 owner 重新注册，其他提供方不得抢占",
];

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

/// 带轮次标记的大 schema：600 个属性让锁外编译达到毫秒级，放大竞态窗口，
/// 且每轮内容摘要不同保证编译缓存（每轮新 Bridge 本就空缓存）不被跳过。
fn heavy_schema(marker: usize) -> serde_json::Value {
    let mut properties = serde_json::Map::new();
    let mut required = Vec::new();
    for index in 0..600 {
        let name = format!("k{index}");
        required.push(json!(name.clone()));
        properties.insert(name, json!({ "type": "string", "minLength": 1 }));
    }
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": required,
        "properties": properties,
        "description": format!("race-round-{marker}"),
    })
}

fn descriptor(capability_id: &str, round: usize) -> CapabilityDescriptor {
    CapabilityDescriptor {
        id: capability_id.to_owned(),
        schema: heavy_schema(round),
        permissions: Vec::new(),
    }
}

fn registration(
    owner: &str,
    capability_id: &str,
    round: usize,
    executor: Arc<dyn CapabilityExecutor>,
) -> CapabilityRegistration {
    CapabilityRegistration {
        descriptor: descriptor(capability_id, round),
        owner: owner.to_owned(),
        timeout_ms: 30_000,
        concurrency: Concurrency::Parallel,
        max_queue: DEFAULT_MAX_QUEUE,
        executor,
    }
}

fn activate(bridge: &Bridge, id: &str, kind: ProviderKind) {
    bridge
        .activate_provider(ProviderRegistration {
            id: id.to_owned(),
            kind,
            permissions: Vec::new(),
        })
        .expect("提供方激活应成功");
}

fn assert_conflict_reason(error: &ChipsError) {
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    assert!(!error.retryable());
    let reason = error
        .details()
        .and_then(|value| value.get("reason"))
        .and_then(serde_json::Value::as_str)
        .expect("注册冲突必须携带原因");
    assert!(
        ALLOWED_CONFLICT_REASONS.contains(&reason),
        "冲突原因超出文档口径全集：{reason}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_concurrent_same_definition_registration_settles_deterministically() {
    let round_counter = AtomicUsize::new(0);
    for _round in 0..30 {
        let round = round_counter.fetch_add(1, Ordering::SeqCst);
        let bridge = Bridge::new();
        activate(
            &bridge,
            "chips.official.host",
            ProviderKind::PlatformService,
        );
        // 两个句柄同时发起同定义注册：胜者首装，败者按竞态占用拒绝或经
        // 幂等路径采纳执行器句柄；交错结果只允许落在确定集合内。
        let mut handles = Vec::new();
        for _slot in 0..2 {
            let bridge = bridge.clone();
            handles.push(tokio::spawn(async move {
                bridge.register(registration(
                    "chips.official.host",
                    "file:list",
                    round,
                    Arc::new(EchoExecutor),
                ))
            }));
        }
        let mut successes = 0usize;
        let mut conflicts = 0usize;
        for handle in handles {
            match handle.await.expect("注册任务应收口") {
                Ok(()) => successes += 1,
                Err(error) => {
                    assert_conflict_reason(&error);
                    conflicts += 1;
                }
            }
        }
        assert!(successes >= 1, "至少一个注册必须成功");
        assert_eq!(successes + conflicts, 2);
        assert!(bridge.has_capability("file:list"));
        assert_eq!(
            bridge.capability_state("file:list"),
            Some(CapabilityState::Active),
            "竞态收敛后注册项必须处于生效态"
        );
        // 最终态验证：原 owner 绑定唯一成立，其他提供方不得抢占。
        activate(
            &bridge,
            "chips.official.other",
            ProviderKind::PlatformService,
        );
        let error = bridge
            .register(registration(
                "chips.official.other",
                "file:list",
                round,
                Arc::new(EchoExecutor),
            ))
            .expect_err("非原 owner 不得抢占");
        assert_conflict_reason(&error);
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_takeover_cross_owner_race_stays_within_conflict_matrix() {
    // 两个平台服务域提供方的首次注册竞态：接管不是抢占后门——跨 owner 的
    // 竞态败者按 §9.3 冲突全集（绑定/竞态占用/定义不一致）拒绝。
    let round_counter = AtomicUsize::new(0);
    for _round in 0..30 {
        let round = round_counter.fetch_add(1, Ordering::SeqCst);
        let bridge = Bridge::new();
        activate(
            &bridge,
            "chips.official.host",
            ProviderKind::PlatformService,
        );
        activate(
            &bridge,
            "chips.official.secondary",
            ProviderKind::PlatformService,
        );
        activate(
            &bridge,
            "chips.official.third",
            ProviderKind::PlatformService,
        );
        let plain = {
            let bridge = bridge.clone();
            tokio::spawn(async move {
                bridge.register(registration(
                    "chips.official.host",
                    "file:copy",
                    round,
                    Arc::new(EchoExecutor),
                ))
            })
        };
        let takeover = {
            let bridge = bridge.clone();
            tokio::spawn(async move {
                bridge.takeover_register(registration(
                    "chips.official.secondary",
                    "file:copy",
                    round,
                    Arc::new(EchoExecutor),
                ))
            })
        };
        let plain_result = plain.await.expect("注册任务应收口");
        let takeover_result = takeover.await.expect("接管任务应收口");
        for result in [plain_result, takeover_result] {
            match result {
                Ok(()) => {}
                Err(error) => assert_conflict_reason(&error),
            }
        }
        assert!(
            bridge.has_capability("file:copy"),
            "至少首装者成功，ID 必在册"
        );
        // 收敛后必有唯一 owner：事后再注册只可能由该 owner 成功。
        let third = bridge.register(registration(
            "chips.official.third",
            "file:copy",
            round,
            Arc::new(EchoExecutor),
        ));
        assert!(third.is_err(), "未激活且非登记 owner 必须被拒");
        assert_conflict_reason(third.as_ref().expect_err("应为冲突拒绝"));
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_shutdown_during_registration_window_rejects_with_cancelled() {
    // 注册在锁外编译期间内核被关闭：重新加锁的关闭态复查按取消拒绝，
    // 不得留下注册项；竞态之外的交错（先装成功或入口即拒）同为合法收口。
    let round_counter = AtomicUsize::new(0);
    for _round in 0..30 {
        let round = round_counter.fetch_add(1, Ordering::SeqCst);
        let bridge = Bridge::new();
        activate(
            &bridge,
            "chips.official.host",
            ProviderKind::PlatformService,
        );
        let registering = {
            let bridge = bridge.clone();
            tokio::spawn(async move {
                bridge.register(registration(
                    "chips.official.host",
                    "file:mkdir",
                    round,
                    Arc::new(EchoExecutor),
                ))
            })
        };
        // 微错位让关闭动作有机会落入编译窗口。
        tokio::time::sleep(Duration::from_micros(((round % 3) as u64) * 400)).await;
        bridge.shutdown();
        let result = registering.await.expect("注册任务应收口");
        match result {
            Ok(()) => assert!(
                bridge.has_capability("file:mkdir"),
                "先装成功则注册项在册（关闭不回滚已完成的注册）"
            ),
            Err(error) => {
                assert_eq!(error.code(), BRIDGE_CANCELLED, "竞态败者按取消收口");
                assert!(!error.retryable());
                assert!(!bridge.has_capability("file:mkdir"), "被拒注册不得在册");
            }
        }
    }
}
