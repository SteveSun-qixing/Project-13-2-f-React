//! 规范形态 YAML 发射器（《06-文档解析器设计》§10.2 写入侧约束）。
//!
//! 输入为 [`DocumentValue`]（顺序保持、无标签的模型值），输出满足：
//!
//! - UTF-8 无 BOM、LF 换行、2 空格缩进、文件以单个 `\n` 收尾、无注释、无空行、
//!   无 `---` 文档头、无锚点与别名、无自定义标签、无 `!!binary`；
//! - 键顺序即模型存储顺序；模型经 `serialize::canonicalize` 按 schema 规格表
//!   提纯为「规范定义顺序 + 未知键殿后」，与解析器 `SchemaContext::object`
//!   的归一语义同构、幂等；
//! - 歧义标量加引号（版本号、`yes/no/on/off` 系历史布尔词、数字样字符串、
//!   null 词、时间样字符串、含 `:` 的文本、首尾空白、控制字符、指示符起始、
//!   `.inf/.nan` 特殊浮点词）；
//! - 多行文本使用字面量块（`|` / `|-` / `|+`），字面量块无法安全承载的形态
//!   （行首空白、行尾空白、`\r`、制表符行首）退化为双引号转义单行；
//! - 时间一律 RFC 3339 UTC 文本（`serialize::rfc3339_millis_utc`），引号规则
//!   使其在 1.1 解析器下也不落时间戳类型。
//!
//! 浮点输出：有限值写作 YAML 1.2 核心 schema 可稳定回读的十进制形态
//! （整数值补 `.0`，指数形态统一带小数点与指数符号）；非有限值
//! （NaN/±Inf）的规范形态权威文面缺位（《06-文档解析器设计》§10.2 未定义），
//! 发射器以错误拒绝（波 C1 报告交回项）。

use crate::model::{DocumentValue, ParseLimits};
use crate::schema::FieldSpec;

/// 发射失败原因：深度预算越界（限额面）与规范形态不可表达（取值面）。
///
/// 调用方按成员归属映射到在册错误码：限额 → `DOCUMENT_LIMIT_EXCEEDED`，
/// 取值 → `DOCUMENT_METADATA_INVALID` / `DOCUMENT_STRUCTURE_INVALID`。
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum EmitError {
    /// 嵌套深度超出 `ParseLimits::max_depth`。
    Depth(String),
    /// 取值无规范形态（非有限浮点、复合值走标量路径、不可达块形态）。
    Invalid(String),
}

impl EmitError {
    /// 简体中文原因文本。
    #[must_use]
    pub(crate) fn message(&self) -> &str {
        match self {
            Self::Depth(text) | Self::Invalid(text) => text,
        }
    }
}

impl std::fmt::Display for EmitError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.message())
    }
}

/// 以规范形态发射一个文档成员的 YAML 文本（根必须为非空映射）。
pub(crate) fn to_yaml_document(value: &DocumentValue) -> Result<String, EmitError> {
    let mut output = String::new();
    let mut emitter = Emitter {
        output: &mut output,
        max_depth: ParseLimits::default().max_depth,
    };
    emitter.document(value)?;
    Ok(output)
}

/// 规范键序重排：映射按字段规格表把已知键提前（表序即规范序）、未知键保持
/// 相对顺序殿后；带子表的序列逐元素按子表重排；其余值原样克隆。
pub(crate) fn canonicalize(value: &DocumentValue, specs: &[FieldSpec]) -> DocumentValue {
    match value {
        DocumentValue::Mapping(entries) => {
            let mut result: Vec<(String, DocumentValue)> = Vec::with_capacity(entries.len());
            for spec in specs {
                if let Some((_, present)) = entries.iter().find(|(key, _)| *key == spec.name) {
                    result.push((spec.name.to_owned(), canonicalize(present, spec.children)));
                }
            }
            for (key, present) in entries {
                if specs.iter().any(|spec| spec.name == *key) {
                    continue;
                }
                result.push((key.clone(), present.clone()));
            }
            DocumentValue::Mapping(result)
        }
        DocumentValue::Sequence(items) => {
            if specs.is_empty() {
                return DocumentValue::Sequence(items.clone());
            }
            DocumentValue::Sequence(items.iter().map(|item| canonicalize(item, specs)).collect())
        }
        other => other.clone(),
    }
}

/// 发射器：借用输出缓冲，跟踪深度预算（与读取侧 `max_depth` 同界）。
struct Emitter<'e> {
    output: &'e mut String,
    max_depth: u64,
}

impl Emitter<'_> {
    /// 发射文档根（非空映射）。
    fn document(&mut self, value: &DocumentValue) -> Result<(), EmitError> {
        match value {
            DocumentValue::Mapping(entries) if !entries.is_empty() => self.mapping(entries, 0),
            DocumentValue::Mapping(_) => {
                Err(EmitError::Invalid("文档成员根映射不得为空".to_owned()))
            }
            other => Err(EmitError::Invalid(format!(
                "文档成员根必须是映射，实际为 {}",
                other.type_name()
            ))),
        }
    }

    /// 深度预算检查：以缩进层级近似值树深度（2 空格一级）。
    fn check_depth(&self, indent: usize) -> Result<(), EmitError> {
        if indent / 2 + 1 > self.max_depth as usize {
            return Err(EmitError::Depth(format!(
                "嵌套深度超出限额 {}",
                self.max_depth
            )));
        }
        Ok(())
    }

    /// 发射映射（每行一对）。
    fn mapping(
        &mut self,
        entries: &[(String, DocumentValue)],
        indent: usize,
    ) -> Result<(), EmitError> {
        self.check_depth(indent)?;
        for (key, value) in entries {
            self.output.push_str(&" ".repeat(indent));
            self.scalar_text(key)?;
            self.output.push(':');
            self.value_after_key(value, indent)?;
        }
        Ok(())
    }

    /// 发射「`key:` 之后」的值区（映射/序列走块路径并自带行尾换行）。
    fn value_after_key(&mut self, value: &DocumentValue, indent: usize) -> Result<(), EmitError> {
        match value {
            DocumentValue::Mapping(items) if items.is_empty() => {
                self.output.push_str(" {}\n");
            }
            DocumentValue::Mapping(items) => {
                self.output.push('\n');
                self.mapping(items, indent + 2)?;
            }
            DocumentValue::Sequence(items) if items.is_empty() => {
                self.output.push_str(" []\n");
            }
            DocumentValue::Sequence(items) => {
                self.output.push('\n');
                self.sequence(items, indent)?;
            }
            other => {
                self.output.push(' ');
                if !self.scalar_value(other, indent)? {
                    self.output.push('\n');
                }
            }
        }
        Ok(())
    }

    /// 发射块序列（`-` 列 = 父键缩进 + 2）。
    fn sequence(&mut self, items: &[DocumentValue], indent: usize) -> Result<(), EmitError> {
        let dash = indent + 2;
        self.check_depth(dash)?;
        for item in items {
            self.output.push_str(&" ".repeat(dash));
            self.output.push_str("- ");
            match item {
                DocumentValue::Mapping(entries) if !entries.is_empty() => {
                    // 首对键值接在 `- ` 之后（列宽 dash+2），其余键同列续行。
                    let column = dash + 2;
                    let (first_key, first_value) = &entries[0];
                    self.scalar_text(first_key)?;
                    self.output.push(':');
                    self.value_after_key(first_value, column)?;
                    for (key, value) in &entries[1..] {
                        self.output.push_str(&" ".repeat(column));
                        self.scalar_text(key)?;
                        self.output.push(':');
                        self.value_after_key(value, column)?;
                    }
                }
                DocumentValue::Mapping(_) => {
                    self.output.push_str("{}\n");
                }
                DocumentValue::Sequence(nested) if nested.is_empty() => {
                    self.output.push_str("[]\n");
                }
                DocumentValue::Sequence(nested) => {
                    // 嵌套序列独占行：去掉 `- ` 的尾随空格，`-` 行不带悬空白。
                    self.output.pop();
                    self.output.push('\n');
                    self.sequence(nested, dash)?;
                }
                other => {
                    if !self.scalar_value(other, dash)? {
                        self.output.push('\n');
                    }
                }
            }
        }
        Ok(())
    }

    /// 发射标量值（含字符串的块/引号选型）。
    ///
    /// 返回 `true` 表示已写出以换行收尾的块标量（调用方不得再补换行）。
    fn scalar_value(&mut self, value: &DocumentValue, indent: usize) -> Result<bool, EmitError> {
        match value {
            DocumentValue::String(text) => {
                if let Some(plan) = literal_block(text) {
                    self.output.push_str(plan.header);
                    self.output.push('\n');
                    self.block_lines(text, plan.trailing_newlines, indent + 2)?;
                    return Ok(true);
                }
                self.scalar_text(text)?;
                Ok(false)
            }
            DocumentValue::Null => {
                self.output.push_str("null");
                Ok(false)
            }
            DocumentValue::Bool(true) => {
                self.output.push_str("true");
                Ok(false)
            }
            DocumentValue::Bool(false) => {
                self.output.push_str("false");
                Ok(false)
            }
            DocumentValue::Integer(number) => {
                self.output.push_str(&number.to_string());
                Ok(false)
            }
            DocumentValue::Float(number) => {
                let text = format_float(*number).map_err(EmitError::Invalid)?;
                self.output.push_str(&text);
                Ok(false)
            }
            DocumentValue::Mapping(_) | DocumentValue::Sequence(_) => {
                Err(EmitError::Invalid("复合值必须走块发射路径".to_owned()))
            }
        }
    }

    /// 写字符串/键标量（plain 或双引号；含换行一律双引号转义）。
    fn scalar_text(&mut self, text: &str) -> Result<(), EmitError> {
        if is_plain_safe(text) {
            self.output.push_str(text);
        } else {
            self.push_double_quoted(text);
        }
        Ok(())
    }

    /// 字面量块内容行（空行写裸换行，非空行带缩进）。
    fn block_lines(
        &mut self,
        text: &str,
        trailing_newlines: usize,
        content_indent: usize,
    ) -> Result<(), EmitError> {
        let body = &text[..text.len() - trailing_newlines];
        let body = if trailing_newlines == 1 {
            // `|`（clip）：正文自身的收尾换行由块行循环写出。
            body.strip_suffix('\n').unwrap_or(body)
        } else {
            body
        };
        if body.is_empty() {
            return Err(EmitError::Invalid("空字面量块不可达".to_owned()));
        }
        for line in body.split('\n') {
            if line.is_empty() {
                self.output.push('\n');
            } else {
                self.output.push_str(&" ".repeat(content_indent));
                self.output.push_str(line);
                self.output.push('\n');
            }
        }
        // keep：首尾换行由末行收尾承担，其余 `trailing_newlines - 1` 个各占一行空行。
        for _ in 1..trailing_newlines {
            self.output.push('\n');
        }
        Ok(())
    }

    /// 双引号风格（YAML 1.2 双引号转义子集，JSON 兼容超集）。
    fn push_double_quoted(&mut self, text: &str) {
        self.output.push('"');
        for ch in text.chars() {
            match ch {
                '"' => self.output.push_str("\\\""),
                '\\' => self.output.push_str("\\\\"),
                '\n' => self.output.push_str("\\n"),
                '\r' => self.output.push_str("\\r"),
                '\t' => self.output.push_str("\\t"),
                '\u{0}' => self.output.push_str("\\0"),
                '\u{7}' => self.output.push_str("\\a"),
                '\u{8}' => self.output.push_str("\\b"),
                '\u{c}' => self.output.push_str("\\f"),
                '\u{1b}' => self.output.push_str("\\e"),
                '\u{7f}' => self.output.push_str("\\x7f"),
                control if (control as u32) < 0x20 => {
                    self.output.push_str(&format!("\\x{:02x}", control as u32));
                }
                printable => self.output.push(printable),
            }
        }
        self.output.push('"');
    }
}

/// 字面量块计划。
struct BlockPlan {
    header: &'static str,
    trailing_newlines: usize,
}

/// 判定多行字符串能否以字面量块承载，并给出 chomping 头。
///
/// 拒绝形态（退化为双引号）：首行为空或行首空白、任何行以制表符起始、
/// 任何行行尾空白、含 `\r`。
fn literal_block(text: &str) -> Option<BlockPlan> {
    if !text.contains('\n') {
        return None;
    }
    let first_line = text.split('\n').next().unwrap_or_default();
    if text.contains('\r')
        || first_line.is_empty()
        || first_line.starts_with(' ')
        || first_line.starts_with('\t')
        || text
            .split('\n')
            .any(|line| line.ends_with(' ') || line.ends_with('\t') || line.starts_with('\t'))
    {
        return None;
    }
    let trailing_newlines = text.chars().rev().take_while(|ch| *ch == '\n').count();
    let header = match trailing_newlines {
        0 => "|-",
        1 => "|",
        _ => "|+",
    };
    Some(BlockPlan {
        header,
        trailing_newlines,
    })
}

/// YAML 各代解析器会改变取值或类型的歧义词表（精确匹配）。
const AMBIGUOUS_WORDS: &[&str] = &[
    "~",
    "null",
    "Null",
    "NULL",
    "true",
    "True",
    "TRUE",
    "false",
    "False",
    "FALSE",
    "y",
    "Y",
    "n",
    "N",
    "yes",
    "Yes",
    "YES",
    "no",
    "No",
    "NO",
    "on",
    "On",
    "ON",
    "off",
    "Off",
    "OFF",
    "none",
    "None",
    "NONE",
    ".inf",
    ".Inf",
    ".INF",
    "-.inf",
    "-.Inf",
    "+.inf",
    "+.Inf",
    ".nan",
    ".NaN",
    ".NAN",
    "nan",
    "NaN",
    "NAN",
    "inf",
    "Inf",
    "INF",
    "-inf",
    "-Inf",
    "2001-12-14",
];

/// 判断字符串能否以 plain 形式写出。
fn is_plain_safe(text: &str) -> bool {
    if text.is_empty() || AMBIGUOUS_WORDS.contains(&text) {
        return false;
    }
    let first = text.chars().next().unwrap_or('\0');
    let indicator_start = matches!(
        first,
        '-' | '?'
            | ':'
            | ','
            | '['
            | ']'
            | '{'
            | '}'
            | '#'
            | '&'
            | '*'
            | '!'
            | '|'
            | '>'
            | '\''
            | '"'
            | '%'
            | '@'
            | '`'
            | ' '
            | '\t'
    );
    // `-`/`?`/`:` 起始仅当后随空白才是指示符；`-3`、`?x` 等直写合法，
    // 但数字样与 `:` 规则在下方兜底，此处一律从紧（后随空白才算违规）。
    let followed_by_space = matches!(text.chars().nth(1), None | Some(' ') | Some('\t'));
    if indicator_start && matches!(first, '-' | '?' | ':') {
        if followed_by_space {
            return false;
        }
    } else if indicator_start {
        return false;
    }
    if text.ends_with(' ') || text.ends_with('\t') {
        return false;
    }
    if text.contains(": ") || text.ends_with(':') || text.contains(" #") {
        return false;
    }
    // 含 `:` 的比例样与时间样文本一律加引号（1.1 读法与格式示例风格双重歧义）。
    if text.contains(':') {
        return false;
    }
    for ch in text.chars() {
        if (ch as u32) < 0x20 || ch == '\u{7f}' {
            return false;
        }
    }
    if text.contains("~~~") {
        return false;
    }
    if looks_numeric(text) || looks_version(text) || looks_timestamp(text) {
        return false;
    }
    if looks_document_marker(text) {
        return false;
    }
    true
}

/// 数字样字符串（YAML 整数/浮点的直写形态，含进制前缀与指数）。
fn looks_numeric(text: &str) -> bool {
    let body = text
        .strip_prefix('+')
        .or_else(|| text.strip_prefix('-'))
        .unwrap_or(text);
    if body.is_empty() {
        return false;
    }
    if body.starts_with("0x") || body.starts_with("0o") || body.starts_with("0b") {
        return body.len() > 2;
    }
    let digits_ok =
        |part: &str| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit() || ch == '_');
    if let Some((base, exponent)) = body.split_once(['e', 'E']) {
        let mantissa_ok = match base.split_once('.') {
            Some((head, tail)) => {
                (head.is_empty() || digits_ok(head)) && (tail.is_empty() || digits_ok(tail))
            }
            None => digits_ok(base),
        };
        let exponent_body = exponent
            .strip_prefix('+')
            .or_else(|| exponent.strip_prefix('-'))
            .unwrap_or(exponent);
        return mantissa_ok && digits_ok(exponent_body);
    }
    match body.split_once('.') {
        Some((head, tail)) => {
            (head.is_empty() || digits_ok(head)) && (tail.is_empty() || digits_ok(tail))
        }
        None => digits_ok(body),
    }
}

/// 版本号样（≥3 段纯数字，`1.0.0` 系）。
fn looks_version(text: &str) -> bool {
    text.matches('.').count() >= 2
        && text
            .split('.')
            .all(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()))
}

/// 时间样（`YYYY-M…` 日期前缀形态；ISO 8601 / RFC 3339 头部）。
fn looks_timestamp(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() >= 8
        && bytes[4] == b'-'
        && bytes[..4].iter().all(|ch| ch.is_ascii_digit())
        && bytes[5] >= b'0'
        && bytes[5] <= b'9'
}

/// `---` / `...` 文档标记形态。
fn looks_document_marker(text: &str) -> bool {
    text == "---" || text == "..." || text.starts_with("--- ") || text.starts_with("... ")
}

/// 浮点的 YAML 1.2 核心 schema 稳定十进制形态。
///
/// 有限值经 `{:?}`（最短回环表示）输出；无指数的整数形补 `.0`，
/// 带指数的形态统一小数点与指数符号（`1e300` → `1.0e+300`），保证
/// YAML 1.2 核心 schema 的浮点正则必然命中、不被读成字符串或整数。
fn format_float(value: f64) -> Result<String, String> {
    if !value.is_finite() {
        return Err("非有限浮点（NaN/±Inf）的规范形态权威文面缺位，拒绝写出".to_owned());
    }
    let raw = format!("{value:?}");
    if let Some((mantissa, exponent)) = raw.split_once('e') {
        let mantissa = if mantissa.contains('.') {
            mantissa.to_owned()
        } else {
            format!("{mantissa}.0")
        };
        let exponent = if exponent.starts_with('-') {
            format!("e{exponent}")
        } else {
            format!("e+{exponent}")
        };
        return Ok(format!("{mantissa}{exponent}"));
    }
    if raw.contains('.') {
        return Ok(raw);
    }
    Ok(format!("{raw}.0"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::DocumentValue;

    fn map(pairs: &[(&str, DocumentValue)]) -> DocumentValue {
        DocumentValue::Mapping(
            pairs
                .iter()
                .map(|(key, value)| ((*key).to_owned(), value.clone()))
                .collect(),
        )
    }

    fn text(body: &str) -> DocumentValue {
        DocumentValue::String(body.to_owned())
    }

    fn emit_root(value: DocumentValue) -> String {
        to_yaml_document(&value).expect("发射成功")
    }

    /// 用解析域权威读侧回读发射文本（往返锁的读端与生产流水线同源）。
    fn read_back(emitted: &str) -> DocumentValue {
        crate::serialize::decode_member_value(
            emitted.as_bytes(),
            &crate::source::PackagePath::new(".card/metadata.yaml").expect("合法"),
        )
        .expect("发射文本必须可回读")
    }

    fn scalar_line(label: &str, value: DocumentValue) -> String {
        emit_root(map(&[(label, value)]))
    }

    #[test]
    fn test_document_root_must_be_nonempty_mapping() {
        assert!(to_yaml_document(&DocumentValue::Null).is_err());
        assert!(to_yaml_document(&DocumentValue::Mapping(Vec::new())).is_err());
    }

    #[test]
    fn test_ambiguous_scalars_are_quoted_per_10_2() {
        // 版本号、yes/no 系、数字样、null 词、时间样、含 `:` 的比例。
        assert_eq!(scalar_line("v", text("1.0.0")), "v: \"1.0.0\"\n");
        assert_eq!(scalar_line("v", text("yes")), "v: \"yes\"\n");
        assert_eq!(scalar_line("v", text("NO")), "v: \"NO\"\n");
        assert_eq!(scalar_line("v", text("123")), "v: \"123\"\n");
        assert_eq!(scalar_line("v", text("-4.5e3")), "v: \"-4.5e3\"\n");
        assert_eq!(scalar_line("v", text("0x1F")), "v: \"0x1F\"\n");
        assert_eq!(scalar_line("v", text("null")), "v: \"null\"\n");
        assert_eq!(scalar_line("v", text("~")), "v: \"~\"\n");
        assert_eq!(
            scalar_line("v", text("2026-01-15T08:00:00.000Z")),
            "v: \"2026-01-15T08:00:00.000Z\"\n"
        );
        assert_eq!(scalar_line("v", text("3:4")), "v: \"3:4\"\n");
        assert_eq!(scalar_line("v", text("")), "v: \"\"\n");
        assert_eq!(
            scalar_line("v", text(" 带前后空白 ")),
            "v: \" 带前后空白 \"\n"
        );
        assert_eq!(scalar_line("v", text("#井号起始")), "v: \"#井号起始\"\n");
        // `-` 起始仅当后随空白才是序列指示符；`-dash起始` 是合法 plain。
        assert_eq!(scalar_line("v", text("-dash起始")), "v: -dash起始\n");
        assert_eq!(scalar_line("v", text("- 空格破折")), "v: \"- 空格破折\"\n");
    }

    #[test]
    fn test_plain_safe_scalars_stay_plain() {
        assert_eq!(scalar_line("v", text("我的学习笔记")), "v: 我的学习笔记\n");
        assert_eq!(scalar_line("v", text("a1B2c3D4e5")), "v: a1B2c3D4e5\n");
        assert_eq!(
            scalar_line("v", text("base.richtext")),
            "v: base.richtext\n"
        );
        assert_eq!(scalar_line("v", text("intro.rtf")), "v: intro.rtf\n");
        assert_eq!(scalar_line("v", text("notes.md")), "v: notes.md\n");
        // 内部连字符与下划线不触发引号。
        assert_eq!(
            scalar_line("v", text("subtitle-zh.srt")),
            "v: subtitle-zh.srt\n"
        );
    }

    #[test]
    fn test_non_string_scalars() {
        assert_eq!(scalar_line("v", DocumentValue::Null), "v: null\n");
        assert_eq!(scalar_line("v", DocumentValue::Bool(true)), "v: true\n");
        assert_eq!(scalar_line("v", DocumentValue::Integer(-42)), "v: -42\n");
        assert_eq!(scalar_line("v", DocumentValue::Float(1.5)), "v: 1.5\n");
        assert_eq!(scalar_line("v", DocumentValue::Float(3.0)), "v: 3.0\n");
        assert_eq!(
            scalar_line("v", DocumentValue::Float(1e300)),
            "v: 1.0e+300\n"
        );
        assert_eq!(
            scalar_line("v", DocumentValue::Float(-2.5e-9)),
            "v: -2.5e-9\n"
        );
    }

    #[test]
    fn test_nonfinite_float_is_rejected() {
        let error = to_yaml_document(&map(&[("v", DocumentValue::Float(f64::NAN))])).unwrap_err();
        assert!(error.to_string().contains("非有限浮点"));
        let error =
            to_yaml_document(&map(&[("v", DocumentValue::Float(f64::INFINITY))])).unwrap_err();
        assert!(error.to_string().contains("非有限浮点"));
    }

    #[test]
    fn test_multiline_uses_literal_blocks_with_chomping() {
        // strip：无尾换行。
        assert_eq!(
            scalar_line("v", text("第一行\n第二行")),
            "v: |-\n  第一行\n  第二行\n"
        );
        // clip：恰好一个尾换行。
        assert_eq!(
            scalar_line("v", text("第一行\n第二行\n")),
            "v: |\n  第一行\n  第二行\n"
        );
        // keep：多个尾换行。
        assert_eq!(scalar_line("v", text("首\n\n")), "v: |+\n  首\n\n");
        // 块内空行写裸换行。
        assert_eq!(scalar_line("v", text("甲\n\n乙")), "v: |-\n  甲\n\n  乙\n");
        // 三种 chomping 均须逐字节回环。
        for body in ["第一行\n第二行", "第一行\n第二行\n", "首\n\n", "甲\n\n乙"] {
            let emitted = scalar_line("v", text(body));
            let back = read_back(&emitted);
            let got = back
                .get("v")
                .and_then(DocumentValue::as_str)
                .expect("字符串");
            assert_eq!(got, body, "chomping 回环：{emitted:?}");
        }
    }

    #[test]
    fn test_literal_block_fallbacks_quote_with_escapes() {
        // 行尾空白、首行行首空白、`\r` 都退化为双引号转义。
        assert_eq!(
            scalar_line("v", text("行尾空白 \n第二行")),
            "v: \"行尾空白 \\n第二行\"\n"
        );
        assert_eq!(
            scalar_line("v", text(" 首行缩进\n第二行")),
            "v: \" 首行缩进\\n第二行\"\n"
        );
        assert_eq!(scalar_line("v", text("甲\r\n乙")), "v: \"甲\\r\\n乙\"\n");
        // 控制字符走 \xHH。
        assert_eq!(scalar_line("v", text("控\u{1}制")), "v: \"控\\x01制\"\n");
    }

    #[test]
    fn test_nested_mapping_and_sequence_shapes() {
        let root = map(&[
            (
                "structure",
                DocumentValue::Sequence(vec![map(&[
                    ("id", text("a1B2c3D4e5")),
                    ("type", text("base.video")),
                ])]),
            ),
            (
                "manifest",
                map(&[("card_count", DocumentValue::Integer(1))]),
            ),
            ("tags", DocumentValue::Sequence(Vec::new())),
            ("empty", DocumentValue::Mapping(Vec::new())),
        ]);
        assert_eq!(
            emit_root(root),
            "structure:\n  - id: a1B2c3D4e5\n    type: base.video\nmanifest:\n  card_count: 1\ntags: []\nempty: {}\n"
        );
    }

    #[test]
    fn test_sequence_of_scalars_and_nesting() {
        let root = map(&[(
            "tags",
            DocumentValue::Sequence(vec![
                text("动漫"),
                DocumentValue::Sequence(vec![text("地点"), text("日本")]),
            ]),
        )]);
        // 嵌套序列：父 `-` 独占一行，子项另起缩进列（YAML 1.2 合法形）。
        assert_eq!(
            emit_root(root.clone()),
            "tags:\n  - 动漫\n  -\n    - 地点\n    - 日本\n"
        );
        let back = read_back(&emit_root(root.clone()));
        assert_eq!(back, root, "嵌套序列发射必须可逐字节回环");
    }

    #[test]
    fn test_canonicalize_orders_known_keys_and_keeps_extras_last() {
        // 模型乱序输入 → 规范表序输出，未知键保持相对顺序殿后（幂等）。
        let messy = map(&[
            ("plugin_extra", DocumentValue::Integer(1)),
            ("name", text("名称")),
            ("card_id", text("a1B2c3D4e5")),
            ("theme", text("")),
            ("another_extra", DocumentValue::Null),
        ]);
        let fixed = canonicalize(&messy, crate::schema::card::METADATA_FIELDS);
        let keys: Vec<&str> = fixed
            .as_mapping()
            .expect("映射")
            .iter()
            .map(|(key, _)| key.as_str())
            .collect();
        assert_eq!(
            keys,
            vec!["card_id", "name", "theme", "plugin_extra", "another_extra"]
        );
        // 幂等：再排一次不变。
        assert_eq!(
            canonicalize(&fixed, crate::schema::card::METADATA_FIELDS),
            fixed
        );
    }

    #[test]
    fn test_canonicalize_recurses_into_spec_children() {
        // manifest.resources[].path/size/type 按子表序重排。
        let value = map(&[(
            "manifest",
            map(&[(
                "resources",
                DocumentValue::Sequence(vec![map(&[
                    ("type", text("image/jpeg")),
                    ("path", text("photo.jpg")),
                    ("size", DocumentValue::Integer(10)),
                    ("width", DocumentValue::Integer(2)),
                ])]),
            )]),
        )]);
        let fixed = canonicalize(&value, crate::schema::card::STRUCTURE_FIELDS);
        let item = fixed
            .get("manifest")
            .and_then(|m| m.get("resources"))
            .and_then(DocumentValue::as_sequence)
            .and_then(|items| items.first())
            .and_then(DocumentValue::as_mapping)
            .expect("资源条目映射");
        let keys: Vec<&str> = item.iter().map(|(key, _)| key.as_str()).collect();
        assert_eq!(keys, vec!["path", "size", "type", "width"]);
    }

    #[test]
    fn test_roundtrip_through_serde_yaml_preserves_model() {
        // 发射 → serde_yaml 回读 → 模型逐层等价（锁发射器不被自家读取面误读）。
        let root = map(&[
            ("name", text("含冒号: 测试")),
            ("version", text("1.0.0")),
            ("multiline", text("甲\n乙\n")),
            ("quoted", text(" 空白头")),
            ("zero", DocumentValue::Integer(0)),
            ("ratio", DocumentValue::Float(0.25)),
            ("flag", DocumentValue::Bool(false)),
            ("nothing", DocumentValue::Null),
            (
                "nested",
                DocumentValue::Sequence(vec![DocumentValue::Sequence(vec![map(&[(
                    "k",
                    text("v"),
                )])])]),
            ),
        ]);
        let emitted = emit_root(root.clone());
        let back = read_back(&emitted);
        assert_eq!(back, root, "发射文本必须逐字段回读为同一模型");
    }

    #[test]
    fn test_depth_guard_rejects_runaway_nesting() {
        let mut root = map(&[("k", text("v"))]);
        for _ in 0..(ParseLimits::default().max_depth + 4) {
            root = map(&[("n", root)]);
        }
        let error = to_yaml_document(&root).expect_err("超深必须拒绝");
        assert!(error.to_string().contains("嵌套深度"));
    }

    #[test]
    fn test_ending_is_single_lf_no_bom_no_trailing_blank() {
        let emitted = emit_root(map(&[("k", text("v"))]));
        assert!(emitted.ends_with('\n'));
        assert!(!emitted.ends_with("\n\n"));
        assert!(!emitted.starts_with('\u{feff}'));
        assert!(!emitted.contains("---"));
        assert!(!emitted.contains('#'));
    }
}
