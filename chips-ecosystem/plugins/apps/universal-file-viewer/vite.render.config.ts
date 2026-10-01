import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rejectForbiddenImports, PLATFORM_VENDOR } from './vite.shared';

/**
 * 渲染入口构建：外部化平台 vendor（React、@chips/ui），产出包根 render.js。
 *
 * 重依赖分包（RA-08 风险③红线）：引擎 18 格式插件的按需依赖（pdfjs/mermaid/three/xlsx/
 * leaflet/mammoth 等）经引擎内部动态 `import()` 自然分包，落 `dist/`（CPK 布局允许
 * dist/ 携带代码文件）；render.js 只保留壳层与引擎探测路由核心，首屏不载重依赖，
 * 单文件满足 16 MiB 上限。
 */
export default defineConfig({
  plugins: [rejectForbiddenImports(), react()],
  build: {
    target: 'chrome118',
    outDir: '.',
    emptyOutDir: false,
    copyPublicDir: false,
    assetsInlineLimit: 0,
    lib: { entry: 'src/ui/AppView.tsx', formats: ['es'], fileName: () => 'render.js' },
    rollupOptions: {
      external: Object.keys(PLATFORM_VENDOR),
      output: {
        paths: PLATFORM_VENDOR,
        entryFileNames: 'render.js',
        chunkFileNames: 'dist/[name].js',
        assetFileNames: 'dist/assets/[name][extname]',
      },
    },
    sourcemap: false,
  },
});
