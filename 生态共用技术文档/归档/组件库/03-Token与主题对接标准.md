# Token 与主题对接标准

## 1. 统一 token 层级

生态统一采用五层 token：`ref/sys/comp/motion/layout`。

- 组件消费顺序：`comp -> sys -> ref`
- 动效与布局由 `motion/layout` 独立管理

## 2. 作用域链

主题权重链（低 -> 高）：`global -> app -> box -> composite-card -> base-card -> component`。

最小组件（`component`）权重最高。解析时从高权重层开始，当前层未定义则逐层向上查找到低权重层。
逐 key 解析，不做整包强覆盖。

## 3. 组件 token 命名

- 当前已交付组件：
  - `chips.comp.text.*`
  - `chips.comp.label.*`
  - `chips.comp.icon.*`
  - `chips.comp.icon-button.*`
  - `chips.comp.toggle-button.*`
  - `chips.comp.badge.*`
  - `chips.comp.tag.*`
  - `chips.comp.avatar.*`
  - `chips.comp.spinner.*`
  - `chips.comp.progress.*`
  - `chips.comp.rating.*`
  - `chips.comp.text-field.*`
  - `chips.comp.text-area.*`
  - `chips.comp.search-field.*`
  - `chips.comp.secure-field.*`
  - `chips.comp.segmented-control.*`
  - `chips.comp.combo-box.*`
  - `chips.comp.number-input.*`
  - `chips.comp.stepper.*`
  - `chips.comp.slider.*`
  - `chips.comp.date-picker.*`
  - `chips.comp.time-picker.*`
  - `chips.comp.image.*`
  - `chips.comp.media.*`
  - `chips.comp.error-state.*`
  - `chips.comp.button.*`
  - `chips.comp.input.*`
  - `chips.comp.checkbox.*`
  - `chips.comp.radio.*`
  - `chips.comp.switch.*`
  - `chips.comp.select.*`
  - `chips.comp.dialog.*`
  - `chips.comp.popover.*`
  - `chips.comp.tabs.*`
  - `chips.comp.menu.*`
  - `chips.comp.toolbar.*`
  - `chips.comp.menu-bar.*`
  - `chips.comp.context-menu.*`
  - `chips.comp.tooltip.*`
  - `chips.comp.form.*`
  - `chips.comp.virtual-list.*`
  - `chips.comp.data-grid.*`
  - `chips.comp.tree.*`
  - `chips.comp.date-time.*`
  - `chips.comp.command-palette.*`
  - `chips.comp.navigation-split-view.*`
  - `chips.comp.split-pane.*`
  - `chips.comp.dock-panel.*`
  - `chips.comp.inspector.*`
  - `chips.comp.panel-header.*`
  - `chips.comp.card-shell.*`
  - `chips.comp.tool-window.*`
  - `chips.comp.error-boundary.*`
  - `chips.comp.loading-boundary.*`
  - `chips.comp.notification.*`
  - `chips.comp.toast.*`
  - `chips.comp.empty-state.*`
  - `chips.comp.skeleton.*`
  - `chips.comp.view.*`
  - `chips.comp.box.*`
  - `chips.comp.stack.*`
  - `chips.comp.inline.*`
  - `chips.comp.grid.*`
  - `chips.comp.section.*`
  - `chips.comp.scroll-view.*`
  - `chips.comp.spacer.*`
  - `chips.comp.divider.*`
  - `chips.comp.split-view.*`
  - `chips.comp.card-cover-frame.*`
  - `chips.comp.composite-card-window.*`
- 后续组件保持同一命名形态：`chips.comp.<component-name>.*`

组件 token 必须可追溯到 `sys`、`motion` 或 `layout` 层语义 token，不允许直接绑定业务名。
Theme Runtime 的正式引用解析顺序为 `ref -> sys -> motion/layout -> comp`，因此组件 token 可以引用 `chips.layout.*` 与 `chips.motion.*` 这类公共运行时 token。

布局原语 token 是正式组件 token 的一部分，主题包必须覆盖其契约声明的 key。当前布局原语的最小契约前缀包括：

- `chips.comp.view.*`
- `chips.comp.box.*`
- `chips.comp.stack.*`
- `chips.comp.inline.*`
- `chips.comp.grid.*`
- `chips.comp.section.*`
- `chips.comp.scroll-view.*`
- `chips.comp.spacer.*`
- `chips.comp.divider.*`
- `chips.comp.split-view.*`

布局原语只通过 token、CSS 变量和 `data-scope/data-part/data-state` 接收视觉实现；主题包不得通过选择业务页面结构或组件私有 DOM 层级来覆盖它们。

布局 token 可以使用生态逻辑单位 `cpx` 表达设计基准尺寸。主题包源码、`dist/theme.css` 和 `dist/tokens.json` 可以保留 `cpx`；Host 将主题 CSS 与 token 变量注入应用窗口、卡片 iframe 或箱子布局 iframe 前，统一按 1024 设计基准转换为浏览器可识别的响应式长度。组件库和业务插件只消费 CSS 变量，不应在组件实现或业务样式中把布局 token 手动固化为 `px`。

基础展示控件 token 是任务015基础控件矩阵的第一批正式契约，默认主题和暗色主题必须覆盖：

- `chips.comp.text.*`
- `chips.comp.label.*`
- `chips.comp.icon.*`

`chips.comp.icon.root.*` 是运行时 UI 图标的组件层 token，组件内部和主题 CSS 的解析顺序为 `chips.comp.icon.* -> chips.sys.icon.* -> currentColor / 默认轴值`。`chips.sys.icon.*` 仍是主题系统图标语义基线，`chips.comp.icon.*` 负责组件级覆盖。

`chips.sys.icon.color / color-muted / color-accent / color-danger / color-disabled / size / size-dense / size-toolbar / size-compact / fill / fill-emphasis / wght / wght-strong / wght-muted / grad / grad-emphasis / grad-muted / opsz` 属于 `@chips/tokens` 的 public sys token source。主题包可以覆盖这些 token 的具体值，但不得只在主题包内私自新增公共图标 sys key；新增或改名必须先同步 `Chips-ComponentLibrary/packages/tokens/tokens/sys.json`、token 测试和本文档。

`ChipsIcon` 的正式 tone 集合为 `default | muted | accent | danger | disabled`。组件运行时输出 `data-tone`，主题 CSS 必须通过 `chips.comp.icon.root.color-*` 与 `chips.sys.icon.color-*` 表达状态语义；强调 tone 可以使用 `fill-emphasis / wght-strong / grad-emphasis`，弱化 tone 可以使用 `wght-muted / grad-muted`。组件只在 `IconDescriptor` 显式传入 `fill / wght / grad / opsz` 时写入对应 CSS 变量，未显式传入时必须完全由主题 token 控制。

`chips.sys.color.success / warning / info / danger / error` 以及对应 `*-surface`、`*-contrast` 是生态公开状态色语义基线，适用于 Badge、Tag、加载/空态/错误态、命令反馈、表单状态和应用通知等跨项目场景。主题包可以按外观校准这些 token 的具体色值，但不得在单个主题包中私自新增另一套公共状态色 key；新增、改名或删除状态色 key 必须先同步 `Chips-ComponentLibrary/packages/tokens/tokens/sys.json`、token 测试和本文档。

任务015第二批基础控件 token 是按钮派生、轻量展示和反馈控件的正式契约，默认主题和暗色主题必须覆盖：

- `chips.comp.icon-button.*`
- `chips.comp.toggle-button.*`
- `chips.comp.badge.*`
- `chips.comp.tag.*`
- `chips.comp.avatar.*`
- `chips.comp.spinner.*`
- `chips.comp.progress.*`
- `chips.comp.rating.*`

`chips.comp.icon-button.root.size` 与 `chips.comp.avatar.root.size` 允许引用或定义结构尺寸；`chips.comp.spinner.motion.duration` 必须引用 `chips.motion.duration.*`，不得在组件库运行时硬编码动画时长。`ChipsProgress` 的动态宽度只由运行时 CSS 变量 `--chips-progress-ratio` 表达，主题包只负责 `track/range/label/value/status/focus` token。

`ChipsRating` 是生态通用评分选择与评分展示控件，正式 scope 为 `rating`，公开 part 为 `root / label / item / icon / status`。组件只表达有限项评分、图标形态、键盘选择和 ARIA 语义，业务语义仍由使用方决定。`readOnly` 用于查看态评分展示时应保留 `item/icon` 的 active 视觉状态，只有真正禁用态才使用 disabled token。主题包必须通过 `chips.comp.rating.item.*`、`chips.comp.rating.icon.*`、`chips.comp.rating.label.*`、`chips.comp.rating.status.*` 与 `chips.comp.rating.focus.*` 表达不同形态和状态；不得在评分基础卡片等业务插件内长期私造不可复用评分控件。

任务015第三批基础输入控件 token 是文本、搜索与密码输入的正式契约，默认主题和暗色主题必须覆盖：

- `chips.comp.text-field.*`
- `chips.comp.text-area.*`
- `chips.comp.search-field.*`
- `chips.comp.secure-field.*`

四个输入控件的 `root.surface/border/focus`、`label/control/placeholder/description/status` 必须分别使用自身 scope 的 token，不得复用旧 `chips.comp.input.*` 作为正式样式入口。`SearchField` 的 `clear` 与 `search-icon`、`SecureField` 的 `visibility-toggle / visibility-icon` 只表达输入控件自身结构与状态，不得绑定业务搜索逻辑或密码管理能力。

任务015第四批选择扩展控件 token 是分段选择和输入式选择的正式契约，默认主题和暗色主题必须覆盖：

- `chips.comp.segmented-control.*`
- `chips.comp.combo-box.*`

`SegmentedControl` 的 `root/item/label/indicator/status/focus` token 只表达单选分段控件结构和状态；`ComboBox` 的 `root/control/trigger/list/option/description/status/focus` token 只表达输入过滤与 listbox 弹层视觉。主题包不得复用 `chips.comp.radio.*`、`chips.comp.select.*` 或旧 `chips.comp.input.*` 作为这两个控件的正式样式入口。

任务015第五批数值控件 token 是数值输入、离散增减和连续滑动控件的正式契约，默认主题和暗色主题必须覆盖：

- `chips.comp.number-input.*`
- `chips.comp.stepper.*`
- `chips.comp.slider.*`

`NumberInput` 的 `root/control/decrement/increment/description/status/focus` token 只表达可编辑数值输入、步进按钮、描述和错误视觉；`Stepper` 的 `root/label/value/decrement/increment/status/focus` token 只表达离散增减结构和边界状态视觉；`Slider` 的 `root/label/track/range/thumb/value/status/focus` token 只表达滑轨、选中范围、滑块和值文本视觉。主题包不得复用旧 `chips.comp.input.*`、按钮族 token、`chips.comp.progress.*` 或业务私有 token 作为这些数值控件的正式样式入口。

任务015第六批日期时间控件 token 是日期选择与时间选择的正式契约，默认主题和暗色主题必须覆盖：

- `chips.comp.date-picker.*`
- `chips.comp.time-picker.*`

`DatePicker` 的 `root/control/input/trigger/calendar/header/nav/grid/week-header/cell/description/status/focus` token 只表达日历日期输入、月份导航、日期格状态、描述和错误视觉；`TimePicker` 的 `root/control/input/trigger/list/option/description/status/focus` token 只表达本地墙钟时间输入、选项列表、描述和错误视觉。主题包不得复用旧 `chips.comp.date-time.*`、`chips.comp.input.*`、选择控件 token 或业务私有 token 作为这两个控件的正式样式入口。

任务015第七批图像、媒体和错误状态控件 token 是静态图片、媒体边界和错误展示的正式契约，默认主题和暗色主题必须覆盖：

- `chips.comp.image.*`
- `chips.comp.media.*`
- `chips.comp.error-state.*`

`Image` 的 `root/media/fallback/caption/status/focus` token 只表达图片容器、实际媒体、fallback、说明文本、错误状态和焦点视觉；`Media` 的 `root/content/controls/control/caption/status/focus` token 只表达音频、视频或通用媒体内容边界和内部控制槽视觉；`ErrorState` 的 `root/icon/title/description/details/action/status/focus` token 只表达静态错误展示、详情、动作入口和错误状态视觉。主题包不得复用 `chips.comp.avatar.*`、`chips.comp.error-boundary.*`、`chips.comp.empty-state.*` 或业务私有 token 作为三者的正式样式入口。

第七批最小 required token 数量以组件库 contract 为准：`image` 9 个、`media` 11 个、`error-state` 12 个。主题包本地 `contracts/theme-interface.contract.json` 与 `contracts/theme-min-functional-set.json` 必须同时包含 `image / media / error-state`；默认主题和暗色主题的组件基线数量以当前组件库正式 contract 目录为准。

任务016第一批复杂组件 Compound API token 是 Dialog、Popover、Tabs 显式 slot 的正式契约，默认主题和暗色主题必须按组件库 contract 同步覆盖：

- `chips.comp.dialog.*`
- `chips.comp.popover.*`
- `chips.comp.tabs.*`

`Dialog` 的 `backdrop/content/header/body/footer/actions/close/focus` token 分别表达遮罩、对话框内容容器、标题区、正文区、页脚区、动作区、关闭入口和焦点视觉；`Popover` 的 `trigger/content/arrow/focus` token 只表达触发器、浮层内容、装饰箭头和焦点视觉，内部定位容器不是公开 token 或公开 part；`Tabs` 的 `list/trigger/panel/focus` token 只表达页签列表、页签触发器、面板和焦点视觉。主题包不得继续依赖 Dialog 旧 `title/description` part 或 Popover 旧 `positioner` part 作为正式样式入口。

任务016第二批复杂组件 Compound API token 是 Menu、Select 显式 slot 的正式契约，默认主题和暗色主题必须按组件库 contract 同步覆盖：

- `chips.comp.menu.*`
- `chips.comp.select.*`

`Menu` 的 `content/item/group/group-label/separator/focus` token 分别表达菜单内容容器、菜单项、高亮/选中视觉、分组标题、分隔线和焦点视觉；`Select` 的 `trigger/content/option/value/icon/focus` token 分别表达触发器、listbox 内容容器、选项高亮/选中、当前值和展开图标视觉。`Select.Content` 的正式 part 是 `content`，主题包不得继续依赖 `select` scope 下的旧 `list` part。主题包必须把 `Select.Content` 渲染为锚定触发器下方的非文档流浮层，使用 `--chips-select-content-gutter / --chips-select-content-min-inline-size / --chips-select-content-max-block-size` 控制间距、宽度和滚动边界，不得通过普通文档流把应用窗口或容器撑大。

命令消费组件 token 是 Host command registry、应用工具栏和上下文菜单共同消费的正式契约，默认主题和暗色主题必须按组件库 contract 同步覆盖：

- `chips.comp.toolbar.*`
- `chips.comp.menu-bar.*`
- `chips.comp.context-menu.*`

`Toolbar` 的 `root/group/item/icon/label/shortcut/status/focus` token 分别表达工具栏容器、按钮分组、命令项、图标、文本、快捷键、状态信息和焦点视觉；`MenuBar` 的 `root/menu/content/group/item/icon/shortcut/status/focus` token 分别表达菜单栏、一级菜单触发器、菜单内容、分组、菜单项、图标、快捷键和焦点视觉；`ContextMenu` 的 `root/trigger/content/group/item/icon/shortcut/status/focus` token 分别表达上下文菜单宿主、触发器、菜单内容、分组、菜单项、图标、快捷键和焦点视觉。这些组件只消费命令状态和主题 token，不在主题包或组件样式层实现命令注册、调度或快捷键处理。

`Toolbar` 的状态过渡必须通过 `motionConstraints` 引用 `chips.motion.duration.fast` 与 `chips.motion.easing.standard`；`MenuBar` 与 `ContextMenu` 的弹出过渡必须通过 `chips.motion.menu.*` 表达。主题包不得只提供静态 token 而遗漏这些 motion token。

任务016第三批复杂组件 Compound API token 是 Form 显式 slot 的正式契约，默认主题和暗色主题必须按组件库 contract 同步覆盖：

- `chips.comp.form.*`

`Form` 的 `root/section/field/label/required/control/hint/error/status/focus` token 分别表达表单容器、分区、字段间距、标签、必填标记、原生控件外观、说明文本、错误文本、状态文本和焦点视觉。正式说明文本 part 为 `hint`；`chips.comp.form-field.*`、`chips.comp.form-group.*` 与 `helper` 口径已归档，不再作为主题包公开 contract。

任务016第四批复杂组件 Compound API token 是 DataGrid 显式 slot 的正式契约，默认主题和暗色主题必须按组件库 contract 同步覆盖：

- `chips.comp.data-grid.*`

`DataGrid` 的 `root/toolbar/header/row/cell/pagination/status/focus` token 分别表达数据网格外层容器、工具栏、表头、行、单元格、分页区、状态信息和焦点视觉。正式公开 part 为 `root / toolbar / header / row / cell / pagination / status`；`table` 只允许作为数据驱动 fallback 的内部 DOM，不是公开主题 contract。行悬停和选中分别使用 `chips.comp.data-grid.row.surface.hover` 与 `chips.comp.data-grid.row.surface.selected`，主题 CSS 必须用 `data-selected="true"` 匹配选中行，不得继续把选中视觉绑定到 `data-state="active"`。

任务016第五批复杂组件 Compound API token 是 Tree 显式 slot 的正式契约，默认主题和暗色主题必须按组件库 contract 同步覆盖：

- `chips.comp.tree.*`

`Tree` 的 `root/item/branch/leaf/disclosure/group/status/focus` token 分别表达树容器、树项基础视觉、分支层级缩进、叶子层级缩进、展开折叠控制、子树引导线、状态信息和焦点视觉。正式公开 part 为 `root / item / branch / leaf / disclosure / label / group / status`；旧 `node / toggle / children` 不再是公开主题 contract。节点悬停和选中分别使用 `chips.comp.tree.item.surface.hover` 与 `chips.comp.tree.item.surface.selected`，主题 CSS 必须用 `data-selected="true"` 匹配选中节点，不得继续把选中视觉绑定到 `data-state="active"`。层级缩进由组件运行时输出的 `--chips-tree-level` 与 `chips.comp.tree.branch.indent` / `chips.comp.tree.leaf.indent` 共同决定，组件运行时不得硬编码固定缩进像素。

任务016第六批复杂组件 Compound API token 是 CommandPalette 显式 slot 的正式契约，默认主题和暗色主题必须按组件库 contract 同步覆盖：

- `chips.comp.command-palette.*`

`CommandPalette` 的 `root/input/list/group/group-label/item/shortcut/status/focus` token 分别表达命令面板容器、查询输入、结果列表、分组、分组标题、命令条目、快捷键提示、状态信息和焦点视觉。正式公开 part 为 `root / input / list / group / group-label / item / shortcut / status`；旧 `search / result` 不再是公开主题 contract。输入 token 使用 `chips.comp.command-palette.input.*`，条目 token 使用 `chips.comp.command-palette.item.*`，主题 CSS 不得继续依赖 `chips.comp.command-palette.search.*` 或 `chips.comp.command-palette.result.*`。

任务016第七批复杂组件 Compound API token 是 NavigationSplitView 显式 slot 的正式契约，默认主题和暗色主题必须按组件库 contract 同步覆盖：

- `chips.comp.navigation-split-view.*`

`NavigationSplitView` 的 `root/sidebar/content/detail/divider/status/focus` token 分别表达导航分栏容器、导航侧栏、内容栏、详情栏、分割线、状态信息和焦点视觉。正式公开 part 为 `root / sidebar / content / detail / divider / status`；`primary / secondary` 只属于 `chips.comp.split-view.*` 布局原语 contract，不得被主题包复用为 `navigation-split-view` 的正式样式入口。导航侧栏宽度应使用 `chips.layout.size.navigation-primary-min`，内容栏和详情栏可复用 `chips.layout.size.split-secondary-min` 与弹性列，分割线和焦点环继续使用 `chips.layout.divider.*` 与 `chips.layout.focus.*`。

反馈类 motion token 是 `Progress / Skeleton / LoadingBoundary` 的正式契约，默认主题和暗色主题必须覆盖：

- `chips.comp.progress.range.motion.duration`
- `chips.comp.progress.range.motion.easing`
- `chips.comp.progress.range.motion.reduced-duration`
- `chips.comp.skeleton.item.motion.duration`
- `chips.comp.skeleton.item.motion.easing`
- `chips.comp.skeleton.item.motion.stagger`
- `chips.comp.skeleton.item.motion.reduced-duration`
- `chips.comp.loading-boundary.skeleton.motion.duration`
- `chips.comp.loading-boundary.skeleton.motion.easing`
- `chips.comp.loading-boundary.skeleton.motion.reduced-duration`

这些 token 通过 component contract 的 `motionConstraints[].tokenKeys` 进入主题 contract public view 的 required token 集合；主题缺失时必须阻断主题应用。`reports/quality-gate/component-quality-coverage-latest.json` 中的 `requiredTokenCount` 是 `@chips/testing` 对 raw contract `tokens/requiredTokens` 的覆盖统计，不额外合并 motion constraint tokenKeys；官方主题包 artifact、`ThemeContractView` 与主题应用门禁必须合并这两类 required token 来源。`prefers-reduced-motion: reduce` 下不允许保留无限位移或闪烁动画，应降级为静态状态或低强度状态反馈。

### 3.1 布局 token 基线

`chips.layout.*` 是布局原语、L9 布局计算、主题包和脚手架共同消费的结构 token 层。所有页面级和组件级布局常量默认使用 `cpx`，边框与焦点线宽等可见阈值保持 `px`。

当前正式布局 token 基线：

- `chips.layout.density.compact | comfortable | spacious`：常用控件密度高度，默认分别为 `32cpx / 40cpx / 48cpx`。
- `chips.layout.gap.xs | sm | md | lg | xl`：通用间距级别，默认分别为 `4cpx / 8cpx / 12cpx / 16cpx / 24cpx`。
- `chips.layout.size.grid-min-item`：响应式网格自动列的默认最小条目宽度，默认 `160cpx`。
- `chips.layout.size.split-primary-min`：两栏或主从布局主栏最小宽度，默认 `180cpx`。
- `chips.layout.size.split-secondary-min`：三栏布局中间栏最小宽度，默认 `220cpx`。
- `chips.layout.size.navigation-primary-min`：导航主栏最小宽度，默认 `160cpx`。
- `chips.layout.divider.thickness`：布局分割线厚度，默认 `1px`。
- `chips.layout.focus.outline-width` / `chips.layout.focus.outline-offset`：布局原语焦点环线宽与偏移，默认 `1px / 2px`。
- `chips.layout.breakpoint.compact | regular | expanded | wide`：页面自治断点，默认 `480cpx / 768cpx / 1024cpx / 1280cpx`。
- `chips.layout.z-index.base | sticky | overlay`：布局层级基线，默认 `0 / 10 / 1000`。
- `chips.layout.safe-area.inline-start | inline-end | block-start | block-end`：安全区 inset，默认映射浏览器 `env(safe-area-inset-*, 0px)`。

组件 token 可以引用 `chips.layout.*`。例如 `chips.comp.stack.root.gap`、`chips.comp.inline.root.gap`、`chips.comp.grid.root.gap`、`chips.comp.spacer.root.size` 默认引用 `chips.layout.gap.md`；`chips.comp.divider.root.thickness` 默认引用 `chips.layout.divider.thickness`。

## 4. 主题包约束

- 必须完整实现所声明组件的 token 覆盖
- 必须通过 token 完整性校验
- 官方主题包必须通过组件库官方契约等值门禁：`component` 集合、`scope`、`parts`、`states`、`requiredTokens`、`optionalTokens` 必须逐项等同组件库正式 contract
- component contract 中 `motionConstraints[].tokenKeys` 必须并入 required token 覆盖集合；缺失时输出阻断级 `THEME_REQUIRED_TOKEN_MISSING`
- 必须通过对比度与动效安全校验
- 必须保持组件结构不变（仅改视觉）

## 5. 运行时接口

主题运行时固定动作：

- `theme.list`
- `theme.apply`
- `theme.getCurrent`
- `theme.getAllCss`
- `theme.resolve`
- `theme.contract.get`

组件库主题消费侧建议统一接口：

- `createScopedTokenResolver({ scopes, fallbackTokens, onDiagnostic })`
- `useToken(tokenKey)`
- `useComponentTokens(componentScope)`
- `theme.changed` 事件订阅后执行变量级刷新
- 大范围变量更新使用分片注入（`applyThemeVariablesInBatches`）并输出诊断事件

## 6. 失败回退

- token 缺失：回退默认 token 并输出告警
- 主题解析失败：回退默认主题
- 契约不匹配：阻断主题应用

## 7. 诊断与覆盖率输出

主题运行时和组件库 contract validator 必须共享 `ThemeDiagnostic` 与 `ThemeDiagnosticSummary` schema，避免 Host、SDK、主题包和设置面板各自定义诊断口径。

- `theme.resolve` 必须返回 `tokens / diagnostics / summary`。
- `theme.contract.get` 必须返回 `ThemeContractView`，其中每个组件包含 `coverage / diagnostics`。
- 缺失 required token 必须产生 `THEME_REQUIRED_TOKEN_MISSING`，并定位到 `component / part / state / tokenKey / layer`。
- 缺失 optional token 必须产生 `THEME_OPTIONAL_TOKEN_MISSING`，但 `blocking=false`。
- `theme.changed` 事件必须携带 `diagnosticsSummary`，用于设置面板、组件库刷新工具和 CLI 快速判断主题健康状态。
- 主题包本地校验不得维护独立硬编码 token 白名单；必须读取 `contracts/theme-interface.contract.json` 并通过组件库正式 contract validator 生成同一 `ThemeContractView`。
- 官方主题包的 `contracts/theme-interface.contract.json` 与 `contracts/theme-min-functional-set.json` 必须由 `@chips/theme-contracts` 的组件库正式 contract 生成；本地文件是 Host 安装运行时消费的发布产物，不是 contract 源头。
- 组件库质量门禁必须把官方 ThemePack contract 与组件库 component contract 的等值校验纳入 `test:contracts`。新增、重命名或归档组件 part/token 时，必须同一提交内同步官方主题包 contract、token、CSS、主题包测试和公共文档，避免 Host、SDK、组件库与设置面板读取到互相矛盾的公开接口点。

主题 CSS 覆盖门禁至少必须确认每个正式 component contract 的 `scope` 在主题 CSS 中存在对应 `data-scope="<scope>"` 选择器。`toolbar / menu-bar / context-menu / shortcut` 属于命令消费组件，与 `command-palette` 一样必须有正式主题样式；不能只靠 token 覆盖通过 contract 校验。

设置面板、CLI 与主题包测试只消费该公共 schema，不直接解析 Host 内部错误对象或主题包私有字段。
