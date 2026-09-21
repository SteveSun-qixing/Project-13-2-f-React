//! `chips-resource://` URI 语法解析与归一化（《06-资源协议规范》§2）。
//!
//! 总形式 `chips-resource://<scope>/<path>[?<query>]`；`<scope>` 位于 authority
//! 位。External 作用域专用形式 `external/<scheme>/<host>[:<port>]/<path>[?<query>]`，
//! origin 编码在路径前两段。裸 `http(s)://` 输入按 §2.6 归一为 External 规范 URI；
//! `webdav://` 引用形式仅在 `normalize_reference`（解析器归一入口）中接受，
//! `resource()` 入口（[`resolve_input`]）对其返回 `RESOURCE_UNSUPPORTED_SCHEME`。

use serde::Serialize;

use crate::constants::ResourceLimits;
use crate::error::{ResourceError, ResourceResult, UriErrorReason};
use crate::path_guard::{canonical_percent_encode, percent_decode_once, to_nfc, VirtualPath};

/// 规范协议前缀（全小写，《06》§2.2）。
pub const RESOURCE_SCHEME: &str = "chips-resource";
/// External 保留作用域名（《06》§2.3）。
pub const EXTERNAL_SCOPE: &str = "external";
/// 平台保留作用域 `platform`（《06》§2.3）。
pub const PLATFORM_SCOPE: &str = "platform";
/// 平台保留作用域 `memory`（《06》§2.3）。
pub const MEMORY_SCOPE: &str = "memory";
/// 受管作用域前缀集合（《06》§2.3 受管作用域 ID 在册集合）。
pub const MANAGED_SCOPE_PREFIXES: [&str; 5] = ["workspace-", "card-", "box-", "plugin-", "temp-"];
/// External 允许的目标 scheme（《06》§2.6 归一表）。
pub const EXTERNAL_TARGET_SCHEMES: [&str; 3] = ["http", "https", "webdav"];

/// External 规范化 origin（scheme + host + 可选端口；默认端口已省略）。
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalOrigin {
    /// 目标 scheme：`http` / `https` / `webdav`（小写）。
    pub scheme: String,
    /// 规范化 host：小写、IDN 转 punycode、IPv6 保留方括号内文本。
    pub host: String,
    /// 端口；默认端口（http 80 / https 443）省略为 `None`。
    pub port: Option<u16>,
}

impl ExternalOrigin {
    /// origin 的 host[:port] 文本（缓存键与审计 host 字段使用）。
    #[must_use]
    pub fn host_authority(&self) -> String {
        match self.port {
            Some(port) => format!("{}:{}", self.host, port),
            None => self.host.clone(),
        }
    }
}

/// 解析产物：规范 URI。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalUri {
    /// 小写归一后的 scope 段（`card-7f3a`、`platform`、`external` 等）。
    pub scope: String,
    /// 作用域内虚拟路径；`None` 表示 resourceBase 基址（尾斜杠、空路径）。
    pub path: Option<VirtualPath>,
    /// External 目标 origin；非 External 为 `None`。
    pub external: Option<ExternalOrigin>,
    /// External 查询串（原样保留；非 External 恒为 `None`，《06》§2.5）。
    pub query: Option<String>,
}

impl CanonicalUri {
    /// 是否只到作用域根（resourceBase 基址）。直接请求基址读取返回
    /// `RESOURCE_NOT_FOUND`（目录不可列举，《06》§2.4）。
    #[must_use]
    pub fn is_scope_root(&self) -> bool {
        self.path.is_none()
    }

    /// 规范文本输出：ASCII、百分号编码大写十六进制、scope 小写。
    #[must_use]
    pub fn to_canonical_string(&self) -> String {
        let mut output = format!("{}://{}", RESOURCE_SCHEME, self.scope);
        match &self.external {
            Some(origin) => {
                output.push('/');
                output.push_str(&origin.scheme);
                output.push('/');
                // host 段已在解析期完成 IDNA/大小写归一，恒为 ASCII：`:` 作端口
                // 分隔符保留字面形态，IPv6 方括号按大写十六进制转义（§2.6）。
                let host = if is_ipv6_literal(&origin.host) {
                    format!("%5B{}%5D", origin.host.trim_matches('[').trim_matches(']'))
                } else {
                    origin.host_authority()
                };
                output.push_str(&host);
                output.push('/');
            }
            None => output.push('/'),
        }
        if let Some(path) = &self.path {
            let encoded: Vec<String> = path.segments().map(canonical_percent_encode).collect();
            output.push_str(&encoded.join("/"));
        }
        if let Some(query) = &self.query {
            output.push('?');
            output.push_str(query);
        }
        output
    }
}

/// 判定 IPv6 字面量 host（含方括号形态，《06》§2.6）。
#[must_use]
fn is_ipv6_literal(host: &str) -> bool {
    let inner = host.trim_start_matches('[').trim_end_matches(']');
    inner.contains(':') && inner.parse::<std::net::IpAddr>().is_ok()
}

/// 运行时资源入口输入归一与解析（`window.chips.resource(uri)` 与协议路径共用）：
/// 接受 `chips-resource://` 规范 URI 与裸 `http(s)://`；`webdav://`、`file://`
/// 与未知 scheme 返回 `RESOURCE_UNSUPPORTED_SCHEME`（《06》§2.2/§2.7）。
pub fn resolve_input(input: &str, limits: &ResourceLimits) -> ResourceResult<CanonicalUri> {
    let lowered = ascii_to_lowercase(input);
    if lowered.starts_with(&format!("{RESOURCE_SCHEME}://")) {
        return parse_canonical_form(input, limits);
    }
    if lowered.starts_with("http://") || lowered.starts_with("https://") {
        return normalize_bare_http(input, limits);
    }
    // 其余一律不支持（含 `file://`、`webdav://`、`data:` 与无 scheme 输入）。
    if input.contains("://") || looks_like_scheme(input) {
        return Err(ResourceError::UnsupportedScheme {
            uri: input.to_owned(),
        });
    }
    Err(ResourceError::InvalidUri {
        uri: input.to_owned(),
        reason: UriErrorReason::MalformedScheme,
    })
}

/// 文件格式引用归一入口（《06》§2.6，解析器侧使用）：在 `resolve_input` 基础上
/// 额外接受 `webdav://` 引用归一为 External 作用域（scheme 段固定 `webdav`）。
pub fn normalize_reference(input: &str, limits: &ResourceLimits) -> ResourceResult<CanonicalUri> {
    let lowered = ascii_to_lowercase(input);
    if lowered.starts_with("webdav://") {
        return normalize_bare_http(input, limits);
    }
    resolve_input(input, limits)
}

/// ASCII 大小写归一（scheme 与 scope 用；path 不折叠）。
#[must_use]
fn ascii_to_lowercase(input: &str) -> String {
    input.chars().map(|c| c.to_ascii_lowercase()).collect()
}

/// 判定形如 `scheme:` 前缀（用于把无 `//` 的已知/未知 scheme 输入归入正确错误码）。
#[must_use]
fn looks_like_scheme(input: &str) -> bool {
    match input.find(':') {
        Some(index) if index > 0 => input[..index]
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.')),
        _ => false,
    }
}

/// 解析 `chips-resource://` 形态（scheme 前缀已确认）。
pub fn parse_canonical_form(input: &str, limits: &ResourceLimits) -> ResourceResult<CanonicalUri> {
    if input.len() > limits.max_uri_bytes {
        return Err(uri_error(input, UriErrorReason::MalformedPath, limits));
    }
    let after_scheme = &input[RESOURCE_SCHEME.len() + 3..];
    // fragment 在任何作用域一律禁止（字面 `#`；%23 为普通字符）。
    if after_scheme.contains('#') {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::FragmentNotAllowed,
        });
    }
    let (authority_and_path, query) = split_query(after_scheme, input)?;
    let (scope_raw, remainder) = match authority_and_path.find('/') {
        Some(index) => (
            &authority_and_path[..index],
            &authority_and_path[index + 1..],
        ),
        None => (authority_and_path.as_str(), ""),
    };
    let scope = ascii_to_lowercase(scope_raw);
    validate_scope_syntax(&scope, input)?;
    if scope == EXTERNAL_SCOPE {
        return parse_external(input, remainder, query, limits);
    }
    // 受管作用域：查询串一律禁止（《06》§2.5）。
    if query.is_some() {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::QueryNotAllowed,
        });
    }
    let path = parse_managed_path(input, remainder, limits)?;
    Ok(CanonicalUri {
        scope,
        path,
        external: None,
        query: None,
    })
}

/// 拆分查询串：`?` 之后为 query；query 必须为规范 ASCII 且不含控制字符与裸空格。
fn split_query(rest: &str, input: &str) -> ResourceResult<(String, Option<String>)> {
    match rest.find('?') {
        Some(index) => {
            let query = &rest[index + 1..];
            if query
                .chars()
                .any(|c| c == ' ' || crate::path_guard::is_control_char(c))
            {
                return Err(ResourceError::InvalidUri {
                    uri: input.to_owned(),
                    reason: UriErrorReason::MalformedPath,
                });
            }
            // 查询串原样保留（§2.5）：仅做 ASCII 化与 `%XX` 大写归一；
            // 非法 `%` 序列按 `invalid_encoding` 拒绝。
            let mut normalized = String::with_capacity(query.len());
            let bytes = query.as_bytes();
            let mut cursor = 0;
            while cursor < query.len() {
                match bytes[cursor] {
                    b'%' => {
                        if cursor + 2 >= bytes.len()
                            || !bytes[cursor + 1].is_ascii_hexdigit()
                            || !bytes[cursor + 2].is_ascii_hexdigit()
                        {
                            return Err(ResourceError::InvalidUri {
                                uri: input.to_owned(),
                                reason: UriErrorReason::InvalidEncoding,
                            });
                        }
                        normalized.push('%');
                        normalized.push(char::from(bytes[cursor + 1]).to_ascii_uppercase());
                        normalized.push(char::from(bytes[cursor + 2]).to_ascii_uppercase());
                        cursor += 3;
                    }
                    byte if byte.is_ascii() => {
                        normalized.push(char::from(byte));
                        cursor += 1;
                    }
                    _ => {
                        let width = match bytes[cursor] {
                            b if b < 0xE0 => 2,
                            b if b < 0xF0 => 3,
                            _ => 4,
                        };
                        let text = query.get(cursor..cursor + width).ok_or_else(|| {
                            ResourceError::InvalidUri {
                                uri: input.to_owned(),
                                reason: UriErrorReason::InvalidEncoding,
                            }
                        })?;
                        for byte in text.as_bytes() {
                            normalized.push_str(&format!("%{byte:02X}"));
                        }
                        cursor += width;
                    }
                }
            }
            Ok((rest[..index].to_owned(), Some(normalized)))
        }
        None => Ok((rest.to_owned(), None)),
    }
}

fn uri_error(input: &str, reason: UriErrorReason, _limits: &ResourceLimits) -> ResourceError {
    let _ = input.len();
    ResourceError::InvalidUri {
        uri: input.to_owned(),
        reason,
    }
}

/// 校验 scope 段语法（《06》§2.3）：1–64 字符、`[a-z][a-z0-9-]*`、全小写 ASCII。
fn validate_scope_syntax(scope: &str, input: &str) -> ResourceResult<()> {
    let invalid = scope.is_empty()
        || scope.len() > 64
        || !scope.chars().next().is_some_and(|c| c.is_ascii_lowercase())
        || !scope
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if invalid {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::MalformedScope,
        });
    }
    Ok(())
}

/// 判定 scope 是否属于在册命名（受管前缀 / 保留字 / external，《06》§2.3）。
#[must_use]
pub fn is_registered_scope_naming(scope: &str) -> bool {
    scope == EXTERNAL_SCOPE
        || scope == PLATFORM_SCOPE
        || scope == MEMORY_SCOPE
        || MANAGED_SCOPE_PREFIXES
            .iter()
            .any(|prefix| scope.starts_with(prefix))
}

/// 受管作用域 path 解析：空路径 = 基址；前导 `/` = 绝对路径拒绝；裸空格 = 语法拒绝
/// （《06》§2.6：空格必须编码为 `%20`）；其余交 PathGuard。
fn parse_managed_path(
    input: &str,
    remainder: &str,
    limits: &ResourceLimits,
) -> ResourceResult<Option<VirtualPath>> {
    if remainder.is_empty() {
        return Ok(None);
    }
    if remainder.contains(' ') {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::MalformedPath,
        });
    }
    if remainder.starts_with('/') {
        return Err(ResourceError::PathInvalid {
            uri: input.to_owned(),
            path: remainder.to_owned(),
            reason: crate::error::PathErrorReason::Absolute,
        });
    }
    Ok(Some(VirtualPath::validate(remainder, input, limits)?))
}

/// External 形式：`external/<scheme>/<host>[:<port>]/<path>[?<query>]`。
fn parse_external(
    input: &str,
    remainder: &str,
    query: Option<String>,
    limits: &ResourceLimits,
) -> ResourceResult<CanonicalUri> {
    let mut segments = remainder.splitn(3, '/');
    // scheme 段按 §2.6 大小写归一（`HTTPS` 与 `https` 同一 origin）。
    let scheme_segment = ascii_to_lowercase(segments.next().unwrap_or_default());
    let host_segment = segments.next();
    let path_remainder = segments.next().unwrap_or_default();
    if scheme_segment.is_empty()
        || scheme_segment == "/"
        || !EXTERNAL_TARGET_SCHEMES.contains(&scheme_segment.as_str())
    {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::InvalidOrigin,
        });
    }
    let Some(host_segment) = host_segment else {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::InvalidOrigin,
        });
    };
    let origin = normalize_external_host(&scheme_segment, host_segment, input)?;
    if path_remainder.is_empty() {
        // 空路径只允许作为 resourceBase 基址（《06》§2.4）。
        return Ok(CanonicalUri {
            scope: EXTERNAL_SCOPE.to_owned(),
            path: None,
            external: Some(origin),
            query,
        });
    }
    if path_remainder.contains(' ') {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::MalformedPath,
        });
    }
    if path_remainder.starts_with('/') {
        return Err(ResourceError::PathInvalid {
            uri: input.to_owned(),
            path: path_remainder.to_owned(),
            reason: crate::error::PathErrorReason::Absolute,
        });
    }
    let path = VirtualPath::validate(path_remainder, input, limits)?;
    Ok(CanonicalUri {
        scope: EXTERNAL_SCOPE.to_owned(),
        path: Some(path),
        external: Some(origin),
        query,
    })
}

/// 规范化 External host：小写、IDN 转 punycode、默认端口省略、尾随点去除、
/// userinfo 拒绝、IPv6 方括号字面量（《06》§2.6）。
fn normalize_external_host(
    scheme: &str,
    host_segment: &str,
    input: &str,
) -> ResourceResult<ExternalOrigin> {
    let invalid = || ResourceError::InvalidUri {
        uri: input.to_owned(),
        reason: UriErrorReason::InvalidOrigin,
    };
    let host_segment = percent_decode_once(host_segment).ok_or_else(&invalid)?;
    if host_segment.is_empty() || host_segment.contains('@') {
        // userinfo 一律拒绝（含裸 http 输入）。
        return Err(invalid());
    }
    let (host_part, port_part) = split_host_port(&host_segment).ok_or_else(invalid)?;
    let host = normalize_host_name(host_part).ok_or_else(invalid)?;
    let port = match port_part {
        None => None,
        Some(text) => {
            let port: u16 = text.parse().map_err(|_| invalid())?;
            if port == 0 {
                return Err(invalid());
            }
            let is_default = match scheme {
                "http" => port == 80,
                "https" => port == 443,
                _ => false,
            };
            if is_default {
                None
            } else {
                Some(port)
            }
        }
    };
    Ok(ExternalOrigin {
        scheme: scheme.to_owned(),
        host,
        port,
    })
}

/// 拆 host 与端口：IPv6 字面量取 `[...]` 形态，其余按最后一个 `:`。
#[must_use]
fn split_host_port(text: &str) -> Option<(&str, Option<&str>)> {
    if let Some(rest) = text.strip_prefix('[') {
        let (inner, tail) = rest.split_once(']')?;
        let port = match tail {
            "" => None,
            other => match other.strip_prefix(':') {
                Some(port_text) if !port_text.is_empty() => Some(port_text),
                _ => return None,
            },
        };
        return Some((inner, port));
    }
    match text.rsplit_once(':') {
        Some((host, port_text)) => {
            if host.is_empty()
                || port_text.is_empty()
                || !port_text.bytes().all(|b| b.is_ascii_digit())
            {
                // 含 `:` 但非合法端口形态：域名不允许冒号，显式失败。
                None
            } else {
                Some((host, Some(port_text)))
            }
        }
        None => Some((text, None)),
    }
}

/// 规范化 host 名：IPv4/IPv6 字面量直接校验；域名小写、去尾随点、IDN 转 punycode。
#[must_use]
fn normalize_host_name(raw: &str) -> Option<String> {
    if raw.is_empty() {
        return None;
    }
    // IP 字面量（含 IPv6）。
    if raw.parse::<std::net::IpAddr>().is_ok() {
        let normalized = raw.to_ascii_lowercase();
        return Some(match raw.strip_prefix('[') {
            Some(_) => format!("[{normalized}]"),
            None => normalized,
        });
    }
    if raw.contains(':') {
        // 形如 IPv6 但不可解析。
        return None;
    }
    let without_dot = raw.trim_end_matches('.');
    if without_dot.is_empty() {
        return None;
    }
    let lowered = ascii_to_lowercase(without_dot);
    // 纯 ASCII 域名按字符集校验；非 ASCII 走 UTS #46（IDN → punycode）。
    if lowered.is_ascii() {
        let valid = lowered.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && label
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.')
                && !label.starts_with('-')
                && !label.ends_with('-')
        });
        if !valid {
            return None;
        }
        return Some(lowered);
    }
    idna::domain_to_ascii_strict(&lowered).ok()
}

/// 裸 `http(s)://`（及解析器入口的 `webdav://`）归一为 External 规范 URI（《06》§2.6）。
fn normalize_bare_http(input: &str, limits: &ResourceLimits) -> ResourceResult<CanonicalUri> {
    let lowered = ascii_to_lowercase(input);
    let scheme = if lowered.starts_with("https://") {
        "https"
    } else if lowered.starts_with("http://") {
        "http"
    } else if lowered.starts_with("webdav://") {
        "webdav"
    } else {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::MalformedScheme,
        });
    };
    if input.len() > limits.max_uri_bytes {
        return Err(uri_error(input, UriErrorReason::MalformedPath, limits));
    }
    let rest = &input[scheme.len() + 3..];
    if rest.contains('#') {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::FragmentNotAllowed,
        });
    }
    let (authority_path, query) = split_query(rest, input)?;
    let (authority, path_remainder) = match authority_path.find('/') {
        Some(index) => (&authority_path[..index], &authority_path[index + 1..]),
        None => {
            // 无路径分隔符的裸 origin：空路径只允许以尾斜杠基址形态出现
            // （《06》§2.4），`https://host` 形态按语法非法拒绝。
            return Err(ResourceError::InvalidUri {
                uri: input.to_owned(),
                reason: UriErrorReason::MalformedPath,
            });
        }
    };
    if authority.is_empty() {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::InvalidOrigin,
        });
    }
    if path_remainder.contains(' ') {
        return Err(ResourceError::InvalidUri {
            uri: input.to_owned(),
            reason: UriErrorReason::MalformedPath,
        });
    }
    let origin = normalize_external_host(scheme, authority, input)?;
    if path_remainder.is_empty() {
        // origin 基址形态（空路径仅作 resourceBase，《06》§2.4）。
        return Ok(CanonicalUri {
            scope: EXTERNAL_SCOPE.to_owned(),
            path: None,
            external: Some(origin),
            query,
        });
    }
    let path = VirtualPath::validate(path_remainder, input, limits)?;
    Ok(CanonicalUri {
        scope: EXTERNAL_SCOPE.to_owned(),
        path: Some(path),
        external: Some(origin),
        query,
    })
}

/// 对已解析 URI 执行 PathGuard 深度校验（流水线「作用域查找 → 路径校验」位的
/// 复用入口；URI 层已保证语法，这里给出显式 API 供解析器与协议处理器复用）。
pub fn nfc_normalize(text: &str) -> String {
    to_nfc(text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::PathErrorReason;

    fn limits() -> ResourceLimits {
        ResourceLimits::default()
    }

    fn parsed(input: &str) -> CanonicalUri {
        resolve_input(input, &limits())
            .unwrap_or_else(|error| panic!("合法输入被拒绝 {input}: {error}"))
    }

    fn uri_reason(input: &str) -> UriErrorReason {
        match resolve_input(input, &limits()) {
            Err(ResourceError::InvalidUri { reason, .. }) => reason,
            Err(other) => panic!("期望 INVALID_URI，实际 {other:?}"),
            Ok(uri) => panic!("期望拒绝，实际通过 {uri:?}"),
        }
    }

    #[test]
    fn test_managed_forms_matrix() {
        let uri = parsed("chips-resource://card-7f3a/images/photo.jpg");
        assert_eq!(uri.scope, "card-7f3a");
        assert_eq!(uri.path.as_ref().unwrap().as_str(), "images/photo.jpg");
        assert!(uri.external.is_none());
        assert_eq!(
            uri.to_canonical_string(),
            "chips-resource://card-7f3a/images/photo.jpg"
        );
        assert!(parsed("chips-resource://box-2c91/.box/cover.html")
            .path
            .is_some());
        assert!(parsed("chips-resource://plugin-001/icon.png")
            .path
            .is_some());
        assert!(parsed("chips-resource://platform/frame.html")
            .path
            .is_some());
        assert!(parsed("chips-resource://workspace-3f/a.card/b.png")
            .path
            .is_some());
        assert!(parsed("chips-resource://temp-7a3f/report.pdf")
            .path
            .is_some());
        assert!(parsed("chips-resource://memory/x.bin").path.is_some());
    }

    #[test]
    fn test_case_normalization() {
        // scheme 与 scope 归一小写；path 保持大小写（《06》§2.6）。
        let uri = parsed("CHIPS-RESOURCE://CARD-7F3A/Images/Photo.JPG");
        assert_eq!(uri.scope, "card-7f3a");
        assert_eq!(uri.path.as_ref().unwrap().as_str(), "Images/Photo.JPG");
    }

    #[test]
    fn test_scope_root_base_uri() {
        let uri = parsed("chips-resource://card-7f3a/");
        assert!(uri.is_scope_root());
        assert_eq!(uri.to_canonical_string(), "chips-resource://card-7f3a/");
        let no_slash = parsed("chips-resource://platform");
        assert!(no_slash.is_scope_root());
    }

    #[test]
    fn test_syntax_reject_matrix() {
        assert_eq!(
            uri_reason("chips-resource://card!1/a"),
            UriErrorReason::MalformedScope
        );
        assert_eq!(
            uri_reason("chips-resource://-card/a"),
            UriErrorReason::MalformedScope
        );
        assert_eq!(
            uri_reason("chips-resource:///a/b"),
            UriErrorReason::MalformedScope
        );
        assert_eq!(
            uri_reason("chips-resource://card-7f3a/images/photo.jpg?v=2"),
            UriErrorReason::QueryNotAllowed
        );
        assert_eq!(
            uri_reason("chips-resource://platform/frame.html#top"),
            UriErrorReason::FragmentNotAllowed
        );
        assert_eq!(
            uri_reason("chips-resource://card-7f3a/a%zzx"),
            UriErrorReason::InvalidEncoding
        );
    }

    #[test]
    fn test_path_reject_matrix_at_uri_layer() {
        match resolve_input(
            "chips-resource://card-7f3a/images/../.card/metadata.yaml",
            &limits(),
        ) {
            Err(ResourceError::PathInvalid { reason, .. }) => {
                assert_eq!(reason, PathErrorReason::Segment)
            }
            other => panic!("期望 segment 拒绝，实际 {other:?}"),
        }
        match resolve_input(
            "chips-resource://card-7f3a/%2e%2e/.card/metadata.yaml",
            &limits(),
        ) {
            Err(ResourceError::PathInvalid { reason, .. }) => {
                assert_eq!(reason, PathErrorReason::Segment)
            }
            other => panic!("期望 segment 拒绝，实际 {other:?}"),
        }
        match resolve_input("chips-resource://card-7f3a/images\\photo.jpg", &limits()) {
            Err(ResourceError::PathInvalid { reason, .. }) => {
                assert_eq!(reason, PathErrorReason::Separator)
            }
            other => panic!("期望 separator 拒绝，实际 {other:?}"),
        }
        match resolve_input("chips-resource://card-7f3a//double-slash", &limits()) {
            Err(ResourceError::PathInvalid { reason, .. }) => {
                assert_eq!(reason, PathErrorReason::Absolute)
            }
            other => panic!("期望 absolute 拒绝，实际 {other:?}"),
        }
    }

    #[test]
    fn test_encoded_literal_dotdot_is_not_traversal() {
        // 《06》§2.7：解码一次得字面 `%2e%2e`，按字面名继续。
        let uri = parsed("chips-resource://card-7f3a/images/%252e%252e/x");
        assert_eq!(uri.path.as_ref().unwrap().as_str(), "images/%2e%2e/x");
        assert_eq!(
            uri.to_canonical_string(),
            "chips-resource://card-7f3a/images/%252e%252e/x"
        );
    }

    #[test]
    fn test_non_ascii_percent_normalized() {
        let uri = parsed("chips-resource://workspace-3f/笔记/报告.card");
        assert_eq!(
            uri.to_canonical_string(),
            "chips-resource://workspace-3f/%E7%AC%94%E8%AE%B0/%E6%8A%A5%E5%91%8A.card"
        );
        // 字面 `?` 编码为 %3F、`#` 编码为 %23 后为普通路径字符。
        let encoded = parsed("chips-resource://card-1/a%3Fb%23c");
        assert_eq!(encoded.path.as_ref().unwrap().as_str(), "a?b#c");
    }

    #[test]
    fn test_unsupported_scheme_matrix() {
        for input in [
            "file:///Users/me/note.card/a.png",
            "webdav://dav.example.com/team/a.card",
            "ftp://host/a",
            "data:text/plain,hello",
        ] {
            let error = resolve_input(input, &limits()).expect_err("必须拒绝");
            assert_eq!(
                error.code(),
                crate::error::RESOURCE_UNSUPPORTED_SCHEME,
                "{input}"
            );
        }
        // webdav 在解析器归一入口可接受（《06》§2.6 表）。
        let uri = normalize_reference("webdav://dav.example.com/team/notes.card", &limits())
            .expect("解析器入口必须接受 webdav 引用");
        assert_eq!(
            uri.to_canonical_string(),
            "chips-resource://external/webdav/dav.example.com/team/notes.card"
        );
    }

    #[test]
    fn test_bare_http_normalization_matrix() {
        // 《06》§2.6 归一表逐行锁定。
        assert_eq!(
            parsed("https://cdn.example.com/banner.png").to_canonical_string(),
            "chips-resource://external/https/cdn.example.com/banner.png"
        );
        assert_eq!(
            parsed("http://api.example.com:8080/v1/items?page=2").to_canonical_string(),
            "chips-resource://external/http/api.example.com:8080/v1/items?page=2"
        );
        assert_eq!(
            parsed("HTTPS://CDN.EXAMPLE.COM/Banner.PNG").to_canonical_string(),
            "chips-resource://external/https/cdn.example.com/Banner.PNG"
        );
        assert_eq!(
            parsed("https://example.com:443/a").to_canonical_string(),
            "chips-resource://external/https/example.com/a"
        );
        assert_eq!(
            parsed("https://例え.jp/a").to_canonical_string(),
            "chips-resource://external/https/xn--r8jz45g.jp/a"
        );
        assert_eq!(
            parsed("https://[2001:db8::1]/a").to_canonical_string(),
            "chips-resource://external/https/%5B2001:db8::1%5D/a"
        );
    }

    #[test]
    fn test_userinfo_and_host_rejections() {
        for input in [
            "https://user:pass@example.com/a",
            "webdav://user:pass@dav.example.com/a.card",
        ] {
            let error = normalize_reference(input, &limits()).expect_err("userinfo 必须拒绝");
            match error {
                ResourceError::InvalidUri { reason, .. } => {
                    assert_eq!(reason, UriErrorReason::InvalidOrigin)
                }
                other => panic!("期望 invalid_origin，实际 {other:?}"),
            }
        }
        assert_eq!(
            uri_reason("https://exa_mple.com/a"),
            UriErrorReason::InvalidOrigin
        );
        assert_eq!(
            uri_reason("https://example.com:0/a"),
            UriErrorReason::InvalidOrigin
        );
        assert_eq!(uri_reason("https://:8080/a"), UriErrorReason::InvalidOrigin);
        assert_eq!(
            uri_reason("https://example.com"),
            UriErrorReason::MalformedPath
        );
    }

    #[test]
    fn test_canonical_external_form_matrix() {
        let uri = parsed("chips-resource://external/https/example.com/a.json?page=1");
        assert_eq!(uri.scope, "external");
        let origin = uri.external.as_ref().unwrap();
        assert_eq!(
            (origin.scheme.as_str(), origin.host.as_str(), origin.port),
            ("https", "example.com", None)
        );
        assert_eq!(uri.query.as_deref(), Some("page=1"));
        // External 的 path 同样执行 PathGuard。
        match resolve_input(
            "chips-resource://external/https/example.com/../x",
            &limits(),
        ) {
            Err(ResourceError::PathInvalid { reason, .. }) => {
                assert_eq!(reason, PathErrorReason::Segment)
            }
            other => panic!("期望 segment 拒绝，实际 {other:?}"),
        }
        // External 之外的 scheme 段拒绝。
        assert_eq!(
            uri_reason("chips-resource://external/ftp/example.com/a"),
            UriErrorReason::InvalidOrigin
        );
        // 大写 host 归一。
        let upper = parsed("chips-resource://external/HTTPS/EXAMPLE.COM/A.TXT");
        assert_eq!(upper.external.as_ref().unwrap().host, "example.com");
        assert_eq!(
            upper.to_canonical_string(),
            "chips-resource://external/https/example.com/A.TXT"
        );
    }

    #[test]
    fn test_query_rules() {
        // External 查询串原样保留并参与规范输出（《06》§2.5）。
        let uri = parsed("chips-resource://external/https/a.example/x?v=1&lang=zh");
        assert_eq!(uri.query.as_deref(), Some("v=1&lang=zh"));
        assert_eq!(
            uri.to_canonical_string(),
            "chips-resource://external/https/a.example/x?v=1&lang=zh"
        );
        // query 内控制字符与裸空格拒绝（语法级）。
        assert_eq!(
            uri_reason("chips-resource://external/https/a.example/x?v=\u{1}"),
            UriErrorReason::MalformedPath
        );
        assert_eq!(
            uri_reason("chips-resource://external/https/a.example/x?v=1 2"),
            UriErrorReason::MalformedPath
        );
        // 非 ASCII query 归一为 UTF-8 大写百分号编码。
        let non_ascii = parsed("chips-resource://external/https/a.example/x?q=万");
        assert_eq!(non_ascii.query.as_deref(), Some("q=%E4%B8%87"));
        // path 裸空格拒绝（必须编码为 %20，《06》§2.6）；解码出的字面空格合法。
        assert_eq!(
            uri_reason("chips-resource://external/https/a.example/a b.png"),
            UriErrorReason::MalformedPath
        );
        assert_eq!(
            uri_reason("https://a.example/a b.png"),
            UriErrorReason::MalformedPath
        );
        let encoded_space = parsed("chips-resource://card-1/a%20b.png");
        assert_eq!(encoded_space.path.as_ref().unwrap().as_str(), "a b.png");
    }

    #[test]
    fn test_registered_scope_naming() {
        // 《06》§2.3 在册集合。
        assert!(is_registered_scope_naming("platform"));
        assert!(is_registered_scope_naming("external"));
        assert!(is_registered_scope_naming("memory"));
        assert!(is_registered_scope_naming("card-7f3a"));
        assert!(is_registered_scope_naming("box-2c91"));
        assert!(is_registered_scope_naming("plugin-001"));
        assert!(is_registered_scope_naming("workspace-3f"));
        assert!(is_registered_scope_naming("temp-7a3f"));
        assert!(!is_registered_scope_naming("unknown-1"));
        assert!(!is_registered_scope_naming("cards-1"));
    }
}
