# 薯片前端框架对标 SwiftUI 差距分析

> 分析日期：2026-05-21  
> 文档性质：项目日志与差距分析，不是生态正式公共契约。  
> 对标口径：SwiftUI 是参考目标，不是复制目标；薯片仍必须遵守 Host/Bridge/SDK、React 技术栈、组件库、主题系统、多语言系统和 Electron 框架定位。

## 1. 总结判断

当前薯片组件库不能称为完美状态，也不能说已经达到 SwiftUI 级别。

它已经是一个可用的早期基线：`Chips-ComponentLibrary` 已有 primitives、基础交互、数据表单、工作台、系统 UX、卡片 iframe runtime 等组件；token、contract、类型入口、a11y、性能和质量门禁已经存在。本轮此前核对过 `npm run verify` 与 `npm run quality:gate`，均可通过。

本轮新增重新调查了 Host、Bridge、插件、Manifest、SDK 与 L8/L9 文档后，需要补充一个重要判断：薯片前端框架不能被理解为普通 React 组件库。当前生态真实底座是 Electron + Host + 插件结构，Host 已沉淀 file/resource/config/theme/i18n/surface/plugin/module/card/box 等服务域；`surface` 是跨平台界面容器主语义，Desktop 下才落为 Electron BrowserWindow。后续差距分析必须围绕 Host 大底座如何产品化为开发者框架，而不是只围绕组件数量。

还需要补充第二个判断：薯片生态的底层技术栈仍然是 Web 技术栈。框架不仅要做复杂应用，也要用同一套页面结构覆盖类似网页的普通页面，并且未来要能快速吸收外部 Web 项目，把它们改造成符合薯片 manifest、surface、Bridge、主题、多语言、组件库和质量门禁的生态应用。

但如果定位是“全生态应用前端框架”，并且最低要求是 SwiftUI 有的组件和能力薯片都要有，那么当前仍有明显差距：

- 组件数量不足。
- 组件深度不足。
- App/Scene/Window/Document/Commands 级框架能力不足。
- 声明式 UI 层尚未成为开发者真实主入口。
- 主题系统、i18n、Host Runtime、组件库和开发工具链还没有形成 SwiftUI 式闭环。
- 当前质量门禁存在，但仍不足以证明复杂真实浏览器交互、焦点、键盘、视觉回归和主题切换全链路质量。
- 统一页面结构、外部 Web 项目同化工具链、系统常用模块的高层 hooks/scene 封装还不足。

所以本次对标结论是：薯片组件库已经有方向，但距离“像 SwiftUI 一样简单、统一、高质量地开发应用”还需要一次前端框架级重构，而不是只补几个组件。

## 2. 当前薯片组件库真实状态

### 2.1 当前工程结构

根据当前代码核对，`Chips-ComponentLibrary` 包含：

- `@chips/component-library`：聚合入口。
- `@chips/components`：组件导出。
- `@chips/primitives`：基础原语。
- `@chips/hooks`：组件库辅助 hook。
- `@chips/a11y`：可访问性辅助。
- `@chips/testing`：测试辅助。
- `@chips/tokens`：token 构建与校验。
- `@chips/theme-contracts`：组件主题契约。
- `@chips/card-runtime`：卡片 iframe runtime 组件。
- `@chips/adapters/tamagui-core`：Tamagui Core 适配包目录。

根 `package.json` 的正式验证脚本包括：

- `validate:tokens`
- `build:tokens`
- `validate:contracts`
- `test:types`
- `test`
- `test:a11y`
- `test:perf`
- `test:contracts`
- `quality:gate`
- `verify`

### 2.2 当前已交付组件

当前生态共用文档和组件库真实导出显示，已覆盖：

Primitive：

- `Box`
- `Inline`
- `Stack`
- `Grid`
- `Text`
- `Label`
- `HelperText`

Base Interactive：

- `ChipsButton`
- `ChipsInput`
- `ChipsCheckbox`
- `ChipsRadioGroup`
- `ChipsSwitch`
- `ChipsSelect`
- `ChipsDialog`
- `ChipsPopover`
- `ChipsTabs`
- `ChipsMenu`
- `ChipsTooltip`
- `ChipsIcon`

Data & Form：

- `ChipsFormField`
- `ChipsFormGroup`
- `ChipsVirtualList`
- `ChipsDataGrid`
- `ChipsTree`
- `ChipsDateTime`
- `ChipsCommandPalette`

Workbench：

- `ChipsSplitPane`
- `ChipsDockPanel`
- `ChipsInspector`
- `ChipsPanelHeader`
- `ChipsCardShell`
- `ChipsToolWindow`

System UX：

- `ChipsErrorBoundary`
- `ChipsLoadingBoundary`
- `ChipsNotification`
- `ChipsToast`
- `ChipsEmptyState`
- `ChipsSkeleton`

Card Runtime：

- `EmbeddedDocumentFrame`
- `CardCoverFrame`
- `CompositeCardWindow`

### 2.3 已发现并登记的技术漂移

已有工单：

- `项目日志与笔记/工单094-组件库冻结技术栈与质量门禁覆盖漂移/任务说明.md`

核心问题：

- 文档冻结技术栈为 `React + Ark UI + Style Dictionary + Tamagui Core`，但当前真实依赖主要只有 React，未实际依赖 Ark UI、Zag.js、Tamagui Core。
- 组件 contract validator 目前对所有组件强制要求 `iframe.requiredSandbox`，和“iframe 附加契约仅适用于 CardCoverFrame / CompositeCardWindow”的设计不一致。
- 测试能证明当前脚本通过，但对真实 DOM、浏览器交互、焦点、键盘、复杂 a11y 和视觉回归覆盖仍不够。

该问题会影响下一轮重构路线选择：是补齐 Ark/Zag/Tamagui 真实依赖，还是把自研状态机路线升格为正式路线并更新生态文档。

## 3. 与 SwiftUI 的能力差距总表

| 能力域 | SwiftUI 水平 | 薯片当前水平 | 差距判断 |
|---|---|---|---|
| App 入口 | `App` 统一声明应用结构 | 生态架构已有 Host/插件模型，但缺开发者可用的 `ChipsApp` 声明层 | 需要框架化 |
| Scene / Window | `Scene`、`WindowGroup`、`DocumentGroup`、`Settings` | Host/Electron 具备窗口能力，组件库没有声明式场景 API | 需要补 App Framework |
| View 模型 | `View` + modifier 统一心智 | L8 Declarative UI 有设计稿，组件库仍以 React 组件导出为主 | 需要把 L8 落成开发主入口 |
| 布局 | Stack/Grid/List/Table/Form/Scroll/Safe Area/Geometry/Custom Layout | 有 Box/Inline/Stack/Grid/FormField/DataGrid/VirtualList，但不完整 | 差距明显 |
| 基础控件 | Button/Link/Toggle/TextField/SecureField/TextEditor/Picker/DatePicker/ColorPicker/Slider/Stepper/Menu/Disclosure/Gauge/Progress | 有按钮、输入、选择、开关、菜单、弹层等基础项 | 缺少大量 SwiftUI 控件 |
| 导航 | NavigationStack/SplitView/Link/TabView/标题/导航栏/边栏/多 pane | 有 Tabs、Dialog、Popover、SplitPane/DockPanel | 缺统一导航与呈现框架 |
| 命令系统 | Commands/CommandMenu/CommandGroup/Toolbar/ContextMenu | 有 CommandPalette 和 Menu，但无完整命令注册、快捷键、菜单栏、工具栏框架 | 差距明显 |
| 数据流 | State/Binding/Environment/Storage/Focus | React 状态靠应用自行组织，生态文档有状态分层 | 缺统一 Chips 状态与环境模型 |
| 主题 | 系统样式与上下文自适应 | 主题系统方向正确，token/contract 已有基础 | 需要运行时闭环和工具矩阵 |
| i18n | 平台本地化能力 | 文档要求 UI 文案走多语言，但组件默认文案 key 体系不完整 | 需要系统化 |
| 手势与焦点 | 手势、焦点、键盘与系统输入统一 | 部分组件有键盘/a11y 基线 | 需要统一 input/focus/gesture 层 |
| 动效 | Animation/Transition/Canvas/Material/VisualEffect | 有 motion token，但缺框架级动效 API 和安全门禁 | 需要补齐 |
| 可访问性 | 独立能力集合，平台深度支持 | 有 a11y 包和测试，但复杂组件覆盖不足 | 需要组件级强矩阵 |
| 预览 | Xcode 动态交互预览 | 暂无等价预览体系 | 需要开发者工具 |
| 性能分析 | Instruments 分析卡顿、长更新、频繁更新 | 有 perf 脚本，但缺真实应用链路指标 | 需要质量平台化 |

## 4. SwiftUI 最低组件对标清单

本节按“SwiftUI 有的能力，薯片至少要有对应能力”的最低要求列出。

### 4.1 App / Scene / Window 类

SwiftUI 代表能力：

- `App`
- `Scene`
- `WindowGroup`
- `DocumentGroup`
- `Settings`
- `MenuBarExtra`
- `ScenePhase`

薯片当前情况：

- Host 架构中有插件运行时、窗口服务、应用插件和主题/多语言服务。
- 组件库没有面向开发者的 App/Scene 声明组件或 API。
- 应用脚手架尚未形成 SwiftUI 式“入口即拥有主题、多语言、窗口、权限、命令、错误边界”的体验。

需要补齐：

- `ChipsApp`
- `ChipsScene`
- `ChipsWindowGroup`
- `ChipsDocumentScene`
- `ChipsSettingsScene`
- `ChipsMenuBarEntry` 或 Electron 对应常驻入口
- `useScenePhase`
- manifest 与 scene 声明的双向校验

### 4.2 内容原语类

SwiftUI 代表能力：

- `Text`
- `Image`
- `Label`
- `Divider`
- `Spacer`
- `Group`
- `Section`
- `ForEach`
- `AnyView`
- `ViewBuilder`

薯片当前情况：

- 已有 `Text/Label/Box/Inline/Stack/Grid/HelperText`。
- 缺 `Image/Divider/Spacer/Group/Section/ForEach` 等统一语义。
- React 本身能做集合渲染，但生态声明式 UI 层没有统一抽象、主题契约和测试工具。

需要补齐：

- `ChipsImage`
- `ChipsDivider`
- `ChipsSpacer`
- `ChipsGroup`
- `ChipsSection`
- `ChipsForEach` 或声明树集合节点
- `ChipsView` / `ChipsFragment`
- 资源服务、i18n、主题和 a11y 的默认接入。

### 4.3 布局类

SwiftUI 代表能力：

- `HStack`
- `VStack`
- `ZStack`
- `Grid`
- `List`
- `Table`
- `Form`
- `ScrollView`
- `GeometryReader`
- `Layout`
- 安全区、对齐、padding、spacing、layout direction、layer order。

薯片当前情况：

- 已有 `Box/Inline/Stack/Grid`，但布局语义较基础。
- 有 `VirtualList/DataGrid/FormField/FormGroup`，但还不是完整 `List/Table/Form/ScrollView` 体系。
- `cpx` 和页面自治在设计稿中已有，但没有完整落成组件 API、测试和预览。

需要补齐：

- `ChipsScrollView`
- `ChipsList`
- `ChipsTable`
- `ChipsForm`
- `ChipsSafeArea`
- `ChipsResponsiveContainer`
- `ChipsMeasure` / `GeometryReader` 对应能力
- `ChipsLayerStack`
- `ChipsLayout` 自定义布局契约
- cpx 布局工具和运行时验证。

### 4.4 控件与输入类

SwiftUI 代表能力：

- `Button`
- `Link`
- `Toggle`
- `TextField`
- `SecureField`
- `TextEditor`
- `Picker`
- `DatePicker`
- `ColorPicker`
- `Slider`
- `Stepper`
- `Menu`
- `DisclosureGroup`
- `Gauge`
- `ProgressView`

薯片当前情况：

- 已有 `Button/Input/Checkbox/Radio/Switch/Select/DateTime/Menu`。
- 缺 `Link/SecureField/TextEditor/ColorPicker/Slider/Stepper/DisclosureGroup/Gauge/ProgressView`。
- `Select/DateTime` 需要继续深化 Picker 风格、范围、时区、键盘、格式化、国际化。

需要补齐：

- `ChipsLink`
- `ChipsPasswordInput`
- `ChipsTextarea`
- `ChipsTextEditor`
- `ChipsPicker`
- `ChipsColorPicker`
- `ChipsSlider`
- `ChipsRangeSlider`
- `ChipsStepper`
- `ChipsNumberInput`
- `ChipsDisclosure`
- `ChipsAccordion`
- `ChipsGauge`
- `ChipsProgress`
- `ChipsCombobox`
- `ChipsAutocomplete`
- `ChipsMultiSelect`
- `ChipsTagInput`
- `ChipsSearchInput`
- `ChipsFileInput`
- `ChipsDirectoryInput`
- `ChipsHotkeyInput`

### 4.5 导航与呈现类

SwiftUI 代表能力：

- `NavigationStack`
- `NavigationSplitView`
- `NavigationLink`
- `TabView`
- sheet
- popover
- alert
- confirmation dialog

薯片当前情况：

- 有 `Tabs/Dialog/Popover/SplitPane/DockPanel`，但这些还不是统一导航系统。
- 没有统一 route stack、split navigation、modal manager、presentation coordinator。
- 多窗口和插件窗口主要在 Host/Electron 层，没有对应用开发者形成声明式 API。

需要补齐：

- `ChipsNavigationStack`
- `ChipsNavigationSplitView`
- `ChipsNavigationLink`
- `ChipsRouter`
- `ChipsTabs` 页面导航增强
- `ChipsSheet`
- `ChipsAlert`
- `ChipsConfirmationDialog`
- `ChipsPresentationProvider`
- `ChipsModalManager`
- `ChipsBreadcrumb`
- `ChipsSidebar`
- `ChipsActivityBar`

### 4.6 命令、菜单、工具栏类

SwiftUI 代表能力：

- `Commands`
- `CommandMenu`
- `CommandGroup`
- `Menu`
- `ContextMenu`
- `ToolbarItem`
- `ToolbarItemGroup`

薯片当前情况：

- 有 `ChipsMenu` 和 `ChipsCommandPalette`。
- 缺统一命令注册、快捷键、菜单栏、上下文菜单、工具栏、命令启用状态、权限和 i18n 绑定。

需要补齐：

- `ChipsCommandRegistry`
- `ChipsCommandMenu`
- `ChipsCommandGroup`
- `ChipsContextMenu`
- `ChipsToolbar`
- `ChipsToolbarItem`
- `ChipsShortcut`
- `ChipsCommandPalette` 深化为命令系统前端。
- Host 菜单服务与插件 manifest 命令声明校验。

### 4.7 数据、资源、生态独有类

SwiftUI 本身不覆盖薯片生态的卡片、箱子、插件市场、资源系统，但薯片要超过 SwiftUI，必须在生态特有方向做强：

- 卡片封面、复合卡片窗口、嵌入式文档 frame。
- 箱子封面、箱子条目封面、箱子目录、箱子资源预览。
- 资源选择器、资源预览器、资源导入队列、上传/下载任务。
- 插件权限申请、插件安装状态、插件市场卡片、版本更新。
- 主题包预览、token inspector、组件状态矩阵。
- 编辑器 workbench、属性检查器、图层树、问题面板、状态栏。

当前薯片已有 Card Runtime 方向，但箱子、资源、插件、主题编辑和高级 workbench 组件仍需要扩展。

## 5. 质量与架构差距

### 5.1 组件 API 组合能力不足

当前很多组件仍偏单体 props 模型。SwiftUI 的思路是组合与 modifier；React 组件库对应方向应该是 compound components、Provider 注入和显式子组件。

需要调整：

- `Dialog.Root/Trigger/Content/Actions/Close`
- `Tabs.Root/List/Trigger/Panel`
- `Menu.Root/Trigger/Content/Item/Group/Separator`
- `DataGrid.Root/Toolbar/Header/Row/Cell/Pagination/EmptyState`
- `Form.Root/Section/Field/Label/Control/Error/Hint`
- `Navigation.Root/Stack/Split/Link/Destination`

### 5.2 主题运行时闭环仍需证明

主题系统设计正确，但必须证明：

- Host 当前主题注入应用根节点。
- 组件消费 token 和 `data-scope/data-part/data-state`。
- 复合卡片 iframe、基础卡片 iframe、箱子封面 iframe 主题一致。
- 主题切换时应用窗口、卡片、箱子、原生窗口背景同步刷新。
- 工作区隔离生效。
- 主题契约失败会阻断应用而非静默回退。

### 5.3 i18n 默认能力不够

组件不应硬编码用户可见文案。需要为 close、open、expand、collapse、loading、error、empty、retry、clear、search、selected、pagination 等系统语义建立组件级默认 i18n key。

### 5.4 a11y 需要从脚本通过升级为组件证明

复杂组件必须逐项证明：

- 键盘可达。
- 焦点顺序稳定。
- Escape、Enter、Space、方向键、Home/End 行为明确。
- 弹层 focus trap 和焦点恢复正确。
- Tree/DataGrid/List 的 role、selected、expanded、level、row/column index 正确。
- 主题焦点环和对比度满足要求。

### 5.5 性能需要从局部脚本升级为框架预算

SwiftUI 有性能分析工具链。薯片需要建立：

- 渲染提交 p95。
- 主题切换耗时。
- Bridge 调用 p50/p95。
- 大列表滚动 FPS。
- DataGrid/Tree 大数据量响应。
- 弹层打开延迟。
- 开发环境 HMR/启动耗时。
- 包体积和按需导入分析。

### 5.6 当前技术栈口径必须收口

`React + Ark UI + Style Dictionary + Tamagui Core` 是文档冻结口径，但真实依赖未完全落地。这个漂移会直接影响组件重构方案：

- 如果继续采用 Ark/Zag，需要把状态机和 a11y 交给成熟底座，并建立 wrapper 规范。
- 如果采用自研，需要正式补充状态机设计、键盘规范、a11y 证明和维护成本评估。
- Tamagui Core 是否仍是 token runtime 桥接层，也需要和真实代码统一。

## 6. 对标结论

1. 当前组件库是“可用基线”，不是“完美状态”。
2. 当前组件种类数量不满足 SwiftUI 最低对标要求。
3. 即使补齐组件数量，也不足以达成目标；还必须补 App Framework、Scene/Window、Navigation、State/Environment、Commands、Preview、Quality Gate。
4. 薯片最应该对标 SwiftUI 的地方是“开发者只声明意图，框架接管复杂系统能力”。
5. 下一步开发重构应以“薯片前端框架”作为目标对象，而不是只以 `Chips-ComponentLibrary` 作为目标对象。
