# 薯片组件库（Chips Component Library）

薯片组件库是薯片生态的 L10 无头组件层实现仓库。

- 技术栈：React + Ark UI + Style Dictionary + Tamagui (Core)
- 核心定位：在 Ark UI 原语基础上二次封装，提供统一契约、状态机、无障碍与主题接口点
- 样式原则：组件零视觉硬编码，视觉完全由主题系统注入
- 生态特有组件：`EmbeddedDocumentFrame`、`CardCoverFrame`、`CompositeCardWindow`（iframe 高级组件）

## 仓库目标

1. 建立可持续演进的无头组件标准
2. 统一生态插件的组件接口与行为语义
3. 为应用插件、卡片插件、布局插件提供稳定组件能力
4. 保证和 Host/SDK/Theme Runtime 的协议一致性

## 文档入口

- 项目内部技术文档：`技术文档/00-文档索引.md`
- 生态共用组件库文档：`../生态共用技术文档/组件库/00-组件库文档索引.md`
- 开发阶段计划：`开发计划/00-开发计划索引.md`

## 当前开发进度（代码）

- 已创建 Monorepo 基线（`packages/*` + `packages/adapters/*` workspace）
- 已落地 Card Runtime 组件实现（`EmbeddedDocumentFrame`、`CardCoverFrame`、`CompositeCardWindow`）与适配器契约
- 已落地 token 构建产物（CSS/JSON/TS/diff）与主题契约校验脚本
- 已建立统一验证入口：`npm run verify`（token 校验 + 构建 + contract 校验 + 全量测试）
- 已落地主题运行时核心能力（作用域解析器、`ChipsThemeProvider`、`useToken/useComponentTokens`、分片变量注入）
- 已落地 Primitive 与 A11y 基建（`Box/Inline/Stack/Grid/Text/Label/HelperText` + FocusScope、focus trap/restore、roving tabindex、keyboard map、ARIA 工具）
- 已落地 Base-Interactive 组件（`ChipsButton`、`ChipsInput`、`ChipsCheckbox`、`ChipsRadioGroup`、`ChipsSwitch`、`ChipsSelect`、`ChipsDialog`、`ChipsPopover`、`ChipsTabs`、`ChipsMenu`、`ChipsTooltip`）及对应 token/contract
- 已落地 Data-Form 第一批组件（`ChipsFormField`、`ChipsFormGroup`、`ChipsVirtualList`）及对应 token/contract
- 已落地 Data-Form 第二批组件（`ChipsDataGrid`、`ChipsTree`、`ChipsDateTime`、`ChipsCommandPalette`）及对应 token/contract
- 已落地 Workbench 第一批组件（`ChipsSplitPane`、`ChipsDockPanel`、`ChipsInspector`、`ChipsPanelHeader`、`ChipsCardShell`、`ChipsToolWindow`）及对应 token/contract
- 已落地 Stage8 System-UX 组件（`ChipsErrorBoundary`、`ChipsLoadingBoundary`、`ChipsNotification`、`ChipsToast`、`ChipsEmptyState`、`ChipsSkeleton`）及对应 token/contract
- 阶段七交付补齐：交互状态图与键盘清单（`技术文档/22-阶段七交互状态图与键盘清单.md`）、性能基线报告（`技术文档/23-阶段七性能基线报告.md`）
- 阶段八交付补齐：System-UX 组件规范（`技术文档/24-System-UX-Stage8组件规范.md`）、跨层集成与回退策略（`技术文档/25-阶段八跨层集成与回退策略.md`）、集成示例与回归记录（`技术文档/26-阶段八集成示例与回归记录.md`）
- 阶段九交付补齐：测试体系与门禁实施（`技术文档/27-阶段九测试体系与质量门禁实施.md`）、性能与鲁棒性基线（`技术文档/28-阶段九性能与鲁棒性基线报告.md`）
- 阶段十交付补齐：发布规范与检查清单（`技术文档/29-阶段十发布规范与发布检查清单.md`）、生态接入验收模板（`技术文档/31-阶段十生态接入验收模板与执行指南.md`）
- 当前质量门禁状态以最新 `npm run verify` 与 `npm run quality:gate` 输出为准；`test:a11y` 已纳入 Dialog/Menu/Select/Tabs/DataGrid 重点键盘路径
- `quality:coverage` 已纳入 `quality:gate`，会以正式 component contract 目录和 `@chips/testing` 组件质量矩阵拦截新增组件漏补 contract attr、a11y fixture、状态优先级或 perf smoke 的情况
- 已登记 SDK 对接阻断：`工单001-SDK-UNIFIED-CARD-DISPLAY-API`

## 工程命令

- 安装依赖：`npm install`
- Token 校验：`npm run validate:tokens`
- Token 构建：`npm run build:tokens`
- 主题契约校验：`npm run validate:contracts`
- 全量测试：`npm test`
- 可访问性门禁：`npm run test:a11y`
- 性能门禁：`npm run test:perf`
- 组件矩阵覆盖门禁：`npm run quality:coverage`
- 阶段七性能基线：`npm run bench:stage7`
- 阶段九质量门禁：`npm run quality:gate`
- 发布准备校验：`npm run release:check`
- 生态验收模板校验：`npm run validate:ecosystem-acceptance`
- 一键门禁：`npm run verify`

## 协作边界

- 生态可复用、可公开的标准文档放在 `生态共用技术文档/组件库`
- 仅组件库内部实现细节与工程规范放在本仓 `技术文档`
