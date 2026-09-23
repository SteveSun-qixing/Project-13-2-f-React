# RFC-原生承载面扩表裁定（工单036 依赖解锁 / W3：§11.3 Neon 暴露面文档承载四点扩表裁定）

> 版本：v1.0.0
> 日期：2026-09-23
> 状态：批准（主智能体裁定G，2026-09-23；OQ 七项定案见文末「裁定G 签批注记」）
> 关联：`项目日志与笔记/工单036-W3资源管理器未建文档scope-storage端口无正式适配器document能力整体诚实回退/任务说明.md` §二（现状证据）/§三.3（刀6 序列化归属）/§五（收口判据）、《04.11-04-资源管理设计-十一、Rust ResourceManager 与 Neon 暴露》§11.2/§11.3、《03.08-03-核心接口规范-八、Neon 绑定约定》§8.5/§8.6、《03.07-03-核心接口规范-七、资源管理器（chips-resource）》§7.1/§7.3、《11.05-11-文档服务设计-五、写入与原子性》（v1.0.0，本单写入权威规格）、《06.02-06-资源协议规范-二、URI 语法》§2.2/§2.3/§2.6、《RFC-权限审计跨层采集sink裁定》（结构与热路径口径母型）、《RFC-chips-bridge契约发布面裁定》§8.6/§9.2（导出面只增不改与 ABI 判例）、工单046 段四（第 50 导出 `auditBindDecisionSink` 落位先例，commit `188a99390`）、#204 臂②停手三依据与臂③投影形状冻结表先例

---

## 一、背景与动机

工单036 判定：宿主文档能力五端口中 `IDocumentScopePort` / `IDocumentStoragePort` / `IDocumentParserPort.serialize` 无正式适配器，`document:*` 能力整体诚实回退。回退的根因**不在 Rust 核心能力缺失**，而在 Neon 承载面（《04.11》§11.3 导出表，现行 15 行）未收录文档链路所需的四类载体。本 RFC 即对该**扩表四点**逐点位裁定：

1. **点位一**：`mount_directory` 文档目录挂载原生载体（Rust 侧 §11.2 在册、§11.3 无导出行）；
2. **点位二**：`register_scope` Document 种类作用域注册（现行 `resourceRegisterTempScope(path, writable)` 为 dialog 临时授权形态，无法承载常驻文档作用域）；
3. **点位三**：`managedUri ↔ localPath` 原生单源双向换算（现为 TS 侧止渴形态，见 §2.2 证据链）；
4. **点位四**：跨成员原子提交 + `parser.serialize` 完整承接（#204 臂②停手三依据：`total_size` 自引用需本点位、chips-parser 零 ZIP writer、目录-only 即临时版违禁）。

四点共同构成工单036 收口（`document:*` 真链闭合）的依赖解锁门票。**本 RFC 只裁契约与形态，零代码改动、零正式文档落文；实施归批准后的另立实施单**（比照《RFC-权限审计跨层采集sink裁定》流程判例）。

### 1.1 基线读取纪律声明

本文全部引用为 2026-09-23 工作树实读（工单046 段四已合并，HEAD 含 commit `188a99390`；`node packages/native/scripts/check-abi.mjs` 实跑输出 `[check-abi] 通过：导出 50 项，阻塞 0 项`，退出码 0）。native 测试基线 93、host 测试基线 1514、`abiVersion = 1`、导出面 50 项六域、文档链路口径以各文件行号实读为准。

### 1.2 变更前证据链（file:line 全核证）

| #   | 证据点                                             | 实读位置                                                                                                                                                                                                                                                                                                                                                                                                            | 结论                                                                 |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| E1  | §11.3 导出表现行 15 行                             | 《04.11》§11.3 表（`04.11-…Neon 暴露.md:137-153`）                                                                                                                                                                                                                                                                                                                                                                  | 表列形制「JS 函数｜参数｜返回｜说明」为本文新增行的比照对象          |
| E2  | 资源域 15 导出 Rust 侧在册名                       | `packages/native/src/abi.rs:63-77`（export_table! 全表 :28-79，共 50 项）                                                                                                                                                                                                                                                                                                                                           | `mount_directory` / `register_scope` / 双向映射 / 包级提交均无导出名 |
| E3  | 绑定层自述缺口                                     | `packages/native/src/resource.rs:30-32` 头注：「`mount_directory` / `register_scope`（Document 种类）不在十五导出内」                                                                                                                                                                                                                                                                                               | 缺口在册自证                                                         |
| E4  | 宿主消费面三项载体缺口注记                         | `packages/host/src/capabilities/document/adapters/native-resource-module.ts:23-31`：①作用域注册/挂载、②跨成员原子提交、③落盘序列化，「三项载体落地前正式适配器**不得**以部分实现形态拼装」                                                                                                                                                                                                                          | 工单036 禁内存替身/临时实现的宿主侧锚文                              |
| E5  | 装载闸                                             | 同文件 `NATIVE_RESOURCE_SURFACE_EXPORTS` 15 名（:51-67）；缺名即 fail-closed 四 reason                                                                                                                                                                                                                                                                                                                              | 扩表落位后的机械翻正点                                               |
| E6  | 生产接线诚实回退双 reason                          | `packages/host/src/capabilities/document/adapters/production-wiring.ts:184-197`：「§11.3 Neon 暴露面尚无作用域注册 / 挂载入口载体」「尚无跨成员原子提交与落盘序列化载体（刀6 裁决）」                                                                                                                                                                                                                               | 本 RFC 批准后随实施波删除的回退臂                                    |
| E7  | `document:*` 未注册形态                            | `packages/host/src/main/e2e-app.ts:70-79`（`normalizeSource` / `readFileBytes` `typeof` 缺位检查）                                                                                                                                                                                                                                                                                                                  | 真链闭合后翻正                                                       |
| E8  | 序列化拒止臂                                       | `packages/host/src/capabilities/document/adapters/native-parser.ts:391-403`：`serialize()` 直接 reject `BRIDGE_ERROR_CODES.capabilityNotFound`，注「刀6 裁决：落盘序列化权威归 W3 chips-resource 波，13 项解析导出面无序列化项」                                                                                                                                                                                    | 点位四宿主侧现状                                                     |
| E9  | 打开链时序（点位二/三的关键约束）                  | `packages/host/src/capabilities/document/service.ts:505-530`（`executeOpen`：`normalizeSource` :512 先行、`managedUri` 即会话身份键 `claimSessionIdentityOrThrow`）；:440-470（`establishRecord`：`parser.open({ localPath })` → `scope.registerScope({ documentId, managedUri, kind })` :458 → `openRecord` 持 `localPath`）                                                                                       | 作用域 ID 必须在挂载**之前**由本地路径确定性导出（见 §5.2）          |
| E10 | 端口形状                                           | `packages/host/src/capabilities/document/ports.ts`：`IResolvedDocumentSource{managedUri, localPath, form}` :34-42；`IDocumentScopePort` 头注 :16-18（§11.3 缺口口径）；`IDocumentSerializeRequest` :101-121；`IDocumentSerializedMember{packagePath, bytes}` :123-127；`IDocumentParserPort.serialize` :141；`IDocumentCommitRequest{localPath, form, members, removals}` :147-155；`IDocumentStoragePort` :167-174 | 端口契约已在册，扩表只需承接、不改端口                               |
| E11 | `managedUri↔localPath` TS 止渴（点位三变更前证据） | `packages/host/src/runtime/platform-resource.ts:9`（头注「真实核心装配后由资源管理器接管」）与 :46-101（`createPlatformResourceBackend`：仅 `platform` 单作用域、纯 TS 映射）；`packages/host/tests/helpers/document-fake-ports.ts:244-246`（`localPathOf` 仅 tests 替身）；`service.ts:413-422`（`recomputeDigestFromDisk` 依赖 record 持有的 `localPath`）                                                        | 生产面无任何常驻作用域双向换算载体                                   |
| E12 | 输入归一责任面                                     | `packages/host/src/protocol/resource-uri.ts:410-470`（`parseResourceUri`）、:479-495（`normalizeResourceInput`：`file://` → `UNSUPPORTED_SCHEME`）；《06.02》§2.2（`resource()` 拒 `file://`）与 §2.6（包内相对路径与 `file://` 归一责任在文档解析器，R13）                                                                                                                                                         | 归一发生在文档侧 `normalizeSource`，资源核心维持拒收口径             |

Rust 核心能力面（承前核证，全部在册）：`chips-resource` `manager.rs` —`register_scope` :388、`attach_scope` :393、`unregister_scope` :401-417（级联失效句柄/流/缓存）、`open_session` 四参 :418 起、`mount_directory` :813-860、`directory_mounted` :864-866、`mount_archive` :883-928、`register_temp_scope` :948-977；`scope.rs` —`ScopeKind` 七值 :26-41（`Document` 不区分卡片与箱子，R8）、`Origin` :47-58、`ScopeRegistration` :95-108、`card-`/`box-` 前缀校验 :119-130、`lookup` :207；`permission.rs` —`document()` 臂会话绑定读直通 :207-209、写需 `resources:write` :227-243；`write_coord.rs:1-40` 头注：仅路径写锁，**无**提交日志/包事务；`error.rs:14-51`：`RESOURCE_*` 18 码在册。`chips-parser`：`Cargo.toml`（全 14 行）无 zip 依赖、`src/source/archive.rs` 只读索引、yaml 模块 deserialize-only、`schema/card.rs:14` `card_id: Base62Id`、:39 `total_size` 必填。

---

## 二、Goals / Non-Goals

**Goals**

1. 对扩表四点逐点位裁定候选方案、推荐方案、JS 导出名与签名（逐字表行，比照 §11.3 四列形制）、Rust 挂点、错误码口径、会话/归属与安全口径、返回投影形状冻结行。
2. 裁定推荐落地：**新增 7 导出，导出面 50 → 57；§11.3 资源域表 15 → 21 行、解析域 13 → 14 行**；`coreAbiVersion` 不随动（§8.6 只增不改判例）。
3. 给出三方锁与落位即收紧的机械翻正点位清单、文档随动清单、实施波次切分与验收判据。

**Non-Goals**

1. 不改任何端口契约（`ports.ts` 五端口形状冻结）、不改既有 50 导出任何签名、不删任何导出。
2. 不裁 `dialog:*` 临时授权链改造（`resourceRegisterTempScope` 维持原签名原语义）。
3. 不裁渲染热路径性能（本文全部点位为冷路径/保存链，SLA 口径见 §8）。
4. 不做正式文档落文（§11.3/§8.6 等表格行由实施波随动，本文只列清单）。
5. 不裁工单036 收口后的能力注册翻正细节（装载段翻正判据在 E5-E7 锚点，实施单承接）。

---

## 三、总裁定一览

| 点位 | 推荐方案名                                                         | 新导出（JS 名）                                          | Rust 挂点                                                     | 核心改动量     |
| ---- | ------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------- | -------------- |
| 一   | A1「目录+归档双挂载一体承接」                                      | `resourceMountDirectory`、`resourceMountArchive`         | `manager.rs:813`、`manager.rs:883`（薄包装，零核心改动）      | 绑定层包装     |
| 二   | B2「不另立 register_scope 导出，由挂载入口钉死 Document 种类承接」 | （并入点位一，另立生命周期行 `resourceUnregisterScope`） | `manager.rs:401`（薄包装）                                    | 绑定层包装     |
| 三   | C2「原生单源双向换算两导出」                                       | `resourceLocalPathOf`、`resourceManagedUriOfPath`        | 正向 `scopes().lookup`（:364/:207）+ 反向新查询能力（小增量） | 小增量核心     |
| 四   | D3「序列化/提交双载体完整承接」                                    | `documentSerialize`（解析域）、`resourceCommitPackage`   | chips-parser 新序列化模块 + chips-resource 新事务引擎         | 重（真新能力） |

`50 → 57`，`abiVersion` 维持 1（新增不改签名，§8.6 判例：第 50 项 `auditBindDecisionSink` 落位时同为「总表+子系统文档随动、ABI 不随动」）。

---

## 四、点位一裁定：目录/归档挂载原生载体

### 4.1 候选对比

- **A0「既有导出已可组合承载，无需新增」**——诚实评估后拒绝。组合证明不成立：15 导出中无任何入口触达 `mount_directory`/`mount_archive`（E2/E3）；唯一相邻导出 `resourceRegisterTempScope` 语义被 Rust 侧锁死为 `ScopeKind::Temporary` + `temp-{n}` 命名 + `TEMP_SCOPE_OWNER` 哨兵 owner（`manager.rs:948-959`），且 dialog 授权域随对话框注销（《04.04》§4.9 零残留口径），与常驻文档作用域（《06.03》§3.2 注销时机表：宿主显式注销）不同型。无第三路径。
- **A1 双挂载一体承接（推荐）**——`resourceMountDirectory` + `resourceMountArchive` 两行。理由：①文档源形态本有目录态/归档态两种（`ports.ts:40-41` `DocumentForm`），只裁目录挂载会把诚实回退原样保留给归档态文档（`.card`/`.box` 单文件），等于半承接，违反「不做临时版」工程纪律；②Rust 侧两能力均为一站式原子入口：`mount_directory`（:813-860）内部完成 `attach_root → register_scope → attach_scope(session)` 且任一步失败全量回滚（不留半挂载，:849-860），`mount_archive`（:883-928）同型并强制 `read_only = true`（归档永不就地改写，《04.04》§4.8）；绑定层为纯薄包装，零核心改动。
- **A2 拆分裸导出 `resourceRegisterScope` + `resourceMountRoot` 两段**——拒绝。拆开注册与挂根会在导出面开出「已注册无根」的半装配悬置态，Rust 侧刻意以一体化入口消灭该态（回滚链 :849-860）；且双导出把 attach_scope 时序责任推给 TS，跨 Neon 边界重造已在核心内闭合的事务序。
- **A3 单导出多形态（`resourceMount(uri|path, form)`）**——拒绝。参数联合型违背导出面逐名窄签名惯例（§11.3 全部 15 行均扁平参数），且两种挂载的 kind 约束不同（目录域允许 Workspace/Document/Plugin/Temporary，`manager.rs:832-837`；归档域限 Document/Plugin，:883 段文档），合并会把校验分叉压进绑定层单点。

### 4.2 推荐方案细则（A1）

JS 导出表行（比照 §11.3 四列形制，资源域表新增；`scope` 命名规则见 §5.2）：

| JS 函数                  | 参数                                                                                 | 返回              | 说明                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------ |
| `resourceMountDirectory` | `(sessionId: number, scope: string, path: string, owner: string, writable: boolean)` | `Promise<string>` | 挂载目录域 Document 作用域（注册+挂根+绑会话一体，失败全量回滚），返回规范 `ScopeId` |
| `resourceMountArchive`   | `(sessionId: number, scope: string, path: string, owner: string)`                    | `Promise<string>` | 挂载归档域 Document 作用域（只读强制；索引构建失败整体回滚），返回规范 `ScopeId`     |

- **绑定层 kind 钉死**：两导出在 `packages/native/src/resource.rs` 包装内固定构造 `kind: ScopeKind::Document`（JS 面无 kind 参数——落位即收紧：宿主无法经此二入口注册 Workspace/Plugin 域，种类收窄由绑定层而非调用方保证）。前缀 `card-`/`box-` 由核心校验臂兜底（`scope.rs:119-130`）。
- **Rust 挂点**：`js_resource_mount_directory → ResourceManager::mount_directory`（`manager.rs:813`）；`js_resource_mount_archive → mount_archive`（:883）。两挂载均为磁盘 IO（存在性探测/归档索引），按 §8.3 线程规则以 `Promise` 交付（先例：`resourceCommitWrite`；对照 `registerTempScope` 同步形 :594 系历史在册，不随动不改写）。
- **错误码口径（零新增；2026-09-23 裁决I-② 措辞翻正）**：会话不存在 → `RESOURCE_PERMISSION_DENIED`（`reason = out_of_scope`，`manager.rs:818-828` 既有形制）；重复挂载 → `RESOURCE_ALREADY_EXISTS`（`directory.rs:116-117` / `archive.rs:126-127` / `scope.rs:193-194`）；根缺失、根存在但非目录、归档缺失 → `RESOURCE_NOT_FOUND`（`directory.rs:107-114` / `archive.rs:131-133`，细节仅携作用域根 URI，不泄露真实路径，《06》§7.1 既有口径）；归档损坏或含非普通条目 → `RESOURCE_INTERNAL`（`archive.rs:134` 兜底臂，非归档/结构损坏/索引期拒绝同臂）；origin/kind 越界 → `RESOURCE_INTERNAL`（`manager.rs:829-837` 目录臂与 :899-904 归档臂，绑定层 kind 钉死 `Document` 后 JS 面不可达，仅作核心内部兜底）；**挂载入口的宿主机路径参数不产生 `RESOURCE_PATH_INVALID`**——原句「路径非法 → `RESOURCE_PATH_INVALID`」按实读翻正：`mount_directory` / `mount_archive` / `attach_root` / `attach_archive` 四函数体内零该码产生位，canonicalize 失败落 `RESOURCE_NOT_FOUND`；该码依《06.02》§2.4 只覆盖**虚拟路径域**九词 reason（`separator`/`absolute`/`segment`/`encoding`/`control`/`unicode`/`length`/`platform`/`symlink`），产生位穷举于 `path_guard.rs`（13 处 + `:280`/`:355` 参数化 reject 闭包）、`uri.rs:330`/`:383`（受管与 external path 前导 `/`）与 `directory.rs:150`（符号链接臂重投回填规范 URI）；scope 命名违例 → `scope.rs` 校验臂既有在册拒绝码 `RESOURCE_INVALID_URI` + `reason = malformed_scope`（注册阶段即强制《06.02》§2.3 语法，判据单源谓词 `is_valid_scope_syntax`，裁决I-③ 落地波在册），不新立。
- **会话/归属与安全口径（N-1 精神）**：`sessionId` 必填且过活体闸（`sessions.get` :819）；`owner` 落 `ScopeRegistration.owner`（:95-108 在册字段），文档服务取固定平台服务身份常量（对照 `TEMP_SCOPE_OWNER` 哨兵先例，`manager.rs:948` 段文档），插件永不可达此二导出（导出仅宿主主进程装载，同 `resourceOpenSession`「主进程内部使用」口径，《04.11》§11.3 表既有行说明列同款措辞）。归档挂载强制只读，写入一律走点位四提交载体。

### 4.3 生命周期与注销时机（在册口径承接，零新裁）

| 阶段     | 时机                                                                                  | 依据                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 挂载     | `document:open` 的 `registerScope`（`service.ts:458`）经正式 scope 适配器触达挂载导出 | 失败即打开失败、不产生半开会话（`ports.ts:59` 头注在册语义；Rust 侧全量回滚链 :849-860 天然满足）                       |
| 存续     | 目录域/归档域作用域**不**随 `close_session` 自动摘除                                  | `mount_directory` 段文档（:810-812）与 `mount_archive` 段文档（:880-882）双在册：宿主显式注销，《06.03》§3.2 注销时机表 |
| 注销     | 文档记录驱逐/应用退出清理时 `resourceUnregisterScope`                                 | 级联失效句柄/流/缓存为 `unregister_scope` 既有形（`manager.rs:401-417`），零新语义                                      |
| 重复挂载 | 同 scope 二次 `mount` → `RESOURCE_ALREADY_EXISTS`                                     | 适配器按幂等信号处理：改走点位三 lookup 复用（§5.2）                                                                    |

`resourceRegisterTempScope` 的 dialog 生命周期（随对话框注销、零残留，《04.04》§4.9）与上表互不影响——两态作用域各有专责入口与注销时机，本 RFC 不合并、不改动任一侧。

---

## 五、点位二裁定：Document 种类作用域注册与命名

### 5.1 候选对比

- **B1「新增独立 `resourceRegisterScope(reg)` 导出」**——拒绝。文档链路的注册从不孤立发生：`establishRecord` 时序（E9）决定注册必与挂载、会话绑定同刻完成，点位一二导出已一体承接 `register_scope`（:388 本就为 `mount_directory` :849 内部调用）。独立裸注册导出仅制造悬置态入口（同 §4.1-A2 理由），且其参数面必然暴露 kind/origin/provider_id 全自由度，违背落位即收紧。
- **B2「由挂载入口承接 + kind 绑定层钉死」（推荐）**——点位一表行即本点位交付面；另立生命周期行（文档关闭/驱逐时注销）：

| JS 函数                   | 参数                                 | 返回            | 说明                                                                                                               |
| ------------------------- | ------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `resourceUnregisterScope` | `(scope: string, sessionId: number)` | `Promise<void>` | 注销常驻作用域：级联失效句柄/流/缓存（§11.2 注销级联口径）；幂等性由实施单按 `unregister_scope` 核心语义核证后在册 |

`sessionId` 入参为防御纵深：调用会话必须当前绑定该作用域（复用 `attach_scope` 的绑定集判定面），否则 `RESOURCE_PERMISSION_DENIED`（`out_of_scope`）——防止任一带会话的调用方枚举注销他域作用域（裸 `unregister_scope(scope)` 核心签名无会话参数，`manager.rs:401`，绑定层补闸）。

- **B3「扩展 `resourceRegisterTempScope` 参数承载常驻注册」**——拒绝（判例级禁止）：§8.6 导出面签名只增不改，改签名即 `coreAbiVersion` 递增、三方锁全数重排，代价与收益完全失衡；且临时域语义三处不同型（`temp-{n}` 命名 `manager.rs:949-950`、`TEMP_SCOPE_OWNER` 哨兵 :959、对话框生命周期自动注销《04.04》§4.9），兼容复用只会制造同名异义。

### 5.2 作用域命名与派生规则（本 RFC 裁点）

时序约束（E9）：`managedUri` 在 `normalizeSource`（:512）产生并即刻充当会话身份键（`claimSessionIdentityOrThrow`），挂载发生在 `registerScope`（:458）——**作用域 ID 必须先于挂载、且仅由本地路径确定性导出**。候选：

- 取 `card_id`/`box_id`（documentId）嵌入：拒绝——documentId 需先解析文档才可得（解析发生在挂载之前的 `parser.open`，且第二次打开同文档不同会话时 documentId 相同而挂载会话不同，键序倒置）；更硬的理由：`card_id` 为 Base62 混大小写（`chips-parser/src/schema/card.rs:14`），而《06》§2.3 作用域段仅允许 `[a-z][a-z0-9-]*`（≤64），直接嵌入非法。
- 会话级计数器随机派发（挂载后返回）：拒绝——与「挂载前产 managedUri」的既有服务时序冲突，等于要求改端口契约（Non-Goal）。
- **推荐（裁点）**：宿主正式 scope 适配器按路径规范化产物派生 `scope = (card-|box-) + hex(lower(sha256(规范化绝对路径)))` 前 40 字符（总长 ≤45 < 64 预算），小写十六进制满足 §2.3 字符集；同路径重开命中同 scope（`RESOURCE_ALREADY_EXISTS` 即幂等信号，适配器改走 lookup 复用）。规范化规则（symlink 解析、大小写敏感按平台文件系统探测）归实施单并在《04.11》随动落文。哈希截断碰撞预算与改名换 scope 的引用切换语义见 Open Questions OQ-1/OQ-2。

---

## 六、点位三裁定：`managedUri ↔ localPath` 原生单源双向换算

### 6.1 候选对比

- **C1「宿主 TS 适配器自持映射表」**（现状止渴形态的正规化）——诚实评估后拒绝。工作可行（`platform-resource.ts:46-101` 已示范 platform 单域纯 TS 映射；`document-fake-ports.ts:244-246` 示范 tests 替身），但三重结构缺陷：①双源漂移——权威路径已存在于 `ScopeRegistry` 的 `Origin`（`scope.rs:47-58`，`lookup` 返回整只注册项 :207-213），TS 表是其复制品，`resourceUnregisterScope` 级联后 TS 侧滞留陈旧项无任何信号面；②覆盖不能——`temp-*` 与归档内成员的路径知识只在原生侧，TS 表无从枚举；③头注自证临时性（`platform-resource.ts:9`「真实核心装配后由资源管理器接管」）。单源纪律：换算归核心。
- **C2「原生双向两导出」（推荐）**：

| JS 函数                    | 参数                                | 返回                      | 说明                                                                                                  |
| -------------------------- | ----------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `resourceLocalPathOf`      | `(uri: string, sessionId: number)`  | `Promise<string>`         | 受管引用 → 本地可读路径（目录态包根/归档文件路径）；正向换算                                          |
| `resourceManagedUriOfPath` | `(path: string, sessionId: number)` | `Promise<string \| null>` | 本地绝对路径 → 规范受管引用（绑定会话作用域集内 Origin 最长前缀匹配，含 `temp-*`）；未命中返回 `null` |

- **Rust 挂点与核心改动量**：正向 = `uri::resolve_input` 既有解析（`uri.rs:116-133`）→ `manager.scopes().lookup`（:364/:207）→ `Origin` 根与包内相对路径拼接（归一复用 PathGuard 既有件），绑定层薄包装 + 绑定会话闸；反向 = 新小增量查询能力（遍历 `ScopeRegistry` 在册项 Origin 做前缀匹配——现有 registry 仅有按 scope / 按 `ExternalOrigin` 两检索臂 :207/:217，无按路径检索，核心需补一个只读遍历函数）。
- **错误码口径（零新增）**：正向 URI 非法 → `RESOURCE_INVALID_URI`；scheme 非受管 → `RESOURCE_UNSUPPORTED_SCHEME`（`resolve_input` 既有两码，:14/:17）；作用域未注册 → `RESOURCE_NOT_FOUND`；会话未绑定 → `RESOURCE_PERMISSION_DENIED`（out_of_scope）；`Memory`/`Http`/`External` Origin 无本地可读位置 → `RESOURCE_NOT_SUPPORTED`（在册语义「操作不被当前 Provider 支持」，:41）。**`file://` 输入在资源核心维持拒收**（《06》§2.2、`uri.rs:116-133`），归一只发生在文档侧 `normalizeSource`（§2.6/R13 责任划界不因本点位移动）。反向未命中 = `null` 非错误：不区分「不存在」与「未绑定」，**不泄露他会话作用域存在性**（安全口径即体现在返回类型里，与 `registerScope` 失败即打开失败的既有链吻合）。
- **投影/冻结**：返回原始类型（string / string|null），无新对象形状，无冻结表行。
- **消费面（批准后翻正）**：`normalizeSource` 正式适配器（正向：新路径→派生 scope→组 managedUri；命中已有挂载：反向直读）；`IDocumentStoragePort.commit/listMembers/readFileBytes` 正式适配器（持 `localPath` 面的端口，`ports.ts:147-174`，反向换算后走受管面）；`recomputeDigestFromDisk`（`service.ts:413-422`）由 record 持有 `localPath` 改为经端口取回，消除 TS 私有路径缓存（实施单细则）。

### 6.2 组合承载的诚实边界

`listMembers` / `readFileBytes` **不需要**新导出：作用域挂载后由既有 `resourceListDirectory`（递归列举）+ `resourceOpen`/`resourceRead`（字节读取）组合可承载，且该组合天然经过权限判定入口（§11.1 唯一挂点）——本点位只补「换算」不补「读」，防止把已可组合面重复登记（零自造 G4 口径）。

### 6.3 真链时序总览（七导出落位后，全部挂点为既有链、零链序改动）

```
document:open(source)
  └ normalizeSource            ← 点位三：新路径→§5.2 派生 scope→组 managedUri；
  │                               已挂载路径命中走 resourceManagedUriOfPath 反查
  ├ parser.open(localPath)     ← 解析域既有 13 导出（零触碰）
  ├ claimSessionIdentity       ← managedUri 为键（service.ts:505-530 既有）
  ├ registerScope              ← 点位一：resourceMountDirectory / resourceMountArchive
  └ openRecord{managedUri,localPath}   ← localPath 长期缓存随波 B 收敛到点位三取回

document:save
  ├ parser.serialize           ← 点位四：documentSerialize（含 total_size 定点，§7.3）
  ├ storage.commit             ← 点位四：resourceManagedUriOfPath 反查 scope
  │                               → resourceCommitPackage（两阶段+提交日志）
  ├ rebuildAfterCommit         ← 点位三正向换算 + §6.2 既有读组合（摘要复算输入）
  └ digest/事件                ← service.ts:807-854 既有链，零改动

document:close/驱逐
  └ resourceUnregisterScope    ← 点位二（§4.3 注销时机表）
```

装载段判定（`e2e-app.ts:70-79` typeof 缺位臂、`production-wiring.ts:184-197` 双 missing reason）在七导出全部落位后按 §九清单 6-7 机械删除——工单036 §五「装载段零改动翻正」判据即此形态：判定逻辑本体不动，仅缺位探针翻真。

---

## 七、点位四裁定：跨成员原子提交 + `parser.serialize` 完整承接

### 7.1 缺口的在册证明

- 宿主回退 reason 逐字在册（E6/E8）；#204 臂②停手三依据：①`total_size` 自引用必须在写入定装点计算（`chips-parser/src/schema/card.rs:39` 必填整数字段；《11.05》§5.5 重算规格），解析侧与提交侧任何单侧都闭不了环；②chips-parser 零 ZIP writer（`Cargo.toml` 无 zip 依赖、`source/archive.rs` 只读索引、yaml 模块 deserialize-only）；③目录-only 即违禁临时版。
- 事务面缺口在册：`write_coord.rs:1-40` 头注明示仅有路径写锁、无提交日志/包事务；全 crate grep 无 package-transaction 面。《11.05》§5.2 两阶段提交（commit log：`preparing → ready → committing → delete`，fsync 点位在册）、§5.3 移除序、§5.4 归档态全重组+单 rename+写后校验、§5.7 预算，为本点位唯一算法权威（v1.0.0 已定稿，零新规格裁点）。

### 7.2 候选对比

- **D1「宿主 TS 循环既有 `resourceCommitWrite` 逐成员提交」**——拒绝（非稻草人：单成员原子性真实存在——PathGuard + 临时物 + 原子替换为在册链，`manager.rs` 提交段）。致命缺陷在包级：循环无跨成员事务，两次提交之间崩溃 = 半新半旧包，直接违反《11.05》§5.2 提交日志要求（该 § 的恢复扫描在原生启动期执行，TS 循环无处安放恢复语义）；`removals`（成员移除，《11.05》§5.3）更无既有导出可承载。
- **D2「目录态先行、归档态缓载」**——拒绝：违反工程纪律「不做临时版/简化版」，且 `document:*` 仍半回退 = 工单036 收口判据（§五：正式适配器注入、装载段零改动翻正）不满足；缓载即二次扩表、二次三方锁翻动，成本反而更高。
- **D3「序列化 / 提交双载体完整承接」（推荐）**：序列化归解析域（格式知识权威），提交归资源域（事务与落盘权威），依赖方向维持 `chips-resource → chips-parser`（读侧既有方向，不反转）。

  | JS 函数                 | 参数                                                                                                                                                                      | 返回                                            | 说明                                                                                                                                         |
  | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
  | `documentSerialize`     | `(request: IDocumentSerializeRequest)`                                                                                                                                    | `Promise<readonly IDocumentSerializedMember[]>` | 落盘序列化（解析域）：确定性 YAML（《06.10》§10.2 规范形态）+ 变更成员与依赖成员全产出 + `file_info`/`manifest` 重算 + `total_size` 自洽定点 |
  | `resourceCommitPackage` | `(sessionId: number, scope: string, members: ReadonlyArray<{ packagePath: string; bytes: Uint8Array }>, removals: ReadonlyArray<string>, form: 'directory' \| 'archive')` | `Promise<void>`                                 | 跨成员包级原子提交（资源域）：两阶段 + 提交日志；目录态逐成员临时物+原子替换，归档态全重组+单 rename+写后校验（《11.05》§5.2/§5.4）          |

- **ZIP writer 落位**（D3 子裁点）：推荐 chips-parser 新增写侧模块（`serialize` + `write_archive` 两个 pub API），chips-resource 事务引擎经 Rust 内调用消费最终字节流——格式知识（Store 条目头、中央目录、`file_info` 布局）读写同源，杜绝双实现漂移；拒绝 (i) 新立第九 crate `chips-pack`（依赖边新增、当前无第三消费方）；拒绝 (ii) chips-resource 内藏 zip 写（把清单格式知识复制进非格式权威 crate，违零自造 G4）。写侧选型：ZIP **Store** 无压缩定长开销格式可手写零新依赖，或引入 `zip` crate（禁压缩器面按《06.02》§2.2/11.05 归档口径「Store 全重组」）——依赖引入判据归实施单（Open Questions OQ-3）。

### 7.3 `total_size` 自引用闭环口径（裁点）

- **目录态**：`total_size = Σ(全部成员文件字节)` 含 metadata 自身 → 定点迭代：以候选值写出 metadata → 求和 → 值变则重写；字节数位单调且界死（整数 ≤ 2^53），≤3 轮收敛性证明入实施单测试夹具。
- **归档态**：`total_size = 最终归档文件字节数`。ZIP Store 无压缩，整包尺寸 = 条目内容 + 定长本地头/中央目录开销的**闭式和**——序列化侧可在写出 metadata 前解析求出，无需 dry-run 重打包；闭式对中央目录字段的依赖清单归实施单。
- 定点责任全在 `documentSerialize`（纯函数、无副作用、可单测），`resourceCommitPackage` 仅做**提交前终校验**（收到成员重求和，与 metadata 声明不符 → 整包拒绝，`RESOURCE_WRITE_FAILED` + details，零新码）——两侧同码互校，杜绝「序列化带病、提交侧静默」。

### 7.4 错误码与安全口径

- 提交链错误码全部取在册：`RESOURCE_WRITE_FAILED`（磁盘/锁冲突，:47）、`RESOURCE_BUSY`（单写者冲突，WriteCoordinator 既有）、`RESOURCE_TOO_LARGE`（§5.7 预算越界，:26）、`RESOURCE_PATH_INVALID`（成员路径穿越/非法包内路径，:23）、`RESOURCE_READ_ONLY`（对只读归档挂载就地写——正常链不触发，防御臂，:38）、`RESOURCE_PERMISSION_DENIED`（会话未绑定/无 `resources:write`，`permission.rs:227-243` 判定入口不改）、`RESOURCE_NOT_FOUND`/`RESOURCE_INVALID_URI`/`RESOURCE_ALREADY_EXISTS`/`RESOURCE_INTERNAL`（既有兜底）。序列化域取在册 `DOCUMENT_*` 族（`ports.ts` 端口头注列名）与 `NATIVE_*` 三码（《03.08》§8.5 封闭表）。**零新码论证**：本点位无新错误类别——两阶段/预算/校验失败均有语义位。
- 安全口径：`resourceCommitPackage` 仅宿主主进程装载面可达；写入前会话闸（活体 + 绑定 + 写权限三闸全复用既有判定入口，`manager.rs:336-345` 唯一构造点不因本点位旁路——提交路径挂点细则归实施单，判据为「`PermissionChecker::decide` 唯一挂点性质保持」）；审计面：写路径判定经过点位落地后自动进入 `auditBindDecisionSink` 已接线的 DecisionObserver 链（工单046 段四既有承接，零新增）。
- 投影形状冻结（比照 #204 臂③先例，新增两行进《04.11》冻结表扩展或解析域对应表）：

  | 冻结形状                                | JS 字段                                                                                                                                                                                                                                                        | Rust 来源                 | 说明                                                                                                                             |
  | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
  | `IDocumentSerializeRequest`（入参）     | `kind: string; form: string; localPath: string; metadata: unknown; structure: unknown; contents: ReadonlyArray<{ nodeId: string; value: unknown }>; layoutConfig: unknown \| null; changedParts: ReadonlyArray<string>; removedNodeIds: ReadonlyArray<string>` | 同构 Rust 输入 DTO        | 逐字段镜像 `ports.ts:101-121`（宿主端口已冻结形状，d.ts 独立声明防跨包类型耦合，先例：`IDirectoryEntry` 在 d.ts:345 域内自声明） |
  | `IDocumentSerializedMember`（返回元素） | `packagePath: string; bytes: Buffer`                                                                                                                                                                                                                           | `chips-parser` 序列化产物 | 逐字段镜像 `ports.ts:123-127`；`bytes` 经 Neon `Buffer`（§8.2 类型映射在册）                                                     |

  提交导出返回 `Promise<void>`、映射导出返回原始类型，无附加冻结行。

### 7.5 崩溃恢复与临时物口径（照案承接《11.05》§五，零新规格）

- 提交日志四态机（`preparing → ready → committing → delete`，含 fsync 点位）为《11.05》§5.2 已定稿规格：恢复扫描归 `resourceCommitPackage` 所在事务引擎的**核心启动期**执行（宿主重启即扫），不经任何新导出面——导出面只暴露提交入口，恢复是核心不变量。
- 目录态成员写入维持「逐成员临时物 + 原子替换」且全部纳管于同一包级日志（§5.2）；归档态维持「全重组写临时归档 + 单 rename + 写后校验」（§5.4）；两者失败路径均为「清理临时物 + 整包回滚」，对照挂载入口「不留半挂载」同款零残留纪律。
- 预算越界（包体积/成员数/单成员字节，《11.05》§5.7）在提交引擎前置闸拒绝，`RESOURCE_TOO_LARGE` 在册码；预算数值来源为 `ResourceManager.limits`（`register_temp_scope` 折算处 :963-966 同族字段），零新配置面。
- 验收夹具（§十一.4）要求三态残留各一条：`preparing` 中断、`ready` 未提交、`committing` 半程——重启扫描后包内容必须回到提交前代际且目录零临时物残留。

---

## 八、热路径开销口径

七入口全为冷路径（挂载=打开文档一次性；映射=换算无 IO 放大；序列化/提交=保存链）。保存链 SLA 比照裁定F口径：以既有线上 bench 场景（金链路保存 e2e 夹具）取**实施前后 p50/p95 差值**验收，本 RFC 不预造数字；序列化定点迭代为纯内存计算，归档闭式求和免 dry-run 即为本点位的开销控制裁点（§7.3）。

---

## 九、三方锁与落位即收紧：机械翻正点位清单

扩表 7 项（资源域 +6、解析域 +1）落位时以下点位**同一实施单内一次翻正**，任何单点滞留即闸红（现状锚点全部实读在册）：

1. `packages/native/src/abi.rs`：`export_table!`（:28-79）+7 名；测试锁 surface↔EXPORT_NAMES 全等随动。
2. `packages/native/abi/export-surface.json`：50 → 57 条（`{name, kind, signature}` 全量），`abiVersion: 1` **不动**、`blocked: []` 不动。
3. `packages/native/types/chips-native.d.ts`：+7 函数声明（资源域落 :532-594 现段之后；解析域落 :470-526 现段）+2 个冻结形状接口。
4. `packages/host/src/capabilities/document/adapters/native-resource-module.ts`：`NATIVE_RESOURCE_SURFACE_EXPORTS` 15 → 21 名（:51-67）、装载闸 required 17 → 23（缺名 fail-closed 四 reason 形制不变）；头注三项载体缺口段（:23-31）改写为承接说明。
5. 宿主锁测：`packages/host/tests/document-native-resource-module.test.ts` 两态互锁断言翻正（现锚 :79/:85/:88/:94/:132/:154）。
6. `packages/host/tests/e2e-host/native-artifact-gate.test.ts`：判据④「50 项全等」→「57 项全等」（:103，头部计数注记随动）。
7. `packages/host/src/main/e2e-app.ts` :70-79 与 `production-wiring.ts` :184-197：诚实回退臂删除、wired 分支扩展（对照 :237-265 既有 wired 形制）；端口正式适配器新增（实施单文件清单）。
8. typecheck 夹具：d.ts 新接口的消费面夹具随动（先例：#204 臂③夹具）。
9. `packages/native/scripts/check-abi.mjs` 零改动（读表运行，实跑判据见 §十一验收）。
10. `packages/native/README.md`：域表资源行（:58「15 名」）与解析行（13 名）计数、同步/异步分段注记（:60-88）随动。
11. d.ts 文件头资源域导出计数注记（:14「§7.3」指称）与 `e2e-app.ts:13` 陈旧计数行顺带核正（实读注：该行计数与三方锁无耦合，属注释卫生）。

## 十、文档随动清单（批准后的实施波执行，本文零落文）

| 文档                        | 位置                 | 动作                                                                                                                           |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 《04.11》§11.3              | 表 :137-153          | +6 行（资源域）；N-1 注记族（:157-166）追加挂载/映射/提交的会话闸注记；冻结表（:168 起）+§7.4 两行；scope 派生规则（§5.2）落文 |
| 《04.11》§11.2              | trait 段             | `unregister_scope` 绑定层补闸注记（核心签名不动）                                                                              |
| 解析域设计文档              | `04.06`/导出表所在章 | `documentSerialize` 行 + 序列化模块规格承接注记（刀6 归属落地注）                                                              |
| 《03.07》§7.1/§7.3          | v1.0.5 → 随动版      | Rust 面镜像表 +计数句「三方锁全表 50 项」→ 57                                                                                  |
| 《03.08》§8.6               | v1.0.4 → 随动版      | 总表资源域 15→21、解析域 13→14、总计 57；§8.6 规则句重申「新增不递增 abiVersion」                                              |
| 《11.05》§五                | v1.0.0               | 零改动（本裁定全部照案承接其规格，无规格漂移）                                                                                 |
| 《06.02》§2.x               | 现行版               | 零改动（scope 派生规则合法落于 §2.3 既有字符集/长度预算内）                                                                    |
| README（文档库）/版本随动链 | 惯例                 | 版本号与日期随动，主文件同步                                                                                                   |

## 十一、实施切分建议与验收判据

**波次**（错峰依据：R1-B 段三宿主段已随 #196 验收、宿主域空闲；#206 段四接线波已关闭 `188a99390`；本文三波均触 `packages/native` 独占面，串行互斥）：

- **波 A（点位一+二）**：3 导出薄包装 + 正式 scope 适配器 + 文档链打开半程翻正。预算建议：绑定层小、无核心改动，为四点最小可验身。**裁定G 随批补注（派单形态）**：本波拆两串行子波——**A1 原生绑定面**（`packages/native` 独占：三薄包装导出 + 三方锁 50→53 + native 锁测 + 文档随动，文档计数取在落实数 53 非终态 57）→ **A2 宿主承载面**（装载闸 15→18 与 required 17→23、正式 scope 适配器、`production-wiring` 双 missing reason 删除、`e2e-app` typeof 臂翻正、宿主两态锁测与 artifact-gate 判据④翻正）。拆因判例：#205→#207 同触 native+host 双面包曾两度触顶，单波单面可验身；A1 落地后宿主三处字面按 #199 判例登记滞后、由 A2 翻正，禁中途放宽断言。
- **波 B（点位三）**：2 导出（含反向查询小增量核心）+ storage 适配器换算段。依赖波 A（scope 已挂载才有可换算面）。
- **波 C（点位四）**：重波，可内部分段：C1 = chips-parser 序列化模块（纯函数，零导出触碰）；C2 = chips-resource 事务引擎 + 两导出 + 全链翻正 + 恢复扫描。C2 依赖 C1；ZIP 依赖选型在 C2 开工前定案（OQ-3）。

**验收判据**（每波收口全跑，断言取真实退出码、勿接管道）：

1. `node packages/native/scripts/check-abi.mjs` → 退出码 0 且输出计数 = 当波在册表数（收口终态「导出 57 项，阻塞 0 项」）。
2. native 测试基线（现 93）只增不减、全绿；crates 域 `cargo test -p chips-resource -p chips-parser`（**禁 `--workspace`**）全绿。
3. host 测试基线（现 1514）只增不减、全绿；锁测两态断言与 artifact-gate 判据④按新数全绿。
4. 波 C 终验：工单036 §五收口判据逐条——`document:*` 经 `resourcePorts` 注入走通「目录态打开→编辑→保存（跨成员原子）→归档态打开（只读）→注销」真链；崩溃恢复夹具（提交日志三态残留各一）翻正；装载段判定逻辑零改动（E5-E7 锚点仅按 §九清单机械翻正）；全程零内存替身、零 TODO。
5. 文档闸：`check-docs` 断链 0；`04.11`/`03.07`/`03.08`/README 计数互一（同一数字三面可交叉 grep）。

## 十二、回滚方案与决策判据

- **回滚面**：本 RFC 全部为「导出只增不改」增量表项——回滚 = 从三方锁三处同时摘除未消费新项 + 回退 §九清单 4-7 宿主臂，不触 `coreAbiVersion`、不触既有 50 项任何一行（第 50 项落位波先例即此回滚路径）。波间回滚边界即 §九清单的当波子集。
- **决策判据（何时重开本裁定）**：①实施中发现《11.05》§五规格与本裁定冲突（规格权威更高，本裁定让位重裁）；②scope 派生规则需变更字符集/长度（触《06.02》§2.3 冻结面，走文档变更流程）；③工单036 收口判据变更（端口形状以外的链定义变更）；④ZIP 选型引入的依赖与离线构建面冲突（workspace 依赖纪律）。

## 十三、Open Questions（候主智能体裁或随实施波定案）

| #    | 问题                                                                                                                                           | 本稿倾向                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| OQ-1 | scope 派生哈希截断长度与碰撞预算（40 hex = 160 bit 前缀，工程上碰撞不可达，但需在册预算声明）                                                  | 40 字符                                                                   |
| OQ-2 | 文档包物理改名（`file://` 路径变更）后跨重启引用稳定性：旧 `card-<hash>` 注销、新挂载新 hash——外部已发放 `managedUri` 的失效通知面是否需要事件 | 随波 B 一并裁（倾向：不新增事件，改名走 close-then-reopen）               |
| OQ-3 | ZIP Store 写侧手写 vs `zip` crate（禁压缩面）与 workspace 依赖引入判据                                                                         | 倾向手写零新依赖（Store 定长格式 + 单测对拍解析器读侧）                   |
| OQ-4 | `resourceUnregisterScope` 幂等语义：重复注销返回 `RESOURCE_NOT_FOUND` 还是静等幂等（对照 `release` 幂等先例）                                  | 以核心 `scopes.unregister` 现行为实读定案，绑定层不造第二语义             |
| OQ-5 | 定点迭代轮数上限与不收敛防御（理论 ≤3，防御臂用在册码）                                                                                        | 上限 3 + `RESOURCE_INTERNAL` 兜底                                         |
| OQ-6 | `documentSerialize` 域籍：解析域导出表（《04.06》系）还是并表《04.11》§11.3                                                                    | 倾向解析域（算法权威在《06-文档解析器设计》，同点位一「域内自声明」判例） |
| OQ-7 | 常驻文档 scope 的 `owner` 常量取值（`chips:host` vs 新哨兵，对照 `TEMP_SCOPE_OWNER` 先例）                                                     | 随波 A 定案并 README 在册登记                                             |

---

## 裁定G 签批注记（主智能体，2026-09-23）

**逐点位照案采纳**：A1（目录+归档双挂载一体承接）/B2（挂载入口承接+绑定层钉死 kind=Document，另立 `resourceUnregisterScope` 生命周期行，绑定层补会话归属闸）/C2（原生单源双向换算两导出，miss 返 `null` 不泄露存在性）/D3（序列化/提交双载体完整承接）全部批准。总量裁定：**新增 7 导出，导出面 50→57、§11.3 资源域 15→21、解析域 13→14、`coreAbiVersion` 维持 1、错误码零新增**——照案。

**主智能体独立核证记录**：manager.rs 挂点八函数行号（:388/:401/:418/:813/:864/:883/:948）逐名实读吻合；scope.rs `ScopeKind` 七值与 `card-`/`box-` 前缀校验臂 :119-130 属实；error.rs `RESOURCE_*` 恰 18 码在册；card.rs :14 Base62Id / :39 total_size 必填属实；resource.rs 头注缺口自证、production-wiring.ts 双 missing reason、native-parser.ts serialize 拒止臂、service.ts :458/:512 时序、《11.05》v1.0.0 两阶段四态机（preparing→ready→committing→删除、fsync 点位、归档态只前滚、§5.7 预算）全部在册；《06.02》§2.3 作用域字符集 `[a-z][a-z0-9-]*` ≤64 与 §5.2 派生规则相容。两闸主复跑真实退出码：链检 `DOCS=0`（files=1105、links=7358 基线保持、坏链 0）、RFC 文件 prettier 显式 config `PRET=0`；工作树核零越界（唯一新文件+投资问卷两枚用户文件未沾染）。

**OQ 七项定案**：

- **OQ-1 照准**：40 hex（160 bit 截断前缀，碰撞预算声明随波 B 在《04.11》落文）。
- **OQ-2 照准**：不新增失效通知事件；物理改名走 close-then-reopen（受管引用以规范路径派生为身份键，事件面留待真有消费方另裁）。
- **OQ-3 裁定＝手写 ZIP Store 零新依赖**：chips-parser 写侧模块手构 Store 条目（无压缩定长开销格式），正确性以「写侧产物回读读侧 `source/archive.rs` 索引」单测对拍锁死——读写同源零漂移、免第三方依赖选型流程（AGENTS 新依赖须先议），符合工程纪律。
- **OQ-4 定案＝以核心实读为准**：绑定层不造第二语义；`scopes.unregister` 现行为核实后在《04.11》冻结登记，锁测双向臂（重复注销臂按核得行为断言，禁放宽）。
- **OQ-5 照准**：定点迭代上限 3 + `RESOURCE_INTERNAL` 兜底；收敛性证明入测试夹具。
- **OQ-6 定案＝解析域（落《04.06》系文档）**：签名照案维持 `documentSerialize(request: IDocumentSerializeRequest)`——主核证既有 13 解析导出母型即「结构化对象跨桥、d.ts 域内独立声明」（`INativeParseOptions`/`IDocumentMetadataResult` 先例在树），入参接口在 d.ts 同域自声明、不 import 宿主端口类型（防跨包耦合，§7.4 冻结表已备形状）。波 C1 若实读发现与 Neon §8.2 类型映射冲突再按 §十二判据① 重开。
- **OQ-7 定案＝新哨兵常量**：文档服务侧常驻 scope owner 取固定平台服务身份常量化（对照 `TEMP_SCOPE_OWNER` 先例、非伪造用户身份），具体名与取值随波 A 定案并 README 在册登记。

**实施排程（串行，均触 packages/native 独占面）**：波 A（点位一+二：3 导出薄包装+正式 scope 适配器+打开半程翻正+§九清单当波子集）→ 波 B（点位三：2 导出+换算段+localPath 缓存收敛）→ 波 C（点位四：C1 序列化纯函数段 / C2 事务引擎+恢复扫描+全链翻正）。验收判据按 §十一执行，工单036 §五收口判据为波 C 终验闸门。**批准前零实施纪律解除，本注记落册即生效。**
