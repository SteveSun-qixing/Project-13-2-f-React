# @chips/theme-contracts

Component contract definitions and diagnostics helpers for theme validation.

## Public Schema

Theme contract diagnostics use the same schema as Host `theme.resolve`,
SDK `ThemeDiagnostic`, theme-pack validators, and the settings panel.

- `ThemeContractView`: `schemaVersion`, `themeId`, `themeVersion`, `contractVersion`, `components[]`, `summary`
- Component view: `component`, `scope`, `parts`, `states`, `requiredTokens`, `optionalTokens`, `a11yConstraints`, `motionConstraints`, `coverage`, `diagnostics`
- `ThemeDiagnostic`: `severity`, `code`, `messageKey`, `themeId`, `sourceThemeId`, `component`, `part`, `state`, `tokenKey`, `layer`, `scope`, `suggestionKey`, `details`, `blocking`
- Diagnostic summary: totals by severity and code, blocking count, status, and token coverage

Legacy component contracts may still use `tokens`; the validator normalizes
that field to `requiredTokens` in the public component view.

Only `card-cover-frame` and `composite-card-window` may declare the iframe
contract extension.

## Exports

- `buildThemeContractView(contract, tokenTree, options)`
- `buildComponentContractView(contract, flatTokenMap, options)`
- `loadComponentContracts(contractDir?)`
- `buildThemeInterfaceContract(componentContracts, options?)`
- `buildThemeMinFunctionalSet(componentContracts, options?)`
- `compareThemeInterfaceContract(themeContract, componentContracts)`
- `compareThemeMinFunctionalSet(minFunctionalSet, componentContracts)`
- `buildThemeDiagnosticSummary(diagnostics, coverageSummary)`
- `validateComponentContract(contract, flatTokenMap)`
- `validateContractDirectory(contractDir, tokenTree)`
- `flattenTokens(tokenTree)`

Official ThemePack contract files are generated release artifacts. Their
source of truth is always `contracts/components/*.contract.json`; theme packs
must not hand-maintain a parallel component or token whitelist.

## Current Contracts

- `box.contract.json`
- `button.contract.json`
- `card-cover-frame.contract.json`
- `card-shell.contract.json`
- `checkbox.contract.json`
- `command-palette.contract.json`
- `composite-card-window.contract.json`
- `context-menu.contract.json`
- `data-grid.contract.json`
- `date-time.contract.json`
- `dialog.contract.json`
- `divider.contract.json`
- `dock-panel.contract.json`
- `empty-state.contract.json`
- `error-boundary.contract.json`
- `form.contract.json`
- `grid.contract.json`
- `inline.contract.json`
- `input.contract.json`
- `inspector.contract.json`
- `loading-boundary.contract.json`
- `menu-bar.contract.json`
- `menu.contract.json`
- `navigation-split-view.contract.json`
- `notification.contract.json`
- `panel-header.contract.json`
- `popover.contract.json`
- `radio.contract.json`
- `scroll-view.contract.json`
- `section.contract.json`
- `select.contract.json`
- `shortcut.contract.json`
- `skeleton.contract.json`
- `spacer.contract.json`
- `split-pane.contract.json`
- `split-view.contract.json`
- `stack.contract.json`
- `switch.contract.json`
- `tabs.contract.json`
- `toast.contract.json`
- `tool-window.contract.json`
- `toolbar.contract.json`
- `tooltip.contract.json`
- `tree.contract.json`
- `view.contract.json`
- `virtual-list.contract.json`
