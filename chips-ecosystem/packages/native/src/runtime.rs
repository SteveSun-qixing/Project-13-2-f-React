//! 绑定层异步调度与线程约束（《核心接口规范》§8.3）。
//!
//! - JS 线程只做参数提取与 `JsPromise` 组装，不在 JS 线程同步等待 Rust；
//! - 可能阻塞的工作提交到绑定层专用 tokio 运行时，完成后经 `Channel` 回投
//!   JS 线程再 settle Promise；
//! - JS 值（`Handle` / `JsBox` 借用 / `JsPromise` / 上下文句柄）只在 JS 线程
//!   使用；跨线程只传 `Root<T>`、`Channel` 与纯 Rust 数据。

use std::future::Future;
use std::sync::OnceLock;

use chips_core::ChipsError;
use neon::event::Channel;
use neon::prelude::*;
use neon::types::Deferred;

/// 绑定层专用异步运行时；懒初始化、全进程共享。
static RUNTIME: OnceLock<Result<tokio::runtime::Runtime, String>> = OnceLock::new();

/// 取绑定层运行时；初始化失败返回 `NATIVE_INTERNAL`。
pub(crate) fn runtime() -> Result<&'static tokio::runtime::Runtime, ChipsError> {
    match RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .thread_name("chips-native")
            .enable_time()
            .build()
            .map_err(|error| error.to_string())
    }) {
        Ok(runtime) => Ok(runtime),
        Err(detail) => Err(crate::error::internal_error(format!(
            "绑定层运行时初始化失败：{detail}"
        ))),
    }
}

/// 把异步结果 settle 到 `JsPromise`：工作提交到绑定层运行时，结果经
/// `Channel` 回投 JS 线程后执行 `settle`；`ChipsError` 统一抛出。
pub(crate) fn spawn_result<T, F, S>(
    deferred: Deferred,
    channel: Channel,
    future: F,
    settle: S,
) -> Result<(), ChipsError>
where
    T: Send + 'static,
    F: Future<Output = Result<T, ChipsError>> + Send + 'static,
    S: for<'a> FnOnce(&mut Cx<'a>, T) -> JsResult<'a, JsValue> + Send + 'static,
{
    runtime()?.spawn(async move {
        let outcome = future.await;
        deferred.settle_with(&channel, move |mut cx| match outcome {
            Ok(value) => settle(&mut cx, value),
            Err(error) => crate::error::throw_chips_error(&mut cx, error),
        });
    });
    Ok(())
}

/// 把一个纯数据值 settle 为 JS 值（`serde_json::Value` 经 [`crate::convert`]）。
pub(crate) fn settle_json<'a>(cx: &mut Cx<'a>, value: serde_json::Value) -> JsResult<'a, JsValue> {
    crate::convert::json_to_js(cx, &value, "")
}

/// 把 `u64` ID 转为 `number`；超过 2^53 抛出 `NATIVE_VALUE_OUT_OF_RANGE`。
pub(crate) fn id_to_js_number<'a>(cx: &mut Cx<'a>, id: u64) -> JsResult<'a, JsNumber> {
    match crate::convert::safe_u64_number(id, "") {
        Ok(value) => Ok(cx.number(value)),
        Err(issue) => crate::error::throw_chips_error(cx, issue.into_error()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_runtime_is_shared_and_usable() {
        let first = runtime().expect("运行时必须可创建");
        let second = runtime().expect("运行时必须复用");
        assert!(std::ptr::eq(first, second));
    }
}
