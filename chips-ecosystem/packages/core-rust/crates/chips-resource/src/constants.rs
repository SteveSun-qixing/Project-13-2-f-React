//! 资源限额默认值（《04-资源管理设计》§十二 默认配置、《06-资源协议规范》§9.3）。
//!
//! 段一在册面：一次性读写上限、单资源上限、单次拉取上限、句柄池上限与
//! URI/路径长度上限；缓存、网络超时与重定向等段二/三面仅在册登记默认值，
//! 由后续分段消费。

use serde::{Deserialize, Serialize};

/// MiB 字节数。
pub const MIB: u64 = 1024 * 1024;

/// 一次性 `read()` / `write()` 与单条内存缓存上限（8 MiB，《04》§12 `maxInlineBytes`）。
pub const DEFAULT_MAX_INLINE_BYTES: u64 = 8 * MIB;
/// 单资源大小上限（2 GiB，《04》§12 `maxResourceBytes`）。
pub const DEFAULT_MAX_RESOURCE_BYTES: u64 = 2 * 1024 * MIB;
/// 单次流式拉取与单条 IPC 上限（256 KiB，《04》§12 `chunkBytes`）。
pub const DEFAULT_CHUNK_BYTES: usize = 256 * 1024;
/// 单插件句柄上限（《04》§12 `maxHandlesPerPlugin`）。
pub const DEFAULT_MAX_HANDLES_PER_PLUGIN: usize = 64;
/// 全局句柄上限（《04》§12 `maxHandlesTotal`）。
pub const DEFAULT_MAX_HANDLES_TOTAL: usize = 4096;
/// URI 总长度上限（《06》§2.4 `length`；默认数值文档未在册，见 README 漂移登记第 5 条）。
pub const DEFAULT_MAX_URI_BYTES: usize = 8192;
/// 路径长度上限（《06》§2.4 `length`）。
pub const DEFAULT_MAX_PATH_BYTES: usize = 4096;
/// 单段长度上限（《06》§2.4 `length`）。
pub const DEFAULT_MAX_SEGMENT_BYTES: usize = 255;

/// 资源限额集合；构造 [`ResourceManager`](crate::manager::ResourceManager) 时注入。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceLimits {
    /// 一次性读写与单条内存缓存上限（字节）。
    pub max_inline_bytes: u64,
    /// 单资源大小上限（字节）。
    pub max_resource_bytes: u64,
    /// 单次流式拉取上限（字节）。
    pub chunk_bytes: usize,
    /// 单插件句柄上限。
    pub max_handles_per_plugin: usize,
    /// 全局句柄上限。
    pub max_handles_total: usize,
    /// URI 总长度上限（字节）。
    pub max_uri_bytes: usize,
    /// 路径长度上限（字节）。
    pub max_path_bytes: usize,
    /// 单段长度上限（字节）。
    pub max_segment_bytes: usize,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_inline_bytes: DEFAULT_MAX_INLINE_BYTES,
            max_resource_bytes: DEFAULT_MAX_RESOURCE_BYTES,
            chunk_bytes: DEFAULT_CHUNK_BYTES,
            max_handles_per_plugin: DEFAULT_MAX_HANDLES_PER_PLUGIN,
            max_handles_total: DEFAULT_MAX_HANDLES_TOTAL,
            max_uri_bytes: DEFAULT_MAX_URI_BYTES,
            max_path_bytes: DEFAULT_MAX_PATH_BYTES,
            max_segment_bytes: DEFAULT_MAX_SEGMENT_BYTES,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_defaults_match_registered_config() {
        // 与《04》§12 默认配置表逐字一致。
        let limits = ResourceLimits::default();
        assert_eq!(limits.max_inline_bytes, 8 * 1024 * 1024);
        assert_eq!(limits.max_resource_bytes, 2 * 1024 * 1024 * 1024);
        assert_eq!(limits.chunk_bytes, 256 * 1024);
        assert_eq!(limits.max_handles_per_plugin, 64);
        assert_eq!(limits.max_handles_total, 4096);
    }

    #[test]
    fn test_limits_serialization_camel_case() {
        let json = serde_json::to_value(ResourceLimits::default()).expect("限额必须可序列化");
        assert!(json.get("maxInlineBytes").is_some());
        assert!(json.get("maxHandlesPerPlugin").is_some());
    }
}
