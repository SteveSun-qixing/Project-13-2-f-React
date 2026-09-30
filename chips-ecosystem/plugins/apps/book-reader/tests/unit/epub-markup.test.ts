// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { renderSectionDocument } from '../../src/domain/epub/markup';
import { createEpubPublication } from '../../src/domain/epub/publication';
import type { EpubBook, EpubManifestItem, EpubSection } from '../../src/domain/epub/types';

function createMockBook(params?: {
  sectionPath?: string;
  sectionTitle?: string;
  sectionMarkup?: string;
}): EpubBook {
  const sectionPath = params?.sectionPath ?? 'OPS/text/chapter.xhtml';
  const sectionTitle = params?.sectionTitle ?? 'Chapter XHTML';
  const chapterText =
    params?.sectionMarkup ??
    `<?xml version="1.0" encoding="UTF-8"?>
  <html xmlns="http://www.w3.org/1999/xhtml" lang="ja">
    <head>
      <title>${sectionTitle}</title>
      <link rel="stylesheet" href="../styles/book.css" />
    </head>
    <body>
      <h1>Chapter XHTML</h1>
      <p><a href="chapter-2.xhtml#frag">Next</a></p>
      <img src="../images/cover.png" alt="cover" />
    </body>
  </html>`;
  const styleText = `@font-face { font-family: TestReader; src: url("../fonts/reader.ttf"); } body { background-image: url("../images/cover.png"); }`;

  const textEntries = new Map<string, string>([
    [sectionPath, chapterText],
    ['OPS/styles/book.css', styleText],
  ]);
  const binaryEntries = new Map<string, Uint8Array>([
    ['OPS/images/cover.png', new Uint8Array([137, 80, 78, 71])],
    ['OPS/fonts/reader.ttf', new Uint8Array([0, 1, 2, 3])],
  ]);

  const manifestItems: EpubManifestItem[] = [
    {
      id: 'chapter',
      href: 'text/chapter.xhtml',
      path: sectionPath,
      mediaType: 'application/xhtml+xml',
      properties: [],
    },
    {
      id: 'style',
      href: 'styles/book.css',
      path: 'OPS/styles/book.css',
      mediaType: 'text/css',
      properties: [],
    },
    {
      id: 'cover',
      href: 'images/cover.png',
      path: 'OPS/images/cover.png',
      mediaType: 'image/png',
      properties: [],
    },
    {
      id: 'font',
      href: 'fonts/reader.ttf',
      path: 'OPS/fonts/reader.ttf',
      mediaType: 'application/font-sfnt',
      properties: [],
    },
  ];

  const manifest = new Map(manifestItems.map((item) => [item.id, item]));
  const manifestByPath = new Map(manifestItems.map((item) => [item.path, item]));
  const sections: EpubSection[] = [
    {
      id: 'chapter',
      href: 'text/chapter.xhtml',
      path: sectionPath,
      title: sectionTitle,
      linear: true,
    },
  ];

  return {
    source: {
      sourceId: '/tmp/book.epub',
      filePath: '/tmp/book.epub',
      fileName: 'book.epub',
      title: 'book.epub',
      isRemote: false,
    },
    metadata: {
      title: 'Mock Book',
      language: 'ja',
    },
    archive: {
      listEntries: () => [],
      hasEntry: (path: string) => textEntries.has(path) || binaryEntries.has(path),
      readText: (path: string): Promise<string> => {
        const entry = textEntries.get(path);
        if (!entry) {
          return Promise.reject(new Error(`Missing text entry: ${path}`));
        }
        return Promise.resolve(entry);
      },
      readBinary: (path: string): Promise<Uint8Array> => {
        const entry = binaryEntries.get(path);
        if (!entry) {
          return Promise.reject(new Error(`Missing binary entry: ${path}`));
        }
        return Promise.resolve(entry);
      },
    },
    publication: createEpubPublication({
      manifest,
      sections,
      navigation: [],
    }),
    packagePath: 'OPS/package.opf',
    manifest,
    manifestByPath,
    sections,
    navigation: [],
    coverPath: undefined,
    coverMediaType: undefined,
    coverImageUri: undefined,
  };
}

describe('renderSectionDocument', () => {
  it('会把章节内相对资源和内部链接改写为可读形态', async () => {
    const result = await renderSectionDocument(createMockBook(), 'OPS/text/chapter.xhtml');

    expect(result.sectionPath).toBe('OPS/text/chapter.xhtml');
    expect(result.html).toContain('data-epub-target="OPS/text/chapter-2.xhtml#frag"');
    expect(result.html).toContain('data:image/png;base64,');
    expect(result.html).toContain('data:application/font-sfnt;base64,');
    expect(result.html).toContain('data-section-kind="chapter"');
    expect(result.html).toContain('data-chips-app="book-reader.chapter"');
    expect(result.html).toContain('max-inline-size: 100% !important');
  });

  it('会为整页插图章节注入专用响应式布局', async () => {
    const sectionPath = 'OPS/text/full-page-image.xhtml';
    const result = await renderSectionDocument(
      createMockBook({
        sectionPath,
        sectionTitle: 'Full Page Illustration',
        sectionMarkup: `<?xml version="1.0" encoding="UTF-8"?>
        <html xmlns="http://www.w3.org/1999/xhtml" lang="ja">
          <head>
            <title>Full Page Illustration</title>
            <link rel="stylesheet" href="../styles/book.css" />
          </head>
          <body>
            <div id="full-page-image" class="element element-non-bodymatter element-container-single element-type-image">
              <div class="image-element-block image-element-aspect-tall">
                <div class="image-element-size-container">
                  <img src="../images/cover.png" alt="cover" class="image-element-image" />
                </div>
              </div>
            </div>
          </body>
        </html>`,
      }),
      sectionPath
    );

    expect(result.html).toContain('data-section-kind="full-page-image"');
    expect(result.html).toContain('class="image-element-size-container"');
    expect(result.html).toContain('data-has-separate-page-illustration="false"');
  });

  it('会为章节中的独立插图和大标题压缩空白并修正分页', async () => {
    const sectionPath = 'OPS/text/chapter-vellum.xhtml';
    const result = await renderSectionDocument(
      createMockBook({
        sectionPath,
        sectionTitle: 'Vellum Chapter',
        sectionMarkup: `<?xml version="1.0" encoding="UTF-8"?>
        <html xmlns="http://www.w3.org/1999/xhtml" lang="ja">
          <head>
            <title>Vellum Chapter</title>
            <link rel="stylesheet" href="../styles/book.css" />
          </head>
          <body>
            <div class="heading heading-container-single heading-size-full heading-format-full heading-alignment-flexible heading-without-image">
              <div class="heading-contents">
                <div class="title-block">
                  <h1 class="element-title">Chapter Title</h1>
                </div>
              </div>
            </div>
            <p>Paragraph text.</p>
            <div class="inline-image inline-image-kind-photograph inline-image-size-full inline-image-flow-center inline-image-flow-separate-page inline-image-aspect-tall inline-image-without-caption">
              <div class="inline-image-container">
                <img src="../images/cover.png" alt="illustration" />
              </div>
            </div>
          </body>
        </html>`,
      }),
      sectionPath
    );

    expect(result.html).toContain('data-has-separate-page-illustration="true"');
    expect(result.html).toContain('data-has-heading-hero="true"');
    expect(result.html).toContain('inline-image-flow-separate-page');
    expect(result.html).toContain('heading-size-full');
  });
});
