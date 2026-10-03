# W5 · 宿主 document:create / document:export 内置实现 · 开发计划（派单蓝图）

> 用户裁决第 2 项（宿主平台内置）执行蓝图 ｜ 起草：Goal-Mode 主智能体 2026-10-01 深夜 ｜ 状态：**v2 修订（2026-10-01 深夜侦察后）**，候派单
> 契约权威：04.10-7.3 文档 document-（:14/:19 输入输出表、:107/:172 schema、:231-233 受控写口约束）；13.04-工作区设计 §4.2（export 九条规则）§4.3（导入流程）；11-文档服务设计 §十（错误码）§5.5（摘要口径）；05-ID生成规范 §三/§四（ID 生成算法与责任）

## 〇、v2 侦察修订（2026-10-01 深夜逐面实测后修正 v1 三处判断）

1. **ID 生成权威在 Rust 核心受控写口**（05-ID生成规范 §四表：card_id/box_id 生成方=文档服务（Rust 核心受控写口）；算法=CSPRNG 拒绝采样 b<248 均匀映射 62 字符集，**非 ULID 派生**，禁时间戳/机器标识成分）——v1「cordis ULID 面」判断作废。实现=chips-parser 或 chips-resource 增 `generate_document_id()` 导出（native `export_table!` 单源随扩），TS 侧不实现 ID 生成。
2. **createInitialContent 无需等 T7**：basecard 模块由 plugin-activation 装载（`src/main/plugin-activation.ts:111` 在册导出面含 createInitialContent），受控写口经插件注册表面直调已装载模块的该纯函数即可；IInitialContentSource 端口的生产实现=插件注册表消费臂。
3. **export 目标必须经作用域账本注册**（storage-adapter `resolveTarget`：`ledger.findByPackageRoot` 未命中即 `RESOURCE_NOT_FOUND` fail-closed）——export 前须对目标受管引用执行 `registerScope`（幂等臂），导出后的作用域生命周期（驻留 or 注销）属工作区域 T-ws 决策（孤儿常驻 scope 风险=INV-2 明载），**不可留半决策**。
4. **跨形态导出需 Rust 侧配合**（序列化器强制声明形态=数据源实际形态，`serialize/mod.rs:318` FormatUnknown 闸；file_info 按请求形态重算 `:511`）——directory↔archive 转换臂需 chips-parser 增「目标形态 file_info 重算」支持；同形另存臂（directory→directory / archive→archive）无此依赖，可先行。
5. `RESOURCE_ALREADY_EXISTS` 已在册（scope-adapter 在用）；`WORKSPACE_RESERVED_PATH` 全库无实现面（13-工作区设计保留区登记未落地）——保留区检查臂候 T-ws，禁造第二套保留区判定。

## 一、契约硬约束逐条（实现不得违反）

### document:create（新建唯一受控入口）
1. 输入 schema（04.10:107-124）：`kind`(card/box 必填)、`parent`(受管引用必填)、`name`(1-255 可选)、`initialContent`(仅 `cardType`/`layoutType` 装配提示，**禁止携带内容初值**)。
2. 输出：`{ documentId, source }`；卡片落**目录态**工作副本、箱子落**归档态**单文件。
3. 受控写口内完成：`card_id`/`box_id` 生成 → 初始模型装配（metadata/structure/content/布局配置）→ `validate`。调用方不得自行拼装 .card/.box 字节（R8）。
4. **内容初值唯一来源**：受控写口在插件上下文中调用该类型插件的 `createInitialContent()`（§:233）。
5. 名称缺省「未命名卡片」/「未命名箱子」；冲突自动 `-2`/`-3` 后缀（需 parent 目录枚举能力）。
6. `parent` 落保留区/保留前缀 → `WORKSPACE_RESERVED_PATH`。
7. 写失败不留半成品；错误码 `DOCUMENT_SAVE_FAILED` / `DOCUMENT_STRUCTURE_INVALID`（11 §十）。

### document:export（另存/导出）
1. 输入（04.10:172-181）：`documentId`、`target`、`form`(archive/directory)、`overwrite`(默认 false)。
2. 输出：`{ target, digest }`；digest=归档态文件摘要 / 目录态包内容摘要（口径 11 §5.5，复用 `digest.ts`）。
3. 语义=对已打开会话做「另存到 target」；与 11-文档服务设计一致。

## 二、架构决策（v2 修订，执行照办）

1. **分段依赖序**：本两能力的前置=T-ws 工作区作用域臂（目标账本注册生命周期+保留区登记面）与 Rust ID 生成导出——故执行序为 **T-ws → T-id(Rust) → T-exp → T-create**；T-ws 与 T6/T7 同属工单036 残段收尾波，由主智能体统一排序。
2. **export 分两段**：T-exp-A（同形另存：serialize 源形态 → commit 目标同形态 → digest；无 Rust 依赖，T-ws 后即可）；T-exp-B（跨形态两态转换：chips-parser 增目标形态 file_info 重算后放开，13.04 §4.2 规则 6）。
3. **create**：受控写口全链——T-id 生成 ID → 插件注册表面调 createInitialContent（v2 修订②）→ 初始模型装配（metadata 按 validation.ts 最小合法集+名称冲突 -2/-3 经 scope 目录枚举）→ validate → storage.commit（卡片目录态/箱子归档态）→ 回执 {documentId, source}。
4. **权限**（R19 §6.2 逐字）：create=[resources:write]（targets: parent）；export=[resources:read + filesystem:write]（targets: filesystem:write→target；源 read 已随 open 判定）。
5. **无半成品**：create 失败路径回滚=commit 前全部内存操作+失败后 unregister 目标作用域（两拍时序 INV-2）；export overwrite 原子性由 changeset publish 天然承载。
6. **validate 闸**（13.04 §4.2 规则 5）：导出前源文档基线诊断含 severity=error 即拒（DOCUMENT_STRUCTURE_INVALID，diagnostics 附 details）；ValidWithWarnings 放行且回执带诊断。

## 三、分段实现与测试计划（v2）

| 段 | 内容 | 验收 |
|---|---|---|
| T-ws | 工作区作用域臂（与 T6/T7 同波排序）：目标账本注册生命周期 + 保留区登记面（13.03 §三） | 既有 scope 锁测只增不减 |
| T-id | Rust `generate_document_id()`（CSPRNG 拒绝采样）+ native 导出扩面 | Rust 测试（均匀性/文法/查重注入）+ export-surface 恰等随动 |
| T-exp-A | 同形另存 | 契约测试：schema 拒绝/权限双检/digest 口径锁测/overwrite 语义（RESOURCE_ALREADY_EXISTS）；端到端 open→write→export→open 产物往返恰等 |
| T-exp-B | 跨形态两态转换（Rust file_info 目标形态重算） | 13.04 §4.2 全规则锁测 |
| T-create-1 | 受控写口全链（见二.3） | 契约测试全分支：WORKSPACE_RESERVED_PATH（T-ws 后）/DOCUMENT_SAVE_FAILED/DOCUMENT_STRUCTURE_INVALID/冲突后缀序列/箱归档态产物/卡目录态产物/初值来源=插件注册表 |
| T-create-2 | 名称冲突枚举与 -2/-3 分配器 | 分配器锁测（缺省名/冲突/ exhaust） |

## 四、红线自查

禁 TODO/占位；禁自造错误码/ID；编辑器不写文件红线不涉；契约与本蓝图冲突以文档库为准并记录根因；T-ws 未落地前 T-exp/create 不得抢跑（fail-closed 判据不放宽）。
