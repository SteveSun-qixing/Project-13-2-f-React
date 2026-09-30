/**
 * 选项归一断言：缺省值、枚举、边界值与错误 details.field 逐项锁定；
 * 语义与缺省值以 contracts/html-to-pdf.options.schema.json 为准（契约一致性
 * 由 contract.test.ts 机检），本文件锁定运行时归一的真实行为。
 */

import { describe, expect, it } from 'vitest';

import { ChipsError } from '@chips/sdk';

import {
  DEFAULT_MARGIN_MM,
  MAX_MARGIN_MM,
  MAX_PRINT_SCALE,
  MAX_TEMPLATE_LENGTH,
  MIN_MARGIN_MM,
  MIN_PRINT_SCALE,
} from '../src/descriptor.js';
import { isChipsErrorLike } from '../src/errors.js';
import { normalizeHtmlToPdfOptions } from '../src/options.js';

function captureError(run: () => unknown): ChipsError {
  try {
    run();
  } catch (error) {
    expect(isChipsErrorLike(error)).toBe(true);
    return error as ChipsError;
  }
  expect.unreachable('应当抛出');
}

describe('normalizeHtmlToPdfOptions：缺省值', () => {
  it('缺省选项归一为 A4 / 纵向 / 10mm 边距 / 打印背景 / 非CSS页优先 / scale 1 / 页眉页脚关闭', () => {
    expect(normalizeHtmlToPdfOptions(undefined)).toEqual({
      pageSize: 'A4',
      landscape: false,
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
      printBackground: true,
      preferCSSPageSize: false,
      scale: 1,
      headerFooter: { enabled: false, headerHeightMm: 10, footerHeightMm: 10 },
    });
    expect(DEFAULT_MARGIN_MM).toBe(10);
  });

  it('空对象与缺省一致', () => {
    expect(normalizeHtmlToPdfOptions({})).toEqual(normalizeHtmlToPdfOptions(undefined));
  });

  it('margins 允许缺边：缺省边补 10mm', () => {
    const { margins } = normalizeHtmlToPdfOptions({ margins: { top: 0 } });
    expect(margins).toEqual({ top: 0, right: 10, bottom: 10, left: 10 });
  });

  it('headerFooter 空对象：enabled 缺省 false、高度缺省 10mm、无模板键', () => {
    const { headerFooter } = normalizeHtmlToPdfOptions({ headerFooter: {} });
    expect(headerFooter).toEqual({ enabled: false, headerHeightMm: 10, footerHeightMm: 10 });
    expect('headerTemplate' in headerFooter).toBe(false);
    expect('footerTemplate' in headerFooter).toBe(false);
  });

  it('合法 headerFooter 全量设置如实保留', () => {
    const { headerFooter } = normalizeHtmlToPdfOptions({
      headerFooter: {
        enabled: true,
        headerTemplate: '<div>薯片</div>',
        footerTemplate: '<span>1</span>',
        headerHeightMm: 0,
        footerHeightMm: 50,
      },
    });
    expect(headerFooter).toEqual({
      enabled: true,
      headerTemplate: '<div>薯片</div>',
      footerTemplate: '<span>1</span>',
      headerHeightMm: 0,
      footerHeightMm: 50,
    });
  });
});

describe('normalizeHtmlToPdfOptions：取值校验', () => {
  it('pageSize 接受四种登记规格', () => {
    for (const pageSize of ['A4', 'A3', 'Letter', 'Legal'] as const) {
      expect(normalizeHtmlToPdfOptions({ pageSize }).pageSize).toBe(pageSize);
    }
  });

  it('pageSize 非法值抛 CONVERTER_INPUT_UNSUPPORTED（field=options.pageSize）', () => {
    for (const pageSize of ['a4', 'B5', 'ISOA4', 42, null]) {
      const error = captureError(() =>
        normalizeHtmlToPdfOptions({ pageSize: pageSize as never })
      );
      expect(error.code).toBe('CONVERTER_INPUT_UNSUPPORTED');
      expect(error.details).toEqual({ field: 'options.pageSize' });
    }
  });

  it('布尔字段接受 true / false，非布尔抛错且 field 精确', () => {
    expect(normalizeHtmlToPdfOptions({ landscape: true }).landscape).toBe(true);
    expect(normalizeHtmlToPdfOptions({ printBackground: false }).printBackground).toBe(false);
    expect(normalizeHtmlToPdfOptions({ preferCSSPageSize: true }).preferCSSPageSize).toBe(true);
    for (const [field, value] of [
      ['landscape', 'true'],
      ['printBackground', 0],
      ['preferCSSPageSize', null],
    ] as const) {
      const error = captureError(() => normalizeHtmlToPdfOptions({ [field]: value }));
      expect(error.code).toBe('CONVERTER_INPUT_UNSUPPORTED');
      expect(error.details).toEqual({ field: `options.${field}` });
    }
  });

  it('margins 每边边界值 [0, 50] 可用', () => {
    expect(MIN_MARGIN_MM).toBe(0);
    expect(MAX_MARGIN_MM).toBe(50);
    const bounds = normalizeHtmlToPdfOptions({
      margins: { top: 0, right: 50, bottom: 0, left: 50 },
    });
    expect(bounds.margins).toEqual({ top: 0, right: 50, bottom: 0, left: 50 });
  });

  it('margins 越界与非有限数抛错（field 精确到边）', () => {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      for (const value of [-0.5, 50.5, Number.NaN, Number.POSITIVE_INFINITY, '10']) {
        const error = captureError(() =>
          normalizeHtmlToPdfOptions({ margins: { [side]: value } as never })
        );
        expect(error.code).toBe('CONVERTER_INPUT_UNSUPPORTED');
        expect(error.details).toEqual({ field: `options.margins.${side}` });
      }
    }
  });

  it('margins 非对象抛 CONVERTER_INPUT_UNSUPPORTED', () => {
    for (const margins of ['10', 42, [], null]) {
      const error = captureError(() =>
        normalizeHtmlToPdfOptions({ margins: margins as never })
      );
      expect(error.details).toEqual({ field: 'options.margins' });
    }
  });

  it('scale 边界值 [0.1, 2] 可用，越界抛错', () => {
    expect(MIN_PRINT_SCALE).toBe(0.1);
    expect(MAX_PRINT_SCALE).toBe(2);
    expect(normalizeHtmlToPdfOptions({ scale: 0.1 }).scale).toBe(0.1);
    expect(normalizeHtmlToPdfOptions({ scale: 2 }).scale).toBe(2);
    for (const scale of [0.09, 2.01, 0, -1, Number.NaN]) {
      const error = captureError(() => normalizeHtmlToPdfOptions({ scale }));
      expect(error.details).toEqual({ field: 'options.scale' });
    }
  });

  it('页眉页脚模板长度边界 1~4096', () => {
    expect(MAX_TEMPLATE_LENGTH).toBe(4096);
    const boundary = 'x'.repeat(MAX_TEMPLATE_LENGTH);
    expect(
      normalizeHtmlToPdfOptions({ headerFooter: { headerTemplate: boundary } }).headerFooter
        .headerTemplate
    ).toBe(boundary);
    for (const template of ['', 'x'.repeat(MAX_TEMPLATE_LENGTH + 1), 42]) {
      const error = captureError(() =>
        normalizeHtmlToPdfOptions({ headerFooter: { footerTemplate: template as never } })
      );
      expect(error.details).toEqual({ field: 'options.headerFooter.footerTemplate' });
    }
  });

  it('页眉页脚高度边界 [0, 50]，越界 field 精确', () => {
    expect(
      normalizeHtmlToPdfOptions({ headerFooter: { headerHeightMm: 0, footerHeightMm: 50 } })
        .headerFooter
    ).toMatchObject({ headerHeightMm: 0, footerHeightMm: 50 });
    for (const [field, value] of [
      ['headerHeightMm', -1],
      ['headerHeightMm', 50.5],
      ['footerHeightMm', Number.NaN],
      ['footerHeightMm', '10'],
    ] as const) {
      const error = captureError(() =>
        normalizeHtmlToPdfOptions({ headerFooter: { [field]: value } as never })
      );
      expect(error.details).toEqual({ field: `options.headerFooter.${field}` });
    }
  });

  it('headerFooter.enabled 非布尔抛错', () => {
    const error = captureError(() =>
      normalizeHtmlToPdfOptions({ headerFooter: { enabled: 1 as never } })
    );
    expect(error.details).toEqual({ field: 'options.headerFooter.enabled' });
  });

  it('headerFooter 非对象抛 CONVERTER_INPUT_UNSUPPORTED', () => {
    for (const headerFooter of ['on', 42, []]) {
      const error = captureError(() =>
        normalizeHtmlToPdfOptions({ headerFooter: headerFooter as never })
      );
      expect(error.details).toEqual({ field: 'options.headerFooter' });
    }
  });

  it('options 非对象抛 CONVERTER_INPUT_UNSUPPORTED（null 与数组均拒绝）', () => {
    for (const options of [null, 'A4', 42, []]) {
      const error = captureError(() => normalizeHtmlToPdfOptions(options));
      expect(error.code).toBe('CONVERTER_INPUT_UNSUPPORTED');
      expect(error.details).toEqual({ field: 'options' });
      expect(error.message).toBe('options 必须是对象。');
    }
  });
});

describe('normalizeHtmlToPdfOptions：键面行为', () => {
  it('归一结果恰好七个登记键，未知键不进入归一结果', () => {
    const normalized = normalizeHtmlToPdfOptions({
      pageSize: 'A3',
      unknownKey: 'ignored',
      another: 42,
    });
    expect(Object.keys(normalized).sort()).toEqual([
      'headerFooter',
      'landscape',
      'margins',
      'pageSize',
      'preferCSSPageSize',
      'printBackground',
      'scale',
    ]);
    expect(normalized.pageSize).toBe('A3');
  });
});
