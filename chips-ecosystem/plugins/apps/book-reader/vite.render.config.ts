import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rejectForbiddenImports, PLATFORM_VENDOR } from './vite.shared';

/**
 * 复用锚点：ZIP 解析统一消费 `@chips/plugin-book` 已交付公开导出（W5 迁移复用红线）；
 * 构建期把该 workspace 依赖解析并内联进 render.js（React 与 @chips/ui 仍外部化为平台 vendor）。
 */
// 测试/构建期配置，路径锚点仅服务开发机（平台优先级 macOS 优先）；非 POSIX 平台收口归属跨端波次
const projectRoot = new URL('.', import.meta.url).pathname;
const PLUGIN_BOOK_SOURCE = `${projectRoot}../../basecards/book/src/index.ts`;

/** 渲染入口构建：外部化平台 vendor（React、@chips/ui），产出包根 render.js。 */
export default defineConfig({
  plugins: [rejectForbiddenImports(), react()],
  resolve: {
    alias: [{ find: '@chips/plugin-book', replacement: PLUGIN_BOOK_SOURCE }],
  },
  build: {
    target: 'chrome118',
    outDir: '.',
    emptyOutDir: false,
    copyPublicDir: false,
    assetsInlineLimit: 0,
    lib: { entry: 'src/ui/AppView.tsx', formats: ['es'], fileName: () => 'render.js' },
    rollupOptions: {
      external: Object.keys(PLATFORM_VENDOR),
      output: { paths: PLATFORM_VENDOR, inlineDynamicImports: true },
    },
    sourcemap: false,
  },
});
