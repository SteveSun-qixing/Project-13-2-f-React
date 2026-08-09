# Base-Interactive P0 第二批组件规范

## 1. 范围

本规范覆盖阶段六第二批已落地组件：

- `ChipsRadioGroup`
- `ChipsSwitch`
- `ChipsSelect`

## 2. 统一状态与契约

三组件继承统一状态优先级：

`disabled > loading > error > active > focus > hover > idle`

并强制输出 `data-scope/data-part/data-state`。

## 3. 组件规范

### 3.1 ChipsRadioGroup

- `data-scope="radio"`
- `data-part="root|item|control|indicator|label|status"`
- 支持受控与非受控值：
  - `value + onValueChange`
  - `defaultValue`

### 3.2 ChipsSwitch

- `data-scope="switch"`
- `data-part="root|track|thumb|label|status"`
- 语义：
  - `role="switch"`
  - `aria-checked`
- 支持受控与非受控：
  - `checked + onCheckedChange`
  - `defaultChecked`

### 3.3 ChipsSelect

- `data-scope="select"`
- `data-part="root|trigger|value|icon|content|option|status"`
- 语义：
  - trigger：`role="button"` + `aria-haspopup="listbox"`
  - content：`role="listbox"`，默认 `data-placement="bottom-start"`
  - option：`role="option"` + `aria-selected`
- 展开结构：
  - `Content` 是锚定 `Root/Trigger` 下方的非文档流浮层，不参与调用页面布局计算
  - 通过 `gutter / minInlineSize / maxBlockSize` 或对应 CSS 变量控制间距、宽度和滚动边界
- 支持受控与非受控：
  - `value/defaultValue`
  - `open/defaultOpen`

## 4. Token 映射

新增组件 token：

- `chips.comp.radio.*`
- `chips.comp.switch.*`
- `chips.comp.select.*`

对应源文件：

- `packages/tokens/tokens/comp/radio.json`
- `packages/tokens/tokens/comp/switch.json`
- `packages/tokens/tokens/comp/select.json`

## 5. 主题契约

对应契约：

- `packages/theme-contracts/contracts/components/radio.contract.json`
- `packages/theme-contracts/contracts/components/switch.contract.json`
- `packages/theme-contracts/contracts/components/select.contract.json`

## 6. 验证结果

- token 校验通过
- 主题契约校验通过
- 组件测试通过
- `npm run verify` 全量通过

## 7. 阶段六后续

第三批组件规范见：

- `18-Base-Interactive-P0第三批组件规范.md`
