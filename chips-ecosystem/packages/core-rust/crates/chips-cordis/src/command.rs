//! 命令循环：生命周期状态的唯一写者。
//!
//! 对应《薯片内核设计》§6.3、§6.8、§10.2：`load` / `enable` / `disable` /
//! `unload` 经命令队列串行执行；`apply` / `stop` 在循环外以隔离任务执行并带
//! 超时（§6.8 崩溃隔离：回调 panic 不拖垮命令链），循环在等待期间继续处理
//! 其他命令。

use std::future::Future;
use std::sync::Arc;
use std::time::Duration;

use chips_core::{ContextId, PluginId};
use tokio::sync::{mpsc, oneshot};

use crate::context::Context;
use crate::error::{KernelError, LifecyclePhase};
use crate::kernel::Kernel;
use crate::plugin::{
    crash_restart_backoff, CrashRestartPolicy, LoadPlan, LoadRequest, PluginConfig, PluginRunner,
    PluginState,
};

/// 激活结果。
#[derive(Debug, Clone, Copy)]
pub(crate) enum ActivationOutcome {
    /// apply 成功返回。
    Applied,
    /// apply 返回错误，或 runner 在 Rust 侧 panic（《薯片内核设计》§6.8：
    /// 崩溃与被隔离的失败判定同形，统一经 `RunnerFailed` 收敛到 `Failed`；
    /// `TimedOut` 专指 §6.7 超时，panic 不属于该语义，故归入本变体）。
    RunnerFailed,
    /// apply 超时。
    TimedOut,
}

/// `apply` 所需的句柄集合。
pub(crate) struct ActivationTicket {
    pub(crate) context: Context,
    pub(crate) config: PluginConfig,
    pub(crate) runner: Arc<dyn PluginRunner>,
}

/// `stop` 所需的句柄集合。
pub(crate) struct StopTicket {
    pub(crate) context: Context,
    pub(crate) runner: Arc<dyn PluginRunner>,
}

/// 隔离生命周期回调的终局判定（《薯片内核设计》§6.8）。
enum Isolated<T> {
    /// 回调正常返回（含返回 `Err` 的在册失败路径）。
    Returned(T),
    /// 回调在 Rust 侧 panic，或隔离任务异常终止；按崩溃隔离臂收敛，
    /// 命令链自身不受影响。
    Crashed,
    /// 回调超过 §6.7 生命周期上限；回调 future 已在隔离任务内就地丢弃。
    TimedOut,
}

/// 以隔离任务执行 `PluginRunner` 生命周期回调并施加超时上限。
///
/// panic 捕获面取 `tokio::spawn` 任务边界的 `JoinError::is_panic` 形态，
/// 依据（工单047 臂①裁定，比照 §6.8 与 crate 现状）：
///
/// 1. 与本 crate 既有异步 panic 在册形态一致——`task.rs` 的任务监视器即以
///    `JoinHandle` + `is_panic` 归一插件任务 panic（§4.2 / §9.1），此处是
///    判定/清理链上对应未覆盖位的同形收口。
/// 2. 不引入 `futures` 等新第三方依赖（AGENTS 依赖红线），也不需要对跨
///    await 点的回调 future 作 `UnwindSafe` 断言：panic 只在隔离任务内
///    展开，回调 future 与其独占数据在现场被销毁；内核状态锁在用户回调
///    执行期间不持有（§10.2 全部锁窗口为短时同步段），不存在持锁展开路径。
/// 3. 超时放进隔离任务内部执行：上限到期时回调 future 在任务内被就地
///    drop，与修复前直接 await 的同步取消语义一致（不产生超时后仍在后台
///    续跑的 detached 回调）。
async fn run_isolated<F>(
    runtime: &tokio::runtime::Handle,
    limit: Duration,
    work: F,
) -> Isolated<F::Output>
where
    F: Future + Send + 'static,
    F::Output: Send,
{
    match runtime.spawn(tokio::time::timeout(limit, work)).await {
        Ok(Ok(output)) => Isolated::Returned(output),
        Ok(Err(_elapsed)) => Isolated::TimedOut,
        Err(join_error) if join_error.is_panic() => Isolated::Crashed,
        // 非 panic 的 `JoinError` 只可能来自外部强制 abort；本模块隔离任务
        // 不向外暴露 abort 句柄。该臂不可达，但仍归入崩溃隔离收敛，
        // 绝不允许留下无人管理的出口。
        Err(_) => Isolated::Crashed,
    }
}

/// 内核命令。
pub(crate) enum Command {
    Load {
        request: Box<LoadRequest>,
        reply: oneshot::Sender<Result<PluginState, KernelError>>,
    },
    Enable {
        id: PluginId,
        reply: oneshot::Sender<Result<PluginState, KernelError>>,
    },
    Disable {
        id: PluginId,
        cascade: bool,
        reply: oneshot::Sender<Result<(), KernelError>>,
    },
    Unload {
        id: PluginId,
        reply: oneshot::Sender<Result<(), KernelError>>,
    },
    BeginActivation {
        id: PluginId,
        reply: oneshot::Sender<Result<ActivationTicket, KernelError>>,
    },
    FinishActivation {
        id: PluginId,
        outcome: ActivationOutcome,
        reply: oneshot::Sender<Result<bool, KernelError>>,
    },
    BeginStop {
        id: PluginId,
        reply: oneshot::Sender<Result<StopTicket, KernelError>>,
    },
    FinishStop {
        id: PluginId,
        reply: oneshot::Sender<Result<(), KernelError>>,
    },
    /// §6.8 崩溃重启退避定时器到点后的受控重启入口（内核内部命令，不经
    /// 公开 API 暴露）；`generation` 是调度时捕获的重启世代凭证，处理时
    /// 复核凭证与记录当前世代一致、未被停用意图抑制、插件仍在 `Failed`、
    /// 未被其它链条接管且熔断窗口未超限，才按在册迁移 `Failed → Resolving
    /// → Starting` 重启。停用/卸载/显式启用/装载都会递增世代，使凭证失效
    /// ——这就是「取消退避待重启任务」的落地形态（定时器本体到点即空转）。
    AutoRestart {
        id: PluginId,
        generation: u64,
    },
    Shutdown {
        reply: oneshot::Sender<()>,
    },
}

/// 启动命令循环任务；由 `Kernel::with_options` 调用。
pub(crate) fn spawn_command_loop(kernel: Kernel, receiver: mpsc::UnboundedReceiver<Command>) {
    kernel.runtime().spawn(async move {
        run_command_loop(kernel, receiver).await;
    });
}

async fn run_command_loop(kernel: Kernel, mut receiver: mpsc::UnboundedReceiver<Command>) {
    while let Some(command) = receiver.recv().await {
        if !handle_command(&kernel, command).await {
            break;
        }
    }
}

async fn handle_command(kernel: &Kernel, command: Command) -> bool {
    match command {
        Command::Load { request, reply } => {
            let id = request.id.clone();
            let registered = {
                let mut state = match kernel.lock_state() {
                    Ok(state) => state,
                    Err(error) => {
                        let _ = reply.send(Err(error));
                        return true;
                    }
                };
                state.plugins.register(*request)
            };
            match registered {
                Err(error) => {
                    let _ = reply.send(Err(error));
                }
                Ok(()) => {
                    // `load` 是用户显式意愿：清除停用抑制位并作废停用前遗留的
                    // 退避待重启（世代递增），恢复该插件的自动重启资格。
                    if let Ok(mut state) = kernel.lock_state() {
                        if let Some(record) = state.plugins.record_mut(&id) {
                            record.allow_auto_restart();
                        }
                    }
                    start_enable(kernel, id, Some(reply));
                }
            }
            true
        }
        Command::Enable { id, reply } => {
            let known = kernel.plugin_state(&id).is_some();
            if known {
                // §6.8：用户显式 `enable` 重置崩溃重启窗口计数（熔断解除，
                // 自动重启预算恢复），同时清除停用抑制位并作废旧世代的退避
                // 待重启。非注册入口（依赖驱动链条、退避定时器）不重置，
                // 防止绕过熔断。
                if let Ok(mut state) = kernel.lock_state() {
                    if let Some(record) = state.plugins.record_mut(&id) {
                        record.reset_crash_window();
                        record.allow_auto_restart();
                    }
                }
                start_enable(kernel, id, Some(reply));
            } else {
                let _ = reply.send(Err(KernelError::PluginNotFound { id }));
            }
            true
        }
        Command::Disable { id, cascade, reply } => {
            handle_disable(kernel, id, cascade, reply);
            true
        }
        Command::Unload { id, reply } => {
            let result = handle_unload(kernel, &id);
            let _ = reply.send(result);
            true
        }
        Command::BeginActivation { id, reply } => {
            let result = begin_activation(kernel, &id);
            let _ = reply.send(result);
            true
        }
        Command::FinishActivation { id, outcome, reply } => {
            let result = finish_activation(kernel, &id, outcome);
            let _ = reply.send(result);
            true
        }
        Command::BeginStop { id, reply } => {
            let result = begin_stop(kernel, &id);
            let _ = reply.send(result);
            true
        }
        Command::FinishStop { id, reply } => {
            let result = finish_stop(kernel, &id);
            let _ = reply.send(result);
            true
        }
        Command::AutoRestart { id, generation } => {
            handle_auto_restart(kernel, &id, generation);
            true
        }
        Command::Shutdown { reply } => {
            let _ = reply.send(());
            false
        }
    }
}

fn start_enable(
    kernel: &Kernel,
    id: PluginId,
    reply: Option<oneshot::Sender<Result<PluginState, KernelError>>>,
) {
    let plan = {
        let state = match kernel.lock_state() {
            Ok(state) => state,
            Err(error) => {
                if let Some(reply) = reply {
                    let _ = reply.send(Err(error));
                }
                return;
            }
        };
        state.plugins.plan_load(&id)
    };

    match plan {
        Err(error) => send_state_reply(reply, Err(error)),
        Ok(LoadPlan::AlreadyActive) => send_state_reply(reply, Ok(PluginState::Active)),
        Ok(LoadPlan::Blocked(error)) => {
            if let Ok(mut state) = kernel.lock_state() {
                state.plugins.set_state(&id, PluginState::Pending);
                if let Some(record) = state.plugins.record_mut(&id) {
                    record.last_error = Some(error.clone().into());
                    record.last_failure = Some(error);
                }
            }
            send_state_reply(reply, Ok(PluginState::Pending));
        }
        Ok(LoadPlan::Rejected(error)) => {
            if let Ok(mut state) = kernel.lock_state() {
                state.plugins.set_state(&id, PluginState::Failed);
                if let Some(record) = state.plugins.record_mut(&id) {
                    record.last_error = Some(error.clone().into());
                    record.last_failure = Some(error.clone());
                }
            }
            send_state_reply(reply, Err(error));
        }
        Ok(LoadPlan::Activate(order)) => {
            if let Ok(mut state) = kernel.lock_state() {
                for pid in &order {
                    state.plugins.set_state(pid, PluginState::Pending);
                    state.plugins.queued.insert(pid.clone());
                }
            }
            spawn_chain(kernel.clone(), order, id, reply);
        }
    }
}

fn send_state_reply(
    reply: Option<oneshot::Sender<Result<PluginState, KernelError>>>,
    result: Result<PluginState, KernelError>,
) {
    if let Some(reply) = reply {
        let _ = reply.send(result);
    }
}

fn spawn_chain(
    kernel: Kernel,
    order: Vec<PluginId>,
    target: PluginId,
    reply: Option<oneshot::Sender<Result<PluginState, KernelError>>>,
) {
    kernel.runtime().spawn(async move {
        let outcome = run_chain(&kernel, &order, &target).await;
        send_state_reply(reply, outcome);
        if let Ok(mut state) = kernel.lock_state() {
            for id in &order {
                state.plugins.queued.remove(id);
            }
        }
        kernel.resume_pending();
    });
}

async fn run_chain(
    kernel: &Kernel,
    order: &[PluginId],
    target: &str,
) -> Result<PluginState, KernelError> {
    for id in order {
        // 激活链启动后插件可能被停用（移出队列）或已被移除；跳过即可。
        if !kernel.should_activate(id) {
            continue;
        }
        let ticket = match kernel.begin_activation_command(id).await {
            Ok(ticket) => ticket,
            Err(_) => return target_outcome(kernel, target),
        };
        let apply_timeout = kernel.options().apply_timeout;
        let ActivationTicket {
            context,
            config,
            runner,
        } = ticket;
        // §6.8 崩溃隔离：apply 在隔离任务内执行；runner 的 Rust 侧 panic 与
        // 返回 `Err` 一样收敛到 `RunnerFailed`，激活链任务不再整体溃灭，
        // spawn_chain 尾部的善后三件套（reply / queued 清理 / resume_pending）
        // 在 panic 臂同样得到执行。
        let outcome = match run_isolated(&kernel.runtime(), apply_timeout, async move {
            runner.apply(&context, &config).await
        })
        .await
        {
            Isolated::Returned(Ok(())) => ActivationOutcome::Applied,
            Isolated::Returned(Err(_)) | Isolated::Crashed => ActivationOutcome::RunnerFailed,
            Isolated::TimedOut => ActivationOutcome::TimedOut,
        };
        let proceed = kernel
            .finish_activation_command(id, outcome)
            .await
            .unwrap_or_default();
        if !proceed {
            return target_outcome(kernel, target);
        }
    }
    target_outcome(kernel, target)
}

fn target_outcome(kernel: &Kernel, target: &str) -> Result<PluginState, KernelError> {
    match kernel.plugin_state(target) {
        Some(PluginState::Active) => Ok(PluginState::Active),
        Some(PluginState::Failed) => {
            let failure = kernel.lock_state().ok().and_then(|state| {
                state
                    .plugins
                    .record(target)
                    .and_then(|record| record.last_failure.clone())
            });
            Err(failure.unwrap_or(KernelError::ApplyFailed {
                id: target.to_owned(),
            }))
        }
        Some(state) => Ok(state),
        None => Err(KernelError::PluginNotFound {
            id: target.to_owned(),
        }),
    }
}

fn begin_activation(kernel: &Kernel, id: &str) -> Result<ActivationTicket, KernelError> {
    let (parent, runner) = {
        let mut state = kernel.lock_state()?;
        let (parent, runner, cancelled) = {
            let record = state
                .plugins
                .record(id)
                .ok_or(KernelError::PluginNotFound { id: id.to_owned() })?;
            (
                record.parent,
                Arc::clone(&record.runner),
                record.cancel_requested,
            )
        };
        if cancelled {
            // 停用竞态兜底：插件在激活链启动前被停用，直接落入 Installed。
            state.plugins.set_state(id, PluginState::Installed);
            if let Some(record) = state.plugins.record_mut(id) {
                record.cancel_requested = false;
            }
            return Err(KernelError::InvalidTransition {
                id: id.to_owned(),
                from: PluginState::Pending,
                to: PluginState::Installed,
            });
        }
        state.plugins.mark(id, PluginState::Resolving)?;
        (parent, runner)
    };

    let parent = parent.unwrap_or(kernel.root_id());
    let context = kernel.create_plugin_context(parent)?;
    {
        let mut state = kernel.lock_state()?;
        state.plugins.mark(id, PluginState::Starting)?;
        state.plugins.in_flight.insert(id.to_owned());
        let context_id = context.id();
        let fork = state.contexts.node(context_id).map(|node| node.fork);
        if let Some(record) = state.plugins.record_mut(id) {
            record.context = Some(context_id);
            record.fork = fork;
        }
    }

    kernel.activate_context(context.id())?;

    let cancelled = kernel.lock_state().is_ok_and(|state| {
        state
            .plugins
            .record(id)
            .is_some_and(|record| record.cancel_requested)
    });
    if cancelled {
        rollback_cancelled(kernel, id)?;
        return Err(KernelError::InvalidTransition {
            id: id.to_owned(),
            from: PluginState::Starting,
            to: PluginState::Installed,
        });
    }

    let config = match kernel.config_provider().snapshot(&id.to_owned()) {
        Ok(config) => config,
        Err(error) => {
            let kernel_error = KernelError::ApplyFailed { id: id.to_owned() };
            kernel.fail_plugin_with(id, kernel_error.clone(), Some(error.into()));
            return Err(kernel_error);
        }
    };

    Ok(ActivationTicket {
        context,
        config,
        runner,
    })
}

fn rollback_cancelled(kernel: &Kernel, id: &str) -> Result<(), KernelError> {
    let (fork, context, failed) = {
        let mut state = kernel.lock_state()?;
        let Some(record) = state.plugins.record_mut(id) else {
            return Ok(());
        };
        let fork = record.fork.take();
        let context = record.context.take();
        record.cancel_requested = false;
        let failed = record.state == PluginState::Failed;
        (fork, context, failed)
    };
    {
        let mut state = kernel.lock_state()?;
        state.plugins.in_flight.remove(id);
        state.plugins.queued.remove(id);
        if !failed {
            state.plugins.set_state(id, PluginState::Installed);
        }
    }
    if let Some(context) = context {
        let _ = kernel.dispose_context(context);
    } else if let Some(fork) = fork {
        let _ = kernel.dispose_fork(fork);
    }
    Ok(())
}

fn finish_activation(
    kernel: &Kernel,
    id: &str,
    outcome: ActivationOutcome,
) -> Result<bool, KernelError> {
    let (fork, state, cancel_requested) = {
        let mut state = kernel.lock_state()?;
        let Some(record) = state.plugins.record_mut(id) else {
            return Err(KernelError::PluginNotFound { id: id.to_owned() });
        };
        (record.fork, record.state, record.cancel_requested)
    };
    let Some(fork) = fork else {
        return Ok(false);
    };

    match outcome {
        ActivationOutcome::Applied if !cancel_requested && state == PluginState::Starting => {
            // 级联重建超限只影响依赖方注入（保持 Waiting），不阻断插件激活。
            let _ = kernel.publish_staged(fork);
            {
                let mut state = kernel.lock_state()?;
                state.plugins.mark(id, PluginState::Active)?;
                state.plugins.in_flight.remove(id);
                if let Some(record) = state.plugins.record_mut(id) {
                    record.cancel_requested = false;
                    record.last_error = None;
                    record.last_failure = None;
                }
            }
            let (version, role) = {
                let state = kernel.lock_state()?;
                let record = state
                    .plugins
                    .record(id)
                    .ok_or(KernelError::PluginNotFound { id: id.to_owned() })?;
                (record.version.to_string(), record.role)
            };
            let payload = serde_json::json!({
                "pluginId": id,
                "version": version,
                "role": role.as_str(),
            });
            kernel.emit_kernel_event("plugin:loaded", payload)?;
            kernel.resume_pending();
            Ok(true)
        }
        ActivationOutcome::Applied => {
            // apply 返回成功但插件已失败（例如注入回调出错）或已被停用：
            // 失败状态保持不回退，其余情况按取消回滚。
            if state != PluginState::Failed {
                rollback_cancelled(kernel, id)?;
            } else {
                let mut guard = kernel.lock_state()?;
                guard.plugins.in_flight.remove(id);
            }
            Ok(false)
        }
        ActivationOutcome::RunnerFailed => {
            kernel.fail_plugin(id, KernelError::ApplyFailed { id: id.to_owned() });
            Ok(false)
        }
        ActivationOutcome::TimedOut => {
            kernel.fail_plugin(
                id,
                KernelError::LifecycleTimeout {
                    id: id.to_owned(),
                    phase: LifecyclePhase::Apply,
                },
            );
            Ok(false)
        }
    }
}

fn begin_stop(kernel: &Kernel, id: &str) -> Result<StopTicket, KernelError> {
    let (context_id, runner) = {
        let mut state = kernel.lock_state()?;
        let (context_id, runner) = {
            let record = state
                .plugins
                .record(id)
                .ok_or(KernelError::PluginNotFound { id: id.to_owned() })?;
            let context_id = record
                .context
                .ok_or(KernelError::PluginNotFound { id: id.to_owned() })?;
            (context_id, Arc::clone(&record.runner))
        };
        state.plugins.mark(id, PluginState::Stopping)?;
        state.plugins.in_flight.insert(id.to_owned());
        (context_id, runner)
    };
    Ok(StopTicket {
        context: Context::new(context_id, kernel.clone()),
        runner,
    })
}

fn finish_stop(kernel: &Kernel, id: &str) -> Result<(), KernelError> {
    let (fork, context) = {
        let mut state = kernel.lock_state()?;
        let Some(record) = state.plugins.record_mut(id) else {
            return Err(KernelError::PluginNotFound { id: id.to_owned() });
        };
        let fork = record.fork.take();
        let context = record.context.take();
        record.cancel_requested = false;
        state.plugins.in_flight.remove(id);
        (fork, context)
    };
    if let Some(context) = context {
        let _ = kernel.dispose_context(context);
    } else if let Some(fork) = fork {
        let _ = kernel.dispose_fork(fork);
    }
    {
        let mut state = kernel.lock_state()?;
        state.plugins.mark(id, PluginState::Installed)?;
    }
    Ok(())
}

fn handle_disable(
    kernel: &Kernel,
    id: PluginId,
    cascade: bool,
    reply: oneshot::Sender<Result<(), KernelError>>,
) {
    let state = kernel.plugin_state(&id);
    match state {
        None => {
            let _ = reply.send(Err(KernelError::PluginNotFound { id }));
        }
        Some(PluginState::Installed) => {
            // 幂等停用同样作废遗留的退避待重启（§6.8 停用取消）。
            if let Ok(mut state) = kernel.lock_state() {
                if let Some(record) = state.plugins.record_mut(&id) {
                    record.cancel_auto_restart();
                }
            }
            let _ = reply.send(Ok(()));
        }
        Some(PluginState::Pending) => {
            let mut state = match kernel.lock_state() {
                Ok(state) => state,
                Err(error) => {
                    let _ = reply.send(Err(error));
                    return;
                }
            };
            state.plugins.set_state(&id, PluginState::Installed);
            state.plugins.queued.remove(&id);
            if let Some(record) = state.plugins.record_mut(&id) {
                record.cancel_requested = false;
                record.last_error = None;
                record.last_failure = None;
                record.cancel_auto_restart();
            }
            drop(state);
            let _ = reply.send(Ok(()));
        }
        Some(PluginState::Starting) | Some(PluginState::Resolving) => {
            // 在飞激活链（含自动重启链）窗口内的停用：置取消标记后，链在
            // 下一个在册收敛点回滚到 `Installed`。若该插件确已被链条接管
            // （queued / in_flight），回执挂账到插件定稿才补发——停用返回
            // `Ok` 即「确定不再运行」，紧随的 `unload` 不会再撞在飞链的
            // `Starting` 中间态；若链条缺失（异常残留态）则即时回执，
            // 保持既有乐观语义不放空。
            let mut leftover = Some(reply);
            if let Ok(mut state) = kernel.lock_state() {
                let in_chain =
                    state.plugins.in_flight.contains(&id) || state.plugins.queued.contains(&id);
                if let Some(record) = state.plugins.record_mut(&id) {
                    record.cancel_requested = true;
                    record.cancel_auto_restart();
                    if in_chain && record.pending_disable_reply.is_none() {
                        record.pending_disable_reply = leftover.take();
                    }
                }
            }
            if let Some(reply) = leftover {
                let _ = reply.send(Ok(()));
            }
        }
        Some(PluginState::Active) => {
            let (dependents, order) = {
                match kernel.lock_state() {
                    Ok(state) => {
                        let dependents: Vec<PluginId> = state
                            .plugins
                            .transitive_dependents(&id)
                            .into_iter()
                            .filter(|dependent| {
                                state.plugins.state_of(dependent) == Some(PluginState::Active)
                            })
                            .collect();
                        let order = if dependents.is_empty() {
                            Vec::new()
                        } else {
                            let topology = state.plugins.topological_order();
                            let mut order = dependents.clone();
                            order.sort_by_key(|dependent| {
                                std::cmp::Reverse(state.plugins.rank(dependent, &topology))
                            });
                            order
                        };
                        (dependents, order)
                    }
                    Err(error) => {
                        let _ = reply.send(Err(error));
                        return;
                    }
                }
            };
            if !dependents.is_empty() && !cascade {
                let _ = reply.send(Err(KernelError::DependencyConflict {
                    plugin: id,
                    dependents,
                }));
                return;
            }

            // §6.8 停用取消：作废该插件已登记的退避待重启并抑制后续自动
            // 重启（依赖被级联停用时同样取消其自身的在途重启资格）。
            if let Ok(mut state) = kernel.lock_state() {
                for plugin in dependents.iter().chain(std::iter::once(&id)) {
                    if let Some(record) = state.plugins.record_mut(plugin) {
                        record.cancel_auto_restart();
                    }
                }
            }

            let mut order = order;
            order.push(id);
            let kernel = kernel.clone();
            kernel.runtime().spawn(async move {
                let mut result = Ok(());
                for plugin in order {
                    if let Err(error) = disable_one(&kernel, &plugin).await {
                        result = Err(error);
                        break;
                    }
                }
                let _ = reply.send(result);
                kernel.resume_pending();
            });
        }
        Some(other) => {
            let _ = reply.send(Err(KernelError::InvalidTransition {
                id,
                from: other,
                to: PluginState::Installed,
            }));
        }
    }
}

async fn disable_one(kernel: &Kernel, id: &str) -> Result<(), KernelError> {
    let ticket = kernel.begin_stop_command(id).await?;
    let stop_timeout = kernel.options().stop_timeout;
    let StopTicket { context, runner } = ticket;
    // §6.8 崩溃隔离同样覆盖清理路径：stop 的 Rust 侧 panic 不溃灭停用链任务，
    // 按 §6.4 规则 2「stop 失败不阻断撤销」收敛到 `Installed`，panic 本体记入
    // 诊断（在册错误 `KERNEL_PLUGIN_PANICKED`，比照 task.rs 的任务 panic 归一）。
    let outcome = run_isolated(&kernel.runtime(), stop_timeout, async move {
        runner.stop(&context).await
    })
    .await;
    let diagnostic = match outcome {
        Isolated::Returned(Ok(())) => None,
        Isolated::Returned(Err(error)) => Some(error),
        Isolated::TimedOut => Some(KernelError::LifecycleTimeout {
            id: id.to_owned(),
            phase: LifecyclePhase::Stop,
        }),
        Isolated::Crashed => Some(KernelError::PluginPanicked { id: id.to_owned() }),
    };
    kernel.finish_stop_command(id).await?;
    if let Some(error) = diagnostic {
        // stop 失败/超时/panic 不阻断停用（内核设计 §6.4、§6.7）：仅记录诊断。
        kernel.record_plugin_diagnostic(id, error);
    }
    Ok(())
}

fn handle_unload(kernel: &Kernel, id: &str) -> Result<(), KernelError> {
    let mut state = kernel.lock_state()?;
    let record = state
        .plugins
        .record(id)
        .ok_or(KernelError::PluginNotFound { id: id.to_owned() })?;
    match record.state {
        PluginState::Installed | PluginState::Failed => {}
        other => {
            return Err(KernelError::InvalidTransition {
                id: id.to_owned(),
                from: other,
                to: PluginState::Removed,
            })
        }
    }
    let dependents = state.plugins.dependents_of(id);
    if !dependents.is_empty() {
        return Err(KernelError::DependencyConflict {
            plugin: id.to_owned(),
            dependents,
        });
    }
    // §6.8 卸载取消：先作废旧世代的退避待重启，再落终态（`Removed` 触发
    // 生命周期钩子清零窗口并补发任何挂账的停用回执）。
    if let Some(record) = state.plugins.record_mut(id) {
        record.cancel_auto_restart();
    }
    state.plugins.set_state(id, PluginState::Removed);
    Ok(())
}

/// §6.8 退避定时器到点后的受控重启复核（命令循环内执行）。
///
/// 定时器与显式生命周期命令存在良性竞态：本次调度携带崩溃判定收敛时刻的
/// 世代凭证，停用、卸载、显式启用、装载任一发生都会递增记录世代使凭证
/// 失效——到点复核不符即空转返回，这就是「取消退避待重启任务」的落地形态。
/// 此外复核：已被其它链条接管（queued / in_flight）、停用抑制位在置、插件
/// 已不在 `Failed`、熔断窗口超限（修剪过期尝试后判定）四种情况都空转；
/// 全部通过才按在册迁移重新送入 `Resolving`。
fn handle_auto_restart(kernel: &Kernel, id: &str, generation: u64) {
    let should_restart = match kernel.lock_state() {
        Ok(mut state) => {
            if state.plugins.queued.contains(id) || state.plugins.in_flight.contains(id) {
                false
            } else {
                let policy = state.plugins.crash_policy;
                state.plugins.record_mut(id).is_some_and(|record| {
                    record.crash_restart_generation == generation
                        && !record.auto_restart_suppressed
                        && record.state == PluginState::Failed
                        && !record.crash_restart_exhausted(std::time::Instant::now(), policy)
                })
            }
        }
        Err(_) => false,
    };
    if should_restart {
        start_enable(kernel, id.to_owned(), None);
    }
}

impl Kernel {
    /// 根 Context ID。
    pub(crate) fn root_id(&self) -> ContextId {
        self.inner.root
    }

    fn send(&self, command: Command) -> Result<(), KernelError> {
        self.commands
            .send(command)
            .map_err(|_| KernelError::LockPoisoned)
    }

    /// 登记并启用插件；返回其当前状态。
    ///
    /// 依赖暂不满足时返回 `Ok(Pending)`，依赖就绪后自动继续激活；显式冲突
    /// （成环、版本互斥、重复声明）返回对应 `KERNEL_*` 错误。
    pub async fn load(&self, request: LoadRequest) -> Result<PluginState, KernelError> {
        let (reply, receiver) = oneshot::channel();
        self.send(Command::Load {
            request: Box::new(request),
            reply,
        })?;
        receiver.await.map_err(|_| KernelError::LockPoisoned)?
    }

    /// 启用一个已登记的插件。
    pub async fn enable(&self, id: &str) -> Result<PluginState, KernelError> {
        let (reply, receiver) = oneshot::channel();
        self.send(Command::Enable {
            id: id.to_owned(),
            reply,
        })?;
        receiver.await.map_err(|_| KernelError::LockPoisoned)?
    }

    /// 停用插件；存在 `Active` 依赖者时默认拒绝，`cascade` 为真时按逆拓扑序级联。
    pub async fn disable(&self, id: &str, cascade: bool) -> Result<(), KernelError> {
        let (reply, receiver) = oneshot::channel();
        self.send(Command::Disable {
            id: id.to_owned(),
            cascade,
            reply,
        })?;
        receiver.await.map_err(|_| KernelError::LockPoisoned)?
    }

    /// 卸载插件；仅接受 `Installed` / `Failed`，存在依赖者时始终拒绝。
    pub async fn unload(&self, id: &str) -> Result<(), KernelError> {
        let (reply, receiver) = oneshot::channel();
        self.send(Command::Unload {
            id: id.to_owned(),
            reply,
        })?;
        receiver.await.map_err(|_| KernelError::LockPoisoned)?
    }

    /// 关闭命令循环；调用后内核不再接受新命令。
    pub async fn shutdown(&self) -> Result<(), KernelError> {
        let (reply, receiver) = oneshot::channel();
        self.send(Command::Shutdown { reply })?;
        receiver.await.map_err(|_| KernelError::LockPoisoned)
    }

    async fn begin_activation_command(&self, id: &str) -> Result<ActivationTicket, KernelError> {
        let (reply, receiver) = oneshot::channel();
        self.send(Command::BeginActivation {
            id: id.to_owned(),
            reply,
        })?;
        receiver.await.map_err(|_| KernelError::LockPoisoned)?
    }

    async fn finish_activation_command(
        &self,
        id: &str,
        outcome: ActivationOutcome,
    ) -> Result<bool, KernelError> {
        let (reply, receiver) = oneshot::channel();
        self.send(Command::FinishActivation {
            id: id.to_owned(),
            outcome,
            reply,
        })?;
        receiver.await.map_err(|_| KernelError::LockPoisoned)?
    }

    async fn begin_stop_command(&self, id: &str) -> Result<StopTicket, KernelError> {
        let (reply, receiver) = oneshot::channel();
        self.send(Command::BeginStop {
            id: id.to_owned(),
            reply,
        })?;
        receiver.await.map_err(|_| KernelError::LockPoisoned)?
    }

    async fn finish_stop_command(&self, id: &str) -> Result<(), KernelError> {
        let (reply, receiver) = oneshot::channel();
        self.send(Command::FinishStop {
            id: id.to_owned(),
            reply,
        })?;
        receiver.await.map_err(|_| KernelError::LockPoisoned)?
    }

    /// 依赖就绪后自动继续激活等待中的插件。
    pub(crate) fn resume_pending(&self) {
        let candidates: Vec<PluginId> = match self.lock_state() {
            Ok(state) => state
                .plugins
                .records
                .iter()
                .filter(|(id, record)| {
                    record.state == PluginState::Pending
                        && !state.plugins.queued.contains(*id)
                        && !state.plugins.in_flight.contains(*id)
                })
                .map(|(id, _)| id.clone())
                .collect(),
            Err(_) => return,
        };
        for id in candidates {
            start_enable(self, id, None);
        }
    }

    /// 激活链当前是否仍应激活该插件（在队列中且仍为 `Pending`）。
    pub(crate) fn should_activate(&self, id: &str) -> bool {
        self.lock_state().is_ok_and(|state| {
            state.plugins.queued.contains(id)
                && state.plugins.state_of(id) == Some(PluginState::Pending)
        })
    }

    /// 记录插件诊断（停用失败/超时等不阻断生命周期的错误）。
    pub(crate) fn record_plugin_diagnostic(&self, id: &str, error: KernelError) {
        let Ok(mut state) = self.lock_state() else {
            return;
        };
        if let Some(record) = state.plugins.record_mut(id) {
            record.last_error = Some(error.into());
        }
    }

    /// §6.2 / §6.8 运行期崩溃判定闭环入口（任务监视器调用）：
    ///
    /// 1. 崩溃通知按在册迁移收敛到 `Failed`（`Active → Failed（任务 panic）`
    ///    为主臂；`apply` 内任务先于激活链收尾 panic 时按 `Starting /
    ///    Resolving → Failed` 收敛，避免漏判），由 `fail_plugin_task_panic`
    ///    单锁段复核状态，杜绝与停用/卸载链条的竞态改写；崩溃首因经
    ///    `last_error` / `last_failure` 审计面留档，副作用随 Context/Fork
    ///    撤销回滚（§6.6）。
    /// 2. 收敛即计入崩溃重启窗口一次（激活失败与运行期崩溃共用计数，
    ///    插件架构设计 §9.3）；窗口内未超 `CRASH_RESTART_MAX_ATTEMPTS` 时
    ///    按指数退避调度自动重启，超限即熔断——插件停留 `Failed`，等待显式
    ///    `enable`（重启与熔断动作的审计承载 = 每次崩溃的首因诊断 +
    ///    窗口计数，可经 `plugin_crash_attempts` 观测）。调度携带判定同锁段
    ///    读取的重启世代凭证；停用、卸载、显式启用与装载都递增该世代并
    ///    置停用抑制位，使在途重启与已登记的退避待重启在到点复核时作废。
    ///
    /// 平台归属任务（非插件 Context）与已由其它生命周期结论定稿的状态
    /// （`Installed` / `Stopping` / `Pending` / `Removed`）不触碰插件状态机，
    /// 只按 §9.1 归一上报诊断。
    pub(crate) fn handle_plugin_task_panic(&self, id: &str) {
        let error = KernelError::PluginPanicked { id: id.to_owned() };
        let Some((attempts, generation)) = self.fail_plugin_task_panic(id, error) else {
            return;
        };
        let policy = CrashRestartPolicy::from(self.options());
        if attempts > policy.max_attempts {
            return;
        }
        let delay = crash_restart_backoff(attempts, policy.backoff_initial, policy.backoff_max);
        let kernel = self.clone();
        let plugin_id = id.to_owned();
        self.runtime().spawn(async move {
            tokio::time::sleep(delay).await;
            let _ = kernel.send(Command::AutoRestart {
                id: plugin_id,
                generation,
            });
        });
    }
}

#[cfg(test)]
mod tests {
    //! 命令循环分支补测：毒锁兜底、停用竞态回滚、激活收尾判定与级联中止。
    //!
    //! 这些前置状态（毒化锁、`Pending` 且已收到停用请求、`Active` 但 Context 缺失）
    //! 无法经由 `Kernel` 的公开命令入口构造，因此用例直接驱动本模块的私有函数；
    //! 断言一律针对命令循环的可观察契约（应答内容、状态机写入、Fork/Context 处置、
    //! 循环存活）。

    use super::*;
    use crate::kernel::KernelOptions;
    use crate::plugin::{DependencySpec, EmptyConfigProvider, PluginRole};
    use chips_core::{ForkId, Version, VersionRange};
    use std::panic::AssertUnwindSafe;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::{Duration, Instant};

    /// 空执行器：分支用例只校验命令循环的状态写入，不关心插件代码行为。
    struct NullRunner;

    #[async_trait::async_trait]
    impl PluginRunner for NullRunner {
        async fn apply(&self, _ctx: &Context, _config: &PluginConfig) -> Result<(), KernelError> {
            Ok(())
        }

        async fn stop(&self, _ctx: &Context) -> Result<(), KernelError> {
            Ok(())
        }
    }

    /// 解析测试版本号。
    fn version(text: &str) -> Version {
        Version::parse(text).expect("测试版本号应合法")
    }

    /// 构造依赖声明。
    fn spec(id: &str, range: &str) -> DependencySpec {
        DependencySpec {
            id: id.to_owned(),
            range: VersionRange::parse(range).expect("测试版本范围应合法"),
        }
    }

    /// 构造加载请求。
    fn request_for(id: &str, dependencies: Vec<DependencySpec>) -> LoadRequest {
        LoadRequest {
            id: id.to_owned(),
            version: version("1.0.0"),
            available_versions: vec![version("1.0.0")],
            dependencies,
            role: PluginRole::Service,
            parent: None,
            runner: Arc::new(NullRunner),
        }
    }

    /// 构造以定制执行器承载的加载请求。
    fn request_with_runner(id: &str, runner: Arc<dyn PluginRunner>) -> LoadRequest {
        LoadRequest {
            id: id.to_owned(),
            version: version("1.0.0"),
            available_versions: vec![version("1.0.0")],
            dependencies: Vec::new(),
            role: PluginRole::Service,
            parent: None,
            runner,
        }
    }

    /// panic 型执行器：在被调用的生命周期回调内于 Rust 侧溃灭，
    /// 用于锁测 §6.8 崩溃隔离（工单047 臂①）。
    struct PanicRunner {
        panic_on_apply: bool,
        panic_on_stop: bool,
    }

    /// 计数型执行器：记录 `apply` 调用次数，用于锁定「自动重启确实重新
    /// 走完整激活链」与「熔断后不再重启」两类可观察形态。
    struct CountingRunner {
        applies: AtomicUsize,
    }

    impl CountingRunner {
        fn new() -> Arc<Self> {
            Arc::new(Self {
                applies: AtomicUsize::new(0),
            })
        }

        fn applies(&self) -> usize {
            self.applies.load(Ordering::SeqCst)
        }
    }

    #[async_trait::async_trait]
    impl PluginRunner for CountingRunner {
        async fn apply(&self, _ctx: &Context, _config: &PluginConfig) -> Result<(), KernelError> {
            self.applies.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }

        async fn stop(&self, _ctx: &Context) -> Result<(), KernelError> {
            Ok(())
        }
    }

    #[async_trait::async_trait]
    impl PluginRunner for PanicRunner {
        async fn apply(&self, _ctx: &Context, _config: &PluginConfig) -> Result<(), KernelError> {
            if self.panic_on_apply {
                panic!("测试注入：apply 在 Rust 侧 panic");
            }
            Ok(())
        }

        async fn stop(&self, _ctx: &Context) -> Result<(), KernelError> {
            if self.panic_on_stop {
                panic!("测试注入：stop 在 Rust 侧 panic");
            }
            Ok(())
        }
    }

    /// 新建内核（命令循环随内核启动）。
    fn new_kernel() -> Kernel {
        Kernel::new(tokio::runtime::Handle::current()).expect("内核应可创建")
    }

    /// 新建缩短崩溃重启策略的内核：§6.8 数值可注入，锁测禁真等 1s/30s。
    fn crash_kernel(window: Duration, max_attempts: u32, backoff: Duration) -> Kernel {
        Kernel::with_options(
            tokio::runtime::Handle::current(),
            KernelOptions {
                crash_restart_window: window,
                crash_restart_max_attempts: max_attempts,
                crash_restart_backoff_initial: backoff,
                crash_restart_backoff_max: backoff,
                ..KernelOptions::default()
            },
            Arc::new(EmptyConfigProvider),
        )
        .expect("内核应可创建")
    }

    /// 在窗口内为插件登记 `count` 次崩溃尝试。
    fn stamp_crash_attempts(kernel: &Kernel, id: &str, count: u32) {
        let mut guard = kernel.lock_state().expect("状态锁应可用");
        let policy = guard.plugins.crash_policy;
        let record = guard.plugins.record_mut(id).expect("插件记录应存在");
        for _ in 0..count {
            record.register_crash_attempt(Instant::now(), policy);
        }
    }

    /// 读取插件当前的崩溃重启世代凭证。
    fn restart_generation(kernel: &Kernel, id: &str) -> u64 {
        kernel
            .lock_state()
            .expect("状态锁应可用")
            .plugins
            .record(id)
            .expect("插件记录应存在")
            .crash_restart_generation
    }

    /// 直接登记插件并置为指定状态，用于构造命令循环内的分支前置状态。
    fn register_at(
        kernel: &Kernel,
        id: &str,
        dependencies: Vec<DependencySpec>,
        state: PluginState,
    ) {
        let mut guard = kernel.lock_state().expect("状态锁应可用");
        guard
            .plugins
            .register(request_for(id, dependencies))
            .expect("插件登记应成功");
        guard.plugins.set_state(id, state);
    }

    /// 为插件新建一个作用域 Fork 并挂到记录上（`context` 保持缺失）。
    fn attach_fork(kernel: &Kernel, id: &str) -> ForkId {
        let root = kernel.root_id();
        let mut guard = kernel.lock_state().expect("状态锁应可用");
        let fork = guard.create_fork(root, None);
        guard.plugins.record_mut(id).expect("插件记录应存在").fork = Some(fork);
        fork
    }

    /// 把插件登记为在飞（可选排队），模拟激活链或停用链已接管该插件。
    fn track_in_flight(kernel: &Kernel, id: &str, queued: bool) {
        let mut guard = kernel.lock_state().expect("状态锁应可用");
        guard.plugins.in_flight.insert(id.to_owned());
        if queued {
            guard.plugins.queued.insert(id.to_owned());
        }
    }

    /// 置入「已收到停用请求」标记：停用命令在 `Starting` / `Resolving` 窗口内的效果。
    fn request_cancel(kernel: &Kernel, id: &str) {
        let mut guard = kernel.lock_state().expect("状态锁应可用");
        guard
            .plugins
            .record_mut(id)
            .expect("插件记录应存在")
            .cancel_requested = true;
    }

    /// 以「持锁 panic」毒化状态锁：这是生产环境毒锁的唯一成因，也是命令循环
    /// 毒锁兜底分支的唯一合法触发方式。
    fn poison_state_lock(kernel: &Kernel) {
        let inner = Arc::clone(&kernel.inner);
        let worker = std::thread::spawn(move || {
            let _guard = inner.state.lock().expect("首次加锁应成功");
            panic!("测试注入：持锁 panic 以毒化状态锁");
        });
        assert!(worker.join().is_err(), "持锁线程应按预期 panic");
        assert!(kernel.lock_state().is_err(), "状态锁应已毒化");
    }

    /// 轮询等待条件成立；最长 2 秒。
    async fn wait_until(mut predicate: impl FnMut() -> bool) -> bool {
        for _ in 0..200 {
            if predicate() {
                return true;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        predicate()
    }

    #[tokio::test]
    async fn test_load_with_poisoned_lock_replies_error_and_keeps_loop_alive() {
        let kernel = new_kernel();
        poison_state_lock(&kernel);

        let error = kernel
            .load(request_for("poison-load", Vec::new()))
            .await
            .expect_err("毒锁下 load 应返回错误而非悬挂");
        assert!(
            matches!(error, KernelError::LockPoisoned),
            "应回传毒锁错误：{error:?}"
        );
        // 兜底分支返回 true：循环处理完该命令后必须继续接收后续命令。
        kernel
            .shutdown()
            .await
            .expect("命令循环应在毒锁命令之后继续存活");
    }

    #[tokio::test]
    async fn test_start_enable_with_poisoned_lock_replies_or_exits_quietly() {
        let kernel = new_kernel();
        register_at(&kernel, "poison-enable", Vec::new(), PluginState::Installed);
        poison_state_lock(&kernel);

        let (sender, receiver) = oneshot::channel();
        start_enable(&kernel, "poison-enable".to_owned(), Some(sender));
        let error = receiver
            .await
            .expect("应答应已送达")
            .expect_err("毒锁下应返回错误");
        assert!(
            matches!(error, KernelError::LockPoisoned),
            "应回传毒锁错误：{error:?}"
        );

        // 无应答方（`resume_pending` 自动续跑）时静默返回，不得 panic。
        start_enable(&kernel, "poison-enable".to_owned(), None);
        kernel.shutdown().await.expect("无应答分支不应破坏命令循环");
    }

    #[tokio::test]
    async fn test_target_outcome_reports_absent_failed_and_intermediate_states() {
        let kernel = new_kernel();

        // 目标不在登记表（激活链启动后被移除）：按未找到处理。
        let error = target_outcome(&kernel, "ghost-target").expect_err("目标缺失时应返回错误");
        assert!(
            matches!(error, KernelError::PluginNotFound { ref id } if id == "ghost-target"),
            "应回传未找到错误：{error:?}"
        );

        // 失败目标带根因：回传根因而非笼统的 apply 失败。
        register_at(&kernel, "failed-target", Vec::new(), PluginState::Failed);
        {
            let mut guard = kernel.lock_state().expect("状态锁应可用");
            guard
                .plugins
                .record_mut("failed-target")
                .expect("记录应存在")
                .last_failure = Some(KernelError::DependencyVersion {
                dependency: "dep".to_owned(),
                required: "^2.0.0".to_owned(),
                actual: "1.0.0".to_owned(),
                candidates: Vec::new(),
            });
        }
        let error = target_outcome(&kernel, "failed-target").expect_err("失败目标应返回错误");
        assert!(
            matches!(error, KernelError::DependencyVersion { ref dependency, .. } if dependency == "dep"),
            "应回传记录的根因错误：{error:?}"
        );

        // 失败目标无根因记录时落入兜底 apply 失败。
        register_at(&kernel, "bare-failed", Vec::new(), PluginState::Failed);
        let error = target_outcome(&kernel, "bare-failed").expect_err("失败目标应返回错误");
        assert!(
            matches!(error, KernelError::ApplyFailed { ref id } if id == "bare-failed"),
            "应回传兜底 apply 失败：{error:?}"
        );

        // 未进入终态的目标按当前状态回报。
        register_at(&kernel, "pending-target", Vec::new(), PluginState::Pending);
        assert_eq!(
            target_outcome(&kernel, "pending-target").expect("中间状态应作为结果返回"),
            PluginState::Pending
        );

        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_begin_activation_rolls_back_when_disable_arrived_before_start() {
        let kernel = new_kernel();
        register_at(
            &kernel,
            "cancelled-pending",
            Vec::new(),
            PluginState::Pending,
        );
        let root = kernel.root_id();
        let children_before = {
            let guard = kernel.lock_state().expect("状态锁应可用");
            guard
                .contexts
                .node(root)
                .expect("根 Context 应存在")
                .children
                .len()
        };
        request_cancel(&kernel, "cancelled-pending");

        let error = begin_activation(&kernel, "cancelled-pending")
            .err()
            .expect("已请求停用的插件不应进入 Resolving");
        assert!(
            matches!(
                error,
                KernelError::InvalidTransition { ref id, from, to }
                    if id == "cancelled-pending"
                        && from == PluginState::Pending
                        && to == PluginState::Installed
            ),
            "应回传 Pending -> Installed 的兜底迁移错误：{error:?}"
        );

        {
            let guard = kernel.lock_state().expect("状态锁应可用");
            let record = guard
                .plugins
                .record("cancelled-pending")
                .expect("记录应存在");
            assert_eq!(
                record.state,
                PluginState::Installed,
                "兜底路径应落回 Installed"
            );
            assert!(!record.cancel_requested, "兜底路径应清除停用标记");
            assert!(record.context.is_none(), "兜底路径不应绑定 Context");
            assert!(
                !guard.plugins.in_flight.contains("cancelled-pending"),
                "兜底路径在登记在飞标记之前就必须退出"
            );
            assert!(
                !guard.plugins.queued.contains("cancelled-pending"),
                "兜底路径本身不登记排队标记"
            );
            assert_eq!(
                guard
                    .contexts
                    .node(root)
                    .expect("根 Context 应存在")
                    .children
                    .len(),
                children_before,
                "兜底路径不应创建插件 Context"
            );
        }

        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_rollback_cancelled_is_noop_for_absent_plugin() {
        let kernel = new_kernel();
        rollback_cancelled(&kernel, "ghost-rollback").expect("缺失插件的回滚应是幂等 no-op");
        // 无记录时不得触碰任何 Context / Fork，循环照常收尾。
        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_rollback_cancelled_disposes_fork_when_context_absent() {
        let kernel = new_kernel();
        register_at(&kernel, "rollback-fork", Vec::new(), PluginState::Starting);
        let fork = attach_fork(&kernel, "rollback-fork");
        track_in_flight(&kernel, "rollback-fork", true);
        request_cancel(&kernel, "rollback-fork");

        rollback_cancelled(&kernel, "rollback-fork").expect("回滚应成功");

        {
            let guard = kernel.lock_state().expect("状态锁应可用");
            assert!(
                !guard.forks.contains_key(&fork),
                "缺少 Context 时应撤销插件作用域 Fork"
            );
            let record = guard.plugins.record("rollback-fork").expect("记录应存在");
            assert!(record.fork.is_none(), "回滚应取走 Fork 句柄");
            assert_eq!(record.state, PluginState::Installed);
            assert!(!record.cancel_requested);
            assert!(!guard.plugins.in_flight.contains("rollback-fork"));
            assert!(!guard.plugins.queued.contains("rollback-fork"));
        }

        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_rollback_cancelled_preserves_failure_and_disposes_context() {
        let kernel = new_kernel();
        register_at(&kernel, "rollback-failed", Vec::new(), PluginState::Failed);
        let root = kernel.root_id();
        let context = kernel
            .create_plugin_context(root)
            .expect("应可创建插件 Context");
        let context_id = context.id();
        // 与 `begin_activation` 的写入保持一致：记录上的 Fork 即插件 Context 的作用域 Fork。
        let fork = {
            let guard = kernel.lock_state().expect("状态锁应可用");
            guard
                .contexts
                .node(context_id)
                .expect("插件 Context 应存在")
                .fork
        };
        {
            let mut guard = kernel.lock_state().expect("状态锁应可用");
            let record = guard
                .plugins
                .record_mut("rollback-failed")
                .expect("记录应存在");
            record.context = Some(context_id);
            record.fork = Some(fork);
        }
        track_in_flight(&kernel, "rollback-failed", false);
        request_cancel(&kernel, "rollback-failed");

        rollback_cancelled(&kernel, "rollback-failed").expect("回滚应成功");

        {
            let guard = kernel.lock_state().expect("状态锁应可用");
            let record = guard.plugins.record("rollback-failed").expect("记录应存在");
            assert_eq!(
                record.state,
                PluginState::Failed,
                "失败状态不得被回滚覆盖为 Installed"
            );
            assert!(record.context.is_none(), "回滚应取走 Context 句柄");
            assert!(record.fork.is_none(), "回滚应取走 Fork 句柄");
            assert!(!record.cancel_requested, "回滚应清除停用标记");
            assert!(
                guard.contexts.node(context_id).is_none(),
                "回滚应销毁插件 Context"
            );
            assert!(
                !guard.forks.contains_key(&fork),
                "回滚应随 Context 一并撤销作用域 Fork"
            );
            assert!(!guard.plugins.in_flight.contains("rollback-failed"));
        }

        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_finish_activation_for_absent_plugin_reports_not_found() {
        let kernel = new_kernel();
        let error = finish_activation(&kernel, "ghost-finish", ActivationOutcome::Applied)
            .expect_err("缺失插件的激活收尾应返回错误");
        assert!(
            matches!(error, KernelError::PluginNotFound { ref id } if id == "ghost-finish"),
            "应回传未找到错误：{error:?}"
        );
        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_finish_activation_keeps_failure_when_apply_succeeded_late() {
        // apply 返回成功、但插件在此期间已失败（例如注入回调出错）：
        // 失败状态保持不回退，仅摘掉在飞标记，Fork 留给停用流程处置。
        let kernel = new_kernel();
        register_at(&kernel, "failed-applied", Vec::new(), PluginState::Failed);
        let fork = attach_fork(&kernel, "failed-applied");
        track_in_flight(&kernel, "failed-applied", false);
        let failure = KernelError::ApplyFailed {
            id: "failed-applied".to_owned(),
        };
        {
            let mut guard = kernel.lock_state().expect("状态锁应可用");
            let record = guard
                .plugins
                .record_mut("failed-applied")
                .expect("记录应存在");
            record.last_failure = Some(failure.clone());
            record.last_error = Some(failure.into());
        }

        let proceed = finish_activation(&kernel, "failed-applied", ActivationOutcome::Applied)
            .expect("激活收尾应成功");
        assert!(!proceed, "已失败的插件不应继续激活链");

        {
            let guard = kernel.lock_state().expect("状态锁应可用");
            let record = guard.plugins.record("failed-applied").expect("记录应存在");
            assert_eq!(record.state, PluginState::Failed, "失败状态不得回退");
            assert!(
                record.last_failure.is_some() && record.last_error.is_some(),
                "失败诊断不得被迟到的 apply 成功清除"
            );
            assert!(
                !guard.plugins.in_flight.contains("failed-applied"),
                "应清除在飞标记"
            );
            assert!(guard.forks.contains_key(&fork), "失败分支不应撤销 Fork");
            assert_eq!(record.fork, Some(fork), "Fork 句柄应保留给后续停用");
            assert!(!record.cancel_requested, "失败分支不应改写停用标记");
        }

        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_finish_stop_for_absent_plugin_reports_not_found() {
        let kernel = new_kernel();
        let error = finish_stop(&kernel, "ghost-stop").expect_err("缺失插件的停用收尾应返回错误");
        assert!(
            matches!(error, KernelError::PluginNotFound { ref id } if id == "ghost-stop"),
            "应回传未找到错误：{error:?}"
        );
        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_finish_stop_disposes_fork_when_context_absent() {
        let kernel = new_kernel();
        register_at(&kernel, "stop-fork", Vec::new(), PluginState::Stopping);
        let fork = attach_fork(&kernel, "stop-fork");
        track_in_flight(&kernel, "stop-fork", false);
        request_cancel(&kernel, "stop-fork");

        finish_stop(&kernel, "stop-fork").expect("停用收尾应成功");

        {
            let guard = kernel.lock_state().expect("状态锁应可用");
            assert!(
                !guard.forks.contains_key(&fork),
                "缺少 Context 时应撤销作用域 Fork"
            );
            let record = guard.plugins.record("stop-fork").expect("记录应存在");
            assert_eq!(
                record.state,
                PluginState::Installed,
                "停用收尾应落回 Installed"
            );
            assert!(record.fork.is_none());
            assert!(!record.cancel_requested);
            assert!(!guard.plugins.in_flight.contains("stop-fork"));
        }

        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_begin_stop_for_active_plugin_without_context_reports_not_found() {
        let kernel = new_kernel();
        register_at(
            &kernel,
            "stop-missing-context",
            Vec::new(),
            PluginState::Active,
        );
        let error = begin_stop(&kernel, "stop-missing-context")
            .err()
            .expect("缺少 Context 的 Active 插件不应进入 Stopping");
        assert!(
            matches!(error, KernelError::PluginNotFound { ref id } if id == "stop-missing-context"),
            "应回传未找到错误：{error:?}"
        );
        assert_eq!(
            kernel.plugin_state("stop-missing-context"),
            Some(PluginState::Active),
            "失败的停用请求不得改变插件状态"
        );
        {
            let guard = kernel.lock_state().expect("状态锁应可用");
            assert!(
                !guard.plugins.in_flight.contains("stop-missing-context"),
                "失败的停用请求不得登记在飞标记"
            );
        }
        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_cascade_disable_aborts_and_reports_first_failure() {
        let kernel = new_kernel();
        register_at(&kernel, "cascade-target", Vec::new(), PluginState::Active);
        register_at(
            &kernel,
            "cascade-dependent",
            vec![spec("cascade-target", "^1.0.0")],
            PluginState::Active,
        );

        // 非级联：存在 Active 依赖者时先被拒绝，且不触碰任何一方。
        let error = kernel
            .disable("cascade-target", false)
            .await
            .expect_err("存在 Active 依赖者时应拒绝停用");
        assert!(
            matches!(error, KernelError::DependencyConflict { ref plugin, ref dependents }
                if plugin == "cascade-target" && dependents == &vec!["cascade-dependent".to_owned()]),
            "应回传依赖冲突：{error:?}"
        );

        // 级联：按逆拓扑序先停用依赖者；依赖者停用失败即中止，目标保持 Active。
        let error = kernel
            .disable("cascade-target", true)
            .await
            .expect_err("停用链条失败时应回传错误");
        assert!(
            matches!(error, KernelError::PluginNotFound { ref id } if id == "cascade-dependent"),
            "应中止并回传首个失败环节：{error:?}"
        );
        assert_eq!(
            kernel.plugin_state("cascade-dependent"),
            Some(PluginState::Active),
            "失败环节不应被改写状态"
        );
        assert_eq!(
            kernel.plugin_state("cascade-target"),
            Some(PluginState::Active),
            "中止后目标不应被继续停用"
        );
        {
            let guard = kernel.lock_state().expect("状态锁应可用");
            assert!(
                guard.plugins.in_flight.is_empty(),
                "中止的链条不应留下在飞标记"
            );
            assert!(
                guard.plugins.queued.is_empty(),
                "中止的链条不应留下排队标记"
            );
        }

        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_resume_pending_drives_chain_and_degrades_on_poisoned_lock() {
        let kernel = new_kernel();
        register_at(&kernel, "resume-a", Vec::new(), PluginState::Pending);
        kernel.resume_pending();
        assert!(
            wait_until(|| kernel.plugin_state("resume-a") == Some(PluginState::Active)).await,
            "resume_pending 应驱动 Pending 插件完成激活链"
        );

        poison_state_lock(&kernel);
        let result = std::panic::catch_unwind(AssertUnwindSafe(|| kernel.resume_pending()));
        assert!(
            result.is_ok(),
            "毒锁时 resume_pending 必须静默返回，不得 panic"
        );
        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_record_plugin_diagnostic_degrades_on_poisoned_lock() {
        let kernel = new_kernel();
        register_at(&kernel, "diag", Vec::new(), PluginState::Active);
        // 健康对照组：诊断必须真实写入 `last_error`。
        kernel.record_plugin_diagnostic(
            "diag",
            KernelError::ApplyFailed {
                id: "diag".to_owned(),
            },
        );
        assert!(
            kernel.plugin_last_error("diag").is_some(),
            "健康锁下诊断应被记录"
        );

        poison_state_lock(&kernel);
        let result = std::panic::catch_unwind(AssertUnwindSafe(|| {
            kernel.record_plugin_diagnostic("diag", KernelError::LockPoisoned);
        }));
        assert!(result.is_ok(), "毒锁时诊断记录必须静默降级，不得 panic");
        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_apply_panic_converges_and_chain_aftercare_completes() {
        // §6.8 崩溃隔离锁测（工单047 臂①）：apply 的 Rust 侧 panic 与返回
        // `Err` 同形收敛——应答收敛、终态非 Starting、queued/in_flight 无
        // 残留、失败记录在案、链尾 `resume_pending` 恢复挂起插件。
        let kernel = new_kernel();
        // 预置 Pending 插件：只有激活链尾部的善后流程真实走完，它才会被
        // `resume_pending` 驱动到 `Active`。
        register_at(
            &kernel,
            "resume-after-panic",
            Vec::new(),
            PluginState::Pending,
        );

        let error = tokio::time::timeout(
            Duration::from_secs(2),
            kernel.load(request_with_runner(
                "panicky",
                Arc::new(PanicRunner {
                    panic_on_apply: true,
                    panic_on_stop: false,
                }),
            )),
        )
        .await
        .expect("panic 臂的加载应答必须收敛，不得悬挂")
        .expect_err("apply panic 应回传失败结果");
        assert!(
            matches!(error, KernelError::ApplyFailed { ref id } if id == "panicky"),
            "应回传收敛后的 apply 失败：{error:?}"
        );
        assert_eq!(
            kernel.plugin_state("panicky"),
            Some(PluginState::Failed),
            "panic 臂终态不得滞留 Starting"
        );

        // 链尾善后（queued 清理 → resume_pending 驱动挂起插件）全部走完的
        // 可观察形态：挂起插件 Active，且两个集合都已清空。
        assert!(
            wait_until(|| {
                kernel.lock_state().is_ok_and(|state| {
                    state.plugins.queued.is_empty()
                        && state.plugins.in_flight.is_empty()
                        && state
                            .plugins
                            .record("resume-after-panic")
                            .is_some_and(|record| record.state == PluginState::Active)
                })
            })
            .await,
            "panic 臂必须同样执行善后三件套：queued 清理与 resume_pending 恢复挂起插件"
        );
        {
            let guard = kernel.lock_state().expect("状态锁应可用");
            let record = guard.plugins.record("panicky").expect("插件记录应存在");
            assert!(
                record.last_failure.is_some(),
                "崩溃应留下失败记录（last_failure）"
            );
        }

        kernel
            .shutdown()
            .await
            .expect("命令循环应在 apply panic 隔离后继续存活");
    }

    #[tokio::test]
    async fn test_stop_panic_disable_still_reaches_installed() {
        // §6.8 崩溃隔离锁测（清理路径）：stop 的 Rust 侧 panic 不溃灭停用链，
        // 按 §6.4 规则 2 继续撤销并进入 `Installed`，panic 记入在册诊断。
        let kernel = new_kernel();
        kernel
            .load(request_with_runner(
                "stop-panicky",
                Arc::new(PanicRunner {
                    panic_on_apply: false,
                    panic_on_stop: true,
                }),
            ))
            .await
            .expect("apply 正常，插件应激活");

        tokio::time::timeout(
            Duration::from_secs(2),
            kernel.disable("stop-panicky", false),
        )
        .await
        .expect("stop panic 臂的停用应答必须收敛，不得悬挂")
        .expect("stop panic 不阻断停用（§6.4）");

        assert_eq!(
            kernel.plugin_state("stop-panicky"),
            Some(PluginState::Installed),
            "stop panic 后仍应完成撤销进入 Installed"
        );
        assert!(
            wait_until(|| kernel
                .lock_state()
                .is_ok_and(|state| state.plugins.in_flight.is_empty()))
            .await,
            "停用链不得留下在飞残留"
        );
        let diagnostic = kernel
            .plugin_last_error("stop-panicky")
            .expect("stop panic 应记入诊断");
        assert_eq!(
            diagnostic.code(),
            "KERNEL_PLUGIN_PANICKED",
            "panic 归一应在册错误码 KERNEL_PLUGIN_PANICKED"
        );
        kernel
            .shutdown()
            .await
            .expect("命令循环应在 stop panic 隔离后继续存活");
    }

    #[tokio::test]
    async fn test_task_panic_converges_active_to_failed_and_auto_restarts() {
        // §6.2 / §6.8 判定闭环 + 自动重启调度锁测（工单047 臂②）：Active 插件
        // 的运行期崩溃经在册 `Active → Failed` 收敛、首因入审计、计入窗口
        // 计数，并按退避重新走一遍激活链。
        let kernel = crash_kernel(Duration::from_secs(600), 3, Duration::from_millis(5));
        let runner = CountingRunner::new();
        kernel
            .load(request_with_runner(
                "crash-loop",
                Arc::clone(&runner) as Arc<dyn PluginRunner>,
            ))
            .await
            .expect("前置激活应成功");
        assert_eq!(runner.applies(), 1);
        assert_eq!(
            kernel.plugin_crash_attempts("crash-loop"),
            Some(0),
            "干净激活不计数"
        );

        kernel.handle_plugin_task_panic("crash-loop");

        assert_eq!(
            kernel.plugin_state("crash-loop"),
            Some(PluginState::Failed),
            "运行期崩溃必须经在册迁移收敛到 Failed"
        );
        assert_eq!(
            kernel.plugin_crash_attempts("crash-loop"),
            Some(1),
            "收敛到 Failed 即计入崩溃重启窗口一次"
        );
        let diagnostic = kernel
            .plugin_last_error("crash-loop")
            .expect("崩溃首因必须入审计面");
        assert_eq!(diagnostic.code(), "KERNEL_PLUGIN_PANICKED");

        assert!(
            wait_until(|| kernel.plugin_state("crash-loop") == Some(PluginState::Active)).await,
            "窗口内未超限应按退避自动重启，回到 Active"
        );
        assert_eq!(runner.applies(), 2, "自动重启必须重新执行激活链");
        assert_eq!(
            kernel.plugin_crash_attempts("crash-loop"),
            Some(1),
            "重启成功不清零窗口计数（只有 enable / 停用 / 卸载清零）"
        );

        kernel
            .shutdown()
            .await
            .expect("命令循环应在自动重启后继续存活");
    }

    #[tokio::test]
    async fn test_task_panic_stops_auto_restarting_when_window_exhausted() {
        // §6.8 熔断上限：窗口内第 4 次尝试超出 3 次上限后停止自动重启，
        // 插件停留 `Failed` 等待显式 enable。
        let kernel = crash_kernel(Duration::from_secs(600), 3, Duration::from_millis(5));
        let runner = CountingRunner::new();
        kernel
            .load(request_with_runner(
                "breaker",
                Arc::clone(&runner) as Arc<dyn PluginRunner>,
            ))
            .await
            .expect("前置激活应成功");

        for attempt in 1..=4_u32 {
            assert_eq!(
                kernel.plugin_state("breaker"),
                Some(PluginState::Active),
                "第 {attempt} 次崩溃前插件应处于 Active"
            );
            kernel.handle_plugin_task_panic("breaker");
            assert_eq!(
                kernel.plugin_state("breaker"),
                Some(PluginState::Failed),
                "第 {attempt} 次崩溃应收敛到 Failed"
            );
            assert_eq!(
                kernel.plugin_crash_attempts("breaker"),
                Some(attempt),
                "第 {attempt} 次崩溃的窗口计数"
            );
            if attempt <= 3 {
                assert!(
                    wait_until(|| kernel.plugin_state("breaker") == Some(PluginState::Active))
                        .await,
                    "第 {attempt} 次未超限，应自动重启"
                );
            }
        }

        // 超限后定时器与任何自动路径都不再重启它。
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert_eq!(
            kernel.plugin_state("breaker"),
            Some(PluginState::Failed),
            "超限后必须停留 Failed"
        );
        assert_eq!(
            runner.applies(),
            4,
            "首次激活 + 3 次自动重启，第 4 次崩溃后不得再激活"
        );

        // 显式 enable 解除熔断：重置计数并重新激活。
        let state = tokio::time::timeout(Duration::from_secs(2), kernel.enable("breaker"))
            .await
            .expect("enable 应答应收敛")
            .expect("超限插件经显式 enable 应重新放行");
        assert_eq!(state, PluginState::Active);
        assert_eq!(
            kernel.plugin_crash_attempts("breaker"),
            Some(0),
            "显式 enable 必须重置窗口计数"
        );
        assert_eq!(runner.applies(), 5);

        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_auto_restart_revalidates_state_before_restart() {
        // 退避定时器到点的复核臂：世代凭证不符、停用抑制位在置、非 `Failed`、
        // 被在飞链条接管、窗口超限、未登记插件六类都只空转返回，不改写状态机。
        let kernel = crash_kernel(Duration::from_secs(600), 3, Duration::from_millis(5));

        handle_auto_restart(&kernel, "ghost-plugin", 0);
        assert_eq!(kernel.plugin_state("ghost-plugin"), None);

        register_at(&kernel, "stale-plugin", Vec::new(), PluginState::Failed);
        stamp_crash_attempts(&kernel, "stale-plugin", 1);
        handle_auto_restart(
            &kernel,
            "stale-plugin",
            restart_generation(&kernel, "stale-plugin") + 1,
        );
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(
            kernel.plugin_state("stale-plugin"),
            Some(PluginState::Failed),
            "世代凭证不符的退避待重启（已被停用/启用/装载作废）必须空转"
        );

        register_at(&kernel, "muted-plugin", Vec::new(), PluginState::Failed);
        stamp_crash_attempts(&kernel, "muted-plugin", 1);
        {
            let mut guard = kernel.lock_state().expect("状态锁应可用");
            guard
                .plugins
                .record_mut("muted-plugin")
                .expect("插件记录应存在")
                .auto_restart_suppressed = true;
        }
        let muted_generation = restart_generation(&kernel, "muted-plugin");
        handle_auto_restart(&kernel, "muted-plugin", muted_generation);
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(
            kernel.plugin_state("muted-plugin"),
            Some(PluginState::Failed),
            "停用抑制位在置时迟到的崩溃判定不得复生插件"
        );
        // 用户显式放行（enable / load 的机制入口）清除抑制位后重启资格恢复。
        {
            let mut guard = kernel.lock_state().expect("状态锁应可用");
            guard
                .plugins
                .record_mut("muted-plugin")
                .expect("插件记录应存在")
                .allow_auto_restart();
        }
        handle_auto_restart(
            &kernel,
            "muted-plugin",
            restart_generation(&kernel, "muted-plugin"),
        );
        assert!(
            wait_until(|| kernel.plugin_state("muted-plugin") == Some(PluginState::Active)).await,
            "解除抑制后应恢复自动重启资格"
        );

        register_at(&kernel, "running-plugin", Vec::new(), PluginState::Active);
        handle_auto_restart(&kernel, "running-plugin", 0);
        assert_eq!(
            kernel.plugin_state("running-plugin"),
            Some(PluginState::Active),
            "Active 插件不在重启复核范围内"
        );

        register_at(&kernel, "taken-plugin", Vec::new(), PluginState::Failed);
        track_in_flight(&kernel, "taken-plugin", true);
        handle_auto_restart(&kernel, "taken-plugin", 0);
        assert_eq!(
            kernel.plugin_state("taken-plugin"),
            Some(PluginState::Failed),
            "已被链条接管时定时器空转"
        );

        register_at(&kernel, "spent-plugin", Vec::new(), PluginState::Failed);
        stamp_crash_attempts(&kernel, "spent-plugin", 4);
        handle_auto_restart(&kernel, "spent-plugin", 0);
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(
            kernel.plugin_state("spent-plugin"),
            Some(PluginState::Failed),
            "窗口超限后复核必须拒绝重启"
        );

        register_at(&kernel, "fresh-plugin", Vec::new(), PluginState::Failed);
        stamp_crash_attempts(&kernel, "fresh-plugin", 2);
        handle_auto_restart(&kernel, "fresh-plugin", 0);
        assert!(
            wait_until(|| kernel.plugin_state("fresh-plugin") == Some(PluginState::Active)).await,
            "未超限的 Failed 插件应经在册迁移重启"
        );
        assert_eq!(
            kernel.plugin_crash_attempts("fresh-plugin"),
            Some(2),
            "复核重启不得篡改窗口计数"
        );

        // 毒锁降级：复核静默放弃，不得 panic。
        poison_state_lock(&kernel);
        handle_auto_restart(&kernel, "running-plugin", 0);
    }

    #[tokio::test]
    async fn test_disable_during_in_flight_chain_holds_reply_and_cancels_restart() {
        // §6.8 停用取消（:399 竞态红案的单元锁测）：`disable` 命中在飞激活
        // （自动重启）链时回执挂账，直到链条收敛点把插件定稿才补发——
        // 停用返回 `Ok` 即「确定不再运行」，紧随的卸载按在册迁移直接成功；
        // 停用同时递增世代并置抑制位，停用前登记的退避待重启全部作废。
        let kernel = crash_kernel(Duration::from_secs(600), 3, Duration::from_millis(5));
        register_at(&kernel, "mid-chain", Vec::new(), PluginState::Starting);
        attach_fork(&kernel, "mid-chain");
        track_in_flight(&kernel, "mid-chain", false);
        stamp_crash_attempts(&kernel, "mid-chain", 1);
        let generation_before_disable = restart_generation(&kernel, "mid-chain");

        let (reply, mut reply_rx) = oneshot::channel();
        handle_disable(&kernel, "mid-chain".to_owned(), false, reply);
        assert!(
            tokio::time::timeout(Duration::from_millis(20), &mut reply_rx)
                .await
                .is_err(),
            "在飞链未收尾时停用回执必须挂账，不得乐观放行卸载竞态"
        );
        assert_ne!(
            restart_generation(&kernel, "mid-chain"),
            generation_before_disable,
            "停用必须递增重启世代，作废在停用前登记的退避待重启"
        );

        // 链条收敛点（回滚臂）定稿插件：挂账回执随即补发。
        rollback_cancelled(&kernel, "mid-chain").expect("回滚应成功");
        tokio::time::timeout(Duration::from_secs(2), reply_rx)
            .await
            .expect("链收敛后停用回执必须补发")
            .expect("回执通道应完好")
            .expect("停用应回执成功");
        assert_eq!(
            kernel.plugin_state("mid-chain"),
            Some(PluginState::Installed),
            "停用收敛到 Installed"
        );
        assert_eq!(
            kernel.plugin_crash_attempts("mid-chain"),
            Some(0),
            "停用清零崩溃重启计数"
        );

        // 停用前世代的陈旧退避待重启到点即空转，不会把插件重新拉起。
        handle_auto_restart(&kernel, "mid-chain", generation_before_disable);
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(
            kernel.plugin_state("mid-chain"),
            Some(PluginState::Installed)
        );

        // 紧随停用之后的卸载：`Installed → Removed` 在册合法，直接成功。
        handle_unload(&kernel, "mid-chain").expect("Installed 插件应可卸载");
        assert_eq!(kernel.plugin_state("mid-chain"), Some(PluginState::Removed));
        assert_eq!(kernel.plugin_crash_attempts("mid-chain"), Some(0));
    }

    #[tokio::test]
    async fn test_delayed_crash_judgement_settles_held_disable_without_revival() {
        // 停用与迟到崩溃判定的竞态收口：挂账停用等到的收敛点若是判定臂
        // （`Starting → Failed`），同样补发回执；停用抑制位保证该次崩溃
        // 登记的退避待重启到点后不得把已被用户停用的插件复生。
        let kernel = crash_kernel(Duration::from_secs(600), 3, Duration::from_millis(5));
        register_at(
            &kernel,
            "crash-after-disable",
            Vec::new(),
            PluginState::Starting,
        );
        attach_fork(&kernel, "crash-after-disable");
        track_in_flight(&kernel, "crash-after-disable", false);

        let (reply, reply_rx) = oneshot::channel();
        handle_disable(&kernel, "crash-after-disable".to_owned(), false, reply);
        kernel.handle_plugin_task_panic("crash-after-disable");
        tokio::time::timeout(Duration::from_secs(2), reply_rx)
            .await
            .expect("判定臂定稿后停用回执必须补发")
            .expect("回执通道应完好")
            .expect("停用应回执成功");
        assert_eq!(
            kernel.plugin_state("crash-after-disable"),
            Some(PluginState::Failed),
            "崩溃判定照常收敛到 Failed"
        );
        assert_eq!(
            kernel.plugin_crash_attempts("crash-after-disable"),
            Some(1),
            "判定收敛照常计入窗口（后续卸载会清零）"
        );

        // 本次崩溃登记的退避（注入 5ms）到点后因抑制位在置而空转：
        // 用户停用意图不被复生。
        tokio::time::sleep(Duration::from_millis(60)).await;
        assert_eq!(
            kernel.plugin_state("crash-after-disable"),
            Some(PluginState::Failed),
            "被停用的插件不得因崩溃重启定时器复生"
        );
        handle_unload(&kernel, "crash-after-disable").expect("Failed 插件应可卸载");
        assert_eq!(
            kernel.plugin_state("crash-after-disable"),
            Some(PluginState::Removed)
        );
        assert_eq!(
            kernel.plugin_crash_attempts("crash-after-disable"),
            Some(0),
            "卸载清零计数"
        );
    }

    #[tokio::test]
    async fn test_panic_hook_converges_active_and_in_flight_but_not_settled_states() {
        // 判定闭环的状态门：会收敛到 `Failed` 的在册状态（`Active` 与在飞的
        // `Starting` / `Resolving`）才改写；已由其它生命周期结论定稿的状态
        // （`Installed` / `Pending` / `Stopping` / `Removed`）与未登记插件整体
        // 空转，连审计也不覆写。
        let kernel = crash_kernel(Duration::from_secs(600), 3, Duration::from_millis(5));
        register_at(&kernel, "idle-plugin", Vec::new(), PluginState::Installed);
        kernel.handle_plugin_task_panic("idle-plugin");
        assert_eq!(
            kernel.plugin_state("idle-plugin"),
            Some(PluginState::Installed),
            "已定稿状态不被迟到的崩溃通知覆写"
        );
        assert_eq!(kernel.plugin_crash_attempts("idle-plugin"), Some(0));
        assert!(
            kernel.plugin_last_error("idle-plugin").is_none(),
            "未收敛则不写审计"
        );
        for (id, state) in [
            ("pending-plugin", PluginState::Pending),
            ("stopping-plugin", PluginState::Stopping),
            ("removed-plugin", PluginState::Removed),
        ] {
            register_at(&kernel, id, Vec::new(), state);
            kernel.handle_plugin_task_panic(id);
            assert_eq!(kernel.plugin_state(id), Some(state), "{id} 不得被改写");
            assert_eq!(kernel.plugin_crash_attempts(id), Some(0));
        }
        kernel.handle_plugin_task_panic("absent-plugin");
        assert_eq!(kernel.plugin_state("absent-plugin"), None);

        // `apply` 内任务先于激活链收尾 panic：按中间态收敛，判定不漏。
        register_at(
            &kernel,
            "starting-plugin",
            Vec::new(),
            PluginState::Starting,
        );
        attach_fork(&kernel, "starting-plugin");
        kernel.handle_plugin_task_panic("starting-plugin");
        assert_eq!(
            kernel.plugin_state("starting-plugin"),
            Some(PluginState::Failed),
            "在飞激活链的崩溃必须收敛到 Failed"
        );
        assert_eq!(
            kernel.plugin_crash_attempts("starting-plugin"),
            Some(1),
            "中间态收敛同样计入崩溃重启窗口"
        );
        kernel.shutdown().await.expect("命令循环应仍然存活");
    }

    #[tokio::test]
    async fn test_disable_and_unload_clear_crash_window() {
        // §6.8 计数生命周期：停用（`Installed`）与卸载（`Removed`）清零窗口。
        let kernel = crash_kernel(Duration::from_secs(600), 3, Duration::from_millis(5));
        let runner = CountingRunner::new();
        kernel
            .load(request_with_runner(
                "cleared-on-stop",
                Arc::clone(&runner) as Arc<dyn PluginRunner>,
            ))
            .await
            .expect("前置激活应成功");
        kernel.handle_plugin_task_panic("cleared-on-stop");
        assert_eq!(kernel.plugin_crash_attempts("cleared-on-stop"), Some(1));
        assert!(
            wait_until(|| kernel.plugin_state("cleared-on-stop") == Some(PluginState::Active))
                .await
        );

        kernel
            .disable("cleared-on-stop", false)
            .await
            .expect("停用应成功");
        assert_eq!(
            kernel.plugin_state("cleared-on-stop"),
            Some(PluginState::Installed)
        );
        assert_eq!(
            kernel.plugin_crash_attempts("cleared-on-stop"),
            Some(0),
            "停用必须清零崩溃重启计数"
        );

        kernel
            .unload("cleared-on-stop")
            .await
            .expect("Installed 插件应可卸载");
        assert_eq!(
            kernel.plugin_state("cleared-on-stop"),
            Some(PluginState::Removed)
        );
        assert_eq!(
            kernel.plugin_crash_attempts("cleared-on-stop"),
            Some(0),
            "卸载后计数保持清零态"
        );
        kernel.shutdown().await.expect("命令循环应仍然存活");
    }
}
