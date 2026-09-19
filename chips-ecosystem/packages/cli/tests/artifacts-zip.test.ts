/**
 * ZIP Store 归档引擎与 CRC-32（[插件包格式] §2.1、§5.2[1]）：
 * 确定性写入、结构读取与全部拒绝项的错误语义。
 */

import { describe, expect, it } from 'vitest';

import { ChipsError } from '../src/errors.js';
import { crc32 } from '../src/artifacts/crc32.js';
import { compareZipPathBytes, readZipStore, writeZipStore, type IZipEntry } from '../src/artifacts/zip.js';

const encoder = new TextEncoder();

function entry(path: string, text: string): IZipEntry {
  return { path, data: encoder.encode(text) };
}

/** 归档尾部 22 字节的 EOCD 起始位置。 */
function eocdOffset(bytes: Uint8Array): number {
  return bytes.length - 22;
}

function centralOffset(bytes: Uint8Array): number {
  return new DataView(bytes.buffer).getUint32(eocdOffset(bytes) + 16, true);
}

function localOffset(bytes: Uint8Array): number {
  return new DataView(bytes.buffer).getUint32(centralOffset(bytes) + 42, true);
}

/** 复制归档并在指定偏移写入小端整数。 */
function patch(bytes: Uint8Array, offset: number, value: number, size: 2 | 4): Uint8Array {
  const copy = bytes.slice();
  const view = new DataView(copy.buffer);
  if (size === 2) {
    view.setUint16(offset, value, true);
  } else {
    view.setUint32(offset, value, true);
  }
  return copy;
}

/** 断言归档读取抛出 `CPK_ARCHIVE_INVALID`。 */
function expectArchiveInvalid(bytes: Uint8Array): string {
  try {
    readZipStore(bytes);
  } catch (error) {
    expect(error).toBeInstanceOf(ChipsError);
    const normalized = error as ChipsError;
    expect(normalized.code).toBe('CPK_ARCHIVE_INVALID');
    return normalized.message;
  }
  throw new Error('期望抛出 CPK_ARCHIVE_INVALID');
}

describe('CRC-32（IEEE 802.3）', () => {
  it('空输入摘要为 0', () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('标准校验串 123456789 得 0xCBF43926', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
  });

  it('已登记向量：单字节与整句', () => {
    expect(crc32(encoder.encode('a'))).toBe(0xe8b7be43);
    expect(crc32(encoder.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });

  it('确定性且随内容变化', () => {
    expect(crc32(encoder.encode('chips'))).toBe(crc32(encoder.encode('chips')));
    expect(crc32(encoder.encode('chips'))).not.toBe(crc32(encoder.encode('chipS')));
  });
});

describe('成员路径字节序比较', () => {
  it('按 UTF-8 字节升序，前缀短者在前', () => {
    expect(compareZipPathBytes('a.txt', 'b.txt')).toBeLessThan(0);
    expect(compareZipPathBytes('dist/a.js', 'dist/b.js')).toBeLessThan(0);
    expect(compareZipPathBytes('dist', 'dist/a.js')).toBeLessThan(0);
    expect(compareZipPathBytes('render.js', 'render.js')).toBe(0);
  });

  it('大写字母字节序先于小写（区分大小写，不做折叠）', () => {
    expect(compareZipPathBytes('A.txt', 'a.txt')).toBeLessThan(0);
  });

  it('非 ASCII 路径按 UTF-8 字节比较', () => {
    expect(compareZipPathBytes('assets/薯片.svg', 'assets/zzz.svg')).toBeGreaterThan(0);
  });
});

describe('ZIP Store 写入（确定性）', () => {
  it('同一输入两次写入字节完全一致', () => {
    const entries = [entry('render.js', 'export default {};'), entry('manifest.yaml', 'id: x\n'), entry('dist/index.js', 'export const a = 1;')];
    expect(writeZipStore(entries)).toEqual(writeZipStore(entries));
  });

  it('成员声明顺序无关：按路径字节序升序落盘', () => {
    const forward = writeZipStore([entry('assets/a.svg', 'a'), entry('dist/index.js', 'b'), entry('manifest.yaml', 'c')]);
    const backward = writeZipStore([entry('manifest.yaml', 'c'), entry('dist/index.js', 'b'), entry('assets/a.svg', 'a')]);
    expect(forward).toEqual(backward);
    expect(readZipStore(forward).map((item) => item.path)).toEqual(['assets/a.svg', 'dist/index.js', 'manifest.yaml']);
  });

  it('空归档仍是合法 ZIP：只有中央目录结束记录', () => {
    const bytes = writeZipStore([]);
    expect(bytes.length).toBe(22);
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x06054b50);
    expect(readZipStore(bytes)).toEqual([]);
  });

  it('头部字段满足 Store 与固定时间戳约束（§2.1）', () => {
    const bytes = writeZipStore([entry('manifest.yaml', 'id: chips.example.hello\n')]);
    const view = new DataView(bytes.buffer);
    const central = centralOffset(bytes);
    const local = localOffset(bytes);
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    expect(view.getUint16(local + 8, true)).toBe(0);
    expect(view.getUint16(local + 10, true)).toBe(0);
    expect(view.getUint16(local + 12, true)).toBe(0x0021);
    expect(view.getUint16(local + 28, true)).toBe(0);
    expect(view.getUint32(central, true)).toBe(0x02014b50);
    expect(view.getUint16(central + 10, true)).toBe(0);
    expect(view.getUint32(central + 20, true)).toBe(view.getUint32(central + 24, true));
    expect(view.getUint16(central + 30, true)).toBe(0);
    expect(view.getUint16(central + 32, true)).toBe(0);
    expect(view.getUint32(central + 38, true)).toBe(0);
  });

  it('UTF-8 标志位保证中文名按 UTF-8 编码', () => {
    const bytes = writeZipStore([entry('assets/图标.svg', 'x')]);
    const view = new DataView(bytes.buffer);
    expect((view.getUint16(6, true) & 0x0800) !== 0).toBe(true);
    expect((view.getUint16(centralOffset(bytes) + 8, true) & 0x0800) !== 0).toBe(true);
    expect(readZipStore(bytes)[0]?.path).toBe('assets/图标.svg');
  });

  it('写入成员携带正确 CRC32', () => {
    const data = encoder.encode('chips');
    const bytes = writeZipStore([{ path: 'dist/index.js', data }]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(localOffset(bytes) + 14, true)).toBe(crc32(data));
    expect(view.getUint32(centralOffset(bytes) + 16, true)).toBe(crc32(data));
  });
});

describe('ZIP Store 读取与拒绝项（§2.1）', () => {
  const archive = writeZipStore([entry('manifest.yaml', 'id: chips.example.hello\n'), entry('dist/index.js', 'export default {};')]);

  it('读回成员路径与字节内容', () => {
    const entries = readZipStore(archive);
    expect(entries.map((item) => item.path)).toEqual(['dist/index.js', 'manifest.yaml']);
    expect(new TextDecoder().decode(entries[0]?.data)).toBe('export default {};');
  });

  it('缺失中央目录结束记录：不是合法 ZIP', () => {
    expect(expectArchiveInvalid(encoder.encode('这不是归档文件'))).toContain('未找到中央目录结束记录');
  });

  it('ZIP64 归档拒绝', () => {
    const message = expectArchiveInvalid(patch(archive, eocdOffset(archive) + 10, 0xffff, 2));
    expect(message).toContain('不支持 ZIP64');
  });

  it('多卷归档拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, eocdOffset(archive) + 4, 1, 2))).toContain('不支持多卷');
  });

  it('中央目录越界拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, eocdOffset(archive) + 16, archive.length + 10, 4))).toContain('中央目录越界');
  });

  it('中央目录不完整拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, eocdOffset(archive) + 10, 5, 2))).toContain('中央目录不完整');
  });

  it('中央目录签名非法拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, centralOffset(archive), 0x08064b50, 4))).toContain('中央目录签名非法');
  });

  it('加密成员拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, centralOffset(archive) + 8, 0x0001, 2))).toContain('成员被加密');
  });

  it('非 Store 压缩方法拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, centralOffset(archive) + 10, 8, 2))).toContain('未使用 Store 方法');
  });

  it('Store 成员压缩前后尺寸不一致拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, centralOffset(archive) + 20, 3, 2))).toContain('压缩前后尺寸不一致');
  });

  it('非标准扩展字段拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, centralOffset(archive) + 30, 2, 2))).toContain('非标准扩展字段');
  });

  it('重复路径拒绝', () => {
    const duplicated = writeZipStore([entry('manifest.yaml', 'a'), entry('manifest.yaml', 'b')]);
    expect(expectArchiveInvalid(duplicated)).toContain('路径重复：manifest.yaml');
  });

  it('仅大小写不同的路径拒绝（§2.1 重复与大小写）', () => {
    const mixed = writeZipStore([entry('Readme.md', 'a'), entry('readme.md', 'b')]);
    expect(expectArchiveInvalid(mixed)).toContain('路径重复：readme.md');
  });

  it('成员本地头越界拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, centralOffset(archive) + 42, archive.length + 1, 4))).toContain('本地头越界');
  });

  it('成员本地头签名非法拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, localOffset(archive), 0x02014b50, 4))).toContain('本地头签名非法');
  });

  it('成员数据越界拒绝', () => {
    const broken = patch(patch(archive, centralOffset(archive) + 20, 9999, 4), centralOffset(archive) + 24, 9999, 4);
    expect(expectArchiveInvalid(broken)).toContain('成员数据越界');
  });

  it('成员 CRC 校验失败拒绝', () => {
    expect(expectArchiveInvalid(patch(archive, centralOffset(archive) + 16, 0x12345678, 4))).toContain('CRC 校验失败');
  });

  it('读取结果为副本，不与原归档共享字节', () => {
    const entries = readZipStore(archive);
    const data = entries[0]?.data;
    expect(data).toBeDefined();
    if (data !== undefined) {
      data[0] = 0x7a;
    }
    expect(new TextDecoder().decode(readZipStore(archive)[0]?.data)).toBe('export default {};');
  });
});
