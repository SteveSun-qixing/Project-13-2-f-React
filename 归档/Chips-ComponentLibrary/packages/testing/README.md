# @chips/testing

Testing helpers for component contract assertions, fixture builders, fallback-chain checks,
Provider-ready Chips environment mocks, and fault-injection scaffolding.

`@chips/testing` keeps component-library test ergonomics in one place. SDK/Bridge/Host action
semantics are owned by `chips-sdk/testing`; when a test needs formal Host simulator behavior,
prefer `chips-sdk/testing` directly. The mock client exported here keeps the same calls/state/events
shape for component hooks and Provider tests.

## Exports

- `assertHasContractAttrs(nodeAttrs)`
- `createComponentFixture(options)`
- `assertAriaRole(nodeAttrs, expectedRole)`
- `assertAriaRequiredProps(nodeAttrs, requiredProps)`
- `CHIPS_COMPONENT_QUALITY_MATRIX`
- `createComponentQualityMatrix(overrides)`
- `getComponentQualityMatrixEntry(component, matrix)`
- `assertComponentContractCoverage(contracts, matrix)`
- `assertContractAttrMatrixCoverage(contracts, matrix)`
- `assertA11yFixtureCoverage(contracts, matrix)`
- `assertComponentStatePriorityCoverage(contracts, matrix)`
- `createComponentMatrixReport(contracts, matrix, options)`
- `assertStatePriority(state, priorityList)`
- `createThemeFallbackFixture(overrides)`
- `resolveFallbackScopeValue(fixture, key)`
- `assertThemeFallbackChain(fixture, expectations)`
- `createKeyboardEventFixture(key, options)`
- `runKeyboardSequence(target, keys, options)`
- `assertRovingTabIndex(items, expectedActiveId)`
- `assertActiveDescendant(containerAttrs, expectedId)`
- `assertFocusRestored(history, expectedId)`
- `createFocusTrapFixture(ids)`
- `injectFault(type, payload)`
- `createMockSurfaceContext(overrides)`
- `createMockLaunchContext(overrides)`
- `createMockPermissionDeniedError(action, required, granted, options)`
- `createMockThemeDiagnosticSummary(overrides)`
- `createMockChipsHost(options)`
- `createMockChipsClient(options)`
- `createMockChipsEnvironment(options)`

## Usage

```js
import {
  createComponentFixture,
  assertHasContractAttrs,
  injectFault
} from "@chips/testing";

const fixture = createComponentFixture({
  scope: "button",
  part: "root",
  state: "focus",
  role: "button",
  ariaLabel: "save"
});

assertHasContractAttrs(fixture);

const fault = injectFault("config-source-exception", {
  key: "systemUx.toast.maxStack"
});
```

## Component Quality Matrix

`CHIPS_COMPONENT_QUALITY_MATRIX` is the reusable component matrix consumed by
`npm run quality:coverage`. It maps every public component contract to:

- contract attr fixture (`data-scope/data-part/data-state`)
- ARIA fixture and required rules
- state priority list
- perf smoke scenario names when the component owns a perf budget
- owning package (`@chips/components` or `@chips/card-runtime`)

New public components must be added to the matrix in the same change as their
contract, token and a11y tests. Otherwise `quality:coverage` fails with
`TEST_COMPONENT_MATRIX_DRIFT`.

## Mock Chips Environment

```js
import {
  createMockChipsClient,
  createMockChipsEnvironment,
  createMockPermissionDeniedError
} from "@chips/testing";

const client = createMockChipsClient({
  permissions: ["theme.read"],
  translations: {
    "demo.save": "保存"
  }
});

await client.theme.apply("chips-official.default-dark-theme");
await client.command.register({
  commandId: "chips.demo.save",
  titleKey: "demo.commands.save.title",
  handlerId: "save"
});

client.setPermissionDenied("control-plane.diagnose", "control.write", ["control.read"]);

const environmentProps = createMockChipsEnvironment({ client });
```

Notes:

- `client.calls` records Host-like action calls.
- `client.events` and domain `onChanged/onInvoked` helpers share the same local event bus.
- Permission faults should use `createMockPermissionDeniedError` or `client.setPermissionDenied(...)` so hook tests receive standard diagnostics.

## A11y Interaction Helpers

Use the keyboard and focus helpers with `@chips/a11y` when testing custom compound components. The formal interaction contract is published in `生态共用技术文档/组件库/11-焦点键盘与A11y交互模型.md`.
