import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: 'src/renderer/shell-window.ts',
      output: {
        format: 'iife',
        entryFileNames: 'shell-window.js',
      },
    },
  },
});
