# CSS 与组件对接规范（Chips-default）

> 文档状态：实现对齐稿  
> 适用范围：`ThemePack/Chips-default/styles/*`

---

## 1. 设计原则

- **契约优先**：所有样式仅通过组件库约定的 `data-scope` / `data-part` / `data-state` 与 `chips.comp.*` token 对接，不依赖实现细节类名。
- **五层 token 驱动**：
  - 色彩与语义：`chips.sys.*`；
  - 组件视觉：`chips.comp.*`；
  - 动效：`chips.motion.*`；
  - 布局密度：`chips.layout.*`；
  - 少量派生变量在 `styles/base.css` 中声明（例如 `--chips-base-radius-md`），仅作为本主题内部复用。
- **系统级冷白与微体积**：整体采用冷白底面、白色控件片、弱边框、顶部高光、底部暗边和多层柔阴影表达层级；蓝色只用于焦点、选中和必要强调，避免默认按钮与侧栏菜单全部染蓝。
- **无头组件适配**：组件库只输出结构与状态，本主题只负责：
  - 背景 / 边框 / 文本颜色；
  - 间距 / 圆角；
  - 基础过渡、浮层投影与聚焦样式。

`styles/base.css` 允许声明仅供本主题 CSS 内部复用的派生变量，例如：

- `--chips-base-border-subtle`：弱边框和分隔线；
- `--chips-base-surface-muted`：弱背景；
- `--chips-base-control-height` / `--chips-base-control-height-compact`：控件高度基线；
- `--chips-base-shadow-sm/md/lg`：浮层和容器投影；
- `--chips-base-focus-ring`：统一浅蓝焦点外环。
- `--chips-base-shadow-control/card/panel/float`：从 `样式标准示范.html` 抽象出的控件片、内容片层、面板和浮层投影。
- `--chips-base-surface-window/control/recessed`：从样式标准示范抽象出的窗口、控件片和内凹输入表面。

这些变量不属于公共 `chips.*` token，不进入主题契约；对外仍以 `chips.ref/sys/comp/motion/layout` 为正式数据来源。

---

## 2. 目录与文件划分

主题 CSS 文件按职责划分：

- 全局基线：
  - `styles/base.css`：全局字体、背景与派生变量。
  - `styles/motions.css`：通用淡入淡出动效。
- 组件样式：
  - `styles/components/button.css`：按钮（`button`）。
  - `styles/components/input.css`：输入框（`input`）。
  - `styles/components/form-controls.css`：选择控件（`checkbox`、`radio`、`switch`、`select`）。
  - `styles/components/overlays.css`：浮层与命令消费组件（`dialog`、`popover`、`tooltip`、`command-palette`、`toolbar`、`menu-bar`、`context-menu`、`shortcut`、`date-time`）。
  - `styles/components/layout-containers.css`：布局与容器组件（`tabs`、`menu`、`form`、`virtual-list`、`data-grid`、`tree`、`navigation-split-view`、`split-pane`、`dock-panel`、`inspector`、`panel-header`、`card-shell`、`tool-window`）。
  - `styles/components/feedback.css`：反馈与边界组件（`notification`、`toast`、`empty-state`、`skeleton`、`error-boundary`、`loading-boundary`、`card-cover-frame`、`composite-card-window`）。

`src/build-css.ts` 会按以下顺序拼接 CSS：

1. `styles/base.css`
2. `styles/components/*.css`（按文件名排序）
3. `styles/motions.css`

最终输出为 `dist/theme.css`。

---

## 3. data-scope / data-part / data-state 约定

本主题统一采用生态规定的组件契约挂点：

- `data-scope`：组件类型（如 `button`、`input`、`dialog`）。
- `data-part`：组件内部结构片段（如 `root`、`label`、`content`）。
- `data-state`：交互状态（`idle | hover | focus | active | disabled | loading | error`）。

典型示例（Button）：

```html
<button
  data-scope="button"
  data-part="root"
  data-state="idle"
>
  <span data-part="label">保存</span>
</button>
```

主题 CSS 始终以 `data-scope` + `data-part` 为基础选择器，必要时结合 `data-state` 或伪类（`:hover` / `:focus-visible` / `:active`）实现状态样式。

---

## 4. 组件与 token 映射（核心示例）

### 4.1 Button

- 结构：
  - `data-scope="button" data-part="root|label|spinner|status"`
- 视觉语义：
  - 组件库当前未声明 `primary` / `secondary` 等按钮 variant，因此默认主题不能把所有 `button` 渲染为蓝色主按钮；
  - 默认按钮是白色控件片，蓝色只用于 focus ring 或由调用方通过更高层作用域显式覆盖 token。
- 核心 token：
  - `chips.comp.button.root.radius`
  - `chips.comp.button.root.surface.idle|hover|active|disabled`
  - `chips.comp.button.label.color.idle|disabled`
  - `chips.comp.button.focus.outline`
- 对应 CSS：

```css
[data-scope="button"][data-part="root"] {
  border: 1px solid var(--chips-base-border-subtle);
  border-radius: var(--chips-comp-button-root-radius, var(--chips-base-radius-md));
  background-color: var(--chips-comp-button-root-surface-idle);
  color: var(--chips-comp-button-label-color-idle);
  min-block-size: var(--chips-base-control-height);
  box-shadow: var(--chips-base-shadow-control);
}

[data-scope="button"][data-part="root"][data-state="hover"],
[data-scope="button"][data-part="root"]:hover {
  background-color: var(--chips-comp-button-root-surface-hover, var(--chips-comp-button-root-surface-idle));
  box-shadow: var(--chips-base-shadow-control-hover);
}

[data-scope="button"][data-part="root"][data-state="disabled"],
[data-scope="button"][data-part="root"][aria-disabled="true"] {
  background-color: var(--chips-comp-button-root-surface-disabled);
  color: var(--chips-comp-button-label-color-disabled, var(--chips-comp-button-label-color-idle));
}

[data-scope="button"][data-part="root"][data-state="focus"],
[data-scope="button"][data-part="root"]:focus-visible {
  outline: var(--chips-base-layout-focus-outline-width) solid var(--chips-comp-button-focus-outline);
  box-shadow: var(--chips-base-focus-ring);
}
```

### 4.2 Input

- 结构：
  - `data-scope="input" data-part="root|control|status"`
- 核心 token：
  - `chips.comp.input.root.radius`
  - `chips.comp.input.root.surface.idle|focus`
  - `chips.comp.input.root.border.idle|error`
  - `chips.comp.input.value.color`
  - `chips.comp.input.placeholder.color`
- 对应 CSS（节选）：

```css
[data-scope="input"][data-part="root"] {
  border-radius: var(--chips-comp-input-root-radius, var(--chips-base-radius-md));
  background-color: var(--chips-comp-input-root-surface-idle);
  border: 1px solid var(--chips-comp-input-root-border-idle);
  box-shadow: var(--chips-base-shadow-recessed);
}

[data-scope="input"][data-part="root"][data-state="focus"],
[data-scope="input"][data-part="root"]:focus-within {
  background-color: var(--chips-comp-input-root-surface-focus, var(--chips-comp-input-root-surface-idle));
  box-shadow: var(--chips-base-focus-ring), var(--chips-base-shadow-recessed);
}

[data-scope="input"][data-part="control"] {
  color: var(--chips-comp-input-value-color, var(--chips-sys-color-on-surface));
}

[data-scope="input"][data-part="control"]::placeholder {
  color: var(--chips-comp-input-placeholder-color);
}
```

### 4.3 其他组件

所有其他组件均遵循相同模式：

- 使用 `COMPONENT_TOKEN_MAP` / 主题契约中声明的 `chips.comp.<component>.*` token；
- 在对应 CSS 文件中按 `data-scope="<component>"` / `data-part="..."` 映射到：
  - 背景（`surface.*`）；
  - 文本颜色（`text.color` / `label.color` 等）；
  - 边框与分隔线（`border.*` / `divider.color`）；
  - 焦点轮廓（`focus.outline`）。

`data-grid` 在本主题中对齐任务016 Compound contract：只消费 `root / toolbar / header / row / cell / pagination / status` 公开 part，不依赖内部 `table` DOM。工具栏和分页分别使用 `chips.comp.data-grid.toolbar.*` 与 `chips.comp.data-grid.pagination.*`；列头排序态使用 `data-part="cell"`、`data-header="true"` 和 `data-sort="ascending|descending"`；行选中视觉必须匹配 `data-selected="true"`。

`tree` 在本主题中对齐任务016 Compound contract：只消费 `root / item / branch / leaf / disclosure / label / group / status` 公开 part，不依赖旧 `node / toggle / children`。树项基础视觉统一使用 `chips.comp.tree.item.*`，展开折叠入口使用 `chips.comp.tree.disclosure.color`，子树引导线使用 `chips.comp.tree.group.guide.color`。节点选中视觉必须匹配 `data-selected="true"`，层级缩进通过组件输出的 `--chips-tree-level` 与 `chips.comp.tree.branch.indent` token 计算。

输入类控件在本主题中统一以 `--chips-base-control-height` 控制主体高度；`search-field / secure-field / combo-box / number-input` 的图标、清除按钮、可见性按钮和增减按钮使用绝对定位，但定位基于控件高度和 `:has(> [data-part="label"])` 修正有标签场景，不依赖固定 `14px` 文本高度。

菜单、Popover、Dialog、CommandPalette、Select、日期/时间弹层统一使用 `--chips-base-shadow-float` 与 `--chips-base-border-subtle` 表达层级，并通过 `backdrop-filter`、顶部高光和底部暗边形成克制液态浮层。`Select.Content` 在本主题中作为锚定触发器下方的绝对定位 listbox 浮层呈现，消费 `--chips-select-content-gutter / --chips-select-content-min-inline-size / --chips-select-content-max-block-size` 控制间距、宽度和滚动边界，不进入普通文档流。列表型选中态优先使用浅蓝背景，强主色只保留给表单焦点、开关/单选/复选选中和进度范围。

`navigation-split-view` 在本主题中对齐任务016.07 Compound contract：只消费 `root / sidebar / content / detail / divider / status` 公开 part，不复用 `split-view` 的 `primary / secondary` 主题入口。导航侧栏最小宽度使用 `chips.layout.size.navigation-primary-min`，中间内容栏使用 `chips.layout.size.split-secondary-min`，分割线厚度和焦点环继续消费 `chips.layout.divider.*` 与 `chips.layout.focus.*`。

设置面板一类应用应通过 `navigation-split-view + section + data-grid/tree/virtual-list + form` 组合形成 macOS 设置式结构。主题包提供冷白底面、半透侧栏、白色内容片层和浅蓝选中态；业务应用不得用自定义蓝色按钮列表绕开 `button / toggle-button / navigation-split-view` 的主题 token。列表对齐由组件结构和业务 grid/flex 列控制，主题 CSS 只负责固定控件高度、热区、内边距和视觉层级。

`box` 是基础布局原语，不默认输出边框、阴影和浮卡高光；需要内容片层时应使用 `section / card-shell / data-grid / tree / dock-panel / tool-window / empty-state` 等更明确的组件 scope，避免页面出现卡片套卡片。

命令消费组件在本主题中作为正式组件覆盖：`toolbar` 消费 `root / group / item / icon / label / shortcut / status`，`menu-bar` 消费 `root / menu / content / group / item / shortcut / status`，`context-menu` 消费 `root / trigger / content / group / item / shortcut / status`，`shortcut` 消费 `root / key / separator`。这些组件不能只依赖 `command-palette` 或浏览器默认按钮样式，主题 CSS 必须显式命中对应 `data-scope`。

`ChipsIcon` 的 tone 由 `data-tone="default|muted|accent|danger|disabled"` 暴露。默认主题在 `styles/base.css` 中以 `chips.comp.icon.root.* -> chips.sys.icon.*` 的顺序解析色彩、强调填充、权重和 grade；工具栏、菜单栏、上下文菜单和图标按钮的图标状态继续通过自身 `chips.comp.*.icon.*` token 覆盖，不硬编码私有尺寸或颜色。

---

## 5. 动效与布局

### 5.1 动效

- Token：
  - `chips.motion.duration.instant|fast|normal|slow|emphasized`
  - `chips.motion.easing.standard|entrance|exit|emphasized`
  - `chips.motion.overlay.*`
  - `chips.motion.menu.*`
  - `chips.motion.scene.*`
  - `chips.motion.list.*`
  - `chips.motion.drag.*`
  - `chips.motion.theme.*`
  - `chips.motion.reduced.*`
- CSS 使用方式：

```css
.chips-fade-enter,
.chips-fade-exit {
  transition:
    opacity var(--chips-motion-duration-normal, 250ms)
      var(--chips-motion-easing-standard, cubic-bezier(0.4, 0, 0.2, 1));
}
```

`styles/motions.css` 提供 `fade / overlay / menu / scene / list / drag / theme` 公共 motion class 和等价 `data-motion` 入口。`prefers-reduced-motion: reduce` 下关闭非必要动画、位移和缩放，只保留焦点、颜色和状态反馈。

反馈组件中的 `skeleton` 可以在本主题 CSS 中使用轻量 shimmer keyframes；该动画必须绑定 `chips.comp.skeleton.item.motion.*` 并在 `prefers-reduced-motion: reduce` 下关闭。

### 5.2 布局密度

- Token：
  - `chips.layout.density.comfortable`
  - `chips.layout.gap.md`
- 在本主题中，通过 `styles/base.css` 中的派生变量（如 `--chips-base-space-2/3/4`）抽象为常用内边距与间距，用于控制组件之间的距离。

---

## 6. 一致性与扩展约束

- 不新增新的 `chips.*` token 名称；如需新增，必须先在 `@chips/tokens` 与生态共用技术文档中完成设计。
- 如需新增组件样式：
  1. 在 `Chips-ComponentLibrary/packages/theme-contracts` 中补充组件契约；
  2. 在 `@chips/tokens` 中补充对应 `chips.comp.*` token；
  3. 运行 `npm run build:contracts` 从组件库正式 contract 生成本主题包 contract 产物；
  4. 在本主题包的 `tokens/comp/*.json` 中对齐；
  5. 在 `styles/components/*.css` 中实现样式，并保证 CSS scope 覆盖测试通过；
  6. 视需要更新本文件的映射说明。
- 主题样式不得修改组件 DOM 结构，仅通过 CSS 控制视觉。
