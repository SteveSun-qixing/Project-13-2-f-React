// 源码只做拆分导出：构建以 src/main.ts 生成 dist/index.js、以 src/render.tsx 生成 render.js。
export {
  CONFIG_SCHEMA_VERSION,
  deriveAssetRefs,
  projectLinear,
  readConfig,
  validateConfig,
} from './config';
export { mainPlugin } from './main';
export { attachRuntime, renderEditor, renderLayout, renderPlugin } from './render';
export { default } from './render';
