//! Bridge 能力导出（`bridgeRegister` / `bridgeUnregister` / `bridgeRequest` /
//! `bridgeCancelSession`，《核心接口规范》§5、§8.6）。
//!
//! 绑定层只做参数解析、`{ json, bin }` 信封编解码、错误归一与线程回投；
//! 注册表、权限判定、Schema 校验、并发准入与超时取消语义全部由
//! `chips-bridge` 内核承载（进程级单例共享，[`bridge`]）。
//!
//! TS 能力的执行以 [`TsCapabilityExecutor`] 包装：内核在 tokio 工作线程发起
//! 调用后，经 `Channel` 回投 JS 线程执行 `handler`（§8.3 线程约束），Rust 侧
//! 以 `JsPromise::to_future`（§8.3 规则 7）await 其 Promise 结果；执行期经
//! `ctx.signal`（JS 原生 `AbortSignal`）与 `ctx.deadline`（Unix epoch 毫秒）
//! 传达取消与截止（§5.3 形态）。JS 异常经
//! [`crate::error::chips_error_from_js`] 按 §8.5 反向归一为 `ChipsError`。

use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, Concurrency, BRIDGE_CANCELLED,
};
use chips_core::ChipsError;
use neon::prelude::*;
use neon::types::JsFuture;

use crate::convert::{js_to_json, ConvertIssue};
use crate::envelope::{
    bin_from_js, js_with_bin_to_json, json_with_bin_to_js, validate_bin_table,
    ENVELOPE_INVALID_INPUT_CODE,
};
use crate::error::{
    chips_error_from_js, internal_error, throw_chips_error, type_unsupported, value_out_of_range,
};

/// JS handler 的归一执行结果：成功为输出信封（二进制已抽取进 `bin` 表）。
type HandlerOutcome = Result<CapabilityOutput, ChipsError>;

/// 进程级 Bridge 内核单例；`Bridge` 为 `Arc` 句柄（`Clone` 共享同一状态），
/// 注册表与会话表在全进程唯一。
static BRIDGE: OnceLock<Bridge> = OnceLock::new();

/// 取进程级 Bridge 内核句柄。
pub(crate) fn bridge() -> Bridge {
    BRIDGE.get_or_init(Bridge::new).clone()
}

/// 解析 JS 侧 `concurrency` 字段（§5.3 形态：`'parallel' | 'serial'`）。
#[must_use]
pub(crate) fn parse_concurrency(raw: &str) -> Option<Concurrency> {
    match raw {
        "parallel" => Some(Concurrency::Parallel),
        "serial" => Some(Concurrency::Serial),
        _ => None,
    }
}

/// 把 JS `number` 归一为非负整数 `u64`（有限、整值、`< 2^53`，§8.2）；
/// 不合法时返回 `None`，由调用点以 `NATIVE_VALUE_OUT_OF_RANGE` 报告。
#[must_use]
pub(crate) fn normalize_u64_field(value: f64) -> Option<u64> {
    if !value.is_finite() || value < 0.0 || value.fract() != 0.0 {
        return None;
    }
    // 精确整数上限为 `MAX_SAFE_INTEGER`（`2^53`），达到即判定丢精度（§8.2）。
    if value >= crate::convert::MAX_SAFE_INTEGER as f64 {
        return None;
    }
    Some(value as u64)
}

/// 把内核 `Instant` 截止时刻换算为 Unix epoch 毫秒（JS 侧 `ctx.deadline`，
/// §5.3 形态）；已过期的截止回落到当前时刻，不产生负值。
#[must_use]
pub(crate) fn deadline_epoch_ms(deadline: Instant) -> u64 {
    let now = Instant::now();
    let remaining = deadline.checked_duration_since(now).unwrap_or_default();
    let epoch_now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    (epoch_now + remaining).as_millis() as u64
}

/// 构造取消归一错误；码取内核 `BRIDGE_CANCELLED`（非绑定层自造码）。
fn cancelled_error() -> ChipsError {
    ChipsError::new(BRIDGE_CANCELLED, "调用已取消")
}

/// 跨线程持有的 JS 能力 handler：`Root` 持有函数，调用一律经 `Channel`
/// 回投 JS 线程（§8.4）；释放同样回投 JS 线程，不依赖 `Drop` 时机。
pub(crate) struct JsHandler {
    root: Mutex<Option<Root<JsFunction>>>,
    channel: Channel,
}

impl JsHandler {
    /// 在 JS 线程创建 handler 载体。
    pub(crate) fn new<'a, C: Context<'a>>(cx: &mut C, function: &Handle<'a, JsFunction>) -> Self {
        Self {
            root: Mutex::new(Some(Root::new(cx, function))),
            channel: Channel::new(cx),
        }
    }
}

impl Drop for JsHandler {
    fn drop(&mut self) {
        let root = self.root.lock().ok().and_then(|mut guard| guard.take());
        let Some(root) = root else { return };
        // 释放回投 JS 线程；通道已关闭时按 Neon 的 N-API 6+ 队列兜底。
        let _ = self.channel.try_send(move |_cx| {
            drop(root);
            Ok(())
        });
    }
}

/// TS 能力执行器：把内核调用桥接为 JS handler 调用。
pub(crate) struct TsCapabilityExecutor {
    handler: Arc<JsHandler>,
}

#[async_trait]
impl CapabilityExecutor for TsCapabilityExecutor {
    async fn execute(
        &self,
        ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        let handler = Arc::clone(&self.handler);
        let channel = handler.channel.clone();
        let deadline = ctx.deadline;
        // JS 线程只做「构造参数 + 发起调用 + 订阅 Promise」；不占用其等待结果。
        let join = match channel.try_send(move |mut cx| {
            Ok(dispatch_handler(&mut cx, &handler, &input, deadline))
        }) {
            Ok(join) => join,
            Err(_) => {
                return Err(internal_error(
                    "JS 线程通道已关闭，能力调用无法投递，调用被拒绝",
                ))
            }
        };
        let dispatched = match join.await {
            Ok(dispatched) => dispatched,
            Err(_) => return Err(internal_error("能力调用投递 JS 线程失败")),
        };
        match dispatched {
            DispatchedCall::Completed(outcome) => outcome,
            DispatchedCall::Pending {
                mut future,
                mut controller,
            } => {
                let outcome = tokio::select! {
                    biased;
                    result = &mut future => {
                        result.map_err(|_| internal_error("JS 能力 handler 结果回收异常"))
                    }
                    () = ctx.signal.cancelled() => {
                        // 协作式取消：触发 JS 侧 `AbortSignal.abort()` 通知插件收口，
                        // 随后按 `BRIDGE_CANCELLED` 结束（迟到结果随 Promise 丢弃）。
                        abort_controller_channel(controller.take(), &channel);
                        return Err(cancelled_error());
                    }
                };
                // 正常收口：`AbortController` 引用回投 JS 线程释放。
                release_controller(controller.take(), &channel);
                outcome
            }
        }
    }
}

/// JS 线程派发结果：立即完成（参数构造失败 / handler 同步抛出）或转入
/// 等待 Promise 的 Future。
enum DispatchedCall {
    Completed(HandlerOutcome),
    Pending {
        future: JsFuture<HandlerOutcome>,
        controller: Option<Root<JsObject>>,
    },
}

/// 在 JS 线程构造 `{ signal, deadline }` 上下文与输入值，调用 handler 并
/// 订阅其 Promise（§5.3 handler 形态：返回值被等待）。
fn dispatch_handler(
    cx: &mut Cx<'_>,
    handler: &Arc<JsHandler>,
    input: &CapabilityInput,
    deadline: Instant,
) -> DispatchedCall {
    let function = {
        let Ok(guard) = handler.root.lock() else {
            return DispatchedCall::Completed(Err(internal_error("能力 handler 状态异常")));
        };
        let Some(root) = guard.as_ref() else {
            return DispatchedCall::Completed(Err(internal_error("能力 handler 已释放")));
        };
        root.to_inner(cx)
    };
    let controller = match create_abort_controller(cx) {
        Ok(controller) => controller,
        Err(error) => return DispatchedCall::Completed(Err(error)),
    };
    let controller_root = Root::new(cx, &controller);
    match invoke_handler(cx, &function, &controller, input, deadline) {
        Ok(future) => DispatchedCall::Pending {
            future,
            controller: Some(controller_root),
        },
        Err(outcome) => {
            release_controller(Some(controller_root), &handler.channel);
            DispatchedCall::Completed(outcome)
        }
    }
}

/// 构造 `ctx` 对象并调用 handler；失败时返回立即归一结果（`Err(Err(..))`）。
fn invoke_handler<'a>(
    cx: &mut Cx<'a>,
    function: &Handle<'a, JsFunction>,
    controller: &Handle<'a, JsObject>,
    input: &CapabilityInput,
    deadline: Instant,
) -> Result<JsFuture<HandlerOutcome>, HandlerOutcome> {
    // ctx = { signal, deadline }（§5.3 形态）；signal 为 JS 原生 AbortSignal。
    let ctx_object = JsObject::new(cx);
    let signal: Handle<JsValue> = match controller.get(cx, "signal") {
        Ok(signal) => signal,
        Err(_) => {
            return Err(Err(internal_error(
                "AbortController 不可用，无法构造取消信号",
            )))
        }
    };
    let deadline_number = cx.number(deadline_epoch_ms(deadline) as f64);
    if ctx_object
        .set(cx, "signal", signal.upcast::<JsValue>())
        .is_err()
        || ctx_object.set(cx, "deadline", deadline_number).is_err()
    {
        return Err(Err(internal_error("能力上下文对象构造失败")));
    }
    // 输入值：`json` 与 `bin` 合并回嵌（`x-chips-binary` 位置输出 Uint8Array）。
    let input_js = match json_with_bin_to_js(cx, &input.json, &input.bin, "") {
        Ok(value) => value,
        Err(_) => {
            return Err(Err(ConvertIssue::TypeUnsupported {
                pointer: String::new(),
                detail: "输入值构造失败",
            }
            .into_error()))
        }
    };
    let returned = cx.try_catch(|cx| {
        let this = cx.undefined();
        function.call(cx, this, [input_js, ctx_object.upcast()])
    });
    let returned = match returned {
        Ok(value) => value,
        Err(thrown) => return Err(Err(chips_error_from_js(cx, thrown))),
    };
    // handler 为 async 函数时返回 Promise；非 Promise 返回值按已决议处理。
    let promise: Handle<JsPromise> = match returned.downcast::<JsPromise, _>(cx) {
        Ok(promise) => promise,
        Err(_) => JsPromise::resolve(cx, returned),
    };
    let future = match promise.to_future(cx, |mut cx, result| {
        let outcome = match result {
            Ok(value) => js_with_bin_to_json(&mut cx, &value)
                .map(|(json, bin)| CapabilityOutput { json, bin })
                .map_err(ConvertIssue::into_error),
            Err(thrown) => Err(chips_error_from_js(&mut cx, thrown)),
        };
        Ok(outcome)
    }) {
        Ok(future) => future,
        Err(_) => {
            return Err(Err(internal_error(
                "订阅 JS 能力 handler 的 Promise 失败",
            )))
        }
    };
    Ok(future)
}

/// 经 `Reflect.construct` 创建 `AbortController`（JS 原生取消信号源）。
fn create_abort_controller<'a, C: Context<'a>>(
    cx: &mut C,
) -> Result<Handle<'a, JsObject>, ChipsError> {
    let reflect: Handle<JsObject> = cx
        .global("Reflect")
        .map_err(|_| internal_error("Reflect 在当前运行时不可用"))?;
    let construct: Handle<JsFunction> = reflect
        .get(cx, "construct")
        .map_err(|_| internal_error("Reflect.construct 不可用"))?;
    let controller_ctor: Handle<JsFunction> = cx
        .global("AbortController")
        .map_err(|_| internal_error("AbortController 在当前运行时不可用"))?;
    let no_args = cx.empty_array();
    let this = cx.undefined();
    let instance = construct
        .call(
            cx,
            this.upcast::<JsValue>(),
            [controller_ctor.upcast(), no_args.upcast()],
        )
        .map_err(|_| internal_error("AbortController 构造失败"))?;
    instance
        .downcast::<JsObject, _>(cx)
        .map_err(|_| internal_error("AbortController 实例形状异常"))
}

/// 在 JS 线程触发 `controller.abort()`，通知 handler 侧 `signal` 收口。
fn abort_controller<'a, C: Context<'a>>(cx: &mut C, root: Root<JsObject>) {
    let controller = root.into_inner(cx);
    if let Ok(abort) = controller.get::<JsFunction, _, _>(cx, "abort") {
        let this = controller.upcast::<JsValue>();
        // abort 若抛出，属插件监听器异常；不影响取消收口。
        let _ = abort.call(cx, this, []);
    }
}

/// 取消收口：把 `AbortController` 引用回投 JS 线程并触发 `abort()`。
fn abort_controller_channel(controller: Option<Root<JsObject>>, channel: &Channel) {
    let Some(root) = controller else {
        return;
    };
    let _ = channel.try_send(move |mut cx| {
        abort_controller(&mut cx, root);
        Ok(())
    });
}

/// 正常收口：把 `AbortController` 引用回投 JS 线程释放（§8.4，不依赖
/// `Drop` 时机；通道关闭时由 N-API 6+ 释放队列兜底）。
fn release_controller(controller: Option<Root<JsObject>>, channel: &Channel) {
    let Some(root) = controller else {
        return;
    };
    let _ = channel.try_send(move |_cx| {
        drop(root);
        Ok(())
    });
}

/// 读取字符串字段；缺省或类型不符报告 `NATIVE_TYPE_UNSUPPORTED`。
fn string_field<'a, C: Context<'a>>(
    cx: &mut C,
    object: &Handle<'a, JsObject>,
    key: &str,
    pointer: &str,
) -> Result<String, ChipsError> {
    let value: Handle<JsString> = object
        .get(cx, key)
        .map_err(|_| type_unsupported(pointer, "字段缺失或不是字符串"))?;
    Ok(value.value(cx))
}

/// 读取非负整数字段（`< 2^53`）；不合法报告 `NATIVE_VALUE_OUT_OF_RANGE`。
fn u64_field<'a, C: Context<'a>>(
    cx: &mut C,
    object: &Handle<'a, JsObject>,
    key: &str,
    pointer: &str,
) -> Result<u64, ChipsError> {
    let value: Handle<JsNumber> = object
        .get(cx, key)
        .map_err(|_| type_unsupported(pointer, "字段缺失或不是数值"))?;
    normalize_u64_field(value.value(cx))
        .ok_or_else(|| value_out_of_range(pointer, "必须是不超过 2^53 的非负整数值"))
}

/// 读取字符串数组字段（权限列表）。
fn string_list_field<'a, C: Context<'a>>(
    cx: &mut C,
    object: &Handle<'a, JsObject>,
    key: &str,
    pointer: &str,
) -> Result<Vec<String>, ChipsError> {
    let array: Handle<JsArray> = object
        .get(cx, key)
        .map_err(|_| type_unsupported(pointer, "字段缺失或不是数组"))?;
    let items = array
        .to_vec(cx)
        .map_err(|_| type_unsupported(pointer, "数组读取失败"))?;
    let mut values = Vec::with_capacity(items.len());
    for item in items {
        let value = item
            .downcast::<JsString, _>(cx)
            .map_err(|_| type_unsupported(pointer, "元素必须是字符串"))?;
        values.push(value.value(cx));
    }
    Ok(values)
}

/// 解析 `bridgeRegister` 的注册对象（§5.3 `INativeCapabilityRegistration`
/// 形态）；只校验类型形状，ID 文法、schema 编译、权限与 owner 校验全部
/// 由 `chips-bridge` 注册期完成。
fn parse_registration<'a, C: Context<'a>>(
    cx: &mut C,
    registration: &Handle<'a, JsObject>,
) -> Result<CapabilityRegistration, ChipsError> {
    let descriptor: Handle<JsObject> = registration
        .get(cx, "descriptor")
        .map_err(|_| type_unsupported("/descriptor", "必须是对象"))?;
    let id = string_field(cx, &descriptor, "id", "/descriptor/id")?;
    let schema_value: Handle<JsValue> = descriptor
        .get(cx, "schema")
        .map_err(|_| type_unsupported("/descriptor/schema", "字段缺失"))?;
    let schema = js_to_json(cx, &schema_value)
        .map_err(|issue| issue.into_error())?;
    let permissions =
        string_list_field(cx, &descriptor, "permissions", "/descriptor/permissions")?;
    let owner = string_field(cx, registration, "owner", "/owner")?;
    let timeout_ms = u64_field(cx, registration, "timeoutMs", "/timeoutMs")?;
    let concurrency_raw = string_field(cx, registration, "concurrency", "/concurrency")?;
    let concurrency = parse_concurrency(&concurrency_raw)
        .ok_or_else(|| type_unsupported("/concurrency", "取值必须是 'parallel' 或 'serial'"))?;
    let max_queue = u64_field(cx, registration, "maxQueue", "/maxQueue")?;
    let max_queue = usize::try_from(max_queue)
        .map_err(|_| value_out_of_range("/maxQueue", "超出本机地址空间可表示范围"))?;
    let handler: Handle<JsFunction> = registration
        .get(cx, "handler")
        .map_err(|_| type_unsupported("/handler", "字段缺失或不是函数"))?;
    let handler = Arc::new(JsHandler::new(cx, &handler));
    Ok(CapabilityRegistration {
        descriptor: CapabilityDescriptor {
            id,
            schema,
            permissions,
        },
        owner,
        timeout_ms,
        concurrency,
        max_queue,
        executor: Arc::new(TsCapabilityExecutor { handler }),
    })
}

/// 解析 `bridgeRequest` 的请求对象（§5.3 `INativeBridgeRequest` 形态）；
/// 输入信封经 [`bin_from_js`] 解码并以 [`validate_bin_table`] 校验键位一致。
fn parse_request<'a, C: Context<'a>>(
    cx: &mut C,
    request: &Handle<'a, JsObject>,
) -> Result<BridgeRequest, ChipsError> {
    let request_id = string_field(cx, request, "requestId", "/requestId")?;
    let capability_id = string_field(cx, request, "capabilityId", "/capabilityId")?;
    let session = u64_field(cx, request, "sessionId", "/sessionId")?;
    let input_value: Handle<JsValue> = request
        .get(cx, "input")
        .map_err(|_| type_unsupported("/input", "字段缺失"))?;
    let json = js_to_json(cx, &input_value).map_err(|issue| issue.into_error())?;
    let bin_value: Handle<JsValue> = request
        .get(cx, "bin")
        .map_err(|_| ChipsError::new(ENVELOPE_INVALID_INPUT_CODE, "二进制表读取失败"))?;
    let bin_object: Option<Handle<'a, JsObject>> = if bin_value.is_a::<JsUndefined, _>(cx)
        || bin_value.is_a::<JsNull, _>(cx)
    {
        None
    } else {
        Some(
            bin_value
                .downcast::<JsObject, _>(cx)
                .map_err(|_| {
                    ChipsError::new(
                        ENVELOPE_INVALID_INPUT_CODE,
                        "二进制表必须是键与 Uint8Array 的普通对象",
                    )
                })?,
        )
    };
    let bin = bin_from_js(cx, bin_object)?;
    validate_bin_table(&json, &bin)?;
    Ok(BridgeRequest {
        request_id,
        capability_id,
        session,
        input: CapabilityInput { json, bin },
    })
}

/// `bridgeRegister(registration)`：注册 TS 能力并持有其 JS handler；
/// 失败（ID 冲突、schema 非法、权限未声明、提供方未激活等）抛出
/// `chips-bridge` 注册期错误。
pub(crate) fn js_bridge_register(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let registration_object = cx.argument::<JsObject>(0)?;
    let registration = match parse_registration(&mut cx, &registration_object) {
        Ok(registration) => registration,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    match bridge().register(registration) {
        Ok(()) => Ok(cx.undefined()),
        Err(error) => throw_chips_error(&mut cx, error),
    }
}

/// `bridgeUnregister(capabilityId)`：注销能力；在途调用由内核按取消收口。
pub(crate) fn js_bridge_unregister(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let capability_id = cx.argument::<JsString>(0)?.value(&mut cx);
    match bridge().unregister(&capability_id) {
        Ok(()) => Ok(cx.undefined()),
        Err(error) => throw_chips_error(&mut cx, error),
    }
}

/// `bridgeRequest(request)`：发起一次能力调用；JS 线程完成参数解析与信封
/// 编码，内核调用提交到绑定层运行时，结果经 `Channel` 回投 settle Promise，
/// 输出信封的 `bin` 位置以 `Uint8Array` 嵌回。
pub(crate) fn js_bridge_request(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let request_object = cx.argument::<JsObject>(0)?;
    let request = match parse_request(&mut cx, &request_object) {
        Ok(request) => request,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    // 运行时先行确认：`spawn_result` 此后不会再失败，`Deferred` 必然移交 settle。
    if let Err(error) = crate::runtime::runtime() {
        return throw_chips_error(&mut cx, error);
    }
    let kernel = bridge();
    let (deferred, promise) = cx.promise();
    let channel = cx.channel();
    let future = async move { kernel.request(request).await };
    let settle = |cx: &mut Cx<'_>, output: CapabilityOutput| {
        json_with_bin_to_js(cx, &output.json, &output.bin, "")
    };
    // 运行时已就绪，`spawn_result` 不会失败；若意外失败，`Deferred` 由
    // N-API 6+ 自动拒绝（§8.3 规则 8），Promise 以 rejection 收口。
    let _ = crate::runtime::spawn_result(deferred, channel, future, settle);
    Ok(promise)
}

/// `bridgeCancelSession(sessionId)`：取消会话全部在途调用；幂等；
/// 会话保持可用（§5.2）。
pub(crate) fn js_bridge_cancel_session(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let raw = cx.argument::<JsNumber>(0)?.value(&mut cx);
    let Some(session) = normalize_u64_field(raw) else {
        return throw_chips_error(
            &mut cx,
            value_out_of_range("/sessionId", "必须是不超过 2^53 的非负整数值"),
        );
    };
    bridge().cancel_session(session);
    Ok(cx.undefined())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chips_bridge::{ProviderKind, ProviderRegistration};
    use serde_json::json;

    /// 回声执行器（Rust 侧）：验证内核调用链与信封透传。
    struct Echo;

    #[async_trait]
    impl CapabilityExecutor for Echo {
        async fn execute(
            &self,
            _ctx: &CapabilityContext,
            input: CapabilityInput,
        ) -> Result<CapabilityOutput, ChipsError> {
            Ok(CapabilityOutput {
                json: input.json,
                bin: input.bin,
            })
        }
    }

    #[test]
    fn test_parse_concurrency_maps_js_shapes() {
        assert_eq!(parse_concurrency("parallel"), Some(Concurrency::Parallel));
        assert_eq!(parse_concurrency("serial"), Some(Concurrency::Serial));
        assert_eq!(parse_concurrency("Parallel"), None);
        assert_eq!(parse_concurrency(""), None);
    }

    #[test]
    fn test_normalize_u64_field_accepts_safe_integers() {
        assert_eq!(normalize_u64_field(0.0), Some(0));
        assert_eq!(normalize_u64_field(30_000.0), Some(30_000));
        assert_eq!(
            normalize_u64_field((crate::convert::MAX_SAFE_INTEGER - 1) as f64),
            Some(crate::convert::MAX_SAFE_INTEGER - 1)
        );
    }

    #[test]
    fn test_normalize_u64_field_rejects_invalid_shapes() {
        assert_eq!(normalize_u64_field(-1.0), None);
        assert_eq!(normalize_u64_field(1.5), None);
        assert_eq!(normalize_u64_field(f64::NAN), None);
        assert_eq!(normalize_u64_field(f64::INFINITY), None);
        assert_eq!(normalize_u64_field(crate::convert::MAX_SAFE_INTEGER as f64), None);
    }

    #[test]
    fn test_deadline_epoch_ms_orders_by_remaining_time() {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("系统时钟晚于纪元")
            .as_millis() as u64;
        let immediate = deadline_epoch_ms(Instant::now());
        let later = deadline_epoch_ms(Instant::now() + Duration::from_secs(30));
        // 已过期的截止回落到当前时刻附近（不小于本次读取的纪元毫秒基线太多）。
        assert!(immediate.abs_diff(now_ms) < 5_000);
        assert!(later > immediate + 29_000);
    }

    #[test]
    fn test_bridge_singleton_shares_kernel_state() {
        let one = bridge();
        let two = bridge();
        one.activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("激活平台服务域");
        one.register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: json!({"type": "object"}),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: chips_bridge::DEFAULT_TIMEOUT_MS,
            concurrency: Concurrency::default(),
            max_queue: chips_bridge::DEFAULT_MAX_QUEUE,
            executor: Arc::new(Echo),
        })
        .expect("注册内置回声能力");
        assert!(two.has_capability("file:read"), "单例句柄必须共享注册表");
        two.unregister("file:read").expect("注销能力");
        assert!(!one.has_capability("file:read"));
    }

    #[test]
    fn test_registration_without_active_provider_reports_kernel_error() {
        let kernel = Bridge::new();
        let error = kernel
            .register(CapabilityRegistration {
                descriptor: CapabilityDescriptor {
                    id: "file:read".to_owned(),
                    schema: json!({"type": "object"}),
                    permissions: Vec::new(),
                },
                owner: "chips.official.missing".to_owned(),
                timeout_ms: 1_000,
                concurrency: Concurrency::Parallel,
                max_queue: 8,
                executor: Arc::new(Echo),
            })
            .expect_err("未激活提供方注册必须失败");
        assert_eq!(error.code(), chips_bridge::KERNEL_INVALID_TRANSITION);
    }
}
