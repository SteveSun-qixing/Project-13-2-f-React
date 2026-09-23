# RFC-原生会话授权注入裁定（工单053 点位五：Neon 面授权注入导出与核心 `grant_permission` 契约裁定）

> 版本：v1.0.0
> 日期：2026-09-23
> 状态：**批准（裁定J）**——主智能体签批，七项 OQ 全部落定（§十 主裁列 + §十一 主裁批注）；实施按 §九 D1/D2 两波另立码单
> 承接：工单053「原生绑定 JS 面会话写权限缺口——授权注入面未承接」点位五（W3 §五 裁决I-⑧「波 C 前置·点位五」、W3 §四 row93 #234 勘查定形与 row101 #242 派单行）
> 依据文面：`项目日志与笔记/工单053-原生绑定JS面会话写权限缺口授权注入面未承接/任务说明.md`（§四.1~§四.4 期望行为、§五 翻正方向在册）、《RFC-原生承载面扩表裁定》（裁定G，结构与 §8.6 只增不改判例母型）、《RFC-权限审计跨层采集sink裁定》（裁定F，热路径/观察面纪律母型）、《03.08-03-核心接口规范-八、Neon 绑定约定》§8.5/§8.6、《03.07-03-核心接口规范-七、资源管理器》、《04.11-04-资源管理设计-十一、Rust ResourceManager 与 Neon 暴露》§11.2/§11.3、《06.02-06-资源协议规范-二、URI 语法》§2.3/§2.4、《06.04》§4.3 判定矩阵、`项目日志与笔记/问题工单.md` 053 行、`/tmp/w234_report.md` §任务 A 与「不确定项与需主裁事项」（转引权威）、`重构大计划/W3-开工波次计划.md` row88~102/§五（在途波与串行裁定）。

## Abstract

`chips-resource` 内核会话能力齐备（`open_session` 四参本就收权限集），唯一缺口在 Neon 绑定层：`resourceOpenSession` 恒传空权限集，导致经 JS 面创建的会话永不可写（读臂不受影响）。本 RFC 对点位五裁五议题：接口形态（推荐新增第 56 导出 `resourceGrantSession` 后置 grant，Path2）、核心 `SessionRegistry::grant_permission` 语义三问（幂等/不撤销/限定形不扩 Document 写臂）、owner 哨兵闸落位绑定层（比照 #203/#212 在册闸形母型）、生命周期不变量（不引入第二注销入口、不改两拍序、与 `attach_scope` 职责分离）、三方登记六处同步点与 `CORE_ABI_VERSION` 维持 1。本文只裁契约与形态、零代码改动；四路方案如实对比（含 Path1 改签名的真实代价与 Path2 变体的真实强项），主裁必决项集中在 §十。

### 0.1 基线读取纪律声明

本文全部行号为 **2026-09-23 工作树自测实读**（HEAD 含波 A1/A2a/A2b 与波 B 全线：#231 代码面 + #238 宿主镜像随动）。闸实跑：`cd chips-ecosystem/packages/native && node scripts/check-abi.mjs` → `[check-abi] 通过：导出 55 项，阻塞 0 项`，EXIT=0。计数类论断并列「转引出处 + 自测实数」：chips-resource 用例基线**转引** 09-23 收口台账 263（W3 row93 派单书与主记忆账同值），**自测**静态 `#[test]`+`#[tokio::test]` 逐名清点 = 262（src 169 + tests 93），差 1 为口径出入，实施单以 `cargo test -p chips-resource` 实跑数定案；native 用例基线自测静态 108，与台账 108 吻合。与 #234 报告行号不一致处（`resource.rs:784-786/:803` → 实为 :799-801/:818；`scope-adapter.ts:306-307` → 实为 :307/:326；「第 54 导出」系波 B 前口径，现为**第 56**）在 §一 表注逐条登记，一律以本文自测值行文。

---

## 一、背景与缺口（核心链路完整、缺位在绑定层——逐条实证）

| #   | 事实 | 实读位置（本文自测行号） | 结论 |
| --- | ---- | ------------------------ | ---- |
| E1  | 会话记录自带双集：`pub scopes: BTreeSet<ScopeId>` / `pub permissions: BTreeSet<String>` | `chips-ecosystem/packages/core-rust/crates/chips-resource/src/session.rs:44/:46` | 权限与 scope 两集**解耦**，permissions 为 `resources:*`/`network:http:*` 字符串集 |
| E2  | `SessionRegistry::open_session(kind, owner, scopes, permissions)` 四参收权限集 | `session.rs:80-101`；`ResourceManager` 同形薄包装（`impl IntoIterator` 双集入参）`manager.rs:418-431` | 核心**创建时授权**能力在册 |
| E3  | `derive_session` 只允许父集子集、禁扩权（`is_subset` 判定 :122） | `session.rs:105-146` | 派生面收窄已在册；**无任何对既有会话增权的函数**——全 `crates/chips-resource/src` grep `fn grant|fn revoke|permissions.insert` 零命中（本文复跑 #234 A.1 判据，吻合） |
| E4  | `attach_scope` 只加 scope 不加 permission；`detach_scope` 只摘 scope | `session.rs:199-209/:212-217` | 挂载面与授权面天然分离，grant 不得混入（§五议题） |
| E5  | 写臂恒查 `PERMISSION_RESOURCES_WRITE = "resources:write"`（常量 :23）；Document 写臂只认**精确串** | `permission.rs:23`、`:227-243`（:229 `self.has(...)`） | Document 写放行 ⇔ `permissions` 含 `resources:write` 精确串 |
| E6  | 读臂 `session_bound()` 直通免重复校验（判定 :132-133 实现，document 读臂 :207-208 使用） | `permission.rs:132-133/:207-208` | 读不受权限集影响 → 缺口只封写臂（与工单053 §一吻合） |
| E7 | 判定唯一构造点 + `granted` 注入 = `&session_record.permissions` | `manager.rs:512-520`（构造 :512、granted 注入 :517） | 判定权威单点在 `PermissionChecker`，绑定层投递素材即闭环（工单 §四.1「不新增第二套权限模型」） |
| E8  | **缺位本体**：`js_resource_open_session` 调 `manager.open_session(kind, &owner, [], Vec::<String>::new())` | `chips-ecosystem/packages/native/src/resource.rs:818`；头注自认「`derive_session` 与授权注入不在十五导出面内」`:799-801` | JS 面会话恒空权限 ⇒ 永不可写（工单053 E1/E2 的现码位，#234 转引 :803/:784-786 已随波 B 行移，本表翻实） |
| E9  | 导出面现值：`export_table!` 全表 :28-84，资源域 20 名 :63-82；清单 55 项、`abiVersion: 1`、`blocked: []` | `packages/native/src/abi.rs:28-84`、`packages/native/abi/export-surface.json:2/:280`（exports 计数自测 55）、check-abi 实跑 §0.1 | 点位五落位即 55→56，为**第 56 导出**（#234「第 54」系波 B 前旧口径，随波 B 53→55 顺延） |
| E10 | 宿主两拍时序与单一注销入口：拍① `resourceUnregisterScope` → 拍② `resourceCloseSession` | `packages/host/src/capabilities/document/adapters/scope-adapter.ts:307/:326`（`doUnregisterScope` 内，#234 转引 :306-307 drift 翻实）；端口契约注记 `ports.ts:95`（INV-2）/`:103`（INV-6 禁第二注销形）；存储侧 `session-store.ts:202-204/:372` | grant 面不得触碰此链（§五） |
| E11 | 宿主授权消费现场：`nativeSession = native.resourceOpenSession(DOCUMENT_SESSION_KIND, DOCUMENT_SCOPE_OWNER)` 后紧接挂载 | `scope-adapter.ts:243`（open）→ `:252-255`（mount 二态分叉）；失败回收臂 `closeSessionQuietly` :282-285（:258/:272 两处调用）；`DOCUMENT_SCOPE_OWNER = 'chips.official.document-service'` 定义于 `scope-derivation.ts:41` | 注入位天然单点：文档服务建会话处（§七） |
| E12 | 写臂现状宿主侧如实登记注记（工单053 归波 C、不注入不伪造） | `scope-adapter.ts:41-43` | **出入登记**：全仓 grep「必被拒/写必被拒」与 `工单053` 源码引用，**不存在**一条「JS 面会话写必被拒」的可断言锁测用例（仅本行注记在册）；工单053 §五「波 A2b 补锁测」与 #234 A.3-3「现有锁测翻正」措辞超前于实码——本文 §八按「补负臂 + 立正臂」双态处置，不沿用「翻正既有用例」口径（供主智能体核后处置，本文不立单） |
| E13 | 绑定层既有闸形母型：`session_gate_denied`（`RESOURCE_PERMISSION_DENIED` + `details.permission = "session"` + `reason = out_of_scope`、target 不泄露真实路径）与 `require_session_bound`（会话不在册/未绑定二回形） | `packages/native/src/resource.rs:864-874/:883-897`（波 A1 落位，OQ-4「绑定层不造第二语义」判例在册 :880-882） | 点位五 owner 闸照此形制（§四） |
| E14 | N-1 归属账母型：`UNCLAIMED_SESSION = u64::MAX` fail-closed 哨兵、编译期常量断言「恒大于真实会话上界」、记账-回取-级联清账三态锁测 | `resource.rs:129/:1420-1453`（`HandleSessionLedger` :135-205、锁测 `test_handle_session_ledger_sentinel_is_fail_closed_and_never_real` :1420、`test_global_ledger_wrappers_round_trip` :1437） | 跨会话锁测形态比照对象（§四.3） |
| E15 | `CORE_ABI_VERSION` 现值与锁：`pub const CORE_ABI_VERSION: u32 = 1`、测试锁 `assert_eq!(CORE_ABI_VERSION, 1)` | `crates/chips-core/src/constants.rs:12/:25` | 只增导出不动 ABI 的在册基座（§六.3） |
| E16 | 判定拒绝原因五值（含 `Revoked`）已上移 chips-core 并以别名收口 | `crates/chips-core/src/audit.rs:57-67`；`chips-resource/src/error.rs:196`（`pub use chips_core::PermissionDenyReason`）；serde 词表锁测 `audit.rs:295-299` | 资源会话面若造撤销语义不得抢 `Revoked` 词位（§三.2） |

---

## 二、议题一：接口形态四路对比与推荐

### 2.1 候选对比（各案强弱如实陈述）

| 方案 | 内容 | 优点 | 缺点/代价 | 裁决 |
| ---- | ---- | ---- | --------- | ---- |
| **A. Path2 后置 grant 新导出** | 新增 `resourceGrantSession(sessionId, permissions[])` + 核心 `SessionRegistry::grant_permission`（现不存在）+ `ResourceManager` 薄包装 | ①严格落位 §8.6「只增不改」既有判例链（第 50 导出 `auditBindDecisionSink` 49→50、波 A1 50→53、波 B 53→55 三轮在册同型）；②会话生命周期内**任意时刻可授权**，为波 C2 之后任何「先开会话后升权」流程留正式面（不赌未来需求，只保留原生语义完整：核心能力面 `open/derive/close` 三态之外补「存续期增补」一态）；③宿主侧失败可诊断——grant 调用独立成臂，拒绝码即授权失败码 | 需新增核心函数（三问语义须先裁，§三）；宿主多一拍时序（grant 失败恢复臂要接）；「建会话」与「授其权」分离，漏调 grant 为**运行期**写拒绝而非编译期错误 | **推荐**（台账在册定形态：工单053 行「处置采 Path2…」、W3 row93/row101 承继） |
| B. Path2 变体：新增并行 open 导出、建会话时随 owner 直带权限 | 新增 `resourceOpenSessionWithPermissions(kind, owner, permissions[])`，包装四参 `open_session`（E2 能力现成）；**核心零改动** | ①核心 delta 为零（`grant_permission` 三问全部消解，§三议题不复存在）；②创建即授权、无「已开未授」窗口，宿主时序最薄（替换 `scope-adapter.ts:243` 单调用位，无额外拍）；③漏授权在 TS 签名层即编译期暴露；④同为「只增不改」合法路线（新导出、不动既有签名） | ①导出面永久并存两个 open 族入口，会话创建面一分为二（同名族异义风险对照 B3 判例语——虽非同名，但 `resourceOpenSession` 与 `...WithPermissions` 的选择责任压回宿主）；②无「存续期增补」能力——未来任何后置授权流程（含 dialog 升权类构想，若成立）仍需第三导出，届时两族并存变三族；③owner 哨兵闸形态退化为「非空 permissions 时校 owner」的参数耦合闸，闸形不如 A 的独立调用面可锁测；④与工单053 台账已登记定形不一致，改采本案需先翻台账 | **不作推荐、列 OQ-1 候主裁**（其真实强项：核心零改动与编译期 fail-fast，如实在册；#234「不确定项」明令对比，不得稻草人化） |
| C. Path1：改 `resourceOpenSession` 签名为 `(kind, owner, permissions[])` | 一导出收口 | 无新导出、导出面零增长；对宿主是最少名义改动 | **判例级禁止**：触《03.08》§8.6 只增不改红线（裁定G §5.1-B3 同款否决语）；`CORE_ABI_VERSION` 必致 1→2（E15 双锁翻正），代价量化见 §十 OQ-1 附表——三方锁三处（E9）全量重排 + 宿主镜像/装载闸/判据④ + 《03.07》《03.08》《04.11》三文档表 + 平台级 ABI 事件的重签批链；且 Neon 侧要为「第三参可缺省」引入 arity 分叉判断，正是 AGENTS「不留兼容性包袱」明禁形态 | **否决**（代价与收益失衡，同 B3 判例） |
| D. 宿主不落授权、写臂降级只读 | 维持空权限现状，文档域声明只读，波 C 保存链改内存草图/导出另存 | 零改动、零新增导出、零语义风险；「能看不能存」在当前生产不可触发期无用户可见回归 | ①工单036 §五收口判据明文=「目录态打开→编辑→**跨成员原子保存真落盘**→归档态只读→注销」金链闭合，降级即永久放弃波 C 终验闸；②与波 A1 已落地的目录态 `writable = true` 挂载 policy 面（`scope-adapter.ts:41-42` 注记在册）形成**policy 可写、权限恒拒**的长期错配态；③「不做临时版/简化版」工程纪律直接触线（AGENTS 红线），把前瞻缺口固化为架构级阉割 | **否决**（不可接受） |

### 2.2 推荐方案细则（A 案表行，比照 §11.3 四列形制）

| JS 函数                | 参数                                                        | 返回   | 说明                                                                                                   |
| ---------------------- | ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `resourceGrantSession` | `(sessionId: number, permissions: ReadonlyArray<string>)` | `void` | 向活会话追加权限字符串集（主进程内部使用；仅 `DOCUMENT_SCOPE_OWNER` 持有者会话可授，绑定层哨兵闸）；同步 `void`，会话种类无关 |

- **同步形依据**：核心 `grant_permission` 为纯内存 `BTreeSet` 追加（零 IO，与 `attach_scope` E4 同族），§8.3 线程规则下同步合法；会话域既有导出全同步先例在册（`resourceOpenSession` 同步 `number`、`resourceCloseSession` 同步 `void`，《04.11》§11.3 表 :155-156 行），异步化只服务于磁盘 IO（挂载/换算族），本面无 IO 即不预造 Promise。
- **参数校验**：`sessionId` 过 `id_argument` 形制（2^53 线格式闸，既有）；`permissions` 逐元素 string 类型闸，非 string 元素以 `NATIVE_TYPE_UNSUPPORTED`（path `/permissions/<i>`）拒绝（《03.08》§8.5 封闭表三码内，零新码）；空数组 = 合法 no-op 成功（§三.1 幂等形的边界臂）。
- **Rust 挂点**：`js_resource_grant_session → ResourceManager::grant_session(sessionId, permissions)`（新增薄包装，`impl IntoIterator<Item = String>` 入参形比照 `open_session` 包装 `manager.rs:418-431`）`→ SessionRegistry::grant_permission`（新增，§三语义）。判定入口 E7 零触碰。
- **错误码口径（零新增）**：会话不存在 → `RESOURCE_NOT_FOUND`（核心层，`attach_scope` 同臂形 :204-206）；owner 非哨兵持有者 → 绑定层哨兵闸 `RESOURCE_PERMISSION_DENIED`（§四闸形）；成功返回 `undefined`。`RESOURCE_*` 18 码封闭表（`error.rs:17-51` 自测点名）与《06.02》§2.4 `RESOURCE_PATH_INVALID` 九 reason 词表（separator/absolute/segment/encoding/control/unicode/length/platform/symlink，文档 :65-83 表列实测点名）双面**零触达零新增**——grant 不产路径判定、不碰挂载链。

---

## 三、议题二：核心 `SessionRegistry::grant_permission` 语义三问（主裁点——候选与推荐在册，签批位留 §十）

每问附「影响面实测」列。共同基线：chips-resource 用例 263（转引，§0.1 自测 262 注记）只增不减；错误码双面冻结面（§2.2）零触碰。

### 3.1 问①：重复授予同串是否幂等？

- **候选**：(a) 幂等静默——`BTreeSet::insert` 天然集语义，重复授予 `Ok(())`；(b) 重复授予拒 `RESOURCE_ALREADY_EXISTS`。
- **推荐 (a)**。在册母型即 `attach_scope`（`session.rs:199-209`：`scopes.insert(scope)` 无在籍检查、重复挂载同 scope 恒 `Ok`），E4 同源纪律——**绑定层不造第二语义**（OQ-4 定案语直引 `resource.rs:880-882` 注记），scope 集与 permission 集的「追加」原语必须同方言。宿主消费面（§七）的 grant 拍可被幂等重放路径触达（同记录重开走 lookup 复用臂时不重建会话，但若未来「一 scope 多会话」编排出现，幂等形免除重排风险）。
- **影响面**：零新码（(a) 不引入任何拒绝臂；`RESOURCE_ALREADY_EXISTS` 取用反增挂载式拒绝面）；既有 263/262 基线零翻正；新增锁测一臂（§八 T2）。

### 3.2 问②：是否提供 revoke / 权限只增不减？

- **候选**：(a) 不提供——权限只增不减，撤销 = `derive_session` 子集派生（收窄面在册 E3）或 `close_session` 整体回收；(b) 成对新增 `revoke_permission`（本导出或姊妹导出）。
- **推荐 (a)**。三条硬据：**撤销面已双备**——要窄会话走 `derive_session`（父集子集判定 :105-146 正是「授权收窄」的既有正式形），要终结授权走 `close_session`（会话记录随 `sessions.remove` 整体消失，`session.rs:172-196`，权限集随行清零、零残留）；**INV-6 同族纪律**——注销入口全仓唯一（E10），权限撤销若成对新增即为「第二撤销通道」，与 grant 追加面合成「活会话可变账」，两拍序（INV-2）之外再造第三拍，风险大于收益；**词位不抢**——`PermissionDenyReason::Revoked`（E16）为链路二 Bridge 能力撤销链预留（裁定F §5.2「grant/revoke 属链路二宿主动作，不经本观察面」在册口径），资源会话侧抢用即语义撞车。
- **未来收口路径**：若真有存续期降权需求，届时尚可新增 revoke 导出（只增不改，本 RFC 的决定永不挡路——A 案形态本身即证明增补导出的低成本）。
- **影响面**：零新码、零观察面改动（grant 非判定、不发 `DecisionObserver` 素材，裁定F §5.2 口径直引）；基线零翻正。

### 3.3 问③：是否允许 scope 限定形（`resources:write:<scope>`）？

- **实读判据**（本问全部基于现码，禁凭转述）：`has_write_of`（`permission.rs:177-179`）接受「精确基串 **或** `resources:write:<scope>` 限定串」——但**仅 `require()` 臂（:428-449）消费它**，服务对象是 Workspace 作用域与「他人 Plugin」作用域；Document 写臂（:227-243）只查 `has(PERMISSION_RESOURCES_WRITE)` 精确串，**不认限定形**；读侧对称（`has_read_of` :173-175 被 `require()` 与 External 臂消费，document 会话外读 :210-218 认「基串或限定串」二值）。判定热路径即上述三处 `has()` 集合精确匹配，无模式匹配、无前缀展开。
- **候选**：(a) **透传**——`grant_permission` 对字符串内容零语法判断（仅类型闸），限定串照投；(b) 绑定层白名单只收在册精确 ID（`resources:write` 等）；(c) 扩 Document 写臂认限定形（改 `has()` → `has_write_of(scope)`）。
- **推荐 (a)**，(c) 明确不做（留裁位注记）。论证：(a) 与工单 §四.1「判定单点、绑定层只投递素材」严丝合缝——限定串并非死权限：会话若绑定 Workspace/他人 Plugin scope，经 `require()` 臂**自然被既有矩阵消费**，投什么放行什么由判定矩阵单点裁决，grant 侧语法校验等于把词表知识复制进绑定层（第二事实源，违 G4 零自造纪律）；反之空串/永不命中串照投也无放行路径（required 构造永不为空串），无害且零锁测特例。(b) 的白名单面就是双事实源开始漂移的地方，拒绝。(c) 触《06.04》§4.3 判定矩阵冻结（`permission.rs:4-5` 头注「只实现在册判定，不发明新规则」）与文档写臂既有锁测翻正，属协议变更走文档流程，**不归本点位**；Document 域当前规格（工单053、W3 波 C 需求）只要求基串一封，无逐 scope 分权需求——不为不存在的需求动热路径。
- **影响面**：(a) 零新码、判定零改动 ⇒ 263/262 基线零翻正；锁测补「限定串投 Document 会话不改写臂行为、投 Workspace 判定形自然可被 require 臂放行」两臂（§八 T2/T7）；§2.4 九名与 18 码冻结面零触达。

---

## 四、议题三：owner 哨兵闸——「仅 `DOCUMENT_SCOPE_OWNER` 持有者可授」（工单053 §四.2）

### 4.1 闸位：绑定层，非核心层

- **裁定：闸挂 `packages/native`（`js_resource_grant_session` 体内），核心 `grant_permission` 无 owner 语义。** 同族判例三连：①挂载导出 kind 钉死在绑定层（`document_registration` 构造「JS 面无 kind 参数、落位即收紧」，`resource.rs:899-929`）；②`resourceUnregisterScope` 绑定层补会话归属闸、核心签名不动（:876-897 头注自证「绑定层补闸」）；③裁定G B2 总裁定语「绑定层补闸」在册。核心层保持能力面纯性：`grant_permission` 对任何调用方（Rust 内）如实追加——Rust 内调用方本就限 `chips-resource` 依赖闭包，跨信任边界的投递面一律绑定层收口。
- **判定式**：`manager.sessions().get(sessionId)`（访问器 `manager.rs:370`，绑定层现形 `require_session_bound` :888 同款）→ `None` = 会话不在册，拒；`Some(record) if record.owner != DOCUMENT_SCOPE_OWNER_SENTINEL` = 非哨兵持有者，拒；否则放行核心。
- **拒绝形制**：照 `session_gate_denied`（:864-874）同款——`RESOURCE_PERMISSION_DENIED`、`details.permission = "session"`、`reason = out_of_scope`、`required` 空、`granted` 携会话实际权限集快照（诊断性升级：与工单 §四.4「注入缺失可诊断」同源，被拒调用方从 details 即可读出「该会话非文档服务持有」）。target 携 `chips-resource://session/<id>` 形（derive 拒绝臂 E3 :124/:116 同款会话坐标，不泄露任何路径）。

### 4.2 哨兵常量的跨语言单源问题（如实登记）

`DOCUMENT_SCOPE_OWNER` 字面量现唯一**定义点**在宿主 `scope-derivation.ts:41`（E11，裁决I-⑤ 宿主权威单点禁搬 Rust——但那是 scope 派生哈希的纪律；owner 字面量已双处**登记**在册：`packages/native/README.md:76` 与《04.11》§11.3 挂载行 :158「OQ-7 波 A1 定案、host 定义透传」）。A 案闸形要求绑定层持有期望值进行比较，成为第二个**定义**点：`packages/native/src/resource.rs` 新增 `const DOCUMENT_SCOPE_OWNER_SENTINEL: &str = "chips.official.document-service";`。收口形态：字面量以登记面（README + §11.3）为权威、三侧各一条机械锁测钉死同值（宿主既有常量值锁、native 常量值锁、`check-abi`/artifact-gate 面无涉）——漂移即双红，无静默窗口。此为「单一事实源」纪律在跨语言常量上的既有同型解（对照 `NATIVE_RESOURCE_ABI_VERSION = 1` 在宿主 `native-resource-module.ts:53` 的镜像+契约锁案），本 RFC 采同型并如实登记为 OQ-4 候裁位。

### 4.3 跨会话锁测形态（比照 #203 N-1 母型，E14）

母型三要素照搬：**fail-closed 默认**（会话不在册 = 拒，对应 ledger 未在册回 `UNCLAIMED_SESSION` 形）、**编译期常量断言**（母型是 `const _: () = assert!(UNCLAIMED_SESSION > MAX_SAFE_INTEGER)` :1425-1427；本面等价不变量为「哨兵字符串非空且与登记面逐字等值」，以 const 断言 + 值锁承载）、**三态行为锁**（未在册 / 在册他 owner / 在册本 owner，§八 T3）。他域会话注入面测试夹具（`plugin`/`window` 会话、dialog 链 `TEMP_SCOPE_OWNER` 会话）各一臂恒拒，锁死「插件与 dialog 永不可达」（工单 §四.2 第二句）。

---

## 五、议题四：生命周期不变量

1. **不引入第二注销入口（INV-6）**：grant 只触 `permissions` 集追加（E1 双集解耦），**零触** `scopes` 集、句柄账、`detach_scope` 与两拍链。注销入口计数不变的存在性证据 = E10 全链四文件行号（宿主 `unregisterScope` 单入口 + 端口契约 INV 注记），grant 不进入 `doUnregisterScope`（:302-331）任何一拍；`close_session` 级联回收（E3 §3.2 引 `session.rs:172-196`）覆盖 grant 的全部产物——权限集随会话记录消亡，零残留，无孤儿授权态。
2. **不改两拍序（INV-2）**：grant 拍只发生在**建会话与注销之间**的存续期内（§七挂点），与拍①/拍②无交叠；倒置类风险（#213 §2.1(d) 孤儿 scope 死锁推演，E10 注记在册）不因本面新增任何变体——grant 不产 scope。
3. **与 `attach_scope` 职责分离（禁语义混流）**：`attach_scope`（E4）是「scope 入会话绑定集」的挂载侧原语、由 `mount_*` 内部调用；`grant_permission` 是「权限串入会话权限集」的授权侧原语、由本导出触达。两原语在 `SessionRegistry` 内平行同形（同锁、同 `get_mut` 臂、同幂等语义）但**互不调用、互不映射**；实施锁测双向臂：grant 不改 `scopes`、attach/mount 不改 `permissions`（§八 T6）。
4. **反判据登记**（#234 A.3 风险点）：曾考虑把权限塞进挂载/注册参数——mount 族签名已随裁定G 冻结（`§11.3` :158-159 表行在册），扩参即触 §8.6 与 Path1 同罪，独立导出是唯一合法路线（本条为判据留痕，非候选）。

---

## 六、议题五：三方登记与 ABI

### 6.1 新增导出的六处同步点（#234 A.2 六表照录、逐名以现码复核行号）

| # | 同步点 | 现码实读 | 落位动作 |
| - | ------ | -------- | -------- |
| S1 | `packages/native/src/abi.rs` `export_table!` | 全表 :28-84（资源域 20 名 :63-82，末名 `resourceManagedUriOfPath` :82） | +1 行 `"resourceGrantSession" => crate::resource::js_resource_grant_session`（资源域段内按「会话族三行 :75-77 相邻位或域尾 :82 后插——实施单取域尾追加，`test_export_surface_matches_registered_exports`（:124-132 逐项全等锁）随动零特判」；同文件 surface↔EXPORT_NAMES 全等/去重/abiVersion 三锁 :109-160 族零改动随绿 |
| S2 | `packages/native/abi/export-surface.json` | 55 项、`abiVersion: 1`（:2）、`blocked: []`（:280）；`resourceOpenSession` 条目形 :235-238（`{name, kind, signature}` 三键） | +1 条 `{"name": "resourceGrantSession", "kind": "sync", "signature": "(sessionId: number, permissions: readonly string[]) => void"}`；55→56；abiVersion/blocked 不动 |
| S3 | `packages/native/types/chips-native.d.ts` 资源域段 | 段现尾 `resourceManagedUriOfPath` :644；`resourceOpenSession` 声明 :588 及头注族 | +1 函数声明与 JSDoc（主进程内部使用 + 仅文档服务持有者可授注记） |
| S4 | 宿主镜像 `packages/host/src/capabilities/document/adapters/native-resource-module.ts` | `NATIVE_RESOURCE_SURFACE_EXPORTS` 20 名 :59-80；meta 2 名 :83；required 合成集 :86-89（**现值 22**，注释「元信息 2 + 资源域 20」行 :85 在册） | 20→21 名 + required **22→23**（装载闸缺名 fail-closed 形制不变；#238 已把 18→20/20→22 翻实，本波续动） |
| S5 | 宿主锁测 | `tests/e2e-host/native-artifact-gate.test.ts` 判据④ :105 题句 + :110 `expect(surfaceNames.length).toBe(55)`；`tests/document-native-resource-module.test.ts` 名集恰等/两态互锁族 | 55→56、名集 21、夹具链「末位缺失型」负例语义保持（#238 判例：新 stale 夹具替代旧值、旧件平移归档目录，禁删除） |
| S6 | `packages/native/scripts/check-abi.mjs` | 动态读表、零硬编码计数（#234 A.2 核后复跑吻合） | **零改动**；落位后实跑读数 = 56 |

### 6.2 计数口径与登记面随动

- 读数口径：**55（本文 §0.1 实跑）→ 56**。第 56 号导出。
- 资源域表行：《04.11》§11.3 现 20 行（:143-162 逐行数表行实测）→ 21 行；§11.2 结构块随动补注（**漂移登记**：该块代码示例现文 `scopes: Vec<ScopeId>`、无 `permissions` 字段、`open_session` 双参形——与 `session.rs` 实码 E1/E2 三处不符，属波次前旧文；本点位实施波须一并翻正为 `BTreeSet` 双集四参实形，归实施单文档面，不由本文代改文档库红区）。
- native `README.md` 域表段（:124-126「资源管理域十八项…导出面合计 53 项」）——**已滞后现码（20/55）**，属波 B 随动遗漏（#231 交回账面曾列 README，实读未动）；本点位实施波落位时一并翻至 21/56 终态，措辞按实读执行（裁决I-⑥ 判例），供主智能体核后处置，本文不立单。
- 《03.08》§8.6 总表与《03.07》§7.x 镜像表：55→56 与「新增不递增 abiVersion」规则句重申，随实施波。

### 6.3 `CORE_ABI_VERSION` 维持 1 的依据

§8.6「只增不改」在册母型链：第 50 导出 `auditBindDecisionSink`（工单046 段四，README :124-125 登记「49→50」时 ABI 未动）、波 A1（50→53）、波 B（53→55）三轮同判；`constants.rs:12/:25`（E15）值与锁双在册；本点位仅增一行导出 + 一核心新函数，零触既有 55 项任何签名 ⇒ **abiVersion: 1 不动**（S2 行已锁）。

---

## 七、挂点与消费面矩阵（谁调、何时调、失败回退）

| 维度 | 裁定 | 依据/证据 |
| ---- | ---- | --------- |
| 唯一调用方 | 宿主文档服务正式 scope 适配器（`scope-adapter.ts` `registerScope` 流程内） | E11 建会话现场 :243；导出面「主进程内部使用」口径（§11.3 :155 同族措辞），SDK/Bridge/window.chips.\* 零暴露（工单 §四.2） |
| 时序 | `resourceOpenSession`（:243）成功返回后**紧邻同拍**调用 grant（`["resources:write"]`），先于挂载二态分叉（:252-255）。理由：授权与建会话合成单原子建立序，挂载面（E7 会话闸只查存在性）与 grant 无先后耦合，紧邻 open 令「活会话无权限」窗口收敛为零拍；不做按 `writable`/归档态分叉的条件 grant（§八 T8 锁其不变性） | §三.1 幂等形保证重放安全；裁定G 时序图（§6.3）零链序改动纪律同款 |
| 失败回退 | grant 被拒（任何码）→ 与挂载失败同处理：`closeSessionQuietly`（:282-285）回收已开会话 + 如实抛出，**禁吞禁降级静默继续**——与「不注入不伪造」注记（:41-43）同族纪律 | E11 既有回收臂形制（:258/:272 两调用位在册） |
| 权限字面量单源 | 宿主侧 `"resources:write"` 为 TS 直写字符串位（宿主文档域自持常量或字面量由实施单定，须带锁）；跨语言等值权威 = `permission.rs:23`（E5），登记面 README/§11.3 + 双侧锁测钉死漂移，禁 SDK 面转发第二定义位（防双事实源，AGENTS 架构红线） | 工单 §四.1 判定单点、§四.3 三方锁同步纪律 |
| 消费面终局 | 波 C2（受控提交/事务引擎）落位后，Document 写链首次真实消费本授权——本 RFC 落位即宣告工单053「JS 面会话永不可写」不变量的终结与替换为「按 grant 结果判定」 | 工单053 §三「即将」段、§五翻正方向 |

---

## 八、端到端锁测清单（母本 = #234 A.3 四例，逐例补强；全绿判据见 §九）

| # | 用例名 | 断言 | 落点 | 备注（含翻正态） |
| - | ------ | ---- | ---- | ---------------- |
| T1 | `test_grant_permission_idempotent_and_not_found` | 活会话二次授予同串恒 `Ok` 且集不变；不存在会话 → `RESOURCE_NOT_FOUND`；授予不改 `scopes` 集（E4 臂） | `chips-resource/src/session.rs` 内联 tests（attach/detach 锁测 :302-317 同段续位） | §三.1/§五.3 |
| T2 | `test_grant_enables_document_write` | open（空权限）→ Document `Write` 判定 `JudgedDeny{reason: NotGranted, missing 含 resources:write}` → grant `resources:write` → 复判 `JudgedAllow`；grant 限定串 `resources:write:<scope>` → Document 写臂**仍拒**（§三.3 (c) 不做之锁证）；Workspace 形限定串经 `require()` 臂放行一臂（透传语义正证） | `crates/chips-resource/tests/`（新文件或 `error_code_lock.rs` 续臂，实施单定） | #234 A.3-1 母案加限定串双臂 |
| T3 | `test_grant_owner_sentinel_gate` | 三态：不在册会话 → `RESOURCE_PERMISSION_DENIED`（fail-closed）；`plugin`/`window`/`TEMP_SCOPE_OWNER` 会话 → 恒拒；文档服务 owner 会话 → 放行；details 形制逐字（`permission: "session"`、`reason: out_of_scope`、granted 快照在位） | `packages/native/src/resource.rs` 内联 tests（比照 E14 母型三态段 :1420-1453 邻位） | #234 A.3-2 母案，闸形 E13/E14 |
| T4 | `test_grant_never_adds_unregister_entry` | grant 注入后：`scopes` 集零变化、`detach_scope` 触达面零变化、释放臂两拍（拍① :307 → 拍② :326）调用序与调用计数与未 grant 基线形逐字等；注销入口唯一性存在性锁（对镜像清单与适配器出口计数） | 宿主 `tests/document-scope-adapter.test.ts`（既有两拍锁族 :374/:436 邻位） | #234 A.3-4 母案；INV-2/INV-6 判据 |
| T5 | 三方锁 56 全等族 | `check-abi` 输出 56/0；surface↔EXPORT_NAMES 全等（S1 锁随动）；宿主镜像 21 名集恰等 + required 23；artifact-gate 判据④ 56 全等；d.ts 声明逐名在册锁 | S1-S6 各锚点 + `document-native-resource-module.test.ts` | 落位即收紧机械翻正 |
| T6 | 职责分离双向臂 | `attach_scope`/挂载链运行后 `permissions` 零变化（含 writable=true 挂载臂）；grant 运行后 `scopes` 零变化 | native 内联 + chips-resource 内联各一臂 | §五.3 反混流锁 |
| T7 | 负臂：无 grant 写必拒（**补建**） | 经绑定层复刻的完整 JS 面链（open→mount→Write 判定）恒 `RESOURCE_PERMISSION_DENIED`——工单053 §五登记「实态锁测」；T2/T3 正臂并存表达「按 grant 结果判定」。E12 在册：该负臂**当前无既有实现可翻正**，本波补建后「翻正」以「负臂 + 正臂并立」形态兑现，禁静默放宽 | native 内联（grant 落地前后各一态：先落 T7 再落 T2/T3 于同单，语义不互蚀） | #234 A.3-3 口径按实码修正（E12） |
| T8 | 归档态与权限面正交臂 | 归档会话 grant 后挂载 policy 只读强制不变（`RESOURCE_READ_ONLY` 臂与权限判定互不借道，`permission.rs:91-92` `NonPermissionDenied` 臂形在册） | native 内联或 chips-resource 集成臂 | §七 不分叉决定之锁 |

---

## 九、实施切分建议（波次/独占面/预算；在途现实点名）

**在途点名（2026-09-23 W3 row99/row100/row102）**：`crates/chips-parser` = #240 独占在途；`packages/host/**` = #241 独占在途；`tests/perf` = #243；`packages/native` 与 `crates/chips-resource` 自波 B 收口（#231/#238）后**空闲**。Rust 簇现实：`chips-native` 构建依赖 `chips-parser` crate——与 #240 非目录正交面（源码不共触、cargo 构建图共触），W3 §四「扩路准入」条款（Rust 路同一时刻至多占一 crate 簇、cargo 锁只串行化编译互不摧毁）允许并行，但**建议 D1 候 #240 腾面后起手**（判例 #219 双派竞写与 IO 余量风险2 在册），由主排程定夺。

- **D1 核心+绑定面**（独占 `crates/chips-resource` + `packages/native`）：§三 裁定落地 `grant_permission` + 包装 + 绑定导出 + owner 闸 + S1-S3/S6 登记 + T1/T2/T3/T6/T7/T8 锁测 + README 计数随动翻正（含 53→56 补账）；验收 = check-abi 56、`cargo test -p chips-resource`（基线取实跑定案值只增不减）、`test:rust -p chips-native`（108 只增不减）、clippy/fmt 定点。**禁 `--workspace`**。预算建议 90。
- **D2 宿主承载面**（独占 `packages/host/**` + 文档库 04\*/03\* 篇目，候 #241 腾面**且** D1 收口后起手——导出未落位则宿主镜像名集必红，串行硬依赖）：S4/S5 随动 + `scope-adapter` grant 拍接线（§七时序与回退）+ T4/T5 宿主半 + 《04.11》§11.3 行 + §11.2 结构块翻正（§6.2 漂移在册项）+《03.07》《03.08》随动 + 分件/主件版本链。host 基线 1542（在册 flaky 判例照旧）只增不减。预算建议 80。
- 文档面工单随动（批准与收口两笔记账）归主智能体台账单点，不归实施波。

---

## 十、Open Questions（候主智能体裁——签批位）

| # | 问题 | 本稿倾向 | 主裁 |
| - | ---- | -------- | ---- |
| OQ-1 | **A（后置 grant）vs B（open 随权并行导出）终裁**：B 的真实强项已如实在册（核心零 delta、编译期 fail-fast、时序最薄）；A 的台账优势与存续期能力在册。若裁 B，本 RFC §二.2/§三/§六 全部表行随 B 重排（§三三问整体消解）、工单053 台账定形语需同步翻正 | 倾向 **A**（形态已在台账两度登记；核心三问均有低成本裁法，不构成 B 的决定性优势） | **采 A（后置 grant 新导出）**。三点定裁：①工单053 行与 W3 row93/row101 台账两度登记同一形态，改采 B 需先翻台账并重启勘查结论链，收益不抵账面；②B 的两项真实强项（核心零 delta、编译期 fail-fast）在 A 案下由 §三 三问的低成本裁法与 §八 T1/T2 锁测等价达成，并非 A 的劣势；③「存续期增补」是原生会话能力面的语义完整项（open/derive/close 三态外的第四态），非为假想需求预建——B 一旦落位，未来后置授权需求将把 open 族撕成两入口三入口。§二.1 B 行强弱照录不删（备档复核）。 |
| OQ-2 | Path1 代价量化（备档复核用）：动 `constants.rs:12` 值 + :25 锁翻 + export-surface `abiVersion` 宿主镜像 `:53` 双处 + 装载闸等值臂 + 判据④/两态锁全族 + 《03.08》§8.6 冻结文面 + 《04.11》全表 + README 域表 ≈ **10 处机械翻正 + 1 次平台级 ABI 重签批链**，收益仅为「少一个导出」——判失衡 | 维持否决 | **维持否决，量化代价备档**：≈10 处机械翻正 + 1 次平台级 ABI 重签批链换「少一个导出」，且 Neon 侧须为可缺省第三参造 arity 分叉（AGENTS「不留兼容性包袱」明禁）。触《03.08》§8.6 只增不改红线，与裁定G B3 判例同罪同语。 |
| OQ-3 | §三 三问定案：①幂等静默 (a)；②不 revoke (a)；③透传 (a)、Document 写臂不扩限定形（限定形若入 Document 属《06.04》矩阵协议变更另走 RFC） | 照案三 (a) | **照案三 (a)**：①幂等静默（与 `attach_scope` 集语义同方言，绑定层不造第二语义）；②不提供 revoke——`derive_session`（收窄）与 `close_session`（终结）双撤销面已在册，新增活会话降权即 INV-6 同族的第二撤销通道，且不抢 `PermissionDenyReason::Revoked` 词位（裁定F §5.2 链路二专用）；③字符串透传、**Document 写臂不扩限定形**——限定形入 Document 属《06.04》§4.3 判定矩阵协议变更，须另走 RFC，不归本点位（§八 T2 已锁死该不扩性）。 |
| OQ-4 | owner 哨兵字面量绑定层第二定义位 + 三侧值锁收口（§4.2）是否照采；或主裁另给「绑定层零字面量」形态（如 grant 入参携期望 owner 的自证形——本稿已论证其闸形劣于常量锁） | 采 §4.2 案 | **采 §4.2 案**：绑定层持 `DOCUMENT_SCOPE_OWNER_SENTINEL` 常量 + 三侧机械值锁（宿主常量值锁 / native 常量值锁 / README+《04.11》§11.3 登记面为权威）。理由：闸的强度来自「不可被调用方左右的编译期常量」，自证形（grant 入参携期望 owner）把权威交给被校验方，等于无闸。跨语言字面量双点是该纪律在既有在册形态（`NATIVE_RESOURCE_ABI_VERSION` 宿主镜像 + 契约锁）下的同型解，非新增债务。 |
| OQ-5 | grant 拍位微裁：紧邻 open（本稿倾向）vs 挂载后追加；及空数组 no-op 形是否在册锁测（T1 边界臂） | 紧邻 open；空数组 = 成功 no-op | **紧邻 open 同拍**（「活会话无权限」窗口收敛为零拍；条件 grant 不做，§八 T8 锁不变性）；**空数组 = 成功 no-op** 入 §2.2 参数校验与 T1 边界臂。 |
| OQ-6 | 用例基线口径：263（台账）vs 262（本文静态）差 1——D1 起手先跑 `cargo test -p chips-resource` 实读定案并以实跑数为「只增不减」基线锚 | 实跑定案 | **实跑定案 = 263**（主智能体 2026-09-23 批后复跑 `cargo test -p chips-resource`：10 套件、263 passed / 0 failed、EXIT=0）。台账 263 为权威，本文 §0.1 静态清点 262 系口径出入（静态 `#[test]`+`#[tokio::test]` 逐名清点漏计 1，与实跑数差 1）——D1 的「只增不减」基线锚一律取 **263**，后续以 D1 收口时实跑数为新基线。 |
| OQ-7 | E12 负臂补建与 §6.2 两处登记面滞后（native README、04.11 §11.2 结构块）是否随 D1/D2 一并收口不另立单（本稿倾向：随波收口、台账注记） | 随波收口 | **随波收口，不另立单**：①E12 负臂 T7 本波**补建**（禁以「翻正既有用例」行文——该用例不存在，工单053 §五与 #234 A.3-3 措辞超前于实码，已在台账 053 行与 W3 row101 验收注记双侧翻正）；②`packages/native/README.md` 域表 18/53 → 21/56 随 D1；③《04.11》§11.2 结构块（`Vec<ScopeId>`/双参/无 permissions 字段）翻正为 `BTreeSet` 双集四参实形随 D2 文档面，§11.3 +20→21 行同批。三处均为登记面滞后，无生产语义分叉。 |

---

## 十一、主裁批注（裁定J · 2026-09-23，签批人=主智能体）

1. **签批范围**：本文五议题全部照案成立——形态 Path2-A（第 56 导出 `resourceGrantSession`，同步 `void`）、核心三问（幂等静默 / 不 revoke / 字符串透传且 Document 写臂不扩限定形）、owner 哨兵闸落绑定层、生命周期四不变量、三方登记六同步点与 `CORE_ABI_VERSION` 维持 1。§二.1 中 C（Path1）/D（只读降级）两案否决语由主裁背书备档。
2. **实证补强（签批时主裁复跑）**：`cd packages/native && node scripts/check-abi.mjs` → 「导出 55 项，阻塞 0 项」EXIT=0（本文 §0.1 读数复核一致）；`cargo test -p chips-resource` → 10 套件 **263 passed / 0 failed** EXIT=0（OQ-6 定案）。
3. **勘误随批（不另立单）**：①派单书闸命令措辞 `npx pnpm@9 run check-abi` 失实，正确为 `node scripts/check-abi.mjs`（native `package.json` 的 `test`/`test:contract`/`lint` 挂载），W3 row101 验收注记内翻正；②工单053 §五与 #234 A.3-3 所称「JS 面会话写必被拒」锁测**不存在**（全仓仅 `scope-adapter.ts:41-43` 注记），台账 053 行按实码翻正；③#234 报告行号系时性 drift（第 54→第 56 导出、`resource.rs:784-786/:803`→:799-801/:818、`scope-adapter.ts:306-307`→:307/:326），以本文 §一 自测值为准，历史报告不回改。
4. **实施排程（授权即解锁，起手仍受面占用约束）**：D1（`crates/chips-resource` + `packages/native`，含 T1/T2/T3/T6/T7/T8 与 README 计数补账，预算 90）候在途 Rust 路腾面后起手；D2（`packages/host` + 文档库 03\*/04\* 篇目，含 S4/S5、`scope-adapter` grant 拍、《04.11》§11.2/§11.3 与《03.07》《03.08》随动，预算 80）**硬串行于 D1 之后**（导出未落位则宿主镜像名集必红）且候 #241 腾面。批准前零实施纪律解除的口径自本节起失效，但面占用与串行纪律不变。


---

**变更记录**

| 版本   | 日期       | 变更 |
| ------ | ---------- | ---- |
| v0.1.0 | 2026-09-23 | 初稿（任务 #242，纯文档零代码）：五议题裁定提案 + 四路方案诚实对比 + 全量行号自测基线（check-abi 55 实跑在册）+ 三处漂移登记（E12/§6.2/§0.1 行号 drift） |
| v1.0.0 | 2026-09-23 | **主裁签批（裁定J）**：§十 OQ-1~7 主裁列全部落定（采 A / Path1 否决备档 / 三问照案 (a) / 绑定层哨兵常量三侧值锁 / 紧邻 open + 空数组 no-op / 基线 263 实跑定案 / 三处滞后随波收口）；新增 §十一 主裁批注（含 check-abi 与 chips-resource 263 复跑实证、派单书命令措辞与 E12「锁测不存在」勘误、D1/D2 实施排程与串行约束）；状态 草稿·待主裁 → 批准 |
