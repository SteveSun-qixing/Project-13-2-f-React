//! 资源域错误模型：在册码表、强类型错误与 `ChipsError` 归一。
//!
//! 码表与 `details` 形状权威见《06-资源协议规范》§7（唯一权威）；错误只以
//! `code` 分支消费，禁止匹配 `message` 文本。段一产生的码由
//! [`ResourceError`] 变体承载；段二/三才会产生的码保留为常量并被码表锁测
//! 钉住（`retryable` 与 HTTP 映射逐码在册）。

use serde::Serialize;
use thiserror::Error;

// ---------------------------------------------------------------------------
// 在册错误码（《06》§7.2 错误码表，逐字一致）
// ---------------------------------------------------------------------------

/// URI 语法非法：scope 段、受管作用域出现查询串、fragment、非法编码、userinfo、
/// 解码产物 Unicode 形态非法（`details.reason = unicode`，《06》§2.4）。
pub const RESOURCE_INVALID_URI: &str = "RESOURCE_INVALID_URI";
/// `resource()` 收到 `chips-resource://` 与 `http(s)://` 以外的 scheme。
pub const RESOURCE_UNSUPPORTED_SCHEME: &str = "RESOURCE_UNSUPPORTED_SCHEME";
/// 作用域未注册，或作用域内资源不存在。
pub const RESOURCE_NOT_FOUND: &str = "RESOURCE_NOT_FOUND";
/// 路径非法：穿越、绝对路径、分隔符、编码、控制字符、长度、符号链接、平台特例。
pub const RESOURCE_PATH_INVALID: &str = "RESOURCE_PATH_INVALID";
/// 无权限，或作用域未绑定到调用会话。
pub const RESOURCE_PERMISSION_DENIED: &str = "RESOURCE_PERMISSION_DENIED";
/// 超过 `read()` 上限或单资源大小上限。
pub const RESOURCE_TOO_LARGE: &str = "RESOURCE_TOO_LARGE";
/// 句柄流占用期间调用 `readRange()`。
pub const RESOURCE_BUSY: &str = "RESOURCE_BUSY";
/// 已释放句柄被使用。
pub const RESOURCE_HANDLE_RELEASED: &str = "RESOURCE_HANDLE_RELEASED";
/// 已失效句柄被使用；需重新获取。
pub const RESOURCE_HANDLE_INVALIDATED: &str = "RESOURCE_HANDLE_INVALIDATED";
/// 句柄数或读取队列超限。
pub const RESOURCE_POOL_EXHAUSTED: &str = "RESOURCE_POOL_EXHAUSTED";
/// 对归档或只读作用域就地写入。
pub const RESOURCE_READ_ONLY: &str = "RESOURCE_READ_ONLY";
/// 目标已存在（`rename` / `move` / `copy` 不覆盖）。
pub const RESOURCE_ALREADY_EXISTS: &str = "RESOURCE_ALREADY_EXISTS";
/// 目录非空（`delete` 非递归模式）。
pub const RESOURCE_NOT_EMPTY: &str = "RESOURCE_NOT_EMPTY";
/// 操作不被当前 Provider 支持（如 Platform / External 作用域不支持列举）。
pub const RESOURCE_NOT_SUPPORTED: &str = "RESOURCE_NOT_SUPPORTED";
/// 操作涉及跨作用域，但调用方无目标作用域权限。
pub const RESOURCE_CROSS_SCOPE: &str = "RESOURCE_CROSS_SCOPE";
/// 写入提交失败（磁盘、锁冲突）。
pub const RESOURCE_WRITE_FAILED: &str = "RESOURCE_WRITE_FAILED";
/// 外部请求失败：DNS、连接、TLS、超时、HTTP 状态、重定向、SSRF 拦截。
pub const RESOURCE_NETWORK_FAILED: &str = "RESOURCE_NETWORK_FAILED";
/// 未归一异常（协议层兜底）。
pub const RESOURCE_INTERNAL: &str = "RESOURCE_INTERNAL";

/// 协议路径 HTTP 状态映射（《06》§7.2 表；`None` 表示该错误只出现在句柄或写入提交路径）。
#[must_use]
pub fn http_status_for(code: &str) -> Option<u16> {
    match code {
        RESOURCE_INVALID_URI | RESOURCE_PATH_INVALID => Some(400),
        RESOURCE_NOT_FOUND => Some(404),
        RESOURCE_PERMISSION_DENIED | RESOURCE_CROSS_SCOPE => Some(403),
        RESOURCE_TOO_LARGE => Some(413),
        RESOURCE_BUSY | RESOURCE_POOL_EXHAUSTED => Some(503),
        RESOURCE_ALREADY_EXISTS | RESOURCE_NOT_EMPTY => Some(409),
        RESOURCE_NOT_SUPPORTED => Some(501),
        RESOURCE_NETWORK_FAILED => Some(502),
        RESOURCE_INTERNAL => Some(500),
        _ => None,
    }
}

/// 在册 `retryable` 表（《06》§7.2）。
#[must_use]
pub fn retryable_for(code: &str) -> bool {
    matches!(
        code,
        RESOURCE_BUSY
            | RESOURCE_HANDLE_INVALIDATED
            | RESOURCE_POOL_EXHAUSTED
            | RESOURCE_WRITE_FAILED
            | RESOURCE_NETWORK_FAILED
    )
}

// ---------------------------------------------------------------------------
// details.reason 词表（《06》§7.3）
// ---------------------------------------------------------------------------

/// URI 错误原因词表（`IResourceUriErrorDetails.reason`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UriErrorReason {
    /// scheme 前缀不可解析（非法/大小写变体之外的结构错误）。
    MalformedScheme,
    /// scheme 不在 `chips-resource://` 与裸 `http(s)://` 接受面内。
    UnsupportedScheme,
    /// scope 段语法非法。
    MalformedScope,
    /// path 段结构缺失或非法（语法级）。
    MalformedPath,
    /// 受管作用域出现查询串。
    QueryNotAllowed,
    /// 任何作用域出现 fragment。
    FragmentNotAllowed,
    /// 百分号编码非法（非两位十六进制等）。
    InvalidEncoding,
    /// External origin 非法（userinfo、端口、host 语法、scheme 段）。
    InvalidOrigin,
}

/// 路径错误原因词表（`IResourcePathErrorDetails.reason`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PathErrorReason {
    /// 绝对路径、盘符、UNC。
    Absolute,
    /// 反斜杠分隔符。
    Separator,
    /// 空段、`.`、`..`。
    Segment,
    /// 解码失败或解码产物不再合法。
    Encoding,
    /// 控制字符。
    Control,
    /// Unicode 形态非法（《06》§2.4 Unicode 行，工单042 裁定④触发规则：百分号解码
    /// 一次的字节序列须为合法 UTF-8 且不含非字符与替换字符 U+FFFD；段二 B1 已在
    /// `path_guard` 落地触发臂，产生面锁测见 `tests/error_code_lock.rs`）。
    Unicode,
    /// 总长/单段/路径超限。
    Length,
    /// 符号链接指向作用域根外。
    Symlink,
    /// 平台特例（ADS、设备名、尾随点与空格）。
    Platform,
}

/// 句柄状态（《06》§6.1 `ResourceState`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum HandleState {
    /// 已通过解析与权限判定，可读取。
    Open,
    /// 来源变化或授权失效；读操作返回 `RESOURCE_HANDLE_INVALIDATED`。
    Invalidated,
    /// 已释放终态；句柄 ID 永不复用。
    Released,
}

/// 失效原因（《06》§6.1 `ResourceInvalidateReason`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum InvalidateReason {
    /// 来源变化（`file:changed` / `document:changed`）。
    SourceChanged,
    /// 会话关闭。
    SessionClosed,
    /// 作用域注销或权限撤销。
    ScopeRevoked,
}

/// 句柄池超限类别（`IResourcePoolErrorDetails.kind`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PoolKind {
    /// 句柄数超限。
    Handles,
    /// 读取队列超限（段一不产生，词表在册）。
    Queue,
}

/// 权限拒绝原因（《02-Bridge三层设计》§5.4 `PermissionDenyReason`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionDenyReason {
    /// 未授予所需权限。
    NotGranted,
    /// 授权已撤销。
    Revoked,
    /// 超出作用域边界。
    OutOfScope,
    /// 用户拒绝。
    UserRejected,
    /// 平台策略。
    Policy,
}

/// 作用域操作类别（《06》§7.3 `IResourceScopeErrorDetails.operation` 六词）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ScopeOperation {
    /// 目录列举。
    List,
    /// 写入提交。
    Write,
    /// 删除。
    Delete,
    /// 重命名/移动。
    Rename,
    /// 复制。
    Copy,
    /// 创建目录。
    CreateDirectory,
}

// ---------------------------------------------------------------------------
// 强类型错误
// ---------------------------------------------------------------------------

/// 资源域致命错误；跨边界经 [`impl From<ResourceError> for chips_core::ChipsError`] 归一。
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ResourceError {
    /// URI 语法非法（`RESOURCE_INVALID_URI`）。
    #[error("资源 URI 语法非法：{uri}")]
    InvalidUri {
        /// 原始输入。
        uri: String,
        /// 语法原因。
        reason: UriErrorReason,
    },
    /// 不支持的 scheme（`RESOURCE_UNSUPPORTED_SCHEME`）。
    #[error("不支持的资源协议：{uri}")]
    UnsupportedScheme {
        /// 原始输入。
        uri: String,
    },
    /// 作用域未注册或资源不存在（`RESOURCE_NOT_FOUND`）。
    #[error("资源不存在：{uri}")]
    NotFound {
        /// 规范 URI。
        uri: String,
    },
    /// 路径非法（`RESOURCE_PATH_INVALID`；《06》§2.4 九词 reason 词表，
    /// 含 Unicode 触发臂——主智能体 2026-09-21 码归属更正：工单042 裁定④
    /// 初稿误记 `RESOURCE_INVALID_URI`，按 §7.3 词表归组与 §5.1 解析流水线
    /// 判定序更正文本，unicode 归路径族）。
    #[error("资源路径非法：{path}")]
    PathInvalid {
        /// 规范 URI（若已成形）。
        uri: String,
        /// 违规路径文本。
        path: String,
        /// 路径原因。
        reason: PathErrorReason,
    },
    /// 权限拒绝（`RESOURCE_PERMISSION_DENIED`）。
    #[error("无权访问资源：{target}")]
    PermissionDenied {
        /// 目标规范 URI（`details.target`）。
        target: String,
        /// 所需权限 ID。
        permission: String,
        /// 本次调用所需权限全集。
        required: Vec<String>,
        /// 缺失权限集。
        missing: Vec<String>,
        /// 调用方在册权限集。
        granted: Vec<String>,
        /// 拒绝原因。
        reason: PermissionDenyReason,
    },
    /// 超过大小上限（`RESOURCE_TOO_LARGE`）。
    #[error("资源超过大小上限 {limit} 字节：{uri}")]
    TooLarge {
        /// 规范 URI。
        uri: String,
        /// 实际大小。
        size: u64,
        /// 上限。
        limit: u64,
    },
    /// 流占用冲突（`RESOURCE_BUSY`）。
    #[error("句柄正被流读取占用：{uri}")]
    Busy {
        /// 规范 URI。
        uri: String,
    },
    /// 已释放句柄使用（`RESOURCE_HANDLE_RELEASED`）。
    #[error("资源句柄已释放")]
    HandleReleased {
        /// 规范 URI。
        uri: String,
    },
    /// 已失效句柄使用（`RESOURCE_HANDLE_INVALIDATED`）。
    #[error("资源句柄已失效，请重新获取")]
    HandleInvalidated {
        /// 规范 URI。
        uri: String,
        /// 失效原因。
        reason: InvalidateReason,
    },
    /// 句柄池超限（`RESOURCE_POOL_EXHAUSTED`）。
    #[error("资源句柄池超限（上限 {limit}）")]
    PoolExhausted {
        /// 超限类别。
        kind: PoolKind,
        /// 触发上限。
        limit: usize,
    },
    /// 只读来源就地写入（`RESOURCE_READ_ONLY`）。
    #[error("目标来源为只读，不允许就地写入：{uri}")]
    ReadOnly {
        /// 规范 URI。
        uri: String,
    },
    /// 目标已存在（`RESOURCE_ALREADY_EXISTS`；段一用于作用域/Provider 重复注册）。
    #[error("目标已存在：{uri}")]
    AlreadyExists {
        /// 冲突目标标识。
        uri: String,
    },
    /// 目录非空（`RESOURCE_NOT_EMPTY`；`delete` 非递归模式，《06》§7.2，
    /// 段二 B2 随 DirectoryProvider 产化；`details` 为 `{ uri }`，《06》§7.3）。
    #[error("目录非空，非递归删除被拒绝：{uri}")]
    NotEmpty {
        /// 规范 URI。
        uri: String,
    },
    /// 写入提交失败（`RESOURCE_WRITE_FAILED`；磁盘/锁冲突，《06》§7.2，
    /// 段二 B2 随 DirectoryProvider 持久化写族产化；`details` 为 `{ uri }`，
    /// §7.3 `cause` 分类词表未在册，不自造，见 findings）。
    #[error("写入提交失败：{uri}")]
    WriteFailed {
        /// 规范 URI（不含真实文件系统路径，《06》§7.1）。
        uri: String,
    },
    /// 操作不被当前 Provider/作用域支持（`RESOURCE_NOT_SUPPORTED`，
    /// 《06》§7.2/§7.3 `IResourceScopeErrorDetails`；如 Platform/External/Memory
    /// 不支持列举、Memory 形态 rename/copy 出会话）。
    #[error("操作不被支持：{uri}")]
    NotSupported {
        /// 规范 URI。
        uri: String,
        /// 作用域种类。
        scope: crate::scope::ScopeKind,
        /// 被拒绝的操作类别。
        operation: ScopeOperation,
    },
    /// 跨作用域且无目标作用域权限（`RESOURCE_CROSS_SCOPE`，《06》§7.2；
    /// `details` 复用 `IPermissionDeniedDetails`，`target` 填目标规范 URI）。
    #[error("跨作用域操作被拒绝：{target}")]
    CrossScope {
        /// 目标规范 URI（`details.target`）。
        target: String,
        /// 所需权限 ID。
        permission: String,
        /// 本次调用所需权限全集。
        required: Vec<String>,
        /// 缺失权限集。
        missing: Vec<String>,
        /// 调用方在册权限集。
        granted: Vec<String>,
        /// 拒绝原因。
        reason: PermissionDenyReason,
    },
    /// 未归一异常（`RESOURCE_INTERNAL`，协议层兜底，无 details）。
    #[error("资源操作内部错误")]
    Internal,
}

impl ResourceError {
    /// 错误码（《06》§7.2）。
    #[must_use]
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidUri { .. } => RESOURCE_INVALID_URI,
            Self::UnsupportedScheme { .. } => RESOURCE_UNSUPPORTED_SCHEME,
            Self::NotFound { .. } => RESOURCE_NOT_FOUND,
            Self::PathInvalid { .. } => RESOURCE_PATH_INVALID,
            Self::PermissionDenied { .. } => RESOURCE_PERMISSION_DENIED,
            Self::TooLarge { .. } => RESOURCE_TOO_LARGE,
            Self::Busy { .. } => RESOURCE_BUSY,
            Self::HandleReleased { .. } => RESOURCE_HANDLE_RELEASED,
            Self::HandleInvalidated { .. } => RESOURCE_HANDLE_INVALIDATED,
            Self::PoolExhausted { .. } => RESOURCE_POOL_EXHAUSTED,
            Self::ReadOnly { .. } => RESOURCE_READ_ONLY,
            Self::AlreadyExists { .. } => RESOURCE_ALREADY_EXISTS,
            Self::NotEmpty { .. } => RESOURCE_NOT_EMPTY,
            Self::WriteFailed { .. } => RESOURCE_WRITE_FAILED,
            Self::NotSupported { .. } => RESOURCE_NOT_SUPPORTED,
            Self::CrossScope { .. } => RESOURCE_CROSS_SCOPE,
            Self::Internal => RESOURCE_INTERNAL,
        }
    }

    /// 是否可重试（《06》§7.2 表）。
    #[must_use]
    pub fn retryable(&self) -> bool {
        retryable_for(self.code())
    }

    /// 结构化 `details`（《06》§7.3）；`RESOURCE_INTERNAL` 无 details。
    #[must_use]
    pub fn details(&self) -> Option<serde_json::Value> {
        match self {
            Self::InvalidUri { uri, reason } => Some(serde_json::json!({
                "uri": uri,
                "reason": reason,
            })),
            Self::UnsupportedScheme { uri } => Some(serde_json::json!({
                "uri": uri,
                "reason": UriErrorReason::UnsupportedScheme,
            })),
            Self::NotFound { uri } => Some(serde_json::json!({ "uri": uri })),
            Self::PathInvalid { uri, path, reason } => Some(serde_json::json!({
                "uri": uri,
                "path": path,
                "reason": reason,
            })),
            Self::PermissionDenied {
                target,
                permission,
                required,
                missing,
                granted,
                reason,
            } => Some(serde_json::json!({
                "capabilityId": serde_json::Value::Null,
                "permission": permission,
                "required": required,
                "missing": missing,
                "granted": granted,
                "reason": reason,
                "target": target,
            })),
            Self::TooLarge { uri, size, limit } => Some(serde_json::json!({
                "uri": uri,
                "size": size,
                "limit": limit,
            })),
            Self::Busy { uri } => Some(serde_json::json!({ "uri": uri })),
            Self::HandleReleased { uri } => Some(serde_json::json!({
                "uri": uri,
                "state": HandleState::Released,
            })),
            Self::HandleInvalidated { uri, reason } => Some(serde_json::json!({
                "uri": uri,
                "state": HandleState::Invalidated,
                "reason": reason,
            })),
            Self::PoolExhausted { kind, limit } => Some(serde_json::json!({
                "kind": kind,
                "limit": limit,
            })),
            Self::ReadOnly { uri } => Some(serde_json::json!({ "uri": uri })),
            Self::AlreadyExists { uri } => Some(serde_json::json!({ "uri": uri })),
            Self::NotEmpty { uri } => Some(serde_json::json!({ "uri": uri })),
            Self::WriteFailed { uri } => Some(serde_json::json!({ "uri": uri })),
            Self::NotSupported {
                uri,
                scope,
                operation,
            } => Some(serde_json::json!({
                "uri": uri,
                "scope": scope,
                "operation": operation,
            })),
            Self::CrossScope {
                target,
                permission,
                required,
                missing,
                granted,
                reason,
            } => Some(serde_json::json!({
                "capabilityId": serde_json::Value::Null,
                "permission": permission,
                "required": required,
                "missing": missing,
                "granted": granted,
                "reason": reason,
                "target": target,
            })),
            Self::Internal => None,
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

impl From<ResourceError> for chips_core::ChipsError {
    fn from(error: ResourceError) -> Self {
        error.to_chips_error()
    }
}

/// 资源域结果别名：同步判定入口的统一返回类型。
pub type ResourceResult<T> = Result<T, ResourceError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes_match_registered_table() {
        // 与《06-资源协议规范》§7.2 错误码表逐字一致（锁测）。
        assert_eq!(RESOURCE_INVALID_URI, "RESOURCE_INVALID_URI");
        assert_eq!(RESOURCE_UNSUPPORTED_SCHEME, "RESOURCE_UNSUPPORTED_SCHEME");
        assert_eq!(RESOURCE_NOT_FOUND, "RESOURCE_NOT_FOUND");
        assert_eq!(RESOURCE_PATH_INVALID, "RESOURCE_PATH_INVALID");
        assert_eq!(RESOURCE_PERMISSION_DENIED, "RESOURCE_PERMISSION_DENIED");
        assert_eq!(RESOURCE_TOO_LARGE, "RESOURCE_TOO_LARGE");
        assert_eq!(RESOURCE_BUSY, "RESOURCE_BUSY");
        assert_eq!(RESOURCE_HANDLE_RELEASED, "RESOURCE_HANDLE_RELEASED");
        assert_eq!(RESOURCE_HANDLE_INVALIDATED, "RESOURCE_HANDLE_INVALIDATED");
        assert_eq!(RESOURCE_POOL_EXHAUSTED, "RESOURCE_POOL_EXHAUSTED");
        assert_eq!(RESOURCE_READ_ONLY, "RESOURCE_READ_ONLY");
        assert_eq!(RESOURCE_ALREADY_EXISTS, "RESOURCE_ALREADY_EXISTS");
        assert_eq!(RESOURCE_NOT_EMPTY, "RESOURCE_NOT_EMPTY");
        assert_eq!(RESOURCE_NOT_SUPPORTED, "RESOURCE_NOT_SUPPORTED");
        assert_eq!(RESOURCE_CROSS_SCOPE, "RESOURCE_CROSS_SCOPE");
        assert_eq!(RESOURCE_WRITE_FAILED, "RESOURCE_WRITE_FAILED");
        assert_eq!(RESOURCE_NETWORK_FAILED, "RESOURCE_NETWORK_FAILED");
        assert_eq!(RESOURCE_INTERNAL, "RESOURCE_INTERNAL");
    }

    #[test]
    fn test_retryable_table() {
        // 《06》§7.2 retryable=true 仅五码。
        for code in [
            RESOURCE_BUSY,
            RESOURCE_HANDLE_INVALIDATED,
            RESOURCE_POOL_EXHAUSTED,
            RESOURCE_WRITE_FAILED,
            RESOURCE_NETWORK_FAILED,
        ] {
            assert!(retryable_for(code), "{code} 应为可重试");
        }
        for code in [
            RESOURCE_INVALID_URI,
            RESOURCE_UNSUPPORTED_SCHEME,
            RESOURCE_NOT_FOUND,
            RESOURCE_PATH_INVALID,
            RESOURCE_PERMISSION_DENIED,
            RESOURCE_TOO_LARGE,
            RESOURCE_HANDLE_RELEASED,
            RESOURCE_READ_ONLY,
            RESOURCE_ALREADY_EXISTS,
            RESOURCE_NOT_EMPTY,
            RESOURCE_NOT_SUPPORTED,
            RESOURCE_CROSS_SCOPE,
            RESOURCE_INTERNAL,
        ] {
            assert!(!retryable_for(code), "{code} 应为不可重试");
        }
    }

    #[test]
    fn test_http_status_table() {
        // 《06》§7.2 「协议路径 HTTP」列。
        assert_eq!(http_status_for(RESOURCE_INVALID_URI), Some(400));
        assert_eq!(http_status_for(RESOURCE_PATH_INVALID), Some(400));
        assert_eq!(http_status_for(RESOURCE_NOT_FOUND), Some(404));
        assert_eq!(http_status_for(RESOURCE_PERMISSION_DENIED), Some(403));
        assert_eq!(http_status_for(RESOURCE_CROSS_SCOPE), Some(403));
        assert_eq!(http_status_for(RESOURCE_TOO_LARGE), Some(413));
        assert_eq!(http_status_for(RESOURCE_BUSY), Some(503));
        assert_eq!(http_status_for(RESOURCE_POOL_EXHAUSTED), Some(503));
        assert_eq!(http_status_for(RESOURCE_ALREADY_EXISTS), Some(409));
        assert_eq!(http_status_for(RESOURCE_NOT_EMPTY), Some(409));
        assert_eq!(http_status_for(RESOURCE_NOT_SUPPORTED), Some(501));
        assert_eq!(http_status_for(RESOURCE_NETWORK_FAILED), Some(502));
        assert_eq!(http_status_for(RESOURCE_INTERNAL), Some(500));
        for code in [
            RESOURCE_UNSUPPORTED_SCHEME,
            RESOURCE_HANDLE_RELEASED,
            RESOURCE_HANDLE_INVALIDATED,
            RESOURCE_READ_ONLY,
            RESOURCE_WRITE_FAILED,
        ] {
            assert_eq!(http_status_for(code), None, "{code} 不应出现在协议路径");
        }
    }

    #[test]
    fn test_reason_wordlists_serialize_as_registered_literals() {
        // 《06》§7.3 reason 词表逐字（snake_case / kebab-case）。
        assert_eq!(
            serde_json::to_value(UriErrorReason::QueryNotAllowed).unwrap(),
            "query_not_allowed"
        );
        assert_eq!(
            serde_json::to_value(UriErrorReason::FragmentNotAllowed).unwrap(),
            "fragment_not_allowed"
        );
        assert_eq!(
            serde_json::to_value(UriErrorReason::InvalidEncoding).unwrap(),
            "invalid_encoding"
        );
        assert_eq!(
            serde_json::to_value(UriErrorReason::InvalidOrigin).unwrap(),
            "invalid_origin"
        );
        assert_eq!(
            serde_json::to_value(PathErrorReason::Symlink).unwrap(),
            "symlink"
        );
        assert_eq!(
            serde_json::to_value(PathErrorReason::Platform).unwrap(),
            "platform"
        );
        assert_eq!(
            serde_json::to_value(HandleState::Invalidated).unwrap(),
            "invalidated"
        );
        assert_eq!(
            serde_json::to_value(InvalidateReason::SourceChanged).unwrap(),
            "source-changed"
        );
        assert_eq!(serde_json::to_value(PoolKind::Handles).unwrap(), "handles");
        assert_eq!(
            serde_json::to_value(PermissionDenyReason::NotGranted).unwrap(),
            "not_granted"
        );
    }

    #[test]
    fn test_details_shapes() {
        let error = ResourceError::PathInvalid {
            uri: "chips-resource://card-7f3a/../x".into(),
            path: "../x".into(),
            reason: PathErrorReason::Segment,
        };
        let details = error.details().expect("路径错误必须携带 details");
        assert_eq!(details["reason"], "segment");
        assert_eq!(details["path"], "../x");

        let denied = ResourceError::PermissionDenied {
            target: "chips-resource://card-1/a".into(),
            permission: "resources:read:card-1".into(),
            required: vec!["resources:read:card-1".into()],
            missing: vec!["resources:read:card-1".into()],
            granted: vec![],
            reason: PermissionDenyReason::NotGranted,
        };
        let details = denied.details().expect("拒绝必须携带 details");
        assert_eq!(details["target"], "chips-resource://card-1/a");
        assert_eq!(details["reason"], "not_granted");
        assert!(details.get("capabilityId").is_some());

        let invalidated = ResourceError::HandleInvalidated {
            uri: "chips-resource://card-1/a".into(),
            reason: InvalidateReason::ScopeRevoked,
        };
        let details = invalidated.details().expect("失效必须携带 details");
        assert_eq!(details["state"], "invalidated");
        assert_eq!(details["reason"], "scope-revoked");
        assert!(invalidated.retryable());
    }

    #[test]
    fn test_chips_error_normalization() {
        let chips_error = chips_core::ChipsError::from(ResourceError::Busy {
            uri: "chips-resource://card-1/a".into(),
        });
        assert_eq!(chips_error.code(), RESOURCE_BUSY);
        assert!(chips_error.retryable());
        assert_eq!(
            chips_error.details().unwrap()["uri"],
            "chips-resource://card-1/a"
        );
    }
}
