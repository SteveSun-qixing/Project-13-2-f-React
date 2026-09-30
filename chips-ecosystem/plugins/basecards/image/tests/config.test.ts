import { describe, expect, it } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import {
  DEFAULT_CONFIG,
  analyzeImageUrl,
  buildContent,
  buildImageOpenRequest,
  deriveEffectiveLayoutType,
  getGridColumns,
  getGridDisplayLimit,
  getSpacingMetrics,
  inferImageMimeType,
  readConfig,
  validateConfig,
} from '../src/config';
import type {
  IImageConfig,
  IImageItem,
} from '../src/config';
import { createInitialContent, collectResourcePaths } from '../src/main';

function createBasecard(content: Record<string, unknown>): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.image',
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

function createFileItem(overrides: Partial<IImageItem> = {}): IImageItem {
  return {
    id: 'image-1',
    source: 'file',
    file_path: 'photos/hero.png',
    url: '',
    alt: '',
    title: '',
    ...overrides,
  };
}

function createUrlItem(overrides: Partial<IImageItem> = {}): IImageItem {
  return {
    id: 'image-2',
    source: 'url',
    file_path: '',
    url: 'https://example.com/hero.png',
    alt: '',
    title: '',
    ...overrides,
  };
}

describe('validateConfig', () => {
  it('接受未提供配置与空配置', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig(null)).toBe(true);
    expect(validateConfig({})).toBe(true);
  });

  it('接受类型合法的完整配置', () => {
    expect(
      validateConfig(
        buildContent({
          images: [createFileItem(), createUrlItem()],
          layout_type: 'grid',
          layout_options: {
            grid_mode: '3x3',
            single_width_percent: 70,
            single_alignment: 'left',
            spacing_mode: 'none',
          },
        })['config']
      )
    ).toBe(true);
  });

  it('拒绝非对象与结构错误', () => {
    expect(validateConfig('image')).toBe(false);
    expect(validateConfig(['a'])).toBe(false);
    expect(validateConfig({ images: 'many' })).toBe(false);
    expect(validateConfig({ images: [null] })).toBe(false);
    expect(validateConfig({ images: ['x'] })).toBe(false);
    expect(validateConfig({ layout_options: 'x' })).toBe(false);
  });

  it('图片条目字段出现即校验', () => {
    expect(validateConfig({ images: [{ id: '' }] })).toBe(false);
    expect(validateConfig({ images: [{ id: 1 }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'link' }] })).toBe(false);
    expect(validateConfig({ images: [{ alt: 1 }] })).toBe(false);
    expect(validateConfig({ images: [{ title: 2 }] })).toBe(false);
    expect(validateConfig({ images: [{ id: 'a' }] })).toBe(true);
  });

  it('file 来源必须提供合法包内相对路径', () => {
    expect(validateConfig({ images: [{ source: 'file' }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'file', file_path: '' }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'file', file_path: '../escape.png' }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'file', file_path: 'C:\\\\tmp\\\\a.png' }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'file', file_path: 'https://a.com/a.png' }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'file', file_path: 'photos/hero.png' }] })).toBe(true);
  });

  it('url 来源必须提供 http(s)/webdav 地址，data: 禁止持久化', () => {
    expect(validateConfig({ images: [{ source: 'url' }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'url', url: '' }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'url', url: 'ftp://a.com/a.png' }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'url', url: 'javascript:alert(1)' }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'url', url: 'data:image/png;base64,AAAA' }] })).toBe(false);
    expect(validateConfig({ images: [{ source: 'url', url: 'https://a.com/a.png' }] })).toBe(true);
    expect(validateConfig({ images: [{ source: 'url', url: 'http://a.com/a.png' }] })).toBe(true);
    expect(validateConfig({ images: [{ source: 'url', url: 'webdav://cloud.example.com/a.png' }] })).toBe(true);
  });

  it('layout_type 与 layout_options 出现即校验', () => {
    expect(validateConfig({ layout_type: 'mosaic' })).toBe(false);
    expect(validateConfig({ layout_type: 'long-scroll' })).toBe(true);
    expect(validateConfig({ layout_options: { grid_mode: '4x4' } })).toBe(false);
    expect(validateConfig({ layout_options: { spacing_mode: 'dense' } })).toBe(false);
    expect(validateConfig({ layout_options: { single_alignment: 'top' } })).toBe(false);
    expect(validateConfig({ layout_options: { single_width_percent: 5 } })).toBe(false);
    expect(validateConfig({ layout_options: { single_width_percent: 150 } })).toBe(false);
    expect(validateConfig({ layout_options: { single_width_percent: '70' } })).toBe(false);
    expect(validateConfig({ layout_options: { single_width_percent: 10 } })).toBe(true);
    expect(validateConfig({ layout_options: { single_width_percent: 100 } })).toBe(true);
  });
});

describe('readConfig 归一', () => {
  it('缺失与非法字段回退默认值', () => {
    expect(readConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(readConfig('text')).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ images: 'many' })).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ layout_type: 'mosaic' })).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ layout_options: { grid_mode: '4x4', single_alignment: 'top' } })).toEqual({
      images: [],
      layout_type: 'single',
      layout_options: DEFAULT_CONFIG.layout_options,
    });
  });

  it('图片条目补齐完整形状：id 缺失按位次补、来源互斥清空、alt/title 兜底空串', () => {
    expect(
      readConfig({
        images: [
          { source: 'file', file_path: './photos/hero.png', alt: ' 主图 ', url: 'https://a.com/x.png' },
          { source: 'url', url: ' https://example.com/2.png ', title: '备用' },
        ],
      }).images
    ).toEqual([
      { id: 'image-1', source: 'file', file_path: 'photos/hero.png', url: '', alt: '主图', title: '' },
      { id: 'image-2', source: 'url', file_path: '', url: 'https://example.com/2.png', alt: '', title: '备用' },
    ]);
  });

  it('非法路径与非法 URL 字段归一为空串，渲染按占位呈现不阻断', () => {
    expect(readConfig({ images: [{ source: 'file', file_path: '../escape.png' }] }).images[0]?.file_path).toBe('');
    expect(readConfig({ images: [{ source: 'url', url: 'not a url' }] }).images[0]?.url).toBe('not a url');
  });

  it('多于一张图且 layout_type 为 single 时归一改写为 grid（《01》§6.3 补充说明）', () => {
    const config = readConfig({
      layout_type: 'single',
      images: [createFileItem(), createUrlItem()],
    });
    expect(config.layout_type).toBe('grid');
  });

  it('至多一张图时保留声明的布局类型', () => {
    expect(readConfig({ layout_type: 'grid', images: [createFileItem()] }).layout_type).toBe('grid');
    expect(readConfig({ layout_type: 'horizontal-scroll', images: [] }).layout_type).toBe('horizontal-scroll');
  });
});

describe('deriveEffectiveLayoutType', () => {
  it('至多一张图时有效布局恒为 single', () => {
    expect(deriveEffectiveLayoutType(readConfig({ layout_type: 'grid', images: [] }))).toBe('single');
    expect(deriveEffectiveLayoutType(readConfig({ layout_type: 'grid', images: [createFileItem()] }))).toBe('single');
  });

  it('多图时 single 视为 grid，其余布局原样生效', () => {
    expect(
      deriveEffectiveLayoutType(readConfig({ layout_type: 'single', images: [createFileItem(), createUrlItem()] }))
    ).toBe('grid');
    expect(
      deriveEffectiveLayoutType(
        readConfig({ layout_type: 'long-scroll', images: [createFileItem(), createUrlItem()] })
      )
    ).toBe('long-scroll');
  });
});

describe('布局工具', () => {
  it('网格列数与展示上限', () => {
    expect(getGridColumns('2x2')).toBe(2);
    expect(getGridColumns('3x3')).toBe(3);
    expect(getGridColumns('3-column-infinite')).toBe(3);
    expect(getGridDisplayLimit('2x2')).toBe(4);
    expect(getGridDisplayLimit('3x3')).toBe(9);
    expect(getGridDisplayLimit('3-column-infinite')).toBe(Number.POSITIVE_INFINITY);
  });

  it('间距度量：零间距无圆角，舒适间距保留留白与小圆角', () => {
    expect(getSpacingMetrics('none')).toEqual({ gap: 0, radius: 0 });
    expect(getSpacingMetrics('comfortable').gap).toBeGreaterThan(0);
    expect(getSpacingMetrics('comfortable').radius).toBeGreaterThan(0);
  });
});

describe('analyzeImageUrl', () => {
  it('只接受 http(s) 与 webdav，data: 一律拒绝', () => {
    expect(analyzeImageUrl('https://a.com/a.png').valid).toBe(true);
    expect(analyzeImageUrl('http://a.com/a.png').valid).toBe(true);
    expect(analyzeImageUrl('webdav://cloud.example.com/a.png').valid).toBe(true);
    expect(analyzeImageUrl('data:image/png;base64,AAAA').valid).toBe(false);
    expect(analyzeImageUrl('file:///etc/a.png').valid).toBe(false);
    expect(analyzeImageUrl('不是地址').valid).toBe(false);
    expect(analyzeImageUrl('').valid).toBe(false);
  });
});

describe('buildImageOpenRequest（14 §2.2 输入模型，uri 透传内容引用）', () => {
  it('file 来源：uri 为包内相对路径，MIME 按扩展名推断，标题按 标题→替代文本→文件名 兜底', () => {
    const request = buildImageOpenRequest(
      createFileItem({ file_path: 'photos/hero.png', title: '主图', alt: '主图替代文本' })
    );
    expect(request).not.toBeNull();
    expect(request!.intent).toBe('view');
    expect(request!.resource.uri).toBe('photos/hero.png');
    expect(request!.resource.mimeType).toBe('image/png');
    expect(request!.resource.fileName).toBe('hero.png');
    expect(request!.resource.title).toBe('主图');
  });

  it('标题与替代文本缺失时以文件名兜底', () => {
    const request = buildImageOpenRequest(createFileItem({ file_path: 'photos/hero.png' }));
    expect(request!.resource.title).toBe('hero.png');
  });

  it('url 来源：uri 透传远程地址，MIME 从路径推断，webdav 同样可打开', () => {
    const request = buildImageOpenRequest(createUrlItem({ url: 'https://example.com/pic/night.avif' }));
    expect(request!.resource.uri).toBe('https://example.com/pic/night.avif');
    expect(request!.resource.mimeType).toBe('image/avif');
    expect(request!.resource.fileName).toBe('night.avif');
    expect(buildImageOpenRequest(createUrlItem({ url: 'webdav://cloud.example.com/a.tif' }))!.resource.mimeType).toBe(
      'image/tiff'
    );
  });

  it('引用为空时返回 null（不可打开臂）', () => {
    expect(buildImageOpenRequest(createFileItem({ file_path: '' }))).toBeNull();
    expect(buildImageOpenRequest(createUrlItem({ url: '' }))).toBeNull();
  });
});

describe('MIME 推断', () => {
  it('覆盖官方图片查看器声明的全套类型（《09》§5.2）', () => {
    const cases: Array<[string, string]> = [
      ['a.png', 'image/png'],
      ['a.jpg', 'image/jpeg'],
      ['a.jpeg', 'image/jpeg'],
      ['a.webp', 'image/webp'],
      ['a.gif', 'image/gif'],
      ['a.bmp', 'image/bmp'],
      ['a.svg', 'image/svg+xml'],
      ['a.avif', 'image/avif'],
      ['a.tif', 'image/tiff'],
      ['a.tiff', 'image/tiff'],
    ];
    for (const [name, mime] of cases) {
      expect(inferImageMimeType(`p/${name}`)).toBe(mime);
    }
    expect(inferImageMimeType('p/a.txt')).toBeUndefined();
    expect(inferImageMimeType('p/no-extension')).toBeUndefined();
  });
});

describe('主进程纯函数', () => {
  it('createInitialContent 通过 validateConfig 且为可渲染的空配置', () => {
    const content = createInitialContent();
    expect(content['card_type']).toBe('base.image');
    expect(validateConfig(content['config'])).toBe(true);
    expect(readConfig(content['config'])).toEqual(DEFAULT_CONFIG);
  });

  it('collectResourcePaths 只收 file 来源路径，去重且稳定排序，url 引用不进资源清单', () => {
    const config: IImageConfig = {
      images: [
        createUrlItem({ id: 'a' }),
        createFileItem({ id: 'b', file_path: 'photos/b.png' }),
        createFileItem({ id: 'c', file_path: 'photos/a.png' }),
        createFileItem({ id: 'd', file_path: 'photos/b.png' }),
        createFileItem({ id: 'e', file_path: '../escape.png' }),
      ],
      layout_type: 'grid',
      layout_options: { ...DEFAULT_CONFIG.layout_options },
    };
    expect(collectResourcePaths(createBasecard(buildContent(config)))).toEqual([
      'photos/a.png',
      'photos/b.png',
    ]);
    expect(collectResourcePaths(createBasecard(buildContent(DEFAULT_CONFIG)))).toEqual([]);
  });
});
