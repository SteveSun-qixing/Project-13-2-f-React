# Bridge API规范

## 概述

Bridge API是插件访问系统能力的标准接口，通过Electron的contextBridge机制暴露给渲染进程。Bridge API是插件访问底层能力的唯一通道，插件不能直接访问Node.js API、文件系统或网络。

## 架构归属声明（2026-03-06）

- L5-L9（含 Runtime Client、Declarative UI、Unified Rendering）属于 Host 内置运行时能力。
- SDK 仅是开发者工具包，负责 Bridge API 的类型化封装和调用辅助，不承载运行时主实现。
- 用户环境只安装 Host 即可运行；SDK 不作为运行时必装项。

## 核心接口

### 三层架构

Bridge API 采用三层设计（vNext 冻结架构）：

| 层级 | 名称 | 职责 |
|---|---|---|
| L5 | Bridge Transport | `window.chips.*` IPC 传输层 |
| L6 | Runtime Client | 协议编解码、错误归一、重试控制 |
| L7 | UI Hooks | 面向页面的能力调用接口 |

### invoke方法

invoke方法用于发起请求到主进程，语法是 `await window.chips.invoke(action, payload)`。`action` 使用 `namespace.action` 格式，例如 `theme.getCurrent`、`card.render`、`window.open`。`payload` 参数是包含请求数据的对象。

invoke方法返回一个 Promise 对象，resolve 时返回处理结果，reject 时返回错误信息。错误信息包含错误代码和错误描述，便于定位问题。

### on方法

on方法用于订阅事件，语法是window.chips.on(eventType, callback)。eventType参数指定要订阅的事件类型，使用点号分隔的命名空间，如card.created、box.updated等。callback参数是事件发生时要执行的回调函数，回调函数接收事件对象作为参数。

返回订阅ID，可以用于取消订阅。

### emit方法

emit方法用于发送事件到主进程，语法是window.chips.emit(eventType, payload)。eventType参数指定事件类型。payload参数是事件数据对象。

## 子域API

### file子域

file 子域提供低层文件系统能力，面向基础设施级应用与编辑类应用开放通用文件编排接口。正式动作包括 `file.read`、`file.write`、`file.stat`、`file.list`、`file.watch`、`file.exists`、`file.mkdir`、`file.delete`、`file.copy`、`file.move`。

设计约束：

- Host 负责提供稳定、较低颗粒度的文件能力，不要求为每个上层业务动作都新增专用 route；
- 获得正式权限的应用可以基于文件格式规范，自行完成目录创建、内容写回、文件搬移、事务编排等工作；
- 基础设施级应用必须仍然遵守正式文件格式、主题系统、多语言系统与错误码规范，不能私设第二套协议。

### zip子域

zip 子域提供压缩包能力，正式动作包括 `zip.compress(inputDir, outputZip)`、`zip.extract(zipPath, outputDir)`、`zip.list(zipPath)`。

对于 `.card`、`.box` 等以 ZIP 为承载格式的生态文档，Host 负责提供压缩/解压基础能力；是否封装为更高层业务动作，由上层应用按正式架构决定。对 EditingEngine 这类基础设施级应用，允许在获得 `zip.manage` 与 `file.manage` 后直接完成“解压 -> 改写 -> 重新打包”链路。

### dialog子域

dialog子域提供对话框能力，包括dialog.open(options)打开文件选择对话框，dialog.save(options)打开文件保存对话框，dialog.message(options)显示消息对话框，dialog.confirm(options)显示确认对话框。

options参数包含对话框的标题、默认路径、过滤器等配置。

### clipboard子域

clipboard子域提供剪贴板能力，包括clipboard.readText()读取文本，clipboard.writeText(text)写入文本，clipboard.readImage()读取图片，clipboard.writeImage(image)写入图片。

### shell子域

shell子域提供系统Shell能力，包括shell.openPath(path)用系统默认程序打开文件，shell.showItemInFolder(path)在文件管理器中显示文件，shell.openExternal(url)用浏览器打开URL。

### window子域

window 子域采用 vNext 动作口径：

| 动作 | 说明 | 幂等 |
|---|---|---|
| `window.open({ config })` | 创建新窗口并返回窗口句柄 | 否 |
| `window.focus({ windowId })` | 聚焦指定窗口 | 是 |
| `window.resize({ windowId, width, height })` | 调整窗口尺寸 | 否 |
| `window.setState({ windowId, state })` | 切换窗口状态 | 否 |
| `window.getState({ windowId })` | 获取窗口当前状态 | 是 |
| `window.close({ windowId })` | 关闭窗口 | 否 |

`window.open.config` 支持以下关键字段：

- `title` / `width` / `height`
- `url?` / `pluginId?` / `sessionId?` / `permissions?`
- `chrome?`: `{ frame?, transparent?, backgroundColor?, titleBarStyle?, titleBarOverlay? }`

`chrome.titleBarOverlay` 既可为 `boolean`，也可为对象：

```ts
{
  color?: string;
  symbolColor?: string;
  height?: number;
}
```

应用插件可以在运行时显式传入 `chrome`，也可以在 manifest 的 `ui.window.chrome` 中声明默认窗口外观基线。

### theme子域

theme子域提供主题能力，采用 vNext 冻结动作口径：

| 动作 | 说明 | 幂等 |
|---|---|---|
| `theme.list({ publisher? })` | 获取所有已安装主题列表 | 是 |
| `theme.apply({ id })` | 应用指定主题 | 否 |
| `theme.getCurrent({ appId?, pluginId? })` | 获取当前生效主题 | 是 |
| `theme.getAllCss()` | 获取当前主题完整 CSS | 是 |
| `theme.resolve({ chain })` | 解析主题作用域链 | 是 |
| `theme.contract.get({ component? })` | 获取主题契约接口点 | 是 |

**迁移说明**：旧动作 `getCss`、`getAll`、`setCurrent` 已归档，仅做内部兼容映射，不再作为外部接口暴露。

### card子域（统一渲染相关）

card 子域采用 vNext 动作口径：

| 动作 | 说明 | 幂等 |
|---|---|---|
| `card.parse({ cardFile })` | 解析卡片结构并返回 AST | 是 |
| `card.getBaseCard({ cardFile, nodeId })` | 读取单个基础卡片的标准化配置 | 是 |
| `card.validate({ cardFile })` | 验证卡片格式合法性 | 是 |
| `card.render({ cardFile, options? })` | 调用 Host L9 统一渲染链路并返回渲染结果 | 否 |
| `card.renderBaseCardEditor({ cardFile, nodeId })` | 生成基础卡片编辑器 iframe 文档 | 否 |
| `card.updateBaseCard({ cardFile, nodeId, config })` | 通过 Host 正式写链路更新单个基础卡片配置 | 否 |

`card.render.options` 推荐字段：

- `target`: `app-root | card-iframe | module-slot | offscreen-render`
- `viewport`: `{ width?, height?, scrollTop?, scrollLeft? }`
- `verifyConsistency`: `boolean`

参数校验规则：

- `target` 非白名单值时，Host 必须返回 `SCHEMA_VALIDATION_FAILED`。
- `viewport.width/height`（若提供）必须大于 0 且为有限数值。
- `viewport.scrollTop/scrollLeft`（若提供）必须为有限数值。
- `verifyConsistency`（若提供）必须为布尔值。

`card.render` 返回 `view.semanticHash` 与可选 `view.diagnostics/view.consistency`，用于一致性比对与诊断。

卡片文档写入补充约束（2026-03-11）：

- `card.getBaseCard / card.renderBaseCardEditor / card.updateBaseCard` 继续承担“单个基础卡片配置编辑”这一高层语义链路；
- 复合卡片结构编辑、文档模式切换、批量内容写回等更底层动作，不强制要求 Host 为 EditingEngine 单独提供业务级 route；
- 获得 `file.manage` + `zip.manage` 的基础设施级应用，可以基于正式 `.card` 文件格式直接执行解压、改写、重打包；
- 这类应用必须严格遵守 `metadata.yaml`、`structure.yaml`、`content/*.yaml` 的正式字段与写回规则，不得发明私有包结构。

基础卡片编辑动作补充返回结构：

```ts
interface BaseCardRecord {
  nodeId: string;
  cardType: string;
  pluginId: string;
  title: string;
  contentPath: string;
  config: Record<string, unknown>;
}

interface BaseCardEditorDocument {
  title: string;
  body: string; // 可直接写入 iframe.srcdoc
  protocolVersion: string;
  baseCard: BaseCardRecord;
}
```

基础卡片编辑 iframe 消息协议冻结如下：

- 子 iframe -> 宿主：
  - `chips.basecard-editor:ready`
  - `chips.basecard-editor:config-change`
  - `chips.basecard-editor:config-synced`
  - `chips.basecard-editor:fatal-error`
- 宿主 -> 子 iframe：
  - `chips.basecard-editor:sync-config`

其中：

- `config-change` 负载必须包含 `nodeId / cardType / pluginId / config`；
- `sync-config` 用于撤销、重做、自动保存回滚后的编辑器状态重同步；
- 宿主侧必须按 iframe `contentWindow + origin` 过滤消息来源。

### storage子域

storage子域提供本地存储能力，包括storage.get(key)读取数据，storage.set(key, value)写入数据，storage.delete(key)删除数据，storage.clear()清空所有数据。

存储数据以键值对形式保存在本地，与特定插件关联，不同插件的数据互相隔离。

### module子域

module 子域采用插槽挂载口径：

| 动作 | 说明 | 幂等 |
|---|---|---|
| `module.mount({ slot, module })` | 在指定 slot 挂载模块描述对象 | 否 |
| `module.unmount({ slot })` | 卸载指定 slot 模块 | 否 |
| `module.query({ slot })` | 查询指定 slot 当前模块 | 是 |
| `module.list()` | 获取全部已挂载模块 | 是 |

说明：

- `module.mount` 正式输入为 `{ slot, module }`，不再使用 `{ slot, moduleId }`；
- 基础卡片编辑面板宿主能力不再通过 `module.*` 兜底，而使用 `card.renderBaseCardEditor` 正式动作。

### plugin子域

plugin子域提供插件信息查询能力，采用 vNext 冻结动作口径：

| 动作 | 说明 | 幂等 |
|---|---|---|
| `plugin.getSelf()` | 获取当前插件自身信息 | 是 |
| `plugin.list({ type?, capability? })` | 查询已安装插件列表 | 是 |
| `plugin.get({ pluginId })` | 获取指定插件信息 | 是 |
| `plugin.getCardPlugin({ cardType })` | 根据卡片类型获取渲染插件 | 是 |
| `plugin.getLayoutPlugin({ layoutType })` | 根据布局类型获取布局插件 | 是 |
| `plugin.launch({ pluginId, launchParams? })` | 以 Host 正式会话链路启动应用插件 | 否 |
| `plugin.getShortcut({ pluginId })` | 读取应用插件快捷方式状态 | 是 |
| `plugin.createShortcut({ pluginId, replace? })` | 创建或替换应用插件快捷方式 | 否 |
| `plugin.removeShortcut({ pluginId })` | 删除应用插件快捷方式 | 否 |
| `plugin.query({ type?, capability? })` | 按治理视角查询已安装插件运行时记录 | 是 |

**插件信息结构**：

```ts
interface PluginInfo {
  id: string;           // 插件唯一标识
  version: string;      // 插件版本
  type: 'app' | 'card' | 'layout' | 'theme'; // 插件类型
  name: string;         // 插件显示名称
  description?: string; // 插件描述
  installPath: string;  // 安装路径
  capabilities?: string[]; // 插件能力列表
}
```

**迁移说明**：旧动作 `getInstalled`、`getInfo`、`findCardPlugin` 已归档，仅做内部兼容映射。

`plugin.launch` 当前仅支持 `type: app` 插件。Host 会先完成 `plugin.init -> handshake -> window.create`，再返回正式窗口与会话信息。

应用快捷方式相关动作补充返回结构：

```ts
interface PluginShortcutRecord {
  pluginId: string;
  name: string;
  location: 'desktop' | 'launchpad';
  launcherPath: string;
  executablePath: string;
  args: string[];
  iconPath?: string;
  exists: boolean;
}
```

其中：

- Windows 当前使用桌面 `.lnk`；
- macOS 当前使用 `~/Applications/Chips Apps/*.app` 并在启动台展示；
- `args` 为 Host 写入快捷方式的实际参数；
- 创建与删除动作均由 Host 统一审计并触发运行时事件，前端不得自行落系统文件。

### preload 本地辅助能力

对于必须在 preload 中完成、且不应通过 IPC 回传主进程的本地能力，Host 可以在 `window.chips` 暴露受控辅助函数。

当前已冻结一项拖拽文件辅助能力：

```ts
window.chips.platform.getPathForFile(file: File): string
```

约束：

- 仅用于解析拖拽/选择所得 `File` 对象对应的本地路径；
- Electron 环境下由 preload 调用 `webUtils.getPathForFile(file)` 实现；
- 普通浏览器或不支持该能力的环境返回空字符串；
- 不得借此暴露任意 Node/Electron 原生对象到页面主世界。

当前还冻结了一项启动上下文辅助能力：

```ts
window.chips.platform.getLaunchContext(): {
  pluginId?: string;
  sessionId?: string;
  launchParams: Record<string, unknown>;
}
```

约束：

- 该能力为同步只读快照，不经过额外 IPC；
- 返回值来源于 Host 创建插件窗口时注入的 launch context；
- 用于恢复快捷方式启动、文件关联打开和开发入口拉起等会话上下文；
- 不得将其误用为任意跨窗口状态同步通道。

## 类型定义

Bridge API使用TypeScript编写完整的类型定义。所有接口都有明确的类型标注，包括请求参数类型和响应数据类型。类型定义文件chips.d.ts随SDK一起发布，开发者可以导入到项目中获得代码补全和类型检查。

## 安全限制

Bridge API强制执行安全限制，插件只能通过API访问系统能力，不能直接调用Node.js或Electron API。文件操作只能访问允许的目录，不能访问系统敏感位置。网络请求只能通过特定接口发起。剪贴板访问需要用户授权。

## 错误处理

所有 API 方法都遵循统一的错误归一映射原则：

| 错误层级 | 前缀 | 说明 |
|---|---|---|
| Bridge 层 | `BRIDGE_*` | IPC 传输超时、断连 |
| Service 层 | `SERVICE_*` | 服务域处理错误 |
| Runtime 层 | `RUNTIME_*` | 超时重试错误 |
| UI 层 | `UI_*` | 页面级消费错误 |

**标准错误对象格式**：
```ts
interface StandardError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}
```

### 重试策略

- 可重试错误（`retryable=true`）才允许自动重试
- 默认指数退避：`200ms * 2^n`，最大 3 次
- 仅 `BRIDGE_TIMEOUT`、`SERVICE_UNAVAILABLE` 等标记为可重试

常见错误代码包括 `BRIDGE_TIMEOUT`、`SERVICE_NOT_FOUND`、`PERMISSION_DENIED`、`RESOURCE_NOT_FOUND`、`INVALID_ARGUMENT`、`INTERNAL_ERROR`。

开发者应该捕获错误并向用户提供有意义的错误提示。

## 使用示例

读取文件内容的示例：调用 `await window.chips.invoke('file.read', { path: '/path/to/file' })`，返回文件内容字符串或 Buffer。

保存文件的示例：调用 `await window.chips.invoke('file.write', { path: '/path/to/file', data: 'content' })`，返回操作结果。

订阅卡片创建事件的示例：调用const subscriptionId = window.chips.on('card.created', (event) => { console.log('New card created:', event.data) })，返回订阅ID用于后续取消订阅。

打开文件选择对话框的示例：调用 `const result = await window.chips.invoke('platform.dialogOpenFile', { options: { filters: [{ name: 'Cards', extensions: ['card'] }] } })`，返回用户选择的文件路径数组。

## 权限控制

### API 权限映射

并非所有 Bridge API 都无条件开放。部分 API 需要插件在 manifest.yaml 中声明对应权限：

| API | 需要的权限 | 说明 |
|-----|-----------|------|
| `chips.invoke('file.read')` | `file.read` 或 `file.manage` | 读取文件 |
| `chips.invoke('file.write')` | `file.write` 或 `file.manage` | 写入文件 |
| `chips.invoke('file.stat')` | `file.read` 或 `file.manage` | 读取文件元信息 |
| `chips.invoke('file.list')` | `file.read` 或 `file.manage` | 列目录 |
| `chips.invoke('file.exists')` | `file.read` 或 `file.manage` | 检查存在性 |
| `chips.invoke('file.mkdir')` | `file.manage` | 创建目录 |
| `chips.invoke('file.delete')` | `file.manage` | 删除文件或目录 |
| `chips.invoke('file.copy')` | `file.manage` | 复制文件或目录 |
| `chips.invoke('file.move')` | `file.manage` | 移动文件或目录 |
| `chips.invoke('zip.compress')` | `zip.manage` | 压缩目录 |
| `chips.invoke('zip.extract')` | `zip.manage` | 解压压缩包 |
| `chips.invoke('resource.fetch')` | resource.fetch | 网络请求 |
| `chips.invoke('card.read*')` | card.read | 读取卡片 |
| `chips.invoke('card.write*')` | card.write | 修改卡片 |
| `chips.invoke('window.open', { config })` | window.open | 创建窗口 |
| `chips.shell.openExternal()` | platform.shellOpenExternal | 打开外部链接 |

### 权限检查流程

```
1. 插件调用 `chips.invoke('file.write', {...})`
2. Bridge 将请求发送到主进程
3. 主进程 IPC 处理器识别请求来自哪个窗口
4. 查询该窗口对应的插件 ID
5. 从注册表获取该插件的权限列表
6. 检查精确权限或同命名空间的 `*.manage` 超集权限是否在权限列表中
7. 如果有权限，转发给路由器执行
8. 如果无权限，返回 PERMISSION_DENIED 错误
```

权限匹配补充规则：

- 默认仍以精确权限名声明与校验；
- 当某个服务域定义了 `namespace.manage` 时，`namespace.manage` 视为该命名空间下所有动作的超集权限；
- 基础设施级应用优先声明较粗粒度的 `*.manage`，普通业务插件仍应遵循最小权限原则声明精确权限。

### 无需权限的 API

以下 API 对所有插件无条件开放：

- `chips.on()` / `chips.once()` / `chips.emit()`（事件系统）
- `chips.invoke('plugin.getSelf')`（获取自身信息）
- `chips.invoke('i18n.translate')`（翻译文本）
- `chips.invoke('config.get')`（读取配置，不含敏感项）
- `chips.invoke('theme.getCurrent')` / `chips.invoke('theme.getAllCss')`（获取主题）

## SDK 封装

薯片 SDK 是 Bridge API 的高层封装，为插件开发者提供更友好的开发体验：

```typescript
// SDK 封装示例
import { ChipsSDK } from '@chips/sdk';

const sdk = new ChipsSDK();

// SDK 提供类型安全的 API
const metadata = await sdk.card.getMetadata('/path/to/card.card');
// 而不是 chips.invoke('card', 'getMetadata', { cardPath: '...' })

// SDK 提供 Vue/React 集成
const { useTheme } = sdk.composables;
const theme = useTheme(); // 自动响应主题变化

// SDK 提供 Host 渲染能力调用封装
await sdk.card.renderByHost({
  cardFile: '/path/to/card.card',
  target: containerElement
});
```

SDK 是可选的。插件可以直接使用 `window.chips.*` 原始 API，也可以通过 SDK 获得更好的开发体验。SDK 本身是纯前端封装，运行在渲染进程中，底层仍通过 Bridge API 调用 Host 内置运行时能力。

### SDK 缓存策略

SDK 可以在渲染进程中维护缓存，减少 IPC 调用：

- **配置数据缓存**：config 值在读取后缓存，监听变化事件自动更新
- **主题 CSS 缓存**：主题不频繁变化，可长期缓存
- **翻译文本缓存**：语言切换时清除
