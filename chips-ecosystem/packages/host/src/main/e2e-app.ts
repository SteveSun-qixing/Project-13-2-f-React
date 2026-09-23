/**
 * 薯片宿主 E2E 金链路应用入口（Electron 可执行入口：`electron dist/main/e2e-app.js`；金链路刀7 / 任务 #114 段B）。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动与退出顺序）、`ADR-002` §进程模型；
 * 注入面合法性：工单 036 §六（测试注入仅限 tests/ 交付面）。
 *
 * @remarks
 * - 与正式入口 `app.ts` 同形的薄壳：解析真实运行环境路径与 Electron 模块后，把全部启动
 *   编排委托 `app-launch.ts`——同一组合根（`createProductionAssembly`）、零逻辑分叉口径随动。
 * - 唯一差异：环境变量 `CHIPS_E2E_DOCUMENT_WIRING_MODULE` 指认测试侧接线模块（绝对路径
 *   CJS，落位 `tests/e2e/host-wiring/`）时，装载其 `createE2EDocumentWiring()` 交付的文档
 *   能力注入项（守卫会话快照提供者 + 资源侧端口）。解析域产物仍走生产缺省装载闸
 *   （`chips-native.node` 56 项导出全量在册、解析域 17 必备名闸真实通过），本入口不注入
 *   任何解析替身——禁 mock native 冒充 E2E。
 * - fail-closed 三态：环境变量缺位 → 与正式入口完全一致的诚实回退态（`document:*` 不注册）；
 *   指认但模块不可装载 / 工厂缺位 / 交付形状不完整 → 如实启动失败（不静默降级）；
 *   指认且形状齐备 → 装载段以真实解析产物 + 注入端口注册真实 `document:*` 四能力与取视图通道。
 * - 保存落盘权威归 W3（金链路集成七刀定案·刀6）：注入的资源端口不承载受控提交
 *   （`commit` 以登记码拒绝），解析端口 `serialize` 维持在册诚实失败臂——本入口不伪造保存面。
 * - 端口成员闸随动（工单036 波 B2 #241）：`resourcePorts.scope` 必含 `localPathOf` /
 *   `scopeRootOf` 两个点位三消费臂成员——宿主文档域已不再自存 `localPath`、也不再自切作用域根，
 *   接线模块缺成员即在此闸以中文判据失败，不留到写入链深处抛裸 `TypeError`。
 */

import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import type { IDocumentCapabilityWiringOptions } from '../capabilities/document/adapters/production-wiring.js';
import { loadElectronModule } from '../platform/electron/load-electron.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';
import { launchHostApplication, parseAppLaunchArgs } from './app-launch.js';

/** 平台构建产物根目录（`dist/renderer`）。 */
const platformRoot = resolve(__dirname, '..', 'renderer');
/** preload 脚本（`dist/preload/index.js`）。 */
const preloadPath = resolve(__dirname, '..', 'preload', 'index.js');

/** 测试侧文档接线模块环境变量（值为模块绝对路径；仅本 E2E 入口消费）。 */
export const DOCUMENT_WIRING_MODULE_ENV = 'CHIPS_E2E_DOCUMENT_WIRING_MODULE';

/**
 * 读取真实进程环境。
 *
 * @remarks Vite 主进程构建的 define 注入会把裸 `process.env` 标识符链替换为 `{}`
 * 空对象垫片（浏览器目标缺省），而本入口的环境变量判据必须触达 Node 真实环境；
 * 经 `globalThis.process` 成员链取环境（不构成 define 替换的匹配形态）——
 * 与文件头注 fail-closed 三态判据同源，环境变量缺位时仍如实回退生产态。
 */
function readMainProcessEnv(): NodeJS.ProcessEnv {
  return (globalThis as { process?: { env?: NodeJS.ProcessEnv } }).process?.env ?? {};
}

/**
 * 装载测试侧文档接线模块（fail-closed 判据见文件头注）。
 *
 * @param env 进程环境（默认真实 `process.env`；参数化仅供确定性验证，不改变缺省语义）。
 * @returns 组合根文档装载段注入项；环境变量缺位时为 `undefined`（生产回退态）。
 * @throws {Error} 模块不可装载、工厂缺位或交付形状不完整（缺守卫来源 / 缺资源端口）。
 */
export function resolveE2EDocumentWiring(
  env: NodeJS.ProcessEnv = readMainProcessEnv(),
): IDocumentCapabilityWiringOptions | undefined {
  const raw = env[DOCUMENT_WIRING_MODULE_ENV];
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }
  const modulePath = resolve(raw);
  const loadModule = createRequire(__filename);
  const loaded = loadModule(modulePath) as { createE2EDocumentWiring?: () => IDocumentCapabilityWiringOptions };
  if (typeof loaded.createE2EDocumentWiring !== 'function') {
    throw new Error(`E2E 文档接线模块缺少 createE2EDocumentWiring 工厂：${modulePath}`);
  }
  const wiring = loaded.createE2EDocumentWiring();
  if (
    typeof wiring?.guardSessionSource !== 'function' ||
    typeof wiring?.resourcePorts?.scope?.normalizeSource !== 'function' ||
    typeof wiring?.resourcePorts?.scope?.unregisterScope !== 'function' ||
    typeof wiring?.resourcePorts?.scope?.localPathOf !== 'function' ||
    typeof wiring?.resourcePorts?.scope?.scopeRootOf !== 'function' ||
    typeof wiring?.resourcePorts?.storage?.readFileBytes !== 'function'
  ) {
    throw new Error(
      `E2E 文档接线模块交付形状不完整（guardSessionSource / resourcePorts.scope（含 unregisterScope，波 A2b-α 端口成员；` +
        `含 localPathOf 与 scopeRootOf，工单036 波 B2 #241 点位三消费臂端口成员，缺失即文档写入链无路径单源可取） / ` +
        `resourcePorts.storage 必备）：${modulePath}`,
    );
  }
  return wiring;
}

/** 入口主流程。 */
async function main(): Promise<void> {
  const electronModule = loadElectronModule();
  if (electronModule === null) {
    process.stderr.write('薯片宿主 E2E 入口需要在 Electron 主进程中运行（electron dist/main/e2e-app.js）\n');
    process.exit(1);
  }
  // Electron 模块形状由 startHostMain → createElectronRuntime 校验（失败即终止）。
  const documentWiring = resolveE2EDocumentWiring();
  await launchHostApplication({
    electronModule,
    preloadPath,
    platformRoot,
    openCards: parseAppLaunchArgs(process.argv.slice(2)),
    ...(documentWiring === undefined ? {} : { documentWiring }),
    diagnostics: createStderrDiagnostics(),
  });
}

void main().catch((error: unknown) => {
  process.stderr.write(`薯片宿主 E2E 入口启动失败：${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
