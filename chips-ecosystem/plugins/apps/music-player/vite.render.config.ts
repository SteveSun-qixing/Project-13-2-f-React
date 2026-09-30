import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rejectForbiddenImports, PLATFORM_VENDOR } from './vite.shared';

/** 渲染入口构建：外部化平台 vendor（React、@chips/ui），产出包根 render.js。 */
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
      output: { paths: PLATFORM_VENDOR, inlineDynamicImports: true },
    },
    sourcemap: false,
  },
});
