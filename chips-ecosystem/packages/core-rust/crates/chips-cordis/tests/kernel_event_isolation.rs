//! 事件派发隔离与任务取消集成测试。
//!
//! 覆盖《薯片内核设计》§8.2 快照隔离（派发期间的退订与销毁不得影响本轮迭代，
//! 但已失效监听器必须被跳过）、§8.3 监听器错误隔离（单个监听器失败不阻断其余，
//! 首个错误回传）、§8.1 事件信封与归属插件（panic 归因），以及 §10.4
//! 任务协作式取消的显式句柄入口。
//!
//! 与 `kernel_events_tasks.rs` 的分工：该文件验证 FIFO/once/深度/配额主路径，
//! 本文件专测派发期间的失效跳过与错误归因分支。

mod common;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chips_cordis::{
    Context, ContextState, KernelError, ListenerOptions, PluginState, TaskHandle, TaskOptions,
};

use common::{bump, counter, default_kernel, request, wait_for, ApplyStep, TestRunner};

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_listener_unsubscribed_mid_dispatch_is_skipped() {
    // §8.2：派发扬程持有监听表快照；期间被退订的监听器仍留在快照里，
    // 但必须因失效标记被跳过，其余监听器照常收到本轮事件。
    let kernel = default_kernel();
    let root = kernel.root_context();
    let victim = counter();
    let witness = counter();

    let victim_token = root
        .on("audit:broadcast", {
            let victim = Arc::clone(&victim);
            move |_ctx: &Context, _payload: &serde_json::Value| {
                bump(&victim);
                Ok(())
            }
        })
        .expect("订阅应成功");
    root.on("audit:broadcast", {
        let witness = Arc::clone(&witness);
        move |_ctx: &Context, _payload: &serde_json::Value| {
            bump(&witness);
            Ok(())
        }
    })
    .expect("订阅应成功");
    // prepend 保证移除器在本轮最先执行，从而在快照内制造"已失效"条目。
    root.on_with_options(
        "audit:broadcast",
        move |ctx: &Context, _payload: &serde_json::Value| {
            ctx.off(victim_token).expect("退订应成功");
            Ok(())
        },
        ListenerOptions {
            once: false,
            prepend: true,
        },
    )
    .expect("订阅应成功");

    root.emit("audit:broadcast", serde_json::json!(null))
        .expect("发布应成功");
    assert_eq!(victim.load(Ordering::SeqCst), 0, "已退订监听器不得执行");
    assert_eq!(witness.load(Ordering::SeqCst), 1, "其余监听器应照常收到");

    // 幂等退订：token 已不存在时返回成功且不改变监听表。
    root.off(victim_token).expect("重复退订应幂等");
    root.emit("audit:broadcast", serde_json::json!(null))
        .expect("二次发布应成功");
    assert_eq!(victim.load(Ordering::SeqCst), 0);
    assert_eq!(witness.load(Ordering::SeqCst), 2);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_panicking_listener_is_attributed_and_other_listeners_survive() {
    // §8.3：监听器 panic 记为 `KERNEL_PLUGIN_PANICKED`，首个错误回传发布方，
    // 但不得中断其余监听器；§8.1：归属插件按监听器所在 Fork 反查，
    // 平台 Context 上的监听器归因到保留源 `chips.kernel`。
    let kernel = default_kernel();
    let root = kernel.root_context();
    let survivor = counter();
    let plugin_slot: Arc<Mutex<Option<Context>>> = Arc::new(Mutex::new(None));

    let plugin = TestRunner::with_apply(
        "chips.cov.audit",
        vec![ApplyStep::Run(Arc::new({
            let plugin_slot = Arc::clone(&plugin_slot);
            move |ctx: &Context, _config| {
                ctx.on("audit:poke", |_ctx: &Context, _payload| {
                    panic!("插件监听器内部故障");
                })?;
                *plugin_slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                Ok(())
            }
        }))],
    );
    kernel
        .load(request("chips.cov.audit", "1.0.0", Vec::new(), plugin))
        .await
        .expect("插件应加载");

    root.on("audit:poke", {
        let survivor = Arc::clone(&survivor);
        move |_ctx: &Context, _payload: &serde_json::Value| {
            bump(&survivor);
            Ok(())
        }
    })
    .expect("订阅应成功");

    let plugin_ctx = plugin_slot
        .lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存 Context 句柄");
    let panicking = plugin_ctx
        .emit("audit:poke", serde_json::json!(null))
        .expect_err("监听器 panic 应把首个错误回传发布方");
    assert_eq!(panicking.code(), "KERNEL_PLUGIN_PANICKED");
    assert!(
        panicking.to_string().contains("chips.cov.audit"),
        "插件 Context 上的监听器应归因到归属插件，实际：{panicking}"
    );
    assert_eq!(
        survivor.load(Ordering::SeqCst),
        1,
        "§8.3：单个监听器失败不得中断本轮派发"
    );
    assert_eq!(
        kernel.plugin_state("chips.cov.audit"),
        Some(PluginState::Active),
        "监听器 panic 不得连带停用插件"
    );

    // 平台 Context 上的监听器没有归属插件，必须回落到保留源。
    root.on("audit:probe", |_ctx: &Context, _payload| {
        panic!("平台监听器内部故障");
    })
    .expect("订阅应成功");
    let platform_panic = root
        .emit("audit:probe", serde_json::json!(null))
        .expect_err("平台监听器 panic 应回传错误");
    assert_eq!(platform_panic.code(), "KERNEL_PLUGIN_PANICKED");
    assert!(
        platform_panic
            .to_string()
            .contains(chips_cordis::KERNEL_SOURCE),
        "无归属插件的监听器应归因到保留源，实际：{platform_panic}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_listener_after_emitting_context_disposal_reports_disposal() {
    // §8.2：派发期间发布方 Context 被销毁时，后续监听器不得拿到失效句柄，
    // 内核按 `KERNEL_CONTEXT_DISPOSED` 归因并保持错误隔离。
    let kernel = default_kernel();
    let root = kernel.root_context();
    let survivor = counter();

    let child = root.create_child().expect("子 Context 应可创建");
    root.on_with_options(
        "audit:vanish",
        |ctx: &Context, _payload: &serde_json::Value| {
            ctx.dispose().expect("发布方 Context 应可销毁");
            Ok(())
        },
        ListenerOptions {
            once: false,
            prepend: true,
        },
    )
    .expect("订阅应成功");
    root.on("audit:vanish", {
        let survivor = Arc::clone(&survivor);
        move |_ctx: &Context, _payload: &serde_json::Value| {
            bump(&survivor);
            Ok(())
        }
    })
    .expect("订阅应成功");

    let error = child
        .emit("audit:vanish", serde_json::json!(null))
        .expect_err("发布方销毁后后续监听器应报错");
    assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    assert_eq!(
        survivor.load(Ordering::SeqCst),
        0,
        "失效发布方上下文不得再驱动监听器执行"
    );
    assert_eq!(
        child.state(),
        ContextState::Disposed,
        "销毁必须幂等地完成状态推进"
    );
    child.dispose().expect("重复销毁应幂等");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_task_handle_cancel_stops_task_and_is_idempotent() {
    // §10.4：任务句柄的显式取消入口与 Fork 撤销共用同一协作式信号；
    // 取消后 `join` 返回取消错误，且取消操作幂等。
    let kernel = default_kernel();
    let handle_slot: Arc<Mutex<Option<TaskHandle>>> = Arc::new(Mutex::new(None));
    let plugin_slot: Arc<Mutex<Option<Context>>> = Arc::new(Mutex::new(None));
    let started = Arc::new(AtomicBool::new(false));
    let runner = TestRunner::with_apply(
        "chips.test.canceller",
        vec![ApplyStep::Run(Arc::new({
            let handle_slot = Arc::clone(&handle_slot);
            let plugin_slot = Arc::clone(&plugin_slot);
            let started = Arc::clone(&started);
            move |ctx: &Context, _config| {
                let started_flag = Arc::clone(&started);
                let handle = ctx.task(
                    async move {
                        started_flag.store(true, Ordering::SeqCst);
                        tokio::time::sleep(Duration::from_secs(30)).await;
                    },
                    TaskOptions {
                        name: Some("explicit-cancel".to_owned()),
                        signal: None,
                    },
                )?;
                *handle_slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(handle);
                *plugin_slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                Ok(())
            }
        }))],
    );
    kernel
        .load(request("chips.test.canceller", "1.0.0", Vec::new(), runner))
        .await
        .expect("加载应成功");

    let handle = handle_slot
        .lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存任务句柄");
    assert!(
        wait_for(|| started.load(Ordering::SeqCst)).await,
        "任务应已开始执行"
    );
    handle.cancel();
    handle.cancel();
    assert!(
        wait_for(|| handle.is_finished()).await,
        "显式取消后任务应退出"
    );
    let error = handle.join().await.expect_err("被取消的任务应返回错误");
    assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    assert_eq!(
        handle
            .join()
            .await
            .expect_err("重复 join 应返回同一取消结论")
            .code(),
        "KERNEL_CONTEXT_DISPOSED"
    );
    assert_eq!(
        kernel.plugin_state("chips.test.canceller"),
        Some(PluginState::Active),
        "任务取消不影响插件状态"
    );

    // 取消即时释放活跃任务额度：同一插件 Context 仍可继续登记新任务。
    let plugin_ctx = plugin_slot
        .lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存 Context 句柄");
    let follow_up = plugin_ctx
        .task(
            async {},
            TaskOptions {
                name: Some("after-cancel".to_owned()),
                signal: None,
            },
        )
        .expect("取消后应可继续登记任务");
    follow_up.join().await.expect("瞬时任务应正常完成");

    kernel
        .disable("chips.test.canceller", false)
        .await
        .expect("停用应成功");
}
