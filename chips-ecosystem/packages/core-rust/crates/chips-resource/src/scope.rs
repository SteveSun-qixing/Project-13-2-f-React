//! 作用域注册与种类在册集合（《04-资源管理设计》§5.2、《06-资源协议规范》§3）。
//!
//! 作用域是唯一授权单元：注册绑定所有者、来源、策略与创建会话；注册不等于
//! 授权。External 按 origin 惰性注册；未注册作用域返回 `RESOURCE_NOT_FOUND`。

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;

use chips_core::PluginId;

use crate::error::{ResourceError, ResourceResult};
use crate::uri::{
    is_registered_scope_naming, CanonicalUri, ExternalOrigin, EXTERNAL_SCOPE, MEMORY_SCOPE,
    PLATFORM_SCOPE,
};

/// 作用域标识（平台分配的不透明小写 ID，《06》§2.3）。
pub type ScopeId = String;

/// 作用域种类（《06》§3.1 在册七种；`IResourceMetadata.scope` 返回值）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScopeKind {
    /// 用户工作区目录。
    Workspace,
    /// `.card` / `.box` 文档（不区分卡片与箱子，R8）。
    Document,
    /// 插件包目录。
    Plugin,
    /// 平台安装目录与内嵌资源。
    Platform,
    /// 外部代理资源。
    External,
    /// 用户经 `dialog:*` 授权的路径。
    Temporary,
    /// 运行时内存字节。
    Memory,
}

/// 资源来源（《04-资源管理设计》§3.1 `Origin`；Memory 形态为 §3.1 未列的在册
/// 种类补齐，见 README 漂移登记）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    /// 目录根。
    Directory(PathBuf),
    /// ZIP Store 文件。
    Archive(PathBuf),
    /// 平台内嵌资源标识。
    Platform(String),
    /// 规范化后的外部 origin。
    Http(ExternalOrigin),
    /// 运行时内存字节（禁止持久化）。
    Memory,
}

/// 主机匹配模式（External `allowed_hosts` 策略；《04》§5.2 仅给出类型名，
/// 段一按精确 origin 授权主机在册最小语义实现，见 README 漂移登记）。
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct HostPattern(String);

impl HostPattern {
    /// 以规范化 host 构造匹配模式。
    #[must_use]
    pub fn new(host: impl Into<String>) -> Self {
        Self(host.into().to_ascii_lowercase())
    }

    /// 匹配 host。
    #[must_use]
    pub fn matches(&self, host: &str) -> bool {
        self.0 == host.to_ascii_lowercase()
    }
}

/// 作用域策略（《04》§5.2）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopePolicy {
    /// 只读作用域（Platform / External / 归档来源 / `dialog:open` 临时授权）。
    pub read_only: bool,
    /// 单资源大小上限（字节）。
    pub max_resource_bytes: u64,
    /// 允许主机列表（仅 External 使用）。
    pub allowed_hosts: Vec<HostPattern>,
}

/// 作用域注册项（《04》§5.2 `ScopeRegistration`；`provider_id` 为管理器选择
/// Provider 的可实现必需补充字段，见 README）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScopeRegistration {
    /// 作用域 ID。
    pub scope: ScopeId,
    /// 种类。
    pub kind: ScopeKind,
    /// 所有者插件 ID。
    pub owner: PluginId,
    /// 承载该作用域的 Provider ID。
    pub provider_id: String,
    /// 底层来源。
    pub origin: Origin,
    /// 策略。
    pub policy: ScopePolicy,
}

impl ScopeRegistration {
    /// 校验注册项：scope ID 语法、ID 命名前缀与种类匹配、External origin 形态。
    fn validate(&self) -> ResourceResult<()> {
        if !is_registered_scope_naming(&self.scope) {
            return Err(ResourceError::InvalidUri {
                uri: format!("{EXTERNAL_SCOPE}-naming:{}", self.scope),
                reason: crate::error::UriErrorReason::MalformedScope,
            });
        }
        let kind_matches = match self.kind {
            ScopeKind::Workspace => self.scope.starts_with("workspace-"),
            ScopeKind::Document => {
                self.scope.starts_with("card-") || self.scope.starts_with("box-")
            }
            ScopeKind::Plugin => self.scope.starts_with("plugin-"),
            ScopeKind::Temporary => self.scope.starts_with("temp-"),
            ScopeKind::Platform => self.scope == PLATFORM_SCOPE,
            ScopeKind::External => self.scope == EXTERNAL_SCOPE,
            ScopeKind::Memory => self.scope == MEMORY_SCOPE,
        };
        if !kind_matches {
            return Err(ResourceError::InvalidUri {
                uri: self.scope.clone(),
                reason: crate::error::UriErrorReason::MalformedScope,
            });
        }
        match (self.kind, &self.origin) {
            (ScopeKind::External, Origin::Http(_)) => Ok(()),
            (ScopeKind::External, _) => Err(ResourceError::Internal),
            (ScopeKind::Memory, Origin::Memory) => Ok(()),
            (ScopeKind::Memory, _) => Err(ResourceError::Internal),
            (ScopeKind::Platform, Origin::Platform(_)) => Ok(()),
            (ScopeKind::Platform, _) => Err(ResourceError::Internal),
            (
                ScopeKind::Workspace
                | ScopeKind::Document
                | ScopeKind::Plugin
                | ScopeKind::Temporary,
                Origin::Directory(_) | Origin::Archive(_),
            ) => Ok(()),
            (
                ScopeKind::Workspace
                | ScopeKind::Document
                | ScopeKind::Plugin
                | ScopeKind::Temporary,
                _,
            ) => Err(ResourceError::Internal),
        }
    }
}

/// External origin 的注册键：`external/<scheme>/<host>[:<port>]`（《06》§2.1）。
#[must_use]
pub fn external_registration_key(origin: &ExternalOrigin) -> String {
    format!("external/{}/{}", origin.scheme, origin.host_authority())
}

/// 作用域注册表：注册、注销、查找与 External 惰性注册；平台不提供列举接口
/// （《06》§3.4）。
#[derive(Debug, Default)]
pub struct ScopeRegistry {
    entries: Mutex<HashMap<String, ScopeRegistration>>,
}

impl ScopeRegistry {
    /// 空注册表。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// 注册作用域；重复注册返回 `RESOURCE_ALREADY_EXISTS`。
    pub fn register(&self, registration: ScopeRegistration) -> ResourceResult<ScopeId> {
        registration.validate()?;
        let key = registration.scope.clone();
        let mut entries = self.entries.lock().expect("注册表锁不得中毒");
        if entries.contains_key(&key) {
            return Err(ResourceError::AlreadyExists { uri: key });
        }
        entries.insert(key.clone(), registration);
        drop(entries);
        Ok(key)
    }

    /// 注销作用域。
    pub fn unregister(&self, scope: &str) -> ResourceResult<ScopeRegistration> {
        self.entries
            .lock()
            .expect("注册表锁不得中毒")
            .remove(scope)
            .ok_or_else(|| ResourceError::NotFound {
                uri: format!("chips-resource://{scope}/"),
            })
    }

    /// 查找作用域注册项。
    #[must_use]
    pub fn lookup(&self, scope: &str) -> Option<ScopeRegistration> {
        self.entries
            .lock()
            .expect("注册表锁不得中毒")
            .get(scope)
            .cloned()
    }

    /// 按 External origin 查找注册项。
    #[must_use]
    pub fn lookup_external(&self, origin: &ExternalOrigin) -> Option<ScopeRegistration> {
        let key = external_registration_key(origin);
        self.entries
            .lock()
            .expect("注册表锁不得中毒")
            .get(&key)
            .cloned()
    }

    /// External 按 origin 惰性注册（《06》§3.2）：语法合法的首次解析 origin
    /// 创建注册项；已存在则复用。SSRF 前置校验属 HttpProvider 面（段二）。
    pub fn ensure_external(
        &self,
        origin: &ExternalOrigin,
        owner: &PluginId,
        provider_id: &str,
        max_resource_bytes: u64,
    ) -> ScopeRegistration {
        let key = external_registration_key(origin);
        let mut entries = self.entries.lock().expect("注册表锁不得中毒");
        if let Some(existing) = entries.get(&key) {
            return existing.clone();
        }
        let registration = ScopeRegistration {
            scope: EXTERNAL_SCOPE.to_owned(),
            kind: ScopeKind::External,
            owner: owner.clone(),
            provider_id: provider_id.to_owned(),
            origin: Origin::Http(origin.clone()),
            policy: ScopePolicy {
                read_only: true,
                max_resource_bytes,
                allowed_hosts: Vec::new(),
            },
        };
        entries.insert(key, registration.clone());
        registration
    }

    /// 解析流水线的「作用域查找」步：受管作用域查注册表；External 依规范 URI
    /// 惰性注册。未注册返回 `RESOURCE_NOT_FOUND`（《06》§3.4）。
    pub fn resolve_registration(
        &self,
        uri: &CanonicalUri,
        caller: &PluginId,
        provider_id: &str,
        max_resource_bytes: u64,
    ) -> ResourceResult<ScopeRegistration> {
        if uri.scope == EXTERNAL_SCOPE {
            let origin = uri
                .external
                .clone()
                .ok_or_else(|| ResourceError::NotFound {
                    uri: uri.to_canonical_string(),
                })?;
            return Ok(self.ensure_external(&origin, caller, provider_id, max_resource_bytes));
        }
        self.lookup(&uri.scope)
            .ok_or_else(|| ResourceError::NotFound {
                uri: uri.to_canonical_string(),
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::uri::ExternalOrigin;

    fn document_scope() -> ScopeRegistration {
        ScopeRegistration {
            scope: "card-7f3a".into(),
            kind: ScopeKind::Document,
            owner: "chips.official.editor".into(),
            provider_id: "directory".into(),
            origin: Origin::Directory(PathBuf::from("/tmp/card-7f3a")),
            policy: ScopePolicy {
                read_only: false,
                max_resource_bytes: 2 * 1024 * 1024 * 1024,
                allowed_hosts: Vec::new(),
            },
        }
    }

    #[test]
    fn test_register_lookup_unregister() {
        let registry = ScopeRegistry::new();
        let scope = registry.register(document_scope()).expect("注册必须成功");
        assert_eq!(scope, "card-7f3a");
        assert!(registry.lookup("card-7f3a").is_some());
        assert!(registry.unregister("card-7f3a").is_ok());
        let missing = registry
            .unregister("card-7f3a")
            .expect_err("注销后必须不存在");
        assert_eq!(missing.code(), crate::error::RESOURCE_NOT_FOUND);
    }

    #[test]
    fn test_duplicate_registration_rejected() {
        let registry = ScopeRegistry::new();
        registry.register(document_scope()).unwrap();
        let error = registry
            .register(document_scope())
            .expect_err("重复注册必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_ALREADY_EXISTS);
        assert!(registry.lookup("card-7f3a").is_some(), "拒绝不得破坏在册项");
    }

    #[test]
    fn test_kind_prefix_binding() {
        let registry = ScopeRegistry::new();
        let mut mismatch = document_scope();
        mismatch.scope = "plugin-001".into();
        let error = registry
            .register(mismatch)
            .expect_err("前缀与种类不符必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_INVALID_URI);
        // 非在册命名拒绝。
        let mut rogue = document_scope();
        rogue.scope = "rogue-1".into();
        assert!(registry.register(rogue).is_err());
    }

    #[test]
    fn test_external_lazy_registration_idempotent() {
        let registry = ScopeRegistry::new();
        let origin = ExternalOrigin {
            scheme: "https".into(),
            host: "cdn.example.com".into(),
            port: None,
        };
        let first = registry.ensure_external(&origin, &"chips.a".into(), "http", 1024);
        let second = registry.ensure_external(&origin, &"chips.b".into(), "http", 2048);
        assert_eq!(
            first.owner, second.owner,
            "按 origin 复用注册项，不重复创建"
        );
        assert_eq!(
            external_registration_key(&origin),
            "external/https/cdn.example.com"
        );
        assert!(registry.lookup_external(&origin).is_some());
    }

    #[test]
    fn test_scope_kind_serialization_matches_ts_enum() {
        // 《06》§6.1 ResourceScope 字面量逐一对应。
        for (kind, text) in [
            (ScopeKind::Workspace, "workspace"),
            (ScopeKind::Document, "document"),
            (ScopeKind::Plugin, "plugin"),
            (ScopeKind::Platform, "platform"),
            (ScopeKind::External, "external"),
            (ScopeKind::Temporary, "temporary"),
            (ScopeKind::Memory, "memory"),
        ] {
            assert_eq!(serde_json::to_value(kind).unwrap(), text);
        }
    }
}
