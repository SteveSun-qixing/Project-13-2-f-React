//! 服务注册表与注入：暂存代际、原子发布、反向索引与级联重建。
//!
//! 对应《薯片内核设计》第五章与 §7.1：`provide` 的可见性由阶段决定；
//! 依赖方按 `(提供方 Fork, 代际, 服务名)` 反向索引精确重建。

use std::cell::RefCell;
use std::collections::{BTreeSet, HashMap};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::Arc;

use chips_core::{ContextId, ForkId, InjectionId, PluginId, ServiceName, ServiceValue};

use crate::constants::MAX_REBUILD_DEPTH;
use crate::context::{Context, ContextNode, ContextState};
use crate::error::KernelError;
use crate::kernel::Kernel;
use crate::plugin::{CrashRestartPolicy, PluginState};

/// 服务条目。
#[derive(Clone)]
pub struct ServiceEntry {
    /// 服务名。
    pub name: ServiceName,
    /// 服务值。
    pub value: ServiceValue,
    /// 提供方插件 ID；平台服务为 `chips.kernel`。
    pub provider: PluginId,
    /// 提供方 Fork。
    pub fork: ForkId,
    /// 代际；每次替换递增。
    pub generation: u64,
    /// 是否进入全局插件服务索引；子 Context 提供的服务保持作用域隔离。
    pub(crate) global: bool,
}

impl std::fmt::Debug for ServiceEntry {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("ServiceEntry")
            .field("name", &self.name)
            .field("provider", &self.provider)
            .field("fork", &self.fork)
            .field("generation", &self.generation)
            .finish_non_exhaustive()
    }
}

/// 服务表：以 (Context, 服务名) 为键；写时复制后原子替换。
#[derive(Debug, Default, Clone)]
pub struct ServiceTable {
    entries: HashMap<(ContextId, ServiceName), ServiceEntry>,
}

impl ServiceTable {
    /// 精确查询。
    #[must_use]
    pub fn get(&self, context: ContextId, name: &str) -> Option<&ServiceEntry> {
        self.entries.get(&(context, name.to_owned()))
    }

    /// 条目数量。
    #[must_use]
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// 是否为空。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub(crate) fn insert(
        &mut self,
        context: ContextId,
        entry: ServiceEntry,
    ) -> Option<ServiceEntry> {
        self.entries.insert((context, entry.name.clone()), entry)
    }

    pub(crate) fn remove(&mut self, context: ContextId, name: &str) -> Option<ServiceEntry> {
        self.entries.remove(&(context, name.to_owned()))
    }

    /// 按提供方 Fork 与代际摘除条目；返回被摘除的条目。
    ///
    /// 服务注册所在 Context 与撤销登记 Fork 在插件作用域下可能不同（子
    /// Context 提供的服务统一注册到插件 Context），因此按不可混淆的
    /// `(Fork, 代际, 服务名)` 三元组匹配。
    pub(crate) fn remove_by_fork(
        &mut self,
        name: &str,
        fork: ForkId,
        generation: u64,
    ) -> Option<ServiceEntry> {
        let key = self
            .entries
            .iter()
            .find(|(_, entry)| {
                entry.name == name && entry.fork == fork && entry.generation == generation
            })
            .map(|(key, _)| key.clone())?;
        self.entries.remove(&key)
    }

    /// 全局插件服务索引查询：按名返回最高代际的全局条目。
    #[must_use]
    pub(crate) fn find_global(&self, name: &str) -> Option<&ServiceEntry> {
        self.entries
            .values()
            .filter(|entry| entry.global && entry.name == name)
            .max_by(|left, right| {
                left.generation
                    .cmp(&right.generation)
                    .then_with(|| right.provider.cmp(&left.provider))
            })
    }
}

/// 注入状态。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum InjectionState {
    /// 等待依赖就绪。
    Waiting,
    /// 已在注入 Fork 中执行回调。
    Satisfied,
}

/// 注入记录。
pub(crate) struct Injection {
    pub(crate) id: InjectionId,
    pub(crate) owner_plugin: Option<PluginId>,
    pub(crate) owner_fork: ForkId,
    pub(crate) context: ContextId,
    pub(crate) dependencies: Vec<ServiceName>,
    pub(crate) callback: Arc<dyn Fn(&Context) + Send + Sync>,
    pub(crate) state: InjectionState,
    pub(crate) fork: Option<ForkId>,
    /// 回调执行 Context；随注入 Fork 创建与销毁，回调副作用归属注入 Fork。
    pub(crate) execution_context: Option<ContextId>,
    /// 已消费的服务代际：`(提供方 Fork, 代际, 服务名)`。
    pub(crate) bindings: BTreeSet<(ForkId, u64, ServiceName)>,
}

impl std::fmt::Debug for Injection {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Injection")
            .field("id", &self.id)
            .field("owner_plugin", &self.owner_plugin)
            .field("context", &self.context)
            .field("dependencies", &self.dependencies)
            .field("state", &self.state)
            .finish_non_exhaustive()
    }
}

struct InjectionRecorder {
    captured: Vec<(ForkId, u64, ServiceName)>,
}

thread_local! {
    static ACTIVE_INJECTION: RefCell<Option<InjectionRecorder>> = const { RefCell::new(None) };
}

/// 在注入回调执行期间记录服务消费关系。
pub(crate) fn record_service_access(entry: &ServiceEntry) {
    let _ = ACTIVE_INJECTION.try_with(|cell| {
        if let Ok(mut guard) = cell.try_borrow_mut() {
            if let Some(recorder) = guard.as_mut() {
                let key = (entry.fork, entry.generation, entry.name.clone());
                if !recorder.captured.contains(&key) {
                    recorder.captured.push(key);
                }
            }
        }
    });
}

fn run_with_recorder<R>(
    recorder: InjectionRecorder,
    work: impl FnOnce() -> R,
) -> (R, Option<InjectionRecorder>) {
    let previous = ACTIVE_INJECTION.with(|cell| cell.replace(Some(recorder)));
    let result = work();
    let captured = ACTIVE_INJECTION.with(|cell| cell.replace(previous));
    (result, captured)
}

impl Kernel {
    /// 声明依赖并注入回调。
    pub(crate) fn register_injection(
        &self,
        from: ContextId,
        dependencies: &[ServiceName],
        callback: Arc<dyn Fn(&Context) + Send + Sync>,
    ) -> Result<InjectionId, KernelError> {
        for dependency in dependencies {
            crate::name::validate_service_name(dependency)?;
        }
        let id = {
            let mut state = self.lock_state()?;
            let (owner_fork, owner_plugin) = {
                let node = state
                    .contexts
                    .node(from)
                    .ok_or(KernelError::ContextDisposed { id: from })?;
                if node.state != ContextState::Active {
                    return Err(KernelError::ContextDisposed { id: from });
                }
                let owner_plugin = state.plugin_owner_chain(from).map(|(plugin, _)| plugin);
                (node.fork, owner_plugin)
            };
            let injection_id = state.alloc_id();
            state.injections.insert(
                injection_id,
                Injection {
                    id: injection_id,
                    owner_plugin,
                    owner_fork,
                    context: from,
                    dependencies: dependencies.to_vec(),
                    callback,
                    state: InjectionState::Waiting,
                    fork: None,
                    execution_context: None,
                    bindings: BTreeSet::new(),
                },
            );
            state
                .injections_by_owner
                .entry(owner_fork)
                .or_default()
                .insert(injection_id);
            for dependency in dependencies {
                state
                    .waiting_injections
                    .entry(dependency.clone())
                    .or_default()
                    .insert(injection_id);
            }
            injection_id
        };

        self.try_satisfy_injection(id)?;
        Ok(id)
    }

    /// 尝试满足一个注入：依赖就绪时创建注入 Fork 并执行回调。
    pub(crate) fn try_satisfy_injection(&self, id: InjectionId) -> Result<bool, KernelError> {
        let (context, callback, dependencies, owner_fork, owner_plugin) = {
            let state = self.lock_state()?;
            let Some(injection) = state.injections.get(&id) else {
                return Ok(false);
            };
            if injection.state == InjectionState::Satisfied {
                return Ok(true);
            }
            (
                injection.context,
                Arc::clone(&injection.callback),
                injection.dependencies.clone(),
                injection.owner_fork,
                injection.owner_plugin.clone(),
            )
        };

        let mut seeded = Vec::new();
        for dependency in &dependencies {
            match self.resolve_service(context, dependency) {
                Some(entry) => seeded.push((entry.fork, entry.generation, entry.name)),
                None => {
                    let mut state = self.lock_state()?;
                    state
                        .waiting_injections
                        .entry(dependency.clone())
                        .or_default()
                        .insert(id);
                    return Ok(false);
                }
            }
        }

        // 注入回调在专用执行 Context（子节点，作用域 Fork 即注入 Fork）中运行：
        // 回调内登记的副作用归属注入 Fork，随依赖失效一并撤销（§5.3）。
        let (execution_context, fork) = {
            let mut state = self.lock_state()?;
            match state.injections.get(&id) {
                Some(injection) if injection.state == InjectionState::Waiting => {
                    let fork = state.create_fork(context, Some(owner_fork));
                    let execution_context = state.alloc_id();
                    state.contexts.insert(ContextNode {
                        id: execution_context,
                        parent: Some(context),
                        children: Vec::new(),
                        fork,
                        state: ContextState::Active,
                    });
                    state.injection_contexts.insert(execution_context);
                    if let Some(parent) = state.contexts.node_mut(context) {
                        parent.children.push(execution_context);
                    }
                    (execution_context, fork)
                }
                _ => return Ok(true),
            }
        };
        self.publish_contexts()?;

        let context_handle = Context::new(execution_context, self.clone());
        let recorder = InjectionRecorder { captured: seeded };
        let (outcome, captured) = run_with_recorder(recorder, || {
            catch_unwind(AssertUnwindSafe(|| callback(&context_handle)))
        });

        match outcome {
            Ok(()) => {
                let mut state = self.lock_state()?;
                let Some(injection) = state.injections.get_mut(&id) else {
                    return Ok(false);
                };
                injection.state = InjectionState::Satisfied;
                injection.fork = Some(fork);
                injection.execution_context = Some(execution_context);
                if let Some(captured) = captured {
                    injection.bindings.extend(captured.captured);
                }
                let bindings: Vec<(ForkId, u64, ServiceName)> =
                    injection.bindings.iter().cloned().collect();
                for key in bindings {
                    state.reverse.entry(key).or_default().insert(id);
                }
                Ok(true)
            }
            Err(_) => {
                let _ = self.dispose_context(execution_context);
                if let Ok(mut state) = self.lock_state() {
                    if let Some(injection) = state.injections.get_mut(&id) {
                        injection.fork = None;
                        injection.execution_context = None;
                        injection.state = InjectionState::Waiting;
                    }
                }
                let dependent = owner_plugin.clone().unwrap_or_default();
                if let Some(plugin) = owner_plugin {
                    self.fail_plugin(
                        &plugin,
                        KernelError::InjectFailed {
                            dependent: plugin.clone(),
                        },
                    );
                }
                Err(KernelError::InjectFailed { dependent })
            }
        }
    }

    /// 撤销一个注入：销毁注入 Fork 并把注入置回 `Waiting`。
    pub(crate) fn revoke_injection(&self, id: InjectionId) -> Result<(), KernelError> {
        let (fork, execution_context, bindings) = {
            let mut state = self.lock_state()?;
            let Some(injection) = state.injections.get_mut(&id) else {
                return Ok(());
            };
            let fork = injection.fork.take();
            let execution_context = injection.execution_context.take();
            injection.state = InjectionState::Waiting;
            let bindings: Vec<(ForkId, u64, ServiceName)> =
                injection.bindings.iter().cloned().collect();
            injection.bindings.clear();
            (fork, execution_context, bindings)
        };

        {
            let mut state = self.lock_state()?;
            for key in &bindings {
                if let Some(set) = state.reverse.get_mut(key) {
                    set.remove(&id);
                    if set.is_empty() {
                        state.reverse.remove(key);
                    }
                }
            }
            if let Some(injection) = state.injections.get(&id) {
                let dependencies = injection.dependencies.clone();
                for dependency in dependencies {
                    state
                        .waiting_injections
                        .entry(dependency)
                        .or_default()
                        .insert(id);
                }
            }
        }

        if let Some(execution_context) = execution_context {
            self.dispose_context(execution_context)?;
        } else if let Some(fork) = fork {
            self.dispose_fork(fork)?;
        }
        Ok(())
    }

    /// 服务代际替换后的级联重建入口；带深度上限保护。
    ///
    /// 深度超过 `MAX_REBUILD_DEPTH` 时中止本轮：撤回受影响注入（回到
    /// `Waiting`）但不再重建，并上报 `KERNEL_REBUILD_OVERFLOW`；中止状态
    /// 在外层重建栈退回深度 0 时解除。
    pub(crate) fn rebuild_replaced(&self, replaced: Vec<ServiceEntry>) -> Result<(), KernelError> {
        let root = replaced
            .first()
            .map_or_else(String::new, |entry| entry.name.clone());
        let abort = {
            let mut state = self.lock_state()?;
            if state.rebuild_aborted {
                true
            } else if state.rebuild_depth >= MAX_REBUILD_DEPTH as u32 {
                state.rebuild_aborted = true;
                true
            } else {
                state.rebuild_depth += 1;
                false
            }
        };
        if abort {
            self.abort_rebuild(replaced);
            return Err(KernelError::RebuildOverflow { root });
        }

        let result = self.rebuild_replaced_inner(replaced);
        if let Ok(mut state) = self.lock_state() {
            state.rebuild_depth = state.rebuild_depth.saturating_sub(1);
            if state.rebuild_depth == 0 {
                state.rebuild_aborted = false;
            }
        }
        result
    }

    /// 中止轮次：迭代撤回受影响注入，不再重建。
    ///
    /// `remove_service` 在中止期间只摘条目、不入队重建，新的待处理条目
    /// 进入 `overflow_pending`，由本循环统一消费；每个条目只处理一次，
    /// 因此循环有界。
    fn abort_rebuild(&self, replaced: Vec<ServiceEntry>) {
        if let Ok(mut state) = self.lock_state() {
            state.overflow_pending.extend(replaced);
        }
        loop {
            let pending = match self.lock_state() {
                Ok(mut state) => std::mem::take(&mut state.overflow_pending),
                Err(_) => return,
            };
            if pending.is_empty() {
                return;
            }
            for entry in pending {
                let affected = match self.lock_state() {
                    Ok(mut state) => state
                        .reverse
                        .remove(&(entry.fork, entry.generation, entry.name.clone()))
                        .unwrap_or_default(),
                    Err(_) => return,
                };
                for id in affected {
                    let _ = self.revoke_injection(id);
                }
            }
        }
    }

    fn rebuild_replaced_inner(&self, replaced: Vec<ServiceEntry>) -> Result<(), KernelError> {
        let affected: BTreeSet<InjectionId> = {
            let mut state = self.lock_state()?;
            let mut affected = BTreeSet::new();
            for entry in &replaced {
                let key = (entry.fork, entry.generation, entry.name.clone());
                if let Some(set) = state.reverse.remove(&key) {
                    affected.extend(set);
                }
            }
            affected
        };
        if affected.is_empty() {
            return Ok(());
        }

        let ranks = {
            let state = self.lock_state()?;
            let order = state.plugins.topological_order();
            let mut ranks = HashMap::new();
            for id in &affected {
                let rank = state
                    .injections
                    .get(id)
                    .and_then(|injection| injection.owner_plugin.as_deref())
                    .map_or(usize::MAX, |plugin| state.plugins.rank(plugin, &order));
                ranks.insert(*id, rank);
            }
            ranks
        };

        let mut ids: Vec<InjectionId> = affected.into_iter().collect();
        ids.sort_by_key(|id| std::cmp::Reverse(ranks.get(id).copied().unwrap_or(usize::MAX)));
        for id in &ids {
            let _ = self.revoke_injection(*id);
        }
        ids.sort_by_key(|id| ranks.get(id).copied().unwrap_or(usize::MAX));
        for id in ids {
            let _ = self.try_satisfy_injection(id);
        }
        Ok(())
    }

    /// 新服务发布后满足等待中的注入。
    pub(crate) fn satisfy_waiting(&self, name: &str) {
        let candidates: Vec<InjectionId> = match self.lock_state() {
            Ok(state) => state
                .waiting_injections
                .get(name)
                .map(|set| set.iter().copied().collect())
                .unwrap_or_default(),
            Err(_) => return,
        };
        if candidates.is_empty() {
            return;
        }
        let ranks = match self.lock_state() {
            Ok(state) => {
                let order = state.plugins.topological_order();
                candidates
                    .iter()
                    .map(|id| {
                        let rank = state
                            .injections
                            .get(id)
                            .and_then(|injection| injection.owner_plugin.as_deref())
                            .map_or(usize::MAX, |plugin| state.plugins.rank(plugin, &order));
                        (*id, rank)
                    })
                    .collect::<HashMap<InjectionId, usize>>()
            }
            Err(_) => return,
        };
        let mut ordered = candidates;
        ordered.sort_by_key(|id| ranks.get(id).copied().unwrap_or(usize::MAX));
        for id in ordered {
            let _ = self.try_satisfy_injection(id);
        }
    }

    /// 插件失败：回滚副作用、记录诊断并进入 `Failed`。
    pub(crate) fn fail_plugin(&self, id: &str, error: KernelError) {
        let _ = self.fail_plugin_inner(id, error, None, false);
    }

    /// 插件失败；`diagnostic` 为首选结构化诊断（例如配置系统的 `CONFIG_*` 错误）。
    pub(crate) fn fail_plugin_with(
        &self,
        id: &str,
        error: KernelError,
        diagnostic: Option<chips_core::ChipsError>,
    ) {
        let _ = self.fail_plugin_inner(id, error, diagnostic, false);
    }

    /// §6.2 / §6.8 运行期任务 panic 的判定闭环入口：仅当插件当前处于会收敛
    /// 到 `Failed` 的在册状态（`Active` / `Starting` / `Resolving`）时才改写
    /// 状态机并计入窗口；返回收敛后的（窗口尝试计数，重启世代凭证）——凭证
    /// 与计数在同一锁段读取，保证退避调度登记的世代锚定本次判定；`None`
    /// 表示状态机未被触碰（未登记，或已处于 `Installed` / `Stopping` /
    /// `Pending` / `Removed` 等由其它生命周期结论定稿的状态）。
    ///
    /// 放宽到激活中间态是必要的：`apply` 内登记的任务可能在插件进入 `Active`
    /// 之前就已 panic（监视器与 `finish_activation` 命令无先后保证），若只认
    /// `Active` 则该次崩溃既不改写状态也不计数，判定闭环出现漏判。中间态的
    /// 收敛与 `RunnerFailed` 臂同形，在飞的激活链由 `finish_activation` 的
    /// 「已失败不回退」分支保持 `Failed`，不会把插件重新抬到 `Active`。
    pub(crate) fn fail_plugin_task_panic(
        &self,
        id: &str,
        error: KernelError,
    ) -> Option<(u32, u64)> {
        self.fail_plugin_inner(id, error, None, true)
    }

    /// `crash_judgement` 为 `true` 时是崩溃判定路径：状态不收敛则整体空转，
    /// 连诊断也不改写，避免迟到的崩溃通知覆写停用/卸载的既有结论。
    fn fail_plugin_inner(
        &self,
        id: &str,
        error: KernelError,
        diagnostic: Option<chips_core::ChipsError>,
        crash_judgement: bool,
    ) -> Option<(u32, u64)> {
        let policy = CrashRestartPolicy::from(&self.inner.options);
        let now = std::time::Instant::now();
        let (fork, context, attempts) = {
            let mut state = self.lock_state().ok()?;
            let record = state.plugins.record_mut(id)?;
            let converges = matches!(
                record.state,
                PluginState::Active | PluginState::Starting | PluginState::Resolving
            );
            if crash_judgement && !converges {
                return None;
            }
            record.last_error = Some(diagnostic.unwrap_or_else(|| error.clone().into()));
            record.last_failure = Some(error);
            record.cancel_requested = false;
            let fork = record.fork.take();
            let context = record.context.take();
            if converges {
                state.plugins.set_state(id, PluginState::Failed);
            }
            // §6.8 熔断计数：激活失败与运行期崩溃共用同一窗口计数
            // （插件架构设计 §9.3）。仅在真实收敛到 `Failed` 时计入；
            // 世代表决与计数同锁段读取，退避调度据此锚定。
            let attempts = converges.then(|| {
                state.plugins.record_mut(id).map(|record| {
                    (
                        record.register_crash_attempt(now, policy),
                        record.crash_restart_generation,
                    )
                })
            });
            state.plugins.in_flight.remove(id);
            (fork, context, attempts.flatten())
        };
        if let Some(context) = context {
            let _ = self.dispose_context(context);
        } else if let Some(fork) = fork {
            let _ = self.dispose_fork(fork);
        }
        attempts
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(
        name: &str,
        provider: &str,
        fork: ForkId,
        generation: u64,
        global: bool,
    ) -> ServiceEntry {
        ServiceEntry {
            name: name.to_owned(),
            value: Arc::new(generation) as ServiceValue,
            provider: provider.to_owned(),
            fork,
            generation,
            global,
        }
    }

    #[test]
    fn test_service_entry_debug_omits_value() {
        // 服务值是 `Arc<dyn Any>`，诊断输出只给身份字段。
        let item = entry("file", "chips.a", 10, 3, true);
        let text = format!("{item:?}");
        assert!(
            text.contains("ServiceEntry")
                && text.contains("\"file\"")
                && text.contains("chips.a")
                && text.contains("3"),
            "服务条目诊断应含名称、提供方与代际：{text}"
        );
        assert!(!text.contains("value"), "服务值不得进入诊断输出：{text}");
    }

    #[test]
    fn test_service_table_scoped_entries_and_global_index() {
        // §5.1：服务表以 (Context, 名称) 为键；全局索引只收插件级条目，
        // 同名取最高代际，代际并列时按提供方字典序取前者。
        let mut table = ServiceTable::default();
        assert!(table.is_empty());
        assert_eq!(table.len(), 0);
        assert!(table.get(1, "file").is_none());
        assert!(table.find_global("file").is_none());

        assert!(table
            .insert(1, entry("file", "chips.a", 10, 1, true))
            .is_none());
        table.insert(2, entry("file", "chips.b", 20, 1, true));
        table.insert(3, entry("file-scope", "chips.c", 30, 1, false));
        assert_eq!(table.len(), 3);
        assert!(!table.is_empty());
        assert!(table.get(1, "file").is_some(), "精确键应命中");
        assert!(table.get(1, "file-scope").is_none(), "键含 Context 维度");

        assert_eq!(
            table.find_global("file").map(|item| item.provider.clone()),
            Some("chips.a".to_owned()),
            "同代际并列时结果必须唯一且可复现"
        );
        table.insert(4, entry("file", "chips.z", 40, 9, true));
        assert_eq!(
            table.find_global("file").map(|item| item.generation),
            Some(9),
            "全局索引必须取最高代际"
        );
        assert!(
            table.find_global("file-scope").is_none(),
            "子作用域条目不得进入全局索引"
        );

        // remove 按 (Context, 名称) 精确摘除，重复摘除返回 None。
        assert!(table.remove(1, "file").is_some());
        assert!(table.get(1, "file").is_none());
        assert!(table.remove(1, "file").is_none());
        assert_eq!(table.len(), 3);

        // 同键再注册返回被替换条目，供级联重建定位旧代际（§5.4）。
        let replaced = table.insert(2, entry("file", "chips.b", 20, 3, true));
        assert_eq!(
            replaced.map(|item| item.generation),
            Some(1),
            "同键插入必须返回旧代际条目"
        );
        assert_eq!(
            table.get(2, "file").map(|item| item.generation),
            Some(3),
            "插入后表中应是新代际"
        );
        assert_eq!(
            table.remove(2, "file").map(|item| item.fork),
            Some(20),
            "摘除后不得留下旧代际"
        );
        assert_eq!(
            table.remove(3, "file-scope").map(|item| item.fork),
            Some(30)
        );
        assert_eq!(
            table.remove(4, "file").map(|item| item.provider),
            Some("chips.z".to_owned())
        );
        assert!(table.is_empty());
    }

    #[test]
    fn test_remove_by_fork_matches_generation_and_name() {
        // §5.4：撤销按不可混淆的 `(Fork, 代际, 名称)` 三元组匹配。
        let mut table = ServiceTable::default();
        table.insert(1, entry("file", "chips.a", 10, 2, true));
        table.insert(2, entry("other", "chips.b", 20, 2, true));
        assert!(
            table.remove_by_fork("file", 10, 1).is_none(),
            "代际不匹配不得摘除（新代际尚未发布）"
        );
        assert!(
            table.remove_by_fork("file", 11, 2).is_none(),
            "Fork 不匹配不得摘除"
        );
        assert!(table
            .remove_by_fork("other", 20, 2)
            .is_some_and(|item| item.provider == "chips.b"));
        assert_eq!(table.len(), 1);
    }

    #[test]
    fn test_injection_debug_shows_state_and_dependencies() {
        let injection = Injection {
            id: 5,
            owner_plugin: Some("chips.test.a".to_owned()),
            owner_fork: 9,
            context: 3,
            dependencies: vec!["file".to_owned()],
            callback: Arc::new(|_context: &Context| {}),
            state: InjectionState::Waiting,
            fork: None,
            execution_context: None,
            bindings: BTreeSet::from([(9_u64, 1_u64, "file".to_owned())]),
        };
        let text = format!("{injection:?}");
        assert!(
            text.contains("Injection")
                && text.contains("chips.test.a")
                && text.contains("file")
                && text.contains("Waiting"),
            "注入诊断应含归属、依赖与状态：{text}"
        );
        assert!(!text.contains("callback"), "回调不得进入诊断输出：{text}");
    }
}
