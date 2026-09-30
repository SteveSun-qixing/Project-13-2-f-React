import { defineConfig, type Plugin } from 'vite';

/**
 * 构建期红线守卫：命中禁止导入即构建失败
 * （第一道防线是根 ESLint no-restricted-imports；服务插件无 UI 面，
 * 且不得直接访问 Node.js / Electron / 系统 API——04-能力契约规范 §8.3）。
 */
const FORBIDDEN_SPECIFIERS: readonly string[] = [
  'antd',
  '@chips/antd',
  '@chips/bridge',
  '@chips/host',
  '@chips/ui',
  '@mui/',
  '@chakra-ui/',
  'electron',
  'node:',
];

function rejectForbiddenImports(): Plugin {
  return {
    name: 'chips:reject-forbidden-imports',
    resolveId(source: string): null {
      const hit = FORBIDDEN_SPECIFIERS.some(
        (prefix) => source === prefix || source.startsWith(prefix)
      );
      if (hit) {
        this.error(`服务插件违规导入：${source}；系统访问只能经 ctx.bridge 正式链路（04-能力契约规范 §8.3）`);
      }
      return null;
    },
  };
}

/**
 * 主进程入口构建：完全自包含的 ESM 单文件，产出 dist/index.js。
 * service 角色不携带渲染入口（check-entries：service 禁止 render.js）。
 */
export default defineConfig({
  plugins: [rejectForbiddenImports()],
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
