//! YAML 引擎封装（《06-文档解析器设计》§6.2 与 §3.4）。
//!
//! 职责：
//!
//! - 字节限额与 UTF-8 校验、BOM 剥离与换行归一（`repair` 开启记信息级诊断）；
//! - 禁用标签检测（自定义 `!` 标签与 `!!binary`）→ `YAML_UNSUPPORTED_TAG`；
//! - 别名计数与深度 / 节点预算 → `DOCUMENT_LIMIT_EXCEEDED`；
//! - 值树构造（见 [`value`]），映射保持文档顺序、重复键判为语法错误；
//! - Span 索引：由缩进扫描建立「RFC 6901 指针 → 行列」定位表，metadata 与
//!   structure 默认建立，内容文件仅在严格模式或出错时建立（§6.2、§9.3）。
//!
//! 语义基线为 YAML 1.2 核心 schema：`serde_yaml` 按该口径处理标量，
//! `yes` / `no` / `on` / `off` 不作为布尔值；整数与浮点区分保持。

pub mod value;

use std::collections::BTreeMap;

use crate::error::{
    Diagnostic, DocumentError, Fatal, Severity, DOCUMENT_UNICODE_NORMALIZED,
    DOCUMENT_VERSION_MISMATCH, YAML_SYNTAX_ERROR, YAML_UNSUPPORTED_TAG,
};
use crate::model::{DocumentValue, ParseLimits, ParseOptions, ScanLimits};
use crate::source::PackagePath;
use crate::yaml::value::{ValueScan, escape_pointer_token};

/// 别名计数与禁用标签扫描结果。
#[derive(Debug, Default)]
struct ReservedScan {
    /// 值位置的别名（`*anchor`）数量。
    aliases: u64,
    /// 禁用标签命中位置（行、列，1 起）。
    tags: Vec<(u32, u32)>,
}

/// 单个 YAML 成员的解析产物。
pub(crate) struct YamlDocument {
    /// 根值；`None` 表示该文件不可用（语法、标签或编码失败）。
    pub root: Option<DocumentValue>,
    /// 解析期诊断（已带文件与行列）。
    pub diagnostics: Vec<Diagnostic>,
    /// Span 索引（未建立时为空表）。
    pub spans: SpanIndex,
    /// 归一化前的源字节数（统计用）。
    pub source_bytes: u64,
}

impl YamlDocument {
    /// 是否存在错误级判定（根不可用）。
    #[must_use]
    pub fn failed(&self) -> bool {
        self.root.is_none()
    }
}

/// 解析 YAML 成员字节（§3.4 阶段 3-5 共用入口）。
///
/// # Errors
///
/// 超出字节、别名限额时返回 [`DocumentError::LimitExceeded`]；其余缺陷
/// （语法、禁用标签、深度、节点预算、根节点非映射）以诊断形式写入
/// [`YamlDocument`]，由调用方按成员类型决定致命码
/// （`DOCUMENT_METADATA_INVALID` / `DOCUMENT_STRUCTURE_INVALID` / 节点失败）。
pub(crate) fn parse(
    bytes: &[u8],
    file: &PackagePath,
    options: &ParseOptions,
    build_spans: bool,
) -> Fatal<YamlDocument> {
    let limits = &options.limits;
    let source_bytes = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
    if source_bytes > limits.max_yaml_bytes {
        return Err(DocumentError::LimitExceeded {
            limit: "max_yaml_bytes",
            actual: format!("{source_bytes} > {}", limits.max_yaml_bytes),
            file: Some(file.clone()),
        });
    }
    let mut diagnostics = Vec::new();
    let Some(text) = normalize(bytes, file, options.repair, &mut diagnostics) else {
        return Ok(YamlDocument {
            root: None,
            diagnostics,
            spans: SpanIndex::default(),
            source_bytes,
        });
    };
    let reserved = scan_reserved(&text);
    if reserved.aliases > limits.max_aliases {
        return Err(DocumentError::LimitExceeded {
            limit: "max_aliases",
            actual: format!("{} > {}", reserved.aliases, limits.max_aliases),
            file: Some(file.clone()),
        });
    }
    for (line, column) in reserved.tags {
        diagnostics.push(
            Diagnostic::new(
                Severity::Error,
                YAML_UNSUPPORTED_TAG,
                "使用了禁用标签：解析器只接受 YAML 1.2 核心 schema".to_owned(),
            )
            .in_file(file)
            .with_location(Some(line), Some(column))
            .with_hint("移除自定义标签或 !!binary，改用字符串与序列表达".to_owned()),
        );
    }
    let mut root = None;
    if !diagnostics.iter().any(|item| item.severity == Severity::Error) {
        let mut scan = ValueScan::new(value_limits(limits));
        match value::from_deserializer(serde_yaml::Deserializer::from_str(&text), &mut scan) {
            Ok(value @ DocumentValue::Mapping(_)) => root = Some(value),
            Ok(other) => diagnostics.push(
                Diagnostic::new(
                    Severity::Error,
                    YAML_SYNTAX_ERROR,
                    format!("根节点必须是映射，实际为 {}", other.type_name()),
                )
                .in_file(file)
                .with_location(Some(1), Some(1))
                .with_hint("把成员内容写为「键: 值」形式的映射".to_owned()),
            ),
            Err(error) => {
                let (line, column) = location_of(&error);
                let pointer = scan
                    .failure_pointer()
                    .map(str::to_owned)
                    .unwrap_or_else(|| format!("<{} 解析失败>", file));
                diagnostics.push(
                    Diagnostic::new(
                        Severity::Error,
                        YAML_SYNTAX_ERROR,
                        format!("YAML 解析失败：{error}"),
                    )
                    .at(file, pointer)
                    .with_location(line, column)
                    .with_hint("检查该行附近的缩进、引号与键名重复".to_owned()),
                );
            }
        }
    }
    let spans = if build_spans || root.is_none() {
        SpanIndex::build(&text)
    } else {
        SpanIndex::default()
    };
    enrich_with_spans(&mut diagnostics, &spans, file);
    Ok(YamlDocument {
        root,
        diagnostics,
        spans,
        source_bytes,
    })
}

/// 由限额构造值扫描参数。
fn value_limits(limits: &ParseLimits) -> ScanLimits {
    ScanLimits {
        max_depth: limits.max_depth,
        node_budget: limits.node_budget(),
    }
}

/// 从 `serde_yaml` 错误提取行列（缺失时交由 Span 索引兜底）。
fn location_of(error: &serde_yaml::Error) -> (Option<u32>, Option<u32>) {
    error.location().map_or((None, None), |location| {
        (
            u32::try_from(location.line()).ok(),
            u32::try_from(location.column()).ok(),
        )
    })
}

/// 字节 → 可解析文本：UTF-8 校验、BOM 与换行归一（§3.4.2、§8.5）。
fn normalize(
    bytes: &[u8],
    file: &PackagePath,
    repair: bool,
    diagnostics: &mut Vec<Diagnostic>,
) -> Option<String> {
    let mut body = bytes;
    if let Some(stripped) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF][..]) {
        if !repair {
            diagnostics.push(
                Diagnostic::new(
                    Severity::Error,
                    YAML_SYNTAX_ERROR,
                    "文件以 UTF-8 BOM 开头，未启用自动归一".to_owned(),
                )
                .in_file(file)
                .with_location(Some(1), Some(1))
                .with_hint("移除 BOM，或以 repair 模式打开".to_owned()),
            );
            return None;
        }
        body = stripped;
        diagnostics.push(normalized(file, "已剥离 UTF-8 BOM"));
    }
    let Ok(text) = std::str::from_utf8(body) else {
        diagnostics.push(
            Diagnostic::new(
                Severity::Error,
                YAML_SYNTAX_ERROR,
                "文件不是合法 UTF-8 字节序列".to_owned(),
            )
            .in_file(file)
            .with_hint("以 UTF-8 编码保存该文件".to_owned()),
        );
        return None;
    };
    if !text.contains('\r') {
        return Some(text.to_owned());
    }
    if repair {
        diagnostics.push(normalized(file, "已把 CRLF/CR 换行归一为 LF"));
    }
    Some(text.replace("\r\n", "\n").replace('\r', "\n"))
}

/// Unicode / 换行归一信息级诊断。
fn normalized(file: &PackagePath, message: &str) -> Diagnostic {
    Diagnostic::new(
        Severity::Info,
        DOCUMENT_UNICODE_NORMALIZED,
        format!("{message}：{file}"),
    )
    .in_file(file)
}

/// 扫描别名计数与禁用标签（§6.2 标量语义、§11.6 YAML 安全）。
fn scan_reserved(text: &str) -> ReservedScan {
    let mut scan = ReservedScan::default();
    for (number, line) in text.lines().enumerate() {
        let line_number = u32::try_from(number + 1).unwrap_or(u32::MAX);
        let bytes = line.as_bytes();
        let mut index = 0usize;
        let mut quote: Option<u8> = None;
        while index < bytes.len() {
            let byte = bytes[index];
            if let Some(marker) = quote {
                if byte == marker {
                    quote = None;
                } else if byte != b'\\' || marker != b'"' {
                    // 引号内内容不参与扫描。
                }
                index += 1;
                continue;
            }
            match byte {
                b'"' | b'\'' => quote = Some(byte),
                b'#' if index == 0 || matches!(bytes[index - 1], b' ' | b'\t') => break,
                b'!' | b'*' if starts_a_token(bytes, index) => {
                    if byte == b'!' {
                        scan.tags.push((line_number, token_column(index)));
                    } else {
                        scan.aliases += 1;
                    }
                    index += 1;
                }
                _ => index += 1,
            }
        }
    }
    scan
}

/// 列号（1 起，超出 `u32` 时截断）。
fn token_column(index: usize) -> u32 {
    u32::try_from(index + 1).unwrap_or(u32::MAX)
}

/// 判断 `!` / `*` 是否位于值起始位置（行首、`:` 后或 `-` 后）。
fn starts_a_token(bytes: &[u8], index: usize) -> bool {
    let Some(previous) = index.checked_sub(1) else {
        return true;
    };
    if !matches!(bytes[previous], b' ' | b'\t') {
        return false;
    }
    // 前一个非空白字符需为 `:`、`-` 或行首。
    let mut cursor = previous;
    while cursor > 0 && matches!(bytes[cursor - 1], b' ' | b'\t') {
        cursor -= 1;
    }
    cursor == 0 || matches!(bytes[cursor - 1], b':' | b'-')
}

/// Span 索引：RFC 6901 指针 →（行, 列），1 起（§6.2）。
///
/// 以缩进扫描建立，覆盖块式映射键与块式序列元素；流式写法（`{a: 1}`）与
/// 块标量内部不登记（`locate` 返回 `None`，诊断退化为仅带文件与消息）。
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct SpanIndex {
    positions: BTreeMap<String, (u32, u32)>,
}

impl SpanIndex {
    /// 索引是否为空。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.positions.is_empty()
    }

    /// 条目数。
    #[must_use]
    pub fn len(&self) -> usize {
        self.positions.len()
    }

    /// 按指针定位行列。
    #[must_use]
    pub fn locate(&self, pointer: &str) -> Option<(u32, u32)> {
        self.positions.get(pointer).copied()
    }

    /// 由归一化文本建立索引。
    #[must_use]
    pub fn build(text: &str) -> Self {
        let mut positions: BTreeMap<String, (u32, u32)> = BTreeMap::new();
        let mut stack: Vec<Frame> = Vec::new();
        let mut block_scalar_indent: Option<usize> = None;
        for (number, raw_line) in text.lines().enumerate() {
            let line = u32::try_from(number + 1).unwrap_or(u32::MAX);
            let indent = raw_line.len() - raw_line.trim_start_matches(' ').len();
            let content = raw_line.trim_start_matches(' ').trim_end();
            if content.is_empty() || content.starts_with('#') {
                continue;
            }
            if let Some(block_indent) = block_scalar_indent {
                if indent > block_indent {
                    continue;
                }
                block_scalar_indent = None;
            }
            if content.starts_with("---") || content.starts_with("...") || content.starts_with('%') {
                continue;
            }
            if let Some(rest) = sequence_item(content) {
                while stack.last().is_some_and(|frame| frame.indent > indent) {
                    stack.pop();
                }
                let item_pointer = match stack.last_mut() {
                    Some(frame) if frame.indent == indent && frame.sequence.is_some() => {
                        if let Some(counter) = frame.sequence.as_mut() {
                            *counter += 1;
                        }
                        frame.item_pointer()
                    }
                    other => {
                        let base = other.map_or_else(String::new, |frame| frame.item_pointer());
                        stack.push(Frame {
                            indent,
                            base,
                            sequence: Some(0),
                        });
                        // 新压入的帧必有下标。
                        stack
                            .last()
                            .map_or_else(String::new, Frame::item_pointer)
                    }
                };
                insert_position(&mut positions, &item_pointer, line, token_column(indent));
                if let Some((key, tail)) = split_key(rest) {
                    insert_position(
                        &mut positions,
                        &join_pointer(&item_pointer, &key),
                        line,
                        token_column(indent + 2),
                    );
                    if value_is_empty(tail) {
                        stack.push(Frame {
                            indent: indent + 2,
                            base: join_pointer(&item_pointer, &key),
                            sequence: None,
                        });
                    } else if is_block_scalar(tail) {
                        block_scalar_indent = Some(indent);
                    }
                }
                continue;
            }
            let Some((key, tail)) = split_key(content) else {
                continue;
            };
            while stack.last().is_some_and(|frame| frame.indent >= indent) {
                stack.pop();
            }
            let parent = stack.last().map_or_else(String::new, Frame::item_pointer);
            insert_position(&mut positions, &join_pointer(&parent, &key), line, token_column(indent));
            if value_is_empty(tail) {
                stack.push(Frame {
                    indent,
                    base: join_pointer(&parent, &key),
                    sequence: None,
                });
            } else if is_block_scalar(tail) {
                block_scalar_indent = Some(indent);
            }
        }
        Self { positions }
    }
}

/// 栈帧：记录该层缩进、路径前缀与（序列帧的）当前下标。
#[derive(Debug, Clone)]
struct Frame {
    /// 该帧起始列（0 起）。
    indent: usize,
    /// 路径前缀：映射帧为自身指针，序列帧为其所属容器指针。
    base: String,
    /// 序列元素下标（映射帧为 `None`）。
    sequence: Option<u64>,
}

impl Frame {
    /// 当前元素 / 自身指针：序列帧拼接下标，映射帧即前缀。
    fn item_pointer(&self) -> String {
        match self.sequence {
            Some(index) => join_pointer(&self.base, &index.to_string()),
            None => self.base.clone(),
        }
    }
}

/// 登记位置（首见优先，保持首次出现的定义）。
fn insert_position(
    positions: &mut BTreeMap<String, (u32, u32)>,
    pointer: &str,
    line: u32,
    column: u32,
) {
    positions.entry(pointer.to_owned()).or_insert((line, column));
}

/// 拼接指针。
fn join_pointer(parent: &str, token: &str) -> String {
    let mut pointer = parent.to_owned();
    pointer.push('/');
    pointer.push_str(&escape_pointer_token(token));
    pointer
}

/// 序列元素行的剩余内容。
fn sequence_item(content: &str) -> Option<&str> {
    if content == "-" {
        return Some("");
    }
    content.strip_prefix("- ")
}

/// 拆分「键: 剩余」；键支持裸写与单/双引号写法。
fn split_key(content: &str) -> Option<(String, &str)> {
    let bytes = content.as_bytes();
    let (key, tail_start) = match bytes.first() {
        Some(marker @ (b'"' | b'\'')) => {
            let mut cursor = 1usize;
            while cursor < bytes.len() && bytes[cursor] != *marker {
                cursor += 1;
            }
            if cursor >= bytes.len() {
                return None;
            }
            (content[1..cursor].to_owned(), cursor + 1)
        }
        _ => {
            let mut offset = 0usize;
            let mut found: Option<(usize, bool)> = None;
            while let Some(relative) = content[offset..].find(':') {
                let position = offset + relative;
                let after = content.as_bytes().get(position + 1).copied();
                if after.is_none() || after == Some(b' ') || after == Some(b'\t') {
                    found = Some((position, true));
                    break;
                }
                // `http://` 之类的值不是键。
                offset = position + 1;
            }
            let (position, _) = found?;
            let key = content[..position].trim();
            if key.is_empty() {
                return None;
            }
            (key.to_owned(), position + 1)
        }
    };
    if key.is_empty() {
        return None;
    }
    Some((key, &content[tail_start..]))
}

/// 值是否为空（后续为嵌套块）。
fn value_is_empty(tail: &str) -> bool {
    let trimmed = tail.trim();
    trimmed.is_empty() || trimmed.starts_with('#')
}

/// 是否为块标量起始（`|` / `>` 及其变体）。
fn is_block_scalar(tail: &str) -> bool {
    matches!(tail.trim_start().chars().next(), Some('|') | Some('>'))
}

/// 用 Span 索引补齐缺失的行列（schema 层与 YAML 层共用）。
pub(crate) fn enrich_with_spans(diagnostics: &mut Vec<Diagnostic>, spans: &SpanIndex, file: &PackagePath) {
    for diagnostic in diagnostics.iter_mut() {
        if diagnostic.line.is_some() {
            continue;
        }
        let Some(pointer) = diagnostic.pointer.clone() else {
            continue;
        };
        if let Some((line, column)) = spans.locate(&pointer) {
            *diagnostic = diagnostic
                .clone()
                .in_file(file)
                .with_location(Some(line), Some(column));
        }
    }
}

/// 版本次版本高于平台时的警告诊断（§7.2）。
#[must_use]
pub fn version_mismatch_warning(version: &str, current: &str) -> Diagnostic {
    Diagnostic::new(
        Severity::Warning,
        DOCUMENT_VERSION_MISMATCH,
        format!("文档标准版本 {version} 的次版本高于平台支持的 {current}"),
    )
    .with_hint("升级平台以获得完整语义支持".to_owned())
}
