//! 《04-资源管理设计》§8 网络抓取策略引擎（段三 #192，HttpProvider 主体）。
//!
//! # 形态
//!
//! 本模块交付**注入式**策略引擎：[`HttpRequestPort`] 是把「一次实际的
//! HTTP 往返」交给外层的窄契约（真实现由宿主网络栈提供），全部**策略**
//! 留在本 crate——SSRF 地址族拦截（《04》§8.3）、逐跳重定向复校验
//! （§8.2 协议 + 地址每一跳复核）、userinfo 拒绝、三超时注入（§8.2
//! 连接/首字节/空闲常量口径，随请求逐一下发）、响应体 2 GiB 上限
//! （`RESOURCE_TOO_LARGE`，§8.2）、请求头净化（默认不带 Cookie/
//! Authorization、平台 UA、无 Referer，《04》§8.4）、以及 L2 磁盘缓存
//! 集成与条件请求（ETag/If-None-Match 族，§6.2/§8.4）。
//!
//! Port 铁律：**不得自行跟随重定向**——重定向循环归本策略引擎所有，
//! 每一跳都独立 `resolve` + 地址族复校验（DNS rebinding 防御，《04》
//! §8.3）再 `send`。
//!
//! # 错误口径
//!
//! 网络族失败统一产 `RESOURCE_NETWORK_FAILED`（`details` 为
//! `IResourceNetworkErrorDetails { uri, reason, status? }`，《06.07》§7.3
//! 七词词表）；超限产 `RESOURCE_TOO_LARGE`；写入族在 Provider 纵深臂
//! 返回 `RESOURCE_READ_ONLY`（镜像 ArchiveProvider，`details.uri` 取
//! 精确目标 uri，工单044 裁定 §三.5-⑧-2）；External 列举返回
//! `RESOURCE_NOT_SUPPORTED`（《06》§7.2 在册示例臂）。
//!
//! # 在册解释（README 漂移登记同步在册）
//!
//! - `stat` 以 HEAD 探测（Manager `read_range` 完整读前置 `stat` 的
//!   在册注释「不产生网络体拉取」），HEAD 支持是 port 契约的一部分；
//! - 上游非 2xx/3xx 状态（含 404）一律 `NetworkFailed { http_status }`，
//!   不借道 `NotFound`（七词词表在册语义）；
//! - 版本戳取 `ETag` > `Last-Modified` 派生 > `len:<size>` 兜底；
//!   无验证器（ETag/Last-Modified 双缺）的响应不落 L2（《04.13》约束 #6
//!   「无版本戳不进缓存」在磁盘面的从严解释）；
//! - `Cache-Control: no-store` 响应不落 L2（§8.4）；`max-age` 有效期
//!   优先于 `externalTtlSeconds` 默认值（§6.3/§8.4 响应头有效期优先）；
//! - 重定向 `Location` 携带 userinfo 或非法 scheme → `redirect` 词
//!   （拒绝发生在重定向处理阶段）；解析产物地址被 SSRF 矩阵拦截 →
//!   `blocked` 词（地址族拦截语义与首跳一致）；
//! - 流式形态为「策略抓取 + 缓冲分片呈现」（[`HttpStream`]）：
//!   [`HttpRequestPort`] 窄契约返回缓冲响应，《04.11》§11 未在册
//!   分块 port 形状，抓取上限仍由 2 GiB 口径把守。

use std::net::{IpAddr, Ipv6Addr};
use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use chips_core::ChipsError;
use thiserror::Error;

use crate::cache::{CacheKey, CacheStore, CachedMetadata, DiskEntry, DiskMeta};
use crate::constants::ResourceLimits;
use crate::error::{NetworkErrorReason, ResourceError, ScopeOperation};
use crate::manager::cache_key_for_uri;
use crate::memory::guess_mime_type;
use crate::provider::{
    ByteRange, DirectoryEntry, FileMetadata, ResourceAddress, ResourceMetadata, ResourceProvider,
    ResourceStream,
};
use crate::scope::ScopeKind;
use crate::uri::resolve_input;

/// 在册 Provider 标识（注册表键；与 Manager `external_provider_id` 的
/// http/https 路由值逐字一致）。
pub const HTTP_PROVIDER_ID: &str = "http";

/// 平台 User-Agent（《04》§8.4「平台 UA、无 Referer」；不含设备指纹）。
pub const PLATFORM_USER_AGENT: &str = "ChipsResource/1.0";

/// 条件请求验证器族请求头名（小写在册形态，《04》§6.2）。
pub const IF_NONE_MATCH: &str = "if-none-match";
/// `Last-Modified` 条件族请求头名。
pub const IF_MODIFIED_SINCE: &str = "if-modified-since";

/// 默认端口（http 80 / https 443；其余 scheme 无默认）。
fn default_port(scheme: &str) -> Option<u16> {
    match scheme {
        "http" => Some(80),
        "https" => Some(443),
        _ => None,
    }
}

/// 当前 Unix 毫秒（新鲜期时钟；时钟回拨按 0 收敛，与 L2 侧同规则）。
fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|span| span.as_millis() as u64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Port 契约（注入面）
// ---------------------------------------------------------------------------

/// 单跳请求方法（策略引擎只使用 GET/HEAD 两面；HEAD 供 `stat` 探测）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpMethod {
    /// 完整读取。
    Get,
    /// 元数据探测（不产生响应体）。
    Head,
}

/// 下发给 port 的单跳请求（超时三常量与响应上限逐请求注入，《04》§8.2）。
#[derive(Debug, Clone)]
pub struct HttpRequest {
    /// 请求方法。
    pub method: HttpMethod,
    /// 完整绝对 URL（本跳目标）。
    pub url: String,
    /// 净化后的请求头（名称小写；绝不含 Cookie/Authorization/Referer）。
    pub headers: Vec<(String, String)>,
    /// 连接超时（`connectTimeoutMs` 常量口径）。
    pub connect_timeout: Duration,
    /// 首字节超时（`firstByteTimeoutMs` 常量口径）。
    pub first_byte_timeout: Duration,
    /// 空闲超时（`idleTimeoutMs` 常量口径）。
    pub idle_timeout: Duration,
    /// 响应体字节上限（2 GiB 口径 = `max_resource_bytes`，《04》§8.2；
    /// port 必须在越限时提前中止并以 [`HttpPortFailure::TooLarge`] 回报）。
    pub max_response_bytes: u64,
}

/// port 回报的单跳响应（响应体已按上限截停）。
#[derive(Debug, Clone)]
pub struct HttpResponse {
    /// HTTP 状态码。
    pub status: u16,
    /// 响应头（名称按小写注入；重复头以多条目承载，读取取首个）。
    pub headers: Vec<(String, String)>,
    /// 响应体（HEAD 请求恒为空）。
    pub body: Vec<u8>,
}

impl HttpResponse {
    /// 大小写不敏感取首个同名响应头。
    #[must_use]
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }
}

/// port 失败回报。
///
/// `Failed.reason` 取《06.07》§7.3 七词词表中的 dns/connect/tls/timeout
/// 四词族；`http_status`/`redirect`/`blocked` 三词由策略引擎产出，port
/// 若误产三词，Provider 侧一律按 `blocked` 消费（防御臂，不放宽）。
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum HttpPortFailure {
    /// 传输层失败（`message` 为诊断文本，不得含 URL 凭据）。
    #[error("网络请求失败：{message}")]
    Failed {
        /// 失败原因词。
        reason: NetworkErrorReason,
        /// 诊断消息。
        message: String,
    },
    /// 响应体超过注入上限（port 提前中止回报；策略引擎映射
    /// `RESOURCE_TOO_LARGE`，《04》§8.2）。
    #[error("响应体超过上限 {limit_bytes} 字节")]
    TooLarge {
        /// 注入的字节上限。
        limit_bytes: u64,
        /// 已知实际大小（Content-Length 可得时在册回报）。
        actual_bytes: Option<u64>,
    },
}

/// 单跳 HTTP 往返的注入契约。
///
/// 铁律：**不得自行跟随重定向**（重定向循环与逐跳复校验归策略引擎）；
/// `resolve` 每次调用都必须真实解析（DNS rebinding 防御依赖逐跳重解析）。
#[async_trait]
pub trait HttpRequestPort: Send + Sync {
    /// 解析主机到地址集（供逐跳 SSRF 复校验；`host` 为规范化主机文本，
    /// IPv6 不带方括号）。
    async fn resolve(&self, host: &str, port: u16) -> Result<Vec<IpAddr>, HttpPortFailure>;
    /// 执行单跳请求并返回缓冲响应。
    async fn send(&self, request: &HttpRequest) -> Result<HttpResponse, HttpPortFailure>;
}

// ---------------------------------------------------------------------------
// 目标解析与 SSRF 地址族矩阵
// ---------------------------------------------------------------------------

/// 已校验的单跳 HTTP 目标。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpTarget {
    /// scheme（小写，`http` / `https`）。
    pub scheme: String,
    /// 主机（小写、IDN 转 punycode；IPv6 为方括号内文本）。
    pub host: String,
    /// 端口（显式化：默认端口在解析期填充）。
    pub port: u16,
    /// 路径（以 `/` 起）。
    pub path: String,
    /// 查询串（不含 `?`）。
    pub query: Option<String>,
}

impl HttpTarget {
    /// 重组绝对 URL（默认端口省略）。
    #[must_use]
    pub fn url(&self) -> String {
        let mut url = format!("{}://{}{}", self.scheme, self.authority(), self.path);
        if let Some(query) = &self.query {
            url.push('?');
            url.push_str(query);
        }
        url
    }

    /// `host[:port]` 授权段（非默认端口才带 `:port`；IPv6 加方括号）。
    #[must_use]
    pub fn authority(&self) -> String {
        let host = if self.host.contains(':') {
            format!("[{}]", self.host)
        } else {
            self.host.clone()
        };
        match default_port(&self.scheme) {
            Some(port) if port == self.port => host,
            _ => format!("{host}:{}", self.port),
        }
    }

    /// origin 文本（`scheme://host[:port]`，缓存键 origin 维度同源）。
    #[must_use]
    pub fn origin(&self) -> String {
        format!("{}://{}", self.scheme, self.authority())
    }

    /// 同原点判定（scheme + host + port 全等）。
    #[must_use]
    pub fn same_origin(&self, other: &Self) -> bool {
        self.scheme == other.scheme && self.host == other.host && self.port == other.port
    }
}

/// 目标解析拒绝类别。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum TargetRejection {
    /// scheme 不在 `http` / `https` 在册面。
    #[error("目标 scheme 不受支持")]
    UnsupportedScheme,
    /// URL 携带 userinfo（`@` 凭据段，《04》§8.3 拒绝项）。
    #[error("目标携带 userinfo，已按 SSRF 口径拒绝")]
    UserInfo,
    /// 主机缺失。
    #[error("目标主机缺失")]
    EmptyHost,
    /// 端口缺失或非法。
    #[error("目标端口非法")]
    InvalidPort,
    /// 结构非法（含 fragment、畸形 IPv6 等）。
    #[error("目标 URL 结构非法")]
    Malformed,
}

/// 解析绝对 HTTP URL（首跳与绝对 Location 共用）。
pub fn parse_target_url(input: &str) -> Result<HttpTarget, TargetRejection> {
    let (scheme, rest) = input.split_once("://").ok_or(TargetRejection::Malformed)?;
    let scheme = scheme.to_ascii_lowercase();
    if scheme != "http" && scheme != "https" {
        return Err(TargetRejection::UnsupportedScheme);
    }
    split_authority_and_tail(&scheme, rest)
}

/// 从 `scheme` 已定的 `authority[/path][?query]` 段继续拆解。
fn split_authority_and_tail(scheme: &str, rest: &str) -> Result<HttpTarget, TargetRejection> {
    if rest.contains('#') {
        // fragment：URI 语法层已禁（《06》§2.3），Location 携带即结构非法。
        return Err(TargetRejection::Malformed);
    }
    // 切 authority：到首个 `/` 或 `?`（`?` 直贴 authority 的退化形路径补 `/`）。
    let boundary = match (rest.find('/'), rest.find('?')) {
        (Some(slash), Some(question)) => Some(slash.min(question)),
        (Some(slash), None) => Some(slash),
        (None, Some(question)) => Some(question),
        (None, None) => None,
    };
    let (authority, tail) = match boundary {
        Some(pos) => (&rest[..pos], &rest[pos..]),
        None => (rest, ""),
    };
    if authority.contains('@') {
        return Err(TargetRejection::UserInfo);
    }
    let (host_raw, port) = split_host_port(authority, scheme)?;
    let host = canonical_host_text(host_raw)?;
    let (path, query) = split_path_query(tail);
    Ok(HttpTarget {
        scheme: scheme.to_owned(),
        host,
        port,
        path,
        query,
    })
}

/// 拆 `host[:port]`（IPv6 方括号形按末冒号在 `]` 之后判定）。
fn split_host_port<'a>(
    authority: &'a str,
    scheme: &str,
) -> Result<(&'a str, u16), TargetRejection> {
    let fallback = || default_port(scheme).ok_or(TargetRejection::InvalidPort);
    if authority.starts_with('[') {
        let end = authority.find(']').ok_or(TargetRejection::Malformed)?;
        let host = &authority[..=end];
        let remainder = &authority[end + 1..];
        if remainder.is_empty() {
            return Ok((host, fallback()?));
        }
        let port_text = remainder
            .strip_prefix(':')
            .ok_or(TargetRejection::Malformed)?;
        return Ok((host, parse_port(port_text)?));
    }
    match authority.rsplit_once(':') {
        Some((host, port_text)) if !port_text.is_empty() && !host.contains(':') => {
            Ok((host, parse_port(port_text)?))
        }
        _ => Ok((authority, fallback()?)),
    }
}

fn parse_port(text: &str) -> Result<u16, TargetRejection> {
    if !text.chars().all(|ch| ch.is_ascii_digit()) {
        return Err(TargetRejection::InvalidPort);
    }
    let port: u32 = text.parse().map_err(|_| TargetRejection::InvalidPort)?;
    if port == 0 || port > u32::from(u16::MAX) {
        return Err(TargetRejection::InvalidPort);
    }
    Ok(port as u16)
}

/// 主机文本规范化：IPv6 方括号剥离校验，IPv4 字面量直存，域名小写 + IDNA。
fn canonical_host_text(raw: &str) -> Result<String, TargetRejection> {
    let raw = raw.strip_prefix('[').unwrap_or(raw);
    let raw = raw.strip_suffix(']').unwrap_or(raw);
    if raw.is_empty() {
        return Err(TargetRejection::EmptyHost);
    }
    if raw.contains(':') {
        Ipv6Addr::from_str(raw).map_err(|_| TargetRejection::Malformed)?;
        return Ok(raw.to_ascii_lowercase());
    }
    let lowered = raw.to_ascii_lowercase();
    if lowered.parse::<std::net::Ipv4Addr>().is_ok() {
        return Ok(lowered);
    }
    if lowered
        .chars()
        .any(|ch| matches!(ch, '[' | ']' | '@' | '/' | '?'))
    {
        return Err(TargetRejection::Malformed);
    }
    idna::domain_to_ascii(&lowered).map_err(|_| TargetRejection::Malformed)
}

/// 拆 `path[?query]`；空路径补 `/`。
fn split_path_query(tail: &str) -> (String, Option<String>) {
    match tail.split_once('?') {
        Some((path, query)) => (
            if path.is_empty() {
                "/".to_owned()
            } else {
                path.to_owned()
            },
            Some(query.to_owned()),
        ),
        None => (
            if tail.is_empty() {
                "/".to_owned()
            } else {
                tail.to_owned()
            },
            None,
        ),
    }
}

/// 按 RFC 3986 §5.2 化简 `.` / `..` 段（重定向相对 Location 拼接用）。
fn remove_dot_segments(path: &str) -> String {
    let mut output: Vec<&str> = Vec::new();
    let trailing_slash = path.ends_with('/');
    for segment in path.split('/') {
        match segment {
            "" | "." => continue,
            ".." => {
                output.pop();
            }
            other => output.push(other),
        }
    }
    let mut joined = String::new();
    for segment in output {
        joined.push('/');
        joined.push_str(segment);
    }
    if joined.is_empty() {
        "/".to_owned()
    } else if trailing_slash {
        joined.push('/');
        joined
    } else {
        joined
    }
}

/// 解析重定向 `Location`（绝对 / 协议相对 / 绝对路径 / 相对路径 / 纯查询）。
pub fn resolve_location(base: &HttpTarget, location: &str) -> Result<HttpTarget, TargetRejection> {
    let location = location.trim();
    if location.is_empty() {
        return Err(TargetRejection::Malformed);
    }
    if location.contains("://") {
        return parse_target_url(location);
    }
    if let Some(rest) = location.strip_prefix("//") {
        return split_authority_and_tail(&base.scheme, rest);
    }
    if location.starts_with('/') {
        let (path, query) = split_path_query(location);
        return Ok(HttpTarget {
            scheme: base.scheme.clone(),
            host: base.host.clone(),
            port: base.port,
            path: remove_dot_segments(&path),
            query,
        });
    }
    if let Some(query) = location.strip_prefix('?') {
        return Ok(HttpTarget {
            scheme: base.scheme.clone(),
            host: base.host.clone(),
            port: base.port,
            path: base.path.clone(),
            query: Some(query.to_owned()),
        });
    }
    // 相对当前路径目录。
    let dir = match base.path.rfind('/') {
        Some(pos) => &base.path[..=pos],
        None => "/",
    };
    let merged = format!("{dir}{location}");
    let (path, query) = split_path_query(&merged);
    Ok(HttpTarget {
        scheme: base.scheme.clone(),
        host: base.host.clone(),
        port: base.port,
        path: remove_dot_segments(&path),
        query,
    })
}

/// SSRF 地址族矩阵（《04》§8.3）：环回、私网、链路本地、组播、未指定
/// 与 IPv4 映射 IPv6 一律拦截。
///
/// IPv6 侧：`::1` 环回、`::` 未指定、`ff00::/8` 组播、`fc00::/7`
/// 唯一本地地址（v6 私网族）与任何 IPv4 映射地址（`::ffff:0:0/96`，
/// 无论内嵌 v4 是否公网——在册拒绝项按族整体拦截）。
#[must_use]
pub fn address_is_blocked(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_multicast()
                || v4.is_unspecified()
        }
        IpAddr::V6(v6) => {
            if v6.to_ipv4_mapped().is_some() {
                return true;
            }
            if v6.is_loopback() || v6.is_unspecified() {
                return true;
            }
            let octets = v6.octets();
            // 组播 ff00::/8；唯一本地 fc00::/7（首字节 & 0xfe == 0xfc）。
            octets[0] == 0xff || (octets[0] & 0xfe) == 0xfc
        }
    }
}

// ---------------------------------------------------------------------------
// Cache-Control 解析与版本戳
// ---------------------------------------------------------------------------

/// `Cache-Control` 指令摘要（在册消费面：`no-store` 与 `max-age`）。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CacheDirectives {
    /// `no-store`：响应不得落盘持久（《04》§8.4）。
    pub no_store: bool,
    /// `max-age=<秒>`：新鲜期上限（响应头有效期优先于默认 TTL）。
    pub max_age: Option<u64>,
}

/// 解析 `Cache-Control` 头值（逗号分隔、可带引号参数）。
#[must_use]
pub fn parse_cache_control(value: &str) -> CacheDirectives {
    let mut directives = CacheDirectives::default();
    for item in value.split(',') {
        let item = item.trim();
        let (token, param) = match item.split_once('=') {
            Some((token, param)) => (token.trim(), param.trim().trim_matches('"')),
            None => (item, ""),
        };
        match token.to_ascii_lowercase().as_str() {
            "no-store" => directives.no_store = true,
            "max-age" => {
                if let Ok(seconds) = param.parse::<u64>() {
                    // 多 max-age 条目取最小值语义（从严）。
                    directives.max_age =
                        Some(directives.max_age.map_or(seconds, |old| old.min(seconds)));
                }
            }
            _ => {}
        }
    }
    directives
}

/// 版本戳推导（ETag > Last-Modified 派生 > 尺寸兜底，《04》§3.2/§6.5）。
#[must_use]
pub fn version_stamp(etag: Option<&str>, last_modified: Option<&str>, size: u64) -> String {
    if let Some(etag) = etag {
        return etag.to_owned();
    }
    if let Some(last_modified) = last_modified {
        return format!("lm:{last_modified}");
    }
    format!("len:{size}")
}

// ---------------------------------------------------------------------------
// 请求头净化
// ---------------------------------------------------------------------------

/// 组装单跳请求头：平台 UA + Accept + 同源条件验证器（跨跳即弃）+
/// Range 透传。任何情况下不含 Cookie / Authorization / Referer
/// （《04》§8.4「默认不携带 Cookie/Authorization」「平台 UA、无 Referer」）。
fn build_request_headers(
    conditional: Option<&[(String, String)]>,
    same_origin: bool,
    range: Option<&ByteRange>,
) -> Vec<(String, String)> {
    let mut headers = vec![
        ("user-agent".to_owned(), PLATFORM_USER_AGENT.to_owned()),
        ("accept".to_owned(), "*/*".to_owned()),
    ];
    if same_origin {
        if let Some(items) = conditional {
            for (name, value) in items {
                let lowered = name.to_ascii_lowercase();
                if lowered == IF_NONE_MATCH || lowered == IF_MODIFIED_SINCE {
                    headers.push((lowered, value.clone()));
                }
            }
        }
    }
    if let Some(range) = range {
        let value = match range.length {
            Some(length) => format!(
                "bytes={}-{}",
                range.offset,
                range.offset.saturating_add(length).saturating_sub(1)
            ),
            None => format!("bytes={}-", range.offset),
        };
        headers.push(("range".to_owned(), value));
    }
    headers
}

// ---------------------------------------------------------------------------
// HttpProvider
// ---------------------------------------------------------------------------

/// 响应头裁决素材（新鲜期、版本戳、可持久性判定）。
struct Freshness {
    version: String,
    etag: Option<String>,
    last_modified: Option<String>,
    fresh_until_millis: u64,
    persistable: bool,
    size: u64,
    mime: String,
}

/// 条件请求验证器（L2 条目 → 条件请求头素材，《04》§6.2 ETag 优先）。
fn conditional_headers(entry: &DiskEntry) -> Option<Vec<(String, String)>> {
    if let Some(etag) = &entry.meta.etag {
        return Some(vec![(IF_NONE_MATCH.to_owned(), etag.clone())]);
    }
    if let Some(last_modified) = &entry.meta.last_modified {
        return Some(vec![(IF_MODIFIED_SINCE.to_owned(), last_modified.clone())]);
    }
    None
}

/// 按字节范围切片（全量体消费臂；offset 越界回空）。
fn slice_range(mut body: Vec<u8>, range: Option<ByteRange>) -> Vec<u8> {
    let Some(range) = range else {
        return body;
    };
    let start = (range.offset as usize).min(body.len());
    let mut tail = body.split_off(start);
    if let Some(length) = range.length {
        let keep = (length as usize).min(tail.len());
        tail.truncate(keep);
    }
    tail
}

/// 网络抓取 Provider：策略引擎 + L2 条件请求集成（《04》§3.3 HttpProvider
/// 行、§8 全量口径）。
///
/// 构造注入 [`ResourceLimits`]（三超时/重定向上限/2 GiB 上限/TTL 常量取
/// 自册值）与 [`HttpRequestPort`]（真实网络栈由宿主提供）；L2 经
/// [`with_cache`](Self::with_cache) 挂 Manager 同源 [`CacheStore`]，
/// 磁盘根由宿主 `attach_disk` 注入（§6.2）。
pub struct HttpProvider {
    limits: ResourceLimits,
    port: Arc<dyn HttpRequestPort>,
    cache: Option<Arc<CacheStore>>,
}

impl std::fmt::Debug for HttpProvider {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("HttpProvider")
            .field("provider_id", &HTTP_PROVIDER_ID)
            .field("cache_attached", &self.cache.is_some())
            .finish_non_exhaustive()
    }
}

/// 策略引擎单跳产出（净化后的最终响应）。
struct HopOutcome {
    response: HttpResponse,
}

impl HttpProvider {
    /// 构造（不挂缓存：仅策略面生效）。
    #[must_use]
    pub fn new(limits: &ResourceLimits, port: Arc<dyn HttpRequestPort>) -> Self {
        Self {
            limits: limits.clone(),
            port,
            cache: None,
        }
    }

    /// 挂 L2 缓存面（与 Manager 共用同一 [`CacheStore`]，《04》§6.2/§8.4）。
    #[must_use]
    pub fn with_cache(mut self, cache: Arc<CacheStore>) -> Self {
        self.cache = Some(cache);
        self
    }

    /// 在册缓存键（与 Manager L1 侧 `cache_key_for_uri` 同源零漂移）。
    fn cache_key(&self, address: &ResourceAddress, version: &str) -> CacheKey {
        cache_key_for_uri(&self.limits, address, version)
    }

    /// 从资源地址重建首跳目标（canonical URI → 绝对 URL）。
    fn target_of(&self, address: &ResourceAddress) -> Result<HttpTarget, ResourceError> {
        let uri = resolve_input(&address.uri, &self.limits).map_err(|_| ResourceError::Internal)?;
        let origin = uri.external.as_ref().ok_or(ResourceError::Internal)?;
        if origin.scheme != "http" && origin.scheme != "https" {
            return Err(ResourceError::UnsupportedScheme {
                uri: address.uri.clone(),
            });
        }
        let host = canonical_host_text(&origin.host).map_err(|_| ResourceError::NetworkFailed {
            uri: address.uri.clone(),
            reason: NetworkErrorReason::Blocked,
            status: None,
        })?;
        let port = match origin.port {
            Some(port) => port,
            None => default_port(&origin.scheme).ok_or(ResourceError::Internal)?,
        };
        let path = match &uri.path {
            Some(path) => format!("/{}", path.as_str()),
            None => "/".to_owned(),
        };
        Ok(HttpTarget {
            scheme: origin.scheme.clone(),
            host,
            port,
            path,
            query: uri.query.clone(),
        })
    }

    /// 策略主循环：逐跳 resolve + 地址族拦截 + 净化 send + 重定向复核
    /// （《04》§8.2/§8.3；总跳数 ≤ `redirect_limit`）。
    async fn run_policy_loop(
        &self,
        address: &ResourceAddress,
        first: &HttpTarget,
        method: HttpMethod,
        conditional: Option<Vec<(String, String)>>,
        range: Option<ByteRange>,
    ) -> Result<HopOutcome, ResourceError> {
        let uri_text = address.uri.clone();
        let mut target = first.clone();
        let mut conditional = conditional;
        for hop in 0..=self.limits.redirect_limit {
            // 逐跳重解析 + SSRF 地址族拦截（DNS rebinding 防御）。
            let addresses = self
                .port
                .resolve(&target.host, target.port)
                .await
                .map_err(|failure| map_port_failure(&uri_text, failure))?;
            if addresses.is_empty() {
                return Err(ResourceError::NetworkFailed {
                    uri: uri_text,
                    reason: NetworkErrorReason::Dns,
                    status: None,
                });
            }
            if addresses.iter().any(address_is_blocked) {
                return Err(ResourceError::NetworkFailed {
                    uri: uri_text.clone(),
                    reason: NetworkErrorReason::Blocked,
                    status: None,
                });
            }
            let request = HttpRequest {
                method,
                url: target.url(),
                headers: build_request_headers(
                    conditional.as_deref(),
                    target.same_origin(first),
                    range.as_ref(),
                ),
                connect_timeout: Duration::from_millis(self.limits.connect_timeout_ms),
                first_byte_timeout: Duration::from_millis(self.limits.first_byte_timeout_ms),
                idle_timeout: Duration::from_millis(self.limits.idle_timeout_ms),
                max_response_bytes: self.limits.max_resource_bytes,
            };
            let response = self
                .port
                .send(&request)
                .await
                .map_err(|failure| map_port_failure(&uri_text, failure))?;
            // 响应体上限双保险（port 违约多吐也拦，《04》§8.2）。
            if method == HttpMethod::Get
                && (200..300).contains(&response.status)
                && response.body.len() as u64 > self.limits.max_resource_bytes
            {
                return Err(ResourceError::TooLarge {
                    uri: uri_text,
                    size: response.body.len() as u64,
                    limit: self.limits.max_resource_bytes,
                });
            }
            if (300..400).contains(&response.status) && response.status != 304 {
                // 重定向族：逐跳协议 + userinfo 复校验（§8.2）。
                let next = match response.header("location") {
                    Some(location) => match resolve_location(&target, location) {
                        Ok(next) => next,
                        Err(_) => {
                            return Err(ResourceError::NetworkFailed {
                                uri: uri_text.clone(),
                                reason: NetworkErrorReason::Redirect,
                                status: Some(response.status),
                            })
                        }
                    },
                    None => {
                        return Err(ResourceError::NetworkFailed {
                            uri: uri_text.clone(),
                            reason: NetworkErrorReason::Redirect,
                            status: Some(response.status),
                        })
                    }
                };
                if hop == self.limits.redirect_limit {
                    // 跳数用尽仍是 3xx：超限拒绝（《04》§8.2 ≤ redirect_limit）。
                    return Err(ResourceError::NetworkFailed {
                        uri: uri_text.clone(),
                        reason: NetworkErrorReason::Redirect,
                        status: Some(response.status),
                    });
                }
                if !next.same_origin(&target) {
                    // 跨 origin 即弃条件验证器（§8.4 不存跨变体的对偶：
                    // 也不外发）。
                    conditional = None;
                }
                target = next;
                continue;
            }
            if (200..300).contains(&response.status) || response.status == 304 {
                return Ok(HopOutcome { response });
            }
            return Err(ResourceError::NetworkFailed {
                uri: uri_text,
                reason: NetworkErrorReason::HttpStatus,
                status: Some(response.status),
            });
        }
        // 理论不可达（循环内 3xx 臂已封顶）；防御臂按重定向族收口。
        Err(ResourceError::NetworkFailed {
            uri: uri_text,
            reason: NetworkErrorReason::Redirect,
            status: None,
        })
    }

    /// 响应头 → 缓存裁决素材（版本戳、TTL、可持久性判定）。
    fn read_freshness(&self, response: &HttpResponse, fallback_path: &str) -> Freshness {
        let directives = response
            .header("cache-control")
            .map(parse_cache_control)
            .unwrap_or_default();
        let etag = response.header("etag").map(|value| value.trim().to_owned());
        let last_modified = response
            .header("last-modified")
            .map(|value| value.trim().to_owned());
        let size = response.body.len() as u64;
        let mime = mime_of_response(response, fallback_path);
        let version = version_stamp(etag.as_deref(), last_modified.as_deref(), size);
        let fresh_until_millis = fresh_until(&directives, self.limits.external_ttl_seconds);
        // 落盘资格：非 no-store、有验证器、完整响应体（200；206 部分体
        // 不足以持久，《04》§8.4/《04.13》#6）。
        let has_validator = etag.is_some() || last_modified.is_some();
        let persistable = !directives.no_store && has_validator && response.status == 200;
        Freshness {
            version,
            etag,
            last_modified,
            fresh_until_millis,
            persistable,
            size,
            mime,
        }
    }

    /// L0 验证器线索探针（version 维度不参与 L0 键；无视 TTL，专供 L2
    /// 条件复验构键，《04》§6.1/§6.2）。
    fn l0_probe(&self, address: &ResourceAddress) -> Option<CachedMetadata> {
        let store = self.cache.as_ref()?;
        let key = self.cache_key(address, "");
        store.metadata_probe(&key)
    }

    /// 落 L2（磁盘条目；epoch 竞态再校验由 [`CacheStore::disk_insert`] 守）。
    fn persist_l2(&self, address: &ResourceAddress, freshness: &Freshness, body: Vec<u8>) {
        let Some(store) = &self.cache else {
            return;
        };
        if !freshness.persistable {
            return;
        }
        let key = self.cache_key(address, &freshness.version);
        let meta = DiskMeta {
            cache_key: key.flight_key(),
            etag: freshness.etag.clone(),
            last_modified: freshness.last_modified.clone(),
            fresh_until_millis: freshness.fresh_until_millis,
            stored_at_millis: now_millis(),
        };
        // 读取时刻 epoch：抓取前快照，竞态失效则丢弃写入。
        store.disk_insert(&key, body, meta, store.epoch());
    }

    /// 回填 L0（响应头有效期口径，《04》§6.1/§6.3；External 恒设
    /// `expires_at`，受管臂不在此面）。
    fn fill_l0(&self, address: &ResourceAddress, freshness: &Freshness) {
        let Some(store) = &self.cache else {
            return;
        };
        let key = self.cache_key(address, &freshness.version);
        let remaining = freshness.fresh_until_millis.saturating_sub(now_millis());
        store.metadata_insert(
            &key,
            CachedMetadata {
                size: freshness.size,
                mime: freshness.mime.clone(),
                version: freshness.version.clone(),
                etag: freshness.etag.clone(),
                last_modified: freshness.last_modified.clone(),
                expires_at: Some(Instant::now() + Duration::from_millis(remaining)),
            },
        );
    }

    /// 读取主体管线：L2 新鲜命中 → 条件复验 → 直连抓取（《04》§6.2/§8.4）。
    async fn fetch(
        &self,
        address: &ResourceAddress,
        range: Option<ByteRange>,
    ) -> Result<Vec<u8>, ResourceError> {
        let first = self.target_of(address)?;
        // L2 快路径：L0 身份探针给版本线索 → 构键查盘。
        if let Some(store) = &self.cache {
            if let Some(probe) = self.l0_probe(address) {
                let key = self.cache_key(address, &probe.version);
                if let Some(entry) = store.disk_get(&key) {
                    if entry.is_fresh() {
                        // 磁盘新鲜命中：零网络往返（《04》§6.2）。
                        return Ok(slice_range(entry.body, range));
                    }
                    // 陈旧条目：条件请求复验（ETag/If-None-Match 族）。
                    if let Some(conditional) = conditional_headers(&entry) {
                        let outcome = self
                            .run_policy_loop(
                                address,
                                &first,
                                HttpMethod::Get,
                                Some(conditional),
                                None,
                            )
                            .await?;
                        if outcome.response.status == 304 {
                            // 复验命中：磁盘体回吐并刷新新鲜期。
                            let freshness = self.read_freshness(&outcome.response, &first.path);
                            let refreshed = DiskMeta {
                                cache_key: key.flight_key(),
                                etag: entry.meta.etag.clone().or(freshness.etag.clone()),
                                last_modified: entry
                                    .meta
                                    .last_modified
                                    .clone()
                                    .or(freshness.last_modified.clone()),
                                fresh_until_millis: if freshness.fresh_until_millis == 0 {
                                    entry.meta.fresh_until_millis
                                } else {
                                    freshness.fresh_until_millis
                                },
                                stored_at_millis: now_millis(),
                            };
                            store.disk_insert(&key, entry.body.clone(), refreshed, store.epoch());
                            let stale = outcome
                                .response
                                .header("cache-control")
                                .map(parse_cache_control)
                                .is_some_and(|directives| directives.no_store);
                            if !stale {
                                self.fill_l0(address, &entry_freshness(&entry, &probe, &freshness));
                            }
                            return Ok(slice_range(entry.body, range));
                        }
                        // 2xx 新体：按裁决持久 + 回填。
                        let freshness = self.read_freshness(&outcome.response, &first.path);
                        let body = outcome.response.body;
                        self.persist_l2(address, &freshness, body.clone());
                        self.fill_l0(address, &freshness);
                        return Ok(slice_range(body, range));
                    }
                }
            }
        }
        // 直连抓取（Range 透传，《04》§8.2「不支持时流式丢弃至 offset」）。
        let outcome = self
            .run_policy_loop(address, &first, HttpMethod::Get, None, range)
            .await?;
        let status = outcome.response.status;
        let freshness = self.read_freshness(&outcome.response, &first.path);
        if status == 200 {
            // 全量体：可持久则落 L2 + 回填 L0；offset>0 且上游忽略
            // Range 时丢弃至 offset。
            let body = outcome.response.body;
            self.persist_l2(address, &freshness, body.clone());
            self.fill_l0(address, &freshness);
            return Ok(slice_range(body, range));
        }
        // 206 部分体：已按 offset 就位，length 截断；不持久、不回填。
        let mut body = outcome.response.body;
        if let Some(range) = range {
            if let Some(length) = range.length {
                let keep = (length as usize).min(body.len());
                body.truncate(keep);
            }
        }
        Ok(body)
    }

    /// 写入族纵深臂：`RESOURCE_READ_ONLY`（`details.uri` 取精确目标 uri，
    /// 与 ArchiveProvider 同口径，工单044 裁定 §三.5-⑧-2）。
    fn read_only(address: &ResourceAddress) -> ChipsError {
        ResourceError::ReadOnly {
            uri: address.uri.clone(),
        }
        .to_chips_error()
    }
}

fn map_port_failure(uri: &str, failure: HttpPortFailure) -> ResourceError {
    match failure {
        HttpPortFailure::Failed { reason, .. } => ResourceError::NetworkFailed {
            uri: uri.to_owned(),
            reason: match reason {
                NetworkErrorReason::HttpStatus
                | NetworkErrorReason::Redirect
                | NetworkErrorReason::Blocked => NetworkErrorReason::Blocked,
                other => other,
            },
            status: None,
        },
        HttpPortFailure::TooLarge {
            limit_bytes,
            actual_bytes,
        } => ResourceError::TooLarge {
            uri: uri.to_owned(),
            size: actual_bytes.unwrap_or_else(|| limit_bytes.saturating_add(1)),
            limit: limit_bytes,
        },
    }
}

/// 响应 Content-Type → mime（缺省回退路径猜测，《04》§3.4）。
fn mime_of_response(response: &HttpResponse, fallback_path: &str) -> String {
    response
        .header("content-type")
        .map(|value| value.split(';').next().unwrap_or(value).trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| guess_mime_type(fallback_path))
}

/// 新鲜期截止（`max-age` 优先，缺省回退 externalTtlSeconds，《04》§6.3）。
fn fresh_until(directives: &CacheDirectives, default_ttl_seconds: u64) -> u64 {
    if directives.no_store {
        return 0;
    }
    let ttl_millis = match directives.max_age {
        Some(seconds) => seconds.saturating_mul(1000),
        None => default_ttl_seconds.saturating_mul(1000),
    };
    now_millis().saturating_add(ttl_millis)
}

/// 304 复验命中臂的 L0 素材：版本与尺寸沿用磁盘条目/L0 探针，
/// 新鲜期取 304 响应裁决。
fn entry_freshness(
    entry: &DiskEntry,
    probe: &CachedMetadata,
    response_freshness: &Freshness,
) -> Freshness {
    Freshness {
        version: probe.version.clone(),
        etag: response_freshness
            .etag
            .clone()
            .or_else(|| entry.meta.etag.clone()),
        last_modified: response_freshness
            .last_modified
            .clone()
            .or_else(|| entry.meta.last_modified.clone()),
        fresh_until_millis: response_freshness.fresh_until_millis,
        persistable: false,
        size: entry.body.len() as u64,
        mime: probe.mime.clone(),
    }
}

#[async_trait]
impl ResourceProvider for HttpProvider {
    fn id(&self) -> &'static str {
        HTTP_PROVIDER_ID
    }

    fn supports_streaming(&self) -> bool {
        // 在册流式形态：策略抓取缓冲后分片呈现（见模块头「在册解释」）。
        true
    }

    fn supports_write(&self) -> bool {
        false
    }

    async fn stat(&self, address: &ResourceAddress) -> Result<ResourceMetadata, ChipsError> {
        let first = self.target_of(address)?;
        // HEAD 探测（不产生网络体拉取，《04》§6.3 HttpProvider 行）。
        let outcome = self
            .run_policy_loop(address, &first, HttpMethod::Head, None, None)
            .await?;
        let response = &outcome.response;
        let directives = response
            .header("cache-control")
            .map(parse_cache_control)
            .unwrap_or_default();
        let etag = response.header("etag").map(|value| value.trim().to_owned());
        let last_modified = response
            .header("last-modified")
            .map(|value| value.trim().to_owned());
        let size = response
            .header("content-length")
            .and_then(|value| value.trim().parse::<u64>().ok())
            .unwrap_or(0);
        let mime = mime_of_response(response, &first.path);
        let version = version_stamp(etag.as_deref(), last_modified.as_deref(), size);
        let freshness = Freshness {
            version: version.clone(),
            etag,
            last_modified,
            fresh_until_millis: fresh_until(&directives, self.limits.external_ttl_seconds),
            persistable: false,
            size,
            mime: mime.clone(),
        };
        self.fill_l0(address, &freshness);
        Ok(ResourceMetadata {
            uri: address.uri.clone(),
            size,
            mime_type: mime,
            version,
            scope: ScopeKind::External,
        })
    }

    async fn read_range(
        &self,
        address: &ResourceAddress,
        range: ByteRange,
    ) -> Result<Vec<u8>, ChipsError> {
        let bytes = self.fetch(address, Some(range)).await?;
        Ok(bytes)
    }

    async fn open_stream(
        &self,
        address: &ResourceAddress,
    ) -> Result<Box<dyn ResourceStream>, ChipsError> {
        let data = self.fetch(address, None).await?;
        Ok(Box::new(HttpStream { data, position: 0 }))
    }

    async fn list_directory(
        &self,
        address: &ResourceAddress,
    ) -> Result<Vec<DirectoryEntry>, ChipsError> {
        // 《06》§7.2 在册臂：External 作用域不支持列举。
        Err(ResourceError::NotSupported {
            uri: address.uri.clone(),
            scope: ScopeKind::External,
            operation: ScopeOperation::List,
        }
        .to_chips_error())
    }

    async fn write(
        &self,
        address: &ResourceAddress,
        _data: &[u8],
    ) -> Result<ResourceMetadata, ChipsError> {
        Err(Self::read_only(address))
    }

    async fn delete(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
        Err(Self::read_only(address))
    }

    async fn rename(
        &self,
        from: &ResourceAddress,
        _to: &ResourceAddress,
    ) -> Result<(), ChipsError> {
        Err(Self::read_only(from))
    }

    async fn copy(&self, from: &ResourceAddress, _to: &ResourceAddress) -> Result<(), ChipsError> {
        Err(Self::read_only(from))
    }

    async fn create_directory(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
        Err(Self::read_only(address))
    }

    async fn set_metadata(
        &self,
        address: &ResourceAddress,
        _metadata: FileMetadata,
    ) -> Result<(), ChipsError> {
        Err(Self::read_only(address))
    }
}

/// HTTP 字节流游标：缓冲分片呈现（《04》§3.2 `open_stream` 形状；
/// `None` 表示结尾）。
pub struct HttpStream {
    data: Vec<u8>,
    position: usize,
}

#[async_trait]
impl ResourceStream for HttpStream {
    async fn next_chunk(&mut self, max_bytes: usize) -> Result<Option<Vec<u8>>, ChipsError> {
        if self.position >= self.data.len() {
            return Ok(None);
        }
        let end = self
            .position
            .saturating_add(max_bytes.max(1))
            .min(self.data.len());
        let chunk = self.data[self.position..end].to_vec();
        self.position = end;
        Ok(Some(chunk))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(text: &str) -> IpAddr {
        IpAddr::from_str(text).expect("测试地址字面量必须可解析")
    }

    #[test]
    fn test_ssrf_address_matrix_ipv4() {
        // 环回/私网三段/链路本地/组播/未指定在册拦截。
        for blocked in [
            "127.0.0.1",
            "127.255.255.255",
            "10.1.2.3",
            "172.16.0.1",
            "172.31.255.255",
            "192.168.0.10",
            "169.254.169.254",
            "224.0.0.1",
            "239.10.0.1",
            "0.0.0.0",
        ] {
            assert!(address_is_blocked(&ip(blocked)), "{blocked} 必须拦截");
        }
        // 公网在册放行（CGNAT 100.64/10 未在《04》§8.3 禁区词表，放行并
        // 在 README 漂移登记注明）。
        for allowed in ["8.8.8.8", "100.64.0.1", "172.15.0.1", "172.32.0.1"] {
            assert!(!address_is_blocked(&ip(allowed)), "{allowed} 必须放行");
        }
    }

    #[test]
    fn test_ssrf_address_matrix_ipv6() {
        for blocked in [
            "::1",
            "::",
            "ff02::1",
            "fc00::1",
            "fd12:3456::7",
            "::ffff:127.0.0.1",
            // IPv4 映射族按地址族整体拦截（含公网内嵌，《04》§8.3）。
            "::ffff:8.8.8.8",
        ] {
            assert!(address_is_blocked(&ip(blocked)), "{blocked} 必须拦截");
        }
        assert!(!address_is_blocked(&ip("2001:db8::1")));
        assert!(!address_is_blocked(&ip("2606:4700:4700::1111")));
    }

    #[test]
    fn test_parse_target_url_ok() {
        let target =
            parse_target_url("https://CDN.example.com/a%20b.png?x=1").expect("在册绝对 URL");
        assert_eq!(target.scheme, "https");
        assert_eq!(target.host, "cdn.example.com");
        assert_eq!(target.port, 443);
        assert_eq!(target.path, "/a%20b.png");
        assert_eq!(target.query.as_deref(), Some("x=1"));
        assert_eq!(target.url(), "https://cdn.example.com/a%20b.png?x=1");
        assert_eq!(target.origin(), "https://cdn.example.com");

        let explicit = parse_target_url("http://example.com:8080/x").expect("显式端口");
        assert_eq!(explicit.port, 8080);
        assert_eq!(explicit.url(), "http://example.com:8080/x");
        let bare = parse_target_url("http://example.com").expect("无路径退化形");
        assert_eq!(bare.path, "/");
        assert_eq!(bare.port, 80);
        let query_only = parse_target_url("https://example.com?q=1").expect("查询直贴");
        assert_eq!(query_only.path, "/");
        assert_eq!(query_only.query.as_deref(), Some("q=1"));
        let v6 = parse_target_url("https://[::1]:8443/x").expect("IPv6 方括号");
        assert_eq!(v6.host, "::1");
        assert_eq!(v6.url(), "https://[::1]:8443/x");
        let v6_default = parse_target_url("https://[2001:db8::1]/x").expect("IPv6 默认端口");
        assert_eq!(v6_default.port, 443);
        assert_eq!(v6_default.url(), "https://[2001:db8::1]/x");
        let idn = parse_target_url("https://EXAMPLE.COM/x").expect("大写归一");
        assert_eq!(idn.host, "example.com");
    }

    #[test]
    fn test_parse_target_url_rejections() {
        assert_eq!(
            parse_target_url("https://user:pw@example.com/x").unwrap_err(),
            TargetRejection::UserInfo
        );
        assert_eq!(
            parse_target_url("https://token@example.com/x").unwrap_err(),
            TargetRejection::UserInfo
        );
        assert_eq!(
            parse_target_url("ftp://example.com/x").unwrap_err(),
            TargetRejection::UnsupportedScheme
        );
        assert_eq!(
            parse_target_url("https:///x").unwrap_err(),
            TargetRejection::EmptyHost
        );
        assert_eq!(
            parse_target_url("https://example.com:0/x").unwrap_err(),
            TargetRejection::InvalidPort
        );
        assert_eq!(
            parse_target_url("https://example.com:99999/x").unwrap_err(),
            TargetRejection::InvalidPort
        );
        assert_eq!(
            parse_target_url("https://example.com:8o0/x").unwrap_err(),
            TargetRejection::InvalidPort
        );
        assert_eq!(
            parse_target_url("https://example.com/x#frag").unwrap_err(),
            TargetRejection::Malformed
        );
        assert_eq!(
            parse_target_url("not-a-url").unwrap_err(),
            TargetRejection::Malformed
        );
    }

    #[test]
    fn test_resolve_location_forms() {
        let base = parse_target_url("https://cdn.example.com/a/b/c.png?k=1").expect("base");
        // 绝对跳。
        let absolute =
            resolve_location(&base, "https://img.other.org/z.png").expect("绝对 Location");
        assert_eq!(absolute.host, "img.other.org");
        assert_eq!(absolute.path, "/z.png");
        // 协议相对。
        let schemeless = resolve_location(&base, "//cdn.example.com/x").expect("协议相对");
        assert_eq!(schemeless.scheme, "https");
        assert_eq!(schemeless.path, "/x");
        // 绝对路径。
        let rootish = resolve_location(&base, "/new/one.bin").expect("绝对路径");
        assert_eq!(rootish.path, "/new/one.bin");
        // 相对当前目录。
        let relative = resolve_location(&base, "up.bin").expect("相对路径");
        assert_eq!(relative.path, "/a/b/up.bin");
        // 点段化简。
        let dotted = resolve_location(&base, "../x/./y").expect("点段");
        assert_eq!(dotted.path, "/a/x/y");
        // 纯查询。
        let query_only = resolve_location(&base, "?page=2").expect("查询替换");
        assert_eq!(query_only.path, "/a/b/c.png");
        assert_eq!(query_only.query.as_deref(), Some("page=2"));
        // 非法臂。
        assert_eq!(
            resolve_location(&base, "ftp://host/x").unwrap_err(),
            TargetRejection::UnsupportedScheme
        );
        assert_eq!(
            resolve_location(&base, "http://u:p@host/x").unwrap_err(),
            TargetRejection::UserInfo
        );
        assert_eq!(
            resolve_location(&base, "").unwrap_err(),
            TargetRejection::Malformed
        );
    }

    #[test]
    fn test_request_headers_sanitized() {
        let headers = build_request_headers(
            Some(&[
                ("if-none-match".to_owned(), "\"v1\"".to_owned()),
                ("authorization".to_owned(), "Bearer leak".to_owned()),
                ("cookie".to_owned(), "session=leak".to_owned()),
                ("referer".to_owned(), "https://leak/".to_owned()),
            ]),
            true,
            Some(&ByteRange {
                offset: 10,
                length: None,
            }),
        );
        let names: Vec<String> = headers
            .iter()
            .map(|(name, _)| name.to_ascii_lowercase())
            .collect();
        assert!(names.iter().any(|name| name == "user-agent"));
        assert!(names.iter().any(|name| name == "range"));
        assert!(names.iter().any(|name| name == "if-none-match"));
        for banned in ["cookie", "authorization", "referer"] {
            assert!(
                !names.iter().any(|name| name == banned),
                "{banned} 头绝不允许下发"
            );
        }
        let ua = headers
            .iter()
            .find(|(name, _)| name == "user-agent")
            .expect("UA 必在");
        assert_eq!(ua.1, PLATFORM_USER_AGENT);
        // 闭区间 Range 形态。
        let closed = build_request_headers(
            None,
            true,
            Some(&ByteRange {
                offset: 4,
                length: Some(6),
            }),
        );
        assert!(closed
            .iter()
            .any(|(name, value)| name == "range" && value == "bytes=4-9"));
        // 跨 origin 臂：条件验证器即弃。
        let cross = build_request_headers(
            Some(&[("if-none-match".to_owned(), "\"v1\"".to_owned())]),
            false,
            None,
        );
        assert!(!cross
            .iter()
            .any(|(name, _)| name.eq_ignore_ascii_case("if-none-match")));
    }

    #[test]
    fn test_cache_control_parsing() {
        let directives = parse_cache_control("no-store, max-age=120");
        assert!(directives.no_store);
        assert_eq!(directives.max_age, Some(120));
        let quoted = parse_cache_control("public, max-age=\"60\"");
        assert_eq!(quoted.max_age, Some(60));
        assert!(!quoted.no_store);
        let empty = parse_cache_control("");
        assert_eq!(empty, CacheDirectives::default());
    }

    #[test]
    fn test_fresh_until_priority() {
        // max-age 响应头有效期优先于默认 TTL（《04》§6.3/§8.4）。
        let with_max_age = CacheDirectives {
            no_store: false,
            max_age: Some(7),
        };
        let until = fresh_until(&with_max_age, 300);
        assert!(until >= now_millis() + 7_000 && until <= now_millis() + 7_000 + 5_000);
        let fallback = CacheDirectives::default();
        let until = fresh_until(&fallback, 300);
        assert!(until >= now_millis() + 300_000 && until <= now_millis() + 300_000 + 5_000);
        let no_store = CacheDirectives {
            no_store: true,
            max_age: Some(9999),
        };
        assert_eq!(fresh_until(&no_store, 300), 0);
    }

    #[test]
    fn test_version_stamp_priority() {
        assert_eq!(version_stamp(Some("\"e1\""), Some("lm"), 5), "\"e1\"");
        assert_eq!(
            version_stamp(None, Some("Wed, 01 Jan 2025"), 5),
            "lm:Wed, 01 Jan 2025"
        );
        assert_eq!(version_stamp(None, None, 5), "len:5");
    }

    #[test]
    fn test_slice_range_semantics() {
        let body: Vec<u8> = (0u8..20).collect();
        assert_eq!(
            slice_range(
                body.clone(),
                Some(ByteRange {
                    offset: 5,
                    length: Some(4),
                })
            ),
            (5..9).collect::<Vec<u8>>()
        );
        assert_eq!(
            slice_range(
                body.clone(),
                Some(ByteRange {
                    offset: 18,
                    length: None,
                })
            ),
            vec![18, 19]
        );
        assert_eq!(
            slice_range(
                body.clone(),
                Some(ByteRange {
                    offset: 30,
                    length: Some(3),
                })
            ),
            Vec::<u8>::new()
        );
        assert_eq!(slice_range(body, None).len(), 20);
    }

    #[test]
    fn test_provider_flags() {
        struct NeverPort;
        #[async_trait]
        impl HttpRequestPort for NeverPort {
            async fn resolve(
                &self,
                _host: &str,
                _port: u16,
            ) -> Result<Vec<IpAddr>, HttpPortFailure> {
                unreachable!("flags 测试不触网")
            }
            async fn send(&self, _request: &HttpRequest) -> Result<HttpResponse, HttpPortFailure> {
                unreachable!("flags 测试不触网")
            }
        }
        let provider = HttpProvider::new(&ResourceLimits::default(), Arc::new(NeverPort));
        assert_eq!(provider.id(), "http");
        assert!(provider.supports_streaming());
        assert!(!provider.supports_write());
    }

    #[tokio::test]
    async fn test_write_family_read_only_arm_and_list_not_supported() {
        struct NeverPort;
        #[async_trait]
        impl HttpRequestPort for NeverPort {
            async fn resolve(
                &self,
                _host: &str,
                _port: u16,
            ) -> Result<Vec<IpAddr>, HttpPortFailure> {
                unreachable!("纵深臂测试不触网")
            }
            async fn send(&self, _request: &HttpRequest) -> Result<HttpResponse, HttpPortFailure> {
                unreachable!("纵深臂测试不触网")
            }
        }
        let provider = HttpProvider::new(&ResourceLimits::default(), Arc::new(NeverPort));
        let address = ResourceAddress {
            scope: "external".into(),
            path: crate::path_guard::VirtualPath::from_validated("a.bin".into()),
            uri: "chips-resource://external/https/pub.example.com/a.bin".into(),
        };
        let error = provider
            .write(&address, b"data")
            .await
            .expect_err("External 写入必拒");
        assert_eq!(error.code(), crate::error::RESOURCE_READ_ONLY);
        assert_eq!(
            error.details().expect("必须携带 details")["uri"],
            address.uri
        );
        let error = provider.delete(&address).await.unwrap_err();
        assert_eq!(error.code(), crate::error::RESOURCE_READ_ONLY);
        let error = provider
            .list_directory(&address)
            .await
            .expect_err("External 不支持列举");
        assert_eq!(error.code(), crate::error::RESOURCE_NOT_SUPPORTED);
        assert_eq!(
            error.details().expect("必须携带 details")["operation"],
            "list"
        );
    }
}
