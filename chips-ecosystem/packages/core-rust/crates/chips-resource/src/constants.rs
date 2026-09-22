//! 资源限额默认值（《04-资源管理设计》§十二 默认配置、《06-资源协议规范》§9.3）。
//!
//! 段三 #185 收口后，本表为《04》§12 全 13 键的唯一生产取值源：
//! 一次性读写上限、单资源上限、单次拉取上限、句柄池上限、URI/路径长度上限，
//! 以及缓存层（L0 元数据条目、L1/L2 字节预算）、网络层（重定向上限、
//! 三超时、外部资源 TTL）——缓存策略面（§6）与 HttpProvider 面（§8）
//! 全部经 [`ResourceLimits`] 消费，禁止任何模块绕过本结构自带魔法数。

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
/// L0 元数据缓存条目上限（4096，《04》§6.1 `metadataCacheEntries`、§12）。
pub const DEFAULT_METADATA_CACHE_ENTRIES: usize = 4096;
/// L1 内存字节缓存总量预算（64 MiB，《04》§6.2 `memoryCacheBytes`、§12）。
pub const DEFAULT_MEMORY_CACHE_BYTES: u64 = 64 * MIB;
/// L2 磁盘缓存总量预算（512 MiB，《04》§6.2/§8.4 `diskCacheBytes`、§12）。
pub const DEFAULT_DISK_CACHE_BYTES: u64 = 512 * MIB;
/// 外部请求重定向跳数上限（5，《04》§8.2 `redirectLimit`、§12）。
pub const DEFAULT_REDIRECT_LIMIT: usize = 5;
/// 连接超时（10 秒，《04》§8.2 `connectTimeoutMs`、§12）。
pub const DEFAULT_CONNECT_TIMEOUT_MS: u64 = 10_000;
/// 首字节超时（30 秒，《04》§8.2 `firstByteTimeoutMs`、§12）。
pub const DEFAULT_FIRST_BYTE_TIMEOUT_MS: u64 = 30_000;
/// 空闲超时（30 秒，《04》§8.2 `idleTimeoutMs`、§12）。
pub const DEFAULT_IDLE_TIMEOUT_MS: u64 = 30_000;
/// 外部资源默认 TTL（300 秒，《04》§6.3/§12 `externalTtlSeconds`）。
pub const DEFAULT_EXTERNAL_TTL_SECONDS: u64 = 300;

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
    /// L0 元数据缓存条目上限（《04》§6.1 `metadataCacheEntries`）。
    pub metadata_cache_entries: usize,
    /// L1 内存字节缓存总量预算（《04》§6.2 `memoryCacheBytes`；
    /// 单条上限由 [`Self::max_inline_bytes`] 把守）。
    pub memory_cache_bytes: u64,
    /// L2 磁盘缓存总量预算（《04》§6.2/§8.4 `diskCacheBytes`，仅 http(s)）。
    pub disk_cache_bytes: u64,
    /// 外部请求重定向跳数上限（《04》§8.2 `redirectLimit`，逐跳复校验）。
    pub redirect_limit: usize,
    /// 连接超时毫秒（《04》§8.2 `connectTimeoutMs`）。
    pub connect_timeout_ms: u64,
    /// 首字节超时毫秒（《04》§8.2 `firstByteTimeoutMs`）。
    pub first_byte_timeout_ms: u64,
    /// 空闲超时毫秒（《04》§8.2 `idleTimeoutMs`）。
    pub idle_timeout_ms: u64,
    /// 外部资源默认 TTL 秒（《04》§6.3 `externalTtlSeconds`；响应头有效期优先）。
    pub external_ttl_seconds: u64,
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
            metadata_cache_entries: DEFAULT_METADATA_CACHE_ENTRIES,
            memory_cache_bytes: DEFAULT_MEMORY_CACHE_BYTES,
            disk_cache_bytes: DEFAULT_DISK_CACHE_BYTES,
            redirect_limit: DEFAULT_REDIRECT_LIMIT,
            connect_timeout_ms: DEFAULT_CONNECT_TIMEOUT_MS,
            first_byte_timeout_ms: DEFAULT_FIRST_BYTE_TIMEOUT_MS,
            idle_timeout_ms: DEFAULT_IDLE_TIMEOUT_MS,
            external_ttl_seconds: DEFAULT_EXTERNAL_TTL_SECONDS,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_defaults_match_registered_config() {
        // 与《04》§12 默认配置表逐字一致（含段三缓存/网络 8 键合流）。
        let limits = ResourceLimits::default();
        assert_eq!(limits.max_inline_bytes, 8 * 1024 * 1024);
        assert_eq!(limits.max_resource_bytes, 2 * 1024 * 1024 * 1024);
        assert_eq!(limits.chunk_bytes, 256 * 1024);
        assert_eq!(limits.max_handles_per_plugin, 64);
        assert_eq!(limits.max_handles_total, 4096);
        assert_eq!(limits.metadata_cache_entries, 4096);
        assert_eq!(limits.memory_cache_bytes, 64 * 1024 * 1024);
        assert_eq!(limits.disk_cache_bytes, 512 * 1024 * 1024);
        assert_eq!(limits.redirect_limit, 5);
        assert_eq!(limits.connect_timeout_ms, 10_000);
        assert_eq!(limits.first_byte_timeout_ms, 30_000);
        assert_eq!(limits.idle_timeout_ms, 30_000);
        assert_eq!(limits.external_ttl_seconds, 300);
    }

    #[test]
    fn test_limits_serialization_camel_case() {
        let json = serde_json::to_value(ResourceLimits::default()).expect("限额必须可序列化");
        assert!(json.get("maxInlineBytes").is_some());
        assert!(json.get("maxHandlesPerPlugin").is_some());
        assert!(json.get("metadataCacheEntries").is_some());
        assert!(json.get("memoryCacheBytes").is_some());
        assert!(json.get("diskCacheBytes").is_some());
        assert!(json.get("redirectLimit").is_some());
        assert!(json.get("connectTimeoutMs").is_some());
        assert!(json.get("firstByteTimeoutMs").is_some());
        assert!(json.get("idleTimeoutMs").is_some());
        assert!(json.get("externalTtlSeconds").is_some());
    }
}
