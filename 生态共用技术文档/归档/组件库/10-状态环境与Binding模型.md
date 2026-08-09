# 状态环境与 Binding 模型

> 文档状态：生态共用公开规范
> 修订日期：2026-05-24
> 适用范围：`@chips/hooks`、`@chips/component-library`、官方 React 应用插件、卡片插件、箱子布局插件

## 1. 定位

`@chips/hooks` 提供 React 技术栈下的 Chips State / Environment / Binding 公共入口。它的职责是降低应用、配置页、表单页和组件组合代码中的重复接线成本，让页面本地状态、异步状态、表单字段与组件受控 props 使用同一套可测试模型。

该模型只承载 UI hooks 和状态接线，不承载 Host runtime 主实现。Host 能力仍必须通过 SDK client、`window.chips.*`、Bridge 与内核路由访问；组件库不得直接 import Host 内部包，也不得复制 Host 服务实现。

## 2. 正式入口

`@chips/hooks` 与聚合入口 `@chips/component-library` 正式导出以下状态与绑定 API：

| API | 用途 |
|---|---|
| `createBinding(options)` | 创建可读写绑定对象，适配组件控制 props。 |
| `useBinding(options)` | 在 React 组件内创建或复用绑定。 |
| `useChipsBinding(options)` | `useBinding` 的 Chips 命名别名，推荐在生态应用代码中优先使用。 |
| `useChipsState(initialValue, options)` | 页面本地 UI 状态，返回 `value / setValue / update / reset / binding`。 |
| `useChipsAsyncState(action, options)` | 异步状态，统一 `idle / loading / success / error`。 |
| `useChipsFormState(initialValues, options)` | 表单值、错误、触达、dirty、valid 与字段绑定管理。 |
| `useFieldBinding(formState, field, options)` | 从表单状态或对象绑定中派生字段绑定。 |

既有环境入口继续作为 Host 环境读取与 SDK client 注入的正式入口：

- `ChipsEnvironmentProvider`
- `useChipsEnvironment`
- `useChipsClient`
- `useChipsTheme`
- `useChipsI18n`
- `useChipsSurface`
- `useChipsPermission`
- `useChipsCommand`
- `useChipsDiagnostics`

## 3. Binding 对象契约

`ChipsBinding<T>` 是读写真实状态源的统一对象：

- `kind` 固定为 `chips.binding`。
- `value` 与 `get()` 返回当前值。
- `set(nextValue, meta?)` 写入值，`nextValue` 可为值或 updater 函数。
- `update(updater, meta?)` 以 `reason="update"` 写入。
- `reset(nextValue?, meta?)` 以 `reason="reset"` 写入。
- `meta` 保存字段名、表单元信息或调用方传入的稳定上下文。
- `onChange` 事件必须包含 `previousValue / value / name / meta`，可额外带 `reason`。

绑定对象可以适配组件库现有受控 props：

| 方法 | 输出 props | 适用组件 |
|---|---|---|
| `valueProps()` | `value / onValueChange` | 输入、选择、分段、数值、日期时间等值控件 |
| `checkedProps()` | `checked / onCheckedChange` | `ChipsCheckbox`、`ChipsSwitch` |
| `openProps()` | `open / onOpenChange` | `ChipsDialog`、`ChipsPopover`、`ChipsSelect`、`ChipsComboBox` 等展开控件 |
| `inputProps()` | `value / onChange` | 原生 `input / textarea / select` |
| `toProps()` | 自定义 value/change prop 名 | 少量自定义组合场景 |

组件库不引入单独的私有 `binding` prop。组件仍以标准 React 受控 props 作为公开接口，Binding 层负责把状态源适配成这些 props。

## 4. 状态模型

`useChipsState` 用于页面本地 UI 状态，例如当前筛选、选中项、面板开合、草稿输入值。它返回的 `binding` 可直接交给控件：

```tsx
const title = useChipsState("Draft", { name: "title" });

<ChipsTextField label="Title" {...title.binding.valueProps()} />
```

`useChipsAsyncState` 用于加载、保存、刷新等异步动作。状态集合固定为：

- `idle`
- `loading`
- `success`
- `error`

示例：

```tsx
const saveState = useChipsAsyncState(async () => {
  await client.config.set("profile.title", title.value);
});

<ChipsButton loading={saveState.loading} onPress={() => void saveState.run()}>
  Save
</ChipsButton>
```

## 5. 表单模型

`useChipsFormState` 管理表单值和字段级元信息，不替代业务校验器，也不把业务规则写入组件库。正式职责如下：

- `values / setValues / reset`：表单值管理。
- `errors / setFieldError / clearFieldError`：字段错误挂载。
- `touched / setFieldTouched`：字段触达状态。
- `dirty / valid / submitted`：表单派生状态。
- `getFieldMeta(field)`：返回 `name / value / initialValue / error / touched / dirty / invalid`。
- `getFieldBinding(field)` 与 `field(field)`：生成字段级 `ChipsBinding`。

字段路径支持字符串、数字或路径数组。字符串路径按 `.` 分段，例如 `settings.enabled`。

示例：

```tsx
const form = useChipsFormState({
  title: "Draft",
  settings: {
    enabled: false
  }
});

<ChipsForm.Root>
  <ChipsForm.Field name="title" error={form.getFieldError("title")}>
    <ChipsForm.Label>Title</ChipsForm.Label>
    <ChipsTextField {...form.getFieldBinding("title").valueProps()} />
    <ChipsForm.Error />
  </ChipsForm.Field>

  <ChipsSwitch {...form.getFieldBinding("settings.enabled").checkedProps()} />
</ChipsForm.Root>
```

`ChipsForm` 仍只负责结构、语义、状态挂点和可访问性关联；业务校验、保存、权限判断、Host 配置读写由应用层或 SDK client 完成。

## 6. 组件受控规则

组件库正式采用以下控制模式：

- 值控件使用 `value / defaultValue / onValueChange`。
- 布尔选择控件使用 `checked / defaultChecked / onCheckedChange`。
- 展开类控件使用 `open / defaultOpen / onOpenChange`。
- 原生控件使用 `value / defaultValue / onChange`。

同一组件不得同时把业务状态写入内部状态和外部受控状态。传入受控 prop 时，以外部值为准；未传入受控 prop 时，可使用 `default*` 初始化内部状态。

## 7. 测试要求

涉及 State / Binding / Form 的改动至少覆盖：

- `createBinding` 对 `valueProps / checkedProps / openProps / inputProps` 的适配。
- `useChipsState` 的 set、updater、reset 与 binding 写入。
- `useChipsAsyncState` 的 loading、success、error 与 reset。
- `useChipsFormState` 的字段值、dirty、touched、error、valid 与 reset。
- TypeScript smoke 必须从 `@chips/component-library` 聚合入口消费相关类型与函数。

组件库正式验证命令：

```bash
cd Chips-ComponentLibrary
npm run verify
```
