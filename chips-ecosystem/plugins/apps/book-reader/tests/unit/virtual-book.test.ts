// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { renderSectionDocument } from '../../src/domain/epub/markup';
import { loadReadableBook } from '../../src/domain/book/virtual-book';

const encoder = new TextEncoder();

describe('loadReadableBook', () => {
  it('将 TXT 加载为可阅读章节', async () => {
    const book = await loadReadableBook({
      bytes: encoder.encode('第一章\n\n这是正文。'),
      source: {
        sourceId: '/tmp/demo.txt',
        fileName: 'demo.txt',
        title: 'Demo Text',
        format: 'txt',
        isRemote: false,
      },
    });

    expect(book.metadata.title).toBe('Demo Text');
    expect(book.sections).toHaveLength(1);
    await expect(renderSectionDocument(book, book.sections[0]?.path ?? '')).resolves.toMatchObject({
      title: 'Demo Text',
    });
  });

  it('将 Markdown 标题渲染为章节 HTML', async () => {
    const book = await loadReadableBook({
      bytes: encoder.encode('# 标题\n\n- 条目'),
      source: {
        sourceId: '/tmp/demo.md',
        fileName: 'demo.md',
        title: 'Demo Markdown',
        format: 'md',
        isRemote: false,
      },
    });
    const section = await renderSectionDocument(book, book.sections[0]?.path ?? '');

    expect(section.html).toContain('<h1>');
    expect(section.html).toContain('<li>');
  });

  it('为 PDF 建立内嵌阅读章节', async () => {
    const book = await loadReadableBook({
      bytes: encoder.encode('%PDF-1.7'),
      source: {
        sourceId: '/tmp/demo.pdf',
        fileName: 'demo.pdf',
        title: 'Demo PDF',
        format: 'pdf',
        resourceUri: 'file:///tmp/demo.pdf',
        isRemote: false,
      },
    });
    const section = await renderSectionDocument(book, book.sections[0]?.path ?? '');

    expect(section.html).toContain('chips-reader-pdf');
    expect(section.html).toContain('file:///tmp/demo.pdf');
  });

  it('对未接入正式解码器的格式给出明确错误', async () => {
    await expect(
      loadReadableBook({
        bytes: encoder.encode('binary'),
        source: {
          sourceId: '/tmp/demo.azw3',
          fileName: 'demo.azw3',
          title: 'Demo AZW3',
          format: 'azw3',
          isRemote: false,
        },
      })
    ).rejects.toThrow('AZW3');
  });
});
