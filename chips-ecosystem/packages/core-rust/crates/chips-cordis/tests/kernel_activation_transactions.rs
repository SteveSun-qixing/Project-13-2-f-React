//! 激活事务与命令循环分支集成测试。
//!
//! 覆盖《薯片内核设计》§6.2 状态机、§6.3 加载事务性、§6.4 停用与卸载、
//! §6.6 回滚不留残留、§9.2 传播规则中由命令循环承载的分支：
//! 激活窗口内的停用取消、`Pending` 停用与激活链跳过、重复 `load`、
//! `enable` 幂等与终态拒绝、`stop` 回调失败诊断、配置快照失败、
//! 注入回调失败。
//!
//! 与 `kernel_lifecycle.rs` 的分工：该文件验证正常路径与超时策略，
//! 本文件专门验证"命令与激活链并发"时的取消与回滚分支。

mod common;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use chips_cordis::{
    ConfigProvider, Context, Kernel, KernelError, KernelOptions, LoadRequest, PluginConfig,
    PluginId, PluginRole, PluginRunner, PluginState,
};

use common::{default_kernel, request, spec, version, wait_for, ApplyStep, StopStep, TestRunner};

/// 构造一个独立加载请求；重复 `load` 路径需要复用同一个 runner。
fn standalone_request(id: &str, ver: &str, runner: Arc<dyn PluginRunner>) -> LoadRequest {
    LoadRequest {
        id: id.to_owned(),
        version: version(ver),
        available_versions: vec![version(ver)],
        dependencies: Vec::new(),
        role: PluginRole::Service,
        parent: None,
        runner,
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_disable_during_apply_window_rolls_back_to_installed() {
    // §6.2：`Starting` 期间收到停用请求时，apply 返回后按取消回滚到 `Installed`，
    // 不得进入 `Active`；§6.3 规则 5：回滚不留部分注册。
    let kernel = default_kernel();
    let runner: Arc<dyn PluginRunner> = TestRunner::with_apply(
        "chips.test.race",
        vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
            ctx.provide("race-service".to_owned(), 1_u32)?;
            ctx.effect(|| {})?;
            std::thread::sleep(Duration::from_millis(240));
            Ok(())
        }))],
    );

    let loader = {
        let kernel = kernel.clone();
        let runner = Arc::clone(&runner);
        tokio::spawn(async move {
            kernel
                .load(request("chips.test.race", "1.0.0", Vec::new(), runner))
                .await
        })
    };
    assert!(
        wait_for(|| kernel.plugin_state("chips.test.race") == Some(PluginState::Starting)).await,
        "apply 窗口内插件应处于 Starting"
    );
    kernel
        .disable("chips.test.race", false)
        .await
        .expect("Starting 期间的停用请求应被受理");

    let state = loader
        .await
        .expect("激活任务不应 panic")
        .expect("加载应返回状态");
    assert_eq!(
        state,
        PluginState::Installed,
        "取消后的 apply 结果必须丢弃并回滚到 Installed"
    );
    assert_eq!(
        kernel.plugin_state("chips.test.race"),
        Some(PluginState::Installed)
    );
    assert!(
        wait_for(|| kernel.context_count() == 1).await,
        "回滚必须销毁插件 Context"
    );
    assert_eq!(
        kernel.service_count(),
        0,
        "§5.2 规则 3：取消时暂存代际一并丢弃"
    );
    assert!(
        kernel
            .get_typed::<u32>(kernel.root_context().id(), "race-service")
            .is_err(),
        "回滚后服务不得残留"
    );
    assert!(
        kernel.plugin_last_error("chips.test.race").is_none(),
        "取消回滚不是失败，不得留下诊断"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_disable_unknown_installed_and_failed_plugins() {
    // §6.2：`disable` 的入口状态约束——未登记插件报
    // `KERNEL_PLUGIN_NOT_FOUND`，`Installed` 停用幂等成功，`Failed` 停用非法。
    let kernel = default_kernel();

    let error = kernel
        .disable("chips.test.absent", false)
        .await
        .expect_err("未登记插件应报不存在");
    assert_eq!(error.code(), "KERNEL_PLUGIN_NOT_FOUND");

    kernel
        .load(request(
            "chips.test.idle",
            "1.0.0",
            Vec::new(),
            TestRunner::ok("chips.test.idle"),
        ))
        .await
        .expect("加载应成功");
    kernel
        .disable("chips.test.idle", false)
        .await
        .expect("首次停用应成功");
    kernel
        .disable("chips.test.idle", false)
        .await
        .expect("§3.3 规则 4：重复停用幂等");
    assert_eq!(
        kernel.plugin_state("chips.test.idle"),
        Some(PluginState::Installed)
    );

    kernel
        .load(request(
            "chips.test.broken",
            "1.0.0",
            Vec::new(),
            TestRunner::with_apply("chips.test.broken", vec![ApplyStep::Fail]),
        ))
        .await
        .expect_err("apply 失败应返回错误");
    assert_eq!(
        kernel.plugin_state("chips.test.broken"),
        Some(PluginState::Failed)
    );
    let error = kernel
        .disable("chips.test.broken", false)
        .await
        .expect_err("Failed 状态无副作用可停用，应拒绝");
    assert_eq!(error.code(), "KERNEL_INVALID_TRANSITION");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_disabling_pending_plugin_drops_it_from_activation_chain() {
    // §6.2：`Pending → Installed` 是合法取消；激活链遇到已移出队列的插件
    // 直接跳过（不重新激活、不报错）；§6.4 规则 1：`Pending` 停用时清零诊断。
    let kernel = default_kernel();
    let base_runner: Arc<dyn PluginRunner> = TestRunner::with_apply(
        "chips.test.base",
        vec![ApplyStep::Ok, ApplyStep::Sleep(Duration::from_millis(220))],
    );

    kernel
        .load(request(
            "chips.test.base",
            "1.0.0",
            Vec::new(),
            Arc::clone(&base_runner),
        ))
        .await
        .expect("提供方应加载为 Active");
    kernel
        .disable("chips.test.base", false)
        .await
        .expect("无依赖者时停用应成功");
    assert_eq!(
        kernel.plugin_state("chips.test.base"),
        Some(PluginState::Installed)
    );

    // 依赖方入队后激活链为 [base, dependent]：base 的 apply 期间停用 dependent。
    let loader = {
        let kernel = kernel.clone();
        tokio::spawn(async move {
            kernel
                .load(request(
                    "chips.test.dependent",
                    "1.0.0",
                    vec![spec("chips.test.base", "^1.0.0")],
                    TestRunner::ok("chips.test.dependent"),
                ))
                .await
        })
    };
    assert!(
        wait_for(|| kernel.plugin_state("chips.test.base") == Some(PluginState::Starting)).await,
        "链上提供方应进入 Starting"
    );
    assert_eq!(
        kernel.plugin_state("chips.test.dependent"),
        Some(PluginState::Pending),
        "链上依赖方在轮到它之前应保持 Pending"
    );
    kernel
        .disable("chips.test.dependent", false)
        .await
        .expect("Pending 停用应成功");
    assert_eq!(
        kernel.plugin_state("chips.test.dependent"),
        Some(PluginState::Installed)
    );
    assert!(
        kernel.plugin_last_error("chips.test.dependent").is_none(),
        "取消后不得残留等待诊断"
    );

    let state = loader
        .await
        .expect("激活链任务不应 panic")
        .expect("链应正常收敛");
    assert_eq!(
        state,
        PluginState::Installed,
        "被移出队列的依赖方应被跳过，不重新激活"
    );
    assert_eq!(
        kernel.plugin_state("chips.test.base"),
        Some(PluginState::Active),
        "链上其它插件的激活不受影响"
    );
    assert_eq!(kernel.service_count(), 0, "跳过者不得注册服务");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_repeated_load_paths_and_enable_idempotence() {
    // §6.3 规则 4：同一插件重复 `load` 幂等；`Active` 期间的版本变更须先停用；
    // §6.2：`enable` 一个 `Active` 插件直接返回成功，`Removed` 插件报不存在。
    let kernel = default_kernel();
    let runner: Arc<dyn PluginRunner> = TestRunner::ok("chips.test.repeat");
    kernel
        .load(standalone_request(
            "chips.test.repeat",
            "1.0.0",
            Arc::clone(&runner),
        ))
        .await
        .expect("首次加载应成功");
    assert_eq!(
        kernel
            .load(standalone_request(
                "chips.test.repeat",
                "1.0.0",
                Arc::clone(&runner)
            ))
            .await
            .expect("同版本重复加载幂等"),
        PluginState::Active
    );

    let upgraded: Arc<dyn PluginRunner> = TestRunner::ok("chips.test.repeat");
    let error = kernel
        .load(standalone_request(
            "chips.test.repeat",
            "2.0.0",
            Arc::clone(&upgraded),
        ))
        .await
        .expect_err("Active 期间直接换版应被拒绝");
    assert_eq!(error.code(), "KERNEL_INVALID_TRANSITION");
    assert_eq!(
        kernel.plugin_state("chips.test.repeat"),
        Some(PluginState::Active),
        "拒绝换版不得改变运行状态"
    );

    assert_eq!(
        kernel
            .enable("chips.test.repeat")
            .await
            .expect("Active 插件的 enable 应幂等"),
        PluginState::Active
    );

    kernel
        .disable("chips.test.repeat", false)
        .await
        .expect("停用应成功");
    kernel
        .unload("chips.test.repeat")
        .await
        .expect("卸载应成功");
    let error = kernel
        .enable("chips.test.repeat")
        .await
        .expect_err("已移除插件不得再启用");
    assert_eq!(error.code(), "KERNEL_PLUGIN_NOT_FOUND");
    assert_eq!(
        kernel.plugin_state("chips.test.repeat"),
        Some(PluginState::Removed)
    );
    assert!(
        !kernel
            .plugin_ids()
            .contains(&"chips.test.repeat".to_owned()),
        "已移除插件不得出现在登记列表"
    );
    let error = kernel
        .enable("chips.test.unknown")
        .await
        .expect_err("未登记插件不得启用");
    assert_eq!(error.code(), "KERNEL_PLUGIN_NOT_FOUND");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_stop_callback_failure_keeps_plugin_installed_with_diagnostic() {
    // §6.4 规则 2、§9.2：`stop` 回调失败不阻断撤销，插件仍进入 `Installed`，
    // 失败原因记入诊断。
    let kernel = default_kernel();
    kernel
        .load(request(
            "chips.test.stubborn",
            "1.0.0",
            Vec::new(),
            TestRunner::with_stop("chips.test.stubborn", vec![StopStep::Fail]),
        ))
        .await
        .expect("加载应成功");

    kernel
        .disable("chips.test.stubborn", false)
        .await
        .expect("stop 失败不阻断停用");
    assert_eq!(
        kernel.plugin_state("chips.test.stubborn"),
        Some(PluginState::Installed)
    );
    assert_eq!(
        kernel
            .plugin_last_error("chips.test.stubborn")
            .map(|error| error.code().to_owned()),
        Some("KERNEL_APPLY_FAILED".to_owned()),
        "stop 失败原因应进入诊断记录"
    );
    assert_eq!(kernel.context_count(), 1, "撤销必须销毁插件 Context");
    assert_eq!(kernel.service_count(), 0, "撤销必须摘除全部服务条目");
}

/// 对指定插件返回配置快照失败的提供者；其余插件得到空快照。
struct FailingConfigProvider {
    target: PluginId,
}

impl ConfigProvider for FailingConfigProvider {
    fn snapshot(&self, plugin_id: &PluginId) -> Result<PluginConfig, KernelError> {
        if plugin_id == &self.target {
            // 以任意非 `ApplyFailed` 错误码模拟配置层首因：对外错误统一归一为
            // `KERNEL_APPLY_FAILED`，但诊断必须保留配置系统给出的首因码。
            return Err(KernelError::ServiceNotFound {
                name: "config-platform-snapshot".to_owned(),
            });
        }
        Ok(PluginConfig::default())
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_config_snapshot_failure_aborts_before_apply() {
    // §6.1：`apply` 前取一次配置快照；快照失败按加载失败处理，
    // 插件进入 `Failed` 且不得执行 `apply`（§6.6 回滚不留副作用）。
    let provider: Arc<dyn ConfigProvider> = Arc::new(FailingConfigProvider {
        target: "chips.test.config-missing".to_owned(),
    });
    let kernel = Kernel::with_options(
        tokio::runtime::Handle::current(),
        KernelOptions::default(),
        provider,
    )
    .expect("内核应可创建");
    let reached = Arc::new(AtomicBool::new(false));
    let witness = Arc::clone(&reached);
    let runner = TestRunner::with_apply(
        "chips.test.config-missing",
        vec![ApplyStep::Run(Arc::new(move |_ctx: &Context, _config| {
            witness.store(true, Ordering::SeqCst);
            Ok(())
        }))],
    );

    let error = kernel
        .load(request(
            "chips.test.config-missing",
            "1.0.0",
            Vec::new(),
            runner,
        ))
        .await
        .expect_err("配置快照失败应中止加载");
    assert_eq!(error.code(), "KERNEL_APPLY_FAILED");
    assert!(!reached.load(Ordering::SeqCst), "快照失败时不得执行 apply");
    assert_eq!(
        kernel.plugin_state("chips.test.config-missing"),
        Some(PluginState::Failed)
    );
    assert_eq!(
        kernel
            .plugin_last_error("chips.test.config-missing")
            .map(|error| error.code().to_owned()),
        Some("KERNEL_SERVICE_NOT_FOUND".to_owned()),
        "诊断应保留配置系统的首因错误码，而非归一后的 apply 失败"
    );
    assert_eq!(kernel.context_count(), 1, "失败回滚必须销毁插件 Context");
    assert_eq!(kernel.service_count(), 0, "失败回滚不得残留服务");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_injection_failure_during_apply_marks_failed_without_residue() {
    // §5.3 状态机：回调执行出错时撤销注入 Fork，依赖方插件进入 `Failed`；
    // §6.6：apply 已成功返回也不得把插件推进到 `Active`。
    let kernel = default_kernel();
    kernel
        .root_context()
        .provide("platform-file".to_owned(), 1_u32)
        .expect("平台服务应注册在根 Context");
    let runner = TestRunner::with_apply(
        "chips.test.bad-inject",
        vec![
            ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
                ctx.provide("half-done".to_owned(), 1_u32)?;
                // 回调 panic：注入失败并连带插件失败；apply 自身仍返回成功。
                let result = ctx.inject(&["platform-file".to_owned()], |_injected: &Context| {
                    panic!("注入回调内部故障");
                });
                assert!(
                    matches!(result, Err(KernelError::InjectFailed { .. })),
                    "注入回调 panic 必须回传 KERNEL_INJECT_FAILED"
                );
                Ok(())
            })),
            // 重试轮：新的 apply 只注册新服务，用于验证暂存代际不复用。
            ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
                ctx.provide("retry-service".to_owned(), 2_u32)?;
                Ok(())
            })),
        ],
    );

    let error = kernel
        .load(request(
            "chips.test.bad-inject",
            "1.0.0",
            Vec::new(),
            runner,
        ))
        .await
        .expect_err("注入回调失败应返回错误");
    assert_eq!(error.code(), "KERNEL_INJECT_FAILED");
    assert!(error.retryable(), "§9.1：注入失败属于可重试类");
    assert_eq!(
        kernel.plugin_state("chips.test.bad-inject"),
        Some(PluginState::Failed)
    );
    assert!(
        wait_for(|| kernel.context_count() == 1).await,
        "失败回滚必须销毁插件 Context 与注入 Context"
    );
    assert_eq!(
        kernel.service_count(),
        1,
        "暂存代际随插件 Fork 丢弃，只剩平台服务"
    );

    // §6.2：`Failed → Resolving` 可重试，且重试不残留上一次的作用域。
    assert_eq!(
        kernel
            .enable("chips.test.bad-inject")
            .await
            .expect("失败插件应可重新启用"),
        PluginState::Active
    );
    assert_eq!(
        kernel.service_count(),
        2,
        "重试只发布本轮服务：平台服务 + retry-service"
    );
    assert_eq!(
        *kernel
            .root_context()
            .get_typed::<u32>("retry-service")
            .expect("重试轮服务应随新代际发布"),
        2
    );
    assert!(
        kernel
            .get_typed::<u32>(kernel.root_context().id(), "half-done")
            .is_err(),
        "失败轮的暂存服务不得在重试中复活"
    );
    assert_eq!(kernel.context_count(), 2, "重试不得复用旧注入 Context");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_unload_rejects_non_terminal_states_and_dependents() {
    // §6.4：`unload` 只接受 `Installed`／`Failed`，且存在依赖者时始终拒绝。
    let kernel = default_kernel();
    kernel
        .load(request(
            "chips.test.provider",
            "1.0.0",
            Vec::new(),
            TestRunner::with_apply(
                "chips.test.provider",
                vec![ApplyStep::Run(Arc::new(|ctx: &Context, _config| {
                    ctx.provide("shared".to_owned(), 3_u32)?;
                    Ok(())
                }))],
            ),
        ))
        .await
        .expect("提供方应可加载");
    assert_eq!(
        kernel
            .unload("chips.test.provider")
            .await
            .expect_err("Active 状态不得直接卸载")
            .code(),
        "KERNEL_INVALID_TRANSITION"
    );

    kernel
        .load(request(
            "chips.test.consumer",
            "1.0.0",
            vec![spec("chips.test.provider", "^1.0.0")],
            TestRunner::ok("chips.test.consumer"),
        ))
        .await
        .expect("依赖方应可加载");
    assert_eq!(
        kernel.dependents_of("chips.test.provider"),
        vec!["chips.test.consumer".to_owned()]
    );
    assert_eq!(
        kernel
            .disable("chips.test.provider", false)
            .await
            .expect_err("存在 Active 依赖者时默认拒绝停用")
            .code(),
        "KERNEL_DEPENDENCY_CONFLICT"
    );

    // 依赖者先停用（不再阻断），提供方进入 `Installed` 后仍因依赖索引被拒卸载。
    kernel
        .disable("chips.test.consumer", false)
        .await
        .expect("依赖者自身停用应成功");
    kernel
        .disable("chips.test.provider", false)
        .await
        .expect("依赖者停用后提供方应可停用");
    assert_eq!(
        kernel
            .unload("chips.test.provider")
            .await
            .expect_err("存在依赖者时始终拒绝卸载")
            .code(),
        "KERNEL_DEPENDENCY_CONFLICT"
    );

    // 依赖者先卸载后，提供方方可完成卸载并进入终态。
    kernel
        .unload("chips.test.consumer")
        .await
        .expect("无依赖者的插件应可卸载");
    kernel
        .unload("chips.test.provider")
        .await
        .expect("依赖者移除后卸载应成功");
    assert_eq!(
        kernel.plugin_state("chips.test.provider"),
        Some(PluginState::Removed)
    );
    assert!(!kernel
        .plugin_ids()
        .contains(&"chips.test.provider".to_owned()));
    assert_eq!(
        kernel
            .unload("chips.test.absent")
            .await
            .expect_err("未登记插件不得卸载")
            .code(),
        "KERNEL_PLUGIN_NOT_FOUND"
    );
}
