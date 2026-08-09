# Workbench P2 第一批组件规范

## 1. 范围

本规范覆盖阶段七 Workbench 已落地组件：

- `ChipsSplitPane`
- `ChipsDockPanel`
- `ChipsInspector`
- `ChipsPanelHeader`
- `ChipsCardShell`
- `ChipsToolWindow`

## 2. 统一状态与契约

六组件统一继承状态优先级：

`disabled > loading > error > active > focus > hover > idle`

并强制输出 `data-scope/data-part/data-state`。

## 3. 组件规范

### 3.1 ChipsSplitPane

- `data-scope="split-pane"`
- `data-part="root|pane-start|resizer|pane-end|status"`
- 语义：
  - root：`role="group"`
  - resizer：`role="separator"`
- 能力：
  - 受控/非受控分栏比例
  - 鼠标拖拽与键盘分隔条调整

### 3.2 ChipsDockPanel

- `data-scope="dock-panel"`
- `data-part="root|tab-list|tab|content|status"`
- 语义：
  - tab-list：`role="tablist"`
  - tab：`role="tab"`
  - content：`role="tabpanel"`
- 能力：
  - 面板状态映射（active/minimized/hidden）
  - 活跃面板受控/非受控管理

### 3.3 ChipsInspector

- `data-scope="inspector"`
- `data-part="root|section|header|body|status"`
- 语义：
  - root：`role="complementary"`
  - body：`role="region"`
- 能力：
  - 节点折叠/展开受控管理
  - 键盘导航（`Arrow/Home/End/Enter/Space`）

### 3.4 ChipsPanelHeader

- `data-scope="panel-header"`
- `data-part="root|title|subtitle|actions|toggle|close|status"`
- 语义：
  - root：`role="group"`
- 能力：
  - 折叠开关受控/非受控
  - 关闭事件回调
  - 图标槽位：`expandIconContent`、`collapseIconContent`、`closeIconContent`

### 3.5 ChipsCardShell

- `data-scope="card-shell"`
- `data-part="root|header|toolbar|content|footer|status"`
- 语义：
  - root：`role="article"`
- 能力：
  - 标准卡片承载壳层
  - active 状态投影

### 3.6 ChipsToolWindow

- `data-scope="tool-window"`
- `data-part="root|header|controls|body|status"`
- 语义：
  - root：`role="dialog"`
- 能力：
  - open/minimized 受控/非受控
  - 最小化/恢复与关闭
  - 图标槽位：`expandIconContent`、`collapseIconContent`、`closeIconContent`

## 4. Token 映射

新增组件 token：

- `chips.comp.split-pane.*`
- `chips.comp.dock-panel.*`
- `chips.comp.inspector.*`
- `chips.comp.panel-header.*`
- `chips.comp.card-shell.*`
- `chips.comp.tool-window.*`

对应源文件：

- `packages/tokens/tokens/comp/split-pane.json`
- `packages/tokens/tokens/comp/dock-panel.json`
- `packages/tokens/tokens/comp/inspector.json`
- `packages/tokens/tokens/comp/panel-header.json`
- `packages/tokens/tokens/comp/card-shell.json`
- `packages/tokens/tokens/comp/tool-window.json`

## 5. 主题契约

对应契约：

- `packages/theme-contracts/contracts/components/split-pane.contract.json`
- `packages/theme-contracts/contracts/components/dock-panel.contract.json`
- `packages/theme-contracts/contracts/components/inspector.contract.json`
- `packages/theme-contracts/contracts/components/panel-header.contract.json`
- `packages/theme-contracts/contracts/components/card-shell.contract.json`
- `packages/theme-contracts/contracts/components/tool-window.contract.json`

## 6. 验证结果（2026-03-05）

- token 校验通过（179 keys）
- 主题契约校验通过（26 contracts）
- 组件测试通过（109 tests）
- `npm run verify` 全量通过

## 7. 阶段七交互与性能补充交付

- 交互状态图与键盘清单：`技术文档/22-阶段七交互状态图与键盘清单.md`
- 性能基线报告：`技术文档/23-阶段七性能基线报告.md`

## 8. 阶段结论

阶段七范围组件已完成：

- Data-Form：`FormField/FormGroup/VirtualList/DataGrid/Tree/DateTime/CommandPalette`
- Workbench：`SplitPane/DockPanel/Inspector/PanelHeader/CardShell/ToolWindow`

下一阶段进入 System UX 与跨层集成闭环。
