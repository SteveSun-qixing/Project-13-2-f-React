# 差距分析：View 与 Modifier 声明式模型

## 1. 对标目标

薯片框架需要 `View + Modifier` 式声明模型，让开发者通过统一方式描述界面、布局、主题作用域、多语言、交互、导航、呈现、可访问性和动效。

同时，`View` 必须吸收 `View/Stack/Grid/Form/List` 等前端布局概念，既能描述应用 UI，也能描述插件市场、帮助文档、教程、主题展示、长文阅读等普通页面结构。所有这些界面都归入同一套声明式 UI 模型。

## 2. 当前薯片已有基础

- 架构设计中已有 L8 Declarative UI。
- L8 当前设计原语包括 `View/Stack/Grid/Form/List`。
- L9 Unified Rendering 已定义 Normalize、Validate、Theme Resolve、Layout Compute、Render Commit、Effect Dispatch。
- 组件库已有无头组件和 `data-scope/data-part/data-state` 契约方向。
- React 技术栈天然支持 JSX 组合。

## 3. 当前主要差距

### 3.1 L8 还不是应用开发主入口

当前真实开发仍偏向直接使用 React 组件和业务页面代码。L8 声明式 UI 还没有成为脚手架默认入口、类型系统、测试工具和运行时提交链路。

虽然 Host 文档显示 L8 已有内部实现基础，但它尚未上升为“所有应用插件默认使用的前端框架体验”。

### 3.2 Modifier 模型缺失

当前薯片没有统一的 modifier 层来表达：

- 主题作用域。
- i18n key。
- 布局约束。
- 焦点域。
- 快捷键。
- 权限条件。
- 呈现行为。
- 动效。
- 可访问性补充。

这些能力如果都变成普通 props，会导致组件 API 膨胀。

### 3.3 组件 API 仍有单体 props 倾向

已有组件导出可用，但复杂组件还需要走向 compound components：

- Dialog 的 Root/Trigger/Content/Actions/Close。
- Tabs 的 Root/List/Trigger/Panel。
- Menu 的 Root/Trigger/Content/Item/Group/Separator。
- DataGrid 的 Root/Toolbar/Header/Row/Cell。

### 3.4 声明树和 React JSX 的边界未定

架构文档有 `UINode` 声明树模型，但当前还未明确：

- 哪些场景必须可序列化。
- 哪些场景直接用 React JSX。
- 声明树如何绑定 Host effect。
- 如何在 L9 统一验证与渲染。

### 3.5 网页式结构表达不足

当前 `View/Stack/Grid/Form/List` 是正确起点，但网页式结构还需要通过同一套原语补齐表达能力，例如：

- `Section`
- `ScrollView`
- `Text`
- `Image`
- `Media`
- `Grid`
- `List`
- `Form`

否则生态内大量“像网页一样的页面”会回到各应用自写 HTML/CSS 的状态。这些能力应作为统一原语和组合模式补齐，继续沉淀在同一套声明式 UI 模型中。

## 4. 差距等级

严重等级：高。

原因：没有统一声明模型，薯片就无法形成 SwiftUI 式单一心智模型。组件会越补越多，但开发者仍要学习很多零散入口。

## 5. 后续判断

需要把 L8/L9 从设计文档推进为真实工程层，并确定 JSX 组合、可序列化声明树、modifier helper、Provider 注入之间的边界。
