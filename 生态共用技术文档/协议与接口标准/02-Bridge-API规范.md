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

file子域提供文件操作能力，包括file.read(path, options)读取文件，file.write(path, data)写入文件，file.exists(path)检查文件是否存在，file.mkdir(path)创建目录，file.delete(path)删除文件，file.list(path)列出目录内容，file.copy(src, dest)复制文件，file.move(src, dest)移动文件。

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
| `card.validate({ cardFile })` | 验证卡片格式合法性 | 是 |
| `card.render({ cardFile, options? })` | 调用 Host L9 统一渲染链路并返回渲染结果 | 否 |
| `card.renderCover({ cardFile })` | 调用 Host 正式封面渲染链路并返回封面视图 | 否 |
| `card.renderEditor({ cardType, initialConfig?, baseCardId?, cardRootDir? })` | 调用 Host 基础卡片编辑器装载链路并返回编辑器文档 | 否 |

`card.render.options` 推荐字段：

- `target`: `app-root | card-iframe | module-slot | offscreen-render`
- `viewport`: `{ width?, height?, scrollTop?, scrollLeft? }`
- `verifyConsistency`: `boolean`
- `mode`: `view | preview`
- `interactionPolicy`: `native | delegate`

参数校验规则：

- `target` 非白名单值时，Host 必须返回 `SCHEMA_VALIDATION_FAILED`。
- `viewport.width/height`（若提供）必须大于 0 且为有限数值。
- `viewport.scrollTop/scrollLeft`（若提供）必须为有限数值。
- `verifyConsistency`（若提供）必须为布尔值。
- `mode`（若提供）必须是 `view | preview`。
- `interactionPolicy`（若提供）必须是 `native | delegate`。

`card.render` 返回 `view.semanticHash` 与可选 `view.diagnostics/view.consistency`，用于一致性比对与诊断。

`card.renderCover` 返回 `view.title/view.coverUrl/view.ratio`，正式约束如下：

- `view.coverUrl` 必须指向受控的 `.card/cover.html` 入口，供 SDK 作为 iframe `src` 使用；
- 封面资源文件保存在卡片根目录，例如 `cardcover/cover-image.png`；
- `.card/cover.html` 必须具备指向卡片根目录的基准路径，使 `./cardcover/*` 按卡片根目录解析；
- 封面链路不注入复合卡片壳层，也不自动注入主题 CSS、多语言文案或基础卡片节点运行时；
- 应用层不得把 `view.coverUrl` 再改写为任意 `srcdoc` 或内联 HTML 字符串。

说明：

- `interactionPolicy = 'native'` 表示复合卡片保持原生滚动/触摸行为，不向外层应用壳层代理交互意图；
- `interactionPolicy = 'delegate'` 表示 Host 复合文档与基础卡片文档需要把滚轮、触摸滚动、捏合缩放等交互意图正式回传为 `chips.composite:interaction`；
- 选择 Host 托管复合 iframe 的无限画布场景，应使用 `delegate`，其他场景默认保持 `native`。

`card.renderEditor` 返回 `view.title/body/cardType/pluginId/baseCardId`，用于编辑面板装载正式基础卡片编辑器 iframe。

正式约束：

- 普通应用和第三方宿主不得自行扫描插件目录后直接 import 编辑器模块；
- 基础卡片编辑器必须通过 `card.renderEditor` 由 Host 按 `capabilities.cardTypes` 路由；
- `initialConfig` 由应用层提供当前基础卡片内容快照，Host 负责注入插件编辑器运行时；
- `baseCardId` 用于编辑器事件回传与上层状态同步。
- `cardRootDir` 用于编辑器内部资源导入与资源解析，正式规则是“按卡片根目录记录与解析资源路径”。

边界补充：

- 官方 `Chips-EditingEngine` 的正式编辑态链路不再把 `card.renderEditor` 作为主装配路径；
- 该应用改为使用 Host `basecard.openSession` 获取权威会话结果；
- 编辑引擎查看态仍通过 `basecard.renderView` 获取单卡 iframe；
- 编辑引擎编辑态改为通过 `basecard.renderEditor` 获取 Host 托管单卡编辑 iframe；
- `card.render/card.renderEditor` 继续作为 Bridge 对外公开的 Host 托管通用能力。

### basecard子域（基础卡片会话相关）

`basecard` 子域用于 Host 托管的单基础卡片会话能力，当前主要服务官方编辑引擎，也可供未来正式纳入生态决议的宿主使用。

| 动作 | 说明 | 幂等 |
|---|---|---|
| `basecard.openSession({ cardType, baseCardId?, sourceConfig?, cardRootDir? })` | 打开基础卡片会话并返回规范化结果 | 否 |
| `basecard.renderView({ sessionId, interactionPolicy? })` | 生成单基础卡片查看态 iframe 文档 | 否 |
| `basecard.renderEditor({ sessionId, resources? })` | 生成单基础卡片编辑器 iframe 文档，并可桥接资源解析/导入/删除能力 | 否 |
| `basecard.closeSession({ sessionId })` | 关闭基础卡片会话 | 否 |

`basecard.openSession` 返回的正式字段至少包括：

- `sessionId`
- `pluginId`
- `cardType`
- `baseCardId`
- `displayName`
- `normalizedConfig`
- `validation`
- `referencedResources`
- `commitDebounceMs`
- `supportsEditor`

正式约束：

- Host 必须通过插件导出 `getBasecardDescriptor/createInitialBasecardConfig/normalizeBasecardConfig/validateBasecardConfig/collectReferencedResources` 完成会话初始化；
- `referencedResources` 必须使用卡片根目录相对路径；
- 若传入 `cardRootDir`，Host 生成的查看态与编辑器文档必须保证内部相对资源按卡片根目录解析；
- 宿主不得绕过 `basecard.openSession` 自行实现插件规范化和校验。

复合卡片预览 iframe 事件协议：

- `chips.composite:ready`
- `chips.composite:resize`
- `chips.composite:interaction`
- `chips.composite:node-select`
- `chips.composite:node-error`
- `chips.composite:fatal-error`

其中 `resize` 事件必须至少包含：

```ts
{
  height: number;
  nodeCount: number;
  reason: 'initial' | 'ready' | 'node-load' | 'node-height' | 'resize-observer';
}
```

其中 `node-select` 在 `mode: 'preview'` 下触发，必须至少包含：

```ts
{
  nodeId: string;
  cardType: string;
  pluginId?: string;
}
```

其中 `interaction` 事件必须至少包含：

```ts
{
  cardId: string;
  nodeId?: string;
  cardType?: string;
  source: 'basecard-frame' | 'composite-shell' | 'degraded-node';
  device: 'wheel' | 'touch';
  intent: 'scroll' | 'zoom';
  deltaX: number;
  deltaY: number;
  zoomDelta?: number;
  clientX: number;
  clientY: number;
  pointerCount: number;
}
```

编辑器 iframe 事件协议：

- `chips.card-editor:ready`
- `chips.card-editor:change`
- `chips.card-editor:error`
- `chips.card-editor:resize`
- `chips.card-editor:resource-request`
- `chips.card-editor:resource-response`
- `chips.card-editor:resource-release`

其中 `change` 事件必须至少包含：

```ts
{
  baseCardId?: string;
  cardType: string;
  pluginId: string;
  config: Record<string, unknown>;
}
```

资源事件约束：

- `resource-request` / `resource-response` 用于编辑器 iframe 与外层宿主之间的正式资源桥接；
- `resourcePath` 一律使用相对于卡片根目录的路径；
- `resource-request.action` 当前正式支持 `resolve | import | delete`；
- `resolve` 响应返回的 URL 只作为当前会话的运行时访问地址，若使用 `blob:` 等临时地址，后续必须支持 `resource-release`；
- `import` 响应返回的 `path` 必须是卡片根目录相对路径，宿主应负责挑选不冲突的正式文件名；
- `delete` 表示对卡片内部资源发起删除意图，是否立即物理删除由宿主持久化链路决定；
- `resource-release` 用于通知外层宿主释放 `blob:` 等临时资源 URL；
- SDK `editorPanel.render({ resources })` 可以在本地桥接这组协议，但 `resources` 本身不进入 `card.renderEditor` Host 路由输入。

### storage子域

storage子域提供本地存储能力，包括storage.get(key)读取数据，storage.set(key, value)写入数据，storage.delete(key)删除数据，storage.clear()清空所有数据。

存储数据以键值对形式保存在本地，与特定插件关联，不同插件的数据互相隔离。

### module子域

module子域提供 Host 管理的共享功能模块挂载能力，采用 vNext 冻结动作口径：

| 动作 | 说明 | 幂等 |
|---|---|---|
| `module.mount({ slot, moduleId })` | 在指定 slot 挂载已安装且已启用的模块插件，返回 `{ module }` | 否 |
| `module.unmount({ slot })` | 卸载指定 slot 的模块挂载，返回 `{ ack: true }` | 否 |
| `module.query({ slot })` | 查询指定 slot 的挂载状态，返回 `{ module: ModuleState \| null }` | 是 |
| `module.list()` | 列出当前 Host 已挂载的全部模块，返回 `{ modules: ModuleState[] }` | 是 |

正式约束：

- `slot` 必须是非空字符串，用于表达逻辑挂载位，例如 `viewer.preview`、`editor.richtext`。
- `moduleId` 必须是已安装、已启用且 `manifest.type === "module"` 的正式插件标识。
- `module.mount` 在目标 slot 已被占用时必须返回 `MODULE_CONFLICT`。
- `module.mount` 在模块不存在、类型错误或未启用时，分别返回 `MODULE_NOT_FOUND`、`MODULE_INVALID`、`MODULE_DISABLED`。
- `ModuleState` 至少包含 `slot/moduleId/entry?/capabilities/active/mountedAt`。

迁移说明：

- 旧文档中的 `module.load(moduleId)` / `module.unload(moduleId)` 已归档，不再作为外部正式动作暴露。
- SDK 对 `module.query/module.list` 的包装会把 Host 返回的 `{ module }` / `{ modules }` 解包为直接结果，便于插件侧使用。

### plugin子域

plugin子域提供插件信息查询能力，采用 vNext 冻结动作口径：

| 动作 | 说明 | 幂等 |
|---|---|---|
| `plugin.getSelf()` | 获取当前插件自身信息 | 是 |
| `plugin.list({ type?, capability? })` | 查询已安装插件列表 | 是 |
| `plugin.get({ pluginId })` | 获取指定插件信息 | 是 |
| `plugin.getCardPlugin({ cardType })` | 根据卡片类型获取渲染插件 | 是 |
| `plugin.getLayoutPlugin({ layoutType })` | 根据布局类型获取布局插件 | 是 |
| `plugin.query({ type?, capability? })` | 按治理视角查询已安装插件运行时记录 | 是 |

**插件信息结构**：

```ts
interface PluginInfo {
  id: string;           // 插件唯一标识
  version: string;      // 插件版本
  type: 'app' | 'card' | 'layout' | 'theme' | 'module'; // 插件类型
  name: string;         // 插件显示名称
  description?: string; // 插件描述
  installPath: string;  // 安装路径
  capabilities?: string[]; // 插件能力列表
}
```

**迁移说明**：旧动作 `getInstalled`、`getInfo`、`findCardPlugin` 已归档，仅做内部兼容映射。

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
| `chips.invoke('file.read')` | file.read | 读取文件 |
| `chips.invoke('file.write')` | file.write | 写入文件 |
| `chips.invoke('file.delete')` | file.delete | 删除文件 |
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
6. 检查 'file.write' 是否在权限列表中
7. 如果有权限，转发给路由器执行
8. 如果无权限，返回 PERMISSION_DENIED 错误
```

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
