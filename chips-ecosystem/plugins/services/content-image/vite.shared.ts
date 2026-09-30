import type { Plugin } from 'vite';

/**
 * 构建期红线守卫：命中禁止导入即构建失败。
 *
 * service 角色运行在主进程插件执行通道内：不得触达 UI 组件库（antd / @chips/antd /
 * @chips/ui）、不得直连 Node / Electron 与宿主内部包
 * （04-能力契约规范 §8.3 原子操作约束 5、R4、R11）。
 * 第一道防线是根 ESLint `no-restricted-imports`，本守卫是构建期二道防线。
 */
const FORBIDDEN_SPECIFIERS: readonly string[] = [
  'antd',
  '@chips/antd',
  '@chips/ui',
  '@chips/bridge',
  '@chips/host',
  '@chips/native',
  '@mui/',
  '@chakra-ui/',
  'electron',
  'node:',
  'sharp',
];

/** 构建期红线守卫插件。 */
export function rejectForbiddenImports(): Plugin {
  return {
    name: 'chips:reject-forbidden-imports',
    resolveId(source: string): null {
      const hit = FORBIDDEN_SPECIFIERS.some(
        (prefix) => source === prefix || source.startsWith(prefix)
      );
      if (hit) {
        this.error(`R4 / R11 违规导入：${source}；服务插件只允许 @chips/sdk 正式链路`);
      }
      return null;
    },
  };
}
