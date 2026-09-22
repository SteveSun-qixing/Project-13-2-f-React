//! §8 网络抓取策略面的集成锁测（段三 #192）。
//!
//! 以注入式 [`HttpRequestPort`] 替身驱动，逐则钉住《04-资源管理设计》
//! §8.2/§8.3/§8.4 文字面：SSRF 地址族拦截（环回/私网/链路本地/组播/
//! 未指定/IPv4 映射 IPv6）、DNS rebinding 逐跳重解析复校验、重定向
//! 协议 + userinfo 复核与跳数上限、三超时常量下发、2 GiB 响应上限、
//! 请求头净化（无 Cookie/Authorization/Referer、平台 UA）、Range 透传
//! 与「不支持时流式丢弃至 offset」、L2 条件请求（ETag/If-None-Match
//! 族）与 no-store 不落盘，以及 NetworkFailed 错误形状。

use std::collections::{HashMap, VecDeque};
use std::net::IpAddr;
use std::str::FromStr;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use chips_core::NoopDecisionObserver;
use chips_resource::{
    address_is_blocked, ByteRange, CacheStore, HttpMethod, HttpPortFailure, HttpProvider,
    HttpRequest, HttpRequestPort, HttpResponse, OpenRequest, ResourceAddress, ResourceLimits,
    ResourceProvider, TargetRejection, PLATFORM_USER_AGENT,
};

// ---------------------------------------------------------------------------
// 替身 Port
// ---------------------------------------------------------------------------

#[derive(Default)]
struct MockState {
    /// host → 解析结果队列（逐次弹出；队列耗尽后复用最后一项）。
    resolve_plan: HashMap<String, VecDeque<Vec<IpAddr>>>,
    /// `send` 脚本：逐次弹出；耗尽后回报 `Failed{connect}`（测试即失败）。
    script: VecDeque<Result<HttpResponse, HttpPortFailure>>,
    /// 已下发的请求记录。
    recorded: Vec<HttpRequest>,
    /// 已发生的 resolve 调用（host, port）。
    resolved: Vec<(String, u16)>,
}

struct MockPort {
    state: Mutex<MockState>,
}

impl MockPort {
    fn new() -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(MockState::default()),
        })
    }

    fn plan(&self, host: &str, ips: Vec<&str>) {
        let mut state = self.state.lock().expect("替身锁不中毒");
        state
            .resolve_plan
            .entry(host.to_owned())
            .or_default()
            .push_back(
                ips.iter()
                    .map(|ip| IpAddr::from_str(ip).expect("替身地址字面量"))
                    .collect(),
            );
    }

    fn enqueue(&self, response: Result<HttpResponse, HttpPortFailure>) {
        self.state
            .lock()
            .expect("替身锁不中毒")
            .script
            .push_back(response);
    }

    fn send_count(&self) -> usize {
        self.state.lock().expect("替身锁不中毒").recorded.len()
    }

    fn resolve_count(&self) -> usize {
        self.state.lock().expect("替身锁不中毒").resolved.len()
    }

    fn resolved_hosts(&self) -> Vec<(String, u16)> {
        self.state.lock().expect("替身锁不中毒").resolved.clone()
    }

    fn last_request(&self) -> HttpRequest {
        self.state
            .lock()
            .expect("替身锁不中毒")
            .recorded
            .last()
            .expect("至少一次 send")
            .clone()
    }

    fn recorded_headers_of(&self, index: usize) -> Vec<(String, String)> {
        self.state.lock().expect("替身锁不中毒").recorded[index]
            .headers
            .clone()
    }
}

#[async_trait]
impl HttpRequestPort for MockPort {
    async fn resolve(&self, host: &str, port: u16) -> Result<Vec<IpAddr>, HttpPortFailure> {
        let mut state = self.state.lock().expect("替身锁不中毒");
        state.resolved.push((host.to_owned(), port));
        let queue = state.resolve_plan.get_mut(host);
        match queue.and_then(|queue| {
            if queue.len() > 1 {
                queue.pop_front()
            } else {
                queue.front().cloned()
            }
        }) {
            Some(ips) => Ok(ips),
            None => Ok(vec![
                IpAddr::from_str("93.184.216.34").expect("公网默认地址")
            ]),
        }
    }

    async fn send(&self, request: &HttpRequest) -> Result<HttpResponse, HttpPortFailure> {
        let mut state = self.state.lock().expect("替身锁不中毒");
        state.recorded.push(request.clone());
        match state.script.pop_front() {
            Some(step) => step,
            None => Err(HttpPortFailure::Failed {
                reason: chips_resource::NetworkErrorReason::Connect,
                message: "替身脚本耗尽".to_owned(),
            }),
        }
    }
}

// ---------------------------------------------------------------------------
// 素材
// ---------------------------------------------------------------------------

fn response(status: u16, headers: Vec<(&str, &str)>, body: &[u8]) -> HttpResponse {
    HttpResponse {
        status,
        headers: headers
            .into_iter()
            .map(|(name, value)| (name.to_owned(), value.to_owned()))
            .collect(),
        body: body.to_vec(),
    }
}

fn ok_body(body: &[u8]) -> HttpResponse {
    response(
        200,
        vec![("content-type", "application/octet-stream")],
        body,
    )
}

fn redirect(location: &str) -> HttpResponse {
    response(302, vec![("location", location)], b"")
}

fn external_address(uri: &str) -> ResourceAddress {
    let limits = ResourceLimits::default();
    let canonical = chips_resource::resolve_input(uri, &limits).expect("在册外部输入");
    ResourceAddress {
        scope: "external".into(),
        path: canonical.path.clone().expect("测试 uri 必须带路径"),
        uri: canonical.to_canonical_string(),
    }
}

fn provider_with(port: Arc<MockPort>) -> HttpProvider {
    HttpProvider::new(&ResourceLimits::default(), port)
}

async fn read_full(provider: &HttpProvider, uri: &str) -> Result<Vec<u8>, chips_core::ChipsError> {
    provider
        .read_range(
            &external_address(uri),
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
}

fn error_code(error: &chips_core::ChipsError) -> &str {
    error.code()
}

// ---------------------------------------------------------------------------
// §8.3 SSRF 地址族拦截
// ---------------------------------------------------------------------------

async fn assert_first_hop_blocked(uri: &str, host: &str, ips: Vec<&str>) {
    let port = MockPort::new();
    port.plan(host, ips);
    let provider = provider_with(Arc::clone(&port));
    let error = read_full(&provider, uri)
        .await
        .expect_err("禁区地址必须拦截");
    assert_eq!(error_code(&error), "RESOURCE_NETWORK_FAILED");
    let details = error.details().expect("网络错误必须携带 details");
    assert_eq!(details["reason"], "blocked");
    assert!(details.get("status").is_none(), "拦截臂不产 status 字段");
    assert_eq!(port.send_count(), 0, "拦截必须先于任何 send");
    assert_eq!(port.resolve_count(), 1);
}

#[tokio::test]
async fn test_loopback_blocked_before_any_send() {
    assert_first_hop_blocked(
        "https://metadata.local/a.bin",
        "metadata.local",
        vec!["127.0.0.1"],
    )
    .await;
}

#[tokio::test]
async fn test_private_in_mixed_resolution_blocked() {
    // 任一解析产物落在禁区即整体拒绝（连接轮换不可信）。
    assert_first_hop_blocked(
        "https://cdn.example.org/a.bin",
        "cdn.example.org",
        vec!["93.184.216.34", "10.1.2.3"],
    )
    .await;
}

#[tokio::test]
async fn test_link_local_multicast_unspecified_blocked() {
    for ips in [
        vec!["169.254.169.254"],
        vec!["224.0.0.1"],
        vec!["0.0.0.0"],
        vec!["fc00::1"],
        vec!["ff02::1"],
        vec!["::1"],
    ] {
        assert_first_hop_blocked(
            "https://restricted.example/a.bin",
            "restricted.example",
            ips,
        )
        .await;
    }
}

#[tokio::test]
async fn test_ipv4_mapped_ipv6_blocked_regardless_of_embedded() {
    // 内嵌公网 IP 的 IPv4 映射地址同样按族拦截（《04》§8.3 在册拒绝项）。
    assert!(address_is_blocked(
        &IpAddr::from_str("::ffff:8.8.8.8").unwrap()
    ));
    assert_first_hop_blocked(
        "https://v6mapped.example/a.bin",
        "v6mapped.example",
        vec!["::ffff:8.8.8.8"],
    )
    .await;
}

#[tokio::test]
async fn test_dns_rebinding_redirect_revalidates_each_hop() {
    // 首跳公网放行，302 指向的 host 重解析落入环回禁区 → DNS rebinding 防御。
    let port = MockPort::new();
    port.plan("cdn.example.com", vec!["93.184.216.34"]);
    port.plan("origin.internal", vec!["127.0.0.1"]);
    port.enqueue(Ok(redirect("https://origin.internal/payload.bin")));
    let provider = provider_with(Arc::clone(&port));
    let error = read_full(&provider, "https://cdn.example.com/a.bin")
        .await
        .expect_err("逐跳复校验必须拦截");
    assert_eq!(error_code(&error), "RESOURCE_NETWORK_FAILED");
    let details = error.details().expect("必须携带 details");
    assert_eq!(details["reason"], "blocked");
    assert_eq!(port.send_count(), 1, "第二跳不得发出");
    assert_eq!(
        port.resolved_hosts(),
        vec![
            ("cdn.example.com".to_owned(), 443u16),
            ("origin.internal".to_owned(), 443u16)
        ],
        "每一跳必须重解析"
    );
}

#[tokio::test]
async fn test_ok_resolution_proceeds_and_empty_is_dns_failure() {
    let port = MockPort::new();
    port.plan("public.example.com", vec!["93.184.216.34"]);
    port.enqueue(Ok(ok_body(b"chips")));
    let provider = provider_with(Arc::clone(&port));
    let bytes = read_full(&provider, "https://public.example.com/a.bin")
        .await
        .expect("公网放行");
    assert_eq!(bytes, b"chips");

    let port = MockPort::new();
    port.plan("empty.example.com", vec![]);
    let provider = provider_with(Arc::clone(&port));
    let error = read_full(&provider, "https://empty.example.com/a.bin")
        .await
        .expect_err("空解析必须 dns 失败");
    assert_eq!(error.details().expect("details")["reason"], "dns");
    // 空解析队列在替身语义里是「解析出零条目」；plan 注入空 vec。
    let state = port.state.lock().unwrap();
    assert!(state.recorded.is_empty(), "空解析不得 send");
}

// ---------------------------------------------------------------------------
// §8.2 重定向族
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_redirect_limit_exceeded() {
    // 默认 redirect_limit = 5：第 6 个 3xx 即超限拒绝。
    let port = MockPort::new();
    for _ in 0..6 {
        port.enqueue(Ok(redirect("https://loop.example.com/next")));
    }
    let provider = provider_with(Arc::clone(&port));
    let error = read_full(&provider, "https://loop.example.com/start")
        .await
        .expect_err("跳数用尽必须拒绝");
    assert_eq!(error_code(&error), "RESOURCE_NETWORK_FAILED");
    let details = error.details().expect("details");
    assert_eq!(details["reason"], "redirect");
    assert_eq!(details["status"], 302);
    assert_eq!(port.send_count(), 6, "初始 1 + 复跳 5");
}

#[tokio::test]
async fn test_redirect_chain_within_limit_succeeds() {
    let port = MockPort::new();
    for index in 1..=3 {
        port.enqueue(Ok(redirect(&format!(
            "https://cdn.example.com/stage{index}"
        ))));
    }
    port.enqueue(Ok(ok_body(b"final")));
    let provider = provider_with(Arc::clone(&port));
    let bytes = read_full(&provider, "https://cdn.example.com/start")
        .await
        .expect("3 跳在册上限内");
    assert_eq!(bytes, b"final");
    assert_eq!(port.send_count(), 4);
}

#[tokio::test]
async fn test_redirect_scheme_escape_rejected() {
    let port = MockPort::new();
    port.enqueue(Ok(redirect("ftp://escape.example.com/x")));
    let provider = provider_with(Arc::clone(&port));
    let error = read_full(&provider, "https://cdn.example.com/a.bin")
        .await
        .expect_err("非 http(s) 跳转必须拒绝");
    let details = error.details().expect("details");
    assert_eq!(details["reason"], "redirect");
    assert_eq!(details["status"], 302);
    assert_eq!(port.resolve_count(), 1, "逃逸臂不得进入第二跳解析");
    assert_eq!(port.send_count(), 1);
}

#[tokio::test]
async fn test_redirect_userinfo_rejected() {
    let port = MockPort::new();
    port.enqueue(Ok(redirect("https://admin:secret@pub.example.com/x")));
    let provider = provider_with(Arc::clone(&port));
    let error = read_full(&provider, "https://pub.example.com/a.bin")
        .await
        .expect_err("userinfo 跳转必须拒绝");
    let details = error.details().expect("details");
    assert_eq!(details["reason"], "redirect");
    // 拒绝理由文本不得回显凭据（《06》§7.1 脱敏口径经 message 把关）。
    assert!(
        !error.message().contains("secret"),
        "错误消息禁止泄露 userinfo"
    );
    assert_eq!(port.send_count(), 1);
}

#[tokio::test]
async fn test_redirect_missing_location_rejected() {
    let port = MockPort::new();
    port.enqueue(Ok(response(301, vec![], b"")));
    let provider = provider_with(Arc::clone(&port));
    let error = read_full(&provider, "https://cdn.example.com/a.bin")
        .await
        .expect_err("无 Location 的 3xx 必须拒绝");
    assert_eq!(error.details().expect("details")["reason"], "redirect");
}

// ---------------------------------------------------------------------------
// §8.2 三超时 + 2 GiB 上限
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_three_timeouts_and_cap_flow_from_constants() {
    // 默认常量：connect 10s / firstByte 30s / idle 30s / 2 GiB。
    let port = MockPort::new();
    port.enqueue(Ok(ok_body(b"tiny")));
    let provider = provider_with(Arc::clone(&port));
    read_full(&provider, "https://cdn.example.com/a.bin")
        .await
        .expect("公网读取");
    let request = port.last_request();
    assert_eq!(request.connect_timeout.as_millis(), 10_000);
    assert_eq!(request.first_byte_timeout.as_millis(), 30_000);
    assert_eq!(request.idle_timeout.as_millis(), 30_000);
    assert_eq!(request.max_response_bytes, 2 * 1024 * 1024 * 1024);

    // 自定义限额逐请求下发（证明常量来源而非硬编码）。
    let limits = ResourceLimits {
        connect_timeout_ms: 1_000,
        first_byte_timeout_ms: 2_000,
        idle_timeout_ms: 3_000,
        max_resource_bytes: 4_096,
        ..Default::default()
    };
    let port2 = MockPort::new();
    port2.enqueue(Ok(ok_body(b"tiny")));
    let provider = HttpProvider::new(&limits, Arc::clone(&port2) as Arc<dyn HttpRequestPort>);
    provider
        .read_range(
            &external_address("https://cdn.example.com/a.bin"),
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("自定义常量下发");
    let request = port2.last_request();
    assert_eq!(request.connect_timeout.as_millis(), 1_000);
    assert_eq!(request.first_byte_timeout.as_millis(), 2_000);
    assert_eq!(request.idle_timeout.as_millis(), 3_000);
    assert_eq!(request.max_response_bytes, 4_096);
}

#[tokio::test]
async fn test_port_timeout_maps_to_network_failed_timeout() {
    let port = MockPort::new();
    port.enqueue(Err(HttpPortFailure::Failed {
        reason: chips_resource::NetworkErrorReason::Timeout,
        message: "首字节超时".to_owned(),
    }));
    let provider = provider_with(Arc::clone(&port));
    let error = read_full(&provider, "https://slow.example.com/a.bin")
        .await
        .expect_err("超时必须失败");
    assert_eq!(error_code(&error), "RESOURCE_NETWORK_FAILED");
    let details = error.details().expect("details");
    assert_eq!(details["reason"], "timeout");
    assert!(details.get("status").is_none());
    assert!(error.retryable(), "NETWORK_FAILED 在册 retryable");
}

#[tokio::test]
async fn test_response_cap_too_large_both_arms() {
    // 臂一：port 越限中止回报。
    let port = MockPort::new();
    port.enqueue(Err(HttpPortFailure::TooLarge {
        limit_bytes: 2 * 1024 * 1024 * 1024,
        actual_bytes: Some(3 * 1024 * 1024 * 1024),
    }));
    let provider = provider_with(Arc::clone(&port));
    let error = read_full(&provider, "https://big.example.com/a.bin")
        .await
        .expect_err("超限必须拒绝");
    assert_eq!(error_code(&error), "RESOURCE_TOO_LARGE");
    let details = error.details().expect("details");
    assert_eq!(details["size"], 3_221_225_472u64);
    assert_eq!(details["limit"], 2_147_483_648u64);

    // 臂二：port 违约多吐（小上限 + 大响应体）策略引擎双保险。
    let limits = ResourceLimits {
        max_resource_bytes: 8,
        ..Default::default()
    };
    let port = MockPort::new();
    port.enqueue(Ok(ok_body(&[0u8; 16])));
    let provider = HttpProvider::new(&limits, Arc::clone(&port) as Arc<dyn HttpRequestPort>);
    let error = provider
        .read_range(
            &external_address("https://lie.example.com/a.bin"),
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect_err("双保险必须拦截");
    assert_eq!(error_code(&error), "RESOURCE_TOO_LARGE");
    let details = error.details().expect("details");
    assert_eq!(details["size"], 16);
    assert_eq!(details["limit"], 8);
}

// ---------------------------------------------------------------------------
// §8.4 请求头净化
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_request_headers_sanitized_across_hops() {
    let port = MockPort::new();
    port.enqueue(Ok(redirect("https://cdn.example.com/final.bin")));
    port.enqueue(Ok(ok_body(b"payload")));
    let provider = provider_with(Arc::clone(&port));
    read_full(&provider, "https://cdn.example.com/a.bin")
        .await
        .expect("一跳重定向读取");
    assert_eq!(port.send_count(), 2);
    for index in 0..2 {
        let headers = port.recorded_headers_of(index);
        let names: Vec<String> = headers
            .iter()
            .map(|(name, _)| name.to_ascii_lowercase())
            .collect();
        assert!(names.iter().any(|name| name == "user-agent"));
        assert_eq!(
            headers
                .iter()
                .find(|(name, _)| name == "user-agent")
                .expect("UA")
                .1,
            PLATFORM_USER_AGENT
        );
        for banned in ["cookie", "authorization", "referer"] {
            assert!(
                !names.iter().any(|name| name == banned),
                "第 {index} 跳泄露禁发头 {banned}"
            );
        }
    }
}

#[tokio::test]
async fn test_upstream_status_maps_to_http_status_reason() {
    let port = MockPort::new();
    port.enqueue(Ok(response(500, vec![], b"boom")));
    let provider = provider_with(Arc::clone(&port));
    let error = read_full(&provider, "https://broken.example.com/a.bin")
        .await
        .expect_err("5xx 必须失败");
    assert_eq!(error_code(&error), "RESOURCE_NETWORK_FAILED");
    let details = error.details().expect("details");
    assert_eq!(details["reason"], "http_status");
    assert_eq!(details["status"], 500);
}

// ---------------------------------------------------------------------------
// §8.2 Range 透传
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_range_passthrough_partial_206() {
    let port = MockPort::new();
    port.enqueue(Ok(response(
        206,
        vec![("content-type", "application/octet-stream")],
        &[10u8, 11, 12, 13, 14],
    )));
    let provider = provider_with(Arc::clone(&port));
    let bytes = provider
        .read_range(
            &external_address("https://cdn.example.com/a.bin"),
            ByteRange {
                offset: 10,
                length: Some(5),
            },
        )
        .await
        .expect("206 部分读");
    assert_eq!(bytes, vec![10, 11, 12, 13, 14]);
    let request = port.last_request();
    assert!(request
        .headers
        .iter()
        .any(|(name, value)| name == "range" && value == "bytes=10-14"));
}

#[tokio::test]
async fn test_range_unsupported_falls_back_to_discard() {
    // 上游忽略 Range 回 200 全量体：流式丢弃至 offset（§8.2 在册臂）。
    let port = MockPort::new();
    port.enqueue(Ok(ok_body(&(0u8..20).collect::<Vec<u8>>())));
    let provider = provider_with(Arc::clone(&port));
    let bytes = provider
        .read_range(
            &external_address("https://cdn.example.com/a.bin"),
            ByteRange {
                offset: 5,
                length: Some(4),
            },
        )
        .await
        .expect("200 丢弃臂");
    assert_eq!(bytes, vec![5, 6, 7, 8]);
}

// ---------------------------------------------------------------------------
// §8.3 userinfo 首跳拒绝（URI 层）+ 策略层直测
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_first_hop_userinfo_rejected_at_uri_layer() {
    let limits = ResourceLimits::default();
    let error = chips_resource::resolve_input("https://u:p@cdn.example.com/a.bin", &limits)
        .expect_err("userinfo 在 URI 语法层即拒绝");
    assert_eq!(error.code(), "RESOURCE_INVALID_URI");
    // 策略层同源臂：构造过的 canonical 无法携带 userinfo；直测解析器。
    assert_eq!(
        chips_resource::parse_target_url("https://u:p@cdn.example.com/a.bin").unwrap_err(),
        TargetRejection::UserInfo
    );
}

// ---------------------------------------------------------------------------
// stat = HEAD 探测
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_stat_uses_head_probe_without_body() {
    let port = MockPort::new();
    port.enqueue(Ok(response(
        200,
        vec![
            ("content-length", "42"),
            ("etag", "\"v42\""),
            ("content-type", "image/png"),
        ],
        b"",
    )));
    let provider = provider_with(Arc::clone(&port));
    let metadata = provider
        .stat(&external_address("https://cdn.example.com/photo.png"))
        .await
        .expect("HEAD 探测");
    assert_eq!(metadata.size, 42);
    assert_eq!(metadata.mime_type, "image/png");
    assert_eq!(metadata.version, "\"v42\"");
    let request = port.last_request();
    assert_eq!(request.method, HttpMethod::Head);
    assert_eq!(request.url, "https://cdn.example.com/photo.png");
    assert!(!request.headers.iter().any(|(name, _)| name == "range"));
}

// ---------------------------------------------------------------------------
// §6.2/§8.4 L2 缓存集成 + 条件请求
// ---------------------------------------------------------------------------

struct CacheFixture {
    store: Arc<CacheStore>,
    root: std::path::PathBuf,
}

impl CacheFixture {
    fn new(limits: &ResourceLimits) -> Self {
        let root = std::env::temp_dir().join(format!(
            "chips-http-l2-{}-{}",
            std::process::id(),
            nanos_stamp()
        ));
        std::fs::create_dir_all(&root).expect("L2 根目录");
        let store = Arc::new(CacheStore::new(limits));
        store
            .attach_disk(root.clone(), limits.disk_cache_bytes)
            .expect("L2 挂载");
        Self { store, root }
    }

    fn disk_files(&self) -> Vec<String> {
        std::fs::read_dir(&self.root)
            .map(|entries| {
                entries
                    .filter_map(|entry| {
                        entry
                            .ok()
                            .map(|entry| entry.file_name().to_string_lossy().into_owned())
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
}

impl Drop for CacheFixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn nanos_stamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("时钟")
        .as_nanos()
}

#[tokio::test]
async fn test_l2_fresh_hit_skips_port() {
    let limits = ResourceLimits::default();
    let fixture = CacheFixture::new(&limits);
    let port = MockPort::new();
    port.enqueue(Ok(response(
        200,
        vec![("etag", "\"v1\""), ("cache-control", "max-age=3600")],
        b"chips-bytes",
    )));
    let provider = HttpProvider::new(&limits, Arc::clone(&port) as Arc<dyn HttpRequestPort>)
        .with_cache(Arc::clone(&fixture.store));
    let address = external_address("https://cdn.example.com/a.bin");
    let first = provider
        .read_range(
            &address,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("首次抓取");
    assert_eq!(first, b"chips-bytes");
    assert_eq!(port.send_count(), 1);
    assert!(!fixture.disk_files().is_empty(), "200+ETag 必须落 L2");
    let second = provider
        .read_range(
            &address,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("L2 新鲜命中");
    assert_eq!(second, b"chips-bytes");
    assert_eq!(port.send_count(), 1, "新鲜期内零网络往返");
    // 范围读同样吃到 L2（磁盘全量体本地切片）。
    let sliced = provider
        .read_range(
            &address,
            ByteRange {
                offset: 6,
                length: Some(3),
            },
        )
        .await
        .expect("L2 切片");
    assert_eq!(sliced, b"byt".to_vec());
    assert_eq!(port.send_count(), 1);
}

#[tokio::test]
async fn test_stale_entry_conditional_304_refresh() {
    let limits = ResourceLimits::default();
    let fixture = CacheFixture::new(&limits);
    let port = MockPort::new();
    // max-age=0：落盘即陈旧。
    port.enqueue(Ok(response(
        200,
        vec![("etag", "\"v1\""), ("cache-control", "max-age=0")],
        b"stale-but-valid",
    )));
    // 复验：304（无新体）。
    port.enqueue(Ok(response(
        304,
        vec![("cache-control", "max-age=3600")],
        b"",
    )));
    let provider = HttpProvider::new(&limits, Arc::clone(&port) as Arc<dyn HttpRequestPort>)
        .with_cache(Arc::clone(&fixture.store));
    let address = external_address("https://cdn.example.com/a.bin");
    let full = || ByteRange {
        offset: 0,
        length: None,
    };
    let first = provider.read_range(&address, full()).await.expect("首次");
    assert_eq!(first, b"stale-but-valid");
    let second = provider
        .read_range(&address, full())
        .await
        .expect("条件复验");
    assert_eq!(second, b"stale-but-valid", "304 命中磁盘体回吐");
    assert_eq!(port.send_count(), 2);
    let conditional = port.last_request();
    assert!(conditional
        .headers
        .iter()
        .any(|(name, value)| { name == "if-none-match" && value == "\"v1\"" }));
    // 刷新后第三读零网络（新鲜期已由 304 响应头续期）。
    let third = provider
        .read_range(&address, full())
        .await
        .expect("续期命中");
    assert_eq!(third, b"stale-but-valid");
    assert_eq!(port.send_count(), 2, "续期后不得再打网络");
}

#[tokio::test]
async fn test_no_store_response_not_persisted() {
    let limits = ResourceLimits::default();
    let fixture = CacheFixture::new(&limits);
    let port = MockPort::new();
    for _ in 0..2 {
        port.enqueue(Ok(response(
            200,
            vec![
                ("etag", "\"v1\""),
                ("cache-control", "no-store, max-age=3600"),
            ],
            b"ephemeral",
        )));
    }
    let provider = HttpProvider::new(&limits, Arc::clone(&port) as Arc<dyn HttpRequestPort>)
        .with_cache(Arc::clone(&fixture.store));
    let address = external_address("https://cdn.example.com/private.bin");
    let full = || ByteRange {
        offset: 0,
        length: None,
    };
    provider.read_range(&address, full()).await.expect("首次");
    provider.read_range(&address, full()).await.expect("二次");
    assert_eq!(port.send_count(), 2, "no-store 不落盘，每次如实回源");
    assert!(
        fixture.disk_files().is_empty(),
        "no-store 响应禁止出现在 L2（《04》§8.4）"
    );
}

#[tokio::test]
async fn test_cross_origin_redirect_drops_conditional_validator() {
    // L2 有 A 原点验证器；陈旧后 302 跳向 B 原点：条件头不得外发跨原点。
    let limits = ResourceLimits::default();
    let fixture = CacheFixture::new(&limits);
    let port = MockPort::new();
    port.enqueue(Ok(response(
        200,
        vec![("etag", "\"v1\""), ("cache-control", "max-age=0")],
        b"body-a",
    )));
    // 陈旧复验：302 跨原点 + 200 新体（无 ETag）。
    port.enqueue(Ok(redirect("https://other.example.org/moved.bin")));
    port.enqueue(Ok(ok_body(b"body-b")));
    let provider = HttpProvider::new(&limits, Arc::clone(&port) as Arc<dyn HttpRequestPort>)
        .with_cache(Arc::clone(&fixture.store));
    let address = external_address("https://cdn.example.com/a.bin");
    let full = || ByteRange {
        offset: 0,
        length: None,
    };
    provider.read_range(&address, full()).await.expect("首次");
    let second = provider
        .read_range(&address, full())
        .await
        .expect("复验跳转");
    assert_eq!(second, b"body-b");
    // 第二跳（跨原点落点）请求头不含 if-none-match。
    let hop2 = port.recorded_headers_of(2);
    assert!(
        !hop2
            .iter()
            .any(|(name, _)| name.eq_ignore_ascii_case("if-none-match")),
        "条件验证器禁止跨原点外发（《04》§8.4 对偶臂）"
    );
}

// ---------------------------------------------------------------------------
// Manager 端到端：external 路由到 http Provider
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_manager_routes_external_to_http_provider() {
    let port = MockPort::new();
    // open → provider.stat（HEAD #1）；read_range 完整读 → provider.stat
    // （HEAD #2，§6.3 版本戳前置）+ L1 未命中 GET（#3）；重读 → HEAD #4 +
    // L1 钉住命中零 GET。
    for _ in 0..2 {
        port.enqueue(Ok(response(
            200,
            vec![("content-length", "5"), ("etag", "\"e1\"")],
            b"",
        )));
    }
    port.enqueue(Ok(response(
        200,
        vec![("etag", "\"e1\""), ("cache-control", "max-age=3600")],
        b"chips",
    )));
    port.enqueue(Ok(response(
        200,
        vec![("content-length", "5"), ("etag", "\"e1\"")],
        b"",
    )));
    let limits = ResourceLimits::default();
    let manager =
        chips_resource::ResourceManager::new(limits.clone(), Arc::new(NoopDecisionObserver));
    manager
        .register_provider(Arc::new(HttpProvider::new(
            &limits,
            port.clone() as Arc<dyn HttpRequestPort>,
        )) as Arc<dyn ResourceProvider>)
        .expect("http Provider 注册");
    let session = manager
        .open_session(
            chips_resource::SessionKind::Document,
            &"chips.official.editor".into(),
            std::collections::BTreeSet::new(),
            vec![
                "resources:read:external".to_owned(),
                "network:http:cdn.example.com".to_owned(),
            ],
        )
        .expect("会话");
    let handle = manager
        .open(OpenRequest {
            uri: "https://cdn.example.com/a.bin".to_owned(),
            session,
        })
        .await
        .expect("External 打开成功");
    let bytes = manager
        .read_range(
            handle.id,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("完整读");
    assert_eq!(bytes, b"chips");
    let again = manager
        .read_range(
            handle.id,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("L1 命中读");
    assert_eq!(again, b"chips");
    // 《04》§6.3：完整读前置版本戳校验（HEAD），但 5 字节 < max_inline
    // 已入 L1 → GET 体拉取全程仅一次。
    let get_count = {
        let state = port.state.lock().expect("替身锁不中毒");
        state
            .recorded
            .iter()
            .filter(|request| request.method == HttpMethod::Get)
            .count()
    };
    assert_eq!(get_count, 1, "L1 钉住命中不得重发体拉取");
}
