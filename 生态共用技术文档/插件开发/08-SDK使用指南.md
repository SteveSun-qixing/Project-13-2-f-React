# SDK使用指南

## 概述

薯片 SDK 当前主要面向两类场景：

- 薯片主机内部应用插件；
- 生态内部工具链与开发命令行。

SDK 提供程序化接口访问生态核心能力，包括文件操作、内容渲染、插件管理与主题能力。

> 架构归属声明（2026-03-06）：Host 主责 L1-L9 运行时链路（含 Runtime Client 与渲染层）；SDK 仅提供开发封装与调用入口，不承载运行时主实现。

## 安装

生态一方仓库统一通过根工作区安装 SDK：

```bash
cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f
npm install
```

随后在一方工程中直接声明正式 semver 依赖（例如 `^0.1.0`），由生态根工作区自动链接到本地 `chips-sdk` 工作区包。

脚手架模板中的默认依赖同样保持 semver 版本范围；当工程创建在生态根工作区内时，`chipsdev create` 只负责把新工程注册进根工作区，不再写入 `file:` 或其他临时依赖。

安装后导入SDK模块。ES Module导入方式使用 `import * as Chips from "chips-sdk"`。CommonJS 导入方式使用 `const Chips = require("chips-sdk")`。

## 开发工作区与用户工作区

与 SDK 配套的正式命令是 `chipsdev`。本轮实现后，开发态插件与主题调试必须明确区分两类工作区：

- `chips` 管理用户工作区 `~/.chips-host`
- `chipsdev` 管理开发工作区 `.chips-host-dev`

如果你在开发态需要安装插件、启用主题、切换主题或检查 Host 状态，应优先使用 `chipsdev plugin.* / theme.* / status / doctor`，不要手工改写开发工作区文件。

## 初始化

使用SDK前需要初始化。创建客户端实例，传入配置选项如服务器地址、认证信息等。初始化会建立与服务的连接。

客户端实例是 SDK 的核心入口，通过实例调用各种功能方法。

## 文件操作

SDK 提供两层正式能力：

- 语义层：`client.card.*`，面向解析、渲染、基础卡片编辑器挂载等高层场景；
- 基础层：`client.file.*` 与 `client.zip.*`，面向基础设施级应用的底层文件/压缩编排。

对 EditingEngine、资源管理器这类需要直接治理 `.card/.box` 文档结构的应用，推荐优先使用 `client.file` + `client.zip`，而不是要求 Host 为每一个业务动作都新增专用 route。

### file API

```typescript
client.file.read(path: string, options?: { encoding?: 'utf-8' | 'binary' }): Promise<string | Uint8Array>
client.file.write(path: string, content: string | Uint8Array, options?: { encoding?: 'utf-8' | 'binary' }): Promise<void>
client.file.stat(path: string): Promise<FileStat>
client.file.list(dir: string): Promise<FileEntry[]>
client.file.exists(path: string): Promise<boolean>
client.file.mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
client.file.delete(path: string, options?: { recursive?: boolean }): Promise<void>
client.file.copy(source: string, destination: string, options?: { overwrite?: boolean }): Promise<void>
client.file.move(source: string, destination: string, options?: { overwrite?: boolean }): Promise<void>
```

### zip API

```typescript
client.zip.compress(inputDir: string, outputZip: string): Promise<void>
client.zip.extract(zipPath: string, outputDir: string): Promise<void>
client.zip.list(zipPath: string): Promise<Array<{ path: string; size: number; isDirectory: boolean }>>
```

解析卡片使用 `client.card.parse()` 方法，传入卡片文件路径。返回卡片对象，包含元数据、内容列表等。方法签名：

```typescript
client.card.parse(cardPath: string): Promise<CardDocument>
```

验证卡片使用 `client.card.validate()` 方法，验证卡片结构是否符合规范。方法签名：

```typescript
client.card.validate(cardFile: string): Promise<ValidationResult>
```

渲染卡片使用 `client.card.render()` 方法，传入卡片文件路径。返回渲染后的视图对象。方法签名：

```typescript
client.card.render(cardFile: string, options?: RenderOptions): Promise<CardView>
```

基础卡片编辑链路使用以下正式方法：

```typescript
client.card.getBaseCard(cardFile: string, nodeId: string): Promise<BaseCardRecord>
client.card.updateBaseCard(cardFile: string, nodeId: string, config: Record<string, unknown>): Promise<BaseCardRecord>
client.card.baseCardEditor.render(options: {
  cardFile: string;
  nodeId: string;
  title?: string;
}): Promise<BaseCardEditorRenderResult>
```

其中 `baseCardEditor` 额外提供：

- `onReady(frame, handler)`
- `onConfigChange(frame, handler)`
- `onConfigSynced(frame, handler)`
- `onFatalError(frame, handler)`
- `syncConfig(frame, config)`

> 注意：旧版 `cards.read`、`cards.create`、`cards.update`、`cards.delete` 方法已归档，请使用 `card.parse/getBaseCard/render/renderBaseCardEditor/updateBaseCard/validate` 以及 `file.* / zip.*` 正式接口。

补充约束（2026-03-11）：

- `card.updateBaseCard` 只覆盖“单个基础卡片配置编辑”；
- 基础卡片增删改序、文档模式切换、批量内容写回等文档结构级动作，推荐由基础设施级应用通过 `client.file` + `client.zip` 直接完成；
- 若插件声明了 `file.manage`，SDK 调用 `file.read/write/stat/list/exists/mkdir/delete/copy/move` 时都可通过权限校验；普通业务插件仍建议按最小权限声明精确权限。

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

说明：

- `target` 默认建议为 `card-iframe`。
- `verifyConsistency=true` 适用于测试/验收环境，不建议默认在生产场景全量开启。
- `semanticHash` 可用于跨目标渲染一致性对比与缓存键管理。
- SDK 调用前应做参数预校验；若透传到 Host 后触发 schema 校验失败，错误码为 `SCHEMA_VALIDATION_FAILED`。

### 卡片显示窗口（vNext 统一接口）

在需要展示卡片的应用中，统一使用 SDK 显示窗口接口：

```typescript
client.card.coverFrame.render({
  cardFile: string,
  cardName?: string
}): Promise<IframeWindow>

client.card.compositeWindow.render({
  cardFile: string,
  mode?: 'view' | 'preview'
}): Promise<IframeWindow>
```

说明：

- `coverFrame` 返回卡片封面 iframe（下方显示卡片名称）。
- `compositeWindow` 返回复合卡片 iframe 窗口。
- `compositeWindow.mode` 只允许 `view | preview`。
- `compositeWindow` 提供 `onReady / onNodeSelect / onNodeError / onFatalError` 事件订阅，用于承接编辑引擎等上层工作流。
- 基础卡片分发、模板编译、iframe 拼接由 Host 内置渲染运行时完成；SDK 仅封装调用入口。

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

- 启动应用插件：  

  ```typescript
  client.plugin.launch(
    pluginId: string,
    launchParams?: Record<string, unknown>
  ): Promise<{
    window: { id: string };
    session: { sessionId: string; sessionNonce: string; permissions: string[] };
  }>;
  ```

- 查询 / 创建 / 删除应用快捷方式：  

  ```typescript
  client.plugin.getShortcut(pluginId: string): Promise<PluginShortcutRecord>;
  client.plugin.createShortcut(
    pluginId: string,
    options?: { replace?: boolean }
  ): Promise<PluginShortcutRecord>;
  client.plugin.removeShortcut(pluginId: string): Promise<{
    removed: boolean;
    launcherPath: string;
    location: "desktop" | "launchpad";
  }>;
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
  - `client.plugin.getShortcut` 统一要求 `plugin.read`；
  - `client.plugin.install/enable/disable/uninstall/launch/createShortcut/removeShortcut` 统一要求 `plugin.manage`。

`PluginShortcutRecord` 的正式字段如下：

```typescript
interface PluginShortcutRecord {
  pluginId: string;
  name: string;
  location: "desktop" | "launchpad";
  launcherPath: string;
  executablePath: string;
  args: string[];
  iconPath?: string;
  exists: boolean;
}
```

说明：

- Windows 统一返回 `location: "desktop"`；
- macOS 统一返回 `location: "launchpad"`，实际文件由 Host 写入 `~/Applications/Chips Apps/*.app`；
- `args` 为 Host 最终写入快捷方式的参数快照，便于治理界面与诊断工具展示。

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

获取主题契约使用 `client.theme.contract.get()` 方法，获取主题接口点定义。方法签名：

```typescript
client.theme.contract.get(component?: string): Promise<ThemeContract>
```

解析主题链使用 `client.theme.resolve()` 方法，返回解析链路与 token 视图。方法签名：

```typescript
client.theme.resolve(chain: string[]): Promise<{
  resolved: Array<{ id: string; displayName: string; order: number }>;
  tokens: Record<string, unknown>;
}>
```

## 平台辅助能力

对于必须由 preload 在本地完成的拖拽路径解析场景，SDK 透出正式辅助入口：

```typescript
client.platform.getPathForFile(file: unknown): string
```

说明：

- 该能力用于把拖拽或文件选择得到的 `File` 对象解析为本地路径；
- Electron Host 环境会直接复用 `window.chips.platform.getPathForFile`；
- 非支持环境返回空字符串，调用方应把空字符串视为“当前环境不支持该能力”。

对于应用插件被快捷方式、文件关联或开发入口拉起后的恢复场景，SDK 同时透出启动上下文：

```typescript
client.platform.getLaunchContext(): {
  pluginId?: string;
  sessionId?: string;
  launchParams: Record<string, unknown>;
}
```

使用建议：

- 该接口为同步只读接口，返回的是 preload 在窗口创建时注入的当前会话上下文；
- 典型触发值包括：
  - `launchParams.trigger === "app-shortcut"`
  - `launchParams.trigger === "file-association"`
  - `launchParams.trigger === "chipsdev.run"`
- 文件处理型应用应优先从 `launchParams.targetPath` 恢复打开目标；
- 该接口仅描述“当前窗口如何被打开”，不应用作持久化存储。

## 认证授权

需要认证的接口需要处理授权。

登录接口获取访问令牌。传入用户名和密码，返回访问令牌和刷新令牌。

在后续请求中携带访问令牌。通常通过配置客户端实例的auth选项自动处理令牌刷新。

## 错误处理

SDK方法返回Promise，错误通过Promise reject传递。

错误对象包含code错误码、message错误描述、details详细信息。常见错误包括认证失败、权限不足、资源不存在等。

建议使用try-catch捕获错误，并向用户提供友好的错误提示。

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
