# W5 迁移：rich-text-editor 编辑臂（编辑器主体收口）开发日志

> 日期：2026-10-01
> 任务：富文本编辑器（`chips.official.rich-text-editor`）编辑臂——编辑器主体 + 卡库/卡箱浏览面 + 命令族 + 缺位登记（W5 派单行表 #7 编辑臂）
> 工作区：`chips-ecosystem/`（分支「第五次重构」；全程零 git 写操作；命令一律 `npx -y pnpm@9 <cmd>`）
> 独占目录：`chips-ecosystem/plugins/apps/rich-text-editor/`（另按 G9 RFC 增名程序同步三处共享登记面，见 §二.4）
> 旧仓（只读冻结）：`Chips-RichTextEditor/` 全程零写
> 前置底册：`W5迁移-rich-text-editor-开发日志-2026-10-01.md`（card-document 迁移臂，79 例基线）；`W5-richtext编辑臂-Milkdown-开发日志-2026-10-01.md`（编辑引擎选型 Milkdown 落地于 `plugins/basecards/richtext`）；`工单036残段与端到端解锁判定-2026-10-01.md`（C3 宿主 document 四能力真实现；IEditSession 平台实现零代码）
> 契约权威：12-编辑引擎设计（§6.1 回流唯一时序、§6.3 自动保存、§13 创建链路）、08-基础卡片插件接口（§4 IBaseCardEditor）、04-能力契约规范 §7.3（document:* 六能力）、01-卡片文件格式（§6.6 base.richtext）、08-官方应用功能总览 §十二、08-产品与交互 01.04（卡箱库）、13-命令系统契约、14-资源打开与默认处理器契约 §5.5

## 一、架构落点与依据

平台编辑链路（`IEditSession` 生产装载，工单036 波 C 终闸 T2/T3）尚为零代码，本臂按派单口径以「应用前端侧落点」收口：与 notes 判例（`plugins/apps/notes/src/domain/notes/editSession.ts`，B3 裁决同型）同构，会话在应用域内持有待提交变更与修订水位锁，写通道/投影通道/落盘入口全部经 `document:*` 正式能力（宿主真实现）。分层：

- `src/domain/editor/documentGateway.ts`：`document:open/read/write/save` 四能力真实现消费 + `document:create/export` 正式契约消费（宿主在途，工单072）；回执守卫（`{revision}` 正整数、`{source,digest}` 非空）与防御性复核码同 notes 判例口径；
- `src/domain/editor/editSession.ts`：`RichTextEditSession`——回流唯一时序（`getChange()` → 校验 → `document:write` → 投影重读 → `markCommitted`）、严格递增修订锁、diverged 臂（投影与写值发散时采纳宿主真相）、flush 保存链（回流未确认阻断 `document:save`，12 §6.3 规则 3/5）；校验臂错误码用生成契约常量 `EDIT_VALIDATION_FAILED`（12 §6.5/§9.2），不自造第二套码；
- `src/domain/editor/sessionView.ts`：宿主模型切片 → `BaseCardView` 只读快照装配（05-渲染引擎设计 §2.5 口径）；
- `src/ui/EditorMount.tsx`：消费 `@chips/plugin-richtext` 公开导出 `renderEditor` 的挂载点（容器生命周期；释放幂等，卸载即 `dispose()`，08 §4.3 规则 9）；
- `src/ui/useEditorWorkspace.ts`：工作区控制器（打开投递 → 库收录 → 装配 → 编辑器附着 → 提交链/保存链 → 500ms 防抖自动保存，12 §6.3 规则 1~2；保存失败停止自动重试等待用户处置）；
- `src/ui/LibraryPanel.tsx` / `EditorArea.tsx` / `AppView.tsx`：卡库/卡箱两标签浏览面（01.04 口径最小可用：卡片/箱子分计数、条目选中、01.04 §4.4 形制空态）、编辑区状态栏（修订号 · 已保存摘要/有未保存变更，12 §6.3 规则 6）、放弃确认（`App.useApp()` modal 许可通道）、新建/导出对话框。

**复用红线执行**：Milkdown 引擎装配逻辑零复制——装配唯一口径保持在 `plugins/basecards/richtext/src/milkdown/engine.ts`（插件内），应用只经包公开导出 `renderEditor` / `validateConfig` 消费；§2.14 两条风险随行规避（①无 alt/title 图片解析归一、② `$remark` options 先于插件本体注册——两者都在插件装配点内，应用侧零重复实现）。render.js 从臂前 10.14 kB 增至 766.33 kB（gzip 202.84 kB），增量即全家桶构建后进包体积（清单 §2.14 已登记的同源体积面，< 16 MiB 单文件上限，cpk 出包校验通过）。

## 二、交付清单

### 2.1 测试先测后码（基线 79 例零放宽，总 136 例全绿）

- `tests/document-gateway.test.ts`（20 例）：`document:open/read/write/save/create/export` 调用形状与回执守卫、错误归一（fake 桥形制）；
- `tests/edit-session.test.ts`（25 例）：校验闸逐分支（§6.6 互斥/能力矩阵/configSchema 同口径/patch 指针文法）、写值装配（replace 全量 + §6.1 `theme` 保留字段保真、patch 增量补建）、**回流唯一时序双 journal 逐位锁测**（chain journal：document:write/read/save；editor journal：getChange/markCommitted/update；次序交换即翻红）、revision-stale / write-failed / projection-failed / diverged 全臂、保存链 flush 语义、**card 往返恰等**（夹具 → `parseCompositeRichTextCard` → 会话写值 → YAML 往返重建 → 模型逐字段恰等，无字段漂移、无保留字段丢失）；
- `tests/editor-arm.test.tsx`（9 例，jsdom 真编辑器）：装载链三拍 journal（open → read metadata/structure/content → ProseMirror 挂载）、真实 Milkdown 事务驱动回流（insertText 与键入同一事务路径）、保存回执驱动保存态、写入/保存失败如实回码不假成功、箱子只读摘要、新建/导出入口正式契约调用与在途如实回码；
- `tests/commands.test.ts`（8 例）：骨架 5 例随命令族扩展（断言不放宽：可序列化、命名空间、一一对应、派发配对、载荷收窄），新增 manifest `cli.commands` 与命令族逐字对应锁（`?raw` 内联单一事实源）与权限面覆盖锁。

### 2.2 实现件（全部在独占目录）

域层三件（§一）+ UI 四件（`AppView` 重写替换骨架态、`LibraryPanel`、`EditorArea`、`EditorMount`）+ 命令族（`appCommands` 扩为五条：`open-card`/`save-document`/`export-document`/`new-card`/`refresh-view`，`useAppCommands` 升级 `setActions` 装配式——notes 判例形制）+ `tests/setup.ts`（jsdom 平台面补齐，零业务 mock）。

### 2.3 manifest 与权限

- permissions 增 `resources:read`（document:open/read）、`resources:write`（document:write/save/create）、`filesystem:write:${userHome}`（document:export 必需限定值形态，photo-viewer 判例同源）；
- `cli.commands` 扩为五条，与新命令族一一对应（测试锁定）；`export-document` / `new-card` 声明即正式面（宿主在途如实回码）。

### 2.4 G9 复用增名（RFC §五.1 程序：先登记、后同步）

app 复用兄弟插件公开面超出书/music 既有白名单，按《RFC-G9应用复用兄弟插件公开面裁定》§二.3 增名程序执行：

1. RFC 文件追加 §五.1「`@chips/plugin-richtext`」增名登记（复用面、消费形制、同步面、边界不变）；
2. `tools/gates/gates.config.json` `plugins-apps.allowedInternal` 增名（fail-closed 逐名，不开通配）；
3. `tsconfig.base.json` `paths` 增 `@chips/plugin-richtext` 精确条目（工单003-B 解析锚定，紧邻 book/music 判例位）；
4. `package.json` `dependencies` 增 `@chips/plugin-richtext: workspace:*`（运行时复用归位，RFC §二.2 口径）；`vite.render.config.ts` / `vitest.config.ts` 增复用锚点 alias（book-reader 判例同构）。

## 三、缺位登记（不代填、不临时绕过）

1. **工单072（新登记，`项目日志与笔记/工单072-富文本编辑器新建与导出宿主实现缺位/`）**：`document:create` / `document:export` 宿主能力处理器缺位——Bridge 契约与 SDK 类型面、权限映射齐备，宿主 descriptors 仅 open/read/write/save 四能力；本臂新建/导出入口按正式契约真调，能力未注册时如实透传 `BRIDGE_CAPABILITY_NOT_FOUND`；宿主收口后应用零改动回填。候第十三项提供方归属裁决。
2. **`resource:opened` 宿主路由（工单063 族既有在册）**：订阅面为本臂正式消费位（14 §5.5 载荷收窄、pluginId 匹配），宿主路由收口前以空态如实呈现，不假接线。
3. **file 来源正文读取通道**（工单057③ 族既有在册）：不挂正编辑面、仅 config patch 分流——插件编辑器内建缺位状态行如实呈现，本臂零改动承接。
4. **IEditSession 平台生产装载**（工单036 波 C 终闸 T2/T3）：本臂会话为应用前端侧落点（§一依据）；平台编辑链路收口后本应用按 12 §3.1 换装 `IEditEngine.open`，域层端口面（readNode/writeNode/save 三拍）即为换装缝。

## 四、验证记录（亲跑，2026-10-01）

包内四闸（`npx -y pnpm@9`，`plugins/apps/rich-text-editor`）：

| 闸 | 结果 |
|---|---|
| `test` | **9 文件 / 136 例全绿**（迁移臂基线 79 例零放宽零删改 + 新增 57：网关 20 + 会话/时序/往返 25 + 编辑臂集成 9 + 命令族扩 3） |
| `typecheck`（tsc --noEmit） | 0 错 |
| `lint`（eslint src tests） | 0 错 0 警 |
| `build`（vite main + render） | `dist/index.js` 0.22 kB + `render.js` 766.33 kB / gzip 202.84 kB（增量即 `@chips/plugin-richtext` 复用锚点内联的 Milkdown 全家桶体积，清单 §2.14 同源登记面） |

补充验证：

- **cpk 五阶段**：`chips plugin pack` 通过（成员 4、ZIP Store 752.5 KiB、`校验: 通过`）；
- **禁面机检**：A 面 antd/`@chips/antd` 直接导入零命中；B 面 28 禁名词界全扫命中三条经逐条溯源均为许可/载荷面（`message`＝Error 形参与对象属性、`modal`＝`App.useApp()` 许可通道、`version`＝`chip_standards_version` 载荷字段）——FORBIDDEN_ANTD_EXPORTS 真实触禁零命中；
- **TODO/占位扫描**：src/tests 全量 grep `TODO|FIXME|占位|待实现|临时` 仅命中域层头注「不临时绕过」否定句，零实际占位；
- **node: 内置导入**：src/tests 零命中（manifest 锁测用 vite `?raw` 内联，不走 node:fs）；
- **gates:boundaries（定向，非 gates:all）**：`@chips/plugin-richtext` 增名后本包零违规（BOUNDARY010/020 零命中）；唯一红面 BOUNDARY001＝`server/community/packages/server` 工作区包未在门禁配置登记——该目录在本臂开工前即为工作树未跟踪状态（git status 实证），非本臂引入，归属该包落位臂随 G9 程序登记，本臂不代改；
- **边界纪律**：未跑 gates:all；未改旧仓/文档库契约分件；未做任何 git 写操作；安装持目录锁 `/tmp/w4-lockguard`（stale 锁全进程扫描确认后按 W5 判例接管，装毕释放）。

## 五、文档随动

- 包 README：重写为编辑臂实态（功能面、复用锚点、在册缺位、目录结构）；
- 《09-官方插件与应用目录》§7.2 rte 行状态翻正：主体已落包（编辑臂收口），`document:create/export` 宿主在途与端到端口径注记，证据链指向本日志；
- 《RFC-G9应用复用兄弟插件公开面裁定》：§五.1 增名登记；
- 本日志即派单指定过程材料；未动 `重构台账.db`。

## 六、lockfile 注记

本臂 install（持锁）使 `pnpm-lock.yaml` 新增 importer 段：本包 `@chips/plugin-richtext`（workspace link）与 `jsdom` / `@testing-library/react`（对齐 notes 在册版本 28.1.0 / 16.3.3，零新增版本族）；同批把工作区内**开工前已存在**的未跟踪成员 `server/community/packages/server` 的 importer/快照段一并落入 lockfile——系 pnpm 全工作区安装的机械结果（该目录 git status 未跟踪在先），非本臂依赖面，随该包落位臂收口。

## 七、遗留与追记

1. 自动保存实现为「change 驱动脏状态 → 500ms 防抖 flush+save；失败停止自动重试等待用户处置」。12 §6.3 规则 4 的 2s×3 退避重试与窗口失焦/最小化 flush 时机，随宿主 `config:*` 域处理器（工单036 族 G6 二批）与应用窗口事件通道收口后按正式配置面补齐，本臂不私建配置旁路。
2. 命令族 `export-document` 的缺省导出目标暂以文档名合成（`/未命名卡片.card` 形态示例位）；对话框臂为界面入口主路径，落点规则候《工作区设计》§四 `document:export` 宿主面收口对齐（工单072 同窗）。
3. render.js 766 KB 形态仍为单文件内联（现行应用族统一形态）；uvf 臂登记的「分包与按需资源装载语义」（工单069）落波后随全应用族统一收口。
