//! PathGuard：虚拟路径唯一校验入口与目录穿越防护（《04-资源管理设计》§9、《06-资源协议规范》§2.4/§9.1）。
//!
//! 校验顺序（§9.2、§5.1 流水线口径）：百分号解码仅一次 → UTF-8 → NFC 规范化 →
//! 控制字符 → 按 `/` 重新分段 → 段规则（空段、`.`、`..`）→ 平台特例（盘符、
//! ADS、设备名、尾随点与空格）→ 长度。任何快速路径都不得跳过解码与分段校验。

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::constants::ResourceLimits;
use crate::error::{PathErrorReason, ResourceError, ResourceResult};

/// 作用域内虚拟路径：`/` 分隔、无前导斜杠、NFC 规范化、已通过全部在册校验。
///
/// 内部持有解码后的路径文本；规范 URI 输出时按段重新百分号编码（《06》§2.6）。
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct VirtualPath(String);

impl VirtualPath {
    /// 校验并构造（PathGuard 唯一入口）。
    ///
    /// `raw` 为 URI 中作用域根之后的原始路径段文本（不含前导 `/`；前导 `/`
    /// 已在 URI 解析层按绝对路径拒绝）。`uri` 仅用于 `details` 定位。
    pub fn validate(raw: &str, uri: &str, limits: &ResourceLimits) -> ResourceResult<Self> {
        // 分隔符：反斜杠一律拒绝；UNC 形态（`\\server\share`）按绝对路径拒绝（《06》§2.4）。
        if raw.starts_with("\\\\") {
            return Err(ResourceError::PathInvalid {
                uri: uri.to_owned(),
                path: raw.to_owned(),
                reason: PathErrorReason::Absolute,
            });
        }
        if raw.contains('\\') {
            return Err(ResourceError::PathInvalid {
                uri: uri.to_owned(),
                path: raw.to_owned(),
                reason: PathErrorReason::Separator,
            });
        }
        // 长度（原始文本，URI 层已查总长，这里查路径长度）。
        if raw.len() > limits.max_path_bytes {
            return Err(ResourceError::PathInvalid {
                uri: uri.to_owned(),
                path: truncate_for_details(raw),
                reason: PathErrorReason::Length,
            });
        }
        // 百分号解码仅一次；非法 `%` 序列（非两位十六进制）属语法层
        // （《06》§2.6 `invalid_encoding`）；解码产物非合法 UTF-8 或含非字符/
        // 替换字符属 Unicode 触发臂（《06》§2.4 Unicode 行，工单042 裁定④，
        // 主智能体 2026-09-21 码归属更正：码走路径族 `RESOURCE_PATH_INVALID`、
        // `details.reason = unicode`，与 §7.3 `IResourcePathErrorDetails` 同表）。
        let decoded = match percent_decode_checked(raw) {
            Ok(decoded) => decoded,
            Err(PercentDecodeFailure::MalformedSequence) => {
                return Err(ResourceError::InvalidUri {
                    uri: uri.to_owned(),
                    reason: crate::error::UriErrorReason::InvalidEncoding,
                })
            }
            Err(PercentDecodeFailure::NotUnicode) => {
                return Err(ResourceError::PathInvalid {
                    uri: uri.to_owned(),
                    path: truncate_for_details(raw),
                    reason: PathErrorReason::Unicode,
                })
            }
        };
        if decoded.chars().any(is_forbidden_unicode) {
            return Err(ResourceError::PathInvalid {
                uri: uri.to_owned(),
                path: truncate_for_details(&decoded),
                reason: PathErrorReason::Unicode,
            });
        }
        // 解码后按 `/` 重新分段并重新执行全部校验（《06》§2.4 `encoding`）。
        if raw.len() != decoded.len() && decoded.len() > limits.max_path_bytes {
            return Err(ResourceError::PathInvalid {
                uri: uri.to_owned(),
                path: truncate_for_details(&decoded),
                reason: PathErrorReason::Length,
            });
        }
        if decoded.starts_with("\\\\") {
            return Err(ResourceError::PathInvalid {
                uri: uri.to_owned(),
                path: truncate_for_details(&decoded),
                reason: PathErrorReason::Absolute,
            });
        }
        if decoded.contains('\\') {
            return Err(ResourceError::PathInvalid {
                uri: uri.to_owned(),
                path: truncate_for_details(&decoded),
                reason: PathErrorReason::Separator,
            });
        }
        if decoded.starts_with('/') {
            return Err(ResourceError::PathInvalid {
                uri: uri.to_owned(),
                path: truncate_for_details(&decoded),
                reason: PathErrorReason::Absolute,
            });
        }
        // 控制字符：`\0` 与 U+0000–U+001F、U+007F（《06》§2.4）。
        if decoded.chars().any(is_control_char) {
            return Err(ResourceError::PathInvalid {
                uri: uri.to_owned(),
                path: truncate_for_details(&decoded),
                reason: PathErrorReason::Control,
            });
        }
        // NFC 规范化后校验与比较（《06》§2.4/§2.6）。
        let normalized = to_nfc(&decoded);
        if normalized.is_empty() {
            // 空路径只允许作为 resourceBase 基址；校验入口不收空串。
            return Err(ResourceError::PathInvalid {
                uri: uri.to_owned(),
                path: String::new(),
                reason: PathErrorReason::Segment,
            });
        }
        let mut segments: Vec<&str> = Vec::new();
        for segment in normalized.split('/') {
            if segment.is_empty() || segment == "." || segment == ".." {
                return Err(ResourceError::PathInvalid {
                    uri: uri.to_owned(),
                    path: truncate_for_details(&normalized),
                    reason: PathErrorReason::Segment,
                });
            }
            if segment.len() > limits.max_segment_bytes {
                return Err(ResourceError::PathInvalid {
                    uri: uri.to_owned(),
                    path: truncate_for_details(&normalized),
                    reason: PathErrorReason::Length,
                });
            }
            check_platform_segment(segment, &normalized, uri)?;
            segments.push(segment);
        }
        Ok(Self(segments.join("/")))
    }

    /// 直接以已验证文本构造（仅供本 crate 测试侧装配在册形态的测试替身；
    /// 生产路径一律经 [`VirtualPath::validate`] 全量校验后构造）。
    #[cfg(test)]
    pub(crate) fn from_validated(text: String) -> Self {
        Self(text)
    }

    /// 虚拟路径文本（解码、NFC 后）。
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// 段迭代器（`Iterator` 本身已是 `must_use`，不叠加标注）。
    pub fn segments(&self) -> impl Iterator<Item = &str> {
        self.0.split('/')
    }
}

/// 判定控制字符（U+0000–U+001F、U+007F）。
#[must_use]
pub fn is_control_char(c: char) -> bool {
    c < '\u{20}' || c == '\u{7F}'
}

/// NFC 规范化（《06》§2.4：NFC 规范化后校验与比较）。
#[must_use]
pub fn to_nfc(input: &str) -> String {
    let normalizer = icu_normalizer::ComposingNormalizer::new_nfc();
    if normalizer.is_normalized(input) {
        return input.to_owned();
    }
    normalizer.normalize(input).into_owned()
}

/// 百分号解码的失败类别（《06》§2.4/§2.6 两臂分流）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PercentDecodeFailure {
    /// `%` 后非两位十六进制、串尾截断等编码语法非法（`invalid_encoding`）。
    MalformedSequence,
    /// 解码字节序列不是合法 UTF-8（裸 `%FF`、overlong、代理区、越界码位等，
    /// 属 Unicode 触发臂，`details.reason = unicode`，《06》§2.4 / 工单042 裁定④）。
    NotUnicode,
}

/// 百分号解码仅一次并区分失败臂：语法非法与解码产物非合法 UTF-8 分开报告。
/// 解码成功后仍需对产物执行 [`is_forbidden_unicode`] 非字符检查（§2.4 Unicode 行）。
pub fn percent_decode_checked(input: &str) -> Result<String, PercentDecodeFailure> {
    if !input.contains('%') {
        return Ok(input.to_owned());
    }
    let bytes = input.as_bytes();
    let mut output: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' => {
                if index + 2 >= bytes.len() {
                    return Err(PercentDecodeFailure::MalformedSequence);
                }
                let hi = (bytes[index + 1] as char)
                    .to_digit(16)
                    .ok_or(PercentDecodeFailure::MalformedSequence)?;
                let lo = (bytes[index + 2] as char)
                    .to_digit(16)
                    .ok_or(PercentDecodeFailure::MalformedSequence)?;
                output.push((hi * 16 + lo) as u8);
                index += 3;
            }
            byte => {
                output.push(byte);
                index += 1;
            }
        }
    }
    // 解码产物必须是合法 UTF-8：Rust `from_utf8` 同步拒绝 overlong、
    // UTF-16 代理区编码与 U+10FFFF 之外的码位（Unicode 触发臂）。
    String::from_utf8(output).map_err(|_| PercentDecodeFailure::NotUnicode)
}

/// 判定 Unicode 触发臂禁止出现的码位（《06》§2.4 Unicode 行，工单042 裁定④细则）：
/// 替换字符 U+FFFD；非字符 U+FFFE/U+FFFF 与 U+nFFFE/U+nFFFF（n = 1..10，
/// 即平面 0–10 的 `xxFFFE`/`xxFFFF` 形态）。NFC 归一差异本身不在此列
/// （归一后校验与比较，永不因归一差异拒绝）。
#[must_use]
pub fn is_forbidden_unicode(c: char) -> bool {
    let code_point = c as u32;
    code_point == 0xFFFD || ((code_point & 0xFFFE) == 0xFFFE && (code_point >> 16) <= 10)
}

/// 百分号解码仅一次；非法序列（语法或产物非 UTF-8）返回 `None`。
/// 需要区分失败臂的调用方使用 [`percent_decode_checked`]。
#[must_use]
pub fn percent_decode_once(input: &str) -> Option<String> {
    percent_decode_checked(input).ok()
}

/// 规范 URI 输出的百分号编码：保留 RFC 3986 pchar 形态（unreserved 与
/// sub-delims 与 `:` `@`），其余字符按 UTF-8 字节大写十六进制编码。
/// `?` 与 `#` 属 URI 级边界字符、空格与 `%` 属规范冲突字符，一律编码
/// （《06》§2.5/§2.6：规范 URI 只含 ASCII，十六进制大写；字面 `?` 须为
/// `%3F`、`#` 须为 `%23`、空格须为 `%20`、`%` 须为 `%25`）。`/` 为段间
/// 分隔符保留字面：本函数按段调用（`to_canonical_string` 逐段编码后以
/// `/` 连接），段文本经 PathGuard 校验后必不含 `/`。
#[must_use]
pub fn canonical_percent_encode(input: &str) -> String {
    const RESERVED: &[u8] = b"!$&'()*+,;:@=/";
    let mut output = String::with_capacity(input.len());
    for byte in input.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                output.push(char::from(*byte));
            }
            other if RESERVED.contains(other) => {
                output.push(char::from(*other));
            }
            other => {
                output.push('%');
                output.push_str(&format!("{other:02X}"));
            }
        }
    }
    output
}

/// 段级平台特例校验（《04》§9.3、《06》§2.4 `platform`）：
/// 盘符、ADS（含 `:` 文件名）、设备名、尾随点与空格一律拒绝。
fn check_platform_segment(segment: &str, path: &str, uri: &str) -> ResourceResult<()> {
    let reject = |reason: PathErrorReason| ResourceError::PathInvalid {
        uri: uri.to_owned(),
        path: truncate_for_details(path),
        reason,
    };
    // Windows 盘符段（`C:` 前缀）按绝对路径拒绝；其余含 `:` 的文件名按 ADS 拒绝。
    if has_windows_drive_prefix(segment) {
        return Err(reject(PathErrorReason::Absolute));
    }
    if segment.contains(':') {
        return Err(reject(PathErrorReason::Platform));
    }
    if is_windows_device_name(segment) {
        return Err(reject(PathErrorReason::Platform));
    }
    if segment.ends_with('.') || segment.ends_with(' ') {
        return Err(reject(PathErrorReason::Platform));
    }
    Ok(())
}

/// 判定 `X:` 盘符段形态（单字母 + `:` 且其后无文件名部分；对解码后文本逐段
/// 检查，跨平台一律按绝对路径拒绝，《04》§9.3）。
#[must_use]
pub fn has_windows_drive_prefix(segment: &str) -> bool {
    let mut chars = segment.chars();
    matches!(chars.next(), Some(c) if c.is_ascii_alphabetic())
        && matches!(chars.next(), Some(':'))
        && chars.next().is_none()
}

/// 判定 Windows 保留设备名（大小写与扩展名变体一律拒绝，《04》§9.3
/// 「`CON`、`NUL`、`COM1`…」在册族的保守超集：`COM`/`LPT` + 1–3 位数字）。
#[must_use]
pub fn is_windows_device_name(segment: &str) -> bool {
    // 设备名判定忽略尾随点与扩展名（`nul.txt`、`con.` 同族拒绝）。
    let stem = segment
        .split('.')
        .next()
        .unwrap_or(segment)
        .to_ascii_uppercase();
    const RESERVED: [&str; 5] = ["CON", "PRN", "AUX", "NUL", "CLOCK$"];
    if RESERVED.contains(&stem.as_str()) {
        return true;
    }
    for prefix in ["COM", "LPT"] {
        if let Some(suffix) = stem.strip_prefix(prefix) {
            if !suffix.is_empty()
                && suffix.len() <= 3
                && suffix.bytes().all(|byte| byte.is_ascii_digit())
            {
                return true;
            }
        }
    }
    false
}

/// `details` 携带的违规路径文本限长（不放大诊断载荷）。
fn truncate_for_details(text: &str) -> String {
    const MAX: usize = 512;
    if text.len() <= MAX {
        return text.to_owned();
    }
    let mut end = MAX;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    text[..end].to_owned()
}

/// 目录态来源：把虚拟路径拼接到作用域根并校验仍在根内（组件语义，禁止字符串
/// 前缀比较，《04》§9.2）。符号链接指向根外一律拒绝：对最深存在的祖先路径
/// `canonicalize` 后再次验证仍在规范化根内。
pub fn resolve_within_root(root: &Path, virtual_path: &VirtualPath) -> ResourceResult<PathBuf> {
    let reject = |reason: PathErrorReason| ResourceError::PathInvalid {
        uri: String::new(),
        path: virtual_path.as_str().to_owned(),
        reason,
    };
    if virtual_path.as_str().is_empty() {
        return Err(reject(PathErrorReason::Segment));
    }
    let mut candidate = root.to_path_buf();
    for segment in virtual_path.segments() {
        candidate.push(segment);
    }
    // 词法组件语义根校验（防御性兜底：拼接产物必须以根为组件前缀）。
    if !candidate.starts_with(root) {
        return Err(reject(PathErrorReason::Symlink));
    }
    // 符号链接校验：规范化根必须可用（挂载前置条件），否则按内部错误收口。
    let canonical_root = std::fs::canonicalize(root).map_err(|_| ResourceError::Internal)?;
    // 自最深存在前缀开始规范化；不存在的前缀不约束（其符号链接在出现时才生效）。
    let mut probe: &Path = candidate.as_path();
    loop {
        if let Ok(canonical_probe) = std::fs::canonicalize(probe) {
            if !canonical_probe.starts_with(&canonical_root) {
                return Err(reject(PathErrorReason::Symlink));
            }
            return Ok(candidate);
        }
        match probe.parent() {
            Some(parent) if !parent.as_os_str().is_empty() => probe = parent,
            _ => return Err(ResourceError::Internal),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn limits() -> ResourceLimits {
        ResourceLimits {
            max_path_bytes: 64,
            max_segment_bytes: 16,
            ..ResourceLimits::default()
        }
    }

    fn validated(raw: &str) -> VirtualPath {
        VirtualPath::validate(raw, "chips-resource://card-1/x", &limits())
            .unwrap_or_else(|error| panic!("合法路径被拒绝 {raw}: {error}"))
    }

    fn reason(raw: &str) -> PathErrorReason {
        match VirtualPath::validate(raw, "chips-resource://card-1/x", &limits()) {
            Err(ResourceError::PathInvalid { reason, .. }) => reason,
            other => panic!("期望路径拒绝，实际 {other:?}"),
        }
    }

    #[test]
    fn test_plain_paths_pass() {
        assert_eq!(validated("images/photo.jpg").as_str(), "images/photo.jpg");
        assert_eq!(validated(".box/cover.html").as_str(), ".box/cover.html");
        // 解码一次的 `%2e%2e` 是字面段名的一部分，非穿越；内部持有解码形态文本。
        assert_eq!(validated("a/b/%2e%2e-x").as_str(), "a/b/..-x");
    }

    #[test]
    fn test_separator_rejected() {
        assert_eq!(reason("images\\photo.jpg"), PathErrorReason::Separator);
        assert_eq!(reason("a%5Cb"), PathErrorReason::Separator);
        // UNC 形态按绝对路径拒绝（§2.4 相对性行）。
        assert_eq!(reason("\\\\server\\share\\x"), PathErrorReason::Absolute);
        assert_eq!(reason("%2Fb"), PathErrorReason::Absolute);
    }

    #[test]
    fn test_segment_rules() {
        assert_eq!(reason("a//b"), PathErrorReason::Segment);
        assert_eq!(reason("./a"), PathErrorReason::Segment);
        assert_eq!(reason("a/../b"), PathErrorReason::Segment);
        assert_eq!(reason("a/.."), PathErrorReason::Segment);
        assert_eq!(reason("a/%2e%2e/b"), PathErrorReason::Segment);
        assert_eq!(reason("a/%2E%2E/b"), PathErrorReason::Segment);
    }

    #[test]
    fn test_double_encoding_is_literal_name() {
        // `%252e%252e` 解码一次得字面 `%2e%2e`，非穿越（《06》§2.7）。
        assert_eq!(validated("a/%252e%252e/b").as_str(), "a/%2e%2e/b");
    }

    #[test]
    fn test_control_characters_rejected() {
        assert_eq!(reason("a%00b"), PathErrorReason::Control);
        assert_eq!(reason("a%1fb"), PathErrorReason::Control);
        assert_eq!(reason("a%7fb"), PathErrorReason::Control);
    }

    #[test]
    fn test_platform_special_cases() {
        assert_eq!(reason("C:/Windows"), PathErrorReason::Absolute);
        assert_eq!(reason("c:ads.txt"), PathErrorReason::Platform);
        assert_eq!(reason("a/CON"), PathErrorReason::Platform);
        assert_eq!(reason("a/nul.txt"), PathErrorReason::Platform);
        assert_eq!(reason("a/com10"), PathErrorReason::Platform);
        assert_eq!(reason("file."), PathErrorReason::Platform);
        assert_eq!(reason("file "), PathErrorReason::Platform);
        assert_eq!(reason("a%3Ab"), PathErrorReason::Platform);
    }

    #[test]
    fn test_length_limits() {
        assert_eq!(reason(&"a".repeat(65)), PathErrorReason::Length);
        assert_eq!(reason(&"a".repeat(17)), PathErrorReason::Length);
    }

    #[test]
    fn test_nfc_normalization_applied() {
        // 「é」的组合形态（e + U+0301）NFC 归一为预组合形态。
        let combined = "caf\u{65}\u{301}/note.txt";
        let path = validated(combined);
        assert_eq!(path.as_str(), "caf\u{e9}/note.txt");
    }

    #[test]
    fn test_unicode_arm_invalid_utf8_rejected() {
        // 《06》§2.4 Unicode 行（工单042 裁定④，2026-09-21 码归属更正）：
        // 解码一次的字节序列非合法 UTF-8 → `RESOURCE_PATH_INVALID` +
        // `details.reason = unicode`。
        // 裸 %FF、overlong（%C0%AF）、UTF-16 代理区（%ED%A0%80）、越界码位（%F5…）。
        for raw in ["a%FFb", "a%C0%AFb", "a%ED%A0%80b", "a%F5%80%80%80b"] {
            let error = VirtualPath::validate(raw, "u", &limits()).expect_err("必须拒绝");
            assert_eq!(error.code(), crate::error::RESOURCE_PATH_INVALID, "{raw}");
            assert_eq!(
                error.details().expect("必须携带 details")["reason"],
                "unicode",
                "{raw}"
            );
        }
        // 非法 `%` 语法序列仍走 `invalid_encoding` 臂（段一分流不变）。
        let error = VirtualPath::validate("a%zz", "u", &limits()).expect_err("必须拒绝");
        assert_eq!(error.details().unwrap()["reason"], "invalid_encoding");
    }

    #[test]
    fn test_unicode_arm_noncharacters_rejected() {
        // 非字符与替换字符：U+FFFD（%EF%BF%BD）、U+FFFE（%EF%BF%BE）、
        // U+FFFF（%EF%BF%BF）、U+1FFFE/U+1FFFF（平面 1–10 同形态）。
        for raw in [
            "a%EF%BF%BDb",
            "a%EF%BF%BEb",
            "a%EF%BF%BFb",
            "a%F0%9F%BF%BEb",
            "a%F0%9F%BF%BFb",
            "a%F2%AF%BF%BFb",
        ] {
            let error = VirtualPath::validate(raw, "u", &limits()).expect_err("必须拒绝");
            assert_eq!(error.code(), crate::error::RESOURCE_PATH_INVALID, "{raw}");
            assert_eq!(
                error.details().expect("必须携带 details")["reason"],
                "unicode"
            );
        }
        // 字面（未编码）替换字符同样触发。
        let error = VirtualPath::validate("a\u{FFFD}b", "u", &limits()).expect_err("必须拒绝");
        assert_eq!(error.details().unwrap()["reason"], "unicode");
    }

    #[test]
    fn test_unicode_arm_nfc_difference_never_rejected() {
        // NFC 差异本身永不构成拒绝：等价异字节序形态双双通过且归一相等。
        let composed = validated("caf%C3%A9/note.txt");
        let decomposed = validated("cafe%CC%81/note.txt");
        assert_eq!(composed, decomposed);
        // 合法多字节（CJK）编码形态通过。
        assert_eq!(
            validated("%E7%AC%94%E8%AE%B0/%E6%8A%A5%E5%91%8A.card").as_str(),
            "笔记/报告.card"
        );
    }

    #[test]
    fn test_percent_decode_checked_arms() {
        assert_eq!(percent_decode_checked("a%41"), Ok("aA".into()));
        assert_eq!(
            percent_decode_checked("a%zz"),
            Err(PercentDecodeFailure::MalformedSequence)
        );
        assert_eq!(
            percent_decode_checked("%E8%90%AC"),
            Ok("萬".into()),
            "既有逐字行为不变"
        );
        assert_eq!(
            percent_decode_checked("%FF"),
            Err(PercentDecodeFailure::NotUnicode)
        );
        assert!(is_forbidden_unicode('\u{FFFD}'));
        assert!(is_forbidden_unicode('\u{FFFE}'));
        assert!(is_forbidden_unicode('\u{FFFF}'));
        assert!(is_forbidden_unicode('\u{1FFFE}'));
        assert!(is_forbidden_unicode('\u{AFFFF}'));
        assert!(!is_forbidden_unicode('é'));
        assert!(!is_forbidden_unicode('\u{FDD0}'));
    }

    #[test]
    fn test_invalid_percent_encoding_is_uri_error() {
        let error = VirtualPath::validate("a%zz", "u", &limits()).expect_err("非法编码必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_INVALID_URI);
        assert_eq!(
            error.details().expect("必须携带 details")["reason"],
            "invalid_encoding"
        );
    }

    #[test]
    fn test_percent_decode_and_encode_helpers() {
        assert_eq!(percent_decode_once("a%2Fb"), Some("a/b".into()));
        assert_eq!(percent_decode_once("%E8%90%AC"), Some("萬".into()));
        assert_eq!(percent_decode_once("tail%"), None);
        assert_eq!(percent_decode_once("%f"), None);
        assert_eq!(canonical_percent_encode("a/b%é"), "a/b%25%C3%A9");
        assert_eq!(canonical_percent_encode("a?b#c d+e"), "a%3Fb%23c%20d+e");
    }

    #[test]
    fn test_component_semantics_not_string_prefix() {
        // 组件语义：`/tmp/root-evil` 与 `/tmp/root` 字符串前缀相同但组件不同；
        // 根校验必须按组件比较（真实符号链接逃逸见集成测试）。
        assert!(
            Path::new("/tmp/root-evil/x")
                .to_string_lossy()
                .starts_with("/tmp/root"),
            "字符串前缀正是误判来源"
        );
        assert!(
            !Path::new("/tmp/root-evil/x").starts_with("/tmp/root"),
            "组件语义不得按字符串前缀判定"
        );
        assert!(Path::new("/tmp/root/sub/x").starts_with("/tmp/root"));
    }
}
