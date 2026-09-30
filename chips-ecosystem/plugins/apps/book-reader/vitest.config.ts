import { defineConfig } from 'vitest/config';

/**
 * 复用锚点：ZIP 解析统一消费 `@chips/plugin-book` 已交付公开导出（W5 迁移复用红线，
 * 禁第二份拷贝）；类型解析经 tsconfig.base paths 锚定（工单003-B），测试运行时经本
 * alias 终结于工作区内已提交源码。
 */
// 测试/构建期配置，路径锚点仅服务开发机（平台优先级 macOS 优先）；非 POSIX 平台收口归属跨端波次
const projectRoot = new URL('.', import.meta.url).pathname;
const PLUGIN_BOOK_SOURCE = `${projectRoot}../../basecards/book/src/index.ts`;

/** 包级测试配置：单元测试与包级集成测试（《测试规范》《代码组织规范》§9）。 */
export default defineConfig({
  resolve: {
    alias: [{ find: '@chips/plugin-book', replacement: PLUGIN_BOOK_SOURCE }],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // ReadiumCSS 文本经 `?raw` 编译期内联：测试需拿到真实文本（默认对 CSS 返回空桩）。
    css: true,
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}'],
    },
  },
});
