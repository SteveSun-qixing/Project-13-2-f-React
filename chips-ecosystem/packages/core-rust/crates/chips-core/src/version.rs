//! 语义化版本与版本范围。
//!
//! 实现《版本与迁移规范》§3（版本格式与优先级比较）与 §4（版本范围语法）。
//! 内核只消费本模块的类型，不重复实现版本工具链。

use std::cmp::Ordering;
use std::fmt;

use thiserror::Error;

/// 版本解析错误。
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum VersionError {
    /// 版本号为空。
    #[error("版本号为空")]
    Empty,
    /// 版本号格式非法。
    #[error("版本号格式非法：{input}")]
    Invalid {
        /// 原始输入。
        input: String,
    },
    /// 主版本、次版本或修订号存在前导零。
    #[error("版本号存在前导零：{input}")]
    LeadingZero {
        /// 原始输入。
        input: String,
    },
    /// 版本范围格式非法。
    #[error("版本范围格式非法：{input}")]
    InvalidRange {
        /// 原始输入。
        input: String,
    },
}

/// 语义化版本 `MAJOR.MINOR.PATCH[-预发布标识]`；构建元数据不参与比较。
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Version {
    major: u64,
    minor: u64,
    patch: u64,
    pre: Vec<PrereleaseIdentifier>,
}

/// 预发布标识段。
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
enum PrereleaseIdentifier {
    /// 纯数字段。
    Numeric(u64),
    /// 含字母或连字符的段。
    AlphaNumeric(String),
}

impl Version {
    /// 解析 `MAJOR.MINOR.PATCH[-预发布标识][+构建元数据]`。
    ///
    /// 三段数字必须完整；禁止前导零；`v` 前缀非法；构建元数据被忽略。
    pub fn parse(input: &str) -> Result<Self, VersionError> {
        let parsed = parse_parts(input)?;
        if parsed.components != 3 {
            return Err(VersionError::Invalid {
                input: input.to_owned(),
            });
        }
        Ok(Self {
            major: parsed.major,
            minor: parsed.minor,
            patch: parsed.patch,
            pre: parsed.pre,
        })
    }

    /// 主版本号。
    #[must_use]
    pub fn major(&self) -> u64 {
        self.major
    }

    /// 次版本号。
    #[must_use]
    pub fn minor(&self) -> u64 {
        self.minor
    }

    /// 修订号。
    #[must_use]
    pub fn patch(&self) -> u64 {
        self.patch
    }

    /// 是否为预发布版本。
    #[must_use]
    pub fn is_prerelease(&self) -> bool {
        !self.pre.is_empty()
    }

    /// 不含预发布标识的核心三元组。
    #[must_use]
    pub fn base(&self) -> (u64, u64, u64) {
        (self.major, self.minor, self.patch)
    }
}

impl fmt::Display for Version {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}.{}.{}", self.major, self.minor, self.patch)?;
        if !self.pre.is_empty() {
            let rendered: Vec<String> = self.pre.iter().map(render_identifier).collect();
            write!(formatter, "-{}", rendered.join("."))?;
        }
        Ok(())
    }
}

impl PartialOrd for Version {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Version {
    fn cmp(&self, other: &Self) -> Ordering {
        self.major
            .cmp(&other.major)
            .then_with(|| self.minor.cmp(&other.minor))
            .then_with(|| self.patch.cmp(&other.patch))
            .then_with(|| compare_prerelease(&self.pre, &other.pre))
    }
}

impl std::str::FromStr for Version {
    type Err = VersionError;

    fn from_str(input: &str) -> Result<Self, Self::Err> {
        Self::parse(input)
    }
}

/// 语义化版本范围；空格为逻辑与、`||` 为逻辑或。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionRange {
    alternatives: Vec<ComparatorSet>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ComparatorSet {
    comparators: Vec<Comparator>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Comparator {
    Any,
    Eq(Version),
    Gt(Version),
    Gte(Version),
    Lt(Version),
    Lte(Version),
}

impl Comparator {
    fn matches(&self, version: &Version) -> bool {
        match self {
            Self::Any => true,
            Self::Eq(expected) => version == expected,
            Self::Gt(bound) => version > bound,
            Self::Gte(bound) => version >= bound,
            Self::Lt(bound) => version < bound,
            Self::Lte(bound) => version <= bound,
        }
    }

    fn bound(&self) -> Option<&Version> {
        match self {
            Self::Any => None,
            Self::Eq(version)
            | Self::Gt(version)
            | Self::Gte(version)
            | Self::Lt(version)
            | Self::Lte(version) => Some(version),
        }
    }

    /// 该比较项是否显式包含与给定版本核心三元组相同的预发布版本。
    fn mentions_prerelease_of(&self, version: &Version) -> bool {
        self.bound().is_some_and(|bound| {
            bound.is_prerelease()
                && (bound.major, bound.minor, bound.patch)
                    == (version.major, version.minor, version.patch)
        })
    }
}

impl VersionRange {
    /// 解析版本范围表达式。
    ///
    /// 支持 `*`、裸版本（`1` / `1.2` / `1.2.3`）、比较运算符（`=`、`>`、
    /// `>=`、`<`、`<=`）、脱字符（`^`）与波浪号（`~`），空格为逻辑与，
    /// `||` 为逻辑或。
    pub fn parse(input: &str) -> Result<Self, VersionError> {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            return Err(VersionError::InvalidRange {
                input: input.to_owned(),
            });
        }

        let mut alternatives = Vec::new();
        for alternative in trimmed.split("||") {
            let alternative = alternative.trim();
            if alternative.is_empty() {
                return Err(VersionError::InvalidRange {
                    input: input.to_owned(),
                });
            }
            let mut comparators = Vec::new();
            for token in alternative.split_whitespace() {
                comparators.extend(parse_comparator(token).map_err(|_| {
                    VersionError::InvalidRange {
                        input: input.to_owned(),
                    }
                })?);
            }
            if comparators.is_empty() {
                return Err(VersionError::InvalidRange {
                    input: input.to_owned(),
                });
            }
            alternatives.push(ComparatorSet { comparators });
        }

        Ok(Self { alternatives })
    }

    /// 给定版本是否满足范围。
    ///
    /// 预发布版本默认不匹配任何范围，除非范围自身显式包含相同核心三元组的
    /// 预发布标识（《版本与迁移规范》§4.3）。
    #[must_use]
    pub fn satisfies(&self, version: &Version) -> bool {
        if version.is_prerelease() && !self.mentions_prerelease(version) {
            return false;
        }
        self.alternatives
            .iter()
            .any(|set| set.comparators.iter().all(|item| item.matches(version)))
    }

    /// 在候选版本中选取满足范围的最高版本。
    #[must_use]
    pub fn select<'a>(&self, candidates: &'a [Version]) -> Option<&'a Version> {
        candidates
            .iter()
            .filter(|candidate| self.satisfies(candidate))
            .max()
    }

    fn mentions_prerelease(&self, version: &Version) -> bool {
        self.alternatives.iter().any(|set| {
            set.comparators
                .iter()
                .any(|item| item.mentions_prerelease_of(version))
        })
    }

    /// 范围是否只接受正式版本（用于诊断输出）。
    #[must_use]
    pub fn is_any(&self) -> bool {
        self.alternatives.len() == 1
            && self.alternatives[0].comparators.len() == 1
            && self.alternatives[0].comparators[0] == Comparator::Any
    }
}

impl fmt::Display for VersionRange {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let rendered: Vec<String> = self
            .alternatives
            .iter()
            .map(|set| {
                set.comparators
                    .iter()
                    .map(render_comparator)
                    .collect::<Vec<String>>()
                    .join(" ")
            })
            .collect();
        write!(formatter, "{}", rendered.join(" || "))
    }
}

impl std::str::FromStr for VersionRange {
    type Err = VersionError;

    fn from_str(input: &str) -> Result<Self, Self::Err> {
        Self::parse(input)
    }
}

struct ParsedParts {
    major: u64,
    minor: u64,
    patch: u64,
    components: usize,
    pre: Vec<PrereleaseIdentifier>,
}

fn parse_parts(input: &str) -> Result<ParsedParts, VersionError> {
    let input = input.trim();
    if input.is_empty() {
        return Err(VersionError::Empty);
    }

    let without_build = match input.split_once('+') {
        Some((core, metadata)) => {
            validate_dot_separated(metadata);
            core
        }
        None => input,
    };

    let (core, prerelease) = match without_build.split_once('-') {
        Some((core, prerelease)) => (core, Some(prerelease)),
        None => (without_build, None),
    };

    let components: Vec<&str> = core.split('.').collect();
    if components.is_empty() || components.len() > 3 {
        return Err(VersionError::Invalid {
            input: input.to_owned(),
        });
    }

    let mut numbers = [0_u64; 3];
    for (index, component) in components.iter().enumerate() {
        if component.is_empty() || !component.chars().all(|ch| ch.is_ascii_digit()) {
            return Err(VersionError::Invalid {
                input: input.to_owned(),
            });
        }
        if component.len() > 1 && component.starts_with('0') {
            return Err(VersionError::LeadingZero {
                input: input.to_owned(),
            });
        }
        numbers[index] = component
            .parse::<u64>()
            .map_err(|_| VersionError::Invalid {
                input: input.to_owned(),
            })?;
    }

    let pre = match prerelease {
        Some(prerelease) => parse_prerelease(prerelease, input)?,
        None => Vec::new(),
    };

    Ok(ParsedParts {
        major: numbers[0],
        minor: numbers[1],
        patch: numbers[2],
        components: components.len(),
        pre,
    })
}

fn parse_prerelease(
    prerelease: &str,
    input: &str,
) -> Result<Vec<PrereleaseIdentifier>, VersionError> {
    if prerelease.is_empty() {
        return Err(VersionError::Invalid {
            input: input.to_owned(),
        });
    }
    let mut identifiers = Vec::new();
    for segment in prerelease.split('.') {
        if segment.is_empty()
            || !segment
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
        {
            return Err(VersionError::Invalid {
                input: input.to_owned(),
            });
        }
        if segment.chars().all(|ch| ch.is_ascii_digit()) {
            if segment.len() > 1 && segment.starts_with('0') {
                return Err(VersionError::LeadingZero {
                    input: input.to_owned(),
                });
            }
            let number = segment.parse::<u64>().map_err(|_| VersionError::Invalid {
                input: input.to_owned(),
            })?;
            identifiers.push(PrereleaseIdentifier::Numeric(number));
        } else {
            identifiers.push(PrereleaseIdentifier::AlphaNumeric(segment.to_owned()));
        }
    }
    Ok(identifiers)
}

fn validate_dot_separated(input: &str) {
    for segment in input.split('.') {
        if segment.is_empty()
            || !segment
                .chars()
                .all(|ch| ch.is_ascii_alphanumeric() || ch == '-')
        {
            // 构建元数据非法时忽略整段，不影响版本比较（《版本与迁移规范》§3.1）。
            return;
        }
    }
}

fn parse_comparator(token: &str) -> Result<Vec<Comparator>, VersionError> {
    let (operator, rest) = split_operator(token);
    if rest == "*" {
        return if operator.is_empty() {
            Ok(vec![Comparator::Any])
        } else {
            Err(VersionError::InvalidRange {
                input: token.to_owned(),
            })
        };
    }

    let parsed = parse_parts(rest)?;
    let version = Version {
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch,
        pre: parsed.pre,
    };
    let upper = |major: u64, minor: u64, patch: u64| Version {
        major,
        minor,
        patch,
        pre: Vec::new(),
    };

    let comparators = match operator {
        "" | "=" => match parsed.components {
            3 => vec![Comparator::Eq(version)],
            2 => vec![
                Comparator::Gte(version),
                Comparator::Lt(upper(parsed.major, parsed.minor + 1, 0)),
            ],
            _ => vec![
                Comparator::Gte(version),
                Comparator::Lt(upper(parsed.major + 1, 0, 0)),
            ],
        },
        ">" => vec![Comparator::Gt(version)],
        ">=" => vec![Comparator::Gte(version)],
        "<" => vec![Comparator::Lt(version)],
        "<=" => vec![Comparator::Lte(version)],
        "^" => {
            let upper = caret_upper(&version);
            vec![Comparator::Gte(version), Comparator::Lt(upper)]
        }
        "~" => {
            let upper = tilde_upper(&version, parsed.components);
            vec![Comparator::Gte(version), Comparator::Lt(upper)]
        }
        _ => {
            return Err(VersionError::InvalidRange {
                input: token.to_owned(),
            })
        }
    };
    Ok(comparators)
}

fn split_operator(token: &str) -> (&str, &str) {
    for operator in ["^", "~", ">=", "<=", ">", "<", "="] {
        if let Some(rest) = token.strip_prefix(operator) {
            return (operator, rest);
        }
    }
    ("", token)
}

fn caret_upper(version: &Version) -> Version {
    let (major, minor, patch) = version.base();
    let (upper_major, upper_minor, upper_patch) = if major > 0 {
        (major + 1, 0, 0)
    } else if minor > 0 {
        (0, minor + 1, 0)
    } else {
        (0, 0, patch + 1)
    };
    Version {
        major: upper_major,
        minor: upper_minor,
        patch: upper_patch,
        pre: Vec::new(),
    }
}

fn tilde_upper(version: &Version, components: usize) -> Version {
    let (major, minor, _patch) = version.base();
    let (upper_major, upper_minor) = if components >= 2 {
        (major, minor + 1)
    } else {
        (major + 1, 0)
    };
    Version {
        major: upper_major,
        minor: upper_minor,
        patch: 0,
        pre: Vec::new(),
    }
}

fn compare_prerelease(left: &[PrereleaseIdentifier], right: &[PrereleaseIdentifier]) -> Ordering {
    match (left.is_empty(), right.is_empty()) {
        (true, true) => Ordering::Equal,
        (true, false) => Ordering::Greater,
        (false, true) => Ordering::Less,
        (false, false) => {
            for (left_item, right_item) in left.iter().zip(right.iter()) {
                let ordering = match (left_item, right_item) {
                    (
                        PrereleaseIdentifier::Numeric(left_number),
                        PrereleaseIdentifier::Numeric(right_number),
                    ) => left_number.cmp(right_number),
                    (
                        PrereleaseIdentifier::AlphaNumeric(left_text),
                        PrereleaseIdentifier::AlphaNumeric(right_text),
                    ) => left_text.cmp(right_text),
                    (PrereleaseIdentifier::Numeric(_), PrereleaseIdentifier::AlphaNumeric(_)) => {
                        Ordering::Less
                    }
                    (PrereleaseIdentifier::AlphaNumeric(_), PrereleaseIdentifier::Numeric(_)) => {
                        Ordering::Greater
                    }
                };
                if ordering != Ordering::Equal {
                    return ordering;
                }
            }
            left.len().cmp(&right.len())
        }
    }
}

fn render_identifier(identifier: &PrereleaseIdentifier) -> String {
    match identifier {
        PrereleaseIdentifier::Numeric(number) => number.to_string(),
        PrereleaseIdentifier::AlphaNumeric(text) => text.clone(),
    }
}

fn render_comparator(comparator: &Comparator) -> String {
    match comparator {
        Comparator::Any => "*".to_owned(),
        Comparator::Eq(version) => format!("={version}"),
        Comparator::Gt(version) => format!(">{version}"),
        Comparator::Gte(version) => format!(">={version}"),
        Comparator::Lt(version) => format!("<{version}"),
        Comparator::Lte(version) => format!("<={version}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn version(input: &str) -> Version {
        Version::parse(input).expect("测试版本号应合法")
    }

    fn range(input: &str) -> VersionRange {
        VersionRange::parse(input).expect("测试版本范围应合法")
    }

    #[test]
    fn test_version_parse_and_render() {
        let parsed = version("1.2.3-rc.1+build.9");
        assert_eq!(parsed.major(), 1);
        assert_eq!(parsed.minor(), 2);
        assert_eq!(parsed.patch(), 3);
        assert!(parsed.is_prerelease());
        assert_eq!(parsed.to_string(), "1.2.3-rc.1");
    }

    #[test]
    fn test_version_parse_rejects_invalid_input() {
        assert_eq!(Version::parse(""), Err(VersionError::Empty));
        assert!(matches!(
            Version::parse("v1.2.3"),
            Err(VersionError::Invalid { .. })
        ));
        assert!(matches!(
            Version::parse("1.02.0"),
            Err(VersionError::LeadingZero { .. })
        ));
        assert!(matches!(
            Version::parse("1.2"),
            Err(VersionError::Invalid { .. })
        ));
        assert!(matches!(
            Version::parse("1.2.3-"),
            Err(VersionError::Invalid { .. })
        ));
    }

    #[test]
    fn test_version_ordering() {
        assert!(version("1.2.3") < version("1.2.4"));
        assert!(version("1.2.3") < version("1.3.0"));
        assert!(version("1.2.3") < version("2.0.0"));
        assert!(version("1.2.3-alpha.1") < version("1.2.3"));
        assert!(version("1.2.3-alpha.1") < version("1.2.3-alpha.2"));
        assert!(version("1.2.3-alpha.2") < version("1.2.3-beta.1"));
        assert!(version("1.2.3-alpha") < version("1.2.3-alpha.1"));
        assert_eq!(version("1.2.3+build.1"), version("1.2.3+build.2"));
    }

    #[test]
    fn test_range_table_from_spec() {
        let caret = range("^1.2.0");
        assert!(caret.satisfies(&version("1.2.0")));
        assert!(caret.satisfies(&version("1.4.3")));
        assert!(!caret.satisfies(&version("2.0.1")));
        assert!(!caret.satisfies(&version("1.2.0-beta.1")));

        let bounded = range(">=1.0.0 <2.0.0");
        assert!(bounded.satisfies(&version("1.0.0")));
        assert!(bounded.satisfies(&version("1.9.9")));
        assert!(!bounded.satisfies(&version("2.0.0")));
        assert!(!bounded.satisfies(&version("1.9.9-rc.2")));
    }

    #[test]
    fn test_range_short_forms() {
        assert!(range("*").satisfies(&version("9.9.9")));
        assert!(!range("*").satisfies(&version("1.0.0-alpha")));
        assert!(range("1").satisfies(&version("1.9.9")));
        assert!(!range("1").satisfies(&version("2.0.0")));
        assert!(range("1.2").satisfies(&version("1.2.9")));
        assert!(!range("1.2").satisfies(&version("1.3.0")));
        assert!(range("1.2.3").satisfies(&version("1.2.3")));
        assert!(!range("1.2.3").satisfies(&version("1.2.4")));
        assert!(range("=1.2.3").satisfies(&version("1.2.3")));
    }

    #[test]
    fn test_range_operators() {
        assert!(range(">1.2.3").satisfies(&version("1.2.4")));
        assert!(!range(">1.2.3").satisfies(&version("1.2.3")));
        assert!(range(">=1.2.3").satisfies(&version("1.2.3")));
        assert!(range("<1.2.3").satisfies(&version("1.2.2")));
        assert!(range("<=1.2.3").satisfies(&version("1.2.3")));
        assert!(range(">=1.0.0 <2.0.0").satisfies(&version("1.5.0")));
        assert!(range("^1.0.0 || ^2.0.0").satisfies(&version("2.1.0")));
        assert!(!range("^1.0.0 || ^2.0.0").satisfies(&version("3.0.0")));
    }

    #[test]
    fn test_range_caret_zero_major() {
        assert!(range("^0.2.3").satisfies(&version("0.2.9")));
        assert!(!range("^0.2.3").satisfies(&version("0.3.0")));
        assert!(range("^0.0.3").satisfies(&version("0.0.3")));
        assert!(!range("^0.0.3").satisfies(&version("0.0.4")));
    }

    #[test]
    fn test_range_tilde_forms() {
        assert!(range("~1.2.3").satisfies(&version("1.2.9")));
        assert!(!range("~1.2.3").satisfies(&version("1.3.0")));
        assert!(range("~1.2").satisfies(&version("1.2.9")));
        assert!(!range("~1.2").satisfies(&version("1.3.0")));
        assert!(range("~1").satisfies(&version("1.9.9")));
        assert!(!range("~1").satisfies(&version("2.0.0")));
    }

    #[test]
    fn test_range_prerelease_explicit() {
        let explicit = range(">=1.2.3-alpha.1 <1.2.3");
        assert!(explicit.satisfies(&version("1.2.3-alpha.1")));
        assert!(explicit.satisfies(&version("1.2.3-alpha.2")));
        assert!(!explicit.satisfies(&version("1.2.3")));
        assert!(!explicit.satisfies(&version("1.2.4-alpha.1")));
    }

    #[test]
    fn test_eq_comparator_prerelease_semantics() {
        // 《版本与迁移规范》§4.3 规则 2：预发布版本默认不匹配，除非范围显式包含
        // 相同 `MAJOR.MINOR.PATCH` 的预发布标识；`=` 精确匹配自身。
        let exact = range("=1.2.3");
        assert!(exact.satisfies(&version("1.2.3")));
        assert!(
            !exact.satisfies(&version("1.2.3-rc.1")),
            "预发布不匹配正式版"
        );
        assert!(!exact.satisfies(&version("1.2.4")));

        let exact_pre = range("=1.2.3-alpha");
        assert!(exact_pre.satisfies(&version("1.2.3-alpha")));
        assert!(
            !exact_pre.satisfies(&version("1.2.3-beta")),
            "显式预发布范围只匹配同一标识"
        );
        assert!(
            !exact_pre.satisfies(&version("1.2.3")),
            "显式预发布范围不匹配正式版"
        );
    }

    #[test]
    fn test_gt_comparator_prerelease_semantics() {
        // 《版本与迁移规范》§4.2：`>` 为直接数值比较；§4.3 规则 2 约束预发布匹配。
        let gt_pre = range(">1.2.3-alpha.1");
        assert!(gt_pre.satisfies(&version("1.2.3-alpha.2")));
        assert!(
            !gt_pre.satisfies(&version("1.2.3-alpha.1")),
            "严格大于不匹配边界自身"
        );
        assert!(
            !gt_pre.satisfies(&version("1.3.0-rc.1")),
            "异三元组的预发布默认排除"
        );
        assert!(gt_pre.satisfies(&version("1.2.3")), "正式版按数值比较匹配");

        let gt_release = range(">1.2.3");
        assert!(gt_release.satisfies(&version("1.2.4")));
        assert!(!gt_release.satisfies(&version("1.2.3")));
        assert!(
            !gt_release.satisfies(&version("1.2.4-rc.1")),
            "预发布版本不匹配只含正式版边界的范围"
        );
    }

    #[test]
    fn test_range_select_highest_candidate() {
        let candidates = vec![version("1.2.0"), version("1.9.1"), version("2.0.0")];
        let selected = range("^1.0.0").select(&candidates).cloned();
        assert_eq!(selected, Some(version("1.9.1")));
    }

    #[test]
    fn test_range_invalid_inputs() {
        assert!(VersionRange::parse("").is_err());
        assert!(VersionRange::parse("^").is_err());
        assert!(VersionRange::parse(">*").is_err());
        assert!(VersionRange::parse("1.2.3 ||").is_err());
        assert!(VersionRange::parse(">=<1.0.0").is_err());
    }

    #[test]
    fn test_from_str_matches_parse() {
        // 《Rust编码规范》：`FromStr` 与 `parse` 语义一致，供 `str::parse` 使用。
        let from_parse = Version::parse("1.2.3-rc.1").expect("parse 应成功");
        let from_str: Version = "1.2.3-rc.1".parse().expect("FromStr 应成功");
        assert_eq!(from_parse, from_str);
        assert!("1.2".parse::<Version>().is_err(), "Version 不接受两段缩写");

        let range_parse = VersionRange::parse("^1.0.0").expect("parse 应成功");
        let range_str: VersionRange = "^1.0.0".parse().expect("FromStr 应成功");
        assert_eq!(range_parse, range_str);
        assert!(
            ">=1.0.0 <".parse::<VersionRange>().is_err(),
            "残缺的比较项应被拒绝"
        );
    }

    #[test]
    fn test_is_any_detects_wildcard_only_range() {
        assert!(range("*").is_any());
        assert!(range("  *  ").is_any());
        assert!(!range("^1.0.0").is_any());
        assert!(!range("1").is_any(), "裸主版本展开为 >=/< 两个比较项");
        assert!(!range("* || 1.2.3").is_any(), "含分支的范围不是任意范围");
        assert!(!range("* *").is_any(), "同名与或组内出现多个比较项");
    }

    #[test]
    fn test_version_numeric_limits_and_identifier_grammar() {
        // 《版本与迁移规范》§3.1：核心三元组、数字标识不得含前导零、不得溢出。
        assert!(matches!(
            Version::parse("1.2.3.4"),
            Err(VersionError::Invalid { .. })
        ));
        assert!(matches!(
            Version::parse("99999999999999999999.1.1"),
            Err(VersionError::Invalid { .. })
        ));
        assert!(matches!(
            Version::parse("1.2.3-alpha_1"),
            Err(VersionError::Invalid { .. })
        ));
        assert!(matches!(
            Version::parse("1.2.3-01"),
            Err(VersionError::LeadingZero { .. })
        ));
        assert!(matches!(
            Version::parse("1.2.3-99999999999999999999"),
            Err(VersionError::Invalid { .. })
        ));
        assert_eq!(version("1.2.3-0").to_string(), "1.2.3-0", "单个 0 合法");
        assert_eq!(
            version("18446744073709551615.0.0").major(),
            u64::MAX,
            "u64 上界应可解析"
        );
    }

    #[test]
    fn test_illegal_build_metadata_is_ignored() {
        // 《版本与迁移规范》§3.1：构建元数据不参与优先级；非法元数据段忽略即可。
        let legal = version("1.2.3+build.1");
        let illegal = version("1.2.3+build_1");
        assert_eq!(illegal, version("1.2.3"));
        assert_eq!(illegal, legal, "元数据不得影响比较结果");
        assert_eq!(illegal.to_string(), "1.2.3");
    }

    #[test]
    fn test_prerelease_numeric_precedes_alphanumeric() {
        // 《版本与迁移规范》§3.1：数字标识优先级低于字母标识。
        assert!(version("1.2.3-1") < version("1.2.3-alpha"));
        assert!(version("1.2.3-alpha") > version("1.2.3-1"));
        assert!(version("1.2.3-alpha.1") < version("1.2.3-alpha.b"));
        assert!(version("1.2.3-1.2") > version("1.2.3-1"));
    }

    #[test]
    fn test_range_display_round_trip() {
        assert_eq!(range("*").to_string(), "*");
        assert_eq!(range("=1.2.3").to_string(), "=1.2.3");
        assert_eq!(range(">1.2.3").to_string(), ">1.2.3");
        assert_eq!(range(">=1.2.3").to_string(), ">=1.2.3");
        assert_eq!(range("<1.2.3").to_string(), "<1.2.3");
        assert_eq!(range("<=1.2.3").to_string(), "<=1.2.3");
        assert_eq!(range(">=1.0.0 <2.0.0").to_string(), ">=1.0.0 <2.0.0");
        assert_eq!(
            range("^1.0.0 || 2.0.0").to_string(),
            ">=1.0.0 <2.0.0 || =2.0.0",
            "或分支以 || 连接，脱糖后的比较项逐一渲染"
        );
        assert_eq!(
            range("1.2.3").to_string(),
            "=1.2.3",
            "完整版本等价于 = 比较项"
        );
    }
}
