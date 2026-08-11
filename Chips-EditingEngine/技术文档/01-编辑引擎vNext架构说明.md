# 编辑引擎 vNext 架构说明

## 1. 文档定位

本文档记录 `Chips-EditingEngine` 项目内部实现边界。对外公开的基础卡片、箱子、命令、资源打开、主题和多语言契约以 `生态共用技术文档/` 为准。

## 2. AppRuntime 与 Scene

当前入口链路为：

```text
src/main.tsx
-> src/App.tsx
-> src/app/AppRoot.tsx
  (antd ConfigProvider locale=zhCN theme=appleTheme + antd App
   + @chips/ui ChipsProvider + CommandProvider
   + AppRuntimeProvider + EditingEngineStateProviders)
-> src/app/AppShell.tsx（AppChrome：命令面板、快捷键、内容容器）
-> src/scenes/WorkspaceScene.tsx
```

实现规则：

- `src/App.tsx` 只作为轻量入口，不承载初始化和业务分发。
- `AppRoot.tsx` 统一编排 Provider 树：antd `ConfigProvider`（中文 locale + `appleTheme`）、antd `App`、`@chips/ui` 的 `ChipsProvider`（Host client）与 `CommandProvider`（命令注册/快捷键/面板）、`AppRuntimeProvider`（SDK client + launch context + 中文文案 `t`）、编辑引擎状态 Provider。
- `AppRuntimeProvider` 持有唯一 SDK client 与 Host launch context，`t` 只查本地中文文案表 `src/lib/messages.ts`。
- `launch-context.ts` 合并 `surfaceContext.launchParams` 与顶层 `launchParams`，并以 `surfaceContext.sceneId/surfaceId` 优先。
- `boot-actions.ts` 负责基础卡片注册表同步、工作区初始化和默认工具窗口创建。
- `WorkspaceScene` 承载当前编辑器工作区场景，包括 InfiniteCanvas、Workbench、Dock、设置弹窗、卡片/箱子窗口分发和拖拽落点；应用窗口顶部不再挂载独立 Header 工具栏（HeaderBar 已随组件库迁移移除）。

## 3. 命令系统

命令入口集中在 `src/commands/`：

- `editing-engine-commands.tsx` 定义稳定 command id（`chips-official.editing-engine.*`）、placement（`menuId`/`toolbarId`，顶层菜单栏已移除，仅 `toolbarId` 由内容区工具栏消费）、快捷键和运行态 enabled，命令文案为简体中文直写，图标使用 `@ant-design/icons`。
- `EditingEngineCommandProvider.tsx` 通过 `@chips/ui` 的 `useCommandRegistry().register(...)` 注册命令，并向子组件提供 `commands` 与 `registerHandler`。
- AppShell 的 `AppChrome` 只承载命令面板（Mod+P）与快捷键分发，不再渲染顶层菜单栏/工具栏；内容区工具栏由应用自身组件渲染（FileManager 通过 `Toolbar`（`toolbarId: 'file-manager'`）渲染本地文件命令，Dock 窗口内工具按钮各自绑定 UI 回调）。
- Dock 与 HistoryPanel 直接调用 UI 回调/内部命令管理器，不再消费旧 `invokeCommand` 适配器。
- `src/lib/messages.ts` 集中保存应用中文文案（key -> 中文 + `formatMessage` 插值），调用点统一使用 `formatMessage` 或直接中文直写。

约束：

- command 文案直接保存简体中文，不保存 i18n key。
- 图标使用 `IconDescriptor` 或 antd 图标组件。
- manifest 只声明 `command.read/write/invoke`，不声明 `command.manage`，且已移除 `theme.read` 与 `i18n.read`。
- 内部 `CommandManager` 只负责 undo/redo 历史，不是第二套 Host command registry。

## 4. 基础卡片装配与编辑会话

本项目内部采用“双运行时、单数据源”：

```text
显示链路：BasecardDescriptor -> BasecardFrameHost -> CompositeCardAssembler -> CardWindow
编辑链路：BasecardDescriptor.renderEditor -> EditorSessionStore -> EditorHost -> EditPanel
数据源：CardService 中的解包态 .card/ 数据
```

关键实现：

- `basecard-runtime/registry.ts` 加载内置 `base.richtext/base.image/base.webpage` 描述符，并通过 Host `plugin.query({ type: "card" })` 装载已安装启用卡片插件的 `basecardDefinition`。
- `BasecardFrameHost` 为每个基础卡片创建透明 iframe，注入固定苹果风格帧样式（`theme-css.ts` 输出固定色值，不再读取 Host 主题）与 `resolveResourceUrl/releaseResourceUrl/openResource`。
- `CompositeCardAssembler` 按 `CardService.structure.basicCards` 顺序装配单卡 iframe，并汇总高度、加载态、错误态和资源打开事件。
- `EditorSessionStore` 管理 source/draft/validation/dirty/resourceOperations，资源导入或删除被正式配置引用时允许按节流窗口提交。
- `EditorHost` 为编辑器提供资源解析、导入、ZIP 目录导入、删除登记和 TIFF 转 PNG。

`openResource(...)` 在编辑引擎中的路径：

```text
基础卡片 renderView
-> BasecardFrameHost.openResource
-> CompositeCardAssembler.onResourceOpen
-> CardWindow.client.resource.open({ intent: "view", resource })
-> Host resource.open
```

基础卡片 iframe 只表达资源打开意图，不直接启动阅读器、图片查看器、音乐播放器或系统浏览器。

## 5. 卡片保存与资源生命周期

`CardService` 是 `.card` 解包态的唯一真实数据源。

保存规则：

- `metadata.yaml`、`structure.yaml`、`.card/cover.html`、`content/*.yaml` 由 `CardService.persistCard(...)` 统一重建。
- 基础卡片资源路径统一为卡片根目录相对路径，不写入 `content/`。
- `structure.yaml manifest.resources` 通过扫描卡片根目录重建，排除 `.card/` 与 `content/`。
- 封面资源统一写入 `.card/cardcover/`，保存时解析 cover HTML 中的 `src/href/poster/data-chips-cover-image-source/url(...)` 引用并清理未引用旧资源。
- 删除基础卡片或资源编辑器删除资源时先登记删除意图，最终保存阶段依据真实引用关系物理删除。

## 6. 箱子文档链路

`BoxDocumentService` 是编辑引擎中的箱子编辑会话管理器：

- 创建箱子时读取布局描述符并调用 `client.box.normalizeLayoutConfig(...)`。
- 打开箱子时通过 `client.box.unpack(...)` 解包到会话工作目录。
- 保存箱子时重写 `.box/metadata.yaml`、`.box/content.yaml`、`.box/structure.yaml`、`.box/cover.html`，再调用 `client.box.pack(...)`。
- 条目新增、拖拽、移动、删除后统一重建 `layoutHints.sortKey`，保证 `.box/structure.yaml` 的排序键与编辑面板顺序一致。
- 布局编辑器 iframe 的重挂载条件限定为布局类型、条目身份序列和语言等结构性输入，配置回写不会反复销毁编辑器。

## 7. 视觉、文案、焦点和 A11y

- 主题系统已移除（task030-07 规范）：不再读取 Host 主题、不再使用 `--chips-sys-*` 变量；统一固定苹果风格（背景 `#f5f5f7`、表面 `#ffffff`、文本 `#1d1d1f`、主色 `#0a84ff`、边框 `rgba(0,0,0,0.08)`），antd 侧由 `ConfigProvider theme={appleTheme}` 提供 token。
- 多语言系统已移除（task030-06 规范）：界面文案统一简体中文直写，集中文案表为 `src/lib/messages.ts`，调用点统一走 `formatMessage(key, params)`；`useTranslation` 兼容签名已于 task031 收尾归档（`归档/task031-useTranslation/`），仓库内不再有 `t()` 运行时解析。
- 工作台、Dock、BaseWindow、ToolWindow、FileTree、MainArea、SidePanel 使用 `@chips/a11y` 的键盘与 roving tabindex 模型。
- UI 图标统一走 `RuntimeIcon`（`@ant-design/icons` 映射 `IconDescriptor.name`）。

## 8. 测试矩阵

正式脚本：

```bash
npm run lint
npm test
npm run build
npm run validate
```

重点测试文件：

- `tests/unit/app-runtime.test.ts`：launch 上下文合并与 boot 行为。
- `tests/unit/commands-definition.test.ts`：命令 id、placement、快捷键与运行态 enabled。
- `tests/unit/basecard-frame-host.test.tsx`：单卡 iframe、资源 URL、资源打开、指针屏蔽和预览稳定性。
- `tests/unit/editor-session-store.test.ts`、`tests/unit/plugin-host.test.tsx`：编辑会话与资源操作。
- `tests/unit/card-files.test.ts`：卡片保存、封面资源和导出资源清单。
- `tests/unit/box-document-service.test.ts`、`tests/unit/box-editor-panel.test.tsx`：箱子保存、排序键和布局编辑器稳定性。
- `tests/unit/workbench-a11y.test.tsx`、`tests/unit/file-tree.test.tsx`、`tests/unit/base-window.test.tsx`：工作台、文件树和窗口可访问性。
- `tests/unit/real-materials-regression.test.ts`：成品测试空间真实 `.card/.box` 素材结构回归。

## 9. 设置弹窗与封面编辑器（2026-08 优化）

### 9.1 弹窗尺寸约定（响应式、不随内容变化）

| 弹窗 | 尺寸规则 |
|---|---|
| 卡片设置（CardSettingsDialog） | 宽 90%（上限 1080px）/ 高 85dvh |
| 箱子设置（BoxSettingsDialog） | 宽 90%（上限 1080px）/ 高 85dvh |
| 引擎设置（EngineSettingsDialog） | 宽 88%（上限 920px）/ 高 80dvh |
| 封面制作器（CoverMaker） | 宽 90%（上限 1120px）/ 高 85dvh |
| 封面裁剪（CoverCropDialog） | 宽 78vw（上限 960px）/ 高 70vh |

- 全部采用 antd Modal（mask closable、destroyOnHidden、居中）；
- **尺寸跟随应用窗口响应式调整**（vw/dvh 视口单位），**不随标签页/内容变化**：宽度由 Modal `width="90%"` 决定，高度由 `.ant-modal-content { height: 85dvh }` 决定，内容区在固定尺寸内滚动（flex + `min-height: 0` + `overflow: hidden`）；`max-width` 仅作超大屏上限，`max-height: calc(100dvh - 48px)` 防止溢出屏幕。
- 卡片/箱子设置弹窗采用**顶部标签页**（antd Tabs）切换分类，弹窗尺寸固定不跳动；板块设计参考苹果系统设置的清爽分区（标签页栏、浅色内容底、圆角卡片区），不刻板照搬其左侧导航形态。

### 9.2 封面编辑器（CoverPanel）交互优化

- 布局：左预览（280px，白底、封面投影卡）+ 右编辑区；
- 编辑区为**两个子标签页**：
  - 「选择比例」：9 个苹果风格小卡片（比例图形 + 文字，Tooltip 提示，选中蓝框高亮）+ 方向 Segmented（竖版/横版，预览比例与封面内容随方向同步）；
  - 「编辑封面内容」：模式 Segmented（图片/HTML）+ 上传卡或 HTML 编辑；
- 上传：苹果风格虚线拖放卡（图标 + 主文案 + 提示），已选后显示文件名 + 「裁剪」「移除」操作（antd Button）；
- HTML 编辑：等宽字体、聚焦蓝环；
- 默认封面模板（`createDefaultCoverHtml`）：白底干净样式，横竖方向自适应排版；
- 裁剪弹窗舞台区改为 flex 填充固定尺寸容器。

### 9.3 封面制作器（CoverMaker）

- 自绘 overlay 改为 antd Modal，固定 920×660；
- 模式选择改为顶部 `Segmented`（图片/HTML/ZIP/模板，图标 + 文案）；
- 表单区与预览区固定双栏；上传卡、代码编辑、模板表单全部苹果化；保存按钮带 loading。

### 9.4 引擎设置（EngineSettingsDialog）

- 自绘 overlay 改为 antd Modal，固定 720×520；
- 分类切换改为顶部标签页（Tabs），内容区滚动；底部「重置」「完成」。

### 9.5 关键文件

- `src/components/CardSettings/CardSettingsDialog.tsx` + `CardSettingsDialog.css`
- `src/components/BoxWindow/BoxSettingsDialog.tsx`
- `src/components/CardSettings/panels/CoverPanel.tsx` + `CoverPanel.css`
- `src/components/CardSettings/panels/CoverCropDialog.css`
- `src/components/CoverMaker/CoverMaker.tsx` + `CoverMaker.css`
- `src/components/EngineSettings/EngineSettingsDialog.tsx` + `EngineSettingsDialog.css`
- 文案：`src/lib/messages.ts`（新增 `card_settings.cover_orientation_label`）

测试：`tests/unit/card-settings-dialog.test.tsx` 的 `clickTab` 按 `[role="tab"]` 查找（顶部标签页）。
