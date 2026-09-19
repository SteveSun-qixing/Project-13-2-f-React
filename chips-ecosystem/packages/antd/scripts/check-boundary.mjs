#!/usr/bin/env node
/**
 * 依赖边界门禁（G9 / R4）：fork antd 的消费方唯一性与依赖方向检查。
 *
 * 检查项：
 * 1. `@chips/antd` 的 package.json 只允许依赖上游 `antd` 与其配套图标集，禁止任何 `@chips/*` 依赖；
 * 2. 工作区内只有 `packages/ui` 可以声明或导入 `@chips/antd`；
 * 3. `antd` 与 `antd/*` 只允许 `packages/antd` 内部导入；
 * 4. 任何位置禁止第二套组件库（`@mui/*`、`@chakra-ui/*`）。
 *
 * 用法：node scripts/check-boundary.mjs [--root <工作区根>]
 * 退出码：0 通过；1 违反；2 用法错误。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const defaultRoot = resolve(scriptDir, '..', '..', '..');
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  'target',
  'release',
  '归档',
  '.git',
  '.vite',
  '.cache',
]);
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const ALLOWED_ANTD_IMPORTER = join('packages', 'ui') + sep;
const ANTD_PACKAGE_DIR = join('packages', 'antd') + sep;
const FORBIDDEN_UI_LIBRARIES = ['@mui/', '@chakra-ui/'];

const SPECIFIER_PATTERN =
  /(?:^|\n)\s*(?:import|export)\s[^'"\n]*?['"]([^'"\n]+)['"]|\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;

function parseArgs(argv) {
  let root = defaultRoot;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      const value = argv[index + 1];
      if (!value) {
        return { error: '--root 缺少路径值' };
      }
      root = resolve(value);
      index += 1;
    } else {
      return { error: `未知参数：${arg}` };
    }
  }
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    return { error: `工作区根不存在：${root}` };
  }
  return { root };
}

function listSourceFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      listSourceFiles(join(dir, entry.name), files);
      continue;
    }
    if (SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

function collectSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function scanImports(root, violations) {
  const sourceRoots = ['packages', 'plugins', 'tools', 'examples', 'tests'];
  for (const sourceRoot of sourceRoots) {
    const scanRoot = join(root, sourceRoot);
    if (!statSync(scanRoot, { throwIfNoEntry: false })?.isDirectory()) {
      continue;
    }
    for (const file of listSourceFiles(scanRoot)) {
      const relativePath = relative(root, file);
      const specifiers = collectSpecifiers(readFileSync(file, 'utf8'));
      for (const specifier of specifiers) {
        if (specifier === '@chips/antd' || specifier.startsWith('@chips/antd/')) {
          if (
            !relativePath.startsWith(ALLOWED_ANTD_IMPORTER) &&
            !relativePath.startsWith(ANTD_PACKAGE_DIR)
          ) {
            violations.push(
              `${relativePath} 导入了 ${specifier}；@chips/antd 仅允许 packages/ui 内部使用`
            );
          }
        }
        if (specifier === 'antd' || specifier.startsWith('antd/')) {
          if (!relativePath.startsWith(ANTD_PACKAGE_DIR)) {
            violations.push(
              `${relativePath} 导入了 ${specifier}；antd 仅允许 packages/antd 内部使用`
            );
          }
        }
        if (FORBIDDEN_UI_LIBRARIES.some((prefix) => specifier.startsWith(prefix))) {
          violations.push(`${relativePath} 导入了 ${specifier}；禁止引入第二套组件库`);
        }
      }
    }
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function checkPackageManifests(root, violations) {
  const antdManifestPath = join(root, 'packages', 'antd', 'package.json');
  if (!statSync(antdManifestPath, { throwIfNoEntry: false })?.isFile()) {
    violations.push(`缺少 fork antd 包清单：${relative(root, antdManifestPath)}`);
    return;
  }
  const antdManifest = readJson(antdManifestPath);

  if (antdManifest.name !== '@chips/antd') {
    violations.push(
      `packages/antd/package.json 的包名必须是 @chips/antd，实际为 ${antdManifest.name}`
    );
  }
  if (antdManifest.private !== true) {
    violations.push('packages/antd/package.json 必须声明 "private": true（fork 包不对外发布）');
  }
  if (
    typeof antdManifest.version !== 'string' ||
    !/^\d+\.\d+\.\d+-chips\.\d+$/.test(antdManifest.version)
  ) {
    violations.push(
      `packages/antd/package.json 版本必须是 <上游版本>-chips.N，实际为 ${antdManifest.version}`
    );
  }
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const entries = Object.entries(antdManifest[field] ?? {});
    for (const [name, range] of entries) {
      if (name.startsWith('@chips/')) {
        violations.push(
          `packages/antd/package.json 的 ${field} 不允许依赖 ${name}（依赖矩阵：fork 只依赖 react 与上游依赖）`
        );
      }
      if (
        (field === 'dependencies' || field === 'devDependencies') &&
        !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(range)
      ) {
        violations.push(
          `packages/antd/package.json 的 ${field}.${name} 必须是精确版本，实际为 ${range}`
        );
      }
    }
  }
  const dependencyNames = Object.keys(antdManifest.dependencies ?? {});
  const allowedDependencies = new Set(['antd', '@ant-design/icons']);
  for (const name of dependencyNames) {
    if (!allowedDependencies.has(name)) {
      violations.push(
        `packages/antd/package.json 的 dependencies 不允许出现 ${name}；运行时依赖只允许 antd 与 @ant-design/icons`
      );
    }
  }
  const peerNames = Object.keys(antdManifest.peerDependencies ?? {});
  for (const name of peerNames) {
    if (name !== 'react' && name !== 'react-dom') {
      violations.push(
        `packages/antd/package.json 的 peerDependencies 不允许出现 ${name}；只允许 react 与 react-dom`
      );
    }
  }
  const exportEntry = antdManifest.exports?.['.'];
  const targetPaths = [
    antdManifest.main,
    antdManifest.types,
    exportEntry?.types,
    exportEntry?.default,
  ];
  for (const target of targetPaths) {
    if (typeof target !== 'string' || !target.startsWith('./dist/')) {
      violations.push(
        `packages/antd/package.json 的出口必须指向 ./dist/，实际为 ${String(target)}`
      );
    }
  }

  const workspaceManifests = [
    ['packages', 1],
    ['plugins', 2],
    ['tools', 1],
    ['examples/plugins', 1],
  ];
  for (const [base, depth] of workspaceManifests) {
    const baseDir = join(root, base);
    if (!statSync(baseDir, { throwIfNoEntry: false })?.isDirectory()) {
      continue;
    }
    for (const packageDir of listPackageDirs(baseDir, depth)) {
      const manifestPath = join(packageDir, 'package.json');
      if (!statSync(manifestPath, { throwIfNoEntry: false })?.isFile()) {
        continue;
      }
      const manifest = readJson(manifestPath);
      const relativePath = relative(root, manifestPath);
      if (manifest.name === '@chips/antd') {
        continue;
      }
      const declaresFork = [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ].some((field) => Object.keys(manifest[field] ?? {}).includes('@chips/antd'));
      if (declaresFork && manifest.name !== '@chips/ui') {
        violations.push(
          `${relativePath}（${manifest.name}）声明了 @chips/antd 依赖；仅 @chips/ui 允许声明`
        );
      }
    }
  }
}

function listPackageDirs(baseDir, depth, currentDepth = 1) {
  const result = [];
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const dir = join(baseDir, entry.name);
    if (currentDepth === depth) {
      result.push(dir);
    } else {
      result.push(...listPackageDirs(dir, depth, currentDepth + 1));
    }
  }
  return result;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(`[check-boundary] ${parsed.error}`);
    process.exit(2);
  }
  const violations = [];
  checkPackageManifests(parsed.root, violations);
  scanImports(parsed.root, violations);

  if (violations.length > 0) {
    console.error(`[check-boundary] 依赖边界检查未通过，共 ${violations.length} 项：`);
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(1);
  }
  console.log(
    '[check-boundary] 依赖边界检查通过：@chips/antd 仅 packages/ui 可用，fork 无 @chips/* 依赖。'
  );
}

main();
