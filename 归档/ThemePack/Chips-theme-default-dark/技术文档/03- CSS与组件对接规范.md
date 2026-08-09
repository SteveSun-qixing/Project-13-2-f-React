# CSS 与组件对接规范（Chips-theme-default-dark）

> 文档状态：实现对齐稿  
> 适用范围：`ThemePack/Chips-theme-default-dark/styles/*`

---

## 1. 设计原则

- **契约优先**：所有样式仅通过组件库约定的 `data-scope` / `data-part` / `data-state` 与 `chips.comp.*` token 对接，不依赖实现细节类名。
- **五层 token 驱动**：
  - 色彩与语义：`chips.sys.*`；
  - 组件视觉：`chips.comp.*`；
  - 动效：`chips.motion.*`；
  - 布局密度：`chips.layout.*`；
  - 少量派生变量在 `styles/base.css` 中声明（例如 `--chips-base-radius-md`），仅作为本主题内部复用。
- **简约优雅**：整体采用暗夜基线 + 单主色（冷调蓝色），阴影和圆角克制，避免复杂渐变与炫技动画。
- **无头组件适配**：组件库只输出结构与状态，本主题只负责：
  - 背景 / 边框 / 文本颜色；
  - 间距 / 圆角；
  - 基础过渡与聚焦样式。

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
  - `styles/components/overlays.css`：浮层组件与命令消费组件（`dialog`、`popover`、`tooltip`、`command-palette`、`toolbar`、`menu-bar`、`context-menu`、`shortcut`、`date-time`）。
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
- 核心 token：
  - `chips.comp.button.root.radius`
  - `chips.comp.button.root.surface.idle|hover|active|disabled`
  - `chips.comp.button.label.color.idle|disabled`
  - `chips.comp.button.focus.outline`
- 对应 CSS：

```css
[data-scope="button"][data-part="root"] {
  border-radius: var(--chips-comp-button-root-radius, var(--chips-base-radius-md));
  background-color: var(--chips-comp-button-root-surface-idle);
  color: var(--chips-comp-button-label-color-idle);
}

[data-scope="button"][data-part="root"][data-state="hover"],
[data-scope="button"][data-part="root"]:hover {
  background-color: var(--chips-comp-button-root-surface-hover, var(--chips-comp-button-root-surface-idle));
}

[data-scope="button"][data-part="root"][data-state="disabled"],
[data-scope="button"][data-part="root"][aria-disabled="true"] {
  background-color: var(--chips-comp-button-root-surface-disabled);
  color: var(--chips-comp-button-label-color-disabled, var(--chips-comp-button-label-color-idle));
}

[data-scope="button"][data-part="root"][data-state="focus"],
[data-scope="button"][data-part="root"]:focus-visible {
  outline: var(--chips-base-layout-focus-outline-width) solid var(--chips-comp-button-focus-outline);
  outline-offset: var(--chips-base-layout-focus-outline-offset);
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
}

[data-scope="input"][data-part="root"][data-state="focus"],
[data-scope="input"][data-part="root"]:focus-within {
  background-color: var(--chips-comp-input-root-surface-focus, var(--chips-comp-input-root-surface-idle));
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

`navigation-split-view` 在本主题中对齐任务016.07 Compound contract：只消费 `root / sidebar / content / detail / divider / status` 公开 part，不复用 `split-view` 的 `primary / secondary` 主题入口。导航侧栏最小宽度使用 `chips.layout.size.navigation-primary-min`，中间内容栏使用 `chips.layout.size.split-secondary-min`，分割线厚度和焦点环继续消费 `chips.layout.divider.*` 与 `chips.layout.focus.*`。

`toolbar / menu-bar / context-menu / shortcut` 是命令消费组件的正式主题 scope。本主题在 `overlays.css` 中提供独立暗色样式：工具栏和菜单栏使用 `surface-raised` 层，菜单内容使用 `surface-elevated` 层，hover/active 使用低饱和 `info-surface`，焦点统一使用 `focus-ring`。这些组件只展示或消费 Host command/shortcut 链路的结果，不在主题包中实现命令注册、调度或快捷键处理。

菜单、Popover、Dialog、CommandPalette、Select、日期/时间弹层统一使用 `--chips-base-shadow-float` 与 `--chips-base-border-subtle` 表达层级，并通过 `backdrop-filter`、顶部高光和底部暗边形成克制液态浮层。`Select.Content` 在本主题中作为锚定触发器下方的绝对定位 listbox 浮层呈现，消费 `--chips-select-content-gutter / --chips-select-content-min-inline-size / --chips-select-content-max-block-size` 控制间距、宽度和滚动边界，不进入普通文档流。

`ChipsIcon` 的 tone 由 `data-tone="default|muted|accent|danger|disabled"` 暴露。暗夜主题在 `styles/base.css` 中以 `chips.comp.icon.root.* -> chips.sys.icon.*` 的顺序解析色彩、强调填充、权重和 grade；工具栏、菜单栏、上下文菜单和图标按钮的图标状态继续通过自身 `chips.comp.*.icon.*` token 覆盖，不硬编码私有尺寸或颜色。

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

### 5.2 布局密度

- Token：
  - `chips.layout.density.comfortable`
  - `chips.layout.gap.md`
- 在本主题中，通过 `styles/base.css` 中的派生变量（如 `--chips-base-space-1/2/3/4`、`--chips-base-control-height`、`--chips-base-control-height-compact`）抽象为常用内边距、控件高度与间距，用于控制组件视觉密度。

---

## 6. 一致性与扩展约束

- 不新增新的 `chips.*` token 名称；如需新增，必须先在 `@chips/tokens` 与生态共用技术文档中完成设计。
- 如需新增组件样式：
  1. 在 `Chips-ComponentLibrary/packages/theme-contracts` 中补充组件契约；
  2. 在 `@chips/tokens` 中补充对应 `chips.comp.*` token；
  3. 在本主题包的 `tokens/comp/*.json` 中对齐；
  4. 在 `styles/components/*.css` 中实现样式；
  5. 视需要更新本文件的映射说明。
- 主题样式不得修改组件 DOM 结构，仅通过 CSS 控制视觉。
