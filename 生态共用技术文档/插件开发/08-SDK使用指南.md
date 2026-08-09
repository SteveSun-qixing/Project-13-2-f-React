# SDK使用指南

## 概述

薯片 SDK 当前主要面向两类场景：

- 薯片主机内部应用插件；
- 生态内部工具链与开发命令行。

SDK 提供程序化接口访问生态核心能力，包括文件操作、内容渲染、插件管理、模块能力调用与主题能力。

> 架构归属声明（2026-03-06）：Host 主责 L1-L9 运行时链路（含 Runtime Client 与渲染层）；SDK 仅提供开发封装与调用入口，不承载运行时主实现。

## 安装

生态一方仓库统一通过根工作区安装 SDK：

```bash
cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f
npm install
```

随后在一方工程中直接声明正式 semver 依赖（例如 `^0.1.0`），由生态根工作区自动链接到本地 `chips-sdk` 工作区包。

脚手架模板中的默认依赖同样保持 semver 版本范围；当工程创建在生态根工作区内时，`chipsdev-r create` 只负责把新工程注册进根工作区，不再写入 `file:` 或其他临时依赖。

安装后导入SDK模块。ES Module导入方式使用 `import * as Chips from "chips-sdk"`。CommonJS 导入方式使用 `const Chips = require("chips-sdk")`。

## 开发工作区与用户工作区

与 SDK 配套的正式命令是 `chipsdev-r`。本轮实现后，开发态插件与主题调试必须明确区分两类工作区：

- `chips` 管理用户工作区 `~/.chips-host`
- `chipsdev-r` 管理开发工作区 `.chips-host-dev`

如果你在开发态需要安装插件、启用主题、切换主题或检查 Host 状态，应优先使用 `chipsdev-r plugin.* / theme.* / status / doctor`，不要手工改写开发工作区文件。

## 初始化

使用 SDK 前创建客户端实例。SDK 当前不通过服务器地址或认证信息建立连接；它只选择一个可用 transport：

1. 显式传入 `transport` 时，SDK 使用该自定义 transport；
2. 未传入 `transport` 且运行在 Host 插件环境时，SDK 自动使用 `window.chips` Bridge；
3. 普通 `node/browser` 环境没有 `transport` 且没有 `window.chips` 时，实际调用会抛出 `BRIDGE_UNAVAILABLE` 标准错误。

客户端实例是 SDK 的核心入口，通过实例调用各种 domain API：

```ts
import { createClient } from "chips-sdk";

const client = createClient({
  environment: "auto",
  timeoutMs: 5_000,
  retries: 1,
});
```

当前正式配置项：

```ts
interface ClientConfig {
  environment?: "auto" | "plugin" | "browser" | "node";
  transport?: (action: string, payload: unknown) => Promise<unknown>;
  bridgeScope?: { token: string };
  timeoutMs?: number;
  retries?: 0 | 1 | 2 | 3;
  logger?: SdkLogger;
}
```

说明：

- `bridgeScope` 只用于模块插件等受控嵌入式运行时访问 scoped Bridge；普通应用插件默认不使用。
- SDK 会解包常见 Host route envelope，例如 `surface.open -> surface`、`platform.getInfo -> info`、`file.stat -> meta`。
- SDK 会归一 Host / Bridge 标准错误，并保留 `messageKey / requestId / traceId / permission`。
- `timeoutMs` 是 SDK 侧调用超时；Host route 自身仍有 route manifest 中的正式超时。
- `retries` 只对 `retryable === true` 的错误生效；权限错误不会自动重试。

React 应用应把 SDK client 注入组件库环境 Provider，而不是在每个页面里重复手写 Host 接线：

```tsx
import { createClient } from "chips-sdk";
import {
  ChipsEnvironmentProvider,
  useChipsTheme,
  useChipsI18n,
  useChipsSurface,
} from "@chips/component-library";

const client = createClient();

export function AppRoot() {
  return (
    <ChipsEnvironmentProvider client={client}>
      <App />
    </ChipsEnvironmentProvider>
  );
}

function App() {
  const theme = useChipsTheme();
  const i18n = useChipsI18n();
  const surface = useChipsSurface();
  // 使用 theme.theme / i18n.t / surface.surface 渲染业务 UI
}
```

说明：

- `chips-sdk` 仍只提供纯 TypeScript client 与 Domain API；
- React hooks 位于 `@chips/hooks`，并由 `@chips/component-library` 聚合导出；
- hooks 只消费注入的 SDK client，不承载 Host runtime 主实现；
- 单元测试优先使用 `chips-sdk/testing` 的 Host 模拟器与 mock client；组件库 Provider 场景可继续使用 `@chips/testing` 的 `createMockChipsEnvironment` 做 React 注入适配。

## 测试辅助入口

SDK 正式提供 `chips-sdk/testing` 子入口，用于应用插件、脚手架生成工程、组件库 hook 测试和生态工具的单元测试。该入口只模拟公开 Bridge action、事件与标准错误形态，不承载 Host 运行时主实现。

常用导出：

```typescript
import {
  createMockChipsHost,
  createMockChipsClient,
  createMockLaunchContext,
  createMockSurfaceContext,
  createMockPermissionDeniedError,
} from "chips-sdk/testing";
```

使用方式：

```typescript
const client = createMockChipsClient();

await client.theme.apply("chips-official.default-dark-theme");
await client.command.register({
  commandId: "chips.app.demo.show-welcome",
  titleKey: "demo.commands.showWelcome.title",
  handlerId: "show-welcome",
});

expect(client.calls.map((call) => call.action)).toContain("command.register");

client.restoreBridge();
```

边界：

- `createMockChipsClient()` 默认安装测试用 `window.chips`，因此 `client.platform.getLaunchContext()` 会走与 preload Bridge 同形的读取路径；
- 只需要测试 SDK timeout / retry 时，可传入 `installBridge: false`，此时 client 使用 mock host 的 custom transport；
- `createMockChipsHost()` 可直接控制 `transport`、事件总线、调用记录、状态、延迟、故障与权限拒绝；
- 权限拒绝应使用 `setPermissionDenied(...)` 或 `createMockPermissionDeniedError(...)`，保持 `permission.required/granted/messageKey` 等标准诊断字段；
- 测试结束后应调用 `client.restoreBridge()` 或保存 `host.installBridge()` 返回的 restore 函数，避免污染同进程其他测试。

## 文件操作

SDK提供卡片文件的读写能力。

系统对话框通过 `client.platform` 正式提供，不要求应用插件自行拼接 `invoke("platform.dialog*")`：

```typescript
client.platform.openFile({
  title: "选择卡片",
  mode: "file-or-directory",
  allowMultiple: false,
  filters: [
    { name: "卡片文件", extensions: ["card"] },
  ],
});

client.platform.saveFile({
  title: "保存 .card 文件",
  defaultPath: "/workspace/demo-export.card",
});

client.platform.showMessage({
  title: "导出完成",
  message: "卡片已导出。",
});

client.platform.showConfirm({
  title: "覆盖确认",
  message: "目标文件已存在，是否继续？",
});
```

说明：

- `client.platform.openFile(...)` 对应 Host `platform.dialogOpenFile`；
- `client.platform.saveFile(...)` 对应 Host `platform.dialogSaveFile`；
- `client.platform.showMessage(...)` 对应 Host `platform.dialogShowMessage`；
- `client.platform.showConfirm(...)` 对应 Host `platform.dialogShowConfirm`；
- `defaultPath` 是系统对话框的初始建议路径，不是自动确认结果；Host 仍会弹出正式对话框，用户取消时返回 `null`；
- `openFile.filters` 使用 `{ name, extensions }` 描述扩展名过滤器，`extensions` 不写点号，例如 `["card", "box", "cpk"]`；
- `openFile.mode` 支持 `file / directory / file-or-directory`，`allowMultiple` 表示是否允许多选；需要同时支持多类插件包时，应通过 `filters` 扩展名列表表达，而不是在应用层裸调 Host action；
- 应用层应优先调用这些 SDK 正式封装，而不是在业务组件中散落 `client.invoke("platform.dialog*")` 私有调用。

打包目录态卡片使用 `client.card.pack()` 方法，传入卡片目录与输出文件路径。方法签名：

```typescript
client.card.pack(cardDir: string, outputPath: string): Promise<string>
```

解包正式 `.card` 文件使用 `client.card.unpack()` 方法。方法签名：

```typescript
client.card.unpack(cardFile: string, outputDir: string): Promise<void>
```

快速读取卡片元数据使用 `client.card.readMetadata()` 方法，无需先手动解包。方法签名：

```typescript
client.card.readMetadata(cardFile: string): Promise<Record<string, unknown>>
```

解析卡片使用 `client.card.parse()` 方法，传入卡片文件路径。SDK 会把 Host `card.parse` 的 `{ ast }` 响应解包为卡片对象。方法签名：

```typescript
client.card.parse(cardFile: string): Promise<CardDocument>
```

验证卡片使用 `client.card.validate()` 方法，传入卡片文件路径，验证卡片结构是否符合规范。方法签名：

```typescript
client.card.validate(cardFile: string): Promise<ValidationResult>
```

当应用需要把 Host 托管渲染文档 URL 映射回实际文档路径时，使用 `client.card.resolveDocumentPath()`。该接口直接映射 `card.resolveDocumentPath`，SDK 会把 `{ path }` 响应解包为路径字符串：

```typescript
client.card.resolveDocumentPath(documentUrl: string): Promise<string>
```

渲染卡片使用 `client.card.render()` 方法，传入卡片文件路径。返回渲染后的视图对象。方法签名：

```typescript
client.card.render(cardFile: string, options?: RenderOptions): Promise<CardView>
```

> 注意：旧版 `cards.read`、`cards.create`、`cards.update`、`cards.delete` 方法已归档，请使用 `card.pack/unpack/readMetadata/parse/render/validate` 接口。

### `client.file.read(path, { encoding: "binary" })`

推荐用法：

```typescript
const bytes = await client.file.read("/tmp/demo-cover.png", { encoding: "binary" });
```

返回结构：

```typescript
Uint8Array
```

使用语义：

- `client.file.read(..., { encoding: "binary" })` 对调用方的正式语义始终是“返回裸二进制字节”；
- 若 Host / Bridge 因传输序列化返回 `latin1` 字节串、Base64 字符串、`Buffer` JSON、`ArrayBuffer` 或其他 TypedArray，SDK 会在内部统一归一为 `Uint8Array`；
- 调用方不应在业务层自行兼容 `.content.data`、`{ type: "Buffer" }` 等中间包装形状；
- 该接口适用于编辑器链路中的资源转码结果读取、图片头判断、音频元数据解析等需要稳定字节数组的场景。

### `client.file.stat(...)` 与 `client.file.list(...)`

SDK 会把 Host `file.stat` 的 `{ meta }` 与 `file.list` 的 `{ entries }` 路由响应解包后返回：

```typescript
client.file.stat(path: string): Promise<FileStat>
client.file.list(dir: string, options?: FileListOptions): Promise<FileEntry[]>
```

调用方只消费 `FileStat` 与 `FileEntry[]`，不得在业务层依赖 `{ meta }` 或 `{ entries }` 这类 Host 路由 envelope。

### `client.file.watch(...)`

SDK 提供一次性文件变化等待封装，直接映射 Host `file.watch`：

```typescript
client.file.watch(path: string, options?: { timeoutMs?: number }): Promise<FileWatchEvent | null>
```

使用语义：

- 返回值为首个文件变化事件，或超时后的 `null`；
- Host 返回 `{ event }`，SDK 对调用方解包为 `FileWatchEvent | null`；
- 该接口用于开发工具、预览刷新、轻量监听等场景；长期订阅型监听仍应优先由 Host 事件或专用运行时能力承载。

### `client.file.write(...)`

`client.file.write(...)`、`mkdir/delete/move/copy` 等写操作对调用方保持 `Promise<void>`。Host `{ ack: true }` 只表示路由确认，业务代码不得依赖该 envelope。

## 平台系统能力

SDK 的 `client.platform` 对 Host `platform.*` 系统能力提供正式封装，应用插件不应在业务代码中散落 `client.invoke("platform.*")` 私有调用。

当前封装包括：

```typescript
client.platform.getInfo(): Promise<PlatformInfo>
client.platform.getCapabilities(): Promise<PlatformCapabilitySnapshot>
client.platform.getScreenInfo(): Promise<PlatformScreenInfo>
client.platform.listScreens(): Promise<PlatformScreenInfo[]>
client.platform.powerGetState(): Promise<PlatformPowerState>
client.platform.powerSetPreventSleep(prevent: boolean): Promise<boolean>
client.platform.openExternal(url: string): Promise<void>
client.platform.renderHtmlToPdf(request: PlatformRenderHtmlToPdfRequest): Promise<PlatformRenderHtmlToPdfResult>
client.platform.renderHtmlToImage(request: PlatformRenderHtmlToImageRequest): Promise<PlatformRenderHtmlToImageResult>
client.platform.clipboardRead(format?: "text" | "image" | "files"): Promise<PlatformClipboardPayload>
client.platform.clipboardWrite(data: PlatformClipboardPayload, format?: "text" | "image" | "files"): Promise<void>
client.platform.openFile(options?: PlatformDialogFileOptions): Promise<string[] | null>
client.platform.saveFile(options?: PlatformDialogSaveOptions): Promise<string | null>
client.platform.showMessage(options: PlatformDialogMessageOptions): Promise<number>
client.platform.showConfirm(options: PlatformDialogMessageOptions): Promise<boolean>
client.platform.shellOpenPath(path: string): Promise<void>
client.platform.shellOpenExternal(url: string): Promise<void>
client.platform.shellShowItemInFolder(path: string): Promise<void>
client.platform.notificationShow(options: PlatformNotificationOptions): Promise<void>
client.platform.traySet(options?: PlatformTrayOptions): Promise<PlatformTrayState>
client.platform.trayClear(): Promise<void>
client.platform.trayGetState(): Promise<PlatformTrayState>
client.platform.shortcutRegister(accelerator: string, options?: { eventName?: string }): Promise<boolean>
client.platform.shortcutUnregister(accelerator: string): Promise<void>
client.platform.shortcutIsRegistered(accelerator: string): Promise<boolean>
client.platform.shortcutList(): Promise<string[]>
client.platform.shortcutClear(): Promise<void>
client.platform.ipcCreateChannel(options: PlatformIpcCreateOptions): Promise<PlatformIpcChannelInfo>
client.platform.ipcSend(channelId: string, payload: string, options?: { encoding?: "utf8" | "base64" }): Promise<void>
client.platform.ipcReceive(channelId: string, options?: { timeoutMs?: number }): Promise<PlatformIpcMessage>
client.platform.ipcCloseChannel(channelId: string): Promise<void>
client.platform.ipcListChannels(): Promise<PlatformIpcChannelInfo[]>
client.platform.getPathForFile(file: unknown): string
client.platform.getLaunchContext(): PlatformLaunchContext
```

使用边界：

- `getInfo / getCapabilities / getScreenInfo / listScreens / power* / renderHtml*` 通过 Host `platform.*` route 返回 route envelope，SDK 对调用方解包为直接业务值；
- `getLaunchContext()` 与 `getPathForFile(file)` 是 preload 页面辅助入口，不是 Host route manifest 中的 `platform.*` route；
- `renderHtmlToPdf` 与 `renderHtmlToImage` 需要 `platform.read / file.read / file.write`；
- `openExternal`、shell 和 transfer 类能力应在业务层做好来源校验和用户确认；
- `notificationShow(options.icon)`、`traySet(options.icon)` 使用操作系统壳层图标路径或宿主原生可解析资源，不接收运行时 `IconDescriptor`；
- `shortcutRegister` 默认触发 `platform.shortcut.triggered` 事件，也可以传入自定义 `eventName`；
- IPC payload 使用字符串传输，`encoding` 只允许 `utf8 | base64`；
- `platform.shortcut*` 是系统全局快捷键链路，应用菜单、工具栏和 surface 内快捷键应优先使用 `client.command.*`。

## 资源打开路由

SDK 提供统一资源 API，直接映射 Host `resource.*` 服务动作。

### `client.resource.resolve(...)`

推荐用法：

```typescript
const coverUri = await client.resource.resolve("chips-render://card-root/session-1/assets/cover.png");
```

返回结构：

```typescript
{
  uri: string;
}
```

使用语义：

- `client.resource.resolve(...)` 支持本地文件路径、`file://` 本地资源，以及 Host 托管文档 URL，例如卡片/箱子查看链路中的 `chips-render://...`；
- 当输入最终可落到本地文件时，Host 返回正式 `file://` 编码结果；
- 若输入本身就是外部 URL 或其他无需落盘改写的正式资源标识，Host 保持原 URI 语义，不得把它错误改写成伪本地路径。

### `client.resource.readBinary(...)`

推荐用法：

```typescript
const bytes = await client.resource.readBinary("/tmp/demo.mp3");
```

返回结构：

```typescript
ArrayBuffer
```

使用语义：

- `client.resource.readBinary(...)` 支持本地文件路径、`file://` 本地资源，以及 Host 托管文档 URL，例如 `chips-render://...`；
- `client.resource.readBinary(...)` 对调用方的正式语义始终是“返回裸二进制字节”；
- 若 Host / Bridge 运行时内部经过 `Buffer` 包装，或在桥接序列化后退化为 `{ data: { type: "Buffer", data: number[] } }`，SDK 会在内部统一解包，再向业务层返回 `ArrayBuffer`；
- 调用方不得把 `.data` 包装对象当作公共契约，也不应在业务层自行兼容多种返回形状；
- 该接口适用于音频元数据解析、图片字节读取、自定义资源解析等需要原始字节的场景。

### `client.resource.readMetadata(...)`

推荐用法：

```typescript
const metadata = await client.resource.readMetadata("/tmp/demo.mp3");
```

使用语义：

- SDK 会把 Host `resource.readMetadata` 的 `{ metadata }` 响应解包为 `ResourceMeta`；
- 对本地文件与 `file://` 资源，当前 metadata 至少可包含 `size / isFile / isDirectory / mtimeMs` 等文件统计信息；
- 调用方不得在业务层依赖 `{ metadata }` 路由 envelope。

### `client.resource.open(...)`

推荐用法：

```typescript
const result = await client.resource.open({
  intent: "view",
  resource: {
    resourceId: "chips-render://card-root/session-1/assets/cover.png",
    mimeType: "image/png",
    title: "封面图",
    fileName: "cover.png",
    payload: {
      kind: "chips.music-card",
      version: "1.0.0",
    },
  },
});
```

返回结构：

```typescript
{
  mode: "plugin" | "shell" | "external";
  pluginId?: string;
  windowId?: string;
  matchedCapability?: string;
  resolved: {
    resourceId: string;
    filePath?: string;
    mimeType?: string;
    extension?: string;
    fileName?: string;
  };
}
```

使用语义：

- `client.resource.open(...)` 是跨应用资源打开的正式入口；
- SDK 调用方不需要也不应该自行查找图片查看器、PDF 查看器等目标应用；
- Host 会优先匹配 `resource-handler:<intent>:<mime>`，再匹配 `file-handler:<ext>`；
- 若没有命中应用处理器，Host 可能回退到系统路径打开或系统外链打开；
- 若需要让目标应用恢复结构化业务上下文，应通过 `resource.payload` 透传；目标应用从 `launchParams.resourceOpen.payload` 读取；
- 该接口要求插件声明 `resource.read` 权限。

### `client.resource.convertTiffToPng(...)`

当调用方拿到的是本地 TIFF 资源，但后续链路只接受 PNG 文件时，应调用正式资源转换接口：

```typescript
const result = await client.resource.convertTiffToPng({
  resourceId: "/tmp/album-cover.tiff",
  outputFile: "/tmp/album-cover.png",
  overwrite: true,
});
```

返回结构：

```typescript
{
  outputFile: string;
  mimeType: "image/png";
  sourceMimeType: "image/tiff";
  width?: number;
  height?: number;
}
```

使用语义：

- 输入只支持本地文件路径或 `file://` 本地资源；
- Host 会校验源文件确实是 TIFF，再交由正式宿主能力完成 PNG 落盘；
- 该接口适用于专辑封面提取、图片查看链路归一化、资源入库前预处理等场景；
- 该接口要求调用方具备 `resource.read`、`file.read`、`file.write` 权限。

### 资源处理器应用的启动恢复

如果当前应用自身就是资源处理器，应从正式启动上下文读取：

```typescript
const launchContext = client.platform.getLaunchContext();
const resourceOpen = launchContext.launchParams.resourceOpen;
const targetPath = launchContext.launchParams.targetPath;
```

正式建议：

- `getLaunchContext()` 当前会归一 `pluginId / sessionId / sceneId / surfaceId / kind / presentation / surfaceContext / launchParams`；
- `surfaceContext` 是 App / Scene / surface 运行模型的正式上下文，包含 `sceneId / surfaceId / pluginId / sessionId / kind / presentation / launchParams / documentContext / commandContext`；
- 优先读取 `launchParams.resourceOpen`；
- 在文件查看器类场景下，可继续把 `targetPath` 作为兼容回退；
- 不要要求上游应用显式传递自己的插件 ID。

## 内容渲染

SDK提供 Host 渲染能力的调用封装。

渲染卡片通过 `client.render.card` 或统一显示窗口接口触发 Host 内置渲染运行时。SDK 不直接承载渲染引擎主实现。

模板策略由 Host 渲染运行时统一管理，SDK 只负责参数封装与调用链路。

### card.render（统一渲染入口）推荐封装

SDK 直接封装 Host `card.render`，推荐签名为：

```typescript
client.card.render(
  cardFile: string,
  options?: {
    target?: 'app-root' | 'card-iframe' | 'module-slot' | 'offscreen-render';
    viewport?: { width?: number; height?: number; scrollTop?: number; scrollLeft?: number };
    verifyConsistency?: boolean;
    themeId?: string;
    locale?: string;
  }
): Promise<{
  view: {
    title: string;
    body: string;
    contentFiles: string[];
    target: string;
    semanticHash: string;
    diagnostics?: Array<{
      nodeId: string;
      stage: string;
      code: string;
      message: string;
      details?: unknown;
    }>;
    consistency?: {
      consistent: boolean;
      hashByTarget: Record<string, string>;
      mismatches: string[];
    };
  };
}>
```

补充说明：

- `themeId` 与 `locale` 是单次调用级覆盖参数，不会修改 Host 当前全局主题或全局语言；
- 转换链路中的 `card -> html` 应直接把请求中的 `themeId/locale` 透传给该接口。

说明：

- `target` 默认建议为 `card-iframe`。
- `verifyConsistency=true` 适用于测试/验收环境，不建议默认在生产场景全量开启。
- `semanticHash` 可用于跨目标渲染一致性对比与缓存键管理。
- SDK 调用前应做参数预校验；若透传到 Host 后触发 schema 校验失败，错误码为 `SCHEMA_VALIDATION_FAILED`。

### 统一文档显示窗口（正式推荐入口）

在需要“打开一个文档文件，不希望上层应用自己区分卡片还是箱子”时，优先使用统一文档窗口接口：

```typescript
client.document.window.render({
  filePath: string,
  documentType?: 'card' | 'box',
  mode?: 'view' | 'preview',
  interactionPolicy?: 'native' | 'delegate',
  layoutType?: string,
  locale?: string,
  themeId?: string,
}): Promise<IframeWindow & {
  documentType: 'card' | 'box'
}>
```

说明：

- `filePath` 是正式文档文件路径，当前支持 `.card` 与 `.box`；
- 未传 `documentType` 时，SDK 会根据文件扩展名识别类型；
- 当识别为 `.card` 时，SDK 内部委托 `client.card.compositeWindow.render(...)`；
- 当识别为 `.box` 时，SDK 内部委托 `client.box.documentWindow.render(...)`；
- 上层应用不再自己区分箱子布局插件装载、布局配置归一、查看会话创建或 iframe 事件桥接；
- `client.document.window.onReady/onError/onResourceOpen` 统一覆盖卡片与箱子文档窗口；
- `client.document.window.onNodeError` 仅用于卡片复合窗口的非致命节点降级诊断，载荷会补充 `documentType: 'card'`。应用可记录或展示诊断，但不得把单节点失败当作整张文档 fatal；整张卡片严重失败仍由 `onError` 消费 `chips.composite:fatal-error`。

示例：

```typescript
const result = await client.document.window.render({
  filePath: '/workspace/demo.box',
  locale: 'zh-CN',
});

const disposeReady = client.document.window.onReady(result.frame, () => {
  console.log(result.documentType);
});

const disposeNodeError = client.document.window.onNodeError(result.frame, (payload) => {
  console.warn(payload.documentType, payload.nodeId, payload.code);
});
```

### 卡片显示窗口（卡片专用入口）

在需要展示卡片的应用中，统一使用 SDK 显示窗口接口：

```typescript
client.card.coverFrame.render({
  cardFile: string
}): Promise<IframeWindow & {
  title: string,
  ratio?: string
}>

client.card.compositeWindow.render({
  cardFile: string,
  mode?: 'view' | 'preview',
  interactionPolicy?: 'native' | 'delegate'
}): Promise<IframeWindow>

client.card.editorPanel.render({
  cardType: string,
  initialConfig?: Record<string, unknown>,
  baseCardId?: string,
  resources?: {
    rootPath?: string,
    resolveResourceUrl?(resourcePath: string): Promise<string> | string,
    releaseResourceUrl?(resourcePath: string): Promise<void> | void,
    importResource?(input: { file: File, preferredPath?: string }): Promise<{ path: string }> | { path: string },
    importArchiveBundle?(
      input: {
        file: File,
        preferredRootDir?: string,
        entryFile?: string,
        include?: { mimeTypes?: string[], extensions?: string[] },
        stripSingleRootDir?: boolean,
        excludeSystemArtifacts?: boolean,
      }
    ): Promise<{
      rootDir: string,
      entryFile?: string,
      resourcePaths: string[],
      entries: Array<{
        sourcePath: string,
        resourcePath: string,
        fileName: string,
        mimeType?: string,
        size: number,
        compressedSize: number,
        crc32: number,
        offset: number,
        isDirectory: boolean,
        compressionMethod: number,
        modifiedTime?: number,
      }>,
      discardedEntries: Array<{
        sourcePath: string,
        reason: 'directory' | 'system-artifact' | 'filter-mismatch' | 'unsafe-path',
        fileName?: string,
        mimeType?: string,
      }>,
    }> | {
      rootDir: string,
      entryFile?: string,
      resourcePaths: string[],
      entries: Array<{
        sourcePath: string,
        resourcePath: string,
        fileName: string,
        mimeType?: string,
        size: number,
        compressedSize: number,
        crc32: number,
        offset: number,
        isDirectory: boolean,
        compressionMethod: number,
        modifiedTime?: number,
      }>,
      discardedEntries: Array<{
        sourcePath: string,
        reason: 'directory' | 'system-artifact' | 'filter-mismatch' | 'unsafe-path',
        fileName?: string,
        mimeType?: string,
      }>,
    },
    deleteResource?(resourcePath: string): Promise<void> | void,
    convertTiffToPng?(
      input: { resourcePath: string, outputPath: string, overwrite?: boolean }
    ): Promise<{
      path: string,
      mimeType: "image/png",
      sourceMimeType: "image/tiff",
      width?: number,
      height?: number,
    }> | {
      path: string,
      mimeType: "image/png",
      sourceMimeType: "image/tiff",
      width?: number,
      height?: number,
    }
  }
}): Promise<IframeWindow>
```

说明：

- `resources.readBoxAsset` 和布局查看运行时中的 `readBoxAsset` 一样，返回的是 Host 托管的资源入口；Electron 桌面端可使用 `chips-render://...` 等受控协议地址，插件应直接消费返回的 `resourceUrl`，不得把它转换为 `file://` 或写入布局配置。

说明：

- `coverFrame` 返回卡片封面 iframe，并同时返回 `title/ratio` 元信息；标题、副文案、角标和操作按钮由应用层自行布局。
- `compositeWindow` 返回复合卡片 iframe 窗口。
- `compositeWindow.mode` 只允许 `view | preview`。
- `compositeWindow.interactionPolicy` 只允许 `native | delegate`，默认应保持 `native`。
- `compositeWindow.mode = 'preview'` 时，可通过事件订阅接收基础卡片节点选中事件。
- `compositeWindow` 可通过 `onResize` 订阅整张复合卡片当前总高度，正式用于查看器、自适应容器以及仍选择 Host 托管复合 iframe 的场景。
- `compositeWindow.interactionPolicy = 'delegate'` 时，可通过 `onInteraction` 订阅复合卡片内部滚轮、触摸滚动和捏合缩放意图，正式用于无限画布等需要外层壳层接管桌面交互的场景。
- `editorPanel` 返回基础卡片编辑器 iframe，正式用于第三方宿主、调试工具和仍需 Host 托管编辑器 iframe 的场景。
- `editorPanel.resources` 是 SDK 本地资源桥配置，不会进入 `card.renderEditor` 正式路由负载。
- `coverFrame/compositeWindow/editorPanel` 返回的 iframe URL 都是 Host 托管的正式文档入口；调用方不得假定它们一定是 `file://`，只应把它们视为可直接挂载的独立文档 URL。
- 基础卡片分发、模板编译、iframe 拼接由 Host 内置渲染运行时完成；SDK 仅封装调用入口。

### 箱子布局查看与编辑（箱子专用入口）

当应用已经明确当前文档是箱子，或需要显式控制箱子布局相关参数时，使用 `client.box.*`。

布局描述符与配置辅助接口：

```typescript
client.box.listLayoutDescriptors(): Promise<BoxLayoutDescriptor[]>
client.box.readLayoutDescriptor(layoutType: string): Promise<BoxLayoutDescriptor>
client.box.normalizeLayoutConfig(
  layoutType: string,
  config: Record<string, unknown>,
): Promise<Record<string, unknown>>
client.box.validateLayoutConfig(
  layoutType: string,
  config: Record<string, unknown>,
): Promise<{
  valid: boolean,
  errors: Record<string, string>,
}>
client.box.getLayoutInitialQuery(
  layoutType: string,
  config: Record<string, unknown>,
): Promise<BoxEntryQuery | undefined>
client.box.releaseRenderSession(sessionId: string): Promise<void>
```

说明：

- 这些接口统一由 Host `box-service` 实现，SDK 只做类型化封装；
- 上层应用不得自己读取 `plugin.query(...) + installPath + entry` 后直接 import 布局插件；
- 布局配置默认值、归一和校验以布局插件自身导出为准，但调用链路必须经过 Host。

箱子查看文档接口：

```typescript
client.box.documentWindow.render({
  boxFile: string,
  layoutType?: string,
  locale?: string,
  themeId?: string,
}): Promise<IframeWindow>
```

说明：

- SDK 内部会依次调用 Host `box.inspect -> box.readLayoutDescriptor -> box.normalizeLayoutConfig -> box.getLayoutInitialQuery -> box.openView -> box.renderLayoutFrame`；
- Host 负责装载布局插件、创建查看会话和生成正式布局文档；
- Host 托管的布局查看文档必须已注入完整主题 CSS、Material Symbols `@font-face` 与解析后的 token variables；SDK 和应用层不自行注入图标字体，也不拼接主题字体路径；
- `documentWindow` 返回的 iframe URL 是 Host 托管的正式文档入口，Electron 桌面端可使用 `chips-render://...` 等受控协议地址；应用层不得假定它一定是 `file://`，也不得绕过 Host 自行读取临时布局文档；
- SDK 负责挂载 iframe，并桥接 `chips.box-layout:*` 运行时消息；
- 销毁返回的 iframe 时，正式链路需要同时关闭 `box.openView` 创建的查看会话并释放 `box.renderLayoutFrame` 创建的 render session；SDK 返回的 `dispose()` 已封装该流程。

箱子编辑器面板接口：

```typescript
client.box.editorPanel.render({
  layoutType: string,
  entries: BoxEntrySnapshot[],
  initialConfig?: Record<string, unknown>,
  locale?: string,
  themeId?: string,
  resources?: {
    rootPath?: string,
    readBoxAsset?(assetPath: string): Promise<ResolvedRuntimeResource> | ResolvedRuntimeResource,
    importBoxAsset?(
      input: { file: File, preferredPath?: string }
    ): Promise<{ assetPath: string }> | { assetPath: string },
    deleteBoxAsset?(assetPath: string): Promise<void> | void,
  }
}): Promise<IframeWindow>
```

说明：

- `editorPanel` 走 `Host box.renderLayoutEditor`，由 Host 使用正式布局插件入口执行 `layoutDefinition.renderEditor`；
- `resources` 是 SDK 本地资源桥配置，不进入 Host 正式动作负载；
- 编辑器文档通过 `chips.box-layout-editor:change/error` 协议回传配置和错误，通过 `chips.box-layout-editor:asset-request` 申请箱子资源操作；
- 典型宿主应在收到 `onChange` 后，再调用 `client.box.normalizeLayoutConfig(...)`，然后持久化到正式 `.box` 工作目录。

推荐事件订阅接口：

```typescript
const result = await client.box.editorPanel.render({
  layoutType: 'chips.layout.grid',
  entries: [],
  initialConfig: {},
});

const disposeReady = client.box.editorPanel.onReady(result.frame, () => {
  console.log('layout editor ready');
});

const disposeChange = client.box.editorPanel.onChange(result.frame, (payload) => {
  console.log(payload.layoutType, payload.config);
});

const disposeError = client.box.editorPanel.onError(result.frame, (payload) => {
  console.error(payload.code, payload.message);
});
```

`editorPanel.resources` 规则：

- `resourcePath` 一律使用相对于卡片根目录的路径；
- 只读场景可只传 `rootPath`，SDK 会用它为 `resolveResourceUrl` 生成 `file://` URL；
- `resolveResourceUrl(...)` 返回的是正式运行时资源 URL；若编辑器需要读取 Markdown、纯文本、JSON 等正文内容，应由编辑器自己基于该 URL 读取并解析，而不是依赖富文本专用正文读取接口；
- 对 `file://` 资源，请求方应通过正式文件服务读取正文；对 `blob:` 或 Host 受控协议 URL，请求方可按对应协议自行读取；
- 若编辑器支持导入或删除卡片内部资源，宿主必须实现 `importResource/deleteResource`；
- 若宿主返回 `blob:` URL，应负责在适当时机响应 `releaseResourceUrl` 释放临时资源。

适用边界补充：

- `compositeWindow + editorPanel` 仍是生态对外公开的通用 SDK 接口；
- 官方 `Chips-EditingEngine` 的编辑态正式链路不再以这两个接口作为主路径，而是改用本地基础卡片运行时；
- 若不是官方编辑引擎，不得据此复制第二套本地运行时。

复合卡片预览模式推荐事件订阅接口：

```typescript
const preview = await client.card.compositeWindow.render({
  cardFile: '/workspace/demo.card',
  mode: 'preview',
  interactionPolicy: 'delegate',
});

const disposeResize = client.card.compositeWindow.onResize(preview.frame, (payload) => {
  console.log(payload.height, payload.reason);
});

const disposeNodeSelect = client.card.compositeWindow.onNodeSelect(preview.frame, (payload) => {
  console.log(payload.nodeId, payload.cardType, payload.pluginId);
});

const disposeInteraction = client.card.compositeWindow.onInteraction(preview.frame, (payload) => {
  console.log(payload.intent, payload.deltaX, payload.deltaY, payload.zoomDelta);
});
```

如果复合卡片内部某个基础卡片节点希望“让外层应用帮它打开资源”，可以订阅：

```typescript
const disposeResourceOpen = client.card.compositeWindow.onResourceOpen(preview.frame, async (payload) => {
  await client.resource.open({
    intent: payload.intent,
    resource: {
      resourceId: payload.resourceId,
      mimeType: payload.mimeType,
      title: payload.title,
      fileName: payload.fileName,
    },
  });
});
```

`onInteraction` 载荷说明：

- `intent = 'scroll'`：表示复合卡片内部发生了需要由外层壳层消费的滚动意图；
- `intent = 'zoom'`：表示复合卡片内部发生了捏合或等价缩放意图；
- `source` 用于区分事件来自基础卡片 iframe、复合壳层还是降级节点；
- `clientX/clientY` 是相对于复合 iframe 视口的坐标，应用若要把缩放锚定到外层桌面坐标，应先加上外层 iframe 自身的 `getBoundingClientRect().left/top`。

`onResourceOpen` 载荷说明：

- `intent`：当前资源打开意图；
- `resourceId`：基础卡片希望外层容器打开的正式资源标识；
- `mimeType/title/fileName`：可选提示字段；
- `nodeId/cardType/pluginId`：用于日志、审计与问题诊断。

### 基础卡片编辑器面板

Host 托管编辑器链路如下：

1. 应用确定当前基础卡片 `cardType/baseCardId/config`；
2. 调用 `client.card.editorPanel.render(...)`；
3. Host 路由到对应基础卡片插件的 `renderBasecardEditor`；
4. Host 返回完整编辑器文档并由 SDK 封装为 iframe；
5. 若应用传入 `resources`，SDK 负责在本地桥接编辑器 iframe 的资源请求；
6. 应用通过事件订阅接收编辑器状态与配置变更。

推荐事件订阅接口：

```typescript
const result = await client.card.editorPanel.render({
  cardType: 'RichTextCard',
  baseCardId: 'base-1',
  initialConfig: {
    card_type: 'RichTextCard',
    content_format: 'markdown',
    content_source: 'inline',
    content_text: 'Hello **World**',
    locale: 'zh-CN',
  },
});

const disposeReady = client.card.editorPanel.onReady(result.frame, () => {
  console.log('editor ready');
});

const disposeChange = client.card.editorPanel.onChange(result.frame, (payload) => {
  console.log(payload.baseCardId, payload.config);
});

const disposeError = client.card.editorPanel.onError(result.frame, (payload) => {
  console.error(payload.code, payload.message);
});
```

富文本基础卡片约束补充：

- `initialConfig` 必须使用 RichTextCard 的正式 Markdown 配置字段；
- 运行时会根据正文纯文本字符数决定最终保存到 `content_text` 或 `content_file`；
- 悬浮工具框由插件运行时控制，不需要也不能通过 SDK 传入工具栏配置。

资源型编辑器示例：

```typescript
const result = await client.card.editorPanel.render({
  cardType: 'base.image',
  baseCardId: 'image-1',
  initialConfig: {
    card_type: 'ImageCard',
    images: [
      {
        id: 'image-1',
        source: 'file',
        file_path: 'cover.png',
        title: '封面图',
        alt: '卡片封面图',
      },
    ],
    layout_type: 'single',
    layout_options: {
      spacing_mode: 'comfortable',
      single_width_percent: 100,
      single_alignment: 'center',
    },
  },
  resources: {
    rootPath: '/workspace/cards/demo',
    async importResource({ file, preferredPath }) {
      return saveIntoCardRoot(file, preferredPath);
    },
    async importArchiveBundle(input) {
      return importArchiveBundleIntoCardRoot(input);
    },
    async deleteResource(resourcePath) {
      await removeFromCardRoot(resourcePath);
    },
    async convertTiffToPng({ resourcePath, outputPath, overwrite }) {
      return convertCardAssetTiffToPng(resourcePath, outputPath, overwrite);
    },
    releaseResourceUrl(resourcePath) {
      releaseBlobUrl(resourcePath);
    },
  },
});
```

资源桥接说明：

- Host 托管编辑器 iframe 通过 `chips.card-editor:resource-request/resource-response/resource-release` 协议请求资源操作；
- SDK 负责把这些请求桥接到 `editorPanel.resources`；
- `importResource(...)` 返回的 `path` 必须是卡片根目录相对路径，例如 `cover.png`；
- `importArchiveBundle(...)` 返回 `{ rootDir, entryFile?, resourcePaths, entries, discardedEntries }`，用于网页基础卡片、电子书图片包和未来资源包卡片这类“整目录导入”的正式场景；
- `importArchiveBundle(...)` 是通用目录解包契约，不包含“网页/图片/电子书”等场景开关；业务需求只能通过 `entryFile`、`include`、`stripSingleRootDir`、`excludeSystemArtifacts` 等通用规则字段表达；
- `entryFile` 表示必须存在的入口文件；网页基础卡片传 `index.html`，宿主据此识别单顶层目录并返回最终入口文件；
- `include.mimeTypes/extensions` 用于条目保留过滤；不匹配的文件进入 `discardedEntries`，不写入最终资源清单；
- `entries` 必须包含每个导入条目的原始 ZIP 路径、最终资源路径、MIME、大小、CRC、压缩方式、目录标记和 `modifiedTime`，供图片包排序与资源审计使用；
- `discardedEntries.reason` 只使用 `directory/system-artifact/filter-mismatch/unsafe-path`；
- 若宿主通过 `client.zip.list(...)` / `client.zip.extract(...)` 实现 `importArchiveBundle(...)`，对应应用插件必须在 `manifest.permissions` 中声明 `zip.manage`；
- 当宿主无法通过 `client.platform.getPathForFile(file)` 拿到所选 ZIP 的真实磁盘路径时，可以先通过正式文件服务把该 `File` 内容写入会话暂存路径，再继续调用 `client.zip.list(...)` / `client.zip.extract(...)`；
- `convertTiffToPng(...)` 适用于音乐基础卡片这类“先提取内嵌封面，再把 TIFF 归一为 PNG”的场景；返回值中的 `path` 必须是卡片根目录相对路径；
- 若 `resources.convertTiffToPng` 未显式提供，但 `resources.rootPath` 与 SDK client 可用，SDK 会自动把 `resourcePath/outputPath` 解析到卡片根目录，再转调正式 Host `resource.convertTiffToPng`；
- 若宿主按官方资源链路保存内部文件，应把文件直接写入卡片根目录，而不是写入 `content/`；
- `resources` 只在当前应用进程内生效，不进入 Host 正式 `card.renderEditor` 路由契约。

## ZIP 能力

SDK 提供正式 ZIP 子域封装，直接映射 Host `zip.*` 路由：

```typescript
const outputZip = await client.zip.compress('/tmp/site', '/tmp/site.zip');
const outputDir = await client.zip.extract('/tmp/site.zip', '/tmp/unpacked-site');
const entries = await client.zip.list('/tmp/site.zip');
```

使用语义：

- `client.zip.compress(...)` 适用于正式 ZIP Store 打包场景；
- `client.zip.extract(...)` 与 `client.zip.list(...)` 可用于基础卡片通用目录导入前的验证与解压；
- `client.zip.list(...)` 返回的每个条目必须包含 `path/size/compressedSize/crc32/offset/isDirectory/compressionMethod`，若 ZIP 中存在有效 DOS 时间则补充 `modifiedTime`；
- 使用 `client.zip.*` 的调用方必须具备 `zip.manage` 权限；
- ZIP 条目路径仍需由调用方按正式文件规则校验，不能把压缩包中的绝对路径或路径穿越条目直接落盘。

约束：

- 应用层不得保留本地默认编辑器作为正式路径兜底；
- 普通应用和第三方宿主不得绕过 SDK/Host 直接 import 基础卡片插件源码；
- 选择 Host 托管复合 iframe 的应用，应优先消费 `client.card.compositeWindow.onNodeSelect(...)` 作为基础卡片选中入口；
- 主题与多语言上下文必须由 Host 注入并沿正式链路进入编辑器 iframe；会渲染 `ChipsIcon` 或组件库主题样式的编辑器 iframe 必须获得完整主题 CSS 与 token variables，不能降级为 token-only 注入。

官方编辑引擎补充：

- 官方编辑引擎的正式编辑态链路改为本地 `EditorHost`；
- 官方编辑引擎的基础卡片预览改为单卡 iframe 拼装；
- 这属于共享文档中正式定义的内部架构，不改变 SDK 对外公开接口。

## 插件管理

SDK 提供插件管理与查询能力，直接映射 Host `plugin.*` 服务动作。

- 列出插件：  
  使用 `client.plugin.list(options?)` 返回已安装插件列表（面向普通插件/应用使用场景）：

  ```typescript
  client.plugin.list(options?: { type?: PluginType; capability?: string }): Promise<PluginInfo[]>;
  ```

- 安装插件：  
  使用 `client.plugin.install(manifestPath)` 安装插件包或插件目录，返回新插件 ID：

  ```typescript
  client.plugin.install(manifestPath: string): Promise<{ pluginId: string }>;
  ```

- 启用 / 禁用插件：  

  ```typescript
  client.plugin.enable(pluginId: string): Promise<void>;
  client.plugin.disable(pluginId: string): Promise<void>;
  ```

- 卸载插件：  

  ```typescript
  client.plugin.uninstall(pluginId: string): Promise<void>;
  ```

- 按运行时记录查询插件（运维/工具场景）：  

  ```typescript
  client.plugin.query(options?: {
    type?: PluginType;
    capability?: string;
  }): Promise<PluginRecord[]>;
  ```

其中 `PluginInfo` 与 `PluginRecord` 的结构在 SDK 类型定义中给出，分别用于“插件自身视角信息”和“Host 运行时插件记录”两类场景。

- 权限边界：
  - `client.plugin.list/get/getSelf/getCardPlugin/getLayoutPlugin/query` 统一要求 `plugin.read`；
  - `client.plugin.install/enable/disable/uninstall` 统一要求 `plugin.manage`。

## 模块能力调用

SDK 提供模块能力调用封装，直接映射 Host 正式模块服务动作。

### 目标模型

模块插件是 Host 托管的无界面能力模块。调用方通过 capability + method 使用模块能力，Host 负责 provider 发现、选择、校验和调度。

### 查询 provider

```typescript
client.module.listProviders(options?: {
  capability?: string;
  pluginId?: string;
  status?: "enabled" | "running" | "disabled" | "error";
  versionRange?: string;
}): Promise<ModuleProviderInfo[]>
```

### 解析 capability

```typescript
client.module.resolve(capability: string, options?: {
  versionRange?: string;
}): Promise<ModuleProviderInfo>
```

### 调用模块方法

```typescript
client.module.invoke(request: {
  capability: string;
  method: string;
  input: Record<string, unknown>;
  pluginId?: string;
  timeoutMs?: number;
}): Promise<
  | { mode: "sync"; output: unknown }
  | { mode: "job"; jobId: string }
>
```

示例：

```typescript
const result = await client.module.invoke({
  capability: "example.process",
  method: "run",
  input: {
    sourcePath: "/workspace/demo.txt",
  },
});

if (result.mode === "sync") {
  console.log(result.output);
}
```

### Job 管理

```typescript
client.module.job.get(jobId: string): Promise<ModuleJobSnapshot>
client.module.job.cancel(jobId: string): Promise<void>
```

示例：

```typescript
const started = await client.module.invoke({
  capability: "converter.card.export",
  method: "convert",
  input: {
    cardFile: "/workspace/demo.card",
    targetFormat: "html",
  },
});

if (started.mode === "job") {
  const snapshot = await client.module.job.get(started.jobId);
  console.log(snapshot.status);
}
```

补充语义：

- `timeoutMs` 会作为 Host 模块服务的方法级超时传入。sync 方法超时抛出 `MODULE_TIMEOUT`；
- job 方法返回 `jobId` 后继续由 Host 按该值治理，超时后 job 状态为 `failed`，错误码为 `MODULE_TIMEOUT`；
- `client.module.job.cancel(jobId)` 取消运行中 job 后，job 状态为 `cancelled`，错误码为 `MODULE_JOB_CANCELLED`，Host 会发出 `module.job.cancelled` 事件；
- 未指定 `pluginId` 时，Host 默认选择同一 capability 下 `enabled` 或 `running` 且版本范围匹配的最高语义化版本 provider。

### 使用边界

- 调用方应依赖正式 capability 契约，而不是依赖模块仓库 README 中的私有说明；
- 调用方不得直接 import 模块源码；
- 调用方不得散落私有 `client.invoke("module.*")` 拼装；
- Host 内部服务、应用插件以及其他模块插件应统一复用这套 SDK / Host 模块服务模型。

## 主题能力

SDK提供主题相关能力。主题系统遵循五层 token 架构（ref/sys/comp/motion/layout），支持作用域链覆盖。

获取主题列表使用 `client.theme.list()` 方法。它返回的是“当前工作区内已启用主题插件”构成的可用主题列表，而不是所有已安装但未启用的主题。方法签名：

```typescript
client.theme.list(publisher?: string): Promise<ThemeInfo[]>
```

获取当前主题使用 `client.theme.getCurrent()` 方法，返回当前活动主题配置。应用初始化时应优先读取这一结果或 Host preload 注入的主题属性，不得写死默认主题。方法签名：

```typescript
client.theme.getCurrent(appId?: string, pluginId?: string): Promise<ThemeInfo>
```

获取主题 CSS 使用 `client.theme.getAllCss()` 方法，返回当前主题的完整 CSS 与主题标识。方法签名：

```typescript
client.theme.getAllCss(): Promise<{ css: string; themeId: string }>
```

应用主题使用 `client.theme.apply()` 方法，传入主题 ID 切换当前工作区主题。方法签名：

```typescript
client.theme.apply(themeId: string): Promise<void>
```

获取主题契约使用 `client.theme.contract.get()` 方法，获取主题接口点、覆盖率与诊断视图。方法签名：

```typescript
client.theme.contract.get(component?: string): Promise<ThemeContractView>
```

解析主题链使用 `client.theme.resolve()` 方法，返回解析链路、token 视图、诊断列表与诊断摘要。方法签名：

```typescript
client.theme.resolve(chain: string[]): Promise<{
  resolved: Array<{ id: string; displayName: string; version: string; order: number }>;
  tokens: Record<string, unknown>;
  diagnostics: ThemeDiagnostic[];
  summary: ThemeDiagnosticSummary;
}>
```

订阅主题变化使用 `client.theme.onChanged()`，事件载荷包含主题版本和诊断摘要：

```typescript
client.theme.onChanged((payload: ThemeChangedPayload) => {
  console.log(payload.themeId, payload.themeVersion, payload.diagnosticsSummary.status);
});
```

## 系统治理能力

SDK 提供日志、凭证、序列化和控制平面封装，分别映射 Host `log.*`、`credential.*`、`serializer.*` 与 `control-plane.*` 服务动作。

### 日志

```typescript
client.log.write({
  level: "info",
  message: "Card export completed",
  metadata: {
    cardFile: "/workspace/demo.card",
  },
}): Promise<LogEntry>

client.log.query({ level?: "debug" | "info" | "warn" | "error", requestId?: string }): Promise<LogEntry[]>
client.log.export(): Promise<string>
```

说明：

- Host `log.write` 的附加字段名是 `metadata`，不是 `data`；
- `log.query` 当前按 `level` 与 `requestId` 查询，不接收通用 `filter/limit`；
- `log.export()` 当前无入参，返回导出后的日志载荷字符串。

### 凭证

```typescript
client.credential.get(ref: string): Promise<string | null>
client.credential.set(ref: string, value: string): Promise<void>
client.credential.delete(ref: string): Promise<void>
client.credential.rotate(ref: string): Promise<string>
```

说明：

- 凭证能力是高敏感治理接口，调用方必须声明并获得 Host `credential.manage` 权限；
- SDK 不缓存凭证明文，也不在业务层复制凭证加密逻辑；
- `set/delete` 返回 `Promise<void>`，Host `{ ack: true }` 只作为路由确认。

### 序列化

```typescript
client.serializer.encode(payload: unknown): Promise<string>
client.serializer.decode<T = unknown>(payload: string): Promise<T>
client.serializer.validate(payload: unknown, schema: string): Promise<boolean>
```

说明：

- 当前 Host 序列化实现是 JSON payload 的 Base64 编解码；
- `serializer.validate` 只返回布尔值，具体 schema 错误详情不作为 SDK 当前公共返回面。

### 控制平面

```typescript
client.controlPlane.health(): Promise<ControlPlaneHealthResult>
client.controlPlane.check(): Promise<ControlPlaneCheckResult>
client.controlPlane.metrics(): Promise<ControlPlaneMetrics>
client.controlPlane.diagnose(): Promise<ControlPlaneDiagnoseResult>
```

说明：

- SDK 属性名为 `controlPlane`，对应 Host route key `control-plane.*`；
- 当前控制平面四个动作均无入参；
- `diagnose` 需要 Host `control.write` 权限，普通插件应优先使用只读的 `health/check/metrics`。

## 平台辅助能力

对于必须由 preload 在本地完成的拖拽路径解析场景，SDK 透出正式辅助入口：

```typescript
client.platform.getPathForFile(file: unknown): string
```

说明：

- 该能力用于把拖拽或文件选择得到的 `File` 对象解析为本地路径；
- Electron Host 环境会直接复用 `window.chips.platform.getPathForFile`；
- 非支持环境返回空字符串，调用方应把空字符串视为“当前环境不支持该能力”。

## 错误处理

SDK方法返回Promise，错误通过Promise reject传递。

错误对象采用生态统一 `StandardError` envelope。SDK 会保留 Host / Bridge 返回的 `messageKey / requestId / traceId / permission`，本地检测到 Bridge 不可用或 SDK 调用超时时也会生成 `requestId`，便于和 SDK logger、Host Kernel 日志串联。

```typescript
interface StandardError {
  code: string;
  message: string;
  messageKey?: string;
  details?: unknown;
  retryable?: boolean;
  requestId?: string;
  traceId?: string;
  permission?: {
    domain?: string;
    action?: string;
    resource?: string;
    required: string[];
    granted: string[];
    messageKey?: string;
    callerId?: string;
    callerType?: string;
    pluginId?: string;
  };
}
```

常见错误包括 Bridge 不可用、调用超时、权限不足、资源不存在等。`retryable=true` 只表示错误允许重试；SDK 不会自动重试 `PERMISSION_DENIED` / `SERVICE_PERMISSION_DENIED`。

建议使用try-catch捕获错误，并向用户提供友好的错误提示。

事件 API 中，`client.events.on(...)` 和 `client.events.once(...)` 都返回取消订阅函数；`once` 触发前取消后不得再调用 handler。

## TypeScript支持

SDK提供完整的TypeScript类型定义。类型定义包含所有方法的参数和返回值类型。

建议使用TypeScript开发以获得类型安全保障。编辑器会提示类型错误，减少运行时问题。

## 性能优化

使用批量操作减少网络请求。SDK支持批量读取、批量写入等方法。

使用缓存避免重复请求。SDK内部会缓存一些常用数据。

合理设置超时时间。根据网络状况和业务需求调整超时配置。

## 安全考虑

令牌安全管理。SDK不存储明文令牌，会加密存储在本地。

敏感操作二次确认。某些敏感操作需要用户确认后才能执行。

遵循最小权限原则。只请求实际需要的接口权限。

## 离线支持

SDK支持离线模式。缓存常用数据到本地，网络恢复后同步。

离线队列将请求存入队列，网络恢复后自动发送。确保离线时的操作不会丢失。

## 最佳实践

封装SDK调用为业务方法。简化业务代码，提高复用性。

使用配置管理不同环境。开发环境、测试环境、生产环境使用不同配置。

记录SDK调用日志。便于问题排查和性能分析。

优雅处理网络异常。提供友好的用户体验。
