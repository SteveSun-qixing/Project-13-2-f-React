# RFC-CLI 承载链路裁定（工单039 波0 契约冻结：《17-CLI承载链路契约》落文与 `@chips/bridge` carrier 协议分件公开面正式化）

> 版本：v1.0.0
> 日期：2026-09-21
> 状态：已实施（波0 纯文档 + bridge 协议分件类型/常量落面；行为实现归波1~波3）
> 关联：`项目日志与笔记/工单039-CLI宿主驱动段无正式承载链路服务路由无服务端实现且发现协议未定义/`（任务说明=缺口账；立项评估第八节主智能体裁定书=本 RFC 与《17》落文的唯一权威口径）、《17-CLI承载链路契约》（`薯片生态文档库/05-接口与契约/17-CLI承载链路契约.md`）、RFC-chips-bridge契约发布面裁定（公开面正式化流程先例）、RFC-插件执行通道与ModuleLoader裁定（RFC 体例先例）、《07-CLI完整参考》§2.7/§3.10/§5.8、《13-命令系统契约》§4.4、《02-Bridge三层设计》§7.2/§7.3、《08-权限系统设计》链路三

---

## 一、背景

工单039 登记生态级架构缺口：《07-CLI 完整参考》§3.10 承诺的宿主驱动段（插件命令经承载环境执行）没有可对接的正式服务通道（缺口 A：`cli.command.*` / `cli.task.*` / `command:invoke` 无服务端承载链路），且 CLI ↔ 宿主的跨进程发现/传输协议未定义（缺口 B）。任务 #136 立项评估给出四段协议（传输/发现/握手/鉴权）设计选项与逐段推荐，主智能体 2026-09-21 验收随单作出 Q1–Q9 裁定与 R3 登记，并增补波0 公开面裁定（评估稿第八节）。任务 #138（本 RFC 所属波）执行**契约冻结**：《17-CLI承载链路契约》05 层新篇落文、07 参考行级指向随动、`@chips/bridge` carrier 协议分件类型/常量落面——零行为实现，不动 host/cli 任何源文件。

## 二、裁定摘要（引用评估稿第八节，不重复全文）

Q1 传输采 A（UDS + Windows named pipe，`node:net`）；Q2 发现文件落 `<userData>/chips-carrier.{json,sock}` + **单一派生源**硬约束（`deriveCarrierEndpoints` 唯一共享纯函数落 `@chips/bridge`）；Q3 文档归属采 (a)（05 层《17》，rationale 落本 RFC、不开 01 层子系统篇，避免同一决策两处权威）；Q4 环境变量采 (a)+(b)（`CHIPS_CARRIER_SOCKET` + `CHIPS_CARRIER_DISABLE=1`，严格错误语义比照 `CHIPS_TRUST_ROOTS_FILE` 先例，已入 07.02 §2.7 表）；Q5 错误面采 (a)（复用 `CLI_TARGET_UNAVAILABLE`、零新码族、`details.reason` 词表冻结于《17》§5.3）；Q6 按需启动采 (c)（仅发行包固定布局可解析宿主 bin 时自动拉起，bin 相对布局随《17》§5.2 冻结，衔接工单019 注入面纪律与 `tests/contract/tests/cli-bin-resolution.test.ts:2-5` 工作区 bin 不漂移判例）；Q7 会话采 (a)（`ISessionSource` 扩 `carrier` 判别片进统一会话注册表，守 `router.ts:8-9` 第二套会话表红线；carrier 会话不天然持资源句柄）；Q8 `chips dev run` 采 (a)（并入本协议，dev 宿主=同协议工作区实例，否决第二套 dev 端点）；Q9 Windows pipe ACL 采 (a)+随账（v1 只兑现 POSIX `0600/0700`，ACL 为实现许可的额外校验，边界挂工单039 至 Windows 门禁面立项）；R3 登记生效（app 臂「启动并投递」依赖 `handleStartupInputs` 正式投递装配，未就绪则继续挂账、禁临时投递凑绿；service 臂不阻塞波1）。

## 三、传输选型 rationale（Q3 裁定归本文档面）

1. **为什么是 UDS + named pipe（Q1 A）**：内核级文件权限构成第一道鉴权（`0600` socket + `0700` 目录挡不同用户）；无 TCP 端口 squatting、防火墙与 `0.0.0.0` 误绑风险面；纯本地不可远程；`node:net` 对 `path` 型 server/client 三端对等，不引第三方依赖。代价（macOS `sun_path` 104B 上限、Windows 无 POSIX 权限语义、陈旧 socket 治理）全部转化为《17》必项条款（§2.1–§2.5），选型净收益为正。
2. **为什么否决 localhost TCP（B）**：无内在鉴权——任意同机进程可连，鉴权全压应用层 token（比 A 多一层必须项、少一层内核防）；端口占用/竞态管理是长期负资产。
3. **为什么否决 stdio 专属子实例（C，架构级）**：Electron 单实例锁（`packages/host/src/main/main.ts:68`）下第二实例立即退出，「专属子实例」必须新造旁路实例语义，直接冲击壳生命周期与 `userData` 并发写安全；并存宿主产生第二份命令索引/任务存储，正面违反 §5.8 唯一集合承诺。「按需启动」的正确解作用在连接模型（发现失败 → 正常单实例拉起宿主 → 同一 socket 服务，《17》§5.2），不在传输层造第二实例。
4. **为什么否决 ed25519 进程互鉴（Q 表外，评估 §④B）**：CPK 信任链语义=制品完整性≠进程身份；宿主无可分发公钥信任根（工单028 在册）、CLI 无宿主密钥登记链路；同用户进程可读私钥文件，密码学互鉴只产出虚假安全感。否决记录已落《17》§1.4 为契约背景条款，未来 OS keychain/代码签名核验另走 RFC。
5. **封套为什么复用 Bridge 形状**：CLI 消费端 `ICliInvoker` 与 `IBridgeRequest/IBridgeResponse` 同构，复用使消费端零改动、错误面零新增；`capabilityId` 槽承载 `routeId` 只是槽位复用，`cli.*` 禁入能力注册表（污染《04》编目与 R19 映射）。类型唯一来源收敛于 `@chips/bridge` 协议分件，是工单024 `ChipsError` 四份分叉教训的同族防线。

## 四、`@chips/bridge` 公开面正式化登记（波0 增补裁定执行）

### 4.1 判定机制核证（先核证后落面）

- 工单026「25 公开成员」裁定对象是 **Rust `chips-bridge` crate 的 `impl Bridge` 面**（17 方法 + 3 类型 + 5 常量），其判定与锁定机制为：RFC §四逐成员裁定表 + 《03-核心接口规范》§5 作为「契约发布面的唯一清单」（文档级权威）。RFC 自身 §二.4 登记：`tests/contract` 与 `tools/contract-gen` 登记的是 **TS `@chips/bridge` 的能力/权限/事件/错误码事实与文档表格解析面，不存在任何 Rust 侧 `impl Bridge` 成员名清单**。
- 本轮实测复核（2026-09-21）：`tests/contract/snapshots/` 仅 4 件（`event-contracts.json` / `frame-protocol.json` / `role-interfaces.json` / `sdk-exports.json`），无 bridge 导出计数快照；`tests/contract/src/code/bridge.ts:9-30` 只读取 `protocol/` 五模块（capability-contracts / errors / events / permissions / resource）的事实登记表；`packages/bridge` 包内无「公开成员清单」快照测试。**结论：G8/契约测试面对 TS 协议分件的类型与常量导出不做成员计数锁定。**
- 按裁定口径：「若判定面机制显示类型导出不进成员计数，如实登记后照常落面」——如实登记如上；既有 25 成员面（Rust 侧）本波零触碰、零漂移（`packages/core-rust` 禁触未读改）。

### 4.2 新增公开成员清单（TS `@chips/bridge`，`src/protocol/carrier.ts` 经 `protocol/index.ts` 再导出）

值 14 项：`CARRIER_PROTOCOL`、`CARRIER_HANDSHAKE_TIMEOUT_MS`、`CARRIER_DISCOVERY_FILE_NAME`、`CARRIER_SOCKET_FILE_NAME`、`CARRIER_SOCKET_PATH_MAX_BYTES`、`CARRIER_SOCKET_SHORT_PREFIX`、`CARRIER_PIPE_NAME_PREFIX`、`CARRIER_ENDPOINT_FILE_MODE`、`CARRIER_ENDPOINT_DIR_MODE`、`CARRIER_SOCKET_ENV`、`CARRIER_DISABLE_ENV`、`CARRIER_DISABLE_VALUE`、`CARRIER_HANDSHAKE_REASONS`、`CARRIER_HANDSHAKE_REASON_VALUES`。

类型 11 项：`CarrierProtocol`、`CarrierHandshakeReason`、`ICarrierDiscoveryRecord`、`ICarrierEndpoints`、`DeriveCarrierEndpoints`、`ICarrierHandshakeRequest`、`ICarrierHandshakeSuccess`、`ICarrierHandshakeFailure`、`ICarrierHandshakeResponse`、`ICarrierRequest`、`ICarrierResponse`。

快照变化：4 件快照逐字节零变化（新模块不在事实源解析面）；`pnpm --filter @chips/bridge run test:contract` EXIT=0（13 文件 / 67 项），包级 test EXIT=0（23 文件 / 301 用例，含 `carrier.test.ts` 6 项冻结值守卫）、typecheck EXIT=0、lint（eslint + prettier --check）EXIT=0。防漂移机制：`carrier.test.ts` 把《17》全部冻结值锁为红测——任何值改动必须先改契约并递增版本。

## 五、波1~波3 前置契约声明

1. **波1（宿主服务端）**：以《17》全部字段级条款为验收权威——`packages/host/src/carrier/` 全域、`deriveCarrierEndpoints` 实现落 `@chips/bridge` carrier 分件并双侧契约测试锁一致、`ISessionSource` carrier 判别片进统一会话注册表（形状改动届时按 §4.1 同款公开面流程登记）、生命周期接线（runtime `start()` 后开监听、`shutdown()` 先关 carrier）、索引四事件重建与 `cli-task` 唯一存储。R3：app 臂依赖 `handleStartupInputs` 正式投递，未就绪则该臂继续挂工单039，service 臂不阻塞。
2. **波2（CLI 发现组装）**：`ICliInvoker` 承载实装只消费 carrier 分件常量/类型；`CHIPS_CARRIER_SOCKET` / `CHIPS_CARRIER_DISABLE` 读取与严格错误语义；按需拉起按《17》§5.2 候选布局与 30s/超时/回退链；`chips dev run` devHost 臂并轨（Q8），禁第二套 dev 端点字面量；e2e stub 宿主按正式协议实现，是波0 契约的独立实现者（跨仓契约锁）。
3. **波3（#122 恢复与真 Electron 臂）**：最小集含真 Electron 旗标臂（`CHIPS_E2E_REQUIRE_*` 双态 fail-closed），退出码与信封逐字段断言；聚合闸与旗标臂由主智能体串行终验。
4. 任何波不得先于契约改字面量、封套、reason 词表（扩值须改《17》并版本递增）；波0 冻结面即三仓唯一仲裁依据。

## 六、影响范围与验证

- 改动面：文档库《17》新篇（主文件 + 7 分件）、README 索引与统计行（v2.2.1）、07.01/07.02/07.03/07.12/07 主文件（行级指向 + 版本 + 变更记录）；`packages/bridge/src/protocol/carrier.ts`（新增）、`carrier.test.ts`（新增）、`protocol/index.ts`（再导出）。禁触面（host/cli/core-rust/tests/perf 源文件）零改动。
- 三类版本：平台统一版本不变；`CORE_ABI_VERSION` 不变（纯 TS 类型/常量 + 文档）；`chip_standards_version` 无关。
- 验证：文档链检（task043 脚本）0 坏链；bridge 包四闸见 §4.2 数字；G8 快照零漂移。

## 七、主智能体验收与裁定（2026-09-21，任务 #138）

验收方式：全文读交回账（/tmp/w138_state.md）+ 主智能体独立复跑定点闸 + 五处落盘面抽查。复跑数字（真实退出码）：bridge `test` EXIT=0（23 文件/301 用例）、`typecheck` EXIT=0、`lint`（eslint+prettier）EXIT=0、`test:contract` EXIT=0（67 项，G8 快照零扰动）；文档链检 EXIT=0（**7,268 链/0 坏链**）。抽查吻合：《17》主文件+7 分件八件在册、`carrier.ts` 恰 25 条 `export`、07 主文件变更记录表尾置于 **文档结束** 之前（判例 8b13c6cbf）、win32 pipe 散列名与 socket 缩短形态/`reason` 六值封闭词表逐字在册、`protocol/index.ts` 再导出在位。

两项交回裁决定性：

1. **收口账以派单口径为准（确认，无需返工）**：评估稿 §五波0 行「封套编解码纯函数与契约测试夹具」按派单书「零行为实现」执行——封套为 `IBridgeRequest/IBridgeResponse` 类型别名复用（零新序列化，序列化收敛 JSON 已在《17》§3.5 冻结为规范条款），夹具职责由 `carrier.test.ts` 六项冻结值守卫承载，e2e stub server 作为波0 契约独立实现者归波 2（本 RFC §五.2 在册）。账面定性：本波交付=契约冻结+公开面落面，无行为实现为设计内。
2. **契约自拟细则五项全部批准（裁定框架内字段级补充，非新裁定）**：①JSONL 换行帧分界（§2.1-3）；②win32 pipe 名散列形态 `\\.\pipe\chips-carrier-<H>`（H=SHA-256(userData) 前 16 位，多用户并发不互踩）；③socket 超长缩短名 `chips-c-<H>.sock` + fail-closed（§2.3）；④`details.reason` 词表由三值扩至六值封闭（补 `carrier_unavailable`/`connection_lost`/`route_unregistered`），且「reason 词表只管传输/握手层定性、handler 级业务域码走封套 error 不进表」的收口条正确——与 Q5「零新码族」裁定兼容（零新增错误码值，仅 details 细分）；⑤§5.2 三平台宿主 bin 候选布局（darwin `Contents/MacOS/Chips` 等）。后续任何波扩 reason 值一律走《17》改面+版本递增（§五.4 纪律随账生效）。

波1~波3 前置契约声明（§五）即时生效，为三仓唯一仲裁依据。

**文档结束**
