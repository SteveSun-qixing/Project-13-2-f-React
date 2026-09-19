//! 事件总线投递边界集成测试。
//!
//! 覆盖《薯片内核设计》§8.2（监听表以快照投递：投递途中退订的监听器不得被
//! 调用）、§8.4 与 §9.2（插件监听器 panic 必须捕获、归因到归属插件，且不中断
//! 同批其它监听器的投递）、§3.3 规则 3（发布方 Context 在投递途中销毁后，
//! 后续监听器不得再拿到失效句柄）。
//!
//! 与 `kernel_events_tasks.rs` 的分工：该文件验证发布/订阅正常路径、递归深度
//! 上限与配额，本文件只验证投递循环内的三类异常分支。

mod common;

use std::sync::atomic::Ordering;
use std::sync::Arc;

use chips_cordis::{Context, EventPayload, KernelError, ListenerOptions, PluginState};

use common::{bump, counter, default_kernel, request, ApplyStep, TestRunner};

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_unsubscribe_during_dispatch_skips_dead_entry_in_live_snapshot() {
    // §8.2 规则 2：投递使用进入投递点时取定的监听表快照；快照内的条目被
    // 退订后只置失效标记，循环必须跳过失效条目而不得调用它。
    let kernel = default_kernel();
    let root = kernel.root_context();
    let victim_hits = counter();
    let remover_hits = counter();

    let victim_handler = Arc::clone(&victim_hits);
    let victim_token = root
        .on(
            "cov:stream",
            move |_ctx: &Context, _payload: &EventPayload| {
                bump(&victim_handler);
                Ok(())
            },
        )
        .expect("监听器应可注册");
    // 前插：保证快照顺序为 [退订者, 被退订者]，同一次投递内即可观察到失效跳过。
    let remover = Arc::clone(&remover_hits);
    root.on_with_options(
        "cov:stream",
        move |ctx: &Context, _payload: &EventPayload| {
            bump(&remover);
            ctx.off(victim_token)?;
            Ok(())
        },
        ListenerOptions {
            once: false,
            prepend: true,
        },
    )
    .expect("前插监听器应可注册");

    root.emit("cov:stream", serde_json::json!({ "round": 1 }))
        .expect("投递不应因退订而失败");
    assert_eq!(
        remover_hits.load(Ordering::SeqCst),
        1,
        "退订者必须收到本次事件"
    );
    assert_eq!(
        victim_hits.load(Ordering::SeqCst),
        0,
        "同一快照中的已退订监听器不得被调用"
    );

    root.emit("cov:stream", serde_json::json!({ "round": 2 }))
        .expect("第二次投递不应因退订而失败");
    assert_eq!(
        remover_hits.load(Ordering::SeqCst),
        2,
        "退订者的订阅保持不变"
    );
    assert_eq!(
        victim_hits.load(Ordering::SeqCst),
        0,
        "退订对新快照同样生效，监听器不得复活"
    );

    // §8.2：重复退订保持幂等，不得报错。
    root.off(victim_token)
        .expect("§8.2：重复退订保持幂等，不得报错");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_panicking_plugin_listener_is_attributed_and_does_not_stop_delivery() {
    // §9.2：插件代码 panic 必须被捕获并归一为 `KERNEL_PLUGIN_PANICKED`，
    // 且错误里要带上归属插件 ID（`plugin_of_fork`）；§8.4：单个监听器故障
    // 不得中断同一事件后续监听器的投递，只上报首个错误。
    let kernel = default_kernel();
    let root = kernel.root_context();
    let healthy_hits = counter();
    let witness = Arc::clone(&healthy_hits);

    kernel
        .load(request(
            "chips.test.boomer",
            "1.0.0",
            Vec::new(),
            TestRunner::with_apply(
                "chips.test.boomer",
                vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
                    // 插件自有事件域必须与插件 ID 末段一致（§8.1）。
                    ctx.on("boomer:explode", |_ctx: &Context, _payload| {
                        panic!("插件监听器内部故障");
                    })?;
                    Ok(())
                }))],
            ),
        ))
        .await
        .expect("插件应可加载");
    assert_eq!(
        kernel.plugin_state("chips.test.boomer"),
        Some(PluginState::Active)
    );

    root.on("boomer:explode", move |_ctx: &Context, _payload| {
        bump(&witness);
        Ok(())
    })
    .expect("健康监听器应可注册");

    let error = root
        .emit("boomer:explode", serde_json::json!({ "reason": "cov" }))
        .expect_err("监听器 panic 必须回传错误");
    assert_eq!(
        error.code(),
        "KERNEL_PLUGIN_PANICKED",
        "§9.1：插件代码 panic 归一为 KERNEL_PLUGIN_PANICKED"
    );
    assert!(
        matches!(&error, KernelError::PluginPanicked { id } if id == "chips.test.boomer"),
        "错误必须携带归属插件 ID，实际：{error:?}"
    );
    assert_eq!(
        healthy_hits.load(Ordering::SeqCst),
        1,
        "§8.4：panic 不得中断同一事件后续监听器的投递"
    );

    // 递归深度守卫随 panic 展开释放：再次投递仍走正常深度预算。
    let error = root
        .emit("boomer:explode", serde_json::json!({ "reason": "cov" }))
        .expect_err("第二次投递同样回传 panic 错误");
    assert_eq!(
        error.code(),
        "KERNEL_PLUGIN_PANICKED",
        "深度计数若因 panic 泄漏，第二次投递会误报 KERNEL_EVENT_DEPTH_EXCEEDED"
    );
    assert_eq!(healthy_hits.load(Ordering::SeqCst), 2);
    assert_eq!(
        kernel.plugin_state("chips.test.boomer"),
        Some(PluginState::Active),
        "监听器 panic 的归因由调用方处理，不得静默改写插件状态"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_listener_cannot_get_handle_of_emitter_disposed_midway() {
    // §3.3 规则 3 + §8.2：发布方 Context 在投递途中销毁后，同一批次的后续
    // 监听器不得再获得其句柄；投递以 KERNEL_CONTEXT_DISPOSED 收尾。
    let kernel = default_kernel();
    let root = kernel.root_context();
    let child = root.create_child().expect("子作用域应可创建");
    let late_hits = counter();
    let witness = Arc::clone(&late_hits);

    child
        .on("cov:withdraw", move |ctx: &Context, _payload| {
            // 首个监听器销毁发布方自身。
            ctx.dispose()?;
            Ok(())
        })
        .expect("子作用域监听器应可注册");
    root.on("cov:withdraw", move |_ctx: &Context, _payload| {
        bump(&witness);
        Ok(())
    })
    .expect("根作用域监听器应可注册");
    let child_id = child.id();

    let error = child
        .emit("cov:withdraw", serde_json::json!({}))
        .expect_err("发布方中途销毁必须回传错误");
    assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    assert_eq!(
        late_hits.load(Ordering::SeqCst),
        0,
        "已销毁的发布 Context 不得继续传给后续监听器"
    );
    assert!(
        kernel.context_state(child_id).is_none(),
        "子 Context 应已从发布快照中移除"
    );
    let error = child
        .emit("cov:withdraw", serde_json::json!({}))
        .expect_err("销毁后的 Context 不得再发布事件");
    assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
}
