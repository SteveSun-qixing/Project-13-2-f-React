//! 名称校验：服务名、事件名、事件域与发布者身份。
//!
//! 规则出处：《薯片内核设计》§5.1、§8.1；《事件系统设计》§2.2、§5.1、§5.2。

use crate::error::{KernelError, NameKind};

/// 平台保留事件域（《事件系统设计》§2.2）。
pub(crate) const RESERVED_DOMAINS: &[&str] = &[
    "internal",
    "plugin",
    "document",
    "file",
    "config",
    "security",
    "window",
    "app",
    "sync",
    "resource",
    "permission",
    "tray",
    "shortcut",
    "transfer",
    "command",
];

/// 服务名文法：`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`。
pub(crate) fn is_valid_service_name(name: &str) -> bool {
    let mut segments = name.split('-');
    let Some(first) = segments.next() else {
        return false;
    };
    if first.is_empty()
        || !first.as_bytes()[0].is_ascii_lowercase()
        || !first
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
    {
        return false;
    }
    segments.all(|segment| {
        !segment.is_empty()
            && segment
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
    })
}

/// 事件名文法：`^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$`（只允许一个冒号）。
pub(crate) fn is_valid_event_name(name: &str) -> bool {
    let mut parts = name.split(':');
    let (Some(domain), Some(action), None) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };
    is_valid_domain_segment(domain) && is_valid_domain_segment(action)
}

fn is_valid_domain_segment(segment: &str) -> bool {
    !segment.is_empty()
        && segment.as_bytes()[0].is_ascii_lowercase()
        && segment
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

/// 事件名的域部分。
pub(crate) fn event_domain(name: &str) -> Option<&str> {
    let (domain, _) = name.split_once(':')?;
    Some(domain)
}

/// 域是否为平台保留域。
pub(crate) fn is_reserved_domain(domain: &str) -> bool {
    RESERVED_DOMAINS.contains(&domain)
}

/// 插件自有事件域：插件 ID 末段。
pub(crate) fn plugin_domain(plugin_id: &str) -> Option<&str> {
    plugin_id.rsplit('.').next()
}

/// 校验服务名；非法返回 `KERNEL_INVALID_NAME`。
pub(crate) fn validate_service_name(name: &str) -> Result<(), KernelError> {
    if is_valid_service_name(name) {
        Ok(())
    } else {
        Err(KernelError::InvalidName {
            kind: NameKind::Service,
            name: name.to_owned(),
        })
    }
}

/// 校验事件注册：名称文法 + 发布者域规则。
///
/// `is_platform` 为真表示发布者是平台组件（可发布保留域事件）。
pub(crate) fn validate_event_register(
    name: &str,
    plugin_id: Option<&str>,
) -> Result<(), KernelError> {
    if !is_valid_event_name(name) {
        return Err(KernelError::InvalidName {
            kind: NameKind::Event,
            name: name.to_owned(),
        });
    }
    let Some(plugin_id) = plugin_id else {
        return Ok(());
    };
    let domain = event_domain(name).unwrap_or_default();
    if is_reserved_domain(domain) {
        return Err(KernelError::InvalidName {
            kind: NameKind::EventDomain,
            name: name.to_owned(),
        });
    }
    if plugin_domain(plugin_id) != Some(domain) {
        return Err(KernelError::InvalidName {
            kind: NameKind::EventDomain,
            name: name.to_owned(),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_name_grammar() {
        for valid in ["file", "document", "file-system", "cli-tool-2", "index2"] {
            assert!(is_valid_service_name(valid), "{valid} 应合法");
        }
        for invalid in [
            "", "File", "1file", "-file", "file-", "file--x", "file_x", "文件",
        ] {
            assert!(!is_valid_service_name(invalid), "{invalid} 应非法");
        }
    }

    #[test]
    fn test_event_name_grammar() {
        for valid in [
            "plugin:loaded",
            "document:changed",
            "sync:progress",
            "a-b:c-d2",
        ] {
            assert!(is_valid_event_name(valid), "{valid} 应合法");
        }
        for invalid in ["", "loaded", "a:b:c", "A:b", "a:B", "a:b.", "a.:b", "a b:c"] {
            assert!(!is_valid_event_name(invalid), "{invalid} 应非法");
        }
    }

    #[test]
    fn test_plugin_domain() {
        assert_eq!(plugin_domain("chips.official.editor"), Some("editor"));
        assert_eq!(plugin_domain("editor"), Some("editor"));
    }

    #[test]
    fn test_validate_service_name_error() {
        let error = validate_service_name("File").expect_err("非法服务名应被拒绝");
        assert_eq!(error.code(), "KERNEL_INVALID_NAME");
    }

    #[test]
    fn test_validate_event_register_rules() {
        assert!(validate_event_register("document:changed", None).is_ok());
        assert!(validate_event_register("editor:queued", Some("chips.official.editor")).is_ok());
        assert!(validate_event_register("file:changed", Some("chips.official.editor")).is_err());
        assert!(validate_event_register("other:queued", Some("chips.official.editor")).is_err());
        assert!(validate_event_register("Bad:name", Some("chips.official.editor")).is_err());
    }
}
