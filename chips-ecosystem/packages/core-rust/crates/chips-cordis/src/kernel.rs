//! Kernel：运行时句柄、状态寄存器、命令循环入口与撤销编排。
//!
//! 对应《薯片内核设计》§2.2、第十章：内核全部可变状态由命令循环与短时状态锁
//! 串行写入；服务表、监听表与 Context 树以写时复制快照发布给读路径。

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, RwLock};
use std::time::Duration;

use chips_core::{ContextId, EventName, ForkId, PluginId, ServiceName, ServiceValue};
use tokio::sync::mpsc;

use crate::command::{spawn_command_loop, Command};
use crate::constants::{
    PLUGIN_MESSAGE_RATE_PER_SECOND, PLUGIN_MESSAGE_RATE_WINDOW, PLUGIN_TASK_QUOTA,
};
use crate::context::{Context, ContextNode, ContextState, ContextTree};
use crate::error::{KernelError, QuotaKind};
use crate::event::{
    dispatch, Event, EventPayload, ListenerHandler, ListenerOptions, ListenerTable, ListenerToken,
};
use crate::fork::{Effect, Fork, ForkState};
use crate::name::{validate_event_register, validate_service_name};
use crate::plugin::{
    ConfigProvider, CrashRestartPolicy, EmptyConfigProvider, PluginManager, PluginState,
};
use crate::service::{Injection, ServiceEntry, ServiceTable};

/// 内核策略选项；默认值即《薯片内核设计》§6.7 的生命周期超时与 §6.8 的
/// 崩溃重启熔断常量。
#[derive(Debug, Clone)]
pub struct KernelOptions {
    /// `PluginRunner::apply` 超时。
    pub apply_timeout: Duration,
    /// `PluginRunner::stop` 超时。
    pub stop_timeout: Duration,
    /// Fork 强制撤销时等待任务退出的上限。
    pub force_dispose_timeout: Duration,
    /// §6.8 崩溃重启滚动窗口长度（默认 `CRASH_RESTART_WINDOW`）。
    pub crash_restart_window: Duration,
    /// §6.8 窗口内最大自动重启次数（默认 `CRASH_RESTART_MAX_ATTEMPTS`）。
    pub crash_restart_max_attempts: u32,
    /// §6.8 首次重启退避间隔（默认 `CRASH_RESTART_BACKOFF_INITIAL`）。
    pub crash_restart_backoff_initial: Duration,
    /// §6.8 单次重启退避间隔上限（默认 `CRASH_RESTART_BACKOFF_MAX`）。
    pub crash_restart_backoff_max: Duration,
}

impl Default for KernelOptions {
    fn default() -> Self {
        Self {
            apply_timeout: crate::constants::LIFECYCLE_APPLY_TIMEOUT,
            stop_timeout: crate::constants::LIFECYCLE_STOP_TIMEOUT,
            force_dispose_timeout: crate::constants::FORK_FORCE_DISPOSE_TIMEOUT,
            crash_restart_window: crate::constants::CRASH_RESTART_WINDOW,
            crash_restart_max_attempts: crate::constants::CRASH_RESTART_MAX_ATTEMPTS,
            crash_restart_backoff_initial: crate::constants::CRASH_RESTART_BACKOFF_INITIAL,
            crash_restart_backoff_max: crate::constants::CRASH_RESTART_BACKOFF_MAX,
        }
    }
}

/// 消息速率窗口。
#[derive(Debug, Clone, Copy)]
pub(crate) struct RateWindow {
    pub(crate) window_start_ms: u64,
    pub(crate) count: u32,
}

impl RateWindow {
    /// 记一次消息并判定是否超限；超限返回 `false`。
    pub(crate) fn try_charge(&mut self, now_ms: u64, limit: u32, window_ms: u64) -> bool {
        if now_ms.saturating_sub(self.window_start_ms) >= window_ms {
            self.window_start_ms = now_ms;
            self.count = 0;
        }
        if self.count >= limit {
            return false;
        }
        self.count += 1;
        true
    }
}

/// 内核全部可变状态；唯一写入面。
pub(crate) struct KernelState {
    pub(crate) next_id: u64,
    pub(crate) contexts: ContextTree,
    pub(crate) forks: HashMap<ForkId, Fork>,
    pub(crate) staged: HashMap<ForkId, Vec<ServiceStage>>,
    pub(crate) table: ServiceTable,
    pub(crate) reverse:
        HashMap<(ForkId, u64, ServiceName), std::collections::BTreeSet<chips_core::InjectionId>>,
    pub(crate) injections: HashMap<chips_core::InjectionId, Injection>,
    pub(crate) injections_by_owner:
        HashMap<ForkId, std::collections::BTreeSet<chips_core::InjectionId>>,
    pub(crate) waiting_injections:
        HashMap<ServiceName, std::collections::BTreeSet<chips_core::InjectionId>>,
    /// 注入回调执行 Context 集合；内核创建，提供插件级服务语义（见 `provide_service`）。
    pub(crate) injection_contexts: HashSet<ContextId>,
    pub(crate) rebuild_depth: u32,
    /// 本轮级联重建是否已因深度超限中止。
    pub(crate) rebuild_aborted: bool,
    /// 中止轮次中待处理的服务条目（撤销受影响注入而不重建）。
    pub(crate) overflow_pending: Vec<ServiceEntry>,
    pub(crate) plugins: PluginManager,
    pub(crate) listeners: ListenerTable,
    pub(crate) next_listener_token: u64,
    pub(crate) task_counts: HashMap<PluginId, usize>,
    pub(crate) message_rate: HashMap<PluginId, RateWindow>,
}

/// 暂存代际条目；按登记顺序排列。
///
/// `effect_fork` 是登记撤销副作用的 Fork；`context` 是服务注册所在 Context
/// （插件作用域内统一为其插件 Context）。插件进入 `Active` 时按插件 Fork
/// 一次原子发布，`Effect::Service` 仍登记到 `effect_fork`，保证子 Context 被
/// 销毁时其提供的服务被精确摘除。
#[derive(Debug, Clone)]
pub(crate) struct ServiceStage {
    pub(crate) effect_fork: ForkId,
    pub(crate) context: ContextId,
    pub(crate) name: ServiceName,
    pub(crate) value: ServiceValue,
    /// 是否进入全局插件服务索引（插件自身 Context 或注入执行 Context 提供）。
    pub(crate) global: bool,
}

impl KernelState {
    fn new() -> Self {
        Self {
            next_id: 1,
            contexts: ContextTree::default(),
            forks: HashMap::new(),
            staged: HashMap::new(),
            table: ServiceTable::default(),
            reverse: HashMap::new(),
            injections: HashMap::new(),
            injections_by_owner: HashMap::new(),
            waiting_injections: HashMap::new(),
            injection_contexts: HashSet::new(),
            rebuild_depth: 0,
            rebuild_aborted: false,
            overflow_pending: Vec::new(),
            plugins: PluginManager::default(),
            listeners: ListenerTable::new(),
            next_listener_token: 1,
            task_counts: HashMap::new(),
            message_rate: HashMap::new(),
        }
    }

    /// 单调递增分配一个 ID；释放后不复用。
    pub(crate) fn alloc_id(&mut self) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    /// 沿 Context 祖先链寻找归属插件；返回插件 ID 与其 Context。
    ///
    /// 插件可为内部子功能创建子 Context，子 Context 的 `provide` / `inject` /
    /// `on` / `emit` / `task` 仍归属该插件（`source` 重写、配额计量、失败隔离）。
    pub(crate) fn plugin_owner_chain(&self, from: ContextId) -> Option<(PluginId, ContextId)> {
        for context in self.contexts.ancestors(from) {
            if let Some((id, _)) = self
                .plugins
                .records
                .iter()
                .find(|(_, record)| record.context == Some(context))
            {
                return Some((id.clone(), context));
            }
        }
        None
    }

    /// 创建 Fork 并挂到父 Fork 的子列表。
    pub(crate) fn create_fork(&mut self, context: ContextId, parent: Option<ForkId>) -> ForkId {
        let id = self.alloc_id();
        let fork = Fork::new(id, context, parent);
        self.forks.insert(id, fork);
        if let Some(parent) = parent {
            if let Some(parent_node) = self.forks.get_mut(&parent) {
                parent_node.children.push(id);
            }
        }
        id
    }
}

/// 登记副作用失败时恢复服务表原状（回滚已写入的条目）。
fn restore_entry(
    state: &mut KernelState,
    context: ContextId,
    name: &str,
    previous: Option<ServiceEntry>,
) {
    match previous {
        Some(entry) => {
            state.table.insert(context, entry);
        }
        None => {
            state.table.remove(context, name);
        }
    }
}

impl From<&KernelOptions> for CrashRestartPolicy {
    fn from(options: &KernelOptions) -> Self {
        Self {
            window: options.crash_restart_window,
            max_attempts: options.crash_restart_max_attempts,
            backoff_initial: options.crash_restart_backoff_initial,
            backoff_max: options.crash_restart_backoff_max,
        }
    }
}

/// 内核共享内部状态。
pub(crate) struct KernelInner {
    pub(crate) state: Mutex<KernelState>,
    pub(crate) services: RwLock<Arc<ServiceTable>>,
    pub(crate) listeners: RwLock<Arc<ListenerTable>>,
    pub(crate) contexts: RwLock<Arc<ContextTree>>,
    pub(crate) options: KernelOptions,
    pub(crate) runtime: tokio::runtime::Handle,
    pub(crate) configs: Arc<dyn ConfigProvider>,
    pub(crate) root: ContextId,
    pub(crate) ulid: crate::ulid::UlidGenerator,
}

/// Kernel 运行时句柄；平台启动时创建，生命周期与主进程一致。
#[derive(Clone)]
pub struct Kernel {
    pub(crate) inner: Arc<KernelInner>,
    pub(crate) commands: mpsc::UnboundedSender<Command>,
}

impl Kernel {
    /// 创建内核并启动命令循环；运行时由宿主入口提供。
    pub fn new(runtime: tokio::runtime::Handle) -> Result<Self, KernelError> {
        Self::with_options(
            runtime,
            KernelOptions::default(),
            Arc::new(EmptyConfigProvider),
        )
    }

    /// 以自定义选项与配置提供者创建内核。
    pub fn with_options(
        runtime: tokio::runtime::Handle,
        options: KernelOptions,
        configs: Arc<dyn ConfigProvider>,
    ) -> Result<Self, KernelError> {
        let mut state = KernelState::new();
        state.plugins.crash_policy = CrashRestartPolicy::from(&options);
        let root_id = state.alloc_id();
        let root_fork = state.create_fork(root_id, None);
        state.contexts.insert(ContextNode {
            id: root_id,
            parent: None,
            children: Vec::new(),
            fork: root_fork,
            state: ContextState::Active,
        });

        let inner = Arc::new(KernelInner {
            state: Mutex::new(state),
            services: RwLock::new(Arc::new(ServiceTable::default())),
            listeners: RwLock::new(Arc::new(ListenerTable::new())),
            contexts: RwLock::new(Arc::new(ContextTree::default())),
            options,
            runtime,
            configs,
            root: root_id,
            ulid: crate::ulid::UlidGenerator::new(),
        });
        let (commands, receiver) = mpsc::unbounded_channel();
        let kernel = Self {
            inner: Arc::clone(&inner),
            commands,
        };
        kernel.publish_contexts()?;
        spawn_command_loop(kernel.clone(), receiver);
        Ok(kernel)
    }

    /// 根 Context；平台服务注册于此，插件无需为其声明依赖。
    #[must_use]
    pub fn root_context(&self) -> Context {
        Context::new(self.inner.root, self.clone())
    }

    /// 运行时句柄。
    #[must_use]
    pub fn runtime(&self) -> tokio::runtime::Handle {
        self.inner.runtime.clone()
    }

    /// 生命周期选项。
    #[must_use]
    pub fn options(&self) -> &KernelOptions {
        &self.inner.options
    }

    /// 配置快照提供者。
    #[must_use]
    pub(crate) fn config_provider(&self) -> &Arc<dyn ConfigProvider> {
        &self.inner.configs
    }

    pub(crate) fn lock_state(&self) -> Result<MutexGuard<'_, KernelState>, KernelError> {
        self.inner
            .state
            .lock()
            .map_err(|_| KernelError::LockPoisoned)
    }

    /// 发布服务表快照。
    pub(crate) fn publish_services(&self) -> Result<(), KernelError> {
        let snapshot = {
            let state = self.lock_state()?;
            Arc::new(state.table.clone())
        };
        let mut guard = self
            .inner
            .services
            .write()
            .map_err(|_| KernelError::LockPoisoned)?;
        *guard = snapshot;
        Ok(())
    }

    /// 发布监听表快照。
    pub(crate) fn publish_listeners(&self) -> Result<(), KernelError> {
        let snapshot = {
            let state = self.lock_state()?;
            Arc::new(state.listeners.clone())
        };
        let mut guard = self
            .inner
            .listeners
            .write()
            .map_err(|_| KernelError::LockPoisoned)?;
        *guard = snapshot;
        Ok(())
    }

    /// 发布 Context 树快照。
    pub(crate) fn publish_contexts(&self) -> Result<(), KernelError> {
        let snapshot = {
            let state = self.lock_state()?;
            Arc::new(state.contexts.clone())
        };
        let mut guard = self
            .inner
            .contexts
            .write()
            .map_err(|_| KernelError::LockPoisoned)?;
        *guard = snapshot;
        Ok(())
    }

    /// Context 句柄；不存在或已销毁返回 `KERNEL_CONTEXT_DISPOSED`。
    pub fn context_handle(&self, id: ContextId) -> Result<Context, KernelError> {
        match self.context_state(id) {
            Some(ContextState::Disposed) | None => Err(KernelError::ContextDisposed { id }),
            Some(_) => Ok(Context::new(id, self.clone())),
        }
    }

    /// Context 生命周期状态。
    #[must_use]
    pub fn context_state(&self, id: ContextId) -> Option<ContextState> {
        let contexts = self.inner.contexts.read().ok()?;
        contexts.node(id).map(|node| node.state)
    }

    /// 创建子 Context（立即进入 `Active`）。
    pub(crate) fn create_child_context(&self, parent: ContextId) -> Result<Context, KernelError> {
        let id = {
            let mut state = self.lock_state()?;
            let parent_fork = {
                let node = state
                    .contexts
                    .node(parent)
                    .ok_or(KernelError::ContextDisposed { id: parent })?;
                if node.state != ContextState::Active {
                    return Err(KernelError::ContextDisposed { id: parent });
                }
                node.fork
            };
            let id = state.alloc_id();
            let fork = state.create_fork(id, Some(parent_fork));
            state.contexts.insert(ContextNode {
                id,
                parent: Some(parent),
                children: Vec::new(),
                fork,
                state: ContextState::Active,
            });
            if let Some(parent_node) = state.contexts.node_mut(parent) {
                parent_node.children.push(id);
            }
            id
        };
        self.publish_contexts()?;
        Ok(Context::new(id, self.clone()))
    }

    /// 创建插件 Context：节点初始为 `Created`，作用域 Fork 即插件 Fork。
    pub(crate) fn create_plugin_context(&self, parent: ContextId) -> Result<Context, KernelError> {
        let id = {
            let mut state = self.lock_state()?;
            let parent_fork = {
                let node = state
                    .contexts
                    .node(parent)
                    .ok_or(KernelError::ContextDisposed { id: parent })?;
                if node.state != ContextState::Active {
                    return Err(KernelError::ContextDisposed { id: parent });
                }
                node.fork
            };
            let id = state.alloc_id();
            let fork = state.create_fork(id, Some(parent_fork));
            state.contexts.insert(ContextNode {
                id,
                parent: Some(parent),
                children: Vec::new(),
                fork,
                state: ContextState::Created,
            });
            if let Some(parent_node) = state.contexts.node_mut(parent) {
                parent_node.children.push(id);
            }
            id
        };
        self.publish_contexts()?;
        Ok(Context::new(id, self.clone()))
    }

    /// 激活一个 `Created` 状态的 Context（插件 `apply` 开始）。
    pub(crate) fn activate_context(&self, id: ContextId) -> Result<(), KernelError> {
        {
            let mut state = self.lock_state()?;
            let node = state
                .contexts
                .node_mut(id)
                .ok_or(KernelError::ContextDisposed { id })?;
            match node.state {
                ContextState::Created => node.state = ContextState::Active,
                ContextState::Active => {}
                ContextState::Disposing | ContextState::Disposed => {
                    return Err(KernelError::ContextDisposed { id })
                }
            }
        }
        self.publish_contexts()
    }

    /// 销毁 Context 子树：先子后本，随后撤销本 Context 的 Fork。
    pub fn dispose_context(&self, id: ContextId) -> Result<(), KernelError> {
        let children = {
            let state = self.lock_state()?;
            match state.contexts.node(id) {
                Some(node) => node.children.clone(),
                None => return Ok(()),
            }
        };
        let mut first_error: Option<KernelError> = None;
        for child in children {
            if let Err(error) = self.dispose_context(child) {
                first_error.get_or_insert(error);
            }
        }

        let fork = {
            let mut state = self.lock_state()?;
            let node = match state.contexts.node_mut(id) {
                Some(node) => node,
                None => return first_error.map_or(Ok(()), Err),
            };
            node.state = ContextState::Disposing;
            node.fork
        };
        if let Err(error) = self.dispose_fork(fork) {
            first_error.get_or_insert(error);
        }

        {
            let mut state = self.lock_state()?;
            if let Some(node) = state.contexts.node_mut(id) {
                node.state = ContextState::Disposed;
            }
            state.contexts.remove(id);
            state.injection_contexts.remove(&id);
        }
        self.publish_contexts()?;
        first_error.map_or(Ok(()), Err)
    }

    /// 撤销 Fork 子树：子 Fork 后序 + 自身副作用 LIFO；幂等、容错。
    pub fn dispose_fork(&self, fork: ForkId) -> Result<(), KernelError> {
        let batch = {
            let mut state = self.lock_state()?;
            match state.forks.get_mut(&fork) {
                Some(node) => node.begin_dispose(),
                None => return Ok(()),
            }
        };
        let Some(batch) = batch else {
            return Ok(());
        };

        let mut first_error: Option<KernelError> = None;
        for child in batch.children.iter().rev() {
            if let Err(error) = self.dispose_fork(*child) {
                first_error.get_or_insert(error);
            }
        }
        for effect in batch.effects.into_iter().rev() {
            if let Err(error) = self.revert_effect(fork, effect) {
                first_error.get_or_insert(error);
            }
        }

        self.finalize_fork_disposal(fork)?;
        first_error.map_or(Ok(()), Err)
    }

    fn finalize_fork_disposal(&self, fork: ForkId) -> Result<(), KernelError> {
        let mut state = self.lock_state()?;
        if let Some(node) = state.forks.get_mut(&fork) {
            node.finish_dispose();
        }
        state.forks.remove(&fork);
        state.staged.remove(&fork);
        // 已销毁 Fork 在其它插件 Fork 上登记的暂存条目（子 Context 在插件
        // Starting 窗口内 provide 后先行销毁）随其登记 Fork 一并丢弃。
        state.staged.retain(|_, stages| {
            stages.retain(|stage| stage.effect_fork != fork);
            !stages.is_empty()
        });

        let owned = state.injections_by_owner.remove(&fork).unwrap_or_default();
        for injection_id in owned {
            if let Some(injection) = state.injections.remove(&injection_id) {
                for key in &injection.bindings {
                    if let Some(set) = state.reverse.get_mut(key) {
                        set.remove(&injection_id);
                        if set.is_empty() {
                            state.reverse.remove(key);
                        }
                    }
                }
                for dependency in &injection.dependencies {
                    if let Some(set) = state.waiting_injections.get_mut(dependency) {
                        set.remove(&injection_id);
                    }
                }
            }
        }
        Ok(())
    }

    fn revert_effect(&self, fork: ForkId, effect: Effect) -> Result<(), KernelError> {
        match effect {
            Effect::Custom(cleanup) => {
                std::panic::catch_unwind(std::panic::AssertUnwindSafe(cleanup)).map_err(|_| {
                    KernelError::DisposeFailed {
                        reason: "清理闭包 panic".to_owned(),
                    }
                })
            }
            Effect::Service { name, generation } => self.remove_service(&name, fork, generation),
            Effect::Listener { name: _, token } => self.remove_listener(token),
            Effect::Task { abort } => {
                abort.cancel();
                // §10.4：撤销只负责"触发取消 + 等待退出"。任务自身的结果（协作
                // 取消归一的 `KERNEL_CONTEXT_DISPOSED`、失败、panic）由
                // `TaskHandle::join` 归因给调用方（§4.2），不得当作撤销失败上抛，
                // 否则任何持有存活任务的子作用域销毁都会误报失败。
                // 撤销链只在超过强撤上限仍未退出（或内核锁被污染）时出错。
                match abort.wait_timeout(self.inner.options.force_dispose_timeout) {
                    Ok(()) => Ok(()),
                    Err(error @ KernelError::LockPoisoned) => Err(error),
                    Err(error @ KernelError::LifecycleTimeout { .. }) => {
                        abort.force_abort();
                        Err(error)
                    }
                    Err(_) => Ok(()),
                }
            }
        }
    }

    /// 登记自定义清理逻辑；随当前 Fork 撤销。
    pub fn register_effect<F>(&self, from: ContextId, cleanup: F) -> Result<(), KernelError>
    where
        F: FnOnce() + Send + Sync + 'static,
    {
        let mut state = self.lock_state()?;
        let fork = {
            let node = state
                .contexts
                .node(from)
                .ok_or(KernelError::ContextDisposed { id: from })?;
            if node.state != ContextState::Active {
                return Err(KernelError::ContextDisposed { id: from });
            }
            node.fork
        };
        let node = state
            .forks
            .get_mut(&fork)
            .ok_or(KernelError::ContextDisposed { id: from })?;
        node.push_effect(Effect::Custom(Box::new(cleanup)))
    }

    /// 按作用域链查找服务快照；未命中返回 `KERNEL_SERVICE_NOT_FOUND`。
    pub fn get_service(&self, from: ContextId, name: &str) -> Result<ServiceValue, KernelError> {
        if self.context_state(from).is_none() {
            return Err(KernelError::ContextDisposed { id: from });
        }
        match self.resolve_service(from, name) {
            Some(entry) => Ok(Arc::clone(&entry.value)),
            None => Err(KernelError::ServiceNotFound {
                name: name.to_owned(),
            }),
        }
    }

    /// 类型化获取服务。
    pub fn get_typed<T: std::any::Any + Send + Sync + 'static>(
        &self,
        from: ContextId,
        name: &str,
    ) -> Result<Arc<T>, KernelError> {
        let value = self.get_service(from, name)?;
        value
            .downcast::<T>()
            .map_err(|_| KernelError::ServiceTypeMismatch {
                name: name.to_owned(),
            })
    }

    /// 服务解析：读快照 + 祖先链，再回退到全局插件服务索引。
    ///
    /// 祖先链遵循「注册在 Context 上的服务对自身与全部后代可见，同名以最近
    /// 祖先为准」；插件级服务（插件 Context 或注入执行 Context 提供）对其它
    /// 插件按名全局可见，保证声明依赖的插件之间可消费服务。子 Context 提供的
    /// 服务保持作用域隔离，不进入全局索引。
    pub(crate) fn resolve_service(&self, from: ContextId, name: &str) -> Option<ServiceEntry> {
        let ancestors = {
            let contexts = self.inner.contexts.read().ok()?;
            contexts.ancestors(from)
        };
        let table = {
            let services = self.inner.services.read().ok()?;
            Arc::clone(&services)
        };
        // 暂存代际对解析不可见，但同名的已发布祖先条目存在时，为该插件自身
        // 视图形成遮蔽（子遮蔽父）：Starting 期间插件看到的是自己刚注册的值。
        let shadow = self.staged_shadow(from, name);
        for context in ancestors {
            if let Some(entry) = table.get(context, name) {
                if let Some(shadow) = shadow {
                    crate::service::record_service_access(&shadow);
                    return Some(shadow);
                }
                crate::service::record_service_access(entry);
                return Some(entry.clone());
            }
        }
        if let Some(entry) = table.find_global(name) {
            if let Some(shadow) = shadow {
                crate::service::record_service_access(&shadow);
                return Some(shadow);
            }
            crate::service::record_service_access(entry);
            return Some(entry.clone());
        }
        None
    }

    /// 当前 Context 所属插件在暂存代际中的同名条目；不存在时为 `None`。
    ///
    /// 仅作为已发布同名条目的遮蔽层使用：没有任何已发布条目时，暂存代际
    /// 不参与解析（内核设计 §5.2.1）。
    fn staged_shadow(&self, from: ContextId, name: &str) -> Option<ServiceEntry> {
        let state = self.lock_state().ok()?;
        let (plugin, owner_context) = state.plugin_owner_chain(from)?;
        let owner_fork = state.contexts.node(owner_context)?.fork;
        let stage = state
            .staged
            .get(&owner_fork)?
            .iter()
            .find(|stage| stage.context == owner_context && stage.name == name)?;
        // 消费关系绑定到发布时代际，保证暂存发布后按代际精确撤销/重建。
        let generation = state
            .table
            .get(owner_context, name)
            .map_or(1, |entry| entry.generation + 1);
        Some(ServiceEntry {
            name: stage.name.clone(),
            value: Arc::clone(&stage.value),
            provider: plugin,
            fork: stage.effect_fork,
            generation,
            global: stage.global,
        })
    }

    /// 注册服务；`Starting` 期间进入暂存代际，`Active` 立即原子发布。
    ///
    /// 插件作用域内（含注入回调）的 `provide` 统一注册到提供方插件的 Context，
    /// 使插件服务对同插件全部作用域可用；`Effect::Service` 登记到 `effect_fork`
    /// 以保证精确撤销。服务由全局索引（插件 Context 或注入执行 Context 提供）
    /// 或作用域链解析。
    pub(crate) fn provide_service(
        &self,
        from: ContextId,
        name: ServiceName,
        value: ServiceValue,
    ) -> Result<(), KernelError> {
        validate_service_name(&name)?;
        let published = {
            let mut state = self.lock_state()?;
            let caller_fork = {
                let node = state
                    .contexts
                    .node(from)
                    .ok_or(KernelError::ContextDisposed { id: from })?;
                if node.state != ContextState::Active {
                    return Err(KernelError::ContextDisposed { id: from });
                }
                node.fork
            };
            let owner = state.plugin_owner_chain(from);
            let from_injection = state.injection_contexts.contains(&from);
            let (context, effect_fork, global, provider_fork, provider) = match owner {
                Some((id, owner_context)) => {
                    let owner_fork = state
                        .contexts
                        .node(owner_context)
                        .map(|node| node.fork)
                        .ok_or(KernelError::ContextDisposed { id: from })?;
                    // 注入回调内提供的服务属于提供方插件（§7.1「提供方 Fork」），
                    // 随插件生命周期撤销并在重建时替换，而非随单次注入撤销。
                    let effect_fork = if from_injection {
                        owner_fork
                    } else {
                        caller_fork
                    };
                    let global = from_injection || from == owner_context;
                    (owner_context, effect_fork, global, owner_fork, Some(id))
                }
                None => (from, caller_fork, false, caller_fork, None),
            };
            // 插件 Fork 处于 Starting 期间，插件级 provide（插件 Context 或注入
            // 执行 Context 发起）写入暂存代际，Active 时一次发布；子 Context 的
            // provide 只影响插件作用域，立即发布以支持 apply 期间创建并使用的
            // 子作用域服务。
            let staging = provider
                .as_ref()
                .is_some_and(|id| state.plugins.state_of(id) == Some(PluginState::Starting))
                && (from_injection || from == context);

            if staging {
                let stages = state.staged.entry(provider_fork).or_default();
                match stages
                    .iter_mut()
                    .find(|stage| stage.context == context && stage.name == name)
                {
                    Some(existing) => {
                        existing.value = value;
                        existing.effect_fork = effect_fork;
                        existing.global = global;
                    }
                    None => stages.push(ServiceStage {
                        effect_fork,
                        context,
                        name: name.clone(),
                        value,
                        global,
                    }),
                }
                None
            } else {
                let provider_id =
                    provider.unwrap_or_else(|| crate::constants::KERNEL_SOURCE.to_owned());
                let generation = state
                    .table
                    .get(context, &name)
                    .map_or(1, |entry| entry.generation + 1);
                let entry = ServiceEntry {
                    name: name.clone(),
                    value,
                    provider: provider_id,
                    fork: effect_fork,
                    generation,
                    global,
                };
                let replaced = state.table.insert(context, entry);
                let registered = state
                    .forks
                    .get_mut(&effect_fork)
                    .ok_or(KernelError::ContextDisposed { id: from })?
                    .push_effect(Effect::Service {
                        name: name.clone(),
                        generation,
                    });
                if let Err(error) = registered {
                    restore_entry(&mut state, context, &name, replaced);
                    return Err(error);
                }
                Some(replaced)
            }
        };

        match published {
            None => Ok(()),
            Some(replaced) => {
                self.publish_services()?;
                if let Some(old) = replaced {
                    self.rebuild_replaced(vec![old])?;
                } else {
                    self.satisfy_waiting(&name);
                }
                Ok(())
            }
        }
    }

    /// 把指定插件 Fork 的暂存代际一次原子发布。
    ///
    /// 每个条目登记到它自己的 `effect_fork`；若该 Fork 在激活窗口内已被撤销
    /// （例如注入回调回滚），对应条目随之丢弃。
    pub(crate) fn publish_staged(&self, fork: ForkId) -> Result<(), KernelError> {
        let stages = {
            let mut state = self.lock_state()?;
            state.staged.remove(&fork).unwrap_or_default()
        };
        if stages.is_empty() {
            return Ok(());
        }

        let mut replaced = Vec::new();
        let mut published_names = Vec::new();
        {
            let mut state = self.lock_state()?;
            for stage in stages {
                if !state.forks.contains_key(&stage.effect_fork) {
                    continue;
                }
                let generation = state
                    .table
                    .get(stage.context, &stage.name)
                    .map_or(1, |entry| entry.generation + 1);
                let provider = state
                    .plugin_owner_chain(stage.context)
                    .map_or_else(|| crate::constants::KERNEL_SOURCE.to_owned(), |(id, _)| id);
                let entry = ServiceEntry {
                    name: stage.name.clone(),
                    value: stage.value,
                    provider,
                    fork: stage.effect_fork,
                    generation,
                    global: stage.global,
                };
                let previous = state.table.insert(stage.context, entry);
                let Some(fork_node) = state.forks.get_mut(&stage.effect_fork) else {
                    restore_entry(&mut state, stage.context, &stage.name, previous);
                    continue;
                };
                if let Err(error) = fork_node.push_effect(Effect::Service {
                    name: stage.name.clone(),
                    generation,
                }) {
                    restore_entry(&mut state, stage.context, &stage.name, previous);
                    return Err(error);
                }
                if let Some(old) = previous {
                    replaced.push(old);
                }
                published_names.push(stage.name);
            }
        }

        self.publish_services()?;
        if !replaced.is_empty() {
            self.rebuild_replaced(replaced)?;
        }
        for name in published_names {
            self.satisfy_waiting(&name);
        }
        Ok(())
    }

    /// 摘除一条服务登记；仅当提供方 Fork 与代际匹配时生效。
    ///
    /// 若本轮级联重建已中止（深度超限），只摘除条目并把受影响的消费关系
    /// 交给中止轮次的统一撤销流程，不再触发新的重建。
    pub(crate) fn remove_service(
        &self,
        name: &str,
        fork: ForkId,
        generation: u64,
    ) -> Result<(), KernelError> {
        let (removed, aborted) = {
            let mut state = self.lock_state()?;
            let aborted = state.rebuild_aborted;
            let removed = state.table.remove_by_fork(name, fork, generation);
            (removed, aborted)
        };
        self.publish_services()?;
        if let Some(entry) = removed {
            if aborted {
                if let Ok(mut state) = self.lock_state() {
                    state.overflow_pending.push(entry);
                }
            } else {
                self.rebuild_replaced(vec![entry])?;
            }
        }
        Ok(())
    }

    /// 当前服务表快照长度（测试与诊断用）。
    #[must_use]
    pub fn service_count(&self) -> usize {
        self.inner
            .services
            .read()
            .map(|table| table.len())
            .unwrap_or(0)
    }

    /// 当前 Context 树节点数量（测试与诊断用）。
    #[must_use]
    pub fn context_count(&self) -> usize {
        self.inner
            .contexts
            .read()
            .map(|tree| tree.len())
            .unwrap_or(0)
    }

    /// 插件是否处于指定状态。
    #[must_use]
    pub fn plugin_state(&self, id: &str) -> Option<PluginState> {
        self.lock_state().ok()?.plugins.state_of(id)
    }

    /// 插件最近一次失败的结构化诊断。
    #[must_use]
    pub fn plugin_last_error(&self, id: &str) -> Option<chips_core::ChipsError> {
        self.lock_state()
            .ok()?
            .plugins
            .record(id)
            .and_then(|record| record.last_error.clone())
    }

    /// 插件 §6.8 崩溃重启窗口的当前尝试计数（按窗口修剪后的有效值）。
    ///
    /// 计数承载重启与熔断动作的审计事实：每次崩溃/激活失败计入一次，
    /// 超过 `crash_restart_max_attempts` 即停止自动重启（熔断），等待显式
    /// `enable` 重置；停用与卸载清零。`None` 表示插件未登记或锁不可用。
    #[must_use]
    pub fn plugin_crash_attempts(&self, id: &str) -> Option<u32> {
        let state = self.lock_state().ok()?;
        let record = state.plugins.record(id)?;
        Some(record.crash_attempts_within(std::time::Instant::now(), state.plugins.crash_policy))
    }

    /// 已登记插件 ID 列表（排除已移除）。
    #[must_use]
    pub fn plugin_ids(&self) -> Vec<PluginId> {
        self.lock_state().map_or_else(
            |_| Vec::new(),
            |state| {
                let mut ids: Vec<PluginId> = state
                    .plugins
                    .records
                    .iter()
                    .filter(|(_, record)| record.state != PluginState::Removed)
                    .map(|(id, _)| id.clone())
                    .collect();
                ids.sort();
                ids
            },
        )
    }

    /// 直接依赖者列表。
    #[must_use]
    pub fn dependents_of(&self, id: &str) -> Vec<PluginId> {
        self.lock_state()
            .map_or_else(|_| Vec::new(), |state| state.plugins.dependents_of(id))
    }

    /// Context 的归属插件；平台 Context 返回 `None`。
    ///
    /// 沿作用域链查找：插件的子 Context 同样归属该插件。
    #[must_use]
    pub fn plugin_of_context(&self, context: ContextId) -> Option<PluginId> {
        self.lock_state()
            .ok()?
            .plugin_owner_chain(context)
            .map(|(id, _)| id)
    }

    /// Fork 的归属插件。
    #[must_use]
    pub fn plugin_of_fork(&self, fork: ForkId) -> Option<PluginId> {
        let context = self
            .lock_state()
            .ok()?
            .forks
            .get(&fork)
            .map(|node| node.context)?;
        self.plugin_of_context(context)
    }

    /// 作用域链上的归属插件（内部同义入口）。
    pub(crate) fn plugin_owner(&self, context: ContextId) -> Option<PluginId> {
        self.plugin_of_context(context)
    }

    /// 订阅事件；副作用登记到当前 Fork。
    pub(crate) fn add_listener(
        &self,
        from: ContextId,
        name: &str,
        handler: ListenerHandler,
        options: ListenerOptions,
    ) -> Result<ListenerToken, KernelError> {
        let plugin = self.plugin_owner(from);
        validate_event_register(name, plugin.as_deref())?;

        let token = {
            let mut state = self.lock_state()?;
            let fork = {
                let node = state
                    .contexts
                    .node(from)
                    .ok_or(KernelError::ContextDisposed { id: from })?;
                if node.state != ContextState::Active {
                    return Err(KernelError::ContextDisposed { id: from });
                }
                node.fork
            };
            let fork_state = state
                .forks
                .get(&fork)
                .ok_or(KernelError::ContextDisposed { id: from })?
                .state();
            if fork_state != ForkState::Active {
                return Err(KernelError::ContextDisposed { id: from });
            }

            let token = ListenerToken(state.next_listener_token);
            state.next_listener_token += 1;
            let entry = crate::event::ListenerEntry {
                token,
                owner: fork,
                once: options.once,
                alive: Arc::new(AtomicBool::new(true)),
                handler,
            };
            let bucket = state
                .listeners
                .entry(name.to_owned())
                .or_insert_with(|| Arc::new(Vec::new()));
            let entries = Arc::make_mut(bucket);
            if options.prepend {
                entries.insert(0, entry);
            } else {
                entries.push(entry);
            }
            let fork_node = state
                .forks
                .get_mut(&fork)
                .ok_or(KernelError::ContextDisposed { id: from })?;
            fork_node.push_effect(Effect::Listener {
                name: name.to_owned(),
                token,
            })?;
            token
        };
        self.publish_listeners()?;
        Ok(token)
    }

    /// 退订；幂等。
    pub(crate) fn remove_listener(&self, token: ListenerToken) -> Result<(), KernelError> {
        let changed = {
            let mut state = self.lock_state()?;
            let mut empty_bucket: Option<EventName> = None;
            let mut removed = false;
            for (name, bucket) in state.listeners.iter_mut() {
                if !bucket.iter().any(|entry| entry.token == token) {
                    continue;
                }
                let entries = Arc::make_mut(bucket);
                if let Some(position) = entries.iter().position(|entry| entry.token == token) {
                    let entry = entries.remove(position);
                    entry.alive.store(false, Ordering::Release);
                    removed = true;
                }
                if entries.is_empty() {
                    empty_bucket = Some(name.clone());
                }
                break;
            }
            if let Some(name) = empty_bucket {
                state.listeners.remove(&name);
            }
            removed
        };
        if changed {
            self.publish_listeners()?;
        }
        Ok(())
    }

    /// 从指定 Context 发布事件；校验、补全信封并计入消息速率配额。
    pub(crate) fn emit_from(
        &self,
        from: ContextId,
        name: &str,
        payload: EventPayload,
        enforce_quota: bool,
    ) -> Result<(), KernelError> {
        let plugin = self.plugin_owner(from);
        if self.context_state(from).is_none() {
            return Err(KernelError::ContextDisposed { id: from });
        }
        validate_event_register(name, plugin.as_deref())?;
        if enforce_quota {
            if let Some(plugin) = plugin.as_deref() {
                self.charge_message_rate(plugin)?;
            }
        }

        // 无监听器零分配：先命中监听表快照，再构造事件信封。
        let bucket = {
            let listeners = self
                .inner
                .listeners
                .read()
                .map_err(|_| KernelError::LockPoisoned)?;
            match listeners.get(name) {
                Some(bucket) => Arc::clone(bucket),
                None => return Ok(()),
            }
        };

        let source = plugin.unwrap_or_else(|| crate::constants::KERNEL_SOURCE.to_owned());
        let now = crate::ulid::now_ms();
        let event = Event {
            id: self.inner.ulid.generate(now),
            name: name.to_owned(),
            source,
            timestamp: now,
            trace_id: None,
            payload,
        };
        dispatch(self, &event, from, &bucket)
    }

    /// 由内核自身发布事件（生命周期事件），不计入插件配额。
    pub(crate) fn emit_kernel_event(
        &self,
        name: &str,
        payload: EventPayload,
    ) -> Result<(), KernelError> {
        let root = self.inner.root;
        self.emit_from(root, name, payload, false)
    }

    fn charge_message_rate(&self, plugin: &str) -> Result<(), KernelError> {
        let mut state = self.lock_state()?;
        let window = state
            .message_rate
            .entry(plugin.to_owned())
            .or_insert(RateWindow {
                window_start_ms: crate::ulid::now_ms(),
                count: 0,
            });
        let now = crate::ulid::now_ms();
        let allowed = window.try_charge(
            now,
            PLUGIN_MESSAGE_RATE_PER_SECOND,
            PLUGIN_MESSAGE_RATE_WINDOW.as_millis() as u64,
        );
        if allowed {
            Ok(())
        } else {
            Err(KernelError::QuotaExceeded {
                id: plugin.to_owned(),
                quota: QuotaKind::MessageRate,
            })
        }
    }

    /// 预留一个活跃任务名额。
    pub(crate) fn reserve_task_quota(
        &self,
        plugin: Option<&str>,
        context: ContextId,
    ) -> Result<(), KernelError> {
        let mut state = self.lock_state()?;
        if state.contexts.node(context).is_none() {
            return Err(KernelError::ContextDisposed { id: context });
        }
        let Some(plugin) = plugin else {
            return Ok(());
        };
        let count = state.task_counts.entry(plugin.to_owned()).or_insert(0);
        if *count >= PLUGIN_TASK_QUOTA {
            return Err(KernelError::QuotaExceeded {
                id: plugin.to_owned(),
                quota: QuotaKind::Tasks,
            });
        }
        *count += 1;
        Ok(())
    }

    /// 释放一个任务名额。
    pub(crate) fn release_task_quota(&self, plugin: Option<&str>) {
        let Some(plugin) = plugin else {
            return;
        };
        if let Ok(mut state) = self.lock_state() {
            if let Some(count) = state.task_counts.get_mut(plugin) {
                *count = count.saturating_sub(1);
            }
        }
    }

    /// 把 `Effect::Task` 登记到 Context 的 Fork。
    pub(crate) fn register_task_effect(
        &self,
        context: ContextId,
        abort: crate::task::TaskAbortHandle,
    ) -> Result<(), KernelError> {
        let mut state = self.lock_state()?;
        let fork = {
            let node = state
                .contexts
                .node(context)
                .ok_or(KernelError::ContextDisposed { id: context })?;
            if node.state != ContextState::Active {
                return Err(KernelError::ContextDisposed { id: context });
            }
            node.fork
        };
        let node = state
            .forks
            .get_mut(&fork)
            .ok_or(KernelError::ContextDisposed { id: context })?;
        node.push_effect(Effect::Task { abort })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin::PluginRole;

    #[test]
    fn test_rate_window_charges_and_resets() {
        let mut window = RateWindow {
            window_start_ms: 1_000,
            count: 0,
        };
        assert!(window.try_charge(1_000, 2, 1_000));
        assert!(window.try_charge(1_100, 2, 1_000));
        assert!(!window.try_charge(1_200, 2, 1_000));
        assert!(window.try_charge(2_000, 2, 1_000));
        assert!(window.try_charge(2_100, 2, 1_000));
        assert!(!window.try_charge(2_200, 2, 1_000));
    }

    #[test]
    fn test_default_options_match_constants() {
        let options = KernelOptions::default();
        assert_eq!(
            options.apply_timeout,
            crate::constants::LIFECYCLE_APPLY_TIMEOUT
        );
        assert_eq!(
            options.stop_timeout,
            crate::constants::LIFECYCLE_STOP_TIMEOUT
        );
        // §6.8 崩溃重启熔断常量的唯一消费点：默认选项即在册数值。
        assert_eq!(
            options.crash_restart_window,
            crate::constants::CRASH_RESTART_WINDOW
        );
        assert_eq!(
            options.crash_restart_max_attempts,
            crate::constants::CRASH_RESTART_MAX_ATTEMPTS
        );
        assert_eq!(
            options.crash_restart_backoff_initial,
            crate::constants::CRASH_RESTART_BACKOFF_INITIAL
        );
        assert_eq!(
            options.crash_restart_backoff_max,
            crate::constants::CRASH_RESTART_BACKOFF_MAX
        );
    }

    #[test]
    fn test_crash_policy_maps_options_to_policy_snapshot() {
        // 策略快照必须逐项映射内核选项：选项覆盖即熔断参数覆盖。
        let options = KernelOptions {
            crash_restart_window: Duration::from_millis(250),
            crash_restart_max_attempts: 5,
            crash_restart_backoff_initial: Duration::from_millis(20),
            crash_restart_backoff_max: Duration::from_millis(80),
            ..KernelOptions::default()
        };
        let policy = CrashRestartPolicy::from(&options);
        assert_eq!(policy.window, Duration::from_millis(250));
        assert_eq!(policy.max_attempts, 5);
        assert_eq!(policy.backoff_initial, Duration::from_millis(20));
        assert_eq!(policy.backoff_max, Duration::from_millis(80));
        // 默认选项映射回在册常量。
        let defaults = CrashRestartPolicy::from(&KernelOptions::default());
        assert_eq!(defaults, CrashRestartPolicy::default());
    }

    #[test]
    fn test_plugin_role_payload_shape() {
        assert_eq!(PluginRole::Service.as_str(), "service");
    }

    /// 取撤销窗口期的 Context 作用域 Fork。
    fn fork_of(kernel: &Kernel, context: ContextId) -> ForkId {
        kernel
            .lock_state()
            .expect("状态锁可用")
            .contexts
            .node(context)
            .expect("节点存在")
            .fork
    }

    #[tokio::test]
    async fn test_disposing_fork_rejects_new_effects_and_rolls_back_table() {
        // §4.4：撤销期间的新登记一律被拒绝；§5.2：登记失败的服务表写入必须回滚。
        use std::sync::atomic::{AtomicUsize, Ordering};

        let runtime = tokio::runtime::Handle::current();
        let kernel = Kernel::new(runtime).expect("内核应可创建");
        let root = kernel.root_context();
        let root_fork = fork_of(&kernel, root.id());

        root.provide("probe".to_owned(), 1_u64)
            .expect("服务应可登记");
        let hits = Arc::new(AtomicUsize::new(0));
        let before = Arc::clone(&hits);
        root.on("document:before", move |_context, _payload| {
            before.fetch_add(1, Ordering::SeqCst);
            Ok(())
        })
        .expect("订阅应成功");

        let window = root.clone();
        let ran = Arc::new(AtomicUsize::new(0));
        let witness = Arc::clone(&ran);
        kernel
            .register_effect(root.id(), move || {
                // Fork 已进入 `Disposing`，Context 节点仍是 `Active`。
                assert_eq!(window.state(), ContextState::Active);
                let error = window
                    .provide("probe".to_owned(), 2_u64)
                    .expect_err("撤销期间不得登记服务");
                assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
                // 失败登记必须将原条目（代际 1、值 1）回滚留下（§5.2）。
                assert_eq!(
                    *window
                        .get_typed::<u64>("probe")
                        .expect("原有条目必须回滚保留")
                        .as_ref(),
                    1
                );

                let error = window
                    .provide("probe-late".to_owned(), 3_u64)
                    .expect_err("撤销期间不得登记新服务");
                assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
                assert_eq!(
                    window
                        .get("probe-late")
                        .expect_err("失败的新登记不得残留")
                        .code(),
                    "KERNEL_SERVICE_NOT_FOUND"
                );

                let error = window
                    .on("document:late", |_context, _payload| Ok(()))
                    .expect_err("撤销期间不得订阅事件");
                assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
                let error = window.effect(|| {}).expect_err("撤销期间不得登记清理逻辑");
                assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
                witness.fetch_add(1, Ordering::SeqCst);
            })
            .expect("清理逻辑应可登记");

        // 子 Fork 撤销失败必须作为首个错误上报，且不中断兄弟撤销。
        let child = root.create_child().expect("子 Context 应可创建");
        child
            .effect(|| panic!("子 Fork 清理故障"))
            .expect("清理逻辑应可登记");

        let error = kernel
            .dispose_fork(root_fork)
            .expect_err("子 Fork 撤销失败应上报");
        assert_eq!(error.code(), "KERNEL_DISPOSE_FAILED");
        assert_eq!(ran.load(Ordering::SeqCst), 1, "窗口期闭包应被执行一次");
        assert_eq!(
            kernel
                .get_service(root.id(), "probe")
                .expect_err("Fork 撤销后服务应摘除")
                .code(),
            "KERNEL_SERVICE_NOT_FOUND"
        );
        assert_eq!(kernel.service_count(), 0, "撤销完成后服务表应清空");

        // 已登记的监听器随 Fork 撤销自动退订；窗口期被拒的订阅不生效。
        hits.store(0, Ordering::SeqCst);
        root.emit("document:before", serde_json::Value::Null)
            .expect("平台 Context 仍可发布事件");
        root.emit("document:late", serde_json::Value::Null)
            .expect("事件名合法");
        assert_eq!(hits.load(Ordering::SeqCst), 0, "撤销后监听器不得再被调用");

        // 子 Context 的节点仍存活，其 Fork 已随父撤销。
        assert_eq!(child.state(), ContextState::Active);
        assert!(
            kernel.dispose_fork(root_fork).is_ok(),
            "已撤销 Fork 的重复撤销必须是幂等空操作"
        );
        assert!(
            kernel.dispose_fork(999_999).is_ok(),
            "未知 Fork 撤销应为空操作"
        );
    }

    #[tokio::test]
    async fn test_disposing_context_rejects_all_registration_entries() {
        // §3.3、§4.4：Context 进入 `Disposing` 后，provide / inject / on / task /
        // create_child / effect 全部拒绝，且不占用任务配额。
        use crate::task::{TaskOptions, TaskSignal};

        let runtime = tokio::runtime::Handle::current();
        let kernel = Kernel::new(runtime).expect("内核应可创建");
        let root = kernel.root_context();
        root.provide("probe".to_owned(), 1_u64)
            .expect("服务应可登记");
        let child = root.create_child().expect("子 Context 应可创建");
        let disposed_children = kernel.context_count();

        let window = child.clone();
        let witness = kernel.clone();
        let witness_id = window.id();
        window
            .clone()
            .effect(move || {
                // §3.3：进入 `Disposing` 后只剩撤销动作；节点实时状态可经内核状态
                // 复核（§10.2 的 `contexts` 快照只在销毁完成时发布，读路径不在窗口内
                // 中途发布，因此 `Context::state()` 仍返回撤销前的 `Active`）。
                let live = {
                    let state = witness.lock_state().expect("撤销窗口内不得持有内核状态锁");
                    state
                        .contexts
                        .node(witness_id)
                        .expect("撤销窗口内节点应仍存在")
                        .state
                };
                assert_eq!(live, ContextState::Disposing);
                for code in [
                    window
                        .effect(|| {})
                        .expect_err("撤销期间不得登记清理逻辑")
                        .code(),
                    window
                        .provide("late-service".to_owned(), 2_u64)
                        .expect_err("撤销期间不得登记服务")
                        .code(),
                    window
                        .inject(&["probe".to_owned()], |_context| {})
                        .expect_err("撤销期间不得声明注入")
                        .code(),
                    window
                        .on("document:late", |_context, _payload| Ok(()))
                        .expect_err("撤销期间不得订阅事件")
                        .code(),
                    window
                        .create_child()
                        .expect_err("撤销期间不得创建子 Context")
                        .code(),
                    window
                        .task(std::future::pending::<()>(), TaskOptions::default())
                        .expect_err("撤销期间不得登记任务")
                        .code(),
                    window
                        .task(
                            std::future::pending::<()>(),
                            TaskOptions {
                                name: None,
                                signal: Some(TaskSignal::new()),
                            },
                        )
                        .expect_err("撤销期间不得登记带信号任务")
                        .code(),
                ] {
                    assert_eq!(code, "KERNEL_CONTEXT_DISPOSED");
                }
            })
            .expect("清理逻辑应可登记");

        child.dispose().expect("子 Context 销毁应成功");
        assert_eq!(child.state(), ContextState::Disposed);
        assert_eq!(
            kernel.context_count(),
            disposed_children - 1,
            "销毁后不得泄漏 Context 节点"
        );
        assert_eq!(
            kernel
                .get_service(root.id(), "late-service")
                .expect_err("被拒登记不得写入服务表")
                .code(),
            "KERNEL_SERVICE_NOT_FOUND"
        );
        assert_eq!(kernel.service_count(), 1, "服务表应只剩原有条目");
        assert_eq!(
            root.create_child()
                .expect("父 Context 仍可创建子节点")
                .state(),
            ContextState::Active
        );
    }

    #[tokio::test]
    async fn test_nested_disposal_of_same_fork_is_noop() {
        // §4.4：撤销过程不可重入；重入的同一 Fork 撤销必须是空操作，
        // 且父 Context 的节点不得在子树撤销中途被重复处理。
        let runtime = tokio::runtime::Handle::current();
        let kernel = Kernel::new(runtime).expect("内核应可创建");
        let root = kernel.root_context();
        let parent = root.create_child().expect("父子 Context");
        let child = parent.create_child().expect("孙子 Context");

        let reentrant = parent.clone();
        child
            .effect(move || {
                // 在孙节点撤销途中撤销父 Context：同一 Fork 的重入被吞掉。
                reentrant.dispose().expect("重入撤销应为空操作");
            })
            .expect("清理逻辑应可登记");

        parent.dispose().expect("父 Context 销毁应成功");
        assert_eq!(parent.state(), ContextState::Disposed);
        assert_eq!(child.state(), ContextState::Disposed);
        assert_eq!(
            kernel.context_count(),
            1,
            "重入撤销不得泄漏节点或留下半撤销状态"
        );
        assert_eq!(
            kernel
                .context_handle(parent.id())
                .expect_err("已销毁 Context 无句柄")
                .code(),
            "KERNEL_CONTEXT_DISPOSED"
        );
        assert!(kernel
            .context_handle(root.id())
            .is_ok_and(|context| context.id() == root.id()));
    }

    #[tokio::test]
    async fn test_child_disposal_failure_is_reported_once_and_tree_cleaned() {
        // §4.4：撤销容错——首个错误上报，其余副作用继续撤销。
        let runtime = tokio::runtime::Handle::current();
        let kernel = Kernel::new(runtime).expect("内核应可创建");
        let root = kernel.root_context();
        let parent = root.create_child().expect("父 Context");
        let first = parent.create_child().expect("子 Context A");
        let second = parent.create_child().expect("子 Context B");

        first
            .effect(|| panic!("A 的清理逻辑故障"))
            .expect("清理逻辑应可登记");
        let cleaned = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let witness = Arc::clone(&cleaned);
        second
            .effect(move || {
                witness.store(true, std::sync::atomic::Ordering::SeqCst);
            })
            .expect("清理逻辑应可登记");

        let error = parent.dispose().expect_err("子 Context 撤销失败必须上报");
        assert_eq!(error.code(), "KERNEL_DISPOSE_FAILED");
        assert!(
            cleaned.load(std::sync::atomic::Ordering::SeqCst),
            "失败后其余副作用仍应撤销"
        );
        assert_eq!(kernel.context_count(), 1, "撤销失败的子树也必须清理");
        assert_eq!(first.state(), ContextState::Disposed);
        assert_eq!(second.state(), ContextState::Disposed);
        assert_eq!(parent.state(), ContextState::Disposed);
    }

    #[tokio::test]
    async fn test_context_activation_guards_reject_non_created_states() {
        // §3.3：仅 `Created` 可被激活为 `Active`；重复激活幂等，
        // `Disposing` / 未知 Context 一律拒绝。
        let runtime = tokio::runtime::Handle::current();
        let kernel = Kernel::new(runtime).expect("内核应可创建");
        let root = kernel.root_context();
        kernel
            .activate_context(root.id())
            .expect("已 Active 的 Context 重复激活应为幂等");
        assert_eq!(root.state(), ContextState::Active);

        let child = root.create_child().expect("子 Context 应可创建");
        {
            let mut state = kernel.lock_state().expect("状态锁可用");
            state.contexts.node_mut(child.id()).expect("节点存在").state = ContextState::Disposing;
        }
        assert_eq!(
            kernel
                .activate_context(child.id())
                .expect_err("Disposing 的 Context 不得被激活")
                .code(),
            "KERNEL_CONTEXT_DISPOSED"
        );
        assert_eq!(
            kernel
                .activate_context(999_999)
                .expect_err("未知 Context 不得被激活")
                .code(),
            "KERNEL_CONTEXT_DISPOSED"
        );
        assert_eq!(
            kernel
                .create_plugin_context(child.id())
                .expect_err("撤销中的父 Context 不得承载插件 Context")
                .code(),
            "KERNEL_CONTEXT_DISPOSED"
        );
        assert_eq!(
            kernel
                .create_child_context(child.id())
                .expect_err("撤销中的父 Context 不得承载子 Context")
                .code(),
            "KERNEL_CONTEXT_DISPOSED"
        );
        assert_eq!(
            kernel
                .create_plugin_context(999_999)
                .expect_err("未知父节点不得承载插件 Context")
                .code(),
            "KERNEL_CONTEXT_DISPOSED"
        );
        child.dispose().expect("清理测试节点");
    }

    #[tokio::test]
    async fn test_service_lookup_guards_after_disposal() {
        // §5.1、§3.3：类型不匹配与已销毁 Context 的读取都返回结构化错误。
        let runtime = tokio::runtime::Handle::current();
        let kernel = Kernel::new(runtime).expect("内核应可创建");
        let root = kernel.root_context();
        root.provide("probe".to_owned(), 7_u64)
            .expect("服务应可登记");
        assert_eq!(
            *root
                .get_typed::<u64>("probe")
                .expect("类型匹配应取到服务")
                .as_ref(),
            7
        );
        assert_eq!(
            root.get_typed::<String>("probe")
                .expect_err("类型不匹配应报错")
                .code(),
            "KERNEL_SERVICE_TYPE_MISMATCH"
        );
        assert_eq!(
            kernel
                .get_service(999_999, "probe")
                .expect_err("未知 Context 不得读取服务")
                .code(),
            "KERNEL_CONTEXT_DISPOSED"
        );
        assert_eq!(
            *kernel
                .get_typed::<u64>(root.id(), "probe")
                .expect("内核入口的类型化获取应成功")
                .as_ref(),
            7
        );
        assert_eq!(
            kernel
                .get_typed::<String>(root.id(), "probe")
                .expect_err("内核入口的类型不匹配同样报错")
                .code(),
            "KERNEL_SERVICE_TYPE_MISMATCH"
        );

        let scoped = root.create_child().expect("子 Context 应可创建");
        scoped
            .provide("scoped".to_owned(), 1_u32)
            .expect("作用域服务应可登记");
        assert_eq!(
            root.get("scoped")
                .expect_err("子作用域服务对父不可见")
                .code(),
            "KERNEL_SERVICE_NOT_FOUND"
        );
        scoped.dispose().expect("子 Context 销毁应成功");
        assert_eq!(
            scoped
                .get("scoped")
                .expect_err("已销毁 Context 不得读取服务")
                .code(),
            "KERNEL_CONTEXT_DISPOSED"
        );
        assert_eq!(
            scoped
                .emit("document:late", serde_json::Value::Null)
                .expect_err("已销毁 Context 不得发布事件")
                .code(),
            "KERNEL_CONTEXT_DISPOSED"
        );
        assert_eq!(kernel.service_count(), 1, "子作用域服务应随节点销毁摘除");
    }
}
