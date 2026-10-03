/**
 * 社区平台业务码登记表——《社区平台 API 契约》§7.3 的服务端落点。
 *
 * 本表是服务端唯一允许输出的业务码集合（§7.2：未登记业务码不得出现在响应中）；
 * 每个码固定绑定契约登记的 HTTP 状态与 `retryable` 缺省值。新增错误码必须先在
 * 契约 §7.3 登记后才能进入本表（契约 §十一.4）。
 */

export interface ErrorSpec {
  /** 契约 §7.3 登记的 HTTP 状态；`0` 表示客户端侧归一码，服务端不直接输出。 */
  readonly httpStatus: number;
  /** 契约 §7.3 登记 的 retryable 缺省值（响应缺省时客户端按表内值判定）。 */
  readonly retryable: boolean;
}

function spec(httpStatus: number, retryable: boolean): ErrorSpec {
  return { httpStatus, retryable };
}

/**
 * 业务码 → 登记规格。键名与契约 §7.3 表逐行对齐，禁止增删改名。
 */
export const CommunityErrorCode = {
  COMMUNITY_VALIDATION_ERROR: spec(400, false),
  COMMUNITY_AUTH_INVALID_CREDENTIALS: spec(401, false),
  COMMUNITY_AUTH_USER_EXISTS: spec(409, false),
  COMMUNITY_AUTH_ACCOUNT_LOCKED: spec(403, true),
  COMMUNITY_AUTH_TOKEN_MISSING: spec(401, false),
  COMMUNITY_AUTH_TOKEN_INVALID: spec(401, false),
  COMMUNITY_AUTH_TOKEN_EXPIRED: spec(401, false),
  COMMUNITY_AUTH_INSUFFICIENT_PERMISSION: spec(403, false),
  COMMUNITY_USER_NOT_FOUND: spec(404, false),
  COMMUNITY_USER_ACCOUNT_DISABLED: spec(403, false),
  COMMUNITY_ROOM_NOT_FOUND: spec(404, false),
  COMMUNITY_ROOM_FORBIDDEN: spec(403, false),
  COMMUNITY_CARD_NOT_FOUND: spec(404, false),
  COMMUNITY_CARD_FORBIDDEN: spec(403, false),
  COMMUNITY_CARD_VERSION_UNSUPPORTED: spec(422, false),
  COMMUNITY_CARD_RENDER_NOT_READY: spec(409, true),
  COMMUNITY_CARD_RENDER_ERROR: spec(409, true),
  COMMUNITY_BOX_NOT_FOUND: spec(404, false),
  COMMUNITY_BOX_FORBIDDEN: spec(403, false),
  COMMUNITY_BOX_VERSION_UNSUPPORTED: spec(422, false),
  COMMUNITY_UPLOAD_SESSION_NOT_FOUND: spec(404, false),
  COMMUNITY_UPLOAD_SESSION_EXPIRED: spec(410, false),
  COMMUNITY_UPLOAD_SESSION_STATE_INVALID: spec(409, false),
  COMMUNITY_OBJECT_ROLE_INVALID: spec(422, false),
  COMMUNITY_OBJECT_OWNERSHIP_MISMATCH: spec(422, false),
  COMMUNITY_OBJECT_PATH_INVALID: spec(422, false),
  COMMUNITY_OBJECT_SIZE_MISMATCH: spec(422, false),
  COMMUNITY_DOWNLOAD_SESSION_NOT_FOUND: spec(404, false),
  COMMUNITY_DOWNLOAD_SESSION_EXPIRED: spec(410, false),
  COMMUNITY_FILE_TYPE_INVALID: spec(415, false),
  COMMUNITY_FILE_TOO_LARGE: spec(413, false),
  COMMUNITY_FILE_CORRUPT: spec(422, false),
  COMMUNITY_IDEMPOTENCY_CONFLICT: spec(409, false),
  COMMUNITY_RATE_LIMITED: spec(429, true),
  COMMUNITY_SERVICE_UNAVAILABLE: spec(503, true),
  COMMUNITY_INTERNAL_ERROR: spec(500, true),
  // 客户端侧归一码（契约 §7.3 末行）：服务端不输出，仅登记保持全表完整。
  COMMUNITY_RESPONSE_INVALID: spec(0, true),
} as const;

export type CommunityErrorCodeType = keyof typeof CommunityErrorCode;

/** 校验一个字符串是否为已登记业务码。 */
export function isRegisteredErrorCode(code: string): code is CommunityErrorCodeType {
  return Object.prototype.hasOwnProperty.call(CommunityErrorCode, code);
}
