# RFC-权限审计跨层采集 sink 裁定（工单046 裁定三.4 收编 / W3-P0-3 段四：`chips-bridge` / `chips-resource` 权限判定出站信号接口契约裁定）

> 版本：v1.0.1
> 日期：2026-09-21
> 状态：批准（主智能体裁定F，2026-09-21 签批；五议题照案采纳，用户若否决则回退草稿并暂停实施单）
> 关联：`项目日志与笔记/工单046-权限审计面全链零实现与契约登记缺册/任务说明.md` §三.裁定三、§六.4（本单权威委托：crate 侧审计 sink 接口形态出 RFC/裁定）、同目录《勘查报告-权限审计面现状》三列账 #19/#20、`项目日志与笔记/工单046-权限审计面全链零实现与契约登记缺册/立项书-W3-P0-3权限审计基础设施.md` §一.6/§二.段四/§三、《08-权限系统设计》八、链路四（`08.08` HEAD 版 §8.1/§8.2/§8.5）、《RFC-chips-bridge契约发布面裁定》《RFC-ChipsError统一裁定》（结构、编号惯例与 §9.2 ABI 判例）、工单013/025/041/042（在册账）

---

## 一、背景与动机

工单046 §二.5 判定：**跨层审计采集钩子缺册属架构性缺口**——`chips-bridge`、`chips-resource` 两 Rust crate 在权限判定 allow/deny 路径上均无任何出站信号面，《08.08》只定义宿主侧记录形状与落盘（§8.2–§8.4），未定义 crate 侧采集接口形态；工单025 内核接线（判定权威翻转到 Rust 侧）后必然复撞。裁定三.4 据此委托：**「crate 侧审计 sink 接口形态出 RFC/裁定（跨 Rust/TS 边界观察面属公共协议，走 RFC 流程）」**；W3-P0-3 立项书段四承接本议题，并明示「RFC 稿可与段二并行起草（只写文档零代码）」「实施单在 RFC 批准后另立」。

本 RFC 即该段四裁定稿，覆盖五个议题：`DecisionObserver`/sink trait 接口形态与《08.08》§8.2 字段对齐（第五节）、回调线程语义与拒绝热路径禁阻塞（第六节）、与 cordis 事件面的关系（第七节）、注入位与生命周期（第八节）、挂点唯一性与段三宿主挂点的分工界线（第九节）。**本 RFC 只定接口契约与裁定建议，零代码改动，实施归 RFC 批准后的另单**（立项书段四在册）。

### 1.1 基线读取纪律声明

本文写作时三面在途（crates 域 #151 接管波、`packages/host`/`packages/bridge` #147/#154 carrier 波、`08.07`/`08.08` t046-auditdoc 落文波）。**本文全部引用以 `git show HEAD:` 基线实读为准，行号为 2026-09-21 HEAD 快照**；工作树在途 diff 一律不作为事实源。与勘查报告行号不一致处（如 `chips-resource/src/permission.rs` 的 `denied()`/`platform()` 段）在第二、三节逐条注明，以本文为 HEAD 基线重读值。

## 二、现状核证账（全部 HEAD 实读，命令与结果在册）

### 2.1 crate 侧：判定存在、出站信号为零

| #   | 证据点                                      | HEAD 实读位置（`chips-ecosystem/packages/core-rust/` 前缀省略）                                                                                                                                                                                                                                                                                                                                                                                                                  | 结论                                                                                                  |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| E1  | 两 crate 无 tracing/log 依赖                | `grep -rn "tracing\|log::" crates/chips-bridge crates/chips-resource --include=*.rs` → 0 命中（exit 1）；`crates/chips-bridge/Cargo.toml`、`crates/chips-resource/Cargo.toml`、workspace 依赖表（`chips-ecosystem/packages/core-rust/Cargo.toml:17-25`）均无 tracing/log 项                                                                                                                                                                                                      | 勘查声称复核成立                                                                                      |
| E2  | bridge 拒绝臂纯返回                         | `crates/chips-bridge/src/bridge.rs:708-763` `admit`：权限判定锁外完成（:738-744），缺失非空即 `return Err(denied_error(...))`（:745-751），无日志/回调/事件                                                                                                                                                                                                                                                                                                                      | 拒绝不产生任何出站信号（勘查 #20 吻合）                                                               |
| E3  | bridge reason 固定值                        | `crates/chips-bridge/src/permissions.rs:44-63` `denied_error`：details 含 `capabilityId/permission/required/missing/granted/reason`，`reason` 固定 `"not_granted"`（:61，注释 :44-46 自辩快照模型口径）                                                                                                                                                                                                                                                                          | 与勘查 #17 吻合；`revoked` 待链路二翻正，非本单面                                                     |
| E4  | resource 判定矩阵与拒绝构造                 | `crates/chips-resource/src/permission.rs:95-110` `denied()` 只构造 `Decision::Denied(ResourceError::PermissionDenied{..})`（勘查引 :98-113，HEAD 漂移 -3 行）；`decide()` :131-141 按作用域分派                                                                                                                                                                                                                                                                                  | 无 observer/sink/tracing；拒绝细节（target/permission/required/missing/granted/reason）已在错误载体内 |
| E5  | resource reason 三值产生、两值无臂          | `PermissionDenyReason::NotGranted`：permission.rs:159,170,204,264,303 等；`OutOfScope`：:184,285；`Policy`：:223,242,272；枚举五值定义 `crates/chips-resource/src/error.rs:172-182`（`UserRejected` :180 无触发臂，勘查引 :180 吻合）                                                                                                                                                                                                                                            | 五枚举中 crate 侧现行产生面三值；接口面按五值全型定义                                                 |
| E6  | resource 唯一判定挂点位                     | `crates/chips-resource/src/manager.rs:336-345`：`PermissionChecker::new(...).decide().into_result()?`，全 crate 唯一构造点（`grep PermissionChecker::new` 仅 manager.rs:336）；resolve 段另有会话缺失直构 `PermissionDenied{reason: OutOfScope}`（:313-322）                                                                                                                                                                                                                     | 资源域判定面收敛于 Manager.resolve 一处                                                               |
| E7  | 免权限直通臂在册（裁定二豁免对象）          | `permission.rs:216-227` `platform()`：Read 恒 `Decision::Allowed`（:218，勘查引 :219-221 HEAD 漂移）；:192-195 `plugin()` 自身 owner 读恒放行；:146-151 `document()` 会话绑定读免重复校验放行臂                                                                                                                                                                                                                                                                                  | 三直通臂即工单046 裁定二「不入审计」的 crate 侧对应物                                                 |
| E8  | 宿主 TS 现行判定链无钩                      | `packages/host/src/runtime/capability/router.ts:85-98`：拒绝臂直接 `return`（勘查引 :85-98，HEAD 逐字吻合）；`packages/host/src/runtime/host-runtime.ts:226-232` `createHostCapabilityRouter({...})` 构造无 audit/事件注入位；`packages/host/src/runtime/capability/session.ts:295` 拒绝固定 `reason: 'not_granted'`（:279 注「限定值细粒度匹配在 Rust Bridge 交付后由内核承接」）                                                                                               | 段三宿主挂点的地盘；限定值缺口在册                                                                    |
| E9  | 三事件登记面完备、生产者为零                | `packages/bridge/src/protocol/events.ts:56-58`：`security:audit`（platform）、`permission:granted`、`permission:denied`（plugin-field 可见性）；契约快照 `tests/contract/snapshots/event-contracts.json` HEAD：`permission:denied` payload 字段 :337 段（pluginId/pluginVersion/permission/qualifier/capabilityId/target/resourceUri/reason/sessionId/traceId/timestamp，勘查引 :337/:401 系旧版行序，HEAD 为 :337/:401/:601）、`permission:granted` :401、`security:audit` :601 | 事件名与 payload 已在册锁定，本 RFC 零新增、只对齐                                                    |
| E10 | TS `IPermissionAuditEntry` 仍无契约同型定义 | 全仓 `IPermissionAuditEntry` 0 定义（勘查 #3）；异型 7 字段 `IPermissionAuditRecord` 在 `packages/bridge/src/core/permission-evaluator.ts:278-287`；`packages/bridge/src/core/router.ts:56` `options.audit?`、:141-150 `writeAudit` 失败→`onDiagnostic` 不阻塞（生产接线 0，工单046 裁定三在册「二选一收口」）                                                                                                                                                                   | 段一收口类型面；本 RFC 的 crate 接口字段命名与其逐字对齐防三型并存                                    |
| E11 | ULID 供给不出 crate                         | `crates/chips-cordis/src/ulid.rs:22` `pub(crate) struct UlidGenerator`（`mod ulid` 私有，lib.rs:24）；两目标 crate 均不依赖 chips-cordis（E1 同款 Cargo.toml 实测）                                                                                                                                                                                                                                                                                                              | `id` 字段（§8.2 ULID）不可能由 crate 侧产出，归属裁定见 §5.3                                          |

### 2.2 crate 内既有「观察/注入」先例（形态比照对象）

| #   | 先例                                                                                                                                                                                                                                                                                     | HEAD 位置                                                                                                                                             | 对本裁定的意义                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| P1  | `pub trait EventSink: Send + Sync + 'static { fn enqueue(&self, event: Event) -> Result<(), KernelError>; }`；`FnEventSink<F>` 闭包便利包装（:63-79）；监听器在发布线程同步调用、JS 监听器入队即返回（:1-6 头注）；监听器 panic 经 `catch_unwind(AssertUnwindSafe(..))` 隔离（:9, :248） | `crates/chips-cordis/src/event.rs:57-60`                                                                                                              | 生态在册最小 sink trait 母型（线程语义/包装器/panic 隔离三要素俱全）        |
| P2  | `pub type InvalidateListener = Arc<dyn Fn(InvalidateReason) + Send + Sync>;`——资源 crate 既有闭包型监听器；广播在锁内 clone 出列表、锁外逐个调用（:365-379）                                                                                                                             | `crates/chips-resource/src/handle.rs:22,365-379`                                                                                                      | 闭包注入与「锁外回调」两案均有 crate 内先例，方案对比须真实对待（§四 C 案） |
| P3  | `invocation_context`（桥内核唯一在册「供审计」读接口）按 session+request_id 查**在途表**；拒绝发生于在途登记之前（第一段锁判定段 :738-751，在途登记在第二段锁 `admit_concurrency` :765+），拒绝路径不进在途表                                                                            | `crates/chips-bridge/src/bridge.rs:637-659,710`（trace_id 于 :710 生成）；`descriptor.rs:125-143` 注释「宿主适配层…读取完整上下文用于审计与事件追踪」 | 「宿主回读」对拒绝路径结构性不可达（§四 B 案否决主证）                      |
| P4  | 能力执行器经注册结构注入 trait object：`pub executor: Arc<dyn CapabilityExecutor>`；`Bridge` 为 `Clone` 句柄共享 `Arc<Mutex<CoreState>>`，`Bridge::new()` 无参（:322-327）；进程级单例 `static BRIDGE: OnceLock<Bridge>`，`get_or_init(Bridge::new)`                                     | `crates/chips-bridge/src/descriptor.rs:96`、`bridge.rs:294-327`、`packages/native/src/bridge.rs:50,54`                                                | 现有依赖注入形态 = `Arc<dyn Trait>` + 构造/注册期注入（§八直接承袭）        |

### 2.3 文档权威口径（HEAD 版《08.08》《08.07》）

1. §8.1：运行时判定（放行与拒绝）**全量**记录；「审计写入以异步追加执行，写入失败不阻塞调用，但必须记录内部告警；判定耗时不计入能力执行的性能预算」。
2. §8.2：`IPermissionAuditEntry` 字段块 HEAD 实读为 **16 个字段**（`id/timestamp/action/source/actor/pluginId/pluginVersion/sessionId/permission/qualifier/capabilityId/target/resourceUri/reason/traceId/requestId`）。**出入登记**：工单046/勘查报告/立项书行文均作「十七字段」，与 §8.2 代码块实数不符；本文一律以 §8.2 代码块实读字段集为准（字段名逐个照抄），计数措辞请落文波（t046-auditdoc）一并翻正，本 RFC 不沿袭「十七」写死。
3. 裁定二（工单046 §三，登记即生效）：免权限/直通臂未经过授予判定，**不入审计**；「运行时判定」的「判定」以此为限。
4. 《08.07》§7.2:94「判定结果允许时按风险级别决定是否审计」为 HEAD 旧文面，裁定一已翻正为「风险级别决定留存档位、不决定是否记录」，落文随 t046-auditdoc 波——本文按裁定一口径行文。

## 三、裁定总则（五条元规则）

| #   | 总则                                                                                                                            | 依据/先例                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | **素材面/条目面两分**：crate 侧只出「原始判定素材」，§8.2 全字段条目由宿主侧单点组装                                            | `id`（ULID）/`timestamp`/`pluginVersion`/留存档位/脱敏均非 crate 所有（E11/§5.3）；防 ChipsError 型多实现分叉（RFC-ChipsError 判例） |
| G2  | **审计常开、非阻塞、观测不改判定**：observer 的成败、快慢、panic 一律不影响 allow/deny 结果                                     | §8.1「写入失败不阻塞」；工单041「诊断≠审计、审计常开」；cordis P1 panic 隔离先例                                                     |
| G3  | **每判定实现处一挂点、直通豁免**：承接裁定二/裁定三，禁双记录与刷屏                                                             | 工单046 裁定二/裁定三；立项书 §三                                                                                                    |
| G4  | **零自造**：不新增错误码、事件名、能力 ID；字段命名以《08.08》§8.2 与勘查在册名（`DecisionObserver`）为准；三事件发射归宿主段三 | 任务书纪律；E9 登记面已在册                                                                                                          |
| G5  | **只定契约、实施另单**：本文接口定义为契约提案，落地由 RFC 批准后的实施单执行                                                   | 立项书 §二.段四「实施单在 RFC 批准后另立」                                                                                           |

## 四、方案对比与选型

对「crate 侧如何把判定素材送出去」真实对比五路（各案强弱如实陈述）：

| 方案                                  | 内容                                                                                                                      | 优点                                                                                                                                                                                                                | 缺点/风险                                                                                                                                                                                                                                                                                                                                                    | 裁决                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **A. chips-core 统一最小 sink trait** | `chips-core` 新增 `DecisionObserver` trait + `PermissionDecision` 素材结构，两 crate 共用同一类型，宿主实现一次、注入两处 | 单一事实源（reason 五枚举/字段集只定义一份，直接阻断 ChipsError 四份分叉病根在 Rust 侧重演）；两 crate 已共同依赖 chips-core，**零新增依赖边**；trait object 形态与生态在册母型 P1 同族；mock/计数/包装皆可命名实现 | `PermissionDecision` 须为两域并集形状，capability 域与 resource 域各有一批 `Option` 字段（域判别枚举收口）；chips-core 承担一个「观察面」模块，职责面略微加宽                                                                                                                                                                                                | **采纳（推荐）**，形态细节见 §五                                                                                                   |
| A′. 每 crate 各自定义 trait+结构      | chips-bridge、chips-resource 各定一份 sink                                                                                | 各 crate 自洽、字段精确无 `Option` 稀释；零 chips-core 扩面                                                                                                                                                         | 五枚举 reason、§8.2 子集字段两处重复定义，宿主须实现两个 trait 再汇聚——**契约面一分为二正是本生态反复清算的漂移形态**（工单024/013 判例）；后续字段翻正改两处                                                                                                                                                                                                | 否决（G1 违背；A 的并集成本 < 双定义漂移成本）                                                                                     |
| B. 回读/事件帧透出                    | 不加出站接口；宿主经 `invocation_context` 类只读面回读，或在 Bridge→Neon→TS 通道新增「判定帧」                            | 零新 trait；回读案复用在册接口                                                                                                                                                                                      | 回读案**结构性不可达**：拒绝发生在在途登记之前（P3），deny 素材无处回读；事件帧案要为内部观察面扩 Neon 导出与线格式，且把审计细节送进可被插件侧触及的通道，违 §8.4「插件无读写」语义与 G4（不新增事件形态）                                                                                                                                                  | 否决                                                                                                                               |
| C. 闭包注入 `Arc<dyn Fn(..)>`         | 照 `InvalidateListener` 先例（P2）以匿名闭包注入                                                                          | crate 内**有在册先例**、实现成本最低；测试注入一行搞定                                                                                                                                                              | 闭包类型无名字、不可下钻实现多成员（后续若加 flush/批量面即改签名）；携带并集素材结构仍需先定义类型——即 C 只省掉 trait 一层壳，素材类型面与 A 完全同成本；匿名性削弱契约文档可指认性                                                                                                                                                                         | 不作正式面采纳；**吸收进 A**：随 trait 提供 `FnDecisionObserver<F>` 闭包便利包装（P1 `FnEventSink` 同族先例），测试/轻量适配走此面 |
| D. tracing subscriber 桥接            | 两 crate 引入 `tracing`，判定处以结构化事件发射，宿主注册 subscriber 桥到审计                                             | 与诊断域统一工程面；宏级编译门控；Rust 生态通用                                                                                                                                                                     | E1 实测两 crate 零 tracing 依赖、workspace 依赖表无之——为观察面给整个 Rust 侧新增长期运行时依赖（AGENTS 依赖引入须选型评估，属架构变更级）；tracing 事件是 `level+target+动态字段` 弱类型面，§8.2 字段契约锚不住（G1/G4）；subscriber 进程级全局注册，crate 多实例/集成测试隔离别扭；「诊断可关、审计常开」口径与 level 过滤门控天然冲突（工单041 判例同族） | 否决（若未来日志面 RFC 另有需要，届时议，不预挂）                                                                                  |
| E. 复用 cordis 事件总线               | chips-bridge/chips-resource 直接 `Kernel::emit`（P1 总线）                                                                | 总线现成、FIFO/深度受限/错误隔离已建                                                                                                                                                                                | 见第七节：总线服务的是**内核插件运行时事件面**（快照隔离、JS 订阅者可见），与平台内部审计面是两个语义平面；两 crate 引入 chips-cordis 依赖 = 新增跨层依赖边，能力/资源核心被拖入内核运行时层                                                                                                                                                                 | 否决（只借形态，不接总线）                                                                                                         |

**选型结论**：方案 A（chips-core 统一最小 `DecisionObserver` trait + 素材结构），闭包形态按 C 的教训收编为便利包装器，panic/线程语义按 P1 母型对齐（§六），依赖关系零新增（§七）。

## 五、裁定一：`DecisionObserver` 接口形态与 §8.2 对齐

### 5.1 定义位置与 trait 契约（提案形态，实施另单）

定义落 `chips-core`（新模块，如 `crates/chips-core/src/audit.rs`，命名实施单定），两 crate 与 `chips-native`/宿主 Rust 侧统一 `use`。**本 RFC 不改动任何文件，以下签名为契约提案，批准后由实施单逐字落地并同步《核心接口规范》**：

```rust
/// 判定域：能力调用（chips-bridge）或资源访问（chips-resource）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecisionDomain {
    /// 能力权限判定（Bridge.admit 权限段）。
    Capability,
    /// 资源作用域判定（ResourceManager.resolve → PermissionChecker.decide）。
    Resource,
}

/// crate 侧判定结果。grant/revoke 属链路二宿主动作，不经本观察面（工单046 裁定二/§8.2 PermissionAuditAction 的宿主子集）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecisionAction {
    /// 经过授予判定且放行。
    Allow,
    /// 判定拒绝。
    Deny,
}

/// 权限拒绝原因（五值全型；现行 crate 产生三值，revoked/user_rejected 随链路二翻正）。
/// 实施波将 chips-resource/src/error.rs:172-182 的定义上移本处，
/// chips-resource 以 `pub use` 别名收口，serde 线上取值（snake_case 小写）零变化。
pub enum PermissionDenyReason {
    NotGranted,
    Revoked,
    OutOfScope,
    UserRejected,
    Policy,
}

/// 权限判定出站素材：《08.08》§8.2 条目中「判定现场可得」字段的子集（对齐表见 §5.3）。
/// 纯数据；不带 serde derive（跨 Neon 边界的序列化归实现方 observer，见 §八）。
#[derive(Debug, Clone)]
pub struct PermissionDecision {
    pub domain: DecisionDomain,
    pub action: DecisionAction,
    /// 触发插件 ID（bridge：会话快照 `plugin_id`；resource：`session.owner`）。
    pub plugin_id: PluginId,
    /// 判定所在会话（chips-core `SessionId = u64`；§8.2 `sessionId` 字符串化归宿主组装面）。
    pub session_id: SessionId,
    /// 判定基础权限 ID。deny = 首个缺失项（与 `denied_error`/`denied()` 短路口径同值）；
    /// allow = `required` 声明序首项（§5.4 粒度裁定）。
    pub permission: String,
    /// 本次判定核对的所需权限全集（bridge：descriptor_permissions；resource：该臂 required）。
    pub required: Vec<String>,
    /// 缺失全集；allow 臂恒空（与 E3 details.missing、E4 错误载体同型）。
    pub missing: Vec<String>,
    /// deny 必携；allow 恒 None。
    pub reason: Option<PermissionDenyReason>,
    /// domain=Capability 时的目标能力 ID；Resource 域恒 None。
    pub capability_id: Option<String>,
    /// domain=Resource 时的规范资源 URI（§8.5 脱敏在宿主写入侧，crate 出原值）；Capability 域恒 None。
    pub resource_uri: Option<String>,
    /// domain=Resource 的判定目标（现 `denied()` 的 `chips-resource://<scope>/` 形态，E4）；可缺省。
    pub target: Option<String>,
    /// 判定现场的 crate 内请求/追踪关联键（bridge 有、resource 无），见 §5.4。
    pub request_id: Option<String>,
    pub trace_id: Option<String>,
    /// 限定值槽：§8.2 `qualifier`。crate 侧限定值细粒度判定未交付（E8 :279 集成缺口在册），
    /// 现行实现恒 None；能力接线后经本字段透出，trait 与结构不变（面向未来扩展预留）。
    pub qualifier: Option<String>,
}

/// 权限判定出站观察面（工单046 裁定三.4 委托的「跨 Rust/TS 边界观察面」契约）。
/// 宿主装配根实现、crate 构造期注入（§八）；形态比照 chips-cordis `EventSink`（P1）。
pub trait DecisionObserver: Send + Sync + 'static {
    /// 判定收敛后在判定线程同步调用一次。素材按引用交出，实现方按需深拷贝；
    /// 禁阻塞、panic 隔离、锁纪律见 §六。无返回值：观察失败永不回传判定面（G2）。
    fn on_permission_decision(&self, decision: &PermissionDecision);
}

/// 以闭包实现的 `DecisionObserver`；用于测试与轻量适配（`FnEventSink` 同族，P1）。
pub struct FnDecisionObserver<F>(F);
```

（`NoopDecisionObserver` 空实现随波提供，供 crate 集成测试默认注入；不改变「构造必显式注入」的裁定，见 §八。）

### 5.2 「素材面而非条目面」裁定

**裁定：crate 侧只出原始判定素材，不出 §8.2 全字段条目。** 三条硬依据：

1. **能力位缺失**：`id`（ULID）在生态内唯一现成供给是 chips-cordis `UlidGenerator`，`pub(crate)` 不出 crate 且两目标 crate 不依赖 cordis（E11）；`timestamp` 同款（cordis `now_ms` 亦 `pub(crate)`）；`pluginVersion` 不在两 crate 任何会话结构内（E4/E6 的 session 记录字段实测无版本位）。
2. **策略位归属**：留存档位（高/极高风险 365 天）、§8.5 脱敏、append-only 落盘均为宿主写入器（立项书段二）策略面，下沉 crate 即双事实源。
3. **规范面防漂移**：§8.2 条目类型的唯一事实源已由立项书段一钉给 `@chips/bridge` 协议层（TS 侧）；Rust 素材结构是**其子集映射的输入**，不是第二份条目类型——素材字段名逐个取自 §8.2 词表（snake_case Rust 惯例），杜绝「第三型」并存（勘查 #3 教训）。

### 5.3 §8.2 十六字段 × 素材对齐表（权威映射）

| §8.2 字段       | 产出侧    | 映射                                                                                                                                                             |
| --------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | 宿主      | 段一 ULID 供给面（立项书段一），crate 不产                                                                                                                       |
| `timestamp`     | 宿主      | 写入时刻 ISO 8601 UTC                                                                                                                                            |
| `action`        | **crate** | `allow`/`deny`（素材 `action`）；`grant`/`revoke` 为链路二宿主动作，不经本观察面                                                                                 |
| `source`        | 宿主      | 运行时记录缺省（§8.2 表注）                                                                                                                                      |
| `actor`         | 宿主      | 运行时判定恒 `system`（§8.2 表注）                                                                                                                               |
| `pluginId`      | **crate** | 素材 `plugin_id`                                                                                                                                                 |
| `pluginVersion` | 宿主      | crate 会话结构无版本位（§5.2 条 1）；宿主授权/会话权威侧补挂                                                                                                     |
| `sessionId`     | **crate** | 素材 `session_id`（`u64`）；字符串形态转换归宿主组装面（与三事件 payload 消费方一致即可）                                                                        |
| `permission`    | **crate** | 素材 `permission`；deny=首缺项、allow=声明序首项（§5.4）                                                                                                         |
| `qualifier`     | （预留）  | 素材 `qualifier` 恒 None 至限定值判定交付（§5.1 槽注），经同接口翻正                                                                                             |
| `capabilityId`  | **crate** | 素材 `capability_id`（Capability 域）；Resource 域条目由宿主按调用现场补挂或留空                                                                                 |
| `target`        | 双侧      | Resource 域 crate 出（素材 `target`）；Capability 域的「路径/域名/窗口 ID」需解读 input，crate 不做语义解读，宿主消费者按能力域补齐                              |
| `resourceUri`   | **crate** | 素材 `resource_uri`（原值；§8.5 脱敏在宿主写入前执行）                                                                                                           |
| `reason`        | **crate** | 素材 `reason`（deny 必携；§8.2 `PermissionDenyReason` 五值对齐，snake_case 同词表）                                                                              |
| `traceId`       | 双侧      | bridge 域 crate 出（`admit` :710 生成的 `trace_id`）；resource 域 crate 无 → 宿主以段一横切 `InvocationContext.traceId` 贯通链补（禁另造关联键，立项书段一口径） |
| `requestId`     | 双侧      | bridge 域 crate 出（`BridgeRequest.request_id`）；resource 域无 → 宿主调用现场补                                                                                 |

（附加素材 `required`/`missing` 两字段对应 `denied_error` details 在册载体（E3/E4），供宿主组装与三事件 payload 校验，不落 §8.2 条目——§8.2 无此二字段，本 RFC 不扩条目形状，G4。）

### 5.4 记录粒度与关联键裁定

1. **一次判定一条素材**：Capability 域以「一次 `request` 的权限段收敛」为单位（多权限合并核对，deny 携首缺项 + `missing` 全集，与 E3 `evaluate` 短路+全量缺失口径逐字同型）；Resource 域以「一次 `resolve` 的 `decide()` 收敛」为单位。
2. **allow 臂 `permission` 取值**：§8.2 该字段未锁多权限 allow 场景文面，本裁定为其权威解释——取 `required` 声明序首项（与短路判定同一序），其余所需权限经 `required` 素材可回溯；此口径随实施波请落文波在《08.08》§8.2 补注。
3. **关联键双轨**：crate 素材 `trace_id/request_id` 是 **Rust 侧现场关联键**（bridge 独有）；段一 JS 横切 `traceId` 为最终条目字段取值源之一的裁决归段一/段三接线，本 RFC 仅保证接口面可容纳双键（实施时禁在 crate 侧做键优先级判断——那是宿主组装面职责，G1）。

## 六、裁定二：回调线程语义（拒绝热路径禁阻塞）

1. **同步调用、判定线程**：`on_permission_decision` 在判定收敛的调用线程上同步执行（bridge：`request` 所在 tokio 工作线程；resource：`resolve` 调用线程）。不引入 crate 内线程/异步派发——审计投递的异步化（含跨 Neon 边界）全部发生在 observer 实现内。母型即 cordis 总线头注口径「Rust 监听器在发布线程内同步调用，入队后立即返回」（P1）。
2. **实现方预算约束（禁阻塞硬规）**：observer 实现只允许「拷素材 → 入有界队列 → 立即返回」级别的工作；**禁止**同步 IO（文件/网络）、禁止等待 JS/Promise 完成、禁止获取任何可与判定面反向成环的锁、禁止调用回本 crate 判定/注册面（观察不回灌，防死锁与语义环）。**允许**的有界动作：有界环形队列 push（满则丢 + 计数）、纯内存聚合。队列容量、drain 策略与 dropped 告警载荷归宿主 observer 实现（`host-trace.ts` dropped+onFault 母型，勘查 #8），非 crate 契约面。
3. **panic 安全**：crate 侧以 `catch_unwind(AssertUnwindSafe(|| observer.on_permission_decision(&d)))` 包裹调用（P1 :248 先例）——observer panic = 该条素材丢失，**判定结果与错误返回不受任何影响**（G2）；crate 侧不重试、不上报错误码（不新增码，G4）；丢失可见性由实现方 dropped 计数承载。
4. **锁纪律**：observer 调用点一律处于 crate 核心锁外。bridge：权限判定段本就在第一段锁释放后（:738 注释「锁外完成」在册），allow 素材在判定收敛处（:745 判空后、Schema 校验前）发出，deny 素材在 `return Err` 前发出——两处均不持 `CoreState` 锁；且 allow 在并发准入（:762+ 第二段锁）之前即发出，判定事实与后续准入结果解耦（§8.1 记录的是「判定」）。resource：`decide()` 纯函数于 manager 各注册表锁外（E6 调用点实测），observer 调用在 `into_result()` 收敛处、同锁外（P2 clone-out 先例同族约束）。**实施单验收必含**：锁内调用即红的静态/动态检查（ observer 内回调 crate 读接口不死锁用例）。
5. **无返回值**：`-> ()`。若定 `Result` 就逼判定面处理观察失败（或徒增丢弃样板），与 G2 冲突；对照 TS 面 `writeAudit` try/catch 吞失败同型语义（E10）——Rust 侧该职责由 panic 包裹 + 无返回值签名承担。
6. **热路径开销验收**：段四实施单须以 criterion bench（workspace 已有 criterion 依赖，core-rust Cargo.toml:19）锁「注入 observer 前后 admit/resolve 路径耗时增量」回归基线，并锁「observer 实现为有界入队」的 E2E 用例；本 RFC 不预造具体 µs/百分比预算数。

## 七、裁定三：与 cordis 事件面的关系

1. **对象澄清（memory 口径在册）**：`cordis-main/`（工作区根）是**不入库参考仓**（根 `.gitignore:61 cordis-main/`，「有意不入库」为 W1 检查点提交口径 memory），不是本生态实施对象；入库的是 `crates/chips-cordis`（内核运行时 crate，chips-ecosystem 工作区内）。本节「事件面」指 chips-cordis 的 `event.rs` 总线。
2. **裁定：不复用内核事件总线，独立最小接口；只借形态**。理由三条：
   - **平面不同**：总线是「内核唯一事件源与投递中枢」，监听器含 JS 插件订阅者、受快照隔离/深度受限/可见性投递约束（P1 头注）；权限审计是平台内部 append-only 观察面，§8.4 明令插件无读写。把 deny 素材发进总线等于给内部信号找了一条插件可达路径，语义倒挂。
   - **依赖方向**：`chips-bridge`/`chips-resource` 现均不依赖 `chips-cordis`（E1 Cargo.toml 实测）；为观察面新增「能力/资源核心 → 内核运行时」依赖边，是跨层直连性质的架构退化，AGENTS 红线方向。
   - **注册语义**：总线 `emit` 面向命名事件与订阅集，权限审计素材是**无条件出站流**，无订阅/退订生命周期可言，套总线模型只剩 `emit` 一个方法——届时还不如直连 trait。
3. **与标准事件面的分工**：《08.08》§8.3 三事件（`permission:granted`/`permission:denied`/`security:audit`，登记面 E9）是**宿主 TS 标准事件面**的广播契约，其生产者唯一归宿主（立项书段三发射位）；crate observer 素材只是宿主组装条目与事件的**上游输入**。crate 侧禁直接产任何标准事件（G4）。
4. **形态承袭登记**：本 RFC 的 trait 形态（`Send + Sync + 'static` 单方法 + `Fn*` 便利包装 + panic 隔离）逐项比照 `EventSink` 母型（P1），使生态内「跨边界 sink」只有一种方言。

## 八、裁定四：注入位与生命周期

比照 chips-bridge 现有依赖注入形态（P4：`Arc<dyn Trait>`、构造/注册期注入、`Clone` 句柄共享）裁定：

1. **构造期注入、终身不可换**（无 setter、无热替换——审计观察面不得存在无观察窗口；v1 未发布无兼容包袱，AGENTS 口径）：
   - `chips-bridge`：`Bridge::new()`（:322）签名改为 `Bridge::new(observer: Arc<dyn DecisionObserver>)`；observer 为 `Bridge` 结构上的兄弟字段（与 `trace_counter` 同层，`Clone` 句柄天然共享同一实例），**不入 `CoreState`**（避免与判定锁纠缠，§六条 4）。
   - `chips-resource`：`ResourceManager::new(limits)`（manager.rs:176）扩为 `new(limits: ResourceLimits, observer: Arc<dyn DecisionObserver>)`，`Default` 实现随实施波收口（v1 不留默认无观察形态）。
   - 测试面：`NoopDecisionObserver`/`FnDecisionObserver` 显式注入（P1 `FnEventSink` 用法同族）。
2. **谁构造 observer、经何路径注入**（装配链自下而上）：
   - **实现方唯一**：`chips-native`（Neon 绑定层）实现一个 `DecisionObserver`，把素材序列化为 JSON 经非阻塞 Neon Channel 抛给宿主主进程 TS 消费函数（入队即返回，§六条 2 的「跨边界」预算形态）。TS 消费函数由宿主主进程提供（条目组装→段二写入器 + 段三三事件发射）。
   - **注入路径**：native 进程级单例构造翻正为 `BRIDGE.get_or_init(|| Bridge::new(native_observer))`（现 :50-54 `get_or_init(Bridge::new)`）；`ResourceManager` 同理由 `chips-resource` 接线波（025 主线/#151 收口后的挂接单）在构造处注入**同一** observer 实例——两 crate 素材流汇入宿主同一消费点，是 §九「单条目单落点」的结构保证。
   - **生命周期**：observer 随宿主运行时组合根启动构造（工单025 激活链窗口）、先于首次能力/资源请求完成注入；其 drain/flush 收口（退出期落盘完整性）绑段二写入器的 flush 语义；crate 不持线程、不感知关闭。
3. **Rust 素材 → TS 条目的序列化边界登记**：素材过 Neon 的 JSON 键名取 §8.2 camelCase 词表直译（`pluginId`/`capabilityId`/`resourceUri`/`requestId`/`traceId` 等），使段一 TS 契约类型与 Rust 素材字段一一锚定、锁测可查；该键表随实施单落地（本 RFC 不定 TS 代码）。

## 九、裁定五：挂点唯一性与段三宿主挂点的分工界线

### 9.1 判定实现点—挂点分工矩阵（全生态唯一账）

| 判定实现点（HEAD 在册）                                                                                                                | 现行状态                                 | 审计挂点                                        | 挂波                                       |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| 宿主 TS `createHostCapabilityRouter` 权限臂（`packages/host/src/runtime/capability/router.ts:85-98`，判定实现在 `session.ts:281-296`） | **内核接线前唯一生效判定面**             | 宿主 `audit` 注入位（挂点加在判定臂，构造注入） | 立项书段三（046 A.1）                      |
| `chips-bridge` `admit` 权限段（`bridge.rs:738-751`）                                                                                   | 生产流量 0（宿主未接内核，工单025 在册） | 本 RFC `DecisionObserver`                       | 段四实施单                                 |
| `chips-resource` `PermissionChecker.decide`（`manager.rs:336-345`）                                                                    | 生产接线随资源域波（#151 落盘为准）      | 本 RFC `DecisionObserver`                       | 段四实施单（可随段三捆绑单挂点，勘查 A.2） |
| `@chips/bridge` 包 `createBridgeRouter` audit 钩（`router.ts:56,141-150`）                                                             | 生产调用方 0                             | **不挂任何新钩**；随裁定三「二选一收口」处置    | 段三前置                                   |

### 9.2 禁双记录裁定（裁定三在本 RFC 的落地形态）

1. **结构唯一性**：同一判定在任一时点只有一个实现点在跑——接线前判定在宿主 TS 臂（crate 侧零流量，observer 自然静默）；工单025③ 判定面统一翻转后，宿主臂退役为纯转发（其 TS 判定不再执行，段三挂点随宿主臂收口或显式移除，段三波内裁决），判定唯一点移至 `bridge.admit`，observer 成为该调用链唯一产生源。**两挂点永不同代共存同一判定的执行路径**，双挂禁止由判定面翻转的单点结构自动保证，本 RFC 不再造防重键（禁另造关联键，立项书段一口径）。
2. **单条目单落点**：宿主侧 observer 消费点与段三 `createHostCapabilityRouter` audit 注入位**必须接同一审计 writer/条目组装器**（同一 `IPermissionAuditEntry` 组装函数、同一写入器实例），保证「判定面换轨、审计面不换轨」；三事件发射唯一发生在该组装器下游（段三），crate 侧与 observer 实现内部禁直接发事件（§七条 3）。
3. **bridge 域与 resource 域天然不同判定**：一次能力调用若既过 `admit` 权限判定、其执行器内部又触达资源 `resolve` 判定，属**两条不同判定事实**（能力授权 vs 资源访问），各记一条不构成双记录——矩阵按「每判定实现处一挂点」（G3）而非「每调用一挂点」。

### 9.3 crate 侧覆盖的、宿主 TS 判定链达不到的路径（本 RFC 存在的理由）

1. **资源域全部判定**：宿主 TS 从未有资源权限判定复制（矩阵第三行；判定权威在 chips-resource 作用域×操作矩阵），七类作用域 allow/deny 连同 `out_of_scope`/`policy`/`not_granted` 三值 reason 只在 crate 内可见——不经 crate 观察面，§8.1「判定全量」在资源域恒不可达。
2. **内核接线后的能力域拒绝臂**：`bridge.rs:745-751` 的 deny 发生在在途登记前（P3），宿主既有的 `invocation_context` 回读面不可达；observer 是拒绝素材的唯一出站通道，亦是「拒绝热路径」性能与语义约束（§六）的存在理由。
3. **免权限直通豁免在 crate 侧生效**（裁定二翻正到挂点行为）：`platform()` 只读恒放行（`permission.rs:216-227` Read 臂）、`plugin()` 自身作用域读（:192-195）、`document()` 会话绑定免重复校验（:146-151 session_bound 放行臂）**三臂不发 observer 信号**；deny 臂（含 `Policy` 类拒绝，如 platform 写 :219-224）一律全发。bridge 域无直通臂（一切判定皆过集合匹配），全 allow/deny 皆发。直通不发射为实施单锁测项（立项书段三「锁测该不记录臂」口径移植到 crate 侧）。

## 十、影响范围与版本

- **受影响子系统**（全部为实施另单动作，本 RFC 零改动）：`chips-core`（新增观察面模块，纯增量）、`chips-bridge`/`chips-resource`（构造签名 + 锁外发射点）、`chips-native`（observer 实现 + Neon 通道 + 单例构造翻正）、`packages/host`（TS 消费函数/条目组装接段二 writer、段三事件发射）、`tests/contract`（素材键表 ↔ §8.2 字段锁测）、文档面（见 §10.2）。插件面、`window.chips.*` 面、IPC 线格式零变化。
- **三类版本**：`CORE_ABI_VERSION` 不变——比照 RFC-chips-bridge 裁定三·3 引《核心接口规范》§9.2 判例「crate 之间的 Rust 函数签名不属于 ABI」；本 RFC 不触 Neon 导出面，后续实施若扩导出按 §8.6 规则「新增导出同时更新总表与对应子系统文档，不递增 ABI 版本」。平台统一版本/`chip_standards_version` 与本 RFC 无涉（纯文档裁定稿）。
- **错误码/事件名/能力 ID**：零新增、零修改（G4）；三事件登记面（E9）维持原样。
- **文档面（实施/落文波承接，本波不动文档库红区）**：①《08.08》宜在 §8.1 或新 §8.6 收录「crate 侧采集接口」契约指称（本 RFC 批准后由文档波落文）；② §8.2 字段数措辞翻正（§2.3 条 2 出入登记）+ allow 粒度补注（§5.4 条 2）；③《03-核心接口规范》随 §5.1 接口落地扩登记（比照 RFC-chips-bridge 发布面收编惯例）。

## 十一、实施与验证（实施归后续另单）

1. **裁定F（主智能体，2026-09-21）**：本 RFC 五议题照案批准——方案 A（chips-core 统一最小 `DecisionObserver`）、素材面/条目面两分、回调线程语义（同步调用+有界入队即返回+panic 吞+锁外）、不复用 cordis 总线只借形态、构造期注入终身不可换、挂点矩阵与禁双记录结构保证。实施单在批准后另立（§十一.2 切分采纳）；「十七字段」措辞出入经主智能体实读复核采信（§8.2 代码块逐名清点为 16），立项书/勘查报告/任务说明五处计数已机械翻正。
2. **实施单切分建议**（细节归实施单，此处仅登依赖）：核心 crate 波（chips-core 类型 + 两 crate 挂点与构造翻正 + crate 测试：直通臂不发射锁测、panic 注入用例、锁外纪律用例、bench 回归）与接线波（native observer + Neon 通道 + 宿主 TS 消费函数；与工单025③/段三捆绑单错峰，宿主面串行纪律）。chips-resource 挂点项与 #151 落盘验收并轨（勘查 A.2/立项书段四在册口径）。
3. **验收锚点清单**：(a) §5.3 对齐表逐字段锁测（Rust 素材键 ↔ §8.2 条目/三事件 payload 快照）；(b) 双判定面换轨期「同一调用链至多一条素材」E2E（§九 9.2-1）；(c) observer 实现仅入队、drain 侧 dropped 计数告警可观测（§六条 2）；(d) 直通三臂零发射（§九 9.3-3）；(e) §2.1 E1 复跑：除实施单授权引入外，两 crate 依赖表维持无 tracing/log（防方案 D 借道复活）。
4. **评审结论**：待裁。若主智能体/用户认为「跨层观察面接口归属 chips-core」值得独立决策留痕，可取材 §四/§五补 ADR（比照 RFC-chips-bridge 第八节 3 预留口）。

## 十二、变更记录

| 版本   | 日期       | 变更                                                                                    |
| ------ | ---------- | --------------------------------------------------------------------------------------- |
| v1.0.0 | 2026-09-21 | 初稿（W3-P0-3 段四 RFC 撰写波，任务 #153）：五议题裁定提案 + 方案对比 + HEAD 基线核证账 |
| v1.0.1 | 2026-09-21 | 主智能体裁定F签批：五议题照案采纳，状态草稿→批准；§十一.1 翻正为裁定记录（含 16 字段出入采信与计数翻正登记）；实施单另单随派 |

---

**文档结束**
