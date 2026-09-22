//! Bridge 内核：注册表、会话表、准入与调用收口（《核心接口规范》§5）。
//!
//! 线程模型：全部可变状态由短临界区互斥锁串行写入；注册项与编译产物以
//! `Arc` 快照发布，调用期读路径一次加锁后无锁执行（《核心接口规范》§2.2
//! 规则 3：公开函数不得在持锁状态下 `await`）。执行器在独立任务中运行：
//! panic 被 `JoinError` 捕获并归一为 `BRIDGE_INTERNAL`，超时/取消以
//! `CancelToken` 协作传播并强止任务，迟到结果随任务丢弃。

use std::collections::{BTreeSet, HashMap, HashSet, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use chips_core::{
    emit_permission_decision, CancelToken, ChipsError, DecisionAction, DecisionDomain,
    DecisionObserver, PermissionDecision, PermissionDenyReason, PluginId, SessionId,
};
use tokio::sync::mpsc;

use crate::constants::{DEFAULT_TIMEOUT_MS, SESSION_IN_FLIGHT_LIMIT};
use crate::descriptor::{
    CapabilityContext, CapabilityInput, CapabilityOutput, CapabilityRegistration, Concurrency,
};
use crate::error_codes::{
    BRIDGE_CANCELLED, BRIDGE_CAPABILITY_NOT_FOUND, BRIDGE_INTERNAL, BRIDGE_QUEUE_OVERFLOW,
    BRIDGE_SESSION_BUSY, BRIDGE_SESSION_UNKNOWN, BRIDGE_TIMEOUT, KERNEL_INVALID_TRANSITION,
    PERMISSION_NOT_DECLARED, PERMISSION_UNKNOWN,
};
use crate::naming::{
    conflict, is_builtin_capability_id, is_permission_id_in_vocabulary, is_valid_capability_id,
};
use crate::permissions::denied_error;
use crate::schema::{self, CompiledSchema, SchemaCache};
use crate::BridgeRequest;

/// 提供方类别（《Bridge三层设计》§4.2 注册触发者）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderKind {
    /// 平台服务域：内置能力保留标识的持有方。
    PlatformService,
    /// 服务插件：经平台评审登记后注册能力。
    ServicePlugin,
}

/// 提供方登记：激活状态与 manifest 声明的权限集合。
#[derive(Debug, Clone)]
pub struct ProviderRegistration {
    /// 提供方标识：平台服务域 ID 或服务插件 ID（反向域名）。
    pub id: PluginId,
    /// 提供方类别。
    pub kind: ProviderKind,
    /// manifest 声明的权限 ID 集合（安装时提交的申请集合）。
    pub permissions: Vec<String>,
}

/// 能力生命周期状态（《能力契约规范》§10.1 状态机；对应 §4.3 编目
/// `ICapabilityDescriptor.state` 的 Rust 侧权威取值）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapabilityState {
    /// 能力可调用。
    Active,
    /// 蓝绿更新的旧代际：拒绝新调用；在途调用完成或按超时收口。
    Draining,
}

/// 注册表内的生效注册项：元数据 + 编译缓存的校验器。
///
/// 注册表以能力 ID 为键，条目内不再冗余存储 ID。
struct Registration {
    owner: String,
    timeout_ms: u64,
    concurrency: Concurrency,
    max_queue: usize,
    executor: Arc<dyn crate::CapabilityExecutor>,
    descriptor_permissions: Vec<String>,
    descriptor_schema: serde_json::Value,
    compiled: Arc<CompiledSchema>,
    /// 蓝绿 draining 标记：置位后新调用按 `BRIDGE_CAPABILITY_NOT_FOUND`
    /// 拒绝，在途调用完成或按超时收口（《能力契约规范》§4.4、§10.1）。
    draining: AtomicBool,
}

/// 会话快照（《Bridge三层设计》§7.4 的 Rust 侧权威实例）。
struct SessionEntry {
    plugin_id: PluginId,
    granted: BTreeSet<String>,
    /// 会话在各能力上的在途调用计数。
    cap_counts: HashMap<String, usize>,
}

/// 提供方内部记录。
struct ProviderEntry {
    kind: ProviderKind,
    permissions: BTreeSet<String>,
}

/// 串行调度状态：槽位持有者序号 + FIFO 等待队列。
///
/// `holder` 精确钉住「当前哪一个在途调用持有槽位」（《核心接口规范》§5.1：
/// `Serial` 为「同一能力 ID 全局串行」）：仅持有者自身释放才发生移交或置空；
/// 排队者提前收口（超时/取消/弃权）只移除自己的排队项，不得清掉在执持有者
/// 的槽位状态——否则持有者仍在前台执行时新调用即可插队并发执行。
#[derive(Default)]
struct SerialState {
    holder: Option<u64>,
    waiters: VecDeque<(u64, mpsc::UnboundedSender<()>)>,
}

/// 一次在途调用的登记。
struct InvocationEntry {
    session: SessionId,
    capability_id: String,
    request_id: String,
    trace_id: String,
    owner: String,
    plugin_id: PluginId,
    cancel: CancelToken,
    deadline: Instant,
    /// 是否占用串行槽位（等待中或执行中）。
    holds_serial: bool,
    abort: Option<tokio::task::AbortHandle>,
}

struct CoreState {
    shutdown: bool,
    next_seq: u64,
    providers: HashMap<String, ProviderEntry>,
    /// 第三方能力 ID 登记绑定：ID → 提供方（不可转让、不可改绑）。
    id_ledger: HashMap<String, String>,
    /// 原 owner 绑定：ID → 首次成功注册的提供方。注销后同一 ID 只能由原
    /// owner 重新注册（《能力契约规范》§4.4「其他提供方不得抢占」），绑定
    /// 不可转让、不可继承，不随注销移除。内置 ID 无登记台账，同样适用。
    owner_bindings: HashMap<String, String>,
    capabilities: HashMap<String, Arc<Registration>>,
    sessions: HashMap<SessionId, SessionEntry>,
    serial: HashMap<String, SerialState>,
    invocations: HashMap<u64, InvocationEntry>,
    session_invocations: HashMap<SessionId, HashSet<u64>>,
    cap_invocations: HashMap<String, HashSet<u64>>,
    schema_cache: SchemaCache,
}

impl CoreState {
    fn new() -> Self {
        Self {
            shutdown: false,
            next_seq: 1,
            providers: HashMap::new(),
            id_ledger: HashMap::new(),
            owner_bindings: HashMap::new(),
            capabilities: HashMap::new(),
            sessions: HashMap::new(),
            serial: HashMap::new(),
            invocations: HashMap::new(),
            session_invocations: HashMap::new(),
            cap_invocations: HashMap::new(),
            schema_cache: SchemaCache::new(),
        }
    }
}

/// 取内核锁。绑定层约定临界区内不调用宿主代码、不 `await`；即便锁被
/// 中毒也以恢复内部数据为准（《Rust编码规范》§十六：生产路径零 panic）。
fn lock_core(inner: &Arc<Mutex<CoreState>>) -> MutexGuard<'_, CoreState> {
    inner.lock().unwrap_or_else(PoisonError::into_inner)
}

/// 在途调用登记的清理守卫：任何退出路径（返回、超时、取消、panic、调用方
/// 弃权 drop）都释放会话计数、串行槽位与登记项。
struct InvocationGuard {
    inner: Arc<Mutex<CoreState>>,
    seq: u64,
}

impl Drop for InvocationGuard {
    fn drop(&mut self) {
        let mut state = lock_core(&self.inner);
        release_invocation(&mut state, self.seq);
    }
}

/// 释放一次调用的全部占用；幂等（条目不存在时为空操作）。
fn release_invocation(state: &mut CoreState, seq: u64) {
    let Some(entry) = state.invocations.remove(&seq) else {
        return;
    };
    if let Some(ids) = state.session_invocations.get_mut(&entry.session) {
        ids.remove(&seq);
        if ids.is_empty() {
            state.session_invocations.remove(&entry.session);
        }
    }
    if let Some(counts) = state.sessions.get_mut(&entry.session) {
        if let Some(count) = counts.cap_counts.get_mut(&entry.capability_id) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                counts.cap_counts.remove(&entry.capability_id);
            }
        }
    }
    if let Some(ids) = state.cap_invocations.get_mut(&entry.capability_id) {
        ids.remove(&seq);
        if ids.is_empty() {
            state.cap_invocations.remove(&entry.capability_id);
            // draining 收口：在途清零后旧代际注册项自动进入「已注销」
            // （《能力契约规范》§10.1 状态机：draining →在途收口→ 已注销）。
            if state
                .capabilities
                .get(&entry.capability_id)
                .is_some_and(|registration| registration.draining.load(Ordering::Acquire))
            {
                state.capabilities.remove(&entry.capability_id);
                state.serial.remove(&entry.capability_id);
            }
        }
    }
    if entry.holds_serial {
        if let Some(serial) = state.serial.get_mut(&entry.capability_id) {
            // 先清除本序号的等待槽（若仍在排队）；排队者收口到此为止，
            // 槽位状态属于持有者，不随排队者释放而变化。
            serial.waiters.retain(|(other, _)| *other != seq);
            // 仅持有者离位才把槽位移交队列中的下一个存活等待者；
            // 队列清空后置为空闲。
            if serial.holder == Some(seq) {
                while let Some((next, sender)) = serial.waiters.pop_front() {
                    if sender.is_closed() {
                        continue;
                    }
                    if sender.send(()).is_ok() {
                        serial.holder = Some(next);
                        return;
                    }
                }
                serial.holder = None;
            }
        }
    }
}

fn cancelled_error() -> ChipsError {
    ChipsError::new(BRIDGE_CANCELLED, "调用已取消")
}

fn session_unknown_error() -> ChipsError {
    ChipsError::new(
        BRIDGE_SESSION_UNKNOWN,
        "来源会话无法解析或已关闭，调用被拒绝",
    )
}

fn timeout_error() -> ChipsError {
    ChipsError::new(BRIDGE_TIMEOUT, "能力调用超时").with_retryable(true)
}

fn capability_not_found_error(capability_id: &str) -> ChipsError {
    ChipsError::new(
        BRIDGE_CAPABILITY_NOT_FOUND,
        format!("能力未注册：{capability_id}"),
    )
    .with_details(serde_json::json!({ "capabilityId": capability_id }))
}

/// 原 owner 抢占拒绝的统一 reason（《能力契约规范》§4.4、§9.3）。
const OWNER_BINDING_CONFLICT_REASON: &str = "同一 ID 只能由原 owner 重新注册，其他提供方不得抢占";

/// 生成平台追踪 ID：单调序号 + 进程启动纪元时间，十六进制编码。
///
/// 与事件、权限审计共用同一 ID 空间约定（《核心接口规范》§5.2
/// `InvocationContext.trace_id`）；跨进程关联由适配层负责。
fn generate_trace_id(counter: &AtomicU64) -> String {
    let sequence = counter.fetch_add(1, Ordering::Relaxed);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos() as u64)
        .unwrap_or(0);
    format!("{nanos:016x}{sequence:08x}")
}

/// 登记会话并执行调用的凭据：准入成功后由 [`Bridge::admit`] 构造。
struct Admitted {
    /// 在途登记清理守卫：不被显式读取，随 `Admitted` 落弃时释放占用。
    _guard: InvocationGuard,
    seq: u64,
    registration: Arc<Registration>,
    input: CapabilityInput,
    cancel: CancelToken,
    deadline: Instant,
    permit_rx: Option<mpsc::UnboundedReceiver<()>>,
}

/// Bridge 内核：能力注册表与调用收口的唯一权威实例。
///
/// 语义见《核心接口规范》§5：注册期一次性完成 ID、schema、权限与 owner
/// 校验；调用期依次执行会话校验、注册表命中、权限判定、Schema 校验与
/// 并发准入，随后执行能力并按超时/取消收口。`Bridge` 为 `Clone` 句柄，
/// 克隆共享同一内部状态。
#[derive(Clone)]
pub struct Bridge {
    inner: Arc<Mutex<CoreState>>,
    trace_counter: Arc<AtomicU64>,
    /// 权限判定出站观察面：构造期注入、终身不可换（RFC §八条 1）；与
    /// `trace_counter` 同层的兄弟字段，`Clone` 句柄天然共享同一实例，
    /// **不入 `CoreState`**（避免与判定锁纠缠，RFC §六条 4）。
    observer: Arc<dyn DecisionObserver>,
}

impl std::fmt::Debug for Bridge {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let state = lock_core(&self.inner);
        formatter
            .debug_struct("Bridge")
            .field("shutdown", &state.shutdown)
            .field("capabilities", &state.capabilities.len())
            .field("sessions", &state.sessions.len())
            .field("invocations", &state.invocations.len())
            .finish()
    }
}

impl Bridge {
    /// 创建空的 Bridge 内核实例。
    ///
    /// `observer` 为权限判定出站观察面（`chips_core::DecisionObserver`，
    /// RFC-权限审计跨层采集sink裁定 §5.1/§八）：构造期注入、终身不可换，
    /// 审计观察面不存在无观察窗口（v1 无默认无观察形态，`Default` 实现
    /// 随本波收口移除）。测试与接线波落地前显式注入
    /// `chips_core::NoopDecisionObserver`。
    #[must_use]
    pub fn new(observer: Arc<dyn DecisionObserver>) -> Self {
        Self {
            inner: Arc::new(Mutex::new(CoreState::new())),
            trace_counter: Arc::new(AtomicU64::new(1)),
            observer,
        }
    }

    /// 登记并激活提供方：激活后其能力方可注册；`permissions` 为 manifest
    /// 声明的申请集合。
    ///
    /// 失败：权限声明引用未注册权限 ID → `PERMISSION_UNKNOWN`；重复激活
    /// 同 ID → 以最新声明覆盖（授权变更重建，《08-权限系统设计》§7.6）。
    pub fn activate_provider(&self, registration: ProviderRegistration) -> Result<(), ChipsError> {
        let mut declared = BTreeSet::new();
        for permission in &registration.permissions {
            if !is_permission_id_in_vocabulary(permission) {
                return Err(ChipsError::new(
                    PERMISSION_UNKNOWN,
                    format!("权限 ID 未注册：{permission}"),
                )
                .with_details(serde_json::json!({ "permission": permission })));
            }
            declared.insert(permission.clone());
        }
        let mut state = lock_core(&self.inner);
        if state.shutdown {
            return Err(cancelled_error());
        }
        state.providers.insert(
            registration.id.clone(),
            ProviderEntry {
                kind: registration.kind,
                permissions: declared,
            },
        );
        Ok(())
    }

    /// 停用提供方：注销其全部能力并在途调用按取消收口；幂等。
    ///
    /// 对应《Bridge三层设计》§4.2：服务插件 `stop` 前、平台退出时。
    pub fn deactivate_provider(&self, owner: &str) {
        let mut state = lock_core(&self.inner);
        state.providers.remove(owner);
        let owned: Vec<String> = state
            .capabilities
            .iter()
            .filter(|(_, registration)| registration.owner == owner)
            .map(|(id, _)| id.clone())
            .collect();
        for id in owned {
            cancel_capability(&mut state, &id);
            state.capabilities.remove(&id);
            state.serial.remove(&id);
        }
    }

    /// 登记第三方能力 ID 并绑定提供方（登记前置，《能力契约规范》§9.1）。
    ///
    /// 由平台评审流程经适配层调用；绑定不可转让、不可改绑。
    /// 失败：文法非法、内置保留 ID、改绑他人 → `BRIDGE_CAPABILITY_CONFLICT`；
    /// 提供方未激活 → `KERNEL_INVALID_TRANSITION`。
    pub fn grant_capability_id(&self, capability_id: &str, owner: &str) -> Result<(), ChipsError> {
        if !is_valid_capability_id(capability_id) {
            return Err(conflict("ID 文法非法", capability_id));
        }
        if is_builtin_capability_id(capability_id) {
            return Err(conflict("内置保留 ID 由平台服务域持有", capability_id));
        }
        let mut state = lock_core(&self.inner);
        if state.shutdown {
            return Err(cancelled_error());
        }
        if !state.providers.contains_key(owner) {
            return Err(ChipsError::new(
                KERNEL_INVALID_TRANSITION,
                format!("能力提供方尚未激活：{owner}"),
            ));
        }
        if let Some(bound) = state.id_ledger.get(capability_id) {
            if bound == owner {
                return Ok(());
            }
            return Err(conflict("登记提供方与 owner 不一致", capability_id));
        }
        state
            .id_ledger
            .insert(capability_id.to_owned(), owner.to_owned());
        Ok(())
    }

    /// 注册能力；失败时提供方启用失败（《核心接口规范》§5.1）。
    ///
    /// 注册校验一次性完成：ID 文法与登记绑定、schema 离线编译、权限词表与
    /// manifest 声明、owner 激活状态；同 owner 同定义的重复注册幂等。
    /// ID 已被占用或已注销时，只有原 owner 可以注册（《能力契约规范》§4.4
    /// 「同一 ID 只能由原 owner 重新注册」）；原 owner 在蓝绿代际切换中的
    /// 定义覆盖请使用 [`Bridge::takeover_register`]。
    pub fn register(&self, registration: CapabilityRegistration) -> Result<(), ChipsError> {
        self.register_with(registration, false)
    }

    /// 蓝绿更新的代际接管注册（《能力契约规范》§4.4 触发表「蓝绿更新代际
    /// 切换」、§9.3「蓝绿更新的代际接管」、《03-插件架构设计》§6.2 原子切换点）。
    ///
    /// 注册校验与首次注册完全一致（§4.4「重注册校验与首次注册一致」）；差异
    /// 仅在于允许同一原 owner 对已占用 ID 做定义覆盖——这是 §9.3 登记的
    /// 「唯一允许的同 ID 覆盖」。接管成功后注册表立即指向新代际（新代际
    /// 接管）；旧代际进入 draining：其已准入的在途调用持旧注册项快照完成或
    /// 按超时收口（§10.1、§4.4），新调用一律由新代际处理（《03-插件架构
    /// 设计》§6.3「一次调用要么由旧版本处理，要么由新版本处理」）。
    /// 跨 owner 接管按 `BRIDGE_CAPABILITY_CONFLICT` 拒绝。
    pub fn takeover_register(
        &self,
        registration: CapabilityRegistration,
    ) -> Result<(), ChipsError> {
        self.register_with(registration, true)
    }

    /// 注册主体实现；`takeover` 为蓝绿接管模式（允许同 owner 的定义覆盖）。
    fn register_with(
        &self,
        registration: CapabilityRegistration,
        takeover: bool,
    ) -> Result<(), ChipsError> {
        precheck_registration(&registration)?;
        let capability_id = registration.descriptor.id.clone();

        let mut state = lock_core(&self.inner);
        if state.shutdown {
            return Err(cancelled_error());
        }
        check_registration_bindings(&state, &registration)?;
        if let Some(existing) = state.capabilities.get(&capability_id) {
            let same_definition = existing.owner == registration.owner
                && existing.timeout_ms == registration.timeout_ms
                && existing.concurrency == registration.concurrency
                && existing.max_queue == registration.max_queue
                && existing.descriptor_permissions == registration.descriptor.permissions
                && existing.descriptor_schema == registration.descriptor.schema;
            if same_definition {
                // 同定义幂等：采纳新的执行器句柄与编译产物；draining 标记随
                // 注册项延续（普通注册不得唤醒 draining 槽位，§10.1），接管
                // 模式则安装为新代际（新代际接管，§9.3）。
                let replaced = Arc::new(Registration {
                    owner: registration.owner,
                    timeout_ms: registration.timeout_ms,
                    concurrency: registration.concurrency,
                    max_queue: registration.max_queue,
                    executor: registration.executor,
                    descriptor_permissions: registration.descriptor.permissions,
                    descriptor_schema: registration.descriptor.schema,
                    compiled: Arc::clone(&existing.compiled),
                    draining: AtomicBool::new(
                        existing.draining.load(Ordering::Acquire) && !takeover,
                    ),
                });
                state.capabilities.insert(capability_id, replaced);
                return Ok(());
            }
            // 定义不一致：蓝绿接管之外一律拒绝（§9.3 同代际重复注册口径）。
            if !takeover {
                return Err(conflict("重复注册定义不一致", &capability_id));
            }
            // 跨 owner 的抢占已被绑定校验拒绝；此处必为原 owner 接管。
        }
        let key = schema::digest(&registration.descriptor.schema);
        let cached = state.schema_cache.get(&key);
        drop(state);

        // schema 编译在锁外进行（纯 CPU、可离线）；编译结果回填共享 LRU 缓存。
        let compiled = match cached {
            Some(compiled) => compiled,
            None => {
                let compiled = schema::compile(&registration.descriptor.schema)?;
                let mut state = lock_core(&self.inner);
                state.schema_cache.put(key, Arc::clone(&compiled));
                compiled
            }
        };

        let mut state = lock_core(&self.inner);
        if state.shutdown {
            return Err(cancelled_error());
        }
        if let Some(existing) = state.capabilities.get(&capability_id) {
            if !takeover {
                return Err(conflict("注册竞态下 ID 已被占用", &capability_id));
            }
            if existing.owner != registration.owner {
                return Err(conflict(OWNER_BINDING_CONFLICT_REASON, &capability_id));
            }
        }
        state
            .owner_bindings
            .insert(capability_id.clone(), registration.owner.clone());
        state.capabilities.insert(
            capability_id.clone(),
            Arc::new(Registration {
                owner: registration.owner,
                timeout_ms: registration.timeout_ms,
                concurrency: registration.concurrency,
                max_queue: registration.max_queue,
                executor: registration.executor,
                descriptor_permissions: registration.descriptor.permissions,
                descriptor_schema: registration.descriptor.schema,
                compiled,
                draining: AtomicBool::new(false),
            }),
        );
        Ok(())
    }

    /// 注销能力；在途调用按超时/取消收口（《核心接口规范》§5.1）。
    ///
    /// 注销是幂等操作：对未注册或已注销 ID 重复注销为 no-op，不产生错误
    /// （《能力契约规范》§4.4）。注销后停止接受新调用（
    /// `BRIDGE_CAPABILITY_NOT_FOUND`）；其 ID 只能由原 owner 重新注册，
    /// 登记绑定与原 owner 绑定不随注销移除（§4.4「其他提供方不得抢占」）。
    /// 蓝绿代际切换的有序收尾路径见 [`Bridge::begin_draining`] 与
    /// [`Bridge::takeover_register`]。
    pub fn unregister(&self, capability_id: &str) -> Result<(), ChipsError> {
        let mut state = lock_core(&self.inner);
        if state.capabilities.remove(capability_id).is_none() {
            return Ok(());
        }
        cancel_capability(&mut state, capability_id);
        state.serial.remove(capability_id);
        Ok(())
    }

    /// 使能力进入蓝绿更新的 `draining` 状态（《能力契约规范》§4.4 触发表
    /// 「蓝绿更新代际切换」、§10.1 状态机）。
    ///
    /// 语义：新调用一律按 `BRIDGE_CAPABILITY_NOT_FOUND` 拒绝（§11.2
    /// 「draining 后的新调用」）；在途调用不强杀，完成或按超时收口（§10.1
    /// 「拒绝新调用；在途调用完成或按超时收口」）；在途清零后注册项自动进入
    /// 「已注销」。幂等：对未注册或已注销 ID、对已处于 draining 的 ID 均为
    /// no-op，不产生错误。新代际随后可经 [`Bridge::takeover_register`]
    /// 接管同一 ID。
    pub fn begin_draining(&self, capability_id: &str) -> Result<(), ChipsError> {
        let mut state = lock_core(&self.inner);
        if state.shutdown {
            return Err(cancelled_error());
        }
        let Some(registration) = state.capabilities.get(capability_id) else {
            return Ok(());
        };
        if registration.draining.swap(true, Ordering::AcqRel) {
            return Ok(());
        }
        // 无在途调用时立即完成收口：draining → 已注销（§10.1 状态机）。
        if !state.cap_invocations.contains_key(capability_id) {
            state.capabilities.remove(capability_id);
            state.serial.remove(capability_id);
        }
        Ok(())
    }

    /// 登记会话快照：授权变更后重新调用即按新快照重建（《08-权限系统设计》§7.6）。
    pub fn open_session(
        &self,
        session: SessionId,
        plugin_id: PluginId,
        granted_permissions: Vec<String>,
    ) -> Result<(), ChipsError> {
        let mut state = lock_core(&self.inner);
        if state.shutdown {
            return Err(cancelled_error());
        }
        let granted: BTreeSet<String> = granted_permissions.into_iter().collect();
        state.sessions.insert(
            session,
            SessionEntry {
                plugin_id,
                granted,
                cap_counts: HashMap::new(),
            },
        );
        Ok(())
    }

    /// 关闭会话：拒绝新调用并取消该会话全部在途调用；幂等。
    pub fn close_session(&self, session: SessionId) {
        let mut state = lock_core(&self.inner);
        close_session_locked(&mut state, session);
    }

    /// 取消会话全部在途调用；幂等；会话保持可用（《核心接口规范》§5.2）。
    pub fn cancel_session(&self, session: SessionId) {
        let mut state = lock_core(&self.inner);
        if let Some(ids) = state.session_invocations.remove(&session) {
            cancel_sequences(&mut state, &ids);
        }
    }

    /// 关闭 Bridge：取消全部在途调用并拒绝新请求；幂等。
    ///
    /// 对应《Bridge三层设计》§8.2 取消来源之「Bridge 关闭」（平台退出）。
    pub fn shutdown(&self) {
        let mut state = lock_core(&self.inner);
        if state.shutdown {
            return;
        }
        state.shutdown = true;
        let ids: HashSet<u64> = state.invocations.keys().copied().collect();
        cancel_sequences(&mut state, &ids);
    }

    /// 是否已关闭。
    #[must_use]
    pub fn is_shutdown(&self) -> bool {
        lock_core(&self.inner).shutdown
    }

    /// 读取在途调用的完整上下文（供适配层审计与事件追踪）；不在途时返回 `None`。
    #[must_use]
    pub fn invocation_context(
        &self,
        session: SessionId,
        request_id: &str,
    ) -> Option<crate::InvocationContext> {
        let state = lock_core(&self.inner);
        let entry = state
            .invocations
            .values()
            .find(|entry| entry.session == session && entry.request_id == request_id)?;
        Some(crate::InvocationContext {
            request_id: entry.request_id.clone(),
            capability_id: entry.capability_id.clone(),
            owner: entry.owner.clone(),
            session: entry.session,
            plugin_id: entry.plugin_id.clone(),
            trace_id: entry.trace_id.clone(),
            cancel: entry.cancel.clone(),
            deadline: entry.deadline,
        })
    }

    /// 注册表只读快照：能力是否已注册（供适配层诊断，不暴露枚举面）。
    ///
    /// 处于 `draining` 且尚未收口的注册项仍在册，返回 `true`；在途收口完成
    /// 后返回 `false`（《能力契约规范》§10.1）。
    #[must_use]
    pub fn has_capability(&self, capability_id: &str) -> bool {
        lock_core(&self.inner)
            .capabilities
            .contains_key(capability_id)
    }

    /// 能力生命周期状态只读查询（《能力契约规范》§4.3 编目
    /// `ICapabilityDescriptor.state`、§10.1 状态机）；未注册时返回 `None`。
    #[must_use]
    pub fn capability_state(&self, capability_id: &str) -> Option<CapabilityState> {
        let state = lock_core(&self.inner);
        let registration = state.capabilities.get(capability_id)?;
        Some(if registration.draining.load(Ordering::Acquire) {
            CapabilityState::Draining
        } else {
            CapabilityState::Active
        })
    }

    /// 完成会话校验、注册表命中、权限判定、Schema 校验与并发准入后执行能力。
    ///
    /// 阶段与失败码见《核心接口规范》§5.2 表；超时触发 `cancel` 并丢弃迟到
    /// 结果；取消来源（会话销毁、能力注销、Bridge 关闭）返回
    /// `BRIDGE_CANCELLED`；执行器 panic 归一为 `BRIDGE_INTERNAL`；执行器返回
    /// 的业务错误码原样透传。
    pub async fn request(&self, request: BridgeRequest) -> Result<CapabilityOutput, ChipsError> {
        let timeout_ms = self
            .registration_timeout_ms(&request.capability_id)
            .unwrap_or(DEFAULT_TIMEOUT_MS);
        let deadline = Instant::now() + Duration::from_millis(timeout_ms);
        let admitted = self.admit(&request, deadline)?;
        self.execute_admitted(admitted).await
    }

    fn registration_timeout_ms(&self, capability_id: &str) -> Option<u64> {
        let state = lock_core(&self.inner);
        state
            .capabilities
            .get(capability_id)
            .map(|entry| entry.timeout_ms)
    }

    /// 准入阶段：会话校验 → 注册表命中 → 权限判定 → Schema 校验 → 并发准入。
    fn admit(&self, request: &BridgeRequest, deadline: Instant) -> Result<Admitted, ChipsError> {
        let trace_id = generate_trace_id(&self.trace_counter);
        // 第一段锁：会话校验与注册表命中。
        let (registration, plugin_id, granted) = {
            let state = lock_core(&self.inner);
            if state.shutdown {
                return Err(cancelled_error());
            }
            let session = state
                .sessions
                .get(&request.session)
                .ok_or_else(session_unknown_error)?;
            let registration = Arc::clone(
                state
                    .capabilities
                    .get(&request.capability_id)
                    .ok_or_else(|| capability_not_found_error(&request.capability_id))?,
            );
            if registration.draining.load(Ordering::Acquire) {
                // draining 后的新调用按未找到拒绝（《能力契约规范》§10.1、§11.2）。
                return Err(capability_not_found_error(&request.capability_id));
            }
            (
                registration,
                session.plugin_id.clone(),
                session.granted.clone(),
            )
        };

        // 权限判定（集合匹配为常数开销；锁外完成）。
        let missing: Vec<String> = registration
            .descriptor_permissions
            .iter()
            .filter(|permission| !crate::permissions::matches_permission(permission, &granted))
            .cloned()
            .collect();
        if !missing.is_empty() {
            // deny 素材：`return Err` 前发出，两处发射均不持 `CoreState`
            // 锁（RFC §六条 4）；`permission` = 首个缺失项，与
            // `denied_error` 短路口径同值（RFC §5.1）；bridge 域无直通臂，
            // 一切判定 allow/deny 皆发（RFC §九 9.3-3）。
            emit_permission_decision(
                &*self.observer,
                &PermissionDecision {
                    domain: DecisionDomain::Capability,
                    action: DecisionAction::Deny,
                    plugin_id: plugin_id.clone(),
                    session_id: request.session,
                    permission: missing[0].clone(),
                    required: registration.descriptor_permissions.clone(),
                    missing,
                    reason: Some(PermissionDenyReason::NotGranted),
                    capability_id: Some(request.capability_id.clone()),
                    resource_uri: None,
                    target: None,
                    request_id: Some(request.request_id.clone()),
                    trace_id: Some(trace_id.clone()),
                    qualifier: None,
                },
            );
            return Err(denied_error(
                &request.capability_id,
                &registration.descriptor_permissions,
                &granted,
            ));
        }
        // allow 素材：判定收敛处发出（required 判空后、Schema 校验前、并发
        // 准入第二段锁之前——判定事实与后续准入结果解耦，RFC §六条 4）；
        // `permission` = required 声明序首项（RFC §5.4 条 2），missing 恒空。
        emit_permission_decision(
            &*self.observer,
            &PermissionDecision {
                domain: DecisionDomain::Capability,
                action: DecisionAction::Allow,
                plugin_id: plugin_id.clone(),
                session_id: request.session,
                permission: registration
                    .descriptor_permissions
                    .first()
                    .cloned()
                    .unwrap_or_default(),
                required: registration.descriptor_permissions.clone(),
                missing: Vec::new(),
                reason: None,
                capability_id: Some(request.capability_id.clone()),
                resource_uri: None,
                target: None,
                request_id: Some(request.request_id.clone()),
                trace_id: Some(trace_id.clone()),
                qualifier: None,
            },
        );

        // 锁外：Schema 与二进制信封校验（纯 CPU）。
        schema::validate_input(
            &registration.compiled,
            &request.capability_id,
            &request.input.json,
            &request.input.bin,
        )?;

        // 第二段锁：并发准入与在途登记。
        self.admit_concurrency(request, registration, plugin_id, deadline, trace_id)
    }

    fn admit_concurrency(
        &self,
        request: &BridgeRequest,
        registration: Arc<Registration>,
        plugin_id: PluginId,
        deadline: Instant,
        trace_id: String,
    ) -> Result<Admitted, ChipsError> {
        let mut state = lock_core(&self.inner);
        if state.shutdown {
            return Err(cancelled_error());
        }
        if !state
            .capabilities
            .get(&request.capability_id)
            .is_some_and(|entry| !entry.draining.load(Ordering::Acquire))
        {
            // 两段锁之间进入 draining 或已收口摘除：同样按未找到拒绝（§11.2）。
            return Err(capability_not_found_error(&request.capability_id));
        }
        if !state.sessions.contains_key(&request.session) {
            return Err(session_unknown_error());
        }
        let in_flight = state
            .sessions
            .get(&request.session)
            .and_then(|session| session.cap_counts.get(&request.capability_id))
            .copied()
            .unwrap_or(0);
        if in_flight >= SESSION_IN_FLIGHT_LIMIT {
            return Err(ChipsError::new(
                BRIDGE_SESSION_BUSY,
                format!("会话对能力 {} 的在途调用已达上限", request.capability_id),
            )
            .with_retryable(true));
        }

        let seq = state.next_seq;
        state.next_seq = seq.wrapping_add(1);
        let mut holds_serial = false;
        let mut permit_rx: Option<mpsc::UnboundedReceiver<()>> = None;
        if registration.concurrency == Concurrency::Serial {
            holds_serial = true;
            let serial = state
                .serial
                .entry(request.capability_id.clone())
                .or_default();
            if serial.holder.is_some() {
                if serial.waiters.len() >= registration.max_queue {
                    return Err(ChipsError::new(
                        BRIDGE_QUEUE_OVERFLOW,
                        format!("能力 {} 的串行队列已满", request.capability_id),
                    )
                    .with_retryable(true));
                }
                let (sender, receiver) = mpsc::unbounded_channel();
                serial.waiters.push_back((seq, sender));
                permit_rx = Some(receiver);
            } else {
                serial.holder = Some(seq);
            }
        }

        let cancel = CancelToken::new();
        if let Some(session) = state.sessions.get_mut(&request.session) {
            *session
                .cap_counts
                .entry(request.capability_id.clone())
                .or_insert(0) += 1;
        }
        state.invocations.insert(
            seq,
            InvocationEntry {
                session: request.session,
                capability_id: request.capability_id.clone(),
                request_id: request.request_id.clone(),
                trace_id,
                owner: registration.owner.clone(),
                plugin_id,
                cancel: cancel.clone(),
                deadline,
                holds_serial,
                abort: None,
            },
        );
        state
            .session_invocations
            .entry(request.session)
            .or_default()
            .insert(seq);
        state
            .cap_invocations
            .entry(request.capability_id.clone())
            .or_default()
            .insert(seq);
        drop(state);

        Ok(Admitted {
            _guard: InvocationGuard {
                inner: Arc::clone(&self.inner),
                seq,
            },
            seq,
            registration,
            input: request.input.clone(),
            cancel,
            deadline,
            permit_rx,
        })
    }

    /// 执行阶段：串行等待 → 执行器调用 → 超时/取消收口。
    async fn execute_admitted(
        &self,
        mut admitted: Admitted,
    ) -> Result<CapabilityOutput, ChipsError> {
        // 串行准入：按 FIFO 等待槽位移交；取消与超时在等待期同样生效。
        if let Some(receiver) = admitted.permit_rx.as_mut() {
            tokio::select! {
                received = receiver.recv() => {
                    if received.is_none() {
                        // 队列被清理（注销/停用/关闭）：按取消收口。
                        admitted.cancel.cancel();
                    }
                }
                () = admitted.cancel.cancelled() => {}
                () = sleep_until_deadline(admitted.deadline) => {
                    admitted.cancel.cancel();
                }
            }
            if admitted.cancel.is_cancelled() {
                if Instant::now() >= admitted.deadline {
                    return Err(timeout_error());
                }
                return Err(cancelled_error());
            }
        }

        let executor = Arc::clone(&admitted.registration.executor);
        let ctx = CapabilityContext {
            signal: admitted.cancel.clone(),
            deadline: admitted.deadline,
        };
        let input = admitted.input.clone();
        let join = tokio::spawn(async move { executor.execute(&ctx, input).await });
        if let Some(entry) = lock_core(&self.inner).invocations.get_mut(&admitted.seq) {
            entry.abort = Some(join.abort_handle());
        }
        let outcome = tokio::select! {
            result = join => Some(result),
            () = sleep_until_deadline(admitted.deadline) => {
                admitted.cancel.cancel();
                None
            }
            () = admitted.cancel.cancelled() => None,
        };
        match outcome {
            Some(Ok(Ok(output))) => {
                if admitted.cancel.is_cancelled() {
                    // 取消后到达的结果按丢弃处理（《Bridge三层设计》§8.2）。
                    return Err(cancelled_error());
                }
                Ok(output)
            }
            Some(Ok(Err(error))) => {
                if admitted.cancel.is_cancelled() {
                    return Err(cancelled_error());
                }
                Err(error)
            }
            Some(Err(join_error)) => {
                if join_error.is_panic() {
                    // 诊断写宿主日志由绑定层负责；此处不回传堆栈与内部路径。
                    return Err(
                        ChipsError::new(BRIDGE_INTERNAL, "桥接内部错误：能力执行异常")
                            .with_details(serde_json::json!({ "phase": "execute" })),
                    );
                }
                Err(cancelled_error())
            }
            None => {
                // 超时或取消：强止任务并丢弃迟到结果。
                if let Some(entry) = lock_core(&self.inner).invocations.get_mut(&admitted.seq) {
                    if let Some(abort) = entry.abort.take() {
                        abort.abort();
                    }
                }
                if Instant::now() >= admitted.deadline {
                    Err(timeout_error())
                } else {
                    Err(cancelled_error())
                }
            }
        }
    }
}

/// 注册期与内核状态无关的形状校验：ID 文法、R3 互斥、超时范围。
fn precheck_registration(registration: &CapabilityRegistration) -> Result<(), ChipsError> {
    let capability_id = &registration.descriptor.id;
    if !is_valid_capability_id(capability_id) {
        return Err(conflict("ID 文法非法", capability_id));
    }
    if is_permission_id_in_vocabulary(capability_id) {
        return Err(conflict("能力 ID 与权限 ID 相同（R3）", capability_id));
    }
    if registration.timeout_ms == 0 {
        return Err(conflict("timeout_ms 必须为正", capability_id));
    }
    if registration.timeout_ms > u64::from(u32::MAX) {
        // 上限约束防止超时调度溢出（《Bridge三层设计》§8.1）。
        return Err(conflict("timeout_ms 超出允许范围", capability_id));
    }
    Ok(())
}

/// 注册期的绑定校验：owner 激活状态、内置/登记 ID 归属、权限词表与
/// manifest 声明覆盖。
fn check_registration_bindings(
    state: &CoreState,
    registration: &CapabilityRegistration,
) -> Result<(), ChipsError> {
    let capability_id = &registration.descriptor.id;
    let Some(provider) = state.providers.get(&registration.owner) else {
        return Err(ChipsError::new(
            KERNEL_INVALID_TRANSITION,
            format!("能力提供方尚未激活：{}", registration.owner),
        ));
    };
    // 原 owner 绑定：ID 一旦被成功注册即与原 owner 永久绑定，注销不解除；
    // 其他提供方不得抢占（《能力契约规范》§4.4、§9.3「登记绑定不可转让、
    // 不可继承」）。内置 ID 无登记台账，此校验是唯一的重注册约束面。
    if let Some(bound) = state.owner_bindings.get(capability_id) {
        if bound != &registration.owner {
            return Err(conflict(OWNER_BINDING_CONFLICT_REASON, capability_id));
        }
    }
    if is_builtin_capability_id(capability_id) {
        if provider.kind != ProviderKind::PlatformService {
            return Err(conflict("内置 ID 由平台服务域持有", capability_id));
        }
    } else {
        let Some(bound) = state.id_ledger.get(capability_id) else {
            return Err(conflict("未登记 ID", capability_id));
        };
        if bound != &registration.owner {
            return Err(conflict("登记提供方与 owner 不一致", capability_id));
        }
    }
    for permission in &registration.descriptor.permissions {
        if !is_permission_id_in_vocabulary(permission) {
            return Err(ChipsError::new(
                PERMISSION_UNKNOWN,
                format!("权限 ID 未注册：{permission}"),
            )
            .with_details(serde_json::json!({
                "capabilityId": capability_id,
                "permission": permission,
            })));
        }
        if !provider.permissions.contains(permission) {
            return Err(ChipsError::new(
                PERMISSION_NOT_DECLARED,
                format!("能力所需权限未在提供方 manifest 声明：{permission}"),
            )
            .with_details(serde_json::json!({
                "capabilityId": capability_id,
                "permission": permission,
                "owner": registration.owner,
            })));
        }
    }
    Ok(())
}

/// 截止时刻睡眠：已过期的截止立即返回（避免 `Instant::from_std` 反向钳制）。
async fn sleep_until_deadline(deadline: Instant) {
    if deadline <= Instant::now() {
        tokio::time::sleep(Duration::ZERO).await;
        return;
    }
    tokio::time::sleep_until(tokio::time::Instant::from_std(deadline)).await;
}

/// 取消指定能力的全部在途调用（注销/停用路径）。
fn cancel_capability(state: &mut CoreState, capability_id: &str) {
    if let Some(ids) = state.cap_invocations.remove(capability_id) {
        cancel_sequences(state, &ids);
    }
}

/// 取消给定的在途调用集合并强止其执行任务。
fn cancel_sequences(state: &mut CoreState, ids: &HashSet<u64>) {
    for seq in ids {
        if let Some(entry) = state.invocations.get_mut(seq) {
            entry.cancel.cancel();
            if let Some(abort) = entry.abort.take() {
                abort.abort();
            }
        }
    }
}

/// 关闭会话并取消其全部在途调用。
fn close_session_locked(state: &mut CoreState, session: SessionId) {
    state.sessions.remove(&session);
    if let Some(ids) = state.session_invocations.remove(&session) {
        cancel_sequences(state, &ids);
    }
}
