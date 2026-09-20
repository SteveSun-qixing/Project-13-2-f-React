//! 双模式数据源统一抽象（《06-文档解析器设计》§四）。
//!
//! - [`DocumentSource`]：目录态与压缩态共同实现的成员读取 trait；
//! - [`PackagePath`]：包内路径；
//! - [`MemberMeta`] / [`MemberMethod`]：阶段 2 索引行（§3.3）；
//! - [`ByteStream`] / [`Mapping`]：零拷贝字节流（§4.1）；
//! - [`SourceFingerprint`] / [`MemberFingerprint`]：修订与增量重解析的
//!   成员指纹（§5.4）。

pub mod archive;
pub mod directory;
pub(crate) mod inflate;
mod path;

use std::time::{SystemTime, UNIX_EPOCH};

pub use path::PackagePath;

use crate::error::{DocumentError, Fatal};

/// 数据源形态。
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum SourceKind {
    /// 目录态（开发态与编辑态）。
    Directory,
    /// 压缩态（ZIP 归档）。
    Archive,
}

/// ZIP 成员压缩方法（目录态恒为 Store 语义）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemberMethod {
    /// 不压缩。
    Store,
    /// Deflate（正式发布不产生；读取端限额内接受）。
    Deflate,
}

/// 阶段 2 索引行：包内路径 → 成员元数据（设计稿 §3.3）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemberMeta {
    /// 规范化包内路径。
    pub path: PackagePath,
    /// 解压后字节数。
    pub size: u64,
    /// 修改时间（目录态与压缩态本地时区记录均可能为空）。
    pub modified: Option<SystemTime>,
    /// 压缩态提供的 CRC32；目录态为空。
    pub crc32: Option<u32>,
    /// 压缩方法。
    pub method: MemberMethod,
}

/// 成员指纹：目录态 = 尺寸 + 修改时间；压缩态 = 尺寸 + CRC32 + 修改时间
/// （设计稿 §5.4）。可比较，供增量重解析判定。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize)]
pub struct MemberFingerprint {
    /// 解压后字节数。
    pub size: u64,
    /// 修改时间（Unix 毫秒）；无时间信息时为空。
    pub modified_millis: Option<i64>,
    /// 压缩态 CRC32。
    pub crc32: Option<u32>,
}

impl MemberFingerprint {
    /// 由索引行构造成员指纹。
    #[must_use]
    pub fn of(member: &MemberMeta) -> Self {
        Self {
            size: member.size,
            modified_millis: member.modified.map(system_time_to_millis),
            crc32: member.crc32,
        }
    }
}

/// 数据源指纹：形态 + 全部成员指纹（按路径升序）。
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct SourceFingerprint {
    /// 数据源形态。
    pub kind: SourceKind,
    /// 按包内路径升序排列的成员指纹表。
    pub members: Vec<(PackagePath, MemberFingerprint)>,
}

/// 统一毫秒换算（超出 i64 范围的时间戳归一为 0，保证指纹可比较）。
fn system_time_to_millis(time: SystemTime) -> i64 {
    match time.duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis().min(i64::MAX as u128) as i64,
        Err(error) => -i64::try_from(error.duration().as_millis().min(i64::MAX as u128)).unwrap_or(0),
    }
}

/// 归档只读字节映射（本实现的「映射」为进程内字节缓冲，纯 Rust、无
/// `unsafe`；对外 API 与设计稿 §4.1 的 `ByteStream::Mapped` 形状一致）。
#[derive(Debug)]
pub struct Mapping {
    data: Vec<u8>,
}

impl Mapping {
    /// 以整份归档字节构造映射。
    pub(crate) fn new(data: Vec<u8>) -> Self {
        Self { data }
    }

    /// 映射总长。
    #[must_use]
    pub fn len(&self) -> u64 {
        self.data.len() as u64
    }

    /// 是否为空映射。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// 取映射内字节切片；越界返回 `None`。
    #[must_use]
    pub fn slice(&self, offset: u64, length: u64) -> Option<&[u8]> {
        let start = usize::try_from(offset).ok()?;
        let end = start.checked_add(usize::try_from(length).ok()?)?;
        self.data.get(start..end)
    }
}

/// 字节流（设计稿 §4.1）：压缩态 Store 成员返回映射切片，目录态资源与
/// 需要解码的成员返回流式读取。
pub enum ByteStream {
    /// 只读映射切片。
    Mapped {
        /// 归档映射。
        source: std::sync::Arc<Mapping>,
        /// 切片起点。
        offset: u64,
        /// 切片长度。
        length: u64,
    },
    /// 流式解码字节。
    Decoded(Box<dyn std::io::Read + Send>),
}

/// `Box<dyn Read + Send>` 本身不实现 `Debug`，因此手写枚举实现，
/// 只暴露可读出的定位信息（映射切片给出区间，解码流给出不透明标记）。
impl std::fmt::Debug for ByteStream {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Mapped { offset, length, .. } => formatter
                .debug_struct("Mapped")
                .field("offset", offset)
                .field("length", length)
                .finish_non_exhaustive(),
            Self::Decoded(_) => formatter.write_str("Decoded(<opaque stream>)"),
        }
    }
}

impl ByteStream {
    /// 读取全部字节到内存。
    pub fn read_to_vec(&mut self) -> Result<Vec<u8>, DocumentError> {
        match self {
            Self::Mapped { source, offset, length } => {
                let bytes = source.slice(*offset, *length).ok_or_else(|| DocumentError::Io {
                    message: "映射切片越界，归档可能已损坏".to_owned(),
                })?;
                Ok(bytes.to_vec())
            }
            Self::Decoded(reader) => {
                let mut buffer = Vec::new();
                std::io::Read::read_to_end(reader.as_mut(), &mut buffer).map_err(|io_error| {
                    DocumentError::Io { message: format!("读取资源字节失败：{io_error}") }
                })?;
                Ok(buffer)
            }
        }
    }

    /// 已知长度（目录态流式读取为 `None`）。
    #[must_use]
    pub fn known_length(&self) -> Option<u64> {
        match self {
            Self::Mapped { length, .. } => Some(*length),
            Self::Decoded(_) => None,
        }
    }
}

/// 包字节提供者（设计稿 §4.1）；两种实现必须产生相同的索引内容与读取
/// 结果，模式差异只体现在 `ByteStream` 变体。
pub trait DocumentSource: Send + Sync {
    /// 数据源形态。
    fn kind(&self) -> SourceKind;

    /// 数据源指纹（阶段常数时间，不读资源正文）。
    fn fingerprint(&self) -> SourceFingerprint;

    /// 按包内路径查成员元数据。
    fn member(&self, path: &PackagePath) -> Option<MemberMeta>;

    /// 列出指定目录前缀下的全部成员路径（升序）；`prefix` 为目录成员
    /// 路径（匹配 `prefix/` 下的所有成员）。
    fn list(&self, prefix: &PackagePath) -> Fatal<Vec<PackagePath>>;

    /// 读取成员字节（YAML 等小文本成员）。
    fn read(&self, path: &PackagePath) -> Result<Vec<u8>, DocumentError>;

    /// 打开成员字节流（资源成员；Store 返回映射切片）。
    fn open_stream(&self, path: &PackagePath) -> Result<ByteStream, DocumentError>;

    /// 校验成员 CRC32（设计稿 §4.3：`verify_hashes` 开启或 `validate` 时
    /// 执行；普通解析只信任中央目录并校验尺寸）。目录态不提供 CRC32
    /// （§4.2），默认实现恒通过；压缩态覆盖为真实校验。
    fn verify_member_crc(&self, _path: &PackagePath) -> Fatal<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_member_fingerprint_derivation() {
        let member = MemberMeta {
            path: PackagePath::new("a.yaml").expect("合法"),
            size: 10,
            modified: None,
            crc32: Some(42),
            method: MemberMethod::Store,
        };
        let fingerprint = MemberFingerprint::of(&member);
        assert_eq!(fingerprint.size, 10);
        assert_eq!(fingerprint.crc32, Some(42));
        assert_eq!(fingerprint.modified_millis, None);
    }

    #[test]
    fn test_mapping_slice_bounds() {
        let mapping = Mapping::new(b"hello world".to_vec());
        assert_eq!(mapping.len(), 11);
        assert!(!mapping.is_empty());
        assert_eq!(mapping.slice(0, 5), Some(&b"hello"[..]));
        assert_eq!(mapping.slice(6, 5), Some(&b"world"[..]));
        assert_eq!(mapping.slice(6, 6), None, "越界切片必须返回 None");
        assert_eq!(mapping.slice(100, 1), None);
    }

    #[test]
    fn test_byte_stream_mapped_read_and_length() {
        let source = std::sync::Arc::new(Mapping::new(b"abcdef".to_vec()));
        let mut stream = ByteStream::Mapped { source, offset: 2, length: 3 };
        assert_eq!(stream.known_length(), Some(3));
        assert_eq!(stream.read_to_vec().expect("读取成功"), b"cde");
    }

    #[test]
    fn test_byte_stream_decoded_read() {
        let mut stream = ByteStream::Decoded(Box::new(std::io::Cursor::new(b"xyz".to_vec())));
        assert_eq!(stream.known_length(), None);
        assert_eq!(stream.read_to_vec().expect("读取成功"), b"xyz");
    }

    #[test]
    fn test_byte_stream_mapped_out_of_range_is_io() {
        let source = std::sync::Arc::new(Mapping::new(b"abc".to_vec()));
        let mut stream = ByteStream::Mapped { source, offset: 0, length: 99 };
        let error = stream.read_to_vec().expect_err("越界必须失败");
        assert_eq!(error.code(), crate::error::DOCUMENT_IO);
    }

    #[test]
    fn test_system_time_millis_roundtrip() {
        assert_eq!(system_time_to_millis(SystemTime::UNIX_EPOCH), 0);
        let later = SystemTime::UNIX_EPOCH + std::time::Duration::from_millis(1234);
        assert_eq!(system_time_to_millis(later), 1234);
        let earlier = SystemTime::UNIX_EPOCH - std::time::Duration::from_millis(5);
        assert_eq!(system_time_to_millis(earlier), -5);
    }
}
