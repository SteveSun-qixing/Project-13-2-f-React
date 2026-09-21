# 立项评估：CLI 宿主驱动链路协议（工单039 · 任务 #136）

- 性质：立项评估设计稿（纯调研，零代码、零既有文件改动），供主智能体做跨仓契约裁定。**状态：已验收，Q1–Q9 裁定与 R3 登记见第八节；波0 契约冻结已据此派单。**
- 需求权威：`项目日志与笔记/工单039-CLI宿主驱动段无正式承载链路服务路由无服务端实现且发现协议未定义/任务说明.md`（下称「任务说明」，其第二节 文件:行号 证据已由主智能体逐条核证，见其第六节）。
- 波次锚点：`重构大计划/00-总纲与路线图.md:38`（W3 全链路测试定义）、`重构大计划/W3-开工波次计划.md:43`（W3-P1-2 行：传输形态/端点发现/握手/鉴权四段协议定义 → 路由服务端 → CLI 发现组装；其后恢复 #122 最小集含真 Electron 旗标臂）。
- 架构红线约束（根 `AGENTS.md`）：Host 是唯一运行时承载；服务间调用必须走内核路由；禁止跨服务直接 import。本稿所有方案均在此红线内评估。
- 日期：2026-09-21。

---

## 一、背景与现状账

### 1.1 承诺面（在册权威）

《07-CLI完整参考》对宿主驱动段的正式承诺：

| 承诺 | 权威位置 |
|---|---|
| §3.10.1 CLI 按需启动本次命令所需的短生命周期承载环境，用户不需先 `chips start` | `薯片生态文档库/06-开发与运维/07.03-07-CLI完整参考-三、用户侧命令 chips.md:346` |
| §3.10.2 `service` 目标经平台能力注册表与调用链路调用声明能力 | 同文件:347 |
| §3.10.3 `app` 目标按「启动并投递」以 `source: 'cli'` 调用 `command:invoke` | 同文件:348 |
| §5.8 `cli.command.*` / `cli.task.*` 是 CLI 扩展唯一服务路由集合，不得新增第二套命令索引或任务存储 | `薯片生态文档库/06-开发与运维/07.12-07-CLI完整参考-五、插件 CLI 命令扩展-5.8 发现与任务服务路由.md:14-29` |
| §5.8 发现索引只读，安装/启用/禁用/卸载后由平台重建 | 同文件:27 |
| `command:invoke` 不隐式启动应用；平台侧调用方「启动并投递」由 CLI/平台启动契约承载 | `薯片生态文档库/05-接口与契约/13.04-13-命令系统契约-四、执行与结果.md:53-54` |
| 退出码 6（`CLI_TARGET_UNAVAILABLE`）、9（`CLI_TIMEOUT`，等待任务**或承载链路**超时）语义以承载链路真实存在为前提 | `薯片生态文档库/06-开发与运维/07.02-07-CLI完整参考-二、调用约定.md:142、147` |

### 1.2 已绿面（CLI 离线链，不需返工）

- 消费端语义完整：`chips-ecosystem/packages/cli/src/client/service-router.ts:58-134`（`cli.command.*` / `cli.task.*` 请求方封装，形状与 §5.8 路由表逐行对应）、`:141-145`（`command:invoke` 携带 `source: 'cli'`）、`:158-163`（`service` 目标能力调用）。
- 执行时序完整：`chips-ecosystem/packages/cli/src/plugin-cli/execute.ts:161-267`（service 同步臂 `:169-184`；app 任务臂 create→启动并投递→invoke→bindInvocation→轮询终态 `:203-242`；轮询 `:270-284`，间隔 50ms 见 `src/constants.ts:14`；启动等待超时 30s 见 `src/constants.ts:11` 与 `execute.ts:321-340`）。
- 无承载回退定性钉死：发现阶段 `CLI_TARGET_UNAVAILABLE` → `CLI_COMMAND_NOT_FOUND`/退出码 3（`src/run.ts:157-166`）；固定根先行定性不依赖索引（`src/run.ts:144-155`）；`chips host *` 拒绝面双向钉死（`tests/e2e/cli/tests/cli-surface.test.ts:94` 与 `packages/cli/tests/dispatch-command-not-found.test.ts:66-68`）。
- 离线产物引擎链完整且进程面实测：pack/validate（ed25519 签名与验证——`src/artifacts/cpk-pack.ts:171` 算法字面量、`src/artifacts/cpk-validate.ts:419、456、487-488` 验签实现）、信任根注入面 `CHIPS_TRUST_ROOTS_FILE`（`src/artifacts/trust-roots.ts:20`，登记于 `07.02:161`）；`tests/e2e/cli/tests/` 四套件（`cli-surface` / `golden-chain` / `no-carrier` / `scaffold-roles`，67 案含循环展开，派单书口径）一律 spawn 真实 `packages/cli/dist/bin.js`（`tests/e2e/cli/tests/support/harness.ts:5-9、50-59`；bin 指向 `packages/cli/package.json:10-12`），禁 import 内部函数走捷径。
- 包内单元/进程双层基线：`packages/cli/tests/**` 22 文件 / 497 用例全绿（任务说明 §5 留档口径）。

### 1.3 缺位面（挂账证据，file:line）

**缺口 A：路由服务端零实现。**

- `packages/host/src` 全量无任何 `cli.command.*` / `cli.task.*` / `command:invoke` 服务端注册面（任务说明 §二·缺口A 第 2 条，主智能体核证在案）。宿主现有路由只有 Bridge 能力路由：`packages/host/src/runtime/capability/router.ts:68`（`registry.get(request.capabilityId)` 命中制），入口挂在 Electron IPC 会话面 `packages/host/src/runtime/host-runtime.ts:303-313`（`ipc.handleRequest(source, request)`，`source` 只有 `{windowId, frameId}` 形态，见 `:166-168` 会话键构造 `session:${windowId}:${frameId}`）。
- SDK 侧消费端自述依赖注入服务传输：`packages/sdk/src/client/cli-command-api.ts:8`；而 SDK 的 bridge 客户端读取渲染进程 `window.chips`（`packages/sdk/src/client/chips-bridge.ts:143`），外部 node 进程不可得。
- Rust 内核无服务路由实现；唯一相关命中是 `packages/core-rust/crates/chips-bridge/src/naming.rs:100-104` 的 `cli:task-*` **能力 ID 命名注册**（插件 Bridge 消费面，与 §5.8 服务路由面正交，任务说明 §二·缺口A 第 3 条）。
- 全仓无 `@chips/cli` 消费者（任务说明 §二·缺口A 第 4 条），发行包装配入口缺位。

**缺口 B：跨进程发现与传输协议未定义。**

- 真实可执行入口从不发现宿主：`packages/cli/src/bin.ts:8`（`main(process.argv.slice(2))` 无选项）→ `packages/cli/src/main.ts:64-69`（缺省 `createLocalClient({})`）→ `packages/cli/src/runtime/local-client.ts:32-41`（缺省 invoker 恒以 `CLI_TARGET_UNAVAILABLE` 拒绝）。
- 注入面只有编程式端口 `ICliInvoker.request(id, input)`（`packages/cli/src/client/types.ts:17-19`；生产供给方注释见 `service-router.ts:33-34`）。
- 协议留白自述：`service-router.ts:9-10`——「其余平台操作……**在承载链路协议落地前**由承载适配器实现」。
- 全生态文档库「承载链路」仅三处引用性提及、零定义：`07.01:21`、`07.02:147`、`07.03:64`（本稿复核一致）。
- 环境变量面无任何端点/发现变量：`07.02:154-161` 全表六行均非承载端点；运行标记 `host-state.json` 被 §3.2.2 明文排除（`07.03:64`：「插件命令的承载链路不依赖该标记」）。

**结论**：消费端（CLI）与承载判定（回退码）已完备且被钉死；缺的是中间「协议 + 服务端」两层。任何一端都不需为对方重做，这正是本稿四段协议 + 落点方案的设计空间。

---

## 二、四段协议逐段设计选项

### ① 传输形态

| 方案 | 机制 | 优点 | 缺点 |
|---|---|---|---|
| A. Unix domain socket（POSIX）+ Windows named pipe | Node `net` 对等原语（`path` 型 server/client；Windows 走 `\\.\pipe\…`），一 host 实例一侧常开监听 | 内核级文件权限保护（socket 文件 `0600`）；无 TCP 端口 squatting/防火墙；纯本地不可远程；多客户端并发天然；真实进程 e2e 可直接 spawn 被测 CLI 连 stub server，与 `tests/e2e/cli` harness 纪律同构 | Windows named pipe 无 POSIX 权限语义（以 pipe DACL/当前用户目录兜底）；需处理 macOS `sun_path` 长度上限（约 104 字节，短 socket 文件名可控）；需定义陈旧 socket 文件清理 |
| B. localhost TCP + 端口登记 | host 监听 `127.0.0.1:0`，实际端口写入发现文件，CLI 连接 | 跨平台行为最一致；调试直观（nc/openssl s_client 不适用但 curl 生态熟） | 无内在鉴权：任意同机进程可连接，鉴权全压在握手 token（与 A 相比多一层必须项）；端口占用/竞态；本机防火墙与容器网络语义干扰；`0.0.0.0` 误绑风险面 |
| C. stdio 子进程长连（CLI 按需拉起专属短生命周期 host 子进程，管道通信） | CLI spawn `chips-host --carrier-child <一次性参数>`，stdin/stdout 帧协议 | 与 §3.10.1「按需启动短生命周期承载环境」字面最贴；零发现（父子自明）；零鉴权面（管道只此一对端点） | Electron 主程序是 GUI 子系统应用，stdout/stderr 在生产打包态不可靠（Windows 无控制台）；与单实例锁冲突：`packages/host/src/main/main.ts:68`（`requestSingleInstanceLock`）下第二实例立即退出，「专属子实例」需新造一套旁路实例语义，直接冲击壳生命周期与 `userData` 并发写安全；已在运行的宿主与专属子实例并存 → 命令索引/任务存储出现第二份，违 §5.8「不得新增第二套」（`07.12:29-33`） |
| D. 文件信令（mailbox 目录轮询） | 请求/响应落文件 | 零 socket 依赖 | 时延与轮询节奏、文件原子性、崩溃残留全都要自造协议，劣于 A/B 任何一档；仅列示后即弃 |

**推荐：A（UDS + Windows named pipe）。** 放弃 B 的代价是把鉴权完全压在应用层 token 上并引入端口管理；放弃 C 的代价其实不是 stdio 本身——「按需拉起」的正确解法应作用在 A 的连接模型上（发现失败 → 以正常单实例方式拉起宿主，宿主 ready 后经同一 socket 服务，见 §五与 Q6），而不是为 CLI 造旁路实例；放弃 D 无理由。

### ② 端点发现

| 方案 | 机制 | 优点 | 缺点 |
|---|---|---|---|
| A. 承载登记文件（发现文件） | host 在监听就绪后写一个确定路径的 JSON：`{ protocol, instanceId, socketPath, pid, startedAt, bearerToken }`，文件权限 `0600`；停机删除；启动时清理陈旧（PID 存活 + `startedAt` 双判据）；CLI 按固定路径读取→连接→握手校验 | 单一确定入口，与运行标记 `host-state.json`（工作区面，`packages/cli/src/client/types.ts:24`）语义区隔清晰，不违反 `07.03:64`「承载链路不依赖该标记」；陈旧治理有既有「幂等标记」先例风格（`packages/cli/src/commands/workspace-state.ts:9-27`） | 落点路径需跨进程可推导（host 的 `userData` 与 CLI 的可见路径必须一致，见 Q2）；写删需原子（临时文件 + rename） |
| B. 环境变量注入 | `CHIPS_CARRIER_SOCKET` 显式给出 socket 路径，优先级高于发现文件 | dev/e2e 零污染（stub server 注入即测）；有完全同形先例：信任根注入面 `CHIPS_TRUST_ROOTS_FILE`（`packages/cli/src/artifacts/trust-roots.ts:20`，登记于 `07.02:161`） | 独立终端场景下父 shell 环境通常没有该变量——只能当覆盖面，不能当主面；入册需扩 §2.7 环境变量表（RFC 先行） |
| C. 广播/知名端口/进程枚举 | UDP 广播、固定端口扫描、OS 进程枚举 | 无文件 | 本地 IPC 场景纯负资产（噪声、扫描越界嫌疑、竞态）；列示即弃 |

**推荐：A 为主面 + B 为显式覆盖面（B 命中即跳过 A）。** 这是 `07.02` 既有「命令面唯一正式注入通道=环境变量」纪律（trust-roots 头注 `:1-12` 同款口径）在承载域的平移。

### ③ 握手

**封套与帧形状。** CLI 消费端形状已经定死：`ICliInvoker.request(id, input) → Promise<output>`（`packages/cli/src/client/types.ts:17-19`），错误以 `CLI_*`/在册域码分类驱动退出码。Bridge 线封套 `IBridgeRequest { requestId, capabilityId, input }` / `IBridgeResponse { requestId, ok, result | error }`（`packages/host/src/protocol/wire.ts:25-37`，权威为《02-Bridge三层设计》§7.2）与之同构。**推荐**：承载链路直接复用 Bridge 请求/响应封套形状（错误对象复用 `IWireChipsError`，`wire.ts:12-23`），路由 ID 空间取 §5.8 在册路由名（`cli.command.*` / `cli.task.*` / `command:invoke`），序列化按《02》§7.3 结构化克隆约束收敛为 JSON（`薯片生态文档库/01-架构设计/01-子系统设计/02.07-02-Bridge三层设计-七、IPC 通道与消息格式.md:84-87`：camelCase、epoch 毫秒、可选字段语义）。这样 CLI 消费端**零改动**、错误面/退出码面**零新增**，服务端把 `capabilityId` 槽当 `routeId` 用。
- 注意红线不松动：这不等于把 `cli.*` 塞进 Bridge 能力注册表。`cli.*` 是平台服务路由（`07.12:12`：「CLI 与 SDK 消费；插件不得直接调用内核路由」），能力 ID 命名面 `cli:task-*`（`naming.rs:100-104`）是插件 Bridge 消费面，两者正交，服务端实现应各走各的门（详见 §四）。
- 类型唯一来源：封套与握手常量应落 `@chips/bridge` 包协议分件（现 `chips-ecosystem/packages/bridge/src/protocol/` 已是 host/sdk 共同的协议层家），CLI 与 host 都以 workspace 依赖消费（CLI 已依赖 `@chips/bridge`：`packages/cli/package.json:31-34`），避免第三份封套实现（工单024 ChipsError 四份分叉的教训同族防线）。

**版本协商。** 不复用 `chips-card-window-init/1`（该通道语义是宿主内部窗口装载投递、信任上下文是「插件不可见不可订阅」的宿主自有 RenderHost 面，`packages/host/src/shared/card-window-init-surface.ts:70-75` 信任边界头注；与本协议「外部独立进程入站」方向相反）。**只复用其纪律先例**：版本字面量为唯一名字来源、升级走版本号协商、禁止特性探测式分支（`card-window-init-surface.ts:62-66`；同纪律 `packages/host/src/renderer/frame-protocol.ts:17` `chips-frame/1`，握手令牌一次性下发先例 `:250-255` 与《05-渲染引擎设计》05.09 握手段：`薯片生态文档库/01-架构设计/01-子系统设计/05.09-05-渲染引擎设计-九、高度自适应与宿主-内容通信协议.md:16、20、25`）。
- 新协议字面量：**`chips-cli-carrier/1`**。连接建立后首帧为握手请求（非 §5.8 路由帧）：CLI → `{ protocol: 'chips-cli-carrier/1', clientId, bearerToken }`；host → `{ protocol, negotiated: 'chips-cli-carrier/1', hostVersion, instanceId }`。版本不匹配回结构化错误（在册 `BRIDGE_*` 域码不合适，新增 `CLI_*` 码也不合适——握手失败对 CLI 的既有语义就是「无承载」，落 `CLI_TARGET_UNAVAILABLE` 由既有回退链消化，`run.ts:157-166`），具体码表归契约冻结波裁定（Q5）。
- 握手超时：短常量（建议 5s，与帧握手 `05.09:20`、启动等待 30s `execute.ts:321-340` 分层不冲突），超时按无承载定性。

**单实例多 CLI 并发。** Electron 单实例锁（`main.ts:68-71`）保证发现文件指向的 host 全机唯一（每 OS 用户）；一 host 侧一个监听端点，CLI 每次进程调用 = 一条连接 = 一个服务端请求会话，用完即关，无跨调用复用、无多路复用长连。`cli.task.*` 轮询（50ms 间隔，`execute.ts:276-284`）在同一条连接内串行完成，天然无并发争用。多 CLI 并发各自独立连接；服务端把每条连接映射为一个会话（§四·会话面）。

### ④ 鉴权

**威胁模型（如实划界）**：信任域 = 当前 OS 用户。同用户下任何进程即「本机自身」，这是所有本地 IPC 体系（docker.sock、SSH agent、VS Code IPC）的共同边界。防御目标：(a) 不同用户/越权进程不得触达；(b) 同机自动化/脚本不得**在宿主会话内**取得超出目标插件授权记录的能力（由权限判定门承载，不由传输层承载）；(c) 防对发现文件的离线伪造。不防御：同用户恶意进程读取 `0600` 文件并连接——它已经能以该用户身份直接执行任何用户命令，防它超出本协议职责。

| 方案 | 机制 | 评价 |
|---|---|---|
| A. OS 边界 + bearer token | socket 文件与其所在私有目录权限 `0600`/`0700`（第一道，挡不同用户）；发现文件内的随机 `bearerToken`（host 启动生成，握手帧携带，服务端常量时间比较）作为**实现一致性校验**（防同名 socket 被第三方抢先 bind 的本地 squatting、防陈旧发现文件错位） | 实现成本一个随机数 + 一次比较；边界如实：同用户进程可取得 token——但同用户进程本就能直接读写该工作区全部数据，无增益攻击面。**推荐** |
| B. ed25519 挑战-响应互鉴 | 复用信任根表形状（`keyId → SPKI PEM`，`trust-roots.ts:1-12`）：host 持长期密钥签发身份，CLI 持公钥表验证；反向 CLI 签名则需 CLI 私钥分发面 | 表面复用实为语义错位：CPK 信任链保护的是**插件制品完整性**（`cpk-validate.ts:419-488` 验签闭包 + `CHIPS_TRUST_ROOTS_FILE` 注入），不是**进程身份**；host 侧当前无自己的可分发公钥信任根（编译期内嵌注册表内容为缺位状态，工单028，见 `packages/host/src/main/production-assembly.ts:203` 注释），CLI 侧也无「宿主发行密钥 → 信任根表」的正式登记链路。补齐这两条链的成本远超承载域收益，且给出「密码学互鉴」的**虚假安全感**（同用户仍可读取 host 私钥文件）。**放弃**，仅登记为远期加固候选（若未来引入 OS keychain/代码签名核验再议） |
| C. 对端凭据（`SO_PEERCRED`/`LOCAL_PEERCRED` + pid 校验） | 内核级对端用户/进程校验 | 可作为 A 的**免费增强**（同机他用户凭据直接拒），无独立成方案的必要；macOS/Windows 可得性差异大，Windows named pipe 侧改查 pipe ACL。建议写入契约作为「实现许可的额外校验」而非规范必项 |

**鉴权之后的权限面（不可绕过）**：承载链路只解决「谁能进门」；进门后每个 `cli.task.*` / `command:invoke` 的权限判定必须复用既有运行时判定链——能力路由权限门（`router.ts:80-99`）与《08-权限系统设计》链路三运行时判定（`薯片生态文档库/01-架构设计/01-子系统设计/08.07-08-权限系统设计-七、链路三：运行时判定.md:10`）；CLI 预检面（`execute.ts:136-154` 读 `platform.pluginInfo` 的授权记录）与服务端判定以同一授权记录为唯一事实源，`07.12:12`「插件不得直接调用内核路由」的反向承诺（宿主不得绕过自己的权限门）由本条守住。

---

## 三、与既有契约的关系表

| 在册契约 | 权威位置 | 承载判定 | 说明 |
|---|---|---|---|
| §5.8 服务路由集合（请求/响应负载形状） | `07.12:14-29、29-33` | **可直接承载** | 本协议即其传输层；路由名、输入输出、唯一集合约束逐行照搬，不新增第二套 |
| §5.8 发现索引重建（安装/启用/禁用/卸载） | `07.12:27` | **可直接承载** | 服务端重建钩子挂装载器生命周期（§四） |
| 命令系统「启动并投递」 | `13.04:53-54、:29-31`（`command:invoked` 事件派发，至多一次） | **可直接承载** | `apps.ensureRunning`（消费面 `execute.ts:188-194、:222-228`）服务端腿 = 正式启动链路 + 事件投递，在册语义不动 |
| Bridge 线封套与序列化约束 | `wire.ts:12-37`；`02.07:84-87`（§7.3） | **可直接承载（形状）** | 承载链路复用封套形状与 camelCase/epoch 毫秒/错误对象约束；`02.07` §7.1 通道总表（`:12-16`）本身只管 Electron IPC 内部面，**不覆盖**跨进程链路 → 需在新增文档面定义（下行） |
| `@chips/bridge` 包公开面 25 成员裁定 | `项目日志与笔记/RFC-chips-bridge契约发布面裁定/RFC-chips-bridge契约发布面裁定.md:16、:34`（`:50` `open_session` 会话快照口径） | **可承载（接线口径参考）** | 服务端会话登记语义（授权快照 + 插件 ID）沿用 `open_session` 裁定的快照覆盖纪律；Rust 面本波不动（禁触中） |
| 权限模型《08》链路三运行时判定 | `08.07:10`；`router.ts:80-99` | **可直接承载** | §④鉴权后置门；CLI 会话权限快照来源=目标插件授权记录 |
| `chips-frame/1` / `chips-card-window-init/1` 握手先例 | `frame-protocol.ts:17、:250-255`；`card-window-init-surface.ts:62-66、:83、:70-75`；`05.09:16、:20、:25` | **仅纪律先例** | 版本号字面量、协商不探测、一次性令牌三原则平移；两个既有协议本身不承载 CLI 链路（方向相反/语义不同） |
| CPK ed25519 信任链 | `trust-roots.ts:20`；`cpk-validate.ts:419-488`；`07.02:160-161` | **不承载** | 语义错位（制品完整性 ≠ 进程身份），§④方案 B 放弃理由；信任根表形状只作远期候选参考 |
| 环境变量表 §2.7 | `07.02:154-161` | **需新增文档面** | 新发现覆盖变量 `CHIPS_CARRIER_SOCKET`（命名待裁，Q4）须 RFC 先行入表；沿用 trust-roots 注入面的严格错误语义风格 |
| 「承载链路」术语本体 | `07.01:21、07.02:147、07.03:64`（全库仅三处引用性提及） | **需新增文档面** | 主定义落点建议：**05-接口与契约层新增《17-CLI 承载链路契约》**（跨 CLI/host/SDK 三仓消费者、含封套/握手/发现/鉴权全套契约字段，性质与 13/14/16 同级）；`07-CLI完整参考` 相关行改为指向该文，`01-架构设计/01-子系统设计` 落一节设计 rationale（或 ADR）。此归属为裁定项 Q3 |
| 退出码 6/9 有承载语义 | `07.02:142、:147` | **服务端落地后自动兑现** | 无需改码表；`CLI_TIMEOUT` 的「承载链路超时」分支自协议落地起可实测 |

---

## 四、路由服务端落点方案（宿主侧）

### 4.1 模块挂点

新增 `packages/host/src/carrier/` 域目录（与 `capabilities/document/` 同构的端口-适配器布局）：

- `carrier/protocol.ts`——握手帧与常量（类型实际来源放 `@chips/bridge` 协议分件，此处再导出宿主视图）；
- `carrier/server.ts`——`net` 监听（UDS/named pipe 平台分叉收敛于此）、连接→握手→封套编解码→按 `routeId` 派发；
- `carrier/routes.ts`——`cli.command.*` / `cli.task.*` / `command:invoke` handler 集合（§5.8 一一对应，**独立服务路由表**，不进 Bridge 能力注册表：能力 ID 文法 `^[a-z][a-z0-9-]*:…$` 面向插件能力面，`cli.*` 点名进注册表会污染编目与 R19 映射；两表在文档与代码中都不存在包含关系，`07.12:12` 的「平台内部服务路由」定性保持）；
- `carrier/command-index.ts`——发现索引：从装载器注册表（`production-assembly.ts:202` `openPluginRegistry`）与插件 manifest 命令声明构建，安装/启用/禁用/卸载四事件触发重建（`07.12:27`）；每次读取最新、不缓存；
- `carrier/task-store.ts`——`cli-task` 唯一任务存储（内存面；§5.8 禁第二套 → 它就是那套，不持久化，`07.12` 无持久化承诺）；
- `carrier/registry-file.ts`——发现文件写/删/陈旧清理。

### 4.2 与组合根/壳的接线缝

- 装配：`createProductionAssembly` 的 `createRuntime`（`production-assembly.ts:245-311`）内构造 carrier 端口，随 `createProductionRuntime` 选项透传（与 `documentViewChannel` 同款透传模式，`:100-104` 注释口径）；
- 生命周期：carrier 监听与发现文件写入挂在 runtime `start()` 成功后（`host-runtime.ts:387-392`）、由壳启动序（《17-跨端Shell》§2.4 启动顺序，`production-assembly.ts:4` 引用权威）统一投递点触发；`shutdown()`（`host-runtime.ts:412-425`）逆序先关 carrier（拒新连接、在途连接以取消收口）再关会话；发现文件删除在 socket 关闭之后（先断入站再毁地址）；
- 派发腿：`command:invoke` handler 校验「目标 app 实例运行中」→ 经事件订阅中心向目标 app 会话投递 `command:invoked`（`host-runtime.ts:216-224、:364-379`），`COMMAND_OWNER_NOT_RUNNING` 语义按 `13.04:53` 原样；app「启动并投递」的 `apps.ensureRunning` 消费面（`execute.ts:188-194、:222-228`）对应服务端 = 正式启动链路（启动来源 `command`，`13.04:54`）——与 `handleStartupInputs`（`host-runtime.ts:399-405`，现为诚实 warn 留痕的启动输入面）同一门，打开路由核心装配进度是前置依赖，登记为拆波风险 R3。

### 4.3 会话面与「第二套会话表」红线

Bridge 会话表以 `windowId/frameId` 为键（`host-runtime.ts:166-168`），carrier 连接无窗口。路由面纪律「不重复实现第二套会话表」（`router.ts:8-9`）要求二选一：(a) `ISessionSource` 扩跨进程形态（`{ kind: 'window' | 'carrier' … }` 判别式，会话注册表 `capability/session.ts` 统一纳管）；(b) carrier 侧以「连接 = 一次性授权快照」直连 `evaluateHostPermissions`（`session.ts:281`），不建持久会话。**推荐 (a) 的最小实现**：carrier 连接在连接期登记为会话（权限快照 = 目标插件授权记录），复用既有 onClosed 清理链（订阅/句柄释放联动 `host-runtime.ts:259-274`）；连接级生命周期与文档/资源租约面（工单036 `chips-resource` 句柄租约）正交——carrier 会话不天然持有资源句柄，只有当被派发能力显式打开资源时才进句柄中心。此为裁定项 Q7。

### 4.4 崩溃与重启语义

- host 崩溃：发现文件陈旧残留 → CLI 读取后连接失败/握手失败 → 按既有「无承载」定性（发现失败 → 3；已建会话中途承载丢失 → 在途请求 Promise 拒绝 → `CLI_TARGET_UNAVAILABLE` → 6；任务轮询超 `CLI_TIMEOUT` 预算 → 9）——全部走既有回退链，CLI 侧零新码；host 下次启动自清（PID+startedAt 双判据）。
- 非终态 `cli-task` 不恢复：任务存储为宿主内存面，host 重启后 `cli.task.get` 返回 `CLI_TASK_NOT_FOUND`（`07.12:28` 在册码），CLI 如实收口；「重启续投任务」不是 §5.8/§3.10 的承诺，不做。
- CLI 先死：连接关闭 → 服务端释放该连接会话与其在途请求（`router.ts` 同族取消语义）；`job.cancelOnInterrupt` 腿（`execute.ts:208-219`）只处理 CLI 活着的中断。

### 4.5 按需启动短生命周期承载（§3.10.1）

推荐口径：发现失败（无发现文件/连接失败）时 CLI **拉起**本机宿主正常实例（exec 平台发行包入口，非旁路实例），轮询发现文件至就绪或 `CLI_TIMEOUT`；命令完成后宿主是否自遮蔽/退出由平台发行包的「工作区运行标记」语义另裁（Q6——`07.03:64` 已定调运行标记不是承载前置，故「拉起后不退出」也合法）。v1 底线（若 Q6 裁定不做自动拉起）：发现失败按现行 3 回退（`run.ts:157-166`），§3.10.1 挂账续留工单039——**这是功能兑现差异，不是协议差异，四段协议不因此改动**。

---

## 五、拆波建议

| 波 | 内容 | 文件面 | 验收闸 |
|---|---|---|---|
| 波0 契约冻结 | RFC 评审收口 + 新增《17-CLI 承载链路契约》（05 层）+ §2.7 环境变量入表 + §3.10/5.8 指向行更新 + `@chips/bridge` 协议分件新增 carrier 封套/握手**类型与常量**（含封套编解码纯函数与契约测试夹具）+ `ADR` 记传输选型 | `薯片生态文档库/05-接口与契约/17-*.md` 分件、`07.01/07.02/07.03/07.12` 行级指向、`packages/bridge/src/protocol/carrier.ts` + 测试、`项目日志与笔记/RFC-CLI承载链路/` | 文档 0 坏链闸（task043 脚本）；bridge 包测试绿且既有 25 成员裁定面零漂移；纯类型波不动 host/cli 行为 |
| 波1 服务端实现 | `packages/host/src/carrier/**` 全域 + 组合根/壳生命周期接线 + 索引重建钩子 | host `src/carrier/`、`src/main/production-assembly.ts`、`src/main/main.ts`（或 `application.ts` 生命周期位）、`src/runtime/`（会话源扩片） | host 包测试 + 定点闸；回路自测：进程内起 socket server → 真客户端连 → 握手/封套/权限逐在册码用例（含权限拒绝臂，对齐 W3-P1-4 口径）；`report()` 诊断面呈现 carrier 状态 |
| 波2 CLI 发现组装 | `packages/cli/src/runtime/carrier-client.ts`（发现/拉起/`ICliInvoker` 实装）+ `main.ts`/`bin.ts` 组装位 + 环境变量覆盖面 + `chips dev run` 的 devHost 适配器并轨（`service-router.ts:149-156`）评估 | cli `src/runtime/`、`src/main.ts`、`src/commands/dev.ts`（如并轨）；新增 `packages/cli/tests/carrier-*.test.ts` | cli 包测试 + 既有 22 文件/497 用例不回归；`tests/e2e/cli` 新增承载套件：stub 宿主进程（**按正式协议**的最小 server，测试资产非产品代码）+ 真 `dist/bin.js` 子进程，service 目标端到端信封逐字段（`07.02` §2.4.5）+ 发现失败 3/承载丢失 6/超时 9 臂 |
| 波3 #122 恢复与真 Electron 臂 | `tests/e2e/cli` 最小集补齐：app 目标 `cli.task.*` 轮询臂 + 真 Electron 宿主旗标臂（`CHIPS_E2E_REQUIRE_*` 双态 fail-closed，先例 `packages/host/tests/e2e-host/app-smoke.test.ts:24-25` 与 `tests/e2e/playwright.config.ts:20`） | `tests/e2e/**` 面 | 旗标臂由主智能体串行终验（W3 计划真进程承载纪律）；退出码与信封逐字段断言；聚合闸由主智能体批量跑 |

依赖关系：波0 冻结前，任何实现不得先造字面量/封套（防工单024 式分叉）；波1 依赖 4.2 所述启动路由装配（R3：若 `handleStartupInputs` 正式投递未就绪，app 臂可在波3 前继续挂账，service 臂不阻塞）；波2 的 stub server 是波0 契约的独立实现者（契约测试夹具在波0 落，两侧各自过夹具 = 真正的跨仓契约锁）。

---

## 六、未决问题清单（供主智能体裁定）

| # | 问题 | 选项 | 本稿推荐 | 理由 |
|---|---|---|---|---|
| Q1 | 传输形态 | A. UDS+Win 管道 / B. localhost TCP / C. stdio 子实例 | **A** | §①；C 与单实例锁和唯一索引承诺冲突 |
| Q2 | 发现文件与 socket 落点 | (a) 宿主 `userData`（`production-assembly.ts:201-202` 同根）派生 `<userData>/chips-carrier.{json,sock}`，CLI 侧需可推导 userData 路径（新固定根/常量对齐）；(b) 工作区目录内（每工作区一端点，但 host 实例是用户级单例，与工作区多开语义冲突） | **(a)**，CLI 推导方式（Electron userData 布局复刻 vs 常量协议路径）在波0 冻结 | 端点生命周期 = host 实例生命周期 = 用户级；工作区只是会话上下文参数 |
| Q3 | 协议文档归属 | (a) 05-接口与契约层新增《17-CLI 承载链路契约》；(b) 01-架构设计/01-子系统设计新增子系统篇；(c) 并入 07-CLI完整参考扩 §2.9 | **(a) 为主 + 01 层短设计篇/ADR 存 rationale** | 跨 CLI/host/bridge 三仓消费的可执行契约，与 13/14/16 同级；(c) 会让 CLI 参考文档承载宿主侧实现契约，越出其「只定义 CLI 自身行为」定位（`07.12` 头注:6） |
| Q4 | 环境变量命名与入表 | (a) `CHIPS_CARRIER_SOCKET`（仅覆盖发现文件）；(b) 再加 `CHIPS_CARRIER_DISABLE=1`（测试/脚本显式离线条，强制走现行 3/6 回退）；(c) 不加变量，测试全部注入发现文件 | **(a)+(b)** | (b) 给 e2e/CI 一个不依赖 tmpdir 清洁度的确定性离线条，巩固 `no-carrier.test.ts` 套件语义；两者同批入 §2.7，RFC 先行 |
| Q5 | 握手版本不匹配/令牌错误的错误码 | (a) 复用 `CLI_TARGET_UNAVAILABLE`（对外仍 6/回退 3，`details.reason` 区分）；(b) 新增 `CLI_CARRIER_*` 码族并入 §2.5 表 | **(a)** | 现码表已能表达全部 CLI 可观察行为（任务说明 §三「码表不动」口径）；新增族会把协议内部状态泄进用户契约 |
| Q6 | §3.10.1 按需启动兑现度 | (a) 波2 即做「发现失败自动拉起宿主」；(b) v1 只做发现，拉起留波3/独立波；(c) v1 拉起但要求宿主先装（发行包 bin 解析） | **(c)**，即：仅当能按平台发行包固定布局解析宿主可执行文件时自动拉起，解析不出按现行 3 回退 | 承诺不悬空又不引入「CLI 猜宿主装在哪」的新协议；工作区 `chips` 与宿主 bin 的相对布局在波0 一并冻结 |
| Q7 | carrier 会话纳管形态 | (a) `ISessionSource` 扩 `carrier` 判别片、进统一会话注册表；(b) 连接级授权快照直连权限评估器、不建会话 | **(a)** | 守住「不重复实现第二套会话表」（`router.ts:8-9`），免费获得关闭清理联动（订阅/句柄/文档会话）与诊断快照面统一 |
| Q8 | `chips dev run` 的 devHost 面（`service-router.ts:149-156`、`commands/dev.ts:48-69`）是否并入本协议 | (a) 并入：dev 宿主 = 同一 carrier 协议的 dev 工作区实例；(b) 独立通道后补 | **(a)** | dev/user 两入口「共用同一可执行文件、同一错误模型」（`07.01:21`）；再造一套 dev 端点即第二套协议雏形，直接触工单纪律 |
| Q9 | Windows named pipe 权限加固度 | (a) v1 只管 POSIX `0600`，Windows 侧如实登记边界；(b) v1 即写 pipe ACL | **(a)+工单随账** | 仓库当前正式门禁链在 darwin（开发/测试面全 macOS），先兑现主面、边界如实登记优于假装完备 |
| R3（风险登记，非选项） | app 目标「启动并投递」依赖启动输入正式投递装配（`host-runtime.ts:399-405` 现为诚实 warn 留痕面） | — | — | 若该面在 W3 尚无独立波承接，波1 需含其最小正式化，波3 排期随之顺延；service 臂不受影响 |

---

## 七、本稿纪律自查

- 零代码、零配置、零既有文件改动；除本文件与 `/tmp/w136_state.md` 外无落盘。
- 禁触面（`packages/core-rust/**`、`tests/perf`、`packages/host/src` 写面）全部只读或仅引任务说明既有核证行号。
- 所引 file:line 均为本会话实读核实（宿主/CLI/bridge/文档），任务说明中主智能体已核证的行号（如 `07.03:346`、`naming.rs:100-104`、`cli-command-api.ts:8`）沿用其口径。
- 引用性文档更新（§2.7 入表、《17》新篇）全部标注 RFC 先行，符合「文档口径先于实现」红线。

---

## 八、主智能体裁定（2026-09-21，任务 #136 验收随单）

验收定性：本稿全部实读核证通过；主智能体定点抽查六处引用（`main.ts:68` 单实例锁、`wire.ts:12-36` 封套三型、`router.ts:8-9` 第二套会话表红线、`host-runtime.ts:399-405` 启动输入诚实 warn 留痕、`service-router.ts:149-156` devHost 臂、`trust-roots.ts:19-20` 注入面先例）与真实代码逐处吻合。裁定如下，Q1–Q9 全部结案，R3 登记生效：

| # | 裁定 | 要点与约束 |
|---|---|---|
| Q1 | **采 A：UDS（POSIX）+ Windows named pipe（`node:net`）** | C 否决理由采信且为架构级：旁路实例与 `main.ts:68` 单实例锁、§5.8 唯一命令索引承诺直接冲突（双份索引即第二套）；B 无内在鉴权、端口管理负资产。「按需启动」解在连接模型（Q6），不在传输层造第二实例。macOS `sun_path` 104B 上限与陈旧 socket 清理细则入契约必项 |
| Q2 | **采 (a)：宿主 `userData` 派生承载登记文件 + socket** | 端点生命周期=host 实例生命周期=用户级，采信。CLI 推导方式增一条硬约束：**单一派生源**——承载路径推导规则（含跨平台 userData 布局）作为《17》契约的字段级规范落文，`@chips/bridge` 协议分件落唯一 `deriveCarrierEndpoints(userdataRoot)` 形态共享纯函数，host/CLI 双侧消费同一实现并由契约测试锁双侧一致；禁止 CLI 侧复刻 Electron 命名逻辑的第二份散落推导 |
| Q3 | **采 (a)：05 层新增《17-CLI 承载链路契约》主文档 + rationale 另落** | 05 层编号 17 经核证实用（该层现止于 16-卡片传输协议）；与 01 层《17-跨端Shell与平台抽象设计》同号不同层，属既有各层独立编号惯例（先例：05 层《02-SDK-API规范》与 01 层《02-Bridge三层设计》）。rationale 落 `项目日志与笔记/RFC-CLI承载链路裁定/`（比照插件执行通道 RFC 先例），传输选型理由入该 RFC，不在 01 层另开子系统篇（避免同一决策两处权威） |
| Q4 | **采 (a)+(b)** | `CHIPS_CARRIER_SOCKET`（覆盖发现文件）+ `CHIPS_CARRIER_DISABLE=1`（确定性离线条）同批入 §2.7 环境变量表；严格错误语义风格比照 `CHIPS_TRUST_ROOTS_FILE` 先例（未知值/空值拒绝口径入《17》） |
| Q5 | **采 (a)：复用 `CLI_TARGET_UNAVAILABLE`，零新码族** | 对外 6/回退 3 现行链消化，`details.reason` 词汇表（protocol_mismatch / token_invalid / handshake_timeout 等）作为《17》契约字段冻结，不落 §2.5 用户码表；`CLI_TIMEOUT` 承载链路分支自协议落地起可实测 |
| Q6 | **采 (c)：仅按发行包固定布局可解析宿主可执行文件时自动拉起** | 解析不出按现行 3 回退，bin 相对布局在波0 随《17》冻结（衔接工单019 bin 解析面口径）；「拉起后宿主是否退出」不入 v1（`07.03:64` 运行标记非承载前置已定调） |
| Q7 | **采 (a)：`ISessionSource` 扩 `carrier` 判别片，进统一会话注册表** | 守 `router.ts:8-9` 红线为强制项；免费获得 onClosed 清理联动与诊断统一，采信。carrier 会话不天然持资源句柄的口径入《17》会话章节 |
| Q8 | **采 (a)：`chips dev run` 并入本协议** | dev 宿主=同一 carrier 协议的工作区实例；第二套 dev 端点即第二套协议雏形，否决 |
| Q9 | **采 (a)+随账** | v1 只兑现 POSIX `0600/0700`；Windows named pipe ACL 加固作为「实现许可的额外校验」写入《17》非规范必项，边界随工单039 挂账至 Windows 门禁面立项（工单028 密钥材料面同族登记纪律） |
| R3 | **登记生效** | service 臂不阻塞波1；app 臂「启动并投递」依赖 `handleStartupInputs` 正式投递装配（现诚实 warn 留痕在案，非隐瞒）——若波3 验收时该面仍未就绪，app 臂继续挂工单039 本账，禁止以临时投递凑绿 |

**波0 派单增补裁定（公共资产面）**：`@chips/bridge` 协议分件新增 carrier 封套/握手类型与常量**授权落面**，但须走公开面正式化流程——先核证工单026「25 公开成员契约发布面」裁定的判定机制与快照锁，新成员按序正式化（快照随更新并登记于 RFC），**既有 25 成员面零漂移**；若判定面机制显示类型导出不进成员计数，如实登记后照常落面。波次划分按本稿 §五 采纳：波0 契约冻结 → 波1 服务端 → 波2 CLI 发现组装 → 波3 #122 恢复与真 Electron 臂（主智能体串行载体）。

**文档结束**
