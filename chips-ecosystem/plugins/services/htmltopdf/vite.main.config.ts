import { defineConfig } from 'vite';

/**
 * 主进程入口构建：完全自包含的 ESM 单文件，产出 dist/index.js。
 * service 角色不携带渲染入口（check-entries：service 禁止 render.js）。
 */
export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: false,
    lib: { entry: 'src/main.ts', formats: ['es'], fileName: () => 'index.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
    sourcemap: false,
  },
});
