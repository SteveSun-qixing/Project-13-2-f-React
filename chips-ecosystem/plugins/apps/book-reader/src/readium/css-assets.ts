/**
 * ReadiumCSS 资产装载（`assets/readium/ReadiumCSS/`，BSD-3 许可随包，来源登记见包 README）：
 *
 * - 样式文本经 Vite `?raw` 编译期内联，构建产物自包含，不做运行时 `fetch`；
 * - 字体为二进制资产，随包发布在 `assets/readium/ReadiumCSS/fonts/`，运行时以
 *   渲染入口模块自身的 `import.meta.url`（宿主侧为 `chips-resource://<插件作用域>/render.js`）
 *   为基准解析绝对资源 URL，供帧内 iframe 文档跨文档取用。
 */

import cjkHorizontalAfterCss from '../../assets/readium/ReadiumCSS/cjk-horizontal/ReadiumCSS-after.css?raw';
import cjkHorizontalBeforeCss from '../../assets/readium/ReadiumCSS/cjk-horizontal/ReadiumCSS-before.css?raw';
import cjkHorizontalDefaultCss from '../../assets/readium/ReadiumCSS/cjk-horizontal/ReadiumCSS-default.css?raw';
import cjkVerticalAfterCss from '../../assets/readium/ReadiumCSS/cjk-vertical/ReadiumCSS-after.css?raw';
import cjkVerticalBeforeCss from '../../assets/readium/ReadiumCSS/cjk-vertical/ReadiumCSS-before.css?raw';
import cjkVerticalDefaultCss from '../../assets/readium/ReadiumCSS/cjk-vertical/ReadiumCSS-default.css?raw';
import rtlAfterCss from '../../assets/readium/ReadiumCSS/rtl/ReadiumCSS-after.css?raw';
import rtlBeforeCss from '../../assets/readium/ReadiumCSS/rtl/ReadiumCSS-before.css?raw';
import rtlDefaultCss from '../../assets/readium/ReadiumCSS/rtl/ReadiumCSS-default.css?raw';
import defaultAfterCss from '../../assets/readium/ReadiumCSS/ReadiumCSS-after.css?raw';
import defaultBeforeCss from '../../assets/readium/ReadiumCSS/ReadiumCSS-before.css?raw';
import defaultDefaultCss from '../../assets/readium/ReadiumCSS/ReadiumCSS-default.css?raw';
import type { ReadiumProfile, ReadiumStyleMod } from '../engine/types';

/** ReadiumCSS 各 profile 样式层文本（编译期内联）。 */
export const READIUM_CSS_TEXTS: Readonly<
  Record<ReadiumProfile, Readonly<Record<ReadiumStyleMod, string>>>
> = {
  default: {
    before: defaultBeforeCss,
    default: defaultDefaultCss,
    after: defaultAfterCss,
  },
  rtl: {
    before: rtlBeforeCss,
    default: rtlDefaultCss,
    after: rtlAfterCss,
  },
  'cjk-horizontal': {
    before: cjkHorizontalBeforeCss,
    default: cjkHorizontalDefaultCss,
    after: cjkHorizontalAfterCss,
  },
  'cjk-vertical': {
    before: cjkVerticalBeforeCss,
    default: cjkVerticalDefaultCss,
    after: cjkVerticalAfterCss,
  },
};

/** ReadiumCSS 样式内引用的字体相对路径（CSS 内写作 `fonts/<文件名>`）。 */
export const READIUM_FONT_PATHS = [
  'fonts/AccessibleDfA.otf',
  'fonts/AccessibleDfA-Regular.woff2',
  'fonts/AccessibleDfA-Regular.woff',
  'fonts/AccessibleDfA-Bold.woff2',
  'fonts/AccessibleDfA-Italic.woff2',
  'fonts/iAWriterDuospace-Regular.ttf',
] as const;

/**
 * 解析字体资产的绝对运行时 URL。
 *
 * 以渲染入口模块自身的模块 URL 为基准拼接包内相对路径（`assets/readium/ReadiumCSS/<相对路径>`）；
 * 基准经模块级常量中转（保持 `new URL` 第二参数为变量），构建器不做静态资产改写，
 * URL 在宿主运行时按 `chips-resource://<插件作用域>/render.js` 解析。
 */
const MODULE_BASE_URL: string = import.meta.url;

export function resolveReadiumAssetUrl(relativePath: string): string {
  return new URL(`assets/readium/ReadiumCSS/${relativePath}`, MODULE_BASE_URL).href;
}

/** 字体相对路径 → 绝对运行时 URL 映射（`rewriteFontUrls` 消费）。 */
export function buildReadiumFontUrlMap(): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const fontPath of READIUM_FONT_PATHS) {
    map[fontPath] = resolveReadiumAssetUrl(fontPath);
  }
  return map;
}
