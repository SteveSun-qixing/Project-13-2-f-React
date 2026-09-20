/**
 * CLI 链进程级 E2E 公共支撑（任务 #88，P1-7 前段）。
 *
 * 口径：一律 spawn 真实可执行入口（`packages/cli/dist/bin.js`，经 `node` 直跑，
 * 与发行包内 `chips` bin 同一文件），禁止 import `@chips/cli` 内部函数走捷径；
 * 断言只认退出码、stdout 错误信封 `code` 与磁盘产物，不匹配 `error` 文案
 * （《06-开发与运维/07-CLI完整参考》§2.5「脚本必须以退出码与 code 判定结果」）。
 *
 * 隔离：每个套件在 `os.tmpdir()` 下以 `chips-cli-e2e-` 前缀创建独立临时工作区，
 * 套件结束（`afterAll`）无条件清理；宿主应用与本套件无关，不适用
 * `CHIPS_E2E_REQUIRE_APP` 门控，本链任何用例都不得默认 skip。
 */

import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'vitest';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** 临时目录统一前缀（便于识别与兜底清理）。 */
export const TEMP_PREFIX = 'chips-cli-e2e-';

/** 会污染被测进程环境的 CLI 相关变量，基线构造时一律清除。 */
const CONTROLLED_ENV_KEYS: readonly string[] = [
  'CHIPS_WORKSPACE',
  'CHIPS_SIGNING_KEY_FILE',
  'CHIPS_TRUST_ROOTS_FILE',
  'CHIPS_LOG_LEVEL',
  'CHIPS_TRACE',
  'CHIPS_CLI_JOB_PROGRESS',
];

/** 解析 `chips-ecosystem/` 工作区根目录。 */
export function resolveEcosystemRoot(): string {
  return path.resolve(MODULE_DIR, '..', '..', '..', '..', '..');
}

/** 被测 CLI 可执行入口（构建产物；发行包内 `chips` 即指向该文件）。 */
export function resolveCliBin(): string {
  const bin = path.join(resolveEcosystemRoot(), 'packages', 'cli', 'dist', 'bin.js');
  if (!existsSync(bin)) {
    throw new Error(
      `@chips/cli 可执行入口未构建：${bin}。请先执行 pnpm --filter @chips/cli run build（或 pnpm build）。`
    );
  }
  return bin;
}

/** CLI 进程运行结果。 */
export interface ICliRun {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** `runChips` 选项。 */
export interface IRunOptions {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/** 构造基线进程环境：继承当前环境并清除全部 `CHIPS_*` 控制变量，保证用例互不串扰。 */
export function baseEnv(
  overrides: Readonly<Record<string, string | undefined>> = {}
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of CONTROLLED_ENV_KEYS) {
    delete env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
  return env;
}

/** 以真实子进程运行 `chips`。 */
export function runChips(args: readonly string[], options: IRunOptions): ICliRun {
  const result = spawnSync(process.execPath, [resolveCliBin(), ...args], {
    cwd: options.cwd,
    env: baseEnv(options.env),
    encoding: 'utf8',
  });
  if (result.error !== undefined) {
    throw new Error(`chips 子进程启动失败：${result.error.message}`);
  }
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/** 以真实子进程运行 pnpm（临时工作区 install / build 步骤）。 */
export function runPnpm(args: readonly string[], cwd: string): ICliRun {
  const result = spawnSync('pnpm', args, { cwd, encoding: 'utf8' });
  if (result.error !== undefined) {
    throw new Error(
      `pnpm 子进程启动失败：${result.error.message}。CLI 链 E2E 需要 PATH 中可用的 pnpm（ volta/corepack 均可），缺失即失败，不做 skip。`
    );
  }
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/** §2.6 错误信封形状。 */
export interface IErrorEnvelope {
  readonly error: string;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;
}

/** 解析 stdout 为单个 JSON 值；非法即断言失败。 */
export function parseJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    throw new Error(`stdout 不是合法 JSON：${stdout.slice(0, 200)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 断言失败输出：退出码符合预期，且 stdout 为单个 §2.6 错误信封
 * （`error`/`code` 必备、`retryable` 恒带、`exitCode` 永不进入输出）。
 */
export function expectFailure(run: ICliRun, code: string, exitCode: number): IErrorEnvelope {
  expectRunFailedShape(run);
  const parsed = parseJson(run.stdout);
  if (!isRecord(parsed)) {
    throw new Error(`错误信封不是对象：${run.stdout.slice(0, 200)}`);
  }
  expect(run.exitCode, `期望退出码 ${exitCode}，实际 ${run.exitCode}：${run.stdout}`).toBe(
    exitCode
  );
  if (typeof parsed.error !== 'string' || parsed.error.length === 0) {
    throw new Error(`错误信封缺少非空 error 字段：${run.stdout.slice(0, 200)}`);
  }
  expect(parsed.code).toBe(code);
  expect(typeof parsed.retryable).toBe('boolean');
  if ('exitCode' in parsed) {
    throw new Error('exitCode 不得进入输出信封（§2.6）');
  }
  if (parsed.details !== undefined && !isRecord(parsed.details)) {
    throw new Error('details 存在时必须为对象');
  }
  return parsed as unknown as IErrorEnvelope;
}

/** 断言成功输出为单个 JSON 值（`--json` 链路），且 `exitCode` 永不进入输出（§2.6）。 */
export function expectSuccessJson(run: ICliRun, exitCode = 0): unknown {
  if (run.exitCode !== exitCode) {
    throw new Error(
      `期望退出码 ${exitCode}，实际 ${run.exitCode}。stdout=${run.stdout.slice(0, 400)} stderr=${run.stderr.slice(0, 400)}`
    );
  }
  const parsed = parseJson(run.stdout);
  if (isRecord(parsed) && 'exitCode' in parsed) {
    throw new Error('exitCode 不得进入输出（§2.6）');
  }
  return parsed;
}

function expectRunFailedShape(run: ICliRun): void {
  if (run.exitCode === 0) {
    throw new Error(`期望失败但退出 0：stdout=${run.stdout.slice(0, 200)}`);
  }
}

/** 断言信封 `code` 之外的快速通道：只取 code。 */
export function failureCode(run: ICliRun): string | undefined {
  if (run.exitCode === 0) {
    return undefined;
  }
  const parsed = parseJson(run.stdout);
  return isRecord(parsed) && typeof parsed.code === 'string' ? parsed.code : undefined;
}

/** 镜像工作区临时根布局（模拟仓库「tsconfig.base.json 在根 + 成员两层落位」契约）。 */
export interface IMirroredWorkspace {
  readonly root: string;
  readonly generatedDir: string;
}

const MIRRORED_MEMBERS: readonly (readonly [string, string])[] = [
  ['packages/sdk', 'pkgs/sdk'],
  ['packages/bridge', 'pkgs/bridge'],
  ['packages/ui', 'pkgs/ui'],
  ['packages/antd', 'pkgs/antd'],
  ['packages/cli', 'pkgs/cli'],
  ['tools/scaffold', 'pkgs/tool-scaffold'],
  ['tools/testing', 'pkgs/tool-testing'],
];

/** 创建临时镜像工作区：仓库 `tsconfig.base.json` 与 @chips 成员快照落在临时根内。 */
export function createMirroredWorkspace(kind: string): IMirroredWorkspace {
  const root = mkdtempSync(path.join(tmpdir(), `${TEMP_PREFIX}${kind}-`));
  const ecosystemRoot = resolveEcosystemRoot();
  copyFileSync(
    path.join(ecosystemRoot, 'tsconfig.base.json'),
    path.join(root, 'tsconfig.base.json')
  );
  for (const [source, target] of MIRRORED_MEMBERS) {
    cpSync(path.join(ecosystemRoot, source), path.join(root, target), {
      recursive: true,
      filter: (src: string): boolean => {
        const relative = path.relative(path.join(ecosystemRoot, source), src);
        const segment = relative.split(path.sep)[0] ?? '';
        return segment !== 'node_modules' && segment !== 'coverage' && segment !== 'reports';
      },
    });
  }
  writeFileSync(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'chips-cli-e2e-root', private: true, version: '0.0.0' }, null, 2)}\n`
  );
  writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - generated/*\n  - pkgs/*\n');
  const generatedDir = path.join(root, 'generated');
  mkdirSync(generatedDir, { recursive: true });
  return { root, generatedDir };
}

/** 创建独立临时目录（不落镜像工作区的轻量用例使用）。 */
export function makeTempDir(kind: string): string {
  return mkdtempSync(path.join(tmpdir(), `${TEMP_PREFIX}${kind}-`));
}

/** 递归删除临时目录（`afterAll` 清理入口）。 */
export function cleanupTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/** 测试签名密钥与信任注册资产。 */
export interface ISigningAssets {
  readonly privateKeyFile: string;
  readonly trustRootsFile: string;
  readonly foreignPrivateKeyFile: string;
  readonly foreignTrustRootsFile: string;
}

/**
 * 在临时目录内生成两对一次性 Ed25519 密钥：
 * 主密钥对用于真实签名打包与信任根注入；对外密钥对用于「keyId 未注册」负例。
 */
export function createSigningAssets(dir: string, keyId: string): ISigningAssets {
  const keysDir = path.join(dir, 'keys');
  mkdirSync(keysDir, { recursive: true });
  const primary = generateEd25519PemPair();
  const foreign = generateEd25519PemPair();
  const privateKeyFile = path.join(keysDir, 'chain-private.pem');
  const foreignPrivateKeyFile = path.join(keysDir, 'foreign-private.pem');
  const trustRootsFile = path.join(keysDir, 'trust-roots.json');
  const foreignTrustRootsFile = path.join(keysDir, 'foreign-trust-roots.json');
  writeFileSync(privateKeyFile, primary.privateKey);
  writeFileSync(foreignPrivateKeyFile, foreign.privateKey);
  writeFileSync(trustRootsFile, trustRootsDocument(keyId, primary.publicKey));
  writeFileSync(foreignTrustRootsFile, trustRootsDocument(keyId, foreign.publicKey));
  return { privateKeyFile, trustRootsFile, foreignPrivateKeyFile, foreignTrustRootsFile };
}

function generateEd25519PemPair(): { privateKey: string; publicKey: string } {
  const pair = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return { privateKey: pair.privateKey, publicKey: pair.publicKey };
}

/** 信任注册文件（§2.7 严格 schema：version=1，未知字段拒绝）。 */
export function trustRootsDocument(keyId: string, publicKeyPem: string): string {
  return `${JSON.stringify({ version: 1, trustRoots: { [keyId]: publicKeyPem } }, null, 2)}\n`;
}

/** 文件 SHA-256（十六进制，不带 `sha256:` 前缀）。 */
export function sha256File(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** 读取文本文件。 */
export function readTextFile(file: string): string {
  return readFileSync(file, 'utf8');
}

/** 判断文件存在。 */
export function fileExists(file: string): boolean {
  return existsSync(file);
}
