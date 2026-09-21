import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * `@chips/e2e` 公开面的运行时装载。
 *
 * 纪律与形态（详见 `真进程采集-设计.md` §二）：
 * - 本包零运行时第三方依赖：不静态 import `@chips/e2e` / `@playwright/test`，
 *   以 `pathToFileURL` + 动态 `import` 复用 e2e 既有承载辅助的**源码公开面**
 *   （`tests/e2e/src/index.ts`，仅经其公共导出面消费，不触达内部模块）；
 * - 装载是惰性的：只有真进程采集（`CHIPS_PERF_REAL=1`）触发，纯逻辑单测
 *   导入本模块零副作用；
 * - 动态装载返回的运行时对象只在本文件边界处收窄一次，向上传递的是下面的
 *   结构化接口，消费侧不出现 `any`。
 */

/** 宿主应用解析结果（与 e2e `HostAppResolution` 同形）。 */
export interface HostAppSurface {
  readonly appPath: string;
  readonly appEntry: string;
}

/** `window.chips.request` 能力调用回包（文档域消费字段收窄）。 */
export interface DocumentOpenResultSurface {
  readonly documentId: string;
  readonly source: string;
  readonly kind: string;
  readonly title: string;
  readonly digest: string;
}

/** 渲染页面对象的结构化切片（本包用到的方法面）。 */
export interface PageSurface {
  evaluate<T = unknown>(pageFunction: unknown, arg?: unknown): Promise<T>;
  readonly mouse: {
    wheel(deltaX: number, deltaY: number): Promise<void>;
  };
}

/** Electron 主进程对象的结构化切片。 */
export interface ElectronAppSurface {
  evaluate<T = unknown>(pageFunction: unknown, arg?: unknown): Promise<T>;
}

/** 一次真进程宿主实例（与 e2e `HostInstance` 用到的方法面同形）。 */
export interface HostInstanceSurface {
  readonly app: ElectronAppSurface;
  readonly window: PageSurface;
  readonly hostAppPath: string;
  readonly appEntry: string;
}

/** 宿主启动选项（与 e2e `LaunchHostOptions` 用到的字段同形）。 */
export interface LaunchHostOptionsSurface {
  readonly appEntry?: string;
  readonly workspacePath?: string;
  readonly env?: Readonly<Record<string, string>>;
}

/** 夹具工作区结构化切片。 */
export interface TestWorkspaceSurface {
  readonly root: string;
  readonly cardArchivePath: string | null;
  readonly boxArchivePath: string | null;
  dispose(): Promise<void>;
}

/** `@chips/e2e` 公开面中本包消费的方法子集。 */
export interface ChipsE2eRuntimeSurface {
  resolveHostApp(options?: { hostAppPath?: string }): HostAppSurface;
  launchHostApp(options?: LaunchHostOptionsSurface): Promise<HostInstanceSurface>;
  closeHostApp(host: HostInstanceSurface): Promise<void>;
  createTestWorkspace(options?: {
    label?: string;
    fixtures?: { cardArchive?: boolean; boxArchive?: boolean };
  }): Promise<TestWorkspaceSurface>;
  openDocument(
    page: PageSurface,
    input: { source: string; kind?: 'card' | 'box' }
  ): Promise<unknown>;
}

/** e2e 公共面模块文件路径（`tests/e2e/src/index.ts`）。 */
export function e2eRuntimeModulePath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, '..', '..', '..', 'e2e', 'src', 'index.ts');
}

/**
 * 惰性装载 `@chips/e2e` 公开面。
 *
 * 真进程承载唯一入口；模块不存在或未安装其 devDependencies 时如实抛错（fail-closed），
 * 不做任何降级替身。
 */
export async function loadChipsE2eRuntime(): Promise<ChipsE2eRuntimeSurface> {
  const entry = e2eRuntimeModulePath();
  if (!existsSync(entry)) {
    throw new Error(`@chips/e2e 公开面模块不存在：${entry}（真进程承载 fail-closed）。`);
  }
  const loaded: unknown = await import(pathToFileURL(entry).href);
  if (typeof loaded !== 'object' || loaded === null) {
    throw new Error('@chips/e2e 公开面没有导出对象（真进程承载 fail-closed）。');
  }
  const surface = loaded as Partial<ChipsE2eRuntimeSurface>;
  for (const name of [
    'resolveHostApp',
    'launchHostApp',
    'closeHostApp',
    'createTestWorkspace',
    'openDocument',
  ] as const) {
    if (typeof surface[name] !== 'function') {
      throw new Error(`@chips/e2e 公开面缺少必需辅助 ${name}（真进程承载 fail-closed）。`);
    }
  }
  return surface as ChipsE2eRuntimeSurface;
}

/**
 * 正式应用承载入口（`dist/main/app.js`，即 `pnpm --filter @chips/host app` 的启动面，
 * 含启动 bootstrap 窗口）。`package.json#main` 指向 `dist/main/main.js`（装配库，
 * 不自举窗口），冷启动/空闲内存必须以真实启动面为测量对象。
 */
export function resolveFormalAppEntry(resolution: HostAppSurface): string {
  const appEntry = path.join(resolution.appPath, 'dist', 'main', 'app.js');
  if (!existsSync(appEntry)) {
    throw new Error(
      `正式应用入口构建产物不存在：${appEntry}。请先执行 pnpm --filter @chips/host build（真进程采集 fail-closed）。`
    );
  }
  return appEntry;
}

/** 宿主 E2E 文档承载入口（`dist/main/e2e-app.js`）与接线模块路径（缺失如实抛错）。 */
export function resolveDocumentHostEntry(resolution: HostAppSurface): {
  appEntry: string;
  wiringModulePath: string;
} {
  const appEntry = path.join(resolution.appPath, 'dist', 'main', 'e2e-app.js');
  if (!existsSync(appEntry)) {
    throw new Error(
      `E2E 入口构建产物不存在：${appEntry}。请先执行 pnpm --filter @chips/host build（真进程采集 fail-closed，不造假数据）。`
    );
  }
  const wiringModulePath = path.resolve(
    path.dirname(e2eRuntimeModulePath()),
    '..',
    'host-wiring',
    'e2e-document-wiring.cjs'
  );
  if (!existsSync(wiringModulePath)) {
    throw new Error(`E2E 文档接线模块不存在：${wiringModulePath}。`);
  }
  return { appEntry, wiringModulePath };
}

/** `app.getAppMetrics()` 回包中本包消费的形状（memory.workingSetSize 单位 KB）。 */
export interface AppMetricSurface {
  readonly pid: number;
  readonly type?: string;
  readonly memory?: { readonly workingSetSize?: number };
}

/**
 * 取宿主全部 Chromium 进程的 RSS 合计（字节）；经主进程 `app.getAppMetrics()` 在册路径
 * （《调试指南》§8.4 第 1 步 / §8.5 工具清单）。Playwright `app.evaluate` 的**真函数**
 * 入参会被以 Electron 主进程 `require('electron')` 模块为首参调用（字符串表达式则在
 * node 上下文裸求值，既拿不到 `require` 也不会自动调用——实测回包 `undefined`），
 * 故此处必须传内联匿名单表达式箭头（无内部具名绑定，规避 esbuild `__name` 注入）。
 */
export async function collectHostRssBytes(host: HostInstanceSurface): Promise<number> {
  const metrics = await host.app.evaluate<AppMetricSurface[]>(
    (electronModule: { app: { getAppMetrics(): AppMetricSurface[] } }): AppMetricSurface[] =>
      electronModule.app.getAppMetrics()
  );
  if (!Array.isArray(metrics)) {
    throw new Error('app.getAppMetrics() 回包不是数组（真进程内存采样 fail-closed）。');
  }
  let totalBytes = 0;
  for (const metric of metrics) {
    const workingSetKb = metric.memory?.workingSetSize;
    if (typeof workingSetKb === 'number' && Number.isFinite(workingSetKb)) {
      totalBytes += workingSetKb * 1024;
    }
  }
  if (totalBytes <= 0) {
    throw new Error('app.getAppMetrics() 未回带任何有效 RSS 采样（真进程内存采样 fail-closed）。');
  }
  return totalBytes;
}

/**
 * 取宿主 `app.getPath('userData')`（工单041① `CHIPS_TRACE` 落盘目录的定位入口）。
 * 调用形态与 `collectHostRssBytes` 同一契约：内联匿名单表达式箭头，electron 模块首参。
 */
export async function collectHostUserDataPath(host: HostInstanceSurface): Promise<string> {
  const userDataPath = await host.app.evaluate<unknown>(
    (electronModule: { app: { getPath(name: 'userData'): string } }): string =>
      electronModule.app.getPath('userData')
  );
  if (typeof userDataPath !== 'string' || userDataPath.length === 0) {
    throw new Error('app.getPath("userData") 回包不是非空字符串（真进程采集 fail-closed）。');
  }
  return userDataPath;
}
