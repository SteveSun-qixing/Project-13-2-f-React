# 差距分析：App / Scene / Window / Document 应用结构

## 1. 对标目标

薯片框架也要包含 App、Scene、Window、Document 应用结构，让应用开发者可以声明应用由哪些窗口、文档、设置页、菜单入口和场景组成，而不是每个应用单独拼接 Electron 窗口和页面生命周期。

补充口径：这里的 Window 不是直接等同 Electron BrowserWindow。当前生态正式方向是 `surface` 优先，Desktop 下才映射为 `surface(kind=window)` / BrowserWindow；未来 Web/Mobile/Headless 会有不同 surface 形态。

## 2. 当前薯片已有基础

- 生态架构已经明确 Host 是唯一运行时承载。
- 插件类型已有 `app/card/layout/module/theme`。
- Host 架构设计中已有 window、plugin、config、theme、i18n、card、box 等服务域。
- 插件运行时、Bridge、Runtime Client、UI Hooks、Declarative UI、Unified Rendering 已在设计稿中分层。
- Electron/Host 层具备承载应用窗口、卡片窗口、插件会话的基础方向。
- 当前共享文档已明确 `surface.open(target=plugin)` 是应用插件启动主链路，`window` 是桌面兼容别名。

## 3. 当前主要差距

### 3.1 缺少开发者可用的 App 声明入口

当前没有类似 `ChipsApp` 的正式开发入口，应用结构主要依赖项目模板、manifest 和页面代码分散表达。

影响：

- 应用的主题、多语言、权限、命令、窗口、错误边界等初始化容易散落。
- 应用之间入口结构不一致。
- 脚手架难以强制最佳实践。

### 3.2 缺少 Scene 模型

当前设计中有插件运行时和窗口服务，但没有面向 UI 开发者的 `Scene` 抽象。

影响：

- 主窗口、设置窗口、工具窗口、文档窗口、资源预览窗口缺少统一声明。
- 场景生命周期、恢复、关闭保护、窗口状态持久化没有统一接入点。

### 3.3 缺少 Document 场景

薯片生态有 `.card`、`.box`、资源文件、主题包、插件包等文档型对象，但没有统一的 Document Scene。

影响：

- 打开、创建、保存、另存、最近文件、文档脏状态、窗口标题、权限、资源释放可能被各应用重复实现。
- 卡片、箱子、编辑器、查看器、资源管理器很难共享同一套文档行为。

### 3.4 Settings 和 Commands 尚未框架化

当前有设置面板、命令面板等方向，但缺少统一应用结构层的设置场景和命令声明。

影响：

- 设置页布局、配置绑定、i18n、权限、主题表现可能不一致。
- 菜单、快捷键、工具栏、命令面板可能各自维护命令定义。

## 4. 差距等级

严重等级：高。

原因：这是“像 SwiftUI 一样开发应用”的第一层入口。如果 App/Scene/Window/Document 不框架化，后续组件库再强，应用仍会在壳层和生命周期上分裂。

## 5. 后续判断

这一能力不应放在普通组件库内部，而应作为薯片前端框架或 App Framework 的一部分，并由 Host/Electron 真实运行时支撑。组件库只提供其中可复用 UI 部件。
