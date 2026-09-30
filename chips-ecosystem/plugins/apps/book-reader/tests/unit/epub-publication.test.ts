import { describe, expect, it } from 'vitest';
import { createEpubPublication } from '../../src/domain/epub/publication';
import type {
  EpubManifestItem,
  EpubNavigationItem,
  EpubSection,
} from '../../src/domain/epub/types';

describe('EpubPublication', () => {
  it('会生成阅读顺序、目录与资源链接映射', () => {
    const manifest = new Map<string, EpubManifestItem>([
      [
        'cover-doc',
        {
          id: 'cover-doc',
          href: 'cover.xhtml',
          path: 'OEBPS/cover.xhtml',
          mediaType: 'application/xhtml+xml',
          properties: [],
        },
      ],
      [
        'chapter-1',
        {
          id: 'chapter-1',
          href: 'chapter-1.xhtml',
          path: 'OEBPS/chapter-1.xhtml',
          mediaType: 'application/xhtml+xml',
          properties: [],
        },
      ],
      [
        'nav',
        {
          id: 'nav',
          href: 'menu.xhtml',
          path: 'OEBPS/menu.xhtml',
          mediaType: 'application/xhtml+xml',
          properties: ['nav'],
        },
      ],
      [
        'cover-image',
        {
          id: 'cover-image',
          href: 'images/cover.jpg',
          path: 'OEBPS/images/cover.jpg',
          mediaType: 'image/jpeg',
          properties: ['cover-image'],
        },
      ],
    ]);

    const sections: EpubSection[] = [
      {
        id: 'cover-doc',
        href: 'cover.xhtml',
        path: 'OEBPS/cover.xhtml',
        title: 'Cover',
        linear: true,
      },
      {
        id: 'chapter-1',
        href: 'chapter-1.xhtml',
        path: 'OEBPS/chapter-1.xhtml',
        title: 'Chapter 1',
        linear: true,
      },
    ];

    const navigation: EpubNavigationItem[] = [
      {
        id: 'toc-1',
        label: 'Chapter 1',
        href: 'OEBPS/chapter-1.xhtml',
        path: 'OEBPS/chapter-1.xhtml',
        sectionIndex: 1,
        children: [],
      },
    ];

    const publication = createEpubPublication({
      manifest,
      sections,
      navigation,
      coverPath: 'OEBPS/images/cover.jpg',
      navPath: 'OEBPS/menu.xhtml',
    });

    expect(publication.readingOrder.map((item) => item.path)).toEqual([
      'OEBPS/cover.xhtml',
      'OEBPS/chapter-1.xhtml',
    ]);
    expect(publication.cover?.rels).toContain('cover');
    expect(publication.nav?.rels).toContain('contents');
    expect(publication.linksByPath.get('OEBPS/chapter-1.xhtml')?.title).toBe('Chapter 1');
    expect(publication.linksByPath.get('OEBPS/chapter-1.xhtml')?.mediaType).toBe(
      'application/xhtml+xml'
    );
    expect(publication.toc[0]?.title).toBe('Chapter 1');
  });
});
