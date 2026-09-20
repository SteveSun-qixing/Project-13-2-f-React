//! 内部摘要工具：CRC32（IEEE 802.3 反射多项式）与 SHA-256（FIPS 180-4）。
//!
//! 两者都是纯 Rust 手写实现：解析器只允许 `chips-core` + `serde` 系既有
//! 依赖（《W2 金链路》工单015 工程约束），不引入 `zip` / `sha2` 等第三方
//! crate。用途：
//!
//! - CRC32：ZIP 中央目录成员校验（《06-文档解析器设计》§4.3）；
//! - SHA-256：`content_digest`、索引摘要与 `manifest.resources[].checksum`
//!   完整性校验（设计稿 §3.7、§6.4，《卡片文件格式》§5.1）。

/// CRC32 查表（多项式 0xEDB88320，与 ZIP PKZIP 口径一致）。
fn crc32_table() -> &'static [u32; 256] {
    static TABLE: std::sync::OnceLock<[u32; 256]> = std::sync::OnceLock::new();
    TABLE.get_or_init(|| {
        let mut table = [0u32; 256];
        for (index, entry) in table.iter_mut().enumerate() {
            let mut value = index as u32;
            for _ in 0..8 {
                value = if value & 1 != 0 {
                    (value >> 1) ^ 0xEDB8_8320
                } else {
                    value >> 1
                };
            }
            *entry = value;
        }
        table
    })
}

/// 计算字节串的 CRC32（ZIP 存储口径：初值 `!0`，末值取反）。
pub(crate) fn crc32(bytes: &[u8]) -> u32 {
    let table = crc32_table();
    let mut crc = !0u32;
    for byte in bytes {
        crc = (crc >> 8) ^ table[((crc ^ u32::from(*byte)) & 0xFF) as usize];
    }
    !crc
}

/// SHA-256 一轮常数（FIPS 180-4 §4.2.2）。
const SHA_K: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/// 流式 SHA-256 累加器；供 `content_digest` 与索引摘要分块喂入。
#[derive(Debug, Clone)]
pub(crate) struct Sha256 {
    state: [u32; 8],
    buffer: [u8; 64],
    buffered: usize,
    total_bytes: u64,
}

impl Sha256 {
    /// 新建累加器。
    pub(crate) fn new() -> Self {
        Self {
            // FIPS 180-4 §5.3.3 初始哈希值。
            state: [
                0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
                0x5be0cd19,
            ],
            buffer: [0u8; 64],
            buffered: 0,
            total_bytes: 0,
        }
    }

    /// 追加字节。
    pub(crate) fn update(&mut self, mut bytes: &[u8]) {
        self.total_bytes = self.total_bytes.wrapping_add(bytes.len() as u64);
        if self.buffered > 0 {
            let need = 64 - self.buffered;
            let take = need.min(bytes.len());
            self.buffer[self.buffered..self.buffered + take].copy_from_slice(&bytes[..take]);
            self.buffered += take;
            bytes = &bytes[take..];
            if self.buffered == 64 {
                let block = self.buffer;
                compress(&mut self.state, &block);
                self.buffered = 0;
            }
        }
        while bytes.len() >= 64 {
            let (block, rest) = bytes.split_at(64);
            let mut buf = [0u8; 64];
            buf.copy_from_slice(block);
            compress(&mut self.state, &buf);
            bytes = rest;
        }
        if !bytes.is_empty() {
            self.buffer[..bytes.len()].copy_from_slice(bytes);
            self.buffered = bytes.len();
        }
    }

    /// 收尾并输出 32 字节摘要。
    pub(crate) fn finish(mut self) -> [u8; 32] {
        let bit_length = self.total_bytes.wrapping_mul(8);
        // FIPS 180-4 §4.1：追加 0x80 与若干 0x00，使总长在计入 64 位
        // 大端比特长度后恰好对齐到 64 字节块。
        let pad_len = if self.buffered < 56 { 56 - self.buffered } else { 120 - self.buffered };
        let mut chunk = vec![0u8; pad_len + 8];
        chunk[0] = 0x80;
        chunk[pad_len..].copy_from_slice(&bit_length.to_be_bytes());
        self.update_inner(&chunk);
        let mut out = [0u8; 32];
        for (index, word) in self.state.iter().enumerate() {
            out[index * 4..index * 4 + 4].copy_from_slice(&word.to_be_bytes());
        }
        out
    }

    /// 内部 update：不再累加 total_bytes（长度已定）。
    fn update_inner(&mut self, mut bytes: &[u8]) {
        if self.buffered > 0 {
            let need = 64 - self.buffered;
            let take = need.min(bytes.len());
            self.buffer[self.buffered..self.buffered + take].copy_from_slice(&bytes[..take]);
            self.buffered += take;
            bytes = &bytes[take..];
            if self.buffered == 64 {
                let block = self.buffer;
                compress(&mut self.state, &block);
                self.buffered = 0;
            }
        }
        while bytes.len() >= 64 {
            let (block, rest) = bytes.split_at(64);
            let mut buf = [0u8; 64];
            buf.copy_from_slice(block);
            compress(&mut self.state, &buf);
            bytes = rest;
        }
        if !bytes.is_empty() {
            self.buffer[..bytes.len()].copy_from_slice(bytes);
            self.buffered = bytes.len();
        }
    }
}

/// 单块压缩函数（FIPS 180-4 §4.1.1 / §6.2.2）。
fn compress(state: &mut [u32; 8], block: &[u8; 64]) {
    let mut w = [0u32; 64];
    for index in 0..16 {
        w[index] = u32::from_be_bytes([
            block[index * 4],
            block[index * 4 + 1],
            block[index * 4 + 2],
            block[index * 4 + 3],
        ]);
    }
    for index in 16..64 {
        let s0 = w[index - 15].rotate_right(7) ^ w[index - 15].rotate_right(18) ^ (w[index - 15] >> 3);
        let s1 = w[index - 2].rotate_right(17) ^ w[index - 2].rotate_right(19) ^ (w[index - 2] >> 10);
        w[index] = w[index - 16]
            .wrapping_add(s0)
            .wrapping_add(w[index - 7])
            .wrapping_add(s1);
    }
    let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut h] = *state;
    for index in 0..64 {
        let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
        let ch = (e & f) ^ ((!e) & g);
        let temp1 = h
            .wrapping_add(s1)
            .wrapping_add(ch)
            .wrapping_add(SHA_K[index])
            .wrapping_add(w[index]);
        let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let temp2 = s0.wrapping_add(maj);
        h = g;
        g = f;
        f = e;
        e = d.wrapping_add(temp1);
        d = c;
        c = b;
        b = a;
        // FIPS 180-4 §6.2.2 第 4h 步：a = T1 + T2（不含旧 a）。
        a = temp1.wrapping_add(temp2);
    }
    let deltas = [a, b, c, d, e, f, g, h];
    for (slot, delta) in state.iter_mut().zip(deltas) {
        *slot = slot.wrapping_add(delta);
    }
}

/// 一次性 SHA-256。
pub(crate) fn sha256(bytes: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.finish()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(bytes: &[u8; 32]) -> String {
        bytes.iter().map(|byte| format!("{byte:02x}")).collect()
    }

    #[test]
    fn test_crc32_known_vector() {
        // 「123456789」的 CRC-32/ISO-HDLC 标准检验值为 0xCBF43926。
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc32(b""), 0);
    }

    #[test]
    fn test_sha256_empty_vector() {
        assert_eq!(
            hex(&sha256(b"")),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn test_sha256_abc_vector() {
        assert_eq!(
            hex(&sha256(b"abc")),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn test_sha256_padding_second_block() {
        // 56 字节输入触发「padding 需要第二个 64 字节块」的边界路径；
        // 以分块喂入与一次性计算互验，锁死边界逻辑。
        let input = vec![b'a'; 56];
        let mut hasher = Sha256::new();
        for chunk in input.chunks(7) {
            hasher.update(chunk);
        }
        assert_eq!(hasher.finish(), sha256(&input));
    }

    #[test]
    fn test_sha256_streaming_matches_one_shot() {
        let payload: Vec<u8> = (0..500u32).map(|index| (index % 251) as u8).collect();
        let one_shot = sha256(&payload);
        let mut hasher = Sha256::new();
        for chunk in payload.chunks(37) {
            hasher.update(chunk);
        }
        assert_eq!(hasher.finish(), one_shot);
    }
}
