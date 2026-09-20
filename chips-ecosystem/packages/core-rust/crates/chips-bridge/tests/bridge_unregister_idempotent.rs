//! 注销幂等性回归（《能力契约规范》§4.4：「注销是幂等操作：对已注销 ID 重复
//! 注销为 no-op，不产生错误」）。
//!
//! 本用例锁定工单005 补测期间发现的文档-实现冲突收口：实现曾对未命中 ID 的
//! `unregister` 返回 `BRIDGE_CAPABILITY_NOT_FOUND`，已按文档修正为 no-op。

use std::collections::BTreeMap;
use std::sync::Arc;

use chips_bridge::{
    Bridge, CapabilityContext, CapabilityDescriptor, CapabilityExecutor, CapabilityInput,
    CapabilityOutput, CapabilityRegistration, ProviderKind, ProviderRegistration,
};
use chips_core::ChipsError;
use serde_json::json;

/// 回声执行器：原样返回输入。
struct Echo;

#[async_trait::async_trait]
impl CapabilityExecutor for Echo {
    async fn execute(
        &self,
        _ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError> {
        Ok(CapabilityOutput {
            json: input.json,
            bin: BTreeMap::new(),
        })
    }
}

/// 激活官方提供方并注册一个最小可注销能力。
fn bridge_with_echo() -> Bridge {
    let bridge = Bridge::new();
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("提供方激活应成功");
    bridge
        .register(CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: json!({"type":"object","additionalProperties":false}),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: chips_bridge::DEFAULT_TIMEOUT_MS,
            concurrency: chips_bridge::Concurrency::default(),
            max_queue: chips_bridge::DEFAULT_MAX_QUEUE,
            executor: Arc::new(Echo),
        })
        .expect("能力注册应成功");
    bridge
}

#[test]
fn test_unregister_unknown_id_is_noop() {
    let bridge = Bridge::new();
    bridge
        .activate_provider(ProviderRegistration {
            id: "chips.official.host".to_owned(),
            kind: ProviderKind::PlatformService,
            permissions: Vec::new(),
        })
        .expect("提供方激活应成功");
    bridge
        .unregister("file:never-registered")
        .expect("未注册 ID 的注销必须是 no-op（§4.4 幂等）");
}

#[test]
fn test_unregister_repeat_is_noop() {
    let bridge = bridge_with_echo();
    bridge.unregister("file:read").expect("首次注销应成功");
    assert!(!bridge.has_capability("file:read"), "注销后注册表不应命中");
    bridge
        .unregister("file:read")
        .expect("重复注销必须是 no-op（§4.4 幂等）");
}
