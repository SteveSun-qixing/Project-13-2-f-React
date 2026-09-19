//! 薯片平台 Cordis 运行时（Rust 实现）。
//!
//! 内核职责见《薯片内核设计》§1.1：Context 树与作用域、Fork 与可逆副作用、
//! 服务注册与级联重建、插件状态机与依赖解析、事件总线、错误隔离与并发调度。
//! 内核不感知插件角色；Bridge / 插件管理 / 资源管理等子系统在此之上分层。
//!
//! 线程模型：全部可变状态由命令循环与短时状态锁串行写入；服务表、监听表与
//! Context 树以 `Arc` 快照发布，读路径一次读锁后无锁访问。

#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod command;
pub mod constants;
pub mod context;
pub mod error;
pub mod event;
pub mod fork;
mod kernel;
mod name;
pub mod plugin;
mod service;
mod task;
mod ulid;

pub use constants::{
    CRASH_RESTART_BACKOFF_INITIAL, CRASH_RESTART_BACKOFF_MAX, CRASH_RESTART_MAX_ATTEMPTS,
    CRASH_RESTART_WINDOW, FORK_FORCE_DISPOSE_TIMEOUT, KERNEL_SOURCE, LIFECYCLE_APPLY_TIMEOUT,
    LIFECYCLE_STOP_TIMEOUT, MAX_EVENT_DEPTH, MAX_REBUILD_DEPTH, PLUGIN_BACKGROUND_TIME_QUOTA,
    PLUGIN_MEMORY_QUOTA_BYTES, PLUGIN_MEMORY_SAMPLE_INTERVAL, PLUGIN_MESSAGE_RATE_PER_SECOND,
    PLUGIN_MESSAGE_RATE_WINDOW, PLUGIN_TASK_QUOTA,
};
pub use context::{Context, ContextNode, ContextState};
pub use error::{KernelError, LifecyclePhase, NameKind, QuotaKind};
pub use event::{Event, EventPayload, EventSink, FnEventSink, ListenerOptions, ListenerToken};
pub use fork::{Effect, Fork, ForkState};
pub use kernel::{Kernel, KernelOptions};
pub use plugin::{
    resolve_order, ConfigProvider, DependencyGraph, DependencySpec, EmptyConfigProvider,
    LoadRequest, PluginConfig, PluginNode, PluginRole, PluginRunner, PluginState,
};
pub use service::{ServiceEntry, ServiceTable};
pub use task::{TaskAbortHandle, TaskHandle, TaskOptions, TaskSignal};

pub use chips_core::{
    ContextId, EventName, ForkId, InjectionId, PluginId, ServiceName, ServiceValue,
};
