import { describe, expect, it } from 'vitest';
import type { IResourceOpenContext } from '@chips/sdk';
import { inferImageMimeTypeFromPath, resolveImageQueue } from '../src/viewer/openQueue';

/**
 * 打开投递 → 图片队列解析测试：对应《14-资源打开与默认处理器契约》§5.1/§5.2/§5.4
 * 的消费规则（单图主资源、`chips.book-card` image-sequence 图包载荷、相对路径不参与读取）。
 */
function createContext(overrides: Record<string, unknown> = {}): IResourceOpenContext {
  return {
    intent: 'view',
    origin: 'frame',
    uri: 'chips-resource://workspace/demo/photo.png',
    mimeType: 'image/png',
    slot: 'mime:image/png',
    ...overrides,
  };
}

describe('resolveImageQueue：单图主资源', () => {
  it('空白 uri 返回 null（无法建立读取入口）', () => {
    expect(resolveImageQueue(createContext({ uri: '   ' }))).toBeNull();
  });

  it('无业务载荷时按主资源建立单图队列并回退展示名', () => {
    const queue = resolveImageQueue(createContext({}));
    expect(queue).not.toBeNull();
    expect(queue?.images).toHaveLength(1);
    expect(queue?.images[0]?.uri).toBe('chips-resource://workspace/demo/photo.png');
    expect(queue?.images[0]?.fileName).toBe('photo.png');
    expect(queue?.images[0]?.mimeType).toBe('image/png');
    expect(queue?.initialIndex).toBe(0);
    expect(queue?.title).toBeUndefined();
  });

  it('fileName / title 展示字段原样透传', () => {
    const queue = resolveImageQueue(createContext({ fileName: '示例.png', title: '旅行照片' }));
    expect(queue?.images[0]?.fileName).toBe('示例.png');
    expect(queue?.title).toBe('旅行照片');
    expect(queue?.images[0]?.title).toBe('旅行照片');
  });

  it('载荷内引用不参与读取入口（uri 是唯一读取入口，《14》§5.2）', () => {
    const queue = resolveImageQueue(
      createContext({
        payload: {
          kind: 'chips.book-card',
          version: '1.0.0',
          cardType: 'base.book',
          mode: 'image-sequence',
          resources: {},
        },
      }),
    );
    expect(queue?.images[0]?.uri).toBe('chips-resource://workspace/demo/photo.png');
  });
});

describe('resolveImageQueue：图包载荷（image-sequence）', () => {
  const sequencePayload = {
    kind: 'chips.book-card',
    version: '1.0.0',
    cardType: 'base.book',
    mode: 'image-sequence',
    resources: {
      images: [
        { uri: 'chips-resource://book/p/001.png', relativePath: 'p/001.png' },
        { uri: 'chips-resource://book/p/002.png', relativePath: 'p/002.png', fileName: '第二页.png' },
        { uri: 'chips-resource://book/p/003.png', relativePath: 'p/003.png', mimeType: 'image/jpeg' },
      ],
    },
    display: { title: '图包画册' },
  };

  it('按 resources.images 顺序建立队列，主资源（序列首项）命中初始下标', () => {
    const queue = resolveImageQueue(
      createContext({ uri: 'chips-resource://book/p/001.png', payload: sequencePayload }),
    );
    expect(queue?.images.map((image) => image.uri)).toEqual([
      'chips-resource://book/p/001.png',
      'chips-resource://book/p/002.png',
      'chips-resource://book/p/003.png',
    ]);
    expect(queue?.initialIndex).toBe(0);
    expect(queue?.title).toBe('图包画册');
  });

  it('条目 fileName 缺席时按 uri 回退、mimeType 缺席时按扩展名推断', () => {
    const queue = resolveImageQueue(
      createContext({ uri: 'chips-resource://book/p/001.png', payload: sequencePayload }),
    );
    expect(queue?.images[0]?.fileName).toBe('001.png');
    expect(queue?.images[0]?.mimeType).toBe('image/png');
    expect(queue?.images[1]?.fileName).toBe('第二页.png');
    expect(queue?.images[2]?.mimeType).toBe('image/jpeg');
  });

  it('relativePath 仅随条目保留（展示与日志），不改变读取 uri', () => {
    const queue = resolveImageQueue(
      createContext({ uri: 'chips-resource://book/p/002.png', payload: sequencePayload }),
    );
    expect(queue?.images[1]?.relativePath).toBe('p/002.png');
    expect(queue?.images[1]?.uri).toBe('chips-resource://book/p/002.png');
  });

  it('主资源不在序列首项时按命中下标定位（防御性收口）', () => {
    const queue = resolveImageQueue(
      createContext({ uri: 'chips-resource://book/p/003.png', payload: sequencePayload }),
    );
    expect(queue?.initialIndex).toBe(2);
  });

  it('主资源未命中任何条目时回退首项', () => {
    const queue = resolveImageQueue(
      createContext({ uri: 'chips-resource://book/other.png', payload: sequencePayload }),
    );
    expect(queue?.initialIndex).toBe(0);
  });

  it('条目缺 uri 被剔除；全部剔除时忽略载荷按单图打开', () => {
    const partial = resolveImageQueue(
      createContext({
        payload: {
          ...sequencePayload,
          resources: {
            images: [{ relativePath: 'p/001.png' }, { uri: 'chips-resource://book/p/002.png' }],
          },
        },
      }),
    );
    expect(partial?.images).toHaveLength(1);
    expect(partial?.images[0]?.uri).toBe('chips-resource://book/p/002.png');

    const emptied = resolveImageQueue(
      createContext({
        payload: { ...sequencePayload, resources: { images: [{ relativePath: 'p/001.png' }] } },
      }),
    );
    expect(emptied?.images).toHaveLength(1);
    expect(emptied?.images[0]?.uri).toBe('chips-resource://workspace/demo/photo.png');
  });

  it('kind / mode / cardType 或版本主版本不符的载荷一律忽略（§5.3 消费规则）', () => {
    const cases: readonly unknown[] = [
      { ...sequencePayload, kind: 'chips.other' },
      { ...sequencePayload, mode: 'ebook' },
      { ...sequencePayload, cardType: 'base.image' },
      { ...sequencePayload, version: '2.0.0' },
      { ...sequencePayload, version: 'not-a-version' },
      { ...sequencePayload, resources: {} },
      { ...sequencePayload, resources: { images: [] } },
      'not-an-object',
    ];
    for (const payload of cases) {
      const queue = resolveImageQueue(createContext({ payload: payload as Record<string, unknown> }));
      expect(queue?.images).toHaveLength(1);
      expect(queue?.images[0]?.uri).toBe('chips-resource://workspace/demo/photo.png');
    }
  });
});

describe('inferImageMimeTypeFromPath', () => {
  it('按支持格式表推断 MIME（大小写不敏感）', () => {
    expect(inferImageMimeTypeFromPath('/tmp/a.PNG')).toBe('image/png');
    expect(inferImageMimeTypeFromPath('/tmp/a.JpEg')).toBe('image/jpeg');
    expect(inferImageMimeTypeFromPath('/tmp/a.webp')).toBe('image/webp');
    expect(inferImageMimeTypeFromPath('/tmp/a.gif')).toBe('image/gif');
    expect(inferImageMimeTypeFromPath('/tmp/a.bmp')).toBe('image/bmp');
    expect(inferImageMimeTypeFromPath('/tmp/a.svg')).toBe('image/svg+xml');
    expect(inferImageMimeTypeFromPath('/tmp/a.avif')).toBe('image/avif');
  });

  it('无扩展名或支持表外扩展名返回 undefined', () => {
    expect(inferImageMimeTypeFromPath('/tmp/noext')).toBeUndefined();
    expect(inferImageMimeTypeFromPath('/tmp/a.tiff')).toBeUndefined();
  });
});
