// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { bytesToDataUri } from '../../src/core/binary';

const globalWithOptionalBuffer = globalThis as typeof globalThis & {
  Buffer?: unknown;
};

const originalBuffer = globalWithOptionalBuffer.Buffer;

afterEach(() => {
  (globalWithOptionalBuffer as Record<string, unknown>).Buffer = originalBuffer;
});

describe('bytesToDataUri', () => {
  it('在浏览器回退分支中也能处理较大的二进制资源', () => {
    (globalWithOptionalBuffer as Record<string, unknown>).Buffer = undefined;

    const bytes = new Uint8Array(96_000);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index % 251;
    }

    const uri = bytesToDataUri(bytes, 'image/png');

    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
    expect(uri.length).toBeGreaterThan(100_000);
  });
});
