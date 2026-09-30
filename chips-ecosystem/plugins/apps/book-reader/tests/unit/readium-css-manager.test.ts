// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { ReadiumCssManager } from '../../src/engine/readium-css-manager';
import type { EngineOptions, ResponsiveLayout } from '../../src/engine/types';

const DEFAULT_OPTIONS: EngineOptions = {
  preferences: {
    fontScale: 1,
    contentWidth: 760,
    fontFamily: 'serif',
    readingMode: 'paginated',
    backgroundTone: 'theme',
  },
  theme: {
    surface: '#f5f2ea',
    text: '#1f1d19',
    mutedText: '#6b665d',
    primary: '#2158d2',
    border: 'rgba(0, 0, 0, 0.12)',
    accentSurface: '#eef3ff',
  },
};

const SPREAD_LAYOUT: ResponsiveLayout = {
  forcedColCount: '2',
  pageWidthPx: 680,
  pageGutterPx: 40,
  columnGapPx: 32,
  maxLineLengthPx: 640,
  illustrationWidthPx: 920,
  shouldUseSpread: true,
  spreadWidthPx: 1440,
  effectiveContentWidth: 640,
  windowBreakpoint: 'expanded',
  verticalPadding: {
    top: 52,
    bottom: 64,
  },
};

function createReaderDocument(): Document {
  const nextDocument = document.implementation.createHTMLDocument('reader');
  Object.defineProperty(nextDocument, 'defaultView', {
    value: window,
    configurable: true,
  });
  nextDocument.body.dataset.sectionKind = 'chapter';
  return nextDocument;
}

function mockVerticalWritingMode(readerDocument: Document): void {
  const view = readerDocument.defaultView;
  if (!view) {
    throw new Error('测试文档缺少 defaultView。');
  }

  vi.spyOn(view, 'getComputedStyle').mockImplementation((element: Element) => {
    return {
      getPropertyValue: (property: string) => {
        if (element === readerDocument.documentElement || element === readerDocument.body) {
          if (property === 'writing-mode' || property === '-epub-writing-mode') {
            return 'vertical-rl';
          }
        }
        return '';
      },
    } as CSSStyleDeclaration;
  });
}

describe('ReadiumCssManager', () => {
  it('会根据语言和书写模式解析 CJK 竖排 profile', () => {
    const manager = new ReadiumCssManager();
    const readerDocument = createReaderDocument();
    readerDocument.documentElement.lang = 'ja';
    mockVerticalWritingMode(readerDocument);

    expect(manager.resolveDirectionality(readerDocument)).toEqual({
      isVertical: true,
      isRtl: true,
    });
    expect(manager.resolveProfile(readerDocument)).toBe('cjk-vertical');
  });

  it('会在 RTL 语言文档上补齐 dir 并选择 rtl profile', () => {
    const manager = new ReadiumCssManager();
    const readerDocument = createReaderDocument();
    readerDocument.documentElement.lang = 'ar';

    expect(manager.resolveDirectionality(readerDocument)).toEqual({
      isVertical: false,
      isRtl: true,
    });
    expect(readerDocument.documentElement.getAttribute('dir')).toBe('rtl');
    expect(manager.resolveProfile(readerDocument)).toBe('rtl');
  });

  it('注入 ReadiumCSS 时会重写字体资源 URL 并保留补丁样式', async () => {
    const manager = new ReadiumCssManager();
    const readerDocument = createReaderDocument();

    await manager.injectStyles(readerDocument);

    const beforeStyle = readerDocument.getElementById('book-reader-readium-before');
    const defaultStyle = readerDocument.getElementById('book-reader-readium-default');
    const afterStyle = readerDocument.getElementById('book-reader-readium-after');
    const patchStyle = readerDocument.getElementById('book-reader-readium-patch');

    expect(beforeStyle?.textContent).toContain('@font-face');
    // 字体相对引用已重写为包内资产绝对 URL（import.meta.url 基准）
    expect(beforeStyle?.textContent).toContain('assets/readium/ReadiumCSS/fonts/');
    expect(beforeStyle?.textContent).not.toContain('url("fonts/');
    expect(defaultStyle).toBeTruthy();
    expect(afterStyle).toBeTruthy();
    expect(patchStyle?.textContent).toContain('pagebreak');
  });

  it('检测到出版方样式时不会注入 Readium 默认样式层', async () => {
    const manager = new ReadiumCssManager();
    const readerDocument = createReaderDocument();
    const publisherStyle = readerDocument.createElement('style');
    publisherStyle.textContent = 'body { color: red; }';
    readerDocument.head.appendChild(publisherStyle);

    await manager.injectStyles(readerDocument);

    expect(readerDocument.getElementById('book-reader-readium-default')).toBeNull();
    expect(readerDocument.getElementById('book-reader-readium-before')).toBeTruthy();
    expect(readerDocument.getElementById('book-reader-readium-after')).toBeTruthy();
  });

  it('会把阅读偏好、主题色和布局参数写入 CSS 变量', () => {
    const manager = new ReadiumCssManager();
    const readerDocument = createReaderDocument();

    manager.applySettings(readerDocument, DEFAULT_OPTIONS, SPREAD_LAYOUT);

    const root = readerDocument.documentElement;
    const supplementalStyle = readerDocument.getElementById('book-reader-supplemental');

    expect(root.classList.contains('r2-css-paginated')).toBe(true);
    expect(root.style.getPropertyValue('--USER__view')).toBe('readium-paged-on');
    expect(root.style.getPropertyValue('--USER__fontFamily')).toBe('var(--RS__oldStyleTf)');
    expect(root.style.getPropertyValue('--USER__colCount')).toBe('2');
    expect(root.style.getPropertyValue('--RS__maxLineLength')).toBe('640px');
    expect(root.style.getPropertyValue('--book-reader-surface')).toBe('#f5f2ea');
    expect(readerDocument.body.style.getPropertyValue('--RS__maxLineLength')).toBe('640px');
    expect(readerDocument.body.style.getPropertyPriority('--RS__maxLineLength')).toBe('important');
    expect(supplementalStyle?.textContent).toContain('--book-reader-content-width: 760px;');
  });

  it('竖排文档会禁用 paginated 根类并强制单列变量', () => {
    const manager = new ReadiumCssManager();
    const readerDocument = createReaderDocument();
    readerDocument.documentElement.lang = 'ja';
    mockVerticalWritingMode(readerDocument);

    manager.applySettings(
      readerDocument,
      {
        ...DEFAULT_OPTIONS,
        preferences: {
          ...DEFAULT_OPTIONS.preferences,
          fontFamily: 'sans',
        },
      },
      SPREAD_LAYOUT
    );

    const root = readerDocument.documentElement;

    expect(root.classList.contains('r2-class-VWM')).toBe(true);
    expect(root.classList.contains('r2-css-paginated')).toBe(false);
    expect(root.style.getPropertyValue('--USER__colCount')).toBe('1');
    expect(root.style.getPropertyValue('--USER__bodyHyphens')).toBe('');
    expect(root.style.getPropertyValue('--USER__fontFamily')).toBe('var(--RS__sansTf)');
  });
});
