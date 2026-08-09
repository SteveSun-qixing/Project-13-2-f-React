# 生态设置面板

> 插件 ID：`com.chips.eco-settings-panel`  
> 工程来源：`chips-scaffold-app` 标准应用插件模板  
> 当前阶段：已迁移至 Ant Design 技术栈，废弃主题/多语言/组件展示体系，保留应用插件与运行时插件治理、预览与质量入口

## 项目定位

生态设置面板是薯片生态与 Host 的统一运行时设置入口，采用 `AppRoot / AppRuntimeProvider / scene-registry / commands` 应用插件 vNext 入口结构，UI 层统一使用 antd + `@chips/ui` 共享层。当前治理入口覆盖以下一级能力：

- 应用插件：安装、启用、停用、卸载应用插件，并展示运行时状态与系统快捷方式治理。
- 卡片插件：按 `plugin.query({ type: "card" })` 管理基础卡片插件安装、启停、卸载和能力标识。
- 箱子布局插件：按 `plugin.query({ type: "layout" })` 管理布局插件安装、启停、卸载和布局类型。
- 模块插件：按 `plugin.query({ type: "module" })` 管理功能模块插件安装、启停、卸载和能力集合。
- 预览与质量：展示 `chipsdev-r preview/component gallery/theme inspect/quality gate/diagnostics` 正式报告命令入口。

主题治理、多语言治理、主题诊断与组件展示已随废弃体系移除（代码归档于 `归档/2026-08-08-antd迁移-废弃体系归档/`），Host 侧主题/多语言服务面不在插件侧重构范围内。

## 快速开始

```bash
cd <生态工作区>/Chips-EcoSettingsPanel
npm run dev
```

说明：

- 本工程依赖通过生态根工作区解析，不单独维护 `file:` 临时依赖。
- 运行态能力只能通过 Host Bridge / `chips-sdk` 调用，不允许直接越层访问 Host 内部模块。
- 插件治理的正式接口口径以 `生态共用技术文档/协议与接口标准/07-运行时设置治理接口标准.md` 为准。

## 当前工程结构

```text
Chips-EcoSettingsPanel/
├─ manifest.yaml
├─ package.json
├─ chips.config.mjs
├─ index.html
├─ config/
├─ src/
│  ├─ app/            # AppRoot / AppShell / scene-registry / providers
│  ├─ commands/       # settings-commands.tsx / useSettingsCommands.ts
│  ├─ features/       # app-plugins / runtime-plugins / preview-quality
│  ├─ lib/            # messages.ts（中文文案表）
│  ├─ shared/         # runtime 适配、hooks、ui（antd 化组件）
│  └─ main.tsx
├─ assets/
├─ tests/
├─ 需求文档/
├─ 技术文档/
└─ 开发计划/
```

## 交付约束

- 使用 React + antd + `@ant-design/icons` + `@chips/ui` 共享层 + `chips-sdk`。
- 界面文案统一从 `src/lib/messages.ts` 中文文案表取用，禁止业务层硬编码界面文案。
- 视觉统一走 antd `ConfigProvider`（`@chips/ui` 的 `appleTheme` 苹果风格），禁止散落第二套色板。
- 不引入未审批的第三方库；状态管理、服务适配与测试优先使用现有生态能力与原生 React 方案。
- 如开发过程中发现生态契约缺口、组件缺失、SDK/Host 接口不可用，必须先登记 `项目日志与笔记/问题工单.md` 并停止继续推进对应功能。

## 执行入口

- `npm run dev`：启动开发服务器。
- `npm run build`：构建插件产物。
- `npm run typecheck`：执行严格 TypeScript 编译检查。
- `npm test`：执行测试。
- `npm run lint`：执行 ESLint。
- `npm run validate`：执行插件契约校验。
- `npm run verify`：串行执行 `lint -> typecheck -> test -> build -> validate`。

## 当前实现状态

- 已完成注册表驱动的设置壳层与 5 个一级 Scene：应用插件、卡片插件、布局插件、模块插件、预览与质量。
- 根组件采用统一样板：`ConfigProvider(zhCN, appleTheme) + App + ChipsProvider + CommandProvider + RuntimeProvider + AppRuntimeProvider + AppShell`。
- 命令系统已本地化：`settings-commands.tsx` 导出共享层 `CommandItem[]`，经 `useCommandRegistry` 注册；Host 侧 `client.command.register/invoke/onInvoked/unregister` 链路保持不变，`manifest.yaml` 保留 `command.read/write/invoke`。
- 左侧导航使用 antd `Layout/Menu` 保持左导航 + 内容布局语义，顶部菜单栏/工具栏/命令面板由共享层 `AppChrome` 提供。
- 治理列表已从 `ChipsDataGrid` 迁移为 antd `Table`（`rowKey` 必填、行/列交互等价还原）。
- 已从 `manifest.yaml` 与 `settings-permissions.ts` 移除 `theme.read`、`i18n.read`；`theme.write`、`i18n.write` 按卸担计划保留。
- 已移除主题/多语言运行时读取与 `theme.changed` / `language.changed` 订阅，运行时就绪态改为 `platform.getInfo()` 探活。
- 已完成 `chips-sdk` 运行时服务适配层与错误归一化，插件治理的业务逻辑与权限拒绝诊断语义不变。
- 应用插件治理页当前优先展示 `PluginShortcutRecord.iconPath`，缺失时回退到 antd 语义图标，不再显示 emoji 或路径字符串。

## 聚焦验证

权限与 Host smoke 相关修改可优先执行：

```bash
npm test -- runtime-permissions.test.ts settings-commands.test.tsx runtime-hooks.test.tsx basic-flow.test.ts host-smoke.test.ts
```

提交前仍以 `npm run verify` 作为最终质量门禁。

## 已知边界

- 完整 CLI JSON 报告的运行时读取需要正式报告消费链路，当前预览与质量页只展示正式命令入口和边界。
- Vite 构建存在单 chunk 超过 500 kB 的非阻塞提示，后续全生态质量门禁或性能任务再统一处理。
- `theme.write` / `i18n.write` 权限随卸担计划保留但当前无消费方，Host 侧服务面统一清理时另行立项。
