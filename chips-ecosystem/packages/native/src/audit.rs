//! 权限判定出站观察面的 native 实现（RFC-权限审计跨层采集sink裁定 v1.0.1
//! §五/§六/§八；工单046 段四接线波）。
//!
//! `chips-native` 是全生态**唯一** `DecisionObserver` 实现方（RFC §八条 2）：
//! 判定线程内把 [`chips_core::PermissionDecision`] 素材序列化为 §8.2
//! camelCase 键表的 JSON（RFC §八条 3），经非阻塞 Neon [`Channel`] 抛给
//! 宿主主进程 TS 消费函数（`auditBindDecisionSink` 绑定，构造期注入、
//! 终身不可换，RFC §八条 1）。
//!
//! 线程语义（RFC §六条 2「拷素材 → 入有界队列 → 立即返回」预算）：
//!
//! - `on_permission_decision` 全程纯内存：建 `serde_json::Value` →
//!   原子计数预算闸（`in_flight` 达容量即丢 + `dropped` 计数，与宿主写入器
//!   `AUDIT_QUEUE_CAPACITY` 对称取 1024）→ `Channel::try_send` 入队即返回；
//!   不同步 IO、不等待 JS、不持任何可与判定面成环的锁（绑定槽为
//!   `OnceLock`，读取无锁、仅 `auditBindDecisionSink` 在 JS 线程写一次）；
//! - 本体以 `catch_unwind(AssertUnwindSafe)` 兜底吞 panic（发射侧
//!   [`chips_core::emit_permission_decision`] 之外的第二层防区：panic 既不
//!   外溢判定面，也不留观察侧半成品状态）；
//! - JS 消费函数抛出的异常在 JS 线程经 `try_catch` 吞弃——观察失败永不
//!   回传判定面（总则 G2），该条素材按 dropped 计数口径计丢。
//!
//! 丢弃可见性（RFC §六条 2 尾注，`host-trace.ts` dropped+onFault 母型）：
//! 每帧携带观察侧累计 `dropped` 计数，宿主消费点据此告警；未绑定前
//! （组合根启动序窗口、crate 单测场景）素材一律 drop + 计数，不排队回放
//! （禁另造无界缓冲）。
//!
//! 本模块不 import 任何判定面接口：observer 只被判定面调用，绝不回 call
//! `bridge*` / `resource*`（观察不回灌，RFC §六条 2）。

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock};

use chips_core::{
    DecisionAction, DecisionDomain, DecisionObserver, PermissionDecision, PermissionDenyReason,
};
use neon::prelude::*;
use serde_json::{json, Value};

use crate::convert::json_to_js;
use crate::error::{internal_error, throw_chips_error, type_unsupported};

/// 在途帧预算容量：与宿主审计写入器 `AUDIT_QUEUE_CAPACITY`（#183，1024）
/// 对称——两级有界队列同容量，满丢口径单一。
const DECISION_CHANNEL_CAPACITY: usize = 1024;

/// 素材 JSON 键表（RFC §八条 3）：§8.2 camelCase 词表直译 + 域判别
/// `domain` + 附加素材 `required`/`missing`（不落 §8.2 条目，RFC §5.3 尾注）。
/// 键序即序列化序；与 chips-core 锁测
/// `test_material_fields_align_8_2_vocabulary` 的 snake→camel 表同源，
/// 本模块锁测（`decision_material` 直译键表）逐键自证。
#[cfg(test)]
const MATERIAL_JSON_KEYS: &[&str] = &[
    "domain",
    "action",
    "pluginId",
    "sessionId",
    "permission",
    "required",
    "missing",
    "reason",
    "capabilityId",
    "resourceUri",
    "target",
    "requestId",
    "traceId",
    "qualifier",
];

/// 已绑定的宿主消费函数：`Channel` 回投 JS 线程 + `Root` 长驻引用
/// （§8.3 线程约束；`Root<JsFunction>` 在 neon 1.1.1 Node-API 后端
/// `Send + Sync`，可入 `OnceLock` 静态槽）。
struct BoundSink {
    channel: Channel,
    // `Arc` 包装：neon 1.1.1 的 `Root::clone` 需要 JS 上下文（引用计数递增），
    // 判定线程只共享 `Arc` 句柄、不复制 JS 引用。
    sink: Arc<Root<JsFunction>>,
}

/// native 真观察者：唯一实现方形态见模块头。
///
/// 计数半经 `Arc` 共享进 `Channel` 闭包（闭包要求 `'static`）；
/// 绑定槽 `OnceLock` 一次性置位，终身不可换（RFC §八条 1）。
#[derive(Default)]
pub(crate) struct NativeDecisionObserver {
    bound: OnceLock<BoundSink>,
    in_flight: Arc<AtomicUsize>,
    dropped: Arc<AtomicUsize>,
}

impl NativeDecisionObserver {
    /// 绑定宿主 TS 消费函数（`auditBindDecisionSink` 出口）。
    ///
    /// 只允许在 JS 线程调用一次；重复绑定返回 `false`，由导出面归一抛错。
    fn bind<'a, C: Context<'a>>(&self, cx: &mut C, sink: &Handle<'a, JsFunction>) -> bool {
        let bound = BoundSink {
            channel: Channel::new(cx),
            sink: Arc::new(Root::new(cx, sink)),
        };
        self.bound.set(bound).is_ok()
    }

    /// 观察侧累计丢弃计数（帧载荷；测试面读取）。
    #[cfg(test)]
    fn dropped_count(&self) -> usize {
        self.dropped.load(Ordering::Relaxed)
    }
}

impl DecisionObserver for NativeDecisionObserver {
    /// 判定线程同步入口：有界入队即返回 + `catch_unwind` 吞 panic。
    fn on_permission_decision(&self, decision: &PermissionDecision) {
        // 发射侧已以 `emit_permission_decision` 包裹；本层为观察实现自身的
        // 第二层防区（RFC §六条 3），panic 不外溢即不扰动判定结果（G2）。
        let _ = catch_unwind(AssertUnwindSafe(|| {
            self.dispatch(decision);
        }));
    }
}

impl NativeDecisionObserver {
    fn dispatch(&self, decision: &PermissionDecision) {
        let Some(bound) = self.bound.get() else {
            // 未绑定窗口（组合根启动序之外、无宿主场景）：素材 drop + 计数。
            self.dropped.fetch_add(1, Ordering::Relaxed);
            return;
        };
        // 预算闸：在途帧达容量即丢（满则丢 + 计数，禁无界排队）。
        if self.in_flight.load(Ordering::Relaxed) >= DECISION_CHANNEL_CAPACITY {
            self.dropped.fetch_add(1, Ordering::Relaxed);
            return;
        }
        let material = decision_material(decision);
        let channel = bound.channel.clone();
        let sink = Arc::clone(&bound.sink);
        let in_flight = Arc::clone(&self.in_flight);
        let dropped = Arc::clone(&self.dropped);
        in_flight.fetch_add(1, Ordering::Relaxed);
        let send_result = channel.try_send(move |mut cx| {
            // `try_catch` 收编帧构造与消费函数调用的全部 JS 抛出（含转换
            // 失败的 `NATIVE_*` 抛出）——回调永不留 pending exception，
            // 永不 Err 返回（Channel 回调的失败没有回传判定面的通道）。
            let delivered = cx.try_catch(|cx| deliver_frame(cx, &sink, &material, &dropped));
            if delivered.is_err() {
                dropped.fetch_add(1, Ordering::Relaxed);
            }
            in_flight.fetch_sub(1, Ordering::Relaxed);
            Ok(())
        });
        if send_result.is_err() {
            // JS 事件循环已关闭：入队失败按丢计，判定面零扰动。
            self.in_flight.fetch_sub(1, Ordering::Relaxed);
            self.dropped.fetch_add(1, Ordering::Relaxed);
        }
    }
}

/// 在 JS 线程组装帧 `{ decision, dropped }` 并调用宿主消费函数。
///
/// 消费函数抛出的异常由外层 `try_catch` 吞弃并按 dropped 计（观察失败
/// 永不回传判定面，G2）；返回值不消费。
fn deliver_frame(
    cx: &mut Cx<'_>,
    sink: &Arc<Root<JsFunction>>,
    material: &Value,
    dropped: &Arc<AtomicUsize>,
) -> NeonResult<()> {
    let frame = JsObject::new(cx);
    let decision_js = json_to_js(cx, material, "")?;
    frame.set(cx, "decision", decision_js)?;
    let dropped_js = cx.number(dropped.load(Ordering::Relaxed) as f64);
    frame.set(cx, "dropped", dropped_js)?;
    let function = sink.to_inner(cx);
    let this = cx.undefined();
    // 内层 `try_catch`：消费函数抛出即吞弃并计丢，随后正常收口
    // （外层不再有 pending exception，帧构造已成功）。
    let called = cx.try_catch(|cx| function.call(cx, this, [frame.upcast()]));
    if called.is_err() {
        dropped.fetch_add(1, Ordering::Relaxed);
    }
    Ok(())
}

/// 素材 → §8.2 camelCase 键表 JSON（RFC §八条 3）。
///
/// 纯内存、不可失败：`Option` 字段落 `null`（缺省不造值），`sessionId`
/// 以 `u64` 数值承载（§8.2 数值约束跨边界由 `json_to_js` 的 2^53 闸把关，
/// 越界该帧序列化失败按 dropped 计）。
fn decision_material(decision: &PermissionDecision) -> Value {
    json!({
        "domain": domain_str(decision.domain),
        "action": action_str(decision.action),
        "pluginId": decision.plugin_id.as_str(),
        "sessionId": decision.session_id,
        "permission": decision.permission.as_str(),
        "required": decision.required.clone(),
        "missing": decision.missing.clone(),
        "reason": decision.reason.map(deny_reason_str),
        "capabilityId": decision.capability_id.clone(),
        "resourceUri": decision.resource_uri.clone(),
        "target": decision.target.clone(),
        "requestId": decision.request_id.clone(),
        "traceId": decision.trace_id.clone(),
        "qualifier": decision.qualifier.clone(),
    })
}

/// `DecisionDomain` → 词表字面量（素材侧域判别，宿主路由 traceId 腿用）。
fn domain_str(domain: DecisionDomain) -> &'static str {
    match domain {
        DecisionDomain::Capability => "capability",
        DecisionDomain::Resource => "resource",
    }
}

/// `DecisionAction` → §8.2 `action` 运行时子集字面量。
fn action_str(action: DecisionAction) -> &'static str {
    match action {
        DecisionAction::Allow => "allow",
        DecisionAction::Deny => "deny",
    }
}

/// `PermissionDenyReason` → §8.2 五值 snake_case 词表（与 chips-core
/// serde 线上取值逐字一致）。
fn deny_reason_str(reason: PermissionDenyReason) -> &'static str {
    match reason {
        PermissionDenyReason::NotGranted => "not_granted",
        PermissionDenyReason::Revoked => "revoked",
        PermissionDenyReason::OutOfScope => "out_of_scope",
        PermissionDenyReason::UserRejected => "user_rejected",
        PermissionDenyReason::Policy => "policy",
    }
}

/// 进程级唯一观察者：`bridge()` 与 `resource_manager()` 单例构造期注入
/// **同一**实例（RFC §八条 2——两 crate 素材流汇入宿主同一消费点是
/// §九「单条目单落点」的结构保证）。
pub(crate) fn decision_observer() -> Arc<NativeDecisionObserver> {
    static OBSERVER: OnceLock<Arc<NativeDecisionObserver>> = OnceLock::new();
    Arc::clone(OBSERVER.get_or_init(|| Arc::new(NativeDecisionObserver::default())))
}

/// `auditBindDecisionSink(sink)`：绑定宿主主进程 TS 消费函数（audit 域首
/// 导出，《核心接口规范》§8.6）。
///
/// 构造期注入、终身不可换（RFC §八条 1）：重复绑定以 `NATIVE_INTERNAL`
/// 抛出拒绝；参数非函数以 `NATIVE_TYPE_UNSUPPORTED` 归一（§8.5，不新增
/// 错误码，G4）。宿主侧接线顺序约束：绑定先于任何 `bridge*` / `resource*`
/// 判定流量（组合根启动序，消除未绑定窗口）。
pub(crate) fn js_audit_bind_decision_sink(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let Ok(sink) = cx.argument::<JsFunction>(0) else {
        return throw_chips_error(
            &mut cx,
            type_unsupported("/sink", "参数必须是宿主消费函数 (frame) => void"),
        );
    };
    let observer = decision_observer();
    if !observer.bind(&mut cx, &sink) {
        return throw_chips_error(
            &mut cx,
            internal_error("审计观察面已绑定宿主消费函数，终身不可换（RFC §八条 1）"),
        );
    }
    Ok(cx.undefined())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample(domain: DecisionDomain, action: DecisionAction) -> PermissionDecision {
        PermissionDecision {
            domain,
            action,
            plugin_id: "chips.official.editor".into(),
            session_id: 7,
            permission: "filesystem:read".into(),
            required: vec!["filesystem:read".into(), "filesystem:write".into()],
            missing: if action == DecisionAction::Deny {
                vec!["filesystem:write".into()]
            } else {
                Vec::new()
            },
            reason: if action == DecisionAction::Deny {
                Some(PermissionDenyReason::NotGranted)
            } else {
                None
            },
            capability_id: (domain == DecisionDomain::Capability).then(|| "file:read".to_owned()),
            resource_uri: (domain == DecisionDomain::Resource)
                .then(|| "chips-resource://doc/a.md".to_owned()),
            target: None,
            request_id: Some("req-1".into()),
            trace_id: Some("t-1".into()),
            qualifier: None,
        }
    }

    /// snake→camel 机械变换（与 chips-core 锁测同源实现）。
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
    fn test_material_json_keys_are_camel_case_direct_translation() {
        // RFC §八条 3 键表锁测：序列化键集 = 素材 14 字段的 snake→camel
        // 直译（domain/required/missing 无 §8.2 对应但键名机械直译）。
        let material =
            decision_material(&sample(DecisionDomain::Capability, DecisionAction::Allow));
        let object = material.as_object().expect("素材必须是 JSON 对象");
        assert_eq!(object.len(), MATERIAL_JSON_KEYS.len());
        for key in MATERIAL_JSON_KEYS {
            assert!(object.contains_key(*key), "素材键缺失：{key}");
        }
        // snake 源名单（chips-core PermissionDecision 字段名，14 个逐一对应）。
        let snake_sources = [
            "domain",
            "action",
            "plugin_id",
            "session_id",
            "permission",
            "required",
            "missing",
            "reason",
            "capability_id",
            "resource_uri",
            "target",
            "request_id",
            "trace_id",
            "qualifier",
        ];
        let mapped: Vec<String> = snake_sources.iter().map(|s| snake_to_camel(s)).collect();
        assert_eq!(mapped, MATERIAL_JSON_KEYS.to_vec());
    }

    #[test]
    fn test_material_values_domain_and_reason_vocabularies() {
        let deny = decision_material(&sample(DecisionDomain::Resource, DecisionAction::Deny));
        assert_eq!(deny["domain"], json!("resource"));
        assert_eq!(deny["action"], json!("deny"));
        // deny 臂 reason：§8.2 五值 snake_case 词表逐字。
        assert_eq!(deny["reason"], json!("not_granted"));
        assert_eq!(deny["pluginId"], json!("chips.official.editor"));
        assert_eq!(deny["sessionId"], json!(7));
        assert_eq!(deny["missing"], json!(["filesystem:write"]));
        assert_eq!(deny["resourceUri"], json!("chips-resource://doc/a.md"));
        assert_eq!(deny["capabilityId"], Value::Null);
        // allow 臂：reason 恒 null（缺省不造值）。
        let allow = decision_material(&sample(DecisionDomain::Capability, DecisionAction::Allow));
        assert_eq!(allow["domain"], json!("capability"));
        assert_eq!(allow["action"], json!("allow"));
        assert_eq!(allow["reason"], Value::Null);
        assert_eq!(allow["missing"], json!([]));
        assert_eq!(allow["capabilityId"], json!("file:read"));
        assert_eq!(allow["resourceUri"], Value::Null);
        // 双侧键与预留槽直传。
        assert_eq!(allow["traceId"], json!("t-1"));
        assert_eq!(allow["requestId"], json!("req-1"));
        assert_eq!(allow["qualifier"], Value::Null);
    }

    #[test]
    fn test_unbound_observer_drops_material_with_count() {
        // 未绑定窗口：素材 drop + 计数，不 panic、不排队（RFC §六条 2）。
        let observer = NativeDecisionObserver::default();
        let decision = sample(DecisionDomain::Capability, DecisionAction::Allow);
        observer.on_permission_decision(&decision);
        observer.on_permission_decision(&decision);
        assert_eq!(observer.dropped_count(), 2);
        assert_eq!(observer.in_flight.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn test_observer_body_swallows_internal_panic_paths() {
        // catch_unwind 防区：经 chips-core 发射包裹调用，任何内部 panic
        // 均不外溢（本实现无 panic 路径，此处锁「调用必安全返回」）。
        let observer = NativeDecisionObserver::default();
        let decision = sample(DecisionDomain::Resource, DecisionAction::Deny);
        chips_core::emit_permission_decision(&observer, &decision);
        assert_eq!(observer.dropped_count(), 1); // 未绑定 → drop 计 1
    }

    #[test]
    fn test_singleton_observer_is_shared_instance() {
        // 两 crate 汇入同一消费点的结构保证：进程级唯一实例（RFC §八条 2）。
        let one = decision_observer();
        let two = decision_observer();
        assert!(Arc::ptr_eq(&one, &two));
    }

    #[test]
    fn test_deny_reason_literals_match_core_serde() {
        // 五值词表与 chips-core serde 线上取值逐字一致（防词表漂移）。
        let cases = [
            (PermissionDenyReason::NotGranted, "not_granted"),
            (PermissionDenyReason::Revoked, "revoked"),
            (PermissionDenyReason::OutOfScope, "out_of_scope"),
            (PermissionDenyReason::UserRejected, "user_rejected"),
            (PermissionDenyReason::Policy, "policy"),
        ];
        for (reason, literal) in cases {
            assert_eq!(deny_reason_str(reason), literal);
            assert_eq!(
                serde_json::to_value(reason).expect("reason 必可序列化"),
                json!(literal)
            );
        }
    }
}
