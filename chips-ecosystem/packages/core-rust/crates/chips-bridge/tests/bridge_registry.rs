//! 注册表集成测试：提供方激活、能力 ID 登记、注册校验全分支与注销。
//!
//! 断言口径以《能力契约规范》§3.1（文法）、§4（注册/发现/注销）、§9（第三方
//! 注册规则）与《核心接口规范》§5 为准；`retryable` 取值以《Bridge三层设计》
//! §9.2 错误码表为准。

use std::sync::Arc;

use chips_bridge::{
    Bridge, BridgeRequest, CapabilityContext, CapabilityDescriptor, CapabilityExecutor,
    CapabilityInput, CapabilityOutput, CapabilityRegistration, Concurrency, ProviderKind,
    ProviderRegistration, BRIDGE_CAPABILITY_CONFLICT, BRIDGE_CAPABILITY_NOT_FOUND,
    BRIDGE_INVALID_SCHEMA, KERNEL_INVALID_TRANSITION, PERMISSION_NOT_DECLARED, PERMISSION_UNKNOWN,
};
use chips_core::{ChipsError, NoopDecisionObserver};
use serde_json::json;

/// 回声执行器：原样返回输入信封。
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

/// 平台服务域提供方登记。
fn host_provider(permissions: &[&str]) -> ProviderRegistration {
    ProviderRegistration {
        id: "chips.official.host".to_owned(),
        kind: ProviderKind::PlatformService,
        permissions: permissions.iter().map(|item| (*item).to_owned()).collect(),
    }
}

/// 服务插件提供方登记。
fn plugin_provider(id: &str, permissions: &[&str]) -> ProviderRegistration {
    ProviderRegistration {
        id: id.to_owned(),
        kind: ProviderKind::ServicePlugin,
        permissions: permissions.iter().map(|item| (*item).to_owned()).collect(),
    }
}

/// 标准回声输入 schema（《能力契约规范》§5 子集内）。
fn echo_schema() -> serde_json::Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["path"],
        "properties": { "path": { "type": "string", "minLength": 1 } }
    })
}

/// 构造注册项。
fn registration(
    id: &str,
    owner: &str,
    permissions: &[&str],
    timeout_ms: u64,
) -> CapabilityRegistration {
    CapabilityRegistration {
        descriptor: CapabilityDescriptor {
            id: id.to_owned(),
            schema: echo_schema(),
            permissions: permissions.iter().map(|item| (*item).to_owned()).collect(),
        },
        owner: owner.to_owned(),
        timeout_ms,
        concurrency: Concurrency::default(),
        max_queue: chips_bridge::DEFAULT_MAX_QUEUE,
        executor: Arc::new(EchoExecutor),
    }
}

/// 构造最小调用请求。
fn request_of(session: u64, capability_id: &str) -> BridgeRequest {
    BridgeRequest {
        request_id: format!("req-{capability_id}"),
        capability_id: capability_id.to_owned(),
        session,
        input: CapabilityInput::json_only(json!({ "path": "readme.md" })),
    }
}

#[test]
fn test_activate_provider_rejects_unknown_permission() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    let error = bridge
        .activate_provider(host_provider(&["filesystem:wipe"]))
        .expect_err("未注册权限 ID 必须拒绝激活");
    assert_eq!(error.code(), PERMISSION_UNKNOWN, "权限词表外必须报未知权限");
    assert!(!error.retryable(), "PERMISSION_UNKNOWN 不可重试");
    let details = error.details().expect("未知权限错误必须携带详情");
    assert_eq!(details["permission"], json!("filesystem:wipe"));
    assert!(
        !bridge.has_capability("file:read"),
        "激活失败不应产生注册副作用"
    );
}

#[test]
fn test_activate_provider_duplicate_overwrites_declaration() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&["filesystem:read"]))
        .expect("平台服务域激活应成功");
    bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &["filesystem:read"],
            30_000,
        ))
        .expect("已声明权限的能力注册应成功");
    // 重复激活：以最新声明覆盖（授权变更重建，《08-权限系统设计》§7.6）。
    bridge
        .activate_provider(host_provider(&[]))
        .expect("重复激活应覆盖声明");
    let error = bridge
        .register(registration(
            "file:list",
            "chips.official.host",
            &["filesystem:read"],
            30_000,
        ))
        .expect_err("覆盖后未声明的权限必须拒绝注册");
    assert_eq!(error.code(), PERMISSION_NOT_DECLARED);
    assert!(!error.retryable());
}

#[test]
fn test_grant_capability_id_rejects_invalid_grammar() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(plugin_provider("chips.service.hello", &[]))
        .expect("服务插件激活应成功");
    for bad in [
        "Hello:greet",
        "hello:greet:target:extra",
        "hello:greet_snake",
    ] {
        let error = bridge
            .grant_capability_id(bad, "chips.service.hello")
            .expect_err("文法非法的 ID 必须拒绝登记");
        assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT, "非法 ID：{bad}");
        assert!(!error.retryable(), "BRIDGE_CAPABILITY_CONFLICT 不可重试");
        let details = error.details().expect("冲突错误必须携带详情");
        assert_eq!(details["capabilityId"], json!(bad));
    }
}

#[test]
fn test_grant_capability_id_rejects_builtin_reserved() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(plugin_provider("chips.service.hello", &[]))
        .expect("服务插件激活应成功");
    let error = bridge
        .grant_capability_id("file:read", "chips.service.hello")
        .expect_err("内置保留 ID 不得登记给第三方");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    let details = error.details().expect("冲突错误必须携带详情");
    assert_eq!(details["reason"], json!("内置保留 ID 由平台服务域持有"));
}

#[test]
fn test_grant_capability_id_requires_active_provider() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    let error = bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect_err("未知提供方不得登记 ID");
    assert_eq!(error.code(), KERNEL_INVALID_TRANSITION);
}

#[test]
fn test_grant_capability_id_is_idempotent_and_non_transferable() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(plugin_provider("chips.service.hello", &[]))
        .expect("hello 提供方激活应成功");
    bridge
        .activate_provider(plugin_provider("chips.service.other", &[]))
        .expect("other 提供方激活应成功");
    bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect("首次登记应成功");
    bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect("同 owner 重复登记应幂等成功");
    let error = bridge
        .grant_capability_id("hello:greet", "chips.service.other")
        .expect_err("登记绑定不可转让、不可改绑");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    let details = error.details().expect("冲突错误必须携带详情");
    assert_eq!(details["reason"], json!("登记提供方与 owner 不一致"));
}

#[test]
fn test_register_rejects_invalid_grammar() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&[]))
        .expect("平台服务域激活应成功");
    for bad in [
        "file_read",
        "file",
        "File:read",
        "文档:read",
        "file:read:t:x",
    ] {
        let error = bridge
            .register(registration(bad, "chips.official.host", &[], 30_000))
            .expect_err("文法非法必须拒绝注册");
        assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT, "非法 ID：{bad}");
        assert!(!error.retryable());
    }
}

#[test]
fn test_register_rejects_capability_id_equal_permission_id() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&["filesystem:read"]))
        .expect("平台服务域激活应成功");
    // R3：能力 ID 与权限 ID 是两个互相隔离的命名空间。
    let error = bridge
        .register(registration(
            "filesystem:read",
            "chips.official.host",
            &[],
            30_000,
        ))
        .expect_err("能力 ID 与权限 ID 同名必须拒绝（R3）");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    let details = error.details().expect("冲突错误必须携带详情");
    assert_eq!(details["reason"], json!("能力 ID 与权限 ID 相同（R3）"));
}

#[test]
fn test_register_rejects_out_of_range_timeout() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&[]))
        .expect("平台服务域激活应成功");
    let zero = bridge
        .register(registration("file:read", "chips.official.host", &[], 0))
        .expect_err("timeout_ms 为 0 必须拒绝");
    assert_eq!(zero.code(), BRIDGE_CAPABILITY_CONFLICT);
    let huge = bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &[],
            u64::from(u32::MAX) + 1,
        ))
        .expect_err("timeout_ms 超上限必须拒绝");
    assert_eq!(huge.code(), BRIDGE_CAPABILITY_CONFLICT);
    assert!(
        !bridge.has_capability("file:read"),
        "拒绝注册不得留下注册项"
    );
}

#[test]
fn test_register_rejects_inactive_owner() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    let error = bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &[],
            30_000,
        ))
        .expect_err("owner 未激活必须拒绝注册");
    assert_eq!(
        error.code(),
        KERNEL_INVALID_TRANSITION,
        "《能力契约规范》§4.2 第 7 项"
    );
    assert!(!error.retryable());
}

#[test]
fn test_register_rejects_builtin_id_by_service_plugin() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(plugin_provider("chips.service.hello", &[]))
        .expect("服务插件激活应成功");
    let error = bridge
        .register(registration(
            "file:read",
            "chips.service.hello",
            &[],
            30_000,
        ))
        .expect_err("第三方不得注册内置保留 ID");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    let details = error.details().expect("冲突错误必须携带详情");
    assert_eq!(details["reason"], json!("内置 ID 由平台服务域持有"));
}

#[test]
fn test_register_rejects_ungranted_third_party_id() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(plugin_provider("chips.service.hello", &[]))
        .expect("服务插件激活应成功");
    let error = bridge
        .register(registration(
            "hello:greet",
            "chips.service.hello",
            &[],
            30_000,
        ))
        .expect_err("未登记 ID 不得注册（登记前置，《能力契约规范》§9.1）");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    let details = error.details().expect("冲突错误必须携带详情");
    assert_eq!(details["reason"], json!("未登记 ID"));
}

#[test]
fn test_register_rejects_id_granted_to_other_owner() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(plugin_provider("chips.service.hello", &[]))
        .expect("hello 提供方激活应成功");
    bridge
        .activate_provider(plugin_provider("chips.service.other", &[]))
        .expect("other 提供方激活应成功");
    bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect("登记应成功");
    let error = bridge
        .register(registration(
            "hello:greet",
            "chips.service.other",
            &[],
            30_000,
        ))
        .expect_err("登记提供方与 owner 不一致必须拒绝");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
}

#[test]
fn test_register_rejects_unknown_descriptor_permission() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&["filesystem:read"]))
        .expect("平台服务域激活应成功");
    let error = bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &["filesystem:wipe"],
            30_000,
        ))
        .expect_err("词表外权限必须拒绝注册");
    assert_eq!(
        error.code(),
        PERMISSION_UNKNOWN,
        "《能力契约规范》§4.2 第 6 项"
    );
    assert!(!error.retryable());
    let details = error.details().expect("未知权限错误必须携带详情");
    assert_eq!(details["permission"], json!("filesystem:wipe"));
    assert_eq!(details["capabilityId"], json!("file:read"));
}

#[test]
fn test_register_rejects_undeclared_descriptor_permission() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&["filesystem:read"]))
        .expect("平台服务域激活应成功");
    let error = bridge
        .register(registration(
            "file:write",
            "chips.official.host",
            &["filesystem:write"],
            30_000,
        ))
        .expect_err("manifest 未声明的权限必须拒绝注册");
    assert_eq!(error.code(), PERMISSION_NOT_DECLARED);
    assert!(!error.retryable());
    let details = error.details().expect("未声明权限错误必须携带详情");
    assert_eq!(details["permission"], json!("filesystem:write"));
    assert_eq!(details["owner"], json!("chips.official.host"));
}

#[test]
fn test_register_rejects_uncompilable_schema() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&[]))
        .expect("平台服务域激活应成功");
    let mut item = registration("file:read", "chips.official.host", &[], 30_000);
    item.descriptor.schema = json!({
        "$id": "https://example.com/schema.json",
        "type": "object",
        "additionalProperties": false
    });
    let error = bridge
        .register(item)
        .expect_err("白名单外关键字必须拒绝编译（《能力契约规范》§5.1）");
    assert_eq!(error.code(), BRIDGE_INVALID_SCHEMA);
    assert!(!error.retryable());
    assert!(error.details().is_some(), "schema 编译错误必须携带定位详情");
    assert!(
        !bridge.has_capability("file:read"),
        "编译失败不得写入注册表"
    );
}

#[test]
fn test_register_builtin_success_and_repeat_conflict_matrix() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&["filesystem:read"]))
        .expect("平台服务域激活应成功");
    bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &["filesystem:read"],
            30_000,
        ))
        .expect("内置能力注册应成功");
    assert!(bridge.has_capability("file:read"));
    // 同 owner 同定义重复注册：幂等成功（《能力契约规范》§9.3）。
    bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &["filesystem:read"],
            30_000,
        ))
        .expect("同定义重复注册应幂等成功");
    // 定义不一致：超时不同 → 冲突。
    let error = bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &["filesystem:read"],
            31_000,
        ))
        .expect_err("重复注册定义不一致必须拒绝");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    let details = error.details().expect("冲突错误必须携带详情");
    assert_eq!(details["reason"], json!("重复注册定义不一致"));
    // 定义不一致：schema 不同 → 冲突。
    let mut changed = registration(
        "file:read",
        "chips.official.host",
        &["filesystem:read"],
        30_000,
    );
    changed.descriptor.schema = json!({"type": "object", "additionalProperties": false});
    let error = bridge.register(changed).expect_err("schema 不一致必须拒绝");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    assert!(
        bridge.has_capability("file:read"),
        "冲突拒绝不得破坏既有注册项"
    );
}

#[test]
fn test_register_reuses_schema_cache_across_capabilities() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&[]))
        .expect("平台服务域激活应成功");
    // 相同 schema 摘要命中编译缓存（《Bridge三层设计》§6.2）。
    bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &[],
            30_000,
        ))
        .expect("首次注册应编译并缓存 schema");
    bridge
        .register(registration(
            "file:list",
            "chips.official.host",
            &[],
            30_000,
        ))
        .expect("同 schema 的第二个能力应命中缓存注册成功");
    bridge.unregister("file:read").expect("注销应成功");
    bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &[],
            30_000,
        ))
        .expect("注销后重注册应命中缓存成功");
    assert!(bridge.has_capability("file:read"));
    assert!(bridge.has_capability("file:list"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_unregister_then_request_not_found() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&[]))
        .expect("平台服务域激活应成功");
    bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &[],
            30_000,
        ))
        .expect("注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let output = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect("注销前调用应成功");
    assert_eq!(output.json["path"], json!("readme.md"));
    bridge
        .unregister("file:read")
        .expect("已注册能力的注销应成功");
    assert!(!bridge.has_capability("file:read"), "注销后注册表不应命中");
    let error = bridge
        .request(request_of(1, "file:read"))
        .await
        .expect_err("注销后调用必须拒绝");
    assert_eq!(
        error.code(),
        BRIDGE_CAPABILITY_NOT_FOUND,
        "《能力契约规范》§4.4"
    );
    assert!(!error.retryable(), "BRIDGE_CAPABILITY_NOT_FOUND 不可重试");
    let details = error.details().expect("未找到错误必须携带详情");
    assert_eq!(details["capabilityId"], json!("file:read"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_unregistered_id_only_original_owner_can_re_register() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(plugin_provider("chips.service.hello", &[]))
        .expect("hello 提供方激活应成功");
    bridge
        .activate_provider(plugin_provider("chips.service.other", &[]))
        .expect("other 提供方激活应成功");
    bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect("登记应成功");
    bridge
        .register(registration(
            "hello:greet",
            "chips.service.hello",
            &[],
            30_000,
        ))
        .expect("注册应成功");
    bridge.unregister("hello:greet").expect("注销应成功");
    // 其他 owner 抢占已注销 ID：拒绝（《能力契约规范》§9.3）。
    let error = bridge
        .register(registration(
            "hello:greet",
            "chips.service.other",
            &[],
            30_000,
        ))
        .expect_err("登记绑定不可转让，其他 owner 不得抢占");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
    // 仅登记绑定的原 owner 可重新注册（注册校验与首次一致）。
    bridge
        .register(registration(
            "hello:greet",
            "chips.service.hello",
            &[],
            30_000,
        ))
        .expect("原 owner 重新注册应成功");
    assert!(bridge.has_capability("hello:greet"));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_third_party_capability_full_success_path() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(plugin_provider("chips.service.hello", &["network:http"]))
        .expect("服务插件激活应成功");
    bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect("登记应成功");
    bridge
        .register(registration(
            "hello:greet",
            "chips.service.hello",
            &["network:http"],
            30_000,
        ))
        .expect("已登记且已声明权限的第三方能力注册应成功");
    bridge
        .open_session(
            7,
            "chips.official.editor".to_owned(),
            vec!["network:http".to_owned()],
        )
        .expect("会话登记应成功");
    let output = bridge
        .request(request_of(7, "hello:greet"))
        .await
        .expect("第三方能力调用链路应与内置能力完全一致");
    assert_eq!(output.json["path"], json!("readme.md"));
    assert!(output.bin.is_empty(), "回声输入无二进制段");
}

#[test]
fn test_debug_and_default_reflect_registry_state() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    assert!(
        format!("{bridge:?}").contains("shutdown: false"),
        "Debug 输出应反映未关闭状态"
    );
    bridge
        .activate_provider(host_provider(&[]))
        .expect("激活应成功");
    bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &[],
            30_000,
        ))
        .expect("注册应成功");
    bridge
        .open_session(1, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    let rendered = format!("{bridge:?}");
    assert!(
        rendered.contains("capabilities: 1"),
        "Debug 应含能力计数：{rendered}"
    );
    assert!(
        rendered.contains("sessions: 1"),
        "Debug 应含会话计数：{rendered}"
    );
    // 克隆句柄共享同一内核状态。
    let cloned = bridge.clone();
    assert!(
        cloned.has_capability("file:read"),
        "克隆句柄应看到同一注册表"
    );
    bridge.unregister("file:read").expect("注销应成功");
    assert!(
        !cloned.has_capability("file:read"),
        "注销对克隆句柄立即可见"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_deactivate_provider_removes_owned_capabilities() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(plugin_provider("chips.service.hello", &[]))
        .expect("服务插件激活应成功");
    bridge
        .grant_capability_id("hello:greet", "chips.service.hello")
        .expect("登记应成功");
    bridge
        .register(registration(
            "hello:greet",
            "chips.service.hello",
            &[],
            30_000,
        ))
        .expect("注册应成功");
    bridge
        .open_session(3, "chips.official.editor".to_owned(), Vec::new())
        .expect("会话登记应成功");
    bridge.deactivate_provider("chips.service.hello");
    assert!(
        !bridge.has_capability("hello:greet"),
        "停用提供方应注销其全部能力"
    );
    let error = bridge
        .request(request_of(3, "hello:greet"))
        .await
        .expect_err("停用后调用必须拒绝");
    assert_eq!(error.code(), BRIDGE_CAPABILITY_NOT_FOUND);
    // 幂等：停用未知提供方不产生任何影响。
    bridge.deactivate_provider("chips.service.unknown");
    assert!(!bridge.has_capability("hello:greet"));
}

#[test]
fn test_register_rejects_conflict_when_permission_mixed_order() {
    // 词表校验先于 manifest 声明校验：未注册权限优先报 PERMISSION_UNKNOWN。
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&["config:read"]))
        .expect("平台服务域激活应成功");
    let error = bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &["filesystem:wipe", "config:write"],
            30_000,
        ))
        .expect_err("混合缺失时词表错误优先");
    assert_eq!(error.code(), PERMISSION_UNKNOWN);
    // 全部在词表内但均未声明：报 PERMISSION_NOT_DECLARED。
    let error = bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &["config:write", "filesystem:read"],
            30_000,
        ))
        .expect_err("未声明权限必须拒绝注册");
    assert_eq!(error.code(), PERMISSION_NOT_DECLARED);
    assert!(!error.retryable());
}

#[test]
fn test_activate_provider_deduplicates_permission_declarations() {
    let bridge = Bridge::new(Arc::new(NoopDecisionObserver));
    bridge
        .activate_provider(host_provider(&[
            "filesystem:read",
            "filesystem:read",
            "config:read",
        ]))
        .expect("重复声明应去重激活成功");
    bridge
        .register(registration(
            "file:read",
            "chips.official.host",
            &["filesystem:read", "config:read"],
            30_000,
        ))
        .expect("去重后的声明集合应覆盖能力权限");
    assert!(bridge.has_capability("file:read"));
    assert!(
        format!("{bridge:?}").contains("capabilities: 1"),
        "激活与注册后能力计数应为 1"
    );
}
