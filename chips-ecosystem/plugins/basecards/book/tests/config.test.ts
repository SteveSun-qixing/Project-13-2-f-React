import { describe, expect, it } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import {
  buildBookOpenRequest,
  buildContent,
  DEFAULT_CONFIG,
  deriveDisplayAuthor,
  deriveDisplayTitle,
  formatBookFormatLabel,
  readConfig,
  validateConfig,
} from '../src/config';
import { createInitialContent, collectResourcePaths } from '../src/main';
import { sortImageItems } from '../src/shared/utils';

function createBasecard(content: Record<string, unknown>): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.book',
    content,
    revision: 1,
    card: {
      card_id: 'z9Y8x7W6v5',
      name: '示例卡片',
      chip_standards_version: '1.0.0',
      cover_ratio: '3:2',
      tags: [],
    },
  };
}

const FULL_EBOOK_CONFIG = {
  source_type: 'ebook' as const,
  book_file: 'books/demo.epub',
  book_format: 'epub',
  book_name: '示例书籍',
  book_author: '艾丽丝',
  cover_image: 'covers/demo.jpg',
  image_sequence: [],
  image_sort_basis: 'filename' as const,
};

describe('readConfig（归一）', () => {
  it('未提供或非法输入回退默认配置', () => {
    expect(readConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(readConfig('book')).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ source_type: 'paper' })).toMatchObject({ source_type: 'ebook' });
  });

  it('图片序列非空且未声明来源时归一为 image-sequence', () => {
    const config = readConfig({
      image_sequence: [{ file_path: 'comic/001.jpg', file_name: '001.jpg' }],
    });

    expect(config.source_type).toBe('image-sequence');
    expect(config.image_sequence).toHaveLength(1);
  });

  it('图片条目：非法路径剔除、id 与文件名按位次补齐', () => {
    const config = readConfig({
      image_sequence: [
        { file_path: 'comic/001.jpg' },
        { file_path: '../escape.jpg' },
        { id: 'keep', file_path: 'comic/003.jpg', file_name: '第三页', entry_time: 3 },
        { file_path: 42 },
      ],
    });

    expect(config.image_sequence.map((image) => image.id)).toEqual(['book-image-1', 'keep']);
    expect(config.image_sequence[0]?.file_name).toBe('001.jpg');
    expect(config.image_sequence[1]?.file_name).toBe('第三页');
    expect(config.image_sequence[1]?.entry_time).toBe(3);
  });

  it('资源引用收紧：反斜杠、绝对路径与带 scheme 引用一律拒绝', () => {
    const config = readConfig({
      book_file: 'books\\demo.epub',
      cover_image: '/abs/cover.jpg',
      image_sequence: [{ file_path: 'https://cdn.example.com/a.jpg' }],
    });

    expect(config.book_file).toBe('');
    expect(config.cover_image).toBe('');
    expect(config.image_sequence).toHaveLength(0);
  });

  it('book_format 归一小写并折叠 markdown 别名', () => {
    expect(readConfig({ book_format: ' EPUB3 ' }).book_format).toBe('epub3');
    expect(readConfig({ book_format: '.Markdown' }).book_format).toBe('md');
    expect(readConfig({ book_format: 'CBZ' }).book_format).toBe('cbz');
  });
});

describe('validateConfig（与 schema 同口径：出现即校验）', () => {
  it('接受空配置与未提供配置', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig(null)).toBe(true);
    expect(validateConfig({})).toBe(true);
  });

  it('接受类型合法的完整配置', () => {
    expect(validateConfig(FULL_EBOOK_CONFIG)).toBe(true);
    expect(validateConfig({
      source_type: 'image-sequence',
      image_sequence: [{ id: 'one', file_path: 'comic/001.jpg', file_name: '001.jpg' }],
      image_sort_basis: 'entry-time',
    })).toBe(true);
  });

  it('拒绝非对象与字段类型错误', () => {
    expect(validateConfig('book')).toBe(false);
    expect(validateConfig(['book'])).toBe(false);
    expect(validateConfig({ source_type: 'paper' })).toBe(false);
    expect(validateConfig({ image_sort_basis: 'random' })).toBe(false);
    expect(validateConfig({ book_name: 1 })).toBe(false);
    expect(validateConfig({ image_sequence: {} })).toBe(false);
    expect(validateConfig({ image_sequence: ['comic/001.jpg'] })).toBe(false);
    expect(validateConfig({ image_sequence: [{ id: 1, file_path: 'a.jpg' }] })).toBe(false);
    expect(validateConfig({ image_sequence: [{ file_path: 'a.jpg', entry_time: 'x' }] })).toBe(false);
    expect(validateConfig({ image_sequence: [{ id: 'x', file_path: '' }] })).toBe(false);
  });

  it('非空资源路径必须是合法包内相对路径', () => {
    expect(validateConfig({ book_file: 'books/demo.epub' })).toBe(true);
    expect(validateConfig({ book_file: '../escape.epub' })).toBe(false);
    expect(validateConfig({ cover_image: 'a\\b.jpg' })).toBe(false);
    expect(validateConfig({ cover_image: 'https://cdn.example.com/a.jpg' })).toBe(false);
    expect(validateConfig({ book_file: './books/demo.epub' })).toBe(true);
  });

  it('非空 book_format 必须是受支持格式', () => {
    expect(validateConfig({ book_format: 'epub' })).toBe(true);
    expect(validateConfig({ book_format: 'cbz' })).toBe(true);
    expect(validateConfig({ book_format: 'lit' })).toBe(false);
  });

  it('ebook 且书籍文件已填时必须记录格式', () => {
    expect(validateConfig({ source_type: 'ebook', book_file: 'books/demo.epub' })).toBe(false);
    expect(validateConfig({
      source_type: 'ebook',
      book_file: 'books/demo.epub',
      book_format: 'epub',
    })).toBe(true);
  });

  it('image-sequence 不能同时保留普通电子书文件', () => {
    expect(validateConfig({
      source_type: 'image-sequence',
      book_file: 'books/demo.epub',
      book_format: 'epub',
    })).toBe(false);
  });
});

describe('展示派生', () => {
  it('标题：书名优先，其次文件名去扩展名', () => {
    expect(deriveDisplayTitle(readConfig({ book_name: '示例书籍' }))).toBe('示例书籍');
    expect(deriveDisplayTitle(readConfig({ book_file: 'books/demo.epub' }))).toBe('demo');
    expect(deriveDisplayTitle(readConfig(undefined))).toBe('');
  });

  it('作者：留空回退空串', () => {
    expect(deriveDisplayAuthor(readConfig({ book_author: ' 艾丽丝 ' }))).toBe('艾丽丝');
    expect(deriveDisplayAuthor(readConfig(undefined))).toBe('');
  });

  it('格式标签：电子书大写，图片包区分 ZIP/CBZ', () => {
    expect(formatBookFormatLabel(readConfig({ book_format: 'epub' }))).toBe('EPUB');
    expect(formatBookFormatLabel(readConfig({
      source_type: 'image-sequence',
      book_format: 'cbz',
    }))).toBe('CBZ');
    expect(formatBookFormatLabel(readConfig({
      source_type: 'image-sequence',
      book_format: 'zip',
    }))).toBe('ZIP');
  });
});

describe('buildBookOpenRequest（14 §5.4 载荷）', () => {
  it('ebook 臂：主资源为书籍文件并携带 epub MIME', () => {
    const request = buildBookOpenRequest(readConfig(FULL_EBOOK_CONFIG));

    expect(request).not.toBeNull();
    expect(request!.intent).toBe('view');
    expect(request!.resource.uri).toBe('books/demo.epub');
    expect(request!.resource.mimeType).toBe('application/epub+zip');
    expect(request!.resource.fileName).toBe('demo.epub');
    expect(request!.resource.title).toBe('示例书籍');
    expect(request!.resource.payload).toEqual({
      kind: 'chips.book-card',
      version: '1.0.0',
      cardType: 'base.book',
      mode: 'ebook',
      resources: {
        book: {
          uri: 'books/demo.epub',
          relativePath: 'books/demo.epub',
          fileName: 'demo.epub',
          mimeType: 'application/epub+zip',
        },
      },
      display: { title: '示例书籍', author: '艾丽丝' },
    });
  });

  it('image-sequence 臂：主资源为排序后序列首项并全量随载荷', () => {
    const request = buildBookOpenRequest(readConfig({
      source_type: 'image-sequence',
      book_name: '漫画',
      image_sequence: [
        { id: 'two', file_path: 'comic/002.jpg', entry_time: 2 },
        { id: 'one', file_path: 'comic/001.jpg', entry_time: 1 },
      ],
      image_sort_basis: 'entry-time',
    }));

    expect(request).not.toBeNull();
    expect(request!.resource.uri).toBe('comic/001.jpg');
    expect(request!.resource.mimeType).toBe('image/jpeg');
    const payload = request!.resource.payload;
    expect(payload.mode).toBe('image-sequence');
    expect(payload.resources.images?.map((image) => image.uri)).toEqual([
      'comic/001.jpg',
      'comic/002.jpg',
    ]);
    expect(payload.resources.book).toBeUndefined();
    expect(payload.display.author).toBeUndefined();
  });

  it('无主资源时返回 null', () => {
    expect(buildBookOpenRequest(readConfig(undefined))).toBeNull();
  });
});

describe('主入口纯函数', () => {
  it('createInitialContent 返回可校验的空配置内容', () => {
    const content = createInitialContent();

    expect(content['card_type']).toBe('base.book');
    expect(validateConfig(content['config'])).toBe(true);
  });

  it('collectResourcePaths 去重且稳定排序', () => {
    const paths = collectResourcePaths(createBasecard(buildContent(readConfig({
      ...FULL_EBOOK_CONFIG,
      cover_image: 'books/demo.epub',
    }))));

    expect(paths).toEqual(['books/demo.epub']);
    expect(collectResourcePaths(createBasecard(buildContent(readConfig(FULL_EBOOK_CONFIG))))).toEqual([
      'books/demo.epub',
      'covers/demo.jpg',
    ]);
  });
});

describe('sortImageItems', () => {
  it('entry-time 优先且缺时间项排后，同名保序兜底', () => {
    const images = readConfig({
      image_sequence: [
        { id: 'a', file_path: 'c/003.jpg', entry_time: 3 },
        { id: 'b', file_path: 'a/001.jpg', entry_time: 1 },
        { id: 'c', file_path: 'b/002.jpg' },
      ],
    }).image_sequence;

    expect(sortImageItems(images, 'entry-time').map((image) => image.id)).toEqual(['b', 'a', 'c']);
    expect(sortImageItems(images, 'filename').map((image) => image.id)).toEqual(['b', 'c', 'a']);
  });
});
