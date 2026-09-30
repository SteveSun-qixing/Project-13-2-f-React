import { defineConfig } from 'vitest/config';

/**
 * 复用锚点：音频嵌入标签解析统一消费 `@chips/plugin-music` 已交付公开导出（W5 迁移复用
 * 红线，禁第二份拷贝）；类型解析经 tsconfig.base paths 锚定（工单003-B），测试运行时经本
 * alias 终结于工作区内已提交源码。
 */
// 测试/构建期配置，路径锚点仅服务开发机（平台优先级 macOS 优先）；非 POSIX 平台收口归属跨端波次
const projectRoot = new URL('.', import.meta.url).pathname;
const PLUGIN_MUSIC_SOURCE = `${projectRoot}../../basecards/music/src/index.ts`;

/**
 * 包级测试配置：单元测试与包级集成测试（《测试规范》《代码组织规范》§9）。
 *
 * 环境为 jsdom：界面测试与播放状态机（`<audio>` 事件面）需要 DOM；歌词/队列解析夹具经
 * 真实文件读取（tests/fixtures/，不 mock 解析器）。
 */
export default defineConfig({
  resolve: {
    alias: [{ find: '@chips/plugin-music', replacement: PLUGIN_MUSIC_SOURCE }],
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
