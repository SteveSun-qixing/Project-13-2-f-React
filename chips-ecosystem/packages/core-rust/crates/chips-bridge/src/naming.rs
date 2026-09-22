//! 能力 ID / 权限 ID 文法校验与平台登记表。
//!
//! 文法权威见《能力契约规范》§3.1；权限词表权威见《08-权限系统设计》§4.1
//! （基础权限 ID）；内置能力 ID 清单权威见《能力契约规范》§2.3 契约类型总表。

use crate::error_codes::BRIDGE_CAPABILITY_CONFLICT;
use chips_core::ChipsError;

/// 权限词表：平台内置基础权限 ID（《08-权限系统设计》§4.1 总表）。
///
/// 限定值（如 `filesystem:read:${userDocuments}`、`network:http:*.example.com`）
/// 由权限系统在会话快照物化时展开；词表只登记基础 `domain:scope` 形式。
pub const PERMISSION_VOCABULARY: &[&str] = &[
    "filesystem:read",
    "filesystem:write",
    "filesystem:delete",
    "resources:read",
    "resources:write",
    "window:control",
    "menu:manage",
    "tray:manage",
    "shortcut:manage",
    "system:read",
    "power:read",
    "power:manage",
    "transfer:manage",
    "notifications:send",
    "clipboard:access",
    "dialogs:use",
    "shell:external",
    "network:http",
    "config:read",
    "config:write",
    "credential:manage",
    "events:publish",
    "command:read",
    "command:write",
    "command:execute",
];

/// 内置能力 ID 登记表（《能力契约规范》§2.3 契约类型总表全量）。
///
/// 内置 ID 为保留标识，由平台服务域持有；第三方注册内置 ID 一律拒绝。
pub const BUILTIN_CAPABILITY_IDS: &[&str] = &[
    "file:read",
    "file:list",
    "file:watch",
    "file:write",
    "file:delete",
    "file:move",
    "file:copy",
    "file:mkdir",
    "resource:read",
    "resource:write",
    "resource:open",
    "resource:list-handlers",
    "document:create",
    "document:open",
    "document:read",
    "document:write",
    "document:save",
    "document:export",
    "window:create",
    "window:list",
    "window:focus",
    "window:close",
    "window:resize",
    "window:move",
    "window:setTitle",
    "window:setState",
    "menu:set",
    "tray:set",
    "shortcut:register",
    "shortcut:unregister",
    "system:info",
    "power:query",
    "power:prevent-sleep",
    "transfer:download",
    "transfer:cancel",
    "notification:send",
    "clipboard:read",
    "clipboard:write",
    "dialog:open",
    "dialog:save",
    "shell:openExternal",
    "http:request",
    "config:get",
    "config:snapshot",
    "config:set",
    "config:reset",
    "credential:get",
    "credential:set",
    "credential:delete",
    "event:publish",
    "command:register",
    "command:unregister",
    "command:list",
    "command:get",
    "command:invoke",
    "cli:task-active",
    "cli:task-get",
    "cli:task-progress",
    "cli:task-complete",
    "cli:task-fail",
    // 权限治理四项（《04-能力契约规范》§6.2 注 8，工单046 登记）：随
    // `@chips/bridge` 侧 `BUILTIN_CAPABILITIES`（64 项）注册表镜像，命名与
    // 顺序照 TS 侧权威逐字随动；声明空权限、不进入权限词表，本登记表只
    // 承担契约登记（内置保留与文法校验数据），不承载治理身份校验。
    "permission:grant",
    "permission:revoke",
    "permission:restore",
    "permission:audit-read",
];

/// 校验 `domain` 段文法：`1*( lowercase / digit / "-" )`。
fn is_domain_segment(segment: &str) -> bool {
    !segment.is_empty()
        && segment
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
}

/// 校验 `action` 段文法：`1*( lowercase / uppercase / digit / "-" )`。
///
/// 《能力契约规范》§3.1：常规形态为全小写；camelCase 动作段仅限平台登记的
/// 独立动作（`window:setTitle`、`window:setState`、`shell:openExternal`），
/// 与生成器 `CAPABILITY_ID_PATTERN` 一致——首字符必须为小写字母，其后允许大写。
fn is_action_segment(segment: &str) -> bool {
    let mut chars = segment.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    first.is_ascii_lowercase()
        && chars.all(|ch| {
            ch.is_ascii_lowercase() || ch.is_ascii_uppercase() || ch.is_ascii_digit() || ch == '-'
        })
}

/// 校验 `target` 段文法：`1*( lowercase / digit / "-" / "." )`。
fn is_target_segment(segment: &str) -> bool {
    !segment.is_empty()
        && segment
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '.')
}

/// 能力 ID 文法校验：`<domain>:<action>[:<target>]`，2 段或 3 段。
///
/// 规则见《能力契约规范》§3.1：`domain` 与 `target` 全部小写；`action` 段
/// 允许小写字母、大写字母、数字与连字符（首字符必须小写，camelCase 仅限
/// 平台登记的独立动作）；禁止空白、下划线与中文；`:` 是唯一分隔符；
/// 4 段及以上非法。
#[must_use]
pub fn is_valid_capability_id(id: &str) -> bool {
    let segments: Vec<&str> = id.split(':').collect();
    match segments.as_slice() {
        [domain, action] => is_domain_segment(domain) && is_action_segment(action),
        [domain, action, target] => {
            is_domain_segment(domain) && is_action_segment(action) && is_target_segment(target)
        }
        _ => false,
    }
}

/// 权限 ID 基础形式（`domain:scope`）登记查询：是否属于权限词表。
#[must_use]
pub fn is_permission_id_in_vocabulary(id: &str) -> bool {
    PERMISSION_VOCABULARY.contains(&id)
}

/// 内置能力 ID 登记查询：是否属于平台保留标识。
#[must_use]
pub fn is_builtin_capability_id(id: &str) -> bool {
    BUILTIN_CAPABILITY_IDS.contains(&id)
}

/// 构造注册拒绝错误：`BRIDGE_CAPABILITY_CONFLICT`（不可重试）。
pub(crate) fn conflict(reason: &str, id: &str) -> ChipsError {
    ChipsError::new(
        BRIDGE_CAPABILITY_CONFLICT,
        format!("能力注册冲突：{id}（{reason}）"),
    )
    .with_details(serde_json::json!({ "capabilityId": id, "reason": reason }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capability_id_grammar_valid() {
        assert!(is_valid_capability_id("file:read"));
        assert!(is_valid_capability_id("dialog:save"));
        assert!(is_valid_capability_id("window:create"));
        assert!(is_valid_capability_id("http:request"));
        assert!(is_valid_capability_id("shell:openExternal"));
        assert!(is_valid_capability_id("hello:greet:formal"));
        assert!(is_valid_capability_id("resource:list-handlers"));
        assert!(is_valid_capability_id("cli:task-active"));
        assert!(is_valid_capability_id("a1:b2:c3.d4"));
    }

    #[test]
    fn test_capability_id_grammar_invalid() {
        assert!(!is_valid_capability_id(""));
        assert!(!is_valid_capability_id("file"));
        assert!(!is_valid_capability_id("file:"));
        assert!(!is_valid_capability_id(":read"));
        assert!(!is_valid_capability_id("File:read"));
        assert!(!is_valid_capability_id("file:READ"));
        assert!(!is_valid_capability_id("file_域:read"));
        assert!(!is_valid_capability_id("file:read:"));
        assert!(!is_valid_capability_id("file:read:target:extra"));
        assert!(!is_valid_capability_id("file: read"));
        assert!(!is_valid_capability_id("file:read_snake"));
        assert!(!is_valid_capability_id("文档:read"));
    }

    #[test]
    fn test_vocabulary_lookup() {
        assert!(is_permission_id_in_vocabulary("filesystem:read"));
        assert!(is_permission_id_in_vocabulary("command:execute"));
        assert!(!is_permission_id_in_vocabulary("file:read"));
        assert!(!is_permission_id_in_vocabulary("filesystem:wipe"));
    }

    #[test]
    fn test_builtin_lookup_and_grammar_consistency() {
        assert!(is_builtin_capability_id("event:publish"));
        assert!(!is_builtin_capability_id("hello:greet"));
        for id in BUILTIN_CAPABILITY_IDS {
            assert!(is_valid_capability_id(id), "内置 ID 必须满足文法：{id}");
            assert!(
                !is_permission_id_in_vocabulary(id),
                "内置能力 ID 不得与权限 ID 相同：{id}"
            );
        }
        for id in PERMISSION_VOCABULARY {
            assert!(
                !is_builtin_capability_id(id),
                "权限 ID 不得同时是内置能力 ID：{id}"
            );
        }
    }

    #[test]
    fn test_builtin_mirror_count_and_permission_governance_ids() {
        // 镜像锁测：与 `@chips/bridge` 侧 `BUILTIN_CAPABILITIES`（64 项，
        // capability-contracts.ts）逐名随动；权限治理四项（工单046 登记、
        // #155 落定）补登在册，尾部顺序照 TS 侧权威逐字。
        assert_eq!(BUILTIN_CAPABILITY_IDS.len(), 64);
        assert_eq!(
            &BUILTIN_CAPABILITY_IDS[BUILTIN_CAPABILITY_IDS.len() - 4..],
            [
                "permission:grant",
                "permission:revoke",
                "permission:restore",
                "permission:audit-read",
            ]
        );
        for id in [
            "permission:grant",
            "permission:revoke",
            "permission:restore",
            "permission:audit-read",
        ] {
            assert!(
                is_builtin_capability_id(id),
                "权限治理 ID 必须入内置保留表：{id}"
            );
        }
    }

    #[test]
    fn test_conflict_error_shape() {
        let error = conflict("文法非法", "Bad:Id");
        assert_eq!(error.code(), BRIDGE_CAPABILITY_CONFLICT);
        assert!(!error.retryable());
        assert_eq!(
            error
                .details()
                .and_then(|value| value.get("reason"))
                .cloned(),
            Some(serde_json::json!("文法非法"))
        );
    }
}
