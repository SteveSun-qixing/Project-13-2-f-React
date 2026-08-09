#!/usr/bin/env node

/**
 * Chips Dev 开发者命令行工具（chipsdev-r）
 *
 * 统一入口：chipsdev-r <command> [options]
 * 底层使用 Vite（dev server + build）与 Vitest（test），由 chips.config.mjs 驱动。
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const childProcess = require('node:child_process');
const yaml = require('yaml');
const {
  createAssimilationScanReport,
  createComponentGalleryReport,
  createDiagnosticsReport,
  createPreviewReport,
  createQualityGateReport,
  createThemeInspectReport
} = require('../src/tooling/developer-tools.cjs');

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
  'completion',
  '__complete',
  'module',
  'preview',
  'component',
  'quality',
  'assimilate',
  'diagnostics',
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
  '--interactive',
  'run'
]);

const HOST_FIXED_COMMANDS = new Set([
  'help',
  'host',
  'start',
  'stop',
  'status',
  'config',
  'logs',
  'theme',
  'plugin',
  'update',
  'doctor',
  'open',
  'completion',
  '__complete'
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
  'open',
  'completion',
  '__complete'
]);

const CLI_COMMAND_PATH_KINDS = new Set(['file', 'directory', 'any']);
const CLI_COMMAND_PATH_ROLES = new Set(['input', 'output']);
const CLI_COMMAND_OVERWRITE_POLICIES = new Set(['fail', 'overwrite', 'rename', 'skip']);
const CLI_COMMAND_BATCH_FORMATS = new Set(['lines', 'json-array']);
const CLI_COMMAND_BATCH_ITEM_TYPES = new Set(['value', 'path']);
const CLI_COMMAND_PARAMETER_TYPES = new Set([
  'string',
  'stringList',
  'number',
  'integer',
  'boolean',
  'enum',
  'path',
  'json',
  'jsonFile',
  'text',
  'textFile'
]);
const CLI_COMMAND_OUTPUT_MODES = new Set(['human', 'json']);
const CLI_COMMAND_JSON_OUTPUT_POLICIES = new Set(['supported', 'required', 'unsupported']);
const CLI_COMMAND_SURFACE_REUSE_POLICIES = new Set(['always', 'never', 'preferred']);
const CLI_COMMAND_PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;
const CLI_COMMAND_PARAM_NAME_PATTERN = /^[a-z][a-z0-9-]*$/i;
const CLI_COMMAND_MAPS_TO_PATTERN = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;
const CLI_COMMAND_PERMISSION_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

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
      'Chips Dev 命令行工具 (chipsdev-r)',
      '',
      '用法：',
      '  chipsdev-r <command> [options]',
      '  chipsdev-r',
      '  chipsdev-r --interactive',
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
      '  module      在真实 Electron Host 中调试模块插件能力调用',
      '  preview     生成项目预览链路报告（Host mock / 真实 Host 工作区）',
      '  component   生成组件矩阵和主题契约覆盖报告',
      '  quality     汇总 SDK / 组件库 / 主题包质量门禁报告',
      '  assimilate  扫描外部 Web 项目并生成同化报告',
      '  diagnostics 输出生态开发工具诊断报告',
      '  server      启动 Vite 开发服务器',
      '  debug       以调试模式启动目标项目（与 server 行为一致，可扩展调试预设）',
      '  build       执行正式构建（优先使用工程 build 脚本）',
      '  test        使用 Vitest 运行单元测试',
      '  lint        使用 ESLint 执行代码规范检查',
      '  e2e         运行端到端测试（工程自行提供 e2e 脚本时调用）',
      '  package     根据 manifest.yaml 和构建产物打包生成 .cpk 插件包',
      '  validate    执行项目级契约校验（配置、清单、产物完整性等）',
      '  login       在本机保存开发者发布身份配置',
      '  publish     生成发布包元数据并校验，可对接后续正式发布系统',
      '  run         在开发环境下启动 Host 并运行应用插件',
      '  version     查看 chipsdev-r 版本',
      '  help        查看帮助信息',
      '',
      '交互模式：',
      '  不带参数运行 chipsdev-r 会进入开发工作区 TUI；非交互终端下会安全返回提示。',
      '  chipsdev-r --interactive 可显式进入同一 TUI。'
    ].join('\n')
  );
};

const parseArgs = (argv) => {
  const [command = '', ...rest] = argv;
  return { command, args: rest };
};

const parseReportOptions = (args, optionDefinitions = {}) => {
  const options = {
    json: false,
    out: undefined,
    values: {},
    positionals: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--json') {
      options.json = true;
      continue;
    }
    if (token === '--out') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--out 需要提供输出文件路径。');
      }
      options.out = path.resolve(value);
      index += 1;
      continue;
    }

    if (token.startsWith('--')) {
      const name = token.slice(2);
      const definition = optionDefinitions[name];
      if (!definition) {
        throw new Error(`不支持的参数：${token}`);
      }

      if (definition.type === 'boolean') {
        options.values[name] = true;
        continue;
      }

      const value = args[index + 1];
      if (!value) {
        throw new Error(`${token} 需要提供参数值。`);
      }
      options.values[name] = value;
      index += 1;
      continue;
    }

    options.positionals.push(token);
  }

  return options;
};

const writeReportFile = async (filePath, report) => {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
};

const printReport = async (report, options, renderHuman) => {
  if (options.out) {
    await writeReportFile(options.out, report);
  }

  if (options.json) {
    log(report);
    return;
  }

  const lines = renderHuman(report);
  if (options.out) {
    lines.push(`JSON 报告已写入：${options.out}`);
  } else {
    lines.push('提示：添加 --json 可输出机器可读 JSON，添加 --out <file> 可保存完整报告。');
  }
  log(lines.join('\n'));
};

const formatStatus = (status) => status ?? 'unknown';

const renderCheckLines = (checks, limit = 12) => {
  const lines = [];
  for (const check of checks.slice(0, limit)) {
    lines.push(`  - ${check.name}: ${formatStatus(check.status)}`);
  }
  if (checks.length > limit) {
    lines.push(`  - ... 还有 ${checks.length - limit} 项检查，使用 --json 查看完整内容`);
  }
  return lines;
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

const createFrontendDefineConfig = (mode) => ({
  'process.env.NODE_ENV': JSON.stringify(mode)
});

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
  for (const searchPath of searchPaths) {
    const requireBase = path.join(searchPath, 'package.json');
    try {
      const scopedRequire = createRequire(requireBase);
      const electronExecutable = scopedRequire('electron');
      if (typeof electronExecutable === 'string' && electronExecutable.length > 0) {
        return electronExecutable;
      }
      throw new Error('Electron 可执行路径解析失败。');
    } catch (error) {
      if (error && error.code === 'MODULE_NOT_FOUND') {
        continue;
      }
      throw error;
    }
  }

  throw new Error('未找到 Electron 运行时。请先在生态根目录执行 npm install。');
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
 * type: app | card | layout | module | theme
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
    define: createFrontendDefineConfig('development'),
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

const BUILD_SCRIPT_RECURSION_PATTERNS = [
  /\bchipsdev-r\s+build\b/i,
  /\bnpm\s+run\s+build\b/i,
  /\bnpm\s+build\b/i,
  /\bpnpm\s+run\s+build\b/i,
  /\bpnpm\s+build\b/i,
  /\byarn\s+build\b/i,
  /\bbun\s+run\s+build\b/i
];

const shouldDelegateToPackageBuildScript = async (projectRoot) => {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  const pkg = await loadJsonFile(packageJsonPath, null);
  if (!pkg || typeof pkg !== 'object') {
    return false;
  }

  const buildScript = typeof pkg.scripts?.build === 'string' ? pkg.scripts.build.trim() : '';
  if (!buildScript) {
    return false;
  }

  return !BUILD_SCRIPT_RECURSION_PATTERNS.some((pattern) => pattern.test(buildScript));
};

const buildProject = async (projectRoot, config) => {
  if (await shouldDelegateToPackageBuildScript(projectRoot)) {
    await runCliTool(projectRoot, 'npm', ['run', 'build']);
    return;
  }

  const vite = await import('vite');
  const isApp = config.type === 'app';
  const entryPath = path.resolve(projectRoot, config.entry);

  const viteConfig = {
    root: projectRoot,
    configFile: false,
    base: isApp ? './' : undefined,
    define: createFrontendDefineConfig('production'),
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
};

const handleBuild = async () => {
  const projectRoot = resolveProjectRoot();
  const config = await loadProjectConfig(projectRoot);
  await buildProject(projectRoot, config);
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
      '未检测到 ESLint 可执行文件。请在工程中安装 eslint 并配置 .eslintrc 后再运行 chipsdev-r lint。'
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
    '当前工程未定义 e2e 测试脚本。请在 package.json 中添加 "e2e" 脚本后再运行 chipsdev-r e2e。'
  );
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeManifestAssetPath = (value) =>
  path.normalize(String(value).trim()).replace(/^[.][\\/]/, '');

const parseCliCommandPathSegments = (value) => {
  if (typeof value === 'string') {
    return value.trim().split(/\s+/).filter((segment) => segment.length > 0);
  }
  if (Array.isArray(value)) {
    return value.map((segment) => (typeof segment === 'string' ? segment.trim() : ''));
  }
  return null;
};

const appendCliPathRuleManifestErrors = (rule, errors, field) => {
  if (typeof rule === 'undefined') {
    return;
  }
  if (!isPlainObject(rule)) {
    errors.push(`${field} 提供时必须是对象。`);
    return;
  }
  if (typeof rule.kind !== 'undefined' && (typeof rule.kind !== 'string' || !CLI_COMMAND_PATH_KINDS.has(rule.kind))) {
    errors.push(`${field}.kind 必须是 file / directory / any 之一。`);
  }
  if (typeof rule.role !== 'undefined' && (typeof rule.role !== 'string' || !CLI_COMMAND_PATH_ROLES.has(rule.role))) {
    errors.push(`${field}.role 必须是 input / output 之一。`);
  }
  for (const key of ['exists', 'create']) {
    if (typeof rule[key] !== 'undefined' && typeof rule[key] !== 'boolean') {
      errors.push(`${field}.${key} 必须是布尔值。`);
    }
  }
  if (typeof rule.extensions !== 'undefined') {
    if (
      !Array.isArray(rule.extensions) ||
      rule.extensions.length === 0 ||
      rule.extensions.some((item) => typeof item !== 'string' || item.trim().length === 0)
    ) {
      errors.push(`${field}.extensions 必须是非空字符串数组。`);
    }
  }
  if (
    typeof rule.overwrite !== 'undefined' &&
    (typeof rule.overwrite !== 'string' || !CLI_COMMAND_OVERWRITE_POLICIES.has(rule.overwrite))
  ) {
    errors.push(`${field}.overwrite 必须是 fail / overwrite / rename / skip 之一。`);
  }
  if (typeof rule.overwrite !== 'undefined' && rule.role !== 'output') {
    errors.push(`${field}.overwrite 只能在 role: output 时声明。`);
  }
};

const appendCliBatchRuleManifestErrors = (batch, errors, field, parameterType) => {
  if (typeof batch === 'undefined') {
    return;
  }
  if (!isPlainObject(batch)) {
    errors.push(`${field} 提供时必须是对象。`);
    return;
  }
  if (parameterType !== 'textFile' && parameterType !== 'jsonFile') {
    errors.push(`${field} 只允许 textFile / jsonFile 参数声明。`);
  }
  if (typeof batch.format !== 'string' || !CLI_COMMAND_BATCH_FORMATS.has(batch.format)) {
    errors.push(`${field}.format 必须是 lines / json-array 之一。`);
  }
  if (batch.format === 'lines' && parameterType !== 'textFile') {
    errors.push(`${field}.format 为 lines 时参数类型必须是 textFile。`);
  }
  if (batch.format === 'json-array' && parameterType !== 'jsonFile') {
    errors.push(`${field}.format 为 json-array 时参数类型必须是 jsonFile。`);
  }
  if (
    typeof batch.itemType !== 'undefined' &&
    (typeof batch.itemType !== 'string' || !CLI_COMMAND_BATCH_ITEM_TYPES.has(batch.itemType))
  ) {
    errors.push(`${field}.itemType 必须是 value / path 之一。`);
  }
  if (typeof batch.itemPath !== 'undefined') {
    if (batch.itemType !== 'path') {
      errors.push(`${field}.itemPath 只能在 itemType: path 时声明。`);
    }
    appendCliPathRuleManifestErrors(batch.itemPath, errors, `${field}.itemPath`);
  }
};

const appendCliParameterManifestErrors = (parameter, errors, field) => {
  if (!isPlainObject(parameter)) {
    errors.push(`${field} 必须是对象。`);
    return;
  }
  if (typeof parameter.name !== 'string' || !CLI_COMMAND_PARAM_NAME_PATTERN.test(parameter.name)) {
    errors.push(`${field}.name 必须是合法的非空参数名。`);
  }
  const parameterType = parameter.type;
  if (typeof parameterType !== 'string' || !CLI_COMMAND_PARAMETER_TYPES.has(parameterType)) {
    errors.push(`${field}.type 必须是受支持的 CLI 参数类型。`);
  }
  if (typeof parameter.short !== 'undefined') {
    if (typeof parameter.short !== 'string' || !/^[A-Za-z0-9]$/.test(parameter.short)) {
      errors.push(`${field}.short 必须是单个字母或数字。`);
    }
  }
  if (typeof parameter.position !== 'undefined') {
    if (typeof parameter.position !== 'number' || !Number.isInteger(parameter.position) || parameter.position < 0) {
      errors.push(`${field}.position 必须是非负整数。`);
    }
  }
  if (typeof parameter.required !== 'undefined' && typeof parameter.required !== 'boolean') {
    errors.push(`${field}.required 必须是布尔值。`);
  }
  if (typeof parameter.mapsTo !== 'undefined') {
    if (typeof parameter.mapsTo !== 'string' || !CLI_COMMAND_MAPS_TO_PATTERN.test(parameter.mapsTo)) {
      errors.push(`${field}.mapsTo 必须是点分隔 payload 路径。`);
    }
  }
  if (typeof parameter.choices !== 'undefined' && !Array.isArray(parameter.choices)) {
    errors.push(`${field}.choices 必须是数组。`);
  }
  if (typeof parameter.multiple !== 'undefined' && typeof parameter.multiple !== 'boolean') {
    errors.push(`${field}.multiple 必须是布尔值。`);
  }
  if (typeof parameter.path !== 'undefined') {
    appendCliPathRuleManifestErrors(parameter.path, errors, `${field}.path`);
    if (isPlainObject(parameter.path) && parameter.path.role === 'output' && parameterType !== 'path') {
      errors.push(`${field}.path.role 为 output 时参数类型必须是 path。`);
    }
  }
  appendCliBatchRuleManifestErrors(parameter.batch, errors, `${field}.batch`, parameterType);
};

const appendCliParameterListManifestErrors = (parameters, errors, field, positional) => {
  if (typeof parameters === 'undefined') {
    return [];
  }
  if (!Array.isArray(parameters)) {
    errors.push(`${field} 必须是数组。`);
    return [];
  }

  const names = new Set();
  const shorts = new Set();
  const positions = new Set();
  parameters.forEach((parameter, parameterIndex) => {
    const parameterField = `${field}[${parameterIndex}]`;
    appendCliParameterManifestErrors(parameter, errors, parameterField);
    if (!isPlainObject(parameter)) {
      return;
    }
    if (typeof parameter.name === 'string') {
      if (names.has(parameter.name)) {
        errors.push(`${parameterField}.name 与同一 CLI 命令中的其他参数重复。`);
      }
      names.add(parameter.name);
    }
    if (typeof parameter.short === 'string') {
      if (shorts.has(parameter.short)) {
        errors.push(`${parameterField}.short 与同一 CLI 命令中的其他短选项重复。`);
      }
      shorts.add(parameter.short);
    }
    if (positional) {
      const position = typeof parameter.position === 'undefined' ? parameterIndex : parameter.position;
      if (typeof position === 'number' && Number.isInteger(position) && position >= 0) {
        if (positions.has(position)) {
          errors.push(`${parameterField}.position 与同一 CLI 命令中的其他位置参数重复。`);
        }
        positions.add(position);
      }
    } else if (typeof parameter.position !== 'undefined') {
      errors.push(`${parameterField}.position 只允许位置参数声明，options 不得声明。`);
    }
  });
  return parameters.filter(isPlainObject);
};

const appendCliCommandOutputManifestErrors = (output, errors, field) => {
  if (typeof output === 'undefined') {
    return;
  }
  if (!isPlainObject(output)) {
    errors.push(`${field} 提供时必须是对象。`);
    return;
  }
  if (
    typeof output.mode !== 'undefined' &&
    (typeof output.mode !== 'string' || !CLI_COMMAND_OUTPUT_MODES.has(output.mode))
  ) {
    errors.push(`${field}.mode 必须是 human / json 之一。`);
  }
  if (
    typeof output.json !== 'undefined' &&
    (typeof output.json !== 'string' || !CLI_COMMAND_JSON_OUTPUT_POLICIES.has(output.json))
  ) {
    errors.push(`${field}.json 必须是 supported / required / unsupported 之一。`);
  }
  if (typeof output.artifacts !== 'undefined') {
    if (
      !Array.isArray(output.artifacts) ||
      output.artifacts.length === 0 ||
      output.artifacts.some((item) => typeof item !== 'string' || item.trim().length === 0)
    ) {
      errors.push(`${field}.artifacts 必须是非空字符串数组。`);
    }
  }
};

const appendCliCommandJobManifestErrors = (job, errors, field) => {
  if (typeof job === 'undefined') {
    return;
  }
  if (!isPlainObject(job)) {
    errors.push(`${field} 提供时必须是对象。`);
    return;
  }
  for (const key of ['wait', 'cancelOnInterrupt']) {
    if (typeof job[key] !== 'undefined' && typeof job[key] !== 'boolean') {
      errors.push(`${field}.${key} 必须是布尔值。`);
    }
  }
};

const appendCliCommandConflictManifestErrors = (conflict, errors, field) => {
  if (typeof conflict === 'undefined') {
    return;
  }
  if (!isPlainObject(conflict)) {
    errors.push(`${field} 提供时必须是对象。`);
    return;
  }
  if (
    typeof conflict.priority !== 'undefined' &&
    (typeof conflict.priority !== 'number' || !Number.isFinite(conflict.priority))
  ) {
    errors.push(`${field}.priority 必须是有限数字。`);
  }
  if (typeof conflict.namespace !== 'undefined') {
    if (typeof conflict.namespace !== 'string' || conflict.namespace.trim().length === 0) {
      errors.push(`${field}.namespace 必须是非空字符串。`);
    }
  }
};

const collectManifestAssetPaths = (manifest) => {
  const assets = [];
  const appendAsset = (value) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      assets.push(value.trim());
    }
  };

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
  for (const field of ['contract', 'minFunctionalSet']) {
    const value = layout?.[field];
    appendAsset(value);
  }

  appendAsset(manifest?.preview);

  const launcher = isPlainObject(manifest?.ui) && isPlainObject(manifest.ui.launcher)
    ? manifest.ui.launcher
    : undefined;
  appendAsset(launcher?.icon);

  if (Array.isArray(manifest?.screenshots)) {
    for (const screenshot of manifest.screenshots) {
      if (isPlainObject(screenshot)) {
        appendAsset(screenshot.path);
      }
    }
  }

  if (isPlainObject(manifest?.module) && Array.isArray(manifest.module.provides)) {
    for (const provider of manifest.module.provides) {
      if (!isPlainObject(provider) || !Array.isArray(provider.methods)) {
        continue;
      }
      for (const method of provider.methods) {
        if (!isPlainObject(method)) {
          continue;
        }
        appendAsset(method.inputSchema);
        appendAsset(method.outputSchema);
      }
    }
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

  assertManifestShapeForPackage(manifest);

  const outDir = path.join(projectRoot, config.outDir);
  const hasOutDir = fs.existsSync(outDir) && fs.statSync(outDir).isDirectory();
  if (!hasOutDir) {
    throw new Error(
      `未找到构建输出目录：${outDir}。请先运行 chipsdev-r build 再执行 chipsdev-r package。`
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

const appendTypeExclusiveManifestErrors = (manifest, errors) => {
  const type = typeof manifest.type === 'string' ? manifest.type : undefined;
  const assertOwnedField = (field, ownerType) => {
    if (typeof manifest[field] !== 'undefined' && type !== ownerType) {
      errors.push(`manifest.${field} 只允许 ${ownerType} 插件声明，当前插件类型为 ${type ?? '(missing type)'}。`);
    }
  };

  assertOwnedField('module', 'module');
  assertOwnedField('layout', 'layout');
  assertOwnedField('theme', 'theme');
  assertOwnedField('themeId', 'theme');
  assertOwnedField('isDefault', 'theme');
  assertOwnedField('parentTheme', 'theme');
  assertOwnedField('displayName', 'theme');

  if ((type === 'app' || type === 'module') && typeof manifest.plugin !== 'undefined') {
    errors.push('manifest.plugin 是 Host 插件治理保留字段，app/module 插件不得声明。');
  }

  const ui = isPlainObject(manifest.ui) ? manifest.ui : undefined;
  if (type !== 'app' && ui) {
    for (const field of ['surface', 'launcher', 'window']) {
      if (typeof ui[field] !== 'undefined') {
        errors.push(`manifest.ui.${field} 只允许 app 插件声明，当前插件类型为 ${type ?? '(missing type)'}。`);
      }
    }
  }
};

const appendCliCommandManifestErrors = (manifest, errors) => {
  if (typeof manifest.cli === 'undefined') {
    return;
  }
  if (!isPlainObject(manifest.cli)) {
    errors.push('manifest.cli 提供时必须是对象。');
    return;
  }
  if (manifest.type !== 'app' && manifest.type !== 'module') {
    errors.push('只有 app/module 插件允许声明 manifest.cli.commands。');
    return;
  }
  if (!Array.isArray(manifest.cli.commands)) {
    errors.push('manifest.cli.commands 必须是数组。');
    return;
  }

  for (const [index, command] of manifest.cli.commands.entries()) {
    if (!isPlainObject(command)) {
      errors.push(`manifest.cli.commands[${index}] 必须是对象。`);
      continue;
    }
    const field = `manifest.cli.commands[${index}]`;
    const commandPath = parseCliCommandPathSegments(command.commandPath);
    if (!commandPath || commandPath.length === 0 || commandPath.some((segment) => segment.length === 0)) {
      errors.push(`manifest.cli.commands[${index}].commandPath 必须是非空命令路径。`);
      continue;
    }
    if (commandPath.some((segment) => !CLI_COMMAND_PATH_SEGMENT_PATTERN.test(segment))) {
      errors.push(`${field}.commandPath 只能包含字母、数字和连字符，且每段必须以字母或数字开头。`);
    }
    const root = commandPath[0].toLowerCase();
    if (HOST_FIXED_COMMANDS.has(root)) {
      errors.push(
        `manifest.cli.commands[${index}].commandPath 不得以 Host 固定命令 "${root}" 开头。`
      );
    }

    if (typeof command.commandId !== 'undefined' && (typeof command.commandId !== 'string' || command.commandId.trim().length === 0)) {
      errors.push(`${field}.commandId 提供时必须是非空字符串。`);
    }
    if (typeof command.titleKey !== 'string' || command.titleKey.trim().length === 0) {
      errors.push(`${field}.titleKey 必须是非空多语言 key。`);
    }
    if (typeof command.descriptionKey !== 'undefined' && (typeof command.descriptionKey !== 'string' || command.descriptionKey.trim().length === 0)) {
      errors.push(`${field}.descriptionKey 提供时必须是非空字符串。`);
    }
    if (typeof command.examples !== 'undefined') {
      if (
        !Array.isArray(command.examples) ||
        command.examples.some((item) => typeof item !== 'string' || item.trim().length === 0)
      ) {
        errors.push(`${field}.examples 必须是非空字符串数组。`);
      }
    }

    if (!isPlainObject(command.target)) {
      errors.push(`${field}.target 必须是对象。`);
    } else {
      const targetType = command.target.type;
      if (targetType !== 'app' && targetType !== 'module') {
        errors.push(`${field}.target.type 必须是 app 或 module。`);
      } else if (targetType !== manifest.type) {
        errors.push(`${field}.target.type 必须与插件类型 ${manifest.type} 一致。`);
      }
      if (targetType === 'module') {
        if (typeof command.target.capability !== 'string' || command.target.capability.trim().length === 0) {
          errors.push(`${field}.target.capability 必须是非空字符串。`);
        }
        if (typeof command.target.method !== 'string' || command.target.method.trim().length === 0) {
          errors.push(`${field}.target.method 必须是非空字符串。`);
        }
        if (typeof command.target.pluginId !== 'undefined' && command.target.pluginId !== manifest.id) {
          errors.push(`${field}.target.pluginId 必须与 manifest.id 一致。`);
        }
        if (
          typeof command.target.timeoutMs !== 'undefined' &&
          (typeof command.target.timeoutMs !== 'number' || !Number.isFinite(command.target.timeoutMs) || command.target.timeoutMs <= 0)
        ) {
          errors.push(`${field}.target.timeoutMs 必须是正数。`);
        }
      }
      if (targetType === 'app') {
        const targetPluginId = command.target.pluginId ?? manifest.id;
        if (targetPluginId !== manifest.id) {
          errors.push(`${field}.target.pluginId 必须与 manifest.id 一致。`);
        }
        if (typeof command.target.commandId !== 'undefined' && (typeof command.target.commandId !== 'string' || command.target.commandId.trim().length === 0)) {
          errors.push(`${field}.target.commandId 提供时必须是非空字符串。`);
        }
        if (typeof command.target.launchParams !== 'undefined' && !isPlainObject(command.target.launchParams)) {
          errors.push(`${field}.target.launchParams 提供时必须是对象。`);
        }
        if (typeof command.target.surface !== 'undefined') {
          if (!isPlainObject(command.target.surface)) {
            errors.push(`${field}.target.surface 提供时必须是对象。`);
          } else {
            if (typeof command.target.surface.open !== 'undefined' && typeof command.target.surface.open !== 'boolean') {
              errors.push(`${field}.target.surface.open 必须是布尔值。`);
            }
            if (typeof command.target.surface.focus !== 'undefined' && typeof command.target.surface.focus !== 'boolean') {
              errors.push(`${field}.target.surface.focus 必须是布尔值。`);
            }
            if (
              typeof command.target.surface.reuse !== 'undefined' &&
              (typeof command.target.surface.reuse !== 'string' || !CLI_COMMAND_SURFACE_REUSE_POLICIES.has(command.target.surface.reuse))
            ) {
              errors.push(`${field}.target.surface.reuse 必须是 always / never / preferred 之一。`);
            }
          }
        }
      }
    }

    const argumentParameters = appendCliParameterListManifestErrors(command.arguments, errors, `${field}.arguments`, true);
    const optionParameters = appendCliParameterListManifestErrors(command.options, errors, `${field}.options`, false);
    const allNames = new Set();
    const allShorts = new Set();
    for (const parameter of [...argumentParameters, ...optionParameters]) {
      if (typeof parameter.name === 'string') {
        if (allNames.has(parameter.name)) {
          errors.push(`${field} 中参数 name 必须唯一：${parameter.name}`);
        }
        allNames.add(parameter.name);
      }
      if (typeof parameter.short === 'string') {
        if (allShorts.has(parameter.short)) {
          errors.push(`${field} 中参数 short 必须唯一：${parameter.short}`);
        }
        allShorts.add(parameter.short);
      }
    }

    if (typeof command.permissions !== 'undefined') {
      if (
        !Array.isArray(command.permissions) ||
        command.permissions.some((permission) => typeof permission !== 'string' || permission.trim().length === 0 || !CLI_COMMAND_PERMISSION_PATTERN.test(permission))
      ) {
        errors.push(`${field}.permissions 必须是合法权限名数组。`);
      } else if (Array.isArray(manifest.permissions)) {
        const missingPermissions = command.permissions.filter((permission) => !manifest.permissions.includes(permission));
        if (missingPermissions.length > 0) {
          errors.push(`${field}.permissions 必须先在 manifest.permissions 声明：${missingPermissions.join(', ')}`);
        }
      }
    }
    appendCliCommandOutputManifestErrors(command.output, errors, `${field}.output`);
    appendCliCommandJobManifestErrors(command.job, errors, `${field}.job`);
    appendCliCommandConflictManifestErrors(command.conflict, errors, `${field}.conflict`);
  }
};

const assertManifestShapeForPackage = (manifest) => {
  const errors = validateManifestShape(manifest);
  if (errors.length > 0) {
    throw new Error(`manifest.yaml 校验失败，无法打包：\n- ${errors.join('\n- ')}`);
  }
};

const validateManifestShape = (manifest) => {
  const runtimeTargetIds = ['desktop', 'web', 'mobile', 'headless'];
  const surfaceKinds = ['window', 'tab', 'route', 'modal', 'sheet', 'fullscreen'];
  const capabilityFallbackBehaviors = ['reject', 'download', 'share', 'openExternal'];
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

  if (!Array.isArray(manifest.permissions)) {
    errors.push('manifest.permissions 必须存在且为数组。');
  }

  appendTypeExclusiveManifestErrors(manifest, errors);
  appendCliCommandManifestErrors(manifest, errors);

  if (!isPlainObject(manifest.runtime)) {
    errors.push('manifest.runtime 必须存在且为对象。');
  } else if (!isPlainObject(manifest.runtime.targets)) {
    errors.push('manifest.runtime.targets 必须存在且为对象。');
  } else {
    for (const targetId of runtimeTargetIds) {
      const targetConfig = manifest.runtime.targets[targetId];
      if (!isPlainObject(targetConfig) || typeof targetConfig.supported !== 'boolean') {
        errors.push(`manifest.runtime.targets.${targetId}.supported 必须是布尔值。`);
      }
    }
    for (const targetId of Object.keys(manifest.runtime.targets)) {
      if (!runtimeTargetIds.includes(targetId)) {
        errors.push(`manifest.runtime.targets.${targetId} 不是受支持的目标平台标识。`);
      }
    }
  }

  if (typeof manifest.capabilityFallbacks !== 'undefined') {
    if (!isPlainObject(manifest.capabilityFallbacks)) {
      errors.push('manifest.capabilityFallbacks 提供时必须是对象。');
    } else {
      for (const [capabilityName, fallback] of Object.entries(manifest.capabilityFallbacks)) {
        if (capabilityName.trim().length === 0) {
          errors.push('manifest.capabilityFallbacks 不能包含空 capability 名称。');
          continue;
        }
        if (!isPlainObject(fallback)) {
          errors.push(`manifest.capabilityFallbacks.${capabilityName} 必须是对象。`);
          continue;
        }
        if (
          typeof fallback.whenUnsupported !== 'string' ||
          !capabilityFallbackBehaviors.includes(fallback.whenUnsupported)
        ) {
          errors.push(
            `manifest.capabilityFallbacks.${capabilityName}.whenUnsupported 必须是 ${capabilityFallbackBehaviors.join(' / ')} 之一。`
          );
        }
      }
    }
  }

  if (manifest.type === 'app') {
    if (!isPlainObject(manifest.ui)) {
      errors.push('app 插件必须声明 manifest.ui 对象。');
    } else if (!isPlainObject(manifest.ui.surface)) {
      errors.push('app 插件必须声明 manifest.ui.surface 对象。');
    } else {
      if (
        typeof manifest.ui.surface.defaultKind !== 'string' ||
        !surfaceKinds.includes(manifest.ui.surface.defaultKind)
      ) {
        errors.push(`manifest.ui.surface.defaultKind 必须是 ${surfaceKinds.join(' / ')} 之一。`);
      }
      if (!isPlainObject(manifest.ui.surface.preferredKinds)) {
        errors.push('manifest.ui.surface.preferredKinds 必须是对象。');
      } else {
        for (const targetId of runtimeTargetIds) {
          const preferredKind = manifest.ui.surface.preferredKinds[targetId];
          if (typeof preferredKind !== 'string' || !surfaceKinds.includes(preferredKind)) {
            errors.push(`manifest.ui.surface.preferredKinds.${targetId} 必须是有效 surface kind。`);
          }
        }
        for (const targetId of Object.keys(manifest.ui.surface.preferredKinds)) {
          if (!runtimeTargetIds.includes(targetId)) {
            errors.push(`manifest.ui.surface.preferredKinds.${targetId} 不是受支持的目标平台标识。`);
          }
        }
      }
    }
  } else if (isPlainObject(manifest.ui) && typeof manifest.ui.surface !== 'undefined') {
    errors.push('只有 app 插件允许声明 manifest.ui.surface。');
  }

  if (manifest.type === 'module') {
    if (!isPlainObject(manifest.module)) {
      errors.push('module 插件必须声明 manifest.module 对象。');
      return errors;
    }

    if (!Number.isInteger(manifest.module.apiVersion) || manifest.module.apiVersion <= 0) {
      errors.push('manifest.module.apiVersion 必须是正整数。');
    }
    if (manifest.module.runtime !== 'worker') {
      errors.push('manifest.module.runtime 目前只能是 worker。');
    }
    if (manifest.module.activation !== 'onDemand' && manifest.module.activation !== 'eager') {
      errors.push('manifest.module.activation 必须是 onDemand 或 eager。');
    }
    if (!Array.isArray(manifest.module.provides) || manifest.module.provides.length === 0) {
      errors.push('manifest.module.provides 必须是非空数组。');
    } else {
      for (const [providerIndex, provider] of manifest.module.provides.entries()) {
        if (!isPlainObject(provider)) {
          errors.push(`manifest.module.provides[${providerIndex}] 必须是对象。`);
          continue;
        }
        if (typeof provider.capability !== 'string' || provider.capability.trim().length === 0) {
          errors.push(`manifest.module.provides[${providerIndex}].capability 必须是非空字符串。`);
        }
        if (typeof provider.version !== 'string' || provider.version.trim().length === 0) {
          errors.push(`manifest.module.provides[${providerIndex}].version 必须是非空字符串。`);
        }
        if (!Array.isArray(provider.methods) || provider.methods.length === 0) {
          errors.push(`manifest.module.provides[${providerIndex}].methods 必须是非空数组。`);
          continue;
        }
        for (const [methodIndex, method] of provider.methods.entries()) {
          if (!isPlainObject(method)) {
            errors.push(`manifest.module.provides[${providerIndex}].methods[${methodIndex}] 必须是对象。`);
            continue;
          }
          if (typeof method.name !== 'string' || method.name.trim().length === 0) {
            errors.push(`manifest.module.provides[${providerIndex}].methods[${methodIndex}].name 必须是非空字符串。`);
          }
          if (method.mode !== 'sync' && method.mode !== 'job') {
            errors.push(`manifest.module.provides[${providerIndex}].methods[${methodIndex}].mode 必须是 sync 或 job。`);
          }
          if (typeof method.inputSchema !== 'string' || method.inputSchema.trim().length === 0) {
            errors.push(
              `manifest.module.provides[${providerIndex}].methods[${methodIndex}].inputSchema 必须是非空字符串。`
            );
          }
          if (typeof method.outputSchema !== 'string' || method.outputSchema.trim().length === 0) {
            errors.push(
              `manifest.module.provides[${providerIndex}].methods[${methodIndex}].outputSchema 必须是非空字符串。`
            );
          }
        }
      }
    }

    if (typeof manifest.module.consumes !== 'undefined' && !Array.isArray(manifest.module.consumes)) {
      errors.push('manifest.module.consumes 提供时必须是数组。');
    }
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
    errors.push(`构建输出目录不存在：${config.outDir}，请先运行 chipsdev-r build。`);
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
    throw new Error('chipsdev-r validate 发现问题，请根据 errors 列表修复。');
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

const delegateHostManagedCommand = async (command, args) => {
  const projectRoot = resolveProjectRoot();
  const workspacePath = await resolveDevWorkspace(projectRoot);
  const forwardedArgs = command === 'completion' ? [command, ...args, 'chipsdev-r'] : [command, ...args];

  await runHostCliCommand(projectRoot, workspacePath, forwardedArgs, {
    CHIPS_WORKSPACE_KIND: 'dev'
  });
};

const delegateHostInteractiveCommand = async (explicit = false) => {
  const projectRoot = resolveProjectRoot();
  const workspacePath = await resolveDevWorkspace(projectRoot);
  await runHostCliCommand(projectRoot, workspacePath, explicit ? ['--interactive'] : [], {
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

const readOptionValue = (args, index, token) => {
  const equalsIndex = token.indexOf('=');
  if (equalsIndex !== -1) {
    const value = token.slice(equalsIndex + 1);
    if (!value) {
      throw new Error(`${token.slice(0, equalsIndex)} 需要提供参数值。`);
    }
    return { value, nextIndex: index };
  }

  const value = args[index + 1];
  if (!value) {
    throw new Error(`${token} 需要提供参数值。`);
  }
  return { value, nextIndex: index + 1 };
};

const parseModuleConsumeOption = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('--consumes 需要提供 capability 或 capability@versionRange。');
  }

  const separatorIndex = trimmed.indexOf('@');
  if (separatorIndex === -1) {
    return { capability: trimmed };
  }

  const capability = trimmed.slice(0, separatorIndex).trim();
  const versionRange = trimmed.slice(separatorIndex + 1).trim();
  if (!capability || !versionRange) {
    throw new Error('--consumes 格式必须为 capability 或 capability@versionRange。');
  }
  return { capability, versionRange };
};

const parseCreateArgs = (args) => {
  const positionals = [];
  const options = {
    template: undefined,
    pluginId: undefined,
    themeId: undefined,
    displayName: undefined,
    publisher: undefined,
    version: undefined,
    parentThemeId: undefined,
    description: undefined,
    capability: undefined,
    consumes: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const optionName = token.slice(2).split('=')[0];
    if (optionName === 'template') {
      const parsed = readOptionValue(args, index, token);
      options.template = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (optionName === 'plugin-id') {
      const parsed = readOptionValue(args, index, token);
      options.pluginId = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (optionName === 'theme-id') {
      const parsed = readOptionValue(args, index, token);
      options.themeId = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (optionName === 'display-name') {
      const parsed = readOptionValue(args, index, token);
      options.displayName = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (optionName === 'publisher') {
      const parsed = readOptionValue(args, index, token);
      options.publisher = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (optionName === 'version') {
      const parsed = readOptionValue(args, index, token);
      options.version = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (optionName === 'parent-theme-id') {
      const parsed = readOptionValue(args, index, token);
      options.parentThemeId = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (optionName === 'description') {
      const parsed = readOptionValue(args, index, token);
      options.description = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (optionName === 'capability') {
      const parsed = readOptionValue(args, index, token);
      options.capability = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (optionName === 'consumes') {
      const parsed = readOptionValue(args, index, token);
      options.consumes.push(parseModuleConsumeOption(parsed.value));
      index = parsed.nextIndex;
      continue;
    }

    throw new Error(`不支持的 create 参数：${token}`);
  }

  if (positionals.length > 2) {
    throw new Error(`chipsdev-r create 参数过多：${positionals.slice(2).join(' ')}`);
  }

  const [type, targetDir = '.'] = positionals;
  return { type, targetDir, options };
};

const handleCreate = async (args) => {
  const projectRoot = resolveProjectRoot();

  const { type, targetDir, options: createOptions } = parseCreateArgs(args);
  if (!type) {
    throw new Error('chipsdev-r create 需要指定类型，例如：chipsdev-r create app my-app');
  }

  const ecosystemRoot = resolveEcosystemRoot();
  const scaffoldRoot = path.join(ecosystemRoot, 'Chips-Scaffold');

  if (!fs.existsSync(scaffoldRoot) || !fs.statSync(scaffoldRoot).isDirectory()) {
    throw new Error(
      `未找到 Chips-Scaffold 目录：${scaffoldRoot}。请在包含 Chips-Scaffold 的工作区内运行 chipsdev-r。`
    );
  }

  if (type === 'theme') {
    // 主题脚手架：使用 chips-scaffold-theme 提供的 API。
    const packageDir = path.join(scaffoldRoot, 'chips-scaffold-theme');
    const modulePath = path.join(
      packageDir,
      'dist',
      'index.js'
    );
    await ensurePackageBuildArtifact(packageDir, modulePath, '主题脚手架');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const themeScaffold = require(modulePath);
    const projectName = deriveProjectName(targetDir);
    const slug = slugifyForPluginId(projectName);
    const dottedSlug = slug.replace(/-/g, '.');
    const displayName = createOptions.displayName ?? toDisplayName(projectName);
    const options = {
      targetDir: path.resolve(projectRoot, targetDir),
      templateId: createOptions.template ?? 'theme-standard',
      themeId: createOptions.themeId ?? `theme.${dottedSlug}`,
      displayName,
      pluginId: createOptions.pluginId ?? `chips.theme.${dottedSlug}`,
      version: createOptions.version ?? '1.0.0',
      publisher: createOptions.publisher ?? slugifyForPluginId(deriveAuthorName()),
      parentThemeId: createOptions.parentThemeId,
      description: createOptions.description ?? `${displayName} 主题包。`
    };
    await themeScaffold.createThemeProject(options);
    await adaptWorkspaceDependencies(options.targetDir);
    log({
      message: '主题工程创建完成',
      targetDir: options.targetDir,
      templateId: options.templateId,
      pluginId: options.pluginId,
      themeId: options.themeId,
      displayName: options.displayName
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
      templateId: createOptions.template ?? 'module-standard',
      pluginId: createOptions.pluginId ?? `chips.module.${slug.replace(/-/g, '.')}`,
      moduleCapability: createOptions.capability ?? `module.${slug.replace(/-/g, '.')}`,
      moduleConsumes: createOptions.consumes,
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

  if (type === 'layout') {
    const packageDir = path.join(scaffoldRoot, 'chips-scaffold-boxlayout');
    const modulePath = path.join(
      packageDir,
      'dist',
      'src',
      'index.js'
    );
    await ensurePackageBuildArtifact(packageDir, modulePath, '布局插件脚手架');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const boxlayoutScaffold = require(modulePath);
    const projectName = deriveProjectName(targetDir);
    const slug = slugifyForPluginId(projectName);
    const displayName = toDisplayName(projectName);
    const options = {
      projectName,
      targetDir: path.resolve(projectRoot, targetDir),
      templateId: 'boxlayout-standard',
      pluginId: `chips.layout.${slug.replace(/-/g, '.')}`,
      layoutType: `chips.layout.${slug.replace(/-/g, '.')}`,
      displayName,
      description: `${displayName} 布局插件。`,
      version: '0.1.0',
      authorName: deriveAuthorName(),
      authorEmail: deriveAuthorEmail(slug)
    };
    await boxlayoutScaffold.createBoxlayoutProject(options);
    await adaptWorkspaceDependencies(options.targetDir);
    log({
      message: '布局插件工程创建完成',
      targetDir: options.targetDir,
      templateId: options.templateId
    });
    return;
  }

  throw new Error(
    `不支持的 create 类型：${type}。当前支持：app、card、layout、module、theme。`
  );
};

const getChipsdevConfigPath = () => {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) {
    throw new Error('无法确定用户主目录，无法保存 chipsdev-r 配置。');
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
    message: '已在本机记录 chipsdev-r 本地发布身份时间，可供后续正式发布系统读取。',
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
      `未找到构建输出目录：${config.outDir}。请先运行 chipsdev-r build && chipsdev-r package。`
    );
  }

  const cpkDir = path.join(projectRoot, 'dist');
  const cpkFiles = fs.existsSync(cpkDir)
    ? (await fsp.readdir(cpkDir)).filter((name) => name.endsWith('.cpk'))
    : [];

  if (cpkFiles.length === 0) {
    throw new Error(
      `未找到 .cpk 包。请先运行 chipsdev-r package 生成插件包。`
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
      '已生成发布元数据（publish-meta.json），可作为后续正式发布系统的输入。',
    metaPath
  });
};

const handlePreview = async (args) => {
  const projectRoot = resolveProjectRoot();
  const options = parseReportOptions(args, {
    mode: { type: 'string' },
    target: { type: 'string' }
  });
  const allowedModes = new Set(['mock', 'host']);
  const allowedTargets = new Set(['app', 'component', 'card', 'box', 'layout', 'theme']);
  const mode = options.values.mode ?? 'mock';
  const target = options.values.target ?? 'app';

  if (!allowedModes.has(mode)) {
    throw new Error('--mode 只支持 mock 或 host。');
  }
  if (!allowedTargets.has(target)) {
    throw new Error('--target 只支持 app/component/card/box/layout/theme。');
  }

  let projectConfig = null;
  try {
    projectConfig = await loadProjectConfig(projectRoot);
  } catch {
    projectConfig = null;
  }

  const report = createPreviewReport({
    projectRoot,
    ecosystemRoot: resolveEcosystemRoot(),
    mode,
    target,
    projectConfig
  });

  await printReport(report, options, (payload) => [
    `chipsdev-r preview：${payload.summary.status}`,
    `项目：${payload.project.manifest?.id ?? payload.project.config?.type ?? projectRoot}`,
    `模式：${payload.previewPlan.mode}；目标：${payload.previewPlan.target}`,
    '检查：',
    ...renderCheckLines(payload.checks)
  ]);
};

const handleComponentCommand = async (args) => {
  const [subcommand] = args;

  if (!subcommand || subcommand === 'help') {
    log(
      [
        'chipsdev-r component 用法：',
        '  chipsdev-r component gallery [--json] [--out <file>]',
        '',
        '说明：',
        '  - 自研组件库已于 task030 卸担计划废弃（antd v6 + @chips/ui 替代）；',
        '  - 本命令仅保留命令占位，不再生成组件矩阵报告。'
      ].join('\n')
    );
    return;
  }

  log('组件库已废弃（task030 卸担计划），chipsdev-r component 不再可用。替代方案：antd v6 + @chips/ui。');
};

const handleThemeInspect = async (args) => {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === 'help') {
    log(
      [
        'chipsdev-r theme inspect 用法：',
        '  chipsdev-r theme inspect [--theme <themeId|path>] [--json] [--out <file>]',
        '',
        '说明：',
        '  - 读取主题包 manifest、entry、contracts、tokens 与 dist 产物；',
        '  - 只做诊断报告，不修改主题包；',
        '  - 可用 --theme 指定主题 ID、主题目录或 manifest 路径。'
      ].join('\n')
    );
    return;
  }

  if (subcommand !== 'inspect') {
    await delegateHostManagedCommand('theme', args);
    return;
  }

  const options = parseReportOptions(rest, {
    theme: { type: 'string' }
  });
  const report = createThemeInspectReport({
    ecosystemRoot: resolveEcosystemRoot(),
    themeRef: options.values.theme,
    baseDir: resolveProjectRoot()
  });

  await printReport(report, options, (payload) => [
    `chipsdev-r theme inspect：${payload.summary.status}`,
    `主题数量：${payload.summary.themeCount}`,
    `失败主题：${payload.summary.failedThemes.length}`,
    '主题：',
    ...payload.themes.slice(0, 8).map((theme) => {
      const id = theme.manifest?.themeId ?? path.basename(theme.themeDir);
      return `  - ${id}: ${theme.status}，组件 ${theme.contractSummary.componentCount}，token ${theme.tokenSummary.tokenCount}`;
    }),
    ...(payload.themes.length > 8 ? [`  - ... 还有 ${payload.themes.length - 8} 个主题`] : []),
    '检查：',
    ...renderCheckLines(payload.checks)
  ]);
};

const handleQualityCommand = async (args) => {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === 'help') {
    log(
      [
        'chipsdev-r quality 用法：',
        '  chipsdev-r quality gate [--json] [--out <file>]',
        '',
        '说明：',
        '  - 汇总当前项目、SDK route manifest、组件库 quality/perf 最新报告和主题检查摘要；',
        '  - 本命令读取既有报告，不替代项目正式 npm test / npm run quality:gate。'
      ].join('\n')
    );
    return;
  }

  if (subcommand !== 'gate') {
    throw new Error(`不支持的 quality 子命令：${subcommand}`);
  }

  const options = parseReportOptions(rest);
  const report = createQualityGateReport({
    projectRoot: resolveProjectRoot(),
    ecosystemRoot: resolveEcosystemRoot()
  });

  await printReport(report, options, (payload) => [
    `chipsdev-r quality gate：${payload.summary.status}`,
    `失败检查：${payload.summary.failedCheckCount}`,
    `警告检查：${payload.summary.warningCheckCount}`,
    `组件库质量：${payload.reports.componentLibraryQuality?.status ?? 'missing'}`,
    `主题检查：${payload.reports.themes.status}`,
    '检查：',
    ...renderCheckLines(payload.checks)
  ]);
};

const handleAssimilateCommand = async (args) => {
  const [subcommand, targetPath, ...rest] = args;

  if (!subcommand || subcommand === 'help') {
    log(
      [
        'chipsdev-r assimilate 用法：',
        '  chipsdev-r assimilate scan <path> [--json] [--out <file>]',
        '  chipsdev-r assimilate report <path> [--json] [--out <file>]',
        '',
        '说明：',
        '  - 扫描 React/Vite/静态 Web/Electron 混合项目的 Host 能力、样式、文案和组件替换风险；',
        '  - report 在 scan 基础上附加迁移计划；',
        '  - 不自动改写外部项目源码。'
      ].join('\n')
    );
    return;
  }

  if (subcommand !== 'scan' && subcommand !== 'report') {
    throw new Error(`不支持的 assimilate 子命令：${subcommand}`);
  }
  if (!targetPath) {
    throw new Error(`chipsdev-r assimilate ${subcommand} 需要提供项目路径。`);
  }

  const targetRoot = path.resolve(resolveProjectRoot(), targetPath);
  if (!fs.existsSync(targetRoot) || !fs.statSync(targetRoot).isDirectory()) {
    throw new Error(`同化目标路径不存在或不是目录：${targetRoot}`);
  }

  const options = parseReportOptions(rest);
  const report = createAssimilationScanReport({
    targetRoot,
    reportLevel: subcommand
  });

  await printReport(report, options, (payload) => [
    `chipsdev-r assimilate ${subcommand}：${payload.summary.status}`,
    `同化评分：${payload.summary.score}`,
    `框架识别：${payload.project.frameworks.length > 0 ? payload.project.frameworks.join(', ') : 'unknown'}`,
    `扫描文件：${payload.project.scannedFileCount}`,
    `必须修复：${payload.summary.requiredFixCount}`,
    `建议修复：${payload.summary.recommendedFixCount}`,
    `组件替换建议：${payload.summary.componentSuggestionCount}`,
    `Manifest 建议 ID：${payload.manifestSuggestion.id}`,
    '重点问题：',
    ...payload.summary.requiredFixes.slice(0, 8).map((item) => `  - ${item.title}: ${item.count}`)
  ]);
};

const handleDiagnostics = async (args) => {
  const options = parseReportOptions(args);
  const report = createDiagnosticsReport({
    projectRoot: resolveProjectRoot(),
    ecosystemRoot: resolveEcosystemRoot()
  });

  await printReport(report, options, (payload) => [
    `chipsdev-r diagnostics：${payload.summary.status}`,
    `Route 数量：${payload.routes.routeCount}`,
    `权限数量：${payload.routes.permissions.length}`,
    `组件矩阵：${payload.summaries.componentGallery.status}`,
    `主题检查：${payload.summaries.themeInspect.status}`,
    `质量门禁：${payload.summaries.qualityGate.status}`,
    '检查：',
    ...renderCheckLines(payload.checks)
  ]);
};

const main = async () => {
  const { command, args } = parseArgs(process.argv.slice(2));

  if (command === '') {
    try {
      await delegateHostInteractiveCommand(false);
      process.exitCode = 0;
    } catch (error) {
      const payload = toErrorPayload(error);
      if (payload) {
        logError(payload);
      }
      process.exitCode = 1;
    }
    return;
  }

  if (!COMMANDS.has(command)) {
    try {
      await delegateHostManagedCommand(command, args);
      process.exitCode = 0;
    } catch (error) {
      const payload = toErrorPayload(error);
      if (payload) {
        logError(payload);
      }
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'help') {
    printHelp();
    process.exitCode = 0;
    return;
  }

  if (command === 'version') {
    const version = await loadPackageJsonVersion();
    log({ name: 'chipsdev-r', version });
    process.exitCode = 0;
    return;
  }

  try {
    if (command === '--interactive') {
      await delegateHostInteractiveCommand(true);
    } else if (command === 'theme' && args[0] === 'inspect') {
      await handleThemeInspect(args);
    } else if (HOST_MANAGED_COMMANDS.has(command)) {
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
    } else if (command === 'module') {
      await handleModuleCommand(args);
    } else if (command === 'preview') {
      await handlePreview(args);
    } else if (command === 'component') {
      await handleComponentCommand(args);
    } else if (command === 'quality') {
      await handleQualityCommand(args);
    } else if (command === 'assimilate') {
      await handleAssimilateCommand(args);
    } else if (command === 'diagnostics') {
      await handleDiagnostics(args);
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
        hint: '使用 `chipsdev-r help` 查看可用命令'
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
      `chipsdev-r run 当前仅支持应用插件 (manifest.type === "app")，当前类型为：${manifest.type}`
    );
  }

  // 先执行构建，确保应用构建产物与相对资源路径就绪。
  await handleBuild();

  const workspacePath = await resolveDevWorkspace(projectRoot);
  const { ecosystemRoot, hostPackageDir } = await resolveHostCliPath(projectRoot);
  const hostRunnerPath = path.join(hostPackageDir, 'dist', 'src', 'main', 'electron', 'dev-run-app.js');

  await ensurePackageBuildArtifact(hostPackageDir, hostRunnerPath, 'Chips-Host');

  const electronExecutable = resolveElectronExecutable([hostPackageDir, ecosystemRoot]);

  await runForegroundProcess(electronExecutable, [hostRunnerPath, `--workspace=${workspacePath}`, `--manifest=${manifestPath}`], {
    cwd: projectRoot,
    env: makeBinEnv(projectRoot)
  });
};

const parseModuleInvokeArgs = (args) => {
  const options = {
    manifestPath: undefined,
    capability: undefined,
    method: undefined,
    input: {},
    timeoutMs: 60_000
  };

  const readRequiredValue = (index, optionName) => {
    const value = args[index + 1];
    if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
      throw new Error(`${optionName} 需要提供参数值。`);
    }
    return value;
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const [optionName, inlineValue] = typeof token === 'string' && token.startsWith('--') && token.includes('=')
      ? token.split(/=(.*)/s, 2)
      : [token, undefined];
    const readValue = () => inlineValue ?? readRequiredValue(index, optionName);
    const consumedInlineValue = typeof inlineValue === 'string';

    if (optionName === '--manifest') {
      options.manifestPath = readValue();
      if (!consumedInlineValue) {
        index += 1;
      }
      continue;
    }
    if (optionName === '--capability') {
      options.capability = readValue();
      if (!consumedInlineValue) {
        index += 1;
      }
      continue;
    }
    if (optionName === '--method') {
      options.method = readValue();
      if (!consumedInlineValue) {
        index += 1;
      }
      continue;
    }
    if (optionName === '--input') {
      const value = readValue();
      options.input = JSON.parse(value);
      if (!consumedInlineValue) {
        index += 1;
      }
      continue;
    }
    if (optionName === '--input-file') {
      const value = readValue();
      options.input = JSON.parse(fs.readFileSync(path.resolve(value), 'utf-8'));
      if (!consumedInlineValue) {
        index += 1;
      }
      continue;
    }
    if (optionName === '--timeout-ms') {
      const value = readValue();
      const timeoutMs = Number(value);
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error('--timeout-ms 必须是正整数。');
      }
      options.timeoutMs = timeoutMs;
      if (!consumedInlineValue) {
        index += 1;
      }
      continue;
    }

    throw new Error(`chipsdev-r module invoke 不支持参数：${token}`);
  }

  if (typeof options.capability !== 'string' || options.capability.trim().length === 0) {
    throw new Error('chipsdev-r module invoke 需要 --capability。');
  }
  if (typeof options.method !== 'string' || options.method.trim().length === 0) {
    throw new Error('chipsdev-r module invoke 需要 --method。');
  }

  return {
    manifestPath: typeof options.manifestPath === 'string' && options.manifestPath.trim().length > 0
      ? path.resolve(options.manifestPath)
      : undefined,
    capability: options.capability.trim(),
    method: options.method.trim(),
    input: options.input,
    timeoutMs: options.timeoutMs
  };
};

const resolveModuleManifestForInvoke = async (projectRoot, explicitManifestPath) => {
  if (explicitManifestPath) {
    const manifestRoot = path.dirname(explicitManifestPath);
    const { manifest, manifestPath } = await loadManifest(manifestRoot);
    if (path.resolve(manifestPath) !== path.resolve(explicitManifestPath)) {
      throw new Error(`manifest 文件必须位于插件工程根目录：${explicitManifestPath}`);
    }
    if (manifest.type !== 'module') {
      throw new Error(`目标 manifest 不是 module 插件：${explicitManifestPath}`);
    }
    const config = await loadProjectConfig(manifestRoot);
    await buildProject(manifestRoot, config);
    return manifestPath;
  }

  try {
    const { manifest, manifestPath } = await loadManifest(projectRoot);
    if (manifest.type !== 'module') {
      return undefined;
    }
    const config = await loadProjectConfig(projectRoot);
    await buildProject(projectRoot, config);
    return manifestPath;
  } catch {
    return undefined;
  }
};

const handleModuleInvoke = async (args) => {
  const projectRoot = resolveProjectRoot();
  const options = parseModuleInvokeArgs(args);
  const workspacePath = await resolveDevWorkspace(projectRoot);

  const manifestPath = await resolveModuleManifestForInvoke(projectRoot, options.manifestPath);
  const { ecosystemRoot, hostPackageDir } = await resolveHostCliPath(projectRoot);
  const hostRunnerPath = path.join(hostPackageDir, 'dist', 'src', 'main', 'electron', 'dev-invoke-module.js');

  await ensurePackageBuildArtifact(hostPackageDir, hostRunnerPath, 'Chips-Host');

  const electronExecutable = resolveElectronExecutable([hostPackageDir, ecosystemRoot]);
  const runnerArgs = [
    hostRunnerPath,
    `--workspace=${workspacePath}`,
    `--capability=${options.capability}`,
    `--method=${options.method}`,
    `--input-base64=${Buffer.from(JSON.stringify(options.input), 'utf-8').toString('base64url')}`,
    `--timeout-ms=${options.timeoutMs}`
  ];

  if (manifestPath) {
    runnerArgs.push(`--manifest=${manifestPath}`);
  }

  await runForegroundProcess(electronExecutable, runnerArgs, {
    cwd: projectRoot,
    env: makeBinEnv(projectRoot)
  });
};

const handleModuleCommand = async (args) => {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === 'help') {
    log(
      [
        'chipsdev-r module 用法：',
        '  chipsdev-r module invoke --capability <capability> --method <method> [--input <json>] [--input-file <path>] [--manifest <manifest.yaml>] [--timeout-ms <ms>]',
        '',
        '说明：',
        '  - 在真实 Electron Host 中执行模块 capability/method 调用；',
        '  - 若当前目录或 --manifest 指向 module 插件工程，会先构建并安装启用该模块；',
        '  - 异步 job 会等待到最终 completed/failed/cancelled 状态后再退出。'
      ].join('\n')
    );
    return;
  }

  if (subcommand === 'invoke') {
    await handleModuleInvoke(rest);
    return;
  }

  throw new Error(`不支持的 module 子命令：${subcommand}`);
};

main().catch((error) => {
  logError(toErrorPayload(error));
  process.exitCode = 1;
});
