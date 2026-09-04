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
- `BasecardFrameHost` 为每个基础卡片创建透明 iframe，注入固定苹果风格帧样式（`theme-css.ts` 输出固定色值，不再读取 Host 主题）与 `resolveResourceUrl/releaseResourceUrl/openResource`；编辑引擎通过 `client.card.resolveResourceUrl(cardRootDir, resourcePath)` 注入持久化资源解析器，Electron 预览必须消费 Host 返回的 `chips-render://card-root/...`，不得创建本地 `file://` 基址。
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

## 4.1 服务面（task034 能力上移后）

文档领域能力已上移 Host（生态共用技术文档/协议与接口标准/06-Chips-Host对外接口基线.md §6.9）：

- 卡片：`card.init` + `card.session.*`（读/改/持久化/资源生命周期/自动保存/undo-redo 历史），本仓 `core/card-service.ts` 为纯会话消费层，`core/command-manager.ts` 为会话历史适配层；
- 箱子：`box.create/rename` + `box.session.*`，本仓 `services/box-document-service.ts` 为纯会话消费层；
- ZIP 目录导入：`resource.importArchive`（本仓 archive-import 本地实现已归档）；
- 封面能力：`chips.module.cover` 共享模块（本仓 `services/cover-service.ts` 模块优先 + fallback，UI 保留）；
- 工作区：`workspace.getContext` + `workspace.scan`（本仓 workspace-service 扫描卡片、箱子及所有普通文件；普通文件保留 MIME、扩展名、分类、文档类型和大小元数据）；
- Office 原格式文件：编辑引擎只消费工作区文件视图并转交对应应用插件；DOCX/PPTX/XLSX/PDF 的字节会话由 Host `office.document.*` 与 SDK `client.office` 托管，不在本仓复制文件路径或实现第二套保存链路；
- 文件类型识别：`file.detectType`（拖放识别扩展名兜底走 SDK guessMimeType）。

自动保存与 undo/redo 由 Host 会话管理，本仓只订阅事件（card.session.persisted/persist-error 等）与代理历史视图。

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
- 编辑面板「内容列表」的条目排序使用 `DragDrop/usePointerSortableList.ts` 实现指针拖拽：拖动手柄为条目行本身（按钮区除外，保留「调整」按钮作为显式手柄），拖动时显示插入指示线与浮层，松手后按可见条目中点计算插入位并调用 `moveEntryToIndex`。
- `usePointerSortableList` 的全局 `pointermove/pointerup/pointercancel` 监听器在 `startDrag` 时挂载、拖拽会话结束时卸载；内部处理器只读取 ref 快照（`dragSessionRef/itemsRef/onSortRef`），保证处理器与监听器在渲染间身份稳定，避免拖动过程中因组件重渲染卸载监听器导致拖拽冻结。
- 布局编辑器 iframe 的重挂载条件限定为布局类型、条目身份序列和语言等结构性输入，配置回写不会反复销毁编辑器。
- 无限画布中的卡片封面与箱子封面采用相同的事件职责：正式封面 iframe 只负责展示并禁用指针命中，点击展开、选中和拖动统一由外层封面壳处理；箱子封面通过 `data-chips-embedded-frame='box-cover-frame'` 精确约束对应 iframe，不依赖组件已经移除的旧 `data-part` DOM 标记。

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
- `tests/unit/box-document-service.test.ts`、`tests/unit/box-editor-panel.test.tsx`：箱子保存、排序键、条目拖拽排序回归（事件间真实时序 flush，覆盖手柄与整行拖拽、删除按钮不受干扰）和布局编辑器稳定性。
- `tests/unit/box-window.test.tsx`：箱子窗口设置入口，以及封面 iframe 不拦截外层点击与拖动的样式契约。
- `tests/unit/workbench-a11y.test.tsx`、`tests/unit/file-tree.test.tsx`、`tests/unit/base-window.test.tsx`：工作台、文件树和窗口可访问性。
- `tests/unit/real-materials-regression.test.ts`：成品测试空间真实 `.card/.box` 素材结构回归。

## 9. 设置弹窗与封面编辑器（2026-08 优化）

### 9.1 弹窗尺寸约定（响应式、不随内容变化）

| 弹窗 | 尺寸规则 |
|---|---|
| 卡片设置（CardSettingsDialog） | 目标宽 960px（视口不足时保留 16px/12px 单侧边距）/ 目标高 720px（视口不足时保留 24px/12px 单侧边距） |
| 箱子设置（BoxSettingsDialog） | 与卡片设置共用同一尺寸规则 |
| 引擎设置（EngineSettingsDialog） | 宽 88%（上限 920px）/ 高 80dvh |
| 封面制作器（CoverMaker） | 宽 90%（上限 1120px）/ 高 85dvh |
| 封面裁剪（CoverCropDialog） | 宽 78vw（上限 960px）/ 高 70vh |

- 全部采用 antd Modal（mask closable、destroyOnHidden、居中）；
- **尺寸只跟随应用窗口调整，不跟随标签页或内容调整**：卡片/箱子 Modal 使用固定 `width={960}`，弹窗本体以 `max-width: calc(100vw - 32px)` 在较小应用窗口中收缩；内容高度使用 `min(720px, calc(100dvh - 48px))`，窄窗口收口为 `calc(100dvh - 24px)`。Ant Design 6 的 Modal/Tabs 必须通过语义 `classNames` 把固定高度和伸缩规则绑定到 `container/body/header/footer` 与 Tabs `header/body/content`，不得继续依赖旧版 `.ant-modal-content`、`.ant-tabs-content-holder` DOM。头部、标签栏、内容区和底部按钮形成完整的 `flex + min-height: 0 + overflow` 链路，只有当前内容面板内部滚动。
- 卡片/箱子设置弹窗采用**顶部标签页**（antd Tabs）切换分类。外层标签页样式只作用于第一层 `document-settings-dialog__tabs`，不得影响封面编辑器内部标签页；基础信息与导出内容使用限宽居中容器，避免大窗口下表单被横向拉长。

### 9.1.1 导出标签页（卡片 / 箱子）

- 卡片设置与箱子设置均提供「导出」标签页，共用同一套导出面板视觉（`export-panel__*`）与路径工具（`export-utils.ts`）。
- **卡片导出**（`ExportPanel`）：`.card` 打包格式始终可用；HTML / PDF / 图片格式通过 `module.listProviders` 动态检查 Host 中已安装并启用的转换模块能力（`converter.file.convert` + `converter.card.to-html` + `converter.html.to-pdf` / `converter.html.to-image`），只有能力齐备的格式才会显示按钮；能力检查完成前只展示 `.card` 格式。
- **箱子导出**（`BoxExportPanel`）：当前正式链路为 `.box` 打包导出（`saveBox` 落盘后 `box.pack`），不提供 HTML / PDF / 图片转换（转换流水线 `FileSourceType` 只支持 `card` / `html` 源，箱子不注册转换能力，因此相关按钮不会出现）。
- 导出流程统一为：保存对话框 → `onBeforeExport`（封面草稿回写）→ 文档状态保存 → 打包 → `file.stat` 校验产物存在性 → 成功/失败进度反馈；取消保存对话框时不产生任何副作用。
- 转换模块未安装、被禁用或能力检查失败时，对应格式按钮一律隐藏而非置灰，避免出现不可用按钮。

### 9.2 封面编辑器（CoverPanel）交互优化

- 布局：常规宽度使用左预览（260~300px，白底、封面投影卡）+ 右编辑区；窄窗口切换为上下布局；
- 预览框通过 `ResizeObserver + resolveCoverPreviewFrameSize` 同时约束可用宽高，横版、竖版与手机长比例始终等比缩放，不允许通过单边 `max-height` 生硬压缩；
- 编辑区为**两个子标签页**：
  - 「选择比例」：9 个苹果风格小卡片（比例图形 + 文字，Tooltip 提示，选中蓝框高亮）+ 方向 Segmented（竖版/横版，预览比例与封面内容随方向同步）；
  - 「编辑封面内容」：模式 Segmented（图片/HTML）+ 上传卡或 HTML 编辑；
- 上传：苹果风格虚线拖放卡（图标 + 主文案 + 提示），已选后显示文件名 + 「裁剪」「移除」操作（antd Button）；
- HTML 编辑：等宽字体、聚焦蓝环；
- 比例页与内容页共用一致的限宽滚动容器；方向、资源操作、基础信息元数据和导出格式在窄窗口下自动改为纵向布局；
- 默认封面模板（`createDefaultCoverHtml`）：白底干净样式，横竖方向自适应排版；
- 裁剪弹窗舞台区改为 flex 填充固定尺寸容器。

### 9.3 封面制作器（CoverMaker）

- 自绘 overlay 改为 antd Modal，固定 920×660；
- 模式选择改为顶部 `Segmented`（图片/HTML/ZIP，图标 + 文案）；
- 表单区与预览区固定双栏；上传卡、代码编辑全部苹果化；保存按钮带 loading；
- 已移除「模板」模式与 8 套封面模板（`templates/index.ts`、`TemplateGrid`、`TemplatePreview` 于 2026-08 归档），预览统一由 `CoverHtmlPreview`（自定义 HTML iframe 预览）承担。

### 9.4 引擎设置（EngineSettingsDialog）

- 自绘 overlay 改为 antd Modal，固定 720×520；
- 分类切换改为顶部标签页（Tabs），内容区滚动；底部「重置」「完成」。

### 9.5 关键文件

- `src/components/CardSettings/CardSettingsDialog.tsx` + `CardSettingsDialog.css`
- `src/components/BoxWindow/BoxSettingsDialog.tsx`
- `src/components/CardSettings/panels/CoverPanel.tsx` + `CoverPanel.css`
- `src/components/CardSettings/panels/CoverCropDialog.css`
- `src/components/CardSettings/panels/ExportPanel.tsx` + `ExportPanel.css`
- `src/components/CardSettings/panels/export-utils.ts`（卡片/箱子导出共用的路径与文件名工具）
- `src/components/BoxWindow/BoxExportPanel.tsx`
- `src/components/CoverMaker/CoverMaker.tsx` + `CoverMaker.css`
- `src/components/CoverMaker/CoverHtmlPreview.tsx` + `CoverHtmlPreview.css`（封面 HTML 预览 iframe）
- `src/components/EngineSettings/EngineSettingsDialog.tsx` + `EngineSettingsDialog.css`
- 文案：`src/lib/messages.ts`（新增 `card_settings.cover_orientation_label` 与 `box_settings.export_*` 导出文案）

测试：

- `tests/unit/card-settings-dialog.test.tsx`：顶部标签切换、960px 固定目标宽度、Ant Design 6 语义容器绑定与固定响应式高度 CSS 链路；
- `tests/unit/box-settings-dialog.test.tsx`：箱子复用同一弹窗壳层，并覆盖基础信息、封面与导出标签切换；
- `tests/unit/export-panel.test.tsx`：卡片四种格式导出链路、取消/失败分支，以及转换模块未安装时隐藏对应格式按钮；
- `tests/unit/box-export-panel.test.tsx`：箱子 `.box` 打包导出链路与取消/失败分支；
- `tests/unit/cover-panel.test.tsx`、`cover-panel-layout.test.ts`：封面预览的等比尺寸计算与实际样式回归。
