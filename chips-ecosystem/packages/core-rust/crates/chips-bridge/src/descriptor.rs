//! 能力描述、输入输出信封与执行器抽象（《核心接口规范》§5.1、§5.2）。

use std::collections::BTreeMap;
use std::sync::Arc;

use async_trait::async_trait;
use chips_core::{CancelToken, ChipsError, PluginId, SessionId};

/// 能力描述：注册与静态发现所需的元数据。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapabilityDescriptor {
    /// 能力 ID：`<domain>:<action>[:<target>]`。
    pub id: String,
    /// 输入的 JSON Schema。
    pub schema: serde_json::Value,
    /// 执行该能力所需权限 ID 的并集。
    pub permissions: Vec<String>,
}

/// 并发策略。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Concurrency {
    /// 同一能力可并发执行。
    #[default]
    Parallel,
    /// 同一能力 ID 全局串行，队列上限为 `max_queue`。
    Serial,
}

/// 能力输入信封：`json` 走 schema 校验；`bin` 承载 `x-chips-binary` 字段的字节。
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CapabilityInput {
    /// JSON 段；按能力 schema 校验（含严格数值与 `format` 白名单）。
    pub json: serde_json::Value,
    /// 二进制表：键 → 字节；与 `json` 中 `x-chips-binary` 字段的键引用一一对应。
    pub bin: BTreeMap<String, Vec<u8>>,
}

impl CapabilityInput {
    /// 以 JSON 值构造纯文本输入（无二进制段）。
    #[must_use]
    pub fn json_only(json: serde_json::Value) -> Self {
        Self {
            json,
            bin: BTreeMap::new(),
        }
    }
}

/// 能力输出信封；`bin` 表与 `json` 中声明为 `x-chips-binary` 的字段一一对应。
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CapabilityOutput {
    /// JSON 段；输出不做运行时 schema 校验（《能力契约规范》§2.1 不变量 2）。
    pub json: serde_json::Value,
    /// 二进制表；输出二进制同样经 `bin` 表回传。
    pub bin: BTreeMap<String, Vec<u8>>,
}

/// 能力执行的取消与截止信息；对应 TS 侧 `ctx.signal` / `ctx.deadline`。
#[derive(Debug, Clone)]
pub struct CapabilityContext {
    /// 取消信号；会话销毁、能力注销、Bridge 关闭与超时触发。
    pub signal: CancelToken,
    /// 执行截止时刻。
    pub deadline: std::time::Instant,
}

/// 能力执行器：Rust 能力与 TS 能力共用该抽象。
#[async_trait]
pub trait CapabilityExecutor: Send + Sync {
    /// 执行能力；`input.json` 已通过 Schema 校验；错误必须归一为 `ChipsError`。
    /// 实现必须响应 `ctx.signal` 并在 `ctx.deadline` 前收口。
    async fn execute(
        &self,
        ctx: &CapabilityContext,
        input: CapabilityInput,
    ) -> Result<CapabilityOutput, ChipsError>;
}

/// 能力注册项；对应《Bridge三层设计》§4.1 的注册结构：
/// `ICapability` 的元数据抽为 [`CapabilityDescriptor`]，执行部分抽为
/// [`CapabilityExecutor`]。
#[derive(Clone)]
pub struct CapabilityRegistration {
    /// 能力描述（ID、输入 schema、所需权限并集）。
    pub descriptor: CapabilityDescriptor,
    /// 提供方标识：平台服务域 ID 或服务插件 ID（反向域名）。
    pub owner: String,
    /// 调用超时（毫秒），默认 30000。
    pub timeout_ms: u64,
    /// 并发策略。
    pub concurrency: Concurrency,
    /// 串行队列上限，默认 32。
    pub max_queue: usize,
    /// 能力执行器。
    pub executor: Arc<dyn CapabilityExecutor>,
}

impl std::fmt::Debug for CapabilityRegistration {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("CapabilityRegistration")
            .field("descriptor", &self.descriptor)
            .field("owner", &self.owner)
            .field("timeout_ms", &self.timeout_ms)
            .field("concurrency", &self.concurrency)
            .field("max_queue", &self.max_queue)
            .finish_non_exhaustive()
    }
}

/// 一次能力调用请求（《核心接口规范》§5.2）。
#[derive(Debug, Clone)]
pub struct BridgeRequest {
    /// 调用唯一标识（UUID v4），由 preload 生成。
    pub request_id: String,
    /// 目标能力 ID。
    pub capability_id: String,
    /// 已由适配层解析的会话。
    pub session: SessionId,
    /// 输入信封；`json` 的 Schema 校验在 `request` 内完成，`bin` 直接透明传递。
    pub input: CapabilityInput,
}

/// 执行器可见的调用上下文。
///
/// Bridge 在准入成功后为每次调用组装本结构；Rust 执行器经
/// [`CapabilityContext`] 接收取消与截止信息，宿主适配层（`chips-native`）
/// 经 [`Bridge::invocation_context`](crate::Bridge::invocation_context)
/// 读取完整上下文用于审计与事件追踪。
#[derive(Debug, Clone)]
pub struct InvocationContext {
    /// 调用唯一标识，与请求一致。
    pub request_id: String,
    /// 目标能力 ID。
    pub capability_id: String,
    /// 能力提供方标识。
    pub owner: String,
    /// 调用会话。
    pub session: SessionId,
    /// 调用方插件 ID（会话快照携带，仅用于诊断与审计，不参与授权）。
    pub plugin_id: PluginId,
    /// 追踪 ID，与事件、权限审计一致。
    pub trace_id: String,
    /// 取消令牌；取消、超时、会话销毁时触发。
    pub cancel: CancelToken,
    /// 执行截止时刻；与 `CapabilityContext.deadline` 同源。
    pub deadline: std::time::Instant,
}

impl InvocationContext {
    /// 派生执行器可见的能力上下文。
    #[must_use]
    pub fn capability_context(&self) -> CapabilityContext {
        CapabilityContext {
            signal: self.cancel.clone(),
            deadline: self.deadline,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_concurrency_default_is_parallel() {
        assert_eq!(Concurrency::default(), Concurrency::Parallel);
    }

    #[test]
    fn test_capability_input_json_only() {
        let input = CapabilityInput::json_only(serde_json::json!({"path": "a"}));
        assert_eq!(input.json, serde_json::json!({"path": "a"}));
        assert!(input.bin.is_empty());
    }

    #[test]
    fn test_registration_debug_is_non_exhaustive() {
        struct Noop;
        #[async_trait]
        impl CapabilityExecutor for Noop {
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
        let registration = CapabilityRegistration {
            descriptor: CapabilityDescriptor {
                id: "file:read".to_owned(),
                schema: serde_json::json!({"type": "object"}),
                permissions: Vec::new(),
            },
            owner: "chips.official.host".to_owned(),
            timeout_ms: crate::constants::DEFAULT_TIMEOUT_MS,
            concurrency: Concurrency::default(),
            max_queue: crate::constants::DEFAULT_MAX_QUEUE,
            executor: Arc::new(Noop),
        };
        let rendered = format!("{registration:?}");
        assert!(rendered.contains("file:read"));
        assert!(!rendered.contains("executor"));
    }

    #[test]
    fn test_invocation_context_derives_capability_context() {
        let context = InvocationContext {
            request_id: "req-1".to_owned(),
            capability_id: "file:read".to_owned(),
            owner: "chips.official.host".to_owned(),
            session: 7,
            plugin_id: "chips.official.editor".to_owned(),
            trace_id: "trace-1".to_owned(),
            cancel: CancelToken::new(),
            deadline: std::time::Instant::now(),
        };
        let capability_context = context.capability_context();
        assert!(!capability_context.signal.is_cancelled());
        assert_eq!(capability_context.deadline, context.deadline);
        capability_context.signal.cancel();
        assert!(context.cancel.is_cancelled());
    }
}
