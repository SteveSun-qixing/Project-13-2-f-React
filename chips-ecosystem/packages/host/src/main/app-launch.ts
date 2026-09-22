/**
 * 正式应用启动编排（可测试段：启动参数解析 + 壳启动 + 窗口编排服务装载）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动与退出顺序）、§3.2（唯一交互面）、
 * `05-渲染引擎设计` §3.1（渲染进程入口）、`ADR-002` §进程模型。
 *
 * @remarks
 * - 与壳自检入口共用组合根（`createProductionAssembly`，P0-1 口径「与生产入口共用组合根、
 *   零逻辑分叉」）：本模块在其上装载**窗口编排服务**（`HostApplication.cardWindowOrchestrator`），
 *   并支持启动参数 `--chips-open-card <source>`（可重复）在启动完成后打开卡片窗口，
 *   使应用布局可被自动化冒烟闸真实驱动。
 * - 启动输入（`open-file` / 第二实例）的投递仍按既有链路经核心路由
 *   （`IPlatformRuntime.handleStartupInputs`）；把打开事件落到卡片窗口的路由属
 *   文档链路接线波次（集成缝登记见开发日志）。
 * - 卡片窗口的文档绑定投递（主进程登记表 → 渲染侧装载输入）为在册集成缝：
 *   `document:*` 能力接线在途（#99），本模块不伪造数据链路。
 */

import type { IDocumentCapabilityWiringOptions } from '../capabilities/document/adapters/production-wiring.js';
import { createMacPalHost } from '../platform/mac/index.js';
import type { IPalHost } from '../platform/contracts/index.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';
import type { PalHostContext } from './runtime-provider.js';
import { startHostMain, type HostMainHandle } from './main.js';
import { createProductionAssembly } from './production-assembly.js';
import { createSecureWindowWebPreferences } from './window-security.js';

/** 启动参数旗标：打开一张卡片窗口（可重复；值取下一参数或 `=` 内联形态）。 */
export const OPEN_CARD_FLAG = '--chips-open-card';

/** 应用启动选项。 */
export interface HostAppLaunchOptions {
  /** `require('electron')` 返回值或测试替身。 */
  readonly electronModule: unknown;
  /** preload 脚本绝对路径。 */
  readonly preloadPath: string;
  /** 平台构建产物根目录。 */
  readonly platformRoot: string;
  /** 已解析的卡片窗口来源引用（`parseAppLaunchArgs` 产物）。 */
  readonly openCards?: readonly string[];
  /**
   * 文档能力装载段注入项（金链路刀7 / 任务 #114 段B）：透传给组合根
   * `createProductionAssembly` 的同名注入位（工单 036 §六 tests/ 注入面口径）。
   *
   * @remarks 缺位即真实生产判据——`document:*` 诚实回退不注册（正式入口 `app.ts` 恒不传，
   * 行为逐字不变）；仅供 E2E 入口 `e2e-app.ts` 装载测试侧接线模块时透传。
   */
  readonly documentWiring?: IDocumentCapabilityWiringOptions;
  /** 诊断口；默认写 `process.stderr`。 */
  readonly diagnostics?: DiagnosticsSink;
}

/**
 * 解析应用启动参数。
 *
 * @param argv 参数数组（`process.argv` 剥离可执行文件与脚本参数后的形态）。
 * @returns `--chips-open-card` 旗标携带的来源引用序列（按出现顺序；`<flag> <值>` 与
 *   `<flag>=<值>` 两种形态等价）。
 */
export function parseAppLaunchArgs(argv: readonly string[]): readonly string[] {
  const sources: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (arg === OPEN_CARD_FLAG) {
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith('--')) {
        sources.push(next);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith(`${OPEN_CARD_FLAG}=`)) {
      const value = arg.slice(OPEN_CARD_FLAG.length + 1);
      if (value.length > 0) {
        sources.push(value);
      }
    }
  }
  return sources;
}

/**
 * 构造 macOS PAL 宿主工厂（与壳自检入口同形：每窗口独立 partition，保证协议来源唯一解析）。
 *
 * @param electronModule `require('electron')` 返回值。
 * @param context 装配上下文（preload 路径等）。
 * @returns PAL 宿主。
 */
export function createAppPalHost(electronModule: unknown, context: PalHostContext): IPalHost {
  let palWindowSequence = 0;
  return createMacPalHost(electronModule, {
    windowOptions: () => {
      palWindowSequence += 1;
      return {
        // 工单043-A4：安全基线经唯一构造工厂显式钉死（构造 + assert 硬闸一体），不依赖
        // Electron 默认值；PAL 侧端口另有强制合并臂，双层不互替。
        webPreferences: createSecureWindowWebPreferences({
          preload: context.preloadPath,
          partition: `chips-window-pal-${palWindowSequence}`,
        }),
      };
    },
  });
}

/**
 * 启动正式应用：壳启动 + 窗口编排服务装载 + 启动参数落地。
 *
 * @param options 启动选项。
 * @returns 主进程句柄；未获得单实例锁时为 `null`（实例已请求退出）。
 */
export async function launchHostApplication(options: HostAppLaunchOptions): Promise<HostMainHandle | null> {
  const diagnostics = options.diagnostics ?? createStderrDiagnostics();
  const assembly = createProductionAssembly({
    createPalHost: createAppPalHost,
    ...(options.documentWiring === undefined ? {} : { documentWiring: options.documentWiring }),
  });
  const handle = await startHostMain({
    electronModule: options.electronModule,
    assembly,
    preloadPath: options.preloadPath,
    platformRoot: options.platformRoot,
    bootstrapWindow: { title: '薯片' },
    diagnostics,
  });
  if (handle === null) {
    return null;
  }
  for (const source of options.openCards ?? []) {
    try {
      await handle.application.cardWindowOrchestrator.open({ source });
    } catch (error) {
      // 启动参数落地失败是明确的运行期错误：写诊断（冒烟闸以 stderr 零字节为判据）但不终止壳。
      diagnostics.error('window', '卡片窗口启动装载失败', {
        reason: error instanceof Error ? error.message : typeof error,
      });
    }
  }
  return handle;
}
