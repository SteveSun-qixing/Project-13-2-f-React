# Data-Form P1 第二批组件规范

## 1. 范围

本规范覆盖阶段七第二批已落地组件：

- `ChipsDataGrid`
- `ChipsTree`
- `ChipsDateTime`
- `ChipsCommandPalette`

## 2. 统一状态与契约

四组件统一继承状态优先级：

`disabled > loading > error > active > focus > hover > idle`

并强制输出 `data-scope/data-part/data-state`。

## 3. 组件规范

### 3.1 ChipsDataGrid

- `data-scope="data-grid"`
- Compound API：`ChipsDataGrid.Root / Toolbar / Header / Row / Cell / Pagination`
- 公开 `data-part="root|toolbar|header|row|cell|pagination|status"`
- `table` 只作为默认数据驱动渲染的内部 DOM 结构，不再是公开 part。
- 语义：
  - root：默认 `role="group"`，承载外层状态和上下文。
  - 内部网格区域：`role="grid"`；默认 fallback 使用真实 `table role="grid"`。
  - toolbar：`role="toolbar"`
  - pagination：`role="navigation"`
  - header：表头行语义。
  - row：`role="row"`，通过 `aria-selected`、`data-selected`、`data-active` 表达选择和活动行。
  - cell：普通单元格 `role="gridcell"`；`header=true` 时为列头 `role="columnheader"` 并输出 `aria-sort`、`data-sort`、`data-sortable`。
- 能力：
  - 列排序（`asc/desc`）
  - 行选择（受控/非受控）
  - 键盘导航（`Arrow/Home/End/Enter/Space`）
  - 工具栏与分页 slot 结构对齐 Host L8 `DataGrid` schema。

### 3.2 ChipsTree

- `data-scope="tree"`
- Compound API：`ChipsTree.Root / Item / Branch / Leaf / Disclosure`
- 公开 `data-part="root|item|branch|leaf|disclosure|label|group|status"`
- 语义：
  - root：`role="tree"`
  - item/branch/leaf：`role="treeitem"` + `aria-level` + `aria-setsize` + `aria-posinset`
  - branch：通过 `aria-expanded` 表达展开状态，子节点容器使用 `group role="group"`
  - disclosure：分支内展开折叠控制，默认不进入 Tab 顺序
- 能力：
  - 展开折叠（受控/非受控）
  - 节点选择（受控/非受控）
  - 键盘导航（`Arrow/Home/End/Enter/Space`）
  - 图标槽位：`expandIconContent`、`collapseIconContent`（避免内置硬编码文案）
  - 旧 `node/toggle/children` 已收口，不再是公开 part；选中视觉使用 `data-selected="true"`，层级缩进使用 `--chips-tree-level` 与 Tree token，不在运行时硬编码像素。

### 3.3 ChipsDateTime

- `data-scope="date-time"`
- `data-part="root|input|icon|status"`
- 语义：
  - input：`type="datetime-local"`
  - 错误态：`aria-invalid`
- 能力：
  - 受控/非受控时间值
  - `min/max/step` 参数约束
  - 图标槽位：`iconContent`（默认使用语义 SVG，不写死文案）

### 3.4 ChipsCommandPalette

- `data-scope="command-palette"`
- `data-part="root|input|list|group|group-label|item|shortcut|status"`
- 语义：
  - input：`role="combobox"`
  - list：`role="listbox"`
  - group：`role="group"`，有标题时通过 `group-label` 关联
  - item：`role="option"`
- 能力：
  - 查询过滤（label/shortcut/keywords）
  - `Root / Input / List / Item / Group` Compound API
  - 高亮导航（`Arrow/Home/End`）
  - 回车选择与 Esc 关闭

## 4. Token 映射

新增组件 token：

- `chips.comp.data-grid.*`
- `chips.comp.tree.*`
- `chips.comp.date-time.*`
- `chips.comp.command-palette.*`

`ChipsDataGrid` 当前 required token 覆盖 `root.surface`、`toolbar.surface/gap`、`header.surface/text.color/sort.color`、`row.surface.idle/hover/selected`、`cell.text.color`、`pagination.surface/gap`、`border.color` 与 `focus.outline`。选中行视觉以 `data-selected="true"` 为正式选择器，不使用 `data-state="active"` 表达选择。

`ChipsTree` 当前 required token 覆盖 `root.surface`、`item.surface.idle/hover/selected/disabled`、`item.text.color`、`branch.indent`、`leaf.indent`、`disclosure.color`、`group.guide.color`、`status.color.error` 与 `focus.outline`。选中节点视觉以 `data-selected="true"` 为正式选择器，不使用 `data-state="active"` 表达选择。

`ChipsCommandPalette` 当前 required token 覆盖 `root.surface`、`input.surface.idle`、`input.border.idle`、`item.surface.active`、`item.text.color`、`group.label.color`、`shortcut.color` 与 `focus.outline`。正式输入 part 为 `input`，命令条目 part 为 `item`；旧 `search/result` 不再作为公开 part 或 token 口径。

对应源文件：

- `packages/tokens/tokens/comp/data-grid.json`
- `packages/tokens/tokens/comp/tree.json`
- `packages/tokens/tokens/comp/date-time.json`
- `packages/tokens/tokens/comp/command-palette.json`

## 5. 主题契约

对应契约：

- `packages/theme-contracts/contracts/components/data-grid.contract.json`
- `packages/theme-contracts/contracts/components/tree.contract.json`
- `packages/theme-contracts/contracts/components/date-time.contract.json`
- `packages/theme-contracts/contracts/components/command-palette.contract.json`

## 6. 验证结果（2026-03-05）

- token 校验通过（141 keys）
- 主题契约校验通过（20 contracts）
- 组件测试通过（97 tests）
- `npm run verify` 全量通过

## 7. 阶段七交互与性能补充交付

- 交互状态图与键盘清单：`技术文档/22-阶段七交互状态图与键盘清单.md`
- 性能基线报告：`技术文档/23-阶段七性能基线报告.md`

## 8. 阶段七后续

Workbench 组件规范见：

- `21-Workbench-P2第一批组件规范.md`
