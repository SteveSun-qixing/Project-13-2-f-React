//! Schema 层（《06-文档解析器设计》§6.3、§6.1 三层校验第二层）。
//!
//! 方言统一为 JSON Schema 2020-12 口径：字段规格在编译期以常量表内嵌
//! （见 [`card`] 与 [`box_model`]），不存在历史方言的读取或兼容分支。
//! 校验器逐项输出诊断：RFC 6901 指针、期望、实际、提示；同一字段只报告
//! 最高严重级问题（必填缺失 → 类型不符 → 取值/格式不符 → 未知字段）。
//!
//! 未知字段策略（§3.4 第 4 条）：普通模式警告并保留原文值，严格模式升级为
//! 错误；内容文件与布局 `props` 属插件专有配置，不进入文档级 schema
//! （§6.3 第 3 条），由 [`SchemaRegistry::allows_unknown_fields`] 放行。

use serde::Serialize;

use crate::error::{
    Diagnostic, Severity, SCHEMA_DEFAULT_APPLIED, SCHEMA_REQUIRED_MISSING, SCHEMA_TYPE_MISMATCH,
    SCHEMA_UNKNOWN_FIELD,
};
use crate::model::DocumentValue;
use crate::source::PackagePath;
use crate::yaml::SpanIndex;

#[path = "box.rs"]
pub mod box_model;
pub mod card;

/// 文档级 schema 成员类别（§6.3「按文件格式与成员类型选取」）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SchemaMember {
    /// `.card/metadata.yaml`。
    CardMetadata,
    /// `.card/structure.yaml`。
    CardStructure,
    /// `content/<id>.yaml` 通用信封（§6.1 通用字段）。
    CardContent,
    /// `.box/metadata.yaml`。
    BoxMetadata,
    /// `.box/structure.yaml`。
    BoxStructure,
    /// `.box/content.yaml` 布局配置。
    BoxContent,
}

/// 字段取值类型（JSON Schema `type` 关键字口径）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldKind {
    /// 不透明值：任何类型都合法（插件专有字段）。
    Any,
    /// 布尔。
    Boolean,
    /// 整数。
    Integer,
    /// 数值（整数或浮点）。
    Number,
    /// 字符串。
    String,
    /// 序列。
    Sequence,
    /// 映射。
    Mapping,
    /// 标签数组：元素为字符串或「首项为键」的字符串数组（minItems 2）。
    TagList,
}

impl FieldKind {
    /// JSON Schema `type` 口径的类型名（诊断文案用）。
    #[must_use]
    pub fn type_name(self) -> &'static str {
        match self {
            Self::Any => "任意",
            Self::Boolean => "boolean",
            Self::Integer => "integer",
            Self::Number => "number",
            Self::String => "string",
            Self::Sequence => "array",
            Self::Mapping => "object",
            Self::TagList => "array",
        }
    }
}

/// 字符串格式约束（`format` / `pattern` 口径）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FieldFormat {
    /// 无格式约束。
    None,
    /// 严格三段式语义化版本（禁止预发布与构建元数据）。
    StrictVersion,
    /// 10 位 Base62 标识。
    Base62Id,
    /// 封面比例 `宽:高`。
    CoverRatio,
    /// RFC 3339 UTC 时间戳。
    DateTime,
    /// 箱子封面资源路径：必须以 `assets/` 开头的包内相对路径。
    AssetPath,
}

/// 默认值补齐动作（`repair` 开启时执行，§3.4 第 6 条）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpecDefault {
    /// 字符串常量。
    Text(&'static str),
    /// 布尔常量。
    Flag(bool),
    /// 空序列。
    EmptySequence,
}

impl SpecDefault {
    /// 默认值对应的值树节点。
    #[must_use]
    pub fn value(self) -> DocumentValue {
        match self {
            Self::Text(text) => DocumentValue::String(text.to_owned()),
            Self::Flag(flag) => DocumentValue::Bool(flag),
            Self::EmptySequence => DocumentValue::Sequence(Vec::new()),
        }
    }
}

/// 单个字段规格。
#[derive(Debug, Clone, PartialEq)]
pub struct FieldSpec {
    /// 字段名（`snake_case`，与 TS 侧逐字一致）。
    pub name: &'static str,
    /// 取值类型。
    pub kind: FieldKind,
    /// 是否必填。
    pub required: bool,
    /// 字符串格式约束。
    pub format: FieldFormat,
    /// 枚举取值（空表表示不约束）。
    pub enum_values: &'static [&'static str],
    /// 字符串最大长度（`maxLength`）。
    pub max_length: Option<usize>,
    /// 序列最小长度（`minItems`）。
    pub min_items: Option<u64>,
    /// 整数下限（`minimum`，仅对整数字段生效）。
    pub minimum: Option<i64>,
    /// 默认值（仅可选字段有义）。
    pub default: Option<SpecDefault>,
    /// 嵌套字段规格（映射字段与序列元素字段；空表表示内部不约束）。
    pub children: &'static [FieldSpec],
}

impl FieldSpec {
    /// 必填标量字段。
    #[must_use]
    pub const fn required(name: &'static str, kind: FieldKind) -> Self {
        Self {
            name,
            kind,
            required: true,
            format: FieldFormat::None,
            enum_values: &[],
            max_length: None,
            min_items: None,
            minimum: None,
            default: None,
            children: &[],
        }
    }

    /// 可选标量字段。
    #[must_use]
    pub const fn optional(name: &'static str, kind: FieldKind) -> Self {
        Self { required: false, ..Self::required(name, kind) }
    }

    /// 附加字符串格式。
    #[must_use]
    pub const fn with_format(mut self, format: FieldFormat) -> Self {
        self.format = format;
        self
    }

    /// 附加枚举取值。
    #[must_use]
    pub const fn with_enum(mut self, enum_values: &'static [&'static str]) -> Self {
        self.enum_values = enum_values;
        self
    }

    /// 附加最大长度。
    #[must_use]
    pub const fn with_max_length(mut self, max_length: usize) -> Self {
        self.max_length = Some(max_length);
        self
    }

    /// 附加最小条目数。
    #[must_use]
    pub const fn with_min_items(mut self, min_items: u64) -> Self {
        self.min_items = Some(min_items);
        self
    }

    /// 附加整数下限（`minimum ≥ 0` 的字节数、计数与像素类字段使用）。
    #[must_use]
    pub const fn with_minimum(mut self, minimum: i64) -> Self {
        self.minimum = Some(minimum);
        self
    }

    /// 附加默认值。
    #[must_use]
    pub const fn with_default(mut self, default: SpecDefault) -> Self {
        self.default = Some(default);
        self
    }

    /// 附加嵌套字段规格。
    #[must_use]
    pub const fn with_children(mut self, children: &'static [FieldSpec]) -> Self {
        self.children = children;
        self
    }
}

/// Schema 注册表：成员 → 字段规格表（编译期内嵌，无运行时加载）。
#[derive(Debug, Clone, Copy)]
pub struct SchemaRegistry;

impl SchemaRegistry {
    /// 取成员的字段规格表。
    #[must_use]
    pub fn fields(member: SchemaMember) -> &'static [FieldSpec] {
        match member {
            SchemaMember::CardMetadata => card::METADATA_FIELDS,
            SchemaMember::CardStructure => card::STRUCTURE_FIELDS,
            SchemaMember::CardContent => card::CONTENT_FIELDS,
            SchemaMember::BoxMetadata => box_model::METADATA_FIELDS,
            SchemaMember::BoxStructure => box_model::STRUCTURE_FIELDS,
            SchemaMember::BoxContent => box_model::CONTENT_FIELDS,
        }
    }

    /// 成员是否放行未知字段（插件专有配置不进入文档级 schema，§6.3）。
    #[must_use]
    pub fn allows_unknown_fields(member: SchemaMember) -> bool {
        matches!(member, SchemaMember::CardContent)
    }
}

/// 一次 schema 校验的结果：修复后的值树与逐项诊断。
#[derive(Debug)]
pub struct SchemaOutcome {
    /// 补齐默认值后的值树（`repair` 关闭时与输入等价）。
    pub value: DocumentValue,
    /// 诊断（未排序，由流水线统一排序去重）。
    pub diagnostics: Vec<Diagnostic>,
}

impl SchemaOutcome {
    /// 是否存在错误级诊断。
    #[must_use]
    pub fn has_errors(&self) -> bool {
        self.diagnostics
            .iter()
            .any(|item| item.severity == Severity::Error)
    }
}

/// 校验一次（§6.1 三层校验的 Schema 层）。
///
/// `repair` 开启时按规格补齐默认值并记录 `SCHEMA_DEFAULT_APPLIED`；
/// 诊断在缺少行列时由 `spans` 索引补齐。
#[must_use]
pub fn validate(
    member: SchemaMember,
    value: &DocumentValue,
    file: &PackagePath,
    repair: bool,
    strict: bool,
    spans: Option<&SpanIndex>,
) -> SchemaOutcome {
    let mut context = SchemaContext {
        file,
        repair,
        strict,
        diagnostics: Vec::new(),
    };
    let repaired = context.object(
        SchemaRegistry::fields(member),
        value,
        String::new(),
        // 顶层放行未知字段仅限内容信封等插件专有成员（§6.3 第 3 条）；
        // 嵌套结构的未知字段一律按未知字段策略处理。
        SchemaRegistry::allows_unknown_fields(member),
    );
    if let Some(index) = spans {
        crate::yaml::enrich_with_spans(&mut context.diagnostics, index, file);
    }
    SchemaOutcome {
        value: repaired.unwrap_or_else(|| value.clone()),
        diagnostics: context.diagnostics,
    }
}

/// 校验上下文：文件定位、模式开关与诊断收集。
struct SchemaContext<'a> {
    file: &'a PackagePath,
    repair: bool,
    strict: bool,
    diagnostics: Vec<Diagnostic>,
}

impl SchemaContext<'_> {
    /// 递归校验映射节点；返回补齐默认值后的副本（类型不符时返回 `None`）。
    ///
    /// `suppress_unknown` 只在成员根层为 `true`：插件专有配置不进入
    /// 文档级 schema（§6.3 第 3 条），根层未知键原样保留、不记诊断。
    fn object(
        &mut self,
        specs: &[FieldSpec],
        value: &DocumentValue,
        pointer: String,
        suppress_unknown: bool,
    ) -> Option<DocumentValue> {
        let Some(entries) = value.as_mapping() else {
            self.push(
                Severity::Error,
                SCHEMA_TYPE_MISMATCH,
                &pointer,
                format!("期望对象，实际为 {}", value.type_name()),
                "把该节点写为「键: 值」映射",
            );
            return None;
        };
        let owned: Vec<(String, DocumentValue)> = entries.to_vec();
        let mut result: Vec<(String, DocumentValue)> = Vec::with_capacity(owned.len());
        for spec in specs {
            let field_pointer = format!("{pointer}/{}", escape_token(spec.name));
            let present = owned.iter().find(|(key, _)| *key == spec.name);
            let Some((_, present_value)) = present else {
                if spec.required {
                    self.push(
                        Severity::Error,
                        SCHEMA_REQUIRED_MISSING,
                        &field_pointer,
                        format!("缺少必填字段 {}", field_label(&pointer, spec.name)),
                        "按格式规范补齐该字段",
                    );
                } else if let (true, Some(default)) = (self.repair, spec.default) {
                    self.push(
                        Severity::Info,
                        SCHEMA_DEFAULT_APPLIED,
                        &field_pointer,
                        format!("按默认值补齐 {}", field_label(&pointer, spec.name)),
                        "该字段由写入链路应显式持久化",
                    );
                    result.push((spec.name.to_owned(), default.value()));
                }
                continue;
            };
            let checked = self.field(spec, present_value, &field_pointer);
            match checked {
                Some(next) => result.push((spec.name.to_owned(), next)),
                None => result.push((spec.name.to_owned(), present_value.clone())),
            }
        }
        for (key, present_value) in &owned {
            if specs.iter().any(|spec| spec.name == key) {
                continue;
            }
            let field_pointer = format!("{pointer}/{}", escape_token(key));
            if !suppress_unknown {
                self.push(
                    self.unknown_severity(),
                    SCHEMA_UNKNOWN_FIELD,
                    &field_pointer,
                    format!("未知字段 {key}"),
                    "移除该字段，或升级平台以获得定义",
                );
            }
            // 未知字段保留原文值（§3.4 第 4 条）。
            result.push((key.clone(), present_value.clone()));
        }
        Some(DocumentValue::Mapping(result))
    }

    /// 未知字段严重级：严格模式升级错误（§8.3 注记）。
    fn unknown_severity(&self) -> Severity {
        if self.strict {
            Severity::Error
        } else {
            Severity::Warning
        }
    }

    /// 单字段校验：类型 → 枚举 → 格式 → 长度 → 嵌套。
    fn field(&mut self, spec: &FieldSpec, value: &DocumentValue, pointer: &str) -> Option<DocumentValue> {
        if spec.kind == FieldKind::Any {
            return None;
        }
        let type_ok = match spec.kind {
            FieldKind::Any => true,
            FieldKind::Boolean => value.as_bool().is_some(),
            FieldKind::Integer => value.as_i64().is_some(),
            FieldKind::Number => value.as_f64().is_some(),
            FieldKind::String => value.as_str().is_some(),
            FieldKind::Sequence | FieldKind::TagList => value.as_sequence().is_some(),
            FieldKind::Mapping => value.as_mapping().is_some(),
        };
        if !type_ok {
            self.push(
                Severity::Error,
                SCHEMA_TYPE_MISMATCH,
                pointer,
                format!("期望 {}，实际为 {}", spec.kind.type_name(), value.type_name()),
                "按格式规范的类型改写该字段",
            );
            return None;
        }
        if !spec.enum_values.is_empty() {
            let text = value.as_str().unwrap_or_default();
            if !spec.enum_values.contains(&text) {
                self.push(
                    Severity::Error,
                    SCHEMA_TYPE_MISMATCH,
                    pointer,
                    format!("取值 {text} 不在允许集合 {:?}", spec.enum_values),
                    "改用允许集合内的取值",
                );
                return None;
            }
        }
        if let Some(minimum) = spec.minimum {
            if let Some(integer) = value.as_i64() {
                if integer < minimum {
                    self.push(
                        Severity::Error,
                        SCHEMA_TYPE_MISMATCH,
                        pointer,
                        format!("数值 {integer} 低于下限 {minimum}"),
                        "改用不小于下限的取值",
                    );
                }
            }
        }
        if let Some(max_length) = spec.max_length {
            let text = value.as_str().unwrap_or_default();
            if text.chars().count() > max_length {
                self.push(
                    Severity::Error,
                    SCHEMA_TYPE_MISMATCH,
                    pointer,
                    format!("长度 {} 超出上限 {max_length}", text.chars().count()),
                    "缩短该字段取值",
                );
            }
        }
        if let Some(text) = value.as_str() {
            if let Some(problem) = check_format(spec.format, text) {
                self.push(
                    Severity::Error,
                    SCHEMA_TYPE_MISMATCH,
                    pointer,
                    problem,
                    format_suggestion(spec.format),
                );
            }
        }
        match spec.kind {
            FieldKind::Sequence | FieldKind::TagList => {
                let items = value.as_sequence().unwrap_or_default();
                if let Some(min_items) = spec.min_items {
                    if u64::try_from(items.len()).unwrap_or(u64::MAX) < min_items {
                        self.push(
                            Severity::Error,
                            SCHEMA_TYPE_MISMATCH,
                            pointer,
                            format!("条目数 {} 少于下限 {min_items}", items.len()),
                            "至少提供一个条目",
                        );
                    }
                }
                let mut repaired = Vec::with_capacity(items.len());
                for (index, item) in items.iter().enumerate() {
                    let item_pointer = format!("{pointer}/{index}");
                    if spec.kind == FieldKind::TagList {
                        repaired.push(self.tag_item(item, &item_pointer));
                        continue;
                    }
                    if spec.children.is_empty() {
                        repaired.push(item.clone());
                        continue;
                    }
                    let next = self.object(spec.children, item, item_pointer.clone(), false);
                    repaired.push(next.unwrap_or_else(|| item.clone()));
                }
                Some(DocumentValue::Sequence(repaired))
            }
            FieldKind::Mapping if !spec.children.is_empty() => {
                self.object(spec.children, value, pointer.to_owned(), false)
            }
            _ => None,
        }
    }

    /// 标签项：字符串或「首项为键、其余为值」的字符串数组（§4.1 tags）。
    fn tag_item(&mut self, item: &DocumentValue, pointer: &str) -> DocumentValue {
        if item.as_str().is_some() {
            return item.clone();
        }
        if let Some(items) = item.as_sequence() {
            let all_strings = items.iter().all(|value| value.as_str().is_some());
            if all_strings && items.len() >= 2 {
                return item.clone();
            }
            self.push(
                Severity::Error,
                SCHEMA_TYPE_MISMATCH,
                pointer,
                if all_strings {
                    format!("结构化标签至少需要「键 + 1 个值」，实际 {} 项", items.len())
                } else {
                    format!("结构化标签的元素必须是字符串，实际含 {}", element_types(items))
                },
                "改用字符串标签或 [键, 值…] 形式的字符串数组",
            );
            return item.clone();
        }
        self.push(
            Severity::Error,
            SCHEMA_TYPE_MISMATCH,
            pointer,
            format!("标签必须是字符串或字符串数组，实际为 {}", item.type_name()),
            "改用字符串标签或 [键, 值…] 形式的字符串数组",
        );
        item.clone()
    }

    /// 追加诊断。
    fn push(&mut self, severity: Severity, code: &'static str, pointer: &str, message: String, hint: &str) {
        let diagnostic = Diagnostic::new(severity, code, format!("{message}"))
            .at(self.file, pointer.to_owned())
            .with_hint(hint.to_owned());
        self.diagnostics.push(diagnostic);
    }
}

/// 序列元素类型摘要（诊断文案用）。
fn element_types(items: &[DocumentValue]) -> String {
    let mut names: Vec<&str> = items.iter().map(DocumentValue::type_name).collect();
    names.sort_unstable();
    names.dedup();
    names.join("/")
}

/// RFC 6901 指针段转义。
fn escape_token(token: &str) -> String {
    token.replace('~', "~0").replace('/', "~1")
}

/// 字段的可读路径（诊断文案用）。
fn field_label(pointer: &str, name: &str) -> String {
    if pointer.is_empty() {
        name.to_owned()
    } else {
        format!("{pointer}/{name}")
    }
}

/// 格式不符时的提示文案。
fn format_suggestion(format: FieldFormat) -> &'static str {
    match format {
        FieldFormat::StrictVersion => "版本号需使用引号包裹的严格三段式，如 chip_standards_version: \"1.0.0\"",
        FieldFormat::Base62Id => "标识必须是 10 位 Base62 字符串",
        FieldFormat::CoverRatio => "比例需写作「宽:高」，如 \"3:4\"",
        FieldFormat::DateTime => "时间需为 ISO 8601 UTC 形式，如 \"2026-01-15T08:00:00.000Z\"",
        FieldFormat::AssetPath => "封面资源必须以 assets/ 开头",
        FieldFormat::None => "按格式规范改写该字段",
    }
}

/// 字符串格式校验；`None` 表示合规，`Some` 为不合规原因。
#[must_use]
pub fn check_format(format: FieldFormat, text: &str) -> Option<String> {
    match format {
        FieldFormat::None => None,
        FieldFormat::StrictVersion if is_strict_version(text) => None,
        FieldFormat::StrictVersion => Some(format!("版本号 {text} 不是严格三段式语义化版本")),
        FieldFormat::Base62Id if is_base62_id(text) => None,
        FieldFormat::Base62Id => Some(format!("标识 {text} 不是 10 位 Base62 编号")),
        FieldFormat::CoverRatio if is_cover_ratio(text) => None,
        FieldFormat::CoverRatio => Some(format!("比例 {text} 不是「宽:高」形式")),
        FieldFormat::DateTime if is_date_time(text) => None,
        FieldFormat::DateTime => Some(format!("时间 {text} 不是 ISO 8601 UTC 形式")),
        FieldFormat::AssetPath if is_asset_path(text) => None,
        FieldFormat::AssetPath => Some(format!("封面资源 {text} 未位于 assets/ 目录下")),
    }
}

/// 严格三段式语义化版本（禁止预发布标识与构建元数据，《版本与迁移规范》§3）。
#[must_use]
pub fn is_strict_version(text: &str) -> bool {
    let mut parts = text.split('.');
    let (Some(major), Some(minor), Some(patch), None) = (parts.next(), parts.next(), parts.next(), parts.next()) else {
        return false;
    };
    [major, minor, patch].iter().all(|part| is_numeric_part(part))
}

/// 纯数字段（非空、全为 ASCII 数字、不允许前导 `+`/`-`）。
fn is_numeric_part(text: &str) -> bool {
    !text.is_empty() && text.bytes().all(|byte| byte.is_ascii_digit())
}

/// 10 位 Base62 编号（《ID生成规范》）。
#[must_use]
pub fn is_base62_id(text: &str) -> bool {
    text.len() == 10 && text.bytes().all(|byte| byte.is_ascii_digit() || byte.is_ascii_alphabetic())
}

/// 封面比例 `宽:高`（正数比值，允许小数）。
#[must_use]
pub fn is_cover_ratio(text: &str) -> bool {
    let Some((width, height)) = text.split_once(':') else {
        return false;
    };
    is_positive_number(width) && is_positive_number(height)
}

/// 正数文本（`^\d+(\.\d+)?$`）。
fn is_positive_number(text: &str) -> bool {
    let (integer, fraction) = match text.split_once('.') {
        Some((head, tail)) => (head, Some(tail)),
        None => (text, None),
    };
    is_numeric_part(integer) && fraction.is_none_or(is_numeric_part)
}

/// ISO 8601 / RFC 3339 UTC 时间戳（毫秒可选，时区固定 `Z`）。
#[must_use]
pub fn is_date_time(text: &str) -> bool {
    let bytes = text.as_bytes();
    if bytes.len() < 20 || bytes[4] != b'-' || bytes[7] != b'-' || bytes[10] != b'T' {
        return false;
    }
    if !bytes[13].eq(&b':') || !bytes[16].eq(&b':') {
        return false;
    }
    let digits = |range: std::ops::Range<usize>| {
        text.get(range).is_some_and(|slice| is_numeric_part(slice))
    };
    let year: u32 = text.get(0..4).and_then(|value| value.parse().ok()).unwrap_or(0);
    let month: u32 = text.get(5..7).and_then(|value| value.parse().ok()).unwrap_or(0);
    let day: u32 = text.get(8..10).and_then(|value| value.parse().ok()).unwrap_or(0);
    let hour: u32 = text.get(11..13).and_then(|value| value.parse().ok()).unwrap_or(u32::MAX);
    let minute: u32 = text.get(14..16).and_then(|value| value.parse().ok()).unwrap_or(u32::MAX);
    let second: u32 = text.get(17..19).and_then(|value| value.parse().ok()).unwrap_or(u32::MAX);
    let tail = text.get(19..).unwrap_or_default();
    let suffix_ok = matches!(tail, "Z") || tail == ".000Z" || (tail.len() == 5 && tail.ends_with('Z') && is_numeric_part(&tail[1..4]));
    suffix_ok
        && digits(0..4)
        && digits(5..7)
        && digits(8..10)
        && digits(11..13)
        && digits(14..16)
        && digits(17..19)
        && month >= 1
        && month <= 12
        && day >= 1
        && day <= days_in_month(year, month)
        && hour <= 23
        && minute <= 59
        && second <= 60
}

/// 给定年月的天数（格里高利历）。
fn days_in_month(year: u32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 => 29,
        2 => 28,
        _ => 0,
    }
}

/// 箱子封面资源路径：以 `assets/` 开头的包内相对路径。
#[must_use]
pub fn is_asset_path(text: &str) -> bool {
    text.starts_with("assets/") && crate::source::PackagePath::new(text).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn path() -> PackagePath {
        PackagePath::new(".card/metadata.yaml").expect("合法路径")
    }

    fn mapping(text: &str) -> DocumentValue {
        let mut scan = crate::yaml::value::ValueScan::new(crate::model::ScanLimits::default());
        crate::yaml::value::from_deserializer(serde_yaml::Deserializer::from_str(text), &mut scan)
            .expect("测试用 YAML 必须可解析")
    }

    #[test]
    fn test_strict_version_format() {
        assert!(is_strict_version("1.0.0"));
        assert!(is_strict_version("0.1.2"));
        assert!(!is_strict_version("1.0"));
        assert!(!is_strict_version("1.0.0-beta"));
        assert!(!is_strict_version("1.0.0+build"));
        assert!(!is_strict_version("v1.0.0"));
        assert!(!is_strict_version("1.0.0."));
    }

    #[test]
    fn test_base62_and_ratio_and_asset_formats() {
        assert!(is_base62_id("a1B2c3D4e5"));
        assert!(!is_base62_id("short1"));
        assert!(!is_base62_id("has_underscore1"));
        assert!(is_cover_ratio("3:4"));
        assert!(is_cover_ratio("1.7778:1"));
        assert!(!is_cover_ratio("3/4"));
        assert!(!is_cover_ratio(":4"));
        assert!(is_asset_path("assets/cover.webp"));
        assert!(!is_asset_path("../assets/cover.webp"));
        assert!(!is_asset_path("cover.webp"));
    }

    #[test]
    fn test_date_time_format() {
        assert!(is_date_time("2026-01-15T08:00:00Z"));
        assert!(is_date_time("2026-01-15T08:00:00.000Z"));
        assert!(is_date_time("2026-01-15T08:00:00.123Z"));
        assert!(!is_date_time("2026-01-15 08:00:00Z"));
        assert!(!is_date_time("2026-02-30T08:00:00Z"));
        assert!(is_date_time("2024-02-29T08:00:00Z"), "闰年 2 月 29 日合法");
        assert!(!is_date_time("2023-02-29T08:00:00Z"));
        assert!(!is_date_time("2026-13-01T08:00:00Z"));
        assert!(!is_date_time("2026-01-15T08:00:00+08:00"), "首版只接受 UTC 形式");
    }

    #[test]
    fn test_validate_reports_required_missing_with_pointer() {
        let value = mapping("card_id: \"a1B2c3D4e5\"\n");
        let outcome = validate(SchemaMember::CardMetadata, &value, &path(), true, false, None);
        assert!(outcome.has_errors());
        let missing = outcome
            .diagnostics
            .iter()
            .find(|item| item.code == SCHEMA_REQUIRED_MISSING)
            .expect("必须报告缺失的必填字段");
        assert_eq!(missing.file.as_ref().expect("带文件"), &path());
        assert!(missing.pointer.as_ref().expect("带指针").starts_with('/'));
    }

    #[test]
    fn test_validate_repair_applies_defaults_once() {
        let text = "chip_standards_version: \"1.0.0\"\ncard_id: \"a1B2c3D4e5\"\nname: \"n\"\n\
                    created_at: \"2026-01-15T08:00:00.000Z\"\nmodified_at: \"2026-01-15T08:00:00.000Z\"\n";
        let value = mapping(text);
        let outcome = validate(SchemaMember::CardMetadata, &value, &path(), true, false, None);
        assert!(!outcome.has_errors(), "{:?}", outcome.diagnostics);
        assert_eq!(outcome.value.get("cover_ratio").and_then(DocumentValue::as_str), Some("3:4"));
        assert_eq!(outcome.value.get("visibility").and_then(DocumentValue::as_str), Some("private"));
        let applied = outcome
            .diagnostics
            .iter()
            .filter(|item| item.code == SCHEMA_DEFAULT_APPLIED)
            .count();
        let again = validate(SchemaMember::CardMetadata, &outcome.value, &path(), true, false, None);
        assert_eq!(
            again
                .diagnostics
                .iter()
                .filter(|item| item.code == SCHEMA_DEFAULT_APPLIED)
                .count(),
            0,
            "已补齐的字段不得重复记默认值诊断"
        );
        assert!(applied > 0);
    }

    #[test]
    fn test_validate_unknown_field_severity_follows_strict() {
        let value = mapping(
            "chip_standards_version: \"1.0.0\"\ncard_id: \"a1B2c3D4e5\"\nname: \"n\"\n\
             created_at: \"2026-01-15T08:00:00.000Z\"\nmodified_at: \"2026-01-15T08:00:00.000Z\"\n\
             mystery: 1\n",
        );
        let lenient = validate(SchemaMember::CardMetadata, &value, &path(), false, false, None);
        let unknown = lenient
            .diagnostics
            .iter()
            .find(|item| item.code == SCHEMA_UNKNOWN_FIELD)
            .expect("未知字段必须有诊断");
        assert_eq!(unknown.severity, Severity::Warning);
        assert_eq!(
            lenient.value.get("mystery").and_then(DocumentValue::as_i64),
            Some(1),
            "未知字段必须保留原文值"
        );
        let strict = validate(SchemaMember::CardMetadata, &value, &path(), false, true, None);
        assert!(strict
            .diagnostics
            .iter()
            .any(|item| item.code == SCHEMA_UNKNOWN_FIELD && item.severity == Severity::Error));
    }

    #[test]
    fn test_validate_type_and_enum_mismatch() {
        let value = mapping(
            "chip_standards_version: \"1.0.0\"\ncard_id: \"a1B2c3D4e5\"\nname: \"n\"\n\
             created_at: \"2026-01-15T08:00:00.000Z\"\nmodified_at: \"2026-01-15T08:00:00.000Z\"\n\
             visibility: \"publicish\"\ndownloadable: \"yes\"\n",
        );
        let outcome = validate(SchemaMember::CardMetadata, &value, &path(), false, false, None);
        let codes: Vec<&str> = outcome
            .diagnostics
            .iter()
            .filter(|item| item.code == SCHEMA_TYPE_MISMATCH)
            .map(|item| item.pointer.as_deref().unwrap_or_default())
            .collect();
        assert!(codes.contains(&"/visibility"), "{codes:?}");
        assert!(codes.contains(&"/downloadable"), "{codes:?}");
    }

    #[test]
    fn test_validate_nested_children_and_tag_list() {
        let value = mapping(
            "chip_standards_version: \"1.0.0\"\ncard_id: \"a1B2c3D4e5\"\nname: \"n\"\n\
             created_at: \"2026-01-15T08:00:00.000Z\"\nmodified_at: \"2026-01-15T08:00:00.000Z\"\n\
             tags:\n  - \"旅行\"\n  - [\"地点\", \"日本\"]\n  - [\"只有一个值\"]\n  - 7\n\
             file_info:\n  total_size: -1\n  generated_at: \"nope\"\n",
        );
        let outcome = validate(SchemaMember::CardMetadata, &value, &path(), false, false, None);
        let pointers: Vec<String> = outcome
            .diagnostics
            .iter()
            .map(|item| item.pointer.clone().unwrap_or_default())
            .collect();
        assert!(pointers.contains(&"/tags/2".to_owned()), "{pointers:?}");
        assert!(pointers.contains(&"/tags/3".to_owned()), "{pointers:?}");
        assert!(pointers.contains(&"/file_info/total_size".to_owned()), "{pointers:?}");
        assert!(pointers.contains(&"/file_info/generated_at".to_owned()), "{pointers:?}");
    }

    #[test]
    fn test_validate_non_mapping_root_is_error() {
        let value = DocumentValue::Sequence(vec![DocumentValue::Integer(1)]);
        let outcome = validate(SchemaMember::CardMetadata, &value, &path(), false, false, None);
        assert!(outcome.has_errors());
        assert_eq!(outcome.diagnostics[0].pointer.as_deref(), Some(""));
    }

    #[test]
    fn test_content_member_allows_unknown_fields() {
        assert!(SchemaRegistry::allows_unknown_fields(SchemaMember::CardContent));
        assert!(!SchemaRegistry::allows_unknown_fields(SchemaMember::CardMetadata));
        let fields = SchemaRegistry::fields(SchemaMember::CardContent);
        assert!(fields.iter().any(|spec| spec.name == "card_type" && spec.required));
    }

    #[test]
    fn test_spec_default_values() {
        assert_eq!(SpecDefault::Text("3:4").value(), DocumentValue::String("3:4".to_owned()));
        assert_eq!(SpecDefault::Flag(true).value(), DocumentValue::Bool(true));
        assert_eq!(SpecDefault::EmptySequence.value(), DocumentValue::Sequence(Vec::new()));
    }

    #[test]
    fn test_field_label_and_escaping() {
        assert_eq!(field_label("", "name"), "name");
        assert_eq!(field_label("/a", "name"), "/a/name");
        assert_eq!(escape_token("a/b~c"), "a~1b~0c");
        assert_eq!(element_types(&[DocumentValue::Bool(true), DocumentValue::Integer(1), DocumentValue::Bool(false)]), "boolean/integer");
    }
}
