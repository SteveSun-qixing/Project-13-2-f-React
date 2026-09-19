//! 级联停用顺序、服务代际重建与任务取消集成测试。
//!
//! 覆盖《薯片内核设计》§6.4 级联停用（按依赖拓扑逆序逐个撤销）、
//! §5.3 服务代际替换后的注入重建（反向索引必须随撤销清理）、
//! §10.4 协作式取消（任务句柄主动取消幂等，且不算 panic）。
//!
//! 与 `kernel_lifecycle.rs` 的分工：该文件验证正常加载/停用与超时策略，
//! 本文件验证"多依赖者级联排序 + 多次代际替换 + 主动取消"这三处内核内部
//! 索引与排序约束，分支点在 `command::handle_disable` 的 rank 排序、
//! `service::revoke_injection` 的反向索引清理与 `task::TaskHandle::cancel`。

mod common;

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;
use chips_cordis::{
    Context, KernelError, PluginConfig, PluginRunner, PluginState, TaskHandle, TaskOptions,
};

use common::{counter, default_kernel, request, spec, wait_for, ApplyStep, TestRunner};

/// 记录 `stop` 调用顺序并注册一条服务的执行器。
struct OrderedRunner {
    id: String,
    service: String,
    log: Arc<Mutex<Vec<String>>>,
}

#[async_trait]
impl PluginRunner for OrderedRunner {
    async fn apply(&self, ctx: &Context, _config: &PluginConfig) -> Result<(), KernelError> {
        ctx.provide(self.service.clone(), 1_u32)?;
        Ok(())
    }

    async fn stop(&self, _ctx: &Context) -> Result<(), KernelError> {
        self.log
            .lock()
            .map_err(|_| KernelError::LockPoisoned)?
            .push(self.id.clone());
        Ok(())
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_cascade_disable_stops_dependents_in_reverse_topological_order() {
    // §6.4 规则 3：级联停用按依赖拓扑逆序执行——最下游的依赖者最先撤销，
    // 被停用者最后撤销；排序键是拓扑排名的逆序（`Reverse(rank)`）。
    let kernel = default_kernel();
    let log = Arc::new(Mutex::new(Vec::new()));
    let runner_for = |id: &str, service: &str| -> Arc<dyn PluginRunner> {
        Arc::new(OrderedRunner {
            id: id.to_owned(),
            service: service.to_owned(),
            log: Arc::clone(&log),
        })
    };

    let base = "chips.cov.base";
    let mid = "chips.cov.mid";
    let leaf = "chips.cov.leaf";
    let side = "chips.cov.side";
    kernel
        .load(request(
            base,
            "1.0.0",
            Vec::new(),
            runner_for(base, "cov-base"),
        ))
        .await
        .expect("提供方应可加载");
    kernel
        .load(request(
            mid,
            "1.0.0",
            vec![spec(base, "^1.0.0")],
            runner_for(mid, "cov-mid"),
        ))
        .await
        .expect("中间依赖方应可加载");
    kernel
        .load(request(
            leaf,
            "1.0.0",
            vec![spec(mid, "^1.0.0")],
            runner_for(leaf, "cov-leaf"),
        ))
        .await
        .expect("最下游依赖方应可加载");
    kernel
        .load(request(
            side,
            "1.0.0",
            vec![spec(base, "^1.0.0")],
            runner_for(side, "cov-side"),
        ))
        .await
        .expect("并列依赖方应可加载");
    for id in [base, mid, leaf, side] {
        assert_eq!(kernel.plugin_state(id), Some(PluginState::Active));
    }
    assert_eq!(kernel.service_count(), 4, "四个插件各注册一条服务");
    assert_eq!(kernel.dependents_of(base).len(), 2, "base 有两个直接依赖者");

    kernel.disable(base, true).await.expect("级联停用应成功");

    let order = log.lock().expect("锁可用").clone();
    assert_eq!(order.len(), 4, "级联必须覆盖全部依赖者与被停用者");
    let position = |id: &str| order.iter().position(|entry| entry == id);
    let base_at = position(base).expect("被停用者必须收到 stop");
    let mid_at = position(mid).expect("中间依赖方必须收到 stop");
    let leaf_at = position(leaf).expect("最下游依赖方必须收到 stop");
    let side_at = position(side).expect("并列依赖方必须收到 stop");
    assert!(
        leaf_at < mid_at,
        "传递依赖者必须早于其被依赖者撤销，实际顺序：{order:?}"
    );
    assert!(
        mid_at < base_at && side_at < base_at,
        "依赖者必须早于被停用者撤销，实际顺序：{order:?}"
    );
    assert_eq!(base_at, order.len() - 1, "被停用者必须最后撤销");

    for id in [base, mid, leaf, side] {
        assert_eq!(
            kernel.plugin_state(id),
            Some(PluginState::Installed),
            "级联完成后 {id} 应停留在 Installed"
        );
    }
    assert!(
        wait_for(|| kernel.context_count() == 1).await,
        "级联停用必须销毁全部插件 Context"
    );
    assert_eq!(kernel.service_count(), 0, "级联停用必须摘除全部服务条目");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_generation_replacement_rebuilds_injection_once_per_generation() {
    // §5.3 规则 4：提供方换代时注入先撤销再重建；反向索引按
    // `(Fork, 代际, 服务名)` 三元组登记，撤销时必须清掉旧键，
    // 否则后续替换会命中失效索引造成重复或丢失重建。
    let kernel = default_kernel();
    let runs = counter();
    let values = Arc::new(Mutex::new(Vec::new()));
    kernel
        .root_context()
        .provide("cov-dep-a".to_owned(), 1_u32)
        .expect("平台服务应可注册");
    kernel
        .root_context()
        .provide("cov-dep-b".to_owned(), 10_u32)
        .expect("平台服务应可注册");

    let seen = Arc::clone(&values);
    let counted = Arc::clone(&runs);
    let inject = ApplyStep::Run(Arc::new(move |ctx: &Context, _config| {
        let observed = Arc::clone(&seen);
        let counter = Arc::clone(&counted);
        ctx.inject(
            &["cov-dep-a".to_owned(), "cov-dep-b".to_owned()],
            move |injected: &Context| {
                let a = injected
                    .get_typed::<u32>("cov-dep-a")
                    .expect("注入作用域内应可解析依赖");
                let b = injected
                    .get_typed::<u32>("cov-dep-b")
                    .expect("注入作用域内应可解析依赖");
                counter.fetch_add(1, Ordering::SeqCst);
                observed.lock().expect("锁可用").push((*a, *b));
            },
        )?;
        Ok(())
    }));
    kernel
        .load(request(
            "chips.cov.consumer",
            "1.0.0",
            Vec::new(),
            TestRunner::with_apply("chips.cov.consumer", vec![inject]),
        ))
        .await
        .expect("消费方应可加载");
    assert_eq!(
        runs.load(Ordering::SeqCst),
        1,
        "依赖就绪时回调应立即执行一次"
    );
    assert_eq!(kernel.context_count(), 3, "根、插件与注入执行 Context");

    kernel
        .root_context()
        .provide("cov-dep-a".to_owned(), 2_u32)
        .expect("替换服务应成功");
    assert_eq!(
        runs.load(Ordering::SeqCst),
        2,
        "代际替换必须触发一次注入重建"
    );
    kernel
        .root_context()
        .provide("cov-dep-a".to_owned(), 3_u32)
        .expect("再次替换服务应成功");
    assert_eq!(
        runs.load(Ordering::SeqCst),
        3,
        "旧反向索引键未清理会造成重复重建"
    );
    kernel
        .root_context()
        .provide("cov-dep-b".to_owned(), 20_u32)
        .expect("替换第二条依赖应成功");
    assert_eq!(
        runs.load(Ordering::SeqCst),
        4,
        "多依赖注入对任一依赖变化都只重建一次"
    );
    assert_eq!(
        values.lock().expect("锁可用").as_slice(),
        &[(1, 10), (2, 10), (3, 10), (3, 20)][..],
        "每次重建都应读到当次生效的代际值"
    );
    assert_eq!(
        kernel.context_count(),
        3,
        "重建必须复用同一注入槽位，不得累积执行 Context"
    );
    assert_eq!(
        kernel.plugin_state("chips.cov.consumer"),
        Some(PluginState::Active),
        "重建不得影响消费方状态"
    );

    // 消费方撤销后，注入与执行 Context 一并销毁，再替换服务不得复活回调。
    kernel
        .disable("chips.cov.consumer", false)
        .await
        .expect("停用消费方应成功");
    assert!(
        wait_for(|| kernel.context_count() == 1).await,
        "停用必须销毁注入执行 Context"
    );
    kernel
        .root_context()
        .provide("cov-dep-a".to_owned(), 9_u32)
        .expect("替换服务应成功");
    assert_eq!(runs.load(Ordering::SeqCst), 4, "撤销后的注入不得再被重建");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_task_handle_cancel_is_cooperative_and_idempotent() {
    // §10.4 规则 2：任务取消为协作式，句柄主动取消与 Fork 撤销走同一路径；
    // §4.2 规则 3：任务归因为 `Effect::Task`，主动取消不属于 panic。
    let kernel = default_kernel();
    let root = kernel.root_context();
    let handle: TaskHandle = root
        .task(
            async {
                tokio::time::sleep(Duration::from_secs(600)).await;
            },
            TaskOptions {
                name: Some("cov-long-running".to_owned()),
                signal: None,
            },
        )
        .expect("根作用域应可创建任务");
    assert_eq!(
        handle.name.as_deref(),
        Some("cov-long-running"),
        "§4.2：任务名用于诊断、审计与配额展示"
    );
    assert!(!handle.signal().is_cancelled(), "新建任务不得处于取消态");
    assert!(!handle.is_finished());

    handle.cancel();
    handle.cancel();
    assert!(
        handle.signal().is_cancelled(),
        "取消信号置位后必须可观测，且重复取消幂等"
    );

    let error = handle.join().await.expect_err("被取消任务不得报告成功");
    assert_eq!(
        error.code(),
        "KERNEL_CONTEXT_DISPOSED",
        "协作式取消归一为作用域失效，而非 panic 或 apply 失败"
    );
    assert!(handle.is_finished(), "任务退出后必须标记结束");

    // §4.2 规则 2：`Effect::Task` 随 Fork 撤销；已结束后再取消仍为幂等。
    let child = root.create_child().expect("子作用域应可创建");
    let second = child
        .task(
            async {
                tokio::time::sleep(Duration::from_secs(600)).await;
            },
            TaskOptions {
                name: None,
                signal: None,
            },
        )
        .expect("子作用域应可创建任务");
    child.dispose().expect("子作用域撤销应成功");
    assert!(
        wait_for(|| second.is_finished()).await,
        "Fork 撤销必须协作终止任务"
    );
    let error = second
        .join()
        .await
        .expect_err("随 Fork 撤销的任务不得报告成功");
    assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    second.cancel();
    assert!(
        second.signal().is_cancelled(),
        "已结束任务上的取消调用仍应幂等生效"
    );
}
