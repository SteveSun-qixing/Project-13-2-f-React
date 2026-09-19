//! 二进制信封 `{ json, bin }`（《Bridge 三层设计》§3.6）。
//!
//! - `json`：结构化 JSON 值；schema 中标记 `x-chips-binary` 的字段，其值替换
//!   为 `bin` 表键（JSON Pointer）；
//! - `bin`：二进制表，键为 `json` 中引用名，值为字节。
//!
//! Neon 边界二进制**一次拷贝**：JS → Rust 经 `as_slice` 借用后复制一次为
//! `Vec<u8>`；Rust → JS 经 `JsUint8Array::from_slice` 复制一次进 JS 堆。
//! 不经过 base64 编解码，也不产生第二份副本。
//!
//! 本模块的编解码入口由 Bridge 能力导出消费（`bridgeRequest` 等被工单005
//! 阻塞）：在对应导出落地前仅由单测覆盖，统一关闭 `dead_code` 告警，避免把
//! "待接线"误报为死代码；导出落地时随该告警一并移除本属性。

#![allow(dead_code)]

use std::collections::BTreeMap;

use chips_core::ChipsError;
use neon::prelude::*;
use neon::types::buffer::TypedArray;
use serde_json::Value;

use crate::convert::{escape_pointer_segment, json_to_js};

/// 信封结构错误统一使用的错误码（缺键、多余键、指针非法）。
pub const ENVELOPE_INVALID_INPUT_CODE: &str = "BRIDGE_INVALID_INPUT";

/// 从 JS `bin` 表读取字节；值为 `Uint8Array` 或 `Buffer`，各复制一次。
///
/// 表本身缺省（`undefined` / `null`）时返回空表。
pub fn bin_from_js<'a, C: Context<'a>>(
    cx: &mut C,
    bin: Option<Handle<'a, JsObject>>,
) -> Result<BTreeMap<String, Vec<u8>>, ChipsError> {
    let mut table = BTreeMap::new();
    let Some(bin) = bin else {
        return Ok(table);
    };

    let names = bin
        .get_own_property_names(cx)
        .map_err(|_| envelope_error("二进制表读取失败，应为键与 Uint8Array 的普通对象"))?;
    for index in 0..names.len(cx) {
        let name = names
            .get::<JsString, _, _>(cx, index)
            .map_err(|_| envelope_error("二进制表键必须是字符串"))?;
        let key = name.value(cx);
        let entry = bin
            .get::<JsValue, _, _>(cx, name)
            .map_err(|_| envelope_error("二进制表值读取失败"))?;
        let bytes = binary_bytes(cx, &entry)
            .ok_or_else(|| envelope_error("二进制表值必须是 Uint8Array 或 Buffer"))?;
        table.insert(key, bytes);
    }
    Ok(table)
}

/// 把字节表写为 JS 对象；每个条目复制一次进 `Uint8Array`。
pub fn bin_to_js<'a, C: Context<'a>>(
    cx: &mut C,
    bin: &BTreeMap<String, Vec<u8>>,
) -> JsResult<'a, JsObject> {
    let object = JsObject::new(cx);
    for (key, bytes) in bin {
        let value = JsUint8Array::from_slice(cx, bytes)?;
        object.set(cx, key.as_str(), value)?;
    }
    Ok(object)
}

/// 把 `json` 与 `bin` 合并为一个 JS 值：命中的键位置输出 `Uint8Array`。
///
/// 命中判定按 JSON Pointer 精确匹配；未命中位置按 [`json_to_js`] 映射。
pub fn json_with_bin_to_js<'a, C: Context<'a>>(
    cx: &mut C,
    json: &Value,
    bin: &BTreeMap<String, Vec<u8>>,
    pointer: &str,
) -> JsResult<'a, JsValue> {
    if let Some(bytes) = bin.get(pointer) {
        return Ok(JsUint8Array::from_slice(cx, bytes)?.upcast());
    }
    match json {
        Value::Array(items) => {
            let array = JsArray::new(cx, items.len());
            for (index, item) in items.iter().enumerate() {
                let item_pointer = format!("{pointer}/{index}");
                let value = json_with_bin_to_js(cx, item, bin, &item_pointer)?;
                array.set(cx, index as u32, value)?;
            }
            Ok(array.upcast())
        }
        Value::Object(entries) => {
            let object = JsObject::new(cx);
            for (key, entry) in entries {
                let entry_pointer = format!("{pointer}/{}", escape_pointer_segment(key));
                let value = json_with_bin_to_js(cx, entry, bin, &entry_pointer)?;
                object.set(cx, key.as_str(), value)?;
            }
            Ok(object.upcast())
        }
        _ => json_to_js(cx, json, pointer),
    }
}

/// 校验 `bin` 表的每个键都在 `json` 中命中引用点（`json` 侧为字符串占位）。
///
/// 缺键、多余键与非法指针返回 `BRIDGE_INVALID_INPUT`；字节长度上限由 schema
/// 声明的约束在 Bridge 层判定，不在信封层重复。
pub fn validate_bin_table(json: &Value, bin: &BTreeMap<String, Vec<u8>>) -> Result<(), ChipsError> {
    for key in bin.keys() {
        let target = resolve_pointer(json, key)
            .ok_or_else(|| envelope_error(format!("二进制表存在多余键或指针无法解析：{key}")))?;
        if !target.is_string() {
            return Err(envelope_error(format!(
                "二进制表的引用位置不是字符串占位：{key}"
            )));
        }
    }
    Ok(())
}

/// 按 JSON Pointer（RFC 6901）解析值；根指针为空串。
#[must_use]
pub fn resolve_pointer<'a>(json: &'a Value, pointer: &str) -> Option<&'a Value> {
    if pointer.is_empty() {
        return Some(json);
    }
    let mut current = json;
    for segment in pointer.split('/').skip(1) {
        let segment = unescape_pointer_segment(segment)?;
        current = match current {
            Value::Object(entries) => entries.get(&segment)?,
            Value::Array(items) => {
                let index: usize = segment.parse().ok()?;
                items.get(index)?
            }
            _ => return None,
        };
    }
    Some(current)
}

/// 还原 JSON Pointer 路径段（`~1` → `/`、`~0` → `~`）。
#[must_use]
pub fn unescape_pointer_segment(segment: &str) -> Option<String> {
    let mut decoded = String::with_capacity(segment.len());
    let mut characters = segment.chars();
    while let Some(character) = characters.next() {
        if character != '~' {
            decoded.push(character);
            continue;
        }
        match characters.next() {
            Some('0') => decoded.push('~'),
            Some('1') => decoded.push('/'),
            _ => return None,
        }
    }
    Some(decoded)
}

/// 从 JS 值读取二进制：`Buffer` 与 `Uint8Array` 接受，各复制一次。
fn binary_bytes<'a, C: Context<'a>>(cx: &mut C, value: &Handle<'a, JsValue>) -> Option<Vec<u8>> {
    if let Ok(buffer) = value.downcast::<JsBuffer, _>(cx) {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(buffer.as_slice(cx));
        return Some(bytes);
    }
    if let Ok(array) = value.downcast::<JsUint8Array, _>(cx) {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(array.as_slice(cx));
        return Some(bytes);
    }
    None
}

/// 构造信封结构错误。
fn envelope_error(message: impl Into<String>) -> ChipsError {
    ChipsError::new(ENVELOPE_INVALID_INPUT_CODE, message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_resolve_pointer_root_and_nested() {
        let value = json!({ "data": { "blob": "b1" }, "items": [{ "img": "b2" }] });
        assert_eq!(resolve_pointer(&value, ""), Some(&value));
        assert_eq!(resolve_pointer(&value, "/data/blob"), Some(&json!("b1")));
        assert_eq!(resolve_pointer(&value, "/items/0/img"), Some(&json!("b2")));
        assert_eq!(resolve_pointer(&value, "/items/2/img"), None);
        assert_eq!(resolve_pointer(&value, "/missing"), None);
    }

    #[test]
    fn test_resolve_pointer_escaped_segments() {
        let value = json!({ "a/b": { "c~d": "x" } });
        assert_eq!(resolve_pointer(&value, "/a~1b/c~0d"), Some(&json!("x")));
        assert_eq!(resolve_pointer(&value, "/a~b"), None);
        assert_eq!(resolve_pointer(&value, "/a~2b"), None);
    }

    #[test]
    fn test_resolve_pointer_traverses_into_scalar_and_bad_index() {
        let value = json!({ "data": { "blob": "b1" }, "items": [{ "img": "b2" }] });
        // 数组段解析为非数字索引 → `None`。
        assert_eq!(resolve_pointer(&value, "/items/x"), None);
        // 已落到标量后继续下钻 → `None`（当前节点既非对象也非数组）。
        assert_eq!(resolve_pointer(&value, "/data/blob/deeper"), None);
        // 空对象键可寻址（RFC 6901 允许空段）。
        let with_empty = json!({ "": "root-key" });
        assert_eq!(resolve_pointer(&with_empty, "/"), Some(&json!("root-key")));
    }

    #[test]
    fn test_unescape_pointer_segment_identity_and_edge() {
        assert_eq!(unescape_pointer_segment("").as_deref(), Some(""));
        assert_eq!(unescape_pointer_segment("plain").as_deref(), Some("plain"));
        assert_eq!(unescape_pointer_segment("~01").as_deref(), Some("~1"));
        assert_eq!(unescape_pointer_segment("~1~0").as_deref(), Some("/~"));
        // 结尾裸 `~` 与未知转义均判定为非法指针。
        assert_eq!(unescape_pointer_segment("~"), None);
        assert_eq!(unescape_pointer_segment("x~9"), None);
    }

    #[test]
    fn test_unescape_pointer_segment_rejects_invalid() {
        assert_eq!(unescape_pointer_segment("a~1b").as_deref(), Some("a/b"));
        assert_eq!(unescape_pointer_segment("a~0b").as_deref(), Some("a~b"));
        assert_eq!(unescape_pointer_segment("a~"), None);
        assert_eq!(unescape_pointer_segment("a~2"), None);
    }

    #[test]
    fn test_validate_bin_table_accepts_matching_placeholders() {
        let value = json!({ "data": "b1", "nested": { "image": "b2" } });
        let mut bin = BTreeMap::new();
        bin.insert("/data".to_owned(), vec![1, 2, 3]);
        bin.insert("/nested/image".to_owned(), vec![4]);
        assert!(validate_bin_table(&value, &bin).is_ok());
    }

    #[test]
    fn test_validate_bin_table_rejects_extra_key() {
        let value = json!({ "data": "b1" });
        let mut bin = BTreeMap::new();
        bin.insert("/extra".to_owned(), vec![9]);
        let error = validate_bin_table(&value, &bin).expect_err("多余键必须拒绝");
        assert_eq!(error.code(), ENVELOPE_INVALID_INPUT_CODE);
    }

    #[test]
    fn test_validate_bin_table_rejects_non_string_placeholder() {
        let value = json!({ "data": 7 });
        let mut bin = BTreeMap::new();
        bin.insert("/data".to_owned(), vec![9]);
        assert!(validate_bin_table(&value, &bin).is_err());
    }

    #[test]
    fn test_validate_bin_table_accepts_empty_and_root_pointer() {
        // 空表：无需任何引用点，恒通过。
        let value = json!({ "data": "b1" });
        assert!(validate_bin_table(&value, &BTreeMap::new()).is_ok());
        // 根指针指向字符串本身：整段即二进制占位。
        let root = json!("whole");
        let mut bin = BTreeMap::new();
        bin.insert(String::new(), vec![1, 2]);
        assert!(validate_bin_table(&root, &bin).is_ok());
    }
}
