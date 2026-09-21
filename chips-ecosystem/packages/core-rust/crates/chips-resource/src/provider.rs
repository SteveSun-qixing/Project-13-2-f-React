//! 文件系统抽象层在册抽象：地址模型与 `ResourceProvider` 契约
//! （《04-资源管理设计》§3.1、§3.2）。
//!
//! 段一只交付 trait 与数据类型本身（在册抽象），不挂载任何具体 Provider
//! （目录 / ZIP Store / 内存 / HTTP 属段二）。状态机测试以 `#[cfg(test)]`
//! 测试替身驱动；集成测试经公开 trait 自带替身。

use async_trait::async_trait;
use chips_core::ChipsError;
use serde::Serialize;
use std::time::SystemTime;

use crate::path_guard::VirtualPath;
use crate::scope::ScopeId;

/// 资源地址（《04》§3.1）：作用域 + 虚拟路径 + 来源。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceAddress {
    /// 作用域 ID。
    pub scope: ScopeId,
    /// 作用域内虚拟路径。
    pub path: VirtualPath,
    /// 规范化后的完整规范 URI 文本。
    pub uri: String,
}

/// 字节范围（《04》§3.2）：`length` 为 `None` 表示读到结尾。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ByteRange {
    /// 起始偏移。
    pub offset: u64,
    /// 长度；`None` 表示到结尾。
    pub length: Option<u64>,
}

/// 版本戳（《04》§1.3：`mtime + size`、归档条目 CRC、HTTP `ETag` 的统一字符串形态）。
pub type VersionStamp = String;

/// 资源元数据（《04》§3.2 与《06》§6.1 `IResourceMetadata` 的并集形状：
/// `uri`、`scope` 由管理器在打开时定值，其余由 Provider 给出）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceMetadata {
    /// 规范 URI。
    pub uri: String,
    /// 字节大小。
    pub size: u64,
    /// MIME 类型（《04》§3.4 判定规则，段二 Provider 面）。
    pub mime_type: String,
    /// 版本戳。
    pub version: VersionStamp,
    /// 作用域种类。
    pub scope: crate::scope::ScopeKind,
}

/// 目录条目（《04》§3.2）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    /// 条目名。
    pub name: String,
    /// 是否目录。
    pub is_directory: bool,
    /// 字节大小。
    pub size: u64,
    /// 修改时间（Unix 秒；不可得为 0）。
    pub modified_unix_seconds: i64,
}

/// 可修改元数据（《04》§3.2 `FileMetadata`）。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct FileMetadata {
    /// 修改时间。
    pub modified: Option<SystemTime>,
    /// 创建时间。
    pub created: Option<SystemTime>,
    /// POSIX 权限位。
    pub permissions: Option<u32>,
}

/// 流式读取游标抽象（《04》§3.2 `open_stream` 返回物的在册最小承载：
/// 文档未定义其形状，见 README 漂移登记第 3 条；`None` 表示已到结尾，
/// 与《03》§7.1 `read_chunk` 语义一致）。
#[async_trait]
pub trait ResourceStream: Send {
    /// 拉取下一块，至多 `max_bytes`；`None` 表示结尾。
    async fn next_chunk(&mut self, max_bytes: usize) -> Result<Option<Vec<u8>>, ChipsError>;
}

/// 来源提供者契约（《04》§3.2 全量在册签名）。
#[async_trait]
pub trait ResourceProvider: Send + Sync {
    /// Provider 标识（注册表键）。
    fn id(&self) -> &'static str;
    /// 是否支持流式读取。
    fn supports_streaming(&self) -> bool;
    /// 是否支持写入族操作。
    fn supports_write(&self) -> bool;

    /// 元数据。
    async fn stat(&self, address: &ResourceAddress) -> Result<ResourceMetadata, ChipsError>;
    /// 范围读。
    async fn read_range(
        &self,
        address: &ResourceAddress,
        range: ByteRange,
    ) -> Result<Vec<u8>, ChipsError>;
    /// 打开流式游标。
    async fn open_stream(
        &self,
        address: &ResourceAddress,
    ) -> Result<Box<dyn ResourceStream>, ChipsError>;

    /// 目录列举。
    async fn list_directory(
        &self,
        address: &ResourceAddress,
    ) -> Result<Vec<DirectoryEntry>, ChipsError>;

    /// 写入。
    async fn write(
        &self,
        address: &ResourceAddress,
        data: &[u8],
    ) -> Result<ResourceMetadata, ChipsError>;
    /// 删除。
    async fn delete(&self, address: &ResourceAddress) -> Result<(), ChipsError>;
    /// 重命名。
    async fn rename(&self, from: &ResourceAddress, to: &ResourceAddress) -> Result<(), ChipsError>;
    /// 复制。
    async fn copy(&self, from: &ResourceAddress, to: &ResourceAddress) -> Result<(), ChipsError>;
    /// 创建目录。
    async fn create_directory(&self, address: &ResourceAddress) -> Result<(), ChipsError>;
    /// 修改元数据。
    async fn set_metadata(
        &self,
        address: &ResourceAddress,
        metadata: FileMetadata,
    ) -> Result<(), ChipsError>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::path_guard::VirtualPath;
    use crate::scope::ScopeKind;

    #[test]
    fn test_metadata_serialization_matches_ts_shape() {
        // 《06》§6.1 IResourceMetadata 字段面（camelCase）。
        let metadata = ResourceMetadata {
            uri: "chips-resource://card-1/a.png".into(),
            size: 10,
            mime_type: "image/png".into(),
            version: "v1".into(),
            scope: ScopeKind::Document,
        };
        let json = serde_json::to_value(&metadata).expect("元数据必须可序列化");
        assert_eq!(json["mimeType"], "image/png");
        assert_eq!(json["scope"], "document");
        assert_eq!(json["size"], 10);
    }

    #[test]
    fn test_address_carries_validated_path() {
        let path = VirtualPath::from_validated("images/photo.jpg".into());
        let address = ResourceAddress {
            scope: "card-1".into(),
            path,
            uri: "chips-resource://card-1/images/photo.jpg".into(),
        };
        assert_eq!(address.path.as_str(), "images/photo.jpg");
    }
}
