# 阶段七：Data-Form 与 Workbench 组件开发

## 阶段目标

补齐数据与工作台核心组件，支持编辑器/查看器/设置面板等高复杂度场景。
卡片显示 iframe 高级组件（`CardCoverFrame`、`CompositeCardWindow`）由阶段十一专项实施。

## 组件范围

### Data & Form

- DataGrid
- Tree
- VirtualList
- FormField
- FormGroup
- DateTime
- CommandPalette

### Workbench

- SplitPane
- DockPanel
- Inspector
- PanelHeader
- CardShell
- ToolWindow

## 开发任务

### 1. Data组件

- 大数据量组件必须支持虚拟化。
- 表格/树组件支持可控排序、选择、展开状态。
- 表单组件支持校验态、错误态、只读态。

### 2. Workbench组件

- 分栏拖拽、面板停靠、最小化/恢复。
- 工具窗口状态持久化接口预留。
- 支持复杂布局下的主题与a11y一致性。

### 3. 性能优化

- 列表和树渲染采用增量更新。
- 大组件拆分渲染与memo策略。

### 4. 契约与文档

- 复杂组件的`part`清单必须完整公开。
- 每组件提供交互状态图与键盘清单。

## 阶段产物

- Data & Workbench组件实现与文档。
- 复杂交互测试集。
- 性能测试基线报告。

## 退出条件

- 关键工作台场景可稳定运行。
- 复杂组件在长列表和高频交互下无明显卡顿。

## 执行进展（2026-03-05）

已完成（第一批，Data-Form P0）：

- `Form/VirtualList` 已落地：
  - 统一状态优先级裁决
  - 结构契约 `data-scope/data-part/data-state`
  - role/aria 语义与键盘路径
  - `VirtualList` 完整窗口计算与 overscan 渲染
- 组件 token 映射与主题契约已落地：
  - `chips.comp.form.*`
  - `chips.comp.virtual-list.*`
- 测试与校验已通过，`npm run verify` 全量通过。

任务016.03 已将早期字段与分组表单能力收口为 `ChipsForm.Root / Section / Field / Label / Control / Error / Hint` Compound API；旧字段与分组 scope、token 和 contract 只保留在归档中。

已完成（第二批，Data-Form P1）：

- `DataGrid/Tree/DateTime/CommandPalette` 已落地：
  - 统一状态优先级裁决
  - 结构契约 `data-scope/data-part/data-state`
  - role/aria 语义与键盘交互路径
  - 数据侧关键能力（排序、树展开/选择、查询过滤、时间输入）闭环
- 组件 token 映射与主题契约已落地：
  - `chips.comp.data-grid.*`
  - `chips.comp.tree.*`
  - `chips.comp.date-time.*`
  - `chips.comp.command-palette.*`
- 测试与校验已通过，`npm run verify` 全量通过（141 token keys / 20 contracts / 97 tests）。

已完成（第三批，Workbench）：

- `SplitPane/DockPanel/Inspector/PanelHeader/CardShell/ToolWindow` 已落地：
  - 统一状态优先级裁决
  - 结构契约 `data-scope/data-part/data-state`
  - role/aria 语义与键盘交互路径
  - 工作台关键能力（分栏调整、停靠面板、检查器折叠、工具窗最小化）闭环
- 组件 token 映射与主题契约已落地：
  - `chips.comp.split-pane.*`
  - `chips.comp.dock-panel.*`
  - `chips.comp.inspector.*`
  - `chips.comp.panel-header.*`
  - `chips.comp.card-shell.*`
  - `chips.comp.tool-window.*`
- 测试与校验已通过，`npm run verify` 全量通过（179 token keys / 26 contracts / 109 tests）。
- 交付补齐：
  - 交互状态图与键盘清单文档：`技术文档/22-阶段七交互状态图与键盘清单.md`
  - 性能基线脚本：`scripts/benchmark-stage7.mjs`
  - 性能基线报告：`技术文档/23-阶段七性能基线报告.md`
  - `npm run bench:stage7` 已执行，阶段七核心路径 p95 全部满足 `<= 32ms` 基线

阶段结论：

- 阶段七范围组件已完整闭环（实现、测试、交互文档、性能基线齐备），进入阶段八。
