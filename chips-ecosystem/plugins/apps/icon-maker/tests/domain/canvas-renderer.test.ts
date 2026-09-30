import { describe, expect, it } from 'vitest';
import {
  canvasToPngBytes,
  fillBackground,
  renderIconToCanvas,
  resolveImageBox,
} from '../../src/domain/canvas-renderer';
import { MATERIAL_SYMBOLS_FONT_SOURCE } from '../../src/domain/default-fonts';
import { BACKGROUND_PRESETS, DEFAULT_ICON_SETTINGS, type RenderIconOptions } from '../../src/domain/types';

/** 画布上下文记录桩：只记录调用事实，渲染决策全部走真实实现（渲染数学不 mock）。 */
function createCanvasStub(): {
  calls: {
    fillRect: number;
    fillText: Array<{ text: string; x: number; y: number }>;
    drawImage: number;
    clearRect: number;
    gradientStops: Array<{ offset: number; color: string }>;
    fillStyleLog: string[];
    fontLog: string[];
  };
  canvas: HTMLCanvasElement;
} {
  const calls = {
    fillRect: 0,
    fillText: [] as Array<{ text: string; x: number; y: number }>,
    drawImage: 0,
    clearRect: 0,
    gradientStops: [] as Array<{ offset: number; color: string }>,
    fillStyleLog: [] as string[],
    fontLog: [] as string[],
  };

  const context = {
    clearRect: () => {
      calls.clearRect += 1;
    },
    createLinearGradient: () => ({
      addColorStop: (offset: number, color: string) => {
        calls.gradientStops.push({ offset, color });
      },
    }),
    drawImage: () => {
      calls.drawImage += 1;
    },
    fillRect: () => {
      calls.fillRect += 1;
    },
    fillText: (text: string, x: number, y: number) => {
      calls.fillText.push({ text, x, y });
    },
    set fillStyle(value: string) {
      calls.fillStyleLog.push(value);
    },
    get fillStyle() {
      return calls.fillStyleLog.at(-1) ?? '';
    },
    set font(value: string) {
      calls.fontLog.push(value);
    },
    get font() {
      return calls.fontLog.at(-1) ?? '';
    },
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D;

  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;

  return { calls, canvas };
}

function createRenderOptions(partial: Partial<RenderIconOptions>): RenderIconOptions {
  return {
    size: 32,
    settings: DEFAULT_ICON_SETTINGS,
    sourceMode: 'image',
    imageSource: null,
    fontSource: MATERIAL_SYMBOLS_FONT_SOURCE,
    selectedGlyph: null,
    ...partial,
  };
}

describe('渲染数学：适配盒（真实数值断言）', () => {
  it('fit：等比例缩放并留 8% 边距居中（横图）', () => {
    const image = { naturalWidth: 100, naturalHeight: 50, width: 0, height: 0 } as HTMLImageElement;
    expect(resolveImageBox(image, 256, 'fit')).toEqual({
      sx: 0,
      sy: 0,
      sw: 100,
      sh: 50,
      dx: 20,
      dy: 74,
      dw: 216,
      dh: 108,
    });
  });

  it('fit：方形小画布的边距取整（64px → 5px 边距、54px 绘制区）', () => {
    const image = { naturalWidth: 64, naturalHeight: 64, width: 0, height: 0 } as HTMLImageElement;
    expect(resolveImageBox(image, 64, 'fit')).toEqual({
      sx: 0,
      sy: 0,
      sw: 64,
      sh: 64,
      dx: 5,
      dy: 5,
      dw: 54,
      dh: 54,
    });
  });

  it('fit：竖图按宽度受限缩放', () => {
    const image = { naturalWidth: 50, naturalHeight: 100, width: 0, height: 0 } as HTMLImageElement;
    const box = resolveImageBox(image, 100, 'fit');
    expect(box.dw).toBe(42);
    expect(box.dh).toBe(84);
    expect(box.dx).toBe(29);
    expect(box.dy).toBe(8);
  });

  it('fill：横图居中裁剪为正方形源区', () => {
    const image = { naturalWidth: 200, naturalHeight: 100, width: 0, height: 0 } as HTMLImageElement;
    expect(resolveImageBox(image, 100, 'fill')).toEqual({
      sx: 50,
      sy: 0,
      sw: 100,
      sh: 100,
      dx: 0,
      dy: 0,
      dw: 100,
      dh: 100,
    });
  });

  it('fill：竖图裁掉上下溢出并铺满画布', () => {
    const image = { naturalWidth: 100, naturalHeight: 200, width: 0, height: 0 } as HTMLImageElement;
    expect(resolveImageBox(image, 80, 'fill')).toEqual({
      sx: 0,
      sy: 50,
      sw: 100,
      sh: 100,
      dx: 0,
      dy: 0,
      dw: 80,
      dh: 80,
    });
  });

  it('零尺寸源回落 1 像素下限', () => {
    const image = { naturalWidth: 0, naturalHeight: 0, width: 0, height: 0 } as HTMLImageElement;
    const box = resolveImageBox(image, 16, 'fill');
    expect(box.sw).toBe(1);
    expect(box.sh).toBe(1);
  });
});

describe('渲染数学：背景填充决策', () => {
  it('渐变背景注册两端色标并铺满画布', () => {
    const { calls, canvas } = createCanvasStub();
    fillBackground(
      canvas.getContext('2d') as CanvasRenderingContext2D,
      64,
      BACKGROUND_PRESETS.find((preset) => preset.id === 'ocean')!,
    );
    expect(calls.gradientStops).toEqual([
      { offset: 0, color: '#0a84ff' },
      { offset: 1, color: '#06b6d4' },
    ]);
    expect(calls.fillRect).toBe(1);
  });

  it('纯色背景直接使用起始色且不创建渐变', () => {
    const { calls, canvas } = createCanvasStub();
    fillBackground(
      canvas.getContext('2d') as CanvasRenderingContext2D,
      64,
      BACKGROUND_PRESETS.find((preset) => preset.id === 'white')!,
    );
    expect(calls.gradientStops).toEqual([]);
    expect(calls.fillStyleLog).toEqual(['#ffffff']);
    expect(calls.fillRect).toBe(1);
  });

  it('渐变两端相同按纯色处理', () => {
    const { calls, canvas } = createCanvasStub();
    fillBackground(canvas.getContext('2d') as CanvasRenderingContext2D, 64, {
      id: 'same',
      label: '同色',
      kind: 'gradient',
      start: '#112233',
      end: '#112233',
    });
    expect(calls.gradientStops).toEqual([]);
    expect(calls.fillStyleLog).toEqual(['#112233']);
  });
});

describe('canvas 渲染编排', () => {
  it('图片模式不额外绘制背景', async () => {
    const { calls, canvas } = createCanvasStub();

    await renderIconToCanvas(canvas, createRenderOptions({ sourceMode: 'image' }));

    expect(calls.fillRect).toBe(0);
    expect(calls.clearRect).toBe(1);
    expect(canvas.width).toBe(32);
    expect(canvas.height).toBe(32);
  });

  it('字体模式绘制背景一次并按 62% 字号居中绘制字形', async () => {
    const { calls, canvas } = createCanvasStub();
    const glyph = MATERIAL_SYMBOLS_FONT_SOURCE.glyphs[0]!;

    await renderIconToCanvas(
      canvas,
      createRenderOptions({
        size: 100,
        sourceMode: 'font',
        selectedGlyph: glyph,
      }),
    );

    expect(calls.fillRect).toBe(1);
    expect(calls.fillText).toEqual([{ text: glyph.display, x: 50, y: 52 }]);
    expect(calls.fontLog.at(-1)).toBe("400 62px 'Material Symbols Rounded', 'Material Symbols Outlined', 'Material Symbols Sharp'");
  });

  it('字体模式未选字形时只画背景', async () => {
    const { calls, canvas } = createCanvasStub();

    await renderIconToCanvas(
      canvas,
      createRenderOptions({
        sourceMode: 'font',
        selectedGlyph: null,
      }),
    );

    expect(calls.fillRect).toBe(1);
    expect(calls.fillText).toEqual([]);
  });

  it('画布 2D 上下文缺失时抛 CANVAS_UNAVAILABLE', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;

    await expect(renderIconToCanvas(canvas, createRenderOptions({}))).rejects.toThrow('CANVAS_UNAVAILABLE');
  });

  it('toBlob 为空时 PNG 编码拒绝', async () => {
    const canvas = {
      toBlob: (callback: (blob: Blob | null) => void) => {
        callback(null);
      },
    } as unknown as HTMLCanvasElement;

    await expect(canvasToPngBytes(canvas)).rejects.toThrow('PNG_ENCODE_FAILED');
  });
});
