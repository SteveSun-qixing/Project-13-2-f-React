import { describe, expect, it } from 'vitest';
import type { IResourceOpenContext } from '@chips/sdk';
import { resolveViewerTarget, type ViewerQueueItem } from '../src/domain/viewer-target';

function singleContext(overrides: Partial<IResourceOpenContext> = {}): IResourceOpenContext {
  return {
    intent: 'view',
    origin: 'frame',
    uri: 'chips-resource://ws/demo/report.pdf',
    mimeType: 'application/pdf',
    slot: 'mime:application/pdf',
    fileName: 'report.pdf',
    ...overrides,
  };
}

describe('resolveViewerTarget（14-资源打开与默认处理器契约 §5 消费规则）', () => {
  it('单资源投递建立单项目标，uri 是唯一读取入口', () => {
    const target = resolveViewerTarget(singleContext());
    expect(target).not.toBeNull();
    expect(target?.items).toHaveLength(1);
    expect(target?.items[0]?.uri).toBe('chips-resource://ws/demo/report.pdf');
    expect(target?.items[0]?.fileName).toBe('report.pdf');
    expect(target?.items[0]?.mimeType).toBe('application/pdf');
    expect(target?.initialIndex).toBe(0);
  });

  it('展示字段缺失时按自身能力回补，不因缺失拒绝', () => {
    const context: IResourceOpenContext = {
      intent: 'view',
      origin: 'frame',
      uri: 'chips-resource://ws/demo/blob.dat',
      mimeType: '',
      slot: 'mime:',
    };
    const target = resolveViewerTarget(context);
    expect(target).not.toBeNull();
    const item = target?.items[0] as ViewerQueueItem;
    expect(item.uri).toBe('chips-resource://ws/demo/blob.dat');
    expect(item.fileName).toBe('blob.dat');
    expect(item.mimeType).toBeUndefined();
  });

  it('uri 空白时返回 null（无读取入口）', () => {
    expect(resolveViewerTarget(singleContext({ uri: '   ' }))).toBeNull();
  });

  it('图包载荷按 resources.images 建队，主资源命中项为初始位置', () => {
    const target = resolveViewerTarget(
      singleContext({
        uri: 'chips-resource://book/p/002.png',
        payload: {
          kind: 'chips.book-card',
          version: '1.0.0',
          cardType: 'base.book',
          mode: 'image-sequence',
          resources: {
            images: [
              { uri: 'chips-resource://book/p/001.png', relativePath: 'p/001.png' },
              { uri: 'chips-resource://book/p/002.png', relativePath: 'p/002.png' },
            ],
          },
          display: { title: '图包画册' },
        },
      })
    );
    expect(target).not.toBeNull();
    expect(target?.items).toHaveLength(2);
    expect(target?.initialIndex).toBe(1);
    expect(target?.title).toBe('图包画册');
    expect(target?.items[0]?.relativePath).toBe('p/001.png');
  });

  it('主资源未命中序列时防御性回退首项', () => {
    const target = resolveViewerTarget(
      singleContext({
        uri: 'chips-resource://book/p/003.png',
        payload: {
          kind: 'chips.book-card',
          version: '1.2.0',
          cardType: 'base.book',
          mode: 'image-sequence',
          resources: {
            images: [
              { uri: 'chips-resource://book/p/001.png' },
              { uri: 'chips-resource://book/p/002.png' },
            ],
          },
        },
      })
    );
    expect(target?.initialIndex).toBe(0);
  });

  it('不兼容载荷（kind/version/mode 不符或 images 空）被忽略后按主资源打开', () => {
    const base = {
      resources: { images: [{ uri: 'chips-resource://book/p/001.png' }] },
    };
    const incompatiblePayloads: readonly Readonly<Record<string, unknown>>[] = [
      { ...base, kind: 'chips.other-card', version: '1.0.0', cardType: 'base.book', mode: 'image-sequence' },
      { ...base, kind: 'chips.book-card', version: '2.0.0', cardType: 'base.book', mode: 'image-sequence' },
      { ...base, kind: 'chips.book-card', version: '1.0.0', cardType: 'base.note', mode: 'image-sequence' },
      { ...base, kind: 'chips.book-card', version: '1.0.0', cardType: 'base.book', mode: 'gallery' },
      { kind: 'chips.book-card', version: '1.0.0', cardType: 'base.book', mode: 'image-sequence', resources: { images: [] } },
    ];
    for (const payload of incompatiblePayloads) {
      const target = resolveViewerTarget(singleContext({ payload }));
      expect(target?.items).toHaveLength(1);
      expect(target?.items[0]?.uri).toBe('chips-resource://ws/demo/report.pdf');
    }
  });

  it('载荷条目缺 uri 的被丢弃，全部无效时按主资源打开', () => {
    const dropped = resolveViewerTarget(
      singleContext({
        payload: {
          kind: 'chips.book-card',
          version: '1.0.0',
          cardType: 'base.book',
          mode: 'image-sequence',
          resources: { images: [{ relativePath: 'p/001.png' }, { uri: 'chips-resource://book/p/002.png' }] },
        },
      })
    );
    expect(dropped?.items).toHaveLength(1);
    expect(dropped?.items[0]?.uri).toBe('chips-resource://book/p/002.png');

    const allInvalid = resolveViewerTarget(
      singleContext({
        payload: {
          kind: 'chips.book-card',
          version: '1.0.0',
          cardType: 'base.book',
          mode: 'image-sequence',
          resources: { images: [{ relativePath: 'p/001.png' }] },
        },
      })
    );
    expect(allInvalid?.items).toHaveLength(1);
    expect(allInvalid?.items[0]?.uri).toBe('chips-resource://ws/demo/report.pdf');
  });
});
