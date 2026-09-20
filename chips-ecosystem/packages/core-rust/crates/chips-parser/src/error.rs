//! 两级错误模型：致命 [`DocumentError`] 与非致命 [`Diagnostic`]。
//!
//! 码表权威见《06-文档解析器设计》§8.2（致命错误码）与 §8.3（诊断码）；
//! 错误形状与《核心接口规范》§3.3 一致：`DocumentError` 在 Neon 边界经
//! [`ChipsError::from`] 归一，`message` 为简体中文用户可读文案，
//! `details` 携带已收集的结构化诊断。

use serde::Serialize;
use thiserror::Error;

use crate::source::PackagePath;

// ---------------------------------------------------------------------------
// 致命错误码（设计稿 §8.2）
// ---------------------------------------------------------------------------

/// 入口路径不存在（不可重试）。
pub const DOCUMENT_NOT_FOUND: &str = "DOCUMENT_NOT_FOUND";
/// 读取失败：权限、IO、映射失败（可重试）。
pub const DOCUMENT_IO: &str = "DOCUMENT_IO";
/// 非目录、非 ZIP，或与声明格式不符（不可重试）。
pub const DOCUMENT_FORMAT_UNKNOWN: &str = "DOCUMENT_FORMAT_UNKNOWN";
/// 缺少 `.card/metadata.yaml` / `.box/metadata.yaml`（不可重试）。
pub const DOCUMENT_METADATA_MISSING: &str = "DOCUMENT_METADATA_MISSING";
/// metadata 语法或 schema 失败（不可重试）。
pub const DOCUMENT_METADATA_INVALID: &str = "DOCUMENT_METADATA_INVALID";
/// structure 语法或 schema 失败；全量解析时致命（不可重试）。
pub const DOCUMENT_STRUCTURE_INVALID: &str = "DOCUMENT_STRUCTURE_INVALID";
/// `chip_standards_version` 主版本过旧，需迁移工具处理（不可重试）。
pub const DOCUMENT_VERSION_OUTDATED: &str = "DOCUMENT_VERSION_OUTDATED";
/// `chip_standards_version` 主版本过新，需升级平台（不可重试）。
pub const DOCUMENT_VERSION_UNSUPPORTED: &str = "DOCUMENT_VERSION_UNSUPPORTED";
/// 归档损坏、重复路径、加密或非法压缩方法（不可重试）。
pub const DOCUMENT_ARCHIVE_INVALID: &str = "DOCUMENT_ARCHIVE_INVALID";
/// 包内路径越界、非法字符，或归档路径存在安全风险（不可重试）。
pub const DOCUMENT_PATH_UNSAFE: &str = "DOCUMENT_PATH_UNSAFE";
/// 超出成员数、字节数、压缩比、别名或深度限额（不可重试）。
pub const DOCUMENT_LIMIT_EXCEEDED: &str = "DOCUMENT_LIMIT_EXCEEDED";
/// 调用方取消（可重试）。
pub const DOCUMENT_PARSE_CANCELLED: &str = "DOCUMENT_PARSE_CANCELLED";

// ---------------------------------------------------------------------------
// 诊断码（设计稿 §8.3）
// ---------------------------------------------------------------------------

/// YAML 语法错误，含行列（错误）。
pub const YAML_SYNTAX_ERROR: &str = "YAML_SYNTAX_ERROR";
/// 必填字段缺失（错误）。
pub const SCHEMA_REQUIRED_MISSING: &str = "SCHEMA_REQUIRED_MISSING";
/// 字段类型不符（错误）。
pub const SCHEMA_TYPE_MISMATCH: &str = "SCHEMA_TYPE_MISMATCH";
/// 使用禁用标签（如 `!!binary`、自定义 `!` 标签）（错误）。
pub const YAML_UNSUPPORTED_TAG: &str = "YAML_UNSUPPORTED_TAG";
/// 未知字段；普通模式警告，严格模式升级错误（警告，保留原文值）。
pub const SCHEMA_UNKNOWN_FIELD: &str = "SCHEMA_UNKNOWN_FIELD";
/// 已按 schema 默认值补齐（信息）。
pub const SCHEMA_DEFAULT_APPLIED: &str = "SCHEMA_DEFAULT_APPLIED";
/// 结构引用的内容文件缺失（错误，节点失败）。
pub const STRUCTURE_CONTENT_MISSING: &str = "STRUCTURE_CONTENT_MISSING";
/// 单个内容节点解析失败（错误）。
pub const STRUCTURE_NODE_FAILED: &str = "STRUCTURE_NODE_FAILED";
/// 条目引用语法非法或 scheme 不允许（错误）。
pub const ENTRY_SOURCE_INVALID: &str = "ENTRY_SOURCE_INVALID";
/// 包内引用目标不存在（警告）。
pub const ENTRY_TARGET_MISSING: &str = "ENTRY_TARGET_MISSING";
/// 单条目解析失败，位置保留（错误）。
pub const ENTRY_FAILED: &str = "ENTRY_FAILED";
/// 资源清单条目对应文件缺失（警告）。
pub const DOCUMENT_RESOURCE_FILE_MISSING: &str = "DOCUMENT_RESOURCE_FILE_MISSING";
/// 尺寸或哈希不匹配（警告，严格模式升级错误）。
pub const DOCUMENT_RESOURCE_INTEGRITY_MISMATCH: &str = "DOCUMENT_RESOURCE_INTEGRITY_MISMATCH";
/// 存在未被引用的内容或资源（严格模式警告）。
pub const DOCUMENT_UNREFERENCED_FILE: &str = "DOCUMENT_UNREFERENCED_FILE";
/// 忽略系统生成物（信息）。
pub const DOCUMENT_GENERATED_FILE_IGNORED: &str = "DOCUMENT_GENERATED_FILE_IGNORED";
/// 目录态符号链接未纳入索引（错误级诊断）。
pub const DOCUMENT_SYMLINK_IGNORED: &str = "DOCUMENT_SYMLINK_IGNORED";
/// 已执行 Unicode/换行归一或 BOM 剥离（信息）。
pub const DOCUMENT_UNICODE_NORMALIZED: &str = "DOCUMENT_UNICODE_NORMALIZED";
/// 扩展名与实际结构不符（警告）。
pub const DOCUMENT_EXTENSION_MISMATCH: &str = "DOCUMENT_EXTENSION_MISMATCH";
/// `chip_standards_version` 次版本高于平台支持版本（警告）。
pub const DOCUMENT_VERSION_MISMATCH: &str = "DOCUMENT_VERSION_MISMATCH";

/// 诊断严重级。
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    /// 错误：对象不可用或部分成功语义下的失败点。
    Error,
    /// 警告：可继续但需要展示。
    Warning,
    /// 信息：归一化、忽略与默认值记录。
    Info,
}

/// 非致命诊断记录（设计稿 §8.1）。
///
/// 每个 `Diagnostic` 必须包含可判定的码与面向用户的消息；位置字段尽可能
/// 精确；`hint` 只在存在确定修复方式时给出。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Diagnostic {
    /// 严重级。
    pub severity: Severity,
    /// 诊断码（`&'static str` 常量，见本模块）。
    pub code: &'static str,
    /// 简体中文用户可读消息。
    pub message: String,
    /// 所在包内文件。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<PackagePath>,
    /// RFC 6901 字段指针。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pointer: Option<String>,
    /// 行号（1 起）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<u32>,
    /// 列号（1 起）。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<u32>,
    /// 修复提示。
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

impl Diagnostic {
    /// 以严重级、码与消息构造诊断。
    #[must_use]
    pub fn new(severity: Severity, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            severity,
            code,
            message: message.into(),
            file: None,
            pointer: None,
            line: None,
            column: None,
            hint: None,
        }
    }

    /// 附加文件与字段指针位置。
    #[must_use]
    pub fn at(mut self, file: &PackagePath, pointer: impl Into<String>) -> Self {
        self.file = Some(file.clone());
        self.pointer = Some(pointer.into());
        self
    }

    /// 附加文件位置。
    #[must_use]
    pub fn in_file(mut self, file: &PackagePath) -> Self {
        self.file = Some(file.clone());
        self
    }

    /// 附加行列定位。
    #[must_use]
    pub fn with_location(mut self, line: Option<u32>, column: Option<u32>) -> Self {
        self.line = line;
        self.column = column;
        self
    }

    /// 附加修复提示。
    #[must_use]
    pub fn with_hint(mut self, hint: impl Into<String>) -> Self {
        self.hint = Some(hint.into());
        self
    }

    /// 严格模式下的升级处理：标记为「严格：错误」的警告码在严格模式升级为
    /// 错误级诊断（设计稿 §6.1、§8.3 严重级列注记）。
    #[must_use]
    pub(crate) fn escalated(self, strict: bool) -> Self {
        if strict && self.severity == Severity::Warning && escalates_in_strict(self.code) {
            Self {
                severity: Severity::Error,
                ..self
            }
        } else {
            self
        }
    }
}

/// 判定诊断码在严格模式下是否由警告升级为错误（设计稿 §8.3 严重级注记）。
#[must_use]
pub(crate) fn escalates_in_strict(code: &'static str) -> bool {
    matches!(
        code,
        SCHEMA_UNKNOWN_FIELD | DOCUMENT_RESOURCE_INTEGRITY_MISMATCH | DOCUMENT_UNREFERENCED_FILE
    )
}

/// 诊断排序键：`(file, line, column, pointer, code)`（设计稿 §3.7）。
#[must_use]
pub(crate) fn diagnostic_sort_key(
    diagnostic: &Diagnostic,
) -> (String, u64, u64, String, &'static str) {
    (
        diagnostic
            .file
            .as_ref()
            .map(PackagePath::as_str)
            .unwrap_or("")
            .to_owned(),
        u64::from(diagnostic.line.unwrap_or(u32::MAX)),
        u64::from(diagnostic.column.unwrap_or(u32::MAX)),
        diagnostic.pointer.clone().unwrap_or_default(),
        diagnostic.code,
    )
}

/// 对诊断集合排序去重，保证确定性输出（设计稿 §3.7、§2.3 输出确定性）。
#[must_use]
pub fn sort_diagnostics(mut diagnostics: Vec<Diagnostic>) -> Vec<Diagnostic> {
    diagnostics.sort_by(|left, right| diagnostic_sort_key(left).cmp(&diagnostic_sort_key(right)));
    diagnostics.dedup_by(|left, right| {
        left.severity == right.severity
            && left.code == right.code
            && left.message == right.message
            && left.file == right.file
            && left.pointer == right.pointer
            && left.line == right.line
            && left.column == right.column
    });
    diagnostics
}

/// 致命错误：操作无法继续（设计稿 §8.1、§8.2）。
///
/// `details` 必须携带已收集的结构化诊断，供上层直接展示与定位；
/// 跨边界归一见 [`impl From<DocumentError> for chips_core::ChipsError`]。
#[derive(Debug, Clone, Error)]
pub enum DocumentError {
    /// 入口路径不存在。
    #[error("文档入口不存在：{path}")]
    NotFound {
        /// 入口路径。
        path: String,
    },
    /// 读取失败（权限、IO、映射失败）。
    #[error("{message}")]
    Io {
        /// 简体中文原因。
        message: String,
    },
    /// 非目录、非 ZIP，或与声明格式不符。
    #[error("{message}")]
    FormatUnknown {
        /// 简体中文原因。
        message: String,
    },
    /// 缺少元数据文件。
    #[error("缺少元数据文件：{file}")]
    MetadataMissing {
        /// 期望的元数据路径。
        file: PackagePath,
    },
    /// metadata 语法或 schema 失败。
    #[error("元数据解析失败：{message}")]
    MetadataInvalid {
        /// 简体中文原因。
        message: String,
        /// 已收集的结构化诊断。
        diagnostics: Vec<Diagnostic>,
    },
    /// structure 语法或 schema 失败（全量解析时致命）。
    #[error("结构解析失败：{message}")]
    StructureInvalid {
        /// 简体中文原因。
        message: String,
        /// 已收集的结构化诊断。
        diagnostics: Vec<Diagnostic>,
    },
    /// `chip_standards_version` 主版本过旧。
    #[error("文档标准版本 {version} 过旧，请使用迁移工具升级后再打开")]
    VersionOutdated {
        /// 文档声明的版本。
        version: String,
    },
    /// `chip_standards_version` 主版本过新。
    #[error("文档标准版本 {version} 过新，请升级薯片平台后再打开")]
    VersionUnsupported {
        /// 文档声明的版本。
        version: String,
    },
    /// 归档损坏、重复路径、加密或非法压缩方法。
    #[error("归档非法：{message}")]
    ArchiveInvalid {
        /// 简体中文原因。
        message: String,
    },
    /// 包内路径越界或非法字符。
    #[error("包内路径不安全：{path}")]
    PathUnsafe {
        /// 命中的原始路径文本。
        path: String,
    },
    /// 超出解析限额（设计稿 §9.1）。
    #[error("超出解析限额 {limit}：{actual}")]
    LimitExceeded {
        /// 限额名称。
        limit: &'static str,
        /// 实际值描述。
        actual: String,
        /// 触发限额的文件（如适用）。
        file: Option<PackagePath>,
    },
    /// 调用方取消。
    #[error("解析已取消")]
    ParseCancelled,
}

impl DocumentError {
    /// 错误码（设计稿 §8.2 码表）。
    #[must_use]
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound { .. } => DOCUMENT_NOT_FOUND,
            Self::Io { .. } => DOCUMENT_IO,
            Self::FormatUnknown { .. } => DOCUMENT_FORMAT_UNKNOWN,
            Self::MetadataMissing { .. } => DOCUMENT_METADATA_MISSING,
            Self::MetadataInvalid { .. } => DOCUMENT_METADATA_INVALID,
            Self::StructureInvalid { .. } => DOCUMENT_STRUCTURE_INVALID,
            Self::VersionOutdated { .. } => DOCUMENT_VERSION_OUTDATED,
            Self::VersionUnsupported { .. } => DOCUMENT_VERSION_UNSUPPORTED,
            Self::ArchiveInvalid { .. } => DOCUMENT_ARCHIVE_INVALID,
            Self::PathUnsafe { .. } => DOCUMENT_PATH_UNSAFE,
            Self::LimitExceeded { .. } => DOCUMENT_LIMIT_EXCEEDED,
            Self::ParseCancelled => DOCUMENT_PARSE_CANCELLED,
        }
    }

    /// 是否可重试（设计稿 §8.2 表「可重试」列）。
    #[must_use]
    pub fn retryable(&self) -> bool {
        matches!(self, Self::Io { .. } | Self::ParseCancelled)
    }

    /// 携带的结构化诊断（如有）。
    #[must_use]
    pub fn diagnostics(&self) -> &[Diagnostic] {
        match self {
            Self::MetadataInvalid { diagnostics, .. }
            | Self::StructureInvalid { diagnostics, .. } => diagnostics,
            _ => &[],
        }
    }

    /// 结构化 `details`：诊断列表，或限额三元组 `{limit, actual, file?}`。
    #[must_use]
    pub fn details(&self) -> Option<serde_json::Value> {
        let diagnostics = sort_diagnostics(self.diagnostics().to_vec());
        match self {
            Self::LimitExceeded {
                limit,
                actual,
                file,
            } => Some(serde_json::json!({
                "limit": limit,
                "actual": actual,
                "file": file.as_ref().map(|path| serde_json::Value::String(path.to_string())),
                "diagnostics": serde_json::to_value(&diagnostics).unwrap_or(serde_json::Value::Null),
            })),
            Self::Io { .. }
            | Self::NotFound { .. }
            | Self::FormatUnknown { .. }
            | Self::MetadataMissing { .. }
            | Self::VersionOutdated { .. }
            | Self::VersionUnsupported { .. }
            | Self::ArchiveInvalid { .. }
            | Self::PathUnsafe { .. }
            | Self::ParseCancelled => {
                if diagnostics.is_empty() {
                    None
                } else {
                    Some(serde_json::json!({ "diagnostics": diagnostics }))
                }
            }
            Self::MetadataInvalid { .. } | Self::StructureInvalid { .. } => {
                Some(serde_json::json!({ "diagnostics": diagnostics }))
            }
        }
    }

    /// 归一为跨边界统一错误 `ChipsError`（《核心接口规范》§3.3）。
    #[must_use]
    pub fn to_chips_error(&self) -> chips_core::ChipsError {
        let error = chips_core::ChipsError::new(self.code(), self.to_string())
            .with_retryable(self.retryable());
        match self.details() {
            Some(details) => error.with_details(details),
            None => error,
        }
    }
}

impl From<DocumentError> for chips_core::ChipsError {
    fn from(error: DocumentError) -> Self {
        error.to_chips_error()
    }
}

/// 便捷结果别名：解析器内部的致命结果。
pub(crate) type Fatal<T> = Result<T, DocumentError>;

#[cfg(test)]
mod tests {
    use super::*;

    fn path(text: &str) -> PackagePath {
        PackagePath::new(text).expect("测试路径必须合法")
    }

    #[test]
    fn test_error_codes_match_table() {
        // 与《06-文档解析器设计》§8.2 码表逐字一致。
        assert_eq!(DOCUMENT_NOT_FOUND, "DOCUMENT_NOT_FOUND");
        assert_eq!(DOCUMENT_IO, "DOCUMENT_IO");
        assert_eq!(DOCUMENT_FORMAT_UNKNOWN, "DOCUMENT_FORMAT_UNKNOWN");
        assert_eq!(DOCUMENT_METADATA_MISSING, "DOCUMENT_METADATA_MISSING");
        assert_eq!(DOCUMENT_METADATA_INVALID, "DOCUMENT_METADATA_INVALID");
        assert_eq!(DOCUMENT_STRUCTURE_INVALID, "DOCUMENT_STRUCTURE_INVALID");
        assert_eq!(DOCUMENT_VERSION_OUTDATED, "DOCUMENT_VERSION_OUTDATED");
        assert_eq!(DOCUMENT_VERSION_UNSUPPORTED, "DOCUMENT_VERSION_UNSUPPORTED");
        assert_eq!(DOCUMENT_ARCHIVE_INVALID, "DOCUMENT_ARCHIVE_INVALID");
        assert_eq!(DOCUMENT_PATH_UNSAFE, "DOCUMENT_PATH_UNSAFE");
        assert_eq!(DOCUMENT_LIMIT_EXCEEDED, "DOCUMENT_LIMIT_EXCEEDED");
        assert_eq!(DOCUMENT_PARSE_CANCELLED, "DOCUMENT_PARSE_CANCELLED");
    }

    #[test]
    fn test_diagnostic_codes_match_table() {
        // 与《06-文档解析器设计》§8.3 码表逐字一致。
        assert_eq!(YAML_SYNTAX_ERROR, "YAML_SYNTAX_ERROR");
        assert_eq!(SCHEMA_REQUIRED_MISSING, "SCHEMA_REQUIRED_MISSING");
        assert_eq!(SCHEMA_TYPE_MISMATCH, "SCHEMA_TYPE_MISMATCH");
        assert_eq!(YAML_UNSUPPORTED_TAG, "YAML_UNSUPPORTED_TAG");
        assert_eq!(SCHEMA_UNKNOWN_FIELD, "SCHEMA_UNKNOWN_FIELD");
        assert_eq!(SCHEMA_DEFAULT_APPLIED, "SCHEMA_DEFAULT_APPLIED");
        assert_eq!(STRUCTURE_CONTENT_MISSING, "STRUCTURE_CONTENT_MISSING");
        assert_eq!(STRUCTURE_NODE_FAILED, "STRUCTURE_NODE_FAILED");
        assert_eq!(ENTRY_SOURCE_INVALID, "ENTRY_SOURCE_INVALID");
        assert_eq!(ENTRY_TARGET_MISSING, "ENTRY_TARGET_MISSING");
        assert_eq!(ENTRY_FAILED, "ENTRY_FAILED");
        assert_eq!(
            DOCUMENT_RESOURCE_FILE_MISSING,
            "DOCUMENT_RESOURCE_FILE_MISSING"
        );
        assert_eq!(
            DOCUMENT_RESOURCE_INTEGRITY_MISMATCH,
            "DOCUMENT_RESOURCE_INTEGRITY_MISMATCH"
        );
        assert_eq!(DOCUMENT_UNREFERENCED_FILE, "DOCUMENT_UNREFERENCED_FILE");
        assert_eq!(
            DOCUMENT_GENERATED_FILE_IGNORED,
            "DOCUMENT_GENERATED_FILE_IGNORED"
        );
        assert_eq!(DOCUMENT_SYMLINK_IGNORED, "DOCUMENT_SYMLINK_IGNORED");
        assert_eq!(DOCUMENT_UNICODE_NORMALIZED, "DOCUMENT_UNICODE_NORMALIZED");
        assert_eq!(DOCUMENT_EXTENSION_MISMATCH, "DOCUMENT_EXTENSION_MISMATCH");
        assert_eq!(DOCUMENT_VERSION_MISMATCH, "DOCUMENT_VERSION_MISMATCH");
    }

    #[test]
    fn test_error_code_and_retryable_mapping() {
        assert_eq!(
            DocumentError::NotFound {
                path: "x.card".into()
            }
            .code(),
            DOCUMENT_NOT_FOUND
        );
        assert!(!DocumentError::NotFound {
            path: "x.card".into()
        }
        .retryable());
        assert!(DocumentError::Io {
            message: "读取失败".into()
        }
        .retryable());
        assert!(DocumentError::ParseCancelled.retryable());
        let limit = DocumentError::LimitExceeded {
            limit: "max_yaml_bytes",
            actual: "12 bytes > 8 bytes".into(),
            file: Some(path(".card/metadata.yaml")),
        };
        assert_eq!(limit.code(), DOCUMENT_LIMIT_EXCEEDED);
        let details = limit.details().expect("限额错误必须携带 details");
        assert_eq!(details["limit"], "max_yaml_bytes");
        assert_eq!(details["file"], ".card/metadata.yaml");
    }

    #[test]
    fn test_chips_error_normalization() {
        let error = DocumentError::MetadataInvalid {
            message: "缺少字段".into(),
            diagnostics: vec![Diagnostic::new(
                Severity::Error,
                SCHEMA_REQUIRED_MISSING,
                "缺少必填字段 name",
            )
            .at(&path(".card/metadata.yaml"), "/name")],
        };
        let chips_error = chips_core::ChipsError::from(error);
        assert_eq!(chips_error.code(), DOCUMENT_METADATA_INVALID);
        assert!(chips_error.message().contains("元数据解析失败"));
        assert!(!chips_error.retryable());
        let details = chips_error.details().expect("诊断必须进入 details");
        assert_eq!(details["diagnostics"][0]["code"], SCHEMA_REQUIRED_MISSING);
        assert_eq!(details["diagnostics"][0]["pointer"], "/name");
    }

    #[test]
    fn test_sort_diagnostics_orders_and_dedups() {
        let file_b = path("content/bbbbbbbbbb.yaml");
        let file_a = path("content/aaaaaaaaaa.yaml");
        let diagnostics = sort_diagnostics(vec![
            Diagnostic::new(Severity::Warning, SCHEMA_UNKNOWN_FIELD, "乙")
                .in_file(&file_b)
                .with_location(Some(3), Some(1)),
            Diagnostic::new(Severity::Info, SCHEMA_DEFAULT_APPLIED, "甲")
                .in_file(&file_a)
                .with_location(Some(1), Some(1)),
            Diagnostic::new(Severity::Info, SCHEMA_DEFAULT_APPLIED, "甲")
                .in_file(&file_a)
                .with_location(Some(1), Some(1)),
        ]);
        assert_eq!(diagnostics.len(), 2, "完全重复的诊断必须去重");
        assert_eq!(
            diagnostics[0].code, SCHEMA_DEFAULT_APPLIED,
            "按文件路径排序"
        );
        assert_eq!(diagnostics[1].code, SCHEMA_UNKNOWN_FIELD);
    }

    #[test]
    fn test_strict_escalation() {
        let warning = Diagnostic::new(Severity::Warning, SCHEMA_UNKNOWN_FIELD, "未知字段");
        let escalated = warning.clone().escalated(true);
        assert_eq!(escalated.severity, Severity::Error);
        // 未标注「严格：错误」的警告码不升级。
        let kept =
            Diagnostic::new(Severity::Warning, ENTRY_TARGET_MISSING, "目标缺失").escalated(true);
        assert_eq!(kept.severity, Severity::Warning);
        assert_eq!(warning.escalated(false).severity, Severity::Warning);
    }

    #[test]
    fn test_diagnostic_serialization_shape() {
        // TS 侧 IDiagnostic 口径：severity 小写字面量、缺省字段省略。
        let diagnostic = Diagnostic::new(Severity::Error, YAML_SYNTAX_ERROR, "语法错误")
            .with_location(Some(2), Some(5));
        let json = serde_json::to_value(&diagnostic).expect("诊断必须可序列化");
        assert_eq!(json["severity"], "error");
        assert_eq!(json["code"], "YAML_SYNTAX_ERROR");
        assert_eq!(json["line"], 2);
        assert!(json.get("hint").is_none());
    }
}
