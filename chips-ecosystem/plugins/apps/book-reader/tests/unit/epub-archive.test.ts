import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { openEpubArchive } from '../../src/domain/epub/archive';

/**
 * EPUB 归档门面测试：全部夹具为测试内构造的**真实字节** ZIP（node:zlib deflateRawSync），
 * 断言门面在 `@chips/plugin-book` 共享 ZIP 解析之上的读取、缓存与安全路径语义。
 */

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

const writeUInt16LE = (value: number): Buffer => {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
};

const writeUInt32LE = (value: number): Buffer => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
};

function crc32Of(content: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 0;
    }
    table[index] = value;
  }
  return table;
})();

function createZipBuffer(
  entries: Array<{
    path: string;
    content: Buffer;
    compressionMethod?: 0 | 8;
  }>
): Uint8Array {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.path, 'utf-8');
    const compressionMethod = entry.compressionMethod ?? 0;
    const compressedData =
      compressionMethod === 8 ? zlib.deflateRawSync(entry.content) : entry.content;

    const localHeader = Buffer.concat([
      writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE),
      writeUInt16LE(20),
      writeUInt16LE(0),
      writeUInt16LE(compressionMethod),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(crc32Of(entry.content)),
      writeUInt32LE(compressedData.length),
      writeUInt32LE(entry.content.length),
      writeUInt16LE(fileName.length),
      writeUInt16LE(0),
      fileName,
      compressedData,
    ]);
    localChunks.push(localHeader);

    const centralEntry = Buffer.concat([
      writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE),
      writeUInt16LE(20),
      writeUInt16LE(20),
      writeUInt16LE(0),
      writeUInt16LE(compressionMethod),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(crc32Of(entry.content)),
      writeUInt32LE(compressedData.length),
      writeUInt32LE(entry.content.length),
      writeUInt16LE(fileName.length),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(0),
      writeUInt32LE(offset),
      fileName,
    ]);
    centralChunks.push(centralEntry);

    offset += localHeader.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const eocd = Buffer.concat([
    writeUInt32LE(EOCD_SIGNATURE),
    writeUInt16LE(0),
    writeUInt16LE(0),
    writeUInt16LE(entries.length),
    writeUInt16LE(entries.length),
    writeUInt32LE(centralDirectory.length),
    writeUInt32LE(offset),
    writeUInt16LE(0),
  ]);

  return new Uint8Array(Buffer.concat([...localChunks, centralDirectory, eocd]));
}

describe('EpubArchive', () => {
  it('能读取 store-only ZIP 中的文本资源', async () => {
    const archive = await openEpubArchive(
      createZipBuffer([
        {
          path: 'META-INF/container.xml',
          content: Buffer.from('<rootfiles />', 'utf-8'),
        },
      ])
    );

    await expect(archive.readText('META-INF/container.xml')).resolves.toBe('<rootfiles />');
  });

  it('能读取 deflate 压缩的章节内容', async () => {
    const archive = await openEpubArchive(
      createZipBuffer([
        {
          path: 'OPS/text/chapter-1.xhtml',
          content: Buffer.from('<h1>Hello</h1>', 'utf-8'),
          compressionMethod: 8,
        },
      ])
    );

    await expect(archive.readText('OPS/text/chapter-1.xhtml')).resolves.toBe('<h1>Hello</h1>');
  });

  it('不存在或目录条目读取时以简体中文报错', async () => {
    const archive = await openEpubArchive(
      createZipBuffer([
        { path: 'META-INF/container.xml', content: Buffer.from('<rootfiles />', 'utf-8') },
      ])
    );

    await expect(archive.readText('OPS/missing.xhtml')).rejects.toThrow('EPUB 资源不存在');
  });

  it('共享解析过滤不安全路径条目：穿越条目不进入条目表', async () => {
    const archive = await openEpubArchive(
      createZipBuffer([
        {
          path: '../evil.xhtml',
          content: Buffer.from('nope', 'utf-8'),
        },
        {
          path: 'OPS/safe.xhtml',
          content: Buffer.from('<p>safe</p>', 'utf-8'),
        },
      ])
    );

    expect(archive.hasEntry('../evil.xhtml')).toBe(false);
    expect(archive.hasEntry('OPS/safe.xhtml')).toBe(true);
    expect(archive.listEntries().map((entry) => entry.path)).toEqual(['OPS/safe.xhtml']);
  });

  it('二进制读取按路径归一命中并返回原始字节', async () => {
    const content = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const archive = await openEpubArchive(
      createZipBuffer([{ path: 'OPS/images/cover.png', content }])
    );

    const bytes = await archive.readBinary('./OPS/images/cover.png');
    expect(Array.from(bytes)).toEqual([...content]);
  });
});
