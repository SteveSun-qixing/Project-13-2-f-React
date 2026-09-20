//! 跨语言错误归一（《核心接口规范》§8.5）。
//!
//! Rust `ChipsError` 映射为携带 `code` / `message` / `details` / `retryable`
//! 的 JS `Error` 实例；JS 异常反向归一为 `ChipsError`（未识别异常落
//! `BRIDGE_INTERNAL`）。映射后立即抛出，不返回替代结构混入成功路径。

use chips_core::ChipsError;
use neon::prelude::*;
use serde_json::Value as JsonValue;

/// 绑定层类型不受支持时使用的错误码。
pub const NATIVE_TYPE_UNSUPPORTED: &str = "NATIVE_TYPE_UNSUPPORTED";

/// 绑定层数值超出可表示范围（`u64 ≥ 2^53`、整数溢出）时使用的错误码。
pub const NATIVE_VALUE_OUT_OF_RANGE: &str = "NATIVE_VALUE_OUT_OF_RANGE";

/// 绑定层未识别异常的兜底错误码（`<DOMAIN>_INTERNAL` 约定）。
pub const NATIVE_INTERNAL: &str = "NATIVE_INTERNAL";

/// 未识别 JS 异常归一后的兜底错误码（Bridge 通道级兜底）。
pub const BRIDGE_INTERNAL: &str = "BRIDGE_INTERNAL";

/// 构造绑定层内部错误；诊断不携带堆栈与内部路径。
#[must_use]
pub fn internal_error(message: impl Into<String>) -> ChipsError {
    ChipsError::new(NATIVE_INTERNAL, message)
}

/// 构造类型不受支持错误；`pointer` 为出错的 JSON Pointer 位置。
#[must_use]
pub fn type_unsupported(pointer: &str, detail: &str) -> ChipsError {
    ChipsError::new(NATIVE_TYPE_UNSUPPORTED, format!("值类型不受支持：{detail}"))
        .with_details(serde_json::json!({ "pointer": pointer, "detail": detail }))
}

/// 构造数值越界错误；`pointer` 为出错的 JSON Pointer 位置。
#[must_use]
pub fn value_out_of_range(pointer: &str, detail: &str) -> ChipsError {
    ChipsError::new(
        NATIVE_VALUE_OUT_OF_RANGE,
        format!("值超出可表示范围：{detail}"),
    )
    .with_details(serde_json::json!({ "pointer": pointer, "detail": detail }))
}

/// 把 `ChipsError` 抛出为携带 `code` / `details` / `retryable` 的 JS `Error`。
///
/// `message` 为简体中文面向用户文案；`details` 为普通对象；不携带堆栈。
/// 返回类型泛化为 `V`（不要求 `V: Value`）：调用点直接
/// `return throw_chips_error(...)`，也可作为返回非 JS 值的内部辅助函数
/// （如参数解析）的错误路径。
pub fn throw_chips_error<'a, C: Context<'a>, V>(cx: &mut C, error: ChipsError) -> NeonResult<V> {
    let js_error = JsError::error(cx, error.message())?;

    let code = cx.string(error.code());
    js_error.set(cx, "code", code)?;

    let retryable = cx.boolean(error.retryable());
    js_error.set(cx, "retryable", retryable)?;

    if let Some(details) = error.details() {
        let details = crate::convert::json_to_js(cx, details, "")?;
        js_error.set(cx, "details", details)?;
    }

    cx.throw(js_error.upcast::<JsValue>())
}

/// 把任意 JS 异常值归一为 `ChipsError`。
///
/// 已是 `ChipsError` 同构形状（`code` 为字符串）时原样保留 `code` /
/// `retryable`；其余一律归一为 `BRIDGE_INTERNAL`，不回传堆栈与内部路径。
///
/// 输出为纯 Rust 值：句柄生命周期与上下文生命周期相互独立，
/// `to_future` 回调（§8.3 规则 7）可直接复用。
pub fn chips_error_from_js<'a, 'v, C: Context<'a>>(
    cx: &mut C,
    thrown: Handle<'v, JsValue>,
) -> ChipsError {
    let object = match thrown.downcast::<JsObject, _>(cx) {
        Ok(object) => object,
        Err(_) => return unrecognized_error(),
    };

    let code = match object.get::<JsValue, _, _>(cx, "code") {
        Ok(value) => value
            .downcast::<JsString, _>(cx)
            .map(|value| value.value(cx))
            .ok(),
        Err(_) => None,
    };

    let Some(code) = code.filter(|code| is_normalized_code(code)) else {
        return unrecognized_error();
    };

    let message = object
        .get::<JsValue, _, _>(cx, "message")
        .ok()
        .and_then(|value| {
            value
                .downcast::<JsString, _>(cx)
                .map(|value| value.value(cx))
                .ok()
        })
        .filter(|message| !message.is_empty())
        .unwrap_or_else(|| "插件执行失败".to_owned());

    let retryable = object
        .get::<JsValue, _, _>(cx, "retryable")
        .ok()
        .and_then(|value| value.downcast::<JsBoolean, _>(cx).ok())
        .map(|value| value.value(cx))
        .unwrap_or(false);

    let details = object
        .get::<JsValue, _, _>(cx, "details")
        .ok()
        .and_then(|value| crate::convert::js_to_json(cx, &value).ok())
        .filter(|details| !details.is_null());

    let mut error = ChipsError::new(code, message).with_retryable(retryable);
    if let Some(details) = details {
        error = error.with_details(details);
    }
    error
}

/// 未识别异常：通用文案 + `BRIDGE_INTERNAL`，诊断细节留在宿主日志。
fn unrecognized_error() -> ChipsError {
    ChipsError::new(BRIDGE_INTERNAL, "桥接内部错误")
}

/// 错误码形状校验：`<DOMAIN>_<REASON>`，全大写、下划线分隔。
fn is_normalized_code(code: &str) -> bool {
    !code.is_empty()
        && code
            .bytes()
            .all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit() || byte == b'_')
        && code.contains('_')
}

/// 归一形状的 JSON 值；仅供测试与诊断，不跨边界传输。
#[must_use]
#[allow(dead_code)] // 仅供单测与宿主诊断。
pub fn error_shape(error: &ChipsError) -> JsonValue {
    let mut shape = serde_json::json!({
        "code": error.code(),
        "message": error.message(),
        "retryable": error.retryable(),
    });
    if let Some(details) = error.details() {
        shape["details"] = details.clone();
    }
    shape
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes_are_uppercase_domain_codes() {
        assert!(is_normalized_code("BRIDGE_INTERNAL"));
        assert!(is_normalized_code("KERNEL_SERVICE_NOT_FOUND"));
        assert!(!is_normalized_code("bridge_internal"));
        assert!(!is_normalized_code("NOUNDERSCORE"));
        assert!(!is_normalized_code(""));
    }

    #[test]
    fn test_error_shape_matches_contract() {
        let error = ChipsError::new("BRIDGE_TIMEOUT", "调用超时").with_retryable(true);
        let shape = error_shape(&error);
        assert_eq!(shape["code"], "BRIDGE_TIMEOUT");
        assert_eq!(shape["message"], "调用超时");
        assert_eq!(shape["retryable"], true);
        assert!(shape.get("details").is_none());
    }

    #[test]
    fn test_error_shape_includes_details_when_present() {
        let error = ChipsError::new("KERNEL_SERVICE_NOT_FOUND", "服务缺失")
            .with_details(serde_json::json!({ "name": "logger" }));
        let shape = error_shape(&error);
        assert_eq!(shape["code"], "KERNEL_SERVICE_NOT_FOUND");
        assert_eq!(shape["retryable"], false);
        assert_eq!(shape["details"]["name"], "logger");
    }

    #[test]
    fn test_unrecognized_error_falls_back_to_bridge_internal() {
        let error = unrecognized_error();
        assert_eq!(error.code(), BRIDGE_INTERNAL);
        assert!(!error.retryable());
        assert!(error.details().is_none());
    }

    #[test]
    fn test_is_normalized_code_accepts_digits_and_rejects_malformed() {
        assert!(is_normalized_code("A1_B2"));
        assert!(is_normalized_code("NATIVE_VALUE_OUT_OF_RANGE"));
        // 缺主段 / 缺原因段的下划线形状不被拒绝为“非法字符”，但缺 `_` 一律拒绝。
        assert!(!is_normalized_code("UNDERSCORELESS"));
        // 含小写或非法字符一律拒绝。
        assert!(!is_normalized_code("BRIDGE-INTERNAL"));
        assert!(!is_normalized_code("BRIDGE INTERNAL"));
    }

    #[test]
    fn test_type_unsupported_carries_pointer_details() {
        let error = type_unsupported("/data", "函数不可传输");
        assert_eq!(error.code(), NATIVE_TYPE_UNSUPPORTED);
        assert!(!error.retryable());
        let details = error.details().expect("details 必须存在");
        assert_eq!(details["pointer"], "/data");
    }

    #[test]
    fn test_value_out_of_range_details() {
        let error = value_out_of_range("/size", "超过 2^53");
        assert_eq!(error.code(), NATIVE_VALUE_OUT_OF_RANGE);
        assert_eq!(error.details().expect("details")["detail"], "超过 2^53");
    }

    #[test]
    fn test_internal_error_uses_domain_internal_code() {
        let error = internal_error("模块状态异常");
        assert_eq!(error.code(), NATIVE_INTERNAL);
        assert!(!error.retryable());
    }
}
