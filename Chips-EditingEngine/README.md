# 编辑引擎

> 插件 ID：`chips-official.editing-engine`  
> 插件类型：应用插件（`type: app`）  
> 工程角色：薯片生态正式卡片编辑引擎

## 1. 工程定位

编辑引擎是薯片生态当前的正式编辑工作台应用，负责：

- 打开与管理工作区；
- 装配基础卡片插件与布局插件；
- 提供工具窗口、卡片窗口、箱子窗口与工作台布局；
- 通过 Host / Bridge / `chips-sdk` 正式链路访问文件、配置、插件与模块能力；
- 在运行时统一消费 `RuntimeIcon`（`@ant-design/icons`）图标系统，而不是 emoji 或字符串图标。

当前工程不是脚手架示例，不允许再按模板工程理解其目录、脚本与运行边界。

## 2. 快速开始

```bash
cd <生态工作区>
npm install
cd Chips-EditingEngine
npm run dev
```

常用命令：

- `npm run dev`：启动开发服务器
- `npm run run`：通过 `chipsdev-r run` 在真实 Host 开发链路中运行
- `npm run build`：构建插件产物
- `npm test`：运行测试
- `npm run lint`：执行 ESLint
- `npm run validate`：执行插件契约校验

## 3. 应用框架结构

编辑引擎已经迁移到应用插件 vNext 基线：

- `src/App.tsx`：轻量入口，只导出 `AppRoot`
- `src/app/`：`AppRoot`（antd ConfigProvider/App + `@chips/ui` ChipsProvider/CommandProvider + AppRuntimeProvider）-> `AppShell`（AppChrome）
- `src/runtime/`：SDK client 单例、launch/surface context 与启动动作
- `src/scenes/`：工作区场景注册与 `WorkspaceScene`
- `src/commands/`：本地 `CommandItem` 命令定义（简体中文 + antd 图标）与命令 Provider
- `src/lib/messages.ts`：应用中文文案表（`formatMessage` 插值）

启动时会读取 Host `platform.getLaunchContext()`，合并 `surfaceContext.launchParams` 与顶层 `launchParams`，并交给 `AppRuntimeProvider` 的应用运行时上下文。

## 4. 正式运行边界

- 系统能力访问统一经 `chips-sdk` 与 `window.chips.*`，不直连 Host 内部实现。
- 基础卡片装配与编辑运行时统一经 `src/basecard-runtime/`。
- 箱子查看、布局渲染与布局编辑统一经 `Host box-service -> chips-sdk -> 编辑引擎壳层` 正式链路完成。
- 工作区、文件、资源与设置统一经 `src/services/`、`src/context/` 与 Host 事件链路。
- 基础卡片查看态 `openResource(...)` 由复合卡片窗口统一转成 `client.resource.open(...)`，基础卡片 iframe 不直接启动其他应用。
- 菜单、工具栏、命令面板、快捷键和文件右键菜单共享同一组 `CommandItem` 命令定义，不各自绑定业务函数。
- 应用壳层 `index.html` 的 CSP 必须允许网页基础卡片正式使用的远程 `http/https` iframe；若目标站点自身拒绝 iframe 嵌入，再由网页基础卡片按正式错误态处理。

## 5. 目录概览

```text
Chips-EditingEngine/
├─ manifest.yaml
├─ package.json
├─ chips.config.mjs
├─ assets/
│  └─ icons/
├─ src/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ app/                # AppRoot / AppShell（antd + @chips/ui 编排）
│  ├─ basecard-runtime/   # 基础卡片描述符、注册表与装配运行时
│  ├─ commands/           # 本地命令定义（CommandItem）与命令 Provider
│  ├─ components/         # 工具窗口、卡片窗口、文件管理器、设置面板等 UI
│  ├─ context/            # 编辑器、卡片、UI 等全局上下文
│  ├─ core/               # 核心初始化与业务底层逻辑
│  ├─ editor-runtime/     # 编辑宿主运行时
│  ├─ hooks/              # 运行时 hooks
│  ├─ icons/              # 运行时图标描述符与统一图标包装
│  ├─ layouts/            # InfiniteCanvas / Workbench 等布局
│  ├─ lib/                # 应用中文文案表（messages.ts）
│  ├─ runtime/            # SDK client / launch / boot
│  ├─ scenes/             # WorkspaceScene 与 scene registry
│  ├─ services/           # Bridge / SDK / 文件 / 工作区 / 箱子 等服务封装
│  ├─ types/
│  └─ utils/
└─ tests/
```

## 6. 基础卡片与箱子链路

基础卡片链路：

- 注册表统一加载内置描述符与 Host 已安装启用的卡片插件 `basecardDefinition`
- `BasecardFrameHost` 为每个基础卡片创建透明单卡 iframe，并注入固定苹果风格帧样式、资源解析、资源释放和资源打开回调
- `EditorHost + EditorSessionStore` 承载编辑面板、草稿、校验、资源导入、ZIP 目录导入、TIFF 转 PNG、删除意图和提交节流
- `CardService` 是解包态 `.card/` 的唯一真实数据源，保存时重建 `metadata.yaml / structure.yaml / content/*.yaml / manifest.resources`

箱子链路：

- `.box` 打开、解包、布局描述符读取、配置归一、布局预览、编辑面板和重新打包都走 SDK `client.box.*`
- 条目列表移动、拖入、删除后会重建 `layoutHints.sortKey`，保证保存再打开后的显示顺序与编辑面板顺序一致
- 箱子布局编辑器 iframe 的重挂载条件只来自布局类型、条目身份序列和语言等结构性输入

## 7. 图标系统

编辑引擎当前图标链路已经收口为正式实现：

- 运行时 UI 图标入口：`src/icons/descriptors.ts`
- 统一运行时组件：`src/icons/RuntimeIcon.tsx`
- 应用品牌图标组件：`src/icons/AppBrandIcon.tsx`
- 基础卡片、布局、工具窗口与菜单图标均使用 `IconDescriptor`

正式规则：

- 运行时 UI 图标统一走 `RuntimeIcon`（`@ant-design/icons` 按 `IconDescriptor.name` 映射）
- 不再保留 emoji、字符图标或 `icon: string`
- `manifest.yaml -> ui.launcher.icon` 只表示系统入口图标文件路径

## 8. 启动图标资产

- `manifest.yaml` 当前声明：`ui.launcher.icon: assets/icons/app-icon.ico`
- `assets/icons/app-icon.ico`、`assets/icons/app-icon.icns`、`assets/icons/app-icon.png` 已与 `design-assets/Appicon/EditingEngine.*` 对齐
- 资产来源说明见 `assets/icons/SOURCE.md`

这些文件属于操作系统入口图标，不属于运行时 `RuntimeIcon` 图标模型。

## 9. 视觉、文案与可访问性

- 主题系统已移除：统一固定苹果风格（antd `ConfigProvider theme={appleTheme}` + 固定色值），不再读取 Host 主题与 `--chips-sys-*` 变量
- 多语言系统已移除：界面文案统一简体中文，集中文案表为 `src/lib/messages.ts`
- 工作台、Dock、工具窗口、文件树和主编辑区接入 `@chips/a11y` 公共键盘模型、roving tabindex、ARIA 关系和焦点恢复

## 10. 验证矩阵

任务030闭环时的正式验证基线：

```bash
cd Chips-EditingEngine
npm run lint
npm test
npm run build
npm run validate
```

真实素材回归覆盖 `ProductFinishedProductTestingSpace` 中的：

- `富文本基础卡片.card`
- `美食卡片成品/美食卡片-01-点心百宝盒.card`
- `美食网格箱子.box`

当前真实素材测试会校验 `.card/.box` ZIP Store 包核心入口、元数据、结构、内容 YAML、资源引用和箱子排序键。

## 11. 相关说明

- 若公共图标契约、基础卡片装配标准或设置治理口径发生变化，应先更新 `生态共用技术文档/`
- 若项目文档与 `manifest.yaml`、真实代码冲突，以真实代码与正式共享文档为准
