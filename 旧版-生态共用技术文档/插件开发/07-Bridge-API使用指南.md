# Bridge API 使用指南

## 文档定位

本文说明页面侧 `window.chips.*` 的低层使用方式。应用插件业务代码应优先使用 `chips-sdk` 和组件库环境 Provider；只有在 SDK 尚未封装、需要调试低层 route、或编写共享运行时适配层时，才直接使用裸 Bridge。

正式调用顺序：

1. React 官方应用优先使用 `@chips/component-library` 的 `ChipsEnvironmentProvider`、`useChipsClient`、`useChipsTheme`、`useChipsI18n`、`useChipsSurface` 等入口。
2. 非 React 或领域服务封装优先使用 `chips-sdk` 的 `createClient()` 与 domain API。
3. 需要低层访问时使用 `window.chips` 的 convenience 子域。
4. convenience 子域未覆盖的正式 Host 服务动作，使用 `window.chips.invoke("namespace.action", payload)`。

SDK、Bridge 与 Host 的边界是稳定架构红线：SDK 只做类型化封装和调用辅助，不承载 Host runtime 主实现；Host 是唯一运行时承载。

## 1. 初始化与可用性

Host 托管的插件页面由 preload 注入 `window.chips`。页面不得直接访问 Node.js、Electron 或 Host 内部包。

```ts
const bridge = window.chips;

if (!bridge) {
  throw new Error("当前页面未运行在薯片 Host Bridge 环境中");
}
```

应用代码通常不需要手写上述检查，而是创建 SDK client：

```ts
import { createClient } from "chips-sdk";

const client = createClient();
```

`createClient()` 会在插件环境中自动使用 `window.chips`；在普通 `node/browser` 环境且没有自定义 `transport` 时，实际调用会抛出 `BRIDGE_UNAVAILABLE` 标准错误。

## 2. 核心调用入口

低层 route 调用入口是：

```ts
window.chips.invoke(action, payload?)
```

`action` 使用 `namespace.action` 形式，例如：

- `file.read`
- `resource.open`
- `card.render`
- `box.openView`
- `surface.open`
- `command.register`
- `platform.getCapabilities`

需要注意两层返回结构：

- `window.chips.invoke("namespace.action", payload)` 返回 Host route 的原始响应 envelope。
- `chips-sdk` domain API 和 `window.chips.surface/dialog/command/...` convenience 子域会把常用 envelope 解包成页面更容易消费的值。

示例：低层读取文本文件时消费 `file.read` 的 route envelope。

```ts
const result = await window.chips.invoke<{ content: string }>("file.read", {
  path: "/tmp/demo.card/metadata.yaml",
  options: { encoding: "utf-8" },
});

const metadataYaml = result.content;
```

业务代码中更推荐使用 SDK：

```ts
const metadataYaml = await client.file.read("/tmp/demo.card/metadata.yaml", {
  encoding: "utf-8",
});
```

## 3. 当前正式子域

当前 `window.chips` 正式暴露以下 convenience 子域：

| 子域 | 用途 |
|---|---|
| `window` | 桌面窗口兼容别名 |
| `dialog` | 文件选择、保存、消息、确认 |
| `plugin` | 插件查询、启停、安装、快捷方式、应用启动 |
| `clipboard` | 剪贴板读写 |
| `shell` | 桌面 Shell 兼容别名 |
| `surface` | 跨平台界面容器主语义 |
| `command` | 命令注册、查询、状态和调度 |
| `transfer` | 打开路径、外链、定位文件、分享 |
| `association` | 文件关联、URL 打开入口治理 |
| `platform` | 平台信息、能力快照、屏幕、电源、preload 辅助 |
| `notification` | 系统通知 |
| `tray` | 托盘 |
| `shortcut` | 系统全局快捷键 |
| `ipc` | 本地高性能 IPC 通道 |

`file / resource / card / box / zip / module` 等服务域不是 `window.chips.file.*` 这类直接子域。它们应通过 `chips-sdk` domain API，或通过 `window.chips.invoke("namespace.action", payload)` 访问。

## 4. Surface 与启动上下文

`surface` 是应用插件界面容器的主语义。Desktop 当前映射为窗口，但应用代码不得依赖 `BrowserWindow` 或 Electron 私有对象。

```ts
const opened = await window.chips.surface.open({
  kind: "window",
  target: {
    type: "plugin",
    pluginId: "com.chips.example",
    launchParams: { source: "command" },
  },
  presentation: {
    title: "示例应用",
    width: 1200,
    height: 800,
    resizable: true,
  },
});
```

等价低层调用：

```ts
const result = await window.chips.invoke<{ surface: unknown }>("surface.open", {
  request: {
    target: { type: "plugin", pluginId: "com.chips.example" },
  },
});
```

权限口径：

- `surface.*` route 的服务级权限是 `window.control`。
- `surface.open` 当 `target.type === "plugin"` 时，Host 额外要求 `plugin.manage`。

应用启动后通过 preload 辅助入口读取上下文：

```ts
const launchContext = window.chips.platform.getLaunchContext?.();
```

当前正式字段：

```ts
{
  pluginId?: string;
  sessionId?: string;
  sceneId?: string;
  surfaceId?: string;
  kind?: "window" | "tab" | "route" | "modal" | "sheet" | "fullscreen";
  presentation?: SurfacePresentation;
  surfaceContext?: {
    surfaceId?: string;
    sceneId: string;
    pluginId?: string;
    sessionId?: string;
    kind: "window" | "tab" | "route" | "modal" | "sheet" | "fullscreen";
    presentation: SurfacePresentation;
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

`platform.getLaunchContext()` 和 `platform.getPathForFile(file)` 是 preload 暴露的页面辅助入口，不是 Host route manifest 中的 `platform.*` route。SDK 的 `client.platform.getLaunchContext()` 与 `client.platform.getPathForFile(file)` 会复用这两个辅助入口。

## 5. Command 子域

菜单、工具栏、快捷键、命令面板和上下文菜单必须共用 Host command registry。

```ts
await window.chips.command.register({
  commandId: "com.chips.example.open",
  titleKey: "example.commands.open.title",
  descriptionKey: "example.commands.open.description",
  ariaLabelKey: "example.commands.open.ariaLabel",
  icon: { name: "folder_open", style: "rounded" },
  scope: { kind: "app", appId: "com.chips.example" },
  permission: ["file.read"],
  handlerId: "open",
  menuPlacement: [{ menuId: "file", groupId: "open", order: 10 }],
  toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 10 }],
});
```

强制规则：

- 文案只能使用 `titleKey / descriptionKey / ariaLabelKey`，不得写 `title / description / ariaLabel / label` 原始文本。
- `icon` 是运行时 `IconDescriptor`，不等同于 `manifest.ui.launcher.icon`。
- `handlerId` 是插件侧处理器标识，业务函数不得通过 Bridge 传给 Host。
- 普通应用默认使用 `app` scope；注册 `global` scope 需要 `command.manage`。
- `shortcut` 是当前 Host 托管 surface 内的命令快捷键，不等同于 `platform.shortcut*` 系统全局快捷键。

Host 校验通过后发出 `command.invoked` 事件，插件侧根据 `handlerId / ownerPluginId / ownerSessionId` 执行业务处理。应用模板推荐通过 SDK `client.command.*` 和组件库 `ChipsCommandProvider` 接入，而不是在业务组件里直接操作 Bridge。

## 6. 事件监听与发送

监听事件：

```ts
const dispose = window.chips.on("theme.changed", (event) => {
  console.log(event);
});

dispose();
```

规则：

- `on(event, handler)` 返回取消订阅函数。
- `once(event, handler)` 也返回取消订阅函数，handler 最多触发一次。
- 事件命名使用点语义，例如 `theme.changed`、`surface.opened`、`command.invoked`。
- 不使用冒号或短横线事件名。

页面向 Host 发送事件使用：

```ts
await window.chips.emit("plugin.ready", { ready: true });
```

当前 Desktop `emit` 是发送型事件入口，不表示业务动作已经被 Host 确认处理。需要请求响应、权限校验结果或业务返回值时，应使用 `invoke()` 或 SDK domain API。

## 7. 标准错误处理

Bridge、SDK 与 Host route 统一使用标准错误对象：

```ts
interface StandardError {
  code: string;
  message: string;
  messageKey?: string;
  details?: unknown;
  retryable?: boolean;
  requestId?: string;
  traceId?: string;
  permission?: {
    required: string[];
    granted: string[];
    messageKey?: string;
    callerId?: string;
    callerType?: string;
    pluginId?: string;
  };
}
```

权限不足时，调用方应读取 `permission.required / permission.granted / messageKey`，不要解析 `message` 文本。

```ts
try {
  await window.chips.invoke("file.read", { path: "/private/demo.card" });
} catch (error) {
  const standard = error as StandardError;
  if (standard.code === "PERMISSION_DENIED") {
    console.warn(standard.permission?.required);
  }
}
```

常见错误：

- `BRIDGE_UNAVAILABLE`：当前环境没有可用 Bridge。
- `BRIDGE_SCOPE_UNAVAILABLE`：当前 Bridge 不支持 scoped 调用。
- `BRIDGE_TIMEOUT`：SDK 侧调用超时。
- `ROUTE_TIMEOUT`：Host route 超时。
- `PERMISSION_DENIED`：调用方缺少所需权限。
- `RUNTIME_CIRCUIT_OPEN`：Host route 熔断。

SDK 会对 `retryable === true` 的错误按配置重试；权限错误不会自动重试。

## 8. 权限与 Manifest

插件必须在 `manifest.yaml` 中声明实际使用的权限。权限由 Host route manifest 和 Host 服务实现共同校验。

示例：

```yaml
permissions:
  - file.read
  - theme.read
  - i18n.read
  - command.read
  - command.write
  - command.invoke
  - window.control
```

注意：

- `surface.open(target=plugin)` 除 `window.control` 外还需要 `plugin.manage`。
- 命令注册、状态更新和注销需要 `command.write`；命令调用需要 `command.invoke`。
- 跨 owner 管理 command 或注册全局 command 需要 `command.manage`。
- `platform.getLaunchContext()` 和 `platform.getPathForFile()` 是 preload 辅助入口，不通过 route manifest 追加权限；但后续读取文件、打开资源或执行平台动作仍按对应 route 权限校验。

## 9. 性能与安全建议

- 独立 Host 调用可以用 `Promise.all` 并行，但不要把有顺序依赖的写操作并行化。
- 缓存应放在应用自身状态、Host 配置服务或明确的业务存储里，不要假设存在通用 `storage API`。
- 不要在页面侧保存敏感凭证；需要凭证治理时使用 Host 凭证服务。
- 所有用户输入在发送到 Bridge 前先做业务校验。
- 组件卸载、surface 关闭或插件停用时，应取消事件订阅、释放资源 URL、停止定时器并清理本地 handler。

## 10. 调试与测试

- 应用单元测试优先使用 `chips-sdk/testing` 的 mock Host 与 mock client。
- 组件库 Provider 场景可使用组件库测试环境注入 mock client。
- 需要验证真实 route 时，运行目标项目的正式 `npm test`、`npm run validate`、`chipsdev-r run`、`chipsdev-r package` 等脚本。
- TypeScript 项目优先从 `chips-sdk` 消费公开类型；生态内部需要低层 Bridge 类型时，以 Host `packages/bridge-api` 当前 `ChipsBridge` 形状为准。
