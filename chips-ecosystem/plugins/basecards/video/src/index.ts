// 源码只做拆分导出（08-基础卡片插件接口 §2.5）：构建以 src/main.ts 生成 dist/index.js、以 src/render.tsx 生成 render.js。
export { validateConfig, createInitialContent, collectResourcePaths } from './main';
export { renderView, renderEditor, renderPlugin } from './render';
export { default } from './render';
