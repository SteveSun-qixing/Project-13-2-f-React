# Bridge API规范

## 文档定位

本文档定义页面侧 `window.chips.*` 的正式接口形状与主要语义。

它关注：

- Bridge 核心入口
- 子域 API
- 关键动作的入参与返回结构
- transport 无关的统一约束

它不定义：

- Desktop / Headless 的内部实现细节
- SDK 的具体封装代码
- Host 内部服务注册方式

## 1. 基本原则

1. 插件访问 Host 能力只能通过 `window.chips.*` 或 `chips-sdk` 正式入口。
2. Bridge API 的形状必须独立于具体 transport。
3. Host 返回的错误必须归一为标准错误对象。
4. 新的跨平台界面语义优先进入 `surface.*`，而不是继续扩展 `window.*`。

## 2. 核心入口

### 2.1 调用与事件

Bridge 核心入口冻结为：

- `invoke(action, payload?)`
- `invokeScoped(action, payload, { token })`
- `on(event, handler): () => void`
- `once(event, handler): () => void`
- `emit(event, data?): Promise<void>`
- `emitScoped(event, data, { token }): Promise<void>`

动作名统一采用 `namespace.action` 形式，例如：

- `surface.open`
- `plugin.launch`
- `platform.getCapabilities`

事件订阅语义：

- `on` 返回取消订阅函数，调用后不得再触发该 handler；
- `once` 也返回取消订阅函数，handler 最多触发一次，触发前取消后不得再触发；
- `emit / emitScoped` 必须返回 `Promise<void>`；当前 Desktop 实现是发送型事件入口，不表达业务动作已经被 Host 确认处理；传输层可报告的错误必须归一为标准错误对象；
- Bridge 不得吞掉上游错误 envelope，`messageKey / requestId / traceId / permission` 必须原样透传给 SDK 或页面侧调用方。

### 2.2 当前正式子域

| 子域 | 说明 |
|---|---|
| `window` | 桌面窗口兼容别名 |
| `dialog` | 文件选择、保存、消息、确认 |
| `plugin` | 插件查询、启停、安装、快捷方式、应用启动 |
| `clipboard` | 剪贴板读写 |
| `shell` | 桌面 Shell 兼容别名 |
| `surface` | 跨平台界面容器主语义 |
| `command` | 菜单、工具栏、快捷键、命令面板共享的命令注册与调度 |
| `transfer` | 打开路径、外链、在系统中定位、分享 |
| `association` | 文件关联 / URL 打开入口治理 |
| `platform` | 环境信息、能力快照、屏幕、电源、离屏导出 |
| `notification` | 通知 |
| `tray` | 托盘 |
| `shortcut` | 全局快捷键 |
| `ipc` | 本地高性能 IPC 通道 |

## 3. `surface` 子域

### 3.1 正式动作

- `surface.open(request)`
- `surface.focus(surfaceId)`
- `surface.resize(surfaceId, width, height)`
- `surface.setState(surfaceId, state)`
- `surface.getState(surfaceId)`
- `surface.close(surfaceId)`
- `surface.list()`

### 3.2 `surface.open`

当前 `surface.open` 的正式请求结构：

```ts
interface SurfaceOpenRequest {
  kind?: "window" | "tab" | "route" | "modal" | "sheet" | "fullscreen";
  target:
    | {
        type: "plugin";
        pluginId: string;
        url?: string;
        sessionId?: string;
        permissions?: string[];
        launchParams?: Record<string, unknown>;
      }
    | { type: "url"; url: string }
    | { type: "document"; documentId: string; title?: string; url?: string };
  presentation?: {
    title?: string;
    width?: number;
    height?: number;
    resizable?: boolean;
    alwaysOnTop?: boolean;
    visible?: boolean;
    chrome?: WindowChromeOptions;
  };
  context?: SurfaceContext;
}
```

关键语义：

- `target.type = "plugin"` 时，Host 必须走正式插件会话初始化链路；
- 当前该场景除 `window.control` 外，还要求调用方具备 `plugin.manage`；
- `presentation.visible` 表示初始是否显示 surface；省略或 `true` 为可见，`false` 用于 Host 托管的后台/命令执行 surface，不代表跳过应用运行时、Bridge 或权限校验；
- Desktop 目前实际仍落为 `window`，若请求了其他 `kind`，PAL 会在返回的 `metadata` 中保留请求语义；
- `plugin.launch` 保留为 app 插件兼容入口，并复用同一底层实现。

补充说明：

- `window.chips.emit(event, data?)` 是页面向 Host 发送事件的正式入口；
- `file / resource / card / box / zip / module` 等服务能力当前通过 `window.chips.invoke("namespace.action", payload)` 或 `chips-sdk` 暴露，不额外扩展为新的 convenience 子域。

## 4. `command` 子域

`command` 是运行时 UI 动作的统一语义层。菜单、工具栏、快捷键、命令面板和上下文菜单必须消费同一条 command 记录，不得各自维护私有动作模型。

正式动作：

- `command.register(command)`
- `command.unregister(commandId)`
- `command.get(commandId, options?)`
- `command.list(options?)`
- `command.setState(commandId, state)`
- `command.invoke(commandId, payload?, options?)`

Command schema：

```ts
type CommandSource = "menu" | "toolbar" | "shortcut" | "palette" | "context-menu" | "api";

interface CommandDefinition {
  commandId: string;
  titleKey: string;
  descriptionKey?: string;
  ariaLabelKey?: string;
  icon?: IconDescriptor;
  shortcut?: CommandShortcut | CommandShortcut[];
  scope?: CommandScope;
  permission?: string | string[];
  enabledWhen?: boolean | CommandCondition;
  visibleWhen?: boolean | CommandCondition;
  checkedWhen?: boolean | CommandCondition;
  handlerId: string;
  menuPlacement?: CommandMenuPlacement[];
  toolbarPlacement?: CommandToolbarPlacement[];
  paletteKeywords?: string[];
  state?: CommandState;
}
```

约束：

- 文案只允许使用 `titleKey / descriptionKey / ariaLabelKey`，不得在 command 中写 `title / description / ariaLabel` 原始文本。
- `icon` 必须是运行时 `IconDescriptor`，最终由 `ChipsIcon` 消费；不得混入 `manifest.ui.launcher.icon` 这类系统入口图标路径。
- `shortcut` 是 command 语义快捷键绑定，Host 可把它映射到底层 PAL 全局快捷键，但 registry 仍以 `commandId` 为主语义。
- `permission` 表示执行 command 所需业务权限；注册方插件必须在 manifest permissions 中声明这些权限。
- `scope.kind` 支持 `global / app / scene / surface / document`。普通插件默认注册 `app` scope；注册 `global` scope 需要 `command.manage`。
- `enabledWhen / visibleWhen / checkedWhen` 只接受 boolean 或结构化 condition，不接受字符串表达式或第三方表达式语言。

服务级权限：

- `command.read`：查询 command。
- `command.write`：注册、注销和更新自己拥有的 command。
- `command.invoke`：调用 command。
- `command.manage`：跨 owner 管理或注册全局 command。

事件：

- `command.registered`
- `command.unregistered`
- `command.changed`
- `command.invoked`

`command.invoke` 返回：

```ts
{
  commandId: string;
  invocationId: string;
  dispatched: true;
  command: CommandView;
}
```

当前命令调用采用 Host registry + 事件调度模型：Host 完成存在性、scope、权限和状态校验后发出 `command.invoked`，插件侧 SDK 根据 `handlerId / ownerPluginId / ownerSessionId` 执行业务处理。业务 handler 函数不得通过 Bridge 传给 Host。

## 5. `transfer` 与 `association`

### 5.1 `transfer`

正式动作：

- `transfer.openPath({ path })`
- `transfer.openExternal({ url })`
- `transfer.revealInShell({ path })`
- `transfer.share({ input })`

返回结构：

- 前三者返回 `{ ack: true }`
- `transfer.share` 返回 `{ shared: boolean }`

`transfer.share` 在当前 PAL 不支持时，Host 必须返回显式错误，而不是静默成功。

### 5.2 `association`

正式动作：

- `association.getCapabilities()`
- `association.openPath({ path })`
- `association.openUrl({ url })`

`association.openPath` 当前可返回：

- 命中卡片 / 箱子 / 插件处理器的结果
- 回退到系统外部打开的结果

## 6. `platform` 子域

当前 `platform` 子域只保留平台原语与导出相关动作：

- `getInfo()`
- `getCapabilities()`
- `getScreenInfo()`
- `listScreens()`
- `powerGetState()`
- `powerSetPreventSleep(prevent)`
- `openExternal(url)`
- `renderHtmlToPdf(...)`
- `renderHtmlToImage(...)`

返回结构说明：

- `window.chips.platform.getInfo()` convenience 调用返回解包后的 `{ hostKind, platform, arch, release }`；低层 `window.chips.invoke("platform.getInfo", {})` 返回 `{ info }` route envelope。
- `window.chips.platform.getCapabilities()` convenience 调用返回结构化能力快照；低层 `invoke("platform.getCapabilities", {})` 返回 `{ capabilities }`。
- `window.chips.platform.getScreenInfo()` convenience 调用返回单个 screen；低层 `invoke("platform.getScreenInfo", {})` 返回 `{ screen }`。
- `window.chips.platform.listScreens()` convenience 调用返回 `screens[]`；低层 `invoke("platform.listScreens", {})` 返回 `{ screens }`。
- `window.chips.platform.openExternal(url)` convenience 调用返回 `void`；低层 `invoke("platform.openExternal", { url })` 返回 `{ ack: true }`。

`getCapabilities()` 不再返回旧的字符串数组。

### 6.1 Preload 页面辅助入口

Desktop preload 还会在 `window.chips.platform` 下暴露两个页面辅助入口：

- `getLaunchContext()`：读取当前插件页面启动上下文；
- `getPathForFile(file)`：在支持环境中把拖拽或文件选择得到的 `File` 对象解析为本地路径。

这两个入口由 preload 提供，不是 Host route manifest 中的 `platform.*` route。SDK 的 `client.platform.getLaunchContext()` 和 `client.platform.getPathForFile(file)` 会复用这两个辅助入口。

## 7. Legacy 子域说明

### 7.1 `window`

`window.*` 当前继续保留，主要用于桌面兼容链路。

正式动作：

- `window.open({ config })`
- `window.focus({ windowId })`
- `window.resize({ windowId, width, height })`
- `window.setState({ windowId, state })`
- `window.getState({ windowId })`
- `window.close({ windowId })`

它本质上是 `surface(kind=window)` 的兼容别名，不再是新增跨平台能力的首选入口。

### 7.2 `dialog / shell / tray / ipc`

这些 convenience 子域都会把 Host 返回结构解包为更直接的页面可用值。例如：

- `dialog.openFile()` 返回 `string[] | null`
- `dialog.saveFile()` 返回 `string | null`
- `tray.set()` 返回当前 `TrayState`
- `ipc.createChannel()` 返回 `PALIpcChannelInfo`

### 7.3 通过 `invoke()` 暴露的正式服务命名空间

当前 Bridge 页面侧还会通过 `invoke("namespace.action")` 访问以下正式服务域：

- `file.*`
- `resource.*`
- `card.*`
- `box.*`
- `zip.*`
- `module.*`

其中需要特别注意：

- `resource.open` 统一走 Host 资源处理器路由；
- `box.openView / box.renderLayoutFrame / box.renderLayoutEditor / box.openEntry` 已是箱子统一文档链路的正式动作；
- `zip.compress / zip.extract / zip.list` 是网页基础卡片等整包导入场景的正式 ZIP 能力；
- 这些动作属于 Host 服务命名空间，不应误写为 `window.chips.resource.*` 或 `window.chips.box.*` 直接子对象。

#### 7.3.1 万能文件处理链路（`file.*`）

万能文件处理链路提供统一的文件处理能力：

**基础操作**：
- `file.read` / `file.write` / `file.stat` / `file.list` / `file.mkdir` / `file.delete` / `file.move` / `file.copy` / `file.watch` / `file.detectType`

**文件会话操作**（`file.session.*`）：
- `file.session.create` - 创建新文件会话
- `file.session.open` - 打开文件会话
- `file.session.read` - 读取会话内容
- `file.session.write` - 写入会话内容
- `file.session.get` - 获取会话信息
- `file.session.persist` - 持久化会话
- `file.session.close` - 关闭会话
- `file.session.watch` - 监听文件变化

**文件预览操作**（`file.preview.*`）：
- `file.preview.generate` - 生成预览/缩略图
- `file.preview.getCapabilities` - 获取支持的预览格式

**文件转换操作**（`file.convert.*`）：
- `file.convert` - 单一文件格式转换
- `file.batchConvert` - 批量文件格式转换

**文件对比操作**（`file.compare.*`）：
- `file.compare` - 文件内容对比
- `file.versionDiff` - 版本差异对比

详细协议定义见《15-万能文件处理协议.md》。

## 8. 启动上下文

Desktop preload 继续向页面暴露：

```ts
window.chips.platform.getLaunchContext()
```

返回：

```ts
{
  pluginId?: string;
  sessionId?: string;
  sceneId?: string;
  surfaceId?: string;
  kind?: "window" | "tab" | "route" | "modal" | "sheet" | "fullscreen";
  presentation?: {
    title?: string;
    width?: number;
    height?: number;
    resizable?: boolean;
    alwaysOnTop?: boolean;
    visible?: boolean;
    chrome?: WindowChromeOptions;
  };
  surfaceContext?: {
    surfaceId?: string;
    sceneId: string;
    pluginId?: string;
    sessionId?: string;
    kind: "window" | "tab" | "route" | "modal" | "sheet" | "fullscreen";
    presentation: {
      title?: string;
      width?: number;
      height?: number;
      resizable?: boolean;
      alwaysOnTop?: boolean;
      visible?: boolean;
      chrome?: WindowChromeOptions;
    };
    launchParams?: Record<string, unknown>;
    documentContext?: {
      documentId: string;
      title?: string;
      url?: string;
    };
    commandContext?: {
      commandId: string;
      source?: string;
      payload?: Record<string, unknown>;
    };
  };
  launchParams: Record<string, unknown>;
}
```

应用插件必须通过该入口读取真实启动来源，不得解析命令行、Electron 私有对象或 Host 内部窗口状态。`sceneId / surfaceId / kind / presentation / surfaceContext` 是 App / Scene / surface 运行模型的正式上下文；`launchParams` 承载资源打开、命令打开、文件关联或开发运行等业务启动参数。

## 9. 事件规范

Bridge 事件命名统一采用点语义，例如：

- `theme.changed`
- `plugin.ready`
- `surface.opened`
- `plugin.surface.resize`

禁止混用：

- `theme:changed`
- `theme-changed`

## 10. 质量门禁

1. Bridge 形状变化必须同步更新 Host、SDK、路由契约与共享文档。
2. 子域新增动作时，必须先明确权限、返回结构、错误模型和不支持语义。
3. 任何实现都不得绕过 `window.chips.*` 直接暴露原生能力给页面。
4. 通过 `invoke()` 暴露的正式服务命名空间，必须与 Bridge convenience 子域分开描述，避免对外形成两套冲突口径。
