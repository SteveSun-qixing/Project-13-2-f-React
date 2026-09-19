//! 事件总线：同步广播 + JS 监听器入队语义。
//!
//! 对应《薯片内核设计》第八章与《事件系统设计》第二章：内核总线是唯一事件源
//! 与投递中枢；Rust 监听器在发布线程内同步调用，JS 插件监听器经 `EventSink`
//! 入队后立即返回。快照隔离、深度受限、错误隔离、同一发布者同事件 FIFO。

use std::cell::Cell;
use std::collections::HashMap;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use chips_core::{ContextId, EventName, ForkId};

use crate::constants::MAX_EVENT_DEPTH;
use crate::context::Context;
use crate::error::KernelError;
use crate::kernel::Kernel;

/// 事件载荷：`serde_json::Value`，经 Neon 边界与 TypeScript 侧同构。
pub type EventPayload = serde_json::Value;

/// 事件信封。
#[derive(Debug, Clone, PartialEq)]
pub struct Event {
    /// 事件实例唯一 ID（ULID）。
    pub id: String,
    /// 事件名：`<domain>:<action>`。
    pub name: EventName,
    /// 发布者身份：平台组件 ID 或插件 ID。
    pub source: String,
    /// 发布时刻，Unix 毫秒（UTC）。
    pub timestamp: u64,
    /// 追踪 ID；无追踪上下文时为 `None`。
    pub trace_id: Option<String>,
    /// 载荷。
    pub payload: EventPayload,
}

/// 监听器退订令牌；内核 `off(token)` 的匹配键。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ListenerToken(pub(crate) u64);

/// 订阅选项。
#[derive(Debug, Clone, Copy, Default)]
pub struct ListenerOptions {
    /// 首次投递后自动退订。
    pub once: bool,
    /// 前插到同优先级监听器之前。
    pub prepend: bool,
}

/// JS 插件监听器的入队抽象；由 Neon 适配层实现。
///
/// `emit` 返回表示「全部监听器已调用 / 已入队」，不等待 JS 执行；入队失败
/// （通道关闭、会话销毁）由适配层写审计并返回错误。
pub trait EventSink: Send + Sync + 'static {
    /// 把一个事件副本入队。
    fn enqueue(&self, event: Event) -> Result<(), KernelError>;
}

/// 以闭包实现的 `EventSink`；用于测试与轻量适配。
pub struct FnEventSink<F>(F);

impl<F> FnEventSink<F> {
    /// 包装一个入队函数。
    pub fn new(sink: F) -> Self {
        Self(sink)
    }
}

impl<F> EventSink for FnEventSink<F>
where
    F: Fn(Event) -> Result<(), KernelError> + Send + Sync + 'static,
{
    fn enqueue(&self, event: Event) -> Result<(), KernelError> {
        (self.0)(event)
    }
}

/// Rust 监听器闭包。
pub(crate) type RustListener =
    Arc<dyn Fn(&Context, &EventPayload) -> Result<(), KernelError> + Send + Sync>;

/// 监听器处理函数。
#[derive(Clone)]
pub(crate) enum ListenerHandler {
    /// Rust 监听器：发布线程内同步调用。
    Rust(RustListener),
    /// JS 监听器：入队后立即返回。
    Queued(Arc<dyn EventSink>),
}

impl std::fmt::Debug for ListenerHandler {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Rust(_) => formatter.write_str("ListenerHandler::Rust"),
            Self::Queued(_) => formatter.write_str("ListenerHandler::Queued"),
        }
    }
}

/// 监听器条目。
#[derive(Debug, Clone)]
pub(crate) struct ListenerEntry {
    pub(crate) token: ListenerToken,
    pub(crate) owner: ForkId,
    pub(crate) once: bool,
    pub(crate) alive: Arc<AtomicBool>,
    pub(crate) handler: ListenerHandler,
}

/// 监听表：以事件名分桶，桶以写时复制快照发布。
pub(crate) type ListenerTable = HashMap<EventName, Arc<Vec<ListenerEntry>>>;

/// 监听器已失效时返回 `false`，避免与撤销竞态。
fn mark_dead(entry: &ListenerEntry) -> bool {
    entry.alive.swap(false, Ordering::AcqRel)
}

thread_local! {
    static EVENT_DEPTH: Cell<usize> = const { Cell::new(0) };
}

/// 嵌套派发深度守卫；Drop 时递减，panic 安全。
struct DepthGuard;

impl DepthGuard {
    fn enter(event: &str) -> Result<Self, KernelError> {
        let depth = EVENT_DEPTH.with(|cell| {
            let next = cell.get() + 1;
            cell.set(next);
            next
        });
        if depth > MAX_EVENT_DEPTH {
            EVENT_DEPTH.with(|cell| cell.set(depth - 1));
            return Err(KernelError::EventDepthExceeded {
                event: event.to_owned(),
            });
        }
        Ok(Self)
    }
}

impl Drop for DepthGuard {
    fn drop(&mut self) {
        EVENT_DEPTH.with(|cell| cell.set(cell.get().saturating_sub(1)));
    }
}

impl Context {
    /// 订阅事件；监听器随当前 Fork 自动退订。
    pub fn on<F>(&self, name: &str, handler: F) -> Result<ListenerToken, KernelError>
    where
        F: Fn(&Context, &EventPayload) -> Result<(), KernelError> + Send + Sync + 'static,
    {
        self.on_with_options(name, handler, ListenerOptions::default())
    }

    /// 订阅一次；首次投递后自动退订。
    pub fn once<F>(&self, name: &str, handler: F) -> Result<ListenerToken, KernelError>
    where
        F: Fn(&Context, &EventPayload) -> Result<(), KernelError> + Send + Sync + 'static,
    {
        self.on_with_options(
            name,
            handler,
            ListenerOptions {
                once: true,
                prepend: false,
            },
        )
    }

    /// 带选项订阅。
    pub fn on_with_options<F>(
        &self,
        name: &str,
        handler: F,
        options: ListenerOptions,
    ) -> Result<ListenerToken, KernelError>
    where
        F: Fn(&Context, &EventPayload) -> Result<(), KernelError> + Send + Sync + 'static,
    {
        self.register_listener(name, ListenerHandler::Rust(Arc::new(handler)), options)
    }

    /// 带选项注册入队型监听器（JS 插件监听器经适配层使用）。
    pub fn on_queued(
        &self,
        name: &str,
        sink: Arc<dyn EventSink>,
        options: ListenerOptions,
    ) -> Result<ListenerToken, KernelError> {
        self.register_listener(name, ListenerHandler::Queued(sink), options)
    }

    /// 退订；幂等（等价于内核 `off(token)`）。
    pub fn off(&self, token: ListenerToken) -> Result<(), KernelError> {
        self.kernel.remove_listener(token)
    }

    /// 同步广播事件；无监听器零分配返回。
    ///
    /// 内核在发布入口校验事件名并补全 `id` / `source` / `timestamp`；插件
    /// 不可伪冒 `source`。发布速率计入插件软配额（消息速率）。
    pub fn emit(&self, name: &str, payload: EventPayload) -> Result<(), KernelError> {
        self.kernel.emit_from(self.id, name, payload, true)
    }

    pub(crate) fn register_listener(
        &self,
        name: &str,
        handler: ListenerHandler,
        options: ListenerOptions,
    ) -> Result<ListenerToken, KernelError> {
        self.kernel.add_listener(self.id, name, handler, options)
    }
}

pub(crate) fn dispatch(
    kernel: &Kernel,
    event: &Event,
    from: ContextId,
    listeners: &Arc<Vec<ListenerEntry>>,
) -> Result<(), KernelError> {
    let _guard = DepthGuard::enter(&event.name)?;
    let mut first_error: Option<KernelError> = None;

    for entry in listeners.iter() {
        if !entry.alive.load(Ordering::Acquire) {
            continue;
        }
        if entry.once && !mark_dead(entry) {
            continue;
        }
        if entry.once {
            if let Err(error) = kernel.remove_listener(entry.token) {
                first_error.get_or_insert(error);
            }
        }

        let result = match &entry.handler {
            ListenerHandler::Rust(handler) => {
                let context = kernel.context_handle(from);
                match context {
                    Ok(context) => {
                        catch_unwind(AssertUnwindSafe(|| handler(&context, &event.payload)))
                            .unwrap_or_else(|_| {
                                Err(KernelError::PluginPanicked {
                                    id: kernel.plugin_of_fork(entry.owner).unwrap_or_else(|| {
                                        crate::constants::KERNEL_SOURCE.to_owned()
                                    }),
                                })
                            })
                    }
                    Err(error) => Err(error),
                }
            }
            ListenerHandler::Queued(sink) => sink.enqueue(event.clone()),
        };

        if let Err(error) = result {
            first_error.get_or_insert(error);
        }
    }

    first_error.map_or(Ok(()), Err)
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    #[test]
    fn test_fn_event_sink_forwards() {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let captured = Arc::clone(&seen);
        let sink = FnEventSink::new(move |event: Event| {
            captured
                .lock()
                .map_err(|_| KernelError::LockPoisoned)?
                .push(event.name);
            Ok(())
        });
        let event = Event {
            id: "01H".into(),
            name: "document:changed".into(),
            source: "chips.kernel".into(),
            timestamp: 1,
            trace_id: None,
            payload: serde_json::json!({ "uri": "a.card" }),
        };
        sink.enqueue(event).expect("入队应成功");
        assert_eq!(
            seen.lock().expect("锁可用").as_slice(),
            ["document:changed"]
        );
    }

    #[test]
    fn test_listener_options_default_is_regular() {
        let options = ListenerOptions::default();
        assert!(!options.once);
        assert!(!options.prepend);
    }

    #[test]
    fn test_listener_handler_debug_labels_variant_only() {
        // 监听器体是闭包 / JS 通道句柄，诊断输出只区分实现形态（§8.1）。
        struct NullSink;
        impl EventSink for NullSink {
            fn enqueue(&self, _event: Event) -> Result<(), KernelError> {
                Ok(())
            }
        }

        let rust = ListenerHandler::Rust(Arc::new(|_context: &Context, _payload| Ok(())));
        assert_eq!(format!("{rust:?}"), "ListenerHandler::Rust");
        let queued = ListenerHandler::Queued(Arc::new(NullSink));
        assert_eq!(format!("{queued:?}"), "ListenerHandler::Queued");
    }

    #[tokio::test]
    async fn test_off_unknown_token_is_idempotent_noop() {
        // §8.4：退订幂等；未知令牌不得影响其它事件桶上的监听器。
        use std::sync::atomic::{AtomicUsize, Ordering};

        let kernel = Kernel::new(tokio::runtime::Handle::current()).expect("内核应可创建");
        let root = kernel.root_context();
        let hits = Arc::new(AtomicUsize::new(0));
        let first = Arc::clone(&hits);
        let _a = root
            .on("document:first", move |_context, _payload| {
                first.fetch_add(1, Ordering::SeqCst);
                Ok(())
            })
            .expect("订阅应成功");
        let second = Arc::clone(&hits);
        let _b = root
            .on("config:second", move |_context, _payload| {
                second.fetch_add(1, Ordering::SeqCst);
                Ok(())
            })
            .expect("订阅应成功");

        root.off(ListenerToken(u64::MAX))
            .expect("未知令牌退订应为空操作");
        root.emit("document:first", serde_json::Value::Null)
            .expect("发布应成功");
        root.emit("config:second", serde_json::Value::Null)
            .expect("发布应成功");
        assert_eq!(hits.load(Ordering::SeqCst), 2, "两个监听器都应收到投递");
    }
}
