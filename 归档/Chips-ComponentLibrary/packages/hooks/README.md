# @chips/hooks

React hooks and providers for Chips UI state, Host environment consumption, theme runtime and component binding.

`@chips/hooks` is a UI hooks layer. It does not implement or duplicate the Host runtime; Host capabilities must still come from an injected SDK client, `window.chips.*`, Bridge and kernel-routed services.

## APIs

Theme runtime:

- `ChipsTokenProvider`
- `ChipsThemeProvider`
- `useTokenResolver`
- `useToken`
- `useComponentTokens`
- `useThemeRuntime`
- `subscribeThemeChanged`
- `applyThemeVariables`
- `applyThemeVariablesInBatches`

Environment:

- `ChipsEnvironmentProvider`
- `useChipsEnvironment`
- `useChipsClient`
- `useChipsTheme`
- `useChipsI18n`
- `createChipsI18nText`
- `useChipsI18nText`
- `useChipsSurface`
- `useChipsPermission`
- `useChipsCommand`
- `useChipsDiagnostics`

State and binding:

- `createBinding`
- `useBinding`
- `useChipsBinding`
- `useChipsState`
- `useChipsAsyncState`
- `useChipsFormState`
- `useFieldBinding`

## Binding

`createBinding` returns a `ChipsBinding` object with `value`, `get`, `set`, `update`, `reset` and prop adapters:

- `valueProps()` -> `value / onValueChange`
- `checkedProps()` -> `checked / onCheckedChange`
- `openProps()` -> `open / onOpenChange`
- `inputProps()` -> native `value / onChange`
- `toProps()` -> custom control prop names

Components keep their standard controlled props. Do not add component-specific `binding` props.

```tsx
const title = useChipsState("Draft", { name: "title" });

<ChipsTextField label="Title" {...title.binding.valueProps()} />;
```

## Form state

`useChipsFormState` stores form values, errors, touched fields and derived `dirty / valid / submitted` state. It provides field bindings through `getFieldBinding(field)` and `useFieldBinding(form, field)`.

```tsx
const form = useChipsFormState({
  title: "Draft",
  enabled: false
});

<ChipsTextField {...form.getFieldBinding("title").valueProps()} />;
<ChipsSwitch {...form.getFieldBinding("enabled").checkedProps()} />;
```

Business validation, persistence and Host config writes remain in the application or SDK client layer.
