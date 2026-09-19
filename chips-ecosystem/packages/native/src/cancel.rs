//! 取消令牌导出（`createCancelToken` / `cancelTokenCancel`）。
//!
//! 令牌以内核 [`chips_core::CancelToken`] 为唯一实现；`JsBox` 要求
//! `Finalize`，子系统 crate 类型不能实现外部 trait，故以透明包装类型
//! [`NativeCancelToken`] 暴露。取消是协作式的：持有令牌的任务必须在检查点
//! 响应取消并释放资源（《核心接口规范》§3.2）。

use chips_core::CancelToken;
use neon::prelude::*;

/// `CancelToken` 的 JS 句柄载体；对 JS 不透明、无字段、不可序列化。
#[derive(Debug, Clone, Default)]
pub struct NativeCancelToken(pub CancelToken);

impl Finalize for NativeCancelToken {}

impl NativeCancelToken {
    /// 创建未取消的令牌。
    #[must_use]
    pub fn new() -> Self {
        Self(CancelToken::new())
    }

    /// 触发取消；幂等；可从任意线程调用。
    pub fn cancel(&self) {
        self.0.cancel();
    }

    /// 是否已取消；可从任意线程调用。
    #[must_use]
    #[allow(dead_code)] // 提供取消状态查询；当前仅由单测消费，协作式检查点落地后接入。
    pub fn is_cancelled(&self) -> bool {
        self.0.is_cancelled()
    }
}

/// `createCancelToken()`：创建取消令牌句柄。
pub fn js_create_cancel_token(mut cx: FunctionContext) -> JsResult<JsBox<NativeCancelToken>> {
    Ok(cx.boxed(NativeCancelToken::new()))
}

/// `cancelTokenCancel(token)`：触发取消；幂等。
pub fn js_cancel_token_cancel(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let token = cx.argument::<JsBox<NativeCancelToken>>(0)?;
    token.cancel();
    Ok(cx.undefined())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cancel_token_cancel_is_idempotent() {
        let token = NativeCancelToken::new();
        assert!(!token.is_cancelled());
        token.cancel();
        token.cancel();
        assert!(token.is_cancelled());
    }

    #[test]
    fn test_cancel_token_clone_shares_state() {
        let token = NativeCancelToken::new();
        let clone = token.clone();
        clone.cancel();
        assert!(token.is_cancelled());
    }
}
