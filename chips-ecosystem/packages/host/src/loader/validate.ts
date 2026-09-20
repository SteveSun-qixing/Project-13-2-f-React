/**
 * `.cpk` 五阶段校验流水线（壳侧结构视图，《03-插件包格式》§五）。
 *
 * 权威：`04-文件格式规范/03-插件包格式` §5.1/§5.2（归档 → 结构 → 清单 → 签名 → 摘要与落盘）、
 * §2.7（开发目录态差异）、§四（限额）、§6.3（渠道规则）。
 *
 * @remarks
 * - 与 `@chips/cli` `artifacts/cpk-validate.ts` 的判定面逐项一致（壳不 import 被承载方，
 *   结构视图先例见 `src/protocol/error-codes.ts`）；阶段收集序固定为
 *   `archive → layout → manifest → signature → hash`（§5.1），清单先行解析以取得
 *   角色布局所需的 `role`（与 CLI 执行序一致：manifest 判定先于 layout 落码，
 *   布局错位负例在 manifest 合法时才可达）。
 * - 安装哈希（§5.2[5]）：归档态 = `"sha256:" + SHA-256(整个 .cpk 文件字节)`；
 *   目录态无归档字节，取成员内容清单摘要（§6.2 口径对全部成员拼接
 *   `path\nsha256hex\n` 再取 SHA-256），与 `types.ts` `IPluginRecord.hash` 注记一致。
 * - 阶段失败时 `LoaderError.details` 附带已收集阶段列表（`stages`），供上层诊断；
 *   校验全部通过前不得落盘（落盘与原子替换由 `install.ts` 承接，本模块只判定）。
 * - 签名阶段的渠道判定（builtin 必签 / user 缺签=未签名发布者 / development 跳过）
 *   由 `signature.ts` 消费 `trust-roots.ts` 注册表完成，本模块只编排。
 */

import { posix } from 'node:path';

import { CPK_ERROR_CODES, type CpkValidationStage } from './codes.js';
import { LoaderError, throwCpkError } from './errors.js';
import { CPK_LIMITS } from './limits.js';
import {
  createHostPermissionCatalog,
  parseManifestText,
  validateManifest,
  type IHostManifestValidationResult,
  type IPermissionCatalog,
} from './manifest.js';
import { membersToZipEntries, type ICpkPackage } from './provider.js';
import {
  SIGNATURE_FILE,
  computeContentHash,
  sha256Hex,
  verifySignature,
  type ISignatureStageResult,
} from './signature.js';
import type { ITrustRootRegistry } from './trust-roots.js';
import type { PluginRole, PluginSource } from './types.js';

const RESERVED_DEVICE_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
]);

const NESTED_ARCHIVE_EXTENSIONS = ['.zip', '.tar', '.tgz', '.7z', '.cpk', '.gz', '.rar'];
const NATIVE_PAYLOAD_EXTENSIONS = [
  '.node',
  '.dll',
  '.dylib',
  '.so',
  '.exe',
  '.msi',
  '.com',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.wasm',
];
const CODE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'];
const ASSET_EXTENSIONS = [
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ico',
  '.icns',
  '.woff2',
  '.woff',
  '.ttf',
  '.css',
  '.json',
  '.yaml',
  '.yml',
  '.md',
  '.txt',
];
const ROOT_WHITELIST = ['manifest.yaml', 'dist', 'render.js', 'assets', SIGNATURE_FILE];

/** 单个校验阶段的判定结果。 */
export interface ICpkStageResult {
  readonly stage: CpkValidationStage;
  readonly status: 'passed' | 'skipped';
  /** 判定说明（简体中文）。 */
  readonly detail: string;
}

/** 校验流水线的输入。 */
export interface ICpkValidationInput {
  /** Provider 产出的包内容（归档态或目录态）。 */
  readonly pkg: ICpkPackage;
  /** 来源渠道（《03-插件包格式》§6.3）。 */
  readonly source: PluginSource;
  /** 信任根注册表（未注册 keyId 与验签失败同为 `CPK_SIGNATURE_INVALID`）。 */
  readonly trustRoots: ITrustRootRegistry;
  /** 当前宿主平台版本（`engines.chips` 门禁判定）。 */
  readonly hostVersion: string;
  /** 权限登记目录（缺省用宿主内置表；组合根可注入平台登记表）。 */
  readonly catalog?: IPermissionCatalog;
}

/** 校验流水线的通过结果（安装与注册表消费的归一投影）。 */
export interface ICpkValidationResult {
  /** 五阶段收集结果（archive → layout → manifest → signature → hash）。 */
  readonly stages: readonly ICpkStageResult[];
  /** 清单归一结果（ID/版本/角色/依赖/权限申请）。 */
  readonly manifest: IHostManifestValidationResult;
  /** 签名阶段判定（`passed` / `skipped` 与未签名发布者标记）。 */
  readonly signature: ISignatureStageResult;
  /** 安装哈希（§5.2[5]；目录态为内容清单摘要）。 */
  readonly installHash: string;
  /** 非致命告警（简体中文；如未签名发布者、依赖重复声明）。 */
  readonly warnings: readonly string[];
}

function stageResult(
  stage: CpkValidationStage,
  status: 'passed' | 'skipped',
  detail: string,
): ICpkStageResult {
  return { stage, status, detail };
}

/** 成员路径不安全（落 `CPK_PATH_UNSAFE`，携带阶段与成员路径）。 */
function pathUnsafe(path: string, reason: string): never {
  throwCpkError(CPK_ERROR_CODES.pathUnsafe, `成员路径不安全（${reason}）：${path}`, {
    stage: 'archive',
    file: path,
  });
}

/** 成员路径安全判定（《03-插件包格式》§2.1 与 §八 `CPK_PATH_UNSAFE` 口径）。 */
function assertPathSafe(path: string): void {
  if (path.startsWith('/')) {
    pathUnsafe(path, '前导 /');
  }
  if (/^[A-Za-z]:/.test(path)) {
    pathUnsafe(path, '盘符');
  }
  if (path.includes('\\')) {
    pathUnsafe(path, '反斜杠');
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(path)) {
    pathUnsafe(path, '控制字符');
  }
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      pathUnsafe(path, '路径穿越或空段');
    }
    const base = segment.split('.')[0]?.toLowerCase() ?? '';
    if (RESERVED_DEVICE_NAMES.has(base)) {
      pathUnsafe(path, '保留设备名');
    }
  }
  if (path.length > CPK_LIMITS.pathLength) {
    throwCpkError(CPK_ERROR_CODES.limitExceeded, `成员路径超长：${path}`, {
      stage: 'archive',
      file: path,
    });
  }
  if (segments.length > CPK_LIMITS.depth) {
    throwCpkError(CPK_ERROR_CODES.limitExceeded, `成员目录深度超限：${path}`, {
      stage: 'archive',
      file: path,
    });
  }
}

function assertNoHidden(path: string): void {
  for (const segment of path.split('/')) {
    if (segment.startsWith('.')) {
      throwCpkError(CPK_ERROR_CODES.layoutInvalid, `包内禁止隐藏文件或目录：${path}`, {
        stage: 'layout',
        file: path,
      });
    }
  }
}

function assertNoNestedArchive(path: string): void {
  const extension = posix.extname(path).toLowerCase();
  if (NESTED_ARCHIVE_EXTENSIONS.includes(extension)) {
    throwCpkError(CPK_ERROR_CODES.archiveInvalid, `包内禁止嵌套归档：${path}`, {
      stage: 'archive',
      file: path,
    });
  }
}

function assertNoNativePayload(path: string, data: Uint8Array): void {
  const extension = posix.extname(path).toLowerCase();
  if (NATIVE_PAYLOAD_EXTENSIONS.includes(extension)) {
    throwCpkError(
      CPK_ERROR_CODES.nativePayload,
      `插件包包含不受支持的原生可执行文件：${path}`,
      { stage: 'layout', file: path },
    );
  }
  const magic = (offset: number, bytes: readonly number[]): boolean =>
    bytes.every((byte, index) => data[offset + index] === byte);
  if (magic(0, [0x4d, 0x5a])) {
    throwCpkError(CPK_ERROR_CODES.nativePayload, `插件包包含原生载荷（PE）：${path}`, {
      stage: 'layout',
      file: path,
    });
  }
  if (magic(0, [0x7f, 0x45, 0x4c, 0x46])) {
    throwCpkError(CPK_ERROR_CODES.nativePayload, `插件包包含原生载荷（ELF）：${path}`, {
      stage: 'layout',
      file: path,
    });
  }
  if (
    magic(0, [0xfe, 0xed, 0xfa, 0xce]) ||
    magic(0, [0xfe, 0xed, 0xfa, 0xcf]) ||
    magic(0, [0xca, 0xfe, 0xba, 0xbe])
  ) {
    throwCpkError(CPK_ERROR_CODES.nativePayload, `插件包包含原生载荷（Mach-O）：${path}`, {
      stage: 'layout',
      file: path,
    });
  }
  if (magic(0, [0x00, 0x61, 0x73, 0x6d])) {
    throwCpkError(CPK_ERROR_CODES.nativePayload, `插件包包含原生载荷（WASM）：${path}`, {
      stage: 'layout',
      file: path,
    });
  }
}

function decodeText(data: Uint8Array): string | undefined {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    if (text.includes('\u0000')) {
      return undefined;
    }
    return text;
  } catch {
    return undefined;
  }
}

function assertEntryModule(path: string, data: Uint8Array): void {
  const text = decodeText(data);
  if (text === undefined || !/\b(export|import)\b/.test(text)) {
    throwCpkError(CPK_ERROR_CODES.entryMissing, `入口必须是 UTF-8 文本 ESM 模块：${path}`, {
      stage: 'layout',
      file: path,
    });
  }
  if (data.length > CPK_LIMITS.entryFileBytes) {
    throwCpkError(CPK_ERROR_CODES.limitExceeded, `入口文件超过 8 MiB：${path}`, {
      stage: 'layout',
      file: path,
    });
  }
}

/** 归档阶段成员级判定（§5.2[1]：路径安全、限额、嵌套归档、manifest 字节上限）。 */
function archiveStageChecks(members: ReadonlyMap<string, Uint8Array>): void {
  let total = 0;
  for (const [path, data] of members) {
    assertPathSafe(path);
    assertNoNestedArchive(path);
    if (data.length > CPK_LIMITS.singleFileBytes) {
      throwCpkError(CPK_ERROR_CODES.limitExceeded, `单个文件超过 16 MiB：${path}`, {
        stage: 'archive',
        file: path,
      });
    }
    if (path === 'manifest.yaml' && data.length > CPK_LIMITS.manifestBytes) {
      throwCpkError(CPK_ERROR_CODES.limitExceeded, 'manifest.yaml 超过 256 KiB', {
        stage: 'archive',
        file: path,
      });
    }
    total += data.length;
  }
  if (members.size > CPK_LIMITS.members) {
    throwCpkError(CPK_ERROR_CODES.limitExceeded, '文件成员数超过 512', { stage: 'archive' });
  }
  if (total > CPK_LIMITS.totalBytes) {
    throwCpkError(CPK_ERROR_CODES.limitExceeded, '解包后总大小超过 50 MiB', { stage: 'archive' });
  }
}

/** 结构校验（《03-插件包格式》§5.2[2]：角色布局与根目录白名单，§2.3、§三）。 */
export function validateLayout(members: ReadonlyMap<string, Uint8Array>, role: PluginRole): void {
  const paths = [...members.keys()];
  const totalBytes = paths.reduce((sum, path) => sum + (members.get(path)?.length ?? 0), 0);
  if (totalBytes > CPK_LIMITS.totalBytes) {
    throwCpkError(CPK_ERROR_CODES.limitExceeded, '解包后总大小超过 50 MiB', { stage: 'layout' });
  }
  if (paths.length > CPK_LIMITS.members) {
    throwCpkError(CPK_ERROR_CODES.limitExceeded, '文件成员数超过 512', { stage: 'layout' });
  }
  for (const path of paths) {
    const data = members.get(path);
    if (data === undefined) {
      continue;
    }
    assertNoHidden(path);
    assertNoNativePayload(path, data);
    if (data.length > CPK_LIMITS.singleFileBytes) {
      throwCpkError(CPK_ERROR_CODES.limitExceeded, `单个文件超过 16 MiB：${path}`, {
        stage: 'layout',
        file: path,
      });
    }
    const rootSegment = path.split('/')[0] ?? path;
    if (!ROOT_WHITELIST.includes(rootSegment)) {
      throwCpkError(CPK_ERROR_CODES.layoutInvalid, `包根出现白名单外条目：${rootSegment}`, {
        stage: 'layout',
        file: path,
      });
    }
    const extension = posix.extname(path).toLowerCase();
    if (extension === '.html' || extension === '.htm') {
      throwCpkError(CPK_ERROR_CODES.layoutInvalid, `包内禁止 HTML 文档：${path}`, {
        stage: 'layout',
        file: path,
      });
    }
    if (path.startsWith('assets/')) {
      if (!ASSET_EXTENSIONS.includes(extension)) {
        throwCpkError(CPK_ERROR_CODES.layoutInvalid, `assets/ 只允许登记的资源类型：${path}`, {
          stage: 'layout',
          file: path,
        });
      }
    } else if (path !== 'render.js' && !path.startsWith('dist/')) {
      if (CODE_EXTENSIONS.includes(extension)) {
        throwCpkError(
          CPK_ERROR_CODES.layoutInvalid,
          `除 dist/ 与 render.js 外不得出现代码文件：${path}`,
          { stage: 'layout', file: path },
        );
      }
    }
  }

  if (!members.has('manifest.yaml')) {
    throwCpkError(CPK_ERROR_CODES.manifestMissing, '包根缺少 manifest.yaml', {
      stage: 'manifest',
      file: 'manifest.yaml',
    });
  }
  if (!members.has('dist/index.js')) {
    throwCpkError(CPK_ERROR_CODES.entryMissing, '缺少插件模块入口 dist/index.js', {
      stage: 'layout',
      file: 'dist/index.js',
    });
  }
  const renderData = members.get('render.js');
  if (role === 'service') {
    if (renderData !== undefined) {
      throwCpkError(CPK_ERROR_CODES.layoutInvalid, 'service 角色不得携带 render.js', {
        stage: 'layout',
        file: 'render.js',
      });
    }
    for (const path of paths) {
      if (path.startsWith('assets/')) {
        const extension = posix.extname(path).toLowerCase();
        if (!['.json', '.yaml', '.yml', '.md', '.txt'].includes(extension)) {
          throwCpkError(
            CPK_ERROR_CODES.layoutInvalid,
            `service 角色 assets/ 只允许数据文件：${path}`,
            { stage: 'layout', file: path },
          );
        }
      }
    }
  } else if (renderData === undefined) {
    throwCpkError(CPK_ERROR_CODES.entryMissing, '缺少渲染入口 render.js', {
      stage: 'layout',
      file: 'render.js',
    });
  }
  assertEntryModule(
    'dist/index.js',
    members.get('dist/index.js') ?? new Uint8Array(),
  );
  if (renderData !== undefined && role !== 'service') {
    assertEntryModule('render.js', renderData);
  }
}

/**
 * 执行五阶段校验（§5.1）。
 *
 * @param input 包内容、渠道、信任根、宿主版本与可选权限目录。
 * @returns 通过结果（阶段列表、清单归一、签名判定、安装哈希、告警）。
 * @throws {LoaderError} 任一阶段失败即终止并抛出登记码错误（`details` 携带阶段与
 *   已收集阶段列表）。
 */
export function validateCpkPackage(input: ICpkValidationInput): ICpkValidationResult {
  const stages: ICpkStageResult[] = [];
  const catalog = input.catalog ?? createHostPermissionCatalog();
  const members = input.pkg.members;

  /** 阶段执行包装：失败时把已收集阶段并入 `details` 后原码重抛（CLI `run` 同构）。 */
  const run = <T>(action: () => T): T => {
    try {
      return action();
    } catch (error) {
      if (error instanceof LoaderError) {
        const baseDetails =
          typeof error.details === 'object' && error.details !== null
            ? (error.details as Record<string, unknown>)
            : {};
        throw new LoaderError(error.code, {
          message: error.message,
          details: { ...baseDetails, stages: [...stages] },
        });
      }
      throw error;
    }
  };

  // [1] 归档阶段：ZIP 结构判定已由 provider 读取面（zip.ts）完成；
  //     目录态按 §2.7 跳过归档校验。
  run(() => {
    if (input.pkg.mode === 'directory') {
      stages.push(stageResult('archive', 'skipped', '目录态跳过归档校验'));
      return;
    }
    archiveStageChecks(members);
    stages.push(stageResult('archive', 'passed', '全部成员 Stored'));
  });

  // 清单先行：取得角色供结构校验（与 CLI 执行序一致）。
  const manifestResult = run<IHostManifestValidationResult>(() => {
    const manifestEntry = members.get('manifest.yaml');
    if (manifestEntry === undefined) {
      throwCpkError(CPK_ERROR_CODES.manifestMissing, '包根缺少 manifest.yaml', {
        stage: 'manifest',
        file: 'manifest.yaml',
      });
    }
    const manifestText = new TextDecoder('utf-8', { fatal: false }).decode(manifestEntry);
    const parsed = parseManifestText(manifestText);
    return validateManifest({
      manifest: parsed,
      members: new Set(members.keys()),
      contents: members,
      catalog,
      platformVersion: input.hostVersion,
    });
  });

  // [2] 结构阶段：按角色布局判定。
  run(() => {
    validateLayout(members, manifestResult.role);
    stages.push(stageResult('layout', 'passed', `${manifestResult.role} 布局`));
  });

  // [3] 清单阶段（判定已在先行步骤完成，此处落阶段记录）。
  stages.push(
    stageResult(
      'manifest',
      'passed',
      `${manifestResult.id}@${manifestResult.version}（${manifestResult.role}）`,
    ),
  );

  // [4] 签名阶段：渠道规则与信任根判定（development 渠道跳过验签，《03-插件包格式》§6.3）。
  const signatureResult = run<ISignatureStageResult>(() => {
    const result = verifySignature({
      members,
      source: input.source,
      trustRoots: input.trustRoots,
    });
    stages.push(stageResult('signature', result.status, result.detail));
    return result;
  });

  // [5] 摘要阶段：安装哈希（§5.2[5]）。
  const installHash = run<string>(() => {
    if (input.pkg.mode === 'archive' && input.pkg.archiveBytes !== null) {
      const digest = `sha256:${sha256Hex(input.pkg.archiveBytes)}`;
      stages.push(stageResult('hash', 'passed', digest));
      return digest;
    }
    const digest = computeContentHash(membersToZipEntries(members));
    stages.push(stageResult('hash', 'passed', `目录态内容清单摘要 ${digest}`));
    return digest;
  });

  const warnings: string[] = [...manifestResult.warnings];
  if (signatureResult.unsignedPublisher === true && input.source === 'user') {
    warnings.push('未签名发布者：安装需要用户确认');
  }

  return {
    stages,
    manifest: manifestResult,
    signature: signatureResult,
    installHash,
    warnings,
  };
}
