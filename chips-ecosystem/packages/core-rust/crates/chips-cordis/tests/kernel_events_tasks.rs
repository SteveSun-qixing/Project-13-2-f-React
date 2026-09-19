//! 事件总线与后台任务集成测试：广播语义、快照隔离、深度与配额、任务取消。

mod common;

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chips_cordis::{
    Context, Event, KernelError, ListenerOptions, PluginState, TaskHandle, TaskOptions,
};

use common::{counter, default_kernel, request, wait_for, ApplyStep, RecordingSink, TestRunner};

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_event_fifo_once_prepend_and_snapshot_isolation() {
    let kernel = default_kernel();
    let root = kernel.root_context();
    let order: Arc<Mutex<Vec<&'static str>>> = Arc::new(Mutex::new(Vec::new()));
    let late_added = Arc::new(AtomicBool::new(false));

    let record = |order: &Arc<Mutex<Vec<&'static str>>>, value: &'static str| {
        let order = Arc::clone(order);
        move |_ctx: &Context, _payload: &serde_json::Value| {
            order
                .lock()
                .map_err(|_| KernelError::LockPoisoned)?
                .push(value);
            Ok(())
        }
    };

    root.on("test:evt", record(&order, "a"))
        .expect("订阅应成功");
    root.on("test:evt", {
        let order = Arc::clone(&order);
        let late_added = Arc::clone(&late_added);
        move |ctx: &Context, _payload: &serde_json::Value| {
            if !late_added.swap(true, Ordering::SeqCst) {
                ctx.on("test:evt", record(&order, "late"))?;
            }
            order
                .lock()
                .map_err(|_| KernelError::LockPoisoned)?
                .push("b");
            Ok(())
        }
    })
    .expect("订阅应成功");
    root.once("test:evt", record(&order, "once"))
        .expect("订阅应成功");
    root.on_with_options(
        "test:evt",
        record(&order, "prepend"),
        ListenerOptions {
            once: false,
            prepend: true,
        },
    )
    .expect("订阅应成功");

    root.emit("test:evt", serde_json::json!(1))
        .expect("发布应成功");
    assert_eq!(
        order.lock().expect("锁可用").as_slice(),
        ["prepend", "a", "b", "once"],
        "prepend 前插、注册顺序 FIFO、once 仅一次；派发期间新增监听器本次不生效"
    );

    root.emit("test:evt", serde_json::json!(2))
        .expect("发布应成功");
    assert_eq!(
        order.lock().expect("锁可用").as_slice(),
        ["prepend", "a", "b", "once", "prepend", "a", "b", "late"]
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_event_depth_limit_reports_error() {
    let kernel = default_kernel();
    let root = kernel.root_context();
    let attempts = counter();
    let error_slot: Arc<Mutex<Option<KernelError>>> = Arc::new(Mutex::new(None));

    let handler_attempts = Arc::clone(&attempts);
    let handler_error = Arc::clone(&error_slot);
    root.on(
        "test:deep",
        move |ctx: &Context, _payload: &serde_json::Value| {
            handler_attempts.fetch_add(1, Ordering::SeqCst);
            if let Err(error) = ctx.emit("test:deep", serde_json::json!(null)) {
                if let Ok(mut slot) = handler_error.lock() {
                    *slot = Some(error);
                }
            }
            Ok(())
        },
    )
    .expect("订阅应成功");

    root.emit("test:deep", serde_json::json!(null))
        .expect("最外层发布应成功");
    let error = error_slot
        .lock()
        .expect("锁可用")
        .clone()
        .expect("递归发布应触发深度限制");
    assert_eq!(error.code(), "KERNEL_EVENT_DEPTH_EXCEEDED");
    assert!(attempts.load(Ordering::SeqCst) >= 64);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_event_domain_enforcement_and_source_rewrite() {
    let kernel = default_kernel();
    let root = kernel.root_context();

    let plugin_ctx: Arc<Mutex<Option<Context>>> = Arc::new(Mutex::new(None));
    let plugin = TestRunner::with_apply(
        "chips.test.events",
        vec![ApplyStep::Run(Arc::new({
            let slot = Arc::clone(&plugin_ctx);
            move |ctx: &Context, _config| {
                *slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                Ok(())
            }
        }))],
    );
    kernel
        .load(request("chips.test.events", "1.0.0", Vec::new(), plugin))
        .await
        .expect("插件应可加载");

    let sink = Arc::new(RecordingSink::default());
    let token = root
        .on_queued(
            "events:ping",
            Arc::clone(&sink) as Arc<dyn chips_cordis::EventSink>,
            ListenerOptions::default(),
        )
        .expect("订阅应成功");

    let ctx = plugin_ctx
        .lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存 Context");
    assert!(ctx.emit("events:ping", serde_json::json!({})).is_ok());
    assert_eq!(
        ctx.emit("document:changed", serde_json::json!({}))
            .expect_err("插件不得发布保留域事件")
            .code(),
        "KERNEL_INVALID_NAME"
    );
    assert_eq!(
        ctx.emit("other:changed", serde_json::json!({}))
            .expect_err("插件不得发布非自有域事件")
            .code(),
        "KERNEL_INVALID_NAME"
    );
    assert_eq!(
        ctx.emit("invalid", serde_json::json!({}))
            .expect_err("非法事件名应被拒绝")
            .code(),
        "KERNEL_INVALID_NAME"
    );
    assert!(
        root.emit("document:changed", serde_json::json!({})).is_ok(),
        "平台可发布保留域事件"
    );

    let events = sink.events();
    assert_eq!(events.len(), 1, "仅 events:ping 应入队");
    let event = &events[0];
    assert_eq!(event.name, "events:ping");
    assert_eq!(event.source, "chips.test.events", "source 按调用上下文重写");
    assert_eq!(event.id.len(), 26, "事件信封应携带 ULID");
    assert!(event.timestamp > 0);

    root.off(token).expect("退订应成功");
    assert!(ctx.emit("events:ping", serde_json::json!({})).is_ok());
    assert_eq!(sink.len(), 1, "退订后不得再入队");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_queued_sink_is_kernel_sourced_for_platform_events() {
    let kernel = default_kernel();
    let root = kernel.root_context();
    let sink = Arc::new(RecordingSink::default());
    root.on_queued(
        "plugin:loaded",
        Arc::clone(&sink) as Arc<dyn chips_cordis::EventSink>,
        ListenerOptions::default(),
    )
    .expect("订阅应成功");

    kernel
        .load(request(
            "chips.test.sink",
            "2.0.0",
            Vec::new(),
            TestRunner::ok("chips.test.sink"),
        ))
        .await
        .expect("加载应成功");

    let events: Vec<Event> = sink.events();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].source, "chips.kernel");
    assert_eq!(events[0].payload["pluginId"], "chips.test.sink");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_task_registration_cancellation_and_join() {
    let kernel = default_kernel();
    let handle_slot: Arc<Mutex<Option<TaskHandle>>> = Arc::new(Mutex::new(None));
    let quick_slot: Arc<Mutex<Option<TaskHandle>>> = Arc::new(Mutex::new(None));
    let runner = TestRunner::with_apply(
        "chips.test.tasks",
        vec![ApplyStep::Run(Arc::new({
            let handle_slot = Arc::clone(&handle_slot);
            let quick_slot = Arc::clone(&quick_slot);
            move |ctx: &Context, _config| {
                let handle = ctx.task(
                    async {
                        loop {
                            tokio::time::sleep(Duration::from_millis(5)).await;
                        }
                    },
                    TaskOptions {
                        name: Some("background".to_owned()),
                        signal: None,
                    },
                )?;
                *handle_slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(handle);

                let quick = ctx.task(
                    async {},
                    TaskOptions {
                        name: Some("quick".to_owned()),
                        signal: None,
                    },
                )?;
                *quick_slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(quick);
                Ok(())
            }
        }))],
    );
    kernel
        .load(request("chips.test.tasks", "1.0.0", Vec::new(), runner))
        .await
        .expect("加载应成功");

    let quick = quick_slot
        .lock()
        .expect("锁可用")
        .clone()
        .expect("应保存快捷任务句柄");
    quick.join().await.expect("已完成任务应可等待成功");

    let handle = handle_slot
        .lock()
        .expect("锁可用")
        .clone()
        .expect("应保存后台任务句柄");
    assert!(!handle.is_finished());

    let started = std::time::Instant::now();
    kernel
        .disable("chips.test.tasks", false)
        .await
        .expect("停用应成功");
    assert!(
        started.elapsed() < Duration::from_secs(5),
        "协作式取消应及时完成"
    );
    assert!(handle.is_finished(), "Fork 撤销应取消并等待任务退出");
    let error = handle.join().await.expect_err("被取消的任务应返回错误");
    assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    assert_eq!(
        kernel.plugin_state("chips.test.tasks"),
        Some(PluginState::Installed)
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_task_quota_exceeded_is_reported() {
    let kernel = default_kernel();
    let quota_error: Arc<Mutex<Option<KernelError>>> = Arc::new(Mutex::new(None));
    let runner = TestRunner::with_apply(
        "chips.test.task-quota",
        vec![ApplyStep::Run(Arc::new({
            let slot = Arc::clone(&quota_error);
            move |ctx: &Context, _config| {
                for index in 0..33 {
                    let result = ctx.task(
                        async {
                            tokio::time::sleep(Duration::from_secs(10)).await;
                        },
                        TaskOptions {
                            name: Some(format!("task-{index}")),
                            signal: None,
                        },
                    );
                    if let Err(error) = result {
                        *slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(error);
                    }
                }
                Ok(())
            }
        }))],
    );
    kernel
        .load(request(
            "chips.test.task-quota",
            "1.0.0",
            Vec::new(),
            runner,
        ))
        .await
        .expect("加载应成功");
    let error = quota_error
        .lock()
        .expect("锁可用")
        .clone()
        .expect("第 33 个任务应触发配额");
    assert_eq!(error.code(), "KERNEL_QUOTA_EXCEEDED");

    kernel
        .disable("chips.test.task-quota", false)
        .await
        .expect("停用应成功");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_message_rate_quota_is_enforced_per_plugin() {
    let kernel = default_kernel();
    let plugin_ctx: Arc<Mutex<Option<Context>>> = Arc::new(Mutex::new(None));
    let runner = TestRunner::with_apply(
        "chips.test.rate",
        vec![ApplyStep::Run(Arc::new({
            let slot = Arc::clone(&plugin_ctx);
            move |ctx: &Context, _config| {
                *slot.lock().map_err(|_| KernelError::LockPoisoned)? = Some(ctx.clone());
                Ok(())
            }
        }))],
    );
    kernel
        .load(request("chips.test.rate", "1.0.0", Vec::new(), runner))
        .await
        .expect("加载应成功");
    let ctx = plugin_ctx
        .lock()
        .expect("锁可用")
        .clone()
        .expect("apply 应保存 Context");

    let allowed = AtomicUsize::new(0);
    let mut rejected_code = String::new();
    for index in 0..201 {
        match ctx.emit("rate:ping", serde_json::json!(index)) {
            Ok(()) => {
                allowed.fetch_add(1, Ordering::SeqCst);
            }
            Err(error) => {
                rejected_code = error.code().to_owned();
            }
        }
    }
    assert_eq!(
        allowed.load(Ordering::SeqCst),
        200,
        "每秒 200 次消息速率配额"
    );
    assert_eq!(rejected_code, "KERNEL_QUOTA_EXCEEDED");

    // 插件停用后配额计数随生命周期回收，重新启用可再次发布。
    kernel
        .disable("chips.test.rate", false)
        .await
        .expect("停用应成功");
    assert!(
        wait_for(|| kernel.plugin_state("chips.test.rate") == Some(PluginState::Installed)).await
    );
}
