//! `Root` 持有的 JS 回调包装（服务值见 [`JsServiceValue`]）。

use std::sync::Arc;

use chips_cordis::Context as KernelContext;
use neon::prelude::*;

use crate::convert::ConvertIssue;

/// 内核 `Context` 的 JS 句柄载体；对 JS 不透明、无字段、不可序列化。
pub struct NativeContextHandle(pub KernelContext);

impl Finalize for NativeContextHandle {}

/// JS 服务值：普通对象或函数；以 `Root` 持有并在 JS 线程释放。
pub struct JsServiceValue {
    kind: Option<JsServiceValueKind>,
    channel: Option<Channel>,
}

enum JsServiceValueKind {
    Object(Root<JsObject>),
    Function(Root<JsFunction>),
}

impl JsServiceValue {
    /// 从 JS 值构造：接受普通对象与函数；数组、类实例、原始值拒绝。
    pub fn from_js<'a, C: Context<'a>>(
        cx: &mut C,
        value: &Handle<'a, JsValue>,
    ) -> Result<Self, ConvertIssue> {
        if value.is_a::<JsFunction, _>(cx) {
            let function =
                value
                    .downcast::<JsFunction, _>(cx)
                    .map_err(|_| ConvertIssue::TypeUnsupported {
                        pointer: String::new(),
                        detail: "服务值读取失败",
                    })?;
            return Ok(Self {
                kind: Some(JsServiceValueKind::Function(Root::new(cx, &function))),
                channel: Some(Channel::new(cx)),
            });
        }
        if value.is_a::<JsArray, _>(cx) {
            return Err(ConvertIssue::TypeUnsupported {
                pointer: String::new(),
                detail: "服务值必须是对象或函数，不能是数组",
            });
        }
        if value.is_a::<JsObject, _>(cx) {
            let object =
                value
                    .downcast::<JsObject, _>(cx)
                    .map_err(|_| ConvertIssue::TypeUnsupported {
                        pointer: String::new(),
                        detail: "服务值读取失败",
                    })?;
            return Ok(Self {
                kind: Some(JsServiceValueKind::Object(Root::new(cx, &object))),
                channel: Some(Channel::new(cx)),
            });
        }
        Err(ConvertIssue::TypeUnsupported {
            pointer: String::new(),
            detail: "服务值必须是对象或函数",
        })
    }

    /// 取回 JS 值；只能在创建它的 JS 线程调用。
    pub fn to_js<'a, C: Context<'a>>(&self, cx: &mut C) -> Option<Handle<'a, JsValue>> {
        match self.kind.as_ref()? {
            JsServiceValueKind::Object(root) => Some(root.clone(cx).into_inner(cx).upcast()),
            JsServiceValueKind::Function(root) => Some(root.clone(cx).into_inner(cx).upcast()),
        }
    }

    /// 服务值形态（诊断用）：`"object"` 或 `"function"`。
    #[must_use]
    #[allow(dead_code)] // 诊断接口：服务查找审计与宿主排查使用。
    pub fn kind(&self) -> &'static str {
        match self.kind {
            Some(JsServiceValueKind::Object(_)) => "object",
            Some(JsServiceValueKind::Function(_)) => "function",
            None => "released",
        }
    }
}

impl Drop for JsServiceValue {
    fn drop(&mut self) {
        let (Some(kind), Some(channel)) = (self.kind.take(), self.channel.take()) else {
            return;
        };
        // 释放回投 JS 线程；通道已关闭时按 Neon 的 GC 兜底路径掉落。
        let _ = channel.try_send(move |_cx| {
            drop(kind);
            Ok(())
        });
    }
}

/// 跨线程持有的 JS 回调（注入回调、事件监听器、清理闭包）。
///
/// 调用一律经 `Channel` 回投 JS 线程；投递失败（通道关闭）静默丢弃，
/// 由会话/插件生命周期审计兜底。回调抛出的异常不改变内核状态。
pub struct JsCallback {
    root: Option<Root<JsFunction>>,
    channel: Channel,
}

impl JsCallback {
    /// 在 JS 线程创建回调载体。
    pub fn new<'a, C: Context<'a>>(cx: &mut C, function: &Handle<'a, JsFunction>) -> Self {
        Self {
            root: Some(Root::new(cx, function)),
            channel: Channel::new(cx),
        }
    }

    /// 投递不带参数的调用（清理闭包）。
    pub fn dispatch_empty(self: &Arc<Self>) {
        let callback = Arc::clone(self);
        let _ = self.channel.try_send(move |mut cx| {
            if let Some(root) = callback.root.as_ref() {
                let function = root.clone(&mut cx).into_inner(&mut cx);
                let undefined = cx.undefined();
                // 插件回调异常由 JS 运行时记录；不向外传播。
                let _ = function.call(&mut cx, undefined, []);
            }
            Ok(())
        });
    }

    /// 投递 JSON 载荷（事件监听器只接收 payload）。
    pub fn dispatch_json(self: &Arc<Self>, payload: serde_json::Value) {
        let callback = Arc::clone(self);
        let _ = self.channel.try_send(move |mut cx| {
            if let Some(root) = callback.root.as_ref() {
                let function = root.clone(&mut cx).into_inner(&mut cx);
                if let Ok(payload) = crate::convert::json_to_js(&mut cx, &payload, "") {
                    let undefined = cx.undefined();
                    let _ = function.call(&mut cx, undefined, [payload]);
                }
            }
            Ok(())
        });
    }

    /// 投递 Context 句柄（注入回调参数）。
    pub fn dispatch_context(self: &Arc<Self>, context: KernelContext) {
        let callback = Arc::clone(self);
        let _ = self.channel.try_send(move |mut cx| {
            if let Some(root) = callback.root.as_ref() {
                let function = root.clone(&mut cx).into_inner(&mut cx);
                let handle = cx.boxed(NativeContextHandle(context));
                let undefined = cx.undefined();
                let _ = function.call(&mut cx, undefined, [handle.upcast()]);
            }
            Ok(())
        });
    }
}

impl Drop for JsCallback {
    fn drop(&mut self) {
        let Some(root) = self.root.take() else {
            return;
        };
        let _ = self.channel.try_send(move |_cx| {
            drop(root);
            Ok(())
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_native_context_handle_wraps_clone() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .expect("测试运行时");
        let kernel = chips_cordis::Kernel::new(runtime.handle().clone()).expect("内核");
        let context = kernel.root_context();
        let handle = NativeContextHandle(context.clone());
        assert_eq!(handle.0.id(), context.id());
    }
}
