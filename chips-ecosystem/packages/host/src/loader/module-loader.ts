/**
 * ModuleLoader：主进程插件 JS 的受管模块加载器（完整性门禁 + 白名单，
 * 《03-插件架构设计》§5.2；RFC-插件执行通道与ModuleLoader裁定 §3.2/§3.3 方案 A × M2）。
 *
 * 权威：`01-架构设计/01-子系统设计/03.03-插件架构设计` §5.2（受管加载器条款：只允许加载
 * 插件作用域的 `chips-resource://` 模块与平台白名单模块，禁止 `node:*`、`electron`、
 * 裸路径与任意文件路径；加载前校验模块来源与完整性摘要，越界加载或校验失败一律拒绝，
 * 本次启用失败且不执行任何插件代码）；执行机制取 RFC §3.3 裁定的 M2 形态
 * （动态 `import()` + `module.register()` ESM resolve/load 双钩），波 0 三口径实测
 * 终局见 `项目日志与笔记/RFC-插件执行通道与ModuleLoader裁定/验证/波0-机制实测终局报告.md`。
 *
 * @remarks
 * - **门禁落位**：resolve 钩 = 白名单判定（插件出边只允许相对路径的 `.js`/`.mjs` 模块，
 *   且解析结果必须落在本插件根内——`node:*`、`electron`、裸路径、绝对路径、`../` 作用域
 *   逃逸、跨插件路径全部真实抛拒，插件体零执行）；load 钩 = 完整性门禁（逐文件 SHA-256
 *   复算比对激活期登记摘要、8 MiB 体积上限、UTF-8 严格解码、ESM 同源判定后以
 *   `format: 'module'` 交源）。包级合并摘要复算（`signature.ts` `computeContentHash`
 *   同源）在宿主侧、任何 import 之前执行：与注册表期望摘要不合即确定性拒装，无半执行状态。
 * - **复加载 nonce**：每次激活以 `?chips-nonce=<uuid>` 查询串穿透 ESM 缓存（波 0 实测：
 *   同 URL 复 import 会被实例化层缓存遮蔽，复加载必须换 nonce），并把 nonce 传播到插件
 *   图内全部子模块，使每次装载的每个模块都重新过 resolve/load 双门禁。
 * - **钩子线程通信硬约束**（波 0 实测裁定）：Electron 主进程下 `module.register()` 返回
 *   `undefined`，本实现不依赖返回端口——门禁素材经 `initialize(data)` 投递文件侧信道
 *   路径，钩子线程每次事件自行读取门闸文件（`gate.json`，宿主原子重写）并留痕事件文件
 *   （`gate-events.jsonl`），宿主↔钩子零 MessagePort。
 * - **通道活性 fail-closed**：首次装载前以 canary 模块验证「动态 import 确实经过钩子链」
 *   ——在被模块图改写（如打包器/测试运行器代管 import）的执行环境中钩子不会触发，此时
 *   装载直接失败（`details.stage='channel'`），绝不静默降级为无门禁加载。
 * - **错误码纪律**（RFC §5.1/§十 O1 暂定裁定）：全部失败只使用在册
 *   `LIFECYCLE_ERROR_CODES.applyFailed`（`KERNEL_APPLY_FAILED`），阶段与原因经
 *   `details.stage` / `details.reason` 结构化承载，零新增码、零自造码；
 *   `retryable: true` 对确定性拒装的语义钝差为 O1 在册登记项，本实现不改码表。
 * - **门面封顶**（RFC §3.2.3，§8.7 条 2 的壳侧镜像）：插件模块图在原生 ESM 作用域求值
 *   （无 `require`/`module`/`exports`/`__dirname` 注入），加载器不向插件传递任何宿主对象；
 *   宿主侧取回的入口命名空间投影为冻结快照，只含插件自身导出。
 * - 信任锚定：`expectedPackageHash` 即注册表记录 `hash` 的包级合并摘要口径
 *   （`types.ts` `IPluginRecord.hash`）；归档态记录携带的是整包归档字节摘要，安装后目录
 *   重放合并摘要需要安装期落盘清单（波 2/3 与 O1 统筹的接口缝，见交单），本模块按
 *   「调用方递交包级合并摘要」契约编程。
 */

import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { LIFECYCLE_ERROR_CODES } from './codes.js';
import { LoaderError, throwCpkError } from './errors.js';
import { CPK_LIMITS } from './limits.js';
import { loadCpkDirectory, membersToZipEntries, type ICpkPackage } from './provider.js';
import { computeContentHash, sha256Hex } from './signature.js';

/** 主进程模块入口固定文件名（《03-插件包格式》§5.2 与 `validate.ts` 同源契约）。 */
export const MODULE_LOADER_ENTRY_FILE = 'dist/index.js';

/**
 * 门禁失败阶段（RFC §5.1 表 ModuleLoader 三行 + 通道活性）：
 * `whitelist`=白名单越界、`integrity`=完整性门禁、`entry`=入口超限/不可解析、
 * `channel`=加载通道本身不可信（fail-closed）。
 */
export type ModuleLoadGateStage = 'whitelist' | 'integrity' | 'entry' | 'channel';

/** 一次受管装载的目标（注册表记录中的加载必需投影）。 */
export interface ICpkModuleLoadTarget {
  /** 插件 ID（反向域名；仅用于诊断留痕）。 */
  readonly pluginId: string;
  /** 插件安装目录绝对路径（`IPluginRecord.path`）。 */
  readonly rootDir: string;
  /** 期望的包级合并摘要（`sha256:` + 64 位十六进制，`computeContentHash` 同源口径）。 */
  readonly expectedPackageHash: string;
}

/** 一次装载的门禁事件计数（从钩子事件侧信道按本次 nonce 汇总，`03.05:24` 留痕面）。 */
export interface ICpkModuleGateStats {
  readonly resolveAllow: number;
  readonly resolveReject: number;
  readonly loadAllow: number;
  readonly loadReject: number;
}

/** 装载成功结果（入口命名空间的冻结快照 + 诊断投影）。 */
export interface ICpkModuleLoadResult {
  readonly pluginId: string;
  /** 本次激活的复加载 nonce（URL 查询串 `chips-nonce` 值）。 */
  readonly nonce: string;
  /** 入口模块最终解析 URL（含 nonce 查询串）。 */
  readonly entryUrl: string;
  /**
   * 入口命名空间冻结快照：只含插件自身导出（门面封顶）；
   * 角色形状判定（`default` 导出与角色契约方法）归波 2 角色适配器。
   */
  readonly exports: Readonly<Record<string, unknown>>;
  readonly gateStats: ICpkModuleGateStats;
}

/** ModuleLoader 实例面。 */
export interface ICpkModuleLoader {
  /**
   * 受管装载一个插件入口模块（完整性门禁 + 白名单 + nonce 复加载）。
   *
   * 同一实例上的并发调用按提交顺序串行执行（门闸文件为实例级单激活槽）。
   *
   * @throws {LoaderError} 任一门禁失败一律 `KERNEL_APPLY_FAILED`（`details.stage` /
   *   `details.reason` 结构化定位；RFC §5.1），且插件代码零执行或无半执行状态残留。
   */
  loadModule(target: ICpkModuleLoadTarget): Promise<ICpkModuleLoadResult>;
  /** 释放会话（关闭后续装载、清理钩子线程侧的临时会话目录）。幂等。 */
  dispose(): void;
  /** 是否已释放。 */
  readonly disposed: boolean;
}

/** 构造选项。 */
export interface ICreateCpkModuleLoaderOptions {
  /** 会话目录根（缺省 `os.tmpdir()`；每实例 `mkdtemp` 独占子目录）。 */
  readonly sessionRoot?: string;
}

/** 钩子抛拒消息的可解析前缀（宿主侧解码 → 登记码归一）。 */
const GATE_REJECT_PREFIX = 'CHIPS_MODULE_GATE ';

/** ESM 同源判定（与 `validate.ts` `assertEntryModule` 的字面同源，漂移锁见波 1 测试）。 */
const ESM_TOKEN_PATTERN = /\b(export|import)\b/;

/** 钩子侧 reason → 门禁阶段映射（RFC §5.1 三行的 reason 词表）。 */
const GATE_REASON_STAGE: Readonly<Record<string, ModuleLoadGateStage>> = {
  'node-builtin': 'whitelist',
  electron: 'whitelist',
  'bare-specifier': 'whitelist',
  'absolute-path': 'whitelist',
  'scope-escape': 'whitelist',
  'unsupported-module-type': 'whitelist',
  'file-hash-mismatch': 'integrity',
  'unmanifested-file': 'integrity',
  'file-missing': 'integrity',
  'module-too-large': 'entry',
  'not-utf8': 'entry',
  'not-esm': 'entry',
  'invalid-url': 'entry',
};

/**
 * ESM 自定义钩子（resolve/load 双钩）源码——生产实现的一部分，运行于
 * `module.register()` 派生的独立钩子线程；门禁素材经 `initialize(data)` 投递
 * 侧信道文件路径，每次事件实时读取（波 0 硬约束：不得依赖 `register()` 返回端口）。
 *
 * 以字符串自包含交付：打包态（vite 捆绑主进程）下钩子文件必须由本模块在会话目录
 * 落盘后注册，不接受旁置静态资源（构建配置不在本波文件面）。
 */
const HOOK_SOURCE = `
// chips-module-loader hooks (generated by module-loader.ts; do not edit on disk)
import { readFileSync, appendFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PREFIX = ${JSON.stringify(GATE_REJECT_PREFIX)};
const ESM_TOKEN = ${String(ESM_TOKEN_PATTERN)};
let cfg = null;

export function initialize(data) {
  cfg = data;
}

// 作用域判定的 URL 归一：macOS 等平台 tmpdir 存在符号链接变体（/var → /private/var），
// 宿主递交的 file URL 若走别名链会绕过前缀判定；入口处统一实路径（解析失败按原样走
// 默认判定，由 load 钩的逐文件复算兜底）。
function canonFileUrl(urlLike) {
  const text = String(urlLike);
  if (!text.startsWith('file:')) return text;
  try {
    const [base, query] = [text.split('?')[0], text.includes('?') ? '?' + text.split('?').slice(1).join('?') : ''];
    return pathToFileURL(realpathSync(fileURLToPath(base))).href + query;
  } catch {
    return text;
  }
}

function readGate() {
  try {
    const doc = JSON.parse(readFileSync(cfg.gateFile, 'utf8'));
    return doc && typeof doc === 'object' ? doc : null;
  } catch {
    return null;
  }
}

function logEvent(obj) {
  try {
    appendFileSync(cfg.eventsFile, JSON.stringify(obj) + '\\n');
  } catch {
    // 留痕通道故障不得反向放大门禁语义：事件文件缺失时静默（拒装仍以抛拒为准）。
  }
}

function scopeOf(gate, url) {
  if (typeof url !== 'string') return null;
  for (const scope of Object.values(gate.scopes)) {
    if (url.startsWith(scope.rootUrl)) return scope;
  }
  return null;
}

function nonceOf(url) {
  if (typeof url !== 'string') return null;
  const match = /[?&]chips-nonce=([^&]+)/.exec(url);
  return match === null ? null : match[1];
}

function reject(gate, scope, reason, phase, detail) {
  logEvent({
    ev: 'reject',
    reason,
    phase,
    pluginId: scope === null ? null : scope.pluginId,
    nonce: gate && gate.active ? gate.active.nonce : null,
    ...detail,
  });
  throw new Error(PREFIX + JSON.stringify({ reason, phase, pluginId: scope === null ? null : scope.pluginId, ...detail }));
}

function classifySpecifier(specifier) {
  if (specifier.startsWith('./') || specifier.startsWith('../')) return 'relative';
  if (specifier.startsWith('node:')) return 'node-builtin';
  if (specifier === 'electron' || specifier.startsWith('electron/')) return 'electron';
  if (specifier.startsWith('/') || specifier.startsWith('file:') || /^[A-Za-z]:[\\\\/]/.test(specifier)) {
    return 'absolute-path';
  }
  return 'bare-specifier';
}

function allowedModulePath(urlLike) {
  const pathname = String(urlLike).split('?')[0];
  return pathname.endsWith('.js') || pathname.endsWith('.mjs');
}

export async function resolve(specifier, context, nextResolve) {
  const gate = readGate();
  if (gate === null || gate.scopes === null) return nextResolve(specifier, context);
  const parent = context.parentURL ?? '';
  const fromScope = scopeOf(gate, parent);
  const toScope = scopeOf(gate, canonFileUrl(specifier));
  if (fromScope === null && toScope === null) return nextResolve(specifier, context);

  if (fromScope !== null) {
    const kind = classifySpecifier(specifier);
    if (kind !== 'relative') reject(gate, fromScope, kind, 'resolve', { specifier, parent });
    let resolved;
    try {
      resolved = await nextResolve(specifier, context);
    } catch (error) {
      logEvent({
        ev: 'reject',
        reason: 'module-not-found',
        phase: 'resolve',
        specifier,
        parent,
        pluginId: fromScope.pluginId,
        nonce: gate.active ? gate.active.nonce : null,
      });
      throw error;
    }
    const landed = scopeOf(gate, resolved.url);
    if (landed === null || landed.rootUrl !== fromScope.rootUrl) {
      reject(gate, fromScope, 'scope-escape', 'resolve', { specifier, url: resolved.url });
    }
    if (!allowedModulePath(resolved.url)) {
      reject(gate, fromScope, 'unsupported-module-type', 'resolve', { specifier, url: resolved.url });
    }
    let url = resolved.url;
    const active = gate.active;
    if (active !== null && active !== undefined && active.rootUrl === fromScope.rootUrl) {
      url += (url.includes('?') ? '&' : '?') + 'chips-nonce=' + active.nonce;
    }
    logEvent({ ev: 'resolve', kind: 'allow', url, nonce: nonceOf(url), pluginId: fromScope.pluginId });
    return { url, format: 'module', shortCircuit: true };
  }

  // 入口递交：宿主以带 nonce 的完整 URL 显式导入插件入口（非插件父链路）。
  if (!allowedModulePath(specifier)) {
    reject(gate, toScope, 'unsupported-module-type', 'resolve', { specifier });
  }
  logEvent({ ev: 'resolve', kind: 'allow', role: 'entry', url: specifier, nonce: nonceOf(specifier), pluginId: toScope.pluginId });
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  const gate = readGate();
  if (gate === null) return nextLoad(url, context);
  if (typeof gate.canaryPrefix === 'string' && url.startsWith(gate.canaryPrefix)) {
    logEvent({ ev: 'load', kind: 'canary', url });
    return nextLoad(url, context);
  }
  if (gate.scopes === null || gate.scopes === undefined) return nextLoad(url, context);
  const scope = scopeOf(gate, url);
  if (scope === null) return nextLoad(url, context);

  let filePath;
  try {
    filePath = fileURLToPath(url.split('?')[0]);
  } catch {
    reject(gate, scope, 'invalid-url', 'load', { url });
  }
  let bytes;
  try {
    bytes = readFileSync(filePath);
  } catch {
    reject(gate, scope, 'file-missing', 'load', { url, file: filePath });
  }
  if (bytes.length > scope.maxModuleBytes) {
    reject(gate, scope, 'module-too-large', 'load', { url, bytes: bytes.length, limit: scope.maxModuleBytes });
  }
  const expected = scope.expectedFileHashes[filePath];
  const actual = 'sha256:' + createHash('sha256').update(bytes).digest('hex');
  if (expected === undefined || expected === null) {
    reject(gate, scope, 'unmanifested-file', 'load', { url, file: filePath });
  }
  if (expected !== actual) {
    reject(gate, scope, 'file-hash-mismatch', 'load', { url, expected, actual });
  }
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    reject(gate, scope, 'not-utf8', 'load', { url, file: filePath });
  }
  if (!ESM_TOKEN.test(source)) {
    reject(gate, scope, 'not-esm', 'load', { url, file: filePath });
  }
  logEvent({ ev: 'load', kind: 'allow', url, nonce: nonceOf(url), pluginId: scope.pluginId });
  return { format: 'module', source, shortCircuit: true };
}
`;

/** 实例内部会话状态（钩子线程侧信道文件族）。 */
interface ISession {
  readonly sessionDir: string;
  readonly sessionUrl: string;
  readonly gateFile: string;
  readonly eventsFile: string;
}

/** 门闸文件中登记的单插件作用域（激活期快照摘要，钩子线程消费）。 */
interface IScopeEntry {
  readonly pluginId: string;
  readonly rootUrl: string;
  readonly maxModuleBytes: number;
  readonly expectedFileHashes: Readonly<Record<string, string>>;
}

/** 门闸文件文档形态（active 允许宿主侧原位改写后经 writeGateDocument 落盘）。 */
interface IGateDocument {
  readonly canaryPrefix: string;
  readonly scopes: Record<string, IScopeEntry>;
  active: { readonly rootUrl: string; readonly nonce: string } | null;
}

/** 宿主侧预检通过后的激活素材。 */
interface IPreparedActivation {
  readonly pluginId: string;
  readonly rootReal: string;
  readonly rootUrl: string;
  readonly entryUrl: string;
  readonly nonce: string;
  readonly scope: IScopeEntry;
}

function decodeGateRejectionMessage(error: unknown): Record<string, unknown> | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== null && current !== undefined; depth += 1) {
    // 仅消费 Error.message 与字符串节点；其他对象不做隐式串化（避免 [object Object]）。
    const message =
      current instanceof Error ? current.message : typeof current === 'string' ? current : '';
    const index = message.indexOf(GATE_REJECT_PREFIX);
    if (index >= 0) {
      try {
        const payload = JSON.parse(message.slice(index + GATE_REJECT_PREFIX.length)) as unknown;
        if (typeof payload === 'object' && payload !== null) {
          return payload as Record<string, unknown>;
        }
      } catch {
        // 载荷不可解析：落入通用归一。
      }
      return { reason: 'gate-reject-unparsed', raw: message.slice(index) };
    }
    current = current instanceof Error ? (current as { cause?: unknown }).cause : undefined;
  }
  return undefined;
}

/**
 * 构造 ModuleLoader（波 0 裁定 M2 形态的正式实现）。
 *
 * @param options 会话目录根等构造项。
 * @returns 装载器实例；进程级建议单实例（每实例注册一层钩子，用完 `dispose()`）。
 */
export function createCpkModuleLoader(options: ICreateCpkModuleLoaderOptions = {}): ICpkModuleLoader {
  let session: ISession | null = null;
  let disposed = false;
  /** 实例级串行队列：门闸文件的单激活槽要求装载请求顺序执行。 */
  let queue: Promise<unknown> = Promise.resolve();

  const disposedError = (): LoaderError =>
    new LoaderError(LIFECYCLE_ERROR_CODES.applyFailed, {
      message: `装载器会话已释放，拒绝继续装载：插件执行通道不可用`,
      details: { stage: 'channel', reason: 'disposed' },
    });

  const writeGateDocument = (gateFile: string, document: IGateDocument): void => {
    const temp = `${gateFile}.writing`;
    writeFileSync(temp, JSON.stringify(document));
    renameSync(temp, gateFile);
  };

  const ensureSession = (): ISession => {
    if (session !== null) {
      return session;
    }
    const root = options.sessionRoot ?? tmpdir();
    mkdirSync(root, { recursive: true });
    // macOS 等平台上 tmpdir 可能是符号链接（/var → /private/var）：先 realpath 再建会话，
    // 保证 canary/插件作用域 URL 与 Node ESM 默认解析的实路径一致。
    const sessionDir = realpathSync(mkdtempSync(join(root, 'chips-module-loader-')));
    const sessionUrl = pathToFileURL(sessionDir).href + '/';
    const hooksFile = join(sessionDir, 'hooks.mjs');
    const gateFile = join(sessionDir, 'gate.json');
    const eventsFile = join(sessionDir, 'gate-events.jsonl');
    writeFileSync(hooksFile, HOOK_SOURCE);
    const initial: IGateDocument = { canaryPrefix: sessionUrl, scopes: {}, active: null };
    writeGateDocument(gateFile, initial);
    writeFileSync(eventsFile, '');
    // 波 0 硬约束：Electron 主进程下 register() 返回 undefined——不消费返回值，
    // 宿主↔钩子通信只走 initialize(data) 投递 + 文件侧信道。
    register(pathToFileURL(hooksFile).href, {
      parentURL: sessionUrl,
      data: { gateFile, eventsFile },
    });
    session = { sessionDir, sessionUrl, gateFile, eventsFile };
    return session;
  };

  /**
   * 通道活性验证：canary 导入必须在钩子事件留痕中产生 `canary` 记录，否则 fail-closed。
   * 每次装载都复核（防止会话建立后导入通路被换出钩子链的场景）。
   */
  const assertChannelLive = async (active: ISession): Promise<void> => {
    const token = randomUUID();
    const canaryName = `canary-${token}.mjs`;
    const canaryUrl = `${active.sessionUrl}${canaryName}`;
    writeFileSync(
      join(active.sessionDir, canaryName),
      `export const chipsGateCanary = ${JSON.stringify(token)};\n`,
    );
    try {
      await import(canaryUrl);
      const events = readFileSync(active.eventsFile, 'utf8');
      if (!events.includes('"kind":"canary"') || !events.includes(canaryUrl)) {
        throwCpkError(
          LIFECYCLE_ERROR_CODES.applyFailed,
          '模块装载通道未接通 ESM 钩子链（导入被宿主外机制代管），拒绝无门禁装载',
          { stage: 'channel', reason: 'not-live' },
        );
      }
    } finally {
      rmSync(join(active.sessionDir, canaryName), { force: true });
    }
  };

  /** 宿主侧完整性与入口预检（任何 import 之前；失败即确定性拒装、插件体零执行）。 */
  const prepareActivation = async (target: ICpkModuleLoadTarget): Promise<IPreparedActivation> => {
    if (
      typeof target.pluginId !== 'string' ||
      target.pluginId.length === 0 ||
      typeof target.rootDir !== 'string' ||
      target.rootDir.length === 0 ||
      !/^sha256:[0-9a-f]{64}$/.test(target.expectedPackageHash)
    ) {
      throwCpkError(
        LIFECYCLE_ERROR_CODES.applyFailed,
        `装载目标不合法：需要非空 pluginId/rootDir 与 sha256 包级摘要（${target.pluginId ?? ''}）`,
        { pluginId: target.pluginId, stage: 'entry', reason: 'invalid-target' },
      );
    }
    let rootReal: string;
    try {
      rootReal = realpathSync(target.rootDir);
    } catch {
      throwCpkError(
        LIFECYCLE_ERROR_CODES.applyFailed,
        `插件目录不可访问，拒绝装载：${target.pluginId}`,
        { pluginId: target.pluginId, stage: 'entry', reason: 'root-missing' },
      );
    }
    let pkg: ICpkPackage;
    try {
      pkg = await loadCpkDirectory(rootReal);
    } catch (error) {
      const cause =
        error instanceof LoaderError
          ? { causeCode: error.code, causeMessage: error.message }
          : { causeMessage: error instanceof Error ? error.message : String(error) };
      throwCpkError(
        LIFECYCLE_ERROR_CODES.applyFailed,
        `插件目录源树不可信或不可读，拒绝装载：${target.pluginId}`,
        { pluginId: target.pluginId, stage: 'integrity', reason: 'unsafe-source-tree', ...cause },
      );
    }
    const entryBytes = pkg.members.get(MODULE_LOADER_ENTRY_FILE);
    if (entryBytes === undefined) {
      throwCpkError(
        LIFECYCLE_ERROR_CODES.applyFailed,
        `插件入口缺失（${MODULE_LOADER_ENTRY_FILE}），拒绝装载：${target.pluginId}`,
        { pluginId: target.pluginId, stage: 'entry', reason: 'entry-missing' },
      );
    }
    const packageHash = computeContentHash(membersToZipEntries(pkg.members));
    if (packageHash !== target.expectedPackageHash) {
      throwCpkError(
        LIFECYCLE_ERROR_CODES.applyFailed,
        `包级摘要复算不合（安装后篡改），拒绝装载：${target.pluginId}`,
        {
          pluginId: target.pluginId,
          stage: 'integrity',
          reason: 'package-hash-mismatch',
          expected: target.expectedPackageHash,
          actual: packageHash,
        },
      );
    }
    if (entryBytes.length > CPK_LIMITS.entryFileBytes) {
      throwCpkError(
        LIFECYCLE_ERROR_CODES.applyFailed,
        `入口文件超过 8 MiB，拒绝装载：${target.pluginId}`,
        {
          pluginId: target.pluginId,
          stage: 'entry',
          reason: 'entry-too-large',
          bytes: entryBytes.length,
          limit: CPK_LIMITS.entryFileBytes,
        },
      );
    }
    let entryText: string;
    try {
      entryText = new TextDecoder('utf-8', { fatal: true }).decode(entryBytes);
    } catch {
      throwCpkError(
        LIFECYCLE_ERROR_CODES.applyFailed,
        `入口不是 UTF-8 文本，拒绝装载：${target.pluginId}`,
        { pluginId: target.pluginId, stage: 'entry', reason: 'entry-not-utf8' },
      );
    }
    if (!ESM_TOKEN_PATTERN.test(entryText)) {
      throwCpkError(
        LIFECYCLE_ERROR_CODES.applyFailed,
        `入口不是 ESM 模块（UTF-8 文本 ESM 契约），拒绝装载：${target.pluginId}`,
        { pluginId: target.pluginId, stage: 'entry', reason: 'entry-not-esm' },
      );
    }
    const expectedFileHashes: Record<string, string> = {};
    for (const [memberPath, data] of pkg.members) {
      expectedFileHashes[join(rootReal, ...memberPath.split('/'))] = `sha256:${sha256Hex(data)}`;
    }
    const rootUrl = pathToFileURL(rootReal).href + '/';
    const entryUrl = pathToFileURL(join(rootReal, ...MODULE_LOADER_ENTRY_FILE.split('/'))).href;
    const nonce = randomUUID();
    return {
      pluginId: target.pluginId,
      rootReal,
      rootUrl,
      entryUrl,
      nonce,
      scope: {
        pluginId: target.pluginId,
        rootUrl,
        maxModuleBytes: CPK_LIMITS.entryFileBytes,
        expectedFileHashes,
      },
    };
  };

  const readGateDocument = (gateFile: string): IGateDocument => {
    const parsed = JSON.parse(readFileSync(gateFile, 'utf8')) as IGateDocument;
    return {
      canaryPrefix: parsed.canaryPrefix,
      scopes: parsed.scopes ?? {},
      active: parsed.active ?? null,
    };
  };

  const collectGateStats = (
    eventsFile: string,
    pluginId: string,
    nonce: string,
  ): ICpkModuleGateStats => {
    const stats = { resolveAllow: 0, resolveReject: 0, loadAllow: 0, loadReject: 0 };
    let text = '';
    try {
      text = readFileSync(eventsFile, 'utf8');
    } catch {
      return stats;
    }
    for (const line of text.split('\n')) {
      if (line.length === 0) {
        continue;
      }
      let event: {
        ev?: string;
        kind?: string;
        phase?: string;
        nonce?: string | null;
        pluginId?: string | null;
      };
      try {
        event = JSON.parse(line) as typeof event;
      } catch {
        continue;
      }
      if (event.pluginId !== pluginId || event.nonce !== nonce) {
        continue;
      }
      if (event.ev === 'resolve' && event.kind === 'allow') {
        stats.resolveAllow += 1;
      } else if (event.ev === 'load' && event.kind === 'allow') {
        stats.loadAllow += 1;
      } else if (event.ev === 'reject' && event.phase === 'resolve') {
        stats.resolveReject += 1;
      } else if (event.ev === 'reject' && event.phase === 'load') {
        stats.loadReject += 1;
      }
    }
    return stats;
  };

  const normalizeLoadFailure = (
    error: unknown,
    activation: IPreparedActivation,
    eventsFile: string,
  ): never => {
    const gateStats = collectGateStats(eventsFile, activation.pluginId, activation.nonce);
    const payload = decodeGateRejectionMessage(error);
    if (payload !== undefined) {
      const reason = typeof payload.reason === 'string' ? payload.reason : 'gate-reject';
      const stage = GATE_REASON_STAGE[reason] ?? 'entry';
      throw new LoaderError(LIFECYCLE_ERROR_CODES.applyFailed, {
        message: `插件装载被门禁拒绝（${stage}：${reason}）：${activation.pluginId}`,
        details: {
          pluginId: activation.pluginId,
          stage,
          reason,
          nonce: activation.nonce,
          gateStats,
          ...payload,
        },
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    // 语法错误在主线程编译期抛出（钩子只交源）：instanceof 可靠；跨线程仅消息文本可达，
    // `ERR_MODULE_NOT_FOUND` 的 `code` 字段经克隆可能丢失，辅以消息特征判定。
    const syntaxLike = error instanceof SyntaxError;
    const notFound =
      (error instanceof Error && (error as { code?: string }).code === 'ERR_MODULE_NOT_FOUND') ||
      /Cannot find (?:module|package)/i.test(message);
    const reason = syntaxLike ? 'parse-failure' : notFound ? 'module-not-found' : 'import-failure';
    throw new LoaderError(LIFECYCLE_ERROR_CODES.applyFailed, {
      message: `插件入口不可解析或求值失败（entry：${reason}）：${activation.pluginId}`,
      details: {
        pluginId: activation.pluginId,
        stage: 'entry' as ModuleLoadGateStage,
        reason,
        nonce: activation.nonce,
        gateStats,
        cause: message,
      },
    });
  };

  const runLoad = async (target: ICpkModuleLoadTarget): Promise<ICpkModuleLoadResult> => {
    if (disposed) {
      throw disposedError();
    }
    const activation = await prepareActivation(target);
    const active = ensureSession();
    await assertChannelLive(active);
    const document = readGateDocument(active.gateFile);
    document.scopes[activation.rootUrl] = activation.scope;
    document.active = { rootUrl: activation.rootUrl, nonce: activation.nonce };
    writeGateDocument(active.gateFile, document);
    const importUrl = `${activation.entryUrl}?chips-nonce=${activation.nonce}`;
    try {
      const namespace = (await import(importUrl)) as Record<string, unknown>;
      const stats = collectGateStats(active.eventsFile, activation.pluginId, activation.nonce);
      return {
        pluginId: activation.pluginId,
        nonce: activation.nonce,
        entryUrl: importUrl,
        // 门面封顶：冻结快照只含插件自身导出，不携带命名空间原型或宿主对象。
        exports: Object.freeze({ ...namespace }),
        gateStats: stats,
      };
    } catch (error) {
      return normalizeLoadFailure(error, activation, active.eventsFile);
    } finally {
      const after = readGateDocument(active.gateFile);
      if (after.active !== null && after.active.nonce === activation.nonce) {
        after.active = null;
        writeGateDocument(active.gateFile, after);
      }
    }
  };

  return {
    loadModule(target: ICpkModuleLoadTarget): Promise<ICpkModuleLoadResult> {
      const task = queue.then(() => runLoad(target));
      // 队列吞掉业务失败仅用于串行推进；错误仍以 task 形式交给调用方。
      queue = task.catch(() => undefined);
      return task;
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      if (session !== null) {
        try {
          const document = readGateDocument(session.gateFile);
          document.active = null;
          writeGateDocument(session.gateFile, document);
        } catch {
          // 会话文件已不可用：目录整体清理兜底。
        }
        rmSync(session.sessionDir, { recursive: true, force: true });
        session = null;
      }
    },
    get disposed(): boolean {
      return disposed;
    },
  };
}
