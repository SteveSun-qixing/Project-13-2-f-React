//! 插件状态机、依赖图、拓扑排序与加载事务。
//!
//! 对应《薯片内核设计》第六章、第七章：内核只处理状态机、依赖与生命周期；
//! 清单校验、包读取与安装由插件管理层完成，内核接收的 `LoadRequest` 已包含
//! 插件 ID、版本、依赖声明与 `PluginRunner`。

use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use chips_core::{ContextId, ForkId, PluginId, Version, VersionRange};
use serde_json::Value;
use tokio::sync::oneshot;

use crate::context::Context;
use crate::error::{KernelError, NameKind};

/// 插件角色；内核不按角色分支，仅随 `plugin:loaded` 载荷与审计展示。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PluginRole {
    /// 基础卡片插件。
    BaseCard,
    /// 箱子布局插件。
    BoxLayout,
    /// 应用插件。
    App,
    /// 服务插件。
    Service,
}

impl PluginRole {
    /// 角色标识字符串。
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::BaseCard => "basecard",
            Self::BoxLayout => "boxlayout",
            Self::App => "app",
            Self::Service => "service",
        }
    }

    /// 从角色标识解析。
    pub fn parse(value: &str) -> Result<Self, KernelError> {
        match value {
            "basecard" => Ok(Self::BaseCard),
            "boxlayout" => Ok(Self::BoxLayout),
            "app" => Ok(Self::App),
            "service" => Ok(Self::Service),
            other => Err(KernelError::InvalidName {
                kind: NameKind::PluginRole,
                name: other.to_owned(),
            }),
        }
    }
}

/// 插件生命周期状态；与插件管理层状态一一对应。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PluginState {
    /// 启用请求已受理，等待依赖满足。
    Pending,
    /// 解析依赖、版本与拓扑序（内核内部子阶段）。
    Resolving,
    /// 执行 `PluginRunner::apply`。
    Starting,
    /// 运行中。
    Active,
    /// 正在撤销副作用。
    Stopping,
    /// 已停用，登记保留、零副作用。
    Installed,
    /// 加载或运行失败，副作用已回滚。
    Failed,
    /// 内核登记已移除（终态）。
    Removed,
}

impl PluginState {
    /// 状态迁移是否合法（《薯片内核设计》§6.2 迁移表）。
    #[must_use]
    pub fn can_transition_to(self, next: Self) -> bool {
        matches!(
            (self, next),
            (Self::Pending, Self::Resolving)
                | (Self::Pending, Self::Installed)
                | (Self::Resolving, Self::Starting)
                | (Self::Resolving, Self::Pending)
                | (Self::Resolving, Self::Failed)
                | (Self::Resolving, Self::Installed)
                | (Self::Starting, Self::Active)
                | (Self::Starting, Self::Failed)
                | (Self::Starting, Self::Installed)
                | (Self::Active, Self::Stopping)
                | (Self::Active, Self::Failed)
                | (Self::Stopping, Self::Installed)
                | (Self::Installed, Self::Resolving)
                | (Self::Installed, Self::Removed)
                | (Self::Failed, Self::Resolving)
                | (Self::Failed, Self::Removed)
        )
    }
}

/// 插件命名空间生效值视图；默认值已合并，键为相对键。
#[derive(Debug, Clone, Default)]
pub struct PluginConfig {
    /// 相对键到生效值的映射。
    pub values: BTreeMap<String, Value>,
}

/// 配置快照提供者；由配置系统实现，内核在 `apply` 前取一次只读快照。
pub trait ConfigProvider: Send + Sync + 'static {
    /// 取插件命名空间生效值快照。
    fn snapshot(&self, plugin_id: &PluginId) -> Result<PluginConfig, KernelError>;
}

/// 默认配置提供者：所有插件都得到空快照。
#[derive(Debug, Default)]
pub struct EmptyConfigProvider;

impl ConfigProvider for EmptyConfigProvider {
    fn snapshot(&self, _plugin_id: &PluginId) -> Result<PluginConfig, KernelError> {
        Ok(PluginConfig::default())
    }
}

/// 插件代码的执行抽象；TypeScript 插件由 Neon 适配层实现。
#[async_trait]
pub trait PluginRunner: Send + Sync {
    /// 执行插件 apply（`Starting` 阶段）；返回前副作用必须已登记到 `ctx` 对应 Fork。
    ///
    /// 超时上限 30s（`LIFECYCLE_APPLY_TIMEOUT`），超时按强制撤销处理并报
    /// `KERNEL_LIFECYCLE_TIMEOUT`。
    async fn apply(&self, ctx: &Context, config: &PluginConfig) -> Result<(), KernelError>;

    /// 插件停用回调（`Stopping` 阶段）；正常清理由 Fork 撤销负责。
    ///
    /// 超时上限 10s（`LIFECYCLE_STOP_TIMEOUT`），超时后不再等待并进入强制撤销。
    async fn stop(&self, ctx: &Context) -> Result<(), KernelError>;
}

/// 依赖声明。
#[derive(Debug, Clone)]
pub struct DependencySpec {
    /// 被依赖的插件 ID。
    pub id: PluginId,
    /// 版本范围（语义化版本）。
    pub range: VersionRange,
}

/// 依赖图节点。
#[derive(Debug, Clone)]
pub struct PluginNode {
    /// 插件 ID。
    pub id: PluginId,
    /// 插件版本。
    pub version: Version,
    /// 依赖声明集合。
    pub dependencies: Vec<DependencySpec>,
}

/// 依赖图；静态依赖关系在加载请求阶段构建。
#[derive(Debug, Clone, Default)]
pub struct DependencyGraph {
    nodes: BTreeMap<PluginId, PluginNode>,
}

impl DependencyGraph {
    /// 空图。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// 插入或替换节点。
    pub fn insert(&mut self, node: PluginNode) {
        self.nodes.insert(node.id.clone(), node);
    }

    /// 读取节点。
    #[must_use]
    pub fn get(&self, id: &str) -> Option<&PluginNode> {
        self.nodes.get(id)
    }

    /// 全部节点 ID。
    pub fn ids(&self) -> impl Iterator<Item = &PluginId> {
        self.nodes.keys()
    }

    /// 指定节点的依赖声明；节点不存在时返回空切片。
    #[must_use]
    pub fn dependencies_of(&self, id: &str) -> &[DependencySpec] {
        self.nodes
            .get(id)
            .map_or(&[], |node| node.dependencies.as_slice())
    }
}

/// 三色标记。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum VisitState {
    Unvisited,
    Visiting,
    Done,
}

/// 计算依赖拓扑序：被依赖者在前，依赖方在后。
///
/// 采用三色标记的迭代式深度优先遍历，不使用递归；发现 `Visiting` 节点重复
/// 访问即判定成环并返回环路径。图构建与版本检查不在本函数内。
pub fn resolve_order(graph: &DependencyGraph) -> Result<Vec<PluginId>, KernelError> {
    let mut states: HashMap<&str, VisitState> = graph
        .ids()
        .map(|id| (id.as_str(), VisitState::Unvisited))
        .collect();
    let mut order: Vec<PluginId> = Vec::with_capacity(states.len());

    for root in graph.ids() {
        if states.get(root.as_str()).copied() == Some(VisitState::Done) {
            continue;
        }
        let mut stack: Vec<(&str, usize)> = vec![(root.as_str(), 0)];
        states.insert(root.as_str(), VisitState::Visiting);

        while let Some((current, edge)) = stack.pop() {
            let dependencies = graph.dependencies_of(current);
            match dependencies.get(edge) {
                Some(next) => {
                    stack.push((current, edge + 1));
                    match states
                        .get(next.id.as_str())
                        .copied()
                        .unwrap_or(VisitState::Unvisited)
                    {
                        VisitState::Visiting => {
                            let start = stack
                                .iter()
                                .position(|(id, _)| *id == next.id.as_str())
                                .unwrap_or(0);
                            let mut path: Vec<PluginId> = stack[start..]
                                .iter()
                                .map(|(id, _)| (*id).to_owned())
                                .collect();
                            path.push(next.id.clone());
                            return Err(KernelError::DependencyCycle { path });
                        }
                        VisitState::Done => {}
                        VisitState::Unvisited => {
                            states.insert(next.id.as_str(), VisitState::Visiting);
                            stack.push((next.id.as_str(), 0));
                        }
                    }
                }
                None => {
                    states.insert(current, VisitState::Done);
                    order.push(current.to_owned());
                }
            }
        }
    }

    Ok(order)
}

/// 加载请求；由插件管理层在完成清单校验与包读取后构造。
pub struct LoadRequest {
    /// 插件 ID。
    pub id: PluginId,
    /// 插件版本。
    pub version: Version,
    /// 可被更新的候选版本集合（用于区分「暂不满足」与「互斥」）。
    pub available_versions: Vec<Version>,
    /// 直接依赖声明。
    pub dependencies: Vec<DependencySpec>,
    /// 插件角色；仅用于事件载荷与审计。
    pub role: PluginRole,
    /// 插件 Context 的父节点；默认根 Context。
    pub parent: Option<ContextId>,
    /// 插件代码执行器。
    pub runner: Arc<dyn PluginRunner>,
}

/// §6.8 崩溃重启熔断策略快照。
///
/// 默认值即 `CRASH_RESTART_*` 在册常量（《薯片内核设计》§6.8 唯一权威数值）；
/// `Kernel::with_options` 按 `KernelOptions` 覆盖，内核策略面可注入而常量
/// 消费路径唯一。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct CrashRestartPolicy {
    /// 滚动窗口长度（`CRASH_RESTART_WINDOW`）。
    pub(crate) window: Duration,
    /// 窗口内最大自动重启次数（`CRASH_RESTART_MAX_ATTEMPTS`）。
    pub(crate) max_attempts: u32,
    /// 首次退避间隔（`CRASH_RESTART_BACKOFF_INITIAL`）。
    pub(crate) backoff_initial: Duration,
    /// 单次退避间隔上限（`CRASH_RESTART_BACKOFF_MAX`）。
    pub(crate) backoff_max: Duration,
}

impl Default for CrashRestartPolicy {
    fn default() -> Self {
        Self {
            window: crate::constants::CRASH_RESTART_WINDOW,
            max_attempts: crate::constants::CRASH_RESTART_MAX_ATTEMPTS,
            backoff_initial: crate::constants::CRASH_RESTART_BACKOFF_INITIAL,
            backoff_max: crate::constants::CRASH_RESTART_BACKOFF_MAX,
        }
    }
}

/// 计算窗口内第 `attempt` 次（自 1 起）失败后自动重启前的退避等待。
///
/// 《薯片内核设计》§6.8：首次 `backoff_initial`（1s），其后指数翻倍
/// （2s、4s…），单次间隔封顶 `backoff_max`（30s）。
pub(crate) fn crash_restart_backoff(
    attempt: u32,
    backoff_initial: Duration,
    backoff_max: Duration,
) -> Duration {
    let mut delay = backoff_initial;
    for _ in 1..attempt {
        if delay >= backoff_max {
            break;
        }
        delay = delay.saturating_mul(2);
    }
    delay.min(backoff_max)
}

pub(crate) struct PluginRecord {
    pub(crate) version: Version,
    pub(crate) available_versions: Vec<Version>,
    pub(crate) dependencies: Vec<DependencySpec>,
    pub(crate) role: PluginRole,
    pub(crate) parent: Option<ContextId>,
    pub(crate) state: PluginState,
    pub(crate) context: Option<ContextId>,
    pub(crate) fork: Option<ForkId>,
    pub(crate) last_error: Option<chips_core::ChipsError>,
    pub(crate) last_failure: Option<KernelError>,
    pub(crate) runner: Arc<dyn PluginRunner>,
    pub(crate) cancel_requested: bool,
    /// §6.8 崩溃重启滚动窗口内的失败尝试时刻序列（自旧至新排列）。
    /// 激活失败与运行期崩溃共用本计数（插件架构设计 §9.3）。
    pub(crate) crash_window: VecDeque<Instant>,
    /// §6.8 重启取消世代：退避定时器在调度时携带当时的世代值，任何一次
    /// 停用、卸载与用户显式启用/装载都会递增本世代，使先前登记的
    /// 「退避待重启」在到点复核时因世代不符而作废（取消在途重启任务）。
    pub(crate) crash_restart_generation: u64,
    /// §6.8 停用抑制位：插件被用户停用后置真，堵住「停用意图与迟到崩溃
    /// 判定竞态」下插件被自动重启复生的通道；用户显式 `enable` / `load`
    /// 清除此位（恢复自动重启资格）。
    pub(crate) auto_restart_suppressed: bool,
    /// 在飞激活链未收尾时到达的停用命令回执：插件定稿
    /// （`Installed` / `Failed` / `Removed`）时由生命周期钩子补发，
    /// 保证「`disable` 返回 `Ok` 即插件确定不再运行」，其后的 `unload`
    /// 不再撞上在飞链的中间态。
    pub(crate) pending_disable_reply: Option<oneshot::Sender<Result<(), KernelError>>>,
}

impl PluginRecord {
    fn node(&self, id: &PluginId) -> PluginNode {
        PluginNode {
            id: id.clone(),
            version: self.version.clone(),
            dependencies: self.dependencies.clone(),
        }
    }

    /// 丢弃已滑出窗口的尝试记录。
    ///
    /// 时钟不回拨是单调钟不变量；对注入的未来时间戳（测试场景）按未过期处理。
    fn prune_crash_window(&mut self, now: Instant, policy: &CrashRestartPolicy) {
        while let Some(front) = self.crash_window.front().copied() {
            let expired = now
                .checked_duration_since(front)
                .is_some_and(|elapsed| elapsed >= policy.window);
            if expired {
                self.crash_window.pop_front();
            } else {
                break;
            }
        }
    }

    /// 登记一次失败尝试（修剪过期记录后写入当前时刻），返回窗口内尝试总数。
    pub(crate) fn register_crash_attempt(
        &mut self,
        now: Instant,
        policy: CrashRestartPolicy,
    ) -> u32 {
        self.prune_crash_window(now, &policy);
        self.crash_window.push_back(now);
        self.crash_window.len() as u32
    }

    /// 窗口内尝试计数（只读修剪，不回写队列）。
    #[must_use]
    pub(crate) fn crash_attempts_within(&self, now: Instant, policy: CrashRestartPolicy) -> u32 {
        let stale = self
            .crash_window
            .iter()
            .take_while(|attempt| {
                now.checked_duration_since(**attempt)
                    .is_some_and(|elapsed| elapsed >= policy.window)
            })
            .count();
        (self.crash_window.len() - stale) as u32
    }

    /// 修剪后判定自动重启次数是否已超出熔断上限（§6.8「超过上限进入
    /// `Failed` 并停止自动重启」）。
    pub(crate) fn crash_restart_exhausted(
        &mut self,
        now: Instant,
        policy: CrashRestartPolicy,
    ) -> bool {
        self.prune_crash_window(now, &policy);
        self.crash_window.len() as u32 > policy.max_attempts
    }

    /// §6.8：显式 `enable` 重置窗口计数。
    pub(crate) fn reset_crash_window(&mut self) {
        self.crash_window.clear();
    }

    /// 停用/卸载意图：作废已登记的退避待重启（递增世代）并抑制后续自动重启，
    /// 直至用户显式 `enable` / `load` 重新放行。
    pub(crate) fn cancel_auto_restart(&mut self) {
        self.crash_restart_generation = self.crash_restart_generation.wrapping_add(1);
        self.auto_restart_suppressed = true;
    }

    /// 用户显式启用/装载：恢复自动重启资格，并作废停用前遗留的退避待重启。
    pub(crate) fn allow_auto_restart(&mut self) {
        self.crash_restart_generation = self.crash_restart_generation.wrapping_add(1);
        self.auto_restart_suppressed = false;
    }
}

/// 加载计划。
pub(crate) enum LoadPlan {
    /// 插件已处于 `Active`。
    AlreadyActive,
    /// 依赖暂不满足：停留在 `Pending`，记录诊断。
    Blocked(KernelError),
    /// 需要激活的插件集合（按拓扑序，被依赖者在前，目标在最后）。
    Activate(Vec<PluginId>),
    /// 显式冲突：进入 `Failed`。
    Rejected(KernelError),
}

/// 插件管理器；状态与依赖图的唯一权威。
#[derive(Default)]
pub(crate) struct PluginManager {
    pub(crate) records: HashMap<PluginId, PluginRecord>,
    pub(crate) in_flight: BTreeSet<PluginId>,
    pub(crate) queued: BTreeSet<PluginId>,
    /// §6.8 崩溃重启熔断策略快照（`Kernel::with_options` 构造时注入）。
    pub(crate) crash_policy: CrashRestartPolicy,
}

impl PluginManager {
    /// 登记或更新插件；同版本重复登记为幂等。
    pub(crate) fn register(&mut self, request: LoadRequest) -> Result<(), KernelError> {
        if let Some(existing) = self.records.get_mut(&request.id) {
            if existing.version != request.version && existing.state == PluginState::Active {
                return Err(KernelError::InvalidTransition {
                    id: request.id,
                    from: existing.state,
                    to: PluginState::Resolving,
                });
            }
            existing.version = request.version;
            existing.available_versions = request.available_versions;
            existing.dependencies = request.dependencies;
            existing.role = request.role;
            existing.parent = request.parent;
            existing.runner = request.runner;
            return Ok(());
        }
        self.records.insert(
            request.id.clone(),
            PluginRecord {
                version: request.version,
                available_versions: request.available_versions,
                dependencies: request.dependencies,
                role: request.role,
                parent: request.parent,
                state: PluginState::Installed,
                context: None,
                fork: None,
                last_error: None,
                last_failure: None,
                runner: request.runner,
                cancel_requested: false,
                crash_window: VecDeque::new(),
                crash_restart_generation: 0,
                auto_restart_suppressed: false,
                pending_disable_reply: None,
            },
        );
        Ok(())
    }

    pub(crate) fn state_of(&self, id: &str) -> Option<PluginState> {
        self.records.get(id).map(|record| record.state)
    }

    pub(crate) fn record(&self, id: &str) -> Option<&PluginRecord> {
        self.records.get(id)
    }

    pub(crate) fn record_mut(&mut self, id: &str) -> Option<&mut PluginRecord> {
        self.records.get_mut(id)
    }

    pub(crate) fn set_state(&mut self, id: &str, state: PluginState) {
        if let Some(record) = self.records.get_mut(id) {
            record.state = state;
            Self::apply_crash_window_lifecycle_hook(record, state);
        }
    }

    /// 状态迁移；非法迁移返回 `KERNEL_INVALID_TRANSITION`。
    pub(crate) fn mark(&mut self, id: &str, next: PluginState) -> Result<(), KernelError> {
        let record = self
            .records
            .get_mut(id)
            .ok_or_else(|| KernelError::PluginNotFound { id: id.to_owned() })?;
        if !record.state.can_transition_to(next) {
            return Err(KernelError::InvalidTransition {
                id: id.to_owned(),
                from: record.state,
                to: next,
            });
        }
        record.state = next;
        Self::apply_crash_window_lifecycle_hook(record, next);
        Ok(())
    }

    /// §6.8 生命周期收口钩子：
    ///
    /// 1. 计数清零——插件进入 `Installed`（停用收敛）或 `Removed`（卸载终态）
    ///    时清零崩溃重启窗口计数；
    /// 2. 停用回执补发——插件定稿（`Installed` / `Failed` / `Removed`，即
    ///    确定不再运行的终态）时补发在飞链期间挂账的停用回执，兑现
    ///    「`disable` 返回 `Ok` 即插件确定不再运行」的端到端契约。
    fn apply_crash_window_lifecycle_hook(record: &mut PluginRecord, next: PluginState) {
        if matches!(next, PluginState::Installed | PluginState::Removed) {
            record.crash_window.clear();
        }
        if matches!(
            next,
            PluginState::Installed | PluginState::Failed | PluginState::Removed
        ) {
            if let Some(reply) = record.pending_disable_reply.take() {
                let _ = reply.send(Ok(()));
            }
        }
    }

    /// 依赖图（排除已移除的插件）。
    pub(crate) fn graph(&self) -> DependencyGraph {
        let mut graph = DependencyGraph::new();
        for (id, record) in &self.records {
            if record.state == PluginState::Removed {
                continue;
            }
            graph.insert(record.node(id));
        }
        graph
    }

    /// 直接依赖者（排除已移除）。
    pub(crate) fn dependents_of(&self, id: &str) -> Vec<PluginId> {
        let mut dependents: Vec<PluginId> = self
            .records
            .iter()
            .filter(|(candidate, record)| {
                candidate.as_str() != id
                    && record.state != PluginState::Removed
                    && record
                        .dependencies
                        .iter()
                        .any(|dependency| dependency.id == id)
            })
            .map(|(candidate, _)| candidate.clone())
            .collect();
        dependents.sort();
        dependents
    }

    /// 传递依赖者闭包。
    pub(crate) fn transitive_dependents(&self, id: &str) -> BTreeSet<PluginId> {
        let mut found = BTreeSet::new();
        let mut queue = vec![id.to_owned()];
        while let Some(current) = queue.pop() {
            for dependent in self.dependents_of(&current) {
                if found.insert(dependent.clone()) {
                    queue.push(dependent);
                }
            }
        }
        found
    }

    /// 插件拓扑序（被依赖者在前）；用于级联重建与停用排序。
    pub(crate) fn topological_order(&self) -> Vec<PluginId> {
        resolve_order(&self.graph()).unwrap_or_else(|_| {
            let mut ids: Vec<PluginId> = self
                .records
                .keys()
                .filter(|id| self.state_of(id) != Some(PluginState::Removed))
                .cloned()
                .collect();
            ids.sort();
            ids
        })
    }

    /// 依赖方拓扑排名；未知插件排在最后。
    pub(crate) fn rank(&self, id: &str, order: &[PluginId]) -> usize {
        order
            .iter()
            .position(|candidate| candidate == id)
            .unwrap_or(order.len())
    }

    /// 生成加载计划。
    pub(crate) fn plan_load(&self, id: &str) -> Result<LoadPlan, KernelError> {
        let record = self
            .records
            .get(id)
            .ok_or_else(|| KernelError::PluginNotFound { id: id.to_owned() })?;
        if record.state == PluginState::Removed {
            return Err(KernelError::PluginNotFound { id: id.to_owned() });
        }
        if record.state == PluginState::Active {
            return Ok(LoadPlan::AlreadyActive);
        }
        if matches!(
            record.state,
            PluginState::Stopping | PluginState::Starting | PluginState::Resolving
        ) {
            return Err(KernelError::InvalidTransition {
                id: id.to_owned(),
                from: record.state,
                to: PluginState::Resolving,
            });
        }

        // §6.8 熔断闸（自身）：窗口内尝试已超限的 `Failed` 插件停止一切
        // 自动重启（含依赖驱动的重激活），只等待显式 `enable`（该路径先行
        // 重置计数后放行）。在册迁移语义：超限后 `Failed → Resolving` 视同
        // 非法，回传 `KERNEL_INVALID_TRANSITION`，插件停留 `Failed` 不动。
        let now = Instant::now();
        if record.state == PluginState::Failed
            && record.crash_attempts_within(now, self.crash_policy) > self.crash_policy.max_attempts
        {
            return Err(KernelError::InvalidTransition {
                id: id.to_owned(),
                from: PluginState::Failed,
                to: PluginState::Resolving,
            });
        }

        match self.validate_dependencies(id) {
            Ok(None) => {}
            Ok(Some(error)) => return Ok(LoadPlan::Blocked(error)),
            Err(error) => return Ok(LoadPlan::Rejected(error)),
        }

        let closure = self.dependency_closure(id);
        for member in &closure {
            if member == id || !self.records.contains_key(member) {
                continue;
            }
            match self.validate_dependencies(member) {
                Ok(None) => {}
                Ok(Some(error)) => return Ok(LoadPlan::Blocked(error)),
                Err(error) => return Ok(LoadPlan::Rejected(error)),
            }
        }

        let subgraph = self.subgraph(&closure);
        let order = match resolve_order(&subgraph) {
            Ok(order) => order,
            Err(error) => return Ok(LoadPlan::Rejected(error)),
        };

        let needs_activation: Vec<PluginId> = order
            .into_iter()
            .filter(|candidate| {
                !matches!(
                    self.state_of(candidate),
                    Some(PluginState::Active) | Some(PluginState::Removed) | None
                )
            })
            .collect();

        if needs_activation.is_empty() {
            return Ok(LoadPlan::AlreadyActive);
        }

        // §6.8 熔断闸（闭包成员）：依赖已停在 `Failed` 且窗口超限时，本次
        // 计划按「依赖暂不就绪」阻塞（依赖方停留 `Pending`，§9.2），不再
        // 驱动其重激活——收敛依赖存在型的无界重试循环（工单047 附带发现）。
        for member in &needs_activation {
            if member == id {
                continue;
            }
            let exhausted = self.records.get(member).is_some_and(|record| {
                record.state == PluginState::Failed
                    && record.crash_attempts_within(now, self.crash_policy)
                        > self.crash_policy.max_attempts
            });
            if exhausted {
                return Ok(LoadPlan::Blocked(KernelError::DependencyMissing {
                    dependent: id.to_owned(),
                    missing: member.clone(),
                }));
            }
        }

        if let Some(in_flight) = needs_activation.iter().find(|candidate| {
            self.in_flight.contains(*candidate) || self.queued.contains(*candidate)
        }) {
            return Ok(LoadPlan::Blocked(KernelError::DependencyMissing {
                dependent: id.to_owned(),
                missing: in_flight.clone(),
            }));
        }

        Ok(LoadPlan::Activate(needs_activation))
    }

    /// 校验直接依赖：重复声明与版本满足性。
    ///
    /// 返回 `Some(error)` 表示停留 `Pending`；`Err` 表示显式冲突进入 `Failed`。
    fn validate_dependencies(&self, id: &str) -> Result<Option<KernelError>, KernelError> {
        let record = self
            .records
            .get(id)
            .ok_or_else(|| KernelError::PluginNotFound { id: id.to_owned() })?;

        for dependency in &record.dependencies {
            let missing = match self.records.get(&dependency.id) {
                Some(provider) => provider.state == PluginState::Removed,
                None => true,
            };
            if missing {
                return Ok(Some(KernelError::DependencyMissing {
                    dependent: id.to_owned(),
                    missing: dependency.id.clone(),
                }));
            }
            if dependency.id == id {
                return Err(KernelError::DependencyCycle {
                    path: vec![id.to_owned()],
                });
            }
        }

        let mut pending: Option<KernelError> = None;
        for dependency in &record.dependencies {
            let provider = match self.records.get(&dependency.id) {
                Some(provider) => provider,
                None => continue,
            };
            if dependency.range.satisfies(&provider.version) {
                continue;
            }
            let candidates: Vec<Version> = provider
                .available_versions
                .iter()
                .filter(|version| dependency.range.satisfies(version))
                .cloned()
                .collect();
            // `candidates` 统一表示「可满足声明范围的候选版本」：互斥时为空，
            // 暂不满足时非空（用于区分 Pending 与 Failed，§7.4）。
            if candidates.is_empty() {
                return Err(KernelError::DependencyVersion {
                    dependency: dependency.id.clone(),
                    required: dependency.range.to_string(),
                    actual: provider.version.to_string(),
                    candidates: Vec::new(),
                });
            }
            pending = Some(KernelError::DependencyVersion {
                dependency: dependency.id.clone(),
                required: dependency.range.to_string(),
                actual: provider.version.to_string(),
                candidates: candidates.iter().map(ToString::to_string).collect(),
            });
        }

        let mut declared = BTreeSet::new();
        for dependency in &record.dependencies {
            if !declared.insert(dependency.id.clone()) {
                return Err(KernelError::DependencyDuplicate {
                    dependent: id.to_owned(),
                    dependency: dependency.id.clone(),
                });
            }
        }

        Ok(pending)
    }

    /// 依赖闭包（含自身）。
    pub(crate) fn dependency_closure(&self, id: &str) -> BTreeSet<PluginId> {
        let mut closure = BTreeSet::new();
        let mut queue = vec![id.to_owned()];
        while let Some(current) = queue.pop() {
            if !closure.insert(current.clone()) {
                continue;
            }
            if let Some(record) = self.records.get(&current) {
                for dependency in &record.dependencies {
                    if !closure.contains(&dependency.id) {
                        queue.push(dependency.id.clone());
                    }
                }
            }
        }
        closure
    }

    fn subgraph(&self, ids: &BTreeSet<PluginId>) -> DependencyGraph {
        let mut graph = DependencyGraph::new();
        for id in ids {
            if let Some(record) = self.records.get(id) {
                if record.state != PluginState::Removed {
                    graph.insert(record.node(id));
                }
            }
        }
        graph
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spec(id: &str, range: &str) -> DependencySpec {
        DependencySpec {
            id: id.to_owned(),
            range: VersionRange::parse(range).expect("测试范围应合法"),
        }
    }

    fn node(id: &str, version: &str, dependencies: Vec<DependencySpec>) -> PluginNode {
        PluginNode {
            id: id.to_owned(),
            version: Version::parse(version).expect("测试版本应合法"),
            dependencies,
        }
    }

    #[test]
    fn test_resolve_order_dependencies_first() {
        let mut graph = DependencyGraph::new();
        graph.insert(node(
            "chips.app.editor",
            "1.0.0",
            vec![spec("chips.service.image", "^1.0.0")],
        ));
        graph.insert(node("chips.service.image", "1.2.0", vec![]));
        let order = resolve_order(&graph).expect("无环图应解析成功");
        let service = order
            .iter()
            .position(|id| id == "chips.service.image")
            .expect("服务插件应在序中");
        let app = order
            .iter()
            .position(|id| id == "chips.app.editor")
            .expect("应用插件应在序中");
        assert!(service < app, "被依赖者必须先于依赖方");
    }

    #[test]
    fn test_resolve_order_detects_cycle_with_path() {
        let mut graph = DependencyGraph::new();
        graph.insert(node("a", "1.0.0", vec![spec("b", "^1.0.0")]));
        graph.insert(node("b", "1.0.0", vec![spec("a", "^1.0.0")]));
        let error = resolve_order(&graph).expect_err("成环图应被拒绝");
        assert_eq!(error.code(), "KERNEL_DEPENDENCY_CYCLE");
        match error {
            KernelError::DependencyCycle { path } => {
                assert_eq!(
                    path.first().map(String::as_str),
                    path.last().map(String::as_str)
                );
                assert_eq!(path.len(), 3, "环路径应首尾闭合");
            }
            other => panic!("应返回环错误：{other:?}"),
        }
    }

    #[test]
    fn test_resolve_order_self_reference_is_cycle() {
        let mut graph = DependencyGraph::new();
        graph.insert(node("a", "1.0.0", vec![spec("a", "^1.0.0")]));
        let error = resolve_order(&graph).expect_err("自依赖应被拒绝");
        match error {
            KernelError::DependencyCycle { path } => {
                assert_eq!(path, vec!["a".to_owned(), "a".to_owned()])
            }
            other => panic!("应返回环错误：{other:?}"),
        }
    }

    #[test]
    fn test_plugin_state_transitions() {
        assert!(PluginState::Installed.can_transition_to(PluginState::Resolving));
        assert!(PluginState::Resolving.can_transition_to(PluginState::Starting));
        assert!(PluginState::Starting.can_transition_to(PluginState::Active));
        assert!(PluginState::Active.can_transition_to(PluginState::Stopping));
        assert!(PluginState::Stopping.can_transition_to(PluginState::Installed));
        assert!(PluginState::Failed.can_transition_to(PluginState::Resolving));
        assert!(!PluginState::Active.can_transition_to(PluginState::Installed));
        assert!(!PluginState::Removed.can_transition_to(PluginState::Resolving));
        assert!(!PluginState::Stopping.can_transition_to(PluginState::Active));
    }

    #[test]
    fn test_plugin_role_parse() {
        assert_eq!(PluginRole::parse("basecard"), Ok(PluginRole::BaseCard));
        assert_eq!(PluginRole::parse("boxlayout"), Ok(PluginRole::BoxLayout));
        assert_eq!(PluginRole::parse("app"), Ok(PluginRole::App));
        assert_eq!(PluginRole::parse("service"), Ok(PluginRole::Service));
        assert!(PluginRole::parse("other").is_err());
        assert_eq!(PluginRole::App.as_str(), "app");
    }

    /// 空执行器：仅满足 `LoadRequest` 对 `runner` 的要求。
    struct NoopRunner;

    #[async_trait]
    impl PluginRunner for NoopRunner {
        async fn apply(&self, _ctx: &Context, _config: &PluginConfig) -> Result<(), KernelError> {
            Ok(())
        }

        async fn stop(&self, _ctx: &Context) -> Result<(), KernelError> {
            Ok(())
        }
    }

    fn versions(items: &[&str]) -> Vec<Version> {
        items
            .iter()
            .map(|item| Version::parse(item).expect("测试版本应合法"))
            .collect()
    }

    fn record(
        version: &str,
        available: &[&str],
        dependencies: Vec<DependencySpec>,
        state: PluginState,
    ) -> PluginRecord {
        PluginRecord {
            version: Version::parse(version).expect("测试版本应合法"),
            available_versions: versions(available),
            dependencies,
            role: PluginRole::Service,
            parent: None,
            state,
            context: None,
            fork: None,
            last_error: None,
            last_failure: None,
            runner: Arc::new(NoopRunner),
            cancel_requested: false,
            crash_window: VecDeque::new(),
            crash_restart_generation: 0,
            auto_restart_suppressed: false,
            pending_disable_reply: None,
        }
    }

    fn request(id: &str, version: &str, dependencies: Vec<DependencySpec>) -> LoadRequest {
        LoadRequest {
            id: id.to_owned(),
            version: Version::parse(version).expect("测试版本应合法"),
            available_versions: versions(&[version]),
            dependencies,
            role: PluginRole::Service,
            parent: None,
            runner: Arc::new(NoopRunner),
        }
    }

    #[test]
    fn test_role_strings_round_trip() {
        // 角色标识字符串是 `plugin:loaded` 载荷字段（§6.3、ADR-005）。
        for (role, text) in [
            (PluginRole::BaseCard, "basecard"),
            (PluginRole::BoxLayout, "boxlayout"),
            (PluginRole::App, "app"),
            (PluginRole::Service, "service"),
        ] {
            assert_eq!(role.as_str(), text);
            assert_eq!(PluginRole::parse(text).ok(), Some(role));
        }
    }

    #[test]
    fn test_register_rejects_version_change_of_active_plugin() {
        // §6.6：运行中不得就地换版本，必须走停用 → 更新 → 启用流程。
        let mut manager = PluginManager::default();
        manager
            .register(request("chips.test.a", "1.0.0", Vec::new()))
            .expect("首次登记应成功");
        manager.set_state("chips.test.a", PluginState::Active);
        let error = manager
            .register(request("chips.test.a", "2.0.0", Vec::new()))
            .expect_err("Active 插件不得就地换版本");
        assert_eq!(error.code(), "KERNEL_INVALID_TRANSITION");
        match error {
            KernelError::InvalidTransition { from, to, .. } => {
                assert_eq!(from, PluginState::Active);
                assert_eq!(to, PluginState::Resolving);
            }
            other => panic!("应返回非法迁移错误：{other:?}"),
        }
        assert_eq!(
            manager
                .record("chips.test.a")
                .map(|r| r.version.to_string()),
            Some("1.0.0".to_owned()),
            "被拒绝的登记不得改写已登记版本"
        );
        // 更新必须走「停用 → 重新登记 → 启用」流程（§6.6）。
        manager.set_state("chips.test.a", PluginState::Installed);
        manager
            .register(request("chips.test.a", "2.0.0", Vec::new()))
            .expect("非 Active 状态允许更新登记");
        manager.set_state("chips.test.a", PluginState::Active);
        manager
            .register(request("chips.test.a", "2.0.0", Vec::new()))
            .expect("同版本重复登记为幂等");
        assert_eq!(
            manager
                .record("chips.test.a")
                .map(|r| r.version.to_string()),
            Some("2.0.0".to_owned())
        );
    }

    #[test]
    fn test_mark_rejects_illegal_transition() {
        // §6.2 迁移表：`Installed` 只能进入 `Resolving` 或 `Removed`。
        let mut manager = PluginManager::default();
        manager.records.insert(
            "chips.test.a".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Installed),
        );
        let error = manager
            .mark("chips.test.a", PluginState::Stopping)
            .expect_err("Installed 不得直接进入 Stopping");
        assert_eq!(error.code(), "KERNEL_INVALID_TRANSITION");
        assert_eq!(
            manager.state_of("chips.test.a"),
            Some(PluginState::Installed),
            "非法迁移不得改变状态"
        );
        let error = manager
            .mark("chips.test.missing", PluginState::Resolving)
            .expect_err("未知插件应报错");
        assert_eq!(error.code(), "KERNEL_PLUGIN_NOT_FOUND");
        manager
            .mark("chips.test.a", PluginState::Resolving)
            .expect("Installed → Resolving 合法");
        assert_eq!(
            manager.state_of("chips.test.a"),
            Some(PluginState::Resolving)
        );
    }

    #[test]
    fn test_graph_and_dependents_exclude_removed_plugins() {
        // §7.3：已移除插件既不入依赖图，也不再是任何插件的依赖者。
        let mut manager = PluginManager::default();
        manager.records.insert(
            "chips.test.b".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Active),
        );
        manager.records.insert(
            "chips.test.a".to_owned(),
            record(
                "1.0.0",
                &["1.0.0"],
                vec![spec("chips.test.b", "^1.0.0")],
                PluginState::Active,
            ),
        );
        manager.records.insert(
            "chips.test.gone".to_owned(),
            record(
                "1.0.0",
                &["1.0.0"],
                vec![spec("chips.test.b", "^1.0.0")],
                PluginState::Removed,
            ),
        );
        let graph = manager.graph();
        assert!(graph.get("chips.test.a").is_some(), "未移除节点应入图");
        assert!(graph.get("chips.test.b").is_some());
        assert!(
            graph.get("chips.test.gone").is_none(),
            "Removed 节点必须排除"
        );
        assert!(graph.get("chips.test.unknown").is_none());
        assert_eq!(
            graph
                .get("chips.test.a")
                .map(|node| node.dependencies.len())
                .unwrap_or_default(),
            1
        );
        assert_eq!(
            manager.dependents_of("chips.test.b"),
            vec!["chips.test.a".to_owned()],
            "已移除插件不得出现在依赖者列表中"
        );
        assert!(manager.dependents_of("chips.test.a").is_empty());
        assert_eq!(
            manager.transitive_dependents("chips.test.b"),
            ["chips.test.a".to_owned()]
                .into_iter()
                .collect::<BTreeSet<PluginId>>()
        );
        assert!(manager.transitive_dependents("chips.test.gone").is_empty());
        assert_eq!(
            manager.graph().dependencies_of("chips.test.unknown").len(),
            0,
            "未知节点的依赖声明为空"
        );
    }

    #[test]
    fn test_topological_order_falls_back_stably_on_cycle() {
        // 环在 `plan_load` / `resolve_order` 阶段即被拒绝；排序入口不得因此 panic。
        let mut manager = PluginManager::default();
        manager.records.insert(
            "chips.test.b".to_owned(),
            record(
                "1.0.0",
                &["1.0.0"],
                vec![spec("chips.test.a", "^1.0.0")],
                PluginState::Installed,
            ),
        );
        manager.records.insert(
            "chips.test.a".to_owned(),
            record(
                "1.0.0",
                &["1.0.0"],
                vec![spec("chips.test.b", "^1.0.0")],
                PluginState::Installed,
            ),
        );
        manager.records.insert(
            "chips.test.gone".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Removed),
        );
        let order = manager.topological_order();
        assert_eq!(
            order,
            vec!["chips.test.a".to_owned(), "chips.test.b".to_owned()]
        );
        assert_eq!(manager.dependents_of("chips.test.a").len(), 1);
        assert_eq!(
            manager.transitive_dependents("chips.test.a"),
            ["chips.test.a".to_owned(), "chips.test.b".to_owned()]
                .into_iter()
                .collect::<BTreeSet<PluginId>>(),
            "环上的闭包遍历必须收敛，不得死循环"
        );
        assert_eq!(
            manager.dependency_closure("chips.test.a").len(),
            2,
            "闭包应含自身与依赖且不死循环"
        );
        let order = manager.topological_order();
        assert_eq!(manager.rank("chips.test.b", &order), 1);
        assert_eq!(
            manager.rank("chips.test.unknown", &order),
            order.len(),
            "未知插件排在最后"
        );
    }

    #[test]
    fn test_plan_load_state_guards() {
        let mut manager = PluginManager::default();
        assert_eq!(
            plan_error(manager.plan_load("chips.test.none"), "未登记插件应报错").code(),
            "KERNEL_PLUGIN_NOT_FOUND"
        );
        manager.records.insert(
            "chips.test.removed".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Removed),
        );
        assert_eq!(
            plan_error(
                manager.plan_load("chips.test.removed"),
                "Removed 计划必须重新登记"
            )
            .code(),
            "KERNEL_PLUGIN_NOT_FOUND"
        );
        manager.records.insert(
            "chips.test.active".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Active),
        );
        assert!(matches!(
            manager.plan_load("chips.test.active"),
            Ok(LoadPlan::AlreadyActive)
        ));
        for state in [
            PluginState::Resolving,
            PluginState::Starting,
            PluginState::Stopping,
        ] {
            manager.records.insert(
                "chips.test.busy".to_owned(),
                record("1.0.0", &["1.0.0"], Vec::new(), state),
            );
            let error = plan_error(
                manager.plan_load("chips.test.busy"),
                "进行中的生命周期不得并发改写",
            );
            assert_eq!(error.code(), "KERNEL_INVALID_TRANSITION");
            match error {
                KernelError::InvalidTransition { from, to, .. } => {
                    assert_eq!(from, state);
                    assert_eq!(to, PluginState::Resolving);
                }
                other => panic!("应返回非法迁移错误：{other:?}"),
            }
        }
    }

    #[test]
    fn test_plan_load_distinguishes_blocked_and_rejected_for_closure_members() {
        // §7.4：依赖闭包内任一成员版本暂不满足 → Pending；互斥 → Failed。
        let mut manager = PluginManager::default();
        manager.records.insert(
            "chips.test.base".to_owned(),
            record(
                "2.0.0",
                &["1.0.0", "2.0.0"],
                Vec::new(),
                PluginState::Installed,
            ),
        );
        manager.records.insert(
            "chips.test.mid".to_owned(),
            record(
                "1.0.0",
                &["1.0.0"],
                vec![spec("chips.test.base", "^1.0.0")],
                PluginState::Installed,
            ),
        );
        manager.records.insert(
            "chips.test.top".to_owned(),
            record(
                "1.0.0",
                &["1.0.0"],
                vec![spec("chips.test.mid", "^1.0.0")],
                PluginState::Installed,
            ),
        );
        let error = blocked(
            manager.plan_load("chips.test.top"),
            "闭包成员版本暂不满足时应返回阻塞计划",
        );
        assert_eq!(error.code(), "KERNEL_DEPENDENCY_VERSION");
        assert_eq!(
            error_details(&error).and_then(|v| v["dependency"].as_str().map(str::to_owned)),
            Some("chips.test.base".to_owned()),
            "阻塞原因必须指向闭包内未就绪的依赖"
        );
        assert_eq!(
            error_details(&error).and_then(|v| v["candidates"].as_array().map(Vec::len)),
            Some(1),
            "暂不满足时存在可满足的候选版本"
        );

        // 候选集合无交集时升级为显式冲突。
        manager
            .records
            .get_mut("chips.test.base")
            .expect("记录存在")
            .available_versions = versions(&["2.0.0"]);
        let error = rejected(
            manager.plan_load("chips.test.top"),
            "版本互斥应返回拒绝计划",
        );
        assert_eq!(error.code(), "KERNEL_DEPENDENCY_VERSION");
        assert_eq!(
            error_details(&error).and_then(|v| v["candidates"].as_array().map(Vec::len)),
            Some(0),
            "互斥时候选集合为空"
        );
    }

    #[test]
    fn test_plan_load_blocks_when_member_is_in_flight() {
        let mut manager = PluginManager::default();
        manager.records.insert(
            "chips.test.base".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Pending),
        );
        manager.records.insert(
            "chips.test.top".to_owned(),
            record(
                "1.0.0",
                &["1.0.0"],
                vec![spec("chips.test.base", "^1.0.0")],
                PluginState::Installed,
            ),
        );
        manager.queued.insert("chips.test.base".to_owned());
        let error = blocked(manager.plan_load("chips.test.top"), "依赖在队列中时应阻塞");
        assert_eq!(error.code(), "KERNEL_DEPENDENCY_MISSING");
        assert_eq!(
            error_details(&error).and_then(|v| v["missing"].as_str().map(str::to_owned)),
            Some("chips.test.base".to_owned())
        );

        manager.queued.clear();
        manager.in_flight.insert("chips.test.base".to_owned());
        let error = blocked(
            manager.plan_load("chips.test.top"),
            "依赖在激活途中时应阻塞",
        );
        assert_eq!(error.code(), "KERNEL_DEPENDENCY_MISSING");
    }

    #[test]
    fn test_plan_load_self_dependency_is_single_node_cycle() {
        // §7.4：自依赖是长度 1 的环，直接判 Failed。
        let mut manager = PluginManager::default();
        manager.records.insert(
            "chips.test.self".to_owned(),
            record(
                "1.0.0",
                &["1.0.0"],
                vec![spec("chips.test.self", "^1.0.0")],
                PluginState::Installed,
            ),
        );
        let error = rejected(manager.plan_load("chips.test.self"), "自依赖应返回单节点环");
        match error {
            KernelError::DependencyCycle { path } => {
                assert_eq!(path, vec!["chips.test.self".to_owned()])
            }
            other => panic!("应返回环错误：{other:?}"),
        }
    }

    #[test]
    fn test_plan_load_rejects_duplicate_dependency_declaration() {
        // §7.4：同一依赖重复声明是显式冲突。
        let mut manager = PluginManager::default();
        manager.records.insert(
            "chips.test.base".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Active),
        );
        manager.records.insert(
            "chips.test.dup".to_owned(),
            record(
                "1.0.0",
                &["1.0.0"],
                vec![
                    spec("chips.test.base", "^1.0.0"),
                    spec("chips.test.base", ">=1.0.0"),
                ],
                PluginState::Installed,
            ),
        );
        let error = rejected(
            manager.plan_load("chips.test.dup"),
            "重复声明应返回拒绝计划",
        );
        assert_eq!(error.code(), "KERNEL_DEPENDENCY_DUPLICATE");
        match error {
            KernelError::DependencyDuplicate {
                dependent,
                dependency,
            } => {
                assert_eq!(dependent, "chips.test.dup");
                assert_eq!(dependency, "chips.test.base");
            }
            other => panic!("应返回重复声明错误：{other:?}"),
        }
    }

    /// 取错误型计划；计划不是 `Err` 时按固定文案失败。
    fn plan_error(plan: Result<LoadPlan, KernelError>, message: &str) -> KernelError {
        match plan {
            Err(error) => error,
            Ok(_) => panic!("{message}"),
        }
    }

    /// 取 `Blocked` 计划内的错误。
    fn blocked(plan: Result<LoadPlan, KernelError>, message: &str) -> KernelError {
        match plan.expect("计划生成不应报错") {
            LoadPlan::Blocked(error) => error,
            _ => panic!("{message}"),
        }
    }

    /// 取 `Rejected` 计划内的错误。
    fn rejected(plan: Result<LoadPlan, KernelError>, message: &str) -> KernelError {
        match plan.expect("计划生成不应报错") {
            LoadPlan::Rejected(error) => error,
            _ => panic!("{message}"),
        }
    }

    /// 取错误归一后的 `details`，用于断言 §9.2 归一表的字段。
    fn error_details(error: &KernelError) -> Option<serde_json::Value> {
        let normalized: chips_core::ChipsError = error.clone().into();
        normalized.details().cloned()
    }

    /// 相对当前时刻的时间戳；负偏移越界时按单调钟下限截断。
    fn timestamp_at(now: Instant, offset: Duration) -> Instant {
        now.checked_sub(offset).unwrap_or(now)
    }

    /// 把窗口填入 `count` 次窗口内尝试（时间戳均新于窗口）。
    fn fill_crash_window(record: &mut PluginRecord, now: Instant, count: u32) {
        for index in 0..count {
            let attempt = timestamp_at(now, Duration::from_millis(10 * u64::from(index) + 1));
            record.crash_window.push_back(attempt);
        }
    }

    #[test]
    fn test_crash_restart_backoff_doubles_and_caps() {
        // §6.8 退避序列：1s → 2s → 4s → 8s → 16s → 30s（单次封顶 BACKOFF_MAX）。
        let initial = crate::constants::CRASH_RESTART_BACKOFF_INITIAL;
        let max = crate::constants::CRASH_RESTART_BACKOFF_MAX;
        for (attempt, expected_secs) in [(1_u32, 1_u64), (2, 2), (3, 4), (4, 8), (5, 16)] {
            assert_eq!(
                crash_restart_backoff(attempt, initial, max),
                Duration::from_secs(expected_secs),
                "第 {attempt} 次尝试的退避应为 {expected_secs}s"
            );
        }
        // 翻倍触及封顶后不再增长。
        assert_eq!(crash_restart_backoff(6, initial, max), max);
        assert_eq!(crash_restart_backoff(7, initial, max), max);
        assert_eq!(crash_restart_backoff(64, initial, max), max);
        // 自定义策略面：首值与封顶由注入值决定（测试可缩短，禁真等）。
        assert_eq!(
            crash_restart_backoff(3, Duration::from_millis(20), Duration::from_millis(50)),
            Duration::from_millis(50)
        );
    }

    #[test]
    fn test_crash_window_counts_attempts_and_prunes_expired() {
        // §6.8 窗口计数边界：第 1/3 次仍在预算内，第 4 次超出上限即熔断。
        let policy = CrashRestartPolicy::default();
        assert_eq!(policy.window, crate::constants::CRASH_RESTART_WINDOW);
        assert_eq!(
            policy.max_attempts,
            crate::constants::CRASH_RESTART_MAX_ATTEMPTS
        );
        let now = Instant::now();
        let mut fresh = record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Failed);
        assert_eq!(fresh.crash_attempts_within(now, policy), 0);
        assert!(!fresh.crash_restart_exhausted(now, policy));

        assert_eq!(fresh.register_crash_attempt(now, policy), 1, "第 1 次");
        assert!(!fresh.crash_restart_exhausted(now, policy), "第 1 次未超限");
        assert_eq!(fresh.register_crash_attempt(now, policy), 2, "第 2 次");
        assert_eq!(fresh.register_crash_attempt(now, policy), 3, "第 3 次");
        assert!(
            !fresh.crash_restart_exhausted(now, policy),
            "第 3 次恰在上限内，仍可自动重启"
        );
        assert_eq!(fresh.register_crash_attempt(now, policy), 4, "第 4 次");
        assert!(
            fresh.crash_restart_exhausted(now, policy),
            "第 4 次超出上限，停止自动重启"
        );
        assert_eq!(fresh.crash_attempts_within(now, policy), 4);

        // 过期修剪：滑出窗口的尝试不再计入，也不触发熔断。
        // 窗口取短于默认值，避免测试依赖机器开机时长（禁真等长时间）。
        let short = CrashRestartPolicy {
            window: Duration::from_millis(200),
            ..CrashRestartPolicy::default()
        };
        let mut aged = record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Failed);
        for index in 0..4_u32 {
            let expired_at = timestamp_at(now, Duration::from_millis(201 + u64::from(index)));
            aged.crash_window.push_back(expired_at);
        }
        assert_eq!(
            aged.crash_attempts_within(now, short),
            0,
            "全部尝试已滑出窗口，计数归零"
        );
        assert!(!aged.crash_restart_exhausted(now, short));
        assert!(aged.crash_window.is_empty(), "熔断判定应顺带修剪过期尝试");
        // 混合窗口：过期 3 次 + 窗口内 1 次 → 计数 1。
        let mut mixed = record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Failed);
        for index in 0..3_u32 {
            mixed.crash_window.push_back(timestamp_at(
                now,
                Duration::from_millis(200 + u64::from(index)),
            ));
        }
        mixed
            .crash_window
            .push_back(timestamp_at(now, Duration::from_millis(1)));
        assert_eq!(mixed.crash_attempts_within(now, short), 1);
        assert!(!mixed.crash_restart_exhausted(now, short));
        // 登记新尝试时先修剪过期记录：4 次尝试中仅窗口内 1 次 + 本次。
        assert_eq!(mixed.register_crash_attempt(now, short), 2);
        assert_eq!(mixed.crash_window.len(), 2, "过期尝试应已出队");

        // 未来时间戳（注入时钟）按未过期处理，不得 panic。
        let mut future = record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Failed);
        future.crash_window.push_back(now + Duration::from_secs(60));
        assert_eq!(future.crash_attempts_within(now, policy), 1);
        assert_eq!(future.register_crash_attempt(now, policy), 2);
    }

    #[test]
    fn test_crash_window_lifecycle_hooks_and_reset() {
        // §6.8 计数生命周期：显式 enable 重置；停用（Installed）/卸载
        // （Removed）清零。
        let policy = CrashRestartPolicy::default();
        let now = Instant::now();
        let mut manager = PluginManager::default();

        manager.records.insert(
            "chips.test.reset".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Failed),
        );
        fill_crash_window(
            manager.record_mut("chips.test.reset").expect("记录应存在"),
            now,
            4,
        );
        manager
            .record_mut("chips.test.reset")
            .expect("记录应存在")
            .reset_crash_window();
        assert_eq!(
            manager
                .record("chips.test.reset")
                .map(|r| r.crash_attempts_within(now, policy))
                .unwrap_or_default(),
            0,
            "显式 enable 必须重置窗口计数"
        );

        // 停用收敛到 Installed 清零。
        manager.records.insert(
            "chips.test.disabled".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Active),
        );
        fill_crash_window(
            manager
                .record_mut("chips.test.disabled")
                .expect("记录应存在"),
            now,
            2,
        );
        manager.set_state("chips.test.disabled", PluginState::Installed);
        assert!(
            manager
                .record("chips.test.disabled")
                .expect("记录应存在")
                .crash_window
                .is_empty(),
            "进入 Installed（停用）必须清零计数"
        );

        // 卸载终态清零（经合法迁移 Failed → Removed）。
        manager.records.insert(
            "chips.test.unloaded".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Failed),
        );
        fill_crash_window(
            manager
                .record_mut("chips.test.unloaded")
                .expect("记录应存在"),
            now,
            3,
        );
        manager
            .mark("chips.test.unloaded", PluginState::Removed)
            .expect("Failed → Removed 合法");
        assert!(
            manager
                .record("chips.test.unloaded")
                .expect("记录应存在")
                .crash_window
                .is_empty(),
            "进入 Removed（卸载）必须清零计数"
        );

        // 中间态迁移不得清零：熔断预算跨激活轮次保留。
        manager.records.insert(
            "chips.test.kept".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Failed),
        );
        fill_crash_window(
            manager.record_mut("chips.test.kept").expect("记录应存在"),
            now,
            3,
        );
        manager
            .mark("chips.test.kept", PluginState::Resolving)
            .expect("Failed → Resolving 在册");
        assert_eq!(
            manager
                .record("chips.test.kept")
                .map(|r| r.crash_attempts_within(now, policy))
                .unwrap_or_default(),
            3,
            "在册重启迁移不得清空窗口计数"
        );
    }

    #[test]
    fn test_plan_load_crash_breaker_blocks_exhausted_restart() {
        // §6.8：窗口超限的 Failed 插件停止一切自动重启（含依赖驱动），
        // 超限的 `Failed → Resolving` 视同非法迁移；未超限照常放行。
        let now = Instant::now();
        let mut manager = PluginManager::default();
        manager.records.insert(
            "chips.test.a".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Failed),
        );

        // 未超限（3 次）：允许在册重启迁移。
        fill_crash_window(
            manager.record_mut("chips.test.a").expect("记录应存在"),
            now,
            3,
        );
        assert!(matches!(
            manager.plan_load("chips.test.a"),
            Ok(LoadPlan::Activate(ids)) if ids == vec!["chips.test.a".to_owned()]
        ));

        // 超限（4 次）：Err(INVALID_TRANSITION, Failed → Resolving)，停留 Failed。
        fill_crash_window(
            manager.record_mut("chips.test.a").expect("记录应存在"),
            now,
            1,
        );
        let error = plan_error(
            manager.plan_load("chips.test.a"),
            "超限插件不得再获得重启计划",
        );
        assert_eq!(error.code(), "KERNEL_INVALID_TRANSITION");
        match error {
            KernelError::InvalidTransition { from, to, .. } => {
                assert_eq!(from, PluginState::Failed);
                assert_eq!(to, PluginState::Resolving);
            }
            other => panic!("应返回非法迁移错误：{other:?}"),
        }

        // 依赖驱动路径同样受阻：B 已超限，A 依赖 B → A 停留 Pending。
        let mut manager = PluginManager::default();
        manager.records.insert(
            "chips.test.b".to_owned(),
            record("1.0.0", &["1.0.0"], Vec::new(), PluginState::Failed),
        );
        manager.records.insert(
            "chips.test.a".to_owned(),
            record(
                "1.0.0",
                &["1.0.0"],
                vec![spec("chips.test.b", "^1.0.0")],
                PluginState::Pending,
            ),
        );
        fill_crash_window(
            manager.record_mut("chips.test.b").expect("记录应存在"),
            now,
            3,
        );
        assert!(
            matches!(
                manager.plan_load("chips.test.a"),
                Ok(LoadPlan::Activate(ids))
                    if ids == vec!["chips.test.b".to_owned(), "chips.test.a".to_owned()]
            ),
            "依赖未超限时按拓扑序驱动重启"
        );
        fill_crash_window(
            manager.record_mut("chips.test.b").expect("记录应存在"),
            now,
            1,
        );
        let error = blocked(
            manager.plan_load("chips.test.a"),
            "依赖已超限时依赖方必须停留 Pending",
        );
        assert_eq!(error.code(), "KERNEL_DEPENDENCY_MISSING");
        assert_eq!(
            error_details(&error).and_then(|v| v["missing"].as_str().map(str::to_owned)),
            Some("chips.test.b".to_owned()),
            "阻塞原因必须指向超限的依赖方"
        );
        // 依赖方自身的 Failed 记录不被覆写（停留 Failed 等待显式 enable）。
        assert_eq!(manager.state_of("chips.test.b"), Some(PluginState::Failed));
    }
}
