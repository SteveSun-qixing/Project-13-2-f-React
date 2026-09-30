import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ChipsError, chips } from '@chips/sdk';
import {
  iconBytesToBase64,
  joinOutputPath,
  resolveErrorCode,
  saveGeneratedIcons,
  type IconSaveResult,
} from '../../src/export/iconSave';
import { loadImageSourceFromPath } from '../../src/export/source-image';
import type { BinaryIconFile } from '../../src/domain/types';

function iconFile(fileName: string, bytes: Uint8Array): BinaryIconFile {
  return { fileName, mimeType: 'image/png', bytes };
}

/** 桩一个可写的 chips.request：按 capabilityId 记录调用并按剧本返回/拒绝（IO 边界替身）。 */
function stubBridge(
  behavior: (capabilityId: string, input: unknown) => unknown,
): MockInstance<typeof chips.request> {
  return vi.spyOn(chips, 'request').mockImplementation((capabilityId: string, input?: unknown) =>
    Promise.resolve(behavior(capabilityId, input)),
  );
}

describe('落盘辅助纯函数', () => {
  it('base64 编码与路径拼接', () => {
    expect(iconBytesToBase64(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe('iVBORw==');
    expect(iconBytesToBase64(new Uint8Array([]))).toBe('');
    const large = new Uint8Array(0x8000 * 2 + 3).map((_, index) => index % 251);
    expect(atob(iconBytesToBase64(large)).length).toBe(large.length);
    expect(joinOutputPath('~/Pictures/chips-icons/', 'demo.png')).toBe('~/Pictures/chips-icons/demo.png');
    expect(joinOutputPath('C:\\out\\\\', 'a.ico')).toBe('C:\\out/a.ico');
  });

  it('错误码读取只认结构化 code', () => {
    expect(resolveErrorCode(new ChipsError({ code: 'CAPABILITY_UNAVAILABLE', message: 'x' }))).toBe(
      'CAPABILITY_UNAVAILABLE',
    );
    expect(resolveErrorCode({ code: 'E_ABC' })).toBe('E_ABC');
    expect(resolveErrorCode(new Error('boom'))).toBeNull();
    expect(resolveErrorCode('boom')).toBeNull();
  });
});

describe('落盘诚实降级（filesystem 臂）', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('能力可用时逐文件写入并返回成功清单', async () => {
    const calls: Array<{ capabilityId: string; input: unknown }> = [];
    stubBridge((capabilityId, input) => {
      calls.push({ capabilityId, input });
      return {};
    });

    const result = await saveGeneratedIcons(
      [iconFile('demo.png', new Uint8Array([1, 2, 3])), iconFile('icons.zip', new Uint8Array([4, 5]))],
      '~/Pictures/chips-icons',
    );

    expect(result.status).toBe('written');
    expect(result.errorCode).toBeNull();
    expect(result.writtenPaths).toEqual([
      '~/Pictures/chips-icons/demo.png',
      '~/Pictures/chips-icons/icons.zip',
    ]);
    expect(result.message).toContain('已写入 2 个文件');
    expect(calls[0]).toEqual({
      capabilityId: 'file:mkdir',
      input: { path: '~/Pictures/chips-icons', recursive: true },
    });
    expect(calls[1]?.capabilityId).toBe('file:write');
  });

  it('写入能力拒绝时如实上报失败，不伪造成功', async () => {
    stubBridge((capabilityId) => {
      if (capabilityId === 'file:write') {
        throw new ChipsError({ code: 'CAPABILITY_UNAVAILABLE', message: '能力未注册' });
      }
      return {};
    });

    const result = await saveGeneratedIcons([iconFile('demo.png', new Uint8Array([1]))], '/tmp/icons');

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('CAPABILITY_UNAVAILABLE');
    expect(result.writtenPaths).toEqual([]);
    expect(result.message).toContain('落盘未完成');
    expect(result.message).toContain('CAPABILITY_UNAVAILABLE');
  });

  it('第二个文件失败时保留首个已完成路径', async () => {
    stubBridge((capabilityId, input) => {
      if (capabilityId === 'file:write' && (input as { path: string }).path.endsWith('b.png')) {
        throw new ChipsError({ code: 'FILE_WRITE_DENIED', message: '拒绝写入' });
      }
      return {};
    });

    const result = await saveGeneratedIcons(
      [iconFile('a.png', new Uint8Array([1])), iconFile('b.png', new Uint8Array([2]))],
      '/tmp/icons',
    );

    expect(result.status).toBe('failed');
    expect(result.writtenPaths).toEqual(['/tmp/icons/a.png']);
    expect(result.errorCode).toBe('FILE_WRITE_DENIED');
  });

  it('未知错误形态收敛为 ICON_SAVE_UNKNOWN_ERROR 错误码', async () => {
    stubBridge(() => {
      throw new Error('字符串异常');
    });

    const result: IconSaveResult = await saveGeneratedIcons([iconFile('a.png', new Uint8Array([1]))], '/tmp/icons');
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('ICON_SAVE_UNKNOWN_ERROR');
  });
});

describe('来源图读取臂诚实上抛（filesystem 臂）', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('file:read 拒绝时异常原样上抛，不做旁路兜底', async () => {
    vi.spyOn(chips, 'request').mockImplementation(() =>
      Promise.reject(new ChipsError({ code: 'CAPABILITY_UNAVAILABLE', message: '能力未注册' })),
    );

    await expect(loadImageSourceFromPath('~/图片/demo.png')).rejects.toMatchObject({
      code: 'CAPABILITY_UNAVAILABLE',
    });
  });

  it('读取结果非预期形态时抛 ICONMAKER_INPUT_NOT_BINARY', async () => {
    vi.spyOn(chips, 'request').mockImplementation(() => Promise.resolve({ unexpected: true }));

    await expect(loadImageSourceFromPath('~/图片/demo.png')).rejects.toThrow('ICONMAKER_INPUT_NOT_BINARY');
  });

  it('不支持扩展名的来源抛 ICONMAKER_INPUT_UNSUPPORTED', async () => {
    vi.spyOn(chips, 'request').mockImplementation(() => Promise.resolve({ content: 'AAEC', encoding: 'base64' }));

    await expect(loadImageSourceFromPath('~/图片/demo.exe')).rejects.toThrow('ICONMAKER_INPUT_UNSUPPORTED');
  });
});
