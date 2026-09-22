/**
 * 审计条目落盘前脱敏单点（§8.5；工单046 段二）。
 *
 * 权威逐条对应：
 * - §8.5 条 1「不记录凭证值、文件内容、网络请求体」：审计条目形状为 §8.2 十六字段封闭集，
 *   本模块**只拾取契约字段**成帧——运行期对象上任何越形状夹带键（凭证串、内容片段、
 *   请求体等）一律不入行；§8.2 形状本身不携带内容/请求体/凭证位。
 * - §8.5 条 2「网络目标只记录 scheme、host 与 port，不记录 path 中的敏感查询参数」：
 *   `resourceUri` / `target` / `qualifier` 三自由文本位上的网络目标降为
 *   `scheme://host[:port]`（裸 `http(s)://` 与 `chips-resource://external/<scheme>/<host>[:<port>]/…`
 *   两形态；默认端口按 WHATWG URL 归一自然省略，非默认端口保留）。
 * - §8.5 条 3「路径本身属于用户数据，仅记录到审计文件，不进入遥测」：文件系统路径与
 *   非 external 资源定位器**原样保留**（§8.3 样例 `/Users/user/Documents/chips` 同形），
 *   遥测面在写入器之外，本面天然不向遥测供数。
 * - URI query 脱敏沿用 `protocol/resource-uri.ts` 在册口径（「External 的 query 不参与
 *   作用域归属判定……回写通道按 9.4 节要求脱敏后审计」）：非 external `chips-resource://`
 *   定位器经 `toCanonicalResourceUri` 回写（定位器形态本就不含查询串），其余不可解析
 *   URI 形态剥除 `?query` / `#fragment` 与 userinfo 腿。
 */

import { parseResourceUri, toCanonicalResourceUri } from '../protocol/resource-uri.js';
import type { IPermissionAuditEntry } from '@chips/bridge';

/** 落盘帧的可缺省拾取形：必填八字段恒在，可选八字段缺位即键不出现（§8.3 样例同形）。 */
export interface SanitizedAuditRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly action: IPermissionAuditEntry['action'];
  readonly source?: IPermissionAuditEntry['source'];
  readonly actor: IPermissionAuditEntry['actor'];
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly sessionId?: string;
  readonly permission: string;
  readonly qualifier?: string;
  readonly capabilityId?: string;
  readonly target?: string;
  readonly resourceUri?: string;
  readonly reason?: IPermissionAuditEntry['reason'];
  readonly traceId: string;
  readonly requestId?: string;
}

/** 含协议腿的取值判据（`scheme://` 前缀）。 */
const SCHEME_SEPARATOR = '://';

/**
 * 脱敏单个 URI/目标形态取值（作用于 `resourceUri` / `target` / `qualifier` 三位）。
 *
 * @remarks 非 URI 形态（文件路径、域名、窗口 ID 等）原样返回——§8.5 条 3 明示路径
 * 属于可入审计文件的用户数据；§8.2 样例即保留 `/Users/user/Documents/chips` 全形。
 */
export function sanitizeAuditUriValue(value: string): string {
  const schemeEnd = value.indexOf(SCHEME_SEPARATOR);
  if (schemeEnd <= 0) {
    return value;
  }
  const scheme = value.slice(0, schemeEnd).toLowerCase();

  // chips-resource 统一资源协议腿：走在册解析器，规范回写天然剥离 query（resource-uri.ts 484 口径）。
  if (scheme === 'chips-resource') {
    const parsed = parseResourceUri(value);
    if (parsed.ok) {
      if (parsed.scope === 'external') {
        const origin = parsed.origin;
        if (origin !== null) {
          const authority = origin.port === null ? origin.host : `${origin.host}:${origin.port}`;
          return `chips-resource://external/${origin.scheme}/${authority}`;
        }
        return 'chips-resource://external/';
      }
      return toCanonicalResourceUri(parsed);
    }
    return stripQueryFragmentAndUserinfo(value);
  }

  // 裸网络目标腿（§8.5 条 2 字面对象）：只记录 scheme、host 与 port。
  if (scheme === 'http' || scheme === 'https') {
    try {
      const url = new URL(value);
      return url.origin;
    } catch {
      return stripQueryFragmentAndUserinfo(value);
    }
  }

  // 其余 scheme（含不可解析 URI 形态）：保守剥除查询/片段与 userinfo 腿，定位器主体保留。
  return stripQueryFragmentAndUserinfo(value);
}

/** 剥除 `?query`、`#fragment` 与 authority 内 userinfo 腿（脱敏失败兜底臂）。 */
function stripQueryFragmentAndUserinfo(value: string): string {
  const cut = value.split(/[?#]/)[0] as string;
  const separator = cut.indexOf(SCHEME_SEPARATOR);
  if (separator <= 0) {
    return cut;
  }
  const scheme = cut.slice(0, separator);
  const rest = cut.slice(separator + SCHEME_SEPARATOR.length);
  const authorityEnd = rest.search(/[/?]/);
  const authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  const at = authority.lastIndexOf('@');
  const host = at === -1 ? authority : authority.slice(at + 1);
  const tail = authorityEnd === -1 ? '' : rest.slice(authorityEnd);
  return `${scheme}://${host}${tail}`;
}

/**
 * 拾取 + 脱敏：产出一行审计帧。
 *
 * @remarks 只拾取 §8.2 十六契约字段（越形状键不入帧）；三自由文本位
 * （`qualifier` / `target` / `resourceUri`）过 {@link sanitizeAuditUriValue}。
 */
export function sanitizeAuditEntry(entry: IPermissionAuditEntry): SanitizedAuditRecord {
  const record: SanitizedAuditRecord = {
    id: entry.id,
    timestamp: entry.timestamp,
    action: entry.action,
    ...(entry.source === undefined ? {} : { source: entry.source }),
    actor: entry.actor,
    pluginId: entry.pluginId,
    pluginVersion: entry.pluginVersion,
    ...(entry.sessionId === undefined ? {} : { sessionId: entry.sessionId }),
    permission: entry.permission,
    ...(entry.qualifier === undefined ? {} : { qualifier: sanitizeAuditUriValue(entry.qualifier) }),
    ...(entry.capabilityId === undefined ? {} : { capabilityId: entry.capabilityId }),
    ...(entry.target === undefined ? {} : { target: sanitizeAuditUriValue(entry.target) }),
    ...(entry.resourceUri === undefined ? {} : { resourceUri: sanitizeAuditUriValue(entry.resourceUri) }),
    ...(entry.reason === undefined ? {} : { reason: entry.reason }),
    traceId: entry.traceId,
    ...(entry.requestId === undefined ? {} : { requestId: entry.requestId }),
  };
  return record;
}
