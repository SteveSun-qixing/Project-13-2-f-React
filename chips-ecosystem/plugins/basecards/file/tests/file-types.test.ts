import { describe, expect, it } from 'vitest';
import {
  FILE_CATEGORY_ORDER,
  inferFileMimeType,
  normalizeExtension,
  resolveFileCategory,
} from '../src/shared/file-types';
import { FILE_CATEGORY_COVER_URLS, resolveCategoryCoverUrl } from '../src/shared/default-covers';

/**
 * 文件类型判定表（《01-卡片文件格式》§6.9：按后缀解析 9 类别 → 类别默认封面，
 * MIME 由插件按后缀内置映射表推断）。
 *
 * 判定表逐项钉死旧族迁移语义；类别登记先序 = FILE_CATEGORY_ORDER（video 先于 code），
 * 同一后缀多类登记时先登记者胜：`ts`/`mts` 归 video（传输流）、`cts` 归 code——迁移保真。
 */

describe('FILE_CATEGORY_ORDER', () => {
  it('9 个类别与登记先序稳定', () => {
    expect([...FILE_CATEGORY_ORDER]).toEqual([
      'document',
      'spreadsheet',
      'presentation',
      'archive',
      'audio',
      'video',
      'image',
      'text',
      'code',
    ]);
  });
});

describe('normalizeExtension', () => {
  it.each([
    ['pdf', 'pdf'],
    ['.PDF', 'pdf'],
    ['  Ts  ', 'ts'],
    ['.tar.gz', 'targz'],
    ['', ''],
    ['   ', ''],
    [undefined, ''],
    [null, ''],
    [42, ''],
  ])('normalizeExtension(%j) → %j', (input, expected) => {
    expect(normalizeExtension(input)).toBe(expected);
  });
});

describe('resolveFileCategory 判定表', () => {
  it.each([
    ['pdf', 'document'],
    ['docx', 'document'],
    ['dotx', 'document'],
    ['odt', 'document'],
    ['rtf', 'document'],
    ['pages', 'document'],
    ['epub', 'document'],
    ['mobi', 'document'],
    ['djvu', 'document'],
    ['xls', 'spreadsheet'],
    ['xlsx', 'spreadsheet'],
    ['csv', 'spreadsheet'],
    ['tsv', 'spreadsheet'],
    ['ods', 'spreadsheet'],
    ['numbers', 'spreadsheet'],
    ['ppt', 'presentation'],
    ['pptx', 'presentation'],
    ['odp', 'presentation'],
    ['key', 'presentation'],
    ['zip', 'archive'],
    ['7z', 'archive'],
    ['tar', 'archive'],
    ['gz', 'archive'],
    ['cbz', 'archive'],
    ['iso', 'archive'],
    ['dmg', 'archive'],
    ['mp3', 'audio'],
    ['flac', 'audio'],
    ['m4a', 'audio'],
    ['opus', 'audio'],
    ['mid', 'audio'],
    ['aiff', 'audio'],
    ['mp4', 'video'],
    ['mkv', 'video'],
    ['mov', 'video'],
    ['webm', 'video'],
    ['avi', 'video'],
    ['3gp', 'video'],
    ['png', 'image'],
    ['jpg', 'image'],
    ['svg', 'image'],
    ['heic', 'image'],
    ['psd', 'image'],
    ['ico', 'image'],
    ['txt', 'text'],
    ['md', 'text'],
    ['markdown', 'text'],
    ['srt', 'text'],
    ['lrc', 'text'],
    ['log', 'text'],
    ['tsx', 'code'],
    ['json', 'code'],
    ['html', 'code'],
    ['py', 'code'],
    ['rs', 'code'],
    ['cpp', 'code'],
    ['sh', 'code'],
    ['yaml', 'code'],
    ['sql', 'code'],
    ['dockerfile', 'code'],
    ['graphql', 'code'],
  ])('resolveFileCategory(%j) → %j', (extension, expected) => {
    expect(resolveFileCategory(extension)).toBe(expected);
  });

  it('类别登记先序裁决：video 先于 code，ts/mts 归 video、cts 归 code（迁移保真）', () => {
    expect(resolveFileCategory('ts')).toBe('video');
    expect(resolveFileCategory('mts')).toBe('video');
    expect(resolveFileCategory('m2ts')).toBe('video');
    expect(resolveFileCategory('cts')).toBe('code');
  });

  it('未登记后缀返回 undefined；空值与非法输入返回 undefined', () => {
    expect(resolveFileCategory('xyz')).toBeUndefined();
    expect(resolveFileCategory('')).toBeUndefined();
    expect(resolveFileCategory('   ')).toBeUndefined();
    expect(resolveFileCategory(undefined as unknown as string)).toBeUndefined();
    expect(resolveFileCategory(123 as unknown as string)).toBeUndefined();
  });

  it('归一先行：带点、大小写与空白不改变判定', () => {
    expect(resolveFileCategory('.PDF')).toBe('document');
    expect(resolveFileCategory(' MP3 ')).toBe('audio');
  });
});

describe('inferFileMimeType 内置映射表', () => {
  it.each([
    ['pdf', 'application/pdf'],
    ['doc', 'application/msword'],
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['odt', 'application/vnd.oasis.opendocument.text'],
    ['rtf', 'application/rtf'],
    ['xls', 'application/vnd.ms-excel'],
    ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['ods', 'application/vnd.oasis.opendocument.spreadsheet'],
    ['csv', 'text/csv'],
    ['tsv', 'text/tab-separated-values'],
    ['ppt', 'application/vnd.ms-powerpoint'],
    ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['odp', 'application/vnd.oasis.opendocument.presentation'],
    ['zip', 'application/zip'],
    ['rar', 'application/vnd.rar'],
    ['7z', 'application/x-7z-compressed'],
    ['tar', 'application/x-tar'],
    ['gz', 'application/gzip'],
    ['bz2', 'application/x-bzip2'],
    ['xz', 'application/x-xz'],
    ['iso', 'application/x-iso9660-image'],
    ['dmg', 'application/x-apple-diskimage'],
    ['mp3', 'audio/mpeg'],
    ['wav', 'audio/wav'],
    ['flac', 'audio/flac'],
    ['m4a', 'audio/mp4'],
    ['aac', 'audio/aac'],
    ['ogg', 'audio/ogg'],
    ['opus', 'audio/opus'],
    ['mid', 'audio/midi'],
    ['mp4', 'video/mp4'],
    ['mov', 'video/quicktime'],
    ['mkv', 'video/x-matroska'],
    ['avi', 'video/x-msvideo'],
    ['webm', 'video/webm'],
    ['wmv', 'video/x-ms-wmv'],
    ['3gp', 'video/3gpp'],
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['gif', 'image/gif'],
    ['webp', 'image/webp'],
    ['bmp', 'image/bmp'],
    ['svg', 'image/svg+xml'],
    ['tif', 'image/tiff'],
    ['tiff', 'image/tiff'],
    ['avif', 'image/avif'],
    ['heic', 'image/heic'],
    ['ico', 'image/x-icon'],
    ['psd', 'image/vnd.adobe.photoshop'],
    ['txt', 'text/plain'],
    ['md', 'text/markdown'],
    ['markdown', 'text/markdown'],
    ['html', 'text/html'],
    ['css', 'text/css'],
    ['js', 'text/javascript'],
    ['json', 'application/json'],
    ['xml', 'application/xml'],
    ['yaml', 'application/yaml'],
    ['yml', 'application/yaml'],
    ['toml', 'application/toml'],
    ['epub', 'application/epub+zip'],
  ])('inferFileMimeType(%j) → %j', (extension, expected) => {
    expect(inferFileMimeType(extension)).toBe(expected);
  });

  it('未登记 MIME 的后缀返回 undefined；归一先行', () => {
    expect(inferFileMimeType('xyz')).toBeUndefined();
    expect(inferFileMimeType('key')).toBeUndefined();
    expect(inferFileMimeType('.PDF')).toBe('application/pdf');
    expect(inferFileMimeType('')).toBeUndefined();
  });
});

describe('类别默认封面映射', () => {
  it('9 个类别封面全部内联且非空', () => {
    expect(Object.keys(FILE_CATEGORY_COVER_URLS).sort()).toEqual([...FILE_CATEGORY_ORDER].sort());
    for (const category of FILE_CATEGORY_ORDER) {
      expect(FILE_CATEGORY_COVER_URLS[category].length).toBeGreaterThan(0);
      expect(FILE_CATEGORY_COVER_URLS[category].startsWith('data:')).toBe(true);
    }
  });

  it('resolveCategoryCoverUrl：已知类别返回对应封面，未知返回空串', () => {
    expect(resolveCategoryCoverUrl(undefined)).toBe('');
    expect(resolveCategoryCoverUrl('document')).toBe(FILE_CATEGORY_COVER_URLS['document']);
    expect(resolveCategoryCoverUrl('code')).toBe(FILE_CATEGORY_COVER_URLS['code']);
  });
});
