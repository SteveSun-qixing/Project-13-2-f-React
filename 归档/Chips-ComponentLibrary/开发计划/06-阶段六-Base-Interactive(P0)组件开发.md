# 阶段六：Base-Interactive (P0) 组件开发

## 阶段目标

完成P0交互组件的完整实现，确保交互行为、状态机、契约输出、可访问性与主题能力全部闭环。

## 组件范围

- Button
- Input
- Select
- Checkbox
- Radio
- Switch
- Dialog
- Popover
- Tabs
- Menu
- Tooltip

## 开发任务

### 1. 组件实现

- 每个组件提供受控与非受控模式。
- 每个组件实现标准状态集合与优先级裁决。
- 每个组件输出完整`data-scope/data-part/data-state`。

### 2. 主题接入

- 每个组件建立token映射表。
- 组件状态与token键建立一一映射。
- 主题切换后状态视觉可正确反映。

### 3. 可访问性

- 键盘路径全覆盖。
- role/aria关系正确。
- 弹层类组件支持焦点陷阱与Esc关闭。

### 4. 组件文档

- API文档。
- 结构契约文档。
- 状态迁移文档。
- 错误码文档。

## 阶段产物

- P0组件代码与文档。
- 每组件最少5个单测。
- 组件契约测试与a11y测试。

## 退出条件

- P0组件全部可用于业务接入。
- 组件行为在主题切换与语言切换场景稳定。

## 执行进展（2026-03-04）

已完成（第一批）：

- `Button/Input/Checkbox` 已落地：
  - 统一状态优先级裁决
  - 受控/非受控接口（Input/Checkbox）
  - 结构契约 `data-scope/data-part/data-state`
  - a11y 语义与错误提示
- 组件 token 映射与主题契约已落地：
  - `chips.comp.button.*`
  - `chips.comp.input.*`
  - `chips.comp.checkbox.*`
- 测试已补齐并通过，`npm run verify` 全量通过。

已完成（第二批）：

- `Radio/Switch/Select` 已落地：
  - 统一状态优先级裁决
  - 受控/非受控接口
  - 结构契约 `data-scope/data-part/data-state`
  - role/aria 语义与错误提示
- 组件 token 映射与主题契约已落地：
  - `chips.comp.radio.*`
  - `chips.comp.switch.*`
  - `chips.comp.select.*`
- 测试与校验已通过，`npm run verify` 全量通过。

已完成（第三批）：

- `Dialog/Popover/Tabs/Menu/Tooltip` 已落地：
  - 统一状态优先级裁决
  - 受控/非受控接口
  - 结构契约 `data-scope/data-part/data-state`
  - role/aria 语义与键盘交互路径
- 组件 token 映射与主题契约已落地：
  - `chips.comp.dialog.*`
  - `chips.comp.popover.*`
  - `chips.comp.tabs.*`
  - `chips.comp.menu.*`
  - `chips.comp.tooltip.*`
- 测试与校验已通过，`npm run verify` 全量通过（75 tests）。

阶段结论：

- 阶段六 P0 Base-Interactive 组件开发已完整闭环，进入阶段七。
