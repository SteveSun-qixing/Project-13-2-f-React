/**
 * Canvas 渲染管线（旧 Chip-iconMaker/src/icon-workbench/canvas-renderer.ts 逐字迁移）。
 *
 * 相对旧面的登记适配（W5 迁移日志）：`resolveImageBox` 与 `fillBackground` 由模块内私有
 * 函数改为具名导出——渲染数学（裁剪/适配盒与背景填充判定）须以真实输入输出断言直测
 * （渲染数学不 mock）；算法分支、数值与边界条件与旧面逐字一致。
 */

import { loadImageElement } from './image-loader';
import type { IconBackgroundSelection, RenderIconOptions } from './types';

export function fillBackground(
  context: CanvasRenderingContext2D,
  size: number,
  background: IconBackgroundSelection,
): void {
  if (background.kind === 'gradient' && background.start !== background.end) {
    const gradient = context.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, background.start);
    gradient.addColorStop(1, background.end);
    context.fillStyle = gradient;
  } else {
    context.fillStyle = background.start;
  }
  context.fillRect(0, 0, size, size);
}

export interface ImageDrawBox {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export function resolveImageBox(image: HTMLImageElement, size: number, fit: 'fit' | 'fill'): ImageDrawBox {
  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const sourceRatio = sourceWidth / sourceHeight;

  if (fit === 'fill') {
    const cropWidth = sourceRatio > 1 ? sourceHeight : sourceWidth;
    const cropHeight = sourceRatio > 1 ? sourceHeight : sourceWidth;
    return {
      sx: Math.max(0, (sourceWidth - cropWidth) / 2),
      sy: Math.max(0, (sourceHeight - cropHeight) / 2),
      sw: cropWidth,
      sh: cropHeight,
      dx: 0,
      dy: 0,
      dw: size,
      dh: size,
    };
  }

  const padding = Math.max(0, Math.round(size * 0.08));
  const maxSize = Math.max(1, size - padding * 2);
  const drawWidth = sourceRatio >= 1 ? maxSize : Math.round(maxSize * sourceRatio);
  const drawHeight = sourceRatio >= 1 ? Math.round(maxSize / sourceRatio) : maxSize;

  return {
    sx: 0,
    sy: 0,
    sw: sourceWidth,
    sh: sourceHeight,
    dx: Math.round((size - drawWidth) / 2),
    dy: Math.round((size - drawHeight) / 2),
    dw: drawWidth,
    dh: drawHeight,
  };
}

async function drawImageSource(context: CanvasRenderingContext2D, options: RenderIconOptions): Promise<void> {
  if (!options.imageSource) {
    return;
  }

  const image = await loadImageElement(options.imageSource.objectUrl);
  const box = resolveImageBox(image, options.size, options.settings.imageFit);
  context.drawImage(image, box.sx, box.sy, box.sw, box.sh, box.dx, box.dy, box.dw, box.dh);
}

function drawFontSource(context: CanvasRenderingContext2D, options: RenderIconOptions): void {
  if (!options.selectedGlyph) {
    return;
  }

  const fontSize = Math.round(options.size * 0.62);
  context.fillStyle = options.settings.foregroundColor;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `400 ${fontSize}px ${options.fontSource.family}`;
  context.fillText(options.selectedGlyph.display, options.size / 2, options.size / 2 + Math.round(options.size * 0.02));
}

export async function renderIconCanvas(options: RenderIconOptions): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  await renderIconToCanvas(canvas, options);
  return canvas;
}

export async function renderIconToCanvas(canvas: HTMLCanvasElement, options: RenderIconOptions): Promise<void> {
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('CANVAS_UNAVAILABLE');
  }

  canvas.width = options.size;
  canvas.height = options.size;
  context.clearRect(0, 0, options.size, options.size);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  if (options.sourceMode === 'image') {
    await drawImageSource(context, options);
  } else {
    fillBackground(context, options.size, options.settings.background);
    drawFontSource(context, options);
  }
}

export function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG_ENCODE_FAILED'));
        return;
      }

      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject);
    }, 'image/png');
  });
}
