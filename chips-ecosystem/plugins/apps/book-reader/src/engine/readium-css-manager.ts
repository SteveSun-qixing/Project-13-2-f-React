import type {
  DocumentDirectionality,
  EngineOptions,
  ReadiumProfile,
  ReadiumStyleMod,
  ResponsiveLayout,
} from './types';

import { isStyleElementNode } from '../core/dom';
import {
  DEFAULT_LETTER_SPACING,
  DEFAULT_LINE_HEIGHT,
  READER_FONT_FAMILY_STACKS,
} from '../core/book-model';
import { READIUM_CSS_TEXTS, buildReadiumFontUrlMap } from '../readium/css-assets';

interface ReadiumCssSettings {
  paged: boolean;
  colCount?: ('auto' | '1' | '2') | undefined;
  textAlign?: ('left' | 'right' | 'justify' | 'start') | undefined;
  lineHeight?: string | undefined;
  letterSpacing?: string | undefined;
  wordSpacing?: string | undefined;
  pageMargins?: string | undefined;
  paraIndent?: string | undefined;
  paraSpacing?: string | undefined;
  bodyHyphens?: ('auto' | 'none') | undefined;
  backgroundColor?: string | undefined;
  textColor?: string | undefined;
  selectionBackgroundColor?: string | undefined;
  selectionTextColor?: string | undefined;
  linkColor?: string | undefined;
  linkVisitedColor?: string | undefined;
  font?: string | undefined;
  fontSize?: string | undefined;
  typeScale?: string | undefined;
  noFootnotes?: boolean | undefined;
  noTemporaryNavTargetOutline?: boolean | undefined;
  noRuby?: boolean | undefined;
  reduceMotion?: boolean | undefined;
}

const CLASS_PAGINATED = 'r2-css-paginated';
const CLASS_VWM = 'r2-class-VWM';
const ROOT_CLASS_NO_FOOTNOTES = 'r2-no-popup-foonotes';
const ROOT_CLASS_NO_RUBY = 'r2-no-ruby';
const ROOT_CLASS_REDUCE_MOTION = 'r2-reduce-motion';
const DISABLE_TEMPORARY_NAV_TARGET_OUTLINE_CLASS = 'r2-no-link-target-temp-highlight';
const FOOTNOTE_FORCE_SHOW = 'r2-footnote-force-show';

const VERTICAL_CONTENT_WIDTH_LIMIT_PX = 560;

const BEFORE_STYLE_ID = 'book-reader-readium-before';
const DEFAULT_STYLE_ID = 'book-reader-readium-default';
const AFTER_STYLE_ID = 'book-reader-readium-after';
const PATCH_STYLE_ID = 'book-reader-readium-patch';
const SUPPLEMENTAL_STYLE_ID = 'book-reader-supplemental';

const READIUM_PATCH_CSS = `
@namespace epub "http://www.idpf.org/2007/ops";

div[epub|type~="pagebreak"]:empty,
div[role~="doc-pagebreak"]:empty {
  line-height: 0 !important;
}

*[epub|type~="pagebreak"]:empty::before,
*[role~="doc-pagebreak"]:empty::before {
  display: contents;
  content: "\\feff";
}

:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="footnote"]:not(.${FOOTNOTE_FORCE_SHOW}),
:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="note"]:not(.${FOOTNOTE_FORCE_SHOW}),
:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="endnote"]:not(.${FOOTNOTE_FORCE_SHOW}),
:root:not(.${ROOT_CLASS_NO_FOOTNOTES}) aside[epub|type~="rearnote"]:not(.${FOOTNOTE_FORCE_SHOW}) {
  display: none;
}

audio[controls] {
  width: revert !important;
  height: revert !important;
}

:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h1,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h2,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h3,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h4,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h5,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) h6,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) p,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) li,
:root[style*="readium-advanced-on"][style*="--USER__letterSpacing"]:lang(ja) div {
  letter-spacing: var(--USER__letterSpacing);
  font-variant: none;
}

:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h1,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h2,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h3,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h4,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h5,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) h6,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) p,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) li,
:root[style*="readium-advanced-on"][style*="--USER__wordSpacing"]:lang(ja) div {
  word-spacing: var(--USER__wordSpacing);
}
`;

function readDocumentLanguage(document: Document): string {
  return (
    document.documentElement.getAttribute('lang') ||
    document.documentElement.getAttribute('xml:lang') ||
    document.documentElement.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang') ||
    ''
  )
    .trim()
    .toLowerCase();
}

function isDocJapanese(document: Document): boolean {
  const language = readDocumentLanguage(document);
  return language === 'ja' || language.startsWith('ja-');
}

function isDocCjk(document: Document): boolean {
  const language = readDocumentLanguage(document);
  return (
    language === 'ja' ||
    language.startsWith('ja-') ||
    language === 'zh' ||
    language.startsWith('zh-') ||
    language === 'ko' ||
    language.startsWith('ko-')
  );
}

function isDocRtl(document: Document): boolean {
  let isRtl = false;
  let foundDirection = false;

  const htmlDirection = document.documentElement.getAttribute('dir')?.trim().toLowerCase();
  if (htmlDirection === 'rtl') {
    foundDirection = true;
    isRtl = true;
  }

  if (!isRtl) {
    const bodyDirection = document.body?.getAttribute('dir')?.trim().toLowerCase();
    if (bodyDirection === 'rtl') {
      foundDirection = true;
      isRtl = true;
    }
  }

  if (!isRtl) {
    const language = readDocumentLanguage(document);
    isRtl =
      language === 'ar' ||
      language.startsWith('ar-') ||
      language === 'he' ||
      language.startsWith('he-') ||
      language === 'fa' ||
      language.startsWith('fa-');
  }

  if (isRtl && !foundDirection) {
    document.documentElement.setAttribute('dir', 'rtl');
  }

  return isRtl;
}

function resolveFontFamily(options: EngineOptions): ReadiumCssSettings['font'] {
  if (options.preferences.fontFamily === 'sans') {
    return 'SANS';
  }
  if (options.preferences.fontFamily === 'round') {
    return 'ROUND';
  }
  if (options.preferences.fontFamily === 'system') {
    return 'DEFAULT';
  }
  return 'OLD';
}

function buildReadiumCssSettings(
  options: EngineOptions,
  directionality: DocumentDirectionality,
  layout: ResponsiveLayout
): ReadiumCssSettings {
  const fontPercentage = `${Math.round(options.preferences.fontScale * 100)}%`;
  const lineHeight = String(options.preferences.lineHeight ?? DEFAULT_LINE_HEIGHT);
  const letterSpacing = `${options.preferences.letterSpacing ?? DEFAULT_LETTER_SPACING}em`;

  return {
    paged: !directionality.isVertical && options.preferences.readingMode === 'paginated',
    colCount: layout.forcedColCount,
    textAlign: options.preferences.textAlign === 'left' ? 'left' : 'justify',
    lineHeight,
    letterSpacing,
    paraSpacing: '0.75rem',
    bodyHyphens: 'auto',
    font: resolveFontFamily(options),
    fontSize: fontPercentage,
    backgroundColor: options.theme.surface,
    textColor: options.theme.text,
    selectionBackgroundColor: options.theme.primary,
    selectionTextColor: options.theme.surface,
    linkColor: options.theme.primary,
    linkVisitedColor: options.theme.primary,
    noFootnotes: false,
    noTemporaryNavTargetOutline: false,
    noRuby: false,
    reduceMotion: false,
  };
}

function ensureHead(document: Document): HTMLHeadElement {
  if (document.head) {
    return document.head;
  }

  const head = document.createElement('head');
  if (document.body) {
    document.documentElement.insertBefore(head, document.body);
  } else {
    document.documentElement.appendChild(head);
  }

  return head;
}

function ensureStyleElement(
  document: Document,
  id: string,
  cssText: string,
  options?: { prepend?: boolean }
): void {
  const head = ensureHead(document);
  const existing = document.getElementById(id);

  if (isStyleElementNode(existing)) {
    if (existing.textContent !== cssText) {
      existing.textContent = cssText;
    }
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = id;
  styleElement.type = 'text/css';
  styleElement.textContent = cssText;

  if (options?.prepend && head.firstChild) {
    head.insertBefore(styleElement, head.firstChild);
    return;
  }

  head.appendChild(styleElement);
}

function removeStyleElement(document: Document, id: string): void {
  document.getElementById(id)?.remove();
}

function setOrRemoveStyle(element: HTMLElement, property: string, value: string | undefined): void {
  if (!value) {
    element.style.removeProperty(property);
    return;
  }

  element.style.setProperty(property, value);
}

function setOrRemoveStyleImportant(
  element: HTMLElement,
  property: string,
  value: string | undefined
): void {
  if (!value) {
    element.style.removeProperty(property);
    return;
  }

  element.style.setProperty(property, value, 'important');
}

function createSupplementalCss(options: EngineOptions, layout: ResponsiveLayout): string {
  return `
:root {
  color-scheme: light;
  --book-reader-surface: ${options.theme.surface};
  --book-reader-text: ${options.theme.text};
  --book-reader-primary: ${options.theme.primary};
  --book-reader-border: ${options.theme.border};
  --book-reader-accent-surface: ${options.theme.accentSurface};
  --book-reader-content-width: ${options.preferences.contentWidth}px;
  --book-reader-page-width: ${layout.pageWidthPx}px;
  --book-reader-max-line-length: ${layout.maxLineLengthPx}px;
  --book-reader-illustration-width: ${layout.illustrationWidthPx}px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  min-height: 100%;
  margin: 0;
  padding: 0;
  background: var(--book-reader-surface) !important;
  color: var(--book-reader-text) !important;
  overscroll-behavior: none;
}

body {
  position: relative;
}

body > :where(img, video, canvas, picture, svg, figure, table, pre, blockquote) {
  max-inline-size: 100%;
}

body :where(img, video, canvas, picture, svg, image) {
  display: block;
  max-width: 100% !important;
  max-inline-size: 100% !important;
  height: auto !important;
  block-size: auto !important;
  object-fit: contain;
}

body :where(figure, img, video, canvas, svg) {
  margin-inline: auto;
}

body :where(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
}

body :where(td, th) {
  border-color: var(--book-reader-border);
}

body[data-section-kind="cover"],
body[data-section-kind="full-page-image"],
body[data-section-kind="illustration"] {
  width: 100% !important;
  max-width: none !important;
  min-width: 100% !important;
  inline-size: 100% !important;
  max-inline-size: none !important;
  margin: 0 !important;
}

:root:not(.${CLASS_PAGINATED}) body[data-section-kind="chapter"] {
  --RS__maxLineLength: var(--book-reader-max-line-length) !important;
  width: min(100%, calc(var(--book-reader-max-line-length) + (var(--RS__pageGutter) * 2))) !important;
  max-width: min(100%, calc(var(--book-reader-max-line-length) + (var(--RS__pageGutter) * 2)));
  margin-inline: auto !important;
  padding-inline: var(--RS__pageGutter) !important;
  padding-block: clamp(28px, 6vh, 88px);
}

:root:not(.${CLASS_PAGINATED}) body[data-section-kind="chapter"]
  > :where(.element, .element-bodymatter, .element-container-single, .element-container-double, article, main, section),
:root:not(.${CLASS_PAGINATED}) body[data-section-kind="chapter"] :where(.heading-container-single, .text) {
  width: 100% !important;
  max-width: 100% !important;
}

:root.${CLASS_PAGINATED} body[data-section-kind="cover"],
:root.${CLASS_PAGINATED} body[data-section-kind="full-page-image"],
:root.${CLASS_PAGINATED} body[data-section-kind="illustration"] {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: clamp(8px, 2vh, 22px) clamp(8px, 2vw, 22px);
}

:root.${CLASS_PAGINATED} body[data-section-kind="cover"] :where(img, svg, video, canvas),
:root.${CLASS_PAGINATED} body[data-section-kind="full-page-image"] :where(img, svg, video, canvas),
:root.${CLASS_PAGINATED} body[data-section-kind="illustration"] :where(img, svg, video, canvas),
:root.${CLASS_PAGINATED} body :where(.inline-image-flow-separate-page img, #cover .cover-image, [id^="full-page-image"] .image-element-image, .element-type-image .image-element-image) {
  width: clamp(360px, 92vw, var(--book-reader-illustration-width)) !important;
  max-width: min(100%, var(--book-reader-illustration-width)) !important;
  max-height: calc(100dvh - 20px) !important;
  max-block-size: calc(100dvh - 20px) !important;
}

body :where(#cover, [id^="full-page-image"], .element-type-image) {
  width: 100%;
  display: grid;
  place-items: center;
}

body :where([id^="full-page-image"] .image-element-block, .element-type-image .image-element-block) {
  width: 100% !important;
  max-width: 100% !important;
  padding-top: 0 !important;
  display: grid;
  place-items: center;
}

body :where([id^="full-page-image"] .image-element-size-container, .element-type-image .image-element-size-container) {
  width: min(100%, calc(100vw - 24px)) !important;
  max-width: 100% !important;
  display: grid !important;
  place-items: center;
}

body :where(.inline-image-flow-separate-page) {
  display: grid;
  place-items: center;
  margin-block: clamp(1.5rem, 5vh, 4rem) !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  text-align: center;
}

body :where(.inline-image-flow-separate-page .inline-image-container) {
  width: clamp(360px, 90vw, var(--book-reader-illustration-width)) !important;
  max-width: 100% !important;
  display: grid;
  place-items: center;
}

body :where(.inline-image-flow-center.inline-image-flow-within-text .inline-image-container) {
  width: min(100%, max(70%, calc(var(--book-reader-max-line-length) * 0.82))) !important;
  max-width: min(100%, var(--book-reader-illustration-width)) !important;
}

body :where(
  .inline-image-flow-center.inline-image-flow-within-text.inline-image-size-large .inline-image-container,
  .inline-image-flow-center.inline-image-flow-within-text.inline-image-size-full .inline-image-container,
  .inline-image-aspect-tall.inline-image-size-large .inline-image-container,
  .inline-image-aspect-tall.inline-image-size-full .inline-image-container
) {
  width: min(100%, max(88%, calc(var(--book-reader-max-line-length) * 1.02))) !important;
}

:root.${CLASS_PAGINATED} body :where(.inline-image-flow-separate-page) {
  break-before: column;
  break-after: column;
  break-inside: avoid;
}

body[data-has-heading-hero="true"] :where(.heading-container-single) {
  max-width: min(100%, var(--book-reader-content-width));
  margin-inline: auto !important;
}

body[data-has-heading-hero="true"] :where(.heading-size-full) {
  min-height: clamp(0px, 22vh, 10rem) !important;
}

body[data-has-heading-hero="true"] :where(.heading-size-full.heading-without-image .heading-contents) {
  padding-top: clamp(1.5rem, 7vh, 4rem) !important;
}

body[data-has-heading-hero="true"] :where(.heading-size-full.heading-with-image .heading-contents) {
  padding-top: clamp(1rem, 4vh, 2.25rem) !important;
}

body[data-has-heading-hero="true"] :where(.heading) {
  margin-bottom: clamp(1.5rem, 4vh, 2.5rem) !important;
}

a {
  color: var(--book-reader-primary);
}

blockquote {
  border-inline-start: 3px solid var(--book-reader-border);
  color: color-mix(in srgb, var(--book-reader-text) 76%, var(--book-reader-surface));
}

pre {
  border-radius: 16px;
  border: 1px solid var(--book-reader-border);
  background: var(--book-reader-accent-surface);
}

@media (max-width: 840px) {
  body :where(.inline-image-flow-left.inline-image-flow-within-text, .inline-image-flow-right.inline-image-flow-within-text) {
    float: none !important;
    width: 100% !important;
    margin-inline: 0 !important;
  }
}

/* ─── 用户排版自由度（task031 2.3 + 5.4） ───────────────────── */

/* 竖排：窄列内容宽度、单列分页与纵向行长约束 */
:root[style*="vertical-rl"] {
  --RS__maxLineLength: var(--user-content-width) !important;
  --RS__colWidth: var(--user-content-width) !important;
  --RS__colCount: 1 !important;
}

:root[style*="vertical-rl"] body {
  max-width: none !important;
  max-height: var(--user-content-width) !important;
}

/* 横排（覆盖竖排 profile 遗留的纵向行长约束） */
:root[style*="horizontal-tb"] body {
  max-height: none !important;
}

/* CJK profile 缺少 ReadiumCSS 的对齐覆盖，补齐相同语义规则 */
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-text-align"]:not([style*="vertical-rl"]) {
  text-align: var(--user-text-align);
}

:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-text-align"]:not([style*="vertical-rl"]) body,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-text-align"]:not([style*="vertical-rl"]) p,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-text-align"]:not([style*="vertical-rl"]) li {
  text-align: inherit !important;
  text-align-last: auto !important;
}

/* CJK profile 缺少 ReadiumCSS 的字距覆盖，补齐相同元素范围 */
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h1,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h2,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h3,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h4,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h5,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] h6,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] p,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] li,
:root:is(:lang(zh), :lang(ja), :lang(ko))[style*="readium-advanced-on"][style*="--user-letter-spacing"] div {
  letter-spacing: var(--user-letter-spacing);
}
`;
}

export class ReadiumCssManager {
  public async injectStyles(document: Document): Promise<void> {
    const profile = this.resolveProfile(document);
    const includeDefault = !this.hasPublisherStyles(document);
    const [beforeCss, defaultCss, afterCss] = await Promise.all([
      this.loadStyleText(profile, 'before'),
      includeDefault ? this.loadStyleText(profile, 'default') : Promise.resolve(''),
      this.loadStyleText(profile, 'after'),
    ]);

    ensureStyleElement(document, PATCH_STYLE_ID, READIUM_PATCH_CSS, { prepend: true });
    ensureStyleElement(document, BEFORE_STYLE_ID, beforeCss, { prepend: true });

    if (includeDefault) {
      ensureStyleElement(document, DEFAULT_STYLE_ID, defaultCss);
    } else {
      removeStyleElement(document, DEFAULT_STYLE_ID);
    }

    ensureStyleElement(document, AFTER_STYLE_ID, afterCss);
  }

  public applySettings(document: Document, options: EngineOptions, layout: ResponsiveLayout): void {
    this.applyWritingMode(document, options);
    const directionality = this.resolveDirectionality(document);
    const root = document.documentElement;
    const settings = buildReadiumCssSettings(options, directionality, layout);

    root.classList.toggle(CLASS_VWM, directionality.isVertical);
    root.classList.toggle(CLASS_PAGINATED, settings.paged);
    root.classList.toggle(ROOT_CLASS_NO_FOOTNOTES, Boolean(settings.noFootnotes));
    root.classList.toggle(ROOT_CLASS_NO_RUBY, Boolean(settings.noRuby));
    root.classList.toggle(ROOT_CLASS_REDUCE_MOTION, Boolean(settings.reduceMotion));
    root.classList.toggle(
      DISABLE_TEMPORARY_NAV_TARGET_OUTLINE_CLASS,
      Boolean(settings.noTemporaryNavTargetOutline)
    );

    this.applyReadiumCssVariables(root, settings, directionality);
    this.applyLayoutVariables(root, document, layout);
    this.applyThemeVariables(root, options);
    ensureStyleElement(document, SUPPLEMENTAL_STYLE_ID, createSupplementalCss(options, layout));
  }

  public resolveDirectionality(document: Document): DocumentDirectionality {
    const view = document.defaultView;
    if (!view) {
      return {
        isVertical: false,
        isRtl: isDocRtl(document),
      };
    }

    let isRtl = isDocRtl(document);
    let isVertical = false;

    const htmlStyle = view.getComputedStyle(document.documentElement);
    let property = htmlStyle.getPropertyValue('direction');
    if (property.includes('rtl')) {
      isRtl = true;
    }

    property =
      htmlStyle.getPropertyValue('writing-mode') ||
      htmlStyle.getPropertyValue('-epub-writing-mode');
    if (property.includes('vertical')) {
      isVertical = true;
    }
    if (property.includes('-rl')) {
      isRtl = true;
    }

    if (document.body) {
      const bodyStyle = view.getComputedStyle(document.body);
      property = bodyStyle.getPropertyValue('direction');
      if (property.includes('rtl')) {
        isRtl = true;
      }

      property =
        bodyStyle.getPropertyValue('writing-mode') ||
        bodyStyle.getPropertyValue('-epub-writing-mode');
      if (property.includes('vertical')) {
        isVertical = true;
      }
      if (property.includes('-rl')) {
        isRtl = true;
      }
    }

    return {
      isVertical,
      isRtl,
    };
  }

  public resolveProfile(document: Document): ReadiumProfile {
    const directionality = this.resolveDirectionality(document);

    if (directionality.isVertical && isDocCjk(document)) {
      return 'cjk-vertical';
    }
    if (isDocCjk(document)) {
      return 'cjk-horizontal';
    }
    if (directionality.isRtl) {
      return 'rtl';
    }

    return 'default';
  }

  private applyWritingMode(document: Document, options: EngineOptions): void {
    const root = document.documentElement;
    if (!isDocCjk(document)) {
      setOrRemoveStyle(root, 'writing-mode', undefined);
      return;
    }

    setOrRemoveStyle(
      root,
      'writing-mode',
      options.preferences.writingMode === 'vertical' ? 'vertical-rl' : 'horizontal-tb'
    );
  }

  /**
   * 取 profile 样式层文本：编译期内联（`src/readium/css-assets.ts` 的 `?raw` 导入），
   * 无运行时 `fetch`；返回前把样式内的字体相对路径重写为包内资产绝对 URL。
   */
  private loadStyleText(profile: ReadiumProfile, mod: ReadiumStyleMod): Promise<string> {
    return Promise.resolve(this.rewriteFontUrls(READIUM_CSS_TEXTS[profile][mod]));
  }

  private rewriteFontUrls(cssText: string): string {
    return Object.entries(buildReadiumFontUrlMap()).reduce((current, [relativePath, assetUrl]) => {
      return current.split(relativePath).join(assetUrl);
    }, cssText);
  }

  private hasPublisherStyles(document: Document): boolean {
    const head = document.head;
    if (!head) {
      return false;
    }

    for (const child of Array.from(head.children)) {
      const localName = child.localName.toLowerCase();
      if (localName === 'style') {
        return true;
      }

      if (
        localName === 'link' &&
        (child.getAttribute('rel')?.trim().toLowerCase() === 'stylesheet' ||
          child.getAttribute('type')?.trim().toLowerCase() === 'text/css')
      ) {
        return true;
      }
    }

    return Boolean(document.body?.getAttribute('style'));
  }

  private applyReadiumCssVariables(
    root: HTMLElement,
    settings: ReadiumCssSettings,
    directionality: DocumentDirectionality
  ): void {
    setOrRemoveStyle(root, '--USER__advancedSettings', 'readium-advanced-on');
    setOrRemoveStyle(
      root,
      '--USER__view',
      settings.paged ? 'readium-paged-on' : 'readium-scroll-on'
    );
    setOrRemoveStyle(root, '--USER__appearance', 'readium-default-on');
    setOrRemoveStyle(
      root,
      '--USER__fontOverride',
      settings.font && settings.font !== 'DEFAULT' ? 'readium-font-on' : 'readium-font-off'
    );

    if (settings.font === 'SANS') {
      setOrRemoveStyle(root, '--USER__fontFamily', 'var(--RS__sansTf)');
    } else if (settings.font === 'OLD') {
      setOrRemoveStyle(root, '--USER__fontFamily', 'var(--RS__oldStyleTf)');
    } else if (settings.font === 'ROUND') {
      setOrRemoveStyle(root, '--USER__fontFamily', 'var(--user-font-family-round)');
    } else {
      setOrRemoveStyle(root, '--USER__fontFamily', undefined);
    }

    const fontSize = settings.fontSize?.trim();
    if (fontSize && fontSize !== '100%') {
      setOrRemoveStyle(root, '--USER__fontSize', fontSize);
      const ratio = fontSize.endsWith('%')
        ? Number.parseFloat(fontSize) / 100
        : Number.parseFloat(fontSize);
      setOrRemoveStyle(root, '--USER__fontXSizeX', Number.isFinite(ratio) ? String(ratio) : '1');
    } else {
      setOrRemoveStyle(root, '--USER__fontSize', undefined);
      setOrRemoveStyle(root, '--USER__fontXSizeX', '1');
    }

    setOrRemoveStyle(root, '--USER__lineHeight', `var(--user-line-height)`);
    setOrRemoveStyle(root, '--user-line-height', settings.lineHeight);
    setOrRemoveStyle(root, '--user-letter-spacing', settings.letterSpacing);
    setOrRemoveStyle(root, '--USER__letterSpacing', `var(--user-letter-spacing)`);
    setOrRemoveStyle(root, '--user-text-align', settings.textAlign);
    setOrRemoveStyle(root, '--user-font-family-round', READER_FONT_FAMILY_STACKS.round);
    setOrRemoveStyle(root, '--USER__typeScale', settings.typeScale);
    setOrRemoveStyle(root, '--USER__paraSpacing', settings.paraSpacing);
    setOrRemoveStyle(root, '--USER__pageMargins', settings.pageMargins);
    setOrRemoveStyle(root, '--USER__backgroundColor', settings.backgroundColor);
    setOrRemoveStyle(root, '--USER__textColor', settings.textColor);
    setOrRemoveStyle(root, '--RS__selectionBackgroundColor', settings.selectionBackgroundColor);
    setOrRemoveStyle(root, '--RS__selectionTextColor', settings.selectionTextColor);
    setOrRemoveStyle(root, '--RS__linkColor', settings.linkColor);
    setOrRemoveStyle(root, '--RS__visitedColor', settings.linkVisitedColor);

    if (!directionality.isVertical) {
      setOrRemoveStyle(root, '--USER__colCount', settings.colCount);
      setOrRemoveStyle(root, '--USER__textAlign', settings.textAlign);
      setOrRemoveStyle(root, '--USER__paraIndent', settings.paraIndent);
    } else {
      setOrRemoveStyle(root, '--USER__colCount', '1');
      setOrRemoveStyle(root, '--USER__textAlign', undefined);
      setOrRemoveStyle(root, '--USER__paraIndent', undefined);
    }

    if (directionality.isVertical || directionality.isRtl) {
      setOrRemoveStyle(root, '--USER__bodyHyphens', undefined);
    } else {
      setOrRemoveStyle(root, '--USER__bodyHyphens', settings.bodyHyphens);
    }

    if (isDocJapanese(root.ownerDocument)) {
      setOrRemoveStyle(root, '--USER__wordSpacing', settings.wordSpacing);
    } else {
      setOrRemoveStyle(root, '--USER__wordSpacing', undefined);
    }
  }

  private applyLayoutVariables(
    root: HTMLElement,
    document: Document,
    layout: ResponsiveLayout
  ): void {
    setOrRemoveStyle(root, '--RS__pageGutter', `${layout.pageGutterPx}px`);
    setOrRemoveStyle(root, '--RS__colGap', `${layout.columnGapPx}px`);
    setOrRemoveStyle(root, '--RS__colWidth', `${layout.pageWidthPx}px`);
    setOrRemoveStyle(root, '--RS__maxLineLength', `${layout.maxLineLengthPx}px`);
    setOrRemoveStyle(root, '--book-reader-page-width', `${layout.pageWidthPx}px`);
    setOrRemoveStyle(root, '--book-reader-max-line-length', `${layout.maxLineLengthPx}px`);
    setOrRemoveStyle(root, '--book-reader-illustration-width', `${layout.illustrationWidthPx}px`);

    if (document.body) {
      setOrRemoveStyleImportant(
        document.body,
        '--RS__maxLineLength',
        `${layout.maxLineLengthPx}px`
      );
    }
  }

  private applyThemeVariables(root: HTMLElement, options: EngineOptions): void {
    setOrRemoveStyle(root, '--book-reader-surface', options.theme.surface);
    setOrRemoveStyle(root, '--book-reader-text', options.theme.text);
    setOrRemoveStyle(root, '--book-reader-primary', options.theme.primary);
    setOrRemoveStyle(root, '--book-reader-border', options.theme.border);
    setOrRemoveStyle(root, '--book-reader-accent-surface', options.theme.accentSurface);
    setOrRemoveStyle(root, '--book-reader-content-width', `${options.preferences.contentWidth}px`);
    const isVertical =
      options.preferences.writingMode === 'vertical' && isDocCjk(root.ownerDocument);
    const verticalContentWidth = isVertical
      ? Math.min(options.preferences.contentWidth, VERTICAL_CONTENT_WIDTH_LIMIT_PX)
      : options.preferences.contentWidth;
    setOrRemoveStyle(root, '--user-content-width', `${verticalContentWidth}px`);
  }
}
