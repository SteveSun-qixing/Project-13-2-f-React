import { defineConfig } from 'vite';
import { rejectForbiddenImports } from './vite.shared';

/** 服务入口构建：完全自包含的 ESM 单文件，产出 dist/index.js（check-entries 判定基线）。 */
export default defineConfig({
  plugins: [rejectForbiddenImports()],
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
