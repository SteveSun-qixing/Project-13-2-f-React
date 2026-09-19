# SwiftUI 对标基础控件能力矩阵

> 文档状态：任务015基础控件矩阵正式口径
> 适用范围：组件库、主题包、应用插件、卡片插件、布局插件
> 当前基线：`Text / Label / Icon` 已作为任务015第一批收口；`IconButton / ToggleButton / Badge / Tag / Avatar / Spinner / Progress / Rating` 已作为任务015第二批收口；`TextField / TextArea / SearchField / SecureField` 已作为任务015第三批收口；`SegmentedControl / ComboBox` 已作为任务015第四批收口；`NumberInput / Stepper` 已作为任务015第五批 A 收口；`Slider` 已作为任务015第五批 B 收口；`DatePicker / TimePicker` 已作为任务015第六批收口；`Image / Media / ErrorState` 已作为任务015第七批收口；后续批次必须继续按本矩阵补齐。

## 1. 矩阵口径

- “已落地”表示组件库公开导出、运行时 `data-scope/data-part/data-state`、a11y 规则、contract、组件 token、默认主题和暗色主题 token/CSS/contract、测试均已接入。
- “相邻能力”表示生态已有可复用基础，但尚未形成任务015要求的独立控件闭环。
- “待补齐”表示不得在应用层长期私造；后续工单批次必须补齐正式组件或在公共文档明确等价关系。

## 2. 任务015基础控件矩阵

| 能力类别 | SwiftUI / 常见控件 | Chips 正式能力 | 当前状态 | 当前正式 scope | 后续要求 |
|---|---|---|---|---|---|
| 文本与图像 | Text | `ChipsText` | 已落地 | `text` | 继续补充用例到真实应用迁移场景 |
| 文本与图像 | Label | `ChipsLabel` | 已落地 | `label` | 后续表单控件必须优先复用 Label 语义 |
| 文本与图像 | Icon | `ChipsIcon` | 已落地 | `icon` | 所有运行时 UI 图标必须消费 `IconDescriptor` |
| 文本与图像 | Image | `ChipsImage` | 已落地 | `image` | 维持 alt、装饰模式、加载、错误和尺寸契约 |
| 文本与图像 | Media | `ChipsMedia` | 已落地 | `media` | 维持音频、视频、通用媒体边界和可访问标题口径 |
| 按钮与命令 | Button | `ChipsButton` | 已落地 | `button` | 维持基础动作按钮闭环 |
| 按钮与命令 | IconButton | `ChipsIconButton` | 已落地 | `icon-button` | 必须强制可访问名称和 44px 热区 |
| 按钮与命令 | ToggleButton | `ChipsToggleButton` | 已落地 | `toggle-button` | 独立导出与 contract，切换态使用 `aria-pressed` |
| 输入控件 | TextField | `ChipsTextField` | 已落地 | `text-field` | 维持单行文本输入、描述、错误和 Enter 语义闭环 |
| 输入控件 | TextArea | `ChipsTextArea` | 已落地 | `text-area` | 维持多行输入、描述、错误和 resize 语义闭环 |
| 输入控件 | SearchField | `ChipsSearchField` | 已落地 | `search-field` | 维持搜索/清空槽位与 Enter 搜索语义 |
| 输入控件 | SecureField | `ChipsSecureField` | 已落地 | `secure-field` | 维持密码可见性切换与 a11y |
| 选择控件 | Checkbox | `ChipsCheckbox` | 已落地 | `checkbox` | 维持表单选择闭环 |
| 选择控件 | Radio | `ChipsRadioGroup` | 已落地 | `radio` | 维持互斥选择闭环 |
| 选择控件 | Switch | `ChipsSwitch` | 已落地 | `switch` | 维持布尔开关闭环 |
| 选择控件 | SegmentedControl | `ChipsSegmentedControl` | 已落地 | `segmented-control` | 维持 radiogroup/radio 语义、roving focus 与单选口径 |
| 选择控件 | Select | `ChipsSelect` | 已落地 | `select` | 维持 listbox 选择闭环 |
| 选择控件 | ComboBox | `ChipsComboBox` | 已落地 | `combo-box` | 维持输入过滤、弹层和 activedescendant 语义 |
| 数值控件 | Slider | `ChipsSlider` | 已落地 | `slider` | 维持 min/max/step、键盘增减、指针拖拽和值文本闭环 |
| 数值控件 | Stepper | `ChipsStepper` | 已落地 | `stepper` | 维持增减按钮、边界禁用和数值事件闭环 |
| 数值控件 | NumberInput | `ChipsNumberInput` | 已落地 | `number-input` | 维持解析、夹取、错误和内置步进按钮协作 |
| 日期时间 | DatePicker | `ChipsDatePicker` | 已落地 | `date-picker` | 维持日期输入、日历网格、月份导航、键盘和 a11y 闭环 |
| 日期时间 | TimePicker | `ChipsTimePicker` | 已落地 | `time-picker` | 维持时间输入、选项列表、键盘和 a11y 闭环 |
| 展示控件 | Badge | `ChipsBadge` | 已落地 | `badge` | 需要状态色、计数/文本和装饰语义 |
| 展示控件 | Tag | `ChipsTag` | 已落地 | `tag` | 需要标签文本、可关闭变体和列表语义 |
| 展示控件 | Avatar | `ChipsAvatar` | 已落地 | `avatar` | 需要图像、缩写、fallback 与 alt 语义 |
| 展示控件 | Tooltip | `ChipsTooltip` | 已落地 | `tooltip` | 维持说明气泡闭环 |
| 反馈控件 | Progress | `ChipsProgress` | 已落地 | `progress` | 需要 determinate/indeterminate 与 progressbar 语义 |
| 反馈控件 | Rating / Gauge 相邻能力 | `ChipsRating` | 已落地 | `rating` | 用于有限项评分展示和选择，维持 radiogroup/radio、键盘与 IconDescriptor 语义 |
| 反馈控件 | Spinner | `ChipsSpinner` | 已落地 | `spinner` | 需要 status 语义与 motion token |
| 反馈控件 | Skeleton | `ChipsSkeleton` | 已落地 | `skeleton` | 维持骨架加载闭环 |
| 反馈控件 | EmptyState | `ChipsEmptyState` | 已落地 | `empty-state` | 维持空态展示闭环 |
| 反馈控件 | ErrorState | `ChipsErrorState` | 已落地 | `error-state` | 维持静态错误展示、详情和动作入口，不能等同错误边界 |

## 3. 第一批已冻结控件

### `ChipsText`

- `data-scope="text"`，公开 part：`root`。
- 状态：`idle / disabled / error`。
- 主题 token：`chips.comp.text.root.color.*`、`font-size`、`line-height`、`font-weight.*`。
- 支持同步 i18n adapter：`textKey / textParams / fallbackText`。
- 只提供语义与主题挂点，不内置业务排版样式。

### `ChipsLabel`

- `data-scope="label"`，公开 part：`root / required-indicator / status`。
- 状态：`idle / disabled / error`。
- 主题 token：`chips.comp.label.root.*`、`chips.comp.label.required-indicator.color`、`chips.comp.label.status.color.error`。
- a11y 基线：必须关联控件（如 `htmlFor`）或提供可访问名称。

### `ChipsIcon`

- `data-scope="icon"`，公开 part：`root`。
- 状态：`idle`。
- 主题 token：`chips.comp.icon.root.color / size / fill / wght / grad / opsz`。
- 输入必须是 `IconDescriptor`；装饰图标默认 `aria-hidden="true"`，功能图标必须提供可访问标签。
- 默认与暗色主题必须通过 Material Symbols variable font 链路承载 `outlined / rounded / sharp`。

## 4. 第二批已冻结控件

### `ChipsIconButton`

- `data-scope="icon-button"`，公开 part：`root / icon / spinner / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.icon-button.root.*`、`icon.color.*`、`focus.outline`、`status.color.error`。
- 必须提供可访问名称；默认主题热区 token 为 `44cpx`，图标内容必须通过 `ChipsIcon` 或外部槽位提供。

### `ChipsToggleButton`

- `data-scope="toggle-button"`，公开 part：`root / icon / label / spinner / status`。
- 状态：标准交互状态集合；切换态使用 `aria-pressed` 与 `data-pressed`。
- 主题 token：`chips.comp.toggle-button.root.surface.*`、`label.color.*`、`icon.color.*`、`focus.outline`、`status.color.error`。
- 用于“按下/未按下”的命令按钮，不等同 `Switch` 或 `Checkbox`。

### `ChipsBadge`

- `data-scope="badge"`，公开 part：`root / icon / label / status`。
- 状态：`idle / disabled / error`。
- 主题 token：`chips.comp.badge.root.surface.*`、`label.color.*`、`icon.color.*`、`status.color.error`。
- 支持 `neutral / accent / success / warning / error` tone；可装饰隐藏，也可通过可访问名称表达计数或状态。

### `ChipsTag`

- `data-scope="tag"`，公开 part：`root / icon / label / close / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.tag.root.surface.*`、`label.color.*`、`icon.color.*`、`close.color.*`、`focus.outline`、`status.color.error`。
- 可关闭标签必须让 `close` part 作为真实按钮，并提供可访问名称。

### `ChipsAvatar`

- `data-scope="avatar"`，公开 part：`root / image / fallback / status`。
- 状态：`idle / disabled / loading / error`。
- 主题 token：`chips.comp.avatar.root.*`、`fallback.color`、`status.color.error`。
- 非装饰头像必须提供姓名、alt 或等价可访问标签；图片失败或错误态使用 fallback 缩写。

### `ChipsSpinner`

- `data-scope="spinner"`，公开 part：`root / track / indicator / status`。
- 状态：`idle / disabled / loading / error`。
- 主题 token：`chips.comp.spinner.root.size`、`track.color`、`indicator.*`、`motion.duration`、`status.color.*`。
- 独立使用时必须 `role="status"` 并有可访问名称；装饰性嵌入必须 `aria-hidden="true"`。

### `ChipsProgress`

- `data-scope="progress"`，公开 part：`root / track / range / label / value / status`。
- 状态：`idle / disabled / loading / error`；模式通过 `data-mode="determinate|indeterminate"` 表达。
- 主题 token：`chips.comp.progress.track.*`、`range.surface.*`、`label.color`、`value.color`、`status.color.error`、`focus.outline`。
- 确定进度必须输出 `aria-valuemin / aria-valuemax / aria-valuenow`；不确定进度不得输出 `aria-valuenow`。

### `ChipsRating`

- `data-scope="rating"`，公开 part：`root / label / item / icon / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.rating.root.*`、`item.*`、`icon.color.*`、`label.color`、`status.color.error`、`focus.outline`。
- 根节点必须使用 `role="radiogroup"` 并提供可访问名称；每个评分项使用 `role="radio"`、`aria-checked` 和 roving tabindex。`readOnly` 只阻止提交并设置 `aria-readonly`，不得覆盖已选项视觉状态为禁用态。
- 支持 `shape="star|heart"`、有限 `count`、受控 `value/onValueChange`、只读和禁用状态；图标通过 `ChipsIcon + IconDescriptor` 渲染，不使用 emoji。

## 5. 第三批已冻结控件

### `ChipsTextField`

- `data-scope="text-field"`，公开 part：`root / label / control / description / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.text-field.root.*`、`label.color`、`control.color`、`placeholder.color`、`description.color`、`status.color.error`、`focus.outline`。
- 必须通过 `label/labelKey/aria-label/aria-labelledby` 提供可访问名称；描述与错误通过 `aria-describedby` 关联。

### `ChipsTextArea`

- `data-scope="text-area"`，公开 part：`root / label / control / description / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.text-area.root.*`、`label.color`、`control.color`、`placeholder.color`、`description.color`、`status.color.error`、`focus.outline`。
- 支持多行文本、描述、错误和 `resize` 模式；`Enter` 默认保留换行语义，只有显式 `onEnterPress` 时才向业务上报。

### `ChipsSearchField`

- `data-scope="search-field"`，公开 part：`root / label / search-icon / control / clear / description / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.search-field.root.*`、`label/control/placeholder/description/icon/clear/status/focus`。
- 根节点使用 `role="search"`；`Enter` 触发 `onSearch`；清空按钮必须有可访问名称，并只负责清空输入值和通知业务。

### `ChipsSecureField`

- `data-scope="secure-field"`，公开 part：`root / label / control / visibility-toggle / visibility-icon / description / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.secure-field.root.*`、`label/control/placeholder/description/toggle/status/focus`。
- 可见性切换按钮必须有可访问名称并输出 `aria-pressed`；该控件只负责密码输入可见性，不承载密码管理、保存或自动填充策略。

## 6. 第四批已冻结控件

### `ChipsSegmentedControl`

- `data-scope="segmented-control"`，公开 part：`root / item / indicator / label / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.segmented-control.root.*`、`item.surface.*`、`label.color.*`、`indicator.surface`、`focus.outline`、`status.color.error`。
- 根节点使用 `role="radiogroup"` 并必须有可访问名称；分段项使用 `role="radio"` 和 `aria-checked` 表达单选状态，方向键、Home、End 在可用项间移动并更新选择。

### `ChipsComboBox`

- `data-scope="combo-box"`，公开 part：`root / label / control / trigger / list / option / description / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.combo-box.root.*`、`label/control/placeholder/trigger/list/option/description/status/focus`。
- 输入控件使用 `role="combobox"`、`aria-autocomplete="list"`、`aria-expanded`、`aria-controls` 和 `aria-activedescendant` 关联 listbox；选项使用 `role="option"` 与 `aria-selected`。

## 7. 第五批已冻结控件

### `ChipsNumberInput`

- `data-scope="number-input"`，公开 part：`root / label / control / decrement / increment / description / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.number-input.root.*`、`label/control/placeholder`、`decrement.color.*`、`increment.color.*`、`description.color`、`status.color.error`、`focus.outline`。
- 输入控件使用 `role="spinbutton"` 并必须有可访问名称；支持 `min / max / step / largeStep`、小数 step 对齐、解析失败状态、空值状态、方向键/PageUp/PageDown/Home/End 与内置增减按钮。

### `ChipsStepper`

- `data-scope="stepper"`，公开 part：`root / label / decrement / value / increment / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.stepper.root.*`、`label.color`、`value.color`、`decrement.surface.*`、`decrement.icon.color.*`、`increment.surface.*`、`increment.icon.color.*`、`status.color.error`、`focus.outline`。
- 根节点使用 `role="group"` 并必须有可访问名称；递增和递减是真实按钮，边界禁用通过 `disabled / aria-disabled` 与 `data-at-min / data-at-max` 表达。

### `ChipsSlider`

- `data-scope="slider"`，公开 part：`root / label / track / range / thumb / value / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.slider.root.*`、`label.color`、`track.*`、`range.surface.*`、`thumb.*`、`value.color`、`status.color.error`、`focus.outline`。
- `thumb` 使用 `role="slider"` 并必须有可访问名称；支持 `min / max / step / largeStep`、小数 step 对齐、方向键/PageUp/PageDown/Home/End、指针点按轨道、拖拽滑块与 `aria-valuetext`。

## 8. 第六批已冻结控件

### `ChipsDatePicker`

- `data-scope="date-picker"`，公开 part：`root / label / control / input / trigger / calendar / header / previous / next / title / grid / week-header / cell / description / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.date-picker.root.*`、`label/control/placeholder`、`trigger.color.*`、`calendar.*`、`header.color`、`nav.color.*`、`grid.gap`、`week-header.color`、`cell.surface.*`、`cell.text.*`、`description.color`、`status.color.error`、`focus.outline`。
- 值模型使用 `YYYY-MM-DD` 字符串，日历计算按纯日期处理，不把值隐式转换为时区相关 `Date` 对象；支持 `min / max / defaultMonth / weekStartsOn / isDateDisabled`、月份导航、方向键/PageUp/PageDown/Home/End、Enter 和 Escape。
- 输入控件使用 `role="combobox"` 并必须有可访问名称；展开状态通过 `aria-expanded`、`aria-controls`、`aria-activedescendant` 关联日历网格，日期格使用 `role="gridcell"` 与 `aria-selected`。

### `ChipsTimePicker`

- `data-scope="time-picker"`，公开 part：`root / label / control / input / trigger / list / option / description / status`。
- 状态：标准交互状态集合。
- 主题 token：`chips.comp.time-picker.root.*`、`label/control/placeholder`、`trigger.color.*`、`list.*`、`option.surface.*`、`option.text.color`、`description.color`、`status.color.error`、`focus.outline`。
- 值模型使用 `HH:mm` 字符串，显式秒级场景使用 `HH:mm:ss`，不隐式绑定日期或时区；支持 `min / max / step / optionStep / showSeconds / options / isTimeDisabled`，默认列表按 `optionStep` 生成，键盘增减按 `step` 执行。
- 输入控件使用 `role="combobox"` 并必须有可访问名称；展开状态通过 `aria-expanded`、`aria-controls`、`aria-activedescendant` 关联 listbox，选项使用 `role="option"` 与 `aria-selected`。

## 9. 第七批已冻结控件

### `ChipsImage`

- `data-scope="image"`，公开 part：`root / media / fallback / caption / status`。
- 状态：`idle / disabled / loading / error`。
- 主题 token：`chips.comp.image.root.*`、`media.surface`、`fallback.*`、`caption.color`、`status.color.error`、`focus.outline`。
- 非装饰图片必须提供 alt 或等价可访问名称，根节点使用 `role="group"`；装饰图片必须 `aria-hidden="true"` 且空 alt。该组件只负责静态图片结构、加载/错误 fallback 和说明文本，不承载图片处理或资源管理策略。

### `ChipsMedia`

- `data-scope="media"`，公开 part：`root / content / controls / control / caption / status`。
- 状态：`idle / disabled / loading / error`。
- 主题 token：`chips.comp.media.root.*`、`content.surface`、`controls.surface`、`control.*`、`caption.color`、`status.color.error`、`focus.outline`。
- 音频和视频必须提供可访问标题，根节点使用 `role="group"`；通用媒体在无标题时必须提供 children 作为内容边界。该组件只提供媒体显示边界和控制槽视觉，不等同播放器应用、转码模块或资源打开链路。

### `ChipsErrorState`

- `data-scope="error-state"`，公开 part：`root / icon / title / description / details / action / status`。
- 状态：`idle / disabled / loading / error`。
- 主题 token：`chips.comp.error-state.root.*`、`icon.color`、`title.color`、`description.color`、`details.color`、`action.*`、`status.color.error`、`focus.outline`。
- 根节点必须使用 `role="alert"` 并提供可访问名称；`details` 用于展示标准化错误详情，`action` 用于业务注入的重试、返回或恢复动作。该组件是静态错误展示，不等同 `ChipsErrorBoundary` 的运行时异常捕获边界，也不等同 `ChipsEmptyState` 的空态展示。

## 10. 后续批次建议

- 批次 B：`IconButton / ToggleButton / Badge / Tag / Avatar / Spinner / Progress / Rating`（已落地）。
- 批次 C：`TextField / TextArea / SearchField / SecureField`（已落地）。
- 批次 D：`SegmentedControl / ComboBox`（已落地）。
- 批次 E：`NumberInput / Stepper / Slider`（已落地）。
- 批次 F：`DatePicker / TimePicker`（已落地）。
- 批次 G：`Image / Media / ErrorState`（已落地）。

每一批都必须同步组件库、组件 contract、组件 token、默认主题、暗色主题、公共文档和测试；不得只新增空壳导出。
