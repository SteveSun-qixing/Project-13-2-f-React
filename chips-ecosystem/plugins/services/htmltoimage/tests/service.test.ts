import { describe, expect, it, vi } from 'vitest';

import { ChipsError } from '@chips/sdk';

import { createUnboundRasterEngine, UNBOUND_RASTER_ENGINE_ID } from '../src/engine/port.js';
import { cancelled, renderFailed } from '../src/errors.js';
import { createHtmlToImageService, getMimeType, uniqueWarnings } from '../src/service.js';
import type { IHtmlRasterEngine, IRasterizeRequest } from '../src/types.js';

const pngBytes = (length: number): Uint8Array => new Uint8Array(length).fill(0x89);

function fakeEngine(
  result: { bytes: Uint8Array; width: number; height: number },
  capture?: (request: IRasterizeRequest) => void
): IHtmlRasterEngine {
  return {
    id: 'test.engine',
    rasterize(request) {
      capture?.(request);
      return Promise.resolve(result);
    },
  };
}

const baseInput = { html: '<html><body><p>你好，薯片</p></body></html>' };

describe('getMimeType', () => {
  it('映射标准 MIME', () => {
    expect(getMimeType('png')).toBe('image/png');
    expect(getMimeType('jpeg')).toBe('image/jpeg');
    expect(getMimeType('webp')).toBe('image/webp');
    expect(getMimeType('gif')).toBe('application/octet-stream');
  });
});

describe('uniqueWarnings', () => {
  it('去重全等警告并保留差异项', () => {
    const warnings = [
      { code: 'A', message: '一' },
      { code: 'A', message: '一' },
      { code: 'A', message: '二' },
    ];
    expect(uniqueWarnings(warnings)).toHaveLength(2);
  });
});

describe('createHtmlToImageService', () => {
  it('装配时拒绝缺失的渲染承载端口', () => {
    expect(() =>
      createHtmlToImageService({ engine: undefined as unknown as IHtmlRasterEngine })
    ).toThrowError(TypeError);
  });

  it('完整编排：归一 → 几何 → 光栅化 → 结果装配', async () => {
    let seen: IRasterizeRequest | undefined;
    const engine = fakeEngine({ bytes: pngBytes(10), width: 1588, height: 2246 }, (request) => {
      seen = request;
    });
    const service = createHtmlToImageService({ engine });

    const result = await service.htmlToImage(
      baseInput,
      { format: 'png', scaleFactor: 2, background: 'white' },
      {}
    );

    expect(seen?.html).toBe(baseInput.html);
    expect(seen?.viewport).toEqual({ width: 794, height: null });
    expect(seen?.background).toBe('#ffffff');
    expect(seen?.format).toBe('png');
    expect(result.format).toBe('png');
    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBe(1588);
    expect(result.height).toBe(2246);
    expect(result.scaleFactor).toBe(2);
    expect(result.background).toBe('#ffffff');
    expect(result.warnings).toEqual([]);
    expect(result.diagnostics).toEqual({
      engineId: 'test.engine',
      assetCount: 0,
      viewportWidthPx: 794,
      viewportHeightPx: null,
    });
  });

  it('归一警告随结果返回（JPEG 透明背景）', async () => {
    const service = createHtmlToImageService({
      engine: fakeEngine({ bytes: pngBytes(5), width: 794, height: 10 }),
    });
    const result = await service.htmlToImage(baseInput, { format: 'jpeg', background: 'transparent' });
    expect(result.warnings.map((item) => item.code)).toEqual(['BACKGROUND_NORMALIZED_OPAQUE']);
    expect(result.background).toBe('#ffffff');
  });

  it('渲染承载抛出的 ChipsError 原样透传', async () => {
    const original = renderFailed('渲染器内部错误。', { engine: 'x' });
    const engine: IHtmlRasterEngine = {
      id: 'test.engine',
      rasterize() {
        return Promise.reject(original);
      },
    };
    const service = createHtmlToImageService({ engine });
    await expect(service.htmlToImage(baseInput)).rejects.toThrow(original);
  });

  it('渲染承载抛出的非 ChipsError 归一为 CONVERTER_RENDER_FAILED', async () => {
    const engine: IHtmlRasterEngine = {
      id: 'test.engine',
      rasterize() {
        return Promise.reject(new Error('boom'));
      },
    };
    const service = createHtmlToImageService({ engine });
    try {
      await service.htmlToImage(baseInput);
      expect.unreachable('应当抛出');
    } catch (error) {
      expect(error).toBeInstanceOf(ChipsError);
      expect((error as ChipsError).code).toBe('CONVERTER_RENDER_FAILED');
      expect((error as ChipsError).message).toContain('渲染承载');
    }
  });

  it('空图片数据按 CONVERTER_RENDER_FAILED 收口', async () => {
    const service = createHtmlToImageService({
      engine: fakeEngine({ bytes: new Uint8Array(0), width: 10, height: 10 }),
    });
    await expect(service.htmlToImage(baseInput)).rejects.toMatchObject({
      code: 'CONVERTER_RENDER_FAILED',
    });
  });

  it('超限图片字节按 CONVERTER_OUTPUT_TOO_LARGE 收口', async () => {
    const service = createHtmlToImageService({
      engine: fakeEngine({ bytes: pngBytes(64 * 1024 * 1024 + 1), width: 10, height: 10 }),
    });
    await expect(service.htmlToImage(baseInput)).rejects.toMatchObject({
      code: 'CONVERTER_OUTPUT_TOO_LARGE',
    });
  });

  it('非法输出尺寸按 CONVERTER_RENDER_FAILED 收口', async () => {
    const service = createHtmlToImageService({
      engine: fakeEngine({ bytes: pngBytes(5), width: 0, height: 10 }),
    });
    await expect(service.htmlToImage(baseInput)).rejects.toMatchObject({
      code: 'CONVERTER_RENDER_FAILED',
    });
  });

  it('中止信号在安全点抛 BRIDGE_CANCELLED', async () => {
    const service = createHtmlToImageService({
      engine: fakeEngine({ bytes: pngBytes(5), width: 10, height: 10 }),
    });
    const controller = new AbortController();
    controller.abort();
    try {
      await service.htmlToImage(baseInput, undefined, { signal: controller.signal });
      expect.unreachable('应当抛出');
    } catch (error) {
      expect(error).toBeInstanceOf(ChipsError);
      expect((error as ChipsError).code).toBe('BRIDGE_CANCELLED');
    }
  });

  it('输入校验失败先于渲染承载调用', async () => {
    const rasterize = vi.fn(() => Promise.resolve({ bytes: pngBytes(1), width: 1, height: 1 }));
    const service = createHtmlToImageService({ engine: { id: 'e', rasterize } });
    await expect(service.htmlToImage({ html: '' })).rejects.toMatchObject({
      code: 'CONVERTER_INPUT_UNSUPPORTED',
    });
    expect(rasterize).not.toHaveBeenCalled();
  });

  it('取消先于输入归一', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      createHtmlToImageService({
        engine: fakeEngine({ bytes: pngBytes(1), width: 1, height: 1 }),
      }).htmlToImage({ html: '<p></p>' }, undefined, { signal: controller.signal })
    ).rejects.toMatchObject({ code: cancelled('x').code });
  });
});

describe('createUnboundRasterEngine', () => {
  it('调用即按 CONVERTER_RENDER_FAILED 与 RENDER_CARRIER_UNBOUND 收口', async () => {
    const engine = createUnboundRasterEngine();
    expect(engine.id).toBe(UNBOUND_RASTER_ENGINE_ID);
    try {
      await engine.rasterize({
        html: '<p></p>',
        assets: {},
        viewport: { width: 794, height: null },
        scaleFactor: 1,
        background: 'transparent',
        format: 'png',
      });
      expect.unreachable('应当抛出');
    } catch (error) {
      expect(error).toBeInstanceOf(ChipsError);
      expect((error as ChipsError).code).toBe('CONVERTER_RENDER_FAILED');
      expect((error as ChipsError).details).toMatchObject({
        engine: UNBOUND_RASTER_ENGINE_ID,
        reason: 'RENDER_CARRIER_UNBOUND',
      });
    }
  });
});
