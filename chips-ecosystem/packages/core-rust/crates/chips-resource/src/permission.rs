//! 管理器侧权限判定：作用域 × 能力面的在册判定矩阵（《04-资源管理设计》§5.3、
//! 《06-资源协议规范》§4）。
//!
//! 只实现在册判定，不发明新规则。口径裁决：判定表以《06.04》§4.3 为协议权威
//! （Platform 免权限公开只读；《04.05》§5.3 的 `resources:read:platform` 变体
//! 视为漂移，见 README 漂移登记第 1 条——若未来裁决采用 04.05 口径，只需在
//! `platform_read` 一处收紧）。
//!
//! 会话内读取免重复校验（R19）：会话绑定作用域的读取在句柄获取时完成一次
//! 判定；每请求只做「目标作用域是否属于该会话」的常数校验。写入一律要求
//! `resources:write`（每次提交重新判定，不适用免重复校验）。

use std::collections::BTreeSet;

use chips_core::PluginId;

use crate::error::{PermissionDenyReason, ResourceError, ResourceResult};
use crate::scope::{ScopeKind, ScopeRegistration};
use crate::session::ResourceSession;
use crate::uri::ExternalOrigin;

/// 权限 ID 前缀与在册限定（《06》§4.2）。
pub const PERMISSION_RESOURCES_READ: &str = "resources:read";
/// 资源写入权限基 ID。
pub const PERMISSION_RESOURCES_WRITE: &str = "resources:write";
/// External 读取权限 ID（目标主机另由 `network:http:<host>` 限定）。
pub const PERMISSION_RESOURCES_READ_EXTERNAL: &str = "resources:read:external";
/// 网络权限前缀（External 附加约束）。
pub const PERMISSION_NETWORK_HTTP_PREFIX: &str = "network:http:";

/// 资源操作（两张能力面共用的引擎操作类别）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourceOperation {
    /// 读取（句柄获取与协议读取）。
    Read,
    /// 写入提交（受控提交路径；句柄不提供写入）。
    Write,
}

/// 判定结果：放行或拒绝（拒绝携带 `IPermissionDeniedDetails`）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    /// 放行。
    Allowed,
    /// 拒绝。
    Denied(ResourceError),
}

impl Decision {
    /// 收敛为 `Result`。
    pub fn into_result(self) -> ResourceResult<()> {
        match self {
            Self::Allowed => Ok(()),
            Self::Denied(error) => Err(error),
        }
    }
}

/// 判定矩阵引擎。
#[must_use]
pub struct PermissionChecker<'a> {
    caller: &'a PluginId,
    session: &'a ResourceSession,
    registration: &'a ScopeRegistration,
    operation: ResourceOperation,
    granted: &'a BTreeSet<String>,
    external_origin: Option<&'a ExternalOrigin>,
}

impl<'a> PermissionChecker<'a> {
    /// 构造判定输入。External 作用域必须携带已解析 origin（host 级附加约束）。
    pub fn new(
        caller: &'a PluginId,
        session: &'a ResourceSession,
        registration: &'a ScopeRegistration,
        operation: ResourceOperation,
        granted: &'a BTreeSet<String>,
        external_origin: Option<&'a ExternalOrigin>,
    ) -> Self {
        Self {
            caller,
            session,
            registration,
            operation,
            granted,
            external_origin,
        }
    }

    fn session_bound(&self) -> bool {
        self.session.scopes.contains(&self.registration.scope)
    }

    fn denied(
        &self,
        permission: &str,
        required: Vec<String>,
        missing: Vec<String>,
        reason: PermissionDenyReason,
    ) -> Decision {
        Decision::Denied(ResourceError::PermissionDenied {
            target: format!("chips-resource://{}/", self.registration.scope),
            permission: permission.to_owned(),
            required,
            missing,
            granted: self.granted.iter().cloned().collect(),
            reason,
        })
    }

    fn has(&self, permission: &str) -> bool {
        self.granted.contains(permission)
    }

    /// 读取是否被全局高风险 ID 覆盖（`resources:read` 读全部作用域）。
    fn has_global_read(&self) -> bool {
        self.has(PERMISSION_RESOURCES_READ)
    }

    fn has_read_of(&self, scope: &str) -> bool {
        self.has_global_read() || self.has(&format!("resources:read:{scope}"))
    }

    fn has_write_of(&self, scope: &str) -> bool {
        self.has(PERMISSION_RESOURCES_WRITE) || self.has(&format!("resources:write:{scope}"))
    }

    /// 执行在册判定。
    #[must_use]
    pub fn decide(self) -> Decision {
        match self.registration.kind {
            ScopeKind::Document => self.document(),
            ScopeKind::Workspace => self.workspace(),
            ScopeKind::Plugin => self.plugin(),
            ScopeKind::Platform => self.platform(),
            ScopeKind::External => self.external(),
            ScopeKind::Temporary => self.temporary(),
            ScopeKind::Memory => self.memory(),
        }
    }

    /// Document（《06》§4.3 行 2/3）：会话绑定读取免重复校验；写入一律经文档
    /// 服务受控提交且要求 `resources:write`，`resource:write` 不适用；会话外
    /// 读取要求 `resources:read:<scopeId>`，默认拒绝。
    fn document(self) -> Decision {
        match self.operation {
            ResourceOperation::Read => {
                if self.session_bound() {
                    return Decision::Allowed;
                }
                if self.has_read_of(&self.registration.scope) {
                    return Decision::Allowed;
                }
                self.denied(
                    &format!("resources:read:{}", self.registration.scope),
                    vec![format!("resources:read:{}", self.registration.scope)],
                    vec![format!("resources:read:{}", self.registration.scope)],
                    PermissionDenyReason::NotGranted,
                )
            }
            ResourceOperation::Write => {
                if self.has(PERMISSION_RESOURCES_WRITE) {
                    Decision::Allowed
                } else {
                    self.denied(
                        PERMISSION_RESOURCES_WRITE,
                        vec![PERMISSION_RESOURCES_WRITE.into()],
                        vec![PERMISSION_RESOURCES_WRITE.into()],
                        PermissionDenyReason::NotGranted,
                    )
                }
            }
        }
    }

    /// Workspace（§4.3 行 1）：限持有工作区会话的插件；读写按限定值匹配。
    fn workspace(self) -> Decision {
        if !self.session_bound() {
            return self.denied(
                &format!("resources:read:{}", self.registration.scope),
                Vec::new(),
                Vec::new(),
                PermissionDenyReason::OutOfScope,
            );
        }
        self.require(self.operation)
    }

    /// Plugin（§4.3 行 4/5）：自身读取免权限、写入需 `resources:write`；
    /// 他人默认拒绝，按限定值授权放行。
    fn plugin(self) -> Decision {
        if self.registration.owner == *self.caller {
            match self.operation {
                ResourceOperation::Read => Decision::Allowed,
                ResourceOperation::Write => {
                    if self.has(PERMISSION_RESOURCES_WRITE) {
                        Decision::Allowed
                    } else {
                        self.denied(
                            PERMISSION_RESOURCES_WRITE,
                            vec![PERMISSION_RESOURCES_WRITE.into()],
                            vec![PERMISSION_RESOURCES_WRITE.into()],
                            PermissionDenyReason::NotGranted,
                        )
                    }
                }
            }
        } else {
            self.require(self.operation)
        }
    }

    /// Platform（§4.3 行 6）：任意插件免权限公开只读；写入禁止（只读策略在
    /// 写入能力预检收口，见 `ResourceManager` 预检）。
    fn platform(self) -> Decision {
        match self.operation {
            ResourceOperation::Read => Decision::Allowed,
            ResourceOperation::Write => self.denied(
                PERMISSION_RESOURCES_WRITE,
                Vec::new(),
                Vec::new(),
                PermissionDenyReason::Policy,
            ),
        }
    }

    /// External（§4.3 行 7）：`resources:read:external`（或全局读）+
    /// `network:http:<host>`；写入禁止（策略）。
    fn external(self) -> Decision {
        match self.operation {
            ResourceOperation::Read => {
                let scope_read = self.has_global_read()
                    || self.has(PERMISSION_RESOURCES_READ_EXTERNAL)
                    || self.has_read_of(&self.registration.scope);
                let host = self.external_origin.map(|origin| origin.host.clone());
                let Some(host) = host else {
                    return self.denied(
                        PERMISSION_RESOURCES_READ_EXTERNAL,
                        Vec::new(),
                        Vec::new(),
                        PermissionDenyReason::Policy,
                    );
                };
                let network = self.has(&format!("{PERMISSION_NETWORK_HTTP_PREFIX}{host}"));
                let mut required = Vec::new();
                let mut missing = Vec::new();
                if !scope_read {
                    required.push(PERMISSION_RESOURCES_READ_EXTERNAL.into());
                    missing.push(PERMISSION_RESOURCES_READ_EXTERNAL.to_owned());
                }
                if !network {
                    required.push(format!("{PERMISSION_NETWORK_HTTP_PREFIX}{host}"));
                    missing.push(format!("{PERMISSION_NETWORK_HTTP_PREFIX}{host}"));
                }
                if missing.is_empty() {
                    Decision::Allowed
                } else {
                    let primary = required[0].clone();
                    self.denied(
                        &primary,
                        required,
                        missing,
                        PermissionDenyReason::NotGranted,
                    )
                }
            }
            ResourceOperation::Write => self.denied(
                PERMISSION_RESOURCES_WRITE,
                Vec::new(),
                Vec::new(),
                PermissionDenyReason::Policy,
            ),
        }
    }

    /// Temporary（§4.3 行 8）：授权 = 会话绑定；授权后读取免权限；写入按临时
    /// 授权规则要求 `resources:write` 且作用域可写（`dialog:save` 形态）。
    fn temporary(self) -> Decision {
        if !self.session_bound() {
            return self.denied(
                &format!("resources:read:{}", self.registration.scope),
                Vec::new(),
                Vec::new(),
                PermissionDenyReason::OutOfScope,
            );
        }
        match self.operation {
            ResourceOperation::Read => Decision::Allowed,
            ResourceOperation::Write => {
                if self.registration.policy.read_only {
                    return Decision::Denied(ResourceError::ReadOnly {
                        uri: format!("chips-resource://{}/", self.registration.scope),
                    });
                }
                if self.has(PERMISSION_RESOURCES_WRITE) {
                    Decision::Allowed
                } else {
                    self.denied(
                        PERMISSION_RESOURCES_WRITE,
                        vec![PERMISSION_RESOURCES_WRITE.into()],
                        vec![PERMISSION_RESOURCES_WRITE.into()],
                        PermissionDenyReason::NotGranted,
                    )
                }
            }
        }
    }

    /// Memory（§4.3 行 9）：仅创建者会话；跨会话传递禁止。写入不落盘由
    /// MemoryProvider 保证（段二）。
    fn memory(self) -> Decision {
        if self.session_bound() {
            Decision::Allowed
        } else {
            self.denied(
                &format!("resources:read:{}", self.registration.scope),
                Vec::new(),
                Vec::new(),
                PermissionDenyReason::OutOfScope,
            )
        }
    }

    /// 按限定值匹配的一般读写要求（Workspace / 他人 Plugin）。
    fn require(&self, operation: ResourceOperation) -> Decision {
        let permission = match operation {
            ResourceOperation::Read => format!("resources:read:{}", self.registration.scope),
            ResourceOperation::Write => format!("resources:write:{}", self.registration.scope),
        };
        let satisfied = match operation {
            ResourceOperation::Read => self.has_read_of(&self.registration.scope),
            ResourceOperation::Write => self.has_write_of(&self.registration.scope),
        };
        if satisfied {
            Decision::Allowed
        } else {
            let required = vec![permission.clone()];
            let missing = vec![permission.clone()];
            self.denied(
                &permission,
                required,
                missing,
                PermissionDenyReason::NotGranted,
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scope::{Origin, ScopePolicy};
    use crate::session::SessionKind;
    use std::path::PathBuf;

    fn session_of(owner: &str, scopes: &[&str], granted: &[&str]) -> ResourceSession {
        ResourceSession {
            id: 1,
            kind: SessionKind::Document,
            owner: owner.into(),
            scopes: scopes.iter().map(|s| (*s).to_owned()).collect(),
            permissions: granted.iter().map(|s| (*s).to_owned()).collect(),
            parent: None,
        }
    }

    fn registration(
        kind: ScopeKind,
        scope: &str,
        owner: &str,
        read_only: bool,
    ) -> ScopeRegistration {
        ScopeRegistration {
            scope: scope.into(),
            kind,
            owner: owner.into(),
            provider_id: "directory".into(),
            origin: Origin::Directory(PathBuf::from("/tmp/root")),
            policy: ScopePolicy {
                read_only,
                max_resource_bytes: 1 << 30,
                allowed_hosts: Vec::new(),
            },
        }
    }

    fn decide(
        caller: &str,
        session: &ResourceSession,
        registration: &ScopeRegistration,
        operation: ResourceOperation,
        origin: Option<&ExternalOrigin>,
    ) -> ResourceResult<()> {
        PermissionChecker::new(
            &caller.to_owned(),
            session,
            registration,
            operation,
            &session.permissions,
            origin,
        )
        .decide()
        .into_result()
    }

    #[test]
    fn test_document_session_bound_read_free() {
        let session = session_of("chips.editor", &["card-1"], &[]);
        let doc = registration(ScopeKind::Document, "card-1", "chips.editor", false);
        assert!(decide(
            "chips.editor",
            &session,
            &doc,
            ResourceOperation::Read,
            None
        )
        .is_ok());
    }

    #[test]
    fn test_document_external_requires_scoped_read() {
        let doc = registration(ScopeKind::Document, "card-1", "chips.editor", false);
        let unbound_session = session_of("chips.other", &[], &[]);
        let error = decide(
            "chips.other",
            &unbound_session,
            &doc,
            ResourceOperation::Read,
            None,
        )
        .expect_err("会话外默认拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
        let details = error.details().expect("拒绝必须携带 details");
        assert_eq!(details["missing"][0], "resources:read:card-1");
        assert_eq!(details["reason"], "not_granted");
        let granted_session = session_of("chips.other", &[], &["resources:read:card-1"]);
        assert!(decide(
            "chips.other",
            &granted_session,
            &doc,
            ResourceOperation::Read,
            None
        )
        .is_ok());
    }

    #[test]
    fn test_document_write_requires_resources_write() {
        let session = session_of("chips.editor", &["card-1"], &[]);
        let doc = registration(ScopeKind::Document, "card-1", "chips.editor", false);
        assert!(decide(
            "chips.editor",
            &session,
            &doc,
            ResourceOperation::Write,
            None
        )
        .is_err());
        let granted = session_of("chips.editor", &["card-1"], &["resources:write"]);
        assert!(decide(
            "chips.editor",
            &granted,
            &doc,
            ResourceOperation::Write,
            None
        )
        .is_ok());
    }

    #[test]
    fn test_workspace_scoped_permissions() {
        let doc = registration(ScopeKind::Workspace, "workspace-3f", "chips.host", false);
        let bound_no_perm = session_of("chips.a", &["workspace-3f"], &[]);
        assert!(decide(
            "chips.a",
            &bound_no_perm,
            &doc,
            ResourceOperation::Read,
            None
        )
        .is_err());
        let bound_read = session_of(
            "chips.a",
            &["workspace-3f"],
            &["resources:read:workspace-3f"],
        );
        assert!(decide("chips.a", &bound_read, &doc, ResourceOperation::Read, None).is_ok());
        let unbound = session_of("chips.a", &[], &["resources:read"]);
        let error = decide("chips.a", &unbound, &doc, ResourceOperation::Read, None)
            .expect_err("未持有工作区会话必须拒绝");
        assert_eq!(error.details().unwrap()["reason"], "out_of_scope");
    }

    #[test]
    fn test_plugin_self_and_other() {
        let mine = registration(ScopeKind::Plugin, "plugin-1", "chips.a", false);
        let self_session = session_of("chips.a", &["plugin-1"], &[]);
        assert!(decide(
            "chips.a",
            &self_session,
            &mine,
            ResourceOperation::Read,
            None
        )
        .is_ok());
        assert!(
            decide(
                "chips.a",
                &self_session,
                &mine,
                ResourceOperation::Write,
                None
            )
            .is_err(),
            "自身写入仍需 resources:write"
        );
        let self_write = session_of("chips.a", &["plugin-1"], &["resources:write"]);
        assert!(decide(
            "chips.a",
            &self_write,
            &mine,
            ResourceOperation::Write,
            None
        )
        .is_ok());
        let other = session_of("chips.b", &[], &["resources:read:plugin-1"]);
        assert!(decide("chips.b", &other, &mine, ResourceOperation::Read, None).is_ok());
        let intruder = session_of("chips.b", &[], &[]);
        assert!(decide("chips.b", &intruder, &mine, ResourceOperation::Read, None).is_err());
    }

    #[test]
    fn test_platform_public_read_policy_write_denied() {
        let platform = registration(ScopeKind::Platform, "platform", "chips.platform", true);
        let anyone = session_of("chips.any", &[], &[]);
        assert!(decide(
            "chips.any",
            &anyone,
            &platform,
            ResourceOperation::Read,
            None
        )
        .is_ok());
        let writer = session_of("chips.any", &[], &["resources:write"]);
        let error = decide(
            "chips.any",
            &writer,
            &platform,
            ResourceOperation::Read,
            None,
        );
        assert!(error.is_ok());
        let write_error = decide(
            "chips.any",
            &writer,
            &platform,
            ResourceOperation::Write,
            None,
        )
        .expect_err("Platform 写入禁止");
        assert_eq!(write_error.details().unwrap()["reason"], "policy");
    }

    #[test]
    fn test_external_dual_permission() {
        let ext = registration(ScopeKind::External, "external", "chips.platform", true);
        let origin = ExternalOrigin {
            scheme: "https".into(),
            host: "cdn.example.com".into(),
            port: None,
        };
        let scope_only = session_of("chips.a", &[], &["resources:read:external"]);
        let error = decide(
            "chips.a",
            &scope_only,
            &ext,
            ResourceOperation::Read,
            Some(&origin),
        )
        .expect_err("缺 network:http 必须拒绝");
        assert_eq!(
            error.details().unwrap()["missing"][0],
            "network:http:cdn.example.com"
        );
        let dual = session_of(
            "chips.a",
            &[],
            &["resources:read:external", "network:http:cdn.example.com"],
        );
        assert!(decide(
            "chips.a",
            &dual,
            &ext,
            ResourceOperation::Read,
            Some(&origin)
        )
        .is_ok());
        let global_read = session_of(
            "chips.a",
            &[],
            &["resources:read", "network:http:cdn.example.com"],
        );
        assert!(decide(
            "chips.a",
            &global_read,
            &ext,
            ResourceOperation::Read,
            Some(&origin)
        )
        .is_ok());
        assert!(decide(
            "chips.a",
            &dual,
            &ext,
            ResourceOperation::Write,
            Some(&origin)
        )
        .is_err());
    }

    #[test]
    fn test_temporary_authorized_rules() {
        let read_temp = registration(ScopeKind::Temporary, "temp-1", "chips.a", true);
        let write_temp = registration(ScopeKind::Temporary, "temp-2", "chips.a", false);
        let holder = session_of("chips.a", &["temp-1", "temp-2"], &["resources:write"]);
        assert!(decide(
            "chips.a",
            &holder,
            &read_temp,
            ResourceOperation::Read,
            None
        )
        .is_ok());
        let error = decide(
            "chips.a",
            &holder,
            &read_temp,
            ResourceOperation::Write,
            None,
        )
        .expect_err("dialog:open 只读授权不可写入");
        assert_eq!(error.code(), crate::error::RESOURCE_READ_ONLY);
        assert!(decide(
            "chips.a",
            &holder,
            &write_temp,
            ResourceOperation::Write,
            None
        )
        .is_ok());
        let outsider = session_of("chips.b", &[], &["resources:write"]);
        assert!(decide(
            "chips.b",
            &outsider,
            &write_temp,
            ResourceOperation::Read,
            None
        )
        .is_err());
    }

    #[test]
    fn test_memory_creator_session_only() {
        let memory = registration(ScopeKind::Memory, "memory", "chips.a", false);
        let creator = session_of("chips.a", &["memory"], &[]);
        assert!(decide("chips.a", &creator, &memory, ResourceOperation::Read, None).is_ok());
        let other = session_of("chips.b", &[], &["resources:read"]);
        assert!(
            decide("chips.b", &other, &memory, ResourceOperation::Read, None).is_err(),
            "跨会话传递禁止"
        );
    }

    #[test]
    fn test_global_high_risk_ids_cover_scoped() {
        let workspace = registration(ScopeKind::Workspace, "workspace-9", "chips.host", false);
        let global = session_of(
            "chips.a",
            &["workspace-9"],
            &["resources:read", "resources:write"],
        );
        assert!(decide(
            "chips.a",
            &global,
            &workspace,
            ResourceOperation::Read,
            None
        )
        .is_ok());
        assert!(decide(
            "chips.a",
            &global,
            &workspace,
            ResourceOperation::Write,
            None
        )
        .is_ok());
    }
}
