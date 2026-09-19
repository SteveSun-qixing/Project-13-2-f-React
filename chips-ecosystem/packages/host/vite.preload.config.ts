import { defineConfig } from 'vite';

/**
 * preload 构建：CJS 单文件，外部化 `electron`（沙箱 preload 不支持 ESM）。
 *
 * 权威：`06-开发与运维/02-构建与打包` §5.1、`ADR-002` §IPC 通信。
 */
export default defineConfig({
  build: {
    outDir: 'dist/preload',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: 'src/preload/index.ts',
      external: ['electron'],
      output: {
        format: 'cjs',
        entryFileNames: 'index.js',
        inlineDynamicImports: true,
      },
    },
  },
});
