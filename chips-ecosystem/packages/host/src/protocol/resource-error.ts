/**
 * 资源错误码到 HTTP 状态的映射与协议层文案。
 *
 * 权威：`06-资源协议规范` §7.2（错误码表）、§5.3（协议处理器契约：错误响应体为简体中文纯文本，
 * 不含真实路径、堆栈与内部标识）。
 */

/** 资源错误码；取自 `06-资源协议规范` §7.2。 */
export type ResourceErrorCode =
  | 'RESOURCE_INVALID_URI'
  | 'RESOURCE_UNSUPPORTED_SCHEME'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_PATH_INVALID'
  | 'RESOURCE_PERMISSION_DENIED'
  | 'RESOURCE_TOO_LARGE'
  | 'RESOURCE_BUSY'
  | 'RESOURCE_HANDLE_RELEASED'
  | 'RESOURCE_HANDLE_INVALIDATED'
  | 'RESOURCE_POOL_EXHAUSTED'
  | 'RESOURCE_READ_ONLY'
  | 'RESOURCE_ALREADY_EXISTS'
  | 'RESOURCE_NOT_EMPTY'
  | 'RESOURCE_NOT_SUPPORTED'
  | 'RESOURCE_CROSS_SCOPE'
  | 'RESOURCE_WRITE_FAILED'
  | 'RESOURCE_NETWORK_FAILED'
  | 'RESOURCE_INTERNAL';

/** 协议路径错误码 → HTTP 状态（`—` 表示该错误不暴露给协议路径，映射为 500 兜底）。 */
export const RESOURCE_ERROR_HTTP_STATUS: Readonly<Record<ResourceErrorCode, number>> = {
  RESOURCE_INVALID_URI: 400,
  RESOURCE_UNSUPPORTED_SCHEME: 500,
  RESOURCE_NOT_FOUND: 404,
  RESOURCE_PATH_INVALID: 400,
  RESOURCE_PERMISSION_DENIED: 403,
  RESOURCE_TOO_LARGE: 413,
  RESOURCE_BUSY: 503,
  RESOURCE_HANDLE_RELEASED: 500,
  RESOURCE_HANDLE_INVALIDATED: 500,
  RESOURCE_POOL_EXHAUSTED: 503,
  RESOURCE_READ_ONLY: 500,
  RESOURCE_ALREADY_EXISTS: 409,
  RESOURCE_NOT_EMPTY: 409,
  RESOURCE_NOT_SUPPORTED: 501,
  RESOURCE_CROSS_SCOPE: 403,
  RESOURCE_WRITE_FAILED: 500,
  RESOURCE_NETWORK_FAILED: 502,
  RESOURCE_INTERNAL: 500,
};

/** 协议路径错误文案；不含内部标识与路径（§5.3）。 */
export const RESOURCE_ERROR_MESSAGES: Readonly<Record<ResourceErrorCode, string>> = {
  RESOURCE_INVALID_URI: '资源地址无效',
  RESOURCE_UNSUPPORTED_SCHEME: '不支持的资源协议',
  RESOURCE_NOT_FOUND: '资源不存在',
  RESOURCE_PATH_INVALID: '资源路径无效',
  RESOURCE_PERMISSION_DENIED: '没有访问该资源的权限',
  RESOURCE_TOO_LARGE: '资源超过大小上限',
  RESOURCE_BUSY: '资源正被占用，请稍后重试',
  RESOURCE_HANDLE_RELEASED: '资源句柄已释放',
  RESOURCE_HANDLE_INVALIDATED: '资源句柄已失效',
  RESOURCE_POOL_EXHAUSTED: '资源句柄数量超限',
  RESOURCE_READ_ONLY: '资源为只读',
  RESOURCE_ALREADY_EXISTS: '目标已存在',
  RESOURCE_NOT_EMPTY: '目录非空',
  RESOURCE_NOT_SUPPORTED: '当前操作不受支持',
  RESOURCE_CROSS_SCOPE: '跨作用域访问被拒绝',
  RESOURCE_WRITE_FAILED: '资源写入失败',
  RESOURCE_NETWORK_FAILED: '外部资源请求失败',
  RESOURCE_INTERNAL: '资源读取失败',
};

/** 判断字符串是否为已登记资源错误码。 */
export function isResourceErrorCode(value: string): value is ResourceErrorCode {
  return value in RESOURCE_ERROR_HTTP_STATUS;
}

/** 取错误码对应的 HTTP 状态；未登记错误码按 `RESOURCE_INTERNAL`（500）兜底。 */
export function resourceErrorStatus(code: string): number {
  return isResourceErrorCode(code) ? RESOURCE_ERROR_HTTP_STATUS[code] : 500;
}

/** 取错误码对应的协议层文案；未登记错误码按 `RESOURCE_INTERNAL` 文案兜底。 */
export function resourceErrorMessage(code: string): string {
  return isResourceErrorCode(code) ? RESOURCE_ERROR_MESSAGES[code] : RESOURCE_ERROR_MESSAGES.RESOURCE_INTERNAL;
}

/** 协议响应固定安全头。 */
export const RESOURCE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};

/** 需要附加 CORS 头的响应类型（模块脚本、字体、媒体；`05-渲染引擎设计` §4.4）。 */
export function needsCorsHeader(contentType: string | undefined): boolean {
  if (contentType === undefined) {
    return false;
  }
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (normalized.startsWith('font/')) {
    return true;
  }
  if (normalized.startsWith('audio/') || normalized.startsWith('video/')) {
    return true;
  }
  return /^(text\/javascript|application\/(javascript|ecmascript|json|wasm))$/.test(normalized);
}
