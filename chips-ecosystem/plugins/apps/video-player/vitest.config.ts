import { defineConfig } from 'vitest/config';

/** 包级测试配置：单元测试与包级集成测试（《测试规范》《代码组织规范》§9）。 */
export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    server: {
      deps: {
        inline: [/@chips\/ui/, /@chips\/antd/, /[\\/]antd[\\/]/, /@ant-design/, /@rc-component/, /[\\/]rc-/],
      },
    },
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}'],
    },
  },
});
