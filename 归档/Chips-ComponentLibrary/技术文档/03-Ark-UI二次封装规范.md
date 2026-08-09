# Ark-UI 二次封装规范

## 1. 封装目标

在 Ark UI 原语基础上提供稳定、可组合、可测试的薯片组件接口，统一行为语义并满足生态契约。

## 2. 封装层级

- Layer A：Ark 原语适配层（props 对齐、事件转译、ref 转发）
- Layer B：薯片语义组件层（标准状态、标准错误、标准数据属性）
- Layer C：场景组合层（工作台、编辑器、卡片场景组合件）

补充：`CardCoverFrame`、`CompositeCardWindow` 属于 iframe 高级组件，不直接依赖 Ark 交互原语，但必须遵循同一契约与状态模型。

## 3. 强制契约

每个可交互组件必须输出：

- `data-scope="<component>"`
- `data-part="root|..."`
- `data-state="idle|hover|focus|active|disabled|loading|error"`

所有状态切换必须同步反映到 `data-state` 与 ARIA 属性。

## 4. API 设计规范

- 禁止通过多个 boolean 组合控制多个模式
- 优先使用 `variant`、`size`、`intent` 等显式枚举
- 复杂组件采用 Compound Components（如 `Dialog.Root/Dialog.Trigger/Dialog.Content`）
- 所有回调采用显式命名：`onOpenChange`、`onValueChange`

## 5. 事件与错误

- 组件错误对象遵循标准结构：`{ code, message, details?, retryable? }`
- 异步交互组件必须支持 loading 与失败态
- 组件不吞异常，必须通过回调或边界组件暴露错误

## 6. 可访问性要求

- 键盘路径必须与鼠标路径等价
- 焦点可见（focus-visible）语义必须存在
- 读屏标签必须可用（`aria-label` / `aria-labelledby`）
- 复合组件必须维护正确的 role、aria-expanded、aria-controls 等关系

## 7. 代码模板

```tsx
export interface ChipsButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

export function ChipsButton(props: ChipsButtonProps) {
  const state = resolveButtonState(props);

  return (
    <button
      data-scope="button"
      data-part="root"
      data-state={state}
      aria-disabled={props.disabled || props.loading || undefined}
      onClick={props.disabled || props.loading ? undefined : props.onPress}
    >
      <span data-part="label">{props.children}</span>
    </button>
  );
}
```

## 8. 当前落地（2026-03-04）

已在 `packages/primitives` 落地 Ark 适配层与 Primitive 层关键能力：

- Layer A（适配层）
  - `mapArkPrimitiveProps`
  - `createPrimitiveComponent`
  - `createControlledValueAdapter`
- Layer B（标准 Primitive）
  - `Box/Inline/Stack/Grid`
  - `Text/Label/HelperText`
- 契约字段
  - 默认强制输出 `data-scope/data-part/data-state`
  - 统一支持 `onPress/onPrimitiveEvent` 事件签名
  - `disabled` 统一映射 `aria-disabled`
