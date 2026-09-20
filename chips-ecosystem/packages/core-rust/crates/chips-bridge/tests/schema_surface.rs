//! Schema 校验公开面集成测试：经 `Bridge::register` / `Bridge::request`
//! 正式链路钉住《能力契约规范》§5 的对外可观测语义——
//! - §5.1/§5.2：注册期离线编译，白名单外关键字、顶层形状缺陷按
//!   `BRIDGE_INVALID_SCHEMA` 拒绝注册，且 `details.reason` 为文档口径文案；
//! - §5.3：`x-chips-binary` 整数上限与 `true`（不额外限制）两端、白名单外
//!   `format` 仅作注解不强制；
//! - §5.4：调用期失败聚合为 `BRIDGE_INVALID_INPUT`，`details` 含
//!   `capabilityId` / `errors`（JSON Pointer 字典序升序）/ `truncated`，
//!   不携带用户输入原文；
//! - §5.4 校验时机：注册期编译并缓存校验器，同内容 schema 二次注册命中
//!   编译缓存后调用期语义完全一致。
//!
//! 断言一律取公开行为面，不触碰 `src/schema.rs` 内部符号。

use std::collections::BTreeMap;
use std::sync::Arc;

use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, Concurrency, ProviderKind,
    ProviderRegistration, BRIDGE_INVALID_INPUT, BRIDGE_INVALID_SCHEMA, MAX_VALIDATION_ISSUES,
};
use chips_core::ChipsError;
use serde_json::{json, Value};

/// 回声执行器：原样返回输入信封（含 bin 表回传）。
struct EchoExecutor;

#[async_trait::async_trait]
impl CapabilityExecutor for EchoExecutor {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        Ok(CapabilityOutput {
            json: input.json,
            bin: input.bin,
        })
    }
}

/// 激活平台服务域提供方并注册一个指定 schema 的内置回声能力。
fn register_capability(bridge: &Bridge, capability_id: &str, schema: Value) {
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("平台服务域激活应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: capability_id.to_owned(),
                schema,
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: chips_bridge::DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect("指定 schema 注册应成功");
}

/// 打开一个空授权快照会话（被测能力的权限集合一律为空，权限判定必然通过，
/// 失败只可能来自 schema 校验路径）。
fn open_session(bridge: &Bridge, session: u64) {
    bridge
        .open_session(session, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话打开应成功");
}

/// 构造一次调用请求。
fn request_of(
    session: u64,
    capability_id: &str,
    json_segment: Value,
    bin: BTreeMap<String, Vec<u8>>,
) -> BridgeRequest {
    BridgeRequest {
        request_id: format!("req-{capability_id}-{session}"),
        capability_id: capability_id.to_owned(),
        session,
        input: CapabilityInput {
            json: json_segment,
            bin,
        },
    }
}

/// 断言调用以 `BRIDGE_INVALID_INPUT` 失败并取出 `details`。
async fn invalid_input_details(bridge: &Bridge, request: BridgeRequest) -> Value {
    let error = bridge
        .request(request)
        .await
        .expect_err("非法输入必须以 BRIDGE_INVALID_INPUT 拒绝");
    assert_eq!(error.code(), BRIDGE_INVALID_INPUT);
    assert!(!error.retryable(), "BRIDGE_INVALID_INPUT 不可重试");
    error.details().expect("§5.4 details 必须存在").clone()
}

#[test]
fn test_register_rejects_out_of_subset_keyword_with_invalid_schema() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("激活应成功");
    let error = bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: json!({
                    "type": "object", "additionalProperties": false,
                    "patternProperties": { "^a": { "type": "string" } }
                }),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: 30_000,
            concurrency: Concurrency::default(),
            max_queue: chips_bridge::DEFAULT_MAX_QUEUE,
            executor: Arc::new(EchoExecutor),
        })
        .expect_err("白名单外关键字必须拒绝注册（§5.1）");
    assert_eq!(error.code(), BRIDGE_INVALID_SCHEMA);
    assert!(!error.retryable(), "BRIDGE_INVALID_SCHEMA 不可重试");
    assert!(
        error.message().starts_with("能力输入 schema 无法编译："),
        "实际消息：{}",
        error.message()
    );
    let details = error.details().expect("§5.4 口径：reason/pointer 详情");
    assert_eq!(
        details["reason"],
        json!("关键字 `patternProperties` 不在平台子集白名单内")
    );
    assert!(
        !bridge.has_capability("file:read"),
        "注册失败不得留下注册项"
    );
}

#[test]
fn test_register_requires_root_shape_per_section_5_2() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("激活应成功");
    let cases = vec![
        (json!({ "type": "string" }), "顶层必须为 type: \"object\""),
        (
            json!({ "type": "object", "properties": {} }),
            "顶层必须显式声明 additionalProperties: false",
        ),
    ];
    for (schema, reason) in cases {
        let error = bridge
            .register(CapabilityRegistration {
                descriptor: CapabilityDescriptor {
                    id: "file:read".to_owned(),
                    schema,
                    permissions: Vec::new(),
                },
                owner: "chips.official.host".to_owned(),
                timeout_ms: 30_000,
                concurrency: Concurrency::default(),
                max_queue: chips_bridge::DEFAULT_MAX_QUEUE,
                executor: Arc::new(EchoExecutor),
            })
            .expect_err("§5.2 规则 1 顶层形状缺陷必须拒绝注册");
        assert_eq!(error.code(), BRIDGE_INVALID_SCHEMA);
        assert_eq!(
            error.details().expect("详情应存在")["reason"],
            json!(reason)
        );
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_request_invalid_input_details_shape() {
    let bridge = Bridge::new();
    register_capability(
        &bridge,
        "file:read",
        json!({
            "type": "object", "additionalProperties": false,
            "required": ["path", "encoding"],
            "properties": {
                "path": { "type": "string", "minLength": 1 },
                "encoding": { "type": "string", "enum": ["utf-8", "base64"] }
            }
        }),
    );
    open_session(&bridge, 1);
    let details = invalid_input_details(
        &bridge,
        request_of(
            1,
            "file:read",
            json!({ "path": "", "sneaky": "secret-payload" }),
            BTreeMap::new(),
        ),
    )
    .await;
    assert_eq!(details["capabilityId"], json!("file:read"));
    assert_eq!(details["truncated"], json!(false));
    let errors = details["errors"].as_array().expect("errors 为数组");
    let triples: Vec<(&str, &str, &str)> = errors
        .iter()
        .map(|issue| {
            (
                issue["pointer"].as_str().unwrap_or_default(),
                issue["keyword"].as_str().unwrap_or_default(),
                issue["message"].as_str().unwrap_or_default(),
            )
        })
        .collect();
    // 缺必填、minLength 违规、未声明字段三类诊断同时聚合并排序输出。
    // 《能力契约规范》§5.4：pointer 指向输入中的失败位置——缺字段与
    // 未声明字段的失败位置都在输入对象本身（pointer 为空串）。
    for (pointer, keyword, message) in [
        ("", "required", "缺少必填字段：encoding"),
        ("/path", "minLength", "字符串长度不得小于 1"),
        ("", "additionalProperties", "存在未声明字段"),
    ] {
        assert!(
            triples
                .iter()
                .any(|(p, k, m)| p == &pointer && k == &keyword && m == &message),
            "应含 ({pointer}, {keyword}, {message})：{triples:?}"
        );
    }
    let pointers: Vec<&str> = triples.iter().map(|(p, _, _)| *p).collect();
    let mut sorted = pointers.clone();
    sorted.sort_unstable();
    assert_eq!(
        pointers, sorted,
        "errors 按 JSON Pointer 字典序升序（§5.4）"
    );
    let raw = serde_json::to_string(&details).expect("details 可序列化");
    assert!(
        !raw.contains("secret-payload") && !raw.contains("sneaky"),
        "details 不得携带用户输入原文（§5.4）：{raw}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_request_integer_strict_and_annotation_format_not_enforced() {
    let bridge = Bridge::new();
    register_capability(
        &bridge,
        "file:read",
        json!({
            "type": "object", "additionalProperties": false,
            "properties": {
                "count": { "type": "integer" },
                "mail": { "type": "string", "format": "email" }
            }
        }),
    );
    open_session(&bridge, 1);
    // §5.2 规则 5：integer 不接受浮点值（即使整值）。
    let details = invalid_input_details(
        &bridge,
        request_of(1, "file:read", json!({ "count": 2.0 }), BTreeMap::new()),
    )
    .await;
    let errors = details["errors"].as_array().expect("errors 为数组");
    assert!(
        errors.iter().any(|issue| {
            issue["pointer"] == json!("/count")
                && issue["keyword"] == json!("type")
                && issue["message"] == json!("integer 不接受浮点值")
        }),
        "应含平台严格 integer 诊断：{errors:?}"
    );
    // §5.3：白名单外 format 仅作注解，不强制校验。
    bridge
        .request(request_of(
            1,
            "file:read",
            json!({ "count": 2, "mail": "not-an-email" }),
            BTreeMap::new(),
        ))
        .await
        .expect("email 属白名单外注解，不得强制拒绝");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_request_binary_envelope_integer_limit_and_true_unlimited() {
    let bridge = Bridge::new();
    register_capability(
        &bridge,
        "file:write",
        json!({
            "type": "object", "additionalProperties": false,
            "required": ["data"],
            "properties": { "data": { "x-chips-binary": 4 } }
        }),
    );
    open_session(&bridge, 1);
    // 上限内：bin 表回传字节一致。
    let mut bin = BTreeMap::new();
    bin.insert("k".to_owned(), vec![1, 2, 3, 4]);
    let output = bridge
        .request(request_of(
            1,
            "file:write",
            json!({ "data": "k" }),
            bin.clone(),
        ))
        .await
        .expect("4 字节恰好达上限应通过");
    assert_eq!(output.bin, bin, "信封字节原样送达执行器");
    // 超限：按 x-chips-binary 诊断拒绝。
    let mut oversized = BTreeMap::new();
    oversized.insert("k".to_owned(), vec![0; 5]);
    let details = invalid_input_details(
        &bridge,
        request_of(1, "file:write", json!({ "data": "k" }), oversized),
    )
    .await;
    let errors = details["errors"].as_array().expect("errors 为数组");
    assert!(
        errors.iter().any(|issue| {
            issue["pointer"] == json!("/data")
                && issue["keyword"] == json!("x-chips-binary")
                && issue["message"] == json!("二进制载荷超过 4 字节上限")
        }),
        "应含字节上限诊断：{errors:?}"
    );

    // §5.3：`true` 表示不额外限制——远超常规尺寸的载荷必须可注册、可调用。
    register_capability(
        &bridge,
        "clipboard:write",
        json!({
            "type": "object", "additionalProperties": false,
            "required": ["data"],
            "properties": { "data": { "x-chips-binary": true } }
        }),
    );
    let mut huge = BTreeMap::new();
    huge.insert("blob".to_owned(), vec![9u8; 32 * 1024]);
    let output = bridge
        .request(request_of(
            1,
            "clipboard:write",
            json!({ "data": "blob" }),
            huge.clone(),
        ))
        .await
        .expect("true 登记的二进制字段不设字节上限");
    assert_eq!(output.bin, huge);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_request_truncates_beyond_max_issues() {
    let bridge = Bridge::new();
    let mut properties = serde_json::Map::new();
    let mut required = Vec::new();
    for index in 0..(MAX_VALIDATION_ISSUES + 1) {
        let name = format!("field{index}");
        properties.insert(name.clone(), json!({ "type": "string" }));
        required.push(Value::String(name));
    }
    register_capability(
        &bridge,
        "file:list",
        json!({
            "type": "object", "additionalProperties": false,
            "required": required, "properties": properties
        }),
    );
    open_session(&bridge, 1);
    let details = invalid_input_details(
        &bridge,
        request_of(1, "file:list", json!({}), BTreeMap::new()),
    )
    .await;
    assert_eq!(details["truncated"], json!(true), "超上限必须置截断标记");
    assert_eq!(
        details["errors"].as_array().expect("errors 为数组").len(),
        MAX_VALIDATION_ISSUES
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_same_schema_second_registration_reuses_compile_cache() {
    let bridge = Bridge::new();
    let schema = json!({
        "type": "object", "additionalProperties": false,
        "required": ["path"],
        "properties": { "path": { "type": "string", "minLength": 1 } }
    });
    register_capability(&bridge, "file:read", schema.clone());
    register_capability(&bridge, "file:write", schema.clone());
    open_session(&bridge, 1);
    // 两个能力共享同一编译缓存条目：调用期诊断口径完全一致。
    for capability_id in ["file:read", "file:write"] {
        let details = invalid_input_details(
            &bridge,
            request_of(1, capability_id, json!({ "path": "" }), BTreeMap::new()),
        )
        .await;
        assert_eq!(details["capabilityId"], json!(capability_id));
        let errors = details["errors"].as_array().expect("errors 为数组");
        assert_eq!(
            errors.len(),
            1,
            "同 schema 同实例应聚合出同一诊断：{errors:?}"
        );
        assert_eq!(errors[0]["keyword"], json!("minLength"));
        bridge
            .request(request_of(
                1,
                capability_id,
                json!({ "path": "readme.md" }),
                BTreeMap::new(),
            ))
            .await
            .expect("合法实例应通过缓存校验器");
    }
}
