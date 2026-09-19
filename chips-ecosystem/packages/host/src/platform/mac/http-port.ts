import type { HttpRequestOptions, HttpResponse, IPalHttpPort } from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';
import type { ElectronNetLike } from '../electron/electron-api.js';
import { sendNetRequest, type NetRequestParams, type NetworkLimits } from './net-request.js';

/** macOS HTTP 端口依赖。 */
export interface MacHttpPortDependencies {
  /** Electron `net` 模块切片。 */
  readonly net: ElectronNetLike;
  /** 网络限制覆盖（测试注入）；缺省使用资源管理设计 §8.2 基线。 */
  readonly limits?: Partial<NetworkLimits>;
}

/**
 * 创建 macOS HTTP 端口。
 *
 * 权威：`04-能力契约规范` §7.10、`04-资源管理设计` §8。
 *
 * @param dependencies Electron `net` 模块与限制覆盖。
 * @returns `http:request` 端口实现。
 */
export function createMacHttpPort(dependencies: MacHttpPortDependencies): IPalHttpPort {
  const { net } = dependencies;
  const limits = dependencies.limits;

  return {
    async request(options: HttpRequestOptions): Promise<HttpResponse> {
      assertCallActive(options);
      if (!isHttpUrl(options.url)) {
        throw new PalPortError(PAL_ERROR_CODES.HTTP_URL_INVALID);
      }

      const params: NetRequestParams = {
        url: options.url,
        method: options.method ?? 'GET',
        headers: normalizeRequestHeaders(options.headers),
        ...(options.body !== undefined ? { body: options.body } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
        ...(options.deadline !== undefined ? { deadline: options.deadline } : {}),
        ...(options.authorizeRedirect !== undefined ? { authorizeRedirect: options.authorizeRedirect } : {}),
        ...(limits !== undefined ? { limits } : {}),
      };

      const result = await sendNetRequest(net, params);
      return {
        status: result.status,
        headers: result.headers,
        body: new Uint8Array(result.body),
      };
    },
  };
}

/** 判断 URL 是否可请求（仅 `http` / `https`，拒绝 userinfo 形式）。 */
export function isHttpUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  return parsed.username === '' && parsed.password === '';
}

/** 归一请求头为普通对象；未提供时为空对象。 */
function normalizeRequestHeaders(headers: Readonly<Record<string, string>> | undefined): Record<string, string> {
  return headers === undefined ? {} : { ...headers };
}
