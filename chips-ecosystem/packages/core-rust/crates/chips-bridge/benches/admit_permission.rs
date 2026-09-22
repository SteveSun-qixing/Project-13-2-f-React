//! 热路径开销实测定量（《RFC-权限审计跨层采集sink裁定》§六条 5/验收④）：
//!
//! `admit` 权限段 observe 注入前/后耗时差——三臂 ×（Noop 注入 / 收集 observer
//! 注入）六臂并测，基线臂为 HEAD 快照树（无观察面 API）。
//! criterion 定时统计（非断言），供台账登记实测差值。

use std::hint::black_box;
use std::sync::{Arc, Mutex};

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};

use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, Concurrency, ProviderKind,
    ProviderRegistration, DEFAULT_MAX_QUEUE, DEFAULT_TIMEOUT_MS,
};
use chips_core::{DecisionObserver, NoopDecisionObserver, PermissionDecision};
use serde_json::json;

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

/// 收集 observer：拷贝素材入表（立即返回），模拟宿主最小接线成本。
#[derive(Clone, Default)]
struct CollectingObserver {
    seen: Arc<Mutex<Vec<PermissionDecision>>>,
}

impl DecisionObserver for CollectingObserver {
    fn on_permission_decision(&self, decision: &PermissionDecision) {
        self.seen.lock().unwrap().push(decision.clone());
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

fn wired_bridge(observer: Arc<dyn DecisionObserver>, granted: bool) -> Bridge {
    let bridge = Bridge::new(observer);
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: vec!["filesystem:read".to_owned()],
        })
        .expect("平台服务域激活");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: echo_schema(),
                permissions: vec!["filesystem:read".to_owned()],
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: DEFAULT_TIMEOUT_MS,
            concurrency: Concurrency::default(),
            max_queue: DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect("能力注册");
    let granted_permissions = if granted {
        vec!["filesystem:read".to_owned()]
    } else {
        Vec::new()
    };
    bridge
        .open_session(7, "chips.official.editor".to_owned(), granted_permissions)
        .expect("会话登记");
    bridge
}

fn request() -> BridgeRequest {
    BridgeRequest {
        request_id: "req-bench".to_owned(),
        capability_id: "file:read".to_owned(),
        session: 7,
        input: CapabilityInput::json_only(json!({ "path": "readme.md" })),
    }
}

fn bench_admit_permission(c: &mut Criterion) {
    let mut group = c.benchmark_group("admit_permission");
    for scenario in ["allow", "deny"] {
        let granted = scenario == "allow";
        // Noop 注入臂。
        {
            let bridge = wired_bridge(Arc::new(NoopDecisionObserver), granted);
            group.bench_function(BenchmarkId::new(scenario, "noop"), |b| {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("bench 运行时");
                b.iter(|| {
                    let outcome = rt
                        .block_on(bridge.request(request()))
                        .map(|output| output.json)
                        .map_err(|error| error.code().to_owned());
                    black_box(outcome)
                });
            });
        }
        // 收集 observer 臂（发射 + 一次克隆入表；臂内排空防无界增长）。
        {
            let collecting = CollectingObserver::default();
            let bridge = wired_bridge(Arc::new(collecting.clone()), granted);
            group.bench_function(BenchmarkId::new(scenario, "collecting"), |b| {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("bench 运行时");
                b.iter(|| {
                    let outcome = rt
                        .block_on(bridge.request(request()))
                        .map(|output| output.json)
                        .map_err(|error| error.code().to_owned());
                    // 排空仅作收集器回收，不参与判定路径。
                    let seen = std::mem::take(&mut *collecting.seen.lock().unwrap());
                    black_box((outcome, seen.len()))
                });
            });
        }
    }
    group.finish();
}

criterion_group!(benches, bench_admit_permission);
criterion_main!(benches);
