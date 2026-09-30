import { defineConfig } from 'vite';
import { rejectForbiddenImports } from './vite.shared';

/**
 * 复用锚点：音频嵌入标签解析统一消费 `@chips/plugin-music` 已交付公开导出（W5 迁移复用
 * 红线，收口 mp G-3 双解析源）；构建期把该 workspace 依赖解析并内联为自包含产物的一部分。
 */
// 测试/构建期配置，路径锚点仅服务开发机（平台优先级 macOS 优先）；非 POSIX 平台收口归属跨端波次
const projectRoot = new URL('.', import.meta.url).pathname;
const PLUGIN_MUSIC_SOURCE = `${projectRoot}../../basecards/music/src/index.ts`;

/** 主进程入口构建：完全自包含的 ESM 单文件，产出 dist/index.js。 */
export default defineConfig({
  plugins: [rejectForbiddenImports()],
  resolve: {
    alias: [{ find: '@chips/plugin-music', replacement: PLUGIN_MUSIC_SOURCE }],
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
