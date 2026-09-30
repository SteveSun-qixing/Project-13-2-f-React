import type { Plugin } from 'vite';

/**
 * 构建期红线守卫（与生态插件包同一形制）：
 * - 禁止第二套组件库与平台内部包直连（R4）；
 * - 禁止 `node:*` / `electron`：服务插件运行于受管加载器，宿主加载门禁只放行相对路径模块，
 *   构建产物必须完全自包含（dist/index.js 单文件），任何命中即构建失败。
 */
const FORBIDDEN_SPECIFIERS: readonly string[] = [
  'antd',
  '@chips/antd',
  '@chips/bridge',
  '@chips/host',
  '@mui/',
  '@chakra-ui/',
  'electron',
  'node:',
];

export function rejectForbiddenImports(): Plugin {
  return {
    name: 'chips:reject-forbidden-imports',
    resolveId(source: string): null {
      const hit = FORBIDDEN_SPECIFIERS.some(
        (prefix) => source === prefix || source.startsWith(prefix)
      );
      if (hit) {
        this.error(`R4 违规导入：${source}；服务实现必须自包含，类型与错误模型从 @chips/sdk 导入`);
      }
      return null;
    },
  };
}
