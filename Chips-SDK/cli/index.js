#!/usr/bin/env node

/**
 * Chips Dev 开发者命令行工具（chipsdev）
 *
 * 统一入口：chipsdev <command> [options]
 * 底层使用 Vite（dev server + build）与 Vitest（test），由 chips.config.mjs 驱动。
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const childProcess = require('node:child_process');
const yaml = require('yaml');

const PROJECT_CONFIG_FILE = 'chips.config.mjs';
const MANIFEST_FILE = 'manifest.yaml';

const COMMANDS = new Set([
  'help',
  'init',
  'create',
  'start',
  'stop',
  'status',
  'config',
  'logs',
  'plugin',
  'theme',
  'update',
  'doctor',
  'open',
  'server',
  'debug',
  'build',
  'test',
  'lint',
  'e2e',
  'package',
  'validate',
  'login',
  'publish',
  'version',
  'run'
]);

const HOST_MANAGED_COMMANDS = new Set([
  'start',
  'stop',
  'status',
  'config',
  'logs',
  'plugin',
  'theme',
  'update',
  'doctor',
  'open'
]);

const log = (value) => {
  if (typeof value === 'string') {
    process.stdout.write(value + '\n');
  } else {
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
  }
};

const logError = (value) => {
  if (typeof value === 'string') {
    process.stderr.write(value + '\n');
  } else {
    process.stderr.write(JSON.stringify(value, null, 2) + '\n');
  }
};

const toErrorPayload = (error) => {
  if (error && typeof error === 'object' && error.__alreadyLogged === true) {
    return null;
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      details: {
        name: error.name,
        stack: error.stack
      }
    };
  }

  if (error && typeof error === 'object') {
    return error;
  }

  return { error: String(error) };
};

const printHelp = () => {
  log(
    [
      'Chips Dev 命令行工具 (chipsdev)',
      '',
      '用法：',
      '  chipsdev <command> [options]',
      '',
      '可用命令：',
      '  init        初始化项目级开发配置（chips.config.mjs）',
      '  create      从官方脚手架模板创建新工程',
      '  start       启动开发工作区 Host 状态管理',
      '  stop        停止开发工作区 Host 状态管理',
      '  status      查看开发工作区状态',
      '  config      管理开发工作区配置',
      '  logs        导出开发工作区日志',
      '  plugin      管理开发工作区插件',
      '  theme       管理开发工作区主题',
      '  update      查看或安装开发工具更新信息',
      '  doctor      检查开发工作区健康状态',
      '  open        在开发工作区链路中打开目标文件',
      '  server      启动 Vite 开发服务器',
      '  debug       以调试模式启动目标项目（与 server 行为一致，可扩展调试预设）',
      '  build       使用 Vite 构建插件工程',
      '  test        使用 Vitest 运行单元测试',
      '  lint        使用 ESLint 执行代码规范检查',
      '  e2e         运行端到端测试（工程自行提供 e2e 脚本时调用）',
      '  package     根据 manifest.yaml 和构建产物打包生成 .cpk 插件包',
      '  validate    执行项目级契约校验（配置、清单、产物完整性等）',
      '  login       在本机保存开发者凭据（为未来线上发布做准备）',
      '  publish     生成发布包元数据并校验，可对接后续市场服务',
      '  run         在开发环境下启动 Host 并运行应用插件',
      '  version     查看 chipsdev 版本',
      '  help        查看帮助信息'
    ].join('\n')
  );
};

const parseArgs = (argv) => {
  const [command = 'help', ...rest] = argv;
  return { command, args: rest };
};

const loadJsonFile = async (filePath, fallback) => {
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const saveJsonFile = async (filePath, value) => {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
};

const resolveProjectRoot = () => process.cwd();

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveProjectDependencyEntry = (projectRoot, specifier) => {
  try {
    return require.resolve(specifier, { paths: [projectRoot] });
  } catch {
    return null;
  }
};

const createFrontendResolveConfig = (projectRoot) => {
  const alias = [];
  const specifiers = [
    'react/jsx-dev-runtime',
    'react/jsx-runtime',
    'react-dom/client',
    'react-dom/server',
    'react-dom',
    'react'
  ];

  for (const specifier of specifiers) {
    const replacement = resolveProjectDependencyEntry(projectRoot, specifier);
    if (!replacement) {
      continue;
    }
    alias.push({
      find: new RegExp(`^${escapeForRegex(specifier)}$`),
      replacement
    });
  }

  return {
    alias,
    dedupe: ['react', 'react-dom']
  };
};

const loadPackageJsonVersion = async () => {
  const herePackage = path.resolve(__dirname, '..', 'package.json');
  try {
    const pkg = await loadJsonFile(herePackage, {});
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
};

const loadProjectConfig = async (projectRoot) => {
  const configPath = path.join(projectRoot, PROJECT_CONFIG_FILE);
  try {
    await fsp.access(configPath, fs.constants.R_OK);
  } catch {
    throw new Error(`未找到项目配置文件：${PROJECT_CONFIG_FILE}（当前目录：${projectRoot}）`);
  }

  const fileUrl = pathToFileURL(configPath).href;
  const mod = await import(fileUrl);
  const config = mod.default ?? mod.config ?? mod;

  if (!config || typeof config !== 'object') {
    throw new Error(`配置文件 ${PROJECT_CONFIG_FILE} 必须导出一个对象。`);
  }

  const type = config.type ?? 'app';
  const srcDir = config.srcDir ?? 'src';
  const outDir = config.outDir ?? 'dist';
  const entry = config.entry ?? (type === 'app' ? 'index.html' : path.join(srcDir, 'main.ts'));
  const testsDir = config.testsDir ?? 'tests';

  return { ...config, type, srcDir, outDir, entry, testsDir };
};

const loadManifest = async (projectRoot) => {
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  try {
    const raw = await fsp.readFile(manifestPath, 'utf-8');
    const doc = yaml.parse(raw);
    if (!doc || typeof doc !== 'object') {
      throw new Error('manifest.yaml 内容无效：解析结果不是对象。');
    }
    return { manifest: doc, manifestPath };
  } catch (error) {
    const err = /** @type {NodeJS.ErrnoException} */ (error);
    if (err.code === 'ENOENT') {
      throw new Error(`未找到插件清单文件：${MANIFEST_FILE}（当前目录：${projectRoot}）`);
    }
    throw new Error(`读取 ${MANIFEST_FILE} 失败：${err.message}`);
  }
};

const collectAncestorNodeModuleBinDirs = (projectRoot) => {
  const binDirs = [];
  const seen = new Set();
  const queue = [projectRoot];

  try {
    const realProjectRoot = fs.realpathSync(projectRoot);
    if (!queue.includes(realProjectRoot)) {
      queue.push(realProjectRoot);
    }
  } catch {
    // 忽略 realpath 失败，按原始路径继续。
  }

  for (const start of queue) {
    let current = start;
    while (true) {
      const binDir = path.join(current, 'node_modules', '.bin');
      if (fs.existsSync(binDir) && !seen.has(binDir)) {
        seen.add(binDir);
        binDirs.push(binDir);
      }

      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return binDirs;
};

const makeBinEnv = (projectRoot) => {
  const binDirs = collectAncestorNodeModuleBinDirs(projectRoot).concat(
    path.join(__dirname, '..', 'node_modules', '.bin')
  );
  const unique = [];
  for (const dir of binDirs) {
    if (fs.existsSync(dir) && !unique.includes(dir)) {
      unique.push(dir);
    }
  }
  const existingPath = process.env.PATH ?? '';
  return {
    ...process.env,
    PATH: unique.concat(existingPath).join(path.delimiter)
  };
};

const runCliTool = (projectRoot, binName, args) => {
  const env = makeBinEnv(projectRoot);
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(binName, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (typeof code === 'number') {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(new Error(`${binName} 退出码为 ${code}`));
        }
      } else {
        reject(new Error(`${binName} 因信号 ${signal ?? 'UNKNOWN'} 退出`));
      }
    });
  });
};

const hasCliTool = (projectRoot, binName) => {
  const executableNames =
    process.platform === 'win32' ? [`${binName}.cmd`, `${binName}.exe`, binName] : [binName];
  const binDirs = collectAncestorNodeModuleBinDirs(projectRoot).concat(
    path.join(__dirname, '..', 'node_modules', '.bin')
  );

  return binDirs.some((binDir) =>
    executableNames.some((fileName) => fs.existsSync(path.join(binDir, fileName)))
  );
};

const hasNewerSourceArtifact = (artifactPath, candidateDirs, packageJsonPath) => {
  if (!fs.existsSync(artifactPath)) {
    return true;
  }

  const artifactMtime = fs.statSync(artifactPath).mtimeMs;
  if (fs.existsSync(packageJsonPath) && fs.statSync(packageJsonPath).mtimeMs > artifactMtime) {
    return true;
  }

  const stack = candidateDirs.filter((dir) => fs.existsSync(dir));
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (fs.statSync(fullPath).mtimeMs > artifactMtime) {
        return true;
      }
    }
  }

  return false;
};

const ensurePackageBuildArtifact = async (packageDir, artifactPath, packageLabel) => {
  const packageJsonPath = path.join(packageDir, 'package.json');
  const sourceDirs = ['src', 'packages', 'cli', 'scripts']
    .map((segment) => path.join(packageDir, segment));

  if (!hasNewerSourceArtifact(artifactPath, sourceDirs, packageJsonPath)) {
    return;
  }

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`未找到 ${packageLabel} 的 package.json：${packageJsonPath}`);
  }

  await runCliTool(packageDir, 'npm', ['run', 'build']);

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`未找到 ${packageLabel} 构建产物：${artifactPath}`);
  }
};

const resolveNodePackageEntry = (request, searchPaths, errorMessage) => {
  for (const searchPath of searchPaths) {
    try {
      return require.resolve(request, {
        paths: [searchPath]
      });
    } catch {
      // continue
    }
  }

  throw new Error(errorMessage);
};

const resolveElectronExecutable = (searchPaths) => {
  const electronModulePath = resolveNodePackageEntry(
    'electron',
    searchPaths,
    '未找到 Electron 运行时。请先在生态根目录执行 npm install。'
  );
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const electronExecutable = require(electronModulePath);
  if (typeof electronExecutable !== 'string' || electronExecutable.length === 0) {
    throw new Error('Electron 可执行路径解析失败。');
  }
  return electronExecutable;
};

const runForegroundProcess = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: 'inherit',
      env: options.env ?? process.env,
      detached: process.platform !== 'win32'
    });

    let interrupted = false;
    let forceKillTimer;

    const terminateChild = (signal) => {
      if (child.exitCode !== null) {
        return;
      }

      try {
        if (process.platform === 'win32' || !child.pid) {
          child.kill(signal);
        } else {
          process.kill(-child.pid, signal);
        }
      } catch (error) {
        if (!error || error.code !== 'ESRCH') {
          throw error;
        }
      }

      if (!forceKillTimer) {
        forceKillTimer = setTimeout(() => {
          try {
            if (process.platform === 'win32' || !child.pid) {
              child.kill('SIGKILL');
            } else {
              process.kill(-child.pid, 'SIGKILL');
            }
          } catch (error) {
            if (!error || error.code !== 'ESRCH') {
              throw error;
            }
          }
        }, 5_000);
        forceKillTimer.unref?.();
      }
    };

    const cleanup = () => {
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
      }
    };

    const onSigint = () => {
      interrupted = true;
      terminateChild('SIGTERM');
    };
    const onSigterm = () => {
      interrupted = true;
      terminateChild('SIGTERM');
    };

    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);

    child.on('error', (error) => {
      cleanup();
      reject(error);
    });

    child.on('exit', (code, signal) => {
      cleanup();
      if (interrupted) {
        resolve(undefined);
        return;
      }
      if (typeof code === 'number') {
        if (code === 0) {
          resolve(undefined);
          return;
        }
        reject(new Error(`${command} 退出码为 ${code}`));
        return;
      }

      if (signal === 'SIGINT' || signal === 'SIGTERM') {
        resolve(undefined);
        return;
      }

      reject(new Error(`${command} 因信号 ${signal ?? 'UNKNOWN'} 退出`));
    });
  });

const ensureDirectoryExists = async (dir) => {
  await fsp.mkdir(dir, { recursive: true });
};

const readTextFileIfExists = async (filePath) => {
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    return raw;
  } catch (error) {
    const err = /** @type {NodeJS.ErrnoException} */ (error);
    if (err.code === 'ENOENT') return undefined;
    throw err;
  }
};

const writeTextFile = async (filePath, content) => {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, 'utf-8');
};

const hasProjectVitestConfig = (projectRoot) => {
  const candidateFiles = [
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.config.cts',
    'vitest.config.js',
    'vitest.config.mjs',
    'vitest.config.cjs'
  ];

  return candidateFiles.some((fileName) => fs.existsSync(path.join(projectRoot, fileName)));
};

const defaultConfigTemplate = () => {
  return `/**
 * Chips Dev 配置文件
 * type: app | card | layout | module | theme | i18n
 */

const config = {
  type: 'app',
  srcDir: 'src',
  outDir: 'dist',
  entry: 'index.html',
  testsDir: 'tests'
};

export default config;
`;
};

const handleInit = async () => {
  const projectRoot = resolveProjectRoot();
  const configPath = path.join(projectRoot, PROJECT_CONFIG_FILE);
  const exists = fs.existsSync(configPath);

  if (exists) {
    const config = await loadProjectConfig(projectRoot);
    log({
      message: `${PROJECT_CONFIG_FILE} 已存在，当前配置：`,
      config
    });
    return;
  }

  await writeTextFile(configPath, defaultConfigTemplate());
  log(`已在当前目录创建默认配置文件：${PROJECT_CONFIG_FILE}`);
};

const resolveDevWorkspace = async (projectRoot) => {
  if (process.env.CHIPS_HOME && process.env.CHIPS_HOME.trim().length > 0) {
    return process.env.CHIPS_HOME;
  }

  // 从当前工程向上查找 .chips-host-dev 目录，找到则使用。
  let current = projectRoot;
  while (true) {
    const candidate = path.join(current, '.chips-host-dev');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // 未找到则在项目根目录创建一个新的工作区。
  const fallback = path.join(projectRoot, '.chips-host-dev');
  await ensureDirectoryExists(fallback);
  return fallback;
};

const handleServer = async (mode = 'server') => {
  const projectRoot = resolveProjectRoot();
  const config = await loadProjectConfig(projectRoot);

  const vite = await import('vite');
  const root = projectRoot;
  const isApp = config.type === 'app';
  const entryPath = path.resolve(projectRoot, config.entry);

  const viteConfig = {
    root,
    configFile: false,
    resolve: createFrontendResolveConfig(projectRoot),
    server: {
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
      host: process.env.HOST || 'localhost'
    },
    build: isApp
      ? {
          outDir: config.outDir,
          rollupOptions: {
            input: entryPath
          }
        }
      : {
          outDir: config.outDir,
          lib: {
            entry: entryPath,
            name: config.libraryName || 'ChipsPlugin',
            formats: ['es'],
            fileName: 'index'
          }
        }
  };

  if (mode === 'debug') {
    viteConfig.server.open = true;
  }

  const server = await vite.createServer(viteConfig);
  await server.listen();
  server.printUrls();
};

const handleBuild = async () => {
  const projectRoot = resolveProjectRoot();
  const config = await loadProjectConfig(projectRoot);

  const vite = await import('vite');
  const root = projectRoot;
  const isApp = config.type === 'app';
  const entryPath = path.resolve(projectRoot, config.entry);

  const viteConfig = {
    root,
    configFile: false,
    base: isApp ? './' : undefined,
    resolve: createFrontendResolveConfig(projectRoot),
    build: isApp
      ? {
          outDir: config.outDir,
          rollupOptions: {
            input: entryPath
          }
        }
      : {
          outDir: config.outDir,
          lib: {
            entry: entryPath,
            name: config.libraryName || 'ChipsPlugin',
            formats: ['es'],
            fileName: 'index'
          }
        }
  };

  await vite.build(viteConfig);

  log(`构建完成，输出目录：${config.outDir}`);
};

const handleTest = async (passThroughArgs) => {
  const projectRoot = resolveProjectRoot();
  const config = await loadProjectConfig(projectRoot);
  const args = ['run'];
  if (!hasProjectVitestConfig(projectRoot)) {
    args.push('--dir', config.testsDir);
  }
  args.push(...passThroughArgs);
  await runCliTool(projectRoot, 'vitest', args);
};

const handleLint = async () => {
  const projectRoot = resolveProjectRoot();
  await loadProjectConfig(projectRoot);

  if (!hasCliTool(projectRoot, 'eslint')) {
    throw new Error(
      '未检测到 ESLint 可执行文件。请在工程中安装 eslint 并配置 .eslintrc 后再运行 chipsdev lint。'
    );
  }

  const patterns = ['src/**/*.{ts,tsx,js,jsx}', 'tests/**/*.{ts,tsx,js,jsx}'];
  await runCliTool(projectRoot, 'eslint', patterns);
};

const handleE2E = async () => {
  const projectRoot = resolveProjectRoot();
  await loadProjectConfig(projectRoot);

  const pkgJsonPath = path.join(projectRoot, 'package.json');
  const pkg = await loadJsonFile(pkgJsonPath, {});
  const scripts = pkg.scripts || {};

  if (typeof scripts.e2e === 'string') {
    await runCliTool(projectRoot, 'npm', ['run', 'e2e']);
    return;
  }

  throw new Error(
    '当前工程未定义 e2e 测试脚本。请在 package.json 中添加 "e2e" 脚本后再运行 chipsdev e2e。'
  );
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeManifestAssetPath = (value) =>
  path.normalize(String(value).trim()).replace(/^[.][\\/]/, '');

const collectManifestAssetPaths = (manifest) => {
  const assets = [];

  if (typeof manifest?.entry === 'string' && manifest.entry.trim().length > 0) {
    assets.push(manifest.entry.trim());
  } else if (isPlainObject(manifest?.entry)) {
    for (const value of Object.values(manifest.entry)) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error('manifest.entry 中的路径必须是非空字符串。');
      }
      assets.push(value.trim());
    }
  } else if (typeof manifest?.entry !== 'undefined') {
    throw new Error('manifest.entry 必须是字符串或对象。');
  }

  const layout = isPlainObject(manifest?.ui) && isPlainObject(manifest.ui.layout) ? manifest.ui.layout : undefined;
  const launcher = isPlainObject(manifest?.ui) && isPlainObject(manifest.ui.launcher) ? manifest.ui.launcher : undefined;
  for (const field of ['contract', 'minFunctionalSet']) {
    const value = layout?.[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      assets.push(value.trim());
    }
  }

  if (typeof launcher?.icon === 'string' && launcher.icon.trim().length > 0) {
    assets.push(launcher.icon.trim());
  }

  if (typeof manifest?.preview === 'string' && manifest.preview.trim().length > 0) {
    assets.push(manifest.preview.trim());
  }

  return [...new Set(assets.map(normalizeManifestAssetPath).filter((item) => item.length > 0))];
};

const collectManifestAssetRoots = (assets) => {
  const roots = new Set();
  for (const asset of assets) {
    const normalized = normalizeManifestAssetPath(asset);
    const segments = normalized.split(path.sep).filter(Boolean);
    if (segments.length === 0) {
      continue;
    }
    roots.add(segments.length === 1 ? normalized : segments[0]);
  }
  return [...roots];
};

const collectPackageFiles = async (projectRoot, sourceRoots) => {
  const files = [];
  const seenRoots = new Set();
  const stack = [];

  for (const sourceRoot of sourceRoots) {
    const normalizedRoot = path.resolve(projectRoot, sourceRoot);
    if (seenRoots.has(normalizedRoot)) {
      continue;
    }
    seenRoots.add(normalizedRoot);
    stack.push(normalizedRoot);
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join('/');
      const normalized = relativePath.toLowerCase();

      if (
        normalized === 'manifest.yaml' ||
        normalized.endsWith('/manifest.yaml') ||
        normalized === 'manifest.yml' ||
        normalized.endsWith('/manifest.yml') ||
        normalized === 'manifest.json' ||
        normalized.endsWith('/manifest.json') ||
        normalized === 'publish-meta.json' ||
        normalized.endsWith('/publish-meta.json') ||
        normalized.endsWith('.cpk')
      ) {
        continue;
      }

      files.push({
        absolutePath,
        archivePath: relativePath
      });
    }
  }

  files.sort((left, right) => left.archivePath.localeCompare(right.archivePath));
  return files;
};

const zipDirectoryToCpk = async (projectRoot, sourceRoots, manifestPath, targetFile) => {
  const archiver = require('archiver');

  await ensureDirectoryExists(path.dirname(targetFile));

  const output = fs.createWriteStream(targetFile);
  const archive = archiver('zip', { store: true });

  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);

  // manifest.yaml 放在包根目录
  archive.file(manifestPath, { name: 'manifest.yaml', store: true });

  // 构建产物放在 dist/ 目录下；排除错误产物与已生成的打包产物，
  // 避免包内出现重复 manifest 或将 .cpk 自身再次打进包里。
  const files = await collectPackageFiles(projectRoot, sourceRoots);
  for (const file of files) {
    archive.file(file.absolutePath, { name: file.archivePath, store: true });
  }

  archive.finalize();

  await done;
};

const handlePackage = async () => {
  const projectRoot = resolveProjectRoot();
  const config = await loadProjectConfig(projectRoot);
  const { manifest, manifestPath } = await loadManifest(projectRoot);

  const outDir = path.join(projectRoot, config.outDir);
  const hasOutDir = fs.existsSync(outDir) && fs.statSync(outDir).isDirectory();
  if (!hasOutDir) {
    throw new Error(
      `未找到构建输出目录：${outDir}。请先运行 chipsdev build 再执行 chipsdev package。`
    );
  }

  const pluginId = manifest.id || manifest.pluginId;
  const version = manifest.version || '0.1.0';
  if (!pluginId || typeof pluginId !== 'string') {
    throw new Error('manifest.yaml 中缺少插件标识字段 id（或 pluginId）。');
  }

  const safeId = pluginId.replace(/[^a-zA-Z0-9_.-]+/g, '_');
  const fileName = `${safeId}-${version}.cpk`;
  const targetDir = path.join(projectRoot, 'dist');
  const sourceRoots = [...new Set([config.outDir, ...collectManifestAssetRoots(collectManifestAssetPaths(manifest))])];

  await assertManifestAssetsExist(projectRoot, manifest);

  await ensureDirectoryExists(targetDir);
  const targetPath = path.join(targetDir, fileName);

  await zipDirectoryToCpk(projectRoot, sourceRoots, manifestPath, targetPath);

  log({
    message: '打包成功',
    output: targetPath
  });
};

const validateManifestShape = (manifest) => {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    errors.push('manifest 必须是对象。');
    return errors;
  }
  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('manifest.id 必须存在且为字符串。');
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('manifest.name 必须存在且为字符串。');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('manifest.version 必须存在且为字符串。');
  }
  if (!manifest.type || typeof manifest.type !== 'string') {
    errors.push('manifest.type 必须存在且为字符串。');
  }
  return errors;
};

const assertManifestAssetsExist = async (projectRoot, manifest) => {
  const assets = collectManifestAssetPaths(manifest);
  for (const asset of assets) {
    const assetPath = path.join(projectRoot, asset);
    try {
      await fsp.access(assetPath, fs.constants.R_OK);
    } catch {
      throw new Error(`manifest 资源不存在：${asset}`);
    }
  }
};

const handleValidate = async () => {
  const projectRoot = resolveProjectRoot();
  const config = await loadProjectConfig(projectRoot);
  const { manifest } = await loadManifest(projectRoot);

  const errors = validateManifestShape(manifest);

  const outDir = path.join(projectRoot, config.outDir);
  const distExists = fs.existsSync(outDir) && fs.statSync(outDir).isDirectory();

  if (!distExists) {
    errors.push(`构建输出目录不存在：${config.outDir}，请先运行 chipsdev build。`);
  } else {
    const files = await fsp.readdir(outDir);
    if (files.length === 0) {
      errors.push(`构建输出目录 ${config.outDir} 为空，请检查构建配置。`);
    }
  }

  try {
    await assertManifestAssetsExist(projectRoot, manifest);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const result = {
    ok: errors.length === 0,
    errors,
    summary: {
      manifest: manifest.id ?? '(missing id)',
      version: manifest.version,
      type: manifest.type,
      outDir: config.outDir
    }
  };

  if (!result.ok) {
    logError(result);
    throw new Error('chipsdev validate 发现问题，请根据 errors 列表修复。');
  }

  log(result);
};

const findAncestorWithEntries = (startPath, entries) => {
  let current = path.resolve(startPath);
  while (true) {
    if (entries.every((entry) => fs.existsSync(path.join(current, entry)))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

const loadPackageJsonSync = (packageJsonPath) => {
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  } catch {
    return null;
  }
};

const toRealPathIfExists = (targetPath) => {
  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
};

const isEcosystemWorkspaceRoot = (targetPath) => {
  const packageJsonPath = path.join(targetPath, 'package.json');
  const pkg = loadPackageJsonSync(packageJsonPath);
  if (!pkg || pkg.name !== 'chips-ecosystem-workspace') {
    return false;
  }
  return Array.isArray(pkg.workspaces);
};

const findEcosystemWorkspaceRoot = (startPath) => {
  let current = toRealPathIfExists(startPath);
  while (true) {
    if (isEcosystemWorkspaceRoot(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');

const workspacePatternToRegex = (pattern) => {
  const normalized = pattern.split(path.sep).join('/');
  let source = '^';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === '*') {
      if (normalized[index + 1] === '*') {
        source += '.*';
        index += 1;
      } else {
        source += '[^/]+';
      }
      continue;
    }
    source += escapeRegex(char);
  }
  source += '$';
  return new RegExp(source);
};

const workspacePatternMatches = (pattern, relativePath) => {
  return workspacePatternToRegex(pattern).test(relativePath.split(path.sep).join('/'));
};

const ensureWorkspaceRegistration = async (ecosystemRoot, targetDir) => {
  const relativePath = path.relative(ecosystemRoot, targetDir).split(path.sep).join('/');
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return;
  }

  const rootPackagePath = path.join(ecosystemRoot, 'package.json');
  const rootPackage = await loadJsonFile(rootPackagePath, {});
  const workspaceEntries = Array.isArray(rootPackage.workspaces) ? [...rootPackage.workspaces] : [];
  const alreadyCovered = workspaceEntries.some((entry) => {
    if (entry === relativePath) {
      return true;
    }
    return workspacePatternMatches(entry, relativePath);
  });

  if (alreadyCovered) {
    return;
  }

  workspaceEntries.push(relativePath);
  rootPackage.workspaces = workspaceEntries.sort((left, right) => left.localeCompare(right));
  await saveJsonFile(rootPackagePath, rootPackage);
};

const resolveEcosystemRoot = () => {
  const fromEnv = process.env.CHIPS_ECOSYSTEM_ROOT;
  if (fromEnv) {
    const resolved = toRealPathIfExists(fromEnv);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  const projectRoot = resolveProjectRoot();
  const fromWorkspace = findEcosystemWorkspaceRoot(projectRoot);
  if (fromWorkspace) {
    return fromWorkspace;
  }

  const fromProject = findAncestorWithEntries(projectRoot, ['Chips-SDK', 'Chips-Host']);
  if (fromProject) {
    return fromProject;
  }

  const cliPackageRoot = path.resolve(__dirname, '..');
  const fromCliWorkspace = findEcosystemWorkspaceRoot(cliPackageRoot);
  if (fromCliWorkspace) {
    return fromCliWorkspace;
  }

  const fromCliPackage = findAncestorWithEntries(cliPackageRoot, ['Chips-SDK', 'Chips-Host']);
  if (fromCliPackage) {
    return fromCliPackage;
  }

  return toRealPathIfExists(path.resolve(__dirname, '..', '..'));
};

const resolveHostCliPath = async (projectRoot) => {
  const ecosystemRoot = resolveEcosystemRoot();
  const hostPackageDir = path.join(ecosystemRoot, 'Chips-Host');
  const hostCliPath = path.join(hostPackageDir, 'dist', 'src', 'main', 'cli', 'index.js');
  await ensurePackageBuildArtifact(hostPackageDir, hostCliPath, 'Chips-Host');
  return {
    ecosystemRoot,
    hostPackageDir,
    hostCliPath
  };
};

const runHostCliCommand = async (projectRoot, workspacePath, args, extraEnv = {}) => {
  const { hostCliPath } = await resolveHostCliPath(projectRoot);
  await new Promise((resolve, reject) => {
    const child = childProcess.spawn(process.execPath, [hostCliPath, ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...makeBinEnv(projectRoot),
        ...extraEnv,
        CHIPS_HOME: workspacePath
      }
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject({
        __alreadyLogged: true,
        error:
          typeof code === 'number'
            ? `host cli exited with code ${code}`
            : `host cli exited with signal ${signal ?? 'UNKNOWN'}`
      });
    });
  });
};

const loadRuntimePluginRecords = async (workspacePath) => {
  return loadJsonFile(path.join(workspacePath, 'plugin-runtime.json'), []);
};

const hasEnabledThemePlugin = (records) =>
  records.some(
    (record) =>
      record &&
      typeof record === 'object' &&
      record.enabled === true &&
      record.manifest &&
      record.manifest.type === 'theme'
  );

const ensureDevWorkspaceThemeBootstrap = async (projectRoot, workspacePath) => {
  const records = await loadRuntimePluginRecords(workspacePath);
  if (hasEnabledThemePlugin(records)) {
    return;
  }

  const ecosystemRoot = resolveEcosystemRoot();
  const defaultThemePackageDir = path.join(ecosystemRoot, 'ThemePack', 'Chips-default');
  const defaultThemeManifestPath = path.join(ecosystemRoot, 'ThemePack', 'Chips-default', 'manifest.yaml');
  await ensurePackageBuildArtifact(
    defaultThemePackageDir,
    path.join(defaultThemePackageDir, 'dist', 'theme.css'),
    'Chips 默认主题包'
  );
  const defaultThemePluginId = 'theme.theme.chips-official-default-theme';
  const defaultThemeId = 'chips-official.default-theme';
  const hasDefaultThemeInstalled = records.some(
    (record) =>
      record &&
      typeof record === 'object' &&
      record.manifest &&
      record.manifest.id === defaultThemePluginId
  );

  if (!hasDefaultThemeInstalled) {
    await runHostCliCommand(projectRoot, workspacePath, ['plugin', 'install', defaultThemeManifestPath], {
      CHIPS_WORKSPACE_KIND: 'dev'
    });
  }

  await runHostCliCommand(projectRoot, workspacePath, ['plugin', 'enable', defaultThemePluginId], {
    CHIPS_WORKSPACE_KIND: 'dev'
  });

  const config = await loadJsonFile(path.join(workspacePath, 'config.json'), {});
  if (typeof config['ui.theme'] !== 'string' || config['ui.theme'].trim().length === 0) {
    await runHostCliCommand(projectRoot, workspacePath, ['theme', 'apply', defaultThemeId], {
      CHIPS_WORKSPACE_KIND: 'dev'
    });
  }
};

const delegateHostManagedCommand = async (command, args) => {
  const projectRoot = resolveProjectRoot();
  const workspacePath = await resolveDevWorkspace(projectRoot);
  const requiresThemeBootstrap = new Set(['theme', 'run', 'open']);

  if (requiresThemeBootstrap.has(command)) {
    await ensureDevWorkspaceThemeBootstrap(projectRoot, workspacePath);
  }

  await runHostCliCommand(projectRoot, workspacePath, [command, ...args], {
    CHIPS_WORKSPACE_KIND: 'dev'
  });
};

const adaptWorkspaceDependencies = async (targetDir) => {
  const pkgJsonPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    return;
  }

  const ecosystemRoot = resolveEcosystemRoot();
  const targetRoot = toRealPathIfExists(targetDir);
  const relativePath = path.relative(ecosystemRoot, targetRoot);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return;
  }

  await ensureWorkspaceRegistration(ecosystemRoot, targetRoot);

  const pkg = await loadJsonFile(pkgJsonPath, {});
  const relativeRootPackagePath = path
    .relative(targetRoot, path.join(ecosystemRoot, 'package.json'))
    .split(path.sep)
    .join('/');
  const nextVolta = {
    ...(pkg.volta && typeof pkg.volta === 'object' ? pkg.volta : {}),
    extends: relativeRootPackagePath
  };
  const needsUpdate =
    !pkg.volta ||
    typeof pkg.volta !== 'object' ||
    pkg.volta.extends !== relativeRootPackagePath;

  if (needsUpdate) {
    pkg.volta = nextVolta;
    await saveJsonFile(pkgJsonPath, pkg);
  }
};

const deriveProjectName = (targetDir) => {
  const rawName = path.basename(path.resolve(targetDir));
  return rawName.length > 0 ? rawName : 'chips-project';
};

const slugifyForPluginId = (value) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'chips-project';
};

const toDisplayName = (value) => {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase()) || 'Chips Project';
};

const deriveAuthorName = () => process.env.USER || process.env.USERNAME || 'Chips Developer';

const deriveAuthorEmail = (slug) => `${slug}@example.invalid`;

const handleCreate = async (args) => {
  const projectRoot = resolveProjectRoot();

  // 简单参数解析：chipsdev create <type> <targetDir> [--template id] [...]
  const [type, targetDir = '.'] = args;
  if (!type) {
    throw new Error('chipsdev create 需要指定类型，例如：chipsdev create app my-app');
  }

  const ecosystemRoot = resolveEcosystemRoot();
  const scaffoldRoot = path.join(ecosystemRoot, 'Chips-Scaffold');

  if (!fs.existsSync(scaffoldRoot) || !fs.statSync(scaffoldRoot).isDirectory()) {
    throw new Error(
      `未找到 Chips-Scaffold 目录：${scaffoldRoot}。请在包含 Chips-Scaffold 的工作区内运行 chipsdev。`
    );
  }

  if (type === 'theme') {
    // 主题脚手架：使用 chips-scaffold-theme 提供的 API。
    const packageDir = path.join(scaffoldRoot, 'chips-scaffold-theme');
    const modulePath = path.join(
      packageDir,
      'dist',
      'src',
      'index.js'
    );
    await ensurePackageBuildArtifact(packageDir, modulePath, '主题脚手架');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const themeScaffold = require(modulePath);
    const options = {
      targetDir: path.resolve(projectRoot, targetDir),
      themeId: 'chips-official:default-theme',
      displayName: 'Chips Theme',
      templateId: 'theme-standard'
    };
    await themeScaffold.createThemeProject(options);
    await adaptWorkspaceDependencies(options.targetDir);
    log({
      message: '主题工程创建完成',
      targetDir: options.targetDir,
      templateId: options.templateId
    });
    return;
  }

  if (type === 'app') {
    const packageDir = path.join(scaffoldRoot, 'chips-scaffold-app');
    const modulePath = path.join(
      packageDir,
      'dist',
      'src',
      'cli',
      'app-scaffold-api.js'
    );
    await ensurePackageBuildArtifact(packageDir, modulePath, '应用脚手架');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const appScaffold = require(modulePath);
    const projectName = deriveProjectName(targetDir);
    const slug = slugifyForPluginId(projectName);
    const options = {
      projectName,
      targetDir: path.resolve(projectRoot, targetDir),
      templateId: 'app-standard',
      pluginId: `com.example.${slug}`,
      displayName: toDisplayName(projectName),
      version: '0.1.0',
      authorName: deriveAuthorName(),
      authorEmail: deriveAuthorEmail(slug)
    };
    await appScaffold.createAppProject(options);
    await adaptWorkspaceDependencies(options.targetDir);
    log({
      message: '应用工程创建完成',
      targetDir: options.targetDir,
      templateId: options.templateId
    });
    return;
  }

  if (type === 'card') {
    const packageDir = path.join(scaffoldRoot, 'chips-scaffold-basecard');
    const modulePath = path.join(
      packageDir,
      'dist',
      'src',
      'index.js'
    );
    await ensurePackageBuildArtifact(packageDir, modulePath, '基础卡片脚手架');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const basecardScaffold = require(modulePath);
    const projectName = deriveProjectName(targetDir);
    const slug = slugifyForPluginId(projectName);
    const options = {
      projectName,
      targetDir: path.resolve(projectRoot, targetDir),
      templateId: 'card-standard',
      pluginId: `com.example.${slug}`,
      cardType: `base.${slug.replace(/-/g, '.')}`,
      displayName: toDisplayName(projectName),
      version: '0.1.0',
      authorName: deriveAuthorName(),
      authorEmail: deriveAuthorEmail(slug)
    };
    await basecardScaffold.createBasecardProject(options);
    await adaptWorkspaceDependencies(options.targetDir);
    log({
      message: '基础卡片工程创建完成',
      targetDir: options.targetDir,
      templateId: options.templateId
    });
    return;
  }

  if (type === 'module') {
    const packageDir = path.join(scaffoldRoot, 'chips-scaffold-module');
    const modulePath = path.join(
      packageDir,
      'dist',
      'src',
      'index.js'
    );
    await ensurePackageBuildArtifact(packageDir, modulePath, '模块脚手架');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const moduleScaffold = require(modulePath);
    const projectName = deriveProjectName(targetDir);
    const slug = slugifyForPluginId(projectName);
    const options = {
      projectName,
      targetDir: path.resolve(projectRoot, targetDir),
      templateId: 'module-standard',
      pluginId: `chips.module.${slug.replace(/-/g, '.')}`,
      moduleCapability: `module.${slug.replace(/-/g, '.')}`,
      displayName: toDisplayName(projectName),
      version: '0.1.0',
      authorName: deriveAuthorName(),
      authorEmail: deriveAuthorEmail(slug)
    };
    await moduleScaffold.createModuleProject(options);
    await adaptWorkspaceDependencies(options.targetDir);
    log({
      message: '模块工程创建完成',
      targetDir: options.targetDir,
      templateId: options.templateId
    });
    return;
  }

  throw new Error(
    `不支持的 create 类型：${type}。当前支持：app、card、module、theme。`
  );
};

const getChipsdevConfigPath = () => {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error('无法确定用户主目录，无法保存 chipsdev 配置。');
  }
  return path.join(home, '.chipsdev', 'config.json');
};

const handleLogin = async () => {
  const configPath = getChipsdevConfigPath();
  const existing = await loadJsonFile(configPath, {});

  const next = {
    ...existing,
    loggedInAt: new Date().toISOString()
  };

  await saveJsonFile(configPath, next);
  log({
    message: '已在本机记录 chipsdev 登录时间（占位本地配置），后续可对接在线市场服务。',
    configPath
  });
};

const handlePublish = async () => {
  const projectRoot = resolveProjectRoot();
  const config = await loadProjectConfig(projectRoot);
  const { manifest } = await loadManifest(projectRoot);

  const outDir = path.join(projectRoot, config.outDir);
  const distExists = fs.existsSync(outDir) && fs.statSync(outDir).isDirectory();
  if (!distExists) {
    throw new Error(
      `未找到构建输出目录：${config.outDir}。请先运行 chipsdev build && chipsdev package。`
    );
  }

  const cpkDir = path.join(projectRoot, 'dist');
  const cpkFiles = fs.existsSync(cpkDir)
    ? (await fsp.readdir(cpkDir)).filter((name) => name.endsWith('.cpk'))
    : [];

  if (cpkFiles.length === 0) {
    throw new Error(
      `未找到 .cpk 包。请先运行 chipsdev package 生成插件包。`
    );
  }

  const publishMeta = {
    pluginId: manifest.id ?? manifest.pluginId,
    name: manifest.name,
    version: manifest.version,
    type: manifest.type,
    files: cpkFiles.map((name) => path.join('dist', name)),
    createdAt: new Date().toISOString()
  };

  const metaPath = path.join(projectRoot, 'dist', 'publish-meta.json');
  await saveJsonFile(metaPath, publishMeta);

  log({
    message:
      '已生成发布元数据（publish-meta.json），可作为对接线上市场服务的输入。',
    metaPath
  });
};

const main = async () => {
  const { command, args } = parseArgs(process.argv.slice(2));

  if (!COMMANDS.has(command)) {
    logError({
      error: `未知命令：${command}`,
      hint: '使用 `chipsdev help` 查看可用命令'
    });
    process.exitCode = 1;
    return;
  }

  if (command === 'help') {
    printHelp();
    process.exitCode = 0;
    return;
  }

  if (command === 'version') {
    const version = await loadPackageJsonVersion();
    log({ name: 'chipsdev', version });
    process.exitCode = 0;
    return;
  }

  try {
    if (HOST_MANAGED_COMMANDS.has(command)) {
      await delegateHostManagedCommand(command, args);
    } else if (command === 'init') {
      await handleInit();
    } else if (command === 'server') {
      await handleServer('server');
    } else if (command === 'debug') {
      await handleServer('debug');
    } else if (command === 'build') {
      await handleBuild();
    } else if (command === 'test') {
      await handleTest(args);
    } else if (command === 'lint') {
      await handleLint();
    } else if (command === 'e2e') {
      await handleE2E();
    } else if (command === 'package') {
      await handlePackage();
    } else if (command === 'validate') {
      await handleValidate();
    } else if (command === 'create') {
      await handleCreate(args);
    } else if (command === 'login') {
      await handleLogin();
    } else if (command === 'publish') {
      await handlePublish();
    } else if (command === 'run') {
      await handleRun();
    } else {
      logError({
        error: `未处理的命令：${command}`,
        hint: '使用 `chipsdev help` 查看可用命令'
      });
      process.exitCode = 1;
      return;
    }

    process.exitCode = 0;
  } catch (error) {
    const payload = toErrorPayload(error);
    if (payload) {
      logError(payload);
    }
    process.exitCode = 1;
  }
};

const handleRun = async () => {
  const projectRoot = resolveProjectRoot();
  await loadProjectConfig(projectRoot);
  const { manifest, manifestPath } = await loadManifest(projectRoot);

  if (manifest.type !== 'app') {
    throw new Error(
      `chipsdev run 当前仅支持应用插件 (manifest.type === "app")，当前类型为：${manifest.type}`
    );
  }

  // 先执行构建，确保应用构建产物与相对资源路径就绪。
  await handleBuild();

  const workspacePath = await resolveDevWorkspace(projectRoot);
  await ensureDevWorkspaceThemeBootstrap(projectRoot, workspacePath);
  const { ecosystemRoot, hostPackageDir } = await resolveHostCliPath(projectRoot);
  const hostRunnerPath = path.join(hostPackageDir, 'dist', 'src', 'main', 'electron', 'dev-run-app.js');

  await ensurePackageBuildArtifact(hostPackageDir, hostRunnerPath, 'Chips-Host');

  const electronExecutable = resolveElectronExecutable([hostPackageDir, ecosystemRoot]);

  await runForegroundProcess(electronExecutable, [hostRunnerPath, `--workspace=${workspacePath}`, `--manifest=${manifestPath}`], {
    cwd: projectRoot,
    env: makeBinEnv(projectRoot)
  });
};

main().catch((error) => {
  logError(toErrorPayload(error));
  process.exitCode = 1;
});
