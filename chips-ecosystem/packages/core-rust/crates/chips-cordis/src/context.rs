//! Context 树、作用域与服务注册入口。
//!
//! 对应《薯片内核设计》第三章；Context 节点之间以 ID 相互引用，避免 `Arc`
//! 循环引用，树的实体存放在内核的 `ContextTree` 中。

use std::any::Any;
use std::collections::HashMap;
use std::sync::Arc;

use chips_core::{ContextId, ForkId, InjectionId, ServiceName, ServiceValue};

use crate::error::KernelError;
use crate::kernel::Kernel;

/// Context 生命周期状态。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContextState {
    /// 已创建，尚不接受服务注册。
    Created,
    /// 运行中，可注册服务、订阅事件。
    Active,
    /// 正在销毁，拒绝新注册。
    Disposing,
    /// 已销毁；一切操作返回 `KERNEL_CONTEXT_DISPOSED`。
    Disposed,
}

/// Context 树节点。
#[derive(Debug, Clone)]
pub struct ContextNode {
    /// 节点 ID。
    pub id: ContextId,
    /// 父节点；根 Context 为 `None`。
    pub parent: Option<ContextId>,
    /// 子节点，按创建顺序排列。
    pub children: Vec<ContextId>,
    /// 该 Context 的作用域 Fork。
    pub fork: ForkId,
    /// 生命周期状态。
    pub state: ContextState,
}

/// Context 树的实体表；只为内核内部使用。
#[derive(Debug, Default, Clone)]
pub(crate) struct ContextTree {
    nodes: HashMap<ContextId, ContextNode>,
}

impl ContextTree {
    pub(crate) fn insert(&mut self, node: ContextNode) {
        self.nodes.insert(node.id, node);
    }

    pub(crate) fn node(&self, id: ContextId) -> Option<&ContextNode> {
        self.nodes.get(&id)
    }

    pub(crate) fn node_mut(&mut self, id: ContextId) -> Option<&mut ContextNode> {
        self.nodes.get_mut(&id)
    }

    pub(crate) fn remove(&mut self, id: ContextId) -> Option<ContextNode> {
        self.nodes.remove(&id)
    }

    /// 从指定节点到根的作用域链（含自身、根在最后）。
    pub(crate) fn ancestors(&self, id: ContextId) -> Vec<ContextId> {
        let mut chain = Vec::new();
        let mut current = Some(id);
        while let Some(context) = current {
            chain.push(context);
            current = self.nodes.get(&context).and_then(|node| node.parent);
        }
        chain
    }

    pub(crate) fn len(&self) -> usize {
        self.nodes.len()
    }
}

/// 暴露给插件与平台代码的 Context 句柄；克隆共享同一节点。
#[derive(Clone)]
pub struct Context {
    pub(crate) id: ContextId,
    pub(crate) kernel: Kernel,
}

impl std::fmt::Debug for Context {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Context")
            .field("id", &self.id)
            .finish_non_exhaustive()
    }
}

impl Context {
    pub(crate) fn new(id: ContextId, kernel: Kernel) -> Self {
        Self { id, kernel }
    }

    /// Context 标识。
    #[must_use]
    pub fn id(&self) -> ContextId {
        self.id
    }

    /// 当前生命周期状态。
    #[must_use]
    pub fn state(&self) -> ContextState {
        self.kernel
            .context_state(self.id)
            .unwrap_or(ContextState::Disposed)
    }

    /// 在当前 Context 注册服务。
    ///
    /// 插件 `Starting` 期间写入暂存代际，进入 `Active` 时一次原子发布；
    /// `Active` 期间的注册立即发布并触发级联重建。
    pub fn provide<T>(&self, name: ServiceName, value: T) -> Result<(), KernelError>
    where
        T: Any + Send + Sync + 'static,
    {
        self.kernel.provide_service(self.id, name, Arc::new(value))
    }

    /// 声明依赖并注入回调；依赖全部就绪时在注入 Fork 中执行回调。
    ///
    /// 返回 `Ok` 不代表回调已执行；依赖失效时撤销回调副作用，恢复后重建。
    pub fn inject<F>(
        &self,
        dependencies: &[ServiceName],
        callback: F,
    ) -> Result<InjectionId, KernelError>
    where
        F: Fn(&Context) + Send + Sync + 'static,
    {
        self.kernel
            .register_injection(self.id, dependencies, Arc::new(callback))
    }

    /// 按作用域链获取服务快照；未命中返回 `KERNEL_SERVICE_NOT_FOUND`。
    pub fn get(&self, name: &str) -> Result<ServiceValue, KernelError> {
        self.kernel.get_service(self.id, name)
    }

    /// 按作用域链类型化获取服务；类型不匹配返回 `KERNEL_SERVICE_TYPE_MISMATCH`。
    pub fn get_typed<T: Any + Send + Sync + 'static>(
        &self,
        name: &str,
    ) -> Result<Arc<T>, KernelError> {
        let value = self.get(name)?;
        value
            .downcast::<T>()
            .map_err(|_| KernelError::ServiceTypeMismatch {
                name: name.to_owned(),
            })
    }

    /// 登记自定义清理逻辑；随当前 Fork 按 LIFO 撤销。
    ///
    /// 内建能力（服务、监听器、任务）必须走各自登记入口，本方法只承载
    /// 定时器、自定义资源等外部清理。
    pub fn effect<F>(&self, cleanup: F) -> Result<(), KernelError>
    where
        F: FnOnce() + Send + Sync + 'static,
    {
        self.kernel.register_effect(self.id, cleanup)
    }

    /// 创建子 Context（立即进入 `Active`），用于插件内部更细粒度的作用域隔离。
    pub fn create_child(&self) -> Result<Context, KernelError> {
        self.kernel.create_child_context(self.id)
    }

    /// 销毁该 Context 子树：先子后本，本 Context 的 Fork 随后撤销。
    ///
    /// 幂等；插件 Context 的生命周期由插件管理器驱动，本方法用于子作用域。
    pub fn dispose(&self) -> Result<(), KernelError> {
        self.kernel.dispose_context(self.id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_debug_exposes_identity_only() {
        // §3.1：句柄诊断输出只暴露 Context ID，不泄露内核内部状态。
        let runtime = tokio::runtime::Runtime::new().expect("测试运行时应可创建");
        let kernel = Kernel::new(runtime.handle().clone()).expect("内核应可创建");
        let context = kernel.root_context();
        let text = format!("{context:?}");
        assert!(
            text.contains("Context") && text.contains(&context.id().to_string()),
            "诊断输出应含类型与 ID：{text}"
        );
        assert!(
            !text.contains("inner") && !text.contains("Kernel"),
            "诊断输出不得泄露内核句柄：{text}"
        );
    }

    #[test]
    fn test_ancestors_from_child_to_root() {
        let mut tree = ContextTree::default();
        tree.insert(ContextNode {
            id: 1,
            parent: None,
            children: vec![2],
            fork: 1,
            state: ContextState::Active,
        });
        tree.insert(ContextNode {
            id: 2,
            parent: Some(1),
            children: vec![3],
            fork: 2,
            state: ContextState::Active,
        });
        tree.insert(ContextNode {
            id: 3,
            parent: Some(2),
            children: Vec::new(),
            fork: 3,
            state: ContextState::Active,
        });
        assert_eq!(tree.ancestors(3), vec![3, 2, 1]);
        assert_eq!(tree.len(), 3);
    }
}
