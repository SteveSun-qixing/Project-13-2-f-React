import { describe, expect, it } from 'vitest';
import { extractZipEntry, parseZipEntries } from '../src/shared/archive';
import { createDeflateZip, createStoredZip, createZipWithMethod, JPEG_BYTES, PNG_BYTES } from './helpers/zip';

/**
 * ZIP 解析测试：全部夹具为测试内构造的**真实字节**（最小合法 ZIP），
 * 断言走解析器真实解码路径，不 mock 解析器。
 */

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

describe('parseZipEntries（中央目录解析）', () => {
  it('解析 store 条目的中央目录元数据', () => {
    const zip = createStoredZip([
      { path: 'comic/002.jpg', data: JPEG_BYTES, modifiedAt: new Date('2026-01-02T10:00:00') },
      { path: 'comic/readme.txt', data: 'ignore' },
    ]);

    const entries = parseZipEntries(toArrayBuffer(zip));

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      path: 'comic/002.jpg',
      fileName: '002.jpg',
      compressionMethod: 0,
      isDirectory: false,
    });
    expect(entries[0]?.entryTime).toBeTypeOf('number');
  });

  it('保留条目 DOS 修改时间用于序列排序', () => {
    const zip = createStoredZip([
      { path: 'comic/003.jpg', data: JPEG_BYTES, modifiedAt: new Date('2026-01-03T00:00:00') },
      { path: 'comic/001.jpg', data: JPEG_BYTES, modifiedAt: new Date('2026-01-01T00:00:00') },
    ]);

    const entries = parseZipEntries(toArrayBuffer(zip));

    expect(entries.map((entry) => entry.entryTime)).toEqual([expect.any(Number), expect.any(Number)]);
    expect(((entries[0]?.entryTime) ?? 0) > ((entries[1]?.entryTime) ?? 0)).toBe(true);
  });

  it('识别目录条目（路径以 / 结尾）', () => {
    const zip = createStoredZip([
      { path: 'comic/', data: '' },
      { path: 'comic/001.jpg', data: JPEG_BYTES },
    ]);

    const entries = parseZipEntries(toArrayBuffer(zip));

    expect(entries.find((entry) => entry.path === 'comic/')?.isDirectory).toBe(true);
    expect(entries.find((entry) => entry.path === 'comic/001.jpg')?.isDirectory).toBe(false);
  });

  it('按 UTF-8 标志解码中文文件名', () => {
    const zip = createStoredZip([{ path: 'comic/中国-封面.jpg', data: JPEG_BYTES, utf8: true }]);

    const entries = parseZipEntries(toArrayBuffer(zip));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe('comic/中国-封面.jpg');
    expect(entries[0]?.fileName).toBe('中国-封面.jpg');
  });

  it('非 UTF-8 标志文件名按 CP437 码页解码', () => {
    const zip = createStoredZip([
      {
        path: 'comic/Übung-é.jpg',
        rawName: new Uint8Array([
          0x63, 0x6f, 0x6d, 0x69, 0x63, 0x2f, 0x9a, 0x62, 0x75, 0x6e, 0x67, 0x2d, 0x82, 0x2e,
          0x6a, 0x70, 0x67,
        ]),
        utf8: false,
        data: JPEG_BYTES,
      },
    ]);

    const entries = parseZipEntries(toArrayBuffer(zip));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.path).toBe('comic/Übung-é.jpg');
    expect(entries[0]?.fileName).toBe('Übung-é.jpg');
  });

  it('过滤目录穿越与非法条目路径', () => {
    const zip = createStoredZip([
      { path: '../evil.jpg', data: JPEG_BYTES },
      { path: 'a/../../escape.jpg', data: JPEG_BYTES },
      { path: 'safe/001.jpg', data: JPEG_BYTES },
    ]);

    const entries = parseZipEntries(toArrayBuffer(zip));

    expect(entries.map((entry) => entry.path)).toEqual(['safe/001.jpg']);
  });

  it('无中央目录时抛出简体中文错误', () => {
    const garbage = new TextEncoder().encode('not a zip file at all........');
    expect(() => parseZipEntries(toArrayBuffer(garbage))).toThrow('找不到 ZIP 中央目录');
  });

  it('中央目录条目签名无效时抛出简体中文错误', () => {
    const zip = createStoredZip([{ path: 'comic/001.jpg', data: JPEG_BYTES }]);
    const buffer = toArrayBuffer(zip);
    const view = new DataView(buffer);
    // 定位 EOCD 取中央目录偏移并破坏签名。
    const centralOffset = view.getUint32(buffer.byteLength - 22 + 16, true);
    view.setUint32(centralOffset, 0xdeadbeef, true);

    expect(() => parseZipEntries(buffer)).toThrow('ZIP 中央目录条目签名无效');
  });
});

describe('extractZipEntry（条目提取）', () => {
  it('提取 store 条目字节', async () => {
    const zip = createStoredZip([
      { path: 'comic/010.jpg', data: JPEG_BYTES },
      { path: 'comic/002.png', data: PNG_BYTES },
      { path: 'comic/readme.txt', data: 'ignore' },
    ]);
    const buffer = toArrayBuffer(zip);
    const entries = parseZipEntries(buffer);
    const pngEntry = entries.find((entry) => entry.path === 'comic/002.png');

    expect(pngEntry).toBeDefined();
    await expect(extractZipEntry(buffer, pngEntry!)).resolves.toEqual(PNG_BYTES);
  });

  it('提取 deflate 条目字节（真实 deflate-raw 压缩夹具）', async () => {
    const zip = await createDeflateZip([
      { path: 'comic/001.jpg', data: JPEG_BYTES },
      { path: 'OEBPS/chapter1.xhtml', data: '<html><body>第一章</body></html>' },
    ]);
    const buffer = toArrayBuffer(zip);
    const entries = parseZipEntries(buffer);
    const xhtmlEntry = entries.find((entry) => entry.path === 'OEBPS/chapter1.xhtml');

    expect(xhtmlEntry?.compressionMethod).toBe(8);
    // 解压产物经运行时流返回，逐字节比较（规避跨 Realm 类型原型差异）。
    const inflated = await extractZipEntry(buffer, xhtmlEntry!);
    expect(Array.from(inflated)).toEqual(Array.from(new TextEncoder().encode('<html><body>第一章</body></html>')));
  });

  it('拒绝不支持的压缩方法', async () => {
    const zip = createZipWithMethod([{ path: 'comic/001.jpg', data: JPEG_BYTES }], 12);
    const buffer = toArrayBuffer(zip);
    const entries = parseZipEntries(buffer);

    await expect(extractZipEntry(buffer, entries[0]!)).rejects.toThrow('不支持的 ZIP 压缩方法');
  });

  it('本地文件头无效时抛出简体中文错误', async () => {
    const zip = createStoredZip([{ path: 'comic/001.jpg', data: JPEG_BYTES }]);
    const buffer = toArrayBuffer(zip);
    const entries = parseZipEntries(buffer);
    const corrupted = new Uint8Array(buffer.byteLength);
    corrupted.set(new Uint8Array(buffer));
    corrupted[0] = 0x00;

    await expect(extractZipEntry(toArrayBuffer(corrupted), entries[0]!)).rejects.toThrow(
      'ZIP 本地文件头无效'
    );
  });
});
