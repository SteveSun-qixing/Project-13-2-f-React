import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rejectForbiddenImports, PLATFORM_VENDOR } from './vite.shared';

/**
 * 复用锚点：Milkdown 编辑器统一消费 `@chips/plugin-richtext` 已交付公开导出（G9 复用
 * 白名单在册；《08-官方应用功能总览》§十二「不重写富文本编辑运行时」，禁复制装配逻辑）；
 * 构建期把该 workspace 依赖解析并内联为自包含产物的一部分（book-reader 判例同构）。
 */
// 测试/构建期配置，路径锚点仅服务开发机（平台优先级 macOS 优先）；非 POSIX 平台收口归属跨端波次
const projectRoot = new URL('.', import.meta.url).pathname;
const PLUGIN_RICHTEXT_SOURCE = `${projectRoot}../../basecards/richtext/src/index.ts`;

/** 渲染入口构建：外部化平台 vendor（React、@chips/ui），产出包根 render.js。 */
export default defineConfig({
  plugins: [rejectForbiddenImports(), react()],
  resolve: {
    alias: [{ find: '@chips/plugin-richtext', replacement: PLUGIN_RICHTEXT_SOURCE }],
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
