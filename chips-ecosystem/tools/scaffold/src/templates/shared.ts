import type { IScaffoldContext } from '../types.js';

/** 生成文件的公共构造器：四个角色共享的清单、构建配置与文档。 */

export interface IPackageDependencySpec {
  readonly devDependencies: Readonly<Record<string, string>>;
}

export interface IPackageScriptsSpec {
  readonly build: string;
  readonly test: string;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * 生成 `package.json`。
 *
 * - `version` 必须与 manifest 一致（打包前置校验，见《插件包格式》§7.1）；
 * - 平台提供物（`react`、`react-dom`、`@chips/ui`）与构建期依赖一律放 `devDependencies`，
 *   禁止进入 `dependencies`（《依赖管理与锁文件规范》§2.2）；
 * - 不生成 `dependencies`：模板运行时代码全部为平台提供物或构建内联的纯函数。
 */
export function packageJson(
  context: IScaffoldContext,
  scripts: IPackageScriptsSpec,
  deps: IPackageDependencySpec
): string {
  const { manifest, options, packageName } = context;
  return json({
    name: packageName,
    version: manifest.version,
    private: true,
    description: options.description ?? options.name,
    type: 'module',
    scripts: {
      build: scripts.build,
      test: scripts.test,
      'test:coverage': 'vitest run --coverage',
      lint: 'eslint src tests',
      typecheck: 'tsc -p tsconfig.json --noEmit',
      clean:
        "node -e \"import('node:fs').then((fs) => { for (const p of ['dist', 'render.js', 'coverage']) fs.rmSync(p, { recursive: true, force: true }); })\"",
      package: 'pnpm exec chips plugin pack --out dist/',
    },
    devDependencies: deps.devDependencies,
  });
}

/** 生成 `tsconfig.json`：只继承仓库基线，不在包内重复定义编译选项。 */
export function tsconfigJson(context: IScaffoldContext, include: readonly string[]): string {
  return json({
    extends: context.tsconfigExtends,
    include: [...include],
  });
}

const VITE_SHARED_SOURCE = `import type { Plugin } from 'vite';

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
        this.error(\`R4 违规导入：\${source}；UI 与类型请从 @chips/ui、@chips/sdk 导入\`);
      }
      return null;
    },
  };
}
`;

/** 生成源码红线守卫 `vite.shared.ts`。 */
export function viteSharedTs(): string {
  return VITE_SHARED_SOURCE;
}

/** 生成主进程入口构建配置 `vite.main.config.ts`。 */
export function viteMainConfigTs(entry: string): string {
  return `import { defineConfig } from 'vite';
import { rejectForbiddenImports } from './vite.shared';

/** 主进程入口构建：完全自包含的 ESM 单文件，产出 dist/index.js。 */
export default defineConfig({
  plugins: [rejectForbiddenImports()],
  build: {
    target: 'node18',
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: false,
    lib: { entry: '${entry}', formats: ['es'], fileName: () => 'index.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
    sourcemap: false,
  },
});
`;
}

/** 生成渲染入口构建配置 `vite.render.config.ts`。 */
export function viteRenderConfigTs(entry: string): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rejectForbiddenImports, PLATFORM_VENDOR } from './vite.shared';

/** 渲染入口构建：外部化平台 vendor（React、@chips/ui），产出包根 render.js。 */
export default defineConfig({
  plugins: [rejectForbiddenImports(), react()],
  build: {
    target: 'chrome118',
    outDir: '.',
    emptyOutDir: false,
    copyPublicDir: false,
    assetsInlineLimit: 0,
    lib: { entry: '${entry}', formats: ['es'], fileName: () => 'render.js' },
    rollupOptions: {
      external: Object.keys(PLATFORM_VENDOR),
      output: { paths: PLATFORM_VENDOR, inlineDynamicImports: true },
    },
    sourcemap: false,
  },
});
`;
}

/** 生成 `vitest.config.ts`：包级测试配置，使本包可被根 vitest 工作区发现并独立执行。 */
export function vitestConfigTs(environment: 'node' | 'jsdom'): string {
  return `import { defineConfig } from 'vitest/config';

/** 包级测试配置：单元测试与包级集成测试（《测试规范》《代码组织规范》§9）。 */
export default defineConfig({
  test: {
    environment: '${environment}',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}'],
    },
  },
});
`;
}

const ROLE_GUIDE: Readonly<Record<string, string>> = {
  basecard: '《基础卡片插件开发指南》《基础卡片插件接口》',
  boxlayout: '《箱子布局插件开发指南》《箱子布局插件接口》',
  app: '《应用插件开发指南》《应用插件接口》',
  service: '《服务插件开发指南》《服务插件接口》',
};

const ROLE_TREE: Readonly<Record<string, readonly string[]>> = {
  basecard: [
    'src/config.ts     # 配置模型：读取、归一、校验与默认值',
    'src/main.ts       # 主进程纯函数源码 → dist/index.js',
    'src/render.tsx    # 查看态与编辑态渲染源码 → render.js',
    'src/index.ts      # 源码拆分导出（非构建入口）',
    'tests/            # vitest 单元测试',
    'assets/icons/     # 卡片类型图标',
    'assets/schemas/   # 卡片配置 schema',
  ],
  boxlayout: [
    'src/config.ts     # 布局配置模型：归一、校验与列数算法',
    'src/main.ts       # 主进程纯函数源码 → dist/index.js',
    'src/render.tsx    # renderLayout / renderEditor 源码 → render.js',
    'src/index.ts      # 源码拆分导出（非构建入口）',
    'tests/            # vitest 单元测试（jsdom）',
    'assets/icons/     # 布局类型图标',
    'assets/schemas/   # 布局配置 schema',
  ],
  app: [
    'src/index.ts      # IAppPlugin 实现 → dist/index.js',
    'src/commands/     # cli.commands 对应命令元数据与 UI 命令运行时接线',
    'src/ui/AppView.tsx # 应用窗口界面根组件 → render.js',
    'tests/            # vitest 单元测试',
    'assets/icons/     # 启动器图标',
  ],
  service: [
    'src/index.ts      # IServicePlugin 实现 → dist/index.js',
    'tests/            # vitest 单元测试',
    'assets/schemas/   # 插件自身配置 schema',
  ],
};

/** 生成插件工程 README。 */
export function readmeMd(context: IScaffoldContext, nextStep: string): string {
  const { manifest, options, packageName, packageSlug } = context;
  const hasRenderEntry = options.role !== 'service';
  const tree = ROLE_TREE[options.role] ?? [];
  const guide = ROLE_GUIDE[options.role] ?? '';
  const rootDir = options.targetDir
    .split('/')
    .filter((segment) => segment.length > 0)
    .pop();
  const buildTree = [
    'manifest.yaml            # 唯一权威清单',
    'package.json             # 工作区包 ' + packageName + '，version 与 manifest 一致',
    'tsconfig.json            # 继承仓库 tsconfig.base.json',
    'vite.shared.ts           # 构建红线守卫与平台 vendor 表',
    'vite.main.config.ts      # 主进程入口构建 → dist/index.js',
    ...(hasRenderEntry ? ['vite.render.config.ts  # 渲染入口构建 → render.js'] : []),
    'vitest.config.ts         # 测试配置（单元测试与包级集成测试）',
  ];
  return `# ${options.name}

> 角色：\`${options.role}\`；插件 ID：\`${manifest.id}\`；版本：\`${manifest.version}\`

${options.description ?? options.name}

## 目录结构

\`\`\`text
${rootDir ?? packageSlug}/
${[...buildTree, ...tree].map((line) => `├── ${line}`).join('\n')}
\`\`\`

## 常用命令

\`\`\`bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter ${packageName} run typecheck
pnpm --filter ${packageName} run test
pnpm --filter ${packageName} run test:coverage
pnpm --filter ${packageName} run build
pnpm --filter ${packageName} run package       # 打包 .cpk（由 @chips/cli 执行）
\`\`\`

构建产物为 \`dist/index.js\`（主进程入口，自包含 ESM）${hasRenderEntry ? '与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）' : '；`service` 角色不产出渲染入口'}。
\`.cpk\` 布局、签名与校验规则以《插件包格式》为准。

## 下一步

${nextStep}

## 规范入口

${guide}；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。
`;
}
