/**
 * 文档挂载 scope 派生算法与 `DOCUMENT_SCOPE_OWNER` 哨兵常量（工单036 波 A2b-α，任务 #217）。
 *
 * 权威：`04-资源管理设计` §11.3「挂载 scope 派生规则」（形
 * `scope = (card- | box-) + hex(lower(sha256(规范化绝对路径)))` 的前 **40** 个 hex 字符，
 * 160 bit 截断（OQ-1 裁定），总长 ≤ 45 < 64 的 `ScopeId` 预算，字符集恒合《06.02》§2.3
 * `[a-z][a-z0-9-]*`）；三细则按**裁决I-⑤** 定案执行（《04.11》:205-206 明记归 host 侧算法波次裁定）：
 *
 * - **软链解析＝做**：以 `fs.realpathSync` 取磁盘实形后再哈希——与核心 `attach_root`
 *   以 canonical 路径入挂载表（`chips-resource/src/directory.rs:107-125`）同一权威，
 *   杜绝同一物理根派生两个 scope（裁决I-③ 点名的双登记风险与裁决I-① 的叠加态）；
 * - **大小写折叠＝不做**：realpath 已归一到目录项实际拼写，哈希输入取 canonical 路径
 *   UTF-8 原字节，不额外 lower（hex 输出恒小写，字符集天然合规）；
 * - **尾分隔符＝去除**：唯一例外为文件系统根 `/`，使 `/a/b` 与 `/a/b/` 派生同一 scope。
 *
 * @remarks
 * - 本模块是派生算法**本体**（host 侧单源），native 绑定面对 scope 一律透传不生成
 *   （《04.11》§11.3 在册）；前缀 `card-` / `box-` 依来源形（`.card` / `.box` 包名判别键）分派，
 *   核心注册闸按 `scope.rs` 前缀-种类对应校验（Document → `card-` 或 `box-`）。
 * - `DOCUMENT_SCOPE_OWNER`（RFC 裁定G OQ-7 定案，名与值在册 `packages/native/README.md`
 *   与《04.11》§11.3 表说明列）由 host 定义并注入，绑定层只透传不改写
 *   （`packages/native/src/resource.rs` `document_registration` 头注在册）；固定平台服务身份哨兵，
 *   比照核心 `TEMP_SCOPE_OWNER` 先例、非伪造用户身份。
 * - 失败以端口登记的 `RESOURCE_*` 码抛出（`DocumentCapabilityError` 同构形态，能力层原样透传）；
 *   错误文案不携真实路径（《06.07》§7.1 不泄露口径，与绑定层挂载闸同形）。
 * - 哈希走 Node `crypto`（SHA-256 / FIPS 180-4 标准实现）：本模块只在主进程 TS 侧运行，
 *   与 `carrier/` 内联实现的选型差异系运行面不同（渲染侧无 Node），不构成双算法源。
 */

import { realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';

import type { DocumentKind } from './contract.js';
import { DocumentCapabilityError } from './errors.js';

/**
 * 文档域作用域注册的固定平台服务身份哨兵（OQ-7 定案，RFC `:98`；裁决I 派单书第 3 项）。
 * 定义与注入位在 host（本常量即唯一权威），绑定层与核心只透传落 `ScopeRegistration.owner`。
 */
export const DOCUMENT_SCOPE_OWNER = 'chips.official.document-service';

/**
 * 目标作用域注册的在册绑定标识哨兵（W5 T-ws 工作区作用域臂）。
 *
 * @remarks
 * - 非打开文档的目标作用域（export 目标/暂存物、create 落点）经
 *   {@link ./adapters/scope-adapter.js} `ensureTargetScope` 注册时，在册账活绑定的
 *   `documentId` 位落本哨兵——此刻尚无文档记录可归属；create 落地后由文档记录以真实
 *   `documentId` 经 `registerScope` 幂等臂**接管**（哨兵位翻正为真实标识，同一活绑定、
 *   同一原生会话，INV-1 不分叉）。
 * - 结构判别权威：真实 `card_id`/`box_id` 为 62 字符 base62（字母与数字，05-ID生成规范
 *   §三/§四），不含点号；本哨兵含点号，与一切真实文档标识**结构性不相交**——接管臂与
 *   释放臂据此判别绑定归属，禁以词法猜测替代。
 */
export const DOCUMENT_TARGET_SCOPE_BINDING_ID = 'chips.official.document-target';

/** 派生 scope 的 hex 截断长度（160 bit，OQ-1 裁定：sha256 全 64 hex 取前 40）。 */
export const DOCUMENT_SCOPE_HEX_LENGTH = 40;

/** `ScopeId` 字符预算（《06.02》§2.3：1–64 字符）；派生形恒 45 字符，天然留足预算余量。 */
export const DOCUMENT_SCOPE_ID_MAX_LENGTH = 64;

/** 文档 kind → scope 前缀的在册对应（`scope.rs` 前缀-种类校验臂同规格）。 */
export function documentScopePrefix(kind: DocumentKind): 'card-' | 'box-' {
  return kind === 'card' ? 'card-' : 'box-';
}

/** 构造端口登记的 `RESOURCE_*` 码失败（文案不携真实路径，《06.07》§7.1）。 */
function resourceFailure(code: string, message: string): DocumentCapabilityError {
  return new DocumentCapabilityError(code, { message });
}

/**
 * 去掉 canonical 路径的尾分隔符（裁决I-⑤ 细则三）：POSIX 剥尾随 `/`，win32 剥尾随 `\` 与 `/`；
 * 唯一例外为文件系统根（POSIX `/`、win32 根 `C:\` 形态经 `isAbsolute` 与 realpath 保证不再带尾）。
 */
export function stripTrailingSeparators(canonicalPath: string): string {
  const stripped = canonicalPath.replace(/[\\/]+$/u, '');
  // 根目录例外：全分隔符路径（如 `/`、`\\`）归一为其单形。
  if (stripped.length === 0) {
    return canonicalPath.length > 0 ? canonicalPath.slice(0, 1) : canonicalPath;
  }
  return stripped;
}

/**
 * 把绝对路径规范化为派生输入（裁决I-⑤ 三细则的合成执行点）：
 * `realpathSync`（软链解析，磁盘实形）→ 去尾分隔符（根 `/` 例外）。
 *
 * @param absolutePath 绝对路径（相对路径与 URI 形态一律拒绝——归一责任在调用方入口守卫）。
 * @throws {DocumentCapabilityError} 已登记 `RESOURCE_*` 码：非绝对路径 `RESOURCE_INVALID_URI`；
 * 目标缺失/不是目录层级 `RESOURCE_NOT_FOUND`；权限不可达 `RESOURCE_PERMISSION_DENIED`；
 * 其余解析异常（如符号链接环）`RESOURCE_INTERNAL`。文案不携真实路径。
 */
export function canonicalizeDocumentPath(absolutePath: string): string {
  if (typeof absolutePath !== 'string' || absolutePath.length === 0 || !isAbsolute(absolutePath)) {
    throw resourceFailure('RESOURCE_INVALID_URI', '文档作用域派生仅受理绝对路径（裸相对路径与远端引用不承载）');
  }
  let real: string;
  try {
    real = realpathSync(absolutePath);
  } catch (error: unknown) {
    throw mapRealpathFailure(error);
  }
  return stripTrailingSeparators(real);
}

/** `realpathSync` 异常 → 端口登记码映射（fail-closed，文案零路径）。 */
function mapRealpathFailure(error: unknown): DocumentCapabilityError {
  const code = (error as { code?: unknown }).code;
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return resourceFailure('RESOURCE_NOT_FOUND', '文档来源不存在或不可达');
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return resourceFailure('RESOURCE_PERMISSION_DENIED', '文档来源路径不可达（权限拒绝）');
  }
  return resourceFailure('RESOURCE_INTERNAL', '文档来源路径规范化失败');
}

/**
 * 对 canonical 绝对路径求 `sha256(UTF-8 字节)` 的前 40 个 hex 字符（恒小写）。
 *
 * @remarks 输入必须已是 {@link canonicalizeDocumentPath} 产物；本函数不做任何文件系统触达，
 * 纯函数形态供派生与测试双侧复用。
 */
export function hashCanonicalDocumentPath(canonicalPath: string): string {
  return createHash('sha256').update(canonicalPath, 'utf8').digest('hex').slice(0, DOCUMENT_SCOPE_HEX_LENGTH);
}

/**
 * 派生文档挂载 scope：`documentScopePrefix(kind) + hashCanonicalDocumentPath(canonical)`。
 *
 * 输入为非规范化的绝对路径（内部先规范化），同路径不同尾分隔符、经不同符号链接指向同一
 * 物理根均派生同一 scope（裁决I-⑤；#213 §4.1-4 的 macOS 双 scope 风险由软链解析直接消解）。
 */
export function deriveDocumentScope(absolutePath: string, kind: DocumentKind): string {
  return deriveDocumentScopeFromCanonical(canonicalizeDocumentPath(absolutePath), kind);
}

/** 从已规范化的 canonical 路径派生 scope（适配器复用位：规范化只触盘一次）。 */
export function deriveDocumentScopeFromCanonical(canonicalPath: string, kind: DocumentKind): string {
  return `${documentScopePrefix(kind)}${hashCanonicalDocumentPath(canonicalPath)}`;
}
