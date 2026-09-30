import { describe, expect, it } from 'vitest';
import { crc32 } from '../../src/domain/crc32';
import { createIcnsFile } from '../../src/domain/icns';
import { createIcoFile } from '../../src/domain/ico';
import { createZipStore } from '../../src/domain/zip-store';
import { stripExtension, toSafeFileName } from '../../src/domain/file-names';
import { utf8Bytes } from '../../src/domain/binary';

/** 真实 PNG 文件头（8 字节签名 + IHDR 长度域前 4 字节）作为最小载荷夹具。 */
const tinyPng = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

describe('输出文件名归一', () => {
  it('剥离扩展名并归一安全文件名', () => {
    expect(stripExtension('My App Icon.svg')).toBe('My App Icon');
    expect(stripExtension('  demo.icon.v2.png ')).toBe('demo.icon.v2');
    expect(toSafeFileName('My App Icon.svg')).toBe('My-App-Icon.svg');
    expect(toSafeFileName('图标 资源/包')).toBe('icon');
    expect(toSafeFileName('...')).toBe('icon');
    expect(stripExtension('   ')).toBe('icon');
  });
});

describe('CRC-32（IEEE 反射表驱动）', () => {
  it('命中标准校验向量', () => {
    expect(crc32(utf8Bytes('123456789'))).toBe(0xcbf43926);
    expect(crc32(utf8Bytes('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
    expect(crc32(new Uint8Array(0))).toBe(0x00000000);
  });

  it('与 PNG 夹具逐字节结果稳定', () => {
    expect(crc32(tinyPng)).toBe(0x6dbc1899);
  });
});

describe('ICO 容器编码', () => {
  it('以 PNG 载荷条目构造目录并按尺寸升序排列', () => {
    const ico = createIcoFile([
      { size: 256, pngBytes: tinyPng },
      { size: 16, pngBytes: tinyPng },
    ]);
    const view = new DataView(ico.buffer);

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(2);

    // 第一条目：16px → 宽高字节 16、色面 0、位深 32、载荷长与偏移。
    expect(ico[6]).toBe(16);
    expect(ico[7]).toBe(16);
    expect(view.getUint16(6 + 4, true)).toBe(1);
    expect(view.getUint16(6 + 6, true)).toBe(32);
    expect(view.getUint32(6 + 8, true)).toBe(tinyPng.byteLength);
    expect(view.getUint32(6 + 12, true)).toBe(6 + 2 * 16);

    // 第二条目：256px → 宽高字节写 0，载荷紧随首条目之后。
    expect(ico[6 + 16]).toBe(0);
    expect(ico[6 + 16 + 1]).toBe(0);
    expect(view.getUint32(6 + 16 + 12, true)).toBe(6 + 2 * 16 + tinyPng.byteLength);

    // 载荷字节逐一落位。
    expect(ico.slice(6 + 2 * 16, 6 + 2 * 16 + tinyPng.byteLength)).toEqual(tinyPng);
    expect(ico.byteLength).toBe(6 + 2 * 16 + 2 * tinyPng.byteLength);
  });

  it('拒绝超过 256 像素的载荷条目', () => {
    expect(() => createIcoFile([{ size: 512, pngBytes: tinyPng }])).toThrow();
  });
});

describe('ICNS 容器编码', () => {
  it('以大端长度域构造 icns 族容器', () => {
    const icns = createIcnsFile([{ type: 'ic09', pngBytes: tinyPng }]);
    const view = new DataView(icns.buffer);

    expect(ascii(icns, 0, 4)).toBe('icns');
    expect(view.getUint32(4, false)).toBe(icns.byteLength);
    expect(ascii(icns, 8, 4)).toBe('ic09');
    expect(view.getUint32(12, false)).toBe(tinyPng.byteLength + 8);
    expect(icns.slice(16, 16 + tinyPng.byteLength)).toEqual(tinyPng);
  });

  it('多条目时总长等于 8 加各条目长度之和', () => {
    const icns = createIcnsFile([
      { type: 'ic04', pngBytes: tinyPng },
      { type: 'ic07', pngBytes: tinyPng },
    ]);
    const view = new DataView(icns.buffer);
    expect(view.getUint32(4, false)).toBe(8 + (8 + tinyPng.byteLength) * 2);
    // 第二条目自 8 + (8 + 载荷长) 起始。
    expect(ascii(icns, 28, 4)).toBe('ic07');
  });
});

describe('ZIP Store 归档编码', () => {
  it('构造本地头、中央目录与结束记录齐全的 Store 归档', () => {
    const zip = createZipStore([
      { path: 'demo.png', bytes: tinyPng },
      { path: 'icons/demo-2.png', bytes: tinyPng },
    ]);
    const view = new DataView(zip.buffer);

    // 本地文件头：签名、版本、UTF-8 标志、CRC、原始长度。
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(ascii(zip, 30, 'demo.png'.length)).toBe('demo.png');
    const firstCrc = view.getUint32(14, true);
    expect(firstCrc).toBe(crc32(tinyPng));
    expect(view.getUint32(18, true)).toBe(tinyPng.byteLength);

    // 中央目录文件头签名与结束记录定位（中央目录按条目顺序排列：demo.png 在前）。
    expect(view.getUint32(zip.byteLength - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(zip.byteLength - 22 + 8, true)).toBe(2);
    expect(view.getUint16(zip.byteLength - 22 + 10, true)).toBe(2);
    const centralOffset = view.getUint32(zip.byteLength - 22 + 16, true);
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    expect(ascii(zip, centralOffset + 46, 'demo.png'.length)).toBe('demo.png');
    const secondCentralOffset = centralOffset + (46 + 'demo.png'.length);
    expect(view.getUint32(secondCentralOffset, true)).toBe(0x02014b50);
    expect(ascii(zip, secondCentralOffset + 46, 'icons/demo-2.png'.length)).toBe('icons/demo-2.png');

    // 总长守恒：本地段（30+名+载荷）与中央段（46+名）逐条目累加，加结束记录 22。
    expect(zip.byteLength).toBe(30 + 8 + tinyPng.byteLength + (30 + 16 + tinyPng.byteLength) + (46 + 8) + (46 + 16) + 22);
  });

  it('空归档只含结束记录', () => {
    const zip = createZipStore([]);
    expect(zip.byteLength).toBe(22);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
    expect(view.getUint16(8, true)).toBe(0);
  });
});
