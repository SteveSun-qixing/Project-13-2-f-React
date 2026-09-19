//! 服务代际与注入绑定集成测试。
//!
//! 覆盖《薯片内核设计》§5.2 暂存代际与一次原子发布、§5.2.1 遮蔽规则、
//! §5.3 注入 Fork 的副作用归属、§5.4 反向依赖索引 `(提供方 Fork, 代际, 服务名)`
//! 在撤销时的清理，以及 §6.6 失败回滚不留残留。
//!
//! 与 `kernel_services.rs` 的分工：该文件验证发布/重建主路径，本文件专测
//! "已发布同名条目存在时暂存代际的遮蔽视图"与"消费索引驱动的注入撤销"。

mod common;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use chips_cordis::{Context, KernelError};

use common::{bump, counter, default_kernel, request, spec, wait_for, ApplyStep, TestRunner};

/// 观测记录容器；apply 与注入回调内写入，测试体断言。
type Observations = Arc<Mutex<Vec<u32>>>;

/// Context 句柄槽位；供 apply 结束后继续访问插件作用域。
type ContextSlot = Arc<Mutex<Option<Context>>>;

/// 记录一次观测值。
fn record(observations: &Observations, value: u32) -> Result<(), KernelError> {
    observations
        .lock()
        .map_err(|_| KernelError::LockPoisoned)?
        .push(value);
    Ok(())
}

/// 取出槽位中的 Context。
fn take_context(slot: &ContextSlot) -> Context {
    slot.lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存 Context 句柄")
}

/// 取出观测序列。
fn observed(observations: &Observations) -> Vec<u32> {
    observations.lock().expect("锁可用").clone()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_staged_generation_shadows_published_ancestor_service() {
    // §5.2.1：暂存代际对其它解析方不可见，但当祖先上已有同名已发布条目时，
    // 提供方插件自身的视图必须被暂存值遮蔽（子遮蔽父），避免 apply 期间
    // 读回旧值而写出错误绑定。
    let kernel = default_kernel();
    let root = kernel.root_context();
    root.provide("shadowed".to_owned(), 1_u32)
        .expect("平台服务应发布");

    let observations: Observations = Arc::new(Mutex::new(Vec::new()));
    let slot: ContextSlot = Arc::new(Mutex::new(None));
    let runner = TestRunner::with_apply(
        "chips.test.shadow",
        vec![ApplyStep::Run(Arc::new({
            let observations = Arc::clone(&observations);
            let slot = Arc::clone(&slot);
            move |ctx: &Context, _config| {
                ctx.provide("shadowed".to_owned(), 2_u32)?;
                record(&observations, *ctx.get_typed::<u32>("shadowed")?)?;
                // 同名重复 provide：暂存代际原地替换，不得追加第二条目。
                ctx.provide("shadowed".to_owned(), 3_u32)?;
                record(&observations, *ctx.get_typed::<u32>("shadowed")?)?;
                // 子作用域继承同一遮蔽视图。
                let child = ctx.create_child()?;
                record(&observations, *child.get_typed::<u32>("shadowed")?)?;
                // 子 Context 先于插件销毁：插件暂存代际必须保留。
                child.dispose()?;
                ctx.provide("shadowed".to_owned(), 4_u32)?;
                record(&observations, *ctx.get_typed::<u32>("shadowed")?)?;
                *slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                Ok(())
            }
        }))],
    );
    kernel
        .load(request("chips.test.shadow", "1.0.0", Vec::new(), runner))
        .await
        .expect("加载应成功");

    assert_eq!(
        observed(&observations),
        vec![2, 3, 3, 4],
        "apply 期间应始终读到本轮暂存值"
    );
    let plugin_ctx = take_context(&slot);
    assert_eq!(
        *plugin_ctx
            .get_typed::<u32>("shadowed")
            .expect("发布后插件应读到自身代际"),
        4
    );
    assert_eq!(
        *root
            .get_typed::<u32>("shadowed")
            .expect("平台条目应保持自身代际"),
        1,
        "暂存发布不得覆盖祖先 Context 的同名条目"
    );
    assert_eq!(
        kernel.service_count(),
        2,
        "同名服务按 (Context, 名) 各计一条，暂存代际只发布一次"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_staged_shadow_applies_to_globally_published_service() {
    // §5.2.1 的第二条命中路径：已发布条目不在祖先链上，而来自全局插件服务
    // 索引（另一插件提供），遮蔽同样必须生效。
    let kernel = default_kernel();
    let provider_slot: ContextSlot = Arc::new(Mutex::new(None));
    kernel
        .load(request(
            "chips.test.older-provider",
            "1.0.0",
            Vec::new(),
            TestRunner::with_apply(
                "chips.test.older-provider",
                vec![ApplyStep::Run(Arc::new({
                    let slot = Arc::clone(&provider_slot);
                    move |ctx: &Context, _config| {
                        ctx.provide("cross-plugin".to_owned(), 10_u32)?;
                        *slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                        Ok(())
                    }
                }))],
            ),
        ))
        .await
        .expect("先发布的插件应激活");

    let observations: Observations = Arc::new(Mutex::new(Vec::new()));
    let late_slot: ContextSlot = Arc::new(Mutex::new(None));
    let runner = TestRunner::with_apply(
        "chips.test.later-provider",
        vec![ApplyStep::Run(Arc::new({
            let observations = Arc::clone(&observations);
            let late_slot = Arc::clone(&late_slot);
            move |ctx: &Context, _config| {
                ctx.provide("cross-plugin".to_owned(), 20_u32)?;
                record(&observations, *ctx.get_typed::<u32>("cross-plugin")?)?;
                *late_slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                Ok(())
            }
        }))],
    );
    kernel
        .load(request(
            "chips.test.later-provider",
            "1.0.0",
            vec![spec("chips.test.older-provider", "^1.0.0")],
            runner,
        ))
        .await
        .expect("后发布的插件应激活");

    assert_eq!(
        observed(&observations),
        vec![20],
        "全局索引命中时也必须读到自己的暂存值"
    );
    assert_eq!(
        *take_context(&late_slot)
            .get_typed::<u32>("cross-plugin")
            .expect("发布后应读到本插件代际"),
        20
    );
    assert_eq!(
        *take_context(&provider_slot)
            .get_typed::<u32>("cross-plugin")
            .expect("原提供方仍应读到本插件代际"),
        10
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_rebuild_revokes_injection_effects_by_consumed_generation() {
    // §5.4：消费关系按 `(提供方 Fork, 代际, 服务名)` 入反向索引；提供方在
    // `Active` 期间替换同名服务产生新代际时，旧代际的消费注入必须被撤销并
    // 按新代际重放，回调内登记的副作用随注入 Fork 一并回滚（§5.3）。
    let kernel = default_kernel();
    let injections = counter();
    let cleanups = counter();
    let seen = Arc::new(AtomicU32::new(0));
    let provider_slot: ContextSlot = Arc::new(Mutex::new(None));
    let consumer_slot: ContextSlot = Arc::new(Mutex::new(None));

    let provider = TestRunner::with_apply(
        "chips.test.rotator",
        vec![ApplyStep::Run(Arc::new({
            let slot = Arc::clone(&provider_slot);
            move |ctx: &Context, _config| {
                ctx.provide("rotate".to_owned(), 1_u32)?;
                *slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                Ok(())
            }
        }))],
    );
    kernel
        .load(request("chips.test.rotator", "1.0.0", Vec::new(), provider))
        .await
        .expect("提供方应激活");

    kernel
        .load(request(
            "chips.test.rebinding",
            "1.0.0",
            vec![spec("chips.test.rotator", "^1.0.0")],
            TestRunner::with_apply(
                "chips.test.rebinding",
                vec![ApplyStep::Run(Arc::new({
                    let injections = Arc::clone(&injections);
                    let seen = Arc::clone(&seen);
                    let cleanups = Arc::clone(&cleanups);
                    let consumer_slot = Arc::clone(&consumer_slot);
                    move |ctx: &Context, _config| {
                        let injections = Arc::clone(&injections);
                        let seen = Arc::clone(&seen);
                        let cleanups = Arc::clone(&cleanups);
                        ctx.inject(&["rotate".to_owned()], move |injected: &Context| {
                            bump(&injections);
                            if let Ok(value) = injected.get_typed::<u32>("rotate") {
                                seen.store(*value, Ordering::SeqCst);
                            }
                            let cleanups = Arc::clone(&cleanups);
                            injected
                                .effect(move || bump(&cleanups))
                                .expect("回调内登记副作用应成功");
                            injected
                                .provide("derived".to_owned(), 1_u32)
                                .expect("回调内注册服务应成功");
                        })?;
                        *consumer_slot
                            .lock()
                            .map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                        Ok(())
                    }
                }))],
            ),
        ))
        .await
        .expect("消费方应激活");
    assert_eq!(injections.load(Ordering::SeqCst), 1);
    assert_eq!(seen.load(Ordering::SeqCst), 1);
    assert_eq!(cleanups.load(Ordering::SeqCst), 0, "首轮注入副作用尚未撤销");

    let provider_ctx = take_context(&provider_slot);
    provider_ctx
        .provide("rotate".to_owned(), 2_u32)
        .expect("Active 期间替换服务应立即发布新代际");
    assert_eq!(
        injections.load(Ordering::SeqCst),
        2,
        "新代际发布后必须按反向索引重放回调"
    );
    assert_eq!(
        cleanups.load(Ordering::SeqCst),
        1,
        "旧代际注入的副作用应随撤销回滚"
    );
    assert_eq!(seen.load(Ordering::SeqCst), 2, "重建回调应读到新代际值");
    let consumer_ctx = take_context(&consumer_slot);
    assert_eq!(
        *consumer_ctx
            .get_typed::<u32>("rotate")
            .expect("新代际服务应可解析"),
        2
    );
    assert_eq!(
        *consumer_ctx
            .get_typed::<u32>("derived")
            .expect("回调内注册的服务应随重建更新"),
        1
    );
    assert_eq!(
        kernel.service_count(),
        2,
        "只保留 rotate 与 derived 各一条，旧代际条目不得残留"
    );

    // 反向索引必须被清理干净：再次替换仍能精确重建，不多不少。
    provider_ctx
        .provide("rotate".to_owned(), 3_u32)
        .expect("二次替换服务应成功");
    assert_eq!(injections.load(Ordering::SeqCst), 3);
    assert_eq!(cleanups.load(Ordering::SeqCst), 2);
    assert_eq!(seen.load(Ordering::SeqCst), 3);
    assert_eq!(kernel.service_count(), 2);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_nested_injection_failure_disposes_owner_scope_without_residue() {
    // §5.3：注入回调出错时撤销注入 Fork 并把依赖方插件置为 `Failed`；
    // 嵌套注入场景下，外层回调返回时其注入记录已随归属 Fork 一并销毁，
    // 内核必须安静收敛而不是把副作用登记到已死的注入上（§6.6 不留残留）。
    let kernel = default_kernel();
    let root = kernel.root_context();
    root.provide("dep-a".to_owned(), 1_u32)
        .expect("平台服务应发布");
    root.provide("dep-b".to_owned(), 2_u32)
        .expect("平台服务应发布");

    let runner = TestRunner::with_apply(
        "chips.test.nested",
        vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
            ctx.provide("own".to_owned(), 7_u32)?;
            ctx.inject(&["dep-a".to_owned()], |outer: &Context| {
                let _ = outer.inject(&["dep-b".to_owned()], |_inner: &Context| {
                    panic!("内层注入回调故障");
                });
            })?;
            Ok(())
        }))],
    );
    let error = kernel
        .load(request("chips.test.nested", "1.0.0", Vec::new(), runner))
        .await
        .expect_err("嵌套注入失败应回传错误");
    assert_eq!(error.code(), "KERNEL_INJECT_FAILED");
    assert_eq!(
        kernel
            .plugin_last_error("chips.test.nested")
            .map(|error| error.code().to_owned()),
        Some("KERNEL_INJECT_FAILED".to_owned())
    );
    assert!(
        wait_for(|| kernel.context_count() == 1).await,
        "插件 Context 与两层注入执行 Context 必须全部销毁"
    );
    assert_eq!(
        kernel.service_count(),
        2,
        "暂存代际与注入 Fork 副作用随归属 Fork 一并丢弃"
    );
    assert!(root.get("own").is_err(), "失败插件的服务不得进入已发布表");

    // 失败可重试：重试轮从零建立新代际，不受上一轮销毁残留影响。
    kernel
        .load(request(
            "chips.test.nested",
            "1.0.0",
            Vec::new(),
            TestRunner::ok("chips.test.nested"),
        ))
        .await
        .expect("重试加载应成功");
    assert_eq!(kernel.service_count(), 2, "重试不得复活旧条目");
}
