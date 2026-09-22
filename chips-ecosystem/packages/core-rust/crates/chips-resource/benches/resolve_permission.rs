//! 热路径开销实测定量（《RFC-权限审计跨层采集sink裁定》§六条 5/验收④）：
//!
//! `resolve` 判定收敛 observe 注入前/后耗时差——三臂（JudgedAllow /
//! JudgedDeny / 直通）×（Noop 注入 / 收集 observer 注入）六臂并测，
//! 基线臂为 HEAD 快照树（无观察面 API）。criterion 定时统计（非断言）。

use std::hint::black_box;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};

use chips_core::{DecisionObserver, NoopDecisionObserver, PermissionDecision};
use chips_resource::{
    Origin, ResourceLimits, ResourceManager, ResourceOperation, ScopeKind, ScopePolicy,
    ScopeRegistration, SessionKind,
};

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

fn directory_scope(scope: &str, kind: ScopeKind, owner: &str) -> ScopeRegistration {
    ScopeRegistration {
        scope: scope.to_owned(),
        kind,
        owner: owner.to_owned(),
        provider_id: "directory".to_owned(),
        origin: Origin::Directory(PathBuf::from("/tmp/chips-audit-bench")),
        policy: ScopePolicy {
            read_only: false,
            max_resource_bytes: 1 << 30,
            allowed_hosts: Vec::new(),
        },
    }
}

/// 装配：`card-1` Document 作用域 + 直通绑定会话 + 限定授权会话 +
/// 无权限拒绝会话（测量循环内零装配）。
fn wired_manager(observer: Arc<dyn DecisionObserver>) -> (ResourceManager, Sessions) {
    let manager = ResourceManager::new(ResourceLimits::default(), observer);
    manager
        .register_scope(directory_scope("card-1", ScopeKind::Document, "chips.b"))
        .expect("Document 作用域");
    let bound_owner = "chips.a".to_owned();
    let bound = manager
        .open_session(
            SessionKind::Document,
            &bound_owner,
            ["card-1".to_owned()],
            Vec::<String>::new(),
        )
        .expect("绑定会话");
    let judged_owner = "chips.b".to_owned();
    let judged = manager
        .open_session(
            SessionKind::Document,
            &judged_owner,
            Vec::<String>::new(),
            vec!["resources:read:card-1".to_owned()],
        )
        .expect("限定授权会话");
    let intruder_owner = "chips.c".to_owned();
    let intruder = manager
        .open_session(
            SessionKind::Document,
            &intruder_owner,
            Vec::<String>::new(),
            Vec::<String>::new(),
        )
        .expect("拒绝场景会话");
    (
        manager,
        Sessions {
            bound,
            judged,
            intruder,
        },
    )
}

struct Sessions {
    bound: u64,
    judged: u64,
    intruder: u64,
}

fn bench_resolve_permission(c: &mut Criterion) {
    let mut group = c.benchmark_group("resolve_permission");
    for scenario in ["allow", "deny", "pass"] {
        // Noop 注入臂。
        {
            let (manager, sessions) = wired_manager(Arc::new(NoopDecisionObserver));
            group.bench_function(BenchmarkId::new(scenario, "noop"), |b| {
                b.iter(|| {
                    let outcome = run_resolve(&manager, scenario, &sessions);
                    black_box(outcome)
                });
            });
        }
        // 收集 observer 臂。
        {
            let collecting = CollectingObserver::default();
            let (manager, sessions) = wired_manager(Arc::new(collecting.clone()));
            group.bench_function(BenchmarkId::new(scenario, "collecting"), |b| {
                b.iter(|| {
                    let outcome = run_resolve(&manager, scenario, &sessions);
                    let seen = std::mem::take(&mut *collecting.seen.lock().unwrap());
                    black_box((outcome, seen.len()))
                });
            });
        }
    }
    group.finish();
}

/// 场景执行：allow = 限定授权 JudgedAllow 读；deny = 无权限拒绝读；
/// pass = 会话绑定直通读。
fn run_resolve(
    manager: &ResourceManager,
    scenario: &str,
    sessions: &Sessions,
) -> Result<String, String> {
    let session = match scenario {
        "allow" => sessions.judged,
        "deny" => sessions.intruder,
        _ => sessions.bound,
    };
    manager
        .resolve(
            black_box("chips-resource://card-1/notes/todo.md"),
            session,
            ResourceOperation::Read,
        )
        .map(|resolved| resolved.address.uri)
        .map_err(|error| error.code().to_owned())
}

criterion_group!(benches, bench_resolve_permission);
criterion_main!(benches);
