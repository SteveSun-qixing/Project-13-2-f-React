import { mkdir, mkdtemp, readFile as readTextFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';
import { parse as parseYaml } from 'yaml';
import { validateManifest } from '../src/manifest-validate.js';
import type { IScaffoldPlan, PluginRole } from '../src/types.js';
import { CANONICAL_OPTIONS, canonicalPlan, fileMap, readFile } from './support/fixtures.js';

const EXPECTED_PATHS: Readonly<Record<PluginRole, readonly string[]>> = {
  basecard: [
    'manifest.yaml',
    'package.json',
    'tsconfig.json',
    'README.md',
    'vite.shared.ts',
    'vite.main.config.ts',
    'vite.render.config.ts',
    'vitest.config.ts',
    'src/config.ts',
    'src/main.ts',
    'src/render.tsx',
    'src/index.ts',
    'assets/icons/markdown.svg',
    'assets/schemas/markdown-config.schema.json',
    'tests/config.test.ts',
  ],
  boxlayout: [
    'manifest.yaml',
    'package.json',
    'tsconfig.json',
    'README.md',
    'vite.shared.ts',
    'vite.main.config.ts',
    'vite.render.config.ts',
    'vitest.config.ts',
    'src/config.ts',
    'src/main.ts',
    'src/render.tsx',
    'src/index.ts',
    'assets/icons/grid.svg',
    'assets/schemas/grid-config.schema.json',
    'tests/render.test.ts',
  ],
  app: [
    'manifest.yaml',
    'package.json',
    'tsconfig.json',
    'README.md',
    'vite.shared.ts',
    'vite.main.config.ts',
    'vite.render.config.ts',
    'vitest.config.ts',
    'src/index.ts',
    'src/ui/AppView.tsx',
    'assets/icons/app.svg',
    'tests/app.test.ts',
  ],
  service: [
    'manifest.yaml',
    'package.json',
    'tsconfig.json',
    'README.md',
    'vite.shared.ts',
    'vite.main.config.ts',
    'vitest.config.ts',
    'src/index.ts',
    'assets/schemas/config.schema.json',
    'tests/service.test.ts',
  ],
};

const PLACEHOLDER_PATTERN = /TODO|FIXME|占位|placeholder|待补|<%|\{\{[\w.]+\}\}/i;

function pathSet(plan: IScaffoldPlan): string[] {
  return plan.files.map((file) => file.path).sort();
}

function assertTranspiles(path: string, content: string): void {
  if (!path.endsWith('.ts') && !path.endsWith('.tsx')) {
    return;
  }
  const result = ts.transpileModule(content, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
    },
  });
  const messages = (result.diagnostics ?? []).map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  );
  expect(messages, `${path} 存在语法错误`).toEqual([]);
}

describe.each(['basecard', 'boxlayout', 'app', 'service'] as const)('%s 模板', (role) => {
  const plan = canonicalPlan(role);
  const files = fileMap(plan);

  it('生成与规范一致的文件清单', () => {
    expect(pathSet(plan)).toEqual([...EXPECTED_PATHS[role]].sort());
    expect([...plan.template.files].sort()).toEqual(pathSet(plan));
  });

  it('文件路径为相对 POSIX 路径且互不重复', () => {
    const paths = plan.files.map((file) => file.path);
    for (const path of paths) {
      expect(path.startsWith('/')).toBe(false);
      expect(path.includes('\\')).toBe(false);
      expect(path.includes('..')).toBe(false);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('manifest 通过清单校验且不含未替换变量', () => {
    const manifestYaml = readFile(plan, 'manifest.yaml');
    expect(manifestYaml).not.toContain('undefined');
    const parsed = parseYaml(manifestYaml) as unknown;
    expect(validateManifest(parsed)).toEqual([]);
  });

  it('package.json 与 manifest 版本一致，依赖落位与版本口径合规', () => {
    const manifest = parseYaml(readFile(plan, 'manifest.yaml')) as {
      version: string;
      type: string;
    };
    const pkg = JSON.parse(readFile(plan, 'package.json')) as {
      name: string;
      version: string;
      private: boolean;
      scripts: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.version).toBe(manifest.version);
    expect(pkg.version).toBe(plan.manifest.version);
    expect(pkg.private).toBe(true);
    for (const script of [
      'build',
      'test',
      'test:coverage',
      'lint',
      'typecheck',
      'clean',
      'package',
    ]) {
      expect(pkg.scripts[script], `缺少脚本 ${script}`).toBeTruthy();
    }
    // 平台提供物与构建期依赖一律 devDependencies，禁止进入 dependencies（《依赖管理与锁文件规范》§2.2）。
    expect(pkg.dependencies).toBeUndefined();
    for (const name of ['react', 'react-dom', '@chips/ui', '@chips/sdk']) {
      if (name in pkg.devDependencies) {
        expect(pkg.dependencies?.[name], `${name} 不得出现在 dependencies`).toBeUndefined();
      }
    }
    for (const [name, version] of Object.entries(pkg.devDependencies)) {
      if (name.startsWith('@chips/')) {
        expect(version, `${name} 必须使用 workspace:*`).toBe('workspace:*');
      } else {
        // 第三方 Node 依赖必须精确版本（无 ^、~、* 等范围符号）。
        expect(version, `${name} 必须是精确版本`).toMatch(/^\d+\.\d+\.\d+/);
        expect(version.includes('^') || version.includes('~') || version.includes('*')).toBe(false);
      }
    }
  });

  it('tsconfig 继承仓库基线且包内不重复编译选项', () => {
    const tsconfig = JSON.parse(readFile(plan, 'tsconfig.json')) as {
      extends: string;
      include: string[];
      compilerOptions?: Record<string, unknown>;
    };
    expect(tsconfig.extends.endsWith('tsconfig.base.json')).toBe(true);
    expect(tsconfig.compilerOptions).toBeUndefined();
    expect(tsconfig.include).toContain('src');
  });

  it('JSON 资产可解析且 TypeScript 源码语法正确', () => {
    for (const [path, content] of files) {
      if (path.endsWith('.json')) {
        expect(() => JSON.parse(content) as unknown, `${path} 不是合法 JSON`).not.toThrow();
      }
      assertTranspiles(path, content);
    }
  });

  it('不包含占位标记与未替换变量', () => {
    for (const [path, content] of files) {
      expect(PLACEHOLDER_PATTERN.test(content), `${path} 含占位标记`).toBe(false);
      if (!path.endsWith('.ts') && !path.endsWith('.tsx')) {
        expect(content.includes('undefined'), `${path} 含未替换变量`).toBe(false);
      }
    }
  });

  it('manifest 引用的文件都在文件计划中', () => {
    const manifestYaml = readFile(plan, 'manifest.yaml');
    const references = [...manifestYaml.matchAll(/assets\/[\w./-]+/g)].map((match) => match[0]);
    if (role === 'service') {
      // service 的自身配置 schema 按约定路径自动发现，manifest 不引用资源。
      expect(references).toEqual([]);
      expect(files.has('assets/schemas/config.schema.json')).toBe(true);
    } else {
      expect(references.length).toBeGreaterThan(0);
    }
    for (const reference of references) {
      expect(files.has(reference), `引用的资源不存在：${reference}`).toBe(true);
    }
  });

  it('README 说明插件标识、包名与构建产物', () => {
    const readme = readFile(plan, 'README.md');
    expect(readme).toContain(CANONICAL_OPTIONS[role].pluginId);
    expect(readme).toContain(`@chips/plugin-${CANONICAL_OPTIONS[role].targetDir.split('/').pop()}`);
    expect(readme).not.toContain('undefined');
    expect(readme).toContain('dist/index.js');
    if (role === 'service') {
      expect(readme).not.toContain('render.js');
    } else {
      expect(readme).toContain('render.js');
    }
  });

  it('两个入口均有默认导出，入口职责分离', () => {
    const files = fileMap(plan);
    if (role === 'basecard' || role === 'boxlayout') {
      expect(files.get('src/main.ts')).toContain('export default');
      expect(files.get('src/render.tsx')).toContain('export default');
    }
    if (role === 'app') {
      expect(files.get('src/index.ts')).toContain('export default');
      expect(files.get('src/ui/AppView.tsx')).toContain('export default');
    }
    if (role === 'service') {
      expect(files.get('src/index.ts')).toContain('export default');
    }
  });

  it('渲染代码使用 Design Tokens，不使用未列入共享层的组件', () => {
    const files = fileMap(plan);
    for (const path of ['src/render.tsx', 'src/ui/AppView.tsx']) {
      const content = files.get(path);
      if (content === undefined) {
        continue;
      }
      expect(content, `${path} 必须使用 Design Tokens`).toContain('theme.useToken()');
      expect(content, `${path} 不得使用 InputNumber`).not.toContain('InputNumber');
    }
  });

  it('vitest 配置存在、环境正确且已纳入 tsconfig', () => {
    const config = readFile(plan, 'vitest.config.ts');
    expect(config).toContain("from 'vitest/config'");
    expect(config).toContain(role === 'boxlayout' ? "environment: 'jsdom'" : "environment: 'node'");
    const tsconfig = JSON.parse(readFile(plan, 'tsconfig.json')) as { include: string[] };
    expect(tsconfig.include).toContain('vitest.config.ts');
  });

  it('同一选项重复生成结果字节级一致', () => {
    const first = canonicalPlan(role);
    const second = canonicalPlan(role);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('文件计划可完整落盘，落盘后的 manifest 仍通过清单校验', async () => {
    const dir = await mkdtemp(join(tmpdir(), `chips-scaffold-${role}-`));
    try {
      for (const file of plan.files) {
        const target = join(dir, file.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.content, 'utf8');
      }
      const manifestOnDisk = await readTextFile(join(dir, 'manifest.yaml'), 'utf8');
      expect(validateManifest(parseYaml(manifestOnDisk))).toEqual([]);
      const packageOnDisk = JSON.parse(await readTextFile(join(dir, 'package.json'), 'utf8')) as {
        version: string;
      };
      expect(packageOnDisk.version).toBe(plan.manifest.version);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('角色差异', () => {
  it('basecard 声明 cardTypes、图标与配置 schema 路径一致', () => {
    const manifest = canonicalPlan('basecard').manifest;
    expect(manifest.type).toBe('basecard');
    expect(manifest.runtime.targets).toEqual(['host']);
    expect(manifest.permissions).toEqual([]);
    expect(manifest.capabilities?.cardTypes?.[0]).toMatchObject({
      id: 'base.markdown',
      icon: 'assets/icons/markdown.svg',
      configSchema: 'assets/schemas/markdown-config.schema.json',
    });
    expect(manifest.capabilities?.layouts).toBeUndefined();
    expect(manifest.ui).toBeUndefined();
  });

  it('boxlayout 声明 layouts、schemaVersions 与 resources:read', () => {
    const manifest = canonicalPlan('boxlayout').manifest;
    expect(manifest.type).toBe('boxlayout');
    expect(manifest.permissions).toEqual(['resources:read']);
    expect(manifest.capabilities?.layouts?.[0]?.configSchema).toBe(
      'assets/schemas/grid-config.schema.json'
    );
    expect(manifest.capabilities?.layouts?.[0]?.schemaVersions).toBe('>=1.0.0 <2.0.0');
    expect(manifest.capabilities?.cardTypes).toBeUndefined();
  });

  it('app 声明 ui.surface 与 launcher 图标', () => {
    const manifest = canonicalPlan('app').manifest;
    expect(manifest.type).toBe('app');
    expect(manifest.ui?.surface).toBe('window');
    expect(manifest.ui?.launcher).toMatchObject({
      icon: 'assets/icons/app.svg',
      name: '卡片查看器',
    });
    expect(manifest.capabilities).toBeUndefined();
    expect(manifest.healthCheck).toBeUndefined();
  });

  it('app 窗口入口挂载 ChipsProvider，appId 与 surface 同 manifest 一致', () => {
    const files = fileMap(canonicalPlan('app'));
    const appView = files.get('src/ui/AppView.tsx') ?? '';
    expect(appView).toContain('<ChipsProvider');
    expect(appView).toContain("const APP_ID = 'chips.official.viewer'");
    expect(appView).toContain('surface="window"');
  });

  it('service 声明 healthCheck 且不生成 render.js 与 UI 资源', () => {
    const plan = canonicalPlan('service');
    expect(plan.manifest.type).toBe('service');
    expect(plan.manifest.healthCheck).toEqual({ interval: '30s', timeout: '5s' });
    expect(plan.manifest.ui).toBeUndefined();
    expect(plan.manifest.capabilities).toBeUndefined();
    const paths = plan.files.map((file) => file.path);
    expect(paths).not.toContain('vite.render.config.ts');
    expect(paths.some((path) => path.endsWith('render.js'))).toBe(false);
    expect(paths.some((path) => path.startsWith('assets/icons/'))).toBe(false);
  });

  it('basecard 渲染入口与主进程入口职责分离', () => {
    const files = fileMap(canonicalPlan('basecard'));
    expect(files.get('vite.main.config.ts')).toContain("entry: 'src/main.ts'");
    expect(files.get('vite.render.config.ts')).toContain("entry: 'src/render.tsx'");
    expect(files.get('src/index.ts')).toContain("from './main'");
    expect(files.get('src/index.ts')).toContain("from './render'");
  });

  it('app 渲染入口指向 AppView，主进程入口指向 index', () => {
    const files = fileMap(canonicalPlan('app'));
    expect(files.get('vite.main.config.ts')).toContain("entry: 'src/index.ts'");
    expect(files.get('vite.render.config.ts')).toContain("entry: 'src/ui/AppView.tsx'");
  });

  it('资源命名随插件 ID 末段派生', () => {
    const plan = canonicalPlan('basecard', {
      pluginId: 'chips.example.notes-card',
      targetDir: 'examples/plugins/notes-card',
    });
    const paths = plan.files.map((file) => file.path);
    expect(paths).toContain('assets/icons/notes-card.svg');
    expect(paths).toContain('assets/schemas/notes-card-config.schema.json');
    expect(plan.manifest.capabilities?.cardTypes?.[0]?.id).toBe('base.notes-card');
    const tsconfig = JSON.parse(readFile(plan, 'tsconfig.json')) as { extends: string };
    expect(tsconfig.extends).toBe('../../../tsconfig.base.json');
  });
});
