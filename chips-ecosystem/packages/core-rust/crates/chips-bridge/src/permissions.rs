//! 权限判定（《Bridge三层设计》§5）。
//!
//! 判定基础形态为 §5.2 的「精确匹配 + 域通配匹配」：会话快照逐项与能力声明的
//! 权限比对；`qualifier` 的路径/域名匹配由权限系统在快照物化时完成，
//! Bridge 层不自造规则（§5.2、§5.5）。

use std::collections::BTreeSet;

use chips_core::ChipsError;

use crate::error_codes::BRIDGE_PERMISSION_DENIED;

/// 单个所需权限能否被会话快照覆盖（《Bridge三层设计》§5.2 `matchesPermission`）。
///
/// 规则：快照精确包含该项，或快照包含其域通配形式（去掉最后一个 `:` 段后加
/// `:*`）。所需权限 ID 必为 `domain:scope` 形式（注册期已校验词表），
/// 因此通配候选为 `domain:*`。
#[must_use]
pub fn matches_permission(required: &str, granted: &BTreeSet<String>) -> bool {
    if granted.contains(required) {
        return true;
    }
    let Some(separator) = required.rfind(':') else {
        return false;
    };
    let wildcard = format!("{}:*", &required[..separator]);
    granted.contains(&wildcard)
}

/// 逐项判定能力所需权限；返回第一个未满足的权限与全部缺失项。
///
/// 循环按能力声明顺序短路（《08-权限系统设计》§7.2），但错误详情包含全部
/// `required` 与 `granted`。
fn evaluate(required: &[String], granted: &BTreeSet<String>) -> Option<(String, Vec<String>)> {
    let mut missing: Vec<String> = Vec::new();
    for item in required {
        if !matches_permission(item, granted) {
            missing.push(item.clone());
        }
    }
    missing.first().cloned().map(|first| (first, missing))
}

/// 构造 `BRIDGE_PERMISSION_DENIED`，`details` 结构与《08-权限系统设计》§9.2
/// `IPermissionDeniedDetails` 一致；`reason` 在快照模型下固定为
/// `not_granted`（撤销表现为快照重建后不再包含该项）。
pub(crate) fn denied_error(
    capability_id: &str,
    required: &[String],
    granted: &BTreeSet<String>,
) -> ChipsError {
    let (first_missing, missing) =
        evaluate(required, granted).unwrap_or_else(|| (String::new(), Vec::new()));
    let message = format!("插件缺少所需权限：{first_missing}");
    ChipsError::new(BRIDGE_PERMISSION_DENIED, message).with_details(serde_json::json!({
        "capabilityId": capability_id,
        "permission": first_missing,
        "required": required,
        "missing": missing,
        "granted": granted.iter().collect::<Vec<&String>>(),
        "reason": "not_granted",
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn granted(items: &[&str]) -> BTreeSet<String> {
        items.iter().map(|item| (*item).to_owned()).collect()
    }

    #[test]
    fn test_exact_match() {
        let set = granted(&["filesystem:read"]);
        assert!(matches_permission("filesystem:read", &set));
    }

    #[test]
    fn test_domain_wildcard_match() {
        let set = granted(&["filesystem:*"]);
        assert!(matches_permission("filesystem:read", &set));
        assert!(!matches_permission("network:http", &set));
    }

    #[test]
    fn test_no_match_paths() {
        let set = granted(&["clipboard:access"]);
        assert!(!matches_permission("filesystem:read", &set));
        assert!(!matches_permission("", &set));
    }

    #[test]
    fn test_qualified_snapshot_entry_does_not_widen() {
        // 限定值条目（如 filesystem:read:${userDocuments}/chips）不覆盖裸基础权限；
        // 目标级匹配由权限系统在快照物化/宿主判定时完成，Bridge 层按 §5.2 收口。
        let set = granted(&["filesystem:read:${userDocuments}/chips"]);
        assert!(!matches_permission("filesystem:read", &set));
    }

    #[test]
    fn test_denied_error_details_shape() {
        let required: Vec<String> = vec!["filesystem:read".into(), "network:http".into()];
        let set = granted(&["network:http"]);
        let error = denied_error("file:copy", &required, &set);
        assert_eq!(error.code(), BRIDGE_PERMISSION_DENIED);
        assert!(!error.retryable());
        assert_eq!(error.message(), "插件缺少所需权限：filesystem:read");
        let details = error.details().expect("拒绝错误必须携带详情");
        assert_eq!(details["capabilityId"], serde_json::json!("file:copy"));
        assert_eq!(details["permission"], serde_json::json!("filesystem:read"));
        assert_eq!(details["missing"], serde_json::json!(["filesystem:read"]));
        assert_eq!(
            details["required"],
            serde_json::json!(["filesystem:read", "network:http"])
        );
        assert_eq!(details["reason"], serde_json::json!("not_granted"));
    }
}
