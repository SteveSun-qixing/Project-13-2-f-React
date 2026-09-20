/**
 * 薯片宿主正式应用入口（Electron 可执行入口：`electron dist/main/app.js`）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动与退出顺序）、`ADR-002` §进程模型。
 *
 * @remarks
 * - 与 `self-check.ts` 同形的最小可执行入口：解析真实运行环境路径与 Electron 模块后，
 *   把全部启动编排委托给 `app-launch.ts`（可测试段）；本文件只做进程级薄壳。
 * - 用途：真实应用布局的可自动化 launch 入口（承载闸 `pnpm smoke:app` 与后续集成波次消费）。
 */

import { resolve } from 'node:path';

import { loadElectronModule } from '../platform/electron/load-electron.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';
import { launchHostApplication, parseAppLaunchArgs } from './app-launch.js';

/** 平台构建产物根目录（`dist/renderer`）。 */
const platformRoot = resolve(__dirname, '..', 'renderer');
/** preload 脚本（`dist/preload/index.js`）。 */
const preloadPath = resolve(__dirname, '..', 'preload', 'index.js');

/** 入口主流程。 */
async function main(): Promise<void> {
  const electronModule = loadElectronModule();
  if (electronModule === null) {
    process.stderr.write('薯片宿主应用需要在 Electron 主进程中运行（electron dist/main/app.js）\n');
    process.exit(1);
  }
  // Electron 模块形状由 startHostMain → createElectronRuntime 校验（失败即终止）。
  await launchHostApplication({
    electronModule,
    preloadPath,
    platformRoot,
    openCards: parseAppLaunchArgs(process.argv.slice(2)),
    diagnostics: createStderrDiagnostics(),
  });
}

void main().catch((error: unknown) => {
  process.stderr.write(`薯片宿主启动失败：${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
