/**
 * `chips-resource://` URI 语法与归一（06-资源协议规范 §2）。
 *
 * 规则要点：
 * - `chips-resource://<scope>/<path>[?<query>]`；scope 位于 authority 位置；
 * - 只允许 `/` 分隔；拒绝反斜杠、绝对路径、盘符/UNC、空段、`.`、`..`（含解码后）；
 * - 百分号解码仅一次，解码后重新分段并执行全部校验；控制字符一律拒绝；
 * - 受管作用域禁止查询串与 fragment；`external` 作用域保留查询串并参与 origin 归一；
 * - `resource()` 接受裸 `http(s)://` 并按 external 归一；`file://`、`webdav://` 与未知 scheme 返回 `RESOURCE_UNSUPPORTED_SCHEME`。
 */

import { ChipsError } from './errors.js';
import { RESOURCE_ERROR_CODES } from './resource.js';

export type ResourceUriCategory =
  | 'workspace'
  | 'document'
  | 'plugin'
  | 'platform'
  | 'temporary'
  | 'memory'
  | 'external';

export interface IExternalOrigin {
  readonly scheme: string;
  /** 归一化 host：小写、IDN 转 punycode、IPv6 保留方括号。 */
  readonly host: string;
  /** 显式端口；默认端口（http 80 / https 443）省略。 */
  readonly port?: number;
}

export interface IResourceUri {
  /** 归一化后的规范 URI。 */
  readonly uri: string;
  /** authority 段（作用域 ID；external 时为 `external`）。 */
  readonly authority: string;
  readonly category: ResourceUriCategory;
  /** 作用域内虚拟路径（不含前导 `/`；空路径仅作为 `resourceBase` 基址）。 */
  readonly path: string;
  /** external 作用域的 origin；受管作用域为 undefined。 */
  readonly external?: IExternalOrigin;
}

export interface IResourceUriOptions {
  /** URI 总长度上限，默认 4096。 */
  readonly maxUriLength?: number;
  /** 单段长度上限，默认 255。 */
  readonly maxSegmentLength?: number;
}

const DEFAULT_MAX_URI_LENGTH = 4096;
const DEFAULT_MAX_SEGMENT_LENGTH = 255;

const SCOPE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/;
const ASCII_PATTERN = /^[\x20-\x7e]*$/;
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || codePoint === 0x7f) {
      return true;
    }
  }
  return false;
}
const RESERVED_DEVICE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const RESERVED_SCOPES = new Set(['platform', 'external', 'memory']);

function invalidUri(reason: string, message: string): ChipsError {
  return new ChipsError({
    code: RESOURCE_ERROR_CODES.invalidUri,
    message,
    details: { reason },
    retryable: false,
  });
}

function pathInvalid(reason: string, message: string): ChipsError {
  return new ChipsError({
    code: RESOURCE_ERROR_CODES.pathInvalid,
    message,
    details: { reason },
    retryable: false,
  });
}

function unsupportedScheme(uri: string): ChipsError {
  return new ChipsError({
    code: RESOURCE_ERROR_CODES.unsupportedScheme,
    message: '该资源地址协议不受支持',
    details: { uri, reason: 'scheme' },
    retryable: false,
  });
}

function decodeOnce(raw: string): string {
  try {
    return decodeURIComponent(raw).normalize('NFC');
  } catch {
    throw invalidUri('invalid_encoding', '资源地址编码不合法');
  }
}

const PERCENT_TRIPLET = /%([0-9a-fA-F]{2})/g;

/** 规范 URI 中的百分号编码统一为十六进制大写（06-资源协议规范 §2.6）。 */
function uppercasePercentEncoding(value: string): string {
  return value.replace(PERCENT_TRIPLET, (_match, hex: string) => `%${hex.toUpperCase()}`);
}

function validateSegment(segment: string, maxSegmentLength: number): void {
  if (segment.length === 0) {
    throw pathInvalid('segment', '资源路径不允许空段');
  }
  if (segment === '.' || segment === '..') {
    throw pathInvalid('segment', '资源路径不允许相对段');
  }
  if (segment.length > maxSegmentLength) {
    throw invalidUri('length', '资源路径片段过长');
  }
  if (hasControlCharacter(segment)) {
    throw pathInvalid('control', '资源路径包含控制字符');
  }
  if (segment.includes('\\')) {
    throw pathInvalid('separator', '资源路径不允许反斜杠');
  }
  if (segment.includes(':')) {
    throw pathInvalid('platform', '资源路径不允许冒号');
  }
  if (/[. ]$/.test(segment)) {
    throw pathInvalid('platform', '资源路径不允许尾随点或空格');
  }
  if (RESERVED_DEVICE_NAMES.test(segment)) {
    throw pathInvalid('platform', '资源路径不允许设备名');
  }
}

interface INormalizedPath {
  /** 解码、NFC 规范化并按 `/` 重新分段后的虚拟路径。 */
  readonly path: string;
  /** 规范 URI 使用的路径段（保持输入编码，仅统一百分号十六进制大小写）。 */
  readonly canonicalPath: string;
}

/**
 * 校验并归一作用域内虚拟路径；`rawPath` 为已剥离查询串、未解码的原始路径。
 * 解码只做一次，解码后按 `/` 重新分段并执行全部校验；规范 URI 保持编码形态。
 */
function validatePath(rawPath: string, maxSegmentLength: number): INormalizedPath {
  if (rawPath === '') {
    return { path: '', canonicalPath: '' };
  }
  if (rawPath.includes('\\')) {
    throw pathInvalid('separator', '资源路径不允许反斜杠');
  }
  if (rawPath.includes(' ')) {
    throw pathInvalid('encoding', '空格必须编码为 %20');
  }
  const decoded = decodeOnce(rawPath);
  if (decoded.startsWith('/') || /^[A-Za-z]:/.test(decoded) || decoded.startsWith('\\\\')) {
    throw pathInvalid('absolute', '资源路径必须相对作用域根');
  }
  if (hasControlCharacter(decoded)) {
    throw pathInvalid('control', '资源路径包含控制字符');
  }
  const segments = decoded.split('/').map((segment) => {
    validateSegment(segment, maxSegmentLength);
    return segment;
  });
  return {
    path: segments.join('/'),
    canonicalPath: uppercasePercentEncoding(rawPath),
  };
}

function categoryOf(authority: string): ResourceUriCategory {
  if (authority === 'platform') return 'platform';
  if (authority === 'external') return 'external';
  if (authority === 'memory') return 'memory';
  if (authority.startsWith('workspace-')) return 'workspace';
  if (authority.startsWith('card-') || authority.startsWith('box-')) return 'document';
  if (authority.startsWith('plugin-')) return 'plugin';
  if (authority.startsWith('temp-')) return 'temporary';
  return 'document';
}

function encodeHostForUri(origin: IExternalOrigin): string {
  return origin.host.replace(/\[/g, '%5B').replace(/\]/g, '%5D');
}

function normalizeExternalOrigin(
  schemeInput: string,
  hostInput: string,
): { origin: IExternalOrigin; authoritySegment: string } {
  const scheme = schemeInput.toLowerCase();
  if (!SCHEME_PATTERN.test(scheme)) {
    throw invalidUri('invalid_origin', '外部资源 origin 不合法');
  }
  if (hostInput.includes('@') || hostInput.includes('/') || hostInput.includes('?') || hostInput === '') {
    throw invalidUri('invalid_origin', '外部资源 origin 不合法');
  }
  let url: URL;
  try {
    url = new URL(`${scheme}://${hostInput}/`);
  } catch {
    throw invalidUri('invalid_origin', '外部资源 origin 不合法');
  }
  if (url.username !== '' || url.password !== '') {
    throw invalidUri('invalid_origin', '外部资源地址不允许携带用户信息');
  }
  if (url.hostname === '') {
    throw invalidUri('invalid_origin', '外部资源地址缺少主机名');
  }
  const origin: IExternalOrigin = {
    scheme,
    host: url.hostname,
    ...(url.port !== '' ? { port: Number(url.port) } : {}),
  };
  const authoritySegment = `${origin.scheme}/${encodeHostForUri(origin)}${
    origin.port !== undefined ? `:${origin.port}` : ''
  }`;
  return { origin, authoritySegment };
}

/** 把裸 `http(s)://` 引用归一为 External 规范 URI（06-资源协议规范 §2.6）。 */
export function normalizeHttpReference(input: string): string {
  const schemeSeparator = input.indexOf('://');
  const scheme = input.slice(0, schemeSeparator).toLowerCase();
  const rest = input.slice(schemeSeparator + 3);
  let authorityEnd = rest.length;
  for (let index = 0; index < rest.length; index += 1) {
    const char = rest[index];
    if (char === '/' || char === '?' || char === '#') {
      authorityEnd = index;
      break;
    }
  }
  const authority = rest.slice(0, authorityEnd);
  if (authority.includes('@')) {
    throw invalidUri('invalid_origin', '外部资源地址不允许携带用户信息');
  }
  const { authoritySegment } = normalizeExternalOrigin(scheme, authority);
  let pathAndQuery = rest.slice(authorityEnd);
  if (pathAndQuery.startsWith('?')) {
    pathAndQuery = `/${pathAndQuery}`;
  }
  const queryIndex = pathAndQuery.indexOf('?');
  const rawPath = queryIndex < 0 ? pathAndQuery : pathAndQuery.slice(0, queryIndex);
  const query = queryIndex < 0 ? '' : pathAndQuery.slice(queryIndex);
  const pathWithoutLeadingSlash = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
  return `chips-resource://external/${authoritySegment}/${uppercasePercentEncoding(pathWithoutLeadingSlash)}${query}`;
}

function splitAuthorityAndPath(input: string): { authority: string; raw: string } {
  const separatorIndex = input.indexOf('//');
  const afterScheme = input.slice(separatorIndex + 2);
  const authorityEnd = afterScheme.indexOf('/');
  if (authorityEnd < 0) {
    throw invalidUri('absolute', '资源地址缺少作用域路径');
  }
  return {
    authority: afterScheme.slice(0, authorityEnd),
    raw: afterScheme.slice(authorityEnd + 1),
  };
}

/** 解析并归一 `chips-resource://` URI；语法非法时抛出带 `details.reason` 的 `ChipsError`。 */
export function parseResourceUri(input: string, options: IResourceUriOptions = {}): IResourceUri {
  const maxUriLength = options.maxUriLength ?? DEFAULT_MAX_URI_LENGTH;
  const maxSegmentLength = options.maxSegmentLength ?? DEFAULT_MAX_SEGMENT_LENGTH;
  if (input.length === 0 || input.length > maxUriLength) {
    throw invalidUri('length', '资源地址长度不合法');
  }
  if (input.includes('#')) {
    throw invalidUri('fragment_not_allowed', '资源地址不允许 fragment');
  }
  if (!ASCII_PATTERN.test(input)) {
    throw invalidUri('encoding', '资源地址必须使用百分号编码');
  }
  const schemeMatch = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(input);
  if (schemeMatch === null || schemeMatch[1]?.toLowerCase() !== 'chips-resource') {
    throw unsupportedScheme(input);
  }
  const { authority: rawAuthority, raw } = splitAuthorityAndPath(input);
  const authority = rawAuthority.toLowerCase();
  if (!SCOPE_PATTERN.test(authority)) {
    throw invalidUri('scope', '资源作用域标识不合法');
  }
  const category = categoryOf(authority);
  const queryIndex = raw.indexOf('?');
  const rawPath = queryIndex < 0 ? raw : raw.slice(0, queryIndex);
  const query = queryIndex < 0 ? undefined : raw.slice(queryIndex + 1);
  if (category !== 'external' && query !== undefined) {
    throw invalidUri('query_not_allowed', '受管作用域不允许查询串');
  }

  if (category === 'external') {
    const firstSlash = rawPath.indexOf('/');
    const secondSlash = firstSlash < 0 ? -1 : rawPath.indexOf('/', firstSlash + 1);
    if (firstSlash < 0 || secondSlash < 0) {
      throw invalidUri('invalid_origin', '外部资源地址缺少 origin');
    }
    const rawScheme = rawPath.slice(0, firstSlash);
    const rawHost = rawPath.slice(firstSlash + 1, secondSlash);
    const rawRest = rawPath.slice(secondSlash + 1);
    const scheme = decodeOnce(rawScheme).toLowerCase();
    const host = decodeOnce(rawHost);
    const { origin, authoritySegment } = normalizeExternalOrigin(scheme, host);
    const normalizedPath = validatePath(rawRest, maxSegmentLength);
    const querySuffix = query === undefined || query === '' ? '' : `?${query}`;
    return {
      uri: `chips-resource://external/${authoritySegment}/${normalizedPath.canonicalPath}${querySuffix}`,
      authority,
      category,
      path: normalizedPath.path,
      external: origin,
    };
  }

  const normalizedPath = validatePath(rawPath, maxSegmentLength);
  return {
    uri: `chips-resource://${authority}/${normalizedPath.canonicalPath}`,
    authority,
    category,
    path: normalizedPath.path,
  };
}

/**
 * 资源入口归一：`chips-resource://` 原样解析；裸 `http(s)://` 归一为 External URI；
 * 其余 scheme（含 `file://`、`webdav://`）返回 `RESOURCE_UNSUPPORTED_SCHEME`。
 */
export function normalizeResourceInput(input: string, options: IResourceUriOptions = {}): IResourceUri {
  const schemeMatch = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(input);
  if (schemeMatch === null) {
    throw invalidUri('scheme', '资源地址缺少协议前缀');
  }
  const scheme = schemeMatch[1]?.toLowerCase();
  if (scheme === 'http' || scheme === 'https') {
    return parseResourceUri(normalizeHttpReference(input), options);
  }
  if (scheme !== 'chips-resource') {
    throw unsupportedScheme(input);
  }
  return parseResourceUri(input, options);
}

/** 作用域是否为平台保留字。 */
export function isReservedResourceScope(scope: string): boolean {
  return RESERVED_SCOPES.has(scope);
}
