//! 错误码三方锁：《06-资源协议规范》§7.2/§7.3 权威码表 ↔ crate 公开常量 ↔
//! `ResourceError` 变体与 `details` 形状，三方逐码对照（与 `chips-parser` /
//! `chips-bridge` 既有逐码断言先例同型）。
//!
//! 锁三层：
//!
//! 1. **码表锁**：§7.2 的 18 个在册码逐个与常量、`code()` 映射、`retryable`
//!    表、协议路径 HTTP 映射对照，缺码/多码/漂移即红；
//! 2. **文法锁**：全部公开码必须满足 `RESOURCE_` + `DOMAIN_REASON` 文法
//!    （前缀 `RESOURCE_`，段名全大写 ASCII 加下划线连接）；
//! 3. **形状锁**：`details` 键集与 reason 词表序列化逐字对照 §7.3
//!    （URI 8 词、路径 9 词、句柄状态 3 词、失效原因 3 词 kebab-case、
//!    池类别 2 词、权限拒绝 5 词、作用域操作 6 词）。
//!
//! 段二 B1 随单：`unicode` reason 由「词表在册、零产生」翻为「有产生」
//! （工单042 裁定④触发臂，见 [`test_unicode_reason_has_production`]）；
//! `NotSupported` / `CrossScope` 两变体纳入变体→码映射锁（Unicode 触发臂按
//! 主智能体 2026-09-21 码归属更正由 `PathInvalid{reason: unicode}` 承载，
//! 复用既有 `PathInvalid → RESOURCE_PATH_INVALID` 映射锁，不另立变体）。
//!
//! 段三随单：`unicode` 触发臂覆盖面按工单043 裁定 A1 收紧为 Unicode 非字符
//! 全集（U+nFFFE/U+nFFFF 全 17 平面 + 非字符区 U+FDD0–U+FDEF + U+FFFD），
//! 错误码值与 reason 词表零改动，产生例随单扩充。

use chips_resource::error::{
    http_status_for, retryable_for, RESOURCE_ALREADY_EXISTS, RESOURCE_BUSY, RESOURCE_CROSS_SCOPE,
    RESOURCE_HANDLE_INVALIDATED, RESOURCE_HANDLE_RELEASED, RESOURCE_INTERNAL, RESOURCE_INVALID_URI,
    RESOURCE_NETWORK_FAILED, RESOURCE_NOT_EMPTY, RESOURCE_NOT_FOUND, RESOURCE_NOT_SUPPORTED,
    RESOURCE_PATH_INVALID, RESOURCE_PERMISSION_DENIED, RESOURCE_POOL_EXHAUSTED, RESOURCE_READ_ONLY,
    RESOURCE_TOO_LARGE, RESOURCE_UNSUPPORTED_SCHEME, RESOURCE_WRITE_FAILED,
};
use chips_resource::{
    HandleState, InvalidateReason, PathErrorReason, PermissionDenyReason, PoolKind, ResourceError,
    ResourceLimits, ScopeOperation, UriErrorReason,
};

/// 全部在册码：(码值, retryable, 协议路径 HTTP)。数值逐字来自《06》§7.2 表。
const REGISTERED: &[(&str, bool, Option<u16>)] = &[
    ("RESOURCE_INVALID_URI", false, Some(400)),
    ("RESOURCE_UNSUPPORTED_SCHEME", false, None),
    ("RESOURCE_NOT_FOUND", false, Some(404)),
    ("RESOURCE_PATH_INVALID", false, Some(400)),
    ("RESOURCE_PERMISSION_DENIED", false, Some(403)),
    ("RESOURCE_TOO_LARGE", false, Some(413)),
    ("RESOURCE_BUSY", true, Some(503)),
    ("RESOURCE_HANDLE_RELEASED", false, None),
    ("RESOURCE_HANDLE_INVALIDATED", true, None),
    ("RESOURCE_POOL_EXHAUSTED", true, Some(503)),
    ("RESOURCE_READ_ONLY", false, None),
    ("RESOURCE_ALREADY_EXISTS", false, Some(409)),
    ("RESOURCE_NOT_EMPTY", false, Some(409)),
    ("RESOURCE_NOT_SUPPORTED", false, Some(501)),
    ("RESOURCE_CROSS_SCOPE", false, Some(403)),
    ("RESOURCE_WRITE_FAILED", true, None),
    ("RESOURCE_NETWORK_FAILED", true, Some(502)),
    ("RESOURCE_INTERNAL", false, Some(500)),
];

/// crate 侧公开常量镜像（与 `REGISTERED` 同序，锁「常量 ↔ 码表」一致性）。
const EXPORTED: &[&str] = &[
    RESOURCE_INVALID_URI,
    RESOURCE_UNSUPPORTED_SCHEME,
    RESOURCE_NOT_FOUND,
    RESOURCE_PATH_INVALID,
    RESOURCE_PERMISSION_DENIED,
    RESOURCE_TOO_LARGE,
    RESOURCE_BUSY,
    RESOURCE_HANDLE_RELEASED,
    RESOURCE_HANDLE_INVALIDATED,
    RESOURCE_POOL_EXHAUSTED,
    RESOURCE_READ_ONLY,
    RESOURCE_ALREADY_EXISTS,
    RESOURCE_NOT_EMPTY,
    RESOURCE_NOT_SUPPORTED,
    RESOURCE_CROSS_SCOPE,
    RESOURCE_WRITE_FAILED,
    RESOURCE_NETWORK_FAILED,
    RESOURCE_INTERNAL,
];

#[test]
fn test_registered_table_matches_constants_count_and_order() {
    assert_eq!(
        REGISTERED.len(),
        18,
        "《06》§7.2 在册 18 码，登记表数量漂移即红"
    );
    assert_eq!(
        EXPORTED.len(),
        REGISTERED.len(),
        "公开常量面与码表数量必须一致"
    );
    for (index, (code, _, _)) in REGISTERED.iter().enumerate() {
        assert_eq!(
            EXPORTED[index], *code,
            "第 {index} 位常量与《06》§7.2 码表漂移"
        );
    }
}

#[test]
fn test_retryable_and_http_tables_locked() {
    for (code, retryable, status) in REGISTERED {
        assert_eq!(
            retryable_for(code),
            *retryable,
            "{code} retryable 与《06》§7.2 漂移"
        );
        assert_eq!(
            http_status_for(code),
            *status,
            "{code} 协议路径 HTTP 映射与《06》§7.2 漂移"
        );
    }
    // 未知码不得被映射表放行。
    assert_eq!(http_status_for("RESOURCE_NO_SUCH"), None);
    assert!(!retryable_for("RESOURCE_NO_SUCH"));
}

#[test]
fn test_code_grammar_domain_reason() {
    // `RESOURCE_/DOMAIN_REASON` 文法：固定前缀 + 全大写 ASCII 段（下划线连接）。
    for code in EXPORTED {
        let domain = code
            .strip_prefix("RESOURCE_")
            .unwrap_or_else(|| panic!("{code} 缺少 RESOURCE_ 前缀"));
        assert!(!domain.is_empty(), "{code} 段名不得为空");
        assert!(
            domain.chars().all(|c| c.is_ascii_uppercase() || c == '_'),
            "{code} 段名必须全大写 ASCII 加下划线"
        );
        assert!(!domain.starts_with('_'), "{code} 段名不得以下划线开头");
        assert!(!domain.ends_with('_'), "{code} 段名不得以下划线结尾");
        assert!(!domain.contains("__"), "{code} 段名不得含连续下划线");
    }
}

#[test]
fn test_error_variant_code_mapping_locked() {
    // 段一在册变体 → 码值逐只对照（与 REGISTERED 表交叉验证 code() 面）。
    let variants: Vec<(ResourceError, &str)> = vec![
        (
            ResourceError::InvalidUri {
                uri: "u".into(),
                reason: UriErrorReason::InvalidEncoding,
            },
            RESOURCE_INVALID_URI,
        ),
        (
            ResourceError::UnsupportedScheme { uri: "u".into() },
            RESOURCE_UNSUPPORTED_SCHEME,
        ),
        (
            ResourceError::NotFound { uri: "u".into() },
            RESOURCE_NOT_FOUND,
        ),
        (
            ResourceError::PathInvalid {
                uri: "u".into(),
                path: "p".into(),
                reason: PathErrorReason::Segment,
            },
            RESOURCE_PATH_INVALID,
        ),
        (
            ResourceError::PermissionDenied {
                target: "u".into(),
                permission: "p".into(),
                required: Vec::new(),
                missing: Vec::new(),
                granted: Vec::new(),
                reason: PermissionDenyReason::NotGranted,
            },
            RESOURCE_PERMISSION_DENIED,
        ),
        (
            ResourceError::TooLarge {
                uri: "u".into(),
                size: 2,
                limit: 1,
            },
            RESOURCE_TOO_LARGE,
        ),
        (ResourceError::Busy { uri: "u".into() }, RESOURCE_BUSY),
        (
            ResourceError::HandleReleased { uri: "u".into() },
            RESOURCE_HANDLE_RELEASED,
        ),
        (
            ResourceError::HandleInvalidated {
                uri: "u".into(),
                reason: InvalidateReason::SourceChanged,
            },
            RESOURCE_HANDLE_INVALIDATED,
        ),
        (
            ResourceError::PoolExhausted {
                kind: PoolKind::Handles,
                limit: 64,
            },
            RESOURCE_POOL_EXHAUSTED,
        ),
        (
            ResourceError::ReadOnly { uri: "u".into() },
            RESOURCE_READ_ONLY,
        ),
        (
            ResourceError::AlreadyExists { uri: "u".into() },
            RESOURCE_ALREADY_EXISTS,
        ),
        (
            ResourceError::NotSupported {
                uri: "u".into(),
                scope: chips_resource::ScopeKind::Memory,
                operation: ScopeOperation::List,
            },
            RESOURCE_NOT_SUPPORTED,
        ),
        (
            ResourceError::CrossScope {
                target: "u".into(),
                permission: "p".into(),
                required: Vec::new(),
                missing: Vec::new(),
                granted: Vec::new(),
                reason: PermissionDenyReason::NotGranted,
            },
            RESOURCE_CROSS_SCOPE,
        ),
        (ResourceError::Internal, RESOURCE_INTERNAL),
    ];
    for (error, expected) in &variants {
        assert_eq!(error.code(), *expected, "变体码映射与码表漂移");
        assert_eq!(
            error.retryable(),
            retryable_for(expected),
            "{expected} 变体 retryable 必须走在册表"
        );
    }
    // code() 值域必须是注册表子集（不新增、不自造码）。
    for (error, _) in &variants {
        assert!(
            REGISTERED.iter().any(|(code, _, _)| *code == error.code()),
            "{} 不在《06》§7.2 在册表内",
            error.code()
        );
    }
}

#[test]
fn test_uri_reason_wordlist_complete() {
    // 《06》§7.3 ResourceUriErrorReason 全 8 词逐字。
    let words: Vec<(UriErrorReason, &str)> = vec![
        (UriErrorReason::MalformedScheme, "malformed_scheme"),
        (UriErrorReason::UnsupportedScheme, "unsupported_scheme"),
        (UriErrorReason::MalformedScope, "malformed_scope"),
        (UriErrorReason::MalformedPath, "malformed_path"),
        (UriErrorReason::QueryNotAllowed, "query_not_allowed"),
        (UriErrorReason::FragmentNotAllowed, "fragment_not_allowed"),
        (UriErrorReason::InvalidEncoding, "invalid_encoding"),
        (UriErrorReason::InvalidOrigin, "invalid_origin"),
    ];
    assert_eq!(words.len(), 8, "URI reason 词表在册 8 词");
    for (reason, word) in words {
        assert_eq!(serde_json::to_value(reason).unwrap(), word);
    }
}

#[test]
fn test_path_reason_wordlist_complete() {
    // 《06》§7.3 ResourcePathErrorReason 全 9 词逐字。
    let words: Vec<(PathErrorReason, &str)> = vec![
        (PathErrorReason::Absolute, "absolute"),
        (PathErrorReason::Separator, "separator"),
        (PathErrorReason::Segment, "segment"),
        (PathErrorReason::Encoding, "encoding"),
        (PathErrorReason::Control, "control"),
        (PathErrorReason::Unicode, "unicode"),
        (PathErrorReason::Length, "length"),
        (PathErrorReason::Symlink, "symlink"),
        (PathErrorReason::Platform, "platform"),
    ];
    assert_eq!(words.len(), 9, "路径 reason 词表在册 9 词");
    for (reason, word) in words {
        assert_eq!(serde_json::to_value(reason).unwrap(), word);
    }
}

#[test]
fn test_details_key_shapes_locked() {
    // §7.3 details 结构逐键对照。
    let keys = |error: &ResourceError| -> Vec<String> {
        let details = error.details().expect("在册形状必须携带 details");
        let object = details.as_object().expect("details 必须是对象");
        let mut names: Vec<String> = object.keys().cloned().collect();
        names.sort();
        names
    };
    assert_eq!(
        keys(&ResourceError::InvalidUri {
            uri: "u".into(),
            reason: UriErrorReason::MalformedPath,
        }),
        ["reason", "uri"]
    );
    assert_eq!(
        keys(&ResourceError::UnsupportedScheme { uri: "u".into() }),
        ["reason", "uri"],
        "UNSUPPORTED_SCHEME 复用 IResourceUriErrorDetails（reason 固定 unsupported_scheme）"
    );
    assert_eq!(keys(&ResourceError::NotFound { uri: "u".into() }), ["uri"]);
    assert_eq!(
        keys(&ResourceError::PathInvalid {
            uri: "u".into(),
            path: "p".into(),
            reason: PathErrorReason::Segment,
        }),
        ["path", "reason", "uri"]
    );
    let denied = ResourceError::PermissionDenied {
        target: "u".into(),
        permission: "p".into(),
        required: Vec::new(),
        missing: Vec::new(),
        granted: Vec::new(),
        reason: PermissionDenyReason::Policy,
    };
    let details = denied.details().unwrap();
    // IPermissionDeniedDetails（《02-Bridge》§5.4）：target 填规范 URI。
    assert_eq!(details["target"], "u");
    assert_eq!(details["reason"], "policy");
    for field in [
        "capabilityId",
        "permission",
        "required",
        "missing",
        "granted",
    ] {
        assert!(details.get(field).is_some(), "缺失 {field} 键");
    }
    assert_eq!(
        keys(&ResourceError::TooLarge {
            uri: "u".into(),
            size: 2,
            limit: 1,
        }),
        ["limit", "size", "uri"]
    );
    assert_eq!(keys(&ResourceError::Busy { uri: "u".into() }), ["uri"]);
    assert_eq!(
        keys(&ResourceError::HandleReleased { uri: "u".into() }),
        ["state", "uri"]
    );
    assert_eq!(
        keys(&ResourceError::HandleInvalidated {
            uri: "u".into(),
            reason: InvalidateReason::ScopeRevoked,
        }),
        ["reason", "state", "uri"]
    );
    assert_eq!(
        keys(&ResourceError::PoolExhausted {
            kind: PoolKind::Handles,
            limit: 64,
        }),
        ["kind", "limit"]
    );
    assert_eq!(keys(&ResourceError::ReadOnly { uri: "u".into() }), ["uri"]);
    assert_eq!(
        keys(&ResourceError::AlreadyExists { uri: "u".into() }),
        ["uri"]
    );
    assert!(
        ResourceError::Internal.details().is_none(),
        "RESOURCE_INTERNAL 无 details（诊断写宿主日志，《06》§7.3）"
    );
    // 段二 B1 新增两变体的 details 形状锁（Unicode 臂已由 PathInvalid 键形锁
    // {path, reason, uri} 覆盖，见上）。
    assert_eq!(
        keys(&ResourceError::NotSupported {
            uri: "u".into(),
            scope: chips_resource::ScopeKind::Memory,
            operation: ScopeOperation::List,
        }),
        ["operation", "scope", "uri"],
        "NotSupported 对齐 IResourceScopeErrorDetails"
    );
    let cross = ResourceError::CrossScope {
        target: "u".into(),
        permission: "p".into(),
        required: Vec::new(),
        missing: Vec::new(),
        granted: Vec::new(),
        reason: PermissionDenyReason::OutOfScope,
    };
    assert_eq!(
        keys(&cross),
        [
            "capabilityId",
            "granted",
            "missing",
            "permission",
            "reason",
            "required",
            "target"
        ],
        "CrossScope 复用 IPermissionDeniedDetails（《06》§7.2）"
    );
}

#[test]
fn test_scope_operation_wordlist_complete() {
    // 《06》§7.3 IResourceScopeErrorDetails.operation 全 6 词逐字。
    let words: Vec<(ScopeOperation, &str)> = vec![
        (ScopeOperation::List, "list"),
        (ScopeOperation::Write, "write"),
        (ScopeOperation::Delete, "delete"),
        (ScopeOperation::Rename, "rename"),
        (ScopeOperation::Copy, "copy"),
        (ScopeOperation::CreateDirectory, "create_directory"),
    ];
    assert_eq!(words.len(), 6, "作用域操作词表在册 6 词");
    for (operation, word) in words {
        assert_eq!(serde_json::to_value(operation).unwrap(), word);
    }
}

#[test]
fn test_unicode_reason_has_production() {
    // 工单042 裁定④触发臂在册产生面锁：段二 B1 起 `unicode` reason 由
    // 「零产生」翻为「有产生」（触发实现 `src/path_guard.rs`
    // `VirtualPath::validate` Unicode 臂与 `is_forbidden_unicode`，段三按
    // 工单043 裁定 A1 收紧为 Unicode 非字符全集）。此处经公开 URI
    // 入口逐字锁码值与 reason（2026-09-21 码归属更正：路径族
    // `RESOURCE_PATH_INVALID` + `IResourcePathErrorDetails{uri, path, reason}`）：
    let limits = ResourceLimits::default();
    for input in [
        "chips-resource://card-1/a%FFb",          // 裸 %FF：非法 UTF-8
        "chips-resource://card-1/a%C0%AFb",       // overlong 编码
        "chips-resource://card-1/a%ED%A0%80b",    // UTF-16 代理区
        "chips-resource://card-1/a%F5%80%80%80b", // 越界码位
        "chips-resource://card-1/a%EF%BF%BDb",    // U+FFFD 替换字符
        "chips-resource://card-1/a%EF%BF%BEb",    // U+FFFE 非字符
        "chips-resource://card-1/a%F2%AF%BF%BFb", // U+AFFFF（平面 10）
        // 工单043 裁定 A1 Unicode 全集补臂（段三收口）：平面 11–16 末端
        // 非字符族与非字符区 U+FDD0–U+FDEF。
        "chips-resource://card-1/a%F2%BF%BF%BEb", // U+BFFFE（平面 11）
        "chips-resource://card-1/a%F4%8F%BF%BFb", // U+10FFFF（平面 16 末端）
        "chips-resource://card-1/a%EF%B7%90b",    // U+FDD0（非字符区区首）
        "chips-resource://card-1/a%EF%B7%AFb",    // U+FDEF（非字符区区尾）
    ] {
        let error = chips_resource::resolve_input(input, &limits)
            .expect_err("{input} 必须触发 Unicode 臂拒绝");
        assert_eq!(error.code(), RESOURCE_PATH_INVALID, "{input}");
        let details = error.details().expect("必须携带 details");
        assert_eq!(details["reason"], "unicode", "{input}");
        assert_eq!(details["uri"], input, "{input}");
        assert!(details.get("path").is_some(), "{input} 路径族必携 path 键");
    }
    // 分流不变：%zz 语法非法仍走 invalid_encoding（URI 8 词表不扩词）。
    let error = chips_resource::resolve_input("chips-resource://card-1/a%zzb", &limits)
        .expect_err("语法非法必须拒绝");
    assert_eq!(error.code(), RESOURCE_INVALID_URI);
    assert_eq!(error.details().unwrap()["reason"], "invalid_encoding");
    // NFC 差异永不构成拒绝：等价异字节序双双通过。
    let composed = chips_resource::resolve_input("chips-resource://card-1/caf%C3%A9", &limits)
        .expect("NFC 预组合形态必须放行");
    let decomposed = chips_resource::resolve_input("chips-resource://card-1/cafe%CC%81", &limits)
        .expect("NFC 分解形态必须放行");
    assert_eq!(
        composed.to_canonical_string(),
        decomposed.to_canonical_string()
    );
}

#[test]
fn test_state_and_reason_vocabularies_serialization() {
    // HandleState 3 词、InvalidateReason 3 词（kebab-case）、PoolKind 2 词、
    // PermissionDenyReason 5 词，逐字对照《06》§7.3/§6.1 与《02-Bridge》§5.4。
    assert_eq!(serde_json::to_value(HandleState::Open).unwrap(), "open");
    assert_eq!(
        serde_json::to_value(HandleState::Invalidated).unwrap(),
        "invalidated"
    );
    assert_eq!(
        serde_json::to_value(HandleState::Released).unwrap(),
        "released"
    );
    assert_eq!(
        serde_json::to_value(InvalidateReason::SourceChanged).unwrap(),
        "source-changed"
    );
    assert_eq!(
        serde_json::to_value(InvalidateReason::SessionClosed).unwrap(),
        "session-closed"
    );
    assert_eq!(
        serde_json::to_value(InvalidateReason::ScopeRevoked).unwrap(),
        "scope-revoked"
    );
    assert_eq!(serde_json::to_value(PoolKind::Handles).unwrap(), "handles");
    assert_eq!(serde_json::to_value(PoolKind::Queue).unwrap(), "queue");
    for (reason, word) in [
        (PermissionDenyReason::NotGranted, "not_granted"),
        (PermissionDenyReason::Revoked, "revoked"),
        (PermissionDenyReason::OutOfScope, "out_of_scope"),
        (PermissionDenyReason::UserRejected, "user_rejected"),
        (PermissionDenyReason::Policy, "policy"),
    ] {
        assert_eq!(serde_json::to_value(reason).unwrap(), word);
    }
}

#[test]
fn test_b2_not_empty_and_write_failed_locked() {
    // 段二 B2 产化映射锁（纯新增，不改既有 18 码表条目）：
    // NotEmpty / WriteFailed 两变体 → 码值、retryable 走在册表、
    // details 键形 {uri} 单键（《06》§7.3；WRITE_FAILED 的 cause 分类
    // 词表未在册，不自造，见 findings 登记）。
    let samples: Vec<(ResourceError, &str, bool)> = vec![
        (
            ResourceError::NotEmpty { uri: "u".into() },
            RESOURCE_NOT_EMPTY,
            false,
        ),
        (
            ResourceError::WriteFailed { uri: "u".into() },
            RESOURCE_WRITE_FAILED,
            true,
        ),
    ];
    for (error, code, retryable) in samples {
        assert_eq!(error.code(), code, "B2 产化变体码映射与码表漂移");
        assert_eq!(error.retryable(), retryable);
        assert_eq!(
            error.retryable(),
            retryable_for(code),
            "{code} retryable 必须走在册表"
        );
        assert!(
            REGISTERED
                .iter()
                .any(|(registered, _, _)| *registered == code),
            "{code} 必须在《06》§7.2 在册表内"
        );
        let details = error.details().expect("B2 产化两码必携 details");
        let object = details.as_object().expect("details 必须是对象");
        let mut names: Vec<&String> = object.keys().collect();
        names.sort();
        assert_eq!(names, vec!["uri"], "{code} details 键形漂移");
    }
}

#[test]
fn test_chips_error_single_form_carries_registered_code() {
    // 跨边界归一：ChipsError.code 逐码原样上抛，不改写、不折算。
    let samples = [
        ResourceError::TooLarge {
            uri: "u".into(),
            size: 9,
            limit: 1,
        },
        ResourceError::HandleInvalidated {
            uri: "u".into(),
            reason: InvalidateReason::SessionClosed,
        },
        ResourceError::Internal,
    ];
    for error in &samples {
        let chips_error = chips_core::ChipsError::from(error.clone());
        assert_eq!(chips_error.code(), error.code());
        assert_eq!(chips_error.retryable(), error.retryable());
        assert_eq!(chips_error.details(), error.details().as_ref());
    }
}
