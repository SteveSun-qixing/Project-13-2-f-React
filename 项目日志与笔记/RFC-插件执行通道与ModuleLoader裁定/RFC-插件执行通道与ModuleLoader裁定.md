# RFC-插件执行通道与 ModuleLoader 裁定（工单025 剩余项② 收编：宿主装载的 `.cpk` 插件 JS 代码之加载、执行与失败语义归属）

> 版本：v1.0.0
> 日期：2026-09-21
> 状态：已裁定（本 RFC 为纯文档面裁定；本轮 `chips-ecosystem/**` 代码零改动；实施波见第八节，由主智能体统一派单验收）
> 关联：工单025《宿主未接原生绑定且缺激活与会话通道》任务说明 §6.2 剩余项②（`工单025-宿主未接原生绑定且缺激活与会话通道/任务说明.md:55`）与 §6.3 建议（`:60`）、工单026 收编 RFC《RFC-chips-bridge契约发布面裁定》§五.3（`:94`，六扩展导出名与三方同步要求）、工单031 任务说明 §五.2（`:40`，「六导出与 ModuleLoader 互为独立、仅在激活编排上前后置」实测结论）、RFC-ChipsError 统一裁定（错误唯一类纪律先例）、`task043《契约-代码漂移审计-2026-09-20》` W2 面

---

## 一、背景与动机

工单025 宿主侧收口（2026-09-21）后，剩余项② 的原始定性为：「§8.6 规则预留的 `kernel`/`plugin` 前缀导出（§8.7 `PluginRunner` 的 Neon 实现）与 ModuleLoader（03-插件架构设计 §5.2 受管加载器，完整性门禁 + 白名单）均未交付；装载器 `activationPortFor` 注入位据此保持 BRIDGE_INTERNAL 诚实回退臂」（`任务说明.md:55`），且 §6.3 判其「体量最大（Neon `PluginRunner` + ModuleLoader 子系统），建议单独立项规划」（`:60`）。本 RFC 对该定性做方案级裁定：插件 JS 模块的**加载**与**执行**到底落在哪一层、`kernel`/`plugin` 前缀导出与在途六扩展导出的关系、失败语义如何映射 `apply` 30s / `stop` 10s 端口、与装载器已有面的接线缝，以及按契约先行的拆波。

**现状实测面（2026-09-21 复核，行号以此为准）**：

1. **激活编排契约已在壳侧落地并测试锁定**：`packages/host/src/loader/activation.ts:68-73` `IPluginActivationPort`（内核 §6.1 `PluginRunner` 的 TS 契约视图，`apply` 30s / `stop` 10s）；`packages/host/src/loader/lifecycle.ts` T1–T14 状态机、`activationPortFor` 注入位（`:116-121`）、诚实回退臂（`:265-269`、`:388-393`、`:571-572`）、超时强制（`:332-348`、`:408-415`、`:574-581`）；超时常量壳侧唯一视图 `loader/limits.ts:32-37`（`applyMs: 30_000` / `stopMs: 10_000`，权威《01-薯片内核设计》§6.7 `01.06:200-216`）。
2. **组合根注入位与工厂缝就绪**：`packages/host/src/main/production-assembly.ts:54-60` `PluginActivationPortFor` 签名、`:81` `pluginActivationPortFor` 选项（缺省未注入即回退臂）、`:143-161` `createProductionPluginLoaderFactory`、`:185-194` 原生绑定装载闸接线；`packages/host/src/runtime/host-runtime.ts:91,103-112,203` `pluginLoaderFactory` 递交缝。
3. **绑定层导出面**：git 基线 15 导出；**工作树在途 21 项**（`packages/native/abi/export-surface.json:4-108`、`packages/native/src/abi.rs:27-49` 注册表，即 RFC-026 §五.3 裁定的六项 Bridge 域扩展导出 `bridgeActivateProvider`/`bridgeDeactivateProvider`/`bridgeGrantCapabilityId`/`bridgeOpenSession`/`bridgeCloseSession`/`bridgeShutdown`，属另一在途智能体的落地波，**本单零触碰**）。《核心接口规范》§8.6 总表 Bridge 域行现仍登记四项（`03.08:149`），文档表与三方锁的同步是该在途波的收口责任（RFC-026 `:94`）。
4. **§8.6 预留域与 §8.7 适配约定的原文**：「内核启动与插件管理的导出不属于本文范围，由插件管理层实现并以 `kernel` / `plugin` 前缀登记」（`03.08:157`）；§8.7 适配约定第 5 条「插件模块的加载、校验与生命周期由插件管理层负责（03-插件架构设计），**绑定层不感知 `.cpk`**」（`03.08:180`）、第 1 条「`PluginRunner::apply` 的实现经 `Channel` 在 JS 线程调用插件入口函数」（`03.08:176`）、第 2 条「门面禁止暴露 `Context` 句柄本身、`ipcRenderer`、`process`、`require`」（`03.08:177`）。
5. **ModuleLoader 契约条款**：「主进程插件执行载体是受管模块加载器（ModuleLoader）：只允许加载插件作用域的 `chips-resource://` 模块与平台白名单模块……禁止 `node:*`、`electron`、裸路径与任意文件路径。加载器是**完整性门禁**：加载前校验模块来源与完整性摘要，越界加载或校验失败一律拒绝，本次启用失败且不执行任何插件代码」（`03-插件架构设计` §5.2，`03.05:24`；同口径见清单规范 `02.04:41` 与施工规范 `施工规范/04-插件体系.md` §4.1）；「插件代码在主进程内运行，因此加载器与调用边界必须捕获插件异常（§9.2）」（`03.05:23`）；服务插件的进程级隔离由工具进程承担（`03.05:25`）。
6. **Rust 内核侧既有面**：`chips-cordis` 已交付 `PluginRunner` trait（`crates/chips-cordis/src/plugin.rs:129-139`）、§6.3 `apply_one` 加载事务与 `LIFECYCLE_APPLY_TIMEOUT=30s` / `LIFECYCLE_STOP_TIMEOUT=10s` / `FORK_FORCE_DISPOSE_TIMEOUT=30s`（`src/constants.rs:11,16,19`）及激活事务集成测试（`tests/kernel_activation_transactions.rs`）；`packages/native/Cargo.toml:15` 已依赖 `chips-cordis`（§8.6 总表 Cordis / Context 域七项 `context*` 导出即其绑定面，`03.08:148`）。**但宿主对 cordis 运行时面（`contextProvide`/`contextInject` 等 Context/Fork 原语）实测 0 消费**（本轮 `grep -rn "contextProvide\|contextInject\|chips-cordis" chips-ecosystem/packages/host/src` 0 命中；唯一消费的 Neon 面是 Bridge 域，见 `native-bridge.ts:16-17` 头注），即 **cordis Kernel 实例（命令循环、PluginManager、Fork 权威）当前不存在于宿主进程**。
7. **装载器既有门禁素材**：入口固定 `dist/index.js`、UTF-8 文本 ESM、8 MiB 上限（`loader/validate.ts:275,281,377-380`；`limits.ts:23-24`）；安装哈希为整包合并摘要 `sha256:`（`loader/provider.ts:6`；`loader/signature.ts:50-59`）；运行态记录携带 `path` 与 `hash`（`loader/types.ts:42,60`）；示例插件构建产物自包含（`examples/plugins/hello/dist/index.js` 实测仅 `export { … as default }` 尾式、无外部 import 语句），SDK 类以 bundle 副本内嵌（RFC-ChipsError §二.1 同一证据）。
8. **验收基线**：宿主全量 vitest 61 文件 / 789 用例 EXIT=0（基线 60/769 零回退）、`tests/native-bridge.test.ts` 16 案、tsc/build:main/eslint 全 0（工单025 §6.1.4，`:50`）；`chips-bridge` crate 136 用例（工单031 §二.5，`:20`）。

## 二、裁定口径（约束总则，逐条出处）

| # | 约束（出处） | 对本裁定的硬结果 |
|---|---|---|
| R1 | Host 是唯一运行时承载；插件访问系统能力只能经 `window.chips.*` / Bridge / `chips-sdk` 正式链路（AGENTS.md 架构红线；`03.05` §5.3 上下文隔离清单 `:30-46`；§5.5 消费者限定「插件侧不得获得 `activate_provider`/`open_session`/`grant_capability_id` 的任何直接触发路径」`03.05(bridge):309`） | 插件代码执行体必须位于宿主主进程运行时之内；任何方案不得把内核管理面（激活/会话/登记）向插件侧暴露通路 |
| R2 | 绑定层零业务、不感知 `.cpk`；「插件模块的加载、校验与生命周期由插件管理层负责」（§8.1 `03.08:31`；§8.7 条 5 `03.08:180`） | ModuleLoader 的落地面只能是插件管理层（宿主 TS），**不允许**任何「Neon 导出面自带模块加载/`.cpk` 感知」的方案 |
| R3 | `#[neon::main]` 是原生模块唯一入口、导出集中声明（§8.1 `03.08:28`）；内核实例进程级单例、「生态内消费者不得另建并行实例分裂注册表权威」（§5.4 `03.05(bridge):260`） | 否决任何第二 `.node` 模块 / 第二内核实例通道 |
| R4 | 导出表只增不改；新增导出必须同 PR 更新 §8.6 总表与 `export-surface.json`、`.d.ts` 三方一致；**删除或改签名才递增** `CORE_ABI_VERSION`（§8.6 `03.08:143,156`；RFC-026 §三总则 3） | 本通道波次若零新增 Neon 导出，则三方锁与 ABI 面零扰动；在途 15→21 扩面与本通道共用同一锁面，不得并行改表 |
| R5 | 全生态唯一错误类 `ChipsError`（RFC-ChipsError §3.2，工单024 已收口）；绑定层自造码仅 `NATIVE_*` 三个、不得新增第四码（§8.5 `03.08:107`；`03.03:138`）；JS 抛出异常反向归一：`<DOMAIN>_<REASON>` 形状在册码原样保留，其余归一 `BRIDGE_INTERNAL`（§8.5 `03.08:108`）；装载器侧兜底码只能从登记码表选取（`loader/codes.ts:13-14`「不得自增自造码」） | 失败语义全部映射到登记码（§六表）；确需新码登记为待裁定项（开放问题 O1），本轮不发明 |
| R6 | 生命周期数值唯一权威：`apply` 30s / `stop` 10s / 强撤 30s（内核 §6.7 `01.06:204-208`）；壳侧视图 `limits.ts:32-37` 已镜像并被 `loader-lifecycle.test.ts` 锁定 | 执行通道任何一层不得二处定义数值；超时强制点保持 `lifecycle.ts` 现实现 |
| R7 | 不做临时版、简化版、占位实现；不留 TODO；不留兼容性包袱（AGENTS.md）；未决事项标注开放问题而非臆断 | 波 0 机制实测闸为正式工程步骤（产物入本项目日志目录，属研究结论载体）；不以「临时降级臂」替代正式裁定 |
| R8 | 主进程插件在主进程运行（`03.05:23`）；工具进程仅登记为服务插件的进程级隔离形态（`03.05:25`；§9 崩溃隔离 `03.09`） | 「全体插件进 worker/utility process 执行」不是本通道的合法方案，服务隔离归后续正式波次 |

## 三、裁定一：执行通道驱动模式与 ModuleLoader 落地面

### 3.1 候选方案（公平比较）

**方案 A：宿主 TS 驱动（ModuleLoader 落地宿主插件管理层 + 激活端口直连实现，零新增 Neon 导出）**

- 形态：`ModuleLoader` 新建在宿主装载器域（`packages/host/src/loader/module-loader.ts`），职责=受管加载与执行 `.cpk` 主进程入口模块（`<record.path>/dist/index.js`，解析白名单 + 完整性门禁 + 门面注入）；`IPluginActivationPort`（`activation.ts:68-73`）的实现体新建在宿主 main 域（`plugin-activation.ts`）：`apply` = 经 ModuleLoader 取入口模块 → 按角色激活入口调用（basecard 注册卡片类型 / boxlayout 注册布局 / app 注册 launcher / service 调用 `start`，施工规范 `04-插件体系.md` §3.2 第 6 条）→ 副作用经既有 `IPluginActivationContext` 门面登记（`activation.ts:32-60`：能力注册 owner 预绑定 + 仅 `service` 角色、事件发布、配置只读快照、`signal` 协作取消）；`stop` = 角色停止入口 + 上下文清理。超时/回滚/事件/状态机**零改动复用** `lifecycle.ts` 已验收面。
- 优点：① 与 R2 完全一致（加载、校验、生命周期归插件管理层，宿主 TS 即该层的唯一既存实体）；② 编排面已交付且被测试锁定（T1–T14、依赖拓扑/pending/级联、`plugin:*` 事件、回滚 `rollbackCapabilities` `lifecycle.ts:326-330`），执行通道只补齐「加载 + 入口调用」两个缺环，改动面最小且全在宿主包内；③ 零新增 Neon 导出 → 与在途六扩展波（`packages/native` 独占面）文件面完全不相交，可并行收口（R4）；④ 与「Host 是唯一运行时承载」红线最短路径——插件代码在宿主主进程内经宿主受管加载器执行，权限判定与 Schema 校验的权威在 `chips-bridge` 内核（Bridge 域导出，剩余项①③ 的接线对象），执行通道不经任何旁路。
- 缺点（如实陈述）：① `chips-cordis` 的内核侧加载事务（§6.3 `apply_one`、Fork 统一回收、暂存代际一次原子发布）在此模式下暂无消费方，「暂存代际发布」由壳侧 `hostCapabilityRegistry` 承担，形成代际发布归属的远期收敛问题（登记 O3）；② §8.7「TS 插件由绑定层实现 `PluginRunner`」的 Neon 实现不在本通道交付，需要修订 §8.6 规则 3 / §8.7 的落地时序解释口径（波 4 文档面，登记于 §四）；③ 运行期逃逸异常（脱离调用边界的定时器/悬挂 promise）只有 Fork/熔断内核面能系统性收口，方案 A 仅覆盖「加载与调用边界」捕获（`03.05:23` 的最低要求）。

**方案 B：内核驱动（新增 `kernel`/`plugin` 前缀 Neon 导出，§8.7 `PluginRunner` 的绑定层实现为执行主体）**

- 形态：本波即为 `packages/native` 新增 `kernel*`（Kernel 句柄构造与命令循环接入）与 `plugin*`（`pluginApply`/`pluginStop` 等）导出；绑定层以 `Root<JsFunction>` 持有 ModuleLoader 产出的入口函数、`apply` 经 `Channel` 回投 JS 线程执行（§8.7 条 1）；30s/10s/强撤在 Rust 侧 `tokio::time::timeout` 强制（`plugin.rs`/`constants.rs` 已交付），宿主 `enable` 面瘦身为向内核提交 `LoadRequest`。
- 优点：① 忠实于《01-薯片内核设计》目标态，内核状态机（§6.2）与管理层状态机（03.03 §3.2）的「一一对应」在运行期真实成对；② Fork 撤销、暂存代际、§6.8 崩溃熔断、§6.9 软配额在 apply 路径上原生联动；③ 超时强制单点（内核），消除壳内核双镜像的长期漂移风险。
- 缺点（如实陈述）：① **前置体量远超本通道**：宿主当前对 cordis 运行时面 0 消费（§一.6），内核驱动要求整条 cordis 运行时接线（Kernel 句柄导出、Context/Fork 权威迁入、服务表 provide/inject、事件总线、配置 `ConfigProvider` 适配）先行落地——那是一个自带 RFC 的独立工程（工单031 §五.2 亦判 ModuleLoader 与六导出互不依赖、本项「维持独立立项」）；② 宿主 T1–T14 编排已交付并被 `loader-lifecycle.test.ts` 等面锁定，取 B 即须同步决定其降级或删除，属超出本单范围的架构返工（AGENTS「不得自行改变架构设计」）；③ 对本单核心命题（`.cpk` 代码真正执行）无即时增益——插件 JS 无论 A/B 都在同一 JS 线程执行，异常/崩溃隔离属性相同（见 §五.4）；④ 错误链多跨一次内核边界（`KernelError`→`ChipsError`→wire，§9.1 `01.09:155`），落地面横跨 `packages/native` 在途独占区，与六扩展波直接冲突（三方锁同文件串行）。

**方案 C：执行体迁出主进程（utility process / worker 承载全部插件代码）**

- 优点：硬崩溃隔离（主进程免疫插件 segfault/死循环），与工具进程形态同构。
- 缺点：直接违反 R8 与 `03.05:23`「插件代码在主进程内运行」的现行契约；每个子进程一份 Rust 静态面即违反 R3 单例语义（§5.4 `:260`），Bridge 会话/窗口绑定/事件投递全部要跨进程重设计；渲染侧 `basecard`/`boxlayout` 本已在 iframe 沙箱（`03.05:27`），主进程面收益低。否决；服务插件的工具进程隔离按 `03.05:25` 既有登记归后续正式波次，本裁定不开口子也不废弃该条款。

### 3.2 裁定

**采纳方案 A；方案 B 裁定为「内核运行时接线波」的目标态（登记为波 4 / 开放问题 O4，不在本单实施），方案 C 否决。** 具体：

1. **ModuleLoader 落地面 = `packages/host/src/loader/`（插件管理层宿主 TS）**，不对 `03.05:24` 条款做任何临时裁剪：白名单解析、加载前完整性校验、越界即拒（本次启用失败且不执行任何插件代码）。
2. **执行通道 = `IPluginActivationPort` 的宿主实现**（新文件 `packages/host/src/main/plugin-activation.ts`），由 `production-assembly.ts:81` 注入位缺省构造（波 3 切换）；诚实回退臂（`lifecycle.ts:388-393`）**保留**——其语义随本裁定从「通道未落地」收敛为「通道构造失败（产物缺失/门禁拒装）时的诚实降级」，工单025 任务说明 §6.2 剩余项② 的「保留即降级」口径（`:55`）由此闭合。
3. **门面纪律继承 §8.7 条 2 并按 A 形态镜像为壳侧规范**：注入插件的激活门面禁止暴露 `Context` 句柄本体、`ipcRenderer`、`process`、`require`；插件模块图内可见的自由变量面由 ESM 求值机制（§3.3）与白名单解析共同封顶。
4. 对 §8.6 规则 3 与 §8.7 的文档口径修订（「内核启动与插件管理的导出」与 ModuleLoader 的落地时序解耦，明确 `kernel`/`plugin` 前缀导出归属内核接线波）**登记为波 4 文档面待执行项**，本轮未改共用文档（见 §八）。

### 3.3 子裁定：主进程 ESM 求值机制（ModuleLoader 的执行原语）

入口模块实测为 ESM（§一.7），宿主主进程需要一个「可拦截解析、可注入源码字节、可校验完整性、可复加载」的求值面。硬要求：**H1** 每个 specifier 的解析经过白名单判定（拒绝 `node:*`、`electron`、白名单外裸路径与任意文件路径）；**H2** 加载前完整性门禁（字节哈希校验）；**H3** 蓝绿/卸载复加载语义——同一 URL 的旧模块不得经全局缓存遮蔽新校验（缓存穿透）；**H4** 不使用未收口实验特性作为生产默认路径；**H5** 零新增 Electron/Node 启动参数偏好。

| 方案 | 内容 | 强项 | 弱项 | 裁决 |
|---|---|---|---|---|
| M1 | `node:vm` `SourceTextModule` + 自定义 linker，Electron `js-flags` 开 `--experimental-vm-modules` | 全自控：linker 即白名单、无全局缓存（H3 天然满足）、执行上下文可裁剪 | 生产主进程依赖 **experimental** Node flag（H4/H5 双违），Electron flag 注入属启动面特判 | 等价备选（波 0 实测后若 M2 不可用则取 M1，H4/H5 的违例须由用户显式接受） |
| M2 | 动态 `import()` + `module.register()` ESM 自定义 Hook（resolve/load 双钩）：resolve 钩=白名单判定与插件作用域重定位；load 钩=读字节、包级哈希校验后交源；复加载以每次激活的 nonce 查询串穿透 ESM 缓存 | 官方稳定 API（Node ≥20.6，Electron 40.8 搭载 Node 22 系）；resolve/load 两点恰为 §5.2「完整性门禁+白名单」的语义落位；H3 经 nonce 解决且钩子线程不阻塞主线程 | 钩子运行于独立线程，插件上下文（作用域根、期望哈希）需经 `initialize(data)` 显式投递；Electron 主进程对 `module.register` 的官方支持度文档未明示，需实测坐实 | **推荐**，连同波 0 实测闸（O2） |
| M3 | 改插件构建契约：入口转为平台提供函数调用格式（非 ESM），宿主 `vm.Script` 求值 | 求值面最简单、完全自控 | 变更《03-插件包格式》与 `validate.ts:275` 已锁定的「UTF-8 文本 ESM 模块」入口规范、`@chips/cli` 打包链、脚手架模板、`02.04:41` 契约句——为宿主侧收益撬动全生态打包面，不成比例 | 否决 |

**裁定：执行面按 H1–H5 冻结为规范；实现形态推荐 M2，波 0 为 Electron 40.8 真进程实测闸（M2 不可用即 M1 并接受 flag 条款，由主智能体在波 0 报告中裁决——O2）。** 实测口径三条：白名单拒绝路径真实抛拒、哈希篡改包真实拒装、同路径 nonce 复加载真实重新过门禁。

## 四、裁定二：`kernel`/`plugin` 前缀导出与六扩展导出的关系、三方锁延续

1. **本通道波次（波 1–3）零新增 Neon 导出**：§3.2 裁定 A 的执行通道全部落在宿主 TS 面，`export-surface.json` ↔ `abi.rs` ↔ `chips-native.d.ts` ↔ §8.6 总表四面零扰动。在途六扩展导出（工作树 21 项）与 §8.6 总表 Bridge 域行的同步收口属该派单波次独有职责（RFC-026 `:94`），本 RFC 不与该面发生任何交集。
2. **未来若落地内核接线波（波 4），裁定复用同一 Neon 通道**（方案 甲）：
   - 新增 `kernel`/`plugin` 前缀域即 `chips-native` 导出表新行（§8.6 规则 1「导出分域、函数名以域前缀开头」`03.08:155`；小驼峰与唯一性由 `abi.rs` 测试面强制，`abi.rs:74-80`）；登记流程完全沿用三方锁 + 文档总表四面同 PR（R4）；新增不递增 `CORE_ABI_VERSION`（§8.6 `:156`）。
   - 宿主装载闸 `NATIVE_BRIDGE_REQUIRED_EXPORTS` 六项**不扩**（`native-bridge.ts:106-117` 既有「只增不改、按必备子集判定」口径）；`kernel`/`plugin` 域若交付，其可用性判定另立域闸（fail-closed 逐域），由波 4 设计并登记，不回改 Bridge 域闸。
   - **禁止**与六扩展波并行改表：两波在 `abi.rs`/`export-surface.json`/`d.ts`/§8.6 总表同文件面上真串行（工单031 已确立该面单一波次所有权）。
3. **否决独立通道（方案 乙=第二 `.node` 模块承载 kernel/plugin 面）**：违反 R3——双模块即双 Rust 静态面，`OnceLock<Bridge>`/内核单例（§5.4 `:260`）分裂为两个注册表/会话表权威，且 §8.1 唯一入口条款（`03.08:28`）不成立。
4. **方案 丙（本波即扩 `plugin*` 导出、先建绑定层薄壳）**如实比较后仍归并于 B 否决：`pluginApply` 的转发目标（cordis Kernel 实例与 runner 注册表）当前不存在于宿主进程（§一.6），无实体可转发；强行落地即 §8.1 绑定层零业务红线的空壳化，属 AGENTS 禁止的占位实现。其成立形态就是波 4 的完整内容，不构成本波的独立选项。

## 五、裁定三：执行隔离与失败语义

### 5.1 事件→端口→状态机映射表（全部取码自既有登记码表，本轮零新增码值）

| 事件 | 判定点（波 1–2 落地） | 错误映射（登记码） | 端口语义 | 状态机结果 |
|---|---|---|---|---|
| 白名单越界 specifier（`node:*`/`electron`/裸路径/作用域外绝对路径） | ModuleLoader resolve 门禁（`03.05:24`、§5.3 禁令清单 `03.05:40-46`） | 拒绝加载，不执行任何插件代码；`apply` 端口按 `KERNEL_APPLY_FAILED` 报（`loader/codes.ts:47` 在册；`details` 携带 `pluginId`、specifier、门禁阶段）——专用加载码登记 O1 | `apply` 30s 端口：进门禁即失败路径 | T7：回滚 + `failed` + `plugin:failed`（`lifecycle.ts:436-457,320-324`） |
| 完整性门禁失败（字节哈希与注册表 `hash` 不合，防安装后篡改） | ModuleLoader load 门禁（复算与 `signature.ts:50-59` 同源合并摘要，比对 `types.ts:42,60`） | 同上（`KERNEL_APPLY_FAILED`，`details.stage='integrity'`）；诊断留痕 | 同上 | 同上 |
| 入口超限/不可解析（8 MiB、非 UTF-8、ESM 语法错误） | ModuleLoader 与 `validate.ts:275-281` 同源口径 | 同上（`details.stage='entry'`） | 同上 | 同上 |
| 入口角色形状不符（`default` 导出缺失或角色契约方法不符） | 角色适配器（波 2） | `KERNEL_APPLY_FAILED`（经 `activation.ts` 归一臂 `:442-452` 天然承接） | 同上 | 同上 |
| 插件 apply 抛错 | `port.apply` 调用边界 try/catch（`03.05:23`「加载器与调用边界必须捕获插件异常」） | ChipsError 同构且 `code` 满足 `<DOMAIN>_<REASON>` → **原样保留** `code/retryable/details`（§8.5 反向归一规则 `03.08:108` 镜像为壳侧承诺）；其余归一 `KERNEL_APPLY_FAILED`、原始文本只进 `details.cause`（不落 `message`，RFC-ChipsError §4.5 脱敏口径） | `apply` 30s 端口内即时失败 | T7 + `rollbackCapabilities`（`lifecycle.ts:454`）+ `failed` |
| apply 超时（30s） | `lifecycle.ts:408-415` 既有强制 | `KERNEL_LIFECYCLE_TIMEOUT`（`details.phase='apply'`，`retryable: true` `codes.ts:83`） | 超时即 `controller.abort()`（`:438`）+ 副作用回收（`:454`） | T7 → `failed` |
| stop 抛错/超时（10s） | `lifecycle.ts:570-588` 既有 | 错误随 `IPluginDisableResult.stopError` 上报（`:140-145`）；超时同码 `details.phase='stop'` | stop 失败/超时**不阻断撤销**（内核 §6.4[2][3] 镜像） | T9 仍 → `installed`；审计留痕 |
| 运行期逃逸异常（脱离调用边界的定时器/悬挂 promise） | 本轮边界=停用逆序摘除（`lifecycle.ts:589-592` 能力撤销面）+ `signal` 协作取消；进程级熔断（§6.8：10 分钟窗口 3 次、退避 1s/2s/4s、单次间隔上限 30s）**登记为波 4 挂钩**，本轮不简化实现 | 不适用（非端口调用面） | 不占 30s/10s 端口 | 由后续波次按 §6.8/03.09 裁定 |
| 硬崩溃（主进程不可继续） | 方案 A/B 同线程、同一暴露；契约正式答案=工具进程隔离（`03.05:25`）+ 崩溃恢复（03.09） | —— | —— | 登记 O4 范围，本单不扩张 |

### 5.2 错误形态纪律

1. **唯一错误类**：执行通道全线消费工单024 已收口的 `ChipsError` 形状；壳侧构造走 `LoaderError → toWireError` 既有单点（`loader/errors.ts`、`protocol/wire.ts`，RFC-ChipsError §六.1 边界备注承认的壳侧同构模式），**不引入第二份错误类或第二套 wire 形状**。
2. **绑定层侧**（仅波 4 触及）：拒绝路径只用 `NATIVE_*` 三码（§8.5 `:107`；`03.03:132-134` 逐项），出界错误一律 Rust `ChipsError` → §8.5 `throw_chips_error` 同构抛出；**禁止转发活跃 `CancelToken`**（§5.7 `03.05(bridge):359` 禁令延续）。
3. **码表纪律**：本轮兜底全部取 `LIFECYCLE_ERROR_CODES`（`codes.ts:41-50`）在册子集；确需专码（加载门禁/完整性失败）登记为 O1 待裁定，由主智能体决定是否走《01-薯片内核设计》§9.1 码表扩充，**禁止在实现波自造**。
4. **插件侧可见性**：执行通道任何错误不得提供绕过 `window.chips.*`/Bridge/SDK 的取值路径（R1）；插件收到的归一形态维持 §4.4 归一链路（RFC-ChipsError）不变。

## 六、裁定四：与装载器已有面的接线缝（逐条，含并行/串判判定）

| # | 既有面（文件:行号） | 缝 | 改动量 | 并行性 |
|---|---|---|---|---|
| S1 | `loader/activation.ts:32-73`（上下文 + 端口形状） | 端口形状即执行通道交付面，零改动承接 | 0 | 与一切在途面无关 |
| S2 | `loader/lifecycle.ts:116-121,265-269,382-393,564-582` | `activationPortFor` 注入位与诚实回退臂：**保留回退臂**（语义按 §3.2.2 收敛），注入即通 | 0 | 同上 |
| S3 | `loader/index.ts`（装载器公共面 barrel） | 新增 `module-loader` 导出行 | 增量 | 波 1 独占 |
| S4 | 新建 `loader/module-loader.ts` | ModuleLoader 本体（白名单解析/门禁/复加载 nonce/门面封顶） | 新文件 | **与 `packages/native` 在途六扩展、工单030 `tools/testing` 面完全不相交，可并行** |
| S5 | 新建 `main/plugin-activation.ts` | 端口实现 + 角色入口适配器 + 门面纪律（§8.7 条 2 镜像） | 新文件 | 依赖 S4；与在途面不相交，可并行 |
| S6 | `main/production-assembly.ts:54-60,81,143-161,185-194` | 缺省构造正式端口并传入工厂；`PluginActivationPortFor` 选项保留为显式覆盖/测试注入口 | 修改 | 依赖 S5；`production-assembly.ts` 不在六扩展波面上，可并行 |
| S7 | `runtime/host-runtime.ts:91,103-112,203` | `pluginLoaderFactory` 递交缝零改动（S6 在其上游闭合注入） | 0 | —— |
| S8 | `main/native-bridge.ts:110-117,283-297` | 装载闸六必备与 `dispatchNativeBridgeRequest`：零改动（§四.2） | 0 | —— |
| S9 | `tests/loader-lifecycle.test.ts`、`tests/loader-contract.test.ts`、`tests/production-assembly.test.ts`、`tests/native-bridge.test.ts`（16 案） | 回归面：回退臂测试语义按 §3.2.2 口径改写为「构造失败降级」；新增波 1–3 各自测试文件 | 测试 | 波内自含 |
| S10 | 剩余项①（六扩展导出，在途）与剩余项③（会话桥接：`runtime/capability/session.ts` 快照 ↔ 内核 `open_session`、调用权威切换） | **真耦合仅一处**：能力注册权威若切至内核（`bridgeActivateProvider`/`bridgeGrantCapabilityId`/`bridgeOpenSession` 编排），激活上下文 `hostCapabilityRegistry`（`activation.ts:121`）的下游要换；本轮**不切换**，注册权威留壳侧（`native-bridge.ts:26-28` 既有口径），切换随 ①③ 落地单排期 | 本单 0 | 波 1–3 与 ①③ 并行成立；①③→执行通道的切换波串行于两侧之后 |
| S11 | RFC-026 §4.3 备注 3（sessionId `string` 壳侧 ↔ `u64` 内核漂移） | 执行通道不消费 sessionId（apply/stop 端口与 Bridge 会话正交），漂移收口归剩余项③ 单 | 0 | 并行 |

并行/串行结论：**波 0–3 全程可与两路在途（`packages/native` 六扩展、工单030 `tools/testing`）并行**（文件面逐条不相交：见 S4–S6）；**唯一串行链**是 S10 的能力/会话权威切换，归 ①③ 后续集成单，不归本通道。

## 七、文档面对齐登记（本轮不改共用文档，逐条随波执行）

1. 《03-插件架构设计》§5.2（`03.05:24`）：补执行形态一句（ESM 受管求值链、resolve/load 双门禁、复加载 nonce），随波 1 收口 PR。
2. 《核心接口规范》§8.6 规则 3（`03.08:157`）与 §8.7：按本裁定补注「`kernel`/`plugin` 前缀导出绑定 cordis 内核运行时接线波，不构成主进程插件执行通道前置」；随波 3 收口 PR（避免文档先行于已裁代码）。
3. 《02-插件清单规范》四、runtime（`02.04:41`）：不动（条款即本裁定依据）。
4. 工单025 任务说明与 `问题工单.md` 025 行：本 RFC 交付段（已随本单追加）+ 各波收口时推进状态。
5. 三类版本：本通道波次零新增 Neon 导出、零码值、零线格式 → `CORE_ABI_VERSION`、平台统一版本、`chip_standards_version` 全部不变。

## 八、实施波清单（契约先行；每波一个可验收文件面；命令统一在 `chips-ecosystem/`、`export PATH="$HOME/.volta/bin:$HOME/.cargo/bin:$PATH"` 执行，退出码以 `> /tmp/x.log 2>&1; echo EXIT=$?` 口径留档）

| 波 | 文件面 | 内容 | 准入闸 | 准出闸（验收） | 依赖 |
|---|---|---|---|---|---|
| 0 | 无业务代码；验证物入本目录 `验证/` | Electron 40.8 真进程实测 M2（`module.register`）与备选 M1 三口径（白名单拒、哈希篡改拒、nonce 复加载），产出机制终局报告（O2 收口） | 本 RFC 裁定 | 三口径实测记录 + 主智能体签认机制终局 | 无 |
| 1 | `packages/host/src/loader/module-loader.ts`、`loader/index.ts`、`tests/loader-module.test.ts`（+ fixtures） | ModuleLoader 本体：resolve/load 双门禁、包级摘要复算、8 MiB/UTF-8/ESM 同源校验、门面封顶 | 波 0 报告 | `pnpm --filter @chips/host run test && pnpm --filter @chips/host run typecheck && pnpm --filter @chips/host run lint` 全 0，基线 61 文件/789 用例零回退 | 0 |
| 2 | `packages/host/src/main/plugin-activation.ts`、`tests/plugin-activation.test.ts` | 端口实现 + 角色入口适配（四角色激活/停止面）+ 失败语义表（§5.1）逐码断言 | 波 1 | 同波 1 命令 + `pnpm --filter @chips/host run build:main` 0 | 1 |
| 3 | `packages/host/src/main/production-assembly.ts`、`tests/production-assembly.test.ts`、`tests/self-check-runtime.test.ts`、`tests/loader-lifecycle.test.ts` 回退臂口径改写 | 组合根缺省接线正式端口（enable 通道即通；S10 能力/会话权威不动）；Electron self-check 冒烟复跑（真进程） | 波 2 | 同波 2 + `pnpm gates:all` 0 + 冒烟 stderr 0 字节留档；工单025 剩余项② 收口记录回写、`问题工单.md` 025 行推进 | 2（与在途 ①③ 并行，之后无接续） |
| 4 | `packages/native`（`kernel`/`plugin` 域三方锁 + §8.6 总表新行）、`chips-cordis` 运行时接线面、宿主编排降级裁定、§6.8 熔断、工具进程服务隔离、§7 O1/O3 码与归属收口 | 内核运行时接线与内核驱动执行通道目标态（方案 B 落地工程），**独立立项、独立 RFC** | 用户/主智能体立项指令（O4）+ 六扩展波收口（同文件面串行） | 立项单自定 | ①③ 与波 3 全部收口 |

## 九、影响范围

- **受影响子系统**：`@chips/host`（loader/main 两域新增两文件 + 组合根一处缺省接线 + 测试面）、文档库（§7.1/7.2 两处随波同步）。**零触碰**：`packages/native`（在途波独占）、`crates/core-rust`、`tools/testing`（工单030 面）、`packages/sdk`/`bridge`/`cli`、插件构建契约与 `.cpk` 格式。
- **不变面**：`CORE_ABI_VERSION`、导出三方锁、T1–T14 状态机语义、`apply` 30s/`stop` 10s 数值与强制点、错误码表（零增减）、Bridge 三层权威（壳侧回退口径维持至 ①③ 落地单）。
- **门禁**：G6 覆盖率波内自含（新文件均带正式测试）；G8 契约链零扰动（无表格码值变化）；G9 边界表零变化（全部落 `packages/host` 在册规则内）。

## 十、开放问题（留主智能体/用户裁决，本 RFC 不臆断）

1. **O1**：加载门禁/完整性失败是否专设码（如 `PLUGIN_LOAD_DENIED` 域或《01-薯片内核设计》§9.1 码表扩充）；本轮以在册 `KERNEL_APPLY_FAILED` 兜底，`retryable: true` 对确定性拒装存在语义钝差（登记于 §5.1，实现波不得自造）。
2. **O2**：ESM 求值机制 M1/M2 终局——波 0 Electron 真进程实测后签认；若取 M1，`--experimental-vm-modules` 进入生产启动面须显式接受。
3. **O3**：暂存代际/能力发布权威（壳侧 `hostCapabilityRegistry` ↔ 内核 §6.3[d]）与 sessionId `string`↔`u64` 漂移（RFC-026 §4.3 备注 3）的归属收敛，随剩余项①③ 集成单与波 4 立项统筹。
4. **O4**：波 4（内核运行时接线 + `kernel`/`plugin` 前缀导出 + §6.8 熔断 + 工具进程服务隔离）是否立项与排期。
5. **O5**：§8.6 规则 3 / §8.7 的口径修订文本（§7.2）在波 3 后落共用文档前，是否需按 AGENTS 文档边界先行评审。

## 十一、实施与验证（本轮）

1. 本轮实施：仅本 RFC 一份新建 + 工单025 任务说明末尾追加「剩余项② RFC 裁定交付」一段；`chips-ecosystem/**` 与文档库零改动（`git status` 审计于开工前后各一次，在途 `packages/native` 四文件与 `tools/testing` 面未被触碰；未执行任何 git 写操作）。
2. 本轮证据命令（2026-09-21 实测）：
   - `git status --short` → 开工时仅 `packages/native` 四文件 M（在途六扩展波）+ 两个与本单无关的未跟踪目录；收工复测增量应且仅应有本目录与 `工单025-*/任务说明.md`。
   - 导出面：`packages/native/abi/export-surface.json` 工作树 21 项（基线 15 项 + Bridge 域六扩展），§8.6 文档表 `03.08:149` 仍 4 项（在途波收口职责）。
   - 宿主 cordis 消费面：`grep -rn "contextProvide\|contextInject" chips-ecosystem/packages/host/src` → 0 命中（§一.6 依据）。
   - 入口格式：`examples/plugins/hello/dist/index.js` 尾部 `export { … as default }`（M 方案面依据）；`loader/validate.ts:275,377-380` 入口规范。
3. 评审结论：**接受（本 RFC 正文即裁定）**。关联 ADR 判定：属「工单定性→实现路径裁定」的收编件，不推翻内核设计的 Cordis 目标态（B 保留为波 4 目标态），不新增 ADR；若主智能体认为「主进程插件执行通道采宿主驱动、内核驱动后置」值得独立决策留痕，可取材 §三、§四 补 ADR。

---

**文档结束**
