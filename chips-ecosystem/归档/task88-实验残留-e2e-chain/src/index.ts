// 源码只做拆分导出：构建以 src/main.ts 生成 dist/index.js、以 src/render.tsx 生成 render.js。
export { validateConfig, createInitialContent, collectResourcePaths, mainPlugin } from './main';
export { renderPlugin, renderView, renderEditor, export as exportCard } from './render';
export { default } from './render';
