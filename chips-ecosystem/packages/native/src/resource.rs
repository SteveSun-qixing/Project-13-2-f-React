//! 资源管理域导出（《04-资源管理设计》§11.3 二十导出，《核心接口规范》§7.3、§8.6）。
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
//! | `resourceMountDirectory` | `ResourceManager::mount_directory`（注册+挂根+绑会话
//!   一体、失败全量回滚；kind 绑定层钉死 `Document`，JS 面无 kind 参数） |
//! | `resourceMountArchive` | `ResourceManager::mount_archive`（只读强制、索引构建
//!   失败整体回滚；kind 绑定层钉死 `Document`） |
//! | `resourceUnregisterScope` | `ResourceManager::unregister_scope`（级联失效句柄/流/
//!   缓存；绑定层补会话归属闸——核心签名无会话参数，《04.11》§11.3 N-1 注记族） |
//! | `resourceLocalPathOf` | `ResourceManager::local_path_of`（正向换算：核心 URI
//!   解析 + `resolve_within_root` 单源复用；会话未绑定 `PERMISSION_DENIED`
//!   先行闸，《04.11》§11.3 波 B 注记） |
//! | `resourceManagedUriOfPath` | `ResourceManager::managed_uri_of_path`（反向换算：
//!   会话已绑定 scope 快照内最长前缀匹配；未命中一律 `null` 不报错，
//!   泄漏免疫口径，RFC §六 C2 裁定实形） |
//!
//! 约定（§8.2、§8.3、§8.5、§11.3、§11.5）：
//!
//! - 进程级单例：`ResourceManager` 以 `Arc` 一次初始化、生命周期与主进程
//!   一致（§11.5）；生产端口载体承接在册（W3 t036 波 A1，RFC-原生承载面
//!   扩表裁定点位一/二）：常驻文档作用域的挂载与注销三项
//!   （`resourceMountDirectory` / `resourceMountArchive` /
//!   `resourceUnregisterScope`）已入导出面，kind 由绑定层钉死
//!   `ScopeKind::Document`（落位即收紧，宿主无法经此入口注册
//!   Workspace/Plugin/Temporary 域）；`managedUri ↔ localPath` 双向换算
//!   （点位三，波 B）已随 `resourceLocalPathOf` / `resourceManagedUriOfPath`
//!   两导出落位；包级原子提交（点位四）候后续波落地，届时随动；
//! - 接线波在册（工单046 段四）：单例构造注入进程级唯一
//!   `NativeDecisionObserver`（与 bridge 单例同一实例，RFC §八条 2），
//!   资源域判定素材经 `auditBindDecisionSink` 绑定的宿主 TS 消费函数
//!   投递（比照 [`crate::bridge::bridge`] 的同款翻正）；测试夹具仍显式
//!   注入 `NoopDecisionObserver`（RFC §八条 1 测试面）；
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
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use chips_core::{ChipsError, PermissionDenyReason};
use chips_resource::provider::ByteRange;
use chips_resource::{
    FsOpRequest, OpenRequest, Origin, ResourceError, ResourceLimits, ResourceManager,
    ResourceMetadata, ScopeKind, ScopePolicy, ScopeRegistration, SessionKind, VirtualPath,
    WriteRequest, WriteStreamHandle, WriteStreamRequest, ARCHIVE_PROVIDER_ID,
    DIRECTORY_PROVIDER_ID,
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
/// 默认值（八字段常量口径，段三主体波已翻正）。
///
/// 接线波翻正在册（工单046 段四，RFC §八条 2）：构造期注入与
/// [`crate::bridge::bridge`] 单例**同一**进程级观察者实例——两 crate
/// 素材流汇入宿主同一消费点，是 §九「单条目单落点」的结构保证。
fn resource_manager() -> Arc<ResourceManager> {
    Arc::clone(RESOURCE_MANAGER.get_or_init(|| {
        Arc::new(ResourceManager::new(
            ResourceLimits::default(),
            crate::audit::decision_observer(),
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

/// `string` 收口（Promise 臂输出规范 `ScopeId` 文本）。
fn settle_string<'a>(cx: &mut Cx<'a>, text: String) -> JsResult<'a, JsValue> {
    let value = cx.string(text);
    Ok(value.upcast())
}

/// `string | null` 收口（点位三反向臂：未命中回 `null` 非错误，§11.3 表行）。
fn settle_optional_string<'a>(cx: &mut Cx<'a>, text: Option<String>) -> JsResult<'a, JsValue> {
    match text {
        Some(value) => settle_string(cx, value),
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

// ---------------------------------------------------------------------------
// 常驻文档作用域挂载与注销（W3 t036 波 A1，RFC 点位一 A1 / 点位二 B2）
// ---------------------------------------------------------------------------

/// 挂载/注销导出共用的「会话闸」拒绝形：与 `chips-resource` 挂载入口
/// （`mount_directory` / `mount_archive` 的会话存在性臂）同构——
/// `RESOURCE_PERMISSION_DENIED`、`details.permission = "session"`、
/// `reason = out_of_scope`、`target` 仅携作用域根 URI（不泄露真实路径，
/// 《06》§7.1 既有口径）。
fn session_gate_denied(scope: &str, missing: Vec<String>, granted: Vec<String>) -> ChipsError {
    ResourceError::PermissionDenied {
        target: format!("chips-resource://{scope}/"),
        permission: "session".to_owned(),
        required: Vec::new(),
        missing,
        granted,
        reason: PermissionDenyReason::OutOfScope,
    }
    .to_chips_error()
}

/// `resourceUnregisterScope` 绑定层会话归属闸：核心 `unregister_scope(scope)`
/// 签名无会话参数（`manager.rs` 在册），绑定层以「调用会话当前已绑定该
/// 作用域」为前置（复用会话注册表既有绑定集判定面，与 `attach_scope` 写入
/// 的集合同源），防止任一带会话调用方枚举注销他域作用域。未绑定/会话不在册
/// → `RESOURCE_PERMISSION_DENIED`（`out_of_scope`）。幂等性依核心实读形——
/// 未在册作用域注销返回 `RESOURCE_NOT_FOUND`（`ScopeRegistry::unregister`），
/// 绑定层不造第二套语义（RFC OQ-4 定案）。
fn require_session_bound(
    manager: &ResourceManager,
    session: u64,
    scope: &str,
) -> Result<(), ChipsError> {
    match manager.sessions().get(session) {
        None => Err(session_gate_denied(scope, Vec::new(), Vec::new())),
        Some(record) if record.scopes.contains(scope) => Ok(()),
        Some(record) => Err(session_gate_denied(
            scope,
            vec![scope.to_owned()],
            record.scopes.iter().cloned().collect(),
        )),
    }
}

/// 文档态 `ScopeRegistration` 绑定层构造：kind 一律钉死
/// [`ScopeKind::Document`]（JS 面无 kind 参数，落位即收紧——宿主无法经
/// 挂载入口注册 Workspace/Plugin/Temporary 域）；`provider_id` 与
/// `read_only` 由各挂载入口显式给定（归档域核心另强制 `read_only = true`
/// 双保险）；`owner` 为宿主侧固定平台服务身份哨兵 `DOCUMENT_SCOPE_OWNER`
/// （取值 `chips.official.document-service`，RFC 裁定G OQ-7 随本波定案，
/// 名与值在册于 `packages/native/README.md` 与《04.11》§11.3 表说明列；
/// 常量定义归宿主文档服务侧随波 A2 落地，绑定层只透传不改制），
/// 大小上限取进程级 `ResourceLimits::max_resource_bytes`（与
/// `register_temp_scope` 折算同源）。
fn document_registration(
    limits: &ResourceLimits,
    scope: String,
    owner: String,
    provider_id: &str,
    origin: Origin,
    read_only: bool,
) -> ScopeRegistration {
    ScopeRegistration {
        scope,
        kind: ScopeKind::Document,
        owner,
        provider_id: provider_id.to_owned(),
        origin,
        policy: ScopePolicy {
            read_only,
            max_resource_bytes: limits.max_resource_bytes,
            allowed_hosts: Vec::new(),
        },
    }
}

/// `resourceMountDirectory(sessionId, scope, path, owner, writable)`：挂载
/// 目录域 Document 作用域（注册 + 挂根 + 绑会话一体，任一步失败核心侧全量
/// 回滚、不留半挂载），返回规范 `ScopeId`（§11.3 异步 `Promise<string>`，
/// 磁盘 IO 经绑定层运行时回投，先例 `resourceCommitWrite`）。
pub(crate) fn js_resource_mount_directory(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let session = arg_or_throw!(id_argument(&mut cx, 0, "/sessionId"), &mut cx);
    let scope = cx.argument::<JsString>(1)?.value(&mut cx);
    let path = cx.argument::<JsString>(2)?.value(&mut cx);
    let owner = cx.argument::<JsString>(3)?.value(&mut cx);
    let writable = cx.argument::<JsBoolean>(4)?.value(&mut cx);
    let manager = resource_manager();
    spawn_work(
        &mut cx,
        move || {
            let registration = document_registration(
                manager.limits(),
                scope,
                owner,
                DIRECTORY_PROVIDER_ID,
                Origin::Directory(PathBuf::from(path)),
                !writable,
            );
            manager
                .mount_directory(session, registration)
                .map_err(|error| error.to_chips_error())
        },
        settle_string,
    )
}

/// `resourceMountArchive(sessionId, scope, path, owner)`：挂载归档域
/// Document 作用域（只读强制——核心 `mount_archive` 翻真
/// `policy.read_only`，绑定层构造即给真，双保险；归档索引构建失败整体
/// 回滚），返回规范 `ScopeId`（§11.3 异步 `Promise<string>`）。
pub(crate) fn js_resource_mount_archive(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let session = arg_or_throw!(id_argument(&mut cx, 0, "/sessionId"), &mut cx);
    let scope = cx.argument::<JsString>(1)?.value(&mut cx);
    let path = cx.argument::<JsString>(2)?.value(&mut cx);
    let owner = cx.argument::<JsString>(3)?.value(&mut cx);
    let manager = resource_manager();
    spawn_work(
        &mut cx,
        move || {
            let registration = document_registration(
                manager.limits(),
                scope,
                owner,
                ARCHIVE_PROVIDER_ID,
                Origin::Archive(PathBuf::from(path)),
                true,
            );
            manager
                .mount_archive(session, registration)
                .map_err(|error| error.to_chips_error())
        },
        settle_string,
    )
}

/// `resourceUnregisterScope(scope, sessionId)`：注销常驻作用域，级联失效
/// 句柄/流/缓存（§11.2 注销级联口径，核心既有形零新语义）。绑定层前置
/// 会话归属闸 [`require_session_bound`]（核心签名无会话参数，RFC 点位二
/// B2 补闸）；§11.3 异步 `Promise<void>`（级联含磁盘侧资源归还）。
pub(crate) fn js_resource_unregister_scope(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let scope = cx.argument::<JsString>(0)?.value(&mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 1, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_work(
        &mut cx,
        move || {
            require_session_bound(&manager, session, &scope)?;
            manager
                .unregister_scope(&scope)
                .map_err(|error| error.to_chips_error())
        },
        settle_undefined,
    )
}

/// `resourceLocalPathOf(uri, sessionId)`：受管引用 → 本地可读路径（点位三
/// 正向换算，W3 波 B，RFC §六 C2）。绑定层薄包装：换算判序（解析单源
/// `resolve_input` → 会话闸 → 作用域查找 → Origin 拼接）全部落
/// `chips-resource::local_path_of`（路径归一与 scope 语法零绑定层二次实现）；
/// 错误经核心在册契约码原样透传（§8.5），磁盘规范化臂经运行时线程回投
/// （§8.3），§11.3 异步 `Promise<string>`。
pub(crate) fn js_resource_local_path_of(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let uri = cx.argument::<JsString>(0)?.value(&mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 1, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_work(
        &mut cx,
        move || {
            manager
                .local_path_of(&uri, session)
                .map_err(|error| error.to_chips_error())
        },
        settle_string,
    )
}

/// `resourceManagedUriOfPath(path, sessionId)`：本地绝对路径 → 规范受管引用
/// （点位三反向换算，绑定会话作用域集内 Origin 最长前缀匹配，含 `temp-*`）。
/// 未命中（路径不存在 / 会话不在册 / 未绑定 / 他会话作用域覆盖，四类一律
/// 同臂）返回 `null` 非错误——零存在性泄露口径即体现在返回形状（RFC §6.1
/// 安全裁定）；§11.3 异步 `Promise<string | null>`。
pub(crate) fn js_resource_managed_uri_of_path(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let path = cx.argument::<JsString>(0)?.value(&mut cx);
    let session = arg_or_throw!(id_argument(&mut cx, 1, "/sessionId"), &mut cx);
    let manager = resource_manager();
    spawn_work(
        &mut cx,
        move || Ok(manager.managed_uri_of_path(Path::new(&path), session)),
        settle_optional_string,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    // 测试面保留 Noop：crate 集成测试默认注入形态（RFC §八条 1）。
    use chips_core::NoopDecisionObserver;
    use chips_resource::handles_of_session;
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
        assert!(!ledger.sessions.contains_key(&100), "空会话集须自净");
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
        // 未在册经 owner_of_handle 回此值。哨兵恒大于真实会话 ID 上界是不变量：
        // 以编译期常量断言承载（零运行时放宽，满足 §8.2 线格式契约的静态自证）。
        const _: () = {
            assert!(UNCLAIMED_SESSION > crate::convert::MAX_SAFE_INTEGER);
        };
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

    // -----------------------------------------------------------------------
    // 挂载/归档/注销三导出锁测（W3 t036 波 A1，RFC 点位一 A1 / 点位二 B2）
    // -----------------------------------------------------------------------

    /// 导出面清单与类型声明的离线只读副本（三方锁机检夹具）。
    const SURFACE_JSON: &str = include_str!("../abi/export-surface.json");
    const DECLARATIONS: &str = include_str!("../types/chips-native.d.ts");

    /// 挂载/注销测试的宿主侧 owner 透传值（测试夹具身份，非生产常量——
    /// 生产哨兵 `DOCUMENT_SCOPE_OWNER`（`chips.official.document-service`）
    /// 名与值已随本波定案在册 README/§11.3，常量定义随波 A2 host 侧落地；
    /// 绑定层对 owner 只透传，本夹具只证透传形）。
    const MOUNT_TEST_OWNER: &str = "chips.official.tests";

    /// 40 hex 前缀的规范文档作用域名（《04.11》§11.3 派生规则的当前口径形）。
    fn document_scope(id: &str) -> String {
        let hash = format!("{id:0<40}");
        format!("card-{hash}")
    }

    /// 绑定层链路完整复刻的目录挂载臂（js 导出体的工作闭包同形）。
    fn mount_directory_via_binding(
        manager: &ResourceManager,
        session: u64,
        scope: &str,
        root: &Path,
        writable: bool,
    ) -> Result<String, ChipsError> {
        let registration = document_registration(
            manager.limits(),
            scope.to_owned(),
            MOUNT_TEST_OWNER.to_owned(),
            DIRECTORY_PROVIDER_ID,
            Origin::Directory(root.to_owned()),
            !writable,
        );
        manager
            .mount_directory(session, registration)
            .map_err(|error| error.to_chips_error())
    }

    /// 绑定层链路完整复刻的归档挂载臂。
    fn mount_archive_via_binding(
        manager: &ResourceManager,
        session: u64,
        scope: &str,
        path: &Path,
    ) -> Result<String, ChipsError> {
        let registration = document_registration(
            manager.limits(),
            scope.to_owned(),
            MOUNT_TEST_OWNER.to_owned(),
            ARCHIVE_PROVIDER_ID,
            Origin::Archive(path.to_owned()),
            true,
        );
        manager
            .mount_archive(session, registration)
            .map_err(|error| error.to_chips_error())
    }

    /// 绑定层链路完整复刻的注销臂（会话闸 + 核心注销）。
    fn unregister_via_binding(
        manager: &ResourceManager,
        session: u64,
        scope: &str,
    ) -> Result<(), ChipsError> {
        require_session_bound(manager, session, scope)?;
        let scope_id = scope.to_owned();
        manager
            .unregister_scope(&scope_id)
            .map_err(|error| error.to_chips_error())
    }

    /// 建带读写权限的文档会话（夹具快捷形）。
    fn mount_session(manager: &ResourceManager, permissions: &[&str]) -> u64 {
        manager
            .open_session(
                SessionKind::Document,
                &MOUNT_TEST_OWNER.to_owned(),
                BTreeSet::new(),
                permissions
                    .iter()
                    .map(|permission| (*permission).to_owned())
                    .collect::<Vec<_>>(),
            )
            .expect("夹具会话创建必须成功")
    }

    /// 错误 `details` 取回（锁测统一入口：拒绝形必须携在册 details 树）。
    fn details_of(error: &ChipsError) -> Value {
        error
            .details()
            .cloned()
            .expect("拒绝错误必须携在册 details")
    }

    /// ZIP Store 条目构造（局部头 + 中央目录记录，偏移由装配函数回填）；
    /// 形制与 `chips-resource` 集成测试夹具同源（写侧对拍先例）。
    fn zip_store_entry(name: &str, data: &[u8]) -> (Vec<u8>, Vec<u8>) {
        fn crc32(data: &[u8]) -> u32 {
            let mut crc: u32 = 0xFFFF_FFFF;
            for byte in data {
                crc ^= u32::from(*byte);
                for _ in 0..8 {
                    crc = if crc & 1 == 1 {
                        (crc >> 1) ^ 0xEDB8_8320
                    } else {
                        crc >> 1
                    };
                }
            }
            !crc
        }
        let name_bytes = name.as_bytes();
        let checksum = crc32(data);
        let mut local = Vec::new();
        local.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
        local.extend_from_slice(&20u16.to_le_bytes());
        local.extend_from_slice(&0x0800u16.to_le_bytes());
        local.extend_from_slice(&0u16.to_le_bytes()); // method = Store
        local.extend_from_slice(&0u16.to_le_bytes());
        local.extend_from_slice(&0x0021u16.to_le_bytes());
        local.extend_from_slice(&checksum.to_le_bytes());
        local.extend_from_slice(&(data.len() as u32).to_le_bytes());
        local.extend_from_slice(&(data.len() as u32).to_le_bytes());
        local.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        local.extend_from_slice(&0u16.to_le_bytes());
        local.extend_from_slice(name_bytes);
        local.extend_from_slice(data);
        let mut central = Vec::new();
        central.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&0x0800u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0x0021u16.to_le_bytes());
        central.extend_from_slice(&checksum.to_le_bytes());
        central.extend_from_slice(&(data.len() as u32).to_le_bytes());
        central.extend_from_slice(&(data.len() as u32).to_le_bytes());
        central.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u32.to_le_bytes());
        central.extend_from_slice(&0u32.to_le_bytes()); // external attrs（可篡改臂）
        central.extend_from_slice(name_bytes);
        (local, central)
    }

    /// 组装完整 Store 归档（中央目录回填真实偏移 + EOCD）。
    fn zip_store_archive(specs: &[(&str, &[u8])]) -> Vec<u8> {
        let entries: Vec<(Vec<u8>, Vec<u8>)> = specs
            .iter()
            .map(|(name, data)| zip_store_entry(name, data))
            .collect();
        let mut archive = Vec::new();
        let mut offsets = Vec::new();
        for (local, _) in &entries {
            offsets.push(archive.len() as u32);
            archive.extend_from_slice(local);
        }
        let central_offset = archive.len() as u32;
        for ((_, central), offset) in entries.iter().zip(&offsets) {
            let mut central = central.clone();
            central[42..46].copy_from_slice(&offset.to_le_bytes());
            archive.extend_from_slice(&central);
        }
        let central_size = archive.len() as u32 - central_offset;
        archive.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        archive.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        archive.extend_from_slice(&central_size.to_le_bytes());
        archive.extend_from_slice(&central_offset.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive
    }

    /// 把首条目中央记录篡改为 UNIX 符号链接（非普通文件条目，解析器
    /// 索引期拒绝臂，《04.03》§3.3 尾部）。
    fn tamper_first_entry_as_symlink(archive: &mut [u8]) {
        let eocd = archive
            .windows(4)
            .rfind(|window| *window == 0x0605_4b50u32.to_le_bytes())
            .expect("EOCD 签名必须在册")
            .as_ptr() as usize
            - archive.as_ptr() as usize;
        let central_offset = u32::from_le_bytes([
            archive[eocd + 16],
            archive[eocd + 17],
            archive[eocd + 18],
            archive[eocd + 19],
        ]) as usize;
        // made-by 高字节 = 3（UNIX），外部属性高 16 位 = S_IFLNK。
        archive[central_offset + 4..central_offset + 6].copy_from_slice(&0x0314u16.to_le_bytes());
        archive[central_offset + 38..central_offset + 42]
            .copy_from_slice(&(0o120_000u32 << 16).to_le_bytes());
    }

    #[test]
    fn test_mount_unregister_surface_entries_locked_in_manifest() {
        // 形状锁①：三导出在清单中的 kind/signature 逐字锁定（参数表逐位、
        // 返回 Promise 形状），与 RFC §4.2/§5.1 逐字表行一字不差。
        let surface: Value = serde_json::from_str(SURFACE_JSON).expect("清单必须合法");
        let exports = surface["exports"].as_array().expect("exports 数组");
        assert_eq!(exports.len(), 55, "波 B 在册全表 55 项");
        assert_eq!(crate::abi::EXPORT_NAMES.len(), 55, "注册表同为 55 项");
        let expected: [(&str, &str, &str); 3] = [
            (
                "resourceMountDirectory",
                "async",
                "(sessionId: number, scope: string, path: string, owner: string, writable: boolean) => Promise<string>",
            ),
            (
                "resourceMountArchive",
                "async",
                "(sessionId: number, scope: string, path: string, owner: string) => Promise<string>",
            ),
            ("resourceUnregisterScope", "async", "(scope: string, sessionId: number) => Promise<void>"),
        ];
        for (name, kind, signature) in expected {
            let entry = exports
                .iter()
                .find(|entry| entry["name"] == name)
                .unwrap_or_else(|| panic!("清单必须收录 {name}"));
            assert_eq!(entry["kind"], kind, "{name} kind 锁定");
            assert_eq!(entry["signature"], signature, "{name} 签名逐字锁定");
            assert!(
                !entry["signature"]
                    .as_str()
                    .is_some_and(|text| text.contains("kind")),
                "{name} 参数表不得暴露 kind（绑定层钉死 Document 的机检）"
            );
        }
        // 资源域位次：三名紧随 `resourceRegisterTempScope`、先于 audit 域。
        let names: Vec<&str> = exports
            .iter()
            .map(|entry| entry["name"].as_str().expect("name 字符串"))
            .collect();
        assert_eq!(names, crate::abi::EXPORT_NAMES, "清单与注册表逐项同序");
        let anchor = names
            .iter()
            .position(|name| *name == "resourceRegisterTempScope")
            .expect("temp 注册导出必须在册");
        assert_eq!(
            &names[anchor + 1..anchor + 4],
            &[
                "resourceMountDirectory",
                "resourceMountArchive",
                "resourceUnregisterScope"
            ],
            "资源域三名同序紧随 temp 注册导出"
        );
    }

    #[test]
    fn test_mount_unregister_surface_declarations_locked_in_d_ts() {
        // 形状锁②：d.ts 声明面与清单/注册表三方一致（名称序列全等），
        // 三声明的参数逐位与返回形状锁定、无 kind 参数。
        let names: Vec<&str> = DECLARATIONS
            .lines()
            .filter_map(|line| line.strip_prefix("export function "))
            .filter_map(|rest| rest.split('(').next())
            .collect();
        assert_eq!(names, crate::abi::EXPORT_NAMES, "d.ts 声明序列与注册表全等");
        let declaration_of = |name: &str| -> String {
            let marker = format!("export function {name}(");
            let start = DECLARATIONS
                .find(&marker)
                .unwrap_or_else(|| panic!("d.ts 必须声明 {name}"));
            let end = DECLARATIONS[start..]
                .find(';')
                .map(|offset| start + offset)
                .expect("声明必须以分号收口");
            DECLARATIONS[start..=end].to_owned()
        };
        let directory = declaration_of("resourceMountDirectory");
        for fragment in [
            "sessionId: number",
            "scope: string",
            "path: string",
            "owner: string",
            "writable: boolean",
            "): Promise<string>;",
        ] {
            assert!(
                directory.contains(fragment),
                "目录挂载声明逐位锁定：{fragment}"
            );
        }
        assert!(
            !directory.contains("kind"),
            "目录挂载声明不得暴露 kind 参数"
        );
        let archive = declaration_of("resourceMountArchive");
        for fragment in [
            "sessionId: number",
            "scope: string",
            "path: string",
            "owner: string",
            "): Promise<string>;",
        ] {
            assert!(
                archive.contains(fragment),
                "归档挂载声明逐位锁定：{fragment}"
            );
        }
        assert!(
            !archive.contains("writable"),
            "归档挂载无 writable（只读强制）"
        );
        assert!(!archive.contains("kind"), "归档挂载声明不得暴露 kind 参数");
        let unregister = declaration_of("resourceUnregisterScope");
        for fragment in ["scope: string", "sessionId: number", "): Promise<void>;"] {
            assert!(
                unregister.contains(fragment),
                "注销声明逐位锁定：{fragment}"
            );
        }
    }

    #[test]
    fn test_document_registration_kind_pinned_and_fields_passthrough() {
        // 形状锁③：绑定层构造面 kind 恒为 Document（JS 面无 kind 参数的落位
        // 即收紧本体）、owner 透传、writable→read_only 折算、归档臂只读恒真、
        // 大小上限与进程级 limits 同源。
        let limits = ResourceLimits::default();
        let directory = document_registration(
            &limits,
            "card-0f3e".to_owned(),
            "chips.official.host".to_owned(),
            DIRECTORY_PROVIDER_ID,
            Origin::Directory(PathBuf::from("/tmp/doc-root")),
            false,
        );
        assert_eq!(directory.kind, ScopeKind::Document, "kind 绑定层钉死");
        assert_eq!(directory.provider_id, DIRECTORY_PROVIDER_ID);
        assert_eq!(directory.owner, "chips.official.host", "owner 只透传不改制");
        assert!(!directory.policy.read_only, "writable=true → 非只读");
        assert_eq!(
            directory.policy.max_resource_bytes,
            limits.max_resource_bytes
        );
        assert!(
            matches!(&directory.origin, Origin::Directory(path) if path == &PathBuf::from("/tmp/doc-root"))
        );
        let read_only = document_registration(
            &limits,
            "box-0f3e".to_owned(),
            "chips.official.host".to_owned(),
            DIRECTORY_PROVIDER_ID,
            Origin::Directory(PathBuf::from("/tmp/doc-root")),
            true,
        );
        assert!(read_only.policy.read_only, "writable=false → 只读折算");
        let archive = document_registration(
            &limits,
            "card-1a2b".to_owned(),
            "chips.official.host".to_owned(),
            ARCHIVE_PROVIDER_ID,
            Origin::Archive(PathBuf::from("/tmp/doc.card")),
            true,
        );
        assert_eq!(archive.kind, ScopeKind::Document);
        assert_eq!(archive.provider_id, ARCHIVE_PROVIDER_ID);
        assert!(
            archive.policy.read_only,
            "归档臂构造即只读（核心翻真双保险）"
        );
        assert!(
            matches!(&archive.origin, Origin::Archive(path) if path == &PathBuf::from("/tmp/doc.card"))
        );
    }

    #[test]
    fn test_mount_directory_success_and_read_only_translation() {
        let root = temp_root("mount-ok");
        let manager = fixture_manager();
        let session = mount_session(&manager, &["resources:read", "resources:write"]);
        let scope = document_scope("0f3e8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f");
        let mounted = mount_directory_via_binding(&manager, session, &scope, &root, true)
            .expect("目录挂载必须成功");
        assert_eq!(mounted, scope, "返回规范 ScopeId（原样收口）");
        assert!(manager.directory_mounted(&scope), "根目录在册");
        let registration = manager.scopes().lookup(&scope).expect("作用域必须注册");
        assert_eq!(registration.kind, ScopeKind::Document);
        assert_eq!(registration.owner, MOUNT_TEST_OWNER);
        assert_eq!(registration.provider_id, DIRECTORY_PROVIDER_ID);
        assert!(!registration.policy.read_only);
        // 挂载即绑创建者会话（`mount_*` 一体形，《06》§3.2）。
        let record = manager.sessions().get(session).expect("会话在册");
        assert!(record.scopes.contains(&scope), "创建者会话已绑定");
        // writable=false 折算：只读目录域写臂必拒（RESOURCE_READ_ONLY）。
        let locked_root = temp_root("mount-locked");
        fs::write(locked_root.join("a.txt"), b"seed").expect("夹具文件");
        let locked_scope = document_scope("1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b");
        mount_directory_via_binding(&manager, session, &locked_scope, &locked_root, false)
            .expect("只读目录挂载必须成功");
        let error = test_runtime()
            .block_on(manager.commit_write(WriteRequest {
                session,
                scope: locked_scope.clone(),
                path:
                    write_virtual_path(manager.limits(), &locked_scope, "a.txt").expect("在册路径"),
                bytes: b"rewrite".to_vec(),
            }))
            .expect_err("只读挂载就地写必须拒绝");
        assert_eq!(error.code(), "RESOURCE_READ_ONLY");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&locked_root);
    }

    #[test]
    fn test_mount_directory_error_arms_and_no_path_leak() {
        let root = temp_root("mount-arms");
        let manager = fixture_manager();
        let session = mount_session(&manager, &["resources:read"]);
        // 会话不存在 → PERMISSION_DENIED（reason = out_of_scope，target 只携
        // 作用域根 URI）。
        let ghost_scope = document_scope("aaaa");
        let error = mount_directory_via_binding(&manager, 9_999, &ghost_scope, &root, true)
            .expect_err("无会话挂载必须拒绝");
        assert_eq!(error.code(), "RESOURCE_PERMISSION_DENIED");
        assert_eq!(details_of(&error)["reason"], "out_of_scope");
        assert_eq!(details_of(&error)["permission"], "session");
        // 根缺失 → NOT_FOUND，细节只携作用域 URI、不泄露真实路径。
        let missing = root.join("secret-missing-dir-4f7e");
        let error = mount_directory_via_binding(&manager, session, &ghost_scope, &missing, true)
            .expect_err("缺失根必须拒绝");
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        assert_eq!(
            details_of(&error)["uri"],
            format!("chips-resource://{ghost_scope}/")
        );
        assert!(
            !error.message().contains("secret-missing-dir-4f7e"),
            "错误文本不得携真实路径"
        );
        // 根存在但非目录 → 同款 NOT_FOUND。
        fs::write(root.join("secret-plain-file"), b"x").expect("夹具文件");
        let error = mount_directory_via_binding(
            &manager,
            session,
            &ghost_scope,
            &root.join("secret-plain-file"),
            true,
        )
        .expect_err("非目录根必须拒绝");
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        assert!(
            !error.message().contains("secret-plain-file"),
            "错误文本不得携真实路径"
        );
        // 重复挂载 → ALREADY_EXISTS。
        let scope = document_scope("bbbb");
        mount_directory_via_binding(&manager, session, &scope, &root, true)
            .expect("首次挂载必须成功");
        let error = mount_directory_via_binding(&manager, session, &scope, &root, true)
            .expect_err("重复挂载必须拒绝");
        assert_eq!(error.code(), "RESOURCE_ALREADY_EXISTS");
        // scope 命名违例（非在册前缀）→ INVALID_URI（malformed_scope）。
        let error = mount_directory_via_binding(&manager, session, "rogue-scope", &root, true)
            .expect_err("非在册命名必须拒绝");
        assert_eq!(error.code(), "RESOURCE_INVALID_URI");
        assert_eq!(details_of(&error)["reason"], "malformed_scope");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_mount_directory_kind_forced_rejection_and_rollback() {
        // 落位即收紧机检：JS 传 workspace 前缀名也注册不了 Workspace 域
        // （kind 绑定层钉死 Document，前缀-种类匹配由核心校验臂兜底拒绝），
        // 且中途失败不留半挂载：根 detach 后重试仍挂命名错而非 ALREADY_EXISTS。
        let root = temp_root("mount-rollback");
        let manager = fixture_manager();
        let session = mount_session(&manager, &["resources:read"]);
        for bad_scope in ["workspace-abc", "plugin-doc", "rogue-x"] {
            let error = mount_directory_via_binding(&manager, session, bad_scope, &root, true)
                .expect_err("命名/种类违例必须拒绝");
            assert_eq!(error.code(), "RESOURCE_INVALID_URI");
            assert!(
                !manager.directory_mounted(&bad_scope.to_owned()),
                "失败回滚不得留半挂载根：{bad_scope}"
            );
            assert!(manager.scopes().lookup(bad_scope).is_none(), "不得留半注册");
            // 重投同 scope：仍挂命名错（若根未 detach 会先挂 ALREADY_EXISTS）。
            let retry = mount_directory_via_binding(&manager, session, bad_scope, &root, true)
                .expect_err("重试必须仍拒");
            assert_eq!(
                retry.code(),
                "RESOURCE_INVALID_URI",
                "零残留判别臂：{bad_scope}"
            );
        }
        // 会话无效中途失败：根未 detach 与否以「后续有效会话可挂」判别。
        let pending_scope = document_scope("cccc");
        let error = mount_directory_via_binding(&manager, 8_888, &pending_scope, &root, true)
            .expect_err("无效会话必须先行拒绝");
        assert_eq!(error.code(), "RESOURCE_PERMISSION_DENIED");
        assert!(!manager.directory_mounted(&pending_scope));
        mount_directory_via_binding(&manager, session, &pending_scope, &root, true)
            .expect("有效会话重挂同 scope 必须成功（前次零残留）");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_mount_archive_success_with_forced_read_only() {
        let root = temp_root("archive-ok");
        let archive_path = root.join("doc.card");
        let bytes = zip_store_archive(&[("content/", b""), ("content/note.txt", b"hello zip")]);
        fs::write(&archive_path, &bytes).expect("夹具归档必须可写");
        let manager = fixture_manager();
        let session = mount_session(&manager, &["resources:read", "resources:write"]);
        let scope = document_scope("dddd");
        let mounted = mount_archive_via_binding(&manager, session, &scope, &archive_path)
            .expect("归档挂载必须成功");
        assert_eq!(mounted, scope);
        let registration = manager.scopes().lookup(&scope).expect("作用域必须注册");
        assert_eq!(registration.kind, ScopeKind::Document);
        assert_eq!(registration.provider_id, ARCHIVE_PROVIDER_ID);
        assert!(registration.policy.read_only, "只读强制未被绕过");
        // 挂载后经写路径必拒（只读强制锁）。
        let error = test_runtime()
            .block_on(
                manager.commit_write(WriteRequest {
                    session,
                    scope: scope.clone(),
                    path: write_virtual_path(manager.limits(), &scope, "content/note.txt")
                        .expect("在册路径"),
                    bytes: b"overwrite".to_vec(),
                }),
            )
            .expect_err("归档域就地写必须拒绝");
        assert_eq!(error.code(), "RESOURCE_READ_ONLY");
        // 读侧在册（既有面可组合承载列举，《06.02》§6.2 口径）。
        let entries = test_runtime()
            .block_on(manager.list_directory(OpenRequest {
                uri: format!("chips-resource://{scope}/content"),
                session,
            }))
            .expect("归档列举必须成功");
        assert!(entries.iter().any(|entry| entry.name == "note.txt"));
        // 重复挂载 → ALREADY_EXISTS。
        let error = mount_archive_via_binding(&manager, session, &scope, &archive_path)
            .expect_err("重复归档挂载必须拒绝");
        assert_eq!(error.code(), "RESOURCE_ALREADY_EXISTS");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_mount_archive_error_arms() {
        let root = temp_root("archive-arms");
        let manager = fixture_manager();
        let session = mount_session(&manager, &["resources:read"]);
        let scope = document_scope("eeee");
        // 会话不存在 → PERMISSION_DENIED（与目录域同臂）。
        let error = mount_archive_via_binding(&manager, 9_999, &scope, &root.join("absent.card"))
            .expect_err("无会话归档挂载必须拒绝");
        assert_eq!(error.code(), "RESOURCE_PERMISSION_DENIED");
        assert_eq!(details_of(&error)["reason"], "out_of_scope");
        // 归档缺失 → NOT_FOUND（细节只携作用域 URI）。
        let missing = root.join("secret-absent.card");
        let error = mount_archive_via_binding(&manager, session, &scope, &missing)
            .expect_err("缺失归档必须拒绝");
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        assert_eq!(
            details_of(&error)["uri"],
            format!("chips-resource://{scope}/")
        );
        assert!(!error.message().contains("secret-absent"));
        // 坏归档（非 ZIP 结构）→ INTERNAL 兜底。
        fs::write(root.join("junk.card"), b"not-a-zip-at-all").expect("夹具写入");
        let error = mount_archive_via_binding(&manager, session, &scope, &root.join("junk.card"))
            .expect_err("坏归档必须拒绝");
        assert_eq!(error.code(), "RESOURCE_INTERNAL");
        // 含非普通文件条目（UNIX 符号链接成员）→ 索引期拒绝 → INTERNAL，
        // 且零残留（后续合法挂载可成）。
        let mut symlink_archive = zip_store_archive(&[("content/link.txt", b"x")]);
        tamper_first_entry_as_symlink(&mut symlink_archive);
        fs::write(root.join("link.card"), &symlink_archive).expect("夹具写入");
        let error = mount_archive_via_binding(&manager, session, &scope, &root.join("link.card"))
            .expect_err("非普通文件条目必须拒绝");
        assert_eq!(error.code(), "RESOURCE_INTERNAL");
        assert!(
            manager.scopes().lookup(&scope).is_none(),
            "坏归档不得留半注册"
        );
        let good = zip_store_archive(&[("content/note.txt", b"ok")]);
        fs::write(root.join("good.card"), &good).expect("夹具写入");
        mount_archive_via_binding(&manager, session, &scope, &root.join("good.card"))
            .expect("坏归档回滚后合法挂载必须成功（零残留）");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_unregister_scope_gate_cascade_and_double_arm() {
        let root = temp_root("unregister");
        fs::write(root.join("a.txt"), b"hello").expect("夹具文件");
        let manager = fixture_manager();
        let owner_session = mount_session(&manager, &["resources:read", "resources:write"]);
        let other_session = mount_session(&manager, &["resources:read", "resources:write"]);
        let scope = document_scope("ffff");
        mount_directory_via_binding(&manager, owner_session, &scope, &root, true)
            .expect("挂载必须成功");
        // 名下开一个在册句柄（级联失效面输入）。
        let runtime = test_runtime();
        let opened = runtime
            .block_on(manager.open(OpenRequest {
                uri: format!("chips-resource://{scope}/a.txt"),
                session: owner_session,
            }))
            .expect("句柄打开必须成功");
        assert_eq!(
            handles_of_session(&manager, owner_session),
            vec![opened.id],
            "级联失效面输入：名下句柄在册"
        );
        // 他会话注销必拒（双会话锁测）：out_of_scope + missing 携作用域。
        let error = unregister_via_binding(&manager, other_session, &scope)
            .expect_err("他会话注销必须拒绝");
        assert_eq!(error.code(), "RESOURCE_PERMISSION_DENIED");
        assert_eq!(details_of(&error)["reason"], "out_of_scope");
        assert_eq!(details_of(&error)["missing"][0], scope.as_str());
        assert!(
            manager.scopes().lookup(&scope).is_some(),
            "拒绝不得破坏在册作用域"
        );
        assert!(
            unregister_via_binding(&manager, 7_777, &scope).is_err(),
            "幽灵会话必拒"
        );
        // 本会话注销成功且级联失效（句柄/注册表/根三面）。
        unregister_via_binding(&manager, owner_session, &scope).expect("本会话注销必须成功");
        assert!(manager.scopes().lookup(&scope).is_none());
        assert!(!manager.directory_mounted(&scope));
        assert!(
            handles_of_session(&manager, owner_session).is_empty(),
            "注销必须级联失效名下句柄"
        );
        // 核心幂等实读形双向锁定（OQ-4）：绑定闸形——重复注销经闸拒
        // （绑定集已级联摘除）；核心形——直挂未在册作用域回 NOT_FOUND。
        let error = unregister_via_binding(&manager, owner_session, &scope)
            .expect_err("重复注销（绑定层形）必须拒绝");
        assert_eq!(error.code(), "RESOURCE_PERMISSION_DENIED");
        let core_error = manager
            .unregister_scope(&scope)
            .expect_err("重复注销（核心形）必须失败");
        assert_eq!(core_error.code(), "RESOURCE_NOT_FOUND");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_mount_scope_naming_arms_document_domain() {
        // 命名违例逐臂锁（波 A1 覆盖面⑧ + 裁决I③ 注册面语法强制随动收紧）：
        // 文档域三种违例形态逐一在册——
        // ① 非 `card-`/`box-` 前缀：核心注册命名臂即时拒绝
        //    `RESOURCE_INVALID_URI`（`malformed_scope`），零半挂载（在册
        //    arms 测试与回滚测试双侧锁定，此处补 box 位）；
        // ② 混入大写与 ③ 超 64 字符：裁决I③ 后与 ① 同臂族拒绝——
        //    `ScopeRegistration::validate` 命名前缀之后过单源谓词
        //    `is_valid_scope_syntax`（判据与 URI 面《06.02》§2.3 同源），
        //    注册阶段即拒 `RESOURCE_INVALID_URI`（`malformed_scope`），
        //    零注册、零半挂载；URI 面断言语义随动保留——混大写名经解析
        //    ASCII 小写归一后失配注册表恒 `RESOURCE_NOT_FOUND`（不可达），
        //    超长名过 `validate_scope_syntax` 的 64 预算闸恒
        //    `RESOURCE_INVALID_URI`（`malformed_scope`）；两态名对注销闸
        //    从未绑定恒 `RESOURCE_PERMISSION_DENIED` 拒（两面零残留）。
        //    生产臂永不触达：《04.11》§11.3 派生规则保证小写 40 hex
        //    （总长 45 ≤ 64），天然合 `[a-z][a-z0-9-]*`，注册面语法强制
        //    与生产派生形口径一致。
        let root = temp_root("naming-arms");
        fs::write(root.join("a.txt"), b"hello").expect("夹具文件");
        let manager = fixture_manager();
        let session = mount_session(&manager, &["resources:read"]);
        let runtime = test_runtime();
        // ① 前缀违例（box 位补臂）：注册臂拒绝、不留注册。
        let error = mount_directory_via_binding(&manager, session, "boxes-0f3e", &root, true)
            .expect_err("box 近似前缀必须拒绝");
        assert_eq!(error.code(), "RESOURCE_INVALID_URI");
        assert_eq!(details_of(&error)["reason"], "malformed_scope");
        assert!(manager.scopes().lookup("boxes-0f3e").is_none());
        // ② 混入大写：注册面语法臂即时拒绝（裁决I③ 收紧形），零半挂载；
        //    URI 面小写归一后失配注册表恒不可达（NOT_FOUND 语义随动保留）；
        //    注销闸对从未绑定名拒绝、零残留。
        let upper = format!("card-{}", "0F3E".repeat(10));
        let error = mount_directory_via_binding(&manager, session, &upper, &root, true)
            .expect_err("大写混入名注册阶段必须拒绝（语法臂收紧形）");
        assert_eq!(error.code(), "RESOURCE_INVALID_URI");
        assert_eq!(details_of(&error)["reason"], "malformed_scope");
        assert!(
            manager.scopes().lookup(&upper).is_none(),
            "语法拒绝不得留注册项"
        );
        assert!(!manager.directory_mounted(&upper), "语法拒绝不得留半挂载根");
        let error = runtime
            .block_on(manager.list_directory(OpenRequest {
                uri: format!("chips-resource://{upper}/a.txt"),
                session,
            }))
            .expect_err("大写作用域名对 URI 面必须不可达");
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        let error = unregister_via_binding(&manager, session, &upper)
            .expect_err("未注册的违例名对注销闸必须拒绝（从未绑定）");
        assert_eq!(error.code(), "RESOURCE_PERMISSION_DENIED");
        assert!(manager.scopes().lookup(&upper).is_none(), "两面零残留");
        // ③ 超 64 字符：同款注册阶段拒绝（64 预算臂）；URI 面 64 预算闸
        //    拒绝臂随动保留，注销闸同款拒绝、零残留。
        let overlong = format!("box-{}", "a".repeat(70));
        assert!(overlong.len() > 64, "夹具必须越 64 预算");
        let error = mount_directory_via_binding(&manager, session, &overlong, &root, true)
            .expect_err("超长名注册阶段必须拒绝（语法臂收紧形）");
        assert_eq!(error.code(), "RESOURCE_INVALID_URI");
        assert_eq!(details_of(&error)["reason"], "malformed_scope");
        assert!(
            manager.scopes().lookup(&overlong).is_none(),
            "语法拒绝不得留注册项"
        );
        let error = runtime
            .block_on(manager.open(OpenRequest {
                uri: format!("chips-resource://{overlong}/a.txt"),
                session,
            }))
            .expect_err("超长作用域名对 URI 面必须不可达");
        assert_eq!(error.code(), "RESOURCE_INVALID_URI");
        assert_eq!(details_of(&error)["reason"], "malformed_scope");
        let error = unregister_via_binding(&manager, session, &overlong)
            .expect_err("未注册的超长名对注销闸必须拒绝（从未绑定）");
        assert_eq!(error.code(), "RESOURCE_PERMISSION_DENIED");
        assert!(
            !manager.directory_mounted(&overlong),
            "拒绝与闸面拒绝后均不得留半挂载根"
        );
        // 合法形对照：小写 `card-` + 40 hex（总长 45 ≤ 64）可达。
        let canonical = document_scope("0f3e8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f");
        mount_directory_via_binding(&manager, session, &canonical, &root, true)
            .expect("规范派生名必须可挂载");
        let opened = runtime
            .block_on(manager.open(OpenRequest {
                uri: format!("chips-resource://{canonical}/a.txt"),
                session,
            }))
            .expect("规范派生名对 URI 面必须可达");
        assert_eq!(opened.metadata.size, b"hello".len() as u64);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_register_scope_syntax_uppercase_lower_pair() {
        // 注册面语法强制「精确性」锁（裁决I③）：混大写形注册阶段拒绝，
        // 其归一小写对照形同场放行且 URI 面可达——两形过命名前缀、
        // 前缀-种类、(kind, origin) 三臂全等，唯一分叉在语法臂，
        // 证明拒绝来自《06.02》§2.3 语法本身而非其它臂误伤。
        let root = temp_root("syntax-upper-pair");
        fs::write(root.join("a.txt"), b"hello").expect("夹具文件");
        let manager = fixture_manager();
        let session = mount_session(&manager, &["resources:read"]);
        let runtime = test_runtime();
        let upper = document_scope("0F3E8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f");
        let error = mount_directory_via_binding(&manager, session, &upper, &root, true)
            .expect_err("混大写名注册阶段必须拒绝");
        assert_eq!(error.code(), "RESOURCE_INVALID_URI");
        assert_eq!(details_of(&error)["reason"], "malformed_scope");
        assert!(manager.scopes().lookup(&upper).is_none());
        assert!(!manager.directory_mounted(&upper), "拒绝不得留半挂载根");
        let lower = document_scope("0f3e8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f");
        mount_directory_via_binding(&manager, session, &lower, &root, true)
            .expect("全小写对照名必须可注册挂载");
        let opened = runtime
            .block_on(manager.open(OpenRequest {
                uri: format!("chips-resource://{lower}/a.txt"),
                session,
            }))
            .expect("全小写对照名对 URI 面必须可达");
        assert_eq!(opened.metadata.size, b"hello".len() as u64);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_register_scope_syntax_length_boundary() {
        // 注册面语法强制「长度预算」锁（裁决I③）：64 字符恰等名注册
        // 放行且 URI 面可达（生产派生形总长 45，同预算带内），65 字符
        // 名注册阶段拒绝 `malformed_scope`、零注册零半挂载——与 URI 面
        // `validate_scope_syntax` 单源判据同预算边界。
        let root = temp_root("syntax-len-boundary");
        fs::write(root.join("a.txt"), b"hello").expect("夹具文件");
        let manager = fixture_manager();
        let session = mount_session(&manager, &["resources:read"]);
        let runtime = test_runtime();
        let at_limit = format!("box-{}", "a".repeat(60));
        assert_eq!(at_limit.len(), 64, "夹具必须恰等 64 预算上界");
        mount_directory_via_binding(&manager, session, &at_limit, &root, true)
            .expect("恰等 64 字符名注册阶段必须放行");
        let opened = runtime
            .block_on(manager.open(OpenRequest {
                uri: format!("chips-resource://{at_limit}/a.txt"),
                session,
            }))
            .expect("恰等 64 字符名对 URI 面必须可达");
        assert_eq!(opened.metadata.size, b"hello".len() as u64);
        let over_limit = format!("box-{}", "a".repeat(61));
        assert_eq!(over_limit.len(), 65, "夹具必须越预算恰 1 字符");
        let error = mount_directory_via_binding(&manager, session, &over_limit, &root, true)
            .expect_err("65 字符名注册阶段必须拒绝");
        assert_eq!(error.code(), "RESOURCE_INVALID_URI");
        assert_eq!(details_of(&error)["reason"], "malformed_scope");
        assert!(manager.scopes().lookup(&over_limit).is_none());
        assert!(
            !manager.directory_mounted(&over_limit),
            "拒绝不得留半挂载根"
        );
        let _ = fs::remove_dir_all(&root);
    }

    // -----------------------------------------------------------------------
    // 双向换算两导出锁测（W3 t036 波 B，RFC §六 C2 裁定：点位三
    // `managedUri ↔ localPath` 单源双向换算；形状锁 + 链路锁 + 四类负例）
    // -----------------------------------------------------------------------

    /// 绑定层链路完整复刻的正向臂（`js_resource_local_path_of` 工作闭包同形：
    /// 核心换算 + `to_chips_error` 错误归一，§8.5 契约码原样透传）。
    fn local_path_of_via_binding(
        manager: &ResourceManager,
        uri: &str,
        session: u64,
    ) -> Result<String, ChipsError> {
        manager
            .local_path_of(uri, session)
            .map_err(|error| error.to_chips_error())
    }

    /// 绑定层链路完整复刻的反向臂（`js_resource_managed_uri_of_path` 工作
    /// 闭包同形：未命中 `None` → JS `null`，不报错、不区分成因）。
    fn managed_uri_of_path_via_binding(
        manager: &ResourceManager,
        path: &Path,
        session: u64,
    ) -> Option<String> {
        manager.managed_uri_of_path(path, session)
    }

    #[test]
    fn test_local_path_conversion_surface_locked_in_manifest() {
        // 形状锁①（波 B）：两换算导出在清单中的 kind/signature 逐字锁定
        // （RFC §六 C2 在册实形），位次紧随 `resourceUnregisterScope`、
        // 先于 audit 域收尾项。
        let surface: Value = serde_json::from_str(SURFACE_JSON).expect("清单必须合法");
        let exports = surface["exports"].as_array().expect("exports 数组");
        let expected: [(&str, &str, &str); 2] = [
            (
                "resourceLocalPathOf",
                "async",
                "(uri: string, sessionId: number) => Promise<string>",
            ),
            (
                "resourceManagedUriOfPath",
                "async",
                "(path: string, sessionId: number) => Promise<string | null>",
            ),
        ];
        for (name, kind, signature) in expected {
            let entry = exports
                .iter()
                .find(|entry| entry["name"] == name)
                .unwrap_or_else(|| panic!("清单必须收录 {name}"));
            assert_eq!(entry["kind"], kind, "{name} kind 锁定");
            assert_eq!(entry["signature"], signature, "{name} 签名逐字锁定");
        }
        let names: Vec<&str> = exports
            .iter()
            .map(|entry| entry["name"].as_str().expect("name 字符串"))
            .collect();
        assert_eq!(names, crate::abi::EXPORT_NAMES, "清单与注册表逐项同序");
        let anchor = names
            .iter()
            .position(|name| *name == "resourceUnregisterScope")
            .expect("注销导出必须在册");
        assert_eq!(
            &names[anchor + 1..anchor + 3],
            &["resourceLocalPathOf", "resourceManagedUriOfPath"],
            "资源域换算两名同序紧随注销导出"
        );
        assert_eq!(
            names[anchor + 3],
            "auditBindDecisionSink",
            "换算两名之后即 audit 域收尾项"
        );
    }

    #[test]
    fn test_local_path_conversion_declarations_locked_in_d_ts() {
        // 形状锁②（波 B）：d.ts 两声明的参数逐位与返回形状锁定（正向
        // `Promise<string>`、反向 `Promise<string | null>`——未命中 `null`
        // 形即 RFC §6.1 泄漏免疫裁定的类型面承载）。
        let declaration_of = |name: &str| -> String {
            let marker = format!("export function {name}(");
            let start = DECLARATIONS
                .find(&marker)
                .unwrap_or_else(|| panic!("d.ts 必须声明 {name}"));
            let end = DECLARATIONS[start..]
                .find(';')
                .map(|offset| start + offset)
                .expect("声明必须以分号收口");
            DECLARATIONS[start..=end].to_owned()
        };
        let forward = declaration_of("resourceLocalPathOf");
        for fragment in ["uri: string", "sessionId: number", "): Promise<string>;"] {
            assert!(
                forward.contains(fragment),
                "正向换算声明逐位锁定：{fragment}"
            );
        }
        let reverse = declaration_of("resourceManagedUriOfPath");
        for fragment in [
            "path: string",
            "sessionId: number",
            "): Promise<string | null>;",
        ] {
            assert!(
                reverse.contains(fragment),
                "反向换算声明逐位锁定：{fragment}"
            );
        }
    }

    #[test]
    fn test_local_path_conversion_chain_and_negative_arms_via_binding() {
        // 链路锁（波 B）：正向/反向互逆回环 + 四类负例（不存在/未挂载/
        // 越权/陈旧）错误码取在册码值零新码；Memory Origin 换算臂
        // `NOT_SUPPORTED` 操作词就近归入 `list`（六词封闭禁新词锁）。
        let manager = fixture_manager();
        let root = temp_root("conv-chain");
        fs::create_dir_all(root.join("notes")).expect("夹具子目录");
        fs::write(root.join("notes/a.md"), b"chain").expect("夹具文件");
        let session = mount_session(&manager, &["resources:read"]);
        let scope = document_scope("c0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffee");
        mount_directory_via_binding(&manager, session, &scope, &root, true)
            .expect("换算夹具目录挂载必须成功");
        // 正向成功臂 + 回环互逆：URI → 本地路径 → URI 同字回原位。
        let uri = format!("chips-resource://{scope}/notes/a.md");
        let local = local_path_of_via_binding(&manager, &uri, session).expect("正向换算必须成功");
        assert_eq!(
            PathBuf::from(&local),
            root.join("notes/a.md"),
            "正向产物为 Origin 根 + 相对段拼接（与核心成员形同判）"
        );
        assert_eq!(
            managed_uri_of_path_via_binding(&manager, Path::new(&local), session),
            Some(uri.clone()),
            "回环互逆：反向必须原样回到正向规范 URI"
        );
        // 反向着陆根：目录根回作用域基址形。
        assert_eq!(
            managed_uri_of_path_via_binding(
                &manager,
                &fs::canonicalize(&root).expect("夹具根可规范化"),
                session
            ),
            Some(format!("chips-resource://{scope}/")),
            "根路径反回作用域基址形"
        );
        // 负例①不存在（反向臂）：绑定会话下不存在路径反查 → `None`（不报错、
        // 不区分成因，RFC §6.1 泄漏免疫裁定；正向成员缺失段是 `resolve_within_root`
        // 拼接合法形——「另存为」预览面，与核心同源，不作负例）。
        assert_eq!(
            managed_uri_of_path_via_binding(&manager, &root.join("absent.md"), session),
            None,
            "不存在路径反查必须未命中"
        );
        // 负例②未挂载（陈旧登记缺位）：合法语法作用域不在册 → NOT_FOUND。
        let ghost = document_scope("deadbeef");
        let mut ghost_scopes = BTreeSet::new();
        ghost_scopes.insert(ghost.clone());
        let ghost_session = manager
            .open_session(
                SessionKind::Document,
                &MOUNT_TEST_OWNER.to_owned(),
                ghost_scopes,
                vec!["resources:read".to_owned()],
            )
            .expect("幽灵绑定夹具会话必须创建");
        let error = local_path_of_via_binding(
            &manager,
            &format!("chips-resource://{ghost}/x.md"),
            ghost_session,
        )
        .expect_err("未挂载作用域必须拒绝");
        assert_eq!(error.code(), "RESOURCE_NOT_FOUND");
        // 负例③越权：会话在册但未绑定 → PERMISSION_DENIED（out_of_scope，
        // target 仅作用域根 URI，零真实路径泄漏）。
        let stranger = mount_session(&manager, &["resources:read"]);
        let error = local_path_of_via_binding(&manager, &uri, stranger).expect_err("越权必须拒绝");
        assert_eq!(error.code(), "RESOURCE_PERMISSION_DENIED");
        let details = details_of(&error);
        assert_eq!(details["reason"], "out_of_scope");
        assert_eq!(details["target"], format!("chips-resource://{scope}/"));
        assert!(
            !details
                .to_string()
                .contains(root.to_string_lossy().as_ref()),
            "拒绝回执不得泄露真实路径"
        );
        // 负例④陈旧：注销级联摘除绑定后再换算 → 会话闸先行为 PERMISSION_DENIED
        // （《04.11》§11.3 在册双形口径的绑定先例形）。
        unregister_via_binding(&manager, session, &scope).expect("夹具注销必须成功");
        let error = local_path_of_via_binding(&manager, &uri, session).expect_err("陈旧必须拒绝");
        assert_eq!(error.code(), "RESOURCE_PERMISSION_DENIED");
        // 非本地 Origin 臂：Memory 挂载换算 → NOT_SUPPORTED，操作词
        // 就近归入 `list`（词表六词封闭，禁新词锁）。
        manager
            .mount_memory(session)
            .expect("Memory 挂载夹具必须成功");
        let error = local_path_of_via_binding(&manager, "chips-resource://memory/x", session)
            .expect_err("Memory Origin 无本地可读位置");
        assert_eq!(error.code(), "RESOURCE_NOT_SUPPORTED");
        assert_eq!(
            details_of(&error)["operation"],
            "list",
            "禁新词锁：在册六词就近归入"
        );
        // 非受管 scheme 与非法语法在绑定链路维持在册码值（零新码）。
        let error = local_path_of_via_binding(&manager, "file:///tmp/whatever", session)
            .expect_err("file:// 必须拒收");
        assert_eq!(error.code(), "RESOURCE_UNSUPPORTED_SCHEME");
        let error = local_path_of_via_binding(&manager, "notes/a.md", session)
            .expect_err("无 scheme 输入必须拒绝");
        assert_eq!(error.code(), "RESOURCE_INVALID_URI");
        // 反向四类未命中一律 `None`（JS `null`）：不存在路径/会话不在册/
        // 无绑定会话/他域路径，零信息泄漏口径。
        assert_eq!(
            managed_uri_of_path_via_binding(&manager, &root.join("notes/a.md"), session),
            None,
            "注销后原覆盖路径反查未命中"
        );
        assert_eq!(
            managed_uri_of_path_via_binding(
                &manager,
                Path::new("/definitely/not/there.md9"),
                987_654
            ),
            None,
            "不在册会话反查未命中"
        );
        assert_eq!(
            managed_uri_of_path_via_binding(&manager, Path::new(&root), stranger),
            None,
            "越权会话反查未命中"
        );
        let _ = fs::remove_dir_all(&root);
    }
}
