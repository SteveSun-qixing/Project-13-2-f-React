import { defineConfig } from 'vite';
import { rejectForbiddenImports } from './vite.shared';

/**
 * 复用锚点：ZIP 解析统一消费 `@chips/plugin-book` 已交付公开导出（W5 迁移复用红线）；
 * 构建期把该 workspace 依赖解析并内联为自包含产物的一部分。
 */
// 测试/构建期配置，路径锚点仅服务开发机（平台优先级 macOS 优先）；非 POSIX 平台收口归属跨端波次
const projectRoot = new URL('.', import.meta.url).pathname;
const PLUGIN_BOOK_SOURCE = `${projectRoot}../../basecards/book/src/index.ts`;

/** 主进程入口构建：完全自包含的 ESM 单文件，产出 dist/index.js。 */
export default defineConfig({
  plugins: [rejectForbiddenImports()],
  resolve: {
    alias: [{ find: '@chips/plugin-book', replacement: PLUGIN_BOOK_SOURCE }],
  },
  build: {
    target: 'node18',
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: false,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'index.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
    sourcemap: false,
  },
});
