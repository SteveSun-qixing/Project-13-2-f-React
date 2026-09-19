# SwiftUI 调研：View 与 Modifier 声明式模型

## 1. 这一层解决什么问题

SwiftUI 的核心心智模型是 `View + modifier + state`。开发者描述界面是什么，以及某个界面节点被哪些布局、样式、交互和辅助语义修饰；系统负责计算、更新和渲染。

这让 SwiftUI 的 API 虽然庞大，但使用方式高度统一：绝大多数能力都围绕 View 叠加，而不是每个组件各自发明一套配置系统。

对薯片来说，`View` 还必须吸收 Web 前端的页面结构表达能力。它不仅服务应用窗口，也要自然覆盖插件市场详情、主题展示、帮助文档、社区、教程和作品展示等网页式结构。这些界面应继续归入统一页面模型。

## 2. View 的角色

SwiftUI 的 `View` 表示应用界面的一部分。它既可以是基础内容，也可以是容器、控件、列表、表单、导航结构的一部分。

典型基础能力包括：

- `Text`：只读文本。
- `Image`：图片。
- `Label`：图标加标题。
- `Divider`：分隔线。
- `Spacer`：弹性空间。
- `Group`：组合多个视图、场景或命令。
- `Section`：在列表和表单中提供层级。
- `ForEach`：基于数据集合生成视图。
- `ViewBuilder`：通过闭包构建视图层级。

## 3. Modifier 的角色

Modifier 把能力叠加到 View 上，常见类别包括：

- 布局：尺寸、位置、对齐、padding、spacing、安全区。
- 视觉：前景、背景、边框、材质、透明度。
- 导航：标题、工具栏、导航栏行为。
- 呈现：sheet、popover、alert、confirmation dialog。
- 交互：点击、手势、焦点、快捷键。
- 可访问性：label、value、hint、隐藏、合并元素。
- 动画：状态变化、插入移除、过渡。

## 4. 设计价值

### 4.1 单一入口降低心智成本

开发者围绕 View 思考即可。布局、样式、交互、可访问性都在 View 层叠加，避免“组件库一套 API、导航一套 API、弹窗一套 API、动效一套 API”的分裂。

### 4.2 减少组件变体爆炸

SwiftUI 不依赖大量布尔 props 控制组件内部所有可能分支，而是通过组合和 modifier 表达差异。

### 4.3 让工具可以理解界面

因为界面是声明出来的，预览、性能分析、可访问性工具和编译检查更容易介入。

## 5. 对薯片的直接启发

薯片 L8 Declarative UI 应成为真实开发入口，而不是只停留在架构文档里。薯片可以在 React 技术栈下形成自己的模型：

- `ChipsView`：统一页面或区域节点。
- `ChipsStack` / `ChipsGrid` / `ChipsForm` / `ChipsList`：把布局、表单、列表这些高频 Web 页面结构纳入声明式模型。
- `ChipsSection` / `ChipsScrollView` / `ChipsText` / `ChipsImage` / `ChipsMedia`：支撑网页式页面结构，而不另起特殊应用类型。
- `ChipsModifier` 或 modifier helper：主题作用域、i18n、布局、焦点、快捷键、呈现、权限。
- 组合 API：复杂组件用 `Root/Trigger/Content/Item/Panel` 等显式子组件。
- Provider 注入：状态、环境、命令、主题、i18n 由上层注入，组件不直连 Host。
- 声明树校验：可被 L9 Unified Rendering 校验、归一、主题解析和提交。

薯片不需要照搬 Swift 语法，但需要形成同样统一的开发心智：应用开发者写声明，框架接管复杂运行时。
