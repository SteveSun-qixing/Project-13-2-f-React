//! 纯 Rust DEFLATE（RFC 1951）解码器：ZIP Deflate 成员的读取侧支持。
//!
//! 依据《06-文档解析器设计》§3.3 与 §10.1：发布侧一律 Store，读取侧必须
//! 同时接受 Store 与 Deflate，「读取端不得因 Deflate 或 ZIP64 而拒绝本可
//! 正常打开的文档」。解析器只允许纯 Rust 依赖（工单015 工程口径），因此
//! 以自研解码器落地，不引入 `flate2` / `miniz_oxide`。
//!
//! 覆盖面：非压缩块（BTYPE 0）、固定哈夫曼块（BTYPE 1）、动态哈夫曼块
//! （BTYPE 2）与 LZ77 回溯复制；`BTYPE 3` 与任何位流越界、哈夫曼表不完整、
//! 距离超出已解码窗口的情形一律判定为归档非法。
//!
//! 安全边界：输出长度受调用方传入的中央目录声明尺寸与解压总量限额双重
//! 约束，畸形位流不会造成无界内存增长。

use crate::error::{DocumentError, Fatal};

/// 长度码 257..286 的基础值（下标为 `码 - 257`）。
const LENGTH_BASE: [u16; 29] = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
    163, 195, 227, 258,
];

/// 长度码的附加位数。
const LENGTH_EXTRA: [u8; 29] = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];

/// 距离码 0..30 的基础值。
const DISTANCE_BASE: [u16; 30] = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537,
    2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];

/// 距离码的附加位数。
const DISTANCE_EXTRA: [u8; 30] = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
    13,
];

/// 码长码的读取顺序（RFC 1951 §3.2.7）。
const CODE_LENGTH_ORDER: [usize; 19] = [
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

/// 块类型：非压缩。
const BLOCK_STORED: u32 = 0;
/// 块类型：固定哈夫曼。
const BLOCK_FIXED: u32 = 1;
/// 块类型：动态哈夫曼。
const BLOCK_DYNAMIC: u32 = 2;

/// 归档非法的便捷构造。
fn invalid(detail: impl Into<String>) -> DocumentError {
    DocumentError::ArchiveInvalid { message: detail.into() }
}

/// LSB 优先的位流读取器（RFC 1951 §3.1.1）。
struct BitReader<'a> {
    data: &'a [u8],
    /// 已消费的比特数。
    cursor: usize,
}

impl<'a> BitReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, cursor: 0 }
    }

    /// 读取单个比特。
    fn bit(&mut self) -> Fatal<u32> {
        let byte_index = self.cursor / 8;
        let Some(byte) = self.data.get(byte_index) else {
            return Err(invalid("Deflate 位流越界"));
        };
        let value = u32::from((byte >> (self.cursor % 8)) & 1);
        self.cursor += 1;
        Ok(value)
    }

    /// 读取 `count` 个比特（不超过 16 位，LSB 优先）。
    fn bits(&mut self, count: u8) -> Fatal<u32> {
        let mut value = 0u32;
        for index in 0..count {
            value |= self.bit()? << index;
        }
        Ok(value)
    }

    /// 丢弃当前字节剩余比特，对齐到字节边界。
    fn align(&mut self) {
        self.cursor = self.cursor.div_ceil(8) * 8;
    }

    /// 按字节读取原始数据（非压缩块使用）。
    fn bytes(&mut self, count: usize) -> Fatal<&'a [u8]> {
        self.align();
        let start = self.cursor / 8;
        let end = start.checked_add(count).ok_or_else(|| invalid("非压缩块长度溢出"))?;
        let slice = self
            .data
            .get(start..end)
            .ok_or_else(|| invalid("非压缩块数据越界"))?;
        self.cursor = end * 8;
        Ok(slice)
    }
}

/// 正则哈夫曼表（`puff` 口径：按码长计数 + 符号升序表）。
#[derive(Debug)]
struct Huffman {
    counts: [u16; 16],
    symbols: Vec<u16>,
}

impl Huffman {
    /// 由「符号 → 码长」表构建；码长为 0 表示该符号不在表内。
    ///
    /// 返回 `None` 表示表不可用（码长超上限或全表为空），调用方归一为
    /// 归档非法。
    fn new(lengths: &[u8]) -> Option<Self> {
        let mut counts = [0u16; 16];
        for length in lengths {
            if *length > 15 {
                return None;
            }
            counts[usize::from(*length)] += 1;
        }
        counts[0] = 0;
        let mut offsets = [0u16; 16];
        for length in 1..15 {
            offsets[length + 1] = offsets[length] + counts[length];
        }
        let total = usize::from(offsets[15] + counts[15]);
        let mut symbols = vec![0u16; lengths.len()];
        for (symbol, length) in lengths.iter().enumerate() {
            if *length > 0 {
                let slot = usize::from(offsets[usize::from(*length)]);
                symbols[slot] = u16::try_from(symbol).ok()?;
                offsets[usize::from(*length)] += 1;
            }
        }
        // 至少需要一个符号，否则位流无法推进（空表视为非法）。
        if total == 0 {
            return None;
        }
        Some(Self { counts, symbols })
    }

    /// 逐位解码一个符号。
    fn decode(&self, reader: &mut BitReader<'_>) -> Fatal<u16> {
        let mut code = 0i32;
        let mut first = 0i32;
        let mut index = 0i32;
        for length in 1..16 {
            code = (code << 1) | i32::try_from(reader.bit()?).map_err(|_| invalid("位流过大"))?;
            let count = i32::from(self.counts[length]);
            let limit = first + count;
            if code < limit {
                let position = usize::try_from(index + (code - first))
                    .map_err(|_| invalid("哈夫曼表索引异常"))?;
                return self
                    .symbols
                    .get(position)
                    .copied()
                    .ok_or_else(|| invalid("哈夫曼编码非法：符号缺失"));
            }
            index += count;
            first = limit;
        }
        Err(invalid("哈夫曼编码非法：码长超出 15 位"))
    }
}

/// 固定哈夫曼表（RFC 1951 §3.2.6）。
fn fixed_literal_table() -> Fatal<Huffman> {
    let mut lengths = [8u8; 288];
    lengths[..144].fill(8);
    lengths[144..256].fill(9);
    lengths[256..280].fill(7);
    lengths[280..].fill(8);
    // 长度 0 的槽位不存在于固定表定义中，全部符号均有码长。
    Huffman::new(&lengths).ok_or_else(|| invalid("固定字面量/长度表构建失败"))
}

/// 固定距离表：30 个码，全部 5 位。
fn fixed_distance_table() -> Fatal<Huffman> {
    Huffman::new(&[5u8; 30]).ok_or_else(|| invalid("固定距离表构建失败"))
}

/// 解码 Deflate 流；`expected_size` 为中央目录声明的解压尺寸，
/// `max_output` 为调用方限额上限（超出即 `DOCUMENT_LIMIT_EXCEEDED`）。
///
/// # Errors
///
/// - [`DocumentError::ArchiveInvalid`]：位流损坏、哈夫曼表不完整、
///   距离越窗或输出长度与声明不一致；
/// - [`DocumentError::LimitExceeded`]：输出超出 `max_output`。
pub(crate) fn inflate(input: &[u8], expected_size: u64, max_output: u64) -> Fatal<Vec<u8>> {
    let capacity = usize::try_from(expected_size.min(max_output))
        .map_err(|_| invalid("声明尺寸超出地址空间"))?;
    let mut output: Vec<u8> = Vec::with_capacity(capacity);
    let mut reader = BitReader::new(input);
    loop {
        let final_block = reader.bit()?;
        let block_type = reader.bits(2)?;
        match block_type {
            BLOCK_STORED => {
                let length = u16::try_from(reader.bits(16)?).map_err(|_| invalid("块长度溢出"))?;
                let stored = reader.bytes(usize::from(length))?;
                if u32::from(!0u16) != reader.bits(16)? {
                    return Err(invalid("非压缩块的反校验字段不匹配"));
                }
                push(&mut output, stored, max_output)?;
            }
            BLOCK_FIXED => {
                decode_block(
                    &mut reader,
                    &mut output,
                    &fixed_literal_table()?,
                    &fixed_distance_table()?,
                    max_output,
                )?;
            }
            BLOCK_DYNAMIC => {
                let (literal, distance) = read_dynamic_tables(&mut reader)?;
                decode_block(&mut reader, &mut output, &literal, &distance, max_output)?;
            }
            other => return Err(invalid(format!("保留的块类型 {other} 非法"))),
        }
        if final_block == 1 {
            break;
        }
    }
    if u64::try_from(output.len()).unwrap_or(u64::MAX) != expected_size {
        return Err(invalid(format!(
            "Deflate 解压尺寸 {} 与中央目录声明 {expected_size} 不一致",
            output.len()
        )));
    }
    Ok(output)
}

/// 追加输出并检查限额。
fn push(output: &mut Vec<u8>, bytes: &[u8], max_output: u64) -> Fatal<()> {
    let current = u64::try_from(output.len()).unwrap_or(u64::MAX);
    let next = current + u64::try_from(bytes.len()).unwrap_or(u64::MAX);
    if next > max_output {
        return Err(DocumentError::LimitExceeded {
            limit: "max_single_member_bytes",
            actual: format!("Deflate 解压输出 {next} 超出限额 {max_output}"),
            file: None,
        });
    }
    output.extend_from_slice(bytes);
    Ok(())
}

/// 读取动态哈夫曼表（RFC 1951 §3.2.7）。
fn read_dynamic_tables(reader: &mut BitReader<'_>) -> Fatal<(Huffman, Huffman)> {
    let literal_count = u32::from(reader.bits(5)?) + 257;
    let distance_count = u32::from(reader.bits(5)?) + 1;
    let code_length_count = u32::from(reader.bits(4)?) + 4;
    if literal_count > 288 || distance_count > 30 {
        return Err(invalid("动态哈夫曼表符号数超出上限"));
    }
    let mut code_lengths = [0u8; 19];
    for index in 0..code_length_count {
        let slot = CODE_LENGTH_ORDER[usize::try_from(index).map_err(|_| invalid("码长下标异常"))?];
        code_lengths[slot] = u8::try_from(reader.bits(3)?).map_err(|_| invalid("码长超出上限"))?;
    }
    let code_table = Huffman::new(&code_lengths).ok_or_else(|| invalid("码长表构建失败"))?;
    let total = usize::try_from(literal_count + distance_count).map_err(|_| invalid("符号总数溢出"))?;
    let mut lengths = vec![0u8; total];
    let mut index = 0usize;
    while index < total {
        let symbol = code_table.decode(reader)?;
        match symbol {
            0..=15 => {
                lengths[index] = u8::try_from(symbol).map_err(|_| invalid("码长超出上限"))?;
                index += 1;
            }
            16 => {
                if index == 0 {
                    return Err(invalid("码长重复指令缺少前值"));
                }
                let previous = lengths[index - 1];
                let repeat = 3 + usize::try_from(reader.bits(2)?).map_err(|_| invalid("重复位数异常"))?;
                fill(&mut lengths, &mut index, repeat, previous)?;
            }
            17 => {
                let repeat = 3 + usize::try_from(reader.bits(3)?).map_err(|_| invalid("重复位数异常"))?;
                fill(&mut lengths, &mut index, repeat, 0)?;
            }
            18 => {
                let repeat = 11 + usize::try_from(reader.bits(7)?).map_err(|_| invalid("重复位数异常"))?;
                fill(&mut lengths, &mut index, repeat, 0)?;
            }
            other => return Err(invalid(format!("码长符号 {other} 非法"))),
        }
    }
    let literal_slice = lengths
        .get(..usize::try_from(literal_count).map_err(|_| invalid("字面量表长度溢出"))?)
        .ok_or_else(|| invalid("字面量表缺失"))?;
    let distance_slice = lengths
        .get(usize::try_from(literal_count).map_err(|_| invalid("距离表起点溢出"))?..)
        .ok_or_else(|| invalid("距离表缺失"))?;
    // 全零距离表是合法输入（块内不使用距离码），补一个占位符号避免空表。
    let distance_table = if distance_slice.iter().all(|length| *length == 0) {
        let mut padded = distance_slice.to_vec();
        padded[0] = 1;
        Huffman::new(&padded)
    } else {
        Huffman::new(distance_slice)
    }
    .ok_or_else(|| invalid("距离表构建失败"))?;
    let literal_table =
        Huffman::new(literal_slice).ok_or_else(|| invalid("字面量表构建失败"))?;
    Ok((literal_table, distance_table))
}

/// 执行码长重复填充。
fn fill(lengths: &mut [u8], index: &mut usize, repeat: usize, value: u8) -> Fatal<()> {
    for _ in 0..repeat {
        let slot = lengths.get_mut(*index).ok_or_else(|| invalid("码长填充越界"))?;
        *slot = value;
        *index += 1;
    }
    Ok(())
}

/// 解码一个压缩块。
fn decode_block(
    reader: &mut BitReader<'_>,
    output: &mut Vec<u8>,
    literal_table: &Huffman,
    distance_table: &Huffman,
    max_output: u64,
) -> Fatal<()> {
    loop {
        let symbol = literal_table.decode(reader)?;
        match symbol {
            0..=255 => push(output, &[u8::try_from(symbol).unwrap_or(0)], max_output)?,
            256 => return Ok(()),
            257..=285 => {
                let index = usize::from(symbol) - 257;
                let length = u64::from(LENGTH_BASE[index])
                    + u64::from(reader.bits(LENGTH_EXTRA[index])?);
                let distance_symbol = distance_table.decode(reader)?;
                let distance = read_distance(reader, distance_symbol)?;
                copy_back(output, length, distance, max_output)?;
            }
            other => return Err(invalid(format!("字面量/长度码 {other} 非法"))),
        }
    }
}

/// 读取并校验回溯距离。
fn read_distance(reader: &mut BitReader<'_>, symbol: u16) -> Fatal<u64> {
    let index = usize::from(symbol);
    let base = *DISTANCE_BASE
        .get(index)
        .ok_or_else(|| invalid(format!("距离码 {symbol} 非法")))?;
    Ok(u64::from(base) + u64::from(reader.bits(DISTANCE_EXTRA[index])?))
}

/// LZ77 回溯复制：逐字节复制以覆盖重叠区间（RLE 式扩展）。
fn copy_back(output: &mut Vec<u8>, length: u64, distance: u64, max_output: u64) -> Fatal<()> {
    let current = u64::try_from(output.len()).unwrap_or(u64::MAX);
    let Some(start) = current.checked_sub(distance) else {
        return Err(invalid("回溯距离超出已解码窗口"));
    };
    let start = usize::try_from(start).map_err(|_| invalid("回溯起点超出地址空间"))?;
    if start >= output.len() {
        return Err(invalid("回溯起点越界"));
    }
    let length = usize::try_from(length).map_err(|_| invalid("复制长度超出地址空间"))?;
    let projected = u64::try_from(output.len() + length).unwrap_or(u64::MAX);
    if projected > max_output {
        return Err(DocumentError::LimitExceeded {
            limit: "max_single_member_bytes",
            actual: format!("Deflate 解压输出 {projected} 超出限额 {max_output}"),
            file: None,
        });
    }
    for offset in 0..length {
        let byte = output[start + offset];
        output.push(byte);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::DOCUMENT_LIMIT_EXCEEDED;

    /// 「三个字母重复」的动态块样例，由 `zlib.compressobj(9, DEFLATED, -15)`
    /// 生成后以十六进制入库，保证测试数据与实现解耦。
    const SAMPLE_DYNAMIC: &str = "4bcec82c882f2e49cc4b492c4a298e2f4b2d2acecccfb3525032d433d03350e24a060ac767a60005120d9d8c928d5d4c524d95b800";
    const SAMPLE_TEXT: &str = "chip_standards_version: \"1.0.0\"\ncard_id: \"a1B2c3D4e5\"\n";

    fn hex_to_bytes(text: &str) -> Vec<u8> {
        (0..text.len())
            .step_by(2)
            .map(|index| u8::from_str_radix(&text[index..index + 2], 16).expect("十六进制夹具"))
            .collect()
    }

    #[test]
    fn test_inflate_dynamic_sample() {
        let decoded = inflate(&hex_to_bytes(SAMPLE_DYNAMIC), SAMPLE_TEXT.len() as u64, 1 << 20)
            .expect("动态块必须可解");
        assert_eq!(decoded, SAMPLE_TEXT.as_bytes());
    }

    #[test]
    fn test_inflate_stored_block() {
        // 手工构造非压缩块：BFINAL=1 · BTYPE=00 · LEN=3 · NLEN=~3 · "abc"。
        let mut input = vec![0x01, 0x03, 0x00, 0xFC, 0xFF, b'a', b'b', b'c'];
        assert_eq!(inflate(&input, 3, 64).expect("非压缩块"), b"abc");
        input[2] = 0x04;
        assert!(matches!(
            inflate(&input, 4, 64),
            Err(DocumentError::ArchiveInvalid { .. })
        ));
    }

    #[test]
    fn test_inflate_fixed_huffman_block() {
        // 空输入 + 固定块 EOB：BFINAL=1,BTYPE=01,然后 7 位码 0000000（符号 256）。
        let input = [0b0000_0101u8, 0b1000_0000u8];
        let decoded = inflate(&input, 0, 64).expect("固定块空输出");
        assert!(decoded.is_empty());
    }

    #[test]
    fn test_inflate_rejects_reserved_block_type() {
        // BFINAL=1, BTYPE=11 → 保留块类型。
        let error = inflate(&[0b0000_0111u8], 0, 64).expect_err("保留块类型必须拒绝");
        assert!(matches!(error, DocumentError::ArchiveInvalid { .. }));
    }

    #[test]
    fn test_inflate_rejects_truncated_stream() {
        let bytes = hex_to_bytes(SAMPLE_DYNAMIC);
        let error = inflate(&bytes[..bytes.len() / 2], SAMPLE_TEXT.len() as u64, 1 << 20)
            .expect_err("截断位流必须拒绝");
        assert!(matches!(error, DocumentError::ArchiveInvalid { .. }));
    }

    #[test]
    fn test_inflate_rejects_size_mismatch() {
        let bytes = hex_to_bytes(SAMPLE_DYNAMIC);
        let error = inflate(&bytes, SAMPLE_TEXT.len() as u64 + 1, 1 << 20)
            .expect_err("尺寸不一致必须拒绝");
        assert!(matches!(error, DocumentError::ArchiveInvalid { .. }));
    }

    #[test]
    fn test_inflate_output_limit() {
        let bytes = hex_to_bytes(SAMPLE_DYNAMIC);
        let error = inflate(&bytes, SAMPLE_TEXT.len() as u64, 8).expect_err("超出限额必须拒绝");
        assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
    }

    #[test]
    fn test_huffman_rejects_empty_table() {
        assert!(Huffman::new(&[0u8; 8]).is_none(), "空表必须判定为不可用");
        assert!(Huffman::new(&[16u8; 8]).is_none(), "码长超上限必须判定为不可用");
    }
}
