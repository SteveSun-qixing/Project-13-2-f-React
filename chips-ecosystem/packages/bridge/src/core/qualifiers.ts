/**
 * 限定值匹配分派（08-权限系统设计 §7.3 / §7.4 / §7.5、§3.2）。
 *
 * 判定只使用会话快照与调用目标，常数为集合匹配 + 纯字符串运算；
 * 符号链接解析与真实路径核对是资源层的纵深防御，这里通过 `realpath` 接缝可选接入。
 */

import { parseResourceUri } from '../protocol/resource-uri.js';
import { findPermissionDefinition, type PermissionQualifierKind } from '../protocol/permissions.js';
import type { ISessionSnapshot } from '../protocol/session.js';
import type { IPermissionGrant } from '../protocol/permission.js';

/** 内置目录变量（08-权限系统设计 §7.3）。 */
export const DIRECTORY_VARIABLES = [
  'userHome',
  'userDocuments',
  'userDownloads',
  'userDesktop',
  'userPictures',
  'userMusic',
  'userVideos',
  'userData',
  'temp',
] as const;

export type DirectoryVariable = (typeof DIRECTORY_VARIABLES)[number];

export type PlatformId = 'darwin' | 'win32' | 'linux';

export interface IPermissionEnvironmentOptions {
  readonly platform: PlatformId;
  /** 目录变量解析表；缺失变量返回 undefined（fail-closed）。 */
  readonly directories: Readonly<Partial<Record<DirectoryVariable, string>>>;
  /** 可选：符号链接解析（已存在部分取真实路径）。 */
  readonly realpath?: (path: string) => string;
  /** 插件私有数据目录（免权限范围）。 */
  readonly pluginDataRoot?: (pluginId: string) => string | undefined;
  /** 会话自身资源作用域判定（插件自身 `chips-resource://<scope>/...`）。 */
  readonly isOwnResourceScope?: (session: ISessionSnapshot, scope: string) => boolean;
  /** 文档标识 → 资源作用域（供 document 目标判定）。 */
  readonly documentScope?: (documentId: string, session: ISessionSnapshot) => string | undefined;
}

export interface IPermissionEnvironment {
  readonly platform: PlatformId;
  expandDirectoryVariable(value: string): string | undefined;
  realpath(value: string): string;
  readonly pluginDataRoot?: (pluginId: string) => string | undefined;
  readonly isOwnResourceScope?: (session: ISessionSnapshot, scope: string) => boolean;
  readonly documentScope?: (documentId: string, session: ISessionSnapshot) => string | undefined;
}

const DIRECTORY_VARIABLE_PATTERN = /\$\{([A-Za-z][A-Za-z0-9]*)\}/g;

function normalizePath(value: string, platform: PlatformId): string {
  const replaced = value.replace(/\\/g, '/');
  const driveMatch = /^([A-Za-z]):/.exec(replaced);
  let prefix = '';
  let rest = replaced;
  if (driveMatch !== null) {
    prefix = `${(driveMatch[1] ?? '').toUpperCase()}:`;
    rest = replaced.slice(2);
  }
  const isAbsolute = rest.startsWith('/') || driveMatch !== null;
  const segments: string[] = [];
  for (const segment of rest.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  const joined = segments.join('/');
  const normalized = isAbsolute ? `${prefix}/${joined}` : joined;
  if (platform === 'win32') {
    return normalized.toLowerCase();
  }
  if (platform === 'darwin') {
    return normalized.toLowerCase();
  }
  return normalized;
}

/** 路径限定匹配：展开变量 → 归一化 → 前缀比较（目录边界精确）。 */
export function matchPathQualifier(
  qualifier: string,
  target: string,
  env: IPermissionEnvironment
): boolean {
  const expandedQualifier = env.expandDirectoryVariable(qualifier);
  const expandedTarget = env.expandDirectoryVariable(target);
  if (expandedQualifier === undefined || expandedTarget === undefined) {
    return false;
  }
  const normalizedQualifier = normalizePath(env.realpath(expandedQualifier), env.platform);
  const normalizedTarget = normalizePath(env.realpath(expandedTarget), env.platform);
  if (normalizedTarget === normalizedQualifier) {
    return true;
  }
  return normalizedTarget.startsWith(`${normalizedQualifier}/`);
}

interface IParsedHostPattern {
  readonly scheme?: string;
  readonly hostPattern: string;
  readonly port?: number;
}

function parseHostPattern(value: string): IParsedHostPattern | undefined {
  let rest = value;
  let scheme: string | undefined;
  const schemeIndex = rest.indexOf('://');
  if (schemeIndex >= 0) {
    scheme = rest.slice(0, schemeIndex).toLowerCase();
    rest = rest.slice(schemeIndex + 3);
  }
  if (rest.includes('@') || rest.includes('/')) {
    return undefined;
  }
  let port: number | undefined;
  const portMatch = /:(\d+)$/.exec(rest);
  if (portMatch !== null) {
    port = Number(portMatch[1]);
    rest = rest.slice(0, rest.length - portMatch[0].length);
  }
  if (rest.length === 0) {
    return undefined;
  }
  return {
    hostPattern: rest.toLowerCase(),
    ...(scheme !== undefined ? { scheme } : {}),
    ...(port !== undefined ? { port } : {}),
  };
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[');
}

function matchHostPattern(pattern: string, host: string): boolean {
  if (isIpLiteral(host)) {
    return pattern === host;
  }
  const patternLabels = pattern.split('.');
  const hostLabels = host.split('.');
  if (patternLabels.length !== hostLabels.length) {
    return false;
  }
  return patternLabels.every((label, index) => label === '*' || label === hostLabels[index]);
}

function parseTargetUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (url.username !== '' || url.password !== '') {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

function defaultPortFor(scheme: string): number | undefined {
  if (scheme === 'http' || scheme === 'ws') return 80;
  if (scheme === 'https' || scheme === 'wss') return 443;
  return undefined;
}

/** 域名限定匹配（08-权限系统设计 §7.4）：`host`、`*.host`、`*`；缺省端口只匹配默认端口。 */
export function matchDomainQualifier(qualifier: string, targetUrl: string): boolean {
  const parsed = parseHostPattern(qualifier);
  if (parsed === undefined) {
    return false;
  }
  const url = parseTargetUrl(targetUrl);
  if (url === undefined) {
    return false;
  }
  const scheme = url.protocol.replace(/:$/u, '').toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    return false;
  }
  if (parsed.scheme !== undefined && parsed.scheme !== scheme) {
    return false;
  }
  const effectivePort = url.port === '' ? defaultPortFor(scheme) : Number(url.port);
  if (parsed.port !== undefined) {
    if (effectivePort !== parsed.port) {
      return false;
    }
  } else if (effectivePort !== defaultPortFor(parsed.scheme ?? scheme)) {
    return false;
  }
  return matchHostPattern(parsed.hostPattern, url.hostname.toLowerCase());
}

/** URL 限定匹配（shell:external）：`scheme` 或 `scheme://host-pattern[:port]`。 */
export function matchUrlQualifier(qualifier: string, targetUrl: string): boolean {
  const url = parseTargetUrl(targetUrl);
  if (url === undefined) {
    return false;
  }
  const scheme = url.protocol.replace(/:$/u, '').toLowerCase();
  if (!qualifier.includes('://')) {
    return qualifier.toLowerCase() === scheme;
  }
  return matchDomainQualifier(qualifier, targetUrl);
}

/** 窗口限定匹配：窗口标识模式（`*` 匹配任意字符序列；无 `:` 段约束）。 */
export function matchWindowQualifier(qualifier: string, targetWindowId: string): boolean {
  const pattern = qualifier
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${pattern}$`).test(targetWindowId);
}

/**
 * 资源作用域限定匹配（08-权限系统设计 §7.5）：限定值为 `<scope>` 或 `<scope>/<path>`，
 * 目标为 `chips-resource://` URI（或可归一为 external 的裸 `http(s)://`）。
 */
export function matchResourceQualifier(qualifier: string, target: string): boolean {
  let composite: string;
  try {
    const parsed = parseResourceUri(
      target.startsWith('chips-resource://') ? target : normalizeBareHttp(target)
    );
    composite =
      parsed.external !== undefined
        ? `external/${parsed.external.scheme}/${parsed.external.host}${
            parsed.external.port !== undefined ? `:${String(parsed.external.port)}` : ''
          }/${parsed.path}`
        : `${parsed.authority}/${parsed.path}`;
  } catch {
    return false;
  }
  const normalizedQualifier = qualifier.replace(/\/+$/u, '');
  if (normalizedQualifier.length === 0) {
    return false;
  }
  return composite === normalizedQualifier || composite.startsWith(`${normalizedQualifier}/`);
}

function normalizeBareHttp(target: string): string {
  const schemeIndex = target.indexOf('://');
  if (schemeIndex < 0) {
    return target;
  }
  const scheme = target.slice(0, schemeIndex).toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    return target;
  }
  const rest = target.slice(schemeIndex + 3);
  const authorityEnd = rest.search(/[/?#]/u);
  const authority = authorityEnd < 0 ? rest : rest.slice(0, authorityEnd);
  const pathAndQuery = authorityEnd < 0 ? '' : rest.slice(authorityEnd);
  const path = pathAndQuery.startsWith('/') ? pathAndQuery.slice(1) : pathAndQuery;
  return `chips-resource://external/${scheme}/${authority}/${path}`;
}

/** 配置命名空间匹配：命名空间精确相等。 */
export function matchConfigQualifier(qualifier: string, targetNamespace: string): boolean {
  return qualifier === targetNamespace;
}

/** 按权限定义的限定值种类分派匹配。 */
export function matchesQualifier(
  basePermission: string,
  qualifier: string | undefined,
  target: string | undefined,
  env: IPermissionEnvironment
): boolean {
  const definition = findPermissionDefinition(basePermission);
  const kind: PermissionQualifierKind = definition?.kind ?? 'none';
  if (kind === 'none') {
    return qualifier === undefined;
  }
  if (qualifier === undefined) {
    return definition?.qualifier === 'optional';
  }
  if (target === undefined) {
    return false;
  }
  switch (kind) {
    case 'path':
      return matchPathQualifier(qualifier, target, env);
    case 'domain':
      return matchDomainQualifier(qualifier, target);
    case 'url':
      return matchUrlQualifier(qualifier, target);
    case 'window':
      return matchWindowQualifier(qualifier, target);
    case 'resource':
      return matchResourceQualifier(qualifier, target);
    case 'config':
      return matchConfigQualifier(qualifier, target);
    default:
      return false;
  }
}

/** 构造权限判定环境。 */
export function createPermissionEnvironment(
  options: IPermissionEnvironmentOptions
): IPermissionEnvironment {
  const environment: IPermissionEnvironment = {
    platform: options.platform,
    expandDirectoryVariable(value: string): string | undefined {
      let failed = false;
      const expanded = value.replace(DIRECTORY_VARIABLE_PATTERN, (_match, name: string) => {
        const directory = options.directories[name as DirectoryVariable];
        if (directory === undefined) {
          failed = true;
          return '';
        }
        return directory;
      });
      return failed ? undefined : expanded;
    },
    realpath(value: string): string {
      return options.realpath !== undefined ? options.realpath(value) : value;
    },
    ...(options.pluginDataRoot !== undefined ? { pluginDataRoot: options.pluginDataRoot } : {}),
    ...(options.isOwnResourceScope !== undefined
      ? { isOwnResourceScope: options.isOwnResourceScope }
      : {}),
    ...(options.documentScope !== undefined ? { documentScope: options.documentScope } : {}),
  };
  return environment;
}

/** 授权记录是否覆盖给定基础权限与目标（含通配 `domain:*` 记录）。 */
export function grantCovers(
  grants: readonly IPermissionGrant[],
  basePermission: string,
  target: string | undefined,
  env: IPermissionEnvironment
): boolean {
  for (const grant of grants) {
    if (grant.state !== 'granted') {
      continue;
    }
    const baseMatches =
      grant.base === basePermission ||
      (grant.base.endsWith(':*') && basePermission.startsWith(`${grant.base.slice(0, -1)}`));
    if (!baseMatches) {
      continue;
    }
    if (grant.base.endsWith(':*')) {
      return true;
    }
    if (matchesQualifier(basePermission, grant.qualifier, target, env)) {
      return true;
    }
  }
  return false;
}
