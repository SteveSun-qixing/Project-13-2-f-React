/**
 * `.cpk` 五阶段校验（[插件包格式] §五）：归档 → 结构 → 清单 → 签名 → 摘要与落盘。
 *
 * 与安装校验同源：`chips plugin validate` 与 `plugin pack` 的打包前校验共用本模块；
 * 目录态跳过归档与签名校验，仍执行清单、入口、原生载荷、路径安全与角色布局校验（§2.7）。
 */

import { createHash, createPublicKey, verify as verifySignatureValue } from 'node:crypto';
import { join, posix } from 'node:path';

import { cliError, normalizeError } from '../errors.js';
import type { CliPluginSource, ICliArtifactStageResult, ICliArtifactValidateResult } from '../client/types.js';
import type { IFileSystemPort } from '../args/filesystem.js';
import { parseManifestText, validateManifest } from './manifest.js';
import type { IPermissionCatalog } from './permission-catalog.js';
import { compareZipPathBytes, readZipStore, type IZipEntry } from './zip.js';

/** 归档限额（[插件包格式] §四）。 */
export const CPK_LIMITS = {
  archiveBytes: 50 * 1024 * 1024,
  totalBytes: 50 * 1024 * 1024,
  members: 512,
  singleFileBytes: 16 * 1024 * 1024,
  manifestBytes: 256 * 1024,
  entryFileBytes: 8 * 1024 * 1024,
  pathLength: 180,
  depth: 8,
} as const;

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
const SIGNATURE_FILE = 'signature.json';
const ROOT_WHITELIST = ['manifest.yaml', 'dist', 'render.js', 'assets', SIGNATURE_FILE];

/** 校验输入。 */
export interface ICpkValidateOptions {
  readonly fileSystem: IFileSystemPort;
  readonly path: string;
  readonly source: CliPluginSource;
  readonly catalog: IPermissionCatalog;
  readonly platformVersion?: string;
  /** 信任根注册表：keyId → Ed25519 公钥（SPKI PEM）；未注册的 keyId 视为签名无效。 */
  readonly trustRoots?: Readonly<Record<string, string>>;
}

function stage(
  stageName: ICliArtifactStageResult['stage'],
  status: ICliArtifactStageResult['status'],
  detail: string,
): ICliArtifactStageResult {
  return { stage: stageName, status, detail };
}

/** 目录态成员收集（相对路径 POSIX；深度上限防失控递归）。 */
export function collectDirectory(
  fileSystem: IFileSystemPort,
  root: string,
): Map<string, Uint8Array> {
  const members = new Map<string, Uint8Array>();
  const visit = (dir: string, prefix: string, depth: number): void => {
    if (depth > CPK_LIMITS.depth + 2) {
      throw cliError('CPK_LIMIT_EXCEEDED', `目录深度超过上限：${prefix}`, {
        stage: 'archive',
        file: prefix,
      });
    }
    for (const name of fileSystem.list(dir)) {
      const absolute = join(dir, name);
      const relative = prefix.length === 0 ? name : `${prefix}/${name}`;
      const kind = fileSystem.kind(absolute);
      if (kind === 'directory') {
        visit(absolute, relative, depth + 1);
        continue;
      }
      if (kind === 'file') {
        members.set(relative, fileSystem.readBinary(absolute));
      }
    }
  };
  visit(root.replace(/[/\\]+$/, ''), '', 1);
  return members;
}

function assertPathSafe(path: string): void {
  const unsafe = (reason: string): never => {
    throw cliError('CPK_PATH_UNSAFE', `成员路径不安全（${reason}）：${path}`, { stage: 'archive', file: path });
  };
  if (path.startsWith('/')) {
    unsafe('前导 /');
  }
  if (/^[A-Za-z]:/.test(path)) {
    unsafe('盘符');
  }
  if (path.includes('\\')) {
    unsafe('反斜杠');
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(path)) {
    unsafe('控制字符');
  }
  const segments = path.split('/');
  for (const segment of segments) {
    if (segment.length === 0 || segment === '.' || segment === '..') {
      unsafe('路径穿越或空段');
    }
    const base = segment.split('.')[0]?.toLowerCase() ?? '';
    if (RESERVED_DEVICE_NAMES.has(base)) {
      unsafe('保留设备名');
    }
  }
  if (path.length > CPK_LIMITS.pathLength) {
    throw cliError('CPK_LIMIT_EXCEEDED', `成员路径超长：${path}`, { stage: 'archive', file: path });
  }
  if (segments.length > CPK_LIMITS.depth) {
    throw cliError('CPK_LIMIT_EXCEEDED', `成员目录深度超限：${path}`, { stage: 'archive', file: path });
  }
}

function assertNoHidden(path: string): void {
  for (const segment of path.split('/')) {
    if (segment.startsWith('.')) {
      throw cliError('CPK_LAYOUT_INVALID', `包内禁止隐藏文件或目录：${path}`, { stage: 'layout', file: path });
    }
  }
}

function assertNoNestedArchive(path: string): void {
  const extension = posix.extname(path).toLowerCase();
  if (NESTED_ARCHIVE_EXTENSIONS.includes(extension)) {
    throw cliError('CPK_ARCHIVE_INVALID', `包内禁止嵌套归档：${path}`, { stage: 'archive', file: path });
  }
}

function assertNoNativePayload(path: string, data: Uint8Array): void {
  const extension = posix.extname(path).toLowerCase();
  if (NATIVE_PAYLOAD_EXTENSIONS.includes(extension)) {
    throw cliError('CPK_NATIVE_PAYLOAD', `插件包包含不受支持的原生可执行文件：${path}`, {
      stage: 'layout',
      file: path,
    });
  }
  const magic = (offset: number, bytes: readonly number[]): boolean =>
    bytes.every((byte, index) => data[offset + index] === byte);
  if (magic(0, [0x4d, 0x5a])) {
    throw cliError('CPK_NATIVE_PAYLOAD', `插件包包含原生载荷（PE）：${path}`, { stage: 'layout', file: path });
  }
  if (magic(0, [0x7f, 0x45, 0x4c, 0x46])) {
    throw cliError('CPK_NATIVE_PAYLOAD', `插件包包含原生载荷（ELF）：${path}`, { stage: 'layout', file: path });
  }
  if (magic(0, [0xfe, 0xed, 0xfa, 0xce]) || magic(0, [0xfe, 0xed, 0xfa, 0xcf]) || magic(0, [0xca, 0xfe, 0xba, 0xbe])) {
    throw cliError('CPK_NATIVE_PAYLOAD', `插件包包含原生载荷（Mach-O）：${path}`, { stage: 'layout', file: path });
  }
  if (magic(0, [0x00, 0x61, 0x73, 0x6d])) {
    throw cliError('CPK_NATIVE_PAYLOAD', `插件包包含原生载荷（WASM）：${path}`, { stage: 'layout', file: path });
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
    throw cliError('CPK_ENTRY_MISSING', `入口必须是 UTF-8 文本 ESM 模块：${path}`, {
      stage: 'layout',
      file: path,
    });
  }
  if (data.length > CPK_LIMITS.entryFileBytes) {
    throw cliError('CPK_LIMIT_EXCEEDED', `入口文件超过 8 MiB：${path}`, { stage: 'layout', file: path });
  }
}

/** 结构校验（角色布局与根目录白名单，[插件包格式] §2.2、§三）。 */
export function validateLayout(
  members: ReadonlyMap<string, Uint8Array>,
  role: string,
): void {
  const paths = [...members.keys()];
  const totalBytes = paths.reduce((sum, path) => sum + (members.get(path)?.length ?? 0), 0);
  if (totalBytes > CPK_LIMITS.totalBytes) {
    throw cliError('CPK_LIMIT_EXCEEDED', '解包后总大小超过 50 MiB', { stage: 'layout' });
  }
  if (paths.length > CPK_LIMITS.members) {
    throw cliError('CPK_LIMIT_EXCEEDED', '文件成员数超过 512', { stage: 'layout' });
  }
  for (const path of paths) {
    const data = members.get(path);
    if (data === undefined) {
      continue;
    }
    assertNoHidden(path);
    assertNoNativePayload(path, data);
    if (data.length > CPK_LIMITS.singleFileBytes) {
      throw cliError('CPK_LIMIT_EXCEEDED', `单个文件超过 16 MiB：${path}`, { stage: 'layout', file: path });
    }
    const rootSegment = path.split('/')[0] ?? path;
    if (!ROOT_WHITELIST.includes(rootSegment)) {
      throw cliError('CPK_LAYOUT_INVALID', `包根出现白名单外条目：${rootSegment}`, {
        stage: 'layout',
        file: path,
      });
    }
    const extension = posix.extname(path).toLowerCase();
    if (extension === '.html' || extension === '.htm') {
      throw cliError('CPK_LAYOUT_INVALID', `包内禁止 HTML 文档：${path}`, { stage: 'layout', file: path });
    }
    if (path.startsWith('assets/')) {
      if (!ASSET_EXTENSIONS.includes(extension)) {
        throw cliError('CPK_LAYOUT_INVALID', `assets/ 只允许登记的资源类型：${path}`, {
          stage: 'layout',
          file: path,
        });
      }
    } else if (path !== 'render.js' && !path.startsWith('dist/')) {
      if (CODE_EXTENSIONS.includes(extension)) {
        throw cliError('CPK_LAYOUT_INVALID', `除 dist/ 与 render.js 外不得出现代码文件：${path}`, {
          stage: 'layout',
          file: path,
        });
      }
    }
  }

  if (!members.has('manifest.yaml')) {
    throw cliError('CPK_MANIFEST_MISSING', '包根缺少 manifest.yaml', { stage: 'manifest', file: 'manifest.yaml' });
  }
  if (!members.has('dist/index.js')) {
    throw cliError('CPK_ENTRY_MISSING', '缺少插件模块入口 dist/index.js', {
      stage: 'layout',
      file: 'dist/index.js',
    });
  }
  const renderData = members.get('render.js');
  if (role === 'service') {
    if (renderData !== undefined) {
      throw cliError('CPK_LAYOUT_INVALID', 'service 角色不得携带 render.js', { stage: 'layout', file: 'render.js' });
    }
    for (const path of paths) {
      if (path.startsWith('assets/')) {
        const extension = posix.extname(path).toLowerCase();
        if (!['.json', '.yaml', '.yml', '.md', '.txt'].includes(extension)) {
          throw cliError('CPK_LAYOUT_INVALID', `service 角色 assets/ 只允许数据文件：${path}`, {
            stage: 'layout',
            file: path,
          });
        }
      }
    }
  } else if (renderData === undefined) {
    throw cliError('CPK_ENTRY_MISSING', `缺少渲染入口 render.js`, { stage: 'layout', file: 'render.js' });
  }
  assertEntryModule('dist/index.js', members.get('dist/index.js') ?? new Uint8Array());
  if (renderData !== undefined && role !== 'service') {
    assertEntryModule('render.js', renderData);
  }
}

/** 归档阶段（.cpk）。 */
function archiveStage(bytes: Uint8Array): readonly IZipEntry[] {
  if (bytes.length > CPK_LIMITS.archiveBytes) {
    throw cliError('CPK_LIMIT_EXCEEDED', '归档大小超过 50 MiB', { stage: 'archive' });
  }
  const entries = readZipStore(bytes);
  if (entries.length > CPK_LIMITS.members) {
    throw cliError('CPK_LIMIT_EXCEEDED', '文件成员数超过 512', { stage: 'archive' });
  }
  let total = 0;
  for (const entry of entries) {
    assertPathSafe(entry.path);
    assertNoNestedArchive(entry.path);
    total += entry.data.length;
    if (entry.data.length > CPK_LIMITS.singleFileBytes) {
      throw cliError('CPK_LIMIT_EXCEEDED', `单个文件超过 16 MiB：${entry.path}`, {
        stage: 'archive',
        file: entry.path,
      });
    }
    if (entry.path === 'manifest.yaml' && entry.data.length > CPK_LIMITS.manifestBytes) {
      throw cliError('CPK_LIMIT_EXCEEDED', 'manifest.yaml 超过 256 KiB', {
        stage: 'archive',
        file: entry.path,
      });
    }
  }
  if (total > CPK_LIMITS.totalBytes) {
    throw cliError('CPK_LIMIT_EXCEEDED', '解包后总大小超过 50 MiB', { stage: 'archive' });
  }
  const manifestCount = entries.filter((entry) => entry.path === 'manifest.yaml').length;
  if (manifestCount === 0) {
    throw cliError('CPK_MANIFEST_MISSING', '包根缺少 manifest.yaml', { stage: 'manifest' });
  }
  return entries;
}

function toMembers(entries: readonly IZipEntry[]): Map<string, Uint8Array> {
  const members = new Map<string, Uint8Array>();
  for (const entry of entries) {
    members.set(entry.path, entry.data);
  }
  return members;
}

/** 签名阶段。 */
export function verifySignature(input: {
  readonly entries: readonly IZipEntry[];
  readonly source: CliPluginSource;
  readonly trustRoots: Readonly<Record<string, string>>;
}): ICliArtifactStageResult {
  const signatureEntry = input.entries.find((entry) => entry.path === SIGNATURE_FILE);
  if (signatureEntry === undefined) {
    if (input.source === 'builtin') {
      throw cliError('CPK_SIGNATURE_REQUIRED', 'builtin 来源必须签名', { stage: 'signature' });
    }
    if (input.source === 'development') {
      return stage('signature', 'skipped', 'development 来源');
    }
    return stage('signature', 'skipped', '未签名发布者');
  }

  let document: unknown;
  try {
    document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(signatureEntry.data)) as unknown;
  } catch {
    throw cliError('CPK_SIGNATURE_INVALID', 'signature.json 不是合法 JSON', { stage: 'signature' });
  }
  if (typeof document !== 'object' || document === null) {
    throw cliError('CPK_SIGNATURE_INVALID', 'signature.json 结构非法', { stage: 'signature' });
  }
  const record = document as Record<string, unknown>;
  const format = record.format;
  const keyId = record.keyId;
  const algorithm = record.algorithm;
  const contentHash = record.contentHash;
  const signature = record.signature;
  if (
    format !== 'chips-signature-v1' ||
    typeof keyId !== 'string' ||
    keyId.length === 0 ||
    algorithm !== 'ed25519' ||
    typeof contentHash !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/.test(contentHash) ||
    typeof signature !== 'string' ||
    signature.length === 0
  ) {
    throw cliError('CPK_SIGNATURE_INVALID', 'signature.json 字段非法', { stage: 'signature' });
  }

  const computed = computeContentHash(input.entries.filter((entry) => entry.path !== SIGNATURE_FILE));
  if (computed !== contentHash) {
    throw cliError('CPK_SIGNATURE_INVALID', '包内容摘要与签名声明不一致', {
      stage: 'signature',
      expected: contentHash,
      actual: computed,
    });
  }
  if (input.source === 'development') {
    return stage('signature', 'skipped', 'development 来源');
  }
  const publicKeyPem = input.trustRoots[keyId];
  if (publicKeyPem === undefined) {
    throw cliError('CPK_SIGNATURE_INVALID', `信任根未注册的 keyId：${keyId}`, { stage: 'signature', keyId });
  }
  let verified = false;
  try {
    const key = createPublicKey(publicKeyPem);
    verified = verifySignatureValue(null, Buffer.from(contentHash, 'utf8'), key, Buffer.from(signature, 'base64'));
  } catch (error) {
    throw cliError('CPK_SIGNATURE_INVALID', `签名校验失败：${normalizeError(error).message}`, {
      stage: 'signature',
      keyId,
    });
  }
  if (!verified) {
    throw cliError('CPK_SIGNATURE_INVALID', 'Ed25519 签名校验失败', { stage: 'signature', keyId });
  }
  return stage('signature', 'passed', `keyId: ${keyId}`);
}

/** 包内容摘要（[插件包格式] §6.2）：除 `signature.json` 外成员按路径字节序升序。 */
export function computeContentHash(entries: readonly IZipEntry[]): string {
  const sorted = [...entries].sort((left, right) => compareZipPathBytes(left.path, right.path));
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const entry of sorted) {
    chunks.push(
      encoder.encode(`${entry.path}\n${sha256Hex(entry.data)}\n`),
    );
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    merged.set(chunk, position);
    position += chunk.length;
  }
  return `sha256:${sha256Hex(merged)}`;
}

/** SHA-256 小写十六进制。 */
export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** 执行五阶段校验。 */
export function validateCpk(options: ICpkValidateOptions): ICliArtifactValidateResult {
  const stages: ICliArtifactStageResult[] = [];
  const warnings: string[] = [];
  const trustRoots = options.trustRoots ?? {};

  const run = <T>(_stageName: ICliArtifactStageResult['stage'], action: () => T): T => {
    try {
      return action();
    } catch (error) {
      const normalized = normalizeError(error);
      throw cliError(normalized.code, normalized.message, {
        ...(typeof normalized.details === 'object' && normalized.details !== null
          ? (normalized.details as Record<string, unknown>)
          : {}),
        stages,
      });
    }
  };

  const kind = options.fileSystem.kind(options.path);
  if (kind === null) {
    throw cliError('CLI_PATH_NOT_FOUND', `路径不存在：${options.path}`, { path: options.path });
  }

  let entries: readonly IZipEntry[];
  if (kind === 'directory') {
    const members = run('archive', () => collectDirectory(options.fileSystem, options.path));
    entries = [...members.entries()].map(([path, data]) => ({ path, data }));
    stages.push(stage('archive', 'skipped', '目录态跳过归档校验'));
  } else {
    const bytes = options.fileSystem.readBinary(options.path);
    entries = run('archive', () => archiveStage(new Uint8Array(bytes)));
    stages.push(stage('archive', 'passed', '全部成员 Stored'));
  }

  const members = toMembers(entries);
  const manifestEntry = members.get('manifest.yaml');
  if (manifestEntry === undefined) {
    throw cliError('CPK_MANIFEST_MISSING', '包根缺少 manifest.yaml', { stage: 'manifest', stages });
  }
  const manifestText = new TextDecoder('utf-8', { fatal: false }).decode(manifestEntry);
  const parsedManifest = run('manifest', () => parseManifestText(manifestText));
  const preliminary = run('manifest', () =>
    validateManifest(
      {
        manifest: parsedManifest,
        members: new Set(members.keys()),
        catalog: options.catalog,
        ...(options.platformVersion === undefined ? {} : { platformVersion: options.platformVersion }),
      },
      options.fileSystem,
    ),
  );

  run('layout', () => validateLayout(members, preliminary.role));
  stages.push(stage('layout', 'passed', `${preliminary.role} 布局`));

  let packageVersion: string | undefined;
  if (kind === 'directory') {
    const packagePath = `${options.path.replace(/[/\\]+$/, '')}/package.json`;
    if (options.fileSystem.exists(packagePath)) {
      try {
        const packageJson = JSON.parse(options.fileSystem.readText(packagePath)) as { version?: unknown };
        if (typeof packageJson.version === 'string') {
          packageVersion = packageJson.version;
        }
      } catch {
        warnings.push('package.json 不是合法 JSON，跳过版本一致性校验');
      }
    }
  }
  if (packageVersion !== undefined && packageVersion !== preliminary.version) {
    throw cliError(
      'CPK_MANIFEST_INVALID',
      `manifest.version 与 package.json 的 version 不一致：${preliminary.version} / ${packageVersion}`,
      { stage: 'manifest', pointer: 'version', stages },
    );
  }
  stages.push(
    stage(
      'manifest',
      'passed',
      `${preliminary.id}@${preliminary.version}（${preliminary.role}）`,
    ),
  );

  const signatureStage = run('signature', () =>
    verifySignature({ entries, source: options.source, trustRoots }),
  );
  stages.push(signatureStage);
  if (signatureStage.status === 'skipped' && options.source === 'user') {
    warnings.push('未签名发布者：安装需要用户确认');
  }

  if (kind === 'file') {
    const digest = `sha256:${sha256Hex(options.fileSystem.readBinary(options.path))}`;
    stages.push(stage('hash', 'passed', digest));
  } else {
    stages.push(stage('hash', 'skipped', '目录态不做归档摘要'));
  }

  return {
    valid: true,
    stages,
    ...(warnings.length === 0 ? {} : { warnings }),
  };
}
