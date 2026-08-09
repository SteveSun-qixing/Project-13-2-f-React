# Base-Interactive P0 第一批组件规范

## 1. 范围

本规范覆盖阶段六第一批已落地组件：

- `ChipsButton`
- `ChipsInput`
- `ChipsCheckbox`

目标：提供可直接接入的高质量交互组件能力，满足契约、状态、a11y、token 映射和测试基线。

## 2. 统一状态模型

三组件统一遵循标准状态优先级：

`disabled > loading > error > active > focus > hover > idle`

解析函数：`resolveInteractiveState(params)`  
交互状态机：`interactiveStateReducer(state, event)`

## 3. 契约与 part 清单

### 3.1 ChipsButton

- `data-scope="button"`
- `data-part="root|label|spinner|status"`

### 3.2 ChipsInput

- `data-scope="input"`
- `data-part="root|control|status"`

### 3.3 ChipsCheckbox

- `data-scope="checkbox"`
- `data-part="root|control|indicator|label|status"`

## 4. API 摘要

### 4.1 ChipsButton

- 支持状态：`disabled/loading/error`
- 支持切换按钮模式：`toggleable + pressed/defaultPressed + onPressedChange`
- 事件：`onPress`、`onStateChange`

### 4.2 ChipsInput

- 受控：`value + onValueChange`
- 非受控：`defaultValue`
- 事件：`onEnterPress`、`onStateChange`
- 语义：错误态输出 `aria-invalid`

### 4.3 ChipsCheckbox

- 受控：`checked + onCheckedChange`
- 非受控：`defaultChecked`
- 状态：`disabled/loading/error`
- 语义：错误态输出 `aria-invalid`

## 5. A11y 规范

- Button 键盘激活：`Enter/Space`
- Input 错误提示使用 `role="status"` + `aria-live="assertive"`
- Checkbox 结构遵循 `label + input[type=checkbox]` 组合语义
- 状态提示统一使用 `createAriaStatusProps`

## 6. Token 映射

组件 token 映射定义在 `COMPONENT_TOKEN_MAP`：

- `chips.comp.button.*`
- `chips.comp.input.*`
- `chips.comp.checkbox.*`

并同步写入：

- `packages/tokens/tokens/comp/button.json`
- `packages/tokens/tokens/comp/input.json`
- `packages/tokens/tokens/comp/checkbox.json`

## 7. 合同文件

对应主题契约文件：

- `packages/theme-contracts/contracts/components/button.contract.json`
- `packages/theme-contracts/contracts/components/input.contract.json`
- `packages/theme-contracts/contracts/components/checkbox.contract.json`

## 8. 错误码

- `COMPONENT_META_INVALID:*`
- `COMPONENT_CONTRACT_INVALID:*`
- `COMPONENT_CONTRACT_TOKEN_MAP_MISSING:*`
- `COMPONENT_A11Y_RULE_MISSING:*`

## 9. 测试要求与结果

- 每组件与基础状态模型测试均已覆盖。
- 组件包测试、token 校验、主题契约校验均纳入 `npm run verify`。
- 当前仓库验证结果：通过。

## 10. 后续范围（阶段六剩余）

待继续落地组件：

- `Select`
- `Radio`
- `Switch`
- `Dialog`
- `Popover`
- `Tabs`
- `Menu`
- `Tooltip`
