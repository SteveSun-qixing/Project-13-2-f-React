import { describe, expect, it } from 'vitest';
import { createRequestId } from './request-id.js';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createRequestId', () => {
  it('生成 UUID v4 形态的 requestId', () => {
    expect(createRequestId()).toMatch(UUID_V4_PATTERN);
  });

  it('连续生成的标识不重复', () => {
    const ids = new Set<string>();
    for (let index = 0; index < 256; index += 1) {
      ids.add(createRequestId());
    }
    expect(ids.size).toBe(256);
  });
});
