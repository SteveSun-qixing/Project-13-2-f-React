//! 权限判定出站观察面：crate 侧「原始判定素材」的唯一契约类型集。
//!
//! 权威契约见《RFC-权限审计跨层采集sink裁定》v1.0.1 §5.1（裁定F 批准，
//! 工单046 段四）：crate 侧只出素材、不出《08-权限系统设计》§8.2 全字段
//! 条目（素材面/条目面两分，RFC §5.2）；`id`（ULID）、`timestamp`、
//! `pluginVersion`、留存档位与 §8.5 脱敏均归宿主组装/写入侧。
//!
//! 形态比照 `chips-cordis` 的 `EventSink` 母型（`Send + Sync + 'static`
//! 单方法 trait + `Fn*` 便利包装 + panic 隔离），但**不复用内核事件总线**
//! （RFC §七）：权限审计是平台内部 append-only 观察面，插件无读写
//! （§8.4）。observer 实现只允许「拷素材 → 入有界队列 → 立即返回」级别的
//! 工作（禁阻塞、禁同步 IO、禁回灌判定面，RFC §六条 2）；crate 发射侧一律
//! 经 [`emit_permission_decision`] 的 `catch_unwind` 包裹调用——observer
//! panic 等于该条素材丢失，判定结果与错误返回不受任何影响（RFC §六条 3、
//! 总则 G2）。
//!
//! 字段词表与《08.08》§8.2 `IPermissionAuditEntry` 十六字段的逐字段对齐
//! 关系见 RFC §5.3 对齐表；本模块的锁测
//! （`audit::tests::test_material_fields_align_8_2_vocabulary`）为接线波
//! TS 侧锁测留锚（素材 snake_case 字段名 ↔ §8.2 camelCase 词表）。

use std::panic::{catch_unwind, AssertUnwindSafe};

use serde::Serialize;

use crate::ids::{PluginId, SessionId};

/// 判定域：能力调用（`chips-bridge`）或资源访问（`chips-resource`）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecisionDomain {
    /// 能力权限判定（`Bridge::admit` 权限段）。
    Capability,
    /// 资源作用域判定（`ResourceManager::resolve` → `PermissionChecker::decide`）。
    Resource,
}

/// crate 侧判定结果。grant/revoke 属链路二宿主动作，不经本观察面
/// （工单046 裁定二/§8.2 `PermissionAuditAction` 的宿主子集）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecisionAction {
    /// 经过授予判定且放行。
    Allow,
    /// 判定拒绝。
    Deny,
}

/// 权限拒绝原因（五值全型；现行 crate 产生三值，revoked/user_rejected
/// 随链路二翻正）。
///
/// 定义原属 `chips-resource/src/error.rs`（《02-Bridge三层设计》§5.4），
/// 随 RFC-权限审计跨层采集sink裁定 §5.1 实施波上移本处；`chips-resource`
/// 以 `pub use` 别名收口，serde 线上取值（snake_case 小写）零变化。
/// §8.2 `PermissionDenyReason` 词表逐字对齐：`not_granted` / `revoked` /
/// `out_of_scope` / `user_rejected` / `policy`。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionDenyReason {
    /// 未授予所需权限。
    NotGranted,
    /// 授权已撤销。
    Revoked,
    /// 超出作用域边界。
    OutOfScope,
    /// 用户拒绝。
    UserRejected,
    /// 平台策略。
    Policy,
}

/// 权限判定出站素材：《08.08》§8.2 条目中「判定现场可得」字段的子集
/// （对齐表见 RFC §5.3）。
///
/// 纯数据；不带 serde derive（跨 Neon 边界的序列化归实现方 observer，
/// RFC §八）。
#[derive(Debug, Clone)]
pub struct PermissionDecision {
    /// 判定域。
    pub domain: DecisionDomain,
    /// 判定结果（allow/deny）。
    pub action: DecisionAction,
    /// 触发插件 ID（bridge：会话快照 `plugin_id`；resource：`session.owner`）。
    pub plugin_id: PluginId,
    /// 判定所在会话（chips-core `SessionId = u64`；§8.2 `sessionId`
    /// 字符串化归宿主组装面）。
    pub session_id: SessionId,
    /// 判定基础权限 ID。deny = 首个缺失项（与 `denied_error`/`denied()`
    /// 短路口径同值）；allow = `required` 声明序首项（RFC §5.4 粒度裁定）。
    pub permission: String,
    /// 本次判定核对的所需权限全集（bridge：descriptor_permissions；
    /// resource：该臂 required）。
    pub required: Vec<String>,
    /// 缺失全集；allow 臂恒空（与 §8.2 details.missing、resource 错误
    /// 载体同型）。
    pub missing: Vec<String>,
    /// deny 必携；allow 恒 None。
    pub reason: Option<PermissionDenyReason>,
    /// `domain=Capability` 时的目标能力 ID；Resource 域恒 None。
    pub capability_id: Option<String>,
    /// `domain=Resource` 时的规范资源 URI（§8.5 脱敏在宿主写入侧，crate
    /// 出原值）；Capability 域恒 None。
    pub resource_uri: Option<String>,
    /// `domain=Resource` 的判定目标（现 `denied()` 的
    /// `chips-resource://<scope>/` 形态）；可缺省。
    pub target: Option<String>,
    /// 判定现场的 crate 内请求/追踪关联键（bridge 有、resource 无），
    /// 见 RFC §5.4。
    pub request_id: Option<String>,
    /// 判定现场的追踪关联键（同 [`Self::request_id`] 的键轨）。
    pub trace_id: Option<String>,
    /// 限定值槽：§8.2 `qualifier`。crate 侧限定值细粒度判定未交付
    /// （E8 集成缺口在册），现行实现恒 None；能力接线后经本字段透出，
    /// trait 与结构不变（面向未来扩展预留）。
    pub qualifier: Option<String>,
}

/// 权限判定出站观察面（工单046 裁定三.4 委托的「跨 Rust/TS 边界观察面」
/// 契约）。
///
/// 宿主装配根实现、crate 构造期注入且终身不可换（RFC §八）；形态比照
/// `chips-cordis` `EventSink` 母型（RFC §七条 4）。
pub trait DecisionObserver: Send + Sync + 'static {
    /// 判定收敛后在判定线程同步调用一次。素材按引用交出，实现方按需
    /// 深拷贝；禁阻塞、panic 隔离、锁纪律见 RFC §六。无返回值：观察失败
    /// 永不回传判定面（总则 G2）。
    fn on_permission_decision(&self, decision: &PermissionDecision);
}

/// 空观察实现；供 crate 集成测试与接线波落地前的编译随行注入（不改变
/// 「构造必显式注入」的裁定，RFC §八条 1）。
#[derive(Debug, Clone, Copy, Default)]
pub struct NoopDecisionObserver;

impl DecisionObserver for NoopDecisionObserver {
    fn on_permission_decision(&self, _decision: &PermissionDecision) {}
}

/// 以闭包实现的 `DecisionObserver`；用于测试与轻量适配（`FnEventSink`
/// 同族，RFC §四 C 案吸收进 A 案的在册形态）。
pub struct FnDecisionObserver<F>(F);

impl<F> FnDecisionObserver<F> {
    /// 包装一个观察函数。
    pub fn new(observer: F) -> Self {
        Self(observer)
    }
}

impl<F> DecisionObserver for FnDecisionObserver<F>
where
    F: Fn(&PermissionDecision) + Send + Sync + 'static,
{
    fn on_permission_decision(&self, decision: &PermissionDecision) {
        (self.0)(decision);
    }
}

/// crate 发射侧统一包裹：以 `catch_unwind(AssertUnwindSafe(..))` 调用
/// observer（RFC §六条 3，`chips-cordis` 监听器 panic 隔离先例同族）。
///
/// observer panic = 该条素材静默丢失（丢失可见性由实现方 dropped 计数
/// 承载）；判定结果与错误返回不受任何影响（总则 G2），crate 侧不重试、
/// 不上报错误码（总则 G4）。调用点必须处于 crate 核心锁外（RFC §六条 4）。
pub fn emit_permission_decision(observer: &dyn DecisionObserver, decision: &PermissionDecision) {
    let _ = catch_unwind(AssertUnwindSafe(|| {
        observer.on_permission_decision(decision);
    }));
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    /// 素材字段 ↔《08.08》§8.2 词表映射表（RFC §5.3 对齐表的 Rust 侧锚）：
    /// `(PermissionDecision 字段名, §8.2 IPermissionAuditEntry 字段名)`。
    /// 「宿主」侧字段（id/timestamp/source/actor/pluginVersion）无素材
    /// 对应物，不单列；`traceId`/`requestId`/`target` 为「双侧」字段——
    /// crate 侧素材名与 §8.2 条目名同名直译。
    const MATERIAL_TO_ENTRY: &[(&str, &str)] = &[
        ("action", "action"),
        ("plugin_id", "pluginId"),
        ("session_id", "sessionId"),
        ("permission", "permission"),
        ("qualifier", "qualifier"),
        ("capability_id", "capabilityId"),
        ("target", "target"),
        ("resource_uri", "resourceUri"),
        ("reason", "reason"),
        ("trace_id", "traceId"),
        ("request_id", "requestId"),
    ];

    /// snake_case Rust 字段名 → camelCase §8.2 词表的机械变换（映射表自证）。
    fn snake_to_camel(name: &str) -> String {
        let mut result = String::new();
        let mut upper_next = false;
        for ch in name.chars() {
            if ch == '_' {
                upper_next = true;
                continue;
            }
            result.push(if upper_next {
                upper_next = false;
                ch.to_ascii_uppercase()
            } else {
                ch
            });
        }
        result
    }

    #[test]
    fn test_material_fields_align_8_2_vocabulary() {
        // RFC §5.3 对齐锁测：素材 snake_case 字段名逐一经 snake→camel
        // 机械变换得到 §8.2 camelCase 词表名（接线波 TS 序列化键表同词）。
        for (material, entry) in MATERIAL_TO_ENTRY {
            assert_eq!(&snake_to_camel(material), entry, "{material} 映射漂移");
        }
        // §8.2 全 16 字段清点：素材可锚 11 名 + 宿主侧 5 名，逐名在册。
        const ENTRY_FIELDS: &[&str] = &[
            "id",
            "timestamp",
            "action",
            "source",
            "actor",
            "pluginId",
            "pluginVersion",
            "sessionId",
            "permission",
            "qualifier",
            "capabilityId",
            "target",
            "resourceUri",
            "reason",
            "traceId",
            "requestId",
        ];
        assert_eq!(ENTRY_FIELDS.len(), 16);
        let material_side: Vec<&str> = MATERIAL_TO_ENTRY.iter().map(|(_, e)| *e).collect();
        let host_side = ["id", "timestamp", "source", "actor", "pluginVersion"];
        for field in ENTRY_FIELDS {
            assert!(
                material_side.contains(field) || host_side.contains(field),
                "§8.2 字段 {field} 未在对齐表中归类"
            );
        }
        // 附加素材 required/missing 不落 §8.2 条目形状（RFC §5.3 尾注）。
        assert!(!material_side.contains(&"required") && !material_side.contains(&"missing"));
        // 素材共 14 字段 = 11 名对齐 + domain/action 双槽 + required/missing
        // 附加两字段（domain 承载域判别、action 对应 §8.2 action）。
        let field_count = {
            let sample = PermissionDecision {
                domain: DecisionDomain::Capability,
                action: DecisionAction::Allow,
                plugin_id: "chips.a".into(),
                session_id: 1,
                permission: "p".into(),
                required: Vec::new(),
                missing: Vec::new(),
                reason: None,
                capability_id: None,
                resource_uri: None,
                target: None,
                request_id: None,
                trace_id: None,
                qualifier: None,
            };
            // 逐字段显式读取，编译期即钉死 14 字段面（缺字段/多字段均红）。
            let _ = (
                &sample.domain,
                &sample.action,
                &sample.plugin_id,
                &sample.session_id,
                &sample.permission,
                &sample.required,
                &sample.missing,
                &sample.reason,
                &sample.capability_id,
                &sample.resource_uri,
                &sample.target,
                &sample.request_id,
                &sample.trace_id,
                &sample.qualifier,
            );
            14
        };
        assert_eq!(field_count, 14);
    }

    #[test]
    fn test_deny_reason_serde_snapshot_unchanged() {
        // 《08.08》§8.2 与《06》§7.3 词表逐字；定义自 chips-resource 上移
        // 后线上取值零变化（与 tests/error_code_lock.rs 的收口前快照互证）。
        let cases = [
            (PermissionDenyReason::NotGranted, "not_granted"),
            (PermissionDenyReason::Revoked, "revoked"),
            (PermissionDenyReason::OutOfScope, "out_of_scope"),
            (PermissionDenyReason::UserRejected, "user_rejected"),
            (PermissionDenyReason::Policy, "policy"),
        ];
        for (value, literal) in cases {
            assert_eq!(serde_json::to_value(value).unwrap(), literal);
            assert_eq!(
                serde_json::to_string(&value).unwrap(),
                format!("\"{literal}\"")
            );
        }
    }

    #[test]
    fn test_domain_and_action_are_copy_data() {
        let domain = DecisionDomain::Resource;
        let copied = domain;
        assert_eq!(domain, copied);
        assert_eq!(DecisionDomain::Capability, DecisionDomain::Capability);
        assert_ne!(DecisionDomain::Capability, DecisionDomain::Resource);
        let action = DecisionAction::Deny;
        assert_eq!(action, action);
        assert_ne!(DecisionAction::Allow, DecisionAction::Deny);
    }

    #[test]
    fn test_noop_observer_accepts_material() {
        let observer = NoopDecisionObserver;
        let decision = sample_decision();
        // Noop 直接调用与发射包裹均不panic、不改动素材。
        observer.on_permission_decision(&decision);
        emit_permission_decision(&observer, &decision);
        assert_eq!(decision.action, DecisionAction::Allow);
    }

    #[test]
    fn test_fn_observer_receives_reference() {
        let seen: Arc<Mutex<Vec<PermissionDecision>>> = Arc::new(Mutex::new(Vec::new()));
        let sink = {
            let seen = Arc::clone(&seen);
            FnDecisionObserver::new(move |decision: &PermissionDecision| {
                // 禁阻塞形母型：拷素材 → 入有界收集 → 立即返回。
                seen.lock().unwrap().push(decision.clone());
            })
        };
        let decision = sample_decision();
        emit_permission_decision(&sink, &decision);
        emit_permission_decision(&sink, &decision);
        let collected = seen.lock().unwrap();
        assert_eq!(collected.len(), 2);
        assert_eq!(collected[0].plugin_id, "chips.official.editor");
    }

    #[test]
    fn test_emit_catch_unwind_isolates_observer_panic() {
        // RFC §六条 3：observer panic = 素材丢失，发射调用本身永不 panic。
        let panic_sink = FnDecisionObserver::new(|_decision: &PermissionDecision| {
            panic!("观察面注入 panic");
        });
        let decision = sample_decision();
        emit_permission_decision(&panic_sink, &decision);
        // 走到这里即证明 panic 被吞、判定面（调用方）零扰动。
        assert_eq!(decision.domain, DecisionDomain::Capability);
    }

    fn sample_decision() -> PermissionDecision {
        PermissionDecision {
            domain: DecisionDomain::Capability,
            action: DecisionAction::Allow,
            plugin_id: "chips.official.editor".into(),
            session_id: 7,
            permission: "filesystem:read".into(),
            required: vec!["filesystem:read".into()],
            missing: Vec::new(),
            reason: None,
            capability_id: Some("file:read".into()),
            resource_uri: None,
            target: None,
            request_id: Some("req-1".into()),
            trace_id: Some("t-1".into()),
            qualifier: None,
        }
    }
}
