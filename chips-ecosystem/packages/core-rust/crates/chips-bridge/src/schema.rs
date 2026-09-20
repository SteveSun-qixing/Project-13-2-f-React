//! JSON Schema 子集编译与输入校验（《Bridge三层设计》§6、《能力契约规范》§五）。
//!
//! 分工：关键字白名单门控与 `$ref` 收口在编译期完成；结构校验委托
//! `jsonschema`（Draft 2020-12，离线编译，不启用任何远程解析特性）；平台
//! 严格语义（`integer` 不接受浮点值、`format` 白名单强制、`x-chips-binary`
//! 二进制信封）由本模块补充扫描，聚合为《能力契约规范》§5.4 的
//! `IInvalidInputDetails` 结构。

use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::sync::Arc;

use serde_json::{Map, Value};
use sha2::{Digest as _, Sha256};

use chips_core::ChipsError;

use crate::constants::{MAX_VALIDATION_ISSUES, SCHEMA_CACHE_CAPACITY};
use crate::error_codes::{BRIDGE_INVALID_INPUT, BRIDGE_INVALID_SCHEMA};

/// 允许的关键字集合（《能力契约规范》§5.1 表；集合外一律拒绝编译）。
pub(crate) const ALLOWED_KEYWORDS: &[&str] = &[
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minProperties",
    "maxProperties",
    "propertyNames",
    "$defs",
    "$ref",
    "allOf",
    "anyOf",
    "oneOf",
    "minLength",
    "maxLength",
    "pattern",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "enum",
    "const",
    "title",
    "description",
    "default",
    "deprecated",
    "format",
    "x-chips-binary",
];

/// JSON Schema 七种原语类型。
const PRIMITIVE_TYPES: &[&str] = &[
    "object", "array", "string", "number", "integer", "boolean", "null",
];

/// `x-chips-binary` 字段登记：顶层属性名与字节上限。
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BinaryField {
    /// 顶层属性名（键引用所在的 `json` 字段）。
    pub name: String,
    /// 字节上限；`None` 表示不额外限制。
    pub max_bytes: Option<u64>,
}

/// 编译完成的校验器；注册项持有，调用期零编译。
#[derive(Debug)]
pub(crate) struct CompiledSchema {
    validator: jsonschema::Validator,
    root: Value,
    binary_fields: Vec<BinaryField>,
}

/// 校验失败的最小单元：JSON Pointer + 关键字 + 简体中文消息。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct Issue {
    pointer: String,
    keyword: String,
    message: String,
}

fn invalid_schema(reason: &str, pointer: &str) -> ChipsError {
    ChipsError::new(
        BRIDGE_INVALID_SCHEMA,
        format!("能力输入 schema 无法编译：{reason}"),
    )
    .with_details(serde_json::json!({ "pointer": pointer, "reason": reason }))
}

/// 转义 JSON Pointer 段（`~0` `~1`）。
fn escape_pointer(segment: &str) -> String {
    segment.replace('~', "~0").replace('/', "~1")
}

fn is_def_name_valid(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
}

/// schema 节点关键字门控。
///
/// `is_direct_property` 仅当本节点是根 `properties` 的直接子级时为 `true`，
/// `x-chips-binary` 只在该位置允许（bin 表键因此是稳定的 JSON Pointer
/// `/<字段名>`）；`$ref` 只允许 `#/$defs/<name>` 内部引用并做循环防护。
fn gate_node(
    node: &Value,
    defs: Option<&Map<String, Value>>,
    pointer: &str,
    is_root: bool,
    is_direct_property: bool,
    visiting: &mut Vec<String>,
) -> Result<Vec<BinaryField>, ChipsError> {
    let Some(object) = node.as_object() else {
        return Err(invalid_schema("schema 节点必须为对象", pointer));
    };
    let mut binary = Vec::new();

    for key in object.keys() {
        if !ALLOWED_KEYWORDS.contains(&key.as_str()) {
            return Err(invalid_schema(
                &format!("关键字 `{key}` 不在平台子集白名单内"),
                pointer,
            ));
        }
    }

    if is_root {
        let type_is_object =
            matches!(object.get("type"), Some(Value::String(text)) if text == "object");
        if !type_is_object {
            return Err(invalid_schema("顶层必须为 type: \"object\"", pointer));
        }
        if object.get("additionalProperties") != Some(&Value::Bool(false)) {
            return Err(invalid_schema(
                "顶层必须显式声明 additionalProperties: false",
                pointer,
            ));
        }
    }

    if let Some(value) = object.get("$ref") {
        let Some(reference) = value.as_str() else {
            return Err(invalid_schema("$ref 必须为字符串", pointer));
        };
        let Some(name) = reference.strip_prefix("#/$defs/") else {
            return Err(invalid_schema(
                "$ref 只允许 #/$defs/<name> 内部引用",
                pointer,
            ));
        };
        if !is_def_name_valid(name) {
            return Err(invalid_schema("$ref 目标名非法", pointer));
        }
        let Some(target) = defs.and_then(|defs| defs.get(name)) else {
            return Err(invalid_schema(
                &format!("$ref 目标 #/$defs/{name} 不存在"),
                pointer,
            ));
        };
        if visiting.iter().any(|visited| visited == name) {
            return Err(invalid_schema(
                &format!("$ref 在 #/$defs/{name} 处形成循环"),
                pointer,
            ));
        }
        visiting.push(name.to_owned());
        let nested = gate_node(
            target,
            defs,
            &format!("{pointer}/$defs/{name}"),
            false,
            false,
            visiting,
        );
        visiting.pop();
        binary.extend(nested?);
    }

    if let Some(value) = object.get("type") {
        let names: Vec<&str> = match value {
            Value::String(single) => vec![single.as_str()],
            Value::Array(items) => {
                let mut names = Vec::with_capacity(items.len());
                for item in items {
                    let Some(single) = item.as_str() else {
                        return Err(invalid_schema("type 数组成员必须为字符串", pointer));
                    };
                    names.push(single);
                }
                names
            }
            _ => return Err(invalid_schema("type 必须为字符串或字符串数组", pointer)),
        };
        for name in names {
            if !PRIMITIVE_TYPES.contains(&name) {
                return Err(invalid_schema(
                    &format!("type `{name}` 不是合法原语类型"),
                    pointer,
                ));
            }
        }
    }

    if let Some(value) = object.get("required") {
        if !value
            .as_array()
            .is_some_and(|items| !items.is_empty() && items.iter().all(Value::is_string))
        {
            return Err(invalid_schema("required 必须为非空字符串数组", pointer));
        }
    }

    if let Some(value) = object.get("enum") {
        if !value.as_array().is_some_and(|items| !items.is_empty()) {
            return Err(invalid_schema("enum 必须为非空数组", pointer));
        }
    }

    if let Some(format_value) = object.get("format") {
        if !format_value.is_string() {
            return Err(invalid_schema("format 必须为字符串", pointer));
        }
    }

    if let Some(binary_value) = object.get("x-chips-binary") {
        if !is_direct_property {
            return Err(invalid_schema(
                "x-chips-binary 只允许声明在顶层 properties 直接子级",
                pointer,
            ));
        }
        if object.contains_key("type") {
            return Err(invalid_schema(
                "声明 x-chips-binary 的属性不得再声明 type",
                pointer,
            ));
        }
        // 《能力契约规范》§5.3：取值为不小于 1 的整数（字节上限）或 true
        // （不额外限制）。外层 `Option` 表示取值是否合法，内层 `Option<u64>`
        // 即登记后的上限（`None` = 不设限）。
        let max_bytes: Option<Option<u64>> = match binary_value {
            Value::Bool(true) => Some(None),
            Value::Number(number) => number.as_u64().filter(|limit| *limit >= 1).map(Some),
            _ => None,
        };
        let Some(max_bytes) = max_bytes else {
            return Err(invalid_schema(
                "x-chips-binary 取值必须为不小于 1 的整数或 true（不额外限制）",
                pointer,
            ));
        };
        let name = pointer
            .strip_prefix('/')
            .filter(|name| !name.is_empty())
            .ok_or_else(|| invalid_schema("x-chips-binary 属性名缺失", pointer))?
            .to_owned();
        binary.push(BinaryField { name, max_bytes });
    }

    if let Some(properties) = object.get("properties") {
        let Some(map) = properties.as_object() else {
            return Err(invalid_schema("properties 必须为对象", pointer));
        };
        for (name, child) in map {
            let child_pointer = format!("{}/{}", pointer, escape_pointer(name));
            binary.extend(gate_node(
                child,
                defs,
                &child_pointer,
                false,
                is_root,
                visiting,
            )?);
        }
    }

    for keyword in ["items", "propertyNames", "additionalProperties"] {
        let Some(child) = object.get(keyword) else {
            continue;
        };
        if keyword == "additionalProperties" && child.is_boolean() {
            continue;
        }
        binary.extend(gate_node(
            child,
            defs,
            &format!("{pointer}/{keyword}"),
            false,
            false,
            visiting,
        )?);
    }

    for keyword in ["allOf", "anyOf", "oneOf"] {
        let Some(items) = object.get(keyword) else {
            continue;
        };
        let Some(items) = items.as_array() else {
            return Err(invalid_schema(
                &format!("{keyword} 必须为非空数组"),
                pointer,
            ));
        };
        if items.is_empty() {
            return Err(invalid_schema(
                &format!("{keyword} 必须为非空数组"),
                pointer,
            ));
        }
        for (index, child) in items.iter().enumerate() {
            binary.extend(gate_node(
                child,
                defs,
                &format!("{pointer}/{keyword}/{index}"),
                false,
                false,
                visiting,
            )?);
        }
    }

    if let Some(defs_value) = object.get("$defs") {
        if !is_root {
            return Err(invalid_schema("$defs 只允许出现在 schema 根部", pointer));
        }
        let Some(defs_map) = defs_value.as_object() else {
            return Err(invalid_schema("$defs 必须为对象", pointer));
        };
        for (name, child) in defs_map {
            if !is_def_name_valid(name) {
                return Err(invalid_schema("$defs 名称非法", pointer));
            }
            gate_node(
                child,
                Some(defs_map),
                &format!("/$defs/{name}"),
                false,
                false,
                visiting,
            )?;
        }
    }

    Ok(binary)
}

fn build_options() -> jsonschema::ValidationOptions {
    jsonschema::options()
        .with_draft(jsonschema::Draft::Draft202012)
        .should_validate_formats(false)
}

/// 编译 schema：关键字门控 + `jsonschema` 离线编译 + 二进制字段登记。
pub(crate) fn compile(schema: &Value) -> Result<Arc<CompiledSchema>, ChipsError> {
    let root_defs = schema.get("$defs").and_then(Value::as_object);
    gate_node(schema, root_defs, "", true, false, &mut Vec::new())?;
    let binary_fields = collect_binary_fields(schema)?;
    let validator = build_options().build(schema).map_err(|error| {
        invalid_schema(
            &format!("meta-schema 或关键字编译失败：{error}"),
            &error.schema_path.to_string(),
        )
    })?;
    Ok(Arc::new(CompiledSchema {
        validator,
        root: schema.clone(),
        binary_fields,
    }))
}

/// 二次遍历收集二进制字段（门控通过后仅根 `properties` 直接子级可能携带）。
fn collect_binary_fields(schema: &Value) -> Result<Vec<BinaryField>, ChipsError> {
    let mut fields = Vec::new();
    let Some(properties) = schema.get("properties").and_then(Value::as_object) else {
        return Ok(fields);
    };
    let root_defs = schema.get("$defs").and_then(Value::as_object);
    for (name, child) in properties {
        let target = resolve_property_schema(child, root_defs)?;
        if let Some(binary_value) = target.get("x-chips-binary") {
            let max_bytes = match binary_value {
                Value::Bool(true) => None,
                Value::Number(number) => number.as_u64().filter(|limit| *limit >= 1),
                _ => None,
            };
            fields.push(BinaryField {
                name: name.clone(),
                max_bytes,
            });
        }
    }
    Ok(fields)
}

/// 解析根属性节点的直接 `$ref` 目标（门控已保证合法与无循环）。
fn resolve_property_schema(
    child: &Value,
    defs: Option<&Map<String, Value>>,
) -> Result<Value, ChipsError> {
    if let Some(reference) = child.get("$ref").and_then(Value::as_str) {
        let name = reference
            .strip_prefix("#/$defs/")
            .ok_or_else(|| invalid_schema("$ref 只允许 #/$defs/<name> 内部引用", ""))?;
        return defs
            .and_then(|defs| defs.get(name))
            .cloned()
            .ok_or_else(|| invalid_schema(&format!("$ref 目标 #/$defs/{name} 不存在"), ""));
    }
    Ok(child.clone())
}

/// schema 内容摘要（SHA-256）；编译缓存的键（《Bridge三层设计》§6.2）。
pub(crate) fn digest(schema: &Value) -> [u8; 32] {
    let bytes = serde_json::to_vec(schema).unwrap_or_default();
    Sha256::digest(bytes).into()
}

/// 共享编译缓存：以内容摘要为键，LRU 淘汰，上限 [`SCHEMA_CACHE_CAPACITY`]。
#[derive(Default)]
pub(crate) struct SchemaCache {
    entries: HashMap<[u8; 32], Arc<CompiledSchema>>,
    order: VecDeque<[u8; 32]>,
}

impl SchemaCache {
    /// 创建一个空缓存。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    fn touch(&mut self, key: &[u8; 32]) {
        if let Some(index) = self.order.iter().position(|item| item == key) {
            if let Some(item) = self.order.remove(index) {
                self.order.push_back(item);
            }
        }
    }

    /// 命中即刷新为最近使用；返回共享的编译产物。
    pub fn get(&mut self, key: &[u8; 32]) -> Option<Arc<CompiledSchema>> {
        if self.is_empty() {
            return None;
        }
        let compiled = self.entries.get(key).cloned()?;
        self.touch(key);
        Some(compiled)
    }

    /// 写入缓存；超过上限按 LRU 淘汰最久未用条目。
    pub fn put(&mut self, key: [u8; 32], compiled: Arc<CompiledSchema>) {
        let existing = self.entries.contains_key(&key);
        if !existing {
            while self.len() >= SCHEMA_CACHE_CAPACITY {
                match self.order.pop_front() {
                    Some(evicted) => {
                        self.entries.remove(&evicted);
                    }
                    None => break,
                }
            }
        }
        self.entries.insert(key, compiled);
        if existing {
            self.touch(&key);
        } else {
            self.order.push_back(key);
        }
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

/// 平台严格语义扫描：`integer` 严格拒绝浮点值、`format` 白名单强制。
///
/// 与实例同步下降；组合子分支全部检查（fail-closed）。这不是通用
/// JSON Schema 求值器，只补充 `jsonschema` 无法表达的平台约束。
fn scan_strict(
    node: &Value,
    defs: Option<&Map<String, Value>>,
    instance: &Value,
    pointer: &str,
    visiting: &mut Vec<String>,
    issues: &mut Vec<Issue>,
) {
    let Some(object) = node.as_object() else {
        return;
    };
    if let Some(reference) = object.get("$ref").and_then(Value::as_str) {
        let Some(name) = reference.strip_prefix("#/$defs/") else {
            return;
        };
        if !visiting.iter().any(|visited| visited == name) {
            if let Some(target) = defs.and_then(|defs| defs.get(name)) {
                visiting.push(name.to_owned());
                scan_strict(target, defs, instance, pointer, visiting, issues);
                visiting.pop();
            }
        }
    }

    match instance {
        Value::Object(map) => {
            let properties = object.get("properties").and_then(Value::as_object);
            let additional = object.get("additionalProperties");
            for (key, value) in map {
                let child_pointer = format!("{pointer}/{}", escape_pointer(key));
                if let Some(child) = properties.and_then(|properties| properties.get(key)) {
                    scan_strict(child, defs, value, &child_pointer, visiting, issues);
                } else if let Some(schema) = additional.filter(|schema| schema.is_object()) {
                    scan_strict(schema, defs, value, &child_pointer, visiting, issues);
                }
            }
        }
        Value::Array(items) => {
            if let Some(child) = object.get("items") {
                for (index, value) in items.iter().enumerate() {
                    scan_strict(
                        child,
                        defs,
                        value,
                        &format!("{pointer}/{index}"),
                        visiting,
                        issues,
                    );
                }
            }
        }
        Value::Number(number) => {
            let expects_integer = match object.get("type") {
                Some(Value::String(single)) => single == "integer",
                Some(Value::Array(names)) => {
                    names.iter().any(|name| name.as_str() == Some("integer"))
                }
                _ => false,
            };
            if expects_integer
                && number.is_f64()
                && number.as_f64().is_some_and(|value| value.fract() == 0.0)
            {
                issues.push(Issue {
                    pointer: pointer.to_owned(),
                    keyword: "type".to_owned(),
                    message: "integer 不接受浮点值".to_owned(),
                });
            }
        }
        Value::String(text) => {
            if let Some(format_name) = object.get("format").and_then(Value::as_str) {
                if let Some(message) = check_format(format_name, text) {
                    issues.push(Issue {
                        pointer: pointer.to_owned(),
                        keyword: "format".to_owned(),
                        message,
                    });
                }
            }
        }
        _ => {}
    }

    for keyword in ["allOf", "anyOf", "oneOf"] {
        if let Some(children) = object.get(keyword).and_then(Value::as_array) {
            for child in children {
                scan_strict(child, defs, instance, pointer, visiting, issues);
            }
        }
    }
}

/// `format` 白名单检查；返回 `Some(消息)` 表示不符合。白名单外为注解、不强制。
fn check_format(name: &str, value: &str) -> Option<String> {
    match name {
        "date-time" if !is_rfc3339_date_time(value) => {
            Some("字符串不符合 date-time（RFC 3339）格式".to_owned())
        }
        "uri" if !is_absolute_uri(value) => Some("字符串不符合 uri（绝对 URI）格式".to_owned()),
        "chips-resource-uri" if !is_chips_resource_uri(value) => {
            Some("字符串不符合 chips-resource-uri 语法".to_owned())
        }
        "chips-credential" if !is_chips_credential_uri(value) => {
            Some("字符串不符合 chips-credential 语法".to_owned())
        }
        _ => None,
    }
}

fn parse_digits(bytes: &[char], start: usize, count: usize) -> Option<u32> {
    if start + count > bytes.len() {
        return None;
    }
    let segment: String = bytes[start..start + count].iter().collect();
    if segment.len() != count || !segment.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    segment.parse::<u32>().ok()
}

/// RFC 3339 date-time（含小数秒、闰秒与时区偏移）。
fn is_rfc3339_date_time(value: &str) -> bool {
    let bytes: Vec<char> = value.chars().collect();
    if bytes.len() < 20 {
        return false;
    }
    if bytes[4] != '-' || bytes[7] != '-' || !matches!(bytes[10], 'T' | 't') {
        return false;
    }
    if bytes[13] != ':' || bytes[16] != ':' {
        return false;
    }
    let (Some(year), Some(month), Some(day)) = (
        parse_digits(&bytes, 0, 4),
        parse_digits(&bytes, 5, 2),
        parse_digits(&bytes, 8, 2),
    ) else {
        return false;
    };
    let (Some(hour), Some(minute), Some(second)) = (
        parse_digits(&bytes, 11, 2),
        parse_digits(&bytes, 14, 2),
        parse_digits(&bytes, 17, 2),
    ) else {
        return false;
    };
    if !(1..=12).contains(&month) || !(1..=days_in_month(year, month)).contains(&day) {
        return false;
    }
    if hour > 23 || minute > 59 || second > 60 {
        return false;
    }
    let mut cursor = 19;
    if bytes.get(cursor) == Some(&'.') {
        cursor += 1;
        let start = cursor;
        while cursor < bytes.len() && bytes[cursor].is_ascii_digit() {
            cursor += 1;
        }
        if cursor == start {
            return false;
        }
    }
    match bytes.get(cursor) {
        Some('Z') | Some('z') => cursor + 1 == bytes.len(),
        Some('+') | Some('-') => {
            if cursor + 6 != bytes.len() || bytes[cursor + 3] != ':' {
                return false;
            }
            parse_digits(&bytes, cursor + 1, 2).is_some_and(|offset| offset <= 23)
                && parse_digits(&bytes, cursor + 4, 2).is_some_and(|offset| offset <= 59)
        }
        _ => false,
    }
}

fn days_in_month(year: u32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 => 29,
        2 => 28,
        _ => 0,
    }
}

/// RFC 3986 绝对 URI：`scheme ":" hier-part [ "?" query ]`，禁止片段与非法字符。
fn is_absolute_uri(value: &str) -> bool {
    let Some(colon) = value.find(':') else {
        return false;
    };
    let scheme = &value[..colon];
    let mut scheme_chars = scheme.chars();
    let Some(first) = scheme_chars.next() else {
        return false;
    };
    if !first.is_ascii_alphabetic()
        || !scheme
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '.'))
    {
        return false;
    }
    let rest = &value[colon + 1..];
    if rest.is_empty() || rest.contains('#') || rest.contains(' ') {
        return false;
    }
    rest.bytes().all(|byte| {
        byte.is_ascii_alphanumeric()
            || matches!(
                byte,
                b':' | b'/'
                    | b'?'
                    | b'%'
                    | b'&'
                    | b'='
                    | b'-'
                    | b'.'
                    | b'_'
                    | b'~'
                    | b'@'
                    | b'!'
                    | b'$'
                    | b'\''
                    | b'('
                    | b')'
                    | b'*'
                    | b'+'
                    | b','
                    | b';'
                    | b'['
                    | b']'
            )
    })
}

/// `chips-resource://<scope>/<path>`（《资源协议规范》§二 语法）。
fn is_chips_resource_uri(value: &str) -> bool {
    let Some(rest) = value.strip_prefix("chips-resource://") else {
        return false;
    };
    let Some((scope, path)) = rest.split_once('/') else {
        return false;
    };
    let scope_valid = !scope.is_empty()
        && scope
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || matches!(ch, '-' | '.'));
    let path_valid = !path.is_empty()
        && path.chars().all(|ch| {
            ch.is_ascii_alphanumeric() || matches!(ch, '-' | '.' | '_' | '~' | '%' | '/')
        });
    scope_valid && path_valid
}

/// `credential://<pluginId>/<name>`（《能力契约规范》§5.3）。
fn is_chips_credential_uri(value: &str) -> bool {
    let Some(rest) = value.strip_prefix("credential://") else {
        return false;
    };
    let Some((plugin_id, name)) = rest.split_once('/') else {
        return false;
    };
    let segments: Vec<&str> = plugin_id.split('.').collect();
    let plugin_valid = segments.len() >= 2
        && segments.iter().all(|segment| {
            let mut chars = segment.chars();
            matches!(chars.next(), Some(first) if first.is_ascii_alphabetic())
                && chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
        });
    let name_valid = !name.is_empty()
        && !name.contains('/')
        && name
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '.' | '_'));
    plugin_valid && name_valid
}

/// jsonschema 错误种类 → （关键字，简体中文消息）。
fn describe(error: &jsonschema::ValidationError<'_>) -> Issue {
    use jsonschema::error::ValidationErrorKind as Kind;
    let (keyword, message) = match &error.kind {
        Kind::Type { .. } => ("type", "值类型不符合 schema 约束".to_owned()),
        Kind::Required { property } => (
            "required",
            format!("缺少必填字段：{}", property.as_str().unwrap_or("值")),
        ),
        Kind::AdditionalProperties { .. } => ("additionalProperties", "存在未声明字段".to_owned()),
        Kind::Enum { .. } => ("enum", "值不在允许集合内".to_owned()),
        Kind::Constant { .. } => ("const", "值与固定值不一致".to_owned()),
        Kind::MinLength { limit } => ("minLength", format!("字符串长度不得小于 {limit}")),
        Kind::MaxLength { limit } => ("maxLength", format!("字符串长度不得大于 {limit}")),
        Kind::Pattern { .. } => ("pattern", "字符串不符合模式约束".to_owned()),
        Kind::Minimum { limit } => ("minimum", format!("数值不得小于 {limit}")),
        Kind::Maximum { limit } => ("maximum", format!("数值不得大于 {limit}")),
        Kind::ExclusiveMaximum { limit } => ("exclusiveMaximum", format!("数值必须小于 {limit}")),
        Kind::ExclusiveMinimum { limit } => ("exclusiveMinimum", format!("数值必须大于 {limit}")),
        Kind::MultipleOf { .. } => ("multipleOf", "数值必须为指定步长的整数倍".to_owned()),
        Kind::MinItems { limit } => ("minItems", format!("数组元素数不得少于 {limit}")),
        Kind::MaxItems { limit } => ("maxItems", format!("数组元素数不得多于 {limit}")),
        Kind::UniqueItems => ("uniqueItems", "数组元素必须互不重复".to_owned()),
        Kind::MinProperties { limit } => ("minProperties", format!("对象属性数不得少于 {limit}")),
        Kind::MaxProperties { limit } => ("maxProperties", format!("对象属性数不得多于 {limit}")),
        Kind::PropertyNames { .. } => ("propertyNames", "对象属性名不符合约束".to_owned()),
        Kind::AnyOf { .. } => ("anyOf", "值不满足任何允许分支".to_owned()),
        Kind::OneOfNotValid { .. } => ("oneOf", "值不满足任何允许分支".to_owned()),
        Kind::OneOfMultipleValid { .. } => ("oneOf", "值同时满足多个互斥分支".to_owned()),
        Kind::FalseSchema => ("type", "该位置不接受任何值".to_owned()),
        Kind::BacktrackLimitExceeded { .. } => ("pattern", "模式匹配超出复杂度上限".to_owned()),
        Kind::Format { format } => ("format", format!("字符串不符合 {format} 格式")),
        _ => ("schema", "值不符合 schema 约束".to_owned()),
    };
    Issue {
        pointer: error.instance_path.to_string(),
        keyword: keyword.to_owned(),
        message,
    }
}

/// 校验能力输入：`json` 段（结构 + 平台严格语义）与 `bin` 段（二进制信封）。
///
/// 失败聚合为 `BRIDGE_INVALID_INPUT`：按 JSON Pointer 字典序升序、最多
/// [`MAX_VALIDATION_ISSUES`] 条、超出截断并置 `truncated: true`；详情不包含
/// 用户输入原文（《能力契约规范》§5.4）。
pub(crate) fn validate_input(
    compiled: &CompiledSchema,
    capability_id: &str,
    json: &Value,
    bin: &BTreeMap<String, Vec<u8>>,
) -> Result<(), ChipsError> {
    let mut issues: Vec<Issue> = compiled
        .validator
        .iter_errors(json)
        .map(|error| describe(&error))
        .collect();
    let defs = compiled.root.get("$defs").and_then(Value::as_object);
    scan_strict(&compiled.root, defs, json, "", &mut Vec::new(), &mut issues);
    scan_envelope(compiled, json, bin, &mut issues);

    if issues.is_empty() {
        return Ok(());
    }
    issues.sort();
    issues.dedup();
    let truncated = issues.len() > MAX_VALIDATION_ISSUES;
    let rendered: Vec<Value> = issues
        .into_iter()
        .take(MAX_VALIDATION_ISSUES)
        .map(|issue| {
            serde_json::json!({
                "pointer": issue.pointer,
                "keyword": issue.keyword,
                "message": issue.message,
            })
        })
        .collect();
    Err(ChipsError::new(
        BRIDGE_INVALID_INPUT,
        format!("能力输入不合法：{capability_id}"),
    )
    .with_details(serde_json::json!({
        "capabilityId": capability_id,
        "errors": rendered,
        "truncated": truncated,
    })))
}

/// 二进制信封校验（《Bridge三层设计》§3.6、《能力契约规范》§2.4）：
/// 缺键、多余键、键引用非字符串、重复键引用或长度超限均判输入不合法。
fn scan_envelope(
    compiled: &CompiledSchema,
    json: &Value,
    bin: &BTreeMap<String, Vec<u8>>,
    issues: &mut Vec<Issue>,
) {
    if compiled.binary_fields.is_empty() {
        if !bin.is_empty() {
            issues.push(Issue {
                pointer: String::new(),
                keyword: "x-chips-binary".to_owned(),
                message: "该能力未声明二进制字段，bin 表必须为空".to_owned(),
            });
        }
        return;
    }
    let mut referenced: HashSet<String> = HashSet::new();
    for field in &compiled.binary_fields {
        let Some(value) = json.get(&field.name) else {
            continue;
        };
        let pointer = format!("/{}", escape_pointer(&field.name));
        let Some(key) = value.as_str() else {
            issues.push(Issue {
                pointer,
                keyword: "x-chips-binary".to_owned(),
                message: "二进制字段的值必须是 bin 表键引用（字符串）".to_owned(),
            });
            continue;
        };
        if referenced.contains(key) {
            issues.push(Issue {
                pointer,
                keyword: "x-chips-binary".to_owned(),
                message: "同一输入内 bin 表键引用必须唯一".to_owned(),
            });
            continue;
        }
        referenced.insert(key.to_owned());
        match bin.get(key) {
            None => issues.push(Issue {
                pointer,
                keyword: "x-chips-binary".to_owned(),
                message: "bin 表缺少被引用的键".to_owned(),
            }),
            Some(bytes) => {
                if let Some(limit) = field.max_bytes {
                    if (bytes.len() as u64) > limit {
                        issues.push(Issue {
                            pointer,
                            keyword: "x-chips-binary".to_owned(),
                            message: format!("二进制载荷超过 {limit} 字节上限"),
                        });
                    }
                }
            }
        }
    }
    for key in bin.keys() {
        if !referenced.contains(key) {
            issues.push(Issue {
                pointer: String::new(),
                keyword: "x-chips-binary".to_owned(),
                message: "bin 表包含未被引用的多余键".to_owned(),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file_read_schema() -> Value {
        serde_json::json!({
            "type": "object",
            "additionalProperties": false,
            "required": ["path"],
            "properties": {
                "path": { "type": "string", "minLength": 1 },
                "encoding": { "type": "string", "enum": ["utf-8", "base64"], "default": "utf-8" }
            }
        })
    }

    #[test]
    fn test_compile_ok_and_digest_stable() {
        let schema = file_read_schema();
        let compiled = compile(&schema).expect("合法 schema 应编译成功");
        assert!(compiled.binary_fields.is_empty());
        assert_eq!(digest(&schema), digest(&file_read_schema()));
    }

    #[test]
    fn test_gate_rejects_forbidden_and_unknown_keywords() {
        for forbidden in [
            "$id",
            "$schema",
            "if",
            "then",
            "else",
            "dependentSchemas",
            "dependencies",
            "patternProperties",
            "unevaluatedProperties",
            "unevaluatedItems",
            "contains",
            "prefixItems",
            "not",
            "contentEncoding",
            "x-custom-script",
        ] {
            let schema = serde_json::json!({
                "type": "object",
                "additionalProperties": false,
                "properties": {},
                forbidden: {}
            });
            let error = compile(&schema).expect_err("白名单外关键字必须拒绝");
            assert_eq!(error.code(), BRIDGE_INVALID_SCHEMA, "{forbidden}");
        }
    }

    #[test]
    fn test_gate_requires_root_shape() {
        let not_object = serde_json::json!({"type": "string"});
        assert_eq!(
            compile(&not_object)
                .expect_err("顶层非 object 必须拒绝")
                .code(),
            BRIDGE_INVALID_SCHEMA
        );
        let loose = serde_json::json!({"type": "object", "properties": {}});
        assert_eq!(
            compile(&loose)
                .expect_err("缺少 additionalProperties:false 必须拒绝")
                .code(),
            BRIDGE_INVALID_SCHEMA
        );
        let bool_node = serde_json::json!({"type": "object", "additionalProperties": true});
        assert_eq!(
            compile(&bool_node)
                .expect_err("顶层仍必须 additionalProperties:false（§5.2 规则 1）")
                .code(),
            BRIDGE_INVALID_SCHEMA
        );
        let nested_bool = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "properties": {
                "meta": { "type": "object", "additionalProperties": true, "properties": {} }
            }
        });
        assert!(
            compile(&nested_bool).is_ok(),
            "非顶层 additionalProperties 布尔值是合法的"
        );
    }

    #[test]
    fn test_gate_ref_rules() {
        let remote = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "properties": { "a": { "$ref": "https://example.com/schema.json" } }
        });
        assert_eq!(
            compile(&remote).expect_err("远程 $ref 必须拒绝").code(),
            BRIDGE_INVALID_SCHEMA
        );
        let missing = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "properties": { "a": { "$ref": "#/$defs/nope" } }
        });
        assert_eq!(
            compile(&missing)
                .expect_err("缺失 $defs 目标必须拒绝")
                .code(),
            BRIDGE_INVALID_SCHEMA
        );
        let cyclic = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "properties": { "a": { "$ref": "#/$defs/loop" } },
            "$defs": { "loop": { "type": "object", "additionalProperties": false, "properties": { "b": { "$ref": "#/$defs/loop" } } } }
        });
        assert_eq!(
            compile(&cyclic).expect_err("循环 $ref 必须拒绝").code(),
            BRIDGE_INVALID_SCHEMA
        );
        let ok = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "properties": { "a": { "$ref": "#/$defs/entry" } },
            "$defs": { "entry": { "type": "object", "additionalProperties": false, "required": ["x"], "properties": { "x": { "type": "integer" } } } }
        });
        assert!(compile(&ok).is_ok(), "内部 $defs 引用应可编译");
    }

    #[test]
    fn test_binary_field_declaration_and_placement() {
        let ok = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "required": ["data"],
            "properties": { "data": { "x-chips-binary": 1024 } }
        });
        let compiled = compile(&ok).expect("顶层二进制字段应可编译");
        assert_eq!(compiled.binary_fields.len(), 1);
        assert_eq!(compiled.binary_fields[0].max_bytes, Some(1024));

        let with_type = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "properties": { "data": { "type": "string", "x-chips-binary": true } }
        });
        assert!(compile(&with_type).is_err(), "二进制字段不得声明 type");

        let nested = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "properties": { "meta": { "type": "object", "additionalProperties": false, "properties": { "blob": { "x-chips-binary": 10 } } } }
        });
        assert!(compile(&nested).is_err(), "非顶层属性不得声明二进制");

        let zero_limit = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "properties": { "data": { "x-chips-binary": 0 } }
        });
        assert!(compile(&zero_limit).is_err(), "上限必须不小于 1");
    }

    #[test]
    fn test_integer_strict_rejects_float_even_value() {
        let schema = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "properties": { "count": { "type": "integer" } }
        });
        let compiled = compile(&schema).expect("应可编译");
        let bin = BTreeMap::new();
        let error = validate_input(
            &compiled,
            "test:cap",
            &serde_json::json!({"count": 1.0}),
            &bin,
        )
        .expect_err("integer 不接受浮点值");
        assert_eq!(error.code(), BRIDGE_INVALID_INPUT);
        let details = error.details().expect("详情存在");
        assert_eq!(details["errors"][0]["keyword"], serde_json::json!("type"));
        assert_eq!(details["errors"][0]["pointer"], serde_json::json!("/count"));
        assert!(validate_input(
            &compiled,
            "test:cap",
            &serde_json::json!({"count": 1}),
            &bin
        )
        .is_ok());
        assert!(
            validate_input(
                &compiled,
                "test:cap",
                &serde_json::json!({"count": 1.5}),
                &bin
            )
            .is_err(),
            "非整数浮点由 jsonschema 拒绝"
        );
    }

    #[test]
    fn test_format_whitelist_enforced() {
        let schema = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "properties": {
                "at": { "type": "string", "format": "date-time" },
                "url": { "type": "string", "format": "uri" },
                "res": { "type": "string", "format": "chips-resource-uri" },
                "cred": { "type": "string", "format": "chips-credential" },
                "mail": { "type": "string", "format": "email" }
            }
        });
        let compiled = compile(&schema).expect("应可编译");
        let bin = BTreeMap::new();
        let good = serde_json::json!({
            "at": "2026-09-20T12:34:56Z",
            "url": "https://example.com/a?b=1",
            "res": "chips-resource://card-001/image.jpg",
            "cred": "credential://chips.plugin.notes/api-key",
            "mail": "not-an-email-but-annotation"
        });
        validate_input(&compiled, "test:cap", &good, &bin).expect("白名单内的合法值应通过");
        for bad in [
            serde_json::json!({"at": "2026-13-01T00:00:00Z"}),
            serde_json::json!({"at": "2026-02-30T00:00:00Z"}),
            serde_json::json!({"url": "https://bad host/"}),
            serde_json::json!({"res": "chips-resource://noslash"}),
            serde_json::json!({"cred": "credential://plain/name"}),
        ] {
            let error = validate_input(&compiled, "test:cap", &bad, &bin)
                .expect_err("非法 format 值必须拒绝");
            assert_eq!(error.code(), BRIDGE_INVALID_INPUT);
        }
    }

    #[test]
    fn test_date_time_offset_and_leap_second() {
        assert!(is_rfc3339_date_time("2024-02-29T23:59:60+08:00"));
        assert!(is_rfc3339_date_time("2026-01-01t00:00:00.123z"));
        assert!(!is_rfc3339_date_time("2025-02-29T00:00:00Z"));
        assert!(!is_rfc3339_date_time("2026-01-01T00:00:00+24:00"));
        assert!(!is_rfc3339_date_time("2026-01-01 00:00"));
    }

    #[test]
    fn test_envelope_validation() {
        let schema = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "required": ["data"],
            "properties": { "data": { "x-chips-binary": 4 } }
        });
        let compiled = compile(&schema).expect("应可编译");
        let mut bin = BTreeMap::new();
        bin.insert("data".to_owned(), vec![1, 2, 3]);
        validate_input(
            &compiled,
            "test:cap",
            &serde_json::json!({"data": "data"}),
            &bin,
        )
        .expect("键引用与字节齐备应通过");

        let error = validate_input(
            &compiled,
            "test:cap",
            &serde_json::json!({"data": "data"}),
            &BTreeMap::new(),
        )
        .expect_err("缺键必须拒绝");
        assert_eq!(error.code(), BRIDGE_INVALID_INPUT);

        let mut oversized = BTreeMap::new();
        oversized.insert("data".to_owned(), vec![0; 5]);
        assert!(validate_input(
            &compiled,
            "test:cap",
            &serde_json::json!({"data": "data"}),
            &oversized
        )
        .is_err());

        let mut extra = BTreeMap::new();
        extra.insert("data".to_owned(), vec![0; 1]);
        extra.insert("stray".to_owned(), vec![9]);
        assert!(validate_input(
            &compiled,
            "test:cap",
            &serde_json::json!({"data": "data"}),
            &extra
        )
        .is_err());

        assert!(validate_input(
            &compiled,
            "test:cap",
            &serde_json::json!({"data": 42}),
            &bin
        )
        .is_err());
    }

    #[test]
    fn test_issue_aggregation_sorted_and_truncated() {
        // 17 个必填字段全部缺失 → 聚合到 16 条并置 truncated。
        let mut properties = Map::new();
        let mut required = Vec::new();
        for index in 0..17 {
            let name = format!("f{index:02}");
            properties.insert(name.clone(), serde_json::json!({ "type": "string" }));
            required.push(Value::String(name));
        }
        let schema = serde_json::json!({
            "type": "object", "additionalProperties": false,
            "required": required, "properties": properties
        });
        let compiled = compile(&schema).expect("应可编译");
        let error = validate_input(
            &compiled,
            "test:cap",
            &serde_json::json!({}),
            &BTreeMap::new(),
        )
        .expect_err("必须失败");
        let details = error.details().expect("详情存在");
        assert_eq!(details["truncated"], serde_json::json!(true));
        let errors = details["errors"].as_array().expect("errors 为数组");
        assert_eq!(errors.len(), MAX_VALIDATION_ISSUES);
        let pointers: Vec<&str> = errors
            .iter()
            .map(|issue| issue["pointer"].as_str().unwrap_or(""))
            .collect();
        let mut sorted = pointers.clone();
        sorted.sort_unstable();
        assert_eq!(pointers, sorted, "必须按 JSON Pointer 字典序升序");
    }

    #[test]
    fn test_schema_cache_lru() {
        let mut cache = SchemaCache::new();
        let first = digest(&serde_json::json!({"a": 1}));
        let second = digest(&serde_json::json!({"a": 2}));
        assert!(cache.is_empty());
        cache.put(first, compile(&file_read_schema()).expect("应可编译"));
        cache.put(second, compile(&file_read_schema()).expect("应可编译"));
        assert_eq!(cache.len(), 2);
        assert!(cache.get(&first).is_some(), "get 命中应返回");
        cache.put(first, compile(&file_read_schema()).expect("重复写入更新"));
        assert_eq!(cache.len(), 2, "同键写入不增长");
        assert!(cache.get(&second).is_some());
    }

    #[test]
    fn test_validator_send_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<CompiledSchema>();
    }

    // ——— 以下为 R18 覆盖率补测新增的分支用例与辅助函数 ———

    use serde_json::json;

    /// 从 `BRIDGE_INVALID_INPUT` 详情中提取 (pointer, keyword, message) 三元组。
    fn issue_triples(details: &Value) -> Vec<(String, String, String)> {
        details["errors"]
            .as_array()
            .expect("errors 应为数组")
            .iter()
            .map(|issue| {
                (
                    issue["pointer"].as_str().unwrap_or_default().to_owned(),
                    issue["keyword"].as_str().unwrap_or_default().to_owned(),
                    issue["message"].as_str().unwrap_or_default().to_owned(),
                )
            })
            .collect()
    }

    /// 校验输入并断言失败与错误码，返回聚合的 issue 三元组。
    fn input_issue_triples(
        compiled: &CompiledSchema,
        instance: &Value,
    ) -> Vec<(String, String, String)> {
        let error = validate_input(compiled, "test:cap", instance, &BTreeMap::new())
            .expect_err("输入应当校验失败");
        assert_eq!(error.code(), BRIDGE_INVALID_INPUT);
        issue_triples(error.details().expect("详情应存在"))
    }

    fn contains_issue(
        triples: &[(String, String, String)],
        pointer: &str,
        keyword: &str,
        message: &str,
    ) -> bool {
        triples
            .iter()
            .any(|(p, k, m)| p == pointer && k == keyword && m == message)
    }

    /// 断言错误码为 `BRIDGE_INVALID_SCHEMA` 并取出 `details.reason`。
    fn invalid_schema_reason(error: &ChipsError) -> String {
        assert_eq!(error.code(), BRIDGE_INVALID_SCHEMA);
        error.details().expect("详情应存在")["reason"]
            .as_str()
            .expect("reason 应为字符串")
            .to_owned()
    }

    #[test]
    fn test_gate_rejects_non_object_nodes() {
        let cases = vec![
            json!(42),
            json!({
                "type": "object", "additionalProperties": false,
                "properties": { "a": 42 }
            }),
            json!({
                "type": "object", "additionalProperties": false,
                "properties": { "list": { "type": "array", "items": "string" } }
            }),
        ];
        for schema in cases {
            let error = compile(&schema).expect_err("非对象 schema 节点必须拒绝");
            assert_eq!(invalid_schema_reason(&error), "schema 节点必须为对象");
        }
    }

    #[test]
    fn test_gate_ref_value_shape_and_target_name() {
        let not_string = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "a": { "$ref": 42 } }
        });
        let error = compile(&not_string).expect_err("$ref 非字符串必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "$ref 必须为字符串");

        let bad_name = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "a": { "$ref": "#/$defs/bad name" } }
        });
        let error = compile(&bad_name).expect_err("$ref 目标名含非法字符必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "$ref 目标名非法");
    }

    #[test]
    fn test_gate_type_semantics() {
        let array_ok = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "type": ["string", "null"] } }
        });
        assert!(compile(&array_ok).is_ok(), "原语类型数组应可编译");

        let bad_member = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "type": ["string", 42] } }
        });
        let error = compile(&bad_member).expect_err("type 数组成员非字符串必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "type 数组成员必须为字符串");

        let bad_shape = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "type": 42 } }
        });
        let error = compile(&bad_shape).expect_err("type 既非字符串也非数组必须拒绝");
        assert_eq!(
            invalid_schema_reason(&error),
            "type 必须为字符串或字符串数组"
        );

        let unknown_single = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "type": "str" } }
        });
        let error = compile(&unknown_single).expect_err("未知原语类型必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "type `str` 不是合法原语类型");
        assert_eq!(
            error.details().expect("详情应存在")["pointer"],
            serde_json::json!("/v")
        );

        let unknown_member = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "type": ["string", "int"] } }
        });
        let error = compile(&unknown_member).expect_err("数组内未知原语类型必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "type `int` 不是合法原语类型");
    }

    #[test]
    fn test_gate_rejects_bad_required_enum_format_and_properties() {
        let empty_required =
            json!({ "type": "object", "additionalProperties": false, "required": [] });
        let error = compile(&empty_required).expect_err("空 required 必须拒绝");
        assert_eq!(
            invalid_schema_reason(&error),
            "required 必须为非空字符串数组"
        );

        let bad_required = json!({
            "type": "object", "additionalProperties": false,
            "required": ["a", 1], "properties": {}
        });
        let error = compile(&bad_required).expect_err("required 含非字符串成员必须拒绝");
        assert_eq!(
            invalid_schema_reason(&error),
            "required 必须为非空字符串数组"
        );

        let empty_enum = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "enum": [] } }
        });
        let error = compile(&empty_enum).expect_err("空 enum 必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "enum 必须为非空数组");

        let bad_format = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "format": 42 } }
        });
        let error = compile(&bad_format).expect_err("非字符串 format 必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "format 必须为字符串");

        let bad_properties =
            json!({ "type": "object", "additionalProperties": false, "properties": 42 });
        let error = compile(&bad_properties).expect_err("非对象 properties 必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "properties 必须为对象");
    }

    #[test]
    fn test_binary_field_rejected_values_and_missing_name() {
        for bad in [json!(false), json!("1024"), json!(-3.5)] {
            let schema = json!({
                "type": "object", "additionalProperties": false,
                "properties": { "data": { "x-chips-binary": bad } }
            });
            let error = compile(&schema).expect_err("仅不小于 1 的整数允许登记");
            assert_eq!(
                invalid_schema_reason(&error),
                "x-chips-binary 取值必须为不小于 1 的整数或 true（不额外限制）"
            );
        }

        let empty_name = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "": { "x-chips-binary": 16 } }
        });
        let error = compile(&empty_name).expect_err("空属性名无法登记为二进制字段");
        assert_eq!(invalid_schema_reason(&error), "x-chips-binary 属性名缺失");
    }

    #[test]
    fn test_gate_accepts_binary_true_as_unlimited() {
        // 《能力契约规范》§5.3：`x-chips-binary: true` 表示「不额外限制」，
        // 门控必须登记为无上限而不是判非法取值。
        let schema = json!({
            "type": "object", "additionalProperties": false,
            "required": ["data"],
            "properties": { "data": { "x-chips-binary": true } }
        });
        let compiled = compile(&schema).expect("true 取值应可编译");
        assert_eq!(compiled.binary_fields.len(), 1);
        assert_eq!(compiled.binary_fields[0].name, "data");
        assert_eq!(compiled.binary_fields[0].max_bytes, None);

        // 不额外限制：远超常规上限的载荷仍通过信封校验。
        let mut bin = BTreeMap::new();
        bin.insert("k".to_owned(), vec![7u8; 64 * 1024]);
        validate_input(&compiled, "test:cap", &json!({ "data": "k" }), &bin)
            .expect("true 登记的字段不设字节上限");

        // 缺引用键仍按信封规则拒绝。
        let error = validate_input(
            &compiled,
            "test:cap",
            &json!({ "data": "k" }),
            &BTreeMap::new(),
        )
        .expect_err("bin 表缺少被引用键必须拒绝");
        let triples = issue_triples(error.details().expect("详情应存在"));
        assert!(
            contains_issue(&triples, "/data", "x-chips-binary", "bin 表缺少被引用的键"),
            "实际：{triples:?}"
        );
    }

    #[test]
    fn test_gate_recurses_into_children_and_combinators() {
        let ok = json!({
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "list": { "type": "array", "items": { "type": "string", "maxLength": 8 } },
                "dict": {
                    "type": "object",
                    "additionalProperties": { "type": "string" },
                    "propertyNames": { "maxLength": 32 },
                    "properties": {}
                },
                "alt": { "oneOf": [{ "type": "string" }, { "type": "integer" }] }
            },
            "allOf": [{ "type": "object" }]
        });
        let compiled = compile(&ok).expect(
            "items / propertyNames / additionalProperties / 组合子子节点都应被门控递归遍历",
        );
        validate_input(
            &compiled,
            "test:cap",
            &json!({ "list": ["s"], "dict": { "k": "v" }, "alt": 1 }),
            &BTreeMap::new(),
        )
        .expect("合法实例应通过校验");

        let not_array = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "allOf": 42 } }
        });
        let error = compile(&not_array).expect_err("allOf 非数组必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "allOf 必须为非空数组");

        let empty_any = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "anyOf": [] } }
        });
        let error = compile(&empty_any).expect_err("空 anyOf 必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "anyOf 必须为非空数组");

        let object_one = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "oneOf": {} } }
        });
        let error = compile(&object_one).expect_err("oneOf 非数组必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "oneOf 必须为非空数组");

        let bad_child = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "anyOf": [{ "patternProperties": {} }] } }
        });
        let error = compile(&bad_child).expect_err("组合子子节点同样受白名单门控");
        assert_eq!(
            invalid_schema_reason(&error),
            "关键字 `patternProperties` 不在平台子集白名单内"
        );
        assert_eq!(
            error.details().expect("详情应存在")["pointer"],
            serde_json::json!("/v/anyOf/0")
        );
    }

    #[test]
    fn test_gate_defs_placement_and_names() {
        let nested = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "$defs": { "x": { "type": "string" } } } }
        });
        let error = compile(&nested).expect_err("$defs 出现在非根位置必须拒绝");
        assert_eq!(
            invalid_schema_reason(&error),
            "$defs 只允许出现在 schema 根部"
        );

        let not_object = json!({ "type": "object", "additionalProperties": false, "$defs": 42 });
        let error = compile(&not_object).expect_err("非对象 $defs 必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "$defs 必须为对象");

        let bad_name = json!({
            "type": "object", "additionalProperties": false,
            "$defs": { "bad name": { "type": "string" } }
        });
        let error = compile(&bad_name).expect_err("$defs 名称非法必须拒绝");
        assert_eq!(invalid_schema_reason(&error), "$defs 名称非法");
    }

    #[test]
    fn test_compile_reports_meta_schema_failure_summary() {
        let schema = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "type": "string", "pattern": "[unclosed" } }
        });
        let error = compile(&schema).expect_err("门控通过但无法编译的关键字必须注册期拒绝");
        assert!(
            error.message().starts_with("能力输入 schema 无法编译："),
            "实际消息：{}",
            error.message()
        );
        let reason = invalid_schema_reason(&error);
        assert!(
            reason.starts_with("meta-schema 或关键字编译失败："),
            "实际原因：{reason}"
        );
    }

    #[test]
    fn test_compile_root_without_properties_collects_no_binary() {
        let schema = json!({ "type": "object", "additionalProperties": false });
        let compiled = compile(&schema).expect("未声明 properties 的根 schema 应可编译");
        assert!(compiled.binary_fields.is_empty());
    }

    #[test]
    fn test_collect_binary_fields_true_limit_and_defensive_fallback() {
        // 二次遍历自身按《能力契约规范》§5.3 正确解释 `true`（不额外限制）；
        // 门控通道的同口径由 `test_gate_accepts_binary_true_as_unlimited` 钉住。
        let fields = collect_binary_fields(&json!({
            "properties": { "data": { "x-chips-binary": true } }
        }))
        .expect("true 应登记为不额外限制");
        assert_eq!(fields.len(), 1);
        assert_eq!(fields[0].name, "data");
        assert_eq!(fields[0].max_bytes, None);

        let fields = collect_binary_fields(&json!({
            "properties": { "data": { "x-chips-binary": 2048 } }
        }))
        .expect("整数上限应登记为对应字节数");
        assert_eq!(fields[0].max_bytes, Some(2048));

        // 门控通过链路只会放行 true 或不小于 1 的整数；非布尔非数字的取值
        // 仅在直接调用二次遍历时出现，此处钉住其回退为「不额外限制」的
        // 防御语义（不报错、不 panic）。
        let fields = collect_binary_fields(&json!({
            "properties": { "data": { "x-chips-binary": "oops" } }
        }))
        .expect("二次遍历不应报错");
        assert_eq!(fields.len(), 1);
        assert_eq!(fields[0].name, "data");
        assert_eq!(fields[0].max_bytes, None);
    }

    #[test]
    fn test_schema_cache_empty_get_and_lru_eviction() {
        let mut cache = SchemaCache::new();
        let missing = digest(&json!({ "never": 1 }));
        assert!(cache.get(&missing).is_none(), "空缓存必须无命中");

        let compiled = compile(&file_read_schema()).expect("应可编译");
        let keys: Vec<[u8; 32]> = (0..SCHEMA_CACHE_CAPACITY)
            .map(|index| digest(&json!({ "slot": index })))
            .collect();
        for key in &keys {
            cache.put(*key, Arc::clone(&compiled));
        }
        assert_eq!(cache.len(), SCHEMA_CACHE_CAPACITY);
        assert!(cache.get(&keys[0]).is_some(), "命中应刷新为最近使用");
        cache.put(
            digest(&json!({ "slot": "incoming" })),
            Arc::clone(&compiled),
        );
        assert_eq!(cache.len(), SCHEMA_CACHE_CAPACITY, "淘汰后总量仍处上限");
        assert!(cache.get(&keys[0]).is_some(), "刚被刷新的条目不得被逐出");
        assert!(cache.get(&keys[1]).is_none(), "最久未使用条目应被逐出");
    }

    #[test]
    fn test_schema_cache_eviction_defensive_break() {
        // 正常 get / put 序列下 entries 与 order 始终同步，order 提前弹空是
        // 防御分支；此处直接构造病态状态（order 为空、entries 已满），钉住
        // 淘汰循环遇到空 order 时停止而非 panic。
        let mut cache = SchemaCache::new();
        let compiled = compile(&file_read_schema()).expect("应可编译");
        for index in 0..SCHEMA_CACHE_CAPACITY {
            cache
                .entries
                .insert(digest(&json!({ "ghost": index })), Arc::clone(&compiled));
        }
        cache.put(digest(&json!({ "ghost": "tail" })), Arc::clone(&compiled));
        assert_eq!(cache.len(), SCHEMA_CACHE_CAPACITY + 1);
        assert!(cache.get(&digest(&json!({ "ghost": 0 }))).is_some());
    }

    #[test]
    fn test_scan_strict_defensive_branches() {
        let mut issues: Vec<Issue> = Vec::new();
        scan_strict(
            &json!(true),
            None,
            &json!(1),
            "",
            &mut Vec::new(),
            &mut issues,
        );
        assert!(issues.is_empty(), "非对象节点应直接返回");
        scan_strict(
            &json!({ "$ref": "external://x" }),
            None,
            &json!(1),
            "",
            &mut Vec::new(),
            &mut issues,
        );
        assert!(issues.is_empty(), "非 #/$defs/ 形态的 $ref 应直接跳过");
        let defs = Map::new();
        scan_strict(
            &json!({ "$ref": "#/$defs/missing" }),
            Some(&defs),
            &json!(1),
            "",
            &mut Vec::new(),
            &mut issues,
        );
        assert!(issues.is_empty(), "目标不存在时不下降也不报 issue");
        scan_strict(
            &json!({ "$ref": "#/$defs/loop" }),
            None,
            &json!(1.0),
            "",
            &mut vec!["loop".to_owned()],
            &mut issues,
        );
        assert!(issues.is_empty(), "visiting 已含同名 def 时循环防护生效");
    }

    #[test]
    fn test_scan_strict_descends_refs_map_items_and_combinators() {
        let schema = json!({
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "viaRef": { "$ref": "#/$defs/holder" },
                "map": { "type": "object", "additionalProperties": { "type": "integer" }, "properties": {} },
                "list": { "type": "array", "items": { "type": "integer" } },
                "union": { "type": ["integer", "null"] },
                "flag": { "type": "boolean" },
                "alt": { "anyOf": [{ "type": "integer" }, { "type": "string" }] }
            },
            "$defs": {
                "holder": { "type": "object", "additionalProperties": false, "properties": { "n": { "type": "integer" } } }
            }
        });
        let compiled = compile(&schema).expect("应可编译");
        let triples = input_issue_triples(
            &compiled,
            &json!({
                "viaRef": { "n": 1.0 },
                "map": { "k": 2.0 },
                "list": [3.0],
                "union": 4.0,
                "flag": true,
                "alt": 5.0
            }),
        );
        for pointer in ["/alt", "/list/0", "/map/k", "/union", "/viaRef/n"] {
            assert!(
                contains_issue(&triples, pointer, "type", "integer 不接受浮点值"),
                "严格扫描应报告 {pointer}，实际：{triples:?}"
            );
        }
        // 记录底层口径供对照：单一 `type: "integer"` 节点下 jsonschema 接受整值
        // 浮点（/alt、/list/0 等仅有扫描层 issue），这正是平台必须补充严格扫描
        // 的原因；而 type 数组分支会直接报 schema 层类型错误。
        assert!(
            contains_issue(&triples, "/union", "type", "值类型不符合 schema 约束"),
            "type 数组对整值浮点应另有 schema 层错误，实际：{triples:?}"
        );
        assert_eq!(
            triples.len(),
            6,
            "恰好 5 条严格扫描 issue 与 1 条 /union 的 schema 层类型错误：{triples:?}"
        );
    }

    #[test]
    fn test_rfc3339_rejects_malformed_shapes() {
        let rejects = [
            "2026/01-01T00:00:00Z",     // 年代号分隔符错位
            "2026-01/01T00:00:00Z",     // 月日分隔符错位
            "2026-01-01 00:00:00Z",     // 日期时间分隔符非法
            "2026-01-01T00-00:00Z",     // 时分分隔符错位
            "2026-01-01T00:00;00Z",     // 分秒分隔符错位
            "xxxx-01-01T00:00:00Z",     // 年数字非法
            "2026-01-01Txx:00:00Z",     // 时数字非法
            "2026-01-01T00:00:xxZ",     // 秒数字非法
            "2026-01-01T25:00:00Z",     // 时越界
            "2026-01-01T00:60:00Z",     // 分越界
            "2026-01-01T00:00:61Z",     // 秒越出闰秒容许
            "2026-01-01T00:00:00.Z",    // 小数秒无数字
            "2026-01-01T00:00:00 UTC",  // 时区位置为未知字符
            "2026-01-01T00:00:00+0100", // 时区偏移缺冒号且位数不足
            "2026-01-01T00:00:00+01:0", // 时区偏移位数不足
        ];
        for value in rejects {
            assert!(!is_rfc3339_date_time(value), "应拒绝：{value}");
        }
        assert!(
            is_rfc3339_date_time("2026-01-01T00:00:00.5+08:00"),
            "小数秒加时区偏移应接受"
        );
        assert!(is_rfc3339_date_time("2026-12-31T23:59:60Z"), "闰秒应接受");
    }

    #[test]
    fn test_days_in_month_supports_boundary_and_default() {
        assert_eq!(days_in_month(2026, 2), 28);
        assert_eq!(days_in_month(2024, 2), 29);
        assert_eq!(days_in_month(2000, 2), 29);
        assert_eq!(days_in_month(1900, 2), 28);
        assert_eq!(days_in_month(2026, 4), 30);
        assert_eq!(days_in_month(2026, 12), 31);
        // date-time 入口先做 1..=12 月份范围过滤，回退值 0 只在直接调用时可达。
        assert_eq!(days_in_month(2026, 13), 0);
    }

    #[test]
    fn test_parse_digits_rejects_overrun_and_non_digits() {
        let bytes: Vec<char> = "12".chars().collect();
        assert_eq!(parse_digits(&bytes, 0, 4), None, "越界取值必须返回 None");
        assert_eq!(parse_digits(&bytes, 0, 2), Some(12));
        let junk: Vec<char> = "ab".chars().collect();
        assert_eq!(parse_digits(&junk, 0, 2), None, "非数字段必须返回 None");
    }

    #[test]
    fn test_uri_predicates_reject_malformed_shapes() {
        assert!(!is_absolute_uri("example.com/x"), "无冒号即无 scheme");
        assert!(!is_absolute_uri(":missing-scheme"), "scheme 不得为空");
        assert!(
            !is_absolute_uri("1http://example.com"),
            "scheme 首字符须为字母"
        );
        assert!(!is_absolute_uri("ht tp://example.com"), "scheme 含非法字符");
        assert!(
            !is_absolute_uri("https://example.com/a#frag"),
            "禁止片段参与比对"
        );
        assert!(
            !is_absolute_uri("https://example.com/a|b"),
            "禁止未容纳字符出现在层次部分"
        );
        assert!(is_absolute_uri("https://a.b/c?d=e&f=%20g"));

        assert!(
            !is_chips_resource_uri("https://example.com"),
            "非 chips-resource scheme 直接失败"
        );
        assert!(
            !is_chips_resource_uri("chips-resource://UPPER/a.png"),
            "scope 段禁止大写"
        );
        assert!(is_chips_resource_uri(
            "chips-resource://card-01/images/a.png"
        ));

        assert!(
            !is_chips_credential_uri("https://example.com"),
            "非 credential scheme 直接失败"
        );
        assert!(
            !is_chips_credential_uri("credential://only-plugin"),
            "缺 name 段的引用非法"
        );
        assert!(
            !is_chips_credential_uri("credential://1plugin.sub/name"),
            "pluginId 段首字符须为字母"
        );
        assert!(
            !is_chips_credential_uri("credential://chips.plugin/a b"),
            "name 段含空格非法"
        );
        assert!(
            !is_chips_credential_uri("credential://chips.plugin/a/b"),
            "name 段不得再含斜杠"
        );
        assert!(is_chips_credential_uri(
            "credential://chips.plugin.notes/key_1.2-3"
        ));
    }

    #[test]
    fn test_describe_renders_scalar_keyword_messages() {
        let cases = vec![
            (
                json!({ "v": { "type": "string", "enum": ["a"] } }),
                json!({ "v": "b" }),
                "/v",
                "enum",
                "值不在允许集合内",
            ),
            (
                json!({ "v": { "const": 7 } }),
                json!({ "v": 8 }),
                "/v",
                "const",
                "值与固定值不一致",
            ),
            (
                json!({ "v": { "type": "string", "minLength": 3 } }),
                json!({ "v": "ab" }),
                "/v",
                "minLength",
                "字符串长度不得小于 3",
            ),
            (
                json!({ "v": { "type": "string", "maxLength": 1 } }),
                json!({ "v": "ab" }),
                "/v",
                "maxLength",
                "字符串长度不得大于 1",
            ),
            (
                json!({ "v": { "type": "string", "pattern": "^a" } }),
                json!({ "v": "b" }),
                "/v",
                "pattern",
                "字符串不符合模式约束",
            ),
            (
                json!({ "v": { "type": "number", "minimum": 5 } }),
                json!({ "v": 1 }),
                "/v",
                "minimum",
                "数值不得小于 5",
            ),
            (
                json!({ "v": { "type": "number", "maximum": 1 } }),
                json!({ "v": 5 }),
                "/v",
                "maximum",
                "数值不得大于 1",
            ),
            (
                json!({ "v": { "type": "number", "exclusiveMinimum": 1 } }),
                json!({ "v": 1 }),
                "/v",
                "exclusiveMinimum",
                "数值必须大于 1",
            ),
            (
                json!({ "v": { "type": "number", "exclusiveMaximum": 1 } }),
                json!({ "v": 1 }),
                "/v",
                "exclusiveMaximum",
                "数值必须小于 1",
            ),
            (
                json!({ "v": { "type": "number", "multipleOf": 2 } }),
                json!({ "v": 3 }),
                "/v",
                "multipleOf",
                "数值必须为指定步长的整数倍",
            ),
        ];
        for (constraint, instance, pointer, keyword, message) in cases {
            let schema = json!({ "type": "object", "additionalProperties": false, "properties": constraint });
            let compiled = compile(&schema).expect("应可编译");
            let triples = input_issue_triples(&compiled, &instance);
            assert_eq!(
                triples.len(),
                1,
                "{keyword} 应恰好产生 1 条 issue：{triples:?}"
            );
            assert!(
                contains_issue(&triples, pointer, keyword, message),
                "期望 ({pointer}, {keyword}, {message})，实际：{triples:?}"
            );
        }
    }

    #[test]
    fn test_describe_renders_container_keyword_messages() {
        let schema = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "type": "string" } }
        });
        let compiled = compile(&schema).expect("应可编译");
        let triples = input_issue_triples(&compiled, &json!({ "v": "x", "sneaky": 1 }));
        assert!(
            contains_issue(&triples, "", "additionalProperties", "存在未声明字段"),
            "实际：{triples:?}"
        );

        let cases = vec![
            (
                json!({ "type": "array", "minItems": 2 }),
                json!([]),
                "minItems",
                "数组元素数不得少于 2",
            ),
            (
                json!({ "type": "array", "maxItems": 1 }),
                json!([1, 2]),
                "maxItems",
                "数组元素数不得多于 1",
            ),
            (
                json!({ "type": "array", "uniqueItems": true }),
                json!([1, 1]),
                "uniqueItems",
                "数组元素必须互不重复",
            ),
            (
                json!({ "type": "object", "additionalProperties": false, "properties": {}, "minProperties": 1 }),
                json!({}),
                "minProperties",
                "对象属性数不得少于 1",
            ),
            (
                json!({ "type": "object", "additionalProperties": false, "properties": {}, "maxProperties": 0 }),
                json!({ "a": 1 }),
                "maxProperties",
                "对象属性数不得多于 0",
            ),
            (
                json!({ "type": "object", "additionalProperties": false, "propertyNames": { "pattern": "^x" }, "properties": {} }),
                json!({ "a": 1 }),
                "propertyNames",
                "对象属性名不符合约束",
            ),
        ];
        for (node, value, keyword, message) in cases {
            let schema = json!({ "type": "object", "additionalProperties": false, "properties": { "v": node } });
            let compiled = compile(&schema).expect("应可编译");
            let triples = input_issue_triples(&compiled, &json!({ "v": value }));
            assert!(
                contains_issue(&triples, "/v", keyword, message),
                "{keyword} 应被报告，实际：{triples:?}"
            );
        }
    }

    #[test]
    fn test_describe_renders_combinator_keyword_messages() {
        let any_schema = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "anyOf": [{ "type": "string" }, { "type": "boolean" }] } }
        });
        let compiled = compile(&any_schema).expect("应可编译");
        let triples = input_issue_triples(&compiled, &json!({ "v": 1 }));
        assert_eq!(
            triples,
            vec![(
                "/v".to_owned(),
                "anyOf".to_owned(),
                "值不满足任何允许分支".to_owned()
            )]
        );

        let one_none = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "oneOf": [{ "type": "string" }, { "type": "boolean" }] } }
        });
        let compiled = compile(&one_none).expect("应可编译");
        let triples = input_issue_triples(&compiled, &json!({ "v": 1 }));
        assert_eq!(
            triples,
            vec![(
                "/v".to_owned(),
                "oneOf".to_owned(),
                "值不满足任何允许分支".to_owned()
            )]
        );

        let one_multi = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "v": { "oneOf": [{ "type": "integer", "minimum": 0 }, { "type": "integer", "maximum": 10 }] } }
        });
        let compiled = compile(&one_multi).expect("应可编译");
        let triples = input_issue_triples(&compiled, &json!({ "v": 5 }));
        assert_eq!(
            triples,
            vec![(
                "/v".to_owned(),
                "oneOf".to_owned(),
                "值同时满足多个互斥分支".to_owned()
            )]
        );
    }

    /// 门控与平台编译口径（`should_validate_formats(false)`、schema 节点必须为
    /// 对象）保证以下错误种类不会出现在正式链路；这里以局部构造的校验器直接
    /// 驱动 `describe` 的映射分支，钉住兜底文案不漂移。
    /// 注：`BacktrackLimitExceeded` 分支无法钉住——当前依赖组合（jsonschema
    /// 0.33 + 其内嵌 fancy-regex 的回溯上限引擎）对灾难性模式返回不匹配而非
    /// 报错（jsonschema 自身的回溯上限测试即以上游不再复现为由 ignore），
    /// 该映射臂属不可达防御分支。
    fn describe_first(validator: &jsonschema::Validator, instance: &Value) -> Issue {
        let mut errors = validator.iter_errors(instance);
        let error = errors.next().expect("应产生校验错误");
        describe(&error)
    }

    #[test]
    fn test_describe_maps_kinds_unreachable_on_platform_path() {
        let false_validator = build_options()
            .build(&json!({ "type": "object", "properties": { "never": false } }))
            .expect("局部校验器应可编译");
        let issue = describe_first(&false_validator, &json!({ "never": 1 }));
        assert_eq!(issue.pointer, "/never");
        assert_eq!(issue.keyword, "type");
        assert_eq!(issue.message, "该位置不接受任何值");

        let format_validator = jsonschema::options()
            .with_draft(jsonschema::Draft::Draft202012)
            .should_validate_formats(true)
            .build(&json!({ "type": "string", "format": "date" }))
            .expect("局部校验器应可编译");
        let issue = describe_first(&format_validator, &json!("nope"));
        assert_eq!(issue.keyword, "format");
        assert_eq!(issue.message, "字符串不符合 date 格式");

        let catch_all_validator = build_options()
            .build(&json!({ "contains": { "const": 5 } }))
            .expect("局部校验器应可编译");
        let issue = describe_first(&catch_all_validator, &json!([1, 2]));
        assert_eq!(issue.keyword, "schema");
        assert_eq!(issue.message, "值不符合 schema 约束");
    }

    #[test]
    fn test_envelope_rejects_bin_table_without_declared_binary_fields() {
        let compiled = compile(&file_read_schema()).expect("应可编译");
        let mut bin = BTreeMap::new();
        bin.insert("payload".to_owned(), vec![1]);
        let error = validate_input(&compiled, "test:cap", &json!({ "path": "a.txt" }), &bin)
            .expect_err("未声明二进制字段时 bin 表必须为空");
        assert_eq!(error.code(), BRIDGE_INVALID_INPUT);
        let triples = issue_triples(error.details().expect("详情应存在"));
        assert_eq!(
            triples,
            vec![(
                String::new(),
                "x-chips-binary".to_owned(),
                "该能力未声明二进制字段，bin 表必须为空".to_owned()
            )]
        );
    }

    #[test]
    fn test_envelope_optional_field_skip_and_unique_reference() {
        let schema = json!({
            "type": "object", "additionalProperties": false,
            "properties": { "a": { "x-chips-binary": 8 }, "b": { "x-chips-binary": 64 } }
        });
        let compiled = compile(&schema).expect("应可编译");
        validate_input(&compiled, "test:cap", &json!({}), &BTreeMap::new())
            .expect("可选二进制字段缺省且不携带 bin 时应通过");

        let mut bin = BTreeMap::new();
        bin.insert("k".to_owned(), vec![1, 2]);
        let error = validate_input(&compiled, "test:cap", &json!({}), &bin)
            .expect_err("未被任何字段引用的 bin 键必须拒绝");
        assert_eq!(error.code(), BRIDGE_INVALID_INPUT);
        let triples = issue_triples(error.details().expect("详情应存在"));
        assert!(
            contains_issue(&triples, "", "x-chips-binary", "bin 表包含未被引用的多余键"),
            "实际：{triples:?}"
        );

        let error = validate_input(&compiled, "test:cap", &json!({ "a": "k", "b": "k" }), &bin)
            .expect_err("同一输入内重复键引用必须拒绝");
        assert_eq!(error.code(), BRIDGE_INVALID_INPUT);
        let triples = issue_triples(error.details().expect("详情应存在"));
        assert!(
            contains_issue(
                &triples,
                "/b",
                "x-chips-binary",
                "同一输入内 bin 表键引用必须唯一"
            ),
            "实际：{triples:?}"
        );
    }
}
