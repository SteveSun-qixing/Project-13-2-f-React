/**
 * 壳自检入口（Electron 最小可运行入口）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（壳自检）、`重构大计划/03-并行开发与子智能体规范`（最小可运行入口）。
 *
 * @remarks
 * - 用途：在平台核心（Cordis + Bridge）交付前，以真实 Electron 链路启动壳、验证窗口 / preload /
 *   IPC / `chips-resource://` 与退出收口；**不注册任何能力、事件与资源作用域**。
 * - 与生产入口的差异仅在组合根装配（`runtime-provider.ts`）：壳逻辑与生产完全一致。
 */

import { resolve } from 'node:path';

import { loadElectronModule } from '../platform/electron/load-electron.js';
import { createMacPalHost } from '../platform/mac/index.js';
import { createSelfCheckRuntime } from '../runtime/self-check-runtime.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';
import { startHostMain } from './main.js';
import { createHostAssembly } from './runtime-provider.js';

/** 平台构建产物根目录（`dist/renderer`）。 */
const platformRoot = resolve(__dirname, '..', 'renderer');
/** preload 脚本（`dist/preload/index.js`）。 */
const preloadPath = resolve(__dirname, '..', 'preload', 'index.js');

/** PAL 窗口 partition 序号；每个窗口独立 partition，保证协议来源可唯一解析。 */
let palWindowSequence = 0;

/** 自检装配：macOS PAL + 壳自检运行时。 */
const assembly = createHostAssembly({
  createPalHost: (electronModule, context) =>
    createMacPalHost(electronModule, {
      windowOptions: () => {
        palWindowSequence += 1;
        return {
          webPreferences: {
            preload: context.preloadPath,
            partition: `chips-window-pal-${palWindowSequence}`,
          },
        };
      },
    }),
  createRuntime: (context) => createSelfCheckRuntime({ platformRoot: context.platformRoot }),
});

/** 启动自检。 */
async function main(): Promise<void> {
  const electronModule = loadElectronModule();
  if (electronModule === null) {
    process.stderr.write('壳自检需要在 Electron 主进程中运行（electron dist/main/self-check.js）\n');
    process.exit(1);
  }
  // Electron 模块形状由 startHostMain → createElectronRuntime 校验（失败即终止）。
  await startHostMain({
    electronModule,
    assembly,
    preloadPath,
    platformRoot,
    bootstrapWindow: { title: '薯片 · 壳自检' },
    diagnostics: createStderrDiagnostics(),
  });
}

void main().catch((error: unknown) => {
  process.stderr.write(`壳自检启动失败：${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
