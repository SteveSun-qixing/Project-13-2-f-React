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
        let max_bytes = match binary_value {
            Value::Bool(true) => None,
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
}
