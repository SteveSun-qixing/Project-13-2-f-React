//! 标识别名：插件 ID、服务名、事件名、服务值与平台分配 ID 族。

use std::any::Any;
use std::sync::Arc;

/// 插件 ID：反向域名，例如 `chips.official.editor`。
pub type PluginId = String;

/// 服务名：小写短名，例如 `file`、`document`。
///
/// 命名规范见《薯片内核设计》§5.1：`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`。
pub type ServiceName = String;

/// 事件名：`<domain>:<action>`，例如 `plugin:loaded`。
///
/// 命名规范见《事件系统设计》§2.2：`^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$`。
pub type EventName = String;

/// 服务值：必须可跨线程共享并支持类型下转。
pub type ServiceValue = Arc<dyn Any + Send + Sync>;

/// Context 的唯一标识；由内核单调递增分配。
pub type ContextId = u64;

/// Fork 的唯一标识；由内核单调递增分配。
pub type ForkId = u64;

/// 注入的唯一标识；由内核单调递增分配。
pub type InjectionId = u64;

/// 渲染会话与会话级资源租约的统一标识。
pub type SessionId = u64;

/// 资源句柄标识。
pub type HandleId = u64;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_value_downcast() {
        let value: ServiceValue = Arc::new(41_u32);
        let typed = value.downcast::<u32>().expect("服务值类型应为 u32");
        assert_eq!(*typed, 41);
    }

    #[test]
    fn test_service_value_type_mismatch() {
        let value: ServiceValue = Arc::new(41_u32);
        assert!(value.downcast::<String>().is_err());
    }
}
