//! Fork：副作用追踪与可逆撤销单元。
//!
//! 对应《薯片内核设计》第四章：每个 Context 持有一个作用域 Fork，每次插件
//! 加载创建一个插件 Fork，每次注入创建一个注入 Fork。`dispose` 顺序固定为
//! 「子 Fork 后序 + 自身副作用 LIFO」。

use chips_core::{ContextId, EventName, ForkId, ServiceName};

use crate::error::KernelError;
use crate::event::ListenerToken;
use crate::task::TaskAbortHandle;

/// Fork 状态。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ForkState {
    /// 可登记副作用。
    Active,
    /// 正在撤销，拒绝新登记。
    Disposing,
    /// 已撤销。
    Disposed,
}

/// 可撤销副作用的通用载体。
pub enum Effect {
    /// 自定义清理闭包。
    Custom(Box<dyn FnOnce() + Send + Sync>),
    /// 服务注册；撤销时按代际匹配。
    Service {
        /// 服务名。
        name: ServiceName,
        /// 发布代际。
        generation: u64,
    },
    /// 事件监听器。
    Listener {
        /// 事件名。
        name: EventName,
        /// 退订令牌。
        token: ListenerToken,
    },
    /// 后台任务；撤销时触发取消并等待退出。
    Task {
        /// 任务中止句柄。
        abort: TaskAbortHandle,
    },
}

impl std::fmt::Debug for Effect {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Custom(_) => formatter.write_str("Effect::Custom"),
            Self::Service { name, generation } => formatter
                .debug_struct("Effect::Service")
                .field("name", name)
                .field("generation", generation)
                .finish(),
            Self::Listener { name, token } => formatter
                .debug_struct("Effect::Listener")
                .field("name", name)
                .field("token", token)
                .finish(),
            Self::Task { abort } => formatter
                .debug_struct("Effect::Task")
                .field("name", &abort.name())
                .finish(),
        }
    }
}

/// Fork 节点；以 ID 挂载在 `ForkRegistry` 中。
#[derive(Debug)]
pub struct Fork {
    /// Fork ID。
    pub id: ForkId,
    /// 所属 Context。
    pub context: ContextId,
    /// 父 Fork；根 Fork 为 `None`。
    pub parent: Option<ForkId>,
    /// 子 Fork，按创建顺序排列。
    pub children: Vec<ForkId>,
    /// 登记的副作用，按登记顺序排列。
    effects: Vec<Effect>,
    /// 状态。
    state: ForkState,
}

impl Fork {
    pub(crate) fn new(id: ForkId, context: ContextId, parent: Option<ForkId>) -> Self {
        Self {
            id,
            context,
            parent,
            children: Vec::new(),
            effects: Vec::new(),
            state: ForkState::Active,
        }
    }

    /// 当前状态。
    #[must_use]
    pub fn state(&self) -> ForkState {
        self.state
    }

    /// 登记一条副作用；`Disposing` / `Disposed` 状态拒绝登记。
    ///
    /// 内核内建能力（服务、监听器、任务）必须走各自登记入口，不允许绕过追踪。
    pub(crate) fn push_effect(&mut self, effect: Effect) -> Result<(), KernelError> {
        if self.state != ForkState::Active {
            return Err(KernelError::ContextDisposed { id: self.context });
        }
        self.effects.push(effect);
        Ok(())
    }

    /// 副作用登记数量（诊断用）。
    #[must_use]
    pub fn effect_count(&self) -> usize {
        self.effects.len()
    }

    /// 取出全部副作用供撤销；状态置 `Disposing`。
    ///
    /// 由内核的撤销编排调用；撤销流程结束后由编排侧置 `Disposed`。
    pub(crate) fn begin_dispose(&mut self) -> Option<DisposalBatch> {
        match self.state {
            ForkState::Disposed | ForkState::Disposing => None,
            ForkState::Active => {
                self.state = ForkState::Disposing;
                Some(DisposalBatch {
                    children: std::mem::take(&mut self.children),
                    effects: std::mem::take(&mut self.effects),
                })
            }
        }
    }

    /// 标记撤销完成。
    pub(crate) fn finish_dispose(&mut self) {
        self.state = ForkState::Disposed;
    }
}

/// 一次撤销的副作用的快照。
#[derive(Debug)]
pub(crate) struct DisposalBatch {
    /// 子 Fork（按创建顺序）。
    pub(crate) children: Vec<ForkId>,
    /// 自身副作用（按登记顺序）。
    pub(crate) effects: Vec<Effect>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fork_push_effect_after_disposing_is_rejected() {
        let mut fork = Fork::new(1, 7, None);
        let batch = fork.begin_dispose().expect("首次撤销应有批次");
        assert_eq!(fork.state(), ForkState::Disposing);
        assert!(batch.children.is_empty());
        let error = fork
            .push_effect(Effect::Service {
                name: "file".into(),
                generation: 1,
            })
            .expect_err("Disposing 状态应拒绝登记");
        assert_eq!(error.code(), "KERNEL_CONTEXT_DISPOSED");
        fork.finish_dispose();
        assert_eq!(fork.state(), ForkState::Disposed);
        assert!(fork.begin_dispose().is_none());
    }

    #[test]
    fn test_fork_effect_order_is_registration_order() {
        let mut fork = Fork::new(1, 7, None);
        for generation in 1..=3 {
            fork.push_effect(Effect::Service {
                name: "file".into(),
                generation,
            })
            .expect("Active 状态应可登记");
        }
        assert_eq!(fork.effect_count(), 3);
        let batch = fork.begin_dispose().expect("撤销批次");
        assert_eq!(batch.effects.len(), 3);
        assert!(
            fork.begin_dispose().is_none(),
            "Disposing 期间重复撤销应为空操作"
        );
    }

    #[test]
    fn test_effect_debug_hides_closures_and_shows_identity() {
        // 审计与诊断日志按 §4.1 打印副作用身份，闭包体不进入输出。
        let custom = Effect::Custom(Box::new(|| {}));
        assert_eq!(format!("{custom:?}"), "Effect::Custom");

        let service = Effect::Service {
            name: "file".to_owned(),
            generation: 7,
        };
        let text = format!("{service:?}");
        assert!(
            text.contains("Effect::Service") && text.contains("\"file\"") && text.contains("7"),
            "服务副作用需暴露服务名与代际：{text}"
        );

        let listener = Effect::Listener {
            name: "document:changed".to_owned(),
            token: crate::event::ListenerToken(3),
        };
        let text = format!("{listener:?}");
        assert!(
            text.contains("Effect::Listener")
                && text.contains("document:changed")
                && text.contains("3"),
            "监听器副作用需暴露事件名与退订令牌：{text}"
        );
    }
}
