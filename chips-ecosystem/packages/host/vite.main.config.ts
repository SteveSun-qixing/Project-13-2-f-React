import { defineConfig } from 'vite';

/**
 * 主进程构建：CJS，外部化 `electron`、`node:*` 与原生模块（`*.node`）。
 *
 * 权威：`06-开发与运维/02-构建与打包` §5.1（产物与模块形态）。
 */
export default defineConfig({
  build: {
    outDir: 'dist/main',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'src/main/main.ts',
        'self-check': 'src/main/self-check.ts',
        app: 'src/main/app.ts',
        // 金链路刀7（任务 #114 段B）：E2E 真进程入口——与正式入口共用启动编排，
        // 仅在环境变量指认测试侧接线模块时装载 document:* 注入项（工单 036 §六 tests/ 注入面）。
        'e2e-app': 'src/main/e2e-app.ts',
      },
      external: (id: string) => id === 'electron' || id.startsWith('node:') || id.endsWith('.node'),
      output: {
        format: 'cjs',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
