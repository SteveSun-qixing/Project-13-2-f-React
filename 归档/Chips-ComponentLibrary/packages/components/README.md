# @chips/components

Chips L10 headless component layer. Components provide structure, state machines,
ARIA semantics, keyboard behavior, and stable `data-scope/data-part/data-state`
theme hooks. Visual skin, colors, radius, shadows, typography, and motion values
belong to theme packages through tokens and CSS variables.

## Contract Source

The canonical component list is generated from:

- `Chips-ComponentLibrary/packages/theme-contracts/contracts/components/*.contract.json`
- `Chips-ComponentLibrary/packages/testing/src/component-quality-matrix.js`
- `Chips-ComponentLibrary/reports/quality-gate/component-quality-coverage-latest.json`

The current first-version baseline has 71 component contracts and 71 matching
quality-matrix entries. Do not maintain a separate hand-written component list in
this README; update the contract files, matrix, tests, and public docs together.

## Public Docs

Use the ecosystem public documentation as the stable contract surface:

- `生态共用技术文档/组件库/00-组件库文档索引.md`
- `生态共用技术文档/组件库/02-组件契约标准.md`
- `生态共用技术文档/组件库/03-Token与主题对接标准.md`
- `生态共用技术文档/组件库/05-可访问性与质量基线.md`

## Command Consumers

Command consumer components render Host command views and invoke actions through
an injected adapter.

- Use `ChipsCommandProvider` to inject `createCommandAdapter(client)` and i18n.
- Use `ChipsToolbar / ChipsToolbarItem` for `toolbarPlacement`.
- Use `ChipsMenuBar / ChipsContextMenu` for `menuPlacement`.
- Use `ChipsCommandPalette` for palette search over command views.
- Use `ChipsShortcut` only to display accelerator text; Host still owns shortcut registration.

## Verification

- `npm run verify` covers token validation/build, theme-contract validation,
  type smoke tests, and the component test suite.
- `npm run quality:gate` is the release-blocking gate for lint, typecheck,
  tests, contract tests, a11y tests, perf smoke, quality coverage, and build.
