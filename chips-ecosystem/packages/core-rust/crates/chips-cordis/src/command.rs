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

#[cfg(test)]
mod tests {
    //! 命令循环分支补测：毒锁兜底、停用竞态回滚、激活收尾判定与级联中止。
    //!
    //! 这些前置状态（毒化锁、`Pending` 且已收到停用请求、`Active` 但 Context 缺失）
    //! 无法经由 `Kernel` 的公开命令入口构造，因此用例直接驱动本模块的私有函数；
    //! 断言一律针对命令循环的可观察契约（应答内容、状态机写入、Fork/Context 处置、
    //! 循环存活）。

    use super::*;
    use crate::plugin::{DependencySpec, PluginRole};
    use chips_core::{ForkId, Version, VersionRange};
    use std::panic::AssertUnwindSafe;
    use std::time::Duration;

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

    /// 新建内核（命令循环随内核启动）。
    fn new_kernel() -> Kernel {
        Kernel::new(tokio::runtime::Handle::current()).expect("内核应可创建")
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
}
