//! 版本常量。

/// 平台统一版本；与全部平台包共用同一版本号。
///
/// 取自 crate 包版本（工作区统一版本）。
pub const PLATFORM_VERSION: &str = env!("CARGO_PKG_VERSION");

/// 原生绑定 ABI 版本；导出面变更时递增。
///
/// 见《核心接口规范》§9.2：导出函数名只增不改；改名、改参数顺序、改返回形状
/// 必须递增本常量。
pub const CORE_ABI_VERSION: u32 = 1;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_platform_version_is_not_empty() {
        assert!(!PLATFORM_VERSION.is_empty());
    }

    #[test]
    fn test_core_abi_version_is_stable() {
        assert_eq!(CORE_ABI_VERSION, 1);
    }
}
