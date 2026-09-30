# W4 迁移·documentLibrary 布局插件：开发计划与日志（2026-09-30）

- 执行人：W4 插件迁移工程师（documentLibrary 原子任务，布局族最后一单）
- 旧族（只读冻结）：`Chips-BoxLayoutPlugin/documentLibrary-BLP/`（id `chips.layout.documentlibrary.blp`）
- 交付目标：`chips-ecosystem/plugins/layouts/document-library/`，id **`chips.layout.documentlibrary`**（在册名，09-官方插件与应用目录 §5.2 布局清单行「文档库布局」），角色 `boxlayout`
- 分支：第五次重构（只读作业，无 git 写操作）

## 一、第三方红线裁决（含 W4 计划 §八.1「触 Tree 证伪」复核）

逐项核对旧仓 `documentLibrary-BLP/package.json` 运行时依赖：`@ant-design/icons`、`@chips/ui`、`antd`、`react`、`react-dom`。对旧源码全文检索 `Tree` / `TreeSelect`：`src/view/page.tsx` 的目录树是**自研结构**（`role="tree"`/`role="treeitem"` 语义 + 原生 button 行 + 缩进内联样式），`src/editor/panel.tsx` 的目录树编辑器同样是自研平铺行（Input/Segmented/Checkbox/Button 组合），**均未触 antd `Tree`/`TreeSelect`**——W4 计划 §八.1 翻正成立，属可派位。

旧实现触到的其余禁面件仅一处：`src/editor/panel.tsx` 直用 `ConfigProvider`（+自建 appleTheme）自挂主题根——新契约由布局帧注入主题根、`@chips/ui` 经 `theme.useToken()` 取 token，自然消除，无需兼容层。

**裁决结论：无第三方树/图形引擎依赖、无新第三方运行时依赖 → 按派单书全量迁移；目录树用自研轻量结构呈现（与旧实现同构），antd 面全部改经 `@chips/ui` 转发面。**

## 二、矩阵行逐文件裁决（旧功能覆盖矩阵-三插件仓库-2026-09-20，L57–L63）

| 矩阵行 | 裁决 |
|---|---|
| L57 渲染主体（page.tsx，分页 PAGE_LIMIT 240、封面 prefetch、骨架/空态、styles token 化） | 迁移。分页游标（`listEntries`/`load more`/`PAGE_LIMIT`）系旧运行时面貌，新契约 `BoxRenderView.entries` 为全量快照、帧运行时无分页 API，不得虚构分页（如实登记为契约降位，非功能舍弃）；封面 prefetch（`prefetchEntries`）在新帧运行时无对应动作面，目录树选中即按需 `requestEntries`/`mountEntry`（选中 ≤1 帧，天然满足 §6.3 虚拟化口径），一并登记契约降位；骨架/空态用 `@chips/ui` LayoutSkeleton/EmptyHint/Skeleton 族；旧 `<style>` 硬编码色值（#1d1d1f/#6e6e73/#f2f2f7/#0a84ff 等）全部改为 `theme.useToken()` token 化内联样式 |
| L58 编辑面板（panel.tsx、frame-region-editor.tsx；importBoxAsset/deleteBoxAsset 调用面随契约适配） | 迁移并随契约适配。新契约（09 §3.4/§7.3、05.06 §6.3）：编辑器只产出配置变更，不写文件、不导入/删除资源——旧 FrameRegionEditor 的文件上传/删除/资源预览桥面改为「安全路径输入 + validateConfig 校验」形态（与母型 grid 的 FrameRegionFields 同口径）；目录树编辑器（添加目录/标题覆盖/展示方式/默认折叠/上移下移/缩进取消缩进/移除/未归档条目加入）全量随迁，经 `@chips/ui`（Form/Select/Segmented/Switch/Input/Button/Checkbox），FORBIDDEN_ANTD_EXPORTS 零命中 |
| L59 配置模型与 JSON Schema（documentLibrary treeNodes 为功能核心） | 迁移。`layout-config.ts` 的 SortMode/treeNodes（MAX_TREE_DEPTH 8、MAX_TREE_NODES 500、id 去重兜底、titleOverride 截断）/sidebarWidth/showSummary/background/topRegion 全量迁移为 `src/config.ts`；schemaVersion/props/assetRefs 外壳按新契约降位：`layout_config` 即 props（09 §5.2），`asset_refs` 派生导出 `deriveAssetRefs`（同 grid/map 口径）；JSON Schema 2020-12 落 `assets/schemas/document-library-config.schema.json` |
| L60–L63（文案表/manifest/单测/归档） | 文案 R5 简体中文直写内聚 config.ts；manifest 按新 boxlayout 形态（capabilities.layouts + configSchema + schemaVersions、targets [host]、resources:read、去 `.blp`）；单测先测后码随包重建；旧 i18n/raster 图标/旧工具链归档废弃（不动旧仓） |

## 三、契约映射（旧 → 新）

| 旧 | 新 |
|---|---|
| `layoutDefinition.renderView(ctx)` + `mountLayoutView`（自建 ConfigProvider+appleTheme） | `renderLayout(box: BoxRenderView, container): Dispose`；token 经 `theme.useToken()`（帧注入主题根），无 ConfigProvider（禁面） |
| `renderEntryDocument`（内联卡片文档 postMessage 高度协商）+ `renderEntryCover`（封面帧） | 统一为 `IBoxLayoutFrameRuntime.requestEntries` + `mountEntry`（票证按 `view.kind` 渲染条目卡片视图/正式封面，09 §6.2）；内容态槽位无卡片式边框与内边距，封面态按 `layout_hints.aspectRatio`（兜底 3:4）壳层呈现 |
| `runtime.openEntry(entryId)` | `openDocument(entry.url)`（唯一打开方式，09 §6.5） |
| `runtime.readBoxAsset` 解析背景/顶部区域图片 | 资源相对路径交帧内 `<base href>` 解析（09 §6.4），`EmbeddedDocumentFrame src` 直用（同 grid/map 口径） |
| `runtime.listEntries` 游标分页 + `prefetchEntries` | 契约降位（全量快照无分页；无 prefetch 动作面），不虚构 |
| `onChange(config)` 直通编辑链路 | `ILayoutEditor` 句柄：`replace` 变更 + `schemaVersion` '1.0.0' + change/dirty 订阅 + `markCommitted`/`update`/`focus`/`dispose`（同 grid/map Editor 模式） |
| `validateLayoutConfigInput`（errors 明细） | `validateConfig(config: unknown): boolean`（09 §3.5 纯函数签名）；明细约束保留在归一路径与编辑面板 rules |
| 自带 messages.ts 键值表 | R5 简体中文直写，不设多语言运行时，文案常量内聚 config.ts |
| manifest `chipsdev-r` 工具链、`chips.layout.documentlibrary.blp` | vite 双入口（main→dist/index.js、render→render.js）+ `@chips/cli` 打包，rejectForbiddenImports 红线守卫，与 grid/map 完全同构；id 归一为在册名 `chips.layout.documentlibrary` |

配置键名随母型惯例 snake_case 化（`sort_mode`/`tree_nodes`/`sidebar_width`/`show_summary`/`background`/`top_region`；树节点内 `entryId`/`titleOverride`/`presentation`/`collapsed`/`children` 与 grid `assetPath` 同为嵌套对象字段 camelCase 先例）。未发布第一版、无兼容层。

## 四、实施顺序（测试先测后码）

1. 脚手架：manifest/package.json/tsconfig/vite×3/vitest/setup/schema/icon（对 grid/map 逐文件同构）。
2. 先写测试：`tests/config.test.ts`（目录树模型真实断言：层级映射/标题覆盖/缺失条目/未归档追加/递归排序 zh-CN + id 兜底/折叠扁平化/深度 8 与节点 500 上限/id 去重、归一与校验、deriveAssetRefs）与 `tests/render.test.ts`（渲染臂：目录树层级与缩进、展开收起、排序、选中预览挂帧、封面态打开、缺失节点提示、侧栏显隐会话态、顶部/背景区域、编辑器变更回流与清脏）。
3. 实现 `src/config.ts`、`src/main.ts`、`src/render.tsx`、`src/index.ts`、README。
4. 目录锁安装 + 四闸亲跑（test/typecheck/lint/build）。

## 五、执行日志

- 2026-09-30：完成旧族源码通读（page.tsx 1256 行、panel.tsx 768 行、layout-config.ts 345 行、schema/messages/runtime）、矩阵行裁决、母型（grid/map）与 09/视觉细则 §4.7/工单054 禁面契约对读；裁决与映射如上。开始脚手架。
- 2026-09-30：脚手架、测试（先测后码，25 例配置/树模型 + 21 例渲染/编辑器 jsdom，共 46 例）、实现完成；安装经 /tmp/w4-lockguard 目录锁互斥执行 `npx -y pnpm@9 install`（lockfile 无本包新增，依赖集与 grid/map 同构）。四闸亲跑结果：
  - `pnpm test`：2 文件 46 用例全绿（分组/排序/层级真实断言：配置节点映射与标题覆盖、缺失条目标记、未归档条目根层追加、箱子条目固定封面、zh-CN 递归排序与标识稳定兜底、深度 8/节点 500 上限、标识全局去重、折叠扁平化与会话覆盖、缩进/取消缩进/移动/移除纯操作；渲染臂：目录树层级缩进与 aria 语义、折叠展开、键盘导航、侧栏会话态显隐、内容态挂帧（requestEntries/mountEntry 票证入槽）、封面态壳层与 openDocument 打开、缺失节点保留提示、区域帧、编辑器 replace 回流与清脏）。
  - `pnpm run typecheck`：绿（tsc --noEmit）。
  - `pnpm run lint`：绿（eslint src tests，0 error 0 warning）。
  - `pnpm run build`：绿（dist/index.js 2.38 kB 自包含 ESM + render.js 41.7 kB 外部化平台 vendor）。
- 测试先测后码抓获并修复的实现缺陷一处：`flattenVisibleTree` 未把会话折叠覆盖写回扁平节点副本（aria-expanded 与可见性一度脱钩），已修复并回归。
- 目录显隐口径落实（视觉细则 §4.7）：切换仅改本次浏览呈现，不产出配置变更（测试断言不 dirty）。
- 合规自检：FORBIDDEN_ANTD_EXPORTS 零命中（无 ConfigProvider/Tree/TreeSelect/InputNumber/Popconfirm 等 28 项）；无 TODO/占位/兼容层；src 无 `node:` 导入；无 antd 直连；文案简体中文直写；样式全部 `theme.useToken()` token 化；目录树为自研轻量结构（`role="tree"`/`treeitem` + 键盘无障碍），不触 antd Tree。
- 契约降位登记（非功能舍弃）：① 游标分页/加载更多——新契约 `BoxRenderView.entries` 为全量快照；② 封面 prefetch——新帧运行时无 prefetch 动作面，选中即按需挂载天然虚拟化；③ 旧 validateLayoutConfig 的 errors 明细面——按 09 §3.5 收敛为 `validateConfig(config: unknown): boolean`，明细约束保留在归一路径与编辑面板 rules。
- 交付物：`chips-ecosystem/plugins/layouts/document-library/`（manifest id `chips.layout.documentlibrary`、configSchema `assets/schemas/document-library-config.schema.json`、schemaVersions `>=1.0.0 <2.0.0`、permissions `resources:read`、icon `assets/icons/document-library.svg`）。
- 布局族状态：grid / map / timeline / document-library 四包齐，本包为布局族本波最后一单。
- 说明：pnpm-lock.yaml、packages/cli、grid/vitest.config.ts 等未提交改动来自同树并行 W4 波次，本任务未触碰；本任务仅新增 `plugins/layouts/document-library/` 与本日志。
