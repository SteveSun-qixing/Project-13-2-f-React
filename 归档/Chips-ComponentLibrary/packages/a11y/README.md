# @chips/a11y

Accessibility, focus, and keyboard helper functions for Chips L10 headless components.

## APIs

- keyboard:
  - `normalizeKeyboardKey`
  - `createKeyboardMap`
  - `getKeyboardAction`
  - `isKeyboardActivationKey`
  - `isKeyboardNavigationKey`
  - `getKeyboardIntent`
- aria:
  - `createAriaStatusProps`
  - `buildAriaDescribedBy`
  - `validateAriaProps`
  - `assertAriaProps`
- focus:
  - `isFocusableElement`
  - `isTabbableElement`
  - `getFocusableElements`
  - `moveFocus`
  - `createFocusRestorePoint`
  - `restoreFocus`
  - `getFocusTrapTarget`
  - `trapFocus`
  - `createFocusScope`
- roving tabindex:
  - `createRovingTabIndex`
  - `getRovingIndexByKey`
  - `getRovingTabIndexProps`

The formal ecosystem contract is published in `生态共用技术文档/组件库/11-焦点键盘与A11y交互模型.md`.
