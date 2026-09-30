/**
 * 内置字体源与码位表（旧 Chip-iconMaker/src/icon-workbench/default-fonts.ts 迁移）。
 *
 * 相对旧面的登记适配（W5 迁移日志）：
 * 1. 码位表资产 URL 改为自包根解析（渲染入口 render.js 位于包根），并以非字面量构造，
 *    避免构建期把包内资产改名复制（正式资产路径以 `assets/fonts/...` 单一来源收口）；
 * 2. 新增 `registerMaterialSymbolsFontFaces`：旧面在 app-shell.css 以 @font-face 声明三套
 *    字体（硬编码 CSS 已禁），改为窗口挂载时经 FontFace API 注册同一组包内 woff2；
 * 3. 精选字形表、Emoji 码位区间、私用区字形与码位表解析逻辑逐字迁移。
 */

import type { IconFontSource, IconGlyph } from './types';

const MATERIAL_SYMBOLS: Array<[string, string]> = [
  ['home', 'e88a'],
  ['search', 'e8b6'],
  ['settings', 'e8b8'],
  ['favorite', 'e87d'],
  ['star', 'e838'],
  ['add', 'e145'],
  ['check', 'e5ca'],
  ['close', 'e5cd'],
  ['menu', 'e5d2'],
  ['download', 'f090'],
  ['upload', 'f09b'],
  ['image', 'e3f4'],
  ['palette', 'e40a'],
  ['bolt', 'e0b7'],
  ['rocket', 'eb9b'],
  ['folder', 'e2c7'],
  ['lock', 'e897'],
  ['key', 'e73c'],
  ['mail', 'e158'],
  ['calendar', 'e935'],
  ['play', 'e037'],
  ['pause', 'e034'],
  ['volume', 'e050'],
  ['wifi', 'e63e'],
  ['cloud', 'e2bd'],
  ['code', 'e86f'],
  ['terminal', 'eb8e'],
  ['brush', 'e3ae'],
  ['camera', 'e3af'],
  ['map', 'e55b'],
  ['public', 'e80b'],
  ['shield', 'e9e0'],
  ['tune', 'e429'],
  ['widgets', 'e1bd'],
  ['extension', 'e87b'],
  ['auto_awesome', 'e65f'],
] as const;

/** 包内 Material Symbols 码位表资产路径（自包根解析；渲染入口 render.js 位于包根）。 */
const CODEPOINTS_ASSET_PATH =
  'assets/fonts/material-symbols/variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].codepoints';

/** 三套 Material Symbols 可变字体的包内 woff2 资产与注册族名（与 FONT_FAMILIES 一一对应）。 */
const MATERIAL_SYMBOLS_FONT_ASSETS: ReadonlyArray<readonly [string, string]> = [
  ['Material Symbols Outlined', 'MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2'],
  ['Material Symbols Rounded', 'MaterialSymbolsRounded[FILL,GRAD,opsz,wght].woff2'],
  ['Material Symbols Sharp', 'MaterialSymbolsSharp[FILL,GRAD,opsz,wght].woff2'],
];

const EMOJI_RANGES: Array<[number, number]> = [
  [0x2600, 0x27bf],
  [0x1f000, 0x1f02f],
  [0x1f0a0, 0x1f0ff],
  [0x1f100, 0x1f1ff],
  [0x1f200, 0x1f2ff],
  [0x1f300, 0x1f5ff],
  [0x1f600, 0x1f64f],
  [0x1f680, 0x1f6ff],
  [0x1f700, 0x1f77f],
  [0x1f780, 0x1f7ff],
  [0x1f800, 0x1f8ff],
  [0x1f900, 0x1f9ff],
  [0x1fa70, 0x1faff],
] as const;

const EMOJI_PATTERN = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

export function createPrivateUseGlyphs(count = 60): IconGlyph[] {
  return Array.from({ length: count }, (_, index) => {
    const codepointValue = 0xe000 + index;
    const codepoint = codepointValue.toString(16).toUpperCase().padStart(4, '0');
    return {
      id: `custom-${codepoint}`,
      label: `U+${codepoint}`,
      display: String.fromCodePoint(codepointValue),
      codepoint: `U+${codepoint}`,
    };
  });
}

function createMaterialGlyphs(): IconGlyph[] {
  return MATERIAL_SYMBOLS.map(([label, codepoint]) => ({
    id: `material-${label}`,
    label,
    display: String.fromCodePoint(Number.parseInt(codepoint, 16)),
    codepoint: `U+${codepoint.toUpperCase()}`,
  }));
}

export function parseMaterialSymbolsCodepoints(source: string): IconGlyph[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): IconGlyph | null => {
      const [label, codepoint] = line.split(/\s+/);
      if (label === undefined || label.length === 0 || codepoint === undefined) {
        return null;
      }
      const codepointValue = Number.parseInt(codepoint, 16);
      if (!Number.isFinite(codepointValue)) {
        return null;
      }
      return {
        id: `material-${label}`,
        label,
        display: String.fromCodePoint(codepointValue),
        codepoint: `U+${codepoint.toUpperCase()}`,
      } satisfies IconGlyph;
    })
    .filter((glyph): glyph is IconGlyph => glyph !== null);
}

/** 码位表资产 URL：以模块 URL 所在目录为基（渲染入口位于包根），非字面量构造避免构建期资产复制。 */
function resolveCodepointsUrl(): string {
  return new URL(CODEPOINTS_ASSET_PATH, new URL(/* @vite-ignore */ '.', import.meta.url)).href;
}

export async function loadMaterialSymbolsFontSource(): Promise<IconFontSource> {
  const response = await fetch(resolveCodepointsUrl());
  if (!response.ok) {
    throw new Error('MATERIAL_SYMBOLS_CODEPOINTS_UNAVAILABLE');
  }
  const glyphs = parseMaterialSymbolsCodepoints(await response.text());
  if (glyphs.length === 0) {
    throw new Error('MATERIAL_SYMBOLS_CODEPOINTS_EMPTY');
  }
  return {
    ...MATERIAL_SYMBOLS_FONT_SOURCE,
    glyphs,
  };
}

/**
 * 把包内三套 Material Symbols woff2 注册进窗口字体集（替代旧面 app-shell.css @font-face）。
 *
 * 注册失败的族名跳过并逐条记入返回值；调用方据此决定是否提示字体渲染兜底。
 * 返回值 `registered` / `failed` 均为族名列表，便于界面诚实呈现加载结果。
 */
export async function registerMaterialSymbolsFontFaces(): Promise<{
  registered: string[];
  failed: string[];
}> {
  const registered: string[] = [];
  const failed: string[] = [];

  for (const [family, asset] of MATERIAL_SYMBOLS_FONT_ASSETS) {
    const assetUrl = new URL(
      `assets/fonts/material-symbols/variablefont/${asset}`,
      new URL(/* @vite-ignore */ '.', import.meta.url),
    ).href;
    try {
      const face = new FontFace(family, `url(${assetUrl})`);
      await face.load();
      document.fonts.add(face);
      registered.push(family);
    } catch {
      failed.push(family);
    }
  }

  return { registered, failed };
}

function createEmojiGlyphs(): IconGlyph[] {
  const glyphs: IconGlyph[] = [];
  for (const [start, end] of EMOJI_RANGES) {
    for (let codepointValue = start; codepointValue <= end; codepointValue += 1) {
      const display = String.fromCodePoint(codepointValue);
      if (!EMOJI_PATTERN.test(display)) {
        continue;
      }
      const codepoint = codepointValue.toString(16).toUpperCase();
      glyphs.push({
        id: `emoji-${codepoint}`,
        label: `U+${codepoint}`,
        display,
        codepoint: `U+${codepoint}`,
      });
    }
  }
  return glyphs;
}

export const MATERIAL_SYMBOLS_FONT_SOURCE: IconFontSource = {
  id: 'material-symbols',
  kind: 'material',
  name: 'Material Symbols',
  family: "'Material Symbols Rounded', 'Material Symbols Outlined', 'Material Symbols Sharp'",
  glyphs: createMaterialGlyphs(),
};

export const EMOJI_FONT_SOURCE: IconFontSource = {
  id: 'emoji',
  kind: 'emoji',
  name: 'Emoji',
  family: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
  glyphs: createEmojiGlyphs(),
};
