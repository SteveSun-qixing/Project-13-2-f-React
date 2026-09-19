import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 应用启动到窗口可交互的默认超时。 */
export const DEFAULT_LAUNCH_TIMEOUT_MS = 30_000;

/** 渲染帧出现与内容可断言的默认超时。 */
export const DEFAULT_RENDER_TIMEOUT_MS = 15_000;

/** Bridge 就绪探测的默认超时。 */
export const DEFAULT_BRIDGE_TIMEOUT_MS = 20_000;

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** 解析 `chips-ecosystem/` 工作区根目录。 */
export function resolveEcosystemRoot(): string {
  return path.resolve(MODULE_DIR, '..', '..', '..');
}

/** 解析 `tests/e2e/` 目录。 */
export function resolveE2eRoot(): string {
  return path.resolve(MODULE_DIR, '..');
}

/** 解析 E2E 夹具根目录（`tests/e2e/fixtures/`）。 */
export function resolveFixturesRoot(): string {
  return path.join(resolveE2eRoot(), 'fixtures');
}

/** 解析夹具 Electron 应用目录（启动器与断言工具的受控自检对象）。 */
export function resolveHarnessAppPath(): string {
  return path.join(resolveFixturesRoot(), 'app');
}

export interface HostAppResolution {
  /** 应用包目录；作为 Electron 的 `cwd`。 */
  readonly appPath: string;
  /** 解析后的应用入口脚本；作为 Electron 的首个参数。 */
  readonly appEntry: string;
}

export interface ResolveHostAppOptions {
  readonly hostAppPath?: string;
}

/**
 * 解析被测宿主应用。
 *
 * 解析顺序：显式参数 → `CHIPS_E2E_HOST_APP` → `packages/host`。
 * 入口取应用 `package.json` 的 `main`（可用 `CHIPS_E2E_APP_ENTRY` 覆盖）。
 */
export function resolveHostApp(options: ResolveHostAppOptions = {}): HostAppResolution {
  const appPath = path.resolve(
    options.hostAppPath ??
      process.env.CHIPS_E2E_HOST_APP ??
      path.join(resolveEcosystemRoot(), 'packages', 'host')
  );
  if (!existsSync(appPath)) {
    throw new Error(
      `宿主应用目录不存在：${appPath}。请先执行 pnpm build 构建 @chips/host，或通过 CHIPS_E2E_HOST_APP 指定应用目录。`
    );
  }

  const manifestPath = path.join(appPath, 'package.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`宿主应用目录缺少 package.json：${appPath}。`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { main?: unknown };
  const declaredEntry =
    typeof manifest.main === 'string' && manifest.main.length > 0
      ? path.resolve(appPath, manifest.main)
      : null;
  const appEntry = path.resolve(
    process.env.CHIPS_E2E_APP_ENTRY ?? declaredEntry ?? path.join(appPath, 'dist', 'index.js')
  );
  if (!existsSync(appEntry)) {
    throw new Error(
      `宿主应用入口不存在：${appEntry}。请先执行 pnpm --filter @chips/host build（或 pnpm build），确保构建产物为当前提交。`
    );
  }

  return { appPath, appEntry };
}

/** 检测宿主应用构建产物是否就绪；不抛错，供 Playwright 配置与用例前置判断使用。 */
export function isHostAppBuilt(options: ResolveHostAppOptions = {}): boolean {
  try {
    resolveHostApp(options);
    return true;
  } catch {
    return false;
  }
}

/** 解析 Electron 可执行文件；优先使用被测应用自身安装的 Electron。 */
export function resolveElectronExecutable(
  options: { hostAppPath?: string; electronExecutablePath?: string } = {}
): string {
  const explicit = options.electronExecutablePath ?? process.env.CHIPS_E2E_ELECTRON;
  if (explicit !== undefined) {
    const resolved = path.resolve(explicit);
    if (!existsSync(resolved)) {
      throw new Error(`指定的 Electron 可执行文件不存在：${resolved}。`);
    }
    return resolved;
  }

  const root = resolveEcosystemRoot();
  const candidates = [options.hostAppPath, root].filter(
    (value): value is string => typeof value === 'string'
  );
  for (const baseDir of candidates) {
    const executablePath = tryResolveElectron(baseDir);
    if (executablePath !== null) {
      return executablePath;
    }
  }

  throw new Error(
    '未找到 Electron 运行时。请执行 pnpm install（根 workspace 已声明 electron，被测应用亦可在自身声明），' +
      '或通过 CHIPS_E2E_ELECTRON 指定可执行文件路径。'
  );
}

function tryResolveElectron(baseDir: string): string | null {
  const packageDir = findPackageDir('electron', baseDir);
  if (packageDir === null) {
    return null;
  }

  const override = process.env.ELECTRON_OVERRIDE_DIST_PATH;
  const pathFile = path.join(packageDir, 'path.txt');
  if (existsSync(pathFile)) {
    const relativeExecutable = readFileSync(pathFile, 'utf8').trim();
    if (relativeExecutable.length > 0) {
      const executable =
        override === undefined
          ? path.join(packageDir, 'dist', relativeExecutable)
          : path.join(override, relativeExecutable);
      if (existsSync(executable)) {
        return executable;
      }
    }
  }

  try {
    const packageRequire = createRequire(path.join(packageDir, 'package.json'));
    const executablePath = packageRequire(packageDir) as unknown;
    if (typeof executablePath === 'string' && existsSync(executablePath)) {
      return executablePath;
    }
    return null;
  } catch {
    return null;
  }
}

/** 自 `fromDir` 向上查找已安装的 npm 包目录（兼容 pnpm 提升与嵌套安装）。 */
function findPackageDir(packageName: string, fromDir: string): string | null {
  let current = path.resolve(fromDir);
  for (;;) {
    const candidate = path.join(current, 'node_modules', packageName);
    if (existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
