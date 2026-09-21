//! 集成测试：`chips-resource://` URI 语法矩阵（《06-资源协议规范》§2.2–§2.7）。
//!
//! 全部断言以文档表格逐行为准：合法性、错误码、`details.reason` 词表与
//! §2.6 归一化产物文本。

use chips_resource::{
    is_registered_scope_naming, normalize_reference, parse_canonical_form, resolve_input,
    CanonicalUri, PathErrorReason, ResourceError, ResourceLimits, UriErrorReason, EXTERNAL_SCOPE,
    MANAGED_SCOPE_PREFIXES, MEMORY_SCOPE, PLATFORM_SCOPE, RESOURCE_SCHEME,
};

fn limits() -> ResourceLimits {
    ResourceLimits::default()
}

fn ok(input: &str) -> CanonicalUri {
    resolve_input(input, &limits())
        .unwrap_or_else(|error| panic!("合法输入被拒绝 {input}: {error}"))
}

fn uri_reason(input: &str) -> UriErrorReason {
    match resolve_input(input, &limits()) {
        Err(ResourceError::InvalidUri { reason, .. }) => reason,
        other => panic!("期望 INVALID_URI，实际 {other:?}"),
    }
}

fn path_reason(input: &str) -> PathErrorReason {
    match resolve_input(input, &limits()) {
        Err(ResourceError::PathInvalid { reason, .. }) => reason,
        other => panic!("期望 PATH_INVALID，实际 {other:?}"),
    }
}

fn error_code(input: &str) -> &'static str {
    match resolve_input(input, &limits()) {
        Err(error) => error.code(),
        Ok(uri) => panic!("期望拒绝，实际接受 {}", uri.to_canonical_string()),
    }
}

/// §2.7 合法与非法示例表逐行。
#[test]
fn test_spec_2_7_legality_matrix() {
    assert_eq!(
        ok("chips-resource://card-7f3a/images/photo.jpg").to_canonical_string(),
        "chips-resource://card-7f3a/images/photo.jpg"
    );
    assert_eq!(
        error_code("chips-resource://card-7f3a/images/../.card/metadata.yaml"),
        crate_codes::PATH_INVALID
    );
    assert_eq!(
        path_reason("chips-resource://card-7f3a/images/../.card/metadata.yaml"),
        PathErrorReason::Segment
    );
    assert_eq!(
        error_code("chips-resource://card-7f3a/%2e%2e/.card/metadata.yaml"),
        crate_codes::PATH_INVALID
    );
    assert_eq!(
        path_reason("chips-resource://card-7f3a/%2e%2e/.card/metadata.yaml"),
        PathErrorReason::Segment
    );
    // 双重编码：解码一次得字面 `%2e%2e`，非穿越；寻址面接受该字面名。
    let double = ok("chips-resource://card-7f3a/images/%252e%252e/x");
    assert_eq!(double.path.as_ref().unwrap().as_str(), "images/%2e%2e/x");
}

/// §2.2：scheme 全小写归一与非规范前缀拒绝。
#[test]
fn test_scheme_rules() {
    assert_eq!(RESOURCE_SCHEME, "chips-resource");
    // 大小写变体归一为小写。
    assert_eq!(
        ok("CHIPS-RESOURCE://card-1/a.png").to_canonical_string(),
        "chips-resource://card-1/a.png"
    );
    for input in [
        "file:///etc/passwd",
        "webdav://dav.example.com/a.card",
        "data:text/plain,hello",
        "chips://card-1/a",
        "res://card-1/a",
    ] {
        assert_eq!(
            error_code(input),
            crate_codes::UNSUPPORTED_SCHEME,
            "入口不接受 {input}"
        );
    }
    // `webdav://` 仅解析器归一入口接受（§2.6）。
    assert_eq!(
        normalize_reference("webdav://dav.example.com/team/notes.card", &limits())
            .expect("解析器入口必须接受 webdav 引用")
            .to_canonical_string(),
        "chips-resource://external/webdav/dav.example.com/team/notes.card"
    );
    assert_eq!(
        normalize_reference("WEBDAV://DAV.EXAMPLE.COM:8443/team/notes.card", &limits())
            .expect("scheme 与 host 归一为小写")
            .to_canonical_string(),
        "chips-resource://external/webdav/dav.example.com:8443/team/notes.card"
    );
    assert_eq!(
        match normalize_reference("webdav://user:pass@dav.example.com/a.card", &limits()) {
            Err(error) => error.code(),
            Ok(_) => "ACCEPTED",
        },
        crate_codes::INVALID_URI
    );
    // 无 scheme 输入按语法拒绝而非不支持。
    assert_eq!(error_code("card-1/a.png"), crate_codes::INVALID_URI);
    assert_eq!(uri_reason("card-1/a.png"), UriErrorReason::MalformedScheme);
}

/// §2.3：scope 段语法与在册命名。
#[test]
fn test_scope_naming_matrix() {
    for scope in [
        "workspace-3f",
        "card-7f3a",
        "box-01",
        "plugin-7f3a",
        "platform",
        "external",
        "memory",
        "temp-7a3f",
    ] {
        assert!(is_registered_scope_naming(scope), "{scope} 必须在册命名");
        // `external` 裸 `<scope>/<path>` 形态不在册：必须携带 origin 段。
        let sample = if scope == "external" {
            format!("chips-resource://{scope}/https/cdn.example.com/a.png")
        } else {
            format!("chips-resource://{scope}/a.png")
        };
        assert!(
            resolve_input(&sample, &limits()).is_ok(),
            "{scope} 语法必须可解析：{sample}"
        );
    }
    // external 的在册形态与非法形态（§2.2/§2.7：缺 origin 段 → invalid_origin）。
    assert_eq!(
        uri_reason("chips-resource://external/a.png"),
        UriErrorReason::InvalidOrigin
    );
    assert!(resolve_input(
        "chips-resource://external/https/cdn.example.com/a.png",
        &limits()
    )
    .is_ok());
    for scope in [
        "rogue-1", "Card-1", "1card", "-card", "card_", "car", "memory-x",
    ] {
        assert!(!is_registered_scope_naming(scope), "{scope} 不属在册命名");
    }
    // 语法层：非法 scope 字符与空 scope。
    assert_eq!(
        uri_reason("chips-resource://card..1/a"),
        UriErrorReason::MalformedScope
    );
    assert_eq!(
        uri_reason("chips-resource:///a.png"),
        UriErrorReason::MalformedScope
    );
    assert_eq!(
        uri_reason(&format!("chips-resource://card-{}/a", "x".repeat(70))),
        UriErrorReason::MalformedScope
    );
    // 受管前缀在册集合与文档一致。
    assert_eq!(
        MANAGED_SCOPE_PREFIXES,
        ["workspace-", "card-", "box-", "plugin-", "temp-"]
    );
    assert_eq!(
        (PLATFORM_SCOPE, MEMORY_SCOPE, EXTERNAL_SCOPE),
        ("platform", "memory", "external")
    );
}

/// §2.4：路径规则与 `details.reason` 词表。
#[test]
fn test_path_reason_matrix() {
    assert_eq!(
        path_reason("chips-resource://card-1/a\\b"),
        PathErrorReason::Separator
    );
    assert_eq!(
        path_reason("chips-resource://card-1/a%5Cb"),
        PathErrorReason::Separator
    );
    assert_eq!(
        path_reason("chips-resource://card-1//a"),
        PathErrorReason::Absolute
    );
    assert_eq!(
        path_reason("chips-resource://card-1/a//b"),
        PathErrorReason::Segment
    );
    assert_eq!(
        path_reason("chips-resource://card-1/./a"),
        PathErrorReason::Segment
    );
    assert_eq!(
        path_reason("chips-resource://card-1/a/.."),
        PathErrorReason::Segment
    );
    assert_eq!(
        path_reason("chips-resource://card-1/%2E%2E/a"),
        PathErrorReason::Segment
    );
    assert_eq!(
        path_reason("chips-resource://card-1/a%00b"),
        PathErrorReason::Control
    );
    assert_eq!(
        path_reason("chips-resource://card-1/C:/x"),
        PathErrorReason::Absolute
    );
    assert_eq!(
        path_reason("chips-resource://card-1/a:b"),
        PathErrorReason::Platform
    );
    assert_eq!(
        path_reason("chips-resource://card-1/CON"),
        PathErrorReason::Platform
    );
    assert_eq!(
        path_reason("chips-resource://card-1/nul.txt"),
        PathErrorReason::Platform
    );
    assert_eq!(
        path_reason("chips-resource://card-1/a."),
        PathErrorReason::Platform
    );
    assert_eq!(
        error_code("chips-resource://card-1/a%zz"),
        crate_codes::INVALID_URI
    );
    assert_eq!(
        uri_reason("chips-resource://card-1/a%zz"),
        UriErrorReason::InvalidEncoding
    );
    // 空格与 `+` 不接受裸形式（§2.6）。
    assert_eq!(
        uri_reason("chips-resource://card-1/a b.png"),
        UriErrorReason::MalformedPath
    );
    assert_eq!(
        ok("chips-resource://card-1/a+b.png").to_canonical_string(),
        "chips-resource://card-1/a+b.png",
        "`+` 不作空格解释"
    );
    // 空路径只允许作为基址。
    let base = ok("chips-resource://card-1/");
    assert!(base.is_scope_root());
    assert_eq!(base.path, None);
    assert!(
        ok("chips-resource://card-1").is_scope_root(),
        "无尾斜杠同样按基址形态解析"
    );
}

/// §2.6：字符集与编码归一化。
#[test]
fn test_percent_and_unicode_normalization() {
    // 非 ASCII → UTF-8 大写十六进制；NFC 归一。
    assert_eq!(
        ok("chips-resource://workspace-3f/笔记/报告.card").to_canonical_string(),
        "chips-resource://workspace-3f/%E7%AC%94%E8%AE%B0/%E6%8A%A5%E5%91%8A.card"
    );
    // 组合形态 e + U+0301 归一为预组合 U+00E9。
    let composed = ok("chips-resource://card-1/caf\u{e9}/a.png");
    let decomposed = ok("chips-resource://card-1/cafe\u{301}/a.png");
    assert_eq!(
        composed.to_canonical_string(),
        decomposed.to_canonical_string()
    );
    assert_eq!(
        composed.to_canonical_string(),
        "chips-resource://card-1/caf%C3%A9/a.png"
    );
    // 字面 `%` 必须编码为 `%25`。
    assert_eq!(
        ok("chips-resource://card-1/100%25.png").to_canonical_string(),
        "chips-resource://card-1/100%25.png"
    );
    // `%2F` 解码后按分隔符重新分段校验：解码成 `..` 即穿越。
    assert_eq!(
        path_reason("chips-resource://card-1/a%2F%2E%2E/b"),
        PathErrorReason::Segment
    );
    // 规范文本幂等：对规范输出再解析得到同一规范输出。
    for input in [
        "chips-resource://card-7f3a/images/photo.jpg",
        "chips-resource://workspace-3f/笔记/报告.card",
        "https://cdn.example.com/banner.png",
        "chips-resource://external/http/api.example.com:8080/v1/items?page=2",
    ] {
        let first = ok(input).to_canonical_string();
        let second = resolve_input(&first, &limits())
            .unwrap_or_else(|error| panic!("规范文本必须可再解析 {first}: {error}"))
            .to_canonical_string();
        assert_eq!(first, second, "规范输出必须幂等");
    }
}

/// §2.5：查询串与 fragment。
#[test]
fn test_query_and_fragment_rules() {
    for scope in [
        "workspace-3f",
        "card-1",
        "box-1",
        "plugin-1",
        "platform",
        "temp-1",
        "memory",
    ] {
        assert_eq!(
            error_code(&format!("chips-resource://{scope}/a?x=1")),
            crate_codes::INVALID_URI,
            "受管作用域 {scope} 禁止查询串"
        );
        assert_eq!(
            uri_reason(&format!("chips-resource://{scope}/a?x=1")),
            UriErrorReason::QueryNotAllowed
        );
        // 字面 `?` 编码为 `%3F` 后是普通路径字符。
        assert_eq!(ok(&format!("chips-resource://{scope}/a%3Fx")).query, None);
    }
    for input in [
        "chips-resource://card-1/a#frag",
        "chips-resource://external/https/cdn.example.com/a#frag",
    ] {
        assert_eq!(error_code(input), crate_codes::INVALID_URI);
        assert_eq!(uri_reason(input), UriErrorReason::FragmentNotAllowed);
    }
    // External：query 原样保留并参与传递。
    let external = ok("chips-resource://external/http/api.example.com:8080/v1/items?page=2");
    assert_eq!(external.query.as_deref(), Some("page=2"));
    assert_eq!(
        external.to_canonical_string(),
        "chips-resource://external/http/api.example.com:8080/v1/items?page=2"
    );
    // 非 ASCII query 归一为 UTF-8 大写十六进制；`=` 与 `&` 原样保留。
    assert_eq!(
        ok("https://cdn.example.com/a?q=万&r=2").query.as_deref(),
        Some("q=%E4%B8%87&r=2")
    );
    // 裸空格与字面 `#` 在 query 内的处理。
    assert_eq!(
        uri_reason("chips-resource://external/https/cdn.example.com/a?q=1 2"),
        UriErrorReason::MalformedPath
    );
    assert_eq!(
        ok("https://cdn.example.com/a?q=%23").query.as_deref(),
        Some("q=%23"),
        "`%23` 在 query 内保持编码形态"
    );
}

/// §2.6 External origin 归一表逐行。
#[test]
fn test_external_origin_normalization_table() {
    let cases = [
        (
            "https://cdn.example.com/banner.png",
            "chips-resource://external/https/cdn.example.com/banner.png",
        ),
        (
            "http://api.example.com:8080/v1/items?page=2",
            "chips-resource://external/http/api.example.com:8080/v1/items?page=2",
        ),
        (
            "HTTPS://CDN.EXAMPLE.COM/Banner.PNG",
            "chips-resource://external/https/cdn.example.com/Banner.PNG",
        ),
        (
            "https://example.com:443/a",
            "chips-resource://external/https/example.com/a",
        ),
        (
            "http://example.com:80/a",
            "chips-resource://external/http/example.com/a",
        ),
        (
            "https://例え.jp/a",
            "chips-resource://external/https/xn--r8jz45g.jp/a",
        ),
        (
            "https://[2001:db8::1]/a",
            "chips-resource://external/https/%5B2001:db8::1%5D/a",
        ),
        (
            "https://example.com./a",
            "chips-resource://external/https/example.com/a",
        ),
        (
            "http://192.168.1.7:3128/x.bin",
            "chips-resource://external/http/192.168.1.7:3128/x.bin",
        ),
    ];
    for (input, expected) in cases {
        assert_eq!(ok(input).to_canonical_string(), expected, "输入 {input}");
    }
    for rejected in [
        "https://user:pass@example.com/a",
        "https://@example.com/a",
        "https://example.com:0/a",
        "https://example.com:notaport/a",
        "http:///a",
        "ftp://files.example.com/a",
        "https://exa mple.com/a",
    ] {
        let code = error_code(rejected);
        assert!(
            code == crate_codes::INVALID_URI || code == crate_codes::UNSUPPORTED_SCHEME,
            "{rejected} 必须被拒绝，实际码 {code}"
        );
        if code == crate_codes::INVALID_URI {
            assert_eq!(uri_reason(rejected), UriErrorReason::InvalidOrigin);
        }
    }
    // 规范形式（external 前两段）与裸输入产物一致。
    assert_eq!(
        ok("chips-resource://external/https/CDN.example.com/banner.png").to_canonical_string(),
        "chips-resource://external/https/cdn.example.com/banner.png"
    );
    assert_eq!(
        parse_canonical_form(
            "chips-resource://external/HTTPS/EXAMPLE.COM/A.TXT",
            &limits()
        )
        .expect("scheme 与 host 大小写归一后必须接受")
        .to_canonical_string(),
        "chips-resource://external/https/example.com/A.TXT",
        "host 小写归一、path 保持大小写"
    );
}

/// 长度上限（§2.4 `length`）可配置且生效。
#[test]
fn test_length_limits_enforced() {
    let tight = ResourceLimits {
        max_uri_bytes: 64,
        max_path_bytes: 32,
        max_segment_bytes: 8,
        ..ResourceLimits::default()
    };
    assert_eq!(
        match resolve_input(
            &format!("chips-resource://card-1/{}", "a".repeat(40)),
            &tight
        ) {
            Err(error) => error.code(),
            Ok(_) => "ACCEPTED",
        },
        crate_codes::PATH_INVALID
    );
    assert_eq!(
        match resolve_input(
            &format!("chips-resource://card-1/dir/{}", "b".repeat(20)),
            &tight
        ) {
            Err(ResourceError::PathInvalid { reason, .. }) => reason,
            other => panic!("期望段超长拒绝，实际 {other:?}"),
        },
        PathErrorReason::Length
    );
    let long_uri = format!("chips-resource://card-1/{}", "c".repeat(5000));
    assert_eq!(
        match resolve_input(&long_uri, &limits()) {
            Err(ResourceError::PathInvalid { reason, .. }) => reason,
            other => panic!("期望路径超长拒绝，实际 {other:?}"),
        },
        PathErrorReason::Length
    );
    let long_segment = format!("chips-resource://card-1/{}", "d".repeat(300));
    assert_eq!(
        match resolve_input(&long_segment, &limits()) {
            Err(ResourceError::PathInvalid { reason, .. }) => reason,
            other => panic!("期望单段超长拒绝，实际 {other:?}"),
        },
        PathErrorReason::Length
    );
    let long_whole = format!("https://cdn.example.com/{}", "e".repeat(9000));
    assert_eq!(
        match resolve_input(&long_whole, &limits()) {
            Err(error) => error.code(),
            Ok(_) => "ACCEPTED",
        },
        crate_codes::INVALID_URI,
        "URI 总长超限按语法层拒绝"
    );
}

/// 错误码常量集中登记（避免测试内散落字面量；其余码的锁测见
/// `tests/error_code_lock.rs` 与 `src/error.rs` 单元锁）。
mod crate_codes {
    pub const INVALID_URI: &str = chips_resource::error::RESOURCE_INVALID_URI;
    pub const UNSUPPORTED_SCHEME: &str = chips_resource::error::RESOURCE_UNSUPPORTED_SCHEME;
    pub const PATH_INVALID: &str = chips_resource::error::RESOURCE_PATH_INVALID;
}

/// 基址规范输出保持尾斜杠形态。
#[test]
fn test_base_uri_canonical_form() {
    assert!(ok("chips-resource://platform/").is_scope_root());
    assert_eq!(
        ok("chips-resource://card-1/").to_canonical_string(),
        "chips-resource://card-1/"
    );
    assert_eq!(
        ok("https://cdn.example.com/").to_canonical_string(),
        "chips-resource://external/https/cdn.example.com/"
    );
}
