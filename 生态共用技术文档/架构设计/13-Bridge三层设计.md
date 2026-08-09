# Bridge三层设计

> **版本**：vNext 已落地口径  
> **层级**：L5 Bridge Transport、L6 Runtime Client、L7 UI Hooks  
> **当前实现状态**：Desktop preload transport + Direct transport 已落地

> **状态注记（task030 卸担计划，2026-08）**：L5-L7 Bridge 链路保持有效（架构红线不变）；文中 "React 应用优先使用 `@chips/component-library` / `@chips/hooks` 的 `ChipsEnvironmentProvider` 与 `useChips*` hooks" 已失效——组件库废弃后，统一使用 `@chips/ui` 的 `ChipsProvider / useChips`（`生态共用技术文档/前端基础/03-共享层使用指南.md`）。

## 架构归属声明（2026-04-08）

- L5-L7 运行时链路由 Host 内置实现并随 Host 发布。
- SDK 只消费 Bridge / Runtime Client 的正式契约，不承载 L5-L7 主实现。
- `window.chips.*` 是公共接口形状，不是 Electron 私有特性。

## 1. Bridge 三层总览

Bridge 三层是插件访问 Host 正式能力的完整链路：

| 层级 | 名称 | 核心职责 |
|---|---|---|
| L5 | Bridge Transport | 暴露 `window.chips.*`，承接调用与事件传输 |
| L6 | Runtime Client | 统一请求封装、错误归一、返回结构解包 |
| L7 | UI Hooks / API | 面向应用代码公开能力接口 |

当前变化重点：

- L5 已抽象为 **Host Access Transport**，不再等同于 Electron preload；
- L6 已对齐新的 `surface / transfer / association` 子域；
- L7 继续以 `chips-sdk` API 和 Host 内置 UI Hooks 为主入口。

## 2. L5：Bridge Transport

### 2.1 正式入口

当前 `ChipsBridge` 公开的核心入口如下：

- `invoke(action, payload?)`
- `invokeScoped(action, payload, { token })`
- `on(event, handler)`
- `once(event, handler)`
- `emit(event, data?)`
- `emitScoped(event, data, { token })`

其中：

- `invokeScoped / emitScoped` 属于高级受控接口；
- 普通应用插件开发默认不依赖 scoped 接口。

### 2.2 子域基线

当前 Host 已在 Bridge 层正式暴露以下子域：

- `window`
- `dialog`
- `plugin`
- `clipboard`
- `shell`
- `surface`
- `command`
- `transfer`
- `association`
- `platform`
- `notification`
- `tray`
- `shortcut`
- `ipc`

新增正式子域：

- `surface`：跨平台界面容器语义
- `command`：菜单、工具栏、快捷键、命令面板共享的命令语义
- `transfer`：打开、导出、分享、定位文件
- `association`：文件关联 / URL scheme / share target 入口治理

### 2.3 当前已落地的 Transport

| Transport | 当前状态 | 说明 |
|---|---|---|
| Electron preload transport | 已落地 | `DesktopHostShell` 注入 `window.chips.*` |
| Direct transport | 已落地 | Headless、测试、Host 内部直接复用 |
| Browser Worker transport | 预留 | 供未来 Web Shell 使用 |
| WebView native bridge | 预留 | 供未来 Mobile Shell 使用 |

### 2.4 传输通道

Desktop 当前继续使用：

- `chips:invoke`
- `chips:emit`
- `chips:event:<name>`

这些是 Desktop Shell 的物理实现，不是公共接口边界；未来其他 Shell 可以替换底层通道，但不得改变 `window.chips.*` 形状。

### 2.5 安全边界

- 页面侧只允许访问 `window.chips.*`
- 不允许直接暴露 Node.js / Electron 原生对象
- 作用域恢复、权限、schema、审计都在 Host 侧统一处理

## 3. L6：Runtime Client

Runtime Client 的正式职责：

1. 统一 action / payload 形状
2. 标准错误对象归一
3. Host 返回结构解包
4. 环境与上下文保护
5. 为页面提供稳定 API 形状

当前已经对齐的新能力包括：

- `client.surface.*`
- `client.command.*`
- `client.transfer.*`
- `client.association.*`
- `client.platform.getCapabilities()` 返回结构化能力快照

## 4. L7：UI Hooks / API

L7 面向业务代码的正式调用顺序：

1. React 应用优先使用 `@chips/component-library` / `@chips/hooks` 提供的 `ChipsEnvironmentProvider` 与 `useChips*` hooks。
2. 非 React 场景或底层封装优先使用 `chips-sdk` 的 API / `createClient()`。
3. 在必须直连 Bridge 的场景使用 `window.chips.*`。
4. 不允许页面代码直接依赖任何 transport 实现细节。

当前正式 React 环境入口包括：

- `ChipsEnvironmentProvider`
- `useChipsEnvironment`
- `useChipsClient`
- `useChipsTheme`
- `useChipsI18n`
- `useChipsSurface`
- `useChipsPermission`
- `useChipsCommand`
- `useChipsDiagnostics`

这些 hooks 只消费注入的 SDK client 或同形 mock client，不承载 Host runtime 主实现，也不直接访问 Host 内部包。测试场景可用 `@chips/testing` 的 `createMockChipsClient/createMockChipsEnvironment` 注入 Provider。

## 5. 应用插件启动链路

当前应用插件正式启动链路已经统一到以下模型：

1. 调用 `surface.open({ target: { type: "plugin" } })` 或 `plugin.launch(...)`
2. Host Runtime 创建插件会话并完成握手
3. Host 创建 `SurfaceContext`，包含 `sceneId / sessionId / pluginId / kind / presentation`
4. PAL `surface.open()` 创建实际容器并回填 `surfaceId`
5. preload 读取 launch context，向页面注入 `window.chips`

当前语义：

- `surface.open(target=plugin)` 已走正式插件会话主链路
- `plugin.launch` 保留为 app 插件兼容入口，并复用同一底层实现
- `window.open` 继续存在，但它是桌面窗口别名，不再承担新的跨平台插件生命周期语义
- `platform.getLaunchContext()` 会返回 `pluginId / sessionId / sceneId / surfaceId / kind / presentation / surfaceContext / launchParams`；应用通过 `surfaceContext` 获得 App / Scene / surface 运行上下文，不解析命令行、Electron 私有对象或 Host 内部窗口状态

## 6. 统一事件语义

Bridge / Runtime 当前重点事件包括：

- `theme.changed`
- `plugin.init`
- `plugin.ready`
- `plugin.launched`
- `scene.created`
- `scene.active`
- `scene.inactive`
- `scene.closed`
- `surface.opened`
- `surface.focused`
- `surface.resized`
- `surface.stateChanged`
- `surface.closed`
- `command.registered`
- `command.unregistered`
- `command.changed`
- `command.invoked`
- `window.opened`
- `module.runtime.started`
- `module.runtime.stopped`

事件命名强制采用点语义，不得混用冒号或短横线命名。

## 7. 依赖方向

```text
L4 Plugin Runtime
  -> L5 Bridge Transport
  -> L6 Runtime Client
  -> L7 UI Hooks / API
```

禁止项：

- L7 不能直接依赖 L5 transport 细节
- L6 不能重新实现 Host 运行时主体
- L5 不能依赖页面业务状态

## 8. 质量门禁

1. 新增 Bridge 子域时，必须同步更新 Host、SDK、路由契约与共享文档。
2. 新增 Transport 时，只能替换传输后端，不能改变动作名、权限模型和错误模型。
3. `window.chips.*` 形状必须对 Desktop / Headless / 未来 Web / Mobile 保持一致。
