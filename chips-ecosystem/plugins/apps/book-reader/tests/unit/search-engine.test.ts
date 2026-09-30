// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { SearchEngine, type SearchResult } from '../../src/engine/search-engine';
import type { EpubBook } from '../../src/domain/epub/types';

function createBookFixture(): EpubBook {
  const sections = [
    {
      id: 's1',
      href: 'chapter-1.xhtml',
      path: 'OEBPS/chapter-1.xhtml',
      title: '第一章',
      linear: true,
    },
    {
      id: 's2',
      href: 'chapter-2.xhtml',
      path: 'OEBPS/chapter-2.xhtml',
      title: '第二章',
      linear: true,
    },
  ];

  const documents = new Map<string, string>([
    ['OEBPS/chapter-1.xhtml', '<html><body><p>Winter night and winter wind.</p></body></html>'],
    ['OEBPS/chapter-2.xhtml', '<html><body><p>Another winter arrives.</p></body></html>'],
  ]);

  return {
    source: {
      sourceId: 'demo',
      fileName: 'demo.epub',
      title: 'Demo',
      isRemote: false,
    },
    metadata: {
      title: 'Demo',
    },
    archive: {
      readText: vi.fn((path: string): Promise<string> =>
        Promise.resolve(documents.get(path) ?? '')
      ),
    } as unknown as EpubBook['archive'],
    publication: {
      readingOrder: [],
      resources: [],
      toc: [],
      linksByPath: new Map(),
    },
    packagePath: 'OEBPS/content.opf',
    manifest: new Map(),
    manifestByPath: new Map(),
    sections,
    navigation: [],
  };
}

describe('SearchEngine', () => {
  it('会增量返回跨章节搜索结果并上报搜索进度', async () => {
    const engine = new SearchEngine(createBookFixture());
    const progress = vi.fn();
    const batches: SearchResult[][] = [];

    for await (const batch of engine.search('winter', { onProgress: progress })) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(2);
    expect(batches[1]).toHaveLength(1);
    expect(progress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(progress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it('会在当前文档中高亮结果，并能清除高亮', () => {
    const engine = new SearchEngine(createBookFixture());
    const document = new DOMParser().parseFromString(
      '<html><body><p>Winter night and winter wind.</p></body></html>',
      'text/html'
    );
    const results: SearchResult[] = [
      {
        sectionIndex: 0,
        sectionTitle: '第一章',
        excerpt: 'Winter night',
        matchOffset: 0,
        matchLength: 6,
        query: 'winter',
      },
      {
        sectionIndex: 0,
        sectionTitle: '第一章',
        excerpt: 'winter wind',
        matchOffset: 17,
        matchLength: 6,
        query: 'winter',
      },
    ];

    engine.highlightInDocument(document, results, 1);

    const marks = document.querySelectorAll('mark[data-search-result]');
    expect(marks).toHaveLength(2);
    expect(document.getElementById('book-reader-search-highlights')).toBeTruthy();
    expect(marks[1]?.classList.contains('search-current')).toBe(true);

    engine.clearHighlights(document);
    expect(document.querySelectorAll('mark[data-search-result]')).toHaveLength(0);
  });
});
