//! ULID 生成：48 位毫秒时间戳 + 80 位随机（进程内单调、同毫秒不重复）。

use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_MASK: u64 = 0xFFFF_FFFF_FFFF;
const SEQUENCE_MASK: u64 = 0xFFFF_FFFF_FFFF;

/// 当前 Unix 毫秒时间戳；系统时钟早于纪元时返回 0。
pub(crate) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/// 单调 ULID 生成器；每个内核实例持有一个。
#[derive(Debug)]
pub(crate) struct UlidGenerator {
    seed: u128,
    clock: Mutex<ClockState>,
}

/// 时钟与序号状态；二者必须作为同一临界区整体推进。
///
/// 拆成两个独立原子量时，「跨毫秒复位序号」与并发线程的 `fetch_add` 存在竞态：
/// 复位会抹掉同毫秒内已发出的序号，令后续生成复用同一 `(毫秒, 序号)` 组合，
/// 直接破坏 §8.1 的事件 ID 唯一性。序号改为全程不回绕复位后，
/// `(有效毫秒, 序号)` 在 48 位序号空间内天然唯一。
#[derive(Debug, Default)]
struct ClockState {
    /// 已发出的最大有效毫秒；时间回拨时沿用该值。
    last_ms: u64,
    /// 全程递增的序号低 48 位。
    sequence: u64,
}

impl UlidGenerator {
    /// 创建生成器；随机种子来自进程随机哈希。
    pub(crate) fn new() -> Self {
        let mut hasher = RandomState::new().build_hasher();
        hasher.write_u128(0x9E37_79B9_7F4A_7C15_1234_5678_9ABC_DEF0);
        let low = u128::from(hasher.finish());
        hasher.write_u64(0xDEAD_BEEF_CAFE_F00D);
        let high = u128::from(hasher.finish());
        Self {
            seed: (high << 64) | low,
            clock: Mutex::new(ClockState::default()),
        }
    }

    /// 生成一个 ULID 字符串（26 字符，Crockford Base32）。
    ///
    /// 时间戳部分保证跨毫秒单调；同一有效毫秒内随机基值不变、序号递增，
    /// 因此进程内严格单调（含任意线程并发调用）。时间回拨时沿用上次时钟并
    /// 继续递增序号。
    pub(crate) fn generate(&self, now_ms: u64) -> String {
        let timestamp = now_ms & TIME_MASK;
        let (effective_ms, sequence) = {
            // 临界区内只有整数运算，不嵌套任何内核状态锁（《薯片内核设计》§10.3）。
            // 中毒锁由本模块自身的 panic 造成，状态仍是合法的 `(毫秒, 序号)` 对，
            // 取回内部值继续递增即可，不得让事件发布路径因上游 panic 而中断。
            let mut clock = self
                .clock
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let effective_ms = timestamp.max(clock.last_ms);
            clock.last_ms = effective_ms;
            clock.sequence = clock.sequence.wrapping_add(1) & SEQUENCE_MASK;
            (effective_ms, clock.sequence)
        };

        let mut encoded = String::with_capacity(26);
        encode_base32(u128::from(effective_ms) << 2, 10, &mut encoded);
        let mixed = random80(self.seed, effective_ms) | u128::from(sequence);
        encode_base32(mixed, 16, &mut encoded);
        encoded
    }
}

/// 生成 80 位随机基值：同一 `(seed, ms)` 结果恒定，低 48 位清零供序号填充。
///
/// 序号填充后再编码，保证同一有效毫秒内 ULID 严格递增；序号的 48 位空间
/// 在单毫秒内不可能耗尽。
fn random80(seed: u128, ms: u64) -> u128 {
    let mut value = seed ^ (u128::from(ms) << 64);
    value = value.wrapping_mul(0x9E37_79B9_7F4A_7C15_9E37_79B9_7F4A_7C15);
    value ^= value >> 79;
    value = value.wrapping_mul(0xBF58_476D_1CE4_E5B9_BF58_476D_1CE4_E5B9);
    value ^= value >> 47;
    value & !u128::from(SEQUENCE_MASK)
}

fn encode_base32(mut value: u128, chars: usize, output: &mut String) {
    let mut buffer = [0_u8; 26];
    debug_assert!(chars <= buffer.len());
    for index in (0..chars).rev() {
        buffer[index] = ALPHABET[(value & 31) as usize];
        value >>= 5;
    }
    for byte in &buffer[..chars] {
        output.push(char::from(*byte));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn test_ulid_format() {
        let generator = UlidGenerator::new();
        let id = generator.generate(1_725_000_000_000);
        assert_eq!(id.len(), 26);
        assert!(id
            .bytes()
            .all(|byte| ALPHABET.contains(&byte) && byte != b'I' && byte != b'O' && byte != b'U'));
    }

    #[test]
    fn test_ulid_unique_within_same_millisecond() {
        let generator = UlidGenerator::new();
        let mut seen = HashSet::new();
        for _ in 0..10_000 {
            assert!(seen.insert(generator.generate(1_725_000_000_000)));
        }
    }

    #[test]
    fn test_ulid_monotonic_within_same_millisecond() {
        let generator = UlidGenerator::new();
        let mut previous = generator.generate(1_725_000_000_000);
        for _ in 0..10_000 {
            let next = generator.generate(1_725_000_000_000);
            assert!(previous < next, "同毫秒内 ULID 应严格递增");
            previous = next;
        }
    }

    #[test]
    fn test_ulid_clock_regression_keeps_monotonic() {
        let generator = UlidGenerator::new();
        let first = generator.generate(1_725_000_000_100);
        let second = generator.generate(1_725_000_000_000);
        assert!(first < second, "时间回拨后仍应保持单调");
    }

    #[test]
    fn test_now_ms_is_reasonable() {
        assert!(now_ms() > 1_600_000_000_000);
    }

    #[test]
    fn test_ulid_is_unique_under_thread_contention() {
        // §10.1：事件 ID 由内核在任意线程补全；并发跨毫秒时 CAS 竞争不得产生
        // 重复或长度异常的事件 ID（同毫秒唯一性由序号原子递增保证）。
        use std::sync::{Arc, Barrier};

        const THREADS: usize = 8;
        const PER_THREAD: usize = 4_000;

        let generator = Arc::new(UlidGenerator::new());
        let start = Arc::new(Barrier::new(THREADS));
        let handles: Vec<_> = (0..THREADS)
            .map(|_| {
                let generator = Arc::clone(&generator);
                let start = Arc::clone(&start);
                std::thread::spawn(move || {
                    let mut ids = Vec::with_capacity(PER_THREAD);
                    start.wait();
                    for _ in 0..PER_THREAD {
                        ids.push(generator.generate(now_ms()));
                    }
                    ids
                })
            })
            .collect();

        let mut seen = HashSet::new();
        for handle in handles {
            for id in handle.join().expect("生成线程不应 panic") {
                assert_eq!(id.len(), 26, "ULID 长度必须固定为 26：{id}");
                assert!(seen.insert(id), "并发生成出现重复 ULID");
            }
        }
        assert_eq!(seen.len(), THREADS * PER_THREAD);
    }
}
