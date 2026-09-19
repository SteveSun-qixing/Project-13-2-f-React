//! 跨语言边界的统一错误。

use thiserror::Error;

/// 跨边界错误只有一个形状：`ChipsError`。
///
/// 子系统错误保持各自的强类型枚举（如 `chips-cordis` 的 `KernelError`），在
/// Neon 边界归一为本类型；字段规则见《核心接口规范》§3.3。
#[derive(Debug, Clone, Error)]
#[error("{message}")]
pub struct ChipsError {
    code: String,
    message: String,
    details: Option<serde_json::Value>,
    retryable: bool,
}

impl ChipsError {
    /// 以错误码与用户可读消息构造；`retryable` 默认 `false`。
    ///
    /// `code` 必须遵循 `<DOMAIN>_<REASON>` 命名；`message` 使用简体中文、
    /// 面向用户，不携带堆栈、内部路径与原始输入。
    #[must_use]
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
            retryable: false,
        }
    }

    /// 附加结构化诊断（JSON Pointer、字段名、目标等）。
    #[must_use]
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }

    /// 标记可重试；仅当重新执行可能成功时使用。
    #[must_use]
    pub fn with_retryable(mut self, retryable: bool) -> Self {
        self.retryable = retryable;
        self
    }

    /// 错误码。
    #[must_use]
    pub fn code(&self) -> &str {
        &self.code
    }

    /// 面向用户的简体中文消息。
    #[must_use]
    pub fn message(&self) -> &str {
        &self.message
    }

    /// 结构化诊断。
    #[must_use]
    pub fn details(&self) -> Option<&serde_json::Value> {
        self.details.as_ref()
    }

    /// 是否可重试。
    #[must_use]
    pub fn retryable(&self) -> bool {
        self.retryable
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_defaults() {
        let error = ChipsError::new("KERNEL_SERVICE_NOT_FOUND", "服务不存在：file");
        assert_eq!(error.code(), "KERNEL_SERVICE_NOT_FOUND");
        assert_eq!(error.message(), "服务不存在：file");
        assert!(error.details().is_none());
        assert!(!error.retryable());
        assert_eq!(error.to_string(), "服务不存在：file");
    }

    #[test]
    fn test_with_details_and_retryable() {
        let error = ChipsError::new("DOCUMENT_PARSE_FAILED", "文档解析失败")
            .with_details(serde_json::json!({ "pointer": "/content" }))
            .with_retryable(true);
        assert_eq!(
            error.details().map(|value| value["pointer"].clone()),
            Some(serde_json::json!("/content"))
        );
        assert!(error.retryable());
    }
}
