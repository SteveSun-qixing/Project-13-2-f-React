# 任务011：SDK React Hooks 与 Environment 入口前置勘察报告

生成时间：2026-05-23 CST (+0800)

勘察范围：只读核对 `任务011-SDK-ReactHooks与Environment入口.md`、同目录任务010/012边界、SwiftUI 状态与环境调研/差距/重构方案、开发任务05/10、生态设计原稿与生态共用技术文档中的 Host/Bridge/SDK/组件库 hooks/主题/i18n/surface/command 口径，并核对 `Chips-SDK`、`Chips-ComponentLibrary/packages/hooks`、`Chips-ComponentLibrary/packages/components`、`Chips-Scaffold/chips-scaffold-app`、`Chips-EcoSettingsPanel` 当前实现。

只读边界：本轮未修改 SDK、组件库、脚手架、设置面板、测试、公共正式文档、工单文件和 Git 分支；唯一写入为本草稿报告。发现的架构缺口或文档与代码不一致只记录证据和建议，未创建正式问题工单。

## 1. 任务011目标和相邻任务边界

任务011目标是建立应用默认使用的 React hooks 和 Environment Provider，让应用少写 Host 接线代码。明确开发内容包括：

- `ChipsEnvironmentProvider`
- `useChipsClient`
- `useChipsTheme`
- `useChipsI18n`
- `useChipsSurface`
- `useChipsPermission`
- `useChipsCommand`
- `useChipsDiagnostics`

相邻任务边界：

- 任务010负责 SDK Domain API 补齐与类型同步，范围是 `Chips-SDK/src/api/*`、`route-manifest.json`、contract drift 测试等。任务011不应重复 wrapper payload/unwrap/类型修复，不应抢跑 `platform/log/credential/serializer/control-plane` 等 domain wrapper 补齐。
- 任务012负责测试 Mock 与 Host 模拟器，范围是 mock bridge、mock client、mock launch/surface context、mock theme changed、mock permission denied、mock timeout/retry。任务011需要保证 hooks 可以被 mock client/event source 注入，但不应提前实现完整 Host 模拟器。
- 任务05阶段方案要求 React hooks 优先落在 `Chips-ComponentLibrary/packages/hooks`，由 `@chips/component-library` 聚合导出；SDK 保持纯 TypeScript API 和测试 mock；hooks 内部只能通过 SDK client 或 Bridge 正式链路调用 Host。
- 任务10阶段方案要求 Environment 至少包含 `client/locale/theme/surface/pluginSession/permissions/platform/workspace/diagnostics` 等语义，但任务011只应先打通与 Host Runtime Client 直接相关的环境读取与事件刷新，不应一次性扩展完整 State/Binding/Form/Focus 模型。

## 2. 已阅读公共口径要点

### 2.1 分层和职责

- 生态设计原稿明确 Host 主责 L1-L9 运行时链路，组件库主责 L10 Component Headless，SDK 仅作为开发者工具包提供类型、封装、脚手架与测试辅助，不承载运行时主实现。
- 生态共用 `Bridge三层设计` 将 L5 定为 Bridge Transport，L6 定为 Runtime Client，L7 定为 UI Hooks/API。L7 hook 只能调用 Runtime Client，不可直连 transport。
- 前端框架 vNext 术语冻结文档要求 State/Environment/Binding/Focus 的系统能力通过 Runtime Client/Hooks 注入，App/Card/Layout 插件访问系统能力必须走 `window.chips.*`、Bridge 或 `chips-sdk` 正式链路。

### 2.2 主题、多语言、surface 和命令

- 主题正式动作是 `theme.list/apply/getCurrent/getAllCss/resolve/contract.get`，主题变更事件是 `theme.changed`，事件载荷包含 `previousThemeId/themeId/themeVersion/timestamp/diagnosticsSummary`。
- i18n 正式动作是 `i18n.getCurrent/setCurrent/translate/listLocales`，语言变更事件是 `language.changed`。
- surface 是新的跨平台界面容器主语义，`window` 只是桌面兼容别名。应用启动上下文应优先从 `platform.getLaunchContext()` 的 `surfaceContext` 获得。
- 命令系统以 Host `command.*` registry 为唯一事实来源，组件库命令消费层不是第二套 registry。业务 handler 函数不得传给 Host，Host 保存可序列化 metadata 并通过 `command.invoked` 事件调度。

## 3. 当前代码现状

### 3.1 `Chips-SDK`：已有 Runtime Client 和 domain API，无 React 入口

当前 SDK 包名为 `chips-sdk`，`package.json` 只导出根入口，未发现 React 子入口或 hooks 包：

- `Chips-SDK/package.json`：`exports["."]` 指向 `src/index.ts` 与 `index.d.ts`，没有 `./react`、`./hooks` 或类似入口。
- `Chips-SDK/src/index.ts`：导出 `createClient`、`Client`、各 domain API 类型和 `StandardError`，没有导出 React Provider/hook。
- `rg "react|hooks|ChipsEnvironment|EnvironmentProvider"` 在 `Chips-SDK/src` 未发现 React 入口。

SDK 已有可被 hooks 消费的基础：

- `createClient()` 挂载 `document/file/card/theme/config/i18n/command/plugin/module/window/surface/transfer/association/platform/box/resource/zip`。
- `createCoreClient()` 支持 `transport` 注入、自动探测 `window.chips`、SDK 侧 `timeoutMs`、`retries`、logger 和统一 `events`。
- `createTransportAdapter()` 在自定义 transport 下维护本地 listener map，可用于轻量事件测试，但它不是任务012意义上的统一 mock bridge/client。
- `types/errors.ts` 当前已有 `StandardError.messageKey/requestId/traceId/permission` 和 `PermissionDiagnostic`，但这看起来属于任务009/010后续已在 worktree 中出现的改动，任务011应只消费最终公开类型，不继续扩展错误模型。

当前 domain 消费形态：

- theme：`client.theme.getCurrent/getAllCss/resolve/contract.get/onChanged`，`onChanged` 订阅 `theme.changed`。
- i18n：`client.i18n.getCurrent/setCurrent/translate/listLocales`，但当前无 `i18n.onChanged` helper，语言事件只能用 `client.events.on("language.changed", ...)`。
- surface：`client.surface.open/focus/resize/setState/getState/close/list`，无 surface lifecycle event helper。
- command：`client.command.register/unregister/get/list/invoke/setState/onRegistered/onUnregistered/onChanged/onInvoked`。
- platform：`client.platform.getLaunchContext()` 已能从 preload bridge 读取并归一 `surfaceContext`。
- config/resource/plugin：均已有部分 domain API，但任务010报告指出若干 payload/unwrap/API 覆盖缺口仍属任务010。

### 3.2 `Chips-ComponentLibrary/packages/hooks`：已有主题/token hooks，但没有 Chips Environment

当前 `@chips/hooks` 包已有 React peer dependency，适合作为任务011主要落点：

- `packages/hooks/package.json`：`peerDependencies.react >=18.0.0`。
- `packages/hooks/src/index.js` 当前导出：
  - `ChipsTokenProvider`
  - `ChipsThemeProvider`
  - `useTokenResolver`
  - `useToken`
  - `useComponentTokens`
  - `useThemeRuntime`
  - `subscribeThemeChanged`
  - `applyThemeVariables`
  - `applyThemeVariablesInBatches`
- `packages/hooks/src/index.d.ts` 已有上述声明和 `ThemeRuntimeState/ThemeChangedPayload/ThemeEventSource`。
- `packages/hooks/tests/index.test.mjs` 仅覆盖导出、主题事件订阅、CSS 变量写入和批量应用。

当前缺口：

- 没有 `ChipsEnvironmentProvider/useChipsEnvironment/useChipsClient`。
- 没有面向 SDK client 的 `useChipsTheme/useChipsI18n/useChipsSurface/useChipsPermission/useChipsDiagnostics`。
- 现有 `ChipsThemeProvider` 只接收 `themeId/version/eventSource`，不会主动调用 SDK `client.theme.getCurrent()`，也不读取 Host 当前主题。
- 现有 `ThemeChangedPayload` 同时允许 `themeVersion` 和 `version`，实现里优先读 `payload.version`，而正式公共口径和 SDK 类型为 `themeVersion`。任务011可在 hook 层兼容读取，但正式输出应收口到 `themeVersion`。

### 3.3 `@chips/component-library` 聚合入口已导出 hooks 包

`Chips-ComponentLibrary/packages/component-library/index.js` 与 `index.d.ts` 当前 `export * from "@chips/hooks"`，因此任务011在 `@chips/hooks` 新增 API 后，只要保持无命名冲突，聚合入口会自然导出。

需要注意：聚合入口已因 helper 重名增加别名 `toComponentStandardError/toCardRuntimeStandardError`，任务011新增名称应避免与 `packages/components` 内已有 `useChipsCommands/useChipsCommandContext` 冲突。

### 3.4 `packages/components` 已有命令消费 hook 和 adapter

组件库 components 包已有 command 消费层：

- `createCommandAdapter(client)` 将 SDK `client.command` 转为 `{ listCommands, invokeCommand, onCommandsChanged }`。
- `ChipsCommandProvider` 提供 command context。
- `useChipsCommandContext()` 读取 command context。
- `useChipsCommands()` 通过 adapter 拉取 command list，并订阅 `command.changed` 后刷新。
- `ChipsToolbar/ChipsMenuBar/ChipsContextMenu/ChipsCommandPalette` 已消费上述能力。

结论：任务011的 `useChipsCommand` 不应再建第二套 command registry。更合理边界是：

- 在 `@chips/hooks` 提供面向 SDK client/environment 的 command 注册、调用、订阅 helper。
- 复用 `@chips/components` 已有 `createCommandAdapter/ChipsCommandProvider/useChipsCommands`，或在 `@chips/component-library` 层由应用直接组合。
- 避免 `@chips/hooks -> @chips/components` 引入反向/循环依赖；如果需要复用命令 adapter，应把可共享的最小 adapter 类型留在 components 或聚合使用层，而不是让 hooks 包直接依赖 components 包。

### 3.5 `Chips-Scaffold/chips-scaffold-app`：已用 SDK client，但仍有直接 Bridge 形状

当前 app 模板已经有 SDK client：

- `src/runtime/chips-client.ts.tpl`：`export const chipsClient = createClient();`
- `src/commands/useAppCommands.ts.tpl`：通过 `client.command.register()` 注册命令，通过 `client.command.onInvoked()` 监听命令事件，通过 `client.command.invoke()` 触发命令。
- README 已说明系统能力调用优先通过 `chips-sdk`，必要时才使用 `window.chips.*`。

仍需要任务011后续替换或收敛的部分：

- `src/hooks/useChipsBridge.ts.tpl` 直接返回 `(window as any).chips`，并在未注入时抛错。当前模板 README 也把它列为示例 hooks。这与任务011“应用模板可使用 hooks 替代直接 Bridge 调用”不一致，应在任务011或任务023中移除/替换为官方 `useChipsClient/useChipsEnvironment`。
- `src/App.tsx.tpl` 直接声明 `Window.chips` 事件形状，并把 `window.chips` 作为 `ChipsThemeProvider.eventSource`。
- `src/App.tsx.tpl` 内部私有 `useChipsThemeInfo()` 手写 `chipsClient.theme.getCurrent()`，只初始化一次，没有订阅 `theme.changed` 后刷新，也没有复用官方 hook。
- `ChipsThemeProvider` 使用硬编码 `themeId="chips-official.default-theme"`、`version="1.0.0"`，没有从 Host current theme 初始化。虽然后续 UI 使用 token CSS 变量，但 Provider runtime state 与 Host 当前主题可能不一致。

注意：模板当前没有直接 `window.chips.invoke(...)` 调用；直接 Bridge 暴露主要集中在 `useChipsBridge` 和 theme event source。

### 3.6 `Chips-EcoSettingsPanel`：已有应用私有 runtime provider 和 hooks，可作为迁移参考

设置面板已有一套可复用思路，但位于应用内部，不能直接作为生态公共 API：

- `src/shared/runtime/client.ts`：缓存 `createClient({ environment: "auto" })`。
- `src/app/providers/RuntimeProvider.tsx`：
  - 建立 `RuntimeContext`，包含 `client/eventSource/currentTheme/currentLocale/ready/runtimeError/refreshRuntimeState`。
  - 初始化时并发读取 `client.theme.getCurrent({ appId })` 与 `client.i18n.getCurrent()`。
  - 订阅 `theme.changed` 后重读当前主题。
  - 订阅 `language.changed`，优先使用 payload locale，否则重读当前语言。
- `src/shared/runtime/event-source.ts`：把 `client.events.on` 包装为 `subscribe(eventName, handler)`，刚好可被当前 `ChipsThemeProvider.eventSource` 消费。
- `src/shared/hooks/useHostRefresh.ts`：对任意 Host 事件数组订阅并触发 refresh。
- `src/app/providers/I18nProvider.tsx`：基于 `RuntimeProvider.currentLocale` 提供应用本地 `t()`。
- `useThemeGovernance/useLanguageGovernance/useAppPluginGovernance/useManagedPluginGovernance` 都复用 `useHostRefresh`。

可抽取经验：

- Environment Provider 应提供 `client`、`eventSource`、`currentTheme`、`currentLocale`、`ready/error/refresh`。
- theme/i18n hook 应在事件到达时刷新 Host 状态，且允许 payload 快速更新。
- event source adapter 应基于 SDK `client.events`，而不是直接读取 `window.chips`。

不能直接提前做：

- 不能把设置面板治理业务 hooks 搬入组件库，`useThemeGovernance/useLanguageGovernance` 含设置面板业务状态、反馈队列、插件安装/卸载等，不属于任务011通用 Runtime Environment。
- 不能在设置面板里继续单独演进一套与 `@chips/hooks` 平行的 Runtime Provider；任务011完成后，后续任务028应迁移设置面板复用公共 hooks。

## 4. 建议分层边界

### 4.1 推荐包边界

建议任务011按以下分层交付：

| 层 | 位置 | 职责 | 禁止 |
|---|---|---|---|
| SDK core/domain | `Chips-SDK/src/core`、`src/api`、`src/types` | 纯 TS Runtime Client、domain API、事件和错误类型 | 引入 React；实现 Provider；承载 Host runtime 主实现 |
| React hooks | `Chips-ComponentLibrary/packages/hooks` | React Context、Provider、hooks、SDK client 注入、Host 事件订阅、异步状态封装 | 直接访问 Host 内部包；重新实现 domain wrapper；内置完整 Host mock |
| Component aggregate | `Chips-ComponentLibrary/packages/component-library` | 聚合导出 `@chips/hooks` 与 `@chips/components` | 制造同名导出冲突 |
| Components command consumers | `Chips-ComponentLibrary/packages/components` | command adapter、命令 UI 消费组件 | 建第二套 Host registry |
| App template | `Chips-Scaffold/chips-scaffold-app` | 默认接入 Environment Provider 和 hooks | 保留 `useChipsBridge` 作为默认系统能力入口 |
| EcoSettingsPanel | `Chips-EcoSettingsPanel` | 后续迁移验证公共 hooks | 在任务011中做业务迁移大改 |

### 4.2 `ChipsEnvironmentProvider` 建议语义

建议 `ChipsEnvironmentProvider` 位于 `@chips/hooks`，只做“React 环境注入和 Host 状态读取”，不承载 Host runtime：

建议 props：

- `client?: ClientLike`，可注入真实 `createClient()` 或测试 mock client。
- `createClient?: () => ClientLike`，默认可从 `chips-sdk` 的 `createClient({ environment: "auto" })` 创建。若 hooks 包不直接依赖 SDK 运行时代码，则可要求上层显式传入 client，脚手架负责注入。
- `initialTheme?: ThemeState | null`
- `initialLocale?: string`
- `initialSurface?: SurfaceContext | null`
- `initialPermissions?: string[]`
- `onDiagnostic?: (diagnostic) => void`
- `children`

建议 context value：

- `client`
- `eventSource`，形状至少支持 `subscribe(eventName, handler)`，内部来自 `client.events.on`
- `theme` / `themeStatus` / `refreshTheme`
- `locale` / `i18nStatus` / `t` / `refreshLocale`
- `surfaceContext` / `launchContext` / `refreshSurface`
- `permissions` / `hasPermission(permission)` / `permissionDiagnostics`
- `diagnostics` / `pushDiagnostic` / `clearDiagnostics`
- `ready` / `error` / `refresh`

命名建议：

- Provider 导出 `ChipsEnvironmentProvider`
- 基础 hook 导出 `useChipsEnvironment`
- `useChipsClient` 从 Environment 中取 client；未在 Provider 内且无 fallback client 时抛稳定错误码，如 `CHIPS_ENVIRONMENT_MISSING`

### 4.3 hooks 与现有 `ChipsThemeProvider` 的关系

现有 `ChipsThemeProvider` 是 token/theme runtime provider，任务011不宜删除。建议：

- `ChipsEnvironmentProvider` 负责读取 Host current theme、监听 `theme.changed`、提供 `theme` 状态。
- `useChipsTheme()` 返回环境里的 theme 状态、`applyTheme/getCurrent/refresh/diagnostics` 等。
- 应用根可以用：

```tsx
<ChipsEnvironmentProvider client={chipsClient}>
  <ChipsAppThemeBridge>
    <App />
  </ChipsAppThemeBridge>
</ChipsEnvironmentProvider>
```

其中 `ChipsAppThemeBridge` 可以是新组件，也可以由模板直接：

```tsx
const { theme, eventSource } = useChipsEnvironment();
return (
  <ChipsThemeProvider
    themeId={theme?.themeId ?? "chips-official.default-theme"}
    version={theme?.version ?? "0"}
    eventSource={eventSource}
    eventName="theme.changed"
  >
    {children}
  </ChipsThemeProvider>
);
```

为降低任务011范围，建议 P0 只实现 Provider + hook，并在模板里组合现有 `ChipsThemeProvider`；是否新增 `ChipsRuntimeProvider` 组合组件可放 P1。

### 4.4 权限与诊断边界

当前 SDK 没有 `client.permission.*` domain；权限来源可以来自：

- `client.plugin.getSelf()` 或 `client.platform.getLaunchContext().surfaceContext` 的会话信息，当前 `PlatformLaunchContext` 没有 permissions 字段。
- `plugin.launch()` 返回的 `session.permissions`，但这是启动其他插件时的返回，不等于当前应用权限。
- `StandardError.permission`，用于错误诊断。
- command schema 的 `permission` 字段与 command view diagnostic。

因此 P0 的 `useChipsPermission` 应保持保守：

- 支持从 Provider `initialPermissions` 或 `permissions` props 注入。
- 支持从标准错误 `error.permission` 归一诊断。
- `hasPermission(permission)` 在缺少权限快照时返回 `{ allowed: false, unknown: true }` 或等价结构，避免伪造授权。

不要在任务011发明 `permission.getCurrent` route 或私自从 Host 内部读取权限。

## 5. P0/P1/P2 实施清单

### P0：建立最小正式 Environment 与核心 hooks

建议范围：

- `Chips-ComponentLibrary/packages/hooks/src/index.js`
- `Chips-ComponentLibrary/packages/hooks/src/index.d.ts`
- `Chips-ComponentLibrary/packages/hooks/tests/index.test.mjs` 或新增专项 `.test.mjs`
- `Chips-ComponentLibrary/packages/component-library/tests/index.test.mjs`
- `Chips-Scaffold/chips-scaffold-app/templates/app-standard/src/*`
- 对应模板测试

建议内容：

1. 新增 `ChipsEnvironmentProvider/useChipsEnvironment/useChipsClient`。
2. 新增 `useChipsTheme`：
   - 初始化调用 `client.theme.getCurrent({ appId? })`。
   - 订阅 `theme.changed` 后刷新。
   - 暴露 `theme/loading/error/refresh/applyTheme?`。
   - 不修改 `client.theme` wrapper。
3. 新增 `useChipsI18n`：
   - 初始化调用 `client.i18n.getCurrent()`。
   - 订阅 `language.changed`。
   - 暴露 `locale/loading/error/refresh/translate/setLocale`。
   - `translate` 走 `client.i18n.translate`，允许外部传入 local fallback adapter。
4. 新增 `useChipsSurface`：
   - 优先读取 `client.platform.getLaunchContext().surfaceContext`。
   - 暴露 `surfaceContext/launchContext/refresh`。
   - P0 不做完整 surface lifecycle 状态同步。
5. 新增 `useChipsPermission`：
   - 基于注入权限快照和标准错误权限诊断，不发明新 Host action。
6. 新增 `useChipsDiagnostics`：
   - 统一收集 hooks 运行中的标准错误、主题诊断摘要、权限诊断。
   - 只做客户端侧诊断队列，不调用 `control-plane.*`，避免抢任务010 domain wrapper。
7. 新增 `useChipsCommand`：
   - 提供 `register/list/invoke/onInvoked` 的 hook 友好封装。
   - 复用 SDK `client.command`，并说明 UI 消费仍推荐 `ChipsCommandProvider + createCommandAdapter`。
8. 更新 app 模板：
   - 移除或不再默认引用 `src/hooks/useChipsBridge.ts.tpl`。
   - 用 `ChipsEnvironmentProvider` 和 `useChipsTheme/useChipsI18n/useChipsSurface` 替代 `App.tsx.tpl` 内私有 `useChipsThemeInfo` 和直接 `window.chips` event source。
   - 保持 command 模板继续使用 `client.command` 和 `createCommandAdapter`，不要改成业务函数绑定。
9. 测试：
   - hooks 包用 mock client 验证初始化、事件刷新、取消订阅、错误诊断。
   - 模板测试验证不再包含默认 `useChipsBridge` 直接返回 `window.chips` 的用法。

### P1：补齐环境字段和生态设置面板可迁移入口

1. 补 `ChipsEnvironmentProvider` 的 `appId/pluginId/workspace/platform/capabilities` 字段。
2. `useChipsSurface` 订阅 `surface.opened/focused/resized/stateChanged/closed`，前提是 SDK 或通用 events 口径已明确。
3. `useChipsCommand` 增强：
   - 支持批量注册、自动注销或返回 cleanup。
   - 支持 handler map 在 `command.invoked` 后按 `handlerId` 调度，但仅限插件本地，不传函数给 Host。
4. 提供 `createChipsEventSource(client)` 或等价工具，替代设置面板私有 `createRuntimeEventSource`。
5. 为 `Chips-EcoSettingsPanel` 制定迁移清单：
   - `RuntimeProvider` 可替换为 `ChipsEnvironmentProvider`。
   - `I18nProvider` 可逐步复用 `useChipsI18n`。
   - `useHostRefresh` 可替换为通用 `useChipsEventRefresh`。
6. 补类型 smoke，确保 `@chips/component-library` 聚合入口暴露所有新增 hooks。

### P2：与 State/Binding/Testing 任务衔接

1. 与任务017/任务10阶段衔接 `useChipsState/useChipsAsyncState/useChipsPersistedState/useChipsFormState/useBinding` 等状态/绑定模型。
2. 与任务012衔接统一 mock 包：
   - `createMockChipsClient`
   - `createMockChipsBridge`
   - `renderWithChipsEnvironment`
   - theme/language/surface/permission/timeout/retry 场景 fixture
3. 与任务010衔接补充 hooks 对新增 domain API 的消费：
   - `useChipsConfig`
   - `useChipsResource`
   - `useChipsPlugin`
   - 更完整的 `useChipsDiagnostics` 读取 `control-plane.*`
4. 迁移 `Chips-EcoSettingsPanel` 和应用脚手架后续模板，减少应用私有 runtime provider。
5. 公共文档沉淀：
   - `生态共用技术文档/组件库` 增补 hooks 使用标准。
   - `生态共用技术文档/插件开发/08-SDK使用指南.md` 增补 React 入口使用方式。

## 6. 风险与注意事项

### 6.1 与任务010并行风险

当前 worktree 已有 SDK domain 文件修改痕迹，包括 `card/command/config/file/i18n/resource/theme/index.ts` 等，主代理正在处理任务010。任务011正式开发时必须以任务010收口后的 SDK public API 为准，不要在 hooks 里为当前 wrapper 漂移写临时兼容层。

任务011不能提前做：

- 修正 `config.get/batchSet`、`resource.readMetadata`、`theme.apply`、`i18n.setCurrent` 等 wrapper 的 payload/unwrap。
- 新增 `log/credential/serializer/control-plane` domain。
- 扩展 `route-manifest.json` 或 contract drift 测试。

### 6.2 SDK 与 hooks 包依赖风险

`@chips/hooks` 当前只声明 React peer dependency。如果直接从 `@chips/hooks` import `chips-sdk`，需要确认组件库 package workspace 是否允许该依赖，以及发布包是否应把 `chips-sdk` 作为 peer dependency。较稳妥选择：

- P0 让 `ChipsEnvironmentProvider` 必须接收 `client` 或 `clientFactory`，脚手架传入 `chipsClient`。
- P1 再决策是否在 `@chips/hooks` 内置 `createClient()` 默认工厂，并同步 package dependency/peerDependency。

### 6.3 `ChipsThemeProvider` 与 `ChipsEnvironmentProvider` 双 Provider 风险

如果任务011直接改造现有 `ChipsThemeProvider`，容易把 token provider、Host theme state、SDK client、event source 混成一个大 Provider。建议保持二者分层：

- Environment Provider 读取 Host runtime state。
- Theme Provider 继续负责 token/runtime theme context。
- 模板负责组合，后续可新增薄组合组件。

### 6.4 权限 hook 风险

当前缺少正式当前会话权限查询 API。`useChipsPermission` 若伪造权限结果，会误导组件 enabled/visible 状态。P0 应只消费注入权限和错误诊断，缺少快照时明确 unknown。

### 6.5 事件订阅与测试风险

`client.events.on` 返回取消函数，可以满足 hooks cleanup。需要覆盖：

- Provider unmount 后不再 setState。
- `theme.changed/language.changed/command.changed` 触发后刷新。
- `events.on` 抛 `EVENTS_UNAVAILABLE` 时转换为诊断，不导致整棵树崩溃，除非 `useChipsClient` 缺 Provider。

### 6.6 命名冲突风险

`packages/components` 已有 `useChipsCommands/useChipsCommandContext`。任务011如果新增 `useChipsCommand` 可以接受，但不要新增同名 `useChipsCommands` 或覆盖 components 导出。

### 6.7 文档与实现漂移

公共文档中 Bridge 三层写到 L7 以 `chips-sdk` API 和 Host 内置 UI Hooks 为主入口，但当前仓库真实 React hooks 落在 `Chips-ComponentLibrary/packages/hooks`，SDK 无 React 入口。任务011应把这一点作为正式分层结果沉淀，而不是在 SDK 内新增 React 入口。

## 7. 建议验证命令

任务011正式开发后建议至少运行：

```bash
cd Chips-ComponentLibrary
npm run verify
```

```bash
cd Chips-SDK
npm test
```

由于 SDK `npm test` 当前主要串行 CLI CJS 测试，建议在任务010/011期间额外执行 Vitest domain 测试：

```bash
cd Chips-SDK
npx vitest run tests/client.test.ts tests/resource.test.ts tests/route-manifest.test.ts tests/tooling/contract-drift.test.ts
```

若修改应用脚手架模板：

```bash
cd Chips-Scaffold/chips-scaffold-app
npm run build
npm test
npm run test:templates
npm run test:e2e
```

若后续同步验证设置面板可复用：

```bash
cd Chips-EcoSettingsPanel
npm run verify
```

若只在前置阶段新增本报告，不需要运行上述验证；本轮未运行测试。

## 8. 不能提前做的内容

本任务011前置勘察建议主代理明确禁止以下抢跑：

- 不修改 `Chips-SDK/src/api/*` 的 domain wrapper，这属于任务010。
- 不新增完整 `Chips-SDK` mock bridge/mock client/Host simulator，这属于任务012。
- 不把 React 运行时塞进 SDK core。
- 不让 hooks 直接读取 Host 内部模块、Electron、Node 或 private IPC 通道。
- 不为权限查询发明未在 Host manifest 中存在的新 action。
- 不迁移整个 `Chips-EcoSettingsPanel` 业务治理逻辑，任务011最多提供可迁移公共 hooks。
- 不一次性实现完整 State/Binding/Form/Focus 模型，后续任务017/任务10阶段处理。
- 不用 hooks 包重新实现 command registry 或菜单/工具栏状态机，现有 components 命令消费层已经承担该职责。

## 9. 与任务010/012的接口依赖

### 9.1 依赖任务010

任务011应等待或至少跟随任务010稳定以下接口：

- `client.theme.apply/getCurrent/onChanged` 的返回与事件 payload。
- `client.i18n.setCurrent/getCurrent/translate/listLocales`，以及是否新增 `i18n.onChanged`。
- `client.command` 的 `CommandView/CommandInvokeResult/CommandInvokedEvent` 类型，尤其 `diagnostic`、`invocationId`、`command` 字段。
- `client.config/resource/plugin/platform` 的 unwrap 和新 wrapper，影响后续 P1/P2 `useChipsConfig/useChipsResource/useChipsPlugin/useChipsDiagnostics`。
- `StandardError/PermissionDiagnostic` 最终公开字段，影响 `useChipsDiagnostics/useChipsPermission`。

任务011 P0 可以只依赖已存在的稳定能力：`createClient`、`client.events.on`、`theme.getCurrent/onChanged`、`i18n.getCurrent/translate`、`platform.getLaunchContext`、`command.*`。

### 9.2 依赖任务012

任务011应为任务012预留以下接口形状：

- Provider 支持注入 `client`，而不是在内部硬绑定真实 Host。
- hooks 接受同形 event source 或从 `client.events` 派生 event source。
- 所有异步 hooks 暴露 `loading/error/refresh`，方便 mock 测试断言。
- diagnostics 输出结构化对象，方便 mock permission denied/timeout/retry 场景。
- 不内置完整 mock host；P0 测试可用最小 fake client，任务012再统一成 `@chips/testing` 或 SDK testing helper。

## 10. 结论

当前生态已经具备任务011的基础：

- SDK 有 Runtime Client、events 和核心 domain API。
- 组件库 hooks 包已有 React Provider/hook 基座并被 `@chips/component-library` 聚合导出。
- components 包已有 command adapter 和 command UI 消费层。
- app 脚手架已有 SDK client 与 command 模板。
- EcoSettingsPanel 已有应用私有 RuntimeProvider，可作为公共 Environment Provider 的现实参考。

主要缺口是：缺少正式 `ChipsEnvironmentProvider` 与 `useChipsClient/useChipsTheme/useChipsI18n/useChipsSurface/useChipsPermission/useChipsCommand/useChipsDiagnostics`，导致应用模板和设置面板仍各自手写 runtime 接线；脚手架还保留直接 `window.chips` 示例 hook 和 theme event source。任务011可以推进，但必须避开任务010的 SDK wrapper 修复和任务012的完整 mock simulator。

阻断情况：无绝对阻断。建议主代理先收口任务010 public API，再启动任务011 P0，以免 hooks 对未稳定 wrapper 写临时兼容。
