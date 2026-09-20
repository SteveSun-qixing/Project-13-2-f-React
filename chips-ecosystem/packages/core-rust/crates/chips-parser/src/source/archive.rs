//! 压缩态数据源（《06-文档解析器设计》§4.3）：ZIP 中央目录 + Store 成员
//! 零解压读取 + CRC32 校验。
//!
//! 工程约束（《W2 金链路》工单015 裁决）：不引入 `zip` / `memmap2` 第三方
//! crate，按发布侧 Store 无压缩口径手写解析；「映射」为进程内只读字节
//! 缓冲（`#![forbid(unsafe_code)]` 下不做 mmap），对外 `ByteStream::Mapped`
//! 形状与设计稿一致。加密条目、未知压缩方法与损坏的中央目录返回
//! `DOCUMENT_ARCHIVE_INVALID`；Deflate 成员在限额内现场解压读取；ZIP64 归档
//! 只读支持。

use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::error::{DocumentError, Fatal};
use crate::digest::crc32;
use crate::model::ParseLimits;
use crate::source::{
    inflate, ByteStream, DocumentSource, Mapping, MemberFingerprint, MemberMeta, MemberMethod,
    PackagePath, SourceFingerprint, SourceKind,
};

/// ZIP 中央目录条目签名。
const CENTRAL_SIGNATURE: u32 = 0x0201_4b50;
/// ZIP 本地文件头签名。
const LOCAL_SIGNATURE: u32 = 0x0403_4b50;
/// 端到端搜索记录签名（EOCD）。
const EOCD_SIGNATURE: u32 = 0x0605_4b50;
/// ZIP64 中央目录定位记录签名。
const ZIP64_EOCD_LOCATOR_SIGNATURE: u32 = 0x0706_4b50;
/// ZIP64 端到端中央目录记录签名。
const ZIP64_EOCD_SIGNATURE: u32 = 0x0606_4b50;
/// 通用位标志：加密。
const FLAG_ENCRYPTED: u16 = 0x0001;
/// ZIP64 扩展字段标签。
const ZIP64_EXTRA_TAG: u16 = 0x0001;
/// 经典 ZIP 头尺寸：EOCD 固定 22 字节、中央目录条目固定 46 字节、
/// 本地文件头固定 30 字节。
const EOCD_FIXED_SIZE: usize = 22;
const CENTRAL_FIXED_SIZE: usize = 46;
const LOCAL_FIXED_SIZE: usize = 30;
/// EOCD 注释区最大搜索回退量（65 535 字节注释 + 22 字节固定头）。
const EOCD_MAX_BACKSCAN: usize = 0xFFFF + EOCD_FIXED_SIZE;
/// Store 压缩方法编号。
const METHOD_STORE: u16 = 0;
/// Deflate 压缩方法编号（发布侧不产生；读取端在限额内接受并现场解压，
/// 设计稿 §3.3「读取端不得因 Deflate 而拒绝本可正常打开的文档」）。
const METHOD_DEFLATE: u16 = 8;

/// 中央目录条目派生的成员定位信息。
#[derive(Debug, Clone)]
struct ArchivedMember {
    meta: MemberMeta,
    /// 本地文件头偏移。
    header_offset: u64,
    /// 压缩数据长度（Store 口径下等于 `meta.size`）。
    compressed_size: u64,
}

/// 中央目录单条解析产物（§3.3 索引行）。
struct ParsedCentralEntry {
    /// 文件成员的路径与元数据；目录条目（尾部 `/`）为 `None`，只计数不入索引。
    file: Option<(PackagePath, MemberMeta)>,
    /// 本地文件头偏移。
    header_offset: u64,
    /// 压缩数据长度。
    compressed_size: u64,
}

/// 压缩态数据源。
#[derive(Debug)]
pub struct ArchiveSource {
    mapping: Arc<Mapping>,
    index: BTreeMap<PackagePath, ArchivedMember>,
    limits: ParseLimits,
}

impl ArchiveSource {
    /// 读取归档文件、定位 EOCD（含 ZIP64）、解析中央目录并建立索引。
    pub(crate) fn open(path: &Path, limits: &ParseLimits) -> Fatal<Self> {
        let data = std::fs::read(path)
            .map_err(|io_error| DocumentError::Io {
                message: format!("读取归档 {} 失败：{io_error}", path.display()),
            })?;
        Self::from_bytes(data, limits)
    }

    /// 从归档字节构建（测试与内存来源复用同一入口）。
    pub(crate) fn from_bytes(data: Vec<u8>, limits: &ParseLimits) -> Fatal<Self> {
        if data.len() < 4 {
            return Err(DocumentError::ArchiveInvalid {
                message: "归档长度不足以包含签名".to_owned(),
            });
        }
        let mapping = Arc::new(Mapping::new(data));
        let index = Self::build_index(&mapping, limits)?;
        Ok(Self { mapping, index, limits: *limits })
    }

    /// 阶段 1 使用的归档签名检查：普通归档 `PK\x03\x04` 或空归档 `PK\x05\x06`。
    #[must_use]
    pub(crate) fn looks_like_zip(data: &[u8]) -> bool {
        let Ok(prefix) = data.get(..4).ok_or(()).map(read_u32_le) else {
            return false;
        };
        prefix == LOCAL_SIGNATURE || prefix == EOCD_SIGNATURE
    }

    fn build_index(mapping: &Arc<Mapping>, limits: &ParseLimits) -> Fatal<BTreeMap<PackagePath, ArchivedMember>> {
        let file_len = mapping.len();
        let (entry_count, central_offset, central_size) = Self::locate_central_directory(mapping)?;
        let central_end = central_offset
            .checked_add(central_size)
            .filter(|end| *end <= file_len)
            .ok_or_else(|| DocumentError::ArchiveInvalid {
                message: "中央目录超出归档范围".to_owned(),
            })?;
        let central_bytes = mapping
            .slice(central_offset, central_size)
            .ok_or_else(|| DocumentError::ArchiveInvalid {
                message: "无法读取中央目录字节".to_owned(),
            })?;
        if u64::from(entry_count) > limits.max_uncompressed_members_guard() {
            return Err(DocumentError::LimitExceeded {
                limit: "max_uncompressed_bytes",
                actual: format!("成员数 {entry_count} 超出归档防护上限"),
                file: None,
            });
        }
        let mut index = BTreeMap::new();
        let mut cursor = 0usize;
        let mut seen_names: HashMap<String, ()> = HashMap::new();
        let mut parsed_count = 0u32;
        let mut total_uncompressed = 0u64;
        while (cursor as u64) < central_end - central_offset {
            let entry = Self::parse_central_entry(central_bytes, &mut cursor)?;
            parsed_count += 1;
            let Some((package_path, meta)) = entry.file else {
                // 目录条目：仅计数（设计稿 §3.3）。
                continue;
            };
            total_uncompressed = total_uncompressed.checked_add(meta.size).ok_or_else(|| {
                DocumentError::LimitExceeded {
                    limit: "max_uncompressed_bytes",
                    actual: "解压总字节溢出".to_owned(),
                    file: None,
                }
            })?;
            if total_uncompressed > limits.max_uncompressed_bytes {
                return Err(DocumentError::LimitExceeded {
                    limit: "max_uncompressed_bytes",
                    actual: format!("{total_uncompressed} > {}", limits.max_uncompressed_bytes),
                    file: Some(package_path.clone()),
                });
            }
            if meta.size > limits.max_single_member_bytes() {
                return Err(DocumentError::LimitExceeded {
                    limit: "max_single_member_bytes",
                    actual: format!("{} > {}", meta.size, limits.max_single_member_bytes()),
                    file: Some(package_path.clone()),
                });
            }
            if entry.compressed_size > 0
                && meta.size > entry.compressed_size.saturating_mul(limits.max_compression_ratio.max(1))
            {
                return Err(DocumentError::LimitExceeded {
                    limit: "max_compression_ratio",
                    actual: format!("{} / {} 超出比率 {}", meta.size, entry.compressed_size, limits.max_compression_ratio),
                    file: Some(package_path.clone()),
                });
            }
            if seen_names.insert(package_path.to_string(), ()).is_some() {
                return Err(DocumentError::ArchiveInvalid {
                    message: format!("归一后重复路径：{package_path}"),
                });
            }
            index.insert(package_path, ArchivedMember { meta, header_offset: entry.header_offset, compressed_size: entry.compressed_size });
        }
        if parsed_count != entry_count {
            return Err(DocumentError::ArchiveInvalid {
                message: format!("中央目录条目数 {parsed_count} 与 EOCD 记录 {entry_count} 不一致"),
            });
        }
        Ok(index)
    }

    /// 定位中央目录：经典 EOCD 反向搜索 + ZIP64 覆盖。
    fn locate_central_directory(
        mapping: &Arc<Mapping>,
    ) -> Fatal<(u32, u64, u64)> {
        let file_len = mapping.len();
        let usize_len = usize::try_from(file_len).map_err(|_| DocumentError::ArchiveInvalid {
            message: "归档长度超出地址空间".to_owned(),
        })?;
        let window_start = usize_len.saturating_sub(EOCD_MAX_BACKSCAN);
        let tail = mapping.slice(window_start as u64, (usize_len - window_start) as u64).ok_or_else(|| {
            DocumentError::ArchiveInvalid { message: "无法读取归档尾部".to_owned() }
        })?;
        // EOCD 签名从尾部向前找。
        let ecdcd_position = tail
            .windows(4)
            .rfind(|window| read_u32_le(window) == EOCD_SIGNATURE)
            .map(|window| window.as_ptr() as usize - tail.as_ptr() as usize)
            .ok_or_else(|| DocumentError::ArchiveInvalid {
                message: "未找到端到端中央目录记录（EOCD）".to_owned(),
            })?;
        let eocd = &tail[ecdcd_position..];
        if eocd.len() < EOCD_FIXED_SIZE {
            return Err(DocumentError::ArchiveInvalid { message: "EOCD 记录不完整".to_owned() });
        }
        let mut entry_count = u32::from(read_u16_le(&eocd[10..]));
        let mut central_size = u64::from(read_u32_le(&eocd[12..]));
        let mut central_offset = u64::from(read_u32_le(&eocd[16..]));
        // ZIP64：任一字段为哨兵值时读取 ZIP64 EOCD。
        if entry_count == u32::from(u16::MAX) || central_size == u64::from(u32::MAX) || central_offset == u64::from(u32::MAX) {
            let locator_start = ecdcd_position.saturating_sub(20);
            let locator = &tail[locator_start..ecdcd_position];
            if locator.len() != 20 || read_u32_le(locator) != ZIP64_EOCD_LOCATOR_SIGNATURE {
                return Err(DocumentError::ArchiveInvalid {
                    message: "ZIP64 哨兵字段缺少定位记录".to_owned(),
                });
            }
            let zip64_offset = read_u64_le(&locator[8..16]);
            let record = mapping
                .slice(zip64_offset, 56)
                .ok_or_else(|| DocumentError::ArchiveInvalid {
                    message: "无法读取 ZIP64 端到端记录".to_owned(),
                })?;
            if read_u32_le(record) != ZIP64_EOCD_SIGNATURE {
                return Err(DocumentError::ArchiveInvalid {
                    message: "ZIP64 端到端记录签名非法".to_owned(),
                });
            }
            entry_count = u32::try_from(read_u64_le(&record[32..40])).map_err(|_| {
                DocumentError::ArchiveInvalid { message: "ZIP64 成员数超出处理上限".to_owned() }
            })?;
            central_size = read_u64_le(&record[40..48]);
            central_offset = read_u64_le(&record[48..56]);
        }
        Ok((entry_count, central_offset, central_size))
    }

    fn parse_central_entry(
        central_bytes: &[u8],
        cursor: &mut usize,
    ) -> Fatal<ParsedCentralEntry> {
        let entry = central_bytes
            .get(*cursor..)
            .and_then(|rest| rest.get(..CENTRAL_FIXED_SIZE).map(|head| (head, rest)))
            .ok_or_else(|| DocumentError::ArchiveInvalid {
                message: "中央目录条目越界".to_owned(),
            })?;
        let (head, rest) = entry;
        if read_u32_le(head) != CENTRAL_SIGNATURE {
            return Err(DocumentError::ArchiveInvalid {
                message: "中央目录条目签名非法".to_owned(),
            });
        }
        let flags = read_u16_le(&head[8..]);
        let method = read_u16_le(&head[10..]);
        let dos_time = read_u16_le(&head[12..]);
        let dos_date = read_u16_le(&head[14..]);
        let stored_crc = read_u32_le(&head[16..]);
        let mut compressed_size = u64::from(read_u32_le(&head[20..]));
        let mut uncompressed_size = u64::from(read_u32_le(&head[24..]));
        let name_len = usize::from(read_u16_le(&head[28..]));
        let extra_len = usize::from(read_u16_le(&head[30..]));
        let comment_len = usize::from(read_u16_le(&head[32..]));
        let mut header_offset = u64::from(read_u32_le(&head[42..]));
        if flags & FLAG_ENCRYPTED != 0 {
            return Err(DocumentError::ArchiveInvalid {
                message: "加密条目不受支持".to_owned(),
            });
        }
        let name_end = CENTRAL_FIXED_SIZE + name_len;
        let extra_end = name_end + extra_len;
        let entry_end = extra_end + comment_len;
        let raw_name = rest.get(CENTRAL_FIXED_SIZE..name_end).ok_or_else(|| {
            DocumentError::ArchiveInvalid { message: "条目文件名越界".to_owned() }
        })?;
        let name = std::str::from_utf8(raw_name).map_err(|_| DocumentError::ArchiveInvalid {
            message: "非 UTF-8 文件名".to_owned(),
        })?;
        // ZIP64 扩展字段：按「未压缩、已压缩、相对偏移」顺序补足 u64。
        let extra = rest.get(name_end..extra_end).unwrap_or(&[]);
        Self::apply_zip64_extra(extra, &mut uncompressed_size, &mut compressed_size, &mut header_offset)?;
        match method {
            METHOD_STORE | METHOD_DEFLATE => {}
            other => {
                return Err(DocumentError::ArchiveInvalid {
                    message: format!("压缩方法编号 {other} 不被接受：只允许 Store 与 Deflate"),
                });
            }
        }
        // 目录条目（尾部 `/`）不纳入索引，但计入中央目录条目数以核对 EOCD。
        if name.ends_with('/') {
            *cursor = entry_end;
            return Ok(ParsedCentralEntry {
                file: None,
                header_offset,
                compressed_size,
            });
        }
        if method == METHOD_STORE && uncompressed_size != compressed_size {
            return Err(DocumentError::ArchiveInvalid {
                message: format!("Store 条目尺寸不一致：{name}"),
            });
        }
        let package_path = normalize_archive_name(name)?;
        let modified = dos_date_time_to_system(dos_date, dos_time);
        *cursor = entry_end;
        Ok(ParsedCentralEntry {
            file: Some((
                package_path.clone(),
                MemberMeta {
                    path: package_path,
                    size: uncompressed_size,
                    modified,
                    crc32: Some(stored_crc),
                    method: match method {
                        METHOD_STORE => MemberMethod::Store,
                        _ => MemberMethod::Deflate,
                    },
                },
            )),
            header_offset,
            compressed_size,
        })
    }

    fn apply_zip64_extra(
        extra: &[u8],
        uncompressed_size: &mut u64,
        compressed_size: &mut u64,
        header_offset: &mut u64,
    ) -> Fatal<()> {
        let mut position = 0usize;
        while position + 4 <= extra.len() {
            let tag = read_u16_le(&extra[position..]);
            let size = usize::from(read_u16_le(&extra[position + 2..]));
            let body_start = position + 4;
            let body_end = body_start.checked_add(size).ok_or_else(|| DocumentError::ArchiveInvalid {
                message: "扩展字段长度溢出".to_owned(),
            })?;
            let body = extra.get(body_start..body_end).ok_or_else(|| DocumentError::ArchiveInvalid {
                message: "扩展字段越界".to_owned(),
            })?;
            if tag == ZIP64_EXTRA_TAG {
                let mut field = 0usize;
                for slot in [&mut *uncompressed_size, &mut *compressed_size, &mut *header_offset] {
                    if *slot == u64::from(u32::MAX) {
                        let next = field + 8;
                        let value = body.get(field..next).map(|bytes| read_u64_le(bytes)).ok_or_else(|| {
                            DocumentError::ArchiveInvalid {
                                message: "ZIP64 扩展字段缺少 64 位值".to_owned(),
                            }
                        })?;
                        *slot = value;
                        field = next;
                    }
                }
            }
            position = body_end;
        }
        Ok(())
    }

    /// 校验本地文件头并返回数据区绝对偏移。
    fn data_start(&self, member: &ArchivedMember, path: &PackagePath) -> Fatal<u64> {
        let head = self
            .mapping
            .slice(member.header_offset, LOCAL_FIXED_SIZE as u64)
            .ok_or_else(|| DocumentError::ArchiveInvalid {
                message: format!("本地文件头越界：{path}"),
            })?;
        if read_u32_le(head) != LOCAL_SIGNATURE {
            return Err(DocumentError::ArchiveInvalid {
                message: format!("本地文件头签名非法：{path}"),
            });
        }
        let name_len = usize::from(read_u16_le(&head[26..]));
        let extra_len = usize::from(read_u16_le(&head[28..]));
        let whole = self
            .mapping
            .slice(member.header_offset, (LOCAL_FIXED_SIZE + name_len) as u64)
            .ok_or_else(|| DocumentError::ArchiveInvalid {
                message: format!("本地文件名越界：{path}"),
            })?;
        let stored_name = std::str::from_utf8(&whole[LOCAL_FIXED_SIZE..]).map_err(|_| {
            DocumentError::ArchiveInvalid { message: format!("本地文件名非 UTF-8：{path}") }
        })?;
        if normalize_archive_name(stored_name)? != *path {
            return Err(DocumentError::ArchiveInvalid {
                message: format!("本地文件名与中央目录不一致：{path}"),
            });
        }
        let data_start = member
            .header_offset
            .checked_add((LOCAL_FIXED_SIZE + name_len + extra_len) as u64)
            .ok_or_else(|| DocumentError::ArchiveInvalid {
                message: format!("本地文件头数据偏移溢出：{path}"),
            })?;
        self.mapping
            .slice(data_start, member.compressed_size)
            .ok_or_else(|| DocumentError::ArchiveInvalid {
                message: format!("成员数据区越出归档：{path}"),
            })?;
        Ok(data_start)
    }

    /// 取成员数据区的原始存储字节（Store 为解压字节，Deflate 为压缩字节）。
    fn stored_bytes(&self, member: &ArchivedMember, path: &PackagePath) -> Fatal<&[u8]> {
        let data_start = self.data_start(member, path)?;
        self.mapping
            .slice(data_start, member.compressed_size)
            .ok_or_else(|| DocumentError::ArchiveInvalid {
                message: format!("成员数据区越界：{path}"),
            })
    }

    /// 读取成员的解压字节：Store 直接切片，Deflate 现场解压。
    fn decompressed(&self, member: &ArchivedMember, path: &PackagePath) -> Fatal<Vec<u8>> {
        let stored = self.stored_bytes(member, path)?;
        match member.meta.method {
            MemberMethod::Store => Ok(stored.to_vec()),
            MemberMethod::Deflate => inflate::inflate(
                stored,
                member.meta.size,
                self.limits.max_single_member_bytes(),
            ),
        }
    }

    fn archived(&self, path: &PackagePath) -> Fatal<&ArchivedMember> {
        self.index.get(path).ok_or_else(|| DocumentError::NotFound {
            path: path.to_string(),
        })
    }

    /// 校验单个成员的 CRC32（`verify_hashes` 或 `validate` 路径）。
    pub(crate) fn verify_member_crc(&self, path: &PackagePath) -> Fatal<()> {
        let member = self.archived(path)?;
        let bytes = self.decompressed(member, path)?;
        let expected = member.meta.crc32.ok_or_else(|| DocumentError::ArchiveInvalid {
            message: format!("成员缺少 CRC32：{path}"),
        })?;
        if crc32(&bytes) != expected {
            return Err(DocumentError::ArchiveInvalid {
                message: format!("CRC32 校验失败：{path}"),
            });
        }
        Ok(())
    }
}

/// 归档成员名归一为包内路径：统一 `/` 分隔并做安全性校验。
fn normalize_archive_name(name: &str) -> Fatal<PackagePath> {
    if name.contains('\\') {
        return Err(DocumentError::PathUnsafe { path: name.to_owned() });
    }
    PackagePath::new(name)
}

/// 读取小端 u16。
fn read_u16_le(bytes: &[u8]) -> u16 {
    u16::from_le_bytes([bytes[0], bytes[1]])
}

/// 读取小端 u32。
fn read_u32_le(bytes: &[u8]) -> u32 {
    u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
}

/// 读取小端 u64。
fn read_u64_le(bytes: &[u8]) -> u64 {
    let mut buffer = [0u8; 8];
    buffer.copy_from_slice(&bytes[..8]);
    u64::from_le_bytes(buffer)
}

/// MS-DOS 日期时间 → `SystemTime`（1980 起算；非法值归一为 None）。
fn dos_date_time_to_system(date: u16, time: u16) -> Option<SystemTime> {
    let year = u32::from(date >> 9) + 1980;
    let month = u32::from((date >> 5) & 0x0F);
    let day = u32::from(date & 0x1F);
    let hour = u32::from(time >> 11);
    let minute = u32::from((time >> 5) & 0x3F);
    let second = u32::from((time & 0x1F) * 2);
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) || hour > 23 || minute > 59 || second > 59 {
        return None;
    }
    // 以 1980-01-01 为纪元锚点换算天数（闰年按格里高利历）。
    let days = days_between_1970_to_1980() + days_from_1980(year, month, day);
    UNIX_EPOCH.checked_add(Duration::from_secs(u64::from(days) * 86_400 + u64::from(hour * 3600 + minute * 60 + second)))
}

/// 1970-01-01 至 1980-01-01 的天数。
fn days_between_1970_to_1980() -> u32 {
    3652
}

/// 1980-01-01 起至给定日期的天数。
fn days_from_1980(year: u32, month: u32, day: u32) -> u32 {
    const MONTH_DAYS: [u32; 12] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut days = 0u32;
    for candidate_year in 1980..year {
        days += if is_leap(candidate_year) { 366 } else { 365 };
    }
    for candidate_month in 1..month {
        days += MONTH_DAYS[usize::try_from(candidate_month - 1).unwrap_or(0)];
        if candidate_month == 2 && is_leap(year) {
            days += 1;
        }
    }
    days + day - 1
}

/// 格里高利闰年判定。
fn is_leap(year: u32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

impl DocumentSource for ArchiveSource {
    fn kind(&self) -> SourceKind {
        SourceKind::Archive
    }

    fn fingerprint(&self) -> SourceFingerprint {
        SourceFingerprint {
            kind: SourceKind::Archive,
            members: self
                .index
                .iter()
                .map(|(path, member)| (path.clone(), MemberFingerprint::of(&member.meta)))
                .collect(),
        }
    }

    fn member(&self, path: &PackagePath) -> Option<MemberMeta> {
        self.index.get(path).map(|member| member.meta.clone())
    }

    fn list(&self, prefix: &PackagePath) -> Fatal<Vec<PackagePath>> {
        let needle = format!("{prefix}/");
        Ok(self.index.keys().filter(|path| path.as_str().starts_with(&needle)).cloned().collect())
    }

    fn read(&self, path: &PackagePath) -> Result<Vec<u8>, DocumentError> {
        let member = self.archived(path)?;
        self.decompressed(member, path)
    }

    fn open_stream(&self, path: &PackagePath) -> Result<ByteStream, DocumentError> {
        let member = self.archived(path)?;
        match member.meta.method {
            // 压缩态 Store 成员直接返回映射切片（零解压、零拷贝语义）。
            MemberMethod::Store => {
                let data_start = self.data_start(member, path)?;
                Ok(ByteStream::Mapped {
                    source: Arc::clone(&self.mapping),
                    offset: data_start,
                    length: member.meta.size,
                })
            }
            // Deflate 成员在限额内现场解压，以内存游标呈现为解码流。
            MemberMethod::Deflate => {
                let bytes = self.decompressed(member, path)?;
                Ok(ByteStream::Decoded(Box::new(std::io::Cursor::new(bytes))))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::{
        DOCUMENT_ARCHIVE_INVALID, DOCUMENT_LIMIT_EXCEEDED, DOCUMENT_PATH_UNSAFE,
    };

    /// 测试归档条目描述。
    struct TestEntry<'a> {
        /// 成员名（目录条目以 `/` 结尾）。
        name: &'a str,
        /// 解压后内容（CRC32 与解压尺寸依据）。
        data: &'a [u8],
        /// 数据区实际字节（Deflate 为压缩字节）。
        stored: &'a [u8],
        /// 压缩方法编号。
        method: u16,
    }

    impl<'a> TestEntry<'a> {
        /// Store 条目。
        fn store(name: &'a str, data: &'a [u8]) -> Self {
            Self { name, data, stored: data, method: METHOD_STORE }
        }

        /// Deflate 条目：`stored` 为压缩字节。
        fn deflate(name: &'a str, data: &'a [u8], stored: &'a [u8]) -> Self {
            Self { name, data, stored, method: METHOD_DEFLATE }
        }

        /// 目录条目（零尺寸、尾部 `/`）。
        fn directory(name: &'a str) -> Self {
            Self { name, data: &[], stored: &[], method: METHOD_STORE }
        }
    }

    /// 构造单个条目：返回 (本地头 + 数据区, 中央目录条目)。
    fn build_pair(entry: &TestEntry<'_>, offset: u32) -> (Vec<u8>, Vec<u8>) {
        let name_bytes = entry.name.as_bytes();
        let checksum = crc32(entry.data);
        let mut local = Vec::new();
        local.extend_from_slice(&LOCAL_SIGNATURE.to_le_bytes());
        local.extend_from_slice(&20u16.to_le_bytes());
        local.extend_from_slice(&0x0800u16.to_le_bytes());
        local.extend_from_slice(&entry.method.to_le_bytes());
        local.extend_from_slice(&0u16.to_le_bytes());
        local.extend_from_slice(&0x0021u16.to_le_bytes());
        local.extend_from_slice(&checksum.to_le_bytes());
        local.extend_from_slice(&(entry.stored.len() as u32).to_le_bytes());
        local.extend_from_slice(&(entry.data.len() as u32).to_le_bytes());
        local.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        local.extend_from_slice(&0u16.to_le_bytes());
        local.extend_from_slice(name_bytes);
        local.extend_from_slice(entry.stored);
        let mut central = Vec::new();
        central.extend_from_slice(&CENTRAL_SIGNATURE.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&0x0800u16.to_le_bytes());
        central.extend_from_slice(&entry.method.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0x0021u16.to_le_bytes());
        central.extend_from_slice(&checksum.to_le_bytes());
        central.extend_from_slice(&(entry.stored.len() as u32).to_le_bytes());
        central.extend_from_slice(&(entry.data.len() as u32).to_le_bytes());
        central.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u32.to_le_bytes());
        central.extend_from_slice(&offset.to_le_bytes());
        central.extend_from_slice(name_bytes);
        (local, central)
    }

    /// 构造一个 Store 条目：返回 (本地头+数据, 中央目录条目)。
    fn build_store_pair(name: &str, data: &[u8], offset: u32) -> (Vec<u8>, Vec<u8>) {
        build_pair(&TestEntry::store(name, data), offset)
    }

    /// 构造完整归档（Store 口径）：members 为 (name, data)。
    fn build_zip(members: &[(&str, &[u8])]) -> Vec<u8> {
        let entries: Vec<TestEntry<'_>> = members
            .iter()
            .copied()
            .map(|(name, data)| TestEntry::store(name, data))
            .collect();
        zip_entries(&entries)
    }

    /// 构造完整归档：条目由 [`TestEntry`] 描述（支持 Deflate 与目录条目）。
    fn zip_entries(entries: &[TestEntry<'_>]) -> Vec<u8> {
        let mut locals = Vec::new();
        let mut centrals = Vec::new();
        let mut offset = 0u32;
        for entry in entries {
            let (local, central) = build_pair(entry, offset);
            offset += local.len() as u32;
            locals.push(local);
            centrals.push(central);
        }
        let mut archive = Vec::new();
        for local in &locals {
            archive.extend_from_slice(local);
        }
        let central_offset = archive.len() as u32;
        for central in &centrals {
            archive.extend_from_slice(central);
        }
        let central_size = archive.len() as u32 - central_offset;
        archive.extend_from_slice(&EOCD_SIGNATURE.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        archive.extend_from_slice(&(entries.len() as u16).to_le_bytes());
        archive.extend_from_slice(&central_size.to_le_bytes());
        archive.extend_from_slice(&central_offset.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive
    }

    /// 构造含目录条目（尾部 `/`）的归档。
    fn build_zip_with_directory() -> Vec<u8> {
        zip_entries(&[
            TestEntry::directory(".card/"),
            TestEntry::store(".card/metadata.yaml", b"ok: true\n"),
            TestEntry::directory("content/"),
        ])
    }

    /// 构造含单个 Deflate 成员的归档：数据区为合法 raw-deflate 非压缩块。
    fn build_zip_deflate(name: &str, plain: &[u8]) -> Vec<u8> {
        let plain_len = u16::try_from(plain.len()).expect("测试数据长度受限");
        let mut compressed = vec![0x01u8];
        compressed.extend_from_slice(&plain_len.to_le_bytes());
        compressed.extend_from_slice(&(!plain_len).to_le_bytes());
        compressed.extend_from_slice(plain);
        zip_entries(&[TestEntry::deflate(name, plain, &compressed)])
    }

    #[test]
    fn test_open_reads_members_in_store_mode() {
        let archive = build_zip(&[
            (".card/metadata.yaml", b"ok: true\n"),
            ("video.mp4", b"\0\x01\x02"),
        ]);
        let source = ArchiveSource::from_bytes(archive, &ParseLimits::default()).expect("打开归档");
        assert_eq!(source.kind(), SourceKind::Archive);
        let path = PackagePath::new("video.mp4").expect("合法路径");
        assert_eq!(source.read(&path).expect("读取成员"), vec![0u8, 1, 2]);
        let meta = source.member(&path).expect("索引存在");
        assert_eq!(meta.method, MemberMethod::Store);
        assert!(meta.crc32.is_some());
        let mut stream = source.open_stream(&path).expect("打开流");
        assert_eq!(stream.known_length(), Some(3));
        assert_eq!(stream.read_to_vec().expect("流内容一致"), vec![0u8, 1, 2]);
    }

    #[test]
    fn test_rejects_encrypted_entry() {
        let archive = build_zip(&[("a.yaml", b"x: 1\n")]);
        // 手工置位加密标志（中央目录 flags 偏移 8）。
        let mut tampered = archive;
        let eocd = find_signature(&tampered, EOCD_SIGNATURE);
        let central_offset = usize::try_from(read_u32_le(&tampered[eocd + 16..])).expect("偏移可读");
        for byte in tampered[central_offset + 8..central_offset + 10].iter_mut() {
            *byte |= FLAG_ENCRYPTED as u8;
        }
        let error = ArchiveSource::from_bytes(tampered, &ParseLimits::default())
            .expect_err("加密条目必须拒绝");
        assert_eq!(error.code(), DOCUMENT_ARCHIVE_INVALID);
    }

    #[test]
    fn test_rejects_unknown_methods() {
        let archive = build_zip(&[("a.yaml", b"x: 1\n")]);
        for method in [12u16, 99] {
            let mut tampered = archive.clone();
            let eocd = find_signature(&tampered, EOCD_SIGNATURE);
            let central_offset = usize::try_from(read_u32_le(&tampered[eocd + 16..])).expect("偏移可读");
            tampered[central_offset + 10..central_offset + 12].copy_from_slice(&method.to_le_bytes());
            let error = ArchiveSource::from_bytes(tampered, &ParseLimits::default())
                .expect_err("未知压缩方法必须拒绝");
            assert_eq!(error.code(), DOCUMENT_ARCHIVE_INVALID);
        }
    }

    #[test]
    fn test_directory_entries_are_skipped_not_fatal() {
        // 真实 `zip -r` 会把目录本身写入中央目录（尾部 `/`）；索引必须跳过而非报错。
        let archive = build_zip_with_directory();
        let source = ArchiveSource::from_bytes(archive, &ParseLimits::default())
            .expect("含目录条目的归档必须可打开");
        let file = PackagePath::new(".card/metadata.yaml").expect("合法");
        assert_eq!(source.read(&file).expect("读取文件成员"), b"ok: true\n");
        assert!(source.member(&PackagePath::new(".card").expect("合法")).is_none(), "目录条目不入索引");
    }

    #[test]
    fn test_deflate_member_inflates_on_read() {
        // 用合法 raw-deflate「非压缩块」构造一个 Deflate 成员，验证读取端现场解压。
        let archive = build_zip_deflate("note.txt", b"abc");
        let source = ArchiveSource::from_bytes(archive, &ParseLimits::default())
            .expect("Deflate 归档可打开");
        let path = PackagePath::new("note.txt").expect("合法");
        assert_eq!(source.read(&path).expect("Deflate 成员读取"), b"abc");
        let mut stream = source.open_stream(&path).expect("打开流");
        assert_eq!(stream.read_to_vec().expect("流解码一致"), b"abc");
        source.verify_member_crc(&path).expect("Deflate CRC 校验通过");
    }

    #[test]
    fn test_rejects_duplicate_paths_and_bad_signature() {
        let archive = build_zip(&[("a.yaml", b"x: 1\n"), ("a.yaml", b"y: 2\n")]);
        let error = ArchiveSource::from_bytes(archive, &ParseLimits::default())
            .expect_err("重复路径必须拒绝");
        assert_eq!(error.code(), DOCUMENT_ARCHIVE_INVALID);
        let error = ArchiveSource::from_bytes(b"not a zip".to_vec(), &ParseLimits::default())
            .expect_err("非归档必须拒绝");
        assert_eq!(error.code(), DOCUMENT_ARCHIVE_INVALID);
    }

    #[test]
    fn test_rejects_backslash_paths_as_unsafe() {
        let archive = build_zip(&[("bad\\name.yaml", b"x: 1\n")]);
        let error = ArchiveSource::from_bytes(archive, &ParseLimits::default())
            .expect_err("反斜杠路径必须拒绝");
        assert_eq!(error.code(), DOCUMENT_PATH_UNSAFE);
    }

    #[test]
    fn test_limit_on_total_uncompressed_bytes() {
        let archive = build_zip(&[("a.bin", b"1234567890")]);
        let limits = ParseLimits { max_uncompressed_bytes: 4, ..ParseLimits::default() };
        let error = ArchiveSource::from_bytes(archive, &limits).expect_err("超限必须拒绝");
        assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
    }

    #[test]
    fn test_limit_on_compression_ratio() {
        // 篡改中央目录声明：压缩 5 字节、解压 5000 字节 → 比率 1000。
        let archive = build_zip(&[("a.bin", b"12345")]);
        let mut tampered = archive;
        let eocd = find_signature(&tampered, EOCD_SIGNATURE);
        let central_offset = usize::try_from(read_u32_le(&tampered[eocd + 16..])).expect("偏移可读");
        tampered[central_offset + 24..central_offset + 28].copy_from_slice(&5000u32.to_le_bytes());
        let error = ArchiveSource::from_bytes(tampered, &ParseLimits::default())
            .expect_err("压缩比超限必须拒绝");
        assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
    }

    #[test]
    fn test_crc_verification() {
        let archive = build_zip(&[("a.yaml", b"x: 1\n")]);
        let source = ArchiveSource::from_bytes(archive, &ParseLimits::default()).expect("打开");
        let path = PackagePath::new("a.yaml").expect("合法");
        source.verify_member_crc(&path).expect("CRC 正常通过");
    }

    #[test]
    fn test_crc_mismatch_detected() {
        let archive = build_zip(&[("a.yaml", b"x: 1\n")]);
        // 篡改成员数据（本地数据区第一字节），CRC 校验必须失败。
        let mut tampered = archive;
        tampered[30 + "a.yaml".len() + 1] ^= 0xFF;
        let source = ArchiveSource::from_bytes(tampered, &ParseLimits::default()).expect("打开成功");
        let path = PackagePath::new("a.yaml").expect("合法");
        let error = source.verify_member_crc(&path).expect_err("CRC 必须失败");
        assert_eq!(error.code(), DOCUMENT_ARCHIVE_INVALID);
    }

    #[test]
    fn test_local_header_mismatch_rejected() {
        let mut archive = build_zip(&[("a.yaml", b"x: 1\n")]);
        // 篡改本地文件名首字节，与中央目录不一致。
        let eocd = find_signature(&archive, EOCD_SIGNATURE);
        let central_offset = usize::try_from(read_u32_le(&archive[eocd + 16..])).expect("偏移");
        let _ = central_offset;
        archive[30] = b'b';
        let source = ArchiveSource::from_bytes(archive, &ParseLimits::default()).expect("索引可建");
        let path = PackagePath::new("a.yaml").expect("合法");
        let error = source.read(&path).expect_err("读取时本地头校验必须失败");
        assert_eq!(error.code(), DOCUMENT_ARCHIVE_INVALID);
    }

    #[test]
    fn test_empty_zip_indexes_no_members() {
        // 空归档（仅 EOCD，PK\x05\x06 开头）。
        let mut archive = Vec::new();
        archive.extend_from_slice(&EOCD_SIGNATURE.to_le_bytes());
        archive.extend_from_slice(&[0u8; 18]);
        assert!(ArchiveSource::looks_like_zip(&archive));
        let source = ArchiveSource::from_bytes(archive, &ParseLimits::default()).expect("空归档可打开");
        assert_eq!(source.fingerprint().members.len(), 0);
    }

    #[test]
    fn test_zip64_archive_reads() {
        // 构造 ZIP64 归档：成员尺寸超过 u32 哨兵触发 ZIP64 扩展字段。
        let (mut local, _) = build_store_pair("big.bin", b"0123456789", 0);
        // 本地头尺寸字段置哨兵（读取端信任中央目录，仅校验签名/名称）。
        local[18..26].copy_from_slice(&[0xFF; 8]);
        let name_bytes = b"big.bin";
        let mut central = Vec::new();
        central.extend_from_slice(&CENTRAL_SIGNATURE.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&0x0800u16.to_le_bytes());
        central.extend_from_slice(&METHOD_STORE.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0x0021u16.to_le_bytes());
        central.extend_from_slice(&crc32(b"0123456789").to_le_bytes());
        central.extend_from_slice(&u32::MAX.to_le_bytes()); // 压缩尺寸哨兵
        central.extend_from_slice(&u32::MAX.to_le_bytes()); // 解压尺寸哨兵
        central.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        let zip64_extra: Vec<u8> = {
            let mut extra = Vec::new();
            extra.extend_from_slice(&ZIP64_EXTRA_TAG.to_le_bytes());
            extra.extend_from_slice(&16u16.to_le_bytes());
            extra.extend_from_slice(&10u64.to_le_bytes()); // 解压尺寸
            extra.extend_from_slice(&10u64.to_le_bytes()); // 压缩尺寸
            extra
        };
        central.extend_from_slice(&(zip64_extra.len() as u16).to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&0u32.to_le_bytes());
        central.extend_from_slice(&0u32.to_le_bytes());
        central.extend_from_slice(name_bytes);
        central.extend_from_slice(&zip64_extra);
        let mut archive = local;
        let central_offset = archive.len() as u32;
        archive.extend_from_slice(&central);
        let central_size = archive.len() as u32 - central_offset;
        // ZIP64 EOCD + locator + 经典 EOCD（全 0xFFFF 哨兵）。
        let zip64_offset = archive.len() as u64;
        archive.extend_from_slice(&ZIP64_EOCD_SIGNATURE.to_le_bytes());
        archive.extend_from_slice(&44u64.to_le_bytes()); // 记录大小（不含前 12 字节）
        archive.extend_from_slice(&45u16.to_le_bytes());
        archive.extend_from_slice(&45u16.to_le_bytes());
        archive.extend_from_slice(&0u32.to_le_bytes());
        archive.extend_from_slice(&0u32.to_le_bytes());
        archive.extend_from_slice(&1u64.to_le_bytes()); // 成员数
        archive.extend_from_slice(&1u64.to_le_bytes()); // 中央目录条目数
        archive.extend_from_slice(&(central_size as u64).to_le_bytes());
        archive.extend_from_slice(&zip64_offset.to_le_bytes());
        archive.extend_from_slice(&ZIP64_EOCD_LOCATOR_SIGNATURE.to_le_bytes());
        archive.extend_from_slice(&0u32.to_le_bytes());
        archive.extend_from_slice(&zip64_offset.to_le_bytes());
        archive.extend_from_slice(&1u32.to_le_bytes());
        archive.extend_from_slice(&EOCD_SIGNATURE.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        archive.extend_from_slice(&u16::MAX.to_le_bytes());
        archive.extend_from_slice(&u16::MAX.to_le_bytes());
        archive.extend_from_slice(&u32::MAX.to_le_bytes());
        archive.extend_from_slice(&u32::MAX.to_le_bytes());
        archive.extend_from_slice(&0u16.to_le_bytes());
        let source = ArchiveSource::from_bytes(archive, &ParseLimits::default()).expect("ZIP64 归档可打开");
        let path = PackagePath::new("big.bin").expect("合法");
        assert_eq!(source.read(&path).expect("ZIP64 成员读取"), b"0123456789");
    }

    #[test]
    fn test_dos_time_conversion() {
        // 1980-01-01 00:00:00 → Unix epoch + 3652 天。
        let converted = dos_date_time_to_system(0x0021, 0).expect("合法 DOS 时间");
        assert_eq!(converted, UNIX_EPOCH + Duration::from_secs(3652 * 86_400));
        assert!(dos_date_time_to_system(0x0021 | (13 << 5), 0).is_none(), "非法月份必须归 None");
    }

    #[test]
    fn test_looks_like_zip_signatures() {
        assert!(ArchiveSource::looks_like_zip(b"PK\x03\x04rest"));
        assert!(ArchiveSource::looks_like_zip(b"PK\x05\x06"));
        assert!(!ArchiveSource::looks_like_zip(b"PK"));
        assert!(!ArchiveSource::looks_like_zip(b"RAR!\x1a\x07"));
    }

    /// 在字节串中查找签名偏移（测试辅助）。
    fn find_signature(data: &[u8], signature: u32) -> usize {
        data.windows(4)
            .rfind(|window| read_u32_le(window) == signature)
            .map(|window| window.as_ptr() as usize - data.as_ptr() as usize)
            .expect("签名必须存在")
    }
}
