//! §6.2 / §6.8 崩溃重启熔断集成测试（工单047 臂②机制交付波）。
//!
//! 覆盖端到端契约：运行期任务 panic 的判定闭环（`Active → Failed` + 审计 +
//! 退避后自动重启）、窗口超限后的熔断（停止自动重启、显式 `enable` 解除）、
//! 以及工单047 附带发现「Failed 依赖存在导致的无界重试循环」的收敛锁测。
//!
//! 与 `command.rs` 单元测试的分工：单元测试锁定判定钩子的状态门、复核臂分支
//! 与计数生命周期（含停用/卸载对在途与退避待重启的取消、在飞停用回执挂账）；
//! 本文件只经公开 API 验证真实任务 panic、真实退避定时器与
//! 真实激活链条的端到端形态。策略数值一律经 `KernelOptions` 注入缩短值，
//! 禁真等 1s/30s。
//!
//! 接管注记（#167）：第四案的崩溃快照谓词补齐「已回到 `Active`」判据——
//! 退避等待期内插件处于合法的 `Failed` 且此时卸载按《01-内核设计》§6.2
//! 明文可成功，只等窗口计数的谓词存在轮询相位竞态（用例前提缺陷，非机制
//! 缺口；三处权威依据见案内注释）。断言面零放宽零删减。

mod common;

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use chips_cordis::{
    Context, KernelError, KernelOptions, PluginConfig, PluginRunner, PluginState, TaskOptions,
};

use common::{default_kernel, kernel_with, request, spec, wait_for};

/// 崩溃型执行器：`apply` 本身成功，但在插件 Context 上登记一个必然 panic 的
/// 后台任务，用于触发 §6.2「Active 插件任务 panic」判定臂。
///
/// 前 `armed_rounds` 轮激活武装（`0` 表示全程正常，`usize::MAX` 表示每轮都
/// 崩）；`disarm` 可在使用中关闭武装，用于验证熔断解除后的稳定运行。
struct TaskCrashRunner {
    id: &'static str,
    applies: AtomicUsize,
    armed: AtomicBool,
    armed_rounds: usize,
    panic_delay: Duration,
}

impl TaskCrashRunner {
    fn new(id: &'static str, panic_delay: Duration, armed_rounds: usize) -> Arc<Self> {
        Arc::new(Self {
            id,
            applies: AtomicUsize::new(0),
            armed: AtomicBool::new(true),
            armed_rounds,
            panic_delay,
        })
    }

    /// 关闭崩溃武装：后续 `apply` 登记的任务正常收尾。
    fn disarm(&self) {
        self.armed.store(false, Ordering::SeqCst);
    }

    fn applies(&self) -> usize {
        self.applies.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl PluginRunner for TaskCrashRunner {
    async fn apply(&self, ctx: &Context, _config: &PluginConfig) -> Result<(), KernelError> {
        let round = self.applies.fetch_add(1, Ordering::SeqCst);
        let armed = self.armed.load(Ordering::SeqCst) && round < self.armed_rounds;
        // 崩溃延后到激活链收尾之后，确保判定走 §6.2 的 `Active → Failed` 臂。
        let plugin_id = self.id.to_owned();
        let delay = self.panic_delay;
        let handle = ctx.task(
            async move {
                tokio::time::sleep(delay).await;
                if armed {
                    panic!("测试注入：插件 {plugin_id} 第 {round} 轮任务 panic");
                }
            },
            TaskOptions::default(),
        )?;
        drop(handle);
        Ok(())
    }

    async fn stop(&self, _ctx: &Context) -> Result<(), KernelError> {
        Ok(())
    }
}

/// `apply` 恒在 Rust 侧 panic 的执行器：用于依赖驱动型的激活失败计数
/// （§6.8 崩溃隔离下 panic 与返回 `Err` 同形收敛，插件架构设计 §9.3）。
struct ApplyPanicRunner {
    id: &'static str,
    applies: AtomicUsize,
}

impl ApplyPanicRunner {
    fn new(id: &'static str) -> Arc<Self> {
        Arc::new(Self {
            id,
            applies: AtomicUsize::new(0),
        })
    }

    fn applies(&self) -> usize {
        self.applies.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl PluginRunner for ApplyPanicRunner {
    async fn apply(&self, _ctx: &Context, _config: &PluginConfig) -> Result<(), KernelError> {
        self.applies.fetch_add(1, Ordering::SeqCst);
        panic!("测试注入：依赖方 {} apply panic", self.id);
    }

    async fn stop(&self, _ctx: &Context) -> Result<(), KernelError> {
        Ok(())
    }
}

/// 缩短崩溃重启策略的内核选项：窗口取在册默认量级，退避注入毫秒级。
fn crash_options(max_attempts: u32, backoff: Duration) -> KernelOptions {
    KernelOptions {
        crash_restart_window: Duration::from_secs(600),
        crash_restart_max_attempts: max_attempts,
        crash_restart_backoff_initial: backoff,
        crash_restart_backoff_max: backoff,
        ..KernelOptions::default()
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_active_task_panic_converges_and_restarts_after_backoff() {
    // ① 判定闭环 + ③ 自动重启调度：Active 插件任务 panic → §6.2 在册
    // `Active → Failed` + 首因审计 + 窗口计数 → 退避到点后重新走激活链回
    // `Active`；重启成功经既有 `plugin:loaded` 事件留档（⑤ 审计面）。
    let kernel = kernel_with(crash_options(3, Duration::from_millis(20)));
    let root = kernel.root_context();
    let loads: Arc<AtomicUsize> = Arc::new(AtomicUsize::new(0));
    let observer = Arc::clone(&loads);
    root.on(
        "plugin:loaded",
        move |_ctx: &Context, payload: &serde_json::Value| {
            if payload.get("pluginId").and_then(serde_json::Value::as_str)
                == Some("chips.test.crashy")
            {
                observer.fetch_add(1, Ordering::SeqCst);
            }
            Ok(())
        },
    )
    .expect("订阅应成功");

    let runner = TaskCrashRunner::new("chips.test.crashy", Duration::from_millis(30), 1);
    kernel
        .load(request(
            "chips.test.crashy",
            "1.0.0",
            Vec::new(),
            Arc::clone(&runner) as Arc<dyn PluginRunner>,
        ))
        .await
        .expect("前置激活应成功");
    assert_eq!(runner.applies(), 1);
    assert_eq!(
        kernel.plugin_crash_attempts("chips.test.crashy"),
        Some(0),
        "干净激活不计崩溃窗口"
    );
    assert_eq!(
        loads.load(Ordering::SeqCst),
        1,
        "首次激活应有一次 loaded 审计"
    );

    assert!(
        wait_for(|| kernel.plugin_state("chips.test.crashy") == Some(PluginState::Failed)).await,
        "任务 panic 必须经 §6.2 在册迁移收敛到 Failed"
    );
    assert_eq!(
        kernel.plugin_crash_attempts("chips.test.crashy"),
        Some(1),
        "收敛到 Failed 即计入崩溃重启窗口一次"
    );
    let diagnostic = kernel
        .plugin_last_error("chips.test.crashy")
        .expect("崩溃首因必须入审计面");
    assert_eq!(diagnostic.code(), "KERNEL_PLUGIN_PANICKED");

    assert!(
        wait_for(|| kernel.plugin_state("chips.test.crashy") == Some(PluginState::Active)).await,
        "窗口内未超限应按退避自动重启"
    );
    assert_eq!(runner.applies(), 2, "自动重启必须重新执行完整激活链");
    assert_eq!(
        kernel.plugin_crash_attempts("chips.test.crashy"),
        Some(1),
        "重启成功不清零窗口计数"
    );
    assert!(
        wait_for(|| loads.load(Ordering::SeqCst) >= 2).await,
        "重启成功应有审计事件（在册 plugin:loaded）"
    );

    // 崩溃任务只武装一次：重启后插件稳定，不再产生新的重启轮次。
    tokio::time::sleep(Duration::from_millis(150)).await;
    assert_eq!(runner.applies(), 2, "稳定运行不得继续触发重启");
    assert_eq!(
        kernel.plugin_state("chips.test.crashy"),
        Some(PluginState::Active)
    );

    kernel.shutdown().await.expect("命令循环应仍然存活");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_crash_window_exhaustion_stops_restarting_until_enable() {
    // ② 熔断承载 + ⑥ 超限拒重启 + ④ enable 重置：真实消费
    // `CRASH_RESTART_MAX_ATTEMPTS`（注入为 3），第 4 次尝试后停止自动重启，
    // 插件停留 `Failed`；显式 `enable` 重置计数后重新放行。
    let kernel = kernel_with(crash_options(3, Duration::from_millis(10)));
    let runner = TaskCrashRunner::new("chips.test.broken", Duration::from_millis(20), usize::MAX);
    kernel
        .load(request(
            "chips.test.broken",
            "1.0.0",
            Vec::new(),
            Arc::clone(&runner) as Arc<dyn PluginRunner>,
        ))
        .await
        .expect("前置激活应成功");

    assert!(
        wait_for(|| kernel.plugin_crash_attempts("chips.test.broken") == Some(4)).await,
        "反复崩溃应把窗口计数推到上限 +1 后停止"
    );
    assert_eq!(
        runner.applies(),
        4,
        "首次激活 + 3 次自动重启，第 4 次崩溃后不得再激活"
    );

    // 熔断稳定：超过任何退避间隔后仍停在 Failed，计数不再增长。
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(
        kernel.plugin_state("chips.test.broken"),
        Some(PluginState::Failed),
        "超限后必须停留 Failed 等待显式 enable"
    );
    assert_eq!(kernel.plugin_crash_attempts("chips.test.broken"), Some(4));
    assert_eq!(runner.applies(), 4, "熔断后不得再有激活尝试");

    // 解除崩溃源后显式 enable：计数重置、重新可重启。
    runner.disarm();
    let state = tokio::time::timeout(Duration::from_secs(2), kernel.enable("chips.test.broken"))
        .await
        .expect("enable 应答应收敛")
        .expect("超限插件经显式 enable 应重新放行");
    assert_eq!(state, PluginState::Active);
    assert_eq!(
        kernel.plugin_crash_attempts("chips.test.broken"),
        Some(0),
        "显式 enable 必须重置窗口计数"
    );
    tokio::time::sleep(Duration::from_millis(120)).await;
    assert_eq!(
        kernel.plugin_state("chips.test.broken"),
        Some(PluginState::Active),
        "解除崩溃源后应稳定运行"
    );
    assert_eq!(runner.applies(), 5, "enable 只多走一轮激活");

    kernel.shutdown().await.expect("命令循环应仍然存活");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_dependency_driven_retry_loop_converges_at_window_cap() {
    // 工单047 附带发现锁测：依赖恒失败的插件曾驱动「重激活 → 再失败」的
    // 无界重试循环。激活失败与运行期崩溃共用崩溃重启窗口（插件架构设计
    // §9.3）后，该循环在窗口上限处收敛：依赖方停留 Pending，被依赖者停留
    // Failed，循环不再产生新的激活尝试。
    let kernel = default_kernel();
    let provider = ApplyPanicRunner::new("chips.test.dep");
    // 消费方本身不崩溃（武装轮次 0）：它只负责驱动依赖重激活。
    let consumer = TaskCrashRunner::new("chips.test.top", Duration::from_millis(5), 0);
    kernel
        .load(request(
            "chips.test.dep",
            "1.0.0",
            Vec::new(),
            Arc::clone(&provider) as Arc<dyn PluginRunner>,
        ))
        .await
        .expect_err("依赖插件 apply panic 应收敛为失败");
    assert_eq!(provider.applies(), 1);
    assert_eq!(kernel.plugin_crash_attempts("chips.test.dep"), Some(1));

    kernel
        .load(request(
            "chips.test.top",
            "1.0.0",
            vec![spec("chips.test.dep", "^1.0.0")],
            Arc::clone(&consumer) as Arc<dyn PluginRunner>,
        ))
        .await
        .expect("依赖暂不就绪时按 Pending 受理");

    assert!(
        wait_for(|| kernel.plugin_crash_attempts("chips.test.dep") == Some(4)).await,
        "依赖驱动的重激活必须把窗口推到上限"
    );
    // 上限之后再无新的 apply：循环收敛（回归前为紧循环，次数无界）。
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert_eq!(
        provider.applies(),
        4,
        "窗口超限后必须停止驱动依赖重激活，循环收敛为有限次"
    );
    assert_eq!(
        kernel.plugin_state("chips.test.dep"),
        Some(PluginState::Failed),
        "超限依赖停留 Failed"
    );
    assert_eq!(
        kernel.plugin_state("chips.test.top"),
        Some(PluginState::Pending),
        "依赖方停留 Pending（§9.2 尚未启用的保持 pending）"
    );
    assert_eq!(consumer.applies(), 0, "依赖未就绪时消费方不得执行 apply");
    let diagnostic = kernel
        .plugin_last_error("chips.test.top")
        .expect("阻塞诊断应在案");
    assert_eq!(diagnostic.code(), "KERNEL_DEPENDENCY_MISSING");

    kernel.shutdown().await.expect("命令循环应仍然存活");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn test_disable_and_unload_clear_crash_window_end_to_end() {
    // ④ 计数生命周期钩子（端到端）：运行期崩溃计过窗口后，停用（`Installed`）
    // 与卸载（`Removed`）必须把计数清零——§6.8「插件被停用或卸载时，该插件的
    // 崩溃重启计数清零」。
    let kernel = kernel_with(crash_options(3, Duration::from_millis(10)));
    let runner = TaskCrashRunner::new("chips.test.churn", Duration::from_millis(10), 1);
    kernel
        .load(request(
            "chips.test.churn",
            "1.0.0",
            Vec::new(),
            Arc::clone(&runner) as Arc<dyn PluginRunner>,
        ))
        .await
        .expect("前置激活应成功");

    // 一轮崩溃 + 一轮自动重启后回到稳定 Active，窗口留有 1 次计数。
    assert!(
        wait_for(
            || kernel.plugin_state("chips.test.churn") == Some(PluginState::Active)
                && kernel.plugin_crash_attempts("chips.test.churn") == Some(1)
        )
        .await,
        "崩溃应先计入窗口，再由退避自动重启回到 Active"
    );
    assert_eq!(runner.applies(), 2, "自动重启重新执行了一次激活链");

    kernel
        .disable("chips.test.churn", false)
        .await
        .expect("停用应成功");
    assert_eq!(
        kernel.plugin_state("chips.test.churn"),
        Some(PluginState::Installed)
    );
    assert_eq!(
        kernel.plugin_crash_attempts("chips.test.churn"),
        Some(0),
        "停用（Installed）必须清零崩溃重启计数"
    );

    // 重新启用后从零累计：下一次崩溃的计数是 1，而不是残留的 2。
    let armed = TaskCrashRunner::new("chips.test.churn", Duration::from_millis(10), 1);
    kernel
        .load(request(
            "chips.test.churn",
            "1.0.0",
            Vec::new(),
            Arc::clone(&armed) as Arc<dyn PluginRunner>,
        ))
        .await
        .expect("停用后应可重新启用");
    // 快照判定取「已重启回 Active 且计数为 1」的稳定形态（与本用例第一段
    // 同款谓词）：崩溃退避期内插件合法处于 `Failed`（《01-内核设计》§6.2
    // 「仅 `Installed`／`Failed` 可 `unload` 至 `Removed`」，01.06 文件 :54
    // /:69 行；§6.8 退避等待期该状态必然可观察，:223 行；插件架构设计 §9.3
    // 「激活失败与运行期崩溃共用同一窗口计数」，03.09 文件 :36 行），若只
    // 等计数则轮询相位落入 `Failed` 窗口时，紧随的卸载按文档是合法成功，
    // 用例的「先停用后卸载」前提即被竞态击穿——那属用例快照前提缺陷，
    // 不是取消机制缺口；取消与挂账收口由本文件其余断言与 `command.rs`
    // 单元测试锁死。
    assert!(
        wait_for(
            || kernel.plugin_state("chips.test.churn") == Some(PluginState::Active)
                && kernel.plugin_crash_attempts("chips.test.churn") == Some(1)
        )
        .await,
        "停用清零后计数必须从零重新累计，且崩溃重启链已收尾回 Active"
    );

    kernel
        .unload("chips.test.churn")
        .await
        .expect_err("Active 插件卸载应先停用");

    kernel
        .disable("chips.test.churn", false)
        .await
        .expect("收尾停用应成功");
    kernel
        .unload("chips.test.churn")
        .await
        .expect("Installed 插件应可卸载");
    assert_eq!(
        kernel.plugin_state("chips.test.churn"),
        Some(PluginState::Removed)
    );
    assert_eq!(
        kernel.plugin_crash_attempts("chips.test.churn"),
        Some(0),
        "卸载（Removed）后计数保持清零"
    );

    kernel.shutdown().await.expect("命令循环应仍然存活");
}
