# W5 迁移：notes / settings / resource-manager 三应用起步臂开发日志

> 日期：2026-10-01
> 任务：派单行表 #9（settings，可立即派·骨架/导航臂）、#12（resource-manager，候前置件·信息架构/导航骨架可先派）、#13（notes，候前置件·领域层起步臂——`document:*` 已随工单036 波 C3 翻正为宿主真实现，本臂直接消费）三包第③段起步臂；本臂均不做端到端。
> 包：`chips-ecosystem/plugins/apps/{notes,settings,resource-manager}/`（分支「第五次重构」，全程零 git 写操作）
> 母型：骨架四文件形制（appCommands/useAppCommands/AppView/index）＋ W5 第一迁移批判例（video-player 偏好降级、book-reader manifest 命令逐字锁测、photo-viewer 会话编排）；三包同文件分节记账。

---

## 一、notes（chips.official.notes）：领域层起步臂 + UI 壳

### 1.1 交付清单

| 交付面 | 判定 | 落点 | 说明 |
|---|---|---|---|
| 笔记数据模型 | 重写 | `src/domain/notes/model.ts` | 旧 `NotebookInfo/NoteInfo/TreeNode`（依附旧 SDK Client 扫描链，矩阵判重写）领域划分保留——以 `.box` 为笔记本、`.card` 为笔记；标识一律取 `document:open` 回包（`documentId` = `card_id`/`box_id`），不自造 ID；库分区收录（幂等替换）、标签拍平、条目呈现、结构节点序、来源守卫全纯函数 |
| 存储契约消费面 | 重写（真实现消费） | `src/domain/notes/documentGateway.ts` | `document:open`/`document:read` 经 `chips.request` 正式面（宿主真实现，工单036 波 C3）；组合语义与宿主 `validation.ts` 同源（卡片 content 必携 `nodeId`、箱子 content 不携、`entries` 仅箱子且可分页）；回包切片一致性防御复核；错误归一携带 Bridge 码 |
| UI 壳 | 重写 | `src/ui/AppView.tsx` + `NoteEditor.tsx` + `useNotesLibrary.ts` | 左列表（笔记本/笔记分区）+ 右编辑区骨架（元数据/标签/条目/内容节点懒加载只读呈现）；打开臂为来源引用显式输入；文案简体中文直写、样式全 token、`message` 走 `App.useApp()` 许可通道 |
| 命令族 | 重写 | `src/commands/` | `notes:open-card`/`notes:refresh-view` 与 manifest `cli.commands` 逐字对应（锁测）；处理器路由到领域控制器真实动作，非法载荷如实上报失败 |

### 1.2 诚实降级与登记（不假接线）

- **工作区枚举通道缺位**（`filesystem:read:${workspace}` 域，工单036 后续段）：笔记库不做目录扫描，只经打开臂显式收录；域处理器落波后增扫描装配臂。
- **编辑链路缺位**（候 IEditSession 生产装载，工单036 波 C 终闸）：编辑区只读消费，不接线 `document:write`/`document:save`、不声明 `resources:write`、不伪造可编辑外观。
- **命令通道缺位**：骨架既有口径保持——注册失败收敛为「命令通道异常」状态行，界面照常工作。
- **触禁件零触达**：旧仓 `Tree`（DirectoryTreePanel）/`message` 静态实例/`Popconfirm` 不迁移（候第十二项）；组织呈现以白名单件（List/Tag/Badge）承担。
- **骨架清单修正**：骨架 manifest `permissions` 误登 `document:write`（能力 ID 非权限 ID，不在《插件清单规范》§6.2 权限词表）——翻正为 `resources:read`（`document:open/read` 所需），命令面保持 `command:write`/`command:execute`。

---

## 二、settings（chips.official.settings）：偏好域起步臂 + 注册表壳层

### 2.1 交付清单

| 交付面 | 判定 | 落点 | 说明 |
|---|---|---|---|
| 九类导航注册表 | 重写 | `src/domain/settings/catalog.ts` | 《05-生态设置面板设计》§2.1 逐字对应（Scene ID/标题/顺序/摘要）；每分类声明跳转命令 ID 与依赖宿主域（`requiredDomains`），壳层与页面只消费注册表（§2.3） |
| 偏好项模型与分组契约 | 重写 | 同上 | §3.1/§3.2 六键逐字对应（键位/默认/枚举集/整数下界/高级标记）+ 页内分组（界面/窗口/通知与更新/高级）；取值归一（枚举白名单、整数界收敛、布尔校验） |
| 偏好存储 | 诚实降级 | `src/domain/settings/preferenceStore.ts` | `SettingsPreferenceStore` 接口 + 窗口会话内存态实现（工单066）；即时生效、单项/分类级恢复默认、快照+生效层如实标记「会话内存（未持久化）」 |
| 壳层与页面 | 重写 | `src/ui/AppView.tsx` + `Scenes.tsx` | Menu 九类导航（在册图标：BgColors/Thunderbolt/FolderOpen/Appstore/SafetyCertificate/Key/FileDone/Database/InfoCircle，经 `@chips/ui` 转发）+ 外观/行为页（`SettingsLayout`/`SettingsGroup`/`SettingsRow` 三件套，枚举→Select、布尔→Switch、整数→键入+常用档，InputNumber 属禁面组件）+ 七类域依赖页诚实降级 |
| 命令族 | 重写 | `src/commands/` | `settings:refresh-view`（manifest CLI 在册，元数据逐字锁测）+ 九类 `settings:open-<sceneId>` 分类跳转（运行时注册，CLI 消费入口语义不适用——判例同 video-player 播放控制族）；载荷防御收窄，不一致如实上报失败 |

### 2.2 诚实降级与登记（不假接线）

- **`config:*` 配置域宿主处理器缺位**（**工单066 在册**，本臂同源消费不重复开单）：偏好持久化降级窗口会话内存态；接口收口待换接 `IAppConfig`/`chips.request('config:*')`，消费面零改动；平台键 schema（10-配置系统设计 §四）落定后随包补 `config.schema.json`。
- **七类治理页依赖域缺位**：工作区（`config:get`/`shell:openExternal`，config 域关联工单066）、关于更新（`system:info`）、插件治理/权限/快捷键/文件打开方式/存储缓存（各自查询域）——页面如实呈现依赖域与落波去向，不铺替代数据、不设不可用控件。
- **命令 ID 文法收口**：设计文档 §2.3 所记 `<面板插件ID>.scene.<sceneId>` 点号旧记法与《13-命令系统契约》§2.1 文法（禁点号，注册期 `COMMAND_DEFINITION_INVALID`）冲突——按契约取 `settings:open-<sceneId>`；文档勘误候裁（本路不代改文档，比照 W5 开工前置勘查「只登记、不代改」判例）。
- **骨架清单修正**：`resources:read` 本臂零消费，从 manifest permissions 退出；`cli.commands` 由模板默认的 `open-card`（设置面板无卡片打开语义）换为 `settings:open`（打开/聚焦主窗口）+ `settings:refresh-view`。
- **触禁件零触达**：`InputNumber`（禁面）以键入+预设档承担；`message` 走 `App.useApp()` 许可通道。

---

## 三、resource-manager（chips.official.resource-manager）：资源浏览域起步臂（只读）

### 3.1 交付清单

| 交付面 | 判定 | 落点 | 说明 |
|---|---|---|---|
| 条目呈现数据模型 | 全新建 | `src/domain/browse/entryModel.ts` | 《04-资源管理器产品设计》§1.4 逐条落面：浏览位置清单（`documentId` 幂等、最近打开在后）、条目呈现投影（启用前置 + zh 词序、名称取 `url` 末段）、分页切片（与 `document:read` range 语义镜像）、结构计数、标签拍平、来源守卫；不自造 ID |
| 只读消费面 | 全新建（真实现消费） | `src/domain/browse/browseGateway.ts` | `document:open`/`document:read`（`resources:read` 解锁且宿主真实现，工单036 波 C3）：卡片 → 结构摘要、箱子 → 条目清单（range 分页）；回包切片防御复核；错误归一 |
| 三栏壳 | 全新建 | `src/ui/AppView.tsx` + `BrowseView.tsx` + `useResourceBrowser.ts` | §2.2 三栏最小可用面：导航栏（快速访问「工作区根·未就绪」如实呈现 + 已打开位置）+ 内容区（来源输入工具栏 + 条目/结构列表 + 详情面板）；`Tree` 属禁面组件，组织呈现以 List 承担；样式全 token |
| 命令族 | 全新建 | `src/commands/` | `resource-manager:open-card`/`resource-manager:refresh-view` 与 manifest `cli.commands` 逐字对应（锁测）；处理器路由真实浏览动作 |

### 3.2 诚实降级与登记（不假接线）

- **目录树数据源缺位**（`filesystem:read:${workspace}` 域，工单036 后续段）：不做目录扫描、不伪造树形列表；目录树/位置模型/视图模式（列表/网格/时间线）候域处理器落波逐档启用。
- **写臂缺位**（`resource:write`/`resources:write`，工单036 后续段注册）：重命名/移动/复制/删除/新建目录/批量标签（§五）不实现、不声明写权限；manifest 权限面与只读实现一致（`resources:read` + 命令面）。
- **打开意图路由缺位**：`resource:open` 未落位，条目「打开」动作（§5.1）为后续臂。
- **跨会话浏览状态/收藏/最近缺位**：插件私有数据目录通道未接，位置清单为会话内存态（§2.4 分层如实降级）。
- **命令通道缺位**：骨架既有口径保持；窗口底部 banner 如实呈现「命令通道异常」。
- **触禁件零触达**：`Tree` 不迁移；`message` 走 `App.useApp()` 许可通道。

---

## 四、三包共同记录

1. **依赖面**：三包 `package.json` 增 `@testing-library/react@16.3.3` + `jsdom@28.1.0`（与第一迁移批五包一致）；vitest 配置 node→jsdom + `tests/setup.ts`（仅补 matchMedia/ResizeObserver 平台面，零业务 mock）。安装持 `/tmp/w4-lockguard` 目录锁，三包一次安装。
2. **测试先测后码**：领域层真实断言（模型纯函数、网关调用形状与切片组合、命令载荷收窄、jsdom 真挂载壳层与宿主缺位契约），三包共 82 用例（notes 28 / settings 30 / resource-manager 24）。
3. **FORBIDDEN_ANTD_EXPORTS 机检（词界双验法）**：A 面 antd/`@chips/antd` 直连导入三包零命中；B 面 28 名扫描全部命中逐条溯源——`Tree`/`Layout`/`InputNumber` 均为「不迁移」注释说明，`message` 为 `App.useApp()` 许可通道、Alert `message` 属性（载荷字段）与构造函数形参（局部概念），零静态实例通道、零禁面组件触达。图标经 `@chips/ui` 转发的 `@ant-design/icons` 在册名（初稿曾直连 `@ant-design/icons`，按 R4「业务代码图标一律从 `@chips/ui` 导入」收口）。
4. **构建产物**：`dist/index.js`（主进程自包含 ESM）+ `render.js`（vendor 外部化：notes 26.49 kB / settings 24.22 kB / resource-manager 24.95 kB）；构建期红线守卫（`rejectForbiddenImports`）通过。
5. **文档库**：《09-官方插件与应用目录》三行状态翻正（notes 待实现 / settings、resource-manager 已设计 → 已迁移起步臂）候端到端臂收口随批办理（工单060 判例：应用行翻正与端到端就绪同步，本臂不代改）。

## 五、验证（亲跑，2026-10-01）

| 包 | test | typecheck | lint | build |
|---|---|---|---|---|
| notes | 5 文件 28 用例全绿 | EXIT=0 | 0 错 0 警 | index.js + render.js 26.49 kB |
| settings | 5 文件 30 用例全绿 | EXIT=0 | 0 错 0 警 | index.js + render.js 24.22 kB |
| resource-manager | 5 文件 24 用例全绿 | EXIT=0 | 0 错 0 警 | index.js + render.js 24.95 kB |

未跑 `gates:all`（按派单约束）。

## 六、边界与后续（候裁/候波次，不代裁）

1. **工单066**（在册，同源消费）：config 域处理器落波后，settings 偏好翻正持久生效 + 补 `config.schema.json`；notes/resource-manager 无偏好面不受累。
2. **工单036 后续段**（在册，同源消费）：`filesystem:*`/`resource:write` 域处理器与作用域链路收口后——notes 增工作区扫描装配臂与编辑链路臂（IEditSession 波 C 终闸），resource-manager 增目录树/写臂/收藏最近/标签导航臂。
3. **设计文档勘误候裁**：settings 设计文档 §2.3 命令 ID 点号记法与 13-契约文法冲突（本臂按契约收口）；候文档随动波勘误。
4. **《09-官方插件与应用目录》三行状态翻正**：候端到端臂收口随批办理。
5. 触禁件第十二项裁定（`Tree` 替代件形态）落定后，notes 分区列表与 resource-manager 位置树按在册替代件升级嵌套呈现。

---

## 七、notes 写面翻正臂（后续臂，2026-10-01 追记）

> 任务：notes 独占（`plugins/apps/notes/`）；C3 已交付 `document:write`/`document:save` 宿主真实现（changeset 两相 + revision 严格递增），本臂把起步臂「只读消费」的写面翻正为真实现消费。假桥舞台测试形制参照 photo-viewer，编辑时序判例同 `plugins/basecards/richtext` 编辑器。

### 7.1 交付清单

| 交付面 | 判定 | 落点 | 说明 |
|---|---|---|---|
| 网关写臂 | 真实现消费 | `src/domain/notes/documentGateway.ts` | `document:write`（回执 `{revision}`，正整数守卫）与 `document:save`（回执 `{source,digest}` 形状守卫）经 `chips.request` 正式面；插件侧防御复核码分列（`DOCUMENT_REVISION_INVALID`/`DOCUMENT_SAVE_RECEIPT_INVALID`，与在册码不混用）；写面开放 `metadata`/`content` 两族切片，`structure`/`entries` 写属编辑链路与箱子组织臂（裁决 B4 同保存一致性，应用不拆开写）——边界在网关头注明载 |
| 编辑会话 | 全新建 | `src/domain/notes/editSession.ts` | 《本轮架构收口裁决》B3 唯一时序的应用前端侧落点：`getChange()` → 校验（宿主 `validation.ts` 同场景同码镜像：name 空→`DOCUMENT_METADATA_INVALID`、内容非对象→`BRIDGE_INVALID_INPUT`）→ `document:write` → 投影更新（update）→ `markCommitted(revision)`；修订水位严格递增锁（不大于当前水位的回执一律拒绝，与 richtext 编辑器同型）；投影失败不确认提交（可重试），失败不丢待提交变更 |
| 写后重读投影 | 全新建 | `useNotesLibrary.ts` + `model.ts` | 提交链第④拍以 `document:read` 重读宿主模型更新投影（元数据重读回填详情面 + `applyDocumentTitle` 翻正列表标题；内容节点重读更新呈现），不本地拼装第二事实源；保存成功后整卷重读（宿主已按新磁盘基线收口） |
| UI 编辑保存链 | 重写 | `NoteEditor.tsx` + `AppView.tsx` | 重命名/描述（箱子）输入暂存 → 待提交条（facet 标签 + 提交/放弃）→ 修订徽标（`修订号 N`/`未写入`，回执驱动）→「保存到磁盘」（`document:save`，摘要回执呈现）；内容节点 JSON 对象文本编辑（按节点读改写整体替换，保留 `node_id`/`file`/`card_type` 包络） |
| 冲突/失败臂 | 全新建 | 同上 | `DOCUMENT_WRITE_CONFLICT`/`DOCUMENT_SAVE_FAILED`/`DOCUMENT_SOURCE_CHANGED`/`DOCUMENT_NOT_OPEN` 等真实错误码行内 Alert（简体中文 + 通道消息 + 同源处置指引 `writeErrorGuidance`），不吞错、不假成功；修订徽标失败不前移，待提交保留可重试 |
| manifest 权限翻正 | 修正 | `manifest.yaml` | 起步臂「编辑链路缺位不声明写权限」随本臂翻正：补 `resources:write`（`document:write`/`document:save` 所需，宿主 `DOCUMENT_CAPABILITY_PERMISSIONS` R19 映射同源） |

### 7.2 测试（先测后码，28 旧用例零放宽）

- `tests/edit-session.test.ts`（21 用例，全新）：校验臂同码镜像、JSON 装配守卫、切片装配（整体替换语义）、暂存臂、修订水位严格递增锁、提交链严格时序（journal 断言 write→projection→committed 次序；no-change/invalid/write-failed/revision-stale/projection-failed 各臂）。
- `tests/document-gateway.test.ts`（+7）：写链契约（metadata/content 调用形状、`{revision}` 正整数守卫、冲突与失败码原样传播）、save 链契约（`{documentId}` 形状、回包形状守卫、失败传播）。
- `tests/app-view.test.tsx`（+6，假桥舞台）：按已登记能力 ID 回放宿主语义的受控假桥（changeset 覆盖层 + revision 计数）；重命名全链（写切片完整性、写后重读、修订徽标与列表标题翻正）、revision 回执递增驱动 UI 状态（两次提交徽标 1→2）、冲突臂行内提示、内容节点编辑链（包络保留）、保存成功/失败臂。
- 断言定位注记：antd `Alert` 与 `message` 通知均带 `role="alert"`，写链错误面按 `data-role` 精确定位；内容呈现面按 `data-role="node-display"` 与编辑框区分。

### 7.3 边界与登记

- **新建文档不接**：`document:create`/`document:export` 不在宿主文档能力单范围（`packages/host/src/capabilities/document/contract.ts` 头注明载），新建笔记无正式面可消费——不伪造入口；宿主落波后随臂接线。
- **`structure`/`entries` 写不开放**：结构替换须与内容成员同保存一致（裁决 B4），结构新增节点初值唯一来源为插件 `createInitialContent()`（应用不可提交）；`entries` 组织（启停/排序）属箱子组织臂，候派。
- **既有边界延续**：工作区枚举通道缺位（打开臂显式收录）、工单066、触禁件裁定等沿用起步臂 §1.2/§六 登记，本臂未触碰。

### 7.4 验证（亲跑，2026-10-01，四闸全绿）

| 闸 | 结果 |
|---|---|
| test | 6 文件 62 用例全绿（起步臂 28 + 本臂 34） |
| typecheck | EXIT=0 |
| lint | 0 错 0 警 |
| build | `dist/index.js` + `render.js` 42.67 kB（vendor 外部化） |

FORBIDDEN_ANTD_EXPORTS 零命中（本臂新增导入仅 Alert/Flex/Input 复用件）；未跑 `gates:all`（按派单约束）。

---

**文档结束**
