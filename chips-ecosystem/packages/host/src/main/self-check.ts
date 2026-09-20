/**
 * 壳自检入口（Electron 最小可运行入口）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（壳自检）、`重构大计划/03-并行开发与子智能体规范`（最小可运行入口）。
 *
 * @remarks
 * - 用途：以真实 Electron 链路启动壳、验证窗口 / preload / IPC / `chips-resource://` 与退出收口。
 * - 与生产入口共用组合根（`production-assembly.ts`）：自检装配内置能力清单（`system:info`）并暴露真实
 *   响应；`document:*` 走组合根文档能力装载段（金链路刀4）的正式通道——依赖判据齐备时注册真实四能力，
 *   任一硬依赖缺位（自检口径下资源管理器端口与守卫快照注入位缺位，工单 036）即诚实回退、维持真实的
 *   注册表未命中错误。生产打包入口在此之上追加外部提供方与装载段注入项。
 * - 若需"核心完全缺位"的诚实回退（一律 `BRIDGE_CAPABILITY_NOT_FOUND`），改用 `runtime/self-check-runtime.ts`。
 */

import { resolve } from 'node:path';

import { loadElectronModule } from '../platform/electron/load-electron.js';
import { createMacPalHost } from '../platform/mac/index.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';
import { startHostMain } from './main.js';
import { createProductionAssembly } from './production-assembly.js';

/** 平台构建产物根目录（`dist/renderer`）。 */
const platformRoot = resolve(__dirname, '..', 'renderer');
/** preload 脚本（`dist/preload/index.js`）。 */
const preloadPath = resolve(__dirname, '..', 'preload', 'index.js');

/** PAL 窗口 partition 序号；每个窗口独立 partition，保证协议来源可唯一解析。 */
let palWindowSequence = 0;

/** 自检装配：macOS PAL + 生产组合根运行时（内置能力清单，无外部提供方；文档装载段按真实判据诚实回退）。 */
const assembly = createProductionAssembly({
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
