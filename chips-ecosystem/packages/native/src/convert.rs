//! `Rust ↔ JS` 值映射（《核心接口规范》§8.2）。
//!
//! 映射规则：
//!
//! - 标量严格对应：`bool` / 整数 / `f64`（拒绝 `NaN` 与 `Infinity`）/ 字符串；
//! - `u64` 与整数仅在 `< 2^53` 时可表示，超出返回 `NATIVE_VALUE_OUT_OF_RANGE`；
//! - `Option::None` 缺省一律 `undefined`，不写 `null`（DTO 经
//!   `serde_json::Value` 中转，`None` 字段在序列化时省略）；
//! - 普通对象 / 数组按本表递归；函数、类实例、`Symbol`、DOM 对象、`Error`、
//!   `BigInt`、`ArrayBuffer` 与 TypedArray（二进制走 [`crate::envelope`]）拒绝；
//! - 非法 UTF-16 序列拒绝，不静默替换。

use neon::prelude::*;
use neon::types::JsBigInt;
use serde_json::{Map, Number, Value};

use crate::error::{type_unsupported, value_out_of_range};

/// JS 安全整数上限：可精确表示且不丢精度的最大整数（`2^53`）。
pub const MAX_SAFE_INTEGER: u64 = 1 << 53;

/// 转换诊断：出错的 JSON Pointer 位置与原因。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConvertIssue {
    /// 值类型不可跨边界传输。
    TypeUnsupported {
        /// 出错位置的 JSON Pointer（根为 `""`）。
        pointer: String,
        /// 一句话原因（简体中文）。
        detail: &'static str,
    },
    /// 数值超出可表示范围。
    ValueOutOfRange {
        /// 出错位置的 JSON Pointer。
        pointer: String,
        /// 一句话原因（简体中文）。
        detail: &'static str,
    },
    /// 非有限浮点数（`NaN` / `Infinity`）。
    NonFiniteNumber {
        /// 出错位置的 JSON Pointer。
        pointer: String,
    },
}

impl ConvertIssue {
    /// 归一为跨边界 `ChipsError`。
    #[must_use]
    pub fn into_error(self) -> chips_core::ChipsError {
        match self {
            Self::TypeUnsupported { pointer, detail } => type_unsupported(&pointer, detail),
            Self::ValueOutOfRange { pointer, detail } => value_out_of_range(&pointer, detail),
            Self::NonFiniteNumber { pointer } => {
                value_out_of_range(&pointer, "NaN / Infinity 不可传输")
            }
        }
    }

    /// 出错位置的 JSON Pointer。
    #[must_use]
    #[allow(dead_code)] // 诊断接口：转换问题定位；当前仅由单测消费。
    pub fn pointer(&self) -> &str {
        match self {
            Self::TypeUnsupported { pointer, .. }
            | Self::ValueOutOfRange { pointer, .. }
            | Self::NonFiniteNumber { pointer } => pointer,
        }
    }
}

/// 转义 JSON Pointer 的单个路径段（RFC 6901：`~` → `~0`、`/` → `~1`）。
#[must_use]
pub fn escape_pointer_segment(segment: &str) -> String {
    let mut escaped = String::with_capacity(segment.len());
    for character in segment.chars() {
        match character {
            '~' => escaped.push_str("~0"),
            '/' => escaped.push_str("~1"),
            other => escaped.push(other),
        }
    }
    escaped
}

/// 把 `u64` 校验为 JS 安全整数并转为 `f64`。
pub fn safe_u64_number(value: u64, pointer: &str) -> Result<f64, ConvertIssue> {
    if value < MAX_SAFE_INTEGER {
        Ok(value as f64)
    } else {
        Err(ConvertIssue::ValueOutOfRange {
            pointer: pointer.to_owned(),
            detail: "整数超过 2^53，跨边界将丢失精度",
        })
    }
}

/// UTF-16 序列转 Rust 字符串；存在孤立代理对时返回 `None`。
#[must_use]
pub fn utf16_to_string(units: &[u16]) -> Option<String> {
    String::from_utf16(units).ok()
}

/// `serde_json` 数字转 JS 数值：`u64 ≥ 2^53` 拒绝，`f64` 拒绝非有限。
pub fn json_number_to_js(number: &Number, pointer: &str) -> Result<f64, ConvertIssue> {
    if let Some(value) = number.as_u64() {
        return safe_u64_number(value, pointer);
    }
    if let Some(value) = number.as_i64() {
        let magnitude = value.unsigned_abs();
        if magnitude >= MAX_SAFE_INTEGER {
            return Err(ConvertIssue::ValueOutOfRange {
                pointer: pointer.to_owned(),
                detail: "整数超过 2^53，跨边界将丢失精度",
            });
        }
        return Ok(value as f64);
    }
    match number.as_f64() {
        Some(value) if value.is_finite() => Ok(value),
        _ => Err(ConvertIssue::NonFiniteNumber {
            pointer: pointer.to_owned(),
        }),
    }
}

/// JS 数值（`f64`）转 `serde_json` 数字：整数保型，非有限拒绝。
pub fn js_number_to_json(value: f64, pointer: &str) -> Result<Value, ConvertIssue> {
    if !value.is_finite() {
        return Err(ConvertIssue::NonFiniteNumber {
            pointer: pointer.to_owned(),
        });
    }
    if value.fract() == 0.0 {
        if value >= -(MAX_SAFE_INTEGER as f64) && value <= MAX_SAFE_INTEGER as f64 {
            return Ok(Value::Number(Number::from(value as i64)));
        }
        if let Some(number) = Number::from_f64(value) {
            return Ok(Value::Number(number));
        }
    }
    Number::from_f64(value)
        .map(Value::Number)
        .ok_or_else(|| ConvertIssue::NonFiniteNumber {
            pointer: pointer.to_owned(),
        })
}

/// `serde_json::Value` 转 JS 值；DTO 与错误详情经此中转。
///
/// 失败抛出 `ChipsError`（`NATIVE_*`），不产生部分构造的对象。
pub fn json_to_js<'a, C: Context<'a>>(
    cx: &mut C,
    value: &Value,
    pointer: &str,
) -> JsResult<'a, JsValue> {
    match value {
        Value::Null => Ok(cx.null().upcast()),
        Value::Bool(value) => Ok(cx.boolean(*value).upcast()),
        Value::Number(number) => match json_number_to_js(number, pointer) {
            Ok(value) => Ok(cx.number(value).upcast()),
            Err(issue) => crate::error::throw_chips_error(cx, issue.into_error()),
        },
        Value::String(value) => Ok(cx.string(value).upcast()),
        Value::Array(items) => {
            let array = JsArray::new(cx, items.len());
            for (index, item) in items.iter().enumerate() {
                let item_pointer = format!("{pointer}/{index}");
                let js_item = json_to_js(cx, item, &item_pointer)?;
                array.set(cx, index as u32, js_item)?;
            }
            Ok(array.upcast())
        }
        Value::Object(entries) => {
            let object = JsObject::new(cx);
            for (key, entry) in entries {
                let entry_pointer = format!("{pointer}/{}", escape_pointer_segment(key));
                let js_entry = json_to_js(cx, entry, &entry_pointer)?;
                object.set(cx, key.as_str(), js_entry)?;
            }
            Ok(object.upcast())
        }
    }
}

/// JS 值转 `serde_json::Value`；不可传输值返回 [`ConvertIssue`]。
///
/// 对象自身的 `undefined` 属性视为缺省并省略；数组元素与根位置的
/// `undefined` 无法用 JSON 表达，返回类型错误。
///
/// 输出为纯 Rust 值：句柄生命周期 `'v` 与上下文生命周期 `'a` 相互独立，
/// 使 `to_future` 回调（两生命周期必然不同）也能复用本函数（§8.3 规则 7）。
pub fn js_to_json<'a, 'v, C: Context<'a>>(
    cx: &mut C,
    value: &Handle<'v, JsValue>,
) -> Result<Value, ConvertIssue> {
    let mut pointer = String::new();
    convert_js_value(cx, value, &mut pointer)
}

fn convert_js_value<'a, 'v, C: Context<'a>>(
    cx: &mut C,
    value: &Handle<'v, JsValue>,
    pointer: &mut String,
) -> Result<Value, ConvertIssue> {
    if value.is_a::<JsUndefined, _>(cx) {
        return Err(ConvertIssue::TypeUnsupported {
            pointer: pointer.clone(),
            detail: "undefined 无法用 JSON 表达",
        });
    }
    if value.is_a::<JsNull, _>(cx) {
        return Ok(Value::Null);
    }
    if let Ok(boolean) = value.downcast::<JsBoolean, _>(cx) {
        return Ok(Value::Bool(boolean.value(cx)));
    }
    if let Ok(number) = value.downcast::<JsNumber, _>(cx) {
        return js_number_to_json(number.value(cx), pointer);
    }
    if let Ok(string) = value.downcast::<JsString, _>(cx) {
        let units = string.to_utf16(cx);
        return utf16_to_string(&units).map(Value::String).ok_or_else(|| {
            ConvertIssue::TypeUnsupported {
                pointer: pointer.clone(),
                detail: "字符串包含非法 UTF-16 序列",
            }
        });
    }
    if value.is_a::<JsBigInt, _>(cx) {
        return Err(ConvertIssue::TypeUnsupported {
            pointer: pointer.clone(),
            detail: "BigInt 不可传输",
        });
    }
    if value.is_a::<JsError, _>(cx) {
        return Err(ConvertIssue::TypeUnsupported {
            pointer: pointer.clone(),
            detail: "Error 实例不可传输，请使用 ChipsError 同构对象",
        });
    }
    if value.is_a::<JsBuffer, _>(cx)
        || value.is_a::<JsUint8Array, _>(cx)
        || value.is_a::<JsArrayBuffer, _>(cx)
        || is_other_typed_array(cx, value)
    {
        return Err(ConvertIssue::TypeUnsupported {
            pointer: pointer.clone(),
            detail: "二进制必须经 { json, bin } 信封承载",
        });
    }
    if value.is_a::<JsArray, _>(cx) {
        let array =
            value
                .downcast::<JsArray, _>(cx)
                .map_err(|_| ConvertIssue::TypeUnsupported {
                    pointer: pointer.clone(),
                    detail: "数组读取失败",
                })?;
        return convert_js_array(cx, &array, pointer);
    }
    if value.is_a::<JsFunction, _>(cx) {
        return Err(ConvertIssue::TypeUnsupported {
            pointer: pointer.clone(),
            detail: "函数不可传输",
        });
    }
    if value.is_a::<JsObject, _>(cx) {
        let object =
            value
                .downcast::<JsObject, _>(cx)
                .map_err(|_| ConvertIssue::TypeUnsupported {
                    pointer: pointer.clone(),
                    detail: "对象读取失败",
                })?;
        return convert_js_object(cx, &object, pointer);
    }
    Err(ConvertIssue::TypeUnsupported {
        pointer: pointer.clone(),
        detail: "值类型不在传输白名单内",
    })
}

fn convert_js_array<'a, 'v, C: Context<'a>>(
    cx: &mut C,
    array: &Handle<'v, JsArray>,
    pointer: &mut String,
) -> Result<Value, ConvertIssue> {
    let length = array.len(cx) as usize;
    let mut items = Vec::with_capacity(length);
    for index in 0..length {
        let item = array.get::<JsValue, _, _>(cx, index as u32).map_err(|_| {
            ConvertIssue::TypeUnsupported {
                pointer: pointer.clone(),
                detail: "数组元素读取失败",
            }
        })?;
        let marker = pointer.len();
        pointer.push('/');
        pointer.push_str(&index.to_string());
        let converted = convert_js_value(cx, &item, pointer);
        pointer.truncate(marker);
        items.push(converted?);
    }
    Ok(Value::Array(items))
}

fn convert_js_object<'a, 'v, C: Context<'a>>(
    cx: &mut C,
    object: &Handle<'v, JsObject>,
    pointer: &mut String,
) -> Result<Value, ConvertIssue> {
    if !is_plain_object(cx, object).unwrap_or(false) {
        return Err(ConvertIssue::TypeUnsupported {
            pointer: pointer.clone(),
            detail: "类实例或宿主对象不可传输",
        });
    }
    let names = object
        .get_own_property_names(cx)
        .map_err(|_| ConvertIssue::TypeUnsupported {
            pointer: pointer.clone(),
            detail: "对象属性枚举失败",
        })?;
    let mut entries = Map::new();
    for index in 0..names.len(cx) {
        let name =
            names
                .get::<JsString, _, _>(cx, index)
                .map_err(|_| ConvertIssue::TypeUnsupported {
                    pointer: pointer.clone(),
                    detail: "对象键读取失败",
                })?;
        let key = name.value(cx);
        let entry =
            object
                .get::<JsValue, _, _>(cx, name)
                .map_err(|_| ConvertIssue::TypeUnsupported {
                    pointer: pointer.clone(),
                    detail: "对象属性读取失败",
                })?;
        if entry.is_a::<JsUndefined, _>(cx) {
            continue;
        }
        let marker = pointer.len();
        pointer.push('/');
        pointer.push_str(&escape_pointer_segment(&key));
        let converted = convert_js_value(cx, &entry, pointer);
        pointer.truncate(marker);
        entries.insert(key, converted?);
    }
    Ok(Value::Object(entries))
}

/// 普通对象判定：原型为 `null` 或 `Object.prototype`。
pub(crate) fn is_plain_object<'a, 'v, C: Context<'a>>(
    cx: &mut C,
    object: &Handle<'v, JsObject>,
) -> NeonResult<bool> {
    let global = cx.global_object();
    let object_constructor: Handle<JsFunction> = global.get(cx, "Object")?;
    let get_prototype: Handle<JsFunction> = object_constructor.get(cx, "getPrototypeOf")?;
    let prototype = get_prototype.call(cx, global.upcast::<JsValue>(), [object.upcast()])?;
    if prototype.is_a::<JsNull, _>(cx) {
        return Ok(true);
    }
    let object_prototype: Handle<JsValue> = object_constructor.get(cx, "prototype")?;
    Ok(prototype.strict_equals(cx, object_prototype))
}

/// 除 `Uint8Array` 外的 TypedArray（`Float32Array` 等）判定。
fn is_other_typed_array<'a, 'v, C: Context<'a>>(cx: &mut C, value: &Handle<'v, JsValue>) -> bool {
    value.is_a::<JsInt8Array, _>(cx)
        || value.is_a::<JsUint16Array, _>(cx)
        || value.is_a::<JsInt16Array, _>(cx)
        || value.is_a::<JsUint32Array, _>(cx)
        || value.is_a::<JsInt32Array, _>(cx)
        || value.is_a::<JsFloat32Array, _>(cx)
        || value.is_a::<JsFloat64Array, _>(cx)
        || value.is_a::<JsBigInt64Array, _>(cx)
        || value.is_a::<JsBigUint64Array, _>(cx)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escape_pointer_segment() {
        assert_eq!(escape_pointer_segment("data"), "data");
        assert_eq!(escape_pointer_segment("a/b"), "a~1b");
        assert_eq!(escape_pointer_segment("a~b"), "a~0b");
        assert_eq!(escape_pointer_segment("~1"), "~01");
    }

    #[test]
    fn test_safe_u64_number_accepts_below_limit() {
        assert_eq!(safe_u64_number(0, "").expect("0"), 0.0);
        assert_eq!(safe_u64_number(1, "").expect("1"), 1.0);
        assert_eq!(
            safe_u64_number(MAX_SAFE_INTEGER - 1, "").expect("2^53-1"),
            (MAX_SAFE_INTEGER - 1) as f64
        );
    }

    #[test]
    fn test_safe_u64_number_rejects_at_or_above_limit() {
        let issue = safe_u64_number(MAX_SAFE_INTEGER, "/size").expect_err("2^53 必须拒绝");
        assert_eq!(issue.pointer(), "/size");
        assert!(matches!(issue, ConvertIssue::ValueOutOfRange { .. }));
    }

    #[test]
    fn test_json_number_to_js_integers() {
        let number = Number::from(42_i64);
        assert_eq!(json_number_to_js(&number, "").expect("42"), 42.0);
        let number = Number::from(u64::MAX);
        assert!(json_number_to_js(&number, "").is_err());
    }

    #[test]
    fn test_json_number_to_js_negative_integers() {
        // 负整数走 `as_i64` 分支；绝对值小于 2^53 时精确保留符号。
        let number = Number::from(-42_i64);
        assert_eq!(json_number_to_js(&number, "").expect("-42"), -42.0);
        let number = Number::from(i64::MIN);
        let issue = json_number_to_js(&number, "/n").expect_err("2^63 必须拒绝");
        assert!(matches!(issue, ConvertIssue::ValueOutOfRange { .. }));
        assert_eq!(issue.pointer(), "/n");
    }

    #[test]
    fn test_json_number_to_js_floats_and_non_finite() {
        let number = Number::from_f64(3.5).expect("3.5");
        assert_eq!(json_number_to_js(&number, "").expect("3.5"), 3.5);
        // 非有限浮点在 `serde_json` 构造期即被拒（`from_f64(NaN)` 返回 `None`），
        // 因此 `json_number_to_js` 的非有限分支只能经由 `as_f64` 兜底命中；
        // 这里断言有限浮点必然映射为有限 `f64`，锁定与 §8.2「拒绝 NaN / Infinity」的一致性。
        let number = Number::from_f64(-1.25).expect("-1.25");
        assert!(json_number_to_js(&number, "").expect("-1.25").is_finite());
        assert!(Number::from_f64(f64::NAN).is_none());
        assert!(Number::from_f64(f64::INFINITY).is_none());
    }

    #[test]
    fn test_js_number_to_json_keeps_integers_and_rejects_non_finite() {
        assert_eq!(js_number_to_json(7.0, "").expect("7"), Value::from(7_i64));
        assert_eq!(
            js_number_to_json(-3.5, "").expect("-3.5"),
            Value::from(-3.5)
        );
        let issue = js_number_to_json(f64::NAN, "/n").expect_err("NaN 必须拒绝");
        assert!(matches!(issue, ConvertIssue::NonFiniteNumber { .. }));
        assert_eq!(issue.pointer(), "/n");
        assert!(js_number_to_json(f64::INFINITY, "").is_err());
    }

    #[test]
    fn test_js_number_to_json_large_integer_stays_number() {
        let value = js_number_to_json(1e21, "/big").expect("1e21");
        assert!(value.is_number());
        assert_eq!(value.as_f64(), Some(1e21));
    }

    #[test]
    fn test_js_number_to_json_at_safe_limit_stays_number() {
        // 恰好 `2^53`（含）以内保型为 `i64`。
        let at_limit = js_number_to_json(MAX_SAFE_INTEGER as f64, "").expect("2^53");
        assert_eq!(at_limit, Value::from(MAX_SAFE_INTEGER as i64));
        // 越过 `2^53` 的整值不转 `i64`，改由 `Number::from_f64` 保浮点形状。
        let above = js_number_to_json((MAX_SAFE_INTEGER + 2) as f64, "/edge").expect("2^53+2");
        assert!(above.is_number());
        assert_eq!(above.as_f64(), Some((MAX_SAFE_INTEGER + 2) as f64));
    }

    #[test]
    fn test_utf16_to_string_accepts_valid_pairs() {
        let units = [0x0048, 0x0069, 0xD83D, 0xDE00];
        assert_eq!(utf16_to_string(&units).as_deref(), Some("Hi😀"));
    }

    #[test]
    fn test_utf16_to_string_rejects_lone_surrogates() {
        assert!(utf16_to_string(&[0xD83D]).is_none());
        assert!(utf16_to_string(&[0xDE00]).is_none());
        assert!(utf16_to_string(&[0xD83D, 0x0041]).is_none());
    }

    #[test]
    fn test_convert_issue_maps_to_chips_error_codes() {
        let issue = ConvertIssue::TypeUnsupported {
            pointer: "/x".to_owned(),
            detail: "函数不可传输",
        };
        assert_eq!(
            issue.into_error().code(),
            crate::error::NATIVE_TYPE_UNSUPPORTED
        );
        let issue = ConvertIssue::ValueOutOfRange {
            pointer: "/size".to_owned(),
            detail: "整数超过 2^53，跨边界将丢失精度",
        };
        assert_eq!(
            issue.into_error().code(),
            crate::error::NATIVE_VALUE_OUT_OF_RANGE
        );
        let issue = ConvertIssue::NonFiniteNumber {
            pointer: "/y".to_owned(),
        };
        assert_eq!(
            issue.into_error().code(),
            crate::error::NATIVE_VALUE_OUT_OF_RANGE
        );
    }
}
