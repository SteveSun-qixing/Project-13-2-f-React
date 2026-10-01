# W5 · 宿主 document:create / document:export 内置实现 · 开发计划（派单蓝图）

> 用户裁决第 2 项（宿主平台内置）执行蓝图 ｜ 起草：Goal-Mode 主智能体 2026-10-01 深夜 ｜ 状态：待派单（配额 23:30 后执行）
> 契约权威：04.10-7.3 文档 document-（:14/:19 输入输出表、:107/:172 schema、:231-233 受控写口约束）；11-文档服务设计 §十（错误码）§5.5（摘要口径）

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

## 二、架构决策（本蓝图裁定，执行照办）

1. **落点**：`capabilities/document/service.ts` 增 `createDocument` / `exportDocument` 服务方法 + `ports.ts` 增两个端口方法 + `descriptors.ts` 增两能力描述符 + `production-wiring.ts` 装配；复用 C3 `storage-adapter`（changeset 链）——**create 的目录态写入走既有 `commit()`（新建成员集合）、箱子归档态走 C2a-3 `archive.rs` 整包换代写通路（storage-adapter 已承载 save 的同一写径）**。
2. **export 不新增写径**：archive 形=「serialize 全量 → 目标路径归档写入」（复用 save 的整包换代写径，target 替换 source 路径）；directory 形=「serialize 全量成员 → 目标目录逐成员落盘」；两者终点统一走 `digest.ts` 计算回执。`overwrite=false` 且 target 存在 → 既有 file 域 `FILE_*` 冲突码（经 file 域校验链探测存在性，**不在文档域自造探测**）。
3. **create 的内容初值依赖（关键决策）**：`createInitialContent()` 在插件上下文执行依赖 T7 帧通道（未交付）。分两段交付：
   - **本单（T-create-1）**：受控写口完整落地，初值装配面预留 `IInitialContentSource` 端口（注入形制，生产实现=T7 帧通道的插件调用臂）；端口缺位时行为=**契约允许的最小合法初值**（空 content + metadata/structure 按 DocumentKind 规范装配 + validate 通过），并在回执 diagnostics 如实标注「初值来源=规范缺省（插件初值通道候 T7）」——**这不是占位**：空初值本身是契约合法产物（插件可在编辑臂补内容），端口注入形制与 G6 判例同构。
   - **T-create-2（T7 交付后）**：生产 `IInitialContentSource` 接 `createInitialContent()` 插件调用，删除缺省臂。
4. **ID 生成**：`card_id`/`box_id` 用 chips-parser/cordis 既有 ULID 面（工单014 已收口 cordis-ULID 并发问题）——经 parser 端口或直接引入 cordis ULID（host 已依赖 native；优先 parser 端口暴露，若无则 native 绑定补导出，`export_table!` 单源）。
5. **名称冲突枚举**：parent 目录枚举经 `IDocumentScopePort`（已列目录成员面；若无枚举方法则经 resource 域 listDirectory——G6 后 resource 读面已全作用域）。
6. **注册**：两能力走 `createBuiltinCapabilities` 同族的 document 域描述符（permissions 按 R19：create/export 的权限 ID 逐字查 R19 表）。

## 三、分段实现与测试计划

| 段 | 内容 | 验收 |
|---|---|---|
| T-exp-1 | exportDocument（archive/directory 双形+overwrite+digest） | 契约测试：schema 拒绝/错误码逐字/digest 口径锁测；端到端：open→write→export→再 open 产物往返恰等 |
| T-exp-2 | exportDocument(directory 形) 成员逐字节恰等（listMembers 对照） | 同上 |
| T-create-1 | createDocument 受控写口（ID 生成/模型装配/validate/名称冲突/保留区拒绝/无半成品保证/IInitialContentSource 注入缝） | 契约测试全分支：WORKSPACE_RESERVED_PATH/DOCUMENT_SAVE_FAILED/DOCUMENT_STRUCTURE_INVALID/冲突后缀序列/box 归档态产物/卡目录态产物；离线 fake 端口+真机 env 臂 |
| T-create-2 | （T7 后）IInitialContentSource 生产臂接 createInitialContent | 插件上下文调用锁测 |

## 四、红线自查

禁 TODO/占位（IInitialContentSource 是注入缝+缺省合法初值，非占位：缺省臂产出契约合法文档）；禁自造错误码/ID；编辑器不写文件红线不涉；契约与本蓝图冲突以文档库为准并记录根因。
