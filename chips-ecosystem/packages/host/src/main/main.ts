/**
 * Electron 主进程入口与进程级生命周期。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动与退出顺序）、§3.2（唯一交互面）、
 * `ADR-002` §进程模型 / §窗口管理 / §现状注记（`requestSingleInstanceLock`、`open-file`）。
 *
 * @remarks
 * - 单实例：第二实例立即退出；参数经 `second-instance` 排队，平台就绪后统一投递。
 * - 退出：`before-quit` 阻止默认退出，执行壳逆序收口后 `app.exit(0)`；重复触发幂等。
 * - 本模块不装配平台核心：装配经 {@link HostAssembly} 由组合根注入（见 `runtime-provider.ts`）。
 */

import type { IPalHost } from '../platform/contracts/index.js';
import type { IPlatformRuntime, IPlatformStartupInput } from '../runtime/contracts.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';
import { HostStartupError, describeHostFailure } from '../shared/errors.js';
import { HostApplication, type BootstrapWindowOptions } from './application.js';
import { createElectronRuntime } from './electron-adapter.js';
import { registerResourceSchemePrivileges } from './resource-protocol.js';
import type { HostAssembly } from './runtime-provider.js';
import { parseStartupInputs, StartupInputQueue, type StartupInput } from './startup-inputs.js';

/** 主进程启动选项。 */
export interface HostMainOptions {
  /** `require('electron')` 返回值或测试替身。 */
  readonly electronModule: unknown;
  /** 平台装配（组合根）。 */
  readonly assembly: HostAssembly;
  /** preload 脚本绝对路径。 */
  readonly preloadPath: string;
  /** 平台构建产物根目录（`chips-resource://platform/<path>` 的映射根）。 */
  readonly platformRoot: string;
  /** 启动窗口参数。 */
  readonly bootstrapWindow?: BootstrapWindowOptions;
  /** 诊断口；默认写 `process.stderr`。 */
  readonly diagnostics?: DiagnosticsSink;
}

/** 主进程句柄。 */
export interface HostMainHandle {
  /** 壳应用（测试与诊断消费）。 */
  readonly application: HostApplication;
  /** 主动退出（幂等）：逆序收口后结束进程。 */
  quit(): Promise<void>;
}

/** 把壳层启动输入归一为核心投递形态。 */
function toPlatformInputs(inputs: readonly StartupInput[]): readonly IPlatformStartupInput[] {
  return inputs.map((input) =>
    input.kind === 'workspace' ? { kind: 'workspace', path: input.path } : { kind: 'open-path', path: input.path },
  );
}

/**
 * 启动主进程。
 *
 * @param options 启动选项。
 * @returns 主进程句柄；未获得单实例锁时返回 `null`（本实例已请求退出）。
 * @throws {HostStartupError} 启动阶段失败时抛出（进程已请求退出码 1）。
 */
export async function startHostMain(options: HostMainOptions): Promise<HostMainHandle | null> {
  const diagnostics = options.diagnostics ?? createStderrDiagnostics();
  const electron = createElectronRuntime(options.electronModule);
  const { app } = electron;

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return null;
  }

  registerResourceSchemePrivileges(electron.protocol);

  const queue = new StartupInputQueue();
  let context: HostRuntimeContextHolder | null = null;
  const dispatch = async (): Promise<void> => {
    if (context === null || queue.size === 0) {
      return;
    }
    await context.application.dispatchStartupInputs(toPlatformInputs(queue.drain()));
  };

  app.onSecondInstance((_event, argv) => {
    queue.push(parseStartupInputs(argv));
    void dispatch();
  });
  app.onOpenFile((_event, path) => {
    queue.push([{ kind: 'open', path }]);
    void dispatch();
  });

  await app.whenReady();

  let application: HostApplication;
  try {
    const userDataPath = app.getPath('userData');
    const palHost: IPalHost = options.assembly.createPalHost(options.electronModule, {
      userDataPath,
      preloadPath: options.preloadPath,
      platformRoot: options.platformRoot,
    });
    const runtime: IPlatformRuntime = await options.assembly.createRuntime({
      palHost,
      platformRoot: options.platformRoot,
      userDataPath,
    });
    application = new HostApplication({
      electron,
      palHost,
      runtime,
      preloadPath: options.preloadPath,
      ...(options.bootstrapWindow !== undefined ? { bootstrapWindow: options.bootstrapWindow } : {}),
      diagnostics,
    });
    await application.start();
  } catch (error) {
    // 装配与启动同属启动阶段：任一环节失败都以退出码 1 结束进程并上抛（17-跨端Shell 2.4）。
    const failure = describeHostFailure(error);
    diagnostics.error('startup', `壳启动失败：${failure.code}`, { stage: stageOf(error) });
    app.exit(1);
    throw error instanceof HostStartupError
      ? error
      : new HostStartupError('HOST_STARTUP_FAILED', 'core-start', failure.message, { cause: error });
  }
  context = { application };

  let quitting = false;
  const quit = async (): Promise<void> => {
    if (quitting) {
      return;
    }
    quitting = true;
    try {
      await application.shutdown();
    } catch (error) {
      diagnostics.error('shutdown', '壳收口异常', { reason: error instanceof Error ? error.message : typeof error });
    }
    app.exit(0);
  };

  app.onWindowAllClosed(() => {
    if (process.platform !== 'darwin') {
      void quit();
    }
  });
  app.onActivate(() => {
    void application.ensureBootstrapWindow().catch((error: unknown) => {
      diagnostics.error('window', '重建启动窗口失败', {
        reason: error instanceof Error ? error.message : typeof error,
      });
    });
  });
  app.onBeforeQuit((event) => {
    if (quitting) {
      return;
    }
    event.preventDefault();
    void quit();
  });

  await dispatch();
  return { application, quit };
}

/** 运行期上下文占位（启动完成前到达的输入排队等待）。 */
interface HostRuntimeContextHolder {
  readonly application: HostApplication;
}

/** 读取启动错误阶段（仅用于诊断）。 */
function stageOf(error: unknown): string {
  return error instanceof HostStartupError ? error.stage : 'unknown';
}
