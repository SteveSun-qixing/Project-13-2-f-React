# 卡片查看器 · Chips Card Viewer

> 仓库：`Chips-CardViewer`
> 插件类型：应用插件（`type: app`）
> 角色：`.card/.box` 正式查看入口与 Host 统一文档显示链路的应用套壳

## 1. 功能概述

卡片查看器用于：

- 接收卡片文件（`.card`）和箱子文件（`.box`）路径；
- 通过 SDK 调用 Host 统一文档显示链路；
- 在应用 surface 中承载 Host 返回的卡片复合 iframe 或箱子布局 iframe；
- 通过正式资源打开路由转发卡片或箱子内容中的资源打开意图；
- 跟随当前工作区主题和语言同步应用壳层、内容 iframe 与可访问性文案。

应用本身不负责 `.card/.box` 内部解析、基础卡片分发、模板编译、箱子布局插件装载或 iframe 拼接，这些逻辑全部由 Host 与 SDK 正式运行时完成。

## 2. 运行方式

```bash
cd <生态工作区>/Chips-CardViewer
npm install
npm run dev
```

真实 Host 窗口联调使用：

```bash
cd <生态工作区>/Chips-CardViewer
chipsdev-r run
```

开发态主题、插件和 Host 状态检查优先使用 `chipsdev-r`，不要手工改写 `.chips-host-dev`：

```bash
chipsdev-r plugin list
chipsdev-r theme current
chipsdev-r theme resolve
chipsdev-r doctor
```

## 3. 应用结构

当前工程采用应用插件 vNext 基线：

- `src/App.tsx` 只导出根组件；
- `src/app/AppRoot.tsx` 组合 `ConfigProvider`（antd 苹果风格 + zh-CN）、`ChipsProvider`、`AppRuntimeProvider` 与 `CommandProvider`；
- `src/app/AppRuntimeProvider.tsx` 汇总 launch context、surface、scene、打开目标和错误状态；
- `src/app/AppShell.tsx` 负责场景渲染与空态外壳（`AppChrome`），本地查看态提供浮层操作栏；
- `src/app/scene-registry.ts` 定义 `empty`、`document-file`、`hosted-document` 三类场景；
- `src/commands/` 维护本地命令（`CommandItem`）与可序列化 Host command metadata；
- `src/components/CardWindow.tsx` 负责 `.card/.box` 文件显示容器；
- `src/components/HostedDocumentWindow.tsx` 负责 Host 已提供 `webDocumentUrl` 时的托管文档承载；
- `src/lib/messages.ts` 是简体中文文案表，界面文案统一中文直写。

## 4. 显示链路

`.card/.box` 文件显示统一使用：

```ts
client.document.window.render({
  filePath,
  locale,
  mode: "view",
});
```

SDK 会根据文件类型分发：

- `.card` -> `client.card.compositeWindow.render(...)`
- `.box` -> `client.box.documentWindow.render(...)`

CardViewer 只消费返回的 `FrameRenderResult.frame` 并注册 SDK 事件：

- `client.document.window.onReady(...)`：内容 ready 后关闭加载态；
- `client.document.window.onError(...)`：处理整张文档 fatal 错误；
- `client.document.window.onNodeError(...)`：记录卡片节点非致命降级诊断；
- `client.document.window.onResourceOpen(...)`：转发到 `client.resource.open(...)`。

组件卸载、主题刷新或目标切换时，应用调用 SDK 返回的 `dispose()` 释放 render session 与 iframe 事件订阅。

## 5. 启动与文件入口

`manifest.yaml` 已声明：

- `capabilities: file-handler:.card`
- `capabilities: file-handler:.box`
- `ui.surface.defaultKind: window`
- `ui.launcher.displayName/icon`
- `command.read / command.write / command.invoke`

应用启动时读取 `client.platform.getLaunchContext()`：

- `launchParams.targetPath` 命中 `.card/.box` 时进入 `document-file` 场景；
- 不支持的文件类型显示中文错误态，不触发渲染；
- `launchParams.webDocumentUrl` 进入 `hosted-document` 场景，用于承载 Host 已生成的托管文档 URL。

空启动时显示拖拽与打开文件入口。打开按钮通过命令系统触发 `com.chips.card-viewer.open-file`，再调用 `client.platform.openFile(...)` 选择本地文件。拖拽路径优先读取 `window.chips.platform.getPathForFile(file)`，仅在测试或运行环境提供 `file.path` 时回退。

## 6. 外观、文案与可访问性

- 界面统一使用 `@chips/ui` 的 `appleTheme`（antd 主题），单一亮色外观，不消费 Host 主题注入；
- 界面文案统一简体中文直写，来源为 `src/lib/messages.ts` 中文表，不依赖多语言系统；
- 命令标题、菜单、工具栏、空态、错误态、加载态和 iframe 标题均来自中文表或组件内直写；
- 加载态使用 `role="status"`，错误态使用 `role="alert"`，拖拽入口使用明确的 region 与描述关联；
- `CardWindow` 不再监听主题刷新事件，`theme.changed` 不再触发内容 iframe 重渲。

## 7. 验证脚本

```bash
cd <生态工作区>/Chips-CardViewer
npm run lint
npm test
npm run build
npm run validate
```

当前测试矩阵覆盖：

- 空启动、按钮打开、拖拽入口和 unsupported file；
- `.card/.box` 统一 `document.window.render`；
- 真实 `.card/.box` 素材回归；
- ready、fatal error、node error、resource open 与 cleanup；
- `webDocumentUrl` 托管文档承载、sandbox、origin 与 surface resize；
- 命令 metadata、本地命令模型、Host command registry 消费、菜单和工具栏；
- 文档 surface 外观契约与加载态/错误态可访问性。

## 8. 图标与快捷方式

`manifest.yaml` 通过 `ui.launcher.icon: assets/icons/app-icon.ico` 声明系统入口图标。Host 创建快捷方式时按平台解析 `assets/icons/app-icon.ico/.icns/.png`，该图标路径不进入运行时图标模型；应用内命令图标统一使用 `@ant-design/icons`。
