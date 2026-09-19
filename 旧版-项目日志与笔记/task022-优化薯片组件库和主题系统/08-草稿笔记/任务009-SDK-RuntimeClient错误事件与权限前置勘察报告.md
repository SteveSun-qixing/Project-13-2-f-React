# 任务009 SDK RuntimeClient 错误事件与权限前置勘察报告

> 生成时间：2026-05-23 22:51:16 CST
> 勘察范围：`Chips-SDK/src/core`、`Chips-SDK/src/types`、`Chips-SDK/src/api`、`Chips-SDK/tests`、`Chips-Host/src/preload`、`Chips-Host/src/main/ipc`、`Chips-Host/src/main/services`、`Chips-Host/src/renderer/runtime-client.ts`、`Chips-Host/packages/kernel`、`Chips-Host/packages/bridge-api`、`Chips-Host/tests`、`生态设计原稿/` 与 `生态共用技术文档/` 中 Bridge、服务、错误、事件、权限相关口径。
> 工作边界：本轮只读勘察并写入本草稿报告；未修改源码、测试、公共文档，未执行 `git add/commit`，未切换分支。

## 1. 本轮必须继续遵守的边界

- 根 `AGENTS.md` 明确 Host 是唯一运行时承载，插件访问系统能力只能通过 `window.chips.*`、Bridge、`chips-sdk` 正式链路；服务间调用必须走内核路由；SDK 只负责类型化封装、脚手架和测试辅助，不承载 Host 运行时主实现。
- `Chips-SDK/AGENTS.md` 要求新能力优先在 `src/api`、类型定义、契约清单和测试中成体系落地；若 Host、SDK、共享文档口径不一致，先登记工单再收口，不让 SDK 单方面漂移。
- `Chips-Host/AGENTS.md` 要求保持 `PAL -> Kernel -> Services -> Runtime/Bridge` 分层边界；涉及 Bridge、服务域、主题运行时、插件运行时、CLI 或渲染链路时必须同步核对共用文档和测试。
- 本次用户授权的唯一写入文件就是本报告；后续任务009正式开发前，仍需重新核对当前主代理任务008.2 的最终落地状态。

## 2. SDK RuntimeClient 当前真实入口

### 2.1 创建入口和类型入口

- SDK 对外入口是 `Chips-SDK/src/index.ts`，导出 `createClient`、`Client`、`ClientConfig`、`SdkLogRecord`、`SdkLogger`、`StandardError`，以及各 Domain API 类型。
- Runtime Client 的 SDK 实现入口是 `Chips-SDK/src/core/client.ts`：
  - `createCoreClient(config)` 根据 `environment/transport/bridgeScope` 选择 `BridgeAdapter`。
  - `createClient(config)` 在 core 上挂载 `document/file/card/theme/config/i18n/command/plugin/module/window/surface/transfer/association/platform/box/resource/zip`。
  - `invoke(action, payload)` 负责调用 adapter、记录成功/失败日志、根据 `retryable` 做指数退避重试。
- SDK Bridge 适配入口是 `Chips-SDK/src/core/bridge-adapter.ts`：
  - `ChipsBridge` 定义 `invoke/invokeScoped/on/once/emit/emitScoped` 和部分子域类型。
  - `createPluginBridgeAdapter(scope)` 绑定 `window.chips`，支持 scoped invoke/emit。
  - `createTransportAdapter(transport)` 用自定义 transport 加本地 `Map<string, Set<handler>>` 实现测试/Node 事件。
- SDK 类型入口：
  - `Chips-SDK/src/types/client.ts` 定义 `ClientConfig`、`SdkLogger`、`EventsApi`、`CoreClient`、`Client`、`InvocationContext`。
  - `Chips-SDK/src/types/errors.ts` 定义 `StandardError`、`isStandardError()`、`createError()`。
  - `ClientConfig.timeoutMs` 当前注释为“具体超时由 Host/Bridge 控制，本字段仅用于未来扩展与诊断”；SDK `invoke()` 当前没有真正使用 `timeoutMs`。

### 2.2 当前错误处理

- `Chips-SDK/src/types/errors.ts` 的 `StandardError` 字段是 `code/message/details/retryable/requestId/traceId`；但 `createError()` 只创建 `code/message/details/retryable`，不会写入 `requestId/traceId`。
- `Chips-SDK/src/core/client.ts` 的 `normalizeError(err)` 会：
  - 原样返回已符合 `StandardError` 的对象。
  - 对 `{ code, message, details, retryable, requestId, traceId }` 形状做浅归一。
  - 其他异常归一为 `INTERNAL_ERROR`。
- `Chips-SDK/src/core/bridge-adapter.ts` 的 `unwrapBridgeError()` 会：
  - 识别标准错误。
  - 识别普通 `{ code, message }` 对象。
  - 识别 Host IPC 编码错误前缀 `__chips_ipc_error__:` 并 JSON 解码。
- 当前 SDK 日志只在 `invoke` 成功/失败时写 `level/time/action/message/details`；失败日志 details 包含 `code/attempt/retryable`，但没有把 `requestId/traceId` 提升为日志顶层字段。
- 当前 SDK 自动重试只看 `stdErr.retryable` 和 `ClientConfig.retries`；没有按 route idempotent、错误类别、权限拒绝等做更细判断。

### 2.3 当前事件订阅

- `Chips-SDK/src/types/client.ts` 的 `EventsApi` 是 `on(event, handler): () => void`、`once(event, handler): void`、`emit(event, payload): Promise<void>`。
- `Chips-SDK/src/core/bridge-adapter.ts` 中：
  - plugin bridge 的 `on()` 直接返回 Host `window.chips.on()` 的取消函数。
  - plugin bridge 的 `once()` 不返回取消函数。
  - transport adapter 的 `on()` 可取消，`once()` 内部调用 `this.on()` 并自动取消，但类型仍返回 `void`。
  - `emit()` 对自定义 transport 是本地广播；对 plugin bridge 是 `window.chips.emit()` 或 `emitScoped()`。
- Domain API 事件现有入口：
  - `Chips-SDK/src/api/command.ts`：`onRegistered/onUnregistered/onChanged/onInvoked` 分别订阅 `command.registered/unregistered/changed/invoked`。
  - `Chips-SDK/src/api/theme.ts`：`onChanged` 订阅 `theme.changed`。
  - card/box/document 内部还有 iframe `postMessage` 事件桥，但不等于 Runtime Client 全局 Bridge 事件。

### 2.4 当前权限相关 API

- SDK 没有独立 `client.permission.*` API，也没有结构化 `PermissionDeniedError` 类型。
- 权限以字符串散落在 Domain API 类型和 manifest/route 约束中：
  - `Chips-SDK/src/api/command.ts` 的 `CommandDefinitionInput.permission?: string | string[]`，仅校验非空字符串；`CommandState` 支持 `disabledReasonKey/hiddenReasonKey`。
  - `Chips-SDK/src/api/module.ts` 的 `ModuleProviderRecord.permissions: string[]` 暴露模块 provider 权限快照。
  - `Chips-SDK/src/api/plugin.ts` 的 `plugin.launch()` 返回 `session.permissions`。
- 当前 SDK 侧权限错误只能作为 Host 抛出的 `StandardError` 透传；没有统一补齐 `domain/action/resource`、`required/granted`、`messageKey` 或设置面板可识别结构。

## 3. Host Bridge、服务注册与权限拒绝真实实现位置

### 3.1 Bridge Transport 与 preload

- Host Bridge 类型和子域实现位于 `Chips-Host/packages/bridge-api/src/bridge-transport.ts`：
  - `ChipsBridge` 定义 `invoke/invokeScoped/on/once/emit/emitScoped` 以及 `window/surface/command/transfer/association/platform/...` 子域。
  - `BridgeTransport` 构造函数把 `command.register/unregister/get/list/invoke/setState` 映射到 `command.*` route。
  - `on/once/emit` 通过 `HostAccessTransport` 或本地 `EventEmitter` 实现；`emit()` 当前返回 `void`，内部 `void this.transport.emit(...)`。
- preload 创建和暴露入口位于 `Chips-Host/src/preload/create-bridge.ts`：
  - `HOST_INTERNAL_PERMISSIONS` 当前包含 `command.read/write/invoke/manage` 以及常见 Host 内部权限。
  - `buildContext()` 每次 Bridge 调用生成 `requestId`，并把 `caller.permissions` 写入 `RouteInvocationContext`。
  - `decodeIpcError()` 解码 `__chips_ipc_error__:`。
  - `createBridgeForKernel()` 在 Electron 环境走 IPC；无 Electron 时走 direct `kernel.invoke()`。
  - `invokeScoped/emitScoped` 将 `scope` 一并传给 IPC。
  - `exposeBridgeToMainWorld()` 暴露 `window.chips`，其中包含 `command` 子域。
- Electron IPC 绑定位于 `Chips-Host/src/main/ipc/chips-ipc.ts`：
  - `buildContext()` 从 renderer 请求恢复 `requestId/caller/permissions/windowId`。
  - `applyScopedContext()` 校验 scoped token，并把 caller 替换为解析出的插件会话与权限快照。
  - `enforcePluginQuota()` 可抛 `PLUGIN_QUOTA_EXCEEDED`，`retryable=true`。
  - `invokeHandler()` 调 `kernel.invoke(action, payload, context)`，catch 后通过 `encodeIpcError()` 包装标准错误。
  - `emitHandler()` 将 renderer emit 送入 `kernel.events.emit()`，metadata 包含 `pluginId/windowId`。
  - `forwardKernelEvents()` 把 `kernel.events` 的所有事件广播到 `chips:event:<eventName>`。

### 3.2 Kernel Router、EventBus 与权限 Guard

- `Chips-Host/packages/kernel/src/router.ts` 是服务调用的核心：
  - `invoke()` 顺序为 route lookup、熔断检查、权限检查、schemaIn 校验、防重放、handler 超时执行、schemaOut 校验。
  - `guardPermissions()` 使用 `PermissionGuard.check(required, context.caller.permissions)`，失败抛 `PERMISSION_DENIED`，details 只有 `required/granted`。
  - `invokeWithTimeout()` 超时抛 `ROUTE_TIMEOUT` 且 `retryable=true`。
  - 幂等 route 会按 descriptor `retries` 重试 `retryable` 错误。
- `Chips-Host/packages/common-basics/src/permission.ts` 的 `PermissionGuard` 当前只是字符串集合全包含判断：`required.every(permission => grantedSet.has(permission))`。
- `Chips-Host/packages/kernel/src/event-bus.ts`：
  - `on(pattern, handler)` 返回取消函数。
  - `once(pattern, handler)` 也返回取消函数。
  - `emit(name, source, data, metadata)` 生成 `EventPayload`，支持 `*` 与 `namespace.*` 匹配。
  - handler timeout 抛 `EVENT_HANDLER_TIMEOUT`。

### 3.3 Host 服务注册中与错误、事件、权限相关的位置

- `Chips-Host/src/main/services/register-host-services.ts` 的 `descriptor(key, permission, timeoutMs, idempotent, retries, handler)` 是所有 route descriptor 工厂；权限口径在每个 route 的 `permission: string[]` 中声明。
- command 相关权限与事件：
  - `ensureCallerPermission(routeContext, permission, action)` 额外用于 command 业务权限，失败抛 `PERMISSION_DENIED`，details 含 `action/permission/callerId/callerType`，但不是 `required/granted` 数组。
  - `buildCommandDiagnostic()` 在命令不可用时给 `disabledReasonKey`，权限不足时默认 `chips.command.permissionDenied`。
  - `ensurePluginOwnsCommandPermissions()` 校验注册方插件 manifest 是否声明 command-specific permission，失败抛 `COMMAND_PERMISSION_UNDECLARED`。
  - `command.invoke` 先检查服务级 `command.invoke`，再逐个检查 command.permission；成功后通过 `kernel.events.emit('command.invoked', ...)` 分发，不传业务 handler 函数。
- surface/plugin/module/theme 相关事件：
  - `scene.created/active/inactive/closed`、`surface.opened/focused/resized/stateChanged/closed`、`window.opened` 在 surface/window 路径发出。
  - `plugin.init/ready/launched` 在插件会话路径发出。
  - `module.runtime.started/stopped`、`module.job.progress/completed/failed` 在模块路径发出。
  - `theme.changed` 在 theme apply 路径发出，payload 已包含 `diagnosticsSummary`。
- 插件运行时权限快照位于 `Chips-Host/src/runtime/plugin-runtime.ts`：
  - `PluginManifest.permissions: string[]`。
  - `pluginInit()` 把 manifest permissions 复制到 `PluginSession.permissions`。
  - `createBridgeScope()` 和 `resolveBridgeScope()` 用 session 权限生成 scoped Bridge 上下文。
  - `ensurePermission(pluginId, permission)` 也会抛 `PERMISSION_DENIED`，details 只有 `pluginId/permission`。

### 3.4 Host 内置 RuntimeClient 与 SDK RuntimeClient 的差异

- Host 内置 RuntimeClient 在 `Chips-Host/src/renderer/runtime-client.ts`，不是 SDK 文件。
- 它已有 SDK 任务009目标中的一部分能力：
  - `invokeWithTimeout()` 实际做 `RUNTIME_TIMEOUT`。
  - `withRetry()` 对 `retryable` 错误做重试。
  - `on()` 保存订阅并返回取消函数，`off(event, handler?)` 支持定点或整事件取消。
  - `invokeBatch()` 返回 `{ ok, data/error }`。
- 但这属于 Host 内置 L6 runtime；任务009若改 SDK，应复用契约口径，不应把 Host 主实现迁入 SDK。

## 4. 当前测试覆盖情况

### 4.1 SDK 可扩展测试

- `Chips-SDK/tests/client.test.ts` 当前覆盖：
  - 自定义 transport 和各 Domain API 的 action/payload 映射。
  - `command.*` SDK API、`command.changed` 事件取消。
  - `theme.resolve/theme.contract.get/theme.changed` 诊断结构与事件取消。
  - `bridgeScope` 使用 `invokeScoped`。
  - 无 transport 且无 `window.chips` 时抛 `BRIDGE_UNAVAILABLE`。
  - plugin bridge 可解码 `__chips_ipc_error__:` 标准错误。
- 明显缺口：
  - 没有 SDK `retries` 行为测试。
  - 没有 SDK `logger` 结构测试，尤其 `requestId/traceId/action/duration/errorCode`。
  - 没有 SDK `timeoutMs` 行为测试；当前代码也未实现。
  - 没有 `PERMISSION_DENIED` 归一测试，尤其 settings panel 可识别 details/messageKey。
  - 没有 `events.once()` 可取消测试，因为当前类型不返回取消函数。
  - 没有 `emitScoped` 错误归一测试。
  - 没有 Bridge unavailable 诊断 details 测试，例如 environment、hasWindow、hasChips、action。
- `Chips-SDK/tests/tooling/contract-drift.test.ts` 只扫描 `client.invoke("action")` 是否在 route manifest 中；任务009若新增 API 不一定触发 route manifest 变化，但若新增权限诊断 action 或 permission API，就要补 manifest/contract 测试。

### 4.2 Host 可扩展测试

- `Chips-Host/tests/unit/kernel-router.test.ts` 当前覆盖：
  - route 权限不足抛 `PERMISSION_DENIED`。
  - retryable/idempotent 重试。
  - 非幂等 requestId 防重放。
  - 熔断。
- `Chips-Host/tests/unit/chips-ipc.test.ts` 当前覆盖：
  - IPC invoke/event 通道。
  - plugin message-rate quota。
  - scoped bridge context 会在权限检查前解析。
  - Electron invoke handler 的结构化错误解码。
- `Chips-Host/tests/unit/bridge-transport.test.ts` 当前覆盖：
  - BridgeTransport invoke 和事件订阅取消。
  - 子域 action 映射，包括 `command.invoke`。
- `Chips-Host/tests/unit/runtime-client.test.ts` 当前覆盖 Host 内置 RuntimeClient：
  - legacy action alias。
  - retryable 重试。
  - runtime timeout。
  - `off()` 取消事件订阅。
- `Chips-Host/tests/unit/host-services-pal-routing.test.ts` 当前覆盖：
  - `surface.open(target=plugin)` 权限不足抛 `PERMISSION_DENIED` 且不创建窗口/会话。
  - command 注册/查询/调用事件、command i18n key 和 undeclared permission 拒绝。
  - command 权限诊断通过 `disabledReasonKey: chips.command.permissionDenied`。
- 明显缺口：
  - Kernel `PERMISSION_DENIED` details 与 `ensureCallerPermission()` details 形状不一致，当前无统一测试。
  - Host `StandardError` 类型无 `requestId/traceId/messageKey`，IPC 编码也不会自动补 requestId。
  - Bridge `emit()` 在 `BridgeTransport` 类型返回 `void`，SDK `ChipsBridge.emit()` 期望 `Promise<void>`；当前无类型级契约测试抓这个差异。
  - `EventBus.once()` 返回取消函数，但 Bridge/SDK 的 `once()` 仍是 `void`；当前无端到端 once cancellation 测试。
  - 权限 domain/action/resource 结构化模型未落地，Host 无对应 schema/测试。

## 5. 与 task000~008 已冻结公共契约的关联

- task000 冻结了职责边界：Host 是 L1-L9 主承载，SDK 只做调用封装、测试辅助和开发工具包。任务009不能把 Host `RuntimeClient` 主实现搬到 SDK，只能对 SDK `createClient()` 做类型化封装、错误归一、诊断和辅助重试。
- task001 已修复 Host route manifest 与 SDK route manifest 漂移，并建立 Host/SDK route 一致性测试。任务009若新增任何正式 action，必须同步 `Chips-SDK/src/contracts/route-manifest.json`、Host route manifest 合同测试、公共 Bridge/服务文档。
- task002/task003 已在 L8 中冻结 `PermissionModifier { action, resource?, fallback }` 和事件只允许 handler id；这说明权限 UI 语义已经有 `action/resource/fallback`，任务009 的权限错误 details 建议至少能映射到 `action/resource`，避免 L8 modifier 和 RuntimeClient 错误两套语言。
- task004/task005 已冻结 L9 诊断需要结构化、可 JSON 序列化、可被 CLI/设置面板消费。任务009 的错误 Envelope 不应只返回人类 message，应保留 code、messageKey、details、requestId/traceId、retryable 等机器可读字段。
- task006 冻结 surface/scene 生命周期事件和 `SurfaceCommandContext`；任务009 事件 API 需要继续遵守点语义事件命名和可取消订阅。
- task007 冻结 command 契约：
  - command 文案只用 `titleKey/descriptionKey/ariaLabelKey`。
  - `permission` 表示执行 command 所需业务权限，注册方插件必须在 manifest permissions 中声明。
  - Host 完成 scope/权限/状态校验后发出 `command.invoked`。
  - 权限不足在 command view 中可表现为 `disabledReasonKey: chips.command.permissionDenied`。
- task008.1 冻结主题诊断 Schema：
  - `ThemeDiagnostic` 必含 `messageKey`，支持 `suggestionKey/details/blocking`。
  - `theme.changed` 只带诊断摘要，不替代完整诊断。
  - 任务009 若定义通用错误诊断，建议学习该口径：messageKey 面向多语言，details 面向机器和调试，summary/diagnostics 分层。
- 公共协议当前存在现实差异：
  - `生态共用技术文档/协议与接口标准/01-薯片协议规范.md` 与 `协议与契约/02-服务协议标准.md` 的 `StandardError` 仍是 `code/message/details/retryable`。
  - SDK `StandardError` 已多出 `requestId/traceId`。
  - Host `src/shared/types.ts` 的 `StandardError` 仍没有 `requestId/traceId/messageKey`。
  - 任务009 若要冻结错误 Envelope，需要同步公共文档和 Host/SDK 类型，不能只在 SDK 私自扩展。

## 6. 推荐任务009改动清单

### 6.1 SDK 文件

- `Chips-SDK/src/types/errors.ts`
  - 定义统一 `StandardError`/`StandardErrorEnvelope`，建议包含 `code/message/messageKey?/details?/retryable?/requestId?/traceId?/cause?/permission?`。
  - 定义权限诊断类型，例如 `PermissionDiagnostic { domain/action/resource?/required/granted/messageKey }`。
  - 增加 `normalizeStandardError()`，不要让 `client.ts` 和 `bridge-adapter.ts` 各自浅归一。
- `Chips-SDK/src/core/client.ts`
  - 生成或接收 SDK 层 `requestId`，日志成功/失败都带 `requestId/action/durationMs/attempt/errorCode/retryable`。
  - 真正实现 `timeoutMs`，或明确改名/移除“默认超时”误导；任务009目标包含超时，建议实现。
  - 重试逻辑继续只对 `retryable=true` 生效，并避免权限类错误被重试。
  - Bridge unavailable 错误补 details：`environment/hasWindow/hasChips/action`，并给稳定 `messageKey`。
- `Chips-SDK/src/core/bridge-adapter.ts`
  - 复用统一错误归一函数。
  - `once()` 建议返回取消函数，使 `on/once` 语义一致；plugin bridge 若底层 `window.chips.once()` 无取消能力，可用 `on()` 自行实现 once wrapper。
  - 对 `emit/emitScoped` 错误也做 `unwrapBridgeError()`，当前 invoke 已做但 emit 未包 catch。
- `Chips-SDK/src/types/client.ts`
  - 更新 `EventsApi.once()` 返回类型。
  - 更新 `SdkLogRecord` 顶层字段，至少容纳 `requestId/traceId/errorCode/durationMs/attempt/retryable`。
  - 如新增权限诊断 API，挂入 `Client`。
- `Chips-SDK/src/api/command.ts`
  - 确保 `CommandInvokedEvent.error` 使用统一 `StandardError` 类型。
  - 若权限错误归一后带 `permission.messageKey`，command 状态仍保留 `disabledReasonKey/hiddenReasonKey`，不要冲突。
- `Chips-SDK/src/api/theme.ts`
  - 保持 task008.1 `ThemeDiagnostic.messageKey` 口径；不要把通用错误 messageKey 和主题 diagnostics 混为同一类型。
- `Chips-SDK/src/index.ts`
  - 导出新增错误/权限诊断类型。
- `Chips-SDK/tests/client.test.ts`
  - 增加 SDK retry、timeout、logger、permission denied、Bridge unavailable diagnostics、once cancellation、emitScoped error 归一测试。
- `Chips-SDK/tests/tooling/contract-drift.test.ts` 与 `src/contracts/route-manifest.json`
  - 仅在新增正式 action 时同步。

### 6.2 Host 文件

- `Chips-Host/src/shared/types.ts`
  - 若公共契约冻结错误 Envelope，Host `StandardError` 需补 `requestId/traceId/messageKey` 等字段。
- `Chips-Host/src/shared/errors.ts`
  - `toStandardError()`/`createError()` 支持保留和补齐 requestId、traceId、messageKey、permission diagnostics。
- `Chips-Host/packages/kernel/src/router.ts`
  - `guardPermissions()` 的 `PERMISSION_DENIED` details 与 `ensureCallerPermission()` 统一。
  - 建议把 `context.requestId` 写入最终错误，至少在 Router catch 外层统一补齐。
- `Chips-Host/src/main/ipc/chips-ipc.ts`
  - `encodeIpcError()` 可接收/补齐当前 `RouteInvocationContext.requestId`，保证 SDK 可拿到 requestId。
  - scoped bridge invalid/unavailable 也按统一错误结构返回。
- `Chips-Host/src/preload/create-bridge.ts`
  - `ChipsBridge.emit()` 类型/实现与 SDK 对齐为 Promise 或 SDK 兼容 void；避免 Bridge 类型分裂。
  - `decodeIpcError()` 保留新增错误字段。
- `Chips-Host/src/main/services/register-host-services.ts`
  - command、surface、plugin、module 等手写 `PERMISSION_DENIED` details 对齐统一权限诊断。
  - 如果要公开 `permission.check/diagnose`，必须走正式 route descriptor，不要在 SDK 私造。
- `Chips-Host/src/runtime/plugin-runtime.ts`
  - `ensurePermission()` 的 details 对齐统一权限诊断。
- `Chips-Host/src/renderer/runtime-client.ts`
  - 作为 Host 内置 RuntimeClient，可作为行为参考；若公共契约变化，也需要同步类型和测试，但不要让 SDK 依赖该实现。

### 6.3 公共文档

- `生态共用技术文档/协议与接口标准/01-薯片协议规范.md`
  - 更新标准错误对象/错误 Envelope，明确 `requestId/traceId/messageKey/permission` 是否正式字段。
- `生态共用技术文档/协议与契约/02-服务协议标准.md`
  - 更新 `RouteInvocationContext`、错误码、重试、权限拒绝 details。
- `生态共用技术文档/架构设计/13-Bridge三层设计.md`
  - 更新 L6 Runtime Client 的错误归一、超时、重试、事件 on/once/emit 语义。
- `生态共用技术文档/协议与接口标准/02-Bridge-API规范.md`
  - 明确 `on/once` 是否都可取消，`emit` 返回 Promise，错误如何归一。
- `生态共用技术文档/插件开发/08-SDK使用指南.md`
  - 增加 SDK RuntimeClient 错误、权限拒绝、事件取消、Bridge unavailable 诊断使用方式。
- `生态共用技术文档/插件开发/06-Manifest配置规范.md`
  - 如果权限从纯字符串升级为 `domain/action/resource` 结构，需要在这里冻结；如果仍是字符串权限，则明确映射规则。

### 6.4 测试文件

- SDK：
  - `Chips-SDK/tests/client.test.ts`：主扩展点。
  - `Chips-SDK/tests/route-manifest.test.ts`、`tests/tooling/contract-drift.test.ts`：仅 action 变化时扩展。
  - CLI 相关 `run-cli-*.cjs`：若错误输出/权限诊断影响 CLI，再补。
- Host：
  - `Chips-Host/tests/unit/kernel-router.test.ts`：统一权限拒绝 details、requestId 注入。
  - `Chips-Host/tests/unit/chips-ipc.test.ts`：IPC 编码错误保留 requestId/messageKey/permission。
  - `Chips-Host/tests/unit/bridge-transport.test.ts`：on/once/emit 语义与类型行为。
  - `Chips-Host/tests/unit/runtime-client.test.ts`：Host 内置 RuntimeClient 与公共契约同步。
  - `Chips-Host/tests/unit/host-services-pal-routing.test.ts`：command/surface/plugin 权限拒绝统一。
  - `Chips-Host/tests/contract/route-manifest.contract.test.ts`：新增 route 时同步。

## 7. 潜在架构风险

1. **标准错误字段不一致**：SDK `StandardError` 已有 `requestId/traceId`，Host `StandardError` 和公共文档未冻结这些字段；如果任务009只改 SDK，会形成公共契约漂移。
2. **权限口径散落**：Kernel Router、command `ensureCallerPermission()`、PluginRuntime `ensurePermission()` 的 `PERMISSION_DENIED` details 形状不同；设置面板难以稳定识别。
3. **domain/action/resource 尚未统一**：L8 `PermissionModifier` 已有 `action/resource/fallback`，route descriptor 使用字符串权限，command 使用 `permission: string|string[]`；当前没有正式 `domain/action/resource` 权限对象。
4. **SDK timeout 是声明未实现**：`ClientConfig.timeoutMs` 当前没有实际效果，任务009目标包含超时，必须补实现或调整契约说明。
5. **事件 once 不能取消**：Host `EventBus.once()` 可取消，但 Bridge/SDK `once()` 返回 `void`，与“事件订阅可取消”验收不完全一致。
6. **Bridge emit 类型分裂**：Host `BridgeTransport.emit()` 是 `void`，SDK `ChipsBridge.emit()` 期望 `Promise<void>`；运行时可 await void，但类型和错误传播口径不稳。
7. **SDK 可能重复 Host RuntimeClient 行为**：Host 已有内置 `src/renderer/runtime-client.ts`。SDK 应实现消费侧封装，不应引入 Host 内部依赖或复制 Host 主运行时职责。
8. **Bridge unavailable 诊断不足**：当前只有 `BRIDGE_UNAVAILABLE` message，没有环境、action、window/chips 探测细节，不利于应用和设置面板提示。
9. **requestId 生成位置需要谨慎**：Host preload/IPC 已生成 requestId；SDK 自定义 transport 场景没有 Host context。任务009应明确 SDK requestId 与 Host requestId 的关系，避免双 requestId 互相覆盖。

## 8. 建议任务009实施顺序

1. 先冻结公共错误 Envelope 和权限拒绝 details 口径：字段、messageKey、多语言键、requestId/traceId 归属。
2. 同步 Host `StandardError` 类型和 IPC 错误编码，保证 SDK 可以真实收到同一结构。
3. SDK 提取统一错误归一工具，再改 `client.ts` 和 `bridge-adapter.ts`。
4. 实现 SDK timeout、logger 顶层 requestId、retry 测试；确保权限错误不可重试。
5. 调整 SDK `EventsApi.once()` 为可取消并补 plugin/custom transport 测试。
6. 最后同步公共文档、SDK 使用指南和相关 Host/SDK 单测。

## 9. 本轮最重要结论

- SDK RuntimeClient 的真实入口是 `Chips-SDK/src/core/client.ts` 与 `src/core/bridge-adapter.ts`，类型入口是 `src/types/client.ts` 与 `src/types/errors.ts`；当前已有错误归一和 retryable 重试雏形，但 timeout、requestId 日志、权限诊断还没完整落地。
- Host 真实权限检查在 Kernel Router、command 手写检查、PluginRuntime 会话权限快照三处；当前都抛 `PERMISSION_DENIED`，但 details 形状不一致。
- Host Bridge/IPC 已能把标准错误经 `__chips_ipc_error__:` 传给 SDK，但 Host `StandardError` 本身还没有 `requestId/traceId/messageKey`，任务009不能只在 SDK 私自扩展。
- 事件系统底层支持取消订阅，但 SDK/Bridge 的 `once()` 仍不可取消，和任务009验收“事件订阅可取消”存在差距。
- 权限 `domain/action/resource` 目前没有统一公共结构：L8 modifier 有 `action/resource`，Host route/command 仍是字符串权限，任务009需要先收口口径再实现。
