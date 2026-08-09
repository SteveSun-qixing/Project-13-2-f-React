# 前端框架 vNext 公共契约与术语冻结

> 文档状态：生态共用公开规范  
> 修订日期：2026-05-23  
> 适用范围：Host、SDK、ComponentLibrary、Scaffold、ThemePack、EcoSettingsPanel、五类生态插件

---

## 状态变更声明（task030 卸担计划，2026-08）

- **L10 Component Headless（组件库）与 L11 Theme Runtime 已被 task030 决策取代**：前端统一改用 antd v6 + 共享层 `@chips/ui`（`appleTheme` 单一苹果风格主题），自研组件库与主题运行时不再作为插件开发依据。本文档中 L10/L11 相关术语仅保留作历史参考，禁止再按旧口径引用。
- **L8 / L9（Host 声明式 UI 与统一渲染）保持有效**：属 Host 内置渲染链路（Host 未废弃），仅限 Host 内部使用；插件侧 UI 不再走 L8/L9，直接使用 React + antd + `@chips/ui`。
- 决策依据：`项目日志与笔记/task030-卸担计划/00-计划总览与目标.md`；现行口径见 `生态共用技术文档/前端基础/`（01 技术选型 / 02 统一视觉规范 / 03 共享层使用指南 / 04 简体中文文案规范）。

---

## 1. 定位

本文档是薯片前端框架 vNext 的公共术语与职责边界入口。后续 Host、SDK、组件库、脚手架、主题包和应用插件相关任务，均优先引用本文档确认“能力归属、文档落点、禁止口径”。

本文档只沉淀稳定公共契约，不记录任务过程、排查笔记、短期方案或单仓内部实现细节。

---

## 2. 核心术语

| 术语 | 正式定义 | 主落点 |
|---|---|---|
| Host | 用户设备唯一运行时承载，负责 L1-L9 主链路、插件托管、服务路由、Bridge 注入与运行时治理。 | `Chips-Host` |
| SDK | 开发者工具包，负责类型化封装、调用辅助、脚手架工具、契约测试辅助与示例，不承担 Host 运行时主体。 | `Chips-SDK` |
| Component Headless | L10 无头组件能力，提供结构、状态机、交互语义、a11y 和契约字段，不写入主题视觉实现。 | `Chips-ComponentLibrary` |
| Theme Runtime | L11 主题运行时，负责 token 解析、作用域覆盖、CSS 变量注入、主题变更广播和主题契约校验。 | Host 内置运行时 + ThemePack 契约 |
| App plugin | 由 Host 托管的跨平台界面插件，通过 `surface` 语义运行。Desktop 当前映射为 `window`。 | `manifest.type: app` |
| Card plugin | 基础卡片渲染与编辑插件，提供基础卡片类型能力，由 Host 卡片链路分发和治理。 | `manifest.type: card` |
| Layout plugin | 箱子布局页面插件，消费 Host 箱子会话、摘要条目与资源接口，不自行定位卡片文件。 | `manifest.type: layout` |
| Module plugin | Host 托管的无界面能力模块，通过 `module` 服务按 capability + method 调用。 | `manifest.type: module` |
| Theme plugin | 主题与视觉包，提供 token、CSS、组件契约覆盖、图标字体等视觉资源。 | `manifest.type: theme` |
| surface | 跨平台界面容器公共语义，覆盖窗口、路由、标签页、模态层、抽屉、全屏等宿主形态。 | `surface.*` 服务与 Bridge 子域 |
| View/Modifier | 声明式 UI 的视图结构与语义修饰模型，只表达布局、结构、行为和主题作用域线索，不表达具体视觉皮肤。 | L8 Declarative UI |
| L8 | Declarative UI，提供 `View/Stack/Grid/Form/List` 等语义原语、声明树节点与事件/副作用语义。 | Host 内置运行时 |
| L9 | Unified Rendering，负责 Normalize、Validate、Resolve、Compute、Commit、Dispatch 等统一渲染链路。 | Host 内置运行时 |
| L10 | Component Headless，负责组件结构、状态机、键盘交互、a11y 与 `data-scope/data-part/data-state` 契约。 | `Chips-ComponentLibrary` |
| L11 | Theme Runtime，负责主题 token、作用域链、CSS 变量、主题契约校验与主题运行时注入。 | Host 内置运行时 + ThemePack |

---

## 3. 能力域与唯一优先落点

### 3.1 前端框架能力域

| 能力域 | 公共定义 | 唯一优先落点 |
|---|---|---|
| App / Scene / surface / commands | 应用插件入口、运行容器、场景状态和命令入口；`surface` 是跨平台容器主语义。 | Host Plugin Runtime + `surface.*` + Scaffold app 模板 |
| View / Modifier / layout | 声明式 UI 结构、语义修饰、布局原语和 cpx 尺寸体系。 | Host L8 Declarative UI + L9 Unified Rendering |
| State / Environment / Binding / Focus | 页面状态、运行时环境、数据绑定与焦点语义；系统能力通过 Runtime Client/Hooks 注入。 | Host L7-L9 + SDK 类型化封装 |
| Navigation / Menu / Toolbar / Command | 导航栈、菜单、工具栏与命令分发语义；宿主差异由 `surface` 与 Host 能力映射。 | Host Runtime + Component Headless + App plugin |
| Gesture / Focus / a11y | 指针、键盘、焦点、无障碍属性与交互状态。 | Component Headless + Host L8/L9 |
| Motion / Animation | 动效语义、动效安全和 motion token。 | Theme Runtime + Component Headless |
| Theme / Token / Contract | token 层级、主题作用域、组件接口点、主题包契约与 CSS 变量注入。 | Theme Runtime + ThemePack + ComponentLibrary theme contracts |
| Preview / Performance / Quality | 预览、契约测试、性能预算、可访问性和质量门禁。 | SDK tooling + ComponentLibrary gates + Host/Scaffold tests |
| Web 项目同化 | 普通 Web UI 按插件、surface、L8/L9 与主题系统接入，不形成平行运行时。 | Scaffold + SDK + Host Runtime |

### 3.2 项目职责边界

| 能力域 | 优先落点 | 公共契约 |
|---|---|---|
| Host Kernel / Services | `Chips-Host` | Kernel 路由、服务域、schema、权限、route manifest、标准错误对象 |
| Bridge Transport | Host preload / Host Access Transport | `window.chips.*`、事件订阅、IPC/Direct transport 抽象 |
| Runtime Client / UI Hooks | Host 内置运行时；SDK 提供开发调用封装 | action/payload 规范化、错误归一、重试、业务 API |
| Declarative UI | `Chips-Host/src/renderer/declarative-ui` | L8 节点模型、语义原语、组合模式、事件和副作用分级 |
| Unified Rendering | `Chips-Host/packages/unified-rendering` | L9 归一化、校验、主题解析、布局计算、提交与效果分发 |
| Component Headless | `Chips-ComponentLibrary` | 组件状态、结构、a11y、part/scope/state、无视觉实现 |
| Theme Runtime | Host 主题服务与运行时注入；ThemePack 提供主题资源 | token 层级、作用域链、CSS 变量、主题契约、主题变更事件 |
| App plugin template | `Chips-Scaffold/chips-scaffold-app` | React 模板、`runtime.targets`、`ui.surface`、主题与多语言接入 |
| Card plugin template | `Chips-Scaffold/chips-scaffold-basecard` | `basecardDefinition`、渲染/编辑入口、资源与 Host 链路 |
| Layout plugin template | `Chips-Scaffold/chips-scaffold-boxlayout` | `layoutDefinition`、箱子会话、布局配置与资源读取 |
| Module plugin template | `Chips-Scaffold/chips-scaffold-module` | capability + method、Host module provider 契约 |
| Theme plugin template | `Chips-Scaffold/chips-scaffold-theme` 与 `ThemePack/*` | token、CSS、图标字体、主题包 manifest 与 contract |
| Eco settings governance | `Chips-EcoSettingsPanel` | 主题、多语言、插件、组件展示与运行时治理入口 |

---

## 4. 禁止口径与架构边界

1. 不把前端框架 vNext 拆成新的默认独立工程；优先在 Host、SDK、ComponentLibrary、Scaffold、ThemePack 和现有插件边界内落地。
2. 页面型业务结构归入统一 `View/Stack/Grid/Form/List` 与 `surface` 语义，不为普通页面另立平行应用类别。
3. SDK 只做开发工具包与调用封装，不定位为 Host runtime 的承载层。
4. 组件库只提供无头结构、状态与契约，不写入颜色、阴影、圆角、字体等主题皮肤。
5. App/Card/Layout 插件访问系统能力必须走 `window.chips.*`、Bridge 或 `chips-sdk` 正式链路，不直接访问 Electron、Node、Host 内部包或平台实现对象。
6. 服务间调用必须经过 Kernel 路由；模块插件之间不得通过跨仓 `import` 直接互调。
7. 新增跨平台界面能力优先进入 `surface`，不得继续把新的主语义堆入 `window`。
8. 所有官方前端采用 React 技术栈；用户可见文案走多语言系统，视觉样式走主题系统与 token。

---

## 5. 公共契约主发布位置

| 契约 | 主发布位置 | 说明 |
|---|---|---|
| 十二层架构与职责边界 | `生态共用技术文档/架构设计/薯片生态-架构设计手册.md` | 总体架构与层级依赖 |
| Host 服务域 | `生态共用技术文档/架构设计/14-Host服务域设计.md` | L3 服务域、主语义和质量门禁 |
| Bridge / Runtime Client / UI Hooks | `生态共用技术文档/架构设计/13-Bridge三层设计.md` | L5-L7 正式链路 |
| L8 声明式 UI | `生态共用技术文档/架构设计/17-L8声明式UI实现与接口细则.md` | 语义原语、节点模型、事件与副作用 |
| 插件模型 | `生态共用技术文档/架构设计/03-插件架构设计.md` | 五类插件、会话、权限与 surface 语义 |
| Manifest | `生态共用技术文档/插件开发/06-Manifest配置规范.md` | `type`、`runtime.targets`、`ui.surface`、权限和入口 |
| Bridge API | `生态共用技术文档/协议与接口标准/02-Bridge-API规范.md` | `window.chips.*` 公共接口形状 |
| SDK 使用 | `生态共用技术文档/插件开发/08-SDK使用指南.md` | 开发者调用方式、封装入口和限制 |
| 组件契约 | `生态共用技术文档/组件库/02-组件契约标准.md` | `data-scope/data-part/data-state` 与组件公开结构 |
| Token 与主题对接 | `生态共用技术文档/组件库/03-Token与主题对接标准.md` | 组件 token、作用域链、主题包约束 |
| 主题包接口 | `生态共用技术文档/主题系统/02-主题接口规范.md` | 主题插件、token、CSS、图标字体接口 |
| 多语言 | `生态共用技术文档/协议与接口标准/03-多语言规范.md` | 语言资源、运行时切换、文案治理 |

---

## 6. 内部实现细节归属

以下内容不作为生态公共契约长期发布，只保留在对应项目内部技术文档、测试或源码注释中：

- Host 内部 service 类、PAL 适配器实现、Electron IPC 物理通道、窗口创建细节。
- SDK 内部文件组织、构建产物结构、测试辅助实现与 CLI 内部流程。
- ComponentLibrary 包内目录组织、组件状态机内部实现、性能报告生成细节。
- Scaffold 模板渲染器内部 AST / 字符串处理策略。
- ThemePack 构建脚本、token 构建中间产物、预览资源内部生成方式。
- EcoSettingsPanel 页面组件拆分、局部状态管理和单页交互实现。

如果上述内容需要被多个项目稳定消费，必须先提升为公共契约并写入 `生态共用技术文档/` 的对应主发布位置。

---

## 7. 已核对的当前实现锚点

| 项目 | 核对锚点 | 结论 |
|---|---|---|
| Host | `src/preload/create-bridge.ts`、`src/main/services/register-host-services.ts`、`src/renderer/declarative-ui/*`、`packages/unified-rendering/*` | Host 已承载 Bridge、服务域、L8、L9 主链路。 |
| SDK | `src/core/client.ts`、`src/api/surface.ts`、`src/contracts/route-manifest.json`、`tests/tooling/contract-drift.test.ts` | SDK 当前作为 Bridge/Runtime Client 消费侧封装与契约测试辅助存在。 |
| ComponentLibrary | `packages/component-library/index.*`、`packages/components`、`packages/primitives`、`packages/theme-contracts`、`tests/types/component-library-smoke.tsx` | 组件库以无头组件、primitive、主题契约和类型烟测为主。 |
| Scaffold | `chips-scaffold-app/templates/app-standard/manifest.yaml.tpl`、`chips-scaffold-app/templates/app-standard/src/App.tsx.tpl` | App 模板已声明 `runtime.targets`、`ui.surface`、主题/多语言基础权限，并默认通过 `ChipsEnvironmentProvider/useChips*` 注入 SDK client 与 Host 环境。 |
| ThemePack | `ThemePack/Chips-default/manifest.yaml`、`ThemePack/Chips-theme-default-dark/manifest.yaml`、`tokens/comp/*` | 主题包以 theme 插件 manifest、token 和 CSS 资源承载视觉实现。 |
| EcoSettingsPanel | `manifest.yaml`、`src/features/themes/*`、`i18n/*` | 设置面板以 app 插件形式消费主题、多语言、插件治理能力。 |

---

## 8. 漂移与后续工单落点

本任务只冻结公共口径，不处理各仓实现漂移。当前后续落点如下：

| 缺口类型 | 后续处理 |
|---|---|
| Host schema、SDK route manifest、Bridge action 与 `create-bridge.ts` 漂移 | 进入任务001逐项审计并修复。 |
| L8/L9 文档与 Host 声明式 UI、统一渲染实现漂移 | 进入任务002及后续 L8/L9 专项任务。 |
| 组件库 token contract、主题包 tokens/comp 与质量门禁漂移 | 复用或补充既有组件库漂移工单，并进入组件库专项任务。 |
| 脚手架模板硬编码主题、文案、私有 Bridge 调用 | 进入脚手架专项任务审计。 |
| Theme Runtime 与主题包 contract 缺失或不一致 | 进入主题系统专项任务审计。 |

如在后续任务中发现新的架构缺口、公共契约缺失或文档与代码不一致，应按 `项目日志与笔记/AGENTS.md` 登记到 `项目日志与笔记/问题工单.md` 并创建独立工单目录。
