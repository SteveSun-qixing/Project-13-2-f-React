//! Bridge 错误码常量。
//!
//! 码表权威见《Bridge三层设计》§9.2 与《能力契约规范》§十一；绑定层与测试按
//! 本模块常量分支，禁止匹配 `message` 文本。

/// 能力 ID 未注册（调用期）。
pub const BRIDGE_CAPABILITY_NOT_FOUND: &str = "BRIDGE_CAPABILITY_NOT_FOUND";
/// 注册冲突：ID 格式非法、未登记 ID、登记提供方与 `owner` 不一致、重复注册定义不一致、ID 与权限 ID 相同。
pub const BRIDGE_CAPABILITY_CONFLICT: &str = "BRIDGE_CAPABILITY_CONFLICT";
/// 注册期 schema 编译失败。
pub const BRIDGE_INVALID_SCHEMA: &str = "BRIDGE_INVALID_SCHEMA";
/// 会话快照未覆盖能力所需权限。
pub const BRIDGE_PERMISSION_DENIED: &str = "BRIDGE_PERMISSION_DENIED";
/// 输入未通过 JSON Schema 校验（含二进制信封校验失败）。
pub const BRIDGE_INVALID_INPUT: &str = "BRIDGE_INVALID_INPUT";
/// 超过注册项 `timeout_ms`。
pub const BRIDGE_TIMEOUT: &str = "BRIDGE_TIMEOUT";
/// 会话销毁、能力注销、`signal` 触发或 Bridge 关闭导致取消。
pub const BRIDGE_CANCELLED: &str = "BRIDGE_CANCELLED";
/// 来源会话无法解析或已关闭。
pub const BRIDGE_SESSION_UNKNOWN: &str = "BRIDGE_SESSION_UNKNOWN";
/// 会话对同一能力的在途调用超过 `SESSION_IN_FLIGHT_LIMIT`。
pub const BRIDGE_SESSION_BUSY: &str = "BRIDGE_SESSION_BUSY";
/// 串行队列溢出。
pub const BRIDGE_QUEUE_OVERFLOW: &str = "BRIDGE_QUEUE_OVERFLOW";
/// 未归一异常（含执行器 panic）。
pub const BRIDGE_INTERNAL: &str = "BRIDGE_INTERNAL";
/// 能力声明引用了未注册的权限 ID。
pub const PERMISSION_UNKNOWN: &str = "PERMISSION_UNKNOWN";
/// 能力所需权限未在提供方 manifest 声明。
pub const PERMISSION_NOT_DECLARED: &str = "PERMISSION_NOT_DECLARED";
/// 权限限定值非法或缺失（《插件清单规范》§6.2/§九、《权限系统设计》§9.1）。
pub const PERMISSION_INVALID: &str = "PERMISSION_INVALID";
/// 权限不适用于申请方角色（《插件清单规范》§九、《权限系统设计》§9.1）。
pub const PERMISSION_ROLE_NOT_ALLOWED: &str = "PERMISSION_ROLE_NOT_ALLOWED";
/// 插件生命周期状态错误：能力注册时 `owner` 未激活。
pub const KERNEL_INVALID_TRANSITION: &str = "KERNEL_INVALID_TRANSITION";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_code_values() {
        assert_eq!(BRIDGE_TIMEOUT, "BRIDGE_TIMEOUT");
        assert_eq!(PERMISSION_NOT_DECLARED, "PERMISSION_NOT_DECLARED");
        assert_eq!(KERNEL_INVALID_TRANSITION, "KERNEL_INVALID_TRANSITION");
        // 与 `@chips/bridge` PERMISSION_ERROR_CODES 四码表逐项一致（工单 013 口径）。
        assert_eq!(PERMISSION_UNKNOWN, "PERMISSION_UNKNOWN");
        assert_eq!(PERMISSION_INVALID, "PERMISSION_INVALID");
        assert_eq!(PERMISSION_ROLE_NOT_ALLOWED, "PERMISSION_ROLE_NOT_ALLOWED");
    }
}
