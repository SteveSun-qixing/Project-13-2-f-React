# Base-Interactive P0 第三批组件规范

## 1. 范围

本规范覆盖阶段六第三批已落地组件：

- `ChipsDialog`
- `ChipsPopover`
- `ChipsTabs`
- `ChipsMenu`
- `ChipsTooltip`

## 2. 统一状态与契约

第三批组件统一继承状态优先级：

`disabled > loading > error > active > focus > hover > idle`

并强制输出 `data-scope/data-part/data-state`。

## 3. 组件规范

### 3.1 ChipsDialog

- `data-scope="dialog"`
- `data-part="root|trigger|backdrop|content|title|description|close|status"`
- 语义：
  - trigger：`role="button"` + `aria-haspopup="dialog"`
  - content：`role="dialog"` + `aria-modal`
- 支持受控与非受控：
  - `open + onOpenChange`
  - `defaultOpen`

### 3.2 ChipsPopover

- `data-scope="popover"`
- `data-part="root|trigger|positioner|content|arrow|status"`
- 语义：
  - trigger：`role="button"` + `aria-expanded`
  - content：`role="dialog"`（非模态）
- 支持受控与非受控：
  - `open + onOpenChange`
  - `defaultOpen`

### 3.3 ChipsTabs

- `data-scope="tabs"`
- `data-part="root|list|trigger|panel|status"`
- 语义：
  - list：`role="tablist"`
  - trigger：`role="tab"` + `aria-controls`
  - panel：`role="tabpanel"` + `aria-labelledby`
- 支持受控与非受控：
  - `value + onValueChange`
  - `defaultValue`
- 键盘路径：`Arrow/Home/End/Enter/Space`

### 3.4 ChipsMenu

- `data-scope="menu"`
- `data-part="root|trigger|content|item|status"`
- 语义：
  - trigger：`role="button"` + `aria-haspopup="menu"`
  - content：`role="menu"`
  - item：`role="menuitem"`
- 支持受控与非受控：
  - `open + onOpenChange`
  - `defaultOpen`
- 键盘路径：`ArrowUp/ArrowDown/Home/End/Escape/Enter/Space`

### 3.5 ChipsTooltip

- `data-scope="tooltip"`
- `data-part="root|trigger|content|arrow|status"`
- 语义：
  - content：`role="tooltip"`
  - trigger：`aria-describedby`
- 支持受控与非受控：
  - `open + onOpenChange`
  - `defaultOpen`

## 4. Token 映射

新增组件 token：

- `chips.comp.dialog.*`
- `chips.comp.popover.*`
- `chips.comp.tabs.*`
- `chips.comp.menu.*`
- `chips.comp.tooltip.*`

对应源文件：

- `packages/tokens/tokens/comp/dialog.json`
- `packages/tokens/tokens/comp/popover.json`
- `packages/tokens/tokens/comp/tabs.json`
- `packages/tokens/tokens/comp/menu.json`
- `packages/tokens/tokens/comp/tooltip.json`

## 5. 主题契约

对应契约：

- `packages/theme-contracts/contracts/components/dialog.contract.json`
- `packages/theme-contracts/contracts/components/popover.contract.json`
- `packages/theme-contracts/contracts/components/tabs.contract.json`
- `packages/theme-contracts/contracts/components/menu.contract.json`
- `packages/theme-contracts/contracts/components/tooltip.contract.json`

## 6. 验证结果（2026-03-04）

- token 校验通过（95 keys）
- 主题契约校验通过（13 contracts）
- 组件测试通过
- `npm run verify` 全量通过（75 tests）

## 7. 阶段六结论

阶段六 P0 Base-Interactive 组件已全部完成：

- 第一批：`Button/Input/Checkbox`
- 第二批：`Radio/Switch/Select`
- 第三批：`Dialog/Popover/Tabs/Menu/Tooltip`

后续进入阶段七（Data-Form 与 Workbench 组件开发）。
