/**
 * 服务器配置（16-社区客户端设计 §5.3 服务器地址与会话绑定的纯函数面；旧仓
 * `lib/server-config.ts` 校验素材重写迁移，旧词表 `community.server.baseUrl` /
 * `community.refreshToken` 作废不迁移）。
 *
 * - 配置键：自身命名空间 `plugins.chips.official.community-client` 下的 `server.baseUrl`，
 *   默认 `https://www.chipscard.space`（默认值来自包内 `assets/schemas/config.schema.json`，§5.3）；
 * - 设置页校验（§5.3）：仅接受 `http` / `https` 绝对 URL，去除尾斜杠；域名必须命中客户端
 *   已声明的 `network:http` 域集合，否则拒绝并归 `COMMUNITY_CLIENT_SERVER_UNSUPPORTED`；
 * - 已声明域集合来自设计 §8.2 生产清单（`www.chipscard.space`、`chipscard.space`、
 *   `file.chipscard.space`、本地联调 `127.0.0.1:3000`）；manifest 权限面随网络臂落波同步声明。
 */

/** 默认社区服务器基址（§5.3；客户端不写死备用域名，11-社区平台API契约 §2.1）。 */
export const DEFAULT_COMMUNITY_SERVER_URL = 'https://www.chipscard.space';

/** 配置命名空间（10-配置系统：插件自身命名空间取插件 ID）。 */
export const COMMUNITY_CONFIG_NAMESPACE = 'plugins.chips.official.community-client';

/** 服务器基址配置键（命名空间内相对键；§5.3）。 */
export const COMMUNITY_SERVER_BASE_URL_KEY = 'server.baseUrl';

/** 命名空间全键（经 `config:*` 读写时使用；配置域宿主处理器候工单066 落波）。 */
export const COMMUNITY_SERVER_BASE_URL_FULL_KEY = `${COMMUNITY_CONFIG_NAMESPACE}.${COMMUNITY_SERVER_BASE_URL_KEY}`;

/** 已声明 `network:http` 域集合（16-CC §8.2 生产清单；host 段，非默认端口带端口）。 */
export const DECLARED_COMMUNITY_HTTP_DOMAINS: readonly string[] = [
  'www.chipscard.space',
  'chipscard.space',
  'file.chipscard.space',
  '127.0.0.1:3000',
];

/**
 * 归一服务器基址（§5.3）：仅接受 `http` / `https` 绝对 URL，去除尾斜杠后返回；
 * 其余形态（协议不符、无法解析、非绝对地址）返回 `null`。
 */
export function normalizeCommunityServerUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }
  return parsed.toString().replace(/\/+$/, '');
}

/** 提取权限域段（`host[:port]`；默认端口去除，与 §8.2 声明形态一致）。 */
export function extractHttpDomain(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }
  const defaultPort = parsed.protocol === 'https:' ? '443' : '80';
  return parsed.port === '' || parsed.port === defaultPort ? parsed.hostname.toLowerCase() : `${parsed.hostname.toLowerCase()}:${parsed.port}`;
}

/** 服务器地址校验结果：通过并携带归一基址，或拒绝并携带在册错误码。 */
export type ServerUrlValidation =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly code: 'COMMUNITY_CLIENT_SERVER_UNSUPPORTED' };

/**
 * 设置页保存校验（§5.3）：格式归一 + 域集合命中检查；
 * 拒绝时归 `COMMUNITY_CLIENT_SERVER_UNSUPPORTED` 并由界面说明支持范围（§9.2）。
 */
export function validateCommunityServerUrl(
  value: string,
  declaredDomains: readonly string[] = DECLARED_COMMUNITY_HTTP_DOMAINS,
): ServerUrlValidation {
  const normalized = normalizeCommunityServerUrl(value);
  if (normalized === null) {
    return { ok: false, code: 'COMMUNITY_CLIENT_SERVER_UNSUPPORTED' };
  }
  const domain = extractHttpDomain(normalized);
  if (domain === null || !declaredDomains.includes(domain)) {
    return { ok: false, code: 'COMMUNITY_CLIENT_SERVER_UNSUPPORTED' };
  }
  return { ok: true, url: normalized };
}

/** 支持范围的简体中文说明（§9.3 文案原则：说明支持范围）。 */
export function describeServerScope(
  declaredDomains: readonly string[] = DECLARED_COMMUNITY_HTTP_DOMAINS,
): string {
  return `客户端仅支持以下社区服务器：${declaredDomains.map((domain) => `https://${domain}`).join('、')}（本地联调可用 http://127.0.0.1:3000）`;
}
