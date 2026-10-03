//! 文档成员 ID 生成（《05-ID生成规范》§二/§三/§四）。
//!
//! 四类文件级标识（`card_id` / `box_id` / 内容节点 ID / 条目 `entry_id`）共用
//! 同一字符集、文法与生成算法；生成方 = 文档服务 Rust 核心受控写口（§四），
//! 编辑引擎、插件与外部调用方不得指定、覆盖或拼装 ID。
//!
//! # 文法与字符集（§二）
//!
//! 恒为 **10 字符 Base62**，文法 `^[0-9A-Za-z]{10}$`（字符集 `0-9`、`a-z`、
//! `A-Z`，大小写敏感；允许前导 `0` 与数字开头；禁止类型前缀、分隔符、校验位
//! 等任何结构）。产物全流程按原样字符串处理，不做大小写归一化——唯一例外是
//! 查重环节按**大小写不敏感等价口径**执行（§二.6：节点 ID 直接进入文件名，
//! 大小写不敏感文件系统上映射同一路径，生成与校验必须按该口径查重）。
//!
//! # 生成算法（§三）
//!
//! - **随机性**：正式链路随机源为 OS 熵源的 CSPRNG（`getrandom` 族，
//!   §三.1.1），经 [`OsRandomSource`] 承载；禁止时间戳、自增计数、机器标识、
//!   进程信息等任何可推导成分参与生成或派生（§三.1.3）。
//! - **均匀无偏**：字节 → 62 索引采用拒绝采样（§三.1.2）——仅接受
//!   `b < 248`（248 = 4 × 62）的字节并取 `b % 62`，拒绝 248–255 后重取；
//!   禁止直接 `byte % 62`（256 不能被 62 整除，产生取模偏差）。
//! - **测试注入**：正式链路不提供可配置随机种子；生成实现以 [`IdRandomSource`]
//!   承载随机源抽象，测试可经 [`generate_member_id_with`] 注入确定性源产生
//!   可复现夹具（§三.1.4），夹具不进入正式文档、正式包或发布产物。
//!
//! # 唯一性与作用域查重（§三.2、§六.1）
//!
//! 唯一性由随机空间（62¹⁰ ≈ 8.39×10¹⁷）+ 作用域查重 + 冲突检测共同保证，
//! 不使用中心化发号服务。生成方必须在目标作用域已知的标识集合内查重后再
//! 接受：调用方传入 `exclude`（当前受控写口已知文档标识集合 / 卡内节点集合 /
//! 箱内条目集合），命中即丢弃并重新生成，不覆盖、不改写既有 ID（§三.2.3、
//! §六.1）。生成是纯内存行为，失败不产生半成品文件；落盘原子性由文档服务
//! 受控提交保证。ID 相关错误码不新增（§7.3）：熵源不可用归一在册兜底码
//! `RESOURCE_INTERNAL`；格式校验复用解析链既有校验点
//! （`chips_parser::schema::is_base62_id`），本模块不新增第二套校验器（§7.1）。

use std::collections::HashSet;

use crate::{error::ResourceError, ResourceResult};

/// 文档成员 ID 固定长度：10 字符（§二.1）。
pub const MEMBER_ID_LENGTH: usize = 10;

/// Base62 字符表（§二.1 在册列出序：`0-9`、`a-z`、`A-Z`；索引 → 字符的排列
/// 顺序不影响均匀性不变量，本表按规范列出序钉死并由测试锁定）。
const BASE62_CHARSET: [u8; 62] = *b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// 拒绝采样接受上界：248 = 4 × 62（§三.1.2 在册判例值；仅接受 `b < 248`，
/// 拒绝 248–255 后重取）。
const REJECTION_BOUND: u8 = 4 * 62;

const _: () = {
    assert!(MEMBER_ID_LENGTH == 10, "成员 ID 恒为 10 字符（§二.1）");
    assert!(
        REJECTION_BOUND == 248,
        "拒绝采样上界必须恰为 4 × 62（§三.1.2）"
    );
    assert!(BASE62_CHARSET.len() == 62, "Base62 字符表必须恰为 62 字符");
};

/// 随机字节源抽象（§三.1 随机性口径的承载形）。
///
/// 正式链路唯一在册实现为 [`OsRandomSource`]（OS 熵源 CSPRNG）；测试经
/// [`generate_member_id_with`] 注入确定性实现产生可复现夹具（§三.1.4）。
pub trait IdRandomSource {
    /// 用随机字节填充 `dest`。
    ///
    /// # Errors
    ///
    /// 熵源不可用时归一返回在册兜底码 `RESOURCE_INTERNAL`（§7.3：ID 相关
    /// 错误码不新增，无 details）。
    fn fill_bytes(&mut self, dest: &mut [u8]) -> Result<(), ResourceError>;
}

/// OS 熵源随机源（§三.1.1 在册正式随机源：`getrandom` 族 OS 随机接口）。
///
/// 不混入时间戳、计数器、机器标识等任何可推导成分（§三.1.3、§五）。
#[derive(Debug, Clone, Copy, Default)]
pub struct OsRandomSource;

impl IdRandomSource for OsRandomSource {
    fn fill_bytes(&mut self, dest: &mut [u8]) -> Result<(), ResourceError> {
        // getrandom 失败（OS 熵源不可用）属未归一异常，归一在册兜底码；
        // 错误细节不外泄（ResourceError::Internal 无 details，《06》§7.3）。
        getrandom::fill(dest).map_err(|_| ResourceError::Internal)
    }
}

/// 从随机源抽取一个文法合轨的 10 字符 Base62 候选（拒绝采样逐字符去偏）。
fn draw_member_id(source: &mut impl IdRandomSource) -> ResourceResult<String> {
    let mut id = [0u8; MEMBER_ID_LENGTH];
    let mut filled = 0;
    while filled < MEMBER_ID_LENGTH {
        let mut draw = [0u8; 1];
        source.fill_bytes(&mut draw)?;
        // 拒绝采样（§三.1.2）：仅接受 b < 248 并取 b % 62，248–255 重取；
        // 索引恒 ≤ 61 < 62，字符表取值为构造性不变量（无越界路径）。
        if draw[0] < REJECTION_BOUND {
            id[filled] = BASE62_CHARSET[usize::from(draw[0] % 62)];
            filled += 1;
        }
    }
    // 字节恒取自在册字符表（纯 ASCII），逐字节转字符恒无损。
    Ok(id.iter().map(|&byte| char::from(byte)).collect())
}

/// 生成 10 字符 Base62 文档成员 ID 并在排除集内查重（正式链路入口）。
///
/// 随机源为 OS 熵源 CSPRNG（[`OsRandomSource`]）；生成后对 `exclude`
/// （目标作用域已知标识集合：`card_id` / `box_id` 对当前受控写口已知文档
/// 标识全集，节点 / 条目 ID 对所在卡片 / 箱子成员集合）按**大小写不敏感
/// 等价口径**查重（§二.6、§三.2.3、§六.1），命中即丢弃重生成，不覆盖、
/// 不改写既有 ID。`exclude` 仅作查重输入，不要求元素本身过文法校验
/// （非 ID 元素永不命中、无害）。排除集是有限集而 ID 空间为 62¹⁰，循环
/// 以概率 1 终止。
///
/// # Errors
///
/// OS 熵源不可用时返回在册兜底码 `RESOURCE_INTERNAL`。
pub fn generate_member_id(exclude: &[String]) -> ResourceResult<String> {
    generate_member_id_with(&mut OsRandomSource, exclude)
}

/// [`generate_member_id`] 的随机源注入形（§三.1.4 测试注入口径）。
///
/// 生成与查重语义与正式入口完全一致，仅随机源由调用方交付；确定性源仅供
/// 测试产生可复现夹具，不进入正式链路。
///
/// # Errors
///
/// 随机源 [`IdRandomSource::fill_bytes`] 失败时原样透传其归一错误。
pub fn generate_member_id_with(
    source: &mut impl IdRandomSource,
    exclude: &[String],
) -> ResourceResult<String> {
    // 排除集折叠为 ASCII 小写等价集：候选恒为纯 ASCII Base62，ASCII 小写
    // 折叠即大小写不敏感等价全集（§二.6 文件系统等价口径的精确形态）。
    let blocked: HashSet<String> = exclude.iter().map(|id| id.to_ascii_lowercase()).collect();
    loop {
        let candidate = draw_member_id(source)?;
        if !blocked.contains(&candidate.to_ascii_lowercase()) {
            return Ok(candidate);
        }
        // 命中即丢弃重生成（§三.2.3 / §六.1）：不覆盖、不改写既有 ID。
    }
}

#[cfg(test)]
mod tests {
    use chips_parser::schema::is_base62_id;

    use super::*;
    use crate::error::RESOURCE_INTERNAL;

    /// 预定字节序列源：按序出队、取尽回绕（确定性夹具，§三.1.4）。
    struct ScriptedSource {
        bytes: Vec<u8>,
        cursor: usize,
    }

    impl ScriptedSource {
        fn new(bytes: Vec<u8>) -> Self {
            Self { bytes, cursor: 0 }
        }
    }

    impl IdRandomSource for ScriptedSource {
        fn fill_bytes(&mut self, dest: &mut [u8]) -> Result<(), ResourceError> {
            for slot in dest {
                *slot = self.bytes[self.cursor % self.bytes.len()];
                self.cursor += 1;
            }
            Ok(())
        }
    }

    /// 恒错源：熵源不可用臂夹具。
    struct FailingSource;

    impl IdRandomSource for FailingSource {
        fn fill_bytes(&mut self, _dest: &mut [u8]) -> Result<(), ResourceError> {
            Err(ResourceError::Internal)
        }
    }

    /// 全域循环源：0…255 循环供数（字节层面精确均匀，映射层均匀性粗检输入）。
    struct CyclingSource(u8);

    impl IdRandomSource for CyclingSource {
        fn fill_bytes(&mut self, dest: &mut [u8]) -> Result<(), ResourceError> {
            for slot in dest {
                *slot = self.0;
                self.0 = self.0.wrapping_add(1);
            }
            Ok(())
        }
    }

    /// "a1B2c3D4e5" 各字符的字符表索引（a=10、1=1、B=37、2=2、c=12、3=3、
    /// D=39、4=4、e=14、5=5）；夹具以「字节值 = 期望索引」构造确定性序列。
    const SAMPLE_ID_BYTES: [u8; 10] = [10, 1, 37, 2, 12, 3, 39, 4, 14, 5];

    /// "a1B2c3D4e5"：混合大小写 + 数字开段邻位的文法夹具值。
    const SAMPLE_ID: &str = "a1B2c3D4e5";

    #[test]
    fn test_os_source_ids_match_grammar_and_charset() {
        // 正式入口产物逐一过权威校验器（chips-parser `is_base62_id` 单源，
        // §7.1 不新增第二套校验器），长度与字符集全带内。
        let mut seen = HashSet::new();
        for _ in 0..256 {
            let id = generate_member_id(&[]).expect("OS 熵源生成必须成功");
            assert_eq!(id.len(), MEMBER_ID_LENGTH, "长度恒 10：{id}");
            assert!(is_base62_id(&id), "产物必须过权威 Base62 文法：{id}");
            assert!(id.bytes().all(|byte| BASE62_CHARSET.contains(&byte)));
            seen.insert(id);
        }
        assert!(
            seen.len() > 250,
            "连续生成不得重复（62¹⁰ 空间），实得 {}",
            seen.len()
        );
    }

    #[test]
    fn test_os_source_uniformity_rough_check_large_sample() {
        // 大样本粗检（§三.1.2 均匀无偏）：每字符期望占比 1/62，±10% 带宽
        // ≈ 7σ（均匀源越界概率 ~1e-11/字符），系统性取模偏差（+21%）必越带。
        const SAMPLE_IDS: usize = 30_000;
        let mut counts = [0usize; 62];
        for _ in 0..SAMPLE_IDS {
            let id = generate_member_id(&[]).expect("OS 熵源生成必须成功");
            for byte in id.bytes() {
                let index = BASE62_CHARSET
                    .iter()
                    .position(|&candidate| candidate == byte)
                    .expect("产物字符必须在册字符表内");
                counts[index] += 1;
            }
        }
        let expected = SAMPLE_IDS * MEMBER_ID_LENGTH / 62;
        let tolerance = expected / 10;
        for (index, &count) in counts.iter().enumerate() {
            assert!(
                count.abs_diff(expected) <= tolerance,
                "字符 {} 频数 {count} 越出 ±10% 带（期望 {expected}）",
                char::from(BASE62_CHARSET[index])
            );
        }
        assert_eq!(counts.iter().sum::<usize>(), SAMPLE_IDS * MEMBER_ID_LENGTH);
    }

    #[test]
    fn test_rejection_sampling_maps_uniform_bytes_exactly_uniformly() {
        // 映射层精确均匀锁：0…255 循环源下 248–255 被拒、0–247 等概率入射，
        // 24_800 个接受位 = 100 × 248，字符表每索引恰得 400 次（1/62 精确等分）。
        let mut source = CyclingSource(0);
        let mut counts = [0usize; 62];
        for _ in 0..2_480 {
            let id = generate_member_id_with(&mut source, &[]).expect("循环源恒成功");
            for byte in id.bytes() {
                let index = BASE62_CHARSET
                    .iter()
                    .position(|&candidate| candidate == byte)
                    .expect("产物字符必须在册字符表内");
                counts[index] += 1;
            }
        }
        assert!(
            counts.iter().all(|&count| count == 400),
            "拒绝采样映射必须精确均匀：{counts:?}"
        );
    }

    #[test]
    fn test_rejection_bound_bytes_are_redrawn_never_mapped() {
        // 边界字节（248–255）必须整字节丢弃重取：夹具逐位穿插边界字节，
        // 期望产物仅由接受位拼出（字节值 = 期望索引的构造性映射）。
        let script: Vec<u8> = SAMPLE_ID_BYTES
            .iter()
            .flat_map(|&accepted| [248 + (accepted % 8), accepted])
            .collect();
        let mut source = ScriptedSource::new(script);
        let id = generate_member_id_with(&mut source, &[]).expect("脚本源恒成功");
        assert_eq!(id, SAMPLE_ID, "边界字节必须被拒收重取，产物仅由接受位构成");
    }

    #[test]
    fn test_scripted_source_is_deterministic_and_replayable() {
        // 确定性注入（§三.1.4）：同序夹具两次独立生成产物逐字相同；
        // 同源顺序推进产物可手工预算（0–9 → '0'…'9'，10–19 → 'a'…'j'）。
        let mut first = ScriptedSource::new((0..62).collect());
        let mut second = ScriptedSource::new((0..62).collect());
        let replay_a = generate_member_id_with(&mut first, &[]).expect("脚本源恒成功");
        let replay_b = generate_member_id_with(&mut second, &[]).expect("脚本源恒成功");
        assert_eq!(replay_a, "0123456789");
        assert_eq!(replay_a, replay_b, "同序确定性源必须产出逐字相同 ID");
        let advanced = generate_member_id_with(&mut first, &[]).expect("脚本源恒成功");
        assert_eq!(advanced, "abcdefghij", "同源推进必须落在可预算的下一产物");
        assert!(is_base62_id(&replay_a) && is_base62_id(&advanced));
    }

    #[test]
    fn test_exclusion_hit_regenerates_and_miss_accepts() {
        // 查重重生成（§三.2.3 / §六.1）：首候选命中排除集 → 丢弃重取下一候选；
        // 未命中排除集 → 首候选原样接受（大小写精确保持）。
        let mut script = SAMPLE_ID_BYTES.to_vec();
        script.extend_from_slice(&[61; 10]); // 次候选 "ZZZZZZZZZZ"
        let mut hit = ScriptedSource::new(script.clone());
        let regenerated =
            generate_member_id_with(&mut hit, &["A1B2C3D4E5".to_owned()]).expect("脚本源恒成功");
        assert_eq!(regenerated, "ZZZZZZZZZZ", "首候选大小写等价命中必须重生成");
        let mut miss = ScriptedSource::new(script);
        let accepted =
            generate_member_id_with(&mut miss, &["0000000000".to_owned()]).expect("脚本源恒成功");
        assert_eq!(accepted, SAMPLE_ID, "未命中必须原样接受首候选");
    }

    #[test]
    fn test_case_insensitive_equivalence_dedup() {
        // 大小写不敏感等价查重（§二.6）：排除集与候选仅在字母大小写上不同
        // （任意混排形态）即命中重生成；全小写折叠对纯 ASCII 候选是精确等价。
        // 脚本携次段（"ZZZZZZZZZZ"），重生成落在后续候选上（夹具回绕前完成）。
        for excluded in ["a1B2c3D4e5", "A1B2C3D4E5", "A1b2C3d4E5", "a1b2c3d4e5"] {
            let mut script = SAMPLE_ID_BYTES.to_vec();
            script.extend_from_slice(&[61; 10]);
            let mut source = ScriptedSource::new(script);
            let id =
                generate_member_id_with(&mut source, &[excluded.to_owned()]).expect("脚本源恒成功");
            assert_ne!(
                id.to_ascii_lowercase(),
                excluded.to_ascii_lowercase(),
                "等价命中必须重生成：排除 {excluded}"
            );
            assert_eq!(
                id, "ZZZZZZZZZZ",
                "重生成产物来自次段候选（排除 {excluded}）"
            );
        }
    }

    #[test]
    fn test_entropy_failure_maps_to_registered_internal_code() {
        // 熵源不可用臂：归一在册兜底码 RESOURCE_INTERNAL（§7.3 禁新码），无 details。
        let error =
            generate_member_id_with(&mut FailingSource, &[]).expect_err("熵源不可用必须失败");
        assert!(matches!(error, ResourceError::Internal));
        assert_eq!(error.code(), RESOURCE_INTERNAL);
        assert!(error.details().is_none(), "兜底码不携 details");
    }

    #[test]
    fn test_scope_dedup_against_large_known_id_set() {
        // 受控写口作用域查重集成臂：以 OS 源滚动生成并逐轮把已产 ID 灌回
        // 排除集，产物永不命中（精确与大小写等价双口径）。
        let mut ledger: Vec<String> = Vec::new();
        for _ in 0..512 {
            let id = generate_member_id(&ledger).expect("OS 熵源生成必须成功");
            assert!(is_base62_id(&id), "产物必须过权威文法：{id}");
            let folded = id.to_ascii_lowercase();
            assert!(
                !ledger
                    .iter()
                    .any(|known| known.to_ascii_lowercase() == folded),
                "产物不得命中已知标识集（大小写不敏感等价口径）：{id}"
            );
            ledger.push(id);
        }
    }
}
