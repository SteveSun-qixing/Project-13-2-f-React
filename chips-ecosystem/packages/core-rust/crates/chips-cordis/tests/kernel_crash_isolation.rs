//! §6.8 崩溃隔离集成测试（工单047 臂①）：插件运行体在 Rust 侧 panic 不得
//! 拖垮内核。判定路径（`apply`）与清理路径（`stop`）都必须收敛到明确终态：
//! 应答收敛、状态机离开中间态、诊断在案，命令循环照常服务后续命令。
//!
//! 与 `command.rs` 单元测试的分工：单元测试核对链尾善后三件套的内部形态
//! （`queued` / `in_flight` 残留、`resume_pending` 驱动），本文件只经公开
//! API 验证端到端契约与内核存活。

mod common;

use std::sync::Arc;
use std::time::Duration;

use chips_cordis::{Context, KernelError, PluginConfig, PluginRunner, PluginState};

use common::{default_kernel, request, wait_for, ApplyStep, StopStep, TestRunner};

/// 在指定回调面注入 Rust 侧 panic 的执行器。
struct PanicRunner {
    panic_on_apply: bool,
    panic_on_stop: bool,
}

#[async_trait::async_trait]
impl PluginRunner for PanicRunner {
    async fn apply(&self, _ctx: &Context, _config: &PluginConfig) -> Result<(), KernelError> {
        if self.panic_on_apply {
            panic!("测试注入：集成链路 apply panic");
        }
        Ok(())
    }

    async fn stop(&self, _ctx: &Context) -> Result<(), KernelError> {
        if self.panic_on_stop {
            panic!("测试注入：集成链路 stop panic");
        }
        Ok(())
    }
}

/// 带时限的命令调用：崩溃隔离失效时命令链溃灭、应答悬挂，锁测必须以超时
/// 失败收场，而不是让整个测试二进制挂死。
async fn with_deadline<T>(label: &str, fut: impl std::future::Future<Output = T>) -> T {
    tokio::time::timeout(Duration::from_secs(2), fut)
        .await
        .unwrap_or_else(|_| panic!("{label}：应答未在时限内收敛，panic 臂疑似吞掉了善后流程"))
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_apply_panic_converges_and_kernel_stays_functional() {
    let kernel = default_kernel();
    let panic_request = request(
        "chips.test.apply-panic",
        "1.0.0",
        Vec::new(),
        Arc::new(PanicRunner {
            panic_on_apply: true,
            panic_on_stop: false,
        }),
    );

    let error = with_deadline("load(apply panic)", kernel.load(panic_request))
        .await
        .expect_err("apply panic 应经崩溃隔离收敛为失败结果");
    assert_eq!(error.code(), "KERNEL_APPLY_FAILED");
    assert_eq!(
        kernel.plugin_state("chips.test.apply-panic"),
        Some(PluginState::Failed),
        "崩溃插件终态必须是 Failed，不得滞留 Starting"
    );
    let diagnostic = kernel
        .plugin_last_error("chips.test.apply-panic")
        .expect("崩溃必须留下失败诊断");
    assert_eq!(diagnostic.code(), "KERNEL_APPLY_FAILED");
    assert!(diagnostic.retryable(), "§9.1：apply 失败类诊断可重试");

    // 内核存活证明一：后续插件照常走完激活。
    let survivor: Arc<dyn PluginRunner> = TestRunner::new(
        "chips.test.survivor",
        vec![ApplyStep::Run(Arc::new(|ctx: &Context, _| {
            ctx.provide("survivor-service".to_owned(), 7_u32)
        }))],
        Vec::new(),
    );
    kernel
        .load(request(
            "chips.test.survivor",
            "1.0.0",
            Vec::new(),
            survivor,
        ))
        .await
        .expect("崩溃隔离后内核应照常受理加载");
    assert_eq!(
        kernel.plugin_state("chips.test.survivor"),
        Some(PluginState::Active)
    );

    // 内核存活证明二：崩溃插件状态机健康，`Failed` 可直接卸载进入终态。
    kernel
        .unload("chips.test.apply-panic")
        .await
        .expect("Failed 插件应可卸载");
    assert_eq!(
        kernel.plugin_state("chips.test.apply-panic"),
        Some(PluginState::Removed)
    );

    kernel
        .shutdown()
        .await
        .expect("命令循环应在 apply panic 隔离后继续存活");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_stop_panic_disable_reaches_installed_and_kernel_stays_functional() {
    let kernel = default_kernel();
    let panicky: Arc<dyn PluginRunner> = TestRunner::with_stop(
        "chips.test.stop-panic",
        vec![StopStep::Run(Arc::new(|_ctx: &Context| {
            panic!("测试注入：集成链路 stop panic")
        }))],
    );
    kernel
        .load(request(
            "chips.test.stop-panic",
            "1.0.0",
            Vec::new(),
            Arc::clone(&panicky),
        ))
        .await
        .expect("前置激活应成功");

    with_deadline(
        "disable(stop panic)",
        kernel.disable("chips.test.stop-panic", false),
    )
    .await
    .expect("stop panic 不阻断停用（§6.4 规则 2）");
    assert_eq!(
        kernel.plugin_state("chips.test.stop-panic"),
        Some(PluginState::Installed),
        "stop panic 后仍应完成撤销进入 Installed"
    );
    let diagnostic = kernel
        .plugin_last_error("chips.test.stop-panic")
        .expect("stop panic 应记入诊断");
    assert_eq!(diagnostic.code(), "KERNEL_PLUGIN_PANICKED");

    // 撤销不留副作用残留：插件 Fork 的服务随停用摘除。
    assert!(
        wait_for(|| kernel.service_count() == 0).await,
        "停用完成后服务表应无残留"
    );

    // 内核照常受理该插件的重新启用（Installed → Resolving → Starting）。
    let fixed: Arc<dyn PluginRunner> = TestRunner::ok("chips.test.stop-panic");
    kernel
        .load(request("chips.test.stop-panic", "1.0.0", Vec::new(), fixed))
        .await
        .expect("panic 史不应阻碍重新启用");
    assert_eq!(
        kernel.plugin_state("chips.test.stop-panic"),
        Some(PluginState::Active),
        "重新启用后应正常激活"
    );

    kernel
        .shutdown()
        .await
        .expect("命令循环应在 stop panic 隔离后继续存活");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_repeated_apply_panic_keeps_kernel_stable() {
    // 反复崩溃不得击穿内核：每次 apply panic 都独立收敛，命令循环持续存活。
    let kernel = default_kernel();
    for round in 0..4 {
        let id = format!("chips.test.spree-{round}");
        let error = with_deadline(
            "load(spree)",
            kernel.load(request(
                &id,
                "1.0.0",
                Vec::new(),
                Arc::new(PanicRunner {
                    panic_on_apply: true,
                    panic_on_stop: false,
                }),
            )),
        )
        .await
        .expect_err("每轮 apply panic 都应收敛为失败结果");
        assert_eq!(error.code(), "KERNEL_APPLY_FAILED");
        assert_eq!(
            kernel.plugin_state(&id),
            Some(PluginState::Failed),
            "每轮崩溃终态都必须是 Failed"
        );
    }
    // 队列与在飞集合在善后完成后清空（经公开行为侧证：新插件可正常激活）。
    let ok: Arc<dyn PluginRunner> = TestRunner::ok("chips.test.after-spree");
    kernel
        .load(request("chips.test.after-spree", "1.0.0", Vec::new(), ok))
        .await
        .expect("崩溃 spree 后内核应照常受理加载");
    assert!(
        wait_for(|| kernel.plugin_state("chips.test.after-spree") == Some(PluginState::Active))
            .await
    );
    kernel
        .shutdown()
        .await
        .expect("命令循环应在反复崩溃后继续存活");
}
