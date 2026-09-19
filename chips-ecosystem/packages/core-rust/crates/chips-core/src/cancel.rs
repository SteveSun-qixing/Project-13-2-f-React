//! 协作式取消令牌。

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tokio::sync::Notify;

/// 协作式取消令牌；克隆共享同一状态。
///
/// 语义与《核心接口规范》§3.2 一致：一次触发、永久生效；解析器与 Bridge
/// 调用共用该类型。持有令牌的任务必须在检查点响应取消并释放已占用资源。
#[derive(Debug, Clone, Default)]
pub struct CancelToken {
    inner: Arc<CancelState>,
}

#[derive(Debug, Default)]
struct CancelState {
    cancelled: AtomicBool,
    notify: Notify,
}

impl CancelToken {
    /// 创建未取消的令牌。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// 触发取消；幂等；可从任意线程调用。
    pub fn cancel(&self) {
        self.inner.cancelled.store(true, Ordering::Release);
        self.inner.notify.notify_waiters();
    }

    /// 是否已取消；可从任意线程调用。
    #[must_use]
    pub fn is_cancelled(&self) -> bool {
        self.inner.cancelled.load(Ordering::Acquire)
    }

    /// 等待取消；已取消时立即返回。
    ///
    /// 先注册通知再检查标记，避免取消发生在检查与等待之间时丢失唤醒。
    pub async fn cancelled(&self) {
        loop {
            let notified = self.inner.notify.notified();
            if self.is_cancelled() {
                return;
            }
            notified.await;
            if self.is_cancelled() {
                return;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;

    #[test]
    fn test_cancel_token_starts_uncancelled() {
        let token = CancelToken::new();
        assert!(!token.is_cancelled());
    }

    #[test]
    fn test_cancel_token_cancel_is_idempotent() {
        let token = CancelToken::new();
        token.cancel();
        token.cancel();
        assert!(token.is_cancelled());
    }

    #[test]
    fn test_cancel_token_clone_shares_state() {
        let token = CancelToken::new();
        let clone = token.clone();
        clone.cancel();
        assert!(token.is_cancelled());
    }

    #[tokio::test]
    async fn test_cancel_token_cancelled_returns_immediately_when_cancelled() {
        let token = CancelToken::new();
        token.cancel();
        tokio::time::timeout(Duration::from_millis(50), token.cancelled())
            .await
            .expect("已取消的令牌应立即返回");
    }

    #[tokio::test]
    async fn test_cancel_token_cancelled_wakes_on_cancel() {
        let token = CancelToken::new();
        let cloned = token.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(10)).await;
            cloned.cancel();
        });
        tokio::time::timeout(Duration::from_secs(1), token.cancelled())
            .await
            .expect("取消后等待应被唤醒");
    }
}
