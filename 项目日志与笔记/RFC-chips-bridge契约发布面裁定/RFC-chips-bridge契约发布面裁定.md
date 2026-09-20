# RFC-chips-bridge 契约发布面裁定（工单026 收编：`impl Bridge` 公开成员 → 《核心接口规范》§5 / 《能力契约规范》§4.4 发布面）

> 版本：v1.0.0
> 日期：2026-09-20
> 状态：已实施（本 RFC 为纯文档面裁定；配套契约文档同步已随本波落地，待主智能体统一验收）
> 关联：工单026（本单权威任务说明）、工单005 §4.4 残口收口记录（任务 #33/b44 代际接管落地依据）、工单025（宿主激活与会话通道，本裁定为其提供契约接线口径）、`task043《契约-代码漂移审计-2026-09-20》` 面 3 第 5 条与面 5 第 2 条（系统性结论 C：「内核可测、但宿主不可接」）、RFC-SDK 主入口 CLI 面收口（同类公共资产先 RFC 后落地的波次先例）

---

## 一、背景与动机

《核心接口规范》§5 登记的 `impl Bridge` 公开面只有 4 方法（`register`/`unregister` 见 `03.05-03-核心接口规范-五、Bridge（chips-bridge）.md:83-90`，`request`/`cancel_session` 见 `:124-130`）；《能力契约规范》§4.4 只发布「行为与触发表」，不发布 Rust 侧接口名与签名。而 `chips-bridge` crate 实测交付的 `impl Bridge` 公开方法已 17 个（`bridge.rs` 实测 2026-09-20：`pub fn` 16 个 + `pub async fn request` 1 个），`lib.rs:100-104` 另再导出 3 类型与 5 策略常量。契约未发布这批成员即被内部依赖，等价于以 crate 源码为事实上的公共 API；宿主（工单025 装配面）与绑定层无从依据契约接线。

本 RFC 对全部公开成员逐一点名裁定，并把裁定为正式发布面的成员补入契约文档。**本单零代码改动**：`crates/chips-bridge`、`packages/native`、`packages/bridge`、`packages/host`、`packages/cli`、`packages/sdk`、`crates/chips-parser` 全部只读。

统计口径说明（登记漂移观察，不构成新问题）：工单026 登记的「15 个 `pub fn`」为登记时点 grep 快照，未含 `Bridge::new`（构造）与 `Bridge::request`（`pub async fn`，grep `pub fn` 不命中）；本轮实测公开成员合计 **25 项**（17 方法 + 3 类型 + 5 常量），逐成员裁定见第四节。

## 二、调用方面（消费点实测，2026-09-20 全 workspace grep）

1. **唯一 crate 外 Rust 消费者是 `packages/native`**（`packages/native/Cargo.toml` 依赖 `chips-bridge`；workspace 内其余 crate 均不依赖）。绑定层**生产路径**只消费 4 个契约在册方法：
   - `bridge.rs:484` `register`、`:493` `unregister`、`:522` `request`、`:539` `cancel_session`；
   - `bridge.rs:41-44` 进程级单例经 `Bridge::new` 构造。
   其余方法在 native 生产路径 **0 调用**。
2. **测试/示例消费点**：`packages/native/src/bridge.rs:546-655` 测试模块使用 `activate_provider`、`has_capability`、`ProviderKind`、`ProviderRegistration`、`DEFAULT_TIMEOUT_MS`、`DEFAULT_MAX_QUEUE`、`KERNEL_INVALID_TRANSITION`；`crates/chips-bridge/src/lib.rs:20-87` crate 文档示例使用 `activate_provider` + `open_session` + `register` + `request` 全链；`crates/chips-bridge/tests/`（11 个集成测试文件）覆盖其余成员（调用文件数：`grant_capability_id` 2 文件、`deactivate_provider` 2、`begin_draining` 2、`takeover_register` 1、`close_session` 4、`shutdown` 4、`is_shutdown` 2、`invocation_context` 3、`capability_state` 2）。
3. **TS 侧 0 消费**：`packages/host/src`、`packages/bridge/src` 全量 grep `activateProvider|openSession|beginDraining|takeover` 0 命中；宿主激活与会话通道缺位是工单025 的登记面（本 RFC 不扩大）。
4. **机器可读面**：`tests/contract`（含 `src/code/bridge.ts`）与 `tools/contract-gen` 登记的是 TS `@chips/bridge` 能力/权限/事件/错误码事实与文档表格解析面，**不存在任何 Rust 侧 `impl Bridge` 成员名清单**；`packages/native/abi/export-surface.json` 登记的是 Neon 导出面（`§8.6` 总表，Bridge 域现仅 4 导出）。因此本裁定**不产生机器可读清单待改项**；绑定层扩展导出面属后续接线工单（见第五节 3）。

## 三、裁定口径（三条总则）

1. **收编判据**：成员若承载契约文档已发布的行为承诺（《能力契约规范》§4.2 校验项、§4.3 编目、§4.4 触发表、§9.1/§9.3/§10.1、《02-Bridge三层设计》§4.2 注册与注销、§7.4 会话、§8.2 取消来源、《08-权限系统设计》§7.6/§8.2），或为宿主/适配层端到端装配的必需前置（工单025 证据链），即收编为正式发布面——本单是把「契约已有行为」补上「接口名与签名」的可执行化，**不新增任何语义、不改任何签名、不新增错误码**。
2. **不产生私有化处置**：除 `is_shutdown` 外全部成员按总则 1 收编；`is_shutdown` 为测试 hook（`pub` 是集成测试可达性的硬要求，改私有会破坏测试面），裁定为**非契约面**登记，无后续私有化工单。
3. **ABI 边界**：本裁定只动《核心接口规范》§5 与《能力契约规范》§4 的 Rust 契约发布面；§8.6 Neon 导出总表零改动。§9.2 明示「crate 之间的 Rust 函数签名不属于 ABI」，发布面收编不触发 `CORE_ABI_VERSION`；后续若为宿主接线新增 Neon 导出（第五节 3），按 §8.6 规则「新增导出同时更新总表与对应子系统文档」，且**删除或改签名才递增** ABI 版本。

## 四、逐成员裁定表（25 项实测全量）

行号以 2026-09-20 实测为准：`bridge.rs`/`lib.rs`/`constants.rs` 位于 `chips-ecosystem/packages/core-rust/crates/chips-bridge/src/`，`native/bridge.rs` 位于 `chips-ecosystem/packages/native/src/bridge.rs`。契约简称：**核心§**=《03-核心接口规范》（03.05 分件），**契约§**=《04-能力契约规范》，**三层§**=《02-Bridge三层设计》（01-架构设计/01-子系统设计），**权限§**=《08-权限系统设计》。

### 4.1 方法（17）

| # | 成员与签名（实测 `bridge.rs` 行号） | 用途 | 调用方证据 | 裁定 | 依据 |
|---|---|---|---|---|---|
| 1 | `pub fn new() -> Self`（:322） | 构造内核句柄（`Clone` 共享同一 `Arc<Mutex>` 状态） | native `bridge.rs:41,44` 进程级单例 `BRIDGE.get_or_init(Bridge::new)`；crate 文档示例 `lib.rs:49` | 正式发布面（新收编） | 核心§2.2 规则 2 要求 `Clone` 句柄形态，构造入口必须随句柄发布；核心§5.4 登记 |
| 2 | `pub fn activate_provider(&self, registration: ProviderRegistration) -> Result<(), ChipsError>`（:334） | 登记并激活提供方；manifest 申请集合入内核 | native 测试 `:614`；crate 文档示例 `lib.rs:50`；测试/示例合计高频（crate 内 69 处调用）；工单025 判「未激活即注册必败」 | 正式发布面（新收编） | 核心§5.1 注册校验「`owner` 已激活」；契约§4.2 校验项 7（`KERNEL_INVALID_TRANSITION`）；三层§4.2 注册触发表；权限§7.6 授权变更重建（重复激活覆盖） |
| 3 | `pub fn deactivate_provider(&self, owner: &str)`（:363） | 停用提供方：注销其全部能力并在途按取消收口；幂等 | crate 测试 2 文件；宿主插件生命周期接线待工单025 | 正式发布面（新收编） | 三层§4.2 注销行「服务插件 `stop` 前、平台退出时」；契约§4.4 触发表「stop/停用/卸载」「崩溃/Fork dispose」——批量撤销是这两行的唯一成对入口（`unregister` 单点注销不覆盖「提供方整体停用」语义） |
| 4 | `pub fn grant_capability_id(&self, capability_id: &str, owner: &str) -> Result<(), ChipsError>`（:384） | 第三方能力 ID 登记并绑定提供方 | crate 测试 2 文件；平台评审流程经适配层（文档示例未含，属装配面） | 正式发布面（新收编） | 契约§9.1「登记前置…登记后 ID 与提供方绑定」；契约§4.2 校验项 2（登记绑定与 owner 一致，`BRIDGE_CAPABILITY_CONFLICT`）；三层§4.2「ID 已登记且绑定 owner」 |
| 5 | `pub fn register(&self, registration: CapabilityRegistration) -> Result<(), ChipsError>`（:420） | 注册能力 | native 生产 `:484` | 正式发布面（契约在册，零改动） | 核心§5.1（`:83-90`） |
| 6 | `pub fn takeover_register(&self, registration: CapabilityRegistration) -> Result<(), ChipsError>`（:434） | 蓝绿代际接管注册（同 owner 定义覆盖；跨 owner 拒绝） | crate 测试 1 文件（b44 收口 10 用例） | 正式发布面（新收编） | 契约§4.4 触发表「蓝绿更新代际切换」；契约§9.3「唯一允许的同 ID 覆盖」；契约§10.1 状态机「active──代际切换──▶draining」；工单005 §4.4 残口收口记录（行为已交付并被测试锁定，缺的只是名字） |
| 7 | `pub fn unregister(&self, capability_id: &str) -> Result<(), ChipsError>`（:543） | 注销单个能力；幂等 | native 生产 `:493` | 正式发布面（契约在册，零改动） | 核心§5.1（`:87-89`）；契约§4.4 |
| 8 | `pub fn begin_draining(&self, capability_id: &str) -> Result<(), ChipsError>`（:562） | 使旧代际进入 `draining`；幂等 | crate 测试 2 文件 | 正式发布面（新收编） | 同 #6；契约§10.1 draining 行「拒绝新调用；在途调用完成或按超时收口」；契约§11.2「`draining` 后的新调用按 `BRIDGE_CAPABILITY_NOT_FOUND`」 |
| 9 | `pub fn open_session(&self, session: SessionId, plugin_id: PluginId, granted_permissions: Vec<String>) -> Result<(), ChipsError>`（:582） | 登记会话快照（授权集合 + 插件 ID） | crate 文档示例 `lib.rs:67`；crate 测试 51 处调用；工单025 判「会话未登记则 `request` 必 `BRIDGE_SESSION_UNKNOWN`」 | 正式发布面（新收编） | 三层§7.4「会话由插件运行时在创建窗口/表面时向 Bridge 层登记」；核心§5.2 阶段表「会话校验」；契约§4.2 校验项 7 的会话侧；权限§7.6 快照重建（同 ID 重新登记即覆盖） |
| 10 | `pub fn close_session(&self, session: SessionId)`（:605） | 关闭会话：拒绝新调用并取消在途；幂等 | crate 测试 4 文件 | 正式发布面（新收编） | 三层§7.4「会话关闭后拒绝全部新调用（`BRIDGE_SESSION_UNKNOWN`），在途调用取消并丢弃结果」+ 清理时机（窗口销毁、插件停用、应用退出）；三层§8.2 取消来源 1 |
| 11 | `pub fn cancel_session(&self, session: SessionId)`（:611） | 取消会话全部在途调用；会话保持可用 | native 生产 `:539` | 正式发布面（契约在册，零改动） | 核心§5.2（`:128-129`）；三层§8.2 |
| 12 | `pub fn shutdown(&self)`（:621） | 关闭内核：取消全部在途并拒绝新请求；幂等 | crate 测试 4 文件；三层§4.2「平台退出时」 | 正式发布面（新收编） | 契约§4.4 触发表「平台退出：全部注册项随 Bridge 关闭注销」；三层§8.2 取消来源 3「能力注销或 Bridge 关闭」；核心§5.2 取消行 |
| 13 | `pub fn is_shutdown(&self) -> bool`（:633） | 是否已关闭的只读标志 | **仅** crate 集成测试 2 文件（`bridge_draining_shutdown_edges.rs`、`bridge_lifecycle.rs`）；native/宿主 0 调用 | **测试 hook**（不入发布面） | 消费面无宿主/绑定需求（关闭后各入口以 `BRIDGE_CANCELLED`/拒绝码可判定，`Debug` 输出亦含 `shutdown` 字段）；`pub` 是外部集成测试可达性硬要求，故不私有化、登记为非契约面（核心§5.7 面边界条目）；宿主若未来需要退出态探测，另走 RFC |
| 14 | `pub fn invocation_context(&self, session: SessionId, request_id: &str) -> Option<InvocationContext>`（:639） | 读取在途调用完整上下文（`trace_id`/`plugin_id`/`owner`/`cancel`/`deadline`） | crate 测试 3 文件；native 绑定层 0 调用（裁定保持 0，见依据③） | 正式发布面（新收编，附转发禁令） | ① 核心§5.2 已发布 `InvocationContext` 类型本身（`:110-122`），「有类型无入口」是半截发布；② 权限§8.1/§8.2 要求「运行时判定（放行与拒绝）全量审计」且审计记录含 `traceId`/`requestId`/`sessionId`/`pluginId`——`trace_id` 只在内核在途表内生成（`bridge.rs:710` `generate_trace_id`），`invocation_context` 是其唯一生态出口，不收编则「不可绕过审计」在进程内不可执行；③ 返回值携带活跃 `CancelToken`，裁定为**主进程平台内部面**：禁止经 `chips-native` 转发到 JS / 禁止暴露给插件（登记入核心§5.7 约束） |
| 15 | `pub fn has_capability(&self, capability_id: &str) -> bool`（:666） | 注册表单点存在性只读快照 | native 测试 `:633/:635`；crate 测试 34 处调用 | 正式发布面（新收编） | 契约§4.3 编目行（`ICapabilityCatalog.get` 的存在性投影，「权威实例位于 Bridge 核心，主进程 TS 适配层只读查询」`:69`）；与「Bridge 不提供能力枚举 API」（`:44`）不冲突——该句约束插件客户端 `IChipsBridge` 方法面，本方法是平台内部单点查询、无枚举面；draining 在册语义见契约§10.1 |
| 16 | `pub fn capability_state(&self, capability_id: &str) -> Option<CapabilityState>`（:675） | 能力生命周期状态只读查询 | crate 测试 2 文件 | 正式发布面（新收编） | 契约§4.3 编目 `state` 字段（取值 `active` 与 `draining`，`:54`）的 Rust 侧权威实例；契约§10.1 状态机；b44 收口记录第三节 3.2 |
| 17 | `pub async fn request(&self, request: BridgeRequest) -> Result<CapabilityOutput, ChipsError>`（:691） | 调用收口（会话→注册表→权限→Schema→并发→执行） | native 生产 `:522` | 正式发布面（契约在册，零改动） | 核心§5.2（`:124-126`）+ §5.2 阶段失败码表 |

### 4.2 再导出类型（3）与策略常量（5）

| # | 成员（`lib.rs:100-104`） | 裁定 | 依据 |
|---|---|---|---|
| 18 | `pub enum ProviderKind { PlatformService, ServicePlugin }`（`bridge.rs:35-40`） | 正式发布面（新收编） | 契约§4.1 注册主体表两类主体；三层§4.2 触发者列；`activate_provider` 入参组成部分，随方法必然发布 |
| 19 | `pub struct ProviderRegistration { id, kind, permissions }`（`bridge.rs:44-51`） | 正式发布面（新收编） | 契约§4.2 校验项 6「已在提供方 manifest 声明」的申请集合载体；权限§7.6 授权变更重建入参 |
| 20 | `pub enum CapabilityState { Active, Draining }`（`bridge.rs:56-61`） | 正式发布面（新收编） | 契约§4.3 编目 `state` 字段的 Rust 侧权威取值；契约§10.1 状态机 |
| 21 | `DEFAULT_TIMEOUT_MS = 30_000`（`constants.rs:9`） | 正式发布面（新收编，登记名与值） | 数值权威三层§8.1；核心§5.1 注释「默认 30000」的常量化；native 测试与文档示例消费 |
| 22 | `DEFAULT_MAX_QUEUE = 32`（`constants.rs:14`） | 正式发布面（新收编） | 三层§8.3；核心§5.1「队列上限，默认 32」 |
| 23 | `SESSION_IN_FLIGHT_LIMIT = 64`（`constants.rs:20`） | 正式发布面（新收编） | 三层§4.1、§8.3（超限 `BRIDGE_SESSION_BUSY`）；核心§5.2 并发准入行 |
| 24 | `SCHEMA_CACHE_CAPACITY = 256`（`constants.rs:25`） | 正式发布面（新收编） | 三层§6.2（摘要键 LRU 上限 256） |
| 25 | `MAX_VALIDATION_ISSUES = 16`（`constants.rs:31`） | 正式发布面（新收编） | 契约§5.4（聚合上限 16 条 + `truncated`） |

**统计：正式发布面 24（16 方法 + 3 类型 + 5 常量，其中契约在册仅 4 方法，新收编 20 项）；内部面（应私有化）0；测试 hook 1（`is_shutdown`）。**

### 4.3 边界备注（非本单成员，登记不裁定）

1. `CapabilityInput::json_only`（`descriptor.rs:42`）与 `InvocationContext::capability_context`（`descriptor.rs:154`）：契约在册类型上的构造/派生便利方法，无业务语义，随类型发布天然成立，不逐条进 §5；核心§5.2 的 `InvocationContext` 代码块顺带补 `capability_context` 一行以覆盖 `#14` 入口的实际用法。
2. `pub mod error_codes`（16 常量）、`pub mod naming`、`pub mod permissions`：crate 级公开模块，其内容是契约已发布事实的可执行形态（错误码=契约§11.2 全集且已随工单013 对齐；文法与词表=契约§3、权限§4.1、契约§2.3），不属本单「impl Bridge + 再导出类型/常量」统计面，维持现状。
3. 文档-文档漂移观察（不属本单，登记于此）：三层§7.4 会话表写 `sessionId` 为 `string`（`02.07:97`），而核心§5.2/§5.3 与 Rust `SessionId`（`u64` 别名）、`native/bridge.rs:546-556` 均为数值会话键；两处口径的收口属宿主接线波（工单025）一并裁决，本单不改 §7.4。

## 五、变更方案（文档同步清单，逐项已执行/登记）

1. **《03-核心接口规范》§5（`03.05` 分件）**：
   - 引言段补发布面总纲一句：§5 是 `chips-bridge` 契约发布面的唯一清单，未列成员不构成生态内必需依赖。
   - §5.1 注册校验段尾追前置接口指引（激活/登记绑定 → §5.5；同 owner 定义覆盖 → §5.7）。
   - §5.2 `InvocationContext` 代码块补 `capability_context` 派生方法一行（`#14` 用法闭合）。
   - 新增 §5.4 内核实例与构造（`new` + `Clone`/`Default`/`Debug` 句柄语义）、§5.5 提供方激活与能力 ID 登记（`ProviderKind`/`ProviderRegistration` + `activate_provider`/`deactivate_provider`/`grant_capability_id`）、§5.6 会话生命周期（`open_session`/`close_session`）、§5.7 关闭与审计只读面（`shutdown` + `invocation_context` 及其 Neon 转发禁令 + 面边界条目：`is_shutdown` 等非契约面）、§5.8 蓝绿代际切换（`CapabilityState` + `begin_draining`/`takeover_register`/`capability_state`/`has_capability`）、§5.9 策略常量表（5 常量：名称/值/权威锚点）。
   - 版本头 v1.0.0→v1.1.0、日期 2026-09-20。
2. **《04-能力契约规范》§4（`04.04` 分件）**：
   - §4.4 触发表后新增「触发 → 内核 API 映射」表（四行触发逐行映射到核心§5 具体小节方法）。
   - §4.2 校验表后补一句前置 API 映射（校验项 2/7 的内核承载）；§4.3 编目段补内核侧只读实例映射（`has_capability`/`capability_state`，并重申编目不进 `window.chips`）。
   - 版本头 v1.0.0→v1.1.0、日期 2026-09-20。
3. **后续接线登记（不改文件，留主智能体派单合缝）**：
   - 工单025（宿主激活与会话通道）按新 §5.4–§5.8 接线；如需 Neon 承载，扩展导出建议名按 §2.3/§8.6 命名规则顺延：`bridgeActivateProvider`、`bridgeDeactivateProvider`、`bridgeGrantCapabilityId`、`bridgeOpenSession`、`bridgeCloseSession`、`bridgeShutdown`（+ 审计面是否需要 JS 可见的上下文只读投影，由 025 按「禁止转发活跃 `CancelToken`」约束设计信封）。落地时必须同 PR 更新《核心接口规范》§8.6 导出总表与 `packages/native/abi/export-surface.json`、`.d.ts` 三方一致；新增导出不递增 `CORE_ABI_VERSION`（§8.6 规则：删除或改签名才递增）。
   - `is_shutdown` 若被宿主真实需要，另走 RFC 收编，本轮不预收。
4. **工单面**：`问题工单.md` 工单026 行状态推进；本目录与 `工单026-chips-bridge公开成员未入契约发布面/任务说明.md` 互登裁定记录。

## 六、影响范围

- **受影响子系统**：`chips-bridge`（发布面口径，零代码改动）、`chips-native`（后续接线的 §8.6 扩展面，本单零改动）、宿主装配层（W3 前置，工单025 消费本发布面）、平台审计链（权限§8 判定审计经 `invocation_context` 获得可执行口径）。
- **三类版本**：平台统一版本不变（纯文档）；`CORE_ABI_VERSION` 不变（§9.2 Rust 签名不属 ABI；§8.6 导出零增减）；`chip_standards_version` 无关。
- **门禁**：G8 契约链（`tools/contract-gen`/`tests/contract`）解析的事实源表格不在本单改动面（§4.4 新增的是行为映射，不含能力 ID/错误码/事件行），生成物零扰动；`sdk-exports.json` 只解析《02-SDK-API规范》§2.2，不受影响。
- **与既有收口结论的关系**：完全承接工单005 §4.4 残口收口记录（b44）「编排触发方属宿主/内核插件运行时职责」的定性——本 RFC 只发布接口名与签名，不改变「crate 内不自行编排」的 §2.2 规则 5 约束；任务 #42 bridge 覆盖率收口口径（136 用例/99.71%）不受影响（无代码改动）。

## 七、迁移安排

无。本单不改代码、不改协议线格式、不改错误码与能力登记数据。

## 八、实施与验证

1. 实施步骤：按第五节 1/2 完成两份契约分件同步；按第四节裁定表逐成员核对签名与文档发布文本一致（签名逐字取自当前 `bridge.rs`/`lib.rs`/`constants.rs` 实测，未凭记忆）；登记工单状态与裁定记录（第五节 4）。
2. 验证方式：
   - 《检查文档链接.py》全库扫描 0 坏链（本目录文档不入文档库扫描面；退出码记录于工单026 任务说明末尾裁定记录）。
   - 签名一致性：文档代码块与 `bridge.rs` `grep -n "pub fn\|pub async fn"` 输出一一对应（25 项全覆盖 + 4.3 备注 2 项便利方法）。
   - 本单无代码改动，cargo/构建/测试面零验证需求（ crates 只读；主智能体验收时以文档链接校验与本表复核为准）。
3. 评审结论：**接受（修改后落地即本 RFC 正文）**；关联 ADR 判定：本次为「文档缺陷→以实现与既有契约行为为准更新文档」路径（变更与决策管理§5.4 情形 2 的补全向），不推翻 ADR-004 能力导向 Bridge 设计，不新增 ADR；若评审认为「Rust 内核生命周期面纳入契约发布面」值得独立决策留痕，由主智能体/用户裁决补 `ADR-011`，本 RFC 正文可直接作为其素材。

---

**文档结束**
