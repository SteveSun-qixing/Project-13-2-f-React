# 薯片 SDK 功能需求规格

> 文档状态：需求规格冻结候选稿  
> 说明：本文件定义 SDK 功能需求；跨生态公开接口以生态共用文档与 Host 对外接口基线为准。

---

## 1. 能力域总览

| 能力域 | 核心目标 |
|---|---|
| SDK 核心客户端 | 提供统一的客户端实例、配置与环境探测能力 |
| Bridge 封装层 | 对 `window.chips.*` 与 Host 对外接口的轻量封装 |
| 文件与资源能力 | 提供文件、卡片、箱子与资源的安全读写与解析能力 |
| 统一卡片显示能力 | 提供统一的卡片渲染与窗口显示接口 |
| 主题与配置能力 | 提供主题、多语言与配置的访问封装 |
| 插件与模块能力 | 提供插件/模块的信息、查询与管理封装（只读为主） |
| 工具与脚手架能力 | 提供类型定义、辅助工具与示例集成能力 |

以下按能力域描述功能需求，采用 `FR-SDK-*` 编号。

---

## 2. SDK 核心客户端需求（FR-SDK-CORE）

### FR-SDK-CORE-001 客户端实例创建

- SDK 必须提供统一客户端工厂方法（示意）：

  ```ts
  import { createClient } from 'chips-sdk';

  const client = createClient({
    endpoint?: string;    // 可选：Host 远程服务地址，默认本机
    auth?: {              // 可选：访问令牌与刷新策略配置
      accessToken?: string;
      refreshToken?: string;
      onRefresh?: (tokens: Tokens) => void;
    };
    timeoutMs?: number;   // 默认请求超时时间
    retries?: 0 | 1 | 2 | 3;
    environment?: 'browser' | 'node' | 'plugin';
  });
  ```

- 客户端实例应为轻量对象，可安全在同一进程中创建多个实例。
- 客户端配置必须支持不可变原则：创建后配置不可在运行中静默变更，只能显式创建新实例。

### FR-SDK-CORE-002 环境探测

- SDK 必须能够自动探测当前运行环境：
  - Host 插件环境（存在 `window.chips` 且具备 `invoke` 等核心方法）。
  - 浏览器环境（有 `window`，但不保证 Host 存在）。
  - Node.js 环境（无 `window`，使用 IPC/HTTP 等与 Host 通信）。
- 当检测到 Host 能力缺失时，SDK 必须给出明确错误提示，而非静默失败。

### FR-SDK-CORE-003 通用调用入口

- SDK 核心客户端必须提供统一调用入口，映射到 Host 路由动作：

  ```ts
  client.invoke<I, O>(action: `${string}.${string}`, payload: I): Promise<O>;
  ```

- `invoke` 必须：
  - 对动作名进行基本校验（非空、包含点分割等）。
  - 统一处理 Bridge/Host 层的标准错误对象。
  - 在配置允许范围内执行自动重试，但不得突破 Host 约定的重试上限。

---

## 3. Bridge 封装层需求（FR-SDK-BRIDGE）

### FR-SDK-BRIDGE-001 Bridge 适配封装

- SDK 必须封装对 `window.chips.invoke/on/once/emit` 的调用，并在缺失时提供降级错误：
  - `BRIDGE_UNAVAILABLE`：Bridge 不可用。
  - `BRIDGE_INVALID_PAYLOAD`：载荷格式不合法（前置校验失败）。
- 在 Node.js 环境中，若设计需要，可通过 IPC/HTTP 调用 Host 提供的等价接口；该部分实现细节归属技术文档。

### FR-SDK-BRIDGE-002 事件封装

- SDK 必须提供类型安全的事件订阅封装：

  ```ts
  client.events.on<T>(event: string, handler: (payload: T) => void): () => void;
  client.events.once<T>(event: string, handler: (payload: T) => void): void;
  client.events.emit<T>(event: string, payload: T): Promise<void>;
  ```

- 事件名称必须遵循点语义（如 `card.created`、`theme.changed`）。
- `on` 必须返回取消订阅函数；在插件卸载或组件 unmount 时可安全调用。

### FR-SDK-BRIDGE-003 错误归一封装

- 对 Bridge 层错误（`BRIDGE_*`）、服务层错误（`SERVICE_*`）和运行时错误（`RUNTIME_*`）必须统一为标准错误对象：

  ```ts
  interface StandardError {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
  }
  ```

- SDK 不得吞掉错误或返回非结构化字符串错误。

---

## 4. 文件与资源能力需求（FR-SDK-FILE）

### FR-SDK-FILE-001 文件读写封装

- SDK 必须提供文件读写封装（示意）：

  ```ts
  client.file.read(path: string, options?: FileReadOptions): Promise<FileContent>;
  client.file.write(path: string, content: FileContent, options?: FileWriteOptions): Promise<void>;
  client.file.list(dir: string, options?: FileListOptions): Promise<FileEntry[]>;
  client.file.stat(path: string): Promise<FileStat>;
  ```

- 调用必须映射到 Host `file.*` 服务动作，并遵守权限与错误码语义。

### FR-SDK-FILE-002 卡片与箱子操作封装

- SDK 必须封装卡片与箱子核心能力：

  ```ts
  client.card.parse(cardFile: string): Promise<CardDocument>;
  client.card.validate(cardFile: string): Promise<ValidationResult>;
  client.card.getBaseCard(cardFile: string, nodeId: string): Promise<BaseCardRecord>;
  client.card.updateBaseCard(cardFile: string, nodeId: string, config: Record<string, unknown>): Promise<BaseCardRecord>;
  client.card.render(cardFile: string, options?: RenderOptions): Promise<CardRenderView>;

  client.box.pack(inputDir: string, options?: PackOptions): Promise<string>;    // 返回 box 文件路径
  client.box.unpack(boxFile: string, outputDir: string): Promise<void>;
  client.box.inspect(boxFile: string): Promise<BoxInspectResult>;
  ```

- `client.card.render` 必须直接映射到 Host `card.render` 动作（统一渲染入口），并填充 `options` 推荐字段。

### FR-SDK-FILE-003 资源访问封装

- SDK 必须封装 `resource.*` 能力，用于读取资源元数据与二进制内容：

  ```ts
  client.resource.resolve(resourceId: string): Promise<ResourceUri>;
  client.resource.readMetadata(resourceId: string): Promise<ResourceMeta>;
  client.resource.readBinary(resourceId: string): Promise<ArrayBuffer>;
  ```

---

## 5. 统一卡片显示能力需求（FR-SDK-CARD-DISPLAY）

> 本节与组件库《基础卡片插件与 SDK 显示链路规范》及《复合卡片窗口与 SDK 显示链路标准》对齐。

### FR-SDK-CARD-DISPLAY-001 统一显示接口

- SDK 必须提供以下统一显示接口：

  ```ts
  client.card.coverFrame.render(options: {
    cardFile: string;
    cardName?: string;
  }): Promise<HTMLIFrameElement>;

  client.card.compositeWindow.render(options: {
    cardFile: string;
    mode?: 'view' | 'preview';
  }): Promise<HTMLIFrameElement>;
  ```

- 要求：
  - `mode` 仅允许 `view | preview`，非法值必须在 SDK 侧直接抛出标准错误，错误码建议为 `INVALID_ARGUMENT`。
  - 返回的 iframe 必须可直接挂载到调用方 DOM，且其 `src`、`sandbox` 等属性符合 Host 渲染安全要求。

### FR-SDK-CARD-DISPLAY-002 事件协议支持

- SDK 必须为复合卡片窗口提供事件协议封装，至少包括：
  - `chips.composite:ready`
  - `chips.composite:node-error`
  - `chips.composite:fatal-error`

- SDK 需提供事件订阅工具（示意）：

  ```ts
  client.card.compositeWindow.onReady(frame: HTMLIFrameElement, handler: () => void): () => void;
  client.card.compositeWindow.onNodeError(
    frame: HTMLIFrameElement,
    handler: (payload: CompositeNodeError) => void,
  ): () => void;
  client.card.compositeWindow.onFatalError(
    frame: HTMLIFrameElement,
    handler: (error: StandardError) => void,
  ): () => void;
  ```

### FR-SDK-CARD-DISPLAY-003 origin 安全约束

- SDK 必须在渲染接口返回结果中暴露 iframe `origin` 信息，供组件端做消息来源白名单校验：

  ```ts
  type FrameRenderResult = {
    frame: HTMLIFrameElement;
    origin: string;
  };
  ```

- 对非白名单 `origin` 的消息必须忽略，并可选输出诊断日志。

### FR-SDK-CARD-DISPLAY-004 业务应用职责划分

- SDK 统一显示接口应保证：
  - 查看器、编辑引擎等生态内部应用均可通过同一接口展示卡片；
  - 业务应用仅负责文件来源与窗口容器，不重复实现渲染引擎逻辑。

---

## 6. 主题与配置能力需求（FR-SDK-THEME）

### FR-SDK-THEME-001 主题能力封装

- SDK 必须封装以下主题能力，并与 Host `theme.*` 动作语义一致：

  ```ts
  client.theme.list(publisher?: string): Promise<ThemeMeta[]>;
  client.theme.apply(themeId: string): Promise<void>;
  client.theme.getCurrent(options?: { appId?: string; pluginId?: string }): Promise<ThemeState>;
  client.theme.getAllCss(): Promise<{ css: string; themeId: string }>;
  client.theme.resolve(chain: string[]): Promise<ResolvedTheme>;
  client.theme.contract.get(component?: string): Promise<ThemeContract>;
  ```

- 对 `theme.resolve` 与 `theme.contract.get` 的结构必须使用生态共用文档中冻结的类型。

### FR-SDK-THEME-002 配置与多语言封装

- SDK 必须封装 `config` 与 `i18n` 能力，用于应用与插件配置管理及多语言支持：

  ```ts
  client.config.get<T = unknown>(key: string): Promise<T | undefined>;
  client.config.set<T = unknown>(key: string, value: T): Promise<void>;

  client.i18n.getCurrent(): Promise<string>;
  client.i18n.setCurrent(locale: string): Promise<void>;
  client.i18n.translate(key: string, params?: Record<string, unknown>): Promise<string>;
  client.i18n.listLocales(): Promise<string[]>;
  ```

---

## 7. 插件与模块能力需求（FR-SDK-PLUGIN）

### FR-SDK-PLUGIN-001 插件信息与管理能力

- SDK 必须提供插件信息查询与生命周期管理能力：

  ```ts
  // 信息查询（面向插件自身与应用业务）
  client.plugin.getSelf(): Promise<PluginInfo>;
  client.plugin.list(options?: { type?: PluginType; capability?: string }): Promise<PluginInfo[]>;
  client.plugin.get(pluginId: string): Promise<PluginInfo | undefined>;
  client.plugin.getCardPlugin(cardType: string): Promise<PluginInfo | undefined>;
  client.plugin.getLayoutPlugin(layoutType: string): Promise<PluginInfo | undefined>;

  // 管理能力（映射 Host plugin 服务，面向运维与工具）
  client.plugin.install(manifestPath: string): Promise<{ pluginId: string }>;
  client.plugin.enable(pluginId: string): Promise<void>;
  client.plugin.disable(pluginId: string): Promise<void>;
  client.plugin.uninstall(pluginId: string): Promise<void>;
  client.plugin.query(options?: { type?: PluginType; capability?: string }): Promise<PluginRecord[]>;
  ```

- `PluginInfo` 与 `PluginRecord` 分别对应：
  - Host 插件读取接口暴露的正式插件元信息结构（包含 `name/version/description` 与类型专属元数据）；
  - Host `plugin.query` 暴露的运行时插件记录结构（在元信息基础上补齐 `manifestPath/enabled/installedAt` 等运行时字段）。

### FR-SDK-PLUGIN-002 模块与窗口辅助能力

- SDK 可选提供常用窗口与模块操作的轻量封装（不扩展 Host 能力），例如：

  ```ts
  client.window.open(config: WindowConfig): Promise<WindowState>;
  client.window.focus(id: string): Promise<void>;

  client.module.mount(slot: string, module: Record<string, unknown>): Promise<void>;
  client.module.unmount(slot: string): Promise<void>;
  ```

- 所有此类封装必须严格映射到 Host `window.*` 与 `module.*` 服务动作，禁止发明 SDK 自有未文档化语义。

---

## 8. 工具与脚手架能力需求（FR-SDK-TOOLS）

### FR-SDK-TOOLS-001 类型定义与公共类型导出

- SDK 必须提供完整的 TypeScript 类型定义：
  - 所有公开 API 的参数与返回值类型。
  - 常用实体类型（如 `CardDocument`、`CardRenderView`、`ThemeMeta` 等）。
  - 标准错误对象 `StandardError`。

### FR-SDK-TOOLS-002 契约与路由清单消费

- SDK 应预留集成 `route-manifest` 与其他契约清单的能力，用于：
  - 检查调用动作是否存在；
  - 提供自动补全与静态分析基础；
  - 在测试阶段对照 Host 侧契约检测漂移。

### FR-SDK-TOOLS-003 示例与文档协作

- 本轮不直接实现代码层示例项目，但需求上要求：
  - SDK API 设计必须方便在示例项目中直接使用；
  - 需求与技术文档为未来生态共用《SDK 使用指南》的内容结构提供基础。

---

## 9. 需求验收映射

| 需求组 | 验收方式 | 通过标准 |
|---|---|---|
| FR-SDK-CORE | 单元测试 + 环境模拟 +错误注入 | 各环境识别正确，错误归一逻辑健全 |
| FR-SDK-BRIDGE | Bridge 模拟 + Host 联调 | 调用行为与错误语义与 Bridge 规范一致 |
| FR-SDK-FILE | Host 契约测试 + 集成测试 | 文件/卡片/箱子能力完整可用 |
| FR-SDK-CARD-DISPLAY | 组件库 demo 联调 + E2E | 各应用场景显示一致，事件协议与 origin 安全生效 |
| FR-SDK-THEME | Host Theme 服务契约测试 | 主题链路行为与生态共用规范一致 |
| FR-SDK-PLUGIN | 插件运行环境联调 | 插件信息查询与窗口/模块辅助能力可用 |
| FR-SDK-TOOLS | 类型检查 + 契约校验脚本 | 类型定义完整，契约消费能力预留 |
