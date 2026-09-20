/**
 * ModuleLoader（受管模块加载器，M2 `module.register()` resolve/load 双钩）波 1 正式套件
 * （任务 #106；RFC-插件执行通道与ModuleLoader裁定 §八 波 1 验收面）。
 *
 * 覆盖（对齐 RFC §四门禁语义与 §5.1 失败语义表，波 0 三口径实测口径同源）：
 * - A 组 契约面与纪律锁：入口固定名同源、ESM 判定同源、错误码零自造（只取在册
 *   `LIFECYCLE_ERROR_CODES`）、`register()` 返回值零消费（波 0 Electron 硬约束）、
 *   限额取数 `CPK_LIMITS.entryFileBytes`（8 MiB）、装载器公共面导出缝；
 * - B 组 宿主侧预检门禁（零通道触碰、确定性拒装）：装载目标非法、目录缺失、入口缺失、
 *   包级合并摘要复算不合（篡改拒装）、入口超 8 MiB、非 UTF-8、非 ESM、源树符号链接；
 * - C 组 通道 fail-closed：被托管模块管线（vitest/vite-node 代管 `import()`，ESM 钩子
 *   不触发——本套件开工实测坐实）下装载必须真实失败，绝不静默降级为无门禁加载；
 * - D 组 原生机制实测（`tests/fixtures/module-loader/run-native-cases.mjs` 真 Node 子进程
 *   走生产 API）：正向装载求值与门面封顶快照、nonce 复加载每次重过 resolve/load 双门禁、
 *   安装后篡改（load3 宿主复算拒 + rogue 复导入钩子级 `file-hash-mismatch` 双层）、
 *   激活期外作用域持续受管（`unmanifested-file`）、四越界 specifier（`node:*`/`electron`/
 *   裸路径/`../` 作用域逃逸）+ 绝对路径/非 JS 模块类型逐码拒且插件体零执行、
 *   子模块缺失（`module-not-found`）与语法错误（`parse-failure`）归一、
 *   `dispose` 后拒装。全部失败逐码断言：`KERNEL_APPLY_FAILED` + `details.stage/reason`
 *   结构化定位——确定性拒装以失败面抛掷（`LoaderError` 实例 / wire 结构），绝不伪装成功。
 *
 * @remarks
 * - 错误码断言一律引用 `codes.ts` 在册常量（O1 暂定裁定：实施波零新增码）；
 *   `retryable: true` 为 `KERNEL_APPLY_FAILED` 在登记表口径（钝差属 O1 在册项，非本层裁量）。
 * - D 组夹具子进程以原生 Node 启动（vitest 管线的 `import()` 被 vite-node 代管、钩子
 *   不触发；开工以探针实测坐实后归档），生产实现文件 `src/loader/module-loader.ts`
 *   零改动地经由 Node type-stripping + 测试启动器的 `.js`→`.ts` 替身层装载。
 */

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { afterAll, expect, it } from 'vitest';

import { LIFECYCLE_ERROR_CODES } from '../src/loader/codes.js';
import { LoaderError } from '../src/loader/errors.js';
import { CPK_LIMITS } from '../src/loader/limits.js';
import * as loaderIndex from '../src/loader/index.js';
import {
  MODULE_LOADER_ENTRY_FILE,
  createCpkModuleLoader,
  type ICpkModuleLoader,
} from '../src/loader/module-loader.js';
import {
  loadCpkDirectory,
  membersToZipEntries,
} from '../src/loader/provider.js';
import { computeContentHash, sha256Hex } from '../src/loader/signature.js';

const execFileAsync = promisify(execFile);

const HARNESS_PATH = fileURLToPath(
  new URL('./fixtures/module-loader/run-native-cases.mjs', import.meta.url),
);
const LOADER_SOURCE_PATH = fileURLToPath(new URL('../src/loader/module-loader.ts', import.meta.url));
const MODULE_LOADER_TEXT = readFileSync(LOADER_SOURCE_PATH, 'utf8');
const VALIDATE_TEXT = readFileSync(
  fileURLToPath(new URL('../src/loader/validate.ts', import.meta.url)),
  'utf8',
);

/** 剥离块注释与行注释，得到代码面（纪律锁只对代码断言，JSDoc 允许提及码名）。 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const MODULE_LOADER_CODE = stripComments(MODULE_LOADER_TEXT);

/** 本套件创建的全部临时工作区（afterAll 统一清理）。 */
const workspaces: string[] = [];

async function makeWorkspace(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  workspaces.push(dir);
  return dir;
}

afterAll(async () => {
  for (const dir of workspaces) {
    await rm(dir, { recursive: true, force: true });
  }
});

/** 写入插件文件树（值为 Buffer 时按原始字节落盘）。 */
async function writeTree(base: string, files: Readonly<Record<string, string | Buffer>>): Promise<void> {
  for (const [relative, content] of Object.entries(files)) {
    const target = join(base, relative);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

/** 包级合并摘要（与装载器门禁同源：provider + signature 正式实现复算）。 */
async function packageHashOf(root: string): Promise<string> {
  const pkg = await loadCpkDirectory(root);
  return computeContentHash(membersToZipEntries(pkg.members));
}

// ---------------------------------------------------------------------------
// 插件夹具模板（入口体首行置全局标记：静态 import 的提升语义下，标记缺失即插件体零执行）
// ---------------------------------------------------------------------------

const POSITIVE_ENTRY = `import { helper } from './helper.js';
globalThis.__POS_EVAL__ = (globalThis.__POS_EVAL__ ?? 0) + 1;
export default function probe() {
  return {
    token: 'positive',
    evalCount: globalThis.__POS_EVAL__,
    helper: helper(),
    typeofRequire: typeof require,
    typeofModule: typeof module,
    typeofExports: typeof exports,
    typeofDirname: typeof __dirname
  };
}
export const marker = 'm';
`;

const POSITIVE_HELPER = `export function helper() {
  return 'h';
}
`;

/** 越界/负例入口模板：`importLine` 在装载期必须被门禁抛拒，体首行标记不得出现。 */
function gatedEntry(marker: string, importLine: string): string {
  return `${importLine}
globalThis.${marker} = true;
export default 'ran';
`;
}

const OUTSIDE_TARGET = `globalThis.__RAN_ESCAPE__ = true;
export default 'escaped';
`;

function positiveTree(): Record<string, string | Buffer> {
  return {
    'manifest.yaml': 'id: com.chips.wave1.positive\nversion: 0.1.0\nrole: service\n',
    [MODULE_LOADER_ENTRY_FILE]: POSITIVE_ENTRY,
    'dist/helper.js': POSITIVE_HELPER,
  };
}

// ---------------------------------------------------------------------------
// 断言辅助
// ---------------------------------------------------------------------------

interface WireShape {
  name: string | null;
  code: string | null;
  message: string;
  retryable: boolean | null;
  details: Record<string, unknown> | null;
}

interface GateStats {
  resolveAllow: number;
  resolveReject: number;
  loadAllow: number;
  loadReject: number;
}

interface LoadOk {
  ok: true;
  nonce: string;
  entryUrl: string;
  gateStats: GateStats;
  exportKeys: string[];
  exportsFrozen: boolean;
  defaultKind: string;
  defaultResult: Record<string, unknown> | null;
}

interface LoadFail {
  ok: false;
  wire: WireShape;
}

interface NativeDoc {
  fatal: unknown;
  results: Record<string, unknown>;
}

/** 断言装载器抛错为在册 `KERNEL_APPLY_FAILED` 并取回结构化 details。 */
function expectGateFailure(error: unknown, stage: string, reason: string): Record<string, unknown> {
  expect(error).toBeInstanceOf(LoaderError);
  const loaderError = error as LoaderError;
  expect(loaderError.name).toBe('ChipsError');
  expect(loaderError.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
  // 在册表口径：KERNEL_APPLY_FAILED retryable=true（登记表事实；O1 已登记钝差，非本层裁量）。
  expect(loaderError.retryable).toBe(true);
  expect(/[\u4e00-\u9fff]/.test(loaderError.message)).toBe(true);
  const details = loaderError.details as Record<string, unknown>;
  expect(details.stage).toBe(stage);
  expect(details.reason).toBe(reason);
  return details;
}

/** 断言子进程 wire 形态为在册码并取回 details。 */
function expectWireFailure(
  wire: WireShape,
  stage: string,
  reason: string,
): Record<string, unknown> {
  expect(wire.name).toBe('ChipsError');
  expect(wire.code).toBe(LIFECYCLE_ERROR_CODES.applyFailed);
  expect(wire.retryable).toBe(true);
  expect(wire.details).not.toBeNull();
  const details = wire.details as Record<string, unknown>;
  expect(details.stage).toBe(stage);
  expect(details.reason).toBe(reason);
  return details;
}

async function captureRejection(task: Promise<unknown>): Promise<unknown> {
  try {
    await task;
  } catch (error) {
    return error;
  }
  throw new Error('expected rejection, but promise resolved');
}

function resultOf(doc: NativeDoc, as: string): unknown {
  const value = doc.results[as];
  expect(value, `子进程未产出 op "${as}" 的结果`).toBeDefined();
  return value;
}

// ---------------------------------------------------------------------------
// A 组：契约面与纪律锁
// ---------------------------------------------------------------------------

it('A1 装载器公共面导出缝就位（loader/index.ts 增量导出）', () => {
  expect(typeof loaderIndex.createCpkModuleLoader).toBe('function');
  expect(loaderIndex.MODULE_LOADER_ENTRY_FILE).toBe(MODULE_LOADER_ENTRY_FILE);
  expect(loaderIndex.MODULE_LOADER_ENTRY_FILE).toBe('dist/index.js');
});

it('A2 入口固定名与 ESM 判定与 validate.ts 同源（漂移锁）', () => {
  // 入口固定 `dist/index.js`：与校验流水线同一字面。
  expect(VALIDATE_TEXT.includes("'dist/index.js'")).toBe(true);
  // ESM 同源判定字面逐字一致（《03-插件包格式》入口规范）。
  expect(MODULE_LOADER_TEXT.includes('/\\b(export|import)\\b/')).toBe(true);
  expect(VALIDATE_TEXT.includes('/\\b(export|import)\\b/')).toBe(true);
});

it('A3 错误码纪律：在册常量引用、零字符串字面码、零自造码', () => {
  expect(MODULE_LOADER_CODE.includes("import { LIFECYCLE_ERROR_CODES } from './codes.js';")).toBe(true);
  // 任何 `CPK_*` / `KERNEL_*` / `BRIDGE_*` / `NATIVE_*` 的字符串字面量出现在代码面即自造。
  const literalCode = /['"`](?:CPK|KERNEL|BRIDGE|NATIVE)_[A-Z][A-Z_]+['"`]/.exec(MODULE_LOADER_CODE);
  expect(literalCode, `发现字面错误码：${literalCode?.[0] ?? ''}`).toBeNull();
});

it('A4 波 0 硬约束：register() 返回值零消费、initialize(data)+文件侧信道', () => {
  // 不得 `const port = register(...)` / `await register(...)`（Electron 主进程返回 undefined）。
  expect(/(?:const|let|var)\s+\w+\s*=\s*(?:await\s+)?register\(/.test(MODULE_LOADER_CODE)).toBe(false);
  expect(/await\s+register\(/.test(MODULE_LOADER_CODE)).toBe(false);
  expect(MODULE_LOADER_CODE.includes('export function initialize(data)')).toBe(true);
  // 钩子↔宿主通信面只有门闸/事件两文件（initialize data 投递），零端口。
  expect(MODULE_LOADER_CODE.includes('data: { gateFile, eventsFile }')).toBe(true);
  expect(MODULE_LOADER_CODE.includes('port2')).toBe(false);
  expect(MODULE_LOADER_CODE.includes('postMessage')).toBe(false);
});

it('A5 限额取数单点：8 MiB 来自 CPK_LIMITS（零二处定义）', () => {
  expect(CPK_LIMITS.entryFileBytes).toBe(8 * 1024 * 1024);
  expect(MODULE_LOADER_TEXT.includes('CPK_LIMITS.entryFileBytes')).toBe(true);
  // 数值字面 8388608 / 8 * 1024 * 1024 不得在实现内二次定义。
  expect(/8\s*\*\s*1024\s*\*\s*1024|8388608|8_388_608/.test(MODULE_LOADER_TEXT)).toBe(false);
});

// ---------------------------------------------------------------------------
// B 组：宿主侧预检门禁（先于任何通道动作，确定性拒装）
// ---------------------------------------------------------------------------

async function withLoader(
  fn: (loader: ICpkModuleLoader, sessionRoot: string) => Promise<void>,
): Promise<void> {
  const workspace = await makeWorkspace('chips-w1-prep-');
  const sessionRoot = join(workspace, 'sessions');
  const loader = createCpkModuleLoader({ sessionRoot });
  try {
    await fn(loader, sessionRoot);
  } finally {
    loader.dispose();
  }
}

/** 门禁预检失败必须发生在通道建立之前：会话目录不得被创建。 */
function expectNoChannelTouched(sessionRoot: string): void {
  expect(existsSync(sessionRoot), '预检失败不得触碰钩子通道（会话目录应不存在）').toBe(false);
}

it('B1 装载目标非法 → entry/invalid-target', async () => {
  await withLoader(async (loader, sessionRoot) => {
    const error = await captureRejection(
      loader.loadModule({
        pluginId: 'com.chips.wave1.invalid',
        rootDir: '/tmp/does-not-matter-at-this-stage',
        expectedPackageHash: 'sha256:nothex',
      }),
    );
    expectGateFailure(error, 'entry', 'invalid-target');
    expectNoChannelTouched(sessionRoot);
  });
});

it('B2 插件目录不可访问 → entry/root-missing', async () => {
  await withLoader(async (loader, sessionRoot) => {
    const workspace = await makeWorkspace('chips-w1-missing-');
    const error = await captureRejection(
      loader.loadModule({
        pluginId: 'com.chips.wave1.missing',
        rootDir: join(workspace, 'not-there'),
        expectedPackageHash: `sha256:${'0'.repeat(64)}`,
      }),
    );
    expectGateFailure(error, 'entry', 'root-missing');
    expectNoChannelTouched(sessionRoot);
  });
});

it('B3 入口缺失 → entry/entry-missing', async () => {
  await withLoader(async (loader, sessionRoot) => {
    const workspace = await makeWorkspace('chips-w1-noinc-');
    const root = join(workspace, 'plugin');
    await writeTree(root, { 'manifest.yaml': 'id: com.chips.wave1.noinc\n' });
    const error = await captureRejection(
      loader.loadModule({
        pluginId: 'com.chips.wave1.noinc',
        rootDir: root,
        expectedPackageHash: await packageHashOf(root),
      }),
    );
    expectGateFailure(error, 'entry', 'entry-missing');
    expectNoChannelTouched(sessionRoot);
  });
});

it('B4 包级摘要复算不合（安装后篡改）→ integrity/package-hash-mismatch 且零通道零执行', async () => {
  await withLoader(async (loader, sessionRoot) => {
    const workspace = await makeWorkspace('chips-w1-tamper-');
    const root = join(workspace, 'plugin');
    await writeTree(root, positiveTree());
    const pristineHash = await packageHashOf(root);
    // 模拟安装后篡改：磁盘入口被追加注入语句，注册表期望摘要仍为原始值。
    await writeFile(join(root, MODULE_LOADER_ENTRY_FILE), POSITIVE_ENTRY + '\nexport const injected = 1;\n');
    const error = await captureRejection(
      loader.loadModule({
        pluginId: 'com.chips.wave1.tampered',
        rootDir: root,
        expectedPackageHash: pristineHash,
      }),
    );
    const details = expectGateFailure(error, 'integrity', 'package-hash-mismatch');
    expect(details.expected).toBe(pristineHash);
    expect(typeof details.actual).toBe('string');
    expect(details.actual).not.toBe(pristineHash);
    expect(details.actual).toBe(await packageHashOf(root));
    // 篡改复算必须复用门禁同源的 signature 实现（sha256: 前缀 + 64 hex）。
    expect(String(details.actual)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expectNoChannelTouched(sessionRoot);
  });
});

it('B5 入口超 8 MiB → entry/entry-too-large', async () => {
  await withLoader(async (loader, sessionRoot) => {
    const workspace = await makeWorkspace('chips-w1-huge-');
    const root = join(workspace, 'plugin');
    const padding = 'a'.repeat(CPK_LIMITS.entryFileBytes + 1024);
    await writeTree(root, {
      [MODULE_LOADER_ENTRY_FILE]: `export const pad = '${padding}';\n`,
    });
    const error = await captureRejection(
      loader.loadModule({
        pluginId: 'com.chips.wave1.huge',
        rootDir: root,
        expectedPackageHash: await packageHashOf(root),
      }),
    );
    const details = expectGateFailure(error, 'entry', 'entry-too-large');
    expect(details.limit).toBe(CPK_LIMITS.entryFileBytes);
    expect(Number(details.bytes)).toBeGreaterThan(CPK_LIMITS.entryFileBytes);
    expectNoChannelTouched(sessionRoot);
  });
});

it('B6 入口非 UTF-8 → entry/entry-not-utf8', async () => {
  await withLoader(async (loader, sessionRoot) => {
    const workspace = await makeWorkspace('chips-w1-utf8-');
    const root = join(workspace, 'plugin');
    const invalidBytes = Buffer.concat([
      Buffer.from('export const pad = "', 'utf8'),
      Buffer.from([0xff, 0xfe, 0xff, 0x80, 0x80]),
      Buffer.from('";\n', 'utf8'),
    ]);
    await writeTree(root, { [MODULE_LOADER_ENTRY_FILE]: invalidBytes });
    const error = await captureRejection(
      loader.loadModule({
        pluginId: 'com.chips.wave1.badutf',
        rootDir: root,
        expectedPackageHash: await packageHashOf(root),
      }),
    );
    expectGateFailure(error, 'entry', 'entry-not-utf8');
    expectNoChannelTouched(sessionRoot);
  });
});

it('B7 入口非 ESM（CJS 形态）→ entry/entry-not-esm', async () => {
  await withLoader(async (loader, sessionRoot) => {
    const workspace = await makeWorkspace('chips-w1-cjs-');
    const root = join(workspace, 'plugin');
    await writeTree(root, {
      [MODULE_LOADER_ENTRY_FILE]: 'const notEsm = 42;\nmodule.exports = notEsm;\n',
    });
    const error = await captureRejection(
      loader.loadModule({
        pluginId: 'com.chips.wave1.cjs',
        rootDir: root,
        expectedPackageHash: await packageHashOf(root),
      }),
    );
    expectGateFailure(error, 'entry', 'entry-not-esm');
    expectNoChannelTouched(sessionRoot);
  });
});

it('B8 源树含符号链接 → integrity/unsafe-source-tree（provider 同源判定，原码留痕）', async () => {
  await withLoader(async (loader, sessionRoot) => {
    const workspace = await makeWorkspace('chips-w1-sym-');
    const root = join(workspace, 'plugin');
    await writeTree(root, positiveTree());
    await symlink(join(workspace, 'evil.mjs'), join(root, 'dist', 'link.js'));
    const error = await captureRejection(
      loader.loadModule({
        pluginId: 'com.chips.wave1.sym',
        rootDir: root,
        // 符号链接使 loadCpkDirectory 先行抛拒，期望摘要取合法值即可（不参与判定顺序）。
        expectedPackageHash: `sha256:${sha256Hex(new Uint8Array(0))}`,
      }),
    );
    const details = expectGateFailure(error, 'integrity', 'unsafe-source-tree');
    expect(details.causeCode).toBe('CPK_PATH_UNSAFE');
    expectNoChannelTouched(sessionRoot);
  });
});

// ---------------------------------------------------------------------------
// C 组：通道 fail-closed（被托管 import 管线内绝不静默无门禁装载）
// ---------------------------------------------------------------------------

it('C1 导入被 vite-node 代管（ESM 钩子不触发）时真实拒装 stage=channel', async () => {
  // 开工实测坐实：vitest 管线下 `import()` 被 vite-node 代管、`module.register` 钩子不触发。
  // 生产语义要求此时 fail-closed——canary 验证不过即拒装，不得把「钩子旁路装载成功」当结果。
  await withLoader(async (loader, sessionRoot) => {
    const workspace = await makeWorkspace('chips-w1-channel-');
    const root = join(workspace, 'plugin');
    await writeTree(root, positiveTree());
    const error = await captureRejection(
      loader.loadModule({
        pluginId: 'com.chips.wave1.channel',
        rootDir: root,
        expectedPackageHash: await packageHashOf(root),
      }),
    );
    expectGateFailure(error, 'channel', 'not-live');
    expect(sessionRoot, '通道建立后才可判定 not-live').toBeDefined();
    expect(existsSync(sessionRoot)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// D 组：原生机制实测（真 Node 子进程 × 生产 API）
// ---------------------------------------------------------------------------

type NativeOp =
  | { op: 'create'; as: string; sessionRoot: string }
  | { op: 'load'; as: string; pluginId: string; rootDir: string; expectedPackageHash: string }
  | { op: 'rawImport'; as: string; url: string }
  | {
      op: 'writeFile';
      as: string;
      path: string;
      text: string;
    }
  | { op: 'appendFile'; as: string; path: string; text: string }
  | { op: 'snapshotGlobals'; as: string; names: string[] }
  | { op: 'dispose'; as: string };

async function runNativeCases(ops: readonly NativeOp[]): Promise<NativeDoc> {
  const workspace = await makeWorkspace('chips-w1-native-');
  const argsPath = join(workspace, 'args.json');
  const outFile = join(workspace, 'out.json');
  await writeFile(
    argsPath,
    JSON.stringify({ loaderSource: LOADER_SOURCE_PATH, outFile, ops }),
  );
  try {
    await execFileAsync(process.execPath, [HARNESS_PATH, argsPath], {
      env: {},
      timeout: 100_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    if (!existsSync(outFile)) {
      const detail = error instanceof Error ? `${error.message}\nstderr: ${(error as { stderr?: string }).stderr ?? ''}` : String(error);
      throw new Error(`原生实测子进程未产出结果文件：${detail}`);
    }
  }
  const doc = JSON.parse(await readFile(outFile, 'utf8')) as NativeDoc;
  expect(doc.fatal, `子进程夹具级致命错误：${JSON.stringify(doc.fatal)}`).toBeNull();
  return doc;
}

it(
  'D1 正向装载求值 + nonce 复加载重门禁 + 篡改双层拒 + 门面封顶 + dispose 拒装（原生机制）',
  async () => {
    const workspace = await makeWorkspace('chips-w1-d1-');
    const root = join(workspace, 'plugins', 'positive');
    await writeTree(root, positiveTree());
    const hash = await packageHashOf(root);
    const entryFsPath = join(root, MODULE_LOADER_ENTRY_FILE);
    const helperFsPath = join(root, 'dist', 'helper.js');

    const ops: NativeOp[] = [
      { op: 'create', as: 'create', sessionRoot: join(workspace, 'sessions') },
      { op: 'load', as: 'load1', pluginId: 'com.chips.wave1.positive', rootDir: root, expectedPackageHash: hash },
      { op: 'load', as: 'load2', pluginId: 'com.chips.wave1.positive', rootDir: root, expectedPackageHash: hash },
      { op: 'appendFile', as: 'tamper', path: helperFsPath, text: '\nexport const injected = 1;\n' },
      { op: 'load', as: 'load3', pluginId: 'com.chips.wave1.positive', rootDir: root, expectedPackageHash: hash },
      { op: 'rawImport', as: 'rogueEntry', url: `${pathToFileURL(entryFsPath).href}?chips-nonce=rogue-1` },
      { op: 'writeFile', as: 'addExtra', path: join(root, 'dist', 'extra.js'), text: 'export const extra = 1;\n' },
      {
        op: 'rawImport',
        as: 'rogueExtra',
        url: `${pathToFileURL(join(root, 'dist', 'extra.js')).href}?chips-nonce=rogue-2`,
      },
      { op: 'snapshotGlobals', as: 'markers', names: ['__POS_EVAL__'] },
      { op: 'dispose', as: 'dispose' },
      { op: 'load', as: 'loadDisposed', pluginId: 'com.chips.wave1.positive', rootDir: root, expectedPackageHash: hash },
    ];
    const doc = await runNativeCases(ops);

    // 正向装载：入口求值、命名空间冻结快照（门面封顶：只含插件自身导出；
    // ESM 作用域无 require/module/exports/__dirname）。
    const load1 = resultOf(doc, 'load1') as LoadOk;
    expect(load1.ok).toBe(true);
    expect(load1.exportKeys).toEqual(['default', 'marker']);
    expect(load1.exportsFrozen).toBe(true);
    expect(load1.defaultKind).toBe('function');
    expect(load1.defaultResult).toEqual({
      token: 'positive',
      evalCount: 1,
      helper: 'h',
      typeofRequire: 'undefined',
      typeofModule: 'undefined',
      typeofExports: 'undefined',
      typeofDirname: 'undefined',
    });
    // 双门禁计数：entry + helper 各过一次 resolve/load（8 项之内的图规模）。
    expect(load1.gateStats).toEqual({ resolveAllow: 2, resolveReject: 0, loadAllow: 2, loadReject: 0 });
    expect(load1.entryUrl).toContain(`?chips-nonce=${load1.nonce}`);

    // nonce 复加载：新缓存键、模块体重执行、每个模块重新过 resolve/load 双门禁。
    const load2 = resultOf(doc, 'load2') as LoadOk;
    expect(load2.ok).toBe(true);
    expect(load2.nonce).not.toBe(load1.nonce);
    expect(load2.defaultResult?.evalCount).toBe(2);
    expect(load2.gateStats).toEqual({ resolveAllow: 2, resolveReject: 0, loadAllow: 2, loadReject: 0 });

    // 篡改后复装载：宿主侧包级复算先行拒（integrity 层），无任何半执行。
    const load3 = resultOf(doc, 'load3') as LoadFail;
    expect(load3.ok).toBe(false);
    expectWireFailure(load3.wire, 'integrity', 'package-hash-mismatch');

    // 钩子级复算（TOCTOU 防层的真实触发）：绕过 loadModule 直 import 已登记作用域，
    // load 钩逐文件复算仍拒（file-hash-mismatch）——门禁不因「激活期已结束」失效。
    const rogueEntry = resultOf(doc, 'rogueEntry') as { ok: boolean; wire?: WireShape; keys?: string[] };
    expect(rogueEntry.ok).toBe(false);
    expect(rogueEntry.wire?.message).toContain('file-hash-mismatch');

    // 清单外新文件（安装后插入）：未登记摘要即拒（unmanifested-file）。
    const rogueExtra = resultOf(doc, 'rogueExtra') as { ok: boolean; wire?: WireShape };
    expect(rogueExtra.ok).toBe(false);
    expect(rogueExtra.wire?.message).toContain('unmanifested-file');

    // 篡改后三次装载全部失败：模块体执行计数停在 2（无半执行、无额外执行）。
    const markers = resultOf(doc, 'markers') as Record<string, unknown>;
    expect(markers.__POS_EVAL__).toBe(2);

    // dispose 后拒装：stage=channel / reason=disposed。
    const loadDisposed = resultOf(doc, 'loadDisposed') as LoadFail;
    expect(loadDisposed.ok).toBe(false);
    expectWireFailure(loadDisposed.wire, 'channel', 'disposed');
  },
  120_000,
);

it(
  'D2 四越界 specifier 逐码拒 + 绝对路径/非 JS 模块/缺子模块/语法错误（原生机制，插件体零执行）',
  async () => {
    const workspace = await makeWorkspace('chips-w1-d2-');
    await writeTree(join(workspace, 'outside-scope'), { 'escape-target.mjs': OUTSIDE_TARGET });
    const pluginDirs: Record<string, Record<string, string | Buffer>> = {
      'wl-node': {
        [MODULE_LOADER_ENTRY_FILE]: gatedEntry('__RAN_WL_NODE__', "import { readFileSync } from 'node:fs';"),
      },
      'wl-electron': {
        [MODULE_LOADER_ENTRY_FILE]: gatedEntry('__RAN_WL_ELECTRON__', "import { app } from 'electron';"),
      },
      'wl-bare': {
        [MODULE_LOADER_ENTRY_FILE]: gatedEntry('__RAN_WL_BARE__', "import { pick } from 'lodash-es';"),
      },
      'wl-escape': {
        [MODULE_LOADER_ENTRY_FILE]: gatedEntry(
          '__RAN_WL_ESCAPE__',
          "import escape from '../../../outside-scope/escape-target.mjs';",
        ),
      },
      'wl-abs': {
        [MODULE_LOADER_ENTRY_FILE]: gatedEntry(
          '__RAN_WL_ABS__',
          "import victim from '/chips-w1-abs-definitely-outside-target.js';",
        ),
      },
      'wl-json': {
        [MODULE_LOADER_ENTRY_FILE]: gatedEntry('__RAN_WL_JSON__', "import data from './data.json';"),
        'dist/data.json': '{"a":1}\n',
      },
      'missing-child': {
        [MODULE_LOADER_ENTRY_FILE]: gatedEntry('__RAN_MISSING_CHILD__', "import './nope.js';"),
      },
      'parse-error': {
        [MODULE_LOADER_ENTRY_FILE]: 'export const broken = ;\n',
      },
    };

    const ops: NativeOp[] = [{ op: 'create', as: 'create', sessionRoot: join(workspace, 'sessions') }];
    for (const [name, files] of Object.entries(pluginDirs)) {
      const root = join(workspace, 'plugins', name);
      await writeTree(root, files);
      ops.push({
        op: 'load',
        as: name,
        pluginId: `com.chips.wave1.${name}`,
        rootDir: root,
        expectedPackageHash: await packageHashOf(root),
      });
    }
    ops.push({
      op: 'snapshotGlobals',
      as: 'markers',
      names: [
        '__RAN_WL_NODE__',
        '__RAN_WL_ELECTRON__',
        '__RAN_WL_BARE__',
        '__RAN_WL_ESCAPE__',
        '__RAN_WL_ABS__',
        '__RAN_WL_JSON__',
        '__RAN_MISSING_CHILD__',
        '__RAN_ESCAPE__',
      ],
    });
    const doc = await runNativeCases(ops);

    // RFC §5.1 行 1：白名单越界 specifier → KERNEL_APPLY_FAILED + stage=whitelist，
    // details 携带 pluginId 与 specifier，进门禁即失败路径。
    const cases: readonly [name: string, reason: string, specifier?: string][] = [
      ['wl-node', 'node-builtin', 'node:fs'],
      ['wl-electron', 'electron', 'electron'],
      ['wl-bare', 'bare-specifier', 'lodash-es'],
      ['wl-escape', 'scope-escape', "../../../outside-scope/escape-target.mjs"],
      ['wl-abs', 'absolute-path', '/chips-w1-abs-definitely-outside-target.js'],
      ['wl-json', 'unsupported-module-type', "./data.json"],
    ];
    for (const [name, reason, specifier] of cases) {
      const outcome = resultOf(doc, name) as LoadFail;
      expect(outcome.ok, `${name} 必须拒装`).toBe(false);
      const details = expectWireFailure(outcome.wire, 'whitelist', reason);
      expect(details.pluginId).toBe(`com.chips.wave1.${name}`);
      if (specifier !== undefined) {
        expect(details.specifier).toBe(specifier);
      }
      const stats = details.gateStats as GateStats;
      expect(stats.resolveReject).toBe(1);
      expect(stats.loadReject).toBe(0); // resolve 层拦截，尚未走到 load。
    }

    // RFC §5.1 行 3：入口不可解析（子模块缺失、ESM 语法错误）→ stage=entry。
    const missing = resultOf(doc, 'missing-child') as LoadFail;
    expect(missing.ok).toBe(false);
    expectWireFailure(missing.wire, 'entry', 'module-not-found');
    const parse = resultOf(doc, 'parse-error') as LoadFail;
    expect(parse.ok).toBe(false);
    expectWireFailure(parse.wire, 'entry', 'parse-failure');

    // 「本次启用失败且不执行任何插件代码」（03.05:24）：全部越界体标记与逃逸目标零执行。
    const markers = resultOf(doc, 'markers') as Record<string, unknown>;
    for (const marker of Object.keys(markers)) {
      expect(markers[marker], `越界插件体不得执行：${marker}`).toBeNull();
    }
  },
  120_000,
);
