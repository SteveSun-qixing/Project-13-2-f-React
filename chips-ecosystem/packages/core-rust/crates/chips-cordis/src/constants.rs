//! 内核策略常量：生命周期超时、软配额、事件深度与崩溃重启。
//!
//! 本模块是这些数值的唯一权威（《薯片内核设计》§6.7、§6.8、§6.9、§8.3），
//! 其它文档只引用本节数值，不自行书写。

use std::time::Duration;

/// `PluginRunner::apply` 超时上限。
///
/// 超时按强制撤销处理并返回 `KERNEL_LIFECYCLE_TIMEOUT`（《薯片内核设计》§6.7）。
pub const LIFECYCLE_APPLY_TIMEOUT: Duration = Duration::from_secs(30);

/// `PluginRunner::stop` 超时上限。
///
/// 超时后不再等待回调，直接进入强制撤销（《薯片内核设计》§6.7）。
pub const LIFECYCLE_STOP_TIMEOUT: Duration = Duration::from_secs(10);

/// Fork 强制撤销时等待任务退出的上限。
pub const FORK_FORCE_DISPOSE_TIMEOUT: Duration = Duration::from_secs(30);

/// 事件派发深度上限，防止监听器递归发布导致栈溢出。
pub const MAX_EVENT_DEPTH: usize = 64;

/// 注入级联重建深度上限；超过即中止本轮重建。
pub const MAX_REBUILD_DEPTH: usize = 16;

/// 单插件内存软配额：256 MiB，按 5s 采样估算。
pub const PLUGIN_MEMORY_QUOTA_BYTES: u64 = 256 * 1024 * 1024;

/// 内存配额采样间隔。
pub const PLUGIN_MEMORY_SAMPLE_INTERVAL: Duration = Duration::from_secs(5);

/// 单插件活跃任务数软配额。
pub const PLUGIN_TASK_QUOTA: usize = 32;

/// 单插件每秒消息速率软配额（Bridge 调用与事件发布合计，1s 滑动窗口）。
pub const PLUGIN_MESSAGE_RATE_PER_SECOND: u32 = 200;

/// 单插件消息速率窗口长度。
pub const PLUGIN_MESSAGE_RATE_WINDOW: Duration = Duration::from_secs(1);

/// 单插件无交互后台运行时长软配额。
pub const PLUGIN_BACKGROUND_TIME_QUOTA: Duration = Duration::from_secs(10 * 60);

/// 崩溃重启滚动窗口长度。
pub const CRASH_RESTART_WINDOW: Duration = Duration::from_secs(10 * 60);

/// 崩溃重启窗口内最大自动重启次数。
pub const CRASH_RESTART_MAX_ATTEMPTS: u32 = 3;

/// 崩溃重启首次退避间隔。
pub const CRASH_RESTART_BACKOFF_INITIAL: Duration = Duration::from_secs(1);

/// 崩溃重启单次退避间隔上限。
pub const CRASH_RESTART_BACKOFF_MAX: Duration = Duration::from_secs(30);

/// 内核发布标准生命周期事件时的发布者身份。
pub const KERNEL_SOURCE: &str = "chips.kernel";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lifecycle_timeouts_match_spec() {
        assert_eq!(LIFECYCLE_APPLY_TIMEOUT, Duration::from_secs(30));
        assert_eq!(LIFECYCLE_STOP_TIMEOUT, Duration::from_secs(10));
        assert_eq!(FORK_FORCE_DISPOSE_TIMEOUT, Duration::from_secs(30));
    }

    #[test]
    fn test_quota_constants_match_spec() {
        assert_eq!(PLUGIN_TASK_QUOTA, 32);
        assert_eq!(PLUGIN_MESSAGE_RATE_PER_SECOND, 200);
        assert_eq!(PLUGIN_BACKGROUND_TIME_QUOTA, Duration::from_secs(600));
        assert_eq!(PLUGIN_MEMORY_QUOTA_BYTES, 268_435_456);
    }

    #[test]
    fn test_depth_limits() {
        assert_eq!(MAX_EVENT_DEPTH, 64);
        assert_eq!(MAX_REBUILD_DEPTH, 16);
    }
}
