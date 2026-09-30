import { describe, expect, it, vi } from 'vitest';

import { ChipsError } from '@chips/sdk';

import { createUnboundPrintEngine, UNBOUND_PRINT_ENGINE_ID } from '../src/engine/port.js';
import { BRIDGE_CANCELLED, renderFailed } from '../src/errors.js';
import { createHtmlToPdfService, uniqueWarnings } from '../src/service.js';
import type { IPdfPrintEngine, IPrintRequest } from '../src/types.js';

const pdfBytes = (length: number): Uint8Array => new Uint8Array(length).fill(0x25);

function fakeEngine(
  result: { bytes: Uint8Array; pageCount: number },
  capture?: (request: IPrintRequest) => void
): IPdfPrintEngine {
  return {
    id: 'test.engine',
    print(request) {
      capture?.(request);
      return Promise.resolve(result);
    },
  };
}

const baseInput = { html: '<html><body><p>你好，薯片</p></body></html>' };

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

describe('createHtmlToPdfService', () => {
  it('装配时拒绝缺失的打印承载端口', () => {
    expect(() =>
      createHtmlToPdfService({ engine: undefined as unknown as IPdfPrintEngine })
    ).toThrowError(TypeError);
  });

  it('完整编排：归一 → 几何 → 打印 → 结果装配', async () => {
    let seen: IPrintRequest | undefined;
    const engine = fakeEngine({ bytes: pdfBytes(10), pageCount: 1 }, (request) => {
      seen = request;
    });
    const service = createHtmlToPdfService({ engine });

    const result = await service.htmlToPdf(
      baseInput,
      { pageSize: 'A4', printBackground: false, scale: 1.5 },
      {}
    );

    expect(seen?.html).toBe(baseInput.html);
    expect(seen?.pageSizeMm).toEqual({ width: 210, height: 297 });
    expect(seen?.marginMm).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
    expect(seen?.landscape).toBe(false);
    expect(seen?.printBackground).toBe(false);
    expect(seen?.preferCSSPageSize).toBe(false);
    expect(seen?.scale).toBe(1.5);
    expect(seen?.headerFooter).toEqual({
      enabled: false,
      headerHeightMm: 10,
      footerHeightMm: 10,
    });
    expect(result.bytes).toEqual(pdfBytes(10));
    expect(result.pageCount).toBe(1);
    expect(result.pageSizeMm).toEqual({ width: 210, height: 297 });
    expect(result.marginMm).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
    expect(result.warnings).toEqual([]);
    expect(result.diagnostics).toEqual({
      engineId: 'test.engine',
      assetCount: 0,
      printableAreaMm: { width: 190, height: 277 },
      paginationHintPageCount: null,
    });
  });

  it('提供排版度量块时分页预估随结果返回（警告与提示页数）', async () => {
    const service = createHtmlToPdfService({
      engine: fakeEngine({ bytes: pdfBytes(5), pageCount: 3 }),
    });
    const result = await service.htmlToPdf({
      ...baseInput,
      blocks: [
        { id: 'b1', heightPx: 500 },
        { id: 'big', heightPx: 2000, keepTogether: true },
      ],
    });
    expect(result.warnings.map((item) => item.code)).toEqual(['PAGE_OVERFLOW_KEEP_BLOCK']);
    expect(result.diagnostics.paginationHintPageCount).toBe(2);
  });

  it('纸张规格与方向传递到打印请求（A3 横向）', async () => {
    let seen: IPrintRequest | undefined;
    const service = createHtmlToPdfService({
      engine: fakeEngine({ bytes: pdfBytes(5), pageCount: 1 }, (request) => {
        seen = request;
      }),
    });
    await service.htmlToPdf(baseInput, { pageSize: 'A3', landscape: true });
    expect(seen?.pageSizeMm).toEqual({ width: 420, height: 297 });
    expect(seen?.landscape).toBe(true);
    expect(seen?.marginMm).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
  });

  it('页眉页脚预留计入可打印区并透传打印请求', async () => {
    let seen: IPrintRequest | undefined;
    const service = createHtmlToPdfService({
      engine: fakeEngine({ bytes: pdfBytes(5), pageCount: 1 }, (request) => {
        seen = request;
      }),
    });
    const result = await service.htmlToPdf(baseInput, {
      headerFooter: { enabled: true, headerHeightMm: 12, footerHeightMm: 8 },
    });
    expect(seen?.headerFooter).toEqual({
      enabled: true,
      headerHeightMm: 12,
      footerHeightMm: 8,
    });
    // 可打印区高 = 297 − 上下边距 20 − 页眉 12 − 页脚 8 = 257，宽 = 210 − 左右边距 20 = 190。
    expect(result.diagnostics.printableAreaMm).toEqual({ width: 190, height: 257 });
  });

  it('打印承载抛出的 ChipsError 原样透传', async () => {
    const original = renderFailed('打印器内部错误。', { engine: 'x' });
    const engine: IPdfPrintEngine = {
      id: 'test.engine',
      print() {
        return Promise.reject(original);
      },
    };
    const service = createHtmlToPdfService({ engine });
    await expect(service.htmlToPdf(baseInput)).rejects.toThrow(original);
  });

  it('打印承载抛出的非 ChipsError 归一为 CONVERTER_RENDER_FAILED', async () => {
    const engine: IPdfPrintEngine = {
      id: 'test.engine',
      print() {
        return Promise.reject(new Error('boom'));
      },
    };
    const service = createHtmlToPdfService({ engine });
    try {
      await service.htmlToPdf(baseInput);
      expect.unreachable('应当抛出');
    } catch (error) {
      expect(error).toBeInstanceOf(ChipsError);
      expect((error as ChipsError).code).toBe('CONVERTER_RENDER_FAILED');
      expect((error as ChipsError).message).toContain('打印承载');
    }
  });

  it('空 PDF 数据按 CONVERTER_RENDER_FAILED 收口', async () => {
    const service = createHtmlToPdfService({
      engine: fakeEngine({ bytes: new Uint8Array(0), pageCount: 1 }),
    });
    await expect(service.htmlToPdf(baseInput)).rejects.toMatchObject({
      code: 'CONVERTER_RENDER_FAILED',
    });
  });

  it('超限 PDF 字节按 CONVERTER_OUTPUT_TOO_LARGE 收口', async () => {
    const service = createHtmlToPdfService({
      engine: fakeEngine({ bytes: pdfBytes(128 * 1024 * 1024 + 1), pageCount: 1 }),
    });
    await expect(service.htmlToPdf(baseInput)).rejects.toMatchObject({
      code: 'CONVERTER_OUTPUT_TOO_LARGE',
    });
  });

  it('非法页数按 CONVERTER_RENDER_FAILED 收口', async () => {
    const service = createHtmlToPdfService({
      engine: fakeEngine({ bytes: pdfBytes(5), pageCount: 0 }),
    });
    await expect(service.htmlToPdf(baseInput)).rejects.toMatchObject({
      code: 'CONVERTER_RENDER_FAILED',
    });
  });

  it('超限页数按 CONVERTER_OUTPUT_TOO_LARGE 收口', async () => {
    const service = createHtmlToPdfService({
      engine: fakeEngine({ bytes: pdfBytes(5), pageCount: 10001 }),
    });
    await expect(service.htmlToPdf(baseInput)).rejects.toMatchObject({
      code: 'CONVERTER_OUTPUT_TOO_LARGE',
    });
  });

  it('中止信号在安全点抛 BRIDGE_CANCELLED', async () => {
    const service = createHtmlToPdfService({
      engine: fakeEngine({ bytes: pdfBytes(5), pageCount: 1 }),
    });
    const controller = new AbortController();
    controller.abort();
    try {
      await service.htmlToPdf(baseInput, undefined, { signal: controller.signal });
      expect.unreachable('应当抛出');
    } catch (error) {
      expect(error).toBeInstanceOf(ChipsError);
      expect((error as ChipsError).code).toBe(BRIDGE_CANCELLED);
    }
  });

  it('输入校验失败先于打印承载调用', async () => {
    const print = vi.fn(() => Promise.resolve({ bytes: pdfBytes(1), pageCount: 1 }));
    const service = createHtmlToPdfService({ engine: { id: 'e', print } });
    await expect(service.htmlToPdf({ html: '' })).rejects.toMatchObject({
      code: 'CONVERTER_INPUT_UNSUPPORTED',
    });
    expect(print).not.toHaveBeenCalled();
  });

  it('取消先于输入归一', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      createHtmlToPdfService({
        engine: fakeEngine({ bytes: pdfBytes(1), pageCount: 1 }),
      }).htmlToPdf({ html: '<p></p>' }, undefined, { signal: controller.signal })
    ).rejects.toMatchObject({ code: BRIDGE_CANCELLED });
  });
});

describe('createUnboundPrintEngine', () => {
  it('调用即按 CONVERTER_RENDER_FAILED 与 RENDER_CARRIER_UNBOUND 收口', async () => {
    const engine = createUnboundPrintEngine();
    expect(engine.id).toBe(UNBOUND_PRINT_ENGINE_ID);
    try {
      await engine.print({
        html: '<p></p>',
        assets: {},
        pageSizeMm: { width: 210, height: 297 },
        marginMm: { top: 10, right: 10, bottom: 10, left: 10 },
        landscape: false,
        printBackground: true,
        preferCSSPageSize: false,
        scale: 1,
        headerFooter: { enabled: false, headerHeightMm: 10, footerHeightMm: 10 },
      });
      expect.unreachable('应当抛出');
    } catch (error) {
      expect(error).toBeInstanceOf(ChipsError);
      expect((error as ChipsError).code).toBe('CONVERTER_RENDER_FAILED');
      expect((error as ChipsError).details).toMatchObject({
        engine: UNBOUND_PRINT_ENGINE_ID,
        reason: 'RENDER_CARRIER_UNBOUND',
      });
    }
  });
});
