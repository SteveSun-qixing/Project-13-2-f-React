import { defineConfig } from 'vitest/config';

/**
 * 复用锚点：`@chips/plugin-richtext` 公开导出消费（G9 复用白名单在册）；类型解析经
 * tsconfig.base paths 锚定（工单003-B），测试运行时经本 alias 终结于工作区内已提交源码
 * （book-reader 判例同构）。
 */
// 测试/构建期配置，路径锚点仅服务开发机（平台优先级 macOS 优先）；非 POSIX 平台收口归属跨端波次
const projectRoot = new URL('.', import.meta.url).pathname;
const PLUGIN_RICHTEXT_SOURCE = `${projectRoot}../../basecards/richtext/src/index.ts`;

/** 包级测试配置：单元测试与包级集成测试（《测试规范》《代码组织规范》§9）。 */
export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [{ find: '@chips/plugin-richtext', replacement: PLUGIN_RICHTEXT_SOURCE }],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}'],
    },
  },
});
