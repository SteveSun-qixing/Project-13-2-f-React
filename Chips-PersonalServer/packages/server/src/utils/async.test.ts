import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './async';

describe('mapWithConcurrency', () => {
  it('limits active tasks and preserves result order', async () => {
    let activeCount = 0;
    let maxActiveCount = 0;

    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);

      await new Promise((resolve) => setTimeout(resolve, 5));

      activeCount -= 1;
      return value * 10;
    });

    expect(result).toEqual([10, 20, 30, 40, 50]);
    expect(maxActiveCount).toBe(2);
  });
});
