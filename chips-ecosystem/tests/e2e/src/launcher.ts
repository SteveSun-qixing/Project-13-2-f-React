import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

import {
  DEFAULT_BRIDGE_TIMEOUT_MS,
  DEFAULT_LAUNCH_TIMEOUT_MS,
  resolveElectronExecutable,
  resolveHostApp,
} from './environment';

/** Bridge 就绪探测的默认能力：只读、全角色可调用（《能力契约规范》7.14）。 */
export const DEFAULT_READY_PROBE_CAPABILITY = 'system:info';

/** 构造宿主启动参数：入口脚本 + `--workspace=<path>` + 位置打开路径。 */
export function buildLaunchArgs(
  appEntry: string,
  options: { workspacePath?: string; openPaths?: readonly string[] } = {}
): string[] {
  const args = [appEntry];
  if (options.workspacePath !== undefined) {
    args.push(`--workspace=${options.workspacePath}`);
  }
  if (options.openPaths !== undefined) {
    args.push(...options.openPaths);
  }
  return args;
}

export interface LaunchHostOptions {
  /** 显式宿主应用目录；缺省按 `environment.ts` 解析顺序。 */
  readonly hostAppPath?: string;
  /** 显式应用入口；缺省取应用 `package.json` 的 `main`。 */
  readonly appEntry?: string;
  /** 显式 Electron 可执行文件。 */
  readonly electronExecutablePath?: string;
  /** 开发工作区路径，随 `--workspace=` 传入。 */
  readonly workspacePath?: string;
  /** 启动时按位置参数打开的文档路径（资源打开路由的 `os-association` 来源）。 */
  readonly openPaths?: readonly string[];
  /** 追加环境变量；与进程环境合并。 */
  readonly env?: Readonly<Record<string, string>>;
  /** 启动超时（含首窗口）。 */
  readonly launchTimeoutMs?: number;
  /** Bridge 就绪探测超时。 */
  readonly readyTimeoutMs?: number;
  /** 就绪探测能力 ID；传 `null` 只等待 `window.chips` 暴露。 */
  readonly readyProbeCapability?: string | null;
}

/** 一次 E2E 宿主实例：Electron 应用 + 首窗口 + 启动上下文。 */
export interface HostInstance {
  readonly app: ElectronApplication;
  /** 首个窗口；渲染帧与文档会话断言允许按全部窗口扩展扫描。 */
  readonly window: Page;
  readonly hostAppPath: string;
  readonly appEntry: string;
  readonly workspacePath: string | null;
  /** 逆序关闭：先关应用，超时则终止进程；幂等。 */
  close(): Promise<void>;
}

/**
 * 启动宿主应用并等待 Bridge 就绪。
 *
 * 应用必须来自构建产物（《测试规范》§6.2）；启动分阶段超时并输出阶段名，
 * 便于在 W2 金链路联调时定位是「启动 / 首窗口 / Bridge」哪一段未就绪。
 */
export async function launchHostApp(options: LaunchHostOptions = {}): Promise<HostInstance> {
  const resolution = resolveHostApp(
    options.hostAppPath === undefined ? {} : { hostAppPath: options.hostAppPath }
  );
  const appEntry = options.appEntry ?? resolution.appEntry;
  const electronPath = resolveElectronExecutable({
    ...(options.electronExecutablePath === undefined
      ? {}
      : { electronExecutablePath: options.electronExecutablePath }),
    ...(options.hostAppPath === undefined ? {} : { hostAppPath: options.hostAppPath }),
  });
  const launchTimeoutMs = options.launchTimeoutMs ?? DEFAULT_LAUNCH_TIMEOUT_MS;
  const args = buildLaunchArgs(appEntry, {
    ...(options.workspacePath === undefined ? {} : { workspacePath: options.workspacePath }),
    ...(options.openPaths === undefined ? {} : { openPaths: options.openPaths }),
  });

  let app: ElectronApplication;
  try {
    app = await withTimeout(
      electron.launch({
        executablePath: electronPath,
        args,
        cwd: resolution.appPath,
        env: mergeEnvironment(options.env),
      }),
      launchTimeoutMs,
      `启动 Electron（${appEntry}）`
    );
  } catch (error) {
    throw new Error(
      `[chips-e2e] 宿主启动失败：${formatError(error)}。` +
        '请确认已执行 pnpm build（或 pnpm --filter @chips/host build），' +
        '且入口脚本与 Electron 运行时为当前提交。',
      { cause: error }
    );
  }

  let window: Page;
  try {
    window = await withTimeout(app.firstWindow(), launchTimeoutMs, '等待宿主首窗口');
  } catch (error) {
    await forceClose(app);
    throw new Error(`[chips-e2e] 未获得宿主首窗口：${formatError(error)}。`, { cause: error });
  }

  const host: HostInstance = {
    app,
    window,
    hostAppPath: resolution.appPath,
    appEntry,
    workspacePath: options.workspacePath ?? null,
    async close(): Promise<void> {
      await forceClose(app);
    },
  };

  const readyOptions: WaitForHostReadyOptions = {
    timeoutMs: options.readyTimeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS,
    ...(options.readyProbeCapability === undefined
      ? {}
      : { probeCapability: options.readyProbeCapability }),
  };
  try {
    await waitForHostReady(host, readyOptions);
  } catch (error) {
    await host.close();
    throw error;
  }

  return host;
}

export interface WaitForHostReadyOptions {
  /** 就绪超时。 */
  readonly timeoutMs?: number;
  /** 探测能力 ID；`null` 表示只等待 `window.chips` 暴露。默认 `system:info`。 */
  readonly probeCapability?: string | null;
  /** 要等待的窗口；缺省首窗口。 */
  readonly page?: Page;
}

/**
 * 等待宿主 Bridge 就绪。
 *
 * 就绪判定（两步）：
 * 1. `window.chips` 以 `request` / `subscribe` / `resource` 三方法暴露；
 * 2. 可选探测一次只读能力（默认 `system:info`）——只要收到**任一结构化响应**
 *    （成功值或带 `code` 的 `ChipsError`）即证明 preload→IPC→Bridge 链路已通；
 *    权限拒绝同属就绪，不视为失败。
 */
export async function waitForHostReady(
  host: HostInstance,
  options: WaitForHostReadyOptions = {}
): Promise<void> {
  const page = options.page ?? host.window;
  const timeoutMs = options.timeoutMs ?? DEFAULT_BRIDGE_TIMEOUT_MS;
  const probeCapability =
    options.probeCapability === undefined
      ? DEFAULT_READY_PROBE_CAPABILITY
      : options.probeCapability;

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs });
    await page.waitForFunction(
      () => {
        const bridge = (window as unknown as { chips?: unknown }).chips as
          | {
              request?: unknown;
              subscribe?: unknown;
              resource?: unknown;
            }
          | undefined;
        return (
          bridge !== undefined &&
          typeof bridge.request === 'function' &&
          typeof bridge.subscribe === 'function' &&
          typeof bridge.resource === 'function'
        );
      },
      undefined,
      { timeout: timeoutMs }
    );

    if (probeCapability === null) {
      return;
    }
    await page.waitForFunction(
      async (capabilityId: string) => {
        const bridge = (window as unknown as { chips?: WindowChipsLike }).chips;
        if (bridge === undefined) {
          return false;
        }
        try {
          await bridge.request(capabilityId, {});
          return true;
        } catch (error) {
          const code = (error as { code?: unknown } | null)?.code;
          return typeof code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(code);
        }
      },
      probeCapability,
      { timeout: timeoutMs }
    );
  } catch (error) {
    throw new Error(`[chips-e2e] 等待 Bridge 就绪超时（${timeoutMs}ms）：${formatError(error)}。`, {
      cause: error,
    });
  }
}

interface WindowChipsLike {
  request(capabilityId: string, input?: unknown): Promise<unknown>;
}

/** 关闭宿主：正常关闭失败时终止子进程；幂等。 */
export async function closeHostApp(host: HostInstance): Promise<void> {
  await host.close();
}

async function forceClose(app: ElectronApplication): Promise<void> {
  try {
    await withTimeout(app.close(), 10_000, '关闭宿主');
    return;
  } catch {
    // 正常关闭失败后终止子进程，避免残留进程影响后续用例。
  }
  try {
    const child = app.process();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  } catch {
    // 进程已退出时 process() 可能抛错；关闭已尽力完成。
  }
}

function mergeEnvironment(extra?: Readonly<Record<string, string>>): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  if (extra !== undefined) {
    for (const [key, value] of Object.entries(extra)) {
      merged[key] = value;
    }
  }
  return merged;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, stage: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`[chips-e2e] ${stage}超时（${timeoutMs}ms）`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
