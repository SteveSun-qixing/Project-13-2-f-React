/**
 * `.cpk` 打包（[插件包格式] §7.1）：校验源码版本一致性 → 结构校验 → 收集暂存 →
 * ZIP Store → 安装摘要 → 输出到插件 `dist/`。
 *
 * 同一输入两次打包必须字节级可复现（成员按路径字节序升序、时间戳固定、无扩展字段）。
 */

import { createPrivateKey, sign as signValue } from 'node:crypto';
import { basename, join } from 'node:path';

import { cliError } from '../errors.js';
import type { ICliArtifactPackResult } from '../client/types.js';
import type { IFileSystemPort } from '../args/filesystem.js';
import { parseManifestText, validateManifest } from './manifest.js';
import type { IPermissionCatalog } from './permission-catalog.js';
import { collectDirectory, computeContentHash, sha256Hex, validateLayout } from './cpk-validate.js';
import { writeZipStore, type IZipEntry } from './zip.js';

/**
 * 打包输入的收集投影（[插件包格式] §7.1「收集到暂存目录」）：插件工程目录内只有
 * 包根白名单条目参与打包——`manifest.yaml`、`render.js` 与 `dist/`、`assets/` 子树；
 * `package.json` 仅参与版本一致性校验，`src/`、`node_modules/`、脚手架与文档等
 * 源码工程文件一律不进入归档（§2.2）。
 */
const PACK_ROOT_FILES: readonly string[] = ['manifest.yaml', 'render.js'];
const PACK_ROOT_DIRECTORIES: readonly string[] = ['dist', 'assets'];

/** 嵌套归档扩展名（[插件包格式] §2.6）：打包输入命中即拒绝，防止旧产物被二次打包。 */
const NESTED_ARCHIVE_EXTENSIONS: readonly string[] = [
  '.zip',
  '.tar',
  '.tgz',
  '.7z',
  '.cpk',
  '.gz',
  '.rar',
];

/** 打包输入。 */
export interface ICpkPackOptions {
  readonly fileSystem: IFileSystemPort;
  readonly dir: string;
  readonly out?: string;
  readonly sign: boolean;
  readonly keyId?: string;
  readonly signingKeyFile?: string;
  readonly catalog: IPermissionCatalog;
  readonly platformVersion?: string;
}

/** 按包根白名单收集打包输入（POSIX 相对路径 → 字节内容）。 */
function collectPackInput(fileSystem: IFileSystemPort, dir: string): Map<string, Uint8Array> {
  const members = new Map<string, Uint8Array>();
  for (const name of PACK_ROOT_FILES) {
    const path = `${dir}/${name}`;
    if (fileSystem.kind(path) === 'file') {
      members.set(name, fileSystem.readBinary(path));
    }
  }
  for (const name of PACK_ROOT_DIRECTORIES) {
    const path = `${dir}/${name}`;
    if (fileSystem.kind(path) !== 'directory') {
      continue;
    }
    for (const [relative, data] of collectDirectory(fileSystem, path)) {
      members.set(`${name}/${relative}`, data);
    }
  }
  for (const path of members.keys()) {
    const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    if (path.includes('.') && NESTED_ARCHIVE_EXTENSIONS.includes(`.${extension}`)) {
      throw cliError(
        'CPK_ARCHIVE_INVALID',
        `打包输入包含嵌套归档（通常是未清理的旧产物）：${path}`,
        { stage: 'archive', file: path }
      );
    }
  }
  return members;
}

/** 打包插件工程为 `.cpk`。 */
export function packCpk(options: ICpkPackOptions): ICliArtifactPackResult {
  const fileSystem = options.fileSystem;
  const dir = options.dir.replace(/[/\\]+$/, '');
  if (fileSystem.kind(dir) !== 'directory') {
    throw cliError('CLI_PATH_INVALID', `插件工程目录不存在或不是目录：${dir}`, { path: dir });
  }
  const members = collectPackInput(fileSystem, dir);

  const manifestEntry = members.get('manifest.yaml');
  if (manifestEntry === undefined) {
    throw cliError('CPK_MANIFEST_MISSING', '插件工程缺少 manifest.yaml', { stage: 'manifest' });
  }
  const packageVersion = readPackageVersion(fileSystem, dir);
  const manifest = validateManifest(
    {
      manifest: parseManifestText(new TextDecoder('utf-8', { fatal: false }).decode(manifestEntry)),
      members: new Set(members.keys()),
      catalog: options.catalog,
      ...(options.platformVersion === undefined
        ? {}
        : { platformVersion: options.platformVersion }),
      ...(packageVersion === undefined ? {} : { packageVersion }),
    },
    fileSystem
  );

  validateLayout(members, manifest.role);

  const entries: IZipEntry[] = [...members.entries()]
    .filter(([path]) => path !== 'signature.json')
    .map(([path, data]) => ({ path, data }));

  let signed = false;
  if (options.sign) {
    if (options.keyId === undefined || options.signingKeyFile === undefined) {
      throw cliError('CLI_ARGUMENT_INVALID', '签名需要 --key-id 与 CHIPS_SIGNING_KEY_FILE', {
        params: ['key-id', 'CHIPS_SIGNING_KEY_FILE'],
      });
    }
    const contentHash = computeContentHash(entries);
    const signature = signContentHash(contentHash, options.signingKeyFile, fileSystem);
    const signatureDocument = {
      format: 'chips-signature-v1',
      keyId: options.keyId,
      algorithm: 'ed25519',
      contentHash,
      signature,
    };
    entries.push({
      path: 'signature.json',
      data: new TextEncoder().encode(`${JSON.stringify(signatureDocument, null, 2)}\n`),
    });
    signed = true;
  }

  const archive = writeZipStore(entries);
  const outDirectory = options.out ?? join(dir, 'dist');
  fileSystem.ensureDirectory(outDirectory);
  const name = basename(dir);
  const archivePath = join(outDirectory, `${name}-${manifest.version}.cpk`);
  fileSystem.writeBinary(archivePath, archive);

  return {
    archivePath,
    name,
    version: manifest.version,
    role: manifest.role,
    memberCount: entries.length,
    archiveSize: archive.length,
    digest: `sha256:${sha256Hex(archive)}`,
    signed,
  };
}

function readPackageVersion(fileSystem: IFileSystemPort, dir: string): string | undefined {
  const path = `${dir}/package.json`;
  if (!fileSystem.exists(path)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(fileSystem.readText(path)) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : undefined;
  } catch {
    throw cliError('CPK_MANIFEST_INVALID', 'package.json 不是合法 JSON', {
      stage: 'manifest',
      file: 'package.json',
    });
  }
}

function signContentHash(
  contentHash: string,
  signingKeyFile: string,
  fileSystem: IFileSystemPort
): string {
  try {
    const pem = fileSystem.readText(signingKeyFile);
    const key = createPrivateKey(pem);
    const signature = signValue(null, Buffer.from(contentHash, 'utf8'), key);
    return signature.toString('base64');
  } catch (error) {
    // 原始异常文本只进 `details.cause`，不拼进 `message`（《RFC-ChipsError统一裁定》§4.5 条 3）。
    throw cliError('CPK_SIGNATURE_INVALID', '签名失败', {
      stage: 'signature',
      keyFile: signingKeyFile,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
