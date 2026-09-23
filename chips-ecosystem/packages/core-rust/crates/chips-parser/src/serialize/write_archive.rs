//! ZIP Store 归档写侧（《06-文档解析器设计》§10.2 归档输出、《11-文档服务设计》
//! §5.4 发布态重建、RFC 点位四 §7.2「ZIP writer 落位」与 OQ-3 裁定 G）。
//!
//! 手写 Store 写侧，零新依赖（裁定 G 批准「手写 ZIP Store 零新依赖」照案落地），
//! 与读侧 `source::archive` 同处本 crate，杜绝清单格式知识的双实现漂移。
//!
//! 写侧口径（逐条权威引证见交付报告）：
//!
//! - 全部条目 Store（方法编号 0），写入器重算 CRC32 与尺寸（《11.05》§5.4 表
//!   「压缩方式」行）；本地头 CRC 字段在内容写出后回填（可寻写目标，
//!   即《11.05》§5.4 表「落地」行的归档同级临时文件），不写数据描述符；
//! - 条目按包内路径 UTF-8 字节序**严格升序**写出，重复与乱序即拒绝
//!   （《11.05》§5.4 表「条目顺序」行、《01.03》§3.3 路径唯一）；
//! - 不写目录条目、不写系统生成物（生成物名单过滤由 `source::directory`
//!   的索引侧承担，写侧只接受成员）；
//! - 成员时间戳统一取保存时刻 UTC（《11.05》§5.4 表「成员时间戳」行），
//!   DOS 时间字段仅能表达 1980–2107，越界以防御臂拒绝；
//! - 发布侧一律不产生 ZIP64（《06.10》§10.2、《02.02》§2.1）：单成员字节、
//!   条目数、名称长度、条目区累计偏移任一越过经典 ZIP 上限即拒绝，不落
//!   ZIP64 扩展记录；
//! - 文件名为 UTF-8 字节并置通用标志位 `0x0800`（PKZIP APPENDIX C 语言编码
//!   扩展位），与读侧「非 UTF-8 文件名即非法」口径对偶；
//! - `version made by` 宿主字节取 3（UNIX）并携带 `S_IFREG | 0o644` 外部属性，
//!   使读侧《04.03》§3.3 的普通文件判定真实生效（读侧只在宿主为 UNIX 时校验
//!   文件类型位，见 `source/archive.rs:364-376`）；
//! - 未变更成员走 [`ZipArchiveWriter::add_entry_with_size`] 的分块复制路径：
//!   内存占用为常数，不整包载入（《11.05》§5.4 表「未变更成员」行）。
//!
//! 归档总字节的闭式和（[`archive_total_size`]）供 `serialize` 侧在写出
//! `metadata.yaml` 之前解出 `file_info.total_size`（RFC 点位四 §7.3 归档态），
//! 不需要 dry-run 重打包。

use std::io::{Read, Seek, SeekFrom, Write};
use std::time::SystemTime;

use crate::digest::Crc32;
use crate::error::DocumentError;
use crate::source::PackagePath;

use super::{epoch_millis, epoch_millis_to_civil};

/// 本地文件头签名。
const LOCAL_SIGNATURE: u32 = 0x0403_4b50;
/// 中央目录条目签名。
const CENTRAL_SIGNATURE: u32 = 0x0201_4b50;
/// 端到端中央目录记录签名。
const EOCD_SIGNATURE: u32 = 0x0605_4b50;
/// 本地文件头固定区长度。
const LOCAL_FIXED_SIZE: u64 = 30;
/// 中央目录条目固定区长度。
const CENTRAL_FIXED_SIZE: u64 = 46;
/// EOCD 记录长度（无注释）。
const EOCD_SIZE: u64 = 22;
/// 本地头 CRC32 字段的区内偏移。
const LOCAL_CRC_OFFSET: u64 = 14;
/// 需要的基础版本（2.0，Store + 通用标志位）。
const VERSION_NEEDED: u16 = 20;
/// `version made by`：宿主 3（UNIX）+ 版本 20。
const VERSION_MADE_BY: u16 = 0x0314;
/// 通用标志位：文件名 UTF-8。
const FLAG_UTF8_NAME: u16 = 0x0800;
/// 压缩方法：Store。
const METHOD_STORE: u16 = 0;
/// 外部属性：普通文件 + `0o644`（高 16 位为 POSIX 模式）。
const EXTERNAL_ATTRIBUTES_REGULAR: u32 = 0o100_644 << 16;
/// 分块复制的块长（常数内存面）。
const STREAM_CHUNK_BYTES: usize = 64 * 1024;
/// DOS 时间字段可表达的起始年。
const DOS_MIN_YEAR: i64 = 1980;
/// DOS 时间字段可表达的结束年。
const DOS_MAX_YEAR: i64 = 2107;
/// 经典 ZIP 字段上限的文本描述（错误消息用）。
const CLASSIC_LIMIT_TEXT: &str = "4294967295";

/// 单条目在归档中的定长开销：本地头 + 中央目录头 + 两份名字字段。
#[must_use]
pub fn entry_overhead(name_bytes: usize) -> u64 {
    LOCAL_FIXED_SIZE
        + CENTRAL_FIXED_SIZE
        + u64::try_from(name_bytes)
            .unwrap_or(u64::MAX)
            .saturating_mul(2)
}

/// 归档态 `total_size` 闭式和（RFC 点位四 §7.3）：条目内容字节 +
/// 定长本地头/中央目录开销 + EOCD，与 [`ZipArchiveWriter`] 的实际写出
/// 逐字节同式（`write_archive::tests::test_closed_form_matches_written_bytes` 锁死）。
///
/// 入参为最终包内成员集（含未修订成员的复用尺寸）：`(路径, 内容字节数)`。
pub fn archive_total_size(entries: &[(PackagePath, u64)]) -> Result<u64, DocumentError> {
    let sizes: Vec<(usize, u64)> = entries
        .iter()
        .map(|(path, size)| (path.as_str().len(), *size))
        .collect();
    check_publish_bounds(&sizes)?;
    let mut total = EOCD_SIZE;
    for (name_len, size) in sizes {
        total = total
            .checked_add(entry_overhead(name_len))
            .and_then(|value| value.checked_add(size))
            .ok_or_else(|| DocumentError::LimitExceeded {
                limit: "zip64_publish_boundary",
                actual: "归档总字节闭式和溢出".to_owned(),
                file: None,
            })?;
    }
    Ok(total)
}

/// 发布侧经典 ZIP 上限（禁 ZIP64，见模块头注）。
fn check_publish_bounds(sizes: &[(usize, u64)]) -> Result<(), DocumentError> {
    let boundary = |actual: String| DocumentError::LimitExceeded {
        limit: "zip64_publish_boundary",
        actual,
        file: None,
    };
    if sizes.len() > usize::from(u16::MAX) {
        return Err(boundary(format!("条目数 {} 超出 65535", sizes.len())));
    }
    let mut offsets = 0u64;
    for (name_len, size) in sizes {
        if *name_len > usize::from(u16::MAX) {
            return Err(boundary(format!("路径字节长度 {name_len} 超出 65535")));
        }
        if *size > u64::from(u32::MAX) {
            return Err(boundary(format!(
                "单成员字节 {size} 超出 {CLASSIC_LIMIT_TEXT}"
            )));
        }
        offsets = offsets
            .checked_add(*size)
            .and_then(|value| value.checked_add(entry_overhead(*name_len)))
            .ok_or_else(|| boundary("成员字节与开销累加溢出".to_owned()))?;
    }
    // 中央目录起点即条目区结束偏移；EOCD 之前不得越过 u32 上限。
    if offsets > u64::from(u32::MAX) {
        return Err(boundary(format!(
            "条目区累计字节 {offsets} 超出 {CLASSIC_LIMIT_TEXT}"
        )));
    }
    Ok(())
}

/// 中央目录条目所需记录。
#[derive(Debug)]
struct CentralRecord {
    name: Vec<u8>,
    offset: u32,
    size: u32,
    crc: u32,
}

/// ZIP Store 归档写入器：流式写出「本地头 + 内容」，`finish` 落中央目录与 EOCD。
///
/// 目标需可寻址（《11.05》§5.4 落地口径为归档同级临时文件），以便内容写出后
/// 回填本地头 CRC32 字段；[`Self::finish`] 返回归档总字节。
#[derive(Debug)]
pub struct ZipArchiveWriter<W: Write + Seek> {
    writer: W,
    dos_time: u16,
    dos_date: u16,
    records: Vec<CentralRecord>,
    offset: u64,
    previous_name: Option<String>,
    finished: bool,
}

impl<W: Write + Seek> ZipArchiveWriter<W> {
    /// 以保存时刻构造写入器：全部条目时间戳统一取该时刻（《11.05》§5.4）。
    ///
    /// 保存时刻超出 DOS 时间可表达区间（1980–2107）时以防御臂拒绝。
    pub fn new(writer: W, saved_at: SystemTime) -> Result<Self, DocumentError> {
        let (dos_time, dos_date) = dos_fields_from_saved_at(saved_at)?;
        Ok(Self {
            writer,
            dos_time,
            dos_date,
            records: Vec::new(),
            offset: 0,
            previous_name: None,
            finished: false,
        })
    }

    /// 写出一个完整字节成员（序列化产物与新增资源）。
    pub fn add_entry(&mut self, path: &PackagePath, bytes: &[u8]) -> Result<(), DocumentError> {
        let start = self.begin_entry(path, bytes.len() as u64)?;
        self.writer
            .write_all(bytes)
            .map_err(|io_error| write_failed(path.as_str(), &io_error))?;
        self.end_entry(path, start, bytes.len() as u64, crate::digest::crc32(bytes))
    }

    /// 分块写出已知尺寸的成员：未变更成员按映射切片/文件流原样复制，
    /// 不经解压与解码，内存占用为常数（《11.05》§5.4 表「未变更成员」行）。
    ///
    /// `size` 为条目声明尺寸：实际读出的字节数与之不符即拒绝（不留半截条目）。
    pub fn add_entry_with_size(
        &mut self,
        path: &PackagePath,
        size: u64,
        reader: &mut dyn Read,
    ) -> Result<(), DocumentError> {
        let start = self.begin_entry(path, size)?;
        let mut accumulator = Crc32::new();
        let mut buffer = vec![0u8; STREAM_CHUNK_BYTES];
        let mut written = 0u64;
        loop {
            let read = reader
                .read(&mut buffer)
                .map_err(|io_error| write_failed(path.as_str(), &io_error))?;
            if read == 0 {
                break;
            }
            accumulator.update(&buffer[..read]);
            self.writer
                .write_all(&buffer[..read])
                .map_err(|io_error| write_failed(path.as_str(), &io_error))?;
            written += read as u64;
            if written > size {
                return Err(DocumentError::ArchiveInvalid {
                    message: format!("成员实际字节 {written} 超出声明尺寸 {size}：{path}"),
                });
            }
        }
        if written != size {
            return Err(DocumentError::ArchiveInvalid {
                message: format!("成员实际字节 {written} 与声明尺寸 {size} 不符：{path}"),
            });
        }
        self.end_entry(path, start, size, accumulator.finish())
    }

    /// 写出中央目录与 EOCD，返回归档总字节。
    ///
    /// 收尾后不得再写出成员：重复调用以 `DocumentError::Io` 拒绝（防御臂）。
    pub fn finish(&mut self) -> Result<u64, DocumentError> {
        if self.finished {
            return Err(DocumentError::Io {
                message: "归档写入器已收尾，不得二次写出中央目录".to_owned(),
            });
        }
        self.finished = true;
        let records = std::mem::take(&mut self.records);
        let central_offset = self.offset;
        let central_offset_u32 =
            u32::try_from(central_offset).map_err(|_| DocumentError::LimitExceeded {
                limit: "zip64_publish_boundary",
                actual: format!("中央目录起点 {central_offset} 超出 {CLASSIC_LIMIT_TEXT}"),
                file: None,
            })?;
        let count = u16::try_from(records.len()).map_err(|_| DocumentError::LimitExceeded {
            limit: "zip64_publish_boundary",
            actual: format!("条目数 {} 超出 65535", records.len()),
            file: None,
        })?;
        let dos_time = self.dos_time;
        let dos_date = self.dos_date;
        let mut tail = Vec::new();
        for record in &records {
            write_u32(&mut tail, CENTRAL_SIGNATURE);
            write_u16(&mut tail, VERSION_MADE_BY);
            write_u16(&mut tail, VERSION_NEEDED);
            write_u16(&mut tail, FLAG_UTF8_NAME);
            write_u16(&mut tail, METHOD_STORE);
            write_u16(&mut tail, dos_time);
            write_u16(&mut tail, dos_date);
            write_u32(&mut tail, record.crc);
            write_u32(&mut tail, record.size);
            write_u32(&mut tail, record.size);
            write_u16(&mut tail, name_length(&record.name)?);
            write_u16(&mut tail, 0);
            write_u16(&mut tail, 0);
            write_u16(&mut tail, 0);
            write_u16(&mut tail, 0);
            write_u32(&mut tail, EXTERNAL_ATTRIBUTES_REGULAR);
            write_u32(&mut tail, record.offset);
            tail.extend_from_slice(&record.name);
        }
        let central_size = u32::try_from(tail.len()).map_err(|_| DocumentError::LimitExceeded {
            limit: "zip64_publish_boundary",
            actual: format!("中央目录字节 {} 超出 {CLASSIC_LIMIT_TEXT}", tail.len()),
            file: None,
        })?;
        write_u32(&mut tail, EOCD_SIGNATURE);
        write_u16(&mut tail, 0);
        write_u16(&mut tail, 0);
        write_u16(&mut tail, count);
        write_u16(&mut tail, count);
        write_u32(&mut tail, central_size);
        write_u32(&mut tail, central_offset_u32);
        write_u16(&mut tail, 0);
        self.writer
            .write_all(&tail)
            .map_err(|io_error| write_failed("中央目录与 EOCD", &io_error))?;
        self.writer
            .flush()
            .map_err(|io_error| write_failed("归档刷盘", &io_error))?;
        Ok(central_offset + u64::from(central_size) + EOCD_SIZE)
    }

    /// 交出内部写入目标（`finish` 之后取回归档字节/文件句柄）。
    pub fn into_inner(self) -> W {
        self.writer
    }

    /// 条目顺序、上限与本地头写出（`add_*` 的公共前段）；返回本地头起点偏移。
    fn begin_entry(&mut self, path: &PackagePath, size: u64) -> Result<u64, DocumentError> {
        if self.finished {
            return Err(DocumentError::Io {
                message: "归档写入器已收尾，不得继续写出成员".to_owned(),
            });
        }
        let name = path.as_str();
        if let Some(previous) = &self.previous_name {
            if name.as_bytes() <= previous.as_bytes() {
                return Err(DocumentError::ArchiveInvalid {
                    message: if name.as_bytes() == previous.as_bytes() {
                        format!("重复条目路径：{name}")
                    } else {
                        format!("条目路径必须按 UTF-8 字节序严格升序写出：{previous} → {name}")
                    },
                });
            }
        }
        check_publish_bounds(&[(name.len(), size)])?;
        let start = self.offset;
        let mut header = Vec::with_capacity(LOCAL_FIXED_SIZE as usize + name.len());
        write_u32(&mut header, LOCAL_SIGNATURE);
        write_u16(&mut header, VERSION_NEEDED);
        write_u16(&mut header, FLAG_UTF8_NAME);
        write_u16(&mut header, METHOD_STORE);
        write_u16(&mut header, self.dos_time);
        write_u16(&mut header, self.dos_date);
        // CRC 在内容写出后由 `end_entry` 回填本字段（模块头注口径）。
        write_u32(&mut header, 0);
        let size_u32 = u32::try_from(size).map_err(|_| DocumentError::LimitExceeded {
            limit: "zip64_publish_boundary",
            actual: format!("成员字节 {size} 超出 {CLASSIC_LIMIT_TEXT}"),
            file: Some(path.clone()),
        })?;
        write_u32(&mut header, size_u32);
        write_u32(&mut header, size_u32);
        write_u16(&mut header, name_length(name.as_bytes())?);
        write_u16(&mut header, 0);
        header.extend_from_slice(name.as_bytes());
        self.writer
            .write_all(&header)
            .map_err(|io_error| write_failed(name, &io_error))?;
        self.previous_name = Some(name.to_owned());
        Ok(start)
    }

    /// 内容写出完成后的 CRC 回填、偏移推进与中央目录记录入表。
    fn end_entry(
        &mut self,
        path: &PackagePath,
        start: u64,
        size: u64,
        digest: u32,
    ) -> Result<(), DocumentError> {
        let name = path.as_str();
        let end = start
            .checked_add(LOCAL_FIXED_SIZE + u64::try_from(name.len()).unwrap_or(u64::MAX) + size)
            .ok_or_else(|| DocumentError::LimitExceeded {
                limit: "zip64_publish_boundary",
                actual: "条目区累计字节溢出".to_owned(),
                file: Some(path.clone()),
            })?;
        self.writer
            .seek(SeekFrom::Start(start + LOCAL_CRC_OFFSET))
            .map_err(|io_error| write_failed(name, &io_error))?;
        let mut crc_bytes = Vec::new();
        write_u32(&mut crc_bytes, digest);
        self.writer
            .write_all(&crc_bytes)
            .map_err(|io_error| write_failed(name, &io_error))?;
        self.writer
            .seek(SeekFrom::Start(end))
            .map_err(|io_error| write_failed(name, &io_error))?;
        self.offset = end;
        self.records.push(CentralRecord {
            name: name.as_bytes().to_vec(),
            offset: u32::try_from(start).unwrap_or(u32::MAX),
            size: u32::try_from(size).unwrap_or(u32::MAX),
            crc: digest,
        });
        Ok(())
    }
}

/// 名字字段长度校验（u16 上限）。
fn name_length(name: &[u8]) -> Result<u16, DocumentError> {
    u16::try_from(name.len()).map_err(|_| DocumentError::LimitExceeded {
        limit: "zip64_publish_boundary",
        actual: format!("路径字节长度 {} 超出 65535", name.len()),
        file: None,
    })
}

/// 把保存时刻编码为 DOS 时间/日期字段对。
fn dos_fields_from_saved_at(saved_at: SystemTime) -> Result<(u16, u16), DocumentError> {
    let civil = epoch_millis_to_civil(epoch_millis(saved_at)?);
    if civil.year < DOS_MIN_YEAR || civil.year > DOS_MAX_YEAR {
        return Err(DocumentError::LimitExceeded {
            limit: "zip_dos_time_range",
            actual: format!(
                "保存时刻年份 {} 超出 DOS 时间可表达区间 {DOS_MIN_YEAR}–{DOS_MAX_YEAR}",
                civil.year
            ),
            file: None,
        });
    }
    let time = (u16::try_from(civil.hour).unwrap_or(0) << 11)
        | (u16::try_from(civil.minute).unwrap_or(0) << 5)
        | u16::try_from(civil.second / 2).unwrap_or(0);
    let date = u16::try_from(civil.year - DOS_MIN_YEAR).unwrap_or(0) << 9
        | (u16::try_from(civil.month).unwrap_or(1) << 5)
        | u16::try_from(civil.day).unwrap_or(1);
    Ok((time, date))
}

/// 写入失败（`DocumentError::Io` 在册码）。
fn write_failed(target: &str, io_error: &std::io::Error) -> DocumentError {
    DocumentError::Io {
        message: format!("归档写入失败（{target}）：{io_error}"),
    }
}

/// 小端写 `u16`。
fn write_u16(sink: &mut Vec<u8>, value: u16) {
    sink.extend_from_slice(&value.to_le_bytes());
}

/// 小端写 `u32`。
fn write_u32(sink: &mut Vec<u8>, value: u32) {
    sink.extend_from_slice(&value.to_le_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::ParseLimits;
    use crate::source::archive::ArchiveSource;
    use crate::source::DocumentSource;
    use std::io::Cursor;
    use std::time::{Duration, UNIX_EPOCH};

    /// 固定保存时刻：2026-03-22T08:00:00.000Z（DOS 区间内）。
    fn saved_at() -> SystemTime {
        UNIX_EPOCH + Duration::from_millis(1_774_166_400_000)
    }

    /// 写出成员三元组（路径、内容字节）。
    const SAMPLES: &[(&str, &[u8])] = &[
        (".card/metadata.yaml", b"card_id: a1B2c3D4e5\n"),
        ("content/a1B2c3D4e5.yaml", b"card_type: base.video\n"),
        ("docs/季度报告.pdf", b"%PDF-1.7\n"),
    ];

    /// 以写侧产出一份内存归档（已 `finish`）。
    fn build(samples: &[(&str, &[u8])]) -> Result<Vec<u8>, DocumentError> {
        let mut writer = ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at())?;
        for (path, bytes) in samples {
            writer.add_entry(&PackagePath::new(path).expect("合法路径"), bytes)?;
        }
        writer.finish()?;
        Ok(writer.into_inner().into_inner())
    }

    #[test]
    fn test_written_archive_reads_back_with_parser_source() {
        // 写侧产物必须由读侧索引原样回读（OQ-3 裁定 G 的回读对拍锁）。
        let archive = build(SAMPLES).expect("写出归档");
        let source = ArchiveSource::from_bytes(archive.clone(), &ParseLimits::default())
            .expect("读侧必须接受写侧产物");
        let paths: Vec<&str> = source
            .members()
            .keys()
            .map(crate::source::PackagePath::as_str)
            .collect();
        assert_eq!(
            paths,
            vec![
                ".card/metadata.yaml",
                "content/a1B2c3D4e5.yaml",
                "docs/季度报告.pdf"
            ],
            "索引顺序必须即路径升序"
        );
        for (path, bytes) in SAMPLES {
            let package = PackagePath::new(path).expect("合法");
            let meta = source.member(&package).expect("成员在册");
            assert_eq!(meta.size, bytes.len() as u64, "{path} 尺寸");
            assert_eq!(
                crate::digest::crc32(bytes),
                meta.crc32.expect("写侧必带 CRC"),
                "{path} CRC32 必须由写侧重算并与读侧一致"
            );
            assert_eq!(source.read(&package).expect("读取"), *bytes, "{path} 字节");
            source
                .verify_member_crc(&package)
                .expect("CRC 校验必须通过（validate 前置条件）");
        }
    }

    #[test]
    fn test_closed_form_matches_written_bytes() {
        // 闭式和与实际写出字节逐字节相等（RFC §7.3 归档态的算法正确性锁）。
        let archive = build(SAMPLES).expect("写出归档");
        let entries: Vec<(PackagePath, u64)> = SAMPLES
            .iter()
            .map(|(path, bytes)| (PackagePath::new(path).expect("合法"), bytes.len() as u64))
            .collect();
        assert_eq!(
            archive_total_size(&entries).expect("闭式和可解"),
            archive.len() as u64
        );
    }

    #[test]
    fn test_local_and_central_headers_publish_shape() {
        let archive = build(&[("a.txt", b"hi")]).expect("写出归档");
        // 本地头：签名 / Store / UTF-8 旗标 / 基础版本 / CRC 已回填。
        assert_eq!(&archive[0..4], b"PK\x03\x04");
        assert_eq!(read_u16(&archive, 4), VERSION_NEEDED);
        assert_eq!(read_u16(&archive, 6), FLAG_UTF8_NAME);
        assert_eq!(read_u16(&archive, 8), METHOD_STORE);
        assert_eq!(
            read_u32(&archive, 14),
            crate::digest::crc32(b"hi"),
            "本地头 CRC 字段必须回填真实值（不写数据描述符）"
        );
        assert_eq!(read_u32(&archive, 18), 2, "压缩尺寸 = 内容尺寸");
        assert_eq!(read_u32(&archive, 22), 2, "未压缩尺寸");
        assert_eq!(read_u16(&archive, 28), 0, "不得写 extra field");
        // 中央目录条目。
        let central = (LOCAL_FIXED_SIZE + 5 + 2) as usize;
        assert_eq!(&archive[central..central + 4], b"PK\x01\x02");
        assert_eq!(read_u16(&archive, central + 4), VERSION_MADE_BY);
        assert_eq!(read_u16(&archive, central + 8), FLAG_UTF8_NAME);
        assert_eq!(
            read_u32(&archive, central + 38) >> 16,
            EXTERNAL_ATTRIBUTES_REGULAR >> 16,
            "外部属性必须声明为普通文件 0o644"
        );
        assert_eq!(read_u32(&archive, central + 42), 0, "相对偏移");
        // EOCD：条目数、中央目录尺寸与偏移、无注释。
        let eocd = archive.len() - EOCD_SIZE as usize;
        assert_eq!(&archive[eocd..eocd + 4], b"PK\x05\x06");
        assert_eq!(read_u16(&archive, eocd + 8), 1);
        assert_eq!(read_u16(&archive, eocd + 10), 1);
        assert_eq!(read_u32(&archive, eocd + 16), central as u32);
        assert_eq!(read_u16(&archive, eocd + 20), 0);
        // 无目录条目、无系统生成物：条目区只含一个本地头 + 内容。
        assert_eq!(archive.len(), eocd + EOCD_SIZE as usize);
    }

    #[test]
    fn test_streamed_copy_matches_one_shot_and_validates_size() {
        let payload: Vec<u8> = (0..200_000u32).map(|index| (index % 251) as u8).collect();
        let mut writer =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at()).expect("写入器");
        writer
            .add_entry_with_size(
                &PackagePath::new("big.bin").expect("合法"),
                payload.len() as u64,
                &mut Cursor::new(payload.clone()),
            )
            .expect("分块写出");
        writer.finish().expect("收尾");
        let archive = writer.into_inner().into_inner();
        let source = ArchiveSource::from_bytes(archive, &ParseLimits::default()).expect("回读");
        let path = PackagePath::new("big.bin").expect("合法");
        assert_eq!(source.read(&path).expect("读取"), payload);
        source
            .verify_member_crc(&path)
            .expect("CRC 与一次性计算对拍");
    }

    #[test]
    fn test_streamed_size_mismatch_is_rejected() {
        // 声明尺寸与实际字节不符：不留半截条目，直接拒绝。
        let mut writer =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at()).expect("写入器");
        let error = writer
            .add_entry_with_size(
                &PackagePath::new("short.bin").expect("合法"),
                10,
                &mut Cursor::new(b"abc".to_vec()),
            )
            .expect_err("短读必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_ARCHIVE_INVALID);
        let mut writer =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at()).expect("写入器");
        let error = writer
            .add_entry_with_size(
                &PackagePath::new("long.bin").expect("合法"),
                1,
                &mut Cursor::new(b"abcdef".to_vec()),
            )
            .expect_err("超长必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_ARCHIVE_INVALID);
    }

    #[test]
    fn test_entry_order_and_duplicate_are_rejected() {
        let mut writer =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at()).expect("写入器");
        writer
            .add_entry(&PackagePath::new("b.txt").expect("合法"), b"2".as_slice())
            .expect("首条");
        let error = writer
            .add_entry(&PackagePath::new("a.txt").expect("合法"), b"1".as_slice())
            .expect_err("乱序必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_ARCHIVE_INVALID);
        assert!(error.to_string().contains("严格升序"));
        let mut writer =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at()).expect("写入器");
        writer
            .add_entry(&PackagePath::new("dup.txt").expect("合法"), b"1".as_slice())
            .expect("首条");
        let error = writer
            .add_entry(&PackagePath::new("dup.txt").expect("合法"), b"2".as_slice())
            .expect_err("重复必须拒绝");
        assert!(error.to_string().contains("重复条目路径"));
    }

    #[test]
    fn test_dos_timestamp_range_guard() {
        // DOS 字段可表达 1980–2107；越界时刻以防御臂拒绝。
        let before = UNIX_EPOCH - Duration::from_millis(31_536_000_000);
        let error =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), before).expect_err("1980 之前必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_LIMIT_EXCEEDED);
        assert!(error.to_string().contains("DOS"));
        // 2108-01-01T00:00:00Z
        let after = UNIX_EPOCH + Duration::from_millis(4_354_819_200_000);
        let error =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), after).expect_err("2107 之后必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_LIMIT_EXCEEDED);
    }

    #[test]
    fn test_zip64_publish_boundary_is_rejected() {
        // 发布侧不产生 ZIP64：单成员、条目累计与路径长度三条边界各锁一次。
        let huge = PackagePath::new("huge.bin").expect("合法");
        let error =
            archive_total_size(&[(huge, u64::from(u32::MAX) + 1)]).expect_err("单成员越界必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_LIMIT_EXCEEDED);
        assert!(error.to_string().contains(CLASSIC_LIMIT_TEXT));

        let mut writer =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at()).expect("写入器");
        let error = writer
            .add_entry_with_size(
                &PackagePath::new("stream.bin").expect("合法"),
                u64::from(u32::MAX) + 1,
                &mut Cursor::new(Vec::new()),
            )
            .expect_err("分块条目越界必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_LIMIT_EXCEEDED);

        let long_name = format!("dir/{}/leaf.txt", "x".repeat(70_000));
        let path = PackagePath::new(&long_name).expect("长路径本身合法");
        let error = archive_total_size(&[(path.clone(), 1)]).expect_err("名字长度越界必须拒绝");
        assert!(error.to_string().contains("65535"));
        let mut writer =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at()).expect("写入器");
        let error = writer
            .add_entry(&path, b"x".as_slice())
            .expect_err("名字长度越界必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_LIMIT_EXCEEDED);
    }

    #[test]
    fn test_closed_form_entry_overhead_formula() {
        // 单条目开销 = 30 + 46 + 2·名字字节（本地头与中央目录各带一份名字）。
        assert_eq!(entry_overhead(0), 76);
        assert_eq!(entry_overhead(6), 88);
        let one = PackagePath::new("a.txt").expect("合法");
        assert_eq!(
            archive_total_size(&[(one, 5)]).expect("闭式和"),
            EOCD_SIZE + entry_overhead(5) + 5
        );
        assert_eq!(archive_total_size(&[]).expect("空集闭式和"), EOCD_SIZE);
    }

    #[test]
    fn test_empty_archive_writes_only_eocd() {
        let mut writer =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at()).expect("写入器");
        assert_eq!(writer.finish().expect("收尾"), EOCD_SIZE);
        let archive = writer.into_inner().into_inner();
        assert_eq!(archive.len(), EOCD_SIZE as usize);
        assert_eq!(&archive[0..4], b"PK\x05\x06");
    }

    #[test]
    fn test_finished_writer_refuses_further_writes() {
        // 收尾后二次 finish 与继续写成员都必须被防御臂拒绝。
        let mut writer =
            ZipArchiveWriter::new(Cursor::new(Vec::new()), saved_at()).expect("写入器");
        writer.finish().expect("首次收尾");
        let error = writer.finish().expect_err("二次收尾必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_IO);
        let error = writer
            .add_entry(
                &PackagePath::new("late.txt").expect("合法"),
                b"x".as_slice(),
            )
            .expect_err("收尾后写成员必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_IO);
    }

    /// 小端读 `u16`（断言用）。
    fn read_u16(bytes: &[u8], offset: usize) -> u16 {
        u16::from_le_bytes([bytes[offset], bytes[offset + 1]])
    }

    /// 小端读 `u32`（断言用）。
    fn read_u32(bytes: &[u8], offset: usize) -> u32 {
        u32::from_le_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ])
    }
}
