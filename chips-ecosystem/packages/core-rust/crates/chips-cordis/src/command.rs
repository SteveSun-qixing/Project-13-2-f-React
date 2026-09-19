//! 命令循环：生命周期状态的唯一写者。
//!
//! 对应《薯片内核设计》§6.3、§10.2：`load` / `enable` / `disable` / `unload`
//! 经命令队列串行执行；`apply` / `stop` 在循环外以任务执行并带超时，循环在
//! 等待期间继续处理其他命令。

use std::sync::Arc;

use chips_core::{ContextId, PluginId};
use tokio::sync::{mpsc, oneshot};

use crate::context::Context;
use crate::error::{KernelError, LifecyclePhase};
use crate::kernel::Kernel;
use crate::plugin::{LoadPlan, LoadRequest, PluginConfig, PluginRunner, PluginState};

/// 激活结果。
#[derive(Debug, Clone, Copy)]
pub(crate) enum ActivationOutcome {
    /// apply 成功返回。
    Applied,
    /// apply 返回错误。
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
                Ok(()) => start_enable(kernel, id, Some(reply)),
            }
            true
        }
        Command::Enable { id, reply } => {
            let known = kernel.plugin_state(&id).is_some();
            if known {
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
        let outcome = match tokio::time::timeout(
            apply_timeout,
            ticket.runner.apply(&ticket.context, &ticket.config),
        )
        .await
        {
            Ok(Ok(())) => ActivationOutcome::Applied,
            Ok(Err(_)) => ActivationOutcome::RunnerFailed,
            Err(_) => ActivationOutcome::TimedOut,
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
            }
            drop(state);
            let _ = reply.send(Ok(()));
        }
        Some(PluginState::Starting) | Some(PluginState::Resolving) => {
            if let Ok(mut state) = kernel.lock_state() {
                if let Some(record) = state.plugins.record_mut(&id) {
                    record.cancel_requested = true;
                }
            }
            let _ = reply.send(Ok(()));
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
    let outcome = tokio::time::timeout(stop_timeout, ticket.runner.stop(&ticket.context)).await;
    let diagnostic = match outcome {
        Ok(Ok(())) => None,
        Ok(Err(error)) => Some(error),
        Err(_) => Some(KernelError::LifecycleTimeout {
            id: id.to_owned(),
            phase: LifecyclePhase::Stop,
        }),
    };
    kernel.finish_stop_command(id).await?;
    if let Some(error) = diagnostic {
        // stop 失败/超时不阻断停用（内核设计 §6.4、§6.7）：仅记录诊断。
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
    state.plugins.set_state(id, PluginState::Removed);
    Ok(())
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
}
