/**
 * fork antd 转发：唯一基础组件库的组件白名单、配套图标集、`theme` 与 CSS 变量契约。
 *
 * 依据：《08-@chips-ui共享层使用指南》§2.5、§2.6——业务代码的组件、`theme`、`App` 与图标
 * 一律从 `@chips/ui` 导入；fork 的 CSS 变量命名契约（`CHIPS_CSS_VAR_*` / `toChipsCssVarName`）
 * 是渲染帧令牌注入与平台壳样式挂接的唯一可达路径（`@chips/antd` 仅 `packages/ui` 可用）。
 * 使用限制不变：`theme` 只用 `theme.useToken()`，`App` 只用 `App.useApp()`，业务代码不得
 * 使用主题算法、自建主题根或覆盖生态主题。
 */

export * from '@chips/antd';
