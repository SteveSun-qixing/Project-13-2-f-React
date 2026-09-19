/**
 * 薯片 Design Tokens 的 CSS 变量契约（fork antd ↔ `@chips/ui` ↔ 帧运行时共用）。
 *
 * - 窗口主题根由 `ChipsThemeRoot` 安装，CSS 变量前缀固定为 `chips`，作用域类固定为 `css-var-chips`。
 * - 渲染帧的 `host:init.tokens` 载荷按同一命名规则注入 `--chips-*`；插件不得直接读取 `--*` 变量名。
 * - 命名算法与 antd 的 CSS 变量模式一致（camelCase → kebab-case、统一小写）；本文件是该规则的唯一实现。
 */

/** CSS 变量前缀：所有令牌变量形如 `--chips-<token-name>`。 */
export const CHIPS_CSS_VAR_PREFIX = 'chips';

/** CSS 变量作用域类：组件与主题根使用的类名，变量定义挂在 `.css-var-chips` 作用域下。 */
export const CHIPS_CSS_VAR_KEY = 'css-var-chips';

/**
 * 把 Design Token 名转换为薯片 CSS 变量名。
 *
 * @param tokenName antd 全局令牌名，如 `colorPrimary`、`fontSizeHeading1`
 * @returns CSS 变量名，如 `--chips-color-primary`、`--chips-font-size-heading-1`
 */
export function toChipsCssVarName(tokenName: string): string {
  return `--${CHIPS_CSS_VAR_PREFIX}-${tokenName}`
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z0-9]+)/g, '$1-$2')
    .replace(/([a-z])([A-Z0-9])/g, '$1-$2')
    .toLowerCase();
}
