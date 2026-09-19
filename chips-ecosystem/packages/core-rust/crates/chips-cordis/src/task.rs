//! 后台任务与协作式取消。
//!
//! 对应《薯片内核设计》§4.2、§6.7、§10.4：任务登记到当前 Fork，随 Fork 撤销
//! 触发取消并等待退出至多 `FORK_FORCE_DISPOSE_TIMEOUT`；活跃任务数计入插件
//! 软配额。

use std::fmt;
use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use tokio::sync::Notify;

use chips_core::{ContextId, PluginId};

use crate::context::Context;
use crate::error::{KernelError, LifecyclePhase};
use crate::kernel::Kernel;

/// 协作式取消信号；由内核创建并传入任务，任务周期性检查。
#[derive(Debug, Clone, Default)]
pub struct TaskSignal {
    inner: Arc<TaskSignalState>,
}

#[derive(Debug, Default)]
struct TaskSignalState {
    cancelled: AtomicBool,
    notify: Notify,
}

impl TaskSignal {
    /// 创建未取消的信号。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// 触发取消；幂等；可从任意线程调用。
    pub fn cancel(&self) {
        self.inner.cancelled.store(true, Ordering::Release);
        self.inner.notify.notify_waiters();
    }

    /// 任务周期性检查；返回 `true` 表示应尽快退出并释放已占用资源。
    #[must_use]
    pub fn is_cancelled(&self) -> bool {
        self.inner.cancelled.load(Ordering::Acquire)
    }

    /// 等待取消；已取消时立即返回（内核内部使用）。
    pub(crate) async fn wait_cancelled(&self) {
        loop {
            let notified = self.inner.notify.notified();
            if self.is_cancelled() {
                return;
            }
            notified.await;
            if self.is_cancelled() {
                return;
            }
        }
    }
}

/// 任务登记选项；与 TypeScript 视图 `ctx.task(fn, { name?, signal? })` 对应。
#[derive(Debug, Clone, Default)]
pub struct TaskOptions {
    /// 任务名；用于诊断、审计与配额计量展示。
    pub name: Option<String>,
    /// 外部取消信号；任务同时受所属 Fork 的取消约束。
    pub signal: Option<TaskSignal>,
}

/// 后台任务句柄；由 `Context::task` 返回。
#[derive(Clone)]
pub struct TaskHandle {
    /// 任务名；未命名时为 `None`。
    pub name: Option<String>,
    control: Arc<TaskControl>,
}

impl fmt::Debug for TaskHandle {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("TaskHandle")
            .field("name", &self.name)
            .finish_non_exhaustive()
    }
}

impl TaskHandle {
    /// 等待任务退出；任务失败、被取消或 panic 时返回错误。
    pub async fn join(&self) -> Result<(), KernelError> {
        loop {
            let notified = self.control.completion_notify.notified();
            if let Some(result) = self.control.result()? {
                return result;
            }
            notified.await;
        }
    }

    /// 请求取消；幂等。
    pub fn cancel(&self) {
        self.control.signal.cancel();
    }

    /// 协作式取消信号。
    #[must_use]
    pub fn signal(&self) -> TaskSignal {
        self.control.signal.clone()
    }

    /// 是否已结束。
    #[must_use]
    pub fn is_finished(&self) -> bool {
        self.control
            .completion
            .lock()
            .map(|guard| matches!(&*guard, TaskCompletion::Done(_)))
            .unwrap_or(false)
    }
}

/// 任务中止句柄；`Effect::Task` 的撤销载体。
#[derive(Clone)]
pub struct TaskAbortHandle {
    control: Arc<TaskControl>,
}

impl fmt::Debug for TaskAbortHandle {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("TaskAbortHandle")
            .field("name", &self.control.name)
            .finish_non_exhaustive()
    }
}

impl TaskAbortHandle {
    /// 任务名。
    #[must_use]
    pub fn name(&self) -> Option<&str> {
        self.control.name.as_deref()
    }

    /// 触发协作式取消。
    pub(crate) fn cancel(&self) {
        self.control.signal.cancel();
    }

    /// 等待任务退出，最多 `timeout`。
    pub(crate) fn wait_timeout(&self, timeout: Duration) -> Result<(), KernelError> {
        self.control.wait_timeout(timeout)
    }

    /// 超过强撤上限后强制中止任务。
    pub(crate) fn force_abort(&self) {
        self.control.force_abort();
    }
}

/// 任务完成状态。
enum TaskCompletion {
    Running,
    Done(Result<(), KernelError>),
}

pub(crate) struct TaskControl {
    context: ContextId,
    plugin: Option<PluginId>,
    name: Option<String>,
    signal: TaskSignal,
    completion: Mutex<TaskCompletion>,
    completion_cv: Condvar,
    completion_notify: Notify,
    abort_handle: Mutex<Option<tokio::task::AbortHandle>>,
}

impl TaskControl {
    fn new(context: ContextId, plugin: Option<PluginId>, name: Option<String>) -> Self {
        Self {
            context,
            plugin,
            name,
            signal: TaskSignal::new(),
            completion: Mutex::new(TaskCompletion::Running),
            completion_cv: Condvar::new(),
            completion_notify: Notify::new(),
            abort_handle: Mutex::new(None),
        }
    }

    fn signal(&self) -> &TaskSignal {
        &self.signal
    }

    fn result(&self) -> Result<Option<Result<(), KernelError>>, KernelError> {
        let guard = self
            .completion
            .lock()
            .map_err(|_| KernelError::LockPoisoned)?;
        Ok(match &*guard {
            TaskCompletion::Running => None,
            TaskCompletion::Done(result) => Some(result.clone()),
        })
    }

    fn complete(&self, result: Result<(), KernelError>) {
        if let Ok(mut guard) = self.completion.lock() {
            *guard = TaskCompletion::Done(result);
        }
        self.completion_cv.notify_all();
        self.completion_notify.notify_waiters();
    }

    fn wait_timeout(&self, timeout: Duration) -> Result<(), KernelError> {
        // 撤销路径是同步 API：等待任务退出时必须避免饿死被唤醒到当前 worker
        // 本地队列的任务。多线程运行时用 `block_in_place` 让运行时接管本地
        // 队列（§10.3）；当前线程运行时无法在 worker 内同步等待，退化为
        // 非阻塞检查；无运行时上下文（宿主同步线程）直接阻塞等待。
        match tokio::runtime::Handle::try_current() {
            Ok(handle) => match handle.runtime_flavor() {
                tokio::runtime::RuntimeFlavor::MultiThread => {
                    tokio::task::block_in_place(|| self.wait_blocking(timeout))
                }
                _ => match self.result()? {
                    Some(result) => result,
                    None => Err(KernelError::LifecycleTimeout {
                        id: self.plugin.clone().unwrap_or_default(),
                        phase: LifecyclePhase::Stop,
                    }),
                },
            },
            Err(_) => self.wait_blocking(timeout),
        }
    }

    /// 阻塞等待任务完成，最多 `timeout`；由 `wait_timeout` 按运行时形态调用。
    fn wait_blocking(&self, timeout: Duration) -> Result<(), KernelError> {
        let guard = self
            .completion
            .lock()
            .map_err(|_| KernelError::LockPoisoned)?;
        let (guard, _) = self
            .completion_cv
            .wait_timeout_while(guard, timeout, |state| {
                matches!(state, TaskCompletion::Running)
            })
            .map_err(|_| KernelError::LockPoisoned)?;
        match &*guard {
            TaskCompletion::Done(result) => result.clone(),
            TaskCompletion::Running => Err(KernelError::LifecycleTimeout {
                id: self.plugin.clone().unwrap_or_default(),
                phase: LifecyclePhase::Stop,
            }),
        }
    }

    fn force_abort(&self) {
        self.signal.cancel();
        if let Ok(guard) = self.abort_handle.lock() {
            if let Some(handle) = guard.as_ref() {
                handle.abort();
            }
        }
    }

    fn context_id(&self) -> ContextId {
        self.context
    }
}

enum TaskOutcome {
    Completed,
    Cancelled,
}

async fn wait_external(signal: Option<TaskSignal>) {
    match signal {
        Some(signal) => signal.wait_cancelled().await,
        None => std::future::pending().await,
    }
}

impl Context {
    /// 登记后台任务；任务绑定当前 Fork，参与配额与取消。
    pub fn task<F>(&self, work: F, options: TaskOptions) -> Result<TaskHandle, KernelError>
    where
        F: Future<Output = ()> + Send + 'static,
    {
        self.kernel.spawn_task(self.id, work, options)
    }
}

impl Kernel {
    /// 内部：在当前 Fork 上创建任务并登记 `Effect::Task`。
    pub(crate) fn spawn_task<F>(
        &self,
        context: ContextId,
        work: F,
        options: TaskOptions,
    ) -> Result<TaskHandle, KernelError>
    where
        F: Future<Output = ()> + Send + 'static,
    {
        let plugin = self.plugin_owner(context);
        self.reserve_task_quota(plugin.as_deref(), context)?;

        let control = Arc::new(TaskControl::new(
            context,
            plugin.clone(),
            options.name.clone(),
        ));
        let abort = TaskAbortHandle {
            control: Arc::clone(&control),
        };
        if let Err(error) = self.register_task_effect(context, abort) {
            self.release_task_quota(plugin.as_deref());
            return Err(error);
        }

        let select_signal = control.signal().clone();
        let external = options.signal.clone();
        let handle = self.runtime().spawn(async move {
            tokio::select! {
                biased;
                _ = work => TaskOutcome::Completed,
                _ = select_signal.wait_cancelled() => TaskOutcome::Cancelled,
                _ = wait_external(external) => TaskOutcome::Cancelled,
            }
        });
        control.set_abort_handle(handle.abort_handle());

        let watcher_control = Arc::clone(&control);
        let watcher_kernel = self.clone();
        let watcher_plugin = plugin;
        let panic_id = watcher_control
            .plugin
            .clone()
            .unwrap_or_else(|| crate::constants::KERNEL_SOURCE.to_owned());
        self.runtime().spawn(async move {
            let result = match handle.await {
                Ok(TaskOutcome::Completed) => Ok(()),
                Ok(TaskOutcome::Cancelled) => Err(KernelError::ContextDisposed {
                    id: watcher_control.context_id(),
                }),
                Err(join_error) if join_error.is_panic() => {
                    Err(KernelError::PluginPanicked { id: panic_id })
                }
                Err(_) => Err(KernelError::ContextDisposed {
                    id: watcher_control.context_id(),
                }),
            };
            watcher_control.complete(result);
            watcher_kernel.release_task_quota(watcher_plugin.as_deref());
        });

        Ok(TaskHandle {
            name: options.name,
            control,
        })
    }
}

impl TaskControl {
    fn set_abort_handle(&self, handle: tokio::task::AbortHandle) {
        if let Ok(mut guard) = self.abort_handle.lock() {
            *guard = Some(handle);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::KERNEL_SOURCE;
    use crate::fork::Effect;

    fn control(plugin: Option<&str>, name: Option<&str>) -> Arc<TaskControl> {
        Arc::new(TaskControl::new(
            7,
            plugin.map(ToOwned::to_owned),
            name.map(ToOwned::to_owned),
        ))
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_signal_already_cancelled_returns_without_waiting() {
        // §10.4：已置位的取消信号不得让任务再进入等待。
        let signal = TaskSignal::new();
        assert!(!signal.is_cancelled());
        signal.cancel();
        signal.cancel();
        assert!(signal.is_cancelled());
        tokio::time::timeout(Duration::from_millis(50), signal.wait_cancelled())
            .await
            .expect("已取消信号应立即返回");
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_signal_wakes_pending_waiter() {
        let signal = TaskSignal::new();
        let waiter = signal.clone();
        let task = tokio::spawn(async move {
            waiter.wait_cancelled().await;
        });
        tokio::time::sleep(Duration::from_millis(10)).await;
        assert!(!task.is_finished(), "未取消时任务应仍在等待");
        signal.cancel();
        tokio::time::timeout(Duration::from_millis(500), task)
            .await
            .expect("取消后等待者应被唤醒")
            .expect("等待任务不应 panic");
    }

    #[test]
    fn test_abort_handle_debug_and_task_effect_identity() {
        // §4.1：`Effect::Task` 诊断输出任务名，闭包与句柄不进入输出。
        let named = TaskAbortHandle {
            control: control(Some("chips.test.a"), Some("flusher")),
        };
        assert_eq!(named.name(), Some("flusher"));
        let text = format!("{named:?}");
        assert!(
            text.contains("TaskAbortHandle") && text.contains("flusher"),
            "中止句柄诊断应含任务名：{text}"
        );
        let effect = Effect::Task {
            abort: named.clone(),
        };
        let text = format!("{effect:?}");
        assert!(
            text.contains("Effect::Task") && text.contains("flusher"),
            "任务副作用诊断应含任务名：{text}"
        );

        let unnamed = TaskAbortHandle {
            control: control(None, None),
        };
        assert_eq!(unnamed.name(), None);
        assert_eq!(format!("{unnamed:?}"), "TaskAbortHandle { name: None, .. }");
        unnamed.cancel();
        assert!(
            unnamed.control.signal.is_cancelled(),
            "§10.4：中止句柄的取消即协作式取消信号"
        );
    }

    #[test]
    fn test_wait_timeout_without_runtime_blocks_and_times_out() {
        // §10.3：宿主同步线程上的撤销必须阻塞等待至多上限，超时上报 Stop 阶段。
        let item = control(Some("chips.test.a"), Some("flusher"));
        let waiting = Arc::clone(&item);
        let thread = std::thread::spawn(move || waiting.wait_timeout(Duration::from_millis(60)));
        let error = thread
            .join()
            .expect("等待线程不应 panic")
            .expect_err("未完成任务应超时");
        assert_eq!(error.code(), "KERNEL_LIFECYCLE_TIMEOUT");
        match error {
            KernelError::LifecycleTimeout { id, phase } => {
                assert_eq!(id, "chips.test.a");
                assert_eq!(phase, LifecyclePhase::Stop);
            }
            other => panic!("应返回生命周期超时错误：{other:?}"),
        }

        item.complete(Ok(()));
        let done = Arc::clone(&item);
        assert!(std::thread::spawn(move || done.wait_timeout(Duration::from_millis(60)))
            .join()
            .expect("等待线程不应 panic")
            .is_ok());

        // 无归属插件时超时诊断使用空插件位。
        let orphan = control(None, None);
        orphan.complete(Err(KernelError::ContextDisposed { id: 7 }));
        let error = orphan
            .wait_timeout(Duration::from_millis(10))
            .expect_err("已完成任务应返回其结果");
        assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    }

    #[tokio::test(flavor = "current_thread")]
    async fn test_wait_timeout_on_current_thread_runtime_does_not_block() {
        // §10.3：当前线程运行时无法在 worker 内同步等待，退化为非阻塞检查。
        let item = control(Some("chips.test.a"), Some("running"));
        let error = item
            .wait_timeout(Duration::from_millis(50))
            .expect_err("运行中的任务在当前线程运行时不应被同步等待");
        assert_eq!(error.code(), "KERNEL_LIFECYCLE_TIMEOUT");
        item.complete(Ok(()));
        item.wait_timeout(Duration::from_millis(50))
            .expect("已完成任务应立即返回结果");
    }

    #[tokio::test]
    async fn test_task_handle_join_cancel_signal_and_debug() {
        // §4.2：任务随 Fork 登记；`join` 等待退出并回传取消 / panic 结果。
        let kernel = Kernel::new(tokio::runtime::Handle::current()).expect("内核应可创建");
        let root = kernel.root_context();
        let (gate, released) = tokio::sync::oneshot::channel::<()>();
        let handle = root
            .task(
                async move {
                    let _ = released.await;
                },
                TaskOptions {
                    name: Some("watcher".to_owned()),
                    signal: None,
                },
            )
            .expect("任务应登记成功");
        assert_eq!(handle.name.as_deref(), Some("watcher"));
        let text = format!("{handle:?}");
        assert!(
            text.contains("TaskHandle") && text.contains("watcher"),
            "任务句柄诊断应含任务名：{text}"
        );
        assert!(!handle.is_finished());

        let signal = handle.signal();
        let joiner = handle.clone();
        let waiter = tokio::spawn(async move { joiner.join().await });
        // `join` 先做一次结果检查再挂起等待（此时任务仍在运行）。
        tokio::time::sleep(Duration::from_millis(20)).await;
        assert!(!waiter.is_finished(), "任务未退出时 join 应持续等待");
        signal.cancel();
        let outcome = tokio::time::timeout(Duration::from_millis(2_000), waiter)
            .await
            .expect("取消后 join 应返回")
            .expect("等待任务不应 panic");
        let error = outcome.expect_err("协作式取消应上报 ContextDisposed");
        assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
        assert!(handle.is_finished());
        drop(gate);
    }

    #[tokio::test]
    async fn test_task_with_pre_cancelled_signal_exits_immediately() {
        // §4.2、§10.4：外部信号已取消时，任务不必等待自身逻辑完成。
        let kernel = Kernel::new(tokio::runtime::Handle::current()).expect("内核应可创建");
        let root = kernel.root_context();
        let signal = TaskSignal::new();
        signal.cancel();
        let handle = root
            .task(
                std::future::pending::<()>(),
                TaskOptions {
                    name: None,
                    signal: Some(signal.clone()),
                },
            )
            .expect("任务应登记成功");
        let error = tokio::time::timeout(Duration::from_millis(2_000), handle.join())
            .await
            .expect("外部信号已取消，任务应立即退出")
            .expect_err("被取消的任务上报 ContextDisposed");
        assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    }

    #[tokio::test]
    async fn test_panicking_task_reports_plugin_panicked() {
        // §9.1、§10.4：任务 panic 归一为 `KERNEL_PLUGIN_PANICKED`，归属可定位。
        let kernel = Kernel::new(tokio::runtime::Handle::current()).expect("内核应可创建");
        let root = kernel.root_context();
        let handle = root
            .task(
                async { panic!("任务内部故障") },
                TaskOptions::default(),
            )
            .expect("任务应登记成功");
        let outcome = tokio::time::timeout(Duration::from_millis(2_000), handle.join())
            .await
            .expect("panic 后监视器应回填结果");
        let default_id = if let Err(KernelError::PluginPanicked { id }) = outcome {
            assert!(KernelError::PluginPanicked { id: id.clone() }.retryable());
            id
        } else {
            panic!("任务 panic 必须上报 KERNEL_PLUGIN_PANICKED，实际 {outcome:?}");
        };
        assert_eq!(
            default_id, KERNEL_SOURCE,
            "平台 Context 的任务归属记为内核自身"
        );
    }

    #[tokio::test]
    async fn test_force_abort_is_reported_as_context_disposed() {
        // §4.4、§10.4：非协作任务在强撤上限后强制中止，结果上报为取消。
        let kernel = Kernel::new(tokio::runtime::Handle::current()).expect("内核应可创建");
        let root = kernel.root_context();
        let handle = root
            .task(
                std::future::pending::<()>(),
                TaskOptions {
                    name: Some("stubborn".to_owned()),
                    signal: None,
                },
            )
            .expect("任务应登记成功");
        let control = Arc::clone(&handle.control);
        let waiting = Arc::clone(&control);
        let timeout = std::thread::spawn(move || waiting.wait_timeout(Duration::from_millis(30)))
            .join()
            .expect("等待线程不应 panic");
        timeout.expect_err("非协作任务在强撤上限内不会退出");
        control.force_abort();
        let error = tokio::time::timeout(Duration::from_millis(2_000), handle.join())
            .await
            .expect("强制中止后监视器应回填结果")
            .expect_err("被强制中止的任务上报 ContextDisposed");
        assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    }

    #[tokio::test]
    async fn test_task_on_missing_context_is_rejected() {
        // §4.2：任务必须挂在存活的 Context 上；已销毁 Context 不得占用配额。
        let runtime = tokio::runtime::Handle::current();
        let kernel = Kernel::new(runtime).expect("内核应可创建");
        let child = kernel
            .root_context()
            .create_child()
            .expect("子 Context 应可创建");
        child.dispose().expect("子 Context 销毁应成功");
        let error = child
            .task(std::future::pending::<()>(), TaskOptions::default())
            .expect_err("已销毁 Context 不得登记任务");
        assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
    }
}
