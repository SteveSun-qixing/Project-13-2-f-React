# 任务007 Host commands 注册与调度前置勘察报告

> 勘察日期：2026-05-23
> 工作区：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048`
> 勘察性质：任务007前置只读分析；本报告为用户授权后写入草稿笔记目录的调研材料。
> 重要状态：当前工作区存在任务006并行实现中的未提交改动，证据以当前文件快照为准，任务007正式开工前需要重新核对任务006最终落地状态。

## 1. 已遵守的工作边界与关键 AGENTS 规则

- 根规则要求修改代码、脚手架或文档前先读设计原稿和共用技术文档；Host 是唯一运行时承载，插件访问系统能力只能走 `window.chips.*` / Bridge / `chips-sdk`；服务间调用必须走内核路由；SDK 只做类型化封装、脚手架和测试辅助；不得做临时版或占位实现：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/AGENTS.md:7`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/AGENTS.md:16`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/AGENTS.md:84`。
- Host 仓规则确认 Host/Bridge/Runtime/CLI 是主实现，必须保持 `PAL -> Kernel -> Services -> Runtime/Bridge` 分层边界；涉及 Bridge、服务域、插件运行时等公共链路需同步核对共用文档和测试：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/AGENTS.md:5`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/AGENTS.md:9`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/AGENTS.md:17`。
- SDK 仓规则确认新能力应在 `src/api`、类型定义、契约清单和测试成体系落地，不得把 Host 运行时逻辑迁入 SDK：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/AGENTS.md:5`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/AGENTS.md:9`。
- 生态共用文档规则要求公共契约变更必须先核对代码、`manifest.yaml`、测试和设计原稿，并同步推动受影响项目收口：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/AGENTS.md:5`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/AGENTS.md:10`。
- 项目日志规则说明这里是工单、排查记录、研究笔记和过程性材料，不是正式公共契约最终发布位置：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/AGENTS.md:5`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/AGENTS.md:17`。
- 脚手架规则要求模板只能消费已经冻结的生态契约，生成产物必须是正式可运行基线，不得把未收口口径写入模板：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/AGENTS.md:5`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/AGENTS.md:10`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/chips-scaffold-app/AGENTS.md:5`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/chips-scaffold-app/AGENTS.md:10`。

## 2. 任务007目标和验收标准准确复述

### 2.1 任务007本体目标

任务007的直接目标是建立 Host command registry，使菜单、工具栏、快捷键、命令面板共享统一 command 语义：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务007-Host-commands注册与调度.md:3`。

任务007开发内容明确包括：

1. 定义 command schema。
2. Host 支持注册、注销、查询、调用 command。
3. 做 command scope 和 permission 校验。
4. Bridge/SDK 暴露正式 action。
5. 测试菜单、工具栏、快捷键复用。

证据：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务007-Host-commands注册与调度.md:17`。

任务007验收标准是：

- command 可被多入口复用。
- 权限不足有标准错误。
- command 文案使用 i18n key。

证据：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务007-Host-commands注册与调度.md:25`。

任务007指定验证命令为 Host `npm run build && npm test && npm run test:contract`，以及 SDK `npm test`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务007-Host-commands注册与调度.md:31`。

### 2.2 上级任务11对任务007的外延要求

任务11目标是建立统一 Navigation / Menu / Toolbar / Command 体系，让应用导航、菜单栏、工具栏、快捷键、命令面板共享同一套命令语义：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务11-导航菜单工具栏与命令系统.md:3`。

任务11要求 Command 模型包含 `commandId`、`titleKey`、`descriptionKey`、`icon`、`shortcut`、`scope`、`enabledWhen`、`visibleWhen`、`permission`、`handlerId`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务11-导航菜单工具栏与命令系统.md:31`。

任务11要求 Host command registry 在应用插件启动时注册 commands，由 Host 维护 command scope，菜单、工具栏、命令面板、快捷键统一从 registry 读取，权限和可用性由 Host/SDK 联合校验：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务11-导航菜单工具栏与命令系统.md:43`。

任务11还提出 SDK command API 形状：`register/unregister`、`invoke`、`list`、`subscribe changed`、React hook `useChipsCommand` 与 `useChipsCommands`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务11-导航菜单工具栏与命令系统.md:49`。

任务11的完整验收比任务007更大：同一个 command 可被 toolbar、menu、shortcut、command palette 使用；command 文案全部走 i18n；command 图标走 `ChipsIcon`；权限不足时自动禁用或隐藏并有标准诊断；新应用模板包含最小 command 示例：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务11-导航菜单工具栏与命令系统.md:88`。

### 2.3 前端框架重构方案对 command 的模型要求

导航 / 菜单 / 工具栏重构方案要求建立统一 Navigation / Presentation / Command 系统，覆盖页面导航、分栏、tab、弹层、菜单、右键菜单、工具栏、快捷键和命令面板：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/04-薯片前端框架开发重构方案/07-导航菜单工具栏重构方案.md:3`。

该方案列出命令能力：`ChipsCommandRegistry`、`ChipsCommand`、`ChipsCommandMenu`、`ChipsCommandGroup`、`ChipsContextMenu`、`ChipsToolbar`、`ChipsToolbarItem`、`ChipsToolbarGroup`、`ChipsShortcut`、`ChipsCommandPalette`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/04-薯片前端框架开发重构方案/07-导航菜单工具栏重构方案.md:29`。

该方案要求命令模型至少包含 `id`、`titleKey`、`descriptionKey`、`icon`、`shortcut`、`scope`、`permission`、`enabled`、`checked`、`handler`、`menuPlacement`、`toolbarPlacement`、`paletteKeywords`，并由菜单栏、右键菜单、工具栏、快捷键、命令面板共同消费：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/04-薯片前端框架开发重构方案/07-导航菜单工具栏重构方案.md:42`。

该方案关键任务包括定义 command registry、Host 菜单和 Electron 快捷键接入 command registry、Toolbar 与 CommandPalette 共享命令、命令 title/description/aria label 走 i18n、命令权限和 enabled 状态接入环境：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/04-薯片前端框架开发重构方案/07-导航菜单工具栏重构方案.md:62`。

## 3. 设计与公共文档基线

### 3.1 架构设计原稿基线

- 生态设计原稿要求模块之间通过内核路由通信；插件渲染进程通过 Bridge API `window.chips.invoke()` 发送请求到主进程，再由内核路由转发；模块之间从不直接通信：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态设计原稿/02-极致模块化架构.md:13`。
- 官方产品统一使用 React：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态设计原稿/02-极致模块化架构.md:21`。
- Host 主责 L1-L9 运行时链路，SDK 仅提供类型、封装、脚手架与测试辅助，不承载运行时主实现：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态设计原稿/02-极致模块化架构.md:25`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态设计原稿/19-SDK与协议.md:15`。
- 前端多样化和主题系统要求业务调用统一走 Host 对外接口与 Bridge API；组件视觉统一由主题系统提供，不允许应用层和组件层硬编码独立皮肤体系：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态设计原稿/06-前端多样化和主题系统.md:12`。
- 运行时 UI 图标统一收口到 `ChipsIcon + IconDescriptor`，应用启动图标继续由 `manifest.ui.launcher.icon` 和 Host 快捷方式链路负责：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态设计原稿/06-前端多样化和主题系统.md:84`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态设计原稿/07-插件系统架构.md:35`。
- 插件运行时安全流水线包含 Manifest 校验、权限快照加载、沙箱注入且只暴露 `window.chips.*`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态设计原稿/07-插件系统架构.md:85`。

### 3.2 Bridge 三层与 Host 服务域公共基线

- `window.chips.*` 是公共接口形状，不是 Electron 私有特性；SDK 只消费 Bridge / Runtime Client 的正式契约：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/13-Bridge三层设计.md:7`。
- 当前 Bridge 核心入口为 `invoke(action, payload?)`、`invokeScoped(action, payload, { token })`、`on`、`once`、`emit`、`emitScoped`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/13-Bridge三层设计.md:31`。
- 当前 Bridge 子域基线包含 `window`、`dialog`、`plugin`、`clipboard`、`shell`、`surface`、`transfer`、`association`、`platform`、`notification`、`tray`、`shortcut`、`ipc`，不包含 `command`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/13-Bridge三层设计.md:47`。
- Bridge / Runtime 事件命名强制采用点语义，不得混用冒号或短横线命名：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/13-Bridge三层设计.md:136`。
- 新增 Bridge 子域时必须同步更新 Host、SDK、路由契约与共享文档：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/13-Bridge三层设计.md:166`。
- Host 服务域当前文档声明已注册 19 个服务域，清单不包含 `command`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/14-Host服务域设计.md:20`。
- Host 服务域新增动作时必须同步更新 route manifest、Bridge、SDK 和共享文档：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/14-Host服务域设计.md:191`。

### 3.3 应用插件与 Manifest 公共基线

- 应用插件访问 Host 能力必须使用 `chips-sdk` 或 `window.chips.*`，不得直接访问 Node.js API、原生窗口对象或私下约定跨应用启动协议绕过 Host：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/02-应用插件开发.md:177`。
- Manifest 配置规范当前重点字段是 `runtime.targets`、`ui.surface`、`capabilityFallbacks`，并说明这些字段已被 Host 运行时、`chipsdev validate`、Scaffold 模板和官方插件清单共同采用：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/06-Manifest配置规范.md:7`。
- Manifest 基础必填字段包括 `id`、`name`、`version`、`type`、`entry`，当前未列出 `commands`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/06-Manifest配置规范.md:27`。
- Manifest 公共字段变化必须同步更新 Host 解析、CLI 校验、Scaffold 模板和共享文档：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/06-Manifest配置规范.md:248`。

## 4. 当前 Host 是否已有 command/menu/toolbar/shortcut registry 或类似能力

结论：当前 Host 没有正式 command registry，也没有 menu/toolbar command registry。已有三类容易混淆的相近能力：插件操作系统快捷方式、平台全局快捷键、L8 声明式 UI 的 `Command` 语义节点。这三者都不能替代任务007要建立的 Host command registry。

### 4.1 Host 服务注册中没有 command 服务域

- Host 服务描述符统一通过 `descriptor(key, permission, timeoutMs, idempotent, retries, handler)` 创建 route descriptor：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:302`。
- 当前 `rawServices` 注册清单包括 `file`、`resource`、`config`、`theme`、`i18n`、`surface`、`transfer`、`association`、`window`、`plugin`、`module`、`platform`、`log`、`credential`、`card`、`box`、`zip`、`serializer`、`control-plane`，没有 `commandService`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:5467`。
- `registerHostServices` 最终只把 `createServices(ctx, runtimeState)` 产生的服务逐个注册到 Kernel，没有额外命令注册入口：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:5492`。

### 4.2 Host schema 注册中没有 command.* route schema

- `registerHostSchemas()` 注册了文件、资源、配置、主题、多语言、surface、transfer、association、window、platform、plugin、module 等 route schema：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-schemas.ts:321`。
- 其中 `surface.*` 只包含 `surface.open/focus/resize/setState/getState/close/list`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-schemas.ts:357`。
- `platform.shortcut*` schema 只覆盖全局快捷键底层原语：`platform.shortcutRegister`、`platform.shortcutUnregister`、`platform.shortcutIsRegistered`、`platform.shortcutList`、`platform.shortcutClear`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-schemas.ts:394`。
- `plugin.*Shortcut` schema 只覆盖插件操作系统快捷方式：`plugin.getShortcut`、`plugin.createShortcut`、`plugin.removeShortcut`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-schemas.ts:411`。
- 该文件没有 `command.register`、`command.unregister`、`command.list`、`command.get`、`command.invoke` 等 schema。

### 4.3 已有插件快捷方式不是 command registry

- Host 有插件快捷方式注册表路径 `plugin-shortcuts.json`，用于记录桌面/启动台入口：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:778`。
- `plugin.getShortcut` 需要 `plugin.read` 权限并读取插件 OS shortcut 状态：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:3689`。
- `plugin.createShortcut`、`plugin.removeShortcut` 需要 `plugin.manage` 权限，创建或移除操作系统入口：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:3702`。
- 这条链路消费的是应用插件 `ui.launcher.displayName` 和 `ui.launcher.icon`，不是运行时 `titleKey/icon/shortcut/scope/handlerId` 的 command 语义，也不支持菜单、工具栏、命令面板复用。

### 4.4 已有 platform.shortcut 是全局快捷键原语，不是 command registry

- `platform.shortcutRegister` 只接收 `accelerator` 和可选 `eventName`，默认触发事件 `platform.shortcut.triggered`，内部调用 `ctx.pal.systemUi.shortcut.register`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:4250`。
- `platform.shortcutUnregister`、`platform.shortcutIsRegistered`、`platform.shortcutList`、`platform.shortcutClear` 只是对 PAL 全局快捷键能力的薄封装：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:4274`。
- 该能力没有 commandId、titleKey、descriptionKey、icon、scope、permission、enabledWhen、visibleWhen、handlerId、menu/toolbar/palette placement 等任务007语义。
- Host 单元测试中 PAL stub 只维护 `state.shortcuts: string[]`，证明现有测试把它当作 accelerator 列表，而非 command 模型：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/tests/unit/host-services-pal-routing.test.ts:20`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/tests/unit/host-services-pal-routing.test.ts:374`。
- 当前平台能力测试也只是调用 `platform.shortcutRegister` 并检查底层快捷键列表：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/tests/unit/host-services-pal-routing.test.ts:824`。

### 4.5 L8 声明式 UI 中有 Command primitive，但它不是 Host command registry

- 声明式 UI 语义原语列表包含 `Command`，modifier 列表包含 `shortcut` 和 `permission`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/renderer/declarative-ui/types.ts:1`。
- `ShortcutModifier` 只有 `key`、`modifiers`、`command`、`when` 字段，表示快捷键到 command id 的声明绑定：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/renderer/declarative-ui/types.ts:89`。
- `PermissionModifier` 只有 `action`、`resource`、`fallback`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/renderer/declarative-ui/types.ts:98`。
- 组合规则允许 Dialog/Tabs/Menu/Form 的某些 slot 使用 `Command` 节点：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/renderer/declarative-ui/composition.ts:56`。
- `node-model.ts` 只校验 `modifiers.shortcut.command` 是非空字符串，不执行命令实现：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/renderer/declarative-ui/node-model.ts:325`。
- 公共文档也明确 `shortcut` 是快捷键到 command id 的声明绑定，不执行命令实现：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/17-L8声明式UI实现与接口细则.md:112`。

### 4.6 任务006当前快照已出现 commandContext，但不是 command registry

- 当前 PAL 类型里已有 `SurfaceCommandContext`，包含 `commandId`、`source`、`payload`；`SurfaceContext` 包含可选 `commandContext`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/packages/pal/src/types.ts:39`。
- Host surface helper 会 clone `context.commandContext` 并带入 `SurfaceContext`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:1006`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:1078`。
- `surface.open(target=plugin)` 当前会把 `request.context` 传入 `openPluginSurface`，插件 surface context 也带 `commandContext`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:3080`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:1213`。
- Preload clone launch context 也复制 `surfaceContext.commandContext`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/preload/create-bridge.ts:256`。
- 这说明任务006正在为命令触发上下文铺路，但当前没有 Host command registry、命令注册表、命令状态或命令调度服务。

## 5. 当前 Bridge/SDK 是否已有 command API

结论：Bridge 和 SDK 当前没有正式 `command` 子域或 `client.command` API；只能通过通用 `invoke/on/emit` 调用未来的 `command.*` route。当前有 `shortcut` Bridge 子域，但它映射的是 `platform.shortcut*` 底层全局快捷键，不是 command API。

### 5.1 Bridge Transport 当前没有 command 子域

- Host Bridge 类型中 `BridgeSurfaceCommandContext` 已存在，用于 surface context，不是命令服务 API：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/packages/bridge-api/src/bridge-transport.ts:121`。
- `ChipsBridge` 公开核心入口为 `invoke`、`invokeScoped`、`on`、`once`、`emit`、`emitScoped`，随后列出 `window/dialog/plugin/clipboard/shell/surface/transfer/association/platform/notification/tray/shortcut/ipc` 等子域，没有 `command`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/packages/bridge-api/src/bridge-transport.ts:214`。
- `shortcut` 子域只暴露 `register/unregister/isRegistered/list/clear`，用于 accelerator：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/packages/bridge-api/src/bridge-transport.ts:308`。
- `BridgeTransport` 实现中的 `this.shortcut.register` 映射到 `platform.shortcutRegister`，不是 `command.invoke`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/packages/bridge-api/src/bridge-transport.ts:576`。

### 5.2 Preload 当前没有 command 权限、channel 或暴露子域

- `HOST_INTERNAL_PERMISSIONS` 不包含 `command.read`、`command.write`、`command.invoke` 或类似权限：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/preload/create-bridge.ts:43`。
- `ACTION_CHANNEL_MAP` 没有 `command.*` 专用子通道；未知 action 会落到通用 `chips:invoke`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/preload/create-bridge.ts:84`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/preload/create-bridge.ts:147`。
- `exposeBridgeToMainWorld` 暴露的对象没有 `command` 字段：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/preload/create-bridge.ts:324`。

### 5.3 IPC 当前没有 command 子通道，但通用 invoke 可承载未来 action

- IPC channel 常量只有 `chips:invoke`、`chips:emit`、`chips:event:`、window/dialog/plugin/clipboard/shell/platform 前缀，没有 command 前缀：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/ipc/chips-ipc.ts:7`。
- `CHIPS_SUBCHANNEL_ACTIONS` 没有 `command.*` 映射：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/ipc/chips-ipc.ts:45`。
- 通用 `chips:invoke` 会校验 `typed.action` 后调用 `kernel.invoke(typed.action, typed.payload ?? {}, context)`，因此未来 `command.*` 可先通过通用通道工作，不一定需要专用 IPC 子通道：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/ipc/chips-ipc.ts:218`。

### 5.4 SDK 当前没有 command API 文件、client.command 或类型导出

- `Chips-SDK/src/api` 当前文件列表包括 `icon/box/config/theme/window/resource/card/platform/association/transfer/zip/file/document/plugin/i18n/module/surface`，没有 `command.ts`。
- SDK BridgeAdapter 只有通用 `invoke` 和事件 API；SDK 侧 `ChipsBridge` 类型仅列出核心 `invoke/on/emit` 和若干可选子域，没有 `command`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/core/bridge-adapter.ts:4`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/core/bridge-adapter.ts:8`。
- `createClient()` 创建 `document/file/card/theme/config/i18n/plugin/module/window/surface/transfer/association/platform/box/resource/zip`，没有 `command`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/core/client.ts:148`。
- `Client` 接口没有 `command` 字段：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/types/client.ts:68`。
- `src/index.ts` 没有导出 command API；当前只导出 `SurfaceCommandContext` 这类 surface 上下文类型，不等于 command 服务：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/index.ts:87`。
- `PluginApi` 只有插件 OS shortcut 相关 `getShortcut/createShortcut/removeShortcut`，没有命令注册或调用 API：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/api/plugin.ts:65`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/api/plugin.ts:76`。

### 5.5 SDK 当前已同步一部分 surface commandContext

- 当前 SDK `SurfaceCommandContext` 包含 `commandId`、`source`、`payload`，`SurfaceContext` 含 `commandContext`，`SurfaceOpenRequest` 含 `context`，`SurfaceState` 含 `context`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/api/surface.ts:22`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/api/surface.ts:28`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/api/surface.ts:60`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/api/surface.ts:67`。
- 当前 SDK `platform.getLaunchContext()` normalize 也会解析 `surfaceContext.commandContext`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/api/platform.ts:225`。
- 这部分属于任务006 Host surface/Scene 上下文相关快照，可供任务007复用，但不能视作 command registry 已完成。

## 6. 当前 manifest 是否已有 commands 字段、校验逻辑、CLI validate 逻辑、脚手架模板字段

结论：当前正式 Manifest 文档、Host runtime manifest 解析、SDK CLI validate、Scaffold app-standard 模板和模板测试均没有 `commands` 字段。任务007如果决定引入 `manifest.commands`，必须作为公共 Manifest 契约变更处理；否则应先采用运行时 `command.register`，把模板和 manifest commands 留到任务11或后续模板接入阶段。

### 6.1 公共 Manifest 文档没有 commands 字段

- 文档定位为插件 `manifest.yaml` 的正式公共契约：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/06-Manifest配置规范.md:3`。
- 当前重点更新字段只有 `runtime.targets`、`ui.surface`、`capabilityFallbacks`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/06-Manifest配置规范.md:7`。
- 基础必填字段未列 `commands`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/06-Manifest配置规范.md:27`。
- 当前 `chipsdev validate` 已正式校验项也不包含 `commands`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/06-Manifest配置规范.md:248`。

### 6.2 Host PluginManifest 类型和解析没有 commands

- Host `PluginManifest` 当前字段为 `id/version/type/name/description/permissions/capabilities/entry/assets/source/signature/ui/runtime/capabilityFallbacks/theme/layout/module`，没有 `commands`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/runtime/plugin-runtime.ts:75`。
- 插件会话只从 `plugin.manifest.permissions` 复制权限快照，没有命令清单加载：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/runtime/plugin-runtime.ts:427`。
- `readManifest()` 解析基础字段、permissions、capabilities、entry/assets、ui、runtime、capabilityFallbacks、theme、layout、module，没有 commands 解析：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/runtime/plugin-runtime.ts:835`。
- `validateManifest()` 校验 plugin id、version、permissions、assets、source/signature、module 等，没有 commands 校验：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/runtime/plugin-runtime.ts:587`。

### 6.3 SDK CLI validate 没有 commands 校验

- `validateManifestShape()` 当前校验 `id/name/version/type/permissions/runtime.targets/capabilityFallbacks/ui.surface/module` 等，没有 commands：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/cli/index.js:986`。
- `handleValidate()` 只调用 `validateManifestShape()`、检查构建输出目录、检查 manifest assets，并输出 summary：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/cli/index.js:1164`。
- CLI dispatcher 中 `validate` 命令直接调用 `handleValidate()`，没有额外 commands 校验分支：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/cli/index.js:1800`。

### 6.4 Scaffold app-standard 模板没有 commands 字段

- app-standard `manifest.yaml.tpl` 包含 `permissions`、`runtime.targets`、`capabilityFallbacks`、`ui.layout`、`ui.launcher`、`ui.surface`、`ui.window.chrome`，没有 `commands`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/chips-scaffold-app/templates/app-standard/manifest.yaml.tpl:1`。
- 模板当前只默认声明 `theme.read` 与 `i18n.read` 权限，没有 `command.*` 权限：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/chips-scaffold-app/templates/app-standard/manifest.yaml.tpl:18`。
- 模板 App 示例直接通过 `window.chips.invoke("theme.getCurrent", {})` 读取主题，未使用 SDK command API 或 command 注册：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/chips-scaffold-app/templates/app-standard/src/App.tsx.tpl:15`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/chips-scaffold-app/templates/app-standard/src/App.tsx.tpl:24`。
- 模板测试只断言 `type: app`、`frame: true`、`runtime.targets`、`ui.surface`、组件库依赖等，没有 commands 断言：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/chips-scaffold-app/tests/template-engine.test.ts:58`。

## 7. 推荐的任务007架构方案

### 7.1 总体落点

建议任务007新增独立 Host 服务域 `command`，成为第 20 个 Host service。理由：

- command 是菜单、工具栏、快捷键、命令面板共享的跨入口语义，不应塞入 `platform`、`plugin` 或 `surface`。
- `platform.shortcut*` 是系统快捷键原语，`plugin.*Shortcut` 是操作系统启动入口，两者职责都不等于 command registry。
- 公共文档已明确服务域新增动作必须同步 route manifest、Bridge、SDK、共享文档。

推荐首批 route actions：

1. `command.register`
2. `command.unregister`
3. `command.get`
4. `command.list`
5. `command.invoke`

可选但建议预留的数据/事件能力：

- `command.update`：如果任务007要支持 enabled/checked 动态变更，可加入；否则先通过重新 register 覆盖同 owner command。
- `command.resolveInvocation` / `command.rejectInvocation`：如果任务007要求 `command.invoke` 返回业务 handler 结果，需要增加这类调用结果回填动作；如果验收只要求 dispatch 和复用，首轮可以返回 `{ invocationId, dispatched: true }`。

### 7.2 Command 数据模型建议

建议 Host 内部存储结构分为 `CommandDefinitionInput`、`RegisteredCommand`、`CommandView`：

```ts
type CommandScopeKind = "global" | "app" | "scene" | "surface" | "document";
type CommandSource = "menu" | "toolbar" | "shortcut" | "palette" | "context-menu" | "api";

interface CommandDefinitionInput {
  commandId: string;
  titleKey: string;
  descriptionKey?: string;
  ariaLabelKey?: string;
  icon?: IconDescriptor;
  shortcut?: CommandShortcut | CommandShortcut[];
  scope?: CommandScope;
  permission?: string | string[];
  enabledWhen?: CommandCondition;
  visibleWhen?: CommandCondition;
  checkedWhen?: CommandCondition;
  handlerId: string;
  menuPlacement?: CommandMenuPlacement[];
  toolbarPlacement?: CommandToolbarPlacement[];
  paletteKeywords?: string[];
}

interface RegisteredCommand extends CommandDefinitionInput {
  ownerPluginId?: string;
  ownerCallerId: string;
  ownerSessionId?: string;
  registeredAt: number;
  updatedAt: number;
}
```

关键约束：

- `commandId` 必须非空，建议采用 `pluginId.commandName` 或 reverse-domain 风格；Host 应记录 `ownerPluginId`，同一个 owner 内唯一。
- `titleKey` 必填，`descriptionKey`、`ariaLabelKey` 可选；不得允许 `title`、`description` 这类最终文案进入 command schema，避免违反 i18n 规则。
- `icon` 使用 `IconDescriptor` 语义，后续由组件库 `ChipsIcon` 消费；不得在 command registry 里混入启动器图标路径。
- `shortcut` 是 command 级语义快捷键绑定，不直接等同 `platform.shortcutRegister`。Host 可在桌面端把全局或当前 surface scope 的 shortcut 映射到底层 PAL，但 registry 仍保留 commandId 作为源。
- `permission` 是 command 被调用所需的业务权限；Host 在 register 时校验 owner 是否声明这些权限，在 list/invoke 时校验调用方是否具备这些权限。
- `enabledWhen/visibleWhen/checkedWhen` 首轮建议只支持结构化、可校验的小表达式或明确枚举，不要引入第三方表达式库；若条件语言未收口，应先只支持静态 boolean 或省略，并在任务10 State/Environment/Binding 接入时扩展。
- `menuPlacement/toolbarPlacement/paletteKeywords` 是同一个 command 的多入口消费元数据，不应由菜单/工具栏各自重复定义。

### 7.3 Handler 和调度设计

推荐采用 Host registry + 事件调度 + SDK 本地 handler 表的组合：

1. 插件调用 SDK `client.command.register(definition, handler)`。
2. SDK 在页面侧生成或使用 `handlerId`，把 handler 放入本地 handler map。
3. SDK 调 Host `command.register`，只传可序列化 definition 和 `handlerId`。
4. Host 存储 command 元数据、owner caller、owner plugin/session/scope。
5. 菜单、工具栏、快捷键、命令面板调用 `command.invoke`，传入 `commandId`、`source`、`payload`、`context`。
6. Host 做存在性、scope、permission、visible/enabled 校验，生成 `invocationId`。
7. Host 发出 `command.invoke.requested` 事件，payload 包含 `invocationId`、`commandId`、`handlerId`、`ownerPluginId`、`sceneId`、`surfaceId`、`source`、`payload`。
8. SDK 事件订阅器只处理匹配自身 owner/session/plugin 的 invocation，执行本地 handler。

关于 `command.invoke` 返回值有两种可选闭环：

- 最小闭环：`command.invoke` 返回 `{ invocationId, dispatched: true }`，SDK handler 的业务结果不作为 Host route 返回值。这足以支持菜单、工具栏、快捷键、命令面板复用和权限错误验收。
- 完整闭环：新增 `command.resolveInvocation` / `command.rejectInvocation`，Host 在 `command.invoke` 内等待回填结果，超时则返回 `COMMAND_HANDLER_TIMEOUT`。这更完整，但实现复杂度更高，涉及 pending invocation 状态、超时、重复回填、owner session 失效清理。若任务007主代理想一次性做“调用 command 返回结果”，建议采用此闭环。

不建议把 handler 函数直接传给 Host；Host/Bridge 只应传输可序列化数据。也不建议让菜单/工具栏直接调用 Host 内部服务，任务11明确禁止：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/05-开发任务方案/任务11-导航菜单工具栏与命令系统.md:110`。

### 7.4 Scope 模型建议

建议 `CommandScope`：

```ts
interface CommandScope {
  kind: "global" | "app" | "scene" | "surface" | "document";
  appId?: string;
  sceneId?: string;
  surfaceId?: string;
  documentId?: string;
}
```

校验策略：

- `global`：Host 或有高权限插件可注册；普通插件默认不应注册真正 global command，除非声明 `command.global` 或类似权限。
- `app`：默认 owner plugin 范围；`ownerPluginId` 必须匹配调用方 pluginId。
- `scene`：必须有 `sceneId`，与当前任务006 scene/surface context 对齐。
- `surface`：必须有 `surfaceId`，用于窗口、route、modal、sheet 等容器内命令。
- `document`：必须有 `documentId`，用于文件/卡片/箱子对象命令。

`command.list` 应支持 filter：`scope`、`source`、`ownerPluginId`、`includeDisabled`、`includeHidden`。默认只返回当前调用方有权限且当前上下文可见的 `CommandView`；如果返回 disabled/hidden 诊断，需要明确 `disabledReason` / `hiddenReason`，满足“权限不足自动禁用或隐藏，并有标准诊断”的任务11要求。

### 7.5 Permission 模型建议

服务级权限建议：

- `command.read`：`command.get` / `command.list`。
- `command.write`：`command.register` / `command.unregister` 自己拥有的 command。
- `command.invoke`：`command.invoke`。
- 可选 `command.manage`：Host 或管理类插件跨 owner 管理 command；普通插件不应拥有。

命令级权限建议：

- `CommandDefinitionInput.permission` 表示执行该 command 需要的业务权限，可为字符串或字符串数组。
- Host 在 `command.register` 时校验 owner plugin 的 manifest permissions 包含命令级 permission，避免插件注册自己无权执行的命令。
- Host 在 `command.invoke` 时校验调用方拥有 `command.invoke` 和 command-specific permissions。
- 权限不足沿用现有标准错误 `PERMISSION_DENIED`，因为 Host 已有 `ensureCallerPermission()` 统一抛出该错误，并带 `action/permission/callerId/callerType` details：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts:1118`。
- command 语义错误可新增：`COMMAND_NOT_FOUND`、`COMMAND_ALREADY_REGISTERED`、`COMMAND_SCOPE_INVALID`、`COMMAND_DISABLED`、`COMMAND_HANDLER_UNAVAILABLE`、`COMMAND_HANDLER_TIMEOUT`。

### 7.6 事件命名建议

遵守点语义，推荐事件：

- `command.registered`
- `command.unregistered`
- `command.changed`
- `command.invoke.requested`
- `command.invoke.completed`
- `command.invoke.failed`

payload 最少包含：

- `commandId`
- `ownerPluginId`
- `ownerSessionId`
- `invocationId`（invoke 相关事件）
- `source`
- `sceneId`
- `surfaceId`
- `documentId`
- `payload`
- `diagnostic` 或 `error`（失败/禁用时）

### 7.7 与 scene/surface context 的关系

任务006当前快照已经给 `SurfaceContext` 加了 `commandContext`，任务007应该直接复用该槽位，而不是另建平行上下文。

建议：

- `command.invoke` 入参支持 `context?: { sceneId?, surfaceId?, documentId?, pluginId? }` 和 `source?: CommandSource`。
- 当 command handler 需要打开新 surface 时，SDK 或 Host 应把触发信息写入 `surface.open({ context: { commandContext: { commandId, source, payload } } })`。
- `surface.opened` / `scene.active` 等事件已有 `sceneId/surfaceId` 生命周期 payload，任务007只需在 command 事件里引用同一上下文，不要复制 scene runtime。
- 对于 shortcut 触发，Host 需要把 `source: "shortcut"` 和原始 accelerator 一起放入 invocation payload，便于 UI 诊断。

### 7.8 SDK API 形状建议

新增 `Chips-SDK/src/api/command.ts`，并在 `createClient()` 挂载 `client.command`。

建议 API：

```ts
interface CommandApi {
  register(definition: CommandDefinitionInput, handler?: CommandHandler): Promise<RegisteredCommandView>;
  unregister(commandId: string): Promise<void>;
  get(commandId: string, options?: CommandQueryOptions): Promise<CommandView | undefined>;
  list(options?: CommandQueryOptions): Promise<CommandView[]>;
  invoke(commandId: string, payload?: Record<string, unknown>, options?: CommandInvokeOptions): Promise<CommandInvokeResult>;
  onChanged(handler: (event: CommandChangedEvent) => void): () => void;
  onInvokeRequested(handler: (event: CommandInvokeRequestedEvent) => void): () => void;
}
```

SDK 职责边界：

- SDK 做类型封装、参数轻校验、本地 handler map 和事件订阅。
- SDK 不持久化 Host command registry，不绕过 Host 做权限/scope 决策。
- SDK 的 React hooks `useChipsCommand/useChipsCommands` 是任务11明确目标；任务007可以只补基础 API，或在 Host/SDK API 稳定后补轻量 hook，但不要为了 hook 引入未收口 UI 状态架构。

### 7.9 Manifest commands 建议

当前建议任务007首轮不要引入 `manifest.commands`，除非主代理明确决定把 command 声明作为公共 Manifest 契约同步落地。理由：

- 任务007本体说“定义 command schema”，上下文更像 Host route/schema 与注册数据模型，不一定是 Manifest schema。
- 当前公共 Manifest 文档、Host runtime、CLI validate、Scaffold 模板全部没有 `commands`。
- 脚手架 AGENTS 要求模板只能消费已冻结公共契约，不能把未收口口径写入模板。

如果后续要引入 `manifest.commands`，建议字段形状为：

```yaml
commands:
  - commandId: chips.example.open-settings
    titleKey: app.commands.openSettings.title
    descriptionKey: app.commands.openSettings.description
    icon:
      name: settings
      style: rounded
    scope:
      kind: app
    permission:
      - config.read
    handlerId: open-settings
    shortcut:
      accelerator: CommandOrControl+,
```

一旦采用 Manifest commands，必须同步修改 Host runtime manifest 类型/解析/校验、SDK CLI validate、Scaffold 模板、模板测试、共享 Manifest 文档和应用插件开发文档。

## 8. 后续需要修改的文件清单

### 8.1 Host

- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-host-services.ts`
  - 新增 command registry 状态、command service、`command.register/unregister/get/list/invoke` descriptors。
  - 复用 `ensureCallerPermission()` 风格做服务级权限。
  - 实现 owner/scope/permission/visible/enabled 校验。
  - 发出 `command.*` 事件。
  - 在 plugin disable/uninstall/session stop 时清理 owner commands，避免悬挂 handler。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/services/register-schemas.ts`
  - 注册 `command.register`、`command.unregister`、`command.get`、`command.list`、`command.invoke` 的 request/response schema。
  - 对 `titleKey`、`handlerId`、`commandId`、scope、permission、shortcut 做结构校验。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/packages/bridge-api/src/bridge-transport.ts`
  - 增加 Bridge `command` 子域类型和实现，映射到 `command.*` actions。
  - 继续保留通用 `invoke`，但正式 API 应暴露子域。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/packages/bridge-api/src/index.ts`
  - 若新增 command 类型需要对外导出，从 bridge-api 入口同步导出。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/preload/create-bridge.ts`
  - 将 `command` 子域暴露到 `window.chips.command`。
  - 更新 `HOST_INTERNAL_PERMISSIONS` 加入 command 相关权限。
  - 通常无需新增专用 IPC channel，因为通用 `chips:invoke` 能承载；若新增专用 channel，必须同步 `chips-ipc.ts`。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/main/ipc/chips-ipc.ts`
  - 仅当决定为 command 增加专用 subchannel 时修改；否则不必改。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/src/runtime/plugin-runtime.ts`
  - 如果只做运行时注册，可能只需暴露 session/plugin lifecycle 钩子供 command service 清理。
  - 如果新增 `manifest.commands`，必须增加 `PluginManifest.commands` 类型、解析、校验、安装/启用时注册策略。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/packages/pal/src/types.ts`
  - 当前已有 `SurfaceCommandContext`；任务007正式开工前需核对任务006最终形状，必要时补齐 command source 枚举或 payload 类型。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/tests/unit/host-services-pal-routing.test.ts`
  - 增加 command register/list/get/invoke/unregister 单元测试。
  - 覆盖权限不足 `PERMISSION_DENIED`。
  - 覆盖 `titleKey` 必填且禁止 raw title。
  - 覆盖同一 command 被 `source: menu/toolbar/shortcut/palette` 调用。
  - 覆盖 unregister 和 plugin disable/uninstall 清理。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/tests/contract/route-manifest.contract.test.ts`
  - 将 `command.*` actions 加入 required list。
  - SDK route manifest 必须同步，否则该测试会失败：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/tests/contract/route-manifest.contract.test.ts:156`。

### 8.2 SDK

- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/api/command.ts`
  - 新增 Command 类型、API、createCommandApi。
  - 做基础参数校验：`commandId/titleKey/handlerId` 非空，payload 是 record。
  - 维护 SDK 本地 handler map 和 command invoke 事件过滤。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/core/client.ts`
  - 导入 `createCommandApi` 并挂载 `command: createCommandApi(core)`。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/types/client.ts`
  - `Client` 增加 `command: CommandApi`。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/index.ts`
  - 导出 Command API 与类型。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/contracts/route-manifest.json`
  - 增加 `command.register/unregister/get/list/invoke`，必须与 Host route manifest 对齐。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/tests/client.test.ts`
  - 增加 SDK command wrapper 测试，断言 action/payload 正确、返回结构解包、事件订阅可用。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/tests/tooling/contract-drift.test.ts`
  - 当前测试会扫描 SDK `client.invoke("...")` 使用到的 action 并要求存在于 SDK route manifest：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/tests/tooling/contract-drift.test.ts:61`。新增 command API 后该门禁会自动捕获漏加 manifest 的问题。

### 8.3 Scaffold

任务007核心不建议立即改模板，除非主代理决定同时落地 Manifest commands 或任务11“新应用模板包含最小 command 示例”。如果改，需要同步：

- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/chips-scaffold-app/templates/app-standard/manifest.yaml.tpl`
  - 若采用运行时注册：至少补 `command.read`、`command.write`、`command.invoke` 权限。
  - 若采用 `manifest.commands`：增加最小 commands 示例，文案只写 i18n key。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/chips-scaffold-app/templates/app-standard/src/App.tsx.tpl`
  - 使用 SDK `client.command.register(...)` 注册最小 command，并从 command 生成 toolbar 示例。
  - 不要直接在菜单/快捷键里绑定业务函数。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Scaffold/chips-scaffold-app/tests/template-engine.test.ts`
  - 增加模板中 command 权限、commands 字段或 command API 使用的断言。

### 8.4 Docs

公共契约应落在 `生态共用技术文档/`，项目日志只保留本报告和过程记录。

建议文档修改：

- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/14-Host服务域设计.md`
  - 服务域数量从 19 更新为 20，新增 `command` 服务域、actions、权限、事件。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/13-Bridge三层设计.md`
  - 当前 Bridge 子域基线增加 `command`。
  - L6/L7 当前能力增加 `client.command.*`。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/协议与接口标准/02-Bridge-API规范.md`
  - 增加 `window.chips.command` 子域和 `command.*` action 入参/返回/错误。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/02-应用插件开发.md`
  - 说明应用插件如何通过 SDK 注册 command、如何使用 i18n key、如何处理权限不足。
- `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/06-Manifest配置规范.md`
  - 仅在采用 `manifest.commands` 时修改；否则不要提前写未实现字段。
- 建议新增公共契约文档：
  - `/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/协议与契约/命令系统契约.md`
  - 内容包括 command 数据模型、scope、permission、事件、SDK API、与 surface/scene context 的关系。

### 8.5 Tests and validation

任务007最小验证闭环：

1. `cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host && npm run build`
2. `cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host && npm test`
3. `cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host && npm run test:contract`
4. `cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK && npm test`
5. 需要额外确认 SDK Vitest client 测试如何执行，因为当前 SDK `package.json` 的 `npm test` 只串联 CLI smoke tests，未明显覆盖 `tests/client.test.ts`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/package.json:16`。

## 9. 当前测试和契约门禁证据

- Host contract test 明确 required route actions，当前 required list 不包含 `command.*`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/tests/contract/route-manifest.contract.test.ts:21`。
- Host contract test 会读取 SDK `src/contracts/route-manifest.json` 并要求 SDK routes 与 Host routes 完全一致：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/tests/contract/route-manifest.contract.test.ts:156`。
- SDK route manifest 当前有 `platform.shortcut*`、`plugin.*Shortcut`、`surface.*`，没有 `command.*`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/contracts/route-manifest.json:279`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/contracts/route-manifest.json:303`、`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/contracts/route-manifest.json:366`。
- SDK tooling `assertKnownAction` 只按 manifest 校验 action 是否存在；新增 command API 后必须把 action 加入 route manifest：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/src/tooling/route-manifest.ts:18`。
- SDK client test 当前覆盖 surface/platform/transfer/association 等 wrapper，没有 `client.command` 测试：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/tests/client.test.ts:34`。

## 10. 可能风险

1. 把 `platform.shortcut*` 误当成 command registry。它只是全局 accelerator 原语，不含 i18n、scope、permission、handler、多入口 placement。
2. 把 `plugin.createShortcut` 误当成 command。它是操作系统启动入口，不是运行时菜单/工具栏/命令面板命令。
3. 在 SDK 保存 Host command registry 状态。SDK 只能做封装和本地 handler map，最终 registry 与权限/scope 裁决必须在 Host。
4. 给 `manifest.yaml` 加 `commands` 但未同步 Host runtime、CLI validate、Scaffold、共享文档，会违反 Manifest 公共字段变更规则。
5. 只更新 Host route，不更新 SDK route manifest，会直接触发 Host contract drift 测试失败。
6. `command.invoke` 是否等待 handler 结果需要提前定。若先做 dispatch-only，应在公共契约里明确返回 `{ invocationId, dispatched: true }`；不要让调用方误以为能拿到业务返回值。
7. `enabledWhen/visibleWhen` 条件语言尚未从 State/Environment/Binding 任务收口，任务007不应临时引入字符串表达式执行器或第三方库。
8. 当前任务006未提交改动已经触及 surface/scene/commandContext；任务007正式开工前必须重新拉一次当前代码行号和类型，避免基于中间态实现。

## 11. 最小可验收闭环

任务007的最小闭环建议为：

1. Host 新增 `command` 服务域，支持 `register/unregister/get/list/invoke`。
2. 注册 command 时强制 `commandId/titleKey/handlerId`，禁止 raw 文案字段。
3. Host 维护 owner、scope、permission、source-agnostic command metadata。
4. `command.list` 能按 `source: "menu" | "toolbar" | "shortcut" | "palette"` 返回同一 command 的可消费 view。
5. `command.invoke` 对权限不足抛 `PERMISSION_DENIED`，对 missing command 抛 `COMMAND_NOT_FOUND`。
6. Bridge 暴露 `window.chips.command.*`。
7. SDK 暴露 `client.command.*` 并有 wrapper 测试。
8. Host/SDK route manifest 同步。
9. Host 单元测试覆盖注册、查询、调用、注销、权限错误、i18n key 必填、多入口复用。
10. 公共文档同步新增 command 服务域和 Bridge/SDK API；若不加 `manifest.commands`，文档明确“任务007采用运行时注册”。

## 12. 文档与代码不一致 / 架构缺口与工单建议

### 12.1 不需要为“当前没有 command registry”单独登记工单

当前没有 command registry 是任务007的目标缺口，不是已经发布契约与代码的漂移。任务007文档明确要建立 Host command registry：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务007-Host-commands注册与调度.md:3`。

### 12.2 建议登记工单：Bridge API 使用指南仍保留旧 invoke(service, method, payload) 口径

证据：

- 正式 Bridge API 规范已经冻结为 `invoke(action, payload?)`，动作名为 `namespace.action`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/协议与接口标准/02-Bridge-API规范.md:31`。
- Bridge 三层设计也写明当前核心入口是 `invoke(action, payload?)`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/架构设计/13-Bridge三层设计.md:31`。
- 但插件开发下的 Bridge API 使用指南仍写 `window.chips.invoke(service, method, payload)`，并解释 service/method 双参数：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/生态共用技术文档/插件开发/07-Bridge-API使用指南.md:13`。
- 真实代码 `ChipsBridge.invoke(action, payload?)` 与正式规范一致：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-Host/packages/bridge-api/src/bridge-transport.ts:214`。

建议工单标题：`工单XXX-Bridge API 使用指南仍保留旧 invoke service-method 口径`。

影响：任务007编写 command API 文档和示例时必须绕开该旧口径，优先引用正式 Bridge API 规范和三层设计。

### 12.3 建议登记工单：SDK npm test 可能未覆盖 SDK Vitest client wrapper 测试

证据：

- 任务007验证命令要求 `cd ../Chips-SDK && npm test`：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/项目日志与笔记/task022-优化薯片组件库和主题系统/06-工单级开发任务/任务007-Host-commands注册与调度.md:31`。
- 当前 SDK `package.json` 的 `test` 脚本只串联 CLI smoke/create/package/module invoke 相关脚本，未看到运行 Vitest client tests：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/package.json:16`。
- 用户指定必须勘察的 `Chips-SDK/tests/client.test.ts` 是 SDK wrapper 的核心测试承载文件，任务007新增 `client.command` 后理应覆盖这里：`/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-worktree-20260523-161048/Chips-SDK/tests/client.test.ts:34`。

建议工单标题：`工单XXX-SDK npm test 未覆盖 client wrapper Vitest 测试门禁`。

影响：任务007如果只跑 `npm test`，可能漏掉 `client.command` wrapper 行为或 route-manifest drift tooling 测试。正式实现时应确认是否新增 package script，或在任务007验证说明里补充 `npx vitest run tests/client.test.ts tests/tooling/contract-drift.test.ts`。

### 12.4 暂不建议因任务006中间态登记工单

当前 `git status --short` 显示 Host/SDK surface、bridge、runtime、tests 等多处文件已被并行任务006修改。任务007勘察发现 `SurfaceCommandContext` 已出现在 Host PAL、Bridge API、SDK surface/platform 类型中，但这些改动尚未提交。建议任务007正式开工前等待任务006完成后重新核对，不应在任务006进行中把中间态当作文档/代码漂移登记工单。
