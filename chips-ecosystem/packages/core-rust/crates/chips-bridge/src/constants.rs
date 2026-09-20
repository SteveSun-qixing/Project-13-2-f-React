//! Bridge 策略常量：默认超时、队列上限、会话在途上限与校验聚合上限。
//!
//! 本模块是这些数值的唯一权威（《Bridge三层设计》§4.1、§6.2、§8、
//! 《能力契约规范》§5.4），其它模块只引用本节数值，不自行书写。

/// 调用超时默认值（毫秒）；注册项 `timeout_ms` 未显式给出时的缺省。
///
/// 见《Bridge三层设计》§8.1：从 Bridge 层收到请求起算，至返回结果或异常为止。
pub const DEFAULT_TIMEOUT_MS: u64 = 30_000;

/// 串行队列上限默认值；`Concurrency::Serial` 时等待数的缺省上限。
///
/// 等待数达到上限后新的串行准入返回 `BRIDGE_QUEUE_OVERFLOW`（《Bridge三层设计》§8.3）。
pub const DEFAULT_MAX_QUEUE: usize = 32;

/// 同一会话对同一能力的在途调用上限。
///
/// 超限返回 `BRIDGE_SESSION_BUSY`（《Bridge三层设计》§4.1、§8.3）。
/// 《核心接口规范》§5.1 的 Rust 注册项不携带该字段，因此固定取 4.1 的默认值。
pub const SESSION_IN_FLIGHT_LIMIT: usize = 64;

/// 共享 schema 编译缓存上限条数（LRU 淘汰）。
///
/// 见《Bridge三层设计》§6.2：以 schema 内容摘要（SHA-256）为键，上限 256 条。
pub const SCHEMA_CACHE_CAPACITY: usize = 256;

/// `BRIDGE_INVALID_INPUT` 单次聚合返回的校验错误条数上限。
///
/// 见《能力契约规范》§5.4：按 JSON Pointer 字典序升序排列，最多 16 条，
/// 超出时截断并置 `truncated: true`。
pub const MAX_VALIDATION_ISSUES: usize = 16;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bridge_constants_match_spec() {
        assert_eq!(DEFAULT_TIMEOUT_MS, 30_000);
        assert_eq!(DEFAULT_MAX_QUEUE, 32);
        assert_eq!(SESSION_IN_FLIGHT_LIMIT, 64);
        assert_eq!(SCHEMA_CACHE_CAPACITY, 256);
        assert_eq!(MAX_VALIDATION_ISSUES, 16);
    }
}
