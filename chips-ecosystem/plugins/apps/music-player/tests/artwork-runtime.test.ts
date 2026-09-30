import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { EmbeddedArtwork } from '@chips/plugin-music';
import { convertEmbeddedArtworkToPngBytes, resolveEmbeddedArtworkUrl } from '../src/player/artworkRuntime';

/**
 * 嵌入封面解码编排判例（随迁自旧仓 tests/unit/artwork-runtime.test.ts）。
 * 嵌入封面类型消费 `@chips/plugin-music` 公开导出（复用红线在判例中同样成立）。
 */

function createArtwork(mimeType: string, bytes: number[]): EmbeddedArtwork {
  return {
    mimeType,
    bytes: Uint8Array.from(bytes),
  };
}

const mockObjectUrls = (): MockInstance<(object: Blob | MediaSource) => string> => {
  const spy = vi.spyOn(URL, 'createObjectURL');
  spy.mockImplementation((object: Blob | MediaSource): string =>
    object instanceof Blob ? `blob:${object.type}:${object.size}` : 'blob:media-source',
  );
  return spy;
};

const installCanvasStub = (): { canvas: Record<string, unknown>; drawImage: ReturnType<typeof vi.fn> } => {
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn((): { drawImage: ReturnType<typeof vi.fn> } => ({
      drawImage,
    })),
    toBlob: vi.fn((callback: BlobCallback) => {
      callback(new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }));
    }),
  };

  vi.stubGlobal('document', {
    createElement: vi.fn(() => canvas),
  });

  return {
    canvas,
    drawImage,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('embedded artwork runtime handling', () => {
  it('keeps browser-friendly artwork formats as direct blob urls', async () => {
    const createObjectURL = mockObjectUrls();

    const url = await resolveEmbeddedArtworkUrl(createArtwork('image/jpeg', [0xff, 0xd8, 0xff]));
    const firstCallObject = createObjectURL.mock.calls[0]?.[0];

    expect(url).toBe('blob:image/jpeg:3');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(firstCallObject).toBeInstanceOf(Blob);
    expect((firstCallObject as Blob).type).toBe('image/jpeg');
  });

  it('transcodes unsupported artwork through ImageDecoder when available', async () => {
    const createObjectURL = mockObjectUrls();
    const { canvas, drawImage } = installCanvasStub();
    const imageClose = vi.fn();

    class FakeImageDecoder {
      static isTypeSupported(mimeType: string): Promise<boolean> {
        return Promise.resolve(mimeType === 'image/heic');
      }

      constructor(_init: { type: string; data: ArrayBuffer }) {}

      decode(): Promise<{ image: { displayWidth: number; displayHeight: number; close: () => void } }> {
        return Promise.resolve({
          image: {
            displayWidth: 300,
            displayHeight: 300,
            close: imageClose,
          },
        });
      }

      close(): void {}
    }

    vi.stubGlobal('ImageDecoder', FakeImageDecoder);

    const url = await resolveEmbeddedArtworkUrl(createArtwork('image/heic', [0x00, 0x00, 0x00, 0x18]));

    expect(url).toBe('blob:image/png:4');
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(300);
    expect(imageClose).toHaveBeenCalledTimes(1);
    expect((createObjectURL.mock.calls[0]?.[0] as Blob).type).toBe('image/png');
  });

  it('does not duplicate Host TIFF conversion in the renderer fallback', async () => {
    const createObjectURL = mockObjectUrls();
    const tiffBytes = [0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08];
    const pngBytes = await convertEmbeddedArtworkToPngBytes(createArtwork('image/tiff', tiffBytes));
    const url = await resolveEmbeddedArtworkUrl(createArtwork('image/tiff', tiffBytes));

    expect(pngBytes).toBeNull();
    expect(url).toBe('blob:image/tiff:8');
    expect((createObjectURL.mock.calls[0]?.[0] as Blob).type).toBe('image/tiff');
  });

  it('falls back to the original artwork blob when runtime transcoding is unavailable', async () => {
    const createObjectURL = mockObjectUrls();

    class FakeImageDecoder {
      static isTypeSupported(): Promise<boolean> {
        return Promise.resolve(false);
      }
    }

    vi.stubGlobal('ImageDecoder', FakeImageDecoder);

    const url = await resolveEmbeddedArtworkUrl(createArtwork('image/heic', [0x00, 0x00, 0x00, 0x18]));

    expect(url).toBe('blob:image/heic:4');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect((createObjectURL.mock.calls[0]?.[0] as Blob).type).toBe('image/heic');
  });

  it('falls back to createImageBitmap when ImageDecoder is absent', async () => {
    mockObjectUrls();
    const { drawImage } = installCanvasStub();

    vi.stubGlobal('createImageBitmap', (): Promise<{ width: number; height: number; close: () => void }> => {
      return Promise.resolve({ width: 64, height: 64, close: vi.fn() });
    });

    const url = await resolveEmbeddedArtworkUrl(createArtwork('image/heic', [0x00, 0x00, 0x00, 0x18]));

    expect(url).toBe('blob:image/png:4');
    expect(drawImage).toHaveBeenCalledTimes(1);
  });
});
