//! 服务模型集成测试：暂存代际、原子发布、级联重建、作用域与依赖失效传播。

mod common;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use chips_cordis::{Context, KernelError, PluginState};

use common::{bump, counter, default_kernel, request, spec, wait_for, ApplyStep, TestRunner};

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_provide_during_starting_is_staged_until_active() {
    let kernel = default_kernel();

    let callback_calls = counter();
    let seen = Arc::new(AtomicU32::new(0));
    let consumer = TestRunner::with_apply(
        "chips.test.consumer",
        vec![ApplyStep::Run(Arc::new({
            let callback_calls = Arc::clone(&callback_calls);
            let seen = Arc::clone(&seen);
            move |ctx: &Context, _config| {
                let callback_calls = Arc::clone(&callback_calls);
                let seen = Arc::clone(&seen);
                ctx.inject(&["staged".to_owned()], move |injected: &Context| {
                    bump(&callback_calls);
                    if let Ok(value) = injected.get_typed::<u32>("staged") {
                        seen.store(*value, Ordering::SeqCst);
                    }
                })?;
                Ok(())
            }
        }))],
    );
    kernel
        .load(request(
            "chips.test.consumer",
            "1.0.0",
            Vec::new(),
            consumer,
        ))
        .await
        .expect("消费者应可加载");
    assert_eq!(callback_calls.load(Ordering::SeqCst), 0);

    let provider = TestRunner::with_apply(
        "chips.test.provider",
        vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
            ctx.provide("staged".to_owned(), 9_u32)?;
            let error = ctx.get("staged").expect_err("暂存代际对解析不可见");
            assert_eq!(error.code(), "KERNEL_SERVICE_NOT_FOUND");
            Ok(())
        }))],
    );
    let state = kernel
        .load(request(
            "chips.test.provider",
            "1.0.0",
            Vec::new(),
            provider,
        ))
        .await
        .expect("提供方应可加载");
    assert_eq!(state, PluginState::Active);

    assert_eq!(callback_calls.load(Ordering::SeqCst), 1);
    assert_eq!(seen.load(Ordering::SeqCst), 9);
    kernel
        .get_typed::<u32>(kernel.root_context().id(), "staged")
        .expect("发布后服务应可见");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_active_provide_publishes_and_rebuilds_consumers() {
    let kernel = default_kernel();
    let provider_ctx: Arc<Mutex<Option<Context>>> = Arc::new(Mutex::new(None));
    let provider = TestRunner::with_apply(
        "chips.test.gamma-provider",
        vec![ApplyStep::Run(Arc::new({
            let slot = Arc::clone(&provider_ctx);
            move |ctx: &Context, _config| {
                ctx.provide("gamma".to_owned(), 1_u32)?;
                *slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                Ok(())
            }
        }))],
    );
    let rebuilds = counter();
    let last_value = Arc::new(AtomicU32::new(0));
    let consumer = TestRunner::with_apply(
        "chips.test.gamma-consumer",
        vec![ApplyStep::Run(Arc::new({
            let rebuilds = Arc::clone(&rebuilds);
            let last_value = Arc::clone(&last_value);
            move |ctx: &Context, _config| {
                let rebuilds = Arc::clone(&rebuilds);
                let last_value = Arc::clone(&last_value);
                ctx.inject(&["gamma".to_owned()], move |injected: &Context| {
                    bump(&rebuilds);
                    if let Ok(value) = injected.get_typed::<u32>("gamma") {
                        last_value.store(*value, Ordering::SeqCst);
                    }
                })?;
                Ok(())
            }
        }))],
    );

    kernel
        .load(request(
            "chips.test.gamma-provider",
            "1.0.0",
            Vec::new(),
            provider,
        ))
        .await
        .expect("提供方应可加载");
    kernel
        .load(request(
            "chips.test.gamma-consumer",
            "1.0.0",
            vec![spec("chips.test.gamma-provider", "^1.0.0")],
            consumer,
        ))
        .await
        .expect("消费者应可加载");
    assert_eq!(rebuilds.load(Ordering::SeqCst), 1);
    assert_eq!(last_value.load(Ordering::SeqCst), 1);

    let ctx = provider_ctx
        .lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存 Context");
    ctx.provide("gamma".to_owned(), 2_u32)
        .expect("Active 期间注册应立即发布");

    assert_eq!(
        rebuilds.load(Ordering::SeqCst),
        2,
        "消费方注入应被撤销并重建"
    );
    assert_eq!(last_value.load(Ordering::SeqCst), 2, "重建回调应看到新代际");
    let value = kernel
        .get_typed::<u32>(kernel.root_context().id(), "gamma")
        .expect("服务应可见");
    assert_eq!(*value, 2);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_scope_shadowing_child_service_and_type_mismatch() {
    let kernel = default_kernel();
    let root = kernel.root_context();
    root.provide("delta".to_owned(), 1_u32)
        .expect("根服务应注册");

    let child_slot: Arc<Mutex<Option<Context>>> = Arc::new(Mutex::new(None));
    let provider = TestRunner::with_apply(
        "chips.test.scope-provider",
        vec![ApplyStep::Run(Arc::new({
            let slot = Arc::clone(&child_slot);
            move |ctx: &Context, _config| {
                ctx.provide("delta".to_owned(), 2_u32)?;
                let value = ctx.get_typed::<u32>("delta")?;
                assert_eq!(*value, 2, "子遮蔽父：插件应看到自身注册");
                let error = ctx
                    .get_typed::<String>("delta")
                    .expect_err("类型不匹配应被拒绝");
                assert_eq!(error.code(), "KERNEL_SERVICE_TYPE_MISMATCH");

                let child = ctx.create_child()?;
                child.provide("child-only".to_owned(), 5_u32)?;
                let value = ctx.get_typed::<u32>("child-only")?;
                assert_eq!(*value, 5, "子 Context 服务对插件可见");
                assert_eq!(child.state(), chips_cordis::ContextState::Active);
                *slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(child);
                Ok(())
            }
        }))],
    );
    kernel
        .load(request(
            "chips.test.scope-provider",
            "1.0.0",
            Vec::new(),
            provider,
        ))
        .await
        .expect("插件应可加载");
    assert_eq!(kernel.service_count(), 3, "根、插件与子 Context 各一条");

    let child = child_slot
        .lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存子 Context");
    assert!(root.get("child-only").is_err(), "根不可见子 Context 服务");
    let plugin_context = kernel
        .plugin_of_context(child.id())
        .expect("子 Context 应归属插件");
    assert_eq!(plugin_context, "chips.test.scope-provider");

    child.dispose().expect("子 Context 销毁应成功");
    assert_eq!(kernel.service_count(), 2, "子 Context 服务应被精确摘除");
    assert_eq!(kernel.context_count(), 2);
    let error = child.get("child-only").expect_err("子 Context 已销毁");
    assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");

    kernel
        .disable("chips.test.scope-provider", false)
        .await
        .expect("停用应成功");
    assert_eq!(kernel.service_count(), 1);
    assert_eq!(*root.get_typed::<u32>("delta").expect("根服务应保留"), 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_provider_injection_failure_keeps_consumer_active_and_recovers() {
    let kernel = default_kernel();
    let root = kernel.root_context();

    let provider = TestRunner::with_apply(
        "chips.test.epsilon-provider",
        vec![
            ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
                ctx.provide("epsilon".to_owned(), 1_u32)?;
                ctx.inject(&["zeta".to_owned()], |_ctx: &Context| {
                    panic!("注入回调故意失败");
                })?;
                Ok(())
            })),
            ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
                ctx.provide("epsilon".to_owned(), 1_u32)?;
                Ok(())
            })),
        ],
    );

    let consumer_ctx: Arc<Mutex<Option<Context>>> = Arc::new(Mutex::new(None));
    let injections = counter();
    let consumer = TestRunner::with_apply(
        "chips.test.epsilon-consumer",
        vec![ApplyStep::Run(Arc::new({
            let injections = Arc::clone(&injections);
            let slot = Arc::clone(&consumer_ctx);
            move |ctx: &Context, _config| {
                let injections = Arc::clone(&injections);
                ctx.inject(&["epsilon".to_owned()], move |_injected: &Context| {
                    bump(&injections);
                })?;
                *slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                Ok(())
            }
        }))],
    );

    kernel
        .load(request(
            "chips.test.epsilon-provider",
            "1.0.0",
            Vec::new(),
            provider,
        ))
        .await
        .expect("提供方应可加载");
    kernel
        .load(request(
            "chips.test.epsilon-consumer",
            "1.0.0",
            vec![spec("chips.test.epsilon-provider", "^1.0.0")],
            consumer,
        ))
        .await
        .expect("消费者应可加载");
    assert_eq!(injections.load(Ordering::SeqCst), 1);

    root.provide("zeta".to_owned(), true)
        .expect("平台服务注册应成功");

    assert_eq!(
        kernel.plugin_state("chips.test.epsilon-provider"),
        Some(PluginState::Failed)
    );
    assert_eq!(
        kernel.plugin_state("chips.test.epsilon-consumer"),
        Some(PluginState::Active),
        "提供方失败不得级联停用依赖方"
    );
    assert_eq!(
        kernel
            .plugin_last_error("chips.test.epsilon-provider")
            .map(|error| error.code().to_owned()),
        Some("KERNEL_INJECT_FAILED".to_owned())
    );
    let consumer_context = consumer_ctx
        .lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存 Context");
    let error = consumer_context
        .get("epsilon")
        .expect_err("提供方失败后服务应不可用");
    assert_eq!(error.code(), "KERNEL_SERVICE_NOT_FOUND");

    let state = kernel
        .enable("chips.test.epsilon-provider")
        .await
        .expect("提供方应可恢复");
    assert_eq!(state, PluginState::Active);
    assert!(
        wait_for(|| injections.load(Ordering::SeqCst) == 2).await,
        "提供方恢复后依赖方注入应按拓扑序重建"
    );
    assert_eq!(
        *consumer_context
            .get_typed::<u32>("epsilon")
            .expect("服务应恢复"),
        1
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_cascade_disable_revokes_injection_effects() {
    let kernel = default_kernel();
    let provider = TestRunner::with_apply(
        "chips.test.theta-provider",
        vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
            ctx.provide("theta".to_owned(), 3_u32)?;
            Ok(())
        }))],
    );
    let cleanups = counter();
    let consumer = TestRunner::with_apply(
        "chips.test.theta-consumer",
        vec![ApplyStep::Run(Arc::new({
            let cleanups = Arc::clone(&cleanups);
            move |ctx: &Context, _config| {
                let cleanups = Arc::clone(&cleanups);
                ctx.inject(&["theta".to_owned()], move |injected: &Context| {
                    let cleanups = Arc::clone(&cleanups);
                    let _ = injected.effect(move || bump(&cleanups));
                })?;
                Ok(())
            }
        }))],
    );
    kernel
        .load(request(
            "chips.test.theta-provider",
            "1.0.0",
            Vec::new(),
            provider,
        ))
        .await
        .expect("提供方应可加载");
    kernel
        .load(request(
            "chips.test.theta-consumer",
            "1.0.0",
            vec![spec("chips.test.theta-provider", "^1.0.0")],
            consumer,
        ))
        .await
        .expect("消费者应可加载");
    assert_eq!(cleanups.load(Ordering::SeqCst), 0);

    kernel
        .disable("chips.test.theta-provider", true)
        .await
        .expect("级联停用应成功");
    assert_eq!(
        cleanups.load(Ordering::SeqCst),
        1,
        "注入 Fork 撤销应执行清理"
    );
    assert_eq!(kernel.service_count(), 0);
    assert_eq!(kernel.context_count(), 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_rebuild_depth_limit_reports_overflow() {
    let kernel = default_kernel();

    // P0 提供 s0；P{i} 注入 s{i-1} 并在回调中提供 s{i}，形成 17 层嵌套重建链。
    const LEVELS: usize = 18;
    let head_context: Arc<Mutex<Option<Context>>> = Arc::new(Mutex::new(None));
    kernel
        .load(request(
            "chips.test.level-0",
            "1.0.0",
            Vec::new(),
            TestRunner::with_apply(
                "chips.test.level-0",
                vec![ApplyStep::Run(Arc::new({
                    let slot = Arc::clone(&head_context);
                    move |ctx: &Context, _config| {
                        ctx.provide("s0".to_owned(), 0_u32)?;
                        *slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                        Ok(())
                    }
                }))],
            ),
        ))
        .await
        .expect("链首应可加载");

    let overflow: Arc<Mutex<Option<KernelError>>> = Arc::new(Mutex::new(None));
    for level in 1..LEVELS {
        let overflow = Arc::clone(&overflow);
        let previous = format!("s{}", level - 1);
        let current = format!("s{level}");
        let runner = TestRunner::with_apply(
            &format!("chips.test.level-{level}"),
            vec![ApplyStep::Run(Arc::new(move |ctx: &Context, _config| {
                let previous = previous.clone();
                let current = current.clone();
                let overflow = Arc::clone(&overflow);
                ctx.inject(&[previous], move |injected: &Context| {
                    if let Err(error) = injected.provide(current.clone(), 0_u32) {
                        if let Ok(mut slot) = overflow.lock() {
                            *slot = Some(error);
                        }
                    }
                })?;
                Ok(())
            }))],
        );
        let state = kernel
            .load(request(
                &format!("chips.test.level-{level}"),
                "1.0.0",
                vec![spec(&format!("chips.test.level-{}", level - 1), "^1.0.0")],
                runner,
            ))
            .await
            .expect("链上插件应可加载");
        assert_eq!(state, PluginState::Active);
    }

    // 触发最外层代际替换：s0 从 0 换为新值，级联重建逐层嵌套。
    let head = head_context
        .lock()
        .expect("锁可用")
        .clone()
        .expect("链首 apply 应保存 Context");
    head.provide("s0".to_owned(), 1_u32)
        .expect("Active 期间注册应成功发布");

    assert!(
        wait_for(|| overflow.lock().map(|slot| slot.is_some()).unwrap_or(false)).await,
        "嵌套重建应触发深度超限"
    );
    let error = overflow
        .lock()
        .expect("锁可用")
        .clone()
        .expect("应记录溢出错误");
    assert_eq!(error.code(), "KERNEL_REBUILD_OVERFLOW");

    // 中止轮次后系统仍可服务：链首新代际生效，全部插件保持 Active。
    assert_eq!(*head.get_typed::<u32>("s0").expect("链首新代际应可见"), 1);
    for level in 0..LEVELS {
        assert_eq!(
            kernel.plugin_state(&format!("chips.test.level-{level}")),
            Some(PluginState::Active),
            "级联重建超限不得改变插件状态"
        );
    }
}
