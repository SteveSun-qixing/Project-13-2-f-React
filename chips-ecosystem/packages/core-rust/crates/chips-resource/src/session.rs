//! 资源会话：句柄与租约的唯一所有权单元（《04-资源管理设计》§10.1、§11.2，
//! 《03-核心接口规范》§7.2）。
//!
//! 会话绑定所有者与允许作用域集合；派生子会话只继承父会话作用域子集，不允许
//! 扩权；关闭时级联关闭子会话并交回全部在途句柄归还信息。

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Mutex;

use chips_core::{PluginId, SessionId};
use serde::Serialize;

use crate::error::{ResourceError, ResourceResult};
use crate::scope::ScopeId;
use crate::uri::RESOURCE_SCHEME;

/// `HandleId` / `SessionId` 的 JS 安全整数上限（单调递增、释放后不复用，
/// 《03-核心接口规范》§7.3）。
pub const MAX_JS_SAFE_ID: u64 = (1 << 53) - 1;

/// 会话种类（《03》§7.2 `SessionKind`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionKind {
    /// 文档会话。
    Document,
    /// 插件会话。
    Plugin,
    /// 窗口会话。
    Window,
}

/// 资源会话。`permissions` 为 Bridge 会话权限快照的资源域投影
/// （§5.3「管理器对会话绑定做二次校验」的可实现必需字段，见 README）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResourceSession {
    /// 会话 ID。
    pub id: SessionId,
    /// 种类。
    pub kind: SessionKind,
    /// 所有者插件 ID。
    pub owner: PluginId,
    /// 允许作用域集合（派生只可收窄）。
    pub scopes: BTreeSet<ScopeId>,
    /// 权限快照（`resources:*` 与 `network:http:*` 在册 ID 集合）。
    pub permissions: BTreeSet<String>,
    /// 父会话（顶层会话为 `None`）。
    pub parent: Option<SessionId>,
}

/// 会话注册表。
#[derive(Debug, Default)]
pub struct SessionRegistry {
    inner: Mutex<SessionRegistryState>,
}

#[derive(Debug, Default)]
struct SessionRegistryState {
    sessions: BTreeMap<SessionId, ResourceSession>,
    children: BTreeSet<(SessionId, SessionId)>,
    next_id: SessionId,
}

impl SessionRegistry {
    /// 空注册表。
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    fn next_session_id(state: &mut SessionRegistryState) -> ResourceResult<SessionId> {
        if state.next_id >= MAX_JS_SAFE_ID {
            return Err(ResourceError::Internal);
        }
        state.next_id += 1;
        Ok(state.next_id)
    }

    /// 创建顶层会话。
    pub fn open_session(
        &self,
        kind: SessionKind,
        owner: &PluginId,
        scopes: BTreeSet<ScopeId>,
        permissions: BTreeSet<String>,
    ) -> ResourceResult<SessionId> {
        let mut state = self.inner.lock().expect("会话锁不得中毒");
        let id = Self::next_session_id(&mut state)?;
        state.sessions.insert(
            id,
            ResourceSession {
                id,
                kind,
                owner: owner.clone(),
                scopes,
                permissions,
                parent: None,
            },
        );
        Ok(id)
    }

    /// 派生子会话：`scopes` 与 `permissions` 必须是父会话子集，否则
    /// `RESOURCE_PERMISSION_DENIED`（不允许扩权，《04》§11.2）。
    pub fn derive_session(
        &self,
        parent: SessionId,
        scopes: &[ScopeId],
        permissions: &BTreeSet<String>,
    ) -> ResourceResult<SessionId> {
        let mut state = self.inner.lock().expect("会话锁不得中毒");
        let parent_session = state
            .sessions
            .get(&parent)
            .ok_or_else(|| ResourceError::NotFound {
                uri: format!("{RESOURCE_SCHEME}://session/{parent}"),
            })?
            .clone();
        let scoped: BTreeSet<ScopeId> = scopes.iter().cloned().collect();
        let out_of_scope: Vec<ScopeId> =
            scoped.difference(&parent_session.scopes).cloned().collect();
        if !out_of_scope.is_empty() || !permissions.is_subset(&parent_session.permissions) {
            return Err(ResourceError::PermissionDenied {
                target: format!("{RESOURCE_SCHEME}://session/{parent}"),
                permission: "session-derive".into(),
                required: vec!["父会话作用域与权限子集".into()],
                missing: out_of_scope,
                granted: parent_session.scopes.iter().cloned().collect(),
                reason: crate::error::PermissionDenyReason::OutOfScope,
            });
        }
        let id = Self::next_session_id(&mut state)?;
        state.sessions.insert(
            id,
            ResourceSession {
                id,
                kind: parent_session.kind,
                owner: parent_session.owner.clone(),
                scopes: scoped,
                permissions: permissions.clone(),
                parent: Some(parent),
            },
        );
        state.children.insert((parent, id));
        Ok(id)
    }

    /// 会话信息。
    #[must_use]
    pub fn get(&self, session: SessionId) -> Option<ResourceSession> {
        self.inner
            .lock()
            .expect("会话锁不得中毒")
            .sessions
            .get(&session)
            .cloned()
    }

    /// 在册会话快照（审计与测试辅助）。
    #[must_use]
    pub fn sessions(&self) -> Vec<ResourceSession> {
        self.inner
            .lock()
            .expect("会话锁不得中毒")
            .sessions
            .values()
            .cloned()
            .collect()
    }

    /// 关闭会话并级联关闭全部子会话；返回本代全部被关闭的会话（含级联）。
    pub fn close_session(&self, session: SessionId) -> ResourceResult<Vec<ResourceSession>> {
        let mut state = self.inner.lock().expect("会话锁不得中毒");
        if !state.sessions.contains_key(&session) {
            return Err(ResourceError::NotFound {
                uri: format!("{RESOURCE_SCHEME}://session/{session}"),
            });
        }
        let mut closed: Vec<ResourceSession> = Vec::new();
        let mut frontier = vec![session];
        while let Some(current) = frontier.pop() {
            let children: Vec<SessionId> = state
                .children
                .iter()
                .filter_map(|(parent, child)| (*parent == current).then_some(*child))
                .collect();
            state.children.retain(|&(_, child)| child != current);
            for child in children {
                frontier.push(child);
            }
            if let Some(record) = state.sessions.remove(&current) {
                closed.push(record);
            }
        }
        Ok(closed)
    }

    /// 把 `scope` 追加进会话允许集合（作用域注册时绑定创建会话，《06》§3.2）。
    pub fn attach_scope(&self, session: SessionId, scope: &ScopeId) -> ResourceResult<()> {
        let mut state = self.inner.lock().expect("会话锁不得中毒");
        let current = state
            .sessions
            .get_mut(&session)
            .ok_or_else(|| ResourceError::NotFound {
                uri: format!("{RESOURCE_SCHEME}://session/{session}"),
            })?;
        current.scopes.insert(scope.clone());
        Ok(())
    }

    /// 作用域注销时从全部会话集合中摘除该作用域（《06》§3.2 注销级联）。
    pub fn detach_scope(&self, scope: &ScopeId) {
        let mut state = self.inner.lock().expect("会话锁不得中毒");
        for session in state.sessions.values_mut() {
            session.scopes.remove(scope);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn permissions() -> BTreeSet<String> {
        BTreeSet::from_iter(["resources:read:card-1".to_owned()])
    }

    #[test]
    fn test_open_and_close_session() {
        let registry = SessionRegistry::new();
        let id = registry
            .open_session(
                SessionKind::Document,
                &"chips.editor".into(),
                BTreeSet::from(["card-1".to_owned()]),
                permissions(),
            )
            .expect("顶层会话必须成功");
        assert!(id > 0 && id <= MAX_JS_SAFE_ID);
        let session = registry.get(id).expect("会话必须可查");
        assert_eq!(session.owner, "chips.editor");
        assert!(session.scopes.contains("card-1"));
        let closed = registry.close_session(id).expect("关闭必须成功");
        assert_eq!(closed.len(), 1);
        assert_eq!(closed[0].id, id);
        assert!(registry.get(id).is_none());
    }

    #[test]
    fn test_derive_subset_only() {
        let registry = SessionRegistry::new();
        let parent = registry
            .open_session(
                SessionKind::Document,
                &"chips.editor".into(),
                BTreeSet::from(["card-1".to_owned(), "card-2".to_owned()]),
                permissions(),
            )
            .unwrap();
        let child = registry
            .derive_session(parent, &["card-1".to_owned()], &BTreeSet::new())
            .expect("子集派生必须成功");
        let child_session = registry.get(child).unwrap();
        assert_eq!(child_session.parent, Some(parent));
        assert!(!child_session.scopes.contains("card-2"));
        let error = registry
            .derive_session(parent, &["card-3".to_owned()], &BTreeSet::new())
            .expect_err("扩权派生必须拒绝");
        assert_eq!(error.code(), crate::error::RESOURCE_PERMISSION_DENIED);
        let wider = BTreeSet::from([
            "resources:read:card-1".to_owned(),
            "resources:read".to_owned(),
        ]);
        assert!(
            registry.derive_session(parent, &[], &wider).is_err(),
            "权限扩权同样拒绝"
        );
    }

    #[test]
    fn test_close_cascades_children() {
        let registry = SessionRegistry::new();
        let parent = registry
            .open_session(
                SessionKind::Window,
                &"chips.host".into(),
                BTreeSet::new(),
                BTreeSet::new(),
            )
            .unwrap();
        let child = registry
            .derive_session(parent, &[], &BTreeSet::new())
            .unwrap();
        let grandchild = registry
            .derive_session(child, &[], &BTreeSet::new())
            .unwrap();
        let closed = registry.close_session(parent).unwrap();
        assert_eq!(closed.len(), 3, "级联关闭全部后代");
        assert!(registry.get(grandchild).is_none());
    }

    #[test]
    fn test_attach_detach_scope() {
        let registry = SessionRegistry::new();
        let id = registry
            .open_session(
                SessionKind::Plugin,
                &"chips.a".into(),
                BTreeSet::new(),
                BTreeSet::new(),
            )
            .unwrap();
        registry.attach_scope(id, &"plugin-1".into()).unwrap();
        assert!(registry.get(id).unwrap().scopes.contains("plugin-1"));
        registry.detach_scope(&"plugin-1".into());
        assert!(!registry.get(id).unwrap().scopes.contains("plugin-1"));
    }
}
