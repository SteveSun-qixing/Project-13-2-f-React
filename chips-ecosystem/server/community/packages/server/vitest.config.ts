import { defineConfig } from 'vitest/config';

/** 包级测试配置：路由契约测试与域逻辑测试（Node 环境，真实 PG 不引入测试，端口一律 fake）。 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/db/migrations/**'],
    },
  },
});
