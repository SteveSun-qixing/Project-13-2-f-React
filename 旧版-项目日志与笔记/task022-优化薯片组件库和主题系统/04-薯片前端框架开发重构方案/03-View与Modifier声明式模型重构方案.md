# 重构方案：View 与 Modifier 声明式模型

## 1. 目标

建立薯片声明式 UI 模型，让开发者围绕 `View + Modifier + State + Environment` 写界面。该模型既要符合 React 技术栈，也要能被 L9 Unified Rendering 校验、归一、主题解析和提交。

这个模型不仅服务应用工具界面，也必须服务网页式普通页面结构。`View` 要吸收 `Stack/Grid/Form/List` 等前端布局概念，这些页面结构都归入同一套模型。

## 2. 现有项目落点

| 模块 | 职责 |
|---|---|
| Host L8 Declarative UI | View、声明树、modifier、布局节点、事件语义 |
| Host L9 Unified Rendering | Normalize、Validate、Theme Resolve、Layout Compute、Commit |
| SDK | React helper、类型封装、事件/状态/环境调用入口 |
| `Chips-ComponentLibrary` | 无头组件实现、组件 contract、a11y 与测试基线 |
| `chips-scaffold-app` | 默认页面结构、示例模板、应用入口样板 |
| SDK/Scaffold CLI | 将外部 Web 项目映射到 Chips View 与生态能力 |

当前不需要单独创建前端框架或声明式 UI 项目；这些能力应先作为 Host、SDK、组件库和脚手架之间的正式协作面落地。

## 3. 关键设计

### 3.1 JSX 组合与声明树并行

建议同时支持：

- React JSX：开发者日常开发主体验。
- 可序列化 UINode：卡片、配置化页面、插件扩展点、远程/动态 UI 使用。

两者必须共享组件 contract、theme token、i18n、a11y 和事件语义。

普通页面结构可以优先使用 JSX 组合，动态配置页、卡片、箱子和插件扩展点可以更多使用可序列化 UINode。

### 3.2 Modifier 方向

建议提供语义化 modifier/helper：

- `themeScope`
- `i18nKey`
- `layout`
- `focusScope`
- `shortcut`
- `permission`
- `presentation`
- `motion`
- `accessibility`

在 React 中可以表现为 props、hook、wrapper 或 helper，但需要统一规范，避免组件各自发明。

### 3.3 组合 API

复杂组件统一采用 compound components：

- `Dialog.Root/Trigger/Content/Actions/Close`
- `Tabs.Root/List/Trigger/Panel`
- `Menu.Root/Trigger/Content/Item/Group/Separator`
- `Form.Root/Section/Field/Label/Control/Error`
- `DataGrid.Root/Toolbar/Header/Row/Cell/Pagination`

## 4. 关键任务

1. 定义 `ChipsView` 和基础声明节点模型。
2. 定义 `Stack/Grid/Form/List` 在应用界面和网页式结构中的统一语义。
3. 定义 `Section/ScrollView/Text/Image/Media` 等统一页面结构原语。
4. 定义 JSX 与 UINode 的转换/共存规则。
5. 定义 modifier 命名、优先级和校验规则。
6. 建立事件语义：UI event、runtime effect、telemetry effect 分层。
7. 把 L9 Validate 接入组件 contract。
8. 将主题作用域、i18n key、a11y 属性纳入声明验证。
9. 将复杂组件逐步改为组合 API。
10. 为外部 Web 项目同化提供 View/布局映射建议。

## 5. 验收标准

- 新应用可以用统一 `ChipsView` 和声明式布局组织页面。
- 主题、i18n、权限、焦点、导航、动效不再散落为私有逻辑。
- L9 能校验声明树与组件 contract。
- 复杂组件不再依赖大量布尔 props 承载模式。
