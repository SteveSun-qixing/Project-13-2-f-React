//! Cordis / Context 导出（《核心接口规范》§4.5 绑定面）。
//!
//! 导出函数只做门面适配：句柄解析、参数转换、错误归一与跨线程回投；
//! 服务注册、依赖注入、事件派发语义全部由 `chips-cordis` 承载。
//!
//! 监听令牌由绑定层分配（`number`，低于 2^53）：内核令牌是内核内部类型，
//! 绑定层维护 `number → ListenerToken` 的翻译表；监听器条目被移除（`once`
//! 触发、Fork 撤销、显式退订）时，翻译表条目随 [`JsListenerSink`] 的
//! `Drop` 一并清理，不遗留悬挂令牌。

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use chips_cordis::event::Event;
use chips_cordis::{Context as KernelContext, KernelError, ListenerOptions, ListenerToken};
use chips_core::{ChipsError, ServiceValue};
use neon::prelude::*;

use crate::convert::{js_to_json, safe_u64_number};
use crate::error::throw_chips_error;
use crate::handles::{JsCallback, JsServiceValue, NativeContextHandle};

/// 监听令牌翻译表；内核令牌不对外暴露，翻译表是绑定层的 ABI 适配状态。
#[derive(Debug, Default)]
pub(crate) struct ListenerRegistry {
    next: AtomicU64,
    tokens: Mutex<HashMap<u64, ListenerToken>>,
}

impl ListenerRegistry {
    /// 分配绑定层令牌（`>= 1` 且 `< 2^53`）；此时尚未绑定内核令牌。
    pub(crate) fn allocate_key(&self) -> Result<u64, ChipsError> {
        let key = self.next.fetch_add(1, Ordering::AcqRel) + 1;
        safe_u64_number(key, "").map_err(|_| crate::error::internal_error("监听令牌空间耗尽"))?;
        Ok(key)
    }

    /// 绑定内核令牌到已分配的绑定层令牌。
    pub(crate) fn bind(&self, key: u64, token: ListenerToken) -> Result<(), ChipsError> {
        let mut tokens = self
            .tokens
            .lock()
            .map_err(|_| crate::error::internal_error("监听令牌表状态异常"))?;
        tokens.insert(key, token);
        Ok(())
    }

    /// 按绑定层令牌查找内核令牌。
    pub(crate) fn resolve(&self, key: u64) -> Option<ListenerToken> {
        self.tokens.lock().ok()?.get(&key).copied()
    }

    /// 移除翻译表条目；幂等。
    pub(crate) fn remove(&self, key: u64) {
        if let Ok(mut tokens) = self.tokens.lock() {
            tokens.remove(&key);
        }
    }

    /// 当前登记条目数（诊断与测试）。
    #[must_use]
    #[allow(dead_code)] // 诊断接口：监听令牌表泄露排查；当前仅由单测消费。
    pub(crate) fn len(&self) -> usize {
        self.tokens.lock().map(|tokens| tokens.len()).unwrap_or(0)
    }
}

/// 进程级监听令牌表。
static LISTENERS: OnceLock<Arc<ListenerRegistry>> = OnceLock::new();

fn listeners() -> &'static Arc<ListenerRegistry> {
    LISTENERS.get_or_init(|| Arc::new(ListenerRegistry::default()))
}

/// JS 监听器的内核 `EventSink` 适配：payload 经 `Channel` 投递 JS 线程。
pub(crate) struct JsListenerSink {
    callback: Arc<JsCallback>,
    registry: Arc<ListenerRegistry>,
    key: u64,
}

impl chips_cordis::EventSink for JsListenerSink {
    fn enqueue(&self, event: Event) -> Result<(), KernelError> {
        self.callback.dispatch_json(event.payload);
        Ok(())
    }
}

impl Drop for JsListenerSink {
    fn drop(&mut self) {
        self.registry.remove(self.key);
    }
}

/// `contextGet` 的查找分类；与 JS 无关，便于单测。
pub(crate) enum ServiceLookup {
    /// 未注册。
    Missing,
    /// JS 服务值（可跨语言返回）。
    Js(Arc<JsServiceValue>),
    /// Rust 注册的服务：不可跨语言下转。
    NonJs,
}

/// 分类服务查找结果。
pub(crate) fn classify_service(
    result: Result<ServiceValue, KernelError>,
) -> Result<ServiceLookup, KernelError> {
    match result {
        Ok(value) => match value.downcast::<JsServiceValue>() {
            Ok(service) => Ok(ServiceLookup::Js(service)),
            Err(_) => Ok(ServiceLookup::NonJs),
        },
        Err(KernelError::ServiceNotFound { .. }) => Ok(ServiceLookup::Missing),
        Err(error) => Err(error),
    }
}

/// 把 JS `number` 解析为绑定层监听令牌（正整数、`< 2^53`）。
pub(crate) fn token_from_js_number(value: f64) -> Result<u64, ChipsError> {
    if !value.is_finite() || value.fract() != 0.0 || value <= 0.0 {
        return Err(ChipsError::new(
            crate::error::NATIVE_VALUE_OUT_OF_RANGE,
            "监听令牌非法",
        ));
    }
    let raw = value as u64;
    safe_u64_number(raw, "")
        .map_err(|_| ChipsError::new(crate::error::NATIVE_VALUE_OUT_OF_RANGE, "监听令牌非法"))?;
    Ok(raw)
}

/// 抛出内核错误（归一为 `ChipsError`）。
fn kernel_error<'a, C: Context<'a>, V: Value>(cx: &mut C, error: KernelError) -> JsResult<'a, V> {
    throw_chips_error(cx, ChipsError::from(error))
}

/// 解析 Context 句柄参数（`JsBox<NativeContextHandle>`）并取回内核 `Context`。
fn context_argument<'cx>(cx: &mut FunctionContext<'cx>, index: usize) -> NeonResult<KernelContext> {
    let handle = cx.argument::<JsBox<NativeContextHandle>>(index)?;
    Ok(handle.0.clone())
}

/// 解析字符串数组参数（依赖列表）；元素类型错误时抛出 `ChipsError`。
fn string_array_argument<'cx>(
    cx: &mut FunctionContext<'cx>,
    index: usize,
) -> NeonResult<Vec<String>> {
    let array = cx.argument::<JsArray>(index)?;
    let mut values = Vec::new();
    for item in array.to_vec(cx)? {
        let string = match item.downcast::<JsString, _>(cx) {
            Ok(string) => string,
            Err(_) => {
                return throw_chips_error(
                    cx,
                    crate::error::type_unsupported("/dependencies", "依赖名必须是字符串"),
                )
            }
        };
        values.push(string.value(cx));
    }
    Ok(values)
}

/// `contextProvide(handle, name, value)`：注册服务；同名替换并触发级联重建。
pub fn js_context_provide(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let context = context_argument(&mut cx, 0)?;
    let name = cx.argument::<JsString>(1)?.value(&mut cx);
    let value = cx.argument::<JsValue>(2)?;

    let service = match JsServiceValue::from_js(&mut cx, &value) {
        Ok(service) => service,
        Err(issue) => return throw_chips_error(&mut cx, issue.into_error()),
    };

    match context.provide(name, service) {
        Ok(()) => Ok(cx.undefined()),
        Err(error) => kernel_error(&mut cx, error),
    }
}

/// `contextInject(handle, dependencies, callback)`：声明依赖并返回注入 ID。
///
/// 回调在依赖就绪时经 `Channel` 在 JS 线程调用，参数为 Context 句柄。
pub fn js_context_inject(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let context = context_argument(&mut cx, 0)?;
    let dependencies = string_array_argument(&mut cx, 1)?;
    let callback = cx.argument::<JsFunction>(2)?;
    let callback = Arc::new(JsCallback::new(&mut cx, &callback));

    let injection = context.inject(&dependencies, move |injected| {
        callback.dispatch_context(injected.clone());
    });

    match injection {
        Ok(id) => crate::runtime::id_to_js_number(&mut cx, id),
        Err(error) => kernel_error(&mut cx, error),
    }
}

/// `contextGet(handle, name)`：按作用域链获取 JS 服务值。
///
/// 未注册返回 `undefined`；Rust 注册的服务不可跨语言下转，返回类型不匹配。
pub fn js_context_get(mut cx: FunctionContext) -> JsResult<JsValue> {
    let context = context_argument(&mut cx, 0)?;
    let name = cx.argument::<JsString>(1)?.value(&mut cx);

    match classify_service(context.get(&name)) {
        Ok(ServiceLookup::Js(service)) => match service.to_js(&mut cx) {
            Some(value) => Ok(value),
            None => throw_chips_error(&mut cx, crate::error::internal_error("服务值句柄已释放")),
        },
        Ok(ServiceLookup::Missing) => Ok(cx.undefined().upcast()),
        Ok(ServiceLookup::NonJs) => throw_chips_error(
            &mut cx,
            ChipsError::new(
                "KERNEL_SERVICE_TYPE_MISMATCH",
                "该服务由 Rust 注册，不可跨语言下转",
            ),
        ),
        Err(error) => kernel_error(&mut cx, error),
    }
}

/// `contextOn(handle, event, listener, once)`：订阅事件并返回监听令牌。
pub fn js_context_on(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let context = context_argument(&mut cx, 0)?;
    let event = cx.argument::<JsString>(1)?.value(&mut cx);
    let listener = cx.argument::<JsFunction>(2)?;
    let once = cx.argument::<JsBoolean>(3)?.value(&mut cx);

    let registry = Arc::clone(listeners());
    let key = match registry.allocate_key() {
        Ok(key) => key,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    let sink = Arc::new(JsListenerSink {
        callback: Arc::new(JsCallback::new(&mut cx, &listener)),
        registry: Arc::clone(&registry),
        key,
    });
    let options = ListenerOptions {
        once,
        prepend: false,
    };

    match context.on_queued(
        &event,
        Arc::clone(&sink) as Arc<dyn chips_cordis::EventSink>,
        options,
    ) {
        Ok(token) => {
            drop(sink);
            match registry.bind(key, token) {
                Ok(()) => crate::runtime::id_to_js_number(&mut cx, key),
                Err(error) => {
                    let _ = context.off(token);
                    throw_chips_error(&mut cx, error)
                }
            }
        }
        Err(error) => kernel_error(&mut cx, error),
    }
}

/// `contextUnsubscribe(handle, token)`：退订；幂等。
pub fn js_context_unsubscribe(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let context = context_argument(&mut cx, 0)?;
    let token = match token_from_js_number(cx.argument::<JsNumber>(1)?.value(&mut cx)) {
        Ok(token) => token,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    let registry = Arc::clone(listeners());
    if let Some(kernel_token) = registry.resolve(token) {
        if let Err(error) = context.off(kernel_token) {
            return kernel_error(&mut cx, error);
        }
    }
    registry.remove(token);
    Ok(cx.undefined())
}

/// `contextEmit(handle, event, payload)`：同步广播事件。
pub fn js_context_emit(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let context = context_argument(&mut cx, 0)?;
    let event = cx.argument::<JsString>(1)?.value(&mut cx);
    let payload = cx.argument::<JsValue>(2)?;

    let payload = match js_to_json(&mut cx, &payload) {
        Ok(payload) => payload,
        Err(issue) => return throw_chips_error(&mut cx, issue.into_error()),
    };

    match context.emit(&event, payload) {
        Ok(()) => Ok(cx.undefined()),
        Err(error) => kernel_error(&mut cx, error),
    }
}

/// `contextEffect(handle, cleanup)`：登记清理闭包；随当前 Fork 撤销。
pub fn js_context_effect(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let context = context_argument(&mut cx, 0)?;
    let cleanup = cx.argument::<JsFunction>(1)?;
    let callback = Arc::new(JsCallback::new(&mut cx, &cleanup));

    match context.effect(move || callback.dispatch_empty()) {
        Ok(()) => Ok(cx.undefined()),
        Err(error) => kernel_error(&mut cx, error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kernel() -> (tokio::runtime::Runtime, KernelContext) {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .expect("测试运行时");
        let kernel = chips_cordis::Kernel::new(runtime.handle().clone()).expect("内核");
        let context = kernel.root_context();
        (runtime, context)
    }

    #[test]
    fn test_listener_registry_roundtrip_and_remove() {
        let (_runtime, context) = kernel();
        let registry = ListenerRegistry::default();
        let token = context
            .on("test:event", |_, _| Ok(()))
            .expect("订阅必须成功");

        let key = registry.allocate_key().expect("分配令牌");
        assert!(registry.resolve(key).is_none());
        registry.bind(key, token).expect("绑定令牌");
        assert_eq!(registry.resolve(key), Some(token));
        assert_eq!(registry.len(), 1);

        registry.remove(key);
        registry.remove(key);
        assert!(registry.resolve(key).is_none());
        assert_eq!(registry.len(), 0);
    }

    #[test]
    fn test_token_from_js_number_validation() {
        assert_eq!(token_from_js_number(1.0).expect("1"), 1);
        assert!(token_from_js_number(0.0).is_err());
        assert!(token_from_js_number(-1.0).is_err());
        assert!(token_from_js_number(1.5).is_err());
        assert!(token_from_js_number(f64::NAN).is_err());
        assert!(token_from_js_number(f64::INFINITY).is_err());
        assert!(token_from_js_number(9.007_199_254_740_992e15).is_err());
    }

    #[test]
    fn test_classify_service_with_kernel() {
        let (_runtime, context) = kernel();
        context.provide("answer".to_owned(), 42_u32).expect("注册");
        assert!(matches!(
            classify_service(context.get("answer")),
            Ok(ServiceLookup::NonJs)
        ));
        assert!(matches!(
            classify_service(context.get("missing")),
            Ok(ServiceLookup::Missing)
        ));
        assert!(classify_service(context.get("answer")).is_ok());
    }

    #[test]
    fn test_classify_service_propagates_non_missing_kernel_errors() {
        // 非 `ServiceNotFound` 的内核错误原样透传给上层归一，不吞成 `Missing`。
        let outcome = classify_service(Err(KernelError::LockPoisoned));
        assert!(matches!(outcome, Err(KernelError::LockPoisoned)));
    }

    #[test]
    fn test_listener_registry_allocate_is_monotonic() {
        let registry = ListenerRegistry::default();
        assert_eq!(registry.len(), 0);
        let first = registry.allocate_key().expect("首次分配");
        let second = registry.allocate_key().expect("再次分配");
        assert_eq!(first, 1);
        assert_eq!(second, 2);
        // 分配阶段只占用绑定层键位，尚未绑定内核令牌，故解析仍为空、条目数仍为 0。
        assert!(registry.resolve(first).is_none());
        assert_eq!(registry.len(), 0);
    }

    #[test]
    fn test_token_from_js_number_reports_value_out_of_range() {
        let error = token_from_js_number(0.0).expect_err("0 非法");
        assert_eq!(error.code(), crate::error::NATIVE_VALUE_OUT_OF_RANGE);
        // 超过 `2^53` 的整数令牌同样越界（正有限、整值，但超出安全整数上限）。
        let huge = token_from_js_number((crate::convert::MAX_SAFE_INTEGER + 1) as f64)
            .expect_err("超过 2^53 非法");
        assert_eq!(huge.code(), crate::error::NATIVE_VALUE_OUT_OF_RANGE);
    }

    #[test]
    fn test_context_effect_registers_and_reverts() {
        let (_runtime, context) = kernel();
        let counter = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let observed = Arc::clone(&counter);
        context
            .effect(move || {
                observed.fetch_add(1, Ordering::AcqRel);
            })
            .expect("登记清理");
        context.dispose().expect("销毁 Context");
        assert_eq!(counter.load(Ordering::Acquire), 1);
    }
}
