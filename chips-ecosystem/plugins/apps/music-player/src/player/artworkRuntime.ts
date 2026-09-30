/**
 * 嵌入封面解码编排（迁移件）。
 *
 * 迁移来源：旧仓 `Chips-MusicPlayer/src/utils/artwork-runtime.ts`（覆盖矩阵「封面解码与
 * 呈现支撑」行，判迁移：ImageDecoder/createImageBitmap/canvas 转码与 ObjectURL 编排的
 * 纯 DOM 逻辑，测试随迁）。逐行保真迁移，嵌入封面类型改为消费
 * `@chips/plugin-music` 公开导出（W5 迁移复用红线，禁第二份拷贝）。
 *
 * 候裁关联（只登记，不实现）：TIFF→PNG 归一的平台能力名落档（mp G-2）前，TIFF 维持
 * 「不本地转码、按原字节直挂 blob URL」的既有语义；宿主侧归一能力落波后由伴生封面臂换接。
 */

import type { EmbeddedArtwork } from '@chips/plugin-music';

const DIRECT_RENDERABLE_ARTWORK_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
  'image/bmp',
]);

interface DecodedImageLike {
  width?: number;
  height?: number;
  displayWidth?: number;
  displayHeight?: number;
  codedWidth?: number;
  codedHeight?: number;
  close?: () => void;
}

interface ImageDecoderInstance {
  decode(): Promise<{ image: DecodedImageLike }>;
  close?(): void;
}

interface ImageDecoderConstructor {
  new (init: { type: string; data: ArrayBuffer }): ImageDecoderInstance;
  isTypeSupported?: (mimeType: string) => Promise<boolean>;
}

function normalizeMimeType(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : 'application/octet-stream';
}

function isTiffMimeType(mimeType: string): boolean {
  return mimeType === 'image/tiff' || mimeType === 'image/tif';
}

function toOwnedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copyBuffer = new ArrayBuffer(bytes.byteLength);
  const copy = new Uint8Array(copyBuffer);
  copy.set(bytes);
  return copy.buffer;
}

function toOwnedUint8Array(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copyBuffer = new ArrayBuffer(bytes.byteLength);
  const copy = new Uint8Array(copyBuffer);
  copy.set(bytes);
  return copy;
}

function createObjectUrlForBytes(bytes: Uint8Array, mimeType: string): string {
  return URL.createObjectURL(
    new Blob([toOwnedUint8Array(bytes)], {
      type: mimeType,
    }),
  );
}

function createCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }

  return document.createElement('canvas');
}

function resolveDecodedImageSize(image: DecodedImageLike): { width: number; height: number } | null {
  const width = image.displayWidth ?? image.codedWidth ?? image.width;
  const height = image.displayHeight ?? image.codedHeight ?? image.height;

  if (!Number.isFinite(width) || !Number.isFinite(height) || !width || !height) {
    return null;
  }

  return {
    width,
    height,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

async function rasterizeDecodedImageToPngBlob(image: DecodedImageLike): Promise<Blob | null> {
  const canvas = createCanvas();
  const size = resolveDecodedImageSize(image);
  if (!canvas || !size) {
    return null;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  canvas.width = size.width;
  canvas.height = size.height;
  context.drawImage(image as CanvasImageSource, 0, 0, size.width, size.height);
  return canvasToBlob(canvas);
}

async function tryDecodeWithImageDecoder(bytes: Uint8Array, mimeType: string): Promise<Blob | null> {
  const GlobalImageDecoder = (globalThis as { ImageDecoder?: ImageDecoderConstructor }).ImageDecoder;
  if (!GlobalImageDecoder) {
    return null;
  }

  const isTypeSupported = GlobalImageDecoder.isTypeSupported;

  if (typeof isTypeSupported === 'function') {
    try {
      const supported = await isTypeSupported(mimeType);
      if (!supported) {
        return null;
      }
    } catch {
      return null;
    }
  }

  try {
    const decoder = new GlobalImageDecoder({
      type: mimeType,
      data: toOwnedArrayBuffer(bytes),
    });
    const decoded = await decoder.decode();
    const pngBlob = await rasterizeDecodedImageToPngBlob(decoded.image);
    decoded.image.close?.();
    decoder.close?.();
    return pngBlob;
  } catch {
    return null;
  }
}

async function tryDecodeWithImageBitmap(bytes: Uint8Array, mimeType: string): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(
      new Blob([toOwnedUint8Array(bytes)], {
        type: mimeType,
      }),
    );
    // ImageBitmap 结构面（width/height/close）与 DecodedImageLike 兼容，无需断言。
    const pngBlob = await rasterizeDecodedImageToPngBlob(bitmap);
    bitmap.close();
    return pngBlob;
  } catch {
    return null;
  }
}

export async function convertEmbeddedArtworkToPngBytes(artwork: EmbeddedArtwork): Promise<Uint8Array | null> {
  const mimeType = normalizeMimeType(artwork.mimeType);

  if (isTiffMimeType(mimeType)) {
    return null;
  }

  const decodedByImageDecoder = await tryDecodeWithImageDecoder(artwork.bytes, mimeType);
  if (decodedByImageDecoder) {
    return new Uint8Array(await decodedByImageDecoder.arrayBuffer());
  }

  const decodedByImageBitmap = await tryDecodeWithImageBitmap(artwork.bytes, mimeType);
  if (decodedByImageBitmap) {
    return new Uint8Array(await decodedByImageBitmap.arrayBuffer());
  }

  return null;
}

export async function resolveEmbeddedArtworkUrl(artwork: EmbeddedArtwork): Promise<string> {
  const mimeType = normalizeMimeType(artwork.mimeType);
  if (DIRECT_RENDERABLE_ARTWORK_MIME_TYPES.has(mimeType)) {
    return createObjectUrlForBytes(artwork.bytes, mimeType);
  }

  if (isTiffMimeType(mimeType)) {
    return createObjectUrlForBytes(artwork.bytes, mimeType);
  }

  const transcodedPngBytes = await convertEmbeddedArtworkToPngBytes(artwork);
  if (transcodedPngBytes) {
    return createObjectUrlForBytes(transcodedPngBytes, 'image/png');
  }

  return createObjectUrlForBytes(artwork.bytes, mimeType);
}
