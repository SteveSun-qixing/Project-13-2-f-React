/**
 * `chips-resource://` URI 语法解析与归一化。
 *
 * 权威：`06-资源协议规范` §二（URI 语法）、§2.6（转义与归一化）、§2.7（合法与非法示例）。
 *
 * @remarks
 * - 本模块是壳（协议处理器与 preload 预检）对 URI 的**语法级**校验；作用域注册、PathGuard 与
 *   权限判定在资源管理器（核心），本模块不等于安全边界（06-资源协议规范 §5.1）。
 * - 解析基于原始字符串，不信任 URL 解析器的路径折叠结果；百分号解码只执行一次，
 *   解码后按 `/` 重新分段并重新执行全部校验。
 */

/** URI 级错误原因（`IResourceUriErrorDetails.reason`）。 */
export type ResourceUriErrorReason =
  | 'malformed_scheme'
  | 'unsupported_scheme'
  | 'malformed_scope'
  | 'malformed_path'
  | 'query_not_allowed'
  | 'fragment_not_allowed'
  | 'invalid_encoding'
  | 'invalid_origin';

/** 路径级错误原因（`IResourcePathErrorDetails.reason`）。 */
export type ResourcePathErrorReason =
  'absolute' | 'separator' | 'segment' | 'encoding' | 'control' | 'unicode' | 'length' | 'platform';

/** 解析失败结果。 */
export interface ResourceUriParseFailure {
  /** 失败标志。 */
  readonly ok: false;
  /** 错误码：`RESOURCE_INVALID_URI`（URI 级）或 `RESOURCE_PATH_INVALID`（路径级）或 `RESOURCE_UNSUPPORTED_SCHEME`。 */
  readonly code: 'RESOURCE_INVALID_URI' | 'RESOURCE_PATH_INVALID' | 'RESOURCE_UNSUPPORTED_SCHEME';
  /** URI 级原因。 */
  readonly reason: ResourceUriErrorReason;
  /** 路径级原因；仅路径校验失败时给出。 */
  readonly pathReason?: ResourcePathErrorReason;
  /** 原始输入。 */
  readonly uri: string;
}

/** External 作用域的归一化 origin。 */
export interface ResourceExternalOrigin {
  /** 归一化 scheme（小写）：`http` / `https` / `webdav`。 */
  readonly scheme: string;
  /** 归一化 host（小写、punycode、去除尾随点）。 */
  readonly host: string;
  /** 显式端口；默认端口已省略。 */
  readonly port: number | null;
}

/** 解析成功结果。 */
export interface ResourceUriParseSuccess {
  /** 成功标志。 */
  readonly ok: true;
  /** 原始输入。 */
  readonly uri: string;
  /** 归一化后的作用域 ID（小写）。 */
  readonly scope: string;
  /** 归一化后的虚拟路径（NFC，解码一次，无首尾斜杠）；空串表示作用域根。 */
  readonly path: string;
  /** 查询串；仅 External 作用域非空。 */
  readonly query: string | null;
  /** External 作用域的 origin 信息。 */
  readonly origin: ResourceExternalOrigin | null;
}

/** 解析结果。 */
export type ResourceUriParseResult = ResourceUriParseSuccess | ResourceUriParseFailure;

/** URI 总长度上限（超过返回 `RESOURCE_PATH_INVALID`（`length`））。 */
export const RESOURCE_URI_MAX_LENGTH = 8192;

/** 路径长度上限。 */
export const RESOURCE_PATH_MAX_LENGTH = 4096;

/** 单段长度上限。 */
export const RESOURCE_PATH_SEGMENT_MAX_LENGTH = 255;

const SCOPE_PATTERN = /^[a-z][a-z0-9-]*$/;
const SCOPE_MAX_LENGTH = 64;
const SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const HEX_PATTERN = /^[0-9a-fA-F]{2}$/;
const DEFAULT_PORTS: Readonly<Record<string, number>> = { http: 80, https: 443 };
const EXTERNAL_SCHEMES = new Set(['http', 'https', 'webdav']);
const RESERVED_SCOPES = new Set(['platform', 'external', 'memory']);
const MANAGED_SCOPE_PREFIXES = ['workspace-', 'card-', 'box-', 'plugin-', 'temp-'];
const WINDOWS_DEVICE_NAMES = new Set([
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

/** 判断解析结果是否为失败。 */
export function isResourceUriFailure(result: ResourceUriParseResult): result is ResourceUriParseFailure {
  return result.ok === false;
}

function failure(
  uri: string,
  code: ResourceUriParseFailure['code'],
  reason: ResourceUriErrorReason,
  pathReason?: ResourcePathErrorReason,
): ResourceUriParseFailure {
  if (pathReason === undefined) {
    return { ok: false, code, reason, uri };
  }
  return { ok: false, code, reason, pathReason, uri };
}

function pathFailure(uri: string, pathReason: ResourcePathErrorReason): ResourceUriParseFailure {
  return failure(uri, 'RESOURCE_PATH_INVALID', 'malformed_path', pathReason);
}

/** 路径校验失败归一：非法百分号编码属 URI 级错误，其余为路径级错误。 */
function pathResultFailure(uri: string, pathReason: ResourcePathErrorReason): ResourceUriParseFailure {
  return pathReason === 'encoding'
    ? failure(uri, 'RESOURCE_INVALID_URI', 'invalid_encoding')
    : pathFailure(uri, pathReason);
}

function success(
  uri: string,
  scope: string,
  path: string,
  query: string | null,
  origin: ResourceExternalOrigin | null,
): ResourceUriParseSuccess {
  return { ok: true, uri, scope, path, query, origin };
}

/** 提取 scheme 段；未包含 `://` 时返回 `null`。 */
function splitScheme(raw: string): { readonly scheme: string; readonly rest: string } | null {
  const separator = raw.indexOf('://');
  if (separator <= 0) {
    return null;
  }
  return { scheme: raw.slice(0, separator), rest: raw.slice(separator + 3) };
}

/** 校验 scheme 词法并小写化；非法返回 `null`。 */
function normalizeScheme(scheme: string): string | null {
  if (scheme.length === 0 || !SCHEME_PATTERN.test(scheme)) {
    return null;
  }
  return scheme.toLowerCase();
}

/** 判断字符串是否含控制字符。 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    if (codePoint <= 0x1f || codePoint === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * 百分号解码的失败类别（与核心 `path_guard.rs::PercentDecodeFailure` 两臂分流镜像）。
 *
 * - `malformed`：`%` 后非两位十六进制、串尾截断等编码语法非法（§2.6 `invalid_encoding`，URI 级）；
 * - `not-unicode`：解码字节序列不是合法 UTF-8（overlong、代理区、越界码位等，
 *   §2.4 Unicode 行触发臂，路径级 `unicode`，工单042 裁定④）。
 */
type PercentDecodeFailure = 'malformed' | 'not-unicode';

/**
 * 百分号解码一次并区分失败臂。
 *
 * @returns 解码产物文本；编码语法非法或解码产物非合法 UTF-8（含替换字符哨兵检出）
 * 时返回对应失败类别。
 */
function decodeOnceChecked(value: string): { readonly text: string } | PercentDecodeFailure {
  if (!value.includes('%')) {
    return { text: value };
  }
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] as string;
    if (character === '%') {
      const hex = value.slice(index + 1, index + 3);
      if (!HEX_PATTERN.test(hex)) {
        return 'malformed';
      }
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
      continue;
    }
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) {
      return 'not-unicode';
    }
    const encoded = new TextEncoder().encode(String.fromCodePoint(codePoint));
    for (const byte of encoded) {
      bytes.push(byte);
    }
  }
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(bytes));
  if (decoded.includes('\uFFFD')) {
    return 'not-unicode';
  }
  return { text: decoded };
}

/** 百分号解码仅一次；任一失败臂返回 `null`（origin 段等不区分臂的调用方使用）。 */
function decodeOnce(value: string): string | null {
  const result = decodeOnceChecked(value);
  return typeof result === 'string' ? null : result.text;
}

/**
 * 判定 Unicode 触发臂禁止出现的码位（《06.02》§2.4 Unicode 行 v1.0.4，
 * 工单043 裁定 A1 收紧为 Unicode 非字符全集 + 工单049 端点勘误；
 * 与核心 `path_guard.rs::is_forbidden_unicode` 逐码位镜像）：
 * 替换字符 U+FFFD；非字符全集——U+nFFFE/U+nFFFF（n = 0–16，全 17 平面，
 * 含 U+FFFE/U+FFFF；JS 串码位上界同为 U+10FFFF，`codePoint & 0xFFFE === 0xFFFE`
 * 天然覆盖全部平面）与非字符区 U+FDD0–U+FDEF。NFC 归一差异本身不在此列
 * （归一后校验与比较，永不因归一差异拒绝）。
 */
function isForbiddenUnicodeCodePoint(codePoint: number): boolean {
  return codePoint === 0xfffd || (codePoint >= 0xfdd0 && codePoint <= 0xfdef) || (codePoint & 0xfffe) === 0xfffe;
}

/** 扫描文本是否命中非字符/替换字符全集触发臂（解码后、NFC 归一前，镜像核心顺序）。 */
function hasForbiddenUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) {
      continue;
    }
    if (isForbiddenUnicodeCodePoint(codePoint)) {
      return true;
    }
    if (codePoint > 0xffff) {
      index += 1;
    }
  }
  return false;
}

/** 校验单段路径（解码后、NFC 归一后的文本上执行；全部作用域同走全臂）。 */
function validateSegment(segment: string): ResourcePathErrorReason | null {
  if (segment.length === 0 || segment === '.' || segment === '..') {
    return 'segment';
  }
  if (segment.includes('\\')) {
    return 'separator';
  }
  if (hasControlCharacter(segment)) {
    return 'control';
  }
  if (segment.length > RESOURCE_PATH_SEGMENT_MAX_LENGTH) {
    return 'length';
  }
  // 相对性先于平台特例（06-资源协议规范 2.4）：独立成段的盘符（`C:/x.png` 的 `C:`）是绝对路径形态；
  // 段内其余 `:` 属 Windows ADS 文件名（04-资源管理设计 9.3），归为平台特例。
  // External 作用域路径段不做豁免：核心 PathGuard 对 external 路径同走平台特例全臂
  // （任务 #190 D4 判定面等值翻正，旧臂跳检为预检弱位）。
  if (/^[A-Za-z]:$/.test(segment)) {
    return 'absolute';
  }
  if (segment.includes(':')) {
    return 'platform';
  }
  if (/[. ]$/.test(segment)) {
    return 'platform';
  }
  const baseName = segment.split('.')[0]?.toLowerCase() ?? '';
  if (WINDOWS_DEVICE_NAMES.has(baseName)) {
    return 'platform';
  }
  return null;
}

/** 校验并归一化虚拟路径；失败返回错误原因。 */
function normalizePath(rawPath: string): { readonly path: string } | ResourcePathErrorReason {
  if (rawPath.includes('\\')) {
    return 'separator';
  }
  const decodedResult = decodeOnceChecked(rawPath);
  if (decodedResult === 'malformed') {
    return 'encoding';
  }
  if (decodedResult === 'not-unicode') {
    return 'unicode';
  }
  const decoded = decodedResult.text;
  // 非字符/替换字符全集触发臂（《06.02》§2.4 Unicode 行 v1.0.4）：解码产物扫描即拒，
  // 字面 U+FFFD / U+FFFE / U+FFFF / U+FDD0–U+FDEF / U+nFFFE / U+nFFFF 全不设防旧臂随本行收口。
  if (hasForbiddenUnicode(decoded)) {
    return 'unicode';
  }
  // NFC 规范化差异本身不构成拒绝（《06.02》§2.4 Unicode 行权威文面，任务 #190 D1 翻正）：
  // 解码产物归一为 NFC 后继续执行全部校验与比较（04-资源管理设计 9.4「覆盖 Unicode
  // 规范化差异」的归一形态）；零放宽——全部拒绝臂在归一产物上原样执行。
  const normalized = decoded.normalize('NFC');
  if (normalized.length > RESOURCE_PATH_MAX_LENGTH) {
    return 'length';
  }
  const segments = normalized.length === 0 ? [] : normalized.split('/');
  for (const segment of segments) {
    const reason = validateSegment(segment);
    if (reason !== null) {
      return reason;
    }
  }
  return { path: segments.join('/') };
}

/** 归一化 External origin；失败返回错误原因。 */
function normalizeOrigin(
  schemeSegment: string,
  hostSegment: string,
): { readonly origin: ResourceExternalOrigin } | 'invalid_origin' | 'invalid_encoding' {
  const decodedScheme = decodeOnce(schemeSegment);
  const decodedHost = decodeOnce(hostSegment);
  if (decodedScheme === null || decodedHost === null) {
    return 'invalid_encoding';
  }
  const scheme = decodedScheme.toLowerCase();
  const hostPart = decodedHost;
  if (!EXTERNAL_SCHEMES.has(scheme)) {
    return 'invalid_origin';
  }
  if (hostPart.length === 0 || hostPart.includes('@') || /\s/.test(hostPart)) {
    return 'invalid_origin';
  }
  let parsed: URL;
  try {
    parsed = new URL(`${scheme}://${hostPart}`);
  } catch {
    return 'invalid_origin';
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return 'invalid_origin';
  }
  const host = parsed.hostname.replace(/\.$/, '');
  if (host.length === 0) {
    return 'invalid_origin';
  }
  if (parsed.port.length > 0) {
    const port = Number.parseInt(parsed.port, 10);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      return 'invalid_origin';
    }
    if (port !== DEFAULT_PORTS[scheme]) {
      return { origin: { scheme, host, port } };
    }
  }
  return { origin: { scheme, host, port: null } };
}

/** 解析受管作用域段。 */
function parseManagedScope(scopeSegment: string, uri: string): { readonly scope: string } | ResourceUriParseFailure {
  const scope = scopeSegment.toLowerCase();
  if (scope.length === 0 || scope.length > SCOPE_MAX_LENGTH || !SCOPE_PATTERN.test(scope)) {
    return failure(uri, 'RESOURCE_INVALID_URI', 'malformed_scope');
  }
  if (scope === 'external') {
    return failure(uri, 'RESOURCE_INVALID_URI', 'malformed_scope');
  }
  if (RESERVED_SCOPES.has(scope)) {
    return { scope };
  }
  if (!MANAGED_SCOPE_PREFIXES.some((prefix) => scope.startsWith(prefix))) {
    return failure(uri, 'RESOURCE_INVALID_URI', 'malformed_scope');
  }
  return { scope };
}

/** 判断字符串是否为已登记的受管作用域（前缀 + opaque 段）。 */
export function isManagedResourceScope(scope: string): boolean {
  return MANAGED_SCOPE_PREFIXES.some((prefix) => scope.startsWith(prefix));
}

/** 判断字符串是否为保留 scope。 */
export function isReservedResourceScope(scope: string): boolean {
  return RESERVED_SCOPES.has(scope);
}

/**
 * 解析 `chips-resource://` 规范 URI。
 *
 * @param raw 原始 URI（必须已是规范形态；裸 `http(s)://` 先经 {@link normalizeResourceInput}）。
 */
export function parseResourceUri(raw: string): ResourceUriParseResult {
  if (typeof raw !== 'string' || raw.length === 0) {
    return failure(String(raw), 'RESOURCE_INVALID_URI', 'malformed_scheme');
  }
  if (raw.length > RESOURCE_URI_MAX_LENGTH) {
    return pathFailure(raw, 'length');
  }
  if (raw.includes('#')) {
    return failure(raw, 'RESOURCE_INVALID_URI', 'fragment_not_allowed');
  }
  const parts = splitScheme(raw);
  if (parts === null) {
    return failure(raw, 'RESOURCE_INVALID_URI', 'malformed_scheme');
  }
  const scheme = normalizeScheme(parts.scheme);
  if (scheme === null) {
    return failure(raw, 'RESOURCE_INVALID_URI', 'malformed_scheme');
  }
  if (scheme !== 'chips-resource') {
    return failure(raw, 'RESOURCE_UNSUPPORTED_SCHEME', 'unsupported_scheme');
  }
  const authorityEnd = parts.rest.indexOf('/');
  const scopeSegment = authorityEnd < 0 ? parts.rest : parts.rest.slice(0, authorityEnd);
  const pathAndQuery = authorityEnd < 0 ? '' : parts.rest.slice(authorityEnd + 1);

  if (scopeSegment.toLowerCase() === 'external') {
    const queryIndex = pathAndQuery.indexOf('?');
    const externalPath = queryIndex < 0 ? pathAndQuery : pathAndQuery.slice(0, queryIndex);
    const query = queryIndex < 0 ? null : pathAndQuery.slice(queryIndex + 1);
    const segments = externalPath.split('/');
    const schemeSegment = segments[0] ?? '';
    const hostSegment = segments[1] ?? '';
    if (schemeSegment.length === 0 || hostSegment.length === 0) {
      return failure(raw, 'RESOURCE_INVALID_URI', 'invalid_origin');
    }
    const originResult = normalizeOrigin(schemeSegment, hostSegment);
    if (originResult === 'invalid_origin' || originResult === 'invalid_encoding') {
      return failure(raw, 'RESOURCE_INVALID_URI', originResult);
    }
    const restPath = segments.slice(2).join('/');
    const pathResult = normalizePath(restPath);
    if (typeof pathResult === 'string') {
      return pathResultFailure(raw, pathResult);
    }
    return success(raw, 'external', pathResult.path, query, originResult.origin);
  }

  if (pathAndQuery.includes('?')) {
    return failure(raw, 'RESOURCE_INVALID_URI', 'query_not_allowed');
  }
  const scopeResult = parseManagedScope(scopeSegment, raw);
  if ('ok' in scopeResult && scopeResult.ok === false) {
    return scopeResult;
  }
  const managed = scopeResult as { scope: string };
  const pathResult = normalizePath(pathAndQuery);
  if (typeof pathResult === 'string') {
    return pathResultFailure(raw, pathResult);
  }
  return success(raw, managed.scope, pathResult.path, null, null);
}

/**
 * 归一化资源输入。
 *
 * - `chips-resource://`：语法校验并回写规范形态；
 * - 裸 `http(s)://`：按 §2.6 归一为 External 规范 URI；
 * - 其余 scheme（含 `file://`、`webdav://`）：`RESOURCE_UNSUPPORTED_SCHEME`。
 */
export function normalizeResourceInput(raw: string): ResourceUriParseResult {
  if (typeof raw !== 'string' || raw.length === 0) {
    return failure(String(raw), 'RESOURCE_INVALID_URI', 'malformed_scheme');
  }
  const parts = splitScheme(raw);
  if (parts === null) {
    return failure(raw, 'RESOURCE_INVALID_URI', 'malformed_scheme');
  }
  const scheme = normalizeScheme(parts.scheme);
  if (scheme === null) {
    return failure(raw, 'RESOURCE_INVALID_URI', 'malformed_scheme');
  }
  if (scheme === 'http' || scheme === 'https') {
    return normalizeBareHttpUri(raw, scheme);
  }
  return parseResourceUri(raw);
}

/** 把裸 `http(s)://` 归一为 External 规范 URI。 */
function normalizeBareHttpUri(raw: string, scheme: string): ResourceUriParseResult {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return failure(raw, 'RESOURCE_INVALID_URI', 'invalid_origin');
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return failure(raw, 'RESOURCE_INVALID_URI', 'invalid_origin');
  }
  const host = parsed.hostname.replace(/\.$/, '');
  if (host.length === 0) {
    return failure(raw, 'RESOURCE_INVALID_URI', 'invalid_origin');
  }
  const portValue = parsed.port.length > 0 ? Number.parseInt(parsed.port, 10) : null;
  const port = portValue !== null && portValue === DEFAULT_PORTS[scheme] ? null : portValue;
  const authority = port === null ? host : `${host}:${port}`;
  const canonical = `chips-resource://external/${scheme}/${authority}${parsed.pathname}${parsed.search}`;
  const pathResult = normalizePath(parsed.pathname.replace(/^\//, ''));
  if (typeof pathResult === 'string') {
    return pathResultFailure(canonical, pathResult);
  }
  return success(canonical, 'external', pathResult.path, parsed.search.length > 0 ? parsed.search.slice(1) : null, {
    scheme,
    host,
    port,
  });
}

/**
 * 把解析结果回写为规范 URI 字符串（定位器形态，不含查询串）。
 *
 * @remarks
 * External 的 query 不参与作用域归属判定（06-资源协议规范 2.5），也不属于资源定位器本体；
 * 2.6 节归一结果中的 query 由 {@link ResourceUriParseSuccess.uri}（裸地址归一入口）与
 * `parsed.query` 字段完整保留，回写通道按 9.4 节要求脱敏后审计。
 */
export function toCanonicalResourceUri(parsed: ResourceUriParseSuccess): string {
  if (parsed.scope === 'external') {
    const origin = parsed.origin;
    if (origin === null) {
      return 'chips-resource://external/';
    }
    const authority = origin.port === null ? origin.host : `${origin.host}:${origin.port}`;
    return `chips-resource://external/${origin.scheme}/${authority}/${parsed.path}`;
  }
  return `chips-resource://${parsed.scope}/${parsed.path}`;
}
