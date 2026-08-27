import { it, expect, vi } from 'vitest';
vi.mock('../src/cache/redis.js', () => ({ getRedis: () => ({ lpush: async () => undefined }) }));
it('resolve', async () => {
  const m = await import('../src/cache/redis.js');
  console.log('KEYS', Object.keys(m));
  console.log('getRedis type', typeof m.getRedis);
  expect(typeof m.getRedis).toBe('function');
});
