//! 内核错误模型与错误码。
//!
//! 与《薯片内核设计》§9.1 一致；名称校验失败使用 `KERNEL_INVALID_NAME`
//! （见开发计划 D11：内核文档错误枚举尚未覆盖服务名 / 事件名校验失败）。

use chips_core::{ContextId, EventName, PluginId, ServiceName};
use thiserror::Error;

use crate::plugin::PluginState;

/// 生命周期阶段；用于超时诊断（《薯片内核设计》§6.7）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LifecyclePhase {
    /// `PluginRunner::apply` 阶段。
    Apply,
    /// `PluginRunner::stop` 阶段。
    Stop,
}

/// 软配额类别（《薯片内核设计》§6.9）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QuotaKind {
    /// 内存。
    Memory,
    /// 活跃任务数。
    Tasks,
    /// 消息速率。
    MessageRate,
    /// 后台时长。
    BackgroundTime,
}

/// 名称类别；用于 `KERNEL_INVALID_NAME` 诊断。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NameKind {
    /// 服务名（`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`）。
    Service,
    /// 事件名（`^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$`）。
    Event,
    /// 事件域与发布者身份不匹配或占用保留域。
    EventDomain,
    /// 插件角色字符串非法。
    PluginRole,
}

/// 内核错误：覆盖加载、依赖、服务、撤销与并发路径。
///
/// 全部字段可比较，`PartialEq` 供测试、审计与幂等判定使用；跨语言边界的
/// 形状仍是 `ChipsError`，不随本实现细节变化。
#[derive(Debug, Clone, PartialEq, Error)]
pub enum KernelError {
    /// 插件不存在。
    #[error("插件不存在：{id}")]
    PluginNotFound {
        /// 插件 ID。
        id: PluginId,
    },

    /// 插件状态迁移非法。
    #[error("插件状态迁移非法：{id}：{from:?} → {to:?}")]
    InvalidTransition {
        /// 插件 ID。
        id: PluginId,
        /// 起始状态。
        from: PluginState,
        /// 目标状态。
        to: PluginState,
    },

    /// 缺少依赖。
    #[error("缺少依赖：{dependent} 依赖 {missing}")]
    DependencyMissing {
        /// 依赖方插件 ID。
        dependent: PluginId,
        /// 缺失的插件 ID。
        missing: PluginId,
    },

    /// 依赖出现环。
    #[error("依赖出现环：{}", path.join(" -> "))]
    DependencyCycle {
        /// 环路径。
        path: Vec<PluginId>,
    },

    /// 依赖版本不满足。
    #[error("依赖版本不满足：{dependency} 需要 {required}，实际 {actual}")]
    DependencyVersion {
        /// 被依赖的插件 ID。
        dependency: PluginId,
        /// 声明的版本范围。
        required: String,
        /// 实际版本。
        actual: String,
        /// 可用候选版本；范围互斥时用于诊断。
        candidates: Vec<String>,
    },

    /// 依赖重复声明。
    #[error("依赖重复声明：{dependent} 重复依赖 {dependency}")]
    DependencyDuplicate {
        /// 依赖方插件 ID。
        dependent: PluginId,
        /// 被重复声明的插件 ID。
        dependency: PluginId,
    },

    /// 依赖冲突：仍被依赖。
    #[error("依赖冲突：{plugin} 仍被依赖：[{}]", dependents.join(", "))]
    DependencyConflict {
        /// 被依赖的插件 ID。
        plugin: PluginId,
        /// 依赖者列表。
        dependents: Vec<PluginId>,
    },

    /// 服务不存在。
    #[error("服务不存在：{name}")]
    ServiceNotFound {
        /// 服务名。
        name: ServiceName,
    },

    /// 服务类型不匹配。
    #[error("服务类型不匹配：{name}")]
    ServiceTypeMismatch {
        /// 服务名。
        name: ServiceName,
    },

    /// 注入回调失败。
    #[error("注入回调失败：{dependent}")]
    InjectFailed {
        /// 依赖方插件 ID。
        dependent: PluginId,
    },

    /// 插件应用失败。
    #[error("插件应用失败：{id}")]
    ApplyFailed {
        /// 插件 ID。
        id: PluginId,
    },

    /// 生命周期超时。
    #[error("生命周期超时：{id}（阶段 {phase:?}）")]
    LifecycleTimeout {
        /// 插件 ID。
        id: PluginId,
        /// 超时阶段。
        phase: LifecyclePhase,
    },

    /// 级联重建深度超限。
    #[error("级联重建深度超限：{root}")]
    RebuildOverflow {
        /// 触发重建的服务名。
        root: ServiceName,
    },

    /// 插件超出软配额。
    #[error("插件超出软配额：{id}（{quota:?}）")]
    QuotaExceeded {
        /// 插件 ID。
        id: PluginId,
        /// 配额类别。
        quota: QuotaKind,
    },

    /// 副作用撤销失败。
    #[error("副作用撤销失败：{reason}")]
    DisposeFailed {
        /// 失败原因。
        reason: String,
    },

    /// 插件任务 panic。
    #[error("插件任务 panic：{id}")]
    PluginPanicked {
        /// 插件 ID。
        id: PluginId,
    },

    /// Context 已销毁。
    #[error("Context 已销毁：{id}")]
    ContextDisposed {
        /// Context ID。
        id: ContextId,
    },

    /// 内核状态锁不可用。
    #[error("内核状态锁不可用")]
    LockPoisoned,

    /// 事件派发深度超限。
    #[error("事件派发深度超限：{event}")]
    EventDepthExceeded {
        /// 事件名。
        event: EventName,
    },

    /// 名称非法。
    #[error("名称非法：{kind:?} {name}")]
    InvalidName {
        /// 名称类别。
        kind: NameKind,
        /// 非法名称。
        name: String,
    },
}

impl KernelError {
    /// 错误码，遵循 `<DOMAIN>_<REASON>` 规范。
    #[must_use]
    pub fn code(&self) -> &'static str {
        match self {
            Self::PluginNotFound { .. } => "KERNEL_PLUGIN_NOT_FOUND",
            Self::InvalidTransition { .. } => "KERNEL_INVALID_TRANSITION",
            Self::DependencyMissing { .. } => "KERNEL_DEPENDENCY_MISSING",
            Self::DependencyCycle { .. } => "KERNEL_DEPENDENCY_CYCLE",
            Self::DependencyVersion { .. } => "KERNEL_DEPENDENCY_VERSION",
            Self::DependencyDuplicate { .. } => "KERNEL_DEPENDENCY_DUPLICATE",
            Self::DependencyConflict { .. } => "KERNEL_DEPENDENCY_CONFLICT",
            Self::ServiceNotFound { .. } => "KERNEL_SERVICE_NOT_FOUND",
            Self::ServiceTypeMismatch { .. } => "KERNEL_SERVICE_TYPE_MISMATCH",
            Self::InjectFailed { .. } => "KERNEL_INJECT_FAILED",
            Self::ApplyFailed { .. } => "KERNEL_APPLY_FAILED",
            Self::LifecycleTimeout { .. } => "KERNEL_LIFECYCLE_TIMEOUT",
            Self::RebuildOverflow { .. } => "KERNEL_REBUILD_OVERFLOW",
            Self::QuotaExceeded { .. } => "KERNEL_QUOTA_EXCEEDED",
            Self::DisposeFailed { .. } => "KERNEL_DISPOSE_FAILED",
            Self::PluginPanicked { .. } => "KERNEL_PLUGIN_PANICKED",
            Self::ContextDisposed { .. } => "KERNEL_CONTEXT_DISPOSED",
            Self::LockPoisoned => "KERNEL_LOCK_POISONED",
            Self::EventDepthExceeded { .. } => "KERNEL_EVENT_DEPTH_EXCEEDED",
            Self::InvalidName { .. } => "KERNEL_INVALID_NAME",
        }
    }

    /// 是否可重试：可重试表示重新加载或重新启用可能成功。
    ///
    /// `KERNEL_LOCK_POISONED` 表示内核不变量已被破坏，调用方重试无法恢复，
    /// 固定为 `false`，需重启平台。
    #[must_use]
    pub fn retryable(&self) -> bool {
        matches!(
            self,
            Self::ApplyFailed { .. } | Self::InjectFailed { .. } | Self::PluginPanicked { .. }
        )
    }
}

/// 把内核错误归一为跨边界错误 `ChipsError`。
impl From<KernelError> for chips_core::ChipsError {
    fn from(error: KernelError) -> Self {
        let details = error_details(&error);
        let mut normalized = chips_core::ChipsError::new(error.code(), error.to_string())
            .with_retryable(error.retryable());
        if let Some(details) = details {
            normalized = normalized.with_details(details);
        }
        normalized
    }
}

fn error_details(error: &KernelError) -> Option<serde_json::Value> {
    match error {
        KernelError::DependencyMissing { dependent, missing } => Some(serde_json::json!({
            "dependent": dependent,
            "missing": missing,
        })),
        KernelError::DependencyCycle { path } => Some(serde_json::json!({ "path": path })),
        KernelError::DependencyVersion {
            dependency,
            required,
            actual,
            candidates,
        } => Some(serde_json::json!({
            "dependency": dependency,
            "required": required,
            "actual": actual,
            "candidates": candidates,
        })),
        KernelError::DependencyConflict { plugin, dependents } => Some(serde_json::json!({
            "plugin": plugin,
            "dependents": dependents,
        })),
        KernelError::LifecycleTimeout { id, phase } => Some(serde_json::json!({
            "pluginId": id,
            "phase": format!("{phase:?}"),
        })),
        KernelError::QuotaExceeded { id, quota } => Some(serde_json::json!({
            "pluginId": id,
            "quota": format!("{quota:?}"),
        })),
        KernelError::InvalidName { kind, name } => Some(serde_json::json!({
            "kind": format!("{kind:?}"),
            "name": name,
        })),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes() {
        let cases = vec![
            (
                KernelError::PluginNotFound {
                    id: "chips.test".into(),
                },
                "KERNEL_PLUGIN_NOT_FOUND",
            ),
            (
                KernelError::DependencyMissing {
                    dependent: "a".into(),
                    missing: "b".into(),
                },
                "KERNEL_DEPENDENCY_MISSING",
            ),
            (
                KernelError::LifecycleTimeout {
                    id: "a".into(),
                    phase: LifecyclePhase::Apply,
                },
                "KERNEL_LIFECYCLE_TIMEOUT",
            ),
            (
                KernelError::QuotaExceeded {
                    id: "a".into(),
                    quota: QuotaKind::Tasks,
                },
                "KERNEL_QUOTA_EXCEEDED",
            ),
            (KernelError::LockPoisoned, "KERNEL_LOCK_POISONED"),
            (
                KernelError::InvalidName {
                    kind: NameKind::Service,
                    name: "Bad".into(),
                },
                "KERNEL_INVALID_NAME",
            ),
        ];
        for (error, expected) in cases {
            assert_eq!(error.code(), expected);
        }
    }

    #[test]
    fn test_retryable_flags() {
        assert!(KernelError::ApplyFailed { id: "a".into() }.retryable());
        assert!(KernelError::InjectFailed {
            dependent: "a".into()
        }
        .retryable());
        assert!(KernelError::PluginPanicked { id: "a".into() }.retryable());
        assert!(!KernelError::LockPoisoned.retryable());
        assert!(!KernelError::ServiceNotFound {
            name: "file".into()
        }
        .retryable());
    }

    #[test]
    fn test_normalize_to_chips_error() {
        let normalized = chips_core::ChipsError::from(KernelError::DependencyMissing {
            dependent: "chips.a".into(),
            missing: "chips.b".into(),
        });
        assert_eq!(normalized.code(), "KERNEL_DEPENDENCY_MISSING");
        assert_eq!(
            normalized.details().map(|value| value["missing"].clone()),
            Some(serde_json::json!("chips.b"))
        );
        assert!(!normalized.retryable());
    }

    #[test]
    fn test_every_variant_has_distinct_code() {
        // §9.1：全部变体都要有唯一 `<DOMAIN>_<REASON>` 码，供跨边界审计匹配。
        let cases: Vec<(KernelError, &str)> = vec![
            (
                KernelError::InvalidTransition {
                    id: "a".into(),
                    from: PluginState::Installed,
                    to: PluginState::Active,
                },
                "KERNEL_INVALID_TRANSITION",
            ),
            (
                KernelError::DependencyCycle {
                    path: vec!["a".into(), "b".into(), "a".into()],
                },
                "KERNEL_DEPENDENCY_CYCLE",
            ),
            (
                KernelError::DependencyVersion {
                    dependency: "a".into(),
                    required: "^2.0.0".into(),
                    actual: "1.0.0".into(),
                    candidates: vec!["2.0.0".into()],
                },
                "KERNEL_DEPENDENCY_VERSION",
            ),
            (
                KernelError::DependencyDuplicate {
                    dependent: "a".into(),
                    dependency: "b".into(),
                },
                "KERNEL_DEPENDENCY_DUPLICATE",
            ),
            (
                KernelError::DependencyConflict {
                    plugin: "a".into(),
                    dependents: vec!["b".into()],
                },
                "KERNEL_DEPENDENCY_CONFLICT",
            ),
            (
                KernelError::ServiceNotFound { name: "file".into() },
                "KERNEL_SERVICE_NOT_FOUND",
            ),
            (
                KernelError::ServiceTypeMismatch { name: "file".into() },
                "KERNEL_SERVICE_TYPE_MISMATCH",
            ),
            (
                KernelError::InjectFailed {
                    dependent: "a".into(),
                },
                "KERNEL_INJECT_FAILED",
            ),
            (
                KernelError::RebuildOverflow { root: "file".into() },
                "KERNEL_REBUILD_OVERFLOW",
            ),
            (
                KernelError::DisposeFailed {
                    reason: "清理闭包 panic".into(),
                },
                "KERNEL_DISPOSE_FAILED",
            ),
            (
                KernelError::PluginPanicked { id: "a".into() },
                "KERNEL_PLUGIN_PANICKED",
            ),
            (
                KernelError::ContextDisposed { id: 7 },
                "KERNEL_CONTEXT_DISPOSED",
            ),
            (
                KernelError::EventDepthExceeded {
                    event: "editor:queued".into(),
                },
                "KERNEL_EVENT_DEPTH_EXCEEDED",
            ),
        ];
        let mut codes = std::collections::BTreeSet::new();
        for (error, expected) in cases {
            assert_eq!(error.code(), expected, "{} 的错误码不符", error);
            assert!(
                codes.insert(expected),
                "错误码 {expected} 重复，审计无法区分"
            );
        }
    }

    #[test]
    fn test_normalized_details_follow_section_9_2() {
        // §9.2：依赖冲突、配额、名称非法必须携带定位字段。
        let conflict = chips_core::ChipsError::from(KernelError::DependencyConflict {
            plugin: "chips.a".into(),
            dependents: vec!["chips.b".into(), "chips.c".into()],
        });
        let details = conflict
            .details()
            .cloned()
            .expect("依赖冲突应携带诊断字段");
        assert_eq!(details["plugin"], serde_json::json!("chips.a"));
        assert_eq!(
            details["dependents"],
            serde_json::json!(["chips.b", "chips.c"])
        );

        for (quota, label) in [
            (QuotaKind::Memory, "Memory"),
            (QuotaKind::Tasks, "Tasks"),
            (QuotaKind::MessageRate, "MessageRate"),
            (QuotaKind::BackgroundTime, "BackgroundTime"),
        ] {
            let normalized = chips_core::ChipsError::from(KernelError::QuotaExceeded {
                id: "chips.a".into(),
                quota,
            });
            let details = normalized.details().cloned().expect("配额错误应携带诊断字段");
            assert_eq!(details["pluginId"], serde_json::json!("chips.a"));
            assert_eq!(details["quota"], serde_json::json!(label));
            assert!(!normalized.retryable(), "软配额超限不由重试解决");
        }

        for kind in [
            NameKind::Service,
            NameKind::Event,
            NameKind::EventDomain,
            NameKind::PluginRole,
        ] {
            let normalized = chips_core::ChipsError::from(KernelError::InvalidName {
                kind,
                name: "Bad_Name".into(),
            });
            let details = normalized.details().cloned().expect("名称非法应携带诊断字段");
            assert_eq!(details["kind"], serde_json::json!(format!("{kind:?}")));
            assert_eq!(details["name"], serde_json::json!("Bad_Name"));
        }

        let timeout = chips_core::ChipsError::from(KernelError::LifecycleTimeout {
            id: "chips.a".into(),
            phase: LifecyclePhase::Stop,
        });
        let details = timeout.details().cloned().expect("超时应携带阶段诊断");
        assert_eq!(details["pluginId"], serde_json::json!("chips.a"));
        assert_eq!(details["phase"], serde_json::json!("Stop"));

        // 无定位字段的变体不得伪造 details 键。
        let plain = chips_core::ChipsError::from(KernelError::DisposeFailed {
            reason: "清理闭包 panic".into(),
        });
        assert_eq!(plain.details(), None);
        assert_eq!(plain.message(), "副作用撤销失败：清理闭包 panic");
        assert_eq!(plain.code(), "KERNEL_DISPOSE_FAILED");

        let panicked = chips_core::ChipsError::from(KernelError::PluginPanicked {
            id: "chips.a".into(),
        });
        assert!(panicked.retryable(), "§9.1：panic 属可重试类");
    }
}
