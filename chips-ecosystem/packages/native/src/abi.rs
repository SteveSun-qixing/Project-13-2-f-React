//! ABI 导出表（《核心接口规范》§8.1、§8.6）。
//!
//! 导出表在 [`register`] 中集中声明；[`EXPORT_NAMES`] 由同一张表生成，
//! 保证"登记清单"与"实际注册"不可能漂移。导出名一经登记不得重命名：
//! 改名、改参数顺序或改返回形状必须递增 `CORE_ABI_VERSION`（§9.2）。

use chips_core::{CORE_ABI_VERSION, PLATFORM_VERSION};
use neon::prelude::*;

/// 生成导出名表与集中注册函数。
macro_rules! export_table {
    ($( $name:literal => $function:path ),* $(,)?) => {
        /// ABI 导出名表；顺序与注册顺序一致。
        ///
        /// 事实源：本表、`abi/export-surface.json`、`types/chips-native.d.ts`
        /// 与《核心接口规范》§8.6 导出总表必须逐项一致。
        #[allow(dead_code)] // 契约测试（清单 ↔ 注册表比对）消费；非测试构建不参与运行时代码路径。
        pub(crate) const EXPORT_NAMES: &[&str] = &[$( $name ),*];

        /// 在模块入口集中注册全部导出函数。
        pub(crate) fn register(cx: &mut ModuleContext) -> NeonResult<()> {
            $( cx.export_function($name, $function)?; )*
            Ok(())
        }
    };
}

export_table! {
    "coreVersion" => core_version,
    "coreAbiVersion" => core_abi_version,
    "contextProvide" => crate::context::js_context_provide,
    "contextInject" => crate::context::js_context_inject,
    "contextGet" => crate::context::js_context_get,
    "contextOn" => crate::context::js_context_on,
    "contextUnsubscribe" => crate::context::js_context_unsubscribe,
    "contextEmit" => crate::context::js_context_emit,
    "contextEffect" => crate::context::js_context_effect,
    "createCancelToken" => crate::cancel::js_create_cancel_token,
    "cancelTokenCancel" => crate::cancel::js_cancel_token_cancel,
    "bridgeRegister" => crate::bridge::js_bridge_register,
    "bridgeUnregister" => crate::bridge::js_bridge_unregister,
    "bridgeRequest" => crate::bridge::js_bridge_request,
    "bridgeCancelSession" => crate::bridge::js_bridge_cancel_session,
    "bridgeActivateProvider" => crate::bridge::js_bridge_activate_provider,
    "bridgeDeactivateProvider" => crate::bridge::js_bridge_deactivate_provider,
    "bridgeGrantCapabilityId" => crate::bridge::js_bridge_grant_capability_id,
    "bridgeOpenSession" => crate::bridge::js_bridge_open_session,
    "bridgeCloseSession" => crate::bridge::js_bridge_close_session,
    "bridgeShutdown" => crate::bridge::js_bridge_shutdown,
    "openDocument" => crate::parser::js_open_document,
    "openCard" => crate::parser::js_open_card,
    "openBox" => crate::parser::js_open_box,
    "documentMetadata" => crate::parser::js_document_metadata,
    "documentStructure" => crate::parser::js_document_structure,
    "documentContent" => crate::parser::js_document_content,
    "documentEntries" => crate::parser::js_document_entries,
    "documentLayoutConfig" => crate::parser::js_document_layout_config,
    "documentRevision" => crate::parser::js_document_revision,
    "documentReadResource" => crate::parser::js_document_read_resource,
    "documentValidate" => crate::parser::js_document_validate,
    "buildDocumentView" => crate::parser::js_build_document_view,
    "documentClose" => crate::parser::js_document_close,
    "resourceOpen" => crate::resource::js_resource_open,
    "resourceStat" => crate::resource::js_resource_stat,
    "resourceRead" => crate::resource::js_resource_read,
    "resourceReadChunk" => crate::resource::js_resource_read_chunk,
    "resourceRelease" => crate::resource::js_resource_release,
    "resourceCommitWrite" => crate::resource::js_resource_commit_write,
    "resourceCommitWriteStream" => crate::resource::js_resource_commit_write_stream,
    "resourceListDirectory" => crate::resource::js_resource_list_directory,
    "resourceDelete" => crate::resource::js_resource_delete,
    "resourceRename" => crate::resource::js_resource_rename,
    "resourceCopy" => crate::resource::js_resource_copy,
    "resourceCreateDirectory" => crate::resource::js_resource_create_directory,
    "resourceOpenSession" => crate::resource::js_resource_open_session,
    "resourceCloseSession" => crate::resource::js_resource_close_session,
    "resourceRegisterTempScope" => crate::resource::js_resource_register_temp_scope,
    "resourceMountDirectory" => crate::resource::js_resource_mount_directory,
    "resourceMountArchive" => crate::resource::js_resource_mount_archive,
    "resourceUnregisterScope" => crate::resource::js_resource_unregister_scope,
    "auditBindDecisionSink" => crate::audit::js_audit_bind_decision_sink,
}

/// `coreVersion()`：平台统一版本（与全部平台包共用同一版本号）。
fn core_version(mut cx: FunctionContext) -> JsResult<JsString> {
    Ok(cx.string(PLATFORM_VERSION))
}

/// `coreAbiVersion()`：原生绑定 ABI 版本；导出面不兼容变化时递增。
fn core_abi_version(mut cx: FunctionContext) -> JsResult<JsNumber> {
    Ok(cx.number(f64::from(CORE_ABI_VERSION)))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 导出面清单（`abi/export-surface.json`）与源码同一变更维护。
    const EXPORT_SURFACE: &str = include_str!("../abi/export-surface.json");

    fn surface() -> serde_json::Value {
        serde_json::from_str(EXPORT_SURFACE).expect("导出面清单必须是合法 JSON")
    }

    #[test]
    fn test_export_names_are_camel_case_and_unique() {
        for name in EXPORT_NAMES {
            assert!(!name.is_empty(), "导出名不得为空");
            assert!(
                name.chars().next().is_some_and(|c| c.is_ascii_lowercase()),
                "导出名必须小驼峰：{name}"
            );
            assert!(!name.contains('_'), "导出名不得包含下划线：{name}");
        }
        let mut unique = EXPORT_NAMES.to_vec();
        unique.sort_unstable();
        unique.dedup();
        assert_eq!(unique.len(), EXPORT_NAMES.len(), "导出名不得重复");
    }

    #[test]
    fn test_export_surface_matches_registered_exports() {
        let surface = surface();
        let implemented: Vec<&str> = surface["exports"]
            .as_array()
            .expect("exports 必须是数组")
            .iter()
            .map(|entry| entry["name"].as_str().expect("name 必须是字符串"))
            .collect();
        assert_eq!(implemented, EXPORT_NAMES, "导出面清单必须与注册表逐项一致");
    }

    #[test]
    fn test_blocked_exports_reference_tickets_and_do_not_overlap() {
        let surface = surface();
        let blocked = surface["blocked"].as_array().expect("blocked 必须是数组");
        for entry in blocked {
            let name = entry["name"].as_str().expect("blocked.name 必须是字符串");
            let ticket = entry["ticket"]
                .as_str()
                .expect("blocked.ticket 必须是字符串");
            assert!(!ticket.is_empty(), "阻塞项必须引用工单：{name}");
            assert!(
                !EXPORT_NAMES.contains(&name),
                "阻塞项不得同时出现在已实现导出中：{name}"
            );
        }
    }

    #[test]
    fn test_abi_version_matches_manifest() {
        let surface = surface();
        assert_eq!(
            surface["abiVersion"].as_u64(),
            Some(u64::from(CORE_ABI_VERSION)),
            "清单 ABI 版本必须与 CORE_ABI_VERSION 一致"
        );
    }

    #[test]
    fn test_every_surface_entry_has_kind_and_signature() {
        let surface = surface();
        for entry in surface["exports"].as_array().expect("exports 必须是数组") {
            assert!(entry["kind"] == "sync" || entry["kind"] == "async");
            assert!(!entry["signature"].as_str().expect("signature").is_empty());
        }
    }
}
