//! 生命周期集成测试：加载、停用、卸载、回滚、超时、依赖解析与 Context 销毁。

mod common;

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use chips_cordis::{Context, KernelError, KernelOptions, PluginState};

use common::{
    bump, counter, default_kernel, kernel_with, request, spec, version, wait_for, ApplyStep,
    StopStep, TestRunner,
};

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_full_lifecycle_load_disable_unload() {
    let kernel = default_kernel();
    let root = kernel.root_context();

    let loaded = Arc::new(Mutex::new(Vec::<serde_json::Value>::new()));
    {
        let loaded = Arc::clone(&loaded);
        root.on(
            "plugin:loaded",
            move |_ctx: &Context, payload: &serde_json::Value| {
                loaded
                    .lock()
                    .map_err(|_| KernelError::LockPoisoned)?
                    .push(payload.clone());
                Ok(())
            },
        )
        .expect("订阅应成功");
    }

    let cleanup = counter();
    let apply_cleanup = Arc::clone(&cleanup);
    let runner = TestRunner::with_apply(
        "chips.test.alpha",
        vec![ApplyStep::Run(Arc::new(move |ctx: &Context, _config| {
            ctx.provide("alpha".to_owned(), 42_u32)?;
            let cleanup = Arc::clone(&apply_cleanup);
            ctx.effect(move || bump(&cleanup))?;
            Ok(())
        }))],
    );

    let state = kernel
        .load(request("chips.test.alpha", "1.0.0", Vec::new(), runner))
        .await
        .expect("加载应成功");
    assert_eq!(state, PluginState::Active);
    assert_eq!(
        kernel.plugin_state("chips.test.alpha"),
        Some(PluginState::Active)
    );
    assert_eq!(*root.get_typed::<u32>("alpha").expect("服务应存在"), 42);
    assert_eq!(kernel.service_count(), 1);
    assert_eq!(kernel.context_count(), 2, "根 Context 加插件 Context");

    let payloads = loaded.lock().expect("锁可用").clone();
    assert_eq!(payloads.len(), 1);
    assert_eq!(payloads[0]["pluginId"], "chips.test.alpha");
    assert_eq!(payloads[0]["version"], "1.0.0");
    assert_eq!(payloads[0]["role"], "service");

    kernel
        .disable("chips.test.alpha", false)
        .await
        .expect("停用应成功");
    assert_eq!(
        kernel.plugin_state("chips.test.alpha"),
        Some(PluginState::Installed)
    );
    assert_eq!(kernel.service_count(), 0, "停用后服务条目应全部摘除");
    assert_eq!(kernel.context_count(), 1, "停用后插件 Context 应销毁");
    assert_eq!(cleanup.load(std::sync::atomic::Ordering::SeqCst), 1);
    let error = root.get("alpha").expect_err("服务应已摘除");
    assert_eq!(error.code(), "KERNEL_SERVICE_NOT_FOUND");

    kernel.unload("chips.test.alpha").await.expect("卸载应成功");
    assert_eq!(
        kernel.plugin_state("chips.test.alpha"),
        Some(PluginState::Removed)
    );
    assert!(kernel.plugin_ids().is_empty());
    assert!(kernel.dependents_of("chips.test.alpha").is_empty());

    kernel.shutdown().await.expect("关闭应成功");
    assert!(kernel.shutdown().await.is_err(), "关闭后命令循环应已停止");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_apply_failure_rolls_back_without_residue_and_retries() {
    let kernel = default_kernel();
    let root = kernel.root_context();

    let cleanup = counter();
    let apply_cleanup = Arc::clone(&cleanup);
    let listener_calls = counter();
    let apply_listener = Arc::clone(&listener_calls);
    let failing = TestRunner::with_apply(
        "chips.test.rollback",
        vec![ApplyStep::Run(Arc::new(move |ctx: &Context, _config| {
            ctx.provide("rollback".to_owned(), 1_u32)?;
            ctx.effect({
                let cleanup = Arc::clone(&apply_cleanup);
                move || bump(&cleanup)
            })?;
            let listener_calls = Arc::clone(&apply_listener);
            ctx.on(
                "document:changed",
                move |_ctx: &Context, _payload: &serde_json::Value| {
                    bump(&listener_calls);
                    Ok(())
                },
            )?;
            Err(KernelError::ApplyFailed {
                id: "chips.test.rollback".to_owned(),
            })
        }))],
    );

    let error = kernel
        .load(request("chips.test.rollback", "1.0.0", Vec::new(), failing))
        .await
        .expect_err("apply 失败应返回错误");
    assert_eq!(error.code(), "KERNEL_APPLY_FAILED");
    assert_eq!(
        kernel.plugin_state("chips.test.rollback"),
        Some(PluginState::Failed)
    );
    assert_eq!(kernel.service_count(), 0, "失败后不得留下服务条目");
    assert_eq!(kernel.context_count(), 1, "失败后不得留下插件 Context");
    assert_eq!(
        cleanup.load(std::sync::atomic::Ordering::SeqCst),
        1,
        "清理闭包应执行一次"
    );
    assert_eq!(
        kernel
            .plugin_last_error("chips.test.rollback")
            .map(|error| error.code().to_owned()),
        Some("KERNEL_APPLY_FAILED".to_owned())
    );

    // 失败回滚后事件监听器应失效：根发布事件不得触发插件的监听器。
    root.emit("document:changed", serde_json::json!({}))
        .expect("发布应成功");
    assert_eq!(listener_calls.load(std::sync::atomic::Ordering::SeqCst), 0);

    // 重试：显式 enable 使用修正后的执行器重新加载。
    let fixed = TestRunner::with_apply(
        "chips.test.rollback",
        vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
            ctx.provide("rollback".to_owned(), 2_u32)?;
            Ok(())
        }))],
    );
    let state = kernel
        .load(request("chips.test.rollback", "1.0.0", Vec::new(), fixed))
        .await
        .expect("修正后应可重新启用");
    assert_eq!(state, PluginState::Active);
    assert_eq!(*root.get_typed::<u32>("rollback").expect("服务应存在"), 2);

    kernel
        .disable("chips.test.rollback", false)
        .await
        .expect("停用应成功");
    assert_eq!(kernel.context_count(), 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_apply_timeout_marks_failed() {
    let kernel = kernel_with(KernelOptions {
        apply_timeout: Duration::from_millis(50),
        ..KernelOptions::default()
    });
    let runner = TestRunner::with_apply(
        "chips.test.slow-apply",
        vec![ApplyStep::Sleep(Duration::from_secs(5))],
    );

    let started = Instant::now();
    let error = kernel
        .load(request(
            "chips.test.slow-apply",
            "1.0.0",
            Vec::new(),
            runner,
        ))
        .await
        .expect_err("apply 超时应返回错误");
    assert_eq!(error.code(), "KERNEL_LIFECYCLE_TIMEOUT");
    assert!(started.elapsed() < Duration::from_secs(2), "超时应及时返回");
    assert_eq!(
        kernel.plugin_state("chips.test.slow-apply"),
        Some(PluginState::Failed)
    );
    assert_eq!(kernel.context_count(), 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_stop_timeout_still_installs_and_records_diagnostic() {
    let kernel = kernel_with(KernelOptions {
        stop_timeout: Duration::from_millis(50),
        ..KernelOptions::default()
    });
    let runner = TestRunner::with_stop(
        "chips.test.slow-stop",
        vec![StopStep::Sleep(Duration::from_secs(5))],
    );
    kernel
        .load(request("chips.test.slow-stop", "1.0.0", Vec::new(), runner))
        .await
        .expect("加载应成功");

    let started = Instant::now();
    kernel
        .disable("chips.test.slow-stop", false)
        .await
        .expect("stop 超时不阻断停用");
    assert!(started.elapsed() < Duration::from_secs(2));
    assert_eq!(
        kernel.plugin_state("chips.test.slow-stop"),
        Some(PluginState::Installed)
    );
    assert_eq!(
        kernel
            .plugin_last_error("chips.test.slow-stop")
            .map(|error| error.code().to_owned()),
        Some("KERNEL_LIFECYCLE_TIMEOUT".to_owned())
    );
    assert_eq!(kernel.context_count(), 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_missing_dependency_stays_pending_then_activates() {
    let kernel = default_kernel();
    let provider = TestRunner::with_apply(
        "chips.test.provider",
        vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
            ctx.provide("provided".to_owned(), 7_u32)?;
            Ok(())
        }))],
    );
    let consumer = TestRunner::with_apply(
        "chips.test.consumer",
        vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
            let value = ctx.get_typed::<u32>("provided")?.as_ref().to_owned();
            assert_eq!(value, 7);
            Ok(())
        }))],
    );

    let state = kernel
        .load(request(
            "chips.test.consumer",
            "1.0.0",
            vec![spec("chips.test.provider", "^1.0.0")],
            consumer,
        ))
        .await
        .expect("依赖缺失不是失败");
    assert_eq!(state, PluginState::Pending);

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
    assert!(
        wait_for(|| kernel.plugin_state("chips.test.consumer") == Some(PluginState::Active)).await,
        "依赖就绪后依赖方应自动激活"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_cycle_duplicate_and_version_conflicts_reject_to_failed() {
    let kernel = default_kernel();

    // 依赖成环：A 依赖 B，B 依赖 A。
    kernel
        .load(request(
            "chips.test.cycle-a",
            "1.0.0",
            vec![spec("chips.test.cycle-b", "^1.0.0")],
            TestRunner::ok("chips.test.cycle-a"),
        ))
        .await
        .expect("依赖缺失应停留 Pending");
    let error = kernel
        .load(request(
            "chips.test.cycle-b",
            "1.0.0",
            vec![spec("chips.test.cycle-a", "^1.0.0")],
            TestRunner::ok("chips.test.cycle-b"),
        ))
        .await
        .expect_err("成环应被拒绝");
    assert_eq!(error.code(), "KERNEL_DEPENDENCY_CYCLE");
    assert_eq!(
        kernel.plugin_state("chips.test.cycle-b"),
        Some(PluginState::Failed)
    );
    let error = kernel
        .load(request(
            "chips.test.cycle-a",
            "1.0.0",
            vec![spec("chips.test.cycle-b", "^1.0.0")],
            TestRunner::ok("chips.test.cycle-a"),
        ))
        .await
        .expect_err("成环应被拒绝");
    assert_eq!(error.code(), "KERNEL_DEPENDENCY_CYCLE");

    // 重复声明：提供方先就绪。
    kernel
        .load(request(
            "chips.test.dep",
            "1.0.0",
            Vec::new(),
            TestRunner::ok("chips.test.dep"),
        ))
        .await
        .expect("提供方应可加载");
    let error = kernel
        .load(request(
            "chips.test.duplicate",
            "1.0.0",
            vec![
                spec("chips.test.dep", "^1.0.0"),
                spec("chips.test.dep", "^1.0.0"),
            ],
            TestRunner::ok("chips.test.duplicate"),
        ))
        .await
        .expect_err("重复声明应被拒绝");
    assert_eq!(error.code(), "KERNEL_DEPENDENCY_DUPLICATE");
    assert_eq!(
        kernel.plugin_state("chips.test.duplicate"),
        Some(PluginState::Failed)
    );

    // 版本互斥：候选集合与范围无交集。
    let error = kernel
        .load(request(
            "chips.test.conflict",
            "1.0.0",
            vec![spec("chips.test.dep", "^2.0.0")],
            TestRunner::ok("chips.test.conflict"),
        ))
        .await
        .expect_err("版本互斥应被拒绝");
    assert_eq!(error.code(), "KERNEL_DEPENDENCY_VERSION");
    assert_eq!(
        kernel.plugin_state("chips.test.conflict"),
        Some(PluginState::Failed)
    );
    let details = kernel
        .plugin_last_error("chips.test.conflict")
        .and_then(|error| error.details().cloned())
        .expect("错误应携带结构化诊断");
    assert_eq!(details["dependency"], "chips.test.dep");
    assert_eq!(details["candidates"], serde_json::json!([]));

    // 版本暂不满足：存在可满足的候选版本，停留 Pending。
    let pending = chips_cordis::LoadRequest {
        id: "chips.test.pending-dep".to_owned(),
        version: version("1.0.0"),
        available_versions: vec![version("1.0.0"), version("1.5.0")],
        dependencies: Vec::new(),
        role: chips_cordis::PluginRole::Service,
        parent: None,
        runner: TestRunner::ok("chips.test.pending-dep"),
    };
    kernel.load(pending).await.expect("提供方应可加载");
    let state = kernel
        .load(request(
            "chips.test.pending-consumer",
            "1.0.0",
            vec![spec("chips.test.pending-dep", "^1.5.0")],
            TestRunner::ok("chips.test.pending-consumer"),
        ))
        .await
        .expect("版本暂不满足不是失败");
    assert_eq!(state, PluginState::Pending);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_disable_with_active_dependents_rejected_then_cascade() {
    let kernel = default_kernel();
    let provider = TestRunner::with_apply(
        "chips.test.base",
        vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
            ctx.provide("base".to_owned(), 1_u32)?;
            Ok(())
        }))],
    );
    let consumer = TestRunner::with_apply(
        "chips.test.dependent",
        vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
            ctx.inject(&["base".to_owned()], |_ctx: &Context| {})?;
            Ok(())
        }))],
    );

    kernel
        .load(request("chips.test.base", "1.0.0", Vec::new(), provider))
        .await
        .expect("提供方应可加载");
    kernel
        .load(request(
            "chips.test.dependent",
            "1.0.0",
            vec![spec("chips.test.base", "^1.0.0")],
            consumer,
        ))
        .await
        .expect("依赖方应可加载");

    let error = kernel
        .disable("chips.test.base", false)
        .await
        .expect_err("存在 Active 依赖者时应拒绝");
    assert_eq!(error.code(), "KERNEL_DEPENDENCY_CONFLICT");
    assert_eq!(
        kernel.plugin_state("chips.test.base"),
        Some(PluginState::Active)
    );

    kernel
        .disable("chips.test.base", true)
        .await
        .expect("显式级联应成功");
    assert_eq!(
        kernel.plugin_state("chips.test.dependent"),
        Some(PluginState::Installed)
    );
    assert_eq!(
        kernel.plugin_state("chips.test.base"),
        Some(PluginState::Installed)
    );
    assert_eq!(kernel.context_count(), 1);
    assert_eq!(kernel.service_count(), 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_unload_requires_no_dependents_and_terminal_state() {
    let kernel = default_kernel();
    kernel
        .load(request(
            "chips.test.base",
            "1.0.0",
            Vec::new(),
            TestRunner::ok("chips.test.base"),
        ))
        .await
        .expect("提供方应可加载");
    kernel
        .load(request(
            "chips.test.dependent",
            "1.0.0",
            vec![spec("chips.test.base", "^1.0.0")],
            TestRunner::ok("chips.test.dependent"),
        ))
        .await
        .expect("依赖方应可加载");

    let error = kernel
        .unload("chips.test.base")
        .await
        .expect_err("Active 状态卸载应先停用");
    assert_eq!(error.code(), "KERNEL_INVALID_TRANSITION");

    kernel
        .disable("chips.test.base", true)
        .await
        .expect("级联停用应成功");

    let error = kernel
        .unload("chips.test.base")
        .await
        .expect_err("存在依赖者时应拒绝卸载");
    assert_eq!(error.code(), "KERNEL_DEPENDENCY_CONFLICT");

    kernel
        .unload("chips.test.dependent")
        .await
        .expect("依赖方卸载应成功");
    kernel
        .unload("chips.test.base")
        .await
        .expect("提供方卸载应成功");
    assert_eq!(
        kernel.plugin_state("chips.test.base"),
        Some(PluginState::Removed)
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_context_disposed_and_children_disposed_first() {
    let kernel = default_kernel();
    let log: Arc<Mutex<Vec<&'static str>>> = Arc::new(Mutex::new(Vec::new()));
    let context_slot: Arc<Mutex<Option<Context>>> = Arc::new(Mutex::new(None));
    let child_slot: Arc<Mutex<Option<Context>>> = Arc::new(Mutex::new(None));

    let apply_log = Arc::clone(&log);
    let apply_slot = Arc::clone(&context_slot);
    let apply_child_slot = Arc::clone(&child_slot);
    let runner = TestRunner::with_apply(
        "chips.test.scope",
        vec![ApplyStep::Run(Arc::new(move |ctx: &Context, _config| {
            let child = ctx.create_child()?;
            let child_log = Arc::clone(&apply_log);
            child.effect(move || {
                child_log.lock().expect("锁可用").push("child");
            })?;
            let first_log = Arc::clone(&apply_log);
            ctx.effect(move || {
                first_log.lock().expect("锁可用").push("plugin-1");
            })?;
            let second_log = Arc::clone(&apply_log);
            ctx.effect(move || {
                second_log.lock().expect("锁可用").push("plugin-2");
            })?;
            *apply_slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
            *apply_child_slot
                .lock()
                .map_err(|_| KernelError::LockPoisoned)? = Some(child);
            Ok(())
        }))],
    );

    kernel
        .load(request("chips.test.scope", "1.0.0", Vec::new(), runner))
        .await
        .expect("加载应成功");
    assert_eq!(kernel.context_count(), 3, "根、插件与子 Context");

    let plugin_ctx = context_slot
        .lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存 Context");
    let child = child_slot
        .lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存子 Context");
    assert_eq!(
        kernel.plugin_of_context(plugin_ctx.id()).as_deref(),
        Some("chips.test.scope")
    );
    assert_eq!(
        kernel.plugin_of_context(child.id()).as_deref(),
        Some("chips.test.scope")
    );

    kernel
        .disable("chips.test.scope", false)
        .await
        .expect("停用应成功");

    assert_eq!(
        log.lock().expect("锁可用").as_slice(),
        ["child", "plugin-2", "plugin-1"],
        "先子后本、自身 LIFO"
    );
    assert_eq!(kernel.context_count(), 1);
    let error = plugin_ctx
        .get("anything")
        .expect_err("已销毁 Context 应拒绝访问");
    assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    let error = child.get("anything").expect_err("子 Context 应已销毁");
    assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    assert!(
        kernel.plugin_last_error("chips.test.scope").is_none(),
        "正常停用不产生诊断"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_enable_installed_plugin_returns_to_active() {
    let kernel = default_kernel();
    let runner = TestRunner::with_apply(
        "chips.test.re-enable",
        vec![
            ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
                ctx.provide("re-enable".to_owned(), 1_u32)?;
                Ok(())
            })),
            ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
                ctx.provide("re-enable".to_owned(), 2_u32)?;
                Ok(())
            })),
        ],
    );
    kernel
        .load(request("chips.test.re-enable", "1.0.0", Vec::new(), runner))
        .await
        .expect("加载应成功");
    kernel
        .disable("chips.test.re-enable", false)
        .await
        .expect("停用应成功");

    let state = kernel
        .enable("chips.test.re-enable")
        .await
        .expect("重新启用应成功");
    assert_eq!(state, PluginState::Active);
    assert!(
        kernel
            .get_service(kernel.root_context().id(), "re-enable")
            .is_ok(),
        "重新启用后服务应可解析"
    );
    assert_eq!(kernel.service_count(), 1);

    let error = kernel
        .enable("chips.test.unknown")
        .await
        .expect_err("未知插件应报错");
    assert_eq!(error.code(), "KERNEL_PLUGIN_NOT_FOUND");
}
