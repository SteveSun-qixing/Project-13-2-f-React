//! 资源管理域导出（《04-资源管理设计》§11.3 十五导出，《核心接口规范》§7.3、§8.6）。
//!
//! 导出面与 backing 的一一对应（业务逻辑全部位于 `chips-resource`，本模块
//! 只做类型转换、错误归一与线程回投，《核心接口规范》§8.1）：
//!
//! | Neon 导出 | backing（`chips-resource` 公开面） |
//! | --- | --- |
//! | `resourceOpen` | `ResourceManager::open(OpenRequest)`（成功路径记句柄↔会话归属账） |
//! | `resourceStat` | `ResourceManager::stat(HandleId, SessionId)`（会话源经归属账回取） |
//! | `resourceRead` | `ResourceManager::read_range(HandleId, SessionId, ByteRange)` |
//! | `resourceReadChunk` | `ResourceManager::read_chunk(HandleId, SessionId, usize)` |
//! | `resourceRelease` | `ResourceManager::release(HandleId, SessionId)`（未知/墓碑幂等） |
//! | `resourceCommitWrite` | `ResourceManager::commit_write(WriteRequest)` |
//! | `resourceCommitWriteStream` | `ResourceManager::open_write_stream(WriteStreamRequest)` +
//!   闭包对象的 `append` / `commit` / `abort`（`append_write_stream` /
//!   `commit_write_stream` / `abort_write_stream`） |
//! | `resourceListDirectory` | `ResourceManager::list_directory(OpenRequest)` |
//! | `resourceDelete` | `ResourceManager::delete(FsOpRequest)` |
//! | `resourceRename` | `ResourceManager::rename(FsOpRequest)`（返回值按 §11.3 收敛为 `void`） |
//! | `resourceCopy` | `ResourceManager::copy(FsOpRequest)` |
//! | `resourceCreateDirectory` | `ResourceManager::create_directory(FsOpRequest)` |
//! | `resourceOpenSession` | `ResourceManager::open_session`（顶层会话，空绑定起步，
//!   作用域/权限挂接归宿主装配面） |
//! | `resourceCloseSession` | `ResourceManager::close_session`（级联释放） |
//! | `resourceRegisterTempScope` | `ResourceManager::register_temp_scope`（dialog 授权后调用） |
//!
//! 约定（§8.2、§8.3、§8.5、§11.3、§11.5）：
//!
//! - 进程级单例：`ResourceManager` 以 `Arc` 一次初始化、生命周期与主进程
//!   一致（§11.5）；绑定层不感知作用域挂载细节（`mount_directory` /
//!   `register_scope` Document 种类等生产端口载体不在 §11.3 十五导出内，
//!   归宿主装载链接线波，任务 #194/#196 在册）；
//! - 波界在册：单例构造注入 `NoopDecisionObserver` 仅为
//!   `ResourceManager::new(limits, observer)` 构造签名的编译随行——真正的
//!   `DecisionObserver`（审计素材经 Neon Channel 投递宿主 TS 消费函数）归
//!   接线波（比照 [`crate::bridge::bridge`] 的同款注记），本波禁顺带接线；
//! - 线程约束：异步导出全部提交绑定层运行时执行，结果经 `Channel` 回投
//!   JS 线程 settle（§8.3）；`resourceRelease` / `resourceOpenSession` /
//!   `resourceCloseSession` / `resourceRegisterTempScope` 按 §11.3 表为同步
//!   导出（backing 为同步签名，只做注册表内存操作）；
//! - 错误归一：`RESOURCE_*` / `NETWORK_*` 等 backing 契约码经 `ChipsError`
//!   原样透传（§8.5），绑定层只以 `NATIVE_*` 三码拒绝非法入参，不自造码；
//! - 句柄：`HandleId` / `SessionId` 为单调递增 `u64`（低于 2^53，§11.3），
//!   跨边界经 `normalize_u64_field` 判闸；流式写入句柄为**闭包对象**
//!   （neon 1.1.1 无 class API 实证）：`{ id, uri, append, commit, abort }`，
//!   方法闭包捕获共享状态，对象整体被 GC 回收且仍未收口时由最后一次引用
//!   的 `Drop` 兜底 `abort_write_stream`（零残留，《04.04》§4.8 失败回滚、
//!   §8.4「Finalize 只作兜底」同构语义）；
//! - N-1 句柄归属闸（本单收口，安全巡检残项复核 §一.1）：§11.3 的句柄操作
//!   四导出（`resourceStat` / `resourceRead` / `resourceReadChunk` /
//!   `resourceRelease`）签名只携带 `handleId`、不携带会话源（导出面只增不改，
//!   `coreAbiVersion` 不随动）。归属比对采「服务端注册表比对」最小形态：绑定层
//!   维持一张进程级句柄↔会话归属账 [`HandleSessionLedger`]，`resourceOpen`
//!   成功时以入参 `sessionId` 记账，四句柄导出经 [`owner_of_handle`] 回取归属
//!   会话再交 `chips-resource` 归属闸复核——未在册句柄回哨兵会话
//!   （[`UNCLAIMED_SESSION`]，恒不匹真实会话，ID 受 2^53 约束），因状态闸
//!   先行故对外行为不变（`RESOURCE_HANDLE_RELEASED`），注册表失同步时
//!   fail-closed。此即「binding layer guarantees only in-ledger handles pass
//!   through」的在册形态：四导出签名零改动，§11.3 十五导出面与 49 项三方锁
//!   账零漂移。

use std::collections::{BTreeMap, BTreeSet};
use std::future::Future;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use chips_core::{ChipsError, NoopDecisionObserver};
use chips_resource::provider::ByteRange;
use chips_resource::{
    FsOpRequest, OpenRequest, ResourceError, ResourceLimits, ResourceManager, ResourceMetadata,
    SessionKind, VirtualPath, WriteRequest, WriteStreamHandle, WriteStreamRequest,
};
use neon::prelude::*;
use serde_json::{json, Value};

use crate::bridge::normalize_u64_field;
use crate::convert::{safe_u64_number, ConvertIssue};
use crate::envelope::binary_bytes;
use crate::error::{internal_error, throw_chips_error, type_unsupported, value_out_of_range};
use crate::runtime::{runtime, settle_json, spawn_result};

/// 进程级资源管理器单例（§11.5：一次初始化，生命周期与主进程一致）。
static RESOURCE_MANAGER: OnceLock<Arc<ResourceManager>> = OnceLock::new();

/// 取进程级资源管理器句柄；`ResourceLimits::default()` 即《04.12》§12 生产
/// 默认值（八字段常量口径，段三主体波已翻正），观察面注记见模块头。
fn resource_manager() -> Arc<ResourceManager> {
    Arc::clone(RESOURCE_MANAGER.get_or_init(|| {
        Arc::new(ResourceManager::new(
            ResourceLimits::default(),
            Arc::new(NoopDecisionObserver),
        ))
    }))
}

// ---------------------------------------------------------------------------
// N-1 句柄↔会话归属账（服务端注册表比对，绑定层选项 B）
// ---------------------------------------------------------------------------

/// 未在册句柄的哨兵归属会话：真实会话 ID 经单调分配且跨边界受 2^53 约束
/// （§11.3），此值永不为任何真实会话取得——四句柄导出对未在册句柄回此值，
/// `chips-resource` 状态闸先行（未知/墓碑句柄先挂 `RESOURCE_HANDLE_RELEASED`），
/// 故对外行为与收口前逐字一致；仅当注册表失同步时以归属闸 fail-closed 兜底。
const UNCLAIMED_SESSION: u64 = u64::MAX;

/// 进程级句柄↔会话归属注册表（与 [`RESOURCE_MANAGER`] 同生命周期）。
/// `resourceOpen` 成功路径以入参 `sessionId` 记账；`resourceRelease` 成功与
/// `resourceCloseSession`（级联释放）对应清账。四句柄导出经 [`owner_of_handle`]
/// 回取归属会话传入 `chips-resource` 归属闸。
static HANDLE_SESSION_LEDGER: OnceLock<Mutex<HandleSessionLedger>> = OnceLock::new();

#[derive(Default)]
struct HandleSessionLedger {
    /// 句柄 → 归属会话（四句柄导出回取用）。
    owners: BTreeMap<u64, u64>,
    /// 会话 → 名下句柄集（`close_session` 级联清账用）。
    sessions: BTreeMap<u64, BTreeSet<u64>>,
}

impl HandleSessionLedger {
    fn record(&mut self, handle: u64, session: u64) {
        self.owners.insert(handle, session);
        self.sessions.entry(session).or_default().insert(handle);
    }

    fn owner_of(&self, handle: u64) -> Option<u64> {
        self.owners.get(&handle).copied()
    }

    fn forget(&mut self, handle: u64) {
        if let Some(session) = self.owners.remove(&handle) {
            if let Some(set) = self.sessions.get_mut(&session) {
                set.remove(&handle);
                if set.is_empty() {
                    self.sessions.remove(&session);
                }
            }
        }
    }

    fn forget_session(&mut self, session: u64) {
        if let Some(set) = self.sessions.remove(&session) {
            for handle in set {
                self.owners.remove(&handle);
            }
        }
    }
}

fn ledger() -> &'static Mutex<HandleSessionLedger> {
    HANDLE_SESSION_LEDGER.get_or_init(|| Mutex::new(HandleSessionLedger::default()))
}

/// `resourceOpen` 成功记账：登记句柄的归属会话。
fn record_handle_owner(handle: u64, session: u64) {
    ledger()
        .lock()
        .expect("句柄归属账锁不得中毒")
        .record(handle, session);
}

/// 四句柄导出回取归属会话；未在册回哨兵会话（fail-closed，行为不变）。
fn owner_of_handle(handle: u64) -> u64 {
    ledger()
        .lock()
        .expect("句柄归属账锁不得中毒")
        .owner_of(handle)
        .unwrap_or(UNCLAIMED_SESSION)
}

/// `resourceRelease` 成功后清账（幂等：未在册亦为无操作）。
fn forget_handle_owner(handle: u64) {
    ledger()
        .lock()
        .expect("句柄归属账锁不得中毒")
        .forget(handle);
}

/// `resourceCloseSession` 级联清账（幂等：无句柄会话为无操作）。
fn forget_session_handles(session: u64) {
    ledger()
        .lock()
        .expect("句柄归属账锁不得中毒")
        .forget_session(session);
}

// ---------------------------------------------------------------------------
// 参数转换（§8.2：`NATIVE_*` 三码拒绝非法入参；neon 类型错误原样抛出）
// ---------------------------------------------------------------------------

/// 实参提取收口：neon 已抛出的类型错误（外层 `Err(Throw)`）原样传播；
/// 绑定层 `ChipsError` 由调用点抛出。
macro_rules! arg_or_throw {
    ($call:expr, $cx:expr) => {
        match $call {
            Ok(Ok(value)) => value,
            Ok(Err(error)) => return throw_chips_error($cx, error),
            Err(throw) => return Err(throw),
        }
    };
}

/// 读取 `handleId` / `sessionId` 实参：非负整值且 `< 2^53`（§11.3）。
fn id_argument(
    cx: &mut FunctionContext,
    index: usize,
    pointer: &str,
) -> Result<Result<u64, ChipsError>, neon::result::Throw> {
    let raw = cx.argument::<JsNumber>(index)?.value(cx);
    Ok(match normalize_u64_field(raw) {
        Some(value) => Ok(value),
        None => Err(value_out_of_range(
            pointer,
            "必须是不超过 2^53 的非负整数值",
        )),
    })
}

/// 读取二进制实参（`Buffer` 或 `Uint8Array`，各复制一次，《核心接口规范》§8.2）。
fn bytes_argument(
    cx: &mut FunctionContext,
    index: usize,
    pointer: &str,
) -> Result<Result<Vec<u8>, ChipsError>, neon::result::Throw> {
    let value = cx.argument::<JsValue>(index)?;
    Ok(match binary_bytes(cx, &value) {
        Some(bytes) => Ok(bytes),
        None => Err(type_unsupported(
            pointer,
            "字节实参必须是 Buffer 或 Uint8Array",
        )),
    })
}

/// `SessionKind` 判别字面量解析（serde `lowercase` 与《04.11》§11.2 对齐）。
#[must_use]
pub(crate) fn parse_session_kind(raw: &str) -> Option<SessionKind> {
    match raw {
        "document" => Some(SessionKind::Document),
        "plugin" => Some(SessionKind::Plugin),
        "window" => Some(SessionKind::Window),
        _ => None,
    }
}

/// `resourceCommitWrite` / `resourceCommitWriteStream` 的路径实参 →
/// `VirtualPath`（PathGuard 复检，《04.04》§4.8：越界路径以 backing 契约码
/// `RESOURCE_PATH_INVALID` 拒绝，绑定层不改写）。
fn write_virtual_path(
    limits: &ResourceLimits,
    scope: &str,
    raw_path: &str,
) -> Result<VirtualPath, ChipsError> {
    let uri = format!("chips-resource://{scope}/{raw_path}");
    VirtualPath::validate(raw_path, &uri, limits).map_err(|error| error.to_chips_error())
}

/// `resourceRead` 的 `(offset, length)` → `ByteRange`；求和溢出拒绝。
fn byte_range(offset: u64, length: u64) -> Result<ByteRange, ChipsError> {
    offset.checked_add(length).ok_or_else(|| {
        value_out_of_range("/length", "offset 与 length 之和超出字节偏移可表示范围")
    })?;
    Ok(ByteRange {
        offset,
        length: Some(length),
    })
}

// ---------------------------------------------------------------------------
// backing 结果映射（纯 Rust，可离线单测）
// ---------------------------------------------------------------------------

/// `serde_json` 序列化收口；失败归一 `NATIVE_INTERNAL`（不携带堆栈）。
fn serialize_json<T: serde::Serialize + ?Sized>(
    value: &T,
    pointer: &str,
) -> Result<Value, ChipsError> {
    serde_json::to_value(value)
        .map_err(|error| internal_error(format!("{pointer} 结果序列化失败：{error}")))
}

/// `ResourceMetadata` 投影（camelCase DTO：`{ uri, size, mimeType, version,
/// scope }`，《04》§3.2 与《06》§6.1 并集形状）。
fn metadata_json(metadata: &ResourceMetadata) -> Result<Value, ChipsError> {
    serialize_json(metadata, "/metadata")
}

/// `resourceOpen` 返回值：`{ handleId, metadata }`（§11.3 逐字形状）；
/// 句柄 ID 经 `< 2^53` 线格式判闸（§8.2）。
fn open_result_json(id: u64, metadata: &ResourceMetadata) -> Result<Value, ChipsError> {
    let number = safe_u64_number(id, "/handleId").map_err(ConvertIssue::into_error)?;
    Ok(json!({
        "handleId": number,
        "metadata": metadata_json(metadata)?,
    }))
}

// ---------------------------------------------------------------------------
// 流式写入句柄：闭包对象 backing（§11.3 `WriteStreamHandle`）
// ---------------------------------------------------------------------------

/// 写流共享状态：`claim` 收口 commit/abort 的一次性语义；最后一次强引用
/// 消失（JS 对象与方法闭包一并被 GC）时 `Drop` 兜底回滚（零残留）。
///
/// 与「显式释放优先」约定同构（§8.4）：`commit` / `abort` 为正式收口通道，
/// `Drop` 只是泄漏兜底；兜底回滚经 `abort_write_stream` 归还路径写锁并
/// 清理临时文件（《04.04》§4.8/§4.9），已提交/已中止的流为陈旧句柄，
/// 兜底静默忽略。
struct SharedStream {
    manager: Arc<ResourceManager>,
    handle: WriteStreamHandle,
    live: AtomicBool,
}

impl SharedStream {
    /// 陈旧句柄错误：与 backing `append/commit/abort` 同口径
    /// （已提交/已中止/随会话注销 → `RESOURCE_NOT_FOUND`）。
    fn stale_error(&self) -> ChipsError {
        ResourceError::NotFound {
            uri: self.handle.uri.clone(),
        }
        .to_chips_error()
    }

    /// 是否仍可送入（未收口）。
    fn is_live(&self) -> bool {
        self.live.load(Ordering::Acquire)
    }

    /// 一次性收口：首个 `commit` / `abort` 拿到执行权，其余返回 `false`。
    fn claim(&self) -> bool {
        self.live.swap(false, Ordering::AcqRel)
    }
}

impl Drop for SharedStream {
    fn drop(&mut self) {
        if self.live.swap(false, Ordering::AcqRel) {
            let _ = self.manager.abort_write_stream(&self.handle);
        }
    }
}

/// 写流方法 `append(bytes)`：分块送入（背压承载：不送入即不推进）；
/// 阻塞落盘在绑定层运行时线程执行；陈旧句柄以 `RESOURCE_NOT_FOUND` 拒绝。
fn js_stream_append<'a>(
    shared: &Arc<SharedStream>,
    cx: &mut FunctionContext<'a>,
) -> JsResult<'a, JsPromise> {
    let bytes = arg_or_throw!(bytes_argument(cx, 0, "/bytes"), cx);
    let worker = Arc::clone(shared);
    spawn_promise(
        cx,
        async move {
            if !worker.is_live() {
                return Err(worker.stale_error());
            }
            worker.manager.append_write_stream(&worker.handle, &bytes)
        },
        settle_undefined,
    )
}

/// 写流方法 `commit()`：原子提交并返回新版本元数据；`expected_size`
/// 缺省（§11.3 签名不携带），提交按实际尺寸登记；重复调用以
/// `RESOURCE_NOT_FOUND` 拒绝（claim 收口）。
fn js_stream_commit<'a>(
    shared: &Arc<SharedStream>,
    cx: &mut FunctionContext<'a>,
) -> JsResult<'a, JsPromise> {
    let worker = Arc::clone(shared);
    spawn_promise(
        cx,
        async move {
            if !worker.claim() {
                return Err(worker.stale_error());
            }
            let metadata = worker
                .manager
                .commit_write_stream(worker.handle.clone())
                .await?;
            metadata_json(&metadata)
        },
        settle_json,
    )
}

/// 写流方法 `abort()`：主动中止并清理临时文件（零残留）；重复调用同
/// `commit` 的 claim 收口口径。
fn js_stream_abort<'a>(
    shared: &Arc<SharedStream>,
    cx: &mut FunctionContext<'a>,
) -> JsResult<'a, JsPromise> {
    let worker = Arc::clone(shared);
    spawn_promise(
        cx,
        async move {
            if !worker.claim() {
                return Err(worker.stale_error());
            }
            worker.manager.abort_write_stream(&worker.handle)
        },
        settle_undefined,
    )
}

/// 写流方法的函数指针形态（`for<'x>` 高阶绑定 JS 上下文生命周期，
/// 闭包对象装配用）。
type StreamMethod =
    for<'x> fn(&Arc<SharedStream>, &mut FunctionContext<'x>) -> JsResult<'x, JsPromise>;

/// 把写流共享状态装箱为 §11.3 `WriteStreamHandle` 闭包对象：
/// `{ id, uri, append, commit, abort }`（neon 1.1.1 无 class API 实证，
/// 方法以捕获共享状态的 [`JsFunction::new`] 挂属性；对象与方法闭包同生共死，
/// GC 回收即触发 [`SharedStream::drop`] 兜底）。
fn settle_write_stream<'a>(cx: &mut Cx<'a>, shared: Arc<SharedStream>) -> JsResult<'a, JsValue> {
    let object = JsObject::new(cx);
    let id_number = match safe_u64_number(shared.handle.id, "/writeStream/id") {
        Ok(number) => cx.number(number),
        Err(issue) => return throw_chips_error(cx, ConvertIssue::into_error(issue)),
    };
    let uri_text = cx.string(&shared.handle.uri);
    object.set(cx, "id", id_number)?;
    object.set(cx, "uri", uri_text)?;
    for (key, builder) in [
        ("append", js_stream_append as StreamMethod),
        ("commit", js_stream_commit as StreamMethod),
        ("abort", js_stream_abort as StreamMethod),
    ] {
        let captured = Arc::clone(&shared);
        let function = JsFunction::new(cx, move |mut cx: FunctionContext| {
            builder(&captured, &mut cx)
        })?;
        object.set(cx, key, function)?;
    }
    Ok(object.upcast())
}

// ---------------------------------------------------------------------------
// 异步调度（§8.3：JS 线程只做参数提取与 Promise 组装）
// ---------------------------------------------------------------------------

/// 异步导出统一调度：future 提交绑定层运行时执行，结果经 `Channel` 回投
/// JS 线程 settle；运行时初始化失败即时抛出（`Deferred` 未移交，无悬挂）。
fn spawn_promise<'a, T, F, S>(
    cx: &mut FunctionContext<'a>,
    future: F,
    settle: S,
) -> JsResult<'a, JsPromise>
where
    T: Send + 'static,
    F: Future<Output = Result<T, ChipsError>> + Send + 'static,
    S: for<'b> FnOnce(&mut Cx<'b>, T) -> JsResult<'b, JsValue> + Send + 'static,
{
    if let Err(error) = runtime() {
        return throw_chips_error(cx, error);
    }
    let (deferred, promise) = cx.promise();
    let channel = cx.channel();
    // 运行时已就绪；意外失败时 `Deferred` 由 N-API 6+ 自动拒绝（§8.3 规则 8）。
    let _ = spawn_result(deferred, channel, future, settle);
    Ok(promise)
}

/// 同步 backing 的 Promise 化调度（工作移交给运行时线程执行）。
fn spawn_work<'a, T, F, S>(
    cx: &mut FunctionContext<'a>,
    work: F,
    settle: S,
) -> JsResult<'a, JsPromise>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, ChipsError> + Send + 'static,
    S: for<'b> FnOnce(&mut Cx<'b>, T) -> JsResult<'b, JsValue> + Send + 'static,
{
    spawn_promise(cx, async move { work() }, settle)
}

/// 字节结果 → `Buffer`（§8.2：复制一次交付，Rust 侧不保留）。
fn settle_buffer<'a>(cx: &mut Cx<'a>, bytes: Vec<u8>) -> JsResult<'a, JsValue> {
    let buffer = JsBuffer::from_slice(cx, &bytes)?;
    Ok(buffer.upcast::<JsValue>())
}

/// 流式分块结果：`Some(bytes)` → `Buffer`，`None`（结尾）→ `null`（§11.3）。
fn settle_chunk<'a>(cx: &mut Cx<'a>, chunk: Option<Vec<u8>>) -> JsResult<'a, JsValue> {
    match chunk {
        Some(bytes) => settle_buffer(cx, bytes),
        None => Ok(cx.null().upcast()),
    }
}

/// `void` 收口（Promise 臂输出 `undefined`）。
fn settle_undefined<'a>(cx: &mut Cx<'a>, (): ()) -> JsResult<'a, JsValue> {
    Ok(cx.undefined().upcast())
}

/// `Result<(), ChipsError>` 的同步导出收口。
fn check_sync<'a>(cx: &mut FunctionContext<'a>, result: Result<(), ChipsError>) -> NeonResult<()> {
    match result {
        Ok(value) => Ok(value),
        Err(error) => throw_chips_error(cx, error),
    }
}

// ---------------------------------------------------------------------------
// 导出实现（§11.3 表序；异步臂全部经绑定层运行时回投）
// ---------------------------------------------------------------------------

/// `resourceOpen(uri, sessionId)`：解析、权限、打开（§11.3）。
pub(crate) fn js_resource_open(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let uri = cx.argument::<JsString>(0)?.value(&mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 1, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_promise(
        &mut cx,
        async move {
            let opened = manager.open(OpenRequest { uri, session }).await?;
            // N-1：打开成功即记句柄↔会话归属账，供四句柄导出回取。
            record_handle_owner(opened.id, session);
            open_result_json(opened.id, &opened.metadata)
        },
        settle_json,
    )
}

/// `resourceStat(handleId)`：元数据（命中 L0 新鲜期直返，《04》§6.3）。
pub(crate) fn js_resource_stat(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = arg_or_throw!(id_argument(&mut cx, 0, "/handleId"), &mut cx);
    // N-1：归属会话经句柄↔会话归属账回取，交 chips-resource 归属闸复核。
    let owner = owner_of_handle(handle);
    let manager = resource_manager();
    spawn_promise(
        &mut cx,
        async move {
            let metadata = manager.stat(handle, owner).await?;
            metadata_json(&metadata)
        },
        settle_json,
    )
}

/// `resourceRead(handleId, offset, length)`：范围读 → `Buffer`。
pub(crate) fn js_resource_read(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = arg_or_throw!(id_argument(&mut cx, 0, "/handleId"), &mut cx);
    let offset = arg_or_throw!(id_argument(&mut cx, 1, "/offset"), &mut cx);
    let length = arg_or_throw!(id_argument(&mut cx, 2, "/length"), &mut cx);
    let range = match byte_range(offset, length) {
        Ok(range) => range,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    // N-1：归属会话经句柄↔会话归属账回取，交 chips-resource 归属闸复核。
    let owner = owner_of_handle(handle);
    let manager = resource_manager();
    spawn_promise(
        &mut cx,
        async move { manager.read_range(handle, owner, range).await },
        settle_buffer,
    )
}

/// `resourceReadChunk(handleId, maxBytes)`：流式拉取；`null` 为结尾。
pub(crate) fn js_resource_read_chunk(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = arg_or_throw!(id_argument(&mut cx, 0, "/handleId"), &mut cx);
    let max_bytes = arg_or_throw!(id_argument(&mut cx, 1, "/maxBytes"), &mut cx);
    // N-1：归属会话经句柄↔会话归属账回取，交 chips-resource 归属闸复核。
    let owner = owner_of_handle(handle);
    let manager = resource_manager();
    spawn_promise(
        &mut cx,
        async move {
            manager
                .read_chunk(
                    handle,
                    owner,
                    usize::try_from(max_bytes).unwrap_or(usize::MAX),
                )
                .await
        },
        settle_chunk,
    )
}

/// `resourceRelease(handleId)`：释放句柄与租约；幂等（§11.3 同步 `void`）。
pub(crate) fn js_resource_release(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let handle = arg_or_throw!(id_argument(&mut cx, 0, "/handleId"), &mut cx);
    // N-1：归属会话经句柄↔会话归属账回取；释放成功后清账。
    let owner = owner_of_handle(handle);
    let manager = resource_manager();
    check_sync(
        &mut cx,
        manager
            .release(handle, owner)
            .map_err(|error| error.to_chips_error()),
    )?;
    forget_handle_owner(handle);
    Ok(cx.undefined())
}

/// `resourceCommitWrite(scope, path, bytes, sessionId)`：一次性写入提交
/// （仅内部与文档服务，《04.04》§4.8；> `max_inline_bytes` 由 backing 以
/// `RESOURCE_TOO_LARGE` 收口，转流式臂）。
pub(crate) fn js_resource_commit_write(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let scope = cx.argument::<JsString>(0)?.value(&mut cx);
    let raw_path = cx.argument::<JsString>(1)?.value(&mut cx);
    let bytes = arg_or_throw!(bytes_argument(&mut cx, 2, "/bytes"), &mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 3, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_promise(
        &mut cx,
        async move {
            let path = write_virtual_path(manager.limits(), &scope, &raw_path)?;
            let metadata = manager
                .commit_write(WriteRequest {
                    session,
                    scope,
                    path,
                    bytes,
                })
                .await?;
            metadata_json(&metadata)
        },
        settle_json,
    )
}

/// `resourceCommitWriteStream(scope, path, sessionId)`：打开流式写入通道，
/// 返回 §11.3 闭包对象（分块 + 背压 + 失败回滚，《04.04》§4.8）。
pub(crate) fn js_resource_commit_write_stream(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let scope = cx.argument::<JsString>(0)?.value(&mut cx);
    let raw_path = cx.argument::<JsString>(1)?.value(&mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 2, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_work(
        &mut cx,
        move || {
            let path = write_virtual_path(manager.limits(), &scope, &raw_path)?;
            let handle = manager.open_write_stream(WriteStreamRequest {
                session,
                scope,
                path,
                expected_size: None,
            })?;
            Ok(Arc::new(SharedStream {
                manager,
                handle,
                live: AtomicBool::new(true),
            }))
        },
        settle_write_stream,
    )
}

/// `resourceListDirectory(uri, sessionId)`：目录列举（§11.3，4.10）。
pub(crate) fn js_resource_list_directory(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let uri = cx.argument::<JsString>(0)?.value(&mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 1, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_promise(
        &mut cx,
        async move {
            let entries = manager.list_directory(OpenRequest { uri, session }).await?;
            serialize_json(&entries, "/entries")
        },
        settle_json,
    )
}

/// `resourceDelete(uri, recursive, sessionId)`：删除文件/目录（4.9）。
pub(crate) fn js_resource_delete(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let uri = cx.argument::<JsString>(0)?.value(&mut cx);
    let recursive = cx.argument::<JsBoolean>(1)?.value(&mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 2, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_promise(
        &mut cx,
        async move {
            manager
                .delete(FsOpRequest {
                    session,
                    source: uri,
                    target: None,
                    recursive,
                })
                .await
        },
        settle_undefined,
    )
}

/// `resourceRename(fromUri, toUri, sessionId)`：重命名/移动（4.9）；
/// backing 的新版本元数据按 §11.3 返回形状收敛为 `Promise<void>`。
pub(crate) fn js_resource_rename(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let from_uri = cx.argument::<JsString>(0)?.value(&mut cx);
    let to_uri = cx.argument::<JsString>(1)?.value(&mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 2, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_promise(
        &mut cx,
        async move {
            manager
                .rename(FsOpRequest {
                    session,
                    source: from_uri,
                    target: Some(to_uri),
                    recursive: false,
                })
                .await
                .map(drop)
        },
        settle_undefined,
    )
}

/// `resourceCopy(fromUri, toUri, sessionId)`：复制（4.9），返回新资源元数据。
pub(crate) fn js_resource_copy(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let from_uri = cx.argument::<JsString>(0)?.value(&mut cx);
    let to_uri = cx.argument::<JsString>(1)?.value(&mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 2, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_promise(
        &mut cx,
        async move {
            let metadata = manager
                .copy(FsOpRequest {
                    session,
                    source: from_uri,
                    target: Some(to_uri),
                    recursive: false,
                })
                .await?;
            metadata_json(&metadata)
        },
        settle_json,
    )
}

/// `resourceCreateDirectory(uri, sessionId)`：创建目录（4.9，幂等口径归
/// backing，《04.04》§4.9 工单044 裁定⑦）。
pub(crate) fn js_resource_create_directory(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let uri = cx.argument::<JsString>(0)?.value(&mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 1, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_promise(
        &mut cx,
        async move {
            manager
                .create_directory(FsOpRequest {
                    session,
                    source: uri,
                    target: None,
                    recursive: false,
                })
                .await
        },
        settle_undefined,
    )
}

/// `resourceOpenSession(kind, owner)`：创建顶层资源会话（主进程内部使用，
/// §11.3 同步 `number`）。作用域与权限快照的挂接（§11.2 绑定/派生）归宿主
/// 装配面：本导出以空绑定起步，`derive_session` 与授权注入不在十五导出面内。
pub(crate) fn js_resource_open_session(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let kind_text = cx.argument::<JsString>(0)?.value(&mut cx);
    let owner = cx.argument::<JsString>(1)?.value(&mut cx);
    let kind = match parse_session_kind(&kind_text) {
        Some(kind) => kind,
        None => {
            return throw_chips_error(
                &mut cx,
                type_unsupported(
                    "/kind",
                    "会话种类必须是 document / plugin / window 判别字面量",
                ),
            )
        }
    };
    let manager = resource_manager();
    let session = match manager.open_session(kind, &owner, [], Vec::<String>::new()) {
        Ok(session) => session,
        Err(error) => return throw_chips_error(&mut cx, error.to_chips_error()),
    };
    crate::runtime::id_to_js_number(&mut cx, session)
}

/// `resourceCloseSession(sessionId)`：关闭会话并级联释放（§11.3 同步 `void`）。
pub(crate) fn js_resource_close_session(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let session = arg_or_throw!(id_argument(&mut cx, 0, "/sessionId"), &mut cx);
    let manager = resource_manager();
    check_sync(
        &mut cx,
        manager
            .close_session(session)
            .map_err(|error| error.to_chips_error()),
    )?;
    // N-1：级联释放后清该会话名下归属账（防句柄 ID 复用时错配）。
    forget_session_handles(session);
    Ok(cx.undefined())
}

/// `resourceRegisterTempScope(path, writable)`：注册临时作用域（dialog
/// 授权后调用），返回 `ScopeId`（§11.3 同步 `string`）。
pub(crate) fn js_resource_register_temp_scope(mut cx: FunctionContext) -> JsResult<JsString> {
    let path = cx.argument::<JsString>(0)?.value(&mut cx);
    let writable = cx.argument::<JsBoolean>(1)?.value(&mut cx);
    let manager = resource_manager();
    match manager.register_temp_scope(PathBuf::from(path), writable) {
        Ok(scope) => {
            let text = cx.string(scope);
            Ok(text)
        }
        Err(error) => throw_chips_error(&mut cx, error.to_chips_error()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;
    use std::fs;
    use std::path::{Path, PathBuf};

    /// 离线 backing 运行时（测试专用：驱动 `chips-resource` 异步面，不触
    /// 进程级绑定运行时单例）。
    fn test_runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .expect("测试运行时")
    }

    /// 独立管理器夹具（每测试一棵全新注册表，避免污染）。
    fn fixture_manager() -> Arc<ResourceManager> {
        Arc::new(ResourceManager::new(
            ResourceLimits::default(),
            Arc::new(NoopDecisionObserver),
        ))
    }

    /// 在临时目录开辟一棵独立小树；返回根路径。
    fn temp_root(tag: &str) -> PathBuf {
        let base = std::env::temp_dir().join(format!(
            "chips-native-resource-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).expect("创建夹具根目录");
        base
    }

    /// 写入可写临时作用域 + 绑定会话（`resources:read` 与 `resources:write`），
    /// 返回 (scope, session)。夹具根下预建 `notes/` 子目录：
    /// `open_write_stream` 对父目录缺失一律 `RESOURCE_NOT_FOUND`
    /// （与一次性提交同口径），流式臂测试需要在册父目录。
    fn writable_scope(manager: &ResourceManager, root: &Path) -> (String, u64) {
        fs::create_dir_all(root.join("notes")).expect("夹具子目录");
        let scope = manager
            .register_temp_scope(root.to_path_buf(), true)
            .expect("临时作用域注册必须成功");
        let mut scopes = BTreeSet::new();
        scopes.insert(scope.clone());
        let session = manager
            .open_session(
                SessionKind::Plugin,
                &"chips.official.tests".to_owned(),
                scopes,
                vec!["resources:read".to_owned(), "resources:write".to_owned()],
            )
            .expect("会话创建必须成功");
        (scope, session)
    }

    #[test]
    fn test_parse_session_kind_matches_serde_lowercase_literals() {
        assert_eq!(parse_session_kind("document"), Some(SessionKind::Document));
        assert_eq!(parse_session_kind("plugin"), Some(SessionKind::Plugin));
        assert_eq!(parse_session_kind("window"), Some(SessionKind::Window));
        // 判别字面量之外一律绑定层拒绝（`NATIVE_*`，不下放 backing）。
        assert_eq!(parse_session_kind("Document"), None);
        assert_eq!(parse_session_kind("frame"), None);
        for kind in [
            SessionKind::Document,
            SessionKind::Plugin,
            SessionKind::Window,
        ] {
            let text = serde_json::to_value(kind).expect("会话种类可序列化");
            let roundtrip = parse_session_kind(text.as_str().expect("serde lowercase 字符串"))
                .expect("序列化字面量必须可回读");
            assert_eq!(roundtrip, kind);
        }
    }

    #[test]
    fn test_id_gate_rejects_wire_boundary_and_fraction() {
        // §11.3：`HandleId` / `SessionId` 低于 2^53；判闸与
        // `normalize_u64_field` 同源（2^53 达到即拒）。
        assert_eq!(normalize_u64_field(7.0), Some(7));
        assert_eq!(
            normalize_u64_field(f64::from(u32::MAX)),
            Some(f64::from(u32::MAX) as u64)
        );
        assert_eq!(normalize_u64_field(-1.0), None);
        assert_eq!(normalize_u64_field(1.5), None);
        assert_eq!(normalize_u64_field(f64::NAN), None);
        assert_eq!(
            normalize_u64_field(crate::convert::MAX_SAFE_INTEGER as f64),
            None
        );
        assert_eq!(
            normalize_u64_field(crate::convert::MAX_SAFE_INTEGER as f64 - 1.0),
            Some(crate::convert::MAX_SAFE_INTEGER - 1)
        );
    }

    #[test]
    fn test_byte_range_maps_window_and_guards_overflow() {
        let range = byte_range(4, 8).expect("合法窗口");
        assert_eq!(range.offset, 4);
        assert_eq!(range.length, Some(8));
        let error = byte_range(u64::MAX, 1).expect_err("求和溢出必须被拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_VALUE_OUT_OF_RANGE);
    }

    #[test]
    fn test_write_virtual_path_passes_contract_codes() {
        let limits = ResourceLimits::default();
        let path = write_virtual_path(&limits, "temp-0", "notes/ok.txt").expect("在册路径");
        assert_eq!(path.as_str(), "notes/ok.txt");
        // 越界逃逸：backing 契约码原样透传（§8.5，绑定层不改写）。
        let error =
            write_virtual_path(&limits, "temp-0", "../escape").expect_err("路径逃逸必须被拒绝");
        assert_eq!(error.code(), "RESOURCE_PATH_INVALID");
    }

    #[test]
    fn test_metadata_and_open_result_projection_shapes() {
        let metadata = ResourceMetadata {
            uri: "chips-resource://temp-0/notes/ok.txt".to_owned(),
            size: 6,
            mime_type: "text/plain".to_owned(),
            version: "mtime:1700000000:size:6".to_owned(),
            scope: chips_resource::ScopeKind::Temporary,
        };
        let projected = metadata_json(&metadata).expect("元数据投影");
        // camelCase DTO 形状锁（§8.2 与《06》§6.1 并集）。
        assert_eq!(projected["uri"], metadata.uri);
        assert_eq!(projected["size"], 6);
        assert_eq!(projected["mimeType"], "text/plain");
        assert_eq!(projected["version"], metadata.version);
        assert_eq!(projected["scope"], "temporary");
        assert!(
            projected.get("mime_type").is_none(),
            "snake_case 键不得出现"
        );

        let opened = open_result_json(42, &metadata).expect("打开结果投影");
        let keys: Vec<String> = opened.as_object().expect("对象").keys().cloned().collect();
        assert_eq!(keys, vec!["handleId".to_owned(), "metadata".to_owned()]);
        // 句柄 ID 经 `f64` 线格式交付（JS number 同源）；形状锁而非文本锁。
        assert_eq!(opened["handleId"].as_f64(), Some(42.0));
        assert_eq!(opened["metadata"], projected);
        // 过界句柄 ID 判闸（fail-closed 兜底，§8.2）。
        let error = open_result_json(crate::convert::MAX_SAFE_INTEGER, &metadata)
            .expect_err("越界句柄必须被拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_VALUE_OUT_OF_RANGE);
    }

    #[test]
    fn test_open_backing_contract_codes_passthrough() {
        let root = temp_root("open");
        let other_root = temp_root("open-other");
        let manager = fixture_manager();
        let (scope, session) = writable_scope(&manager, &root);
        // 另开一个已注册但**未绑定**给会话的作用域（权限闸的可锁测输入）。
        let unbound = manager
            .register_temp_scope(other_root.clone(), true)
            .expect("第二临时作用域注册必须成功");
        let runtime = test_runtime();
        // 已注册但未绑定会话：权限闸拒绝，RESOURCE_PERMISSION_DENIED 原样透传
        // （《06》§4.2 二次校验口径，绑定层不改写）。
        let error = runtime
            .block_on(manager.open(OpenRequest {
                uri: format!("chips-resource://{unbound}/note.txt"),
                session,
            }))
            .expect_err("未授权作用域必须失败");
        assert_eq!(error.code(), "RESOURCE_PERMISSION_DENIED");
        // 未注册作用域：解析流水线 RESOURCE_NOT_FOUND 原样透传。
        let error = runtime
            .block_on(manager.open(OpenRequest {
                uri: "chips-resource://temp-9/missing.txt".to_owned(),
                session,
            }))
            .expect_err("未注册作用域必须失败");
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        // 已授权作用域下的缺失资源：RESOURCE_NOT_FOUND 原样透传。
        let error = runtime
            .block_on(manager.open(OpenRequest {
                uri: format!("chips-resource://{scope}/absent.txt"),
                session,
            }))
            .expect_err("缺失资源必须失败");
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        // 非法语法：RESOURCE_* 契约码原样透传。
        let error = runtime
            .block_on(manager.open(OpenRequest {
                uri: "http://incomplete".to_owned(),
                session,
            }))
            .expect_err("非法输入必须失败");
        assert!(
            error.code().starts_with("RESOURCE_"),
            "解析失败必须是 RESOURCE_* 契约码：{}",
            error.code()
        );
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&other_root);
    }

    #[test]
    fn test_commit_write_stream_roundtrip_and_stale_gates() {
        let root = temp_root("stream");
        let manager = fixture_manager();
        let (scope, session) = writable_scope(&manager, &root);
        // resourceCommitWriteStream 的 backing 臂（同步 open_write_stream）。
        let handle = manager
            .open_write_stream(WriteStreamRequest {
                session,
                scope: scope.clone(),
                path: write_virtual_path(manager.limits(), &scope, "notes/stream.txt")
                    .expect("在册路径"),
                expected_size: None,
            })
            .expect("写流打开必须成功");
        assert_eq!(manager.open_write_stream_count(), 1);

        // 闭包对象共享状态：append → commit 全链。
        let shared = Arc::new(SharedStream {
            manager: Arc::clone(&manager),
            handle: handle.clone(),
            live: AtomicBool::new(true),
        });
        assert!(shared.is_live());
        manager
            .append_write_stream(&handle, b"stream-bytes")
            .expect("分块送入必须成功");
        let runtime = test_runtime();
        let metadata = runtime
            .block_on(manager.commit_write_stream(handle.clone()))
            .expect("提交必须成功");
        assert_eq!(metadata.size, b"stream-bytes".len() as u64);
        assert!(root.join("notes").join("stream.txt").is_file());

        // commit/abort 的 claim 收口：模拟首次收口后共享状态判闸。
        assert!(shared.claim(), "首次收口必须拿到执行权");
        assert!(!shared.claim(), "重复收口必须被拒");
        let stale = shared.stale_error();
        assert_eq!(stale.code(), "RESOURCE_NOT_FOUND");
        // 陈旧句柄的 backing 口径与 claim 判闸同源。
        let error = manager
            .abort_write_stream(&handle)
            .expect_err("已提交流再中止必须失败");
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_shared_stream_drop_is_zero_leak_fallback() {
        let root = temp_root("drop");
        let manager = fixture_manager();
        let (scope, session) = writable_scope(&manager, &root);
        let handle = manager
            .open_write_stream(WriteStreamRequest {
                session,
                scope: scope.clone(),
                path: write_virtual_path(manager.limits(), &scope, "notes/drop.txt")
                    .expect("在册路径"),
                expected_size: None,
            })
            .expect("写流打开必须成功");
        manager
            .append_write_stream(&handle, b"partial")
            .expect("分块送入必须成功");
        assert_eq!(manager.open_write_stream_count(), 1);
        // 打开的隐藏临时文件（`.chips-tmp-*` 族）在册。
        let temp_before = fs::read_dir(root.join("notes"))
            .expect("目录可读")
            .filter_map(|entry| entry.ok())
            .count();
        assert!(
            temp_before >= 1,
            "打开写流必须在册隐藏临时文件，实得 {temp_before}"
        );

        {
            let shared = Arc::new(SharedStream {
                manager: Arc::clone(&manager),
                handle,
                live: AtomicBool::new(true),
            });
            // GC 兜底路径：Arc 最后一次引用消失且未收口 → Drop 自动 abort。
            drop(shared);
        }
        assert_eq!(
            manager.open_write_stream_count(),
            0,
            "Drop 兜底必须归还写流登记（零泄漏）"
        );
        let temp_after = fs::read_dir(root.join("notes"))
            .expect("目录可读")
            .filter_map(|entry| entry.ok())
            .count();
        assert_eq!(
            temp_after, 0,
            "Drop 兜底后目录不得残留临时文件，目标文件亦不得出现（零残留）"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_release_close_session_and_temp_scope_backing() {
        let manager = fixture_manager();
        // release 幂等（§11.3 `void`）：未在册句柄经 backing 幂等口径——
        // N-1 归属闸状态先行，未知句柄对任意会话恒幂等成功。
        manager
            .release(9_999, UNCLAIMED_SESSION)
            .expect("释放必须幂等成功");
        manager
            .release(9_999, 7_777)
            .expect("未在册未知句柄对任意会话恒幂等");
        // close_session：不存在的会话 → 契约码（绑定层不改写）。
        let error = manager
            .close_session(9_999)
            .expect_err("不存在会话必须失败");
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        // register_temp_scope：目录不存在挂根失败整体回滚（零半挂载）。
        let error = manager
            .register_temp_scope(PathBuf::from("/definitely-missing-from-anywhere"), true)
            .expect_err("不存在目录必须失败");
        assert!(
            error.code().starts_with("RESOURCE_"),
            "挂根失败必须是 RESOURCE_* 契约码：{}",
            error.code()
        );
        let rollback = manager
            .unregister_scope(&"temp-0".to_owned())
            .err()
            .map(|error| error.code().to_owned());
        assert_eq!(
            rollback,
            Some("RESOURCE_NOT_FOUND".to_owned()),
            "回滚后不得留半注册"
        );
    }

    #[test]
    fn test_handle_session_ledger_record_owner_and_forget() {
        // N-1 归属账纯结构面：记账-回取-清账三面与级联清账。
        let mut ledger = HandleSessionLedger::default();
        // 未在册回 None（导出层再经 unwrap_or 落哨兵会话）。
        assert_eq!(ledger.owner_of(404), None);
        ledger.record(1, 100);
        ledger.record(2, 100);
        ledger.record(3, 200);
        assert_eq!(ledger.owner_of(1), Some(100));
        assert_eq!(ledger.owner_of(2), Some(100));
        assert_eq!(ledger.owner_of(3), Some(200));
        // 单句柄清账只摘该句柄、不动同会话其余句柄。
        ledger.forget(1);
        assert_eq!(ledger.owner_of(1), None);
        assert_eq!(ledger.owner_of(2), Some(100));
        // 清空的会话索引自净：forget(2) 后会话 100 名下集消失。
        ledger.forget(2);
        assert!(
            !ledger.sessions.contains_key(&100),
            "空会话集须自净"
        );
        // 级联清账：close_session 摘净该会话名下全部句柄、他会话不受扰。
        ledger.forget_session(200);
        assert_eq!(ledger.owner_of(3), None);
        assert!(ledger.owners.is_empty() && ledger.sessions.is_empty());
        // 幂等：未在册句柄/无句柄会话清账皆为无操作。
        ledger.forget(9_999);
        ledger.forget_session(9_999);
    }

    #[test]
    fn test_handle_session_ledger_sentinel_is_fail_closed_and_never_real() {
        // 哨兵会话永不等真实会话 ID（真实 ID 跨边界受 2^53 约束、
        // `normalize_u64_field` 达 `MAX_SAFE_INTEGER` 即拒，§11.3/§8.2），
        // 未在册经 owner_of_handle 回此值。
        assert!(UNCLAIMED_SESSION > crate::convert::MAX_SAFE_INTEGER);
        let mut ledger = HandleSessionLedger::default();
        let resolved = ledger.owner_of(7).unwrap_or(UNCLAIMED_SESSION);
        assert_eq!(resolved, UNCLAIMED_SESSION, "未在册必落哨兵（fail-closed）");
        // 记账后回取到真实归属、非哨兵。
        ledger.record(7, 42);
        assert_eq!(ledger.owner_of(7).unwrap_or(UNCLAIMED_SESSION), 42);
    }

    #[test]
    fn test_global_ledger_wrappers_round_trip() {
        // 进程级归属账包装函数面：以本测试独占的高段句柄 ID 记账-回取-清账，
        // 避免与并行测试争用（真实运行期 ID 单调递增远低于此段）。
        let handle = u64::MAX - 1_000;
        let session = u64::MAX - 2_000;
        assert_eq!(owner_of_handle(handle), UNCLAIMED_SESSION, "起手未在册");
        record_handle_owner(handle, session);
        assert_eq!(owner_of_handle(handle), session, "记账后回取归属");
        forget_handle_owner(handle);
        assert_eq!(owner_of_handle(handle), UNCLAIMED_SESSION, "清账后回落哨兵");
        // 级联清账路径。
        record_handle_owner(handle, session);
        record_handle_owner(handle + 1, session);
        forget_session_handles(session);
        assert_eq!(owner_of_handle(handle), UNCLAIMED_SESSION);
        assert_eq!(owner_of_handle(handle + 1), UNCLAIMED_SESSION);
    }
}
