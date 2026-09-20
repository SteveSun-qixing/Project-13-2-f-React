import type { IScaffoldContext, IScaffoldFile, PluginRole } from '../types.js';
import { emitYaml, type YamlValue } from '../yaml.js';
import { buildAppFiles } from './app.js';
import { buildBasecardFiles } from './basecard.js';
import { buildBoxlayoutFiles } from './boxlayout.js';
import {
  packageJson,
  readmeMd,
  tsconfigJson,
  viteMainConfigTs,
  viteRenderConfigTs,
  viteSharedTs,
  vitestConfigTs,
} from './shared.js';
import { buildServiceFiles } from './service.js';

/** 渲染入口源码路径：主进程入口之外的第二个构建入口。 */
export const RENDER_ENTRY_BY_ROLE: Readonly<Partial<Record<PluginRole, string>>> = {
  basecard: 'src/render.tsx',
  boxlayout: 'src/render.tsx',
  app: 'src/ui/AppView.tsx',
};

/** 主进程入口源码路径。 */
export const MAIN_ENTRY_BY_ROLE: Readonly<Record<PluginRole, string>> = {
  basecard: 'src/main.ts',
  boxlayout: 'src/main.ts',
  app: 'src/index.ts',
  service: 'src/index.ts',
};

const ROLE_DESCRIPTIONS: Readonly<Record<PluginRole, string>> = {
  basecard: '基础卡片插件：卡片类型注册、查看与编辑渲染、配置校验与内容初值',
  boxlayout: '箱子布局插件：布局类型注册、响应式布局算法与布局配置编辑',
  app: '应用插件：独立窗口、启动器入口与 React 界面',
  service: '服务插件：后台生命周期、健康检查与配置访问',
};

function roleNextStep(role: PluginRole, packageName: string): string {
  switch (role) {
    case 'basecard':
      return (
        `实现卡片接口后，执行 \`pnpm --filter ${packageName} run build\`，再用 ` +
        '`chips dev plugin install` 安装到开发工作区，由查看器与编辑引擎打开卡片触发装载；' +
        '`chips dev run` 只面向 `app` 角色。'
      );
    case 'boxlayout':
      return (
        `实现布局接口后，执行 \`pnpm --filter ${packageName} run build\`，再用 ` +
        '`chips dev plugin install` 安装到开发工作区，打开引用该布局类型的箱子触发装载。'
      );
    case 'app':
      return `执行 \`pnpm --filter ${packageName} run build\` 后用 \`chips dev run\` 启动开发宿主联调窗口。`;
    case 'service':
      return `执行 \`pnpm --filter ${packageName} run build\` 后用 \`chips dev service invoke\` 联调能力调用与生命周期。`;
  }
}

/** 返回角色模板的规范文件路径列表（用于 `listScaffoldTemplates`）。 */
export function scaffoldFilePaths(role: PluginRole, assetSlug: string): readonly string[] {
  const common = [
    'manifest.yaml',
    'package.json',
    'tsconfig.json',
    'README.md',
    'vite.shared.ts',
    'vite.main.config.ts',
    'vitest.config.ts',
    ...(RENDER_ENTRY_BY_ROLE[role] === undefined ? [] : ['vite.render.config.ts']),
  ];
  switch (role) {
    case 'basecard':
      return [
        ...common,
        'src/config.ts',
        'src/main.ts',
        'src/render.tsx',
        'src/index.ts',
        `assets/icons/${assetSlug}.svg`,
        `assets/schemas/${assetSlug}-config.schema.json`,
        'tests/config.test.ts',
      ];
    case 'boxlayout':
      return [
        ...common,
        'src/config.ts',
        'src/main.ts',
        'src/render.tsx',
        'src/index.ts',
        `assets/icons/${assetSlug}.svg`,
        `assets/schemas/${assetSlug}-config.schema.json`,
        'tests/render.test.ts',
      ];
    case 'app':
      return [
        ...common,
        'src/index.ts',
        'src/ui/AppView.tsx',
        'assets/icons/app.svg',
        'tests/app.test.ts',
      ];
    case 'service':
      return [
        ...common,
        'src/index.ts',
        'assets/schemas/config.schema.json',
        'tests/service.test.ts',
      ];
  }
}

/** 角色描述文本。 */
export function roleDescription(role: PluginRole): string {
  return ROLE_DESCRIPTIONS[role];
}

function buildRoleFiles(context: IScaffoldContext): IScaffoldFile[] {
  switch (context.options.role) {
    case 'basecard':
      return buildBasecardFiles(context);
    case 'boxlayout':
      return buildBoxlayoutFiles(context);
    case 'app':
      return buildAppFiles(context);
    case 'service':
      return buildServiceFiles(context);
  }
}

function tsconfigIncludes(role: PluginRole): readonly string[] {
  const include = ['src', 'tests', 'vite.shared.ts', 'vite.main.config.ts', 'vitest.config.ts'];
  if (RENDER_ENTRY_BY_ROLE[role] !== undefined) {
    include.push('vite.render.config.ts');
  }
  return include;
}

/** `vitest.config.ts` 的运行环境：`boxlayout` 的渲染测试需要 DOM，其余角色为 Node。 */
function testEnvironment(role: PluginRole): 'node' | 'jsdom' {
  return role === 'boxlayout' ? 'jsdom' : 'node';
}

/** 装配一个角色的完整文件计划：公共文件 + 构建配置 + 角色文件。 */
export function buildScaffoldFiles(context: IScaffoldContext): IScaffoldFile[] {
  const { role } = context.options;
  const mainEntry = MAIN_ENTRY_BY_ROLE[role];
  const renderEntry = RENDER_ENTRY_BY_ROLE[role];

  const commonFiles: IScaffoldFile[] = [
    {
      path: 'manifest.yaml',
      content: emitYaml(context.manifest as unknown as YamlValue),
    },
    {
      path: 'package.json',
      content: packageJson(
        context,
        {
          build:
            renderEntry === undefined
              ? 'vite build --config vite.main.config.ts'
              : 'vite build --config vite.main.config.ts && vite build --config vite.render.config.ts',
          test: 'vitest run',
        },
        packageDevDependencies(context)
      ),
    },
    { path: 'tsconfig.json', content: tsconfigJson(context, tsconfigIncludes(role)) },
    { path: 'README.md', content: readmeMd(context, roleNextStep(role, context.packageName)) },
    { path: 'vite.shared.ts', content: viteSharedTs() },
    { path: 'vite.main.config.ts', content: viteMainConfigTs(mainEntry) },
    { path: 'vitest.config.ts', content: vitestConfigTs(testEnvironment(role)) },
  ];

  if (renderEntry !== undefined) {
    commonFiles.push({ path: 'vite.render.config.ts', content: viteRenderConfigTs(renderEntry) });
  }

  return [...commonFiles, ...buildRoleFiles(context)];
}

/**
 * 各角色的开发依赖集合。
 *
 * - 内部依赖一律 `workspace:*`（《依赖管理与锁文件规范》§2.1）；
 * - 第三方依赖精确版本（同文档 §2.2），与 `examples/plugins/hello` 的工具链基线一致；
 * - `react` / `react-dom` / `@chips/ui` 是平台提供物，只参与构建与类型检查，禁止进入 `dependencies`；
 * - `@chips/cli` 是 `package` 脚本（`pnpm exec chips plugin pack`）的 bin 锚点：
 *   声明为 devDependency 后 `pnpm exec` 在本包 `node_modules/.bin` 解析到工作区版 CLI，
 *   杜绝静默回退 PATH 命中仓库外同名全局 bin（工单020 缺陷①）。
 */
function packageDevDependencies(context: IScaffoldContext): {
  devDependencies: Record<string, string>;
} {
  const { role } = context.options;
  if (role === 'service') {
    return {
      devDependencies: {
        '@chips/cli': 'workspace:*',
        '@chips/sdk': 'workspace:*',
        '@types/node': '20.19.37',
        '@vitest/coverage-v8': '3.2.4',
        typescript: '5.9.3',
        vite: '7.3.1',
        vitest: '3.2.4',
      },
    };
  }

  const devDependencies: Record<string, string> = {
    '@chips/cli': 'workspace:*',
    '@chips/sdk': 'workspace:*',
    '@chips/ui': 'workspace:*',
    '@types/node': '20.19.37',
    '@types/react': '18.3.29',
    '@types/react-dom': '18.3.7',
    '@vitejs/plugin-react': '4.7.0',
    '@vitest/coverage-v8': '3.2.4',
    react: '18.3.1',
    'react-dom': '18.3.1',
    typescript: '5.9.3',
    vite: '7.3.1',
    vitest: '3.2.4',
    ...(role === 'boxlayout' ? { jsdom: '28.1.0' } : {}),
  };
  return { devDependencies };
}
