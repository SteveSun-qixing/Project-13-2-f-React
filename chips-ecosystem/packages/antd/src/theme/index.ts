export { ChipsThemeRoot } from './ChipsThemeRoot';
export type { ChipsThemeRootProps } from './ChipsThemeRoot';
export { CHIPS_CSS_VAR_KEY, CHIPS_CSS_VAR_PREFIX, toChipsCssVarName } from './css-vars';
export {
  CHIPS_THEME_COMPONENT_ALLOWLIST,
  CHIPS_THEME_CONFIG_KEYS,
  ChipsThemeConfigError,
  validateChipsThemeConfig,
} from './theme-policy';
export type { ChipsThemeComponent } from './theme-policy';

/** antd 主题命名空间：业务侧只允许使用 `theme.useToken()`（经 `@chips/ui` 转发）。 */
export { theme } from 'antd';
export type { GlobalToken, MappingAlgorithm, ThemeConfig } from 'antd';
