# Apple SwiftUI 官方资料索引与摘要

> 保存日期：2026-05-21  
> 资料性质：网络资料索引与摘要，不保存 Apple 官方文档全文。  
> 来源说明：本索引来自 Apple Developer Documentation 的 SwiftUI 官方页面及其公开 documentation JSON 数据，摘要为本项目调研整理。

## 1. 官方页面索引

| 能力域 | 官方资料 | 本次调研摘记 |
|---|---|---|
| SwiftUI 总览 | [SwiftUI](https://developer.apple.com/documentation/swiftui/) | SwiftUI 覆盖 views、controls、layout、事件处理、数据流和应用结构，是完整 UI 框架，不只是控件集合。 |
| App 结构 | [App](https://developer.apple.com/documentation/swiftui/app) | `App` 表示应用结构和行为，是 SwiftUI 应用入口。薯片需要对应的 `ChipsApp` 或应用声明层。 |
| 场景 | [Scenes](https://developer.apple.com/documentation/swiftui/scenes) | `Scene` 表示由系统管理生命周期的界面分组，覆盖窗口、设置、菜单栏等入口。 |
| 窗口组 | [WindowGroup](https://developer.apple.com/documentation/swiftui/windowgroup) | `WindowGroup` 声明一组结构相同的窗口。薯片可对应 Electron 多窗口和插件窗口。 |
| 文档组 | [DocumentGroup](https://developer.apple.com/documentation/swiftui/documentgroup) | `DocumentGroup` 把打开、创建、保存文档变成声明式场景。薯片可对应 `.card/.box/资源文件` 的文档场景。 |
| 设置窗口 | [Settings](https://developer.apple.com/documentation/swiftui/settings) | 设置页是 Scene，不是每个应用随意拼出的页面。薯片需要统一设置窗口和配置绑定。 |
| 菜单栏入口 | [MenuBarExtra](https://developer.apple.com/documentation/swiftui/menubarextra) | 系统级常驻入口可声明为 Scene。薯片可映射托盘、菜单栏或 Host 常驻入口。 |
| 视图协议 | [View](https://developer.apple.com/documentation/swiftui/view) | `View` 代表应用 UI 的一部分，并通过 modifier 配置。薯片 L8 Declarative UI 需要成为真实开发入口。 |
| 布局 modifier | [Layout modifiers](https://developer.apple.com/documentation/swiftui/view-layout) | 视图通过尺寸、位置、对齐、padding、安全区等 modifier 参与布局。 |
| 布局协议 | [Layout](https://developer.apple.com/documentation/swiftui/layout) | 自定义布局有统一协议。薯片应有 cpx、容器、断点、测量和自定义布局契约。 |
| 控件与指标 | [Controls and indicators](https://developer.apple.com/documentation/swiftui/controls-and-indicators) | 官方控件覆盖按钮、链接、文本输入、选择器、日期、颜色、数值、菜单、进度、仪表等。 |
| 数据模型 | [Model data](https://developer.apple.com/documentation/swiftui/model-data) | 数据变化驱动受影响界面自动更新。薯片需要状态、绑定、环境和 Host 服务状态边界。 |
| 导航 | [Navigation](https://developer.apple.com/documentation/swiftui/navigation) | 导航覆盖 stack、split、tab、标题、导航栏、边栏和多 pane。薯片需要统一路由与呈现层。 |
| 手势 | [Gestures](https://developer.apple.com/documentation/swiftui/gestures) | 支持点击、长按、连续变化、组合、自定义和手势状态。薯片需统一 pointer、keyboard、drag/drop 和 focus。 |
| 可访问性 | [Accessibility fundamentals](https://developer.apple.com/documentation/swiftui/accessibility-fundamentals) | 可访问性是独立系统能力。薯片每个组件 contract 需要 a11y 字段和测试。 |
| 预览 | [Previews in Xcode](https://developer.apple.com/documentation/swiftui/previews-in-xcode) | Xcode 可生成动态、交互式自定义视图预览。薯片需要组件、主题、应用、卡片、箱子预览。 |
| 性能分析 | [Performance analysis](https://developer.apple.com/documentation/swiftui/performance-analysis) | 使用 Instruments 检测卡顿、长时间视图更新和频繁更新。薯片需要渲染、Bridge、主题切换和长任务预算。 |

## 2. 关键符号索引

### 2.1 App、Scene、窗口、文档、命令

| SwiftUI 能力 | 作用 | 薯片对标方向 |
|---|---|---|
| `App` | 应用结构和行为 | `ChipsApp` / manifest 绑定 / Host 生命周期 |
| `Scene` | 系统管理生命周期的 UI 分组 | `ChipsScene` / app-card-box-window 场景 |
| `WindowGroup` | 同结构多窗口 | Electron BrowserWindow 组、插件窗口组 |
| `DocumentGroup` | 文档打开、创建、保存 | `.card/.box/资源文件` 文档场景 |
| `Settings` | 设置窗口 | 统一设置页、配置服务绑定 |
| `MenuBarExtra` | 菜单栏常驻入口 | 托盘、菜单栏、Host 常驻入口 |
| `Commands` | 菜单和快捷键命令组 | `ChipsCommands` / 命令注册 / 权限与 i18n |
| `CommandMenu` | 顶层命令菜单 | 应用菜单、命令面板、快捷键 |
| `CommandGroup` | 注入已有命令菜单 | 生态默认菜单扩展点 |
| `ToolbarItem` / `ToolbarItemGroup` | 工具栏项和工具栏组 | `ChipsToolbar`、窗口工具栏、编辑器工具栏 |

### 2.2 内容、布局、容器

| SwiftUI 能力 | 作用 | 薯片对标方向 |
|---|---|---|
| `Text` | 只读文本 | `ChipsText` / i18n key / typographic token |
| `Image` | 图片 | `ChipsImage` / 资源服务 / fallback |
| `Label` | 图标 + 文本 | `ChipsLabel` / `ChipsIcon` |
| `Divider` | 分隔线 | `ChipsDivider` / token 化分隔 |
| `Spacer` | 弹性空间 | `ChipsSpacer` |
| `Group` | 组合多个内容 | `ChipsGroup` / Fragment 语义 |
| `Section` | 分组层级 | `ChipsSection` / List/Form/Inspector 分组 |
| `ForEach` | 集合驱动视图 | 声明式集合渲染 / keyed render |
| `HStack` / `VStack` / `ZStack` | 三类堆叠布局 | `Inline/Stack/LayerStack` 或统一 Stack 轴向模型 |
| `Grid` | 二维布局 | `ChipsGrid` / responsive grid |
| `List` | 单列数据行容器 | `ChipsList` / selection / virtualized rows |
| `Table` | 多列表格 | `ChipsTable` / `DataGrid` 深化 |
| `Form` | 数据录入分组 | `ChipsForm` / validation / layout |
| `ScrollView` | 滚动区域 | `ChipsScrollView` / scroll state / shadows |
| `GeometryReader` | 读取容器尺寸和坐标 | `ChipsMeasure` / cpx container query |

### 2.3 控件与指标

| SwiftUI 能力 | 作用 | 薯片对标方向 |
|---|---|---|
| `Button` | 触发动作 | 已有 `ChipsButton`，需深化 command/loading/a11y |
| `Link` | URL 跳转 | `ChipsLink`，走 Host 外部打开策略 |
| `Toggle` | 开关状态 | 已有 `ChipsSwitch` / `ChipsCheckbox` |
| `TextField` | 单行文本输入 | 已有 `ChipsInput` |
| `SecureField` | 私密文本输入 | `ChipsPasswordInput` |
| `TextEditor` | 长文本编辑 | `ChipsTextArea` / `ChipsTextEditor` |
| `Picker` | 互斥选择 | 已有 `ChipsSelect`，需补 Picker 族与 style |
| `DatePicker` | 日期选择 | 已有 `ChipsDateTime`，需深化日期/时间/范围 |
| `ColorPicker` | 颜色选择 | `ChipsColorPicker` / theme editor 必需 |
| `Slider` | 范围数值选择 | `ChipsSlider` / range slider |
| `Stepper` | 递增递减 | `ChipsStepper` / number input |
| `Menu` | 动作菜单 | 已有 `ChipsMenu`，需命令与上下文菜单联动 |
| `DisclosureGroup` | 展开折叠 | `ChipsDisclosure` / Accordion |
| `Gauge` | 范围值指标 | `ChipsGauge` |
| `ProgressView` | 任务进度 | `ChipsProgress` / 进度中心 |

### 2.4 导航、呈现、交互

| SwiftUI 能力 | 作用 | 薯片对标方向 |
|---|---|---|
| `NavigationStack` | 单列堆栈导航 | `ChipsNavigationStack` |
| `NavigationSplitView` | 两列/三列分栏导航 | `ChipsNavigationSplitView` / workbench |
| `NavigationLink` | 声明式导航触发 | `ChipsNavigationLink` |
| `TabView` | 标签页/页面切换 | 已有 `ChipsTabs`，需提升为页面导航容器 |
| sheet / popover / alert / confirmation dialog | 呈现层 | `ChipsPresentation` / `ChipsDialog` / `ChipsPopover` / `ChipsAlert` |
| `ContextMenu` | 右键菜单 | `ChipsContextMenu` |
| Gestures | 点击、长按、拖动等 | `useChipsGesture` / pointer + keyboard 统一模型 |
| Focus | 焦点状态 | `ChipsFocusScope` / `useChipsFocusState` |
| Animation / Transition | 动效与过渡 | `ChipsMotion` / motion token / reduced motion |

## 3. 资料保存原则

1. 不保存 Apple 官方文档全文，避免把外部版权资料变成项目内部副本。
2. 保存官方链接、符号索引和本项目摘要，便于后续继续访问原始资料。
3. 后续如果需要离线研究，可只保存页面标题、URL、访问日期、摘要、相关薯片能力映射，不保存长篇原文。

