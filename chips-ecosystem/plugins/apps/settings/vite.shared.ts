import type { Plugin } from 'vite';

/** 平台帧运行时提供的共享依赖：构建必须外部化并重写为固定 vendor URL（R4、RR-14）。 */
export const PLATFORM_VENDOR: Readonly<Record<string, string>> = {
  react: 'chips-resource://platform/vendor/react.js',
  'react/jsx-runtime': 'chips-resource://platform/vendor/react-jsx-runtime.js',
  'react-dom': 'chips-resource://platform/vendor/react-dom.js',
  'react-dom/client': 'chips-resource://platform/vendor/react-dom-client.js',
  '@chips/ui': 'chips-resource://platform/vendor/chips-ui.js',
};

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

/** 构建期红线守卫：命中禁止导入即构建失败（第一道防线是 ESLint no-restricted-imports）。 */
export function rejectForbiddenImports(): Plugin {
  return {
    name: 'chips:reject-forbidden-imports',
    resolveId(source: string): null {
      const hit = FORBIDDEN_SPECIFIERS.some(
        (prefix) => source === prefix || source.startsWith(prefix)
      );
      if (hit) {
        this.error(`R4 违规导入：${source}；UI 与类型请从 @chips/ui、@chips/sdk 导入`);
      }
      return null;
    },
  };
}
