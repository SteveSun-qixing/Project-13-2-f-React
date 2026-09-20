/**
 * 信任根注入面（[CLI 完整参考] §2.7、[插件包格式] §6.3）。
 *
 * 命令面唯一的正式注入通道：环境变量 `CHIPS_TRUST_ROOTS_FILE` 指向信任注册文件，
 * 文件形状冻结为夹具链在用形状：
 *
 * ```json
 * { "version": 1, "description": "…", "trustRoots": { "<keyId>": "<SPKI PEM 公钥>" } }
 * ```
 *
 * 解析结果与库面构造选项 `trustRoots` 同形（keyId → Ed25519 公钥 SPKI PEM），
 * 汇入同一 `verifySignature` 判定实现——本模块只做加载与形状校验，不做任何签名判定。
 */

import { cliError } from '../errors.js';
import type { IFileSystemPort } from '../args/filesystem.js';

/** 信任根注入环境变量名（[CLI 完整参考] §2.7 登记表）。 */
export const TRUST_ROOTS_ENV = 'CHIPS_TRUST_ROOTS_FILE';

/** 信任注册文件顶层允许出现的字段（严格 schema：未知字段拒绝）。 */
const ALLOWED_TOP_LEVEL_FIELDS: ReadonlySet<string> = new Set([
  'version',
  'description',
  'trustRoots',
]);

/** 加载并校验信任注册文件，返回 keyId → SPKI PEM 公钥表。 */
export function loadTrustRootsFile(
  fileSystem: IFileSystemPort,
  path: string
): Readonly<Record<string, string>> {
  if (!fileSystem.exists(path)) {
    throw cliError('CLI_PATH_NOT_FOUND', `信任注册文件不存在：${path}`, {
      path,
      env: TRUST_ROOTS_ENV,
    });
  }
  if (fileSystem.kind(path) !== 'file') {
    throw cliError('CLI_PATH_INVALID', `信任注册路径不是文件：${path}`, { path, env: TRUST_ROOTS_ENV });
  }
  let document: unknown;
  try {
    document = JSON.parse(fileSystem.readText(path)) as unknown;
  } catch {
    throw cliError('CLI_ARGUMENT_INVALID', `信任注册文件不是合法 JSON：${path}`, {
      path,
      env: TRUST_ROOTS_ENV,
    });
  }
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw cliError('CLI_ARGUMENT_INVALID', '信任注册文件结构非法：顶层必须是对象', { path });
  }
  const record = document as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_TOP_LEVEL_FIELDS.has(key)) {
      throw cliError('CLI_ARGUMENT_INVALID', `信任注册文件含未知顶层字段：${key}`, {
        path,
        field: key,
      });
    }
  }
  if (record.version !== 1) {
    throw cliError('CLI_ARGUMENT_INVALID', '信任注册文件 version 必须为数值 1', {
      path,
      field: 'version',
    });
  }
  if (record.description !== undefined && typeof record.description !== 'string') {
    throw cliError('CLI_ARGUMENT_INVALID', '信任注册文件 description 必须是字符串', {
      path,
      field: 'description',
    });
  }
  const roots = record.trustRoots;
  if (typeof roots !== 'object' || roots === null || Array.isArray(roots)) {
    throw cliError('CLI_ARGUMENT_INVALID', '信任注册文件 trustRoots 必须是 keyId → 公钥的对象', {
      path,
      field: 'trustRoots',
    });
  }
  const trustRoots: Record<string, string> = {};
  for (const [keyId, publicKey] of Object.entries(roots)) {
    if (keyId.length === 0 || typeof publicKey !== 'string' || publicKey.length === 0) {
      throw cliError(
        'CLI_ARGUMENT_INVALID',
        `信任注册文件 trustRoots 条目非法（keyId 与公钥必须为非空字符串）：${keyId || '(空 keyId)'}`,
        { path, keyId }
      );
    }
    trustRoots[keyId] = publicKey;
  }
  return trustRoots;
}
