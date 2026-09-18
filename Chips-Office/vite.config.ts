import { createRequire } from 'node:module'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const projectRoot = dirname(fileURLToPath(import.meta.url))

const require = createRequire(import.meta.url)
const pdfjsRoot = dirname(dirname(require.resolve('pdfjs-dist/package.json')))
// vite-plugin-static-copy globs require POSIX separators
const pdfjsDir = (sub: string) => normalize(join(pdfjsRoot, 'pdfjs-dist', sub)).replace(/\\/g, '/')

const genofficeAlias = (pkg: string) => ({
  find: new RegExp(`^@genoffice/${pkg}$`),
  replacement: join(projectRoot, `vendor/${pkg}/src/index.ts`),
})
const genofficeSubAlias = (pkg: string) => ({
  find: new RegExp(`^@genoffice/${pkg}/(.+)$`),
  replacement: join(projectRoot, `vendor/${pkg}/src/$1`),
})

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: pdfjsDir('cmaps'), dest: 'pdfjs' },
        { src: pdfjsDir('standard_fonts'), dest: 'pdfjs' },
        { src: pdfjsDir('wasm'), dest: 'pdfjs' },
      ],
    }),
  ],
  resolve: {
    alias: [
      genofficeAlias('docx-engine'),
      genofficeSubAlias('docx-engine'),
      genofficeAlias('pptx-engine'),
      genofficeSubAlias('pptx-engine'),
      genofficeAlias('pptx-render'),
      genofficeSubAlias('pptx-render'),
      genofficeAlias('ui'),
      genofficeSubAlias('ui'),
      genofficeAlias('i18n'),
      genofficeAlias('font-metrics'),
      { find: /^@app\/(.+)$/, replacement: join(projectRoot, 'src/$1') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-univer': [
            '@univerjs/core',
            '@univerjs/data-validation',
            '@univerjs/engine-render',
            '@univerjs/find-replace',
            '@univerjs/preset-sheets-conditional-formatting',
            '@univerjs/preset-sheets-core',
            '@univerjs/preset-sheets-data-validation',
            '@univerjs/preset-sheets-drawing',
            '@univerjs/preset-sheets-filter',
            '@univerjs/preset-sheets-find-replace',
            '@univerjs/preset-sheets-note',
            '@univerjs/preset-sheets-sort',
            '@univerjs/preset-sheets-table',
            '@univerjs/sheets-filter',
            '@univerjs/themes',
          ],
          'vendor-pdf': ['pdfjs-dist', 'pdf-lib', '@embedpdf/pdfium'],
          'vendor-slides': ['konva', 'react-konva', 'opentype.js', 'harfbuzzjs', 'utif2', 'acorn'],
          'vendor-tiptap': ['@tiptap/core', '@tiptap/pm', '@tiptap/react', '@tiptap/extensions'],
          'vendor-xml': ['fast-xml-parser', 'jszip'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
})
